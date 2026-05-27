#!/bin/bash
set -euo pipefail
. "$(dirname "$0")/../install/common.sh"

section "lang: JavaScript (Node.js 20)"
if ! command -v /usr/bin/node >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt_install nodejs
fi

verify "node --version" /usr/bin/node --version
verify "node exec"      /usr/bin/node -e "console.log('ok')"
