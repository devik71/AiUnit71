import { describe, it, expect, beforeEach } from "vitest";
import { Orchestrator } from "../src/core/orchestrator.js";
import { AutonomyLevel, TaskPriority, TaskStatus } from "../src/core/types.js";

describe("Orchestrator", () => {
  let orchestrator: Orchestrator;

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "test-key";
    orchestrator = new Orchestrator({
      autonomyLevel: AutonomyLevel.FREERIDE,
    });
  });

  it("initializes with all rooms", () => {
    const rooms = orchestrator.listRooms();
    expect(rooms.length).toBe(10);

    const roomIds = rooms.map((r) => r.id);
    expect(roomIds).toContain("brainstorm");
    expect(roomIds).toContain("copywriting");
    expect(roomIds).toContain("image-gen");
    expect(roomIds).toContain("ux-ui");
    expect(roomIds).toContain("animation");
    expect(roomIds).toContain("video");
    expect(roomIds).toContain("3d-render");
    expect(roomIds).toContain("music-audio");
    expect(roomIds).toContain("code-deploy");
    expect(roomIds).toContain("cost-routing");
  });

  it("submits and routes a text task to copywriting room", async () => {
    const task = await orchestrator.submitTask({
      title: "Write blog post",
      description: "Write a blog post about AI automation",
      priority: TaskPriority.NORMAL,
    });

    expect(task.status).toBe(TaskStatus.COMPLETED);
    expect(task.output).toBeDefined();
  });

  it("submits and routes an image task to image-gen room", async () => {
    const task = await orchestrator.submitTask({
      title: "Generate logo",
      description: "Generate an image logo for a tech startup",
      priority: TaskPriority.NORMAL,
    });

    expect(task.status).toBe(TaskStatus.COMPLETED);
  });

  it("submits a multi-room task (video + music)", async () => {
    const task = await orchestrator.submitTask({
      title: "Music video",
      description: "Create a music video with custom song and visuals",
      priority: TaskPriority.HIGH,
    });

    expect(task.status).toBe(TaskStatus.COMPLETED);
    const results = (task.output as any)?.subtaskResults;
    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it("provides system status", () => {
    const status = orchestrator.getSystemStatus();
    expect(status.rooms).toBeDefined();
    expect(status.cost).toBeDefined();
    expect(status.hitl).toBeDefined();
  });

  it("manages autonomy levels", () => {
    const hitl = orchestrator.getHitlManager();
    expect(hitl.getAutonomy()).toBe(AutonomyLevel.FREERIDE);

    orchestrator.setAutonomy(AutonomyLevel.LOCKED);
    expect(hitl.getAutonomy()).toBe(AutonomyLevel.LOCKED);
  });

  it("gets room by ID", () => {
    const room = orchestrator.getRoom("brainstorm");
    expect(room).toBeDefined();
    expect(room!.name).toBe("Brainstorm Room");
  });

  it("returns undefined for unknown room", () => {
    const room = orchestrator.getRoom("nonexistent");
    expect(room).toBeUndefined();
  });

  it("exports room memories", () => {
    const memories = orchestrator.exportAllMemories();
    expect(Object.keys(memories).length).toBe(10);
  });
});
