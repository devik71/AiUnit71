import { z } from "zod";

// ─── Autonomy Levels ───────────────────────────────────────────────
export enum AutonomyLevel {
  /** Every action requires human approval */
  LOCKED = 0,
  /** Critical actions require approval, routine actions proceed */
  SUPERVISED = 1,
  /** Only destructive/costly actions require approval */
  GUIDED = 2,
  /** Full autonomy — no approvals needed (freeride mode) */
  FREERIDE = 3,
}

// ─── Task Definitions ──────────────────────────────────────────────
export enum TaskStatus {
  PENDING = "pending",
  QUEUED = "queued",
  IN_PROGRESS = "in_progress",
  AWAITING_APPROVAL = "awaiting_approval",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

export enum TaskPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}

export interface Task {
  id: string;
  parentId?: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedRoom?: string;
  assignedAgent?: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  dependencies: string[];
  costEstimate?: CostEstimate;
  actualCost?: CostRecord;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

// ─── Cost & Routing ────────────────────────────────────────────────
export interface ModelProvider {
  id: string;
  name: string;
  type: "local" | "cloud";
  baseUrl?: string;
  apiKeyEnv?: string;
}

export interface ModelOption {
  provider: ModelProvider;
  model: string;
  inputCostPer1k: number;
  outputCostPer1k: number;
  capabilities: ModelCapability[];
  qualityScore: number; // 0-100
  latencyMs: number; // estimated
}

export type ModelCapability =
  | "text-generation"
  | "code-generation"
  | "vision"
  | "image-generation"
  | "video-generation"
  | "audio-generation"
  | "voice-cloning"
  | "3d-generation"
  | "embedding"
  | "analysis";

export interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  selectedModel: string;
  selectedProvider: string;
  alternatives: Array<{
    model: string;
    provider: string;
    costUsd: number;
    qualityScore: number;
  }>;
}

export interface CostRecord {
  taskId: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  timestamp: Date;
}

// ─── Room Definitions ──────────────────────────────────────────────
export interface RoomConfig {
  id: string;
  name: string;
  description: string;
  capabilities: ModelCapability[];
  defaultAgents: AgentConfig[];
  tools: ToolConfig[];
  memoryPath: string;
  maxConcurrentTasks: number;
  autonomyLevel: AutonomyLevel;
}

export interface RoomState {
  id: string;
  config: RoomConfig;
  activeTasks: Task[];
  agents: AgentInstance[];
  memoryLog: MemoryEntry[];
  status: "idle" | "active" | "paused" | "error";
}

// ─── Agent Definitions ─────────────────────────────────────────────
export interface AgentConfig {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
  preferredModel?: string;
  capabilities: ModelCapability[];
  canTeleport: boolean;
}

export interface AgentInstance {
  config: AgentConfig;
  currentRoom: string;
  status: "idle" | "working" | "teleporting" | "waiting_approval";
  currentTaskId?: string;
}

// ─── Tool Definitions ──────────────────────────────────────────────
export interface ToolConfig {
  id: string;
  name: string;
  description: string;
  type: "local" | "api" | "skill";
  endpoint?: string;
  skillPath?: string;
  costPerUse?: number;
}

// ─── Memory ────────────────────────────────────────────────────────
export interface MemoryEntry {
  id: string;
  roomId: string;
  agentId?: string;
  taskId?: string;
  type: "experience" | "decision" | "error" | "learning" | "context";
  content: string;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

// ─── Events ────────────────────────────────────────────────────────
export type OrchestratorEvent =
  | { type: "task:created"; task: Task }
  | { type: "task:assigned"; taskId: string; roomId: string }
  | { type: "task:started"; taskId: string }
  | { type: "task:completed"; taskId: string; output: Record<string, unknown> }
  | { type: "task:failed"; taskId: string; error: string }
  | { type: "room:created"; roomId: string }
  | { type: "room:activated"; roomId: string }
  | { type: "agent:teleported"; agentId: string; fromRoom: string; toRoom: string }
  | { type: "cost:recorded"; record: CostRecord }
  | { type: "hitl:approval_required"; taskId: string; action: string }
  | { type: "hitl:approved"; taskId: string }
  | { type: "hitl:rejected"; taskId: string; reason: string };

// ─── Validation Schemas ────────────────────────────────────────────
export const TaskInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.NORMAL),
  input: z.record(z.unknown()).default({}),
  dependencies: z.array(z.string()).default([]),
});

export type TaskInput = {
  title: string;
  description: string;
  priority?: TaskPriority;
  input?: Record<string, unknown>;
  dependencies?: string[];
};

export const RoomConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  capabilities: z.array(z.string()),
  maxConcurrentTasks: z.number().int().positive().default(5),
  autonomyLevel: z.nativeEnum(AutonomyLevel).default(AutonomyLevel.SUPERVISED),
});
