'use client'

import { useEffect, useRef, useState } from 'react'
import {
  getPantry,
  savePantry,
  parsePantryChips,
  joinPantryChips,
  mergePantryChips,
} from '@/lib/storage'
import {
  parsePantryText,
  addPantryPreferences,
  mergePantryConstraints,
  getPantryPreferences,
  getPantryConstraints,
  setPantryPreferences,
  setPantryConstraints,
} from '@/lib/pantryParse'
import {
  getCachedCategories,
  groupChipsByCategory,
  categorizeAndCache,
  BUCKET_STYLES,
} from '@/lib/pantryCategories'
import VoiceInput from '@/components/VoiceInput'
import PantryImageUpload from '@/components/PantryImageUpload'
import NavMenu from '@/components/NavMenu'

// Direct-access editor for the persistent pantry. Reachable from NavMenu →
// "Pantry". Chip-list UX with category-grouped sections (Protein, Carbs,
// Vegetables, Fruits, Fats + seeds, Spices + herbs, Sauces + condiments,
// Drinks + wellness, Other). Categories computed by /api/categorize-pantry
// on save and cached in localStorage; canonical pantry storage stays as the
// comma-joined string for back-compat with Daily / Weekly / API surfaces.

// Human-readable labels for the constraint cap keys returned by the
// parse-pantry-text route. Kept here next to the chip rendering since
// nothing else needs them.
const CONSTRAINT_LABEL = {
  maxProteins: 'max proteins',
  maxCarbs: 'max carbs',
  maxVegetables: 'max vegetables',
  maxFruits: 'max fruits',
  maxFats: 'max fats',
}

