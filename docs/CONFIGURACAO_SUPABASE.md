# Configuração Supabase

## Variáveis da Vercel

```text
NEXT_PUBLIC_SUPABASE_URL=https://sagacqrqaaycyyefovng.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_80XSji7Msl9xjTCfbeKTFw_YMdiF95w
```

Remova `NEXUS_DEMO_AUTH`.

## Ordem

1. Execute `20260806_001_auth_definitivo.sql`.
2. Crie `root@nexus.com.br` em Authentication > Users e defina uma senha forte.
3. Execute `20260806_002_bootstrap_root.sql`.
4. Cadastre as duas variáveis na Vercel.
5. Faça novo deployment.
6. Entre com o e-mail e a senha reais criados no Supabase.

Nunca exponha `service_role`, secret key ou senha do banco.
