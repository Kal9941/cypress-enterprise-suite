class LoginPage {
  // Mapeamento concentrado dos Seletores
  elements = {
    inputCnpj: () => cy.get('[id$="-cnpj"]'),
    inputUsuario: () => cy.get('input[id*="usuario"], input[name="user"], input[placeholder*="suário"], input[placeholder*="suario"]'),
    inputSenha: () => cy.get('[id$="-senha"]'),
    btnSubmit: () => cy.get('button[type="submit"]'),
    btnMostrarSenha: () => cy.get('button[aria-label="Mostrar senha"]'),
    btnOcultarSenha: () => cy.get('button[aria-label*="senha"]'),
    checkboxSalvarCnpj: () => cy.get('input[type="checkbox"], [role="checkbox"]'),
    labelSalvarCnpj: () => cy.contains('label, span', 'Salvar CNPJ')
  };

  // Ações da Página
  visitar() {
    cy.visit('/');
  }

  preencherCnpj(cnpj) {
    this.elements.inputCnpj().clear().type(cnpj);
  }

  preencherUsuario(usuario) {
    this.elements.inputUsuario().clear().type(usuario);
  }

  preencherSenha(senha) {
    this.elements.inputSenha().clear().type(senha);
  }

  submeterFormulario() {
    this.elements.btnSubmit().click();
  }

  /**
   * Corrompe o token de sessão ativo em sessionStorage, simulando expiração/invalidação
   * sem esperar as 14h reais de validade (PR #477 "Como testar").
   */
  corromperTokenSessao() {
    return cy.window().then((win) => {
      const tokenAtual = win.sessionStorage.getItem('omnicare_access_token');
      win.sessionStorage.setItem('omnicare_access_token', `${tokenAtual}_invalido_e2e`);
    });
  }
}

export default new LoginPage();