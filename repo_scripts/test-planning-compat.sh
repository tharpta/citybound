#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

export CARGO_TARGET_X86_64_APPLE_DARWIN_LINKER="$REPO_ROOT/repo_scripts/cc-strip-rmeta.sh"

"$SCRIPT_DIR/ensure-rust-toolchain-compat.sh" >/dev/null
cargo test -p cb_planning "$@"
