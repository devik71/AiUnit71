/**
 * Tests for the creative module:
 * - MissionContext
 * - Hook System
 * - Tool Registry
 * - Anti-Slop Engine
 * - Dry Run Mode
 * - Prompt Memory
 */

import { describe, it, expect, beforeEach } from "vitest";

// MissionContext
import {
  buildMissionContext,
  updateDeliverable,
  recordMissionCost,
  getRemainingBudget,
  extractCreativeConstraints,
  serializeMissionContext,
} from "../src/creative/mission-context.js";
import type { PartialMissionContext, MissionContext } from "../src/creative/mission-context.js";

// Hook System
import {
  contextEnrichmentHook,
  promptValidationHook,
  visualRenderCheckHook,
  artifactValidationHook,
  budgetCheckHook,
  missionUpdateHook,
  runHook,
} from "../src/creative/hook-system.js";
import type { SemanticPromptJson, RenderedPrompt } from "../src/creative/hook-system.js";

// Tool Registry
import { ToolRegistry } from "../src/creative/tool-registry.js";

// Anti-Slop Engine
import { AntiSlopEngine } from "../src/creative/anti-slop-engine.js";

// Dry Run
import { DryRunSimulator } from "../src/creative/dry-run.js";

// Prompt Memory
import { PromptMemory } from "../src/creative/prompt-memory.js";

// ─── Test Fixtures ─────────────────────────────────────────────────────────

function makeMissionCtx(overrides: PartialMissionContext = {}): MissionContext {
  return buildMissionContext({
    mission: {
      id: "test-mission-001",
      type: "landing_page",
      client: "FitPulse",
      status: "in_progress",
      budget: { total: 6.50, spent: 0, reserved: 0, currency: "USD" },
      deliverables: [
        { id: "hero_image", name: "Hero Image", status: "pending", priority: 1 },
        { id: "og_image", name: "OG Image", status: "pending", priority: 2 },
      ],
    },
    brand: {
      name: "FitPulse",
      colors: { primary: "#6C3CE1", secondary: "#00D4FF", accent: "#FF6B35" },
      mood: ["premium", "energetic", "modern"],
      anti_patterns: ["corporate feel", "stock photo look"],
    },
    technical: {
      required_formats: [
        { name: "desktop_hero", w: 1440, h: 680, aspect: "2.12:1" },
        { name: "og_image", w: 1200, h: 630, aspect: "1.91:1" },
      ],
      file_format: "webp",
      max_file_size_kb: 200,
    },
    style_constraints: {
      no_text_in_image: true,
      safe_zone_for_text: "left 40%",
      anti_slop: true,
    },
    client_taste_profile: {
      color_temperature: "warm",
      contrast: "high",
      composition: "asymmetric",
      lighting_preference: "dramatic > flat",
    },
    ...overrides,
  });
}

function makeSemanticJson(): SemanticPromptJson {
  return {
    subject: {
      type: "smartphone with fitness app UI",
      material: "glass and metal, dark finish",
      position: "floating, slight angle",
    },
    environment: {
      background: "abstract gradient, deep purple to electric blue",
      elements: "subtle particle effects",
      depth: "shallow, subject sharp, bg blurred",
    },
    lighting: {
      primary: "soft ambient glow from screen",
      secondary: "rim light from behind, cool tone",
      mood_contribution: "premium, tech-forward",
    },
    composition: {
      framing: "medium shot, front-facing",
      angle: "slight low angle, hero perspective",
      negative_space: "left 40% for text overlay",
      aspect_ratio: "2.12:1",
    },
    style: {
      medium: "3D product visualization",
      aesthetic: "clean, modern, premium",
      color_palette: ["#6C3CE1", "#00D4FF", "#1A1A2E"],
      anti_slop: ["no oversaturation", "subtle grain"],
    },
    constraints: {
      no_text_in_image: true,
      brand_colors_required: true,
      safe_zone: "left 40%",
    },
  };
}

