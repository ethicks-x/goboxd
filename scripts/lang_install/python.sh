#!/bin/bash
set -euo pipefail
. "$(dirname "$0")/../install/common.sh"

section "lang: Python 3"
if ! command -v /usr/bin/python3 >/dev/null 2>&1; then
    apt_install python3
fi

verify "python3 --version" /usr/bin/python3 --version
verify "python3 exec"      /usr/bin/python3 -c "print('ok')"
