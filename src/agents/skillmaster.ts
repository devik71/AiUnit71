import { SkillScanner } from "../skills/skill-scanner.js";
import type { SkillInfo } from "../skills/skill-scanner.js";
import type { AgentConfig } from "../core/types.js";

// ─── SkillMaster ────────────────────────────────────────────────────

/**
 * SkillMaster — singleton agent that manages skill discovery and recommendations.
 *
 * Consults the SkillScanner catalog to recommend skills for tasks,
 * generate briefings, and guide skill acquisition in the Learning Room.
 */
export class SkillMaster {
    private scanner: SkillScanner;
    private skillsDir: string;

    /** Agent config used when SkillMaster is deployed in a room */
    static readonly AGENT_CONFIG: AgentConfig = {
        id: "skillmaster",
        name: "SkillMaster",
        role: "skillmaster",
        systemPrompt: `You are the SkillMaster — the AI agent responsible for the skill catalog.
You know all 3,290+ skills in the OpenClaw ecosystem. Your job:
1. Recommend relevant skills for any given task
2. Explain what each skill does and how to use it
3. Guide other agents through skill acquisition
4. Track which agents have which skills
5. Suggest skill combinations for complex tasks

When recommending skills, always explain WHY a skill is relevant and HOW it connects to the task.`,
        capabilities: ["text-generation", "analysis"],
        canTeleport: true,
    };

    constructor(skillsDir: string) {
        this.scanner = new SkillScanner();
        this.skillsDir = skillsDir;
    }

    /**
     * Find skills relevant to a task description.
     * Returns top matches by keyword relevance.
     */
    async findSkillsForTask(
        description: string,
        maxResults: number = 10
    ): Promise<SkillInfo[]> {
        // Extract keywords from the task description
        const keywords = this.extractKeywords(description);

        // Search across all keywords and deduplicate
        const resultMap = new Map<string, SkillInfo>();

        for (const keyword of keywords) {
            const matches = await this.scanner.findByKeyword(
                this.skillsDir,
                keyword
            );
            for (const match of matches) {
                const key = `${match.owner}/${match.slug}`;
                if (!resultMap.has(key)) {
                    resultMap.set(key, match);
                }
            }
        }

        // Sort by relevance (how many keywords matched)
        const results = Array.from(resultMap.values());
        return results.slice(0, maxResults);
    }

    /**
     * Get a formatted briefing for a specific skill.
     */
    getSkillBriefing(owner: string, slug: string): string {
        const doc = this.scanner.getSkillDoc(this.skillsDir, owner, slug);
        if (!doc) return `Skill ${owner}/${slug} not found in catalog.`;

        // Return first 2000 chars of the doc (enough for the briefing)
        const truncated = doc.length > 2000
            ? doc.slice(0, 2000) + "\n\n... (truncated, full doc available)"
            : doc;

        return [
            `# Skill Briefing: ${owner}/${slug}`,
            "",
            truncated,
        ].join("\n");
    }

    /**
     * Get the full catalog summary (counts by category).
     */
    async getCatalogSummary(): Promise<string> {
        const summary = await this.scanner.getCatalogSummary(this.skillsDir);

        const lines = [
            `# Skill Catalog Summary`,
            "",
            `**Total skills**: ${summary.total}`,
            "",
            "| Category | Count |",
            "|----------|-------|",
            ...Object.entries(summary.byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, count]) => `| ${cat} | ${count} |`),
        ];

        return lines.join("\n");
    }

    // ─── Helpers ────────────────────────────────────────────────────

    private extractKeywords(text: string): string[] {
        const stopWords = new Set([
            "the", "a", "an", "is", "are", "was", "were", "be", "been",
            "i", "we", "they", "you", "it", "this", "that", "and", "or",
            "but", "in", "on", "at", "to", "for", "of", "with", "by",
            "do", "does", "did", "have", "has", "had", "will", "would",
            "can", "could", "should", "need", "want", "like", "make",
            "create", "build", "use", "using", "get", "set", "find", "help",
        ]);

        return text
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, " ")
            .split(/\s+/)
            .filter((w) => w.length > 2 && !stopWords.has(w))
            .slice(0, 8); // Limit to 8 keywords for performance
    }
}
