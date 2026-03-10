import { useState, useEffect, useRef, useCallback } from "react";

// ============================================================
// SUPERBOX STORYBOARD NOTATION SYSTEM
// Архітектура: Body / Faceplate / Face Animation Layer
// ============================================================

// --- GLYPH DEFINITIONS ---
const GLYPHS = {
  body_front: { id: "BF", label: "Front", desc: "Маскот обличчям до нас" },
  body_side_l: { id: "BSL", label: "Side L", desc: "Повернутий боком вліво" },
  body_side_r: { id: "BSR", label: "Side R", desc: "Повернутий боком вправо" },
  body_lean_fwd: { id: "BLF", label: "Lean Fwd", desc: "Нахил вперед (поклін)" },
  body_split: { id: "BSP", label: "Split", desc: "Роздвоєння силуету" },
  body_merge: { id: "BMG", label: "Merge", desc: "Злиття назад" },
  body_melt: { id: "BMT", label: "Melt", desc: "Танення вниз" },
  body_glitch: { id: "BGL", label: "Glitch", desc: "Глітч всього тіла" },
  body_shake: { id: "BSH", label: "Shake", desc: "Тремтіння" },
  body_tense: { id: "BTS", label: "Tense", desc: "Напруження" },

  face_smile: { id: "FS", label: "😊", desc: "Стандартна посмішка" },
  face_cool: { id: "FC", label: "😎", desc: "Круте обличчя (окуляри)" },
  face_surprise: { id: "FX", label: "😮", desc: "Здивування" },
  face_sad: { id: "FD", label: "😢", desc: "Сумне обличчя" },
  face_squeeze: { id: "FQ", label: "😣", desc: "Зажмурене" },
  face_smart: { id: "FM", label: "🤓", desc: "Розумні окуляри" },
  face_dollar: { id: "F$", label: "$", desc: "Знак долару" },
  face_euro: { id: "F€", label: "€", desc: "Знак євро" },
  face_qr: { id: "FQR", label: "QR", desc: "QR-код замість обличчя" },
  face_check: { id: "F✓", label: "✅", desc: "Чекмарк" },
  face_closed: { id: "FZ", label: "😴", desc: "Заплющені очі" },
  face_wink: { id: "FW", label: "😉", desc: "Підморгування" },

  eyes_track_l: { id: "EL", label: "👀←", desc: "Погляд вліво" },
  eyes_track_r: { id: "ER", label: "👀→", desc: "Погляд вправо" },
  eyes_track_obj: { id: "ET", label: "👀⟲", desc: "Стежить за обʼєктом" },
  eyes_scan: { id: "ES", label: "👀↕", desc: "Погляд вгору-вниз (сканування)" },
  eyes_visor: { id: "EV", label: "🖐👀", desc: "Рука козирком" },

  hand_appear_l: { id: "HL", label: "✋←", desc: "Ліва рука зʼявляється" },
  hand_appear_r: { id: "HR", label: "✋→", desc: "Права рука зʼявляється" },
  hand_grab: { id: "HG", label: "🤏", desc: "Рука хапає" },
  hand_throw: { id: "HT", label: "🤾", desc: "Кидок" },
  hand_stretch: { id: "HS", label: "↔✋", desc: "Руки розтягують" },
  hand_hold_2: { id: "H2", label: "✋✋", desc: "Дві руки тримають" },
  hand_juggle: { id: "HJ", label: "🤹", desc: "Жонглювання" },
  hand_extend: { id: "HE", label: "✋→📄", desc: "Простягає обʼєкт" },
  hand_hide: { id: "HH", label: "🫣", desc: "Ховає за спину" },

  obj_text_popup: { id: "OT", label: "+TXT⬆", desc: "Спливний текст" },
  obj_banknote: { id: "OB", label: "💵", desc: "Купюра" },
  obj_card: { id: "OC", label: "💳", desc: "Банківська картка" },
  obj_gold: { id: "OG", label: "🥇", desc: "Злиток золота" },
  obj_wallet: { id: "OW", label: "👛", desc: "Гаманець" },
  obj_coin_a: { id: "OA", label: "🪙A", desc: "Монета А" },
  obj_coin_b: { id: "OB2", label: "🪙B", desc: "Монета Б" },
  obj_envelope: { id: "OE", label: "✉️", desc: "Конверт" },
  obj_document: { id: "OD", label: "📄", desc: "Документ" },
  obj_scroll: { id: "OS", label: "📜", desc: "Звиток" },
  obj_heart: { id: "OH", label: "❤️", desc: "Серце" },
  obj_tear: { id: "OTR", label: "💧", desc: "Сльоза" },
  obj_dialog: { id: "ODG", label: "💬", desc: "Діалогове вікно" },
  obj_stamp_x: { id: "OSX", label: "❌📄", desc: "Штамп відмови" },
  obj_like: { id: "OL", label: "👍", desc: "Лайк" },
  obj_stack: { id: "OST", label: "💰", desc: "Стопка купюр" },

  fx_recycle: { id: "⟲", label: "⟲", desc: "Знак обміну/кругообігу" },
  fx_scan_line: { id: "▓", label: "▓↓", desc: "Лінія сканеру" },
  fx_pixel_grow: { id: "◉", label: "◉→□", desc: "Піксель росте" },
  fx_cascade: { id: "❤❤❤", label: "❤×N", desc: "Каскад обʼєктів" },
  fx_transform: { id: "→", label: "A→B", desc: "Трансформація" },

  flow_arrow: { id: "→", label: "→", desc: "Наступний крок" },
  flow_dash: { id: "—", label: "—", desc: "Роздільник" },
  flow_pause: { id: "⏸", label: "⏸", desc: "Пауза" },
};

