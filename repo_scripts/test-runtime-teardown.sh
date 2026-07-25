#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/citybound-runtime-teardown-test.XXXXXX")"
trap 'find "$WORK_DIR" -depth -delete' EXIT

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
    SERVER_COMMAND="citybound-fake-$mode"
    SERVER_PORTS=""
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
SERVER_COMMAND="runtime-port-child"
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
SERVER_COMMAND="definitely-not-this-child"
if runtime_stop_child "identity regression" "$WORK_DIR/identity.diag"; then
    fail "identity mismatch was accepted"
fi
kill -KILL "$SERVER_PID"
wait "$SERVER_PID" >/dev/null 2>&1 || true

echo "Runtime teardown tests passed: escalation is bounded and siblings/identity are protected."
