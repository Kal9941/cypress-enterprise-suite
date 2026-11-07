// cypress/pages/7.clientesPage.js
// Page Object para a tela de Clientes (/clientes): listagem, busca, filtros e cadastro

class ClientesPage {
  elements = {
    // Navegação lateral
    sidebarItemClientes: () => cy.get('[data-testid="sidebar-item-clientes"]').first(),
    sidebarItemCentral: () => cy.get('button[data-testid="sidebar-item-central"]').first(),

    // Diálogo "Sair sem salvar?" — guarda de saída ao voltar/avançar pelo navegador (Issue
    // front#472, PR #475): app migrado para RouterProvider/createBrowserRouter, useBlocker só em
    // historyAction === 'POP'. Mesmo componente/testid de 5.atendimentosPage.js (ConfirmDialog
    // compartilhado), textos confirmados via bundle real (index-*.js, chaves i18n app.leaveUnsaved*).
    dialogSairSemSalvar: () => cy.get('[data-testid="navigation-unsaved-dialog"]'),
    btnSairSemSalvarContinuarEditando: () => cy.get('[data-testid="navigation-unsaved-dialog-cancel"]'),
    btnSairSemSalvarConfirmar: () => cy.get('[data-testid="navigation-unsaved-dialog-confirm"]'),

    // Estrutura da tela e formulário de busca (client-filter-bar)
    paginaClientes: () => cy.get('[data-testid="clients-page"]'),
    conteudoPrincipal: () => cy.get('[data-testid="clients-main-content"]'),
    barraFiltros: () => cy.get('[data-testid="client-filter-bar"]'),
    inputBusca: () => cy.get('[data-testid="input-client-search"]'),
    btnLimparBusca: () => cy.get('[data-testid="button-clear-client-search"]'),
    btnOrdenar: () => cy.get('[data-testid="button-sort-clients"]'),
    filtroTodos: () => cy.get('[data-testid="filter-type-all"]'),
    filtroHumano: () => cy.get('[data-testid="filter-type-human"]'),
    filtroAnimal: () => cy.get('[data-testid="filter-type-animal"]'),

    // Estados da listagem (1-2 caracteres = dica; 0 ou 3+ caracteres = loading/erro/vazio/tabela
    // — Issue backend#586/front#510, recorte mínimo de 3 caracteres removido em 2026-10-06)
    dicaBuscaInicial: () => cy.get('[data-testid="clients-search-hint"]'),
    listaCarregando: () => cy.get('[data-testid="clients-loading"]'),
    listaErro: () => cy.get('[data-testid="clients-error"]'),
    btnTentarNovamente: () => cy.get('[data-testid="button-clients-retry"]'),
    listaVazia: () => cy.get('[data-testid="clients-empty"]'),
    listaResultados: () => cy.get('[data-testid="clients-list-view"]'),
    tabelaClientes: () => cy.get('[data-testid="clients-table"]'),
    tabelaClientesScroll: () => cy.get('[data-testid="clients-table-scroll"]'),
    linhaClientePorId: (id) => cy.get(`[data-testid="row-client-${id}"]`),
    linkClientePorId: (id) => cy.get(`[data-testid="link-client-${id}"]`),
    // Rolagem infinita (front#510/Issue backend#586/#588 — substitui os antigos botões de página)
    carregandoMaisItens: () => cy.get('[data-testid="clients-loading-more"]'),
    erroCarregarMaisItens: () => cy.get('[data-testid="clients-load-more-error"]'),
    btnTentarNovamenteCarregarMais: () => cy.get('[data-testid="button-clients-retry-load-more"]'),
    limiteDePaginasAtingido: () => cy.get('[data-testid="clients-limit-reached"]'),

    // Modal "Novo Cliente" (gated pela capability can_create_client)
    btnNovoCliente: () => cy.get('[data-testid="button-new-client"]'),
    modalNovoCliente: () => cy.get('[data-testid="modal-new-client"]'),
    btnFecharNovoCliente: () => cy.get('[data-testid="button-new-client-close"]'),
    btnSalvarNovoCliente: () => cy.get('[data-testid="button-new-client-submit"]'),
    // Diálogo "Descartar este cadastro?" ao fechar com campo preenchido — mesmo ConfirmDialog
    // compartilhado da gaveta de notas (Issue #458, PR #463). Testid confirmado via
    // cy.salvarSnapshotDom em 29/09/2026, não suposto.
    modalDescartarCadastroNovoCliente: () => cy.get('[data-testid="modal-new-client-discard"]'),
    btnConfirmarDescartarCadastroNovoCliente: () => cy.get('[data-testid="modal-new-client-discard-confirm"]'),
    btnCancelarDescartarCadastroNovoCliente: () => cy.get('[data-testid="modal-new-client-discard-cancel"]'),
    radioTipoPessoaNovoCliente: (tipo) => cy.get(`[data-testid="radio-new-client-person-type-${tipo}"]`),
    selectGeneroNovoCliente: () => cy.get('[data-testid="select-new-client-gender"]'),
    inputDocNovoCliente: () => cy.get('[data-testid="input-new-client-document"]'),
    inputNomeNovoCliente: () => cy.get('[data-testid="input-new-client-name"]'),
    inputBuscarGrupoNovoCliente: () => cy.get('[data-testid="input-new-client-group-search"]'),
    inputGrupoNovoCliente: () => cy.get('[data-testid="input-new-client-group"]'),
    sugestaoGrupoNovoClientePorId: (id) => cy.get(`[data-testid="new-client-group-suggestion-${id}"]`),
    // O combobox é o input-new-client-group; o input-new-client-group-search é só o botão da lupa
    listaSugestoesGrupoNovoCliente: () => cy.get('[data-testid="new-client-group-suggestions"]'),
    opcoesGrupoNovoCliente: () => cy.get('[data-testid^="new-client-group-suggestion-"]'),
    inputTelefoneNovoCliente: () => cy.get('[data-testid="input-new-client-phone"]'),
    inputRazaoSocialNovoCliente: () => cy.get('[data-testid="input-new-client-company-name"]'),
    inputNascimentoNovoCliente: () => cy.get('[data-testid="input-new-client-birth-date"]'),
    linkClienteExistente: () => cy.get('[data-testid="link-new-client-existing"]'),

    // Ficha do Cliente / Editar Cliente (/clientes/:id — ClientDetailPage)
    fichaCliente: () => cy.get('[data-testid="client-detail-page"]'),
    headerFicha: () => cy.get('[data-testid="card-client-header"]'),
    checkboxAtivoFicha: () => cy.get('[data-testid="checkbox-client-active"]'),
    checkboxEmDebitoFicha: () => cy.get('[data-testid="checkbox-client-in-debt"]'),
    modalAtivoFicha: () => cy.get('[data-testid="modal-client-active"]'),
    btnCancelarModalAtivoFicha: () => cy.get('[data-testid="modal-client-active-cancel"]'),
    btnConfirmarModalAtivoFicha: () => cy.get('[data-testid="modal-client-active-confirm"]'),
    cardIdentificacaoFicha: () => cy.get('[data-testid="card-client-identification"]'),
    // Na PJ o input-client-name é o Nome fantasia (label_name, permissão 341) e o input-client-company-name é a Razão Social (name, permissão 027)
    inputNomeFicha: () => cy.get('[data-testid="input-client-name"]'),
    inputRazaoSocialFicha: () => cy.get('[data-testid="input-client-company-name"]'),
    inputTelefoneFicha: () => cy.get('[data-testid="input-client-phone"]'),
    inputNascimentoFicha: () => cy.get('[data-testid="input-client-birth-date"]'),
    radioTipoPessoaFichaFisica: () => cy.get('[data-testid="radio-client-person-type-individual"]'),
    radioTipoPessoaFichaJuridica: () => cy.get('[data-testid="radio-client-person-type-company"]'),
    inputDocumentoFicha: () => cy.get('[data-testid="input-client-document"]'),
    // Dica de documento travado (Issue front#527/PR #531): só existe quando o cliente já tem
    // document gravado (campo e seletor PF/PJ ficam disabled, aria-describedby aponta pra ela).
    hintDocumentoTravadoFicha: () => cy.get('#edit-client-document-locked-hint'),
    inputRgFicha: () => cy.get('[data-testid="input-client-identity-document"]'),
    selectOrgaoEmissorFicha: () => cy.get('[data-testid="select-client-issuing-body"]'),

    cardTelefonesFicha: () => cy.get('[data-testid="card-client-phones"]'),
    telefoneFichaPorId: (id) => cy.get(`[data-testid="client-phone-${id}"]`),
    btnRemoverTelefoneFichaPorId: (id) => cy.get(`[data-testid="button-remove-client-phone-${id}"]`),
    inputNovoTelefoneFicha: () => cy.get('[data-testid="input-client-new-phone"]'),
    btnAdicionarTelefoneFicha: () => cy.get('[data-testid="button-add-client-phone"]'),
    modalRemoverTelefoneFicha: () => cy.get('[data-testid="modal-client-remove-phone"]'),
    btnConfirmarRemoverTelefoneFicha: () => cy.get('[data-testid="modal-client-remove-phone-confirm"]'),

    cardEnderecosFicha: () => cy.get('[data-testid="card-client-addresses"]'),
    tabelaEnderecosFicha: () => cy.get('[data-testid="client-addresses"]'),
    linhaEnderecoFichaPorId: (id) => cy.get(`[data-testid="client-address-${id}"]`),
    btnEditarEnderecoFichaPorId: (id) => cy.get(`[data-testid="button-edit-client-address-${id}"]`),
    btnRemoverEnderecoFichaPorId: (id) => cy.get(`[data-testid="button-remove-client-address-${id}"]`),
    btnAdicionarEnderecoFicha: () => cy.get('[data-testid="button-add-client-address"]'),
    modalRemoverEnderecoFicha: () => cy.get('[data-testid="modal-client-remove-address"]'),
    btnConfirmarRemoverEnderecoFicha: () => cy.get('[data-testid="modal-client-remove-address-confirm"]'),
    cardFormularioEnderecoFicha: () => cy.get('[data-testid="card-client-address-form"]'),
    inputCepFicha: () => cy.get('[data-testid="input-client-zip-code"]'),
    inputCidadeFicha: () => cy.get('[data-testid="input-client-city"]'),
    sugestaoCidadeFichaPorId: (id) => cy.get(`[data-testid="edit-client-city-suggestion-${id}"]`),
    inputBairroFicha: () => cy.get('[data-testid="input-client-neighborhood"]'),
    sugestaoBairroFichaPorId: (id) => cy.get(`[data-testid="edit-client-neighborhood-suggestion-${id}"]`),
    inputRuaFicha: () => cy.get('[data-testid="input-client-street"]'),
    inputNumeroEnderecoFicha: () => cy.get('[data-testid="input-client-address-number"]'),
    inputComplementoFicha: () => cy.get('[data-testid="input-client-complement"]'),
    btnCancelarEdicaoEnderecoFicha: () => cy.get('[data-testid="button-cancel-address-edit"]'),

    cardEmailFicha: () => cy.get('[data-testid="card-client-emails"]'),
    inputEmailFicha: () => cy.get('[data-testid="input-client-email"]'),
    cardImpostoFicha: () => cy.get('[data-testid="card-client-tax"]'),
    checkboxNaoContribuinteFicha: () => cy.get('[data-testid="checkbox-client-non-taxpayer"]'),
    checkboxConsumidorFinalFicha: () => cy.get('[data-testid="checkbox-client-final-consumer"]'),
    checkboxReterIssFicha: () => cy.get('[data-testid="checkbox-client-withhold-iss"]'),
    cardDescontoFicha: () => cy.get('[data-testid="card-client-discount"]'),
    inputTipoDescontoFicha: () => cy.get('[data-testid="input-client-discount-type"]'),
    inputPercentualDescontoFicha: () => cy.get('[data-testid="input-client-discount-percentage"]'),
    checkboxEntregaGratisFicha: () => cy.get('[data-testid="checkbox-client-free-delivery"]'),
    cardClassificacaoFicha: () => cy.get('[data-testid="card-client-classification"]'),
    selectClasseMovimentoFicha: () => cy.get('[data-testid="select-client-movement-class"]'),
    selectClassePosVendaFicha: () => cy.get('[data-testid="select-client-post-sale-class"]'),
    inputTabelaPrecoFicha: () => cy.get('[data-testid="input-client-price-table"]'),
    cardNotasFicha: () => cy.get('[data-testid="card-client-notes"]'),
    tabNotasClienteFicha: () => cy.get('[data-testid="tab-client-notes-client"]'),
    tabNotasPesagemFicha: () => cy.get('[data-testid="tab-client-notes-weighing"]'),
    tabNotasAtendimentoFicha: () => cy.get('[data-testid="tab-client-notes-attendance"]'),
    textareaNotasFicha: () => cy.get('[data-testid="textarea-client-notes"]'),
    cardAnimaisFicha: () => cy.get('[data-testid="card-client-animals"]'),

    toastSucessoFicha: () => cy.get('[data-testid="client-save-success"]'),
    toastErroFicha: () => cy.get('[data-testid="client-save-error"]'),
    btnSalvarFicha: () => cy.get('[data-testid="button-save-client"]'),
    btnVoltarFicha: () => cy.get('[data-testid="button-page-back"]'),
    modalAlteracoesNaoSalvasFicha: () => cy.get('[data-testid="modal-client-unsaved-changes"]'),
    btnConfirmarSairSemSalvarFicha: () => cy.get('[data-testid="modal-client-unsaved-changes-confirm"]'),
    btnCancelarSairSemSalvarFicha: () => cy.get('[data-testid="modal-client-unsaved-changes-cancel"]'),
  };

