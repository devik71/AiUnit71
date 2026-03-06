/**
 * Anti-Slop Engine — detects and prevents "AI look" in generated content.
 *
 * Based on AiUnit71 Architecture Specification v1.0, Section 16.
 *
 * The Anti-Slop Engine works in three modes:
 * 1. PREVENTION — injects anti-slop tokens into prompts before generation
 * 2. DETECTION — analyzes generated artifacts for AI markers (heuristic)
 * 3. CORRECTION — suggests post-processing corrections
 *
 * Target metric: "Would a design professional spot this as AI-generated?"
 * Score 0-1. Score < 0.6 = artifact fails quality gate.
 */

import { logger } from "../core/logger.js";
import type { SemanticPromptJson } from "./hook-system.js";

// ─── AI Slop Markers ───────────────────────────────────────────────────

/** Known AI "slop" markers that make images look artificial */
const SLOP_MARKERS = {
  /** Visual artifacts detectable from metadata or filename patterns */
  visual: [
    "oversaturation",
    "plastic_skin",
    "unnatural_bokeh",
    "melting_artifacts",
    "excessive_symmetry",
    "perfect_teeth",
    "unrealistic_lighting",
    "floating_objects",
    "disconnected_shadows",
    "perfect_skin",
    "generic_stock_pose",
    "uncanny_valley_face",
    "color_fringing",
    "over_sharpening",
  ],

  /** Prompt words/phrases that commonly trigger slop */
  prompt_triggers: [
    "beautiful",
    "stunning",
    "gorgeous",
    "amazing",
    "incredible",
    "ultra realistic",
    "hyperrealistic",
    "8k uhd",
    "artstation",
    "trending",
    "award winning",
    "professional photo",
    "perfect lighting",
  ],

  /** Negative tokens to inject that combat slop */
  negative_injections: [
    "oversaturated",
    "plastic skin",
    "perfect skin",
    "stock photo",
    "unnatural lighting",
    "overprocessed",
    "airbrushed",
    "generic",
    "cliché",
    "trendy composition",
    "centered portrait",
  ],
};

/** Anti-slop tokens to inject into prompts (prevent mode) */
const ANTI_SLOP_INJECTIONS = {
  photorealistic: [
    "subtle film grain",
    "natural skin texture with pores",
    "slight color cast",
    "not oversaturated",
    "micro-imperfections in materials",
    "slight chromatic aberration",
    "natural depth of field",
    "real-world imperfections",
  ],
  product: [
    "natural reflections",
    "micro surface texture",
    "slight dust particles",
    "realistic material response",
    "subtle environment reflection",
  ],
  illustration: [
    "hand-crafted feel",
    "intentional line variation",
    "non-uniform texture",
    "organic imperfection",
  ],
  general: [
    "non-centered composition",
    "asymmetric arrangement",
    "natural color variation",
  ],
};

// ─── Anti-Slop Engine ──────────────────────────────────────────────────

export interface AntiSlopAnalysis {
  /** Score 0-1. Higher = cleaner (less sloppy). < 0.6 = fails QC */
  score: number;
  /** Detected slop markers */
  detected_markers: string[];
  /** Suggested corrections */
  corrections: AntiSlopCorrection[];
  /** Passed QC? */
  passed: boolean;
  /** Human-readable verdict */
  verdict: string;
}

export interface AntiSlopCorrection {
  type: "post_processing" | "regenerate" | "prompt_adjustment";
  description: string;
  prompt_token?: string;
}

export interface EnrichedPrompt {
  /** Modified semantic JSON with anti-slop tokens injected */
  semanticJson: SemanticPromptJson;
  /** Tokens added */
  injected: string[];
  /** Negative tokens added */
  negatives_injected: string[];
}

export class AntiSlopEngine {
  private static _instance: AntiSlopEngine;
  private readonly threshold = 0.6;

  static get instance(): AntiSlopEngine {
    if (!AntiSlopEngine._instance) {
      AntiSlopEngine._instance = new AntiSlopEngine();
    }
    return AntiSlopEngine._instance;
  }

