import IniciarAtendimentoMocks from '../mocks/4.iniciarAtendimentoMocks';

class IniciarAtendimentoPage {
  // -------------------------------------------------------------
  // SELETORES DE ELEMENTOS DA INTERFACE (DOM)
  // -------------------------------------------------------------
  elements = {
    // Header e Modal
    btnIniciarAtendimentoHeader: () => cy.contains('button', 'Iniciar atendimento', { timeout: 15000 }),
    modalContainer: () => cy.get('[data-testid="modal-iniciar-atendimento"], div[role="dialog"]'),
    btnFecharModalX: () => cy.get('button[aria-label="Fechar"], button[class*="_startAttendanceCloseBtn_"]'),
    tituloModal: () => cy.get('#start-attendance-title, [class*="_startAttendanceTitle_"]'),

    // Seletores Principais do Formulário
    selectCanal: () => cy.get('select#sa-channel, [data-testid="select-canal"]'),
    selectGrupo: (options = {}) => cy.get('select#sa-group, [data-testid="select-grupo"]', options),
    inputCliente: () => cy.get('input#sa-client, [data-testid="input-cliente"]'),
    inputCelular: () => cy.get('input#sa-celular, [data-testid="input-celular"], input[type="tel"]'),
    prefixoCelular: () => cy.get('[class*="_startAttendancePhonePrefix_"]'),

    // Seletores do Combobox de Busca de Cliente
    hintDigiteCaracteres: () => cy.contains('Digite ao menos 3 caracteres'),
    opcoesDropdownCliente: () => cy.get('[id^="sa-client-opt-"]'),
    btnLimparCliente: () => cy.get('[data-testid="btn-limpar-cliente"]'),
    popoverSugestoesCliente: () => cy.get('[data-testid="sa-client-suggestions"], #sa-client-listbox'),
    itensSugestoesCliente: () => cy.get('[data-testid^="sa-client-suggestion-"], [id^="sa-client-opt-"]'),
    estadoBuscandoClientes: () => cy.get('[data-testid="sa-client-suggestions"]').contains('p', /Buscando clientes/i),
    estadoMinimoCaracteres: () => cy.get('[data-testid="sa-client-suggestions"]').contains('p', /Digite ao menos \d+ caracteres/i),
    estadoNenhumCliente: () => cy.get('[data-testid="sa-client-suggestions"]').contains('p', /Nenhum cliente encontrado/i),

    // Seletores do Fieldset de Telefones do Cliente
    fieldsetTelefonesCliente: () => cy.get('fieldset[class*="_startAttendancePhoneChoice_"]'),
    itensRadioTelefone: () => cy.get('fieldset[class*="_startAttendancePhoneChoice_"] input[type="radio"]'),

    // Templates WABA
    tabelaTemplatesWaba: () => cy.get('[class*="_startAttendanceTemplateList_"], [data-testid="lista-templates-waba"]'),
    linhasTemplate: () => cy.get('[class*="_startAttendanceTemplateRow_"]'),
    mensagemSemTemplate: () => cy.get('[data-testid="modal-iniciar-atendimento"]').contains('Nenhum template disponível'),

    // Áreas de Texto e Edição
    corpoMensagemPreview: () => cy.get('textarea#sa-template-body, [data-testid="textarea-template-preview"]'),
    textareaMensagem: () => cy.get('textarea#sa-message, [data-testid="textarea-mensagem"], [data-testid="textarea-mensagens"]'),
    textareaTemplateVariavel: () => cy.get('textarea#sa-template-text, [data-testid="textarea-template-text"]'),
    btnMensagemPadrao: () => cy.get('button[data-testid="button-mensagem-padrao"], button:contains("Mensagem Padrão")').first(),
    legendaWhatsAppOficial: () => cy.contains('p, span, div, label', /Este canal é WhatsApp Oficial|primeira mensagem precisa ser um template aprovado/i),

    // Painel de Mensagem Padrão
    painelMensagemPadrao: () => cy.get('div[class*="_startAttendanceStandardPanel_"], div[class*="_standardPanel_"], div[class*="standard"], [aria-label*="Mensagen"], div[role="dialog"] [class*="panel"], div[class*="popover"]'),
    loadingMensagemPadrao: () => cy.contains('div', 'Carregando...'),

    // Botões de Ação do Rodapé
    btnFechar: () => cy.get('footer, [class*="_startAttendanceFooter_"]').contains('button', 'Fechar'),
    btnLimpar: () => cy.get('[data-testid="start-attendance-clear"], [class*="_startAttendanceFooter_"] button:contains("Limpar"), footer button:contains("Limpar")'),
    btnEnviarMensagem: () => cy.get('[data-testid="button-enviar-atendimento"], [class*="_startAttendancePrimaryBtn_"], button:contains("Enviar mensagem")'),

    // Elementos da Lista e Detalhe de Atendimentos
    statusPillAtendimento: () => cy.get('[data-testid="button-cliente-status"], [class*="_infoStatusBtn_"], [class*="_statusPill_"], [data-testid*="status"]').first()
  };

