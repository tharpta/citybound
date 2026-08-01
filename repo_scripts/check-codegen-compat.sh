#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CHECK_ROOT="${CITYBOUND_CODEGEN_CHECK_ROOT:-${TMPDIR:-/tmp}/citybound-codegen-check}"
EXPECTED_FILE_COUNT=44

if [[ -z "$CHECK_ROOT" || "$CHECK_ROOT" == "/" || "$CHECK_ROOT" == "$REPO_ROOT" ]]; then
    echo "Refusing unsafe CITYBOUND_CODEGEN_CHECK_ROOT: $CHECK_ROOT" >&2
    exit 1
fi

if [[ "$CHECK_ROOT" == *" "* ]]; then
    echo "CITYBOUND_CODEGEN_CHECK_ROOT must not contain spaces: $CHECK_ROOT" >&2
    exit 1
fi

TOOLCHAIN="$("$SCRIPT_DIR/ensure-rust-toolchain-compat.sh")"

mkdir -p "$CHECK_ROOT"
rsync -a --delete \
    --exclude '.git' \
    --exclude 'target' \
    --exclude 'node_modules' \
    --exclude 'cb_browser_ui/node_modules' \
    --exclude 'cb_browser_ui/dist' \
    "$REPO_ROOT/" \
    "$CHECK_ROOT/"

(
    cd "$CHECK_ROOT"
    if [[ "$(uname -s)" == "Darwin" ]]; then
        export CARGO_TARGET_X86_64_APPLE_DARWIN_LINKER="$CHECK_ROOT/repo_scripts/cc-strip-rmeta.sh"
    fi

    RUSTUP_TOOLCHAIN="$TOOLCHAIN" cargo run --locked --quiet -p citybound-codegen-check -- \
        "$CHECK_ROOT/cb_util" \
        "$CHECK_ROOT/cb_time" \
        "$CHECK_ROOT/cb_planning" \
        "$CHECK_ROOT/cb_simulation" \
        "$CHECK_ROOT/cb_browser_ui"
)

original_files="$(
    cd "$REPO_ROOT"
    find cb_browser_ui cb_planning cb_simulation cb_time cb_util \
        -name kay_auto.rs -type f -print | sort
)"
generated_files="$(
    cd "$CHECK_ROOT"
    find cb_browser_ui cb_planning cb_simulation cb_time cb_util \
        -name kay_auto.rs -type f -print | sort
)"

if [[ "$original_files" != "$generated_files" ]]; then
    echo "kay_auto.rs path set changed after regeneration." >&2
    diff -u <(printf '%s\n' "$original_files") <(printf '%s\n' "$generated_files") >&2 || true
    exit 1
fi

file_count="$(printf '%s\n' "$original_files" | sed '/^$/d' | wc -l | tr -d ' ')"
if [[ "$file_count" != "$EXPECTED_FILE_COUNT" ]]; then
    echo "Expected $EXPECTED_FILE_COUNT generated files, found $file_count." >&2
    exit 1
fi

while IFS= read -r relative_path; do
    if ! cmp -s "$REPO_ROOT/$relative_path" "$CHECK_ROOT/$relative_path"; then
        echo "Generated actor glue changed: $relative_path" >&2
        diff -u "$REPO_ROOT/$relative_path" "$CHECK_ROOT/$relative_path" >&2 || true
        exit 1
    fi
done <<< "$original_files"

echo "Codegen compatibility passed: $file_count kay_auto.rs files regenerated identically."
