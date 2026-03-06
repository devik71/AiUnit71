/**
 * Tool Registry — centralized registry for all creative tools (APIs + local),
 * with fallback chains per task type.
 *
 * Based on AiUnit71 Architecture Specification v1.0, Section 11.
 *
 * The registry knows:
 * - What tools are available and their capabilities
 * - Cost per operation
 * - Priority order for each task type
 * - How to fall back when a tool is unavailable
 *
 * Usage:
 *   const registry = ToolRegistry.instance;
 *   const chain = registry.getFallbackChain("photorealistic_image");
 *   const tool = await registry.selectBestTool("photorealistic_image", { budget: 0.20 });
 */

import { logger } from "../core/logger.js";

// ─── Tool Definition ───────────────────────────────────────────────────

export type ToolType = "api" | "local" | "queue";

export type ToolCapability =
  | "text-to-image"
  | "image-to-image"
  | "image-editing"
  | "text-rendering"
  | "text-to-video"
  | "image-to-video"
  | "upscale"
  | "animation"
  | "audio-generation"
  | "voice-cloning"
  | "3d-generation";

export type ModelPromptFormat = "keyword_weighted" | "natural_language" | "json" | "midjourney";

export interface ToolSpec {
  id: string;
  name: string;
  type: ToolType;
  capabilities: ToolCapability[];
  /** Model classification for prompt formatting */
  model_type: "diffusion" | "reasoning" | "midjourney" | "video" | "audio" | "upscale";
  prompt_format: ModelPromptFormat;
  /** Cost per generation in USD. 0 = free (local) */
  cost_per_use: number;
  /** Average generation time in seconds */
  avg_time_s?: number;
  /** Maximum output resolution */
  max_resolution?: string;
  strengths?: string[];
  weaknesses?: string[];
  /** Is this tool currently enabled? */
  enabled: boolean;
  /** API endpoint or local URL */
  endpoint?: string;
  /** Environment variable name for API key */
  api_key_env?: string;
  /** Notes for agents */
  note?: string;
}

// ─── Fallback Chain ────────────────────────────────────────────────────

export interface FallbackEntry {
  tool_id: string;
  priority: number;
  /** Optional delay before retry (for queue tools) */
  delay_ms?: number;
}

export type TaskType =
  | "photorealistic_image"
  | "artistic_illustration"
  | "product_visualization"
  | "video_generation"
  | "image_upscale"
  | "audio_generation"
  | "3d_render"
  | "text_render"; // Images with text in them

// ─── Tool Registry ─────────────────────────────────────────────────────

export class ToolRegistry {
  private static _instance: ToolRegistry;

  private tools: Map<string, ToolSpec> = new Map();
  private chains: Map<TaskType, FallbackEntry[]> = new Map();

  private constructor() {
    this.initializeTools();
    this.initializeFallbackChains();
  }

  static get instance(): ToolRegistry {
    if (!ToolRegistry._instance) {
      ToolRegistry._instance = new ToolRegistry();
    }
    return ToolRegistry._instance;
  }

  // ─── Public API ────────────────────────────────────────────────────

  /**
   * Get a tool by ID.
   */
  getTool(id: string): ToolSpec | undefined {
    return this.tools.get(id);
  }

  /**
   * Get all tools with a specific capability.
   */
  getToolsByCapability(capability: ToolCapability): ToolSpec[] {
    return Array.from(this.tools.values()).filter(
      (t) => t.enabled && t.capabilities.includes(capability)
    );
  }

  /**
   * Get the fallback chain for a task type.
   * Returns tools in priority order (priority 1 = best choice).
   */
  getFallbackChain(taskType: TaskType): FallbackEntry[] {
    return this.chains.get(taskType) ?? [];
  }

