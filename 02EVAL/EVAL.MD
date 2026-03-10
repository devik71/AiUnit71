# 02EVAL — Agency Test: Superbox Storyboard System

> **Date:** 2026-03-10  
> **Subject:** Superbox Storyboard System 2.0  
> **Method:** 8 AiUnit71 rooms applied to a live project  
> **Scope:** Task manager / workflow choreography tool only

---

## Room 1 — Briefing (MCO Brief)

### Mission Client Order

| Field | Value |
|-------|-------|
| **Client** | Internal (Superbox / fintech mascot project) |
| **Product** | Collaborative workflow storyboard tool |
| **Format** | Single-file React app (CDN-loaded, ~1300 lines) + Node.js SSE sync server |
| **Autonomy Level** | 2 (Semi-autonomous) |
| **Budget Class** | Low — internal tooling, no paid APIs in scope |

### Deliverables Requested

1. Structured evaluation of the storyboard system's readiness as a product
2. Prioritized improvement plan mapped to agency skills
3. Specific, actionable fixes — not generic advice

### Brand Voice

- Terminal / cyberpunk aesthetic: `#000000` background, `#00FFFF` primary, `#FF95DA` secondary, `#4AC262` tertiary
- Monospace typography (`Courier New`)
- Dense, information-rich interfaces — no whitespace filler

### Audience

- **Primary:** Small animation/creative studios (2–5 people) doing mascot animation for fintech
- **Secondary:** Any team doing parallel-track workflow coordination (video, software, content, events)
- **Aspiration:** Universal "workflow storyboarding" tool for any domain

---

## Room 2 — Client Research (deep mode)

### Target Audience Analysis

| Segment | Needs | Current Pain |
|---------|-------|-------------|
| **Animation studios** | Frame-by-frame tracking across body/face/FX layers | Trello/Notion don't understand parallel tracks |
| **Creative agencies** | Brief → Copy → Design → Publish pipeline | Tools are list-based, not narrative-based |
| **Software teams** | Backend → Frontend → QA → Deploy sprints | Jira is heavy; this is lightweight choreography |
| **Event planners** | Venue → Catering → AV → Marketing coordination | No tool shows the full parallel timeline |

### Competitive Landscape

| Competitor | Strength | Weakness vs. Superbox |
|-----------|----------|----------------------|
| **Trello** | Simple cards | No parallel tracks, no scenario strips |
| **Notion** | Flexible docs | Can't show parallel workflow at a glance |
| **Monday.com** | Timeline view | Heavy, expensive, enterprise-oriented |
| **Linear** | Dev-focused | No creative workflow support |
| **FigJam** | Visual + collaborative | Canvas-based, not workflow-based |
| **Storyboarder** (Wonder Unit) | Animation storyboards | Single track, not task management |

### Content Territory (Unique Position)

**"Workflow Storyboarding"** — a product category nobody owns yet:
- Scenarios shown as **horizontal strips** (narrative, not list)
- Parallel **layer tracks** visible simultaneously
- **Glyph notation** — a compact visual vocabulary shared by the team
- **Real-time claiming** — multiplayer without overhead
- Progress is **visible at the surface**, not hidden behind clicks

> This is the **actual differentiator**: the storyboard strip makes structure scannable at a glance. Protect this in all future development.

---

## Room 3 — Brainstorm (10 Prioritized Proposals)

| # | Proposal | Impact | Effort | Rationale |
|---|----------|--------|--------|-----------|
| 1 | **Migrate to Vite + TypeScript + React** | 🔴 Critical | Large | CDN-loaded Babel is a prototype stack. Types prevent bugs in the complex glyph/scenario data model |
| 2 | **Cloud persistence (Supabase)** | 🔴 Critical | Large | localStorage = all work lost on clear. Supabase gives Postgres + Realtime + Auth in one setup |
| 3 | **Configurable tracks/layers** | 🟠 High | Medium | Hardcoded body/faceplate/face_anim/external blocks universalization. Let users define their own track names and colors |
| 4 | **Step dependencies** | 🟠 High | Medium | Some steps can't start until others finish. Missing this creates coordination bugs |
| 5 | **File attachments per step** | 🟠 High | Medium | The #1 workflow improvement. Files live on the glyph they belong to — no more "where's the file?" |
| 6 | **Glyph pack system** | 🟡 Medium | Small | Make glyphs importable/exportable JSON packs. Community packs for different domains |
| 7 | **Mobile responsive layout** | 🟡 Medium | Medium | Currently breaks at narrow viewports. Tabs stack, content overflows. At least read-only mobile |
| 8 | **Blockers + comments per step** | 🟡 Medium | Small | Flag a step as blocked with a reason. PM notified. Comments thread per step |
| 9 | **AI scenario generator** | 🟢 Low | Large | Describe workflow in plain text → get a scenario strip. Tier 3 feature, but the differentiator |
| 10 | **Generated completion report** | 🟢 Low | Medium | Single HTML file showing who did what, when, bottlenecks, file list. Client-sendable |

