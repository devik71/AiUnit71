import { v4 as uuid } from "uuid";
import type { Task, TaskInput } from "../core/types.js";
import { TaskStatus, TaskPriority, AutonomyLevel } from "../core/types.js";
import { eventBus } from "../core/event-bus.js";
import { logger } from "../core/logger.js";
import type { Orchestrator } from "../core/orchestrator.js";
import {
    PipelinePhase,
    PIPELINE_PHASE_ORDER,
    type ProjectContext,
    type PipelineConfig,
    type PipelineResult,
    type PipelineEvent,
} from "./pipeline-types.js";

/**
 * PipelineExecutor — sequences the 7-phase production pipeline.
 *
 * Takes a client request and runs it through:
 *   Phase 0: Niche Adaptation → Phase 1: Briefing → Phase 2: Brainstorm →
 *   Phase 2.5: Cost Estimation → Phase 3: Job Distribution →
 *   Phase 4: Execution + Evaluation → Phase 5: Quality Control →
 *   Phase 6: Finalization & Delivery
 *
 * Features:
 * - Sequential phase execution with data handoff via ProjectContext
 * - Quality gate between Phase 5 and completion (reiterate if score < threshold)
 * - Budget ceiling enforcement
 * - Phase skipping for partial runs
 * - Reiteration loops on quality rejection
 */
export class PipelineExecutor {
    private orchestrator: Orchestrator;
    private config: Required<PipelineConfig>;

    constructor(orchestrator: Orchestrator, config: PipelineConfig = {}) {
        this.orchestrator = orchestrator;
        this.config = {
            autonomyLevel: config.autonomyLevel ?? AutonomyLevel.GUIDED,
            qualityThreshold: config.qualityThreshold ?? 70,
            maxIterations: config.maxIterations ?? 2,
            skipPhases: config.skipPhases ?? [],
            presetContext: config.presetContext ?? {},
            budgetCeilingUsd: config.budgetCeilingUsd ?? 5.0,
        };
    }

    // ─── Main Entry Point ─────────────────────────────────────────

