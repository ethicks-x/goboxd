#!/bin/bash
# Orchestrator. Runs install sections in order, each verifies itself.
# Sections can be selected: ./install.sh [all|system|nsjail|nsjail-runtime|langs]
# Default: all (runtime layout — no nsjail build).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGETS="${*:-all}"

run_section() {
    local name="$1"
    case "$name" in
        system)         bash "${SCRIPT_DIR}/install/system.sh" ;;
        nsjail)         bash "${SCRIPT_DIR}/install/nsjail.sh" ;;
        nsjail-runtime) bash "${SCRIPT_DIR}/install/nsjail-runtime.sh" ;;
        langs)
            for s in "${SCRIPT_DIR}/lang_install"/*.sh; do
                bash "$s"
            done
            ;;
        all)
            run_section system
            run_section nsjail-runtime
            run_section langs
            ;;
        *)
            echo "unknown section: $name" >&2
            exit 2
            ;;
    esac
}

# echo "deb https://ftp.iitm.ac.in/debian bookworm main" > /etc/apt/sources.list
# apt-get update

for t in $TARGETS; do
    run_section "$t"
done

apt-get clean
rm -rf /var/lib/apt/lists/*