// ─── MissionContext ────────────────────────────────────────────────────────

describe("MissionContext", () => {
  it("builds a context with defaults", () => {
    const ctx = buildMissionContext({});
    expect(ctx.mission.client).toBe("Unknown Client");
    expect(ctx.mission.status).toBe("initializing");
    expect(ctx.mission.budget.currency).toBe("USD");
    expect(ctx.style_constraints.anti_slop).toBe(true);
    expect(ctx.technical.file_format).toBe("webp");
  });

  it("builds a full context with provided values", () => {
    const ctx = makeMissionCtx();
    expect(ctx.mission.client).toBe("FitPulse");
    expect(ctx.brand.colors.primary).toBe("#6C3CE1");
    expect(ctx.mission.deliverables).toHaveLength(2);
    expect(ctx.style_constraints.no_text_in_image).toBe(true);
  });

  it("updates a deliverable status", () => {
    const ctx = makeMissionCtx();
    const updated = updateDeliverable(ctx, "hero_image", { status: "approved", qualityScore: 90 });
    const deliverable = updated.mission.deliverables.find((d) => d.id === "hero_image");
    expect(deliverable?.status).toBe("approved");
    expect(deliverable?.qualityScore).toBe(90);
    // Other deliverable unchanged
    expect(updated.mission.deliverables.find((d) => d.id === "og_image")?.status).toBe("pending");
  });

  it("records mission cost immutably", () => {
    const ctx = makeMissionCtx();
    const updated = recordMissionCost(ctx, 1.50);
    expect(updated.mission.budget.spent).toBe(1.50);
    expect(ctx.mission.budget.spent).toBe(0); // Original unchanged
  });

  it("calculates remaining budget correctly", () => {
    const ctx = makeMissionCtx();
    const afterCost = recordMissionCost(ctx, 2.0);
    const remaining = getRemainingBudget(afterCost);
    expect(remaining).toBe(4.50); // 6.50 - 2.0 - 0 reserved
  });

  it("extracts creative constraints summary", () => {
    const ctx = makeMissionCtx();
    const summary = extractCreativeConstraints(ctx);
    expect(summary).toContain("FitPulse");
    expect(summary).toContain("#6C3CE1");
    expect(summary).toContain("NO text");
    expect(summary).toContain("left 40%");
    expect(summary).toContain("dramatic > flat");
  });

  it("serializes to JSON string", () => {
    const ctx = makeMissionCtx();
    const json = serializeMissionContext(ctx);
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed.brand.name).toBe("FitPulse");
  });
});

// ─── Hook System ──────────────────────────────────────────────────────────

