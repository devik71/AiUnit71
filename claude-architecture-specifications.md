# AiUnit71 — Architecture Specification v1.0

## Віртуальна AI-Студія Генерації Контенту

-----

## 1. Vision

AiUnit71 — операційна система для креативного виробництва. AI-агенти працюють як справжня студія — з ролями, процесами, брейнштормами та контролем якості. Людина виступає CEO і керує на кожному етапі.

Мета: делегувати реальні креативні проекти AI-команді з better-than-human результатами. Клієнт отримує повноцінну студійну послугу з прозорим процесом, а не “кнопочку натиснув”.

### Ключові принципи

- **Human-in-the-loop:** HumanCEO бере участь на кожному етапі — дає контекст, приймає рішення, затверджує результати
- **Separation of concerns:** кожен агент — вузький спеціаліст у своїй зоні відповідальності
- **Dual-layer communication:** JSON між агентами (машинний шар), Slack + dashboard для людей (людський шар)
- **Late expensive operations:** дорогі операції виконуються останніми, коли все затверджено
- **Progressive quality:** draft → refine → final, кожен крок дешевший за переробку
- **Memory compounds:** кожна місія робить систему розумнішою через accumulated knowledge

-----

## 2. System Architecture

```
┌──────────────────────────────────────────────────────┐
│                 HUMAN LAYER                           │
│  Slack (комунікація) + Dashboard (моніторинг)         │
│  Portfolio (клієнтський вихід) + Case Studies          │
└───────────────────────┬──────────────────────────────┘
                        │ events / webhooks
┌───────────────────────▼──────────────────────────────┐
│                 TRANSLATION LAYER                     │
│  Human-readable ←→ Machine-readable                   │
│  Client feedback parser                               │
│  Slack messages ←→ Task Graph mutations                │
└───────────────────────┬──────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────┐
│                 MISSION CONTEXT (core state)          │
│  DAG задач + артефактів + залежностей                 │
│  Brand constraints + technical specs                   │
│  Єдине джерело правди для всієї системи               │
└───────────────────────┬──────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────┐
│                 HOOK SYSTEM                           │
│  Pre/post hooks на кожному етапі                      │
│  Context enrichment + validation + auto-correction     │
└───────────────────────┬──────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────┐
│                 ORCHESTRATOR                          │
│  Dependency Graph (parallel execution)                │
│  Spawn / Route / Budget / Lifecycle                   │
│  Conflict Resolution Protocol                         │
└───────────────────────┬──────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────┐
│                 AGENT POOL                            │
│  Three complexity tiers:                              │
│  Micro (scripts) / Standard (Ollama) / Power (API)   │
│  Specialized agents з skill packs                     │
│  Dynamic spawn + annihilation lifecycle               │
└───────────────────────┬──────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────┐
│                 TOOL REGISTRY                         │
│  Creative tools (fal.ai, ComfyUI, Luma, Midjourney)  │
│  Fallback chains per task type                        │
│  Caching layer (semantic + component + prompt-result) │
└───────────────────────┬──────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────┐
│                 MEMORY + ECONOMICS                    │
│  Vector DB: ChromaDB/SpacetimeDB (agent experience)  │
│  Prompt Memory (successful prompts library)           │
│  Client Taste Profiles                                │
│  Inter-Mission Knowledge Graph                        │
│  Budget tracker + ROI analytics                       │
│  Automatic Case Study Generator                       │
└──────────────────────────────────────────────────────┘
```

-----

## 3. Technology Stack

### Orchestration (гібридний підхід)

- **LangGraph** — основний orchestrator, DAG задач, state management, conflict resolution
- **CrewAI** — визначення ролей та crews під конкретні місії, швидкий spawn
- **Google ADK context patterns** — context engineering, artifact handling, token economy
- **n8n** — Slack інтеграція та human-layer автоматизація

### Генеративні інструменти

- **fal.ai (Nano Banana 2/Pro)** — text-to-image, reasoning-based, $0.04-0.15/image
- **ComfyUI (Flux, SDXL + LoRA/ControlNet/IP-Adapter)** — складні локальні workflows
- **Lumalabs Dream Machine** — text/image-to-video
- **Midjourney** — artistic image generation
- **Topaz / Gigapixel** — upscale (late expensive operation)
- **Krea, Firefly, Freepik** — додаткові генеративні API

