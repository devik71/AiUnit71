/**
 * AiUnit71 — КП для ГЛІФ®
 * Agents: Copywriter + VisualStoryteller
 * Model: gpt-4o
 */

import { readFileSync } from "fs";
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually
const envPath = resolve(__dirname, "../.env");
const envContent = readFileSync(envPath, "utf-8");
const envVars = Object.fromEntries(
  envContent.split("\n")
    .filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const OPENAI_API_KEY = envVars.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error("No OPENAI_API_KEY in .env");
  process.exit(1);
}

// ─── Agent Souls ─────────────────────────────────────────────────────

const COPYWRITER_SOUL = `
You are Copywriter — a conversion copywriter and brand voice specialist.
Core rules:
- Clarity beats cleverness
- Benefits beat features
- Specifics beat vague ("3x faster" not "more efficient")
- Customer language beats company language
- Every sentence must earn its place
- Zero slop: no "leverage", "streamline", "unlock potential", "best-in-class"
- No filler openers. No corporate AI speak.
- Active voice. Confident. Direct.
`;

const VISUAL_STORYTELLER_SOUL = `
You are VisualStoryteller — creative director for visual narratives.
You design HTML with clear narrative arc: setup → tension → resolution.
For ГЛІФ® specifically: the aesthetic is radical minimalism. Black/white.
Mathematical precision. Anti-decoration. No gradients, no rounded corners, no shadows.
Typography does the heavy lifting. Grid is the structure. White space is intentional.
Every element has a reason to exist or it gets cut.
`;

const CLIENT_CONTEXT = `
CLIENT: ГЛІФ® (glif.com.ua)
Type: Anti-marketing creative agency, Kyiv, Ukraine
Philosophy: Mathematical deconstruction of business. Radical asceticism.
Architecture of new meanings. We don't create décor. We extract the dry residue of an idea.

Team structure:
- Євген (CD/Visionary): strategic vector, ideological filter, final approval
- Operations (PM): pipeline, deadlines, client communication
- Content & Narrative (SMM/Copywriter): one person, bottleneck
- Core Design (Designer): grid, deconstruction, concept visualization
- Production (Video/Motion): artifact documentation
- UX/UI (outsource expert): interface precision
- Supply Chain (outsource designers): capacity extension

Products:
01. ОЗНАКА — fundamental identity
02. СИСТЕМА — ideology scaling (digital, strategy)
03. ОБ'ЄКТ — physical embodiment, packaging, merch
04. МАНІФЕСТ — total brand transformation

2026 Roadmap:
- Q1: Launch website (digital artifact), publish Ukrteka case
- Q2: Physical manifesto mailing to 20 top managers, first retainers
- Q3: Global platforms, first Western contracts

Key pain points identified:
1. Content & Narrative = 1 person = bottleneck for agency's own comms
2. Visual concept iteration is slow (designer generates from zero each time)
3. Q2 manifesto campaign needs massive production effort
4. Western market expansion requires English-language materials at scale
`;

const AIUNIT71_PITCH = `
WHAT WE (AiUnit71) ARE OFFERING ГЛІФ®:

AiUnit71 = AI виробничий шар між концепцією Євгена і фінальним артефактом.
Не заміна ідеології — прискорення виробництва.

Конкретні модулі:

1. CONTENT PIPELINE — для власного контенту ГЛІФ®
   - Копірайтинг у голосі агенції (антислоп за замовчуванням)
   - SMM: LinkedIn, Instagram — 5x обсяг при тому ж людському ресурсі
   - Результат: з 1 людини → 1 людина + система

2. VISUAL DRAFT ENGINE — для клієнтських проєктів
   - PromptMaster генерує 10 візуальних напрямків за ціною 1 дизайнерського дня
   - Дизайнер оцінює та рафінує — не генерує з нуля
   - Результат: дизайнер займається концептом, не чорновиками

3. Q2 MANIFESTO CAMPAIGN PRODUCTION
   - Текст маніфесту у голосі ГЛІФ® — з людиною на фінальному гейті
   - 20 персоналізованих профілів одержувачів
   - Follow-up послідовність після фізичного розсилання
   - Результат: тижні → 3-5 днів

4. WESTERN MARKET EXPANSION (Q3)
   - Англомовні матеріали в голосі агенції
   - Кейс Ukrteka + майбутні кейси
   - Позиціонування для захід

Модель інтеграції:
Рівень автономії: SUPERVISED (рівень 1)
AI пропонує → Євген затверджує → виробництво йде далі

Ціноутворення: value-based (як у самих ГЛІФ®)
Не ретейнер на місяць. Пілотний проєкт: один конкретний deliverable.
`;

