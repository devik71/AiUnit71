import { describe, it, expect, beforeEach } from "vitest";
import { CostRouter } from "../src/cost/router.js";

describe("CostRouter", () => {
  let router: CostRouter;

  beforeEach(() => {
    // Set up env for testing
    process.env.OPENROUTER_API_KEY = "test-key";
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.GOOGLE_AI_API_KEY = "test-key";
    router = new CostRouter();
  });

  it("selects the cheapest model for text generation", () => {
    const result = router.route({
      capabilities: ["text-generation"],
      inputTokens: 1000,
      outputTokens: 1000,
      minQuality: 50,
    });

    // Local models are free, should be selected first
    expect(result.estimate.estimatedCostUsd).toBe(0);
    expect(result.selected.provider.type).toBe("local");
  });

  it("prefers local models when preferLocal is true", () => {
    const result = router.route({
      capabilities: ["text-generation"],
      inputTokens: 1000,
      outputTokens: 1000,
      preferLocal: true,
      minQuality: 50,
    });

    expect(result.selected.provider.type).toBe("local");
  });

  it("selects cloud model when quality threshold exceeds local capabilities", () => {
    const result = router.route({
      capabilities: ["text-generation"],
      inputTokens: 1000,
      outputTokens: 1000,
      minQuality: 85,
    });

    // No local model has quality >= 85, should select cloud
    expect(result.selected.provider.type).toBe("cloud");
    expect(result.selected.qualityScore).toBeGreaterThanOrEqual(85);
  });

  it("respects maxCostUsd constraint", () => {
    const result = router.route({
      capabilities: ["text-generation"],
      inputTokens: 10000,
      outputTokens: 10000,
      minQuality: 50,
      maxCostUsd: 0.001,
    });

    expect(result.estimate.estimatedCostUsd).toBeLessThanOrEqual(0.001);
  });

  it("throws when no model matches capabilities", () => {
    expect(() =>
      router.route({
        capabilities: ["nonexistent-capability" as any],
        inputTokens: 1000,
        outputTokens: 1000,
      })
    ).toThrow("No model found");
  });

  it("provides alternatives in the estimate", () => {
    const result = router.route({
      capabilities: ["text-generation"],
      inputTokens: 1000,
      outputTokens: 1000,
      minQuality: 50,
    });

    expect(result.estimate.alternatives.length).toBeGreaterThan(0);
  });

  it("tracks total session cost", () => {
    expect(router.getTotalSpent()).toBe(0);
    router.recordCost(0.005);
    router.recordCost(0.003);
    expect(router.getTotalSpent()).toBeCloseTo(0.008);
  });

  it("forces a specific model when requested", () => {
    const result = router.route({
      capabilities: ["text-generation"],
      inputTokens: 1000,
      outputTokens: 1000,
      forceModel: "anthropic/claude-sonnet-4",
    });

    expect(result.selected.model).toBe("anthropic/claude-sonnet-4");
  });

  it("routes image generation to image models", () => {
    const result = router.route({
      capabilities: ["image-generation"],
      inputTokens: 1,
      outputTokens: 0,
      minQuality: 50,
    });

    expect(result.selected.capabilities).toContain("image-generation");
  });

  it("routes video generation to video models", () => {
    const result = router.route({
      capabilities: ["video-generation"],
      inputTokens: 1,
      outputTokens: 0,
      minQuality: 50,
    });

    expect(result.selected.capabilities).toContain("video-generation");
  });
});
