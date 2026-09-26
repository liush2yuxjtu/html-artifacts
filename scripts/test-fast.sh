#!/bin/sh
# Offline contract tests for the ChatCut pipelines: no network, no browser, a few
# seconds. Run before every push (the .githooks/pre-push hook does) and before
# /verify's browser steps; CI keeps only the checks that need the network.
#
#   sh scripts/test-fast.sh
set -eu
cd "$(git rev-parse --show-toplevel)"
exec node --test \
  chatcut-v3/tests/build.test.mjs \
  chatcut-mirror-src/tests/*.test.mjs \
  chatcut-production-mirror/tests/*.test.mjs
