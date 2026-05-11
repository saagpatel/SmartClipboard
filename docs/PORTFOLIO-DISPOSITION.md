# SmartClipboard — Portfolio Disposition

**Status:** Release Frozen — Tauri 2 + Rust clipboard manager on
`origin/main` with explicit hardened-release baseline (`3d484be
chore: baseline hardened release state`) and CI release-gate
workflow (`b0a72e8 ci: add release gate workflow`). Image/PNG
handling, categorizer, db, security-hardened CSP + path-bounded
filesystem. Joins the signing cluster as the 19th member.

> Disposition uses strict `origin/main` verification.

---

## Verification posture

This repo has **only `origin`** (`saagpatel/SmartClipboard`) — no
`legacy-origin` remote. Clean migration state.

But local branch state has the **same quirk as TicketDashboard**
(R8): **no local `main` branch exists**. The clone has:

- `codex/chore/bootstrap-codex-os` (current HEAD before this pass)
- `codex/lean-dev-mode` (older)
- `codex/remediate-tests-docs-contracts-v1` (older)
- `master` (no upstream, points at `2890b3a chore(repo): remove
bloat and document clean workflow` — likely a pre-rename
  remnant)

Reactivation must explicitly create local `main` from `origin/main`.

Specifically verified on `origin/main`:

- Tip: `098e073` chore: add initial CHANGELOG (most recent of a
  long sequence of bootstrap chore commits)
- Substantive commits visible on `origin/main`:
  - `9a85994` feat(dev): add lean mode and split cleanup workflows
  - `cc40ca2` docs: refresh README for hardened release
  - `b0a72e8` ci: add release gate workflow
  - `3d484be` chore: baseline hardened release state
- Reading: the actual product code (categorizer, clipmon, db) was
  in the pre-baseline-hardened squash. The current `origin/main`
  is the hardened-release baseline plus a codex bootstrap layer.
- Tree on `origin/main`:
  - `src-tauri/src/categorizer.rs` — clip categorization
  - `src-tauri/src/clipmon.rs` — clipboard monitor
  - `src-tauri/src/db.rs` — SQLite layer
  - `src-tauri/migrations/001_init.sql`
  - `.cargo/audit.toml` — Rust dep audit config
  - **Microsoft Store icons** (`Square107x107Logo.png`, etc.) —
    cross-platform packaging
- Release scaffolding: `b0a72e8 ci: add release gate workflow` —
  one CI gate exists, but no `RELEASE-READINESS.md`-style runbook
- Default branch: `main`

---

## Current state in one paragraph

SmartClipboard is a Tauri 2 + Rust + TypeScript desktop clipboard
manager. Per the README on canonical main: secure (Tauri CSP
explicit, filesystem image reads path-bounded + DB-authorized,
clipboard image persistence uses validated PNG encoding) with
regression tests covering backend image/DB behavior and frontend
list navigation. CI runs frontend build/test/audit plus Rust
audit/build/test. Microsoft Store packaging icons present in tree
(`Square*Logo.png` variants) suggesting Windows distribution
ambition alongside macOS. The "hardened release state" baseline
commit suggests the operator squashed a substantial product surface
before adding the codex-os bootstrap layer.

For full detail see `README.md` on `origin/main`.

---

## Why "Release Frozen" instead of other dispositions

- **Active** — wrong. The commit `3d484be chore: baseline hardened
release state` plus `b0a72e8 ci: add release gate workflow`
  positions this for ship, not for ongoing scoped feature work.
- **Cold Storage / Archived** — wrong. Hardened release state
  argues for live product.
- **Release Frozen** — correct. Joins the cluster.

This is the **19th signing cluster member**: DesktopPEt /
ContentEngine / AIGCCore / Relay / FreeLanceInvoice / Nexus /
DeepTank / OPscinema / ShipKit / SignalFlow / PixelForge /
DatabaseSchema / LegalDocsReview / WorkdayDebrief / TicketDashboard
/ EarthPulse / RealEstate / DevToolsTranslator / **SmartClipboard**.

---

## Unblock trigger (operator)

When ready to ship:

1. **Reconcile local branch state.** Create local `main` from
   `origin/main`. Decide what to do with the standalone `master`
   branch (orphan pre-rename or substantive WIP?).
