---
name: anti-slop
type: validator
color: "#C0392B"
version: 1.0.0
priority: medium
description: Detect and correct "AI look" in generated content — both visual artifacts and text patterns. Use before any deliverable reaches the client. Runs as a post-generation quality gate inside output-reviewer.
capabilities:
  - ai_artifact_detection
  - generic_language_removal
  - specificity_enforcement
  - cliche_elimination
  - em_dash_hunting
  - adverb_audit
  - authenticity_scoring
depends_on: []
blocks: [output-reviewer]
rooms: [EvaluationRoom, ReportMasterRoom, CopywritingRoom, ImageGenRoom]
agents: [QCAgent, EvaluationAgent, Copywriter]
hooks:
  pre: |
    echo "🚫 Anti-slop scan: $CONTENT_TYPE ($WORD_COUNT words)"
    # Load client voice fingerprint from MCO for comparison
  post: |
    echo "✅ Scan complete — artifacts found: $ARTIFACT_COUNT"
    echo "Specificity score: $SPECIFICITY_SCORE"
---

# Anti-Slop Engine Skill

The Anti-Slop Engine detects and corrects generic AI-generated patterns that would make a professional identify the work as low-effort or machine-produced. The target metric: **"Would a design or copy professional spot this as AI-generated?"** If yes, it fails.

---

## Visual Anti-Slop

### Detection
Scan for AI visual markers across four categories: lighting/color, composition, detail/texture, and tell-tale patterns (glass eyes, perfect hair, unworn environments).

→ Full marker list: `resources/visual-markers.md`

### Prevention
Add anti-slop injections to every photorealistic prompt before generation. Add negative prompts for diffusion models.

→ Injections and negative prompt list: `resources/visual-markers.md`

### Correction
If a generated image passes visual review but still has mild AI-look, apply post-generation fixes: film grain, micro color variation, chromatic aberration, selective sharpening, exposure imperfection.

→ Technique details: `resources/visual-markers.md`

---

## Text / Copy Anti-Slop

### Detection
Scan all copy for four categories of AI tells:
- Slop openers (delete first sentence — the piece usually survives)
- Vague corporate language (leverage, streamline, seamless, robust…)
- Structural AI tells (equal-length paragraphs, round list counts, summary restatements)
- Over-hedging phrases

→ Full banned lists and structural patterns: `resources/copy-patterns.md`

### Correction
Run the four-round editing pass: kill openers → replace vague words → break patterns → inject voice.

→ Round-by-round checklist: `resources/copy-patterns.md`

---

## Scoring

Rate each deliverable 1–10 across five dimensions. Minimum 7.0 to pass.

| Dimension | Fail (1-3) | Pass (7-10) |
|-----------|-----------|-------------|
| Visual authenticity | Clear AI markers | No obvious tells |
| Specificity | Generic, could be anything | Specific to this client/brief |
| Composition | Centered, even, sterile | Intentional, designed |
| Voice (copy) | Corporate AI speak | Clear brand personality |
| Detail quality | Perfect but fake | Imperfect but real |

**Below threshold:** Return to generating agent with specific correction notes.

---

## Output Format

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
