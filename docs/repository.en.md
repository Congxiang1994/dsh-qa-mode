# Repository layout

## Directory tree

```
dsh-qa-mode/
├── package.json              # manifest: dsh.bundle.patch points to the patch; version / engines / files
├── cordis.patch.yml          # the only runtime declaration: one inserted preset row (with the full persona prompt)
├── locale/
│   ├── zh.json               # Chinese title and description in the plugin list
│   └── en.json
├── icon.svg                  # plugin icon
├── README.md                 # main README (Simplified Chinese): highlights + entry points
├── README.en.md              # main README (English)
├── LICENSE                   # MIT
├── docs/                     # topic docs, read as needed
│   ├── architecture.md / architecture.en.md   # architecture
│   ├── technical.md / technical.en.md         # technical design
│   ├── release.md / release.en.md             # releasing
│   ├── development.md / development.en.md     # development
│   └── repository.md / repository.en.md       # this document
├── scripts/
│   ├── validate.mjs          # manifest + patch + locale + icon + doc references + verbatim prompt
│   ├── verify-session.mjs    # behavioural check against a real session log
│   ├── check-indexes.mjs     # recheck the five plugin indexes and their versions
│   ├── release.sh            # full release: bump -> check -> commit/tag/push -> npm -> verify -> mirror -> indexes
│   └── publish.sh            # npm only (no commit, no verification)
└── .github/workflows/
    └── checks.yml            # run checks on push and PR
```

## Key files

**`package.json`**: `dsh.bundle.patch` points at `cordis.patch.yml` — what makes it an installable bundle. `engines.dsh` bounds the DSH version range; `files` decides what ships to npm (both main READMEs and `docs/` are included).

**`cordis.patch.yml`**: the entire "runtime logic" is one insert row — `@deepseek-ai/dsh-agent-preset` into the Loader. **No `index.js`, no runtime code, no runtime dependencies.** Every tool constraint, the prompt, and the search/fetch bounds live in that one declaration.

**`docs/`**: the main README deliberately keeps only highlights and navigation; architecture, technical, release, development and repository details are split into paired Chinese/English documents. validate checks verbatim prompt consistency across them so the split cannot drift.

**`scripts/`**: `validate.mjs` answers "is the declaration right?", `verify-session.mjs` "does the running composition match?", `check-indexes.mjs` "did it actually ship?", and `release.sh` chains all three into one release path.

## Design principles

1. **Zero runtime code**: prefer declarative solutions over JS, reducing install size and failure surface.
2. **The host owns the provider**: this bundle consumes no search-service configuration; retrieval quality follows the host profile naturally.
3. **Layered docs**: the main file is scannable at a glance, details are one click away; Chinese and English stay in sync with verbatim prompt checks.
4. **Falsifiable verification**: self-tests use injected bad samples, and release success is judged solely by the registry's `dist-tags.latest`.