    /**
     * Execute the full pipeline for a client request.
     * Returns a PipelineResult with the final ProjectContext and summary.
     */
    async execute(title: string, clientRequest: string): Promise<PipelineResult> {
        const startTime = Date.now();

        const context: ProjectContext = {
            projectId: uuid(),
            title,
            clientRequest,
            currentPhase: PipelinePhase.NICHE_ADAPTATION,
            costLedger: [],
            createdAt: new Date(),
            iterationCount: 0,
            maxIterations: this.config.maxIterations,
            errors: [],
            ...this.config.presetContext,
        };

        this.emitEvent({ type: "pipeline:started", projectId: context.projectId, title });
        logger.info(`🏭 Pipeline started: "${title}" [${context.projectId}]`);

        const phases = PIPELINE_PHASE_ORDER.filter(
            (p) => !this.config.skipPhases.includes(p)
        );

        let success = true;
        let stoppedAtPhase: PipelinePhase | undefined;

        for (const phase of phases) {
            context.currentPhase = phase;

            // Budget check before each phase
            const currentSpend = this.getTotalCost(context);
            if (currentSpend > this.config.budgetCeilingUsd) {
                const msg = `Budget ceiling exceeded: $${currentSpend.toFixed(4)} > $${this.config.budgetCeilingUsd}`;
                context.errors.push({ phase, message: msg, recoverable: false });
                this.emitEvent({ type: "pipeline:aborted", projectId: context.projectId, reason: msg });
                logger.error(`💰 ${msg}`);
                success = false;
                stoppedAtPhase = phase;
                break;
            }

            try {
                this.emitEvent({ type: "pipeline:phase_started", projectId: context.projectId, phase });
                logger.info(`▶ Phase ${phase}: ${this.phaseName(phase)}`);

                await this.executePhase(phase, context);

                this.emitEvent({ type: "pipeline:phase_completed", projectId: context.projectId, phase });
                logger.info(`✓ Phase ${phase} complete`);
            } catch (error) {
                const errMsg = error instanceof Error ? error.message : String(error);
                context.errors.push({ phase, message: errMsg, recoverable: false });
                this.emitEvent({ type: "pipeline:phase_failed", projectId: context.projectId, phase, error: errMsg });
                logger.error(`✗ Phase ${phase} failed: ${errMsg}`);
                success = false;
                stoppedAtPhase = phase;
                break;
            }

            // Quality gate after Phase 5
            if (phase === PipelinePhase.QUALITY_CONTROL) {
                const gateResult = this.evaluateQualityGate(context);
                if (!gateResult.passed) {
                    if (context.iterationCount < this.config.maxIterations) {
                        context.iterationCount++;
                        this.emitEvent({
                            type: "pipeline:reiteration",
                            projectId: context.projectId,
                            iteration: context.iterationCount,
                            reason: gateResult.reason,
                        });
                        logger.warn(`🔄 Quality gate failed (${gateResult.reason}). Reiteration ${context.iterationCount}/${this.config.maxIterations}`);

                        // Re-run from Phase 3 (Job Distribution) through Phase 5
                        const rerunPhases = [
                            PipelinePhase.JOB_DISTRIBUTION,
                            PipelinePhase.EXECUTION,
                            PipelinePhase.QUALITY_CONTROL,
                        ].filter((p) => !this.config.skipPhases.includes(p));

                        for (const rerunPhase of rerunPhases) {
                            context.currentPhase = rerunPhase;
                            try {
                                await this.executePhase(rerunPhase, context);
                            } catch (error) {
                                const errMsg = error instanceof Error ? error.message : String(error);
                                context.errors.push({ phase: rerunPhase, message: errMsg, recoverable: false });
                                success = false;
                                stoppedAtPhase = rerunPhase;
                                break;
                            }
                        }
                        if (!success) break;

                        // Re-check quality gate
                        const recheck = this.evaluateQualityGate(context);
                        if (!recheck.passed) {
                            logger.warn(`⚠ Quality gate still failed after reiteration. Proceeding with best effort.`);
                        }
                    } else {
                        logger.warn(`⚠ Max iterations reached. Proceeding with best effort.`);
                    }
                }
            }
        }

        context.completedAt = new Date();
        const totalCostUsd = this.getTotalCost(context);
        const durationMs = Date.now() - startTime;

        this.emitEvent({
            type: "pipeline:completed",
            projectId: context.projectId,
            success,
            totalCostUsd,
        });

        const summary = this.buildSummary(context, success, totalCostUsd, durationMs);
        logger.info(`🏁 Pipeline ${success ? "completed" : "failed"}: ${summary}`);

        return {
            success,
            context,
            summary,
            totalCostUsd,
            durationMs,
            stoppedAtPhase,
        };
    }

    // ─── Phase Executors ──────────────────────────────────────────

    private async executePhase(phase: PipelinePhase, ctx: ProjectContext): Promise<void> {
        switch (phase) {
            case PipelinePhase.NICHE_ADAPTATION:
                await this.phaseNicheAdaptation(ctx);
                break;
            case PipelinePhase.BRIEFING:
                await this.phaseBriefing(ctx);
                break;
            case PipelinePhase.BRAINSTORM:
                await this.phaseBrainstorm(ctx);
                break;
            case PipelinePhase.COST_ESTIMATION:
                await this.phaseCostEstimation(ctx);
                break;
            case PipelinePhase.JOB_DISTRIBUTION:
                await this.phaseJobDistribution(ctx);
                break;
            case PipelinePhase.EXECUTION:
                await this.phaseExecution(ctx);
                break;
            case PipelinePhase.QUALITY_CONTROL:
                await this.phaseQualityControl(ctx);
                break;
            case PipelinePhase.FINALIZATION:
                await this.phaseFinalization(ctx);
                break;
        }
    }

