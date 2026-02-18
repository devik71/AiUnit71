# AiUnit71 — Pipeline Documentation

> End-to-end execution flow for every task processed by the system.

---

## Overview

```
User Input
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│                        Orchestrator                          │
│                                                              │
│  submitTask()                                                │
│       │                                                      │
│       ├─→ [1] Planner.plan()      ← task decomposition      │
│       │         │                                            │
│       │         └─→ identify rooms → build subtasks         │
│       │                   │                                  │
│       ├─→ [2] HITL check  │         ← autonomy gate         │
│       │         │         │                                  │
│       │    approved?   awaiting?                             │
│       │         │         │                                  │
│       ├─────────┘         └─→ approval queue (blocked)      │
│       │                                                      │
│       ├─→ [3] Parallel execution groups                     │
│       │         │                                            │
│       │         └─→ Room.acceptTask() × N (concurrent)      │
│       │                   │                                  │
│       │             CostRouter.route()                       │
│       │                   │                                  │
│       │             processTask()                            │
│       │                   │                                  │
│       │             MemoryStore.add()                        │
│       │                                                      │
│       └─→ [4] Result aggregation → Task.output              │
└──────────────────────────────────────────────────────────────┘
```

---

## Stage 1 — Task Submission

**Entry point:** `Orchestrator.submitTask(input: TaskInput)`

```typescript
const task: Task = {
  id: uuid(),
  title: input.title,
  description: input.description,
  status: TaskStatus.PENDING,
  priority: input.priority ?? TaskPriority.NORMAL,
  ...
};
```

- Task is assigned a UUID and stored in `tasks: Map<string, Task>`
- `task:created` event is emitted on the event bus
- Status: `PENDING`

---

## Stage 2 — Planning & Decomposition

**Entry point:** `Planner.plan(input: TaskInput)`

### 2a. Keyword Matching

The planner scans the task description for keyword signals:

```
"create a video ad and blog post"
        │                │
        ▼                ▼
   video-room      copywriting-room
```

Keyword map (`KEYWORD_ROOM_MAP`):

| Room | Trigger Keywords |
|------|-----------------|
| `brainstorm` | idea, concept, moodboard, creative direction |
| `copywriting` | copy, text, write, blog, ad copy, script, lyrics, smm |
| `image-gen` | image, photo, illustration, graphic, banner, poster |
| `ux-ui` | ui, ux, design, wireframe, prototype, layout, figma |
| `animation` | animate, animation, lottie, motion, mascot, loading |
| `video` | video, clip, reel, music video, commercial, trailer |
| `3d-render` | 3d, render, model, blender, mesh, texture |
| `music-audio` | music, song, audio, voice, jingle, podcast, sound |
| `code-deploy` | code, deploy, website, app, api, skill, next.js |
| `cost-routing` | *(analysis/meta tasks)* |

### 2b. Subtask Creation

One `Task` object is created per matched room:

```
Parent Task
├─ Subtask → brainstorm-room
├─ Subtask → copywriting-room
└─ Subtask → image-gen-room
```

### 2c. Parallel Groups

All subtasks are collected into a **single parallel group** — creative tasks run concurrently (Unbreakable Creative Continuity principle).

Output: `PlannerResult { subtasks, parallelGroups, reasoning }`

---

## Stage 3 — HITL Gate

**Entry point:** `HitlManager.needsApproval(action, cost, autonomyLevel)`

### Autonomy Levels

| Level | Name | Behavior |
|-------|------|----------|
| 0 | `LOCKED` | Every action requires human approval |
| 1 | `SUPERVISED` | Critical/costly actions require approval |
| 2 | `GUIDED` | Only destructive/expensive actions blocked |
| 3 | `FREERIDE` | Full autonomy — no approvals |

### Approval Flow

```
subtask cost > threshold?
        │
        ├── YES → requestApproval() → status: AWAITING_APPROVAL
        │                              (halts until operator approves)
        │
        └── NO  → push to approved[]
                   → continue to execution
```

---

## Stage 4 — Cost Routing

**Entry point:** `CostRouter.route(request: RouteRequest)`

Called by every Room before executing any model operation.

### Decision Hierarchy

