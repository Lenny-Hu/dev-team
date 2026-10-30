/* zcode-workflow
name: 软件开发团队
description: 交付总监带队的软件研发流水线：产品经理定需求、架构师设计+拆任务、工程师并行实现、QA 验证质量，小需求走快速模式。
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

// ===== 结果类型 =====

interface CriterionResult {
  /** 验收标准原文。 */
  criterion: string;
  /** 是否满足。 */
  met: boolean;
  /** 证据：读了哪些文件、跑了什么命令、看到什么输出。 */
  evidence: string;
}

interface Prd {
  /** 需求标题，一句话。 */
  title: string;
  /** 背景与目标：为什么要做，做成什么样算达成。 */
  background: string;
  /** 范围内的用户故事，每条可独立验收。 */
  stories: string[];
  /** 验收标准，逐条可核对（给定输入或操作，期望结果）。 */
  acceptance: string[];
  /** 明确不做的内容。 */
  nonGoals: string[];
  /** 关键假设与未决问题（含默认取值）。 */
  assumptions: string[];
  /** 主要风险及应对。 */
  risks: string[];
}

interface DesignTask {
  /** 任务编号，全清单内唯一，如 T1。 */
  id: string;
  /** 任务标题，一句话。 */
  title: string;
  /** 要修改或新增的文件（工作区相对路径）。 */
  files: string[];
  /** 实现要点，按顺序。 */
  steps: string[];
  /** 本任务的验收标准，QA 可逐条核对。 */
  acceptance: string[];
  /** 依赖的任务编号；没有则为空数组。 */
  dependsOn: string[];
}

interface Design {
  /** 技术方案：选型与关键决策及理由。 */
  approach: string;
  /** 遵循的仓库现有约定（读代码后总结）。 */
  conventions: string;
  /** 任务拆分，粒度小、可独立验证，编号唯一。 */
  tasks: DesignTask[];
  /** 方案风险与回退思路。 */
  risks: string[];
}

interface GateVerdict {
  /** 是否放行进入下一阶段。 */
  pass: boolean;
  /** 打回时的具体修改意见，逐条列出。 */
  feedback: string[];
  /** 一句话说明放行或拦截的理由。 */
  reason: string;
}

interface TaskResult {
  /** 任务编号。 */
  taskId: string;
  /** 实际改动摘要，一句话。 */
  summary: string;
  /** 实际改动的文件（工作区相对路径）。 */
  filesChanged: string[];
  /** 自查发现但未解决的问题；没有则为空数组。 */
  concerns: string[];
}

interface TaskVerification {
  /** 任务编号。 */
  taskId: string;
  /** 逐条核对本任务验收标准的结果。 */
  criteria: CriterionResult[];
  /** 总体是否通过。 */
  pass: boolean;
  /** 未通过或存疑之处的说明。 */
  issues: string[];
}

interface QaIssue {
  /** 问题位置，优先 路径:行号。 */
  where: string;
  /** 问题是什么，一句话。 */
  what: string;
  /** 严重度：high 留给数据丢失、崩溃、结果错误。 */
  severity: "low" | "medium" | "high";
}

interface QaVerdict {
  /** 是否验收通过。 */
  pass: boolean;
  /** 对照 PRD 验收标准的逐条结论。 */
  criteria: CriterionResult[];
  /** 发现的问题清单。 */
  issues: QaIssue[];
  /** QA 实际做了哪些检查（读了哪些文件、依据哪些命令结果）。 */
  checked: string[];
}

interface Triage {
  /** 需要修复的任务编号，只选确有关系的。 */
  fixTaskIds: string[];
  /** 给工程师的修复指导，说明怎么改。 */
  guidance: string;
}

interface GateRun {
  /** 检查标识，修复轮据此重跑同一项。 */
  key: string;
  /** 检查名称，给人看。 */
  name: string;
  /** 实际执行的命令。 */
  command: string;
  /** 进程退出码，0 为通过。 */
  exitCode: number;
  /** 失败时的关键输出（截断）。 */
  output: string;
}

interface Acceptance {
  /** 总体是否可交付。 */
  deliverable: boolean;
  /** 对照 PRD 验收标准的逐条结论。 */
  criteria: CriterionResult[];
  /** 一段话总结：做了什么、质量如何、能不能交付。 */
  summary: string;
  /** 未有着落的验收标准或场景，逐条列出。 */
  gaps: string[];
}

