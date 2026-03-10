# Visual AI Marker Reference

## Common AI Visual Artifacts

### Lighting & Color
- Oversaturation (colors look "punchy" but fake)
- Perfectly even lighting with no shadows
- Unnatural HDR effect — everything equally sharp and lit
- Plastic/glossy skin or material surfaces
- Colors that are too clean — no environmental color cast

### Composition & Structure
- Perfect symmetry in portraits (real faces are asymmetric)
- Subject always centered with equal negative space both sides
- Overly smooth gradients — no texture variation
- Everything in frame looks equally important (no visual hierarchy)
- "Stock photo composition" — subject looks isolated, not in a real environment

### Detail & Texture
- Melting artifacts in hands, fingers, text, teeth
- Unnatural bokeh — too uniform, perfect circles
- Fabric/material textures that repeat too perfectly
- Backgrounds that are too clean or abstract
- Excessive detail everywhere instead of selective focus

### Tell-tale AI Patterns
- Faces with glass-like eyes and no character lines
- Hair that fans out too perfectly
- Environments with no wear, damage, or history
- Product shots where reflections are impossible given the lighting

---

## Pre-Generation Injections (Add to Every Photorealistic Prompt)

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

## Post-Generation Correction Techniques

If an image passes visual review but still has mild AI-look:
1. **Light film grain overlay** — +5-10% grain reduces digital sterility
2. **Micro color variation** — slight hue shift in shadows vs highlights
3. **Subtle chromatic aberration** — 1-2px offset at edges reads as "real lens"
4. **Selective sharpening** — sharp subject, slightly softer edges and background
5. **Slight exposure imperfection** — ±0.3 stops off-perfect reads more authentic
