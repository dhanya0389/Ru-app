'use client'

import { useEffect, useState } from 'react'
import { isOnboardingComplete, getProfile, clearProfile } from '@/lib/storage'
import { getWeeklyPlan } from '@/lib/weeklyPlan'
import Landing from '@/components/Landing'
import Onboarding from '@/components/Onboarding'
import TransitionScreen from '@/components/TransitionScreen'
import DailyCheckin from '@/components/DailyCheckin'
import WeeklyMode from '@/components/WeeklyMode'

// Compute the ISO date (YYYY-MM-DD) of the Monday of THIS week (local time).
// Used to decide whether a saved weekly plan is current or stale.
function getCurrentMonday() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const day = today.getDay() // 0 = Sun, 1 = Mon
  const offsetToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(today)
  monday.setDate(monday.getDate() + offsetToMonday)
  return monday.toISOString().slice(0, 10)
}

export default function Home() {
  const [screen, setScreen] = useState('loading')
  const [editStep, setEditStep] = useState(null)
  // NavMenu open state lives here so we can re-open it after a single-section
  // save returns to Daily Check-in (chained-edit flow).
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!isOnboardingComplete()) {
      setScreen('landing')
      return
    }
    // Smart default: returning users land on Weekly mode if they have a
    // current plan for THIS week (so they can see today's assigned meal,
    // shopping list, etc.). Otherwise land on Daily Check-in. Top tabs let
    // the user flip between the two on either screen.
    const plan = getWeeklyPlan()
    const hasCurrentPlan = plan && plan.weekOf === getCurrentMonday()
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
    if (target === 'welcome') {
      setScreen('landing')
      return
    }
    if (target === 'reset') {
      clearProfile()
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
}
