/**
 * Mocked HTTP integration tests for LlmClient.
 * Simulates Ollama and OpenRouter responses by mocking globalThis.fetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LlmClient } from "../src/llm/llm-client.js";

// ─── Mock Responses ──────────────────────────────────────────────

const MOCK_OLLAMA_RESPONSE = {
    model: "llama3.2:3b",
    message: { role: "assistant", content: "4" },
    done: true,
    done_reason: "stop",
    prompt_eval_count: 25,
    eval_count: 5,
};

const MOCK_OPENROUTER_RESPONSE = {
    id: "chatcmpl-test123",
    model: "anthropic/claude-sonnet-4",
    choices: [
        {
            index: 0,
            message: { role: "assistant", content: "The answer is 4." },
            finish_reason: "stop",
        },
    ],
    usage: {
        prompt_tokens: 30,
        completion_tokens: 10,
        total_tokens: 40,
    },
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

// ─── Tests ───────────────────────────────────────────────────────

describe("LlmClient — Mocked HTTP Integration", () => {
    let fetchSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchSpy = vi.fn();
        vi.stubGlobal("fetch", fetchSpy);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ── Ollama ────────────────────────────────────────────────────

    describe("Ollama backend", () => {
        const client = new LlmClient({ ollamaBaseUrl: "http://localhost:11434" });

        it("sends correct request format to Ollama", async () => {
            fetchSpy.mockResolvedValueOnce(mockFetchResponse(MOCK_OLLAMA_RESPONSE));

            const response = await client.chat({
                model: "llama3.2:3b",
                messages: [{ role: "user", content: "What is 2+2?" }],
            });

            expect(fetchSpy).toHaveBeenCalledOnce();
            const [url, init] = fetchSpy.mock.calls[0];
            expect(url).toBe("http://localhost:11434/api/chat");
            expect(init.method).toBe("POST");

            const body = JSON.parse(init.body);
            expect(body.model).toBe("llama3.2:3b");
            expect(body.stream).toBe(false);
            expect(body.messages).toHaveLength(1);
            expect(body.messages[0].content).toBe("What is 2+2?");
        });

        it("normalizes Ollama response correctly", async () => {
            fetchSpy.mockResolvedValueOnce(mockFetchResponse(MOCK_OLLAMA_RESPONSE));

            const response = await client.chat({
                model: "llama3.2:3b",
                messages: [{ role: "user", content: "What is 2+2?" }],
            });

            expect(response.content).toBe("4");
            expect(response.model).toBe("llama3.2:3b");
            expect(response.usage.inputTokens).toBe(25);
            expect(response.usage.outputTokens).toBe(5);
            expect(response.usage.totalTokens).toBe(30);
            expect(response.finishReason).toBe("stop");
            expect(response.latencyMs).toBeGreaterThanOrEqual(0);
        });

        it("handles empty Ollama response gracefully", async () => {
            fetchSpy.mockResolvedValueOnce(
                mockFetchResponse({ model: "llama3.2:3b", done: true })
            );

            const response = await client.chat({
                model: "llama3.2:3b",
                messages: [{ role: "user", content: "Hello" }],
            });

            expect(response.content).toBe("");
            expect(response.usage.inputTokens).toBe(0);
            expect(response.usage.outputTokens).toBe(0);
        });
    });

    // ── OpenRouter ────────────────────────────────────────────────

    describe("OpenRouter backend", () => {
        const client = new LlmClient({ openrouterApiKey: "test-key-123" });

        it("sends correct request format to OpenRouter", async () => {
            fetchSpy.mockResolvedValueOnce(
                mockFetchResponse(MOCK_OPENROUTER_RESPONSE)
            );

            await client.chat({
                model: "anthropic/claude-sonnet-4",
                messages: [{ role: "user", content: "What is 2+2?" }],
            });

            expect(fetchSpy).toHaveBeenCalledOnce();
            const [url, init] = fetchSpy.mock.calls[0];
            expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
            expect(init.headers["Authorization"]).toBe("Bearer test-key-123");
            expect(init.headers["X-Title"]).toBe("AiUnit71");

            const body = JSON.parse(init.body);
            expect(body.model).toBe("anthropic/claude-sonnet-4");
        });

        it("normalizes OpenRouter response correctly", async () => {
            fetchSpy.mockResolvedValueOnce(
                mockFetchResponse(MOCK_OPENROUTER_RESPONSE)
            );

            const response = await client.chat({
                model: "anthropic/claude-sonnet-4",
                messages: [{ role: "user", content: "What is 2+2?" }],
            });

            expect(response.content).toBe("The answer is 4.");
            expect(response.model).toBe("anthropic/claude-sonnet-4");
            expect(response.usage.inputTokens).toBe(30);
            expect(response.usage.outputTokens).toBe(10);
            expect(response.usage.totalTokens).toBe(40);
        });
    });

    // ── Error Handling ────────────────────────────────────────────

    describe("Error handling", () => {
        const client = new LlmClient({
            openrouterApiKey: "test-key",
            timeoutMs: 2000,
            maxRetries: 1,
        });

        it("retries on 5xx server error", async () => {
            fetchSpy
                .mockResolvedValueOnce(
                    mockFetchResponse({ error: "Internal Server Error" }, 500)
                )
                .mockResolvedValueOnce(mockFetchResponse(MOCK_OLLAMA_RESPONSE));

            const response = await client.chat({
                model: "llama3.2:3b",
                messages: [{ role: "user", content: "test" }],
            });

            // First call failed, retry succeeded
            expect(fetchSpy).toHaveBeenCalledTimes(2);
            expect(response.content).toBe("4");
        });

        it("throws on 4xx client error without retry", async () => {
            fetchSpy.mockResolvedValueOnce(
                mockFetchResponse({ error: "Bad Request" }, 400)
            );

            await expect(
                client.chat({
                    model: "llama3.2:3b",
                    messages: [{ role: "user", content: "test" }],
                })
            ).rejects.toThrow("LLM API error 400");

            expect(fetchSpy).toHaveBeenCalledOnce(); // No retry
        });

        it("handles timeout errors", async () => {
            fetchSpy.mockRejectedValueOnce(
                Object.assign(new Error("timeout"), { name: "TimeoutError" })
            );

            await expect(
                client.chat({
                    model: "llama3.2:3b",
                    messages: [{ role: "user", content: "test" }],
                })
            ).rejects.toThrow("timed out");
        });

        it("handles missing usage data in OpenRouter response", async () => {
            fetchSpy.mockResolvedValueOnce(
                mockFetchResponse({
                    choices: [
                        { message: { content: "response" }, finish_reason: "stop" },
                    ],
                    // No usage field
                })
            );

            const response = await client.chat({
                model: "anthropic/claude-sonnet-4",
                messages: [{ role: "user", content: "test" }],
            });

            expect(response.content).toBe("response");
            expect(response.usage.inputTokens).toBe(0);
            expect(response.usage.outputTokens).toBe(0);
        });
    });
});