---

## Room 4 — Copywriting (Microcopy Audit)

### Issues Found

| Location | Current | Proposed | Reason |
|----------|---------|----------|--------|
| Setup modal title | `PLAYER SETUP` | `JOIN SESSION` | "Player" implies game; "session" implies work |
| Setup subtitle | `WHO ARE YOU?` | `SET YOUR IDENTITY` | Less confrontational |
| Setup button | `ENTER YOUR NAME FIRST` | `NAME REQUIRED TO JOIN` | Clearer constraint |
| Strips tab hint | `Click step to CLAIM it · click claimed to COMPLETE · double-click to claim+complete · right-click to release` | Split into 2 lines: `Click → claim · Double-click → claim + complete` / `Right-click → release` | Too dense in one line, easy to miss |
| Empty notes state | *(currently handled)* | ✅ Good — `Start typing… use toolbar for formatting` | No change needed |
| History auto-save label | `Auto ${timestamp}` | `Auto — ${relative time}` (e.g. "Auto — 2 min ago") | Relative time is easier to scan |
| Tab label | `Tasks (0/46)` | `Layer Tasks (0/46)` | Clarify these are non-body-layer tasks |
| Export button group | `SAVE · EXPORT · IMPORT · SETUP` (cramped) | Add 4px gap between groups; separate SETUP visually with a divider | Misclick risk on small screens |

### Strengths Worth Keeping

- ✅ `000%` → `100%` big progress counter — psychologically brilliant
- ✅ Color-coded layer labels (FACEPLATE, FACE ANIM, EXTERNAL) — instant recognition
- ✅ `—` step separators in scenario strips — clean flow visualization
- ✅ Version history UI (AUTO / MANUAL labels) — well-structured

---

## Room 5 — UX/UI Design (Visual Audit)

### Verified in Browser ✅

Opened `superbox-storyboard-system-2.0.html`, completed player setup as "AiUnit71 Auditor", and navigated all 5 tabs.

![Storyboard System — Strips View](/Users/macbook/.gemini/antigravity/brain/8c5893e8-645f-4a61-b970-39b9dcf3a1b2/main_interface_strips_1773148807957.png)

### Findings

| Issue | Severity | Fix |
|-------|----------|-----|
| **Not mobile responsive** — at 400px width, tabs stack awkwardly, content overflows | 🟠 High | Add `min-width: 900px` on body or build a simplified mobile read-only view |
| **Header action buttons cramped** — SAVE / EXPORT / IMPORT / SETUP too close together | 🟡 Medium | Group with dividers: `[SAVE · EXPORT] | [IMPORT] | [SETUP]` — add `gap: 8px` between groups |
| **Step cards in strips are small** — glyph label + layer label crammed into ~52px min-width | 🟡 Medium | Increase `min-width` to 64px; or add `title` tooltips (already present ✅) |
| **Scenario strip text flow** — the `→` chain at bottom is useful but low contrast (`#333`) | 🟢 Low | Bump arrow color to `#555` for better scanability |
| **Clock competing with actions** — `15:20:06` and action buttons share the header row | 🟢 Low | Move clock to a fixed corner overlay or integrate into progress bar |

### Strengths Observed

- ✅ **Progress counter** — 44px font, monospaced, color-shifts as % climbs. Premium feel
- ✅ **Color coding** — cyan/magenta/green layer system is highly effective for scanning
- ✅ **Player identity** — colored avatar badge + initials system is well-designed
- ✅ **Tab counts** — `Strips (17)`, `Tasks (0/46)`, `Notes (2)` — informative labels
- ✅ **Version history** — AUTO/MANUAL distinction with restore + delete is production-grade

---

## Room 6 — Code & Deploy (Tech Debt Report)

### Architecture Assessment

| Aspect | Current State | Target State | Migration Path |
|--------|--------------|-------------|----------------|
| **Framework** | CDN React 18 + Babel (runtime compilation) | Vite + TypeScript + React | `npx create-vite@latest ./ --template react-ts` |
| **State** | 12+ `useState` hooks in one `App()` function (650+ lines) | Zustand stores (checked, claimed, players, notes, scenarios, glyphs) | Extract 6 stores, ~50 lines each |
| **Sync** | Custom SSE server (94 lines, no auth) | Supabase Realtime or Liveblocks | Replaces both `server.js` and localStorage |
| **Components** | Inline in single file (1300 lines) | Extracted: StoryboardStrip, SetupPanel, RichEditor, etc. | Already functionally isolated — easy split |
| **Persistence** | `localStorage` only | Supabase Postgres | Schema: projects, scenarios, steps, players, notes |
| **Auth** | None | Google OAuth via Supabase | One integration point |
| **Testing** | None | Playwright E2E for core flows | Setup + claim + complete + export |

