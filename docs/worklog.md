# AiUnit71 — Work Log

---

## 2026-03-08 — Skills System: Queue Batch 1

### Контекст
Виконано чергу з 4 завдань по системі skills (`skills/aiunit71/`).
Гілка: `claude/aiunit71-agent-factory-6BcLD`

---

### 1. Новий skill: `brief-scout`

**Файли:**
- `skills/aiunit71/brief-scout/SKILL.md`
- `skills/aiunit71/brief-scout/_meta.json`

**Призначення:** Pre-production reconnaissance. Блокує всі producer-скіли до отримання clearance.

**Що робить:**
- Перевіряє MCO на completeness (70%+ required)
- Знаходить ambiguity у deliverables (нечітка кількість, формат, платформа)
- Робить asset inventory (логотипи, референси, copy samples)
- Валідує залежності між rooms у execution plan
- Виявляє risk flags (regulated industries, культурно чутливий контент, нереалістичний бюджет)

**Вихід:** Звіт з оцінкою по кожній room: ✅ CLEAR / ⚠️ WARNING / 🚫 BLOCKED

**Залежності:**
- `depends_on: [mission-planner, client-researcher]`
- `blocks: [copywriting, social-content, visual-prompt-engineering, mascot-animation]`

---

### 2. Новий skill: `delivery-validator`

**Файли:**
- `skills/aiunit71/delivery-validator/SKILL.md`
- `skills/aiunit71/delivery-validator/_meta.json`

**Призначення:** Фінальний gate перед передачею клієнту. Ніщо не виходить без його PASS.

**6 перевірок:**
1. **Deliverable count** — всі заплановані позиції присутні
2. **Placeholder scan** — нема `[INSERT HERE]`, `TODO:`, `[CLIENT NAME]` тощо
3. **Naming convention** — формат `CLIENT_TYPE_PLATFORM_SEQ_DATE.EXT`
4. **Format compliance** — character limits, обов'язкові секції (subject, preview, body)
5. **QC record cross-reference** — кожен deliverable має PASS від output-reviewer
6. **Package structure** — README.md, папки `copy/`, `visuals/`, `calendar/`, `reference/`

**Вихід:** Delivery Validation Report з точними локаціями блокерів.

**Залежності:**
- `depends_on: [output-reviewer]`
- `blocks: []`

---

### 3. Поле `modes:` у трьох skills

Додано до YAML frontmatter для вказівки глибини спеціалізації при виклику.

**`copywriting/SKILL.md`:**
| Mode | Опис |
|------|------|
| `standard` | Один deliverable, повний brief intake |
| `batch` | Багато позицій з одного brief, рання зупинка при системних помилках |
| `high_conversion` | Direct response: hook, CTA, objection handling |
| `localization` | Адаптація існуючого copy для нового ринку/мови |
| `refresh` | Переписування існуючого copy клієнта |

**`output-reviewer/SKILL.md`:**
| Mode | Опис |
|------|------|
| `standard` | Повний 5-dimension review |
| `quick_pass` | Тільки hard fails — placeholders, brief compliance, anti-slop |
| `batch` | 10+ позицій: review 3 → стоп при системній проблемі |
| `pre_client` | Найсуворіший: поріг 8.0, пакет до delivery-validator |

**`client-researcher/SKILL.md`:**
| Mode | Опис |
|------|------|
| `light` | Surface-level, тільки audience language |
| `deep` | Повний scope: audience + competitors + niche + voice benchmarks |
| `competitive_focus` | Акцент на competitor gap analysis і content territory |
| `refresh` | Оновлення існуючого дослідження для returning client |

---

### 4. Progressive Disclosure Refactor

Важкий reference-контент винесено з SKILL.md у `resources/` підпапки. SKILL.md залишає лише операційні інструкції + посилання.

#### `anti-slop/`
- `resources/visual-markers.md` — AI visual artifact markers, pre-generation injections, negative prompts, post-generation correction techniques
- `resources/copy-patterns.md` — banned openers, vague corporate words, structural tells, over-hedging, 4-round editing checklist, authenticity scoring table
- SKILL.md: 200 → 108 рядків (−46%)

#### `visual-prompt-engineering/`
- `resources/photography-terminology.md` — таблиці lighting/camera translations, film stock references, photo genre terms
- `resources/genre-patterns.md` — prompt templates: product hero shot, lifestyle, abstract/brand visual; anti-slop injections, negative prompts
- SKILL.md: 229 → 166 рядків (−27%)

#### `social-content/`
- `resources/platform-specs.md` — platform overview table, character limits, content calendar template, repurposing workflow, engagement daily routine, analytics tracking, viral reverse engineering
- SKILL.md: 202 → 118 рядків (−42%)

---

### Стан skills system після змін

| Skill | Type | Нове | modes: | resources/ |
|-------|------|------|--------|------------|
| `brief-scout` | intelligence | ✅ | — | — |
| `delivery-validator` | validator | ✅ | — | — |
| `copywriting` | producer | — | ✅ | — |
| `output-reviewer` | validator | — | ✅ | — |
| `client-researcher` | intelligence | — | ✅ | — |
| `anti-slop` | validator | — | — | ✅ |
| `visual-prompt-engineering` | producer | — | — | ✅ |
| `social-content` | producer | — | — | ✅ |

### Production pipeline після змін (повний flow)

```
client-researcher (mode: light/deep/competitive/refresh)
        ↓
brief-scout ← блокує всіх producers до clearance
        ↓
mission-planner → niche-adapter
        ↓
copywriting / social-content / visual-prompt-engineering  (modes: ...)
        ↓
anti-slop
        ↓
output-reviewer (mode: standard/quick_pass/batch/pre_client)
        ↓
delivery-validator ← фінальний gate
        ↓
CLIENT HANDOFF
```
