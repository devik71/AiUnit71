---
name: sona-learning
type: intelligence
color: "#8E44AD"
version: 1.0.0
priority: medium
description: Self-optimizing pattern retrieval and storage. Pre-task — inject top-k exemplars from past scored outputs as few-shot context. Post-task — store output with QC score so quality compounds over time. Attach to any production room.
capabilities:
  - pattern_retrieval
  - exemplar_injection
  - few_shot_formatting
  - cross_mission_learning
  - niche_calibration
  - quality_trend_tracking
depends_on: [output-reviewer]
blocks: []
rooms: [CopywritingRoom, EvaluationRoom, ReportMasterRoom]
agents: [CopywritingAgent, EvaluationAgent]
hooks:
  pre: |
    echo "🧠 SONA retrieve: niche=$NICHE task=$TASK_TYPE k=3 min_score=7.0"
    # Returns top-k exemplars formatted as few-shot context
  post: |
    echo "💾 SONA store: score=$QC_SCORE for $NICHE/$TASK_TYPE"
    echo "Library size: $PATTERN_COUNT patterns for this niche"
---

# SONA Learning Skill

SONA = Self-Optimizing pattern retrieval. It has two moves:

1. **Pre-task**: pull the 3 best past outputs for this niche+task_type, inject them into your prompt as quality benchmarks
2. **Post-task**: store your output with its QC score so future agents can learn from it

You do not write this code yourself. The `SonaPatternStore` in `src/memory/sona-store.ts` handles storage and retrieval. Your job is to call the right hooks at the right time.

---

## Pre-Task Hook

Before generating any content output, call:

```
SonaPatternStore.preTaskHook(niche, task_type, k=3, minScore=7.0)
```

Use the return value to build a few-shot block:

```
SonaPatternStore.formatFewShot(patterns)
```

Inject the formatted block into your generation prompt **above** the brief. The agent sees high-quality past examples and implicitly calibrates to that level.

### Niche + Task Type taxonomy

| niche | task_type |
|---|---|
| `specialty_coffee` | `product_description` |
| `specialty_coffee` | `linkedin_post` |
| `specialty_coffee` | `instagram_caption` |
| `specialty_coffee` | `tov_document` |
| `specialty_coffee` | `content_calendar_entry` |
| `b2b_saas` | `linkedin_post` |
| `b2b_saas` | `case_study` |

Add new rows as new niches and task types appear. Use snake_case. Do not invent categories — pick the closest existing match.

---

## Post-Task Hook

After output-reviewer has scored an output, call:

```
SonaPatternStore.postTaskHook({
  niche,
  task_type,
  prompt_summary,   // 1-2 sentence description of the brief
  output,           // full generated text
  qc_score,         // 0–10 from output-reviewer
  dimensions: {
    brief_compliance,
    brand_voice,
    audience_fit,
    anti_slop,
    execution_quality
  },
  metadata: {
    client,
    mission_id,
    phase,
    agent_id
  }
})
```

**When to store:**
- Always store if qc_score ≥ 7.0
- Store failures (qc_score < 5.0) only if `type: "learning"` metadata is set — they help surface what not to do
- Never store drafts, partial outputs, or outputs that didn't pass output-reviewer

---

## Effect on Quality Over Time

```
Mission 1: No past patterns → agent works from brief alone
Mission 2: 1-2 patterns available (score 7.2, 7.8) → agent sees 2 exemplars
Mission 5: 6 patterns (scores 7.0–9.1) → top-3 exemplars used
Mission 10+: Dense pattern library → consistent high baseline
```

Expected improvement: +4–6% on brand voice and execution quality dimensions by mission 5.

---

## Where to Place in Pipeline

```
[Brief received]
      ↓
preTaskHook() → inject exemplars into generation prompt
      ↓
[Agent generates output]
      ↓
output-reviewer scores
      ↓
postTaskHook() with QC score
      ↓
[HITL gate or next phase]
```

Attach to every room that produces client-facing content:
- CopywritingRoom (product descriptions, posts, calendar entries)
- TOV phase (stores the approved voice document as a reference)
- EvaluationRoom (stores the scoring rubric decisions)

Do NOT attach to: BriefingRoom, MemoryStore reads, or routing logic.

---

## Memory File Location

Patterns persist at:
```
data/sona/patterns.json
```

This file is cross-mission and cross-client. Do not delete it between missions. Back it up before any data migrations.

---

## Related Skills
- `output-reviewer` — provides the qc_score that feeds postTaskHook
- `task-orchestrator` — calls preTaskHook before activating each production room
- `copywriting` — primary consumer of preTaskHook exemplars
