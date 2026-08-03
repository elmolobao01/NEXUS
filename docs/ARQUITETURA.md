# Arquitetura NEXUS Foundation 1.0

A fundação adota uma aplicação Next.js única e modular. A separação por domínios existe dentro de `src`, evitando complexidade prematura de monorepositório sem comprometer a expansão futura.

## Camadas

1. **Núcleo NEXUS**: organizações, unidades, usuários, permissões, auditoria e notificações.
2. **Sistema Visual NEXUS**: tokens, componentes e motor de temas.
3. **Portfólios**: Educação, Governamental, Saúde, Restaurantes e futuras áreas.
4. **Infraestrutura**: Supabase, integrações e implantação.

## Regra de evolução

Somente funcionalidades verdadeiramente compartilhadas entram no núcleo. Regras específicas permanecem em seu portfólio.
