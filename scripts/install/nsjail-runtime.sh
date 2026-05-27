#!/bin/bash
# Shared libraries nsjail needs to run (not to build).

set -euo pipefail
. "$(dirname "$0")/common.sh"

section "nsjail runtime libs"
apt_install \
    libnl-route-3-200 \
    libprotobuf32

if command -v nsjail >/dev/null 2>&1; then
    verify "nsjail launches" nsjail --help
else
    info "nsjail binary not yet present; runtime libs installed"
fi
