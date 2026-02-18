/**
 * Mocked HTTP tests for EvaluationRoom, ReportMasterRoom, and FinalizerRoom.
 * Tests the complete Phase 4-6 pipeline rooms.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EvaluationRoom } from "../src/rooms/evaluation-room.js";
import { ReportMasterRoom } from "../src/rooms/reportmaster-room.js";
import { FinalizerRoom } from "../src/rooms/finalizer-room.js";
import { MemoryStore } from "../src/memory/memory-store.js";
import { CostRouter } from "../src/cost/router.js";
import { TaskStatus, TaskPriority } from "../src/core/types.js";
import type { Task } from "../src/core/types.js";

// ─── Helpers ─────────────────────────────────────────────────────

function mockFetchResponse(body: unknown): Response {
    return {
        ok: true, status: 200,
        json: async () => body,
        text: async () => JSON.stringify(body),
        headers: new Headers(), redirected: false,
        statusText: "OK", type: "default" as ResponseType, url: "",
        clone: () => mockFetchResponse(body),
        body: null, bodyUsed: false,
        arrayBuffer: async () => new ArrayBuffer(0),
        blob: async () => new Blob(),
        formData: async () => new FormData(),
        bytes: async () => new Uint8Array(),
    } as Response;
}

function ollamaResponse(content: unknown) {
    return {
        model: "llama3.2:3b",
        message: { role: "assistant", content: JSON.stringify(content) },
        done: true, done_reason: "stop",
        prompt_eval_count: 100, eval_count: 200,
    };
}

function createTask(title: string, input: Record<string, unknown> = {}): Task {
    return {
        id: `test-${Date.now()}`,
        title,
        description: `Test task: ${title}`,
        status: TaskStatus.PENDING,
        priority: TaskPriority.NORMAL,
        input,
        dependencies: [],
        createdAt: new Date(),
    };
}

// ─── EvaluationRoom ──────────────────────────────────────────────

describe("EvaluationRoom", () => {
    let fetchSpy: ReturnType<typeof vi.fn>;
    let room: EvaluationRoom;

    beforeEach(() => {
        fetchSpy = vi.fn();
        vi.stubGlobal("fetch", fetchSpy);
        room = new EvaluationRoom(new MemoryStore(), new CostRouter());
    });
    afterEach(() => vi.restoreAllMocks());

    it("evaluates task results with quality scores", async () => {
        const evalResult = {
            overallScore: 85,
            criteria: [
                { name: "Brand consistency", score: 90, maxScore: 100, passed: true, feedback: "Strong palette" },
                { name: "Completeness", score: 80, maxScore: 100, passed: true, feedback: "All deliverables present" },
            ],
            strengths: ["Strong visual identity"],
            issues: [],
            passedQualityGate: true,
            recommendation: "approve",
            executionHandicap: 0.85,
            summary: "Project meets quality standards",
        };
        fetchSpy.mockResolvedValueOnce(mockFetchResponse(ollamaResponse(evalResult)));

        const task = createTask("Evaluate Brand Kit", {
            taskResults: [{ id: "t1", status: "completed", output: { ideas: "Logo done" } }],
            briefReport: { summary: "Restaurant brand kit" },
        });
        await room.acceptTask(task);

        expect(task.status).toBe(TaskStatus.COMPLETED);
        const output = task.output as Record<string, unknown>;
        expect(output.status).toBe("completed");
        const result = output.evaluationResult as typeof evalResult;
        expect(result.overallScore).toBe(85);
        expect(result.passedQualityGate).toBe(true);
        expect(result.recommendation).toBe("approve");
    });

    it("returns stub when LLM is unavailable", async () => {
        fetchSpy.mockRejectedValueOnce(new Error("timeout"));
        const task = createTask("Evaluate");
        await room.acceptTask(task);

        expect(task.status).toBe(TaskStatus.COMPLETED);
        const output = task.output as Record<string, unknown>;
        expect(output.status).toBe("llm_unavailable");
        const result = output.evaluationResult as Record<string, unknown>;
        expect(result.passedQualityGate).toBe(false);
        expect(result.recommendation).toBe("escalate");
    });

    it("has correct room configuration", () => {
        expect(room.id).toBe("evaluation");
        expect(room.agents).toHaveLength(1);
        expect(room.agents[0].config.role).toBe("lead");
    });
});

// ─── ReportMasterRoom ────────────────────────────────────────────

describe("ReportMasterRoom", () => {
    let fetchSpy: ReturnType<typeof vi.fn>;
    let room: ReportMasterRoom;

    beforeEach(() => {
        fetchSpy = vi.fn();
        vi.stubGlobal("fetch", fetchSpy);
        room = new ReportMasterRoom(new MemoryStore(), new CostRouter());
    });
    afterEach(() => vi.restoreAllMocks());

    it("generates a quality report with verdict", async () => {
        const report = {
            qualityVerdict: "approved",
            qualityScore: 88,
            clientReport: {
                title: "Restaurant Brand Kit",
                executiveSummary: "Complete brand kit delivered",
                deliverables: [{ name: "Logo", status: "completed", qualityScore: 92 }],
                highlights: ["Modern design"],
            },
            reiterationItems: [],
            lessonsLearned: ["Italian niche prefers warm tones"],
        };
        fetchSpy.mockResolvedValueOnce(mockFetchResponse(ollamaResponse(report)));

        const task = createTask("Generate Report", {
            taskResults: [{ status: "completed" }],
            evaluationMetrics: { overallScore: 88 },
        });
        await room.acceptTask(task);

        expect(task.status).toBe(TaskStatus.COMPLETED);
        const output = task.output as Record<string, unknown>;
        expect(output.status).toBe("completed");
        const result = output.report as typeof report;
        expect(result.qualityVerdict).toBe("approved");
        expect(result.qualityScore).toBe(88);
        expect(result.lessonsLearned).toHaveLength(1);
    });

    it("returns stub when LLM is unavailable", async () => {
        fetchSpy.mockRejectedValueOnce(new Error("ECONNREFUSED"));
        const task = createTask("Generate Report");
        await room.acceptTask(task);

        expect(task.status).toBe(TaskStatus.COMPLETED);
        const output = task.output as Record<string, unknown>;
        expect(output.status).toBe("llm_unavailable");
        const result = output.report as Record<string, unknown>;
        expect(result.qualityVerdict).toBe("needs_reiteration");
    });

    it("has correct room configuration", () => {
        expect(room.id).toBe("reportmaster");
        expect(room.agents).toHaveLength(2);
        expect(room.agents[0].config.role).toBe("lead");
        expect(room.agents[1].config.role).toBe("reviewer");
    });
});

// ─── FinalizerRoom ───────────────────────────────────────────────

describe("FinalizerRoom", () => {
    let fetchSpy: ReturnType<typeof vi.fn>;
    let room: FinalizerRoom;

    beforeEach(() => {
        fetchSpy = vi.fn();
        vi.stubGlobal("fetch", fetchSpy);
        room = new FinalizerRoom(new MemoryStore(), new CostRouter());
    });
    afterEach(() => vi.restoreAllMocks());

    it("compiles a final delivery package", async () => {
        const pkg = {
            dashboard: {
                projectTitle: "Restaurant Brand Kit",
                executionStats: { totalCostUsd: 0.04, totalTokensUsed: 8000 },
                qualityMetrics: { overallScore: 88 },
            },
            presentation: {
                title: "Restaurant Brand Kit — Delivery",
                sections: [{ heading: "Overview", content: "Complete brand identity" }],
            },
            deliverables: [
                { filename: "logo.svg", type: "image", description: "Main logo" },
                { filename: "brand_guide.pdf", type: "document", description: "Brand guidelines" },
            ],
            archive: {
                projectId: "proj-123",
                costEstimateVsActual: { estimated: 0.05, actual: 0.04 },
                lessonsLearned: ["Warm colors work for restaurants"],
            },
        };
        fetchSpy.mockResolvedValueOnce(mockFetchResponse(ollamaResponse(pkg)));

        const task = createTask("Finalize Delivery", {
            clientReport: { qualityVerdict: "approved" },
            taskResults: [{ status: "completed" }],
        });
        await room.acceptTask(task);

        expect(task.status).toBe(TaskStatus.COMPLETED);
        const output = task.output as Record<string, unknown>;
        expect(output.status).toBe("completed");
        const result = output.deliveryPackage as typeof pkg;
        expect(result.deliverables).toHaveLength(2);
        expect(result.archive.lessonsLearned).toHaveLength(1);
        expect(result.dashboard.qualityMetrics.overallScore).toBe(88);
    });

    it("returns stub when LLM is unavailable", async () => {
        fetchSpy.mockRejectedValueOnce(new Error("timeout"));
        const task = createTask("Finalize");
        await room.acceptTask(task);

        expect(task.status).toBe(TaskStatus.COMPLETED);
        const output = task.output as Record<string, unknown>;
        expect(output.status).toBe("llm_unavailable");
    });

    it("has correct room configuration", () => {
        expect(room.id).toBe("finalizer");
        expect(room.name).toBe("Finalizer Room");
        expect(room.agents).toHaveLength(1);
    });
});
