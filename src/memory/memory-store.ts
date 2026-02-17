import { v4 as uuid } from "uuid";
import type { MemoryEntry } from "../core/types.js";
import { logger } from "../core/logger.js";

/**
 * In-memory store with Markdown persistence for room memory and experience logs.
 * Each room maintains its own context that agents can read/write concurrently.
 */
export class MemoryStore {
  private entries: Map<string, MemoryEntry[]> = new Map();

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
}
