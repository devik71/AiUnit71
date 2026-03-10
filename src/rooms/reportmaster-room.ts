import type { RoomConfig, Task, CostRecord } from "../core/types.js";
import { AutonomyLevel } from "../core/types.js";
import { BaseRoom } from "./base-room.js";
import type { MemoryStore } from "../memory/memory-store.js";
import type { McpHost } from "../mcp/host.js";

import type { CostRouter } from "../cost/router.js";
import { LlmClient } from "../llm/llm-client.js";
import type { ChatMessage } from "../llm/llm-client.js";
import { eventBus } from "../core/event-bus.js";

const CONFIG: RoomConfig = {
    id: "reportmaster",
    name: "ReportMaster Room",
    description:
        "Phase 5 — Quality control and reporting. Aggregates results from all rooms, runs final evaluation, generates client-facing reports, and manages reiteration logic for failed quality gates.",
    capabilities: ["text-generation", "analysis"],
    defaultAgents: [
        {
            id: "reportmaster-lead",
            name: "ReportMaster",
            role: "lead",
            systemPrompt: `You are ReportMaster — AiUnit71's final quality controller and report generator.

You receive all task results, evaluation metrics, and the original brief.
Your job is to compile an executive client report and make a final quality verdict.

Return valid JSON with this exact structure:
{
  "qualityVerdict": "approved | needs_reiteration | rejected",
  "qualityScore": 88,
  "clientReport": {
    "title": "Project title",
    "executiveSummary": "What was accomplished",
    "deliverables": [
      {
        "name": "Deliverable name",
        "description": "What it is",
        "status": "completed | partial | failed",
        "qualityScore": 90
      }
    ],
    "highlights": ["Key achievements"],
    "timeline": "Execution duration and phases",
    "costSummary": {
      "estimated": 0.05,
      "actual": 0.04,
      "savings": "20%"
    }
  },
  "reiterationItems": [
    {
      "taskId": "task-id",
      "reason": "Why this needs rework",
      "suggestedChanges": "What to change",
      "targetRoom": "room-id"
    }
  ],
  "lessonsLearned": ["Insights for future projects"]
}

Be thorough and client-friendly in the report. Technical details should be minimal.`,
            capabilities: ["text-generation", "analysis"],
            canTeleport: true,
        },
        {
            id: "reportmaster-reviewer",
            name: "QualityReviewer",
            role: "reviewer",
            systemPrompt:
                "You are a Quality Reviewer. You double-check the ReportMaster's assessment, verify all deliverables are accounted for, and ensure nothing was missed.",
            capabilities: ["text-generation", "analysis"],
            canTeleport: false,
        },
    ],
    tools: [],
    memoryPath: "./memory/reportmaster",
    maxConcurrentTasks: 2,
    autonomyLevel: AutonomyLevel.SUPERVISED,
};

export class ReportMasterRoom extends BaseRoom {
    private llm: LlmClient;

    constructor(memory: MemoryStore, mcpHost: McpHost, costRouter: CostRouter) {
        super(CONFIG, memory, mcpHost, costRouter);
        this.llm = new LlmClient();
    }

    protected async processTask(task: Task): Promise<Record<string, unknown>> {
        const route = this.routeModel({
            capabilities: ["text-generation", "analysis"],
            inputTokens: 3000,
            outputTokens: 4000,
            preferLocal: true,
            minQuality: 60,
        });

        this.memory.add(this.id, {
            roomId: this.id,
            taskId: task.id,
            type: "context",
            content: `Report generation started: ${task.description}. Using ${route.selected.model} (${route.reasoning})`,
            metadata: { model: route.selected.model, cost: route.estimate.estimatedCostUsd },
        });

        const taskResults = task.input?.taskResults
            ? `\n\nAll Task Results:\n${JSON.stringify(task.input.taskResults, null, 2)}`
            : "";

        const evaluationMetrics = task.input?.evaluationMetrics
            ? `\n\nEvaluation Metrics:\n${JSON.stringify(task.input.evaluationMetrics, null, 2)}`
            : "";

        const briefReport = task.input?.briefReport
            ? `\n\nOriginal Brief:\n${JSON.stringify(task.input.briefReport, null, 2)}`
            : "";

        const costData = task.input?.costData
            ? `\n\nCost Data:\n${JSON.stringify(task.input.costData, null, 2)}`
            : "";

        const agent = this.state.agents.find((a) => a.config.role === "lead");
        const systemPrompt = agent?.config.systemPrompt ?? CONFIG.defaultAgents[0].systemPrompt;
        const contextHistory = this.memory.getContextForAgent(this.id, 10);

        const messages: ChatMessage[] = [
            { role: "system", content: systemPrompt },
            {
                role: "user",
                content: [
                    `Project: ${task.title}`,
                    `Description: ${task.description}`,
                    taskResults,
                    evaluationMetrics,
                    briefReport,
                    costData,
                    "",
                    "Previous context:",
                    contextHistory,
                    "",
                    "Generate the final quality report. Return ONLY valid JSON.",
                ].join("\n"),
            },
        ];

        try {
            const response = await this.runWithTools(this.llm, {
                model: route.selected.model,
                messages,
                temperature: 0.7,
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

            let report: Record<string, unknown>;
            try {
                report = JSON.parse(response.content);
            } catch {
                report = {
                    qualityVerdict: "needs_reiteration",
                    qualityScore: 0,
                    clientReport: { executiveSummary: response.content },
                    reiterationItems: [],
                    lessonsLearned: [],
                    parseWarning: "LLM response was not valid JSON",
                };
            }

            this.memory.add(this.id, {
                roomId: this.id,
                taskId: task.id,
                agentId: agent?.config.id,
                type: "experience",
                content: `Report completed. Verdict: ${report.qualityVerdict ?? "unknown"}. Score: ${report.qualityScore ?? "N/A"}`,
                metadata: {
                    model: response.model,
                    verdict: report.qualityVerdict,
                    score: report.qualityScore,
                    latencyMs: response.latencyMs,
                },
            });

            return {
                report,
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
                report: {
                    qualityVerdict: "needs_reiteration",
                    qualityScore: 0,
                    clientReport: { executiveSummary: "Report generation failed — LLM unavailable" },
                    reiterationItems: [],
                    lessonsLearned: [],
                },
                model: route.selected.model,
                costEstimate: route.estimate,
                status: "llm_unavailable",
                error: errMsg,
            };
        }
    }
}
