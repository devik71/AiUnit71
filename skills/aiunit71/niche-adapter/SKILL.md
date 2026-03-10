---
name: niche-adapter
type: intelligence
color: "#8E44AD"
version: 1.0.0
priority: medium
description: Auto-analyze a client's industry niche and generate customized service packages with pricing, room assignments, cost estimates, and delivery checklists. Adapts AiUnit71 production capabilities to any market vertical.
capabilities:
  - market_context_mapping
  - terminology_calibration
  - audience_fit_analysis
  - service_package_generation
  - room_assignment_optimization
  - cost_estimation
depends_on: [client-researcher]
blocks: [copywriting, social-content]
rooms: [NicheAdapterRoom, BriefingRoom]
agents: [NicheAdapter, BriefingAgent]
hooks:
  pre: |
    echo "🎯 Niche adapter: calibrating for $INDUSTRY ($CLIENT)"
    # Load research findings from client-researcher output
  post: |
    echo "✅ Niche profile ready — producers calibrated"
    echo "Service package: $PACKAGE_NAME | Est. cost: $ESTIMATED_COST"
---

# Client Niche Adapter Skill

## Description
Auto-analyze a client's industry niche and generate customized service packages with pricing,
room assignments, cost estimates, and delivery checklists. Instantly adapts AiUnit71's
production capabilities to any market vertical.

## Capabilities
- Niche detection from client website or description
- Service package generation with tiered pricing
- Profitability analysis (cost vs. suggested price)
- Room requirement mapping
- Competitor price benchmarking
- Upsell/cross-sell suggestions