### Памʼять та дані

- **ChromaDB / SpacetimeDB** — векторна БД для agent experience та knowledge graph
- **Git-backed state** — persistent work tracking (pattern від Gastown)

### Комунікація

- **Slack** — пряма інтеграція для human layer та client communication
- **Structured JSON** — machine layer між агентами

### LLM Routing

- **Text/reasoning:** Claude, GPT-4o, Gemini (через API)
- **Local tasks:** Ollama (Llama, Mistral, Qwen) для дешевих операцій
- **Code:** Claude Code, Codex
- **Кожна задача → оптимальна модель за price/quality ratio**

### Референсні проекти (вхідний контекст)

- **MetaGPT** — SOP architecture, structured communication protocol
- **Gastown** — agent lifecycle, convoy/crew model, git-backed state
- **Agency-Agents** — agent personality templates, soul.md structure
- **Superset** — parallel execution, worktree isolation
- **Mission Control (Bhanu Teja)** — org structure, shared database communication

-----

## 4. Agent Hierarchy & Roles

### Постійні агенти (присутні в кожній місії)

|Agent              |Tier    |Роль                                                               |
|-------------------|--------|-------------------------------------------------------------------|
|**CEO**            |Power   |Обробка вхідних даних, стратегічні рішення, контекстуалізація місії|
|**TeamLead**       |Power   |Розподіл задач, контроль процесів, dependency management           |
|**HR**             |Standard|Spawn агентів з правильними skills, заповнення agent.md та soul.md |
|**Brainstormer**   |Power   |Модерація брейнштормів, збір та синтез opinions                    |
|**PromptMaster**   |Power   |Генерація semantic JSON промптів для візуального контенту          |
|**Visual Prompter**|Standard|Конвертація semantic JSON в model-native формат                    |
|**Prompt Critic**  |Standard|Валідація промптів перед генерацією                                |
|**QC Agent**       |Power   |Перевірка якості, порівняння з brand guidelines                    |
|**SkillMaster**    |Standard|Підбір та створення skill packs для агентів                        |

### Агенти за викликом (spawn по потребі)

|Agent                 |Tier    |Коли потрібен                               |
|----------------------|--------|--------------------------------------------|
|**Copywriter**        |Power   |Тексти, headlines, body copy                |
|**Graphic Designer**  |Power   |Візуальний контент, image generation        |
|**Photographer**      |Standard|Product photography промпти, стиль          |
|**Videographer**      |Power   |Video generation, анімація                  |
|**Frontend Developer**|Power   |Layout, responsive design, код              |
|**Backend Architect** |Power   |API, серверна архітектура                   |
|**Coder**             |Power   |Загальне програмування                      |
|**Tester**            |Standard|Тестування коду та інтерфейсів              |
|**SMM Master**        |Standard|Соціальні мережі, контент-план              |
|**Ads Creator**       |Standard|Рекламні креативи                           |
|**WebScout**          |Standard|Веб-дослідження, конкурентний аналіз        |
|**Researcher**        |Power   |Глибокий аналіз, data gathering             |
|**Devil’s Advocate**  |Power   |Знаходження слабких місць, stress-testing   |
|**Case Study Agent**  |Standard|Автоматична генерація portfolio case studies|
|**Translation Agent** |Standard|Парсинг client feedback в structured JSON   |
|**Anti-Slop Engine**  |Standard|Детекція та корекція “AI look”              |

### Agent Complexity Tiers

- **Micro-agent** — детерміністичні скрипти (конвертація, resize, compression). Вартість: 0
- **Standard agent** — локальна модель через Ollama. Вартість: електрика
- **Power agent** — Claude/GPT-4o/Gemini через API. Вартість: API tokens

-----

## 5. Agent Lifecycle

