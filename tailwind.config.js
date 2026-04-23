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
          gold: 'var(--ruhi-gold)',
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
