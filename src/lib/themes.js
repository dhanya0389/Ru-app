// Color palettes — user picks one, app recolors everywhere

// Earth values are tuned so that foreground text meets WCAG AA (≥4.5:1) on cream.
// When changing a theme, verify contrast before shipping.
//
// Per-theme semantic roles for the new accent tokens:
//   teal       — cool counterpoint to the warm base (e.g. lily-pad blue in Earth)
//   terracotta — warm/earthy contrast (rust in Earth, coral in Bloom, moss-tan in Forest)
//   peach      — soft warm highlight (hover/transition states)
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
    teal: '#6B9CA8',
    terracotta: '#C97B5C',
    peach: '#F4C9B0',
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
    teal: '#A0C2B5',       // sage-green — cool foil to pink
    terracotta: '#E07599', // deep coral-rose
    peach: '#FBD9E2',      // light pink-peach
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
    teal: '#8FA3C9',       // periwinkle blue
    terracotta: '#B083C9', // deep violet
    peach: '#DCC5E8',      // light lilac
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
    teal: '#6BA89C',       // blue-green
    terracotta: '#C2A575', // moss-tan
    peach: '#D4E8C9',      // pale green-cream
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
    teal: '#A8B3C9',       // dusty blue
    terracotta: '#D49580', // coral-mauve
    peach: '#F0D5DC',      // soft pink-peach
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

// Convert "#RRGGBB" → "R G B" (space-separated, no commas) so Tailwind's
// `<alpha-value>` placeholder can interpolate opacity at the use site.
function hexToTriplet(hex) {
  const v = hex.replace('#', '')
  const r = parseInt(v.slice(0, 2), 16)
  const g = parseInt(v.slice(2, 4), 16)
  const b = parseInt(v.slice(4, 6), 16)
  return `${r} ${g} ${b}`
}

export function applyTheme(themeKey) {
  const theme = THEMES[themeKey] || THEMES.earth
  const root = document.documentElement
  root.style.setProperty('--ruhi-cream', hexToTriplet(theme.cream))
  root.style.setProperty('--ruhi-warm', hexToTriplet(theme.warm))
  root.style.setProperty('--ruhi-rose', hexToTriplet(theme.rose))
  root.style.setProperty('--ruhi-sage', hexToTriplet(theme.sage))
  root.style.setProperty('--ruhi-earth', hexToTriplet(theme.earth))
  root.style.setProperty('--ruhi-deep', hexToTriplet(theme.deep))
  root.style.setProperty('--ruhi-teal', hexToTriplet(theme.teal))
  root.style.setProperty('--ruhi-terracotta', hexToTriplet(theme.terracotta))
  root.style.setProperty('--ruhi-peach', hexToTriplet(theme.peach))
  // data-theme drives theme-aware botanical motif assets in CSS
  root.setAttribute('data-theme', THEMES[themeKey] ? themeKey : 'earth')
  document.body.style.backgroundColor = theme.cream
}
