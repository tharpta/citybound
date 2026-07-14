#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

"$SCRIPT_DIR/check-browser-dist-compat.sh"

export CARGO_TARGET_X86_64_APPLE_DARWIN_LINKER="$REPO_ROOT/repo_scripts/cc-strip-rmeta.sh"

git describe > .version
npm run ensure-tooling -- -q
cargo build
