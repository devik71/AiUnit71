import type { RoomConfig, Task } from "../core/types.js";
import { AutonomyLevel } from "../core/types.js";
import { BaseRoom } from "./base-room.js";
import type { MemoryStore } from "../memory/memory-store.js";
import { CostRouter } from "../cost/router.js";
import { MODEL_OPTIONS } from "../cost/pricing-table.js";

const CONFIG: RoomConfig = {
  id: "cost-routing",
  name: "Cost & Routing Room",
  description:
    "Always-on cost calculator and smart router. Analyzes every operation for optimal cost/quality balance.",
  capabilities: ["analysis"],
  defaultAgents: [
    {
      id: "cost-analyst",
      name: "Cost Analyst",
      role: "analyst",
      systemPrompt:
        "You are a cost optimization analyst. Monitor all operations, suggest cheaper alternatives, flag overspending, and maintain the cost ledger.",
      capabilities: ["analysis", "text-generation"],
      canTeleport: true,
    },
  ],
  tools: [],
  memoryPath: "./memory/cost-routing",
  maxConcurrentTasks: 20,
  autonomyLevel: AutonomyLevel.FREERIDE,
};

export class CostRoutingRoom extends BaseRoom {
  constructor(memory: MemoryStore, costRouter: CostRouter) {
    super(CONFIG, memory, costRouter);
  }

  /** Get a comprehensive cost comparison for a set of capabilities */
  compareOptions(
    capabilities: string[],
    inputTokens: number,
    outputTokens: number
  ): Array<{
    model: string;
    provider: string;
    cost: number;
    quality: number;
    isLocal: boolean;
  }> {
    return MODEL_OPTIONS.filter((m) =>
      capabilities.every((cap) => m.capabilities.includes(cap as any))
    )
      .map((m) => ({
        model: m.model,
        provider: m.provider.name,
        cost:
          (inputTokens / 1000) * m.inputCostPer1k +
          (outputTokens / 1000) * m.outputCostPer1k,
        quality: m.qualityScore,
        isLocal: m.provider.type === "local",
      }))
      .sort((a, b) => a.cost - b.cost);
  }

  /** Format a cost comparison as a readable table */
  formatComparison(
    capabilities: string[],
    inputTokens: number,
    outputTokens: number
  ): string {
    const options = this.compareOptions(capabilities, inputTokens, outputTokens);
    if (options.length === 0) return "No models available for these capabilities.";

    let table = `Cost Comparison (${inputTokens} in / ${outputTokens} out tokens)\n`;
    table += "─".repeat(70) + "\n";
    table += `${"Model".padEnd(35)} ${"Provider".padEnd(18)} ${"Cost".padEnd(10)} Quality\n`;
    table += "─".repeat(70) + "\n";

    for (const opt of options) {
      const costStr = opt.isLocal ? "FREE" : `$${opt.cost.toFixed(6)}`;
      table += `${opt.model.padEnd(35)} ${opt.provider.padEnd(18)} ${costStr.padEnd(10)} ${opt.quality}/100\n`;
    }

    return table;
  }

  protected async processTask(task: Task): Promise<Record<string, unknown>> {
    const requestedCapabilities = (task.input.capabilities as string[]) || [
      "text-generation",
    ];

    const route = this.routeModel({
      capabilities: requestedCapabilities as any,
      inputTokens: (task.input.inputTokens as number) || 1000,
      outputTokens: (task.input.outputTokens as number) || 1000,
      minQuality: (task.input.minQuality as number) || 50,
    });

    // Format comparison as readable markdown
    const alts = route.estimate.alternatives;
    const lines = [
      `# Cost Comparison: ${requestedCapabilities.join(", ")}`,
      "",
      "| # | Model | Provider | Cost | Quality |",
      "|---|-------|----------|------|---------|",
      `| ★ | ${route.selected.model} | ${route.selected.provider.name} | $${route.estimate.estimatedCostUsd.toFixed(6)} | ${route.selected.qualityScore}/100 |`,
      ...alts.map((a, i) =>
        `| ${i + 1} | ${a.model} | ${a.provider} | $${a.costUsd.toFixed(6)} | ${a.qualityScore}/100 |`
      ),
      "",
      `**Selected**: ${route.selected.model}`,
      `**Reasoning**: ${route.reasoning}`,
    ];

    return {
      comparison: lines.join("\n"),
      selected: route.selected.model,
      estimatedCostUsd: route.estimate.estimatedCostUsd,
      alternatives: alts,
      reasoning: route.reasoning,
      status: "completed",
    };
  }
}
