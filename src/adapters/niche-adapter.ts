import { logger } from "../core/logger.js";

/** Known niche definitions with service packages */
export interface NicheProfile {
  id: string;
  name: string;
  description: string;
  targetAudience: string;
  servicePackages: ServicePackage[];
  commonAssets: string[];
  priceMultiplier: number; // 1.0 = base, >1 = premium niche
}

export interface ServicePackage {
  id: string;
  name: string;
  description: string;
  includes: string[];
  estimatedCostUsd: number;
  suggestedPriceUsd: number;
  margin: number; // percentage
  rooms: string[];
  deliveryItems: string[];
}

/** Pre-built niche profiles that can be instantly adapted */
const NICHE_CATALOG: NicheProfile[] = [
  {
    id: "restaurant",
    name: "Restaurant & Food",
    description: "Local restaurants, cafes, dark kitchens, food delivery brands",
    targetAudience: "Restaurant owners, F&B entrepreneurs",
    priceMultiplier: 1.0,
    commonAssets: ["menu design", "food photography", "social media kit", "delivery app banners"],
    servicePackages: [
      {
        id: "rest-starter",
        name: "Restaurant Starter Kit",
        description: "Essential brand assets for new restaurants",
        includes: ["Logo + brand colors", "Menu design (2 pages)", "5 social media templates", "Google Business profile images"],
        estimatedCostUsd: 2.50,
        suggestedPriceUsd: 149,
        margin: 98.3,
        rooms: ["brainstorm", "image-gen", "ux-ui", "copywriting"],
        deliveryItems: ["logo_files.zip", "menu.pdf", "social_templates.zip", "gbp_images.zip"],
      },
      {
        id: "rest-premium",
        name: "Restaurant Full Brand",
        description: "Complete brand + marketing package",
        includes: ["Full brand identity", "Menu design (8 pages)", "20 social posts", "Video reel (30s)", "Website landing page"],
        estimatedCostUsd: 12.00,
        suggestedPriceUsd: 599,
        margin: 98.0,
        rooms: ["brainstorm", "image-gen", "ux-ui", "copywriting", "video", "code-deploy"],
        deliveryItems: ["brand_kit.zip", "menu.pdf", "social_content.zip", "promo_video.mp4", "website_url"],
      },
    ],
  },
  {
    id: "ecommerce",
    name: "E-commerce & DTC",
    description: "Online stores, dropshipping, DTC brands, product launches",
    targetAudience: "E-commerce entrepreneurs, Shopify store owners",
    priceMultiplier: 1.2,
    commonAssets: ["product shots", "ad creatives", "email templates", "landing pages"],
    servicePackages: [
      {
        id: "ecom-launch",
        name: "Product Launch Kit",
        description: "Everything needed to launch a product online",
        includes: ["10 product images", "5 ad creatives", "Product description copy", "Landing page design"],
        estimatedCostUsd: 4.00,
        suggestedPriceUsd: 249,
        margin: 98.4,
        rooms: ["image-gen", "copywriting", "ux-ui", "code-deploy"],
        deliveryItems: ["product_images.zip", "ad_creatives.zip", "copy.doc", "landing_page_url"],
      },
      {
        id: "ecom-scale",
        name: "E-commerce Scale Package",
        description: "Full marketing suite for scaling",
        includes: ["30 product images", "15 ad creatives", "Email sequence (5 emails)", "Video ad (15s)", "Social media kit"],
        estimatedCostUsd: 18.00,
        suggestedPriceUsd: 899,
        margin: 98.0,
        rooms: ["image-gen", "copywriting", "video", "ux-ui"],
        deliveryItems: ["product_images.zip", "ads.zip", "emails.zip", "video_ad.mp4", "social_kit.zip"],
      },
    ],
  },
  {
    id: "saas",
    name: "SaaS & Tech Startup",
    description: "Software products, apps, tech startups, developer tools",
    targetAudience: "SaaS founders, product managers, CTOs",
    priceMultiplier: 1.5,
    commonAssets: ["UI mockups", "explainer videos", "mascot", "documentation"],
    servicePackages: [
      {
        id: "saas-brand",
        name: "SaaS Brand Kit",
        description: "Brand identity for tech products",
        includes: ["Logo + brand system", "Mascot character", "UI component library concept", "Explainer video script"],
        estimatedCostUsd: 8.00,
        suggestedPriceUsd: 499,
        margin: 98.4,
        rooms: ["brainstorm", "image-gen", "ux-ui", "animation", "copywriting"],
        deliveryItems: ["brand_kit.zip", "mascot_files.zip", "ui_concept.fig", "video_script.doc"],
      },
    ],
  },
  {
    id: "music-artist",
    name: "Music & Entertainment",
    description: "Musicians, bands, labels, event promoters",
    targetAudience: "Independent artists, music labels, event organizers",
    priceMultiplier: 1.1,
    commonAssets: ["album artwork", "music video", "social content", "merchandise designs"],
    servicePackages: [
      {
        id: "music-single",
        name: "Single Release Kit",
        description: "Everything for a single release",
        includes: ["Album artwork (3 variations)", "Lyric video (60s)", "10 social posts", "Press kit"],
        estimatedCostUsd: 6.00,
        suggestedPriceUsd: 349,
        margin: 98.3,
        rooms: ["image-gen", "video", "copywriting", "music-audio"],
        deliveryItems: ["artwork.zip", "lyric_video.mp4", "social_posts.zip", "press_kit.pdf"],
      },
      {
        id: "music-full",
        name: "Music Video Production",
        description: "AI-generated music video with custom visuals",
        includes: ["Music video (2-3 min)", "Behind-the-scenes content", "Thumbnail variations", "Social teaser clips (3)"],
        estimatedCostUsd: 25.00,
        suggestedPriceUsd: 999,
        margin: 97.5,
        rooms: ["video", "image-gen", "music-audio", "copywriting"],
        deliveryItems: ["music_video.mp4", "bts_content.zip", "thumbnails.zip", "teasers.zip"],
      },
    ],
  },
  {
    id: "real-estate",
    name: "Real Estate",
    description: "Agencies, property developers, realtors",
    targetAudience: "Real estate agents, property developers",
    priceMultiplier: 1.3,
    commonAssets: ["property renders", "virtual tours", "listing videos", "brochures"],
    servicePackages: [
      {
        id: "realestate-listing",
        name: "Property Listing Package",
        description: "Premium listing content for properties",
        includes: ["Virtual staging (5 rooms)", "Property video (30s)", "Listing description", "Social media ads (3)"],
        estimatedCostUsd: 8.00,
        suggestedPriceUsd: 399,
        margin: 98.0,
        rooms: ["image-gen", "video", "copywriting", "3d-render"],
        deliveryItems: ["staged_images.zip", "property_video.mp4", "listing_copy.doc", "ads.zip"],
      },
    ],
  },
  {
    id: "fitness",
    name: "Fitness & Wellness",
    description: "Gyms, personal trainers, wellness brands, supplement companies",
    targetAudience: "Fitness entrepreneurs, gym owners, wellness coaches",
    priceMultiplier: 1.0,
    commonAssets: ["workout visuals", "transformation content", "supplement labels", "social content"],
    servicePackages: [
      {
        id: "fitness-brand",
        name: "Fitness Brand Launch",
        description: "Complete brand kit for fitness businesses",
        includes: ["Brand identity", "10 social templates", "Workout program PDF design", "Promo video (15s)"],
        estimatedCostUsd: 5.00,
        suggestedPriceUsd: 299,
        margin: 98.3,
        rooms: ["brainstorm", "image-gen", "copywriting", "video", "ux-ui"],
        deliveryItems: ["brand_kit.zip", "social_templates.zip", "program.pdf", "promo_video.mp4"],
      },
    ],
  },
];

