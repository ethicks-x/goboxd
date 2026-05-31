#!/bin/bash
set -euo pipefail
. "$(dirname "$0")/../install/common.sh"

section "lang: Bash"
# bash ships with the base image; install only if somehow absent.
if ! command -v /bin/bash >/dev/null 2>&1; then
    apt_install bash
fi

verify "bash --version" /bin/bash --version
verify "bash exec"      /bin/bash -c "echo ok"
