# AiUnit71

**Віртуальна AI-Студія Генерації Контенту** — операційна система для креативного виробництва, де AI-агенти працюють як справжня студія.

> Architecture Specification v1.0 · Implementation v0.3.0 · 156 tests passing

---

## Концепція

AiUnit71 — це не просто набір AI-викликів. Це **повноцінна студійна інфраструктура**, де:

- Людина виступає CEO і контролює кожен етап
- Агенти мають ролі, personality та спеціалізацію
- Кожна місія проходить через структурований pipeline
- Система навчається і дешевшає з кожним проєктом

**Мета:** делегувати реальні креативні проєкти AI-команді з better-than-human результатами.

---

## Архітектура

```
HUMAN LAYER        →  Slack / Dashboard / Portfolio
TRANSLATION LAYER  →  Human feedback ↔ JSON mutations
MISSION CONTEXT    →  Єдине джерело правди (бренд, технічні вимоги, бюджет)
HOOK SYSTEM        →  Pre/post валідація на кожному кроці
ORCHESTRATOR       →  DAG задач, паралельне виконання, lifecycle
AGENT POOL         →  Micro / Standard (Ollama) / Power (API)
TOOL REGISTRY      →  fal.ai, ComfyUI, Luma, Midjourney + fallback chains
MEMORY + ECONOMICS →  Prompt Memory, Client Taste Profiles, ROI
```

---

## Модулі

### `src/core/` — Ядро

| Файл | Опис |
|------|------|
| `orchestrator.ts` | Головний оркестратор з 18 кімнатами, DAG задач |
| `types.ts` | Типи: Task, Agent, Room, Cost, Events |
| `event-bus.ts` | Шина подій між агентами |
| `logger.ts` | Структурований логер |

### `src/pipeline/` — Пайплайн виконання

7-фазний production pipeline:

| Фаза | Кімната | Опис |
|------|---------|------|
| 0 | NicheAdapter | Визначення ніші клієнта |
| 1 | Briefing | Структурований бриф |
| 2 | Brainstorm | Генерація концепцій |
| 2.5 | Cost-Routing | Оцінка вартості |
| 3 | JobMaster | Розподіл задач по кімнатах |
| 4 | Execution | Паралельне виконання + Evaluation |
| 5 | ReportMaster | QC звіт |
| 6 | Finalizer | Delivery package + Case Study |

### `src/creative/` — Креативний модуль _(новий)_

Реалізує секції 7–20 Architecture Specification:

| Файл | Специфікація | Опис |
|------|-------------|------|
| `mission-context.ts` | §7 | MissionContext Object — бренд, технічні вимоги, style constraints, бюджет |
| `hook-system.ts` | §8 | 5 хуків: context_enrichment, prompt_validation, visual_render_check, artifact_validation, budget_check |
| `tool-registry.ts` | §11 | 11 інструментів (fal.ai, ComfyUI, Midjourney, Luma, Topaz) + fallback chains для 8 типів задач |
| `anti-slop-engine.ts` | §16 | Prevention / Detection / Correction AI-артефактів. Score < 0.6 → QC fail |
| `dry-run.ts` | §20 | SIMULATION REPORT без реальних API-викликів |
| `prompt-memory.ts` | §14 | Бібліотека успішних промптів з пошуком за relevance та ROI-аналітикою |

### `src/agents/` — Агенти

| Агент | Tier | Роль |
|-------|------|------|
| `promptmaster.ts` | Power | Генерація semantic JSON промптів (ephemeral, per-task) |
| `prompt-critic.ts` | Standard | Валідація промптів, confidence < 0.8 → рефайн |
| `visual-prompter.ts` | Standard | Semantic JSON → diffusion / reasoning / midjourney формат |
| `skillmaster.ts` | Standard | Підбір skill packs для агентів |

### `src/rooms/` — 18 кімнат

Briefing · Brainstorm · Copywriting · Image-Gen · JobMaster · UX-UI · Animation · Video · 3D · Music-Audio · Code-Deploy · Cost-Routing · Evaluation · Finalizer · HITL · Learning · Recruiter · ReportMaster

### `src/cost/` — Економіка

- `router.ts` — Smart routing: Ollama (безплатно) → OpenRouter → Premium API
- `pricing-table.ts` — Таблиця цін по моделях

### `src/memory/` — Пам'ять

- `memory-store.ts` — In-memory store для agent experience, рішень, помилок

---

## Creative Pipeline

```
Brief  →  PromptMaster  →  PromptCritic  →  VisualPrompter
                               ↓ confidence < 0.8: рефайн
                          ────────────────────────────────
                          Anti-Slop inject → Draft ($0.04)
                          Human checkpoint
                          Final generation ($0.15 × 3 variants)
                          Human selection
                          Late expensive ops (upscale, video)
                          Artifact validation hook
                          Prompt Memory ← зберігаємо успішний
```

### Dual-Model Prompting

PromptMaster генерує model-agnostic **Semantic JSON** → VisualPrompter конвертує під цільову модель:

```
Semantic JSON → [diffusion]   Flux/SDXL: keyword-weighted, ≤75 tokens
              → [reasoning]  Nano Banana: natural language JSON
              → [midjourney] natural language + --ar --s --v flags
```

---