interface LitePlan {
  /** 精简需求文档（内容同完整模式的 PRD）。 */
  prd: Prd;
  /** 精简技术方案与任务拆分（内容同完整模式的 Design）。 */
  design: Design;
}

interface Finding {
  /** 问题位置：文件路径、命令或任务编号。 */
  where: string;
  /** 一句话：问题是什么。 */
  what: string;
  /** 什么表明了它：读过的内容，或命令与输出。 */
  evidence: string;
  /** verified=有独立子代理或确定性检查确认；unconfirmed=仅有人工核对或未经复核。 */
  status: "verified" | "unconfirmed";
  /** 严重度：high 留给数据丢失、崩溃、结果错误。 */
  severity: "low" | "medium" | "high";
}

interface WorkflowReport {
  /** 两三句话回答用户：这次交付了什么、质量结论如何。 */
  conclusion: string;
  findings: Finding[];
  /** 这次实际检查了什么、怎么检查的。 */
  verified: string[];
  /** 没有覆盖或无法检查的内容及原因。 */
  notCovered: string[];
}

// ===== 人物设定 =====

const DIRECTOR_PERSONA = [
  "你是软件开发团队的交付总监，团队的 Lead，对立项、放行、验收和交付负全责。",
  "范围不清不立项，证据不足不放行，检查不过不交付。",
  "判断必须可核对：验收标准逐条对照，结论分清「已验证」与「存疑」，不把子代理的表态当证据。",
  "如果放行标准互相矛盾或你无法判断，直接上报并说清原因，不要硬给结论。",
].join("\n");

const PM_PERSONA = [
  "你是团队的产品经理，把模糊需求变成可验收的需求文档。",
  "验收标准必须逐条可核对：给定输入或操作，期望结果是什么；禁止「体验良好」这类无法核对的表述。",
  "不确定处记录假设与默认值，不编造用户没说过的功能；技术方案不写进需求文档。",
  "需求缺失到无法立项时，直接上报，不要硬写。",
].join("\n");

const ARCHITECT_PERSONA = [
  "你是团队的架构师，负责技术方案设计与任务拆分。",
  "先读仓库代码再下结论，引用 路径:行号 作为依据；没读过就不下断言。",
  "任务粒度以「能独立验证」为准，标注涉及文件、实现步骤、验收标准和依赖；同批任务不许互相依赖；任务编号唯一。",
  "优先复用仓库已有的模式、依赖和工具；新依赖要有明确理由。",
  "PRD 里有技术上不可行或成本畸高的条目时，上报并附替代建议，不默默改需求。",
].join("\n");

const ENGINEER_PERSONA = [
  "你是团队的工程师，按任务说明实现代码。",
  "先读涉及文件与周边代码再动手，遵循仓库既有风格、命名和错误处理方式。",
  "只改任务清单内的文件；范围外的问题写进 concerns 上报，不顺手改。",
  "交差前对照本任务验收标准逐条自查；能跑的检查自己跑，跑不了的在摘要里说明。",
  "不谎称跑过没跑的命令、读过没读的文件；不删测试、不改断言、不注掉逻辑来「让检查通过」，遇到矛盾直接上报。",
].join("\n");

const QA_PERSONA = [
  "你是团队的质量工程师，对照验收标准验证质量，说「没问题」必须给得出证据。",
  "只读不改：发现问题写进清单，修复是工程师的事。",
  "项目级测试、构建、静态检查由工作流统一执行，直接用其结果，不自己重复跑。",
  "每条结论都要有依据；没有依据的标注存疑，不装作验过。",
  "严重度分级：high 留给数据丢失、崩溃、结果错误；medium 是功能受损但有退路；low 是瑕疵。",
  "核对的是 PRD 或任务里的验收标准原文，不是自己理解的标准。",
].join("\n");

const LEAD_PERSONA = [
  "你是团队的技术负责人，快速模式下产品经理与架构师二合一。",
  "一次产出精简需求文档与技术方案：需求部分按产品经理的标准（验收标准逐条可核对），方案部分按架构师的标准（先读代码、任务小到可独立验证、依赖显式）。",
  "小需求不求完备，但范围、验收标准、任务清单三样不能少；任务编号唯一。",
  "不编造仓库里不存在的文件或能力；需求与方案矛盾时上报，不硬写。",
].join("\n");

