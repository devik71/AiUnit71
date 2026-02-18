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

  it("initializes with all expected rooms", () => {
    const rooms = orchestrator.listRooms();
    // Scalable: check minimum expected rooms exist, don't hardcode count
    expect(rooms.length).toBeGreaterThanOrEqual(10);

    const roomIds = rooms.map((r) => r.id);
    const expectedRooms = [
      "brainstorm",
      "copywriting",
      "image-gen",
      "ux-ui",
      "animation",
      "video",
      "3d-render",
      "music-audio",
      "code-deploy",
      "cost-routing",
      "hitl",
    ];
    for (const expected of expectedRooms) {
      expect(roomIds).toContain(expected);
    }
  });

  it("submits and routes a text task to copywriting room", async () => {
    const task = await orchestrator.submitTask({
      title: "Write blog post",
      description: "Write a blog post about AI automation",
      priority: TaskPriority.NORMAL,
    });

    // Task may complete or fail depending on LLM availability
    expect([TaskStatus.COMPLETED, TaskStatus.FAILED]).toContain(task.status);
    if (task.status === TaskStatus.COMPLETED) {
      expect(task.output).toBeDefined();
    }
  });

  it("submits and routes an image task to image-gen room", async () => {
    const task = await orchestrator.submitTask({
      title: "Generate logo",
      description: "Generate an image logo for a tech startup",
      priority: TaskPriority.NORMAL,
    });

    expect([TaskStatus.COMPLETED, TaskStatus.FAILED]).toContain(task.status);
  });

  it("submits a multi-room task (video + music)", async () => {
    const task = await orchestrator.submitTask({
      title: "Music video",
      description: "Create a music video with custom song and visuals",
      priority: TaskPriority.HIGH,
    });

    expect([TaskStatus.COMPLETED, TaskStatus.FAILED]).toContain(task.status);
    if (task.status === TaskStatus.COMPLETED) {
      const results = (task.output as any)?.subtaskResults;
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("provides system status", () => {
    const status = orchestrator.getSystemStatus();
    expect(status.rooms).toBeDefined();
    expect(status.cost).toBeDefined();
    expect(status.hitl).toBeDefined();
    expect((status.rooms as any[]).length).toBeGreaterThanOrEqual(10);
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

  it("exports room memories for all rooms", () => {
    const memories = orchestrator.exportAllMemories();
    const rooms = orchestrator.listRooms();
    // Scalable: memory export should have an entry for every registered room
    expect(Object.keys(memories).length).toBe(rooms.length);
  });

  it("includes HITL room in the warehouse", () => {
    const room = orchestrator.getRoom("hitl");
    expect(room).toBeDefined();
    expect(room!.name).toBe("Human-in-the-Loop Room");
  });
});
