#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$REPO_ROOT/cb_browser_ui/dist"

if [[ ! -d "$DIST_DIR" ]]; then
    echo "Missing browser dist directory: $DIST_DIR" >&2
    echo "Run npm run build-browser-compat first." >&2
    exit 1
fi

for required_file in index.html cb_browser_ui.wasm; do
    if [[ ! -s "$DIST_DIR/$required_file" ]]; then
        echo "Missing browser artifact: $DIST_DIR/$required_file" >&2
        exit 1
    fi
done

if ! find "$DIST_DIR" -maxdepth 1 -type f -name '*.js' | grep -q .; then
    echo "Missing browser JavaScript bundle in $DIST_DIR" >&2
    exit 1
fi

if ! find "$DIST_DIR" -maxdepth 1 -type f -name '*.css' | grep -q .; then
    echo "Missing browser CSS bundle in $DIST_DIR" >&2
    exit 1
fi

echo "Browser dist artifacts look usable: $DIST_DIR"