// ===== 任务看板 =====
artifact.board("tasks", {
  title: "任务看板",
  key: "taskId",
  status: "status",
  columns: ["实现中", "已验证", "需修复", "已完成"],
  cardTitle: "title",
  detail: [{ field: "summary", label: "进展" }],
});

// ===== 纯工具函数 =====

function criterionList(items: string[]): string {
  return items.map((a, i) => `${i + 1}. ${a}`).join("\n");
}

function gateFrom(key: string, name: string, command: string, r: WorldRunResult): GateRun {
  return { key, name, command, exitCode: r.exitCode, output: (r.stderr + r.stdout).slice(0, 2000) };
}

// ===== 参数 =====

const requirement = String(args.requirement ?? "").trim();
const fastMode = String(args.mode ?? "full").toLowerCase() === "fast";
log(`需求已受理（${fastMode ? "快速模式" : "完整模式"}）：${requirement.slice(0, 80)}`);

const director = agent("交付总监", { system: DIRECTOR_PERSONA });
let prd: Prd;
let design: Design;

if (fastMode) {
  phase("技术负责人快速界定需求与方案");
  const lead = agent("技术负责人", { system: LEAD_PERSONA });
  const plan = await lead.ask<LitePlan>(
    `小需求快速立项。用户的原始需求：\n${requirement}\n\n` +
      `先读仓库代码，再二合一产出：需求文档写入 .dev-team/prd.md，技术方案与任务拆分写入 .dev-team/design.md。` +
      `需求部分给出范围、验收标准（逐条可核对）、非目标、假设；方案部分给出关键决策、任务清单（编号唯一、涉及文件、步骤、任务级验收标准、依赖）。` +
      `返回结构化结果。`,
  );
  prd = plan.prd;
  design = plan.design;

  phase("交付总监快速审校需求与方案");
  const verdict = await director.ask<GateVerdict>(
    `快速审校。用户的原始需求：\n${requirement}\n\n需求文档：\n${JSON.stringify(prd)}\n\n技术方案与任务：\n${JSON.stringify(design)}\n\n` +
      `判断：验收标准是否逐条可核对、范围是否有非目标、任务清单是否非空且编号唯一。不满足逐条给修改意见；满足才放行。`,
  );
  if (!verdict.pass) {
    log(`快速审校打回：${verdict.reason}`);
    const revised = await lead.ask<LitePlan>(
      `交付总监打回了需求与方案，理由：${verdict.reason}\n修改意见：${JSON.stringify(verdict.feedback)}\n` +
        `按意见修订 .dev-team/prd.md 与 .dev-team/design.md，并返回更新后的结构化结果。`,
    );
    prd = revised.prd;
    design = revised.design;
  }
} else {
  phase("产品经理界定需求");
  const pm = agent("产品经理", { system: PM_PERSONA });
  prd = await pm.ask<Prd>(
    `用户的原始需求：\n${requirement}\n\n` +
      `先复述你对需求的理解，再产出需求文档并写入 .dev-team/prd.md。` +
      `验收标准逐条可核对（给定输入或操作，期望结果）；明确非目标；不确定处记录假设与默认值。返回结构化结果。`,
  );

  phase("交付总监审校需求");
  for (let round = 0; round < 2; round++) {
    const verdict = await director.ask<GateVerdict>(
      `需求审校。用户的原始需求：\n${requirement}\n\n产品经理的需求文档：\n${JSON.stringify(prd)}\n\n` +
        `按放行标准判断：验收标准是否逐条可核对、范围是否有明确非目标、关键假设是否已记录。不满足就逐条给出修改意见；满足才放行。`,
    );
    if (verdict.pass) break;
    log(`需求审校打回：${verdict.reason}`);
    prd = await pm.ask<Prd>(
      `交付总监打回了需求文档，理由：${verdict.reason}\n修改意见：${JSON.stringify(verdict.feedback)}\n` +
        `按意见修订 .dev-team/prd.md，并返回更新后的结构化结果。`,
    );
  }

  phase("架构师技术设计与任务拆分");
  const architect = agent("架构师", { system: ARCHITECT_PERSONA });
  design = await architect.ask<Design>(
    `产品经理的需求文档：\n${JSON.stringify(prd)}\n\n` +
      `先读仓库代码，再产出技术方案与任务拆分，方案写入 .dev-team/design.md。` +
      `任务要小到可独立验证：编号唯一、涉及文件、按顺序的实现步骤、任务级验收标准、依赖关系；同批任务不许互相依赖。` +
      `遵循仓库现有约定，新依赖写明理由。返回结构化结果。`,
  );

  phase("交付总监审校技术方案");
  for (let round = 0; round < 2; round++) {
    const verdict = await director.ask<GateVerdict>(
      `方案审校。需求文档：\n${JSON.stringify(prd)}\n\n架构师的方案与任务：\n${JSON.stringify(design)}\n\n` +
        `按放行标准判断：任务粒度是否可独立验证、依赖是否显式且同批不互依赖、编号是否唯一、是否遵循仓库现有约定。` +
        `不满足就逐条给出修改意见；满足才放行。`,
    );
    if (verdict.pass) break;
    log(`方案审校打回：${verdict.reason}`);
    design = await architect.ask<Design>(
      `交付总监打回了技术方案，理由：${verdict.reason}\n修改意见：${JSON.stringify(verdict.feedback)}\n` +
        `按意见修订 .dev-team/design.md，并返回更新后的结构化结果。`,
    );
  }
}

