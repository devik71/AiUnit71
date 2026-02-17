import { AutonomyLevel } from "../core/types.js";
import type { Task } from "../core/types.js";
import { eventBus } from "../core/event-bus.js";
import { logger } from "../core/logger.js";

export interface ApprovalRequest {
  taskId: string;
  action: string;
  description: string;
  estimatedCostUsd: number;
  roomId: string;
  autonomyLevel: AutonomyLevel;
  timestamp: Date;
  status: "pending" | "approved" | "rejected";
  resolvedBy?: string;
  rejectionReason?: string;
}

/**
 * Human-in-the-Loop Manager
 *
 * Controls when human approval is needed based on autonomy levels:
 * - Level 0 (LOCKED): Every action requires approval
 * - Level 1 (SUPERVISED): Critical actions need approval (cost > threshold, deployments)
 * - Level 2 (GUIDED): Only destructive/costly actions need approval
 * - Level 3 (FREERIDE): Full autonomy, no approvals needed
 */
export class HitlManager {
  private globalAutonomy: AutonomyLevel;
  private pendingApprovals: Map<string, ApprovalRequest> = new Map();
  private costThreshold: number;
  private approvalHistory: ApprovalRequest[] = [];

  constructor(
    defaultAutonomy: AutonomyLevel = AutonomyLevel.SUPERVISED,
    costThreshold: number = 0.10
  ) {
    this.globalAutonomy = defaultAutonomy;
    this.costThreshold = costThreshold;
    logger.info(`HITL Manager initialized: autonomy=${AutonomyLevel[defaultAutonomy]}, costThreshold=$${costThreshold}`);
  }

  /** Check if an action needs human approval */
  needsApproval(
    action: string,
    estimatedCostUsd: number,
    roomAutonomy?: AutonomyLevel
  ): boolean {
    const effectiveAutonomy = roomAutonomy ?? this.globalAutonomy;

    switch (effectiveAutonomy) {
      case AutonomyLevel.LOCKED:
        return true;

      case AutonomyLevel.SUPERVISED:
        return this.isCriticalAction(action) || estimatedCostUsd > this.costThreshold;

      case AutonomyLevel.GUIDED:
        return this.isDestructiveAction(action) || estimatedCostUsd > this.costThreshold * 5;

      case AutonomyLevel.FREERIDE:
        return false;
    }
  }

  /** Request approval for an action */
  requestApproval(
    taskId: string,
    action: string,
    description: string,
    estimatedCostUsd: number,
    roomId: string,
    roomAutonomy: AutonomyLevel
  ): ApprovalRequest {
    const request: ApprovalRequest = {
      taskId,
      action,
      description,
      estimatedCostUsd,
      roomId,
      autonomyLevel: roomAutonomy,
      timestamp: new Date(),
      status: "pending",
    };

    this.pendingApprovals.set(taskId, request);

    eventBus.dispatch({
      type: "hitl:approval_required",
      taskId,
      action: `${action}: ${description} (est. $${estimatedCostUsd.toFixed(4)})`,
    });

    logger.info(`Approval requested: ${action} in room ${roomId}`, {
      taskId,
      costUsd: estimatedCostUsd,
    });

    return request;
  }

  /** Approve a pending request */
  approve(taskId: string, approvedBy: string = "human"): boolean {
    const request = this.pendingApprovals.get(taskId);
    if (!request || request.status !== "pending") return false;

    request.status = "approved";
    request.resolvedBy = approvedBy;
    this.pendingApprovals.delete(taskId);
    this.approvalHistory.push(request);

    eventBus.dispatch({ type: "hitl:approved", taskId });
    logger.info(`Approved: ${request.action}`, { taskId, approvedBy });
    return true;
  }

  /** Reject a pending request */
  reject(taskId: string, reason: string, rejectedBy: string = "human"): boolean {
    const request = this.pendingApprovals.get(taskId);
    if (!request || request.status !== "pending") return false;

    request.status = "rejected";
    request.resolvedBy = rejectedBy;
    request.rejectionReason = reason;
    this.pendingApprovals.delete(taskId);
    this.approvalHistory.push(request);

    eventBus.dispatch({ type: "hitl:rejected", taskId, reason });
    logger.info(`Rejected: ${request.action} — ${reason}`, { taskId });
    return true;
  }

  /** Get all pending approvals */
  getPendingApprovals(): ApprovalRequest[] {
    return Array.from(this.pendingApprovals.values());
  }

  /** Set global autonomy level */
  setAutonomy(level: AutonomyLevel): void {
    const old = this.globalAutonomy;
    this.globalAutonomy = level;
    logger.info(`Autonomy changed: ${AutonomyLevel[old]} → ${AutonomyLevel[level]}`);
  }

  /** Get current autonomy level */
  getAutonomy(): AutonomyLevel {
    return this.globalAutonomy;
  }

  /** Enable freeride mode (full autonomy) */
  enableFreeride(): void {
    this.setAutonomy(AutonomyLevel.FREERIDE);
  }

  /** Get approval statistics */
  getStats(): Record<string, unknown> {
    const approved = this.approvalHistory.filter((r) => r.status === "approved").length;
    const rejected = this.approvalHistory.filter((r) => r.status === "rejected").length;
    return {
      currentAutonomy: AutonomyLevel[this.globalAutonomy],
      pendingCount: this.pendingApprovals.size,
      totalApproved: approved,
      totalRejected: rejected,
      costThreshold: this.costThreshold,
    };
  }

  // ─── Private helpers ───────────────────────────────────────────

  private isCriticalAction(action: string): boolean {
    const criticalActions = [
      "deploy",
      "publish",
      "send_email",
      "api_call_external",
      "payment",
      "delete",
      "modify_production",
    ];
    return criticalActions.some((a) => action.toLowerCase().includes(a));
  }

  private isDestructiveAction(action: string): boolean {
    const destructiveActions = ["delete", "drop", "destroy", "reset", "overwrite"];
    return destructiveActions.some((a) => action.toLowerCase().includes(a));
  }
}
