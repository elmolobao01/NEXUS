-- NEXUS Fase 3.1 — Núcleo real da organização, unidades e permissões
alter table public.nexus_organizations
  add column if not exists legal_name text,
  add column if not exists document_type text default 'CNPJ',
  add column if not exists document_number text,
  add column if not exists logo_url text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists settings jsonb not null default '{}'::jsonb;

create unique index if not exists nexus_organizations_document_uidx
  on public.nexus_organizations(document_number)
  where document_number is not null and document_number <> '';

create table if not exists public.nexus_organization_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.nexus_organizations(id) on delete cascade,
  name text not null,
  code text,
  is_main boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.nexus_user_unit_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.nexus_organizations(id) on delete cascade,
  unit_id uuid not null references public.nexus_organization_units(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(user_id, unit_id)
);

alter table public.nexus_organization_units enable row level security;
alter table public.nexus_user_unit_access enable row level security;

drop policy if exists "organization units scoped read" on public.nexus_organization_units;
create policy "organization units scoped read" on public.nexus_organization_units
for select to authenticated using (
  public.nexus_current_user_is_root() or exists (
    select 1 from public.nexus_user_profiles p
    where p.user_id = auth.uid() and p.active = true
      and p.organization_id = nexus_organization_units.organization_id
  )
);

drop policy if exists "user unit access scoped read" on public.nexus_user_unit_access;
create policy "user unit access scoped read" on public.nexus_user_unit_access
for select to authenticated using (
  public.nexus_current_user_is_root() or user_id = auth.uid() or exists (
    select 1 from public.nexus_user_profiles p
    where p.user_id = auth.uid() and p.active = true
      and p.organization_id = nexus_user_unit_access.organization_id
      and p.profile in ('CLIENT_ADMIN','MANAGER')
  )
);

-- Garante uma unidade matriz para organizações já existentes.
insert into public.nexus_organization_units (organization_id, name, code, is_main)
select o.id, 'Unidade Matriz', 'MATRIZ', true
from public.nexus_organizations o
where not exists (
  select 1 from public.nexus_organization_units u where u.organization_id = o.id
);
