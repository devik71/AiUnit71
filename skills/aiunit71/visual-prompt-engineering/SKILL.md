---
name: visual-prompt-engineering
type: producer
color: "#FF5100"
version: 1.0.0
priority: medium
description: Craft and translate visual prompts for AI image generation. Use when an agent needs to produce prompts for Midjourney, Flux/SDXL (ComfyUI), or Nano Banana (reasoning models). Implements the dual-layer semantic JSON → model-native prompt architecture.
capabilities:
  - visual_direction
  - prompt_crafting
  - style_consistency
  - mood_boarding
  - model_native_translation
  - art_direction
  - brand_visual_alignment
depends_on: [mission-planner, client-researcher]
blocks: [output-reviewer]
rooms: [ImageGenRoom, BrainstormRoom, UxUiRoom]
agents: [PromptMasterAgent, VisualPrompter]
hooks:
  pre: |
    echo "🎨 Visual prompting: $STYLE_DIRECTION for $CLIENT"
    # Load visual identity: brand colors, typography, mood from MCO
    # Check target model: $TARGET_MODEL (midjourney|flux|nano-banana)
  post: |
    echo "📤 Prompt set ready ($PROMPT_COUNT prompts) → output-reviewer"
---

# Visual Prompt Engineering Skill

You operate as a specialized visual prompt engineer. You translate creative briefs and visual concepts into structured prompts that produce professional, on-brand images across AI generation platforms.

## Core Architecture: Dual-Layer Prompting

### Layer 1: Semantic JSON (model-agnostic, internal format)
Always produce this first. It is the source of truth.

```json
{
  "subject": {
    "type": "what is the main subject",
    "material": "textures, finish, materials",
    "position": "placement and pose"
  },
  "environment": {
    "background": "what is behind the subject",
    "elements": "supporting environmental details",
    "depth": "shallow/deep, focus treatment"
  },
  "lighting": {
    "primary": "main light source and quality",
    "secondary": "fill, rim, accent lights",
    "mood_contribution": "what emotion the lighting creates"
  },
  "composition": {
    "framing": "shot type (close, medium, wide)",
    "angle": "camera angle",
    "negative_space": "where and how much empty space",
    "aspect_ratio": "exact ratio for the deliverable"
  },
  "style": {
    "medium": "photography / 3D / illustration / etc.",
    "aesthetic": "key style words",
    "color_palette": ["#hex1", "#hex2"],
    "anti_slop": ["specific naturalizing details"]
  },
  "constraints": {
    "no_text_in_image": true,
    "brand_colors_required": true,
    "safe_zone": "area to keep clear for text overlay"
  }
}
```

### Layer 2: Model-Native Render

#### Diffusion Models (Flux / SDXL via ComfyUI)
- Keyword-based, weighted syntax: `(term:weight)`
- Max 75 CLIP tokens — be ruthless about token count
- Always include negative prompt
- Weights safe range: 0.5–1.6

```
(3D product visualization:1.3), [subject details],
[environment], (lighting description:1.2),
[composition], [style keywords],
negative space [direction]

Negative: text, watermark, oversaturated, plastic look,
centered composition, stock photo, extra objects
```

#### Reasoning Models (Nano Banana Pro / 2)
- Natural language or structured JSON
- No token limit — be descriptive
- Embed all constraints in the prompt directly

```json
{
  "prompt": "Create a [detailed natural language description covering all semantic JSON fields in narrative form]. Leave [safe_zone] clear for text overlay.",
  "aspect_ratio": "16:9",
  "num_images": 1
}
```

#### Midjourney
- Natural language + parameters
- No weighting syntax
- Use `--no` for exclusions

```
[subject], [environment], [lighting],
[camera angle], [style], [aesthetic]
--ar [ratio] --s [stylize 500-1000] --v 6.1
--no text, watermark, stock photo
```

---

## Pre-Prompt Checklist

Pull from Mission Context Object:
- [ ] `brand.colors` → inject into color_palette
- [ ] `technical.required_formats` → set aspect_ratio
- [ ] `style_constraints` → populate constraints and anti_slop
- [ ] `hero_container.text_zone` → set safe_zone
- [ ] `client_taste_profile` → bias lighting, composition, mood

Validation gates:
- [ ] Subject defined concretely (not vague)?
- [ ] Lighting specified explicitly?
- [ ] No contradictions between elements?
- [ ] Aspect ratio matches technical specs?
- [ ] Brand colors present?
- [ ] Budget sufficient for planned generation?

→ Photography terminology and lens/lighting translations: `resources/photography-terminology.md`
→ Genre prompt templates (hero shot, lifestyle, abstract): `resources/genre-patterns.md`
→ Typography systems (scales, pairing, web font loading): `resources/typography.md`
→ Color theory and OKLCH palettes: `resources/color-and-contrast.md`
→ Spatial design, grids, visual hierarchy: `resources/spatial-design.md`
→ Motion timing, easing, reduced motion: `resources/motion-design.md`
→ UX writing for UI deliverables: `resources/ux-writing.md`

---

## Output Format

For each prompt request, deliver:

### 1. Semantic JSON
Complete structured description (source of truth)

### 2. Rendered Prompts
One version per target platform/model

### 3. Generation Parameters
- Model recommendation with reasoning
- Number of variants (draft: 1, final: 2-4)
- Estimated cost
- Seed strategy (random for variety, fixed for consistency)

### 4. Negative Prompt
For diffusion models — what to explicitly exclude

---

## Related Skills
- `anti-slop` — post-generation check and correction; includes visual injection lists
- `copywriting` — safe zone copy to pair with visuals
- `social-content` — platform specs for image sizing