  // -------------------------------------------------------------
  // MÉTODOS DE INTERAÇÃO DIRETA COM A UI (AÇÕES BÁSICAS)
  // -------------------------------------------------------------

  /**
   * Abre o modal de iniciar atendimento superando possíveis overlays de tela
   * e garante que o formulário e o campo de cliente terminaram de carregar.
   */
  abrirModal() {
    cy.get('body').then(($body) => {
      const modalAberto = $body.find('[data-testid="modal-iniciar-atendimento"]:visible, [class*="_startAttendanceModal_"]:visible').length > 0;
      if (!modalAberto) {
        this.elements.btnIniciarAtendimentoHeader().should('be.visible').click();
      }
    });
    this.elements.modalContainer().should('be.visible');
    this.elements.inputCliente().should('be.visible');
  }

  selecionarCanal(canalId) {
    this.elements.selectCanal().select(String(canalId), { force: true }).trigger('change');
  }

  selecionarGrupo(grupoId) {
    this.elements.selectGrupo().select(String(grupoId), { force: true }).trigger('change');
  }

  preencherCliente(nome) { this.elements.inputCliente().clear().type(nome); }

  digitarTermoBuscaCliente(termo, opcoes = {}) {
    const delay = opcoes.delay !== undefined ? opcoes.delay : 40;
    this.elements.inputCliente().clear().type(termo, { delay });
  }

