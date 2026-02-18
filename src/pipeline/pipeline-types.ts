import type { AutonomyLevel, CostRecord, Task } from "../core/types.js";

// ─── Pipeline Phases ────────────────────────────────────────────────

/**
 * The 7-phase production pipeline.
 * Each phase transforms the ProjectContext with its output.
 */
export enum PipelinePhase {
    /** Phase 0: Niche identification and service package selection */
    NICHE_ADAPTATION = 0,
    /** Phase 1: Client brief capture and requirements locking */
    BRIEFING = 1,
    /** Phase 2: Idea generation and concept selection */
    BRAINSTORM = 2,
    /** Phase 2.5: Cost estimation and model routing */
    COST_ESTIMATION = 2.5,
    /** Phase 3: Task decomposition and job distribution */
    JOB_DISTRIBUTION = 3,
    /** Phase 4: Parallel creative execution + real-time evaluation */
    EXECUTION = 4,
    /** Phase 5: Quality control, reporting, and reiteration gate */
    QUALITY_CONTROL = 5,
    /** Phase 6: Final packaging and client delivery */
    FINALIZATION = 6,
}

/** All phases in execution order */
export const PIPELINE_PHASE_ORDER: PipelinePhase[] = [
    PipelinePhase.NICHE_ADAPTATION,
    PipelinePhase.BRIEFING,
    PipelinePhase.BRAINSTORM,
    PipelinePhase.COST_ESTIMATION,
    PipelinePhase.JOB_DISTRIBUTION,
    PipelinePhase.EXECUTION,
    PipelinePhase.QUALITY_CONTROL,
    PipelinePhase.FINALIZATION,
];

// ─── Project Context ────────────────────────────────────────────────

/**
 * ProjectContext carries all accumulated data through the pipeline.
 * Each phase reads what it needs and writes its output into the context.
 */
export interface ProjectContext {
    /** Unique project ID */
    projectId: string;

    /** Client-facing title */
    title: string;

    /** Raw client request / description */
    clientRequest: string;

    /** Current phase being executed */
    currentPhase: PipelinePhase;

    /** Phase 0 output: niche profile and selected packages */
    nicheProfile?: {
        nicheId: string;
        nicheName: string;
        selectedPackages: string[];
        estimatedPrice: number;
        estimatedCost: number;
    };

    /** Phase 1 output: structured brief */
    briefReport?: {
        objectives: string[];
        targetAudience: string;
        deliverables: string[];
        constraints: string[];
        acceptanceCriteria: string[];
        tone: string;
        rawContent: string;
    };

    /** Phase 2 output: brainstorm results */
    brainstormReport?: {
        ideas: string;
        selectedConcept?: string;
        rawContent: string;
    };

    /** Phase 2.5 output: cost breakdown */
    costEstimate?: {
        totalEstimatedCost: number;
        modelSelections: Array<{
            task: string;
            model: string;
            provider: string;
            estimatedCostUsd: number;
        }>;
        budgetApproved: boolean;
    };

    /** Phase 3 output: job plan */
    jobPlan?: {
        tasks: Array<{
            id: string;
            title: string;
            assignedRoom: string;
            description: string;
            dependencies: string[];
        }>;
        parallelGroups: string[][];
        reasoning: string;
    };

    /** Phase 4 output: execution results per task */
    executionResults?: Array<{
        taskId: string;
        room: string;
        status: "completed" | "failed";
        output?: Record<string, unknown>;
        error?: string;
    }>;

    /** Phase 4 output: real-time evaluation scores */
    evaluationReport?: {
        overallScore: number;
        passedQualityGate: boolean;
        recommendation: "approve" | "reiterate" | "escalate";
        issues: Array<{
            severity: "critical" | "major" | "minor";
            description: string;
            affectedTask?: string;
            suggestedFix?: string;
        }>;
        summary: string;
    };

    /** Phase 5 output: quality report */
    qualityReport?: {
        qualityVerdict: "approved" | "needs_rework" | "rejected";
        qualityScore: number;
        clientReport: Record<string, unknown>;
        lessonsLearned: string[];
        rawContent: string;
    };

    /** Phase 6 output: final delivery */
    deliveryPackage?: {
        dashboard: Record<string, unknown>;
        deliverables: Array<{
            name: string;
            type: string;
            path?: string;
            content?: string;
        }>;
        finalizedAt: Date;
    };

    /** Aggregated cost records across all phases */
    costLedger: CostRecord[];

    /** Timestamp tracking */
    createdAt: Date;
    completedAt?: Date;

    /** Reiteration tracking */
    iterationCount: number;
    maxIterations: number;

    /** Errors aggregated from any phase */
    errors: Array<{
        phase: PipelinePhase;
        message: string;
        recoverable: boolean;
    }>;
}

// ─── Pipeline Config ────────────────────────────────────────────────

export interface PipelineConfig {
    /** Autonomy level for the pipeline run */
    autonomyLevel?: AutonomyLevel;

    /** Minimum quality score to pass Phase 5 gate (default: 70) */
    qualityThreshold?: number;

    /** Max reiteration loops before giving up (default: 2) */
    maxIterations?: number;

    /** Skip specific phases (e.g. skip niche if you already have a brief) */
    skipPhases?: PipelinePhase[];

    /** Pre-populated context fields (e.g. provide nicheProfile directly) */
    presetContext?: Partial<ProjectContext>;

    /** Budget ceiling in USD — pipeline aborts if exceeded */
    budgetCeilingUsd?: number;
}

// ─── Pipeline Result ────────────────────────────────────────────────

export interface PipelineResult {
    /** Was the pipeline successful? */
    success: boolean;

    /** The final project context with all phase outputs */
    context: ProjectContext;

    /** Summary of what happened */
    summary: string;

    /** Total cost across all phases */
    totalCostUsd: number;

    /** Total duration in milliseconds */
    durationMs: number;

    /** Which phase did it stop at (if failed) */
    stoppedAtPhase?: PipelinePhase;
}

// ─── Pipeline Events ────────────────────────────────────────────────

export type PipelineEvent =
    | { type: "pipeline:started"; projectId: string; title: string }
    | { type: "pipeline:phase_started"; projectId: string; phase: PipelinePhase }
    | { type: "pipeline:phase_completed"; projectId: string; phase: PipelinePhase }
    | { type: "pipeline:phase_failed"; projectId: string; phase: PipelinePhase; error: string }
    | { type: "pipeline:quality_gate"; projectId: string; score: number; passed: boolean }
    | { type: "pipeline:reiteration"; projectId: string; iteration: number; reason: string }
    | { type: "pipeline:completed"; projectId: string; success: boolean; totalCostUsd: number }
    | { type: "pipeline:aborted"; projectId: string; reason: string };