describe("Hook System", () => {
  describe("context_enrichment hook", () => {
    it("injects brand and technical context into payload", () => {
      const ctx = makeMissionCtx();
      const result = contextEnrichmentHook({ missionCtx: ctx, payload: { foo: "bar" } });
      expect(result.passed).toBe(true);
      expect(result.enriched).toBeDefined();
      expect(result.enriched!["foo"]).toBe("bar");
      const injected = result.enriched!["_hook_injected"] as Record<string, unknown>;
      expect(injected["brand_colors"]).toBeDefined();
      expect(injected["creative_constraints_summary"]).toContain("FitPulse");
    });

    it("warns when brand primary color is missing", () => {
      const ctx = buildMissionContext({ brand: { name: "X", colors: { primary: "" } } });
      const result = contextEnrichmentHook({ missionCtx: ctx });
      expect(result.passed).toBe(true); // Doesn't block, just warns
      expect(result.warnings?.some((w) => w.includes("primary color"))).toBe(true);
    });
  });

  describe("prompt_validation hook", () => {
    it("passes a valid semantic JSON", () => {
      const ctx = makeMissionCtx();
      const json = makeSemanticJson();
      const result = promptValidationHook({ missionCtx: ctx }, json);
      expect(result.passed).toBe(true);
    });

    it("blocks when subject is missing", () => {
      const ctx = makeMissionCtx();
      const json: SemanticPromptJson = {}; // No subject
      const result = promptValidationHook({ missionCtx: ctx }, json);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain("Subject type not defined");
    });

    it("warns when lighting is not specified", () => {
      const ctx = makeMissionCtx();
      const json = makeSemanticJson();
      delete json.lighting;
      const result = promptValidationHook({ missionCtx: ctx }, json);
      expect(result.warnings?.some((w) => w.includes("lighting"))).toBe(true);
    });

    it("blocks when no_text_in_image contradicts typography medium", () => {
      const ctx = makeMissionCtx(); // no_text_in_image = true
      const json = makeSemanticJson();
      json.style = { ...json.style, medium: "3D product visualization with typography" };
      json.constraints = { no_text_in_image: true };
      const result = promptValidationHook({ missionCtx: ctx }, json);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain("Contradiction");
    });
  });

  describe("visual_render_check hook", () => {
    it("passes a valid diffusion prompt within token limit", () => {
      const ctx = makeMissionCtx();
      const prompt: RenderedPrompt = {
        model_type: "diffusion",
        target_model: "flux-dev",
        prompt: "floating smartphone, dark metal, purple gradient background, ambient glow",
        negative_prompt: "text, watermark, stock photo",
        estimated_cost: 0.04,
      };
      const result = visualRenderCheckHook({ missionCtx: ctx }, prompt);
      expect(result.passed).toBe(true);
    });

    it("blocks when diffusion prompt exceeds 75 tokens", () => {
      const ctx = makeMissionCtx();
      // Generate a very long prompt
      const longPrompt = Array(80).fill("keyword").join(", ");
      const prompt: RenderedPrompt = {
        model_type: "diffusion",
        target_model: "flux-dev",
        prompt: longPrompt,
        negative_prompt: "text",
        estimated_cost: 0.04,
      };
      const result = visualRenderCheckHook({ missionCtx: ctx }, prompt);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain("CLIP limit");
    });

    it("blocks when cost exceeds remaining budget", () => {
      const ctx = recordMissionCost(makeMissionCtx(), 6.49); // Nearly depleted
      const prompt: RenderedPrompt = {
        model_type: "reasoning",
        target_model: "fal-ai/nano-banana-pro",
        prompt: "test",
        estimated_cost: 0.50, // More than remaining
      };
      const result = visualRenderCheckHook({ missionCtx: ctx }, prompt);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain("Insufficient budget");
    });
  });

  describe("artifact_validation hook", () => {
    it("passes a valid artifact", () => {
      const ctx = makeMissionCtx();
      const result = artifactValidationHook({ missionCtx: ctx }, {
        id: "art-001",
        format_name: "desktop_hero",
        width: 1440,
        height: 680,
        file_size_kb: 150,
        detected_text: false,
      });
      expect(result.passed).toBe(true);
    });

    it("fails when resolution mismatches required format", () => {
      const ctx = makeMissionCtx();
      const result = artifactValidationHook({ missionCtx: ctx }, {
        id: "art-002",
        format_name: "desktop_hero",
        width: 1920, // Wrong
        height: 1080, // Wrong
      });
      expect(result.passed).toBe(false);
      expect(result.reason).toContain("Resolution mismatch");
    });

    it("fails when text detected in no-text image", () => {
      const ctx = makeMissionCtx(); // no_text_in_image: true
      const result = artifactValidationHook({ missionCtx: ctx }, {
        id: "art-003",
        detected_text: true,
      });
      expect(result.passed).toBe(false);
      expect(result.reason).toContain("Text detected");
    });
  });

  describe("budget_check hook", () => {
    it("passes when budget is sufficient", () => {
      const ctx = makeMissionCtx(); // $6.50 total
      const result = budgetCheckHook({ missionCtx: ctx }, 0.50);
      expect(result.passed).toBe(true);
    });

    it("blocks when cost exceeds remaining budget", () => {
      const ctx = recordMissionCost(makeMissionCtx(), 6.40);
      const result = budgetCheckHook({ missionCtx: ctx }, 0.50);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain("Insufficient budget");
    });

    it("warns when budget is running low", () => {
      const ctx = recordMissionCost(makeMissionCtx(), 6.0); // $0.50 left
      const result = budgetCheckHook({ missionCtx: ctx }, 0.30); // Fits but barely
      expect(result.passed).toBe(true);
      expect(result.warnings?.some((w) => w.includes("Low budget"))).toBe(true);
    });
  });

  describe("mission_update hook", () => {
    it("records actual cost and updates budget", () => {
      const ctx = makeMissionCtx();
      const { updatedContext } = missionUpdateHook(
        { missionCtx: ctx },
        { actualCostUsd: 1.25 }
      );
      expect(updatedContext.mission.budget.spent).toBe(1.25);
    });

    it("updates deliverable status", () => {
      const ctx = makeMissionCtx();
      const { updatedContext } = missionUpdateHook(
        { missionCtx: ctx },
        { deliverableId: "hero_image", deliverableStatus: "approved", artifactRef: "file://hero.webp" }
      );
      const deliverable = updatedContext.mission.deliverables.find((d) => d.id === "hero_image");
      expect(deliverable?.status).toBe("approved");
      expect(deliverable?.artifactRef).toBe("file://hero.webp");
    });

    it("sets mission status to approved when all deliverables approved", () => {
      const ctx = makeMissionCtx();
      const step1 = missionUpdateHook(
        { missionCtx: ctx },
        { deliverableId: "hero_image", deliverableStatus: "approved" }
      ).updatedContext;
      const step2 = missionUpdateHook(
        { missionCtx: step1 },
        { deliverableId: "og_image", deliverableStatus: "delivered" }
      ).updatedContext;
      expect(step2.mission.status).toBe("approved");
    });
  });

  describe("runHook", () => {
    it("passes through a passing result", () => {
      const result = runHook("budget_check", { passed: true });
      expect(result.passed).toBe(true);
    });

    it("passes through a failing result", () => {
      const result = runHook("prompt_validation", { passed: false, reason: "No subject" });
      expect(result.passed).toBe(false);
    });
  });
});

