# NEXUS Foundation 1.1

Fundação inicial da plataforma NEXUS, construída em Next.js com arquitetura modular em uma única aplicação.

## Executar

```bash
npm install
npm run validate
npm run build
npm run dev
```

## Rotas

- `/` — painel inicial
- `/api/health` — diagnóstico da aplicação

## Estrutura

- `src/app` — rotas Next.js
- `src/components` — componentes reutilizáveis
- `src/core` — serviços transversais da plataforma
- `src/design-system` — tokens, temas e componentes
- `src/portfolios` — regras específicas dos segmentos
- `supabase` — migrações, políticas e sementes futuras

Consulte `docs/IMPLANTACAO_VERCEL.md` antes de publicar.
