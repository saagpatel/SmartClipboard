# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.1.0] - 2024-01-01

### Added

- Persistent clipboard history — text and images captured automatically and stored locally in SQLite with FTS5
- Smart categorization — automatically tags items as URL, email, error, code, command, IP address, file path, or misc
- Sensitive-content detection — detects and excludes passwords, tokens, and secrets with configurable auto-exclusion rules
- SHA256 deduplication — identical items are deduplicated rather than stored twice
- App-level exclusions — block specific apps from being captured (e.g., password managers)
- Image support — captures images with preview and validated PNG storage
- Favorites — pin frequently used items for instant access
- Retention controls — configurable history size and auto-cleanup
- Global shortcut (`Cmd+Shift+V`) — opens the manager from any app without a dock icon
- Security: explicit CSP, path-bounded filesystem reads, and database-authorized image access
