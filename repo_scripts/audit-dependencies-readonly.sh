#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ONLINE="${CITYBOUND_AUDIT_ONLINE:-0}"

cd "$REPO_ROOT"
before_status="$(git status --porcelain=v1 --untracked-files=all)"

echo "Citybound dependency inventory (read-only)"
echo "Lockfile fingerprints:"
shasum -a 256 Cargo.lock cb_browser_ui/Cargo.lock package-lock.json \
    cb_browser_ui/package-lock.json

node <<'NODE'
const fs = require("fs");

function packageSummary(path) {
    const manifest = JSON.parse(fs.readFileSync(path, "utf8"));
    return {
        path,
        dependencies: manifest.dependencies ?? {},
        devDependencies: manifest.devDependencies ?? {},
        engines: manifest.engines ?? {},
    };
}

function lockSummary(path) {
    const lock = JSON.parse(fs.readFileSync(path, "utf8"));
    if (lock.packages) {
        return {
            path,
            lockfileVersion: lock.lockfileVersion,
            dependencyOccurrences: Math.max(0, Object.keys(lock.packages).length - 1),
        };
    }
    let dependencyOccurrences = 0;
    function count(dependencies) {
        for (const dependency of Object.values(dependencies ?? {})) {
            dependencyOccurrences += 1;
            count(dependency.dependencies);
        }
    }
    count(lock.dependencies);
    return { path, lockfileVersion: lock.lockfileVersion, dependencyOccurrences };
}

console.log(JSON.stringify({
    manifests: [
        packageSummary("package.json"),
        packageSummary("cb_browser_ui/package.json"),
    ],
    locks: [
        lockSummary("package-lock.json"),
        lockSummary("cb_browser_ui/package-lock.json"),
    ],
}, null, 2));
NODE

echo "Cargo registry and git dependency declarations:"
rg -n '^[A-Za-z0-9_-]+[[:space:]]*=.*(git[[:space:]]*=|version[[:space:]]*=)' \
    --glob 'Cargo.toml' \
    --glob '!target/**' \
    --glob '!cb_simulation_next/target/**' \
    . || true

case "$ONLINE" in
    0)
        echo "Online npm advisory lookup skipped."
        echo "Set CITYBOUND_AUDIT_ONLINE=1 to query advisories without scripts or fixes."
        ;;
    1)
        echo "Querying npm advisories for the historical browser lockfile..."
        set +e
        (
            cd cb_browser_ui
            npm audit --package-lock-only --ignore-scripts --json
        )
        audit_status=$?
        set -e
        if [[ "$audit_status" -ne 0 && "$audit_status" -ne 1 ]]; then
            echo "npm audit failed unexpectedly with status $audit_status." >&2
            exit "$audit_status"
        fi
        echo "npm audit status: $audit_status (1 means advisories were found)."
        ;;
    *)
        echo "CITYBOUND_AUDIT_ONLINE must be 0 or 1." >&2
        exit 2
        ;;
esac

after_status="$(git status --porcelain=v1 --untracked-files=all)"
if [[ "$after_status" != "$before_status" ]]; then
    echo "Dependency audit mutated the working tree." >&2
    diff -u <(printf '%s\n' "$before_status") <(printf '%s\n' "$after_status") >&2 || true
    exit 1
fi

echo "Dependency audit left the working tree unchanged."
