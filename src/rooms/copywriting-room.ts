import type { RoomConfig, Task } from "../core/types.js";
import { AutonomyLevel } from "../core/types.js";
import { BaseRoom } from "./base-room.js";
import type { MemoryStore } from "../memory/memory-store.js";
import type { CostRouter } from "../cost/router.js";

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
  constructor(memory: MemoryStore, costRouter: CostRouter) {
    super(CONFIG, memory, costRouter);
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

    return {
      contentType,
      drafts: [],
      finalCopy: null,
      model: route.selected.model,
      costEstimate: route.estimate,
      status: "ready_for_llm_integration",
    };
  }
}
