# NEXUS V9.4 — Roteamento contextual automático

## Regra
O login é único. O NEXUS identifica o perfil autenticado e conduz o usuário automaticamente ao ambiente correto.

- NEXUS_ROOT / NEXUS_ADMIN → `/admin`
- CLIENT_ADMIN → `/portal`, iniciando na **Central do Cliente**
- MANAGER / SUPERVISOR / OPERATOR / VIEWER → `/portal`, iniciando no **Ambiente Operacional**

A Central do Cliente não é exibida no menu dos perfis operacionais.

## Proteção adicional
Se um usuário autenticado tentar abrir manualmente um ambiente incompatível com seu perfil, o middleware redireciona para o ambiente correto em vez de apresentar acesso negado quando o destino é inequivocamente conhecido.

## Próxima evolução
Substituir o roteamento baseado apenas em perfil por contexto persistido: usuário → organização → vínculo → perfil → produtos → entitlements → rota inicial.
