# dev-team 交付仓库

本目录收录「软件开发团队」能力在三套 Agent 平台上的交付物，外加一个 ZCode 市场下的附属插件。三个子目录**目标相同、机制不同、互不依赖**：

| 目录 | 平台 | 形态 | 内容 |
|---|---|---|---|
| [`zcode/`](zcode/) | ZCode | 本地插件市场根目录 | 两个插件：软件开发团队 0.2.1（`/dev-team` 工作流流水线）+ 椭圆形办公室 0.1.0（美国总统模拟器） |
| [`deepSeekHarness/`](deepSeekHarness/) | DeepSeek Harness（DSH）桌面版 | Agent 预设（preset）交付 | 两个预设：软件开发团队 `dev-team`（persona 团队章程 + Teams 组合包工具）+ 椭圆形办公室 `oval-office`（白宫班底 persona + 挂载技能 + 部门角色派发） |
| [`qoder/`](qoder/) | Qoder CN 桌面版 | 智能体团队（Agent Team）交付 | 软件开发团队：5 个 Agent 定义 + 团队卡（交付总监任团队负责人）；椭圆形办公室尚未移植 |

## zcode/ —— ZCode 本地插件市场

`zcode/` 是一个可直接粘贴进 ZCode 的本地插件市场根目录（市场名 `dev-zcode-215ecc2f`），`marketplace.json` 登记两个插件：

- **software-dev-team 0.2.1**：在 ZCode 里召唤一支由交付总监带队的研发专家团。斜杠命令 `/dev-team`（完整模式）/ `/dev-team-fast`（快速模式）提交 DWF 工作流：产品经理定需求（受预算约束）→ 架构师设计拆任务 → 工程师按依赖波次并行实现 → 确定性检查（测试/构建/静态检查）→ QA 集成验收，交付判定由确定性规则给出。产出落在目标仓库的 `docs/dev-team/`。
- **oval-office 0.1.0**：美国总统模拟器。24 个政府角色卡（15 个内阁部门 + 情报/执法/EOP 层）按美国宪政法定管辖权路由分派政务，`/daily-briefing`、`/cabinet`、`/executive-order`、`/situation-room` 四条命令输出 BLUF 简报、跨部门会议、行政令起草与危机推演。

安装、使用、验收与 0.2.1 审查报告的完整说明见 [zcode/README.md](zcode/README.md)。安装方式：ZCode **插件市场 → 添加插件市场**，粘贴本目录下的 `zcode` 路径，再到「个人」页安装。

## deepSeekHarness/ —— DSH 的 Agent 预设交付

`deepSeekHarness/` 是给 **DeepSeek Harness（DSH）桌面版**安装 Agent 预设的完整交付物，目前有两个预设。

**软件开发团队**（preset id = `dev-team`）把一个普通会话变成四人研发小队：研发 Lead 带队，产品经理定需求与验收标准、架构师出方案并拆任务、工程师从共享任务板认领任务并行实现、QA 按验收标准验证；小需求自动切快速模式，Lead 不组队直接做完。团队能力来自 DSH 的 Teams 组合包（`spawn_teammate` / `team_task_*` / `send_message` 等 9 个工具），预设本体只换一行 persona 团队章程。

**椭圆形办公室**（preset id = `oval-office`，由 [zcode/oval-office](zcode/oval-office/) 移植）把一个会话变成白宫：用户是总统，白宫幕僚层按美国宪政法定管辖权把事务路由到 24 个政府部门角色之一（读出角色卡派发 `spawn_teammate` / `subagent`），输出 BLUF 简报、跨部门会议、行政令起草与危机推演。技能（主手册 + 四个命令协议）经预设的 `skill-filesystem` 挂载，`/daily-briefing`、`/cabinet`、`/executive-order`、`/situation-room` 可直接唤起。

```text
deepSeekHarness/
├── software-dev-team/
│   ├── install.ps1 / uninstall.ps1    一键安装/卸载（幂等，写前自动备份）
│   ├── preset-dev-team.patch.yml      预设声明本体（最小安装只需这一个文件）
│   ├── persona-dev-team.md            团队章程原文，便于单独阅读与改写
│   ├── reference/                     预设机制笔记 + 内置预设对照表（含与 zcode/ 版的差异）
│   └── README.md                      安装、使用、验证、卸载、常见问题
└── oval-office/
    ├── install.ps1 / uninstall.ps1    一键安装/卸载（幂等，写前自动备份，自动修正技能挂载路径）
    ├── preset-oval-office.patch.yml   预设声明本体（最小安装只需这一个文件）
    ├── persona-oval-office.md         白宫班底章程原文，便于单独阅读与改写
    ├── skills/                        技能根目录：oval-office 主技能包（SKILL.md + references/ + 24 张角色卡）+ 四个命令协议技能
    ├── reference/                     移植映射（zcode → DSH）+ 挂载机制笔记
    └── README.md                      安装、使用、验证、卸载、常见问题
```

安装方式：在各自目录执行 `pwsh -File .\install.ps1`，把预设写入桌面 profile 的 patch 层。详见 [deepSeekHarness/software-dev-team/README.md](deepSeekHarness/software-dev-team/README.md) 与 [deepSeekHarness/oval-office/README.md](deepSeekHarness/oval-office/README.md)。