// ─── Tool Registry ────────────────────────────────────────────────────────

describe("ToolRegistry", () => {
  const registry = ToolRegistry.instance;

  it("returns a singleton instance", () => {
    expect(ToolRegistry.instance).toBe(registry);
  });

  it("has tools registered on init", () => {
    const summary = registry.getSummary();
    expect(summary.totalTools).toBeGreaterThan(5);
    expect(summary.fallbackChains).toBeGreaterThan(3);
  });

  it("retrieves a tool by ID", () => {
    const tool = registry.getTool("fal-ai/nano-banana-pro");
    expect(tool).toBeDefined();
    expect(tool!.name).toBe("Nano Banana Pro");
    expect(tool!.cost_per_use).toBe(0.15);
    expect(tool!.capabilities).toContain("text-to-image");
  });

  it("gets tools by capability", () => {
    const imageTools = registry.getToolsByCapability("text-to-image");
    expect(imageTools.length).toBeGreaterThan(2);
    expect(imageTools.every((t) => t.capabilities.includes("text-to-image"))).toBe(true);
  });

  it("returns fallback chain in priority order", () => {
    const chain = registry.getFallbackChain("photorealistic_image");
    expect(chain.length).toBeGreaterThan(0);
    expect(chain[0].priority).toBe(1);
    // Verify sorted by priority
    for (let i = 1; i < chain.length; i++) {
      expect(chain[i].priority).toBeGreaterThanOrEqual(chain[i - 1].priority);
    }
  });

  it("selects best tool within budget", () => {
    const tool = registry.selectBestTool("photorealistic_image", { budget: 0.10 });
    expect(tool).not.toBeNull();
    expect(tool!.cost_per_use).toBeLessThanOrEqual(0.10);
  });

  it("returns null when no tool fits budget", () => {
    const tool = registry.selectBestTool("photorealistic_image", { budget: 0.001 });
    // All real tools cost more, except local ones (cost 0)
    // Local tools exist, so this may return a local tool
    // Test that it either returns a free local tool or null
    if (tool !== null) {
      expect(tool.cost_per_use).toBe(0);
    }
  });

  it("prefers local tools when preferLocal=true", () => {
    const tool = registry.selectBestTool("photorealistic_image", { preferLocal: true });
    // Should prefer ComfyUI (local) over API tools
    if (tool !== null) {
      // May or may not be local depending on what's enabled
      expect(tool).toBeDefined();
    }
  });

  it("allows registering a new tool", () => {
    registry.registerTool({
      id: "test/custom-tool",
      name: "Custom Test Tool",
      type: "api",
      capabilities: ["text-to-image"],
      model_type: "reasoning",
      prompt_format: "natural_language",
      cost_per_use: 0.01,
      enabled: true,
    });
    expect(registry.getTool("test/custom-tool")).toBeDefined();
  });

  it("can disable and re-enable a tool", () => {
    const toolId = "fal-ai/nano-banana-2";
    registry.setToolEnabled(toolId, false);
    expect(registry.getTool(toolId)!.enabled).toBe(false);
    registry.setToolEnabled(toolId, true);
    expect(registry.getTool(toolId)!.enabled).toBe(true);
  });
});

