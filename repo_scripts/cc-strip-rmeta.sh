#!/usr/bin/env bash
set -euo pipefail

scratch_parent="$(cd "${TMPDIR:-/tmp}" && pwd -P)"
tmpdir="$(mktemp -d "$scratch_parent/citybound-rmeta-linker.XXXXXX")"

cleanup() {
    local status=$?
    trap - EXIT

    case "$tmpdir" in
        "$scratch_parent"/citybound-rmeta-linker.??????)
            if ! rm -rf -- "$tmpdir"; then
                echo "Failed to remove linker scratch directory: $tmpdir" >&2
            fi
            ;;
        *)
            echo "Refusing to remove unexpected linker scratch path: $tmpdir" >&2
            ;;
    esac

    exit "$status"
}

trap cleanup EXIT

args=()
rlib_index=0

for arg in "$@"; do
    if [[ "$arg" == *.rlib && -f "$arg" ]]; then
        members_to_delete=()
        while IFS= read -r member; do
            case "$member" in
                lib.rmeta|*.bc.z)
                    members_to_delete+=("$member")
                    ;;
            esac
        done < <(ar -t "$arg" 2>/dev/null || true)

        if (( ${#members_to_delete[@]} > 0 )); then
            stripped="$tmpdir/${rlib_index}-$(basename "$arg")"
            cp "$arg" "$stripped"
            ar -d "$stripped" "${members_to_delete[@]}" >/dev/null 2>&1 || true
            args+=("$stripped")
            rlib_index=$((rlib_index + 1))
        else
            args+=("$arg")
        fi
    else
        args+=("$arg")
    fi
done

set +e
"${REAL_CC:-/usr/bin/cc}" "${args[@]}"
linker_status=$?
set -e

exit "$linker_status"
