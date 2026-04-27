/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ruhi: {
          cream: 'var(--ruhi-cream)',
          warm: 'var(--ruhi-warm)',
          rose: 'var(--ruhi-rose)',
          sage: 'var(--ruhi-sage)',
          earth: 'var(--ruhi-earth)',
          deep: 'var(--ruhi-deep)',
          teal: 'var(--ruhi-teal)',
          terracotta: 'var(--ruhi-terracotta)',
          peach: 'var(--ruhi-peach)',
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
