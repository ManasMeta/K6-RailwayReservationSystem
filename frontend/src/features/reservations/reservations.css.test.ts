import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "reservations.css"), "utf-8");

// jsdom does not lay out CSS, so this guards the rule that broke the cancel dialog in a real browser:
// an animated ancestor that keeps any transform (even translateY(0)) becomes the containing block of
// position: fixed descendants, so the dialog overlay stretched to the page height and the dialog
// ended up off screen.
describe("reservations.css", () => {
  it("the fade-in animation leaves no transform behind", () => {
    const keyframes = css.match(/@keyframes fadeIn\s*{[\s\S]*?\n}/)?.[0] ?? "";
    expect(keyframes).toMatch(/to\s*{[^}]*transform:\s*none/);
    expect(keyframes).not.toMatch(/translateY\(0\)/);
  });

  it("the fade-in animation does not hold its end state", () => {
    const rule = css.match(/\.reservations-ui \.animate-fade-in\s*{[\s\S]*?}/)?.[0] ?? "";
    expect(rule).toContain("animation:");
    expect(rule).not.toMatch(/forwards|both/);
  });
});
