<h1 align="center">dsh-qa-mode</h1>

<p align="center">
  <strong>问问题，拿答案，不动代码。</strong><br>
  DeepSeek Harness 的第五个模式：更少工具、更短上下文、更快的问答。
</p>

<p align="center">
  <a href="https://github.com/Congxiang1994/dsh-qa-mode"><img src="https://img.shields.io/badge/dsh-%3E%3D0.2.2--rc.3%20%3C0.4.0--0-4D6BFE?style=flat-square" alt="dsh"></a>
  <a href="https://www.npmjs.com/package/dsh-qa-mode"><img src="https://img.shields.io/npm/v/dsh-qa-mode?style=flat-square" alt="npm"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-378ADD?style=flat-square" alt="license"></a>
  <a href="https://github.com/Congxiang1994/dsh-qa-mode/actions/workflows/checks.yml"><img src="https://img.shields.io/github/actions/workflow/status/Congxiang1994/dsh-qa-mode/checks.yml?style=flat-square" alt="checks"></a>
  <a href="https://github.com/Congxiang1994/dsh-qa-mode"><img src="https://img.shields.io/github/stars/Congxiang1994/dsh-qa-mode?style=flat-square&color=FBBD16" alt="stars"></a>
</p>

<p align="center">
  <strong>简体中文</strong> · <a href="README.en.md">English</a>
</p>

---

## 🤔 这是什么

你有时候只是想**问个问题**——查个资料、核对一个事实、搞清楚某个概念——并不需要 AI 帮你改代码、跑命令、开一堆子代理。但标准模式下，这些开发用的工具全挂在上下文里，又重又慢。

`dsh-qa-mode` 给 DeepSeek Harness 加了一个「**问答模式**」：它把开发相关的工具全部拿掉，只留下**联网检索、网页抓取和只读文件**，让 AI 专心回答问题。你在模式下拉里选它，问完就走，全程不碰你的代码。

<details>
<summary><strong>📌 一句话与关键数字</strong>（点开看技术概括与文档索引）</summary>

> **一句话**：给 DSH 加一个「问答模式」——只保留联网检索和只读文件工具，把请求从 **44 个工具 / 42 KB schema** 压到 **8 个工具 / 2 KB**，系统提示词 **6.1 K → 1.2 K 字符**；在模式下拉里一键切换，问完就走。
>
> 想深入？设计取舍、实现细节和工程流程按主题拆开，按需阅读：
>
> | 想了解什么 | 文档 |
> |---|---|
> | 模式长什么样、挂了哪些行、检索从哪来、提示词原文、边界 | [架构设计](docs/architecture.md) |
> | 请求体积怎么压下来的、并发怎么组织、工具怎么再精简 | [技术实现](docs/technical.md) |
> | 一条命令发版、五个索引源、发完怎么同步本机 | [发布方式](docs/release.md) |
> | 校验与行为验证、开发命令 | [开发方式](docs/development.md) |
> | 目录树与各文件职责 | [代码仓架构](docs/repository.md) |

</details>

## ⚡ 核心亮点

| 亮点 | 做了什么 | 实测效果 |
|---|---|---|
| **更少的工具** | 只挂检索、抓取、只读文件；不挂终端、写文件、子代理、工作流、技能 | 工具数 **44 → 8**（装免费搜索时 17，关掉冗余检索可到 7） |
| **更短的上下文** | 完整问答人格替代编码 Agent 提示词；收紧检索/抓取上限并裁剪超长结果 | schema **42.1 KB → 2.0 KB**，提示词 **6.1 K → 1.2 K** 字符；每轮重复省 |
| **更快的问答** | 提示词要求独立检索在同一条回复并发发起，一次调用可带多个 query | 总耗时取决于最慢的一路，不再是各路相加；少轮次、少犹豫 |
| **模式快速切换** | 以 `order: 1.5` 插入模式下拉的第二格（标准与 PTC 之间），不动任何内置预设 | 下拉选「问答模式」即可，无需改配置、无需改代码 |
| **零运行时代码** | 纯声明式插件，只往 Loader 插一行 preset 声明，没有 `index.js` | 安装即用，无额外依赖、无运行时开销 |
| **不烧检索额度** | 不声明 provider，检索走宿主 profile 当前选择的服务 | 装了 `dsh-free-search` 就走免 key 引擎，不消耗 DeepSeek 检索额度 |

一句话概括：**工具更少 → 上下文更短 → 问答更快 → 切换更顺手**，全程不碰你的代码。

## 🚀 快速开始

```sh
dsh plugin --profile <你的 profile> add dsh-qa-mode
```

新开一个会话，在模式下拉里选「**问答模式**」。

> 已经开着的会话不会热切换——会话的插件组合在创建时就固定了。卸载用 `dsh plugin --profile <你的 profile> remove dsh-qa-mode`。

## ⭐ 觉得有用？点个 Star

如果这个插件帮你省了上下文、少等了几轮检索，去 **[GitHub 仓库](https://github.com/Congxiang1994/dsh-qa-mode)** 点个 Star 吧——一颗星能让更多 DSH 用户发现它，也让我更有动力继续维护。

[Star on GitHub ⭐](https://github.com/Congxiang1994/dsh-qa-mode)

## 许可证

[MIT](LICENSE)
