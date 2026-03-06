/**
 * Hook System — automatic pre/post hooks that run at each pipeline stage.
 *
 * Based on AiUnit71 Architecture Specification v1.0, Section 8.
 *
 * Hooks are lightweight validation and enrichment functions that:
 * - Inject brand/technical context into prompt payloads
 * - Validate prompts before expensive API calls
 * - Check artifacts after generation
 * - Update the MissionContext with costs and status
 *
 * Design: hooks are synchronous validators or async enrichers.
 * A hook can BLOCK execution by returning { passed: false, reason: "..." }.
 */

import type { MissionContext } from "./mission-context.js";
import { extractCreativeConstraints } from "./mission-context.js";
import { logger } from "../core/logger.js";

// ─── Hook Types ────────────────────────────────────────────────────────

export interface HookResult {
  passed: boolean;
  reason?: string;
  /** Enriched/modified payload (if hook mutated input) */
  enriched?: Record<string, unknown>;
  /** Warnings that don't block execution but should be logged */
  warnings?: string[];
}

export type HookName =
  | "context_enrichment"
  | "prompt_validation"
  | "visual_render_check"
  | "artifact_validation"
  | "mission_update"
  | "budget_check";

export interface HookContext {
  missionCtx: MissionContext;
  taskId?: string;
  payload?: Record<string, unknown>;
}

// ─── Hook Implementations ──────────────────────────────────────────────

/**
 * HOOK: context_enrichment
 * Runs BEFORE PromptMaster.
 * Injects brand colors, technical specs, style constraints, and client taste
 * into the prompt payload so the agent doesn't have to ask for them.
 */
export function contextEnrichmentHook(ctx: HookContext): HookResult {
  const { missionCtx, payload = {} } = ctx;
  const warnings: string[] = [];

  // Check required fields
  if (!missionCtx.brand.colors.primary) {
    warnings.push("Brand primary color not set");
  }

  if (!missionCtx.technical.required_formats.length) {
    warnings.push("No required formats defined in technical spec");
  }

  // Extract and inject creative constraints
  const constraints = extractCreativeConstraints(missionCtx);

  const enriched: Record<string, unknown> = {
    ...payload,
    _hook_injected: {
      brand_colors: missionCtx.brand.colors,
      brand_mood: missionCtx.brand.mood ?? [],
      anti_patterns: missionCtx.brand.anti_patterns ?? [],
      required_formats: missionCtx.technical.required_formats,
      style_constraints: missionCtx.style_constraints,
      client_taste: missionCtx.client_taste_profile,
      creative_constraints_summary: constraints,
    },
  };

  logger.debug(`[hook:context_enrichment] Injected brand/tech context into payload`);

  return { passed: true, enriched, warnings };
}

/**
 * HOOK: prompt_validation
 * Runs BEFORE Visual Prompter (after PromptMaster).
 * Validates the semantic JSON prompt for completeness and consistency.
 */
export function promptValidationHook(
  ctx: HookContext,
  semanticJson: SemanticPromptJson
): HookResult {
  const warnings: string[] = [];
  const failures: string[] = [];

  // Subject must be defined concretely
  if (!semanticJson.subject?.type) {
    failures.push("Subject type not defined");
  }

  // Lighting must be explicitly set
  if (!semanticJson.lighting?.primary) {
    warnings.push("Primary lighting not specified");
  }

  // Check for contradictions between style and constraints
  if (semanticJson.constraints?.no_text_in_image && semanticJson.style?.medium?.includes("typography")) {
    failures.push("Contradiction: no_text_in_image=true but medium includes typography");
  }

  // Aspect ratio must match technical spec
  const requiredFormats = ctx.missionCtx.technical.required_formats;
  if (requiredFormats.length && semanticJson.composition?.aspect_ratio) {
    const formatAspects = requiredFormats.map((f) => f.aspect);
    const promptAspect = semanticJson.composition.aspect_ratio;
    if (!formatAspects.includes(promptAspect)) {
      warnings.push(
        `Aspect ratio ${promptAspect} doesn't match required formats: ${formatAspects.join(", ")}`
      );
    }
  }

  // Brand colors should be present if required
  const brandColors = [
    ctx.missionCtx.brand.colors.primary,
    ctx.missionCtx.brand.colors.secondary,
    ctx.missionCtx.brand.colors.accent,
  ].filter(Boolean);

  if (brandColors.length && !semanticJson.style?.color_palette?.length) {
    warnings.push("Brand colors not included in color_palette");
  }

  const passed = failures.length === 0;

  if (!passed) {
    logger.warn(`[hook:prompt_validation] Failed: ${failures.join("; ")}`);
  }

  return {
    passed,
    reason: failures.length ? failures.join("; ") : undefined,
    warnings,
  };
}

