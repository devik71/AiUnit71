/**
 * AiUnit71 — Multi-Room AI Agent Factory
 *
 * A modular, production-ready system for creative and automation production.
 * Built on a dynamic Rooms Warehouse architecture where each room is a
 * self-contained workspace with dedicated agents, memory, tools, and pipelines.
 *
 * @module aiunit71
 */

// Core
export { Orchestrator } from "./core/orchestrator.js";
export type { OrchestratorConfig } from "./core/orchestrator.js";
export { eventBus } from "./core/event-bus.js";
export { logger } from "./core/logger.js";

// Types
export {
  AutonomyLevel,
  TaskStatus,
  TaskPriority,
  type Task,
  type TaskInput,
  type RoomConfig,
  type AgentConfig,
  type AgentInstance,
  type CostEstimate,
  type CostRecord,
  type ModelOption,
  type ModelCapability,
  type ToolConfig,
  type MemoryEntry,
  type OrchestratorEvent,
  type SkillRef,
} from "./core/types.js";

// Rooms
export { BaseRoom } from "./rooms/base-room.js";
export { BriefingRoom } from "./rooms/briefing-room.js";
export { BrainstormRoom } from "./rooms/brainstorm-room.js";
export { CopywritingRoom } from "./rooms/copywriting-room.js";
export { ImageGenRoom } from "./rooms/image-gen-room.js";
export { JobMasterRoom } from "./rooms/jobmaster-room.js";
export { UxUiRoom } from "./rooms/ux-ui-room.js";
export { AnimationRoom } from "./rooms/animation-room.js";
export { VideoRoom } from "./rooms/video-room.js";
export { ThreeDRoom } from "./rooms/three-d-room.js";
export { MusicAudioRoom } from "./rooms/music-audio-room.js";
export { CodeDeployRoom } from "./rooms/code-deploy-room.js";
export { CostRoutingRoom } from "./rooms/cost-routing-room.js";
export { EvaluationRoom } from "./rooms/evaluation-room.js";
export { FinalizerRoom } from "./rooms/finalizer-room.js";
export { HitlRoom } from "./rooms/hitl-room.js";
export { LearningRoom } from "./rooms/learning-room.js";
export { RecruiterRoom } from "./rooms/recruiter-room.js";
export { ReportMasterRoom } from "./rooms/reportmaster-room.js";

// Cost & Routing
export { CostRouter } from "./cost/router.js";
export type { RouteRequest, RouteResult } from "./cost/router.js";

// Planner
export { Planner } from "./planner/planner.js";
export type { PlannerResult } from "./planner/planner.js";

// Memory
export { MemoryStore } from "./memory/memory-store.js";

// Human-in-the-Loop
export { HitlManager } from "./hitl/hitl-manager.js";
export type { ApprovalRequest } from "./hitl/hitl-manager.js";

// LLM Client
export { LlmClient } from "./llm/llm-client.js";
export type { ChatMessage, ChatRequest, ChatResponse } from "./llm/llm-client.js";

// Adapters
export { NicheAdapter } from "./adapters/niche-adapter.js";
export type { NicheProfile, ServicePackage } from "./adapters/niche-adapter.js";

// Skills System
export { SkillScanner } from "./skills/skill-scanner.js";
export type { SkillInfo } from "./skills/skill-scanner.js";
export { SkillMaster } from "./agents/skillmaster.js";
export { PromptMasterAgent } from "./agents/promptmaster.js";
export type { PromptOptimizationResult } from "./agents/promptmaster.js";

// Pipeline
export { PipelineExecutor } from "./pipeline/pipeline-executor.js";
export {
  PipelinePhase,
  PIPELINE_PHASE_ORDER,
  type ProjectContext,
  type PipelineConfig,
  type PipelineResult,
  type PipelineEvent,
} from "./pipeline/pipeline-types.js";