## qoder/ —— Qoder 的智能体团队交付

`qoder/` 是给 **Qoder CN 桌面版**（取证版本 0.5.1）的交付物。Qoder 原生有「智能体团队（Agent Team，内部标识 `squad`）」：1 名团队负责人 + 1~4 名成员，成员各跑独立会话、通过 Discussion 协调——这就是 WorkBuddy「专家团」在 Qoder 里的对应物，本交付把**交付总监放在团队负责人**的位置上。

```text
qoder/
└── software-dev-team/
    ├── agents/                      5 个 Agent 定义（交付总监/产品经理/架构师/工程师/QA）
    ├── squad.md                     团队卡：名称、说明、协作指令、负责人与成员，含各字段字符上限
    ├── install.ps1 / uninstall.ps1  只负责 Agent 文件落盘到 ~/.qoder-cn/agents/
    ├── reference/                   机制实测笔记（含证据来源）+ 三版移植映射
    └── README.md                    安装、建团 6 步、召唤用法、验收清单、常见问题
```

安装分两步：`pwsh -File .\install.ps1` 装 Agent，然后**在设置界面里建团队**。建团这步脚本代不了——团队记录存在应用运行中的 SQLite 里，且要绑服务端注册的 Agent ID 并开协作授权；脚本不碰这个库。详见 [qoder/README.md](qoder/README.md) 与 [qoder/software-dev-team/README.md](qoder/software-dev-team/README.md)。

## 三个版本的关系

「软件开发团队」的核心设计（角色分工、何时组队、快速模式、Lead 收口亲自验证）在三个平台一致，落地机制不同：

| | zcode/ 版 | deepSeekHarness/ 版 | qoder/ 版 |
|---|---|---|---|
| 载体 | ZCode 插件（commands + skills + DWF 工作流） | DSH Agent 预设（persona + Teams 工具） | Qoder 智能体团队（5 个 Agent + 团队卡） |
| 召唤方式 | 斜杠命令 `/dev-team`、`/dev-team-fast` | 自然语言下需求，预设自动判断是否组队 | 团队卡片召唤 / 把 Issue 指派给团队 |
| 协作机制 | DWF 工作流：子代理按阶段派发，检查门禁由工作流确定性执行 | Teams 工具：共享任务板（CAS 防覆盖）+ inbox 投递，Lead 等待收口 | 负责人分派，成员各在独立会话；无任务板锁，靠「文件前缀不交叉」约定 |
| 产出目录 | `docs/dev-team/`（prd.md / design.md） | `docs/requirements/`、`docs/design/`、`tests/` | `docs/dev-team/`（prd / design / qa-report / delivery-report） |
| 质量口径 | 确定性门禁 + QA 逐条 AC 证据 | Lead 复查 diff、亲自跑测试 | Lead 亲自复跑检查并逐条报告退出码（**无确定性门禁**） |
| 一键安装 | 市场安装 | `install.ps1` 写 profile patch | `install.ps1` 只装 Agent，**建团需人工 6 步** |
| 依赖关系 | 无 | 需 DSH profile 启用 Teams 组合包 | 需 Qoder 账号下 Agent 完成协作登记 |

三方可同时保留、各自独立安装，没有共用文件。

Qoder 版相对另外两版的**得失**逐项列在
[qoder/software-dev-team/reference/port-map.md](qoder/software-dev-team/reference/port-map.md)：
得到原生团队卡片与成员独立会话，失去 zcode 的确定性检查门禁、独立上下文审校与 DSH 的任务板 CAS 锁。
机制取证（含每条结论的证据来源与未验证项）见
[qoder/software-dev-team/reference/mechanism.md](qoder/software-dev-team/reference/mechanism.md)。

「椭圆形办公室」同样是双平台交付：`zcode/oval-office/` 是 ZCode 插件市场里的原版，`deepSeekHarness/oval-office/` 是 DSH 预设移植版——内容（技能手册、5 份机制文档、24 张角色卡、4 个命令协议）同源，派发机制按 DSH 工具改写，逐项映射见 [deepSeekHarness/oval-office/reference/port-map.md](deepSeekHarness/oval-office/reference/port-map.md)。**尚未移植到 Qoder**：Qoder 的智能体团队有 4 名成员上限，24 个部门角色不能照搬，需改成「幕僚层负责人 + 少量常驻成员 + 按管辖权用 subagent 派发角色卡」，动手前先确认（见 [qoder/README.md](qoder/README.md)）。

## 备注

- 本仓库是本地交付/测试用途，不等于公开发布；换机器使用需重新执行各自目录下的安装步骤。
- 源码改动不会热更新：ZCode 侧需在市场源刷新后更新插件，DSH 侧需等 profile patch 重载或重启（且只对新会话生效），Qoder 侧需重跑 `install.ps1` 落盘 Agent 并新建会话（团队记录只存协作指令文本，改 `squad.md` 后需到设置里重新粘贴保存）。
- Qoder 版的机制结论全部带证据来源与版本标注（0.5.1 / Windows），未验证项单独列在 `qoder/software-dev-team/reference/mechanism.md` 第 7 节，换版本后请重新核对。
