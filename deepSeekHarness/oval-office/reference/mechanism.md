# DSH 挂载机制笔记（oval-office 预设）

说明这份配置"为什么长这样"：预设如何声明、技能目录怎么挂上会话、派发工具从哪来、patch 层如何叠加、改动何时生效。内容依据本机安装内的包文档与实测整理（`dsh-skill-filesystem` / `dsh-tool-skill` / `dsh-persona` / `dsh-agent-preset` 的 README 与 `dsh-web-app` 的 `presets/*.patch.yml`）。

---

## 一、一个预设就是一行声明

Agent 预设由 `@deepseek-ai/dsh-agent-preset` 插件声明，一行一条：

```yaml
- insert:
    - id: preset-oval-office                 # 行 id = Loader 编辑地址
      name: "@deepseek-ai/dsh-agent-preset"
      config:
        id: oval-office                       # 预设标识符 = 会话保存的那个值
        name: 椭圆形办公室                    # 展示名
        order: 5                              # 列表排序（排在「创造」之后）
        plugins:                              # 子插件行列表
          - id: persona                       # 白宫班底章程（常驻人格）
          - id: skill-filesystem              # 技能挂载（见第二节）
            config:
              customSkillDirs: ['<插件目录>/skills']
          ...
```

要点：

- **行 id 与 `config.id` 是两件事**。行 id（`preset-oval-office`）是配置编辑器定位这一行的地址；`config.id`（`oval-office`）才是会话里保存、恢复时使用的预设标识符。
- **重复的 preset id 会让声明整体加载失败**，所以安装必须幂等。
- 注册表**不扫描目录**、不接受"预设路径"，只认声明。
- 预设不是安全沙箱，YAML 里的 `!!js` 会执行 Host 代码（本预设只用到 `process.platform`）。

## 二、技能是怎么挂上会话的

预设的 `skill-filesystem` 行把插件目录的 `skills/` 挂成技能根：

```yaml
- id: skill-filesystem
  name: "@deepseek-ai/dsh-skill-filesystem"
  config:
    customSkillDirs:
      - '<插件目录>/skills'
```

机制要点（依据 `dsh-skill-filesystem` / `dsh-tool-skill` 包文档）：

- **根与优先级**：`customSkillDirs` 排在项目根（`.dsh/skills`、`.agents/skills`）之后、用户根（`~/.dsh/skills`、`~/.agents/skills`）之前（rank 300）。`includeDefaultRoots` 默认 `true`，所以项目/用户根的技能照常可见，互不遮挡。
- **发现规则只有一层**：`<根>/<name>/SKILL.md` 或 `<根>/<name>.md`。因此 `skills/oval-office/`、`skills/daily-briefing/` 等五个目录各被发现为一个技能；`skills/oval-office/references/*.md` 是包内资源，**不会**被误发现成技能。`agents/` 在插件根目录、不在技能根下，同样不会被发现——它是"派发时读的文件"，不是技能。
- **为什么必须写绝对路径**：provider 对每个根做 `resolve(root)`（相对 **Host 进程 cwd**，不是会话工作目录），所以相对路径不可靠。`install.ps1` 因此会把出厂的绝对路径重写为"脚本所在目录\skills"——**整个文件夹可以随意移动，重跑 install.ps1 即可自愈**。
- **模型看到什么**：会话开始前收到一份持久技能目录（name + 截断到 500 字符的 description）；需要时用 `skill` 工具加载全文，结果里带 "Base directory for this skill"，正文中的 `references/xxx.md`、`../agents/xxx.md` 相对引用因此可解析。
- **用户可调用**：`/name` 手势会把同名技能全文注入那一步——四个命令协议就是这样被 `/daily-briefing`、`/cabinet`、`/executive-order`、`/situation-room` 唤起的。
- **热更新**：技能根被监听；正文改动下一轮生效，frontmatter 变动才会刷新目录清单。角色卡是普通文件，每次派发重读，改动即时可见。

## 三、派发工具从哪来（Teams 与 subagent 的二选一）

persona 里的派发纪律写的是"有 `spawn_teammate` 用它，没有用 `subagent`"，对应两种 profile 形态：

| 形态 | 工具 | 来源 |
|---|---|---|
| Teams 组合包在位（桌面 profile 默认） | `spawn_teammate` / `send_message` / `list_agents` / `wait_agent` / `interrupt_agent` / `team_task_*` | profile 组合包层的 `@deepseek-ai/dsh-experimental-tool-agent-team`（它会把预设 `delegation` 组里的 `tool-subagent` / `tool-subagent-fork` 行 `disabled: true`） |
| Teams 组合包不在位 | `subagent` / `subagent_fork` | 预设 `delegation` 组内的 `@deepseek-ai/dsh-tool-subagent`（provider: spawn / fork） |

两种形态下总统体验一致：读出 `agents/<角色名>.md` 角色卡 → 连同总统原始指令与已知背景组成 prompt → 派发 → 按 BLUF 回收。差别只在协作语义：Teams 队友常驻、可并行波次、有共享任务板；`subagent` 是单发子代理。Teams 的关键上限：`maxMembers: 8`（含失败的）、`maxTasks: 256`、单条消息 64 KiB——所以 persona 规定**单批派发不超过 4 个、分波推进**。

> 排查"没有 spawn_teammate"时查 profile 的 `package.json`（Teams 组合包在不在），不要改预设；反之，删掉预设，`subagent` 也还在。

## 四、patch 层的优先级

Profile 由若干组合包层 + 用户 patch 层叠加而成：

```text
bundle 层（各 dsh.bundle.patch 依次拼接）
  → profile 级 cordis.patch.yml
    → home 级 ~/.dsh/cordis.patch.yml（优先级更高）
      → --patch 命令行 overlay（可重复，最高）
```

- **按 id 定位的 patch 不做深度合并**，而是整体替换该行的 `config`。本预设是 `- insert:` 新行，不覆盖任何内置行。
- patch 指定的条目不存在时只在 stderr 打警告，不报错。
- 空文件或仅含注释的 patch 会导致**启动失败**；要禁用该层写 `[]`。

## 五、改动何时生效

- 启用 `dsh-hmr` 时，profile manifest 与两份用户 patch 文件被监听，实时重载；HMR 禁用或缺失时，改动要重启才生效。
- **预设声明是提前加载的**：修改只影响之后创建的 Agent，不影响已在跑的会话。
- 编辑失败的处理很克制：格式错误/无效的实时 patch 被拒绝且不改变运行中的配置。

## 六、本机路径备忘

| 路径 | 内容 |
|---|---|
| `%USERPROFILE%\.dsh\profiles\desktop\cordis.patch.yml` | 桌面 profile 的用户 patch 层（本预设装在这里） |
| `%USERPROFILE%\.dsh\profiles\desktop\package.json` profile 组合包列表（Teams 组合包在这里） | |
| `<安装目录>\resources\app.asar` | DSH 包体；内置预设（`dsh-web-app/presets/*.patch.yml`）与包文档都在里面 |
| `deepSeekHarness/oval-office/` | 本交付物：预设声明 + 技能 + 角色卡 + 安装脚本 |

CLI 备忘：

```powershell
dsh --help                 # 启动器 flag：--profile / --patch / --dump-config …
dsh --profile web --patch .\preset-oval-office.patch.yml
dsh --profile desktop --dump-config   # 会被拒绝：desktop 由 Electron 独占管理
```
