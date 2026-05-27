#!/bin/bash
set -euo pipefail
. "$(dirname "$0")/../install/common.sh"

section "lang: C++ (g++)"
if ! command -v /usr/bin/g++ >/dev/null 2>&1; then
    apt_install g++ libc6-dev libstdc++-12-dev
fi

tmp_src=$(mktemp /tmp/verify_cpp.XXXX.cpp)
tmp_bin=$(mktemp /tmp/verify_cpp.XXXX)
trap 'rm -f "$tmp_src" "$tmp_bin"' EXIT

cat > "$tmp_src" <<'EOF'
#include <iostream>
int main() { std::cout << "ok\n"; return 0; }
EOF

/usr/bin/g++ "$tmp_src" -o "$tmp_bin"
verify "g++ compile+run" "$tmp_bin"
