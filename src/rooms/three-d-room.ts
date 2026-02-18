import type { RoomConfig, Task, CostRecord } from "../core/types.js";
import { AutonomyLevel } from "../core/types.js";
import { BaseRoom } from "./base-room.js";
import type { MemoryStore } from "../memory/memory-store.js";
import type { CostRouter } from "../cost/router.js";
import { LlmClient } from "../llm/llm-client.js";
import type { ChatMessage } from "../llm/llm-client.js";
import { eventBus } from "../core/event-bus.js";

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
  private llm: LlmClient;

  constructor(memory: MemoryStore, costRouter: CostRouter) {
    super(CONFIG, memory, costRouter);
    this.llm = new LlmClient();
  }

  protected async processTask(task: Task): Promise<Record<string, unknown>> {
    const route = this.routeModel({
      capabilities: ["code-generation"],
      inputTokens: 3000,
      outputTokens: 10000,
      minQuality: 70,
      preferLocal: true,
    });

    const agent = this.state.agents[0];
    const systemPrompt = agent?.config.systemPrompt ?? CONFIG.defaultAgents[0].systemPrompt;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          `Task: ${task.title}`,
          `Description: ${task.description}`,
          "",
          "Generate a complete Blender Python script that:",
          "1. Creates the 3D model/scene described",
          "2. Applies appropriate materials and textures",
          "3. Sets up studio lighting",
          "4. Configures camera and render settings",
          "5. Includes comments for each section",
          "",
          "Use Blender 3.6+ API. Output only the Python script.",
        ].join("\n"),
      },
    ];

    try {
      const response = await this.llm.chat({
        model: route.selected.model,
        messages,
        temperature: 0.5,
        maxTokens: 10000,
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
        blenderScript: response.content,
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
        blenderScript: null,
        meshData: null,
        model: route.selected.model,
        costEstimate: route.estimate,
        status: "llm_unavailable",
        error: errMsg,
      };
    }
  }
}
