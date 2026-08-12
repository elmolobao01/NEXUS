-- ============================================================
-- NEXUS Fase 3.2 — Usuários, perfis, permissões e unidades
-- Executar após 20260810_003_nucleo_organizacao_multiempresa.sql
-- ============================================================

alter table public.nexus_user_profiles
  add column if not exists full_name text,
  add column if not exists role_title text,
  add column if not exists phone text,
  add column if not exists permissions jsonb not null default '{}'::jsonb;

create index if not exists nexus_user_profiles_org_active_idx
  on public.nexus_user_profiles(organization_id, active);

-- Helper SECURITY DEFINER evita recursão de RLS ao avaliar a própria tabela de perfis.
create or replace function public.nexus_current_user_can_manage_org(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.nexus_current_user_is_root() or exists (
    select 1 from public.nexus_user_profiles p
    where p.user_id = auth.uid()
      and p.active = true
      and p.organization_id = p_organization_id
      and p.profile in ('CLIENT_ADMIN', 'MANAGER')
  );
$$;

revoke all on function public.nexus_current_user_can_manage_org(uuid) from public;
grant execute on function public.nexus_current_user_can_manage_org(uuid) to authenticated;

-- Leitura de usuários por escopo: próprio usuário, ROOT/NEXUS_ADMIN ou gestores da organização.
drop policy if exists "profiles read own" on public.nexus_user_profiles;
drop policy if exists "profile reads own record" on public.nexus_user_profiles;
drop policy if exists "profiles scoped read" on public.nexus_user_profiles;
create policy "profiles scoped read"
on public.nexus_user_profiles
for select
to authenticated
using (
  user_id = auth.uid()
  or public.nexus_current_user_can_manage_org(organization_id)
);

-- CLIENT_ADMIN/MANAGER podem administrar unidades da própria organização.
drop policy if exists "organization units scoped insert" on public.nexus_organization_units;
create policy "organization units scoped insert"
on public.nexus_organization_units
for insert
to authenticated
with check (
  public.nexus_current_user_is_root()
  or exists (
    select 1 from public.nexus_user_profiles p
    where p.user_id = auth.uid()
      and p.active = true
      and p.organization_id = nexus_organization_units.organization_id
      and p.profile in ('CLIENT_ADMIN', 'MANAGER')
  )
);

drop policy if exists "organization units scoped update" on public.nexus_organization_units;
create policy "organization units scoped update"
on public.nexus_organization_units
for update
to authenticated
using (
  public.nexus_current_user_is_root()
  or exists (
    select 1 from public.nexus_user_profiles p
    where p.user_id = auth.uid()
      and p.active = true
      and p.organization_id = nexus_organization_units.organization_id
      and p.profile in ('CLIENT_ADMIN', 'MANAGER')
  )
)
with check (
  public.nexus_current_user_is_root()
  or exists (
    select 1 from public.nexus_user_profiles p
    where p.user_id = auth.uid()
      and p.active = true
      and p.organization_id = nexus_organization_units.organization_id
      and p.profile in ('CLIENT_ADMIN', 'MANAGER')
  )
);

-- Retorna os usuários visíveis para o solicitante sem expor auth.users diretamente ao cliente.
create or replace function public.nexus_list_organization_users(p_organization_id uuid default null)
returns table (
  user_id uuid,
  email text,
  full_name text,
  role_title text,
  phone text,
  profile text,
  active boolean,
  organization_id uuid,
  permissions jsonb,
  unit_ids uuid[]
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_requester public.nexus_user_profiles%rowtype;
  v_org_id uuid;
begin
  select * into v_requester
  from public.nexus_user_profiles
  where user_id = auth.uid() and active = true
  limit 1;

  if v_requester.user_id is null then
    raise exception 'NEXUS_ACCESS_DENIED';
  end if;

  if v_requester.profile in ('NEXUS_ROOT', 'NEXUS_ADMIN') then
    v_org_id := coalesce(p_organization_id, v_requester.organization_id);
  elsif v_requester.profile in ('CLIENT_ADMIN', 'MANAGER') then
    v_org_id := v_requester.organization_id;
    if p_organization_id is not null and p_organization_id <> v_org_id then
      raise exception 'NEXUS_ACCESS_DENIED';
    end if;
  else
    raise exception 'NEXUS_ACCESS_DENIED';
  end if;

  return query
  select
    p.user_id,
    u.email::text,
    p.full_name,
    p.role_title,
    p.phone,
    p.profile,
    p.active,
    p.organization_id,
    coalesce(p.permissions, '{}'::jsonb),
    coalesce(array_agg(ua.unit_id) filter (where ua.active = true and ua.unit_id is not null), '{}'::uuid[])
  from public.nexus_user_profiles p
  join auth.users u on u.id = p.user_id
  left join public.nexus_user_unit_access ua
    on ua.user_id = p.user_id
   and ua.organization_id = p.organization_id
   and ua.active = true
  where p.organization_id = v_org_id
  group by p.user_id, u.email, p.full_name, p.role_title, p.phone, p.profile, p.active, p.organization_id, p.permissions
  order by coalesce(p.full_name, u.email::text);
end;
$$;

revoke all on function public.nexus_list_organization_users(uuid) from public;
grant execute on function public.nexus_list_organization_users(uuid) to authenticated;

-- Cria/atualiza o perfil NEXUS após o usuário existir no Supabase Auth.
create or replace function public.nexus_provision_user_profile(
  p_user_id uuid,
  p_organization_id uuid,
  p_profile text,
  p_full_name text default null,
  p_role_title text default null,
  p_phone text default null,
  p_permissions jsonb default '{}'::jsonb,
  p_unit_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester public.nexus_user_profiles%rowtype;
  v_target_org uuid;
  v_unit uuid;
begin
  select * into v_requester
  from public.nexus_user_profiles
  where user_id = auth.uid() and active = true
  limit 1;

  if v_requester.user_id is null then
    raise exception 'NEXUS_ACCESS_DENIED';
  end if;

  if p_profile not in ('CLIENT_ADMIN','MANAGER','SUPERVISOR','OPERATOR','VIEWER') then
    raise exception 'NEXUS_INVALID_PROFILE';
  end if;

  if v_requester.profile in ('NEXUS_ROOT','NEXUS_ADMIN') then
    v_target_org := p_organization_id;
  elsif v_requester.profile = 'CLIENT_ADMIN' then
    v_target_org := v_requester.organization_id;
    if p_organization_id <> v_target_org then
      raise exception 'NEXUS_ACCESS_DENIED';
    end if;
    -- Cliente não pode criar outro CLIENT_ADMIN nesta fase; ROOT controla o responsável contratual.
    if p_profile = 'CLIENT_ADMIN' then
      raise exception 'NEXUS_ROOT_REQUIRED_FOR_CLIENT_ADMIN';
    end if;
  else
    raise exception 'NEXUS_ACCESS_DENIED';
  end if;

  if not exists (select 1 from public.nexus_organizations where id = v_target_org) then
    raise exception 'NEXUS_ORGANIZATION_NOT_FOUND';
  end if;

  insert into public.nexus_user_profiles (
    user_id, organization_id, profile, active, full_name, role_title, phone, permissions
  ) values (
    p_user_id, v_target_org, p_profile, true,
    nullif(trim(p_full_name), ''), nullif(trim(p_role_title), ''),
    nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''),
    coalesce(p_permissions, '{}'::jsonb)
  )
  on conflict (user_id) do update set
    organization_id = excluded.organization_id,
    profile = excluded.profile,
    active = true,
    full_name = excluded.full_name,
    role_title = excluded.role_title,
    phone = excluded.phone,
    permissions = excluded.permissions,
    updated_at = now();

  update public.nexus_user_unit_access
  set active = false
  where user_id = p_user_id and organization_id = v_target_org;

  foreach v_unit in array coalesce(p_unit_ids, '{}'::uuid[])
  loop
    if exists (
      select 1 from public.nexus_organization_units
      where id = v_unit and organization_id = v_target_org and active = true
    ) then
      insert into public.nexus_user_unit_access (user_id, organization_id, unit_id, active)
      values (p_user_id, v_target_org, v_unit, true)
      on conflict (user_id, unit_id) do update set active = true;
    end if;
  end loop;
end;
$$;

revoke all on function public.nexus_provision_user_profile(uuid, uuid, text, text, text, text, jsonb, uuid[]) from public;
grant execute on function public.nexus_provision_user_profile(uuid, uuid, text, text, text, text, jsonb, uuid[]) to authenticated;

create or replace function public.nexus_update_user_access(
  p_user_id uuid,
  p_profile text,
  p_active boolean,
  p_full_name text default null,
  p_role_title text default null,
  p_phone text default null,
  p_permissions jsonb default '{}'::jsonb,
  p_unit_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester public.nexus_user_profiles%rowtype;
  v_target public.nexus_user_profiles%rowtype;
  v_unit uuid;
begin
  select * into v_requester from public.nexus_user_profiles where user_id = auth.uid() and active = true limit 1;
  select * into v_target from public.nexus_user_profiles where user_id = p_user_id limit 1;

  if v_requester.user_id is null or v_target.user_id is null then
    raise exception 'NEXUS_ACCESS_DENIED';
  end if;

  if p_profile not in ('CLIENT_ADMIN','MANAGER','SUPERVISOR','OPERATOR','VIEWER') then
    raise exception 'NEXUS_INVALID_PROFILE';
  end if;

  if v_requester.profile in ('NEXUS_ROOT','NEXUS_ADMIN') then
    null;
  elsif v_requester.profile = 'CLIENT_ADMIN' and v_requester.organization_id = v_target.organization_id then
    if v_target.profile = 'CLIENT_ADMIN' or p_profile = 'CLIENT_ADMIN' then
      raise exception 'NEXUS_ROOT_REQUIRED_FOR_CLIENT_ADMIN';
    end if;
  else
    raise exception 'NEXUS_ACCESS_DENIED';
  end if;

  update public.nexus_user_profiles set
    profile = p_profile,
    active = p_active,
    full_name = nullif(trim(p_full_name), ''),
    role_title = nullif(trim(p_role_title), ''),
    phone = nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''),
    permissions = coalesce(p_permissions, '{}'::jsonb),
    updated_at = now()
  where user_id = p_user_id;

  update public.nexus_user_unit_access set active = false
  where user_id = p_user_id and organization_id = v_target.organization_id;

  foreach v_unit in array coalesce(p_unit_ids, '{}'::uuid[])
  loop
    if exists (select 1 from public.nexus_organization_units where id = v_unit and organization_id = v_target.organization_id and active = true) then
      insert into public.nexus_user_unit_access (user_id, organization_id, unit_id, active)
      values (p_user_id, v_target.organization_id, v_unit, true)
      on conflict (user_id, unit_id) do update set active = true;
    end if;
  end loop;
end;
$$;

revoke all on function public.nexus_update_user_access(uuid, text, boolean, text, text, text, jsonb, uuid[]) from public;
grant execute on function public.nexus_update_user_access(uuid, text, boolean, text, text, text, jsonb, uuid[]) to authenticated;
