# Fluxo do Login Inteligente

```text
E-mail + senha
      ↓
Autenticação
      ↓
Identidade do usuário
      ↓
Organização e unidade
      ↓
Perfil e permissões
      ↓
Portfólio e módulos
      ↓
Roteamento automático
```

A versão atual implementa esse fluxo de forma demonstrativa e isolada em
`src/lib`. Isso permite trocar a função `autenticarUsuario` pela integração
real com o Supabase sem reconstruir a tela.
