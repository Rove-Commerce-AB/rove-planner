import { describe, expect, it } from "vitest";
import {
  effectiveHourlyRate,
  parseProjectBillingType,
  validateProjectBilling,
} from "./projectBilling";

describe("parseProjectBillingType", () => {
  it("keeps known values", () => {
    expect(parseProjectBillingType("fixed_price")).toBe("fixed_price");
    expect(parseProjectBillingType("time_and_material")).toBe(
      "time_and_material"
    );
  });

  it("defaults unknown values to time and material", () => {
    expect(parseProjectBillingType(null)).toBe("time_and_material");
    expect(parseProjectBillingType("retainer")).toBe("time_and_material");
  });
});

describe("validateProjectBilling", () => {
  it("requires a positive price for fixed-price projects", () => {
    expect(
      validateProjectBilling({ billingType: "fixed_price", fixedPrice: 250000 })
    ).toBeNull();
    expect(
      validateProjectBilling({ billingType: "fixed_price", fixedPrice: null })
    ).toBe("Price is required for fixed-price projects");
    expect(
      validateProjectBilling({ billingType: "fixed_price", fixedPrice: 0 })
    ).toBe("Price is required for fixed-price projects");
  });

  it("does not require a price for time and material", () => {
    expect(
      validateProjectBilling({
        billingType: "time_and_material",
        fixedPrice: null,
      })
    ).toBeNull();
  });
});

describe("effectiveHourlyRate", () => {
  it("is 0 for fixed-price projects", () => {
    expect(effectiveHourlyRate("fixed_price", 1450)).toBe(0);
    expect(effectiveHourlyRate("fixed_price", null)).toBe(0);
  });

  it("keeps stored rates for time and material", () => {
    expect(effectiveHourlyRate("time_and_material", 1450)).toBe(1450);
    expect(effectiveHourlyRate("time_and_material", null)).toBeNull();
  });
});
