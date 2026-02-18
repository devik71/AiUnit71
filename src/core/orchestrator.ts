import { v4 as uuid } from "uuid";
import type {
  Task,
  TaskInput,
  AgentInstance,
  RoomConfig,
  ModelCapability,
} from "./types.js";
import { TaskStatus, TaskPriority, AutonomyLevel } from "./types.js";
import { eventBus } from "./event-bus.js";
import { logger } from "./logger.js";
import { MemoryStore } from "../memory/memory-store.js";
import { CostRouter } from "../cost/router.js";
import { Planner } from "../planner/planner.js";
import { HitlManager } from "../hitl/hitl-manager.js";
import { BaseRoom } from "../rooms/base-room.js";
import {
  BriefingRoom,
  BrainstormRoom,
  CopywritingRoom,
  ImageGenRoom,
  JobMasterRoom,
  UxUiRoom,
  AnimationRoom,
  VideoRoom,
  ThreeDRoom,
  MusicAudioRoom,
  CodeDeployRoom,
  CostRoutingRoom,
  EvaluationRoom,
  FinalizerRoom,
  HitlRoom,
} from "../rooms/index.js";
import { LearningRoom } from "../rooms/learning-room.js";
import { RecruiterRoom } from "../rooms/recruiter-room.js";
import { ReportMasterRoom } from "../rooms/reportmaster-room.js";

export interface OrchestratorConfig {
  autonomyLevel?: AutonomyLevel;
  costThreshold?: number;
  maxGlobalConcurrency?: number;
}

/**
 * AiUnit71 Orchestrator — the central nervous system.
 *
 * Manages:
 * - Room warehouse (initialization, creation, discovery)
 * - Task lifecycle (create → plan → route → execute → complete)
 * - Agent teleportation between rooms
 * - Cost tracking across all operations
 * - Human-in-the-loop approval flows
 * - Parallel creative execution
 */
export class Orchestrator {
  private rooms: Map<string, BaseRoom> = new Map();
  private tasks: Map<string, Task> = new Map();
  private memory: MemoryStore;
  private costRouter: CostRouter;
  private planner!: Planner;
  private hitl: HitlManager;
  private config: Required<OrchestratorConfig>;

  constructor(config: OrchestratorConfig = {}) {
    this.config = {
      autonomyLevel: config.autonomyLevel ?? AutonomyLevel.SUPERVISED,
      costThreshold: config.costThreshold ?? 0.10,
      maxGlobalConcurrency: config.maxGlobalConcurrency ?? 20,
    };

    this.memory = new MemoryStore();
    this.costRouter = new CostRouter();
    this.hitl = new HitlManager(this.config.autonomyLevel, this.config.costThreshold);

    this.initializeRooms();
    this.planner = new Planner(this.rooms);
    this.setupEventListeners();

    logger.info("AiUnit71 Orchestrator initialized", {
      roomCount: this.rooms.size,
      autonomy: AutonomyLevel[this.config.autonomyLevel],
    });
  }

  // ─── Room Management ───────────────────────────────────────────

  private initializeRooms(): void {
    const roomInstances: BaseRoom[] = [
      new BriefingRoom(this.memory, this.costRouter),
      new BrainstormRoom(this.memory, this.costRouter),
      new CopywritingRoom(this.memory, this.costRouter),
      new ImageGenRoom(this.memory, this.costRouter),
      new JobMasterRoom(this.memory, this.costRouter),
      new UxUiRoom(this.memory, this.costRouter),
      new AnimationRoom(this.memory, this.costRouter),
      new VideoRoom(this.memory, this.costRouter),
      new ThreeDRoom(this.memory, this.costRouter),
      new MusicAudioRoom(this.memory, this.costRouter),
      new CodeDeployRoom(this.memory, this.costRouter),
      new CostRoutingRoom(this.memory, this.costRouter),
      new EvaluationRoom(this.memory, this.costRouter),
      new FinalizerRoom(this.memory, this.costRouter),
      new HitlRoom(this.memory, this.costRouter),
      new LearningRoom(this.memory, this.costRouter),
      new RecruiterRoom(this.memory, this.costRouter),
      new ReportMasterRoom(this.memory, this.costRouter),
    ];

    for (const room of roomInstances) {
      this.rooms.set(room.id, room);
      eventBus.dispatch({ type: "room:created", roomId: room.id });
    }
  }

  /** Register a dynamically created room at runtime */
  registerRoom(room: BaseRoom): void {
    if (this.rooms.has(room.id)) {
      logger.warn(`Room ${room.id} already exists, skipping registration`);
      return;
    }
    this.rooms.set(room.id, room);
    // Update planner with new room set
    this.planner = new Planner(this.rooms);
    eventBus.dispatch({ type: "room:dynamically_created", roomId: room.id, roomName: room.name });
    logger.info(`Dynamically registered room: ${room.name} (${room.id})`);
  }


  /** Get a room by ID */
  getRoom(roomId: string): BaseRoom | undefined {
    return this.rooms.get(roomId);
  }

