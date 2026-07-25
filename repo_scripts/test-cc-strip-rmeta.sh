#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WRAPPER="$SCRIPT_DIR/cc-strip-rmeta.sh"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/citybound-linker-test.XXXXXX")"
TEST_ROOT="$(cd "$TEST_ROOT" && pwd -P)"

cleanup() {
    local status=$?
    trap - EXIT
    rm -rf -- "$TEST_ROOT"
    exit "$status"
}

trap cleanup EXIT

fail() {
    echo "FAIL: $*" >&2
    exit 1
}

wait_for_file() {
    local path="$1"
    local attempt

    for ((attempt = 0; attempt < 200; attempt++)); do
        if [[ -f "$path" ]]; then
            return 0
        fi
        sleep 0.05
    done

    fail "timed out waiting for $path"
}

SCRATCH_ROOT="$TEST_ROOT/scratch"
ARCHIVE_ROOT="$TEST_ROOT/archive"
mkdir -p "$SCRATCH_ROOT" "$ARCHIVE_ROOT"
printf 'preserve sibling\n' >"$SCRATCH_ROOT/sentinel"

printf 'metadata\n' >"$ARCHIVE_ROOT/lib.rmeta"
printf 'object\n' >"$ARCHIVE_ROOT/member.o"
(
    cd "$ARCHIVE_ROOT"
    ar -cr test.rlib lib.rmeta member.o
)
ARCHIVE="$ARCHIVE_ROOT/test.rlib"

FAKE_LINKER="$TEST_ROOT/fake-linker.sh"
cat >"$FAKE_LINKER" <<'FAKE_LINKER'
#!/usr/bin/env bash
set -euo pipefail

record=
release=
status=0
archive=

for arg in "$@"; do
    case "$arg" in
        --record=*)
            record="${arg#--record=}"
            ;;
        --release=*)
            release="${arg#--release=}"
            ;;
        --status=*)
            status="${arg#--status=}"
            ;;
        *.rlib)
            archive="$arg"
            ;;
    esac
done

[[ -n "$record" ]] || exit 90
[[ -n "$archive" ]] || exit 91

printf '%s\n' "$(dirname "$archive")" >"$record"
touch "$record.ready"

if [[ -n "$release" ]]; then
    for ((attempt = 0; attempt < 200; attempt++)); do
        if [[ -f "$release" ]]; then
            exit "$status"
        fi
        sleep 0.05
    done
    exit 92
fi

exit "$status"
FAKE_LINKER
chmod +x "$FAKE_LINKER"

run_wrapper() {
    local expected_status="$1"
    local record="$2"
    local wrapper_status
    local scratch_dir

    set +e
    TMPDIR="$SCRATCH_ROOT" REAL_CC="$FAKE_LINKER" \
        "$WRAPPER" "$ARCHIVE" "--record=$record" "--status=$expected_status"
    wrapper_status=$?
    set -e

    [[ "$wrapper_status" -eq "$expected_status" ]] \
        || fail "expected linker status $expected_status, got $wrapper_status"
    [[ -s "$record" ]] || fail "fake linker did not record its scratch directory"

    scratch_dir="$(cat "$record")"
    [[ "$scratch_dir" == "$SCRATCH_ROOT"/citybound-rmeta-linker.?????? ]] \
        || fail "unexpected scratch directory: $scratch_dir"
    [[ ! -e "$scratch_dir" ]] \
        || fail "scratch directory survived linker status $expected_status: $scratch_dir"
}

run_wrapper 0 "$TEST_ROOT/success-record"
run_wrapper 42 "$TEST_ROOT/failure-record"

release="$TEST_ROOT/release-concurrent-linkers"
pids=()
records=()

for invocation in 1 2 3 4; do
    record="$TEST_ROOT/concurrent-record-$invocation"
    records+=("$record")
    TMPDIR="$SCRATCH_ROOT" REAL_CC="$FAKE_LINKER" \
        "$WRAPPER" "$ARCHIVE" "--record=$record" "--release=$release" --status=0 &
    pids+=("$!")
done

for record in "${records[@]}"; do
    wait_for_file "$record.ready"
done

scratch_dirs=()
for record in "${records[@]}"; do
    scratch_dir="$(cat "$record")"
    [[ "$scratch_dir" == "$SCRATCH_ROOT"/citybound-rmeta-linker.?????? ]] \
        || fail "unexpected concurrent scratch directory: $scratch_dir"
    [[ -d "$scratch_dir" ]] \
        || fail "concurrent scratch directory was not live before release: $scratch_dir"
    scratch_dirs+=("$scratch_dir")
done

unique_count="$(
    printf '%s\n' "${scratch_dirs[@]}" \
        | LC_ALL=C sort -u \
        | wc -l \
        | tr -d '[:space:]'
)"
[[ "$unique_count" -eq "${#scratch_dirs[@]}" ]] \
    || fail "concurrent wrapper invocations shared a scratch directory"

touch "$release"
for pid in "${pids[@]}"; do
    wait "$pid"
done

for scratch_dir in "${scratch_dirs[@]}"; do
    [[ ! -e "$scratch_dir" ]] \
        || fail "concurrent scratch directory survived: $scratch_dir"
done

[[ "$(cat "$SCRATCH_ROOT/sentinel")" == "preserve sibling" ]] \
    || fail "wrapper altered a sibling entry in the scratch root"

if find "$SCRATCH_ROOT" \
    -mindepth 1 \
    -maxdepth 1 \
    -type d \
    -name 'citybound-rmeta-linker.*' \
    -print -quit \
    | grep -q .
then
    fail "wrapper left a scratch directory in the scratch root"
fi

echo "Linker wrapper cleanup regression checks passed."
