#!/usr/bin/env python3
"""Run the web app and API server locally, side by side.

No Firebase emulator involved: the server talks to the real Firebase
project (via firebase-admin) and a local SQLite file under server/data/.

Usage:
    python3 local.py           # install deps if needed, then run both
    python3 local.py --no-install
"""

import base64
import os
import secrets
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SERVER_DIR = ROOT / "server"


def ensure_server_env() -> None:
    env_path = SERVER_DIR / ".env"
    if env_path.exists():
        return

    example_path = SERVER_DIR / ".env.example"
    text = example_path.read_text()
    key = base64.b64encode(secrets.token_bytes(32)).decode()
    text = text.replace("ENCRYPTION_KEY=\n", f"ENCRYPTION_KEY={key}\n")
    env_path.write_text(text)
    print(f"Created {env_path} with a generated ENCRYPTION_KEY")

    (SERVER_DIR / "data").mkdir(exist_ok=True)


def ensure_installed(skip: bool) -> None:
    if skip:
        return
    for directory in (ROOT, SERVER_DIR):
        print(f"Installing dependencies in {directory} ...")
        subprocess.run(["npm", "install"], cwd=directory, check=True)


def run_both() -> int:
    web = subprocess.Popen(["npm", "run", "dev"], cwd=ROOT)
    api = subprocess.Popen(["npm", "run", "dev"], cwd=SERVER_DIR)

    try:
        while True:
            web_code = web.poll()
            api_code = api.poll()
            if web_code is not None or api_code is not None:
                break
    except KeyboardInterrupt:
        pass
    finally:
        for proc in (web, api):
            if proc.poll() is None:
                proc.terminate()
        for proc in (web, api):
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()

    return web.returncode or api.returncode or 0


def main() -> int:
    if shutil.which("npm") is None:
        print("npm not found on PATH; install Node.js first.", file=sys.stderr)
        return 1

    skip_install = "--no-install" in sys.argv[1:]
    ensure_server_env()
    ensure_installed(skip_install)

    print("Starting web (http://localhost:5173) and api (http://localhost:4000) ...")
    return run_both()


if __name__ == "__main__":
    sys.exit(main())