```
SPAWN
  HR отримує контекст від CEO
  → Визначає потрібних агентів та їх tier
  → Створює agent.md (роль, задачі, tools)
  → Створює soul.md (personality, communication style)
  → Завантажує skill pack від SkillMaster
  → Агент отримує scoped context (тільки те що йому потрібно)

ONBOARDING
  → Агент потрапляє в Onboarding Room
  → Отримує mission context (filtered по його ролі)
  → Отримує tool access (тільки потрібні tools)
  → Проходить briefing

EXECUTION
  → Працює в своїй кімнаті (isolated workspace)
  → Комунікує через task graph mutations (JSON)
  → Може викликати інших агентів на допомогу
  → Звітує прогрес через Slack
  → Hooks автоматично валідують на кожному кроці

COMPLETION
  → QC перевіряє результат
  → Human review та approval
  → Агент формує звіт
  → Записує досвід у vector DB (Prompt Memory, patterns)

ANNIHILATION
  → Після завершення задачі агент зникає
  → Його досвід залишається в памʼяті системи
  → Наступний spawn може отримати цей досвід
```

-----

## 6. Mission Flow — базовий алгоритм

### Фаза 1: Ініціалізація

```
1. HumanCEO видає вхідні дані, контекст та місію
2. CEO Agent обробляє вхідні дані:
   → Переформатовує контекст в compact JSON
   → Визначає тип місії, deliverables, budget
   → Формує Mission Context Object
3. CEO спавнить TeamLead та HR
4. HR відправляється в Onboarding Room, спавнить потрібних агентів
5. Команда збирається в Briefing Room
```

### Фаза 2: Планування

```
6. Brainstorm — послідовний процес:
   → CEO дає контекст
   → Кожен агент дає structured feedback зі своєї спеціалізації
   → Critic знаходить слабкі місця
   → Результат: задачі, інструменти, дедлайни, очікувані результати
   
7. TeamLead формує Dependency Graph:
   → Визначає паралельні та послідовні задачі
   → Розраховує critical path
   → Розподіляє budget по задачах
   
8. SkillMaster підбирає skill packs для агентів
```

### Фаза 3: Виконання

```
9. Агенти працюють по Dependency Graph:
   → Паралельні задачі виконуються одночасно
   → Hooks збагачують контекст на кожному кроці
   → Slack для комунікації з HumanCEO
   → Task graph мутується по мірі виконання

10. Creative content pipeline:
    → PromptMaster генерує semantic JSON
    → Prompt Critic валідує
    → Visual Prompter конвертує під цільову модель
    → Draft generation (cheap) → Human checkpoint
    → Final generation (quality) → Human checkpoint
    → Late expensive ops (upscale, video) → тільки після повного approve
```

### Фаза 4: Контроль якості

```
11. QC Agent перевіряє кожен deliverable:
    → Порівняння з Mission Context constraints
    → Brand compliance check
    → Anti-Slop Engine validation
    → Генерація QC report

12. Human review:
    → HumanCEO отримує результати через Slack/Dashboard
    → Approve / Request revision / Reject
    → Feedback парситься в structured JSON
    → Routing на відповідного агента для виправлення
```

### Фаза 5: Завершення

```
13. Delivery:
    → Фінальні артефакти в усіх потрібних форматах
    → Case Study Agent автоматично генерує portfolio entry
    → Всі промпти, рішення, метрики записуються в Memory

14. Post-mission:
    → Skill Evolution аналізує патерни
    → Client Taste Profile оновлюється
    → Knowledge Graph збагачується новими звʼязками
    → Агенти анігілюються, досвід залишається
```

-----

## 7. Mission Context Object

Живий документ який збагачується на кожному етапі місії:

