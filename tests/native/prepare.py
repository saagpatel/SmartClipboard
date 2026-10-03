"""Prepare synthetic data only on a fresh standard GitHub-hosted macOS VM.

No local account or clipboard testing is supported by this script. Schema and
copy handlers stay real: this seeds the production migration, not an IPC mock.
"""

import hashlib
import json
import os
import pathlib
import platform
import pwd
import sqlite3
import subprocess
import time


def require_hosted_mac():
    user = pwd.getpwuid(os.getuid())
    assert platform.system() == "Darwin", "hosted macOS only"
    assert os.environ.get("GITHUB_ACTIONS") == "true"
    assert os.environ.get("RUNNER_ENVIRONMENT") == "github-hosted"
    assert os.environ.get("RUNNER_OS") == "macOS"
    assert os.environ.get("GITHUB_REPOSITORY") == "saagpatel/SmartClipboard"
    assert user.pw_name == "runner", "separate hosted runner account required"
    assert pathlib.Path(os.environ["HOME"]) == pathlib.Path(user.pw_dir)
    assert os.environ["GITHUB_RUN_ID"].isdigit()
    return user


def seed_database(app_data, payloads, now):
    app_data.mkdir(parents=True, exist_ok=False)
    db = sqlite3.connect(app_data / "clipboard.db")
    db.executescript(pathlib.Path("src-tauri/migrations/001_init.sql").read_text())
    db.execute("PRAGMA user_version = 1")
    for index, content in enumerate(payloads):
        db.execute(
            "INSERT INTO clipboard_items(content, content_type, category, "
            "source_app, preview, copied_at, hash) VALUES (?, 'text', 'misc', "
            "'Synthetic native acceptance', ?, ?, ?)",
            (content, content, now - index, hashlib.sha256(content.encode()).hexdigest()),
        )
    db.commit()
    rows = db.execute(
        "SELECT id, content, hash FROM clipboard_items "
        "WHERE is_sensitive=0 ORDER BY is_favorite DESC, copied_at DESC"
    ).fetchall()
    assert [row[1] for row in rows] == payloads
    db.close()
    return rows


if __name__ == "__main__":
    user = require_hosted_mac()  # Before any clipboard command or app-data write.
    support = pathlib.Path(user.pw_dir) / "Library/Application Support"
    production = support / "com.smartclipboard.desktop"
    app_data = support / "com.smartclipboard.native-acceptance"
    assert not production.exists(), "production app data must be absent"
    assert not app_data.exists(), "test app data must be fresh, never reused"
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
    assert head == os.environ["ACCEPTANCE_HEAD"]
    payloads = [f"SC_NATIVE_{os.environ['GITHUB_RUN_ID']}_ROW_{row}" for row in "ABC"]
    # Never read/persist any previous clipboard payload; establish synthetic-only
    # clipboard before launching the unchanged production monitor.
    subprocess.run(["pbcopy"], input=payloads[2], text=True, check=True)
    clipboard = subprocess.check_output(["pbpaste"], text=True)
    assert clipboard == payloads[2]
    rows = seed_database(app_data, payloads, int(time.time()))
    evidence = pathlib.Path("native-acceptance-artifacts")
    evidence.mkdir(exist_ok=True)
    receipt = {
        "runner_user": user.pw_name,
        "runner_uid": user.pw_uid,
        "home": user.pw_dir,
        "hostname": platform.node(),
        "os_version": platform.mac_ver()[0],
        "runner_environment": os.environ["RUNNER_ENVIRONMENT"],
        "run_id": os.environ["GITHUB_RUN_ID"],
        "run_attempt": os.environ["GITHUB_RUN_ATTEMPT"],
        "head": head,
        "tree": subprocess.check_output(["git", "rev-parse", "HEAD^{tree}"], text=True).strip(),
        "production_data_absent_before_launch": True,
        "test_data_absent_before_seed": True,
        "app_data": str(app_data),
        "payloads": payloads,
        "clipboard_before_launch": clipboard,
        "sqlite_rows_before_launch": rows,
        "migration_sha256": hashlib.sha256(pathlib.Path("src-tauri/migrations/001_init.sql").read_bytes()).hexdigest(),
    }
    (evidence / "prelaunch.json").write_text(json.dumps(receipt, indent=2) + "\n")
