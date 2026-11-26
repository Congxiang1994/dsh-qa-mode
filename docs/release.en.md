# Releasing

> One command runs the whole chain. Any step that cannot be proven exits non-zero — "it ran" is not "it shipped".

## One-command release

```sh
./scripts/release.sh          # patch: 1.0.1 -> 1.0.2
./scripts/release.sh minor    # minor
./scripts/release.sh 1.2.0    # explicit version
```

The script:

1. checks a clean tree and bumps the version (published versions are permanent and cannot be reused)
2. runs `npm run check` and `verify-session --self-test`
3. commits, tags `v<version>` and pushes
4. runs `npm publish`
5. polls the registry until the version is downloadable and `dist-tags.latest` points at it
6. requests an npmmirror sync and confirms it
7. runs `node scripts/check-indexes.mjs` over the five indexes
8. prints the local-sync reminder

Two known traps are handled: npm's `+ package@version` line does not mean the version is downloadable (the script queries the registry directly), and npmmirror counts independently rather than proxying (it needs an explicit `PUT /-/package/<pkg>/syncs`).

Every npm call passes `--cache` under `$TMPDIR`, because a sandboxed `~/.npm` may be read-only. The token lives only in `~/.dsh/.secrets/npm_token` (mode 600) and is passed through a throwaway userconfig — never in argv or history. For npm-only publishing without commit or verification, use `./scripts/publish.sh`.

## The five indexes: recheck on every release

| # | Index | Mechanism | On each release |
|---|---|---|---|
| 1 | `https://cdn.dsh.so/market/index.json` | official indexer rebuilds from npm | wait and recheck; an absent entry due to indexer threshold/lag is recorded, not a failure |
| 2 | `https://cdn.dsh.so/market/top-rank.json` | official top-rank subset | recheck; not being ranked does not mean a failed release |
| 3 | `https://dshopen.org/index.json` | `polang233/dsh-plugin-index` issue + npm rebuild | registered (#804); confirm entry and version follow latest |
| 4 | `https://api.dshfind.com/market/dsh-index.json` | daily sync from GitHub `dsh-plugin` topic | PR adding the repo to `MANUAL_REPOS` (hikariming/dshfind#96); confirm entry and version |
| 5 | `https://xivie-a.github.io/dsh-market/index.json` | manual review, issue, 6-hour rebuild | issue filed (xivie-a/dsh-market#1); confirm entry and version |

```sh
node scripts/check-indexes.mjs              # print each source's state (absent is a normal state)
node scripts/check-indexes.mjs --strict     # non-zero on any absent / outdated source
node scripts/check-indexes.mjs --self-test  # injected verification of the decision logic, offline
```

Each source should report `listed@<version>` or `absent`. For `absent`, decide whether it means "not registered" (sources 3/4/5: file the issue/PR) or "indexer threshold/lag" (sources 1/2: record and wait). **Release success is judged only by npm `dist-tags.latest`; index lag is not a failure.**

Another source: [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) PR #18920 added a `data/plugins/Congxiang1994__dsh-qa-mode.yml` (its README is generated — do not hand-edit). `www.dsh.so/api/submit` accepts only the indexer's internal schema from outside callers; do not try to satisfy its field errors.

## A release leaves this machine on the old version

The profile keeps whatever version it installed, so a green release can still leave the app composing the previous preset. After any behaviour-affecting change, replace the local install:

```
plugin_manager  remove_bundle   target: dsh-qa-mode
plugin_manager  install_bundle  target: dsh-qa-mode@<version>
```

The version is not optional: a local directory installs as a `link:` symlink, and a bare name hits `already-installed`. Removing first and then installing an exact version puts the registry's real directory in place. Then check:

- the profile's `package.json` names the version rather than `link:`
- the installed package's own version matches
- `preset-qa` reports `fiberPhase: active`

An open session does not hot-switch — start a new one to run the new preset.

## Wrap-up checklist

Report: version, measured `dist-tags.latest`, npmmirror state, the five indexes, the version installed in the local profile, and the commit hash. Clean up temporary files and background jobs.
