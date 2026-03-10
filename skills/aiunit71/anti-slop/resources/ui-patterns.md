# UI Anti-Patterns — AI Slop Detection

> Source: Impeccable `frontend-design` skill (pbakaus/impeccable, Apache 2.0)
> Scope: UI/frontend deliverables — landing pages, dashboards, components, posters

The question for every UI deliverable: **"If you showed this interface to someone and said 'AI made this,' would they believe you immediately?"** If yes, it fails.

---

## The AI Slop Test (UI)

These are the fingerprints of AI-generated UI from 2024–2025. Each one is a fail signal.

### Color & Theme Fails

| Pattern | Why It Fails |
|---------|-------------|
| Cyan-on-dark with neon accents | The default AI aesthetic — immediately recognizable |
| Purple-to-blue gradients | Appears in 80%+ of AI-generated interfaces |
| Gradient text on metrics or headings | Decorative, not meaningful |
| Default to dark mode with glowing accents | Looks "cool" without requiring actual design decisions |
| Pure black (#000) or pure white (#fff) | Never appears in nature; always tint |
| Gray text on colored backgrounds | Looks washed out; use a shade of the bg color instead |

### Layout & Composition Fails

| Pattern | Why It Fails |
|---------|-------------|
| Everything centered | Left-aligned text with asymmetric layouts feels more designed |
| Identical card grids (icon + heading + text, repeated) | Template-looking, no hierarchy |
| Cards nested inside cards | Visual noise; flatten the hierarchy |
| Everything wrapped in cards | Not everything needs a container |
| Hero metric layout (big number, small label, supporting stats, gradient accent) | Overused template — appears in every AI dashboard |
| Same spacing everywhere | Without rhythm, layouts feel monotonous |

### Visual Detail Fails

| Pattern | Why It Fails |
|---------|-------------|
| Glassmorphism as default style | Blur effects and glow borders used decoratively, not purposefully |
| Rounded rectangle with thick colored border on one side | Lazy accent, almost never looks intentional |
| Sparklines as decoration | Charts that look sophisticated but convey nothing |
| Generic rounded rectangles with drop shadows | Safe, forgettable, indistinguishable from AI output |
| Large icons with rounded corners above every heading | Rarely add value, make sites look templated |
| Modals as default interaction | Modals are lazy; consider inline, drawer, or undo |

### Typography Fails

| Pattern | Why It Fails |
|---------|-------------|
| Inter, Roboto, Arial, Open Sans, system defaults | Everywhere, making design generic |
| Monospace as shorthand for "technical/developer" | Lazy aesthetic shorthand |
| Too many font sizes too close together (14/15/16/18px) | Muddy hierarchy |
| All the same weight | No visual contrast |

### Motion Fails

| Pattern | Why It Fails |
|---------|-------------|
| Bounce or elastic easing | Dated, tacky; real objects decelerate smoothly |
| Animating width/height/padding/margin | Causes layout recalculation; use transform/opacity |
| Animations everywhere | Animation fatigue; make it intentional |
| >500ms for UI feedback | Feels slow and heavy |
| Ignoring `prefers-reduced-motion` | Accessibility failure |

### UX Writing Fails

| Pattern | Why It Fails |
|---------|-------------|
| "OK", "Submit", "Yes/No" button labels | Ambiguous; use verb + object ("Save changes", "Create account") |
| Redundant intro that restates the heading | Wastes space and user attention |
| Varying terminology for same action (Delete/Remove/Trash) | Creates confusion |
| Generic loading copy ("Loading...") | Be specific: "Saving your draft..." |

---

## Scoring (UI Deliverables)

Score 1–10. Minimum **7.0 to pass** for visual deliverables entering EvaluationRoom.

| Dimension | Fail (1–3) | Pass (7–10) |
|-----------|------------|------------|
| Color originality | AI palette (cyan, purple gradient, neon) | Distinctive, tinted neutrals, intentional accent |
| Layout intentionality | Centered everything, card grids, hero metric | Asymmetric, varied rhythm, hierarchy through space |
| Visual details | Glassmorphism, generic shadows, decorative charts | Purposeful, memorable, reinforces brand |
| Typography | Overused fonts, no weight variation | Distinctive pairing, clear scale, varied weights |
| AI slop test | Viewer immediately identifies as AI | Viewer asks "how was this made?" |

---

## Correction Protocol

**If a UI deliverable fails:**

1. Identify which category: Color / Layout / Visual / Typography / Motion / Writing
2. Name the specific pattern detected (from tables above)
3. Generate correction note:
   - `PATTERN`: [what was found]
   - `CATEGORY`: [which fail type]
   - `CORRECTION`: [specific alternative]
4. Return to `visual-prompt-engineering` or `copywriting` agent with correction note
5. Re-score after correction — do not pass until ≥7.0 across all dimensions

---

## References

For deeper guidance on correct implementations:
- `resources/color-and-contrast.md` — OKLCH palettes, contrast ratios, accessible color
- `resources/typography.md` — modular scales, font pairing, web font loading
- `resources/spatial-design.md` — 4pt grid, container queries, visual hierarchy
- `resources/motion-design.md` — timing, easing, reduced motion
- `resources/ux-writing.md` — button labels, error messages, loading states
