#!/bin/bash
# Base packages required across stages.

set -euo pipefail
. "$(dirname "$0")/common.sh"

section "system base"
apt_install \
    ca-certificates \
    curl \
    wget \
    git \
    unzip \
    pkg-config

verify "curl"   curl --version
verify "git"    git --version
