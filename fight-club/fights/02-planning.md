# FIGHT 02 — PLANNING DIVISION

```
FIGHT CARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DIVISION: Planning & Orchestration
CORNER A: Planner [MID-005]
           Source: midstream / core
CORNER B: Mission Planner [AIU-001]
           Source: aiunit71 / skills
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## CORNER A — Planner (Midstream)

**Type:** coordinator
**Color:** #4ECDC4
**Tagline:** "A good plan executed now is better than a perfect plan executed never."

**What it does:** Strategic planning and task orchestration for software development. Decomposes complex requests, maps dependencies, allocates agent resources, estimates timelines, identifies risks.

**How it works:**
- 5-phase planning loop: initial assessment → task decomposition → dependency analysis → resource allocation → risk mitigation
- YAML output: `plan.phases[].tasks[].{id, description, agent, dependencies, estimated_time, priority}`, `critical_path[]`, `risks[]`, `success_criteria[]`
- MCP tool integration: `task_orchestrate` (with strategy/priority/maxAgents), `memory_usage` (store breakdown to `swarm/planner/task-breakdown`), `task_status` monitoring
- Hooks: memory_store on start and end

**Weakness:** Generic project management methodology. The 5-step process could describe Jira. No domain logic — "estimate realistic timeframes" says nothing. No HITL gates, no autonomy-level concept. Output format has no field that doesn't exist in a PM textbook.

---

## CORNER B — Mission Planner (AiUnit71)

**Type:** coordinator
**Color:** #00303C
**Tagline:** "No content is produced by this skill. Only the blueprint."

**What it does:** Breaks down a client mission into a sequenced execution plan with room assignments, HITL gates, parallelization opportunities, and budget estimation. Runs before any content is generated.

**How it works:**
- Explicit GOAP methodology: goal state → action inventory → dependency graph → parallelization → HITL gate placement
- Room-to-deliverable mapping table (copy → CopywritingRoom, visual → ImageGenRoom, QC → EvaluationRoom)
- YAML output: `phases[].{rooms, runs, depends_on, outputs, hitl_gate, gate_description}`, `risks[]`, `open_questions[]`
- Pre-hook: fail-fast MCO validation (refuses to plan if `deliverables[]`, `budget.total`, or `autonomy_level` are missing)
- 5 explicit planning rules with rationale (20% budget reserve, sample-before-batch, one gate per phase)

**Weakness:** No MCP tool calls. Memory coordination underdefined — plans don't propagate to a named namespace. No escalation for out-of-budget missions.

---

## ROUND-BY-ROUND SCORING

```
  Dimension               Corner A  Corner B
  ─────────────────────────────────────────
  Role Clarity               7        9
  Capability Depth           7        9
  Output Quality             7        9
  Pipeline Integration       8        7
  Domain Specialization      5        9
  Operational Readiness      5        7
  ─────────────────────────────────────────
  TOTAL                     39       50
```

---

## REFEREE VERDICT: CORNER B — Mission Planner (AiUnit71)

**Margin:** Dominant

---

## REFEREE NOTES

**Role Clarity — A:7, B:9**

Planner is clear within software dev: decompose tasks, map dependencies, allocate agents. But it could be confused with Coder (resource allocation) or Reviewer (risk identification). Mission Planner has a sharper edge: it plans, nothing else, and it explicitly names what it doesn't do ("no content is produced by this skill"). The `blocks: [task-orchestrator]` relationship defines its role through its consequence — nothing executes until it's done. That's role clarity enforced architecturally.

**Capability Depth — A:7, B:9**

Planner's 5-phase process is competent but universal. Dependency analysis and risk mitigation are things any senior dev does mentally. Mission Planner names its methodology (GOAP), applies it concretely, and adds domain-specific intelligence: room-to-deliverable mapping, HITL gate rationale ("one gate per phase — too many gates kill momentum, too few create rework"), and the sample-before-batch rule ("one bad template × 17 = 17 bad outputs"). That rule is real production experience encoded as a constraint. Planner has nothing equivalent.

**Output Quality — A:7, B:9**

Both have YAML output specs. Planner's fields (`description`, `agent`, `estimated_time`, `priority`) are complete but generic — any task tracker could produce them. Mission Planner's `hitl_gate: bool + gate_description` pair is where the edge shows. Each phase's output tells you not just what runs but what the client will see and when they need to approve it. The `open_questions[]` field is a practical mechanism for surfacing ambiguity before execution starts. Planner has no equivalent pre-flight check.

**Pipeline Integration — A:8, B:7**

The one round Corner A takes. Planner has MCP tool calls: `task_orchestrate` with strategy/priority/maxAgents, memory storage to `swarm/planner/task-breakdown`, and `task_status` polling. That's real shared-state coordination. Mission Planner has `depends_on`, `blocks`, and a fail-fast pre-hook — strong conceptual integration — but no MCP calls, no shared memory namespace. The plan it produces doesn't automatically propagate anywhere. B loses this round on the same gap Client Researcher lost in Fight 01.

**Domain Specialization — A:5, B:9**

Planner is generic software planning. Strip the code examples and it describes any industry PM process. Mission Planner is unmistakably a marketing production pipeline agent. Room types, HITL client approvals, TOV documents, visual prompt pipelines, batch production — none of this bleeds into dev context. Full domain ownership.

**Operational Readiness — A:5, B:7**

Planner gives best practices ("flexible and adaptable") without defining flexibility. No threshold, no escalation, no failure mode. Mission Planner has the 20% budget reserve rule, fail-fast MCO validation (refuses to run with missing fields), `open_questions[]` for pre-flight ambiguity, and explicit gate timing logic. Still no numeric escalation threshold (what happens if phase 3 is 50% over budget?), so it doesn't reach 8+. But it's clearly more operationally mature.

---

## SPECIAL NOTES

**Gap in Mission Planner:** Plans are generated but not persisted. If Task Orchestrator needs to retrieve the plan mid-execution (after a failure), there's no memory key to pull from. Planner's MCP namespace approach (`swarm/planner/task-breakdown`) should be adopted by Mission Planner to close this gap.

**What AiUnit71 should borrow from Planner:** The `task_status` polling mechanism. During long multi-room missions, Mission Planner has no way to query room completion status. Integrating MCP task status checks into the orchestration loop would make the pipeline observable.
