-- ============================================================
-- NEXUS Clientes v1.3 — Provisionamento real no Supabase Auth
-- Executar após:
--   20260812_001_clientes_v12.sql
--   20260812_002_clientes_acesso_embutido.sql
-- ============================================================

alter table public.nexus_client_access
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists provision_status text not null default 'NOT_PROVISIONED',
  add column if not exists invited_at timestamptz,
  add column if not exists last_provisioned_at timestamptz,
  add column if not exists last_error text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'nexus_client_access_provision_status_check'
  ) then
    alter table public.nexus_client_access
      add constraint nexus_client_access_provision_status_check
      check (
        provision_status in (
          'NOT_PROVISIONED',
          'INVITED',
          'ACTIVE',
          'SUSPENDED',
          'ERROR'
        )
      );
  end if;
end
$$;

create index if not exists nexus_client_access_auth_user_idx
  on public.nexus_client_access(auth_user_id);

-- A API administrativa precisa localizar uma conta já existente sem
-- expor auth.users ao navegador. A função só responde ao ROOT/ADMIN.
create or replace function public.nexus_find_auth_user_by_email(p_email text)
returns table (
  user_id uuid,
  email text,
  confirmed_at timestamptz,
  last_sign_in_at timestamptz
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
    u.id,
    u.email::text,
    u.confirmed_at,
    u.last_sign_in_at
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;
end;
$$;

revoke all on function public.nexus_find_auth_user_by_email(text) from public;
grant execute on function public.nexus_find_auth_user_by_email(text) to authenticated;

comment on function public.nexus_find_auth_user_by_email(text) is
'Localiza conta Auth por e-mail somente para operadores NEXUS_ROOT/NEXUS_ADMIN.';

-- Mantém status coerente para registros já existentes.
update public.nexus_client_access
set provision_status =
  case
    when enabled = false then 'NOT_PROVISIONED'
    when auth_user_id is null then 'NOT_PROVISIONED'
    else 'ACTIVE'
  end
where provision_status is null
   or provision_status = '';
