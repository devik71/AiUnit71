/**
 * PromptMemory — persistent library of successful prompts.
 *
 * Based on AiUnit71 Architecture Specification v1.0, Section 14.
 *
 * Every approved generation writes to PromptMemory. Future missions
 * can query by similarity (industry, mission type, style tags) to
 * retrieve and reuse proven prompts — reducing iterations and cost.
 *
 * The "Memory compounds" principle: each mission makes the next cheaper.
 */

import { logger } from "../core/logger.js";
import type { SemanticPromptJson, RenderedPrompt } from "./hook-system.js";
import type { MissionType } from "./mission-context.js";

// ─── Prompt Memory Entry ─────────────────────────────────────────────────

export interface PromptMemoryEntry {
  id: string;
  /** The original semantic JSON prompt */
  semanticJson: SemanticPromptJson;
  /** Rendered versions for each model */
  renderedPrompts: Partial<Record<string, RenderedPrompt>>;
  /** Which tool was actually used */
  tool_used: string;
  /** Generation parameters */
  params: Record<string, unknown>;
  /** Human quality score (1-10) */
  human_score: number;
  /** Mission context */
  mission_type: MissionType;
  industry: string;
  /** How many iterations before approval */
  iterations_to_approve: number;
  /** Total cost in USD */
  total_cost_usd: number;
  /** Searchable tags */
  tags: string[];
  /** When this was recorded */
  created_at: Date;
  /** How many times this was retrieved and reused */
  reuse_count: number;
}

// ─── Search Query ──────────────────────────────────────────────────────

export interface PromptSearchQuery {
  mission_type?: MissionType;
  industry?: string;
  tags?: string[];
  min_score?: number;
  max_cost?: number;
  tool_preferred?: string;
}

export interface SearchResult {
  entry: PromptMemoryEntry;
  /** Relevance score 0-1 */
  relevance: number;
}

// ─── Prompt Memory ────────────────────────────────────────────────────

export class PromptMemory {
  private entries: Map<string, PromptMemoryEntry> = new Map();
  private static _instance: PromptMemory;

  static get instance(): PromptMemory {
    if (!PromptMemory._instance) {
      PromptMemory._instance = new PromptMemory();
    }
    return PromptMemory._instance;
  }

  // ─── Write ────────────────────────────────────────────────────────────

