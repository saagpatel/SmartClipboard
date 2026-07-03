use crate::clipmon::ClipboardMonitor;
use crate::db::Database;
use crate::error::{AppError, Result};
use crate::models::{ClipboardItem, SearchFilters, Settings};
use arboard::Clipboard;
use std::borrow::Cow;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::State;

pub struct AppState {
    pub db: Arc<Database>,
    pub monitor: Arc<ClipboardMonitor>,
}

fn decode_png_for_clipboard(image_path: &str) -> Result<arboard::ImageData<'static>> {
    let image_bytes = std::fs::read(image_path)?;
    let decoded = image::load_from_memory(&image_bytes).map_err(|e| {
        AppError::InvalidInput(format!("Failed to decode stored image data: {}", e))
    })?;
    let rgba = decoded.to_rgba8();
    let (width, height) = rgba.dimensions();

    if width == 0 || height == 0 {
        return Err(AppError::InvalidInput(
            "Stored image has invalid dimensions".to_string(),
        ));
    }

    Ok(arboard::ImageData {
        width: width as usize,
        height: height as usize,
        bytes: Cow::Owned(rgba.into_raw()),
    })
}

fn canonicalize_requested_image_path(image_path: &str, images_dir: &Path) -> Result<PathBuf> {
    let canonical_path = Path::new(image_path)
        .canonicalize()
        .map_err(|_| AppError::InvalidInput("Image file not found".to_string()))?;
    let canonical_images_dir = images_dir.canonicalize()?;

    if !canonical_path.starts_with(&canonical_images_dir) {
        return Err(AppError::InvalidInput(
            "Invalid image path: outside images directory".to_string(),
        ));
    }

    Ok(canonical_path)
}

#[tauri::command]
pub async fn get_history(
    state: State<'_, AppState>,
    limit: u32,
    offset: u32,
) -> Result<Vec<ClipboardItem>> {
    state.db.get_history(limit, offset)
}

#[tauri::command]
pub async fn search(
    state: State<'_, AppState>,
    query: String,
    filters: SearchFilters,
    limit: u32,
) -> Result<Vec<ClipboardItem>> {
    state.db.search(query, filters, limit)
}

#[tauri::command]
pub async fn copy_to_clipboard(
    state: State<'_, AppState>,
    id: i64,
) -> Result<()> {
    // Get item by ID efficiently
    let item = state.db.get_item_by_id(id)?;

    // Set last copied hash to prevent re-capture
    state.monitor.set_last_copied_hash(item.hash.clone());

    // Copy to system clipboard
    let mut clipboard = Clipboard::new()
        .map_err(|e| crate::error::AppError::Clipboard(e.to_string()))?;

    if item.content_type == "image" {
        // Copy image from file
        if let Some(image_path) = &item.image_path {
            let img = decode_png_for_clipboard(image_path)?;
            clipboard.set_image(img)
                .map_err(|e| crate::error::AppError::Clipboard(e.to_string()))?;
            log::debug!("Copied image item {} to clipboard", id);
        } else {
            return Err(crate::error::AppError::InvalidInput("Image path not found".to_string()));
        }
    } else {
        // Copy text
        clipboard.set_text(item.content)
            .map_err(|e| crate::error::AppError::Clipboard(e.to_string()))?;
        log::debug!("Copied text item {} to clipboard", id);
    }

    Ok(())
}

#[tauri::command]
pub async fn set_favorite(
    state: State<'_, AppState>,
    id: i64,
    is_favorite: bool,
) -> Result<()> {
    state.db.set_favorite(id, is_favorite)
}

#[tauri::command]
pub async fn delete_item(
    state: State<'_, AppState>,
    id: i64,
) -> Result<()> {
    // Get item to check if it has an image file to clean up
    let item = state.db.get_item_by_id(id)?;

    // Delete from database first
    state.db.delete_item(id)?;

    // Clean up image file if it exists
    if item.content_type == "image" {
        if let Some(image_path) = &item.image_path {
            if let Err(e) = std::fs::remove_file(image_path) {
                log::warn!("Failed to delete image file {}: {}", image_path, e);
                // Don't fail the whole operation if file cleanup fails
            } else {
                log::debug!("Deleted image file: {}", image_path);
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn get_settings(
    state: State<'_, AppState>,
) -> Result<Settings> {
    state.db.get_settings()
}

#[tauri::command]
pub async fn update_settings(
    state: State<'_, AppState>,
    settings: Settings,
) -> Result<()> {
    // Validate settings
    if settings.max_items < 10 || settings.max_items > 100000 {
        return Err(crate::error::AppError::InvalidInput(
            "max_items must be between 10 and 100000".to_string()
        ));
    }

    if settings.retention_days < 1 {
        return Err(crate::error::AppError::InvalidInput(
            "retention_days must be at least 1".to_string()
        ));
    }

    if settings.max_image_size_mb < 1 || settings.max_image_size_mb > 100 {
        return Err(crate::error::AppError::InvalidInput(
            "max_image_size_mb must be between 1 and 100".to_string()
        ));
    }

    // Update database
    state.db.update_settings(settings.clone())?;

    // Update monitor settings
    state.monitor.set_auto_exclude_sensitive(settings.auto_exclude_sensitive);
    state.monitor.set_max_image_size_mb(settings.max_image_size_mb);

    Ok(())
}

#[tauri::command]
pub async fn get_exclusions(
    state: State<'_, AppState>,
) -> Result<Vec<String>> {
    state.db.get_exclusions()
}

#[tauri::command]
pub async fn add_exclusion(
    state: State<'_, AppState>,
    app_name: String,
) -> Result<()> {
    state.db.add_exclusion(app_name.clone())?;

    // Update monitor exclusion list
    let exclusions = state.db.get_exclusions()?;
    state.monitor.set_exclusions(exclusions);

    Ok(())
}

#[tauri::command]
pub async fn remove_exclusion(
    state: State<'_, AppState>,
    app_name: String,
) -> Result<()> {
    state.db.remove_exclusion(app_name)?;

    // Update monitor exclusion list
    let exclusions = state.db.get_exclusions()?;
    state.monitor.set_exclusions(exclusions);

    Ok(())
}

#[tauri::command]
pub async fn get_image_data(
    state: State<'_, AppState>,
    image_path: String,
) -> Result<Vec<u8>> {
    let images_dir = state.monitor.images_dir();
    let canonical_path = canonicalize_requested_image_path(&image_path, &images_dir)?;
    let canonical_path_str = canonical_path.to_string_lossy().to_string();

    // Security: Verify file path is present in DB (supports legacy rows with non-canonical paths).
    let is_valid = state.db.image_path_exists(&canonical_path_str)?
        || state.db.image_path_exists(&image_path)?;

    if !is_valid {
        return Err(AppError::InvalidInput(
            "Image path not found in database".to_string()
        ));
    }

    let bytes = std::fs::read(canonical_path)?;
    Ok(bytes)
}
