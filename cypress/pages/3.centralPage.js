class CentralPage {
  // Mapeamento concentrado dos Seletores
  elements = {
    // Header & Navegação
    tituloCentral: () => cy.contains('h1, h2, span', 'Central', { timeout: 15000 }),
    subtituloVisaoGeral: () => cy.contains('Visão geral dos atendimentos'),
    blocoOrcamentos: () => cy.contains('Orçamentos'),
    btnIniciarAtendimento: () => cy.contains('button', 'Iniciar atendimento'),
    
    // Menu Lateral & Tema
    sidebar: () => cy.get('aside#home-sidebar'),
    btnToggleHeader: () => cy.get('[data-testid="button-toggle-sidebar-header"]'),
    btnToggleCollapsed: () => cy.get('[data-testid="button-toggle-sidebar-collapsed"]'),
    btnAlternarTema: () => cy.get('button[aria-label="Alternar tema"]'),
    btnPerfilMenu: () => cy.get('button[aria-haspopup="menu"], button:has(svg[data-icon="user"])'),
    itemSair: () => cy.contains(/sair|logout/i),

    // Modal Iniciar Atendimento
    modalIniciarAtendimento: () => cy.get('[data-testid="modal-iniciar-atendimento"]'),
    tituloModalIniciarAtendimento: () => cy.get('h2#start-attendance-title'),
    btnEnviarMensagemModal: () => cy.contains('button', 'Enviar mensagem'),

    // Filtro de Data
    btnFiltroData: () => cy.get('button[class*="_filtersDateValue_"], button[aria-haspopup="dialog"]'),
    popoverFiltroData: () => cy.get('div[role="dialog"]'),
    inputDataInicial: () => cy.get('div[role="dialog"]').find('input[type="date"]').eq(0),
    inputDataFinal: () => cy.get('div[role="dialog"]').find('input[type="date"]').eq(1),
    btnAplicarFiltro: () => cy.contains('button', 'Aplicar'),
    btnCancelarFiltro: () => cy.contains('button', 'Cancelar'),

    // Rodapé
    linkTermos: () => cy.contains('footer a', 'Termos'),
    linkPrivacidade: () => cy.contains('footer a', 'Privacidade'),

    // Cards e Colunas de Fila
    colunasFila: () => cy.get('article[class*="_listColumn_"]'),
    getColunaPorNome: (nomeColuna) => cy.contains('article', nomeColuna),
    getBtnIrParaFila: (nomeColuna) => 
      cy.contains('article', nomeColuna)
        .find('button[class*="_listColumnQueueLink_"], button:contains("Ir para fila")')
  };

  // Ações da Página
  visitar() {
    cy.visit('/');
  }

  recarregar() {
    cy.reload();
  }

  abrirModalIniciarAtendimento() {
    this.elements.btnIniciarAtendimento().click();
  }

  recolherMenuLateral() {
    this.elements.btnToggleHeader().click();
  }

  expandirMenuLateral() {
    this.elements.btnToggleCollapsed().click();
  }

  realizarLogout() {
    this.elements.btnPerfilMenu().click();
    this.elements.itemSair().click();
  }

  abrirFiltroData() {
    this.elements.btnFiltroData().click();
  }

  /**
   * Calcula o intervalo padrão: dia atual e os últimos 30 dias no formato YYYY-MM-DD
   */
  obterIntervaloPadrao() {
    const hoje = new Date();
    const dataInicialObj = new Date(hoje);
    dataInicialObj.setDate(hoje.getDate() - 30);

    const formatarData = (dataObj) => {
      const yyyy = dataObj.getFullYear();
      const mm = String(dataObj.getMonth() + 1).padStart(2, '0');
      const dd = String(dataObj.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    return {
      dataInicial: formatarData(dataInicialObj),
      dataFinal: formatarData(hoje),
    };
  }

  /**
   * Mantido para retrocompatibilidade
   */
  obterIntervaloMesAtual() {
    return this.obterIntervaloPadrao();
  }

  /**
   * Abre o popover do filtro de data, lê os valores padrão e fecha sem aplicar alterações
   */
  obterIntervaloDatasDoPopover() {
    this.abrirFiltroData();
    this.elements.popoverFiltroData().should('be.visible');

    return this.elements.inputDataInicial().invoke('val').then((dataInicial) => {
      return this.elements.inputDataFinal().invoke('val').then((dataFinal) => {
        this.elements.btnCancelarFiltro().click();
        this.elements.popoverFiltroData().should('not.exist');
        return cy.wrap({ dataInicial, dataFinal });
      });
    });
  }

  /**
   * Extrai start_date e end_date dos query params de uma URL de requisição
   */
  extrairIntervaloDatasDaUrl(requestUrl) {
    const url = new URL(requestUrl);

    return {
      dataInicial: url.searchParams.get('start_date'),
      dataFinal: url.searchParams.get('end_date'),
    };
  }

  /**
   * Recupera o intervalo de datas enviado em uma requisição interceptada pelo alias
   */
  extrairIntervaloDatasDoIntercept(alias) {
    return cy.get(`@${alias}`).then((interception) =>
      this.extrairIntervaloDatasDaUrl(interception.request.url)
    );
  }

  aplicarFiltroData(dataInicial, dataFinal) {
    // 1. Clica primeiro no botão para abrir o popover de filtro de data
    this.elements.btnFiltroData().click();

    // 2. Aguarda o popover/container estar visível (usando fallback de seletores se não tiver role="dialog")
    cy.get('div[role="dialog"], div[class*="popover"], div[class*="datepicker"]').should('be.visible');

    // 3. Preenche as datas e clica em aplicar
    this.elements.inputDataInicial().clear().type(dataInicial);
    this.elements.inputDataFinal().clear().type(dataFinal);
    this.elements.btnAplicarFiltro().click();
  }
}

export default new CentralPage();