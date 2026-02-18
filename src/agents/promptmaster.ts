import { LlmClient } from "../llm/llm-client.js";
import type { ChatMessage } from "../llm/llm-client.js";
import type { AgentConfig, Task, CostRecord } from "../core/types.js";
import type { CostRouter } from "../cost/router.js";
import type { MemoryStore } from "../memory/memory-store.js";
import { eventBus } from "../core/event-bus.js";
import { logger } from "../core/logger.js";

/**
 * PromptMasterAgent — ephemeral per-task prompt optimizer.
 *
 * Created per-task during Phase 4 execution:
 * 1. Receives a raw task + its target room context
 * 2. Generates an optimized prompt via LLM
 * 3. Returns the prompt
 * 4. Annihilates (gets GC'd — no persistent state)
 *
 * Usage:
 *   const pm = new PromptMasterAgent(costRouter, memory);
 *   const optimized = await pm.optimizePrompt(task, roomId, systemPrompt);
 *   // pm is discarded after use
 */
export class PromptMasterAgent {
    private llm: LlmClient;
    private costRouter: CostRouter;
    private memory: MemoryStore;

    /** Agent config for registration when deployed inside a room */
    static readonly AGENT_CONFIG: AgentConfig = {
        id: "promptmaster",
        name: "PromptMaster",
        role: "promptmaster",
        systemPrompt: `You are PromptMaster — AiUnit71's ephemeral prompt engineering specialist.

Your ONLY job is to take a raw task description and transform it into an optimized prompt
for the target room's agent. You are created per-task and annihilated after delivery.

When optimizing a prompt:
1. Analyze the task type and target room capabilities
2. Add structure (numbered steps, sections, output format)
3. Include relevant context from memory
4. Add constraints and quality criteria
5. Specify the expected output format (JSON, markdown, etc.)
6. Keep the prompt concise but comprehensive

Return valid JSON:
{
  "optimizedPrompt": "The full optimized prompt text",
  "promptStrategy": "Brief explanation of your optimization choices",
  "outputFormat": "Expected output format (json | markdown | text | code)",
  "suggestedTemperature": 0.7,
  "suggestedMaxTokens": 4096,
  "qualityCriteria": ["Criterion 1", "Criterion 2"]
}`,
        capabilities: ["text-generation", "analysis"],
        canTeleport: false, // ephemeral — doesn't move, just spawns and dies
    };

    constructor(costRouter: CostRouter, memory: MemoryStore) {
        this.llm = new LlmClient();
        this.costRouter = costRouter;
        this.memory = memory;
    }

    /**
     * Optimize a raw task description into a structured, high-quality prompt.
     *
     * @param task - The task to optimize the prompt for
     * @param targetRoom - ID of the room that will execute the task
     * @param targetSystemPrompt - The target agent's system prompt (for context)
     * @returns Optimized prompt result, or raw fallback on failure
     */
    async optimizePrompt(
        task: Task,
        targetRoom: string,
        targetSystemPrompt?: string
    ): Promise<PromptOptimizationResult> {
        const route = this.costRouter.route({
            capabilities: ["text-generation"],
            inputTokens: 1000,
            outputTokens: 2000,
            preferLocal: true,
            minQuality: 40,
        });

        // Pull relevant context from memory
        const roomContext = this.memory.getContextForAgent(targetRoom, 5);

        const messages: ChatMessage[] = [
            { role: "system", content: PromptMasterAgent.AGENT_CONFIG.systemPrompt },
            {
                role: "user",
                content: [
                    `Target Room: ${targetRoom}`,
                    `Task Title: ${task.title}`,
                    `Task Description: ${task.description}`,
                    targetSystemPrompt ? `\nTarget Agent System Prompt:\n${targetSystemPrompt}` : "",
                    task.input ? `\nTask Input:\n${JSON.stringify(task.input, null, 2)}` : "",
                    roomContext ? `\nRoom Memory Context:\n${roomContext}` : "",
                    "",
                    "Optimize this into a high-quality prompt. Return ONLY valid JSON.",
                ].join("\n"),
            },
        ];

        try {
            const response = await this.llm.chat({
                model: route.selected.model,
                messages,
                temperature: 0.4,
                maxTokens: 2048,
            });

            // Record cost
            const costRecord: CostRecord = {
                taskId: task.id,
                model: response.model,
                provider: route.selected.provider.name,
                inputTokens: response.usage.inputTokens,
                outputTokens: response.usage.outputTokens,
                costUsd: route.estimate.estimatedCostUsd,
                timestamp: new Date(),
            };
            eventBus.dispatch({ type: "cost:recorded", record: costRecord });

            // Log to memory (before annihilation)
            this.memory.add("promptmaster", {
                roomId: targetRoom,
                taskId: task.id,
                agentId: "promptmaster",
                type: "experience",
                content: `Prompt optimized for ${targetRoom}:${task.id}. Model: ${response.model}`,
                metadata: {
                    model: response.model,
                    inputTokens: response.usage.inputTokens,
                    outputTokens: response.usage.outputTokens,
                    latencyMs: response.latencyMs,
                },
            });

            // Parse result
            try {
                const parsed = JSON.parse(response.content) as PromptOptimizationResult;
                return {
                    optimizedPrompt: parsed.optimizedPrompt ?? task.description,
                    promptStrategy: parsed.promptStrategy ?? "direct",
                    outputFormat: parsed.outputFormat ?? "text",
                    suggestedTemperature: parsed.suggestedTemperature ?? 0.7,
                    suggestedMaxTokens: parsed.suggestedMaxTokens ?? 4096,
                    qualityCriteria: parsed.qualityCriteria ?? [],
                    model: response.model,
                    latencyMs: response.latencyMs,
                    status: "optimized",
                };
            } catch {
                // LLM returned non-JSON — use raw content as the optimized prompt
                return {
                    optimizedPrompt: response.content,
                    promptStrategy: "raw_llm_output",
                    outputFormat: "text",
                    suggestedTemperature: 0.7,
                    suggestedMaxTokens: 4096,
                    qualityCriteria: [],
                    model: response.model,
                    latencyMs: response.latencyMs,
                    status: "optimized_raw",
                };
            }
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            logger.warn(`[PromptMaster] LLM unavailable, returning raw task: ${errMsg}`);

            // Graceful fallback — just return the original description
            return {
                optimizedPrompt: task.description,
                promptStrategy: "passthrough",
                outputFormat: "text",
                suggestedTemperature: 0.7,
                suggestedMaxTokens: 4096,
                qualityCriteria: [],
                status: "fallback",
                error: errMsg,
            };
        }
    }
}

/** Result of prompt optimization */
export interface PromptOptimizationResult {
    optimizedPrompt: string;
    promptStrategy: string;
    outputFormat: string;
    suggestedTemperature: number;
    suggestedMaxTokens: number;
    qualityCriteria: string[];
    model?: string;
    latencyMs?: number;
    status: "optimized" | "optimized_raw" | "fallback";
    error?: string;
}
