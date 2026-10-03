# SmartClipboard

[![Rust](https://img.shields.io/badge/Rust-dea584?style=flat-square&logo=rust)](https://www.rust-lang.org) [![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org) [![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](./LICENSE) [![CI](https://github.com/saagpatel/SmartClipboard/actions/workflows/ci.yml/badge.svg)](https://github.com/saagpatel/SmartClipboard/actions/workflows/ci.yml)

> Every URL, snippet, error message, and command you copy is one keystroke away — categorized, searchable, and private.

SmartClipboard is a macOS menu bar app built with Tauri + React. It monitors the system clipboard continuously, stores history metadata and text locally in SQLite with FTS5 full-text search and images as local PNG files, automatically categorizes text items (URL, email, code, command, error, IP, path), filters out text matching credit-card, SSN, and phone-number patterns by default, and surfaces history via a global shortcut (`Cmd+Shift+V`).

## Features

- **Persistent clipboard history** — text and images captured automatically and stored locally
- **FTS5 full-text search** — searches non-sensitive items' text, image dimension labels, categories, and source apps
- **Smart categorization** — automatically tags text items as URL, email, error, code, command, IP address, file path, or misc; images are tagged misc
- **Sensitive-content detection** — detects credit-card, SSN, and phone-number patterns in text with a configurable auto-exclusion toggle
- **SHA256 deduplication** — identical items are deduplicated rather than stored twice
- **App-level exclusions** — block specific apps from being captured (e.g., password managers)
- **Image support** — captures images with preview and validated PNG storage
- **Favorites** — pin frequently used items for instant access
- **Retention controls** — configurable history size and auto-cleanup
- **Global shortcut** — `Cmd+Shift+V` opens the manager from any app

## Quick Start

### Prerequisites

- macOS 13+
- Node.js 22.22.1 or newer 22.x, or Node.js 24+ (see the locked tooling engines)
- pnpm 10.28.1, matching `package.json`'s `packageManager`
- Rust stable toolchain (`rustup`)
- Tauri system dependencies: [tauri.app/start/prerequisites](https://tauri.app/start/prerequisites/)

### Installation

```bash
git clone https://github.com/saagpatel/SmartClipboard
cd SmartClipboard
pnpm install --frozen-lockfile
```

The Git tree currently tracks both `.github/PULL_REQUEST_TEMPLATE.md` and
`.github/pull_request_template.md` with different contents. On a case-insensitive
filesystem they share one file and can appear modified immediately after checkout.
Use a case-sensitive checkout when you need a clean full working tree; preserve
this checkout artifact rather than staging it as part of unrelated work.

### Usage

Both commands below launch the desktop app, start reading the system clipboard,
and use the normal app-data database, including startup retention cleanup. Use a
separate macOS test account with synthetic clipboard content for manual testing.
Lean mode isolates build caches only; it does not isolate clipboard history.

```bash
# Start in development mode
pnpm tauri dev

# Lean dev mode (lower disk usage)
pnpm run dev:lean
```

## Verification

Run commands from the repository root. For fixture verification in an isolated
checkout, `pnpm install --frozen-lockfile --ignore-scripts` installs the locked
packages without running the Husky `prepare` hook. A normal developer install
runs that hook and configures Git hooks in the checkout.

```bash
# Focused frontend regression: mocked Tauri IPC/window and synthetic items
pnpm exec vitest run src/components/HistoryList.test.tsx

# Broader frontend tests, typecheck, and production assets (does not launch Tauri)
pnpm exec vitest run
pnpm exec tsc --noEmit
pnpm run build

# Format-check the files you changed; there is no standalone JS lint script
pnpm exec prettier --check README.md
```

Rust verification needs the Rust toolchain and Tauri native prerequisites above
(including Xcode Command Line Tools on macOS). The library tests use synthetic
strings/images and temporary databases; they do not call the app's `run()` or
start clipboard monitoring.

```bash
# Focused sensitive-content tests, then the broader library suite
cargo test --locked --manifest-path src-tauri/Cargo.toml --lib sensitive::tests
cargo test --locked --manifest-path src-tauri/Cargo.toml --lib

# Compile without launching the app; Rust formatting check
cargo build --locked --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
```

For dependency changes, `pnpm run audit:npm` runs `npm audit --json` against
`package-lock.json`, while pnpm installation uses `pnpm-lock.yaml`; inspect both
lockfiles when diagnosing different results. `pnpm run audit:rust` additionally
requires `cargo-audit`. Audits access advisory registries. [CI](.github/workflows/ci.yml)
currently ignores two named Rust advisories, so its audit result can differ from
the local script; a passing audit does not establish that ignored findings are
fixed. Keep failed audits visible rather than running automatic dependency fixes
as part of verification.

For changed UI behavior, run the mocked component tests above and inspect the
changed flow in the Tauri webview only in the separate test account with synthetic
history. A browser-only `pnpm dev` serves the frontend but has no Tauri IPC bridge,
so it cannot verify capture, copying, persistence, or shortcuts. Pure documentation
changes do not require a desktop or browser launch.

## Tech Stack

| Layer         | Technology                                                   |
| ------------- | ------------------------------------------------------------ |
| Desktop shell | Tauri 2                                                      |
| Frontend      | React, TypeScript, Tailwind CSS                              |
| Backend       | Rust — clipboard monitoring, categorization, image handling  |
| Storage       | SQLite with FTS5 (local app data dir)                        |
| Security      | SHA256 deduplication, CSP enforced, path-bounded image-preview reads |

## Architecture

Clipboard monitoring runs in a Rust background loop. Text passes through a categorization pipeline before write — the sensitive-content detector runs first and can block the text write entirely. Images are encoded as PNG before storage, bypass text sensitivity checks, and are tagged misc. Image-preview reads are path-bounded and database-authorized; image copying reads the stored database path directly. The Rust backend registers the fixed global shortcut to toggle the manager window, which is configured with `skipTaskbar: true`.

## License

MIT
