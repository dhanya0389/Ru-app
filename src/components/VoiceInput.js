'use client'

import { useState, useRef, useEffect } from 'react'

export default function VoiceInput({ onResult, placeholder = 'Tap the mic or type...', initialValue = '' }) {
  const [listening, setListening] = useState(false)
  const [text, setText] = useState(initialValue)
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
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice input is not supported in this browser. Please type instead.')
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
      console.warn('Speech recognition error:', event.error)
      setListening(false)
    }

    recognition.onend = () => {
      // If we're still supposed to be listening, restart
      // (browser can kill the session after silence)
      if (recognitionRef.current && listening) {
        try {
          recognition.start()
        } catch (e) {
          // Already started or aborted — that's fine
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
          value={text}
          onChange={handleTextChange}
          className="w-full p-3 pr-14 rounded-xl bg-white/60 border border-ruhi-earth/20
                     focus:border-ruhi-deep focus:outline-none resize-none h-20"
        />
        <button
          onClick={listening ? stopListening : startListening}
          className={`absolute right-3 top-3 w-10 h-10 rounded-full flex items-center justify-center
                      transition-all ${listening
                        ? 'bg-ruhi-rose text-white voice-pulse'
                        : 'bg-ruhi-warm text-ruhi-earth hover:bg-ruhi-earth hover:text-ruhi-cream'
                      }`}
          title={listening ? 'Tap to stop' : 'Tap to speak'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </button>
      </div>
      {listening && (
        <p className="text-xs text-ruhi-rose mt-1 animate-pulse">Listening — tap mic again when done</p>
      )}
    </div>
  )
}