export default function EditPantry({ onBack, menuOpen, setMenuOpen, onNavigate }) {
  const [chips, setChips] = useState([])
  const [draft, setDraft] = useState('')
  const [categories, setCategories] = useState({})
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [saveError, setSaveError] = useState(null)
  // Which bucket is currently in edit mode (× buttons visible on its items).
  // Only one bucket edits at a time — cleaner than a global toggle, plus less
  // accidental removal. Click the same bucket's pencil to exit, or another
  // bucket's pencil to switch.
  const [editingBucket, setEditingBucket] = useState(null)
  // Smart-parse state: while Haiku is parsing prose, disable Add and show
  // a tiny spinner. The parsed prefs/constraints are surfaced as a small
  // confirmation chip so the user knows their preference / cap was captured.
  const [parsing, setParsing] = useState(false)
  const [lastExtracted, setLastExtracted] = useState(null)
  // Persisted preferences + constraints — shown as deletable chips so the
  // user can review and prune what the AI captured.
  const [savedPrefs, setSavedPrefs] = useState([])
  const [savedCons, setSavedCons] = useState({})
  const inputRef = useRef(null)

  useEffect(() => {
    setChips(parsePantryChips(getPantry()))
    setCategories(getCachedCategories())
    setSavedPrefs(getPantryPreferences())
    setSavedCons(getPantryConstraints())
  }, [])

  async function addFromDraft() {
    if (!draft.trim() || parsing) return
    setParsing(true)
    setLastExtracted(null)
    try {
      const { items, preferences, constraints } = await parsePantryText(draft)
      if (items.length > 0) {
        setChips((prev) => mergePantryChips(prev, items))
      }
      if (preferences.length > 0) {
        const merged = addPantryPreferences(preferences)
        setSavedPrefs(merged)
      }
      if (constraints && Object.keys(constraints).length > 0) {
        const merged = mergePantryConstraints(constraints)
        setSavedCons(merged)
      }
      setLastExtracted({
        items: items.length,
        preferences: preferences.length,
        constraints: Object.keys(constraints || {}).length,
      })
      setDraft('')
    } finally {
      setParsing(false)
      inputRef.current?.focus()
    }
  }

  function removePreference(pref) {
    const next = savedPrefs.filter((p) => p !== pref)
    setSavedPrefs(next)
    setPantryPreferences(next)
  }

  function removeConstraint(key) {
    const next = { ...savedCons }
    delete next[key]
    setSavedCons(next)
    setPantryConstraints(next)
  }

  function addFromVoice(text) {
    setDraft(text)
  }

  function addFromImage(items) {
    setChips((prev) => mergePantryChips(prev, items))
  }

  function removeChip(item) {
    setChips((prev) => prev.filter((c) => c !== item))
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    // Persist chips first (cheap, instant) so a category-API failure can't
    // lose the user's pantry edits. Categorization is best-effort metadata.
    savePantry(joinPantryChips(chips))
    try {
      await categorizeAndCache(chips)
    } catch (err) {
      console.warn('Pantry categorization failed:', err)
      // Non-fatal — chips are saved, categories will retry on next save.
      setSaveError('Saved, but I couldn\'t auto-categorize. Try again later.')
    }
    setSaving(false)
    setSavedFlash(true)
    setTimeout(() => {
      setSavedFlash(false)
      onBack()
    }, 600)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addFromDraft()
    }
  }

  const grouped = groupChipsByCategory(chips, categories)
  const hasOtherBucket = grouped.some((g) => g.bucket === 'other')

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
        Your pantry
      </h1>
      <p className="text-sm text-ruhi-earth leading-relaxed mb-6">
        Everything you have on hand. Used by Daily Check-in and Weekly mode.
        Add or remove anytime — type, speak, or snap a photo.
      </p>

      {/* Quick-add row */}
      <div className="mb-3">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add items, or type a preference like 'I want eggs every morning'"
            aria-label="Add a pantry item or preference"
            disabled={parsing}
            className="flex-1 p-3 rounded-xl bg-white/70 border border-ruhi-earth/40
                       focus:border-ruhi-deep focus:outline-none text-ruhi-deep
                       disabled:opacity-60"
          />
          <button
            type="button"
            onClick={addFromDraft}
            disabled={!draft.trim() || parsing}
            className="px-4 rounded-xl bg-ruhi-deep text-ruhi-cream text-sm
                       hover:bg-ruhi-earth transition-all
                       disabled:opacity-40 disabled:hover:bg-ruhi-deep
                       flex items-center justify-center gap-1.5"
          >
            {parsing && (
              <span aria-hidden="true" className="w-3 h-3 border-2 border-ruhi-cream/40 border-t-ruhi-cream rounded-full animate-spin" />
            )}
            {parsing ? 'Reading…' : 'Add'}
          </button>
        </div>
        <p className="text-[11px] text-ruhi-earth/80 mt-1.5">
          Type items (&ldquo;eggs, kefir&rdquo;), preferences (&ldquo;eggs every morning&rdquo;),
          or weekly caps (&ldquo;just 2 proteins&rdquo;) — Ruhi sorts them.
        </p>
        {lastExtracted && (lastExtracted.preferences > 0 || lastExtracted.constraints > 0) && (
          <p className="text-[11px] text-ruhi-deep mt-1.5 bg-ruhi-sage/20 rounded-md px-2 py-1.5">
            Captured {lastExtracted.items > 0 ? `${lastExtracted.items} item${lastExtracted.items === 1 ? '' : 's'}` : 'no new items'}
            {lastExtracted.preferences > 0 ? `, ${lastExtracted.preferences} preference${lastExtracted.preferences === 1 ? '' : 's'}` : ''}
            {lastExtracted.constraints > 0 ? `, ${lastExtracted.constraints} weekly cap${lastExtracted.constraints === 1 ? '' : 's'}` : ''}
            .
          </p>
        )}
      </div>

      {/* Voice + image input row */}
      <div className="mb-6">
        <div className="flex flex-wrap items-start gap-2">
          <div className="flex-1 min-w-[200px]">
            <VoiceInput
              label="Add by voice"
              placeholder="Or speak the items..."
              initialValue=""
              onResult={addFromVoice}
            />
          </div>
          <PantryImageUpload onConfirm={addFromImage} />
        </div>
      </div>

      {/* Saved preferences + constraints — chip list of soft preferences and
          hard weekly variety caps the AI extracted from prose typed into the
          quick-add box. Both are passed into Daily / Weekly generation as
          context. Click × to forget any of them. */}
      {(savedPrefs.length > 0 || Object.keys(savedCons).length > 0) && (
        <div className="mb-6 bg-white/40 border border-white/60 rounded-2xl p-4">
          <p className="text-xs uppercase tracking-widest text-ruhi-earth mb-2">
            What Ruhi remembers
          </p>
          {savedPrefs.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] uppercase tracking-wide text-ruhi-earth/80 mb-1">Preferences (soft)</p>
              <div className="flex flex-wrap gap-1.5">
                {savedPrefs.map((pref) => (
                  <span
                    key={pref}
                    className="inline-flex items-center gap-1.5 bg-ruhi-sage/20 text-ruhi-deep
                               text-xs rounded-full pl-3 pr-1 py-1"
                  >
                    {pref}
                    <button
                      type="button"
                      onClick={() => removePreference(pref)}
                      aria-label={`Forget preference: ${pref}`}
                      className="w-5 h-5 rounded-full text-ruhi-earth hover:bg-ruhi-rose/40
                                 hover:text-ruhi-deep flex items-center justify-center text-sm leading-none"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
          {Object.keys(savedCons).length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-ruhi-earth/80 mb-1">Weekly caps (hard)</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(savedCons).map(([key, value]) => (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1.5 bg-ruhi-warm/60 text-ruhi-deep
                               text-xs rounded-full pl-3 pr-1 py-1"
                  >
                    {CONSTRAINT_LABEL[key] || key}: {value}
                    <button
                      type="button"
                      onClick={() => removeConstraint(key)}
                      aria-label={`Forget cap: ${CONSTRAINT_LABEL[key] || key}`}
                      className="w-5 h-5 rounded-full text-ruhi-earth hover:bg-ruhi-rose/40
                                 hover:text-ruhi-deep flex items-center justify-center text-sm leading-none"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Categorized chip list */}
      <div className="mb-6">
        <p className="text-xs uppercase tracking-widest text-ruhi-earth mb-3">
          In your pantry ({chips.length})
        </p>
        {chips.length === 0 ? (
          <div className="bg-white/60 rounded-2xl p-5 text-center">
            <p className="text-sm text-ruhi-earth leading-relaxed">
              Empty for now. Add a few staples and Ruhi can plan around them.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.map(({ bucket, label, chips: bucketChips }) => {
              const style = BUCKET_STYLES[bucket] || BUCKET_STYLES.other
              const isEditing = editingBucket === bucket
              return (
                <section
                  key={bucket}
                  className={`rounded-2xl border ${style.sectionBg} ${style.sectionBorder} px-4 py-3.5`}
                >
                  <header className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span aria-hidden="true" className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                      <h3 className="text-sm text-ruhi-deep font-medium">{label}</h3>
                      <span className="text-[11px] text-ruhi-earth/60 tabular-nums">
                        ({bucketChips.length})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingBucket(isEditing ? null : bucket)}
                      aria-label={isEditing ? `Done editing ${label}` : `Edit ${label}`}
                      aria-pressed={isEditing}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors
                                  ${isEditing
                                    ? 'bg-ruhi-deep text-ruhi-cream'
                                    : 'text-ruhi-earth hover:bg-white/60 hover:text-ruhi-deep'}`}
                    >
                      {isEditing ? <CheckIcon /> : <PencilIcon />}
                    </button>
                  </header>
                  <ul className="space-y-0.5">
                    {bucketChips.map((item, idx) => (
                      <li
                        key={`${item}-${idx}`}
                        className="flex items-center gap-2 py-1 px-1.5 rounded-md group"
                      >
                        <span aria-hidden="true" className={`w-1 h-1 rounded-full ${style.dot} flex-shrink-0`} />
                        <span className="flex-1 text-sm text-ruhi-deep">{item}</span>
                        {isEditing && (
                          <button
                            type="button"
                            onClick={() => removeChip(item)}
                            aria-label={`Remove ${item}`}
                            className="w-6 h-6 rounded-full text-ruhi-earth hover:bg-ruhi-rose/30
                                       hover:text-ruhi-deep transition-colors flex items-center
                                       justify-center text-base leading-none"
                          >
                            ×
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
            {hasOtherBucket && (
              <p className="text-[11px] text-ruhi-earth/70 italic mt-1 px-1">
                Items in &ldquo;Other&rdquo; will get sorted into categories on the next save.
              </p>
            )}
          </div>
        )}
      </div>

      {saveError && (
        <p role="alert" className="text-xs text-ruhi-deep bg-ruhi-rose/30 rounded-md px-3 py-2 mb-4">
          {saveError}
        </p>
      )}

      <div className="flex gap-3 mt-auto">
        <button
          onClick={onBack}
          disabled={saving}
          className="flex-1 py-3 rounded-full border border-ruhi-earth/40 text-ruhi-earth
                     hover:bg-white/60 transition-colors text-sm
                     disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-3 rounded-full bg-ruhi-deep text-ruhi-cream text-sm
                     hover:bg-ruhi-earth transition-all shadow-md
                     disabled:opacity-60 disabled:hover:bg-ruhi-deep
                     flex items-center justify-center gap-2"
        >
          {saving && (
            <span aria-hidden="true" className="w-3.5 h-3.5 border-2 border-ruhi-cream/40 border-t-ruhi-cream rounded-full animate-spin" />
          )}
          {saving ? 'Saving + sorting...' : savedFlash ? 'Saved ✓' : 'Save pantry'}
        </button>
      </div>
    </div>
  )
}

function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="5 12 10 17 19 7" />
    </svg>
  )
}
