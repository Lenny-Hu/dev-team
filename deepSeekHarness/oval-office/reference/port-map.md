# 移植映射：zcode 插件 oval-office → DeepSeek Harness 预设 oval-office

本文回答一个问题：**ZCode 插件里的每一样东西，在 DSH 预设里对应什么、改了什么、为什么**。内容层面的规则（路由、BLUF、决策流程、角色卡）原样保留；改的只有"机制接线"。

---

## 一、逐项映射

| ZCode 插件元素 | DeepSeek Harness 对应 | 处理方式 |
|---|---|---|
| `.zcode-plugin/plugin.json`（name/version/description/skills/agents/commands 路径声明） | `preset-oval-office.patch.yml` 里的预设行（`id`/`name`/`description`/`order`/`plugins`） | 清单元数据变成预设声明；`skills` 路径声明变成 `skill-filesystem` 的 `customSkillDirs`；`agents`/`commands` 变成目录约定（无声明需求） |
| `skills/oval-office/SKILL.md` | 同名文件，由 `customSkillDirs` 挂载为技能 `oval-office` | 正文原样移植；frontmatter 的 `name`/`description` 恰好满足 DSH 技能格式（kebab-case name + 必需 description），未改触发词 |
| `skills/oval-office/references/*.md`（5 份） | 原样复制到 `skills/oval-office/references/` | DSH 技能加载时给出"Base directory for this skill"，正文里的 `references/xxx.md` 相对引用可直接解析，无需改写 |
| `commands/*.md`（4 个斜杠命令） | `skills/{daily-briefing,cabinet,executive-order,situation-room}/SKILL.md` | ZCode 的斜杠命令 → DSH 的**用户可调用技能**：用户输入 `/daily-briefing` 即注入协议正文（`/name` 手势），与 ZCode 体验一致；协议流程正文原样保留 |
| 命令 frontmatter 的 `$ARGUMENTS` | "取用户本条消息中 `/name` 之后的内容" | DSH 的 `/name` 手势不做参数替换，改为在协议里说明取值方式 |
| 命令 frontmatter 的 `skills: oval-office` | 协议正文里一句"执行前先加载 `oval-office` 技能" | 显式化依赖；技能已挂载，用 skill 工具即可加载 |
| `agents/*.md`（24 张角色卡） | 原样复制到 `skills/oval-office/agents/`（**移进技能包内**） | 角色卡是自包含的部门 persona 文本，逐字保留；放技能包里是为了按技能基目录相对解析（理由见下文差异第 7 条） |
| ZCode 子代理类型 `oval-office:<角色名>` | `spawn_teammate`（Teams 在位）或 `subagent`（不在位）+ 角色卡 prompt | **核心机制改写**：DSH 没有自定义子代理类型注册表，改为"读出 `agents/<角色名>.md` 全文，连同总统指令一起作为子代理 prompt" |
| ZCode 的 Agent 工具派发协议 | persona 的"派发纪律" + SKILL.md 第六节 | 并行波次、单批 ≤4、分歧不许抹平等纪律保留；新增 Teams 上限（`maxMembers: 8`）与收齐回报方式（`wait_agent`/`list_agents`/`team_task_*`） |
| 插件市场安装（添加市场源 → 安装） | `install.ps1` / 手工粘贴 patch / `dsh --patch` overlay | 交付物从"市场里的插件包"变成"profile patch 层的一行预设声明 + 工作区里的随附文件" |
| 技能触发（description 匹配 + `/oval-office`） | 同机制 | DSH skill catalog 渲染 name + 截断 description；`/oval-office` 用户手势同样有效 |

## 二、内容差异（改了什么、为什么）

1. **SKILL.md 第六节（派发对照表）**：`oval-office:<角色名>` 改为角色卡路径 + DSH 派发工具用法 + 单批 ≤4 的波次纪律。原因：DSH 无自定义子代理类型； Teams 组合包成员上限 8（含失败成员）。
2. **SKILL.md 第三节步骤 3**："用 Agent 工具派发"改为"派发主责部门代理（方法见第六节）"，工具名二选一由 persona 说明。
3. **SKILL.md 第七、八节（文件索引/命令）**：新增 `../agents/` 与四个命令技能的行；命令入口从"ZCode 斜杠命令"改为"DSH 用户可调用技能（`/name` 手势或自然语言）"。
4. **新增 persona 层**（ZCode 版没有）：白宫班底章程 + 随附文件索引 + 派发纪律 + 首次互动规则。原因：DSH 的技能是按需加载的，persona 是常驻上下文——入戏、口吻、文件位置这些"每次都要在"的内容放 persona；完整机制放技能。
5. **新增预设层**：`skill-filesystem` 一行把 `skills/` 挂进技能目录；其余 32 行子插件与内置「标准」预设逐字相同（工具面不变，只换人格与技能挂载）。
6. **四个命令协议各加一段"移植说明"**：注明来源、唤起步方式、参数取值、框架依赖。协议流程正文一字未改。
7. **角色卡从插件根目录 `agents/` 移进技能包 `skills/oval-office/agents/`**（对 zcode 布局的唯一结构偏离）：DSH 的技能加载结果会给模型一个 "Base directory for this skill"，包内相对路径都能解析；而 glob 搜索工具**只接受工作区相对路径**（绝对路径一律返回空），角色卡放在技能包外时，会话工作区一旦不是本目录，派发环节就断了。移进包内后，派发路径完全不依赖会话工作目录。

**未改动的**：五条铁律、57 条法定路由表与判定原则、BLUF 标准呈报格式、NSC 决策流程与 1 CFR Part 19 流转、5 份机制文档全文、24 张角色卡全文、4 个命令协议的流程正文。

## 三、能力对照（装完之后）

| | zcode 版 | DSH 预设版 |
|---|---|---|
| 载体 | 本地插件市场里的插件包 | profile patch 层的一行预设声明 + 工作区随附文件 |
| 安装 | 添加市场源 → 安装插件 | `install.ps1`（或手工粘贴 patch / `--patch` overlay） |
| 入口 | 斜杠命令 + 技能描述触发 | 技能 `/name` 手势 + 自然语言 + 技能描述触发 |
| 主会话人格 | 技能加载后生效 | persona 常驻 + 技能按需加载 |
| 部门派发 | `oval-office:<角色>` 子代理类型 | `spawn_teammate` / `subagent` + 角色卡 prompt |
| 并行派发 | 子代理并行 | 队友并行（Teams）或子代理并行；单批 ≤4 |
| 产出 | BLUF 简报、选项文件、行政令、危机推演 | 同左 |

**怎么选**：两个版本可以同时存在——ZCode 版留在 ZCode 里用，DSH 预设版在 DSH 里用，内容同源、互不依赖。
