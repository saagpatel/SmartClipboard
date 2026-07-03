use objc2_app_kit::NSWorkspace;

pub fn get_frontmost_app() -> String {
    let workspace = NSWorkspace::sharedWorkspace();
    if let Some(app) = workspace.frontmostApplication() {
        if let Some(name) = app.localizedName() {
            return name.to_string();
        }
    }

    "Unknown".to_string()
}
