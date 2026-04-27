'use client'

/**
 * Theme-aware botanical motif renderer.
 *
 * Renders a positioned div whose background image is driven by CSS targeting
 * the `data-theme` attribute on the document root (set by applyTheme in
 * src/lib/themes.js). When the user switches theme via ThemePicker, the
 * background-image swaps automatically — no React state, no re-render.
 *
 * Assets live at: public/botanicals/{name}/{theme}.{webp,png}
 * If an asset is missing for a given theme, nothing renders (no broken image).
 *
 * Wire CSS for each motif in globals.css under `/* --- Botanical motifs --- *\/`.
 *
 * Props:
 *   name      — motif identifier matching the folder under public/botanicals/
 *   position  — 'left' | 'right' | 'center-bottom' | 'corner-tr' | 'border'
 *   className — extra Tailwind classes for sizing or fine positioning
 *   ariaLabel — accessibility label; omit to mark decorative (aria-hidden)
 */
export default function BotanicalMotif({
  name,
  position = 'right',
  className = '',
  ariaLabel,
}) {
  const decorative = !ariaLabel
  return (
    <div
      role={decorative ? 'presentation' : 'img'}
      aria-label={ariaLabel}
      aria-hidden={decorative ? 'true' : undefined}
      data-motif={name}
      data-position={position}
      className={`motif motif-${name} motif-pos-${position} ${className}`}
    />
  )
}