    /** Phase 0: Niche Adaptation — identify niche and packages */
    private async phaseNicheAdaptation(ctx: ProjectContext): Promise<void> {
        // If nicheProfile is already preset, skip the room call
        if (ctx.nicheProfile) {
            logger.info("Phase 0: Using preset niche profile");
            return;
        }

        // Use NicheAdapter directly (it's not a room, it's an adapter)
        const { NicheAdapter } = await import("../adapters/niche-adapter.js");
        const adapter = new NicheAdapter();
        const matches = adapter.findNiche(ctx.clientRequest);

        if (matches.length > 0) {
            const niche = matches[0];
            const packages = adapter.getPackages(niche.id);
            ctx.nicheProfile = {
                nicheId: niche.id,
                nicheName: niche.name,
                selectedPackages: packages.map((p) => p.id),
                estimatedPrice: packages.reduce((sum, p) => sum + p.suggestedPriceUsd, 0),
                estimatedCost: packages.reduce((sum, p) => sum + p.estimatedCostUsd, 0),
            };
        } else {
            // No niche match — continue without niche context
            ctx.nicheProfile = {
                nicheId: "custom",
                nicheName: "Custom Project",
                selectedPackages: [],
                estimatedPrice: 0,
                estimatedCost: 0,
            };
        }
    }

    /** Phase 1: Briefing — capture structured brief from client request */
    private async phaseBriefing(ctx: ProjectContext): Promise<void> {
        if (ctx.briefReport) return;

        const task = await this.submitToRoom("briefing", {
            title: `Brief: ${ctx.title}`,
            description: ctx.clientRequest,
            input: {
                nicheProfile: ctx.nicheProfile,
                clientRequest: ctx.clientRequest,
            },
        });

        if (task.status === TaskStatus.COMPLETED && task.output) {
            const content = (task.output as Record<string, unknown>).briefReport as Record<string, unknown> ?? task.output;
            ctx.briefReport = {
                objectives: (content.objectives as string[]) ?? [],
                targetAudience: (content.targetAudience as string) ?? "",
                deliverables: (content.deliverables as string[]) ?? [],
                constraints: (content.constraints as string[]) ?? [],
                acceptanceCriteria: (content.acceptanceCriteria as string[]) ?? [],
                tone: (content.tone as string) ?? "",
                rawContent: JSON.stringify(content),
            };
        } else {
            throw new Error(`Briefing phase failed: ${task.error ?? "unknown error"}`);
        }
    }

    /** Phase 2: Brainstorm — generate and select creative concepts */
    private async phaseBrainstorm(ctx: ProjectContext): Promise<void> {
        if (ctx.brainstormReport) return;

        const task = await this.submitToRoom("brainstorm", {
            title: `Brainstorm: ${ctx.title}`,
            description: ctx.briefReport?.rawContent ?? ctx.clientRequest,
            input: {
                briefReport: ctx.briefReport,
                nicheProfile: ctx.nicheProfile,
            },
        });

        if (task.status === TaskStatus.COMPLETED && task.output) {
            ctx.brainstormReport = {
                ideas: (task.output.ideas as string) ?? "",
                selectedConcept: (task.output.selectedConcept as string) ?? undefined,
                rawContent: JSON.stringify(task.output),
            };
        } else {
            throw new Error(`Brainstorm phase failed: ${task.error ?? "unknown error"}`);
        }
    }

