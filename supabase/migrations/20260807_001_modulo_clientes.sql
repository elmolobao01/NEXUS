-- ============================================================
-- NEXUS 1.7 — MÓDULO CLIENTES
-- Executar no SQL Editor após as migrations de autenticação.
-- ============================================================

create table if not exists public.nexus_clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique
    references public.nexus_organizations(id) on delete cascade,
  legal_name text not null,
  trade_name text,
  document_type text not null default 'CNPJ',
  document_number text unique,
  email text,
  phone text,
  segment text not null,
  status text not null default 'implementation'
    check (status in ('prospect', 'implementation', 'active', 'suspended', 'cancelled')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nexus_clients_segment_idx
  on public.nexus_clients(segment);

create index if not exists nexus_clients_status_idx
  on public.nexus_clients(status);

create index if not exists nexus_clients_created_at_idx
  on public.nexus_clients(created_at desc);

alter table public.nexus_clients enable row level security;

create or replace function public.nexus_current_user_is_root()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.nexus_user_profiles p
    where p.user_id = auth.uid()
      and p.active = true
      and p.profile in ('NEXUS_ROOT', 'NEXUS_ADMIN')
  );
$$;

revoke all on function public.nexus_current_user_is_root() from public;
grant execute on function public.nexus_current_user_is_root() to authenticated;

drop policy if exists "root reads clients" on public.nexus_clients;
create policy "root reads clients"
on public.nexus_clients
for select
to authenticated
using (public.nexus_current_user_is_root());

drop policy if exists "root inserts clients" on public.nexus_clients;
create policy "root inserts clients"
on public.nexus_clients
for insert
to authenticated
with check (public.nexus_current_user_is_root());

drop policy if exists "root updates clients" on public.nexus_clients;
create policy "root updates clients"
on public.nexus_clients
for update
to authenticated
using (public.nexus_current_user_is_root())
with check (public.nexus_current_user_is_root());

drop policy if exists "root inserts organizations" on public.nexus_organizations;
create policy "root inserts organizations"
on public.nexus_organizations
for insert
to authenticated
with check (public.nexus_current_user_is_root());

drop policy if exists "root updates organizations" on public.nexus_organizations;
create policy "root updates organizations"
on public.nexus_organizations
for update
to authenticated
using (public.nexus_current_user_is_root())
with check (public.nexus_current_user_is_root());

create or replace function public.nexus_create_client(
  p_legal_name text,
  p_trade_name text default null,
  p_document_type text default 'CNPJ',
  p_document_number text default null,
  p_email text default null,
  p_phone text default null,
  p_segment text default 'Educação',
  p_status text default 'implementation',
  p_notes text default null
)
returns setof public.nexus_clients
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_client_id uuid;
  v_slug text;
begin
  if not public.nexus_current_user_is_root() then
    raise exception 'NEXUS_ACCESS_DENIED';
  end if;

  if nullif(trim(p_legal_name), '') is null then
    raise exception 'NEXUS_CLIENT_NAME_REQUIRED';
  end if;

  if p_status not in ('prospect', 'implementation', 'active', 'suspended', 'cancelled') then
    raise exception 'NEXUS_INVALID_CLIENT_STATUS';
  end if;

  v_slug := 'client-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);

  insert into public.nexus_organizations (
    name,
    slug,
    segment,
    status
  )
  values (
    coalesce(nullif(trim(p_trade_name), ''), trim(p_legal_name)),
    v_slug,
    trim(p_segment),
    case
      when p_status = 'active' then 'active'
      when p_status = 'cancelled' then 'cancelled'
      when p_status = 'suspended' then 'suspended'
      else 'implementation'
    end
  )
  returning id into v_org_id;

  insert into public.nexus_clients (
    organization_id,
    legal_name,
    trade_name,
    document_type,
    document_number,
    email,
    phone,
    segment,
    status,
    notes,
    created_by
  )
  values (
    v_org_id,
    trim(p_legal_name),
    nullif(trim(p_trade_name), ''),
    coalesce(nullif(trim(p_document_type), ''), 'CNPJ'),
    nullif(trim(p_document_number), ''),
    nullif(lower(trim(p_email)), ''),
    nullif(trim(p_phone), ''),
    trim(p_segment),
    p_status,
    nullif(trim(p_notes), ''),
    auth.uid()
  )
  returning id into v_client_id;

  return query
  select *
  from public.nexus_clients
  where id = v_client_id;
end;
$$;

revoke all on function public.nexus_create_client(
  text, text, text, text, text, text, text, text, text
) from public;

grant execute on function public.nexus_create_client(
  text, text, text, text, text, text, text, text, text
) to authenticated;

create or replace function public.nexus_update_client_status(
  p_client_id uuid,
  p_status text
)
returns setof public.nexus_clients
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if not public.nexus_current_user_is_root() then
    raise exception 'NEXUS_ACCESS_DENIED';
  end if;

  if p_status not in ('prospect', 'implementation', 'active', 'suspended', 'cancelled') then
    raise exception 'NEXUS_INVALID_CLIENT_STATUS';
  end if;

  update public.nexus_clients
  set
    status = p_status,
    updated_at = now()
  where id = p_client_id
  returning organization_id into v_org_id;

  if v_org_id is null then
    raise exception 'NEXUS_CLIENT_NOT_FOUND';
  end if;

  update public.nexus_organizations
  set
    status = case
      when p_status = 'active' then 'active'
      when p_status = 'cancelled' then 'cancelled'
      when p_status = 'suspended' then 'suspended'
      else 'implementation'
    end,
    updated_at = now()
  where id = v_org_id;

  return query
  select *
  from public.nexus_clients
  where id = p_client_id;
end;
$$;

revoke all on function public.nexus_update_client_status(uuid, text) from public;
grant execute on function public.nexus_update_client_status(uuid, text) to authenticated;
