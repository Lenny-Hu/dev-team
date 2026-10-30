/* zcode-workflow
description: 交付总监带队的软件研发流水线（0.2.1 成本优化版）：产品经理定需求、架构师设计拆任务、工程师按依赖波次并行实现、确定性检查 + QA 逐条验收，小需求走快速模式。审校使用短上下文新会话，文档与验收标准有预算上限。
whenToUse: 用户召唤软件开发团队实现一个需求时使用。
args:
  requirement:
    type: string
    required: true
    description: 用户的原始需求文本
  mode:
    type: string
    default: full
    description: full=完整模式；fast=快速模式（小需求）
*/

// ============================================================================
// software-dev-team 0.2.1
//
// 与 0.1.1 的关键差异（依据 2026-10-30 三次真实运行的成本审计）：
// 1. 文档有预算：PRD/design 有字符上限，验收标准有数量上限（按 small/medium/large 分级）；
//    0.1.1 的 PRD 32KB / 39 条 AC 让每个下游会话都要先背 2 万 token 文档。
// 2. 审校换新会话：0.1.1 用一个持久「交付总监」跑 4 次 ask，上下文滚到 21 万 token；
//    0.2.1 每次审校都是全新短上下文子代理，只看文档、不跑命令、1 轮封顶。
// 3. 取消逐任务质检员：0.1.1 的 3 个质检员共 2.8M token、零退回；0.2.1 由工程师自检
//    + 一次集成 QA 按 PRD 的 AC 逐条核对。
// 4. 取消终验子代理重跑全部 AC：0.1.1 终验 1.83M token 重跑 39 条 AC；0.2.1 交付结论
//    由确定性规则（门禁退出码 + QA 逐条证据）得出，主会话交付总监负责对外汇报。
// 5. 门禁菜单化 + 自动探测：命令必须是编译期字面量，所以用固定菜单 key；每个 world.run
//    都被捕获，spawn 失败记为「不可用」而不是让整轮运行失败（0.1.1 曾因此丢掉 12.9M token）。
// ============================================================================

// ===== 结构化结果类型 =====

interface Prd {
  /** 需求标题，一句话。 */
  title: string;
  /** 背景与目标：1-3 句，为什么要做、做成什么样算达成。 */
  background: string;
  /** 规模分级：small / medium / large，决定 AC 与任务预算。 */
  size: string;
  /** 范围内的用户故事，每条一句、可独立验收。 */
  stories: string[];
  /** 验收标准，一条一行（≤200 字符），给定输入或操作 → 期望结果。 */
  acceptance: string[];
  /** 明确不做的内容，至少 1 条。 */
  nonGoals: string[];
  /** 关键假设与未决问题的默认取值。 */
  assumptions: string[];
  /** 主要风险及应对。 */
  risks: string[];
}

interface DesignTask {
  /** 任务编号，全清单唯一，如 T1。 */
  id: string;
  /** 任务标题，一句话。 */
  title: string;
  /** 要修改或新增的文件（工作区相对路径，1-3 个）。 */
  files: string[];
  /** 实现要点，自包含，禁止引用 docs/dev-team 文档；1-6 条。 */
  steps: string[];
  /** 本任务的验收标准，1-4 条，必须能在本任务范围内关闭。 */
  acceptance: string[];
  /** 依赖的任务编号；同波任务不得互相依赖。 */
  dependsOn: string[];
}

interface Design {
  /** 技术方案：关键决策与理由，≤500 字符。 */
  approach: string;
  /** 遵循的仓库现有约定（读代码后总结）。 */
  conventions: string;
  /** 任务拆分：粒度小、可独立验证、编号唯一、同波不共享文件。 */
  tasks: DesignTask[];
  /** 检查项菜单 key，只列确认可用的；没有就给空数组。 */
  checks: string[];
  /** 方案风险与回退思路。 */
  risks: string[];
}

interface GateVerdict {
  /** 是否放行。 */
  pass: boolean;
  /** 打回时必须修改的问题，最多 3 条。 */
  blocking: string[];
  /** 不阻塞的建议。 */
  notes: string[];
  /** 一句话说明放行或拦截的理由（必填）。 */
  reason: string;
}

interface TaskResult {
  /** 任务编号。 */
  taskId: string;
  /** 实际改动摘要，一句话。 */
  summary: string;
  /** 实际改动的文件（工作区相对路径）。 */
  filesChanged: string[];
  /** 自查发现但未解决的问题；没有则空数组。 */
  concerns: string[];
}

interface QaCriterion {
  /** 对应的 AC 编号，原样回填，如 AC-01。 */
  id: string;
  /** 是否满足。 */
  met: boolean;
  /** 证据：读到的 路径:行号，或命令+退出码+关键输出；没有依据写「存疑：原因」。 */
  evidence: string;
}

interface QaIssue {
  /** 问题位置，优先 路径:行号。 */
  where: string;
  /** 问题是什么，一句话。 */
  what: string;
  /** 严重度：high 留给数据丢失、崩溃、结果错误；medium 功能受损但有退路；low 瑕疵。 */
  severity: string;
  /** 最可能相关的任务编号；判断不出就给空数组。 */
  affectedTaskIds: string[];
}

interface QaVerdict {
  /** 是否验收通过。 */
  pass: boolean;
  /** 对照 PRD 验收标准的逐条结论，必须覆盖全部 AC 编号。 */
  criteria: QaCriterion[];
  /** 发现的问题清单。 */
  issues: QaIssue[];
  /** QA 实际做了哪些检查（跑了哪些命令、读了哪些文件）。 */
  checked: string[];
}

interface LitePlan {
  /** 精简需求文档（快速模式）。 */
  prd: Prd;
  /** 精简技术方案与任务拆分（快速模式）。 */
  design: Design;
}

interface Finding {
  /** 问题位置：文件路径、命令或任务编号。 */
  where: string;
  /** 一句话：问题是什么。 */
  what: string;
  /** 什么表明了它：读过的内容，或命令与输出。 */
  evidence: string;
  /** verified=确定性检查确认；unconfirmed=仅 QA 审阅或人工核对。 */
  status: "verified" | "unconfirmed";
  /** 严重度。 */
  severity: "low" | "medium" | "high";
}

interface WorkflowReport {
  /** 两三句话回答用户：这次交付了什么、质量结论如何、代价如何。 */
  conclusion: string;
  findings: Finding[];
  /** 这次实际检查了什么、怎么检查的。 */
  verified: string[];
  /** 没有覆盖或无法检查的内容及原因。 */
  notCovered: string[];
}

// ===== 内部类型（不参与结构化输出校验） =====

interface Budget {
  acMax: number;
  taskMax: number;
  prdSoft: number;
  prdHard: number;
  designSoft: number;
  designHard: number;
}

interface GateRun {
  key: string;
  name: string;
  command: string;
  exitCode: number;
  output: string;
  /** true=命令根本跑不起来/环境缺失，不作为代码质量失败。 */
  unavailable: boolean;
}

interface EngineerSlot {
  id: string;
  agent: Agent;
}

// ===== 人物设定（每个角色的成本纪律写在 persona 里，避免靠流程补丁兜底） =====

const PM_PERSONA = [
  "你是团队的产品经理，把模糊需求变成可验收的需求文档。",
  "验收标准一条一行、每条 ≤200 字符，必须可由一次命令或一次调用核对；同一命令的不同输入合并成一条参数化标准，错误路径按类合并，禁止为凑数拆细。",
  "先按规模分级并写进 size：small=≤2 个文件、无新依赖、无集成；medium=≤5 个文件或 ≤2 个模块；其余 large。不得为了多写 AC 而把范围做大。",
  "需求阶段只读代码与文档（≤5 个文件），禁止运行项目命令、禁止实测验收标准——验证是工程师与 QA 的事。",
  "PRD 文档 ≤3000 字符：范围、AC、非目标、假设默认值；不写技术方案、不写测试代码、不写逐条命令模板。",
  "不确定处记录假设与默认值，不编造用户没说过的功能；范围缺失到无法立项时上报，不硬写。",
  "结构化结果所有字段必填，没有内容就填空数组。",
].join("\n");

const REVIEWER_PRD_PERSONA = [
  "你是交付总监，只做需求审校：不写代码、不改文档、不运行任何命令。",
  "只读 docs/dev-team/prd.md；为确认可行性最多再读 2 个仓库文件。目标是 1 轮审校，不要反复取证。",
  "放行只看五件事：每条 AC 可由一次命令/调用核对且互不矛盾；AC 数量在预算内；范围有明确非目标；关键假设有默认值；未混入技术方案或实现细节。",
  "最多列 3 条 blocking，每条一句话说清改哪里；措辞、格式类意见放 notes，不阻塞。",
  "判断可核对就放行，不为追求完美把整个团队拖进返工。",
  "结构化结果所有字段必填，reason 必须是一句话结论。",
].join("\n");

const REVIEWER_DESIGN_PERSONA = [
  "你是交付总监，只做方案审校：不写代码、不改文档、不运行任何命令。",
  "输入是任务表与检查项清单；最多再读 docs/dev-team/design.md 一次，不读实现源码。",
  "放行只看：任务自包含（步骤里不引用 docs/dev-team 文档）、任务级 AC 能在本任务关闭、同波任务不共享文件、依赖真实、检查项与仓库技术栈相符。",
  "最多列 3 条 blocking；措辞、粒度偏好放 notes，不阻塞。",
  "结构化结果所有字段必填，reason 必须是一句话结论。",
].join("\n");

