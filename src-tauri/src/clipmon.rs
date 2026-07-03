use crate::categorizer::detect_category;
use crate::platform::get_frontmost_app;
use crate::sensitive::is_sensitive;
use arboard::Clipboard;
use image::DynamicImage;
use sha2::{Digest, Sha256};
use std::path::Path;
use std::sync::mpsc::{Sender, channel};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

const IMAGE_HASH_PREFIX_LEN: usize = 12;

fn build_image_filename(timestamp_nanos: i64, hash: &str) -> String {
    let hash_prefix_len = std::cmp::min(IMAGE_HASH_PREFIX_LEN, hash.len());
    let hash_prefix = &hash[..hash_prefix_len];
    format!("{}_{}.png", timestamp_nanos, hash_prefix)
}

fn encode_rgba_to_png(bytes: &[u8], width: usize, height: usize) -> Option<Vec<u8>> {
    let width_u32 = u32::try_from(width).ok()?;
    let height_u32 = u32::try_from(height).ok()?;
    let expected_len = width.checked_mul(height)?.checked_mul(4)?;

    if bytes.len() != expected_len {
        return None;
    }

    let image = image::RgbaImage::from_raw(width_u32, height_u32, bytes.to_vec())?;
    let mut png_bytes = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut png_bytes);

    DynamicImage::ImageRgba8(image)
        .write_to(&mut cursor, image::ImageFormat::Png)
        .ok()?;

    Some(png_bytes)
}

#[derive(Debug, Clone)]
pub struct NewClipboardItem {
    pub content: String,
    pub content_type: String,
    pub image_path: Option<String>,
    pub category: String,
    pub source_app: String,
    pub is_sensitive: bool,
    pub hash: String,
    pub preview: String,
    pub copied_at: i64,
}

#[derive(Clone)]
pub struct ClipboardMonitor {
    last_hash: Arc<Mutex<Option<String>>>,
    last_copied_hash: Arc<Mutex<Option<String>>>, // For preventing re-capture loop
    sender: Arc<Mutex<Option<Sender<NewClipboardItem>>>>, // Wrapped for Clone
    auto_exclude_sensitive: Arc<Mutex<bool>>,
    exclusions: Arc<Mutex<Vec<String>>>,
    max_image_size_mb: Arc<Mutex<u32>>,
    images_dir: Arc<std::path::PathBuf>,
}

impl ClipboardMonitor {
    pub fn new(app_data_dir: &Path) -> (Self, std::sync::mpsc::Receiver<NewClipboardItem>) {
        let (sender, receiver) = channel();
        let images_dir = app_data_dir.join("images");

        // Create images directory
        std::fs::create_dir_all(&images_dir).expect("Failed to create images directory");

        (
            ClipboardMonitor {
                last_hash: Arc::new(Mutex::new(None)),
                last_copied_hash: Arc::new(Mutex::new(None)),
                sender: Arc::new(Mutex::new(Some(sender))),
                auto_exclude_sensitive: Arc::new(Mutex::new(true)),
                exclusions: Arc::new(Mutex::new(Vec::new())),
                max_image_size_mb: Arc::new(Mutex::new(5)),
                images_dir: Arc::new(images_dir),
            },
            receiver,
        )
    }

    /// Update the last copied hash to prevent re-capture
    pub fn set_last_copied_hash(&self, hash: String) {
        *self.last_copied_hash.lock().unwrap() = Some(hash);
    }

    /// Update auto exclude sensitive setting
    pub fn set_auto_exclude_sensitive(&self, enabled: bool) {
        *self.auto_exclude_sensitive.lock().unwrap() = enabled;
    }

    /// Update exclusion list
    pub fn set_exclusions(&self, exclusions: Vec<String>) {
        *self.exclusions.lock().unwrap() = exclusions;
    }

    /// Update max image size
    pub fn set_max_image_size_mb(&self, size_mb: u32) {
        *self.max_image_size_mb.lock().unwrap() = size_mb;
    }

    /// Get the canonical image storage directory used by the monitor.
    pub fn images_dir(&self) -> std::path::PathBuf {
        self.images_dir.as_ref().clone()
    }

