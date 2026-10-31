# 预设对照与逐插件说明

本文回答两个问题：**dev-team 和 DSH 内置的预设有什么不同**，以及 **dev-team 的 `plugins` 里每一行在干什么**。

---

## 一、内置预设 vs dev-team

DSH Web 的内置预设由 `@deepseek-ai/dsh-web-app` 组合包的 `presets/*.patch.yml` 提供，各有定位：

| 预设 | id | order | 定位 | 与标准的实质差异 |
|---|---|---|---|---|
| 标准 | `standard` | 1 | 默认编码代理 | —（基准） |
| PTC | `ptc` | 2 | 代码工作工具开启时可用 | 只多一行 `tool-presentation`，其余与标准完全一致 |
| 极简 | `minimal` | 3 | 最小工具面 | 只保留 11 行：persona、tool-fs、compaction 组、persistent-shell/pty 与四个持久 shell 工具 |
| 创造 | `cordis` | 4 | 写 Cordis 插件专用 | persona 换成一句、多 `tool-cordis`、`skill-filesystem` 挂包内 skills、plugin 工具改为按 profileContext 条件禁用 |
| **软件开发团队** | **`dev-team`** | **3** | **多角色协作** | **只换 `persona` 一行（103 字符 → 894 字符的团队章程），其余 32 行与标准逐字相同** |

> `order` 只影响列表排序。dev-team 用了 `3`，与内置「极简」同序；想单独排到最后可改成 `5`。

（"实质差异"按归一化比对得出：忽略缩进与引号风格后，`ptc` 只多 `tool-presentation` 一行；`minimal` 除预设行外只保留 11 行；`cordis` 见上表。）

### dev-team 与「标准」的结构性差异

逐行归一化比对（忽略缩进与引号风格）后结论很干净：

- 两边都是 **33 行子插件，行 id 完全相同**；
- 归一化后内容不同的只有 **`persona` 一行**（`plan-mode` 那行只差引号风格，语义一致）；
- `standard` 的 `persona` 是一句 `You are a coding agent powered by the {{model}} model.`（103 字符），dev-team 是整份团队章程（894 字符，见 [../persona-dev-team.md](../persona-dev-team.md)）。

也就是说：**dev-team = 标准的完整工具面 + 一份团队协作人格，除此之外没有任何结构差异。** 它不加减任何工具、不改任何阈值；`skill-filesystem`、`tool-plugin-manager`/`tool-plugin-market`（均 `disabled: true`）、`tool-web` 等配置与 standard 逐字相同。

（顺带一句：给 `skill-filesystem` 挂 `customSkillDirs`、启用 `tool-cordis` 的是「创造」预设 `cordis`，不是标准，也不是 dev-team。）

**团队能力从哪来**：来自 profile 层的 Teams 组合包，**不在预设的 `plugins` 里**。这正是它只需一个 YAML 块就能交付的原因。

---

## 二、dev-team 逐插件说明