```json
{
  "mission": {
    "id": "mission-fitpulse-landing-001",
    "type": "landing_page",
    "client": "FitPulse",
    "status": "in_progress",
    "created": "2025-03-06T10:00:00Z",
    "budget": {
      "total": 6.50,
      "spent": 0,
      "reserved": 0,
      "currency": "USD"
    },
    "deliverables": [
      { "id": "hero_image", "status": "pending", "priority": 1 },
      { "id": "feature_icons", "status": "pending", "priority": 2 },
      { "id": "og_image", "status": "pending", "priority": 3 }
    ]
  },

  "brand": {
    "name": "FitPulse",
    "colors": {
      "primary": "#6C3CE1",
      "secondary": "#00D4FF",
      "accent": "#FF6B35",
      "neutral": ["#1A1A2E", "#F5F5F7"]
    },
    "fonts": ["Inter", "Space Grotesk"],
    "mood": ["premium", "energetic", "modern"],
    "references": ["artifact://brand_guide.pdf"],
    "anti_patterns": ["corporate feel", "stock photo look"]
  },

  "technical": {
    "viewport": { "desktop": 1440, "mobile": 375 },
    "hero_container": {
      "width": 1440,
      "height": 680,
      "text_zone": "left 40%",
      "image_zone": "right 60%"
    },
    "required_formats": [
      { "name": "desktop_hero", "w": 1440, "h": 680, "aspect": "2.12:1" },
      { "name": "mobile_hero", "w": 375, "h": 500, "aspect": "3:4" },
      { "name": "og_image", "w": 1200, "h": 630, "aspect": "1.91:1" }
    ],
    "file_format": "webp",
    "max_file_size_kb": 200
  },

  "style_constraints": {
    "no_stock_feel": true,
    "no_text_in_image": true,
    "transparent_bg_needed": false,
    "safe_zone_for_text": "left 40%",
    "anti_slop": true
  },

  "client_taste_profile": {
    "color_temperature": "warm",
    "contrast": "high",
    "composition": "asymmetric",
    "lighting_preference": "dramatic > flat",
    "human_presence": "prefers without people in product shots"
  }
}
```

-----

## 8. Hook System

Hooks — автоматичні функції що спрацьовують перед або після дій агентів.

### Pre-Generation Hooks

```
HOOK: context_enrichment (before PromptMaster)
├── Pull brand.colors → inject в prompt context
├── Pull technical.required_formats → визначити aspect ratios
├── Pull style_constraints → додати в exclusion list
├── Pull hero_container.text_zone → визначити safe zone
├── Pull client_taste_profile → bias generation
└── Check: чи всі обовʼязкові поля заповнені?

HOOK: prompt_validation (before Visual Prompter)
├── Субʼєкт визначений конкретно?
├── Освітлення вказане явно?
├── Немає протиріч між елементами?
├── Aspect ratio відповідає technical specs?
├── Brand colors присутні?
├── Budget sufficient для запланованої генерації?
└── Block якщо validation failed → повернути на PromptMaster

HOOK: visual_render_check (before API call)
├── Token count ≤ 75 для diffusion моделей?
├── Ваги в безпечному діапазоні (0.5-1.6)?
├── Model-specific syntax correct?
├── Negative prompt present для diffusion?
└── Fallback chain configured?
```

### Post-Generation Hooks

```
HOOK: artifact_validation (after generation)
├── Output resolution correct?
├── Dominant colors ≈ brand palette?
├── No text detected (якщо style_constraints.no_text_in_image)?
├── Subject not in safe zone?
├── Anti-Slop check passed?
├── File size within limits?
└── Auto-retry якщо validation failed (max 3 attempts)

HOOK: mission_update (after any task completion)
├── Update Mission Context status
├── Update budget.spent
├── Log to observability dashboard
├── Notify HumanCEO якщо milestone reached
└── Check: чи розблоковані залежні задачі?
```

-----

## 9. Creative Generation Pipeline

### Prompt Flow Architecture

