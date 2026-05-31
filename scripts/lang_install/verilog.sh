#!/bin/bash
set -euo pipefail
. "$(dirname "$0")/../install/common.sh"

section "lang: Verilog (Icarus iverilog)"
# Debian's iverilog package installs /usr/bin/iverilog and /usr/bin/vvp plus
# the backend and VPI modules under /usr/lib, which is bind-mounted read-only
# into the jail, so no extra registry mounts are needed.
if ! command -v /usr/bin/iverilog >/dev/null 2>&1; then
    apt_install iverilog
fi

verify "iverilog -V" /usr/bin/iverilog -V

# Compile + run a minimal design the same way the jail will: iverilog produces
# a vvp bytecode file that vvp then interprets. This is also the real check
# that vvp is present and working.
workdir=$(mktemp -d /tmp/verify_verilog.XXXX)
trap 'rm -rf "$workdir"' EXIT

cat > "${workdir}/solution.v" <<'EOF'
module main;
  initial begin
    $display("ok");
    $finish;
  end
endmodule
EOF

(cd "$workdir" && /usr/bin/iverilog -o solution.vvp solution.v)
verify "iverilog compile+run" /usr/bin/vvp "${workdir}/solution.vvp"
