/**
 * VisualPrompterAgent — converts model-agnostic Semantic JSON into
 * model-native prompt formats for each supported generation backend.
 *
 * Based on AiUnit71 Architecture Specification v1.0, Sections 9 & 10.
 *
 * Lifecycle: Standard tier (Ollama local model). Stateless translator —
 * knows the syntax of every target model, not the creative content.
 *
 * Pipeline position:
 *   PromptMaster → PromptCritic → [VisualPrompter] → API call
 *
 * Supported render targets:
 *   - diffusion: Flux/SDXL via ComfyUI (keyword-weighted, ≤75 tokens)
 *   - reasoning: Nano Banana Pro/2 (natural language or JSON)
 *   - midjourney: Midjourney (natural language + --flags)
 */

import { LlmClient } from "../llm/llm-client.js";
import type { ChatMessage } from "../llm/llm-client.js";
import type { AgentConfig, CostRecord } from "../core/types.js";
import type { CostRouter } from "../cost/router.js";
import type { MemoryStore } from "../memory/memory-store.js";
import type { SemanticPromptJson, RenderedPrompt } from "../creative/hook-system.js";
import { eventBus } from "../core/event-bus.js";
import { logger } from "../core/logger.js";

// ─── Render Targets ─────────────────────────────────────────────────────

export type RenderTarget = "diffusion" | "reasoning" | "midjourney";

export interface RenderResult {
  target: RenderTarget;
  rendered: RenderedPrompt;
  /** All rendered variants (one per requested target) */
  all?: Partial<Record<RenderTarget, RenderedPrompt>>;
  model?: string;
  status: "rendered" | "fallback";
}

// ─── Visual Prompter Agent ──────────────────────────────────────────────

export class VisualPrompterAgent {
  private llm: LlmClient;
  private costRouter: CostRouter;
  private memory: MemoryStore;

  static readonly AGENT_CONFIG: AgentConfig = {
    id: "visual-prompter",
    name: "VisualPrompter",
    role: "visual-prompter",
    systemPrompt: `You are VisualPrompter — AiUnit71's prompt format translator.

You convert semantic JSON (model-agnostic) into model-native prompt formats.
You know the exact syntax rules for each target model.

DIFFUSION (Flux/SDXL via ComfyUI):
- Keyword-based format, comma-separated
- Weights: (keyword:1.3) for emphasis, max weight 1.6
- MUST stay under 75 tokens (CLIP limit)
- Always include a negative prompt
- Format: "(weighted_keyword:1.2), keyword, keyword, ...\nNegative: word, word"

REASONING (Nano Banana Pro):
- Natural language description as JSON
- Return: {"prompt": "full description", "aspect_ratio": "16:9", "num_images": 1}
- Be descriptive, reference exact colors with hex codes if available

MIDJOURNEY:
- Natural language description
- End with flags: --ar 16:9 --s 750 --v 6.1 --no text, watermark
- Never use parentheses or colons in the main prompt

Given a semantic JSON and target format, return ONLY the rendered prompt in the correct format.
No explanation, no markdown fences, just the prompt.`,
    capabilities: ["text-generation"],
    canTeleport: false,
  };

  constructor(costRouter: CostRouter, memory: MemoryStore) {
    this.llm = new LlmClient();
    this.costRouter = costRouter;
    this.memory = memory;
  }