/**
 * Client Niche Adapter — auto-generates service packages per niche.
 *
 * Given a client's industry/niche, instantly produces:
 * - Recommended service packages with pricing
 * - Required rooms and estimated costs
 * - Profit margin calculations
 * - Delivery item checklists
 */
export class NicheAdapter {
  private catalog: NicheProfile[];

  constructor() {
    this.catalog = NICHE_CATALOG;
  }

  /** Find matching niches by keyword search */
  findNiche(query: string): NicheProfile[] {
    const lower = query.toLowerCase();
    return this.catalog.filter(
      (n) =>
        n.name.toLowerCase().includes(lower) ||
        n.description.toLowerCase().includes(lower) ||
        n.id.includes(lower)
    );
  }

  /** Get a specific niche by ID */
  getNiche(nicheId: string): NicheProfile | undefined {
    return this.catalog.find((n) => n.id === nicheId);
  }

  /** List all available niches */
  listNiches(): Array<{ id: string; name: string; packageCount: number }> {
    return this.catalog.map((n) => ({
      id: n.id,
      name: n.name,
      packageCount: n.servicePackages.length,
    }));
  }

  /** Get recommended packages for a niche */
  getPackages(nicheId: string): ServicePackage[] {
    const niche = this.getNiche(nicheId);
    return niche?.servicePackages ?? [];
  }

