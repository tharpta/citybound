#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_ROOT="${CITYBOUND_COMPAT_BUILD_ROOT:-${TMPDIR:-/tmp}/citybound-revival-nospace}"
PYTHON_BIN="${PYTHON:-}"

if [[ -z "$BUILD_ROOT" || "$BUILD_ROOT" == "/" || "$BUILD_ROOT" == "$REPO_ROOT" ]]; then
    echo "Refusing unsafe CITYBOUND_COMPAT_BUILD_ROOT: $BUILD_ROOT" >&2
    exit 1
fi

if [[ "$BUILD_ROOT" == *" "* ]]; then
    echo "CITYBOUND_COMPAT_BUILD_ROOT must not contain spaces: $BUILD_ROOT" >&2
    exit 1
fi

if [[ -z "$PYTHON_BIN" ]]; then
    for candidate in /opt/homebrew/bin/python3.11 /usr/bin/python3 python3.11 python3; do
        if command -v "$candidate" >/dev/null 2>&1; then
            if "$candidate" - <<'PY' >/dev/null 2>&1
import distutils.version
PY
            then
                PYTHON_BIN="$(command -v "$candidate")"
                break
            fi
        fi
    done
fi

if [[ -z "$PYTHON_BIN" ]]; then
    echo "Could not find a Python with distutils for old node-gyp." >&2
    exit 1
fi

echo "Building browser assets from no-spaces copy: $BUILD_ROOT"
rm -rf "$BUILD_ROOT"
mkdir -p "$BUILD_ROOT"

rsync -a \
    --exclude '.git' \
    --exclude 'target' \
    --exclude 'node_modules' \
    --exclude 'cb_browser_ui/node_modules' \
    --exclude 'cb_browser_ui/dist' \
    "$REPO_ROOT/" \
    "$BUILD_ROOT/"

(
    cd "$BUILD_ROOT"
    rustup override set nightly-2020-03-10-x86_64-apple-darwin
    export PYTHON="$PYTHON_BIN"
    export CARGO_TARGET_X86_64_APPLE_DARWIN_LINKER="$BUILD_ROOT/repo_scripts/cc-strip-rmeta.sh"
    npm run build-browser
)

rm -rf "$REPO_ROOT/cb_browser_ui/dist"
mkdir -p "$REPO_ROOT/cb_browser_ui/dist"
rsync -a "$BUILD_ROOT/cb_browser_ui/dist/" "$REPO_ROOT/cb_browser_ui/dist/"

echo "Browser assets copied to $REPO_ROOT/cb_browser_ui/dist"
