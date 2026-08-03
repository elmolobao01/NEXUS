# NEXUS Foundation 1.0

Fundação oficial da plataforma NEXUS.

## Objetivo

Validar uma única aplicação Next.js modular antes da inclusão de módulos de negócio, banco, autenticação ou integrações externas.

## Estrutura

- `src/app`: App Router do Next.js.
- `src/core`: serviços transversais da plataforma.
- `src/design-system`: tokens, temas e componentes compartilhados.
- `src/portfolios`: áreas de negócio especializadas.
- `supabase`: migrações, políticas e dados iniciais futuros.
- `docs`: documentação técnica e funcional.

## Execução

```bash
npm install
npm run validate
npm run build
npm run dev
```

## Implantação na Vercel

- Framework: Next.js
- Root Directory: `./`
- Install Command: automático
- Build Command: automático (`npm run build`)
- Output Directory: automático

Não são necessários aliases de pacotes locais, workspaces, Turborepo ou configuração especial.
