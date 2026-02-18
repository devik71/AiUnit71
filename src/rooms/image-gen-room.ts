import type { RoomConfig, Task, CostRecord } from "../core/types.js";
import { AutonomyLevel } from "../core/types.js";
import { BaseRoom } from "./base-room.js";
import type { MemoryStore } from "../memory/memory-store.js";
import type { CostRouter } from "../cost/router.js";
import { LlmClient } from "../llm/llm-client.js";
import type { ChatMessage } from "../llm/llm-client.js";
import { eventBus } from "../core/event-bus.js";

const CONFIG: RoomConfig = {
  id: "image-gen",
  name: "Image Generation Room",
  description:
    "Product shots, social media visuals, avatars, backgrounds, concept art. All formats and styles.",
  capabilities: ["image-generation", "text-generation"],
  defaultAgents: [
    {
      id: "prompt-engineer",
      name: "Prompt Engineer",
      role: "prompt",
      systemPrompt:
        "You are an expert AI image prompt engineer. Create detailed, structured prompts that produce high-quality images. Specify style, composition, lighting, mood, colors, and technical parameters.",
      capabilities: ["text-generation"],
      canTeleport: true,
    },
    {
      id: "art-director",
      name: "Art Director",
      role: "director",
      systemPrompt:
        "You are an art director. Review image concepts and prompts. Ensure visual consistency, brand alignment, and commercial quality. Refine prompts for better output.",
      capabilities: ["text-generation", "analysis"],
      canTeleport: false,
    },
  ],
  tools: [],
  memoryPath: "./memory/image-gen",
  maxConcurrentTasks: 8,
  autonomyLevel: AutonomyLevel.GUIDED,
};

export class ImageGenRoom extends BaseRoom {
  private llm: LlmClient;

  constructor(memory: MemoryStore, costRouter: CostRouter) {
    super(CONFIG, memory, costRouter);
    this.llm = new LlmClient();
  }

  protected async processTask(task: Task): Promise<Record<string, unknown>> {
    // Step 1: Route for prompt engineering (text model)
    const promptRoute = this.routeModel({
      capabilities: ["text-generation"],
      inputTokens: 1500,
      outputTokens: 2000,
      preferLocal: true,
      minQuality: 60,
    });

    // Step 2: Route for actual image generation
    const imageRoute = this.routeModel({
      capabilities: ["image-generation"],
      inputTokens: 1,
      outputTokens: 0,
      minQuality: 75,
    });

    const agent = this.state.agents.find((a) => a.config.role === "prompt");
    const systemPrompt = agent?.config.systemPrompt ?? CONFIG.defaultAgents[0].systemPrompt;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          `Task: ${task.title}`,
          `Description: ${task.description}`,
          "",
          "Generate a detailed image generation prompt. Include:",
          "1. Main subject description",
          "2. Style and artistic direction",
          "3. Lighting and mood",
          "4. Technical parameters (aspect ratio, quality)",
          "5. Negative prompt (what to avoid)",
        ].join("\n"),
      },
    ];

    try {
      const response = await this.llm.chat({
        model: promptRoute.selected.model,
        messages,
        temperature: 0.8,
        maxTokens: 2048,
      });

      const costRecord: CostRecord = {
        taskId: task.id,
        model: response.model,
        provider: promptRoute.selected.provider.name,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        costUsd: promptRoute.estimate.estimatedCostUsd,
        timestamp: new Date(),
      };
      eventBus.dispatch({ type: "cost:recorded", record: costRecord });

      this.memory.add(this.id, {
        roomId: this.id,
        taskId: task.id,
        agentId: agent?.config.id,
        type: "experience",
        content: `Image prompt generated. Model: ${response.model}. Prompt length: ${response.content.length} chars.`,
        metadata: { model: response.model, latencyMs: response.latencyMs },
      });

      return {
        generatedPrompt: response.content,
        imageModel: imageRoute.selected.model,
        imageProvider: imageRoute.selected.provider.name,
        imageCostEstimate: imageRoute.estimate,
        promptModel: response.model,
        usage: response.usage,
        latencyMs: response.latencyMs,
        status: "completed",
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.log.warn(`LLM call failed, returning stub: ${errMsg}`);
      return {
        generatedPrompt: null,
        imageModel: imageRoute.selected.model,
        imageCostEstimate: imageRoute.estimate,
        status: "llm_unavailable",
        error: errMsg,
      };
    }
  }
}
