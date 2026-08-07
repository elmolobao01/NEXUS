-- ============================================================
-- NEXUS CLIENTES v1.1
-- Responsáveis + normalização documental
-- Migration incremental: executar após 20260807_001_modulo_clientes.sql
-- ============================================================

create table if not exists public.nexus_client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null
    references public.nexus_clients(id) on delete cascade,
  name text not null,
  role_title text not null,
  responsibility_types text[] not null default '{}',
  email text not null,
  phone text,
  whatsapp text,
  is_primary boolean not null default false,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nexus_client_contacts_types_not_empty
    check (cardinality(responsibility_types) > 0)
);

create index if not exists nexus_client_contacts_client_idx
  on public.nexus_client_contacts(client_id);

create index if not exists nexus_client_contacts_email_idx
  on public.nexus_client_contacts(lower(email));

create unique index if not exists nexus_client_contacts_one_primary_idx
  on public.nexus_client_contacts(client_id)
  where is_primary = true and active = true;

alter table public.nexus_client_contacts enable row level security;

drop policy if exists "root reads client contacts"
  on public.nexus_client_contacts;
create policy "root reads client contacts"
on public.nexus_client_contacts
for select
to authenticated
using (public.nexus_current_user_is_root());

drop policy if exists "root inserts client contacts"
  on public.nexus_client_contacts;
create policy "root inserts client contacts"
on public.nexus_client_contacts
for insert
to authenticated
with check (public.nexus_current_user_is_root());

drop policy if exists "root updates client contacts"
  on public.nexus_client_contacts;
create policy "root updates client contacts"
on public.nexus_client_contacts
for update
to authenticated
using (public.nexus_current_user_is_root())
with check (public.nexus_current_user_is_root());

-- O banco mantém CPF/CNPJ e telefones apenas com dígitos.
update public.nexus_clients
set
  document_number = nullif(regexp_replace(coalesce(document_number, ''), '\D', '', 'g'), ''),
  phone = nullif(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), '')
where
  document_number is not null
  or phone is not null;

-- Substitui a RPC anterior para receber responsáveis junto com o cliente.
drop function if exists public.nexus_create_client(
  text, text, text, text, text, text, text, text, text
);

create or replace function public.nexus_create_client(
  p_legal_name text,
  p_trade_name text default null,
  p_document_type text default 'CNPJ',
  p_document_number text default null,
  p_email text default null,
  p_phone text default null,
  p_segment text default 'Educação',
  p_status text default 'implementation',
  p_notes text default null,
  p_contacts jsonb default '[]'::jsonb
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
  v_contact jsonb;
  v_primary_count integer;
begin
  if not public.nexus_current_user_is_root() then
    raise exception 'NEXUS_ACCESS_DENIED';
  end if;

  if nullif(trim(p_legal_name), '') is null then
    raise exception 'NEXUS_CLIENT_NAME_REQUIRED';
  end if;

  if p_status not in (
    'prospect',
    'implementation',
    'active',
    'suspended',
    'cancelled'
  ) then
    raise exception 'NEXUS_INVALID_CLIENT_STATUS';
  end if;

  select count(*)
  into v_primary_count
  from jsonb_array_elements(coalesce(p_contacts, '[]'::jsonb)) item
  where coalesce((item->>'principal')::boolean, false) = true;

  if v_primary_count > 1 then
    raise exception 'NEXUS_ONLY_ONE_PRIMARY_CONTACT';
  end if;

  v_slug :=
    'client-' ||
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);

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
    nullif(regexp_replace(coalesce(p_document_number, ''), '\D', '', 'g'), ''),
    nullif(lower(trim(p_email)), ''),
    nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''),
    trim(p_segment),
    p_status,
    nullif(trim(p_notes), ''),
    auth.uid()
  )
  returning id into v_client_id;

  for v_contact in
    select value
    from jsonb_array_elements(coalesce(p_contacts, '[]'::jsonb))
  loop
    if
      nullif(trim(v_contact->>'name'), '') is null
      or nullif(trim(v_contact->>'role'), '') is null
      or nullif(trim(v_contact->>'email'), '') is null
      or jsonb_array_length(coalesce(v_contact->'types', '[]'::jsonb)) = 0
    then
      raise exception 'NEXUS_INVALID_CONTACT';
    end if;

    insert into public.nexus_client_contacts (
      client_id,
      name,
      role_title,
      responsibility_types,
      email,
      phone,
      whatsapp,
      is_primary,
      created_by
    )
    values (
      v_client_id,
      trim(v_contact->>'name'),
      trim(v_contact->>'role'),
      array(
        select jsonb_array_elements_text(v_contact->'types')
      ),
      lower(trim(v_contact->>'email')),
      nullif(
        regexp_replace(coalesce(v_contact->>'phone', ''), '\D', '', 'g'),
        ''
      ),
      nullif(
        regexp_replace(coalesce(v_contact->>'whatsapp', ''), '\D', '', 'g'),
        ''
      ),
      coalesce((v_contact->>'principal')::boolean, false),
      auth.uid()
    );
  end loop;

  return query
  select *
  from public.nexus_clients
  where id = v_client_id;
end;
$$;

revoke all on function public.nexus_create_client(
  text, text, text, text, text, text, text, text, text, jsonb
) from public;

grant execute on function public.nexus_create_client(
  text, text, text, text, text, text, text, text, text, jsonb
) to authenticated;
