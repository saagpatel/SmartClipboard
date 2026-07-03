#[cfg(target_os = "macos")]
pub mod macos;

#[cfg(target_os = "macos")]
pub use macos::get_frontmost_app;

#[cfg(not(target_os = "macos"))]
pub fn get_frontmost_app() -> String {
    "Unknown".to_string()
}
