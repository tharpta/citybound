#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/citybound-containment-test.XXXXXX")"

cleanup() {
    find "$TEST_ROOT" -depth -delete
}
trap cleanup EXIT

FAKE_BIN="$TEST_ROOT/bin"
FAKE_HOME="$TEST_ROOT/home"
LOG="$TEST_ROOT/commands.log"
STATE="$TEST_ROOT/toolchain-installed"
NODE_BIN="$(command -v node)"
case "$(uname -s)" in
    Darwin) TOOLCHAIN="nightly-2020-03-10-x86_64-apple-darwin" ;;
    Linux) TOOLCHAIN="nightly-2020-03-10-x86_64-unknown-linux-gnu" ;;
    *) echo "Unsupported containment-test host: $(uname -s)" >&2; exit 1 ;;
esac
mkdir -p "$FAKE_BIN" "$FAKE_HOME"

cat >"$FAKE_BIN/rustup" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf 'rustup %s\n' "$*" >>"$CITYBOUND_TEST_LOG"
case "${1:-}" in
    --version) echo "rustup 1.28.0" ;;
    toolchain)
        if [[ "${2:-}" == "list" ]]; then
            [[ -f "$CITYBOUND_TEST_STATE" ]] && echo "$CITYBOUND_TEST_TOOLCHAIN"
            exit 0
        elif [[ "${2:-}" == "install" ]]; then
            if [[ "${CITYBOUND_TEST_RUSTUP_FAIL:-}" == "toolchain-install" ]]; then
                exit 42
            fi
            : >"$CITYBOUND_TEST_STATE"
        fi
        ;;
    component)
        if [[ "${CITYBOUND_TEST_RUSTUP_FAIL:-}" == "component-${3:-}" ]]; then
            exit 43
        fi
        ;;
    *) exit 2 ;;
esac
EOF

cat >"$FAKE_BIN/cargo-web" <<'EOF'
#!/usr/bin/env bash
printf 'cargo-web %s\n' "$*" >>"$CITYBOUND_TEST_LOG"
echo "${CITYBOUND_TEST_CARGO_WEB_VERSION:-cargo-web 0.6.24}"
EOF

cat >"$FAKE_BIN/npm" <<'EOF'
#!/usr/bin/env bash
printf 'npm %s\n' "$*" >>"$CITYBOUND_TEST_LOG"
EOF
chmod +x "$FAKE_BIN/rustup" "$FAKE_BIN/cargo-web" "$FAKE_BIN/npm"

run_tooling() {
    env \
        HOME="$FAKE_HOME" \
        PATH="$FAKE_BIN:/usr/bin:/bin" \
        CITYBOUND_TEST_LOG="$LOG" \
        CITYBOUND_TEST_STATE="$STATE" \
        CITYBOUND_TEST_TOOLCHAIN="$TOOLCHAIN" \
        "$@"
}

# Safe default: missing tooling fails without an install, override, component, or home mutation.
if run_tooling "$NODE_BIN" "$REPO_ROOT/repo_scripts/tooling.js" >"$TEST_ROOT/default.out" 2>&1; then
    echo "Expected safe tooling inspection to fail when the pinned toolchain is absent." >&2
    exit 1
fi
if grep -Eq 'toolchain install|override|component add' "$LOG"; then
    echo "Safe tooling inspection attempted host mutation." >&2
    exit 1
fi
[[ -z "$(find "$FAKE_HOME" -mindepth 1 -print -quit)" ]]

# Explicit opt-in: only the pinned toolchain/components are requested.
: >"$LOG"
run_tooling env CITYBOUND_ALLOW_TOOLCHAIN_MUTATION=1 \
    "$NODE_BIN" "$REPO_ROOT/repo_scripts/tooling.js" >"$TEST_ROOT/opt-in.out"
grep -q "toolchain install $TOOLCHAIN" "$LOG"
grep -q "component add rustfmt-preview --toolchain $TOOLCHAIN" "$LOG"
grep -q "component add clippy-preview --toolchain $TOOLCHAIN" "$LOG"
if grep -Eq 'override|curl|wget|mv .*cargo' "$LOG"; then
    echo "Explicit tooling setup used a forbidden global/bootstrap path." >&2
    exit 1
fi

# Explicit toolchain install failures propagate and do not continue setup.
rm -f "$STATE"
: >"$LOG"
if run_tooling env \
    CITYBOUND_ALLOW_TOOLCHAIN_MUTATION=1 \
    CITYBOUND_TEST_RUSTUP_FAIL=toolchain-install \
    "$NODE_BIN" "$REPO_ROOT/repo_scripts/tooling.js" \
    >"$TEST_ROOT/toolchain-install-failure.out" 2>&1; then
    echo "Expected a Rust toolchain install failure to propagate." >&2
    exit 1
fi
grep -q "toolchain install $TOOLCHAIN" "$LOG"
if grep -Eq '^rustup component|^cargo-web ' "$LOG"; then
    echo "Toolchain install failure continued into later setup." >&2
    exit 1
fi