  /**
   * Select the best available tool for a task type within a budget.
   * Walks the fallback chain until it finds a tool that fits.
   *
   * @param taskType - The type of task
   * @param options.budget - Maximum cost in USD (0 = no limit)
   * @param options.preferLocal - Prefer local tools over API
   * @returns The selected tool, or null if none found
   */
  selectBestTool(
    taskType: TaskType,
    options: { budget?: number; preferLocal?: boolean } = {}
  ): ToolSpec | null {
    const chain = this.getFallbackChain(taskType);
    const { budget = Infinity, preferLocal = false } = options;

    // If preferLocal, try local tools first
    if (preferLocal) {
      const localTool = chain
        .sort((a, b) => a.priority - b.priority)
        .map((e) => this.tools.get(e.tool_id))
        .filter((t): t is ToolSpec => t !== undefined && t.enabled && t.type === "local")
        .find((t) => t.cost_per_use <= budget);

      if (localTool) {
        logger.debug(`[ToolRegistry] Selected local tool: ${localTool.id}`);
        return localTool;
      }
    }

    // Walk the chain in priority order
    for (const entry of chain.sort((a, b) => a.priority - b.priority)) {
      const tool = this.tools.get(entry.tool_id);
      if (!tool) continue;
      if (!tool.enabled) {
        logger.debug(`[ToolRegistry] Skipping disabled tool: ${tool.id}`);
        continue;
      }
      if (tool.cost_per_use > budget) {
        logger.debug(`[ToolRegistry] Skipping ${tool.id}: cost $${tool.cost_per_use} > budget $${budget}`);
        continue;
      }

      logger.debug(`[ToolRegistry] Selected tool: ${tool.id} (priority ${entry.priority})`);
      return tool;
    }

    logger.warn(`[ToolRegistry] No suitable tool found for ${taskType} within budget $${budget}`);
    return null;
  }

  /**
   * Register a new tool at runtime (plugin architecture support).
   */
  registerTool(spec: ToolSpec): void {
    if (this.tools.has(spec.id)) {
      logger.warn(`[ToolRegistry] Tool ${spec.id} already registered, updating`);
    }
    this.tools.set(spec.id, spec);
    logger.info(`[ToolRegistry] Registered tool: ${spec.id}`);
  }

  /**
   * Add or update a fallback chain for a task type.
   */
  setFallbackChain(taskType: TaskType, chain: FallbackEntry[]): void {
    this.chains.set(taskType, chain.sort((a, b) => a.priority - b.priority));
  }

  /**
   * Enable or disable a tool (e.g. when API is down).
   */
  setToolEnabled(toolId: string, enabled: boolean): void {
    const tool = this.tools.get(toolId);
    if (tool) {
      tool.enabled = enabled;
      logger.info(`[ToolRegistry] Tool ${toolId} ${enabled ? "enabled" : "disabled"}`);
    }
  }

