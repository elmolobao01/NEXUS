# Gestão Comercial NEXUS

A fundação passa a prever uma camada administrativa para comercialização da plataforma.

## Entidades principais

- Clientes
- Contatos comerciais
- Planos
- Módulos
- Contratos de uso
- Hospedagem gerenciada
- Valores recorrentes
- Datas de vigência e vencimento
- Status de implantação e operação

## Regra de cálculo

O valor mensal de um contrato poderá ser formado por:

1. Valor-base do plano.
2. Módulos adicionais.
3. Quantidade de unidades.
4. Hospedagem e infraestrutura.
5. Serviços adicionais, como suporte e implantação.

Nesta versão, os dados são demonstrativos e estão centralizados em `src/core/clientes/catalogo.js`. A persistência será conectada ao Supabase na etapa do NEXUS Core.
