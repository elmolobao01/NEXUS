# PLENIUM — RPC de claim isolado por organização e número

**Novos arquivos**: `supabase/migrations/20261029_001_chatbot_claim_isolado.sql`, `src/lib/chatbot/scoped-claim-adapter.js`, `tests/scoped-claim-adapter.test.mjs`.

O SQL cria uma função **nova** `nexus_chatbot_inbound_claim_scoped`, preservando a RPC legada. Filtra por organização + phone_number_id antes do `FOR UPDATE SKIP LOCKED`, com lease de 5 minutos e até 3 tentativas, e restringe execução a `service_role`.

**Importante:** antes de executar a migração, conferir o esquema real (colunas `attempts`, `created_at`, `updated_at`, `lease_token`, `leased_until`, `source_event_id` e enum/texto de `state`) e verificar a estratégia de leases expirados. Esta versão reivindica apenas `pending`, não recupera automaticamente leases expirados. Nenhum dado existente é migrado.

O JS é um adaptador isolado que poderá ser ligado ao `processAlreadyClaimedBatch` após homologação. **Não ativa Cron Jobs, não envia WhatsApp, não debita créditos e não altera a rota de execução.** Os testes usam mocks.