const ARCHITECT_PERSONA = [
  "你是团队的架构师，负责技术方案设计与任务拆分。",
  "先读仓库代码（≤8 个文件）再下结论，引用 路径:行号 作为依据；没读过就不下断言。",
  "任务必须自包含：steps 里直接写清做什么，禁止「见 design.md §x」「参考 PRD 第 N 条」——工程师不会再读方案与需求文档。",
  "测试与实现放在同一任务（除非测试本身就是独立交付物），不要单拆测试任务制造串行波次。",
  "任务粒度以「能独立验证」为准，每个任务只改 1-3 个文件；同波任务不得共享文件；依赖只写真实依赖。",
  "任务级验收标准只放本任务范围内能关闭的项；全量测试、构建、静态检查归工作流门禁，不许写进任务级 AC。",
  "检查项只能从菜单里选你实际确认可用的 key（可以先试跑一次），不确定就留空；菜单：node-test、node-build、node-lint、pytest、unittest、cargo-test、cargo-build、go-test、go-build。",
  "方案文档 ≤6000 字符；优先复用仓库已有的模式、依赖和工具，新依赖要有明确理由。",
  "PRD 里有技术上不可行或成本畸高的条目时上报并附替代建议，不默默改需求。",
].join("\n");

const ENGINEER_PERSONA = [
  "你是团队的工程师，按任务说明实现代码。",
  "任务说明已包含全部实现信息：不要读 docs/dev-team 下的 PRD/方案文档，只读任务列出的文件与必要周边（≤5 个文件）。",
  "遵循仓库既有风格、命名和错误处理方式；只改任务列出的文件，范围外的问题写进 concerns 上报。",
  "交差前做一次最小自检：跑本任务范围内 1-3 条验证命令；全量测试、构建、静态检查归工作流门禁，不在这里跑。",
  "不谎称跑过没跑的命令、读过没读的文件；不删测试、不改断言、不注掉逻辑来「让检查通过」，遇到矛盾直接上报。",
  "结构化结果所有字段必填。",
].join("\n");

const QA_PERSONA = [
  "你是团队的质量工程师，按 PRD 的 AC 编号逐条验收；说「没问题」必须给得出证据。",
  "只读不改：发现问题写进 issues，修复是工程师的事。",
  "项目级测试、构建、静态检查已由工作流统一执行，直接使用其结果与失败输出，不自己重复跑全量测试/构建/静态检查。",
  "每条结论都要有依据：读了哪个文件哪一行、跑了哪条命令看到什么退出码；没有依据就标存疑，不装作验过。",
  "为了核对行为 AC，最多再跑 10 条命令；优先复用门禁结果。",
  "严重度分级：high 留给数据丢失、崩溃、结果错误；medium 是功能受损但有退路；low 是瑕疵。pass 只在全部 AC 有依据且无未解决 high/medium 问题时为 true。",
  "核对的是 PRD 验收标准原文，不是自己理解的标准；criteria 必须覆盖全部 AC 编号。",
  "结构化结果所有字段必填。",
].join("\n");

const LEAD_PERSONA = [
  "你是团队的技术负责人，快速模式下产品经理与架构师二合一。",
  "一次产出精简需求文档与技术方案：需求部分按产品经理标准（AC 逐条可核对），方案部分按架构师标准（先读代码、任务自包含、依赖显式）。",
  "小需求不求完备，但范围、AC、任务清单三样不能少；任务编号唯一，任务级 AC 只放本任务能关闭的项。",
  "需求阶段只读代码与文档（≤5 个文件），不运行项目命令；PRD ≤2200 字符，方案 ≤4000 字符。",
  "检查项只能从菜单选你实际确认可用的 key：node-test、node-build、node-lint、pytest、unittest、cargo-test、cargo-build、go-test、go-build；不确定就留空。",
  "不编造仓库里不存在的文件或能力；需求与方案矛盾时上报，不硬写。结构化结果所有字段必填。",
].join("\n");

// ===== 任务看板 =====

artifact.board("tasks", {
  title: "任务看板",
  key: "taskId",
  status: "status",
  columns: ["实现中", "需修复", "已完成"],
  cardTitle: "title",
  detail: [{ field: "summary", label: "进展" }],
});

// ===== 预算与纯工具函数（无 LLM 成本） =====

/** 规模分级预算：唯一权威表，文档与提示词都引用它。 */
const SIZE_BUDGETS: Record<string, Budget> = {
  small: { acMax: 8, taskMax: 3, prdSoft: 2200, prdHard: 3500, designSoft: 4000, designHard: 6000 },
  medium: { acMax: 14, taskMax: 5, prdSoft: 3000, prdHard: 4500, designSoft: 6000, designHard: 8000 },
  large: { acMax: 22, taskMax: 8, prdSoft: 4200, prdHard: 6000, designSoft: 8000, designHard: 11000 },
};

/** 门禁菜单：key → 展示名。命令必须写成字面量，菜单只决定跑哪几个。 */
const GATE_NAMES: Record<string, string> = {
  "node-test": "单元测试（npm test）",
  "node-build": "构建（npm run build）",
  "node-lint": "静态检查（npm run lint）",
  pytest: "单元测试（pytest）",
  unittest: "单元测试（unittest discover）",
  "cargo-test": "单元测试（cargo test）",
  "cargo-build": "构建（cargo build）",
  "go-test": "单元测试（go test）",
  "go-build": "构建（go build）",
};

/** 门禁 key → 实际命令（只用于报告与日志展示）。 */
const GATE_COMMANDS: Record<string, string> = {
  "node-test": "npm test",
  "node-build": "npm run build",
  "node-lint": "npm run lint",
  pytest: "python -m pytest -q",
  unittest: "python -m unittest discover -s tests -v",
  "cargo-test": "cargo test",
  "cargo-build": "cargo build",
  "go-test": "go test ./...",
  "go-build": "go build ./...",
};

function normalizeSize(raw: string): string {
  const size = String(raw ?? "").trim().toLowerCase();
  return size === "small" || size === "medium" || size === "large" ? size : "medium";
}

function budgetFor(size: string): Budget {
  return SIZE_BUDGETS[normalizeSize(size)];
}

/** AC 编号：AC-01、AC-02…（渲染与核对共用，QA 必须原样回填）。 */
function acIds(count: number): string[] {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    ids.push(`AC-${String(i + 1).padStart(2, "0")}`);
  }
  return ids;
}

function criterionList(items: string[]): string {
  const ids = acIds(items.length);
  return items.map((item, i) => `${ids[i]} ${item}`).join("\n");
}

/** 把任意 QA 返回的编号归一成 AC-01 形式（容忍 AC-1 / ac01 / 带说明文本）。 */
function canonAcId(raw: string): string {
  const match = /AC[-_\s]*0*(\d+)/i.exec(String(raw ?? ""));
  if (match !== null) return `AC-${String(Number(match[1])).padStart(2, "0")}`;
  return String(raw ?? "").trim().toUpperCase();
}

