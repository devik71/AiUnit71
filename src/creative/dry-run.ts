/**
 * Dry Run Mode — simulate a full pipeline without real API calls.
 *
 * Based on AiUnit71 Architecture Specification v1.0, Section 20.
 *
 * Usage:
 *   const sim = new DryRunSimulator();
 *   const report = sim.simulate("FitPulse Landing Page", missionCtx);
 *   console.log(report.formatted());
 *
 * Output:
 *   SIMULATION REPORT
 *   ─────────────────
 *   Agents to spawn: 7
 *   Estimated generations: 23 images, 2 videos
 *   Estimated cost: $4.80
 *   Estimated time: 45 min (with parallel execution)
 *   Budget utilization: 72% of allocated $6.50
 *   Critical path: hero image → frontend layout → final composite
 *   Recommendation: defer video generation to off-peak
 */

import type { MissionContext } from "./mission-context.js";
import { ToolRegistry } from "./tool-registry.js";
import type { TaskType } from "./tool-registry.js";
import { getRemainingBudget } from "./mission-context.js";

// ─── Simulation Plan ────────────────────────────────────────────────────

export interface SimulatedTask {
  id: string;
  title: string;
  agent: string;
  room: string;
  taskType?: TaskType;
  estimatedCostUsd: number;
  estimatedTimeS: number;
  /** Can run in parallel with other tasks? */
  parallel: boolean;
  dependencies: string[];
}

export interface SimulationReport {
  projectTitle: string;
  agentsToSpawn: number;
  agentList: string[];
  estimatedImages: number;
  estimatedVideos: number;
  estimatedGenerations: number;
  estimatedCostUsd: number;
  budgetAllocated: number;
  budgetUtilizationPct: number;
  estimatedTimeMinutes: number;
  criticalPath: string[];
  tasks: SimulatedTask[];
  recommendations: string[];
  warnings: string[];
  /** Formatted CLI output */
  formatted(): string;
}

// ─── Dry Run Simulator ──────────────────────────────────────────────────

export class DryRunSimulator {
  private registry = ToolRegistry.instance;

  /**
   * Simulate a full pipeline for the given project and mission context.
   *
   * @param projectTitle - Human-readable project name
   * @param missionCtx - The mission context with brand, technical, and deliverables
   * @returns SimulationReport with cost breakdown and recommendations
   */
  simulate(projectTitle: string, missionCtx: MissionContext): SimulationReport {
    const tasks = this.planTasks(missionCtx);
    const agentList = this.determineAgents(missionCtx, tasks);

    const estimatedImages = tasks.filter(
      (t) =>
        t.taskType &&
        [
          "photorealistic_image",
          "artistic_illustration",
          "product_visualization",
          "text_render",
        ].includes(t.taskType)
    ).length;

    const estimatedVideos = tasks.filter((t) => t.taskType === "video_generation").length;

    const estimatedCostUsd = tasks.reduce((sum, t) => sum + t.estimatedCostUsd, 0);
    const budgetAllocated = missionCtx.mission.budget.total;
    const budgetUtilizationPct =
      budgetAllocated > 0
        ? Math.round((estimatedCostUsd / budgetAllocated) * 100)
        : 0;

    const estimatedTimeMinutes = this.estimateTime(tasks);
    const criticalPath = this.findCriticalPath(tasks);
    const recommendations = this.buildRecommendations(
      tasks,
      missionCtx,
      estimatedCostUsd,
      budgetAllocated
    );
    const warnings = this.buildWarnings(missionCtx, estimatedCostUsd, budgetAllocated);

    const report: Omit<SimulationReport, "formatted"> = {
      projectTitle,
      agentsToSpawn: agentList.length,
      agentList,
      estimatedImages,
      estimatedVideos,
      estimatedGenerations: estimatedImages + estimatedVideos,
      estimatedCostUsd,
      budgetAllocated,
      budgetUtilizationPct,
      estimatedTimeMinutes,
      criticalPath,
      tasks,
      recommendations,
      warnings,
    };

    return {
      ...report,
      formatted: () => formatReport(report),
    };
  }

