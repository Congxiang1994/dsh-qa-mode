#!/bin/sh
# One-command release: version bump -> validate -> commit/tag/push -> npm publish
# -> registry verification -> npmmirror sync. Exits non-zero the moment a step
# cannot be proven, so "ran" never reads as "published".
#
# Usage:
#   ./scripts/release.sh            # patch bump (1.0.1 -> 1.0.2)
#   ./scripts/release.sh minor      # minor bump
#   ./scripts/release.sh 1.2.0      # explicit version
#
# Credentials: the npm token lives only in ~/.dsh/.secrets/npm_token (mode 600).
# It is passed per invocation, never written into ~/.npmrc.
#
# Why --cache: in a sandboxed shell $HOME/.npm may be read-only, and npm then
# dies before it ever reaches the registry. A disposable cache keeps the release
# runnable anywhere without touching the user's real npm cache.
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
token_file="${HOME}/.dsh/.secrets/npm_token"
cache_dir="${TMPDIR:-/tmp}/dsh-qa-mode-npm-cache"
registry="https://registry.npmjs.org/"
pkg="dsh-qa-mode"

fail() { echo "release: $1" >&2; exit 1; }

[ -r "${token_file}" ] || fail "missing ${token_file}"

# The token reaches npm through a throwaway user config (mode 600) rather than
# `--//registry.npmjs.org/:_authToken=…`, which would put it in argv for anyone
# running `ps` to read, and in shell history along with the command. The file is
# written only for the publish and removed by the trap on every exit path.
npmrc_tmp=$(mktemp "${TMPDIR:-/tmp}/dsh-qa-mode-npmrc.XXXXXX") || fail "could not create a temporary npmrc"
chmod 600 "${npmrc_tmp}"
cleanup() { rm -f "${npmrc_tmp}"; }
trap cleanup EXIT HUP INT TERM
printf '//registry.npmjs.org/:_authToken=%s\n' "$(cat "${token_file}")" > "${npmrc_tmp}"

# npm here is only ever run with this flag set; --logs-dir keeps debug logs out
# of the read-only home too.
npm_run() {
  env -u NODE_OPTIONS npm --cache="${cache_dir}" --logs-dir="${cache_dir}/_logs" "$@"
}

cd "${root}"

# --- 0. clean tree ---------------------------------------------------------
[ -z "$(git status --porcelain)" ] || fail "working tree is dirty; commit or stash first"

current=$(node -p "require('./package.json').version")
bump="${1:-patch}"
case "${bump}" in
  patch|minor|major) npm_run version "${bump}" --no-git-tag-version >/dev/null ;;
  *)                 npm_run version "${bump}" --no-git-tag-version >/dev/null 2>&1 \
                       || fail "not a valid bump (patch|minor|major) or SemVer version: ${bump}" ;;
esac
next=$(node -p "require('./package.json').version")
[ -n "${next}" ] || fail "could not resolve the next version"
[ "${next}" != "${current}" ] || fail "next version equals current (${current})"
echo "release: ${pkg} ${current} -> ${next}"

# --- 1. validate -----------------------------------------------------------
npm_run run check || fail "bundle validation failed"

# The verifier's self-test runs on every release: it needs no session of its own
# and proves the behavioural assertions still reject a broken composition before
# that composition is published.
node scripts/verify-session.mjs --self-test || fail "the behavioural verifier's self-test failed"

# --- 2. commit + tag + push ------------------------------------------------
git add -A
git commit -m "chore(release): ${pkg} v${next}"
git tag -a "v${next}" -m "${pkg} v${next}"
git push origin HEAD --follow-tags

# --- 3. publish ------------------------------------------------------------
npm_run publish \
  --userconfig="${npmrc_tmp}" \
  --registry="${registry}" \
  --access public

# --- 4. prove it is live ---------------------------------------------------
# A "+ pkg@x" line from npm does not mean the version is downloadable; the
# registry can hold it back briefly. Poll the registry itself.
i=0
until curl -fsS --max-time 20 "${registry}${pkg}/${next}" >/dev/null 2>&1; do
  i=$((i + 1))
  [ "${i}" -le 30 ] || fail "${pkg}@${next} still not on the registry after 150s"
  sleep 5
done
live=$(curl -fsS --max-time 20 "${registry}${pkg}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const d=JSON.parse(s);console.log(d["dist-tags"].latest)})')
[ "${live}" = "${next}" ] || fail "registry latest is ${live}, expected ${next}"
echo "release: npm latest = ${live}"

# --- 5. sync the China mirror ---------------------------------------------
# npmmirror is an independent counter, not a proxy, so a fresh publish needs an
# explicit sync request before the mirror serves it.
curl -fsS --max-time 30 -X PUT "https://registry.npmmirror.com/-/package/${pkg}/syncs" >/dev/null \
  || echo "release: npmmirror sync request failed (non-fatal, mirror will catch up)"
i=0
until [ "$(curl -fsS --max-time 20 "https://registry.npmmirror.com/${pkg}" 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s)["dist-tags"].latest)}catch{console.log("")}})' 2>/dev/null)" = "${next}" ]; do
  i=$((i + 1))
  [ "${i}" -le 24 ] || { echo "release: npmmirror not at ${next} yet (mirror lag, not a failure)"; break; }
  sleep 5
done
echo "release: npmmirror checked"

# --- 6. index sources ------------------------------------------------------
# Both market indexes rebuild from npm on their own, so a release needs no
# further submission. Print the listing state so a missing entry is visible.
for src in "https://cdn.dsh.so/market/index.json" "https://dshopen.org/index.json"; do
  state=$(curl -fsS --max-time 60 "${src}" 2>/dev/null \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const d=JSON.parse(s);const hit=(d.plugins||[]).find(p=>p.name===process.argv[1]);if(!hit)return console.log("absent");const v=(hit.versions||[])[0];console.log("listed@"+(v?v.version:"?"))}catch{console.log("unreadable")}})' "${pkg}" 2>/dev/null || echo "unreachable")
  echo "release: ${src%/*} -> ${state}"
done

echo "release: ${pkg}@${next} published and verified"

# --- 7. local sync is still on you ----------------------------------------
# Publishing does not update the copy this machine runs: the profile keeps the
# version it installed until someone replaces it, so a successful release can
# still leave the local app on the old preset. Naming it here is the last chance
# to notice.
echo "release: now sync the local profile:"
echo "release:   plugin_manager remove_bundle  target: ${pkg}"
echo "release:   plugin_manager install_bundle target: ${pkg}@${next}"
echo "release: verify package.json says \"${next}\" (not link:), and preset-qa is active"
