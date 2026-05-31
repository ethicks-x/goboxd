#!/bin/bash
set -euo pipefail
. "$(dirname "$0")/../install/common.sh"

section "lang: Golang (Go 1.26)"
if ! command -v /usr/local/go/bin/go >/dev/null 2>&1; then
    wget -q https://go.dev/dl/go1.26.3.linux-amd64.tar.gz
    rm -rf /usr/local/go && tar -C /usr/local -xzf go1.26.3.linux-amd64.tar.gz
fi

verify "go version" /usr/local/go/bin/go version
# verify "go exec"    /usr/local/go/bin/go run -c "fmt.Println('ok')"