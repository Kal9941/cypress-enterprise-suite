import AtendimentosPage from '../pages/5.atendimentosPage';
import AtendimentosMocks from '../mocks/5.atendimentosMocks';
import IniciarAtendimentoMocks from '../mocks/4.iniciarAtendimentoMocks';
import api from '../services/backendApiService';
const configEnv = require('../../env.json');
import { regexApi, rotaApi } from '../support/rotaApi';

// Captura os dados configurados em env.json
const CELULAR_PADRAO = Cypress.env('DEFAULT_CELULAR') || Cypress.env('defaultCelular') || configEnv.DEFAULT_CELULAR || '11999998888';
const ULTIMOS_4_DIGITOS_CELULAR = CELULAR_PADRAO.slice(-4);

describe('5-A. Atendimentos - Fila e Status', () => {

  beforeEach(() => {
    // 1. Autenticação via sessão (executado antes para evitar que requisições temporárias da sessão colidam com os intercepts de gravação)
    cy.login();

    // 2. Arrange: Configura interceptações centralizadas na classe de Mocks
    AtendimentosMocks.interceptUserMeApi();
    AtendimentosMocks.interceptSummaryApi();
    AtendimentosMocks.interceptAttendancesListApi();
    AtendimentosMocks.interceptSearchApi();
    AtendimentosMocks.interceptAttendanceCapabilitiesApi();
    AtendimentosMocks.interceptAttendanceItemCapabilitiesApi('*');
    AtendimentosMocks.interceptAttendanceDetailApi('*');
    AtendimentosMocks.interceptMessagesListApi('*');
    AtendimentosMocks.interceptAttendanceMessageTemplatesApi('*');
    AtendimentosMocks.interceptBudgetsApi('*');
    AtendimentosMocks.interceptMockAgentsGroup('*');
    AtendimentosMocks.interceptAttendanceEventsApi();
    AtendimentosMocks.interceptAttendanceChannelsApi();
    AtendimentosMocks.interceptAttendantStatusApi();
    AtendimentosMocks.interceptUpdateAttendantStatusApi();
    AtendimentosMocks.interceptUpdateAttendanceStatusApi();
    AtendimentosMocks.interceptObservationsApi();
    IniciarAtendimentoMocks.interceptarCanais();
    IniciarAtendimentoMocks.interceptarBuscaGrupos();
    IniciarAtendimentoMocks.interceptarBuscaTemplatesWaba();
    IniciarAtendimentoMocks.interceptarMensagensPadrao();
    IniciarAtendimentoMocks.interceptarStandardMessageCapabilities();

    // 3. Act: Visita a rota da tela de Atendimentos e confirma a renderização inicial da UI
    AtendimentosPage.visitar();
    AtendimentosPage.elements.tituloAtendimentos().should('be.visible');
  });

  // -------------------------------------------------------------
  // 1. ESTRUTURA VISUAL, CONTADORES E STATUS DA FILA
  // -------------------------------------------------------------

  context('1. Estrutura Visual, Contadores e Status da Fila', () => {

    it('1.1 deve carregar a tela de atendimentos com a barra de filtros, campo de busca e lista de cards', () => {
      // Assert
      AtendimentosPage.elements.tituloAtendimentos().should('be.visible');
      AtendimentosPage.elements.inputBusca()
        .should('be.visible')
        .invoke('attr', 'placeholder')
        .should('match', /Buscar/i);

      AtendimentosPage.elements.statusFilterBar().should('be.visible');
      AtendimentosPage.elements.listaAtendimentosSection().should('be.visible');
      AtendimentosPage.elements.cardsAtendimento().should('exist');
    });

    const mockSummary = {
      counts: {
        all: 130,
        pending: 13,
        in_progress: 2,
        completed: 0,
        finished: 114,
        discarded: 1,
        waiting: 15
      }
    };

    it('1.2 deve exibir os contadores das abas superiores de acordo com o payload de /summary', () => {
      // Arrange: Intercepta com o mock determinístico de summary e recarrega a página para atualizar o estado
      AtendimentosMocks.interceptSummaryApi(mockSummary);
      cy.reload();
      cy.wait('@getAttendancesSummary');

      // Act: Força o status "Todos"
      AtendimentosPage.filtrarPorStatusChip('all');

      // Assert: Compara cada chip superior com os números do payload
      AtendimentosPage.validarContadoresAbasComPayload(mockSummary.counts);
    });

    it('1.3 deve refletir os contadores de status no menu lateral conforme o payload de /summary', () => {
      // Arrange: Intercepta com o mock determinístico de summary e recarrega a página para atualizar o estado
      AtendimentosMocks.interceptSummaryApi(mockSummary);
      cy.reload();
      cy.wait('@getAttendancesSummary');

      // Act: Força o status "Todos"
      AtendimentosPage.filtrarPorStatusChip('all');

      // Assert: Compara os valores exibidos na sidebar
      AtendimentosPage.validarContadoresSidebarComPayload(mockSummary.counts);
    });

    it('1.4 deve selecionar o chip de status ao clicar nas abas superiores', () => {
      // Act: Clica no chip "Em andamento"
      AtendimentosPage.filtrarPorStatusChip('in_progress');

      // Assert: Valida estado ativo do botão
      AtendimentosPage.elements.chipInProgress()
        .should('have.attr', 'aria-pressed', 'true');
    });

  });

  // -------------------------------------------------------------
  // 2. FUNCIONALIDADE DO CAMPO DE BUSCA
  // -------------------------------------------------------------

  context('2. Funcionalidade do Campo de Busca', () => {

    beforeEach(() => {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';
      if (!isMock) {
        // Limpa os mocks para interagir diretamente com a API e banco de dados real
        AtendimentosMocks.clearMocksForRealE2ETests();
      }
    });

    it('2.1 deve disparar a busca na API ao digitar os 4 últimos dígitos do celular (definido em env.json)', () => {
      // Act 1: Garante o filtro padrão "Aguardando" para localizar o atendimento na fila
      AtendimentosPage.elements.chipWaiting().scrollIntoView().click();

      // Act 2: Digita os 4 últimos dígitos do celular (ex: "5337")
      AtendimentosPage.buscarAtendimento(ULTIMOS_4_DIGITOS_CELULAR);

      // Assert 1: Aguarda requisição da API de busca e avalia se há atendimentos
      cy.wait('@searchAttendancesApi').then((interception) => {
        expect(interception.response.statusCode).to.eq(200);
        const items = interception.response.body?.items ||
          interception.response.body?.data ||
          (Array.isArray(interception.response.body) ? interception.response.body : null);
        const semAtendimento = items && items.length === 0;
        const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';

        // Pré-condição resiliente (API Real): se não houver atendimento com o número, cria um novo conforme regra de negócio e aguarda resposta
        if (!isMock && semAtendimento) {
          cy.log('⚠️ [Busca]: Nenhum atendimento encontrado para o celular em Aguardando. Criando novo atendimento com template...');
          AtendimentosPage.limparBusca();
          cy.wait(400);
          AtendimentosPage.iniciarAtendimentoComTemplate(CELULAR_PADRAO, 'oficial');
          cy.log('📱 [WhatsApp]: Aguardando o cliente responder no WhatsApp em até 1:30 min (90s)...');
          AtendimentosPage.validarJanelaAtiva(90000);

          // Após o cliente responder, refaz a busca mantendo o filtro "Aguardando"
          AtendimentosPage.elements.chipWaiting().scrollIntoView().click();
          AtendimentosPage.buscarAtendimento(ULTIMOS_4_DIGITOS_CELULAR);
          cy.wait('@searchAttendancesApi');
        }
      });

      // Act 3: Clica no primeiro card da lista resultante
      AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').click();

      // Assert 2: Valida se o painel lateral direito do cliente exibiu o telefone com os dígitos pesquisados ou o protocolo
      AtendimentosPage.elements.cardCliente().should('be.visible');
      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="text-cliente-telefone"]').length > 0) {
          AtendimentosPage.elements.textClienteTelefone()
            .scrollIntoView()
            .should('be.visible')
            .and('contain', ULTIMOS_4_DIGITOS_CELULAR);
        } else {
          AtendimentosPage.elements.textProtocoloCliente()
            .scrollIntoView()
            .should('be.visible');
        }
      });
    });

    it('2.2 deve restaurar a lista completa ao limpar o campo de busca', () => {
      // Arrange: Garante o status padrão "Aguardando"
      AtendimentosPage.elements.chipWaiting().scrollIntoView().click();

      // Act 1: Busca pelo celular
      AtendimentosPage.buscarAtendimento(ULTIMOS_4_DIGITOS_CELULAR);
      cy.wait('@searchAttendancesApi');

      // Act 2: Limpa a busca
      AtendimentosPage.limparBusca();

      // Assert: Aguarda a atualização da listagem
      cy.wait('@getAttendancesList').its('response.statusCode').should('eq', 200);
      AtendimentosPage.elements.cardsAtendimento().should('exist');
    });

  });

  // -------------------------------------------------------------
  // 3. VALIDAÇÃO DE ESTADO PADRÃO E REGRAS DE ROTA
  // -------------------------------------------------------------

  context('3. Validação de Estado Padrão e Regras de Rota', () => {

    it('3.1 deve ter "Aguardando" como o status padrão selecionado ao acessar a tela ou navegar da Central', () => {
      // Arrange & Act: Navega para a tela de Atendimentos
      AtendimentosPage.visitar();

      // Assert: Valida que o chip "Aguardando" deve ser o filtro ativo por padrão (aria-pressed="true")
      AtendimentosPage.elements.chipWaiting()
        .should('have.attr', 'aria-pressed', 'true');

      // Assert: Valida que o chip "Todos" NÃO deve ser o selecionado por padrão
      AtendimentosPage.elements.chipAll()
        .should('have.attr', 'aria-pressed', 'false');
    });

    it('3.2 deve sincronizar e manter o ID do atendimento aberto na URL via query param ?attendance= (PR #385)', () => {
      // Arrange: Garante a renderização dos cards na fila
      AtendimentosPage.elements.cardsAtendimento().should('have.length.greaterThan', 0);

      // Act: Clica no primeiro card da fila
      AtendimentosPage.elements.cardsAtendimento().first().click();

      // Assert: A URL deve refletir o parâmetro attendance=<id> e a tela de chat deve abrir
      AtendimentosPage.validarParametroAttendanceNaUrl();
      cy.get('[data-testid="card-cliente"], aside[class*="_infoPanel_"]').should('be.visible');
    });

    it('3.3 deve preservar a conversa aberta, filtros e termo de busca na tela após recarregamento (F5) (PR #385)', () => {
      // 1. Arrange: Abre um atendimento e aplica termo no campo de busca (mínimo 3 caracteres)
      AtendimentosPage.elements.cardsAtendimento().should('have.length.greaterThan', 0);
      AtendimentosPage.elements.cardsAtendimento().first().click();
      AtendimentosPage.validarParametroAttendanceNaUrl();

      const termoBusca = '5337';
      AtendimentosPage.elements.inputBusca().clear().type(termoBusca);
      cy.url({ timeout: 10000 }).should('include', `search=${termoBusca}`);

      // Obtém o ID do atendimento aberto da URL antes do reload
      AtendimentosPage.obterAttendanceIdDaUrl().then((attendanceId) => {
        // 2. Act: Simula recarregamento completo da página (F5)
        cy.reload();

        // 3. Assert: A conversa continua aberta, o termo de busca é mantido e os parâmetros da URL são preservados
        AtendimentosPage.validarParametroAttendanceNaUrl(attendanceId);
        cy.url({ timeout: 10000 }).should('include', `search=${termoBusca}`);
        cy.get('[data-testid="card-cliente"], aside[class*="_infoPanel_"]').should('be.visible');
        AtendimentosPage.elements.inputBusca().should('have.value', termoBusca);
      });

      // Cleanup: Limpa o campo de busca
      AtendimentosPage.limparBusca();
      cy.url({ timeout: 10000 }).should('not.include', 'search=');
    });

    it('3.4 deve abrir diretamente o atendimento ao acessar via deep link com parâmetros na URL (PR #385)', () => {
      // 1. Arrange: Obtém um ID de atendimento válido da listagem
      AtendimentosPage.elements.cardsAtendimento().should('have.length.greaterThan', 0);
      AtendimentosPage.elements.cardsAtendimento().first().click();
      AtendimentosPage.obterAttendanceIdDaUrl().then((attendanceId) => {
        // Fecha a conversa ativa para testar a abertura fria pelo deep link
        AtendimentosPage.fecharConversa();
        AtendimentosPage.validarAusenciaDeAttendanceNaUrl();

        // 2. Act: Visita diretamente o deep link da URL
        AtendimentosPage.visitarComParametros(`status=waiting&attendance=${attendanceId}`);

        // 3. Assert: O atendimento indicado deve carregar e abrir diretamente via URL
        AtendimentosPage.validarParametroAttendanceNaUrl(attendanceId);
        cy.get('[data-testid="card-cliente"], aside[class*="_infoPanel_"]').should('be.visible');
        cy.get('header[class*="_header_"], [data-testid="chat-header"]').should('be.visible');
      });
    });

    it('3.5 deve fechar a conversa aberta e remover o parâmetro attendance da URL ao trocar de status (PR #385)', () => {
      // 1. Arrange: Abre uma conversa
      AtendimentosPage.elements.cardsAtendimento().should('have.length.greaterThan', 0);
      AtendimentosPage.elements.cardsAtendimento().first().click();
      AtendimentosPage.validarParametroAttendanceNaUrl();

      // 2. Act: Alterna para outro status na fila (ex: Em andamento)
      AtendimentosPage.elements.chipInProgress().click();

      // 3. Assert: A conversa aberta fecha e o parâmetro attendance é removido da URL
      AtendimentosPage.validarAusenciaDeAttendanceNaUrl();
      cy.url({ timeout: 10000 }).should('include', 'status=in_progress');

      // 4. Teardown: Retorna ao status padrão "Aguardando"
      AtendimentosPage.elements.chipWaiting().click();
      cy.url({ timeout: 10000 }).should('include', 'status=waiting');
    });

    it('3.6 deve fechar a conversa aberta mantendo os filtros ao clicar no botão fechar conversa do cabeçalho (PR #385)', () => {
      // 1. Arrange: Abre uma conversa e aplica filtro de busca
      AtendimentosPage.elements.cardsAtendimento().should('have.length.greaterThan', 0);
      AtendimentosPage.elements.cardsAtendimento().first().click();
      AtendimentosPage.validarParametroAttendanceNaUrl();

      const termoBusca = 'maria';
      AtendimentosPage.elements.inputBusca().clear().type(termoBusca);
      cy.url({ timeout: 10000 }).should('include', `search=${termoBusca}`);

      // 2. Act: Clica no botão fechar conversa (X do header)
      AtendimentosPage.elements.btnFecharConversa().click();

      // 3. Assert: A conversa fecha (remove attendance da URL), mas o filtro de busca permanece
      AtendimentosPage.validarAusenciaDeAttendanceNaUrl();
      cy.url({ timeout: 10000 }).should('include', `search=${termoBusca}`);

      // Cleanup
      AtendimentosPage.limparBusca();
      cy.url({ timeout: 10000 }).should('not.include', 'search=');
    });

    it('3.7 deve restaurar a URL padrão ao limpar filtros e termos de busca (PR #385)', () => {
      // 1. Arrange: Aplica termo de busca na URL (com pelo menos 3 caracteres)
      const termoBusca = 'teste';
      AtendimentosPage.elements.inputBusca().clear().type(termoBusca);
      cy.url({ timeout: 10000 }).should('include', `search=${termoBusca}`);

      // 2. Act: Clica no botão limpar busca
      AtendimentosPage.limparBusca();

      // 3. Assert: A URL volta ao padrão sem search e o input esvazia
      cy.url({ timeout: 10000 }).should('not.include', 'search=');
      AtendimentosPage.elements.inputBusca().should('have.value', '');
    });

    it('3.8 deve ignorar termo de busca com menos de 3 caracteres mantendo a URL no padrão (PR #385)', () => {
      // 1. Arrange & Act: Digita termo curto (< 3 caracteres) que não atinge o limite para filtro
      AtendimentosPage.elements.inputBusca().clear().type('ab');

      // 2. Assert: A URL não deve receber o parâmetro search (evita filtro fantasma)
      cy.url({ timeout: 5000 }).should('not.include', 'search=');

      // Cleanup
      AtendimentosPage.limparBusca();
    });

  });

  // -------------------------------------------------------------
  // 4. REGRAS DE CANAL OFICIAL (WHATSAPP OFICIAL - JANELA 24H & WABA)
  // -------------------------------------------------------------

  context('4. Regras de Canal Oficial (WhatsApp Oficial - Janela 24h & WABA)', () => {

    beforeEach(() => {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';

      if (!isMock) {
        // Limpa os mocks definidos no escopo global para utilizar a API real e interagir com atendimentos verdadeiros
        AtendimentosMocks.clearMocksForRealE2ETests();
      } else {
        // No modo mock, configura o atendimento com canal oficial e janela 24h expirada
        AtendimentosMocks.interceptAttendanceDetailApi('*', {
          ...AtendimentosMocks.mockAttendanceDetailData,
          attendance: {
            ...AtendimentosMocks.mockAttendanceDetailData.attendance,
            channel: { id: 6, name: "WHATSAPP OFICIAL - 62 98222-4382", type: 1, subtype: 1 },
            last_customer_message_at: null,
            service_window_active: false
          },
          capabilities: {
            ...AtendimentosMocks.mockAttendanceDetailData.capabilities,
            can_send_free_text: false
          }
        });
        AtendimentosMocks.interceptMessagesListApi('*', AtendimentosMocks.mockMessagesExpiradas);
        AtendimentosMocks.interceptAttendanceMessageTemplatesApi('*');
        AtendimentosMocks.interceptAttendanceItemCapabilitiesApi('*', {
          capabilities: {
            ...AtendimentosMocks.mockAttendanceItemCapabilitiesData.capabilities,
            can_send_free_text: false
          }
        });
        AtendimentosMocks.interceptSendMessageApi('*', { id: 4854475, created_at: new Date().toISOString() });
      }
    });

    it('4.1 deve exibir aviso de janela encerrada, botão de template e bloquear chat quando em Canal Oficial com janela inativa', () => {
      // Act: Localiza e abre o atendimento do celular padrão em Canal Oficial
      AtendimentosPage.garantirAtendimentoAberto(CELULAR_PADRAO, 'oficial', true);

      // Assert: Valida que o aviso de janela inativa/encerrada e botão de template estão visíveis
      AtendimentosPage.validarJanelaExpirada();

      // Assert: Valida metadados do cabeçalho e painel do cliente
      AtendimentosPage.elements.headerChat().should('be.visible');
      AtendimentosPage.elements.cardCliente().should('be.visible');
      AtendimentosPage.elements.summaryOrcamentos().should('be.visible');
    });

    it('4.2 deve permitir enviar template WABA com variável de texto editável durante janela inativa', () => {
      // Arrange: Localiza e abre o atendimento do celular padrão
      AtendimentosPage.garantirAtendimentoAberto(CELULAR_PADRAO, 'oficial');

      // Assert (Pré-condição): Confirma o estado do chat
      cy.get('body').then(($b) => {
        if ($b.find('[data-testid="composer-service-window-notice"]').length > 0) {
          AtendimentosPage.validarJanelaExpirada();
        }
      });

      // Act 1: Abre a listagem de templates através do aviso de janela encerrada ou menu lateral
      AtendimentosPage.abrirPainelTemplatesJanelaExpirada();

      // Act 2: Busca dinamicamente e seleciona o template WABA com variável editável
      AtendimentosPage.selecionarTemplateComVariavel();

      // Act 3: Preenche a variável de texto obrigatória
      AtendimentosPage.preencherVariavelTemplate('teste');

      // Act 4: Envia o template para o chat
      AtendimentosPage.enviarTemplateDrawer();
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';
      if (isMock) {
        cy.wait('@sendChatMessage');
        // No modo mock: intercepta a rota de detalhes com a janela de 24h ativada pela resposta do cliente
        AtendimentosMocks.interceptAttendanceDetailApi('*', {
          ...AtendimentosMocks.mockAttendanceDetailData,
          attendance: {
            ...AtendimentosMocks.mockAttendanceDetailData.attendance,
            channel: { id: 6, name: "WHATSAPP OFICIAL - 62 98222-4382", type: 1, subtype: 1 },
            status: 1,
            last_customer_message_at: new Date().toISOString(),
            service_window_active: true,
            service_window: {
              started_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 86400000).toISOString()
            }
          },
          capabilities: {
            ...AtendimentosMocks.mockAttendanceDetailData.capabilities,
            can_send_free_text: true
          }
        });
        AtendimentosMocks.interceptMessagesListApi('*', AtendimentosMocks.mockMessagesAtivas);
        AtendimentosMocks.interceptAttendanceItemCapabilitiesApi('*', {
          capabilities: {
            ...AtendimentosMocks.mockAttendanceItemCapabilitiesData.capabilities,
            can_send_free_text: true
          }
        });

        // Recarrega a página para atualizar o estado do chat simulando o recebimento da mensagem do cliente
        cy.reload();
        AtendimentosPage.elements.cardsAtendimento().first().click();
        cy.wait('@getAttendanceDetail');
      }

      // Assert 1: Valida que o template foi disparado (balão de mensagem ou banner de aviso ativo)
      cy.get('body').should(($b) => {
        const temAviso = $b.find('[data-testid="composer-service-window-notice"]').length > 0;
        const temBalao = $b.find('div[class*="_bubbleEmployee_"], article[class*="_bubbleRowEnd_"]').length > 0;
        expect(temAviso || temBalao, 'Template deve ser enviado gerando balão ou restaurando aviso de janela').to.be.true;
      });

      // Assert 2: Aguarda o cliente responder no WhatsApp em até 1:30 min (90s) para ativar a janela de 24h
      const timeout = isMock ? 10000 : 90000;
      cy.log(`📱 [WhatsApp]: Template enviado! Aguardando o cliente responder no WhatsApp em até ${timeout / 1000}s para validar ativação...`);
      AtendimentosPage.validarJanelaAtiva(timeout);
    });

    it('4.3 deve ativar a janela de 24h e liberar o campo de digitação livre assim que o cliente responder', function () {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';

      // Act 1: Abre o atendimento do celular padrão
      AtendimentosPage.garantirAtendimentoAberto(CELULAR_PADRAO, 'oficial');

      // Act 2: Se a janela ainda não estiver ativa, dispara o envio de template via banner para o WhatsApp do cliente
      cy.get('body').then(($body) => {
        const temJanelaAtiva = /janela\s*ativa/i.test($body.text()) ||
          $body.find('span[class*="_serviceWindowBadge_"], [data-testid="badge-janela-ativa"]').length > 0;

        if (!temJanelaAtiva) {
          AtendimentosPage.abrirPainelTemplatesJanelaExpirada();
          AtendimentosPage.selecionarTemplateComVariavel();
          AtendimentosPage.preencherVariavelTemplate('Teste automatico do Cypress, responda em até 1:30 minutos para validar!');
          AtendimentosPage.enviarTemplateDrawer();
        }
      });

      if (isMock) {
        // No modo mock: intercepta a rota de detalhes com a janela de 24h ativada pela resposta do cliente
        AtendimentosMocks.interceptAttendanceDetailApi('*', {
          ...AtendimentosMocks.mockAttendanceDetailData,
          attendance: {
            ...AtendimentosMocks.mockAttendanceDetailData.attendance,
            channel: { id: 6, name: "WHATSAPP OFICIAL - 62 98222-4382", type: 1, subtype: 1 },
            status: 1,
            last_customer_message_at: new Date().toISOString(),
            service_window_active: true,
            service_window: {
              started_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 86400000).toISOString()
            }
          },
          capabilities: {
            ...AtendimentosMocks.mockAttendanceDetailData.capabilities,
            can_send_free_text: true
          }
        });
        AtendimentosMocks.interceptMessagesListApi('*', AtendimentosMocks.mockMessagesAtivas);
        AtendimentosMocks.interceptAttendanceItemCapabilitiesApi('*', {
          capabilities: {
            ...AtendimentosMocks.mockAttendanceItemCapabilitiesData.capabilities,
            can_send_free_text: true
          }
        });

        // Recarrega a página para atualizar o estado do chat simulando o recebimento da mensagem do cliente
        cy.reload();
        AtendimentosPage.elements.cardsAtendimento().first().click();
        cy.wait('@getAttendanceDetail');
      }

      // Assert: Valida que a janela de 24h é ativada (via Replay/Mock em até 10s, ou via WhatsApp físico em até 90s / 1:30 min na API Real)
      const timeout = isMock ? 10000 : 90000;
      cy.log(`📱 [WhatsApp]: Aguardando o cliente responder no WhatsApp em até ${timeout / 1000}s para validar ativação da janela...`);
      AtendimentosPage.validarJanelaAtiva(timeout);
    });

    it('4.4 deve exibir o botão "Cancelar" acima do campo de mensagem ao selecionar template WABA em atendimento com Janela Ativa e restaurar digitação livre ao cancelar', () => {
      // 1. Arrange: Cenário 100% mockado com Canal Oficial e Janela de 24h Ativa (Atendimento #26080077)
      AtendimentosMocks.interceptMockDetalheJanelaAberta(26080077);

      // Força recarregamento da fila com o card mockado em "Aguardando"
      AtendimentosPage.forcarFiltroStatus('waiting');
      cy.wait('@getAttendancesList');

      // Abre o atendimento mockado com Janela Ativa
      AtendimentosPage.elements.cardAtendimentoPorId(26080077).should('be.visible').click();
      cy.wait('@getAttendanceDetail');

      // Assert (Pré-condição): Compositor liberado para texto livre e sem template pré-selecionado
      AtendimentosPage.elements.inputMensagemChat().should('be.visible').and('not.be.disabled');
      AtendimentosPage.validarAusenciaTemplateNoCompositor();

      // 2. Act: Abre a gaveta de templates WABA a partir do resumo lateral do cliente
      AtendimentosPage.abrirGavetaTemplates();

      // Seleciona um template WABA sem variáveis e aciona "Usar template"
      AtendimentosPage.selecionarTemplateSemVariavel();

      // 3. Assert: O texto do template é carregado na caixa de entrada
      AtendimentosPage.elements.inputMensagemChat().invoke('val').should('not.be.empty');

      // Assert Mandatório (Issue): O botão "Cancelar" DEVE ser exibido acima da caixa de mensagem mesmo com Janela Ativa
      AtendimentosPage.validarBotaoCancelarTemplateVisivel();

      // 4. Act: Aciona o botão "Cancelar" para descartar o template
      AtendimentosPage.cancelarTemplateEscolhidoNoCompositor();

      // 5. Assert: O botão "Cancelar" e a barra de template deixam de existir no DOM
      AtendimentosPage.validarAusenciaTemplateNoCompositor();

      // Assert: O campo de mensagem é limpo e volta a permitir digitação livre imediatamente
      AtendimentosPage.elements.inputMensagemChat().invoke('val').should('be.empty');
      AtendimentosPage.elements.inputMensagemChat().should('be.visible').and('not.be.disabled');

      // Validação de Interatividade: Atendente consegue digitar livremente no campo
      const textoLivre = 'Texto digitado livremente apos cancelar template';
      AtendimentosPage.elements.inputMensagemChat().type(textoLivre);
      AtendimentosPage.elements.inputMensagemChat().should('have.value', textoLivre);

      // Cleanup: Limpa o campo de mensagem
      AtendimentosPage.elements.inputMensagemChat().clear();
    });

    it('4.5 deve exibir o botão "Cancelar" acima do campo de mensagem ao selecionar template WABA em atendimento com Janela Expirada e restaurar aviso de janela ao cancelar', () => {
      // 1. Arrange: Cenário 100% mockado com Canal Oficial e Janela Expirada/Inativa (Atendimento #26080076)
      Cypress.env('ACTIVE_SERVICE_WINDOW_VERIFIED', false);
      AtendimentosMocks.interceptMockDetalheJanelaExpirada(26080076);

      // Força recarregamento da fila com o card mockado em "Aguardando"
      AtendimentosPage.forcarFiltroStatus('waiting');
      cy.wait('@getAttendancesList');

      // Abre o atendimento mockado com Janela Expirada
      AtendimentosPage.elements.cardAtendimentoPorId(26080076).should('be.visible').click();
      cy.wait('@getAttendanceDetail');

      // Assert (Pré-condição): Aviso de janela inativa/encerrada visível
      AtendimentosPage.validarJanelaExpirada();

      // 2. Act: Abre a listagem de templates através do aviso de janela encerrada
      AtendimentosPage.abrirPainelTemplatesJanelaExpirada();

      // Seleciona template sem variáveis e aciona "Usar template"
      AtendimentosPage.selecionarTemplateSemVariavel();

      // 3. Assert: O texto do template é carregado no compositor
      AtendimentosPage.elements.inputMensagemChat().invoke('val').should('not.be.empty');

      // Assert: O botão "Cancelar" deve ser exibido acima da caixa de mensagem
      AtendimentosPage.validarBotaoCancelarTemplateVisivel();

      // 4. Act: Aciona o botão "Cancelar"
      AtendimentosPage.cancelarTemplateEscolhidoNoCompositor();

      // 5. Assert: O botão "Cancelar" e a barra de template deixam de existir
      AtendimentosPage.validarAusenciaTemplateNoCompositor();

      // Assert: O aviso de janela encerrada volta a ser exibido no lugar do compositor livre
      AtendimentosPage.validarJanelaExpirada();
    });

  });

  // -------------------------------------------------------------
  // 5. REGRAS DE CANAL NÃO OFICIAL E INTERAÇÕES DE CHAT LIVRE (WHATSAPP NÃO OFICIAL)
  // -------------------------------------------------------------

  context.skip('5. Regras de Canal Não Oficial e Interações de Chat Livre (WhatsApp Não Oficial)', () => {

    beforeEach(() => {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';

      if (!isMock) {
        // Limpa os mocks definidos no escopo global para utilizar a API real e interagir com atendimentos verdadeiros
        AtendimentosMocks.clearMocksForRealE2ETests();

        // Pré-condição condicional completa:
        AtendimentosPage.prepararAtendimentoParaTeste(CELULAR_PADRAO, 'nao_oficial');
      } else {
        // No modo mock, intercepta o atendimento em canal não oficial com chat liberado
        AtendimentosMocks.interceptAttendanceDetailApi('*', {
          ...AtendimentosMocks.mockAttendanceDetailData,
          attendance: {
            ...AtendimentosMocks.mockAttendanceDetailData.attendance,
            id: 260800148,
            channel: { id: 3, name: "WHATSAPP NAO OFICIAL - 4001", type: 1, subtype: 2 },
            last_customer_message_at: new Date().toISOString(),
            service_window_active: true
          }
        });
        AtendimentosMocks.interceptMessagesListApi('*', AtendimentosMocks.mockMessagesAtivas);
        AtendimentosPage.elements.cardsAtendimento().first().click();
      }
    });

    it('5.1 deve manter o chat 100% liberado e sem restrições de template quando o canal for WhatsApp Não Oficial', () => {
      // Assert: Valida que não há banner de template e o input de texto está disponível diretamente
      AtendimentosPage.validarChatDesbloqueadoNaoOficial();
    });

    it('5.2 deve enviar mensagem no chat aberto e disparar a API com sucesso', () => {
      // Arrange: Intercepta envio de mensagem
      AtendimentosMocks.interceptSendMessageApi('*', { id: Date.now(), created_at: new Date().toISOString() });

      // Act: Digita e envia a mensagem no chat não oficial
      AtendimentosPage.enviarMensagemNoChat('Mensagem automatizada de teste E2E');

      // Assert: Valida se a requisição de envio foi disparada
      cy.wait('@sendChatMessage').its('request.body').should('exist');
    });

    it('5.3 deve permitir alterar o status do atendimento para Concluído pelo menu do cliente', () => {
      // Arrange: Intercepta a requisição de alteração de status
      AtendimentosMocks.interceptUpdateAttendanceStatusApi('*');

      // Act: Altera o status para Concluído
      AtendimentosPage.alterarStatusAtendimento('completed');

      // Assert: Valida que a requisição de alteração de status foi disparada
      cy.wait('@updateAttendanceStatusPatch');
    });

  });

  // -------------------------------------------------------------
  // 6. STATUS E DISPONIBILIDADE DO ATENDENTE (TRANSFERÊNCIA E ALTERNÂNCIA)
  // -------------------------------------------------------------

  context('6. Status e Disponibilidade do Atendente (Transferência e Alternância)', () => {

    it('6.1 deve bloquear o compositor quando o atendimento estiver sem atendente e indicar status Ocupado do operador logado na modal de transferência', () => {
      const idAtendimento = 260800105;
      const nomeOperadorGlobal = configEnv.DEFAULT_CLIENT_NAME || 'klismam';

      // Arrange: Configura interceptações para simular atendimento sem atendente e listagem com atendentes ocupados
      AtendimentosMocks.interceptMockAtendimentoSemAtendente(idAtendimento, 'Cliente Teste');
      AtendimentosMocks.interceptMessagesListApi(idAtendimento, AtendimentosMocks.mockMessagesListData);
      AtendimentosMocks.interceptMockAgentsGroup(7, 'busy');

      // Act 1: Recarrega a listagem com o atendimento sem atendente
      AtendimentosPage.filtrarPorStatusChip('pending');
      cy.wait('@getAttendancesList');

      // Act 2: Clica no card do atendimento sem atendente para abrir a conversa
      AtendimentosPage.elements.cardsAtendimento().first().click();
      cy.wait('@getAttendanceMessages');

      // Assert 1: Confirma que o compositor de mensagem está bloqueado com o aviso específico
      AtendimentosPage.validarAvisoSemAtendente();

      // Act 3: Abre a modal de transferência através do menu do card na fila
      AtendimentosPage.abrirModalTransferirPeloCard(idAtendimento);
      cy.wait('@getAttendanceGroupAgents');

      // Assert 2: Confirma que a modal abriu e exibe "Sem Atendente" como atendente atual
      AtendimentosPage.elements.modalTransferir().should('be.visible');
      AtendimentosPage.elements.atendenteAtualTransferir().should('contain', 'Sem Atendente');

      // Act 4: Pesquisa pelo operador logado no campo de busca da modal usando a variável global
      AtendimentosPage.buscarAtendenteNaModalTransferir(nomeOperadorGlobal);

      // Assert 3: Valida que o operador logado é encontrado e exibe a tag de status "Ocupado"
      AtendimentosPage.validarStatusOcupadoAtendente(nomeOperadorGlobal);

      // Assert 4: O botão de confirmar transferência deve permanecer desabilitado
      AtendimentosPage.elements.btnConfirmarTransferir().should('be.disabled');

      // Act 5: Fecha a modal de transferência
      AtendimentosPage.fecharModalTransferir();

      // Assert 5: Confirma que o compositor continua bloqueado impedindo interações
      AtendimentosPage.validarAvisoSemAtendente();
    });

    it('6.2 deve iniciar com chat bloqueado sem atendente, permitir transferência para atendente disponível e liberar o compositor após transferência', () => {
      const idAtendimento = 260800106;
      const nomeOperadorGlobal = configEnv.DEFAULT_CLIENT_NAME || 'klismam';
      const nomeOperadorProfile = nomeOperadorGlobal.replace(/\s+/g, '').toUpperCase();
      const idOperadorLogado = 122;

      // Arrange: O atendimento inicia SEM atendente, com agentes disponíveis e mensagens ativas
      AtendimentosMocks.interceptMockAtendimentoSemAtendente(idAtendimento, 'Cliente Teste');
      AtendimentosMocks.interceptMessagesListApi(idAtendimento, AtendimentosMocks.mockMessagesAtivas);
      AtendimentosMocks.interceptMockAgentsGroup(7, 'available');
      AtendimentosMocks.interceptTransferAttendanceApi(idAtendimento);
      AtendimentosMocks.interceptSendMessageApi(idAtendimento);

      // Act 1: Recarrega a fila com o atendimento sem atendente
      AtendimentosPage.filtrarPorStatusChip('pending');
      cy.wait('@getAttendancesList');

      // Act 2: Clica no card do atendimento sem atendente para abrir o chat
      AtendimentosPage.elements.cardsAtendimento().first().click();
      cy.wait('@getAttendanceMessages');

      // Assert 1: Pré-condição: como está sem atendente, o compositor DEVE estar bloqueado com o aviso
      AtendimentosPage.validarAvisoSemAtendente();

      // Act 3: Abre a modal de transferência via menu do card
      AtendimentosPage.abrirModalTransferirPeloCard(idAtendimento);
      cy.wait('@getAttendanceGroupAgents');

      // Act 4: Valida a presença de atendentes com status Disponível e seleciona o atendente disponível
      AtendimentosPage.validarStatusDisponivelAtendente();
      AtendimentosPage.selecionarPrimeiroAtendenteDisponivel();

      // Arrange (Pós-transferência): Prepara o mock do atendimento agora vinculado ao operador para quando a UI atualizar
      AtendimentosMocks.interceptMockAtendimentoVinculado(idAtendimento, nomeOperadorProfile, idOperadorLogado, 'Cliente Teste');

      // Act 5: Confirma a transferência
      AtendimentosPage.confirmarTransferencia();
      cy.wait('@transferAttendancePatch');
      cy.wait('@getAttendanceItemCapabilities');
      cy.wait('@getAttendanceDetail');

      // Assert 3: Após a transferência, o aviso de sem atendente NÃO deve mais existir e o compositor deve ser liberado
      AtendimentosPage.validarCompositorLiberado();

      // Act 6: Digita e envia uma mensagem no chat agora desbloqueado
      AtendimentosPage.enviarMensagemNoChat('Atendimento assumido com sucesso após transferência.');

      // Assert 4: Confirma que a API de envio de mensagem foi disparada com sucesso
      cy.wait('@sendChatMessage').its('request.body').should('exist');
    });

    it('6.3 deve simular o ciclo completo de transferência (ida e volta) e validar a gravação no histórico da gaveta', () => {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';
      const idAtendimento = 260800106;
      const nomeOperadorLogado = configEnv.DEFAULT_CLIENT_NAME || 'klismam';
      const nomeOperadorProfile = nomeOperadorLogado.replace(/\s+/g, '').toUpperCase();
      const idOperadorLogado = 122;

      if (isMock) {
        // Arrange (Modo Mock): Prepara o atendimento inicial vinculado ao operador logado
        AtendimentosMocks.interceptMockAtendimentoVinculado(idAtendimento, nomeOperadorProfile, idOperadorLogado, 'Cliente Teste');
        AtendimentosMocks.interceptMessagesListApi(idAtendimento, AtendimentosMocks.mockMessagesAtivas);
        AtendimentosMocks.interceptMockAgentsGroup(7, 'available');
        AtendimentosMocks.interceptTransferAttendanceApi(idAtendimento);

        AtendimentosPage.filtrarPorStatusChip('pending');
        cy.wait('@getAttendancesList');
        AtendimentosPage.elements.cardsAtendimento().first().click();
        cy.wait('@getAttendanceMessages');
      } else {
        // Arrange (Modo Real): Garante atendimento do celular padrão aberto
        AtendimentosMocks.clearMocksForRealE2ETests();
        AtendimentosPage.garantirAtendimentoAberto(CELULAR_PADRAO, 'oficial', false);
      }

      // Helper para montar payload completo de transferência para o histórico da gaveta
      const prepararMockHistoricoTransferencia = (de, para) => {
        const msgTransf = {
          id: 9999999,
          created_at: new Date().toISOString(),
          occurred_at: new Date().toISOString(),
          origin: "employee",
          employee_code: String(idOperadorLogado),
          employee: { id: idOperadorLogado, name: para },
          attendant: { id: idOperadorLogado, name: para },
          author: { id: idOperadorLogado, name: para },
          transfer_type: 1,
          content_type: "text",
          message_status: "sent",
          content: `Atendente alterado de ${de} p/ ${para}`,
          body: `Atendente alterado de ${de} p/ ${para}`,
          text: `Atendente alterado de ${de} p/ ${para}`,
          attachment: null
        };

        const lista = [msgTransf, ...AtendimentosMocks.mockMessagesAtivas.data];
        const payload = {
          items: lista,
          data: lista,
          messages: lista,
          pagination: { page: 1, per_page: 20, total: lista.length, total_pages: 1, has_next: false, has_previous: false }
        };

        AtendimentosMocks.interceptMessagesListApi(idAtendimento, payload);
        cy.intercept('GET', rotaApi(`attendances/${idAtendimento}/messages*transfer_type=true*`), {
          statusCode: 200,
          body: payload
        }).as('getAttendanceTransferMessagesCustom');
        cy.intercept('GET', rotaApi('attendances/*/messages*transfer_type=true*'), {
          statusCode: 200,
          body: payload
        }).as('getAttendanceTransferMessagesAllCustom');
      };

      // Act 1: Abre a modal de transferência pelo menu de status do cliente
      AtendimentosPage.abrirModalTransferirPeloMenuCliente();
      AtendimentosPage.aguardarListaAtendentesTransferir();

      // Valida se o atendimento está com o operador logado ou com outro atendente
      cy.get('[data-testid="lista-atendentes"]').then(($lista) => {
        const temOperadorLogadoNaLista = $lista.find('[data-testid="option-atendente-klismam-monteiro"], [data-agent-id="122"], button:contains("Klismam")').length > 0;

        if (temOperadorLogadoNaLista) {
          // Cenário A: O atendimento está com outro atendente (ex: Italo Patrick).
          // Transfere diretamente para o operador logado (Klismam Monteiro)
          cy.wrap($lista).find('[data-testid="option-atendente-klismam-monteiro"], [data-agent-id="122"], button:contains("Klismam")').first().click();

          if (isMock) {
            prepararMockHistoricoTransferencia('ITALO PATRICK', nomeOperadorProfile);
          }

          AtendimentosPage.confirmarTransferencia();
          cy.wait(1500);

          // Valida que a transferência refletiu e foi gravada no histórico da gaveta na hora exata
          AtendimentosPage.validarHistoricoTransferenciasGravado(null, nomeOperadorLogado);
        } else {
          // Cenário B: O atendimento já está com o operador logado.
          // 1. Transfere para o primeiro atendente disponível diferente (Ida)
          AtendimentosPage.selecionarPrimeiroAtendenteDisponivel();
          AtendimentosPage.confirmarTransferencia();
          cy.wait(2000);

          // 2. Faz a volta: reabre pelo menu e transfere de volta para o operador logado
          AtendimentosPage.abrirModalTransferirPeloMenuCliente();
          AtendimentosPage.aguardarListaAtendentesTransferir();

          cy.get('[data-testid="lista-atendentes"]').then(($listaVolta) => {
            const elOperador = $listaVolta.find('[data-testid="option-atendente-klismam-monteiro"], [data-agent-id="122"], button:contains("Klismam")');
            if (elOperador.length > 0) {
              cy.wrap(elOperador.first()).click();
            } else {
              AtendimentosPage.buscarAtendenteNaModalTransferir(nomeOperadorLogado);
              cy.wait(800);
              cy.get('[data-testid="lista-atendentes"]')
                .contains('button[role="option"]', new RegExp(nomeOperadorLogado, 'i'))
                .first()
                .click();
            }
          });

          if (isMock) {
            prepararMockHistoricoTransferencia('ITALO PATRICK', nomeOperadorProfile);
          }

          AtendimentosPage.confirmarTransferencia();
          cy.wait(1500);

          // 3. Valida que o histórico gravou as transferências de ida e volta na hora exata
          AtendimentosPage.validarHistoricoTransferenciasGravado(null, nomeOperadorLogado);
        }
      });
    });

    it('6.4 deve sincronizar imediatamente a alteração de status do operador no modal de transferência após transferir o atendimento (PR #380)', () => {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';
      const idAtendimento = 260800160;
      const attendant = AtendimentosMocks.getLoggedAttendant();
      const nomeOperadorProfile = attendant.name;
      const idOperadorLogado = attendant.id;
      const idOutroOperador = 999;
      const nomeOutroOperador = 'ITALO PATRICK';

      // O operador logado começa OCUPADO: o cenário valida que, ao ficar Disponível,
      // a lista de transferência reflete a mudança imediatamente (PR #380).
      let statusDinamicoOperador = 'busy';
      let atendenteDonoId = idOperadorLogado;
      let atendenteDonoNome = nomeOperadorProfile;

      if (isMock) {
        // Arrange (Modo Mock): Concede permissões necessárias e prepara mocks dinâmicos
        AtendimentosPage.concederTodasPermissoes({ attendanceId: idAtendimento });

        // Prepara atendimento inicial vinculado ao operador logado
        AtendimentosMocks.interceptMockAtendimentoVinculado(idAtendimento, nomeOperadorProfile, idOperadorLogado, 'Cliente Teste PR-380');
        AtendimentosMocks.interceptMessagesListApi(idAtendimento, AtendimentosMocks.mockMessagesAtivas);

        // Fila dinâmica: o item precisa refletir o dono atual do atendimento. Com o payload
        // estático de interceptMockAtendimentoVinculado, a modal seguia exibindo o operador
        // logado como "atendente atual" mesmo após a transferência — e o front oculta da lista
        // justamente quem já é o dono, impedindo a transferência de volta.
        cy.intercept('GET', rotaApi('attendances?*'), (req) => {
          req.reply({
            statusCode: 200,
            body: {
              items: [
                {
                  id: idAtendimento,
                  reference_at: new Date().toISOString(),
                  attendant_name: atendenteDonoNome,
                  attendant: { id: atendenteDonoId, name: atendenteDonoNome },
                  attendant_id: atendenteDonoId,
                  customer_name: 'Cliente Teste PR-380',
                  messages: {
                    unread_count: 0,
                    last_message: { type: 1, body: 'Oi', occurred_at: new Date().toISOString() }
                  },
                  status: 1,
                  channel: { id: 6, name: 'WHATSAPP OFICIAL - 62 98222-4382', type: 1, subtype: 1 },
                  group: { id: 7, name: 'ATENDIMENTO' }
                }
              ],
              pagination: { page: 1, per_page: 20, total: 1, total_pages: 1, has_next: false, has_previous: false }
            }
          });
        }).as('getAttendancesList');

        // Mock dinâmico de detalhe do atendimento para refletir a transferência
        const regexDetail = new RegExp(regexApi(`attendances/${idAtendimento}([?#].*)?$`));
        cy.intercept('GET', regexDetail, (req) => {
          req.reply({
            statusCode: 200,
            body: {
              attendance: {
                id: idAtendimento,
                reference_at: new Date().toISOString(),
                status: 1,
                attendant_id: atendenteDonoId,
                attendant: {
                  id: atendenteDonoId,
                  name: atendenteDonoNome
                },
                // Shape canônico: os demais mocks do arquivo usam channel/group como objetos
                // aninhados (id, name, type...). Os campos flat channel_id/group_id não batem
                // com o que o front lê (ex: attendance.channel.type), quebrando o painel lateral.
                channel: {
                  id: 6,
                  name: 'WHATSAPP OFICIAL - 62 98222-4382',
                  type: 1,
                  subtype: 1
                },
                group: {
                  id: 7,
                  name: 'ATENDIMENTO'
                },
                last_customer_message_at: new Date().toISOString(),
                service_window_active: true
              },
              customer: {
                // customer_id (PR #429) é o que habilita o gatilho do menu do cliente
                // (button-editar-cliente-icon); sem ele o painel lateral renderiza sem as ações.
                customer_id: 867092,
                name: 'Cliente Teste PR-380',
                phone: '5562999999999',
                email: null,
                store_name: 'LOJA TESTE'
              },
              capabilities: {
                // Parte do conjunto canônico: declarar só as flags de transferência omitia
                // as demais (undefined = falsy), e o gatilho do menu do cliente
                // (button-editar-cliente-icon) deixava de renderizar.
                ...AtendimentosMocks.mockAttendanceItemCapabilitiesData.capabilities,
                can_transfer_attendance: true,
                can_transfer: true,
                can_transfer_occupied_attendance: true,
                can_transfer_pending_attendance: true,
                can_view_attendance_detail: true,
                can_list_group_agents: true
              },
              // Envelope completo (regra AGENTS.md §6 "Schema Completo em Mocks de Detalhes"):
              // summaries: {} vazio faz o React lançar exceção síncrona de undefined ao ler
              // summaries.quotes.count, derrubando o painel lateral inteiro (não só o botão).
              summaries: {
                quotes: { count: 0, total_amount: 0 },
                payment_links: { count: 0, pending_confirmation_count: 0 }
              }
            }
          });
        }).as('getAttendanceDetailPr380');

        // Mock dinâmico da transferência (PATCH)
        cy.intercept('PATCH', regexDetail, (req) => {
          // O dono passa a ser quem a requisição indicar (ida para o outro operador e volta
          // para o logado), em vez de assumir sempre o outro operador.
          atendenteDonoId = req.body?.attendant_id || idOutroOperador;
          atendenteDonoNome = atendenteDonoId === idOperadorLogado ? nomeOperadorProfile : nomeOutroOperador;
          req.reply({
            statusCode: 200,
            body: {
              // Shape alinhado ao mock canônico interceptTransferAttendanceApi: faltavam
              // target_attendant_id, customer_name, updated_at e os objetos aninhados
              // channel/group — o handler de sucesso da mutação provavelmente lê um deles
              // e lança exceção antes de fechar a modal (mesma classe de bug do summaries vazio).
              id: idAtendimento,
              status: 1,
              attendant_id: atendenteDonoId,
              target_attendant_id: atendenteDonoId,
              attendant: { id: atendenteDonoId, name: atendenteDonoNome },
              group_id: 7,
              group: { id: 7, name: 'ATENDIMENTO' },
              channel_id: 6,
              channel: { id: 6, name: 'WHATSAPP OFICIAL - 62 98222-4382', type: 1, subtype: 1 },
              customer_name: 'Cliente Teste PR-380',
              updated_at: new Date().toISOString(),
              attendance: {
                id: idAtendimento,
                reference_at: new Date().toISOString(),
                status: 1,
                attendant_id: atendenteDonoId,
                attendant: { id: atendenteDonoId, name: atendenteDonoNome },
                group: { id: 7, name: 'ATENDIMENTO' },
                channel: { id: 6, name: 'WHATSAPP OFICIAL - 62 98222-4382', type: 1, subtype: 1 }
              }
            }
          });
        }).as('transferAttendancePr380');

        // Mock de status inicial do operador (Ocupado — ponto de partida do cenário)
        AtendimentosMocks.interceptAttendantStatusApi(idOperadorLogado, {
          attendant_id: idOperadorLogado,
          status: 'busy',
          group_relations_count: 1,
          active_attendance_count: 1,
          status_changed_at: new Date().toISOString(),
          status_consistent: true
        });

        // Intercepta a alteração de status via switch superior para alternar dinamicamente
        cy.intercept('PATCH', rotaApi(`attendants/${idOperadorLogado}*`), (req) => {
          statusDinamicoOperador = req.body?.status || 'busy';
          req.reply({
            statusCode: 200,
            body: {
              attendant_id: idOperadorLogado,
              status: statusDinamicoOperador,
              group_relations_count: 1,
              active_attendance_count: 1,
              status_changed_at: new Date().toISOString(),
              status_consistent: true
            }
          });
        }).as('updateAttendantStatusPr380');

        // Mock dinâmico da lista de agentes dos grupos (reflete o status do operador em tempo real)
        cy.intercept('GET', /.*attendance-groups.*agents.*/, (req) => {
          const payload = JSON.parse(JSON.stringify(AtendimentosMocks.mockAgentsGroup7Data));
          payload.agents = [
            {
              id: idOutroOperador,
              name: nomeOutroOperador,
              status: 'available',
              email: 'agent@omnicare.local'
            },
            {
              id: idOperadorLogado,
              name: nomeOperadorProfile,
              status: statusDinamicoOperador,
              email: 'operator@omnicare.local'
            }
          ];
          req.reply({ statusCode: 200, body: payload });
        }).as('getAttendanceGroupAgentsPr380');

        // Recarrega para o React Query descartar o status/detalhe já cacheados no beforeEach
        // global (que carregou a tela antes destes intercepts existirem) e consumir os mocks
        // deste teste desde o primeiro fetch — visitar() é no-op estando já em /atendimentos.
        cy.reload();

        // Carrega fila e abre conversa inicial
        AtendimentosPage.filtrarPorStatusChip('pending');
        cy.wait('@getAttendancesList');
        AtendimentosPage.elements.cardsAtendimento().first().click();

        // Sincroniza pelo DOM e não pela rota: com um único card na fila ele pode já vir
        // auto-selecionado, e aí o React Query serve as mensagens do cache sem emitir
        // nova requisição — esperar por '@getAttendanceMessages' dá timeout intermitente.
        cy.get('header[class*="_header_"], [data-testid="chat-header"]').should('be.visible');
      } else {
        // Arrange (Modo Real): Garante atendimento do celular padrão aberto
        AtendimentosMocks.clearMocksForRealE2ETests();
        AtendimentosPage.garantirAtendimentoAberto(CELULAR_PADRAO, 'oficial', false);
        // Em API real o status do operador vem de rodadas anteriores: leva a conta ao ponto de partida
        // do cenário (Ocupado) em vez de presumi-lo
        AtendimentosPage.garantirStatusAtendente('Ocupado');
      }

      // Pré-condição: o operador logado inicia Ocupado e o atendimento é dele
      AtendimentosPage.validarStatusAtendente('Ocupado');

      // Act 1: Transfere o atendimento para o outro operador (o único Disponível na lista)
      AtendimentosPage.abrirModalTransferirPeloMenuCliente();
      AtendimentosPage.aguardarListaAtendentesTransferir();
      AtendimentosPage.selecionarAtendenteNaModalTransferir(nomeOutroOperador);
      AtendimentosPage.confirmarTransferencia();

      // Act 2: Alterna o próprio status no switch do cabeçalho (Ocupado -> Disponível)
      AtendimentosPage.alternarStatusAtendente();
      AtendimentosPage.validarStatusAtendente('Disponível');

      // Act 3: Reabre a modal para transferir o atendimento de volta para si
      AtendimentosPage.abrirModalTransferirPeloMenuCliente();
      AtendimentosPage.aguardarListaAtendentesTransferir();

      // Assert (PR #380): o operador logado já aparece na lista como 'Disponível',
      // provando que o cache da listagem de agentes foi invalidado imediatamente
      // após a troca de status — sem precisar reabrir a tela ou recarregar.
      AtendimentosPage.elements.getOpcaoAtendentePorNome(nomeOperadorProfile)
        .should('be.visible')
        .and('contain', 'Disponível');

      // Act 4: Conclui a transferência de volta para o operador logado
      AtendimentosPage.selecionarAtendenteNaModalTransferir(nomeOperadorProfile);
      AtendimentosPage.confirmarTransferencia();

      // Assert final: o atendimento volta a exibir o operador logado como responsável
      AtendimentosPage.elements.cardCliente().should('be.visible');
    });

    it('6.5 deve exibir o switch de status operacional com estado válido (Disponível, Ocupado ou Offline)', () => {
      // Assert: Valida que o switch de status do atendente está visível e exibe o estado operacional atual
      AtendimentosPage.elements.btnStatusAtendente().should('be.visible');
      AtendimentosPage.elements.btnStatusAtendente().invoke('text').should('match', /Disponível|Ocupado|Offline/i);
    });

    it('6.6 deve alternar o status operacional persistindo a alteração no backend', () => {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';

      // Act 1: Lê o estado operacional atualmente ativo no switch
      AtendimentosPage.elements.btnStatusAtendente().invoke('text').then((textoAtual) => {
        const statusAtual = textoAtual.match(/Disponível|Ocupado|Offline/i)?.[0];
        const statusAlvo = /Disponível/i.test(statusAtual) ? 'Ocupado' : 'Disponível';
        const backendStatusAlvo = statusAlvo === 'Ocupado' ? 'busy' : 'available';

        // Arrange (se mock ativo)
        if (isMock) {
          AtendimentosMocks.interceptUpdateAttendantStatusApi('*', { status: backendStatusAlvo });
          AtendimentosMocks.interceptAttendantStatusApi('*', { status: backendStatusAlvo });
        }

        // Act 2: Clica no switch para alternar o status
        AtendimentosPage.alternarStatusAtendente();

        // Assert: Valida envio do PATCH e atualização visual para o novo status
        if (isMock) {
          cy.wait('@updateAttendantStatus').its('request.body.status').should('eq', backendStatusAlvo);
        }
        AtendimentosPage.validarStatusAtendente(statusAlvo);
      });
    });

    it('6.7 deve alternar novamente o status operacional retornando ao estado anterior', () => {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';

      // Act 1: Lê o estado atual
      AtendimentosPage.elements.btnStatusAtendente().invoke('text').then((textoAtual) => {
        const statusAtual = textoAtual.match(/Disponível|Ocupado|Offline/i)?.[0];
        const statusAlvo = /Disponível/i.test(statusAtual) ? 'Ocupado' : 'Disponível';
        const backendStatusAlvo = statusAlvo === 'Ocupado' ? 'busy' : 'available';

        if (isMock) {
          AtendimentosMocks.interceptUpdateAttendantStatusApi('*', { status: backendStatusAlvo });
          AtendimentosMocks.interceptAttendantStatusApi('*', { status: backendStatusAlvo });
        }

        // Act 2: Clica para retornar ao estado anterior
        AtendimentosPage.alternarStatusAtendente();

        // Assert: Valida a transição e a restauração do status
        if (isMock) {
          cy.wait('@updateAttendantStatus').its('request.body.status').should('eq', backendStatusAlvo);
        }
        AtendimentosPage.validarStatusAtendente(statusAlvo);
      });
    });

    it('6.8 deve tratar o estado inicial "Offline" e alternar diretamente para "Disponível"', () => {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';
      if (!isMock) {
        cy.log('Cenário de status offline simulado via mock hermético');
        return;
      }

      // Arrange: Simula atendente com status offline no backend
      AtendimentosMocks.interceptAttendantStatusApi('*', { status: 'offline' });
      AtendimentosMocks.interceptUpdateAttendantStatusApi('*', { status: 'available' });
      cy.reload();

      // Validação intermediária: Confirma renderização do rótulo "Offline"
      AtendimentosPage.validarStatusAtendente('Offline');

      // Act: Alterna a partir do estado offline
      AtendimentosPage.alternarStatusAtendente();

      // Assert: Valida transição para "available" / "Disponível"
      cy.wait('@updateAttendantStatus').its('request.body.status').should('eq', 'available');
      AtendimentosPage.validarStatusAtendente('Disponível');
    });

    it('6.9 deve persistir o status do atendente entre recarregamentos de página', () => {
      // Act 1: Captura o estado atual do switch antes do recarregamento
      AtendimentosPage.elements.btnStatusAtendente().invoke('text').then((textoAntes) => {
        const statusEsperado = textoAntes.match(/Disponível|Ocupado|Offline/i)?.[0];

        // Act 2: Recarrega a página para simular persistência via GET
        cy.reload();

        // Assert: Sincroniza com o GET e valida que o estado persiste exatamente como deixado
        AtendimentosPage.validarStatusAtendente(statusEsperado);
      });
    });

    it('6.10 não deve exibir o componente quando o usuário não possui a capability can_access_attendance_module', () => {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';
      if (!isMock) {
        cy.log('Cenário de capability ausente testado em modo mock hermético');
        return;
      }

      // Arrange: Remove a capability can_access_attendance_module
      AtendimentosMocks.interceptAttendanceCapabilitiesApi({
        capabilities: {
          can_access_attendance_module: false
        }
      });
      cy.reload();

      // Assert: Valida que o switch de status do atendente não existe no DOM
      AtendimentosPage.validarAusenciaStatusAtendente();
    });

    it('6.11 deve lidar de forma resiliente quando o atendente não possui vínculo com grupo de canal (erro 422)', () => {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';
      if (!isMock) {
        cy.log('Cenário de erro 422 testado em modo mock hermético');
        return;
      }

      // Arrange: Simula retorno 422 do backend para atendente sem grupo vinculado
      AtendimentosMocks.interceptAttendantStatusApi('*', { message: 'Atendente não vinculado a grupo de canal' }, 422);
      cy.reload();

      // Assert: O switch não deve ser renderizado e a tela deve permanecer estável
      AtendimentosPage.validarAusenciaStatusAtendente();
      AtendimentosPage.elements.tituloAtendimentos().should('be.visible');
    });

    // -------------------------------------------------------------
    // Modal de transferência com grupos e fila geral (Issue front#561/PR #574 e #578, backend#666/PR #671 e #672)
    // Fatos medidos na dev real em 2026-10-16 (AGENTS.md §4.3): o grupo atual vem selecionado e a fila geral dele é indisponível; em outro grupo a fila geral vem marcada.
    // Os testes de leitura (#6.12 a #6.15) valem em mock e em API real: o esperado vem da própria resposta de /channel-groups e de /agents (alias), não de valor fixo.
    // Transferir para a fila geral muda o atendimento de forma que não se desfaz: o PATCH é sempre simulado (`interceptTransferPatchApi`) e nenhum teste confirma contra a API real.
    // #6.16 a #6.18 forçam o payload de grupos/atendentes (`forcarMock`, `[R-BLIND]`): a massa real não tem nome com acento nem estado de erro.
    // -------------------------------------------------------------
    const ID_ATENDIMENTO_TRANSFERENCIA = 260800105;
    const GRUPO_ATUAL_TRANSFERENCIA = { id: 7, name: 'ATENDIMENTO' }; // grupo do atendimento simulado por interceptMockAtendimentoSemAtendente

    // Abre a modal no atendimento simulado sem atendente e devolve o corpo da lista de atendentes do grupo atual (`{ agents }`)
    const abrirModalTransferencia = ({ forcarMock = false, grupoAtual = GRUPO_ATUAL_TRANSFERENCIA } = {}) => {
      AtendimentosMocks.interceptMockAtendimentoSemAtendente(ID_ATENDIMENTO_TRANSFERENCIA, 'Cliente Teste', grupoAtual);
      AtendimentosMocks.interceptMessagesListApi(ID_ATENDIMENTO_TRANSFERENCIA, AtendimentosMocks.mockMessagesListData);
      AtendimentosMocks.interceptTransferGroupsApi(forcarMock);
      AtendimentosMocks.interceptTransferAgentsApi(forcarMock);
      AtendimentosMocks.interceptTransferPatchApi(ID_ATENDIMENTO_TRANSFERENCIA);
      AtendimentosPage.filtrarPorStatusChip('pending');
      cy.wait('@getAttendancesList');
      AtendimentosPage.elements.cardsAtendimento().first().click();
      cy.wait('@getAttendanceMessages');
      AtendimentosPage.abrirModalTransferirPeloCard(ID_ATENDIMENTO_TRANSFERENCIA);
      return cy.wait('@getAttendanceGroupAgents').its('response.body');
    };

    // Regra do legado (Issue front#583/PR #591): a modal só lista grupo com vínculo a canal (`channels` não vazio em `/channel-groups`, backend#672),
    // mais o grupo atual do atendimento, que fica mesmo sem vínculo porque é nele que se troca de atendente. Sem o campo `channels` (produção antes
    // da backend#672) a lista fica como era: só some o grupo cujo `channels` veio como lista vazia.
    const grupoSemVinculo = (grupo) => Array.isArray(grupo.channels) && grupo.channels.length === 0;
    const gruposVisiveisNaModal = (grupos, idGrupoAtual = GRUPO_ATUAL_TRANSFERENCIA.id) => grupos.filter((grupo) => !grupoSemVinculo(grupo) || grupo.id === idGrupoAtual);

    it('6.12 deve listar na modal de transferência os grupos vinculados a canal devolvidos por GET /channel-groups, com os canais e o selo disponíveis/total (Issue front#561/PR #574, front#583/PR #591)', () => {
      // Arrange + Act: abre a modal do atendimento simulado
      abrirModalTransferencia();

      // Assert: cada grupo visível (vinculado ou o atual) aparece com o nome, os canais e o selo `agents_available/agents_total`
      cy.wait('@getGruposCanal').its('response.body.items').then((grupos) => {
        expect(grupos, 'grupos devolvidos pela API').to.be.an('array').and.not.be.empty;
        const visiveis = gruposVisiveisNaModal(grupos);
        expect(visiveis, 'grupos que a modal deve exibir').to.not.be.empty;
        AtendimentosPage.elements.listaGruposTransferir().should('exist');
        visiveis.forEach((grupo) => AtendimentosPage.validarGrupoNaModalTransferir(grupo));
      });

      AtendimentosPage.fecharModalTransferir();
    });

    it('6.13 deve mostrar a fila geral do grupo atual como indisponível, com o motivo, destino vazio e confirmação desabilitada (Issue front#561/PR #574)', () => {
      // Arrange + Act: abre a modal; o grupo atual do atendimento vem selecionado
      abrirModalTransferencia();

      // Assert: a fila geral do próprio grupo é recusada pelo backend (422 ATTENDANCE_SAME_GROUP), então a tela já a bloqueia
      AtendimentosPage.elements.getOpcaoGrupoTransferir(GRUPO_ATUAL_TRANSFERENCIA.id).should('have.attr', 'aria-selected', 'true');
      AtendimentosPage.validarFilaGeralIndisponivel();
      AtendimentosPage.elements.destinoTransferir().should('contain', '—');
      AtendimentosPage.elements.btnConfirmarTransferir().should('be.disabled');

      // Act: cancela
      AtendimentosPage.fecharModalTransferir();

      // Assert: nada foi enviado
      cy.get('@transferAttendancePatch.all').should('have.length', 0);
    });

    it('6.14 deve marcar por padrão a fila geral de outro grupo e refletir o grupo no botão e no destino, sem enviar a transferência (Issue front#561/PR #574)', () => {
      // Arrange + Act: abre a modal e escolhe um grupo diferente do atual
      abrirModalTransferencia();
      cy.wait('@getGruposCanal').its('response.body.items').then((grupos) => {
        const outroGrupo = grupos.find((grupo) => grupo.id !== GRUPO_ATUAL_TRANSFERENCIA.id && !grupoSemVinculo(grupo));
        expect(outroGrupo, '🔒 A loja não tem outro grupo vinculado a canal além do atual (massa)').to.exist;
        AtendimentosPage.selecionarGrupoNaModalTransferir(outroGrupo.id);

        // Assert: a fila geral vem marcada e habilitada; botão e destino citam o grupo escolhido
        AtendimentosPage.validarFilaGeralSelecionada(outroGrupo.name);
      });

      // Act: cancela (a fila geral não se desfaz, então nenhum teste a confirma contra a API real)
      AtendimentosPage.fecharModalTransferir();

      // Assert: nada foi enviado
      cy.get('@transferAttendancePatch.all').should('have.length', 0);
    });

    it('6.15 deve mostrar a carga de cada atendente do grupo atual e o destino com o nome e o grupo ao escolhê-lo (Issue front#561/PR #574)', () => {
      // Arrange + Act: abre a modal; a lista de atendentes do grupo atual vem de GET /attendance-groups/:id/agents
      abrirModalTransferencia().then(({ agents }) => {
        const atendente = agents.find((a) => a.status === 'available') || agents[0];
        expect(atendente, '🔒 O grupo atual não tem atendentes (massa)').to.exist;

        // Assert 1: a opção mostra "N atendimento(s) em curso" (`ongoing_attendances`) devolvido pela API
        AtendimentosPage.validarAtendenteComCargaNaModalTransferir(atendente.name, atendente.ongoing_attendances);

        // Act: escolhe o atendente do próprio grupo (continua liberado)
        AtendimentosPage.selecionarAtendenteNaModalTransferir(atendente.name);

        // Assert 2: botão "Transferir para <nome>" habilitado e destino "<nome> · <grupo>"
        AtendimentosPage.validarDestinoAtendenteTransferir(atendente.name, GRUPO_ATUAL_TRANSFERENCIA.name);
      });

      // Act: cancela
      AtendimentosPage.fecharModalTransferir();

      // Assert: nada foi enviado
      cy.get('@transferAttendancePatch.all').should('have.length', 0);
    });

    it('6.16 deve filtrar os atendentes da modal sem distinguir maiúsculas, minúsculas nem acentos (Issue front#561, cenário 4)', () => {
      // Arrange: atendentes com acento (a massa real não tem), payload fixo
      abrirModalTransferencia({ forcarMock: true });

      // Act + Assert: o termo sem acento acha o nome com acento, e o inverso
      [
        ['jose', 'josé conceição'],
        ['JOSE CONCEICAO', 'josé conceição'],
        ['luisa', 'maria luísa'],
        ['ARAUJO', 'ana júlia araújo'],
        ['júlia', 'ana júlia araújo']
      ].forEach(([termo, nomeEsperado]) => {
        AtendimentosPage.buscarAtendenteNaModalTransferir(termo);
        AtendimentosPage.elements.listaAtendentesTransferir().find('[role="option"]')
          .should('have.length', 1)
          .and(($opcao) => expect($opcao.text().toLowerCase(), `resultado da busca por "${termo}"`).to.contain(nomeEsperado));
      });

      // Assert: termo sem correspondência não deixa nenhum atendente na modal
      AtendimentosPage.buscarAtendenteNaModalTransferir('zzzzzz');
      AtendimentosPage.elements.opcoesAtendenteTransferir().should('not.exist');

      AtendimentosPage.fecharModalTransferir();
    });

    it('6.17 deve transferir para a fila geral de outro grupo enviando só channel_group_id, avisar o sucesso e atualizar o card sem recarregar (Issue front#561/PR #574)', () => {
      // Arrange: grupos e atendentes fixos; o atendimento está no grupo 7
      abrirModalTransferencia({ forcarMock: true });

      // Act 1: escolhe a fila de outro grupo (BALCAO)
      AtendimentosPage.selecionarGrupoNaModalTransferir(1);
      AtendimentosPage.validarFilaGeralSelecionada('BALCAO');

      // Arrange (pós-transferência): a fila e o detalhe passam a trazer o atendimento Pendente, sem atendente, no grupo de destino
      AtendimentosMocks.interceptMockAtendimentoSemAtendente(ID_ATENDIMENTO_TRANSFERENCIA, 'Cliente Teste', { id: 1, name: 'BALCAO' });
      AtendimentosMocks.interceptTransferPatchApi(ID_ATENDIMENTO_TRANSFERENCIA, { grupo: { id: 1, name: 'BALCAO' } });

      // Act 2: confirma
      AtendimentosPage.confirmarTransferencia();

      // Assert 1: o corpo leva só o grupo, sem atendente nem status (o backend recusa status junto, 422)
      cy.wait('@transferAttendancePatch').its('request.body').should('deep.equal', { channel_group_id: 1 });

      // Assert 2: toast de sucesso e card atualizado pela invalidação da fila, sem F5
      cy.contains(/Atendimento transferido com sucesso/i).should('be.visible');
      cy.wait('@getAttendancesList');
      AtendimentosPage.elements.cardsAtendimento().first().should(($card) => {
        const texto = $card.text().toLowerCase();
        expect(texto, 'card sem atendente').to.contain('sem atendente');
        expect(texto, 'card no grupo de destino').to.contain('balcao');
      });
    });

    it('6.18 deve tratar na modal as recusas da transferência para a fila geral: 422 ATTENDANCE_SAME_GROUP no rodapé e 409 ATTENDANCE_TRANSFER_CLOSED em toast, recarregando o detalhe (Issue front#561/PR #574)', () => {
      // Arrange: a tela acha que o atendimento está no grupo 1 e libera a fila do grupo 7, que o backend já recusa (tela desatualizada)
      abrirModalTransferencia({ forcarMock: true, grupoAtual: { id: 1, name: 'BALCAO' } });
      AtendimentosPage.selecionarGrupoNaModalTransferir(7);
      AtendimentosPage.validarFilaGeralSelecionada('ATENDIMENTO');

      // Act 1: confirma com o backend respondendo 422 ATTENDANCE_SAME_GROUP
      AtendimentosMocks.interceptTransferPatchApi(ID_ATENDIMENTO_TRANSFERENCIA, {
        statusCode: 422,
        body: { status: 422, error: 'Unprocessable Content', code: 'ATTENDANCE_SAME_GROUP', message: 'O atendimento já está neste grupo.' }
      });
      cy.get('@getAttendanceDetail.all').then((chamadas) => {
        const detalhesAntes = chamadas.length;
        AtendimentosPage.elements.btnConfirmarTransferir().click();
        cy.wait('@transferAttendancePatch');

        // Assert 1: a modal fica aberta com a mensagem no rodapé e o detalhe é relido (só acontece com a tela desatualizada)
        AtendimentosPage.elements.modalTransferir().should('be.visible').and('contain', 'O atendimento já está neste grupo');
        cy.get('@getAttendanceDetail.all').should((relidas) => expect(relidas.length, 'detalhe relido após o 422').to.be.greaterThan(detalhesAntes));
      });

      // Act 2: confirma de novo, agora com o backend respondendo 409 ATTENDANCE_TRANSFER_CLOSED (encerrado depois de a tela abrir)
      AtendimentosMocks.interceptTransferPatchApi(ID_ATENDIMENTO_TRANSFERENCIA, {
        statusCode: 409,
        body: { status: 409, error: 'Conflict', code: 'ATTENDANCE_TRANSFER_CLOSED', message: 'Não é possível trocar o grupo de um atendimento encerrado.' }
      });
      cy.get('@getAttendanceDetail.all').then((chamadas) => {
        const detalhesAntes = chamadas.length;
        AtendimentosPage.elements.btnConfirmarTransferir().click();
        cy.wait('@transferAttendancePatch');

        // Assert 2: toast de encerrado e detalhe relido
        cy.contains('Atendimento encerrado não pode mudar de grupo').should('be.visible');
        cy.get('@getAttendanceDetail.all').should((relidas) => expect(relidas.length, 'detalhe relido após o 409').to.be.greaterThan(detalhesAntes));
      });
    });

    it('6.19 deve omitir da modal de transferência os grupos sem vínculo a canal, que seguem existindo na API, e manter o atendimento na fila (Issue front#583/PR #591)', () => {
      // Arrange + Act: abre a modal do atendimento simulado (grupo atual com vínculo)
      abrirModalTransferencia();

      // Assert: os grupos que a API devolve com `channels` vazio (ex.: SAC) não aparecem
      cy.wait('@getGruposCanal').its('response.body.items').then((grupos) => {
        const ocultos = grupos.filter((grupo) => grupoSemVinculo(grupo) && grupo.id !== GRUPO_ATUAL_TRANSFERENCIA.id);
        const vinculados = grupos.filter((grupo) => !grupoSemVinculo(grupo) && grupo.id !== GRUPO_ATUAL_TRANSFERENCIA.id);
        expect(ocultos, '🔒 A loja não tem grupo sem vínculo a canal (massa)').to.not.be.empty;
        expect(vinculados, '🔒 A loja não tem outro grupo vinculado além do atual (massa)').to.not.be.empty;

        // Enquanto `/channel-groups` carrega a modal mostra só o grupo atual: ancora na chegada de um grupo vinculado antes de afirmar a ausência
        AtendimentosPage.elements.getOpcaoGrupoTransferir(vinculados[0].id).should('exist');
        ocultos.forEach((grupo) => AtendimentosPage.elements.getOpcaoGrupoTransferir(grupo.id).should('not.exist'));
      });

      // Act: fecha a modal
      AtendimentosPage.fecharModalTransferir();

      // Assert: o atendimento continua na fila
      AtendimentosPage.elements.cardsAtendimento().should('have.length.gte', 1);
    });

    it('6.20 deve manter na modal o grupo atual do atendimento mesmo sem vínculo a canal, com a fila geral dele indisponível (Issue front#583/PR #591)', () => {
      // Arrange + Act: o atendimento está no grupo 5 (E-COMMERCE), que o payload fixo devolve com `channels` vazio
      abrirModalTransferencia({ forcarMock: true, grupoAtual: { id: 5, name: 'E-COMMERCE' } });

      // Assert: o grupo atual aparece e vem selecionado (é nele que se troca de atendente), junto dos grupos vinculados
      AtendimentosPage.elements.getOpcaoGrupoTransferir(7).should('exist');
      AtendimentosPage.elements.getOpcaoGrupoTransferir(5).should('have.attr', 'aria-selected', 'true');
      AtendimentosPage.validarFilaGeralIndisponivel();

      AtendimentosPage.fecharModalTransferir();
    });
  });

  // -------------------------------------------------------------
  // 7. PAINEL DE FILTROS AVANÇADOS DE ATENDIMENTOS
  // -------------------------------------------------------------

  context('7. Painel de Filtros Avançados de Atendimentos', () => {

    it('7.1 deve abrir o modal de filtros e validar todos os elementos e estados iniciais padrão', () => {
      // Arrange: Confirma que a tela de atendimentos está carregada
      AtendimentosPage.elements.tituloAtendimentos().should('be.visible');

      // Act: Abre o modal de filtros clicando no botão da barra superior
      AtendimentosPage.abrirModalFiltros();

      // Assert: Valida a estrutura visual e os estados padrão de cada controle
      AtendimentosPage.validarEstruturaInicialFiltros();

      // Teardown: Fecha o modal de filtros
      AtendimentosPage.fecharModalFiltros();
    });

    it('7.2 deve exibir os campos do modal de filtros na ordem Data > Status > Canal > Grupos > Funcionário (PR #435)', () => {
      // Arrange: Abre o modal de filtros
      AtendimentosPage.abrirModalFiltros();

      // Act: Coleta a posição vertical (top) de cada campo no DOM.
      // Nota: a PR #435 não usa tabIndex nos campos, então a ordem de navegação por teclado
      // (Tab/Shift+Tab) segue exatamente a ordem visual/DOM medida aqui — não há necessidade
      // de simular teclas de Tab separadamente (não há plugin de simulação de Tab neste projeto).
      const posicoes = {};

      AtendimentosPage.elements.btnFiltroDataModal().then(($el) => {
        posicoes.data = $el[0].getBoundingClientRect().top;
      });
      AtendimentosPage.elements.selectStatusFiltro().then(($el) => {
        posicoes.status = $el[0].getBoundingClientRect().top;
      });
      AtendimentosPage.elements.selectCanalFiltro().then(($el) => {
        posicoes.canal = $el[0].getBoundingClientRect().top;
      });
      AtendimentosPage.elements.selectGruposFiltro().then(($el) => {
        posicoes.grupos = $el[0].getBoundingClientRect().top;
      });
      AtendimentosPage.elements.selectFuncionarioFiltro().then(($el) => {
        posicoes.funcionario = $el[0].getBoundingClientRect().top;

        // Assert: a ordem vertical dos campos segue exatamente Data > Status > Canal > Grupos > Funcionário
        expect(posicoes.data, 'Data deve vir antes de Status').to.be.lessThan(posicoes.status);
        expect(posicoes.status, 'Status deve vir antes de Canal').to.be.lessThan(posicoes.canal);
        expect(posicoes.canal, 'Canal deve vir antes de Grupos').to.be.lessThan(posicoes.grupos);
        expect(posicoes.grupos, 'Grupos deve vir antes de Funcionário').to.be.lessThan(posicoes.funcionario);
      });

      // Teardown: Fecha o modal de filtros
      AtendimentosPage.fecharModalFiltros();
    });

    it('7.3 deve manter os campos Canal e Grupos independentes, sem que a seleção de um dependa do outro', () => {
      // Arrange: Abre o modal de filtros
      AtendimentosPage.abrirModalFiltros();

      // Assert 1: O campo Grupos já vem habilitado e populado com todos os grupos, mesmo sem nenhum Canal selecionado
      AtendimentosPage.elements.selectGruposFiltro()
        .should('not.be.disabled')
        .find('option')
        .should('have.length.greaterThan', 1);

      // Act 1: Seleciona um Grupo sem antes selecionar nenhum Canal
      AtendimentosPage.selecionarGrupoFiltro('7');
      AtendimentosPage.elements.selectGruposFiltro().find('option:selected').should('not.contain', 'Todos os grupos');
      AtendimentosPage.elements.selectCanalFiltro().find('option:selected').should('contain', 'Todos os canais');

      // Act 2: Seleciona um Canal e confirma que a seleção prévia de Grupo não é resetada nem desabilitada
      AtendimentosPage.selecionarCanalFiltro('6');
      AtendimentosPage.elements.selectGruposFiltro()
        .should('not.be.disabled')
        .find('option:selected')
        .should('not.contain', 'Todos os grupos');

      // Teardown: Fecha o modal de filtros
      AtendimentosPage.fecharModalFiltros();
    });

    it('7.4 deve listar funcionários independentemente de canal e grupo sem erro 403 (PR #339)', () => {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';

      // 1. Arrange: Garante mock de funcionários se em modo mock
      if (isMock) {
        AtendimentosMocks.interceptStoreEmployeesApi('*');
      }

      // 2. Act 1: Abre o modal de filtros
      AtendimentosPage.abrirModalFiltros();

      // 3. Assert 1: O select de funcionários já carrega habilitado via /employees (PR #339, sem grant 471)
      AtendimentosPage.elements.selectFuncionarioFiltro()
        .should('be.visible')
        .and('not.be.disabled')
        .find('option')
        .should('have.length.greaterThan', 1)
        .then(($opts) => {
          const textos = [...$opts].map(o => o.text.toUpperCase());
          expect(textos.some(t => t.includes('TODOS OS FUNCIONÁRIOS'))).to.be.true;
          expect(textos.some(t => t.includes('SEM ATENDENTE'))).to.be.true;
        });

      // Valida ausência do erro de tela do 403 ("Erro ao carregar as opções. Tentar novamente")
      cy.contains(/Erro ao carregar as opções/i).should('not.exist');

      // 4. Act 2: Seleciona Canal e Grupo no modal
      AtendimentosPage.selecionarCanalFiltro('6');
      cy.wait('@getGruposCanal');
      AtendimentosPage.selecionarGrupoFiltro('7');

      // 5. Assert 2: Seleção de canal e grupo não quebra o campo Funcionário nem dispara erro 403
      cy.contains(/Erro ao carregar as opções/i).should('not.exist');
      AtendimentosPage.elements.selectFuncionarioFiltro()
        .should('be.visible')
        .and('not.be.disabled');

      // 6. Act 3: Seleciona um funcionário específico e aplica os filtros
      AtendimentosPage.elements.selectFuncionarioFiltro().then(($sel) => {
        const opts = [...$sel.find('option')];
        if (opts.length > 2) {
          cy.wrap($sel).select(opts[2].value);
        }
      });

      AtendimentosPage.aplicarFiltros();

      // Assert 3: Modal fechado e listagem de atendimentos operacional
      AtendimentosPage.elements.modalFiltros().should('not.exist');
      AtendimentosPage.elements.tituloAtendimentos().should('be.visible');
    });

    it('7.5 deve aplicar os filtros selecionados disparando as requisições e fechando o modal', () => {
      // Arrange: Abre o modal de filtros e configura uma combinação completa de filtros
      AtendimentosPage.abrirModalFiltros();
      AtendimentosPage.selecionarCanalFiltro('6');
      cy.wait('@getGruposCanal');
      AtendimentosPage.selecionarGrupoFiltro('7');
      AtendimentosPage.selecionarStatusFiltro('waiting');

      // Act: Clica no botão Aplicar filtros
      AtendimentosPage.aplicarFiltros();

      // Assert: O modal deve ser fechado e a tela de atendimentos permanece ativa e operacional
      AtendimentosPage.elements.modalFiltros().should('not.exist');
      AtendimentosPage.elements.tituloAtendimentos().should('be.visible');
      AtendimentosPage.elements.cardsAtendimento().should('exist');
    });

    it('7.6 deve resetar todos os campos para o estado inicial ao clicar em Limpar', () => {
      // Arrange: Abre o modal e altera as seleções de canal e grupo (independentes entre si)
      AtendimentosPage.abrirModalFiltros();
      AtendimentosPage.selecionarCanalFiltro('6');
      AtendimentosPage.selecionarGrupoFiltro('7');
      AtendimentosPage.elements.selectGruposFiltro().find('option:selected').should('not.contain', 'Todos os grupos');

      // Act: Clica no botão Limpar (a ação reseta os filtros e fecha a modal)
      AtendimentosPage.limparFiltros();

      // Assert: Ao reabrir a modal, os campos retornam aos seus valores e estados padrão
      AtendimentosPage.abrirModalFiltros();
      AtendimentosPage.elements.selectCanalFiltro().find('option:selected').should('contain', 'Todos os canais');
      AtendimentosPage.elements.selectGruposFiltro().should('not.be.disabled');
      AtendimentosPage.elements.selectGruposFiltro().find('option:selected').should('contain', 'Todos os grupos');
      AtendimentosPage.elements.selectFuncionarioFiltro().find('option:selected').should(($opt) => {
        const texto = $opt.text();
        expect(texto, 'Default do filtro Funcionário deve ser "Padrão (meus atendimentos)" ou "Todos os funcionários"')
          .to.match(/Padrão \(meus atendimentos\)|Todos os funcionários/);
      });

      // Teardown: Fecha o modal de filtros
      AtendimentosPage.fecharModalFiltros();
    });

    it('7.7 deve fechar o modal de filtros sem aplicar alterações ao clicar no botão Fechar (×) ou pressionar ESC', () => {
      // Arrange 1: Abre o modal de filtros
      AtendimentosPage.abrirModalFiltros();

      // Act 1: Clica no botão de fechar (x)
      AtendimentosPage.elements.btnFecharModalFiltros().click();

      // Assert 1: Modal deixa de existir no DOM
      AtendimentosPage.elements.modalFiltros().should('not.exist');

      // Act 2: Reabre o modal e pressiona a tecla ESC
      AtendimentosPage.abrirModalFiltros();
      cy.get('body').type('{esc}');

      // Assert 2: Modal deixa de existir no DOM
      AtendimentosPage.elements.modalFiltros().should('not.exist');
    });

  });

  // -------------------------------------------------------------
  // 8. REGRAS DE PRIORIDADE E ORDENAÇÃO DE ATENDIMENTOS (PARIDADE DESKTOP - ISSUE #373)
  // -------------------------------------------------------------

  context('8. Regras de Prioridade e Ordenação de Atendimentos (Paridade Desktop - Issue #373)', () => {

    beforeEach(() => {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';
      if (!isMock) {
        // Limpa os mocks para interagir com a API real
        AtendimentosMocks.clearMocksForRealE2ETests();
      }
    });

    it('8.1 deve priorizar atendimentos com mensagens pendentes de leitura no topo da lista (1ª regra)', () => {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true' || configEnv.USE_MOCKS === true || configEnv.USE_MOCKS === 'true';

      if (isMock) {
        // Arrange: Cria massa com atendimentos não lidos e atendimentos já lidos
        const mockPayloadNaoLidos = {
          items: [
            {
              id: 260800077,
              reference_at: "2026-08-20T14:00:00.000Z",
              attendant_name: "ITALO PATRICK",
              customer_name: "Cliente sem nome (2 não lidas)",
              messages: {
                unread_count: 2,
                last_message: { type: 0, body: "[STICKER]", occurred_at: "2026-08-20T14:30:00.000Z" }
              },
              status: 0,
              channel: { id: 6, name: "WHATSAPP OFICIAL - 62 98222-4382", type: 1, subtype: 1 },
              group: { id: 7, name: "ATENDIMENTO" }
            },
            {
              id: 260800076,
              reference_at: "2026-08-20T15:00:00.000Z",
              attendant_name: "Sem atendente",
              customer_name: "Dayane (1 não lida)",
              messages: {
                unread_count: 1,
                last_message: { type: 0, body: "Link para Detalhes e Pagamento...", occurred_at: "2026-08-20T15:30:00.000Z" }
              },
              status: 0,
              channel: { id: 6, name: "WHATSAPP OFICIAL - 62 98222-4382", type: 1, subtype: 1 },
              group: { id: 7, name: "ATENDIMENTO" }
            },
            {
              id: 260800078,
              reference_at: "2026-08-21T07:00:00.000Z",
              attendant_name: "JEFERSON MARTINS",
              customer_name: "Dayane (Sem mensagens não lidas)",
              messages: {
                unread_count: 0,
                last_message: { type: 1, body: "[STICKER ANIMADO]", occurred_at: "2026-08-21T07:30:00.000Z" }
              },
              status: 1,
              channel: { id: 6, name: "WHATSAPP OFICIAL - 62 98222-4382", type: 1, subtype: 1 },
              group: { id: 7, name: "ATENDIMENTO" }
            }
          ],
          pagination: { page: 1, per_page: 20, total: 3, total_pages: 1, has_next: false, has_previous: false }
        };

        // Arrange: Configura interceptação com o mock ordenado
        AtendimentosMocks.interceptAttendancesListApi(mockPayloadNaoLidos);

        // Act: Força atualização da listagem no filtro "Aguardando"
        AtendimentosPage.forcarFiltroStatus('waiting');
        cy.wait('@getAttendancesList');

        // Assert 1: Valida que a ordem dos cards coloca os atendimentos não lidos no topo da fila
        const idsEsperados = [260800077, 260800076, 260800078];
        AtendimentosPage.validarOrdemCardsPorIds(idsEsperados);

        // Assert 2: Valida os badges com as contagens de mensagens não lidas
        AtendimentosPage.validarCardPossuiBadgeNaoLido(260800077, 2);
        AtendimentosPage.validarCardPossuiBadgeNaoLido(260800076, 1);
      } else {
        // Arrange & Act (Modo API Real): Valida a 1ª Regra de Prioridade diretamente na fila real
        AtendimentosPage.forcarFiltroStatus('waiting');
        cy.wait('@getAttendancesList', { timeout: 15000 });
        AtendimentosPage.elements.cardsAtendimento().should('have.length.gte', 1);
        AtendimentosPage.validarHierarquiaOrdenacaoCardsRenderizados();
      }
    });

    it('8.2 deve priorizar atendimentos há mais tempo sem resposta ao cliente entre conversas lidas (2ª regra)', () => {
      // Arrange: Atendimento com mensagem do cliente há 4h vs atendimento com mensagem do cliente há 1h
      const mockPayloadTempoResposta = {
        items: [
          {
            id: 260800081,
            reference_at: "2026-08-21T08:00:00.000Z",
            attendant_name: "KLISMAM MONTEIRO",
            customer_name: "Carlos (Aguardando resposta há 4h)",
            messages: {
              unread_count: 0,
              last_message: { type: 0, body: "Gostaria de confirmar o pedido por favor", occurred_at: "2026-08-21T08:00:00.000Z" }
            },
            status: 1,
            channel: { id: 6, name: "WHATSAPP OFICIAL - 62 98222-4382", type: 1, subtype: 1 },
            group: { id: 7, name: "ATENDIMENTO" }
          },
          {
            id: 260800082,
            reference_at: "2026-08-21T11:00:00.000Z",
            attendant_name: "KLISMAM MONTEIRO",
            customer_name: "Mariana (Aguardando resposta há 1h)",
            messages: {
              unread_count: 0,
              last_message: { type: 0, body: "Qual o prazo de entrega?", occurred_at: "2026-08-21T11:00:00.000Z" }
            },
            status: 1,
            channel: { id: 6, name: "WHATSAPP OFICIAL - 62 98222-4382", type: 1, subtype: 1 },
            group: { id: 7, name: "ATENDIMENTO" }
          }
        ],
        pagination: { page: 1, per_page: 20, total: 2, total_pages: 1, has_next: false, has_previous: false }
      };

      // Arrange: Intercepta a listagem com os atendimentos aguardando resposta
      AtendimentosMocks.interceptAttendancesListApi(mockPayloadTempoResposta);

      // Act: Força atualização da listagem no filtro "Aguardando"
      AtendimentosPage.forcarFiltroStatus('waiting');
      cy.wait('@getAttendancesList');

      // Assert: Valida que o atendimento aguardando há mais tempo (260800081) fica antes do mais recente (260800082)
      const idsEsperados = [260800081, 260800082];
      AtendimentosPage.validarOrdemCardsPorIds(idsEsperados);
    });

    it('8.3 deve priorizar atendimentos há mais tempo sem mensagem do atendente entre conversas já respondidas (3ª regra)', () => {
      // Arrange: Atendimento respondido pelo atendente há 5h vs atendimento respondido pelo atendente há 30min
      const mockPayloadTempoMensagemAtendente = {
        items: [
          {
            id: 260800078,
            reference_at: "2026-08-21T07:00:00.000Z",
            attendant_name: "JEFERSON MARTINS",
            customer_name: "Dayane (Respondido há 5h)",
            messages: {
              unread_count: 0,
              last_message: { type: 1, body: "[STICKER ANIMADO]", occurred_at: "2026-08-21T07:30:00.000Z" }
            },
            status: 1,
            channel: { id: 6, name: "WHATSAPP OFICIAL - 62 98222-4382", type: 1, subtype: 1 },
            group: { id: 7, name: "ATENDIMENTO" }
          },
          {
            id: 260800079,
            reference_at: "2026-08-21T12:00:00.000Z",
            attendant_name: "JEFERSON MARTINS",
            customer_name: "Lucas (Respondido há 30min)",
            messages: {
              unread_count: 0,
              last_message: { type: 1, body: "Seu pedido foi despachado.", occurred_at: "2026-08-21T12:30:00.000Z" }
            },
            status: 1,
            channel: { id: 6, name: "WHATSAPP OFICIAL - 62 98222-4382", type: 1, subtype: 1 },
            group: { id: 7, name: "ATENDIMENTO" }
          }
        ],
        pagination: { page: 1, per_page: 20, total: 2, total_pages: 1, has_next: false, has_previous: false }
      };

      // Arrange: Intercepta a listagem com atendimentos respondidos
      AtendimentosMocks.interceptAttendancesListApi(mockPayloadTempoMensagemAtendente);

      // Act: Força atualização da listagem no filtro "Aguardando"
      AtendimentosPage.forcarFiltroStatus('waiting');
      cy.wait('@getAttendancesList');

      // Assert: Valida que o atendimento com interação mais antiga do atendente (260800078) fica antes do recente (260800079)
      const idsEsperados = [260800078, 260800079];
      AtendimentosPage.validarOrdemCardsPorIds(idsEsperados);
    });

    it('8.4 deve aplicar a hierarquia completa de ordenação: Mensagem pendente > Mais tempo sem resposta > Mais tempo sem mensagem do atendente', function () {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true' || configEnv.USE_MOCKS === true || configEnv.USE_MOCKS === 'true';

      if (isMock) {
        // Arrange (Modo Mock): Utiliza o mock completo estruturado com as 3 regras simultâneas
        AtendimentosMocks.interceptAttendancesListApi(AtendimentosMocks.mockAttendancesOrdenacaoData);

        // Act: Força atualização da listagem no filtro "Aguardando"
        AtendimentosPage.forcarFiltroStatus('waiting');
        cy.wait('@getAttendancesList');

        // Assert: Valida a ordenação de todos os 6 cards na sequência exata da prioridade
        const idsEsperados = [
          260800077, // 1ª regra: 2 mensagens não lidas
          260800076, // 1ª regra: 1 mensagem não lida
          260800081, // 2ª regra: cliente esperando resposta há 4h
          260800082, // 2ª regra: cliente esperando resposta há 1h
          260800078, // 3ª regra: respondido pelo atendente há 5h
          260800079  // 3ª regra: respondido pelo atendente há 30min
        ];
        AtendimentosPage.validarOrdemCardsPorIds(idsEsperados);

        // Assert adicional: Valida os badges de mensagens não lidas nos cards de topo
        AtendimentosPage.validarCardPossuiBadgeNaoLido(260800077, 2);
        AtendimentosPage.validarCardPossuiBadgeNaoLido(260800076, 1);
      } else {
        // Arrange & Act (Modo API Real): Força o status "Aguardando" para capturar o retorno real do backend na fila ativa
        AtendimentosPage.forcarFiltroStatus('waiting');

        // Assert 1: Aguarda a resposta real da API de listagem de atendimentos
        cy.wait('@getAttendancesList', { timeout: 15000 }).then((interception) => {
          expect(interception.response?.statusCode).to.eq(200);

          const body = interception.response && interception.response.body ? interception.response.body : {};
          const items = body.items || (Array.isArray(body) ? body : []);

          expect(items, 'A API real deve retornar uma lista de atendimentos válida').to.be.an('array');
        });

        // Assert 2: Valida que a lista de cards renderizados no DOM está visível e carregada
        AtendimentosPage.elements.cardsAtendimento().should('have.length.gte', 1);

        // Assert 3: Valida a 1ª Regra de Prioridade diretamente nos cards renderizados no DOM
        // Nenhum card lido pode aparecer acima de um card com badge de mensagem não lida
        AtendimentosPage.validarHierarquiaOrdenacaoCardsRenderizados();
      }
    });

  });

  // -------------------------------------------------------------
  // 9. ACESSIBILIDADE DA BUSCA COM A FILA RECOLHIDA (PR #326 / PR #328)
  // -------------------------------------------------------------

  context('9. Acessibilidade da Busca com a Fila Recolhida (PR #326 / PR #328)', () => {

    it('9.1 deve expandir o campo de busca com foco ao clicar na lupa após recolher a fila pelo botão do header (PR #326)', () => {
      // 1. Arrange: Abre o primeiro atendimento da fila (o botão de recolher fila fica no cabeçalho do chat)
      AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').click();
      cy.wait('@getAttendanceMessages');

      // 2. Act: Recolhe a fila pelo botão do cabeçalho do chat
      AtendimentosPage.elements.btnRecolherFila().should('be.visible').click();

      // Assert 1: A fila está em modo colapsado (cards compactos/avatares)
      AtendimentosPage.elements.cardsAtendimentoCompactos().should('exist');

      // 2. Act: Clica na lupa
      AtendimentosPage.elements.btnExpandirBusca().should('be.visible').click();

      // Assert 2: O campo de busca expande e recebe foco automaticamente
      AtendimentosPage.elements.inputBusca().should('be.visible').and('have.focus');
    });

    it('9.2 deve expandir o campo de busca com foco ao clicar na lupa após abrir uma gaveta lateral que recolhe a fila automaticamente (PR #328)', () => {
      // 1. Arrange: Abre o primeiro atendimento da fila
      AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').click();
      cy.wait('@getAttendanceMessages');

      // 2. Act: Abre a gaveta de Notas Internas (colapsa a fila automaticamente)
      AtendimentosPage.abrirGavetaNotasInternas();

      // Assert 1: A fila foi colapsada automaticamente pela abertura da gaveta
      AtendimentosPage.elements.cardsAtendimentoCompactos().should('exist');

      // 3. Act: Clica na lupa
      AtendimentosPage.elements.btnExpandirBusca().should('be.visible').click();

      // Assert 2: O campo de busca expande e recebe foco automaticamente
      AtendimentosPage.elements.inputBusca().should('be.visible').and('have.focus');
    });

    it('9.3 deve expandir o campo de busca com um único clique na lupa ao recolher pelo botão e depois abrir uma gaveta lateral (PR #326 / PR #328)', () => {
      // 1. Arrange: Abre o primeiro atendimento da fila
      AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').click();
      cy.wait('@getAttendanceMessages');

      // 2. Act 1: Recolhe a fila manualmente pelo botão do cabeçalho do chat
      AtendimentosPage.elements.btnRecolherFila().should('be.visible').click();
      AtendimentosPage.elements.cardsAtendimentoCompactos().should('exist');

      // 3. Act 2: Abre a gaveta de Notas Internas (fila já estava colapsada manualmente, o gatilho automático da PR #328 se soma ao estado manual)
      AtendimentosPage.abrirGavetaNotasInternas();

      // 4. Act 3: Clica na lupa uma única vez (regressão da correção: versão anterior exigia 2 cliques neste caso combinado)
      AtendimentosPage.elements.btnExpandirBusca().should('be.visible').click();

      // Assert: O campo de busca expande e recebe foco já no primeiro clique
      AtendimentosPage.elements.inputBusca().should('be.visible').and('have.focus');
    });

  });

  // -------------------------------------------------------------
  // 10. PRÉVIA DE MÍDIA NO CARD DA FILA POR CONTENT_TYPE
  // -------------------------------------------------------------

  context('10. Prévia de Mídia no Card da Fila por content_type', () => {

    const CARD_ID = 260900004;

    // Blindagem 100% mockada (AGENTS.md §6): o beforeEach global registra ~15 rotas sem
    // customPayload (getUserMe, summary, capabilities, templates...) que ficam reféns do
    // USE_MOCKS de env.json. O customPayload da fila já tem precedência absoluta no BaseMock,
    // mas isso sozinho não blinda o RESTO do contexto — sem isto, rodar com USE_MOCKS: false
    // vira um híbrido (login/capabilities reais + fila sintética), quebrando o determinismo.
    let originalUseMocksState;
    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
      Cypress.env('USE_MOCKS_FORCED_BY_TEST', true);
    });
    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
      Cypress.env('USE_MOCKS_FORCED_BY_TEST', false);
    });

    it('10.1 deve exibir "Áudio" na prévia do card quando o último áudio foi enviado pela farmácia (type=0, body vazio, content_type=audio)', () => {
      // Arrange: atendente enviou áudio por último — webhook não grava marcador para saída, backend projeta content_type (PR #497)
      AtendimentosMocks.interceptQueueWithLastMessagePreview(CARD_ID, { type: 0, body: '', content_type: 'audio' });
      cy.reload();
      cy.wait('@getAttendancesList');

      // Assert: card não fica em branco, exibe o rótulo de mídia
      AtendimentosPage.elements.previewCardPorId(CARD_ID)
        .should('contain.text', 'Áudio')
        .and('not.have.text', '');
    });

    it('10.2 deve exibir "Imagem" na prévia do card quando a última imagem foi enviada pela farmácia (type=0, body vazio, content_type=image)', () => {
      AtendimentosMocks.interceptQueueWithLastMessagePreview(CARD_ID, { type: 0, body: '', content_type: 'image' });
      cy.reload();
      cy.wait('@getAttendancesList');

      AtendimentosPage.elements.previewCardPorId(CARD_ID)
        .should('contain.text', 'Imagem')
        .and('not.have.text', '');
    });

    it('10.3 deve exibir "Vídeo" na prévia do card quando o último vídeo foi enviado pela farmácia (type=0, body vazio, content_type=video)', () => {
      AtendimentosMocks.interceptQueueWithLastMessagePreview(CARD_ID, { type: 0, body: '', content_type: 'video' });
      cy.reload();
      cy.wait('@getAttendancesList');

      AtendimentosPage.elements.previewCardPorId(CARD_ID)
        .should('contain.text', 'Vídeo')
        .and('not.have.text', '');
    });

    it('10.4 deve exibir "Documento" na prévia do card quando o último documento foi enviado pela farmácia (type=0, body vazio, content_type=document)', () => {
      AtendimentosMocks.interceptQueueWithLastMessagePreview(CARD_ID, { type: 0, body: '', content_type: 'document' });
      cy.reload();
      cy.wait('@getAttendancesList');

      AtendimentosPage.elements.previewCardPorId(CARD_ID)
        .should('contain.text', 'Documento')
        .and('not.have.text', '');
    });

    it('10.5 deve rotular como "Áudio" a prévia quando o cliente envia o marcador legado puro [MENSAGEM DE VOZ] (não-regressão PR #386/#387)', () => {
      // Marcador legado gravado pelo webhook para entrada — deve ser traduzido, nunca exibido cru
      AtendimentosMocks.interceptQueueWithLastMessagePreview(CARD_ID, { type: 1, body: '[MENSAGEM DE VOZ]' });
      cy.reload();
      cy.wait('@getAttendancesList');

      AtendimentosPage.elements.previewCardPorId(CARD_ID)
        .should('contain.text', 'Áudio')
        .and('not.contain.text', '[MENSAGEM DE VOZ]');
    });

    it('10.6 deve exibir a legenda real da imagem do cliente em vez do rótulo genérico quando o body não é o marcador puro (não-regressão PR #387)', () => {
      // O marcador só é gravado quando a mídia chega SEM legenda; com legenda, o body é o texto do cliente
      const legendaCliente = 'Segue a receita, pode conferir?';
      AtendimentosMocks.interceptQueueWithLastMessagePreview(CARD_ID, { type: 1, body: legendaCliente, content_type: 'image' });
      cy.reload();
      cy.wait('@getAttendancesList');

      AtendimentosPage.elements.previewCardPorId(CARD_ID)
        .should('contain.text', legendaCliente)
        .and('not.contain.text', 'Imagem');
    });

    it('10.7 deve rotular como "Figurinha" a prévia quando o cliente envia o marcador puro [STICKER] (não-regressão PR #386/#387)', () => {
      AtendimentosMocks.interceptQueueWithLastMessagePreview(CARD_ID, { type: 1, body: '[STICKER]' });
      cy.reload();
      cy.wait('@getAttendancesList');

      AtendimentosPage.elements.previewCardPorId(CARD_ID)
        .should('contain.text', 'Figurinha')
        .and('not.contain.text', '[STICKER]');
    });

    it('10.8 não deve converter em rótulo o marcador [STICKER] embutido em uma frase maior do cliente (não-regressão do comparador de igualdade total)', () => {
      // Comparação deve ser pelo corpo inteiro, não pelo início (bug do code review: "[STICKER] não recebi meu pedido" virava "🏷️ Figurinha")
      const textoComMarcadorEmbutido = '[STICKER] não recebi meu pedido ainda';
      AtendimentosMocks.interceptQueueWithLastMessagePreview(CARD_ID, { type: 1, body: textoComMarcadorEmbutido });
      cy.reload();
      cy.wait('@getAttendancesList');

      AtendimentosPage.elements.previewCardPorId(CARD_ID)
        .should('contain.text', textoComMarcadorEmbutido);
    });

  });

  // -------------------------------------------------------------
  // 11. RESPONSIVIDADE DO CABEÇALHO: FOLGA ENTRE A FAIXA DE ABAS DE STATUS E O SWITCH DO ATENDENTE (PR #417)
  // -------------------------------------------------------------

  context('11. Responsividade do Cabeçalho: Folga entre a Faixa de Abas de Status e o Switch do Atendente (PR #417)', () => {

    it('11.1 deve manter uma folga real entre a última aba de status e o switch do atendente quando a faixa de abas transborda em telas estreitas (PR #417)', () => {
      // 1. Arrange: reduz a viewport para forçar o transbordo da faixa de abas — abaixo de ~1024px
      // o painel de detalhe some e a barra ocupa a largura inteira, o pior caso para reproduzir o bug.
      // 900px: comprovadamente estreito o bastante para o .chipsRow transbordar, mas ainda acima do
      // limiar (~768-900px, não isolado nesta rodada) em que a própria aplicação redireciona
      // /atendimentos -> /dashboard em telas mais estreitas (achado novo, ver AGENTS.md §6).
      cy.viewport(900, 900);
      AtendimentosPage.elements.statusFilterBar().should('be.visible');
      AtendimentosPage.elements.btnStatusAtendente().should('be.visible');

      // 2. Act + Assert: rola a faixa até o fim e valida a folga real até o switch (não deve colapsar
      // para 0px como antes da correção, quando o espaçamento vivia em padding-right dentro da caixa
      // de recorte do overflow)
      AtendimentosPage.validarFolgaEntreAbasEStatusAtendente();
    });

  });

  // -------------------------------------------------------------
  // 12. BADGE DE SUBSTATUS PERSONALIZADO NA FILA E NO CABEÇALHO DO CHAT (BACKEND#499/#501-503, FRONT#396)
  // -------------------------------------------------------------

  context('12. Badge de Substatus Personalizado na Fila e no Cabeçalho do Chat (backend#499/#501-503, front#396)', () => {

    // Resolve a loja real uma única vez para o teste #12.12 (API real, backend#577/#611) —
    // autenticação própria do Service Object, independente da sessão de UI do cy.login() (AGENTS.md
    // padrão já usado em 0-A/0-B/0-C.backend-*.cy.js). Seguro mesmo em modo mock: é um GET isolado, sem efeito
    // sobre os intercepts/asserções dos testes #12.1-#12.11.
    let storeIdReal = 1;
    before(() => {
      api.autenticar().then(() => {
        api.obterUsuarioLogado().then((res) => {
          if (res.body && (res.body.store_code || res.body.store_id)) {
            storeIdReal = res.body.store_code || res.body.store_id;
          }
        });
      });
    });

    it('12.1 deve exibir o nome do grupo (group.name) no card da fila, junto ao atendente', () => {
      AtendimentosMocks.interceptMockSubstatusPersonalizado({ groupName: 'FARMÁCIA CENTRAL' });
      cy.reload();
      cy.wait('@getAttendancesList');

      AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').invoke('text').should('match', /farm[áa]cia central/i);
    });

    it('12.2 deve exibir o telefone do cliente (customer_phone) no card da fila', () => {
      AtendimentosMocks.interceptMockSubstatusPersonalizado({});
      cy.reload();
      cy.wait('@getAttendancesList');

      AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').and('contain.text', '556299887766');
    });

    it('12.3 deve renderizar o card normalmente, sem erro e sem sumir da lista, quando custom_status vier null', () => {
      const { idNum } = AtendimentosMocks.interceptMockSubstatusPersonalizado({ customStatus: null });
      cy.reload();
      cy.wait('@getAttendancesList');

      AtendimentosPage.elements.cardsAtendimento().first().should('be.visible');
      AtendimentosPage.elements.badgeSubstatusCard(idNum).should('not.exist');
    });

    it('12.4 deve exibir a badge de substatus no card da fila e no cabeçalho do chat quando custom_status estiver presente', () => {
      const customStatus = { id: 8, name: 'ORCAMENTO CRIADO', parent_status: 1, text_color: '#FFFFFF', background_color: '#FFFFFF' };
      const { idNum } = AtendimentosMocks.interceptMockSubstatusPersonalizado({ customStatus });
      cy.reload();
      cy.wait('@getAttendancesList');

      AtendimentosPage.elements.badgeSubstatusCard(idNum).should('be.visible').invoke('text').should('match', /orcamento criado/i);

      AtendimentosPage.elements.cardsAtendimento().first().click();
      cy.wait('@getAttendanceMessages');
      AtendimentosPage.elements.badgeSubstatusChat().should('be.visible').invoke('text').should('match', /orcamento criado/i);
    });

    it('12.5 deve ignorar as cores próprias do substatus e herdar sempre a paleta do status pai na badge (decisão da issue #329)', () => {
      // Decisão final do time: 3 das 4 linhas reais do tenant vêm branco-sobre-branco com as cores
      // PRÓPRIAS do substatus — respeitá-las deixaria a badge ilegível. A badge por isso ignora
      // text_color/background_color do substatus SEMPRE, herdando o par inteiro do status pai.
      // Prova por comparação: dois substatus com cores PRÓPRIAS diferentes sob o MESMO pai devem
      // renderizar com a MESMA aparência (a do pai), nunca com as cores individuais que trouxeram.
      const substatusBranco = { id: 8, name: 'ORCAMENTO CRIADO', parent_status: 1, text_color: '#FFFFFF', background_color: '#FFFFFF' };
      const { idNum: id1 } = AtendimentosMocks.interceptMockSubstatusPersonalizado({ customStatus: substatusBranco, attendanceId: 260800201 });
      cy.reload();
      cy.wait('@getAttendancesList');
      AtendimentosPage.elements.badgeSubstatusCard(id1).should('be.visible').then(($badgeBranco) => {
        const estiloBranco = window.getComputedStyle($badgeBranco[0]);
        const corFundoBranco = estiloBranco.backgroundColor;
        const corTextoBranco = estiloBranco.color;

        const substatusSistema = { id: 2, name: 'BANIDO', parent_status: 1, text_color: '#A6CAF0', background_color: null };
        AtendimentosMocks.interceptMockSubstatusPersonalizado({ customStatus: substatusSistema, attendanceId: 260800202 });
        cy.reload();
        cy.wait('@getAttendancesList');
        AtendimentosPage.elements.badgeSubstatusCard(260800202).should('be.visible').then(($badgeSistema) => {
          const estiloSistema = window.getComputedStyle($badgeSistema[0]);

          expect(estiloSistema.backgroundColor, 'a badge deve herdar o MESMO fundo do status pai, ignorando o background_color próprio do substatus (branco no 1º cenário, null no 2º)').to.eq(corFundoBranco);
          expect(estiloSistema.color, 'a badge deve herdar a MESMA cor de texto do status pai, ignorando o text_color próprio do substatus').to.eq(corTextoBranco);
        });
      });
    });

    it('12.6 deve vincular um substatus pelo menu de status, gravando custom_status_id via PATCH e atualizando a badge mesmo quando a resposta vier sem o campo status', () => {
      const { idNum } = AtendimentosMocks.interceptMockSubstatusPersonalizado({ customStatus: null });
      AtendimentosMocks.interceptAttendanceCustomStatusesApi();
      // incluirStatusNaResposta: false — reproduz o contrato real: vincular responde só o que o
      // pedido tocou, sem falar de status (achado do dev, 25/09/2026). A tela não pode exigir esse campo.
      AtendimentosMocks.interceptVincularSubstatusApi(idNum, { id: 8, name: 'ORCAMENTO CRIADO', parent_status: 1, text_color: '#FFFFFF', background_color: '#FFFFFF' }, { incluirStatusNaResposta: false });

      cy.reload();
      AtendimentosPage.elements.cardsAtendimento().first().click();
      cy.wait('@getAttendanceMessages');

      AtendimentosPage.vincularSubstatus(8, 1);
      cy.wait('@vincularSubstatusPatch').its('request.body').should('deep.equal', { custom_status_id: 8 });

      // Espera o refetch do detalhe pós-PATCH (o mock mantém estado vivo e devolve o substatus
      // vinculado) antes de assertar a badge. Lê a ÚLTIMA chamada capturada, não "a próxima da
      // fila": o GET do clique inicial ainda não foi consumido por cy.wait (mesmo motivo de
      // 1.permissoes.cy.js #1.19).
      cy.get('@getAttendanceDetail.all', { timeout: 20000 }).should((calls) => {
        const ultima = calls[calls.length - 1];
        expect(ultima.response.body.attendance.custom_status?.id, 'refetch do detalhe pós-PATCH deve devolver o substatus vinculado').to.eq(8);
      });

      AtendimentosPage.elements.badgeSubstatusChat().should('be.visible').invoke('text').should('match', /orcamento criado/i);
    });

    it('12.7 deve desvincular o substatus pelo "x" da badge, enviando custom_status_id: null e preservando o status pai', () => {
      const customStatus = { id: 8, name: 'ORCAMENTO CRIADO', parent_status: 1, text_color: '#FFFFFF', background_color: '#FFFFFF' };
      const { idNum } = AtendimentosMocks.interceptMockSubstatusPersonalizado({ customStatus });
      AtendimentosMocks.interceptVincularSubstatusApi(idNum, null, { incluirStatusNaResposta: false });

      cy.reload();
      AtendimentosPage.elements.cardsAtendimento().first().click();
      cy.wait('@getAttendanceMessages');

      AtendimentosPage.elements.badgeSubstatusChat().should('be.visible');
      AtendimentosPage.desvincularSubstatus();
      cy.wait('@vincularSubstatusPatch').its('request.body').should('deep.equal', { custom_status_id: null });

      // Refetch pós-PATCH com estado vivo (ver #12.6): o detalhe recarregado já vem sem substatus.
      cy.get('@getAttendanceDetail.all', { timeout: 20000 }).should((calls) => {
        const ultima = calls[calls.length - 1];
        expect(ultima.response.body.attendance.custom_status, 'refetch do detalhe pós-PATCH deve devolver custom_status null').to.be.null;
      });

      AtendimentosPage.elements.badgeSubstatusChat().should('not.exist');
      // Status pai preservado: o menu de status continua acessível e a tela não navega para fora
      AtendimentosPage.elements.btnClienteStatus().should('be.visible');
    });

    it('12.8 deve limpar a badge de substatus ao mudar o status do atendimento, mesmo sem o payload da mudança mencionar custom_status', () => {
      // Blindagem 100% mockada (AGENTS.md §1/§2): ao contrário de interceptRoute, o
      // interceptUpdateAttendanceStatusApi só honra customPayload quando USE_MOCKS já está true —
      // com USE_MOCKS: false em env.json (padrão do operador fora de --env), ele cai direto em
      // req.continue() e ignora o payload sintético, vazando para a API real. Força e restaura.
      const originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);

      const customStatus = { id: 8, name: 'ORCAMENTO CRIADO', parent_status: 1, text_color: '#FFFFFF', background_color: '#FFFFFF' };
      const { idNum } = AtendimentosMocks.interceptMockSubstatusPersonalizado({ customStatus });
      // PATCH de mudança de status responde SEM o pedido mencionar custom_status, mas o backend
      // limpa o vínculo por paridade com o legado — a resposta reflete a badge caída.
      AtendimentosMocks.interceptUpdateAttendanceStatusApi(idNum, {
        status: 2,
        custom_status: null,
        attendance: { id: idNum, status: 2, custom_status: null }
      });

      cy.reload();
      AtendimentosPage.elements.cardsAtendimento().first().click();
      cy.wait('@getAttendanceMessages');
      AtendimentosPage.elements.badgeSubstatusChat().should('be.visible');

      AtendimentosPage.abrirMenuStatusCliente();
      // Usa o testid concreto do item do popover (chat-header-menu-status-completed) em vez do
      // helper itemMenuStatusCompleted() baseado em cy.contains(/conclu/i): esse texto também
      // aparece na aba de filtro "Concluído" da fila, e cy.contains casa com a 1ª ocorrência do
      // DOM — que pode ser a aba, não o item do popover, deixando o clique sem efeito no atendimento.
      cy.get('[data-testid="chat-header-menu-status-completed"]').click();
      cy.wait('@updateAttendanceStatusPatch');

      // Refetch pós-PATCH com estado vivo (ver #12.6): o detalhe recarregado já vem com o novo
      // status e sem substatus — antes o GET estático devolvia o estado anterior e ressuscitava a badge.
      cy.get('@getAttendanceDetail.all', { timeout: 20000 }).should((calls) => {
        const ultima = calls[calls.length - 1];
        expect(ultima.response.body.attendance.status, 'refetch do detalhe pós-PATCH deve devolver o novo status').to.eq(2);
        expect(ultima.response.body.attendance.custom_status, 'refetch do detalhe pós-PATCH deve devolver custom_status null').to.be.null;
      });

      AtendimentosPage.elements.badgeSubstatusChat().should('not.exist');
      cy.then(() => Cypress.env('USE_MOCKS', originalUseMocksState));
    });

    it('12.9 deve montar o menu de substatus agrupado por pai a partir do catálogo, ignorando item com parent_status: null', () => {
      const catalogo = [
        { id: 7, name: 'AGUARDANDO RESPOSTA', parent_status: 0, order: 1, text_color: '#FFFFFF', background_color: '#FFFFFF' },
        { id: 8, name: 'ORCAMENTO CRIADO', parent_status: 1, order: 1, text_color: '#FFFFFF', background_color: '#FFFFFF' },
        { id: 99, name: 'ORFAO SEM PAI', parent_status: null, order: 1, text_color: null, background_color: null }
      ];
      AtendimentosMocks.interceptMockSubstatusPersonalizado({ customStatus: null });
      AtendimentosMocks.interceptAttendanceCustomStatusesApi(catalogo);

      cy.reload();
      AtendimentosPage.elements.cardsAtendimento().first().click();
      cy.wait('@getAttendanceMessages');

      AtendimentosPage.abrirMenuStatusCliente();
      cy.wait('@getAttendanceCustomStatuses');
      AtendimentosPage.elements.toggleSubstatusPorPai('pending').click();
      AtendimentosPage.elements.itemMenuSubstatus(7).should('be.visible');
      AtendimentosPage.elements.toggleSubstatusPorPai('in_progress').click();
      AtendimentosPage.elements.itemMenuSubstatus(8).should('be.visible');
      AtendimentosPage.elements.itemMenuSubstatus(99).should('not.exist');
    });

    // Causa raiz resolvida em 25/09/2026 (apontada pelo operador, validada em 1.permissoes.cy.js
    // "[Permissão 577]"): can_create_attendance_custom_status é capability de LOJA (GET
    // /attendance-capabilities, junto de can_change_attendant_status), não de item — por isso o
    // botão "+ Adicionar personalizado" nunca aparecia no diagnóstico anterior. O botão
    // (`chat-header-menu-custom-add-{key}`) vive DENTRO da sublista expandida do status pai, atrás
    // do toggle `chat-header-menu-custom-toggle-{key}` (já tratado em criarSubstatusPersonalizado()).
    const capabilitiesLojaComCriarSubstatus = {
      can_access_attendance_module: true,
      can_create_attendance: true,
      can_view_pending_attendance: true,
      can_view_occupied_attendance: true,
      can_create_customer_without_gender: false,
      can_list_group_agents: true,
      can_change_attendant_status: true,
      can_transfer_attendance: true,
      can_change_status: true,
      can_create_attendance_custom_status: true,
      can_update_attendance_custom_status: true
    };

    it('12.10 deve criar um novo substatus personalizado com sucesso e refletir o novo item no menu', () => {
      const { idNum } = AtendimentosMocks.interceptMockSubstatusPersonalizado({ customStatus: null });
      AtendimentosMocks.interceptAttendanceCustomStatusesApi();
      AtendimentosMocks.interceptAttendanceCapabilitiesApi({ capabilities: capabilitiesLojaComCriarSubstatus });
      AtendimentosMocks.interceptCriarSubstatusApi('sucesso', { id: 99, name: 'FIDELIZACAO', parent_status: 2, order: 2, text_color: null, background_color: null });

      cy.reload();
      AtendimentosPage.elements.cardsAtendimento().first().click();
      cy.wait('@getAttendanceMessages');

      AtendimentosPage.criarSubstatusPersonalizado(2, 'FIDELIZACAO');
      cy.wait('@criarSubstatusPost').then((interception) => {
        expect(interception.request.body).to.deep.equal({ parent_status: 2, name: 'FIDELIZACAO' });
        expect(interception.response.statusCode).to.eq(201);
      });
    });

    it('12.11 deve tratar o erro 500 ao tentar criar um substatus personalizado, sem afirmar sucesso indevido (bug real backend#509)', () => {
      // Histórico (backend#509, 25/09/2026): o POST de criação respondia 500 genérico porque o INSERT em
      // OC_STATUS_PERSONALIZADO não escrevia ALTERACAO_CF (NOT NULL) e não havia handler de DataAccessException.
      // O backend foi corrigido (PR #526). Este teste simula o 500 via mock e valida que o front não afirma
      // sucesso indevido — passa (confirmado pelo operador em 25/09/2026).
      const { idNum } = AtendimentosMocks.interceptMockSubstatusPersonalizado({ customStatus: null });
      AtendimentosMocks.interceptAttendanceCustomStatusesApi();
      AtendimentosMocks.interceptAttendanceCapabilitiesApi({ capabilities: capabilitiesLojaComCriarSubstatus });
      AtendimentosMocks.interceptCriarSubstatusApi('erro500');

      cy.reload();
      AtendimentosPage.elements.cardsAtendimento().first().click();
      cy.wait('@getAttendanceMessages');

      AtendimentosPage.criarSubstatusPersonalizado(2, 'NOVO SUBSTATUS');
      cy.wait('@criarSubstatusPost').its('response.statusCode').should('eq', 500);

      // O form não deve se fechar/confirmar sucesso indevido com o servidor tendo recusado o pedido
      AtendimentosPage.elements.inputNomeSubstatus().should('be.visible');
    });

    it('12.12 deve preservar a badge de substatus ao enviar mensagem num atendimento que já estava Em andamento (regressão backend#577/#611)', function () {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';
      if (isMock) {
        this.skip();
        return;
      }

      // Arrange: reaproveita o atendimento de teste já Em andamento (canal oficial, janela ativa) —
      // a correção só atua sob WHERE STATUS=0; enviar mensagem aqui não deve mexer no substatus.
      cy.intercept('GET', new RegExp(regexApi('attendances/\\d+([?#].*)?$')), (req) => req.continue()).as('getAttendanceDetailReal');
      AtendimentosPage.garantirAtendimentoComJanelaAtiva(CELULAR_PADRAO, 'oficial', 90000);

      cy.wait('@getAttendanceDetailReal', { timeout: 20000 }).then((interception) => {
        const attendanceId = interception.response.body.attendance.id;
        const statusAtual = interception.response.body.attendance.status;
        AtendimentosMocks.interceptSendMessageApi('*');

        // Bootstrap condicional (achado real desta sessão, 2026-10-06): `garantirAtendimentoComJanelaAtiva`
        // garante só "janela 24h ativa", não "status Em andamento" — são conceitos distintos. Se a
        // conversa reaproveitada ainda não recebeu nenhuma mensagem nossa (ex.: foi recriada do zero
        // porque a anterior foi finalizada), ela segue Pendente (status 0) até a 1ª mensagem. Envia
        // uma mensagem de bootstrap, fora do escopo da asserção, só para alcançar a pré-condição real
        // do cenário (Em andamento) antes do teste em si.
        if (statusAtual === 0) {
          cy.log('⚠️ [Bootstrap]: atendimento reaproveitado ainda Pendente — enviando 1ª mensagem para promover a Em andamento');
          AtendimentosPage.enviarMensagemNoChat('Mensagem automática do Cypress - bootstrap de pré-condição');
          cy.wait('@sendChatMessage').its('response.statusCode').should('be.oneOf', [200, 201]);
        }

        // Vincula o substatus real de pai Em andamento "ORCAMENTO CRIADO" (id 8, parent_status 1,
        // mesmo item já usado pelos cenários mockados #12.4-#12.8 deste contexto)
        AtendimentosPage.vincularSubstatus(8, 1);
        cy.wait('@updateAttendanceStatusPatch').its('response.body.custom_status.id').should('eq', 8);
        AtendimentosPage.elements.badgeSubstatusChat().should('be.visible');

        // Act: envia uma mensagem de texto no atendimento já Em andamento
        AtendimentosPage.enviarMensagemNoChat('Mensagem automática do Cypress - contraprova backend#577/#611');
        cy.wait('@sendChatMessage').its('response.statusCode').should('be.oneOf', [200, 201]);

        // Assert: a badge NÃO deve sumir — regra de precedência preservada (guarda WHERE STATUS=0)
        AtendimentosPage.elements.badgeSubstatusChat().should('be.visible');

        api.obterDetalheAtendimento(storeIdReal, attendanceId).then((res) => {
          expect(res.body.attendance.status, 'status deve permanecer Em andamento (1)').to.eq(1);
          expect(res.body.attendance.custom_status && res.body.attendance.custom_status.id, 'custom_status deve permanecer vinculado (sem regressão)').to.eq(8);
        });

        // Limpeza: desvincula o substatus de teste para não deixar resíduo na conversa real
        // compartilhada por dezenas de outros testes deste repositório (AGENTS.md R-MULTI/R-POM).
        AtendimentosPage.desvincularSubstatus();
        cy.wait('@updateAttendanceStatusPatch');
      });
    });

  });

  // -------------------------------------------------------------
  // 13. TEMPO RELATIVO DESDE A ÚLTIMA MENSAGEM NO CARD DA FILA (ISSUE FRONT#526/BACKEND#612, PR #528/#529)
  // -------------------------------------------------------------

  context('13. Tempo Relativo desde a Última Mensagem no Card da Fila (Issue front#526, PR #528/#529)', () => {

    // Contrato real já confirmado antes de escrever (AGENTS.md [R-EVID]): a listagem já devolve
    // `messages.last_message.occurred_at` em ISO 8601 UTC (medido contra api.omnicare.dev.local,
    // 06/10/2026) — o front só precisa formatar. `reference_at` é a data do próprio atendimento,
    // usada quando não há `last_message`. Rótulo real capturado em snapshot de app.omnicare.dev.local:
    // "há N hora(s)" até 24h, depois "dd/MM/yy" — "agora"/"há N minuto(s)" seguem o mesmo padrão,
    // confirmados rodando os testes abaixo contra o front real (nunca chutados).
    const CARD_ID = 260900004;
    const CARD_SEM_MENSAGEM_ID = 260900003;

    // Blindagem 100% mockada (AGENTS.md §6, mesmo padrão do ctx 10): sem isto, o resto do
    // `beforeEach` fica refém do `USE_MOCKS` de `env.json`.
    let originalUseMocksState;
    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
      Cypress.env('USE_MOCKS_FORCED_BY_TEST', true);
    });
    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
      Cypress.env('USE_MOCKS_FORCED_BY_TEST', false);
    });

    /**
     * Mocka a listagem com a mensagem alvo `deltaMs` atrás de agora e recarrega — sempre com
     * timers REAIS. `cy.clock()`/`cy.tick()` foram descartados pra este contexto (achados reais,
     * 2026-10-06): (1) congelar o relógio antes do boot da SPA trava a tela em "Carregando
     * recursos…" pra sempre; (2) mesmo engatado só depois do boot, o poll de 60s de fallback
     * (ver #13.1/#13.5) já tinha um `setTimeout` real agendado ANTES do `cy.clock()` entrar em
     * cena — timers criados antes da instalação do fake clock não são "adotados" por ele, então
     * o poll real seguiu correndo em paralelo por conta própria, numa corrida com o `cy.tick()` e
     * poluindo a fila de `cy.wait('@getAttendancesList')` com respostas antigas. Pra evoluir o
     * rótulo por mais de alguns minutos (ex.: faixa de horas), basta recarregar com um
     * `occurred_at` diferente — mais simples e sem esse conflito.
     */
    function abrirFilaComUltimaMensagemHa(deltaMs) {
      const agora = Date.now();
      AtendimentosMocks.interceptQueueWithLastMessagePreview(CARD_ID, {
        occurred_at: new Date(agora - deltaMs).toISOString()
      });
      cy.reload();
      cy.wait('@getAttendancesList');
      return agora;
    }

    it('13.1 deve exibir "agora" para a mensagem mais recente e avançar para "há 1 minuto"/"há 2 minutos" pelo poll de 60s, sem recarregar a tela', () => {
      // Espera de parede real (como o próprio roteiro de QA da issue pede ao operador: "deixe a
      // tela parada por 1 ou 2 minutos") — evita o conflito de timers reais×fake documentado acima.
      abrirFilaComUltimaMensagemHa(0);
      AtendimentosPage.elements.dataCardPorId(CARD_ID).should('be.visible').and('contain.text', 'agora');

      cy.wait(62000);
      AtendimentosPage.elements.dataCardPorId(CARD_ID).should('contain.text', 'há 1 minuto');

      cy.wait(61000);
      AtendimentosPage.elements.dataCardPorId(CARD_ID).should('contain.text', 'há 2 minutos');
    });

    it('13.2 deve exibir "há 1 hora" (singular) e "há N horas" (plural)', () => {
      abrirFilaComUltimaMensagemHa(61 * 60 * 1000); // 61 min atrás — cruzou o limiar de 1h
      AtendimentosPage.elements.dataCardPorId(CARD_ID).should('be.visible').and('contain.text', 'há 1 hora');

      abrirFilaComUltimaMensagemHa(5 * 60 * 60 * 1000); // 5h atrás — plural
      AtendimentosPage.elements.dataCardPorId(CARD_ID).should('contain.text', 'há 5 horas');
    });

    it('13.3 deve reverter para a data dd/MM/yy quando a última mensagem passa de 24 horas', () => {
      abrirFilaComUltimaMensagemHa(25 * 60 * 60 * 1000); // 25h atrás — já passou do limiar de 24h
      AtendimentosPage.elements.dataCardPorId(CARD_ID)
        .should('be.visible')
        .invoke('text')
        .should('match', /^\d{2}\/\d{2}\/\d{2}$/)
        .and('not.match', /há|agora/);
    });

    it('13.4 deve usar a data do próprio atendimento (reference_at) quando não há nenhuma mensagem ainda', () => {
      const agora = Date.now();
      const payload = JSON.parse(JSON.stringify(AtendimentosMocks.mockAttendancesListData));
      const item = payload.items.find((i) => i.id === CARD_SEM_MENSAGEM_ID);
      delete item.messages.last_message;
      item.reference_at = new Date(agora - 25 * 60 * 60 * 1000).toISOString(); // 25h atrás, fora da faixa "há Xh"
      AtendimentosMocks.interceptAttendancesListApi(payload);
      cy.reload();
      cy.wait('@getAttendancesList');

      AtendimentosPage.elements.dataCardPorId(CARD_SEM_MENSAGEM_ID)
        .should('be.visible')
        .invoke('text')
        .should('match', /^\d{2}\/\d{2}\/\d{2}$/);
    });

    // Gap aceito (passo 3 do roteiro de QA da issue — "receba uma mensagem num atendimento que
    // não está aberto; o card volta pra 'agora'"): não criamos um teste automatizado determinístico
    // pra isso. Circuit breaker [R-DIAG] acionado após repetidas tentativas na mesma rodada
    // (2026-10-06): a listagem recebe chamadas de rede extras e não-determinísticas mesmo 100%
    // mockada (confirmado via diagnóstico: 5+ chamadas num intervalo de segundos, bem mais
    // frequente que o poll de 60s esperado) — reintercepar a rota com dado novo não fez o card
    // refletir a mudança dentro de 75s de espera real, sugerindo que o disparo observado não é o
    // poll de fallback que a engenharia reversa encontrou (`pf(e){return e!=='live'&&df}`,
    // `df=6e4`=60000ms), e sim algo mais (refetch por foco de janela do React Query, ou um canal
    // de tempo real que `cy.intercept` não enxerga, ex. WebSocket). O mecanismo "sem reload"
    // propriamente dito já está coberto por #13.1 (evolução do rótulo ao longo do tempo, mesmo
    // atendimento aberto) — falta só a variante "conversa fechada". Precisa de instrumentação de
    // rede mais profunda (DevTools Protocol/HAR) ou confirmação do dev sobre o mecanismo exato.
  });

  // -------------------------------------------------------------
  // 14. BUSCA NA FILA SEM DISTINÇÃO DE ACENTO E CAIXA (API REAL)
  // -------------------------------------------------------------
  context('14. Busca na Fila sem Distinção de Acento e Caixa (Issue backend#628/PR #629)', () => {

    // Contra o backend real: o filtro `search` é do servidor (COLLATE WIN_PTBR) e o `beforeEach` global
    // passa a deixar as rotas seguirem para a API. Massa dinâmica: um atendimento Aguardando (aba padrão
    // da fila) cujo cliente tenha acento no nome; achado em 2026-10-13: "ÍTALO PATRICK SOUZA SILVA".
    let originalUseMocksState;
    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', false);
    });
    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

    // [SKIP] 2026-10-15 (aba-c, decisão do operador): depende de um atendimento Aguardando cujo cliente tenha acento no nome (API real), massa que o CI não tem.
    // Falhou no CI do GitHub Actions por falta dessa massa; reativar quando o backend entregar as rotas de massa de teste.
    it.skip('14.1 deve achar o card do cliente gravado com acento digitando o nome sem acento, com acento ou em maiúsculas na barra de busca da fila', () => {
      api.autenticar().then(() => api.obterUsuarioLogado()).then((resUser) => {
        const storeId = resUser.body.store_code || resUser.body.store_id || 1;
        return api.listarAtendimentos(storeId, { status: 'waiting', page: 1, per_page: 100 });
      }).then((res) => {
        const itens = res.body.items || res.body.data || [];
        const alvo = itens.find((a) => /[À-ÿ]/.test(a.customer_name || '') && semAcento(a.customer_name.split(' ')[0]).length >= 3);
        expect(alvo, '🔒 Nenhum atendimento Aguardando com acento no nome do cliente (massa)').to.exist;

        const primeiro = alvo.customer_name.split(' ')[0];
        [semAcento(primeiro).toLowerCase(), primeiro.toLowerCase(), primeiro.toUpperCase()].forEach((termo) => {
          AtendimentosPage.buscarAtendimento(termo);
          cy.wait('@searchAttendancesApi', { timeout: 15000 }).its('request.url').should('include', 'search=');
          cy.get(`[data-testid="attendance-queue-item-${alvo.id}"]`, { timeout: 10000 })
            .should('be.visible')
            .and('contain.text', String(alvo.id)); // a UI exibe o nome em caixa de título, então o card é conferido pelo código
          AtendimentosPage.limparBusca();
        });
      });
    });

  });

  // -------------------------------------------------------------
  // 15. SELETOR CANAL DO FILTRO DA FILA USA A LISTA COMPLETA DE GET /attendances/channels (ISSUE FRONT#582/PR #590, BACKEND#685/#687)
  // -------------------------------------------------------------
  context('15. Seletor Canal do Filtro da Fila Lista Todos os Canais pela Rota GET /attendances/channels (Issue front#582/PR #590, backend#685/#687)', () => {
    const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';

    it('15.1 deve abrir o filtro chamando GET /attendances/channels, sem a loja no caminho, e listar Todos os canais mais um item por canal devolvido, na ordem da API, sem chamar /channels', () => {
      // Act: Abre o modal de filtros
      AtendimentosPage.abrirModalFiltros();

      // Assert: a rota nova responde 200 e o seletor Canal espelha a resposta (value = id, texto = nome)
      cy.wait('@getCanaisFiltroFila').then(({ request, response }) => {
        expect(request.url, 'rota do seletor Canal, sem a loja no caminho').to.match(new RegExp(regexApi('attendances/channels(\\?.*)?$')));
        expect(response.statusCode).to.eq(200);
        expect(response.body.items, 'canais devolvidos').to.not.be.empty;
        AtendimentosPage.validarOpcoesCanalFiltro(response.body.items);
      });

      // Assert: a rota do "Iniciar atendimento" não é usada pelo filtro
      cy.get('@getChannels.all').should('have.length', 0);

      // Teardown: Fecha o modal de filtros
      AtendimentosPage.fecharModalFiltros();
    });

    it('15.2 deve listar no seletor Canal os canais de Pedido Pago (channel_subtype 2), que antes ficavam fora', () => {
      // Act: Abre o modal de filtros
      AtendimentosPage.abrirModalFiltros();

      cy.wait('@getCanaisFiltroFila').its('response.body.items').then((canais) => {
        // Assert 1: os canais de Pedido Pago, que /channels omite, aparecem no seletor
        const pedidoPago = canais.filter((canal) => canal.channel_subtype === 2);
        expect(pedidoPago, '🔒 A loja não tem canal de Pedido Pago (massa)').to.not.be.empty;
        pedidoPago.forEach((canal) => {
          AtendimentosPage.elements.selectCanalFiltro().find(`option[value="${canal.id}"]`).should('exist').and('contain.text', canal.name);
        });

        // Assert 2: o texto de cada opção é só o nome do canal
        AtendimentosPage.validarOpcoesCanalFiltro(canais);
      });

      // Teardown: Fecha o modal de filtros
      AtendimentosPage.fecharModalFiltros();
    });

    it('15.3 deve exibir "Sem nome #id" no seletor Canal quando o canal chega com o nome vazio (canal sem NOME no banco)', () => {
      // Arrange: 100% mockado ([R-BLIND]); a massa real não tem canal sem nome. O front aceita `name: ''` (vira "Sem nome #id"); `name: null` ou ausente faz o front recusar a lista ("Erro ao carregar as opções", medido em mock, P2-20). Recarrega a tela para o front pedir a lista já com o mock
      const canais = [
        { id: 3, name: 'WHATSAPP NAO OFICIAL - 4001', channel_type: 1, channel_subtype: 0, port: '51019910', whatsapp_number: '556227654001', default_channel_group_id: 1 },
        { id: 9, name: '', channel_type: 1, channel_subtype: 2, port: '51019999', whatsapp_number: '', default_channel_group_id: 6 }
      ];
      AtendimentosMocks.interceptAttendanceChannelsApi({ items: canais });
      AtendimentosPage.visitar();
      AtendimentosPage.elements.tituloAtendimentos().should('be.visible');

      // Act: Abre o modal de filtros
      AtendimentosPage.abrirModalFiltros();

      // Assert: o canal sem nome aparece como "Sem nome #9" e o nomeado segue com o próprio nome
      cy.wait('@getCanaisFiltroFila');
      AtendimentosPage.validarOpcoesCanalFiltro(canais);
      AtendimentosPage.elements.selectCanalFiltro().find('option[value="9"]').should('have.text', 'Sem nome #9');

      // Teardown: Fecha o modal de filtros
      AtendimentosPage.fecharModalFiltros();
    });

    it('15.4 deve filtrar a fila por um canal de Pedido Pago enviando channel_id na listagem e trazendo só atendimentos desse canal', () => {
      // Arrange: Abre o modal de filtros e pega um canal de Pedido Pago da lista devolvida
      AtendimentosPage.abrirModalFiltros();
      cy.wait('@getCanaisFiltroFila').its('response.body.items').then((canais) => {
        const canal = canais.find((c) => c.channel_subtype === 2);
        expect(canal, '🔒 A loja não tem canal de Pedido Pago (massa)').to.exist;

        // Act: Seleciona o canal, abre todos os status e aplica
        AtendimentosPage.selecionarCanalFiltro(String(canal.id));
        AtendimentosPage.selecionarStatusFiltro('all');
        AtendimentosPage.aplicarFiltros();

        // Assert: a listagem sai com channel_id do canal escolhido e, na API real, só traz atendimentos dele
        AtendimentosPage.aguardarListagemFiltradaPorCanal(canal.id).then((chamada) => {
          expect(chamada.response.statusCode).to.eq(200);
          if (!isMock) {
            expect(chamada.response.body.items, `🔒 O canal ${canal.id} não tem atendimento nos últimos 30 dias (massa)`).to.not.be.empty;
            chamada.response.body.items.forEach((item) => {
              expect(item.channel.id, `canal do atendimento ${item.id}`).to.eq(canal.id);
            });
          }
        });
      });
    });

    it('15.5 deve manter o "Iniciar atendimento" em GET /channels, só com canais ativos fora de Pedido Pago, sem contaminar a lista do filtro (query key própria)', () => {
      // Arrange: Abre o filtro, guarda a lista da rota nova e fecha
      AtendimentosPage.abrirModalFiltros();
      cy.wait('@getCanaisFiltroFila').its('response.body.items').then((canaisFiltro) => {
        AtendimentosPage.fecharModalFiltros();

        // Act 1: Abre o "Iniciar atendimento" na mesma tela
        AtendimentosPage.listarCanaisDoIniciarAtendimento().then((idsIniciar) => {
          // Assert 1: o seletor do Iniciar atendimento espelha GET /channels, sem Pedido Pago, e é menor que a lista do filtro
          cy.wait('@getChannels').its('response.body.items').then((canaisIniciar) => {
            expect(idsIniciar, 'canais do Iniciar atendimento').to.deep.eq(canaisIniciar.map((c) => String(c.id)));
            expect(canaisIniciar.some((c) => c.channel_subtype === 2), 'Pedido Pago em /channels').to.be.false;
            expect(canaisIniciar.length, '🔒 A lista do filtro não é maior que a do Iniciar atendimento (massa)').to.be.lessThan(canaisFiltro.length);
          });
        });

        // Act 2 / Assert 2: ao reabrir o filtro, a lista continua sendo a da rota nova (a do Iniciar atendimento não a sobrescreveu)
        AtendimentosPage.abrirModalFiltros();
        AtendimentosPage.validarOpcoesCanalFiltro(canaisFiltro);

        // Teardown: Fecha o modal de filtros
        AtendimentosPage.fecharModalFiltros();
      });
    });

    // Issue backend#721/PR #733 (front#398): `GET /attendances/channels` passou a devolver só canais ativos (`ATIVO = -1`), como no legado; o front não muda.
    // A API não manda flag de ativo: o inativo é o canal do filtro que não é de Pedido Pago e não está em `/channels` (o Iniciar atendimento só lista ativos) — agora esse conjunto é vazio.
    it('15.6 não deve listar no seletor Canal nenhum canal inativo: todo canal do filtro que não é de Pedido Pago está em GET /channels, e o seletor espelha a lista (Issue backend#721/PR #733)', () => {
      // Arrange: Abre o filtro, guarda a lista da rota nova e fecha
      AtendimentosPage.abrirModalFiltros();
      cy.wait('@getCanaisFiltroFila').its('response.body.items').then((canaisFiltro) => {
        AtendimentosPage.fecharModalFiltros();
        expect(canaisFiltro, '🔒 A rota do filtro não devolveu canal (massa)').to.not.be.empty;

        // Act 1: a lista do Iniciar atendimento (só ativos, sem Pedido Pago)
        AtendimentosPage.listarCanaisDoIniciarAtendimento().then((idsAtivos) => {
          const inativos = canaisFiltro.filter((canal) => canal.channel_subtype !== 2 && !idsAtivos.includes(String(canal.id)));
          expect(inativos.map((c) => `${c.id} ${c.name}`), 'Nenhum canal do filtro fora de /channels que não seja de Pedido Pago (canal inativo saiu da rota)').to.deep.eq([]);

          // Act 2: Reabre o filtro
          AtendimentosPage.abrirModalFiltros();

          // Assert: o seletor Canal lista exatamente os canais da rota (Todos os canais + 1 por canal), nenhum a mais
          AtendimentosPage.elements.selectCanalFiltro().find('option').should('have.length', canaisFiltro.length + 1);
          canaisFiltro.forEach((canal) => {
            AtendimentosPage.elements.selectCanalFiltro().find(`option[value="${canal.id}"]`).should('exist');
          });

          // Teardown: Fecha o modal de filtros
          AtendimentosPage.fecharModalFiltros();
        });
      });
    });

    it('15.7 deve mostrar "Erro ao carregar as opções." com "Tentar novamente" no seletor Canal quando GET /attendances/channels responde 403, sem nenhum canal na lista', () => {
      // Arrange: 403 sem a 418 (a conta de teste tem a 418, então a recusa é mockada; medido em mock em 2026-11-06: 1 chamada, sem repetição automática)
      AtendimentosMocks.interceptAttendanceChannelsApiErro(403);
      AtendimentosPage.visitar();
      AtendimentosPage.elements.tituloAtendimentos().should('be.visible');

      // Act
      AtendimentosPage.abrirModalFiltros();
      cy.wait('@getCanaisFiltroFila').its('response.statusCode').should('eq', 403);

      // Assert: o erro e o botão de tentar de novo aparecem; o seletor fica só com "Todos os canais"
      AtendimentosPage.elements.erroOpcoesFiltro().should('be.visible');
      AtendimentosPage.elements.btnTentarNovamenteOpcoesFiltro().should('be.visible').and('contain.text', 'Tentar novamente');
      cy.get('div[role="dialog"]').contains('label', 'Canal').find('select option').should('have.length', 1).first().should('have.text', 'Todos os canais');

      // Teardown
      AtendimentosPage.fecharModalFiltros();
    });

    it('15.8 deve carregar os canais ao clicar em "Tentar novamente" depois de GET /attendances/channels falhar com 500', () => {
      // Arrange: a lista falha com 500 e depois volta
      const canais = [
        { id: 3, name: 'WHATSAPP NAO OFICIAL - 4001', channel_type: 1, channel_subtype: 0, port: '51019910', whatsapp_number: '556227654001', default_channel_group_id: 1 },
        { id: 6, name: 'WHATSAPP OFICIAL - 62 98222-4382', channel_type: 2, channel_subtype: 1, port: '51019911', whatsapp_number: '5562982224382', default_channel_group_id: 1 }
      ];
      AtendimentosMocks.interceptAttendanceChannelsApiErro(500);
      AtendimentosPage.visitar();
      AtendimentosPage.elements.tituloAtendimentos().should('be.visible');
      AtendimentosPage.abrirModalFiltros();
      AtendimentosPage.elements.erroOpcoesFiltro().should('be.visible');

      // Act: a rota volta e o operador tenta de novo
      AtendimentosMocks.interceptAttendanceChannelsApi({ items: canais });
      AtendimentosPage.elements.btnTentarNovamenteOpcoesFiltro().click();

      // Assert: o erro some e o seletor lista os canais da resposta (sem cy.wait no alias: as chamadas 500 anteriores, inclusive a repetição automática, usam o mesmo alias)
      AtendimentosPage.elements.erroOpcoesFiltro().should('not.exist');
      cy.get('div[role="dialog"]').contains('label', 'Canal').find('select option').should('have.length', canais.length + 1);
      AtendimentosPage.validarOpcoesCanalFiltro(canais);

      // Teardown
      AtendimentosPage.fecharModalFiltros();
    });

  });

  // -------------------------------------------------------------
  // 16. SELETOR GRUPOS DO FILTRO DA FILA LISTA SÓ OS GRUPOS VINCULADOS A CANAL, SEM CASCATA COM O CANAL (ISSUE FRONT#398/PR #581, BACKEND#672)
  // -------------------------------------------------------------
  context('16. Seletor Grupos do Filtro da Fila Lista só os Grupos Vinculados a Canal, sem Cascata com o Canal (Issue front#398/PR #581, backend#672)', () => {

    beforeEach(() => {
      // Arrange: a lista de grupos (mock ou API real) é registrada e a tela recarregada para o front pedi-la já com esse intercept
      AtendimentosMocks.interceptTransferGroupsApi();
      AtendimentosPage.visitar();
      AtendimentosPage.elements.tituloAtendimentos().should('be.visible');
    });

    it('16.1 deve listar no seletor Grupos só os grupos com canal vinculado, na ordem da API, escondendo os que chegam com channels vazio', () => {
      // Act: Abre o modal de filtros
      AtendimentosPage.abrirModalFiltros();

      // Assert: o filtro usa GET /channel-groups sem channel_id e só mostra os grupos com `channels` preenchido
      cy.wait('@getGruposCanal').then(({ request, response }) => {
        expect(new URL(request.url).searchParams.has('channel_id'), 'channel_id na lista do filtro').to.be.false;
        expect(response.statusCode).to.eq(200);
        const todos = response.body.items;
        const vinculados = todos.filter((grupo) => grupo.channels.length > 0);
        const semVinculo = todos.filter((grupo) => grupo.channels.length === 0);
        expect(vinculados, '🔒 A loja não tem grupo vinculado a canal (massa)').to.not.be.empty;
        expect(semVinculo, '🔒 A loja não tem grupo sem vínculo a canal (massa)').to.not.be.empty;
        AtendimentosPage.validarOpcoesGruposFiltro(vinculados);
        semVinculo.forEach((grupo) => {
          AtendimentosPage.elements.selectGruposFiltro().find(`option[value="${grupo.id}"]`).should('not.exist');
        });
      });

      // Teardown: Fecha o modal de filtros
      AtendimentosPage.fecharModalFiltros();
    });

    it('16.2 deve deixar só "Todos os grupos" no seletor, habilitado e sem erro, quando nenhum grupo tem canal vinculado', () => {
      // Arrange: 100% mockado ([R-BLIND]); a massa real tem grupo vinculado. Recarrega a tela para o front pedir a lista já com o mock
      AtendimentosMocks.interceptTransferGroupsApi(true, {
        items: [{ id: 5, name: 'E-COMMERCE', channels: [], agents_total: 1, agents_available: 0 }]
      });
      AtendimentosPage.visitar();
      AtendimentosPage.elements.tituloAtendimentos().should('be.visible');

      // Act: Abre o modal de filtros
      AtendimentosPage.abrirModalFiltros();

      // Assert: nenhum grupo listado, o seletor continua habilitado e a modal não mostra erro de carga
      cy.wait('@getGruposCanal');
      AtendimentosPage.validarOpcoesGruposFiltro([]);
      AtendimentosPage.elements.selectGruposFiltro().should('not.be.disabled');
      cy.contains(/Erro ao carregar as opções/i).should('not.exist');

      // Teardown: Fecha o modal de filtros
      AtendimentosPage.fecharModalFiltros();
    });

    it('16.3 deve manter a lista de Grupos e o grupo escolhido ao trocar o Canal por um canal que o grupo não tem, enviando os dois na listagem (sem cascata)', () => {
      // Arrange: Abre o modal de filtros e escolhe um grupo vinculado e um canal que não é dele
      AtendimentosPage.abrirModalFiltros();
      cy.wait('@getGruposCanal').its('response.body.items').then((todos) => {
        const vinculados = todos.filter((grupo) => grupo.channels.length > 0);
        cy.wait('@getCanaisFiltroFila').its('response.body.items').then((canais) => {
          const grupo = vinculados[0];
          const canal = canais.find((c) => !grupo.channels.some((vinculo) => vinculo.id === c.id));
          expect(grupo, '🔒 A loja não tem grupo vinculado a canal (massa)').to.exist;
          expect(canal, `🔒 Todo canal da loja está vinculado ao grupo ${grupo && grupo.id} (massa)`).to.exist;

          // Act: Seleciona o grupo e depois o canal sem vínculo com ele
          AtendimentosPage.selecionarGrupoFiltro(String(grupo.id));
          AtendimentosPage.selecionarCanalFiltro(String(canal.id));

          // Assert 1: a lista de Grupos não foi recalculada e o grupo escolhido não foi resetado
          AtendimentosPage.validarOpcoesGruposFiltro(vinculados);
          AtendimentosPage.elements.selectGruposFiltro().should('have.value', String(grupo.id));

          // Act 2 / Assert 2: ao aplicar, a listagem sai com o canal e o grupo juntos (o par sem vínculo continua alcançável)
          AtendimentosPage.aplicarFiltros();
          AtendimentosPage.aguardarListagemComParametros({ channel_id: canal.id, channel_group_id: grupo.id }).then((chamada) => {
            expect(chamada.response.statusCode).to.eq(200);
          });
        });
      });
    });

    it('16.4 deve filtrar a fila por um grupo vinculado a canal enviando channel_group_id na listagem e trazendo só atendimentos desse grupo', () => {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';

      // Arrange: Abre o modal de filtros e pega o primeiro grupo vinculado
      AtendimentosPage.abrirModalFiltros();
      cy.wait('@getGruposCanal').its('response.body.items').then((todos) => {
        const grupo = todos.find((g) => g.channels.length > 0);
        expect(grupo, '🔒 A loja não tem grupo vinculado a canal (massa)').to.exist;

        // Act: Seleciona o grupo, abre todos os status e aplica
        AtendimentosPage.selecionarGrupoFiltro(String(grupo.id));
        AtendimentosPage.selecionarStatusFiltro('all');
        AtendimentosPage.aplicarFiltros();

        // Assert: a listagem sai com channel_group_id do grupo escolhido e, na API real, só traz atendimentos dele
        AtendimentosPage.aguardarListagemComParametros({ channel_group_id: grupo.id }).then((chamada) => {
          expect(chamada.response.statusCode).to.eq(200);
          if (!isMock) {
            expect(chamada.response.body.items, `🔒 O grupo ${grupo.id} não tem atendimento nos últimos 30 dias (massa)`).to.not.be.empty;
            chamada.response.body.items.forEach((item) => {
              expect(item.group.id, `grupo do atendimento ${item.id}`).to.eq(grupo.id);
            });
          }
        });
      });
    });

    it('16.5 deve esconder do seletor Grupos o grupo inativo, que chega sem canal ativo vinculado (channels vazio), e manter os vinculados', () => {
      // Arrange: 100% mockado ([R-BLIND]); a dev não tem grupo inativo nos atendimentos nem rota que o mostre. Regra de produto (backend#672): `channels` só traz
      // canal ativo, então o grupo inativo ou ligado só a canal inativo chega com `channels: []`. O front não tem flag de ativo: a única defesa é esse vazio.
      const grupos = [
        { id: 7, name: 'ATENDIMENTO', channels: [{ id: 6, name: 'WHATSAPP OFICIAL - 62 98222-4382' }], agents_total: 3, agents_available: 1 },
        { id: 1, name: 'BALCAO', channels: [{ id: 3, name: 'WHATSAPP NAO OFICIAL - 4001' }], agents_total: 2, agents_available: 1 },
        { id: 90, name: 'GRUPO INATIVO', channels: [], agents_total: 0, agents_available: 0 }
      ];
      AtendimentosMocks.interceptTransferGroupsApi(true, { items: grupos });
      AtendimentosPage.visitar();
      AtendimentosPage.elements.tituloAtendimentos().should('be.visible');

      // Act: Abre o modal de filtros
      AtendimentosPage.abrirModalFiltros();

      // Assert: só os dois vinculados aparecem; o grupo inativo não está no seletor, nem pelo nome nem pelo id
      cy.wait('@getGruposCanal');
      AtendimentosPage.validarOpcoesGruposFiltro(grupos.slice(0, 2));
      AtendimentosPage.elements.selectGruposFiltro().find('option[value="90"]').should('not.exist');
      AtendimentosPage.elements.selectGruposFiltro().contains('option', 'GRUPO INATIVO').should('not.exist');

      // Teardown: Fecha o modal de filtros
      AtendimentosPage.fecharModalFiltros();
    });

  });

});
