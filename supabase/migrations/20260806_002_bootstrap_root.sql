insert into public.nexus_organizations (name, slug, segment, status)
values ('NEXUS Platform', 'nexus-platform', 'platform', 'active')
on conflict (slug) do update
set name = excluded.name, status = excluded.status, updated_at = now();

insert into public.nexus_user_profiles (
  user_id,
  organization_id,
  profile,
  active
)
select
  u.id,
  o.id,
  'NEXUS_ROOT',
  true
from auth.users u
cross join public.nexus_organizations o
where lower(u.email) = 'root@nexus.com.br'
  and o.slug = 'nexus-platform'
on conflict (user_id) do update
set
  organization_id = excluded.organization_id,
  profile = 'NEXUS_ROOT',
  active = true,
  updated_at = now();