# Explicit component failures propagate after the pinned toolchain is present.
: >"$STATE"
: >"$LOG"
if run_tooling env \
    CITYBOUND_ALLOW_TOOLCHAIN_MUTATION=1 \
    CITYBOUND_TEST_RUSTUP_FAIL=component-clippy-preview \
    "$NODE_BIN" "$REPO_ROOT/repo_scripts/tooling.js" \
    >"$TEST_ROOT/component-install-failure.out" 2>&1; then
    echo "Expected a Rust component install failure to propagate." >&2
    exit 1
fi
grep -q "component add rustfmt-preview --toolchain $TOOLCHAIN" "$LOG"
grep -q "component add clippy-preview --toolchain $TOOLCHAIN" "$LOG"
grep -q 'Failed to install clippy-preview' "$TEST_ROOT/component-install-failure.out"

# Provenance failure: wrong cargo-web is rejected without attempting replacement.
: >"$LOG"
if run_tooling env CITYBOUND_TEST_CARGO_WEB_VERSION='cargo-web 0.6.23' \
    "$NODE_BIN" "$REPO_ROOT/repo_scripts/tooling.js" >"$TEST_ROOT/provenance.out" 2>&1; then
    echo "Expected an unpinned cargo-web version to fail closed." >&2
    exit 1
fi
grep -q 'unauthenticated prebuilt-binary download is disabled' "$TEST_ROOT/provenance.out"
if grep -Eq 'toolchain install|component add|curl|wget' "$LOG"; then
    echo "Provenance failure attempted mutation or replacement." >&2
    exit 1
fi

# Lifecycle default and incomplete opt-in: npm must never run.
: >"$LOG"
BUILD_SENTINEL="$TEST_ROOT/build-root/sentinel"
mkdir -p "$(dirname "$BUILD_SENTINEL")"
printf 'preserve\n' >"$BUILD_SENTINEL"
if run_tooling env CITYBOUND_COMPAT_BUILD_ROOT="$(dirname "$BUILD_SENTINEL")" \
    "$REPO_ROOT/repo_scripts/build-browser-compat.sh" \
    >"$TEST_ROOT/build-default.out" 2>&1; then
    echo "Expected browser compatibility build default to fail closed." >&2
    exit 1
fi
grep -qx 'preserve' "$BUILD_SENTINEL"

if run_tooling "$REPO_ROOT/repo_scripts/install-browser-dependencies-compat.sh" \
    >"$TEST_ROOT/lifecycle-default.out" 2>&1; then
    echo "Expected legacy lifecycle default to fail closed." >&2
    exit 1
fi
if run_tooling env CITYBOUND_ALLOW_LEGACY_LIFECYCLE=1 \
    "$REPO_ROOT/repo_scripts/install-browser-dependencies-compat.sh" \
    >"$TEST_ROOT/lifecycle-uncontained.out" 2>&1; then
    echo "Expected uncontained legacy lifecycle opt-in to fail closed." >&2
    exit 1
fi
if grep -q '^npm ' "$LOG"; then
    echo "A rejected lifecycle path invoked npm." >&2
    exit 1
fi

# A public env marker cannot bypass the real checkout boundary.
run_tooling env \
    CITYBOUND_ALLOW_LEGACY_LIFECYCLE=1 \
    CITYBOUND_LEGACY_INSTALL_CONTAINED=1 \
    "$REPO_ROOT/repo_scripts/install-browser-dependencies-compat.sh" \
    >"$TEST_ROOT/lifecycle-forged-marker.out" 2>&1 && {
        echo "A forged public marker bypassed real-checkout containment." >&2
        exit 1
    }
grep -q 'forbidden in a Git checkout/worktree' "$TEST_ROOT/lifecycle-forged-marker.out"
if grep -q '^npm ' "$LOG"; then
    echo "Real-checkout lifecycle bypass invoked npm." >&2
    exit 1
fi

# A wrapper-created structural boundary in a non-Git copy reaches fake npm.
CONTAINED_ROOT="$TEST_ROOT/contained-root"
mkdir -p "$CONTAINED_ROOT/repo_scripts" "$CONTAINED_ROOT/cb_browser_ui"
CONTAINED_ROOT="$(cd "$CONTAINED_ROOT" && pwd)"
cp "$REPO_ROOT/repo_scripts/install-browser-dependencies-compat.sh" \
    "$CONTAINED_ROOT/repo_scripts/"
printf 'citybound-legacy-build-root-v1\n%s\n' "$CONTAINED_ROOT" \
    >"$CONTAINED_ROOT/.citybound-legacy-build-root"
run_tooling env \
    CITYBOUND_ALLOW_LEGACY_LIFECYCLE=1 \
    "$CONTAINED_ROOT/repo_scripts/install-browser-dependencies-compat.sh" \
    >"$TEST_ROOT/lifecycle-opt-in.out"
grep -qx 'npm install' "$LOG"
[[ -z "$(find "$FAKE_HOME" -mindepth 1 -print -quit)" ]]

echo "Legacy install containment regression passed."
