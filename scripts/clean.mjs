import { rmSync } from "node:fs";

const mode = process.argv[2] ?? "full";
const heavyDirectories = [
  "dist",
  "src-tauri/target",
  "src-tauri/gen",
  "node_modules/.vite",
  ".vite",
];
const fullOnlyDirectories = ["node_modules", ".codex_audit"];

const files = [
  ".DS_Store",
  "src-tauri/.DS_Store",
  "CODE_AUDIT_REPORT.md",
  "COMPREHENSIVE_AUDIT_REPORT.md",
];

const directories =
  mode === "heavy"
    ? heavyDirectories
    : mode === "full"
      ? [...heavyDirectories, ...fullOnlyDirectories]
      : null;

if (!directories) {
  console.error('Invalid mode. Use "heavy" or "full".');
  process.exit(1);
}

for (const path of directories) {
  rmSync(path, { recursive: true, force: true });
}

for (const path of files) {
  rmSync(path, { force: true });
}

console.log(`Cleanup complete (${mode}).`);