  // ─── Task Planning ─────────────────────────────────────────────────────

  private planTasks(missionCtx: MissionContext): SimulatedTask[] {
    const tasks: SimulatedTask[] = [];
    const deliverables = missionCtx.mission.deliverables;

    // Always: Briefing + Brainstorm + Job Distribution
    tasks.push({
      id: "brief",
      title: "Briefing",
      agent: "CEO/TeamLead",
      room: "briefing",
      estimatedCostUsd: 0.02,
      estimatedTimeS: 30,
      parallel: false,
      dependencies: [],
    });

    tasks.push({
      id: "brainstorm",
      title: "Brainstorm",
      agent: "Brainstormer",
      room: "brainstorm",
      estimatedCostUsd: 0.05,
      estimatedTimeS: 60,
      parallel: false,
      dependencies: ["brief"],
    });

    tasks.push({
      id: "job-plan",
      title: "Job Distribution",
      agent: "TeamLead",
      room: "jobmaster",
      estimatedCostUsd: 0.01,
      estimatedTimeS: 15,
      parallel: false,
      dependencies: ["brainstorm"],
    });

    // Draft generation for each deliverable
    for (const deliverable of deliverables) {
      const taskType = this.guessTaskType(deliverable.name);
      const draftTool = this.registry.selectBestTool(taskType ?? "photorealistic_image", {
        budget: 0.10,
      });
      const finalTool = this.registry.selectBestTool(taskType ?? "photorealistic_image");

      // PromptMaster + PromptCritic
      tasks.push({
        id: `pm-${deliverable.id}`,
        title: `PromptMaster: ${deliverable.name}`,
        agent: "PromptMaster",
        room: "promptmaster",
        estimatedCostUsd: 0.01,
        estimatedTimeS: 10,
        parallel: true,
        dependencies: ["job-plan"],
      });

      tasks.push({
        id: `pc-${deliverable.id}`,
        title: `PromptCritic: ${deliverable.name}`,
        agent: "PromptCritic",
        room: "prompt-critic",
        estimatedCostUsd: 0,
        estimatedTimeS: 5,
        parallel: true,
        dependencies: [`pm-${deliverable.id}`],
      });

      tasks.push({
        id: `vp-${deliverable.id}`,
        title: `VisualPrompter: ${deliverable.name}`,
        agent: "VisualPrompter",
        room: "visual-prompter",
        estimatedCostUsd: 0,
        estimatedTimeS: 5,
        parallel: true,
        dependencies: [`pc-${deliverable.id}`],
      });

      // Draft generation
      tasks.push({
        id: `draft-${deliverable.id}`,
        title: `Draft: ${deliverable.name}`,
        agent: "Graphic Designer",
        room: "image-gen",
        taskType: taskType ?? "photorealistic_image",
        estimatedCostUsd: draftTool?.cost_per_use ?? 0.04,
        estimatedTimeS: draftTool?.avg_time_s ?? 20,
        parallel: true,
        dependencies: [`vp-${deliverable.id}`],
      });

      // Final generation (after human checkpoint)
      tasks.push({
        id: `final-${deliverable.id}`,
        title: `Final: ${deliverable.name}`,
        agent: "Graphic Designer",
        room: "image-gen",
        taskType: taskType ?? "photorealistic_image",
        estimatedCostUsd: (finalTool?.cost_per_use ?? 0.15) * 3, // 3 variants
        estimatedTimeS: (finalTool?.avg_time_s ?? 20) * 3,
        parallel: true,
        dependencies: [`draft-${deliverable.id}`],
      });

      // Upscale (late expensive op — only on final)
      tasks.push({
        id: `upscale-${deliverable.id}`,
        title: `Upscale: ${deliverable.name}`,
        agent: "Graphic Designer",
        room: "image-gen",
        taskType: "image_upscale",
        estimatedCostUsd: 0.10,
        estimatedTimeS: 30,
        parallel: true,
        dependencies: [`final-${deliverable.id}`],
      });
    }

    // QC + Finalization (always last, sequential)
    tasks.push({
      id: "qc",
      title: "Quality Control",
      agent: "QC Agent",
      room: "evaluation",
      estimatedCostUsd: 0.02,
      estimatedTimeS: 30,
      parallel: false,
      dependencies: deliverables.map((d) => `upscale-${d.id}`),
    });

    tasks.push({
      id: "finalize",
      title: "Finalization & Case Study",
      agent: "ReportMaster",
      room: "finalizer",
      estimatedCostUsd: 0.01,
      estimatedTimeS: 15,
      parallel: false,
      dependencies: ["qc"],
    });

    return tasks;
  }