```
Designer Agent
  "Потрібен hero image для фітнес лендінга"
         │
         ▼
┌─ HOOK: context_enrichment ─────────────────┐
│  Auto-inject: brand, technical specs,       │
│  client taste, style constraints            │
└─────────────────────────────────────────────┘
         │
         ▼
PromptMaster (creative brain, Power tier)
  Генерує semantic JSON — ЩО має бути
  НЕ думає про синтаксис моделей
         │
         ▼
Prompt Critic (validation, Standard tier, ~$0)
  Перевіряє JSON на повноту та протиріччя
  confidence < 0.8? → назад на рефайн
         │
         ▼
Budget Check
  Вистачає бюджету? → дешевша модель або менше варіантів
         │
         ▼
Visual Prompter (technical translator, Standard tier)
  Знає синтаксис кожної моделі
  Конвертує semantic JSON → model-native format
  ├─→ Flux/SD: keyword-based, ≤75 tokens, (weights:1.3)
  ├─→ Nano Banana: JSON або structured natural language
  └─→ Midjourney: natural language + --ar --s --v flags
         │
         ▼
┌─ HOOK: visual_render_check ────────────────┐
│  Token count OK? Syntax correct? Budget OK? │
└─────────────────────────────────────────────┘
         │
         ▼
Draft Generation (cheap model, 1 variant, ~$0.04)
         │
         ▼
Vision Validation (auto-check, ~$0.01)
  fail? → auto-retry з іншим seed/prompt (max 3)
         │
         ▼
Human/QC Review
  rejected? → structured feedback → PromptMaster
         │
         ▼
Final Generation (full quality, 2-4 variants)
         │
         ▼
Human Selection (обирає найкращий)
         │
         ▼
Late Expensive Ops (upscale, video, animation)
  ТІЛЬКИ після повного затвердження
         │
         ▼
┌─ HOOK: artifact_validation ────────────────┐
│  Resolution? Colors? Anti-slop? File size?  │
└─────────────────────────────────────────────┘
         │
         ▼
Prompt Memory (зберігаємо successful prompt + metadata)
```

### Cost Hierarchy (дешево → дорого)

```
CHEAP (ітеруємо вільно)
├─ Text generation, промпти            ~$0.01-0.05
├─ Layout planning, wireframes         ~$0.02
├─ Draft image generation              ~$0.04
├─ Color palette extraction            ~$0
├─ Prompt validation                   ~$0
│
▼ HUMAN CHECKPOINT 1 ▼
│
MEDIUM (після затвердження напрямку)
├─ Final image generation              ~$0.15-0.45
├─ Image variations                    ~$0.15-0.30
├─ Background generation               ~$0.04-0.15
│
▼ HUMAN CHECKPOINT 2 ▼
│
EXPENSIVE (одноразово на фіналі)
├─ Upscale (Topaz/Gigapixel)           ~$0.10-0.50
├─ Video generation (Luma, Runway)     ~$0.50-2.00
├─ Animation rendering                 ~$0.50-3.00
├─ Final compositing + export          ~$0
```

-----

## 10. Dual-Model Prompting System

### Semantic JSON (internal format — model-agnostic)

```json
{
  "subject": {
    "type": "smartphone with fitness app UI",
    "material": "glass and metal, dark finish",
    "position": "floating, slight angle"
  },
  "environment": {
    "background": "abstract gradient, deep purple to electric blue",
    "elements": "subtle particle effects",
    "depth": "shallow, subject sharp, bg blurred"
  },
  "lighting": {
    "primary": "soft ambient glow from screen",
    "secondary": "rim light from behind, cool tone",
    "mood_contribution": "premium, tech-forward"
  },
  "composition": {
    "framing": "medium shot, front-facing",
    "angle": "slight low angle, hero perspective",
    "negative_space": "left 40% for text overlay",
    "aspect_ratio": "2.12:1"
  },
  "style": {
    "medium": "3D product visualization",
    "aesthetic": "clean, modern, premium",
    "color_palette": ["#6C3CE1", "#00D4FF", "#1A1A2E"],
    "anti_slop": ["no oversaturation", "subtle grain", "natural reflections"]
  },
  "constraints": {
    "no_text_in_image": true,
    "brand_colors_required": true,
    "safe_zone": "left 40%"
  }
}
```

### Render: Diffusion Models (Flux/SDXL via ComfyUI)

```
(3D product visualization:1.3), smartphone with fitness app UI,
glass and metal dark finish, floating slight angle,
abstract gradient deep purple to electric blue, subtle particles,
(soft ambient screen glow:1.2), cool rim light from behind,
front-facing slight low angle, clean modern premium style,
negative space left side, shallow depth of field

Negative: text, watermark, oversaturated, plastic look,
centered composition, stock photo, extra objects
```

### Render: Reasoning Models (Nano Banana Pro)

```json
{
  "prompt": "Create a premium 3D product visualization of a smartphone displaying a fitness app UI. The phone has a glass and metal dark finish, floating at a slight angle. Background: abstract gradient flowing from deep purple (#6C3CE1) to electric blue (#00D4FF) with subtle particle effects. Lighting: soft ambient glow emanating from the screen with cool-toned rim light from behind. Camera: front-facing at a slight low angle for a hero perspective. Leave the left 40% of the frame as negative space for text overlay. Style: clean, modern, premium. Add subtle film grain for natural feel.",
  "aspect_ratio": "16:9",
  "num_images": 1
}
```

