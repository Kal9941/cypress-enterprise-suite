// cypress/fixtures/0.backend/massaResidualReceitas.js
// Fonte única dos IDs de receitas residuais usados pelo 0-C.backend-receitas.cy.js contra a API real.
// Não é mock: são registros reais do ambiente de dev, sujeitos a edição manual por terceiros fora da automação.
// Quando a API real divergir do esperado, atualizar os valores AQUI é o único lugar necessário; nenhum context
// deve voltar a declarar esses IDs localmente.
// RECEITA_FINALIZADA_DA_LOJA_2: receita finalizada da loja 2, sem carrinho (roteiro de QA da Issue backend#718/PR #730,
// cenário 11). A sessão de teste é da loja 1: o POST do carrinho só recusa (422), nunca grava nada na receita.
module.exports = {
  RECEITA_FINALIZADA_DA_LOJA_2: 260800011,
};
