#!/bin/bash
set -e
EXPECTED="1.40"
PACKAGE_VERSION="$(node -p "require('./package.json').version")"
if [ "$PACKAGE_VERSION" != "$EXPECTED" ]; then
  echo "package.json version mismatch: expected $EXPECTED but found $PACKAGE_VERSION"
  exit 1
fi
OUTPUT="$(node ./bin/fazai --version 2>/dev/null | tr -d '\r\n')"
if [ "$OUTPUT" = "FazAI v$EXPECTED" ]; then
  echo "Version test passed: $OUTPUT"
  exit 0
else
  echo "Version mismatch: expected 'FazAI v$EXPECTED' but got '$OUTPUT'"
  exit 1
fi