  /** Calculate profitability for a package */
  calculateProfitability(pkg: ServicePackage): {
    cost: number;
    price: number;
    profit: number;
    margin: number;
    roi: number;
  } {
    const profit = pkg.suggestedPriceUsd - pkg.estimatedCostUsd;
    return {
      cost: pkg.estimatedCostUsd,
      price: pkg.suggestedPriceUsd,
      profit,
      margin: (profit / pkg.suggestedPriceUsd) * 100,
      roi: (profit / pkg.estimatedCostUsd) * 100,
    };
  }

  /** Generate a formatted proposal for a niche */
  generateProposal(nicheId: string): string {
    const niche = this.getNiche(nicheId);
    if (!niche) return `Niche "${nicheId}" not found.`;

    let proposal = `\n═══════════════════════════════════════════════\n`;
    proposal += `  ${niche.name} — Service Packages\n`;
    proposal += `═══════════════════════════════════════════════\n\n`;
    proposal += `Target: ${niche.targetAudience}\n`;
    proposal += `Common assets: ${niche.commonAssets.join(", ")}\n\n`;

    for (const pkg of niche.servicePackages) {
      const profit = this.calculateProfitability(pkg);
      proposal += `┌─ ${pkg.name} ─────────────────────────\n`;
      proposal += `│ ${pkg.description}\n`;
      proposal += `│\n`;
      proposal += `│ Includes:\n`;
      for (const item of pkg.includes) {
        proposal += `│   ✓ ${item}\n`;
      }
      proposal += `│\n`;
      proposal += `│ AI Production Cost:  $${profit.cost.toFixed(2)}\n`;
      proposal += `│ Suggested Price:     $${profit.price.toFixed(2)}\n`;
      proposal += `│ Profit:              $${profit.profit.toFixed(2)} (${profit.margin.toFixed(1)}% margin)\n`;
      proposal += `│ ROI:                 ${profit.roi.toFixed(0)}%\n`;
      proposal += `│\n`;
      proposal += `│ Rooms: ${pkg.rooms.join(" → ")}\n`;
      proposal += `│ Deliverables: ${pkg.deliveryItems.join(", ")}\n`;
      proposal += `└────────────────────────────────────────\n\n`;
    }

    return proposal;
  }

  /** Add a custom niche to the catalog */
  addNiche(niche: NicheProfile): void {
    this.catalog.push(niche);
    logger.info(`Niche added: ${niche.name}`, { nicheId: niche.id });
  }
}
