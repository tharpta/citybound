#!/usr/bin/env bash
set -euo pipefail

NIGHTLY="${CITYBOUND_RUST_NIGHTLY:-nightly-2020-03-10}"

case "$(uname -s)" in
    Darwin)
        TRIPLE="x86_64-apple-darwin"
        INSTALL_ARGS=(--force-non-host)
        ;;
    Linux)
        TRIPLE="x86_64-unknown-linux-gnu"
        INSTALL_ARGS=()
        ;;
    MINGW*|MSYS*|CYGWIN*)
        TRIPLE="x86_64-pc-windows-msvc"
        INSTALL_ARGS=()
        ;;
    *)
        echo "Unsupported host for Citybound compatibility toolchain: $(uname -s)" >&2
        exit 1
        ;;
esac

TOOLCHAIN="$NIGHTLY-$TRIPLE"

if ! rustup toolchain list | awk '{print $1}' | grep -qx "$TOOLCHAIN"; then
    if [[ "${CITYBOUND_ALLOW_TOOLCHAIN_MUTATION:-0}" != "1" ]]; then
        echo "Required compatibility toolchain is not installed: $TOOLCHAIN" >&2
        echo "Inspection did not mutate rustup. Rerun with CITYBOUND_ALLOW_TOOLCHAIN_MUTATION=1 after review." >&2
        exit 1
    fi
    rustup toolchain install "$TOOLCHAIN" "${INSTALL_ARGS[@]}" >&2
fi

# Callers use RUSTUP_TOOLCHAIN for the child process. Do not persist a
# directory override in the user's rustup configuration.
printf '%s\n' "$TOOLCHAIN"
