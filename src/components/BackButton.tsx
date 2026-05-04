'use client'

import { useRouter } from 'next/navigation'

type BackButtonProps = {
  label?: string
  className?: string
  onClick?: () => void
}

export default function BackButton({
  label = 'Back',
  className = '',
  onClick,
}: BackButtonProps) {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={onClick || (() => router.back())}
      className={`inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 ${className}`}
    >
      <span className="text-base">←</span>
      <span>{label}</span>
    </button>
  )
}