### Render: Midjourney

```
3D product visualization, smartphone with fitness app UI,
glass and metal dark finish, floating, abstract purple to blue
gradient background, ambient screen glow, cool rim light,
slight low angle, clean modern premium, negative space left side
--ar 16:9 --s 750 --v 6.1 --no text, watermark, stock photo
```

-----

## 11. Tool Registry & Fallback System

### Registry Structure

```json
{
  "tools": {
    "fal-ai/nano-banana-pro": {
      "type": "api",
      "capabilities": ["text-to-image", "image-editing", "text-rendering"],
      "model_type": "reasoning",
      "prompt_format": "natural_language_or_json",
      "cost_per_image": 0.15,
      "avg_generation_time": "8s",
      "max_resolution": "4K",
      "strengths": ["text in image", "complex scenes", "reasoning"],
      "weaknesses": ["less artistic control than diffusion"]
    },
    "fal-ai/nano-banana-2": {
      "type": "api",
      "capabilities": ["text-to-image", "image-editing"],
      "model_type": "reasoning",
      "cost_per_image": 0.039,
      "note": "faster, cheaper, slightly less quality than Pro"
    },
    "comfyui/flux-dev": {
      "type": "local",
      "capabilities": ["text-to-image", "img2img", "controlnet", "lora"],
      "model_type": "diffusion",
      "prompt_format": "keyword_weighted",
      "cost_per_image": 0,
      "avg_generation_time": "15-30s",
      "strengths": ["LoRA", "ControlNet", "IP-Adapter", "full control"],
      "weaknesses": ["75 token CLIP limit", "needs local GPU"]
    },
    "lumalabs/dream-machine": {
      "type": "api",
      "capabilities": ["text-to-video", "image-to-video"],
      "cost_per_generation": 0.50,
      "note": "late expensive operation — only after image approval"
    },
    "topaz/gigapixel": {
      "type": "local",
      "capabilities": ["upscale"],
      "note": "last step — only on final approved images"
    }
  }
}
```

### Fallback Chains

```json
{
  "photorealistic_image": [
    { "tool": "fal-ai/nano-banana-pro", "priority": 1 },
    { "tool": "fal-ai/nano-banana-2", "priority": 2 },
    { "tool": "comfyui/flux-photorealistic", "priority": 3 },
    { "tool": "queue_for_retry", "priority": 4, "delay": "15min" }
  ],
  "artistic_illustration": [
    { "tool": "comfyui/flux-dev-lora", "priority": 1 },
    { "tool": "midjourney", "priority": 2 },
    { "tool": "fal-ai/nano-banana-pro", "priority": 3 }
  ],
  "video_generation": [
    { "tool": "lumalabs/dream-machine", "priority": 1 },
    { "tool": "runway/gen4", "priority": 2 },
    { "tool": "queue_for_retry", "priority": 3, "delay": "30min" }
  ]
}
```

-----

## 12. Agent Economics

### Budget System

Кожна місія отримує budget envelope:

```json
{
  "budget": {
    "token_budget": 500000,
    "compute_budget": 8.00,
    "time_budget": "4 hours",
    "quality_threshold": 7.5
  }
}
```

### Agent Cost Tracking

```json
{
  "agent_costs": {
    "spawn_cost": "N tokens на system prompt + context injection",
    "operation_cost": "кожна дія трекається",
    "skill_acquisition_cost": "додатковий контекст на skill pack",
    "tool_call_cost": "API call pricing"
  }
}
```

### ROI Metrics (per mission)

```
ROI = (quality_score × client_satisfaction) / total_cost

Tracked:
- Cost per deliverable
- Cost per iteration
- First-try approval rate
- Average iterations to approval
- Budget utilization %
- Time to completion
```

### Optimization over time:

- Система вчиться: “для задач типу X оптимальна команда з Y агентів з бюджетом Z”
- Prompt Memory скорочує ітерації
- Caching layer зменшує redundant generations
- Client Taste Profile збільшує first-try approval rate

