/** @type {import('tailwindcss').Config} */
export default {
  // Utilities apply only inside .reservations-ui, so they cannot restyle other pages.
  important: ".reservations-ui",
  corePlugins: { preflight: false },
  content: ["./src/features/reservations/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        bg: '#090d16',
        surface: '#0f172a',
        'surface-hover': '#1e293b',
      },
    },
  },
  plugins: [],
};
