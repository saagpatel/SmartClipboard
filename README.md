# SmartClipboard

[![Rust](https://img.shields.io/badge/Rust-dea584?style=flat-square&logo=rust)](#) [![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript)](#) [![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](#)

> Every URL, snippet, error message, and command you copy is one keystroke away — categorized, searchable, and private.

SmartClipboard is a macOS menu bar app built with Tauri + React. It monitors the system clipboard continuously, stores history locally in SQLite with FTS5 full-text search, automatically categorizes items (URL, email, code, command, error, IP, path), filters out sensitive content like passwords and tokens, and surfaces everything via a global shortcut (`Cmd+Shift+V`).

## Features

- **Persistent clipboard history** — text and images captured automatically and stored locally
- **FTS5 full-text search** — instant search across all clipboard history
- **Smart categorization** — automatically tags items as URL, email, error, code, command, IP address, file path, or misc
- **Sensitive-content detection** — detects and excludes passwords, tokens, and secrets with configurable auto-exclusion rules
- **SHA256 deduplication** — identical items are deduplicated rather than stored twice
- **App-level exclusions** — block specific apps from being captured (e.g., password managers)
- **Image support** — captures images with preview and validated PNG storage
- **Favorites** — pin frequently used items for instant access
- **Retention controls** — configurable history size and auto-cleanup
- **Global shortcut** — `Cmd+Shift+V` opens the manager from any app

## Quick Start

### Prerequisites

- macOS 13+
- Node.js 20+
- Rust stable toolchain (`rustup`)
- Tauri system dependencies: [tauri.app/start/prerequisites](https://tauri.app/start/prerequisites/)

### Installation

```bash
git clone https://github.com/saagpatel/SmartClipboard
cd SmartClipboard
npm install
```

### Usage

```bash
# Start in development mode
npm run tauri dev

# Lean dev mode (lower disk usage)
npm run dev:lean
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop shell | Tauri 2 |
| Frontend | React, TypeScript, Tailwind CSS |
| Backend | Rust — clipboard monitoring, categorization, image handling |
| Storage | SQLite with FTS5 (local app data dir) |
| Security | SHA256 deduplication, CSP enforced, path-bounded image reads |

## Architecture

Clipboard monitoring runs in a Rust background loop. All content passes through a categorization pipeline before write — the sensitive-content detector runs first and can block the write entirely. Images are validated as PNG before storage and reads are path-bounded and database-authorized. The frontend uses the global shortcut plugin to open the manager window without requiring a dock icon.

## License

MIT
