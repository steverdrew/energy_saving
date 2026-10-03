#!/usr/bin/env python3
"""Deploy to production (https://shiftandsaveapp.web.app/) through CI.

This repo has no "deploy directly" path on purpose -- pushing `main`
triggers .github/workflows/deploy-beta.yml, which re-runs lint/build/test
in CI and only then deploys `dist/` to Firebase Hosting (project
`shiftandsaveapp`, the "beta" target in .firebaserc) if every check
passes. This script does not call `firebase deploy` itself; it only gets
`main` into a state worth pushing and then pushes it, so the real deploy
gatekeeping stays in CI, not on a laptop.

What it does, in order:
  1. Refuses to run on any branch other than `main`, and refuses if local
     `main` is behind `origin/main` (pull/rebase first) -- never
     force-pushes.
  2. If the working tree is dirty: stages every modified/deleted tracked
     file automatically, but asks about each *untracked* file one at a
     time (default: skip) -- so a stray local script or scratch file
     never ends up in a production commit just because it happened to be
     sitting in the working tree. Then prompts for a commit message (not
     optional) and commits.
  3. Runs the same checks CI runs before deploying (lint, build,
     check-bundle, test for the web app; test for the server), failing
     fast on the first failure so a broken push never reaches CI.
  4. Shows exactly which commits are about to go to production and asks
     for an explicit "yes" before pushing -- this is the one irreversible,
     production-visible step, so it is never silent or automatic.
  5. Pushes `main` to `origin`, which is what actually starts the CI
     deploy. This script exits once the push succeeds; watch the Actions
     tab (or `gh run watch`) for the deploy itself.

Usage:
    python3 prod.py              # commit (if needed), check, confirm, push
    python3 prod.py --check-only # commit (if needed) and check only, never push
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SERVER_DIR = ROOT / "server"
PROD_URL = "https://shiftandsaveapp.web.app/"


def run(cmd: list[str], cwd: Path = ROOT) -> subprocess.CompletedProcess:
    print(f"$ {' '.join(cmd)}" + (f"  (in {cwd.relative_to(ROOT)})" if cwd != ROOT else ""))
    return subprocess.run(cmd, cwd=cwd)


def capture(cmd: list[str], cwd: Path = ROOT) -> str:
    result = subprocess.run(cmd, cwd=cwd, check=True, capture_output=True, text=True)
    return result.stdout.strip()


def fail(message: str) -> int:
    print(f"\n{message}", file=sys.stderr)
    return 1


def ensure_main_not_behind() -> int | None:
    branch = capture(["git", "rev-parse", "--abbrev-ref", "HEAD"])
    if branch != "main":
        return fail(
            f"On branch '{branch}', not 'main'. This script only pushes main "
            "(the branch CI deploys from) -- switch to main first."
        )

    run(["git", "fetch", "origin", "main"])
    behind = capture(["git", "rev-list", "--count", "HEAD..origin/main"])
    if behind != "0":
        return fail(
            f"Local main is {behind} commit(s) behind origin/main. "
            "Pull/rebase first -- this script never force-pushes."
        )

    return None


def stage_and_commit() -> int | None:
    status = capture(["git", "status", "--porcelain"])
    if not status:
        print("Working tree already clean -- nothing to commit.")
        return None

    modified = capture(["git", "diff", "--name-only"]).splitlines()
    deleted = capture(["git", "diff", "--name-only", "--diff-filter=D"]).splitlines()
    staged_already = capture(["git", "diff", "--name-only", "--cached"]).splitlines()
    untracked = capture(["git", "ls-files", "--others", "--exclude-standard"]).splitlines()

    tracked_changes = sorted(set(modified) | set(deleted) | set(staged_already))
    if tracked_changes:
        print("Staging modified/deleted tracked files:")
        for path in tracked_changes:
            print(f"  M {path}")
        run(["git", "add", "-u"])

    if untracked:
        print(
            "\nUntracked files found -- each is asked about individually so nothing "
            "unexpected lands in a production commit:"
        )
        for path in untracked:
            reply = input(f"  Stage '{path}'? [y/N] ").strip().lower()
            if reply == "y":
                run(["git", "add", "--", path])
            else:
                print(f"  Skipping '{path}'.")

    staged = capture(["git", "diff", "--name-only", "--cached"]).splitlines()
    if not staged:
        return fail("Nothing staged -- all changes were tracked-file-only and already clean, or skipped. Nothing to commit.")

    print("\nStaged for commit:")
    for path in staged:
        print(f"  {path}")

    message = input("\nCommit message: ").strip()
    if not message:
        return fail("Empty commit message -- aborting, nothing committed.")

    result = run(["git", "commit", "-m", message])
    if result.returncode != 0:
        return fail("git commit failed -- see output above.")

    return None


def run_checks() -> int | None:
    # Mirrors .github/workflows/ci.yml exactly, so a push that passes here
    # has already passed what CI is about to re-check.
    web_steps = [
        ["npm", "run", "lint"],
        ["npm", "run", "build"],
        ["npm", "run", "check-bundle"],
        ["npm", "test"],
    ]
    for step in web_steps:
        if run(step).returncode != 0:
            return fail(f"Web check failed: {' '.join(step)}")

    if run(["npm", "test"], cwd=SERVER_DIR).returncode != 0:
        return fail("Server check failed: npm test")

    return None


def confirm_and_push() -> int:
    log = capture(["git", "log", "--oneline", "origin/main..HEAD"])
    print(f"\nAbout to push to origin/main, which deploys to {PROD_URL}")
    print("Commits going live:\n")
    print(log)
    print()

    reply = input("Type 'yes' to push and trigger the production deploy: ").strip().lower()
    if reply != "yes":
        print("Not confirmed -- nothing pushed.")
        return 1

    result = run(["git", "push", "origin", "main"])
    if result.returncode != 0:
        return fail("git push failed -- see output above.")

    print(f"\nPushed. Watch the 'Deploy beta' GitHub Actions workflow for the deploy to {PROD_URL}")
    return 0


def main() -> int:
    check_only = "--check-only" in sys.argv[1:]

    error = ensure_main_not_behind()
    if error is not None:
        return error

    error = stage_and_commit()
    if error is not None:
        return error

    error = run_checks()
    if error is not None:
        return error

    print("\nAll checks passed.")
    if check_only:
        print("--check-only set -- not pushing.")
        return 0

    return confirm_and_push()


if __name__ == "__main__":
    sys.exit(main())
