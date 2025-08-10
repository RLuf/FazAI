#!/bin/bash
set -e
EXPECTED="1.42.1"
PACKAGE_VERSION="$(node -p "require('./package.json').version")"
if [ "$PACKAGE_VERSION" != "$EXPECTED" ]; then
  echo "package.json version mismatch: expected $EXPECTED but found $PACKAGE_VERSION"
  exit 1
fi
export NODE_PATH="$(pwd)/tests/stubs/node_modules"
sudo mkdir -p /opt/fazai/lib
sudo touch /opt/fazai/lib/main.js
OUTPUT="$(node ./bin/fazai --version 2>/dev/null | tr -d '\r\n')"
sudo rm -rf /opt/fazai
if [ "$OUTPUT" = "FazAI v$EXPECTED" ]; then
  echo "Version test passed: $OUTPUT"
  exit 0
else
  echo "Version mismatch: expected 'FazAI v$EXPECTED' but got '$OUTPUT'"
  exit 1
fi
