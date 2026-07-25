#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/citybound-runtime-teardown-test.XXXXXX")"
smoke_pid_file="$WORK_DIR/server-smoke.pid"

cleanup_test() {
    if [[ -s "$smoke_pid_file" ]]; then
        local pid command
        pid="$(cat "$smoke_pid_file")"
        command="$(ps -p "$pid" -o command= 2>/dev/null || true)"
        if [[ "$command" == *"$SCRIPT_DIR/runtime-fixtures/fake-server.mjs"* ]]; then
            kill -KILL "$pid" >/dev/null 2>&1 || true
        fi
    fi
    find "$WORK_DIR" -depth -delete
}
trap cleanup_test EXIT

source "$SCRIPT_DIR/runtime-teardown.sh"

fail() {
    echo "runtime teardown test failed: $*" >&2
    exit 1
}

run_child() {
    local mode="$1"
    local int_action="$2"
    local term_action="$3"
    bash -c "
        trap '$int_action' INT
        trap '$term_action' TERM
        while :; do sleep 0.05; done
    " "citybound-fake-$mode" &
    SERVER_PID=$!
    SERVER_PORTS=""
    runtime_register_child "/bin/bash" "$(runtime_process_argv "$SERVER_PID")" \
        || fail "could not register fake child"
}

run_child int "exit" "exit"
runtime_stop_child "SIGINT regression" "$WORK_DIR/int.diag" || fail "SIGINT child was not stopped"

run_child term ":" "exit"
runtime_stop_child "SIGTERM regression" "$WORK_DIR/term.diag" || fail "SIGTERM child was not stopped"

bash -c 'while :; do sleep 0.05; done' citybound-sibling &
sibling_pid=$!
run_child kill ":" ":"
runtime_stop_child "SIGKILL regression" "$WORK_DIR/kill.diag" || fail "SIGKILL child was not stopped"
kill -0 "$sibling_pid" >/dev/null 2>&1 || fail "sibling process was signalled"
kill -KILL "$sibling_pid"
wait "$sibling_pid" >/dev/null 2>&1 || true

node -e '
    process.on("SIGINT", () => {});
    process.on("SIGTERM", () => {});
    setTimeout(() => process.exit(0), 11_000);
' runtime-stubborn-child &
SERVER_PID=$!
SERVER_PORTS=""
runtime_register_child "$(command -v node)" "$(runtime_process_argv "$SERVER_PID")" \
    || fail "could not register stubborn child"
stubborn_pid="$SERVER_PID"
stubborn_fixture="$WORK_DIR/stubborn-fixture"
mkdir "$stubborn_fixture"
kill() {
    return 0
}
if runtime_stop_child "stubborn child regression" "$WORK_DIR/stubborn.diag"; then
    fail "surviving stubborn child was reported as stopped"
fi
unset -f kill
kill -0 "$stubborn_pid" >/dev/null 2>&1 || fail "stubborn child did not actually survive"
[[ -s "$WORK_DIR/stubborn.diag" ]] || fail "stubborn-child diagnostics were not preserved"
[[ -d "$stubborn_fixture" ]] || fail "stubborn-child fixture was not preserved"
for _ in {1..60}; do
    kill -0 "$stubborn_pid" >/dev/null 2>&1 || break
    sleep 0.05
done
kill -0 "$stubborn_pid" >/dev/null 2>&1 && fail "stubborn child did not reach its controlled exit"
wait "$stubborn_pid" >/dev/null 2>&1 || true

port_file="$WORK_DIR/port"
node -e '
    const fs = require("fs");
    const net = require("net");
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
        fs.writeFileSync(process.argv[1], String(server.address().port));
    });
' "$port_file" runtime-port-child &
SERVER_PID=$!
runtime_register_child "$(command -v node)" "$(runtime_process_argv "$SERVER_PID")" \
    || fail "could not register dynamic port child"
for _ in {1..40}; do
    [[ -s "$port_file" ]] && break
    sleep 0.05
done
[[ -s "$port_file" ]] || fail "dynamic port child did not start"
dynamic_port="$(cat "$port_file")"
SERVER_PORTS="$dynamic_port"
runtime_stop_child "port cleanup regression" "$WORK_DIR/port.diag" || fail "port child was not stopped"
node -e '
    const net = require("net");
    const server = net.createServer();
    server.on("error", error => {
        console.error(error.message);
        process.exit(1);
    });
    server.listen(Number(process.argv[1]), "127.0.0.1", () => server.close());
