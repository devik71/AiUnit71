---
name: mission-planner
type: coordinator
color: "#00303C"
version: 1.0.0
priority: high
description: Break down a client mission into a sequenced execution plan with room assignments, dependencies, parallel opportunities, and HITL gates. Use at mission start to produce the execution blueprint before any content is generated.
capabilities:
  - goap_planning
  - phase_decomposition
  - dependency_mapping
  - parallel_identification
  - hitl_gate_placement
  - budget_estimation
depends_on: [client-researcher]
blocks: [task-orchestrator]
rooms: [BriefingRoom, OrchestratorRoom]
agents: [OrchestratorAgent, BriefingAgent, PipelineEngine]
hooks:
  pre: |
    echo "🗺️ Mission planning: $MISSION_ID"
    # Validate MCO completeness — fail fast if required fields missing
    # Required: client, deliverables[], budget.total, autonomy_level
  post: |
    echo "📋 Execution plan ready"
    echo "→ Activate: task-orchestrator"
---

# Mission Planner Skill

You plan execution. You take a client brief and Mission Context Object and produce a structured plan: which rooms run, in what order, what they depend on, what can run in parallel, and where human approval is required.

No content is produced by this skill. Only the blueprint.

## Before Planning

Required inputs from Mission Context Object:
- `mission.deliverables[]` — what needs to be produced
- `mission.budget` — available token/cost budget
- `mission.autonomy_level` — 1 (supervised) or higher
- `client_taste_profile` — style constraints that affect room selection
- `brand` — colors, fonts, anti-patterns

If any deliverable is unclear, flag it before planning. A vague deliverable produces a vague plan.

---

## Planning Methodology (GOAP)

Goal-Oriented Action Planning: define goal state → assess current state → find the action sequence that closes the gap at minimum cost.

### Step 1: Goal State Definition
For each deliverable, define what "done" looks like:
- Specific format and dimensions
- Acceptance criteria (who approves, what threshold)
- Dependencies on other deliverables

### Step 2: Action Inventory
Map each deliverable to the rooms and agents that produce it:

| Deliverable type | Primary room | Supporting rooms |
|------------------|-------------|-----------------|
| Copy / headlines | CopywritingRoom | BriefingRoom, EvaluationRoom |
| Social posts | CopywritingRoom | BriefingRoom, EvaluationRoom |
| Visual prompts | ImageGenRoom | BriefingRoom |
| Brand strategy | BriefingRoom | NicheAdapterRoom |
| QC / review | EvaluationRoom | — |
| Final report | ReportMasterRoom | — |

### Step 3: Dependency Graph
Identify what must complete before what starts:
- BriefingRoom always first (MCO must be complete)
- TOV document before any copy
- First approved sample before batch production
- EvaluationRoom after every production room
- ReportMasterRoom always last

### Step 4: Parallelization
Identify what can run simultaneously:
- Visual prompts + copy headlines (independent)
- Multiple copy variants (same brief, parallel generation)
- SEO descriptions for different products (no cross-dependency)

### Step 5: HITL Gate Placement
Insert approval checkpoints where client input is required:
- After TOV document (must match voice before writing anything)
- After first 2-3 samples (template validation before batch)
- After full batch (before scheduling/delivery)
- After any room that produces something irreversible

---

## Execution Plan Output Format

```yaml
execution_plan:
  mission_id: "[mission-id]"
  client: "[client name]"
  total_deliverables: [N]
  estimated_cost: "$[X]"
  estimated_time: "[X hours]"

  phases:
    - phase: 1
      name: "Foundation"
      rooms: [BriefingRoom, NicheAdapterRoom]
      runs: sequential
      outputs: ["enriched_MCO", "niche_profile"]
      hitl_gate: false

    - phase: 2
      name: "Voice Definition"
      rooms: [CopywritingRoom]
      runs: sequential
      depends_on: [phase_1]
      outputs: ["tov_document"]
      hitl_gate: true
      gate_description: "Client approves TOV before any content is written"

    - phase: 3
      name: "Sample Production"
      rooms: [CopywritingRoom, ImageGenRoom]
      runs: parallel
      depends_on: [phase_2]
      outputs: ["copy_samples_3", "visual_prompts_3"]
      hitl_gate: true
      gate_description: "Client approves samples — confirms template before batch run"

    - phase: 4
      name: "Batch Production"
      rooms: [CopywritingRoom, ImageGenRoom]
      runs: parallel
      depends_on: [phase_3_approved]
      outputs: ["all_deliverables"]
      hitl_gate: false

    - phase: 5
      name: "QC"
      rooms: [EvaluationRoom]
      runs: sequential
      depends_on: [phase_4]
      outputs: ["qc_report"]
      hitl_gate: false

    - phase: 6
      name: "Delivery"
      rooms: [ReportMasterRoom, FinalizerRoom]
      runs: sequential
      depends_on: [phase_5_passed]
      outputs: ["final_package", "client_report"]
      hitl_gate: true
      gate_description: "Final client sign-off before delivery"

  risks:
    - "[Risk that could stall execution + mitigation]"

  open_questions:
    - "[Anything unclear that needs client answer before starting]"
```

---

## Planning Rules

1. **Never start batch before sample approval** — one bad template × 17 = 17 bad outputs
2. **Budget reserve** — keep 20% budget unallocated for retries and corrections
3. **Parallel is faster, sequential is safer** — default to sequential for new clients, parallel after first approval
4. **One HITL gate per phase transition** — too many gates kill momentum, too few create rework
5. **Flag scope creep** — if a deliverable wasn't in the original brief, surface it before executing

---

## Related Skills
- `task-orchestrator` — executes this plan at runtime
- `copywriting` — primary production room for text deliverables
- `visual-prompt-engineering` — primary production room for visual deliverables
- `anti-slop` — QC gate before any HITL review
