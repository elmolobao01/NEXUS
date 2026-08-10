export const SEGMENTOS_NEXUS = Object.freeze({
  educacao: { id: "educacao", nome: "Educação", perfis: ["educacao-infantil", "ensino-fundamental", "ensino-medio", "multi-etapas"], metricaPrincipal: "alunos" },
  clinicas: { id: "clinicas", nome: "Clínicas e Consultórios", perfis: ["consultorio", "clinica", "multi-especialidades", "multiunidade"], metricaPrincipal: "profissionais_agendas" },
  restaurantes: { id: "restaurantes", nome: "Restaurantes e Delivery", perfis: ["restaurante", "somente-delivery", "restaurante-delivery", "dark-kitchen"], metricaPrincipal: "unidades_operacao" },
  comercio: { id: "comercio", nome: "Comércio", perfis: ["loja", "multiunidade", "catalogo-digital"], metricaPrincipal: "unidades_operacao" },
  servicos: { id: "servicos", nome: "Serviços e Escritórios", perfis: ["profissional", "escritorio", "multi-equipe"], metricaPrincipal: "usuarios_volume" },
  hotelaria: { id: "hotelaria", nome: "Hotelaria e Pousadas", perfis: ["pousada", "hotel", "multi-propriedade", "hospedagem-alimentacao"], metricaPrincipal: "acomodacoes_propriedades" },
  juridico: { id: "juridico", nome: "Jurídico", perfis: ["autonomo", "escritorio", "departamento-juridico", "multi-equipe"], metricaPrincipal: "profissionais_processos" },
  imobiliario: { id: "imobiliario", nome: "Imobiliário", perfis: ["corretor", "imobiliaria", "administradora", "multiunidade"], metricaPrincipal: "imoveis_corretores" },
  governamental: { id: "governamental", nome: "Governamental e Institucional", perfis: ["orgao", "autarquia", "instituicao", "multiunidade"], metricaPrincipal: "escopo_personalizado" },
  outros: { id: "outros", nome: "Outros segmentos", perfis: ["personalizado"], metricaPrincipal: "escopo_personalizado" },
});

export const listarSegmentos = () => Object.values(SEGMENTOS_NEXUS);
