'use client'

import { useState, useRef, useEffect } from 'react'

const ERROR_MESSAGES = {
  'not-allowed': 'Mic access blocked. Allow microphone in your browser/system settings, then try again.',
  'service-not-allowed': 'Mic access blocked. Allow microphone in your browser/system settings, then try again.',
  'audio-capture': 'No microphone found. Check that one is connected.',
  'network': 'Voice input needs a network connection. Check your connection.',
  'aborted': null, // user-initiated, don't show
}

// Dedupe overlapping finals from continuous-mode Web Speech recognition.
// Android Chrome (and some other engines) emit cumulative final results
// for a single utterance — e.g. "I" → "I don't" → "I don't think" all
// arrive marked as `isFinal: true`. The previous implementation appended
// each one with ", ", producing the famous garbled transcript:
//   "I, I don't, I don't, I don't think, I don't think I, ..."
//
// The fix: when one final is a strict prefix of a later final, drop the
// shorter one. Keep only the longest version of each prefix family.
// Empty strings filtered out.
function dedupeFinals(finals) {
  const cleaned = finals.map((s) => s.trim()).filter(Boolean)
  return cleaned.filter((f, idx) => {
    for (let j = idx + 1; j < cleaned.length; j++) {
      // Case-insensitive prefix check — Android sometimes capitalizes
      // mid-word ("I, i don't, I don't think") so we normalize before
      // comparing.
      const a = f.toLowerCase()
      const b = cleaned[j].toLowerCase()
      if (b.startsWith(a)) return false
    }
    return true
  })
}

export default function VoiceInput({
  onResult,
  placeholder = 'Tap the mic or type...',
  initialValue = '',
  label = 'Input field',
  // `tall` mode bumps the textarea height for journal entries — single
  // sentences want a small box, voice journal entries want room to breathe.
  tall = false,
}) {
  const [listening, setListening] = useState(false)
  const [text, setText] = useState(initialValue)
  const [errorMsg, setErrorMsg] = useState(null)
  const recognitionRef = useRef(null)
  // Live mirror of `text` for read inside event handlers — direct closure
  // captures get stale across recognition restarts.
  const textRef = useRef(initialValue)
  // Locked-in transcript from BEFORE the current speech-recognition
  // session. Updated when recognition restarts mid-session (silence
  // timeout). Anything in event.results during the active session is
  // appended to this base.
  const baseTextRef = useRef(initialValue)

  useEffect(() => {
    if (initialValue) {
      setText(initialValue)
      textRef.current = initialValue
    }
  }, [initialValue])

  useEffect(() => {
    textRef.current = text
  }, [text])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [])

  function commitText(next) {
    const cleaned = next.replace(/\s+/g, ' ').trim()
    setText(cleaned)
    textRef.current = cleaned
    onResult(cleaned)
  }

  function startListening() {
    setErrorMsg(null)
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setErrorMsg('Voice input is not supported in this browser. Please type instead.')
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()

    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    // Lock in whatever is in the textbox right now — anything captured
    // during the active session appends to this base.
    baseTextRef.current = textRef.current || ''

    recognition.onresult = (event) => {
      const finals = []
      let interim = ''
      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finals.push(transcript)
        } else {
          interim += transcript + ' '
        }
      }
      // Drop final fragments that are a prefix of a later final — fixes
      // the cumulative-final duplication bug on Android Chrome.
      const deduped = dedupeFinals(finals)
      const sessionText = [...deduped, interim].map((s) => s.trim()).filter(Boolean).join(' ')
      const combined = [baseTextRef.current, sessionText].filter(Boolean).join(' ')
      commitText(combined)
    }

    recognition.onerror = (event) => {
      // 'no-speech' just means a silent stretch — keep the session alive,
      // the engine will resume on the next utterance.
      if (event.error === 'no-speech') return
      const message = event.error in ERROR_MESSAGES
        ? ERROR_MESSAGES[event.error]
        : `Voice input failed (${event.error}). Please type instead.`
      if (message) setErrorMsg(message)
      recognitionRef.current = null
      setListening(false)
    }

    recognition.onend = () => {
      // Recognition self-ended (silence timeout) but the user still wants
      // to listen → restart. Lock in current text as the new base so
      // event.results from the new session don't double-count what's
      // already in the textbox.
      if (recognitionRef.current === recognition) {
        baseTextRef.current = textRef.current || ''
        try {
          recognition.start()
        } catch (e) {
          recognitionRef.current = null
          setListening(false)
        }
      }
    }

    recognitionRef.current = recognition
    setListening(true)

    try {
      recognition.start()
    } catch (e) {
      console.warn('Could not start speech recognition:', e)
      setErrorMsg('Could not start voice input. Please type instead.')
      recognitionRef.current = null
      setListening(false)
    }
  }

  function stopListening() {
    setListening(false)
    if (recognitionRef.current) {
      recognitionRef.current.abort()
      recognitionRef.current = null
    }
  }

  function handleTextChange(e) {
    const next = e.target.value
    setText(next)
    textRef.current = next
    onResult(next)
  }

  return (
    <div className="w-full">
      <div className="relative">
        <textarea
          placeholder={placeholder}
          aria-label={label}
          value={text}
          onChange={handleTextChange}
          className={`w-full p-3 pr-16 rounded-xl bg-white/60 border border-ruhi-earth/40
                     focus:border-ruhi-deep resize-none ${tall ? 'min-h-[180px]' : 'h-20'}`}
        />
        <button
          onClick={listening ? stopListening : startListening}
          aria-label={listening ? 'Stop voice input' : 'Start voice input'}
          aria-pressed={listening}
          className={`absolute right-2 top-2 w-11 h-11 rounded-full flex items-center justify-center
                      transition-all ${listening
                        ? 'bg-ruhi-deep text-ruhi-cream voice-pulse'
                        : 'bg-ruhi-warm text-ruhi-deep hover:bg-ruhi-earth hover:text-ruhi-cream'
                      }`}
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </button>
      </div>
      {listening && !errorMsg && (
        <p role="status" className="text-xs text-ruhi-deep mt-1 animate-pulse">Listening — tap mic again when done</p>
      )}
      {errorMsg && (
        <p role="alert" className="text-xs text-ruhi-deep mt-1 bg-ruhi-rose/30 rounded-md px-2 py-1">{errorMsg}</p>
      )}
    </div>
  )
}
