# Fase 2 — Organização e Central do Cliente

A Fase 2 estabelece a organização como tenant do NEXUS e separa claramente:

- **Ambiente Operacional**: usuários, unidades, módulos, processos e operação diária.
- **Central do Cliente**: plano vigente, produtos contratados, módulos e Facilities, limites, contrato, faturamento e expansão do ecossistema.

## Motor comercial

O preço final pode variar por segmento/plano, duração contratual, combinação de produtos (Benefício Ecossistema), Facilities e campanhas. Descontos são aplicados sequencialmente e devem respeitar margem mínima configurada.

Modalidades previstas: mensal, 12, 24 e 36 meses. Os percentuais são parâmetros comerciais e não regras funcionais dos módulos.

## Entitlements

Nenhum módulo deve perguntar qual é o nome do plano. Deve consultar capacidades/entitlements da organização. Isso permite alterar preços, nomes de planos e combos sem reescrever funcionalidades.

## Usuários

Usuários pertencem à organização e recebem perfil, unidades e permissões. A administração de usuários fica no ambiente operacional; a Central do Cliente exibe limites contratados e consumo.
