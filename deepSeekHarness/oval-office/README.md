# 椭圆形办公室（oval-office）· DeepSeek Harness Agent 预设交付说明

本目录是 **DeepSeek Harness**（DSH）桌面上那个「椭圆形办公室」Agent 预设的完整交付物：一份可复用的配置 + 一份可复现的安装方式 + 一份把白宫怎么跑起来的说明。它由本仓库 `zcode/oval-office`（ZCode 本地插件市场里的 `oval-office` 0.1.0）移植而来。

一句话说明它是什么：**给 DSH 装上一个叫「椭圆形办公室」的 Agent 预设（preset id = `oval-office`），装完之后，一个会话里你就是美利坚合众国总统——白宫幕僚层按美国宪政法定管辖权把事务路由到 24 个政府部门角色之一，输出 BLUF 简报、选项文件、行政令与危机推演。**

> 与 `zcode/` 原版的关系：内容（技能手册、5 份机制文档、24 张角色卡、4 个命令协议）原样移植；**派发机制按 DSH 工具改写**（ZCode 的 `oval-office:<角色>` 子代理类型 → DSH 的 `spawn_teammate` / `subagent` + 角色卡 prompt）。逐项映射见 [reference/port-map.md](reference/port-map.md)。

---

## 一、目录清单

```text
deepSeekHarness/oval-office/
├── README.md                     ← 本文：安装、使用、验证、卸载、常见问题
├── preset-oval-office.patch.yml  预设声明本体（persona + skill-filesystem 挂载 + 标准工具面）
├── persona-oval-office.md        白宫班底章程（persona）原文，便于单独阅读与改写
├── install.ps1                   一键安装：幂等，写前自动备份，自动修正技能挂载路径
├── uninstall.ps1                 一键卸载：干净还原，写前自动备份
├── skills/                       技能根目录（由 preset 的 customSkillDirs 挂载）
│   ├── oval-office/
│   │   ├── SKILL.md              白宫班底手册：角色框架、法定路由、BLUF 格式、决策流程
│   │   └── references/           五份机制文档（部门档案/路由表/决策流程/呈报行话/历史案例）
│   ├── daily-briefing/SKILL.md   命令协议：总统每日简报（PDB 风格）
│   ├── cabinet/SKILL.md          命令协议：跨部门会议
│   ├── executive-order/SKILL.md  命令协议：行政令起草（1 CFR Part 19）
│   └── situation-room/SKILL.md   命令协议：情况室危机推演
├── agents/                       24 个政府角色卡（派发部门代理时读出全文作为子代理 prompt）
└── reference/
    ├── port-map.md               zcode 插件 → DSH 预设 的逐项映射与差异
    └── mechanism.md              DSH 挂载机制笔记：技能目录、派发工具、分层优先级、为什么这么装
```

**最小安装只需要一个文件**：`preset-oval-office.patch.yml`（脚本会让"粘贴"这一步变安全：幂等 + 备份 + 自动修正技能路径）。

---

## 二、安装

### 前置条件

| 条件 | 说明 |
|---|---|
| DeepSeek Harness 桌面版 | 预设装在桌面 profile（`~/.dsh/profiles/desktop/`）的 patch 层 |
| Agent Teams 组合包（可选） | 桌面 profile 默认带 `@deepseek-ai/dsh-experimental-agent-team-profile`。**在位**：派发部门代理用 `spawn_teammate`（队友常驻、可并行、有任务板）；**不在位**：自动退化为 `subagent` 单发子代理，功能不减、只少协作跟踪 |

确认 Teams 组合包是否在位：

```powershell
# 期望输出里包含 @deepseek-ai/dsh-experimental-agent-team-profile
Get-Content "$env:USERPROFILE\.dsh\profiles\desktop\package.json"
```

### 方式 A：脚本安装（推荐）

在本目录下执行（PowerShell）：

```powershell
pwsh -File .\install.ps1
```