function oneLine(text: string, max: number): string {
  const flat = String(text ?? "").replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max)}…`;
}

function normalizeSeverity(raw: string): "low" | "medium" | "high" {
  const level = String(raw ?? "").trim().toLowerCase();
  if (level === "high" || level === "medium" || level === "low") return level;
  return "low";
}

function validChecks(keys: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const dropped: string[] = [];
  for (const raw of keys) {
    const key = String(raw ?? "").trim();
    if (key === "" || seen.has(key)) continue;
    if (GATE_NAMES[key] === undefined) {
      dropped.push(key);
      continue;
    }
    seen.add(key);
    result.push(key);
  }
  if (dropped.length > 0) log(`检查项 ${dropped.join("、")} 不在菜单里，已丢弃`);
  return result;
}

/** 拓扑分层：返回每批可并行的任务；有环返回 null。未知依赖视为已满足（单独报问题）。 */
function topoWaves(tasks: DesignTask[]): DesignTask[][] | null {
  const ids = new Set<string>();
  for (const task of tasks) ids.add(String(task.id));
  const pending = tasks.slice();
  const done = new Set<string>();
  const waves: DesignTask[][] = [];
  while (pending.length > 0) {
    const wave = pending.filter((task) => task.dependsOn.every((dep) => !ids.has(dep) || done.has(dep)));
    if (wave.length === 0) return null;
    for (const task of wave) {
      pending.splice(pending.indexOf(task), 1);
      done.add(String(task.id));
    }
    waves.push(wave);
  }
  return waves;
}

/** 执行调度：同时满足依赖与「同批不共享文件」；成环或文件锁死时退化为单任务推进，保证有进展。 */
function scheduleBatches(tasks: DesignTask[]): DesignTask[][] {
  const ids = new Set<string>();
  for (const task of tasks) ids.add(String(task.id));
  const done = new Set<string>();
  const pending = tasks.slice();
  const batches: DesignTask[][] = [];
  while (pending.length > 0) {
    const usedFiles = new Set<string>();
    const batch: DesignTask[] = [];
    for (const task of pending) {
      const depsReady = task.dependsOn.every((dep) => !ids.has(String(dep)) || done.has(String(dep)));
      if (!depsReady) continue;
      const files = task.files.map((file) => String(file ?? "").trim()).filter((file) => file !== "");
      if (files.some((file) => usedFiles.has(file))) continue;
      batch.push(task);
      for (const file of files) usedFiles.add(file);
    }
    if (batch.length === 0) {
      // 依赖成环或剩余任务的文件互相锁死：先单独推进第一个，避免死锁。
      const first = pending[0];
      batches.push([first]);
      pending.splice(0, 1);
      done.add(String(first.id));
      continue;
    }
    for (const task of batch) {
      pending.splice(pending.indexOf(task), 1);
      done.add(String(task.id));
    }
    batches.push(batch);
  }
  return batches;
}

/** 目标文件过滤：QA 只需要看真正的源码/文档改动，不看依赖与构建产物。 */function keepChangedPath(path: string): boolean {
  const p = String(path ?? "").replace(/\\/g, "/");
  if (p === "") return false;
  if (p.startsWith("docs/dev-team/")) return false;
  if (p.startsWith(".git/")) return false;
  if (/(^|\/)(node_modules|\.venv|venv|__pycache__|\.pytest_cache|\.mypy_cache|dist|build|coverage|target|\.next|\.turbo)(\/|$)/.test(p)) return false;
  return true;
}

// ===== 参数 =====

let requirement = String(args.requirement ?? "").trim();
if (requirement === "") {
  // AmendWorkflow 不传递 args，恢复运行时需求文本会丢；此时从工作区已有的 PRD 恢复。
  try {
    const prdText = await files.read("docs/dev-team/prd.md");
    const heading = /^#\s+(?:PRD[：:]\s*)?(\S.*)$/m.exec(prdText);
    if (heading !== null) {
      requirement = heading[1].trim();
      log(`args.requirement 为空，已从 docs/dev-team/prd.md 恢复需求文本：${requirement.slice(0, 80)}`);
    }
  } catch {
    // 工作区没有 docs/dev-team/prd.md，需求保持为空，由产品经理按职责上报
  }
}
const fastMode = String(args.mode ?? "full").toLowerCase() === "fast";
log(`需求已受理（${fastMode ? "快速模式" : "完整模式"}）：${requirement.slice(0, 80)}`);

// ===== 机械校验（零 token，尽量把问题挡在 LLM 审校之前） =====

function prdProblems(prd: Prd, text: string): string[] {
  const problems: string[] = [];
  const budget = budgetFor(prd.size);
  if (String(prd.title ?? "").trim() === "") problems.push("title 不能为空");
  if (String(prd.background ?? "").trim() === "") problems.push("background 不能为空");
  const rawSize = String(prd.size ?? "").trim();
  if (rawSize !== "small" && rawSize !== "medium" && rawSize !== "large") {
    problems.push(`size 只能是 small/medium/large，当前是「${rawSize}」（会按 medium 处理，请写正确）`);
  }
  if (prd.acceptance.length === 0) problems.push("acceptance 至少 1 条");
  if (prd.acceptance.length > budget.acMax) {
    problems.push(`acceptance 有 ${prd.acceptance.length} 条，超过 ${normalizeSize(prd.size)} 档预算 ${budget.acMax} 条，请合并同类项`);
  }
  for (let i = 0; i < prd.acceptance.length; i++) {
    const item = String(prd.acceptance[i] ?? "").trim();
    if (item === "") problems.push(`第 ${i + 1} 条 AC 为空`);
    else if (item.length > 200) problems.push(`第 ${i + 1} 条 AC 长 ${item.length} 字符（上限 200），请压缩`);
  }
  if (prd.nonGoals.filter((x) => String(x ?? "").trim() !== "").length === 0) problems.push("nonGoals 至少 1 条");
  if (text.length > budget.prdHard) {
    problems.push(`prd.md 有 ${text.length} 字符，超过硬上限 ${budget.prdHard}，请压缩到 ${budget.prdSoft} 以内`);
  }
  return problems;
}

function designProblems(design: Design, text: string, size: string): string[] {
  const problems: string[] = [];
  const budget = budgetFor(size);
  if (design.tasks.length === 0) return ["tasks 不能为空"];
  if (design.tasks.length > budget.taskMax) {
    problems.push(`tasks 有 ${design.tasks.length} 个，超过 ${normalizeSize(size)} 档预算 ${budget.taskMax} 个，请合并`);
  }
  const ids = new Set<string>();
  for (const task of design.tasks) {
    const id = String(task.id ?? "").trim();
    if (id === "") problems.push("存在空任务编号");
    else if (ids.has(id)) problems.push(`任务编号 ${id} 重复`);
    else ids.add(id);
  }
  const keys = validChecks(design.checks);
  for (const raw of design.checks) {
    if (String(raw ?? "").trim() !== "" && GATE_NAMES[String(raw).trim()] === undefined) {
      problems.push(`检查项 ${String(raw)} 不在菜单里，请从菜单选或留空`);
    }
  }
  for (const task of design.tasks) {
    const id = String(task.id ?? "").trim();
    if (task.files.length === 0 || task.files.length > 3) problems.push(`任务 ${id} 的 files 必须是 1-3 个`);
    if (task.steps.length === 0 || task.steps.length > 6) problems.push(`任务 ${id} 的 steps 必须是 1-6 条`);
    if (task.acceptance.length === 0 || task.acceptance.length > 4) problems.push(`任务 ${id} 的 acceptance 必须是 1-4 条`);
    for (const dep of task.dependsOn) {
      const depId = String(dep ?? "").trim();
      if (depId === id) problems.push(`任务 ${id} 依赖自己`);
      else if (depId !== "" && !ids.has(depId)) problems.push(`任务 ${id} 依赖不存在的 ${depId}`);
    }
    const joined = [...task.steps, ...task.acceptance].join("\n");
    if (/(design\.md|prd\.md|docs[\/\\]dev-team|见\s*§|参见\s*§|参考\s*PRD|PRD\s*第)/i.test(joined)) {
      problems.push(`任务 ${id} 引用了方案/需求文档，steps 必须自包含（工程师不会读文档）`);
    }
  }
  const waves = topoWaves(design.tasks);
  if (waves === null) {
    problems.push("任务依赖存在环，请调整 dependsOn");
  } else {
    for (const wave of waves) {
      const owners = new Map<string, string>();
      for (const task of wave) {
        for (const file of task.files) {
          const key = String(file ?? "").trim();
          if (key === "") continue;
          const other = owners.get(key);
          if (other !== undefined) problems.push(`同波任务 ${other} 与 ${String(task.id)} 都改 ${key}，同波任务不得共享文件`);
          else owners.set(key, String(task.id));
        }
      }
    }
  }
  if (text.length > budget.designHard) {
    problems.push(`design.md 有 ${text.length} 字符，超过硬上限 ${budget.designHard}，请压缩到 ${budget.designSoft} 以内`);
  }
  if (keys.length === 0 && design.checks.filter((x) => String(x ?? "").trim() !== "").length > 0) {
    problems.push("checks 里没有有效菜单 key，请留空由工作流自动探测");
  }
  return problems;
}

/** 兜底：把不可执行的任务清理成可执行任务（编号去重、丢掉悬空依赖）。 */
function executableTasks(tasks: DesignTask[]): DesignTask[] {
  const result: DesignTask[] = [];
  const ids = new Set<string>();
  for (const task of tasks) {
    const id = String(task.id ?? "").trim();
    if (id === "" || ids.has(id)) continue;
    ids.add(id);
    result.push(task);
  }
  for (const task of result) {
    task.dependsOn = task.dependsOn.filter((dep) => ids.has(String(dep)) && String(dep) !== String(task.id));
  }
  return result;
}

function formatProblems(problems: string[]): string {
  return problems.map((p, i) => `${i + 1}. ${p}`).join("\n");
}

const askFailures: string[] = [];

/**
 * ask 失败（结构化输出 repairing 耗尽、模型报错）不能让整轮作废——已花掉的 token 会全部浪费。
 * 统一降级：记录原因，按「这一步没有产出」处理，绝不让异常冒泡终止整轮。
 */
function recordAskFailure(who: string, error: unknown): void {
  const message = String(error).slice(0, 200);
  askFailures.push(`${who}：${message}`);
  log(`${who} 的请求失败：${message}`);
}

/** ask 失败（结构化输出 repairing 耗尽、模型报错）不能让整轮作废：降级处理并如实记录。
 *  回调里必须写具体的 ask<Interface>：运行时靠它生成结构化输出校验 schema。 */
async function tryAsk<T>(who: string, run: () => PromiseLike<T>): Promise<T | null> {
  try {
    return await run();
  } catch (error) {
    recordAskFailure(who, error);
    return null;
  }
}

/** 流程无法继续时的降级交付报告：如实说明中断原因，而不是让整轮崩溃、token 作废。 */
async function failFast(reason: string, detail: string): Promise<WorkflowReport> {
  const body = [
    `# 交付报告：${reason}`,
    "",
    "## 中断原因",
    detail,
    "",
    "## 建议",
    "- 重新召唤工作流（/dev-team 或 /dev-team-fast）；若反复失败，可先让模型只产出需求文档再重试。",
  ].join("\n");
  try {
    await artifact.markdown("delivery-report", body, {
      title: "交付报告（流程中断）",
      description: "工作流中断，未产生可交付代码",
      primary: true,
    });
  } catch {
    log("中断报告发布失败");
  }
  return {
    conclusion: `不可交付：${reason}。${detail}`,
    findings: [{ where: "工作流", what: reason, evidence: detail, status: "unconfirmed", severity: "high" }],
    verified: [],
    notCovered: ["流程中断，没有完成实现或验收"],
  };
}

// ===== 立项与设计 =====

let prd: Prd;
let design: Design;
const budgetWarnings: string[] = [];
const reviewWarnings: string[] = [];
let prdReviewed = "未审校";
let designReviewed = "未审校";