    /** Phase 2.5: Cost Estimation — get model routing and cost breakdown */
    private async phaseCostEstimation(ctx: ProjectContext): Promise<void> {
        if (ctx.costEstimate) return;

        const task = await this.submitToRoom("cost-routing", {
            title: `Cost Estimate: ${ctx.title}`,
            description: `Estimate costs for: ${ctx.briefReport?.deliverables?.join(", ") ?? ctx.clientRequest}`,
            input: {
                briefReport: ctx.briefReport,
                brainstormReport: ctx.brainstormReport,
            },
        });

        if (task.status === TaskStatus.COMPLETED && task.output) {
            ctx.costEstimate = {
                totalEstimatedCost: (task.output.totalEstimatedCost as number) ?? 0,
                modelSelections: (task.output.modelSelections as Array<{
                    task: string; model: string; provider: string; estimatedCostUsd: number;
                }>) ?? [],
                budgetApproved: true,
            };
        } else {
            // Cost estimation failure is non-fatal — continue with defaults
            logger.warn("Cost estimation failed, proceeding with defaults");
            ctx.costEstimate = { totalEstimatedCost: 0, modelSelections: [], budgetApproved: true };
        }
    }

    /** Phase 3: Job Distribution — decompose into tasks and assign rooms */
    private async phaseJobDistribution(ctx: ProjectContext): Promise<void> {
        const task = await this.submitToRoom("jobmaster", {
            title: `Job Plan: ${ctx.title}`,
            description: ctx.briefReport?.rawContent ?? ctx.clientRequest,
            input: {
                briefReport: ctx.briefReport,
                brainstormReport: ctx.brainstormReport,
                costEstimate: ctx.costEstimate,
            },
        });

        if (task.status === TaskStatus.COMPLETED && task.output) {
            const plan = task.output.jobPlan as Record<string, unknown> ?? task.output;
            ctx.jobPlan = {
                tasks: (plan.tasks as Array<{
                    id: string; title: string; assignedRoom: string; description: string; dependencies: string[];
                }>) ?? [],
                parallelGroups: (plan.parallelGroups as string[][]) ?? [],
                reasoning: (plan.reasoning as string) ?? "",
            };
        } else {
            throw new Error(`Job distribution phase failed: ${task.error ?? "unknown error"}`);
        }
    }

    /** Phase 4: Execution — run all creative tasks in parallel + evaluate */
    private async phaseExecution(ctx: ProjectContext): Promise<void> {
        ctx.executionResults = [];

        // If we have a job plan, use it. Otherwise, fall back to planner-based routing.
        if (ctx.jobPlan && ctx.jobPlan.tasks.length > 0) {
            // Execute each task group in parallel
            for (const group of ctx.jobPlan.parallelGroups) {
                const groupTasks = group
                    .map((id) => ctx.jobPlan!.tasks.find((t) => t.id === id))
                    .filter((t): t is NonNullable<typeof t> => t !== undefined);

                const promises = groupTasks.map(async (jobTask) => {
                    try {
                        const task = await this.submitToRoom(jobTask.assignedRoom, {
                            title: jobTask.title,
                            description: jobTask.description,
                            input: {
                                briefReport: ctx.briefReport,
                                brainstormReport: ctx.brainstormReport,
                            },
                        });

                        ctx.executionResults!.push({
                            taskId: jobTask.id,
                            room: jobTask.assignedRoom,
                            status: task.status === TaskStatus.COMPLETED ? "completed" : "failed",
                            output: task.output ?? undefined,
                            error: task.error ?? undefined,
                        });
                    } catch (error) {
                        const errMsg = error instanceof Error ? error.message : String(error);
                        ctx.executionResults!.push({
                            taskId: jobTask.id,
                            room: jobTask.assignedRoom,
                            status: "failed",
                            error: errMsg,
                        });
                    }
                });

                await Promise.allSettled(promises);
            }
        } else {
            // Fallback: use the orchestrator's built-in planner routing
            const task = await this.orchestrator.submitTask({
                title: ctx.title,
                description: ctx.briefReport?.rawContent ?? ctx.clientRequest,
            });

            const subtaskResults = (task.output as Record<string, unknown>)?.subtaskResults as Array<{
                id: string; room: string; status: string; output?: Record<string, unknown>;
            }>;

            if (subtaskResults) {
                ctx.executionResults = subtaskResults.map((r) => ({
                    taskId: r.id,
                    room: r.room,
                    status: r.status === "completed" ? "completed" as const : "failed" as const,
                    output: r.output,
                }));
            }
        }

        // Run evaluation on the results
        await this.runEvaluation(ctx);
    }

