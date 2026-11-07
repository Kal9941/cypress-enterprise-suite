// cypress/fixtures/0.backend/massaRevenda.js
// Fonte única dos IDs de revenda e de produto usados pelos contexts 27 e 28 de 0-A.backend-acesso-cadastros-orcamentos.cy.js
// (leitura do detalhe, Issue backend#780/PR #768; inclusão de produto, Issue backend#783/PR #773). Não é mock: são registros reais do ambiente de dev, sujeitos
// a edição manual por terceiros fora da automação (ex.: finalizar a revenda no Desktop); quando a API real
// divergir do esperado, atualizar os valores AQUI é o único lugar necessário. Medido em 2026-10-27.
// Guarda (ROADMAP.md P1-54, onda 4, 2026-11-06): não há rota que liste revendas nem que conclua uma, então os registros ficam aqui e cada
// context 27 a 30 confere as chaves que usa num before() (`conferirMassaRevenda` no spec); se alguma derivou, o context pula com o motivo.
module.exports = {
  // Orçamento aberto da loja 1, 1 produto com lote, ligado ao atendimento 261000095 (cenário de sucesso do roteiro de QA)
  REVENDA_ABERTA: {
    id: 261000819,
    patient_id: 867084,
    prescriber_id: 9999999,
    attendance_id: 261000095,
  },
  // Concluída (status -1) e sem financeiro
  REVENDA_CONCLUIDA_SEM_FINANCEIRO: 261001638,
  // Concluída com financeiro: as três chaves de produto saem false mesmo com todos os grants
  REVENDA_COM_FINANCEIRO: 241000028,
  // Código de uma receita (TIPO_ATENDIMENTO diferente de 2): a rota de revenda responde 404
  CODIGO_DE_RECEITA: 261001650,
  CODIGO_INEXISTENTE: 999999999,
  // Produtos de revenda da loja 1 (inclusão de produto, Issue backend#783), medidos em 2026-10-28: entram na busca de revenda
  // (`MOVIMENTOESTOQUE = 3`). O lote é do produto, está aberto e num local de estoque da loja; o `LOTE_SALDO_PEQUENO` tinha
  // saldo 2 (qualquer quantidade grande passa dele); se o lote fechar ou sair da loja, a recusa de saldo vira "Lote inválido".
  PRODUTO_COM_LOTE: {
    id: 3044804,
    lote_id: 29392,
    lote_saldo_pequeno_id: 26705,
    // Termo que acha o produto na busca de revenda; o saldo por lote vem em `lots[].balance` (alteração e exclusão na concluída, Issue backend#784)
    termo_busca: 'FPS 45',
    // Trecho do meio do nome ("FARMULA FPS 45 - SEM BASE"): `containing` acha, `starting` não (busca de revenda, Issue backend#785)
    termo_no_meio: 'PS 45',
  },
  // Busca de revenda (Issue backend#785), medida em 2026-10-28: produto com 1 só lote na busca (PARACETAMOL), produto sem lote nenhum (kit sem saldo) e
  // um termo cujo nome tem cedilha. Se alguém der entrada de estoque no kit, ele passa a ter lote e o `#30.4` precisa de outro produto sem lote.
  PRODUTO_COM_UM_LOTE_NA_BUSCA: { id: 3015648, lote_id: 29370, termo: 'PARACETAMOL' },
  PRODUTO_SEM_LOTE_NA_BUSCA: { id: 3044821, termo: 'FARMULA' },
  TERMO_COM_ACENTO: { com: 'INCHAÇO', sem: 'INCHACO' },
  PRODUTO_SEM_LOTE: 3015648,
  // DIPIRONA: insumo de manipulação (`movement_type` 1), fora da busca de revenda
  PRODUTO_FORA_DA_REVENDA: 1001178,
  PRODUTO_INEXISTENTE: 999999999,
};
