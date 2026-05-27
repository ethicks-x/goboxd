#!/bin/bash
set -euo pipefail
. "$(dirname "$0")/../install/common.sh"

section "lang: Java (OpenJDK 17)"
if ! command -v /usr/bin/javac >/dev/null 2>&1; then
    apt_install openjdk-17-jdk-headless
fi

# Expose javac/java at /usr/bin (apt provides them via alternatives already,
# but pin via update-alternatives if missing).
ARCH=$(dpkg --print-architecture)
JAVA_HOME="/usr/lib/jvm/java-17-openjdk-${ARCH}"
export JAVA_HOME

workdir=$(mktemp -d /tmp/verify_java.XXXX)
trap 'rm -rf "$workdir"' EXIT

cat > "${workdir}/Solution.java" <<'EOF'
public class Solution { public static void main(String[] a) { System.out.println("ok"); } }
EOF

(cd "$workdir" && /usr/bin/javac Solution.java)
verify "java compile+run" /usr/bin/java -cp "$workdir" Solution
