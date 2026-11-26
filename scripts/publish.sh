#!/bin/sh
# Publish this bundle to npm with the token from ~/.dsh/.secrets/npm_token.
#
# The token is handed to npm through a throwaway user config (mode 600) rather
# than a `--//registry.npmjs.org/:_authToken=…` argument, so no plaintext
# credential sits in a file every npm/pnpm command reads, and the value never
# appears in `ps` output or shell history. The file is removed on every exit
# path below — which is why this runs npm as a child instead of `exec`ing it:
# exec would replace this shell and skip the EXIT trap, leaving the token on
# disk.
#
# This publishes only: it does not bump the version, commit, or verify that the
# version became downloadable. `scripts/release.sh` is the full path.
set -eu

token_file="${HOME}/.dsh/.secrets/npm_token"
[ -r "${token_file}" ] || { echo "missing ${token_file}" >&2; exit 1; }

cd "$(dirname "$0")/.."

npmrc_tmp=$(mktemp "${TMPDIR:-/tmp}/dsh-qa-mode-npmrc.XXXXXX")
chmod 600 "${npmrc_tmp}"
cleanup() { rm -f "${npmrc_tmp}"; }
trap cleanup EXIT HUP INT TERM
printf '//registry.npmjs.org/:_authToken=%s\n' "$(cat "${token_file}")" > "${npmrc_tmp}"

env -u NODE_OPTIONS npm publish \
  --userconfig="${npmrc_tmp}" \
  --registry=https://registry.npmjs.org/ \
  "$@"
