---
name: cabinet
description: 就指定议题召开跨部门会议（NSC 部长委员会或内阁会议）：相关部门表态、分歧点、选项与建议。可用 /cabinet <议题> 唤起。
---

# 命令协议 · 跨部门会议（Cabinet）

> 本协议由 ZCode 插件 `oval-office` 的 `/cabinet` 命令移植为 DeepSeek Harness 用户可调用技能。用户输入 `/cabinet <议题>` 时本协议自动注入；自然语言要求（"召集内阁谈谈对华关税"）时由模型加载后执行。执行前先确保已加载 `oval-office` 技能作为框架（未加载则用 skill 工具加载），本协议在其之上运行。

用户（总统）要求就以下议题召开跨部门会议：取用户本条消息中 `/cabinet` 之后的内容（如有）。

按 `oval-office` 技能的框架执行，完整走一遍"选项文件 → 部门呈报 → 总统待决"流程：

1. **定性与路由**（先用一小段说明，不展开）：
   - 议题性质（外交/军事/经济/执法/移民/灾害/卫生…）；
   - 主责部门 + 协同部门（依据 `oval-office` 技能的 `references/routing-table.md` 法定管辖权）；
   - 会议层级：日常议题走部门协调；国安类走 NSC 部长委员会（PC）；宣布开会的主持人是国安顾问（国安类）或国内政策委员会主任（内政类）。

2. **会议进行**（主体）：
   - 按 `oval-office` 技能第六节的派发机制，用 `spawn_teammate`（Teams 不可用时用 `subagent`）读出 oval-office 技能基目录下的 `agents/<角色名>.md` 角色卡，派发主责与协同部门代理分别调研/分析并呈报；可并行派发（单批不超过 4 个）；
   - 每个部门的呈报严格按 BLUF 格式：结论 → 事实（含置信度/机密标注）→ 影响 → 选项 A/B/C（各含风险与法律依据）→ 部门立场与建议；
   - **分歧必须保留**：部门意见相左时如实并列（NSC 纪律：represent attendee views and differences faithfully），不得在你这一层抹平。

3. **整合选项文件**（会议收尾，给总统的三页纸）：
   - BLUF：本议题的核心取舍一句话；
   - 背景与约束（法定边界：拨款、确认、法院、WPR 时钟等，按 `oval-office` 技能的 `references/decision-flow.md`）；
   - 选项对照表：选项 / 主张部门 / 预期效果 / 主要风险 / 法律依据 / 成本；
   - 国安顾问（或主持人）的个人建议 + 明确的少数派意见；
   - "The decision is yours, Mr. President."

4. **总统决策后**：若用户在对话中做出选择，立即生成决定令（NSDM 格式："The President has decided to…；Secretary X shall…"）并分派执行指令，随后提示制衡后果（国会/法院/舆论/市场/盟友的反应）。
