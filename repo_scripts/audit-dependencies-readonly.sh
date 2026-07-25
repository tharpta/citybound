#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ONLINE="${CITYBOUND_AUDIT_ONLINE:-0}"

cd "$REPO_ROOT"

workspace_fingerprint() {
    git ls-files --cached --others --exclude-standard -z \
        | LC_ALL=C sort -z \
        | while IFS= read -r -d '' path; do
            if [[ -f "$path" ]]; then
                file_hash="$(shasum -a 256 "$path" | awk '{print $1}')"
                printf '%s\0%s\0' "$path" "$file_hash"
            fi
        done \
        | shasum -a 256 \
        | awk '{print $1}'
}

summarize_cargo_metadata() {
    local label="$1"
    shift
    echo "$label"
    "$@" | node -e '
let input = "";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
    const metadata = JSON.parse(input);
    const packages = metadata.packages.map(pkg => ({
        name: pkg.name,
        version: pkg.version,
        manifestPath: pkg.manifest_path,
        dependencies: pkg.dependencies.map(dependency => ({
            name: dependency.name,
            requirement: dependency.req,
            source: dependency.source,
            kind: dependency.kind,
            target: dependency.target,
            optional: dependency.optional,
        })),
    }));
    console.log(JSON.stringify(packages, null, 2));
});'
}

before_fingerprint="$(workspace_fingerprint)"

echo "Citybound dependency inventory (read-only)"
echo "Recorded 2026-07-24 browser advisory evidence: 117 total (12 critical, 46 high, 55 moderate, 4 low)."
echo "Containment does not fix or reduce these time-dependent advisory counts."
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

echo "Complete direct Cargo dependency declarations:"
summarize_cargo_metadata \
    "Native server workspace:" \
    cargo metadata --offline --locked --no-deps --format-version 1
summarize_cargo_metadata \
    "Browser workspace:" \
    cargo metadata --offline --locked --no-deps --format-version 1 \
        --manifest-path cb_browser_ui/Cargo.toml
summarize_cargo_metadata \
    "Quarantined simulation-next workspace:" \
    cargo +stable metadata --offline --locked --no-deps --format-version 1 \
        --manifest-path cb_simulation_next/Cargo.toml

case "$ONLINE" in
    0)
        echo "Online npm advisory lookup skipped."
        echo "Set CITYBOUND_AUDIT_ONLINE=1 to query advisories without scripts or fixes."
        ;;
    1)
        echo "Querying npm advisories for the historical browser lockfile..."
        audit_output="$(mktemp "${TMPDIR:-/tmp}/citybound-npm-audit.XXXXXX")"
        trap 'rm -f "$audit_output"' EXIT
        set +e
        (
            cd cb_browser_ui
            npm audit --package-lock-only --ignore-scripts --json
        ) >"$audit_output"
        audit_status=$?
        set -e
        if [[ "$audit_status" -ne 0 && "$audit_status" -ne 1 ]]; then
            cat "$audit_output" >&2
            echo "npm audit failed unexpectedly with status $audit_status." >&2
            exit "$audit_status"
        fi
        if ! node - "$audit_output" <<'NODE'
const fs = require("fs");
const report = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (
    typeof report.auditReportVersion !== "number"
    || typeof report.metadata?.vulnerabilities?.total !== "number"
) {
    throw new Error("Response is not a complete npm audit report.");
}
NODE
        then
            cat "$audit_output" >&2
            echo "npm audit did not return a valid advisory report." >&2
            exit 1
        fi
        cat "$audit_output"
        echo "npm audit returned a valid report with process status $audit_status."
        ;;
    *)
        echo "CITYBOUND_AUDIT_ONLINE must be 0 or 1." >&2
        exit 2
        ;;
esac

after_fingerprint="$(workspace_fingerprint)"
if [[ "$after_fingerprint" != "$before_fingerprint" ]]; then
    echo "Dependency audit changed tracked or nonignored untracked repository content." >&2
    exit 1
fi

echo "Dependency audit left tracked and nonignored untracked content unchanged."
