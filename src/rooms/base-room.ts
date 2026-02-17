import { v4 as uuid } from "uuid";
import type {
  RoomConfig,
  RoomState,
  Task,
  TaskStatus,
  AgentInstance,
  MemoryEntry,
  CostEstimate,
} from "../core/types.js";
import { TaskStatus as TS } from "../core/types.js";
import { eventBus } from "../core/event-bus.js";
import { roomLogger } from "../core/logger.js";
import { MemoryStore } from "../memory/memory-store.js";
import { CostRouter, type RouteRequest } from "../cost/router.js";
import type winston from "winston";

/**
 * BaseRoom — abstract base for all production rooms.
 *
 * Each room is a self-contained workspace with:
 * - Dedicated agents
 * - Memory & experience logs
 * - Tools/instruments
 * - Task queue with parallel execution
 * - Cost awareness (routes every operation through CostRouter)
 */
export abstract class BaseRoom {
  readonly config: RoomConfig;
  protected state: RoomState;
  protected memory: MemoryStore;
  protected costRouter: CostRouter;
  protected log: winston.Logger;

  constructor(
    config: RoomConfig,
    memory: MemoryStore,
    costRouter: CostRouter
  ) {
    this.config = config;
    this.memory = memory;
    this.costRouter = costRouter;
    this.log = roomLogger(config.id);

    this.state = {
      id: config.id,
      config,
      activeTasks: [],
      agents: config.defaultAgents.map((agentConfig) => ({
        config: agentConfig,
        currentRoom: config.id,
        status: "idle" as const,
      })),
      memoryLog: [],
      status: "idle",
    };

    this.log.info(`Room initialized: ${config.name}`);
  }

  // ─── Public API ────────────────────────────────────────────────

  get id(): string {
    return this.config.id;
  }

  get name(): string {
    return this.config.name;
  }

  get status(): RoomState["status"] {
    return this.state.status;
  }

  get activeTasks(): Task[] {
    return this.state.activeTasks;
  }

  get agents(): AgentInstance[] {
    return this.state.agents;
  }

  /** Accept a task into this room */
  async acceptTask(task: Task): Promise<void> {
    if (this.state.activeTasks.length >= this.config.maxConcurrentTasks) {
      throw new Error(
        `Room ${this.id} at capacity (${this.config.maxConcurrentTasks} concurrent tasks)`
      );
    }

    task.assignedRoom = this.id;
    task.status = TS.QUEUED;
    this.state.activeTasks.push(task);
    this.state.status = "active";

    eventBus.dispatch({ type: "task:assigned", taskId: task.id, roomId: this.id });

    this.memory.add(this.id, {
      roomId: this.id,
      taskId: task.id,
      type: "context",
      content: `Task accepted: ${task.title} — ${task.description}`,
      metadata: { input: task.input },
    });

    // Execute task
    await this.executeTask(task);
  }

  /** Route a model request through CostRouter before execution */
  protected routeModel(request: RouteRequest) {
    return this.costRouter.route(request);
  }

  /** Add an agent to this room (teleportation target) */
  addAgent(agent: AgentInstance): void {
    agent.currentRoom = this.id;
    agent.status = "idle";
    this.state.agents.push(agent);
    this.log.info(`Agent ${agent.config.name} teleported into room`);
  }

  /** Remove an agent from this room (teleportation source) */
  removeAgent(agentId: string): AgentInstance | undefined {
    const idx = this.state.agents.findIndex((a) => a.config.id === agentId);
    if (idx === -1) return undefined;
    const [agent] = this.state.agents.splice(idx, 1);
    return agent;
  }

  /** Get room status summary */
  getStatusSummary(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      status: this.state.status,
      activeTaskCount: this.state.activeTasks.length,
      agentCount: this.state.agents.length,
      agents: this.state.agents.map((a) => ({
        name: a.config.name,
        status: a.status,
        task: a.currentTaskId,
      })),
    };
  }

  // ─── Task Lifecycle ────────────────────────────────────────────

  protected async executeTask(task: Task): Promise<void> {
    task.status = TS.IN_PROGRESS;
    task.startedAt = new Date();

    eventBus.dispatch({ type: "task:started", taskId: task.id });
    this.log.info(`Executing task: ${task.title}`);

    try {
      // Find an idle agent
      const agent = this.findIdleAgent(task);
      if (agent) {
        agent.status = "working";
        agent.currentTaskId = task.id;
        task.assignedAgent = agent.config.id;
      }

      // Delegate to room-specific implementation
      const output = await this.processTask(task);

      // Complete
      task.status = TS.COMPLETED;
      task.completedAt = new Date();
      task.output = output;

      if (agent) {
        agent.status = "idle";
        agent.currentTaskId = undefined;
      }

      this.memory.add(this.id, {
        roomId: this.id,
        taskId: task.id,
        agentId: task.assignedAgent,
        type: "experience",
        content: `Task completed: ${task.title}. Output keys: ${Object.keys(output).join(", ")}`,
        metadata: { outputSummary: Object.keys(output) },
      });

      eventBus.dispatch({
        type: "task:completed",
        taskId: task.id,
        output,
      });

      this.log.info(`Task completed: ${task.title}`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      task.status = TS.FAILED;
      task.error = errMsg;

      this.memory.add(this.id, {
        roomId: this.id,
        taskId: task.id,
        type: "error",
        content: `Task failed: ${task.title} — ${errMsg}`,
        metadata: { error: errMsg },
      });

      eventBus.dispatch({ type: "task:failed", taskId: task.id, error: errMsg });
      this.log.error(`Task failed: ${task.title}`, { error: errMsg });
    } finally {
      // Remove from active tasks
      this.state.activeTasks = this.state.activeTasks.filter(
        (t) => t.id !== task.id
      );
      if (this.state.activeTasks.length === 0) {
        this.state.status = "idle";
      }
    }
  }

  /** Find the best idle agent for a task */
  protected findIdleAgent(task: Task): AgentInstance | undefined {
    return this.state.agents.find((a) => a.status === "idle");
  }

  /** Room-specific task processing — must be implemented by each room */
  protected abstract processTask(
    task: Task
  ): Promise<Record<string, unknown>>;
}
