import type { RoomConfig, Task } from "../core/types.js";
import { AutonomyLevel } from "../core/types.js";
import { BaseRoom } from "./base-room.js";
import type { MemoryStore } from "../memory/memory-store.js";
import type { CostRouter } from "../cost/router.js";

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
  constructor(memory: MemoryStore, costRouter: CostRouter) {
    super(CONFIG, memory, costRouter);
  }

  protected async processTask(task: Task): Promise<Record<string, unknown>> {
    const route = this.routeModel({
      capabilities: ["text-generation"],
      inputTokens: 3000,
      outputTokens: 5000,
      minQuality: 75,
    });

    return {
      wireframes: [],
      designTokens: null,
      prototypePlan: null,
      model: route.selected.model,
      costEstimate: route.estimate,
      status: "ready_for_design_tool_integration",
    };
  }
}
