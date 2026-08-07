# Implantação na Vercel

## Configuração

- Framework Preset: Next.js
- Root Directory: vazio ou `./`
- Build Command: automático
- Install Command: automático
- Output Directory: automático

## Validação

Após o deployment ficar **Ready**, teste:

- `/` — interface da Fundação NEXUS
- `/api/health` — deve retornar JSON com `status: ok`

## Produção

Se o projeto tiver sido revertido para um deployment antigo, abra o deployment mais recente com status **Ready** e use **Promote to Production**. Um rollback anterior continua controlando o domínio de produção até que outro deployment seja promovido.
