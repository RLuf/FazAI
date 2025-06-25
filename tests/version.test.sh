#!/bin/bash
set -e
EXPECTED="$(node -p "require('./package.json').version")"
OUTPUT="$(node ./bin/fazai --version 2>/dev/null | tr -d '\r\n')"
if [ "$OUTPUT" = "FazAI v$EXPECTED" ]; then
  echo "Version test passed: $OUTPUT"
  exit 0
else
  echo "Version mismatch: expected 'FazAI v$EXPECTED' but got '$OUTPUT'"
  exit 1
fi