## Dry Run Mode

```bash
# Симуляція без реальних API-викликів
const report = new DryRunSimulator().simulate("FitPulse Landing", missionCtx);
console.log(report.formatted());
```

```
SIMULATION REPORT
──────────────────────────────────────────────────
Project: FitPulse Landing
Agents to spawn: 9
  └─ CEO, TeamLead, HR, Brainstormer, PromptMaster, PromptCritic, VisualPrompter, Graphic Designer, QC Agent
Estimated generations: 12 images
Estimated cost: $4.80
Estimated time: 45 min (with parallel execution)
Budget utilization: 72% of allocated $6.50
Critical path: Briefing → Brainstorm → Draft: Hero Image → Final: Hero Image → Quality Control
Recommendations:
  • Defer video generation ($1.00) to off-peak — only after image approval
  • 8 tasks can run in parallel — enables significant time savings
```

---

## Tool Registry

| Інструмент | Тип | Вартість | Сильні сторони |
|-----------|-----|----------|----------------|
| fal.ai/nano-banana-pro | API | $0.15/img | Text in image, complex scenes |
| fal.ai/nano-banana-2 | API | $0.039/img | Швидкий, дешевий |
| ComfyUI/flux-dev | Local | $0 | LoRA, ControlNet, повний контроль |
| ComfyUI/flux-dev-lora | Local | $0 | Custom style |
| Midjourney | API | $0.04/img | Artistic quality |
| Luma Dream Machine | API | $0.50/video | Text-to-video |
| Runway Gen-4 | API | $0.75/video | Cinematic |
| Topaz Gigapixel | Local | $0 | Upscale (фінальний крок) |

**Fallback chains** для кожного типу задачі: photorealistic_image, artistic_illustration, product_visualization, video_generation, image_upscale, text_render...

---

## Ієрархія агентів

### Постійні (кожна місія)

CEO · TeamLead · HR · Brainstormer · PromptMaster · VisualPrompter · PromptCritic · QC Agent · SkillMaster

### За викликом

Copywriter · Graphic Designer · Photographer · Videographer · Frontend Developer · Backend Architect · Coder · Tester · SMM Master · Ads Creator · WebScout · Researcher · Devil's Advocate · Case Study Agent · Translation Agent · Anti-Slop Engine

---

## Технологічний стек

```
Runtime:        Node.js 20+ / TypeScript 5
Orchestration:  Custom LangGraph-inspired DAG
LLM routing:    Ollama (local) → OpenRouter (cloud)
Local models:   Llama3.2, DeepSeek-Coder-V2, Qwen2.5-VL
Cloud LLMs:     Claude, GPT-4o, Gemini
Image APIs:     fal.ai (Nano Banana), ComfyUI, Midjourney
Video APIs:     Luma Dream Machine, Runway Gen-4
Upscale:        Topaz Gigapixel
Testing:        Vitest
```

---

## Встановлення

```bash
git clone https://github.com/devik71/AiUnit71.git
cd AiUnit71
npm install
```

### .env

```env
OPENROUTER_API_KEY=
NANOBANANA_API_KEY=
LUMALABS_API_KEY=
MIDJOURNEY_API_KEY=
RUNWAY_API_KEY=
KREA_API_KEY=
FREEPIC_API_KEY=
TOPAZ_API_KEY=
COMFYUI_API_KEY=
```

### Запуск тестів

```bash
npm test
# Test Files: 13 passed | Tests: 156 passed
```

---

## Roadmap

### ✅ Зроблено (v0.3.0)

- [x] Orchestrator з 18 кімнатами
- [x] 7-фазний PipelineExecutor
- [x] Smart cost routing (Ollama → OpenRouter)
- [x] Human-in-the-Loop (4 рівні автономності)
- [x] PromptMasterAgent (ephemeral, per-task)
- [x] SkillMaster + NicheAdapter
- [x] **MissionContext Object** (§7)
- [x] **Hook System** — 5 хуків (§8)
- [x] **VisualPrompter Agent** — Semantic JSON → model-native (§10)
- [x] **PromptCritic Agent** — валідація, confidence gating (§9)
- [x] **Tool Registry** + fallback chains (§11)
- [x] **Anti-Slop Engine** (§16)
- [x] **Dry Run Mode** (§20)
- [x] **Prompt Memory** з ROI-аналітикою (§14)
- [x] 156 тестів

### 🔜 Наступні кроки

- [ ] Slack інтеграція через n8n (§4, Week 4)
- [ ] Observability Dashboard (§23)
- [ ] Client Taste Profile (автобудування з feedback) (§14)
- [ ] Creative Version Control (§15)
- [ ] Automatic Case Study Generator (§19)
- [ ] Inter-Mission Knowledge Graph (§14)
- [ ] Creative Entropy Controller (§18)
- [ ] Plugin Architecture (§22)

---

## Принципи

- **Human-in-the-loop** — CEO бере участь на кожному етапі
- **Late expensive operations** — дорогі операції тільки після повного approve
- **Progressive quality** — draft → refine → final
- **Memory compounds** — кожна місія робить систему розумнішою
- **Graceful degradation** — fallback chains, partial delivery, self-healing

---

*v0.3.0 · Architecture Specification v1.0 · Author: Viktor + Claude · 2026*
