-- SmartClipboard schema initialization
-- Uses INTEGER PRIMARY KEY for FTS5 compatibility

CREATE TABLE IF NOT EXISTS clipboard_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    content_type TEXT NOT NULL CHECK(content_type IN ('text', 'image')),
    image_path TEXT,                          -- file path for images, NULL for text
    category TEXT NOT NULL DEFAULT 'misc'
        CHECK(category IN ('url','email','error','code','command','ip','path','misc')),
    source_app TEXT DEFAULT 'Unknown',
    preview TEXT NOT NULL,                    -- first 80 chars (or image dimensions)
    copied_at INTEGER NOT NULL,              -- unix timestamp (seconds)
    is_favorite INTEGER NOT NULL DEFAULT 0,
    is_sensitive INTEGER NOT NULL DEFAULT 0,
    hash TEXT UNIQUE NOT NULL                -- SHA256 for dedup
);

CREATE INDEX IF NOT EXISTS idx_copied_at ON clipboard_items(copied_at DESC);
CREATE INDEX IF NOT EXISTS idx_category ON clipboard_items(category);
CREATE INDEX IF NOT EXISTS idx_hash ON clipboard_items(hash);
CREATE INDEX IF NOT EXISTS idx_favorite ON clipboard_items(is_favorite) WHERE is_favorite = 1;
CREATE INDEX IF NOT EXISTS idx_content_type ON clipboard_items(content_type);
CREATE INDEX IF NOT EXISTS idx_source_app ON clipboard_items(source_app);

-- FTS5 content-sync table (external content mode)
CREATE VIRTUAL TABLE IF NOT EXISTS clipboard_fts USING fts5(
    content,
    category,
    source_app,
    content='clipboard_items',
    content_rowid='id'
);

-- Keep FTS in sync via triggers
CREATE TRIGGER IF NOT EXISTS fts_insert AFTER INSERT ON clipboard_items BEGIN
    INSERT INTO clipboard_fts(rowid, content, category, source_app)
    VALUES (NEW.id, NEW.content, NEW.category, NEW.source_app);
END;

CREATE TRIGGER IF NOT EXISTS fts_delete AFTER DELETE ON clipboard_items BEGIN
    INSERT INTO clipboard_fts(clipboard_fts, rowid, content, category, source_app)
    VALUES ('delete', OLD.id, OLD.content, OLD.category, OLD.source_app);
END;

CREATE TRIGGER IF NOT EXISTS fts_update AFTER UPDATE ON clipboard_items BEGIN
    INSERT INTO clipboard_fts(clipboard_fts, rowid, content, category, source_app)
    VALUES ('delete', OLD.id, OLD.content, OLD.category, OLD.source_app);
    INSERT INTO clipboard_fts(rowid, content, category, source_app)
    VALUES (NEW.id, NEW.content, NEW.category, NEW.source_app);
END;

-- App exclusion list
CREATE TABLE IF NOT EXISTS app_exclusions (
    app_name TEXT PRIMARY KEY,
    added_at INTEGER NOT NULL DEFAULT 0
);

-- Settings (key-value store)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Default settings
INSERT INTO settings (key, value) VALUES ('retention_days', '30');
INSERT INTO settings (key, value) VALUES ('max_items', '1000');
INSERT INTO settings (key, value) VALUES ('keyboard_shortcut', 'CmdOrCtrl+Shift+V');
INSERT INTO settings (key, value) VALUES ('auto_exclude_sensitive', 'true');
INSERT INTO settings (key, value) VALUES ('max_image_size_mb', '5');
