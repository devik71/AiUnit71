import * as fs from "node:fs";
import * as path from "node:path";
import { logger } from "../core/logger.js";

/**
 * SonaPattern — a past task execution stored for few-shot retrieval.
 * Indexed by niche + task_type. Retrieved pre-task to prime the agent.
 * Stored post-task with qc_score so quality improves over time.
 */
export interface SonaPattern {
  id: string;
  niche: string;
  task_type: string;
  prompt_summary: string;
  output_excerpt: string; // first ~400 chars of the output
  qc_score: number;       // 0–10, from output-reviewer
  dimensions: {
    brief_compliance?: number;
    brand_voice?: number;
    audience_fit?: number;
    anti_slop?: number;
    execution_quality?: number;
  };
  metadata: Record<string, unknown>;
  created_at: string; // ISO timestamp
  consolidated?: boolean; // false until processed by consolidation layer
}

/**
 * SonaInsight — a cross-pattern connection generated during Active Consolidation.
 * Represents synthesized knowledge ("sleep/REM" processing).
 */
export interface SonaInsight {
  id: string;
  source_patterns: string[]; // pattern IDs that generated this
  connection: string;        // what connects them
  applicable_to: string[];   // niches where this applies
  confidence: number;        // 0–1
  created_at: string;
}

/**
 * SonaPatternStore — cross-mission pattern library.
 *
 * Agents call preTaskHook() before generating content to receive
 * the top-k exemplars as few-shot context. After output-reviewer
 * scores the output, postTaskHook() stores it for future retrieval.
 *
 * Data is persisted to a single JSON file at `persistPath`.
 */
export class SonaPatternStore {
  private patterns: SonaPattern[] = [];
  private insights: SonaInsight[] = [];
  private persistPath: string | null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private consolidationInterval: number = 30 * 60 * 1000; // 30 mins
  private consolidationTimer: ReturnType<typeof setInterval> | null = null;

  constructor(persistPath?: string) {
    this.persistPath = persistPath ?? null;
    if (this.persistPath) {
      fs.mkdirSync(path.dirname(this.persistPath), { recursive: true });
      this.load();
    }
    this.startConsolidationLoop();
  }

  private startConsolidationLoop() {
    this.consolidationTimer = setInterval(() => {
      this.consolidate().catch(err => logger.error(`[SONA] Consolidation loop error: ${err}`));
    }, this.consolidationInterval);
  }

  public stopConsolidationLoop() {
    if (this.consolidationTimer) clearInterval(this.consolidationTimer);
  }

  // ─── Pre-task: retrieve top-k exemplars ────────────────────────────

  /**
   * Returns the top-k highest-scoring patterns for the given niche + task_type.
   * Call this before generating content; inject results as few-shot examples.
   *
   * @param niche      e.g. "specialty_coffee", "b2b_saas"
   * @param task_type  e.g. "product_description", "linkedin_post", "tov_document"
   * @param k          number of exemplars to return (default 3)
   * @param minScore   minimum qc_score to include (default 7.0)
   */
  preTaskHook(
    niche: string,
    task_type: string,
    k = 3,
    minScore = 7.0
  ): { patterns: SonaPattern[]; insights: SonaInsight[] } {
    const matchedPatterns = this.patterns
      .filter(
        (p) =>
          p.niche === niche &&
          p.task_type === task_type &&
          p.qc_score >= minScore
      )
      .sort((a, b) => b.qc_score - a.qc_score)
      .slice(0, k);

    // Also pull high-confidence insights applicable to this niche
    const matchedInsights = this.insights
      .filter((i) => i.applicable_to.includes(niche) && i.confidence >= 0.7)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 2);

