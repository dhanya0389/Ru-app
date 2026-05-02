'use client'

import { practitioners } from '@/lib/practitioners'
import NavMenu from '@/components/NavMenu'

// Alphabetical by surname — no grouping. The 10 practitioners whose work
// grounds every Ruhi recommendation. Educational-only disclaimer in the
// footer; product copy elsewhere avoids the phrases "scientifically proven"
// or "clinically proven" so this page can carry honest framing without
// contradiction.

export default function Sources({ onBack, menuOpen, setMenuOpen, onNavigate }) {
  const sorted = [...practitioners].sort((a, b) =>
    a.surname.localeCompare(b.surname),
  )

  return (
    <div className="ruhi-bg min-h-screen flex flex-col px-6 py-6 max-w-md mx-auto relative z-10">
      <NavMenu open={menuOpen} setOpen={setMenuOpen} onNavigate={onNavigate} />

      <button
        onClick={onBack}
        className="text-sm text-ruhi-earth hover:text-ruhi-deep transition-colors mb-4 self-start"
      >
        <span aria-hidden="true">←</span> Back
      </button>

      <h1 className="font-display text-3xl text-ruhi-deep mb-2">
        The 10 Practitioners
      </h1>
      <p className="text-sm text-ruhi-earth leading-relaxed mb-6">
        Ruhi's recommendations are grounded in the work of these clinicians and
        researchers.
      </p>

      <ul className="flex flex-col gap-4 mb-8">
        {sorted.map((p) => (
          <li
            key={p.id}
            className="bg-white/70 rounded-2xl p-5 border border-white/60 shadow-sm"
          >
            <p className="font-display text-lg text-ruhi-deep">
              {p.name}, {p.credential}
            </p>
            <p className="text-sm italic text-ruhi-earth mt-0.5">{p.work}</p>
            <p className="text-sm text-ruhi-deep leading-relaxed mt-2">
              {p.contribution}
            </p>
          </li>
        ))}
      </ul>

      <p className="text-xs text-ruhi-earth/80 leading-relaxed text-center mb-2">
        Educational only — not medical advice. Consult a clinician for personal
        decisions.
      </p>
    </div>
  )
}
