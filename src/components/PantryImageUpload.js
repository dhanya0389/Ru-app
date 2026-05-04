'use client'

import { useRef, useState } from 'react'

/**
 * Camera/photo button that:
 *   1. opens the file picker (mobile auto-uses camera with capture="environment")
 *   2. encodes the chosen image to base64
 *   3. POSTs to /api/parse-pantry-image
 *   4. shows a confirm sheet with the parsed ingredients as removable chips
 *   5. on confirm, calls onConfirm(items: string[]) — the parent merges into pantry
 *
 * Used in three places (per PR #16 spec):
 *   - EditPantry (NavMenu → Pantry)
 *   - DailyCheckin "What's in your kitchen?" field
 *   - WeeklyMode "Your pantry" section
 *
 * Props:
 *   onConfirm — (items: string[]) => void, called with the user-approved chips
 *   compact   — boolean, smaller variant for inline placement next to a textarea
 */
export default function PantryImageUpload({ onConfirm, compact = false }) {
  const fileRef = useRef(null)
  const [stage, setStage] = useState('idle') // 'idle' | 'parsing' | 'review' | 'error'
  const [items, setItems] = useState([])
  const [note, setNote] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)

  function reset() {
    setStage('idle')
    setItems([])
    setNote(null)
    setErrorMsg(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setErrorMsg('That doesn\'t look like an image. Try a JPG or PNG.')
      setStage('error')
      return
    }
    // Quick client-side size guard — server caps too, but failing fast is nicer
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image is too large (over 5MB). Try a smaller photo.')
      setStage('error')
      return
    }

    const localPreview = URL.createObjectURL(file)
    setPreviewUrl(localPreview)
    setStage('parsing')
    setErrorMsg(null)

    try {
      const base64 = await fileToBase64(file)
      const res = await fetch('/api/parse-pantry-image', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType: file.type }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || body.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      const parsed = Array.isArray(data.items) ? data.items : []
      setItems(parsed)
      setNote(typeof data.note === 'string' ? data.note : null)
      setStage('review')
    } catch (err) {
      console.warn('parse-pantry-image failed:', err)
      setErrorMsg(err.message || 'Couldn\'t read that photo. Try again or add items by hand.')
      setStage('error')
    }
  }

  function removeChip(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  function handleConfirm() {
    onConfirm?.(items)
    reset()
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        aria-label="Add pantry items from a photo"
        className={
          compact
            ? `inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full
               bg-white/70 border border-ruhi-earth/40 text-ruhi-deep text-xs
               hover:bg-white hover:shadow-sm transition-all`
            : `inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full
               bg-white/70 border border-ruhi-earth/40 text-ruhi-deep text-sm
               hover:bg-white hover:shadow-sm transition-all`
        }
      >
        <CameraIcon />
        {compact ? 'Photo' : 'Add from photo'}
      </button>

      {stage !== 'idle' && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Pantry photo review"
        >
          <div
            className="w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl bg-ruhi-cream
                       shadow-2xl border-t sm:border border-white/60 max-h-[90vh]
                       overflow-y-auto screen-enter"
          >
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <h2 className="text-base text-ruhi-deep font-medium">
                {stage === 'parsing' && 'Reading your photo...'}
                {stage === 'review' && 'What I see'}
                {stage === 'error' && 'Hmm.'}
              </h2>
              <button
                type="button"
                onClick={reset}
                aria-label="Close"
                className="text-ruhi-earth hover:text-ruhi-deep w-8 h-8 rounded-full
                           hover:bg-white/60 flex items-center justify-center transition-colors"
              >
                <CloseIcon />
              </button>
            </div>

            {previewUrl && (
              <div className="px-5 mb-3">
                <img
                  src={previewUrl}
                  alt="Your pantry photo"
                  className="w-full max-h-48 object-cover rounded-xl"
                />
              </div>
            )}

            {stage === 'parsing' && (
              <div className="px-5 pb-6 flex flex-col items-center gap-3" role="status" aria-live="polite">
                <div aria-hidden="true" className="w-8 h-8 border-[3px] border-ruhi-warm border-t-ruhi-deep rounded-full animate-spin" />
                <p className="text-sm text-ruhi-earth animate-pulse">Identifying ingredients...</p>
              </div>
            )}

            {stage === 'review' && (
              <div className="px-5 pb-5">
                {note && (
                  <p className="text-xs text-ruhi-earth bg-ruhi-peach/30 rounded-md px-3 py-2 mb-3 leading-relaxed">
                    {note}
                  </p>
                )}
                {items.length === 0 ? (
                  <p className="text-sm text-ruhi-earth mb-4">
                    I couldn't identify food in that photo. Try a closer shot
                    or better lighting, or add items by hand instead.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-ruhi-earth mb-2">
                      Tap × to remove anything I got wrong, then add to your pantry.
                    </p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {items.map((item, idx) => (
                        <button
                          key={`${item}-${idx}`}
                          type="button"
                          onClick={() => removeChip(idx)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
                                     bg-white/80 border border-ruhi-earth/40 text-sm text-ruhi-deep
                                     hover:bg-ruhi-rose/20 hover:border-ruhi-deep transition-colors"
                          aria-label={`Remove ${item}`}
                        >
                          <span>{item}</span>
                          <span aria-hidden="true" className="text-ruhi-earth">×</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={reset}
                    className="flex-1 py-2.5 rounded-full border border-ruhi-earth/40 text-ruhi-earth
                               hover:bg-white/60 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={items.length === 0}
                    className="flex-1 py-2.5 rounded-full bg-ruhi-deep text-ruhi-cream text-sm
                               hover:bg-ruhi-earth transition-all shadow-sm
                               disabled:opacity-40 disabled:hover:bg-ruhi-deep"
                  >
                    Add {items.length} item{items.length === 1 ? '' : 's'}
                  </button>
                </div>
              </div>
            )}

            {stage === 'error' && (
              <div className="px-5 pb-5">
                <p className="text-sm text-ruhi-deep bg-ruhi-rose/30 rounded-md px-3 py-2 mb-4">
                  {errorMsg || 'Something went wrong reading the photo.'}
                </p>
                <button
                  type="button"
                  onClick={reset}
                  className="w-full py-2.5 rounded-full bg-ruhi-deep text-ruhi-cream text-sm
                             hover:bg-ruhi-earth transition-all shadow-sm"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // result is "data:image/jpeg;base64,XXXX..." — strip the prefix
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Unexpected reader result'))
        return
      }
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error || new Error('FileReader error'))
    reader.readAsDataURL(file)
  })
}

function CameraIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
