import { describe, it, expect } from "vitest";
import { selectPrices } from "./select-prices";

const IDS = {
  monthlyTrial: "pri_mt",
  annualTrial: "pri_at",
  monthlyNoTrial: "pri_mn",
  annualNoTrial: "pri_an",
};

describe("selectPrices", () => {
  it("未用過 trial → trial 價組", () => {
    expect(selectPrices(false, IDS)).toEqual({
      monthly: "pri_mt",
      annual: "pri_at",
      withTrial: true,
    });
  });
  it("已用過 trial → 無 trial 價組", () => {
    expect(selectPrices(true, IDS)).toEqual({
      monthly: "pri_mn",
      annual: "pri_an",
      withTrial: false,
    });
  });
});
