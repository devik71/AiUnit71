import type { RoomConfig, Task } from "../core/types.js";
import { AutonomyLevel } from "../core/types.js";
import { BaseRoom } from "./base-room.js";
import type { MemoryStore } from "../memory/memory-store.js";
import type { CostRouter } from "../cost/router.js";

const CONFIG: RoomConfig = {
  id: "image-gen",
  name: "Image Gen & Editing Room",
  description:
    "Image generation via Midjourney, Krea, Nanobanana 3 PRO, Freepik, Adobe Firefly. Editing, upscaling, style transfer.",
  capabilities: ["image-generation"],
  defaultAgents: [
    {
      id: "img-prompt-engineer",
      name: "Prompt Engineer",
      role: "prompt-engineer",
      systemPrompt:
        "You are an expert image prompt engineer. Craft detailed, specific prompts for image generation models. Include style, composition, lighting, mood, and technical parameters.",
      capabilities: ["text-generation", "image-generation"],
      canTeleport: true,
    },
    {
      id: "img-art-director",
      name: "Art Director",
      role: "art-director",
      systemPrompt:
        "You are an Art Director. Review generated images for quality, brand consistency, and commercial viability. Request regeneration with specific feedback.",
      capabilities: ["vision", "analysis"],
      canTeleport: true,
    },
  ],
  tools: [
    { id: "midjourney", name: "Midjourney v6", description: "Premium image generation", type: "api", costPerUse: 0.04 },
    { id: "nanobanana", name: "Nanobanana 3 PRO", description: "Fast affordable image gen", type: "api", costPerUse: 0.01 },
    { id: "krea", name: "Krea AI", description: "Real-time image generation", type: "api", costPerUse: 0.015 },
    { id: "firefly", name: "Adobe Firefly", description: "Commercial-safe image gen", type: "api", costPerUse: 0.02 },
  ],
  memoryPath: "./memory/image-gen",
  maxConcurrentTasks: 8,
  autonomyLevel: AutonomyLevel.SUPERVISED,
};

export class ImageGenRoom extends BaseRoom {
  constructor(memory: MemoryStore, costRouter: CostRouter) {
    super(CONFIG, memory, costRouter);
  }

  protected async processTask(task: Task): Promise<Record<string, unknown>> {
    const quality = (task.input.quality as string) || "standard";
    const style = (task.input.style as string) || "photorealistic";

    // Route prompt generation through cheapest text model
    const promptRoute = this.routeModel({
      capabilities: ["text-generation"],
      inputTokens: 500,
      outputTokens: 500,
      preferLocal: true,
      minQuality: 50,
    });

    // Route image generation through cost router
    const imageRoute = this.routeModel({
      capabilities: ["image-generation"],
      inputTokens: 1, // 1 image
      outputTokens: 0,
      minQuality: quality === "premium" ? 90 : 75,
    });

    return {
      promptModel: promptRoute.selected.model,
      imageModel: imageRoute.selected.model,
      style,
      quality,
      images: [],
      costEstimate: {
        promptCost: promptRoute.estimate.estimatedCostUsd,
        imageCost: imageRoute.estimate.estimatedCostUsd,
        total: promptRoute.estimate.estimatedCostUsd + imageRoute.estimate.estimatedCostUsd,
      },
      status: "ready_for_api_integration",
    };
  }
}