if (fastMode) {
  phase("技术负责人快速界定需求与方案");
  const lead = agent("技术负责人", { system: LEAD_PERSONA });
  let plan = await tryAsk("技术负责人", () => lead.ask<LitePlan>(`小需求快速立项。用户的原始需求：\n${requirement}\n\n` +
      `先读仓库代码（≤5 个文件），再二合一产出：需求写入 docs/dev-team/prd.md，技术方案与任务拆分写入 docs/dev-team/design.md。\n` +
      `需求部分：标题、背景、size（small/medium/large）、用户故事、验收标准（每条 ≤200 字符、可由一次命令/调用核对）、非目标、假设默认值、风险。PRD ≤2200 字符。\n` +
      `方案部分：关键决策、任务清单（编号唯一、每任务 1-3 个文件、1-6 条自包含步骤、1-4 条任务级 AC、显式依赖、同波不共享文件）、检查项菜单 key。方案 ≤4000 字符。\n` +
      `所有字段必填：title/background/size/stories/acceptance/nonGoals/assumptions/risks 与 approach/conventions/tasks/checks/risks；没有内容就写空数组，不要省略字段。`));
  if (plan === null) return await failFast("快速模式立项失败", "技术负责人没有返回可用的需求与方案（结构化输出校验反复失败）。");
  prd = plan.prd;
  design = plan.design;
  prd.size = normalizeSize(prd.size);

  let prdText = "";
  try {
    prdText = await files.read("docs/dev-team/prd.md");
  } catch {
    prdText = "";
  }
  let problems = prdProblems(prd, prdText === "" ? JSON.stringify(prd) : prdText);
  if (problems.length > 0) {
    log(`快速模式 PRD 机械校验 ${problems.length} 项不合规，发起一次修订`);
    const revised = await tryAsk("技术负责人", () => lead.ask<LitePlan>(`需求文档机械校验未通过，逐条修正后重写 docs/dev-team/prd.md 与 docs/dev-team/design.md，并返回更新后的完整结构化结果：\n${formatProblems(problems)}`));
    if (revised === null) {
      budgetWarnings.push("快速模式 PRD 修订请求失败，沿用上一版需求文档");
    } else {
      plan = revised;
      prd = plan.prd;
      design = plan.design;
      prd.size = normalizeSize(prd.size);
      try {
        prdText = await files.read("docs/dev-team/prd.md");
      } catch {
        prdText = "";
      }
      const again = prdProblems(prd, prdText === "" ? JSON.stringify(prd) : prdText);
      if (again.length > 0) budgetWarnings.push(`快速模式 PRD 修订后仍不合规：${again.join("；")}`);
    }
  }

  let designText = "";
  try {
    designText = await files.read("docs/dev-team/design.md");
  } catch {
    designText = "";
  }
  const designIssues = designProblems(design, designText === "" ? JSON.stringify(design) : designText, prd.size);
  if (designIssues.length > 0) {
    log(`快速模式方案机械校验 ${designIssues.length} 项不合规，发起一次修订`);
    const revised = await tryAsk("技术负责人", () => lead.ask<LitePlan>(`方案机械校验未通过，逐条修正后重写 docs/dev-team/design.md（PRD 不动），并返回更新后的完整结构化结果：\n${formatProblems(designIssues)}`));
    if (revised === null) {
      budgetWarnings.push("快速模式方案修订请求失败，沿用上一版方案");
    } else {
      plan = revised;
      prd = plan.prd;
      design = plan.design;
      prd.size = normalizeSize(prd.size);
      try {
        designText = await files.read("docs/dev-team/design.md");
      } catch {
        designText = "";
      }
      const again = designProblems(design, designText === "" ? JSON.stringify(design) : designText, prd.size);
      if (again.length > 0) budgetWarnings.push(`快速模式方案修订后仍不合规：${again.join("；")}`);
    }
  }

  phase("交付总监快审需求与方案");
  const quickReviewer = agent("交付总监·快审", { system: REVIEWER_PRD_PERSONA });
  const quickVerdict = await tryAsk("交付总监·快审", () => quickReviewer.ask<GateVerdict>(`快速审校。用户的原始需求：\n${requirement}\n\nPRD 路径：docs/dev-team/prd.md（只读该文档，最多再读 2 个仓库文件确认可行性）。\n` +
      `规模：${prd.size}；AC 预算 ${budgetFor(prd.size).acMax} 条，当前 ${prd.acceptance.length} 条；PRD 字符硬上限 ${budgetFor(prd.size).prdHard}。\n` +
      `放行清单：AC 可由一次命令/调用核对且互不矛盾；范围有非目标；假设有默认值；未混入实现细节。只读不改、不跑命令；最多 3 条 blocking，理由必填；notes 可为空数组。`));
  if (quickVerdict === null) {
    reviewWarnings.push("快速审校请求失败，本轮没有做需求与方案审校");
    prdReviewed = "未审校（请求失败）";
    designReviewed = prdReviewed;
  } else {
    if (!quickVerdict.pass) {
      log(`快速审校打回：${quickVerdict.reason}`);
      const revised = await tryAsk("技术负责人", () => lead.ask<LitePlan>(`交付总监打回了需求与方案，理由：${quickVerdict.reason}\n必须修改：${formatProblems(quickVerdict.blocking)}\n` +
          `按意见修订 docs/dev-team/prd.md 与 docs/dev-team/design.md，并返回更新后的完整结构化结果。`));
      if (revised === null) {
        reviewWarnings.push("快速审校打回后的修订请求失败，沿用打回前的版本");
      } else {
        plan = revised;
        prd = plan.prd;
        design = plan.design;
        prd.size = normalizeSize(prd.size);
        reviewWarnings.push(`快速审校打回后未二次审校：${quickVerdict.blocking.join("；")}`);
        // 打回后的修订做一次机械复检（full 模式同样如此）。
        try {
          prdText = await files.read("docs/dev-team/prd.md");
        } catch {
          prdText = "";
        }
        const afterReview = prdProblems(prd, prdText === "" ? JSON.stringify(prd) : prdText);
        if (afterReview.length > 0) budgetWarnings.push(`快速审校修订后仍不合规：${afterReview.join("；")}`);
        try {
          designText = await files.read("docs/dev-team/design.md");
        } catch {
          designText = "";
        }
        const designAfterReview = designProblems(design, designText === "" ? JSON.stringify(design) : designText, prd.size);
        if (designAfterReview.length > 0) budgetWarnings.push(`快速审校修订后方案仍不合规：${designAfterReview.join("；")}`);
      }
    }
    prdReviewed = quickVerdict.pass ? "通过（快速审校）" : "打回后修订（未二次审校）";
    designReviewed = prdReviewed;
  }
} else {
  phase("产品经理界定需求");
  const pm = agent("产品经理", { system: PM_PERSONA });
  const firstPrd = await tryAsk("产品经理", () => pm.ask<Prd>(`用户的原始需求：\n${requirement}\n\n` +
      `先复述你对需求的理解，再产出需求文档并写入 docs/dev-team/prd.md。\n` +
      `规模分级（写进 size）：small=≤2 个文件、无新依赖、无集成；medium=≤5 个文件或 ≤2 个模块；其余 large。\n` +
      `验收标准一条一行（≤200 字符、可由一次命令/调用核对）；同一命令的不同输入合并为一条参数化标准；明确非目标；不确定处记录假设与默认值。\n` +
      `需求阶段只读代码与文档（≤5 个文件），不要运行项目命令、不要实测 AC。PRD ≤3000 字符，不写技术方案、不写测试代码。\n` +
      `所有字段必填：title/background/size/stories/acceptance/nonGoals/assumptions/risks；没有内容就写空数组，不要省略字段。`));
  if (firstPrd === null) return await failFast("需求界定失败", "产品经理没有返回可用的 PRD（结构化输出校验反复失败）。");
  prd = firstPrd;
  prd.size = normalizeSize(prd.size);

  let prdText = "";
  try {
    prdText = await files.read("docs/dev-team/prd.md");
  } catch {
    prdText = "";
  }
  let prdIssueList = prdProblems(prd, prdText === "" ? JSON.stringify(prd) : prdText);
  if (prdIssueList.length > 0) {
    log(`PRD 机械校验 ${prdIssueList.length} 项不合规，发起一次修订`);
    const revised = await tryAsk("产品经理", () => pm.ask<Prd>(`需求文档机械校验未通过，逐条修正后重写 docs/dev-team/prd.md，并返回更新后的完整结构化结果：\n${formatProblems(prdIssueList)}`));
    if (revised === null) {
      budgetWarnings.push("PRD 修订请求失败，沿用上一版需求文档");
    } else {
      prd = revised;
      prd.size = normalizeSize(prd.size);
      try {
        prdText = await files.read("docs/dev-team/prd.md");
      } catch {
        prdText = "";
      }
      prdIssueList = prdProblems(prd, prdText === "" ? JSON.stringify(prd) : prdText);
      if (prdIssueList.length > 0) budgetWarnings.push(`PRD 修订后仍不合规：${prdIssueList.join("；")}`);
    }
  }
  log(`PRD 已写入：${prdText.length} 字符 / ${prd.acceptance.length} 条 AC（${prd.size} 档预算 ${budgetFor(prd.size).acMax} 条）`);

  phase("交付总监审校需求");
  const prdReviewer = agent("交付总监·需求审校", { system: REVIEWER_PRD_PERSONA });
  const prdVerdict = await tryAsk("交付总监·需求审校", () => prdReviewer.ask<GateVerdict>(`需求审校。用户的原始需求：\n${requirement}\n\n` +
      `PRD 路径：docs/dev-team/prd.md（只读该文档，最多再读 2 个仓库文件确认可行性）。\n` +
      `规模：${prd.size}；AC 预算 ${budgetFor(prd.size).acMax} 条，当前 ${prd.acceptance.length} 条；PRD 字符软/硬上限 ${budgetFor(prd.size).prdSoft}/${budgetFor(prd.size).prdHard}。\n` +
      `放行清单：1) 每条 AC 可由一次命令/调用核对且互不矛盾；2) 范围有明确非目标；3) 关键假设有默认值；4) 未混入技术方案或实现细节；5) AC 数量在预算内。\n` +
      `只读不改、不跑命令；最多列 3 条 blocking（每条一句话说清改哪里），措辞类意见放 notes；理由必填；notes 可为空数组。`));
  if (prdVerdict === null) {
    reviewWarnings.push("需求审校请求失败，本轮没有做需求审校");
    prdReviewed = "未审校（请求失败）";
  } else {
    if (!prdVerdict.pass) {
      log(`需求审校打回：${prdVerdict.reason}`);
      const revised = await tryAsk("产品经理", () => pm.ask<Prd>(`交付总监打回了需求文档，理由：${prdVerdict.reason}\n必须修改：${formatProblems(prdVerdict.blocking)}\n` +
          `按意见修订 docs/dev-team/prd.md，并返回更新后的完整结构化结果。`));
      if (revised === null) {
        reviewWarnings.push("需求审校打回后的修订请求失败，沿用打回前的版本");
      } else {
        prd = revised;
        prd.size = normalizeSize(prd.size);
        reviewWarnings.push(`需求审校打回：${prdVerdict.blocking.join("；")}`);
        // 打回后不再二次审校：节省一轮持久上下文，问题如实进报告。但要做一次机械复检。
        try {
          prdText = await files.read("docs/dev-team/prd.md");
        } catch {
          prdText = "";
        }
        const afterReview = prdProblems(prd, prdText === "" ? JSON.stringify(prd) : prdText);
        if (afterReview.length > 0) budgetWarnings.push(`需求审校修订后仍不合规：${afterReview.join("；")}`);
      }
    }
    prdReviewed = prdVerdict.pass ? "通过" : "打回后修订（未二次审校）";
  }

  phase("架构师技术设计与任务拆分");
  const architect = agent("架构师", { system: ARCHITECT_PERSONA });
  const prdBudget = budgetFor(prd.size);
  const firstDesign = await tryAsk("架构师", () => architect.ask<Design>(`用户需求：${oneLine(requirement, 400)}\n\n` +
      `产品经理的 PRD 位于 docs/dev-team/prd.md（请先读它）。规模 ${prd.size}：任务上限 ${prdBudget.taskMax} 个，方案 ≤${prdBudget.designSoft} 字符（硬上限 ${prdBudget.designHard}）。\n` +
      `验收标准（给你定位范围用）：\n${criterionList(prd.acceptance)}\n\n` +
      `先读仓库（≤8 个文件），再产出技术方案与任务拆分，写入 docs/dev-team/design.md。\n` +
      `任务必须自包含：steps 写清做什么，禁止「见 design.md §x」「参考 PRD 第 N 条」；测试与实现放同一任务，不要单拆测试任务；每任务 1-3 个文件、1-6 条步骤、1-4 条任务级 AC；同波任务不共享文件；依赖只写真实依赖。\n` +
      `检查项只能从菜单选你实际确认可用的 key，不确定就留空：node-test、node-build、node-lint、pytest、unittest、cargo-test、cargo-build、go-test、go-build。\n` +
      `所有字段必填：approach/conventions/tasks/checks/risks；tasks 每项含 id/title/files/steps/acceptance/dependsOn；没有内容就写空数组，不要省略字段。`));
  if (firstDesign === null) return await failFast("技术设计失败", "架构师没有返回可用的技术方案与任务拆分（结构化输出校验反复失败）。");
  design = firstDesign;
  let designText = "";
  try {
    designText = await files.read("docs/dev-team/design.md");
  } catch {
    designText = "";
  }
  let designIssueList = designProblems(design, designText === "" ? JSON.stringify(design) : designText, prd.size);
  if (designIssueList.length > 0) {
    log(`方案机械校验 ${designIssueList.length} 项不合规，发起一次修订`);
    const revised = await tryAsk("架构师", () => architect.ask<Design>(`方案机械校验未通过，逐条修正后重写 docs/dev-team/design.md，并返回更新后的完整结构化结果：\n${formatProblems(designIssueList)}`));
    if (revised === null) {
      budgetWarnings.push("方案修订请求失败，沿用上一版方案");
    } else {
      design = revised;
      try {
        designText = await files.read("docs/dev-team/design.md");
      } catch {
        designText = "";
      }
      designIssueList = designProblems(design, designText === "" ? JSON.stringify(design) : designText, prd.size);
      if (designIssueList.length > 0) budgetWarnings.push(`方案修订后仍不合规：${designIssueList.join("；")}`);
    }
  }

  phase("交付总监审校方案");
  const designReviewer = agent("交付总监·方案审校", { system: REVIEWER_DESIGN_PERSONA });
  const taskTable = design.tasks
    .map(
      (task) =>
        `- ${task.id}｜${oneLine(task.title, 40)}｜文件：${task.files.join("、")}｜依赖：${task.dependsOn.length === 0 ? "无" : task.dependsOn.join("、")}｜步骤 ${task.steps.length} 条｜AC ${task.acceptance.length} 条`,
    )
    .join("\n");
  const designVerdict = await tryAsk("交付总监·方案审校", () => designReviewer.ask<GateVerdict>(`方案审校。用户需求：${oneLine(requirement, 300)}\n\n` +
      `PRD 摘要：${oneLine(prd.title, 60)}；${prd.acceptance.length} 条 AC；规模 ${prd.size}。方案路径：docs/dev-team/design.md。\n` +
      `技术方案摘要：${oneLine(design.approach, 500)}\n` +
      `检查项：${design.checks.length === 0 ? "（空，由工作流自动探测）" : design.checks.join("、")}\n` +
      `任务表：\n${taskTable}\n\n` +
      `放行清单：任务自包含（steps 不引用 docs/dev-team 文档、不写「参考 PRD 第 N 条」）；任务级 AC 可在本任务关闭；同波任务不共享文件；依赖真实；检查项与仓库技术栈相符。\n` +
      `只读不改、不跑命令；最多 3 条 blocking，措辞类意见放 notes；理由必填；notes 可为空数组。`));
  if (designVerdict === null) {
    reviewWarnings.push("方案审校请求失败，本轮没有做方案审校");
    designReviewed = "未审校（请求失败）";
  } else {
    if (!designVerdict.pass) {
      log(`方案审校打回：${designVerdict.reason}`);
      const revised = await tryAsk("架构师", () => architect.ask<Design>(`交付总监打回了技术方案，理由：${designVerdict.reason}\n必须修改：${formatProblems(designVerdict.blocking)}\n` +
          `按意见修订 docs/dev-team/design.md，并返回更新后的完整结构化结果。`));
      if (revised === null) {
        reviewWarnings.push("方案审校打回后的修订请求失败，沿用打回前的版本");
      } else {
        design = revised;
        reviewWarnings.push(`方案审校打回：${designVerdict.blocking.join("；")}`);
        try {
          designText = await files.read("docs/dev-team/design.md");
        } catch {
          designText = "";
        }
        const afterReview = designProblems(design, designText === "" ? JSON.stringify(design) : designText, prd.size);
        if (afterReview.length > 0) budgetWarnings.push(`方案审校修订后仍不合规：${afterReview.join("；")}`);
      }
    }
    designReviewed = designVerdict.pass ? "通过" : "打回后修订（未二次审校）";
  }
}