    /** Run EvaluationRoom on execution results */
    private async runEvaluation(ctx: ProjectContext): Promise<void> {
        const evalTask = await this.submitToRoom("evaluation", {
            title: `Evaluate: ${ctx.title}`,
            description: `Evaluate execution results for project: ${ctx.title}`,
            input: {
                taskResults: ctx.executionResults,
                briefReport: ctx.briefReport,
                acceptanceCriteria: ctx.briefReport?.acceptanceCriteria,
            },
        });

        if (evalTask.status === TaskStatus.COMPLETED && evalTask.output) {
            const evalResult = evalTask.output.evaluationResult as Record<string, unknown> ?? evalTask.output;
            ctx.evaluationReport = {
                overallScore: (evalResult.overallScore as number) ?? 0,
                passedQualityGate: (evalResult.passedQualityGate as boolean) ?? false,
                recommendation: (evalResult.recommendation as "approve" | "reiterate" | "escalate") ?? "escalate",
                issues: (evalResult.issues as Array<{
                    severity: "critical" | "major" | "minor";
                    description: string;
                    affectedTask?: string;
                    suggestedFix?: string;
                }>) ?? [],
                summary: (evalResult.summary as string) ?? "",
            };
        }
    }

    /** Phase 5: Quality Control — final QA report */
    private async phaseQualityControl(ctx: ProjectContext): Promise<void> {
        const task = await this.submitToRoom("reportmaster", {
            title: `QA Report: ${ctx.title}`,
            description: `Generate quality control report for: ${ctx.title}`,
            input: {
                executionResults: ctx.executionResults,
                evaluationReport: ctx.evaluationReport,
                briefReport: ctx.briefReport,
                brainstormReport: ctx.brainstormReport,
                costEstimate: ctx.costEstimate,
            },
        });

        if (task.status === TaskStatus.COMPLETED && task.output) {
            const report = task.output.report as Record<string, unknown> ?? task.output;
            ctx.qualityReport = {
                qualityVerdict: (report.qualityVerdict as "approved" | "needs_rework" | "rejected") ?? "needs_rework",
                qualityScore: (report.qualityScore as number) ?? 0,
                clientReport: report.clientReport as Record<string, unknown> ?? {},
                lessonsLearned: (report.lessonsLearned as string[]) ?? [],
                rawContent: JSON.stringify(report),
            };
        } else {
            // QA failure is concerning but non-fatal
            logger.warn("Quality control phase failed, proceeding with best-effort");
            ctx.qualityReport = {
                qualityVerdict: "needs_rework",
                qualityScore: 0,
                clientReport: {},
                lessonsLearned: ["QA phase failed"],
                rawContent: "",
            };
        }
    }

