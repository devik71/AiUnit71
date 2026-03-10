import type { RoomConfig, Task, CostRecord } from "../core/types.js";
import { AutonomyLevel } from "../core/types.js";
import { BaseRoom } from "./base-room.js";
import type { MemoryStore } from "../memory/memory-store.js";
import type { McpHost } from "../mcp/host.js";

import type { CostRouter } from "../cost/router.js";
import { LlmClient } from "../llm/llm-client.js";
import type { ChatMessage } from "../llm/llm-client.js";
import { eventBus } from "../core/event-bus.js";

const CONFIG: RoomConfig = {
  id: "ux-ui",
  name: "UX/UI Design Room",
  description:
    "Figma-like prototypes, wireframes, brandbook compliance, design system generation, responsive layouts.",
  capabilities: ["text-generation", "image-generation"],
  defaultAgents: [
    {
      id: "ux-designer",
      name: "UX Designer",
      role: "ux",
      systemPrompt:
        "You are a UX designer specializing in conversion-optimized interfaces. Create wireframes, user flows, and interaction patterns that prioritize usability and business goals.",
      capabilities: ["text-generation", "analysis"],
      canTeleport: true,
    },
    {
      id: "ui-designer",
      name: "UI Designer",
      role: "ui",
      systemPrompt:
        "You are a UI designer with deep knowledge of design systems, typography, color theory, and modern web aesthetics. Generate pixel-perfect designs that follow brand guidelines.",
      capabilities: ["text-generation", "image-generation"],
      canTeleport: true,
    },
  ],
  tools: [],
  memoryPath: "./memory/ux-ui",
  maxConcurrentTasks: 4,
  autonomyLevel: AutonomyLevel.SUPERVISED,
};

export class UxUiRoom extends BaseRoom {
  private llm: LlmClient;

  constructor(memory: MemoryStore, mcpHost: McpHost, costRouter: CostRouter) {
    super(CONFIG, memory, mcpHost, costRouter);
    this.llm = new LlmClient();
  }

  protected async processTask(task: Task): Promise<Record<string, unknown>> {
    const route = this.routeModel({
      capabilities: ["text-generation"],
      inputTokens: 3000,
      outputTokens: 5000,
      minQuality: 75,
    });

    const agent = this.state.agents.find((a) => a.config.role === "ux");
    const systemPrompt = agent?.config.systemPrompt ?? CONFIG.defaultAgents[0].systemPrompt;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          `Task: ${task.title}`,
          `Description: ${task.description}`,
          "",
          "Create a UX/UI design specification:",
          "1. Wireframe descriptions (each screen/component)",
          "2. User flow diagram (text-based)",
          "3. Design tokens (colors, typography, spacing)",
          "4. Responsive breakpoints and behavior",
          "5. Interaction patterns and micro-animations",
        ].join("\n"),
      },
    ];

    try {
      const response = await this.runWithTools(this.llm, {
        model: route.selected.model,
        messages,
        temperature: 0.7,
        maxTokens: 4096,
      });

      const costRecord: CostRecord = {
        taskId: task.id,
        model: response.model,
        provider: route.selected.provider.name,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        costUsd: route.estimate.estimatedCostUsd,
        timestamp: new Date(),
      };
      eventBus.dispatch({ type: "cost:recorded", record: costRecord });

      return {
        designSpec: response.content,
        model: response.model,
        usage: response.usage,
        latencyMs: response.latencyMs,
        costEstimate: route.estimate,
        status: "completed",
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.log.warn(`LLM call failed, returning stub: ${errMsg}`);
      return {
        wireframes: [],
        designTokens: null,
        model: route.selected.model,
        costEstimate: route.estimate,
        status: "llm_unavailable",
        error: errMsg,
      };
    }
  }
}
