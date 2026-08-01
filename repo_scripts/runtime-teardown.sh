#!/usr/bin/env bash

# Portable, fail-closed teardown for a directly spawned compatibility-smoke child.
# Darwin proves identity with ps parent/start/argv plus lsof's exact executable path.
# Linux proves the same fields with ps plus /proc/PID/exe. Other platforms fail closed.

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

runtime_canonical_path() {
    local path="$1"
    local directory
    directory="$(cd "$(dirname "$path")" && pwd -P)" || return 1
    printf '%s/%s\n' "$directory" "$(basename "$path")"
}

runtime_process_start_token() {
    local pid="$1"
    if [[ "$(uname -s)" == "Linux" && -r "/proc/$pid/stat" ]]; then
        awk '{print $22}' "/proc/$pid/stat"
    else
        ps -p "$pid" -o lstart= 2>/dev/null | sed 's/^ *//;s/ *$//'
    fi
}

runtime_process_argv() {
    ps -p "$1" -o command= 2>/dev/null | sed 's/^ *//;s/ *$//'
}

runtime_process_executable_identity() {
    local pid="$1"
    case "$(uname -s)" in
        Darwin)
            local inode="" line candidate
            while IFS= read -r line; do
                case "$line" in
                    i*) inode="${line#i}" ;;
                    n*)
                        candidate="${line#n}"
                        if [[ "$candidate" == "$SERVER_EXECUTABLE" && -n "$inode" ]]; then
                            printf '%s|%s\n' "$candidate" "$inode"
                            break
                        fi
                        ;;
                esac
            done < <(lsof -Fnfi -a -p "$pid" -d txt 2>/dev/null)
            ;;
        Linux)
            local candidate device_inode
            candidate="$(readlink -f "/proc/$pid/exe" 2>/dev/null || true)"
            device_inode="$(stat -Lc '%d:%i' "/proc/$pid/exe" 2>/dev/null || true)"
            if [[ "$candidate" == "$SERVER_EXECUTABLE" && -n "$device_inode" ]]; then
                printf '%s|%s\n' "$candidate" "$device_inode"
            fi
            ;;
        *)
            return 1
            ;;
    esac
}

runtime_register_child() {
    local executable="$1"
    local expected_argv="$2"

    [[ -n "${SERVER_PID:-}" ]] || return 1
    SERVER_PARENT_PID="$$"
    SERVER_EXECUTABLE="$(runtime_canonical_path "$executable")" || return 1
    SERVER_EXPECTED_ARGV="$expected_argv"
    SERVER_START_TOKEN="$(runtime_process_start_token "$SERVER_PID")"
    [[ -n "$SERVER_START_TOKEN" ]] || return 1
    SERVER_EXECUTABLE_IDENTITY="$(runtime_process_executable_identity "$SERVER_PID")"
    [[ -n "$SERVER_EXECUTABLE_IDENTITY" ]] || return 1
    runtime_child_matches
}

runtime_child_matches() {
    local actual_parent actual_start actual_argv actual_executable
    actual_parent="$(ps -p "$SERVER_PID" -o ppid= 2>/dev/null | tr -d ' ')"
    actual_start="$(runtime_process_start_token "$SERVER_PID")"
    actual_argv="$(runtime_process_argv "$SERVER_PID")"
    actual_executable="$(runtime_process_executable_identity "$SERVER_PID")"

    [[ "$actual_parent" == "$SERVER_PARENT_PID" ]] &&
        [[ "$actual_start" == "$SERVER_START_TOKEN" ]] &&
        [[ "$actual_argv" == "$SERVER_EXPECTED_ARGV" ]] &&
        [[ "$actual_executable" == "$SERVER_EXECUTABLE_IDENTITY" ]]
}

runtime_child_running() {
    kill -0 "$SERVER_PID" >/dev/null 2>&1
}

runtime_capture_diagnostics() {
    local destination="$1"
    mkdir -p "$(dirname "$destination")"
    {
        echo "Runtime teardown diagnostics"
        date -u '+captured_at=%Y-%m-%dT%H:%M:%SZ'
        echo "expected_parent=$SERVER_PARENT_PID"
        echo "expected_start=$SERVER_START_TOKEN"
        echo "expected_executable=$SERVER_EXECUTABLE"
        echo "expected_executable_identity=$SERVER_EXECUTABLE_IDENTITY"
        echo "expected_argv=$SERVER_EXPECTED_ARGV"
        ps -p "$SERVER_PID" -o pid=,ppid=,pgid=,lstart=,stat=,etime=,command= || true
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

runtime_signal_child() {
    local signal="$1"
    if ! runtime_child_matches; then
        return 1
    fi
    kill "-$signal" "$SERVER_PID" >/dev/null 2>&1
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
        echo "Refusing to signal PID $SERVER_PID during $label: exact child identity cannot be proven." >&2
        runtime_capture_diagnostics "$diagnostics_file"
        return 1
    fi

    if ! runtime_signal_child INT; then
        runtime_capture_diagnostics "$diagnostics_file"
        return 1
    fi
    if runtime_wait_gone 20 0.25; then
        SERVER_PID=""
        return 0
    fi

    if ! runtime_signal_child TERM; then
        runtime_capture_diagnostics "$diagnostics_file"
        return 1
    fi
    if runtime_wait_gone 8 0.25; then
        SERVER_PID=""
        return 0
    fi

    if ! runtime_signal_child KILL; then
        runtime_capture_diagnostics "$diagnostics_file"
        return 1
    fi
    if runtime_wait_gone 8 0.25; then
        SERVER_PID=""
        return 0
    fi

    runtime_capture_diagnostics "$diagnostics_file"
    echo "Runtime teardown failed during $label; PID $SERVER_PID remains after SIGINT/SIGTERM/SIGKILL." >&2
    echo "Diagnostics preserved at $diagnostics_file. Do not start another runtime probe." >&2
    return 1
}
