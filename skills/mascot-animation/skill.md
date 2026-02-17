# Mascot Animation Skill

## Description
Generate 2-5 second mascot character animations as Lottie JSON or CSS keyframes.
Suitable for loading screens, brand identities, social media stickers, and UI micro-interactions.

## Capabilities
- Character idle animations (breathing, blinking, waving)
- Emotion expressions (happy, sad, excited, thinking)
- Action loops (walking, jumping, dancing)
- Logo mascot animations
- Export formats: Lottie JSON, CSS @keyframes, GIF

## Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| character_description | string | yes | - | Description of the mascot character |
| animation_type | string | no | "idle" | Type: idle, wave, dance, jump, walk, blink, custom |
| duration_seconds | number | no | 3 | Duration of the loop (2-5 seconds) |
| style | string | no | "flat" | Visual style: flat, 3d, pixel, sketch |
| export_format | string | no | "lottie" | Output: lottie, css, gif |
| colors | string[] | no | [] | Brand colors to use (hex codes) |
| size | string | no | "256x256" | Output dimensions |

## Pipeline

### Step 1: Character Design (Room: brainstorm)
- Analyze character description
- Generate character sheet concept (front, side, expression variants)
- Select animation style based on brand guidelines

### Step 2: Keyframe Planning (Room: animation)
- Define keyframe positions for the animation type
- Calculate easing curves for natural motion
- Plan loop point for seamless repetition

### Step 3: Animation Generation (Room: animation)
```
Model Selection Priority:
1. Local: deepseek-coder-v2:16b (FREE - for Lottie JSON generation)
2. Cloud: google/gemini-2.0-flash ($0.0001/1k - for complex animations)
3. Premium: anthropic/claude-sonnet-4 ($0.003/1k - for pixel-perfect output)
```

Generate the animation data structure:
- Lottie JSON: Full bodymovin-compatible JSON with layers, shapes, transforms
- CSS: @keyframes with transform/opacity properties
- GIF: Frame-by-frame rendering specs

### Step 4: Quality Check (Room: animation)
- Validate Lottie JSON schema
- Check loop seamlessness
- Verify color accuracy against brand colors
- Ensure file size is under 100KB for web use

## Example Usage
```json
{
  "character_description": "A friendly orange fox mascot with big eyes and a fluffy tail",
  "animation_type": "wave",
  "duration_seconds": 3,
  "style": "flat",
  "export_format": "lottie",
  "colors": ["#FF6B35", "#FFA62B", "#FFFFFF"],
  "size": "256x256"
}
```

## Cost Estimate
- Planning: FREE (local LLM)
- Generation: $0.00 - $0.02 depending on complexity
- Total typical cost: < $0.01

## Tags
animation, mascot, lottie, character, branding, motion-design
