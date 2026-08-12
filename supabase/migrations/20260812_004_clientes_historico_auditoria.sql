-- ============================================================
-- NEXUS Clientes v1.4 — Histórico / Auditoria real
-- Incremental. Executar após as migrations v1.2, v1.2.1 e v1.3.
-- ============================================================

-- Garante a estrutura de auditoria caso a migration v1.2 tenha sido
-- executada parcialmente em algum ambiente.
create table if not exists public.nexus_client_audit (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.nexus_clients(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists nexus_client_audit_client_idx
  on public.nexus_client_audit(client_id, created_at desc);

alter table public.nexus_client_audit enable row level security;

drop policy if exists "root reads client audit" on public.nexus_client_audit;
create policy "root reads client audit"
on public.nexus_client_audit
for select
to authenticated
using (public.nexus_current_user_is_root());

drop policy if exists "root inserts client audit" on public.nexus_client_audit;
create policy "root inserts client audit"
on public.nexus_client_audit
for insert
to authenticated
with check (public.nexus_current_user_is_root());

-- Escrita centralizada: registra automaticamente quem executou a ação.
create or replace function public.nexus_log_client_event(
  p_client_id uuid,
  p_action text,
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  if not public.nexus_current_user_is_root() then
    raise exception 'NEXUS_ACCESS_DENIED';
  end if;

  if not exists (
    select 1
    from public.nexus_clients c
    where c.id = p_client_id
  ) then
    raise exception 'NEXUS_CLIENT_NOT_FOUND';
  end if;

  insert into public.nexus_client_audit (
    client_id,
    actor_user_id,
    action,
    details
  )
  values (
    p_client_id,
    auth.uid(),
    upper(trim(p_action)),
    coalesce(p_details, '{}'::jsonb)
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke all on function public.nexus_log_client_event(uuid, text, jsonb) from public;
grant execute on function public.nexus_log_client_event(uuid, text, jsonb) to authenticated;

-- Leitura centralizada da timeline, incluindo o operador que executou.
create or replace function public.nexus_get_client_history(
  p_client_id uuid,
  p_limit integer default 100
)
returns table (
  id uuid,
  action text,
  details jsonb,
  created_at timestamptz,
  actor_user_id uuid,
  actor_email text,
  actor_profile text
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.nexus_current_user_is_root() then
    raise exception 'NEXUS_ACCESS_DENIED';
  end if;

  return query
  select
    a.id,
    a.action,
    a.details,
    a.created_at,
    a.actor_user_id,
    u.email::text as actor_email,
    p.profile::text as actor_profile
  from public.nexus_client_audit a
  left join auth.users u
    on u.id = a.actor_user_id
  left join public.nexus_user_profiles p
    on p.user_id = a.actor_user_id
  where a.client_id = p_client_id
  order by a.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

revoke all on function public.nexus_get_client_history(uuid, integer) from public;
grant execute on function public.nexus_get_client_history(uuid, integer) to authenticated;

-- Backfill: clientes já existentes passam a ter pelo menos o evento inicial.
insert into public.nexus_client_audit (
  client_id,
  actor_user_id,
  action,
  details,
  created_at
)
select
  c.id,
  c.created_by,
  'CLIENT_CREATED',
  jsonb_build_object(
    'legal_name', c.legal_name,
    'trade_name', c.trade_name,
    'segment', c.segment,
    'backfilled', true
  ),
  c.created_at
from public.nexus_clients c
where not exists (
  select 1
  from public.nexus_client_audit a
  where a.client_id = c.id
    and a.action = 'CLIENT_CREATED'
);

-- Backfill de acesso existente, para que a aba Histórico já mostre
-- o provisionamento configurado antes desta migration.
insert into public.nexus_client_audit (
  client_id,
  actor_user_id,
  action,
  details,
  created_at
)
select
  ca.client_id,
  null,
  case
    when ca.enabled then 'ACCESS_ENABLED'
    else 'ACCESS_SUSPENDED'
  end,
  jsonb_build_object(
    'display_name', ca.display_name,
    'email', ca.email,
    'profile', ca.profile,
    'provision_status', ca.provision_status,
    'backfilled', true
  ),
  coalesce(ca.last_provisioned_at, ca.updated_at, ca.created_at)
from public.nexus_client_access ca
where not exists (
  select 1
  from public.nexus_client_audit a
  where a.client_id = ca.client_id
    and a.action in ('ACCESS_ENABLED', 'ACCESS_INVITED', 'ACCESS_SUSPENDED')
);

comment on table public.nexus_client_audit is
'Linha do tempo administrativa persistente do cliente NEXUS.';
