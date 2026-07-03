import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const leanRoot = mkdtempSync(join(tmpdir(), "smartclipboard-lean-"));
const cargoTargetDir = join(leanRoot, "cargo-target");
const viteCacheDir = join(leanRoot, "vite-cache");

mkdirSync(cargoTargetDir, { recursive: true });
mkdirSync(viteCacheDir, { recursive: true });

const env = {
  ...process.env,
  CARGO_TARGET_DIR: cargoTargetDir,
  VITE_CACHE_DIR: viteCacheDir,
};

let cleaned = false;
const cleanup = () => {
  if (cleaned) return;
  cleaned = true;
  rmSync(leanRoot, { recursive: true, force: true });
  console.log(`[lean-dev] Removed ephemeral cache directory: ${leanRoot}`);
};

const child = spawn("npm", ["run", "tauri", "dev"], {
  stdio: "inherit",
  env,
});

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

child.on("exit", (code, signal) => {
  cleanup();
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 1);
  }
});

child.on("error", (error) => {
  cleanup();
  console.error("Failed to start lean dev mode:", error);
  process.exit(1);
});
