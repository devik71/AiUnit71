---
name: mascot-animation
type: producer
color: "#FF5100"
version: 1.0.0
priority: low
description: Generate 2-5 second mascot character animations as Lottie JSON or CSS keyframes. For loading screens, brand identities, social media stickers, and UI micro-interactions.
capabilities:
  - character_design_brief
  - brand_persona_translation
  - animation_spec_generation
  - lottie_json_output
  - visual_identity_extension
  - micro_interaction_design
depends_on: [client-researcher]
blocks: [output-reviewer]
rooms: [ImageGenRoom, BrandRoom]
agents: [VisualPrompter, BrandGuardian]
hooks:
  pre: |
    echo "🎭 Mascot animation: $CHARACTER_NAME for $CLIENT"
    # Load brand persona, color palette, movement style from MCO
  post: |
    echo "📤 Animation spec ready → output-reviewer"
---

# Mascot Animation Skill

## Description
Generate 2-5 second mascot character animations as Lottie JSON or CSS keyframes.
Suitable for loading screens, brand identities, social media stickers, and UI micro-interactions.

## Capabilities
- Character idle animations (breathing, blinking, waving)
- Emotion expressions (happy, sad, excited, thinking)
- Action loops (walking, jumping, dancing)
- Brand mascot lifecycle (intro, loop, exit states)
- CSS keyframe export for web integration
- Lottie JSON export for cross-platform use
