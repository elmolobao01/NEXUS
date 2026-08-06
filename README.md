# NEXUS AUTH — Sprint 1

Esta sprint prepara autenticação real com Supabase sem adicionar dependências
ao `package.json`.

## Arquivos principais

```text
middleware.js
.env.example

src/app/
├── globals.css
├── login/
│   ├── page.jsx
│   └── login-screen.jsx
├── acesso-negado/
│   └── page.jsx
└── api/auth/
    ├── login/route.js
    ├── logout/route.js
    └── session/route.js

src/lib/auth/
└── config.js

supabase/migrations/
└── 20260805_002_auth_foundation.sql
```

## Aplicação imediata em modo demonstração

1. Substitua o `src/app/globals.css` pelo arquivo completo do pacote.
2. Envie todos os demais arquivos preservando as pastas.
3. Na Vercel, crie a variável:
   - `NEXUS_DEMO_AUTH=true`
4. Faça o deployment.

Acesso demonstrativo:

- `root@nexus.com.br` / qualquer senha com 4 ou mais caracteres → `/admin`
- e-mail contendo `admin` → `/portal`
- demais e-mails → `/portal`

## Ativação do Supabase

1. Execute a migration em homologação.
2. Cadastre:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Crie o usuário no Supabase Auth.
4. Insira o vínculo em `nexus_user_profiles`.
5. Altere:
   - `NEXUS_DEMO_AUTH=false`

## Limite desta sprint

O middleware protege as rotas pela sessão em cookie. A próxima sprint deve
implementar renovação de token, validação do token no servidor e operações
administrativas com chave de serviço mantida somente no backend.