| 行 id | 插件 | 作用 |
|---|---|---|
| `persona` | `@deepseek-ai/dsh-persona` | 团队章程（`prefix` 块标量）。`{{model}}` 为运行时注入的模型名 |
| `agent-instructions` | `@deepseek-ai/dsh-agent-instructions` | 指令体量上限 `maxBytes: 65536` |
| `time-context` | `@deepseek-ai/dsh-time-context` | 注入当前时间上下文 |
| `tool-bash` | `@deepseek-ai/dsh-tool-bash` | bash 工具；**Windows 上禁用**（`!!js process.platform === 'win32'`） |
| `tool-pwsh` | `@deepseek-ai/dsh-tool-pwsh` | PowerShell 工具；**非 Windows 禁用**。两个开关保证任一平台恰好一个 shell 工具在线 |
| `tool-fs` | `@deepseek-ai/dsh-tool-fs` | 文件读写 |
| `tool-fs-search` | `@deepseek-ai/dsh-tool-fs-search` | 搜索；`sampleOverCapGlobResults: false` 关闭超量结果抽样，避免漏文件 |
| `tool-jobs` | `@deepseek-ai/dsh-tool-jobs` | 后台任务 |
| `tool-schedule` | `@deepseek-ai/dsh-tool-schedule` | 定时/提醒 |
| `skill-filesystem` | `@deepseek-ai/dsh-skill-filesystem` | 技能目录挂载 |
| `tool-skill` | `@deepseek-ai/dsh-tool-skill` | 技能调用 |
| `command-goal` | `@deepseek-ai/dsh-command-goal` | 目标命令 |
| `tool-goal` | `@deepseek-ai/dsh-tool-goal` | 目标工具（跨轮续跑） |
| `planning` | `cordis:group` | 计划模式组；`isolate.planMode` 隔离 realm，内含 `dsh-plan-mode` 及其 `section`（计划模式规则全文） |
| `compaction` | `cordis:group` | 压缩组；`isolate` 含 `compaction` 与 `toolResultPruner`，内含基础压缩、`/compact` 命令、工具结果修剪器（阈值 8192 / 头 4096 / 尾 1024） |
| `delegation` | `cordis:group` | 委派组；`isolate.workflowEngine`，内含 subagent 控件、`subagent`、`subagent_fork`、`workflow-ptc`、`tool-workflow` |
| `tool-ask-user` | `@deepseek-ai/dsh-tool-ask-user` | 提问工具 |
| `tool-todo` | `@deepseek-ai/dsh-tool-todo` | 待办；`allowParallelInProgress: true` 允许多项同时 in_progress |
| `tool-web` | `@deepseek-ai/dsh-tool-web` | 联网；`fetch: true`，搜索超时 60s |
| `present` | `@deepseek-ai/dsh-tool-present` | 交付物卡片 |
| `tool-plugin-manager` | `@deepseek-ai/dsh-plugin-manager/tools` | 禁用 |
| `tool-plugin-market` | `@deepseek-ai/dsh-plugin-market/tools` | 禁用 |

### 关于 `delegation` 组的一个注意点

预设里保留了 `tool-subagent` / `tool-subagent-fork` 等行，但**桌面 profile 的 Teams 组合包会把这些行 `disabled: true`**，并插入 Teams 包。所以团队模式下：

- 看不到 `subagent` / `subagent_fork`（被组合包禁用）；
- 看到 `spawn_teammate` / `send_message` / `list_agents` / `wait_agent` / `interrupt_agent` / `team_task_*`（由 Teams 包提供）。

这不是预设的疏漏，而是分层设计的结果：**预设管"我是谁"，组合包管"我有哪些协作工具"**。

---

## 三、与 `zcode/` 交付物的差异

本仓库另有一份同主题交付物（`zcode/` 目录，ZCode 本地插件市场），两者不是同一机制，也不互相依赖：

| | 本目录（DSH 预设） | `zcode/software-dev-team`（ZCode 插件） |
|---|---|---|
| 载体 | 一个 Agent 预设声明（YAML patch 行） | 一个本地插件市场 + 插件源码 |
| 安装 | 追加到 profile `cordis.patch.yml` | 添加市场源 → 安装插件 |
| 入口 | 选中「软件开发团队」预设后自然语言对话 | 斜杠命令 `/dev-team`、`/dev-team-fast` |
| 编排 | Lead + persona 指挥 Teams 工具 | DWF 工作流流水线，七/六阶段确定性推进 |
| 文档产出 | `docs/requirements/`、`docs/design/` | `docs/dev-team/prd.md`、`docs/dev-team/design.md` |
| 质量门禁 | QA 按验收标准验证，Lead 亲自跑测试 | 确定性检查命令 + QA 集成验收 |
| 团队成员 | pm / architect / dev / qa（Lead 之下） | 交付总监 + 产品经理 / 架构师 / 工程师 / QA |

**怎么选**：要的是"一个会自己组队干活的会话"→ 用本预设；要的是"一条可重复、可审计、阶段边界清晰的流水线"→ 用 ZCode 插件。两者可以同时存在，互不干扰。