2. Wire Apple Developer ID + notarization credentials.
3. **Decide Microsoft Store posture.** Cross-platform packaging
   icons are on canonical main but no Microsoft Store workflow
   is visible. Operator picks: ship macOS only first, ship both
   simultaneously, or drop Windows ambition.
4. Verify the existing `b0a72e8 release gate workflow` runs green
   against signed builds.
5. Cut v1.0.0 release tag.

Estimated operator time once credentials are in hand: ~3-4 hours
including the master-branch decision, local-main creation,
Microsoft Store posture decision, and notarization round-trip.

---

## Portfolio operating system instructions

| Aspect               | Posture                                                                                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Portfolio status     | `Release Frozen`                                                                                                                                                                 |
| Review cadence       | Suspend overdue counting                                                                                                                                                         |
| Resurface conditions | (a) Apple signing credentials wired, (b) operator decides Microsoft Store posture, (c) local `main` branch created from `origin/main`, or (d) operator opens a v1.1 scope packet |
| Co-batch with        | Signing cluster: …RealEstate / DevToolsTranslator / **SmartClipboard** — **now 19 repos**                                                                                        |
| Special concern      | **No local `main` branch** — same quirk as TicketDashboard (R8). Reactivation must `git checkout -b main origin/main` explicitly.                                                |
| Special concern      | **Cross-platform ambition.** Microsoft Store icons in tree without Microsoft Store workflow — operator decision needed.                                                          |

---

## Why this row has the "no local main" quirk again

Same shape as TicketDashboard from R8: clone has `master` (no
upstream) + several `codex/*` bootstrap branches, but no local
`main`. The remote `origin` has `main` as default.

This is the second session repo with this exact pattern. The
trap-shape audit going forward should look for repos where
`git branch -vv` shows no `main` line — those need explicit
`git checkout -b main origin/main` before any work.

If a future round surfaces more repos like this, consider promoting
the "no local main" trap to a first-class disposition concern
alongside legacy-origin tracking and branch-state-behind-canonical.

---

## Reactivation procedure (for the next code session)

1. **Create local `main` from `origin/main`:**
   ```bash
   git fetch origin
   git checkout -b main origin/main
   ```
2. Inspect the standalone `master` branch:
   ```bash
   git log master --oneline -10
   git log origin/main..master --oneline
   ```
   Decide: cherry-pick valuable commits or delete the branch.
3. Review the local stash (`r9-smartclipboard-stash`) — contains
   significant mods to package.json, package-lock.json, perf
   workflows, perf scripts, AGENTS.md.
4. Delete stale `codex/*` branches.
5. Re-run `pnpm install && pnpm tauri build` to confirm toolchain.
6. **Decide Microsoft Store posture before signing.**
7. Run `b0a72e8` release-gate workflow against signed build.

---

## Last known reference

| Field                     | Value                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| `origin/main` tip         | `098e073` chore: add initial CHANGELOG                                                                  |
| Last substantive commit   | `9a85994` feat(dev): add lean mode and split cleanup workflows                                          |
| Hardened-release baseline | `3d484be` chore: baseline hardened release state                                                        |
| CI release gate           | `b0a72e8` ci: add release gate workflow                                                                 |
| Default branch            | `main`                                                                                                  |
| Build system              | Tauri 2 + Rust + TypeScript + Vite + SQLite                                                             |
| Security posture          | Explicit CSP, path-bounded filesystem reads, DB-authorized image access, validated PNG encoding         |
| Cross-platform signal     | **Microsoft Store icon variants** in tree — Windows distribution ambition                               |
| Release scaffolding       | CI release-gate workflow only; no runbook docs                                                          |
| Build verification status | Untested in this pass                                                                                   |
| Blocker                   | Apple signing + Microsoft Store decision + local-main reconciliation (operator-only)                    |
| Migration state           | **No `legacy-origin` remote** — clean                                                                   |
| Local branch state        | **No `main` branch locally** — `master` (no upstream) + `codex/*` bootstrap branches only               |
| Distinguishing feature    | **Cross-platform packaging signals** (Microsoft Store icons) + hardened-release-baseline squash pattern |
