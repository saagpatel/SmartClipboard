<!-- comm-contract:start -->

## Communication Contract

- Inherit global Codex communication and reporting rules from `~/AGENTS.override.md` and global policy files.
- Repo-specific instructions below add project constraints only; do not restate global voice or status-reporting rules here.

<!-- comm-contract:end -->

## Inherited Operating Rules

- Inherit global git, review/fix, testing, docs, skill-use, and reporting gates from the global `AGENTS.md` and active session instructions.
- Use `.codex/verify.commands` and `.codex/scripts/run_verify_commands.sh` as this repo-local verification authority when present.
- Keep the project-specific portfolio constraints below as the source of truth for runtime, privacy, and release risks.

<!-- portfolio-context:start -->

# Portfolio Context

## What This Project Is

SmartClipboard is a macOS menu-bar clipboard manager built with Tauri and React. It monitors clipboard history locally, stores searchable text/image metadata in SQLite with FTS5 and image files locally, categorizes text entries, filters sensitive text, deduplicates by hash, and exposes the manager through a fixed global shortcut.

## Current State

The repo is active desktop productivity work. The npm, pnpm, and Cargo lockfiles are tracked, and `.github/` tracks both `PULL_REQUEST_TEMPLATE.md` and `pull_request_template.md` (case variants); context recovery should remain documentation-only.

## Stack

| Layer         | Technology                                                   |
| ------------- | ------------------------------------------------------------ |
| Desktop shell | Tauri 2                                                      |
| Frontend      | React, TypeScript, Tailwind CSS                              |
| Backend       | Rust — clipboard monitoring, categorization, image handling  |
| Storage       | SQLite with FTS5 (local app data dir)                        |
| Security      | SHA256 deduplication, CSP enforced, path-bounded image-preview reads |

## How To Run

Use [README setup and usage](README.md#quick-start) for prerequisites and manual
launch safety, and [README verification](README.md#verification) for focused
fixture checks and broader test/build commands. Development launches monitor the
live clipboard; lean mode isolates caches only.

## Known Risks

- Clipboard data is sensitive; preserve local-only storage and app exclusion controls.
- Sensitive-content detection should run before writes and be tested before expanding capture behavior.
- Image reads must remain path-bounded and database-authorized. Preview reads enforce this; image copying currently reads the stored database path directly, a known implementation gap.
- Keep PR-template and lockfile drift separate from clipboard monitoring changes.

## Next Recommended Move

Resolve PR-template drift separately, then verify capture, sensitive filtering, search, image handling, favorites, retention, and global shortcut behavior before shipping changes.

<!-- portfolio-context:end -->
