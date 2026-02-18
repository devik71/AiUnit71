import { v4 as uuid } from "uuid";
import type {
  Task,
  TaskInput,
  ModelCapability,
} from "../core/types.js";
import { TaskStatus, TaskPriority, TaskInputSchema } from "../core/types.js";
import { logger } from "../core/logger.js";
import type { BaseRoom } from "../rooms/base-room.js";

/** Room capability mapping for routing decisions */
const ROOM_CAPABILITY_MAP: Record<string, ModelCapability[]> = {
  briefing: ["text-generation", "analysis"],
  brainstorm: ["text-generation", "analysis"],
  copywriting: ["text-generation"],
  "image-gen": ["image-generation"],
  jobmaster: ["text-generation", "analysis"],
  "ux-ui": ["text-generation", "image-generation"],
  animation: ["text-generation", "image-generation"],
  video: ["video-generation"],
  "3d-render": ["3d-generation", "code-generation"],
  "music-audio": ["audio-generation", "voice-cloning"],
  "code-deploy": ["code-generation"],
  evaluation: ["text-generation", "analysis"],
  finalizer: ["text-generation", "analysis"],
  reportmaster: ["text-generation", "analysis"],
  "cost-routing": ["analysis"],
  learning: ["text-generation", "analysis"],
  recruiter: ["text-generation", "analysis"],
};

/** Keywords that map to specific rooms */
const KEYWORD_ROOM_MAP: Record<string, string[]> = {
  briefing: ["brief", "briefing", "project request", "client request", "order", "замовлення", "бріф"],
  brainstorm: ["brainstorm", "idea", "concept", "moodboard", "creative direction"],
  copywriting: ["copy", "text", "write", "blog", "ad copy", "script", "lyrics", "smm", "caption", "post"],
  "image-gen": ["image", "photo", "picture", "illustration", "graphic", "visual", "banner", "poster"],
  jobmaster: ["distribute", "assign", "роздача", "розподіл", "plan tasks", "execution plan", "task list"],
  "ux-ui": ["ui", "ux", "design", "wireframe", "prototype", "layout", "interface", "figma", "brandbook"],
  animation: ["animate", "animation", "lottie", "motion", "mascot animation", "loading"],
  video: ["video", "clip", "reel", "music video", "commercial", "trailer"],
  "3d-render": ["3d", "render", "model", "blender", "mesh", "texture"],
  "music-audio": ["music", "song", "audio", "voice", "jingle", "podcast", "sound"],
  "code-deploy": ["code", "deploy", "website", "app", "api", "skill", "next.js", "vercel"],
  evaluation: ["evaluate", "quality", "qa", "score", "оцінка", "якість", "перевірка"],
  reportmaster: ["report", "звіт", "summary", "підсумок", "quality control"],
  finalizer: ["finalize", "deliver", "package", "фіналізація", "поставка", "архів"],
  learning: ["learn", "skill", "train", "acquire", "teach", "study", "master"],
  recruiter: ["hire", "recruit", "create agent", "new agent", "specialist", "build a", "need a"],
};

export interface PlannerResult {
  subtasks: Task[];
  parallelGroups: string[][]; // groups of task IDs that can run in parallel
  reasoning: string;
}

/**
 * Planner — decomposes incoming tasks into subtasks and routes them to the best rooms.
 *
 * Flow:
 * 1. Parse the task description for required capabilities
 * 2. Match capabilities to available rooms
 * 3. Create subtasks with dependency ordering
 * 4. Identify parallel execution groups (creative processes run in parallel)
 * 5. Return execution plan
 */
export class Planner {
  private rooms: Map<string, BaseRoom>;

  constructor(rooms: Map<string, BaseRoom>) {
    this.rooms = rooms;
  }

  /** Plan and decompose a high-level task */
  plan(input: TaskInput): PlannerResult {
    const validated = TaskInputSchema.parse(input);
    const description = validated.description.toLowerCase();

    // Identify which rooms are needed
    const neededRooms = this.identifyRooms(description);

    if (neededRooms.length === 0) {
      // Default to brainstorm if we can't determine the room
      neededRooms.push("brainstorm");
    }

    // Create subtasks for each room
    const subtasks: Task[] = [];
    const parallelGroups: string[][] = [];
    const currentParallelGroup: string[] = [];

    for (const roomId of neededRooms) {
      const room = this.rooms.get(roomId);
      if (!room) {
        logger.warn(`Room ${roomId} not found, skipping`);
        continue;
      }

      const subtask: Task = {
        id: uuid(),
        parentId: undefined,
        title: `${room.name}: ${validated.title}`,
        description: `[Room: ${roomId}] ${validated.description}`,
        status: TaskStatus.PENDING,
        priority: validated.priority,
        assignedRoom: roomId,
        input: validated.input,
        dependencies: [],
        createdAt: new Date(),
      };

      subtasks.push(subtask);
      currentParallelGroup.push(subtask.id);
    }

    // For creative tasks, all rooms run in parallel (unbreakable creative continuity)
    if (currentParallelGroup.length > 0) {
      parallelGroups.push(currentParallelGroup);
    }

    const reasoning = this.buildReasoning(neededRooms, subtasks, parallelGroups);

    logger.info(`Planned ${subtasks.length} subtasks across ${neededRooms.length} rooms`, {
      rooms: neededRooms,
      parallelGroups: parallelGroups.length,
    });

    return { subtasks, parallelGroups, reasoning };
  }

  /** Identify which rooms are needed based on task description */
  private identifyRooms(description: string): string[] {
    const matched = new Set<string>();

    for (const [roomId, keywords] of Object.entries(KEYWORD_ROOM_MAP)) {
      for (const keyword of keywords) {
        if (description.includes(keyword)) {
          matched.add(roomId);
          break;
        }
      }
    }

    return Array.from(matched);
  }

  /** Build a human-readable reasoning string */
  private buildReasoning(
    rooms: string[],
    subtasks: Task[],
    parallelGroups: string[][]
  ): string {
    let reasoning = `Task decomposed into ${subtasks.length} subtask(s):\n`;
    for (const task of subtasks) {
      reasoning += `  → ${task.title} [Room: ${task.assignedRoom}]\n`;
    }
    if (parallelGroups.length > 0) {
      reasoning += `\nParallel execution: ${parallelGroups.length} group(s) will run concurrently.`;
      reasoning += `\nCreative continuity: All creative rooms collaborate in parallel.`;
    }
    return reasoning;
  }

  /** Dynamically create a new room if needed capability is missing */
  suggestNewRoom(capabilities: ModelCapability[]): string {
    return (
      `Suggested new room for capabilities: ${capabilities.join(", ")}. ` +
      `Auto-creation would populate it with default agents and tools for these capabilities.`
    );
  }
}