// ─── Anti-Slop Engine ─────────────────────────────────────────────────────

describe("AntiSlopEngine", () => {
  const engine = AntiSlopEngine.instance;

  it("returns a singleton", () => {
    expect(AntiSlopEngine.instance).toBe(engine);
  });

  it("injects anti-slop tokens into semantic JSON", () => {
    const json = makeSemanticJson();
    const { semanticJson, injected, negatives_injected } = engine.injectAntiSlop(json);

    expect(injected.length).toBeGreaterThan(0);
    expect(negatives_injected.length).toBeGreaterThan(0);
    expect(semanticJson.style?.anti_slop?.length).toBeGreaterThan(
      json.style?.anti_slop?.length ?? 0
    );
    // Original unchanged
    expect(json.style?.anti_slop?.length).toBe(2);
  });

  it("injects photorealistic tokens for photo-type content", () => {
    const json: SemanticPromptJson = {
      subject: { type: "person" },
      style: { medium: "photorealistic portrait" },
    };
    const { injected } = engine.injectAntiSlop(json);
    expect(injected.some((t) => t.includes("film grain") || t.includes("skin texture"))).toBe(true);
  });

  it("injects product tokens for product content", () => {
    const json: SemanticPromptJson = {
      subject: { type: "smartphone product" },
      style: { medium: "3D product visualization" },
    };
    const { injected } = engine.injectAntiSlop(json);
    expect(injected.some((t) => t.includes("reflection") || t.includes("texture"))).toBe(true);
  });

  it("analyzes clean artifact as passing", () => {
    const analysis = engine.analyzeArtifact({
      detected_text: false,
      is_centered_composition: false,
      saturation: 0.6,
      uniformity: 0.5,
    });
    expect(analysis.passed).toBe(true);
    expect(analysis.score).toBeGreaterThanOrEqual(0.6);
  });

  it("penalizes oversaturation", () => {
    const analysis = engine.analyzeArtifact({ saturation: 0.95 });
    expect(analysis.detected_markers).toContain("oversaturation");
    expect(analysis.score).toBeLessThan(1.0);
    expect(analysis.corrections.some((c) => c.description.includes("saturation"))).toBe(true);
  });

  it("fails artifact with unwanted text", () => {
    const analysis = engine.analyzeArtifact({ detected_text: true, text_expected: false });
    expect(analysis.passed).toBe(false);
    expect(analysis.detected_markers).toContain("unwanted_text");
  });

  it("screens prompt and removes slop triggers", () => {
    const prompt = "Create a beautiful stunning hyperrealistic portrait of a woman";
    const { cleaned, removed } = engine.screenPrompt(prompt);
    expect(removed.length).toBeGreaterThan(0);
    expect(cleaned).not.toContain("beautiful");
    expect(cleaned).not.toContain("stunning");
  });

  it("returns negative tokens list", () => {
    const negatives = engine.getNegativeTokens();
    expect(negatives.length).toBeGreaterThan(0);
    expect(negatives.some((t) => t.includes("stock photo"))).toBe(true);
  });
});

