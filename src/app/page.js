'use client'

import { useEffect, useState } from 'react'
import { isOnboardingComplete, getProfile, clearProfile } from '@/lib/storage'
import { getWeeklyPlan, clearWeeklyPlan } from '@/lib/weeklyPlan'
import { clearEntries as clearJournal } from '@/lib/journal'
import Landing from '@/components/Landing'
import Onboarding from '@/components/Onboarding'
import TransitionScreen from '@/components/TransitionScreen'
import DailyCheckin from '@/components/DailyCheckin'
import WeeklyMode from '@/components/WeeklyMode'
import Sources from '@/components/Sources'
import EditPantry from '@/components/EditPantry'
import JournalScreen from '@/components/JournalScreen'

// ISO date (YYYY-MM-DD) for "today" in local time.
// Used to decide whether a saved weekly plan is still current.
function todayLocalISO() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

export default function Home() {
  const [screen, setScreen] = useState('loading')
  const [editStep, setEditStep] = useState(null)
  // NavMenu open state lives here so we can re-open it after a single-section
  // save returns to Daily Check-in (chained-edit flow).
  const [menuOpen, setMenuOpen] = useState(false)
  // Where to return to after closing the Sources screen (depends on which
  // surface launched it — Daily Check-in cards vs. Weekly recipe view).
  const [sourcesReturnTo, setSourcesReturnTo] = useState('checkin')

  useEffect(() => {
    if (!isOnboardingComplete()) {
      setScreen('landing')
      return
    }
    // Smart default: returning users land on Weekly mode if they have a
    // current plan that includes today (start ≤ today ≤ last day). Otherwise
    // land on Daily Check-in. Top tabs let the user flip between the two on
    // either screen. Replaces the old Monday-only check now that users pick
    // arbitrary planning windows.
    const plan = getWeeklyPlan()
    const today = todayLocalISO()
    const lastDay = plan?.days?.[plan.days.length - 1]?.date
    const hasCurrentPlan = plan && plan.weekOf <= today && lastDay >= today
    setScreen(hasCurrentPlan ? 'weekly' : 'checkin')
  }, [])

  // Centralized navigation entrypoint shared with NavMenu.
  // target: 'today' | 'welcome' | 'reset' | { type: 'edit', step: number }
  function goTo(target) {
    setMenuOpen(false)
    if (target === 'today') {
      setScreen('checkin')
      return
    }
    if (target === 'weekly') {
      setScreen('weekly')
      return
    }
    if (target === 'sources') {
      // Remember the launching surface so the Back button returns there
      // instead of always defaulting to one screen. Welcome doesn't show the
      // Sources entry today, so we only need to track the two app surfaces.
      setSourcesReturnTo(screen === 'weekly' ? 'weekly' : 'checkin')
      setScreen('sources')
      return
    }
    if (target === 'pantry') {
      // Reuse the same return-to memory so closing the pantry editor sends
      // you back to whichever surface launched it.
      setSourcesReturnTo(screen === 'weekly' ? 'weekly' : 'checkin')
      setScreen('pantry')
      return
    }
    if (target === 'journal') {
      setSourcesReturnTo(screen === 'weekly' ? 'weekly' : 'checkin')
      setScreen('journal')
      return
    }
    if (target === 'welcome') {
      setScreen('landing')
      return
    }
    if (target === 'reset') {
      // Clear everything that's keyed to a user identity. Pantry intentionally
      // persists — it's an inventory, not user state, and the user explicitly
      // wanted it kept across resets unless cleared via a separate affordance.
      // Pantry-categories cache (ruhi_pantry_categories) is keyed by item
      // names → buckets, so it stays valid for the preserved pantry items.
      clearProfile()
      clearJournal()
      clearWeeklyPlan()
      // Opt-ins (seedCycling, bodyDataTier, weeklyMode) live under their own
      // key in lib/weeklyPlan; no exported clearer, so remove directly.
      if (typeof window !== 'undefined') {
        localStorage.removeItem('ruhi_optins')
      }
      setScreen('landing')
      return
    }
    if (target && target.type === 'edit') {
      setEditStep(target.step)
      setScreen('edit-section')
    }
  }

  // After single-section save or cancel, return to Daily Check-in with the
  // menu re-opened so the user can chain another edit.
  function exitEditSection() {
    setScreen('checkin')
    setMenuOpen(true)
  }

  if (screen === 'loading') {
    return <div className="min-h-screen bg-ruhi-cream" />
  }

  if (screen === 'landing') {
    return (
      <Landing
        onStart={() => setScreen('onboarding')}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        onNavigate={goTo}
      />
    )
  }

  if (screen === 'onboarding') {
    return (
      <Onboarding
        onComplete={() => setScreen('transition')}
      />
    )
  }

  if (screen === 'edit-section') {
    return (
      <Onboarding
        initialProfile={getProfile()}
        editSection={editStep}
        onSaveSection={exitEditSection}
        onCancelSection={exitEditSection}
      />
    )
  }

  if (screen === 'transition') {
    return (
      <TransitionScreen
        // New users land on Weekly mode after onboarding — the weekly Sunday
        // plan is the core product, daily check-in is the off-script fallback.
        onContinue={() => setScreen('weekly')}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        onNavigate={goTo}
      />
    )
  }

  if (screen === 'checkin') {
    return (
      <DailyCheckin
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        onNavigate={goTo}
      />
    )
  }

  if (screen === 'weekly') {
    return (
      <WeeklyMode
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        onNavigate={goTo}
      />
    )
  }

  if (screen === 'sources') {
    return (
      <Sources
        onBack={() => setScreen(sourcesReturnTo)}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        onNavigate={goTo}
      />
    )
  }

  if (screen === 'pantry') {
    return (
      <EditPantry
        onBack={() => setScreen(sourcesReturnTo)}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        onNavigate={goTo}
      />
    )
  }

  if (screen === 'journal') {
    return (
      <JournalScreen
        onBack={() => setScreen(sourcesReturnTo)}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        onNavigate={goTo}
      />
    )
  }
}