  private determineAgents(
    missionCtx: MissionContext,
    tasks: SimulatedTask[]
  ): string[] {
    const agentSet = new Set<string>();
    // Core agents always present
    agentSet.add("CEO");
    agentSet.add("TeamLead");
    agentSet.add("HR");
    agentSet.add("Brainstormer");
    agentSet.add("PromptMaster");

    // Add agents based on tasks
    for (const task of tasks) {
      agentSet.add(task.agent);
    }

    return Array.from(agentSet);
  }

  private guessTaskType(deliverableName: string): TaskType | undefined {
    const name = deliverableName.toLowerCase();
    if (name.includes("video") || name.includes("animation")) return "video_generation";
    if (name.includes("illustration") || name.includes("icon")) return "artistic_illustration";
    if (name.includes("product") || name.includes("3d")) return "product_visualization";
    if (name.includes("hero") || name.includes("banner") || name.includes("og")) {
      return "photorealistic_image";
    }
    return "photorealistic_image";
  }

  private estimateTime(tasks: SimulatedTask[]): number {
    // Find the critical path length (longest dependency chain)
    const criticalPathMs = this.getCriticalPathLength(tasks);
    return Math.ceil(criticalPathMs / 60);
  }

  private getCriticalPathLength(tasks: SimulatedTask[]): number {
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const memo = new Map<string, number>();

    function getLength(taskId: string): number {
      if (memo.has(taskId)) return memo.get(taskId)!;
      const task = taskMap.get(taskId);
      if (!task) return 0;
      const depLength = task.dependencies.reduce(
        (max, dep) => Math.max(max, getLength(dep)),
        0
      );
      const length = depLength + task.estimatedTimeS;
      memo.set(taskId, length);
      return length;
    }

    return Math.max(...tasks.map((t) => getLength(t.id)));
  }

  private findCriticalPath(tasks: SimulatedTask[]): string[] {
    // Walk the longest dependency chain to find the critical path
    const taskMap = new Map(tasks.map((t) => [t.id, t]));

    // Find the task with the longest total time
    let maxTime = 0;
    let longestTask: SimulatedTask | undefined;

    const memo = new Map<string, number>();

    function getLength(taskId: string): number {
      if (memo.has(taskId)) return memo.get(taskId)!;
      const task = taskMap.get(taskId);
      if (!task) return 0;
      const depLength = task.dependencies.reduce(
        (max, dep) => Math.max(max, getLength(dep)),
        0
      );
      const length = depLength + task.estimatedTimeS;
      memo.set(taskId, length);
      return length;
    }

    for (const task of tasks) {
      const length = getLength(task.id);
      if (length > maxTime) {
        maxTime = length;
        longestTask = task;
      }
    }

    // Trace back the path
    const path: string[] = [];
    let current: SimulatedTask | undefined = longestTask;

    while (current) {
      path.unshift(current.title);
      if (current.dependencies.length === 0) break;

      // Follow the longest dependency
      let maxDepTime = -1;
      let longestDep: SimulatedTask | undefined;

      for (const depId of current.dependencies) {
        const depTime = getLength(depId);
        if (depTime > maxDepTime) {
          maxDepTime = depTime;
          longestDep = taskMap.get(depId);
        }
      }

      current = longestDep;
    }

    return path;
  }

