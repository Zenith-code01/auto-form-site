'use client'

import type { Language } from '@/src/lib/use-language'

type LanguageToggleProps = {
  language: Language
  onToggle: () => void
  className?: string
}

export default function LanguageToggle({
  language,
  onToggle,
  className = '',
}: LanguageToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`rounded-xl border bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 ${className}`}
    >
      {language === 'en' ? '中文' : 'English'}
    </button>
  )
}
