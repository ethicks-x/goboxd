# Shared helpers for install scripts. Source, do not execute.

set -euo pipefail

section() {
    printf '\n========== %s ==========\n' "$*"
}

info() {
    printf '[install] %s\n' "$*"
}

verify() {
    local label="$1"; shift
    if "$@" >/dev/null 2>&1; then
        info "verified: ${label}"
    else
        printf '[install] FAILED verification: %s (cmd: %s)\n' "${label}" "$*" >&2
        exit 1
    fi
}

apt_install() {
    apt-get update
    apt-get install -y --no-install-recommends "$@"
}