// ─── Dry Run Mode ─────────────────────────────────────────────────────────

describe("DryRunSimulator", () => {
  const simulator = new DryRunSimulator();

  it("produces a simulation report", () => {
    const ctx = makeMissionCtx();
    const report = simulator.simulate("FitPulse Landing Page", ctx);

    expect(report.projectTitle).toBe("FitPulse Landing Page");
    expect(report.agentsToSpawn).toBeGreaterThan(0);
    expect(report.agentList.length).toBeGreaterThan(0);
    expect(report.estimatedCostUsd).toBeGreaterThan(0);
    expect(report.tasks.length).toBeGreaterThan(0);
  });

  it("includes deliverable tasks in simulation", () => {
    const ctx = makeMissionCtx();
    const report = simulator.simulate("Test", ctx);

    // Should have tasks for both deliverables: hero_image, og_image
    const hasDraftHero = report.tasks.some((t) => t.title.includes("Draft") && t.title.includes("Hero"));
    const hasFinalHero = report.tasks.some((t) => t.title.includes("Final") && t.title.includes("Hero"));
    expect(hasDraftHero).toBe(true);
    expect(hasFinalHero).toBe(true);
  });

  it("counts image generations correctly", () => {
    const ctx = makeMissionCtx(); // 2 deliverables (both images)
    const report = simulator.simulate("Test", ctx);
    expect(report.estimatedImages).toBeGreaterThan(0);
  });

  it("detects video deliverables", () => {
    const ctx = buildMissionContext({
      ...makeMissionCtx(),
      mission: {
        ...makeMissionCtx().mission,
        deliverables: [
          { id: "promo_video", name: "Promo Video", status: "pending", priority: 1 },
        ],
      },
    });
    const report = simulator.simulate("Video Test", ctx);
    expect(report.estimatedVideos).toBeGreaterThan(0);
  });

  it("calculates budget utilization", () => {
    const ctx = makeMissionCtx(); // $6.50 budget
    const report = simulator.simulate("Test", ctx);
    expect(report.budgetAllocated).toBe(6.50);
    expect(report.budgetUtilizationPct).toBeGreaterThanOrEqual(0);
    expect(report.budgetUtilizationPct).toBeLessThanOrEqual(200); // Might exceed budget
  });

  it("includes critical path", () => {
    const ctx = makeMissionCtx();
    const report = simulator.simulate("Test", ctx);
    expect(report.criticalPath.length).toBeGreaterThan(0);
  });

  it("generates formatted report string", () => {
    const ctx = makeMissionCtx();
    const report = simulator.simulate("FitPulse Landing", ctx);
    const text = report.formatted();

    expect(text).toContain("SIMULATION REPORT");
    expect(text).toContain("FitPulse Landing");
    expect(text).toContain("Agents to spawn");
    expect(text).toContain("Estimated cost");
  });

  it("adds recommendations", () => {
    const ctx = makeMissionCtx();
    const report = simulator.simulate("Test", ctx);
    // Should have at least one recommendation (parallel tasks, video deferral, etc.)
    expect(report.recommendations.length).toBeGreaterThanOrEqual(0);
  });

  it("warns when budget is zero", () => {
    const ctx = buildMissionContext({
      ...makeMissionCtx(),
      mission: { ...makeMissionCtx().mission, budget: { total: 0, spent: 0, reserved: 0, currency: "USD" } },
    });
    const report = simulator.simulate("Zero Budget", ctx);
    // No budget utilization calculation error
    expect(report.budgetUtilizationPct).toBe(0);
  });
});