log(`立项完成：${design.tasks.length} 个任务进入实现阶段`);

const taskTitles = new Map<string, string>();
for (const t of design.tasks) {
  taskTitles.set(t.id, t.title);
}

// ===== 实现：按依赖批次并行 =====

phase("工程师按批次并行实现");

const engineerList: { id: string; agent: Agent }[] = [];
const latestResults = new Map<string, TaskResult>();
const verifications = new Map<string, TaskVerification>();
const done = new Set<string>();
const pending: DesignTask[] = design.tasks.slice();

function depSummaries(task: DesignTask): string {
  const lines: string[] = [];
  for (const dep of task.dependsOn) {
    const r = latestResults.get(dep);
    if (r !== undefined) lines.push(`${dep}：${r.summary}`);
  }
  return lines.length > 0 ? lines.join("\n") : "无";
}

while (pending.length > 0) {
  const wave = pending.filter((t) => t.dependsOn.every((d) => done.has(d)));
  const batch = wave.length > 0 ? wave : pending.slice();
  if (wave.length === 0) {
    log("任务依赖存在环，剩余任务按同一批并行处理");
  }
  for (const t of batch) {
    pending.splice(pending.indexOf(t), 1);
  }
  log(`本批实现 ${batch.length} 个任务：${batch.map((t) => t.id).join("、")}`);

  await Promise.all(
    batch.map(async (t) => {
      const engineer = agent(`工程师·${t.id}`, { system: ENGINEER_PERSONA });
      engineerList.push({ id: t.id, agent: engineer });
      const result = await engineer.ask<TaskResult>(
        `你的任务 ${t.id}：${t.title}\n\n涉及文件：${t.files.join("、")}\n实现步骤：\n${t.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n` +
          `本任务验收标准：\n${criterionList(t.acceptance)}\n依赖任务的改动摘要：\n${depSummaries(t)}\n\n` +
          `先读涉及文件与周边代码再动手；只改上面列出的文件；交差前对照验收标准逐条自查。返回结构化结果。`,
      );
      latestResults.set(t.id, result);
      report({ taskId: t.id, title: t.title, status: "实现中", summary: result.summary }, "tasks");

      if (!fastMode) {
        const verifier = agent(`质检员·${t.id}`, { system: QA_PERSONA });
        const v = await verifier.ask<TaskVerification>(
          `逐任务质检（只读不改）。任务 ${t.id}：${t.title}\n\n本任务验收标准：\n${criterionList(t.acceptance)}\n` +
            `工程师的改动摘要：${result.summary}\n涉及文件（逐个读）：${result.filesChanged.join("、")}\n\n` +
            `逐条核对验收标准并给出证据；项目级检查工作流后面统一跑，这里不要跑测试/构建。返回结构化结果。`,
        );
        verifications.set(t.id, v);
        report(
          {
            taskId: t.id,
            title: t.title,
            status: v.pass ? "已验证" : "需修复",
            summary: v.pass ? result.summary : `质检未通过：${v.issues.join("；")}`,
          },
          "tasks",
        );
        if (!v.pass) {
          log(`任务 ${t.id} 质检未通过，退回工程师修复`);
          const fixed = await engineer.ask<TaskResult>(
            `质检员核对了你的任务 ${t.id}，未通过。问题：${v.issues.join("；")}\n` +
              `只修与这些问题直接相关的内容，不删测试、不改断言、不注掉逻辑。修完后返回更新后的改动摘要。`,
          );
          latestResults.set(t.id, fixed);
          report({ taskId: t.id, title: t.title, status: "实现中", summary: `修复后：${fixed.summary}` }, "tasks");
        }
      }
    }),
  );

  for (const t of batch) {
    done.add(t.id);
  }
}

