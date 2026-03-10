---
name: anti-slop
version: 1.0.0
description: Detect and correct "AI look" in generated content — both visual artifacts and text patterns. Use before any deliverable reaches the client. Runs as a post-generation quality gate.
rooms: [EvaluationRoom, ReportMasterRoom, CopywritingRoom, ImageGenRoom]
agents: [QCAgent, EvaluationAgent, Copywriter]
---

# Anti-Slop Engine Skill

The Anti-Slop Engine detects and corrects generic AI-generated patterns that would make a professional identify the work as low-effort or machine-produced. The target metric: **"Would a design or copy professional spot this as AI-generated?"** If yes, it fails.

---

## Visual Anti-Slop

### Detection: Common AI Visual Markers

**Lighting & Color**
- Oversaturation (colors look "punchy" but fake)
- Perfectly even lighting with no shadows
- Unnatural HDR effect — everything equally sharp and lit
- Plastic/glossy skin or material surfaces
- Colors that are too clean — no environmental color cast

**Composition & Structure**
- Perfect symmetry in portraits (real faces are asymmetric)
- Subject always centered with equal negative space both sides
- Overly smooth gradients — no texture variation
- Everything in frame looks equally important (no visual hierarchy)
- "Stock photo composition" — subject looks isolated, not in a real environment

**Detail & Texture**
- Melting artifacts in hands, fingers, text, teeth
- Unnatural bokeh — too uniform, perfect circles
- Fabric/material textures that repeat too perfectly
- Backgrounds that are too clean or abstract
- Excessive detail everywhere instead of selective focus

**Tell-tale AI patterns**
- Faces with glass-like eyes and no character lines
- Hair that fans out too perfectly
- Environments that have no wear, damage, or history
- Product shots where reflections are impossible given the lighting

---

### Prevention: Pre-Generation Injections

Add these to every photorealistic prompt:

```
anti-slop injections:
- "subtle film grain"
- "natural micro-imperfections in materials"
- "slight environmental color cast"
- "not oversaturated, natural color range"
- "asymmetric natural lighting"
- (portraits) "natural skin texture, pores visible, not airbrushed"
- (products) "subtle fingerprints or wear consistent with real use"
- (environments) "natural shadows, slight dust or texture in background"
```

Add to negative prompt (diffusion models):
```
oversaturated, plastic look, airbrushed, HDR, stock photo,
perfect symmetry, centered composition, artificial bokeh,
unnatural smooth skin, melting artifacts, extra limbs
```

---

### Correction: Post-Generation Fixes

If a generated image passes visual review but still has mild AI-look:
1. **Light film grain overlay** — +5-10% grain reduces digital sterility
2. **Micro color variation** — slight hue shift in shadows vs highlights
3. **Subtle chromatic aberration** — 1-2px offset at edges reads as "real lens"
4. **Selective sharpening** — sharp subject, slightly softer edges and background
5. **Slight exposure imperfection** — ±0.3 stops off-perfect reads more authentic

---

## Text / Copy Anti-Slop

### Detection: Common AI Copy Markers

**Openers to kill immediately**
- "In today's fast-paced world..."
- "As an AI language model..."
- "It's important to note that..."
- "I'd be happy to help with..."
- "Certainly! Here's..."
- Any opening that starts with "I"

**Vague corporate language**
- "leverage," "utilize," "facilitate," "streamline"
- "best-in-class," "world-class," "cutting-edge," "state-of-the-art"
- "seamless," "robust," "scalable," "synergy"
- "transform your business," "unlock potential," "revolutionize"
- "holistic approach," "end-to-end solution"

**Structural AI tells**
- Bullet points for everything — even when prose flows better
- Lists of exactly 3 or exactly 5 items (suspiciously round)
- Balanced paragraphs of exactly equal length
- Summary sentence that repeats what was just said
- Conclusions that start with "In conclusion" or "Overall"

**Over-hedging**
- "It's worth noting that..."
- "Keep in mind that..."
- "Of course, results may vary..."
- "This is just one approach..."

---

### Correction: Copy Editing Pass

Run this checklist on all client-facing text:

**Round 1: Kill the openers**
- Delete the first sentence. Does the piece still work? Usually yes.

**Round 2: Replace vague words**
- Find every instance of the slop word list
- Replace with specific, concrete language
- "streamline your workflow" → "cut report time from 4 hours to 15 minutes"

**Round 3: Break the pattern**
- Vary sentence length (mix short punchy sentences with longer ones)
- Convert some bullets to prose
- Remove summary sentences that add nothing

**Round 4: Voice injection**
- Add one piece of specific detail that couldn't be generic
- Add one concrete number or timeframe
- Add one unexpected word choice that fits the brand voice

---

## Evaluation Scoring

Rate each deliverable 1-10 on:

| Dimension | 1-3 (Slop) | 7-10 (Human-quality) |
|-----------|-----------|---------------------|
| Visual authenticity | Clear AI markers | No obvious tells |
| Specificity | Generic, could be anything | Specific to this client/brief |
| Composition | Centered, even, sterile | Intentional, designed |
| Voice (copy) | Corporate AI speak | Clear brand personality |
| Detail quality | Perfect but fake | Imperfect but real |

**Threshold:** 7.0 minimum per dimension to pass QC.
**Below threshold:** Return to generating agent with specific correction notes.

---

## Output Format

### Anti-Slop Report
```
DELIVERABLE: [filename or description]
OVERALL SCORE: X/10

VISUAL ISSUES DETECTED:
- [specific issue] → [correction action]

COPY ISSUES DETECTED:
- [specific phrase] → [replacement]

VERDICT: PASS / FAIL / PASS WITH CORRECTIONS
CORRECTIONS APPLIED: [list of changes made]
```

---

## Related Skills
- `visual-prompt-engineering` — prevent slop at generation time
- `copywriting` — produce slop-resistant copy from the start
