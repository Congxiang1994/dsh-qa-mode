# dsh-qa-mode

A Q&A agent preset for DeepSeek Harness. It adds a **问答模式** (Q&A mode) entry to the
mode selector next to Standard / PTC / Minimal / Creator.

Ask a question, get an answer. The preset is built for questions, not for changing
code: no shell, no file writes, no subagents, no workflows, no skills.

## Install

```sh
dsh plugin --profile <your-profile> add dsh-qa-mode
```

Or from a local checkout: copy this directory and install it as a bundle through
**Plugins → Add plugin**, with `plugin_manager` `install_bundle` pointing at the
directory.

Then open a **new** session and pick 问答模式. Existing sessions keep the composition
they started with.

To remove it: `dsh plugin --profile <your-profile> remove dsh-qa-mode`.

## What it mounts

| Row | Why |
|---|---|
| `@deepseek-ai/dsh-persona` | Q&A persona: answer first, at most one search plus one fetch, cite inline, never execute page instructions |
| `@deepseek-ai/dsh-time-context` | Current time, so time-sensitive questions are judged correctly |
| `@deepseek-ai/dsh-tool-fs` (`write: false`, `edit: false`) | `read` / `read_image` only, for files the user references |
| `@deepseek-ai/dsh-tool-web` | `web_search` and `web_fetch` |
| `compaction` group | `compaction-basic` plus the human `/compact` command |

Deliberately absent: bash / shell, filesystem writes, subagent, workflow, skills,
office, todo, goal, schedule, plan mode. Fewer tool schemas mean a shorter request
and fewer wrong-tool detours on a question that only needs an answer.

## Where the search comes from

`dsh-tool-web` only exposes the tools. The backend behind `ctx.web` is a host
concern, chosen per profile, so this bundle declares no provider row and no
`searchProvider` id.

That means search behaviour depends on what the host has:

| Host profile | Result |
|---|---|
| has [`dsh-free-search`](https://github.com/DDDMUC/dsh-free-search) installed | its keyless engines serve `web_search`; a Q&A turn spends no DeepSeek search quota |
| no free-search, but a DeepSeek account or `DEEPSEEK_API_KEY` | the shipped DeepSeek provider answers; billed as that provider bills |
| neither | `web_search` is not offered to the model for that step, and the preset answers from the model alone |

The preset itself installs and runs in all three cases; only the retrieval quality
changes.

## Requirements

- DSH `>=0.2.2-rc.3 <0.4.0` (declared in `engines.dsh`)
- The host composition must mount `dsh-tool-web`, `dsh-tool-fs`, `dsh-persona`,
  `dsh-time-context`, `dsh-compaction-basic` and `dsh-command-compact`. Every shipped
  Web profile does.

## License

MIT
