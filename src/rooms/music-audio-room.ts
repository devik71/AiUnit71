import type { RoomConfig, Task } from "../core/types.js";
import { AutonomyLevel } from "../core/types.js";
import { BaseRoom } from "./base-room.js";
import type { MemoryStore } from "../memory/memory-store.js";
import type { CostRouter } from "../cost/router.js";

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
  constructor(memory: MemoryStore, costRouter: CostRouter) {
    super(CONFIG, memory, costRouter);
  }

  protected async processTask(task: Task): Promise<Record<string, unknown>> {
    const audioType = (task.input.audioType as string) || "music";

    const route = this.routeModel({
      capabilities: [audioType === "voice" ? "voice-cloning" : "audio-generation"],
      inputTokens: 1,
      outputTokens: 0,
      minQuality: 85,
    });

    return {
      audioType,
      audioUrl: null,
      duration: null,
      model: route.selected.model,
      costEstimate: route.estimate,
      status: "ready_for_audio_api_integration",
    };
  }
}
