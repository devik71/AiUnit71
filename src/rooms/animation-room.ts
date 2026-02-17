import type { RoomConfig, Task } from "../core/types.js";
import { AutonomyLevel } from "../core/types.js";
import { BaseRoom } from "./base-room.js";
import type { MemoryStore } from "../memory/memory-store.js";
import type { CostRouter } from "../cost/router.js";

const CONFIG: RoomConfig = {
  id: "animation",
  name: "Animation & Motion Room",
  description:
    "Lottie JSON animations, After Effects scripts, mascot animations (2-5 sec loops), motion graphics, loading animations.",
  capabilities: ["text-generation", "image-generation"],
  defaultAgents: [
    {
      id: "motion-designer",
      name: "Motion Designer",
      role: "motion",
      systemPrompt:
        "You are a motion designer specializing in Lottie animations, After Effects expressions, and CSS animations. Create smooth, performant animations with clean keyframe data.",
      capabilities: ["text-generation", "code-generation"],
      canTeleport: true,
    },
    {
      id: "character-animator",
      name: "Character Animator",
      role: "character",
      systemPrompt:
        "You are a character animator. Design expressive mascot animations with personality. Focus on 2-5 second loops that convey emotion and brand identity.",
      capabilities: ["text-generation", "image-generation"],
      canTeleport: true,
    },
  ],
  tools: [
    { id: "lottie-gen", name: "Lottie Generator", description: "Generate Lottie JSON animations", type: "local" },
    { id: "ae-script", name: "AE Script Runner", description: "Execute After Effects scripts", type: "local" },
  ],
  memoryPath: "./memory/animation",
  maxConcurrentTasks: 4,
  autonomyLevel: AutonomyLevel.SUPERVISED,
};

export class AnimationRoom extends BaseRoom {
  constructor(memory: MemoryStore, costRouter: CostRouter) {
    super(CONFIG, memory, costRouter);
  }

  protected async processTask(task: Task): Promise<Record<string, unknown>> {
    const animType = (task.input.animationType as string) || "lottie";

    const route = this.routeModel({
      capabilities: ["code-generation"],
      inputTokens: 2000,
      outputTokens: 8000,
      preferLocal: true,
      minQuality: 65,
    });

    return {
      animationType: animType,
      lottieJson: null,
      aeScript: null,
      duration: "3s",
      model: route.selected.model,
      costEstimate: route.estimate,
      status: "ready_for_animation_engine",
    };
  }
}
