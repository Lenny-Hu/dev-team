# DSH 预设机制笔记

说明这份配置"为什么长这样"：预设如何声明、patch 层如何叠加、选中项如何生效、改动何时生效。内容依据本机安装内的包文档与 `dsh --help` 实测整理。

---

## 一、一个预设就是一行声明

Agent 预设由 `@deepseek-ai/dsh-agent-preset` 插件声明，一行一条：

```yaml
- insert:
    - id: preset-dev-team                 # 行 id = Loader 编辑地址
      name: "@deepseek-ai/dsh-agent-preset"
      config:
        id: dev-team                       # 预设标识符 = 会话保存的那个值
        name: 软件开发团队                  # 展示名
        description: ...                   # 展示说明
        order: 3                           # 列表排序
        plugins:                           # 子插件行列表
          - id: persona
            name: "@deepseek-ai/dsh-persona"
            config:
              prefix: |
                你是「软件开发团队」的研发 Lead……
```

要点：

- **行 id 与 `config.id` 是两件事**。行 id（`preset-dev-team`）是配置编辑器定位这一行的地址；`config.id`（`dev-team`）才是会话里保存、恢复时使用的预设标识符。
- **Web「Agent 预设」编辑器只按行 id 覆盖 `config.plugins`**，其余字段（name/description/order）不动；它不新增也不删除预设行，创建与覆盖都走"创造模式 + bundle 补丁"。
- **重复的 preset id 会让声明整体加载失败**，所以安装必须幂等。
- 注册表**不扫描目录**、不接受"预设路径"，只认声明；`agentPresets/read` 能把一条声明的子插件列表按 entry-list YAML 方言（含 `!!js`）渲染回来供查看。

## 二、patch 层的优先级

Profile 由若干组合包层 + 用户 patch 层叠加而成，顺序为：

```text
bundle 层（各 dsh.bundle.patch 依次拼接）
  → profile 级 cordis.patch.yml
    → home 级 ~/.dsh/cordis.patch.yml（优先级更高）
      → --patch 命令行 overlay（可重复，最高）
```

规则：

- **按 id 定位的 patch 不做深度合并**，而是整体替换该行的 `config`。因此 profile 覆盖必须重述想保留的字段——这也是安装脚本写 registry 条目时要带上 `default: standard` 的原因。
- patch 指定的条目不存在时，只在 stderr 打一条警告，不报错。
- 空文件或仅含注释的 patch 会导致**启动失败**；要禁用该层请写 `[]`。
- `- insert:` 是插入新条目的指令；条目名可以是包标识符、绝对路径或 `file://` URL。

`agent-preset-registry` 的注册表行由 `dsh-web-app` 组合包插入（`default: standard`），profile patch 再按 id 覆盖它，加上 `selectedDefault`。

## 三、选中项与默认值

`agent-preset-registry` 两个字段：

| 字段 | 含义 |
|---|---|
| `default` | 部署默认值：未显式指定时用的预设 id |
| `selectedDefault` | volatile 字段：用户默认值，**新会话优先用它**，而不是部署 `default` |

所以"装上预设"和"默认用它"是两件事：前者是 `- insert:` 一行声明，后者是 registry 的 `selectedDefault`。安装脚本两步都做了；`-NoSetAsDefault` 可只做前者。

另外：

- 选默认值会同步当前新任务页的空白会话；
- 已有会话保留创建时的预设，**不回溯**；会话日志记录预设 id 与切换记录，重启后按该 id 恢复当前定义（定义缺失则拒绝恢复）；
- 预设不是安全沙箱，YAML 与插件可以执行 Host 代码。

## 四、改动何时生效

- 启用 `dsh-hmr` 时，profile manifest 与两份用户 patch 文件被监听，实时重载；**HMR 禁用或缺失时，改动要重启才生效**。`dsh-base` 的 hmr 条目 `disabled: !!js "!ctx.get('profileContext')"`——桌面应用提供 profileContext，因此通常是启用的。
- **预设声明是提前加载的**：修改只影响之后创建的 Agent，不影响已在跑的会话。
- 编辑失败的处理很克制：格式错误/无效的实时 patch 被拒绝且不改变运行中的配置；import 失败只禁该定义的新绑定，兄弟插件不受影响。

## 五、为什么预设里没有团队工具

`spawn_teammate` 等 9 个团队工具来自 profile 组合包层，不在预设里：

```yaml
# @deepseek-ai/dsh-experimental-agent-team-profile 的 cordis.patch.yml（节选）
- id: tool-subagent-control        { disabled: true }
- id: tool-subagent-list-agents    { disabled: true }
- id: tool-subagent                { disabled: true }
- id: tool-subagent-fork           { disabled: true }
- insert:
    - id: agent-team      # @deepseek-ai/dsh-experimental-agent-team（maxMembers 8 / maxTasks 256 / …）
    - id: tool-agent-team # @deepseek-ai/dsh-experimental-tool-agent-team（九个工具）
    - id: ui-agent-team   # @deepseek-ai/dsh-experimental-client-ui-agent-team
```

也就是说：**删掉预设，团队工具还在；删掉组合包，预设就只剩人格没有手脚。** 排查"没有 spawn_teammate"时，先查组合包，别改预设。

该组合包的关键限制：`maxMembers: 8`（含失败的）、`maxTasks: 256`、单条消息 64 KiB；teammate 名字一次性且永不复用；只有 Lead 能创建/中断 teammate；任务板每次变更都是 compare-and-set（`expected_revision`），过期修订直接拒绝。

## 六、本机路径备忘

| 路径 | 内容 |
|---|---|
| `%USERPROFILE%\.dsh\profiles\desktop\cordis.patch.yml` | 桌面 profile 的用户 patch 层（本预设装在这里） |
| `%USERPROFILE%\.dsh\profiles\desktop\cordis.yml` | profile 根，固定为 `[]`，**不要改** |
| `%USERPROFILE%\.dsh\profiles\desktop\package.json` | profile 的组合包列表（Teams 组合包在这里） |
| `%USERPROFILE%\.dsh\cordis.patch.yml` | home 级 patch，优先级高于 profile 级（本机未创建） |
| `<安装目录>\resources\app.asar` | DSH 包体；内置预设与包文档都在里面（`dsh/node_modules/@deepseek-ai/dsh-web-app/presets/*.patch.yml`） |

CLI 备忘：

```powershell
dsh --help                 # 启动器 flag：--profile / --patch / --dump-config …
dsh --profile web --patch .\preset-dev-team.patch.yml
dsh --profile desktop --dump-config   # 会被拒绝：desktop 由 Electron 独占管理
```