' "$dynamic_port" || fail "child port $dynamic_port was not reusable"

run_child identity "exit" "exit"
SERVER_START_TOKEN="definitely-not-this-start-token"
if runtime_stop_child "identity regression" "$WORK_DIR/identity.diag"; then
    fail "identity mismatch was accepted"
fi
kill -KILL "$SERVER_PID"
wait "$SERVER_PID" >/dev/null 2>&1 || true

smoke_log="$WORK_DIR/server-smoke.log"
smoke_output="$WORK_DIR/server-smoke.output"
set +e
CITYBOUND_SMOKE_SERVER="$(command -v node)" \
CITYBOUND_SMOKE_SERVER_SCRIPT="$SCRIPT_DIR/runtime-fixtures/fake-server.mjs" \
CITYBOUND_SMOKE_LOG="$smoke_log" \
CITYBOUND_FAKE_PID_FILE="$smoke_pid_file" \
CITYBOUND_FAKE_EXIT_AFTER_MS=1500 \
CITYBOUND_SMOKE_SKIP_DIST_CHECK=1 \
CITYBOUND_SMOKE_TEST_INVALIDATE_IDENTITY=1 \
    "$SCRIPT_DIR/smoke-server-compat.sh" >"$smoke_output" 2>&1
smoke_status=$?
set -e
[[ "$smoke_status" -ne 0 ]] || fail "server smoke masked teardown failure"
grep -q "Server smoke passed:" "$smoke_output" \
    || fail "server smoke did not reach successful body before teardown failure"
smoke_fixture="$(sed -n 's/^Disposable city preserved at \(.*\) because teardown failed[.]$/\1/p' "$smoke_output")"
[[ -n "$smoke_fixture" ]] || fail "server smoke did not report preserved fixture"
[[ -d "$smoke_fixture" ]] || fail "server smoke removed explicit fixture"
[[ -s "$smoke_log.teardown" ]] || fail "server smoke did not preserve diagnostics"
smoke_pid="$(cat "$smoke_pid_file")"
[[ -n "$smoke_pid" ]] || fail "server smoke diagnostics omitted PID"
kill -0 "$smoke_pid" >/dev/null 2>&1 || fail "server smoke child did not survive failed teardown"
for _ in {1..40}; do
    kill -0 "$smoke_pid" >/dev/null 2>&1 || break
    sleep 0.05
done
kill -0 "$smoke_pid" >/dev/null 2>&1 && fail "fake server did not exit after preservation assertion"
find "$smoke_fixture" -depth -delete

run_browser_signal_case() {
    local signal="$1"
    local expected_status="$2"
    local signal_fixture="$WORK_DIR/browser-$signal-fixture"
    local signal_ready="$WORK_DIR/browser-$signal-ready"
    local signal_child_pid_file="$WORK_DIR/browser-$signal-child-pid"
    local signal_exit_code_file="$WORK_DIR/browser-$signal-exit-code"
    local signal_harness_pid signal_child_pid signal_status

    mkdir "$signal_fixture"
    node "$SCRIPT_DIR/runtime-fixtures/signal-harness.mjs" \
        "$signal_fixture" "$signal_ready" "$signal_child_pid_file" "$signal_exit_code_file" &
    signal_harness_pid=$!
    for _ in {1..40}; do
        [[ -s "$signal_ready" && -s "$signal_child_pid_file" ]] && break
        sleep 0.05
    done
    [[ -s "$signal_ready" ]] || fail "browser $signal harness did not become ready"
    signal_child_pid="$(cat "$signal_child_pid_file")"
    kill "-$signal" "$signal_harness_pid"
    set +e
    wait "$signal_harness_pid"
    signal_status=$?
    set -e
    [[ "$signal_status" -eq 0 ]] \
        || fail "browser $signal cleanup harness exited unexpectedly with $signal_status"
    [[ "$(cat "$signal_exit_code_file")" -eq "$expected_status" ]] \
        || fail "browser $signal cleanup did not propagate status $expected_status"
    kill -0 "$signal_child_pid" >/dev/null 2>&1 \
        && fail "browser $signal cleanup leaked its child"
    [[ ! -e "$signal_fixture" ]] \
        || fail "browser $signal cleanup did not remove its fixture"
}

run_browser_signal_case TERM 143

echo "Runtime teardown tests passed: escalation is bounded and siblings/identity are protected."