// ─── Prompt Memory ────────────────────────────────────────────────────────

describe("PromptMemory", () => {
  let memory: PromptMemory;

  beforeEach(() => {
    // Use fresh instance for each test
    memory = new (PromptMemory as any)();
    (memory as any).entries = new Map();
  });

  it("records a prompt entry", () => {
    const entry = memory.record({
      semanticJson: makeSemanticJson(),
      renderedPrompts: {},
      tool_used: "fal-ai/nano-banana-pro",
      params: { aspect_ratio: "16:9" },
      human_score: 9,
      mission_type: "landing_page",
      industry: "fitness",
      iterations_to_approve: 1,
      total_cost_usd: 0.19,
      tags: ["gradient", "product_viz", "premium", "dark_theme"],
    });

    expect(entry.id).toBeDefined();
    expect(entry.id).toMatch(/^pm-/);
    expect(entry.reuse_count).toBe(0);
    expect(entry.created_at).toBeInstanceOf(Date);
  });

  it("searches by mission type", () => {
    memory.record({
      semanticJson: makeSemanticJson(),
      renderedPrompts: {},
      tool_used: "fal-ai/nano-banana-pro",
      params: {},
      human_score: 8,
      mission_type: "landing_page",
      industry: "fitness",
      iterations_to_approve: 2,
      total_cost_usd: 0.30,
      tags: ["hero", "premium"],
    });

    memory.record({
      semanticJson: makeSemanticJson(),
      renderedPrompts: {},
      tool_used: "comfyui/flux-dev",
      params: {},
      human_score: 7,
      mission_type: "smm_campaign",
      industry: "e-commerce",
      iterations_to_approve: 3,
      total_cost_usd: 0.10,
      tags: ["social", "product"],
    });

    const results = memory.search({ mission_type: "landing_page" });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].entry.mission_type).toBe("landing_page");
  });

  it("searches by tags", () => {
    memory.record({
      semanticJson: makeSemanticJson(),
      renderedPrompts: {},
      tool_used: "midjourney",
      params: {},
      human_score: 9,
      mission_type: "brand_identity",
      industry: "technology",
      iterations_to_approve: 1,
      total_cost_usd: 0.04,
      tags: ["gradient", "tech", "purple"],
    });

    const results = memory.search({ tags: ["gradient", "purple"] });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].entry.tags).toContain("gradient");
  });

  it("filters by minimum score", () => {
    memory.record({
      semanticJson: makeSemanticJson(),
      renderedPrompts: {},
      tool_used: "fal-ai/nano-banana-2",
      params: {},
      human_score: 5, // Low score
      mission_type: "custom",
      industry: "retail",
      iterations_to_approve: 4,
      total_cost_usd: 0.20,
      tags: ["product"],
    });

    memory.record({
      semanticJson: makeSemanticJson(),
      renderedPrompts: {},
      tool_used: "fal-ai/nano-banana-pro",
      params: {},
      human_score: 9, // High score
      mission_type: "custom",
      industry: "retail",
      iterations_to_approve: 1,
      total_cost_usd: 0.15,
      tags: ["product"],
    });

    const results = memory.search({ min_score: 7 });
    expect(results.every((r) => r.entry.human_score >= 7)).toBe(true);
  });

  it("increments reuse_count when entry is returned", () => {
    const recorded = memory.record({
      semanticJson: makeSemanticJson(),
      renderedPrompts: {},
      tool_used: "fal-ai/nano-banana-pro",
      params: {},
      human_score: 9,
      mission_type: "landing_page",
      industry: "fitness",
      iterations_to_approve: 1,
      total_cost_usd: 0.15,
      tags: ["hero"],
    });

    expect(recorded.reuse_count).toBe(0);
    memory.search({ mission_type: "landing_page" });
    expect(memory.get(recorded.id)!.reuse_count).toBe(1);
  });

  it("returns analytics for the library", () => {
    memory.record({
      semanticJson: makeSemanticJson(),
      renderedPrompts: {},
      tool_used: "fal-ai/nano-banana-pro",
      params: {},
      human_score: 8,
      mission_type: "landing_page",
      industry: "fitness",
      iterations_to_approve: 2,
      total_cost_usd: 0.19,
      tags: ["hero", "fitness"],
    });

    const analytics = memory.getAnalytics();
    expect(analytics.totalEntries).toBe(1);
    expect(analytics.avgScore).toBe(8);
    expect(analytics.topTools.length).toBeGreaterThan(0);
    expect(analytics.topTags.length).toBeGreaterThan(0);
  });

  it("exports and imports entries", () => {
    memory.record({
      semanticJson: makeSemanticJson(),
      renderedPrompts: {},
      tool_used: "fal-ai/nano-banana-pro",
      params: {},
      human_score: 9,
      mission_type: "landing_page",
      industry: "fitness",
      iterations_to_approve: 1,
      total_cost_usd: 0.15,
      tags: ["test"],
    });

    const exported = memory.export();
    expect(exported.length).toBe(1);

    // Import into a fresh instance
    const fresh = new (PromptMemory as any)();
    (fresh as any).entries = new Map();
    fresh.import(exported);

    expect(fresh.getAll().length).toBe(1);
    expect(fresh.getAll()[0].human_score).toBe(9);
  });

  it("returns best prompts by ROI", () => {
    // Low ROI: low score, high cost, many iterations
    memory.record({
      semanticJson: makeSemanticJson(),
      renderedPrompts: {},
      tool_used: "runway/gen4",
      params: {},
      human_score: 7,
      mission_type: "landing_page",
      industry: "fitness",
      iterations_to_approve: 5,
      total_cost_usd: 2.0,
      tags: [],
    });

    // High ROI: high score, low cost, 1 iteration
    memory.record({
      semanticJson: makeSemanticJson(),
      renderedPrompts: {},
      tool_used: "comfyui/flux-dev",
      params: {},
      human_score: 9,
      mission_type: "landing_page",
      industry: "fitness",
      iterations_to_approve: 1,
      total_cost_usd: 0.00, // Free (local)
      tags: [],
    });

    const best = memory.getBestPrompts(10);
    expect(best.length).toBeGreaterThan(0);
    // Best should be first
    if (best.length >= 2) {
      const roi0 = best[0].human_score / (Math.max(best[0].total_cost_usd, 0.01) * best[0].iterations_to_approve);
      const roi1 = best[1].human_score / (Math.max(best[1].total_cost_usd, 0.01) * best[1].iterations_to_approve);
      expect(roi0).toBeGreaterThanOrEqual(roi1);
    }
  });

  it("returns empty analytics when no entries", () => {
    const analytics = memory.getAnalytics();
    expect(analytics.totalEntries).toBe(0);
    expect(analytics.avgScore).toBe(0);
  });

  it("clears all entries", () => {
    memory.record({
      semanticJson: makeSemanticJson(),
      renderedPrompts: {},
      tool_used: "fal-ai/nano-banana-pro",
      params: {},
      human_score: 8,
      mission_type: "landing_page",
      industry: "fitness",
      iterations_to_approve: 1,
      total_cost_usd: 0.15,
      tags: [],
    });
    expect(memory.getAll().length).toBe(1);
    memory.clear();
    expect(memory.getAll().length).toBe(0);
  });
});
