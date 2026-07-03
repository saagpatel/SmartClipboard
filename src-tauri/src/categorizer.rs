use regex::Regex;
use std::sync::LazyLock;

// Pre-compiled regex patterns for performance
static URL_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"https?://\S+|www\.\S+").unwrap()
});

static EMAIL_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"[\w.+-]+@[\w-]+\.[\w.]+").unwrap()
});

static IP_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b").unwrap()
});

static ERROR_KEYWORDS: &[&str] = &[
    "error", "exception", "failed", "fatal", "panic", "traceback",
    "uncaught", "segfault", "abort", "crash"
];

static COMMAND_PREFIXES: &[&str] = &[
    "$", "#", "sudo", "ssh", "curl", "git", "npm", "docker",
    "kubectl", "cargo", "brew", "apt", "yum"
];

static CODE_KEYWORDS: &[&str] = &[
    "fn ", "def ", "class ", "import ", "const ", "let ", "var ",
    "function ", "async ", "await ", "return ", "if (", "for ("
];

pub fn detect_category(content: &str) -> String {
    // Priority order: URL > Email > IP > Path > Command > Error > Code > Misc

    // URL check
    if URL_REGEX.is_match(content) {
        return "url".to_string();
    }

    // Email check
    if EMAIL_REGEX.is_match(content) {
        return "email".to_string();
    }

    // IP address check
    if IP_REGEX.is_match(content) {
        return "ip".to_string();
    }

    // Path check (Unix and Windows paths)
    let trimmed = content.trim();
    if trimmed.starts_with('/') || trimmed.starts_with("~/") ||
       (trimmed.len() > 2 && trimmed.chars().nth(1) == Some(':') && trimmed.chars().nth(2) == Some('\\')) {
        return "path".to_string();
    }

    // Command check
    let first_word = content.split_whitespace().next().unwrap_or("");
    if COMMAND_PREFIXES.iter().any(|&prefix|
        content.trim_start().starts_with(prefix) || first_word == prefix.trim_start_matches('$').trim_start_matches('#')
    ) {
        return "command".to_string();
    }

    // Error check (case insensitive, check if >30% of lines contain error keywords)
    let lower_content = content.to_lowercase();
    let lines: Vec<&str> = lower_content.lines().collect();
    if !lines.is_empty() {
        let error_lines = lines.iter()
            .filter(|line| ERROR_KEYWORDS.iter().any(|&kw| line.contains(kw)))
            .count();
        let error_ratio = error_lines as f64 / lines.len() as f64;
        if error_ratio > 0.3 || (lines.len() == 1 && error_lines > 0) {
            return "error".to_string();
        }
    }

    // Code check (contains braces and keywords with indentation)
    if (content.contains('{') && content.contains('}')) ||
       CODE_KEYWORDS.iter().any(|&kw| content.contains(kw)) {
        return "code".to_string();
    }

    // Default fallback
    "misc".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_url_detection() {
        assert_eq!(detect_category("https://example.com"), "url");
        assert_eq!(detect_category("Check out http://google.com for info"), "url");
        assert_eq!(detect_category("www.github.com"), "url");
    }

    #[test]
    fn test_email_detection() {
        assert_eq!(detect_category("user@example.com"), "email");
        assert_eq!(detect_category("Contact: admin+test@company.co.uk"), "email");
    }

    #[test]
    fn test_error_detection() {
        assert_eq!(detect_category("Error: Connection timeout"), "error");
        assert_eq!(detect_category("Fatal exception occurred\nTraceback: ..."), "error");
        assert_eq!(detect_category("The word error in a URL: https://error.com"), "url"); // URL takes priority
    }

    #[test]
    fn test_command_detection() {
        assert_eq!(detect_category("$ ls -la"), "command");
        assert_eq!(detect_category("sudo apt install git"), "command");
        assert_eq!(detect_category("git commit -m 'test'"), "command");
    }

    #[test]
    fn test_code_detection() {
        assert_eq!(detect_category("function test() {\n  return true;\n}"), "code");
        assert_eq!(detect_category("const x = 10;"), "code");
        assert_eq!(detect_category("def calculate(a, b):"), "code");
    }

    #[test]
    fn test_path_detection() {
        assert_eq!(detect_category("/Users/admin/file.txt"), "path");
        assert_eq!(detect_category("~/Documents/notes"), "path");
        assert_eq!(detect_category("C:\\Windows\\System32"), "path");
    }

    #[test]
    fn test_ip_detection() {
        assert_eq!(detect_category("192.168.1.1"), "ip");
        assert_eq!(detect_category("Connect to 10.0.0.5 for access"), "ip");
    }

    #[test]
    fn test_misc_fallback() {
        assert_eq!(detect_category("Just some random text"), "misc");
        assert_eq!(detect_category("Meeting notes from today"), "misc");
    }
}
