import type { RoomConfig, Task, CostRecord } from "../core/types.js";
import { AutonomyLevel } from "../core/types.js";
import { BaseRoom } from "./base-room.js";
import type { MemoryStore } from "../memory/memory-store.js";
import type { CostRouter } from "../cost/router.js";
import { LlmClient } from "../llm/llm-client.js";
import type { ChatMessage } from "../llm/llm-client.js";
import { eventBus } from "../core/event-bus.js";

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
  private llm: LlmClient;

  constructor(memory: MemoryStore, costRouter: CostRouter) {
    super(CONFIG, memory, costRouter);
    this.llm = new LlmClient();
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

    const agent = this.state.agents.find((a) => a.config.role === "motion");
    const systemPrompt = agent?.config.systemPrompt ?? CONFIG.defaultAgents[0].systemPrompt;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          `Task: ${task.title}`,
          `Description: ${task.description}`,
          `Animation type: ${animType}`,
          "",
          animType === "lottie"
            ? "Generate a valid Lottie JSON animation. Include layers, keyframes, and timing."
            : "Generate an After Effects expression/script. Include keyframe data and layer setup.",
          "",
          "Requirements:",
          "1. Duration: 2-5 seconds loop",
          "2. Smooth easing curves",
          "3. Clean, optimized structure",
          "4. Comments explaining the animation",
        ].join("\n"),
      },
    ];

    try {
      const response = await this.llm.chat({
        model: route.selected.model,
        messages,
        temperature: 0.6,
        maxTokens: 8000,
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
        animationType: animType,
        animationCode: response.content,
        duration: "3s",
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
        animationType: animType,
        lottieJson: null,
        aeScript: null,
        duration: "3s",
        model: route.selected.model,
        costEstimate: route.estimate,
        status: "llm_unavailable",
        error: errMsg,
      };
    }
  }
}
