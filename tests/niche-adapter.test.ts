import { describe, it, expect } from "vitest";
import { NicheAdapter } from "../src/adapters/niche-adapter.js";

describe("NicheAdapter", () => {
  const adapter = new NicheAdapter();

  it("lists all available niches", () => {
    const niches = adapter.listNiches();
    expect(niches.length).toBeGreaterThan(0);
    expect(niches.some((n) => n.id === "restaurant")).toBe(true);
    expect(niches.some((n) => n.id === "ecommerce")).toBe(true);
    expect(niches.some((n) => n.id === "saas")).toBe(true);
  });

  it("finds niche by keyword", () => {
    const results = adapter.findNiche("food");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe("restaurant");
  });

  it("gets packages for a niche", () => {
    const packages = adapter.getPackages("restaurant");
    expect(packages.length).toBe(2);
    expect(packages[0].name).toBe("Restaurant Starter Kit");
  });

  it("calculates profitability correctly", () => {
    const packages = adapter.getPackages("restaurant");
    const profit = adapter.calculateProfitability(packages[0]);

    expect(profit.cost).toBe(2.50);
    expect(profit.price).toBe(149);
    expect(profit.profit).toBe(146.50);
    expect(profit.margin).toBeGreaterThan(90);
    expect(profit.roi).toBeGreaterThan(1000);
  });

  it("generates a formatted proposal", () => {
    const proposal = adapter.generateProposal("restaurant");
    expect(proposal).toContain("Restaurant & Food");
    expect(proposal).toContain("Starter Kit");
    expect(proposal).toContain("margin");
  });

  it("returns empty for unknown niche", () => {
    const packages = adapter.getPackages("unknown");
    expect(packages).toEqual([]);
  });

  it("allows adding custom niches", () => {
    adapter.addNiche({
      id: "custom-test",
      name: "Custom Test Niche",
      description: "Test niche for unit testing",
      targetAudience: "Testers",
      priceMultiplier: 1.0,
      commonAssets: ["test asset"],
      servicePackages: [],
    });

    const niche = adapter.getNiche("custom-test");
    expect(niche).toBeDefined();
    expect(niche!.name).toBe("Custom Test Niche");
  });
});
