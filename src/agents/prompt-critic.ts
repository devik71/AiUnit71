/**
 * PromptCriticAgent — validates semantic JSON prompts before they reach
 * the Visual Prompter. Acts as a quality gate in the creative pipeline.
 *
 * Based on AiUnit71 Architecture Specification v1.0, Section 9.
 *
 * Lifecycle: Standard tier (Ollama local model). Persistent across tasks —
 * does not annihilate, because validation experience compounds.
 *
 * Pipeline position:
 *   PromptMaster → [PromptCritic] → Visual Prompter → API call
 *
 * If confidence < 0.8, the prompt is sent back to PromptMaster for refinement.
 */

import { LlmClient } from "../llm/llm-client.js";
import type { ChatMessage } from "../llm/llm-client.js";
import type { AgentConfig, CostRecord } from "../core/types.js";
import type { CostRouter } from "../cost/router.js";
import type { MemoryStore } from "../memory/memory-store.js";
import type { SemanticPromptJson } from "../creative/hook-system.js";
import { promptValidationHook } from "../creative/hook-system.js";
import type { MissionContext } from "../creative/mission-context.js";
import { eventBus } from "../core/event-bus.js";
import { logger } from "../core/logger.js";

// ─── Critique Result ────────────────────────────────────────────────────

export interface CritiqueResult {
  /** Overall confidence score 0-1 (< 0.8 triggers refinement) */
  confidence: number;
  /** Did the prompt pass validation? */
  passed: boolean;
  /** Specific issues found */
  issues: CritiqueIssue[];
  /** Suggested improvements */
  suggestions: string[];
  /** Summary of the critique */
  summary: string;
  /** Model used */
  model?: string;
  /** Fallback status if LLM was unavailable */
  status: "validated" | "validated_rule_only" | "fallback";
}

export interface CritiqueIssue {
  severity: "critical" | "major" | "minor";
  field: string;
  description: string;
  fix?: string;
}

// ─── Prompt Critic Agent ────────────────────────────────────────────────

export class PromptCriticAgent {
  private llm: LlmClient;
  private costRouter: CostRouter;
  private memory: MemoryStore;

  static readonly CONFIDENCE_THRESHOLD = 0.8;

  static readonly AGENT_CONFIG: AgentConfig = {
    id: "prompt-critic",
    name: "PromptCritic",
    role: "prompt-critic",
    systemPrompt: `You are PromptCritic — AiUnit71's prompt quality validator.

Your job is to review semantic JSON prompts before they go to image generation.
You validate for:
1. Completeness — are all required fields present?
2. Specificity — is the subject clearly defined?
3. Internal consistency — no contradictions between elements
4. Brand alignment — colors/mood match what was requested
5. Technical feasibility — is this achievable with the target model?

Return valid JSON:
{
  "confidence": 0.0-1.0,
  "passed": true|false,
  "issues": [
    {
      "severity": "critical|major|minor",
      "field": "the field with the issue",
      "description": "what's wrong",
      "fix": "how to fix it"
    }
  ],
  "suggestions": ["suggestion 1", "suggestion 2"],
  "summary": "One sentence overall assessment"
}

IMPORTANT: confidence < 0.8 = prompt goes back for refinement.
Be strict but fair. A prompt with no subject definition should get confidence 0.2.
A prompt with only minor issues should get 0.85+.`,
    capabilities: ["text-generation", "analysis"],
    canTeleport: false,
  };

  constructor(costRouter: CostRouter, memory: MemoryStore) {
    this.llm = new LlmClient();
    this.costRouter = costRouter;
    this.memory = memory;
  }

