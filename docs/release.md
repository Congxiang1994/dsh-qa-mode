# 发布方式

> 一行命令跑完整条链；任何一步证明不了就非 0 退出——「跑过了」不等于「发出去了」。

## 一条命令发版

```sh
./scripts/release.sh          # 补丁版本：1.0.1 → 1.0.2
./scripts/release.sh minor    # 次版本
./scripts/release.sh 1.2.0    # 指定版本
```

脚本按顺序做完：

1. 检查工作区干净，bump 版本号（已发布过的版本永久占位，不能复用）
2. `npm run check` + `verify-session --self-test`
3. `git commit` + `v<版本>` tag + `git push`
4. `npm publish`
5. 轮询 registry 确认该版本可下载且 `dist-tags.latest` 指向它
6. 请求 npmmirror 同步并确认
7. 跑 `node scripts/check-indexes.mjs` 复核五个索引源
8. 打印本机同步提示

两个已知坑都写进脚本了：

- npm 打印的 `+ 包名@版本` 不代表能下载，registry 可能短期保留；脚本直接查 `registry.npmjs.org/<pkg>/<version>` 并核对 `dist-tags.latest`。
- npmmirror 是独立计数的一路，不是代理，必须显式 `PUT /-/package/<pkg>/syncs` 才会同步。

npm 调用一律带 `--cache`（默认放 `$TMPDIR`），因为沙箱里 `~/.npm` 可能只读，npm 会在联网前就失败。npm token 只放在 `~/.dsh/.secrets/npm_token`（mode 600），通过一次性 userconfig 传入，不进 argv、不进 history。

只想发 npm（不提交、不验活）时用 `./scripts/publish.sh`。

## 五个索引源：每次发版都复核

| # | 索引 | 收录机制 | 发版时要做什么 |
|---|---|---|---|
| 1 | `https://cdn.dsh.so/market/index.json` | 官方索引器从 npm 自动重建 | 等重建 + 复核版本；查不到若因索引器阈值/延迟，记入汇报，不当失败 |
| 2 | `https://cdn.dsh.so/market/top-rank.json` | 官方榜单子集（16065 个插件里的一小部分） | 复核即可；没进榜不代表发布失败 |
| 3 | `https://dshopen.org/index.json` | `polang233/dsh-plugin-index` issue + npm 自动重建 | 已登记（#804）；复核条目在、版本跟随 latest |
| 4 | `https://api.dshfind.com/market/dsh-index.json` | 每日从 GitHub `dsh-plugin` topic 同步；topic 搜索超 1000 上限会截断漏仓 | 已提 PR 把仓库加进 `MANUAL_REPOS`（hikariming/dshfind#96）；复核条目在、版本对得上 |
| 5 | `https://xivie-a.github.io/dsh-market/index.json` | 人工审核，issue 申请收录，每 6 小时重建 | 已提 issue（xivie-a/dsh-market#1）；复核条目在、版本跟随 latest |

复核脚本：

```sh
node scripts/check-indexes.mjs              # 逐行打印五个源状态（absent 是正常可出现状态）
node scripts/check-indexes.mjs --strict     # 任一源 absent / 滞后即非 0
node scripts/check-indexes.mjs --self-test  # 注入式验证判定逻辑，不联网
```

判定标准：五个源逐一报出 `listed@<版本>` 或 `absent`；`absent` 时判断是「未登记」（源 3/4/5：去补 issue/PR）还是「索引器阈值/延迟」（源 1/2：记录并等待）。**发布是否成功只看 npm `dist-tags.latest`，索引滞后不算失败。**

其他曾登记过的源：[awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 的 PR #18920 只加了 `data/plugins/Congxiang1994__dsh-qa-mode.yml`（README 由脚本生成，不要手改），等维护者合并。`www.dsh.so/api/submit` 只收索引器内部完整 schema，外部调不通，不要照着报错凑字段。

## 发完版还要同步本机

发布不等于本机在跑新代码：profile 会一直用**它安装的那个版本**，npm 上更新了也不会自己换。每次影响行为的改动，发完版都要把本机换成新版本，否则调试的是旧逻辑。

```
plugin_manager  remove_bundle   target: dsh-qa-mode
plugin_manager  install_bundle  target: dsh-qa-mode@<版本>
```

必须带版本号：`install_bundle` 指向本地目录会装成 `link:` 软链，指向裸包名会命中 `already-installed`；先 remove 再按精确版本装，才是 registry 上的真实目录。

装完核对三件事：

- `~/.dsh/profiles/desktop/package.json` 里是 `"dsh-qa-mode": "<版本>"`，不是 `link:`
- `node -e "console.log(require('.../node_modules/dsh-qa-mode/package.json').version)"` 等于新版本
- `plugin_manager` `list_plugins` 里 `preset-qa` 的 `fiberPhase` 是 `active`

已开着的会话不会热切换，要新开会话才会用上新 preset。

## 收尾汇报清单

版本号、`dist-tags.latest` 实测值、npmmirror 状态、五个索引源状态、本机 profile 装的版本、commit hash。清掉本轮临时文件与后台任务。
