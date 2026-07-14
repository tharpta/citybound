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
    rustup toolchain install "$TOOLCHAIN" "${INSTALL_ARGS[@]}"
fi
rustup override set "$TOOLCHAIN"
