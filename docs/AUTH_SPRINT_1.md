# Arquitetura de autenticação

## Fluxo

```text
Login
  ↓
POST /api/auth/login
  ↓
Supabase Auth ou modo demonstração
  ↓
Consulta de nexus_user_profiles
  ↓
Cookies HttpOnly
  ↓
Middleware
  ↓
/admin ou /portal
```

## Perfis iniciais

- NEXUS_ROOT
- NEXUS_ADMIN
- CLIENT_ADMIN
- MANAGER
- SUPERVISOR
- OPERATOR
- VIEWER

## Segurança

A chave anônima do Supabase pode ser utilizada no fluxo de autenticação,
desde que as tabelas estejam com RLS. Chaves de serviço nunca devem ser
expostas em variáveis `NEXT_PUBLIC_*`.
