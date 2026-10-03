import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { openSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";

assert.equal(process.platform, "darwin", "hosted macOS only");
assert.equal(process.env.GITHUB_ACTIONS, "true");
assert.equal(process.env.RUNNER_ENVIRONMENT, "github-hosted");
assert.equal(process.env.GITHUB_REPOSITORY, "saagpatel/SmartClipboard");
assert.equal(
  execFileSync("id", ["-un"], { encoding: "utf8" }).trim(),
  "runner",
);
const output = resolve("native-acceptance-artifacts");
const fixture = JSON.parse(readFileSync(`${output}/prelaunch.json`, "utf8"));
assert.equal(fixture.head, process.env.ACCEPTANCE_HEAD);
assert.equal(fixture.runner_user, "runner");
assert.equal(
  execFileSync("pbpaste", { encoding: "utf8" }),
  fixture.payloads[2],
);
const binary = resolve("src-tauri/target/debug/smartclipboard");
const binarySha256 = createHash("sha256")
  .update(readFileSync(binary))
  .digest("hex");
const trace = [];
const log = openSync(`${output}/app.log`, "w");
const app = spawn(binary, [], {
  env: { ...process.env, TAURI_WEBDRIVER_PORT: "4445", RUST_LOG: "debug" },
  stdio: ["ignore", log, log],
});
let session;
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
async function request(method, path, body) {
  let response;
  try {
    response = await fetch(`http://127.0.0.1:4445${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    appendFileSync(
      `${output}/webdriver.jsonl`,
      JSON.stringify({
        method,
        path,
        body,
        transportError: String(error),
        cause: String(error.cause),
        exitCode: app.exitCode,
        signalCode: app.signalCode,
      }) + "\n",
    );
    throw error;
  }
  const json = await response.json();
  const logged = path.endsWith("/screenshot")
    ? { screenshotLength: json.value?.length }
    : json;
  trace.push({ method, path, body, status: response.status, response: logged });
  appendFileSync(
    `${output}/webdriver.jsonl`,
    JSON.stringify(trace.at(-1)) + "\n",
  );
  assert.ok(response.ok, `${method} ${path}: ${JSON.stringify(json)}`);
  assert.ok(!json.value?.error, JSON.stringify(json));
  return json.value;
}
const endpoint = (path) => `/session/${session}${path}`;
const elementId = (element) => element["element-6066-11e4-a52e-4f735466cecf"];
const previewSelector =
  ".scrollable > .cursor-pointer > .min-w-0 > p:first-child";
async function selectedRow() {
  const rows = await request("POST", endpoint("/elements"), {
    using: "css selector",
    value: ".scrollable > .cursor-pointer",
  });
  const classes = await Promise.all(
    rows.map((row) =>
      request("GET", endpoint(`/element/${elementId(row)}/attribute/class`)),
    ),
  );
  return classes.flatMap((value, index) =>
    value.includes("bg-[var(--bg-hover)]") ? [index] : [],
  );
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    assert.equal(
      app.exitCode,
      null,
      "native app exited before WebDriver was ready",
    );
    try {
      const status = await request("GET", "/status");
      if (status.ready) {
        ready = true;
        break;
      }
      await sleep(500);
    } catch {
      await sleep(500);
    }
  }
  assert.ok(ready, "embedded native driver did not start");
  const created = await request("POST", "/session", {
    capabilities: {
      alwaysMatch: { "wdio:tauriServiceOptions": { windowLabel: "main" } },
    },
  });
  session = created.sessionId;
  assert.equal(created.capabilities.platformName, "macos");
  assert.equal(created.capabilities.browserName, "webkit");
  let rendered;
  for (let attempt = 0; attempt < 40; attempt++) {
    const elements = await request("POST", endpoint("/elements"), {
      using: "css selector",
      value: previewSelector,
    });
    rendered = await Promise.all(
      elements.map((element) =>
        request("GET", endpoint(`/element/${elementId(element)}/text`)),
      ),
    );
    if (JSON.stringify(rendered) === JSON.stringify(fixture.payloads)) break;
    await sleep(250);
  }
  assert.deepEqual(
    rendered,
    fixture.payloads,
    "real SQLite history must render in exact order",
  );
  assert.deepEqual(await selectedRow(), [0]);
  const source = await request("GET", endpoint("/source"));
  writeFileSync(`${output}/before-navigation.html`, source);
  const screenshot = await request("GET", endpoint("/screenshot"));
  writeFileSync(
    `${output}/before-navigation.png`,
    Buffer.from(screenshot, "base64"),
  );
  const keys = ["\uE015", "\uE015", "\uE013"]; // Down, Down, Up => row B
  const started = Date.now();
  await request("POST", endpoint("/actions"), {
    actions: [
      {
        type: "key",
        id: "history-keyboard",
        actions: keys.flatMap((value) => [
          { type: "keyDown", value },
          { type: "keyUp", value },
        ]),
      },
    ],
  });
  assert.deepEqual(
    await selectedRow(),
    [1],
    "ArrowUp must return from row C to row B",
  );
  const selectedScreenshot = await request("GET", endpoint("/screenshot"));
  writeFileSync(
    `${output}/selected-row-before-enter.png`,
    Buffer.from(selectedScreenshot, "base64"),
  );
  assert.deepEqual(
    await selectedRow(),
    [1],
    "row B must still be selected before Enter",
  );
  await request("POST", endpoint("/actions"), {
    actions: [
      {
        type: "key",
        id: "history-keyboard",
        actions: [
          { type: "keyDown", value: "\uE007" },
          { type: "keyUp", value: "\uE007" },
        ],
      },
    ],
  });
  let copied;
  for (let attempt = 0; attempt < 40; attempt++) {
    copied = execFileSync("pbpaste", { encoding: "utf8" });
    if (copied === fixture.payloads[1]) break;
    await sleep(100);
  }
  assert.equal(
    copied,
    fixture.payloads[1],
    "Enter must copy actual selected row via Rust to the native clipboard",
  );
  assert.notEqual(copied, fixture.clipboard_before_launch);
  writeFileSync(
    `${output}/result.json`,
    JSON.stringify(
      {
        result: "PASS_REAL_TAURI_NATIVE_COPY",
        head: fixture.head,
        tree: fixture.tree,
        binarySha256,
        capabilities: created.capabilities,
        rendered,
        keyboardSequence: ["ArrowDown", "ArrowDown", "ArrowUp", "Enter"],
        copied,
        expected: fixture.payloads[1],
        elapsedMs: Date.now() - started,
        noCopyMocks: true,
        realHandlers:
          "HistoryList -> copyToClipboard IPC -> handlers::copy_to_clipboard -> arboard -> pbpaste",
      },
      null,
      2,
    ) + "\n",
  );
} catch (error) {
  writeFileSync(
    `${output}/failure.json`,
    JSON.stringify(
      {
        head: fixture.head,
        error: String(error),
        stack: error.stack,
        exitCode: app.exitCode,
        signalCode: app.signalCode,
      },
      null,
      2,
    ) + "\n",
  );
  throw error;
} finally {
  if (session) await request("DELETE", endpoint("")).catch(() => {});
  app.kill("SIGTERM");
}