    /// Start monitoring clipboard in background thread
    pub fn start(&self) {
        let monitor_clone = self.clone();

        thread::spawn(move || {
            let mut clipboard = Clipboard::new().expect("Failed to create clipboard instance");

            log::info!("Clipboard monitor started");

            loop {
                thread::sleep(Duration::from_millis(500));

                // Try to read text content
                if let Ok(text) = clipboard.get_text() {
                    let hash = monitor_clone.compute_hash(&text);

                    // Check if this is new content
                    let last_hash = monitor_clone.last_hash.lock().unwrap().clone();
                    let last_copied = monitor_clone.last_copied_hash.lock().unwrap().clone();

                    // Skip if same as last seen OR same as what we just copied to clipboard
                    if Some(&hash) == last_hash.as_ref() || Some(&hash) == last_copied.as_ref() {
                        continue;
                    }

                    // Update last hash
                    *monitor_clone.last_hash.lock().unwrap() = Some(hash.clone());

                    // Get source app
                    let source_app = get_frontmost_app();

                    // Check if app is excluded
                    if monitor_clone.exclusions.lock().unwrap().contains(&source_app) {
                        log::debug!("Skipping clipboard item from excluded app: {}", source_app);
                        continue;
                    }

                    // Check for sensitive data
                    let is_sens = is_sensitive(&text);
                    if is_sens && *monitor_clone.auto_exclude_sensitive.lock().unwrap() {
                        log::warn!("Skipping sensitive clipboard content");
                        continue;
                    }

                    // Categorize
                    let category = detect_category(&text);

                    // Generate preview (first 80 chars, UTF-8 safe)
                    let preview = if text.chars().count() > 80 {
                        let preview_text: String = text.chars().take(80).collect();
                        format!("{}...", preview_text)
                    } else {
                        text.clone()
                    };

                    let item = NewClipboardItem {
                        content: text,
                        content_type: "text".to_string(),
                        image_path: None,
                        category,
                        source_app,
                        is_sensitive: is_sens,
                        hash,
                        preview,
                        copied_at: chrono::Utc::now().timestamp(),
                    };

                    // Send item through the channel
                    if let Some(sender) = monitor_clone.sender.lock().unwrap().as_ref() {
                        if sender.send(item).is_err() {
                            log::error!("Failed to send clipboard item to main thread");
                            break;
                        }
                    }
                }

                // Handle image clipboard content
                if let Ok(image_data) = clipboard.get_image() {
                    let hash = {
                        let mut hasher = Sha256::new();
                        hasher.update(&image_data.bytes);
                        hex::encode(hasher.finalize())
                    };

                    // Check if this is new content
                    let last_hash = monitor_clone.last_hash.lock().unwrap().clone();
                    let last_copied = monitor_clone.last_copied_hash.lock().unwrap().clone();

                    if Some(&hash) == last_hash.as_ref() || Some(&hash) == last_copied.as_ref() {
                        continue;
                    }

                    // Check image size against limit
                    let image_size_mb = image_data.bytes.len() as f64 / (1024.0 * 1024.0);
                    let max_size_mb = *monitor_clone.max_image_size_mb.lock().unwrap();

                    if image_size_mb > max_size_mb as f64 {
                        log::warn!(
                            "Skipping image (size: {:.2}MB exceeds limit: {}MB)",
                            image_size_mb, max_size_mb
                        );
                        continue;
                    }

                    // Update last hash
                    *monitor_clone.last_hash.lock().unwrap() = Some(hash.clone());

                    // Get source app
                    let source_app = get_frontmost_app();

                    // Check if app is excluded
                    if monitor_clone.exclusions.lock().unwrap().contains(&source_app) {
                        log::debug!("Skipping clipboard image from excluded app: {}", source_app);
                        continue;
                    }

                    // Save image to disk
                    let timestamp_nanos = chrono::Utc::now()
                        .timestamp_nanos_opt()
                        .unwrap_or_else(|| chrono::Utc::now().timestamp_micros() * 1000);
                    let filename = build_image_filename(timestamp_nanos, &hash);
                    let image_path = monitor_clone.images_dir.join(&filename);

                    let png_bytes = match encode_rgba_to_png(
                        &image_data.bytes,
                        image_data.width,
                        image_data.height,
                    ) {
                        Some(bytes) => bytes,
                        None => {
                            log::warn!(
                                "Skipping image with invalid dimensions/bytes: {}x{}, {} bytes",
                                image_data.width,
                                image_data.height,
                                image_data.bytes.len()
                            );
                            continue;
                        }
                    };

                    if let Err(e) = std::fs::write(&image_path, &png_bytes) {
                        log::error!("Failed to save image PNG: {}", e);
                        continue;
                    }

                    let stored_path = image_path
                        .canonicalize()
                        .unwrap_or(image_path.clone())
                        .to_string_lossy()
                        .to_string();

                    // Generate preview text with dimensions
                    // Note: arboard may not provide dimensions for all formats
                    let width = image_data.width;
                    let height = image_data.height;
                    let preview = if width > 0 && height > 0 {
                        format!("Image {}×{}", width, height)
                    } else {
                        "Image".to_string()
                    };

                    let item = NewClipboardItem {
                        content: preview.clone(), // Store dimensions as content
                        content_type: "image".to_string(),
                        image_path: Some(stored_path),
                        category: "misc".to_string(), // Images don't get categorized
                        source_app,
                        is_sensitive: false,
                        hash,
                        preview,
                        copied_at: chrono::Utc::now().timestamp(),
                    };

                    if let Some(sender) = monitor_clone.sender.lock().unwrap().as_ref() {
                        if sender.send(item).is_err() {
                            log::error!("Failed to send clipboard image to main thread");
                            break;
                        }
                    }
                }
            }

            log::warn!("Clipboard monitor stopped");
        });
    }

    fn compute_hash(&self, content: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(content.as_bytes());
        hex::encode(hasher.finalize())
    }
}

#[cfg(test)]
mod tests {
    use super::{build_image_filename, encode_rgba_to_png};

    #[test]
    fn test_build_image_filename_uses_hash_prefix() {
        let filename = build_image_filename(1_700_000_000_000_000_000, "abcdef1234567890");
        assert_eq!(filename, "1700000000000000000_abcdef123456.png");
    }

    #[test]
    fn test_encode_rgba_to_png_roundtrip_dimensions() {
        let rgba = vec![
            255, 0, 0, 255, // red pixel
            0, 255, 0, 255, // green pixel
            0, 0, 255, 255, // blue pixel
            255, 255, 255, 255, // white pixel
        ];

        let png = encode_rgba_to_png(&rgba, 2, 2).expect("expected valid PNG bytes");
        let decoded = image::load_from_memory(&png).expect("expected decodable PNG");
        let decoded_rgba = decoded.to_rgba8();

        assert_eq!(decoded_rgba.width(), 2);
        assert_eq!(decoded_rgba.height(), 2);
        assert_eq!(decoded_rgba.into_raw(), rgba);
    }

    #[test]
    fn test_encode_rgba_to_png_rejects_invalid_length() {
        let invalid = vec![0_u8; 3];
        assert!(encode_rgba_to_png(&invalid, 1, 1).is_none());
    }
}
