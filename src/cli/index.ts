#!/usr/bin/env node

import { Command } from "commander";
import { Orchestrator } from "../core/orchestrator.js";
import { NicheAdapter } from "../adapters/niche-adapter.js";
import { AutonomyLevel, TaskPriority } from "../core/types.js";
import { logger } from "../core/logger.js";

const program = new Command();

program
  .name("aiunit71")
  .description("AiUnit71 — Multi-room AI Agent Factory for Creative Production")
  .version("0.1.0");

// ─── Status Command ──────────────────────────────────────────────
program
  .command("status")
  .description("Show system status and all rooms")
  .action(() => {
    const orchestrator = new Orchestrator();
    const status = orchestrator.getSystemStatus();
    console.log("\n🏭 AiUnit71 System Status\n");
    console.log("Rooms:");
    for (const room of status.rooms as Array<{ id: string; name: string; status: string }>) {
      const icon = room.status === "active" ? "●" : "○";
      console.log(`  ${icon} ${room.name.padEnd(30)} [${room.id}] ${room.status}`);
    }
    console.log(`\nActive Tasks: ${status.activeTasks}`);
    console.log(`Total Tasks: ${status.totalTasks}`);
    console.log(`Cost: ${status.cost}`);
    console.log(`HITL: ${JSON.stringify(status.hitl)}\n`);
  });

// ─── Run Task Command ────────────────────────────────────────────
program
  .command("run")
  .description("Submit a task to the orchestrator")
  .argument("<description>", "Task description")
  .option("-t, --title <title>", "Task title")
  .option("-p, --priority <level>", "Priority: low, normal, high, critical", "normal")
  .option("--freeride", "Enable freeride mode (full autonomy)")
  .action(async (description: string, options: { title?: string; priority: string; freeride?: boolean }) => {
    const orchestrator = new Orchestrator();

    if (options.freeride) {
      orchestrator.enableFreeride();
    }

    const priorityMap: Record<string, TaskPriority> = {
      low: TaskPriority.LOW,
      normal: TaskPriority.NORMAL,
      high: TaskPriority.HIGH,
      critical: TaskPriority.CRITICAL,
    };

    console.log("\n🏭 AiUnit71 — Processing Task\n");

    const task = await orchestrator.submitTask({
      title: options.title || description.slice(0, 60),
      description,
      priority: priorityMap[options.priority] || TaskPriority.NORMAL,
    });

    console.log(`\nTask ${task.id}: ${task.status}`);
    if (task.output) {
      console.log("Output:", JSON.stringify(task.output, null, 2));
    }
    if (task.error) {
      console.log("Error:", task.error);
    }
    console.log(`\n${orchestrator.getCostSummary()}\n`);
  });

// ─── Cost Compare Command ────────────────────────────────────────
program
  .command("cost")
  .description("Compare model costs for a capability")
  .argument("<capability>", "Capability to compare (e.g., text-generation, image-generation)")
  .option("-i, --input <tokens>", "Input tokens", "1000")
  .option("-o, --output <tokens>", "Output tokens", "1000")
  .action((capability: string, options: { input: string; output: string }) => {
    const orchestrator = new Orchestrator();
    const room = orchestrator.getRoom("cost-routing") as any;
    if (room) {
      console.log(
        room.formatComparison(
          [capability],
          parseInt(options.input),
          parseInt(options.output)
        )
      );
    }
  });

// ─── Niche Command ───────────────────────────────────────────────
program
  .command("niche")
  .description("Browse and generate niche-specific service packages")
  .argument("[niche-id]", "Niche ID to view (omit to list all)")
  .action((nicheId?: string) => {
    const adapter = new NicheAdapter();

    if (!nicheId) {
      console.log("\n📋 Available Niches:\n");
      for (const niche of adapter.listNiches()) {
        console.log(`  ${niche.id.padEnd(20)} ${niche.name.padEnd(25)} (${niche.packageCount} packages)`);
      }
      console.log("\nRun: aiunit71 niche <niche-id> to see packages\n");
      return;
    }

    const proposal = adapter.generateProposal(nicheId);
    console.log(proposal);
  });

// ─── Rooms Command ───────────────────────────────────────────────
program
  .command("rooms")
  .description("List all available rooms and their status")
  .option("-d, --detail <room-id>", "Show detailed status for a room")
  .action((options: { detail?: string }) => {
    const orchestrator = new Orchestrator();

    if (options.detail) {
      const status = orchestrator.getRoomStatus(options.detail);
      if (status) {
        console.log(JSON.stringify(status, null, 2));
      } else {
        console.log(`Room "${options.detail}" not found.`);
      }
      return;
    }

    console.log("\n🏠 AiUnit71 Room Warehouse\n");
    for (const room of orchestrator.listRooms()) {
      console.log(`  [${room.status === "active" ? "ACTIVE" : "IDLE  "}] ${room.name.padEnd(30)} (${room.id})`);
    }
    console.log();
  });

// ─── HITL Command ────────────────────────────────────────────────
program
  .command("hitl")
  .description("Human-in-the-Loop control")
  .option("-s, --status", "Show HITL status")
  .option("-a, --autonomy <level>", "Set autonomy: locked, supervised, guided, freeride")
  .option("--approve <task-id>", "Approve a pending task")
  .option("--reject <task-id>", "Reject a pending task")
  .action((options: { status?: boolean; autonomy?: string; approve?: string; reject?: string }) => {
    const orchestrator = new Orchestrator();
    const hitl = orchestrator.getHitlManager();

    if (options.autonomy) {
      const levelMap: Record<string, AutonomyLevel> = {
        locked: AutonomyLevel.LOCKED,
        supervised: AutonomyLevel.SUPERVISED,
        guided: AutonomyLevel.GUIDED,
        freeride: AutonomyLevel.FREERIDE,
      };
      const level = levelMap[options.autonomy];
      if (level !== undefined) {
        hitl.setAutonomy(level);
        console.log(`Autonomy set to: ${options.autonomy.toUpperCase()}`);
      }
    }

    if (options.approve) {
      hitl.approve(options.approve);
      console.log(`Approved: ${options.approve}`);
    }

    if (options.reject) {
      hitl.reject(options.reject, "Rejected via CLI");
      console.log(`Rejected: ${options.reject}`);
    }

    console.log("\nHITL Status:", JSON.stringify(hitl.getStats(), null, 2));
  });

program.parse();
