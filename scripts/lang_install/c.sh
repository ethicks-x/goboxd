#!/bin/bash
set -euo pipefail
. "$(dirname "$0")/../install/common.sh"

section "lang: C (gcc)"
if ! command -v /usr/bin/gcc >/dev/null 2>&1; then
    apt_install gcc libc6-dev
fi

tmp_src=$(mktemp /tmp/verify_c.XXXX.c)
tmp_bin=$(mktemp /tmp/verify_c.XXXX)
trap 'rm -f "$tmp_src" "$tmp_bin"' EXIT

cat > "$tmp_src" <<'EOF'
#include <stdio.h>
int main(void) { puts("ok"); return 0; }
EOF

/usr/bin/gcc "$tmp_src" -o "$tmp_bin"
verify "gcc compile+run" "$tmp_bin"
