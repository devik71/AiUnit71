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
  id: "music-audio",
  name: "Music & Audio Room",
  description:
    "Music generation via Suno, voice cloning via ElevenLabs, sound effects, podcast editing, jingle creation.",
  capabilities: ["audio-generation", "voice-cloning"],
  defaultAgents: [
    {
      id: "music-producer",
      name: "Music Producer",
      role: "producer",
      systemPrompt:
        "You are a music producer. Create detailed prompts for AI music generation, specify genre, BPM, mood, instruments, and structure. Ensure commercial-quality output.",
      capabilities: ["text-generation", "audio-generation"],
      canTeleport: true,
    },
    {
      id: "voice-engineer",
      name: "Voice Engineer",
      role: "voice",
      systemPrompt:
        "You are a voice engineer specializing in AI voice cloning and text-to-speech. Configure voice parameters for natural, expressive output.",
      capabilities: ["text-generation", "voice-cloning"],
      canTeleport: false,
    },
  ],
  tools: [
    { id: "suno", name: "Suno v4", description: "AI music generation", type: "api", costPerUse: 0.02 },
    { id: "elevenlabs", name: "ElevenLabs v2", description: "Voice cloning & TTS", type: "api", costPerUse: 0.015 },
  ],
  memoryPath: "./memory/music-audio",
  maxConcurrentTasks: 4,
  autonomyLevel: AutonomyLevel.SUPERVISED,
};

export class MusicAudioRoom extends BaseRoom {
  private llm: LlmClient;

  constructor(memory: MemoryStore, mcpHost: McpHost, costRouter: CostRouter) {
    super(CONFIG, memory, mcpHost, costRouter);
    this.llm = new LlmClient();
  }

  protected async processTask(task: Task): Promise<Record<string, unknown>> {
    const audioType = (task.input.audioType as string) || "music";

    const route = this.routeModel({
      capabilities: ["text-generation"],
      inputTokens: 1500,
      outputTokens: 2000,
      preferLocal: true,
      minQuality: 60,
    });

    const agent = this.state.agents.find((a) =>
      audioType === "voice" ? a.config.role === "voice" : a.config.role === "producer"
    );
    const systemPrompt = agent?.config.systemPrompt ?? CONFIG.defaultAgents[0].systemPrompt;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: audioType === "voice"
          ? [
            `Task: ${task.title}`,
            `Description: ${task.description}`,
            "",
            "Create voice synthesis parameters:",
            "1. Voice character description",
            "2. Speaking style and pace",
            "3. Emotional tone",
            "4. Text to synthesize",
            "5. Output format and quality settings",
          ].join("\n")
          : [
            `Task: ${task.title}`,
            `Description: ${task.description}`,
            "",
            "Create a music generation prompt for Suno:",
            "1. Genre and sub-genre",
            "2. BPM and key",
            "3. Mood and energy level",
            "4. Instruments and arrangement",
            "5. Structure (intro, verse, chorus, etc.)",
            "6. Duration target",
          ].join("\n"),
      },
    ];

    try {
      const response = await this.runWithTools(this.llm, {
        model: route.selected.model,
        messages,
        temperature: 0.7,
        maxTokens: 4096,
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
        audioType,
        generatedPrompt: response.content,
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
        audioType,
        audioUrl: null,
        model: route.selected.model,
        costEstimate: route.estimate,
        status: "llm_unavailable",
        error: errMsg,
      };
    }
  }
}
