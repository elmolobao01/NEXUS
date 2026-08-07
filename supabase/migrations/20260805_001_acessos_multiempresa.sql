-- Fundação multiempresa do NEXUS.
-- Executar somente após revisar no ambiente de homologação.

create extension if not exists pgcrypto;

create table if not exists public.nexus_organizacoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  portfolio text not null,
  status text not null default 'ativo' check (status in ('ativo','implantacao','suspenso','encerrado')),
  created_at timestamptz not null default now()
);

create table if not exists public.nexus_unidades (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.nexus_organizacoes(id) on delete cascade,
  nome text not null,
  codigo text,
  status text not null default 'ativo',
  created_at timestamptz not null default now(),
  unique (organizacao_id, codigo)
);

create table if not exists public.nexus_vinculos_usuario (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  organizacao_id uuid not null references public.nexus_organizacoes(id) on delete cascade,
  unidade_id uuid references public.nexus_unidades(id) on delete cascade,
  perfil text not null,
  is_admin_nexus boolean not null default false,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (usuario_id, organizacao_id, unidade_id, perfil)
);

create table if not exists public.nexus_modulos_contratados (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.nexus_organizacoes(id) on delete cascade,
  portfolio text not null,
  modulo_codigo text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organizacao_id, modulo_codigo)
);

alter table public.nexus_organizacoes enable row level security;
alter table public.nexus_unidades enable row level security;
alter table public.nexus_vinculos_usuario enable row level security;
alter table public.nexus_modulos_contratados enable row level security;

create or replace function public.nexus_usuario_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.nexus_vinculos_usuario v
    where v.usuario_id = auth.uid() and v.is_admin_nexus = true and v.ativo = true
  );
$$;

create or replace function public.nexus_usuario_na_organizacao(p_organizacao_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.nexus_usuario_admin() or exists (
    select 1 from public.nexus_vinculos_usuario v
    where v.usuario_id = auth.uid()
      and v.organizacao_id = p_organizacao_id
      and v.ativo = true
  );
$$;

create policy "nexus organizacoes por escopo"
on public.nexus_organizacoes for select
to authenticated
using (public.nexus_usuario_na_organizacao(id));

create policy "nexus unidades por escopo"
on public.nexus_unidades for select
to authenticated
using (public.nexus_usuario_na_organizacao(organizacao_id));

create policy "nexus vinculos proprios ou admin"
on public.nexus_vinculos_usuario for select
to authenticated
using (usuario_id = auth.uid() or public.nexus_usuario_admin());

create policy "nexus modulos por escopo"
on public.nexus_modulos_contratados for select
to authenticated
using (public.nexus_usuario_na_organizacao(organizacao_id));