// ===== 质量验证 =====

phase("QA 运行项目检查并对照需求验收");

// 检查函数的命令名是字面量，用户确认脚本时能看到完整命令集
async function runNodeTest(): Promise<GateRun> {
  const r = await world.run("npm", ["test"], { timeoutMs: 900000 });
  return gateFrom("node-test", "单元测试", "npm test", r);
}
async function runNodeBuild(): Promise<GateRun> {
  const r = await world.run("npm", ["run", "build"], { timeoutMs: 900000 });
  return gateFrom("node-build", "构建", "npm run build", r);
}
async function runNodeLint(): Promise<GateRun> {
  const r = await world.run("npm", ["run", "lint"], { timeoutMs: 600000 });
  return gateFrom("node-lint", "静态检查", "npm run lint", r);
}
async function runPytest(): Promise<GateRun> {
  const r = await world.run("python", ["-m", "pytest"], { timeoutMs: 900000 });
  return gateFrom("pytest", "单元测试", "python -m pytest", r);
}
async function runCargoTest(): Promise<GateRun> {
  const r = await world.run("cargo", ["test"], { timeoutMs: 900000 });
  return gateFrom("cargo-test", "单元测试", "cargo test", r);
}
async function runCargoBuild(): Promise<GateRun> {
  const r = await world.run("cargo", ["build"], { timeoutMs: 900000 });
  return gateFrom("cargo-build", "构建", "cargo build", r);
}

let nodeScripts: Record<string, string> = {};
let pythonProject = false;
let rustProject = false;
try {
  const pkg = JSON.parse(await files.read("package.json"));
  if (pkg && typeof pkg === "object" && pkg.scripts && typeof pkg.scripts === "object") {
    nodeScripts = pkg.scripts;
  }
} catch {
  // 仓库没有 package.json
}
try {
  await files.read("pyproject.toml");
  pythonProject = true;
} catch {
  // 非 Python 项目
}
try {
  await files.read("Cargo.toml");
  rustProject = true;
} catch {
  // 非 Rust 项目
}

const checkFns: Record<string, () => Promise<GateRun>> = {};
if (typeof nodeScripts.test === "string") checkFns["node-test"] = runNodeTest;
if (typeof nodeScripts.build === "string") checkFns["node-build"] = runNodeBuild;
if (typeof nodeScripts.lint === "string") checkFns["node-lint"] = runNodeLint;
if (pythonProject) checkFns["pytest"] = runPytest;
if (rustProject) checkFns["cargo-test"] = runCargoTest;
if (rustProject) checkFns["cargo-build"] = runCargoBuild;

const checkKeys = Object.keys(checkFns);
const gateRuns: GateRun[] = [];
if (checkKeys.length > 0) {
  log(`执行项目自带检查：${checkKeys.join("、")}`);
} else {
  log("未发现项目自带的检查命令，QA 将仅做代码审阅");
}

// 构建类命令可能共享输出目录，串行执行避免互相干扰
for (const key of checkKeys) {
  const g = await checkFns[key]();
  gateRuns.push(g);
  log(`${g.name}（${g.command}）退出码 ${g.exitCode}`);
}

function failingGates(): GateRun[] {
  return gateRuns.filter((g) => g.exitCode !== 0);
}

async function rerunGates(keys: string[]): Promise<void> {
  for (const key of keys) {
    const rerun = await checkFns[key]();
    const idx = gateRuns.findIndex((x) => x.key === key);
    if (idx >= 0) gateRuns[idx] = rerun;
    log(`${rerun.name} 重跑退出码 ${rerun.exitCode}`);
  }
}

function taskDigest(): string {
  const lines: string[] = [];
  for (const e of engineerList) {
    const r = latestResults.get(e.id);
    lines.push(`${e.id}：${r === undefined ? "无摘要" : r.summary}`);
  }
  return lines.length > 0 ? lines.join("\n") : "无任务";
}

function gateDigest(): string {
  if (gateRuns.length === 0) return "未发现可执行的检查命令";
  return gateRuns.map((g) => `${g.name}（${g.command}）退出码 ${g.exitCode}`).join("\n");
}

