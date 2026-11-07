import IniciarAtendimentoPage from '../pages/4.iniciarAtendimentoPage';
import IniciarAtendimentoMocks from '../mocks/4.iniciarAtendimentoMocks';
import AtendimentosMocks from '../mocks/5.atendimentosMocks';
const configEnv = require('../../env.json');

// Aproveita as variáveis globais configuradas no env.json / commands.js
const CELULAR_PADRAO = Cypress.env('DEFAULT_CELULAR') || configEnv.DEFAULT_CELULAR || '11999998888';
const CLIENT_NAME = Cypress.env('DEFAULT_CLIENT_NAME') || configEnv.DEFAULT_CLIENT_NAME || 'klismam';

describe('4. Iniciar Atendimento - Testes de Interface e Comportamento', () => {

  beforeEach(() => {
    // 1. Arrange: Efetua login e garante que a aplicação carregou (executado antes para evitar que conexões abortadas da sessão colidam com os intercepts de gravação)
    cy.login();
    cy.get('body').should('be.visible');

    // 2. Arrange: Prepara o ambiente interceptando as chamadas principais do modal e da transição
    IniciarAtendimentoMocks.interceptarCanais();
    IniciarAtendimentoMocks.interceptarBuscaGrupos();
    IniciarAtendimentoMocks.interceptarBuscaTemplatesWaba();
    IniciarAtendimentoMocks.interceptarMensagensPadrao();
    IniciarAtendimentoMocks.interceptarStandardMessageCapabilities();
    IniciarAtendimentoMocks.interceptarBuscaCliente();
    IniciarAtendimentoMocks.interceptarPhonesCliente();
    AtendimentosMocks.interceptUserMeApi();
    AtendimentosMocks.interceptSummaryApi();
    AtendimentosMocks.interceptAttendancesListApi();
    AtendimentosMocks.interceptAttendanceDetailApi();
    AtendimentosMocks.interceptMessagesListApi();
    AtendimentosMocks.interceptAttendanceCapabilitiesApi();
    AtendimentosMocks.interceptAttendanceItemCapabilitiesApi('*');
    AtendimentosMocks.interceptAttendanceMessageTemplatesApi('*');
    AtendimentosMocks.interceptBudgetsApi('*');
    AtendimentosMocks.interceptPaymentLinksApi('*');
    AtendimentosMocks.interceptMockAgentsGroup('*');
    AtendimentosMocks.interceptObservationsApi();
    AtendimentosMocks.interceptInternalNotesApi('*');
    AtendimentosMocks.interceptAttendanceEventsApi();

    // 3. Act: Aciona o botão do header para iniciar o atendimento (com force para evitar overlay)
    IniciarAtendimentoPage.abrirModal();

    // 4. Assert (Precondição): Confirma que o modal está renderizado para os testes
    IniciarAtendimentoPage.elements.modalContainer().should('be.visible');
  });

  // -------------------------------------------------------------
  // 1. AÇÕES BÁSICAS DO MODAL (LIMPAR E FECHAR)
  // -------------------------------------------------------------
  context('1. Estrutura Visual e Ações Iniciais do Modal', () => {

    it('1.1 deve limpar todos os campos ao clicar no botão Limpar', () => {
      // Arrange: Suja o formulário preenchendo o número de telefone
      IniciarAtendimentoPage.preencherCelular(CELULAR_PADRAO);

      // Act: Clica no botão de limpar do rodapé
      IniciarAtendimentoPage.clicarLimpar();

      // Assert: O campo alvo deve retornar ao estado vazio
      IniciarAtendimentoPage.elements.inputCelular().should('have.value', '');
    });

    it('1.2 deve fechar o modal ao clicar no botão Fechar', () => {
      // Act: Aciona a ação de fechar modal
      IniciarAtendimentoPage.clicarFechar();

      // Assert: O modal deve ser removido do DOM
      IniciarAtendimentoPage.elements.modalContainer().should('not.exist');
    });

    it('1.3 deve exibir todos os elementos principais do modal ao abrir', () => {
      // Assert: título, seletores principais e campos do formulário. "Grupo" fica de fora —
      // achado real (2026-10-07): só é renderizado depois que um canal é selecionado (cascata),
      // não existe no DOM na abertura inicial do modal (confirmado via last-failure-dom.html).
      IniciarAtendimentoPage.elements.tituloModal().should('be.visible');
      IniciarAtendimentoPage.elements.selectCanal().should('be.visible');
      IniciarAtendimentoPage.elements.inputCliente().should('be.visible');
      IniciarAtendimentoPage.elements.inputCelular().should('be.visible');

      // Assert: botões de ação do rodapé
      IniciarAtendimentoPage.elements.btnLimpar().should('be.visible');
      IniciarAtendimentoPage.elements.btnFechar().should('be.visible');
      IniciarAtendimentoPage.elements.btnFecharModalX().should('be.visible');
      IniciarAtendimentoPage.elements.btnEnviarMensagem().should('be.visible');
    });

  });

  // -------------------------------------------------------------
  // 2. COMPORTAMENTO DINÂMICO POR TIPO DE CANAL
  // -------------------------------------------------------------
  context('2. Comportamento por Tipo de Canal (Oficial vs. Não Oficial)', () => {

    it('2.1 deve carregar a seção de Templates WABA ao selecionar um canal do tipo WhatsApp Oficial', () => {
      // Act: Seleciona o canal oficial validado dinamicamente no payload da API
      IniciarAtendimentoPage.validarESelecionarCanalOficialViaAPI();

      // Arrange (Espera): Aguarda as chamadas engatilhadas de grupo e template
      IniciarAtendimentoPage.aguardarCarregamentoCanal();

      // Assert: Realiza scroll e confirma a renderização da tabela de templates e do botão de envio
      IniciarAtendimentoPage.elements.tabelaTemplatesWaba()
        .scrollIntoView()
        .should('be.visible');

      IniciarAtendimentoPage.elements.btnEnviarMensagem().should('be.visible');
    });

    it('2.2 deve liberar o campo de mensagem para digitação livre e remover a legenda de WhatsApp Oficial ao selecionar canal WhatsApp Não Oficial', () => {
      // Act 1: Seleciona o canal do tipo WhatsApp Não Oficial identificado na API (channel_subtype === 0)
      IniciarAtendimentoPage.selecionarCanalNaoOficialViaAPI();

      // Arrange (Espera): Canais não oficiais carregam apenas grupos
      cy.wait('@getGruposCanal');

      // Assert 1 (Regra de Negócio): Canal Não Oficial não deve renderizar tabela de templates WABA
      IniciarAtendimentoPage.elements.tabelaTemplatesWaba().should('not.exist');

      // Assert 2 (Regra de Negócio): A legenda/instrução restritiva do WhatsApp Oficial não deve existir
      IniciarAtendimentoPage.validarAusenciaLegendaWhatsAppOficial();

      // Act 2: Preenche os dados obrigatórios de telefone do cliente
      IniciarAtendimentoPage.preencherCelular(CELULAR_PADRAO);

      // Assert 3: O campo de texto livre de mensagem deve estar visível, habilitado e permitir digitação real
      IniciarAtendimentoPage.elements.textareaMensagem()
        .should('be.visible')
        .and('be.enabled')
        .clear()
        .type('Mensagem inicial de texto livre em canal WhatsApp Não Oficial.')
        .should('have.value', 'Mensagem inicial de texto livre em canal WhatsApp Não Oficial.');

      // Assert 4: Os botões de mensagem padrão e de envio de mensagem devem estar disponíveis
      IniciarAtendimentoPage.elements.btnMensagemPadrao().should('be.visible');
      IniciarAtendimentoPage.elements.btnEnviarMensagem().should('be.visible');
    });

  });

  // -------------------------------------------------------------
  // 3. VALIDAÇÕES DE CAMPOS, MÁSCARAS E BUSCAS
  // -------------------------------------------------------------
  context('3. Validações do Campo Celular, Mensagem Padrão e Busca de Cliente', () => {

    it('3.1 deve aceitar DDD + número e rejeitar letras no campo Celular (Máscara)', () => {
      // Arrange & Act: Simula o usuário digitando letras misturadas com números
      IniciarAtendimentoPage.preencherCelular(`abc${CELULAR_PADRAO}xyz`);

      // Assert: Garante que apenas os caracteres numéricos sobreviveram à máscara
      IniciarAtendimentoPage.elements.inputCelular().invoke('val').then((val) => {
        const apenasNumeros = val.replace(/\D/g, '');
        expect(apenasNumeros).to.equal(CELULAR_PADRAO);
      });
    });

    it('3.2 deve injetar o conteúdo da mensagem padrão na área de texto ao selecioná-la no painel', () => {
      // Arrange: Seleciona canal não oficial para liberar o campo de mensagem livre e o botão de mensagens padrão
      IniciarAtendimentoPage.selecionarCanalNaoOficialViaAPI();
      cy.wait('@getGruposCanal');
      IniciarAtendimentoPage.elements.textareaMensagem().should('be.visible');

      // Act: Seleciona a primeira mensagem padrão dinâmica retornada pela API
      IniciarAtendimentoPage.selecionarMensagemPadraoViaAPI().then((mensagemInjetada) => {
        // Assert: Valida se o texto injetado na textarea condiz com o conteúdo retornado pela API (normalizando quebras de linha CRLF/LF)
        IniciarAtendimentoPage.elements.textareaMensagem()
          .should('not.have.value', '')
          .invoke('val')
          .should((val) => {
            const normalizarTexto = (str) => (str || '').replace(/\r\n/g, '\n').trim();
            expect(normalizarTexto(val)).to.include(normalizarTexto(mensagemInjetada.content));
          });
      });
    });

    it('3.3 deve permitir buscar e selecionar um cliente cadastrado da base', () => {
      // Arrange: Mapeia o disparo da rota de busca de clientes
      IniciarAtendimentoMocks.interceptarBuscaCliente();

      // Act + Assert: Digita o nome, aguarda API, seleciona no dropdown
      //               e valida o nome preenchido + os números do cliente carregados
      IniciarAtendimentoPage.buscarESelecionarClienteViaAPI(CLIENT_NAME);
    });

  });

  // -------------------------------------------------------------
  // 3.1. OTIMIZAÇÃO DA BUSCA DE CLIENTES (DEBOUNCE, LIMITE MÍNIMO E RACE CONDITION)
  // -------------------------------------------------------------
  context('4. Otimização da Busca de Clientes (Debounce, Limite Mínimo e Prevenção de Race Condition)', () => {

    let originalUseMocksState;

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      // Blindagem contra a variável global: força modo 100% mockado
      Cypress.env('USE_MOCKS', true);
      Cypress.env('USE_MOCKS_FORCED_BY_TEST', true);
    });

    after(() => {
      // Restaura o ambiente para a configuração original
      Cypress.env('USE_MOCKS', originalUseMocksState);
      Cypress.env('USE_MOCKS_FORCED_BY_TEST', false);
    });

    it('4.1 deve exigir ao menos 3 caracteres no campo Cliente e não disparar requisição HTTP para termos curtos', () => {
      // 1. Arrange: Registra intercept da rota de clientes como espião na fila assíncrona do Cypress
      cy.then(() => {
        IniciarAtendimentoMocks.interceptarBuscaClienteSpy();
      });

      // 2. Act: Digita termo com apenas 1 caractere ('a')
      IniciarAtendimentoPage.digitarTermoBuscaCliente('a');

      // 3. Assert: O popover deve exibir a instrução de limite mínimo de 3 caracteres
      IniciarAtendimentoPage.validarMensagemMinimoCaracteres();

      // Act: Digita mais um caractere, totalizando 2 caracteres ('ab')
      IniciarAtendimentoPage.digitarTermoBuscaCliente('ab');

      // Assert: A interface continua exigindo ao menos 3 caracteres e nenhuma requisição foi disparada
      IniciarAtendimentoPage.validarMensagemMinimoCaracteres();
      cy.wait(400); // Aguarda além do tempo padrão de debounce de 300ms
      cy.get('@searchClientsSpy.all').should('have.length', 0);
    });

    it('4.2 deve aplicar debounce de 300ms e consolidar uma única requisição HTTP com o termo final digitado', () => {
      // 1. Arrange: Intercepta a rota com suporte a debounce e monitora o parâmetro 'q'
      cy.then(() => {
        IniciarAtendimentoMocks.interceptarBuscaClienteComDebounceERaceCondition();
      });

      // 2. Act: Digita o termo 'maria' de forma contínua (com delay entre teclas inferior ao debounce de 300ms)
      IniciarAtendimentoPage.digitarTermoBuscaCliente('maria', { delay: 40 });

      // 3. Assert: A requisição HTTP só deve ser emitida após o operador pausar a digitação, contendo o termo consolidado
      cy.wait('@searchClients').then((interception) => {
        const url = new URL(interception.request.url);
        expect(url.searchParams.get('q')).to.equal('maria');
      });

      // Assert: A lista exibe o cliente retornado pela consulta consolidada
      IniciarAtendimentoPage.validarSugestaoClienteVisivel('MARIA SILVA');
    });

    it('4.3 deve exibir o indicador "Buscando clientes..." e nunca renderizar registros da busca anterior enquanto a nova consulta estiver em voo', () => {
      // 1. Arrange: Configura resposta imediata para 'maria' e atraso intencional de 800ms para 'jose' (simulando requisição em voo)
      cy.then(() => {
        IniciarAtendimentoMocks.interceptarBuscaClienteComDebounceERaceCondition({ delayJoseMs: 800 });
      });

      // 2. Act 1: Busca 'maria' e aguarda a renderização das opções
      IniciarAtendimentoPage.digitarTermoBuscaCliente('maria');
      cy.wait('@searchClients');
      IniciarAtendimentoPage.validarSugestaoClienteVisivel('MARIA SILVA');

      // 3. Act 2: Limpa o campo e digita imediatamente o novo termo 'jose'
      IniciarAtendimentoPage.limparTermoBuscaCliente();
      IniciarAtendimentoPage.digitarTermoBuscaCliente('jose');

      // 4. Assert Mandatório (Issue PR #335 / #337):
      // Enquanto a nova chamada de 'jose' está em voo, a lista DEVE exibir "Buscando clientes..."
      // e NUNCA exibir registros obsoletos da busca anterior ('MARIA SILVA'), evitando vínculo incorreto
      IniciarAtendimentoPage.validarEstadoBuscandoClientes();
      IniciarAtendimentoPage.validarAusenciaTextoNasSugestoes('MARIA SILVA');

      // 5. Assert: Ao concluir a requisição em voo, o novo resultado é exibido com sucesso
      cy.wait('@searchClients');
      IniciarAtendimentoPage.validarSugestaoClienteVisivel('JOSE SANTOS');
    });

  });

  // -------------------------------------------------------------
  // 4. REGRAS DO BOTÃO DE ENVIO, TEMPLATES E REDIRECIONAMENTO (MOCKS)
  // -------------------------------------------------------------
  context('5. Regras do Formulário, Templates WABA e Redirecionamento da API', () => {

    it('5.1 deve manter o botão Enviar Mensagem desabilitado se nenhum template for selecionado', () => {
      // Arrange (Pré-condição 1): Seleciona canal oficial e confirma a seleção na UI
      IniciarAtendimentoPage.validarESelecionarCanalOficialViaAPI();
      IniciarAtendimentoPage.elements.selectCanal()
        .should('not.have.value', '')
        .and('not.have.value', 'null');

      // Arrange (Pré-condição 2): Seleciona grupo do canal e confirma a seleção na UI
      IniciarAtendimentoPage.validarESelecionarGrupoDoCanalViaAPI();
      IniciarAtendimentoPage.elements.selectGrupo()
        .should('not.have.value', '')
        .and('not.have.value', 'null');

      // Arrange (Pré-condição 3): Preenche o celular
      IniciarAtendimentoPage.preencherCelular(CELULAR_PADRAO);
      IniciarAtendimentoPage.elements.inputCelular().should('not.have.value', '');

      // Assert (Regra de Negócio): Canal oficial exige template selecionado
      IniciarAtendimentoPage.elements.btnEnviarMensagem().should('be.disabled');
    });

    it('5.2 deve habilitar o botão Enviar Mensagem após selecionar um template WABA sem variáveis', () => {
      // Arrange: Seleciona Canal Oficial e Grupo dinamicamente via API
      IniciarAtendimentoPage.validarESelecionarCanalOficialViaAPI();
      IniciarAtendimentoPage.validarESelecionarGrupoDoCanalViaAPI();

      // Act: Preenche o celular e seleciona template sem variável da API
      IniciarAtendimentoPage.preencherCelular(CELULAR_PADRAO);
      IniciarAtendimentoPage.buscarESelecionarTemplateSemVariavel().then((templateEncontrado) => {
        if (!templateEncontrado) {
          cy.log('⚠️ [SKIP] Nenhum template sem variável retornado na API para este canal.');
          return this.skip();
        }

        // Assert: Botão deve estar habilitado para disparo imediato
        IniciarAtendimentoPage.elements.btnEnviarMensagem().should('be.enabled');
      });
    });

    it('5.3 deve exigir o preenchimento de variáveis de texto antes de habilitar o botão Enviar Mensagem', function () {
      // Arrange: Seleciona Canal Oficial e Grupo dinamicamente via API
      IniciarAtendimentoPage.validarESelecionarCanalOficialViaAPI();
      IniciarAtendimentoPage.validarESelecionarGrupoDoCanalViaAPI();

      // Act: Preenche o celular e seleciona template com variável
      IniciarAtendimentoPage.preencherCelular(CELULAR_PADRAO);
      IniciarAtendimentoPage.buscarESelecionarTemplateComVariavel().then((templateEncontrado) => {
        if (!templateEncontrado) {
          cy.log('⚠️ [SKIP] Nenhum template COM variável retornado na API para este canal.');
          return this.skip();
        }

        // Assert: Com a variável vazia, o botão deve permanecer desabilitado
        IniciarAtendimentoPage.limparMensagemTemplate();
        IniciarAtendimentoPage.elements.btnEnviarMensagem().should('be.disabled');

        // Act: Preenche o campo de texto obrigatório da variável
        IniciarAtendimentoPage.preencherMensagem('Variável preenchida com sucesso');

        // Assert: O botão deve ser habilitado imediatamente
        IniciarAtendimentoPage.elements.btnEnviarMensagem().should('be.enabled');
      });
    });

    it('5.4 deve habilitar o botão Enviar Mensagem após preencher todas as variáveis de texto do template', function () {
      // Arrange: Seleciona Canal Oficial e Grupo dinamicamente via API
      IniciarAtendimentoPage.validarESelecionarCanalOficialViaAPI();
      IniciarAtendimentoPage.validarESelecionarGrupoDoCanalViaAPI();

      // Act: Preenche o celular e seleciona o template com variável
      IniciarAtendimentoPage.preencherCelular(CELULAR_PADRAO);
      IniciarAtendimentoPage.buscarESelecionarTemplateComVariavel().then((templateEncontrado) => {
        if (!templateEncontrado) {
          cy.log('⚠️ [SKIP] O template selecionado não possui variáveis.');
          return this.skip();
        }

        IniciarAtendimentoPage.preencherMensagem('Variável preenchida com sucesso');

        // Assert: Condições perfeitas, botão liberado
        IniciarAtendimentoPage.elements.btnEnviarMensagem().should('be.enabled');
      });
    });

    // -------------------------------------------------------------
    // 5. PRESERVAÇÃO DE MENSAGEM AO REAPROVEITAR ATENDIMENTO EXISTENTE (WHATSAPP OFICIAL)
    // -------------------------------------------------------------
    context('6. Preservação de Mensagem da Modal no Chat (Janela Ativa vs Janela Inativa)', () => {

      it('6.1 deve redirecionar para conversa existente com Janela Ativa e carregar a mensagem com template bloqueado no compositor', () => {
        const textoMensagem = 'Variável do template para janela ativa';
        const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';

        // 1. Arrange: Mocks para número e atendimento existente com Janela Ativa
        IniciarAtendimentoMocks.interceptarChecagemWhatsapp(CELULAR_PADRAO);
        IniciarAtendimentoMocks.interceptarCriacaoAtendimentoReutilizado(true, 260800148);

        if (isMock) {
          AtendimentosMocks.interceptMockDetalheComJanelaHoras({
            attendanceId: 260800148,
            horasRestantes: 20,
            canSendFreeText: true,
            serviceWindowActive: true
          });
          AtendimentosMocks.interceptAttendanceItemCapabilitiesApi(260800148);
          AtendimentosMocks.interceptMessagesListApi(260800148, AtendimentosMocks.mockMessagesAtivas);
          AtendimentosMocks.interceptAttendanceMessageTemplatesApi(260800148);
        }

        // 2. Act: Seleciona Canal Oficial e Grupo dinamicamente via API
        IniciarAtendimentoPage.validarESelecionarCanalOficialViaAPI();
        IniciarAtendimentoPage.validarESelecionarGrupoDoCanalViaAPI();

        // 3. Act: Preenche celular do contato com atendimento aberto
        IniciarAtendimentoPage.preencherCelular(CELULAR_PADRAO);

        // 4. Act: Seleciona template com variável e preenche o texto na modal
        IniciarAtendimentoPage.buscarESelecionarTemplateComVariavel().then(() => {
          IniciarAtendimentoPage.preencherMensagem(textoMensagem);

          // 5. Act: Clica em Enviar Mensagem
          IniciarAtendimentoPage.clicarEnviarMensagem();

          // 6. Assert: Transição para a conversa existente e fechamento do modal
          IniciarAtendimentoPage.elements.modalContainer().should('not.exist');
          cy.url({ timeout: 15000 }).should('include', '/atendimentos');
          IniciarAtendimentoPage.validarStatusAtendimentoAtivo();

          // 7. Assert (Janela Ativa): Regra validada com o time — mesmo com janela ativa, o direcionamento
          // agora ocorre sempre via template bloqueado no compositor (mesmo comportamento da Janela Inativa)
          cy.get('[class*="_templateLockedBar_"]', { timeout: 15000 }).should('be.visible');
          cy.get('textarea[data-testid="input-message"], [data-testid="textarea-mensagem"]')
            .should('be.visible')
            .invoke('val')
            .should('include', textoMensagem);
        });
      });

      it('6.2 deve redirecionar para conversa existente com Janela Inativa e carregar a mensagem com template no compositor', () => {
        const textoVariavel = 'Variável do template para janela inativa';
        const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';

        // 1. Arrange: Força detalhe do atendimento com Janela Inativa (service_window_active: false)
        IniciarAtendimentoMocks.interceptarChecagemWhatsapp(CELULAR_PADRAO);
        IniciarAtendimentoMocks.interceptarCriacaoAtendimentoReutilizado(true, 260800149);

        if (isMock) {
          AtendimentosMocks.interceptMockDetalheJanelaExpirada(260800149);
          AtendimentosMocks.interceptAttendanceMessageTemplatesApi(260800149);
        } else {
          AtendimentosMocks.interceptMockDetalheJanelaExpirada('*');
        }

        // 2. Act: Seleciona Canal Oficial e Grupo
        IniciarAtendimentoPage.validarESelecionarCanalOficialViaAPI();
        IniciarAtendimentoPage.validarESelecionarGrupoDoCanalViaAPI();

        // 3. Act: Preenche celular
        IniciarAtendimentoPage.preencherCelular(CELULAR_PADRAO);

        // 4. Act: Seleciona template com variável e preenche o texto
        IniciarAtendimentoPage.buscarESelecionarTemplateComVariavel().then(() => {
          IniciarAtendimentoPage.preencherMensagem(textoVariavel);

          // 5. Act: Clica em Enviar Mensagem
          IniciarAtendimentoPage.clicarEnviarMensagem();

          // 6. Assert: Modal fecha e rota vai para /atendimentos
          IniciarAtendimentoPage.elements.modalContainer().should('not.exist');
          cy.url({ timeout: 15000 }).should('include', '/atendimentos');
          IniciarAtendimentoPage.validarStatusAtendimentoAtivo();

          // 7. Assert (Janela Inativa): Carrega no compositor a mensagem com template (template montado / variável preenchida)
          cy.get('body').then(($body) => {
            if ($body.find('textarea#sa-template-text, [data-testid="textarea-template-text"], [data-testid="input-template-variable"]').length > 0) {
              cy.get('textarea#sa-template-text, [data-testid="textarea-template-text"], [data-testid="input-template-variable"]')
                .should('be.visible')
                .invoke('val')
                .should('include', textoVariavel);
            } else if ($body.find('[class*="_templateLockedBar_"], [data-testid="button-cancel-template"]').length > 0) {
              cy.get('[class*="_templateLockedBar_"]').should('be.visible');
              cy.get('textarea[data-testid="input-message"], [data-testid="textarea-mensagem"]')
                .invoke('val')
                .should('include', textoVariavel);
            } else {
              cy.get('textarea[data-testid="input-message"], [data-testid="textarea-mensagem"]')
                .should('be.visible')
                .invoke('val')
                .should('include', textoVariavel);
            }
          });
        });
      });

    });
  });

  // -------------------------------------------------------------
  // 6. BUSCA DE CLIENTES SEM DISTINÇÃO DE ACENTO E CAIXA (API REAL)
  // -------------------------------------------------------------
  context('7. Busca de Clientes sem Distinção de Acento e Caixa (Issue backend#628/PR #629)', () => {

    // Contra o backend real: o filtro é do servidor (COLLATE WIN_PTBR), então mock não prova nada.
    // Massa fixa do tenant de teste: "SÃO" e "SAO" gravados como clientes distintos.
    let originalUseMocksState;
    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', false);
    });
    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    it('7.1 deve listar juntos "SÃO" e "SAO" ao digitar o termo sem acento, com acento ou em maiúsculas no campo Cliente', () => {
      ['sao', 'são', 'SÃO'].forEach((termo) => {
        IniciarAtendimentoPage.digitarTermoBuscaCliente(termo);
        cy.wait('@searchClients').its('request.url').should('include', 'q=');
        IniciarAtendimentoPage.validarSugestaoClienteVisivel('SÃO');
        IniciarAtendimentoPage.validarSugestaoClienteVisivel('SAO');
      });
    });

    it('7.2 deve achar o nome gravado com acento ("CONCEIÇÃO") ao digitar "conceicao" e manter o recorte mínimo de 3 caracteres', () => {
      // Menos de 3 caracteres: só a instrução, sem requisição
      IniciarAtendimentoPage.digitarTermoBuscaCliente('co');
      IniciarAtendimentoPage.validarMensagemMinimoCaracteres();

      IniciarAtendimentoPage.digitarTermoBuscaCliente('conceicao');
      cy.wait('@searchClients').then((interception) => {
        const itens = interception.response.body.items;
        expect(itens.length, 'clientes devolvidos para "conceicao"').to.be.at.least(1);
        const comAcento = itens.find((c) => /CONCEIÇÃO/.test(c.name));
        expect(comAcento, 'a massa deve ter ao menos 1 cliente gravado como CONCEIÇÃO').to.exist;
        IniciarAtendimentoPage.validarSugestaoClienteVisivel(comAcento.name);
      });
    });

  });

});