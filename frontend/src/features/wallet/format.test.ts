import { describe, expect, it } from "vitest";
import { formatInr, isValidAmount } from "./format";

describe("wallet format", () => {
  it("formats rupees from decimal strings with Indian grouping", () => {
    expect(formatInr("400.00")).toBe("₹400.00");
    expect(formatInr("1234567.5")).toBe("₹12,34,567.50");
    expect(formatInr("0")).toBe("₹0.00");
    expect(formatInr("-50.25")).toBe("-₹50.25");
  });

  it("validates top-up amounts", () => {
    expect(isValidAmount("500")).toBe(true);
    expect(isValidAmount("99999999.99")).toBe(true);
    expect(isValidAmount("0")).toBe(false);
    expect(isValidAmount("0.00")).toBe(false);
    expect(isValidAmount("-5")).toBe(false);
    expect(isValidAmount("12.345")).toBe(false);
    expect(isValidAmount("abc")).toBe(false);
    expect(isValidAmount("")).toBe(false);
    expect(isValidAmount("100000000")).toBe(false);
  });
});
