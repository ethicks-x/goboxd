#!/bin/bash
# Build nsjail from source at $NSJAIL_VERSION (default 3.4) and install to /usr/local/bin.

set -euo pipefail
. "$(dirname "$0")/common.sh"

NSJAIL_VERSION="${NSJAIL_VERSION:-3.4}"
SRC_DIR="${NSJAIL_SRC_DIR:-/tmp/nsjail}"

section "nsjail build deps"
apt_install \
    autoconf \
    bison \
    flex \
    g++ \
    gcc \
    libnl-route-3-dev \
    libprotobuf-dev \
    libtool \
    make \
    protobuf-compiler

section "nsjail ${NSJAIL_VERSION}"
rm -rf "${SRC_DIR}"
git clone --depth 1 --branch "${NSJAIL_VERSION}" https://github.com/google/nsjail.git "${SRC_DIR}"
make -C "${SRC_DIR}"
install -m 0755 "${SRC_DIR}/nsjail" /usr/local/bin/nsjail
rm -rf "${SRC_DIR}"

verify "nsjail binary" /usr/local/bin/nsjail --help
