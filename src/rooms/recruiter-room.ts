import { v4 as uuid } from "uuid";
import type { RoomConfig, Task, CostRecord, AgentConfig } from "../core/types.js";
import { AutonomyLevel } from "../core/types.js";
import { BaseRoom } from "./base-room.js";
import type { MemoryStore } from "../memory/memory-store.js";
import type { CostRouter } from "../cost/router.js";
import { LlmClient } from "../llm/llm-client.js";
import type { ChatMessage } from "../llm/llm-client.js";
import { SkillMaster } from "../agents/skillmaster.js";
import { eventBus } from "../core/event-bus.js";

const DEFAULT_SKILLS_DIR = "./skills";

const CONFIG: RoomConfig = {
    id: "recruiter",
    name: "Agent Recruiter Room",
    description:
        "Creates new specialist agents and rooms dynamically based on client needs. Identifies required skills, checks existing agents, and recruits or upskills as needed.",
    capabilities: ["text-generation", "analysis"],
    defaultAgents: [
        {
            id: "recruiter",
            name: "Agent Recruiter",
            role: "recruiter",
            systemPrompt: `You are the Agent Recruiter. Your job:
1. Analyze client requirements to identify needed skills and capabilities
2. Search the skill catalog for matching skills
3. Determine if existing agents can handle the task (possibly after upskilling)
4. Create new specialist agent configurations when needed
5. Recommend room assignments for new agents

When creating agents, give them specific names, roles, and system prompts tailored to their specialty.
Output your analysis as JSON with fields: agentName, agentRole, systemPrompt, neededSkills[], recommendedRoom.`,
            capabilities: ["text-generation", "analysis"],
            canTeleport: false,
        },
    ],
    tools: [],
    memoryPath: "./memory/recruiter",
    maxConcurrentTasks: 3,
    autonomyLevel: AutonomyLevel.SUPERVISED,
};

export class RecruiterRoom extends BaseRoom {
    private llm: LlmClient;
    private skillMaster: SkillMaster;

    constructor(memory: MemoryStore, costRouter: CostRouter, skillsDir?: string) {
        super(CONFIG, memory, costRouter);
        this.llm = new LlmClient();
        this.skillMaster = new SkillMaster(skillsDir ?? DEFAULT_SKILLS_DIR);
    }

    protected async processTask(task: Task): Promise<Record<string, unknown>> {
        // Step 1: Find relevant skills for the request
        const relevantSkills = await this.skillMaster.findSkillsForTask(
            task.description
        );

        const skillSummary = relevantSkills.length > 0
            ? relevantSkills
                .slice(0, 5)
                .map(
                    (s) =>
                        `- ${s.displayName} (${s.owner}/${s.slug}) — ${s.category}: ${s.description || "No description"}`
                )
                .join("\n")
            : "No directly matching skills found in the catalog.";

        // Step 2: Use LLM to analyze and design the agent
        const route = this.routeModel({
            capabilities: ["text-generation"],
            inputTokens: 3000,
            outputTokens: 2000,
            preferLocal: true,
            minQuality: 65,
        });

        const messages: ChatMessage[] = [
            {
                role: "system",
                content: CONFIG.defaultAgents[0].systemPrompt,
            },
            {
                role: "user",
                content: [
                    `Client request: "${task.title}"`,
                    `Details: ${task.description}`,
                    "",
                    "Available matching skills in catalog:",
                    skillSummary,
                    "",
                    "Analyze this request and design a specialist agent:",
                    "1. What kind of specialist is needed?",
                    "2. What skills should they have?",
                    "3. What room should they work in?",
                    "4. Generate a detailed system prompt for the agent",
                    "",
                    `Respond as JSON: { "agentName": "...", "agentRole": "...", "systemPrompt": "...", "neededSkills": ["owner/slug", ...], "recommendedRoom": "...", "reasoning": "..." }`,
                ].join("\n"),
            },
        ];

        let recruitmentPlan: Record<string, unknown>;
        let agentConfig: AgentConfig | null = null;

        try {
            const response = await this.llm.chat({
                model: route.selected.model,
                messages,
                temperature: 0.6,
                maxTokens: 2048,
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

            // Try to parse the LLM response as JSON
            try {
                // Extract JSON from response (may be wrapped in markdown code block)
                const jsonMatch = response.content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    recruitmentPlan = JSON.parse(jsonMatch[0]);
                } else {
                    recruitmentPlan = { rawResponse: response.content };
                }
            } catch {
                recruitmentPlan = { rawResponse: response.content };
            }

            // Step 3: Create the AgentConfig from the plan
            const plan = recruitmentPlan as Record<string, string>;
            agentConfig = {
                id: `agent-${uuid().slice(0, 8)}`,
                name: plan.agentName || `Specialist-${task.id.slice(0, 4)}`,
                role: plan.agentRole || "specialist",
                systemPrompt:
                    plan.systemPrompt ||
                    `You are a specialist agent created for: ${task.description}`,
                capabilities: ["text-generation"],
                skills: relevantSkills.slice(0, 3).map((s) => ({
                    owner: s.owner,
                    slug: s.slug,
                    displayName: s.displayName,
                    acquiredAt: new Date(),
                    proficiency: "novice" as const,
                })),
                canTeleport: true,
            };

            // Dispatch agent created event
            eventBus.dispatch({
                type: "agent:created",
                agentId: agentConfig.id,
                roomId: plan.recommendedRoom || this.id,
            });

            // Record in memory
            this.memory.add(this.id, {
                roomId: this.id,
                taskId: task.id,
                type: "experience",
                content: `Recruited agent: ${agentConfig.name} (${agentConfig.role}). Skills: ${agentConfig.skills?.map((s) => s.displayName).join(", ") || "none"}.`,
                metadata: { agentConfig, recruitmentPlan },
            });
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            this.log.warn(`LLM call failed, returning stub: ${errMsg}`);

            recruitmentPlan = {
                status: "llm_unavailable",
                error: errMsg,
                suggestion: "Manual agent creation required",
            };
        }

        return {
            status: agentConfig ? "agent_recruited" : "llm_unavailable",
            agentConfig,
            recruitmentPlan,
            matchedSkills: relevantSkills.slice(0, 5).map((s) => ({
                owner: s.owner,
                slug: s.slug,
                displayName: s.displayName,
                category: s.category,
            })),
            catalogSearched: true,
        };
    }
}
