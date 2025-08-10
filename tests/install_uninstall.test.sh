#!/bin/bash
set -e

tmp=$(mktemp -d)
cp install.sh uninstall.sh "$tmp/"
pushd "$tmp" >/dev/null

sudo bash ./install.sh --help > install_help.txt
if ! grep -q "Uso" install_help.txt; then
  echo "install help missing" >&2
  cat install_help.txt >&2
  exit 1
fi

printf 'n\nn\n' | sudo bash ./uninstall.sh > uninstall_out.txt
if ! grep -q "Desinstalação cancelada" uninstall_out.txt; then
  echo "uninstall flow failed" >&2
  cat uninstall_out.txt >&2
  exit 1
fi

popd >/dev/null
rm -rf "$tmp"
