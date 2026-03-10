import type { RoomConfig, Task, CostRecord } from "../core/types.js";
import { AutonomyLevel } from "../core/types.js";
import { BaseRoom } from "./base-room.js";
import type { MemoryStore } from "../memory/memory-store.js";
import type { McpHost } from "../mcp/host.js";

import type { CostRouter } from "../cost/router.js";
import { LlmClient } from "../llm/llm-client.js";
import type { ChatMessage } from "../llm/llm-client.js";
import { eventBus } from "../core/event-bus.js";

const CONFIG: RoomConfig = {
  id: "video",
  name: "Video Production Room",
  description:
    "Runway/Kling video generation, storyboarding, shot lists, video scripts, b-roll planning.",
  capabilities: ["video-generation", "text-generation"],
  defaultAgents: [
    {
      id: "video-director",
      name: "Video Director",
      role: "director",
      systemPrompt:
        "You are a video director. Create detailed shot lists, storyboards, and video generation prompts. Specify camera angles, movement, pacing, and visual style for AI video generation.",
      capabilities: ["text-generation", "video-generation"],
      canTeleport: true,
    },
    {
      id: "video-editor",
      name: "Video Editor",
      role: "editor",
      systemPrompt:
        "You are a video editor. Plan transitions, pacing, and post-production workflows. Ensure visual coherence and storytelling flow.",
      capabilities: ["text-generation"],
      canTeleport: false,
    },
  ],
  tools: [],
  memoryPath: "./memory/video",
  maxConcurrentTasks: 3,
  autonomyLevel: AutonomyLevel.SUPERVISED,
};

export class VideoRoom extends BaseRoom {
  private llm: LlmClient;

  constructor(memory: MemoryStore, mcpHost: McpHost, costRouter: CostRouter) {
    super(CONFIG, memory, mcpHost, costRouter);
    this.llm = new LlmClient();
  }

  protected async processTask(task: Task): Promise<Record<string, unknown>> {
    const scriptRoute = this.routeModel({
      capabilities: ["text-generation"],
      inputTokens: 2000,
      outputTokens: 4000,
      preferLocal: true,
      minQuality: 65,
    });

    const videoRoute = this.routeModel({
      capabilities: ["video-generation"],
      inputTokens: 1,
      outputTokens: 0,
      minQuality: 80,
    });

    const agent = this.state.agents.find((a) => a.config.role === "director");
    const systemPrompt = agent?.config.systemPrompt ?? CONFIG.defaultAgents[0].systemPrompt;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          `Task: ${task.title}`,
          `Description: ${task.description}`,
          "",
          "Create a video production plan:",
          "1. Storyboard with shot descriptions",
          "2. AI video generation prompt per shot",
          "3. Camera movements and transitions",
          "4. Estimated duration per shot",
          "5. Post-production notes",
        ].join("\n"),
      },
    ];

    try {
      const response = await this.runWithTools(this.llm, {
        model: scriptRoute.selected.model,
        messages,
        temperature: 0.7,
        maxTokens: 4096,
      });

      const costRecord: CostRecord = {
        taskId: task.id,
        model: response.model,
        provider: scriptRoute.selected.provider.name,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        costUsd: scriptRoute.estimate.estimatedCostUsd,
        timestamp: new Date(),
      };
      eventBus.dispatch({ type: "cost:recorded", record: costRecord });

      return {
        storyboard: response.content,
        videoModel: videoRoute.selected.model,
        videoCostEstimate: videoRoute.estimate,
        scriptModel: response.model,
        usage: response.usage,
        latencyMs: response.latencyMs,
        status: "completed",
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.log.warn(`LLM call failed, returning stub: ${errMsg}`);
      return {
        storyboard: null,
        videoModel: videoRoute.selected.model,
        videoCostEstimate: videoRoute.estimate,
        status: "llm_unavailable",
        error: errMsg,
      };
    }
  }
}
