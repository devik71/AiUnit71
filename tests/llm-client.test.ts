import { describe, it, expect, beforeEach, vi } from "vitest";
import { LlmClient } from "../src/llm/llm-client.js";

describe("LlmClient", () => {
    let client: LlmClient;

    beforeEach(() => {
        client = new LlmClient({
            ollamaBaseUrl: "http://localhost:11434",
            openrouterApiKey: "test-key",
            timeoutMs: 5000,
        });
    });

    it("resolves Ollama provider for local model names", () => {
        // Access private method via any cast for testing
        const provider = (client as any).resolveProvider({
            model: "llama3.2-vision:11b",
            messages: [],
        });
        expect(provider).toBe("ollama");
    });

    it("resolves OpenRouter provider for cloud model names with /", () => {
        const provider = (client as any).resolveProvider({
            model: "anthropic/claude-sonnet-4",
            messages: [],
        });
        expect(provider).toBe("openrouter");
    });

    it("respects explicit provider override", () => {
        const provider = (client as any).resolveProvider({
            model: "some-model",
            messages: [],
            provider: "google",
        });
        expect(provider).toBe("google");
    });

    it("reports Ollama unavailable when not running", async () => {
        const offlineClient = new LlmClient({
            ollamaBaseUrl: "http://localhost:99999",
            timeoutMs: 1000,
        });
        const available = await offlineClient.isOllamaAvailable();
        expect(available).toBe(false);
    });

    it("throws on OpenRouter call without API key", async () => {
        const noKeyClient = new LlmClient({
            openrouterApiKey: "",
            timeoutMs: 1000,
        });

        await expect(
            noKeyClient.chat({
                model: "anthropic/claude-sonnet-4",
                messages: [{ role: "user", content: "test" }],
            })
        ).rejects.toThrow("OPENROUTER_API_KEY not set");
    });

    it("constructs with default config from env variables", () => {
        process.env.OLLAMA_BASE_URL = "http://custom:1234";
        process.env.OPENROUTER_API_KEY = "env-test-key";

        const envClient = new LlmClient();
        expect((envClient as any).ollamaBase).toBe("http://custom:1234");
        expect((envClient as any).openrouterKey).toBe("env-test-key");

        // Clean up
        delete process.env.OLLAMA_BASE_URL;
    });
});
