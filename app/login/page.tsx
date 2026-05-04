'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/src/lib/supabase'
import LanguageToggle from '@/src/components/LanguageToggle'
import { useLanguage } from '@/src/lib/use-language'
import { isAdminEmailAllowed } from '@/src/lib/admin'

const DEFAULT_REDIRECT_PATH = '/dashboard'

function getSafeNextPath() {
  const nextPath = new URLSearchParams(window.location.search).get('next')

  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//')) {
    return DEFAULT_REDIRECT_PATH
  }

  return nextPath
}

function getSiteOrigin() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '')

  return configuredUrl || window.location.origin
}

export default function LoginPage() {
  const { language, toggleLanguage } = useLanguage()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [notice, setNotice] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const text = {
    en: {
      title: 'Log In',
      emailPlaceholder: 'Enter admin email',
      sending: 'Sending...',
      send: 'Send Login Link',
      wait: 'Try again in',
      seconds: 's',
      loginFailed: 'Login failed: ',
      sent: 'Login email sent. Please check your inbox.',
      notAdmin: 'This email is not authorized as an administrator.',
      checkFailed: 'Admin verification failed: ',
      rateLimited:
        'Too many login emails were requested. Please wait a few minutes before trying again.',
    },
    zh: {
      title: '登录',
      emailPlaceholder: '输入管理员邮箱',
      sending: '发送中...',
      send: '发送登录链接',
      wait: '请等待',
      seconds: '秒',
      loginFailed: '登录失败：',
      sent: '登录邮件已发送，请检查邮箱。',
      notAdmin: '此邮箱不是管理员邮箱。',
      checkFailed: '管理员验证失败：',
      rateLimited: '登录邮件请求太频繁了。请等待几分钟后再试。',
    },
  }[language]

  useEffect(() => {
    if (cooldown <= 0) return

    const timer = window.setInterval(() => {
      setCooldown((seconds) => Math.max(seconds - 1, 0))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [cooldown])

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail || loading || cooldown > 0) return

    setLoading(true)
    setNotice(null)

    const { allowed, error: adminError } = await isAdminEmailAllowed(normalizedEmail)

    if (adminError) {
      setLoading(false)
      setNotice({ type: 'error', message: text.checkFailed + adminError.message })
      return
    }

    if (!allowed) {
      setLoading(false)
      setNotice({ type: 'error', message: text.notAdmin })
      return
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: `${getSiteOrigin()}${getSafeNextPath()}`,
      },
    })

    const errorMessage = error?.message ?? ''
    const isRateLimited = /rate limit|too many/i.test(errorMessage)

    setCooldown(isRateLimited ? 300 : 60)
    setLoading(false)

    if (error) {
      setNotice({
        type: 'error',
        message: isRateLimited ? text.rateLimited : text.loginFailed + error.message,
      })
    } else {
      setNotice({ type: 'success', message: text.sent })
    }
  }

  const buttonLabel = loading
    ? text.sending
    : cooldown > 0
      ? `${text.wait} ${cooldown}${text.seconds}`
      : text.send

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <div className="mb-4 flex justify-end">
          <LanguageToggle language={language} onToggle={toggleLanguage} />
        </div>

        <h1 className="text-2xl font-bold mb-4">{text.title}</h1>

        <input
          type="email"
          placeholder={text.emailPlaceholder}
          className="w-full border p-3 rounded mb-4"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setNotice(null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              handleLogin()
            }
          }}
        />

        <button
          type="button"
          onClick={handleLogin}
          disabled={loading || cooldown > 0 || !email.trim()}
          className="w-full bg-blue-600 text-white py-3 rounded disabled:opacity-50"
        >
          {buttonLabel}
        </button>

        {notice && (
          <p
            className={`mt-4 rounded border px-3 py-2 text-sm ${
              notice.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {notice.message}
          </p>
        )}
      </div>
    </main>
  )
}