  /** List all rooms */
  listRooms(): Array<{ id: string; name: string; status: string }> {
    return Array.from(this.rooms.values()).map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
    }));
  }

  /** Get room status details */
  getRoomStatus(roomId: string): Record<string, unknown> | undefined {
    return this.rooms.get(roomId)?.getStatusSummary();
  }

  // ─── Task Lifecycle ────────────────────────────────────────────

  /**
   * Submit a task to the orchestrator.
   * This is the main entry point for all work.
   */
  async submitTask(input: TaskInput): Promise<Task> {
    const task: Task = {
      id: uuid(),
      title: input.title,
      description: input.description,
      status: TaskStatus.PENDING,
      priority: input.priority ?? TaskPriority.NORMAL,
      input: input.input ?? {},
      dependencies: input.dependencies ?? [],
      createdAt: new Date(),
    };

    this.tasks.set(task.id, task);
    eventBus.dispatch({ type: "task:created", task });

    logger.info(`Task submitted: ${task.title}`, { taskId: task.id });

    // Plan the task
    const plan = this.planner.plan(input);

    logger.info(`Plan:\n${plan.reasoning}`);

    // Execute parallel groups
    for (const group of plan.parallelGroups) {
      const groupTasks = group
        .map((id) => plan.subtasks.find((t) => t.id === id))
        .filter((t): t is Task => t !== undefined);

      // Check HITL approval for each subtask
      const approved: Task[] = [];
      for (const subtask of groupTasks) {
        const cost = subtask.costEstimate?.estimatedCostUsd ?? 0;
        const roomAutonomy =
          this.rooms.get(subtask.assignedRoom!)?.config.autonomyLevel ??
          this.config.autonomyLevel;

        if (this.hitl.needsApproval("execute_task", cost, roomAutonomy)) {
          this.hitl.requestApproval(
            subtask.id,
            "execute_task",
            subtask.title,
            cost,
            subtask.assignedRoom!,
            roomAutonomy
          );
          subtask.status = TaskStatus.AWAITING_APPROVAL;
          logger.info(`Task awaiting approval: ${subtask.title}`);
        } else {
          approved.push(subtask);
        }
      }

      // Execute approved tasks in parallel
      const promises = approved.map(async (subtask) => {
        const room = this.rooms.get(subtask.assignedRoom!);
        if (!room) {
          subtask.status = TaskStatus.FAILED;
          subtask.error = `Room ${subtask.assignedRoom} not found`;
          return;
        }
        this.tasks.set(subtask.id, subtask);
        await room.acceptTask(subtask);
      });

      await Promise.allSettled(promises);
    }

    // Update parent task status
    const allSubtasks = plan.subtasks;
    const allCompleted = allSubtasks.every((t) => t.status === TaskStatus.COMPLETED);
    const anyFailed = allSubtasks.some((t) => t.status === TaskStatus.FAILED);

    if (allCompleted) {
      task.status = TaskStatus.COMPLETED;
      task.completedAt = new Date();
      task.output = {
        subtaskResults: allSubtasks.map((t) => ({
          id: t.id,
          room: t.assignedRoom,
          status: t.status,
          output: t.output,
        })),
      };
    } else if (anyFailed) {
      task.status = TaskStatus.FAILED;
      task.error = allSubtasks
        .filter((t) => t.status === TaskStatus.FAILED)
        .map((t) => t.error)
        .join("; ");
    }

    return task;
  }

  /** Get task by ID */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /** List all tasks */
  listTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  // ─── Agent Teleportation ───────────────────────────────────────

  /** Teleport an agent from one room to another */
  teleportAgent(
    agentId: string,
    fromRoomId: string,
    toRoomId: string
  ): boolean {
    const fromRoom = this.rooms.get(fromRoomId);
    const toRoom = this.rooms.get(toRoomId);
    if (!fromRoom || !toRoom) return false;

    const agent = fromRoom.removeAgent(agentId);
    if (!agent) return false;

    if (!agent.config.canTeleport) {
      // Put it back
      fromRoom.addAgent(agent);
      logger.warn(`Agent ${agentId} cannot teleport`);
      return false;
    }

    agent.status = "teleporting";
    toRoom.addAgent(agent);

    eventBus.dispatch({
      type: "agent:teleported",
      agentId,
      fromRoom: fromRoomId,
      toRoom: toRoomId,
    });

    logger.info(`Agent ${agent.config.name} teleported: ${fromRoomId} → ${toRoomId}`);
    return true;
  }

  // ─── Cost & HITL ──────────────────────────────────────────────

  /** Get cost summary */
  getCostSummary(): string {
    return this.costRouter.getCostSummary();
  }

  /** Get total spent */
  getTotalSpent(): number {
    return this.costRouter.getTotalSpent();
  }

  /** Get HITL manager */
  getHitlManager(): HitlManager {
    return this.hitl;
  }

  /** Set autonomy level */
  setAutonomy(level: AutonomyLevel): void {
    this.hitl.setAutonomy(level);
  }

  /** Enable freeride mode */
  enableFreeride(): void {
    this.hitl.enableFreeride();
  }

  /** Get full system status */
  getSystemStatus(): Record<string, unknown> {
    return {
      rooms: this.listRooms(),
      activeTasks: this.listTasks().filter(
        (t) => t.status === TaskStatus.IN_PROGRESS || t.status === TaskStatus.QUEUED
      ).length,
      totalTasks: this.tasks.size,
      cost: this.costRouter.getCostSummary(),
      hitl: this.hitl.getStats(),
    };
  }

  // ─── Memory ───────────────────────────────────────────────────

  /** Get memory store */
  getMemory(): MemoryStore {
    return this.memory;
  }

  /** Get cost router */
  getCostRouter(): CostRouter {
    return this.costRouter;
  }

  /** Export all room memories as Markdown */
  exportAllMemories(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [roomId] of this.rooms) {
      result[roomId] = this.memory.exportAsMarkdown(roomId);
    }
    return result;
  }

  // ─── Event Listeners ──────────────────────────────────────────

  private setupEventListeners(): void {
    eventBus.on("task:completed", (event) => {
      logger.info(`[EVENT] Task completed: ${event.taskId}`);
    });

    eventBus.on("task:failed", (event) => {
      logger.error(`[EVENT] Task failed: ${event.taskId} — ${event.error}`);
    });

    eventBus.on("cost:recorded", (event) => {
      this.costRouter.recordCost(event.record.costUsd);
    });
  }
}
