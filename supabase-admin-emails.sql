create table if not exists public.admin_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  constraint admin_emails_lowercase_check check (email = lower(trim(email))),
  constraint admin_emails_format_check check (email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$')
);

alter table public.admin_emails enable row level security;

create or replace function public.is_admin_email(check_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_emails
    where email = lower(trim(check_email))
  );
$$;

create or replace function public.is_current_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_emails
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

grant execute on function public.is_admin_email(text) to anon, authenticated;
grant execute on function public.is_current_admin() to authenticated;

drop policy if exists "Admins can read admin emails" on public.admin_emails;
create policy "Admins can read admin emails"
on public.admin_emails
for select
to authenticated
using (public.is_current_admin());

drop policy if exists "Admins can add admin emails" on public.admin_emails;
create policy "Admins can add admin emails"
on public.admin_emails
for insert
to authenticated
with check (public.is_current_admin());

drop policy if exists "Admins can delete admin emails" on public.admin_emails;
create policy "Admins can delete admin emails"
on public.admin_emails
for delete
to authenticated
using (public.is_current_admin());

-- Run this once after replacing the email with your own first administrator email.
-- insert into public.admin_emails (email)
-- values ('your-admin@example.com')
-- on conflict (email) do nothing;
