import { supabase } from '@/src/lib/supabase'

export async function isAdminEmailAllowed(email: string) {
  const normalizedEmail = email.trim().toLowerCase()

  if (!normalizedEmail) {
    return { allowed: false, error: null }
  }

  const { data, error } = await supabase.rpc('is_admin_email', {
    check_email: normalizedEmail,
  })

  return {
    allowed: Boolean(data),
    error,
  }
}

export async function getCurrentAdminUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, isAdmin: false, error: null }
  }

  const { data, error } = await supabase.rpc('is_current_admin')

  return {
    user,
    isAdmin: Boolean(data),
    error,
  }
}
