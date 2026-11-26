# 代码仓架构

## 目录树

```
dsh-qa-mode/
├── package.json              # 清单：dsh.bundle.patch 指向 patch；版本 /  engines / files
├── cordis.patch.yml          # 唯一的运行时声明：插入一个 preset 行（含完整人格提示词）
├── locale/
│   ├── zh.json               # 插件列表里的中文标题与描述
│   └── en.json
├── icon.svg                  # 插件图标
├── README.md                 # 主 README（简体中文）：亮点 + 入口
├── README.en.md              # 主 README（English）
├── LICENSE                   # MIT
├── docs/                     # 拆分文档：按主题按需阅读
│   ├── architecture.md / architecture.en.md   # 架构设计
│   ├── technical.md / technical.en.md         # 技术实现
│   ├── release.md / release.en.md             # 发布方式
│   ├── development.md / development.en.md     # 开发方式
│   └── repository.md / repository.en.md       # 本文
├── scripts/
│   ├── validate.mjs          # 校验 manifest + patch + locale + icon + 文档引用 + 提示词原文
│   ├── verify-session.mjs    # 行为校验：读真实会话日志，验证工具集与提示词预算
│   ├── check-indexes.mjs     # 复核五个插件索引源的收录与版本
│   ├── release.sh            # 一条命令发版：bump → 校验 → 提交打 tag 推送 → npm 发布 → 验活 → 同步镜像 → 索引复核
│   └── publish.sh            # 只发 npm（不提交、不验活），日常手动用
└── .github/workflows/
    └── checks.yml            # push / PR 自动跑校验
```

## 关键文件

**`package.json`**：`dsh.bundle.patch` 指向 `cordis.patch.yml`，这是它成为可安装 bundle 的根本。`engines.dsh` 限定 DSH 版本范围；`files` 决定 npm 包里带哪些文件（主 README 与 docs 都随包发布）。

**`cordis.patch.yml`**：整个插件的全部「运行时逻辑」就是这一个 insert 行——往 Loader 里插入 `@deepseek-ai/dsh-agent-preset`。**没有 `index.js`，没有运行时代码，没有运行时依赖。** 所有工具约束、提示词、检索上限都在这一个声明里。

**`docs/`**：主 README 刻意只保留亮点和导航；架构、技术、发布、开发、仓库各自的细节拆成独立文档，中英成对。校验脚本会检查提示词原文在中英文文档里的一致性，避免拆分后漂移。

**`scripts/`**：`validate.mjs` 管「声明对不对」，`verify-session.mjs` 管「跑出来对不对」，`check-indexes.mjs` 管「发出去对不对」，`release.sh` 把三者串成一条发版链。

## 设计原则

1. **零运行时代码**：能声明式解决就不写 JS，减少安装体积和出错面。
2. **宿主负责 provider**：本插件不消费任何搜索服务配置，检索能力随宿主 profile 自然变化。
3. **文档分层**：主文件扫一眼就懂亮点，细节按需点开；中英同步、提示词逐字校验。
4. **验证要能证伪**：自检用注入的坏样本，发布以 registry 的 `dist-tags.latest` 为唯一准绳。
