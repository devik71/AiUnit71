import type { ModelOption, ModelCapability, CostEstimate } from "../core/types.js";
import { MODEL_OPTIONS } from "./pricing-table.js";
import { logger } from "../core/logger.js";

export interface RouteRequest {
  /** Required capabilities for this operation */
  capabilities: ModelCapability[];
  /** Minimum acceptable quality score (0-100) */
  minQuality?: number;
  /** Maximum acceptable cost in USD */
  maxCostUsd?: number;
  /** Estimated input tokens */
  inputTokens: number;
  /** Estimated output tokens */
  outputTokens: number;
  /** Prefer local models when possible */
  preferLocal?: boolean;
  /** Force a specific provider */
  forceProvider?: string;
  /** Force a specific model */
  forceModel?: string;
}

export interface RouteResult {
  selected: ModelOption;
  estimate: CostEstimate;
  reasoning: string;
}

/**
 * CostRouter — selects the cheapest model that meets quality + capability requirements.
 *
 * Decision hierarchy:
 * 1. Filter by required capabilities
 * 2. Filter by minimum quality threshold
 * 3. Filter by available API keys
 * 4. Sort by total cost (ascending)
 * 5. Prefer local models if costs are equal
 * 6. Return cheapest option with full cost breakdown
 */
export class CostRouter {
  private models: ModelOption[];
  private totalSpentUsd = 0;

  constructor(customModels?: ModelOption[]) {
    this.models = customModels || MODEL_OPTIONS;
  }

  /** Check if a provider's API key is available */
  private isProviderAvailable(model: ModelOption): boolean {
    if (model.provider.type === "local") return true;
    if (!model.provider.apiKeyEnv) return true;
    return !!process.env[model.provider.apiKeyEnv];
  }

  /** Calculate total cost for a request */
  private calculateCost(
    model: ModelOption,
    inputTokens: number,
    outputTokens: number
  ): number {
    return (
      (inputTokens / 1000) * model.inputCostPer1k +
      (outputTokens / 1000) * model.outputCostPer1k
    );
  }

  /**
   * Route a request to the optimal model.
   * This is the core function called before EVERY operation.
   */
  route(request: RouteRequest): RouteResult {
    const minQuality = request.minQuality ?? 50;

    // Handle forced model/provider
    if (request.forceModel) {
      const forced = this.models.find((m) => m.model === request.forceModel);
      if (forced) {
        const cost = this.calculateCost(forced, request.inputTokens, request.outputTokens);
        return {
          selected: forced,
          estimate: this.buildEstimate(forced, request.inputTokens, request.outputTokens, cost, []),
          reasoning: `Forced model: ${request.forceModel}`,
        };
      }
    }

    // Step 1: Filter by capabilities
    let candidates = this.models.filter((m) =>
      request.capabilities.every((cap) => m.capabilities.includes(cap))
    );

    if (candidates.length === 0) {
      throw new Error(
        `No model found with capabilities: ${request.capabilities.join(", ")}`
      );
    }

    // Step 2: Filter by quality
    candidates = candidates.filter((m) => m.qualityScore >= minQuality);
    if (candidates.length === 0) {
      throw new Error(
        `No model meets quality threshold ${minQuality} for capabilities: ${request.capabilities.join(", ")}`
      );
    }

    // Step 3: Filter by available API keys
    candidates = candidates.filter((m) => this.isProviderAvailable(m));
    if (candidates.length === 0) {
      throw new Error(
        "No model available — check that API keys are configured in .env"
      );
    }

    // Step 4: Filter by max cost
    if (request.maxCostUsd !== undefined) {
      candidates = candidates.filter(
        (m) =>
          this.calculateCost(m, request.inputTokens, request.outputTokens) <=
          request.maxCostUsd!
      );
    }

    // Step 5: Sort by cost, then prefer local
    candidates.sort((a, b) => {
      const costA = this.calculateCost(a, request.inputTokens, request.outputTokens);
      const costB = this.calculateCost(b, request.inputTokens, request.outputTokens);
      if (costA !== costB) return costA - costB;
      // Prefer local when cost is equal
      if (a.provider.type === "local" && b.provider.type !== "local") return -1;
      if (b.provider.type === "local" && a.provider.type !== "local") return 1;
      // Prefer higher quality when cost is equal
      return b.qualityScore - a.qualityScore;
    });

    // Apply local preference: if preferLocal and a local model is within 20% quality of best cloud
    if (request.preferLocal) {
      const localCandidate = candidates.find((m) => m.provider.type === "local");
      if (localCandidate && localCandidate.qualityScore >= minQuality) {
        const bestCloud = candidates.find((m) => m.provider.type === "cloud");
        if (
          !bestCloud ||
          localCandidate.qualityScore >= bestCloud.qualityScore * 0.8
        ) {
          // Move local candidate to front
          candidates = [
            localCandidate,
            ...candidates.filter((m) => m !== localCandidate),
          ];
        }
      }
    }

    const selected = candidates[0];
    const selectedCost = this.calculateCost(
      selected,
      request.inputTokens,
      request.outputTokens
    );

    // Build alternatives list (top 5)
    const alternatives = candidates.slice(1, 6).map((m) => ({
      model: m.model,
      provider: m.provider.name,
      costUsd: this.calculateCost(m, request.inputTokens, request.outputTokens),
      qualityScore: m.qualityScore,
    }));

    const estimate = this.buildEstimate(
      selected,
      request.inputTokens,
      request.outputTokens,
      selectedCost,
      alternatives
    );

    const reasoning =
      selected.provider.type === "local"
        ? `Free via local ${selected.model}`
        : `${request.inputTokens} input / ${request.outputTokens} output tokens → $${selectedCost.toFixed(6)} on ${selected.provider.name} via ${selected.model}`;

    logger.info(`Cost Router: ${reasoning}`, {
      costUsd: selectedCost,
      model: selected.model,
      provider: selected.provider.id,
    });

    return { selected, estimate, reasoning };
  }

  private buildEstimate(
    model: ModelOption,
    inputTokens: number,
    outputTokens: number,
    cost: number,
    alternatives: CostEstimate["alternatives"]
  ): CostEstimate {
    return {
      inputTokens,
      outputTokens,
      estimatedCostUsd: cost,
      selectedModel: model.model,
      selectedProvider: model.provider.name,
      alternatives,
    };
  }

  /** Record actual cost after an operation completes */
  recordCost(costUsd: number): void {
    this.totalSpentUsd += costUsd;
  }

  /** Get total session cost */
  getTotalSpent(): number {
    return this.totalSpentUsd;
  }

  /** Get a human-readable cost summary */
  getCostSummary(): string {
    return `Total session cost: $${this.totalSpentUsd.toFixed(6)}`;
  }
}
