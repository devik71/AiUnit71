/**
 * Mocked HTTP tests for PromptMasterAgent.
 * Tests the ephemeral per-task prompt optimizer.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PromptMasterAgent } from "../src/agents/promptmaster.js";
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
        prompt_eval_count: 80, eval_count: 150,
    };
}

function createTask(title: string, description: string): Task {
    return {
        id: `test-${Date.now()}`,
        title,
        description,
        status: TaskStatus.PENDING,
        priority: TaskPriority.NORMAL,
        input: { targetAudience: "restaurant owners" },
        dependencies: [],
        createdAt: new Date(),
    };
}

// ─── Tests ───────────────────────────────────────────────────────

describe("PromptMasterAgent", () => {
    let fetchSpy: ReturnType<typeof vi.fn>;
    let agent: PromptMasterAgent;

    beforeEach(() => {
        fetchSpy = vi.fn();
        vi.stubGlobal("fetch", fetchSpy);
        agent = new PromptMasterAgent(new CostRouter(), new MemoryStore());
    });
    afterEach(() => vi.restoreAllMocks());

    it("optimizes a prompt and returns structured result", async () => {
        const optimization = {
            optimizedPrompt: "Create a modern, warm-toned logo for an Italian restaurant. Requirements:\n1. Use earthy colors\n2. Include subtle Italian motifs\n3. Output as SVG",
            promptStrategy: "Added structure, format, and niche context",
            outputFormat: "json",
            suggestedTemperature: 0.6,
            suggestedMaxTokens: 2048,
            qualityCriteria: ["Brand consistency", "Niche relevance", "Modern aesthetics"],
        };
        fetchSpy.mockResolvedValueOnce(mockFetchResponse(ollamaResponse(optimization)));

        const task = createTask("Create Logo", "Make a logo for an Italian restaurant");
        const result = await agent.optimizePrompt(task, "image-gen", "You are an image generation specialist");

        expect(result.status).toBe("optimized");
        expect(result.optimizedPrompt).toContain("Italian restaurant");
        expect(result.outputFormat).toBe("json");
        expect(result.suggestedTemperature).toBe(0.6);
        expect(result.qualityCriteria).toHaveLength(3);
        expect(result.model).toBe("llama3.2:3b");
    });

    it("handles non-JSON LLM response as raw optimized prompt", async () => {
        const rawContent = "Create a professional logo with warm Italian tones, include tomato and basil motifs";
        fetchSpy.mockResolvedValueOnce(mockFetchResponse({
            model: "llama3.2:3b",
            message: { role: "assistant", content: rawContent },
            done: true, done_reason: "stop",
            prompt_eval_count: 50, eval_count: 80,
        }));

        const task = createTask("Create Logo", "Logo for restaurant");
        const result = await agent.optimizePrompt(task, "image-gen");

        expect(result.status).toBe("optimized_raw");
        expect(result.optimizedPrompt).toBe(rawContent);
        expect(result.promptStrategy).toBe("raw_llm_output");
    });

    it("falls back to raw task description when LLM is unavailable", async () => {
        fetchSpy.mockRejectedValueOnce(new Error("ECONNREFUSED"));

        const task = createTask("Create Logo", "Make a logo for a pizzeria");
        const result = await agent.optimizePrompt(task, "image-gen");

        expect(result.status).toBe("fallback");
        expect(result.optimizedPrompt).toBe("Make a logo for a pizzeria");
        expect(result.promptStrategy).toBe("passthrough");
        expect(result.error).toContain("ECONNREFUSED");
    });

    it("has correct static agent config", () => {
        const config = PromptMasterAgent.AGENT_CONFIG;
        expect(config.id).toBe("promptmaster");
        expect(config.role).toBe("promptmaster");
        expect(config.canTeleport).toBe(false); // ephemeral, no teleporting
        expect(config.capabilities).toContain("text-generation");
    });
});
