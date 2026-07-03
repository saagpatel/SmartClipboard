use crate::error::{AppError, Result};
use crate::models::{ClipboardItem, SearchFilters, Settings};
use rusqlite::{Connection, params};
use std::path::Path;
use std::sync::Mutex;
use std::time::Duration;

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    /// Initialize database and run migrations
    pub fn new(app_data_dir: &Path) -> Result<Self> {
        // Create app data directory if it doesn't exist
        std::fs::create_dir_all(app_data_dir)?;

        let db_path = app_data_dir.join("clipboard.db");
        let conn = Connection::open(&db_path)?;

        // Enable WAL mode for better concurrency
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "synchronous", "NORMAL")?;
        conn.busy_timeout(Duration::from_millis(5000))?;

        let db = Database {
            conn: Mutex::new(conn),
        };

        db.run_migrations()?;
        Ok(db)
    }

    fn run_migrations(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let user_version: i32 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;

        if user_version < 1 {
            // Run migration 001
            let migration_sql = include_str!("../migrations/001_init.sql");
            conn.execute_batch(migration_sql)?;
            conn.execute("PRAGMA user_version = 1", [])?;
            log::info!("Applied migration 001_init.sql");
        }

        Ok(())
    }

    /// Insert a clipboard item (handles deduplication via hash UNIQUE constraint)
    pub fn insert_item(
        &self,
        content: String,
        content_type: String,
        image_path: Option<String>,
        category: String,
        source_app: String,
        is_sensitive: bool,
        hash: String,
        preview: String,
        copied_at: i64,
    ) -> Result<i64> {
        let conn = self.conn.lock().unwrap();

        // Try to insert; if hash exists, return existing ID
        match conn.execute(
            "INSERT INTO clipboard_items (content, content_type, image_path, category, source_app, is_sensitive, hash, preview, copied_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![content, content_type, image_path, category, source_app, is_sensitive, hash, preview, copied_at],
        ) {
            Ok(_) => {
                let id = conn.last_insert_rowid();
                log::debug!("Inserted new clipboard item: id={}, category={}", id, category);

                // Check if we exceeded max_items
                self.cleanup_excess_items_inner(&conn)?;

                Ok(id)
            }
            Err(rusqlite::Error::SqliteFailure(err, _)) if err.code == rusqlite::ErrorCode::ConstraintViolation => {
                // Duplicate hash - find and return existing ID
                let existing_id: i64 = conn.query_row(
                    "SELECT id FROM clipboard_items WHERE hash = ?1",
                    params![hash],
                    |row| row.get(0),
                )?;
                log::debug!("Duplicate item detected (hash exists): id={}", existing_id);
                Ok(existing_id)
            }
            Err(e) => Err(e.into()),
        }
    }

    /// Get clipboard history with pagination
    pub fn get_history(&self, limit: u32, offset: u32) -> Result<Vec<ClipboardItem>> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT id, content, content_type, image_path, category, source_app, preview, copied_at, is_favorite, is_sensitive, hash
             FROM clipboard_items
             WHERE is_sensitive = 0
             ORDER BY is_favorite DESC, copied_at DESC
             LIMIT ?1 OFFSET ?2"
        )?;

        let items = stmt.query_map(params![limit, offset], |row| {
            Ok(ClipboardItem {
                id: row.get(0)?,
                content: row.get(1)?,
                content_type: row.get(2)?,
                image_path: row.get(3)?,
                category: row.get(4)?,
                source_app: row.get(5)?,
                preview: row.get(6)?,
                copied_at: row.get(7)?,
                is_favorite: row.get::<_, i32>(8)? != 0,
                is_sensitive: row.get::<_, i32>(9)? != 0,
                hash: row.get(10)?,
            })
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;

        Ok(items)
    }

    /// Search clipboard items with FTS5
    pub fn search(&self, query: String, filters: SearchFilters, limit: u32) -> Result<Vec<ClipboardItem>> {
        let conn = self.conn.lock().unwrap();

        // Build FTS5 query with filters
        let mut sql = String::from(
            "SELECT ci.id, ci.content, ci.content_type, ci.image_path, ci.category, ci.source_app, ci.preview, ci.copied_at, ci.is_favorite, ci.is_sensitive, ci.hash
             FROM clipboard_items ci
             JOIN clipboard_fts fts ON ci.id = fts.rowid
             WHERE clipboard_fts MATCH ?1 AND ci.is_sensitive = 0"
        );

        let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(query)];

        if let Some(category) = filters.category {
            sql.push_str(" AND ci.category = ?");
            params.push(Box::new(category));
        }

        if let Some(source_app) = filters.source_app {
            sql.push_str(" AND ci.source_app = ?");
            params.push(Box::new(source_app));
        }

        if let Some(content_type) = filters.content_type {
            sql.push_str(" AND ci.content_type = ?");
            params.push(Box::new(content_type));
        }

        if let Some(date_from) = filters.date_from {
            sql.push_str(" AND ci.copied_at >= ?");
            params.push(Box::new(date_from));
        }

        if let Some(date_to) = filters.date_to {
            sql.push_str(" AND ci.copied_at <= ?");
            params.push(Box::new(date_to));
        }

        sql.push_str(" ORDER BY ci.copied_at DESC LIMIT ?");
        params.push(Box::new(limit));

        let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

        let mut stmt = conn.prepare(&sql)?;
        let items = stmt.query_map(params_refs.as_slice(), |row| {
            Ok(ClipboardItem {
                id: row.get(0)?,
                content: row.get(1)?,
                content_type: row.get(2)?,
                image_path: row.get(3)?,
                category: row.get(4)?,
                source_app: row.get(5)?,
                preview: row.get(6)?,
                copied_at: row.get(7)?,
                is_favorite: row.get::<_, i32>(8)? != 0,
                is_sensitive: row.get::<_, i32>(9)? != 0,
                hash: row.get(10)?,
            })
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;

        Ok(items)
    }

    /// Get item content by ID (for copying to clipboard)
    pub fn get_item_content(&self, id: i64) -> Result<String> {
        let conn = self.conn.lock().unwrap();

        conn.query_row(
            "SELECT content FROM clipboard_items WHERE id = ?1",
            params![id],
            |row| row.get(0),
        ).map_err(|_| AppError::NotFound(id))
    }

    /// Get a single item by ID
    pub fn get_item_by_id(&self, id: i64) -> Result<ClipboardItem> {
        let conn = self.conn.lock().unwrap();

        conn.query_row(
            "SELECT id, content, content_type, image_path, category, source_app, preview, copied_at, is_favorite, is_sensitive, hash
             FROM clipboard_items WHERE id = ?1",
            params![id],
            |row| {
                Ok(ClipboardItem {
                    id: row.get(0)?,
                    content: row.get(1)?,
                    content_type: row.get(2)?,
                    image_path: row.get(3)?,
                    category: row.get(4)?,
                    source_app: row.get(5)?,
                    preview: row.get(6)?,
                    copied_at: row.get(7)?,
                    is_favorite: row.get::<_, i32>(8)? != 0,
                    is_sensitive: row.get::<_, i32>(9)? != 0,
                    hash: row.get(10)?,
                })
            },
        ).map_err(|_| AppError::NotFound(id))
    }

    /// Check if an image path exists in the database.
    pub fn image_path_exists(&self, image_path: &str) -> Result<bool> {
        let conn = self.conn.lock().unwrap();

        let exists: i64 = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM clipboard_items WHERE image_path = ?1 LIMIT 1)",
            params![image_path],
            |row| row.get(0),
        )?;

        Ok(exists != 0)
    }

    /// Set favorite status
    pub fn set_favorite(&self, id: i64, is_favorite: bool) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        let rows = conn.execute(
            "UPDATE clipboard_items SET is_favorite = ?1 WHERE id = ?2",
            params![is_favorite as i32, id],
        )?;

        if rows == 0 {
            return Err(AppError::NotFound(id));
        }

        Ok(())
    }

    /// Delete item by ID
    pub fn delete_item(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        let rows = conn.execute("DELETE FROM clipboard_items WHERE id = ?1", params![id])?;

        if rows == 0 {
            return Err(AppError::NotFound(id));
        }

        Ok(())
    }

    /// Cleanup items older than retention period
    pub fn cleanup_expired(&self, retention_days: u32) -> Result<u64> {
        let conn = self.conn.lock().unwrap();

        // Prevent overflow: cap retention days at 10 years
        let safe_retention_days = std::cmp::min(retention_days, 3650);
        let threshold = chrono::Utc::now().timestamp()
            .saturating_sub(safe_retention_days as i64 * 86400);

        // Get image paths before deleting for cleanup
        let mut stmt = conn.prepare(
            "SELECT image_path FROM clipboard_items
             WHERE copied_at < ?1 AND is_favorite = 0 AND content_type = 'image' AND image_path IS NOT NULL"
        )?;
        let image_paths: Vec<String> = stmt.query_map(params![threshold], |row| row.get(0))?
            .collect::<std::result::Result<Vec<_>, _>>()?;

        // Delete items from database
        let deleted = conn.execute(
            "DELETE FROM clipboard_items WHERE copied_at < ?1 AND is_favorite = 0",
            params![threshold],
        )?;

        // Clean up image files
        for path in image_paths {
            if let Err(e) = std::fs::remove_file(&path) {
                log::warn!("Failed to delete expired image file {}: {}", path, e);
            }
        }

        if deleted > 0 {
            log::info!("Cleaned up {} expired clipboard items", deleted);
        }

        Ok(deleted as u64)
    }

    /// Cleanup excess items beyond max_items setting
    fn cleanup_excess_items_inner(&self, conn: &Connection) -> Result<()> {
        // Get max_items setting
        let max_items: u32 = conn.query_row(
            "SELECT value FROM settings WHERE key = 'max_items'",
            [],
            |row| {
                let val: String = row.get(0)?;
                Ok(val.parse::<u32>().unwrap_or(1000))
            },
        )?;

        // Count current items
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM clipboard_items", [], |row| row.get(0))?;

        if count > max_items as i64 {
            let to_delete = count - max_items as i64;

            // Gather image paths for the same candidate set before deletion.
            let mut stmt = conn.prepare(
                "SELECT image_path FROM clipboard_items
                 WHERE is_favorite = 0
                 ORDER BY copied_at ASC
                 LIMIT ?1"
            )?;
            let image_paths: Vec<String> = stmt
                .query_map(params![to_delete], |row| row.get::<_, Option<String>>(0))?
                .collect::<std::result::Result<Vec<_>, _>>()?
                .into_iter()
                .flatten()
                .collect();

            let deleted = conn.execute(
                "DELETE FROM clipboard_items WHERE id IN (
                    SELECT id FROM clipboard_items
                    WHERE is_favorite = 0
                    ORDER BY copied_at ASC
                    LIMIT ?1
                )",
                params![to_delete],
            )?;

            for path in image_paths {
                if let Err(e) = std::fs::remove_file(&path) {
                    log::warn!("Failed to delete excess image file {}: {}", path, e);
                }
            }

            if deleted == 0 {
                log::warn!(
                    "max_items exceeded but no non-favorite items were eligible for deletion"
                );
            } else {
                log::info!(
                    "Deleted {} oldest items to maintain max_items limit",
                    deleted
                );
            }
        }

        Ok(())
    }

    /// Get settings
    pub fn get_settings(&self) -> Result<Settings> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;

        let mut settings = Settings::default();

        for row in rows {
            let (key, value) = row?;
            match key.as_str() {
                "retention_days" => settings.retention_days = value.parse().unwrap_or(30),
                "max_items" => settings.max_items = value.parse().unwrap_or(1000),
                "keyboard_shortcut" => settings.keyboard_shortcut = value,
                "auto_exclude_sensitive" => settings.auto_exclude_sensitive = value == "true",
                "max_image_size_mb" => settings.max_image_size_mb = value.parse().unwrap_or(5),
                _ => {}
            }
        }

        Ok(settings)
    }

    /// Update settings
    pub fn update_settings(&self, settings: Settings) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('retention_days', ?1)", params![settings.retention_days.to_string()])?;
        conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('max_items', ?1)", params![settings.max_items.to_string()])?;
        conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('keyboard_shortcut', ?1)", params![settings.keyboard_shortcut])?;
        conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_exclude_sensitive', ?1)", params![settings.auto_exclude_sensitive.to_string()])?;
        conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('max_image_size_mb', ?1)", params![settings.max_image_size_mb.to_string()])?;

        log::info!("Settings updated");
        Ok(())
    }

    /// Get app exclusions
    pub fn get_exclusions(&self) -> Result<Vec<String>> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare("SELECT app_name FROM app_exclusions ORDER BY app_name")?;
        let apps = stmt.query_map([], |row| row.get(0))?
            .collect::<std::result::Result<Vec<String>, _>>()?;

        Ok(apps)
    }

    /// Add app to exclusion list
    pub fn add_exclusion(&self, app_name: String) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "INSERT OR IGNORE INTO app_exclusions (app_name) VALUES (?1)",
            params![app_name],
        )?;

        log::info!("Added app to exclusion list: {}", app_name);
        Ok(())
    }

    /// Remove app from exclusion list
    pub fn remove_exclusion(&self, app_name: String) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute("DELETE FROM app_exclusions WHERE app_name = ?1", params![app_name])?;

        log::info!("Removed app from exclusion list: {}", app_name);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::Database;
    use crate::models::Settings;

    #[test]
    fn test_image_path_exists_uses_exact_db_membership() {
        let temp_dir = tempfile::tempdir().expect("tempdir");
        let db = Database::new(temp_dir.path()).expect("db init");

        let image_path = temp_dir.path().join("exists.png");
        std::fs::write(&image_path, [1_u8, 2, 3, 4]).expect("write image");
        let image_path_str = image_path.to_string_lossy().to_string();

        db.insert_item(
            "Image".to_string(),
            "image".to_string(),
            Some(image_path_str.clone()),
            "misc".to_string(),
            "Tests".to_string(),
            false,
            "hash_exists_001".to_string(),
            "Image".to_string(),
            1,
        )
        .expect("insert");

        assert!(db.image_path_exists(&image_path_str).expect("exists query"));
        assert!(!db
            .image_path_exists("/tmp/does-not-exist.png")
            .expect("exists query"));
    }

    #[test]
    fn test_cleanup_excess_items_removes_image_files() {
        let temp_dir = tempfile::tempdir().expect("tempdir");
        let db = Database::new(temp_dir.path()).expect("db init");

        db.update_settings(Settings {
            max_items: 2,
            ..Settings::default()
        })
        .expect("update settings");

        let old_image = temp_dir.path().join("old.png");
        let new_image = temp_dir.path().join("new.png");
        std::fs::write(&old_image, [0_u8; 8]).expect("write old image");
        std::fs::write(&new_image, [1_u8; 8]).expect("write new image");

        db.insert_item(
            "Old Image".to_string(),
            "image".to_string(),
            Some(old_image.to_string_lossy().to_string()),
            "misc".to_string(),
            "Tests".to_string(),
            false,
            "hash_old_image_001".to_string(),
            "Old Image".to_string(),
            1,
        )
        .expect("insert old image");

        db.insert_item(
            "New Image".to_string(),
            "image".to_string(),
            Some(new_image.to_string_lossy().to_string()),
            "misc".to_string(),
            "Tests".to_string(),
            false,
            "hash_new_image_001".to_string(),
            "New Image".to_string(),
            2,
        )
        .expect("insert new image");

        db.insert_item(
            "Newest Text".to_string(),
            "text".to_string(),
            None,
            "misc".to_string(),
            "Tests".to_string(),
            false,
            "hash_newest_text_001".to_string(),
            "Newest Text".to_string(),
            3,
        )
        .expect("insert newest text");

        let history = db.get_history(10, 0).expect("get history");
        assert_eq!(history.len(), 2);
        assert!(!old_image.exists(), "old image should be deleted with excess row");
        assert!(new_image.exists(), "new image should remain on disk");
    }
}
