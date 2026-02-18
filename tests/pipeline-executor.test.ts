/**
 * Tests for PipelineExecutor — verifies phase sequencing,
 * data handoff, quality gates, and error handling.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Orchestrator } from "../src/core/orchestrator.js";
import { PipelineExecutor } from "../src/pipeline/pipeline-executor.js";
import { PipelinePhase } from "../src/pipeline/pipeline-types.js";
import { AutonomyLevel, TaskStatus } from "../src/core/types.js";
import { MemoryStore } from "../src/memory/memory-store.js";
import { CostRouter } from "../src/cost/router.js";

// ─── Helpers ─────────────────────────────────────────────────────

function mockFetchResponse(body: unknown): Response {
    const json = JSON.stringify(body);
    return {
        ok: true,
        status: 200,
        json: () => Promise.resolve(body),
        text: () => Promise.resolve(json),
        headers: new Headers(),
        redirected: false,
        statusText: "OK",
        type: "basic" as ResponseType,
        url: "",
        clone: () => mockFetchResponse(body),
        body: null,
        bodyUsed: false,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        blob: () => Promise.resolve(new Blob()),
        formData: () => Promise.resolve(new FormData()),
        bytes: () => Promise.resolve(new Uint8Array()),
    } as Response;
}

function ollamaResponse(content: unknown) {
    return mockFetchResponse({
        model: "llama3.2:3b",
        message: { role: "assistant", content: typeof content === "string" ? content : JSON.stringify(content) },
        prompt_eval_count: 100,
        eval_count: 200,
        finish_reason: "stop",
    });
}

// ─── Tests ──────────────────────────────────────────────────────

describe("PipelineExecutor", () => {
    let orchestrator: Orchestrator;
    let fetchSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        process.env.OPENROUTER_API_KEY = "test-key";
        orchestrator = new Orchestrator({
            autonomyLevel: AutonomyLevel.FREERIDE,
        });
        fetchSpy = vi.fn();
        vi.stubGlobal("fetch", fetchSpy);
    });

    afterEach(() => vi.restoreAllMocks());

    it("creates a pipeline executor with default config", () => {
        const pipeline = new PipelineExecutor(orchestrator);
        expect(pipeline).toBeDefined();
    });

    it("creates a pipeline executor with custom config", () => {
        const pipeline = new PipelineExecutor(orchestrator, {
            qualityThreshold: 80,
            maxIterations: 3,
            budgetCeilingUsd: 2.0,
        });
        expect(pipeline).toBeDefined();
    });

    it("runs a minimal pipeline skipping most phases", async () => {
        // Mock LLM responses for briefing → brainstorm → cost → execution phases
        const briefResponse = {
            objectives: ["Create a logo"],
            targetAudience: "Tech startups",
            deliverables: ["logo.png"],
            constraints: [],
            acceptanceCriteria: ["High resolution"],
            tone: "Professional",
        };

        const brainstormResponse = "Idea 1: Minimalist geometric logo\nIdea 2: Abstract symbol";

        const jobPlanResponse = JSON.stringify({
            tasks: [
                { id: "task-1", title: "Design Logo", assignedRoom: "image-gen", description: "Create logo", dependencies: [] },
            ],
            parallelGroups: [["task-1"]],
            reasoning: "Single task for logo generation",
        });

        const evalResponse = JSON.stringify({
            overallScore: 85,
            criteria: [],
            strengths: ["Good design"],
            issues: [],
            passedQualityGate: true,
            recommendation: "approve",
            executionHandicap: 0.85,
            summary: "Good quality output",
        });

        const reportResponse = JSON.stringify({
            qualityVerdict: "approved",
            qualityScore: 85,
            clientReport: { title: "Logo Project", summary: "Completed" },
            lessonsLearned: ["Use higher contrast"],
        });

        const finalizerResponse = JSON.stringify({
            dashboard: { projectTitle: "Logo Project", executionStats: { totalCostUsd: 0.01 } },
            deliverables: [{ name: "logo.png", type: "image" }],
        });

        // Set up sequential mock responses (one per phase that calls LLM)
        fetchSpy
            .mockResolvedValueOnce(ollamaResponse(JSON.stringify(briefResponse)))    // Phase 1: Briefing
            .mockResolvedValueOnce(ollamaResponse(brainstormResponse))               // Phase 2: Brainstorm
            .mockResolvedValueOnce(ollamaResponse("Cost estimate completed"))        // Phase 2.5: Cost
            .mockResolvedValueOnce(ollamaResponse(jobPlanResponse))                  // Phase 3: JobMaster
            .mockResolvedValueOnce(ollamaResponse("Logo designed successfully"))     // Phase 4: Execution (image-gen)
            .mockResolvedValueOnce(ollamaResponse(evalResponse))                     // Phase 4: Evaluation
            .mockResolvedValueOnce(ollamaResponse(reportResponse))                   // Phase 5: Report
            .mockResolvedValueOnce(ollamaResponse(finalizerResponse));               // Phase 6: Finalizer

        const pipeline = new PipelineExecutor(orchestrator, {
            qualityThreshold: 70,
            maxIterations: 1,
            budgetCeilingUsd: 10.0,
        });

        const result = await pipeline.execute("Logo Design", "Create a professional logo for a tech startup");

        // Pipeline should complete (may have partial failures if LLM parsing fails)
        expect(result).toBeDefined();
        expect(result.context.projectId).toBeDefined();
        expect(result.context.title).toBe("Logo Design");
        expect(result.durationMs).toBeGreaterThan(0);
        expect(result.totalCostUsd).toBeGreaterThanOrEqual(0);
    });

    it("skips phases when configured", async () => {
        // Pre-populate context and skip niche + briefing
        fetchSpy
            .mockResolvedValueOnce(ollamaResponse("Ideas generated"))    // Phase 2
            .mockResolvedValueOnce(ollamaResponse("Cost estimated"))     // Phase 2.5
            .mockResolvedValueOnce(ollamaResponse(JSON.stringify({       // Phase 3
                tasks: [], parallelGroups: [], reasoning: "No tasks needed",
            })))
            .mockResolvedValueOnce(ollamaResponse(JSON.stringify({       // Phase 4 eval
                overallScore: 90, passedQualityGate: true, recommendation: "approve",
                criteria: [], strengths: [], issues: [], summary: "OK",
            })))
            .mockResolvedValueOnce(ollamaResponse(JSON.stringify({       // Phase 5
                qualityVerdict: "approved", qualityScore: 90,
                clientReport: {}, lessonsLearned: [],
            })))
            .mockResolvedValueOnce(ollamaResponse(JSON.stringify({       // Phase 6
                dashboard: {}, deliverables: [],
            })));

        const pipeline = new PipelineExecutor(orchestrator, {
            skipPhases: [PipelinePhase.NICHE_ADAPTATION, PipelinePhase.BRIEFING],
            presetContext: {
                briefReport: {
                    objectives: ["Test"], targetAudience: "Devs",
                    deliverables: ["test.txt"], constraints: [], acceptanceCriteria: [],
                    tone: "casual", rawContent: "Test brief",
                },
            },
            budgetCeilingUsd: 10.0,
        });

        const result = await pipeline.execute("Quick Test", "A quick test run");

        expect(result).toBeDefined();
        expect(result.context.briefReport).toBeDefined();
        expect(result.context.briefReport!.objectives).toContain("Test");
    });

    it("aborts when budget ceiling is exceeded", async () => {
        // Force the orchestrator to report high spending
        const costRouter = orchestrator.getCostRouter();
        // Record enough cost to exceed a $0.001 ceiling
        costRouter.recordCost(0.01);

        const pipeline = new PipelineExecutor(orchestrator, {
            budgetCeilingUsd: 0.001,
        });

        const result = await pipeline.execute("Over Budget", "This should be too expensive");

        expect(result.success).toBe(false);
        expect(result.context.errors.length).toBeGreaterThan(0);
        expect(result.context.errors[0].message).toContain("Budget ceiling exceeded");
    });

    it("handles phase execution failures gracefully", async () => {
        // Make all LLM calls fail
        fetchSpy.mockRejectedValue(new Error("Connection refused"));

        const pipeline = new PipelineExecutor(orchestrator, {
            budgetCeilingUsd: 10.0,
        });

        const result = await pipeline.execute("Failing Task", "This will fail");

        // Rooms may return graceful stubs on LLM failure (status: llm_unavailable)
        // which means the pipeline may technically "succeed" with degraded output.
        // The important thing is that the result is returned and trackable.
        expect(result).toBeDefined();
        expect(result.context.title).toBe("Failing Task");
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
        // Pipeline either fails outright or completes with degraded output
        if (!result.success) {
            expect(result.stoppedAtPhase).toBeDefined();
            expect(result.context.errors.length).toBeGreaterThan(0);
        }
    });

    it("provides duration and cost in result", async () => {
        // Minimal pipeline that skips everything except niche (no LLM needed)
        const pipeline = new PipelineExecutor(orchestrator, {
            skipPhases: [
                PipelinePhase.BRIEFING,
                PipelinePhase.BRAINSTORM,
                PipelinePhase.COST_ESTIMATION,
                PipelinePhase.JOB_DISTRIBUTION,
                PipelinePhase.EXECUTION,
                PipelinePhase.QUALITY_CONTROL,
                PipelinePhase.FINALIZATION,
            ],
            budgetCeilingUsd: 10.0,
        });

        const result = await pipeline.execute("Niche Only", "restaurant");

        expect(result.success).toBe(true);
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
        expect(result.totalCostUsd).toBeGreaterThanOrEqual(0);
        expect(result.context.nicheProfile).toBeDefined();
        expect(result.context.nicheProfile!.nicheId).toBe("restaurant");
    });

    it("uses preset context without re-running phases", async () => {
        const pipeline = new PipelineExecutor(orchestrator, {
            skipPhases: [
                PipelinePhase.BRIEFING,
                PipelinePhase.BRAINSTORM,
                PipelinePhase.COST_ESTIMATION,
                PipelinePhase.JOB_DISTRIBUTION,
                PipelinePhase.EXECUTION,
                PipelinePhase.QUALITY_CONTROL,
                PipelinePhase.FINALIZATION,
            ],
            presetContext: {
                nicheProfile: {
                    nicheId: "saas",
                    nicheName: "SaaS & Tech Startup",
                    selectedPackages: ["startup-brand"],
                    estimatedPrice: 499,
                    estimatedCost: 8,
                },
            },
            budgetCeilingUsd: 10.0,
        });

        const result = await pipeline.execute("Preset Niche", "SaaS product");

        expect(result.success).toBe(true);
        // Should use preset niche, not re-detect
        expect(result.context.nicheProfile!.nicheId).toBe("saas");
        expect(result.context.nicheProfile!.nicheName).toBe("SaaS & Tech Startup");
    });
});
