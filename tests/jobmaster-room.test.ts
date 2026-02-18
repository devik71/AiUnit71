/**
 * Mocked HTTP tests for JobMasterRoom.
 * Simulates LLM responses by mocking globalThis.fetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { JobMasterRoom } from "../src/rooms/jobmaster-room.js";
import { MemoryStore } from "../src/memory/memory-store.js";
import { CostRouter } from "../src/cost/router.js";
import { TaskStatus, TaskPriority } from "../src/core/types.js";
import type { Task } from "../src/core/types.js";

// ─── Mock Responses ──────────────────────────────────────────────

const MOCK_EXECUTION_PLAN = {
    tasks: [
        {
            id: "task-1",
            title: "Logo & brand identity",
            description: "Design a modern logo with brand color palette",
            assignedRoom: "image-gen",
            priority: "high",
            estimatedTokens: 3000,
            dependsOn: [],
            acceptanceCriteria: ["Logo in SVG format", "3 color variations", "Brand guidelines PDF"],
            deliverables: ["logo.svg", "brand_guide.pdf"],
        },
        {
            id: "task-2",
            title: "Menu copywriting",
            description: "Write menu descriptions for 20 dishes",
            assignedRoom: "copywriting",
            priority: "normal",
            estimatedTokens: 2000,
            dependsOn: [],
            acceptanceCriteria: ["Each dish has name + 2-line description", "Consistent tone"],
            deliverables: ["menu_copy.doc"],
        },
        {
            id: "task-3",
            title: "Menu layout design",
            description: "Design the 2-page menu with finalized copy and logo",
            assignedRoom: "ux-ui",
            priority: "normal",
            estimatedTokens: 2500,
            dependsOn: ["task-1", "task-2"],
            acceptanceCriteria: ["Print-ready PDF", "A4 format"],
            deliverables: ["menu.pdf"],
        },
    ],
    parallelGroups: [["task-1", "task-2"], ["task-3"]],
    executionOrder: "Logo and menu copy run in parallel (group 1), then menu layout (group 2) depends on both",
    totalEstimatedTokens: 7500,
    warnings: [],
};

const MOCK_OLLAMA_RESPONSE = {
    model: "llama3.2:3b",
    message: {
        role: "assistant",
        content: JSON.stringify(MOCK_EXECUTION_PLAN),
    },
    done: true,
    done_reason: "stop",
    prompt_eval_count: 200,
    eval_count: 300,
};

function mockFetchResponse(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
        text: async () => JSON.stringify(body),
        headers: new Headers(),
        redirected: false,
        statusText: status === 200 ? "OK" : "Error",
        type: "default" as ResponseType,
        url: "",
        clone: () => mockFetchResponse(body, status),
        body: null,
        bodyUsed: false,
        arrayBuffer: async () => new ArrayBuffer(0),
        blob: async () => new Blob(),
        formData: async () => new FormData(),
        bytes: async () => new Uint8Array(),
    } as Response;
}

function createTask(overrides: Partial<Task> = {}): Task {
    return {
        id: "test-job-001",
        title: "Restaurant Brand Kit — Execution Plan",
        description: "Create execution plan for restaurant branding project",
        status: TaskStatus.PENDING,
        priority: TaskPriority.NORMAL,
        input: {},
        dependencies: [],
        createdAt: new Date(),
        ...overrides,
    };
}

// ─── Tests ───────────────────────────────────────────────────────

describe("JobMasterRoom", () => {
    let fetchSpy: ReturnType<typeof vi.fn>;
    let room: JobMasterRoom;

    beforeEach(() => {
        fetchSpy = vi.fn();
        vi.stubGlobal("fetch", fetchSpy);
        room = new JobMasterRoom(new MemoryStore(), new CostRouter());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("creates an execution plan with tasks and parallel groups", async () => {
        fetchSpy.mockResolvedValueOnce(mockFetchResponse(MOCK_OLLAMA_RESPONSE));

        const task = createTask();
        await room.acceptTask(task);

        expect(task.status).toBe(TaskStatus.COMPLETED);

        const output = task.output as Record<string, unknown>;
        expect(output.status).toBe("completed");

        const plan = output.executionPlan as typeof MOCK_EXECUTION_PLAN;
        expect(plan.tasks).toHaveLength(3);
        expect(plan.parallelGroups).toHaveLength(2);
        expect(plan.parallelGroups[0]).toContain("task-1");
        expect(plan.parallelGroups[0]).toContain("task-2");
        expect(plan.parallelGroups[1]).toContain("task-3");
        expect(plan.totalEstimatedTokens).toBe(7500);

        // Task-3 depends on task-1 and task-2
        const menuTask = plan.tasks.find((t) => t.id === "task-3");
        expect(menuTask?.dependsOn).toContain("task-1");
        expect(menuTask?.dependsOn).toContain("task-2");
        expect(menuTask?.acceptanceCriteria).toHaveLength(2);
    });

    it("includes brief and brainstorm context in LLM prompt", async () => {
        fetchSpy.mockResolvedValueOnce(mockFetchResponse(MOCK_OLLAMA_RESPONSE));

        const task = createTask({
            input: {
                briefReport: { summary: "Restaurant brand kit needed" },
                brainstormReport: { ideas: ["Modern Italian theme"] },
                costEstimate: { totalBudgetUsd: 5.0 },
            },
        });

        await room.acceptTask(task);

        const [, init] = fetchSpy.mock.calls[0];
        const body = JSON.parse(init.body);
        const userMessage = body.messages.find(
            (m: { role: string }) => m.role === "user"
        );
        expect(userMessage.content).toContain("Restaurant brand kit needed");
        expect(userMessage.content).toContain("Modern Italian theme");
        expect(userMessage.content).toContain("totalBudgetUsd");
    });

    it("returns stub when LLM is unavailable", async () => {
        fetchSpy.mockRejectedValueOnce(new Error("ECONNREFUSED"));

        const task = createTask();
        await room.acceptTask(task);

        expect(task.status).toBe(TaskStatus.COMPLETED);

        const output = task.output as Record<string, unknown>;
        expect(output.status).toBe("llm_unavailable");
        expect(output.error).toContain("ECONNREFUSED");

        const plan = output.executionPlan as Record<string, unknown>;
        expect(plan.tasks).toEqual([]);
    });

    it("has correct room configuration", () => {
        expect(room.id).toBe("jobmaster");
        expect(room.name).toBe("JobMaster Room");
        expect(room.agents).toHaveLength(2);
        expect(room.agents[0].config.role).toBe("lead");
        expect(room.agents[1].config.role).toBe("scheduler");
    });
});
