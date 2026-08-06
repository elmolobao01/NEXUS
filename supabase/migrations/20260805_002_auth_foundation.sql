-- NEXUS AUTH — Sprint 1
-- Executar primeiro em ambiente de homologação.

create extension if not exists pgcrypto;

create table if not exists public.nexus_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active'
    check (status in ('active', 'implementation', 'suspended', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nexus_user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  organization_id uuid references public.nexus_organizations(id) on delete restrict,
  profile text not null
    check (profile in (
      'NEXUS_ROOT',
      'NEXUS_ADMIN',
      'CLIENT_ADMIN',
      'MANAGER',
      'SUPERVISOR',
      'OPERATOR',
      'VIEWER'
    )),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.nexus_organizations enable row level security;
alter table public.nexus_user_profiles enable row level security;

create policy "profile reads own record"
on public.nexus_user_profiles
for select
to authenticated
using (user_id = auth.uid());

create policy "root reads organizations"
on public.nexus_organizations
for select
to authenticated
using (
  exists (
    select 1
    from public.nexus_user_profiles p
    where p.user_id = auth.uid()
      and p.active = true
      and p.profile in ('NEXUS_ROOT', 'NEXUS_ADMIN')
  )
  or id = (
    select p.organization_id
    from public.nexus_user_profiles p
    where p.user_id = auth.uid()
      and p.active = true
    limit 1
  )
);

create index if not exists nexus_user_profiles_organization_idx
  on public.nexus_user_profiles(organization_id);

create index if not exists nexus_user_profiles_profile_idx
  on public.nexus_user_profiles(profile);
