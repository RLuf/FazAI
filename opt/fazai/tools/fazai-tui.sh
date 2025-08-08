#!/usr/bin/env bash
# FazAI TUI (bash) - fallback simples com ASCII art
set -e

ASCII_FACE='\n\n  .-"""-.._\n /          `-.\n|  .-.  .-.    \\\n|  | |  | |     |\n|  |_|  |_|     |\n|   __  __      |\n|  (  \\  )     |\n|   `.__.`      |\n|    |  |       |\n|    |  |       |\n|    |  |       |\n|____|__|_______|\n\n   _____        _        _ \n  |  ___|__  __| | __ _ (_)\n  | |_ / _ \\/ _` |/ _` || |\n  |  _|  __/ (_| | (_| || |\n  |_|  \\___|\\__,_|\\__,_|/ |\n                        |__/\n\n  FazAI\n  Roger Luft, Andarilho dos Véus - 2025\n'

clear
printf "%b" "$ASCII_FACE"

echo
echo "[q] sair  [l] logs  [s] status  [m] métricas" 

read -rsn1 key || true
case "$key" in
  l) curl -s http://localhost:3120/logs | jq . || true ;;
  s) curl -s http://localhost:3120/status | jq . || true ;;
  m) curl -s http://localhost:3120/metrics || true ;;
  *) ;;
esac
