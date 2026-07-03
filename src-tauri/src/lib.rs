pub mod categorizer;
pub mod clipmon;
pub mod db;
pub mod error;
pub mod handlers;
pub mod models;
pub mod platform;
pub mod sensitive;

use handlers::{
    add_exclusion, copy_to_clipboard, delete_item, get_exclusions, get_history,
    get_image_data, get_settings, remove_exclusion, search, set_favorite,
    update_settings, AppState,
};
use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_global_shortcut::GlobalShortcutExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            use tauri_plugin_global_shortcut::ShortcutState;

            // Get app data directory
            let app_data_dir = app.path().app_data_dir()?;

            // Initialize database
            let db = Arc::new(db::Database::new(&app_data_dir)?);

            // Run initial cleanup on startup
            if let Ok(settings) = db.get_settings() {
                if let Err(e) = db.cleanup_expired(settings.retention_days) {
                    log::error!("Failed to cleanup expired items on startup: {}", e);
                }
            }

            // Initialize clipboard monitor
            let (monitor, receiver) = clipmon::ClipboardMonitor::new(&app_data_dir);
            let monitor = Arc::new(monitor);

            // Load initial settings and exclusions
            if let Ok(settings) = db.get_settings() {
                monitor.set_auto_exclude_sensitive(settings.auto_exclude_sensitive);
                monitor.set_max_image_size_mb(settings.max_image_size_mb);
            }

            if let Ok(exclusions) = db.get_exclusions() {
                monitor.set_exclusions(exclusions);
            }

            // Start clipboard monitor
            monitor.start();

            // Handle clipboard items from monitor in background
            let db_clone = db.clone();
            std::thread::spawn(move || {
                for item in receiver {
                    if let Err(e) = db_clone.insert_item(
                        item.content,
                        item.content_type,
                        item.image_path,
                        item.category,
                        item.source_app,
                        item.is_sensitive,
                        item.hash,
                        item.preview,
                        item.copied_at,
                    ) {
                        log::error!("Failed to insert clipboard item: {}", e);
                    }
                }
            });

            // Start background cleanup task (hourly)
            let db_clone = db.clone();
            tokio::spawn(async move {
                let mut interval = tokio::time::interval(std::time::Duration::from_secs(3600));
                loop {
                    interval.tick().await;
                    if let Ok(settings) = db_clone.get_settings() {
                        if let Err(e) = db_clone.cleanup_expired(settings.retention_days) {
                            log::error!("Failed to cleanup expired items: {}", e);
                        }
                    }
                }
            });

            // Set up tray icon with click handler
            let tray = app.tray_by_id("main-tray").expect("Tray icon not found");
            let window = app.get_webview_window("main").expect("Window not found");
            let window_clone = window.clone();

            tray.on_tray_icon_event(move |_tray, event| {
                if let tauri::tray::TrayIconEvent::Click { .. } = event {
                    if window_clone.is_visible().unwrap_or(false) {
                        let _ = window_clone.hide();
                    } else {
                        // Position window near tray icon (top-right corner as fallback)
                        if let Ok(screen) = window_clone.current_monitor() {
                            if let Some(monitor) = screen {
                                let size = monitor.size();
                                // Position at top-right corner with some padding
                                let _ = window_clone.set_position(tauri::Position::Physical(
                                    tauri::PhysicalPosition {
                                        x: size.width as i32 - 420, // 400px width + 20px padding
                                        y: 40,
                                    }
                                ));
                            }
                        }
                        let _ = window_clone.show();
                        let _ = window_clone.set_focus();
                    }
                }
            });

            // Register global keyboard shortcut (Cmd+Shift+V)
            let window_for_shortcut = window.clone();

            app.global_shortcut().on_shortcut("CmdOrCtrl+Shift+V", move |_app, _shortcut, event| {
                if event.state() == ShortcutState::Pressed {
                    if window_for_shortcut.is_visible().unwrap_or(false) {
                        let _ = window_for_shortcut.hide();
                    } else {
                        // Position window near tray icon
                        if let Ok(screen) = window_for_shortcut.current_monitor() {
                            if let Some(monitor) = screen {
                                let size = monitor.size();
                                let _ = window_for_shortcut.set_position(tauri::Position::Physical(
                                    tauri::PhysicalPosition {
                                        x: size.width as i32 - 420,
                                        y: 40,
                                    }
                                ));
                            }
                        }
                        let _ = window_for_shortcut.show();
                        let _ = window_for_shortcut.set_focus();
                    }
                }
            })?;

            log::info!("SmartClipboard initialized successfully");

            // Store state
            app.manage(AppState { db, monitor });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_history,
            search,
            copy_to_clipboard,
            set_favorite,
            delete_item,
            get_settings,
            update_settings,
            get_exclusions,
            add_exclusion,
            remove_exclusion,
            get_image_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
