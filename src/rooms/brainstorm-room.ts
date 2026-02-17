import type { RoomConfig, Task } from "../core/types.js";
import { AutonomyLevel } from "../core/types.js";
import { BaseRoom } from "./base-room.js";
import type { MemoryStore } from "../memory/memory-store.js";
import type { CostRouter } from "../cost/router.js";

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
  constructor(memory: MemoryStore, costRouter: CostRouter) {
    super(CONFIG, memory, costRouter);
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

    // In production, this calls the LLM. For now, return structured output.
    return {
      ideas: [],
      moodboard: null,
      selectedConcept: null,
      model: route.selected.model,
      costEstimate: route.estimate,
      status: "ready_for_llm_integration",
    };
  }
}