-----

## 13. Conflict Resolution Protocol

Коли агенти мають різні позиції:

```
1. ФОРМАЛІЗАЦІЯ
   Обидва агенти записують позицію як structured argument:
   {
     "position": "Use React",
     "reasoning": "Better ecosystem for this use case",
     "tradeoffs": "Heavier bundle size",
     "estimated_cost": "$X",
     "estimated_quality": 8.5
   }

2. DEVIL'S ADVOCATE
   Окремий агент знаходить слабкі місця в ОБОХ позиціях

3. CEO SCORING
   CEO Agent зважує через scoring matrix:
   quality × cost × time × alignment_with_mission

4. ESCALATION (якщо score різниця < threshold)
   → HumanCEO отримує ready-made summary обох позицій
   → Приймає фінальне рішення
```

-----

## 14. Memory Architecture

### Prompt Memory

```json
{
  "prompt_id": "pm-001",
  "semantic_json": { ... },
  "rendered_prompts": {
    "flux": "...",
    "nano_banana": "...",
    "midjourney": "..."
  },
  "tool_used": "fal-ai/nano-banana-pro",
  "params": { "aspect_ratio": "16:9", "resolution": "2K" },
  "human_score": 9,
  "mission_type": "landing_page",
  "industry": "fitness",
  "iterations_to_approve": 1,
  "total_cost": "$0.19",
  "tags": ["gradient", "product_viz", "premium", "dark_theme"]
}
```

### Client Taste Profile

Автоматично будується на основі кожного feedback, вибору між варіантами, approve/reject. Використовується як pre-generation constraint.

### Inter-Mission Knowledge Graph

Звʼязки між місіями: які підходи працюють для яких індустрій, які комбінації стилів отримують високі scores, які антипаттерни уникати.

### Collective Memory Compression

Після кожної місії — архів процесу та результатів. Формує portfolio та institutional knowledge.

-----

## 15. Creative Version Control

```
Mission: FitPulse Landing
│
├─ Brainstorm → 3 creative directions
│  ├─ Direction A: "Dark premium" ← selected
│  ├─ Direction B: "Light minimal"
│  └─ Direction C: "Bold gradient"
│
├─ Hero Image (Direction A)
│  ├─ v0.1: draft → approved direction
│  ├─ v0.2: refined, 4 variants → variant-2 selected
│  ├─ v0.3: color correction
│  └─ v1.0: final + upscale → DELIVERED
│
└─ Icons
   ├─ v0.1: style test (1 icon)
   ├─ v0.2: full set
   └─ v1.0: approved → DELIVERED
```

Кожна нода зберігає: prompt JSON, model, seed, params, cost, score, timestamp. Повна відтворюваність — можна “checkout” будь-яку точку.

-----

## 16. Anti-Slop Engine

### Detection

Аналіз на типові AI-маркери: oversaturation, plastic skin, unnatural bokeh, melting artifacts, excessive symmetry.

### Prevention (pre-generation inject)

Visual Prompter автоматично додає для фотореалістичних задач:

- “subtle film grain”
- “natural skin texture with pores”
- “slight color cast”
- “not oversaturated”
- “micro-imperfections in materials”

### Correction (post-generation)

Легке зерно, мікроваріації в кольорі, subtle chromatic aberration для зняття “AI look”.

### Target metric

“Would a design professional spot this as AI-generated?” — якщо так, артефакт не проходить.

-----

## 17. Caching Layer

### Semantic Cache

Embedding similarity check перед генерацією. Cosine similarity > 0.92 → пропонуємо існуючий артефакт.

### Component Cache

Reusable елементи (фони, градієнти, іконки) тегуються і потрапляють в каталог автоматично.

### Prompt-Result Cache

Ідентичний промпт + параметри → миттєвий cached результат. Нульова вартість.

### Ефект: чим більше місій — тим дешевша кожна наступна.

-----

## 18. Creative Entropy Controller

### Проблема

Після N місій система оптимізується в локальний мінімум — все виглядає однаково.

### Рішення