  /**
   * Get a summary of the registry for dashboard/dry-run display.
   */
  getSummary(): ToolRegistrySummary {
    const toolList = Array.from(this.tools.values());
    return {
      totalTools: toolList.length,
      enabledTools: toolList.filter((t) => t.enabled).length,
      localTools: toolList.filter((t) => t.type === "local").length,
      apiTools: toolList.filter((t) => t.type === "api").length,
      fallbackChains: this.chains.size,
      tools: toolList.map((t) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        enabled: t.enabled,
        costPerUse: t.cost_per_use,
        capabilities: t.capabilities,
      })),
    };
  }

  // ─── Initialization ────────────────────────────────────────────────

  private initializeTools(): void {
    const tools: ToolSpec[] = [
      // ─── Reasoning Models (image generation) ────────────────────────
      {
        id: "fal-ai/nano-banana-pro",
        name: "Nano Banana Pro",
        type: "api",
        capabilities: ["text-to-image", "image-editing", "text-rendering"],
        model_type: "reasoning",
        prompt_format: "natural_language",
        cost_per_use: 0.15,
        avg_time_s: 8,
        max_resolution: "4K",
        strengths: ["text in image", "complex scenes", "reasoning", "instruction following"],
        weaknesses: ["less artistic control than diffusion"],
        enabled: true,
        api_key_env: "NANOBANANA_API_KEY",
      },
      {
        id: "fal-ai/nano-banana-2",
        name: "Nano Banana 2",
        type: "api",
        capabilities: ["text-to-image", "image-editing"],
        model_type: "reasoning",
        prompt_format: "natural_language",
        cost_per_use: 0.039,
        avg_time_s: 6,
        strengths: ["fast", "cheap", "good quality"],
        weaknesses: ["slightly less quality than Pro"],
        enabled: true,
        api_key_env: "NANOBANANA_API_KEY",
        note: "faster, cheaper, slightly less quality than Pro",
      },

      // ─── Diffusion Models (local via ComfyUI) ─────────────────────
      {
        id: "comfyui/flux-dev",
        name: "Flux Dev (ComfyUI)",
        type: "local",
        capabilities: ["text-to-image", "image-to-image"],
        model_type: "diffusion",
        prompt_format: "keyword_weighted",
        cost_per_use: 0,
        avg_time_s: 20,
        strengths: ["full LoRA/ControlNet control", "free", "reproducible seeds"],
        weaknesses: ["75 token CLIP limit", "needs local GPU", "setup required"],
        enabled: true,
        endpoint: "http://localhost:8188",
      },
      {
        id: "comfyui/flux-photorealistic",
        name: "Flux Photorealistic (ComfyUI)",
        type: "local",
        capabilities: ["text-to-image"],
        model_type: "diffusion",
        prompt_format: "keyword_weighted",
        cost_per_use: 0,
        avg_time_s: 25,
        strengths: ["photorealistic output", "free", "LoRA support"],
        weaknesses: ["75 token limit", "slower than base Flux"],
        enabled: true,
        endpoint: "http://localhost:8188",
      },
      {
        id: "comfyui/flux-dev-lora",
        name: "Flux Dev + LoRA (ComfyUI)",
        type: "local",
        capabilities: ["text-to-image", "image-to-image"],
        model_type: "diffusion",
        prompt_format: "keyword_weighted",
        cost_per_use: 0,
        avg_time_s: 30,
        strengths: ["custom style via LoRA", "IP-Adapter", "ControlNet", "full control"],
        weaknesses: ["requires LoRA files", "slower"],
        enabled: true,
        endpoint: "http://localhost:8188",
      },

      // ─── Artistic / High-quality ─────────────────────────────────
      {
        id: "midjourney",
        name: "Midjourney",
        type: "api",
        capabilities: ["text-to-image"],
        model_type: "midjourney",
        prompt_format: "midjourney",
        cost_per_use: 0.04,
        avg_time_s: 60,
        strengths: ["artistic quality", "consistent style", "community prompts"],
        weaknesses: ["Discord dependency", "less instruction following"],
        enabled: true,
        api_key_env: "MIDJOURNEY_API_KEY",
      },

      // ─── Video Generation ────────────────────────────────────────
      {
        id: "lumalabs/dream-machine",
        name: "Luma Dream Machine",
        type: "api",
        capabilities: ["text-to-video", "image-to-video"],
        model_type: "video",
        prompt_format: "natural_language",
        cost_per_use: 0.50,
        avg_time_s: 120,
        strengths: ["smooth motion", "good quality", "image-to-video"],
        weaknesses: ["expensive", "late expensive operation"],
        enabled: true,
        api_key_env: "LUMALABS_API_KEY",
        note: "late expensive operation — only after image approval",
      },
      {
        id: "runway/gen4",
        name: "Runway Gen-4",
        type: "api",
        capabilities: ["text-to-video", "image-to-video"],
        model_type: "video",
        prompt_format: "natural_language",
        cost_per_use: 0.75,
        avg_time_s: 180,
        strengths: ["cinematic quality", "motion control"],
        weaknesses: ["expensive"],
        enabled: true,
        api_key_env: "RUNWAY_API_KEY",
      },

      // ─── Upscale ─────────────────────────────────────────────────
      {
        id: "topaz/gigapixel",
        name: "Topaz Gigapixel",
        type: "local",
        capabilities: ["upscale"],
        model_type: "upscale",
        prompt_format: "natural_language",
        cost_per_use: 0,
        avg_time_s: 30,
        strengths: ["high quality upscale", "AI-powered detail", "free after license"],
        weaknesses: ["license required", "local GPU"],
        enabled: true,
        note: "last step — only on final approved images",
      },

      // ─── Additional Services ────────────────────────────────────
      {
        id: "krea/generative",
        name: "Krea AI",
        type: "api",
        capabilities: ["text-to-image", "image-to-image"],
        model_type: "reasoning",
        prompt_format: "natural_language",
        cost_per_use: 0.05,
        enabled: true,
        api_key_env: "KREA_API_KEY",
      },
      {
        id: "freepik/mystic",
        name: "Freepik Mystic",
        type: "api",
        capabilities: ["text-to-image"],
        model_type: "diffusion",
        prompt_format: "natural_language",
        cost_per_use: 0.02,
        enabled: true,
        api_key_env: "FREEPIC_API_KEY",
      },

      // ─── Queue (fallback for unavailable tools) ──────────────────
      {
        id: "queue_for_retry",
        name: "Retry Queue",
        type: "queue",
        capabilities: [
          "text-to-image", "image-to-image", "text-to-video",
          "image-to-video", "upscale",
        ],
        model_type: "reasoning",
        prompt_format: "natural_language",
        cost_per_use: 0,
        enabled: true,
        note: "queue for retry when all other tools are unavailable",
      },
    ];

    for (const tool of tools) {
      this.tools.set(tool.id, tool);
    }

    logger.debug(`[ToolRegistry] Initialized ${tools.length} tools`);
  }

  private initializeFallbackChains(): void {
    const chains: Array<[TaskType, FallbackEntry[]]> = [
      [
        "photorealistic_image",
        [
          { tool_id: "fal-ai/nano-banana-pro", priority: 1 },
          { tool_id: "fal-ai/nano-banana-2", priority: 2 },
          { tool_id: "comfyui/flux-photorealistic", priority: 3 },
          { tool_id: "queue_for_retry", priority: 4, delay_ms: 15 * 60 * 1000 },
        ],
      ],
      [
        "artistic_illustration",
        [
          { tool_id: "comfyui/flux-dev-lora", priority: 1 },
          { tool_id: "midjourney", priority: 2 },
          { tool_id: "fal-ai/nano-banana-pro", priority: 3 },
        ],
      ],
      [
        "product_visualization",
        [
          { tool_id: "fal-ai/nano-banana-pro", priority: 1 },
          { tool_id: "comfyui/flux-dev", priority: 2 },
          { tool_id: "midjourney", priority: 3 },
        ],
      ],
      [
        "video_generation",
        [
          { tool_id: "lumalabs/dream-machine", priority: 1 },
          { tool_id: "runway/gen4", priority: 2 },
          { tool_id: "queue_for_retry", priority: 3, delay_ms: 30 * 60 * 1000 },
        ],
      ],
      [
        "image_upscale",
        [
          { tool_id: "topaz/gigapixel", priority: 1 },
          { tool_id: "comfyui/flux-dev", priority: 2 },
        ],
      ],
      [
        "text_render",
        [
          { tool_id: "fal-ai/nano-banana-pro", priority: 1 }, // Best for text in images
          { tool_id: "fal-ai/nano-banana-2", priority: 2 },
        ],
      ],
      [
        "audio_generation",
        [
          // Placeholder — would add ElevenLabs, Suno, etc.
          { tool_id: "queue_for_retry", priority: 1, delay_ms: 5 * 60 * 1000 },
        ],
      ],
      [
        "3d_render",
        [
          // Placeholder — would add specific 3D tools
          { tool_id: "comfyui/flux-dev", priority: 1 },
          { tool_id: "fal-ai/nano-banana-pro", priority: 2 },
        ],
      ],
    ];

    for (const [taskType, chain] of chains) {
      this.chains.set(taskType, chain);
    }

    logger.debug(`[ToolRegistry] Initialized ${chains.length} fallback chains`);
  }
}

// ─── Summary Types ─────────────────────────────────────────────────────

export interface ToolRegistrySummary {
  totalTools: number;
  enabledTools: number;
  localTools: number;
  apiTools: number;
  fallbackChains: number;
  tools: Array<{
    id: string;
    name: string;
    type: ToolType;
    enabled: boolean;
    costPerUse: number;
    capabilities: ToolCapability[];
  }>;
}
