import { logger } from "../core/logger.js";

// ─── Types ──────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Override: "ollama" | "openrouter" | "openai" | "anthropic" | "google" */
  provider?: string;
  tools?: Array<{
    type: "function";
    function: {
      name: string;
      description?: string;
      parameters: Record<string, unknown>;
    };
  }>;
}

export interface ChatResponse {
  content: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  finishReason: string;
  latencyMs: number;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string; // JSON string
    };
  }>;
}

export interface LlmClientConfig {
  ollamaBaseUrl?: string;
  openrouterBaseUrl?: string;
  openrouterApiKey?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

// ─── Client ─────────────────────────────────────────────────────────

/**
 * LlmClient — unified HTTP client for Ollama (local) and OpenRouter (cloud).
 *
 * Uses Node.js native `fetch`. No additional dependencies.
 * Handles timeouts, 1 retry on 5xx, and response normalization.
 */
export class LlmClient {
  private ollamaBase: string;
  private openrouterBase: string;
  private openrouterKey: string;
  private timeoutMs: number;
  private maxRetries: number;

  constructor(config: LlmClientConfig = {}) {
    this.ollamaBase = config.ollamaBaseUrl
      ?? process.env.OLLAMA_BASE_URL
      ?? "http://localhost:11434";
    this.openrouterBase = config.openrouterBaseUrl
      ?? "https://openrouter.ai/api/v1";
    this.openrouterKey = config.openrouterApiKey
      ?? process.env.OPENROUTER_API_KEY
      ?? "";
    this.timeoutMs = config.timeoutMs ?? 60_000;
    this.maxRetries = config.maxRetries ?? 1;
  }

  // ─── Public API ─────────────────────────────────────────────────

  /**
   * Send a chat completion request.
   * Automatically routes to Ollama or OpenRouter based on provider type.
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const providerType = this.resolveProvider(request);
    const start = Date.now();

    logger.debug(`LLM request: ${request.model} via ${providerType}`, {
      messageCount: request.messages.length,
    });

    let response: ChatResponse;

    switch (providerType) {
      case "ollama":
        response = await this.callOllama(request, start);
        break;
      case "openrouter":
      case "openai":
      case "anthropic":
      case "google":
        response = await this.callOpenRouter(request, start);
        break;
      default:
        response = await this.callOpenRouter(request, start);
    }

    logger.info(`LLM response: ${response.model}`, {
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      latencyMs: response.latencyMs,
    });

    return response;
  }

  /**
   * Quick check if Ollama is running locally.
   */
  async isOllamaAvailable(): Promise<boolean> {
    try {
      const resp = await fetch(`${this.ollamaBase}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  // ─── Ollama Backend ─────────────────────────────────────────────

  private async callOllama(
    request: ChatRequest,
    startTime: number
  ): Promise<ChatResponse> {
    const body: Record<string, any> = {
      model: request.model,
      messages: request.messages,
      stream: false,
      options: {
        temperature: request.temperature ?? 0.7,
        num_predict: request.maxTokens ?? 4096,
      },
    };

    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools;
    }

    const raw = await this.fetchWithRetry(
      `${this.ollamaBase}/api/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const data = await raw.json() as Record<string, any>;
    const latencyMs = Date.now() - startTime;

    const toolCalls = data.message?.tool_calls?.map((tc: any, i: number) => ({
      id: `call_${i}`,
      type: "function",
      function: {
        name: tc.function.name,
        arguments: JSON.stringify(tc.function.arguments),
      }
    }));

    return {
      content: data.message?.content ?? "",
      model: data.model ?? request.model,
      usage: {
        inputTokens: data.prompt_eval_count ?? 0,
        outputTokens: data.eval_count ?? 0,
        totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
      },
      finishReason: data.done_reason ?? "stop",
      latencyMs,
      tool_calls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  // ─── OpenRouter Backend ─────────────────────────────────────────

  private async callOpenRouter(
    request: ChatRequest,
    startTime: number
  ): Promise<ChatResponse> {
    if (!this.openrouterKey) {
      throw new Error(
        "OPENROUTER_API_KEY not set. Configure it in .env or pass via config."
      );
    }

    const body: Record<string, any> = {
      model: request.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 4096,
    };

    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools;
    }

    const raw = await this.fetchWithRetry(
      `${this.openrouterBase}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.openrouterKey}`,
          "HTTP-Referer": "https://aiunit71.dev",
          "X-Title": "AiUnit71",
        },
        body: JSON.stringify(body),
      }
    );

    const data = await raw.json() as Record<string, any>;
    const latencyMs = Date.now() - startTime;

    const choice = data.choices?.[0];
    const usage = data.usage ?? {};

    const toolCalls = choice?.message?.tool_calls?.map((tc: any) => ({
      id: tc.id,
      type: "function",
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments,
      }
    }));

    return {
      content: choice?.message?.content ?? "",
      model: data.model ?? request.model,
      usage: {
        inputTokens: usage.prompt_tokens ?? 0,
        outputTokens: usage.completion_tokens ?? 0,
        totalTokens: usage.total_tokens ?? 0,
      },
      finishReason: choice?.finish_reason ?? "stop",
      latencyMs,
      tool_calls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────

  private resolveProvider(request: ChatRequest): string {
    if (request.provider) return request.provider;

    // Heuristic: local Ollama model names don't have a "/" prefix like "anthropic/claude-..."
    // Simple check: if model contains "/" it's likely an OpenRouter cloud model
    const model = request.model;
    if (
      model.includes("/") &&
      !model.startsWith("http")
    ) {
      return "openrouter";
    }

    return "ollama";
  }

  private async fetchWithRetry(
    url: string,
    init: RequestInit,
    attempt = 0
  ): Promise<Response> {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        const status = response.status;

        // Retry on 5xx server errors
        if (status >= 500 && attempt < this.maxRetries) {
          logger.warn(`LLM request failed (${status}), retrying...`, { url, attempt });
          const backoff = Math.min(1000 * 2 ** attempt, 5000);
          await new Promise((r) => setTimeout(r, backoff));
          return this.fetchWithRetry(url, init, attempt + 1);
        }

        const errorBody = await response.text().catch(() => "");
        throw new Error(
          `LLM API error ${status}: ${errorBody.slice(0, 200)}`
        );
      }

      return response;
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new Error(
          `LLM request timed out after ${this.timeoutMs}ms (${url})`
        );
      }
      throw error;
    }
  }
}
