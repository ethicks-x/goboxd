#!/bin/bash
set -euo pipefail
. "$(dirname "$0")/../install/common.sh"

section "lang: Rust (rustc)"
# Debian's rustc package installs /usr/bin/rustc plus libstd under
# /usr/lib/rustlib, and pulls in gcc for linking. Both /usr and /lib are
# bind-mounted read-only into the jail, so no extra registry mounts are needed.
if ! command -v /usr/bin/rustc >/dev/null 2>&1; then
    apt_install rustc
fi

verify "rustc --version" /usr/bin/rustc --version

# Compile + run a hello program the same way the jail will: sysroot is passed
# explicitly because /proc/self/exe is unavailable under --disable_proc.
workdir=$(mktemp -d /tmp/verify_rust.XXXX)
trap 'rm -rf "$workdir"' EXIT

cat > "${workdir}/solution.rs" <<'EOF'
fn main() { println!("ok"); }
EOF

(cd "$workdir" && /usr/bin/rustc --sysroot=/usr -o solution solution.rs)
verify "rustc compile+run" "${workdir}/solution"
