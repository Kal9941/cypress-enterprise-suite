// cypress/fixtures/0.backend/massaResidualOrcamentos.js
// Fonte única dos IDs de atendimento/orçamento residuais usados pelos contexts 13, 14, 16 e 18 de
// 0-A.backend-acesso-cadastros-orcamentos.cy.js (elegibilidade e bloqueio de cobrança contra a API real - AGENTS.md secao 0).
// Não é mock: são registros reais do ambiente de dev, todos em atendimentos FINALIZADOS de jul-set/2026 (estáveis, só mudam
// por edição manual no Desktop). Por que IDs e não descoberta (ROADMAP.md P1-54, onda 3, decisão do operador de 2026-11-06):
// a varredura de 6 meses (219 atendimentos, 35 s) achou elegível, vendido e "-1 sem venda", mas NENHUM orçamento coberto por
// link aprovado além do par abaixo. Cada teste confere o estado do orçamento antes de usá-lo (`exigirMassaOrcamento` no spec)
// e pula com o motivo se ele derivou, em vez de ficar vermelho ([R-ATEMPORAL]). Quando um estado derivar, trocar o ID AQUI.
module.exports = {
  // status 0, sem financeiro, sem link aprovado
  ATENDIMENTO_ELEGIVEL: 260800149,
  ORCAMENTO_ELEGIVEL: 260800195,
  // covered_by_approved_link: true (o único da dev; confirmado em 2026-10-05 e 2026-11-06)
  ATENDIMENTO_COBERTO_POR_LINK_APROVADO: 260700026,
  ORCAMENTO_COBERTO_POR_LINK_APROVADO: 260700034,
  // financial_id preenchido (venda 260900018); no mesmo atendimento, o orçamento 260900019 segue pendente (status 0, sem financeiro)
  ATENDIMENTO_VENDIDO: 260900010,
  ORCAMENTO_VENDIDO: 260900014,
  FINANCEIRO_DO_VENDIDO: 260900018,
  ORCAMENTO_PENDENTE_DO_VENDIDO: 260900019,
  // status -1, sem financeiro e sem link aprovado (cobrável pela regra da backend#583)
  ATENDIMENTO_RESIDUAL_FORA_DO_ABERTO: 260700094,
  ORCAMENTO_RESIDUAL_FORA_DO_ABERTO: 260700242,
};