// --- SCENARIO DATA ---
const SCENARIOS = [
  {
    id: 1,
    title: "Купівля/продаж криптовалюти",
    titleEn: "Crypto Buy/Sell",
    color: "#F7931A",
    steps: [
      { glyph: "body_front", layer: "body", note: "Стоїть прямо" },
      { glyph: "face_smile", layer: "faceplate", note: "Посмішка" },
      { glyph: "obj_text_popup", layer: "external", note: "+BTC / +ERC / +SOL вгору" },
      { glyph: "face_cool", layer: "faceplate", note: "Окуляри, крутий вираз" },
      { glyph: "face_smile", layer: "faceplate", note: "Повернення до посмішки" },
    ],
    nonBodyTasks: [
      "Faceplate: перехід smile → cool (окуляри) → smile",
      "External: анімація спливного тексту +BTC/+ERC/+SOL що летить вгору",
      "External: стиль тексту — ретро-ігровий (damage numbers)",
    ],
  },
  {
    id: 2,
    title: "Покупка/продаж валют",
    titleEn: "Currency Buy/Sell",
    color: "#2E86AB",
    steps: [
      { glyph: "body_front", layer: "body", note: "Стоїть прямо" },
      { glyph: "body_split", layer: "body", note: "Роздвоєння" },
      { glyph: "obj_banknote", layer: "external", note: "Купюри летять між силуетами" },
      { glyph: "body_merge", layer: "body", note: "Злиття назад" },
      { glyph: "face_smile", layer: "faceplate", note: "Посмішка" },
    ],
    nonBodyTasks: [
      "External: анімація купюр що летять між двома силуетами",
      "Faceplate: стандартна посмішка на обох силуетах під час split",
    ],
  },
  {
    id: 3,
    title: "Обмін валют",
    titleEn: "Currency Exchange",
    color: "#4CAF50",
    steps: [
      { glyph: "body_front", layer: "body", note: "Стоїть" },
      { glyph: "eyes_track_obj", layer: "face_anim", note: "Очі стежать за купюрою" },
      { glyph: "obj_banknote", layer: "external", note: "Купюра залітає ззовні" },
      { glyph: "face_dollar", layer: "faceplate", note: "Обличчя → знак $" },
      { glyph: "fx_recycle", layer: "external", note: "Знак кругообігу" },
      { glyph: "face_euro", layer: "faceplate", note: "Обличчя → знак €" },
      { glyph: "obj_banknote", layer: "external", note: "Купюра вилізає назовні" },
      { glyph: "face_smile", layer: "faceplate", note: "Посмішка повертається" },
      { glyph: "eyes_track_obj", layer: "face_anim", note: "Проводжає поглядом" },
    ],
    nonBodyTasks: [
      "Face anim: eye tracking — стежить за купюрою вліво→центр",
      "Faceplate: послідовність smile → $ → ⟲ → € → smile",
      "External: купюра залітає, потім вилітає назад",
      "External: анімація знаку кругообігу",
      "Face anim: eye tracking — проводжає купюру центр→вправо",
    ],
  },
  {
    id: 4,
    title: "Видача картки",
    titleEn: "Card Issuance",
    color: "#9C27B0",
    steps: [
      { glyph: "body_side_r", layer: "body", note: "Повернутий боком" },
      { glyph: "obj_card", layer: "external", note: "Картка вилізає з тіла (тостер)" },
      { glyph: "face_surprise", layer: "faceplate", note: "Здивоване обличчя" },
      { glyph: "eyes_track_obj", layer: "face_anim", note: "Дивиться на картку" },
      { glyph: "hand_grab", layer: "body", note: "Бере картку рукою" },
      { glyph: "body_front", layer: "body", note: "Повертається обличчям" },
      { glyph: "hand_extend", layer: "body", note: "Простягає картку в камеру" },
      { glyph: "face_smile", layer: "faceplate", note: "Посмішка" },
    ],
    nonBodyTasks: [
      "Faceplate: перехід surprise → smile",
      "Face anim: eye tracking на картку під час виходу",
      "External: картка — анімація виходу як тост з тостера",
      "External: картка рухається з рукою до камери",
    ],
  },
  {
    id: 5,
    title: "Продаж золота",
    titleEn: "Gold Sale",
    color: "#FFD700",
    steps: [
      { glyph: "body_front", layer: "body", note: "Стоїть" },
      { glyph: "face_squeeze", layer: "faceplate", note: "Зажмурюється" },
      { glyph: "body_tense", layer: "body", note: "Напруження" },
      { glyph: "obj_gold", layer: "external", note: "Злитки вилітають зверху (3-5)" },
      { glyph: "obj_gold", layer: "external", note: "Падають пірамідкою збоку" },
      { glyph: "fx_transform", layer: "external", note: "Злитки → стопки купюр" },
      { glyph: "obj_stack", layer: "external", note: "Стеки купюр гіркою" },
      { glyph: "face_smile", layer: "faceplate", note: "Розслаблення, посмішка" },
    ],
    nonBodyTasks: [
      "Faceplate: перехід squeeze (зажмурення) → smile",
      "External: злитки вилітають зверху як з тостера",
      "External: злитки падають і складаються пірамідкою",
      "External: трансформація злитків у стопки купюр",
    ],
  },
  {
    id: 6,
    title: "Cashin / Cashout",
    titleEn: "Cashin / Cashout",
    color: "#00BCD4",
    steps: [
      { glyph: "body_front", layer: "body", note: "Стоїть" },
      { glyph: "obj_wallet", layer: "external", note: "Гаманець зʼявляється" },
      { glyph: "obj_banknote", layer: "external", note: "Наповнення / спустошення" },
      { glyph: "face_smile", layer: "faceplate", note: "Радість (cashin)" },
      { glyph: "face_sad", layer: "faceplate", note: "Філософський сум (cashout)" },
    ],
    nonBodyTasks: [
      "Faceplate: варіантна розвилка — smile (cashin) АБО sad (cashout)",
      "External: гаманець зʼявляється перед маскотом",
      "External: анімація наповнення/спустошення гаманця",
    ],
  },
  {
    id: 7,
    title: "Отримання QR коду",
    titleEn: "QR Code",
    color: "#333333",
    steps: [
      { glyph: "body_front", layer: "body", note: "Стоїть" },
      { glyph: "face_smile", layer: "faceplate", note: "Дивиться в камеру" },
      { glyph: "hand_stretch", layer: "body", note: "Руки розтягують обличчя" },
      { glyph: "face_qr", layer: "faceplate", note: "Обличчя → QR-код" },
      { glyph: "face_smile", layer: "faceplate", note: "Відпускає, обличчя назад" },
      { glyph: "face_wink", layer: "faceplate", note: "Підморгування" },
    ],
    nonBodyTasks: [
      "Faceplate: морф smile → QR-код → smile",
      "Face anim: підморгування в кінці",
      "Faceplate: анімація розтягування обличчя в QR",
    ],
  },
  {
    id: 8,
    title: "Завантаження банкомату",
    titleEn: "Boot Sequence",
    color: "#1A237E",
    steps: [
      { glyph: "fx_pixel_grow", layer: "external", note: "Один піксель → весь екран" },
      { glyph: "face_closed", layer: "faceplate", note: "Заплющені очі" },
      { glyph: "eyes_scan", layer: "face_anim", note: "Розплющує, дивиться в боки" },
      { glyph: "face_smile", layer: "faceplate", note: "Посмішка" },
    ],
    nonBodyTasks: [
      "External: анімація пікселя що росте в екран",
      "Faceplate: closed → відкриті очі → smile",
      "Face anim: погляд вліво → вправо → центр",
    ],
  },
  {
    id: 9,
    title: "Out of Service",
    titleEn: "Out of Service",
    color: "#B71C1C",
    steps: [
      { glyph: "body_front", layer: "body", note: "Стоїть" },
      { glyph: "obj_dialog", layer: "external", note: "Діалогове вікно" },
      { glyph: "obj_text_popup", layer: "external", note: "OUT OF SERVICE по літерах" },
      { glyph: "body_melt", layer: "body", note: "Танення вниз" },
      { glyph: "body_shake", layer: "body", note: "Трясе обличчям" },
      { glyph: "body_front", layer: "body", note: "Різко в початкову позицію" },
    ],
    nonBodyTasks: [
      "External: діалогове вікно з типографською анімацією літер",
      "External: зникнення діалогового вікна",
      "Face anim: тремтіння обличчя під час shake",
    ],
  },
  {
    id: 10,
    title: "Немає звʼязку",
    titleEn: "No Connection",
    color: "#607D8B",
    steps: [
      { glyph: "body_glitch", layer: "body", note: "Весь персонаж глітчить" },
    ],
    nonBodyTasks: [
      "Faceplate: глітч-ефект на faceplate",
      "Face anim: глітч-ефект на face layer",
      "External: глітч-ефект на позиції (зсуви, артефакти)",
    ],
  },
  {
    id: 11,
    title: "Операція успішна",
    titleEn: "Success",
    color: "#E91E63",
    steps: [
      { glyph: "obj_heart", layer: "external", note: "Серця вилітають" },
      { glyph: "fx_cascade", layer: "external", note: "Каскад серць" },
      { glyph: "body_lean_fwd", layer: "body", note: "Поклін" },
      { glyph: "body_front", layer: "body", note: "Випрямляється" },
      { glyph: "face_wink", layer: "faceplate", note: "Підморгує" },
    ],
    nonBodyTasks: [
      "External: анімація серць — одне → два → каскад",
      "Faceplate: підморгування в кінці",
    ],
  },
  {
    id: 12,
    title: "Операція неуспішна",
    titleEn: "Failure",
    color: "#795548",
    steps: [
      { glyph: "face_sad", layer: "faceplate", note: "Сумне обличчя" },
      { glyph: "obj_tear", layer: "external", note: "Сльоза з ока" },
      { glyph: "obj_tear", layer: "external", note: "Крапля випадає, розбивається" },
    ],
    nonBodyTasks: [
      "Faceplate: перехід до sad",
      "Face anim: генерація сльози з конкретного ока",
      "External: фізика краплі — падіння + розбиття на пікселі",
    ],
  },
  {
    id: 13,
    title: "Верифікацію пройдено",
    titleEn: "Verification OK",
    color: "#4CAF50",
    steps: [
      { glyph: "fx_scan_line", layer: "external", note: "Зелена полоса сканує" },
      { glyph: "face_check", layer: "faceplate", note: "Обличчя → чекмарк ✅" },
    ],
    nonBodyTasks: [
      "External: зелена лінія сканера зверху вниз по faceplate",
      "Faceplate: морф обличчя → чекмарк",
    ],
  },
  {
    id: 14,
    title: "Верифікацію не пройдено",
    titleEn: "Verification Failed",
    color: "#F44336",
    steps: [
      { glyph: "hand_extend", layer: "body", note: "Простягає документ" },
      { glyph: "obj_document", layer: "external", note: "Документ виходить за екран" },
      { glyph: "obj_stamp_x", layer: "external", note: "Повертається зі штампом ❌" },
      { glyph: "eyes_track_obj", layer: "face_anim", note: "Розглядає штамп" },
      { glyph: "hand_hide", layer: "body", note: "Ховає за спину" },
    ],
    nonBodyTasks: [
      "External: документ виходить за межі екрану і повертається",
      "External: червоний штамп Х зʼявляється на документі",
      "Face anim: eye tracking на документ зі штампом",
    ],
  },
  {
    id: 15,
    title: "Криптообмін",
    titleEn: "Crypto Swap",
    color: "#FF9800",
    steps: [
      { glyph: "hand_hold_2", layer: "body", note: "Дві руки — дві монети" },
      { glyph: "eyes_track_l", layer: "face_anim", note: "Дивиться на ліву" },
      { glyph: "eyes_track_r", layer: "face_anim", note: "Дивиться на праву" },
      { glyph: "hand_juggle", layer: "body", note: "Жонглює, міняє місцями" },
      { glyph: "face_cool", layer: "faceplate", note: "Задоволено демонструє" },
    ],
    nonBodyTasks: [
      "Face anim: eye tracking ліво → право (голова крутиться)",
      "Faceplate: перехід до cool/задоволеного",
      "External: дві різні монети (крипто-іконки)",
    ],
  },
  {
    id: 16,
    title: "Перекази MONEYGRAM",
    titleEn: "MoneyGram Transfer",
    color: "#D32F2F",
    steps: [
      { glyph: "eyes_visor", layer: "face_anim", note: "Дивиться вдалечінь" },
      { glyph: "hand_throw", layer: "body", note: "Жбурляє конверт" },
      { glyph: "obj_envelope", layer: "external", note: "Конверт летить за екран" },
      { glyph: "obj_like", layer: "external", note: "Лайк повертається" },
      { glyph: "face_wink", layer: "faceplate", note: "Задоволено кліпає" },
    ],
    nonBodyTasks: [
      "Face anim: поза 'козирок' — рука над очима",
      "External: конверт летить і зникає за екраном",
      "External: лайк/серце повертається",
      "Faceplate: підморгування",
    ],
  },
  {
    id: 17,
    title: "Платежі",
    titleEn: "Payments",
    color: "#3F51B5",
    steps: [
      { glyph: "body_front", layer: "body", note: "Стоїть" },
      { glyph: "obj_scroll", layer: "external", note: "Звиток зʼявляється поруч" },
      { glyph: "body_side_r", layer: "body", note: "Повертається до звитку" },
      { glyph: "face_smart", layer: "faceplate", note: "Розумні окуляри" },
      { glyph: "eyes_track_obj", layer: "face_anim", note: "Вивчає звиток" },
    ],
    nonBodyTasks: [
      "External: піксельний звиток зʼявляється поруч",
      "Faceplate: зміна на 'розумні окуляри'",
      "Face anim: eye tracking — вивчає звиток",
    ],
  },
];

