# dev-team 交付仓库

本目录收录「软件开发团队」能力在两套 Agent 平台上的交付物，外加一个 ZCode 市场下的附属插件。两个子目录**目标相同、机制不同、互不依赖**：

| 目录 | 平台 | 形态 | 内容 |
|---|---|---|---|
| [`zcode/`](zcode/) | ZCode | 本地插件市场根目录 | 两个插件：软件开发团队 0.2.1（`/dev-team` 工作流流水线）+ 椭圆形办公室 0.1.0（美国总统模拟器） |
| [`deepSeekHarness/`](deepSeekHarness/) | DeepSeek Harness（DSH）桌面版 | Agent 预设（preset）交付 | 「软件开发团队」预设 `dev-team`：persona 团队章程 + Teams 组合包工具，自然语言直接召唤 |

## zcode/ —— ZCode 本地插件市场

`zcode/` 是一个可直接粘贴进 ZCode 的本地插件市场根目录（市场名 `dev-zcode-215ecc2f`），`marketplace.json` 登记两个插件：

- **software-dev-team 0.2.1**：在 ZCode 里召唤一支由交付总监带队的研发专家团。斜杠命令 `/dev-team`（完整模式）/ `/dev-team-fast`（快速模式）提交 DWF 工作流：产品经理定需求（受预算约束）→ 架构师设计拆任务 → 工程师按依赖波次并行实现 → 确定性检查（测试/构建/静态检查）→ QA 集成验收，交付判定由确定性规则给出。产出落在目标仓库的 `docs/dev-team/`。
- **oval-office 0.1.0**：美国总统模拟器。24 个政府角色卡（15 个内阁部门 + 情报/执法/EOP 层）按美国宪政法定管辖权路由分派政务，`/daily-briefing`、`/cabinet`、`/executive-order`、`/situation-room` 四条命令输出 BLUF 简报、跨部门会议、行政令起草与危机推演。

安装、使用、验收与 0.2.1 审查报告的完整说明见 [zcode/README.md](zcode/README.md)。安装方式：ZCode **插件市场 → 添加插件市场**，粘贴本目录下的 `zcode` 路径，再到「个人」页安装。

## deepSeekHarness/ —— DSH 的「软件开发团队」Agent 预设

`deepSeekHarness/` 是给 **DeepSeek Harness（DSH）桌面版**安装「软件开发团队」Agent 预设的完整交付物。预设（preset id = `dev-team`）把一个普通会话变成四人研发小队：研发 Lead 带队，产品经理定需求与验收标准、架构师出方案并拆任务、工程师从共享任务板认领任务并行实现、QA 按验收标准验证；小需求自动切快速模式，Lead 不组队直接做完。团队能力来自 DSH 的 Teams 组合包（`spawn_teammate` / `team_task_*` / `send_message` 等 9 个工具），预设本体只换一行 persona 团队章程。

```text
deepSeekHarness/
└── software-dev-team/
    ├── install.ps1 / uninstall.ps1    一键安装/卸载（幂等，写前自动备份）
    ├── preset-dev-team.patch.yml      预设声明本体（最小安装只需这一个文件）
    ├── persona-dev-team.md            团队章程原文，便于单独阅读与改写
    ├── reference/                     预设机制笔记 + 内置预设对照表（含与 zcode/ 版的差异）
    └── README.md                      安装、使用、验证、卸载、常见问题
```

安装方式：在该目录执行 `pwsh -File .\install.ps1`，把预设写入桌面 profile 的 patch 层。详见 [deepSeekHarness/software-dev-team/README.md](deepSeekHarness/software-dev-team/README.md)。

## 两个版本的关系

「软件开发团队」的核心设计（角色分工、何时组队、快速模式、Lead 收口亲自验证）在两个平台一致，落地机制不同：

| | zcode/ 版 | deepSeekHarness/ 版 |
|---|---|---|
| 载体 | ZCode 插件（commands + skills + DWF 工作流） | DSH Agent 预设（persona + Teams 工具） |
| 召唤方式 | 斜杠命令 `/dev-team`、`/dev-team-fast` | 自然语言下需求，预设自动判断是否组队 |
| 协作机制 | DWF 工作流：子代理按阶段派发，检查门禁由工作流确定性执行 | Teams 工具：共享任务板（CAS 防覆盖）+ inbox 投递，Lead 等待收口 |
| 产出目录 | `docs/dev-team/`（prd.md / design.md） | `docs/requirements/`、`docs/design/`、`tests/` |
| 依赖关系 | 无 | 无（需 DSH profile 启用 Teams 组合包） |

两边可同时保留、各自独立安装，没有共用文件。

## 备注

- 本仓库是本地交付/测试用途，不等于公开发布；换机器使用需重新执行各自目录下的安装步骤。
- 源码改动不会热更新：ZCode 侧需在市场源刷新后更新插件，DSH 侧需等 profile patch 重载或重启（且只对新会话生效）。
