# AGENTS.md — dsh-qa-mode

DSH 会自动加载本工作区的这个文件。这里只放「每次都照做」的规则；详细背景在
`~/.dsh/memory/projects/dsh-qa-mode.md`。

## ⭐ 每次开发 / 优化完，直接发布，不要问

用户已给本项目常驻授权：**改完就发布**，包括公开发布 npm 与插件市场。不要停下来征求同意。

发布 = 这五步全做完，少一步都不算发完：

1. 改版本号（npm 上已发布过的版本号永久占位，不能复用）
2. `npm run check` 通过
3. `git commit` + `v<版本>` tag + `git push`
4. `./scripts/release.sh` 完成 npm publish → 验活 → 同步 npmmirror
5. **把本机 profile 里的插件同步成刚发布的版本**

```sh
./scripts/release.sh          # 补丁版本
./scripts/release.sh minor    # 次版本
./scripts/release.sh 1.2.0    # 指定版本
```

该脚本按顺序做完 bump → 校验 → 提交打 tag 推送 → 发布 → 轮询 registry 确认该版本可下载
且 `dist-tags.latest` 指向它 → 请求 npmmirror 同步并确认 → 打印两个插件索引的收录状态。
**任一步证明不了就非 0 退出。**

### 第 5 步：本地同步（优化过项目就必须做）

只要这一轮改动会影响插件行为（`cordis.patch.yml`、`package.json`、locale、脚本），
发完版就要把本机正在用的插件换成新版本，否则本地跑的还是旧代码——"发布了"不等于
"本机在跑新逻辑"。只改 README 这类纯文档时，同步也可以顺带做。

做法（`plugin_manager`，两步，缺一不可）：

```
remove_bundle  target: dsh-qa-mode
install_bundle target: dsh-qa-mode@<刚发布的版本>
```

必须带版本号：`install_bundle` 指向本地目录会装成 `link:` 软链，指向裸包名会命中
`already-installed`；先 remove 再按精确版本装，才会得到 registry 上的真实目录。

装完**验证三件事**，不看退出码看实际状态：

- `~/.dsh/profiles/desktop/package.json` 里是 `"dsh-qa-mode": "<版本>"`，不是 `link:`
- `node -e "console.log(require('.../node_modules/dsh-qa-mode/package.json').version)"` 等于新版本
- `plugin_manager` `list_plugins` 里 `preset-qa` 的 `fiberPhase` 是 `active`

异步生效：已经开着的会话不会热切换，要新开会话才会用上新 preset。

## 硬约束

- **"跑过了" ≠ "发出去了"**：npm 打印的 `+ dsh-qa-mode@x.y.z` 不代表能下载。必须查
  `https://registry.npmjs.org/dsh-qa-mode/<版本>` 返回 200，并确认 `dist-tags.latest` 等于该版本。
- **npm 缓存可能只读**：沙箱里写 `~/.npm` 会被拒（报 `EPERM` / 提示 `sudo chown`，但**不是**权限归属问题）。
  所有 npm 调用必须带 `--cache` 到 `$TMPDIR`，否则 npm 在联网前就失败。`release.sh` 已内置。
- **纯声明式，零运行时代码**：不要加 `index.js` 或运行时依赖。唯一的运行时声明是
  `cordis.patch.yml` 里那一行 `@deepseek-ai/dsh-agent-preset`。
- **不 pin `searchProvider`**：写死 provider id 会在该插件被禁用时悬空，所有检索报
  `configured web provider is not registered`。
- 保留 `package.json` 的 `author` 字段：插件市场靠它显示作者。

## ⭐ 五个索引源：每次发版都要发布/复核（用户 2026-11-26 明确要求）

用户点名的五个索引源，**每次版本更新都要确保发布/登记到位**，不是"只需登记一次"。

| # | 索引 | 收录机制 | 每次发版要做什么 |
|---|---|---|---|
| 1 | `https://cdn.dsh.so/market/index.json` | dsh.so 官方索引器从 npm 自动重建；`www.dsh.so/api/submit` 只收内部完整 schema，外部调不通 | 等重建 + 复核 npm 版本；查不到若因索引器阈值/延迟，记入汇报，不当失败 |
| 2 | `https://cdn.dsh.so/market/top-rank.json` | 官方榜单子集（16065 个插件里的一小部分） | 复核即可；没进榜不代表发布失败 |
| 3 | `https://dshopen.org/index.json` | `polang233/dsh-plugin-index` issue + npm 自动重建 | 已登记（#804）；每次发版复核条目在、版本跟随 latest |
| 4 | `https://api.dshfind.com/market/dsh-index.json` | 每日从 GitHub `dsh-plugin` topic 同步；topic 搜索超 1000 上限会截断漏仓 | 已提 PR 把仓库加进其 `MANUAL_REPOS`（hikariming/dshfind#96）；每次发版复核条目在、npm 版本对得上 |
| 5 | `https://xivie-a.github.io/dsh-market/index.json` | 人工审核，issue 申请收录，每 6 小时重建 | 已提收录 issue（xivie-a/dsh-market#1）；每次发版复核条目在、版本跟随 latest |

**复核脚本**（发版后跑，验证五个源是否都收录、版本是否跟上 npm latest）：
```sh
node scripts/check-indexes.mjs              # 逐行打印五个源状态（absent 是正常可出现状态）
node scripts/check-indexes.mjs --strict     # 任一源 absent / 滞后即非 0，适合发版流程
node scripts/check-indexes.mjs --self-test  # 注入式验证判定逻辑，不联网
```
判定标准：五个源逐一报出 `listed@<版本>` 或 `absent`；`absent` 时判断是"未登记"（源 3/4/5：去补 issue/PR）还是"索引器阈值/延迟"（源 1/2：记录并等待）。**发布是否成功只看 npm `dist-tags.latest`，索引滞后不算失败。**

## 插件源（历史登记方式，供复核时参考）

| 源 | 方式 |
|---|---|
| npm | `release.sh` 自动 |
| npmmirror | `release.sh` 自动同步 |
| [dsh.so](https://www.dsh.so/) | 索引按 npm 自动重建，**无需提交**。`www.dsh.so/api/submit` 只收索引器内部完整 schema（`id`/`license`/`status`/`verifiedVersions`/`stars`…），外部调不通，不要照着报错凑字段 |
| [dshopen.org](https://dshopen.org/) | 在 `polang233/dsh-plugin-index` 开 issue（用 `plugin-add.yml` 模板）；已开 #804，等维护者 |
| [dshfind](https://dshfind.com/) | topic 抓漏时用 PR 把仓库加进 `scripts/sync-plugins-db.mjs` 的 `MANUAL_REPOS`；已开 hikariming/dshfind#96 |
| [xivie-a/dsh-market](https://xivie-a.github.io/dsh-market/index.json) | 用 `plugin-submit.yml` 模板提 issue；已开 xivie-a/dsh-market#1 |
| [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) | PR 只加一个 `data/plugins/Congxiang1994__dsh-qa-mode.yml`；不要改 README（由脚本生成）；已开 #18920，等合并 |

索引收录有延迟：刚发完版查 `cdn.dsh.so/market/index.json` 查不到是正常的，不要据此判断失败。
判断"发出去了"只看 npm 的 `dist-tags.latest`。

## 收尾

汇报：版本号、`dist-tags.latest` 实测值、npmmirror 状态、索引收录状态、**本地 profile 装的是哪个版本**、commit hash。
清掉本轮临时文件与后台任务。
