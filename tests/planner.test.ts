import { describe, it, expect, beforeEach } from "vitest";
import { Planner } from "../src/planner/planner.js";
import { Orchestrator } from "../src/core/orchestrator.js";
import { AutonomyLevel, TaskPriority } from "../src/core/types.js";

describe("Planner", () => {
  let orchestrator: Orchestrator;

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "test-key";
    orchestrator = new Orchestrator({
      autonomyLevel: AutonomyLevel.FREERIDE,
    });
  });

  it("routes a copywriting task to the copywriting room", async () => {
    const task = await orchestrator.submitTask({
      title: "Write ad copy",
      description: "Write compelling ad copy for Facebook ads",
      priority: TaskPriority.NORMAL,
    });

    const results = (task.output as any)?.subtaskResults;
    expect(results).toBeDefined();
    expect(results.some((r: any) => r.room === "copywriting")).toBe(true);
  });

  it("routes an image task to image-gen room", async () => {
    const task = await orchestrator.submitTask({
      title: "Create banner",
      description: "Create a banner image for the website",
      priority: TaskPriority.NORMAL,
    });

    const results = (task.output as any)?.subtaskResults;
    expect(results).toBeDefined();
    expect(results.some((r: any) => r.room === "image-gen")).toBe(true);
  });

  it("detects multi-room tasks and runs them in parallel", async () => {
    const task = await orchestrator.submitTask({
      title: "Full campaign",
      description: "Create a social media campaign with images, ad copy text, and a short video clip",
      priority: TaskPriority.HIGH,
    });

    const results = (task.output as any)?.subtaskResults;
    expect(results).toBeDefined();
    // Should hit at least image-gen, copywriting, and video rooms
    const rooms = results.map((r: any) => r.room);
    expect(rooms.length).toBeGreaterThanOrEqual(2);
  });

  it("defaults to brainstorm room when no keywords match", async () => {
    const task = await orchestrator.submitTask({
      title: "Generic task",
      description: "Do something creative and interesting",
      priority: TaskPriority.LOW,
    });

    const results = (task.output as any)?.subtaskResults;
    expect(results).toBeDefined();
    expect(results.some((r: any) => r.room === "brainstorm")).toBe(true);
  });
});
