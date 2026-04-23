'use client'

import { useEffect } from 'react'
import { getTheme, applyTheme } from '@/lib/themes'

export default function ThemeLoader() {
  useEffect(() => {
    applyTheme(getTheme())
  }, [])

  return null
}
