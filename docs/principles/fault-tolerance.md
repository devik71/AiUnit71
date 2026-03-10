# Fault Tolerance in Creative Production

## The Problem

Software engineering systems fail in predictable, technical ways: a server crashes, a network times out, a database lock deadlocks. Distributed systems like ruflo solve this with Byzantine fault tolerance — they can tolerate 1 in 3 agents being completely broken without the system halting.

Creative production fails differently. The failures are about judgment, not uptime:
- A copywriter produces generic output that sounds like any other brand
- A visual direction is technically correct but emotionally wrong
- A batch of 17 product descriptions is internally inconsistent — some formal, some casual
- A client rejects an output that passed all QC dimensions, because the "feeling" was off
- Budget disappears on retries because nobody stopped to ask if the brief was clear

Byzantine consensus doesn't fix these. But the **underlying principle** — design systems that stay productive even when parts fail — absolutely applies to creative work.

---

## The Creative Fault Tolerance Model

### 1. Fail Fast, Not Fail Silent

**Software principle:** Check invariants at system boundaries, crash loudly, never hide state corruption.

**Creative equivalent:** MCO preflight check before any production phase starts.

```
Before Phase 1 activates:
  ✅ client.name present
  ✅ mission.deliverables[] non-empty
  ✅ mission.budget.total set
  ✅ brand.voice defined or approved
  ✅ audience.primary defined

If any field is missing → STOP. Do not spend budget. Fix the brief.
```

This is more valuable than any retry logic. Most creative failures trace back to an incomplete brief, not a bad agent.

---

### 2. Branch Isolation (Parallel Branch Fault Tolerance)

**Software principle:** If one node in a mesh fails, route around it — don't take down the whole network.

**Creative equivalent:** Parallel branch independence.

When two rooms run concurrently (e.g. CopywritingRoom + ImageGenRoom):

```
Branch A: CopywritingRoom   ─┐
                              ├─ [merge] → EvaluationRoom
Branch B: ImageGenRoom      ─┘
```

**Rules:**
- If Branch A fails 3 times → **isolate it**. Branch B continues.
- If Branch B is blocked → do not pause Branch A waiting.
- If both branches produce output at different times → merge asynchronously.
- If a branch produces *partial* output → accept partial, flag for HITL, do not discard.

A partial deliverable is always better than a missing one. The client can work with 15 of 17 product descriptions. They cannot work with zero.

---

### 3. Graceful Degradation (Mandatory vs Optional Deliverables)

**Software principle:** Core services stay up even when auxiliary services are down.

**Creative equivalent:** The mission must protect its mandatory deliverables even if optional ones fail.

```yaml
deliverables:
  - name: TOV document
    mandatory: true       # Mission fails without this
  - name: 17 product descriptions
    mandatory: true       # Core deliverable
  - name: 4-week content calendar
    mandatory: true       # Core deliverable
  - name: mascot animation brief
    mandatory: false      # Nice to have — if animation room fails, continue
  - name: visual mood board
    mandatory: false      # Can be delivered in phase 2
```

**In `agency.toml`:** `allow_partial_delivery = true` enables this by default.

**Rule:** Never abort a mission over an optional deliverable failure. Surface it in the delivery report with a clear explanation, offer to deliver it separately.

---

### 4. The 3-Strike Escalation Rule

**Software principle:** Exponential backoff + circuit breaker. After N failures, stop retrying and escalate.

**Creative equivalent:** 3-strike protocol.

| Strike | Action |
|---|---|
| 1st failure | Return to room with targeted correction prompt. Update MCO with specific constraint. |
| 2nd failure | Change the approach — different angle, different format, different exemplars from SONA. |
| 3rd failure | **STOP. Escalate to HITL.** Present the 3 attempts, the correction prompts used, and ask the human for direction. |

**Critical rule:** Never send the same output twice without documented changes. If you're retrying, the approach must change. Retry ≠ repeat.

---