    logger.debug(
      `[SONA] preTaskHook niche=${niche} task=${task_type} → ${matchedPatterns.length} exemplars, ${matchedInsights.length} insights`
    );
    return { patterns: matchedPatterns, insights: matchedInsights };
  }

  /**
   * Formats retrieved patterns as a few-shot block for prompt injection.
   * Returns empty string if no patterns found.
   */
  formatFewShot(data: { patterns: SonaPattern[]; insights: SonaInsight[] }): string {
    if (data.patterns.length === 0 && data.insights.length === 0) return "";

    let output = "## High-quality examples and insights from similar past tasks\n\n";

    if (data.insights.length > 0) {
      output += "### Core Insights\n";
      for (const i of data.insights) {
        output += `- ${i.connection}\n`;
      }
      output += "\n";
    }

    if (data.patterns.length > 0) {
      output += "### Exemplars\n";
      const examples = data.patterns
        .map(
          (p, i) =>
            `--- Example ${i + 1} (score ${p.qc_score.toFixed(1)}/10) ---\n${p.output_excerpt}`
        )
        .join("\n\n");
      output += examples + "\n\n";
    }

    output += "---\nUse these as quality benchmarks and strategic insights. Match or exceed their standard.\n";
    return output;
  }

  // ─── Post-task: store scored output ────────────────────────────────

  /**
   * Store the output of a completed task with its QC score.
   * Call this after output-reviewer has scored the output.
   *
   * @returns the stored pattern id
   */
  postTaskHook(params: {
    niche: string;
    task_type: string;
    prompt_summary: string;
    output: string;
    qc_score: number;
    dimensions?: SonaPattern["dimensions"];
    metadata?: Record<string, unknown>;
  }): string {
    const id = `sona_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const pattern: SonaPattern = {
      id,
      niche: params.niche,
      task_type: params.task_type,
      prompt_summary: params.prompt_summary,
      output_excerpt: params.output.slice(0, 400),
      qc_score: params.qc_score,
      dimensions: params.dimensions ?? {},
      metadata: params.metadata ?? {},
      created_at: new Date().toISOString(),
      consolidated: false, // queued for next consolidation pass
    };

    this.patterns.push(pattern);
    this.scheduleSave();

    logger.debug(
      `[SONA] postTaskHook stored pattern ${id} score=${params.qc_score}`
    );
    return id;
  }

  // ─── Consolidation (Active Learning / REM) ─────────────────────────

  /**
   * Active consolidation logic bridging patterns.
   * Finds unconsolidated patterns, groups them by niche, generates insights,
   * and marks them as consolidated. This happens decoupled from queries.
   */
  public async consolidate() {
    const unconsolidated = this.patterns.filter((p) => !p.consolidated && p.qc_score >= 8.0);
    if (unconsolidated.length === 0) return;

    logger.info(`[SONA] Starting consolidation layer on ${unconsolidated.length} new patterns...`);

    // Group by niche
    const byNiche: Record<string, SonaPattern[]> = {};
    for (const p of unconsolidated) {
      (byNiche[p.niche] ??= []).push(p);
    }

    const { LlmClient } = await import("../llm/llm-client.js");
    const llm = new LlmClient();

    for (const [niche, items] of Object.entries(byNiche)) {
      if (items.length >= 2) {
        const excerpts = items.map((p, i) => `Pattern ${i + 1} (Score: ${p.qc_score})\nTask: ${p.task_type}\nOutput excerpt: ${p.output_excerpt}`).join("\n\n");

        try {
          const response = await llm.chat({
            model: "ollama",
            provider: "ollama",
            messages: [{
              role: "system",
              content: `Analyze the following high-performing AI outputs for the niche "${niche}". Identify 1-2 core structural or stylistic patterns that make them successful. Return a short, insightful summary (max 3 sentences) that future agents should follow.`
            }, {
              role: "user",
              content: excerpts
            }]
          });

          const insight: SonaInsight = {
            id: `insight_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            source_patterns: items.map(i => i.id),
            connection: response.content.trim(),
            applicable_to: [niche],
            confidence: 0.85,
            created_at: new Date().toISOString()
          };
          this.insights.push(insight);
          logger.debug(`[SONA] Generated LLM insight ${insight.id} for niche ${niche}`);
        } catch (err) {
          logger.error(`[SONA] Failed to generate LLM insight for niche ${niche}: ${err}`);
        }
      }

      // Mark processed items
      items.forEach(i => (i.consolidated = true));
    }

    this.scheduleSave();
    logger.info(`[SONA] Consolidation complete. Total insights: ${this.insights.length}`);
  }

  // ─── Query ─────────────────────────────────────────────────────────

  /** Return all patterns for a niche, sorted by score desc */
  queryPatterns(niche: string, task_type?: string): SonaPattern[] {
    return this.patterns
      .filter(
        (p) => p.niche === niche && (!task_type || p.task_type === task_type)
      )
      .sort((a, b) => b.qc_score - a.qc_score);
  }

  /** Summary stats per niche+task_type — useful for dashboard */
  stats(): Record<string, { count: number; avg_score: number; top_score: number }> {
    const groups: Record<string, number[]> = {};
    for (const p of this.patterns) {
      const key = `${p.niche}::${p.task_type}`;
      (groups[key] ??= []).push(p.qc_score);
    }
    const result: Record<string, { count: number; avg_score: number; top_score: number }> = {};
    for (const [key, scores] of Object.entries(groups)) {
      result[key] = {
        count: scores.length,
        avg_score: scores.reduce((a, b) => a + b, 0) / scores.length,
        top_score: Math.max(...scores),
      };
    }
    return result;
  }

  // ─── Persistence ───────────────────────────────────────────────────

  private scheduleSave() {
    if (!this.persistPath) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.save(), 500);
  }

  private save() {
    if (!this.persistPath) return;
    try {
      const data = { patterns: this.patterns, insights: this.insights };
      fs.writeFileSync(this.persistPath, JSON.stringify(data, null, 2));
      logger.debug(`[SONA] persisted ${this.patterns.length} patterns and ${this.insights.length} insights to ${this.persistPath}`);
    } catch (err) {
      logger.error(`[SONA] failed to persist patterns: ${err}`);
    }
  }

  private load() {
    if (!this.persistPath || !fs.existsSync(this.persistPath)) return;
    try {
      const raw = fs.readFileSync(this.persistPath, "utf-8");
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        // legacy format migrated to v2
        this.patterns = data as SonaPattern[];
        this.insights = [];
      } else {
        // native v2 format
        this.patterns = (data.patterns || []) as SonaPattern[];
        this.insights = (data.insights || []) as SonaInsight[];
      }
      logger.debug(`[SONA] loaded ${this.patterns.length} patterns and ${this.insights.length} insights from ${this.persistPath}`);
    } catch (err) {
      logger.warn(`[SONA] could not load patterns: ${err}`);
      this.patterns = [];
      this.insights = [];
    }
  }
}