```
1. forceModel? ──────────────────────────────→ use it
2. filter by capabilities
3. filter by minQuality (default: 50/100)
4. filter by API key availability
5. filter by maxCostUsd (if set)
6. sort: cheapest first, local preferred on tie
7. preferLocal? → move best local to front
8. return candidates[0]
```

### Model Priority (cost order)

```
Local Ollama (free)
    ├─ llama3.2-vision:11b
    ├─ qwen2.5-vl:7b
    ├─ deepseek-coder-v2:16b
    └─ glm-4.7-flash

OpenRouter (pay-per-token)
    ├─ deepseek/deepseek-r1 (cheapest cloud)
    ├─ google/gemini-flash-1.5
    ├─ anthropic/claude-haiku-3.5
    ├─ openai/gpt-4o-mini
    └─ anthropic/claude-sonnet-4 (premium)

Specialized APIs (per-generation)
    ├─ Midjourney (image)
    ├─ Kling / Sora (video)
    ├─ Suno (music)
    └─ ElevenLabs (voice)
```

**Output:** `RouteResult { selected: ModelOption, estimate: CostEstimate, reasoning: string }`

---

## Stage 5 — Room Execution

**Entry point:** `BaseRoom.acceptTask(task: Task)` → `executeTask()` → `processTask()`

### Task Lifecycle in a Room

```
PENDING → QUEUED → IN_PROGRESS → COMPLETED
                              └→ FAILED
```

### Execution Steps

```
1. acceptTask(task)
   ├─ capacity check (maxConcurrentTasks)
   ├─ push to activeTasks[]
   ├─ write to MemoryStore (type: "context")
   └─ call executeTask()

2. executeTask(task)
   ├─ status → IN_PROGRESS
   ├─ find idle agent (findIdleAgent)
   ├─ agent.status → "working"
   ├─ call processTask()  ← room-specific logic
   │
   ├─ ON SUCCESS:
   │   ├─ status → COMPLETED
   │   ├─ task.output = result
   │   ├─ agent.status → "idle"
   │   ├─ MemoryStore.add (type: "experience")
   │   └─ emit task:completed
   │
   └─ ON FAILURE:
       ├─ status → FAILED
       ├─ task.error = errMsg
       ├─ MemoryStore.add (type: "error")
       └─ emit task:failed

3. finally:
   ├─ remove from activeTasks[]
   └─ room.status → "idle" (if no more tasks)
```

### Room-Specific Processing (examples)

| Room | processTask() behavior |
|------|----------------------|
| `BrainstormRoom` | Routes to text-generation model → returns concepts[] |
| `CopywritingRoom` | Routes to text-generation → returns copy variants |
| `ImageGenRoom` | Routes to image-generation (Midjourney/DALL-E) → returns image URLs |
| `AnimationRoom` | Routes to code-generation → returns Lottie JSON / CSS |
| `VideoRoom` | Routes to video-generation (Kling/Sora) → returns video URLs |
| `MusicAudioRoom` | Routes to audio-generation (Suno/ElevenLabs) → returns audio files |
| `CodeDeployRoom` | Routes to code-generation → deploys to Vercel → returns deploy URL |

---

## Stage 6 — Result Aggregation

Back in `Orchestrator.submitTask()`, after `Promise.allSettled(promises)`:

```typescript
const allCompleted = allSubtasks.every(t => t.status === COMPLETED);
const anyFailed   = allSubtasks.some(t  => t.status === FAILED);

if (allCompleted) {
  task.status = COMPLETED;
  task.output = { subtaskResults: [...] };
} else if (anyFailed) {
  task.status = FAILED;
  task.error = failedSubtasks.map(t => t.error).join("; ");
}
```

**Output shape:**

```json
{
  "id": "task-uuid",
  "status": "completed",
  "output": {
    "subtaskResults": [
      { "id": "...", "room": "copywriting", "status": "completed", "output": { ... } },
      { "id": "...", "room": "image-gen",   "status": "completed", "output": { ... } }
    ]
  }
}
```

---

## Stage 7 — Memory & Event Bus

Every stage writes to shared infrastructure:

### MemoryStore