### Code-Level Issues

| File | Line Range | Issue | Fix |
|------|-----------|-------|-----|
| `2.0.html` | 119–137 | `SCENARIOS` array is 18 objects × ~120 chars each, all on single lines | Extract to `scenarios.json` or `scenarios.ts` constant |
| `2.0.html` | 606–800 | `App()` function is 700+ lines with 12 useState, 8 useEffect, 7 useRef | Split into `useSync()`, `usePlayer()`, `useVersions()` custom hooks |
| `2.0.html` | 673–688 | `pushAll()` sends entire state on every sync | Diff-based sync or field-level updates |
| `2.0.html` | 770–787 | Progress computation recalculates on every render | Memoize with `useMemo` |
| `server.js` | 12 | Shared state = single JS object, no persistence | Add SQLite fallback or Supabase |
| `server.js` | 53–67 | `POST /state` replaces entire state (no merge) | Switch to PATCH semantics with field-level merge |

### Recommended Migration Order

```
Phase 1: Vite + TS + Component split     (no behavior change, just architecture)
Phase 2: Zustand + custom hooks           (state management cleanup)
Phase 3: Supabase (db + auth + realtime)  (replaces localStorage + server.js)
Phase 4: Configurable tracks + glyph packs (universalization)
Phase 5: Dependencies + blockers + files   (workflow power features)
```

---

## Room 7 — Cost Routing (Effort Estimates)

| Improvement | Dev Days | Model Cost | Total Est |
|-------------|----------|-----------|-----------|
| Vite + TS migration | 3–5 days | $0 (local) | **$0** |
| Component extraction | 2–3 days | $0 | **$0** |
| Zustand state management | 1–2 days | $0 | **$0** |
| Supabase integration (db + auth + realtime) | 5–7 days | $25/mo (Pro) | **$25/mo** |
| Configurable tracks | 3–4 days | $0 | **$0** |
| Step dependencies | 2–3 days | $0 | **$0** |
| File attachments per step | 3–5 days | Supabase Storage included | **$0** |
| Glyph pack system (import/export) | 1–2 days | $0 | **$0** |
| Mobile responsive | 2–3 days | $0 | **$0** |
| Blockers + comments | 1–2 days | $0 | **$0** |
| AI scenario generator | 3–5 days | Sonnet API ~$0.50/generation | **~$5/mo** |
| Completion report generator | 2–3 days | $0 | **$0** |

**Total estimated dev effort:** 28–44 days  
**Total recurring cost:** ~$30/month (Supabase Pro + occasional AI calls)

---

## Room 8 — Evaluation (Quality Scorecard)

### Scoring (5 Dimensions, output-reviewer pre_client mode)

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| **Brief Compliance** | 8/10 | Tool does exactly what it promises — collaborative storyboard tracking with parallel layers |
| **Brand Voice** | 9/10 | Consistent cyberpunk aesthetic, monospace typography, neon color system. Premium terminal feel |
| **Audience Fit** | 7/10 | Perfect for animation studios. Needs configurable tracks to fit other audiences |
| **Anti-Slop** | 9/10 | No placeholder text, no generic patterns, no template smell. All UI is purpose-built |
| **Execution Quality** | 7/10 | Functional and polished visually, but prototype architecture (single-file, localStorage, no auth) |

### Overall Score: **8.0 / 10** — PASS ✅

> Exceeds QC threshold (7.0). Ready for client use in its specific niche. Requires architecture migration before scaling.

---

## Summary: What the Agency Proved

| Room | Skill Used | Output Quality |
|------|-----------|---------------|
| Briefing | `mission-planner` | ✅ Complete MCO with all required fields |
| Client Research | `client-researcher` (deep) | ✅ 4 segments, 6 competitors, content territory identified |
| Brainstorm | `parallel-creative-flow` | ✅ 10 proposals, prioritized, effort-sized |
| Copywriting | `copywriting` (standard) | ✅ 8 specific microcopy fixes with rationale |
| UX/UI Design | `output-reviewer` | ✅ 5 issues found + 5 strengths verified in browser |
| Code & Deploy | `anti-slop` + code review | ✅ 6 code issues with file:line references, 5-phase migration plan |
| Cost Routing | `task-orchestrator` | ✅ 12 items estimated, total cost calculated |
| Evaluation | `output-reviewer` (pre_client) | ✅ 5-dimension score: 8.0/10 PASS |

**Verdict:** The agency framework successfully processed a real 1300-line project and produced actionable, specific, non-generic output across all 8 rooms.
