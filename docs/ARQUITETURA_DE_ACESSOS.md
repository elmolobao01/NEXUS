# Arquitetura de acessos do NEXUS

A partir da versão 1.3, a interface é dividida em três experiências:

- `/login`: identificação do ambiente e acesso demonstrativo;
- `/admin`: painel gerencial interno da NEXUS;
- `/portal`: ambiente operacional do cliente.

## Escopo do painel interno

O painel interno administra clientes, contratos, planos, módulos, hospedagem, organizações, unidades, usuários globais e auditoria. Nenhum cliente deverá ter acesso a essa rota em produção.

## Escopo do portal do cliente

O portal é carregado a partir dos vínculos do usuário com:

- organização;
- unidade;
- portfólio;
- perfil;
- módulos contratados;
- permissões efetivas.

## Regra obrigatória

A separação visual implementada nesta versão é apenas a camada inicial. A proteção definitiva deve ser validada no servidor e no banco, por meio de Supabase Auth, Row Level Security e verificação de permissões em cada operação.