// ===== 实现：按依赖波次并行 =====

const tasks = executableTasks(design.tasks);
if (tasks.length === 0) {
  log("架构师没有给出可执行任务，无法进入实现阶段");
}

phase("工程师按批次并行实现");

const engineerList: EngineerSlot[] = [];
const latestResults = new Map<string, TaskResult>();
const extraSummaries: string[] = [];
const taskTitles = new Map<string, string>();
const failedTaskIds = new Set<string>();
for (const task of tasks) taskTitles.set(String(task.id), String(task.title));

function depSummaries(task: DesignTask): string {
  const lines: string[] = [];
  for (const dep of task.dependsOn) {
    const result = latestResults.get(String(dep));
    if (result !== undefined) lines.push(`${String(dep)}：${oneLine(result.summary, 200)}`);
  }
  return lines.length > 0 ? lines.join("\n") : "无";
}

const batches = scheduleBatches(tasks);
if (topoWaves(tasks) === null) log("任务依赖仍存在环，调度器退化为单任务串行推进（不并发改同一批文件）");
// 宿主并发上限为 6，单批再切一刀，避免一次开太多子代理。
const MAX_PARALLEL = 5;
for (let waveIndex = 0; waveIndex < batches.length; waveIndex++) {
  const batch = batches[waveIndex];
  log(`第 ${waveIndex + 1} 批实现 ${batch.length} 个任务：${batch.map((task) => String(task.id)).join("、")}`);

  for (let chunkStart = 0; chunkStart < batch.length; chunkStart += MAX_PARALLEL) {
    const chunk = batch.slice(chunkStart, chunkStart + MAX_PARALLEL);
    await Promise.all(
      chunk.map(async (task) => {
        const taskId = String(task.id);
        const engineer = agent(`工程师·${taskId}`, { system: ENGINEER_PERSONA });
        engineerList.push({ id: taskId, agent: engineer });
        const result = await tryAsk(`工程师·${taskId}`, () => engineer.ask<TaskResult>(`你的任务 ${taskId}：${String(task.title)}\n\n` +
            `涉及文件（只改这些）：${task.files.join("、")}\n` +
            `实现步骤：\n${task.steps.map((step, i) => `${i + 1}. ${String(step)}`).join("\n")}\n` +
            `本任务验收标准：\n${criterionList(task.acceptance)}\n` +
            `依赖任务的改动摘要：\n${depSummaries(task)}\n\n` +
            `工作纪律：任务说明已含全部信息，不要读 docs/dev-team 文档；只读上面列出的文件与必要周边（≤5 个文件）；只改列出的文件；` +
            `写完跑 1-3 条本任务范围内的最小验证命令；全量测试/构建/静态检查归工作流门禁，不要跑。\n` +
            `所有字段必填：taskId/summary/filesChanged/concerns；没有内容就写空数组，不要省略字段。`));
        if (result === null) {
          failedTaskIds.add(taskId);
          latestResults.set(taskId, {
            taskId,
            summary: "工程师请求失败（模型或结构化输出错误），本任务没有完成",
            filesChanged: [],
            concerns: ["工程师请求失败"],
          });
          report({ taskId, title: String(task.title), status: "需修复", summary: "工程师请求失败，本任务未完成" }, "tasks");
          return;
        }
        latestResults.set(taskId, result);
        report({ taskId, title: String(task.title), status: "实现中", summary: oneLine(result.summary, 200) }, "tasks");
      }),
    );
  }
}

if (batches.length > 1) log(`实现分 ${batches.length} 批（依赖或文件冲突导致的串行）`);

// 改动文件清单：git 优先，工程师自报兜底；过滤依赖与构建产物。
const changedPaths = new Set<string>();
try {
  for (const path of await git.changedFiles()) {
    if (keepChangedPath(path)) changedPaths.add(path);
  }
} catch {
  // 非 git 仓库，退回工程师自报的文件清单
}
for (const slot of engineerList) {
  const result = latestResults.get(slot.id);
  if (result !== undefined) {
    for (const path of result.filesChanged) {
      if (keepChangedPath(path)) changedPaths.add(path);
    }
  }
}

// ===== 确定性检查（工作流统一执行；每个 world.run 都捕获，spawn 失败不拖垮整轮） =====

phase("确定性检查");

