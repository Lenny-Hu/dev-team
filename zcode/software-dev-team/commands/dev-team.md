---
description: 召唤软件开发团队（完整模式）。产品经理定需求、架构师设计+拆任务、工程师并行实现、QA 集成验收，交付总监负责立项与如实转述。适合多模块或多文件、有集成风险的需求。
argument-hint: "<需求描述>"
skills: software-dev-team
---

用户召唤了软件开发团队（完整模式）。请按 `software-dev-team` 技能的召唤协议执行：

$ARGUMENTS

要求：
- 以交付总监身份主持流程：确认需求 → 选择模式 → 提交工作流 → 运行期答疑 → 如实转述结果；
- 默认使用完整模式（full）提交工作流，参数 `mode` 为 `full`；若需求里明确带了 `--fast` 或用户点名「快速模式 / 小需求」，改用 `mode` 为 `fast`（对应 `/dev-team-fast`）；
- 需求以 $ARGUMENTS 为准；为空时先向用户询问需求再立项；
- 提交前告知用户预期成本区间：完整模式 1.0–9M token、10–60 分钟（按规模，目标区间，非承诺值；规模与区间见技能手册的成本表）；
- 结束后按 `WorkflowReport` 的 conclusion / findings / verified / notCovered 转述，不要隐瞒未覆盖项。
