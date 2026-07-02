'use client'

import { useRef, useState } from 'react'

// Capped at 5 photos per upload — covers fridge-from-multiple-angles +
// pantry shelf without runaway token cost. Server enforces the same cap.
const MAX_IMAGES = 5
// Picker accepts large raw photos because modern phones produce ~4-8 MB
// HEIC/JPEG files and we don't want the user to manually resize. Each
// photo is compressed in the browser to ~300-700 KB JPEG before upload
// (see compressImage below) so the server payload stays well under
// Vercel's 4.5 MB per-request limit even with 5 photos.
const MAX_FILE_SIZE = 15 * 1024 * 1024  // 15 MB raw per image (pre-compression)
// Target dimensions for client-side compression. 1600 px on the longest
// edge keeps every label readable for the vision model and gets a
// typical 4 MB phone photo down to ~400 KB. JPEG q=0.82 is the sweet
// spot — q=0.9 doubles file size, q=0.7 starts visibly degrading text.
const COMPRESS_MAX_DIM = 1600
const COMPRESS_QUALITY = 0.82

/**
 * Camera/photo button that:
 *   1. opens the native photo picker (both gallery + camera on mobile;
 *      `multiple` lets the user pick up to MAX_IMAGES photos at once)
 *   2. encodes each chosen image to base64 in parallel
 *   3. POSTs the array to /api/parse-pantry-image (single multimodal call —
 *      the model dedupes across all photos)
 *   4. shows a confirm sheet with parsed ingredients as removable chips +
 *      a thumbnail strip of every photo it considered
 *   5. on confirm, calls onConfirm(items: string[]) — parent merges into pantry
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
  const [previews, setPreviews] = useState([]) // [{ url, name }]

  function reset() {
    setStage('idle')
    setItems([])
    setNote(null)
    setErrorMsg(null)
    // Revoke every object URL we created so we don't leak memory across
    // multiple uploads in the same session.
    previews.forEach((p) => URL.revokeObjectURL(p.url))
    setPreviews([])
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleFile(e) {
    const fileList = Array.from(e.target.files || [])
    if (fileList.length === 0) return

    if (fileList.length > MAX_IMAGES) {
      setErrorMsg(`Pick up to ${MAX_IMAGES} photos at a time.`)
      setStage('error')
      return
    }

    // Validate types + sizes up front before we burn time on base64 encoding.
    for (const f of fileList) {
      if (!f.type.startsWith('image/')) {
        setErrorMsg(`"${f.name}" isn't an image. Try JPGs or PNGs.`)
        setStage('error')
        return
      }
      if (f.size > MAX_FILE_SIZE) {
        setErrorMsg(`"${f.name}" is over 15 MB. Try a smaller photo.`)
        setStage('error')
        return
      }
    }

    // Build local previews first so the UI shows thumbnails during the call.
    const localPreviews = fileList.map((f) => ({
      url: URL.createObjectURL(f),
      name: f.name,
    }))
    setPreviews(localPreviews)
    setStage('parsing')
    setErrorMsg(null)

    try {
      // Compress each picked file in the browser before encoding. This is
      // the load-bearing fix for the HTTP 413 errors users were hitting
      // when uploading multiple full-resolution phone photos — base64 of
      // a single 4 MB photo blew past Vercel's 4.5 MB serverless request
      // body cap on its own; 5 of them were never going to fit. After
      // compressImage every photo lands as a ~300-700 KB JPEG, comfortably
      // under both the per-image and total-payload limits the server now
      // enforces. compressImage also normalizes every input to JPEG, which
      // incidentally handles HEIC photos straight from iPhone cameras.
      const encoded = await Promise.all(
        fileList.map(async (f) => {
          const compressed = await compressImage(f)
          return {
            base64: await blobToBase64(compressed),
            mediaType: 'image/jpeg',
          }
        })
      )

      const res = await fetch('/api/parse-pantry-image', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ images: encoded }),
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
      setErrorMsg(err.message || 'Couldn\'t read your photos. Try again or add items by hand.')
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

  const photoCount = previews.length

  return (
    <>
      {/* Native file input — no `capture` attribute so mobile browsers
          show the full picker (gallery + take-new-photo) instead of
          jumping straight into the camera. capture="environment" was
          removed because on some mobile browsers (notably modern Chrome
          on Android and iOS Safari in newer versions) it forces the
          camera app and hides the gallery option entirely, which
          silently broke the "pick 5 photos from your camera roll"
          flow the UI advertises. */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFile}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        aria-label={`Add pantry items from up to ${MAX_IMAGES} photos`}
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
        {compact ? 'Photo' : 'Add from photos'}
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
                {stage === 'parsing' && (photoCount === 1 ? 'Reading your photo...' : `Reading ${photoCount} photos...`)}
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

            {previews.length > 0 && (
              <div className="px-5 mb-3">
                {previews.length === 1 ? (
                  <img
                    src={previews[0].url}
                    alt="Your pantry photo"
                    className="w-full max-h-48 object-cover rounded-xl"
                  />
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {previews.map((p, i) => (
                      <img
                        key={p.url}
                        src={p.url}
                        alt={`Photo ${i + 1}`}
                        className="w-20 h-20 object-cover rounded-lg flex-shrink-0 border border-white/60"
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {stage === 'parsing' && (
              <div className="px-5 pb-6 flex flex-col items-center gap-3" role="status" aria-live="polite">
                <div aria-hidden="true" className="w-8 h-8 border-[3px] border-ruhi-warm border-t-ruhi-deep rounded-full animate-spin" />
                <p className="text-sm text-ruhi-earth animate-pulse">
                  Identifying ingredients{photoCount > 1 ? ' across all photos' : ''}...
                </p>
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
                    I couldn&apos;t identify food in {photoCount === 1 ? 'that photo' : 'those photos'}. Try a closer
                    shot or better lighting, or add items by hand instead.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-ruhi-earth mb-2">
                      {photoCount > 1 && (
                        <>Pulled <strong className="text-ruhi-deep">{items.length}</strong> items from{' '}
                        <strong className="text-ruhi-deep">{photoCount}</strong> photos.{' '}</>
                      )}
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

// Browser-side image compression. Decodes via createImageBitmap (handles
// JPEG/PNG/WebP/GIF and HEIC where the browser supports it natively),
// draws onto a downscaled canvas, and re-encodes as JPEG. Output is
// typically 5-10× smaller than the source for phone photos because
// modern cameras shoot at ~12-50 MP and we only need ~2 MP for the
// vision model to read labels reliably.
//
// Failure mode: if the browser can't decode the source (rare — usually
// only old-format HEIC on non-iOS browsers), the returned promise rejects
// and the caller surfaces the error to the user. We deliberately do NOT
// fall back to the uncompressed file: that would just re-introduce the
// 413 errors we're fixing.
async function compressImage(
  file,
  { maxDim = COMPRESS_MAX_DIM, quality = COMPRESS_QUALITY } = {}
) {
  const bitmap = await createImageBitmap(file)
  try {
    const { width: srcW, height: srcH } = bitmap
    const scale = Math.min(1, maxDim / Math.max(srcW, srcH))
    const dstW = Math.max(1, Math.round(srcW * scale))
    const dstH = Math.max(1, Math.round(srcH * scale))

    const canvas = document.createElement('canvas')
    canvas.width = dstW
    canvas.height = dstH
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0, dstW, dstH)

    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('canvas toBlob returned null'))),
        'image/jpeg',
        quality
      )
    })
  } finally {
    // createImageBitmap allocates a GPU-backed bitmap; close it explicitly
    // so memory is released even if the user uploads many photos in a
    // row without leaving the screen.
    bitmap.close?.()
  }
}

function blobToBase64(blob) {
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
    reader.readAsDataURL(blob)
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
