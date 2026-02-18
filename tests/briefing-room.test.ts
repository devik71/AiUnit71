/**
 * Mocked HTTP tests for BriefingRoom.
 * Simulates LLM responses by mocking globalThis.fetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BriefingRoom } from "../src/rooms/briefing-room.js";
import { MemoryStore } from "../src/memory/memory-store.js";
import { CostRouter } from "../src/cost/router.js";
import { TaskStatus, TaskPriority } from "../src/core/types.js";
import type { Task } from "../src/core/types.js";

// ─── Mock Responses ──────────────────────────────────────────────

const MOCK_BRIEF_ANALYSIS = {
    summary: "Client needs a complete brand kit for a restaurant launch",
    tasks: [
        {
            title: "Logo & brand identity design",
            description: "Create a modern logo and brand color palette for the restaurant",
            room: "image-gen",
            priority: "high",
        },
        {
            title: "Menu design",
            description: "Design a 2-page menu with food photography placeholders",
            room: "ux-ui",
            priority: "normal",
        },
        {
            title: "Social media templates",
            description: "Create 5 Instagram/Facebook post templates",
            room: "image-gen",
            priority: "normal",
        },
    ],
    requiredRooms: ["brainstorm", "image-gen", "ux-ui", "copywriting"],
    requiredAgents: ["brand-designer", "menu-specialist"],
    brainstormPrompt:
        "Develop a modern, inviting brand identity for a new Italian restaurant targeting young professionals aged 25-40",
    nicheInsights: "Restaurant niche typically needs warm colors and food-focused imagery",
    estimatedComplexity: "medium",
};

const MOCK_OLLAMA_RESPONSE = {
    model: "llama3.2:3b",
    message: {
        role: "assistant",
        content: JSON.stringify(MOCK_BRIEF_ANALYSIS),
    },
    done: true,
    done_reason: "stop",
    prompt_eval_count: 150,
    eval_count: 200,
};

const MOCK_INVALID_JSON_RESPONSE = {
    model: "llama3.2:3b",
    message: {
        role: "assistant",
        content: "Here is my analysis of the brief: The client needs a restaurant brand kit including logo, menu design, and social templates.",
    },
    done: true,
    done_reason: "stop",
    prompt_eval_count: 100,
    eval_count: 50,
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
        id: "test-task-001",
        title: "Restaurant Brand Kit",
        description: "Create a complete brand kit for a new Italian restaurant",
        status: TaskStatus.PENDING,
        priority: TaskPriority.NORMAL,
        input: {},
        dependencies: [],
        createdAt: new Date(),
        ...overrides,
    };
}

// ─── Tests ───────────────────────────────────────────────────────

describe("BriefingRoom", () => {
    let fetchSpy: ReturnType<typeof vi.fn>;
    let room: BriefingRoom;

    beforeEach(() => {
        fetchSpy = vi.fn();
        vi.stubGlobal("fetch", fetchSpy);
        room = new BriefingRoom(new MemoryStore(), new CostRouter());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("analyzes a brief and returns structured output", async () => {
        fetchSpy.mockResolvedValueOnce(mockFetchResponse(MOCK_OLLAMA_RESPONSE));

        const task = createTask();
        await room.acceptTask(task);

        expect(task.status).toBe(TaskStatus.COMPLETED);
        expect(task.output).toBeDefined();

        const output = task.output as Record<string, unknown>;
        expect(output.status).toBe("completed");

        const report = output.briefReport as typeof MOCK_BRIEF_ANALYSIS;
        expect(report.summary).toContain("restaurant");
        expect(report.tasks).toHaveLength(3);
        expect(report.requiredRooms).toContain("image-gen");
        expect(report.requiredRooms).toContain("ux-ui");
        expect(report.brainstormPrompt).toBeTruthy();
        expect(report.estimatedComplexity).toBe("medium");
    });

    it("handles non-JSON LLM response gracefully", async () => {
        fetchSpy.mockResolvedValueOnce(mockFetchResponse(MOCK_INVALID_JSON_RESPONSE));

        const task = createTask();
        await room.acceptTask(task);

        expect(task.status).toBe(TaskStatus.COMPLETED);

        const output = task.output as Record<string, unknown>;
        expect(output.status).toBe("completed");

        const report = output.briefReport as Record<string, unknown>;
        // Raw content should be preserved in summary
        expect(report.summary).toContain("restaurant brand kit");
        expect(report.parseWarning).toBeTruthy();
        // Fallback should still provide empty arrays
        expect(report.tasks).toEqual([]);
        expect(report.requiredRooms).toEqual([]);
    });

    it("returns stub output when LLM is unavailable", async () => {
        fetchSpy.mockRejectedValueOnce(new Error("Connection refused"));

        const task = createTask();
        await room.acceptTask(task);

        // processTask catches the error and returns a stub
        expect(task.status).toBe(TaskStatus.COMPLETED);
        expect(task.output).toBeDefined();

        const output = task.output as Record<string, unknown>;
        expect(output.status).toBe("llm_unavailable");
        expect(output.error).toContain("Connection refused");

        const report = output.briefReport as Record<string, unknown>;
        expect(report.tasks).toEqual([]);
        expect(report.requiredRooms).toEqual([]);
    });

    it("includes niche context when provided in task input", async () => {
        fetchSpy.mockResolvedValueOnce(mockFetchResponse(MOCK_OLLAMA_RESPONSE));

        const task = createTask({
            input: {
                nicheProfile: {
                    id: "restaurant",
                    name: "Restaurant & Food",
                    description: "Local restaurants, cafes",
                },
                servicePackage: {
                    id: "rest-starter",
                    name: "Restaurant Starter Kit",
                },
            },
        });

        await room.acceptTask(task);

        // Verify the LLM was called with niche context in the prompt
        expect(fetchSpy).toHaveBeenCalledOnce();
        const [, init] = fetchSpy.mock.calls[0];
        const body = JSON.parse(init.body);
        const userMessage = body.messages.find(
            (m: { role: string }) => m.role === "user"
        );
        expect(userMessage.content).toContain("Restaurant & Food");
        expect(userMessage.content).toContain("Restaurant Starter Kit");
    });

    it("has correct room configuration", () => {
        expect(room.id).toBe("briefing");
        expect(room.name).toBe("Briefing Room");
        expect(room.agents).toHaveLength(2);
        expect(room.agents[0].config.role).toBe("lead");
        expect(room.agents[1].config.role).toBe("analyst");
    });
});
