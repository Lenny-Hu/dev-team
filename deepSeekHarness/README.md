# 软件开发团队（dev-team）· DeepSeek Harness Agent 预设交付说明

本目录是 **DeepSeek Harness**（DSH）桌面上那个「软件开发团队」Agent 预设的完整交付物：一份可复用的配置 + 一份可复现的安装方式 + 一份把团队怎么跑起来的说明。

一句话说明它是什么：**给 DSH 装上一个叫「软件开发团队」的 Agent 预设（preset id = `dev-team`），装完之后，一个会话里就有一支由研发 Lead 带队的四人小队——产品经理定需求与验收标准、架构师出方案并拆任务、工程师并行写代码、QA 按验收标准验证；遇到小需求则自动切快速模式，不组队，Lead 直接做完。**

> 配置来源：本机桌面 profile 的 patch 层 `%USERPROFILE%\.dsh\profiles\desktop\cordis.patch.yml`（该文件里的 `preset-dev-team` 声明与 `agent-preset-registry` 选中项）。**逐字节原样导出，未做任何改动。**

---

## 一、目录清单

```text
deepSeekHarness/
├── README.md                     ← 本文：安装、使用、验证、卸载、常见问题
├── preset-dev-team.patch.yml     预设声明本体（原样导出的 `- insert:` 块，可直接粘贴/喂给 --patch）
├── persona-dev-team.md           团队章程（persona）原文，便于单独阅读与改写
├── install.ps1                   一键安装：幂等，写前自动备份
├── uninstall.ps1                 一键卸载：干净还原，写前自动备份
└── reference/
    ├── preset-catalog.md         内置预设对照表 + dev-team 逐插件说明 + 与 ZCode 版的差异
    └── mechanism.md              DSH 预设机制笔记：分层优先级、行 id、生效时机、为什么这么装
```

**最小安装只需要一个文件**：`preset-dev-team.patch.yml`。脚本是为了让"粘贴"这一步变安全（幂等 + 备份）而存在的。

---

## 二、安装

### 前置条件

| 条件 | 说明 |
|---|---|
| DeepSeek Harness 桌面版 | 预设装在桌面 profile（`~/.dsh/profiles/desktop/`）的 patch 层 |
| profile 已启用 Agent Teams | 桌面 profile 默认带 `@deepseek-ai/dsh-experimental-agent-team-profile` 组合包；`spawn_teammate` / `team_task_*` / `send_message` 等 9 个团队工具由它提供，**不在本预设的 `plugins` 里**。缺失时预设能装上但没有团队工具（见下） |

确认 Teams 组合包在位：

```powershell
# 期望输出里包含 @deepseek-ai/dsh-experimental-agent-team-profile
Get-Content "$env:USERPROFILE\.dsh\profiles\desktop\package.json"
```

### 方式 A：脚本安装（推荐）

在本目录下执行（PowerShell）：

```powershell
pwsh -File .\install.ps1
```

脚本会依次做：定位 profile → 备份 `cordis.patch.yml` → 若尚不存在则追加预设声明（带标记注释）→ 把 `agent-preset-registry` 的 `selectedDefault` 设为 `dev-team`。**幂等**：重复执行不会装出第二份（重复的 preset id 会让声明加载失败，这正是幂等的原因）。

常用参数：

```powershell
pwsh -File .\install.ps1 -Profile web          # 装到另一个 profile
pwsh -File .\install.ps1 -NoSetAsDefault       # 只装预设，不改默认选中项
pwsh -File .\install.ps1 -DshHome D:\some\.dsh # 指定 DSH home（默认 %USERPROFILE%\.dsh）
pwsh -File .\install.ps1 -WhatIf               # 预演，不落盘
```

### 方式 B：手工安装

1. 打开 `%USERPROFILE%\.dsh\profiles\desktop\cordis.patch.yml`，**先备份**；
2. 把 [preset-dev-team.patch.yml](preset-dev-team.patch.yml) 里 `- insert:` 起的整段粘贴到文件末尾；
3. 找到 `- id: agent-preset-registry` 条目，在其 `config:` 下补一行 `    selectedDefault: dev-team`（没有该条目就照 [reference/mechanism.md](reference/mechanism.md) 的说法新增一条）；
4. 保存。DSH 正在运行时，profile patch 的改动通常会被实时重载；没生效就重启应用。