function gateFailureText(gates: GateRun[]): string {
  return gates.map((g) => `${g.name}（${g.command}）退出码 ${g.exitCode}\n${g.output}`).join("\n\n");
}

for (let round = 0; round < 2; round++) {
  const failing = failingGates();
  if (failing.length === 0 || engineerList.length === 0) break;
  log(`第 ${round + 1} 轮修复：${failing.map((f) => f.name).join("、")} 未通过`);
  const triage = await director.ask<Triage>(
    `以下检查未通过：\n${gateFailureText(failing)}\n\n任务与改动摘要：\n${taskDigest()}\n\n` +
      `判断哪些任务的改动最可能导致这些失败，给出要修复的任务编号与修复指导。只选确有关系的任务；判断不出就选改动最大的任务并说明理由。`,
  );
  const targets = engineerList.filter((e) => triage.fixTaskIds.includes(e.id));
  await Promise.all(
    targets.map((e) =>
      e.agent.ask<TaskResult>(
        `检查未通过，需要你修复。失败输出：\n${gateFailureText(failing)}\n\n交付总监的修复指导：${triage.guidance}\n` +
          `只修与失败直接相关的问题；不删测试、不改断言、不注掉逻辑。修完后返回更新后的改动摘要。`,
      ),
    ),
  );
  await rerunGates(failing.map((f) => f.key));
}

const changedPaths = new Set<string>();
try {
  const gitChanged = await git.changedFiles();
  for (const p of gitChanged) changedPaths.add(p);
} catch {
  // 非 git 仓库，退回工程师自报的文件清单
}
for (const e of engineerList) {
  const r = latestResults.get(e.id);
  if (r !== undefined) {
    for (const p of r.filesChanged) changedPaths.add(p);
  }
}

const qa = agent("QA 工程师", { system: QA_PERSONA });
let qaVerdict = await qa.ask<QaVerdict>(
  `集成验收（只读不改）。PRD 验收标准：\n${criterionList(prd.acceptance)}\n\n各任务改动摘要：\n${taskDigest()}\n\n` +
    `改动涉及的文件（逐个读，核对实现）：\n${Array.from(changedPaths).join("\n")}\n\n` +
    `项目检查结果（工作流已统一执行，不要自己重复跑）：\n${gateDigest()}\n\n` +
    `逐条核对验收标准并给出证据；发现问题按严重度列出，位置用 路径:行号。返回结构化结果。`,
);

if (!qaVerdict.pass && engineerList.length > 0) {
  log(`QA 验收未通过：${qaVerdict.issues.map((i) => i.what).join("；")}`);
  const triage = await director.ask<Triage>(
    `QA 验收未通过，问题：\n${JSON.stringify(qaVerdict.issues)}\n\n任务与改动摘要：\n${taskDigest()}\n\n` +
      `给出要修复的任务编号与修复指导，只选确有关系的任务。`,
  );
  const targets = engineerList.filter((e) => triage.fixTaskIds.includes(e.id));
  await Promise.all(
    targets.map((e) =>
      e.agent.ask<TaskResult>(
        `QA 验收未通过，与你有关的问题：\n${JSON.stringify(qaVerdict.issues)}\n\n交付总监的修复指导：${triage.guidance}\n` +
          `只修与这些问题直接相关的内容。修完后返回更新后的改动摘要。`,
      ),
    ),
  );
  await rerunGates(checkKeys);
  qaVerdict = await qa.ask<QaVerdict>(
    `复核。上一轮 QA 问题：\n${JSON.stringify(qaVerdict.issues)}\n\n修复后的改动摘要：\n${taskDigest()}\n\n` +
      `项目检查最新结果：\n${gateDigest()}\n\n逐条确认问题是否已解决，重新给出验收结论。只读不改。`,
  );
}

for (const e of engineerList) {
  const r = latestResults.get(e.id);
  report(
    {
      taskId: e.id,
      title: taskTitles.get(e.id) ?? e.id,
      status: qaVerdict.pass ? "已完成" : "需修复",
      summary: r === undefined ? "" : r.summary,
    },
    "tasks",
  );
}

// ===== 验收与交付 =====

phase("交付总监验收并汇总交付报告");

const acceptance = await director.ask<Acceptance>(
  `最终验收。PRD 验收标准：\n${criterionList(prd.acceptance)}\n\n各任务改动摘要：\n${taskDigest()}\n\n` +
    `QA 结论：${JSON.stringify(qaVerdict)}\n\n项目检查结果：\n${gateDigest()}\n\n` +
    `逐条对照验收标准给出结论；总体判断是否可交付；未有着落的标准或场景逐条列进 gaps。`,
);

