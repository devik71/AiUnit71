# FIGHT 03 — VALIDATION DIVISION

```
FIGHT CARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DIVISION: Quality Review & Validation
CORNER A: Reviewer [MID-003]
           Source: midstream / core
CORNER B: Output Reviewer [AIU-009]
           Source: aiunit71 / skills
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## CORNER A — Reviewer (Midstream)

**Type:** validator
**Color:** #E74C3C
**Tagline:** "The goal of code review is to improve code quality and share knowledge."

**What it does:** Senior code reviewer covering quality, security, performance, standards compliance, and documentation. Produces tiered feedback with severity rankings.

**How it works:**
- 5-dimension review: functionality, security, performance, code quality, maintainability
- Concrete anti-patterns for each dimension (SQL injection, N+1 queries, SOLID violations, naming issues)
- Severity tiering: Critical → Major → Minor → Suggestions
- Automated checks recommended pre-review (lint, test, security scan, complexity)
- MCP: stores findings to `swarm/shared/review-findings`, `github_repo_analyze` for code quality/security

**Output:** Markdown review summary — Strengths, Critical Issues, Suggestions, Metrics (coverage %, complexity avg), Action Items checklist.

**Weakness:** Domain is code only. Output is narrative markdown — not typed YAML, not machine-readable. "78% coverage" metric is hardcoded, not computed. No escalation path. No integration with a producing agent — the Coder has no formal hook to receive correction prompts.

---

## CORNER B — Output Reviewer (AiUnit71)

**Type:** validator
**Color:** #C0392B
**Tagline:** "Would a senior creative director at a good agency approve this without changes?"

**What it does:** Reviews creative deliverables (copy, social posts, visual prompts, campaigns) against MCO brief, brand guidelines, and anti-slop rules before any human sees them.

**How it works:**
- 5-dimension scoring: brief compliance, brand voice, audience fit, anti-slop, execution quality
- Minimum threshold: 7.0/10 per dimension to pass
- 4 operational modes: standard / quick_pass / batch / pre_client
- Batch protocol: review 3 first — if systemic issues, stop and return to producer
- Pre-hook: loads MCO, brand guidelines, client_taste_profile, TOV, style_constraints
- Post-hook: SONA score submission + routing (fail → correction_prompt to producer, pass → advance)

**Output:** Scores per dimension, verdict (PASS/FAIL), correction_prompt if fail, HITL package if pass.

**Weakness:** No MCP tool calls. No shared memory namespace. The review scores don't persist anywhere that other agents can query. No source-of-truth storage for the QC history of a deliverable.

---

## ROUND-BY-ROUND SCORING

```
  Dimension               Corner A  Corner B
  ─────────────────────────────────────────
  Role Clarity               7        8
  Capability Depth           7        9
  Output Quality             7        9
  Pipeline Integration       8        7
  Domain Specialization      8        9
  Operational Readiness      7        8
  ─────────────────────────────────────────
  TOTAL                     44       50
```

---

## REFEREE VERDICT: CORNER B — Output Reviewer (AiUnit71)

**Margin:** Clear

---

## REFEREE NOTES

**Role Clarity — A:7, B:8**

Reviewer is clearly scoped to code. But it bleeds into adjacent roles: performance analysis could belong to a dedicated Performance Monitor, documentation review to a Documentation agent. It's one agent doing the work of several specialists. Output Reviewer covers "any creative deliverable" which sounds wide, but its scope boundary is tight: it runs before HITL gates and before delivery, no earlier, no later. The four modes add operational precision — you know exactly when to invoke each one. B is cleaner, though A's code-only scope is sharper in absolute terms.

**Capability Depth — A:7, B:9**

Reviewer has genuine depth — the code examples (SQL injection, N+1 queries, SOLID violations) are technically accurate and instructive. But they're stock examples. Any senior dev has seen them. There's no novel methodology. Output Reviewer's capabilities are more architecturally sophisticated: the batch protocol (review 3, stop if systemic) is a real QC strategy that prevents cascading failure. The fail → correction_prompt routing is a closed feedback loop, not just a report. The SONA score submission turns every review into a learning event. That's capability with system-level consequence.

**Output Quality — A:7, B:9**

Reviewer's markdown output is readable and human-friendly. The action items checklist is practical. But it's narrative — a human reads it and decides what to do. Output Reviewer's scoring schema drives machine decisions: if any dimension < 7.0, the deliverable fails and a correction_prompt is generated. The pre_client mode escalates anything below 8.0 to senior review. These are typed outputs with operational consequences. Reviewer's markdown is good documentation; Output Reviewer's scores are control signals.

**Pipeline Integration — A:8, B:7**

Corner A takes this round again, same as Fight 02. Reviewer has MCP memory integration (`swarm/reviewer/status`, `swarm/shared/review-findings`), `github_repo_analyze` for code quality and security scanning, and retrieval of `swarm/coder/status` to check implementation context. That's genuine multi-directional coordination. Output Reviewer's `depends_on` and `blocks` define its position in the pipeline, and its hooks are purposeful (load MCO pre, route result post), but no MCP calls means no persistent shared state. QC history disappears after each review.

**Domain Specialization — A:8, B:9**

Reviewer earns 8 because code review is its entire world and it operates well within it — security patterns, SOLID principles, test coverage. It's generic within software, but software is a defined domain. Output Reviewer is tighter: brand voice, TOV compliance, anti-slop patterns, HITL package preparation, client delivery standards. The "pre_client" mode (escalate below 8.0) implies awareness of client relationship dynamics — that's domain sophistication beyond just checking criteria. B wins, but it's closer than other dimensions.

**Operational Readiness — A:7, B:8**

Reviewer has priority tiers (Critical/Major/Minor/Suggestions), automated pre-review checks, and a 400-line review size limit. Solid operational hygiene. But there's no escalation path — if the Coder doesn't fix a Critical issue, what happens? No answer. Output Reviewer's threshold (7.0 minimum), escalation rule (pre_client: 8.0 minimum), batch abort-on-systemic-issues protocol, and SONA feedback loop are more complete. Both agents lack a defined handling for complete producer failure (what if the copy is still bad after 3 correction cycles?), but Output Reviewer is closer to having the answer.

---

## SPECIAL NOTES

**Shared gap — QC history:** Neither agent persists scored review records in a queryable store. If a Delivery Validator needs to confirm that a deliverable passed QC, there's no memory key to check. Output Reviewer should write each verdict to `swarm/shared/qc-log-[deliverable-id]` after every review. Reviewer should do the same with `swarm/shared/review-findings`.

**What AiUnit71 should borrow from Reviewer:** The severity tier model (Critical/Major/Minor). Output Reviewer's current schema has PASS/FAIL per dimension but no severity gradation within a failure. A copy piece that has one banned word (Minor) is not the same as one that completely misrepresents the brief (Critical). Adding a severity layer to the correction_prompt would help producers prioritize fixes.
