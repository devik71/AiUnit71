# TechPlus Round 3 — Integration Analysis

**Репозиторії:** shadcn/ui · impeccable (pbakaus) · GoogleCloudPlatform/generative-ai
**Контекст:** AiUnit71 v0.4.0 — pipeline engine + 14 skills + fight club framework

---

## Швидкий вердикт

| Репо | Релевантність | Пріоритет інтеграції |
|------|--------------|---------------------|
| **impeccable** | Висока — перетин по anti-slop, skill format, multi-provider distribution | **Інтегрувати зараз** |
| **GoogleCloudPlatform/generative-ai** | Середня — memory architecture, A2A protocol, MCP patterns | Архітектурний референс |
| **shadcn/ui** | Низька для pipeline, Висока для UI deliverables | Пізніше / за потребою |

---

## 1. Impeccable (`pbakaus/impeccable`)

### Що це

Cross-provider design skills і commands для LLM інструментів. Підтримує Claude Code, Cursor, Gemini CLI, Codex CLI. 17 skills навколо frontend design quality. Build system, що перетворює один source → provider-specific formats.

**Технічний стек:** Bun, Vanilla JS, Playwright (screenshots), Motion library, Vercel Functions для API.

### Структура яка нас цікавить

```
source/skills/
├── frontend-design/     # Master skill — design direction, anti-slop, typography, color
│   ├── SKILL.md
│   └── reference/
│       ├── typography.md
│       ├── motion-design.md
│       ├── spatial-design.md
│       └── ux-writing.md
├── audit/              # Comprehensive interface audit (a11y, performance, theming)
├── normalize/          # Design system alignment
├── optimize/           # Performance
├── harden/             # Edge cases + resilience
├── polish/             # Final quality pass
├── critique/           # Honest feedback on design
└── ...14 more skills
```

### Де перетинається з AiUnit71

#### 1.1 Anti-Slop philosophy — прямий перетин з AIU-008

Impeccable `frontend-design` skill має розгорнутий список UI anti-patterns, що є точним UI-еквівалентом того, що AIU-008 робить для copy:

| AiUnit71 Anti-Slop (copy) | Impeccable Anti-Patterns (UI) |
|--------------------------|-------------------------------|
| Slop openers (kill first sentence) | Generic hero layouts (icon + heading + text × 3) |
| Vague corporate language (leverage, seamless) | AI color palette (cyan-on-dark, purple-to-blue gradients) |
| Round list counts (exactly 3 or 5) | Glassmorphism everywhere |
| Equal-length paragraphs | Nested cards inside cards |
| Over-hedging phrases | Gradient text on metrics/headings |
| Em dashes, adverb excess | Hero metric layout template (big number, small label) |

**Що це означає для AIU-008:** Зараз Anti-Slop охоплює visual AI artifacts і copy patterns, але не має категорії "UI layout tells". Якщо AiUnit71 коли-небудь оцінюватиме UI deliverables (landing pages, dashboards), `frontend-design/SKILL.md` — готовий reference для розширення.

#### 1.2 Skill format — ідентична архітектура

Impeccable використовує той самий формат що і AiUnit71 skills — YAML frontmatter + markdown body:

```yaml
---
name: audit
description: Perform comprehensive audit...
args:
  - name: area
    required: false
user-invokable: true
---
```

AiUnit71 має `type`, `color`, `version`, `depends_on`, `blocks`, `rooms` — Impeccable має `args`, `user-invokable`. Формати сумісні, не ідентичні.

**Що це означає:** Скілли Impeccable можна взяти "as-is" і помістити в `skills/` AiUnit71 з мінімальними змінами. Вони вже в правильній формі.

#### 1.3 Multi-provider build system — критична відсутність в AiUnit71

Impeccable вирішує проблему яку AiUnit71 ще не вирішила:

```
source/ (один source of truth)
  → dist/claude-code/.claude/skills/
  → dist/cursor/.cursor/skills/
  → dist/gemini/GEMINI.md + .gemini/commands/
  → dist/codex/.codex/skills/
```

AiUnit71 зараз publish тільки для Claude Code (`skills/aiunit71/`). Якщо з'явиться потреба в Cursor або Gemini CLI — цей build system є точним рішенням. Трансформери написані на Bun, їх можна адаптувати під AiUnit71's skill schema.

#### 1.4 `audit` skill — готовий компаньйон до AIU-009

`audit` в Impeccable робить для UI те, що AIU-009 робить для creative content:
- 5 dimensions (a11y, performance, theming, responsive, anti-patterns)
- Severity tiers (Critical / High / Medium / Low)
- Maps to remediation commands (`/normalize`, `/optimize`, `/harden`)
- "Don't fix issues — document them"