脚本会依次做：定位 profile → 把 `customSkillDirs` 重写为**本脚本所在目录的 `skills\`** → 备份 `cordis.patch.yml` → 若尚不存在则追加预设声明（带标记注释）→ 若已存在但挂载路径变了（文件夹被移动过）自动重写该块。**幂等**：重复执行不会装出第二份（重复的 preset id 会让声明加载失败，这正是幂等的原因）。

常用参数：

```powershell
pwsh -File .\install.ps1 -SetAsDefault     # 顺便把新任务默认预设改成椭圆形办公室
pwsh -File .\install.ps1 -Profile web      # 装到另一个 profile
pwsh -File .\install.ps1 -Force            # 强制删除旧块重装
pwsh -File .\install.ps1 -WhatIf           # 预演，不落盘
```

> 默认**不**改你的默认预设选中项——你现在的默认（比如「软件开发团队」）保持原样，用「设置 → Agent 预设」或新建任务的模式选择器切换。

### 方式 B：手工安装

1. 打开 `%USERPROFILE%\.dsh\profiles\desktop\cordis.patch.yml`，**先备份**；
2. 把 [preset-oval-office.patch.yml](preset-oval-office.patch.yml) 里 `- insert:` 起的整段粘贴到文件末尾；
3. **检查 `customSkillDirs` 那一行的路径**是不是本目录的实际位置（脚本安装会自动改写，手工粘贴不会）：路径应为 `<本目录>\skills`，用正斜杠写；
4. 保存。DSH 正在运行时，profile patch 的改动通常会被实时重载；没生效就重启应用。

### 方式 C：命令行 overlay（适合非桌面 profile 或临时试用）

```powershell
dsh --profile web --patch .\preset-oval-office.patch.yml
```

> `desktop` profile 由 Electron 独占管理，`dsh --profile desktop ...` 会被拒绝（`profile "desktop" is managed exclusively by the Electron application`），所以桌面版只能用方式 A/B。

### 生效时机与验证

- **新会话**用当前默认预设；**已有会话**保持创建时的组合，不回溯。
- 打开「**设置 → Agent 预设**」：内置卡片（标准 / 创造 / 极简 / PTC）之后应出现「自定义」分组，内含「**椭圆形办公室**」卡片，卡上有「查看配置」可只读打开这段 YAML。
- 新建任务页的模式选择器应能看到「椭圆形办公室」。

---

## 三、使用

### 3.1 白宫怎么跑（预设视角）

预设有三层：**persona**（白宫班底章程，见 [persona-oval-office.md](persona-oval-office.md)）定角色与口吻；**挂载的技能**（`oval-office` 主手册 + 4 个命令协议）提供完整机制，按需加载；**Teams / subagent 工具**负责把事务派发给部门角色。三者叠加，产出下面的行为：

| 阶段 | 谁 | 干什么 |
|---|---|---|
| 入戏 | 幕僚层 | 总统第一次开口时三行内确认身份、请下达指令 |
| 定性 | 幕僚层 | 判断事项领域，对照 57 条法定路由表定主责/协同部门 |
| 派发 | 部门代理 | 需要真实世界核实时，读出 `agents/<角色>.md` 角色卡派发（`spawn_teammate`，无则 `subagent`），单批 ≤4、分波推进 |
| 呈报 | 部门 | 严格 BLUF：机密等级 → 结论 → 事实（含置信度）→ 影响 → 选项 A/B/C → 部门立场 |
| 汇总 | 幕僚层 | 主责结论 + 协同意见 + **分歧点** + 选项 + 建议；分歧不许抹平 |
| 决策后 | 幕僚层 | 决定令（NSDM）→ 分派执行 → 主动提示制衡后果（国会/法院/舆论/市场/盟友） |

### 3.2 四个命令协议（用户可调用技能）

命令协议挂载为技能，**两种唤起步方式**：

- 斜杠唤起步：直接输入 `/daily-briefing`、`/cabinet`、`/executive-order`、`/situation-room`（后接参数），协议正文自动注入；
- 自然语言："来一份今日简报""召集内阁谈谈对华关税""起草一份行政令""进情况室，某国扣押了美国公民"——模型会加载对应协议后执行。

| 命令 | 产出 |
|---|---|
| `/daily-briefing [方向]` | PDB 风格每日简报：3-5 条全球动态、2-3 条国内要务、72 小时风险、今日议程建议 |
| `/cabinet <议题>` | 跨部门会议：相关部门表态、分歧点并列、三页纸选项文件 |
| `/executive-order <主题>` | 按 1 CFR Part 19 起草行政令：正文 + 起草部门/OMB/司法部长/联邦公报审签记录 + Youngstown 合法度评估 + 风险页 |
| `/situation-room <危机>` | 危机模式：时间线还原、情况室会议、红队推演、选项与建议、总统决策后连续推进 |

### 3.3 你可以怎么使唤它

直接用总统口吻下指令即可，不用记命令：

```text
去看看亚太局势怎么回事
```

```text
召集内阁谈谈对华关税再加一档
```

```text
某国政变了，我们该怎么应对
```

预期能看到：幕僚层三行入戏 → 按法定路由定性（贸易谈判主责在 USTR/EOP，协同商务部、CBP）→ 派发相关部门代理并行呈报 → BLUF 汇总并列分歧 → 你拍板后生成决定令并提示制衡后果。

### 3.4 成本提醒

- 每次派发部门代理 = 一个完整子代理上下文；PDB 简报若需联网核实会派发国家情报总监（DNI）或相关部门，属正常开销。
- 假设性/分析性问题（"1962 年古巴导弹危机换你怎么打"）**不派发**，由幕僚层依据部门档案直接以该部门口吻呈报——这是技能内的硬规则，也是控成本的关键。

---

## 四、卸载

```powershell
pwsh -File .\uninstall.ps1
```

删除预设声明块（带标记的整块删；手工装的则按 `id: preset-oval-office` 删整条 `- insert:` 条目），装过默认选中项的一并复位。写前自动备份。

参数：`-KeepDefault`（保留默认选中项）、`-Profile`、`-WhatIf`。

不删的东西：profile 的 `package.json`、bundle 列表、其他预设（包括「软件开发团队」）、你的模型与界面配置，以及本目录的全部源文件（随时可重装）。

**完全回滚**：直接还原脚本留下的 `cordis.patch.yml.bak-<时间戳>` 备份即可。

---

## 五、常见问题

**Q：装上了，但技能目录里没有 `oval-office`？**
先看 `cordis.patch.yml` 里 `customSkillDirs` 的路径是不是**本目录的实际位置**（整个文件夹移动过就会失效）。修法：重跑 `pwsh -File .\install.ps1`——脚本会把路径重写为当前实际位置；已装则自动重写挂载路径，无需 `-Force`。也可以用 `Get-Content` 核对那一行。

**Q：「设置 → Agent 预设」里没有「椭圆形办公室」卡片？**
先看 `cordis.patch.yml` 里 `id: preset-oval-office` 是否真的在、缩进是否正确（`- insert:` 顶格，其下条目缩进 4 空格）；再看 profile 是否重启过。重复的 preset id 会让声明整体加载失败——如果你曾在两个地方各贴了一份，删掉多余的那份。

**Q：没有 `spawn_teammate` 工具？**
Teams 组合包没启用。本预设不依赖它：派发会自动退化为 `subagent` 单发子代理（`delegation` 组里就有这两个工具），总统体验不减，只是没有队友常驻与任务板跟踪。要恢复 Teams，确认 profile `package.json` 的 `dsh.profile.bundles` 里有 `@deepseek-ai/dsh-experimental-agent-team-profile`。

**Q：技能正文改了不生效？**
技能目录被 `watch` 监听：正文（BLUF 格式、角色卡内容）改动下一轮就生效；只有 frontmatter（name/description）变动才会刷新技能目录清单。角色卡是普通文件，每次派发都重读，改动即时可见。

**Q：和 `zcode/` 那个「椭圆形办公室」是一回事吗？**
内容同源、机制不同。`zcode/` 版是 ZCode 本地插件市场交付物（技能 + 24 个子代理类型 + 4 个斜杠命令）；本目录是 DeepSeek Harness 的 Agent 预设（persona + 挂载技能 + Teams/subagent 派发）。逐项映射见 [reference/port-map.md](reference/port-map.md)，两者可以同时存在，互不干扰。

**Q：预设安全吗？**
预设不是沙箱。preset YAML 里的 `!!js` 表达式会执行 Host 代码，本导出的预设只用到 `process.platform` 判断（按平台开关 bash / pwsh 工具）。persona 与技能正文是提示词，不构成隔离；派发出去的部门代理同样受会话的沙箱与审批策略约束。

---

## 六、验收清单

按顺序做，全过即交付成立：

1. `pwsh -File .\install.ps1` 输出"已写入预设声明"（或"已存在 preset-oval-office 且挂载路径正确，跳过写入"）；
2. 「设置 → Agent 预设」→「自定义」分组出现「椭圆形办公室」卡片，「查看配置」能只读打开本预设 YAML；
3. 新建任务选「椭圆形办公室」，输入 `去看看亚太局势怎么回事`：三行内入戏，随后按法定路由定性并派发/呈报；
4. 输入 `/daily-briefing 亚太`：产出 PDB 风格简报，情报判断带置信度句式，未证实的传闻明说无法核实；
5. 输入 `/cabinet 对华关税再加一档`：能看到主责（财政部/USTR）与协同（商务部等）分别呈报，分歧点如实并列；
6. 输入 `/situation-room 1962 古巴导弹危机`：还原时间线、召开情况室会议、红队推演最坏情形，最后给出带法律依据的选项；
7. `pwsh -File .\uninstall.ps1` 后卡片消失，`cordis.patch.yml` 还原为备份内容。

第 3、5、6 条是行为验收，也是这个预设真正的价值所在——**它按宪政管辖权路由，不按总统好恶路由**。
