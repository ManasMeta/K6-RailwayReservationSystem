/** @type {import('tailwindcss').Config} */
export default {
  // Utilities apply only inside .reservations-ui, so they cannot restyle other pages.
  important: ".reservations-ui",
  corePlugins: { preflight: false },
  content: ["./src/features/reservations/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // The design tokens from styles.css (see Design.md), so these screens follow dark mode too.
      fontFamily: {
        sans: ["var(--font)"],
      },
      fontWeight: {
        light: "300",
        body: "450",
        strong: "600",
        heading: "650",
      },
      colors: {
        ink: "var(--ink)",
        "ink-soft": "var(--ink-soft)",
        muted: "var(--muted)",
        faint: "var(--faint)",
        canvas: "var(--canvas)",
        "canvas-soft": "var(--canvas-soft)",
        field: "var(--field)",
        hairline: "var(--hairline)",
        "hairline-soft": "var(--hairline-soft)",
        primary: "var(--primary)",
        "primary-hover": "var(--primary-hover)",
        "on-primary": "var(--on-primary)",
        accent: "var(--accent)",
        danger: "var(--danger)",
        "danger-soft": "var(--danger-soft)",
      },
      borderRadius: {
        tile: "16px",
        card: "24px",
        squircle: "30%",
      },
      boxShadow: {
        segment: "var(--segment-shadow)",
        overlay: "var(--overlay-shadow)",
      },
    },
  },
  plugins: [],
};
