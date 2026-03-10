# Workflow Storyboard Tool — Full Idea Roadmap

Merged and expanded from human-ideas.md + ai-ideas.md.
Each idea described with purpose, mechanics, and integration notes.

---

## FOUNDATION LAYER
*Core architecture that everything else depends on*

---

### F1. Web Service + Authentication
**Source:** human idea 4

The jump from local file to real product. Currently the tool runs on localhost with a node SSE server — functional for one room, useless for remote teams or returning to work next day.

**What it includes:**
- Google OAuth for corporate sign-in (no separate account system to maintain)
- Named rooms per project — URL-shareable, persistent
- Tasks and progress stored in cloud, not localStorage
- Session recovery — close the tab, reopen, everything is where you left it
- Multiple projects per account, organized by workspace or client

**Why it matters:** every other feature on this list becomes permanent instead of disposable. Without this, work is lost on refresh.

---

### F2. Configurable Tracks (Layers)
**Source:** ai-ideas

Right now the four tracks — body, faceplate, face_anim, external — are hardcoded for the Superbox mascot. The same rendering logic works for any parallel workstream structure.

**What it includes:**
- On project creation, define your own track names, colors, and count
- Presets for common domains (animation studio, software team, content agency, event, etc.)
- Each track gets its own color system, visible across all views
- Track count is flexible — 2 tracks for simple projects, 6+ for complex ones

**Examples:**
```
Animation studio:  SHOOT · EDIT · VFX · AUDIO · COLOR
Software team:     BACKEND · FRONTEND · QA · DEVOPS
Content agency:    BRIEF · COPY · DESIGN · PUBLISH
Event planning:    VENUE · CATERING · AV · MARKETING
```

---

### F3. Autosave + Version History
**Source:** human idea 16

JSON is lightweight. There's no reason to lose work.

**What it includes:**
- Autosave after every action — no manual save required during work
- Manual milestone saves with custom labels ("end of day 1", "client review ready")
- Auto-named version files stored locally and/or cloud, timestamped
- Version diff view — see what changed between two saves without loading either
- Crash recovery — on open, if unsaved state exists, offer to restore it
- Export any version as a `.json` project file for backup or handoff

**Why it matters:** crunch sessions, power cuts, browser crashes. The project should never be losable.

---

### F4. Roles + Permissions
**Source:** human idea 17

Teams aren't flat. Different people need different views and different rights.

**Roles:**
- **Admin** — full access, all views, project settings, billing
- **PM** — sees all tracks and all players, can link tasks and reassign, cannot edit project structure
- **Worker** — sees their assigned tracks, can claim and complete tasks, can attach files
- **Viewer** — read-only, useful for clients checking progress without touching anything

**What it includes:**
- Role assigned per person per project (not global)
- Track-level visibility rules — SMM sees copy/design tracks, not dev track
- Invite by link or email with role preset
- PM dashboard view: all players, all tracks, all progress in one surface

---

## COLLABORATION LAYER
*How people work together in real time*

---

### C1. Named Players + Task Claiming
**Source:** human ideas 6, 7 + ai-ideas

Current system has P1 and P2. That's enough for two people in one room, useless for any real team.

**Named players:**
- Each user has a name, avatar color and glyph, and role
- Their completions are attributed to them with timestamp
- Step cards show initials of who completed them

**Task claiming (the key mechanic):**
- Any player can "claim" a step before starting it
- Claimed step shows that player's color + name — visible to everyone in real time
- Unclaimed steps are available, claimed ones are locked for others
- If a player abandons a claim (goes offline, reassigns), PM can release it
- Prevents two people starting the same work simultaneously — the core multiplayer pain point

**Activity feed:**
- Live sidebar: "Alex claimed EDIT step 3", "Maria completed AUDIO step 1"
- Presence indicators — see who's online, what scenario they're looking at

---

### C2. Local Multiplayer (BLE / WiFi Direct)
**Source:** human idea 15

For teams in the same room: no logins, no IP addresses, no cloud required. The file itself is the access control — only people who have it can join.

**What it includes:**
- One player opens the project and starts a local session
- Other players on the same network see it auto-discovered (mDNS/Bonjour)
- Join with one tap — no address entry, no credentials
- BLE discovery as fallback for direct device-to-device without WiFi
- Session state synced locally, saved to JSON on close
- Scales to "two animators at adjacent desks" without any infrastructure

**Why it matters:** small studios, crunch sessions, client on-site reviews. Zero friction to start collaborating.

---

### C3. Big Progress Counter
**Source:** human idea 5

Psychological design. When you can see progress, you finish things faster.

**What it includes:**
- Full-width counter at top of screen: `047%` — large, monospaced, high contrast
- Global project progress (all players, all steps)
- Personal progress counter below it — your own completion rate
- Both update in real time as steps are claimed and completed
- Color shifts as percentage climbs (cold → warm → bright at 100%)
- Optional: celebration state at 100% — the tool acknowledges the finish