  // ─── Prevention ─────────────────────────────────────────────────────

  /**
   * Enrich a semantic JSON prompt with anti-slop tokens.
   * Call this BEFORE sending to Visual Prompter.
   *
   * Injects appropriate anti-slop tokens based on the content type.
   */
  injectAntiSlop(semanticJson: SemanticPromptJson): EnrichedPrompt {
    const enriched = JSON.parse(JSON.stringify(semanticJson)) as SemanticPromptJson;
    const injected: string[] = [];
    const negatives_injected: string[] = [];

    // Determine content type for injection selection
    const isPhotorealistic = this.isPhotorealisticContent(semanticJson);
    const isProduct = this.isProductContent(semanticJson);
    const isIllustration = this.isIllustrationContent(semanticJson);

    // Select injection tokens
    const injectionTokens: string[] = [...ANTI_SLOP_INJECTIONS.general];

    if (isPhotorealistic) {
      injectionTokens.push(...ANTI_SLOP_INJECTIONS.photorealistic);
    }
    if (isProduct) {
      injectionTokens.push(...ANTI_SLOP_INJECTIONS.product);
    }
    if (isIllustration) {
      injectionTokens.push(...ANTI_SLOP_INJECTIONS.illustration);
    }

    // Inject into style.anti_slop
    if (!enriched.style) enriched.style = {};
    const existingAntiSlop = enriched.style.anti_slop ?? [];
    const newTokens = injectionTokens.filter((t) => !existingAntiSlop.includes(t));

    enriched.style.anti_slop = [...existingAntiSlop, ...newTokens];
    injected.push(...newTokens);

    // Filter prompt triggers from existing text fields
    const cleanedAesthetic = this.filterSlopTriggers(enriched.style.aesthetic ?? "");
    if (cleanedAesthetic !== enriched.style.aesthetic) {
      enriched.style.aesthetic = cleanedAesthetic;
    }

    // Inject standard negatives
    negatives_injected.push(...SLOP_MARKERS.negative_injections);

    logger.debug(`[AntiSlop] Injected ${injected.length} anti-slop tokens`);

    return { semanticJson: enriched, injected, negatives_injected };
  }

  // ─── Detection ──────────────────────────────────────────────────────

  /**
   * Analyze a generated artifact for AI slop markers.
   *
   * In production, this would use a vision model to actually analyze the image.
   * Currently uses heuristic analysis of metadata and prompt.
   *
   * @param artifactMetadata - Metadata about the generated artifact
   * @param originalPrompt - The prompt used to generate it
   */
  analyzeArtifact(
    artifactMetadata: ArtifactMetadata,
    originalPrompt?: string
  ): AntiSlopAnalysis {
    const detected: string[] = [];
    const corrections: AntiSlopCorrection[] = [];
    let penaltyScore = 0;

    // Check for known slop triggers in the prompt
    if (originalPrompt) {
      const promptLower = originalPrompt.toLowerCase();
      for (const trigger of SLOP_MARKERS.prompt_triggers) {
        if (promptLower.includes(trigger)) {
          detected.push(`prompt_trigger:${trigger}`);
          penaltyScore += 0.05;
        }
      }
    }

    // Check for visual artifacts from metadata
    if (artifactMetadata.detected_text && !artifactMetadata.text_expected) {
      detected.push("unwanted_text");
      penaltyScore += 0.5; // Critical: text in no-text image always fails QC
      corrections.push({
        type: "regenerate",
        description: "Text detected in image where none was expected",
      });
    }

    if (artifactMetadata.is_centered_composition) {
      detected.push("centered_composition");
      penaltyScore += 0.1;
      corrections.push({
        type: "prompt_adjustment",
        description: "Off-center the composition",
        prompt_token: "asymmetric composition, rule of thirds",
      });
    }

    if (artifactMetadata.saturation && artifactMetadata.saturation > 0.85) {
      detected.push("oversaturation");
      penaltyScore += 0.15;
      corrections.push({
        type: "post_processing",
        description: "Reduce saturation by 20-30%",
      });
    }

    if (artifactMetadata.uniformity && artifactMetadata.uniformity > 0.9) {
      detected.push("excessive_uniformity");
      penaltyScore += 0.1;
      corrections.push({
        type: "prompt_adjustment",
        description: "Add micro-imperfections and natural variation",
        prompt_token: "subtle film grain, micro-imperfections",
      });
    }

    // Additional heuristic checks
    if (artifactMetadata.resolution_mismatch) {
      detected.push("resolution_mismatch");
      penaltyScore += 0.2;
    }

    // Calculate final score
    const score = Math.max(0, Math.min(1, 1 - penaltyScore));
    const passed = score >= this.threshold;

    const verdict = passed
      ? score > 0.85
        ? "Clean — professional quality"
        : "Acceptable — minor AI markers"
      : score > 0.4
      ? "Needs correction — visible AI artifacts"
      : "Failed — strong AI look detected";

    logger.debug(`[AntiSlop] Score: ${score.toFixed(2)} | Markers: ${detected.length} | ${verdict}`);

    return { score, detected_markers: detected, corrections, passed, verdict };
  }