  /**
   * Render a semantic JSON prompt for a specific model target.
   *
   * @param semanticJson - The model-agnostic semantic prompt
   * @param target - The render target (diffusion | reasoning | midjourney)
   * @param taskId - Task context for cost tracking
   */
  async render(
    semanticJson: SemanticPromptJson,
    target: RenderTarget,
    taskId?: string
  ): Promise<RenderResult> {
    const route = this.costRouter.route({
      capabilities: ["text-generation"],
      inputTokens: 600,
      outputTokens: 500,
      preferLocal: true,
      minQuality: 30,
    });

    const targetInstructions = this.getTargetInstructions(target);

    const messages: ChatMessage[] = [
      { role: "system", content: VisualPrompterAgent.AGENT_CONFIG.systemPrompt },
      {
        role: "user",
        content: [
          `Convert this semantic JSON to ${target.toUpperCase()} format:`,
          "",
          "```json",
          JSON.stringify(semanticJson, null, 2),
          "```",
          "",
          targetInstructions,
          "",
          `Return ONLY the rendered ${target} prompt. No explanation.`,
        ].join("\n"),
      },
    ];

    try {
      const response = await this.llm.chat({
        model: route.selected.model,
        messages,
        temperature: 0.3,
        maxTokens: 512,
      });

      // Record cost
      const costRecord: CostRecord = {
        taskId: taskId ?? "visual-prompter",
        model: response.model,
        provider: route.selected.provider.name,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        costUsd: route.estimate.estimatedCostUsd,
        timestamp: new Date(),
      };
      eventBus.dispatch({ type: "cost:recorded", record: costRecord });

      const rendered = this.parseRenderedOutput(response.content, target, semanticJson);

      // Log to memory
      this.memory.add("visual-prompter", {
        roomId: "visual-prompter",
        taskId,
        agentId: "visual-prompter",
        type: "experience",
        content: `Rendered for ${target}: ${rendered.prompt.slice(0, 100)}...`,
        metadata: { target, model: response.model, tokenEstimate: estimateTokens(rendered.prompt) },
      });

      logger.debug(`[VisualPrompter] Rendered for ${target}: ~${estimateTokens(rendered.prompt)} tokens`);

      return {
        target,
        rendered,
        model: response.model,
        status: "rendered",
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.warn(`[VisualPrompter] LLM unavailable, using rule-based rendering: ${errMsg}`);

      // Fallback: rule-based rendering (no LLM)
      const rendered = this.ruleBasedRender(semanticJson, target);

      return {
        target,
        rendered,
        status: "fallback",
      };
    }
  }

  /**
   * Render for all supported targets at once.
   * Returns the primary target's result plus all alternatives.
   */
  async renderAll(
    semanticJson: SemanticPromptJson,
    primaryTarget: RenderTarget,
    taskId?: string
  ): Promise<RenderResult> {
    const targets: RenderTarget[] = ["diffusion", "reasoning", "midjourney"];
    const results = await Promise.allSettled(
      targets.map((t) => this.render(semanticJson, t, taskId))
    );

    const all: Partial<Record<RenderTarget, RenderedPrompt>> = {};
    for (let i = 0; i < targets.length; i++) {
      const r = results[i];
      if (r.status === "fulfilled") {
        all[targets[i]] = r.value.rendered;
      }
    }

    const primaryResult = all[primaryTarget];
    if (!primaryResult) {
      throw new Error(`Failed to render for primary target: ${primaryTarget}`);
    }

    return {
      target: primaryTarget,
      rendered: primaryResult,
      all,
      status: "rendered",
    };
  }

  // ─── Rule-Based Rendering (fallback) ─────────────────────────────────

  /**
   * Rule-based rendering without LLM — used as fallback.
   * Produces a reasonable but not optimized prompt.
   */
  ruleBasedRender(semanticJson: SemanticPromptJson, target: RenderTarget): RenderedPrompt {
    switch (target) {
      case "diffusion":
        return this.ruleBasedDiffusion(semanticJson);
      case "reasoning":
        return this.ruleBasedReasoning(semanticJson);
      case "midjourney":
        return this.ruleBasedMidjourney(semanticJson);
    }
  }

  private ruleBasedDiffusion(s: SemanticPromptJson): RenderedPrompt {
    const parts: string[] = [];

    if (s.style?.medium) parts.push(`(${s.style.medium}:1.3)`);
    if (s.subject?.type) parts.push(s.subject.type);
    if (s.subject?.material) parts.push(s.subject.material);
    if (s.subject?.position) parts.push(s.subject.position);
    if (s.environment?.background) parts.push(s.environment.background);
    if (s.lighting?.primary) parts.push(`(${s.lighting.primary}:1.2)`);
    if (s.lighting?.secondary) parts.push(s.lighting.secondary);
    if (s.composition?.framing) parts.push(s.composition.framing);
    if (s.style?.aesthetic) parts.push(`${s.style.aesthetic} style`);
    if (s.style?.anti_slop?.length) parts.push(...s.style.anti_slop);

    const negatives = [
      "text", "watermark", "oversaturated", "plastic look",
      "centered composition", "stock photo",
    ];

    const prompt = parts.join(", ");
    const aspect = s.composition?.aspect_ratio ?? "16:9";

    return {
      model_type: "diffusion",
      target_model: "flux-dev",
      prompt,
      negative_prompt: negatives.join(", "),
      params: { aspect_ratio: aspect },
    };
  }

  private ruleBasedReasoning(s: SemanticPromptJson): RenderedPrompt {
    const parts: string[] = [];

    if (s.style?.medium) parts.push(`Create a ${s.style.medium}`);
    if (s.subject?.type) parts.push(`of ${s.subject.type}`);
    if (s.subject?.material) parts.push(`with ${s.subject.material}`);
    if (s.subject?.position) parts.push(`positioned ${s.subject.position}`);

    if (s.environment?.background) parts.push(`Background: ${s.environment.background}`);
    if (s.environment?.elements) parts.push(`with ${s.environment.elements}`);

    if (s.lighting?.primary) parts.push(`Lighting: ${s.lighting.primary}`);
    if (s.lighting?.secondary) parts.push(`and ${s.lighting.secondary}`);

    if (s.composition?.framing) parts.push(`Camera: ${s.composition.framing}`);
    if (s.composition?.angle) parts.push(`at ${s.composition.angle}`);
    if (s.composition?.negative_space) parts.push(`Leave ${s.composition.negative_space} as negative space`);

    if (s.style?.aesthetic) parts.push(`Style: ${s.style.aesthetic}`);
    if (s.style?.color_palette?.length) parts.push(`Colors: ${s.style.color_palette.join(", ")}`);

    const prompt = parts.join(". ");
    const aspect = s.composition?.aspect_ratio ?? "16:9";

    return {
      model_type: "reasoning",
      target_model: "fal-ai/nano-banana-pro",
      prompt: JSON.stringify({ prompt, aspect_ratio: aspect, num_images: 1 }),
      params: { aspect_ratio: aspect },
    };
  }

  private ruleBasedMidjourney(s: SemanticPromptJson): RenderedPrompt {
    const parts: string[] = [];

    if (s.style?.medium) parts.push(s.style.medium);
    if (s.subject?.type) parts.push(s.subject.type);
    if (s.subject?.material) parts.push(s.subject.material);
    if (s.environment?.background) parts.push(s.environment.background);
    if (s.lighting?.primary) parts.push(s.lighting.primary);
    if (s.composition?.framing) parts.push(s.composition.framing);
    if (s.style?.aesthetic) parts.push(`${s.style.aesthetic} aesthetic`);

    const noItems = ["text", "watermark", "stock photo"];
    const aspect = s.composition?.aspect_ratio?.replace(":", ":") ?? "16:9";

    const prompt = parts.join(", ");
    const flags = `--ar ${aspect} --s 750 --v 6.1 --no ${noItems.join(", ")}`;

    return {
      model_type: "midjourney",
      target_model: "midjourney",
      prompt: `${prompt} ${flags}`,
      params: { aspect, style: 750, version: "6.1" },
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  private getTargetInstructions(target: RenderTarget): string {
    switch (target) {
      case "diffusion":
        return [
          "TARGET: Flux/SDXL via ComfyUI (diffusion model)",
          "Rules: keyword-based, comma-separated, weights in (keyword:1.3) format",
          "STRICT limit: 75 tokens maximum",
          "Include a Negative: line at the end",
        ].join("\n");

      case "reasoning":
        return [
          "TARGET: Nano Banana Pro (reasoning model)",
          "Format: JSON object with prompt, aspect_ratio, num_images fields",
          "Use natural language. Reference hex colors if in palette.",
          "Example: {\"prompt\": \"...\", \"aspect_ratio\": \"16:9\", \"num_images\": 1}",
        ].join("\n");

      case "midjourney":
        return [
          "TARGET: Midjourney",
          "Format: natural language description, then flags",
          "Required flags: --ar [aspect] --s 750 --v 6.1",
          "No parentheses, no colons in main prompt",
          "Add --no text, watermark at the end",
        ].join("\n");
    }
  }

  private parseRenderedOutput(
    content: string,
    target: RenderTarget,
    semanticJson: SemanticPromptJson
  ): RenderedPrompt {
    const aspect = semanticJson.composition?.aspect_ratio ?? "16:9";
    const clean = content.trim().replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "");

    switch (target) {
      case "diffusion": {
        const lines = clean.split("\n");
        const promptLine = lines.find((l) => !l.toLowerCase().startsWith("negative:")) ?? clean;
        const negativeLine = lines.find((l) => l.toLowerCase().startsWith("negative:"));
        const negativePrompt = negativeLine?.replace(/^[Nn]egative:\s*/, "") ?? "text, watermark, stock photo";

        return {
          model_type: "diffusion",
          target_model: "flux-dev",
          prompt: promptLine.trim(),
          negative_prompt: negativePrompt.trim(),
          params: { aspect_ratio: aspect },
        };
      }

      case "reasoning": {
        // Try to parse as JSON
        try {
          const parsed = JSON.parse(clean);
          return {
            model_type: "reasoning",
            target_model: "fal-ai/nano-banana-pro",
            prompt: clean, // Keep original JSON string
            params: { aspect_ratio: parsed.aspect_ratio ?? aspect },
          };
        } catch {
          // Not JSON — treat as natural language
          return {
            model_type: "reasoning",
            target_model: "fal-ai/nano-banana-pro",
            prompt: JSON.stringify({ prompt: clean, aspect_ratio: aspect, num_images: 1 }),
            params: { aspect_ratio: aspect },
          };
        }
      }

      case "midjourney":
        return {
          model_type: "midjourney",
          target_model: "midjourney",
          prompt: clean,
          params: { aspect },
        };
    }
  }
}

/** Rough token estimate for diffusion models */
function estimateTokens(text: string): number {
  return text
    .replace(/[(),.:;!?]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}