**Why it matters:** seeing 73% when you were at 71% two minutes ago keeps momentum alive. Abstract task lists don't do this.

---

### C4. Player Compare Mode
**Source:** human idea 8

Transparency between team members. Useful for retrospectives, for PMs reporting up, and for healthy competition.

**What it includes:**
- Side-by-side view of any two players' contribution
- Metrics: steps completed, steps claimed, time spent (if timers used), track breakdown
- Percent completion per player
- Timeline of activity — when did each person work
- Exportable as part of the project report (idea R1)

**Not a leaderboard** — framed as "team breakdown" not ranking. Context matters (a backend dev and a designer aren't comparable by raw step count).

---

## WORKFLOW LAYER
*How the work itself is structured and executed*

---

### W1. Glyph Pack System
**Source:** ai-ideas + human idea 3

Right now glyphs are hardcoded fintech mascot states. Universally a glyph is just `{ id, label, icon, description }` — a symbol in a shared team vocabulary.

**What it includes:**
- Glyphs defined per project or workspace as a "pack"
- Import/export glyph packs as JSON
- Community glyph pack marketplace — download packs for your domain (motion design, software, marketing, etc.)
- Custom glyph builder: pick an emoji or draw a simple SVG icon, write a description, assign to a track
- Glyphs visible in glyph library view and in scenario strips simultaneously
- Glyph usage stats — which ones appear most across scenarios

---

### W2. Scenario Template Library
**Source:** human idea 3 + ai-ideas

Scenarios are the core reusable unit of work. They should be shareable.

**What it includes:**
- Save any completed scenario as a template
- Templates tagged by domain, industry, complexity
- Community template marketplace — import a "Social Media Campaign" or "Bug Fix Cycle" scenario pack instantly
- Project-level scenario library: all templates used in past projects available to reuse
- Export scenario library as JSON to hand off to a new team member or client

---

### W3. Step Dependencies
**Source:** ai-ideas

Some steps can't start until others are done. Right now the tool has no awareness of this.

**What it includes:**
- Mark any step as dependent on one or more other steps
- Dependent steps shown as locked/greyed until prerequisites complete
- Dependency lines visible in strip view as arrows between steps
- On completion of a prerequisite, dependent steps unlock and notify assigned players
- Circular dependency detection and warning

**Example:** "AUDIO step 2 (mix) cannot start until EDIT step 4 (picture lock) is complete."

---

### W4. Blockers + Comments
**Source:** ai-ideas

Steps get stuck. There needs to be a way to flag that without leaving the tool.

**What it includes:**
- Mark any step as "blocked" with a required reason
- Blocker visible on the strip as a red indicator
- PM notified immediately
- Comments thread per step — not a full chat, just context for that specific step
- Blocker resolved by PM or the blocking player
- Blockers logged in project history and appear in the final report

---

## FILE LAYER
*Assets attached directly to the workflow*

---

### FL1. File Attachments on Glyphs
**Source:** human idea 10

The biggest workflow improvement. Files live on the glyph they belong to, not in a chat or a drive folder with a vague name.

**What it includes:**
- Any player can attach a file to any step or glyph
- File icon appears on the glyph card wherever it's displayed — in scenarios, in library, in reports
- Click to download or preview inline (image, audio, PDF, SVG, Lottie/JSON)
- Files visible in both glyph library view and scenario strip view
- File server stores attachments linked by step ID + glyph ID + project ID
- No more "where's the file?" — it's on the step it belongs to

**Supported types with inline preview:**
- Images (PNG, JPG, WebP) — thumbnail in card
- SVG — rendered inline
- Lottie JSON — played as animation in a preview panel
- Audio — waveform + playback
- PDF — first page preview
- Any other file — download link with type icon

---

### FL2. Artboard Canvas (File Exchange Surface)
**Source:** human idea 1

A visual canvas for file collection and project communication. Not trying to replace FigJam or Miro — this is a file-first surface that understands what it's showing.

**What it includes:**
- Drag files onto the canvas — they auto-render based on type
- Audio files: display waveform, playback controls. Multiple audio assets can be merged into a single demo file (one export, ordered by drag position)
- SVG / Lottie: rendered live with animation viewer + JSON access
- Image files: displayed as thumbnails with full view on click
- Canvas export: select a region and export as PNG or PDF — useful for sending client a visual overview of all project assets
- Tag and flag system on assets — "needs review", "approved", "source file", etc.
- Group assets by scenario, by track, or free-form

**Note:** this is a large feature. Build after the core workflow layer is stable.

---

## INTELLIGENCE LAYER
*The tool understanding and optimizing the work*

---

### I1. Integrated Timer + Session Tracking
**Source:** human idea 14 (Pomodoro) + human idea 13 (clock)

The value isn't the timer — it's that the timer lives where your eyes are, and every second it tracks gets attached to real workflow data.

**What it includes:**
- Global clock in top-right corner, always visible
- Session timer per player — start/pause/stop, attached to the current step being worked
- Pomodoro mode: fixed work intervals (25min default, configurable), short and long breaks with alerts
- "Time attack" mode: team-wide session with shared countdown for crunch sprints
- All time data stored per step per player — not just "total time on project" but "time spent on EDIT step 3"
- Time data feeds into analytics (idea I2) and project report (idea R1)

**Why it matters:** no switching to a phone or separate app. No Instagram. The timer is here, the work is here, the data stays connected.

---

### I2. Element Analysis + Critical Path Optimizer
**Source:** human idea 11 (first)

The tool knows the scenario structure, the glyph frequency, and the dependencies. It can reason about the optimal order of operations.

**What it includes:**
- Analysis of all scenarios: which glyphs/steps appear most frequently
- Identifies blocking elements — steps that unlock the most downstream work
- Generates a recommended work order: "complete these 4 elements first and you unblock 11 of 17 scenarios"
- Highlights bottlenecks — steps that are most time-consuming historically (uses timer data)
- Dependency graph visualization — see the project as a network, not just strips
- Re-runs analysis as work progresses and updates recommendations

**The key insight from the human:** "if the designer concentrates on happy face, sad face, and hands — you can already build beginnings and endings of almost every scene." The optimizer finds those high-leverage elements automatically.

---

### I3. AI Project Intake
**Source:** human idea 11 (second)

The most ambitious feature. Recreating the experience of throwing raw project information at an LLM and getting back a fully structured workflow system.

**What it includes:**
- Input: paste raw text (brief, spec, email thread, task dump), or upload files (PDF, DOCX, images)
- AI reads the content, extracts tasks, infers dependencies, suggests glyphs, assigns steps to tracks
- Output: a populated scenario library ready to start working from
- AI can also link files to tasks by context — if a file is mentioned in a brief alongside a task, it gets attached
- If team members are named in the document, AI can suggest assigning tasks to those roles
- Works via Claude API (or user's preferred LLM provider) — configurable, not locked in
- User reviews and edits the generated structure before committing — AI proposes, human approves

**The pitch:** "Give us your project chaos. We'll give you back a workflow."

---

### I4. Smart Context Tools
**Source:** human idea 12

Reducing friction when bringing information into the tool.

**What it includes:**
- Smart paste: detect what was copied (URL, file path, text block, JSON) and handle appropriately
- Context-aware fill: paste a Lottie JSON → auto-creates a glyph with animation preview
- Paste a list of tasks → prompt to convert to a scenario strip
- Drag a file anywhere → attaches to the currently focused step
- Paste a color hex → adds to project palette

---

## REPORTING LAYER
*Output that communicates progress to people outside the team*

---

### R1. Generated Project Completion Report
**Source:** human idea 9

A single self-contained HTML file that tells the story of how the project was executed. Sent to a client or boss as a deliverable, not just a status update.

**What it includes:**
- Auto-generated on project completion (or on demand at any point)
- Single HTML file — no login, no app, just open in browser
- Mobile and desktop responsive
- **Contents:**
  - Project overview: name, duration, team, scenario count
  - Timeline: when each scenario was started and completed
  - Player stats: steps completed, time spent, track breakdown per person
  - Scenario completion breakdown: each scenario with its steps and who did what
  - Bottleneck analysis: which steps took longest, which were blocked and why
  - File delivery: all attached assets listed and linked
  - Graphs + diagrams: completion velocity over time, track workload distribution
- Clean, professional design — something you're not embarrassed to send
Add reprt building optionsto show only what's needed.
---

## DESIGN + THEMING LAYER

---

### D1. Theme System
**Source:** human idea 2

Colors and typography as first-class project settings.

**What it includes:**
- Project color palette — import brand colors (hex, CSS vars, or from a Figma export)
- Typography presets — monospace terminal style (current default), clean sans-serif, custom
- Community theme library — download and apply themes others have shared
- Export/import themes as JSON
- Per-project theme — each client project can have its own visual identity
- Theme affects scenario strip colors, progress counters, glyph cards — the whole surface

---

## SUMMARY: RECOMMENDED BUILD ORDER

| Phase | Features | Goal |
|---|---|---|
| 1 | F3 (autosave), C3 (progress counter) | Survive beyond one session |
| 2 | C1 (named players + claiming), FL1 (file attachments), W1 (glyph packs) | Real team collaboration |
| 3 | I1 (timer + clock), F4 (roles), W3 (dependencies), W4 (blockers) | Serious workflow tool |
| 4 | I3 (AI intake), R1 (report), I2 (critical path) | Differentiation + client value |
| 5 | F2 (configurable tracks), C2 (local BLE), FL2 (artboard canvas), D1 (themes) | Polish + power users |
6. F1 (web + auth)
