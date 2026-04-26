// Color palettes — user picks one, app recolors everywhere

// Earth values are tuned so that foreground text meets WCAG AA (≥4.5:1) on cream.
// When changing a theme, verify contrast before shipping.
export const THEMES = {
  earth: {
    label: 'Earth',
    swatch: '#8B7355',
    cream: '#FFF8F0',
    warm: '#F5E6D3',
    rose: '#E8B4B8',
    sage: '#A8C5A0',
    earth: '#735D42', // darkened from #8B7355 for AA contrast
    deep: '#4A3728',
    gold: '#D4A574',
  },
  bloom: {
    label: 'Bloom',
    swatch: '#D4789C',
    cream: '#FFF5F8',
    warm: '#FCE4EC',
    rose: '#F48FB1',
    sage: '#F8BBD0',
    earth: '#C2185B',
    deep: '#880E4F',
    gold: '#E91E63',
  },
  lavender: {
    label: 'Lavender',
    swatch: '#9575CD',
    cream: '#F8F5FF',
    warm: '#EDE7F6',
    rose: '#CE93D8',
    sage: '#B39DDB',
    earth: '#7E57C2',
    deep: '#4A148C',
    gold: '#AB47BC',
  },
  forest: {
    label: 'Forest',
    swatch: '#66BB6A',
    cream: '#F5FFF5',
    warm: '#E8F5E9',
    rose: '#A5D6A7',
    sage: '#81C784',
    earth: '#2E7D32', // darkened from #43A047 for AA contrast
    deep: '#1B5E20',
    gold: '#66BB6A',
  },
  dawn: {
    label: 'Dawn',
    swatch: '#F0A8C4',
    cream: '#FFFBFE',
    warm: '#FDE8EF',
    rose: '#F0A8C4',
    sage: '#B8D8D0',
    earth: '#6D5A7A', // darkened from #9C8AA5 for AA contrast
    deep: '#5D4A66',
    gold: '#EDAE98',
  },
}

const STORAGE_KEY = 'ruhi_theme'

export function getTheme() {
  if (typeof window === 'undefined') return 'earth'
  return localStorage.getItem(STORAGE_KEY) || 'earth'
}

export function setTheme(themeKey) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, themeKey)
  applyTheme(themeKey)
}

export function applyTheme(themeKey) {
  const theme = THEMES[themeKey] || THEMES.earth
  const root = document.documentElement
  root.style.setProperty('--ruhi-cream', theme.cream)
  root.style.setProperty('--ruhi-warm', theme.warm)
  root.style.setProperty('--ruhi-rose', theme.rose)
  root.style.setProperty('--ruhi-sage', theme.sage)
  root.style.setProperty('--ruhi-earth', theme.earth)
  root.style.setProperty('--ruhi-deep', theme.deep)
  root.style.setProperty('--ruhi-gold', theme.gold)
  document.body.style.backgroundColor = theme.cream
}
