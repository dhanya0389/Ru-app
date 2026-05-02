/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // CSS variables hold space-separated RGB triplets (e.g. "168 197 160")
        // so the `<alpha-value>` placeholder lets `bg-ruhi-warm/60` etc. render
        // with real opacity instead of silently falling back to gray-200.
        ruhi: {
          cream: 'rgb(var(--ruhi-cream) / <alpha-value>)',
          warm: 'rgb(var(--ruhi-warm) / <alpha-value>)',
          rose: 'rgb(var(--ruhi-rose) / <alpha-value>)',
          sage: 'rgb(var(--ruhi-sage) / <alpha-value>)',
          earth: 'rgb(var(--ruhi-earth) / <alpha-value>)',
          deep: 'rgb(var(--ruhi-deep) / <alpha-value>)',
          teal: 'rgb(var(--ruhi-teal) / <alpha-value>)',
          terracotta: 'rgb(var(--ruhi-terracotta) / <alpha-value>)',
          peach: 'rgb(var(--ruhi-peach) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
