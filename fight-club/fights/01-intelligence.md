# FIGHT 01 — INTELLIGENCE DIVISION

```
FIGHT CARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DIVISION: Intelligence & Research
CORNER A: Researcher [MID-002]
           Source: midstream / core
CORNER B: Client Researcher [AIU-002]
           Source: aiunit71 / skills
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## CORNER A — Researcher (Midstream)

**Type:** analyst
**Color:** #9B59B6
**Tagline:** "Good research is the foundation of successful implementation."

**What it does:** Deep investigation of codebases. Pattern recognition, dependency mapping, documentation mining, knowledge synthesis. Built for software development contexts.

**How it works:**
- Broad-to-narrow search strategies (glob → grep → focused read)
- Cross-reference: definitions → usages → data flow → integration points
- Historical analysis via git history
- Outputs structured `research_findings` YAML with codebase_analysis, dependencies, recommendations, gaps

**Tool stack:** `mcp__claude-flow__memory_usage` (store, retrieve, search), `mcp__claude-flow__github_repo_analyze`, `mcp__claude-flow__agent_metrics`. Coordinates via shared memory namespace `swarm/shared/research-*`

**Output format:** Structured YAML — `research_findings.codebase_analysis.patterns[]`, `dependencies.external[]`, `recommendations[]`, `gaps_identified[]`

**Weakness:** Entirely code-focused. No concept of audience, market, brand, or external context. Writes search patterns as bash examples — no enforcement. Generic "best practices" tone in instructions.

---

## CORNER B — Client Researcher (AiUnit71)

**Type:** intelligence
**Color:** #8E44AD
**Tagline:** "Every downstream agent has the context they need."

**What it does:** Market, audience, and competitor intelligence for marketing production. Enriches the Mission Context Object before any content is produced.

**How it works:**
- 4 research scopes: audience language, competitor audit, niche opportunities, voice benchmarks
- Audience language mining: exact phrasing from reviews, Reddit, LinkedIn, marketplace listings
- Competitor audit: 5-field profile per competitor (frequency, formats, message, tone, gap)
- Output enriches MCO fields: `audience.primary.language`, `brand.competitors`, `content_strategy.*`

**Modes:** light / deep / competitive_focus / refresh
**Pipeline:** `depends_on: []` → `blocks: [mission-planner, niche-adapter]`
**Hooks:** pre/post with field update tracking

**Output format:** Structured YAML — `client_research.audience_language.pain_phrases[]`, `competitor_audit[]`, `content_opportunities.topics[]`, `voice_benchmarks[]`, `recommendations[]`

**Weakness:** No MCP tool integration — research is performed ad hoc, no memory coordination namespace. No scoring dimension. No "how to verify sources" protocol.

---

## ROUND-BY-ROUND SCORING

```
  Dimension               Corner A  Corner B
  ─────────────────────────────────────────
  Role Clarity               7        9
  Capability Depth           7        8
  Output Quality             7        9
  Pipeline Integration       8        7
  Domain Specialization      6        9
  Operational Readiness      6        7
  ─────────────────────────────────────────
  TOTAL                     41       49
```

---

## REFEREE VERDICT: CORNER B — Client Researcher (AiUnit71)

**Margin:** Clear

---

## REFEREE NOTES

**Role Clarity — A:7, B:9**

Researcher is clear within its domain (code), but its domain is too generic: it could be confused with Reviewer, Planner, or Coder in a dev team. Client Researcher has a much sharper boundary — it explicitly states it feeds MCO and *blocks* downstream agents until it's done. That block/gate relationship is clarity through architecture, not just description.

**Capability Depth — A:7, B:8**

Researcher's capabilities are technically sound: broad-to-narrow search, cross-reference, git history. But they're software-universal — any junior dev knows these strategies. Client Researcher goes deeper in its domain: it specifies *where* to mine audience language (Google reviews, Reddit, LinkedIn, marketplaces), *what* to extract (exact phrases, not summaries), and *what format* competitors should be documented in. The specificity of the competitor profile template (5 fields, exact structure) is a clear edge.

**Output Quality — A:7, B:9**

Both agents have YAML output specs. Researcher's YAML is complete but generic — `patterns[]`, `recommendations[]`, nothing you couldn't produce from memory. Client Researcher's YAML is domain-tuned: `pain_phrases[]` (voice of customer), `outcome_phrases[]`, `competitor_audit[].gap`, `voice_benchmarks[].applicable_to_client`. Every field has a purpose that feeds a specific downstream agent. The `applicable_to_client` bridge field is notably thoughtful.

**Pipeline Integration — A:8, B:7**

This is the one round Corner A takes cleanly. Researcher has explicit MCP tool integration with named memory keys (`swarm/shared/research-findings`), namespace coordination, and `memory_search` in post-hook. That's actual shared state management in a swarm context. Client Researcher has `depends_on`, `blocks`, and hooks — but no shared memory namespace, no tool calls. It describes MCO field updates without showing *how* they propagate. B loses this round on missing MCP integration.

**Domain Specialization — A:6, B:9**

Researcher is a generic dev-tool agent. If you stripped the software examples, it could describe any research process. Client Researcher is unmistakably a marketing intelligence agent — audience language, VOC phrases, competitor gap analysis, voice benchmarking. It even references specific platforms (Reddit, LinkedIn) and content formats. No software dev context bleeds in. Full domain ownership.

**Operational Readiness — A:6, B:7**

Neither agent excels here. Researcher has "best practices" but no failure handling — what happens if a codebase has no docs? No escalation path. Client Researcher has slightly better readiness: it explicitly states what to ask when MCO fields are missing, and its modes (light/deep/refresh) are an implicit failure-path handling system. But neither agent defines thresholds or escalation triggers. Both lose points.

---

## SPECIAL NOTES

**Gap identified in both agents:** Neither has a confidence scoring mechanism on its outputs. Researcher doesn't flag low-confidence findings. Client Researcher doesn't weight source quality (one Reddit post vs 50 reviews). A future iteration of either should add `confidence: 0–1` to research outputs.

**What AiUnit71 should borrow from Researcher:** The MCP memory namespace pattern (`swarm/shared/research-*`). If Client Researcher stored its output in a shared memory key, other agents could retrieve findings without manual MCO injection.
