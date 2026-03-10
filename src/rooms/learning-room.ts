import type { RoomConfig, Task, CostRecord, SkillRef } from "../core/types.js";
import { AutonomyLevel } from "../core/types.js";
import { BaseRoom } from "./base-room.js";
import type { MemoryStore } from "../memory/memory-store.js";
import type { McpHost } from "../mcp/host.js";
import type { CostRouter } from "../cost/router.js";
import { LlmClient } from "../llm/llm-client.js";
import type { ChatMessage } from "../llm/llm-client.js";
import { SkillScanner } from "../skills/skill-scanner.js";
import { SkillMaster } from "../agents/skillmaster.js";
import { eventBus } from "../core/event-bus.js";

const DEFAULT_SKILLS_DIR = "./skills";

const CONFIG: RoomConfig = {
    id: "learning",
    name: "Learning Room",
    description:
        "Agents visit this room to acquire new skills. The SkillTutor reads skill documentation, teaches the agent, and adds the skill to their profile.",
    capabilities: ["text-generation", "analysis"],
    defaultAgents: [
        {
            id: "skill-tutor",
            name: "Skill Tutor",
            role: "tutor",
            systemPrompt: `You are the Skill Tutor. When an agent visits to learn a skill:
1. Read the skill documentation carefully
2. Extract the key concepts, API endpoints, and usage patterns
3. Create a concise learning summary
4. Verify the agent understands the core concepts
5. Mark the skill as acquired with appropriate proficiency level

Always explain things clearly and provide practical examples.`,
            capabilities: ["text-generation", "analysis"],
            canTeleport: false,
        },
    ],
    tools: [],
    memoryPath: "./memory/learning",
    maxConcurrentTasks: 5,
    autonomyLevel: AutonomyLevel.GUIDED,
};

export class LearningRoom extends BaseRoom {
    private llm: LlmClient;
    private scanner: SkillScanner;
    private skillMaster: SkillMaster;
    private skillsDir: string;

    constructor(memory: MemoryStore, mcpHost: McpHost, costRouter: CostRouter, skillsDir?: string) {
        super(CONFIG, memory, mcpHost, costRouter);
        this.skillsDir = skillsDir ?? DEFAULT_SKILLS_DIR;
        this.llm = new LlmClient();
        this.scanner = new SkillScanner();
        this.skillMaster = new SkillMaster(this.skillsDir);
    }

    protected async processTask(task: Task): Promise<Record<string, unknown>> {
        // Extract skill request from task
        const requestedSkill = (task.input.skill as string) || task.description;
        const agentId = task.input.agentId as string | undefined;

        // Step 1: Find the skill
        const skills = await this.scanner.findByKeyword(this.skillsDir, requestedSkill);

        if (skills.length === 0) {
            return {
                status: "skill_not_found",
                query: requestedSkill,
                message: `No skills matching "${requestedSkill}" found in catalog of ${(await this.scanner.scanAll(this.skillsDir)).length} skills.`,
            };
        }

        const skill = skills[0]; // Best match

        // Step 2: Read the skill documentation
        const doc = this.scanner.getSkillDoc(this.skillsDir, skill.owner, skill.slug);
        const docSummary = doc
            ? doc.slice(0, 3000)
            : "Documentation not available.";

        // Step 3: Use LLM to create a learning summary
        const route = this.routeModel({
            capabilities: ["text-generation"],
            inputTokens: 4000,
            outputTokens: 2000,
            preferLocal: true,
            minQuality: 60,
        });

        const messages: ChatMessage[] = [
            {
                role: "system",
                content: CONFIG.defaultAgents[0].systemPrompt,
            },
            {
                role: "user",
                content: [
                    `Teach this skill to an agent:`,
                    "",
                    `**Skill**: ${skill.displayName} (${skill.owner}/${skill.slug})`,
                    `**Category**: ${skill.category}`,
                    `**Version**: ${skill.version}`,
                    "",
                    `**Documentation**:`,
                    docSummary,
                    "",
                    "Create a concise learning summary covering:",
                    "1. What this skill does (one paragraph)",
                    "2. Key API endpoints or functions",
                    "3. Required configuration (API keys, env vars)",
                    "4. Basic usage example",
                    "5. Common pitfalls to avoid",
                ].join("\n"),
            },
        ];

        let learningSummary: string;
        let proficiency: SkillRef["proficiency"] = "novice";

        try {
            const response = await this.runWithTools(this.llm, {
                model: route.selected.model,
                messages,
                temperature: 0.5,
                maxTokens: 2048,
            });

            learningSummary = response.content;
            proficiency = "novice"; // First time learning

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
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            learningSummary = `Stub summary: ${skill.displayName} — ${skill.description || "No description available"}`;
            this.log.warn(`LLM unavailable for teaching, using stub: ${errMsg}`);
        }

        // Step 4: Create the SkillRef
        const skillRef: SkillRef = {
            owner: skill.owner,
            slug: skill.slug,
            displayName: skill.displayName,
            acquiredAt: new Date(),
            proficiency,
        };

        // Step 5: Dispatch skill acquisition event
        if (agentId) {
            eventBus.dispatch({
                type: "agent:skill_acquired",
                agentId,
                skill: skillRef,
            });
        }

        // Step 6: Record in memory
        this.memory.add(this.id, {
            roomId: this.id,
            taskId: task.id,
            agentId,
            type: "learning",
            content: `Skill acquired: ${skill.displayName} (${skill.owner}/${skill.slug}). Proficiency: ${proficiency}.`,
            metadata: {
                skillRef,
                learningSummary: learningSummary.slice(0, 500),
            },
        });

        return {
            status: "skill_acquired",
            skill: skillRef,
            learningSummary,
            skillInfo: {
                owner: skill.owner,
                slug: skill.slug,
                displayName: skill.displayName,
                category: skill.category,
                version: skill.version,
            },
        };
    }
}
