'use client'

import { useState, useRef, useEffect } from 'react'

const ERROR_MESSAGES = {
  'not-allowed': 'Mic access blocked. Allow microphone in your browser/system settings, then try again.',
  'service-not-allowed': 'Mic access blocked. Allow microphone in your browser/system settings, then try again.',
  'audio-capture': 'No microphone found. Check that one is connected.',
  'network': 'Voice input needs a network connection. Check your connection.',
  'aborted': null, // user-initiated, don't show
}

export default function VoiceInput({ onResult, placeholder = 'Tap the mic or type...', initialValue = '', label = 'Input field' }) {
  const [listening, setListening] = useState(false)
  const [text, setText] = useState(initialValue)
  const [errorMsg, setErrorMsg] = useState(null)
  const recognitionRef = useRef(null)

  useEffect(() => {
    if (initialValue) setText(initialValue)
  }, [initialValue])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [])

  function startListening() {
    setErrorMsg(null)
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setErrorMsg('Voice input is not supported in this browser. Please type instead.')
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()

    // Keep listening until user stops it
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    let finalTranscript = text

    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          // Append final result
          finalTranscript = finalTranscript
            ? `${finalTranscript}, ${transcript.trim()}`
            : transcript.trim()
          setText(finalTranscript)
          onResult(finalTranscript)
        } else {
          interim = transcript
        }
      }
    }

    recognition.onerror = (event) => {
      // Don't stop for 'no-speech' — just keep listening
      if (event.error === 'no-speech') return
      const message = event.error in ERROR_MESSAGES
        ? ERROR_MESSAGES[event.error]
        : `Voice input failed (${event.error}). Please type instead.`
      if (message) setErrorMsg(message)
      recognitionRef.current = null
      setListening(false)
    }

    recognition.onend = () => {
      // If the session was killed by silence but the user still wants to listen, restart.
      // Use a ref read to avoid stale closure — recognitionRef is only set while active.
      if (recognitionRef.current === recognition) {
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
    setText(e.target.value)
    onResult(e.target.value)
  }

  return (
    <div className="w-full">
      <div className="relative">
        <textarea
          placeholder={placeholder}
          aria-label={label}
          value={text}
          onChange={handleTextChange}
          className="w-full p-3 pr-16 rounded-xl bg-white/60 border border-ruhi-earth/40
                     focus:border-ruhi-deep resize-none h-20"
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