  /**
   * Record a successful prompt to memory.
   * Called after human approval of a generated artifact.
   */
  record(entry: Omit<PromptMemoryEntry, "id" | "created_at" | "reuse_count">): PromptMemoryEntry {
    const id = `pm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const full: PromptMemoryEntry = {
      ...entry,
      id,
      created_at: new Date(),
      reuse_count: 0,
    };
    this.entries.set(id, full);

    logger.info(
      `[PromptMemory] Recorded: ${id} | score=${entry.human_score} | tool=${entry.tool_used} | cost=$${entry.total_cost_usd.toFixed(3)} | tags=[${entry.tags.join(", ")}]`
    );

    return full;
  }

  // ─── Read ─────────────────────────────────────────────────────────────

  /**
   * Search for prompts matching a query.
   * Returns results sorted by relevance (highest first).
   */
  search(query: PromptSearchQuery, limit = 5): SearchResult[] {
    const results: SearchResult[] = [];

    for (const entry of this.entries.values()) {
      const relevance = this.calculateRelevance(entry, query);
      if (relevance > 0) {
        results.push({ entry, relevance });
      }
    }

    // Sort by relevance desc, then by score desc
    results.sort((a, b) => {
      if (Math.abs(a.relevance - b.relevance) > 0.05) {
        return b.relevance - a.relevance;
      }
      return b.entry.human_score - a.entry.human_score;
    });

    const topResults = results.slice(0, limit);

    // Increment reuse count for returned results
    for (const r of topResults) {
      r.entry.reuse_count++;
    }

    if (topResults.length > 0) {
      logger.debug(
        `[PromptMemory] Found ${topResults.length} matches for query (top relevance: ${topResults[0].relevance.toFixed(2)})`
      );
    }

    return topResults;
  }

  /**
   * Get a specific entry by ID.
   */
  get(id: string): PromptMemoryEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * Get all entries (for analytics/dashboard).
   */
  getAll(): PromptMemoryEntry[] {
    return Array.from(this.entries.values());
  }

  // ─── Analytics ────────────────────────────────────────────────────────

  /**
   * Get analytics for the prompt library.
   */
  getAnalytics(): PromptMemoryAnalytics {
    const all = this.getAll();

    if (all.length === 0) {
      return {
        totalEntries: 0,
        avgScore: 0,
        avgIterationsToApprove: 0,
        avgCost: 0,
        topTags: [],
        topTools: [],
        topIndustries: [],
        totalReuses: 0,
      };
    }

    const avgScore = all.reduce((s, e) => s + e.human_score, 0) / all.length;
    const avgIter = all.reduce((s, e) => s + e.iterations_to_approve, 0) / all.length;
    const avgCost = all.reduce((s, e) => s + e.total_cost_usd, 0) / all.length;
    const totalReuses = all.reduce((s, e) => s + e.reuse_count, 0);

    const tagCounts = new Map<string, number>();
    const toolCounts = new Map<string, number>();
    const industryCounts = new Map<string, number>();

    for (const entry of all) {
      for (const tag of entry.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
      toolCounts.set(entry.tool_used, (toolCounts.get(entry.tool_used) ?? 0) + 1);
      industryCounts.set(entry.industry, (industryCounts.get(entry.industry) ?? 0) + 1);
    }

    const topN = (map: Map<string, number>, n: number) =>
      Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([key, count]) => ({ key, count }));

    return {
      totalEntries: all.length,
      avgScore: Math.round(avgScore * 10) / 10,
      avgIterationsToApprove: Math.round(avgIter * 10) / 10,
      avgCost: Math.round(avgCost * 1000) / 1000,
      topTags: topN(tagCounts, 10),
      topTools: topN(toolCounts, 5),
      topIndustries: topN(industryCounts, 5),
      totalReuses,
    };
  }

  /**
   * Get the best-performing prompts (highest score/cost ratio).
   */
  getBestPrompts(limit = 10): PromptMemoryEntry[] {
    return this.getAll()
      .filter((e) => e.human_score >= 7)
      .sort((a, b) => {
        // ROI = score / (cost * iterations)
        const roiA = a.human_score / (Math.max(a.total_cost_usd, 0.01) * a.iterations_to_approve);
        const roiB = b.human_score / (Math.max(b.total_cost_usd, 0.01) * b.iterations_to_approve);
        return roiB - roiA;
      })
      .slice(0, limit);
  }

  // ─── Relevance Calculation ────────────────────────────────────────────

  private calculateRelevance(
    entry: PromptMemoryEntry,
    query: PromptSearchQuery
  ): number {
    let score = 0;
    let maxScore = 0;

    // Mission type match (weight: 0.3)
    maxScore += 0.3;
    if (query.mission_type) {
      if (entry.mission_type === query.mission_type) score += 0.3;
    } else {
      score += 0.15; // Partial score if no filter
    }

    // Industry match (weight: 0.25)
    maxScore += 0.25;
    if (query.industry) {
      if (entry.industry.toLowerCase() === query.industry.toLowerCase()) score += 0.25;
      else if (
        entry.industry.toLowerCase().includes(query.industry.toLowerCase()) ||
        query.industry.toLowerCase().includes(entry.industry.toLowerCase())
      ) {
        score += 0.1; // Partial
      }
    } else {
      score += 0.1;
    }

    // Tag overlap (weight: 0.25)
    maxScore += 0.25;
    if (query.tags?.length) {
      const queryTags = new Set(query.tags.map((t) => t.toLowerCase()));
      const entryTags = new Set(entry.tags.map((t) => t.toLowerCase()));
      const overlap = [...queryTags].filter((t) => entryTags.has(t)).length;
      score += (overlap / queryTags.size) * 0.25;
    } else {
      score += 0.1;
    }

    // Score filter (weight: 0.1)
    maxScore += 0.1;
    if (query.min_score !== undefined) {
      if (entry.human_score >= query.min_score) score += 0.1;
      else return 0; // Hard filter — must meet min score
    } else {
      score += entry.human_score / 100;
    }

    // Cost filter (weight: 0.1)
    maxScore += 0.1;
    if (query.max_cost !== undefined) {
      if (entry.total_cost_usd > query.max_cost) return 0; // Hard filter
      score += 0.1;
    } else {
      score += 0.05;
    }

    // Tool preference (weight: 0.0 — soft bonus)
    if (query.tool_preferred && entry.tool_used === query.tool_preferred) {
      score += 0.05;
    }

    return Math.min(1, score);
  }

  // ─── Serialization ────────────────────────────────────────────────────

  /**
   * Export the memory store to a plain JSON array (for persistence).
   */
  export(): PromptMemoryEntry[] {
    return this.getAll();
  }

  /**
   * Import entries from a persisted JSON array.
   */
  import(entries: PromptMemoryEntry[]): void {
    for (const entry of entries) {
      this.entries.set(entry.id, {
        ...entry,
        created_at: new Date(entry.created_at),
      });
    }
    logger.info(`[PromptMemory] Imported ${entries.length} entries`);
  }

  /**
   * Clear all entries (for testing).
   */
  clear(): void {
    this.entries.clear();
  }
}

// ─── Analytics Type ───────────────────────────────────────────────────

export interface PromptMemoryAnalytics {
  totalEntries: number;
  avgScore: number;
  avgIterationsToApprove: number;
  avgCost: number;
  topTags: Array<{ key: string; count: number }>;
  topTools: Array<{ key: string; count: number }>;
  topIndustries: Array<{ key: string; count: number }>;
  totalReuses: number;
}