  /**
   * Navega para a rota /clientes via item canônico da barra lateral (sidebar-item-clientes),
   * reautenticando se a sessão tiver caído para /login. Mesmo padrão de AtendimentosPage.visitar()
   * (5.atendimentosPage.js), robusto a diferenças de timing do primeiro carregamento da SPA.
   */
  visitar() {
    cy.get('body', { timeout: 10000 }).should('be.visible');

    cy.url().then((currentUrl) => {
      // Já está em /clientes: nada a navegar
      if (currentUrl.includes('/clientes')) {
        return;
      }

      // Sessão caiu para /login: reautentica antes de navegar
      if (currentUrl.includes('/login')) {
        cy.login();
        cy.url().should('not.include', '/login');
      }

      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="sidebar-item-clientes"]').length > 0) {
          cy.get('[data-testid="sidebar-item-clientes"]').click();
        } else {
          cy.get('aside#home-sidebar, aside, nav')
            .contains('a, button, div, span, li', /clientes/i)
            .click();
        }
      });

      cy.url().should('include', '/clientes');
    });
  }


  /**
   * Campo de texto do endereço pelo prefixo da tela ("client" na ficha e no drawer, "new-client" no cadastro novo).
   * @param {string} prefixo
   * @param {'zip-code'|'street'|'city'|'neighborhood'|'address-number'|'complement'|'address-description'} campo
   */
  campoDoEndereco(prefixo, campo) {
    return cy.get(`[data-testid="input-${prefixo}-${campo}"]`);
  }

  /**
   * Lupa "Buscar endereço pelo CEP" ao lado do campo CEP.
   */
  lupaDoCep(prefixo) {
    return cy.get(`[data-testid="button-${prefixo}-zip-code-search"]`);
  }

  /**
   * Select da UF do endereço (mostra "—" até haver cidade escolhida).
   */
  ufDoEndereco(prefixo) {
    return cy.get(`[data-testid="select-${prefixo}-state"]`);
  }

  /**
   * Digita um CEP de 8 dígitos (apaga o que houver), espera a consulta GET /zip-codes e devolve a resposta (status e body).
   * O alias @getZipCodesApi vem de ClientesMocks.interceptZipCodesApi.
   */
  digitarCep(prefixo, cep) {
    this.campoDoEndereco(prefixo, 'zip-code').clear().type(cep);
    return cy.wait('@getZipCodesApi').then((interceptacao) => interceptacao.response);
  }

  /**
   * Clica na lupa do CEP e devolve a resposta da consulta.
   */
  clicarNaLupaDoCep(prefixo) {
    this.lupaDoCep(prefixo).click();
    return cy.wait('@getZipCodesApi').then((interceptacao) => interceptacao.response);
  }

  /**
   * Texto sem acento e em minúsculas ("SAO PAULO" e "Sao Paulo" e "São Paulo" viram o mesmo): a tela mostra cidade e bairro com iniciais maiúsculas
   * e a API devolve em caixa alta.
   */
  semAcento(texto) {
    return String(texto || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  }

  /**
   * Abre o formulário de novo endereço na ficha do cliente (sem gravar nada) e espera o formulário.
   */
  abrirNovoEnderecoNaFicha(clientId) {
    this.visitarFicha(clientId);
    // A ficha de um cliente real pode demorar a carregar na dev: espera até 30 s pelo botão
    cy.get('[data-testid="button-add-client-address"]', { timeout: 30000 }).click();
    this.elements.cardFormularioEnderecoFicha().should('be.visible');
  }

  /**
   * Link "Consultar CEP nos Correios" (SAIU na PR #619, o testid era "link-<prefixo>-zip-lookup"): serve para provar que não existe mais.
   */
  linkDosCorreios() {
    return cy.get('[data-testid$="-zip-lookup"]');
  }

  /**
   * Navega diretamente para a ficha de um cliente (/clientes/:id — ClientDetailPage).
   * @param {string|number} clientId
   */
  visitarFicha(clientId) {
    cy.visit(`/clientes/${clientId}`, { failOnStatusCode: false });
    cy.url().should('include', `/clientes/${clientId}`);
  }
}

export default new ClientesPage();
