import AtendimentosPage from '../pages/5.atendimentosPage';
import AtendimentosMocks from '../mocks/5.atendimentosMocks';
import IniciarAtendimentoMocks from '../mocks/4.iniciarAtendimentoMocks';
const configEnv = require('../../env.json');
import { regexApi, rotaApi } from '../support/rotaApi';

// Captura os dados configurados em env.json
const CELULAR_PADRAO = Cypress.env('DEFAULT_CELULAR') || Cypress.env('defaultCelular') || configEnv.DEFAULT_CELULAR || '11999998888';


describe('5-B2. Atendimentos - Chat: Janela 24h, Templates, Busca, Legenda e Personalização do Orçamento', () => {


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
  // 4. REGRAS DE JANELA EXPIRADA - ACESSO A GAVETAS DE ORÇAMENTOS E LINKS DE PAGAMENTO (PR #250)
  // -------------------------------------------------------------

  context('4. Regras de Janela Expirada - Acesso a Gavetas de Orçamentos e Links de Pagamento (PR #250)', () => {

    beforeEach(() => {
      // Desativa fast-pass de janela ativa para permitir teste explícito de janela expirada
      Cypress.env('ACTIVE_SERVICE_WINDOW_VERIFIED', false);
    });

    it('4.1 deve manter botões "X orçamentos" e "X links de pagamento" habilitados na Janela Expirada, abrindo as gavetas com ações de criação/envio desabilitadas (Atendimento #26080076)', () => {
      // 1. Arrange: Configuração 100% mockada com todos os contratos locais (PR #250)
      AtendimentosMocks.interceptMockDetalheJanelaExpirada(26080076);

      // 2. Act: Força recarregamento da fila com o card mockado em "Aguardando"
      AtendimentosPage.forcarFiltroStatus('waiting');
      cy.wait('@getAttendancesList');

      // 3. Act: Clica no card mockado na fila para abrir o atendimento
      AtendimentosPage.elements.cardAtendimentoPorId(26080076).should('be.visible').click();
      cy.wait('@getAttendanceDetail');

      // Confirma que o painel lateral direito carregou o resumo do atendimento
      AtendimentosPage.elements.summaryOrcamentos()
        .scrollIntoView()
        .should('be.visible');

      // 4. Assert (Menu Lateral): Os botões "X orçamentos" e "X links de pagamento" devem estar habilitados para clique
      AtendimentosPage.elements.summaryOrcamentos()
        .should('be.visible')
        .and('not.be.disabled')
        .and('not.have.attr', 'aria-disabled', 'true');

      AtendimentosPage.elements.summaryLinks()
        .should('be.visible')
        .and('not.be.disabled')
        .and('not.have.attr', 'aria-disabled', 'true');

      // 5. Act & Assert (Gaveta de Orçamentos): Abre a gaveta para consulta
      AtendimentosPage.abrirGavetaOrcamentos();
      AtendimentosPage.elements.drawerOrcamentos().should('be.visible');

      // Valida que os orçamentos mockados são renderizados na listagem
      cy.get('[class*="_budgetDrawerCard_"], [data-testid^="budget-"]').should('have.length.gte', 1);

      // Botão "Enviar orçamento" deve estar desabilitado (bloqueado na janela expirada)
      AtendimentosPage.elements.btnAbrirEnviarOrcamentoDrawer().should(($btn) => {
        expect($btn.is(':disabled') || $btn.attr('aria-disabled') === 'true' || $btn.hasClass('_disabled_')).to.be.true;
      });

      // Fecha gaveta de orçamentos
      AtendimentosPage.fecharGavetaOrcamentos();

      // 6. Act & Assert (Gaveta de Links de Pagamento): Abre a gaveta para consulta
      AtendimentosPage.abrirGavetaLinksPagamento();
      AtendimentosPage.elements.drawerLinksPagamento().should('be.visible');

      // Botão "+ Novo link" deve estar desabilitado (bloqueado na janela expirada)
      AtendimentosPage.elements.btnNovoLinkPagamentoDrawer().should(($btn) => {
        expect($btn.is(':disabled') || $btn.attr('aria-disabled') === 'true' || $btn.hasClass('_disabled_')).to.be.true;
      });

      // Fecha gaveta de links
      AtendimentosPage.fecharGavetaLinksPagamento();

      // 7. Assert (Regras adicionais da PR #250):
      // "Modelos de mensagem" segue liberado para reabrir a conversa
      AtendimentosPage.elements.summaryTemplates()
        .should('be.visible')
        .and('not.be.disabled')
        .and('not.have.attr', 'aria-disabled', 'true');
    });

    it('4.2 deve manter todas as ações habilitadas (envio de orçamento e novo link) quando o atendimento possui Janela Aberta', () => {
      // 1. Arrange: Configuração 100% mockada simulando atendimento com Janela Aberta/Ativa
      AtendimentosMocks.interceptMockDetalheJanelaAberta(26080077);

      // 2. Act: Força recarregamento da fila com o card mockado em "Aguardando"
      AtendimentosPage.forcarFiltroStatus('waiting');
      cy.wait('@getAttendancesList');

      // 3. Act: Clica no card mockado para abrir o atendimento
      AtendimentosPage.elements.cardAtendimentoPorId(26080077).should('be.visible').click();
      cy.wait('@getAttendanceDetail');

      AtendimentosPage.elements.summaryOrcamentos()
        .scrollIntoView()
        .should('be.visible');

      // 4. Act & Assert (Gaveta de Orçamentos): "Enviar orçamento" liberado com orçamentos válidos
      AtendimentosPage.abrirGavetaOrcamentos();
      AtendimentosPage.elements.drawerOrcamentos().should('be.visible');

      // Valida que os orçamentos mockados são renderizados na gaveta
      cy.get('[class*="_budgetDrawerCard_"], [data-testid^="budget-"]').should('have.length.gte', 1);

      // Botão "Enviar orçamento" deve estar visível e habilitado para clique
      AtendimentosPage.elements.btnAbrirEnviarOrcamentoDrawer()
        .should('be.visible')
        .and('not.be.disabled')
        .and('not.have.attr', 'aria-disabled', 'true');

      // Clica em "Enviar orçamento" para abrir a modal de envio
      AtendimentosPage.abrirModalEnviarOrcamento();
      AtendimentosPage.elements.modalEnviarOrcamento().should('be.visible');
      AtendimentosPage.elements.btnFecharModalOrcamento().click();
      AtendimentosPage.elements.modalEnviarOrcamento().should('not.exist');

      AtendimentosPage.fecharGavetaOrcamentos();

      // 5. Act & Assert (Gaveta de Links de Pagamento): "+ Novo link" liberado
      AtendimentosPage.abrirGavetaLinksPagamento();
      AtendimentosPage.elements.drawerLinksPagamento().should('be.visible');
      AtendimentosPage.elements.btnNovoLinkPagamentoDrawer()
        .should('be.visible')
        .and('not.be.disabled')
        .and('not.have.attr', 'aria-disabled', 'true');

      AtendimentosPage.fecharGavetaLinksPagamento();
    });

    it('4.3 deve manter as gavetas de orçamentos e links bloqueadas na porta quando não há atendente designado (Regra #212)', () => {
      // 1. Arrange: Atendimento sem atendente vinculado (100% mockado)
      AtendimentosMocks.interceptMockDetalheSemAtendente(26080078);

      // 2. Act: Força recarregamento da fila com o card mockado em "Aguardando"
      AtendimentosPage.forcarFiltroStatus('waiting');
      cy.wait('@getAttendancesList');

      // 3. Act: Clica no card mockado para abrir o atendimento
      AtendimentosPage.elements.cardAtendimentoPorId(26080078).should('be.visible').click();
      cy.wait('@getAttendanceDetail');

      // 4. Assert (Regra #212): Ambos os atalhos no menu lateral continuam com bloqueio de porta
      AtendimentosPage.elements.summaryOrcamentos()
        .closest('[class*="_blockedActionTooltipWrap_"]')
        .should('exist');

      AtendimentosPage.elements.summaryLinks()
        .closest('[class*="_blockedActionTooltipWrap_"]')
        .should('exist');
    });

  });

  // -------------------------------------------------------------
  // 5. LEITURA DE MENSAGENS, BADGE E CONTAGEM REGRESSIVA DA JANELA 24H (PR #312)
  // -------------------------------------------------------------

  context('5. Leitura de Mensagens, Badge e Contagem Regressiva da Janela 24h (PR #312)', () => {

    let originalUseMocksState;

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      // Imuniza este contexto isolando-o da API Real.
      Cypress.env('USE_MOCKS', true);
      Cypress.env('USE_MOCKS_FORCED_BY_TEST', true);
    });

    beforeEach(() => {
      // Usamos a lista original para respeitar a estrutura de 'Meus Atendimentos' (Em andamento)
      AtendimentosMocks.interceptAttendancesListApi(AtendimentosMocks.mockAttendancesListData);
    });

    after(() => {
      // Restaura o ambiente para a configuração original após o bloco
      Cypress.env('USE_MOCKS', originalUseMocksState);
      Cypress.env('USE_MOCKS_FORCED_BY_TEST', false);
    });

    it('5.1 deve ignorar a chamada da API de leitura ao abrir conversa sem badge', () => {
      const idAtendimento = 260800035;
      // DADO um card sem badge
      AtendimentosMocks.interceptQueueWithCustomCount(idAtendimento, 0);
      AtendimentosMocks.interceptReadApi(idAtendimento, { unread_count: 0, messages_marked: 0, captured: false });

      AtendimentosPage.visitar();
      AtendimentosPage.filtrarPorStatusChip('in_progress');
      cy.wait('@getAttendancesList');
      AtendimentosPage.validarCardNaoPossuiBadgeNaoLido(idAtendimento);

      // QUANDO o usuário o abre
      AtendimentosPage.abrirAtendimentoPorId(idAtendimento);

      // ENTÃO nenhuma requisição para /read é feita
      // Aguardamos que a tela carregue (esperamos um intercept qualquer para ter certeza que estabilizou)
      cy.wait('@getAttendanceDetail');
      cy.get('@postReadApi.all').should('have.length', 0);
    });

    it('5.2 deve manter o badge intacto quando um terceiro abre a conversa do titular', () => {
      const idAtendimento = 260900003; // De outro atendente, Badge 3
      AtendimentosMocks.interceptCapabilities(true); // Permite ver ocupados
      AtendimentosMocks.interceptReadApi(idAtendimento, { unread_count: 3, messages_marked: 0, captured: false });

      AtendimentosPage.visitar();
      AtendimentosPage.filtrarPorStatusChip('in_progress');
      cy.wait('@getAttendancesList');
      AtendimentosPage.validarCardPossuiBadgeNaoLido(idAtendimento, 3);

      // QUANDO o usuário abre a conversa de outro
      AtendimentosPage.abrirAtendimentoPorId(idAtendimento);
      cy.wait('@postReadApi');

      // ENTÃO o badge continua mostrando 3
      AtendimentosPage.validarCardPossuiBadgeNaoLido(idAtendimento, 3);
    });

    it('5.3 deve tratar falhas de API de forma silenciosa mantendo o badge intacto', () => {
      const idAtendimento = 260800035;
      AtendimentosMocks.interceptReadApi(idAtendimento, { message: "Forbidden" }, 403);

      const mockDetailAtivo = JSON.parse(JSON.stringify(AtendimentosMocks.mockAttendanceDetailData));
      mockDetailAtivo.attendance.last_customer_message_at = new Date().toISOString();
      mockDetailAtivo.attendance.service_window_active = true;
      AtendimentosMocks.interceptAttendanceDetailApi(idAtendimento, mockDetailAtivo);

      AtendimentosPage.visitar();
      AtendimentosPage.filtrarPorStatusChip('in_progress');
      cy.wait('@getAttendancesList');
      AtendimentosPage.validarCardPossuiBadgeNaoLido(idAtendimento, 5);

      AtendimentosPage.abrirAtendimentoPorId(idAtendimento);
      cy.wait('@postReadApi');

      // ENTÃO: falha é silenciosa, badge continua lá, sem erro global
      AtendimentosPage.validarCardPossuiBadgeNaoLido(idAtendimento, 5);
      cy.get('[role="dialog"], [class*="toast"]').should('not.exist');
    });

    const idAtendimento = 260800035; // Atendimento padrão atribuído ao operador

    it('5.4 deve exibir o contador regressivo em verde com ícone de relógio e caixa de mensagem livre quando a janela restante for superior a 4 horas', () => {
      // Arrange: Configura janela de serviço com 18 horas restantes (> 4h, estado Verde/Calm)
      AtendimentosMocks.interceptMockDetalheComJanelaHoras({
        attendanceId: idAtendimento,
        horasRestantes: 18,
        minutosRestantes: 0,
        canSendFreeText: true,
        serviceWindowActive: true
      });

      // Act: Visita a tela, filtra atendimentos em andamento e abre a conversa
      AtendimentosPage.visitar();
      AtendimentosPage.filtrarPorStatusChip('in_progress');
      cy.wait('@getAttendancesList');
      AtendimentosPage.abrirAtendimentoPorId(idAtendimento);
      cy.wait('@getAttendanceDetail');

      // Assert: Valida badge verde (data-tone="calm"), ícone de relógio e compositor de texto livre habilitado
      AtendimentosPage.validarBadgeJanelaVerde({ formatoEsperado: /(?:17|18):\d{2}/ });
    });

    it('5.5 deve exibir o contador regressivo em tom de alerta laranja quando a janela restante for menor ou igual a 4 horas mantendo a digitação livre', () => {
      // Arrange: Configura janela de serviço com 3 horas e 58 minutos restantes (<= 4h, estado Laranja/Alert)
      AtendimentosMocks.interceptMockDetalheComJanelaHoras({
        attendanceId: idAtendimento,
        horasRestantes: 3,
        minutosRestantes: 58,
        canSendFreeText: true,
        serviceWindowActive: true
      });

      // Act: Visita a tela, filtra atendimentos em andamento e abre a conversa
      AtendimentosPage.visitar();
      AtendimentosPage.filtrarPorStatusChip('in_progress');
      cy.wait('@getAttendancesList');
      AtendimentosPage.abrirAtendimentoPorId(idAtendimento);
      cy.wait('@getAttendanceDetail');

      // Assert: Valida badge em alerta laranja (data-tone="alert"), ícone de relógio e digitação livre mantida
      AtendimentosPage.validarBadgeJanelaAlertaLaranja({ formatoEsperado: /03:\d{2}/ });
    });

    it('5.6 deve exibir o badge em vermelho de janela limitada e bloquear o compositor com aviso de template quando a janela estiver expirada', () => {
      // Arrange: Configura janela expirada no passado (-1h, can_send_free_text: false, estado Vermelho/Expired)
      AtendimentosMocks.interceptMockDetalheComJanelaHoras({
        attendanceId: idAtendimento,
        horasRestantes: -1,
        minutosRestantes: 0,
        canSendFreeText: false,
        serviceWindowActive: false
      });

      // Act: Visita a tela, filtra atendimentos em andamento e abre a conversa
      AtendimentosPage.visitar();
      AtendimentosPage.filtrarPorStatusChip('in_progress');
      cy.wait('@getAttendancesList');
      AtendimentosPage.abrirAtendimentoPorId(idAtendimento);
      cy.wait('@getAttendanceDetail');

      // Assert: Valida badge vermelho (data-tone="expired"), aviso de janela limitada e bloqueio da digitação comum
      AtendimentosPage.validarBadgeJanelaExpiradaVermelho();
    });

  });

  // -------------------------------------------------------------
  // 6. PRÉVIA E ENVIO DE TEMPLATE WABA COM MÚLTIPLAS VARIÁVEIS (PR #284 E #285)
  // -------------------------------------------------------------

  context('6. Prévia e Envio de Template WABA com Múltiplas Variáveis (PR #284 e #285)', () => {
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

    it('6.1 deve selecionar o template teste_seis_variaveis no chat, preencher validando a prévia com os dados e enviar para o chat validando os dados', () => {
      const idAtendimento = 260900057;
      const textoVariavelObrigatoria = 'Seu pedido 9988 esta pronto para retirada';
      const attendant = AtendimentosMocks.getLoggedAttendant();
      let mensagemEnviada = false;
      let corpoMensagemEnviada = '';

      // Arrange 1: Concede todas as permissões e capabilities de atendimento
      // Janela de 24h encerrada: sem texto livre, só template (senão o aviso e o botão de templates somem do compositor)
      AtendimentosPage.concederTodasPermissoes({
        attendanceId: idAtendimento,
        overridesItemCapabilities: { can_send_free_text: false }
      });
      AtendimentosMocks.interceptSummaryApi();
      AtendimentosMocks.interceptAttendancesListApi();

      const mockDetail = AtendimentosMocks.mockAttendanceDetailData;
      AtendimentosMocks.interceptAttendanceDetailApi('*', {
        ...mockDetail,
        attendance: {
          ...mockDetail.attendance,
          id: idAtendimento,
          status: 1,
          attendant: attendant,
          attendant_id: attendant.id,
          attendant_name: attendant.name,
          customer_name: 'NATÁLIA',
          channel: {
            id: 6,
            name: 'WHATSAPP OFICIAL - 62 98222-4382',
            type: 1,
            subtype: 1
          },
          service_window_active: false,
          service_window: null
        },
        customer: {
          id: 101,
          name: 'NATÁLIA',
          phone: `55${CELULAR_PADRAO}`
        },
        capabilities: {
          can_view_attendance_detail: true,
          can_list_attendance_messages: true,
          can_send_attendance_messages: true,
          can_send_free_text: false,
          can_mark_completed: true,
          can_mark_discarded: true,
          can_mark_finished: true,
          can_transfer_assigned_attendance: true,
          can_transfer_pending_attendance: true,
          can_send_payment_link: true,
          can_add_movement: true,
          can_remove_movement: true,
          can_save_customer_on_attendance: true,
          can_change_attendant_status: true,
          can_change_default_customer: true,
          can_change_online_payment_with_benefit_program: true,
          can_transfer_omni_movement: true,
          can_manage_os_support: true
        }
      });

      // Arrange 2: Intercepta envio de mensagem e atualização dinâmica do chat
      const mensagemTemplateResolvida = `Olá *Natália*, \nBoa tarde, tudo bem ?\nSou *${attendant.name}* da *OmniCare*,\nposso chamar você de Natália ?\n\n${textoVariavelObrigatoria}\n\nAgracemos o retorno, e tenha uma excelente semana !`;

      cy.intercept('POST', rotaApi(`attendances/*/messages*`), (req) => {
        mensagemEnviada = true;
        corpoMensagemEnviada = req.body?.text || req.body?.body || req.body?.content || '';
        req.reply({
          statusCode: 201,
          body: {
            id: 4854475,
            attendance_id: idAtendimento,
            body: corpoMensagemEnviada || mensagemTemplateResolvida,
            content: corpoMensagemEnviada || mensagemTemplateResolvida,
            created_at: new Date().toISOString()
          }
        });
      }).as('sendChatMessage');

      cy.intercept('GET', new RegExp(regexApi(`attendances/\\d+/messages([?#].*)?$`)), (req) => {
        const itens = [
          {
            id: 4853001,
            created_at: new Date(Date.now() - 3600000).toISOString(),
            origin: 'customer',
            employee_code: null,
            transfer_type: 0,
            content_type: 'text',
            message_status: 'ready',
            content: 'Atendimento aguardando resposta',
            error_reason: null,
            attachment: null,
            replied_message: null
          }
        ];
        if (mensagemEnviada) {
          itens.push({
            id: 4854475,
            created_at: new Date().toISOString(),
            origin: 'employee',
            employee_code: String(attendant.id),
            transfer_type: 0,
            content_type: 'text',
            message_status: 'sent',
            content: corpoMensagemEnviada || mensagemTemplateResolvida,
            error_reason: null,
            attachment: null,
            replied_message: null
          });
        }
        req.reply({
          statusCode: 200,
          body: {
            data: itens,
            pagination: {
              page: 1,
              per_page: 20,
              total: itens.length,
              total_pages: 1,
              has_next: false,
              has_previous: false
            },
            capabilities: {
              can_send_attendance_messages: true,
              can_list_attendance_messages: true
            }
          }
        });
      }).as('getAttendanceMessages');

      // Act 1: Visita a gestão de atendimentos, filtra por Em andamento e abre a conversa diretamente
      AtendimentosPage.visitar();
      AtendimentosPage.filtrarPorStatusChip('in_progress');
      cy.wait('@getAttendancesList');
      AtendimentosPage.abrirAtendimentoPorId(idAtendimento);
      cy.wait('@getAttendanceDetail');

      // Assegura que o painel do chat carregou
      cy.get('main, [data-testid="composer-service-window-notice"], [data-testid="button-service-window-templates"]', { timeout: 15000 })
        .should('be.visible');

      // Act 2: No chat aberto, abre o painel/gaveta de templates
      AtendimentosPage.abrirPainelTemplatesJanelaExpirada();

      // Ação 1: Seleciona o template "teste_seis_variaveis" e preenche a variável obrigatória
      AtendimentosPage.selecionarTemplateComVariavel('teste_seis_variaveis');
      AtendimentosPage.preencherVariavelPrincipalTemplate(textoVariavelObrigatoria);

      // Aplica o template no compositor do chat e valida se a prévia está com os dados
      AtendimentosPage.aplicarTemplateNoCompositor();
      AtendimentosPage.validarPreviaTemplateNoCompositor({
        textoFixo: 'OmniCare',
        textoVariavel: textoVariavelObrigatoria
      });

      // Ação 2: Depois envia para o chat e valida se está com os dados
      AtendimentosPage.enviarMensagemCompositor();
      cy.wait('@sendChatMessage');

      AtendimentosPage.validarMensagemEnviadaComTiposPrevia({
        textoFixo: 'OmniCare',
        textoVariavel: textoVariavelObrigatoria
      });
    });

  });

  // -------------------------------------------------------------
  // 7. JANELA 24H WABA: LINKIFY, BLOQUEIO DE JANELA ENCERRADA E ANCORAGEM DE SCROLL (PRS #242, #204 E #355)
  // -------------------------------------------------------------

  context('7. Janela 24h WABA: Linkify, Bloqueio de Janela Encerrada e Ancoragem de Scroll (PRs #242, #204 e #355)', () => {
    let originalUseMocksState;
    const attendant = AtendimentosMocks.getLoggedAttendant();

    // Blindagem de escopo hermético forçado (100% Mockado)
    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
      Cypress.env('USE_MOCKS_FORCED_BY_TEST', true);
    });

    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
      Cypress.env('USE_MOCKS_FORCED_BY_TEST', false);
    });

    // ---- Sub-bloco: Detecção de Hiperlinks e Linkify em Mensagens (PR #242) ----
    const idAtendimentoLinkify = 260900057;

    // Helper chamado explicitamente no início de cada it() deste sub-bloco (isola o mock por teste)
    const prepararCenarioLinkify = () => {
      // 1. Arrange: Concede e intercepta todas as permissões e capabilities da tela
      AtendimentosPage.concederTodasPermissoes({ attendanceId: idAtendimentoLinkify });

      // 2. Arrange: Intercepta resumo e listagem oficial
      AtendimentosMocks.interceptSummaryApi();
      AtendimentosMocks.interceptAttendancesListApi();

      // 3. Arrange: Intercepta detalhes do atendimento garantindo consistência com a UI
      const mockDetail = AtendimentosMocks.mockAttendanceDetailData;
      AtendimentosMocks.interceptAttendanceDetailApi('*', {
        ...mockDetail,
        attendance: {
          ...mockDetail.attendance,
          id: idAtendimentoLinkify,
          status: 0,
          attendant: null,
          attendant_id: null,
          attendant_name: null,
          customer_name: 'NATÁLIA',
          channel: {
            id: 6,
            name: 'WHATSAPP OFICIAL - 62 98222-4382',
            type: 1,
            subtype: 1
          },
          service_window_active: true,
          service_window: null
        },
        customer: {
          id: 101,
          name: 'NATÁLIA',
          phone: `55${CELULAR_PADRAO}`
        },
        capabilities: {
          can_view_attendance_detail: true,
          can_list_attendance_messages: true,
          can_send_attendance_messages: true,
          can_send_free_text: true,
          can_mark_completed: true,
          can_mark_discarded: true,
          can_mark_finished: true,
          can_transfer_assigned_attendance: true,
          can_transfer_pending_attendance: true,
          can_send_payment_link: true,
          can_add_movement: true,
          can_remove_movement: true,
          can_save_customer_on_attendance: true,
          can_change_attendant_status: true,
          can_change_default_customer: true,
          can_change_online_payment_with_benefit_program: true,
          can_transfer_omni_movement: true,
          can_manage_os_support: true
        }
      });

      // 4. Arrange: Intercepta mensagens com todos os formatos e casos de borda do PR #242
      cy.intercept('GET', new RegExp(regexApi(`attendances/\\d+/messages([?#].*)?$`)), {
        statusCode: 200,
        body: {
          data: [
            // Mensagem 1: Link externo Cielo (https://) e link iniciado por www.
            {
              id: 4855701,
              created_at: new Date(Date.now() - 10000).toISOString(),
              origin: 'employee',
              employee_code: String(attendant.id || '0'),
              transfer_type: 0,
              content_type: 'text',
              message_status: 'sent',
              content: 'Link para Detalhes e Pagamento: https://cieloecommerce.cielo.com.br/checkout/12345 e acesse www.farmacia.com.br/pedidos para consultar.',
              error_reason: null,
              attachment: null,
              replied_message: null
            },
            // Mensagem 2: Link com ponto final colado na frase
            {
              id: 4855702,
              created_at: new Date(Date.now() - 8000).toISOString(),
              origin: 'employee',
              employee_code: String(attendant.id || '0'),
              transfer_type: 0,
              content_type: 'text',
              message_status: 'sent',
              content: 'Para rastrear seu pedido com segurança acesse https://rastreamento.farmacia.com.br/12345.',
              error_reason: null,
              attachment: null,
              replied_message: null
            },
            // Mensagem 3: Legenda de imagem contendo URL externa
            {
              id: 4855703,
              created_at: new Date(Date.now() - 6000).toISOString(),
              origin: 'employee',
              employee_code: String(attendant.id || '0'),
              transfer_type: 0,
              content_type: 'image',
              message_status: 'sent',
              content: 'Segue o comprovante da transação: https://comprovantes.farmacia.com.br/recibo-cielo-987',
              error_reason: null,
              attachment: {
                url: 'https://app.omnicare.dev.local/favicon.ico',
                file_name: 'comprovante.jpg',
                file_size: 49000,
                content_type: 'image/jpeg'
              },
              replied_message: null
            },
            // Mensagem 4: Nota interna (origin: 'internal', transfer_type: 6) contendo URL
            {
              id: 4855704,
              created_at: new Date(Date.now() - 4000).toISOString(),
              origin: 'internal',
              employee_code: String(attendant.id || '0'),
              transfer_type: 6,
              content_type: 'text',
              message_status: 'ready',
              content: 'Nota interna: chamado técnico registrado no link https://jira.farmacia.com.br/browse/CARD-100 para análise.',
              error_reason: null,
              attachment: null,
              replied_message: null
            },
            // Mensagem 5: Markdown falso, e-mail e telefone
            {
              id: 4855705,
              created_at: new Date(Date.now() - 2000).toISOString(),
              origin: 'employee',
              employee_code: String(attendant.id || '0'),
              transfer_type: 0,
              content_type: 'text',
              message_status: 'sent',
              content: 'Acesse [Link Cielo](https://cielo.com.br) ou envie e-mail para suporte@farmacia.com.br ou ligue para (62) 99322-5337.',
              error_reason: null,
              attachment: null,
              replied_message: null
            }
          ],
          pagination: {
            page: 1,
            per_page: 20,
            total: 5,
            total_pages: 1,
            has_next: false,
            has_previous: false
          }
        }
      }).as('getAttendanceMessages');

      // 5. Act: Visita o módulo (estado padrão "Aguardando"), abre a conversa e aguarda carregamento
      AtendimentosPage.visitar();
      cy.wait('@getAttendancesList');
      AtendimentosPage.abrirAtendimentoPorId(idAtendimentoLinkify);
      cy.wait('@getAttendanceDetail');
      cy.get('main', { timeout: 15000 }).should('be.visible');
      cy.wait('@getAttendanceMessages');
    };

    it('7.1 deve transformar URLs externas (http/https e www) em links clicáveis com target blank e noopener noreferrer', () => {
      prepararCenarioLinkify();

      // 1. Arrange & Assert: Valida link de pagamento Cielo (https://)
      AtendimentosPage.validarLinkMensagem({
        href: 'https://cieloecommerce.cielo.com.br/checkout/12345',
        texto: 'https://cieloecommerce.cielo.com.br/checkout/12345',
        target: '_blank',
        rel: 'noopener noreferrer'
      });

      // 2. Assert: Valida link iniciado por www. (normalizado para https:// no atributo href)
      AtendimentosPage.validarLinkMensagem({
        href: 'https://www.farmacia.com.br/pedidos',
        texto: 'www.farmacia.com.br/pedidos',
        target: '_blank',
        rel: 'noopener noreferrer'
      });
    });

    it('7.2 deve preservar o ponto final fora do link quando a URL estiver colada ao final de uma frase', () => {
      prepararCenarioLinkify();

      // 1. Assert: O atributo href do <a> não pode conter o ponto final
      const hrefEsperado = 'https://rastreamento.farmacia.com.br/12345';
      AtendimentosPage.validarLinkMensagem({
        href: hrefEsperado,
        texto: hrefEsperado,
        target: '_blank',
        rel: 'noopener noreferrer'
      });

      // 2. Assert: O elemento <a> não contém o ponto final em seu texto interno
      cy.get(`a[href="${hrefEsperado}"]`)
        .first()
        .invoke('text')
        .should('eq', hrefEsperado);

      // 3. Assert: O parágrafo pai contém o texto da frase com o ponto final após a URL
      cy.get(`a[href="${hrefEsperado}"]`)
        .first()
        .parent()
        .should('contain.text', 'Para rastrear seu pedido com segurança acesse https://rastreamento.farmacia.com.br/12345.');
    });

    it('7.3 deve manter o link clicável e com o trecho destacado por dentro ao realizar busca na conversa', () => {
      prepararCenarioLinkify();

      const urlCielo = 'https://cieloecommerce.cielo.com.br/checkout/12345';
      const termoBusca = 'cieloecommerce';

      // 1. Act: Abre a busca da conversa no cabeçalho do chat
      AtendimentosPage.abrirBuscaConversa();

      // 2. Act: Digita termo que faz parte da URL
      AtendimentosPage.pesquisarNaConversa(termoBusca);

      // 3. Assert: O elemento <a> permanece clicável e a tag <mark> é renderizada DENTRO do link
      AtendimentosPage.validarDestaqueBuscaNoLink(urlCielo, termoBusca);

      // 4. Act: Fecha a busca da conversa
      AtendimentosPage.fecharBuscaConversa();
    });

    it('7.4 deve renderizar URLs como links clicáveis em legendas de imagem e em notas internas', () => {
      prepararCenarioLinkify();

      // 1. Assert: Valida URL renderizada como link clicável na legenda da imagem
      AtendimentosPage.validarLinkMensagem({
        href: 'https://comprovantes.farmacia.com.br/recibo-cielo-987',
        texto: 'https://comprovantes.farmacia.com.br/recibo-cielo-987',
        target: '_blank',
        rel: 'noopener noreferrer'
      });

      // 2. Assert: Valida URL renderizada como link clicável dentro de uma nota interna
      AtendimentosPage.validarLinkMensagem({
        href: 'https://jira.farmacia.com.br/browse/CARD-100',
        texto: 'https://jira.farmacia.com.br/browse/CARD-100',
        target: '_blank',
        rel: 'noopener noreferrer'
      });
    });

    it('7.5 deve permitir navegação por teclado com foco no link e manter markdown falso, e-mail e telefone como texto puro', () => {
      prepararCenarioLinkify();

      const linkCielo = 'https://cieloecommerce.cielo.com.br/checkout/12345';

      // 1. Act & Assert: Navegação por teclado recebe foco visível no link
      cy.get(`a[href="${linkCielo}"]`)
        .first()
        .focus()
        .should('have.focus');

      // 2. Assert: E-mail não é transformado em link de e-mail (mailto:)
      cy.get('a[href^="mailto:"]').should('not.exist');

      // 3. Assert: Telefone não é transformado em link telefônico (tel:)
      cy.get('a[href^="tel:"]').should('not.exist');

      // 4. Assert: Markdown falso não substitui o texto pelo padrão de âncora [texto](url)
      cy.contains('a', 'Link Cielo').should('not.exist');
      cy.contains('p', '[Link Cielo]').should('be.visible');
    });

    // ---- Sub-bloco: Bloqueio de Funcionalidades com Janela WABA Encerrada (PR #204) ----
    const idAtendimentoComInbound = 260800034;
    const idAtendimentoSemInbound = 260800018;

    beforeEach(() => {
      // Desativa fast-pass de janela ativa para forçar validação estrita de janela encerrada
      Cypress.env('ACTIVE_SERVICE_WINDOW_VERIFIED', false);
      AtendimentosPage.concederTodasPermissoes();
    });

    // Helper para mockar atendimento oficial com janela expirada (com histórico de mensagens e inbound anterior)
    const prepararMockJanelaExpiradaComInbound = (idAtendimento = idAtendimentoComInbound) => {
      const attendant = AtendimentosMocks.getLoggedAttendant();
      const lastMsgDate = new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString();

      const listItem1 = {
        id: idAtendimento,
        reference_at: "2026-08-11T11:23:47.908Z",
        attendant_name: attendant.name,
        attendant: attendant,
        attendant_id: attendant.id,
        customer_name: "MARISTELA",
        messages: {
          unread_count: 0,
          last_message: {
            type: 1,
            body: "Olá, gostaria de um orçamento",
            occurred_at: lastMsgDate
          }
        },
        status: 1,
        channel: {
          id: 6,
          name: "WHATSAPP OFICIAL - 62 98222-4382",
          type: 1,
          subtype: 1,
          official: true
        },
        group: { id: 7, name: "ATENDIMENTO" }
      };

      const listItem2 = {
        ...listItem1,
        id: 260800035,
        customer_name: "SEGUNDO CLIENTE"
      };

      cy.intercept('GET', rotaApi('attendances?*'), {
        statusCode: 200,
        body: { items: [listItem1, listItem2], pagination: { page: 1, per_page: 20, total: 2, total_pages: 1, has_next: false, has_previous: false } }
      }).as('getAttendancesList');

      const detailRegex = new RegExp(regexApi(`attendances/(${idAtendimento}|\\*|\\d+)([?#].*)?$`));
      cy.intercept('GET', detailRegex, {
        statusCode: 200,
        body: {
          attendance: {
            id: idAtendimento,
            reference_at: "2026-08-11T11:23:47.908Z",
            notes: null,
            status: 1,
            channel: {
              id: 6,
              name: "WHATSAPP OFICIAL - 62 98222-4382",
              type: 1,
              subtype: 1,
              official: true
            },
            group: { id: 7, name: "ATENDIMENTO" },
            attendant: attendant,
            attendant_id: attendant.id,
            attendant_name: attendant.name,
            service_window_active: false,
            last_customer_message_at: lastMsgDate,
            service_window: {
              started_at: lastMsgDate,
              expires_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
            }
          },
          customer: {
            customer_id: 867092,
            name: "MARISTELA",
            phone: "5511999998888",
            email: null,
            store_name: "LOJA TESTE"
          },
          summaries: {
            quotes: { count: 2, total_amount: 346.49 },
            payment_links: { count: 1, pending_confirmation_count: 1 }
          },
          capabilities: {
            ...AtendimentosMocks.mockAttendanceItemCapabilitiesData.capabilities,
            can_send_free_text: false,
            can_create_quote: true,
            can_create_payment_link: true,
            can_send_payment_link: true
          }
        }
      }).as('getAttendanceDetail');

      cy.intercept('GET', rotaApi(`attendances/${idAtendimento}/capabilities*`), {
        statusCode: 200,
        body: {
          capabilities: {
            ...AtendimentosMocks.mockAttendanceItemCapabilitiesData.capabilities,
            can_send_free_text: false,
            can_create_quote: true,
            can_create_payment_link: true,
            can_send_payment_link: true
          }
        }
      }).as('getAttendanceItemCapabilities');

      AtendimentosMocks.interceptMessagesListApi(idAtendimento, AtendimentosMocks.mockMessagesExpiradas);
      AtendimentosMocks.interceptBudgetsApi(idAtendimento, null, true);
      AtendimentosMocks.interceptPaymentLinksApi(idAtendimento, null, true);
      AtendimentosMocks.interceptStandardMessagesApi();
    };

    // Helper para mockar atendimento oficial sem inbound do cliente (cliente nunca enviou mensagem, service_window: null)
    const prepararMockJanelaEncerradaSemInbound = (idAtendimento = idAtendimentoSemInbound) => {
      const attendant = AtendimentosMocks.getLoggedAttendant();

      const listItem = {
        id: idAtendimento,
        reference_at: "2026-08-11T11:23:47.908Z",
        attendant_name: attendant.name,
        attendant: attendant,
        attendant_id: attendant.id,
        customer_name: "CLIENTE SEM INBOUND",
        messages: {
          unread_count: 0,
          last_message: {
            type: 1,
            body: "Olá, como posso ajudar?",
            occurred_at: "2026-08-11T11:23:47.908Z"
          }
        },
        status: 1,
        channel: {
          id: 6,
          name: "WHATSAPP OFICIAL - 62 98222-4382",
          type: 1,
          subtype: 1,
          official: true
        },
        group: { id: 7, name: "ATENDIMENTO" }
      };

      cy.intercept('GET', rotaApi('attendances?*'), {
        statusCode: 200,
        body: { items: [listItem], pagination: { page: 1, per_page: 20, total: 1, total_pages: 1, has_next: false, has_previous: false } }
      }).as('getAttendancesList');

      const detailRegex = new RegExp(regexApi(`attendances/(${idAtendimento}|\\*|\\d+)([?#].*)?$`));
      cy.intercept('GET', detailRegex, {
        statusCode: 200,
        body: {
          attendance: {
            id: idAtendimento,
            reference_at: "2026-08-11T11:23:47.908Z",
            notes: null,
            status: 1,
            channel: {
              id: 6,
              name: "WHATSAPP OFICIAL - 62 98222-4382",
              type: 1,
              subtype: 1,
              official: true
            },
            group: { id: 7, name: "ATENDIMENTO" },
            attendant: attendant,
            attendant_id: attendant.id,
            attendant_name: attendant.name,
            service_window_active: false,
            last_customer_message_at: null,
            service_window: null
          },
          customer: {
            customer_id: 867093,
            name: "CLIENTE SEM INBOUND",
            phone: "5511999998889",
            email: null,
            store_name: "LOJA TESTE"
          },
          summaries: {
            quotes: { count: 1, total_amount: 150.00 },
            payment_links: { count: 0, pending_confirmation_count: 0 }
          },
          capabilities: {
            ...AtendimentosMocks.mockAttendanceItemCapabilitiesData.capabilities,
            can_send_free_text: false,
            can_create_quote: true,
            can_create_payment_link: true,
            can_send_payment_link: true
          }
        }
      }).as('getAttendanceDetail');

      cy.intercept('GET', rotaApi(`attendances/${idAtendimento}/capabilities*`), {
        statusCode: 200,
        body: {
          capabilities: {
            ...AtendimentosMocks.mockAttendanceItemCapabilitiesData.capabilities,
            can_send_free_text: false,
            can_create_quote: true,
            can_create_payment_link: true,
            can_send_payment_link: true
          }
        }
      }).as('getAttendanceItemCapabilities');

      const messagesEmployeeOnly = {
        data: [
          {
            id: 1001,
            attendance_id: idAtendimento,
            origin: "employee",
            content_type: "text",
            text: "Olá, como posso ajudar?",
            occurred_at: "2026-08-11T11:23:47.908Z",
            author: { id: attendant.id, name: attendant.name }
          }
        ],
        pagination: { page: 1, per_page: 20, total: 1, total_pages: 1, has_next: false, has_previous: false }
      };

      AtendimentosMocks.interceptMessagesListApi(idAtendimento, messagesEmployeeOnly);
      AtendimentosMocks.interceptBudgetsApi(idAtendimento, null, true);
      AtendimentosMocks.interceptPaymentLinksApi(idAtendimento, null, true);
      AtendimentosMocks.interceptStandardMessagesApi();
    };

    it('7.6 deve desabilitar visualmente e bloquear interação dos recursos que dependem de janela ativa quando a janela do WhatsApp Oficial estiver encerrada', () => {
      // 1. Arrange: Prepara mock com janela expirada
      prepararMockJanelaExpiradaComInbound(idAtendimentoComInbound);

      // 2. Act: Força recarregamento da fila em "Aguardando" e seleciona o card
      AtendimentosPage.forcarFiltroStatus('waiting');
      cy.wait('@getAttendancesList');
      AtendimentosPage.elements.cardAtendimentoPorId(idAtendimentoComInbound).should('be.visible').click();
      cy.wait('@getAttendanceDetail');

      // 3. Assert: Compositor bloqueado exibindo a faixa de aviso de janela encerrada
      AtendimentosPage.validarJanelaExpirada();

      // 4. Assert: Card "Mensagem padrão" desabilitado e inerte no painel lateral
      AtendimentosPage.elements.summaryMensagemPadrao()
        .scrollIntoView()
        .should('be.visible')
        .and('be.disabled');

      // O elemento container (span) deve possuir o tooltip informando o bloqueio por restrição de template
      AtendimentosPage.elements.summaryMensagemPadrao()
        .parent('span[class*="_blockedActionTooltipWrap_"]')
        .should('have.attr', 'title');

      // force:true necessário aqui: o card está de propósito bloqueado (sem permissão), envolto por
      // _blockedActionTooltipWrap_ - o teste prova que o clique através do bloqueio não abre nada,
      // não está mascarando um bloqueio indevido (AGENTS.md §3.5/§4.3)
      AtendimentosPage.elements.summaryMensagemPadrao().click({ force: true });
      AtendimentosPage.elements.drawerMensagemPadrao().should('not.exist');

      // 5. Assert: Cards "Modelos de mensagem" e "Observações" permanecem habilitados e utilizáveis
      AtendimentosPage.elements.summaryTemplates()
        .scrollIntoView()
        .should('be.visible')
        .and('not.be.disabled')
        .and('not.have.attr', 'aria-disabled', 'true');

      AtendimentosPage.elements.summaryObservacoes()
        .scrollIntoView()
        .should('be.visible')
        .and('not.be.disabled')
        .and('not.have.attr', 'aria-disabled', 'true');

      // 6. Assert: Dentro da gaveta de Orçamentos, o botão "Enviar orçamento" fica bloqueado
      AtendimentosPage.abrirGavetaOrcamentos();
      AtendimentosPage.elements.drawerOrcamentos().should('be.visible');
      AtendimentosPage.elements.btnAbrirEnviarOrcamentoDrawer()
        .should('be.disabled');
      AtendimentosPage.elements.btnAbrirEnviarOrcamentoDrawer()
        .parent('span[class*="_blockedActionTooltipWrap_"]')
        .should('have.attr', 'title');
      AtendimentosPage.fecharGavetaOrcamentos();

      // 7. Assert: Dentro da gaveta de Links de Pagamento, o botão "+ Novo link" fica bloqueado
      AtendimentosPage.abrirGavetaLinksPagamento();
      AtendimentosPage.elements.drawerLinksPagamento().should('be.visible');
      AtendimentosPage.elements.btnNovoLinkPagamentoDrawer()
        .should('be.disabled');
      AtendimentosPage.elements.btnNovoLinkPagamentoDrawer()
        .parent('span[class*="_blockedActionTooltipWrap_"]')
        .should('have.attr', 'title');
      AtendimentosPage.fecharGavetaLinksPagamento();
    });

    it('7.7 deve aplicar os bloqueios da janela encerrada mesmo em atendimento sem inbound inicial (sem a tag Janela Expirada)', () => {
      // 1. Arrange: Atendimento sem nenhuma mensagem do cliente (service_window: null, can_send_free_text: false)
      prepararMockJanelaEncerradaSemInbound(idAtendimentoSemInbound);

      // 2. Act: Carrega o atendimento
      AtendimentosPage.forcarFiltroStatus('waiting');
      cy.wait('@getAttendancesList');
      AtendimentosPage.elements.cardAtendimentoPorId(idAtendimentoSemInbound).should('be.visible').click();
      cy.wait('@getAttendanceDetail');

      // 3. Assert: Não deve renderizar a tag "Janela expirada" no cabeçalho
      cy.get('[data-testid="badge-janela-expirada"]').should('not.exist');
      cy.get('body').then(($body) => {
        const badgesExpiradas = $body.find('span:contains("Janela expirada")');
        expect(badgesExpiradas.length).to.equal(0);
      });

      // 4. Assert: A faixa de aviso do compositor e os bloqueios de envio aplicam-se normalmente
      AtendimentosPage.elements.bannerJanelaEncerrada().should('be.visible');
      AtendimentosPage.elements.btnEnviarTemplateAviso().should('be.visible');
      AtendimentosPage.elements.inputMensagemChat().should('not.exist');

      // 5. Assert: Card "Mensagem padrão" segue desabilitado/bloqueado
      AtendimentosPage.elements.summaryMensagemPadrao()
        .scrollIntoView()
        .should('be.visible')
        .and('be.disabled');
    });

    it('7.8 deve reabilitar automaticamente os cards e ações bloqueadas após resposta do cliente (inbound) sem recarregar a página', () => {
      // 1. Arrange: Inicia com janela encerrada
      prepararMockJanelaExpiradaComInbound(idAtendimentoComInbound);

      // 2. Act 1: Carrega atendimento com janela encerrada
      AtendimentosPage.forcarFiltroStatus('waiting');
      cy.wait('@getAttendancesList');
      AtendimentosPage.elements.cardAtendimentoPorId(idAtendimentoComInbound).should('be.visible').click();
      cy.wait('@getAttendanceDetail');

      // Confirma estado inicial bloqueado
      AtendimentosPage.elements.summaryMensagemPadrao().should('be.disabled');
      AtendimentosPage.elements.bannerJanelaEncerrada().should('be.visible');

      // 3. Act 2: Simula o inbound do cliente (resposta no WhatsApp reabrindo a janela)
      const agora = new Date().toISOString();
      const attendant = AtendimentosMocks.getLoggedAttendant();
      const detailRegex = new RegExp(regexApi(`attendances/(${idAtendimentoComInbound}|\\*|\\d+)([?#].*)?$`));

      cy.then(() => {
        // Intercepta a rota de detalhes com a janela agora ATIVA
        cy.intercept('GET', detailRegex, {
          statusCode: 200,
          body: {
            attendance: {
              id: idAtendimentoComInbound,
              reference_at: "2026-08-11T11:23:47.908Z",
              status: 1,
              channel: { id: 6, name: "WHATSAPP OFICIAL - 62 98222-4382", type: 1, subtype: 1, official: true },
              group: { id: 7, name: "ATENDIMENTO" },
              attendant: attendant,
              attendant_id: attendant.id,
              attendant_name: attendant.name,
              service_window_active: true,
              last_customer_message_at: agora,
              service_window: {
                started_at: agora,
                expires_at: new Date(Date.now() + 86400000).toISOString()
              }
            },
            customer: { customer_id: 867092, name: "MARISTELA", phone: "5511999998888", store_name: "LOJA TESTE" },
            summaries: { quotes: { count: 2, total_amount: 346.49 }, payment_links: { count: 1, pending_confirmation_count: 1 } },
            capabilities: {
              ...AtendimentosMocks.mockAttendanceItemCapabilitiesData.capabilities,
              can_send_free_text: true,
              can_create_quote: true,
              can_create_payment_link: true,
              can_send_payment_link: true
            }
          }
        }).as('getAttendanceDetailActive');

        // Intercepta capabilities com can_send_free_text: true
        cy.intercept('GET', rotaApi(`attendances/${idAtendimentoComInbound}/capabilities*`), {
          statusCode: 200,
          body: {
            capabilities: {
              ...AtendimentosMocks.mockAttendanceItemCapabilitiesData.capabilities,
              can_send_free_text: true,
              can_create_quote: true,
              can_create_payment_link: true,
              can_send_payment_link: true
            }
          }
        }).as('getAttendanceCapabilitiesActive');

        // Intercepta lista de mensagens com o inbound recente do cliente
        const inboundMessage = {
          id: 9999991,
          attendance_id: idAtendimentoComInbound,
          origin: "customer",
          content_type: "text",
          text: "Olá, recebi o template e estou respondendo!",
          occurred_at: agora,
          author: { id: 867092, name: "MARISTELA" }
        };

        AtendimentosMocks.interceptMessagesListApi(idAtendimentoComInbound, {
          data: [inboundMessage, ...AtendimentosMocks.mockMessagesAtivas.data],
          items: [inboundMessage, ...AtendimentosMocks.mockMessagesAtivas.data],
          messages: [inboundMessage, ...AtendimentosMocks.mockMessagesAtivas.data],
          pagination: { page: 1, per_page: 20, total: 3, total_pages: 1, has_next: false, has_previous: false }
        });
        // Intercepta feed de eventos retornando a mudança de atendimento em tempo real
        cy.intercept('GET', rotaApi('attendance-events?*'), {
          statusCode: 200,
          body: {
            items: [
              {
                id: Date.now(),
                type: 'attendance.changed',
                attendance_id: idAtendimentoComInbound,
                occurred_at: agora
              }
            ],
            cursor: 35,
            has_more: false
          }
        }).as('getAttendanceEventsInbound');
      });

      // 4. Act 3: Dispara sincronização em tempo real sem recarregar a página
      // Alterna entre cards ou aguarda o refetch do feed de eventos
      AtendimentosPage.elements.cardsAtendimento().eq(1).click();
      AtendimentosPage.elements.cardsAtendimento().first().click();
      cy.wait('@getAttendanceDetailActive', { timeout: 15000 });

      // 5. Assert: Valida a cura automática sem recarregar a página
      // O card "Mensagem padrão" volta a ficar habilitado
      AtendimentosPage.elements.summaryMensagemPadrao()
        .scrollIntoView()
        .should('be.visible')
        .and('not.be.disabled')
        .and('not.have.attr', 'aria-disabled', 'true');

      // A faixa de janela encerrada no chat desaparece e o compositor de texto livre é liberado
      AtendimentosPage.elements.bannerJanelaEncerrada().should('not.exist');
      AtendimentosPage.elements.inputMensagemChat().should('be.visible');
    });

    // ---- Sub-bloco: Ancoragem do Scroll no Chat pós-Transferência de Atendimento (PR #355) ----
    const idAtendimentoScroll = 260900015;
    const nomeOperadorGlobal = Cypress.env('DEFAULT_CLIENT_NAME') || configEnv.DEFAULT_CLIENT_NAME || 'klismam';
    const nomeOperadorProfile = attendant.name;
    const idOperadorLogado = attendant.id;

    it('7.9 deve manter o scroll ancorado na última mensagem do chat após transferir o atendimento para outro atendente (PR #355)', () => {
      AtendimentosPage.concederTodasPermissoes({ attendanceId: idAtendimentoScroll });

      // 1. Arrange: mensagens do chat (quantidade suficiente para garantir overflow/scroll no container)
      const chatMsgs = [];
      for (let i = 20; i >= 1; i--) {
        const pad = String(i).padStart(2, '0');
        chatMsgs.push({
          id: 30000 + i,
          attendance_id: idAtendimentoScroll,
          origin: i % 2 === 0 ? "customer" : "employee",
          employee_code: i % 2 === 0 ? null : String(idOperadorLogado),
          transfer_type: 0,
          content_type: "text",
          message_status: i % 2 === 0 ? "ready" : "sent",
          content: i === 20 ? "Mensagem mais recente [FIM]" : `Mensagem [${pad}]`,
          text: i === 20 ? "Mensagem mais recente [FIM]" : `Mensagem [${pad}]`,
          body: i === 20 ? "Mensagem mais recente [FIM]" : `Mensagem [${pad}]`,
          created_at: `2026-09-09T09:${String(i).padStart(2, '0')}:00.000Z`,
          occurred_at: `2026-09-09T09:${String(i).padStart(2, '0')}:00.000Z`
        });
      }

      cy.intercept('GET', rotaApi(`attendances/${idAtendimentoScroll}/messages*`), {
        statusCode: 200,
        body: {
          data: chatMsgs,
          items: chatMsgs,
          pagination: { page: 1, per_page: 20, total: 20, total_pages: 1, has_next: false, has_previous: false }
        }
      }).as('getAttendanceMessages');

      // Objeto canônico do atendimento para a listagem da fila (conforme schema Zod ni / attendancesList)
      const queueAttendanceItem = {
        id: idAtendimentoScroll,
        reference_at: "2026-09-20T00:16:21.783Z",
        attendant_name: nomeOperadorProfile,
        attendant: attendant,
        attendant_id: idOperadorLogado,
        customer_name: "Klismam Monteiro",
        customer_phone: "5511999998888",
        messages: {
          unread_count: 0,
          last_message: {
            type: 1,
            content_type: "text",
            body: "Mensagem mais recente [FIM]",
            occurred_at: "2026-09-20T00:16:21.783Z"
          }
        },
        status: 0,
        custom_status: null,
        channel: {
          id: 6,
          name: "WHATSAPP OFICIAL - 62 98222-4382",
          type: 1,
          subtype: 1,
          official: true
        },
        group: {
          id: 7,
          name: "ATENDIMENTO"
        }
      };

      const listPayload = {
        items: [queueAttendanceItem],
        pagination: {
          page: 1,
          per_page: 20,
          total: 1,
          total_pages: 1,
          has_next: false,
          has_previous: false
        }
      };

      // Intercepta a listagem da fila de atendimentos
      AtendimentosMocks.interceptAttendancesListApi(listPayload);
      cy.intercept('GET', new RegExp(regexApi('attendances(\\?.*)?$')), {
        statusCode: 200,
        body: listPayload
      }).as('getAttendancesList');

      // Mock de detalhe do atendimento (conforme schema Zod Mi / attendanceDetail)
      const detailPayload = {
        attendance: {
          id: idAtendimentoScroll,
          reference_at: "2026-08-11T11:23:47.908Z",
          status: 0,
          channel: {
            id: 6,
            name: "WHATSAPP OFICIAL - 62 98222-4382",
            type: 1,
            subtype: 1,
            official: true
          },
          group: {
            id: 7,
            name: "ATENDIMENTO"
          },
          attendant: attendant,
          attendant_name: nomeOperadorProfile,
          attendant_id: idOperadorLogado,
          service_window_active: true,
          last_customer_message_at: "2026-09-09T09:45:00.000Z",
          service_window: {
            started_at: "2026-09-09T09:45:00.000Z",
            expires_at: new Date(Date.now() + 86400000).toISOString()
          }
        },
        customer: {
          customer_id: 867092,
          name: "Klismam Monteiro",
          phone: "5511999998888",
          email: null,
          store_name: "LOJA TESTE"
        },
        summaries: {
          quotes: { count: 0, total_amount: 0 },
          payment_links: { count: 0, pending_confirmation_count: 0 }
        },
        capabilities: {
          ...AtendimentosMocks.mockAttendanceItemCapabilitiesData.capabilities,
          can_transfer_assigned_attendance: true,
          can_transfer_pending_attendance: true,
          can_view_attendance_detail: true,
          can_list_attendance_messages: true,
          can_send_attendance_messages: true,
          can_send_free_text: true,
          can_create_quote: true,
          can_create_payment_link: true,
          can_send_payment_link: true
        }
      };

      const detailRegex = new RegExp(regexApi(`attendances/(${idAtendimentoScroll}|\\*|\\d+)([?#].*)?$`));
      cy.intercept('GET', detailRegex, {
        statusCode: 200,
        body: detailPayload
      }).as('getAttendanceDetail');

      cy.intercept('GET', rotaApi(`attendances/${idAtendimentoScroll}/capabilities*`), {
        statusCode: 200,
        body: {
          capabilities: detailPayload.capabilities
        }
      }).as('getAttendanceItemCapabilities');

      // Interceptores auxiliares de transferência e agentes
      AtendimentosMocks.interceptMockAgentsGroup(7, 'available');
      AtendimentosMocks.interceptTransferAttendanceApi(idAtendimentoScroll);

      // Recarrega para que o React Query descarte o atendimento padrão auto-carregado no beforeEach (id 260900089)
      // e consuma os interceptores específicos deste teste (id 260900015) desde o primeiro fetch
      cy.reload();

      // 2. Act 1: Seleciona o status "Aguardando", abre o atendimento e aguarda carregamento inicial do chat
      AtendimentosPage.forcarFiltroStatus('waiting');
      cy.wait('@getAttendancesList');
      AtendimentosPage.elements.cardAtendimentoPorId(idAtendimentoScroll).should('be.visible').click();
      cy.wait('@getAttendanceDetail');
      cy.wait('@getAttendanceMessages');
      cy.get('article[class*="_bubbleRow_"]').should('have.length', 20);

      // 3. Act 2: Transfere o atendimento para outro atendente pelo menu do cliente
      AtendimentosPage.abrirModalTransferirPeloMenuCliente();
      cy.wait('@getAttendanceGroupAgents');
      AtendimentosPage.selecionarPrimeiroAtendenteDisponivel();
      AtendimentosPage.confirmarTransferencia();
      cy.wait('@transferAttendancePatch');

      // 4. Assert: após a transferência, o chat permanece ancorado na última mensagem (PR #355)
      // Busca escopada ao container do chat para não colidir com o preview de "última mensagem" do card da fila
      AtendimentosPage.elements.containerMensagensScroll().contains('Mensagem mais recente [FIM]').should('be.visible');
      AtendimentosPage.elements.containerMensagensScroll().should(($el) => {
        const el = $el[0];
        // Distância até o fim do container: 0 tanto se está rolado até o fim quanto se o conteúdo não gera overflow
        const distanciaDoFim = el.scrollHeight - (el.scrollTop + el.clientHeight);
        expect(distanciaDoFim, 'Chat deve permanecer ancorado na última mensagem (fim) após a transferência (PR #355)').to.be.lte(60);
      });
    });
  });

  // -------------------------------------------------------------
  // 8. PRECEDÊNCIA DE TEMPLATE SOBRE ANEXO PENDENTE NO COMPOSITOR (PR #306)
  // -------------------------------------------------------------

  context('8. Precedência de Template sobre Anexo Pendente no Compositor (PR #306)', () => {

    it('8.1 deve enviar o template com precedência sobre o anexo pendente, preservando o anexo para o próximo envio, com janela ativa (PR #306)', () => {
      // 1. Arrange: Cenário 100% mockado com Canal Oficial e Janela de 24h Ativa (Atendimento #26080077)
      AtendimentosMocks.interceptMockDetalheJanelaAberta(26080077);
      AtendimentosMocks.interceptSendMessageApi('*');
      AtendimentosMocks.interceptSendMediaMessageApi('*');

      AtendimentosPage.forcarFiltroStatus('waiting');
      cy.wait('@getAttendancesList');
      AtendimentosPage.elements.cardAtendimentoPorId(26080077).should('be.visible').click();
      cy.wait('@getAttendanceDetail');

      // Pré-condição: compositor livre, sem template pré-selecionado (valida ANTES de mexer no anexo/template)
      AtendimentosPage.validarAusenciaTemplateNoCompositor();

      // 2. Act 1: Anexa uma imagem sem enviar (fica pendente no compositor)
      AtendimentosPage.anexarArquivoSemEnviar('cypress/fixtures/5.atendimentos/anexos/normal/Anexo de teste jpg.jpg');
      AtendimentosPage.validarAnexoPendenteNoCompositor();

      // 3. Act 2: Abre a gaveta de templates e escolhe um template com variável, mesmo com o anexo pendente
      AtendimentosPage.abrirGavetaTemplates();
      AtendimentosPage.selecionarTemplateComVariavel();
      AtendimentosPage.preencherVariavelTemplate('Pedido confirmado');
      AtendimentosPage.aplicarTemplateNoCompositor();

      // Assert: O template venceu a precedência (barra de template ativa no compositor) e o anexo continua pendente
      AtendimentosPage.validarTemplateEscolhidoNoCompositor();
      AtendimentosPage.validarAnexoPendenteNoCompositor();

      // 4. Act 3: Envia — deve seguir a rota de template, não a de mídia
      AtendimentosPage.enviarMensagemCompositor();
      cy.wait('@sendChatMessage');

      // 5. Assert: A rota de mídia NÃO foi disparada junto (a precedência real está na rota chamada, não na renderização)
      cy.get('@sendChatMediaMessage.all').should('have.length', 0);

      // Assert: O anexo NÃO foi descartado nem enviado junto — continua pendente no compositor para o próximo envio
      AtendimentosPage.validarAnexoPendenteNoCompositor();
    });

    // Nota: o cenário de não-regressão "janela fechada com anexo + template" descrito no relato não é
    // alcançável pela UI — com a janela de 24h expirada, o compositor renderiza apenas o aviso de
    // janela encerrada (`composer-service-window-notice`); não existem botão de anexar nem input de
    // arquivo no DOM nesse estado (confirmado via cypress run). Anexar mídia exige janela ativa,
    // então esse caso não pode ocorrer na prática e foi propositalmente omitido.

    it('8.2 deve enviar o anexo normalmente com a legenda digitada quando não há template pendente (PR #306)', () => {
      // 1. Arrange: Cenário 100% mockado com Canal Oficial e Janela de 24h Ativa (Atendimento #26080077)
      AtendimentosMocks.interceptMockDetalheJanelaAberta(26080077);
      AtendimentosMocks.interceptSendMessageApi('*');
      AtendimentosMocks.interceptSendMediaMessageApi('*');

      AtendimentosPage.forcarFiltroStatus('waiting');
      cy.wait('@getAttendancesList');
      AtendimentosPage.elements.cardAtendimentoPorId(26080077).should('be.visible').click();
      cy.wait('@getAttendanceDetail');
      AtendimentosPage.validarAusenciaTemplateNoCompositor();

      // 2. Act 1: Anexa uma imagem sem template pendente e digita legenda normal
      AtendimentosPage.anexarArquivoSemEnviar('cypress/fixtures/5.atendimentos/anexos/normal/Anexo de teste jpg.jpg');
      AtendimentosPage.elements.inputLegendaAnexo().first().clear().type('Segue a foto solicitada');

      // 3. Act 2: Envia — segue a rota de mídia normalmente
      AtendimentosPage.enviarMensagemCompositor();

      // 4. Assert: A rota de mídia foi usada normalmente e a rota de template nunca foi disparada
      cy.wait('@sendChatMediaMessage');
      cy.get('@sendChatMessage.all').should('have.length', 0);
    });

  });

  // -------------------------------------------------------------
  // 9. NAVEGAÇÃO DE RESULTADOS NA BUSCA DA CONVERSA
  // -------------------------------------------------------------

  context('9. Navegação de Resultados na Busca da Conversa', () => {

    let originalUseMocksState;
    const attendantBusca = AtendimentosMocks.getLoggedAttendant();
    const idAtendimentoBusca = 260900061;

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
      Cypress.env('USE_MOCKS_FORCED_BY_TEST', true);
    });
    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
      Cypress.env('USE_MOCKS_FORCED_BY_TEST', false);
    });

    // Conversa longa o suficiente para exigir rolagem real entre as duas ocorrências de "Olá"
    // (a mais antiga fica fora da viewport inicial, já que o chat abre ancorado na última mensagem)
    const construirMensagensBusca = () => {
      const mensagens = [];
      let idSeq = 9500;
      const agora = Date.now();

      mensagens.push({
        id: idSeq++,
        created_at: new Date(agora - 30000).toISOString(),
        origin: 'employee',
        employee_code: String(attendantBusca.id || '0'),
        transfer_type: 0,
        content_type: 'text',
        message_status: 'sent',
        content: 'Olá, tudo bem?',
        error_reason: null,
        attachment: null,
        replied_message: null
      });

      for (let i = 0; i < 12; i++) {
        mensagens.push({
          id: idSeq++,
          created_at: new Date(agora - (28000 - i * 2000)).toISOString(),
          origin: i % 2 === 0 ? 'customer' : 'employee',
          employee_code: i % 2 === 0 ? null : String(attendantBusca.id || '0'),
          transfer_type: 0,
          content_type: 'text',
          message_status: 'sent',
          content: `Mensagem de preenchimento número ${i + 1} para estender o histórico desta conversa.`,
          error_reason: null,
          attachment: null,
          replied_message: null
        });
      }

      mensagens.push({
        id: idSeq++,
        created_at: new Date(agora - 2000).toISOString(),
        origin: 'employee',
        employee_code: String(attendantBusca.id || '0'),
        transfer_type: 0,
        content_type: 'text',
        message_status: 'sent',
        content: 'Olá novamente, vamos finalizar o atendimento?',
        error_reason: null,
        attachment: null,
        replied_message: null
      });

      return mensagens;
    };

    const prepararCenarioNavegacaoBusca = () => {
      AtendimentosPage.concederTodasPermissoes({ attendanceId: idAtendimentoBusca });

      const mockDetail = AtendimentosMocks.mockAttendanceDetailData;
      AtendimentosMocks.interceptAttendanceDetailApi('*', {
        ...mockDetail,
        attendance: {
          ...mockDetail.attendance,
          id: idAtendimentoBusca,
          status: 0,
          attendant: null,
          attendant_id: null,
          attendant_name: null,
          customer_name: 'NAVEGACAO BUSCA',
          service_window_active: true,
          service_window: null
        },
        customer: { id: 998, name: 'NAVEGACAO BUSCA', phone: `55${CELULAR_PADRAO}` }
      });

      const mensagens = construirMensagensBusca();
      cy.intercept('GET', new RegExp(regexApi('attendances/\\d+/messages([?#].*)?$')), {
        statusCode: 200,
        body: {
          data: mensagens,
          pagination: { page: 1, per_page: 20, total: mensagens.length, total_pages: 1, has_next: false, has_previous: false }
        }
      }).as('getAttendanceMessages');

      AtendimentosPage.visitar();
      cy.wait('@getAttendancesList');
      AtendimentosPage.abrirAtendimentoPorId(idAtendimentoBusca);
      cy.wait('@getAttendanceDetail');
      cy.get('main', { timeout: 15000 }).should('be.visible');
      cy.wait('@getAttendanceMessages');
    };

    it('9.1 deve exibir o contador de ocorrências ao pesquisar um termo presente em múltiplas mensagens', () => {
      prepararCenarioNavegacaoBusca();

      AtendimentosPage.abrirBuscaConversa();
      AtendimentosPage.pesquisarNaConversa('Olá');

      AtendimentosPage.elements.contadorBuscaConversa()
        .should('be.visible')
        .and('contain.text', '1 / 2');
    });

    it('9.2 deve destacar todas as ocorrências do termo e marcar a primeira como ativa ao pesquisar (PR #172)', () => {
      prepararCenarioNavegacaoBusca();

      AtendimentosPage.abrirBuscaConversa();
      AtendimentosPage.pesquisarNaConversa('Olá');

      // BUG REAL CONFIRMADO (22/09/2026): a ocorrência ativa inicial (a mais antiga do histórico,
      // fora da viewport porque o chat abre ancorado na última mensagem) fica marcada no DOM
      // (aria-current="true") mas NÃO é rolada até a tela — falha assertiva de 'be.visible'
      // ("clipped by overflow"), mesmo com timeout de 20s (não é lentidão, é ausência de rolagem).
      // Assimetria confirmada nos 2 testes seguintes: navegar para a ocorrência MAIS RECENTE
      // (Próximo) rola corretamente; a busca inicial e "Anterior" para a mais ANTIGA não rolam.
      // Mantido ativo intencionalmente para documentar o bug (não forçar workaround) — ver regra
      // "Isolamento de Causa Raiz" do AGENTS.md.
      AtendimentosPage.elements.marcacaoAtivaBusca()
        .should('have.length', 1)
        .and('be.visible')
        .and('contain.text', 'Olá');
    });

    it('9.3 deve avançar para a próxima ocorrência, atualizar o contador e rolar até a mensagem seguinte ao clicar em "Próximo resultado" (PR #172)', () => {
      prepararCenarioNavegacaoBusca();

      AtendimentosPage.abrirBuscaConversa();
      AtendimentosPage.pesquisarNaConversa('Olá');
      AtendimentosPage.elements.contadorBuscaConversa().should('contain.text', '1 / 2');

      // Act: avança para a 2ª ocorrência — antes da PR #172, o scrollIntoView mirava o wrapper
      // .messageAnchor (display:contents, sem caixa própria) e nada acontecia na tela
      AtendimentosPage.irParaProximaOcorrenciaBusca();

      // Assert: contador avança e o destaque ativo migra para a mensagem mais recente, visível na tela
      AtendimentosPage.elements.contadorBuscaConversa().should('contain.text', '2 / 2');
      AtendimentosPage.elements.marcacaoAtivaBusca()
        .should('have.length', 1)
        .and('be.visible')
        .closest('[data-message-id]')
        .should('contain.text', 'Olá novamente');
    });

    it('9.4 deve voltar para a ocorrência anterior, atualizar o contador e rolar até a mensagem anterior ao clicar em "Resultado anterior" (PR #172)', () => {
      prepararCenarioNavegacaoBusca();

      AtendimentosPage.abrirBuscaConversa();
      AtendimentosPage.pesquisarNaConversa('Olá');
      AtendimentosPage.irParaProximaOcorrenciaBusca();
      AtendimentosPage.elements.contadorBuscaConversa().should('contain.text', '2 / 2');

      // Act: volta para a 1ª ocorrência
      AtendimentosPage.irParaOcorrenciaAnteriorBusca();

      // Assert: contador retorna e o destaque ativo migra de volta para a mensagem mais antiga
      // BUG REAL CONFIRMADO (22/09/2026): igual ao teste acima — "Anterior" atualiza contador e
      // marca a mensagem certa no DOM, mas não rola até ela (timeout de 20s não resolve, não é
      // lentidão). Mantido ativo intencionalmente para documentar a assimetria de rolagem.
      AtendimentosPage.elements.contadorBuscaConversa().should('contain.text', '1 / 2');
      AtendimentosPage.elements.marcacaoAtivaBusca(20000)
        .should('have.length', 1)
        .and('be.visible')
        .closest('[data-message-id]')
        .should('contain.text', 'Olá, tudo bem');
    });

  });

  // -------------------------------------------------------------
  // 10. PRESERVAÇÃO DE LEGENDA EM ANEXOS DE MÍDIA NO PAINEL DO ATENDENTE (ISSUE #146 / PR #216)
  // -------------------------------------------------------------

  context('10. Preservação de Legenda em Anexos de Mídia no Painel do Atendente (Issue #146 / PR #216)', () => {

    // Blindagem de escopo hermético forçado (100% Mockado) — as legendas usadas são sintéticas
    // e não garantidas de forma determinística na API real (ver AGENTS.md §1 "Gatilho Proativo de Blindagem")
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

    const ATTENDANCE_ID = 26080077; // reaproveita o atendimento sintético hermético canônico (mesmo do context 30/PR #306)
    const IMAGEM_MINIMA = 'cypress/fixtures/5.atendimentos/anexos/normal/Anexo de teste jpg.jpg';
    const VIDEO_MINIMO = 'cypress/fixtures/5.atendimentos/anexos/normal/Anexo de teste mp4.mp4';
    // Data-URI inline (1x1 JPEG) para o anexo inbound — nunca uma URL real, para não disparar
    // um fetch de imagem não interceptado e quebrar o contrato "100% mockado" (ver AGENTS.md §3.3 [R-MOCK]).
    const IMAGEM_INLINE_BASE64 =
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';

    // Helper de preparação (padrão dos contexts 26/31/32): abre o chat de um atendimento
    // sintético com janela ativa, pronto para anexar mídia via compositor.
    const prepararChatComJanelaAtiva = () => {
      AtendimentosMocks.interceptMockDetalheJanelaAberta(ATTENDANCE_ID);
      AtendimentosMocks.interceptSendMediaMessageApi('*');
      AtendimentosPage.forcarFiltroStatus('waiting');
      cy.wait('@getAttendancesList');
      AtendimentosPage.elements.cardAtendimentoPorId(ATTENDANCE_ID).should('be.visible').click();
      cy.wait('@getAttendanceDetail');
    };

    it('10.1 deve preservar a legenda "teste anexo" no balão do próprio atendente ao enviar uma imagem com legenda (repro exata, Issue #146)', () => {
      // 1. Arrange: abre chat com janela ativa
      prepararChatComJanelaAtiva();

      // 2. Act: anexa a imagem com a legenda exata reportada na issue
      AtendimentosPage.anexarArquivo(IMAGEM_MINIMA, 'teste anexo');
      cy.wait('@sendChatMediaMessage');

      // 3. Assert: a bolha otimista do próprio atendente renderiza a imagem E a legenda
      // (a bolha é montada localmente com o texto digitado antes mesmo da resposta do POST voltar,
      // por isso o conteúdo do mock de resposta não precisa bater com a legenda digitada)
      cy.get('article[class*="_bubbleRowEnd_"]')
        .last()
        .scrollIntoView({ duration: 300 })
        .within(() => {
          cy.get('button[data-testid^="attachment-image-"], img[class*="_attachmentImage_"]').should('be.visible');
        });
      cy.get('article[class*="_bubbleRowEnd_"]').last().should('contain.text', 'teste anexo');
    });

    it('10.2 deve preservar legendas curtas alfanuméricas anteriormente removidas pelo guard de base64 (varredura de regressão, PR #216)', () => {
      // 1. Arrange: abre chat com janela ativa
      prepararChatComJanelaAtiva();

      // 2. Act + Assert: reenvia a mesma imagem com cada legenda em sequência — 6 exemplos citados
      // como quebrados pelo guard antigo (alfanumérico + comprimento múltiplo de 4) e 2 citados
      // como controle (já funcionavam antes da correção). Não há precedente de loop com comandos
      // cy ao vivo nesta suíte (os `for` existentes só constroem arrays de mock) — usado aqui de
      // forma simples (forEach), com asserção incondicional a cada iteração (nunca dentro de `if`,
      // ver AGENTS.md §6A "Proibição de Asserções Condicionais Ocas").
      const legendas = ['Ouro', 'Receita', 'Nota', 'foto', 'urgente', 'Bom dia', 'teste', 'Segue'];
      legendas.forEach((legenda, indice) => {
        cy.log(`📎 [Legenda ${indice + 1}/${legendas.length}]: "${legenda}"`);
        AtendimentosPage.anexarArquivo(IMAGEM_MINIMA, legenda);
        cy.wait('@sendChatMediaMessage');
        cy.get('article[class*="_bubbleRowEnd_"]').last().should('contain.text', legenda);
      });
    });

    it('10.3 deve preservar a legenda no balão de vídeo enviado pelo atendente (PR #216)', () => {
      // 1. Arrange: abre chat com janela ativa
      prepararChatComJanelaAtiva();

      // 2. Act: anexa um vídeo com legenda curta (cobre o outro tipo de mídia citado na correção,
      // já validada isoladamente para imagem nos testes acima)
      AtendimentosPage.anexarArquivo(VIDEO_MINIMO, 'Bom dia');
      cy.wait('@sendChatMediaMessage');

      // 3. Assert: bolha de vídeo renderiza e contém a legenda
      // Nota: não existe testid dedicado para o player de vídeo no Page Object/inventário;
      // validar visualmente no cypress open durante a homologação se a asserção genérica de
      // visibilidade da bolha é suficiente ou se precisa de um seletor mais específico.
      cy.get('article[class*="_bubbleRowEnd_"]').last().scrollIntoView({ duration: 300 }).should('be.visible');
      cy.get('article[class*="_bubbleRowEnd_"]').last().should('contain.text', 'Bom dia');
    });

    it('10.4 deve exibir a legenda de uma imagem recebida do cliente em vez de omiti-la (não-regressão, direção inbound, Issue #146)', () => {
      // 1. Arrange: abre chat com janela ativa, mas sobrescreve a listagem de mensagens (registrada
      // DEPOIS de interceptMockDetalheJanelaAberta, então vence) com uma mensagem inbound de imagem
      // cuja legenda cairia no guard antigo. A rota de mensagens é estática (sem refetch pós-envio,
      // ver AGENTS.md), então a mensagem precisa estar pré-populada ANTES de abrir o chat.
      AtendimentosMocks.interceptMockDetalheJanelaAberta(ATTENDANCE_ID);
      AtendimentosMocks.interceptMessagesListApi(ATTENDANCE_ID, {
        data: [{
          id: 9001,
          created_at: new Date().toISOString(),
          origin: 'customer',
          employee_code: null,
          transfer_type: 0,
          content_type: 'image',
          message_status: 'ready',
          content: 'Ouro',
          attachment: {
            url: IMAGEM_INLINE_BASE64,
            file_name: 'ouro.jpg',
            file_size: 123,
            content_type: 'image/jpeg'
          }
        }],
        pagination: { page: 1, per_page: 20, total: 1, total_pages: 1, has_next: false, has_previous: false }
      });
      AtendimentosPage.forcarFiltroStatus('waiting');
      cy.wait('@getAttendancesList');
      // Ponto de sincronização real (sem espera mágica, ver AGENTS.md §3): garante que a fila já
      // renderizou o item único do mock customizado antes de clicar. Sem isso, o clique pode
      // ocorrer no exato instante em que o React troca o mock genérico do beforeEach pelo item
      // único, deixando o nó do card "solto" entre a asserção e o clique (erro "subject is no
      // longer attached to the DOM") — reproduzido no Chrome, não no Electron.
      AtendimentosPage.elements.cardsAtendimento().should('have.length', 1);
      // Abertura determinística por data-testid (AGENTS.md §6B) em vez de .first(): evita clicar
      // num card do mock genérico global do beforeEach durante a janela de corrida entre o
      // intercept específico do ATTENDANCE_ID e a re-renderização da fila.
      AtendimentosPage.abrirAtendimentoPorId(ATTENDANCE_ID);
      cy.wait('@getAttendanceDetail');
      cy.wait('@getAttendanceMessages');

      // 2. Assert: a legenda "Ouro" aparece no histórico do chat, não é omitida
      // Nota: sem classe de bolha inbound dedicada confirmada no Page Object/inventário; o seletor
      // genérico abaixo (usado hoje em asserções que cobrem ambas as direções) deve ser confirmado
      // visualmente no cypress open durante a homologação.
      cy.get('article[class*="_bubbleRow_"]:not([class*="_bubbleRowEnd_"])').last().should('contain.text', 'Ouro');
    });

    // Nota: legenda em anexo de ÁUDIO enviado pelo painel não é alcançável pela UI atual —
    // AtendimentosPage.anexarArquivo() pula a digitação da legenda quando a seleção do arquivo
    // aciona a barra de envio de áudio (button[data-testid="button-send-audio"]), o que ocorre
    // para qualquer arquivo de áudio anexado, não só gravação ao vivo. Cenário omitido
    // intencionalmente, no mesmo padrão já usado no context 30 (PR #306) para um caso inalcançável.

    // --- Título e legenda do card de documento (Issue front#491, PR #512) ---
    // Confirmado ao vivo nesta sessão (2026-10-06, atendimento real 261000014, mensagem #4857098):
    // o card de documento já renderiza `attachment.filename` como título (base + extensão em spans
    // separados, nome completo no atributo `title`) e a legenda (`content`) como `<p class="_bubbleText_">`
    // irmão do botão do documento — estrutura real: `<span class="_documentName_..." title="...">
    // <span class="_documentNameBase_...">base</span><span class="_documentNameExtension_...">.ext</span></span>`.
    // Os testes abaixo fixam esse contrato via payload sintético (não é possível produzir de forma
    // determinística um nome de arquivo/legenda específicos — nem truncamento — contra a API real).
    const DOCUMENTO_MINIMO = 'cypress/fixtures/5.atendimentos/anexos/normal/Anexo de teste doc.doc';

    it('10.5 deve omitir a legenda do documento quando content vier igual ao filename (dedup, Issue front#491)', () => {
      AtendimentosMocks.interceptMockDetalheJanelaAberta(ATTENDANCE_ID);
      AtendimentosMocks.interceptMessagesListApi(ATTENDANCE_ID, {
        data: [{
          id: 9002,
          created_at: new Date().toISOString(),
          origin: 'employee',
          employee_code: '122',
          transfer_type: 0,
          content_type: 'document',
          message_status: 'sent',
          content: 'relatorio_front491.pdf',
          attachment: {
            url: 'data:application/pdf;base64,JVBERi0xLjQK',
            filename: 'relatorio_front491.pdf',
            mime_type: 'application/pdf',
            content_type: 'document'
          }
        }],
        pagination: { page: 1, per_page: 20, total: 1, total_pages: 1, has_next: false, has_previous: false }
      });
      AtendimentosPage.forcarFiltroStatus('waiting');
      cy.wait('@getAttendancesList');
      AtendimentosPage.elements.cardsAtendimento().should('have.length', 1);
      AtendimentosPage.abrirAtendimentoPorId(ATTENDANCE_ID);
      cy.wait('@getAttendanceDetail');
      cy.wait('@getAttendanceMessages');

      cy.get('[data-testid="attachment-pdf-9002"]')
        .should('have.attr', 'aria-label', 'Abrir documento relatorio_front491.pdf')
        .parents('[class*="_bubble_"]').first()
        .find('p[class*="_bubbleText_"]').should('not.exist');
    });

    it('10.6 deve exibir o nome completo no atributo title do card, com a extensão num span próprio (Issue front#491, PR #512)', () => {
      const nomeLongo = 'relatorio_mensal_completo_de_vendas_da_farmacia_outubro_2026';
      AtendimentosMocks.interceptMockDetalheJanelaAberta(ATTENDANCE_ID);
      AtendimentosMocks.interceptMessagesListApi(ATTENDANCE_ID, {
        data: [{
          id: 9003,
          created_at: new Date().toISOString(),
          origin: 'employee',
          employee_code: '122',
          transfer_type: 0,
          content_type: 'document',
          message_status: 'sent',
          content: 'Segue o relatório completo',
          attachment: {
            url: 'data:application/pdf;base64,JVBERi0xLjQK',
            filename: `${nomeLongo}.pdf`,
            mime_type: 'application/pdf',
            content_type: 'document'
          }
        }],
        pagination: { page: 1, per_page: 20, total: 1, total_pages: 1, has_next: false, has_previous: false }
      });
      AtendimentosPage.forcarFiltroStatus('waiting');
      cy.wait('@getAttendancesList');
      AtendimentosPage.elements.cardsAtendimento().should('have.length', 1);
      AtendimentosPage.abrirAtendimentoPorId(ATTENDANCE_ID);
      cy.wait('@getAttendanceDetail');
      cy.wait('@getAttendanceMessages');

      cy.get('[data-testid="attachment-pdf-9003"] [class*="_documentName_"]')
        .should('have.attr', 'title', `${nomeLongo}.pdf`)
        .find('[class*="_documentNameExtension_"]').should('have.text', '.pdf');
      cy.get('article[class*="_bubbleRowEnd_"]').last().should('contain.text', 'Segue o relatório completo');
    });

    // --- Gaps identificados na validação da Issue front#336 (2026-10-08), sem cobertura até então ---

    it('10.7 não deve renderizar elemento de legenda quando o documento não tiver content (CA-F04, Issue front#336)', () => {
      AtendimentosMocks.interceptMockDetalheJanelaAberta(ATTENDANCE_ID);
      AtendimentosMocks.interceptMessagesListApi(ATTENDANCE_ID, {
        data: [{
          id: 9004,
          created_at: new Date().toISOString(),
          origin: 'employee',
          employee_code: '122',
          transfer_type: 0,
          content_type: 'document',
          message_status: 'sent',
          content: null,
          attachment: {
            url: 'data:application/pdf;base64,JVBERi0xLjQK',
            filename: 'contrato_sem_legenda.pdf',
            mime_type: 'application/pdf',
            content_type: 'document'
          }
        }],
        pagination: { page: 1, per_page: 20, total: 1, total_pages: 1, has_next: false, has_previous: false }
      });
      AtendimentosPage.forcarFiltroStatus('waiting');
      cy.wait('@getAttendancesList');
      AtendimentosPage.elements.cardsAtendimento().should('have.length', 1);
      AtendimentosPage.abrirAtendimentoPorId(ATTENDANCE_ID);
      cy.wait('@getAttendanceDetail');
      cy.wait('@getAttendanceMessages');

      cy.get('[data-testid="attachment-pdf-9004"]')
        .should('have.attr', 'aria-label', 'Abrir documento contrato_sem_legenda.pdf')
        .parents('[class*="_bubble_"]').first()
        .find('p[class*="_bubbleText_"]').should('not.exist');
    });

    it('10.8 deve cair no título genérico "Documento" quando o backend não enviar attachment.filename, mantendo a legenda visível separadamente (CA-F06, Issue front#336)', () => {
      // Achado real (2026-10-08): o texto da issue promete um 2º degrau de fallback pro título
      // (filename → legenda → segmento da URL → "Documento"), mas a implementação real, confirmada
      // nesta rodada, não repassa `content` pro título quando `filename` falta — título cai direto
      // em "Documento" (resolveDocumentLabel só recebe `filename` hoje) e a legenda continua
      // renderizando em componente próprio, sempre separado (R3), independente do título ter
      // resolvido ou não. Teste fixa o comportamento real, não a promessa literal do texto da issue.
      AtendimentosMocks.interceptMockDetalheJanelaAberta(ATTENDANCE_ID);
      AtendimentosMocks.interceptMessagesListApi(ATTENDANCE_ID, {
        data: [{
          id: 9005,
          created_at: new Date().toISOString(),
          origin: 'employee',
          employee_code: '122',
          transfer_type: 0,
          content_type: 'document',
          message_status: 'sent',
          content: 'Contrato assinado',
          attachment: {
            url: 'data:application/pdf;base64,JVBERi0xLjQK',
            // sem `filename` — simula backend ainda não atualizado para este contrato (CA-F06)
            mime_type: 'application/pdf',
            content_type: 'document'
          }
        }],
        pagination: { page: 1, per_page: 20, total: 1, total_pages: 1, has_next: false, has_previous: false }
      });
      AtendimentosPage.forcarFiltroStatus('waiting');
      cy.wait('@getAttendancesList');
      AtendimentosPage.elements.cardsAtendimento().should('have.length', 1);
      AtendimentosPage.abrirAtendimentoPorId(ATTENDANCE_ID);
      cy.wait('@getAttendanceDetail');
      cy.wait('@getAttendanceMessages');

      cy.get('[data-testid="attachment-pdf-9005"]')
        .should('have.attr', 'aria-label', 'Abrir documento Documento')
        .parents('[class*="_bubble_"]').first()
        .find('p[class*="_bubbleText_"]').should('be.visible').and('contain.text', 'Contrato assinado');
    });

    it('10.9 deve realçar o termo buscado também na legenda do documento (CA-F05, Issue front#336)', () => {
      AtendimentosMocks.interceptMockDetalheJanelaAberta(ATTENDANCE_ID);
      AtendimentosMocks.interceptMessagesListApi(ATTENDANCE_ID, {
        data: [{
          id: 9006,
          created_at: new Date().toISOString(),
          origin: 'employee',
          employee_code: '122',
          transfer_type: 0,
          content_type: 'document',
          message_status: 'sent',
          content: 'Segue o orcamento revisado em anexo',
          attachment: {
            url: 'data:application/pdf;base64,JVBERi0xLjQK',
            filename: 'orcamento_revisado.pdf',
            mime_type: 'application/pdf',
            content_type: 'document'
          }
        }],
        pagination: { page: 1, per_page: 20, total: 1, total_pages: 1, has_next: false, has_previous: false }
      });
      AtendimentosPage.forcarFiltroStatus('waiting');
      cy.wait('@getAttendancesList');
      AtendimentosPage.elements.cardsAtendimento().should('have.length', 1);
      AtendimentosPage.abrirAtendimentoPorId(ATTENDANCE_ID);
      cy.wait('@getAttendanceDetail');
      cy.wait('@getAttendanceMessages');

      const termoBusca = 'revisado';
      AtendimentosPage.abrirBuscaConversa();
      AtendimentosPage.pesquisarNaConversa(termoBusca);

      cy.get('[data-testid="attachment-pdf-9006"]')
        .parents('[class*="_bubble_"]').first()
        .find('p[class*="_bubbleText_"]')
        .find('mark').should('be.visible').and('contain.text', termoBusca);

      AtendimentosPage.fecharBuscaConversa();
    });

    it('10.10 deve usar o content como título do documento recebido do cliente, nunca o filename sintetizado pelo backend (CA-F08, achado do 3º comentário da Issue front#336, decisão da PR #491)', () => {
      AtendimentosMocks.interceptMockDetalheJanelaAberta(ATTENDANCE_ID);
      AtendimentosMocks.interceptMessagesListApi(ATTENDANCE_ID, {
        data: [{
          id: 9007,
          created_at: new Date().toISOString(),
          origin: 'customer',
          employee_code: null,
          transfer_type: 0,
          content_type: 'document',
          message_status: 'ready',
          content: 'nome_real_informado_pelo_cliente.pdf',
          attachment: {
            url: 'data:application/pdf;base64,JVBERi0xLjQK',
            filename: 'documento_9007.pdf',
            mime_type: 'application/pdf',
            content_type: 'document'
          }
        }],
        pagination: { page: 1, per_page: 20, total: 1, total_pages: 1, has_next: false, has_previous: false }
      });
      AtendimentosPage.forcarFiltroStatus('waiting');
      cy.wait('@getAttendancesList');
      AtendimentosPage.elements.cardsAtendimento().should('have.length', 1);
      AtendimentosPage.abrirAtendimentoPorId(ATTENDANCE_ID);
      cy.wait('@getAttendanceDetail');
      cy.wait('@getAttendanceMessages');

      cy.get('[data-testid="attachment-pdf-9007"]')
        .should('have.attr', 'aria-label', 'Abrir documento nome_real_informado_pelo_cliente.pdf');
    });

  });

  // -------------------------------------------------------------
  // 11. PERSONALIZAÇÃO DO ORÇAMENTO (ISSUE #449, PR #451)
  // -------------------------------------------------------------

  context('11. Personalização do Orçamento (Issue #449, PR #451)', () => {
    let originalUseMocksState;

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
    });

    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    const capabilitiesComPersonalizacao = {
      can_access_attendance_module: true,
      can_create_attendance: true,
      can_view_pending_attendance: true,
      can_view_occupied_attendance: true,
      can_create_customer_without_gender: false,
      can_list_group_agents: true,
      can_change_attendant_status: true,
      can_transfer_attendance: true,
      can_change_status: true,
      can_customize_budget: true
    };

    const CAPA_IDEAL = 'cypress/fixtures/5.atendimentos/orcamentos/capa-ideal-1200x450.png';
    const CAPA_PEQUENA = 'cypress/fixtures/5.atendimentos/orcamentos/capa-pequena-400x150.png';
    const CAPA_GRANDE = 'cypress/fixtures/5.atendimentos/orcamentos/capa-acima-5mb.png';
    const FORMATO_INVALIDO = 'cypress/fixtures/5.atendimentos/orcamentos/formato-nao-suportado.gif';

    // Converte #RRGGBB no formato "rgb(r, g, b)" devolvido por getComputedStyle, para comparar com
    // o resultado de .invoke('css', 'backgroundColor') sem depender de como a cor chega ao DOM
    // (CSS var ou style inline) - só o valor computado final importa.
    function hexParaRgb(hex) {
      const n = parseInt(hex.replace('#', ''), 16);
      return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
    }

    function abrirAtendimentoEGavetaOrcamentos() {
      AtendimentosPage.elements.tituloAtendimentos().should('be.visible');
      AtendimentosPage.elements.cardsAtendimento().first().click();
      AtendimentosPage.abrirGavetaOrcamentos();
    }

    beforeEach(() => {
      AtendimentosMocks.interceptAttendanceDetailApi('*', {
        ...AtendimentosMocks.mockAttendanceDetailData,
        summaries: {
          quotes: { count: 1, total_amount: 167.79 },
          payment_links: { count: 0, pending_confirmation_count: 0 }
        }
      });
      AtendimentosMocks.interceptBudgetsApi('*');
      AtendimentosMocks.interceptBudgetCustomizationApi();
      AtendimentosMocks.interceptAttendanceCapabilitiesApi({ capabilities: capabilitiesComPersonalizacao });

      // Capability de loja é buscada no boot - reload força o refetch sob o novo mock, mesmo padrão
      // do drawer "Dados do Cliente" (AGENTS.md [R-SEL] "client-capabilities... buscados no boot").
      cy.reload();
      abrirAtendimentoEGavetaOrcamentos();
    });

    it('11.1 não deve exibir o ícone de personalização sem a capability can_customize_budget (AC1)', () => {
      AtendimentosMocks.interceptAttendanceCapabilitiesApi({
        capabilities: { ...capabilitiesComPersonalizacao, can_customize_budget: false }
      });
      cy.reload();
      abrirAtendimentoEGavetaOrcamentos();

      AtendimentosPage.elements.drawerOrcamentos().should('be.visible');
      AtendimentosPage.elements.btnCustomizeBudget().should('not.exist');
    });

    it('11.2 deve exibir o ícone de personalização com a dica "Personalizar orçamentos" quando a capability é concedida', () => {
      AtendimentosPage.elements.btnCustomizeBudget().should('be.visible')
        .and('have.attr', 'aria-label', 'Personalizar orçamentos');
    });

    it('11.3 deve abrir a modal de personalização com o botão Salvar desabilitado', () => {
      AtendimentosPage.abrirModalPersonalizacaoOrcamento();

      AtendimentosPage.elements.btnSaveBudgetCustomization().should('be.visible').and('be.disabled');
    });

    it('11.4 deve atualizar a prévia em tempo real ao mudar a cor e habilitar o botão Salvar', () => {
      AtendimentosPage.abrirModalPersonalizacaoOrcamento();

      AtendimentosPage.digitarCorHexOrcamento('#AA00AA');

      AtendimentosPage.elements.btnSaveBudgetCustomization().should('not.be.disabled');
      cy.get('[class*="_sendBudgetQuotePreviewHero_"]')
        .should('have.css', 'backgroundColor', hexParaRgb('#AA00AA'));
    });

    it('11.5 deve desabilitar o botão Salvar ao digitar de volta a cor salva no servidor', () => {
      AtendimentosPage.abrirModalPersonalizacaoOrcamento();

      AtendimentosPage.digitarCorHexOrcamento('#AA00AA');
      AtendimentosPage.elements.btnSaveBudgetCustomization().should('not.be.disabled');

      AtendimentosPage.digitarCorHexOrcamento('#337BA8');
      AtendimentosPage.elements.btnSaveBudgetCustomization().should('be.disabled');
    });

    it('11.6 não deve aplicar a prévia nem habilitar Salvar com um HEX incompleto', () => {
      AtendimentosPage.abrirModalPersonalizacaoOrcamento();

      AtendimentosPage.digitarCorHexOrcamento('#12');

      AtendimentosPage.elements.btnSaveBudgetCustomization().should('be.disabled');
      cy.get('[class*="_sendBudgetQuotePreviewHero_"]')
        .should('have.css', 'backgroundColor', hexParaRgb('#337BA8'));
    });

    it('11.7 deve normalizar um HEX digitado com espaço e minúsculas para maiúsculas', () => {
      AtendimentosPage.abrirModalPersonalizacaoOrcamento();

      AtendimentosPage.digitarCorHexOrcamento(' #1a2b3c');

      AtendimentosPage.elements.inputBudgetAccentHex().should('have.value', '#1A2B3C');
    });

    it('11.8 deve ajustar o contraste do texto para escuro ao escolher uma cor clara', () => {
      AtendimentosPage.abrirModalPersonalizacaoOrcamento();

      AtendimentosPage.digitarCorHexOrcamento('#FFFF00');

      // Contraste é resolvido pelo próprio card (luminância da cor escolhida) - só valida que o
      // texto não fica branco-sobre-amarelo (regra de acessibilidade da issue, sem depender do
      // nome exato da classe de tema escuro/claro do card).
      cy.get('[class*="_sendBudgetQuotePreviewBrandTitle_"]')
        .should('have.css', 'color')
        .and('not.equal', 'rgb(255, 255, 255)');
    });

    it('11.9 deve substituir o cabeçalho da prévia ao enviar uma capa ideal (1200x450), sem aviso', () => {
      AtendimentosPage.abrirModalPersonalizacaoOrcamento();

      AtendimentosPage.enviarCapaOrcamento(CAPA_IDEAL);

      AtendimentosPage.elements.btnBudgetCoverUpload().should('contain.text', 'Substituir imagem');
      AtendimentosPage.elements.btnBudgetCoverRemove().should('be.visible');
      AtendimentosPage.elements.nomeArquivoCapaOrcamento().should('contain.text', 'capa-ideal-1200x450.png');
      AtendimentosPage.elements.avisoImagemPequenaOrcamento().should('not.exist');
      cy.get('[class*="_sendBudgetQuotePreviewCover_"]').should('be.visible');
    });

    it('11.10 deve exibir o aviso de imagem pequena ao enviar uma capa abaixo do ideal, sem bloquear', () => {
      AtendimentosPage.abrirModalPersonalizacaoOrcamento();

      AtendimentosPage.enviarCapaOrcamento(CAPA_PEQUENA);

      AtendimentosPage.elements.avisoImagemPequenaOrcamento().should('be.visible');
      AtendimentosPage.elements.btnSaveBudgetCustomization().should('not.be.disabled');
    });

    it('11.11 deve recusar formato não suportado e depois tamanho acima de 5 MB, sem alterar a capa', () => {
      AtendimentosPage.abrirModalPersonalizacaoOrcamento();

      // Act 1: .gif - formato fora de PNG/JPEG/WebP
      AtendimentosPage.enviarCapaOrcamento(FORMATO_INVALIDO);
      cy.contains('Formato não suportado. Use PNG, JPG ou WebP.').should('be.visible');
      AtendimentosPage.elements.btnBudgetCoverRemove().should('not.exist');

      // Act 2: PNG válido, porém acima de 5 MB
      AtendimentosPage.enviarCapaOrcamento(CAPA_GRANDE);
      cy.contains('A imagem passa de 5 MB.').should('be.visible');
      AtendimentosPage.elements.btnBudgetCoverRemove().should('not.exist');
    });

    it('11.12 deve fechar só a modal ao pressionar Esc, mantendo a gaveta de Orçamentos aberta', () => {
      AtendimentosPage.abrirModalPersonalizacaoOrcamento();

      cy.get('body').type('{esc}');

      AtendimentosPage.elements.modalBudgetCustomization().should('not.exist');
      AtendimentosPage.elements.drawerOrcamentos().should('be.visible');
    });

    it('11.13 deve salvar cor e capa via PUT multipart e fechar a modal', () => {
      // cy.intercept não serializa multipart/form-data (AGENTS.md [R-MOCK]) - a asserção valida o
      // efeito (PUT disparado + resposta relida refletida na UI), não os campos brutos do FormData.
      //
      // Achado 2026-09-29 (AGENTS.md [R-DIAG], reproduzido 2x): o toast de sucesso
      // ("Personalização do orçamento salva.") é filho da própria modal, não um toast global -
      // fecha junto com ela. `last-failure-dom.html` das 2 rodadas confirma que, no instante em que
      // a asserção roda após `cy.wait`, só resta o botão-gatilho no DOM - modal e toast já sumiram
      // juntos, sem janela observável para o Cypress capturar. A PR #451 descreve "a modal fecha e
      // aparece o toast" como se fossem sequenciais/persistentes; o comportamento real parece
      // acoplado. Não é testável de forma confiável sem um teste próprio de timing (fora de escopo
      // aqui) - a asserção abaixo valida só o que é observável e determinístico: o PUT dispara com
      // 200 e a modal fecha (efeito verificável do salvamento).
      AtendimentosMocks.interceptUpdateBudgetCustomizationApi({
        accent_color: '#AA00AA',
        cover_url: '/budget-customization/cover?store_id=1&v=2',
        is_default: false
      });
      AtendimentosMocks.interceptBudgetCoverImageApi();

      AtendimentosPage.abrirModalPersonalizacaoOrcamento();
      AtendimentosPage.digitarCorHexOrcamento('#AA00AA');
      AtendimentosPage.enviarCapaOrcamento(CAPA_IDEAL);
      AtendimentosPage.elements.btnSaveBudgetCustomization().click();

      cy.wait('@putBudgetCustomization').its('response.statusCode').should('eq', 200);
      AtendimentosPage.elements.modalBudgetCustomization().should('not.exist');
    });

    it('11.14 deve aplicar a cor e a capa personalizadas da loja na prévia do orçamento enviado ao cliente (AC3)', () => {
      AtendimentosMocks.interceptBudgetCustomizationApi({
        accent_color: '#AA00AA',
        cover_url: '/budget-customization/cover?store_id=1&v=2',
        is_default: false
      });
      AtendimentosMocks.interceptBudgetCoverImageApi();
      cy.reload();
      abrirAtendimentoEGavetaOrcamentos();

      AtendimentosPage.abrirModalEnviarOrcamento();

      // Com capa o front renderiza a Cover no lugar do Hero (`coverSrc ? Cover : Hero`): afirmar os dois juntos só passava por corrida,
      // flagrando o Hero transitório antes de a capa (data: URI buscada com Bearer) chegar. A cor da loja vai pelas CSS vars do card.
      cy.get('[data-testid="budget-quote-preview-card"]').should('have.attr', 'style').and('include', '--ph-brand: #AA00AA');
      cy.get('[class*="_sendBudgetQuotePreviewCover_"]').should('be.visible').and('have.attr', 'src').and('match', /^data:image\/png/);
      cy.get('[class*="_sendBudgetQuotePreviewHero_"]').should('not.exist');
    });

    it('11.15 deve voltar ao cabeçalho padrão mantendo a cor da loja ao remover a capa e salvar (não reseta a cor - nota da PR #451)', () => {
      AtendimentosMocks.interceptBudgetCustomizationApi({
        accent_color: '#AA00AA',
        cover_url: '/budget-customization/cover?store_id=1&v=2',
        is_default: false
      });
      AtendimentosMocks.interceptBudgetCoverImageApi();
      AtendimentosMocks.interceptUpdateBudgetCustomizationApi({
        accent_color: '#AA00AA',
        cover_url: null,
        is_default: false
      });
      cy.reload();
      abrirAtendimentoEGavetaOrcamentos();

      AtendimentosPage.abrirModalPersonalizacaoOrcamento();
      AtendimentosPage.elements.btnBudgetCoverRemove().click();
      AtendimentosPage.elements.btnSaveBudgetCustomization().click();
      cy.wait('@putBudgetCustomization');

      AtendimentosPage.abrirModalEnviarOrcamento();
      cy.get('[class*="_sendBudgetQuotePreviewCover_"]').should('not.exist');
      cy.get('[class*="_sendBudgetQuotePreviewHero_"]')
        .should('have.css', 'backgroundColor', hexParaRgb('#AA00AA'));
    });

    it('11.16 deve enviar o orçamento no visual padrão #337BA8 quando a loja não tem personalização (AC4)', () => {
      // GET padrão do beforeEach já é is_default:true, accent_color #337BA8, cover_url null
      AtendimentosPage.abrirModalEnviarOrcamento();

      cy.get('[class*="_sendBudgetQuotePreviewCover_"]').should('not.exist');
      cy.get('[class*="_sendBudgetQuotePreviewHero_"]')
        .should('have.css', 'backgroundColor', hexParaRgb('#337BA8'));
    });

    it('11.17 deve manter a modal aberta e exibir a mensagem da API ao receber 422 do PUT', () => {
      AtendimentosMocks.interceptUpdateBudgetCustomizationApi({ message: 'Cor inválida.' }, 422);

      AtendimentosPage.abrirModalPersonalizacaoOrcamento();
      AtendimentosPage.digitarCorHexOrcamento('#AA00AA');
      AtendimentosPage.elements.btnSaveBudgetCustomization().click();

      cy.wait('@putBudgetCustomization').its('response.statusCode').should('eq', 422);
      AtendimentosPage.elements.modalBudgetCustomization().should('be.visible');
      cy.contains('Cor inválida.').should('be.visible');
    });

    it('11.18 não deve travar o envio do orçamento quando a capa responde 503 (banco de imagens fora do ar)', () => {
      AtendimentosMocks.interceptBudgetCustomizationApi({
        accent_color: '#AA00AA',
        cover_url: '/budget-customization/cover?store_id=1&v=2',
        is_default: false
      });
      AtendimentosMocks.interceptBudgetCoverImageApi(503);
      cy.reload();
      abrirAtendimentoEGavetaOrcamentos();

      AtendimentosPage.abrirModalEnviarOrcamento();

      // O card segue sem capa (não trava o envio) - a cor da loja ainda é aplicada
      cy.get('[class*="_sendBudgetQuotePreviewCover_"]').should('not.exist');
      AtendimentosPage.elements.btnEnviarParaOChatModal().should('be.visible').and('not.be.disabled');
    });

  });

  // -------------------------------------------------------------
  // 22. MODAL "ENVIAR LINK DE PAGAMENTO": TOTAL SÓ DO QUE PODE SER COBRADO E ERRO DO ENVIO POR CÓDIGO (FRONT#311, FRONT#332)
  // -------------------------------------------------------------
  context('22. Modal "Enviar Link de Pagamento": Valor Total só dos Orçamentos Cobráveis e Erro do Envio Classificado pelo Código (Issue front#311, front#332)', () => {

    // 100% mockado ([R-BLIND]): atendimento com janela aberta (`interceptMockDetalheJanelaAberta`) e orçamentos sintéticos todos marcados para o link.
    // A modal só abre com `GET /payment-configs` no formato real `{ items }`: o schema do front é `.strict()` e a chave `total` que os mocks mandavam até 2026-11-06
    // derrubava a modal em "Não foi possível enviar o link de pagamento" (o "fatalError" do ROADMAP.md P1-31). O erro do envio só se exercita mockado (enviar de verdade cobra).
    const ATENDIMENTO = 26080077;
    const MSG_INCERTA = 'Não foi possível concluir o envio. Verifique a lista de links antes de reenviar.';
    const MSG_GENERICA = 'Não foi possível enviar o link de pagamento';
    const MOTIVO_PROVEDOR = 'Cartão recusado pelo emissor: limite insuficiente.';
    let originalUseMocksState;
    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
    });
    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    const orcamento = (code, amount, financialId = null) => ({
      id: code, code, formula_number: 1, type: 1, status: 0, amount, discount: 0, amount_with_discount: amount,
      selected_for_payment_link: true, covered_by_approved_link: false, financial_id: financialId, shipping_label: 'Retirada',
      quantity: 30, pharmaceutical_form: 'CAPSULAS', label_text: `Fórmula sintética ${code}`,
      products: [{ line_number: 1, quantity: 250, unit: 'mg', product_name: `Produto ${code}`, amount }],
    });
    const abrirModalComOrcamentos = (orcamentos) => {
      AtendimentosMocks.interceptMockDetalheJanelaAberta(ATENDIMENTO);
      AtendimentosMocks.interceptBudgetsApi(ATENDIMENTO, {
        data: orcamentos,
        totals: { budget_total: orcamentos.reduce((s, o) => s + o.amount, 0), completed_total: 0, receivable_total: 0 },
        pagination: { page: 1, per_page: 20, total: orcamentos.length, total_pages: 1, has_next: false, has_previous: false },
      }, true);
      AtendimentosPage.forcarFiltroStatus('waiting');
      cy.wait('@getAttendancesList');
      AtendimentosPage.elements.cardAtendimentoPorId(ATENDIMENTO).should('be.visible').click();
      cy.wait('@getAttendanceDetail');
      AtendimentosPage.abrirGavetaLinksPagamento();
      AtendimentosPage.elements.btnNovoLinkPagamentoDrawer().should('be.visible').click();
      AtendimentosPage.elements.modalEnviarLinkPagamento().should('be.visible');
      AtendimentosPage.elements.inputValorTotalLink().should('be.visible');
    };
    const enviarComErro = (statusCode, erro) => {
      AtendimentosMocks.interceptCreatePaymentLinkErroApi(ATENDIMENTO, statusCode, erro);
      abrirModalComOrcamentos([orcamento(260900961, 100)]);
      AtendimentosPage.elements.btnEnviarLinkPagamentoModal().should('not.be.disabled').click();
      cy.wait('@sendPaymentLink');
    };
    // O erro fica em linha e o formulário continua, com o Enviar liberado para tentar de novo
    const exigirFormularioParaReenviar = () => {
      AtendimentosPage.elements.selectOperadoraLink().should('be.visible');
      AtendimentosPage.elements.btnEnviarLinkPagamentoModal().should('not.be.disabled');
    };

    it('22.1 deve somar no valor total só o orçamento que ainda pode ser cobrado, avisar que o faturado ficou de fora e parcelar sobre esse total (front#311)', () => {
      abrirModalComOrcamentos([orcamento(260900951, 100), orcamento(260900952, 50, 260900999)]);

      AtendimentosPage.elements.inputValorTotalLink().invoke('val').should('match', /100,00/).and('not.match', /150,00/);
      AtendimentosPage.elements.avisoOrcamentoNaoCobravelLink().should('be.visible').and('contain.text', 'Orçamento que não pode ser cobrado não entra neste valor.');
      AtendimentosPage.elements.selectParcelasLink().select('2');
      AtendimentosPage.elements.labelValorParcelaLink().should('contain.text', '50,00');
    });

    it('22.2 contraprova: com todos os orçamentos marcados cobráveis, o valor total soma todos e não mostra o aviso (front#311)', () => {
      abrirModalComOrcamentos([orcamento(260900951, 100), orcamento(260900952, 50)]);

      AtendimentosPage.elements.inputValorTotalLink().invoke('val').should('match', /150,00/);
      AtendimentosPage.elements.avisoOrcamentoNaoCobravelLink().should('not.exist');
    });

    it('22.3 deve mostrar o motivo do provedor na recusa 422 PROVIDER_REFUSED e deixar corrigir e reenviar (front#332, critério 1)', () => {
      enviarComErro(422, { code: 'PROVIDER_REFUSED', error: 'Unprocessable Entity', message: MOTIVO_PROVEDOR });

      AtendimentosPage.elements.alertaModalEnviarLink().should('have.text', MOTIVO_PROVEDOR);
      exigirFormularioParaReenviar();
    });

    it('22.4 deve avisar resultado indeterminado no 502 sem code, pedindo para conferir a lista de links antes de reenviar e sem mostrar motivo (front#332, critério 2)', () => {
      enviarComErro(502, { message: 'Falha de comunicação com o provedor de pagamento.' });

      AtendimentosPage.elements.alertaModalEnviarLink().should('have.text', MSG_INCERTA).and('not.contain.text', 'provedor');
      exigirFormularioParaReenviar();
    });

    it('22.5 deve tratar um code desconhecido como resultado indeterminado, sem mostrar o motivo do servidor (front#332, critério 3)', () => {
      enviarComErro(422, { code: 'PAYMENT_LINK_NOVO_CODIGO', error: 'Unprocessable Entity', message: 'Motivo de um código que o front não conhece.' });

      AtendimentosPage.elements.alertaModalEnviarLink().should('have.text', MSG_INCERTA).and('not.contain.text', 'Motivo de um código');
    });

    it('22.6 deve tratar o 502 com PROVIDER_REFUSED como recusa, com o texto genérico e sem o aviso de incerteza (front#332)', () => {
      enviarComErro(502, { code: 'PROVIDER_REFUSED', message: 'O provedor recusou a cobrança.' });

      AtendimentosPage.elements.alertaModalEnviarLink().should('have.text', MSG_GENERICA);
      exigirFormularioParaReenviar();
    });
  });

});