  private buildRecommendations(
    tasks: SimulatedTask[],
    missionCtx: MissionContext,
    estimatedCost: number,
    budget: number
  ): string[] {
    const recommendations: string[] = [];

    // Budget recommendation
    const utilization = budget > 0 ? estimatedCost / budget : 0;
    if (utilization > 0.9) {
      recommendations.push("Consider increasing budget — currently at >90% utilization");
    } else if (utilization < 0.5) {
      recommendations.push("Budget has headroom — consider adding more quality variants");
    }

    // Video deferral recommendation
    const videoTasks = tasks.filter((t) => t.taskType === "video_generation");
    if (videoTasks.length > 0) {
      const videoCost = videoTasks.reduce((sum, t) => sum + t.estimatedCostUsd, 0);
      recommendations.push(
        `Defer video generation ($${videoCost.toFixed(2)}) to off-peak — only after image approval`
      );
    }

    // Parallel execution note
    const parallelTasks = tasks.filter((t) => t.parallel);
    if (parallelTasks.length > 2) {
      recommendations.push(
        `${parallelTasks.length} tasks can run in parallel — enables significant time savings`
      );
    }

    // Local tools recommendation
    if (missionCtx.mission.budget.total < 2.0) {
      recommendations.push(
        "Low budget — consider using ComfyUI local tools for drafts to save API costs"
      );
    }

    return recommendations;
  }

  private buildWarnings(
    missionCtx: MissionContext,
    estimatedCost: number,
    budget: number
  ): string[] {
    const warnings: string[] = [];

    if (budget > 0 && estimatedCost > budget) {
      warnings.push(
        `⚠ Estimated cost ($${estimatedCost.toFixed(2)}) exceeds budget ($${budget.toFixed(2)})`
      );
    }

    if (missionCtx.mission.deliverables.length === 0) {
      warnings.push("No deliverables defined — pipeline will run in generic mode");
    }

    if (!missionCtx.brand.colors.primary) {
      warnings.push("Brand primary color not set — agents will use defaults");
    }

    return warnings;
  }
}

// ─── Report Formatter ────────────────────────────────────────────────────

function formatReport(report: Omit<SimulationReport, "formatted">): string {
  const lines: string[] = [];
  const divider = "─".repeat(50);

  lines.push("SIMULATION REPORT");
  lines.push(divider);
  lines.push(`Project: ${report.projectTitle}`);
  lines.push("");
  lines.push(`Agents to spawn: ${report.agentsToSpawn}`);
  lines.push(`  └─ ${report.agentList.join(", ")}`);
  lines.push("");

  if (report.estimatedImages > 0 || report.estimatedVideos > 0) {
    const genParts: string[] = [];
    if (report.estimatedImages > 0) genParts.push(`${report.estimatedImages} images`);
    if (report.estimatedVideos > 0) genParts.push(`${report.estimatedVideos} videos`);
    lines.push(`Estimated generations: ${genParts.join(", ")}`);
  }

  lines.push(`Estimated cost: $${report.estimatedCostUsd.toFixed(2)}`);

  lines.push(
    `Estimated time: ${report.estimatedTimeMinutes} min (with parallel execution)`
  );

  if (report.budgetAllocated > 0) {
    lines.push(
      `Budget utilization: ${report.budgetUtilizationPct}% of allocated $${report.budgetAllocated.toFixed(2)}`
    );
  }

  if (report.criticalPath.length > 0) {
    lines.push(`Critical path: ${report.criticalPath.join(" → ")}`);
  }

  if (report.recommendations.length > 0) {
    lines.push("");
    lines.push("Recommendations:");
    for (const rec of report.recommendations) {
      lines.push(`  • ${rec}`);
    }
  }

  if (report.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings:");
    for (const w of report.warnings) {
      lines.push(`  ${w}`);
    }
  }

  lines.push(divider);

  return lines.join("\n");
}
