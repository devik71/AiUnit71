import type { RoomConfig, Task } from "../core/types.js";
import { AutonomyLevel } from "../core/types.js";
import { BaseRoom } from "./base-room.js";
import type { MemoryStore } from "../memory/memory-store.js";
import type { CostRouter } from "../cost/router.js";

const CONFIG: RoomConfig = {
  id: "video",
  name: "Video Production Room",
  description:
    "Video generation via Veo 3.1, Kling, Luma Dream Machine, Higgsfield, Sora 2. Editing, transitions, music video assembly.",
  capabilities: ["video-generation"],
  defaultAgents: [
    {
      id: "video-director",
      name: "Video Director",
      role: "director",
      systemPrompt:
        "You are a video director. Plan shots, transitions, and narrative flow. Break video projects into scene-by-scene production plans with specific generation parameters.",
      capabilities: ["text-generation", "video-generation"],
      canTeleport: true,
    },
    {
      id: "video-editor",
      name: "Video Editor",
      role: "editor",
      systemPrompt:
        "You are a video editor. Assemble generated clips, add transitions, sync audio, and ensure pacing. Output timeline specifications and editing scripts.",
      capabilities: ["text-generation", "video-generation"],
      canTeleport: false,
    },
  ],
  tools: [
    { id: "veo", name: "Veo 3.1", description: "Google video generation", type: "api", costPerUse: 0.05 },
    { id: "kling", name: "Kling v2", description: "Kling video generation", type: "api", costPerUse: 0.03 },
    { id: "luma", name: "Luma Dream Machine", description: "Luma video gen", type: "api", costPerUse: 0.025 },
    { id: "sora", name: "Sora 2", description: "OpenAI video generation", type: "api", costPerUse: 0.06 },
  ],
  memoryPath: "./memory/video",
  maxConcurrentTasks: 3,
  autonomyLevel: AutonomyLevel.SUPERVISED,
};

export class VideoRoom extends BaseRoom {
  constructor(memory: MemoryStore, costRouter: CostRouter) {
    super(CONFIG, memory, costRouter);
  }

  protected async processTask(task: Task): Promise<Record<string, unknown>> {
    const quality = (task.input.quality as string) || "standard";

    // Route script/planning through text model
    const scriptRoute = this.routeModel({
      capabilities: ["text-generation"],
      inputTokens: 2000,
      outputTokens: 3000,
      preferLocal: true,
      minQuality: 60,
    });

    // Route video generation through video model
    const videoRoute = this.routeModel({
      capabilities: ["video-generation"],
      inputTokens: 1, // 1 clip
      outputTokens: 0,
      minQuality: quality === "premium" ? 88 : 78,
    });

    return {
      scriptModel: scriptRoute.selected.model,
      videoModel: videoRoute.selected.model,
      scenes: [],
      timeline: null,
      costEstimate: {
        scriptCost: scriptRoute.estimate.estimatedCostUsd,
        videoCost: videoRoute.estimate.estimatedCostUsd,
        total: scriptRoute.estimate.estimatedCostUsd + videoRoute.estimate.estimatedCostUsd,
      },
      status: "ready_for_video_api_integration",
    };
  }
}
