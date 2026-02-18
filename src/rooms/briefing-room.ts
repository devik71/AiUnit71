import type { RoomConfig, Task, CostRecord } from "../core/types.js";
import { AutonomyLevel } from "../core/types.js";
import { BaseRoom } from "./base-room.js";
import type { MemoryStore } from "../memory/memory-store.js";
import type { CostRouter } from "../cost/router.js";
import { LlmClient } from "../llm/llm-client.js";
import type { ChatMessage } from "../llm/llm-client.js";
import { eventBus } from "../core/event-bus.js";

const CONFIG: RoomConfig = {
    id: "briefing",
    name: "Briefing Room",
    description:
        "Entry point of the production pipeline. Analyzes client briefs, decomposes tasks, identifies required rooms and agents, and prepares structured output for the BrainStorm phase.",
    capabilities: ["text-generation", "analysis"],
    defaultAgents: [
        {
            id: "brief-master",
            name: "BriefMaster",
            role: "lead",
            systemPrompt: `You are BriefMaster — the entry-point analyst of AiUnit71 production pipeline.

Your job is to analyze client briefs and produce a structured decomposition.

Given a client brief, you MUST return valid JSON with this exact structure:
{
  "summary": "One-paragraph executive summary of the brief",
  "tasks": [
    {
      "title": "Task title",
      "description": "What needs to be done",
      "room": "target room id (e.g. brainstorm, copywriting, image-gen, video, etc.)",
      "priority": "normal | high | critical"
    }
  ],
  "requiredRooms": ["list", "of", "room", "ids"],
  "requiredAgents": ["list of agent roles needed beyond defaults"],
  "brainstormPrompt": "A detailed prompt for the BrainStorm phase that captures the core creative challenge",
  "nicheInsights": "Relevant niche-specific observations if niche context is provided",
  "estimatedComplexity": "low | medium | high"
}

Be thorough but concise. Focus on actionable decomposition.`,
            capabilities: ["text-generation", "analysis"],
            canTeleport: true,
        },
        {
            id: "brief-analyst",
            name: "BriefAnalyst",
            role: "analyst",
            systemPrompt:
                "You are a Brief Analyst. You validate brief completeness, check feasibility, identify missing information, and flag potential risks. You ensure nothing falls through the cracks before work begins.",
            capabilities: ["text-generation", "analysis"],
            canTeleport: false,
        },
    ],
    tools: [],
    memoryPath: "./memory/briefing",
    maxConcurrentTasks: 3,
    autonomyLevel: AutonomyLevel.SUPERVISED,
};

export class BriefingRoom extends BaseRoom {
    private llm: LlmClient;

    constructor(memory: MemoryStore, costRouter: CostRouter) {
        super(CONFIG, memory, costRouter);
        this.llm = new LlmClient();
    }

    protected async processTask(task: Task): Promise<Record<string, unknown>> {
        const route = this.routeModel({
            capabilities: ["text-generation", "analysis"],
            inputTokens: 1500,
            outputTokens: 3000,
            preferLocal: true,
            minQuality: 50,
        });

        this.memory.add(this.id, {
            roomId: this.id,
            taskId: task.id,
            type: "context",
            content: `Briefing analysis started: ${task.description}. Using ${route.selected.model} (${route.reasoning})`,
            metadata: { model: route.selected.model, cost: route.estimate.estimatedCostUsd },
        });

        // Build context from niche profile if available
        const nicheContext = task.input?.nicheProfile
            ? `\n\nClient Niche Context:\n${JSON.stringify(task.input.nicheProfile, null, 2)}`
            : "";

        const serviceContext = task.input?.servicePackage
            ? `\n\nSelected Service Package:\n${JSON.stringify(task.input.servicePackage, null, 2)}`
            : "";

        // Build messages for BriefMaster agent
        const agent = this.state.agents.find((a) => a.config.role === "lead");
        const systemPrompt = agent?.config.systemPrompt ?? CONFIG.defaultAgents[0].systemPrompt;
        const contextHistory = this.memory.getContextForAgent(this.id, 10);

        const messages: ChatMessage[] = [
            { role: "system", content: systemPrompt },
            {
                role: "user",
                content: [
                    `Client Brief: ${task.title}`,
                    `Description: ${task.description}`,
                    nicheContext,
                    serviceContext,
                    "",
                    "Previous context:",
                    contextHistory,
                    "",
                    "Analyze this brief and return the structured JSON decomposition as specified in your instructions.",
                    "Return ONLY valid JSON, no markdown fences, no explanation.",
                ].join("\n"),
            },
        ];

        try {
            const response = await this.llm.chat({
                model: route.selected.model,
                messages,
                temperature: 0.3, // Lower temperature for structured analysis
                maxTokens: 4096,
            });

            // Record actual cost
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

            // Try to parse structured output
            let briefReport: Record<string, unknown>;
            try {
                briefReport = JSON.parse(response.content);
            } catch {
                // If LLM didn't return valid JSON, wrap the raw response
                briefReport = {
                    summary: response.content,
                    tasks: [],
                    requiredRooms: [],
                    requiredAgents: [],
                    brainstormPrompt: task.description,
                    nicheInsights: null,
                    estimatedComplexity: "medium",
                    parseWarning: "LLM response was not valid JSON, raw content preserved in summary",
                };
            }

            this.memory.add(this.id, {
                roomId: this.id,
                taskId: task.id,
                agentId: agent?.config.id,
                type: "experience",
                content: `Brief analysis completed. Model: ${response.model}. Tasks identified: ${Array.isArray(briefReport.tasks) ? (briefReport.tasks as unknown[]).length : 0
                    }. Rooms: ${Array.isArray(briefReport.requiredRooms) ? (briefReport.requiredRooms as string[]).join(", ") : "none"
                    }`,
                metadata: {
                    model: response.model,
                    inputTokens: response.usage.inputTokens,
                    outputTokens: response.usage.outputTokens,
                    latencyMs: response.latencyMs,
                    tasksCount: Array.isArray(briefReport.tasks) ? (briefReport.tasks as unknown[]).length : 0,
                },
            });

            return {
                briefReport,
                model: response.model,
                usage: response.usage,
                latencyMs: response.latencyMs,
                costEstimate: route.estimate,
                status: "completed",
            };
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            this.log.warn(`LLM call failed, returning stub: ${errMsg}`);

            // Graceful fallback: return stub output if LLM is unreachable
            return {
                briefReport: {
                    summary: task.description,
                    tasks: [],
                    requiredRooms: [],
                    requiredAgents: [],
                    brainstormPrompt: task.description,
                    nicheInsights: null,
                    estimatedComplexity: "unknown",
                },
                model: route.selected.model,
                costEstimate: route.estimate,
                status: "llm_unavailable",
                error: errMsg,
            };
        }
    }
}
