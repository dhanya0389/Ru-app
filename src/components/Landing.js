'use client'

export default function Landing({ onStart }) {
  return (
    <div className="ruhi-bg min-h-screen flex flex-col items-center justify-center px-6 text-center relative z-10">
      {/* Soft glow behind title */}
      <div className="absolute top-1/3 w-64 h-64 bg-ruhi-rose/20 rounded-full blur-3xl" />

      <p className="text-sm tracking-widest text-ruhi-earth uppercase mb-4 screen-enter">
        a personal health system
      </p>
      <h1 className="font-display text-6xl text-ruhi-deep mb-6 screen-enter" style={{ animationDelay: '0.1s' }}>
        Ruhi
      </h1>
      <p className="text-xl text-ruhi-earth mb-3 screen-enter" style={{ animationDelay: '0.2s' }}>
        Your body already knows what it needs.
      </p>
      <p className="text-ruhi-earth mb-12 max-w-sm leading-relaxed screen-enter" style={{ animationDelay: '0.3s' }}>
        Build a system around your cycle, your energy, and your kitchen —
        so you never have to guess what to eat, how to move, or why you feel
        the way you do.
      </p>
      <button
        onClick={onStart}
        className="bg-ruhi-deep text-ruhi-cream px-10 py-4 rounded-full text-lg
                   hover:bg-ruhi-earth transition-all duration-300 hover:scale-105
                   shadow-lg shadow-ruhi-deep/20 screen-enter"
        style={{ animationDelay: '0.4s' }}
      >
        Let's build your system
      </button>
    </div>
  )
}
