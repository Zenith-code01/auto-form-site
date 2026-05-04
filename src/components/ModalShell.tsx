'use client'

import { ReactNode } from 'react'

type ModalShellProps = {
  title: string
  onClose: () => void
  children: ReactNode
  maxWidthClass?: string
  zClassName?: string
}

export default function ModalShell({
  title,
  onClose,
  children,
  maxWidthClass = 'max-w-5xl',
}: ModalShellProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6">
      <div
        className={`relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl ${maxWidthClass}`}
      >
        {/* 固定头部 */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-8 py-6">
          <h3 className="text-3xl font-bold text-[#111]">{title}</h3>

          <button
            type="button"
            onClick={onClose}
            className="flex h-12 w-12 items-center justify-center rounded-full text-3xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            ×
          </button>
        </div>

        {/* 只有内容滚动 */}
        <div className="overflow-y-auto px-8 py-6">
          {children}
        </div>
      </div>
    </div>
  )
}