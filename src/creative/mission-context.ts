/**
 * MissionContext — the living document that carries all creative constraints,
 * brand specifications, and technical requirements through the production pipeline.
 *
 * Based on AiUnit71 Architecture Specification v1.0, Section 7.
 *
 * The MissionContext is the single source of truth for all agents.
 * It gets enriched at each phase and provides the hook system with data
 * for automatic context injection, validation, and constraint enforcement.
 */

// ─── Brand ──────────────────────────────────────────────────────────

export interface BrandColors {
  primary: string;
  secondary?: string;
  accent?: string;
  neutral?: string[];
}

export interface BrandSpec {
  name: string;
  colors: BrandColors;
  fonts?: string[];
  mood?: string[];
  /** References to uploaded brand assets (e.g. "artifact://brand_guide.pdf") */
  references?: string[];
  /** Visual anti-patterns to avoid */
  anti_patterns?: string[];
}

// ─── Technical ──────────────────────────────────────────────────────

export interface ImageFormat {
  name: string;
  w: number;
  h: number;
  aspect: string;
}

export interface HeroContainer {
  width: number;
  height: number;
  text_zone?: string;
  image_zone?: string;
}

export interface TechnicalSpec {
  viewport?: { desktop: number; mobile: number };
  hero_container?: HeroContainer;
  required_formats: ImageFormat[];
  file_format?: "webp" | "png" | "jpg" | "svg";
  max_file_size_kb?: number;
}

// ─── Style Constraints ──────────────────────────────────────────────

export interface StyleConstraints {
  no_stock_feel?: boolean;
  no_text_in_image?: boolean;
  transparent_bg_needed?: boolean;
  safe_zone_for_text?: string;
  /** Run Anti-Slop Engine on all generated artifacts */
  anti_slop?: boolean;
  /** Custom exclusions */
  exclusions?: string[];
}

// ─── Client Taste Profile ────────────────────────────────────────────

export interface ClientTasteProfile {
  color_temperature?: "warm" | "cool" | "neutral";
  contrast?: "high" | "medium" | "low";
  composition?: "symmetric" | "asymmetric" | "rule-of-thirds";
  lighting_preference?: string;
  human_presence?: string;
  /** Additional preference notes */
  notes?: string;
}

// ─── Deliverable ─────────────────────────────────────────────────────

export type DeliverableStatus = "pending" | "in_progress" | "approved" | "rejected" | "delivered";

export interface Deliverable {
  id: string;
  name: string;
  status: DeliverableStatus;
  priority: number;
  format?: ImageFormat;
  /** Reference to the generated artifact (file path or URL) */
  artifactRef?: string;
  /** Quality score (0-100) */
  qualityScore?: number;
}

// ─── Budget ──────────────────────────────────────────────────────────

export interface MissionBudget {
  total: number;
  spent: number;
  reserved: number;
  currency: "USD";
}

// ─── Mission Context ──────────────────────────────────────────────────

export type MissionType =
  | "landing_page"
  | "smm_campaign"
  | "brand_identity"
  | "product_visualization"
  | "video_production"
  | "ui_prototype"
  | "content_package"
  | "custom";

export type MissionStatus =
  | "initializing"
  | "briefing"
  | "brainstorming"
  | "in_progress"
  | "review"
  | "approved"
  | "delivered"
  | "cancelled";

export interface MissionContext {
  mission: {
    id: string;
    type: MissionType;
    client: string;
    status: MissionStatus;
    created: string; // ISO timestamp
    budget: MissionBudget;
    deliverables: Deliverable[];
  };

  brand: BrandSpec;
  technical: TechnicalSpec;
  style_constraints: StyleConstraints;
  client_taste_profile: ClientTasteProfile;

  /** Arbitrary metadata added during the pipeline */
  meta?: Record<string, unknown>;
}

// ─── Mission Context Builder ──────────────────────────────────────────

/**
 * Build a MissionContext from partial data.
 * Applies sensible defaults for any missing fields.
 */
