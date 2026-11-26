# AGENTS.md — dsh-qa-mode

DSH 会自动加载本工作区的这个文件。这里只放「每次都照做」的规则；详细背景在
`~/.dsh/memory/projects/dsh-qa-mode.md`。

## ⭐ 每次开发 / 优化完，直接发布，不要问

用户已给本项目常驻授权：**改完就发布**，包括公开发布 npm 与插件市场。不要停下来征求同意。

发布 = 这四步全做完，少一步都不算发完：

1. 改版本号（npm 上已发布过的版本号永久占位，不能复用）
2. `npm run check` 通过
3. `git commit` + `v<版本>` tag + `git push`
4. `./scripts/release.sh` 完成 npm publish → 验活 → 同步 npmmirror

```sh
./scripts/release.sh          # 补丁版本
./scripts/release.sh minor    # 次版本
./scripts/release.sh 1.2.0    # 指定版本
```

该脚本按顺序做完 bump → 校验 → 提交打 tag 推送 → 发布 → 轮询 registry 确认该版本可下载
且 `dist-tags.latest` 指向它 → 请求 npmmirror 同步并确认 → 打印两个插件索引的收录状态。
**任一步证明不了就非 0 退出。**

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

## 插件源（都只需登记一次，之后跟随 npm 自动重建）

| 源 | 方式 |
|---|---|
| npm | `release.sh` 自动 |
| npmmirror | `release.sh` 自动同步 |
| [dsh.so](https://www.dsh.so/) | `POST https://www.dsh.so/api/submit`，`category` 只收 `tool｜skill｜storage｜resource` |
| [dshopen.org](https://dshopen.org/) | 在 `polang233/dsh-plugin-index` 开 issue（用 `plugin-add.yml` 模板） |
| [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) | PR 只加一个 `data/plugins/Congxiang1994__dsh-qa-mode.yml`；不要改 README（由脚本生成） |

## 收尾

汇报：版本号、`dist-tags.latest` 实测值、npmmirror 状态、索引收录状态、commit hash。
清掉本轮临时文件与后台任务。
