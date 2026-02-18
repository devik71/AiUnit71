/**
 * Live Ollama integration tests.
 * Only runs when OLLAMA_LIVE=1 is set in environment.
 * Tests actual LLM connectivity and response parsing.
 */
import { describe, it, expect } from "vitest";
import { LlmClient } from "../src/llm/llm-client.js";

const LIVE = process.env.OLLAMA_LIVE === "1";

describe.skipIf(!LIVE)("Ollama Live Integration", () => {
    const client = new LlmClient({ timeoutMs: 30_000 });

    it("detects Ollama availability", async () => {
        const available = await client.isOllamaAvailable();
        expect(available).toBe(true);
    });

    it("solves simple arithmetic: 2+2=?", async () => {
        const response = await client.chat({
            model: "llama3.2:3b",
            messages: [
                {
                    role: "system",
                    content: "You are a math assistant. Reply with ONLY the numeric answer, nothing else.",
                },
                { role: "user", content: "What is 2+2?" },
            ],
            temperature: 0,
            maxTokens: 10,
        });

        expect(response.content).toContain("4");
        expect(response.usage.inputTokens).toBeGreaterThan(0);
        expect(response.usage.outputTokens).toBeGreaterThan(0);
        expect(response.latencyMs).toBeGreaterThan(0);
        expect(response.model).toBeTruthy();
    }, 60_000);

    it("handles multi-turn conversation", async () => {
        const response = await client.chat({
            model: "llama3.2:3b",
            messages: [
                { role: "user", content: "Remember the number 42." },
                { role: "assistant", content: "I'll remember the number 42." },
                {
                    role: "user",
                    content: "What number did I ask you to remember? Reply with ONLY the number.",
                },
            ],
            temperature: 0,
            maxTokens: 10,
        });

        expect(response.content).toContain("42");
    }, 60_000);
});
