'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/src/lib/supabase'
import BackButton from '@/src/components/BackButton'
import LanguageToggle from '@/src/components/LanguageToggle'
import { useLanguage } from '@/src/lib/use-language'
import { getCurrentAdminUser } from '@/src/lib/admin'

type AdminEmail = {
  id: string
  email: string
  created_at: string
}

export default function AdminPage() {
  const router = useRouter()
  const { language, toggleLanguage } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [currentEmail, setCurrentEmail] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [admins, setAdmins] = useState<AdminEmail[]>([])
  const [message, setMessage] = useState('')

  const text = {
    en: {
      loading: 'Loading administrator emails...',
      back: 'Back',
      title: 'Administrator Emails',
      subtitle: 'Only emails in this list can request a login link and enter the system.',
      inputPlaceholder: 'admin@example.com',
      add: 'Add Administrator',
      adding: 'Adding...',
      empty: 'No administrator emails yet.',
      delete: 'Delete',
      deleting: 'Deleting...',
      current: 'Current account',
      addFailed: 'Failed to add administrator: ',
      deleteFailed: 'Failed to delete administrator: ',
      added: 'Administrator added.',
      deleted: 'Administrator deleted.',
      notAdmin: 'This account is not authorized as an administrator.',
      loadFailed: 'Failed to load administrators: ',
      deleteConfirm: 'Delete this administrator email?',
      selfDeleteBlocked: 'You cannot delete the account you are currently using.',
    },
    zh: {
      loading: '正在加载管理员邮箱...',
      back: '返回',
      title: '管理员邮箱',
      subtitle: '只有此列表中的邮箱可以请求登录链接并进入系统。',
      inputPlaceholder: 'admin@example.com',
      add: '添加管理员',
      adding: '添加中...',
      empty: '暂无管理员邮箱。',
      delete: '删除',
      deleting: '删除中...',
      current: '当前账号',
      addFailed: '添加管理员失败：',
      deleteFailed: '删除管理员失败：',
      added: '管理员已添加。',
      deleted: '管理员已删除。',
      notAdmin: '此账号不是管理员。',
      loadFailed: '读取管理员失败：',
      deleteConfirm: '确定删除这个管理员邮箱吗？',
      selfDeleteBlocked: '不能删除当前正在使用的账号。',
    },
  }[language]

  const loadAdmins = async () => {
    const { data, error } = await supabase
      .from('admin_emails')
      .select('id, email, created_at')
      .order('created_at', { ascending: true })

    if (error) {
      setMessage(text.loadFailed + error.message)
      return
    }

    setAdmins(data || [])
  }

  useEffect(() => {
    const loadData = async () => {
      const { user, isAdmin } = await getCurrentAdminUser()

      if (!user) {
        router.push('/login')
        return
      }

      if (!isAdmin) {
        alert(text.notAdmin)
        await supabase.auth.signOut()
        router.push('/login')
        return
      }

      setCurrentEmail(user.email?.toLowerCase() || '')
      await loadAdmins()
      setLoading(false)
    }

    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, text.notAdmin])

  const handleAddAdmin = async () => {
    const email = newEmail.trim().toLowerCase()

    if (!email) return

    setSaving(true)
    setMessage('')

    const { error } = await supabase.from('admin_emails').insert({ email })

    if (error) {
      setMessage(text.addFailed + error.message)
    } else {
      setNewEmail('')
      setMessage(text.added)
      await loadAdmins()
    }

    setSaving(false)
  }

  const handleDeleteAdmin = async (admin: AdminEmail) => {
    if (admin.email.toLowerCase() === currentEmail) {
      setMessage(text.selfDeleteBlocked)
      return
    }

    const confirmed = window.confirm(`${text.deleteConfirm}\n\n${admin.email}`)
    if (!confirmed) return

    setDeletingId(admin.id)
    setMessage('')

    const { error } = await supabase
      .from('admin_emails')
      .delete()
      .eq('id', admin.id)

    if (error) {
      setMessage(text.deleteFailed + error.message)
    } else {
      setMessage(text.deleted)
      await loadAdmins()
    }

    setDeletingId(null)
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-lg text-gray-600">{text.loading}</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <BackButton label={text.back} />
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-lg">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold">{text.title}</h1>
              <p className="mt-3 text-gray-600">{text.subtitle}</p>
            </div>
            <LanguageToggle language={language} onToggle={toggleLanguage} />
          </div>

          <div className="mb-6 flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  handleAddAdmin()
                }
              }}
              placeholder={text.inputPlaceholder}
              className="min-h-12 flex-1 rounded-xl border border-gray-300 px-4 text-base outline-none focus:border-blue-600"
            />
            <button
              type="button"
              onClick={handleAddAdmin}
              disabled={saving || !newEmail.trim()}
              className="rounded-xl bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? text.adding : text.add}
            </button>
          </div>

          {message && (
            <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              {message}
            </div>
          )}

          {admins.length === 0 ? (
            <p className="text-gray-500">{text.empty}</p>
          ) : (
            <div className="space-y-3">
              {admins.map((admin) => (
                <div
                  key={admin.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-gray-900">{admin.email}</p>
                    {admin.email.toLowerCase() === currentEmail && (
                      <p className="mt-1 text-xs text-gray-500">{text.current}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteAdmin(admin)}
                    disabled={deletingId === admin.id || admin.email.toLowerCase() === currentEmail}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {deletingId === admin.id ? text.deleting : text.delete}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