```
MemoryEntry {
  roomId, taskId, agentId?,
  type: "context" | "experience" | "error" | "learning" | "decision",
  content: string,
  metadata: Record<string, unknown>,
  timestamp: Date
}
```

Used for:
- Agent teleportation context (carry knowledge between rooms)
- Style consistency across parallel rooms
- Post-session learning export (`exportAsMarkdown()`)

### EventBus

Events emitted through the pipeline:

```
task:created
task:assigned
task:started
task:completed / task:failed
room:created / room:activated
agent:teleported
cost:recorded
hitl:approval_required / hitl:approved / hitl:rejected
```

---

## Parallel Execution Model

```
Group 1 (all creative tasks run concurrently):
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Brainstorm │  │ Copywriting │  │  Image Gen  │  │    Video    │
│   Room      │  │   Room      │  │    Room     │  │    Room     │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │                │
       └────────────────┴────────────────┴────────────────┘
                        │
                   Promise.allSettled()
                        │
                   Result assembly
```

All rooms share a single `MemoryStore` — results from Room A are visible to Room B during execution for style synchronization.

---

## Agent Teleportation

An agent can be moved between rooms to carry context:

```typescript
orchestrator.teleportAgent(agentId, fromRoomId, toRoomId)

// Internally:
1. fromRoom.removeAgent(agentId)
2. validate agent.config.canTeleport === true
3. agent.status = "teleporting"
4. toRoom.addAgent(agent)
5. emit agent:teleported
```

**Use case:** Art Director agent finishing in BrainstormRoom teleports to ImageGenRoom to enforce visual consistency.

---

## Cost Tracking

```
Per operation:
  CostRouter.route() → CostEstimate { estimatedCostUsd }

Session total:
  eventBus "cost:recorded" → CostRouter.recordCost(costUsd)
  CostRouter.getTotalSpent() → number
  CostRouter.getCostSummary() → string

Per task:
  task.costEstimate  (pre-execution estimate)
  task.actualCost    (post-execution record)
```

---

## Skills Pipeline (skill.md modules)

Skills are higher-order workflows that orchestrate multiple rooms:

### Mascot Animation Skill
```
BrainstormRoom (character design)
      ↓
AnimationRoom (keyframe planning)
      ↓
AnimationRoom (generation: deepseek → gemini → claude fallback)
      ↓
Quality validation → export Lottie JSON / CSS / GIF
```

### Parallel Creative Flow Skill
```
All 5 rooms activate simultaneously:
  Brainstorm + Copywriting + ImageGen + Video + Music
       ↓ (MemoryStore sync)
  Style synchronization pass
       ↓
  Assembly & delivery
```

### Niche Adapter Skill
```
Niche detection (catalog or LLM)
      ↓
Service package generation (pricing + rooms)
      ↓
Profitability analysis (ROI, margin, break-even)
      ↓
Proposal formatting (CopywritingRoom)
```

---

## CLI Pipeline Entry Points

```bash
# Submit a task
aiunit71 run --task "Create SMM campaign" --autonomy 2

# Check system status
aiunit71 status

# View cost report
aiunit71 cost

# Manage HITL approvals
aiunit71 hitl list
aiunit71 hitl approve <taskId>

# Generate niche package
aiunit71 niche --industry restaurant

# List rooms
aiunit71 rooms
```

---

## Known Limitations & Next Steps

| # | Issue | Impact | Fix |
|---|-------|--------|-----|
| 1 | `AWAITING_APPROVAL` tasks never re-queued after approval | Tasks blocked forever | Implement approval callback → re-submit to room |
| 2 | All subtasks always in one parallel group | Sequential dependencies impossible | Add dependency graph to `PlannerResult` |
| 3 | Subtask `parentId` never set | Task tree navigation broken | Set `subtask.parentId = task.id` in Planner |
| 4 | `maxCostUsd` filter can exhaust candidates → undefined crash | Runtime exception | Throw `Error` with clear message when filter empties candidates |
| 5 | No CI/CD pipeline | No automated test runs | Add GitHub Actions workflow |
| 6 | Keyword matching is English-only | Ukrainian task descriptions not routed | Add Ukrainian keyword synonyms or LLM-based routing |
