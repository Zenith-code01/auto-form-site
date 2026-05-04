'use client'

import { useState } from 'react'

export type Language = 'en' | 'zh'

const STORAGE_KEY = 'auto-form-language'

export function useLanguage() {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'en'
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'zh' || stored === 'en') {
      return stored
    }

    return 'en'
  })

  const setLanguage = (value: Language) => {
    setLanguageState(value)
    window.localStorage.setItem(STORAGE_KEY, value)
  }

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'zh' : 'en')
  }

  return { language, setLanguage, toggleLanguage }
}
