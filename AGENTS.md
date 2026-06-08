<!-- comm-contract:start -->

## Communication Contract

- Inherit global Codex communication and reporting rules from `/Users/d/.codex/AGENTS.override.md` and `/Users/d/.codex/policies/communication/BigPictureReportingV1.md`.
- Repo-specific instructions below add project constraints only; do not restate global voice or status-reporting rules here.
<!-- comm-contract:end -->

## Inherited Operating Rules

- Inherit global git, review/fix, testing, docs, skill-use, and reporting gates from `/Users/d/.codex/AGENTS.md` and active session instructions.
- Use `.codex/verify.commands` and `.codex/scripts/run_verify_commands.sh` as this repo-local verification authority when present.
- Keep the project-specific portfolio constraints below as the source of truth for runtime, privacy, and release risks.

<!-- portfolio-context:start -->

# Portfolio Context

## What This Project Is

SmartClipboard is a macOS menu-bar clipboard manager built with Tauri and React. It monitors clipboard history locally, stores searchable text/image items in SQLite with FTS5, categorizes entries, filters sensitive content, deduplicates by hash, and exposes a global shortcut manager.

## Current State

The repo is active desktop productivity work. Existing local changes are PR-template metadata plus an untracked lockfile, so context recovery should remain documentation-only.

## Stack

| Layer         | Technology                                                   |
| ------------- | ------------------------------------------------------------ |
| Desktop shell | Tauri 2                                                      |
| Frontend      | React, TypeScript, Tailwind CSS                              |
| Backend       | Rust — clipboard monitoring, categorization, image handling  |
| Storage       | SQLite with FTS5 (local app data dir)                        |
| Security      | SHA256 deduplication, CSP enforced, path-bounded image reads |

## How To Run

```bash
# Start in development mode
npm run tauri dev

# Lean dev mode (lower disk usage)
npm run dev:lean
```

## Known Risks

- Clipboard data is sensitive; preserve local-only storage and app exclusion controls.
- Sensitive-content detection should run before writes and be tested before expanding capture behavior.
- Image reads must remain path-bounded and database-authorized.
- Keep PR-template and lockfile drift separate from clipboard monitoring changes.

## Next Recommended Move

Resolve PR-template and lockfile drift separately, then verify capture, sensitive filtering, search, image handling, favorites, retention, and global shortcut behavior before shipping changes.

<!-- portfolio-context:end -->
