# Development

## Quick start

```sh
npm install
npm run check     # declaration checks: manifest, patch rows, preset plugins, locale, icon, doc references and verbatim prompt
npm run verify    # behavioural check: reads the newest Q&A session for tools, prompt and request budgets
```

Both exit non-zero on failure.

## Two layers of validation

**`npm run check` (`scripts/validate.mjs`)** proves the declaration is well-formed: manifest, patch structure, preset order/plugin list, locale, icon, and a verbatim check that the prompt quoted in the Chinese and English docs matches `cordis.patch.yml`. It cannot prove the declaration produced the promised composition — a preset assembles from whichever rows survived, so a wrong row still installs.

**`npm run verify` (`scripts/verify-session.mjs`)** closes that gap. It reads the real `request/header` and system prompt of the newest Q&A session under `~/.dsh/sessions/` and asserts:

- the session really runs the `qa` preset
- read-only tools are present and no write/execute/delegate tool is
- the persona's key rules actually reached the model
- the request is inside budget (prompt < 3000 chars, schemas < 14000 bytes, at most 20 tools)

`npm run verify -- --all` checks every historical Q&A session.

## Injected self-tests

`--self-test` feeds deliberately broken samples to prove the assertions actually bite — an all-green run alone says nothing about whether a check works:

```sh
node scripts/verify-session.mjs --self-test
node scripts/check-indexes.mjs --self-test   # index decision logic, offline
```

`release.sh` runs the verifier's self-test on every release.

## Hard constraints

- **Pure declarative, zero runtime code**: do not add `index.js` or runtime dependencies. The only runtime declaration is the single `@deepseek-ai/dsh-agent-preset` row in `cordis.patch.yml`.
- **Do not pin `searchProvider`**: a pinned provider id dangles when that plugin is disabled, making every search fail with `configured web provider is not registered`.
- Keep the `author` field in `package.json` — the plugin market shows it.
- Pass `--cache` under `$TMPDIR` to npm calls; non-interactive scripts must not depend on `.bashrc`.
- Changes ship immediately under a standing authorization; see [Releasing](release.en.md).

## Documentation structure

The main README covers highlights only; the trade-offs are split by topic under `docs/`:

| Document | Content |
|---|---|
| [Architecture](architecture.en.md) | mode placement, mounted rows, search source, prompt, limitations |
| [Technical design](technical.en.md) | request-size compression, concurrency boundary, tool trimming |
| [Releasing](release.en.md) | release script, indexes, local sync |
| [Development](development.en.md) | this document |
| [Repository layout](repository.en.md) | directory tree and file roles |

Chinese and English docs are maintained in pairs; validate checks prompt-source consistency across them.