let nodeScripts: Record<string, string> = {};
let pyprojectText = "";
let rustProject = false;
let goProject = false;
let testDir = "";
try {
  const pkg = JSON.parse(await files.read("package.json"));
  if (pkg && typeof pkg === "object" && pkg.scripts && typeof pkg.scripts === "object") {
    nodeScripts = pkg.scripts;
  }
} catch {
  // 仓库没有 package.json
}
try {
  pyprojectText = await files.read("pyproject.toml");
} catch {
  // 没有 pyproject.toml
}
try {
  await files.read("Cargo.toml");
  rustProject = true;
} catch {
  // 非 Rust 项目
}
try {
  await files.read("go.mod");
  goProject = true;
} catch {
  // 非 Go 项目
}
try {
  const testFiles = await files.glob("tests/**");
  if (testFiles.length > 0) testDir = "tests";
} catch {
  // 没有 tests 目录
}
if (testDir === "") {
  try {
    const testFiles = await files.glob("test/**");
    if (testFiles.length > 0) testDir = "test";
  } catch {
    // 没有 test 目录
  }
}
const hasTestsDir = testDir !== "";
let pytestLikely = /pytest/i.test(pyprojectText);
if (!pytestLikely) {
  try {
    pytestLikely = /pytest/i.test(await files.read("pytest.ini"));
  } catch {
    // 没有 pytest.ini
  }
}
if (!pytestLikely) {
  try {
    pytestLikely = /pytest/i.test(await files.read("setup.cfg"));
  } catch {
    // 没有 setup.cfg
  }
}
if (!pytestLikely) {
  try {
    pytestLikely = /pytest/i.test(await files.read("requirements.txt"));
  } catch {
    // 没有 requirements.txt
  }
}

/**
 * 「不可用」只表示：命令根本跑不起来（spawn 失败）、超时，或测试命令没有收集到任何用例。
 * 不能用输出文本猜「命令不存在」——被测程序自己的 traceback 里就常出现 No such file / ENOENT，
 * 那会把一次真实失败误判成「不可用」而放行（这是回归审计发现的 P0）。
 */