Структурно збігається з AIU-009. Якщо pipeline буде розширено на UI deliverables, `audit` + `normalize` + `polish` утворюють ready-made EvaluationRoom для frontend.

### Рекомендовані дії — Impeccable

| Дія | Де | Зусилля |
|-----|----|---------|
| Скопіювати `frontend-design/SKILL.md` + reference files в `skills/` | `skills/visual-prompt-engineering/reference/` або окремий skill | 1 год |
| Додати UI anti-pattern list з `frontend-design` в AIU-008 resources | `skills/anti-slop/resources/ui-patterns.md` | 30 хв |
| Вивчити `scripts/transformers/claude-code.js` для multi-provider distribution | `scripts/` | Архітектурний референс |
| Розглянути `audit` + `normalize` як окремі skills для UI pipeline | `skills/ui-audit/` | Майбутній фазис |

---

## 2. GoogleCloudPlatform/generative-ai

### Що це

Величезна колекція (notebooks, tutorials, production patterns) для Google Cloud AI — Gemini, Vertex AI, ADK. Не deployable система, а референсна бібліотека. Ключові для нас директорії:

```
agents/
├── adk/                          # Agent Development Kit
├── agent_engine/
│   ├── memory_bank/              # Vertex AI Memory Bank
│   └── tutorial_mcp_on_agent_engine.ipynb
├── always-on-memory-agent/       # Persistent memory без vector DB
└── research-multi-agents/        # Multi-agent research pattern
gemini/agents/
└── research-multi-agents/        # Research coordination
sdk/                              # GenAI SDK examples
```

### Де перетинається з AiUnit71

#### 2.1 Always-On Memory Agent — архітектурний referenens для SONA

Always-On Memory Agent вирішує проблему яку AiUnit71 SONA (AIU-010) ще не вирішила повністю:

> "Current approaches fall short: Vector DB+RAG is passive. Conversation summary loses detail. Knowledge graphs are expensive."

Їх рішення: LLM-native memory без vector DB — читає, думає, пише structured memory. Три агенти:
- **IngestAgent** — приймає будь-який file (text, image, audio, PDF)
- **ConsolidationAgent** — активно з'єднує і стискає пам'ять (аналог сну)
- **QueryAgent** — відповідає на запити з контекстом

**Що це означає для SONA (AIU-010):** SONA зараз зберігає patterns та exemplars для skill routing. Memory Bank від Google показує наступний рівень: активна консолідація між сесіями. Якщо SONA еволюціонує — цей pattern є готовим архітектурним референсом. `sona-store.ts` (в кодовій базі) вже є — gap в active consolidation logic.

#### 2.2 A2A Protocol — стандарт для MCO injection

`agents/` містить tutorial по A2A (Agent-to-Agent protocol). AiUnit71 зараз передає контекст через Mission Context Object (MCO) injection — ручне обновлення YAML полів між агентами.

A2A — це стандарт Google для structured inter-agent communication: typed messages, protocol buffers, service discovery. Це те, чого не вистачає AiUnit71 pipeline для масштабування: наразі координація між rooms неформальна (MCO поля оновлюються ad hoc, без enforcement).

**Практична цінність зараз:** Середня. A2A орієнтований на production cloud deployment з Vertex AI. Для локального AiUnit71 pipeline надлишково. Але якщо з'явиться client deployment на Cloud Run або GKE — це готовий протокол.

#### 2.3 MCP on Agent Engine — закриває gap з Fight Club

У всіх Fight Club fights AIU agents програвали по Pipeline Integration через відсутність MCP tool calls. `tutorial_mcp_on_agent_engine.ipynb` показує як підключити MCP tools до агентів на Vertex AI Agent Engine.

**Але більш важливо:** цей tutorial підтверджує що MCP is the right direction, а не опціональне. MCP стає де-факто стандартом для tool integration в agent systems (shadcn/ui теж має MCP command). Закриття MCP gap в AIU agents — не nice-to-have, а необхідність для production readiness.

#### 2.4 Research Multi-Agents — патерн для AIU-002

`research-multi-agents` показує multi-agent research coordination через Gemini: спеціалізовані sub-agents (ev_agent тощо) під orchestrator. Конкретна структура: EV (Electric Vehicle) Research Agent як domain specialist під Research Orchestrator.

Це підтверджує архітектурне рішення AIU-002 (Client Researcher) — один research agent з modes (light/deep/competitive_focus) vs. multiple specialized agents. Google обрали multiple specialists. AiUnit71 обрала single agent з modes. **Обидва підходи valid** — різні tradeoffs (coordination overhead vs. context switching).