  // ─── Prompt Screening ───────────────────────────────────────────────

  /**
   * Screen a raw text prompt for slop triggers before it reaches VisualPrompter.
   * Returns a cleaned prompt with trigger words removed/replaced.
   */
  screenPrompt(prompt: string): { cleaned: string; removed: string[] } {
    let cleaned = prompt;
    const removed: string[] = [];

    for (const trigger of SLOP_MARKERS.prompt_triggers) {
      const regex = new RegExp(`\\b${trigger}\\b`, "gi");
      if (regex.test(cleaned)) {
        cleaned = cleaned.replace(regex, "").replace(/\s{2,}/g, " ").trim();
        removed.push(trigger);
      }
    }

    if (removed.length > 0) {
      logger.debug(`[AntiSlop] Removed ${removed.length} slop triggers: ${removed.join(", ")}`);
    }

    return { cleaned, removed };
  }

  /**
   * Get the list of negative tokens to append to diffusion model prompts.
   */
  getNegativeTokens(): string[] {
    return [...SLOP_MARKERS.negative_injections];
  }

  // ─── Private Helpers ────────────────────────────────────────────────

  private isPhotorealisticContent(s: SemanticPromptJson): boolean {
    const medium = (s.style?.medium ?? "").toLowerCase();
    return medium.includes("photo") || medium.includes("photorealistic") || medium.includes("realistic");
  }

  private isProductContent(s: SemanticPromptJson): boolean {
    const subject = (s.subject?.type ?? "").toLowerCase();
    return (
      subject.includes("product") ||
      subject.includes("device") ||
      subject.includes("phone") ||
      subject.includes("bottle") ||
      subject.includes("package")
    );
  }

  private isIllustrationContent(s: SemanticPromptJson): boolean {
    const medium = (s.style?.medium ?? "").toLowerCase();
    return (
      medium.includes("illustration") ||
      medium.includes("vector") ||
      medium.includes("drawing") ||
      medium.includes("cartoon")
    );
  }

  private filterSlopTriggers(text: string): string {
    let result = text;
    for (const trigger of SLOP_MARKERS.prompt_triggers) {
      result = result.replace(new RegExp(`\\b${trigger}\\b`, "gi"), "").trim();
    }
    return result.replace(/\s{2,}/g, " ").trim();
  }
}

// ─── Artifact Metadata ─────────────────────────────────────────────────

export interface ArtifactMetadata {
  /** Detected text content in image */
  detected_text?: boolean;
  /** Was text expected (e.g. for text-render tasks) */
  text_expected?: boolean;
  /** Is composition centered (heuristic) */
  is_centered_composition?: boolean;
  /** Saturation level 0-1 */
  saturation?: number;
  /** Color/texture uniformity 0-1 (1 = perfectly uniform = suspicious) */
  uniformity?: number;
  /** Resolution doesn't match required */
  resolution_mismatch?: boolean;
  /** Raw EXIF or generation metadata */
  raw_metadata?: Record<string, unknown>;
}