function noTestsDetected(output: string): string {
  if (/Ran 0 tests/i.test(output)) return "unittest 没有收集到测试（Ran 0 tests）";
  if (/(no tests ran|no tests collected|collected 0 items)/i.test(output)) return "pytest 没有收集到测试";
  if (/running 0 tests/i.test(output)) return "cargo 没有测试用例（running 0 tests）";
  if (/no test files/i.test(output)) return "go 没有测试文件（no test files）";
  if (/no test specified/i.test(output)) return "npm 未配置测试脚本（no test specified）";
  if (/# tests 0\b/i.test(output)) return "node 测试运行器没有发现测试（# tests 0）";
  return "";
}

/** 测试类门禁：没有用例时不算通过，也不算失败，记「不可用」并说明原因。 */
const TEST_GATE_KEYS = new Set<string>(["node-test", "pytest", "unittest", "cargo-test", "go-test"]);

/** spawn 失败（命令本身不存在）才值得换一个可执行名重试；超时/取消不能重试。 */
function isSpawnFailure(error: unknown): boolean {
  const message = typeof error === "object" && error !== null && "message" in error ? String((error as { message?: unknown }).message) : String(error);
  return /(spawn_error|ENOENT|not recognized|not found|No such file|不是内部或外部命令)/i.test(message);
}

function isTimeoutFailure(error: unknown): boolean {
  const message = typeof error === "object" && error !== null && "message" in error ? String((error as { message?: unknown }).message) : String(error);
  return /(timeout|timed out|超时)/i.test(message);
}

function gateFrom(key: string, command: string, result: WorldRunResult): GateRun {
  const output = `${result.stderr}${result.stdout}`.trim();
  return {
    key,
    name: GATE_NAMES[key] ?? key,
    command,
    exitCode: result.exitCode,
    output: output.slice(-2000),
    unavailable: false,
  };
}

/** npm 在 Windows 上是 shell shim，直接 spawn 可能 ENOENT；只在「spawn 失败」时退 npm.cmd。
 *  超时、被取消等其它失败不重试——重试只会重复副作用并再等一个超时周期。 */
async function runNpm(commandArgs: string[], timeoutMs: number): Promise<WorldRunResult> {
  try {
    return await world.run("npm", commandArgs, { timeoutMs, output: { tail: 4000 } });
  } catch (error) {
    if (!isSpawnFailure(error)) throw error;
    return await world.run("npm.cmd", commandArgs, { timeoutMs, output: { tail: 4000 } });
  }
}

/** python 在 Windows 上可能是 py 启动器；只在 spawn 失败时回退。 */
async function runPy(commandArgs: string[], timeoutMs: number): Promise<WorldRunResult> {
  try {
    return await world.run("python", commandArgs, { timeoutMs, output: { tail: 4000 } });
  } catch (error) {
    if (!isSpawnFailure(error)) throw error;
    return await world.run("py", commandArgs, { timeoutMs, output: { tail: 4000 } });
  }
}

async function runNodeTest(): Promise<GateRun> {
  return gateFrom("node-test", "npm test", await runNpm(["test"], 600000));
}
async function runNodeBuild(): Promise<GateRun> {
  return gateFrom("node-build", "npm run build", await runNpm(["run", "build"], 900000));
}
async function runNodeLint(): Promise<GateRun> {
  return gateFrom("node-lint", "npm run lint", await runNpm(["run", "lint"], 300000));
}
async function runPytest(): Promise<GateRun> {
  const gate = gateFrom("pytest", "python -m pytest -q", await runPy(["-m", "pytest", "-q"], 600000));
  // pytest 退出码 5 = 没有收集到测试，属于「无测试可跑」而不是代码失败。
  if (gate.exitCode === 5) {
    gate.unavailable = true;
    gate.output = `没有收集到测试（pytest 退出码 5）：${gate.output}`;
  }
  return gate;
}
async function runUnittest(): Promise<GateRun> {
  const dir = testDir === "" ? "tests" : testDir;
  return gateFrom("unittest", `python -m unittest discover -s ${dir} -v`, await runPy(["-m", "unittest", "discover", "-s", dir, "-v"], 600000));
}
async function runCargoTest(): Promise<GateRun> {
  return gateFrom("cargo-test", "cargo test", await world.run("cargo", ["test"], { timeoutMs: 900000, output: { tail: 4000 } }));
}
async function runCargoBuild(): Promise<GateRun> {
  return gateFrom("cargo-build", "cargo build", await world.run("cargo", ["build"], { timeoutMs: 900000, output: { tail: 4000 } }));
}
async function runGoTest(): Promise<GateRun> {
  return gateFrom("go-test", "go test ./...", await world.run("go", ["test", "./..."], { timeoutMs: 600000, output: { tail: 4000 } }));
}
async function runGoBuild(): Promise<GateRun> {
  return gateFrom("go-build", "go build ./...", await world.run("go", ["build", "./..."], { timeoutMs: 600000, output: { tail: 4000 } }));
}

const GATE_FNS: Record<string, () => Promise<GateRun>> = {
  "node-test": runNodeTest,
  "node-build": runNodeBuild,
  "node-lint": runNodeLint,
  pytest: runPytest,
  unittest: runUnittest,
  "cargo-test": runCargoTest,
  "cargo-build": runCargoBuild,
  "go-test": runGoTest,
  "go-build": runGoBuild,
};

async function runGate(key: string): Promise<GateRun> {
  const fn = GATE_FNS[key];
  if (fn === undefined) {
    return { key, name: key, command: GATE_COMMANDS[key] ?? key, exitCode: -1, output: "未注册的检查项", unavailable: true };
  }
  try {
    const gate = await fn();
    if (TEST_GATE_KEYS.has(key)) {
      const reason = noTestsDetected(gate.output);
      if (reason !== "") {
        gate.unavailable = true;
        gate.output = `${reason}：${gate.output}`;
      }
    }
    return gate;
  } catch (error) {
    const timedOut = isTimeoutFailure(error);
    return {
      key,
      name: GATE_NAMES[key] ?? key,
      command: GATE_COMMANDS[key] ?? key,
      exitCode: -1,
      output: `${timedOut ? "命令超时未完成" : "命令无法执行"}：${String(error)}`.slice(0, 2000),
      // 超时与命令缺失都不构成「代码质量失败」的结论；计入未覆盖项，由 QA 的行为核对兜底。
      unavailable: true,
    };
  }
}

const detectedChecks: string[] = [];
const nodeTestScript = typeof nodeScripts.test === "string" ? nodeScripts.test : "";
// npm init 的默认测试脚本是 `echo "Error: no test specified" && exit 1`，不能当作真实门禁。
if (nodeTestScript !== "" && !/no test specified/i.test(nodeTestScript)) detectedChecks.push("node-test");
if (typeof nodeScripts.build === "string") detectedChecks.push("node-build");
if (typeof nodeScripts.lint === "string") detectedChecks.push("node-lint");
if (pytestLikely && hasTestsDir) detectedChecks.push("pytest");
if (hasTestsDir && !pytestLikely) detectedChecks.push("unittest");
if (rustProject) detectedChecks.push("cargo-test");
if (rustProject) detectedChecks.push("cargo-build");
if (goProject) detectedChecks.push("go-test");
if (goProject) detectedChecks.push("go-build");

let selectedChecks = validChecks(design.checks);
if (selectedChecks.length === 0) {
  selectedChecks = detectedChecks;
  if (selectedChecks.length > 0) log(`架构师未指定检查项，按仓库文件自动探测：${selectedChecks.join("、")}`);
} else {
  const missing = selectedChecks.filter((key) => !detectedChecks.includes(key));
  if (missing.length > 0) log(`检查项 ${missing.join("、")} 未被自动探测确认，仍按架构师选择执行`);
}

const gateRuns: GateRun[] = [];
if (selectedChecks.length === 0) {
  log("未发现可执行的检查命令，QA 将仅做代码与行为审阅");
} else {
  log(`执行项目检查：${selectedChecks.join("、")}`);
  for (const key of selectedChecks) {
    const gate = await runGate(key);
    gateRuns.push(gate);
    log(`${gate.name}（${gate.command}）退出码 ${gate.exitCode}${gate.unavailable ? "（命令不可用，不计失败）" : ""}`);
  }
}

function failingGates(): GateRun[] {
  return gateRuns.filter((gate) => gate.exitCode !== 0 && !gate.unavailable);
}

async function rerunGates(keys: string[]): Promise<void> {
  for (const key of keys) {
    const gate = await runGate(key);
    const index = gateRuns.findIndex((item) => item.key === key);
    if (index >= 0) gateRuns[index] = gate;
    log(`${gate.name} 重跑退出码 ${gate.exitCode}${gate.unavailable ? "（命令不可用）" : ""}`);
  }
}

function gateDigest(): string {
  if (gateRuns.length === 0) return "未发现可执行的检查命令";
  return gateRuns
    .map((gate) => {
      const head = `${gate.name}（${gate.command}）退出码 ${gate.exitCode}${gate.unavailable ? "（不可用）" : ""}`;
      const tail = gate.exitCode === 0 || gate.unavailable ? "" : `；输出摘要：${oneLine(gate.output, 200)}`;
      return `${head}${tail}`;
    })
    .join("\n");
}

function gateFailureText(gates: GateRun[]): string {
  return gates
    .map((gate) => `${gate.name}（${gate.command}）退出码 ${gate.exitCode}\n${oneLine(gate.output, 1200)}`)
    .join("\n\n");
}

function taskDigest(): string {
  const lines: string[] = [];
  for (const slot of engineerList) {
    const result = latestResults.get(slot.id);
    lines.push(`${slot.id}：${result === undefined ? "无摘要" : oneLine(result.summary, 220)}`);
  }
  for (const summary of extraSummaries) lines.push(summary);
  return lines.length > 0 ? lines.join("\n") : "无任务";
}

// ===== 集成验收（QA 按 PRD 的 AC 编号逐条给证据） =====

phase("集成验收");

const qa = agent("QA 工程师", { system: QA_PERSONA });
const expectedAcIds = acIds(prd.acceptance.length);
const changedList = Array.from(changedPaths);
const changedForPrompt = changedList.slice(0, 60).join("\n");

function qaPrompt(extra: string): string {
  return (
    `集成验收（只读不改）。PRD 验收标准（编号必须原样回填）：\n${criterionList(prd.acceptance)}\n\n` +
    `项目检查结果（工作流已统一执行，不要重复跑全量测试/构建/静态检查）：\n${gateDigest()}\n\n` +
    `改动文件（逐个读，核对实现；共 ${changedList.length} 个）：\n${changedForPrompt}${changedList.length > 60 ? `\n…另有 ${changedList.length - 60} 个未列出` : ""}\n\n` +
    `各任务改动摘要：\n${taskDigest()}\n\n` +
    `要求：逐条核对 AC，给出 met 与 evidence（读到的 路径:行号，或命令+退出码+关键输出）；criteria 必须覆盖全部 ${expectedAcIds.length} 个 AC 编号；` +
    `只读不改，读文件 ≤15 个；为核对行为最多再跑 10 条命令；问题写 issues（where/what/severity/affectedTaskIds）；` +
    `pass 仅在全部 AC 有依据且无未解决 high/medium 问题时为 true；checked 写实际做了哪些检查。所有字段必填（没有内容就写空数组）。${extra}`
  );
}

/** 按 AC 编号合并两次 QA 结论：更新后的条目覆盖旧条目，未更新的条目保留（避免复核丢条目）。 */
function mergeQaVerdict(base: QaVerdict, update: QaVerdict): QaVerdict {
  const order: string[] = [];
  const byId = new Map<string, QaCriterion>();
  for (const item of base.criteria) {
    const key = canonAcId(item.id);
    if (!byId.has(key)) order.push(key);
    byId.set(key, item);
  }
  for (const item of update.criteria) {
    const key = canonAcId(item.id);
    if (!byId.has(key)) order.push(key);
    byId.set(key, item);
  }
  const criteria: QaCriterion[] = [];
  for (const key of order) {
    const item = byId.get(key);
    if (item !== undefined) criteria.push(item);
  }
  return {
    pass: update.pass,
    criteria,
    issues: update.issues,
    checked: update.checked.length > 0 ? update.checked : base.checked,
  };
}

let qaVerdict: QaVerdict;
let qaFailedToRun = false;
try {
  qaVerdict = await qa.ask<QaVerdict>(qaPrompt(""));
} catch (error) {
  qaFailedToRun = true;
  qaVerdict = {
    pass: false,
    criteria: [],
    issues: [{ where: "QA 工程师", what: `QA 首轮验收请求失败：${String(error).slice(0, 200)}`, severity: "high", affectedTaskIds: [] }],
    checked: [],
  };
  log("QA 首轮验收请求失败，按未通过处理并如实记录");
}

/** 补齐 QA 漏掉的 AC 编号（同一会话一次，不重新做整轮验收）。 */
async function fillMissingAc(verdict: QaVerdict): Promise<QaVerdict> {
  const seen = new Set<string>();
  for (const item of verdict.criteria) seen.add(canonAcId(item.id));
  const missing = expectedAcIds.filter((id) => !seen.has(id));
  if (missing.length === 0) return verdict;
  log(`QA 结论缺少 ${missing.length} 条 AC：${missing.join("、")}，追加一次补全`);
  try {
    const repaired = await qa.ask<QaVerdict>(
      `以下 AC 编号缺少结论：${missing.join("、")}。只补齐这些条目（met + evidence），其余条目原样保留，返回完整结构化结果（覆盖全部 ${expectedAcIds.length} 个编号）。`,
    );
    return mergeQaVerdict(verdict, repaired);
  } catch {
    return verdict;
  }
}

if (!qaFailedToRun) qaVerdict = await fillMissingAc(qaVerdict);
log(`QA 初验：${qaVerdict.pass ? "通过" : "未通过"}，${qaVerdict.criteria.length} 条结论、${qaVerdict.issues.length} 个问题`);

// 一轮修复：优先复用相关任务的工程师，映射不到就派一个修复工程师。
if (!qaVerdict.pass || failingGates().length > 0) {
  const failing = failingGates();
  const fixIds = new Set<string>();
  for (const issue of qaVerdict.issues) {
    for (const taskId of issue.affectedTaskIds) fixIds.add(String(taskId));
  }
  const targets = engineerList.filter((slot) => fixIds.has(slot.id));
  const brief =
    `QA/门禁未通过，需要修复。\n\n问题清单：\n${JSON.stringify(qaVerdict.issues)}\n\n` +
    `门禁失败输出：\n${failing.length === 0 ? "无" : gateFailureText(failing)}\n\n` +
    `改动文件：\n${changedForPrompt}\n\n` +
    `只修与上述问题直接相关的内容；不删测试、不改断言、不注掉逻辑；改完返回结构化结果。`;
  log(`进入修复轮：${targets.length > 0 ? `相关工程师 ${targets.map((slot) => slot.id).join("、")}` : "派修复工程师"}`);
  if (targets.length > 0) {
    const fixed = await Promise.all(
      targets.map((slot) => slot.agent.ask<TaskResult>(`${brief}\n你的任务编号：${slot.id}`)),
    );
    for (let i = 0; i < targets.length; i++) {
      const slot = targets[i];
      const result = fixed[i];
      if (result !== undefined) {
        latestResults.set(slot.id, result);
        report({ taskId: slot.id, title: taskTitles.get(slot.id) ?? slot.id, status: "需修复", summary: oneLine(result.summary, 200) }, "tasks");
      }
    }
  } else if (changedPaths.size > 0) {
    const fixer = agent("修复工程师", { system: ENGINEER_PERSONA });
    const fixed = await tryAsk("修复工程师", () => fixer.ask<TaskResult>(`${brief}\n你没有任务编号，按问题清单定位并修复上述改动文件。\n所有字段必填：taskId/summary/filesChanged/concerns；没有内容就写空数组。`));
    if (fixed === null) {
      log("修复工程师请求失败，跳过修复并如实记录");
      reviewWarnings.push("修复工程师请求失败，本轮没有修复");
    } else {
      latestResults.set("修复", fixed);
      extraSummaries.push(`修复工程师：${oneLine(fixed.summary, 200)}`);
      log(`修复工程师完成：${oneLine(fixed.summary, 120)}`);
    }
  } else {
    log("没有可修复的文件（QA 结论可能指向环境或需求问题），跳过修复");
  }

  if (failing.length > 0) await rerunGates(failing.map((gate) => gate.key));

  try {
    const recheck = await qa.ask<QaVerdict>(
      `复核。上一轮问题：\n${JSON.stringify(qaVerdict.issues)}\n\n修复说明：\n${taskDigest()}\n\n` +
        `最新检查结果：\n${gateDigest()}\n\n` +
        `只更新受影响的 AC 与 issues，未受影响的条目原样保留；返回完整结构化结论（覆盖全部 ${expectedAcIds.length} 个 AC 编号），所有字段必填。`,
    );
    qaVerdict = mergeQaVerdict(qaVerdict, recheck);
    qaVerdict = await fillMissingAc(qaVerdict);
  } catch (error) {
    log(`QA 复核失败，沿用上一轮结论：${String(error).slice(0, 120)}`);
  }
}

// ===== 交付判定与报告（确定性，不再让子代理重跑 AC） =====

const finalFailing = failingGates();
const unavailableGates = gateRuns.filter((gate) => gate.unavailable);
const usableGates = gateRuns.filter((gate) => !gate.unavailable);
const acById = new Map<string, QaCriterion>();
for (const item of qaVerdict.criteria) {
  const id = canonAcId(item.id);
  if (!acById.has(id)) acById.set(id, item);
}
const unmetIds = expectedAcIds.filter((id) => {
  const item = acById.get(id);
  return item === undefined || !item.met;
});
const metIds = expectedAcIds.filter((id) => {
  const item = acById.get(id);
  return item !== undefined && item.met;
});
const missingEvidence = expectedAcIds.filter((id) => {
  const item = acById.get(id);
  return item === undefined || String(item.evidence ?? "").trim() === "";
});
const blockingIssues = qaVerdict.issues.filter((issue) => normalizeSeverity(issue.severity) !== "low");
const deliverable =
  qaVerdict.pass &&
  unmetIds.length === 0 &&
  missingEvidence.length === 0 &&
  blockingIssues.length === 0 &&
  finalFailing.length === 0 &&
  failedTaskIds.size === 0 &&
  tasks.length > 0 &&
  expectedAcIds.length > 0;

const checkSummary =
  gateRuns.length === 0
    ? "项目没有可执行的检查命令"
    : `项目检查 ${gateRuns.length} 项：${usableGates.length - finalFailing.length} 通过 / ${unavailableGates.length} 不可用 / ${finalFailing.length} 失败`;
const blockingReasons: string[] = [];
if (tasks.length === 0) blockingReasons.push("没有可执行任务");
if (expectedAcIds.length === 0) blockingReasons.push("没有验收标准");
if (blockingIssues.length > 0) blockingReasons.push(`${blockingIssues.length} 个未解决的高/中严重度问题`);
if (failedTaskIds.size > 0) blockingReasons.push(`${failedTaskIds.size} 个任务因请求失败没有完成`);
const conclusion = deliverable
  ? `可交付：${prd.title}。${tasks.length} 个任务、${expectedAcIds.length} 条验收标准已由 QA 逐条核对（${metIds.length}/${expectedAcIds.length} 条有通过证据）；${checkSummary}。`
  : `不可交付：${prd.title}。${blockingReasons.length > 0 ? `原因：${blockingReasons.join("、")}；` : ""}未通过 AC ${unmetIds.length} 条、缺证据 ${missingEvidence.length} 条、失败检查 ${finalFailing.length} 项、QA 结论${qaVerdict.pass ? "通过" : "未通过"}；详见 findings、未覆盖项与交付报告。`;

const findings: Finding[] = [];
for (const gate of finalFailing) {
  findings.push({
    where: gate.command,
    what: `${gate.name}未通过（退出码 ${gate.exitCode}）`,
    evidence: oneLine(gate.output, 300),
    status: "verified",
    severity: "high",
  });
}
for (const issue of qaVerdict.issues) {
  findings.push({
    where: issue.where,
    what: issue.what,
    evidence: "QA 审阅发现，未经独立复核",
    status: "unconfirmed",
    severity: normalizeSeverity(issue.severity),
  });
}
for (const id of unmetIds) {
  const item = acById.get(id);
  findings.push({
    where: id,
    what: `验收标准未满足：${oneLine(prd.acceptance[Number(id.slice(3)) - 1] ?? "", 160)}`,
    evidence: item === undefined ? "QA 未给出结论" : oneLine(item.evidence, 200),
    status: "unconfirmed",
    severity: "medium",
  });
}
for (const warning of budgetWarnings) {
  findings.push({ where: "文档预算", what: warning, evidence: "工作流机械校验", status: "verified", severity: "low" });
}
for (const warning of reviewWarnings) {
  findings.push({ where: "审校", what: warning, evidence: "审校打回后未二次审校", status: "unconfirmed", severity: "low" });
}
for (const slot of engineerList) {
  const result = latestResults.get(slot.id);
  if (result === undefined) continue;
  for (const concern of result.concerns) {
    findings.push({ where: `任务 ${slot.id}`, what: concern, evidence: "工程师交差时自查记录，未处理", status: "unconfirmed", severity: "low" });
  }
}

const verified: string[] = [];
for (const gate of usableGates) {
  verified.push(`${gate.name}：${gate.command}，退出码 ${gate.exitCode}`);
}
verified.push(`QA 对照 ${expectedAcIds.length} 条 AC 逐条核对：${metIds.length} 条有通过证据，${unmetIds.length} 条未通过或缺失`);
verified.push(`需求审校：${prdReviewed}；方案审校：${fastMode ? "快速模式合并审校：" + designReviewed : designReviewed}`);

const notCovered: string[] = [];
if (gateRuns.length === 0) {
  notCovered.push("项目没有可执行的检查命令（package.json 脚本 / pyproject.toml / tests 目录 / Cargo.toml / go.mod 均未命中），质量结论仅凭 QA 审阅与行为核对");
} else if (usableGates.length === 0) {
  notCovered.push("项目检查项全部不可用，质量结论仅凭 QA 审阅与行为核对");
}
for (const gate of unavailableGates) {
  notCovered.push(`检查项不可用，未参与判定：${gate.name}（${gate.command}）：${oneLine(gate.output, 120)}`);
}
if (tasks.length === 0) notCovered.push("架构师没有给出可执行任务（或任务全部无效），本次没有代码改动");
if (expectedAcIds.length === 0) notCovered.push("需求文档没有验收标准，无法判定交付质量");
if (qaFailedToRun) notCovered.push("QA 首轮验收请求失败，本次没有完成逐条 AC 核对");
if (fastMode) notCovered.push("快速模式：需求与方案由技术负责人一次产出，未做独立方案审校");
for (const id of missingEvidence) notCovered.push(`验收缺口：${id} 缺少证据或未被 QA 核对`);
if (missingEvidence.length === 0) {
  for (const id of unmetIds) notCovered.push(`验收缺口：${id} 未满足`);
}
for (const warning of reviewWarnings) notCovered.push(`审校警告：${warning}`);
for (const warning of budgetWarnings) notCovered.push(`预算警告：${warning}`);
for (const failure of askFailures) notCovered.push(`请求失败：${failure}`);
if (finalFailing.length > 0) notCovered.push("有检查项最终未通过，详见 findings");

try {
  await artifact.file("prd", "docs/dev-team/prd.md", { title: "需求文档（PRD）", description: "范围、验收标准（按预算收敛）与非目标" });
} catch (error) {
  log("未找到 docs/dev-team/prd.md，跳过需求文档发布");
  notCovered.push(`需求文档 docs/dev-team/prd.md 没有发布（${oneLine(String(error), 80)}），本次看不到需求文档文件`);
  findings.push({ where: "docs/dev-team/prd.md", what: "需求文档没有发布", evidence: oneLine(String(error), 200), status: "unconfirmed", severity: "medium" });
}
try {
  await artifact.file("design", "docs/dev-team/design.md", { title: "技术方案与任务拆分", description: "关键决策、自包含任务清单与检查项" });
} catch (error) {
  log("未找到 docs/dev-team/design.md，跳过方案文档发布");
  notCovered.push(`方案文档 docs/dev-team/design.md 没有发布（${oneLine(String(error), 80)}），本次看不到方案文档文件`);
  findings.push({ where: "docs/dev-team/design.md", what: "方案文档没有发布", evidence: oneLine(String(error), 200), status: "unconfirmed", severity: "medium" });
}

const acRows = expectedAcIds.map((id) => {
  const item = acById.get(id);
  const index = Number(id.slice(3)) - 1;
  const met = item !== undefined && item.met ? "通过" : "未通过/缺失";
  return `| ${id} | ${oneLine(prd.acceptance[index] ?? "", 90)} | ${met} | ${oneLine(item === undefined ? "QA 未给出结论" : item.evidence, 120)} |`;
});

const reportMd = [
  `# 交付报告：${prd.title}`,
  "",
  `模式：${fastMode ? "快速模式" : "完整模式"}｜规模：${prd.size}｜任务 ${tasks.length} 个｜AC ${expectedAcIds.length} 条｜检查 ${gateRuns.length} 项｜结论：${deliverable ? "可交付" : "不可交付"}`,
  "",
  "## 需求",
  oneLine(prd.background, 600),
  "",
  ...(prd.stories.length > 0 ? ["用户故事：", ...prd.stories.map((story) => `- ${oneLine(story, 120)}`), ""] : []),
  "## 验收标准与结论",
  "| AC | 验收标准 | 结论 | 证据 |",
  "| --- | --- | --- | --- |",
  ...acRows,
  "",
  "## 方案",
  oneLine(design.approach, 600),
  "",
  ...(design.conventions.trim() === "" ? [] : ["仓库约定：", oneLine(design.conventions, 400), ""]),
  "## 任务完成情况",
  ...engineerList.map((slot) => {
    const result = latestResults.get(slot.id);
    return `- ${slot.id}${taskTitles.get(slot.id) === undefined ? "" : `（${taskTitles.get(slot.id)}）`}：${result === undefined ? "无摘要" : oneLine(result.summary, 200)}`;
  }),
  ...extraSummaries.map((summary) => `- ${summary}`),
  "",
  "## 项目检查",
  gateDigest(),
  "",
  "## QA 结论",
  `pass=${qaVerdict.pass}；checked：${oneLine(qaVerdict.checked.join("；"), 400)}`,
  "",
  "## 审校记录",
  `需求审校：${prdReviewed}；方案审校：${fastMode ? designReviewed : designReviewed}`,
  ...(reviewWarnings.length > 0 ? reviewWarnings.map((warning) => `- 警告：${warning}`) : ["- 无打回"]),
  "",
  "## 风险",
  ...(prd.risks.length === 0 && design.risks.length === 0
    ? ["- 无记录"]
    : [...prd.risks.map((risk) => `- 需求风险：${oneLine(risk, 160)}`), ...design.risks.map((risk) => `- 方案风险：${oneLine(risk, 160)}`)]),
  "",
  "## 未覆盖项",
  ...(notCovered.length > 0 ? notCovered.map((item) => `- ${item}`) : ["- 无"]),
].join("\n");

try {
  await artifact.markdown("delivery-report", reportMd, {
    title: "交付报告",
    description: `需求、逐条 AC 结论、任务完成情况、检查结果与未覆盖项${fastMode ? "（快速模式）" : ""}`,
    primary: true,
  });
} catch {
  log("交付报告发布失败（内容可能超过大小上限）");
}

for (const slot of engineerList) {
  const result = latestResults.get(slot.id);
  report(
    {
      taskId: slot.id,
      title: taskTitles.get(slot.id) ?? slot.id,
      status: deliverable ? "已完成" : "需修复",
      summary: result === undefined ? "" : oneLine(result.summary, 200),
    },
    "tasks",
  );
}

log(`交付完成：${deliverable ? "可交付" : "不可交付"}（任务 ${tasks.length} 个，AC ${metIds.length}/${expectedAcIds.length} 有证据，检查 ${gateRuns.length} 项）`);

const result: WorkflowReport = {
  conclusion,
  findings,
  verified,
  notCovered,
};
return result;
