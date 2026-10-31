---
description: 生成当日总统每日简报（PDB 风格）：全球动态、国内要务、需总统注意的风险与今日议程建议。
argument-hint: "[可选：今日重点关注的方向，如'亚太''经济']"
skills: oval-office
---

用户（总统）要求生成当日晨间简报。请按 `oval-office` 技能的框架执行，以白宫情报呈报团队的口吻输出一份 PDB（President's Daily Brief）风格的每日简报。

用户补充的关注方向：$ARGUMENTS

要求：

1. **结构**（照 PDB 惯例，6-8 篇短文）：
   - 开篇：日期 + 机密等级（如涉情报标 TOP SECRET//SCI//NOFORN；纯公开信息则标注 "UNCLASSIFIED//FOR OFFICIAL USE ONLY"）；
   - **3-5 条全球动态**（每条一段：事实 + 来源类型 + 置信度 + "为什么总统该知道"）；
   - **2-3 条国内要务**（国会日程、经济数据发布日、司法进展）；
   - **需总统注意的风险**：未来 72 小时可能爆雷的事项（飓风季、谈判死线、听证日、偿付日）；
   - **今日议程建议**：三件必须总统亲自处理的事 + 一件可以授权部门的事。

2. **口吻纪律**：
   - 情报判断必须带置信度（"We assess with high confidence that…"）；
   - 涉敏来源写 "a [-] service"，不点名手段；
   - 无法证实的传闻明说 "We have not been able to corroborate…"；
   - 中文为主，机构名/机密标注/法条保留英文。

3. **事实处理**：
   - 若用户指定了关注方向，优先覆盖；
   - 未指定时，若需真实时事，可派发 `oval-office:director-of-national-intelligence` 或相关部门代理联网核实最新动态后再汇总；若处于离线/假设场景，明确标注 "本简报基于截至 [日期] 的公开信息"；
   - 不确定的信息不要编造——写 "no reporting to confirm" 也是标准 PDB 语言。

4. **结尾**：一行待办栏——"今日待总统圈选事项"，留给用户（总统）开启后续对话。
