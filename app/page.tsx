'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/src/lib/supabase'
import LanguageToggle from '@/src/components/LanguageToggle'
import { useLanguage } from '@/src/lib/use-language'

export default function HomePage() {
  const { language, toggleLanguage } = useLanguage()
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const startHref = email ? '/dashboard' : '/login?next=/dashboard'
  const text = {
    en: {
      title: 'Automatic Form Filling System',
      checking: 'Checking login status...',
      loggedIn: 'Logged in',
      intro: 'Local test version is running. Login and cloud database are connected in the next steps.',
      logout: 'Log Out',
      login: 'Log In',
      start: 'Start Filling',
    },
    zh: {
      title: '自动填写表单系统',
      checking: '正在检查登录状态...',
      loggedIn: '已登录',
      intro: '本地测试版本已经启动，下一步接入登录和云端数据库。',
      logout: '退出登录',
      login: '登录',
      start: '开始填写',
    },
  }[language]

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      setEmail(user?.email ?? null)
      setLoading(false)
    }

    getUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null)
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setEmail(null)
  }

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white shadow-lg rounded-2xl p-10 w-full max-w-xl text-center">
        <div className="mb-4 flex justify-end">
          <LanguageToggle language={language} onToggle={toggleLanguage} />
        </div>

        <h1 className="text-3xl font-bold mb-4">{text.title}</h1>

        {loading ? (
          <p className="text-gray-600 mb-6">{text.checking}</p>
        ) : email ? (
          <div className="mb-6">
            <p className="text-green-600 font-medium mb-2">{text.loggedIn}</p>
            <p className="text-gray-700">{email}</p>
          </div>
        ) : (
          <p className="text-gray-600 mb-6">
            {text.intro}
          </p>
        )}

        <div className="flex gap-4 justify-center">
          {email ? (
            <button
              onClick={handleLogout}
              className="px-5 py-3 rounded-xl bg-red-600 text-white hover:bg-red-700"
            >
              {text.logout}
            </button>
          ) : (
            <Link
              href="/login"
              className="px-5 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
            >
              {text.login}
            </Link>
          )}

          <Link
            href={startHref}
            className="px-5 py-3 rounded-xl bg-gray-200 hover:bg-gray-300"
          >
            {text.start}
          </Link>
        </div>
      </div>
    </main>
  )
}
