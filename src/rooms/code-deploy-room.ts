import type { RoomConfig, Task, CostRecord } from "../core/types.js";
import { AutonomyLevel } from "../core/types.js";
import { BaseRoom } from "./base-room.js";
import type { MemoryStore } from "../memory/memory-store.js";
import type { CostRouter } from "../cost/router.js";
import { LlmClient } from "../llm/llm-client.js";
import type { ChatMessage } from "../llm/llm-client.js";
import { eventBus } from "../core/event-bus.js";

const CONFIG: RoomConfig = {
  id: "code-deploy",
  name: "Code & Deployment Room",
  description:
    "Code generation, Vercel deployments, Next.js apps, OpenClaw skill generation, API integrations.",
  capabilities: ["code-generation"],
  defaultAgents: [
    {
      id: "senior-dev",
      name: "Senior Developer",
      role: "developer",
      systemPrompt:
        "You are a senior full-stack developer. Write production-ready TypeScript/Python code. Follow best practices, handle errors, write tests. Deploy to Vercel when requested.",
      capabilities: ["code-generation", "text-generation"],
      canTeleport: true,
    },
    {
      id: "devops-engineer",
      name: "DevOps Engineer",
      role: "devops",
      systemPrompt:
        "You are a DevOps engineer. Handle deployments, CI/CD, infrastructure. Ensure security and performance.",
      capabilities: ["code-generation"],
      canTeleport: false,
    },
  ],
  tools: [
    { id: "vercel-deploy", name: "Vercel Deploy", description: "Deploy to Vercel", type: "api" },
    { id: "skill-gen", name: "OpenClaw Skill Generator", description: "Generate OpenClaw Markdown skills", type: "local" },
  ],
  memoryPath: "./memory/code-deploy",
  maxConcurrentTasks: 5,
  autonomyLevel: AutonomyLevel.SUPERVISED,
};

export class CodeDeployRoom extends BaseRoom {
  private llm: LlmClient;

  constructor(memory: MemoryStore, costRouter: CostRouter) {
    super(CONFIG, memory, costRouter);
    this.llm = new LlmClient();
  }

  protected async processTask(task: Task): Promise<Record<string, unknown>> {
    const route = this.routeModel({
      capabilities: ["code-generation"],
      inputTokens: 4000,
      outputTokens: 8000,
      preferLocal: true,
      minQuality: 70,
    });

    const agent = this.state.agents.find((a) => a.config.role === "developer");
    const systemPrompt = agent?.config.systemPrompt ?? CONFIG.defaultAgents[0].systemPrompt;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          `Task: ${task.title}`,
          `Description: ${task.description}`,
          "",
          "Generate production-ready code:",
          "1. Implementation with full error handling",
          "2. TypeScript types/interfaces where applicable",
          "3. Basic test cases",
          "4. Deployment configuration if requested",
          "5. README or usage documentation",
        ].join("\n"),
      },
    ];

    try {
      const response = await this.llm.chat({
        model: route.selected.model,
        messages,
        temperature: 0.4,
        maxTokens: 8000,
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

      return {
        codeOutput: response.content,
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
        codeOutput: null,
        deployUrl: null,
        model: route.selected.model,
        costEstimate: route.estimate,
        status: "llm_unavailable",
        error: errMsg,
      };
    }
  }
}