### Рекомендовані дії — Google GenAI

| Дія | Де | Зусилля |
|-----|----|---------|
| Вивчити `always-on-memory-agent/` architecture для SONA v2 | `src/memory/sona-store.ts` roadmap | Архітектурний референс |
| Взяти MCP integration patterns з `tutorial_mcp_on_agent_engine` | Закриття MCP gap в AIU agents | Середній |
| A2A protocol як майбутній міграційний path якщо AiUnit71 → Cloud | Документувати в architecture notes | Пізніше |

---

## 3. shadcn/ui

### Що це

Найбільша колекція React/Next.js компонентів. CLI tool (`shadcn`) для додавання компонентів до проекту. TypeScript, pnpm workspace, turbo monorepo. **MCP інтеграція** — `shadcn mcp` команда, що реєструє MCP server для Claude Code і Cursor.

### Де перетинається з AiUnit71

#### 3.1 MCP server — готова референсна реалізація

shadcn має working MCP server (`packages/shadcn/src/mcp/`) зареєстрований для Claude Code:

```json
{
  "mcpServers": {
    "shadcn": {
      "command": "npx",
      "args": ["shadcn@latest", "mcp"]
    }
  }
}
```

Це перша working MCP server implementation яку ми бачимо в round 3. Якщо AiUnit71 потребуватиме власного MCP server для skills discovery або MCO management — це готовий паттерн.

#### 3.2 Registry system — skills distribution model

shadcn `registry` система підтримує: versioned component registry, CLI install (`shadcn add [component]`), search, metadata, dependency resolution. AiUnit71 зараз не має формального skills registry — кожен skill додається вручну. shadcn's registry architecture — готова blue для `skills` distribution якщо AiUnit71 стане multi-tenant або публічною.

#### 3.3 UI компоненти — релевантно якщо з'являться UI deliverables

shadcn/ui прямо не інтегрується в поточний AiUnit71 pipeline (copy + visual prompts). Але якщо AiUnit71 додасть landing page або dashboard generation — shadcn є стандартним вибором для React UI. AIU-007 (Visual Prompt Engineering) генерує prompts для Midjourney/Flux; shadcn генерує ready-to-use React code. Це різні deliverable types.

### Рекомендовані дії — shadcn/ui

| Дія | Де | Зусилля |
|-----|----|---------|
| Вивчити MCP server implementation як референс | `packages/shadcn/src/mcp/` | Референс для MCP gap |
| Registry architecture як model для AiUnit71 skills distribution | Docs / roadmap | Архітектурний референс |
| Фактична інтеграція компонентів — відкласти | — | Не зараз |

---

## Зведена матриця інтеграції

```
                    Impeccable    Google GenAI    shadcn/ui
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Anti-slop (AIU-008)    HIGH             —               —
Output review (AIU-009) MEDIUM          —               —
SONA memory (AIU-010)   —             HIGH              —
Pipeline MCP gap        —             HIGH            MEDIUM
Skills distribution    HIGH             —             MEDIUM
UI deliverables        HIGH             —             HIGH
Multi-provider deploy  HIGH            LOW              —
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Пріоритетні дії (ordered)

### Зараз (Round 3 deliverables)

1. **Імпортувати `frontend-design` reference files з Impeccable → AIU-007 або AIU-008**
   Додати `reference/typography.md`, `spatial-design.md`, `motion-design.md` як внутрішні references для visual prompt engineering. UI anti-pattern DON'T list → `skills/anti-slop/resources/ui-patterns.md`.

2. **Задокументувати MCP gap як P0 issue**
   Fight Club показав: AIU agents програють по Pipeline Integration кожен раз. Google GenAI + shadcn підтверджують: MCP is the standard. Додати `mcp_integration` як required field в skills schema. Першочергові кандидати: AIU-002 (Client Researcher), AIU-005 (Copywriting).

### Наступний цикл

3. **Вивчити `always-on-memory-agent` для SONA v2 consolidation logic**
   `sona-store.ts` вже існує. Наступний рівень — active pattern consolidation між сесіями. Google показали working architecture без vector DB.

4. **Скопіювати `audit` + `normalize` + `polish` skills з Impeccable**
   Якщо AiUnit71 розширює на UI deliverables — ці три skills утворюють ready-made EvaluationRoom для frontend. Format compatible з AiUnit71.

5. **Вивчити Impeccable build system для multi-provider distribution**
   `scripts/transformers/claude-code.js` — точна логіка що потрібна якщо AiUnit71 skills потрібно publish для Cursor або Gemini CLI.
