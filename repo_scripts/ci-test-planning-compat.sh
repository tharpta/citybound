#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

export CARGO_NET_GIT_FETCH_WITH_CLI=true

RUSTUP_TOOLCHAIN="$("$SCRIPT_DIR/ensure-rust-toolchain-compat.sh")"
export RUSTUP_TOOLCHAIN

max_fetch_attempts=3
fetch_attempt=1

while true; do
    echo "::group::Dependency fetch (attempt ${fetch_attempt}/${max_fetch_attempts})"
    set +e
    cargo fetch --locked
    fetch_status=$?
    set -e
    echo "::endgroup::"

    if [[ "$fetch_status" -eq 0 ]]; then
        break
    fi

    if [[ "$fetch_attempt" -ge "$max_fetch_attempts" ]]; then
        echo "::error title=Dependency fetch failed::Cargo could not fetch the locked dependency graph after ${max_fetch_attempts} attempts. Compilation and tests did not run."
        exit "$fetch_status"
    fi

    cargo_home="${CARGO_HOME:-$HOME/.cargo}"
    registry_index="$cargo_home/registry/index"
    echo "::warning title=Retrying dependency fetch::Attempt ${fetch_attempt} failed. Removing only the ephemeral crates.io registry index before retrying."

    if [[ -d "$registry_index" ]]; then
        find "$registry_index" \
            -mindepth 1 \
            -maxdepth 1 \
            -type d \
            -name 'github.com-*' \
            -exec rm -rf -- {} +
    fi

    sleep $((fetch_attempt * 5))
    fetch_attempt=$((fetch_attempt + 1))
done

echo "::group::Compile and run planning safety tests"
set +e
"$SCRIPT_DIR/test-planning-compat.sh" --locked --offline
test_status=$?
set -e
echo "::endgroup::"

if [[ "$test_status" -ne 0 ]]; then
    echo "::error title=Planning compilation or tests failed::The locked dependency fetch completed successfully; this failure occurred during compilation or test execution."
    exit "$test_status"
fi
