# Parallel Creative Flow Skill

## Description
Orchestrate multi-room parallel creative production where visual, textual, audio, and
video generation happen simultaneously. Implements the "Unbreakable Creative Continuity"
principle — creative processes never wait for each other sequentially.

## Capabilities
- Parallel room activation for creative tasks
- Live context sharing between concurrent rooms
- Dependency-free creative collaboration
- Agent teleportation for cross-room coordination
- Real-time progress tracking across all active rooms
- Automatic quality synchronization between outputs

## Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| project_brief | string | yes | - | The creative brief describing the project |
| rooms | string[] | no | auto | Rooms to activate (auto-detected if empty) |
| quality_level | string | no | "standard" | Output quality: draft, standard, premium |
| sync_style | boolean | no | true | Ensure visual consistency across outputs |
| max_parallel | number | no | 5 | Maximum rooms running simultaneously |

## Architecture

### Creative Continuity Protocol
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Brainstorm   │  │   Image Gen   │  │  Copywriting  │
│    Room       │  │     Room      │  │     Room      │
│  (concepts)   │  │  (visuals)    │  │   (text)      │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       └────────────┬────┴────────────┬────┘
                    │                 │
              ┌─────▼─────┐   ┌──────▼──────┐
              │   Video    │   │ Music/Audio  │
              │   Room     │   │    Room      │
              └─────┬─────┘   └──────┬──────┘
                    │                │
                    └───────┬────────┘
                            │
                    ┌───────▼───────┐
                    │  Final Output  │
                    │  Assembly      │
                    └───────────────┘
```

All rooms share context via the Memory Store. No room waits for another —
they read whatever context is available and produce their output.

### Step 1: Brief Analysis & Room Selection
- Parse project brief to identify all required deliverables
- Map deliverables to rooms
- Identify optional rooms that would enhance output
- Calculate total estimated cost across all rooms

### Step 2: Parallel Initialization
- Activate all required rooms simultaneously
- Share the project brief as initial context in Memory Store
- Assign agents to tasks within each room
- Start cost tracking per room

### Step 3: Concurrent Execution
All rooms execute in parallel:
```
Time ─────────────────────────────────────────►

Brainstorm:  [concepts ready]───────────────────
Image Gen:   ──[generating]──[visuals ready]────
Copywriting: ──[drafting]──[copy ready]─────────
Video:       ────[planning]──[generating]──[done]
Audio:       ────[composing]──[audio ready]─────
```

Each room:
1. Reads available context from Memory Store
2. Produces its output independently
3. Writes results back to Memory Store
4. Other rooms can optionally incorporate new context

### Step 4: Style Synchronization (if sync_style=true)
- After initial outputs, compare visual/tonal consistency
- Teleport Art Director agent to rooms that need alignment
- Regenerate inconsistent elements
- Final quality check across all outputs

### Step 5: Assembly & Delivery
- Collect all room outputs
- Package into delivery format
- Generate delivery manifest
- Calculate final cost report

## Context Sharing Protocol
```typescript
// Rooms write to shared Memory Store
memory.add(roomId, {
  type: "context",
  content: "Brand colors: #FF6B35, #1A1A2E. Mood: energetic, modern.",
  metadata: { sharedWith: "all" }
});

// Other rooms read available context
const context = memory.getContextForAgent(roomId, 20);
// Agent uses context to align its output
```

## Example Usage
```json
{
  "project_brief": "Create a complete social media launch kit for a new coffee brand 'Dawn Brew'. Include logo concepts, 10 social posts, a 15s promo video, and a jingle.",
  "quality_level": "standard",
  "sync_style": true
}
```

## Auto-detected rooms for this example:
- Brainstorm Room → brand concepts, moodboard
- Image Gen Room → logo, social post visuals
- Copywriting Room → social post captions, taglines
- Video Room → 15s promo video
- Music/Audio Room → jingle

## Cost Estimate
- 5 rooms parallel: $0.05 - $0.50 depending on quality
- Style sync pass: $0.01 - $0.05
- Total typical: $0.10 - $0.60

## Tags
parallel, creative, orchestration, multi-room, continuity, collaboration
