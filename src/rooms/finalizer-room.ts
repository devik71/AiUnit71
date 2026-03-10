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
    id: "finalizer",
    name: "Finalizer Room",
    description:
        "Phase 6 — Final delivery. Compiles the interactive dashboard, client presentation, organized file structure, and project archive with lessons learned.",
    capabilities: ["text-generation", "analysis"],
    defaultAgents: [
        {
            id: "finalizer-lead",
            name: "FinalizerAgent",
            role: "lead",
            systemPrompt: `You are FinalizerAgent — AiUnit71's delivery specialist.

You receive the approved client report, all deliverables, and project metrics.
Your job is to compile everything into a structured final delivery package.

Return valid JSON with this exact structure:
{
  "dashboard": {
    "projectTitle": "Project name",
    "executionStats": {
      "totalDurationMs": 0,
      "totalTokensUsed": 0,
      "totalCostUsd": 0.0,
      "roomBreakdown": [
        { "room": "room-id", "tokens": 0, "costUsd": 0.0, "tasksCompleted": 0 }
      ]
    },
    "qualityMetrics": {
      "overallScore": 88,
      "passedCriteria": 12,
      "totalCriteria": 14
    },
    "timeline": [
      { "phase": "Phase name", "startedAt": "ISO date", "completedAt": "ISO date" }
    ]
  },
  "presentation": {
    "title": "Client presentation title",
    "sections": [
      { "heading": "Section heading", "content": "Section content" }
    ],
    "keyDecisions": ["From brainstorm phase"],
    "beforeAfter": []
  },
  "deliverables": [
    {
      "filename": "file.ext",
      "type": "image | document | code | video | audio",
      "description": "What this file is",
      "room": "source room"
    }
  ],
  "archive": {
    "projectId": "uuid",
    "costEstimateVsActual": { "estimated": 0.05, "actual": 0.04 },
    "lessonsLearned": ["Pattern insights for future projects"],
    "agentPerformance": [
      { "agentId": "id", "tasksCompleted": 3, "avgScore": 88 }
    ]
  }
}

Focus on making the presentation client-friendly and the archive useful for learning.`,
            capabilities: ["text-generation", "analysis"],
            canTeleport: false,
        },
    ],
    tools: [],
    memoryPath: "./memory/finalizer",
    maxConcurrentTasks: 1,
    autonomyLevel: AutonomyLevel.SUPERVISED,
};

export class FinalizerRoom extends BaseRoom {
    private llm: LlmClient;

    constructor(memory: MemoryStore, mcpHost: McpHost, costRouter: CostRouter) {
        super(CONFIG, memory, mcpHost, costRouter);
        this.llm = new LlmClient();
    }

    protected async processTask(task: Task): Promise<Record<string, unknown>> {
        const route = this.routeModel({
            capabilities: ["text-generation", "analysis"],
            inputTokens: 3000,
            outputTokens: 5000,
            preferLocal: true,
            minQuality: 50,
        });

        this.memory.add(this.id, {
            roomId: this.id,
            taskId: task.id,
            type: "context",
            content: `Finalization started: ${task.description}. Using ${route.selected.model} (${route.reasoning})`,
            metadata: { model: route.selected.model, cost: route.estimate.estimatedCostUsd },
        });

        const clientReport = task.input?.clientReport
            ? `\n\nApproved Client Report:\n${JSON.stringify(task.input.clientReport, null, 2)}`
            : "";

        const taskResults = task.input?.taskResults
            ? `\n\nAll Task Results:\n${JSON.stringify(task.input.taskResults, null, 2)}`
            : "";

        const projectMetrics = task.input?.projectMetrics
            ? `\n\nProject Metrics:\n${JSON.stringify(task.input.projectMetrics, null, 2)}`
            : "";

        const lessonsFromMemory = task.input?.lessonsLearned
            ? `\n\nLessons Learned:\n${JSON.stringify(task.input.lessonsLearned, null, 2)}`
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
                    clientReport,
                    taskResults,
                    projectMetrics,
                    lessonsFromMemory,
                    "",
                    "Previous context:",
                    contextHistory,
                    "",
                    "Compile the final delivery package. Return ONLY valid JSON.",
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

            let deliveryPackage: Record<string, unknown>;
            try {
                deliveryPackage = JSON.parse(response.content);
            } catch {
                deliveryPackage = {
                    dashboard: {},
                    presentation: { title: task.title, sections: [{ heading: "Summary", content: response.content }] },
                    deliverables: [],
                    archive: { lessonsLearned: [] },
                    parseWarning: "LLM response was not valid JSON",
                };
            }

            this.memory.add(this.id, {
                roomId: this.id,
                taskId: task.id,
                agentId: agent?.config.id,
                type: "experience",
                content: `Finalization completed. Deliverables: ${Array.isArray(deliveryPackage.deliverables) ? (deliveryPackage.deliverables as unknown[]).length : 0
                    }. Model: ${response.model}`,
                metadata: {
                    model: response.model,
                    inputTokens: response.usage.inputTokens,
                    outputTokens: response.usage.outputTokens,
                    latencyMs: response.latencyMs,
                },
            });

            return {
                deliveryPackage,
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
                deliveryPackage: {
                    dashboard: {},
                    presentation: { title: task.title, sections: [] },
                    deliverables: [],
                    archive: { lessonsLearned: [] },
                },
                model: route.selected.model,
                costEstimate: route.estimate,
                status: "llm_unavailable",
                error: errMsg,
            };
        }
    }
}
