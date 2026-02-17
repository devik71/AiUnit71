import type { RoomConfig, Task } from "../core/types.js";
import { AutonomyLevel } from "../core/types.js";
import { BaseRoom } from "./base-room.js";
import type { MemoryStore } from "../memory/memory-store.js";
import type { CostRouter } from "../cost/router.js";

const CONFIG: RoomConfig = {
  id: "3d-render",
  name: "3D & Render Room",
  description:
    "Blender scripts, 3D mascot models, product renders, environment generation, texture creation.",
  capabilities: ["3d-generation", "code-generation"],
  defaultAgents: [
    {
      id: "3d-artist",
      name: "3D Artist",
      role: "artist",
      systemPrompt:
        "You are a 3D artist specializing in Blender. Generate Python scripts for Blender that create models, apply materials, set up lighting, and render scenes.",
      capabilities: ["code-generation", "3d-generation"],
      canTeleport: true,
    },
  ],
  tools: [
    { id: "blender-script", name: "Blender Script Runner", description: "Execute Blender Python scripts", type: "local" },
  ],
  memoryPath: "./memory/3d-render",
  maxConcurrentTasks: 2,
  autonomyLevel: AutonomyLevel.SUPERVISED,
};

export class ThreeDRoom extends BaseRoom {
  constructor(memory: MemoryStore, costRouter: CostRouter) {
    super(CONFIG, memory, costRouter);
  }

  protected async processTask(task: Task): Promise<Record<string, unknown>> {
    const route = this.routeModel({
      capabilities: ["code-generation"],
      inputTokens: 3000,
      outputTokens: 10000,
      minQuality: 70,
      preferLocal: true,
    });

    return {
      blenderScript: null,
      meshData: null,
      renderSettings: null,
      model: route.selected.model,
      costEstimate: route.estimate,
      status: "ready_for_blender_integration",
    };
  }
}
