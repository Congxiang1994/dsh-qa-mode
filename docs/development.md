# 开发方式

## 快速开始

```sh
npm install
npm run check     # 声明校验：manifest、patch 行结构、preset 子插件、locale、icon、文档引用与提示词原文
npm run verify    # 行为校验：读本机最近的问答模式会话，核对工具集、提示词与请求体积
```

两个命令都非 0 退出失败。

## 两层校验，缺一不可

**`npm run check`（`scripts/validate.mjs`）** 证明声明是合式的。它校验manifest、patch 结构、preset 的 order/插件列表、locale、icon，并逐字核对中英文文档引用的系统提示词与 `cordis.patch.yml` 一致。但它证明不了声明真的产出了承诺的组合——预设按「活下来的行」装配，行写错了也照样装得上。

**`npm run verify`（`scripts/verify-session.mjs`）** 补这一段：读 `~/.dsh/sessions/` 里最近一次问答模式会话的真实 `request/header` 与系统提示词，断言四件事：

- 会话确实跑的是 `qa` 预设
- 只读工具在、任何写文件/执行/委派工具都不在
- 人格里的关键规则真的到了模型手上
- 请求体积仍在预算内（系统提示词 < 3000 字符、工具 schema < 14000 字节、工具数 ≤ 20）

`npm run verify -- --all` 检查全部历史问答会话。

## 注入式自检

`--self-test` 用故意构造的坏样本证明断言真的会失败——只看「全绿」看不出检查是否咬合：

```sh
node scripts/verify-session.mjs --self-test
node scripts/check-indexes.mjs --self-test   # 索引判定逻辑，不联网
```

`release.sh` 每次发版都会跑 verifier 的 self-test。

## 硬约束

- **纯声明式，零运行时代码**：不要加 `index.js` 或运行时依赖。唯一的运行时声明是 `cordis.patch.yml` 里那一行 `@deepseek-ai/dsh-agent-preset`。
- **不 pin `searchProvider`**：写死 provider id 会在该插件被禁用时悬空，所有检索报 `configured web provider is not registered`。
- 保留 `package.json` 的 `author` 字段，插件市场靠它显示作者。
- npm 调用带 `--cache` 到 `$TMPDIR`；非交互脚本不依赖 `.bashrc`。
- 改完就发布，项目有常驻授权，流程见[发布方式](release.md)。

## 文档结构

主 README 只讲亮点；设计取舍按主题拆在 `docs/`：

| 文档 | 内容 |
|---|---|
| [架构设计](architecture.md) | 模式定位、挂载行、检索来源、提示词原文、边界 |
| [技术实现](technical.md) | 请求体积压缩、并发边界、工具精简 |
| [发布方式](release.md) | 发版脚本、索引源、本机同步 |
| [开发方式](development.md) | 本文 |
| [代码仓架构](repository.md) | 目录树与各文件职责 |

中英文文档成对维护，validate 会检查提示词原文一致性。