// --- LAYER COLORS ---
const LAYER_COLORS = {
  body: { bg: "#2D2D2D", border: "#555", text: "#CCC", label: "BODY" },
  faceplate: { bg: "#1A3A5C", border: "#4A8AC2", text: "#8BC4FF", label: "FACEPLATE" },
  face_anim: { bg: "#3A1A4A", border: "#9B4AC2", text: "#D08BFF", label: "FACE ANIM" },
  external: { bg: "#1A3A2A", border: "#4AC262", text: "#8BFFA8", label: "EXTERNAL" },
};

// --- PLAYER COLORS ---
const PLAYERS = {
  p1: { color: "#4A8AC2", label: "P1", name: "Player 1" },
  p2: { color: "#F7931A", label: "P2", name: "Player 2" },
};

// --- TASK KEY ---
function taskKey(scenarioId, taskIndex) {
  return `${scenarioId}-${taskIndex}`;
}

// --- GLYPH RENDERER ---
function GlyphIcon({ type, size = 32 }) {
  const s = size;
  const h = s / 2;

  const icons = {
    body_front: (
      <g>
        <rect x={4} y={2} width={s - 8} height={s - 4} rx={3} fill="none" stroke="currentColor" strokeWidth={2} />
        <rect x={8} y={6} width={s - 16} height={s - 16} rx={1} fill="none" stroke="currentColor" strokeWidth={1.5} />
        <line x1={h - 3} y1={s - 6} x2={h - 3} y2={s - 2} stroke="currentColor" strokeWidth={1.5} />
        <line x1={h + 3} y1={s - 6} x2={h + 3} y2={s - 2} stroke="currentColor" strokeWidth={1.5} />
      </g>
    ),
    body_side_r: (
      <g>
        <rect x={6} y={2} width={s - 12} height={s - 4} rx={3} fill="none" stroke="currentColor" strokeWidth={2} />
        <line x1={8} y1={h} x2={s - 8} y2={h - 4} stroke="currentColor" strokeWidth={1.5} />
        <line x1={h} y1={s - 6} x2={h} y2={s - 2} stroke="currentColor" strokeWidth={1.5} />
      </g>
    ),
    body_side_l: (
      <g>
        <rect x={6} y={2} width={s - 12} height={s - 4} rx={3} fill="none" stroke="currentColor" strokeWidth={2} />
        <line x1={s - 8} y1={h} x2={8} y2={h - 4} stroke="currentColor" strokeWidth={1.5} />
        <line x1={h} y1={s - 6} x2={h} y2={s - 2} stroke="currentColor" strokeWidth={1.5} />
      </g>
    ),
    body_split: (
      <g>
        <rect x={2} y={4} width={12} height={s - 8} rx={2} fill="none" stroke="currentColor" strokeWidth={1.5} strokeDasharray="2 2" />
        <rect x={s - 14} y={4} width={12} height={s - 8} rx={2} fill="none" stroke="currentColor" strokeWidth={1.5} strokeDasharray="2 2" />
        <line x1={h} y1={6} x2={h} y2={s - 6} stroke="currentColor" strokeWidth={1} strokeDasharray="3 3" opacity={0.4} />
      </g>
    ),
    body_merge: (
      <g>
        <rect x={2} y={4} width={12} height={s - 8} rx={2} fill="none" stroke="currentColor" strokeWidth={1.5} />
        <rect x={s - 14} y={4} width={12} height={s - 8} rx={2} fill="none" stroke="currentColor" strokeWidth={1.5} />
        <path d={`M14 ${h} L${s - 14} ${h}`} stroke="currentColor" strokeWidth={1.5} markerEnd="url(#arrow)" />
      </g>
    ),
    body_melt: (
      <g>
        <path d={`M6 4 L6 ${s - 10} Q${h} ${s} ${s - 6} ${s - 10} L${s - 6} 4 Z`} fill="none" stroke="currentColor" strokeWidth={2} />
        <circle cx={h - 4} cy={12} r={2} fill="currentColor" />
        <circle cx={h + 4} cy={12} r={2} fill="currentColor" />
      </g>
    ),
    body_glitch: (
      <g>
        <rect x={4} y={2} width={s - 8} height={s - 4} rx={3} fill="none" stroke="currentColor" strokeWidth={2} strokeDasharray="4 2" />
        <line x1={2} y1={h} x2={s - 2} y2={h} stroke="currentColor" strokeWidth={1} opacity={0.5} />
        <rect x={6} y={h - 2} width={8} height={4} fill="currentColor" opacity={0.3} />
        <rect x={s - 14} y={h + 2} width={6} height={3} fill="currentColor" opacity={0.3} />
      </g>
    ),
    body_shake: (
      <g>
        <rect x={6} y={4} width={s - 12} height={s - 8} rx={3} fill="none" stroke="currentColor" strokeWidth={2} />
        <path d={`M3 ${h - 4} L1 ${h} L3 ${h + 4}`} stroke="currentColor" strokeWidth={1.5} fill="none" />
        <path d={`M${s - 3} ${h - 4} L${s - 1} ${h} L${s - 3} ${h + 4}`} stroke="currentColor" strokeWidth={1.5} fill="none" />
      </g>
    ),
    body_tense: (
      <g>
        <rect x={4} y={2} width={s - 8} height={s - 4} rx={3} fill="none" stroke="currentColor" strokeWidth={2.5} />
        <line x1={2} y1={4} x2={6} y2={8} stroke="currentColor" strokeWidth={1.5} />
        <line x1={s - 2} y1={4} x2={s - 6} y2={8} stroke="currentColor" strokeWidth={1.5} />
        <line x1={2} y1={s - 4} x2={6} y2={s - 8} stroke="currentColor" strokeWidth={1.5} />
        <line x1={s - 2} y1={s - 4} x2={s - 6} y2={s - 8} stroke="currentColor" strokeWidth={1.5} />
      </g>
    ),
    body_lean_fwd: (
      <g>
        <rect x={4} y={6} width={s - 8} height={s - 10} rx={3} fill="none" stroke="currentColor" strokeWidth={2} transform={`rotate(-15 ${h} ${h})`} />
      </g>
    ),
  };

  const icon = icons[type];
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ display: "block" }}>
      <defs>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0 0 L6 3 L0 6 Z" fill="currentColor" />
        </marker>
      </defs>
      {icon || (
        <text x={h} y={h + 4} textAnchor="middle" fontSize={10} fill="currentColor" fontFamily="monospace">
          {GLYPHS[type]?.id || "?"}
        </text>
      )}
    </svg>
  );
}

