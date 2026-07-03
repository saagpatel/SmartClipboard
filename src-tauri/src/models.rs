use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardItem {
    pub id: i64,
    pub content: String,
    pub content_type: String,      // "text" | "image"
    pub image_path: Option<String>,
    pub category: String,
    pub source_app: String,
    pub preview: String,
    pub copied_at: i64,
    pub is_favorite: bool,
    pub is_sensitive: bool,
    pub hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchFilters {
    pub category: Option<String>,
    pub date_from: Option<i64>,     // unix timestamp
    pub date_to: Option<i64>,
    pub source_app: Option<String>,
    pub content_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub retention_days: u32,
    pub max_items: u32,
    pub keyboard_shortcut: String,
    pub auto_exclude_sensitive: bool,
    pub max_image_size_mb: u32,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            retention_days: 30,
            max_items: 1000,
            keyboard_shortcut: "CmdOrCtrl+Shift+V".to_string(),
            auto_exclude_sensitive: true,
            max_image_size_mb: 5,
        }
    }
}
