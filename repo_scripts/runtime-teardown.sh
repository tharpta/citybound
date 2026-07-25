#!/usr/bin/env bash

# Bounded teardown for a child started by a compatibility smoke.
# Callers must set SERVER_PID, SERVER_COMMAND, and optionally SERVER_PORTS.

runtime_allocate_loopback_port() {
    node -e '
        const net = require("net");
        const server = net.createServer();
        server.unref();
        server.listen(0, "127.0.0.1", () => {
            process.stdout.write(String(server.address().port));
            server.close();
        });
    '
}

runtime_child_matches() {
    local command
    command="$(ps -p "$SERVER_PID" -o command= 2>/dev/null || true)"
    [[ -n "$command" && "$command" == *"$SERVER_COMMAND"* ]]
}

runtime_child_running() {
    kill -0 "$SERVER_PID" >/dev/null 2>&1
}

runtime_capture_diagnostics() {
    local destination="$1"
    {
        echo "Runtime teardown diagnostics"
        date -u '+captured_at=%Y-%m-%dT%H:%M:%SZ'
        echo "expected_child=$SERVER_COMMAND"
        ps -p "$SERVER_PID" -o pid=,ppid=,pgid=,stat=,etime=,command= || true
        lsof -nP -a -p "$SERVER_PID" -d cwd,txt 2>/dev/null || true
        local port
        for port in ${SERVER_PORTS:-}; do
            lsof -nP -iTCP:"$port" 2>/dev/null || true
        done
    } >"$destination"
}

runtime_wait_gone() {
    local attempts="$1"
    local delay="$2"
    local attempt
    for ((attempt=0; attempt<attempts; attempt++)); do
        if ! runtime_child_running; then
            wait "$SERVER_PID" >/dev/null 2>&1 || true
            return 0
        fi
        sleep "$delay"
    done
    return 1
}

runtime_stop_child() {
    local label="$1"
    local diagnostics_file="$2"

    [[ -n "${SERVER_PID:-}" ]] || return 0
    if ! runtime_child_running; then
        wait "$SERVER_PID" >/dev/null 2>&1 || true
        SERVER_PID=""
        return 0
    fi
    if ! runtime_child_matches; then
        echo "Refusing to signal PID $SERVER_PID during $label: identity does not match $SERVER_COMMAND." >&2
        runtime_capture_diagnostics "$diagnostics_file"
        return 1
    fi

    kill -INT "$SERVER_PID" >/dev/null 2>&1 || true
    if runtime_wait_gone 20 0.25; then
        SERVER_PID=""
        return 0
    fi

    kill -TERM "$SERVER_PID" >/dev/null 2>&1 || true
    if runtime_wait_gone 8 0.25; then
        SERVER_PID=""
        return 0
    fi

    kill -KILL "$SERVER_PID" >/dev/null 2>&1 || true
    if runtime_wait_gone 8 0.25; then
        SERVER_PID=""
        return 0
    fi

    runtime_capture_diagnostics "$diagnostics_file"
    echo "Runtime teardown failed during $label; PID $SERVER_PID remains after SIGINT/SIGTERM/SIGKILL." >&2
    echo "Diagnostics preserved at $diagnostics_file. Do not start another runtime probe." >&2
    return 1
}
