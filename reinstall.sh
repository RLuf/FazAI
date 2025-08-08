#!/usr/bin/env bash

# FazAI - Script de Reinstalação
# Este script remove e instala novamente o FazAI

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"

"$DIR/uninstall.sh"
"$DIR/install.sh"