  limparTermoBuscaCliente() {
    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="btn-limpar-cliente"]:visible').length > 0) {
        this.elements.btnLimparCliente().click();
      } else {
        this.elements.inputCliente().clear();
      }
    });
  }

  validarMensagemMinimoCaracteres() {
    this.elements.popoverSugestoesCliente().should('be.visible');
    this.elements.estadoMinimoCaracteres().should('be.visible');
  }

  validarEstadoBuscandoClientes() {
    this.elements.popoverSugestoesCliente().should('be.visible');
    this.elements.estadoBuscandoClientes().should('be.visible');
  }

  validarSugestaoClienteVisivel(nomeCliente) {
    this.elements.popoverSugestoesCliente().should('be.visible');
    this.elements.popoverSugestoesCliente().contains('[class*="_suggestName_"], button, span', nomeCliente).should('be.visible');
  }

  validarAusenciaTextoNasSugestoes(termoProibido) {
    this.elements.popoverSugestoesCliente().should('not.contain', termoProibido);
  }

  preencherCelular(celular) { this.elements.inputCelular().clear().type(celular); }

  preencherMensagem(texto) {
    cy.get('textarea#sa-template-text, textarea#sa-message, [data-testid="textarea-mensagem"], [data-testid="textarea-template-text"]')
      .first()
      .scrollIntoView()
      .should('be.visible')
      .clear()
      .type(texto);
  }

  limparMensagemTemplate() {
    this.elements.textareaTemplateVariavel()
      .scrollIntoView()
      .should('be.visible')
      .clear();
  }

  clicarEnviarMensagem() { this.elements.btnEnviarMensagem().click(); }
  clicarLimpar() { this.elements.btnLimpar().click(); }
  clicarFechar() { this.elements.btnFechar().click(); }
  clicarBtnMensagemPadrao() { this.elements.btnMensagemPadrao().click(); }

  selecionarTemplatePorNome(nomeTemplate) {
    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="linha-template-5208"]').length > 0 && nomeTemplate.includes('seis_variaveis')) {
        cy.get('[data-testid="linha-template-5208"]').scrollIntoView().click();
      } else {
        cy.get('[data-testid^="linha-template-"], [class*="_startAttendanceTemplateRow_"]')
          .filter(`:contains("${nomeTemplate}")`)
          .first()
          .scrollIntoView()
          .click();
      }
    });
  }

  /**
   * Valida que a prévia do template na modal Iniciar Atendimento reflete os tipos de variáveis definidos
   * @param {object} options
   */
  validarPreviaTemplateModal({
    clienteNomeRegex = /\[Nome do cliente\]|Klismam Monteiro|DAYANE|MARISTELA/i,
    saudacaoRegex = /\[Saudação\]|Bom dia|Boa tarde|Boa noite/i,
    atendenteRegex = /\[Apelido do atendente\]|Klismammonteiro|Klismam|FABRICIO|ITALO/i,
    textoFixo = 'OmniCare',
    clientePrimeiroNomeRegex = /\[Primeiro nome do cliente\]|Klismam|DAYANE|MARISTELA/i,
    textoVariavel = ''
  } = {}) {
    this.elements.corpoMensagemPreview()
      .scrollIntoView()
      .should('be.visible')
      .invoke('val')
      .then((textoPrevia) => {
        expect(textoPrevia, 'Prévia no modal deve conter o nome do cliente formatado').to.match(clienteNomeRegex);
        expect(textoPrevia, 'Prévia no modal deve conter saudação').to.match(saudacaoRegex);
        expect(textoPrevia, 'Prévia no modal deve conter atendente').to.match(atendenteRegex);
        expect(textoPrevia, 'Prévia no modal deve conter texto fixo cadastrado').to.include(textoFixo);
        expect(textoPrevia, 'Prévia no modal deve conter primeiro nome do cliente').to.match(clientePrimeiroNomeRegex);
        if (textoVariavel) {
          expect(textoPrevia, 'Prévia no modal deve conter a variável principal digitada').to.include(textoVariavel);
        }
        expect(textoPrevia, 'Prévia no modal não deve conter marcadores não resolvidos {{1}} a {{6}}').not.to.match(/\{\{\d+\}\}/);
      });
  }


  /**
   * Aguarda o carregamento conjunto de grupos e templates acionados na troca de canal
   */
  aguardarCarregamentoCanal() {
    cy.wait(['@getGruposCanal', '@getTemplatesWaba']);
  }

  /**
   * Digita o nome do cliente, aguarda o retorno da API /clients,
   * seleciona a primeira opção do dropdown e valida:
   *  - O nome do cliente preenchido no input do combobox
   *  - A exibição do fieldset de telefones registrados do cliente
   * @param {string} nome Termo de busca (mínimo 3 caracteres)
   */
  buscarESelecionarClienteViaAPI(nome) {
    cy.log(`🔍 [Ação]: Buscando cliente com termo "${nome}" no autocomplete e aguardando API...`);

    // Act: Digita o nome para acionar o autocomplete
    this.elements.inputCliente().clear().type(nome);

    // Assert (intermediário): Hint de "3 caracteres" não deve mais estar visível após digitar
    if (nome.length >= 3) {
      this.elements.hintDigiteCaracteres().should('not.exist');
    }

    // Aguarda o retorno da API de clientes
    return cy.wait('@searchClients').then((interception) => {
      const body = interception.response.body;
      const clientesLista = body.data || body.items || (Array.isArray(body) ? body : []);

      if (clientesLista.length === 0) {
        throw new Error(`[Erro de Teste] Nenhum cliente retornado pela API /clients para o termo buscado ("${nome}").`);
      }

      const clienteAlvo = clientesLista[0];
      cy.log(`✅ [Cliente Localizado]: ID ${clienteAlvo.id} - ${clienteAlvo.name}`);

      // Act: Clica na primeira opção do dropdown
      this.elements.opcoesDropdownCliente()
        .first()
        .should('be.visible')
        .click();

      // Assert: O input do combobox deve refletir o nome do cliente selecionado
      this.elements.inputCliente()
        .should('not.have.value', '')
        .invoke('val')
        .then((val) => {
          expect(val.trim().toLowerCase()).to.include(nome.toLowerCase());
        });

      // A escolha de telefone (fieldset com radios) só existe quando o cliente tem mais de um número
      // (`phone_count` da própria resposta; medido na API real em 2026-10-15: cliente com 1 telefone não
      // renderiza o fieldset e o número vem direto no campo Celular).
      if (clienteAlvo.phone_count === 1) {
        // Assert: Telefone único preenchido automaticamente no campo Celular, sem escolha
        this.elements.inputCelular().should('not.have.value', '');
      } else {
        // Assert: O fieldset com os telefones do cliente deve ser exibido
        this.elements.fieldsetTelefonesCliente()
          .scrollIntoView()
          .should('be.visible');

        // Assert: Pelo menos um número de telefone deve estar disponível para seleção
        this.elements.itensRadioTelefone()
          .should('have.length.gte', 1);
      }

      return cy.wrap(clienteAlvo);
    });
  }

  // -------------------------------------------------------------
  // SELEÇÃO E VALIDAÇÃO DINÂMICA VIA PAYLOAD (API)
  // -------------------------------------------------------------

  /**
   * Seleciona um canal do tipo WhatsApp Não Oficial identificado no payload da API /channels
   */
  selecionarCanalNaoOficialViaAPI() {
    const processar = (canaisLista) => {
      const canalNaoOficial = canaisLista.find(c => c.channel_subtype === 0);

      if (!canalNaoOficial) {
        throw new Error('[Erro de Teste] Nenhum canal NÃO OFICIAL (channel_subtype === 0) retornado pela API /channels.');
      }

      cy.log(`✅ Canal Não Oficial localizado no payload: ID ${canalNaoOficial.id} - ${canalNaoOficial.name}`);
      this.selecionarCanal(canalNaoOficial.id);
      return cy.wrap(canalNaoOficial);
    };

    const cached = Cypress.env('CHANNELS_CACHE');
    if (cached && cached.length > 0) {
      return processar(cached);
    }

    return cy.wait('@getChannels').then((interception) => {
      const body = interception.response.body;
      const canaisLista = body.items || (Array.isArray(body) ? body : []);
      Cypress.env('CHANNELS_CACHE', canaisLista);
      return processar(canaisLista);
    });
  }

  /**
   * Verifica no payload da API /channels se existe um canal WhatsApp Oficial e o seleciona na UI
   */
  validarESelecionarCanalOficialViaAPI() {
    const processar = (canaisLista) => {
      const canalOficial = canaisLista.find(c => c.channel_subtype === 1);

      if (!canalOficial) {
        throw new Error('[Erro de Teste] Nenhum canal do tipo WhatsApp OFICIAL (channel_subtype === 1) foi encontrado no payload da API /channels.');
      }

      cy.log(`✅ Canal Oficial localizado no payload: ID ${canalOficial.id} - ${canalOficial.name}`);
      this.selecionarCanal(canalOficial.id);
      return cy.wrap(canalOficial).as('canalOficialSelecionado');
    };

    const cached = Cypress.env('CHANNELS_CACHE');
    if (cached && cached.length > 0) {
      return processar(cached);
    }

    return cy.wait('@getChannels').then((interception) => {
      const body = interception.response.body;
      const canaisLista = body.items || (Array.isArray(body) ? body : []);
      Cypress.env('CHANNELS_CACHE', canaisLista);
      return processar(canaisLista);
    });
  }

  /**
   * A partir do canal validado, aguarda a rota de grupos/templates alimentada pelo ID desse canal,
   * valida a lista de grupos no payload e seleciona o primeiro grupo na UI
   */
  validarESelecionarGrupoDoCanalViaAPI() {
    // O campo "Grupo" só existe depois que o canal é selecionado e a lista de grupos chega: a espera é
    // ancorada na resposta de grupos e depois no próprio campo preenchido (opções além do placeholder),
    // com folga para a latência da API real (modo mock responde na hora, sem custo).
    return cy.wait(['@getGruposCanal', '@getTemplatesWaba'], { timeout: 30000 }).then((interceptions) => {
      const groupBody = interceptions[0].response.body;
      const templatesBody = interceptions[1].response.body;

      // Cacheia os templates retornados para uso nos testes
      cy.wrap(templatesBody).as('templatesBodyCache');

      const gruposLista = groupBody.items || (Array.isArray(groupBody) ? groupBody : []);

      if (gruposLista.length === 0) {
        throw new Error('[Erro de Teste] O payload de grupos para o canal selecionado retornou vazio.');
      }

      const grupoAlvo = gruposLista[0];
      cy.log(`✅ Grupo localizado no payload: ID ${grupoAlvo.id} - ${grupoAlvo.name}`);

      this.elements.selectGrupo({ timeout: 30000 })
        .should('not.be.disabled')
        .find('option')
        .should('have.length.gt', 1);

      this.selecionarGrupo(grupoAlvo.id);
      this.elements.selectGrupo().should('have.value', String(grupoAlvo.id));

      return cy.wrap(grupoAlvo).as('grupoSelecionado');
    });
  }

  // -------------------------------------------------------------
  // REGRAS DE NEGÓCIO E COMPONENTES COMPLEXOS
  // -------------------------------------------------------------

  /**
   * Seleciona o primeiro template disponível diretamente na lista da interface (UI).
   * Sem depender do cache da API, garantindo robustez caso os intercepts sejam sobrescritos (ex: E2E Real)
   */
  buscarESelecionarTemplateComVariavel() {
    const processar = (responseBody) => {
      const templates = responseBody.items || (Array.isArray(responseBody) ? responseBody : []);

      const templateComVariavel = templates.find((t) => {
        const temTextoComVariavel = t.body && /{{\d+}}/.test(t.body);
        const temArrayDeVariaveis = t.variables && t.variables.length > 0;
        return temTextoComVariavel || temArrayDeVariaveis;
      });

      if (templateComVariavel) {
        cy.log(`✅ Template COM variável localizado no payload: ${templateComVariavel.name}`);
        this.elements.linhasTemplate().contains('span', templateComVariavel.name).click();
      } else {
        cy.log('⚠️ Nenhum template COM variável localizado no payload.');
      }

      return cy.wrap(templateComVariavel || null);
    };

    const cacheEnv = Cypress.env('WABA_TEMPLATES_CACHE');
    if (cacheEnv) {
      const res = processar(cacheEnv);
      if (res) return res;
    }

    // Se não houver cache de API, seleciona diretamente da lista de templates visível na interface
    return cy.get('body').then(($body) => {
      const $linhas = $body.find('[class*="_startAttendanceTemplateRow_"]');
      const templatesComVariavelConhecidos = [
        'continuar_atendimento_util',
        'teste_utilidade',
        'continuidade_atendimento',
        'teste_seis_variaveis',
        'template_com_imagem'
      ];

      for (const nome of templatesComVariavelConhecidos) {
        const $linhaAlvo = $linhas.filter(`:contains("${nome}")`);
        if ($linhaAlvo.length > 0) {
          cy.log(`✅ [Template COM variável]: Selecionando "${nome}" diretamente da tela.`);
          cy.wrap($linhaAlvo).first().click();
          return cy.wrap({ name: nome, hasVariable: true });
        }
      }

      if ($linhas.length > 0) {
        cy.log('ℹ️ [Template UI]: Selecionando primeiro template da lista.');
        cy.wrap($linhas).first().click();
        return cy.wrap({ name: 'primeiro_template', hasVariable: true });
      }

      return cy.wrap(null);
    });
  }

  /**
   * Busca dinamicamente no cache da API o primeiro template SEM variável de texto editável e o seleciona na UI
   */
  buscarESelecionarTemplateSemVariavel() {
    const processar = (responseBody) => {
      const templates = responseBody.items || (Array.isArray(responseBody) ? responseBody : []);

      const templateSemVariavel = templates.find((t) => {
        const temTextoComVariavel = t.body && /{{\d+}}/.test(t.body);
        const temArrayDeVariaveis = t.variables && t.variables.length > 0;
        return !temTextoComVariavel && !temArrayDeVariaveis;
      });

      if (templateSemVariavel) {
        cy.log(`✅ Template SEM variável localizado no payload: ${templateSemVariavel.name}`);
        this.elements.linhasTemplate().contains('span', templateSemVariavel.name).click();
        return cy.wrap(templateSemVariavel);
      }
      cy.log('⚠️ Nenhum template SEM variável localizado no payload.');
      return null;
    };

    const cacheEnv = Cypress.env('WABA_TEMPLATES_CACHE');
    if (cacheEnv) {
      const res = processar(cacheEnv);
      if (res) return res;
    }

    return cy.get('body').then(($body) => {
      const $linhas = $body.find('[class*="_startAttendanceTemplateRow_"]');
      const templatesSemVariavelConhecidos = [
        'envio_imagem',
        'finalizar_atendimento',
        'rastreablidade'
      ];

      for (const nome of templatesSemVariavelConhecidos) {
        const $linhaAlvo = $linhas.filter(`:contains("${nome}")`);
        if ($linhaAlvo.length > 0) {
          cy.log(`✅ [Template SEM variável]: Selecionando "${nome}" diretamente da tela.`);
          cy.wrap($linhaAlvo).first().click();
          return cy.wrap({ name: nome, hasVariable: false });
        }
      }

      if ($linhas.length > 0) {
        cy.wrap($linhas).first().click();
        return cy.wrap({ name: 'primeiro_template', hasVariable: false });
      }

      return cy.wrap(null);
    });
  }

  /**
   * Abre o painel de mensagens padrão e clica dinamicamente na primeira mensagem
   */
  selecionarMensagemPadraoViaAPI() {
    this.clicarBtnMensagemPadrao();

    const listaMensagens = IniciarAtendimentoMocks.mockStandardMessagesData.data || [];
    const mensagemAlvo = listaMensagens[0] || { code: '183', title: 'FARMULA ESMALTE FORTALECEDOR', content: 'Farmula tem uma solução' };

    cy.log(`Mensagem padrão selecionada - Code: ${mensagemAlvo.code} | Title: ${mensagemAlvo.title}`);

    cy.contains('div, button, span, p, li', new RegExp(mensagemAlvo.title || mensagemAlvo.code, 'i'), { timeout: 10000 })
      .first()
      .click();

    return cy.wrap(mensagemAlvo);
  }

  /**
   * Valida se a aplicação foi redirecionada para a tela de Atendimentos com a conversa/fila renderizada
   */
  validarStatusAtendimentoAtivo() {
    cy.contains('h1, h2, header', 'Atendimentos', { timeout: 15000 }).should('be.visible');

    // Confirma que a área de conversa/atendimento ativo ou fila está renderizada
    cy.get('section[aria-label="Attendance list"], [data-testid="chat-header"], header:has(h2), [data-testid="card-cliente"], [class*="_conversation_"]', { timeout: 15000 })
      .should('be.visible');
  }

  /**
   * Valida que a legenda restritiva do WhatsApp Oficial não está presente no modal
   */
  validarAusenciaLegendaWhatsAppOficial() {
    cy.contains('p, span, div, label', /Este canal é WhatsApp Oficial|primeira mensagem precisa ser um template aprovado/i)
      .should('not.exist');
  }
}

export default new IniciarAtendimentoPage();