export function buildMissionContext(
  partial: PartialMissionContext
): MissionContext {
  const now = new Date().toISOString();

  return {
    mission: {
      id: partial.mission?.id ?? `mission-${Date.now()}`,
      type: partial.mission?.type ?? "custom",
      client: partial.mission?.client ?? "Unknown Client",
      status: partial.mission?.status ?? "initializing",
      created: partial.mission?.created ?? now,
      budget: {
        total: partial.mission?.budget?.total ?? 0,
        spent: partial.mission?.budget?.spent ?? 0,
        reserved: partial.mission?.budget?.reserved ?? 0,
        currency: "USD",
      },
      deliverables: partial.mission?.deliverables ?? [],
    },

    brand: {
      name: partial.brand?.name ?? "Unknown Brand",
      colors: {
        primary: partial.brand?.colors?.primary ?? "#000000",
        secondary: partial.brand?.colors?.secondary,
        accent: partial.brand?.colors?.accent,
        neutral: partial.brand?.colors?.neutral,
      },
      fonts: partial.brand?.fonts,
      mood: partial.brand?.mood,
      references: partial.brand?.references,
      anti_patterns: partial.brand?.anti_patterns,
    },

    technical: {
      viewport: partial.technical?.viewport,
      hero_container: partial.technical?.hero_container,
      required_formats: partial.technical?.required_formats ?? [],
      file_format: partial.technical?.file_format ?? "webp",
      max_file_size_kb: partial.technical?.max_file_size_kb,
    },

    style_constraints: {
      no_stock_feel: partial.style_constraints?.no_stock_feel ?? false,
      no_text_in_image: partial.style_constraints?.no_text_in_image ?? false,
      transparent_bg_needed: partial.style_constraints?.transparent_bg_needed ?? false,
      safe_zone_for_text: partial.style_constraints?.safe_zone_for_text,
      anti_slop: partial.style_constraints?.anti_slop ?? true,
      exclusions: partial.style_constraints?.exclusions ?? [],
    },

    client_taste_profile: {
      color_temperature: partial.client_taste_profile?.color_temperature,
      contrast: partial.client_taste_profile?.contrast,
      composition: partial.client_taste_profile?.composition,
      lighting_preference: partial.client_taste_profile?.lighting_preference,
      human_presence: partial.client_taste_profile?.human_presence,
      notes: partial.client_taste_profile?.notes,
    },

    meta: partial.meta ?? {},
  };
}

/** Partial version for constructing contexts incrementally */
export type PartialMissionContext = {
  mission?: Partial<MissionContext["mission"]>;
  brand?: Partial<BrandSpec> & { colors?: Partial<BrandColors> };
  technical?: Partial<TechnicalSpec>;
  style_constraints?: Partial<StyleConstraints>;
  client_taste_profile?: Partial<ClientTasteProfile>;
  meta?: Record<string, unknown>;
};

// ─── Mission Context Helpers ──────────────────────────────────────────

/**
 * Update deliverable status in a MissionContext (immutably).
 */
export function updateDeliverable(
  ctx: MissionContext,
  id: string,
  update: Partial<Deliverable>
): MissionContext {
  return {
    ...ctx,
    mission: {
      ...ctx.mission,
      deliverables: ctx.mission.deliverables.map((d) =>
        d.id === id ? { ...d, ...update } : d
      ),
    },
  };
}

/**
 * Record a cost against the mission budget (immutably).
 */
export function recordMissionCost(
  ctx: MissionContext,
  costUsd: number
): MissionContext {
  return {
    ...ctx,
    mission: {
      ...ctx.mission,
      budget: {
        ...ctx.mission.budget,
        spent: ctx.mission.budget.spent + costUsd,
      },
    },
  };
}

/**
 * Get remaining budget in USD.
 */
export function getRemainingBudget(ctx: MissionContext): number {
  const { total, spent, reserved } = ctx.mission.budget;
  return total - spent - reserved;
}

/**
 * Serialize MissionContext to compact JSON string for agent context injection.
 */
export function serializeMissionContext(ctx: MissionContext): string {
  return JSON.stringify(ctx, null, 2);
}

/**
 * Extract a minimal context summary for prompt injection.
 * Returns only the fields most relevant for creative generation.
 */
export function extractCreativeConstraints(ctx: MissionContext): string {
  const lines: string[] = [];

  lines.push(`Client: ${ctx.brand.name}`);
  lines.push(`Brand Colors: primary=${ctx.brand.colors.primary}${ctx.brand.colors.secondary ? `, secondary=${ctx.brand.colors.secondary}` : ""}${ctx.brand.colors.accent ? `, accent=${ctx.brand.colors.accent}` : ""}`);

  if (ctx.brand.mood?.length) {
    lines.push(`Brand Mood: ${ctx.brand.mood.join(", ")}`);
  }

  if (ctx.brand.anti_patterns?.length) {
    lines.push(`Avoid: ${ctx.brand.anti_patterns.join(", ")}`);
  }

  if (ctx.style_constraints.no_text_in_image) {
    lines.push("Constraint: NO text in generated images");
  }

  if (ctx.style_constraints.safe_zone_for_text) {
    lines.push(`Safe zone for text overlay: ${ctx.style_constraints.safe_zone_for_text}`);
  }

  if (ctx.style_constraints.exclusions?.length) {
    lines.push(`Exclusions: ${ctx.style_constraints.exclusions.join(", ")}`);
  }

  if (ctx.client_taste_profile.lighting_preference) {
    lines.push(`Lighting: ${ctx.client_taste_profile.lighting_preference}`);
  }

  if (ctx.client_taste_profile.composition) {
    lines.push(`Composition: ${ctx.client_taste_profile.composition}`);
  }

  if (ctx.technical.required_formats.length) {
    const formats = ctx.technical.required_formats.map((f) => `${f.name} (${f.w}x${f.h})`).join(", ");
    lines.push(`Required formats: ${formats}`);
  }

  return lines.join("\n");
}
