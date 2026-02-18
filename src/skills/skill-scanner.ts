import * as fs from "node:fs";
import * as path from "node:path";

// ─── Types ──────────────────────────────────────────────────────────

export interface SkillInfo {
    owner: string;
    slug: string;
    displayName: string;
    version: string;
    description: string;
    category: string;
    skillPath: string;
    hasScripts: boolean;
    hasResources: boolean;
}

interface SkillMeta {
    owner: string;
    slug: string;
    displayName: string;
    latest?: { version: string };
}

interface SkillFrontmatter {
    name?: string;
    description?: string;
}

// ─── SkillScanner ───────────────────────────────────────────────────

/**
 * Runtime skill indexer. Scans the skills directory and builds
 * a searchable catalog of all available skills.
 */
export class SkillScanner {
    private cache: SkillInfo[] | null = null;

    /**
     * Scan the skills directory and return all discovered skills.
     * Results are cached after first scan.
     */
    async scanAll(skillsDir: string): Promise<SkillInfo[]> {
        if (this.cache) return this.cache;

        const skills: SkillInfo[] = [];

        if (!fs.existsSync(skillsDir)) return skills;

        const owners = fs.readdirSync(skillsDir).filter((name) => {
            const full = path.join(skillsDir, name);
            return fs.statSync(full).isDirectory() && !name.startsWith(".");
        });

        for (const owner of owners) {
            const ownerPath = path.join(skillsDir, owner);
            const slugs = fs.readdirSync(ownerPath).filter((name) => {
                const full = path.join(ownerPath, name);
                return fs.statSync(full).isDirectory();
            });

            for (const slug of slugs) {
                const skillPath = path.join(ownerPath, slug);
                const metaPath = path.join(skillPath, "_meta.json");

                if (!fs.existsSync(metaPath)) continue;

                try {
                    const meta: SkillMeta = JSON.parse(
                        fs.readFileSync(metaPath, "utf-8")
                    );

                    // Read SKILL.md frontmatter for description
                    const skillMdPath = path.join(skillPath, "SKILL.md");
                    const frontmatter = this.parseFrontmatter(skillMdPath);

                    const info: SkillInfo = {
                        owner: meta.owner || owner,
                        slug: meta.slug || slug,
                        displayName: meta.displayName || slug,
                        version: meta.latest?.version || "0.0.0",
                        description: frontmatter.description || "",
                        category: this.inferCategory(
                            meta.displayName || slug,
                            frontmatter.description || ""
                        ),
                        skillPath,
                        hasScripts: fs.existsSync(path.join(skillPath, "scripts")),
                        hasResources: fs.existsSync(path.join(skillPath, "resources")),
                    };

                    skills.push(info);
                } catch {
                    // Skip malformed skills
                }
            }
        }

        this.cache = skills;
        return skills;
    }

    /**
     * Search skills by keyword (fuzzy match across name and description).
     */
    async findByKeyword(
        skillsDir: string,
        query: string
    ): Promise<SkillInfo[]> {
        const all = await this.scanAll(skillsDir);
        const lower = query.toLowerCase();

        return all.filter(
            (s) =>
                s.displayName.toLowerCase().includes(lower) ||
                s.description.toLowerCase().includes(lower) ||
                s.slug.toLowerCase().includes(lower) ||
                s.category.toLowerCase().includes(lower)
        );
    }

    /**
     * Get the full SKILL.md content for a specific skill.
     */
    getSkillDoc(skillsDir: string, owner: string, slug: string): string | null {
        const mdPath = path.join(skillsDir, owner, slug, "SKILL.md");
        if (!fs.existsSync(mdPath)) return null;
        return fs.readFileSync(mdPath, "utf-8");
    }

    /**
     * Get skill count and category breakdown.
     */
    async getCatalogSummary(skillsDir: string): Promise<{
        total: number;
        byCategory: Record<string, number>;
    }> {
        const all = await this.scanAll(skillsDir);
        const byCategory: Record<string, number> = {};

        for (const skill of all) {
            byCategory[skill.category] = (byCategory[skill.category] || 0) + 1;
        }

        return { total: all.length, byCategory };
    }

    /** Clear the cache to force a re-scan */
    clearCache(): void {
        this.cache = null;
    }

    // ─── Helpers ────────────────────────────────────────────────────

    private parseFrontmatter(mdPath: string): SkillFrontmatter {
        if (!fs.existsSync(mdPath)) return {};

        try {
            const content = fs.readFileSync(mdPath, "utf-8");
            const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
            if (!match) return {};

            const yaml = match[1];
            const result: SkillFrontmatter = {};

            const nameMatch = yaml.match(/^name:\s*(.+)$/m);
            if (nameMatch) result.name = nameMatch[1].trim();

            const descMatch = yaml.match(/^description:\s*(.+)$/m);
            if (descMatch) result.description = descMatch[1].trim();

            return result;
        } catch {
            return {};
        }
    }

    private inferCategory(name: string, description: string): string {
        const text = `${name} ${description}`.toLowerCase();

        const categories: [string, string[]][] = [
            ["Trading & Finance", ["trade", "trading", "swap", "defi", "polymarket", "wallet", "payment", "token", "crypto", "bitcoin", "solana", "ethereum", "cardano"]],
            ["Image & Video", ["image", "photo", "video", "render", "visual", "camera", "picture", "screenshot", "runware"]],
            ["Audio & Music", ["music", "audio", "voice", "sound", "tts", "speech", "podcast", "suno", "elevenlabs"]],
            ["Communication", ["email", "message", "chat", "telegram", "discord", "slack", "whatsapp", "sms", "notify"]],
            ["Social Media", ["twitter", "tweet", "linkedin", "facebook", "instagram", "reddit", "social", "post", "thread"]],
            ["Development", ["code", "deploy", "git", "api", "sdk", "build", "test", "debug", "script", "server"]],
            ["Data & Search", ["search", "scrape", "crawl", "data", "database", "analytics", "extract", "parse", "news"]],
            ["AI & ML", ["llm", "model", "train", "embed", "vector", "agent", "prompt", "ai", "ml", "inference"]],
            ["Automation", ["automat", "workflow", "schedule", "cron", "pipeline", "task", "bot"]],
            ["3D & Design", ["3d", "blender", "cad", "design", "figma", "ui", "ux"]],
            ["Prediction", ["predict", "forecast", "arena", "bet"]],
        ];

        for (const [category, keywords] of categories) {
            if (keywords.some((kw) => text.includes(kw))) {
                return category;
            }
        }

        return "General";
    }
}