- **Exploration budget:** 10-15% бюджету на експерименти з нетиповими підходами
- **Style drift detection:** якщо outputs занадто схожі (similarity > 0.85) → підвищити “temperature”
- **Cross-pollination:** успішний підхід з однієї індустрії → пропозиція для іншої

-----

## 19. Automatic Case Study Generator

Побічний продукт кожної місії — готовий case study:

- **Process timeline** з milestones
- **Decision map** — дерево рішень з обґрунтуваннями
- **Кількість варіантів** (клієнт бачить що було 47 ітерацій)
- **Quality progression** — score на кожному етапі
- **Before/after** з анотаціями
- **Metrics** — час, ітерації, quality scores

Генерується автоматично з Mission Context, version tree та observability logs.

-----

## 20. Dry Run Mode

```
gt mission simulate "FitPulse Landing Page"
```

Повний pipeline без реальних генерацій. На виході:

```
SIMULATION REPORT
─────────────────
Agents to spawn: 7
Estimated generations: 23 images, 2 videos
Estimated cost: $4.80
Estimated time: 45 min (with parallel execution)
Budget utilization: 72% of allocated $6.50
Critical path: hero image → frontend layout → final composite
Recommendation: defer video generation to off-peak
```

Корисно для: планування, client quoting, budget validation.

-----

## 21. Graceful Degradation

### Tool Fallback

API впав → наступний tool в fallback chain → local model → queue for retry.

### Partial Delivery

4 з 6 deliverables готові, image API впав → доставити готове, дооробити решту.

### Agent Self-Healing

Агент завис → orchestrator анігілює → spawn нового з чистим контекстом, тим самим task.

-----

## 22. Plugin Architecture

```
aiunit71 plugin install runway-gen4
aiunit71 plugin install elevenlabs-voice
```

Кожен plugin реєструється в Tool Registry, декларує capabilities, pricing, quality benchmarks. Visual Prompter автоматично отримує новий render target.

-----

## 23. Observability Dashboard

### Mission Timeline

Живий Gantt chart — де кожна задача, хто працює, які блокери.

### Cost Tracker

Бюджет vs витрачено vs залишок. Alert при високому burn rate.

### Agent Activity

Що кожен агент робить зараз. Tools, retries, success rate.

### Quality Metrics

Human scores, revision requests, first-try approval rate. Тренди по місіях.

### Prompt Analytics

Найефективніші промпти. Найкращий score/cost ratio по моделях. Задачі з найбільше ітераціями.

-----

## 24. MVP Scope

### Use case: “Згенерувати лендінг для продукту”

### Мінімальна команда:

CEO → HR → PromptMaster → Visual Prompter → Designer → Copywriter → Frontend → QC

### Мінімальний flow:

Context → Brainstorm → Parallel execution → QC → Human review → Delivery + Case Study

### Мінімальний tool set:

1. fal.ai (Nano Banana) — text-to-image
1. ComfyUI (Flux) — complex workflows
1. Lumalabs — video (optional)

### Success criteria:

- End-to-end pipeline працює від brief до delivery
- Human checkpoint на кожному етапі
- Budget tracking від першого до останнього долара
- Auto-generated case study
- Prompt Memory зберігає successful prompts

-----

## 25. Implementation Roadmap

### Week 1: Foundation

- Поставити CrewAI, зробити першу crew з 4 агентів
- Базовий Mission Context Object
- Першу генерацію через fal.ai API

### Week 2: Orchestration

- LangGraph як DAG orchestrator поверх CrewAI
- Parallel execution (copy і design одночасно)
- Базовий hook system (context enrichment)

### Week 3: Memory & Context

- Google ADK context patterns — artifact store, session state
- Prompt Memory (vector DB)
- Visual Prompter з dual-model rendering

### Week 4: Human Layer

- Slack інтеграція через n8n
- Базовий observability dashboard
- Auto-generated case study
- First full mission end-to-end

### Month 2+: Scale

- Anti-Slop Engine
- Client Taste Profiling
- Creative Version Control
- Plugin architecture
- Entropy Controller
- Knowledge Graph

-----

*Document version: 1.0*
*Author: Viktor + Claude*
*Date: 2025-03-06*
*Status: Architecture Specification — ready for implementation*