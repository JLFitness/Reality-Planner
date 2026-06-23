/** @type {import('tailwindcss').Config} */

// The `slate` (neutral) and `emerald` (accent) ramps below resolve to CSS
// variables instead of fixed hex values. That means every existing
// `bg-slate-900`, `text-emerald-400`, etc. across the app follows whatever the
// chosen theme sets those variables to — so the Appearance picker in Setup can
// restyle the whole app without touching any component. The `<alpha-value>`
// placeholder keeps opacity modifiers like `bg-slate-900/70` working.
const ramp = (prefix) =>
  Object.fromEntries(
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((shade) => [
      shade,
      `rgb(var(--${prefix}-${shade}) / <alpha-value>)`,
    ])
  );

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        slate: ramp('s'),
        emerald: ramp('a'),
      },
      borderRadius: {
        xl: 'var(--rad-xl)',
        '2xl': 'var(--rad-2xl)',
      },
    },
  },
  plugins: [],
};
