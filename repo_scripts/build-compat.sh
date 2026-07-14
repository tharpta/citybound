#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$SCRIPT_DIR/build-browser-compat.sh"
"$SCRIPT_DIR/build-server-debug-compat.sh"
