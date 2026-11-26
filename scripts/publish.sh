#!/bin/sh
# Publish this bundle to npm with the token from ~/.dsh/.secrets/npm_token.
#
# The token is passed per invocation instead of living in ~/.npmrc, so no
# plaintext credential sits in a file that every npm/pnpm command reads, and
# pnpm never warns about an unresolved ${NPM_TOKEN}.
#
# %s expands to an npm credential template form that keeps the value out of the
# process argument list as seen by `ps`.
set -eu

token_file="${HOME}/.dsh/.secrets/npm_token"
[ -r "${token_file}" ] || { echo "missing ${token_file}" >&2; exit 1; }

cd "$(dirname "$0")/.."
exec env -u NODE_OPTIONS npm publish \
  --registry=https://registry.npmjs.org/ \
  --//registry.npmjs.org/:_authToken="$(cat "${token_file}")" \
  "$@"