    /** Phase 6: Finalization — compile delivery package */
    private async phaseFinalization(ctx: ProjectContext): Promise<void> {
        const task = await this.submitToRoom("finalizer", {
            title: `Final Delivery: ${ctx.title}`,
            description: `Compile final delivery package for: ${ctx.title}`,
            input: {
                executionResults: ctx.executionResults,
                evaluationReport: ctx.evaluationReport,
                qualityReport: ctx.qualityReport,
                briefReport: ctx.briefReport,
                costEstimate: ctx.costEstimate,
            },
        });

        if (task.status === TaskStatus.COMPLETED && task.output) {
            const pkg = task.output.deliveryPackage as Record<string, unknown> ?? task.output;
            ctx.deliveryPackage = {
                dashboard: (pkg.dashboard as Record<string, unknown>) ?? {},
                deliverables: (pkg.deliverables as Array<{
                    name: string; type: string; path?: string; content?: string;
                }>) ?? [],
                finalizedAt: new Date(),
            };
        } else {
            throw new Error(`Finalization phase failed: ${task.error ?? "unknown error"}`);
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────

    /**
     * Submit a task directly to a specific room.
     * Bypasses the planner — sends work to exactly the room you specify.
     */
    private async submitToRoom(roomId: string, input: {
        title: string;
        description: string;
        input?: Record<string, unknown>;
    }): Promise<Task> {
        const room = this.orchestrator.getRoom(roomId);
        if (!room) {
            throw new Error(`Room "${roomId}" not found in warehouse`);
        }

        const task: Task = {
            id: uuid(),
            title: input.title,
            description: input.description,
            status: TaskStatus.PENDING,
            priority: TaskPriority.NORMAL,
            assignedRoom: roomId,
            input: input.input ?? {},
            dependencies: [],
            createdAt: new Date(),
        };

        await room.acceptTask(task);
        return task;
    }

    /** Check quality gate after Phase 5 */
    private evaluateQualityGate(ctx: ProjectContext): { passed: boolean; reason: string } {
        const score = ctx.qualityReport?.qualityScore ?? 0;
        const verdict = ctx.qualityReport?.qualityVerdict ?? "needs_rework";

        const passed = score >= this.config.qualityThreshold && verdict === "approved";

        this.emitEvent({
            type: "pipeline:quality_gate",
            projectId: ctx.projectId,
            score,
            passed,
        });

        return {
            passed,
            reason: passed
                ? `Score ${score} >= ${this.config.qualityThreshold}`
                : `Score ${score} < ${this.config.qualityThreshold} (verdict: ${verdict})`,
        };
    }

    /** Get total cost from context ledger or orchestrator */
    private getTotalCost(ctx: ProjectContext): number {
        return this.orchestrator.getTotalSpent();
    }

    /** Build a human-readable summary */
    private buildSummary(
        ctx: ProjectContext,
        success: boolean,
        totalCostUsd: number,
        durationMs: number,
    ): string {
        const parts = [
            `Project: ${ctx.title}`,
            `Status: ${success ? "✅ Completed" : "❌ Failed"}`,
            `Cost: $${totalCostUsd.toFixed(4)}`,
            `Duration: ${(durationMs / 1000).toFixed(1)}s`,
            `Iterations: ${ctx.iterationCount}/${ctx.maxIterations}`,
        ];

        if (ctx.qualityReport) {
            parts.push(`Quality: ${ctx.qualityReport.qualityScore}/100 (${ctx.qualityReport.qualityVerdict})`);
        }

        if (ctx.errors.length > 0) {
            parts.push(`Errors: ${ctx.errors.length}`);
        }

        if (ctx.executionResults) {
            const completed = ctx.executionResults.filter((r) => r.status === "completed").length;
            const total = ctx.executionResults.length;
            parts.push(`Tasks: ${completed}/${total} completed`);
        }

        return parts.join(" | ");
    }

    /** Emit a pipeline event through the event bus */
    private emitEvent(event: PipelineEvent): void {
        // Pipeline events use the same event bus, cast is safe since we're extending
        eventBus.dispatch(event as any);
    }

    /** Get human-readable phase name */
    private phaseName(phase: PipelinePhase): string {
        const names: Record<number, string> = {
            [PipelinePhase.NICHE_ADAPTATION]: "Niche Adaptation",
            [PipelinePhase.BRIEFING]: "Briefing",
            [PipelinePhase.BRAINSTORM]: "Brainstorm",
            [PipelinePhase.COST_ESTIMATION]: "Cost Estimation",
            [PipelinePhase.JOB_DISTRIBUTION]: "Job Distribution",
            [PipelinePhase.EXECUTION]: "Execution",
            [PipelinePhase.QUALITY_CONTROL]: "Quality Control",
            [PipelinePhase.FINALIZATION]: "Finalization",
        };
        return names[phase] ?? `Phase ${phase}`;
    }
}
