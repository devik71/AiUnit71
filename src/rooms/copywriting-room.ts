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
  id: "copywriting",
  name: "Copywriting & Text Room",
  description:
    "Lyrics, SMM posts, ad copy, scripts, blog posts, product descriptions. Multi-format text generation.",
  capabilities: ["text-generation"],
  defaultAgents: [
    {
      id: "copy-writer",
      name: "Senior Copywriter",
      role: "writer",
      systemPrompt:
        "You are a senior copywriter with 15 years of experience across advertising, social media, and content marketing. Write compelling, conversion-optimized copy that matches the brand voice.",
      capabilities: ["text-generation"],
      canTeleport: true,
    },
    {
      id: "copy-editor",
      name: "Copy Editor",
      role: "editor",
      systemPrompt:
        "You are a meticulous copy editor. Review text for grammar, tone consistency, brand alignment, and persuasiveness. Suggest concrete improvements.",
      capabilities: ["text-generation", "analysis"],
      canTeleport: false,
    },
  ],
  tools: [],
  memoryPath: "./memory/copywriting",
  maxConcurrentTasks: 10,
  autonomyLevel: AutonomyLevel.GUIDED,
};

export class CopywritingRoom extends BaseRoom {
  private llm: LlmClient;

  constructor(memory: MemoryStore, mcpHost: McpHost, costRouter: CostRouter) {
    super(CONFIG, memory, mcpHost, costRouter);
    this.llm = new LlmClient();
  }

  protected async processTask(task: Task): Promise<Record<string, unknown>> {
    const contentType = (task.input.contentType as string) || "general";
    const qualityNeeded = contentType === "ad_copy" ? 80 : 60;

    const route = this.routeModel({
      capabilities: ["text-generation"],
      inputTokens: 1500,
      outputTokens: 3000,
      preferLocal: qualityNeeded <= 65,
      minQuality: qualityNeeded,
    });

    // Build messages for the Senior Copywriter agent
    const agent = this.state.agents.find((a) => a.config.role === "writer");
    const systemPrompt = agent?.config.systemPrompt ?? CONFIG.defaultAgents[0].systemPrompt;
    const contextHistory = this.memory.getContextForAgent(this.id, 10);

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          `Task: ${task.title}`,
          `Description: ${task.description}`,
          `Content type: ${contentType}`,
          "",
          "Previous context:",
          contextHistory,
          "",
          "Write the requested copy. Provide:",
          "1. A draft version",
          "2. Tone and voice notes",
          "3. One alternative variation",
          "",
          "Format the output clearly with headers.",
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

      // Record actual cost
      const actualCost = route.estimate.estimatedCostUsd;
      const costRecord: CostRecord = {
        taskId: task.id,
        model: response.model,
        provider: route.selected.provider.name,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        costUsd: actualCost,
        timestamp: new Date(),
      };
      eventBus.dispatch({ type: "cost:recorded", record: costRecord });

      this.memory.add(this.id, {
        roomId: this.id,
        taskId: task.id,
        agentId: agent?.config.id,
        type: "experience",
        content: `Copy completed (${contentType}). Model: ${response.model}. Length: ${response.content.length} chars.`,
        metadata: {
          contentType,
          model: response.model,
          inputTokens: response.usage.inputTokens,
          outputTokens: response.usage.outputTokens,
          latencyMs: response.latencyMs,
        },
      });

      return {
        contentType,
        drafts: [response.content],
        finalCopy: response.content,
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
        contentType,
        drafts: [],
        finalCopy: null,
        model: route.selected.model,
        costEstimate: route.estimate,
        status: "llm_unavailable",
        error: errMsg,
      };
    }
  }
}