### 5. Budget as a Circuit Breaker

**Software principle:** Resource limits as a hard stop — prevent runaway processes from consuming all memory or compute.

**Creative equivalent:** Budget reserve + alert threshold.

```
Mission budget: $8.00
Reserve (20%): $1.60       ← Never touch this without explicit authorization
Spendable:     $6.40

Alert at 80%:  $5.12       ← Surface warning: "5 phases remain, ~$1.28 spendable"
Hard stop:     $6.40       ← No phase starts if it would exceed spendable budget
Emergency:     $8.00       ← Can only unlock reserve with explicit HITL authorization
```

**Phase budget check (pre-flight):**
```
Before starting Phase N:
  estimated_cost = phase.budget_estimate
  available = total_budget - spent - reserve
  if estimated_cost > available:
    STOP. Surface. Propose: reduce scope | cut optional | request increase.
    Do NOT start the phase.
```

---

### 6. The Correction Loop (State Machine)

**Software principle:** A well-designed state machine never gets stuck — every error state has a defined exit path.

**Creative equivalent:** Every failure mode has a documented response, and that response mutates state before retrying.

```
[Output produced]
      ↓
[output-reviewer scores]
      ↓
  score ≥ 7.0? ──yes──→ [HITL gate or next phase]
      ↓ no
  Which dimension failed?
      ↓
  [Update MCO with specific constraint for that dimension]
      ↓
  [Return to producer with targeted correction prompt]
      ↓
  [Re-run output-reviewer]
      ↓
  3rd failure? ──yes──→ [Escalate to HITL with full context]
      ↓ no
  [Loop]
```

**MCO mutations are the key.** Every retry that doesn't update the MCO is wasted. The system must learn from each failure before the next attempt.

---

### 7. Feedback Forward (Cross-Phase Memory)

**Software principle:** Distributed systems propagate state changes to all dependent nodes — eventual consistency.

**Creative equivalent:** Client feedback at a HITL gate must propagate forward into all subsequent phases.

```
Client rejects at HITL Gate 2 (sample approval):
  "The tone is too formal — we're a down-to-earth brand."

Required MCO mutations:
  brand.voice.formality: "casual"                    (was "professional")
  brand.voice.avoid: ["formal constructions", ...]   (add to avoid list)
  content_strategy.pillars[].tone: "conversational"

Before Phase 3 starts:
  All producers re-read the updated MCO.
  SONA preTaskHook now retrieves exemplars with lower formality scores.
```

Feedback that doesn't update the MCO is feedback that will be ignored in the next phase. Every piece of client feedback has exactly one home: the MCO.

---

## Summary: Creative Fault Tolerance Checklist

Before any mission starts:
- [ ] MCO preflight check — all required fields present
- [ ] Deliverables tagged mandatory/optional
- [ ] Budget reserve set (20% default, 30% for pilot missions)
- [ ] Max retries configured (3 per item, 2 per batch)

During production:
- [ ] Parallel branches isolated — one branch failure doesn't pause others
- [ ] Each retry updates the MCO before the next attempt
- [ ] Budget check before every phase start
- [ ] Alert surfaced at 80% of spendable budget

At HITL gates:
- [ ] Correction loop: feedback → MCO mutation → updated prompt → retry
- [ ] Never send same output twice without documented change
- [ ] 3rd failure on any item → escalate, do not retry again

At delivery:
- [ ] Mandatory deliverables all present or HITL-approved exception
- [ ] Optional failures documented in delivery report with next-step offer
- [ ] SONA patterns stored for all scored outputs (score ≥ 7.0)

---

## Related

- `agency.toml` → `[fault_tolerance]` section for runtime configuration
- `task-orchestrator/SKILL.md` → Failure Handling table
- `output-reviewer/SKILL.md` → Escalation Rules
- `sona-learning/SKILL.md` → Post-task pattern storage
- `parallel-creative-flow/SKILL.md` → Branch isolation hooks
