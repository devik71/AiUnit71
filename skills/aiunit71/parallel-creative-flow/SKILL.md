---
name: parallel-creative-flow
type: optimizer
color: "#16A085"
version: 1.0.0
priority: medium
description: Orchestrate multi-room parallel creative production where visual, textual, audio, and video generation happen simultaneously. Implements Unbreakable Creative Continuity — creative processes never wait for each other sequentially.
capabilities:
  - concurrent_branch_management
  - output_merging
  - continuity_enforcement
  - timeline_compression
  - failure_isolation
  - partial_delivery_handling
depends_on: [mission-planner]
blocks: [output-reviewer]
rooms: [CopywritingRoom, ImageGenRoom, BrainstormRoom]
agents: [OrchestratorAgent, Copywriter, VisualPrompter]
hooks:
  pre: |
    echo "⚡ Parallel flow: $BRANCH_COUNT branches activating"
    echo "Branches: $BRANCH_NAMES"
    # Fault-tolerance: if one branch fails 3x, isolate — others continue
  post: |
    echo "🔀 Merge complete → output-reviewer"
    echo "Branches completed: $COMPLETED/$BRANCH_COUNT"
---

# Parallel Creative Flow Skill

## Description
Orchestrate multi-room parallel creative production where visual, textual, audio, and
video generation happen simultaneously. Implements the "Unbreakable Creative Continuity"
principle — creative processes never wait for each other sequentially.

## Capabilities
- Parallel room activation for creative tasks
- Live context sharing between concurrent rooms
- Dependency graph resolution
- Creative continuity across production phases
- Cross-room artifact handoff