/**
 * HOOK: visual_render_check
 * Runs BEFORE the actual API call to the image generation model.
 * Checks token count, syntax, and budget.
 */
export function visualRenderCheckHook(
  ctx: HookContext,
  renderedPrompt: RenderedPrompt
): HookResult {
  const warnings: string[] = [];
  const failures: string[] = [];

  // Token count check for diffusion models
  if (renderedPrompt.model_type === "diffusion") {
    const tokenEstimate = estimateTokens(renderedPrompt.prompt);
    if (tokenEstimate > 75) {
      failures.push(
        `Diffusion prompt exceeds 75-token CLIP limit: ~${tokenEstimate} tokens`
      );
    }

    // Negative prompt required for diffusion
    if (!renderedPrompt.negative_prompt) {
      warnings.push("Negative prompt not provided for diffusion model");
    }

    // Check weight values are in safe range
    const weightMatches = renderedPrompt.prompt.matchAll(/:\s*([\d.]+)\)/g);
    for (const match of weightMatches) {
      const weight = parseFloat(match[1]);
      if (weight < 0.5 || weight > 1.6) {
        warnings.push(`Weight ${weight} outside safe range (0.5-1.6)`);
      }
    }
  }

  // Budget check
  const remainingBudget =
    ctx.missionCtx.mission.budget.total -
    ctx.missionCtx.mission.budget.spent -
    ctx.missionCtx.mission.budget.reserved;

  if (renderedPrompt.estimated_cost && renderedPrompt.estimated_cost > remainingBudget) {
    failures.push(
      `Insufficient budget: need $${renderedPrompt.estimated_cost.toFixed(4)}, have $${remainingBudget.toFixed(4)}`
    );
  }

  const passed = failures.length === 0;

  if (!passed) {
    logger.warn(`[hook:visual_render_check] Failed: ${failures.join("; ")}`);
  }

  return { passed, reason: failures.length ? failures.join("; ") : undefined, warnings };
}

/**
 * HOOK: artifact_validation
 * Runs AFTER image generation.
 * Validates that the generated artifact meets spec requirements.
 */
export function artifactValidationHook(
  ctx: HookContext,
  artifact: GeneratedArtifact
): HookResult {
  const warnings: string[] = [];
  const failures: string[] = [];

  // Resolution check
  if (ctx.missionCtx.technical.required_formats.length) {
    const matchedFormat = ctx.missionCtx.technical.required_formats.find(
      (f) => f.name === artifact.format_name
    );

    if (matchedFormat) {
      if (artifact.width !== matchedFormat.w || artifact.height !== matchedFormat.h) {
        failures.push(
          `Resolution mismatch: got ${artifact.width}x${artifact.height}, expected ${matchedFormat.w}x${matchedFormat.h}`
        );
      }
    }
  }

  // File size check
  if (
    ctx.missionCtx.technical.max_file_size_kb &&
    artifact.file_size_kb &&
    artifact.file_size_kb > ctx.missionCtx.technical.max_file_size_kb
  ) {
    warnings.push(
      `File size ${artifact.file_size_kb}KB exceeds limit of ${ctx.missionCtx.technical.max_file_size_kb}KB`
    );
  }

  // No-text check (basic — would use vision model in production)
  if (ctx.missionCtx.style_constraints.no_text_in_image && artifact.detected_text) {
    failures.push("Text detected in image but no_text_in_image=true");
  }

  // Anti-slop check result
  if (artifact.anti_slop_score !== undefined && artifact.anti_slop_score < 0.6) {
    warnings.push(
      `Anti-slop score ${artifact.anti_slop_score.toFixed(2)} is below threshold (0.6)`
    );
  }

  const passed = failures.length === 0;

  return { passed, reason: failures.length ? failures.join("; ") : undefined, warnings };
}

/**
 * HOOK: budget_check
 * Runs before any expensive operation.
 * Checks if remaining budget is sufficient.
 */
export function budgetCheckHook(
  ctx: HookContext,
  estimatedCost: number
): HookResult {
  const { budget } = ctx.missionCtx.mission;
  const remaining = budget.total - budget.spent - budget.reserved;

  if (estimatedCost > remaining) {
    return {
      passed: false,
      reason: `Insufficient budget: need $${estimatedCost.toFixed(4)}, remaining $${remaining.toFixed(4)}`,
    };
  }

  if (remaining < estimatedCost * 2) {
    return {
      passed: true,
      warnings: [`Low budget warning: $${remaining.toFixed(4)} remaining after this operation`],
    };
  }

  return { passed: true };
}