  /**
   * Validate a semantic JSON prompt.
   *
   * Returns a CritiqueResult with confidence score.
   * If confidence < CONFIDENCE_THRESHOLD, the prompt should be refined.
   */
  async critique(
    semanticJson: SemanticPromptJson,
    missionCtx: MissionContext,
    taskId?: string
  ): Promise<CritiqueResult> {
    // Run rule-based hooks first (free, instant)
    const hookResult = promptValidationHook(
      { missionCtx, taskId },
      semanticJson
    );

    // If hook blocked, return immediately without LLM call
    if (!hookResult.passed) {
      return {
        confidence: 0.0,
        passed: false,
        issues: [
          {
            severity: "critical",
            field: "hook_validation",
            description: hookResult.reason ?? "Hook validation failed",
          },
        ],
        suggestions: [],
        summary: `Hook validation blocked: ${hookResult.reason}`,
        status: "validated_rule_only",
      };
    }

    // LLM-based validation
    const route = this.costRouter.route({
      capabilities: ["text-generation"],
      inputTokens: 800,
      outputTokens: 1000,
      preferLocal: true,
      minQuality: 30, // Standard tier — local model is fine
    });

    const messages: ChatMessage[] = [
      { role: "system", content: PromptCriticAgent.AGENT_CONFIG.systemPrompt },
      {
        role: "user",
        content: [
          "Validate this semantic prompt JSON:",
          "",
          "```json",
          JSON.stringify(semanticJson, null, 2),
          "```",
          "",
          "Mission brand context:",
          `- Brand: ${missionCtx.brand.name}`,
          `- Colors: ${JSON.stringify(missionCtx.brand.colors)}`,
          `- Mood: ${missionCtx.brand.mood?.join(", ") ?? "not set"}`,
          `- Anti-patterns to avoid: ${missionCtx.brand.anti_patterns?.join(", ") ?? "none"}`,
          `- Style constraints: ${JSON.stringify(missionCtx.style_constraints)}`,
          "",
          hookResult.warnings?.length
            ? `Pre-validation warnings: ${hookResult.warnings.join("; ")}`
            : "",
          "",
          "Return ONLY valid JSON, no markdown fences.",
        ].join("\n"),
      },
    ];

    try {
      const response = await this.llm.chat({
        model: route.selected.model,
        messages,
        temperature: 0.2, // Low — we want consistent, deterministic validation
        maxTokens: 1024,
      });

      // Record cost
      const costRecord: CostRecord = {
        taskId: taskId ?? "prompt-critic",
        model: response.model,
        provider: route.selected.provider.name,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        costUsd: route.estimate.estimatedCostUsd,
        timestamp: new Date(),
      };
      eventBus.dispatch({ type: "cost:recorded", record: costRecord });

      // Parse result
      let parsed: Partial<CritiqueResult>;
      try {
        parsed = JSON.parse(response.content);
      } catch {
        // Non-JSON response — treat as minor validation issue
        parsed = {
          confidence: 0.6,
          passed: false,
          issues: [{ severity: "minor", field: "llm_response", description: "LLM returned non-JSON" }],
          suggestions: [],
          summary: response.content.slice(0, 200),
        };
      }

      const result: CritiqueResult = {
        confidence: parsed.confidence ?? 0.5,
        passed: (parsed.confidence ?? 0.5) >= PromptCriticAgent.CONFIDENCE_THRESHOLD,
        issues: parsed.issues ?? [],
        suggestions: parsed.suggestions ?? [],
        summary: parsed.summary ?? "",
        model: response.model,
        status: "validated",
      };

      // Log to memory
      this.memory.add("prompt-critic", {
        roomId: "prompt-critic",
        taskId,
        agentId: "prompt-critic",
        type: "experience",
        content: `Critique: confidence=${result.confidence.toFixed(2)}, passed=${result.passed}. ${result.summary}`,
        metadata: { confidence: result.confidence, passed: result.passed, issueCount: result.issues.length },
      });

      if (!result.passed) {
        logger.warn(`[PromptCritic] Confidence ${result.confidence.toFixed(2)} < ${PromptCriticAgent.CONFIDENCE_THRESHOLD} — prompt needs refinement`);
      } else {
        logger.debug(`[PromptCritic] Passed with confidence ${result.confidence.toFixed(2)}`);
      }

      return result;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.warn(`[PromptCritic] LLM unavailable, using rule-only validation: ${errMsg}`);

      // Graceful fallback — use hook warnings to estimate confidence
      const hookWarningCount = hookResult.warnings?.length ?? 0;
      const confidence = hookWarningCount === 0 ? 0.75 : Math.max(0.4, 0.75 - hookWarningCount * 0.1);

      return {
        confidence,
        passed: confidence >= PromptCriticAgent.CONFIDENCE_THRESHOLD,
        issues: hookResult.warnings?.map((w) => ({
          severity: "minor" as const,
          field: "hook_warning",
          description: w,
        })) ?? [],
        suggestions: [],
        summary: "Rule-based validation only (LLM unavailable)",
        status: "fallback",
      };
    }
  }
}