const findings: Finding[] = [];
for (const g of gateRuns) {
  if (g.exitCode !== 0) {
    findings.push({
      where: g.command,
      what: `${g.name}未通过（退出码 ${g.exitCode}）`,
      evidence: g.output.slice(0, 300),
      status: "verified",
      severity: "high",
    });
  }
}
for (const issue of qaVerdict.issues) {
  findings.push({
    where: issue.where,
    what: issue.what,
    evidence: "QA 审阅发现，未经独立复核",
    status: "unconfirmed",
    severity: issue.severity,
  });
}
for (const gap of acceptance.gaps) {
  findings.push({
    where: "验收标准",
    what: gap,
    evidence: "交付总监终验对照 PRD 未有着落",
    status: "unconfirmed",
    severity: "medium",
  });
}
for (const e of engineerList) {
  const r = latestResults.get(e.id);
  if (r === undefined) continue;
  for (const c of r.concerns) {
    findings.push({
      where: `任务 ${e.id}`,
      what: c,
      evidence: "工程师交差时自查记录，未处理",
      status: "unconfirmed",
      severity: "low",
    });
  }
}

const verified: string[] = [];
for (const g of gateRuns) {
  verified.push(`${g.name}：${g.command}，退出码 ${g.exitCode}`);
}
if (!fastMode && verifications.size > 0) {
  verified.push(`逐任务质检 ${verifications.size} 项，质检员只读不改、逐条核对任务级验收标准`);
}
verified.push(`QA 对照 PRD ${prd.acceptance.length} 条验收标准逐条核对`);

const notCovered: string[] = [];
if (checkKeys.length === 0) {
  notCovered.push("项目没有可执行的检查命令（未见 package.json/pyproject.toml/Cargo.toml 中的 test、build 或 lint 脚本），质量结论仅凭代码审阅");
}
if (fastMode) {
  notCovered.push("快速模式跳过了逐任务质检，任务级问题依赖 QA 集成验收发现");
}
for (const gap of acceptance.gaps) {
  notCovered.push(`验收缺口：${gap}`);
}
if (failingGates().length > 0) {
  notCovered.push("有检查项最终未通过，详见 findings");
}

try {
  await artifact.file("prd", ".dev-team/prd.md", { title: "需求文档（PRD）", description: "范围、用户故事与逐条可核对的验收标准" });
} catch {
  log("未找到 .dev-team/prd.md，跳过需求文档发布");
}
try {
  await artifact.file("design", ".dev-team/design.md", { title: "技术方案与任务拆分", description: "关键决策、任务清单与依赖关系" });
} catch {
  log("未找到 .dev-team/design.md，跳过方案文档发布");
}

const reportMd = [
  `# 交付报告：${prd.title}`,
  "",
  `模式：${fastMode ? "快速模式" : "完整模式"}｜任务 ${design.tasks.length} 个｜检查 ${gateRuns.length} 项｜结论：${acceptance.deliverable ? "可交付" : "不可交付"}`,
  "",
  "## 需求",
  prd.background,
  "",
  "验收标准：",
  criterionList(prd.acceptance),
  "",
  "## 方案",
  design.approach,
  "",
  "## 任务完成情况",
  ...engineerList.map((e) => {
    const r = latestResults.get(e.id);
    return `- ${e.id}：${r === undefined ? "无摘要" : r.summary}`;
  }),
  "",
  "## 质量验证",
  gateDigest(),
  "",
  "QA 核对结论：" + (qaVerdict.pass ? "通过" : "未通过") + `，逐条结果见返回的结构化结论。`,
  "",
  "## 验收结论",
  acceptance.summary,
  "",
  "## 未覆盖项",
  ...(notCovered.length > 0 ? notCovered.map((n) => `- ${n}`) : ["- 无"]),
].join("\n");

try {
  await artifact.markdown("delivery-report", reportMd, {
    title: "交付报告",
    description: `需求、方案、任务完成情况、检查结果与验收结论${fastMode ? "（快速模式）" : ""}`,
    primary: true,
  });
} catch {
  log("交付报告发布失败（内容可能超过大小上限）");
}

const result: WorkflowReport = {
  conclusion: acceptance.summary,
  findings,
  verified,
  notCovered,
};
return result;