/**
 * HOOK: mission_update
 * Runs after any task completion.
 * Updates MissionContext status, budget, and unblocks dependent tasks.
 */
export function missionUpdateHook(
  ctx: HookContext,
  update: MissionUpdatePayload
): HookResult & { updatedContext: MissionContext } {
  const missionCtx = { ...ctx.missionCtx };

  // Update budget
  if (update.actualCostUsd !== undefined) {
    missionCtx.mission = {
      ...missionCtx.mission,
      budget: {
        ...missionCtx.mission.budget,
        spent: missionCtx.mission.budget.spent + update.actualCostUsd,
      },
    };
  }

  // Update deliverable status
  if (update.deliverableId && update.deliverableStatus) {
    missionCtx.mission = {
      ...missionCtx.mission,
      deliverables: missionCtx.mission.deliverables.map((d) =>
        d.id === update.deliverableId
          ? { ...d, status: update.deliverableStatus!, artifactRef: update.artifactRef ?? d.artifactRef }
          : d
      ),
    };
  }

  // Update mission status if all deliverables approved
  const allApproved = missionCtx.mission.deliverables.every(
    (d) => d.status === "approved" || d.status === "delivered"
  );
  if (allApproved && missionCtx.mission.deliverables.length > 0) {
    missionCtx.mission = { ...missionCtx.mission, status: "approved" };
  }

  logger.debug(`[hook:mission_update] Budget spent: $${missionCtx.mission.budget.spent.toFixed(4)}`);

  return { passed: true, updatedContext: missionCtx };
}

// ─── Hook Runner ────────────────────────────────────────────────────────

/**
 * Runs a named hook and logs the result.
 * Returns { passed, reason } — callers must check `passed` before continuing.
 */
export function runHook(
  name: HookName,
  result: HookResult
): HookResult {
  if (!result.passed) {
    logger.warn(`[hook:${name}] BLOCKED: ${result.reason}`);
  } else {
    if (result.warnings?.length) {
      result.warnings.forEach((w) => logger.warn(`[hook:${name}] Warning: ${w}`));
    }
    logger.debug(`[hook:${name}] Passed`);
  }
  return result;
}

// ─── Supporting Types ────────────────────────────────────────────────────

/** Semantic JSON format produced by PromptMaster (model-agnostic) */
export interface SemanticPromptJson {
  subject?: {
    type?: string;
    material?: string;
    position?: string;
  };
  environment?: {
    background?: string;
    elements?: string;
    depth?: string;
  };
  lighting?: {
    primary?: string;
    secondary?: string;
    mood_contribution?: string;
  };
  composition?: {
    framing?: string;
    angle?: string;
    negative_space?: string;
    aspect_ratio?: string;
  };
  style?: {
    medium?: string;
    aesthetic?: string;
    color_palette?: string[];
    anti_slop?: string[];
  };
  constraints?: {
    no_text_in_image?: boolean;
    brand_colors_required?: boolean;
    safe_zone?: string;
  };
}

/** A rendered prompt ready for a specific model */
export interface RenderedPrompt {
  model_type: "diffusion" | "reasoning" | "midjourney";
  target_model: string;
  prompt: string;
  negative_prompt?: string;
  params?: Record<string, unknown>;
  estimated_cost?: number;
}

/** A generated artifact returned by the image generation API */
export interface GeneratedArtifact {
  id: string;
  format_name?: string;
  width?: number;
  height?: number;
  file_size_kb?: number;
  url?: string;
  local_path?: string;
  detected_text?: boolean;
  dominant_colors?: string[];
  /** Score from Anti-Slop Engine (0-1, higher = less sloppy) */
  anti_slop_score?: number;
}

/** Payload for mission_update hook */
export interface MissionUpdatePayload {
  actualCostUsd?: number;
  deliverableId?: string;
  deliverableStatus?: import("./mission-context.js").DeliverableStatus;
  artifactRef?: string;
  milestone?: string;
}

// ─── Token Estimation ────────────────────────────────────────────────────

/**
 * Rough estimate of token count for diffusion models.
 * CLIP tokenizer treats each word/punctuation as roughly 1 token.
 */
function estimateTokens(text: string): number {
  return text
    .replace(/[(),.:;!?]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}
