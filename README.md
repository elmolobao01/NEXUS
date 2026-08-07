# NEXUS v1.6 — Supabase ROOT

Versão consolidada do NEXUS com autenticação real via Supabase, perfil NEXUS_ROOT, Centro de Controle e Portal do Cliente.

## Variáveis na Vercel

```text
NEXT_PUBLIC_SUPABASE_URL=https://sagacqrqaaycyyefovng.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_80XSji7Msl9xjTCfbeKTFw_YMdiF95w
```

Remova `NEXUS_DEMO_AUTH`.

## Banco

As tabelas `nexus_organizations` e `nexus_user_profiles` já foram criadas e o usuário `root@nexus.com.br` já foi vinculado ao perfil `NEXUS_ROOT`.

## Acesso

Use `root@nexus.com.br` e a senha real definida no Supabase Authentication.

## Rotas

- `/login` — autenticação
- `/admin` — Centro de Controle ROOT
- `/portal` — Portal do Cliente
- `/api/auth/session` — sessão atual
- `/api/auth/logout` — encerra sessão

## Deploy

Envie o conteúdo desta pasta para a raiz do repositório GitHub. Cadastre as duas variáveis na Vercel e faça um novo deployment.