### 方式 C：命令行 overlay（适合非桌面 profile 或临时试用）

DSH 启动器支持 `--patch` 覆盖层，可重复传入：

```powershell
dsh --profile web --patch .\preset-dev-team.patch.yml
```

> `desktop` profile 由 Electron 独占管理，`dsh --profile desktop ...` 会被拒绝（`profile "desktop" is managed exclusively by the Electron application`），所以桌面版只能用方式 A/B。

### 生效时机与验证

- **新会话**用当前默认预设；**已有会话**保持创建时的组合，不回溯。
- 打开「**设置 → Agent 预设**」：内置卡片（标准 / 创造 / 极简 / PTC）之后应出现「自定义」分组，内含「**软件开发团队**」卡片，卡上有「查看配置」可只读打开这段 YAML。
- 新建任务页的模式选择器应显示「软件开发团队」，并作为默认选中。

---

## 三、使用

### 3.1 团队怎么跑（Lead 视角）

预设有两层指挥：**预设的 persona**（团队章程，见 [persona-dev-team.md](persona-dev-team.md)）定角色与流程；**Teams 组合包的 team 策略**定工具语义（共享 cwd、任务 CAS、inbox 投递、Lead 等待责任）。两者叠加，产出下面的行为。

| 阶段 | 谁 | 干什么 | 写范围 |
|---|---|---|---|
| 澄清 | Lead | 先澄清目标与成功标准，再交给 pm | — |
| 需求 | pm | 拆用户故事、定验收标准 | 只写 `docs/requirements/` |
| 方案 | architect | 技术方案、模块划分、接口设计、拆实现任务 | 只写 `docs/design/` |
| 实现 | dev ×N | 从共享任务板 claim 任务，按分配的文件前缀并行写代码 | 各自前缀，互不重叠 |
| 验证 | qa | 按验收标准设计用例、验证与回归 | 只写 `tests/` |
| 收口 | Lead | 复查最终 diff、亲自跑测试、汇总各角色结论 | — |

任务依赖用 `blocked_by` 表达；任务认领与更新必须带 `expected_revision`，过期修订会被拒绝（compare-and-set），防止两个成员互相覆盖。

### 3.2 何时组队，何时别组队（快速模式）

- **组队**：需求跨越两个以上模块，或存在两个以上可并行的独立子任务。
- **快速模式**：单文件、小改动、无需设计决策 → Lead 不组队，自己直接做完。

拿不准就用完整模式。**这一条是成本控制的关键**：Teams 的每次成员请求都带固定策略与 schema 开销，纯小需求走团队模式纯属浪费。

### 3.3 你可以怎么使唤它

直接用自然语言下需求即可，不用记命令。例如：

```text
给这个 CLI 加一个 export 子命令：支持 csv/json 两种格式，带单元测试，并更新 README
```

预期能看到：Lead 先澄清 → spawn_teammate 建 pm/architect/dev/qa → `docs/requirements/`、`docs/design/` 落文件 → 任务板上出现带依赖关系的任务 → 工程师并行 claim 实现 → QA 按验收标准验证 → Lead 复查 diff 与测试后汇总。

也可以直接点名要人：

```text
创建一个叫 reviewer 的 teammate 检查 diff，再把变更摘要发给它
```

### 3.4 九个团队工具速查

| 工具 | 用途 |
|---|---|
| `spawn_teammate` | 建 teammate（名字、描述、初始任务）；仅 Lead 可调 |
| `send_message` | 定向沟通；steer 运行中的成员 / 唤醒 inactive 成员 |
| `list_agents` | 看 roster：`running` / `inactive` / `provisioning` / `failed` |
| `wait_agent` | 等下一次团队变化，别轮询；无成员可产出时立即返回 `noProgress` |
| `interrupt_agent` | 停掉某个 teammate 当前轮次，保留其 inbox；仅 Lead 可调 |
| `team_task_create` / `list` / `get` / `update` | 共享任务板：建、览、读、改（claim/complete/reopen） |

> `inactive` 只表示"此刻没有轮次在执行"，**不代表任务完成**。任务完成看任务板状态，不看成员状态。

