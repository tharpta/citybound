#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BOUNDARY_FILE="$REPO_ROOT/.citybound-legacy-build-root"

if [[ "${CITYBOUND_ALLOW_LEGACY_LIFECYCLE:-0}" != "1" ]]; then
    cat >&2 <<'EOF'
Legacy browser dependency installation is blocked by default.

The pinned lock contains known vulnerable build dependencies and npm lifecycle
scripts. For a reviewed compatibility build, use:

  CITYBOUND_ALLOW_LEGACY_LIFECYCLE=1 npm run build-browser-compat

This authorization is accepted only by the compatibility wrapper, which copies
the repository to a temporary no-spaces build root. Routine dependency
inspection remains available through `npm run audit-dependencies-readonly`.
EOF
    exit 1
fi

if [[ -e "$REPO_ROOT/.git" ]]; then
    echo "Legacy lifecycle execution is forbidden in a Git checkout/worktree." >&2
    exit 1
fi

if [[ ! -f "$BOUNDARY_FILE" ]]; then
    echo "Missing compatibility build-root boundary; refusing legacy lifecycle execution." >&2
    exit 1
fi

boundary_magic="$(sed -n '1p' "$BOUNDARY_FILE")"
boundary_root="$(sed -n '2p' "$BOUNDARY_FILE")"
if [[ "$boundary_magic" != "citybound-legacy-build-root-v1" || "$boundary_root" != "$REPO_ROOT" ]]; then
    echo "Invalid compatibility build-root boundary; refusing legacy lifecycle execution." >&2
    exit 1
fi

cd "$REPO_ROOT/cb_browser_ui"
echo "Explicit legacy lifecycle authorization accepted inside compatibility build root."
npm install
