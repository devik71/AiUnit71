import type { RoomConfig, Task } from "../core/types.js";
import { AutonomyLevel } from "../core/types.js";
import { BaseRoom } from "./base-room.js";
import type { MemoryStore } from "../memory/memory-store.js";
import type { CostRouter } from "../cost/router.js";

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
  constructor(memory: MemoryStore, costRouter: CostRouter) {
    super(CONFIG, memory, costRouter);
  }

  protected async processTask(task: Task): Promise<Record<string, unknown>> {
    const route = this.routeModel({
      capabilities: ["code-generation"],
      inputTokens: 4000,
      outputTokens: 8000,
      preferLocal: true,
      minQuality: 70,
    });

    return {
      codeOutput: null,
      deployUrl: null,
      skillMarkdown: null,
      model: route.selected.model,
      costEstimate: route.estimate,
      status: "ready_for_code_execution",
    };
  }
}
