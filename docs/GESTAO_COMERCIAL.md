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

## Ecossistema multiproduto — 09/08/2026

O NEXUS passa a ser tratado como ecossistema. `NEXUS Gestão` e `NEXUS IA` são produtos independentes e podem ser contratados isoladamente ou em conjunto.

### Benefício Ecossistema

- Cliente de Gestão recebe condição especial ao adicionar IA.
- Cliente de IA recebe condição especial ao adicionar Gestão.
- A combinação de produtos pode gerar benefício progressivo conforme regra comercial vigente.
- O benefício deve ser calculado como regra de assinatura, e não como alteração destrutiva do produto ou contrato original.

### Canais de contratação

- Homepage pública: descoberta, contratação e contato comercial.
- Portal autenticado: visualização dos produtos ativos e futura adição/upgrade de produtos.
- WhatsApp: canal de dúvidas, esclarecimentos, comercial e suporte, com mensagens contextualizadas por produto.

A integração inicial do WhatsApp usa link oficial com mensagem pré-preenchida e o número é configurado em `NEXT_PUBLIC_NEXUS_WHATSAPP`. A arquitetura deve permanecer preparada para futura adoção da WhatsApp Business Platform/API.
