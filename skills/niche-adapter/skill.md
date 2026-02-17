# Client Niche Adapter Skill

## Description
Auto-analyze a client's industry niche and generate customized service packages with pricing,
room assignments, cost estimates, and delivery checklists. Instantly adapts AiUnit71's
production capabilities to any market vertical.

## Capabilities
- Niche detection from client website or description
- Service package generation with tiered pricing
- Profitability analysis (cost vs. suggested price)
- Room requirement mapping
- Competitor price benchmarking
- Upsell/cross-sell suggestions

## Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| niche_id | string | no | - | Known niche ID (restaurant, ecommerce, saas, etc.) |
| client_description | string | no | - | Free-text description of client's business |
| client_url | string | no | - | Client website URL for auto-detection |
| budget_range | string | no | "mid" | Client budget: low, mid, high, enterprise |
| include_upsells | boolean | no | true | Include upsell suggestions |

## Pipeline

### Step 1: Niche Detection (Room: brainstorm)
- If niche_id provided: load from catalog directly
- If client_description provided: classify into known niche via LLM
- If client_url provided: scrape and analyze website to determine niche

```
Model Selection:
1. Catalog lookup: FREE (no LLM needed)
2. Text classification: Local glm-4.7-flash (FREE)
3. Website analysis: google/gemini-2.0-flash ($0.0001/1k)
```

### Step 2: Package Generation (Room: cost-routing)
- Select relevant packages from niche catalog
- Adjust pricing based on budget_range
- Calculate exact AI production costs per package
- Determine required rooms and agent assignments

### Step 3: Profitability Analysis (Room: cost-routing)
For each package, compute:
- AI production cost (sum of all model calls + API costs)
- Suggested client price (based on market rate ÷ 3-10×)
- Profit margin percentage
- ROI per package
- Break-even volume

### Step 4: Proposal Generation (Room: copywriting)
- Format professional proposal document
- Include package comparisons
- Add upsell recommendations
- Generate pricing table

## Supported Niches
| Niche ID | Name | Packages |
|----------|------|----------|
| restaurant | Restaurant & Food | 2 |
| ecommerce | E-commerce & DTC | 2 |
| saas | SaaS & Tech Startup | 1 |
| music-artist | Music & Entertainment | 2 |
| real-estate | Real Estate | 1 |
| fitness | Fitness & Wellness | 1 |

## Example Usage
```json
{
  "niche_id": "restaurant",
  "budget_range": "mid",
  "include_upsells": true
}
```

## Example Output
```
═══════════════════════════════════════════════
  Restaurant & Food — Service Packages
═══════════════════════════════════════════════

┌─ Restaurant Starter Kit ─────────────────────
│ AI Cost: $2.50 → Suggested Price: $149
│ Profit: $146.50 (98.3% margin)
│ ROI: 5860%
└──────────────────────────────────────────────
```

## Cost Estimate
- Niche detection: FREE (catalog lookup or local LLM)
- Package generation: FREE (algorithmic)
- Proposal text: $0.00 - $0.01
- Total: < $0.01

## Tags
niche, adapter, pricing, packages, sales, proposal, automation