---

## 四、卸载

```powershell
pwsh -File .\uninstall.ps1
```

删除预设声明块（带标记的整块删；手工装的则按 `id: preset-dev-team` 删整条 `- insert:` 条目，并清掉紧贴上方的孤儿注释），同时把 `agent-preset-registry` 的 `selectedDefault` 复位。写前同样自动备份。

参数：`-KeepDefault`（保留默认选中项）、`-Profile`、`-DshHome`、`-WhatIf`。

不删的东西：profile 的 `package.json`、bundle 列表、其他预设、你的模型与界面配置。

**完全回滚**：直接还原脚本留下的 `cordis.patch.yml.bak-<时间戳>` 备份即可；安装前的原始状态也有现成参照——本机 `~/.dsh/profiles/desktop/cordis.patch.yml.bak-before-dev-team` 就是装 dev-team 之前的那份。

---

## 五、常见问题

**Q：装上了，但「设置 → Agent 预设」里没有「软件开发团队」卡片？**
先看 `cordis.patch.yml` 里 `id: preset-dev-team` 是否真的在、缩进是否正确（`- insert:` 顶格，其下条目缩进 4 空格）；再看 profile 是否重启过。重复的 preset id 会让声明整体加载失败——如果你曾在两个地方各贴了一份，删掉多余的那份。

**Q：有卡片但没有 spawn_teammate / team_task_* 工具？**
Teams 组合包没启用。确认 profile `package.json` 的 `dsh.profile.bundles` 里有 `@deepseek-ai/dsh-experimental-agent-team-profile`。注意该组合包会**禁用**旧的 `subagent` / `subagent_fork` 工具，所以团队模式下看不到它们，这是预期行为。

**Q：为什么 `order: 3` 会和内置「极简」撞号？**
排序仅影响列表位置，不影响功能；两个预设同序时展示顺序由其它字段兜底。想让它排在最后，把 `preset-dev-team.patch.yml` 里的 `order: 3` 改成 `5` 再装。

**Q：改团队章程（persona）会立刻生效吗？**
`persona-dev-team.md` 只是给人看的副本；真正生效的是 `preset-dev-team.patch.yml` 里 `config.prefix` 的块标量内容。改它需要同步改 YAML（注意 `|` 块标量的缩进要对齐），然后等 profile 重载或重启，**且只对新会话生效**。

**Q：和仓库里 `zcode/` 那个「软件开发团队」是一回事吗？**
不是。`zcode/` 是 ZCode 的本地插件市场交付物（`/dev-team`、`/dev-team-fast` 斜杠命令 + DWF 工作流流水线）；本目录是 DeepSeek Harness 的 Agent 预设（preset + persona + Teams 工具），两者目标相同、机制不同，没有依赖关系。详见 [reference/preset-catalog.md](reference/preset-catalog.md) 的差异对照。

**Q：预设安全吗？**
预设不是沙箱。preset YAML 里的 `!!js` 表达式会执行 Host 代码，本导出的预设只用到 `process.platform` 判断（按平台开关 bash / pwsh 工具）。Teams 的 write scope 只是提示，Bash、formatter 和外部进程都能绕过——**Lead 必须自己看 diff 和测试结果再下结论**，这也是章程里的硬约束。

---

## 六、验收清单

按顺序做，全过即交付成立：

1. `pwsh -File .\install.ps1` 输出"已写入预设声明"（或"已存在 preset-dev-team，跳过写入"）；
2. 「设置 → Agent 预设」→「自定义」分组出现「软件开发团队」卡片，「查看配置」能只读打开本预设 YAML；
3. 新建任务的模式选择器默认指向「软件开发团队」；
4. 下一个跨模块需求（例如"加 export 子命令 + 测试 + README"），能观察到 `spawn_teammate`、任务板任务与四个角色的产出目录；
5. 再下一个单文件小需求，观察到 Lead **不**组队、直接完成（快速模式）；
6. `pwsh -File .\uninstall.ps1` 后卡片消失，`cordis.patch.yml` 还原为备份内容。

第 4、5 条是行为验收，也是这个预设真正的价值所在——**它会自己判断要不要组队**。
