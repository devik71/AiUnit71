import type { RoomConfig, Task, CostRecord } from "../core/types.js";
import { AutonomyLevel } from "../core/types.js";
import { BaseRoom } from "./base-room.js";
import type { MemoryStore } from "../memory/memory-store.js";
import type { CostRouter } from "../cost/router.js";
import { LlmClient } from "../llm/llm-client.js";
import type { ChatMessage } from "../llm/llm-client.js";
import { eventBus } from "../core/event-bus.js";

const CONFIG: RoomConfig = {
    id: "jobmaster",
    name: "JobMaster Room",
    description:
        "Phase 3 of the pipeline. Receives BriefReport and CostEstimate, decomposes work into concrete tasks with dependencies, parallel groups, deadlines, and acceptance criteria.",
    capabilities: ["text-generation", "analysis"],
    defaultAgents: [
        {
            id: "jobmaster-lead",
            name: "JobMaster",
            role: "lead",
            systemPrompt: `You are JobMaster — the task distribution engine of AiUnit71.

You receive a BriefReport (from Phase 1) and optionally a CostEstimate (from Phase 2.5).
Your job is to create a concrete execution plan with individual tasks.

Return valid JSON with this exact structure:
{
  "tasks": [
    {
      "id": "task-1",
      "title": "Task title",
      "description": "Detailed description of what needs to be done",
      "assignedRoom": "room-id (e.g. image-gen, copywriting, video, ux-ui, etc.)",
      "priority": "normal | high | critical",
      "estimatedTokens": 2000,
      "dependsOn": [],
      "acceptanceCriteria": ["Criterion 1", "Criterion 2"],
      "deliverables": ["file1.png", "file2.pdf"]
    }
  ],
  "parallelGroups": [
    ["task-1", "task-2"],
    ["task-3"]
  ],
  "executionOrder": "Description of the optimal execution sequence",
  "totalEstimatedTokens": 15000,
  "warnings": ["Any risks or blockers identified"]
}

Rules:
- Tasks that can run simultaneously should be in the same parallel group
- Tasks with dependencies must be in later parallel groups
- Each task must have clear acceptance criteria
- Keep task granularity balanced — not too broad, not too micro`,
            capabilities: ["text-generation", "analysis"],
            canTeleport: true,
        },
        {
            id: "jobmaster-scheduler",
            name: "Scheduler",
            role: "scheduler",
            systemPrompt:
                "You are a task scheduler. You optimize execution order, identify bottlenecks, and ensure efficient resource utilization across rooms.",
            capabilities: ["text-generation", "analysis"],
            canTeleport: false,
        },
    ],
    tools: [],
    memoryPath: "./memory/jobmaster",
    maxConcurrentTasks: 3,
    autonomyLevel: AutonomyLevel.SUPERVISED,
};

export class JobMasterRoom extends BaseRoom {
    private llm: LlmClient;

    constructor(memory: MemoryStore, costRouter: CostRouter) {
        super(CONFIG, memory, costRouter);
        this.llm = new LlmClient();
    }

    protected async processTask(task: Task): Promise<Record<string, unknown>> {
        const route = this.routeModel({
            capabilities: ["text-generation", "analysis"],
            inputTokens: 2000,
            outputTokens: 4000,
            preferLocal: true,
            minQuality: 50,
        });

        this.memory.add(this.id, {
            roomId: this.id,
            taskId: task.id,
            type: "context",
            content: `JobMaster started: ${task.description}. Using ${route.selected.model} (${route.reasoning})`,
            metadata: { model: route.selected.model, cost: route.estimate.estimatedCostUsd },
        });

        // Build context from previous phases
        const briefReport = task.input?.briefReport
            ? `\n\nBrief Report (from Phase 1):\n${JSON.stringify(task.input.briefReport, null, 2)}`
            : "";

        const costEstimate = task.input?.costEstimate
            ? `\n\nCost Estimate (from Phase 2.5):\n${JSON.stringify(task.input.costEstimate, null, 2)}`
            : "";

        const brainstormReport = task.input?.brainstormReport
            ? `\n\nBrainstorm Report (from Phase 2):\n${JSON.stringify(task.input.brainstormReport, null, 2)}`
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
                    briefReport,
                    brainstormReport,
                    costEstimate,
                    "",
                    "Previous context:",
                    contextHistory,
                    "",
                    "Create the execution plan as specified. Return ONLY valid JSON.",
                ].join("\n"),
            },
        ];

        try {
            const response = await this.llm.chat({
                model: route.selected.model,
                messages,
                temperature: 0.2, // Low temperature for structured planning
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

            // Parse execution plan
            let executionPlan: Record<string, unknown>;
            try {
                executionPlan = JSON.parse(response.content);
            } catch {
                executionPlan = {
                    tasks: [],
                    parallelGroups: [],
                    executionOrder: response.content,
                    totalEstimatedTokens: 0,
                    warnings: ["LLM response was not valid JSON, raw content preserved in executionOrder"],
                    parseWarning: true,
                };
            }

            const taskCount = Array.isArray(executionPlan.tasks)
                ? (executionPlan.tasks as unknown[]).length
                : 0;
            const groupCount = Array.isArray(executionPlan.parallelGroups)
                ? (executionPlan.parallelGroups as unknown[]).length
                : 0;

            this.memory.add(this.id, {
                roomId: this.id,
                taskId: task.id,
                agentId: agent?.config.id,
                type: "experience",
                content: `Execution plan created. Tasks: ${taskCount}, Parallel groups: ${groupCount}. Model: ${response.model}.`,
                metadata: {
                    model: response.model,
                    inputTokens: response.usage.inputTokens,
                    outputTokens: response.usage.outputTokens,
                    latencyMs: response.latencyMs,
                    taskCount,
                    groupCount,
                },
            });

            return {
                executionPlan,
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
                executionPlan: {
                    tasks: [],
                    parallelGroups: [],
                    executionOrder: "Unable to generate — LLM unavailable",
                    totalEstimatedTokens: 0,
                    warnings: [`LLM error: ${errMsg}`],
                },
                model: route.selected.model,
                costEstimate: route.estimate,
                status: "llm_unavailable",
                error: errMsg,
            };
        }
    }
}