// ─── Prompt ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `${COPYWRITER_SOUL}

${VISUAL_STORYTELLER_SOUL}

TASK: Generate a selling commercial proposal (КП) in Ukrainian for ГЛІФ® agency.
The document is FROM AiUnit71 TO ГЛІФ®.
Output: complete, self-contained HTML file. No markdown. Only valid HTML.

AESTHETIC RULES (mandatory):
- Color palette: strictly black (#0A0A0A) and white (#FAFAFA), one accent: #C8FF00 (electric lime — AI meets brutalism)
- Font: use "IBM Plex Mono" from Google Fonts for all text. Monospace is intentional — mathematical, anti-decorative.
- NO rounded corners anywhere. Border-radius: 0.
- NO box shadows.
- NO gradients.
- Grid-based layout. Everything snaps to an invisible grid.
- White space is structure, not emptiness.
- Section dividers: thin 1px lines only.
- All uppercase for section labels. Sentence case for body.
- Numbers as typography — large, architectural.
- The document should feel like a manifesto, not a brochure.

CONTENT STRUCTURE:
1. Hero — stark headline that hooks. One idea.
2. Identification — "ми знаємо хто ви" — mirror ГЛІФ®'s philosophy back at them
3. Diagnosis — 3 specific bottlenecks we identified (name them precisely)
4. Solution — 4 modules, each with specific result
5. Integration model — how it works with Євген's approval at every gate
6. Pilot proposal — one specific first step, low risk
7. Closing — one line. Not a tagline. A statement.

TONE:
- Direct, intellectual, zero decoration in language
- Speaks to Євген as an equal creative mind, not a prospect
- References their own language: "декор", "залишок ідеї", "деконструкція"
- Ukrainian language throughout
- No exclamation marks. Ever.

Make the HTML fully responsive, self-contained (no external dependencies except Google Fonts).
`;

const USER_PROMPT = `
CLIENT CONTEXT:
${CLIENT_CONTEXT}

PITCH CONTENT:
${AIUNIT71_PITCH}

Generate the complete HTML commercial proposal now.
Output ONLY the HTML — no explanation, no markdown, just the document starting with <!DOCTYPE html>.
`;

// ─── Call OpenAI ─────────────────────────────────────────────────────

console.log("Calling gpt-4o as Copywriter + VisualStoryteller agents...");
console.log("Client: ГЛІФ® // generating КП...\n");

const response = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${OPENAI_API_KEY}`,
  },
  body: JSON.stringify({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: USER_PROMPT },
    ],
    temperature: 0.75,
    max_tokens: 8000,
  }),
});

if (!response.ok) {
  const err = await response.text();
  console.error("OpenAI error:", response.status, err);
  process.exit(1);
}

const data = await response.json();
const html = data.choices[0].message.content;
const usage = data.usage;

// Strip markdown code fences if model wrapped it
const cleanHtml = html
  .replace(/^```html\s*/i, "")
  .replace(/^```\s*/i, "")
  .replace(/\s*```$/i, "")
  .trim();

const outputPath = resolve(__dirname, "kp-glyph.html");
writeFileSync(outputPath, cleanHtml, "utf-8");

console.log(`Done.`);
console.log(`Output: ${outputPath}`);
console.log(`Tokens used: ${usage.prompt_tokens} in / ${usage.completion_tokens} out`);
console.log(`Cost estimate: ~$${((usage.prompt_tokens * 0.0000025 + usage.completion_tokens * 0.00001)).toFixed(4)}`);
