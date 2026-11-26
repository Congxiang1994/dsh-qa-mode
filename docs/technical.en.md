# Technical design

> The main README says "faster"; this document says how, and how to go further.

## How request size comes down

Every Q&A request carries the full tool schemas and system prompt, so each kilobyte saved is saved again on **every turn**. Five things make the difference:

| Measure | What it does | Effect |
|---|---|---|
| Complete persona | `persona.complete: true` stops inheriting the coding agent's deliverable guidance, file-reference rules, checkout path and GUI URL | system prompt **6.1 K → ~1.2 K** chars |
| Concurrent search | the persona tells the model to put independent searches in one reply; `searchMaxQueries: 10` lets one call cover several sub-facts | total wait tracks the slowest leg, not their sum |
| Tighter search | 5 sources per search, 400 chars of summary each | one search's output **~8 K → ~2 K** chars |
| Tighter fetch | `fetchMaxOutputChars: 60000`, `fetchTimeoutMs: 45000` | one page capped at ~15 K tokens instead of ~50 K |
| Result pruning | mounts `tool-result-pruner` (8 KB threshold, head and tail kept) | an oversized page body no longer sits verbatim and gets resent every step |

## The concurrency boundary

DSH's tool executor already runs a batch of calls in a rolling pool (default 10 in flight), and `web_search` already fetches multiple queries concurrently before merging them. What a preset can control is whether the model **actually** groups those independent calls into one reply — the old persona's "search once, then add one more" wording was what produced the serial feel.

So the change touches only the persona prompt and the query cap: no runtime code, no engine changes. A later step that depends on an earlier result (search for a URL, then fetch it) still needs separate rounds; that is a boundary, not a defect.

## Why result pruning matters

The host plane disables its own `tool-result-pruner`, so a preset that does not mount one keeps every fetched page verbatim for the rest of the turn. Pruning is model-free and replay-safe: it keeps the head and tail of an oversized result and marks the omission.

## `complete: true` in detail

It leaves tool schemas and runtime contexts alone — working directory, sandbox and approval policy, and current time are still injected; only the prompt sections are replaced. The cost is that the auto-injected engine section goes away, so the persona restates the one rule that mattered there: do not change the engine configuration yourself.

## Measured toolsets

| Scenario | Tools | Tool schemas | System prompt |
|---|---|---|---|
| Standard mode | 44 | 42.1 KB | — |
| Q&A with `dsh-free-search` installed | 17 | 11.7 KB | 1.2 K chars |
| Q&A without `dsh-free-search` | 8 | 2.0 KB | 1.2 K chars |
| Q&A with only 7 tools kept | 7 | 3.3 KB | 1.2 K chars |

Of the 17, this plugin declares only 4 (`read`, `read_image`, `web_search`, `web_fetch`); 9 come from `dsh-free-search` registering host tools, and 4 from the host. Without free search the set is 8: the plugin's 4 plus the host's `create_worktree`, `load_workspace_dependencies`, `sidebar_open` and `working_directory`.

## Going further: turn off search tools you never use

With `dsh-free-search` installed, it registers nine search tools into the host plane, and this plugin cannot exclude them declaratively (`restrict` needs runtime code). Turn the unused ones off in **Settings → Plugins → Free Search → tool toggles**; their schemas then leave the context entirely:

| Tool | Suggestion | Why |
|---|---|---|
| `web_search` / `web_fetch` | keep | the basics |
| `advanced_search` | keep | the only search with a time filter |
| `research` | keep | one call for a multi-source evidence pack |
| `platform_search` | as needed | only for in-site content (GitHub, Bilibili, Zhihu…) |
| `weather` | as needed | a dedicated source answers weather better |
| `multi_search` | optional | overlaps `advanced_search` |
| `cache_search` | optional | pays off only when re-reading the same pages |
| `free_search_test` | optional | a diagnostic, not an answer path |
| `video_search` | optional | answers rarely need video results |
| `domain_search` | optional | vertical lookups, for specialist questions |

Measured: keeping 7 tools costs 3.3 KB of schema, 72% below the 11.7 KB of all 17.
