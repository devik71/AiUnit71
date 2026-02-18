import type { RoomConfig, Task } from "../core/types.js";
import { AutonomyLevel } from "../core/types.js";
import { BaseRoom } from "./base-room.js";
import type { MemoryStore } from "../memory/memory-store.js";
import type { CostRouter } from "../cost/router.js";

const CONFIG: RoomConfig = {
    id: "hitl",
    name: "Human-in-the-Loop Room",
    description:
        "Monitoring dashboard: pending approvals, approval history, autonomy settings, and operator overrides.",
    capabilities: ["analysis"],
    defaultAgents: [
        {
            id: "hitl-monitor",
            name: "HITL Monitor",
            role: "monitor",
            systemPrompt:
                "You are the HITL monitor. Track all pending approvals, display approval history, and report room-level autonomy settings. Alert the operator when actions require attention.",
            capabilities: ["analysis", "text-generation"],
            canTeleport: false,
        },
    ],
    tools: [],
    memoryPath: "./memory/hitl",
    maxConcurrentTasks: 10,
    autonomyLevel: AutonomyLevel.FREERIDE,
};

export class HitlRoom extends BaseRoom {
    constructor(memory: MemoryStore, costRouter: CostRouter) {
        super(CONFIG, memory, costRouter);
    }

    protected async processTask(task: Task): Promise<Record<string, unknown>> {
        // The HITL room produces monitoring reports rather than creative output
        const recentMemory = this.memory.getRecent(this.id, 50);
        const approvalEvents = recentMemory.filter(
            (m) => m.type === "decision" || m.content.includes("approval")
        );

        return {
            monitoringReport: {
                pendingCount: approvalEvents.filter((e) => e.content.includes("pending")).length,
                recentDecisions: approvalEvents.slice(-10).map((e) => ({
                    timestamp: e.timestamp,
                    content: e.content,
                })),
            },
            roomAutonomyLevels: {},
            status: "monitoring_active",
        };
    }
}
