import type { RoomConfig, Task, CostRecord } from "../core/types.js";
import { AutonomyLevel } from "../core/types.js";
import { BaseRoom } from "./base-room.js";
import type { MemoryStore } from "../memory/memory-store.js";
import type { CostRouter } from "../cost/router.js";
import { LlmClient } from "../llm/llm-client.js";
import type { ChatMessage } from "../llm/llm-client.js";
import { eventBus } from "../core/event-bus.js";

const CONFIG: RoomConfig = {
    id: "evaluation",
    name: "Evaluation Room",
    description:
        "Real-time quality assurance during Phase 4 execution. Monitors task results, evaluates against success criteria from the brief and brainstorm, assigns quality scores, and can flag early stops on critical deviations.",
    capabilities: ["text-generation", "analysis"],
    defaultAgents: [
        {
            id: "evaluation-lead",
            name: "EvaluationAgent",
            role: "lead",
            systemPrompt: `You are the EvaluationAgent — AiUnit71's real-time quality monitor.

You receive task results alongside the original brief and success criteria.
Your job is to evaluate quality, consistency, and adherence to the brief.

Return valid JSON with this exact structure:
{
  "overallScore": 85,
  "criteria": [
    {
      "name": "Criterion name",
      "score": 90,
      "maxScore": 100,
      "passed": true,
      "feedback": "Specific feedback"
    }
  ],
  "strengths": ["What was done well"],
  "issues": [
    {
      "severity": "critical | major | minor",
      "description": "What went wrong",
      "affectedTask": "task-id",
      "suggestedFix": "How to fix it"
    }
  ],
  "passedQualityGate": true,
  "recommendation": "approve | reiterate | escalate",
  "executionHandicap": 0.85,
  "summary": "Overall evaluation summary"
}

Scoring rules:
- 90-100: Excellent — exceeds expectations
- 70-89: Good — meets criteria, minor improvements possible
- 50-69: Needs work — significant issues found
- Below 50: Failed — requires reiteration

Be fair but strict. The quality gate passes at 70+.`,
            capabilities: ["text-generation", "analysis"],
            canTeleport: true,
        },
    ],
    tools: [],
    memoryPath: "./memory/evaluation",
    maxConcurrentTasks: 5,
    autonomyLevel: AutonomyLevel.GUIDED,
};

export class EvaluationRoom extends BaseRoom {
    private llm: LlmClient;

    constructor(memory: MemoryStore, costRouter: CostRouter) {
        super(CONFIG, memory, costRouter);
        this.llm = new LlmClient();
    }

    protected async processTask(task: Task): Promise<Record<string, unknown>> {
        const route = this.routeModel({
            capabilities: ["text-generation", "analysis"],
            inputTokens: 2500,
            outputTokens: 3000,
            preferLocal: true,
            minQuality: 60,
        });

        this.memory.add(this.id, {
            roomId: this.id,
            taskId: task.id,
            type: "context",
            content: `Evaluation started: ${task.description}. Using ${route.selected.model} (${route.reasoning})`,
            metadata: { model: route.selected.model, cost: route.estimate.estimatedCostUsd },
        });

        const taskResults = task.input?.taskResults
            ? `\n\nTask Results to Evaluate:\n${JSON.stringify(task.input.taskResults, null, 2)}`
            : "";

        const briefContext = task.input?.briefReport
            ? `\n\nOriginal Brief:\n${JSON.stringify(task.input.briefReport, null, 2)}`
            : "";

        const acceptanceCriteria = task.input?.acceptanceCriteria
            ? `\n\nAcceptance Criteria:\n${JSON.stringify(task.input.acceptanceCriteria, null, 2)}`
            : "";

        const agent = this.state.agents.find((a) => a.config.role === "lead");
        const systemPrompt = agent?.config.systemPrompt ?? CONFIG.defaultAgents[0].systemPrompt;
        const contextHistory = this.memory.getContextForAgent(this.id, 10);

        const messages: ChatMessage[] = [
            { role: "system", content: systemPrompt },
            {
                role: "user",
                content: [
                    `Evaluation Task: ${task.title}`,
                    `Description: ${task.description}`,
                    taskResults,
                    briefContext,
                    acceptanceCriteria,
                    "",
                    "Previous context:",
                    contextHistory,
                    "",
                    "Evaluate the results against the criteria. Return ONLY valid JSON.",
                ].join("\n"),
            },
        ];

        try {
            const response = await this.llm.chat({
                model: route.selected.model,
                messages,
                temperature: 0.2,
                maxTokens: 4096,
            });

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

            let evaluationResult: Record<string, unknown>;
            try {
                evaluationResult = JSON.parse(response.content);
            } catch {
                evaluationResult = {
                    overallScore: 0,
                    criteria: [],
                    strengths: [],
                    issues: [],
                    passedQualityGate: false,
                    recommendation: "escalate",
                    executionHandicap: 0,
                    summary: response.content,
                    parseWarning: "LLM response was not valid JSON",
                };
            }

            this.memory.add(this.id, {
                roomId: this.id,
                taskId: task.id,
                agentId: agent?.config.id,
                type: "experience",
                content: `Evaluation completed. Score: ${evaluationResult.overallScore ?? "N/A"}. Recommendation: ${evaluationResult.recommendation ?? "unknown"}`,
                metadata: {
                    model: response.model,
                    score: evaluationResult.overallScore,
                    recommendation: evaluationResult.recommendation,
                    latencyMs: response.latencyMs,
                },
            });

            return {
                evaluationResult,
                model: response.model,
                usage: response.usage,
                latencyMs: response.latencyMs,
                costEstimate: route.estimate,
                status: "completed",
            };
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            this.log.warn(`LLM call failed, returning stub: ${errMsg}`);

            return {
                evaluationResult: {
                    overallScore: 0,
                    criteria: [],
                    strengths: [],
                    issues: [{ severity: "critical", description: `Evaluation unavailable: ${errMsg}` }],
                    passedQualityGate: false,
                    recommendation: "escalate",
                    executionHandicap: 0,
                    summary: "Evaluation could not be performed — LLM unavailable",
                },
                model: route.selected.model,
                costEstimate: route.estimate,
                status: "llm_unavailable",
                error: errMsg,
            };
        }
    }
}
