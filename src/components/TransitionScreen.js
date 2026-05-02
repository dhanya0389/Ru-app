'use client'

import LotusAccent from '@/components/LotusAccent'
import NavMenu from '@/components/NavMenu'

/**
 * Brief emotional beat between finishing onboarding and the first check-in.
 * One sentence, one CTA. Reuses the calm landing-page rhythm.
 */
export default function TransitionScreen({ onContinue, menuOpen, setMenuOpen, onNavigate }) {
  return (
    <div className="ruhi-bg min-h-screen flex flex-col items-center justify-center px-6 text-center relative z-10">
      <NavMenu open={menuOpen} setOpen={setMenuOpen} onNavigate={onNavigate} />
      {/* Soft glow behind text — same as Landing */}
      <div className="absolute top-1/3 w-64 h-64 bg-ruhi-rose/15 rounded-full blur-3xl" />

      {/* Botanical accent */}
      <LotusAccent
        width={42}
        height={72}
        className="text-ruhi-earth mb-6 screen-enter opacity-80"
      />
      <p className="text-sm tracking-widest text-ruhi-earth uppercase mb-6 screen-enter">
        all set
      </p>
      <h2
        className="font-display text-3xl text-ruhi-deep mb-4 max-w-sm leading-snug screen-enter"
        style={{ animationDelay: '0.1s' }}
      >
        I have everything I need.
      </h2>
      <p
        className="text-ruhi-earth mb-12 max-w-xs leading-relaxed screen-enter"
        style={{ animationDelay: '0.2s' }}
      >
        Ready when you are.
      </p>

      <button
        onClick={onContinue}
        className="bg-ruhi-deep text-ruhi-cream px-10 py-4 rounded-full text-lg
                   hover:bg-ruhi-earth transition-all duration-300 hover:scale-105
                   shadow-lg shadow-ruhi-deep/20 screen-enter"
        style={{ animationDelay: '0.3s' }}
      >
        Begin
      </button>
    </div>
  )
}
