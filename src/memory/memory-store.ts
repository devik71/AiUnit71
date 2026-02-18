import { v4 as uuid } from "uuid";
import * as fs from "node:fs";
import * as path from "node:path";
import type { MemoryEntry } from "../core/types.js";
import { logger } from "../core/logger.js";

/**
 * In-memory store with optional file-based persistence for room memory.
 * Each room maintains its own context that agents can read/write concurrently.
 *
 * If `persistDir` is set, entries are saved as JSON files per room
 * at `{persistDir}/{roomId}.json` after each write.
 */
export class MemoryStore {
  private entries: Map<string, MemoryEntry[]> = new Map();
  private persistDir: string | null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private dirtyRooms: Set<string> = new Set();

  constructor(persistDir?: string) {
    this.persistDir = persistDir ?? null;

    if (this.persistDir) {
      fs.mkdirSync(this.persistDir, { recursive: true });
      this.loadAll();
    }
  }

  /** Add a memory entry for a room */
  add(
    roomId: string,
    entry: Omit<MemoryEntry, "id" | "timestamp">
  ): MemoryEntry {
    const full: MemoryEntry = {
      ...entry,
      id: uuid(),
      timestamp: new Date(),
    };

    const roomEntries = this.entries.get(roomId) || [];
    roomEntries.push(full);
    this.entries.set(roomId, roomEntries);

    logger.debug(`Memory stored in room ${roomId}: [${entry.type}] ${entry.content.slice(0, 80)}...`);

    // Schedule debounced save
    if (this.persistDir) {
      this.dirtyRooms.add(roomId);
      this.scheduleSave();
    }

    return full;
  }

  /** Get all memory entries for a room */
  getByRoom(roomId: string): MemoryEntry[] {
    return this.entries.get(roomId) || [];
  }

  /** Get entries by type for a room */
  getByType(roomId: string, type: MemoryEntry["type"]): MemoryEntry[] {
    return this.getByRoom(roomId).filter((e) => e.type === type);
  }

  /** Get recent entries for a room (last N) */
  getRecent(roomId: string, count: number): MemoryEntry[] {
    const entries = this.getByRoom(roomId);
    return entries.slice(-count);
  }

  /** Search memory by content substring */
  search(roomId: string, query: string): MemoryEntry[] {
    const lower = query.toLowerCase();
    return this.getByRoom(roomId).filter((e) =>
      e.content.toLowerCase().includes(lower)
    );
  }

  /** Get context string for an agent (recent memory formatted as context) */
  getContextForAgent(roomId: string, maxEntries: number = 20): string {
    const recent = this.getRecent(roomId, maxEntries);
    if (recent.length === 0) return "No previous context available.";

    return recent
      .map((e) => {
        const agent = e.agentId ? ` (agent: ${e.agentId})` : "";
        return `[${e.type}]${agent} ${e.content}`;
      })
      .join("\n");
  }

  /** Clear all memory for a room */
  clearRoom(roomId: string): void {
    this.entries.delete(roomId);
    if (this.persistDir) {
      const filePath = path.join(this.persistDir, `${roomId}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }

  /** Export room memory as Markdown */
  exportAsMarkdown(roomId: string): string {
    const entries = this.getByRoom(roomId);
    if (entries.length === 0) return `# Room: ${roomId}\n\nNo entries yet.\n`;

    let md = `# Room: ${roomId} — Memory Log\n\n`;
    for (const e of entries) {
      md += `## [${e.type.toUpperCase()}] ${e.timestamp.toISOString()}\n`;
      if (e.agentId) md += `**Agent:** ${e.agentId}\n`;
      if (e.taskId) md += `**Task:** ${e.taskId}\n`;
      md += `\n${e.content}\n\n---\n\n`;
    }
    return md;
  }

  // ─── File Persistence ─────────────────────────────────────────

  /** Force save all dirty rooms immediately */
  flush(): void {
    if (!this.persistDir) return;

    for (const roomId of this.dirtyRooms) {
      this.saveRoom(roomId);
    }
    this.dirtyRooms.clear();

    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  /** Save all rooms to disk */
  saveAll(): void {
    if (!this.persistDir) return;
    for (const roomId of this.entries.keys()) {
      this.saveRoom(roomId);
    }
  }

  private saveRoom(roomId: string): void {
    if (!this.persistDir) return;

    const filePath = path.join(this.persistDir, `${this.sanitizeFilename(roomId)}.json`);
    const entries = this.entries.get(roomId) || [];

    try {
      fs.writeFileSync(filePath, JSON.stringify(entries, null, 2), "utf-8");
    } catch (err) {
      logger.warn(`Failed to save memory for room ${roomId}: ${err}`);
    }
  }

  private loadAll(): void {
    if (!this.persistDir || !fs.existsSync(this.persistDir)) return;

    const files = fs.readdirSync(this.persistDir).filter((f) => f.endsWith(".json"));

    for (const file of files) {
      const roomId = file.replace(/\.json$/, "");
      const filePath = path.join(this.persistDir, file);

      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const entries = JSON.parse(raw) as MemoryEntry[];

        // Restore Date objects from JSON strings
        for (const entry of entries) {
          entry.timestamp = new Date(entry.timestamp);
        }

        this.entries.set(roomId, entries);
        logger.debug(`Loaded ${entries.length} memory entries for room ${roomId}`);
      } catch (err) {
        logger.warn(`Failed to load memory for room ${roomId}: ${err}`);
      }
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer) return; // Already scheduled

    // Debounce: save after 500ms of inactivity
    this.saveTimer = setTimeout(() => {
      this.flush();
    }, 500);
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9_-]/g, "_");
  }
}
