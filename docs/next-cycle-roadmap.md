# Next Cycle Roadmap

Derived from TechPlus Round 3 analysis. Actions 3–5 (post-Round 3 deliverables).

---

## Action 3 — SONA v2: Active Consolidation Logic

**Source:** Google ADK `always-on-memory-agent`
**Target:** `src/memory/sona-store.ts`
**Priority:** High — closes the memory architecture gap flagged in Fight Club

### Problem

SONA (AIU-010) stores patterns and exemplars per task. But it's passive — it stores when asked, retrieves when asked. No active processing between sessions. Over time, the pattern store accumulates without synthesis: similar patterns from different niches don't connect, contradictions don't resolve, signal degrades into noise.

### The Google Architecture (no vector DB)

Three-agent pipeline running on a timer:

```
IngestAgent      → Extract structured info from any input
                   { summary, entities, topics, importance: 0–1 }

ConsolidateAgent → Runs every N minutes (like sleep/REM)
                   • Reviews unconsolidated memories
                   • Finds cross-memory connections
                   • Generates insights from connections
                   • Compresses related information

QueryAgent       → Answers questions with full memory context
                   Context-aware, not just keyword match
```

Key insight: **consolidation is time-based, not query-triggered.** The brain doesn't consolidate memories when you ask a question — it does it during rest.

### SONA v2 Design (AiUnit71)

```typescript
// Current sona-store.ts shape (inferred)
interface SonaPattern {
  niche: string
  task_type: string
  exemplar: string
  score: number
  timestamp: number
}

// v2 — add consolidation layer
interface SonaMemory {
  patterns: SonaPattern[]
  insights: SonaInsight[]      // cross-pattern connections
  last_consolidated: number    // timestamp
  consolidation_interval: number  // ms, default 30min
}

interface SonaInsight {
  source_patterns: string[]    // pattern IDs that generated this
  connection: string           // what connects them
  applicable_to: string[]      // niches where this applies
  confidence: number           // 0–1
}
```

### Implementation Steps

1. Add `consolidate()` method to `sona-store.ts` — runs on interval or on session end
2. Consolidate groups patterns by niche → finds shared structures → writes `SonaInsight`
3. `preTaskHook` checks insights first, then patterns (insights are higher-signal)
4. `postTaskHook` marks patterns as `consolidated: false` — queued for next consolidation pass

### Reference

`/tmp/techplus-round3/generative-ai/gemini/agents/always-on-memory-agent/agent.py`
`/tmp/techplus-round3/generative-ai/agents/agent_engine/memory_bank/`

---

## Action 4 — UI EvaluationRoom: Audit + Normalize + Polish Skills

**Source:** `impeccable/source/skills/` — `audit`, `normalize`, `polish`
**Target:** `skills/aiunit71/ui-audit/`, `skills/aiunit71/ui-normalize/`, `skills/aiunit71/ui-polish/`
**Trigger:** When AiUnit71 pipeline expands to UI deliverables (landing pages, dashboards, components)

### When to Execute

Not now. Execute when the pipeline receives first UI deliverable request. These skills are ready-to-copy — they just need AiUnit71 frontmatter fields added (`depends_on`, `blocks`, `rooms`, `mcp_integration`).

### Adaptation Required

Impeccable skills use `user-invokable: true` and `args:` — for AiUnit71, convert to pipeline-integrated format:

```yaml
# Impeccable (source format)
---
name: audit
user-invokable: true
args:
  - name: area
    required: false
---

# AiUnit71 (target format)
---
name: ui-audit
type: validator
version: 1.0.0
depends_on: [visual-prompt-engineering]
blocks: [ui-normalize, output-reviewer]
rooms: [EvaluationRoom]
agents: [QCAgent, EvaluationAgent]
mcp_integration:
  status: P0_MISSING
  required_tools:
    - tool: memory_store
      key: "swarm/ui-audit/findings"
---
```

### Pipeline Position

```
visual-prompt-engineering
        ↓
    ui-audit           ← new: document issues, don't fix
        ↓
   ui-normalize        ← new: align to design system
        ↓
    ui-polish          ← new: final detail pass
        ↓
   output-reviewer     ← existing: 5-dimension score + HITL
```

### Source Files

```
/tmp/techplus-round3/impeccable/source/skills/audit/SKILL.md
/tmp/techplus-round3/impeccable/source/skills/normalize/SKILL.md
/tmp/techplus-round3/impeccable/source/skills/polish/SKILL.md
/tmp/techplus-round3/impeccable/source/skills/frontend-design/SKILL.md  (master skill — use as reference)
```

Impeccable license: Apache 2.0 — copy freely with attribution in file header.

---

## Action 5 — Multi-Provider Distribution Build System

**Source:** `impeccable/scripts/` — `build.js` + `lib/transformers/`
**Target:** `scripts/build-skills.js` (new)
**Trigger:** When AiUnit71 skills need to publish for Cursor, Gemini CLI, or Codex

### The Problem

AiUnit71 skills currently target only Claude Code (`skills/aiunit71/`). If distribution expands to other providers, each has different format requirements:

| Provider | Skill format | Command format |
|----------|-------------|----------------|
| Claude Code | `.claude/skills/{name}/SKILL.md` with YAML frontmatter | `.claude/commands/{name}.md` |
| Cursor | `.cursor/skills/{name}/SKILL.md` — no frontmatter, no args | `.cursor/commands/{name}.md` |
| Gemini CLI | `GEMINI.{name}.md` or `.gemini/commands/{name}.toml` | TOML format |
| Codex | `.codex/skills/{name}/SKILL.md` | `.codex/prompts/{name}.md` |

### The Impeccable Solution

**Source → Transform → Dist** per provider. Key pieces:

```javascript
// scripts/lib/transformers/claude-code.js (copy from impeccable)
// Handles: YAML frontmatter, user-invokable flag, args, reference files
export function transformClaudeCode(skills, distDir, patterns, options) { ... }

// scripts/lib/transformers/cursor.js
// Strips frontmatter, appends args as plain text
export function transformCursor(skills, distDir) { ... }

// scripts/lib/transformers/gemini.js
// Converts to TOML for commands, flat markdown for skills
export function transformGemini(skills, distDir) { ... }
```

**AiUnit71-specific adaptation needed:**
- Impeccable source uses `user-invokable`, `args`, `license` fields
- AiUnit71 source uses `depends_on`, `blocks`, `rooms`, `mcp_integration`, `modes`
- The transformer needs to strip pipeline-internal fields (`depends_on`, `blocks`) before output — other providers don't understand them
- `mcp_integration.required_tools` → should become inline TODO comments in non-Claude providers

### Implementation Plan

```
scripts/
├── build-skills.js          # Main orchestrator (adapt from impeccable/scripts/build.js)
└── lib/
    └── transformers/
        ├── claude-code.js   # Copy from impeccable, adapt for AIU schema
        ├── cursor.js        # Copy from impeccable
        └── gemini.js        # Copy from impeccable
```

Source files:
```
/tmp/techplus-round3/impeccable/scripts/build.js
/tmp/techplus-round3/impeccable/scripts/lib/utils.js
/tmp/techplus-round3/impeccable/scripts/lib/transformers/claude-code.js
/tmp/techplus-round3/impeccable/scripts/lib/transformers/cursor.js
/tmp/techplus-round3/impeccable/scripts/lib/transformers/gemini.js
/tmp/techplus-round3/impeccable/scripts/lib/transformers/codex.js
```

Impeccable license: Apache 2.0 — adapt freely with attribution.