// --- STORYBOARD STRIP ---
function StoryboardStrip({ scenario }) {
  return (
    <div style={{
      background: "#F5F0E0",
      border: "2px solid #8B7355",
      borderRadius: 6,
      padding: "12px 16px",
      marginBottom: 12,
      fontFamily: "'Courier New', monospace",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{
          background: scenario.color,
          color: "#fff",
          fontWeight: 900,
          fontSize: 14,
          width: 28,
          height: 28,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          {scenario.id}
        </span>
        <span style={{ fontWeight: 700, fontSize: 14, color: "#2D2D2D" }}>
          {scenario.title}
        </span>
        <span style={{ fontSize: 11, color: "#888", fontStyle: "italic" }}>
          {scenario.titleEn}
        </span>
      </div>

      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        overflowX: "auto",
        padding: "8px 0",
        borderTop: "1px dashed #B8A88A",
        borderBottom: "1px dashed #B8A88A",
      }}>
        {scenario.steps.map((step, i) => {
          const layerStyle = LAYER_COLORS[step.layer] || LAYER_COLORS.external;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 2 }}>
              {i > 0 && (
                <span style={{ color: "#8B7355", fontSize: 16, margin: "0 2px" }}>—</span>
              )}
              <div
                style={{
                  background: layerStyle.bg,
                  border: `1.5px solid ${layerStyle.border}`,
                  borderRadius: 4,
                  padding: "4px 6px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  minWidth: 52,
                  cursor: "default",
                }}
                title={`${step.note}\n[${layerStyle.label}]`}
              >
                <div style={{ color: layerStyle.text, marginBottom: 2 }}>
                  {GLYPHS[step.glyph] ? (
                    <span style={{ fontSize: 18 }}>{GLYPHS[step.glyph].label}</span>
                  ) : (
                    <GlyphIcon type={step.glyph} size={28} />
                  )}
                </div>
                <span style={{
                  fontSize: 7,
                  color: layerStyle.text,
                  opacity: 0.7,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}>
                  {layerStyle.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 6, fontSize: 10, color: "#6B5B45", lineHeight: 1.5 }}>
        {scenario.steps.map((s, i) => (
          <span key={i}>
            {i > 0 && " → "}
            <span style={{ color: s.layer === "body" ? "#FFFFFF" : LAYER_COLORS[s.layer]?.border || "#888" }}>{s.note}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// --- SETUP PANEL ---
function SetupPanel({ playerId, serverHost, onSetPlayer, onSetHost, onDone }) {
  const [hostInput, setHostInput] = useState(serverHost);

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.85)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 100,
      fontFamily: "'Courier New', monospace",
    }}>
      <div style={{
        background: "#111",
        border: "2px solid #F7931A",
        borderRadius: 10,
        padding: 32,
        width: 360,
      }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#F7931A", marginBottom: 24, letterSpacing: 2 }}>
          MULTIPLAYER SETUP
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
            You are
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {["p1", "p2"].map(pid => (
              <button
                key={pid}
                onClick={() => onSetPlayer(pid)}
                style={{
                  flex: 1,
                  padding: "12px 0",
                  background: playerId === pid ? PLAYERS[pid].color : "#222",
                  color: playerId === pid ? "#000" : PLAYERS[pid].color,
                  border: `2px solid ${PLAYERS[pid].color}`,
                  borderRadius: 6,
                  fontSize: 16,
                  fontWeight: 900,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  letterSpacing: 2,
                }}
              >
                {PLAYERS[pid].label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
            Sync server host
          </div>
          <div style={{ fontSize: 10, color: "#555", marginBottom: 6 }}>
            P1: run <span style={{ color: "#F7931A" }}>node server.js</span> — use localhost{"\n"}
            P2: enter P1's local IP (e.g. 192.168.1.X)
          </div>
          <input
            value={hostInput}
            onChange={e => setHostInput(e.target.value)}
            placeholder="localhost or 192.168.1.X"
            style={{
              width: "100%",
              background: "#1A1A1A",
              border: "1.5px solid #333",
              borderRadius: 4,
              color: "#DDD",
              fontFamily: "inherit",
              fontSize: 13,
              padding: "8px 10px",
              boxSizing: "border-box",
              outline: "none",
            }}
          />
        </div>

        <div style={{ fontSize: 10, color: "#555", marginBottom: 20, lineHeight: 1.6 }}>
          Without server: works offline, no sync between macbooks.
        </div>

        <button
          onClick={() => { onSetHost(hostInput); onDone(); }}
          style={{
            width: "100%",
            padding: "12px 0",
            background: "#F7931A",
            color: "#000",
            border: "none",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 900,
            cursor: "pointer",
            fontFamily: "inherit",
            letterSpacing: 2,
          }}
        >
          START
        </button>
      </div>
    </div>
  );
}

// --- PROGRESS BAR ---
function ProgressBar({ checked, total, color, label }) {
  const pct = total === 0 ? 0 : Math.round((checked / total) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 120 }}>
      <span style={{ fontSize: 11, color, fontWeight: 700, minWidth: 22 }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: "#333", borderRadius: 3, overflow: "hidden", minWidth: 60 }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: color,
          borderRadius: 3,
          transition: "width 0.3s ease",
        }} />
      </div>
      <span style={{ fontSize: 10, color: "#666", minWidth: 40 }}>{checked}/{total}</span>
    </div>
  );
}

// --- MAIN APP ---
export default function SuperboxStoryboardSystem() {
  const [activeTab, setActiveTab] = useState("strips");
  const [filterLayer, setFilterLayer] = useState("all");
  const [showSetup, setShowSetup] = useState(true);

  // Multiplayer state
  const [playerId, setPlayerId] = useState(
    () => localStorage.getItem("sb_player") || "p1"
  );
  const [serverHost, setServerHost] = useState(
    () => localStorage.getItem("sb_host") || "localhost"
  );

  // Checked tasks: { [taskKey]: { p1: bool, p2: bool } }
  const [checked, setChecked] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sb_checked") || "{}"); }
    catch { return {}; }
  });

  const [connStatus, setConnStatus] = useState("offline"); // "offline" | "syncing" | "ok" | "error"
  const syncTimerRef = useRef(null);
  const lastSyncRef = useRef(null);

  // Persist player/host choices
  useEffect(() => { localStorage.setItem("sb_player", playerId); }, [playerId]);
  useEffect(() => { localStorage.setItem("sb_host", serverHost); }, [serverHost]);
  useEffect(() => { localStorage.setItem("sb_checked", JSON.stringify(checked)); }, [checked]);

  // --- SYNC ---
  const syncUrl = `http://${serverHost}:3001/state`;

  const pushState = useCallback(async (newChecked) => {
    try {
      setConnStatus("syncing");
      await fetch(syncUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checked: newChecked }),
      });
      setConnStatus("ok");
    } catch {
      setConnStatus("error");
    }
  }, [syncUrl]);

  const pullState = useCallback(async () => {
    try {
      const res = await fetch(syncUrl);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (JSON.stringify(data.checked) !== lastSyncRef.current) {
        lastSyncRef.current = JSON.stringify(data.checked);
        setChecked(data.checked || {});
      }
      setConnStatus("ok");
    } catch {
      setConnStatus("error");
    }
  }, [syncUrl]);

  // Poll every 1.5 seconds after setup is done
  useEffect(() => {
    if (showSetup) return;
    pullState();
    syncTimerRef.current = setInterval(pullState, 1500);
    return () => clearInterval(syncTimerRef.current);
  }, [showSetup, pullState]);

  // --- TOGGLE TASK ---
  function toggleTask(key) {
    setChecked(prev => {
      const entry = prev[key] || {};
      const isChecked = !!entry[playerId];
      const updated = {
        ...prev,
        [key]: { ...entry, [playerId]: !isChecked },
      };
      pushState(updated);
      return updated;
    });
  }

  // --- DATA ---
  const allNonBodyTasks = SCENARIOS.flatMap(s =>
    s.nonBodyTasks.map((task, i) => ({
      scenario: s.title,
      scenarioId: s.id,
      color: s.color,
      task,
      taskIndex: i,
      key: taskKey(s.id, i),
      layer: task.startsWith("Faceplate") ? "faceplate"
        : task.startsWith("Face anim") ? "face_anim"
          : "external",
    }))
  );

  const filteredTasks = filterLayer === "all"
    ? allNonBodyTasks
    : allNonBodyTasks.filter(t => t.layer === filterLayer);

  const totalTasks = allNonBodyTasks.length;

  const p1Done = allNonBodyTasks.filter(t => checked[t.key]?.p1).length;
  const p2Done = allNonBodyTasks.filter(t => checked[t.key]?.p2).length;

  const stats = {
    total: totalTasks,
    faceplate: allNonBodyTasks.filter(t => t.layer === "faceplate").length,
    face_anim: allNonBodyTasks.filter(t => t.layer === "face_anim").length,
    external: allNonBodyTasks.filter(t => t.layer === "external").length,
  };

  const connDot = {
    offline: { color: "#555", title: "Offline — no server" },
    syncing: { color: "#F7931A", title: "Syncing..." },
    ok: { color: "#4CAF50", title: "Connected" },
    error: { color: "#F44336", title: "Cannot reach server" },
  }[connStatus];

  return (
    <div style={{
      fontFamily: "'Courier New', monospace",
      background: "#1A1A1A",
      color: "#E0E0E0",
      minHeight: "100vh",
      padding: 0,
    }}>
      {showSetup && (
        <SetupPanel
          playerId={playerId}
          serverHost={serverHost}
          onSetPlayer={p => setPlayerId(p)}
          onSetHost={h => setServerHost(h)}
          onDone={() => setShowSetup(false)}
        />
      )}

      {/* HEADER */}
      <div style={{
        background: "linear-gradient(135deg, #0D0D0D, #1A2A3A)",
        borderBottom: "3px solid #F7931A",
        padding: "16px 24px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{
            width: 44,
            height: 44,
            background: "#F7931A",
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: 18,
            color: "#000",
            flexShrink: 0,
          }}>
            SB
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 2, color: "#F7931A" }}>
              SUPERBOX STORYBOARD SYSTEM
            </div>
            <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>
              BODY → FACEPLATE → FACE ANIM → EXTERNAL OBJECTS
            </div>
          </div>

          {/* Player badge + connection */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            {/* Progress */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <ProgressBar checked={p1Done} total={totalTasks} color={PLAYERS.p1.color} label="P1" />
              <ProgressBar checked={p2Done} total={totalTasks} color={PLAYERS.p2.color} label="P2" />
            </div>

            {/* Player selector */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {["p1", "p2"].map(pid => (
                <button
                  key={pid}
                  onClick={() => setPlayerId(pid)}
                  style={{
                    background: playerId === pid ? PLAYERS[pid].color : "#222",
                    color: playerId === pid ? "#000" : PLAYERS[pid].color,
                    border: `1.5px solid ${PLAYERS[pid].color}`,
                    borderRadius: 4,
                    padding: "3px 10px",
                    fontSize: 11,
                    fontWeight: 900,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    letterSpacing: 1,
                  }}
                >
                  {PLAYERS[pid].label}
                </button>
              ))}
            </div>

            {/* Sync status */}
            <div
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
              title={connDot.title}
            >
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: connDot.color }} />
              <button
                onClick={() => setShowSetup(true)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#555",
                  fontSize: 10,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  padding: 0,
                }}
              >
                setup
              </button>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          {[
            { id: "strips", label: "Storyboard Strips" },
            { id: "tasks", label: `Tasks (${p1Done + p2Done}/${totalTasks * 2} checked)` },
            { id: "legend", label: "Glyph Legend" },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: activeTab === tab.id ? "#F7931A" : "#2D2D2D",
                color: activeTab === tab.id ? "#000" : "#AAA",
                border: "none",
                borderRadius: 4,
                padding: "7px 14px",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ padding: "16px 24px", maxWidth: 980, margin: "0 auto" }}>

        {/* === STORYBOARD STRIPS === */}
        {activeTab === "strips" && (
          <div>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 16 }}>
              {SCENARIOS.length} scenarios — hover steps for details
            </div>
            {SCENARIOS.map(s => (
              <StoryboardStrip key={s.id} scenario={s} />
            ))}
          </div>
        )}

        {/* === TASKS === */}
        {activeTab === "tasks" && (
          <div>
            {/* Filter buttons */}
            <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
              {[
                { id: "all", label: "All", count: stats.total, color: "#F7931A" },
                { id: "faceplate", label: "Faceplate", count: stats.faceplate, color: LAYER_COLORS.faceplate.border },
                { id: "face_anim", label: "Face Anim", count: stats.face_anim, color: LAYER_COLORS.face_anim.border },
                { id: "external", label: "External", count: stats.external, color: LAYER_COLORS.external.border },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterLayer(f.id)}
                  style={{
                    background: filterLayer === f.id ? f.color : "#2D2D2D",
                    color: filterLayer === f.id ? "#000" : f.color,
                    border: `1.5px solid ${f.color}`,
                    borderRadius: 4,
                    padding: "5px 12px",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {f.label} ({f.count})
                </button>
              ))}

              <div style={{ marginLeft: "auto", display: "flex", gap: 16, fontSize: 11 }}>
                <span style={{ color: PLAYERS.p1.color }}>
                  P1: {filteredTasks.filter(t => checked[t.key]?.p1).length}/{filteredTasks.length}
                </span>
                <span style={{ color: PLAYERS.p2.color }}>
                  P2: {filteredTasks.filter(t => checked[t.key]?.p2).length}/{filteredTasks.length}
                </span>
              </div>
            </div>

            {/* Task list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {filteredTasks.map((t) => {
                const lc = LAYER_COLORS[t.layer];
                const myCheck = !!checked[t.key]?.[playerId];
                const otherPid = playerId === "p1" ? "p2" : "p1";
                const otherCheck = !!checked[t.key]?.[otherPid];
                const bothDone = checked[t.key]?.p1 && checked[t.key]?.p2;

                return (
                  <div
                    key={t.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "7px 12px",
                      background: bothDone ? "#0D1A0D" : lc.bg,
                      border: `1px solid ${bothDone ? "#4CAF5040" : lc.border + "30"}`,
                      borderRadius: 4,
                      borderLeft: `4px solid ${t.color}`,
                      opacity: myCheck && !bothDone ? 0.75 : 1,
                      transition: "all 0.2s",
                    }}
                  >
                    {/* My checkbox */}
                    <button
                      onClick={() => toggleTask(t.key)}
                      title={`Mark as done (${PLAYERS[playerId].label})`}
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        border: `2px solid ${PLAYERS[playerId].color}`,
                        background: myCheck ? PLAYERS[playerId].color : "transparent",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        padding: 0,
                      }}
                    >
                      {myCheck && (
                        <svg width="12" height="12" viewBox="0 0 12 12">
                          <polyline points="2,6 5,9 10,3" stroke="#000" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>

                    {/* Other player indicator */}
                    <div
                      title={`${PLAYERS[otherPid].label}: ${otherCheck ? "done" : "not done"}`}
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        border: `2px solid ${PLAYERS[otherPid].color}`,
                        background: otherCheck ? PLAYERS[otherPid].color : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        opacity: 0.7,
                      }}
                    >
                      {otherCheck && (
                        <svg width="12" height="12" viewBox="0 0 12 12">
                          <polyline points="2,6 5,9 10,3" stroke="#000" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>

                    {/* Scenario badge */}
                    <span style={{
                      fontSize: 10,
                      color: t.color,
                      fontWeight: 700,
                      minWidth: 20,
                      textAlign: "center",
                    }}>
                      #{t.scenarioId}
                    </span>

                    {/* Layer label */}
                    <span style={{
                      fontSize: 9,
                      color: lc.text,
                      opacity: 0.6,
                      textTransform: "uppercase",
                      minWidth: 62,
                    }}>
                      {lc.label}
                    </span>

                    {/* Task text */}
                    <span style={{
                      fontSize: 12,
                      color: bothDone ? "#4CAF50" : lc.text,
                      flex: 1,
                      textDecoration: myCheck ? "line-through" : "none",
                      opacity: myCheck ? 0.6 : 1,
                    }}>
                      {t.task}
                    </span>

                    {/* Both done badge */}
                    {bothDone && (
                      <span style={{
                        fontSize: 9,
                        color: "#4CAF50",
                        fontWeight: 700,
                        letterSpacing: 1,
                        flexShrink: 0,
                      }}>
                        DONE
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ marginTop: 16, fontSize: 10, color: "#555", display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span>
                <span style={{ color: PLAYERS[playerId].color, fontWeight: 700 }}>Left box</span>
                {" "}= your check ({PLAYERS[playerId].label})
              </span>
              <span>
                <span style={{ color: PLAYERS[playerId === "p1" ? "p2" : "p1"].color, fontWeight: 700 }}>Right box</span>
                {" "}= other player's check
              </span>
              <span style={{ color: "#4CAF50" }}>Both checked = DONE</span>
            </div>
          </div>
        )}

        {/* === GLYPH LEGEND === */}
        {activeTab === "legend" && (
          <div>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 16 }}>
              Visual notation system — кожен символ відповідає конкретному стану/дії маскота
            </div>
            {Object.entries({
              "Body Poses": Object.entries(GLYPHS).filter(([k]) => k.startsWith("body_")),
              "Faceplate States": Object.entries(GLYPHS).filter(([k]) => k.startsWith("face_")),
              "Eye Tracking (Face Anim)": Object.entries(GLYPHS).filter(([k]) => k.startsWith("eyes_")),
              "Hands / Appendages": Object.entries(GLYPHS).filter(([k]) => k.startsWith("hand_")),
              "External Objects": Object.entries(GLYPHS).filter(([k]) => k.startsWith("obj_")),
              "Effects & Transitions": Object.entries(GLYPHS).filter(([k]) => k.startsWith("fx_") || k.startsWith("flow_")),
            }).map(([group, items]) => (
              <div key={group} style={{ marginBottom: 16 }}>
                <div style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#F7931A",
                  marginBottom: 6,
                  borderBottom: "1px solid #333",
                  paddingBottom: 4,
                }}>
                  {group}
                </div>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: 4,
                }}>
                  {items.map(([key, val]) => (
                    <div key={key} style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "4px 8px",
                      background: "#222",
                      borderRadius: 3,
                      fontSize: 11,
                    }}>
                      <span style={{ fontSize: 16, minWidth: 30, textAlign: "center" }}>
                        {val.label}
                      </span>
                      <span style={{ color: "#AAA" }}>{val.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div style={{ marginTop: 24 }}>
              <div style={{
                fontSize: 12, fontWeight: 700, color: "#F7931A",
                marginBottom: 8, borderBottom: "1px solid #333", paddingBottom: 4,
              }}>
                Layer Color Coding
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {Object.entries(LAYER_COLORS).map(([key, val]) => (
                  <div key={key} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 16px",
                    background: val.bg,
                    border: `2px solid ${val.border}`,
                    borderRadius: 6,
                  }}>
                    <span style={{ color: val.text, fontWeight: 700, fontSize: 12 }}>
                      {val.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
