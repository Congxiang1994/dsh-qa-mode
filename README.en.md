<h1 align="center">dsh-qa-mode</h1>

<p align="center">
  <strong>Ask a question, get an answer, don't touch the code.</strong><br>
  A fifth mode for DeepSeek Harness: fewer tools, a shorter context, faster answers.
</p>

<p align="center">
  <a href="https://github.com/Congxiang1994/dsh-qa-mode"><img src="https://img.shields.io/badge/dsh-%3E%3D0.2.2--rc.3%20%3C0.4.0--0-4D6BFE?style=flat-square" alt="dsh"></a>
  <a href="https://www.npmjs.com/package/dsh-qa-mode"><img src="https://img.shields.io/npm/v/dsh-qa-mode?style=flat-square" alt="npm"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-378ADD?style=flat-square" alt="license"></a>
  <a href="https://github.com/Congxiang1994/dsh-qa-mode/actions/workflows/checks.yml"><img src="https://img.shields.io/github/actions/workflow/status/Congxiang1994/dsh-qa-mode/checks.yml?style=flat-square" alt="checks"></a>
  <a href="https://github.com/Congxiang1994/dsh-qa-mode"><img src="https://img.shields.io/github/stars/Congxiang1994/dsh-qa-mode?style=flat-square&color=FBBD16" alt="stars"></a>
</p>

<p align="center">
  <a href="README.md">简体中文</a> · <strong>English</strong>
</p>

---

> **In one line**: a Q&A mode for DSH — only web search, fetch and read-only file tools. The request drops from **44 tools / 42 KB of schemas** to **8 tools / 2 KB**, and the system prompt from **6.1 K to 1.2 K characters**. Switch with one click in the mode picker; ask, then move on.

## ⚡ Highlights

| Highlight | What it does | Measured effect |
|---|---|---|
| **Fewer tools** | Search, fetch and read-only files only; no shell, file writes, subagents, workflows or skills | Tool count **44 → 8** (17 with free search installed, 7 with redundant search tools off) |
| **A shorter context** | A complete Q&A persona replaces the coding-agent prompt; search/fetch bounds and output pruning | Schemas **42.1 KB → 2.0 KB**, prompt **6.1 K → 1.2 K** chars — saved again on every turn |
| **Faster answers** | The persona tells the model to launch independent searches in one reply; one call can carry several queries | Total wait tracks the slowest leg, not their sum; fewer rounds, less tool hesitation |
| **Fast mode switching** | Slots into the picker at `order: 1.5` — second place, between Standard and PTC — without renumbering any built-in preset | Just pick 「问答模式」 in the dropdown; no config or code changes |
| **Zero runtime code** | Pure declarative bundle: one preset row inserted into the Loader, no `index.js` | Install and go; no extra dependencies or runtime overhead |
| **No search quota spent** | Declares no provider; search uses whichever service the host profile composes | With `dsh-free-search` installed, its keyless engines answer — no DeepSeek search quota |

In short: **fewer tools → shorter context → faster answers → smoother switching**, and your code stays untouched.

## 🚀 Quick start

```sh
dsh plugin --profile <your-profile> add dsh-qa-mode
```

Open a **new** session and pick 「问答模式」 in the mode picker.

> Sessions that are already open do not switch — a session's plugin composition is fixed when it starts. Remove with `dsh plugin --profile <your-profile> remove dsh-qa-mode`.

## 📚 Documentation

> This file covers highlights only. Design trade-offs, implementation details and engineering workflows are split by topic — read what you need.

| Want to know | Document |
|---|---|
| What the mode looks like, the rows it mounts, where search comes from, the prompt, limitations | [Architecture](docs/architecture.en.md) |
| How request size is cut, how concurrency works, how to trim search tools further | [Technical design](docs/technical.en.md) |
| One-command release, the five indexes, syncing this machine afterwards | [Releasing](docs/release.en.md) |
| Validation, behavioural checks, development commands | [Development](docs/development.en.md) |
| Directory tree and what each file does | [Repository layout](docs/repository.en.md) |

## ⭐ Find it useful? Give it a star

If this plugin saved you context and a few search rounds, drop a star on the **[GitHub repo](https://github.com/Congxiang1994/dsh-qa-mode)** — it helps more DSH users discover the project and keeps me motivated to maintain it.

[Star on GitHub ⭐](https://github.com/Congxiang1994/dsh-qa-mode)

## License

[MIT](LICENSE)
