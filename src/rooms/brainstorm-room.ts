import type { RoomConfig, Task, CostRecord } from "../core/types.js";
import { AutonomyLevel } from "../core/types.js";
import { BaseRoom } from "./base-room.js";
import type { MemoryStore } from "../memory/memory-store.js";
import type { CostRouter } from "../cost/router.js";
import { LlmClient } from "../llm/llm-client.js";
import type { ChatMessage } from "../llm/llm-client.js";
import { eventBus } from "../core/event-bus.js";

const CONFIG: RoomConfig = {
  id: "brainstorm",
  name: "Brainstorm Room",
  description:
    "Idea generation, moodboards, creative debates between agents. Multiple agents argue and refine concepts.",
  capabilities: ["text-generation", "analysis"],
  defaultAgents: [
    {
      id: "brainstorm-lead",
      name: "Creative Director",
      role: "lead",
      systemPrompt:
        "You are a Creative Director. Generate bold, original ideas. Challenge conventional thinking. Push boundaries while keeping commercial viability in mind.",
      capabilities: ["text-generation", "analysis"],
      canTeleport: true,
    },
    {
      id: "brainstorm-critic",
      name: "Devil's Advocate",
      role: "critic",
      systemPrompt:
        "You are a constructive critic. Find weaknesses in ideas, suggest improvements, and ensure concepts are feasible and market-ready.",
      capabilities: ["text-generation", "analysis"],
      canTeleport: false,
    },
  ],
  tools: [],
  memoryPath: "./memory/brainstorm",
  maxConcurrentTasks: 5,
  autonomyLevel: AutonomyLevel.GUIDED,
};

export class BrainstormRoom extends BaseRoom {
  private llm: LlmClient;

  constructor(memory: MemoryStore, costRouter: CostRouter) {
    super(CONFIG, memory, costRouter);
    this.llm = new LlmClient();
  }

  protected async processTask(task: Task): Promise<Record<string, unknown>> {
    const route = this.routeModel({
      capabilities: ["text-generation"],
      inputTokens: 2000,
      outputTokens: 4000,
      preferLocal: true,
      minQuality: 60,
    });

    this.memory.add(this.id, {
      roomId: this.id,
      taskId: task.id,
      type: "context",
      content: `Brainstorming: ${task.description}. Using ${route.selected.model} (${route.reasoning})`,
      metadata: { model: route.selected.model, cost: route.estimate.estimatedCostUsd },
    });

    // Build messages for the Creative Director agent
    const agent = this.state.agents.find((a) => a.config.role === "lead");
    const systemPrompt = agent?.config.systemPrompt ?? CONFIG.defaultAgents[0].systemPrompt;
    const contextHistory = this.memory.getContextForAgent(this.id, 10);

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          `Task: ${task.title}`,
          `Description: ${task.description}`,
          "",
          "Previous context:",
          contextHistory,
          "",
          "Generate 3-5 creative ideas. For each idea provide:",
          "1. A short title",
          "2. A one-paragraph description",
          "3. A feasibility rating (1-10)",
          "",
          "Then select the best concept and explain why.",
        ].join("\n"),
      },
    ];

    try {
      const response = await this.llm.chat({
        model: route.selected.model,
        messages,
        temperature: 0.9,
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
        content: `Brainstorm completed. Model: ${response.model}. Output length: ${response.content.length} chars.`,
        metadata: {
          model: response.model,
          inputTokens: response.usage.inputTokens,
          outputTokens: response.usage.outputTokens,
          latencyMs: response.latencyMs,
        },
      });

      return {
        ideas: response.content,
        model: response.model,
        usage: response.usage,
        latencyMs: response.latencyMs,
        costEstimate: route.estimate,
        status: "completed",
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.log.warn(`LLM call failed, returning stub: ${errMsg}`);

      // Graceful fallback: return stub output if LLM is unreachable
      return {
        ideas: [],
        moodboard: null,
        selectedConcept: null,
        model: route.selected.model,
        costEstimate: route.estimate,
        status: "llm_unavailable",
        error: errMsg,
      };
    }
  }
}
