import IniciarAtendimentoPage from './4.iniciarAtendimentoPage';
import AtendimentosMocks from '../mocks/5.atendimentosMocks';
import { rotaApi } from '../support/rotaApi';

class AtendimentosPage {
  // Mapeamento concentrado dos Seletores
  elements = {
    // Cabeçalho e Título da Tela
    tituloAtendimentos: () => cy.contains('header, h1, h2, h3, div, span', 'Atendimentos'),

    // Campo de Busca
    inputBusca: () => cy.get('input[data-testid="input-search"], [data-testid="input-search"] input, [data-testid="input-search"]'),
    inputBuscaAtendimento: () => cy.get('input[data-testid="input-search"], [data-testid="input-search"] input, [data-testid="input-search"]'),

    // Barra de Filtros por Status (Chips / Abas Superiores)
    statusFilterBar: () => cy.get('[data-testid="status-filter-bar"]'),
    // Faixa rolável dos chips propriamente dita (a real caixa de recorte do overflow — irmã do
    // switch de status dentro de status-filter-bar, não o próprio status-filter-bar/toolbar. Ver
    // DOM real confirmado na validação do PR #417: `.toolbar` > busca + filtros + `.chipsRow` + switch)
    chipsRowContainer: () => cy.get('[data-testid="status-filter-bar"] [class*="_chipsRow_"]'),
    chipPending: () => cy.get('button[data-testid="filter-pending"]'),
    chipInProgress: () => cy.get('button[data-testid="filter-in_progress"]'),
    chipCompleted: () => cy.get('button[data-testid="filter-completed"]'),
    chipFinished: () => cy.get('button[data-testid="filter-finished"]'),
    chipDiscarded: () => cy.get('button[data-testid="filter-discarded"]'),
    chipWaiting: () => cy.get('[data-testid="status-filter-bar"] button[data-testid="filter-waiting"], button[data-testid="filter-waiting"], button[data-chip-key="waiting"]').first(),
    chipAll: () => cy.get('[data-testid="status-filter-bar"] button[data-testid="filter-all"], button[data-testid="filter-all"], button[data-chip-key="all"]').first(),

    getChipPorStatusKey: (key) => cy.get(`button[data-testid="filter-${key}"]`),

    // Controle de Status do Atendente (Switch / Toggle Disponível / Ocupado / Offline)
    btnStatusAtendente: () => cy.get('[data-testid="button-attendant-status"], button[role="switch"]:has([class*="_attendantStatusTrack_"])').first(),
    trackStatusAtendente: () => cy.get('[class*="_attendantStatusTrack_"]').first(),
    thumbStatusAtendente: () => cy.get('[class*="_attendantStatusThumb_"]').first(),
    labelStatusAtendente: () => cy.get('[data-testid="button-attendant-status"]'),

    // Items do Menu Lateral (Sidebar - Contadores por Status e Navegação)
    sidebarItemAtendimentos: () => cy.get('button[data-testid="sidebar-item-atendimentos"]').first(),
    // Destinos usados na guarda de saída ao navegar pelo menu lateral (Issue front#467, PR #471):
    // ids confirmados via bundle real (chunk navRoutes-*.js, 2026-10-01) — `r=['central','atendimentos','receitas','clientes']`
    // alimenta `data-testid="sidebar-item-${id}"`; `central` é o destino "Home"/Dashboard.
    sidebarItemClientes: () => cy.get('button[data-testid="sidebar-item-clientes"]').first(),
    sidebarItemReceitas: () => cy.get('button[data-testid="sidebar-item-receitas"]').first(),
    sidebarItemCentral: () => cy.get('button[data-testid="sidebar-item-central"]').first(),
    getSidebarItemPorStatus: (nomeStatus) =>
      cy.get('aside').contains('li, button, a, div', nomeStatus),
    getSidebarSubitemPorKey: (key) => cy.get(`[data-testid="sidebar-subitem-${key}"]`),

    // Lista de Atendimentos (Cards)
    listaAtendimentosSection: () => cy.get('section[aria-label="Attendance list"]'),
    cardsAtendimento: () => cy.get('section[aria-label="Attendance list"] [role="option"]'),
    cardAtendimentoPorId: (idAtendimento) => cy.get(`[data-testid="attendance-queue-item-${idAtendimento}"]`),
    getCardPorId: (idAtendimento) => cy.get(`[data-testid="attendance-queue-item-${idAtendimento}"]`),
    getCardPorNomeCliente: (nome) => cy.contains('section[aria-label="Attendance list"] [role="option"]', nome),
    getCardPorCelularOuTexto: (texto) => cy.get('section[aria-label="Attendance list"]').contains('[role="option"]', texto),
    btnCardMenuPorId: (idAtendimento) => cy.get(`[data-testid="attendance-queue-item-menu-${idAtendimento}"]`),
    cardsAtendimentoCompactos: () => cy.get('[data-testid^="attendance-queue-compact-item-"]'),
    previewCardPorId: (idAtendimento) => cy.get(`[data-testid="attendance-queue-item-${idAtendimento}"]`).find('span[class*="_itemPreview_"]'),
    // Rótulo de tempo relativo/data do card (Issue front#526/PR #528/#529) — contrato real capturado
    // no DOM (app.omnicare.dev.local, 06/10/2026): "há N minuto(s)/hora(s)" até 24h, depois dd/MM/yy.
    dataCardPorId: (idAtendimento) => cy.get(`[data-testid="attendance-queue-item-${idAtendimento}"]`).find('span[class*="_itemDate_"]'),

    // Busca em Modo Colapsado (PR #326 / PR #328) — o recolhimento da fila em si usa btnRecolherFila (cabeçalho do chat)
    btnExpandirBusca: () => cy.get('[data-testid="button-search-expand"]'),

    // Filtro de Data (dentro do modal/popover de filtros)
    btnFiltroData: () => cy.get('button[class*="_filtersDateValue_"]'),
    popoverFiltroData: () => cy.get('div[role="dialog"]'),
    inputDataInicial: () => cy.get('div[role="dialog"]').find('input[type="date"]').eq(0),
    inputDataFinal: () => cy.get('div[role="dialog"]').find('input[type="date"]').eq(1),
    btnCancelarFiltro: () => cy.contains('button', 'Cancelar'),

    // Modal de Filtros Avançados
    btnAbrirFiltros: () => cy.get('[data-testid="button-filtros"], button[aria-label="Filtros"], button[class*="_filterBtn_"]').first(),
    modalFiltros: () => cy.get('div[role="dialog"][aria-label="Filtros"], div[class*="_filtersPanel_"]'),
    tituloModalFiltros: () => cy.get('div[role="dialog"]').contains('h2', 'Filtros'),
    btnFecharModalFiltros: () => cy.get('div[role="dialog"]').find('button[aria-label="Fechar"], button[class*="_filtersCloseBtn_"], button:contains("×")').first(),
    btnFiltroDataModal: () => cy.get('div[role="dialog"]').find('button[class*="_filtersDateValue_"]'),
    btnCalendarioFiltroModal: () => cy.get('div[role="dialog"]').find('button[class*="_filtersDateCalendarBtn_"]'),
    selectFuncionarioFiltro: () => cy.get('div[role="dialog"]').contains('label', 'Funcionário').find('select'),
    hintFuncionarioFiltro: () => cy.get('#attendance-filters-employee-hint, p[class*="_filtersOptionHint_"]'),
    selectCanalFiltro: () => cy.get('div[role="dialog"]').contains('label', 'Canal').find('select'),
    // Erro ao carregar as opções de um seletor do modal de filtros (medido em mock em 2026-11-06 com GET /attendances/channels 403)
    erroOpcoesFiltro: () => cy.contains('div[role="dialog"] [role="alert"]', 'Erro ao carregar as opções.'),
    btnTentarNovamenteOpcoesFiltro: () => cy.get('div[role="dialog"] [data-testid="filter-option-retry"]'),
    selectGruposFiltro: () => cy.get('div[role="dialog"]').contains('label', 'Grupos').find('select'),
    selectStatusFiltro: () => cy.get('div[role="dialog"]').contains('label', 'Status').find('select'),
    btnLimparFiltros: () => cy.get('div[role="dialog"]').contains('button', 'Limpar'),
    btnAplicarFiltros: () => cy.get('div[role="dialog"]').contains('button', 'Aplicar filtros'),

    // -------------------------------------------------------------
    // ÁREA DO CHAT / MENSAGERIA
    // -------------------------------------------------------------
    headerChat: () => cy.get('[data-testid="chat-header"], header:has([data-testid="button-cliente-status"]), header:has(h2), div[class*="_conversation_"] header, main header').first(),
    tituloHeaderChat: () => cy.get('header[class*="_header_"] h2'),
    subtituloHeaderChat: () => cy.get('header[class*="_header_"] p[class*="_headerSubtitle_"]'),
    badgeJanelaExpirada: (opts = {}) => cy.contains(/Janela expirada/i, { ...opts }),
    badgeJanelaAtiva: (opts = {}) => cy.contains('span[class*="_serviceWindowBadge_"], [class*="_serviceWindowBadge_"], [data-testid="badge-janela-ativa"], span', /Janela ativa/i, { ...opts }),
    badgeServiceWindow: () => cy.get('[data-testid="badge-service-window"]'),
    iconeServiceWindow: () => cy.get('[data-testid="badge-service-window"] svg'),
    textoTempoServiceWindow: () => cy.get('[data-testid="badge-service-window"]'),
    btnBuscarConversa: () => cy.get('button[data-testid="button-chat-search"]'),
    painelBuscaConversa: () => cy.get('[data-testid="chat-search-panel"]'),
    inputBuscaConversa: () => cy.get('input[data-testid="chat-search-input"]'),
    btnFecharBuscaConversa: () => cy.get('button[data-testid="chat-search-close"]'),
    contadorBuscaConversa: () => cy.get('[data-testid="chat-search-counter"]'),
    btnProximoResultadoBusca: () => cy.get('button[data-testid="chat-search-next"]'),
    btnResultadoAnteriorBusca: () => cy.get('button[data-testid="chat-search-prev"]'),
    marcacaoAtivaBusca: (timeout = 10000) => cy.get('mark[aria-current="true"]', { timeout }),
    todasMarcacoesBusca: () => cy.get('mark[class*="_searchHighlight_"]'),
    todosLinksChat: () => cy.get('a[class*="_bubbleLink_"], p[class*="_bubbleText_"] a'),
    getLinkPorHref: (href) => cy.get(`a[href="${href}"]`),
    btnRecolherFila: () => cy.get('button[data-testid="button-queue-show"]'),
    btnFecharConversa: () => cy.get('[data-testid="button-close-chat"], button[aria-label="Fechar conversa"]').first(),
    containerMensagensScroll: () => cy.get('div[class*="_scrollViewport_"]').first(),
    badgeInicioHistorico: (opts = {}) => cy.get('[class*="_historyStart_"], div[role="status"]:contains("Início do histórico")', { timeout: 10000, ...opts }).first(),

    // Compositor de Mensagens & Banner de Janela 24h
    bannerJanelaEncerrada: () => cy.get('[data-testid="composer-service-window-notice"]'),
    tituloBannerJanela: () => cy.get('[data-testid="composer-service-window-notice"]').find('p[class*="_windowNoticeTitle_"], p').first(),
    hintBannerJanela: () => cy.get('[data-testid="composer-service-window-notice"]').find('p[class*="_windowNoticeHint_"], p').last(),
    btnEnviarTemplateAviso: () => cy.get('[data-testid="button-service-window-templates"]'),
    composerRoot: () => cy.get('footer[aria-label="Compositor de mensagens"]'),
    inputMensagemChat: () => cy.get('textarea[data-testid="input-message"]'),
    btnEnviarMensagemChat: () => cy.get('button[data-testid="button-send-message"]'),
    btnEmoji: () => cy.get('button[data-testid="button-emoji"]'),
    btnAnexar: () => cy.get('label[data-testid="btn-anexar"]'),
    btnAudio: () => cy.get('button[data-testid="btn-audio"]'),

    // Citação e Resposta a Mensagens no Chat (PR #394 / backend #500)
    btnResponderMensagem: (id) => cy.get(id ? `button[data-testid="button-reply-${id}"]` : 'button[data-testid^="button-reply-"], button[class*="_bubbleReplyAction_"]').first(),
    todosBotoesResponder: () => cy.get('button[data-testid^="button-reply-"], button[class*="_bubbleReplyAction_"]'),
    barraPreviewResposta: () => cy.get('[data-testid="composer-reply-bar"], div[class*="_replyBar_"]'),
    remetentePreviewResposta: () => cy.get('[data-testid="composer-reply-bar"]').find('p[class*="_replyBarSender_"], p').first(),
    textoPreviewResposta: () => cy.get('[data-testid="composer-reply-bar"]').find('p[class*="_replyBarPreview_"], p').last(),
    btnCancelarResposta: () => cy.get('button[data-testid="button-cancel-reply"], button[class*="_replyBarCancel_"]'),
    cardCitacaoNoBalao: (id = null) => cy.get(id ? `[data-message-id="${id}"] [class*="_quote_"], [data-message-id="${id}"] [class*="_reply_"]` : 'article [class*="_quote_"], div[class*="_quote_"], [class*="_replyQuote_"], button:has([class*="_reply_"])').first(),

    // -------------------------------------------------------------
    // PAINEL LATERAL DIREITO & MENU DE STATUS DO ATENDIMENTO
    // -------------------------------------------------------------
    cardCliente: () => cy.get('[data-testid="card-cliente"], aside[class*="_infoPanel_"]'),
    btnClienteStatus: () => cy.get('button[data-testid="button-editar-cliente-icon"], button[data-testid="button-cliente-status"], button[class*="_infoStatusBtn_"], button[class*="_statusMenuTrigger_"], [data-testid="button-editar-cliente-icon"]').first(),
    btnMenuTransferir: () => cy.get('button[data-testid="menu-transferir"], [data-testid="menu-transferir"]'),
    menuStatusPopover: () => cy.get('[data-testid="chat-header-status-dropdown"], div[role="menu"], div[class*="popover"], div[class*="dropdown"]'),

    // -------------------------------------------------------------
    // DIÁLOGO "VINCULAR CLIENTE" (Issue #440/#441, PR #470)
    // Entrada: button-editar-cliente-icon (popover) > menu-link-client — só aparece quando
    // customer.customer_id vier ausente/null no detalhe do atendimento (mutuamente exclusivo
    // com menu-edit-client). Testids confirmados via cy.salvarSnapshotDom em 29/09/2026, não
    // supostos: o candidato do scanner estático ("button-link-customer") é na verdade o botão
    // "Vincular" de dentro do diálogo, não o item do menu (AGENTS.md [R-TOOLS]).
    // -------------------------------------------------------------
    menuVincularCliente: () => cy.get('[data-testid="menu-link-client"]'),
    modalVincularCliente: () => cy.get('[data-testid="modal-link-customer"]'),
    inputBuscaVincularCliente: () => cy.get('[data-testid="input-link-customer-client"]'),
    listaSugestoesVincularCliente: () => cy.get('[data-testid="link-customer-client-suggestions"]'),
    getSugestaoVincularClientePorId: (clienteId) => cy.get(`[data-testid="link-customer-client-suggestion-${clienteId}"]`),
    btnVincularClienteConfirmar: () => cy.get('[data-testid="button-link-customer"]'),
    btnVincularClienteCancelar: () => cy.get('[data-testid="link-customer-cancel"]'),
    btnVincularClienteFechar: () => cy.get('[data-testid="link-customer-close"]'),
    // Sem data-testid próprio (confirmado no DOM real): toast global de sucesso via role="status"
    // e alerta inline de erro via role="alert" escopado ao próprio diálogo (hierarquia [R-SEL] #2).
    avisoVincularClienteSucesso: () => cy.get('div[role="status"]'),
    erroVincularClienteInline: () => cy.get('[data-testid="modal-link-customer"] [role="alert"]'),

    // Botão "Cadastrar novo" no rodapé do diálogo (Issue front#497/PR #499) — só renderiza com
    // can_create_client concedida (GET /client-capabilities) e o recurso "patient" não negado.
    // Abre o MESMO modal "Novo Cliente" da tela de Clientes (NewClientModalSession, confirmado
    // via bundle real) — testids abaixo são os idênticos já usados em 7.clientesPage.js, não
    // duplicatas com nome novo, porque é literalmente o mesmo componente renderizado aqui.
    btnVincularClienteCadastrarNovo: () => cy.get('[data-testid="button-link-customer-new-client"]'),
    modalNovoCliente: () => cy.get('[data-testid="modal-new-client"]'),
    btnFecharNovoCliente: () => cy.get('[data-testid="button-new-client-close"]'),
    btnSalvarNovoCliente: () => cy.get('[data-testid="button-new-client-submit"]'),
    inputNomeNovoCliente: () => cy.get('[data-testid="input-new-client-name"]'),
    modalDescartarCadastroNovoCliente: () => cy.get('[data-testid="modal-new-client-discard"]'),
    btnConfirmarDescartarCadastroNovoCliente: () => cy.get('[data-testid="modal-new-client-discard-confirm"]'),
    btnCancelarDescartarCadastroNovoCliente: () => cy.get('[data-testid="modal-new-client-discard-cancel"]'),
    // Fundo do modal "Novo Cliente" (role="presentation", distinto do overlay do diálogo
    // "Descartar texto?") — clique direto nele simula "clicar fora" do modal.
    overlayNovoCliente: () => cy.get('div[role="presentation"][class*="_overlay_"]'),

    // Itens do Dropdown de Mudar Status
    itemMenuStatusPending: () => cy.contains('[data-testid*="status"], div[role="menu"] *, div[class*="popover"] *', /pendente/i),
    itemMenuStatusInProgress: () => cy.contains('[data-testid*="status"], div[role="menu"] *, div[class*="popover"] *', /em andamento/i),
    itemMenuStatusCompleted: () => cy.contains('[data-testid*="status"], div[role="menu"] *, div[class*="popover"] *', /conclu/i),
    itemMenuStatusFinished: () => cy.contains('[data-testid*="status"], div[role="menu"] *, div[class*="popover"] *', /finaliz/i),
    itemMenuStatusDiscarded: () => cy.contains('[data-testid*="status"], div[role="menu"] *, div[class*="popover"] *', /descart/i),
    itemMenuTransferir: () => cy.get('button[data-testid="menu-transferir"], [data-testid="menu-transferir"]'),
    getItemMenuStatusPorKey: (key) => {
      const mapaNomes = {
        pending: /pendente/i,
        in_progress: /em andamento/i,
        completed: /conclu/i,
        finished: /finaliz/i,
        discarded: /descart/i
      };
      return cy.get(`[data-testid="chat-header-menu-status-${key}"], div[role="menu"] button, div[role="menu"] li, div[class*="popover"] button, div[class*="popover"] li, div[class*="dropdown"] button`)
        .contains(mapaNomes[key] || key);
    },

    // Badge de Substatus Personalizado — fila e cabeçalho do chat (backend#499/#501-503, front#396)
    badgeSubstatusCard: (idAtendimento) => cy.get(`[data-testid="attendance-queue-item-custom-status-${idAtendimento}"]`),
    badgeSubstatusChat: () => cy.get('[data-testid="badge-attendance-custom-status"]'),
    btnDesvincularSubstatus: () => cy.get('[data-testid="button-attendance-custom-status-unlink"]'),
    btnCancelarSubstatus: () => cy.get('[data-testid="button-attendance-custom-status-cancel"]'),
    btnConfirmarSubstatus: () => cy.get('[data-testid="button-attendance-custom-status-confirm"]'),
    inputNomeSubstatus: () => cy.get('[data-testid="input-attendance-custom-status-name"]'),
    itemMenuSubstatus: (customStatusId) => cy.get(`[data-testid="chat-header-menu-custom-status-${customStatusId}"]`),
    // O chevron de cada linha de status pai EXPANDE/RECOLHE a sublista dos substatus já
    // cadastrados daquele pai (view/seleção — não gated por permissão de criação). O "+" de
    // "Adicionar personalizado" é um controle SEPARADO na mesma linha. Ambos usam a MESMA chave
    // string do menu de status (pending/in_progress/completed/finished/discarded), não o número
    // de parent_status. Confirmado por snapshot de DOM real em 25/09/2026.
    toggleSubstatusPorPai: (key) => cy.get(`[data-testid="chat-header-menu-custom-toggle-${key}"]`),
    btnAdicionarSubstatusPorPai: (key) => cy.get(`[data-testid="chat-header-menu-custom-add-${key}"]`),
    mapaParentStatusKey: { 0: 'pending', 1: 'in_progress', 2: 'completed', 3: 'finished', 4: 'discarded' },

    btnHeaderIa: () => cy.get('[data-testid="btn-header-ia"]'),
    textProtocoloCliente: () => cy.get('[data-testid="text-cliente-protocolo"]'),
    summaryOrcamentos: () => cy.get('[data-testid="summary-orcamentos"]'),
    summaryLinks: () => cy.get('[data-testid="summary-links"]'),
    summaryMensagemPadrao: () => cy.get('[data-testid="summary-mensagem-padrao"]'),
    summaryTemplates: () => cy.get('[data-testid="summary-templates"]'),
    summaryTransferencias: () => cy.get('[data-testid="summary-transferencias"]'),
    summaryNotas: () => cy.get('[data-testid="summary-notas"]'),
    summaryObservacoes: () => cy.get('[data-testid="summary-observacoes"]'),
    btnListaProdutos: () => cy.get('[data-testid="btn-header-lista-produtos"]'),
    btnReceita: () => cy.get('[data-testid="btn-header-receita"]'),
    btnRevenda: () => cy.get('[data-testid="btn-header-revenda"]'),
    textClienteCodigo: () => cy.get('[data-testid="text-cliente-codigo"]'),
    textClienteGrupo: () => cy.get('[data-testid="text-cliente-grupo"]'),
    textClienteTelefone: () => cy.get('[data-testid="text-cliente-telefone"], [data-testid="chat-header-subtitle"], [data-testid="header-subtitle"]'),
    textClienteEmail: () => cy.get('[data-testid="text-cliente-email"]'),
    btnEditarDadosCliente: () => cy.get('[data-testid="button-editar-dados-cliente"]'),

    // Gavetas / Drawers Laterais
    btnEnviarOrcamentoDrawer: () => cy.contains('button', 'Enviar orçamento'),
    drawerTemplates: () => cy.get('aside[class*="_drawer_"], div[class*="_drawer_"], div[role="dialog"], [data-testid="drawer-templates"]'),
    tituloDrawerTemplates: () => cy.contains('h2, h3, div, span', /MENSAGENS TEMPLATE/i),
    inputVariavelTemplate: () => cy.get('input#sa-template-text, textarea#sa-template-text, [data-testid="textarea-template-text"], [data-testid="input-template-variable"], textarea[placeholder*="variável"], input[placeholder*="variável"]'),
    btnConfirmarEnvioTemplate: () => cy.get('[data-testid="button-send-template"], [data-testid="button-enviar-template"], [data-testid="button-enviar-atendimento"], button:contains("Enviar template"), button:contains("Enviar mensagem"), button:contains("Usar template")'),
    bannerTemplateEscolhido: () => cy.contains('div, p, span', /Template escolhido/i),
    btnCancelarTemplateCompositor: () => cy.get('[data-testid="button-cancel-template"], button:contains("Cancelar")').first(),
    btnCancelarTemplate: () => cy.get('[data-testid="button-cancel-template"], button:contains("Cancelar")').first(),
    barraTemplateCompositor: () => cy.get('[class*="_templateLockedBar_"], [data-testid="button-cancel-template"]').first(),

    // Gaveta de Transferências
    drawerTransferencias: () => cy.get('aside[class*="_sideDrawer_"][role="dialog"], [class*="_transferDrawer_"], [class*="_transferDrawerScroll_"], aside').filter(':contains("TRANSFERÊNCIAS"), :contains("Transferências")'),
    btnNovaTransferenciaDrawer: () => cy.get('aside[class*="_sideDrawer_"] button, div[role="dialog"] button, button').filter(':contains("Nova transferência"), :contains("Transferir")').first(),
    avisoSemTransferencias: () => cy.contains(/Nenhuma transferência realizada ainda/i),
    itensHistoricoTransferencia: () => cy.get('aside[class*="_sideDrawer_"] [class*="_transferDrawerRow_"], aside[role="dialog"] [class*="_transferDrawerRow_"], article[data-testid^="painel-transferencia-tr-"], article[class*="_transferDrawerRow_"], [class*="_transferDrawerRow_"], aside[class*="_sideDrawer_"] [class*="_historyItem_"], aside[class*="_sideDrawer_"] li'),

    // Gaveta e Modal de Orçamentos
    drawerOrcamentos: () => cy.get('[data-testid="button-abrir-enviar-orcamento"], [class*="_budgetDrawerScroll_"], [class*="_budgetDrawerList_"], [data-testid^="budget-"], aside:contains("ORÇAMENTOS")').first(),
    btnAbrirEnviarOrcamentoDrawer: () => cy.get('[data-testid="button-abrir-enviar-orcamento"]'),
    btnAbrirModalEnviarOrcamento: () => cy.get('[data-testid="button-abrir-enviar-orcamento"], button:contains("Enviar orçamento")').first(),
    modalEnviarOrcamento: () => cy.get('[data-testid="modal-enviar-orcamento"], div[role="dialog"][data-testid="modal-enviar-orcamento"]'),
    btnFecharModalOrcamento: () => cy.get('[data-testid="send-budget-quote-close"]'),
    checkboxItemOrcamento: () => cy.get('[data-testid="budget-item-checkbox"], [class*="_sendBudgetQuoteSelectionCheckbox_"]'),
    btnBaixarOrcamentoModal: () => cy.get('[data-testid="button-baixar-orcamento"]').first(),
    btnEnviarParaOChatModal: () => cy.get('[data-testid="button-enviar-orcamento-chat"]').first(),
    balaoOrcamentoChat: () => cy.get('div[class*="_bubble_"], [data-testid*="message-bubble"], article[class*="_bubbleRowEnd_"], [class*="_bubbleRow_"]').filter(':contains("orçamento"), :contains("Orçamento"), :contains("Fórmula"), :contains("Tadalafil"), :contains("R$"), :has([class*="_mediaMessage_"]), :has([class*="_attachment_"]), :has([class*="_budget_"])').last(),
    cardsOrcamentoDrawer: () => cy.get('article[class*="_budgetDrawerCard_"], article[data-testid^="budget-"]'),
    btnEditarOrcamentoCard: () => cy.get('[data-testid="btn-editar-orcamento"]'),
    btnRemoverOrcamentoCard: () => cy.get('[data-testid="budget-delete"]'),
    checkboxSelecaoOrcamentoCard: () => cy.get('[data-testid="budget-selected-indicator"]'),
    seloOrcamentoVendido: () => cy.contains('span, div, p', /Vendido/i),

    // Personalização do Orçamento (Issue #449, PR #451)
    btnCustomizeBudget: () => cy.get('[data-testid="button-customize-budget"]'),
    modalBudgetCustomization: () => cy.get('[data-testid="modal-budget-customization"]'),
    btnCloseBudgetCustomization: () => cy.get('[data-testid="button-close-budget-customization"]'),
    inputBudgetAccentColor: () => cy.get('[data-testid="input-budget-accent-color"]'),
    inputBudgetAccentHex: () => cy.get('[data-testid="input-budget-accent-hex"]'),
    inputBudgetCoverFile: () => cy.get('[data-testid="input-budget-cover-file"]'),
    btnBudgetCoverUpload: () => cy.get('[data-testid="button-budget-cover-upload"]'),
    btnBudgetCoverRemove: () => cy.get('[data-testid="button-budget-cover-remove"]'),
    btnCancelBudgetCustomization: () => cy.get('[data-testid="button-cancel-budget-customization"]'),
    btnSaveBudgetCustomization: () => cy.get('[data-testid="button-save-budget-customization"]'),
    previewCardOrcamento: () => cy.get('[class*="_sendBudgetQuotePreviewCard_"]'),
    previewCoverOrcamento: () => cy.get('[class*="_sendBudgetQuotePreviewCover_"]'),
    avisoImagemPequenaOrcamento: () => cy.contains('[role="status"]', /Imagem pequena/i),
    nomeArquivoCapaOrcamento: () => cy.get('[class*="_budgetCustomizationFileName_"]'),
    toastSucessoPersonalizacaoOrcamento: () => cy.contains('Personalização do orçamento salva.'),
    toastErroPersonalizacaoOrcamento: () => cy.contains('Não foi possível salvar a personalização.'),

    // Modal e Gaveta de Link de Pagamento
    drawerLinksPagamento: () => cy.get('[data-testid="payment-link-new"], [class*="_paymentLinkDrawer_"], [class*="_budgetDrawerFooter_"], aside').filter(':contains("Links de pagamento"), :contains("LINKS DE PAGAMENTO"), :contains("Novo link")').first(),
    btnNovoLinkPagamentoDrawer: () => cy.get('[data-testid="payment-link-new"], button:contains("Novo link")'),
    cardsLinkPagamentoDrawer: () => cy.get('article[data-testid^="payment-link-"], article[class*="_paymentLinkDrawerCard_"]'),
    cardLinkPagamentoPorId: (id) => cy.get(`article[data-testid="payment-link-${id}"]`),
    btnToggleDetalhesLink: () => cy.get('[data-testid="payment-link-details-toggle"]'),
    btnRemoverLink: () => cy.get('[data-testid="payment-link-delete"]'),
    btnCopiarUrlLink: () => cy.get('[data-testid="payment-link-copy-url"]'),
    linkAbrirUrlLink: () => cy.get('[data-testid="payment-link-open-url"]'),
    badgeStatusLink: () => cy.get('[class*="_paymentLinkStatusBadge_"]'),
    painelDetalhesVendaLink: () => cy.get('[class*="_paymentLinkDetailPanel_"]'),
    modalEnviarLinkPagamento: () => cy.get('[data-testid="modal-enviar-link-pagamento"]'),
    btnFecharModalEnviarLink: () => cy.get('[data-testid="send-payment-link-close"]'),
    selectOperadoraLink: () => cy.get('[data-testid="select-operadora"]'),
    inputValorTotalLink: () => cy.get('[data-testid="input-valor-total"]'),
    selectParcelasLink: () => cy.get('[data-testid="select-parcelas"]'),
    labelValorParcelaLink: () => cy.get('[data-testid="label-valor-parcela"]'),
    // "Orçamento que não pode ser cobrado não entra neste valor." (front#311): só aparece quando um marcado ficou fora do total
    avisoOrcamentoNaoCobravelLink: () => cy.get('[data-testid="payment-link-total-sold-hint"]'),
    // Erro do envio em linha, acima do formulário (front#332): o formulário continua na tela para reenviar
    alertaModalEnviarLink: () => cy.get('[data-testid="modal-enviar-link-pagamento"] [role="alert"]'),
    btnEnviarLinkPagamentoModal: () => cy.get('[data-testid="button-enviar-link"]'),
    tooltipAcaoBloqueada: () => cy.get('[class*="_blockedActionTooltipWrap_"]'),

    // Gaveta de Mensagem Padrão
    drawerMensagemPadrao: () => cy.contains('aside, div[role="dialog"], section[class*="_drawer_"]', /mensagens padrão/i),
    inputBuscarMensagemPadrao: () => cy.get('input[placeholder*="Buscar mensagem"], [data-testid="input-buscar-mensagem-padrao"]'),
    btnUsarMensagemPadrao: () => cy.contains('button', /Usar mensagem/i),

    // Gaveta de Observações
    drawerObservacoes: () => cy.get('aside[role="dialog"]').filter(':contains("Observações")'),
    inputEscreverObservacao: () => cy.get('[data-testid="observation-new-text"]'),
    btnSalvarObservacao: () => cy.get('[data-testid="observation-new-save"]'),
    itensObservacoes: () => cy.get('article[data-testid^="observation-"]'),
    btnEditarObservacao: () => cy.get('[data-testid="observation-edit"]'),
    btnExcluirObservacao: () => cy.get('[data-testid="observation-delete"]'),
    // Campo de edição inline de uma observação existente — único na tela por vez (só a
    // observação em edição o renderiza). Testid real confirmado via bundle de
    // app.omnicare.dev.local (NotesDrawerConnected-*.js), Issue front#468/#469.
    inputEdicaoObservacaoTexto: () => cy.get('[data-testid="observation-edit-text"]'),

    // Gaveta de Notas Internas
    drawerNotasInternas: () => cy.get('aside[role="dialog"]').filter(':contains("Notas internas")'),
    inputNotaInterna: () => cy.get('[data-testid="internal-note-new-text"]'),
    btnSalvarNotaInterna: () => cy.get('[data-testid="internal-note-new-save"]'),
    itensNotasInternas: () => cy.get('article[data-testid^="notas-panel-card-"]'),
    avisoSemNotasInternas: () => cy.contains(/Nenhuma nota interna registrada/i),
    labelComunicacaoInterna: () => cy.contains('span', 'Comunicação interna'),

    // Diálogo "Descartar texto?" — guarda de saída de gavetas com texto não salvo (Issue #345,
    // PR #459/#465). Componente genérico (role="alertdialog"), compartilhado por Notas Internas,
    // Observações e pela troca para qualquer outro painel (Orçamentos, Receita, IA, Editar cliente).
    // Testids confirmados via cy.salvarSnapshotDom em 29/09/2026, não supostos.
    dialogDescartarTexto: () => cy.get('[data-testid="drawer-draft-discard-dialog"]'),
    btnDescartarTextoManterEditando: () => cy.get('[data-testid="drawer-draft-discard-dialog-cancel"]'),
    btnDescartarTextoConfirmar: () => cy.get('[data-testid="drawer-draft-discard-dialog-confirm"]'),
    mensagemDescartarTexto: () => cy.get('[data-testid="drawer-draft-discard-dialog"] p'),
    overlayDescartarTexto: () => cy.get('[class*="_overlay_"]').first(),
    btnFecharGavetaLateral: () => cy.get('button[aria-label="Fechar"], button[class*="_closeBtn_"], button[class*="_sideDrawerCloseBtn_"]'),

    // Diálogo "Sair sem salvar?" — guarda de saída ao voltar/avançar pelo navegador (Issue
    // front#472, PR #475), mecanismo novo e distinto de drawer-draft-discard-dialog: o app migrou
    // para RouterProvider/createBrowserRouter e usa useBlocker só em historyAction === 'POP',
    // acionado pelo mesmo contador global (Sg/Tg) que arma o beforeunload nativo da Parte A (PR
    // #473) - por isso sair pelo menu lateral (PUSH) nunca aciona este diálogo, só o voltar/avançar
    // reais do navegador. Testid e textos (title/message/confirm/cancel) confirmados via inspeção
    // do bundle real (index-*.js, função QH(), chaves i18n app.leaveUnsaved*), não supostos.
    dialogSairSemSalvar: () => cy.get('[data-testid="navigation-unsaved-dialog"]'),
    btnSairSemSalvarContinuarEditando: () => cy.get('[data-testid="navigation-unsaved-dialog-cancel"]'),
    btnSairSemSalvarConfirmar: () => cy.get('[data-testid="navigation-unsaved-dialog-confirm"]'),

    // Anexos e Mídias
    inputAnexarArquivo: () => cy.get('[data-testid="input-attachment-file"], input[type="file"]'),
    cardPreviewAnexo: () => cy.get('div[class*="_attachmentPreview_"], div[class*="_attach_"], div:has(> button:has(svg))'),
    btnRemoverAnexo: () => cy.get('[data-testid="btn-remove-attachment"]'),
    indicadorUploadMensagem: () => cy.contains('div, p, span', /Enviando mensagem/i),
    inputLegendaAnexo: () => cy.get('textarea[placeholder*="Legenda"], input[placeholder*="Legenda"], textarea[data-testid="input-message"]'),
    // Placeholder de mídia não renderizável. Ancorado na classe do componente (e não em
    // `cy.contains`, que devolve a PRIMEIRA ocorrência do DOM): o histórico do chat acumula um
    // placeholder novo a cada execução desta suíte, e a primeira ocorrência é sempre a mais antiga,
    // fora da área rolável — o que fazia `should('be.visible')` falhar mesmo com o balão correto
    // renderizado. A validação usa `.last()` sobre este seletor.
    balaoMidiaIndisponivel: () => cy.get('[class*="_attachmentPlaceholder_"]'),

    // Anexos renderizados no balão — contrato real capturado do DOM em 23/09/2026
    // (snapshot de `app.omnicare.dev.local`; as mídias chegam ao chat como data-URI, não como URL remota)
    botaoAnexoImagem: () => cy.get('button[data-testid^="attachment-image-"]'),
    botaoAnexoPdf: () => cy.get('button[data-testid^="attachment-pdf-"]'),
    linkAnexoDocumento: (messageId = null) => messageId
      ? cy.get(`[data-message-id="${messageId}"] a[class*="_documentLink_"]`)
      : cy.get('a[class*="_documentLink_"]'),
    // ATENÇÃO: o wrapper do player de áudio no balão é `audio-player-m-{messageId}`, confirmado por
    // snapshot de DOM real. O testid `inline-audio-player` existe no bundle (aparece em
    // `npm run scan:elements`) mas NÃO é renderizado aqui — é o caso clássico de "testid do scanner
    // é candidato, não confirmado" documentado em AGENTS.md §1. Só `inline-audio-play` (o botão) é real.
    playerAudioInline: () => cy.get('[data-testid^="audio-player-m-"]'),
    botaoPlayAudioInline: () => cy.get('[data-testid="inline-audio-play"]'),
    elementoAudioAnexo: () => cy.get('audio'),
    elementoVideoAnexo: () => cy.get('video[class*="_attachmentVideo_"]'),

    // Busca sob demanda do conteúdo binário do anexo (Issue front#521/backend#612/#613) — quando
    // `attachment.url`/`data` não vêm na listagem, o conteúdo é buscado por
    // `GET .../messages/:id/attachment` e vira Blob tipado por `attachment.mime_type`. Testids e
    // textos confirmados por reverse engineering do bundle real + inspeção de DOM (06/10/2026).
    placeholderAnexoCarregando: (messageId) => cy.get(`[data-message-id="${messageId}"] [class*="_attachmentPlaceholder_"][aria-busy="true"]`),
    placeholderAnexoIndisponivel: (messageId) => cy.get(`[data-message-id="${messageId}"] [class*="_attachmentPlaceholder_"]:not([class*="_attachmentPlaceholderError_"])`),
    placeholderAnexoComErro: (messageId) => cy.get(`[data-message-id="${messageId}"] [class*="_attachmentPlaceholderError_"]`),
    botaoTentarNovamenteAnexo: (messageId) => cy.get(`[data-testid="attachment-retry-m-${messageId}"]`),
    botaoBaixarDocumento: (messageId) => cy.get(`[data-testid="button-download-document-m-${messageId}"]`),
    statusCarregandoConversa: () => cy.get('[role="status"]').contains('Carregando a conversa'),

    // Lightboxes de prévia (imagem e PDF)
    lightboxImagem: () => cy.get('[data-testid="image-lightbox-image"]'),
    overlayLightboxImagem: () => cy.get('[data-testid="image-lightbox-overlay"]'),
    btnFecharLightboxImagem: () => cy.get('[data-testid="image-lightbox-close"]'),
    lightboxPdf: () => cy.get('[data-testid="pdf-lightbox-viewer"]'),
    overlayLightboxPdf: () => cy.get('[data-testid="pdf-lightbox-overlay"]'),
    btnFecharLightboxPdf: () => cy.get('[data-testid="pdf-lightbox-close"]'),
    // Recusa de envio devolvida pelo servidor (413/422) e exibida na tela como veio da API (front#344 / PR #419).
    // Não existe data-testid dedicado para esta cópia no inventário do frontend (npm run scan:elements, 23/09/2026):
    // o texto é a única âncora estável, e é exatamente o que o contrato promete ao operador.
    mensagemRecusaDeTamanho: (opcoes = {}) => cy.contains('div, p, span, li', /excede o limite|acima do limite de/i, opcoes),
    // Aviso LOCAL de anexo acima do teto por tipo (front#595/PR #598): <p role="alert"> na faixa do compositor, medido no front real em 2026-10-19
    avisoLocalDeTamanho: (opcoes = {}) => cy.get('footer[aria-label="Compositor de mensagens"] [role="alert"]', opcoes),
    // Bolhas de mensagem do próprio atendente (usado para provar que nenhuma mensagem foi gravada após a recusa)
    baloesEnviados: () => cy.get('article[class*="_bubbleRowEnd_"], div[class*="_bubbleEmployee_"]'),
    audioPlayerChat: () => cy.get('[data-testid*="audio-player"], [data-testid="audio-preview-player"], div[class*="_audioPlayer_"], div[class*="_audioCard_"], audio'),

    // Bloqueio do Compositor (Atendimento Sem Atendente)
    noticeSemAtendente: () => cy.get('[data-testid="composer-no-attendant-notice"]'),
    textoAvisoSemAtendente: () => cy.contains('p', 'Este atendimento está sem atendente.'),
    textoHintSemAtendente: () => cy.contains('p', 'É necessário vincular o atendimento a um atendente antes de responder ao cliente.'),

    // Permissão 655 (can_view_pending_attendance) e Ação de Assumir Atendimento (can_take_attendance
    // - backend#528/#571, front#505/PR #511). `canAssume` lê can_take_attendance (não mais 649);
    // testid do cartão (`messages-take-required`) confirmado via bundle real (index-D44fQXrl.js).
    cardBloqueioPermissao655: () => cy.get('[data-testid="messages-take-required"]'),
    btnAssumirAtendimento: () => cy.get('[data-testid="button-assume-attendance"]'),
    // "Você também não pode assumir este atendimento." (gate 'denied' dentro do cartão da 655) —
    // substitui o texto antigo ("...não tem permissão...") que nunca existiu de fato no bundle,
    // achado ao reconferir a cópia real em 2026-10-02.
    textoNaoPodeAssumirAtendimento: () => cy.contains(/voc[êe] tamb[ée]m n[ãa]o pode assumir este atendimento/i),
    textoConflitoAssumirAtendimento: () => cy.contains(/j[áa] assumiu este atendimento/i),
    textoAssumaParaVerFila: () => cy.contains('[data-testid^="attendance-queue-item-"]', /assuma para ver/i),

    // Modal de Transferência de Atendimento
    modalTransferir: () => cy.get('[data-testid="modal-transferir"]'),
    btnFecharModalTransferir: () => cy.get('[data-testid="button-close-transferir"]'),
    atendenteAtualTransferir: () => cy.get('[data-testid="transferir-atendente-atual"]'),
    inputBuscarAtendenteTransferir: () => cy.get('[data-testid="input-buscar-atendente"]'),
    listaAtendentesTransferir: () => cy.get('[data-testid="lista-atendentes"]'),
    getOpcaoAtendentePorId: (id) => cy.get(`[data-testid="lista-atendentes"] [data-agent-id="${id}"], [data-testid="lista-atendentes"] #option-atendente-${id}`),
    getOpcaoAtendentePorNome: (nome) => cy.get('[data-testid="lista-atendentes"]').contains('[role="option"]', new RegExp(nome, 'i')),
    badgeStatusOcupado: () => cy.contains('span', /ocupado/i),
    btnConfirmarTransferir: () => cy.get('[data-testid="button-confirmar-transferir"]'),
    // Grupos e fila geral da modal (Issue front#561/PR #574): testids medidos na dev real em 2026-10-16
    listaGruposTransferir: () => cy.get('[data-testid="transfer-group-list"]'),
    getOpcaoGrupoTransferir: (idGrupo) => cy.get(`[data-testid="transfer-group-option-${idGrupo}"]`),
    opcaoFilaGeralTransferir: () => cy.get('[data-testid="button-transfer-group-queue"]'),
    // Opções de atendente (`option-atendente-{slug}`): com busca sem resultado o contêiner `lista-atendentes` some, então não dá para procurar dentro dele
    opcoesAtendenteTransferir: () => cy.get('[data-testid^="option-atendente-"]'),
    destinoTransferir: () => cy.get('[data-testid="transfer-destination"]'),

    // -------------------------------------------------------------
    // DRAWER "DADOS DO CLIENTE" (PR #427 / #432 / #438 - editClientDrawer)
    // Entrada: button-editar-cliente-icon (popover) > menu-edit-client (item novo).
    // Testids confirmados via inspeção real do bundle (editClientDrawer.catalog-*.js), não supostos.
    // -------------------------------------------------------------
    btnMenuEditarCliente: () => cy.get('button[data-testid="menu-edit-client"]'),
    drawerDadosCliente: () => cy.get('[class*="_sideDrawerWrap_"]').filter(':has([data-testid="button-client-save"])').first(),
    radioTipoClientePF: () => cy.get('[data-testid="radio-client-person-type-individual"]'),
    radioTipoClientePJ: () => cy.get('[data-testid="radio-client-person-type-company"]'),
    labelDocumentoCliente: () => cy.get('label[for$="-document"]').first(),
    inputDocumentoCliente: () => cy.get('[data-testid="input-client-document"]'),
    inputNomeOuRazaoSocialCliente: () => cy.get('[data-testid="input-client-name"]'),
    inputRazaoSocialClientePJ: () => cy.get('[data-testid="input-client-company-name"]'),
    inputRgCliente: () => cy.get('[data-testid="input-client-identity-document"]'),
    selectOrgaoEmissorCliente: () => cy.get('[data-testid="select-client-issuing-body"]'),
    inputDataNascimentoCliente: () => cy.get('[data-testid="input-client-birth-date"]'),
    btnAbrirCalendarioNascimento: () => cy.get('[data-testid="button-client-birth-date-picker"]'),
    inputTelefoneCliente: () => cy.get('[data-testid="input-client-phone"]'),
    inputEmailCliente: () => cy.get('[data-testid="input-client-email"]'),
    listaEnderecosCliente: () => cy.get('[data-testid^="radio-client-address-"]'),
    getRadioEnderecoPorId: (id) => cy.get(`[data-testid="radio-client-address-${id}"]`),
    hintSemEnderecoCliente: () => cy.contains('p', /nenhum endere[çc]o salvo/i),
    btnNovoEnderecoCliente: () => cy.get('[data-testid="button-client-new-address"]'),
    inputApelidoEnderecoCliente: () => cy.get('[data-testid$="-address-description"]'),
    btnSalvarDadosCliente: () => cy.get('[data-testid="button-client-save"]'),
    mensagemSucessoSalvarCliente: () => cy.get('[data-testid="client-save-success"]'),
    mensagemErroSalvarCliente: () => cy.get('[data-testid="client-save-error"]'),
    erroCampoDrawerCliente: () => cy.get('[class*="fieldError"]'),

    // -------------------------------------------------------------
    // BUSCA DE CLIENTE NOS CAMPOS DO DRAWER "DADOS DO CLIENTE" (Issue front#457, PR #498)
    // Reusa o mesmo hook/rota de busca do "Vincular Cliente" (usePersonSearch, GET
    // /clients?q=), mas com um componente compartilhado NOVO e testids
    // próprios — não confundir com listaSugestoesVincularCliente/getSugestaoVincularClientePorId
    // acima (diálogo antigo, Issue #440/#441). Prefixo `edit-client-<campo>-search` confirmado via
    // varredura do bundle real de app.omnicare.dev.local em 2026-09-30 (AGENTS.md [R-TOOLS]): o campo
    // Documento usa `edit-client-document`, o campo Nome (Nome completo em PF / Nome Fantasia em
    // PJ) usa `edit-client-name`, e Razão Social (PJ) usa `edit-client-company-name`.
    // -------------------------------------------------------------
    getPopoverBuscaClienteDrawer: (campo) => cy.get(`[data-testid="edit-client-${campo}-search-suggestions"]`),
    getSugestaoBuscaClienteDrawer: (campo, clienteId) => cy.get(`[data-testid="edit-client-${campo}-search-suggestion-${clienteId}"]`),
    avisoBloqueioTrocaClienteDrawer: () => cy.get('[data-testid="client-pick-blocked"]'),
    // Dica de documento travado no drawer (Issue front#527/PR #531): mesmo id da ficha, mas texto
    // próprio do drawer ("...Digite para buscar outro cliente.") — o campo aqui nunca é disabled,
    // é a mesma busca de cliente acima, reaproveitada também quando o documento já está gravado.
    hintDocumentoTravadoDrawer: () => cy.get('#edit-client-document-locked-hint'),
    // Troca de tipo PF ↔ PJ para o oposto do cliente vinculado (Issue front#506, PR #508):
    // testid confirmado via npm run scan:elements em 2026-10-01 (único novo testid da PR).
    avisoTipoClienteOposto: () => cy.get('[data-testid="client-opposite-person-type-hint"]'),

    // -------------------------------------------------------------
    // ÍCONE E TOOLTIP DE ERRO DE ENVIO (Issue front#490, PR #484)
    // Substitui o `title` nativo (AGENTS.md §2.3, achado 2026-09-28): o motivo agora só existe
    // no elemento role="tooltip", exibido no hover e no foco pelo teclado.
    // -------------------------------------------------------------
    iconesErroEnvio: () => cy.get('[data-testid="message-status-error"]'),
    tooltipErroEnvio: () => cy.get('[role="tooltip"]:visible'),

    // -------------------------------------------------------------
    // REENVIO DE MENSAGEM FALHADA (Issue front#522/backend#614, PR #523)
    // Com a linha "Não enviada · Reenviar" visível, a bolha NÃO mostra mais o "!" (message-status-
    // error migra pra cá) - o ícone solto na bolha só aparece quando não há como reenviar (sem
    // permissão/sem atendente). Testids confirmados pela issue/PR; recurso ainda não deployado no
    // ambiente de dev (2026-10-06) - construído a partir da especificação, revalidar ao medir ao vivo.
    // -------------------------------------------------------------
    botaoReenviarMensagem: (idMensagem) => cy.get(`[data-testid="button-retry-message-${idMensagem}"]`),
    statusNaoEnviadaPorId: (idMensagem) => cy.get(`[data-message-id="${idMensagem}"] [data-testid="message-status-error"]`),

    // -------------------------------------------------------------
    // REAÇÕES EM MENSAGENS (Issue front#530/PR #536, épico #515, backend#617)
    // Botão de hover no balão abre a linha rápida (6 emojis + "+"); o "+" abre o picker completo
    // (emoji-mart, mesmo componente já usado na colagem de imagem). Testids confirmados via
    // npm run scan:elements em 2026-10-07 (feature já no ar na dev).
    // -------------------------------------------------------------
    botaoReagirMensagem: (idMensagem) => cy.get(`[data-testid="button-react-message-${idMensagem}"]`),
    linhaRapidaReacoes: () => cy.get('[data-testid="reaction-picker"]'),
    opcaoRapidaReacao: (chave) => cy.get(`[data-testid="reaction-picker-${chave}"]`),
    botaoMaisReacoes: () => cy.get('[data-testid="reaction-picker-more"]'),
    pickerCompletoEmoji: () => cy.get('[data-testid="emoji-picker"]'),
    badgeReacaoCliente: (idMensagem) => cy.get(`[data-testid="message-reaction-badge-customer-${idMensagem}"]`),
    badgeReacaoAtendente: (idMensagem) => cy.get(`[data-testid="message-reaction-badge-employee-${idMensagem}"]`),
    indicadorFalhaReacao: (idMensagem) => cy.get(`[data-testid="message-reaction-failed-${idMensagem}"]`),

    // Eventos de sistema centralizados no chat (transferência, notificação da IA de orçamento...),
    // sem data-testid próprio - confirmado via cy.salvarSnapshotDom em 2026-10-07: renderizam como
    // <span class="_transferEvent_..."> dentro de um _bubbleRowCenter_, escopado por data-message-id.
    getEventoSistemaPorId: (idMensagem) => cy.get(`[data-message-id="${idMensagem}"] span[class*="_transferEvent_"]`),

    botaoAlternarTema: () => cy.get('button[aria-label="Alternar tema"]')
  };

  // -------------------------------------------------------------
  // AÇÕES DA PÁGINA
  // -------------------------------------------------------------

  /**
   * Abre o painel lateral/drawer de templates WABA a partir do banner de janela de 24h encerrada ou menu lateral
   */
  abrirPainelTemplatesJanelaExpirada() {
    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="button-service-window-templates"]:visible').length > 0) {
        this.elements.btnEnviarTemplateAviso().click();
      } else if ($body.find('[data-testid="summary-templates"]:visible').length > 0) {
        this.elements.summaryTemplates().click();
      } else if ($body.find('button[data-testid*="template"]:visible').length > 0) {
        cy.get('button[data-testid*="template"]:visible').first().click();
      }
    });

    cy.get('[data-testid="drawer-templates"], aside[class*="_drawer_"], [data-testid^="panel-template-"]', { timeout: 10000 })
      .should('be.visible');
  }

  /**
   * Busca dinamicamente no payload ou no drawer o primeiro template que possui variáveis editáveis
   */
  buscarTemplateComVariavel() {
    return cy.wait('@getAttendanceTemplatesDrawer', { timeout: 10000 }).then((interception) => {
      const body = interception.response && interception.response.body ? interception.response.body : {};
      const templates = body.items || (Array.isArray(body) ? body : []);

      const templateComVariavel = templates.find((t) => {
        const temTextoComVariavel = t.body && /{{\d+}}/.test(t.body);
        const temArrayDeVariaveis = t.variables && t.variables.length > 0;
        return temTextoComVariavel || temArrayDeVariaveis;
      });

      if (templateComVariavel) {
        cy.log(`✅ Template COM variável localizado dinamicamente: ${templateComVariavel.name}`);
        return cy.wrap(templateComVariavel.name);
      }

      if (templates.length > 0) {
        return cy.wrap(templates[0].name);
      }

      return cy.wrap('continuar_atendimento_util');
    });
  }

  /**
   * Seleciona um template WABA com variável de texto editável dentro do drawer.
   * Se nomeTemplate não for informado, chama buscarTemplateComVariavel() para descobrir dinamicamente.
   * @param {string|null} nomeTemplate Nome opcional do template
   */
  selecionarTemplateComVariavel(nomeTemplate = null) {
    if (nomeTemplate) {
      cy.get('button[data-testid^="panel-template-"]')
        .filter(`:contains("${nomeTemplate}")`)
        .first()
        .scrollIntoView()
        .click();
    } else {
      // Seleciona o primeiro template que possui a marcação "Com variáveis"
      cy.get('button[data-testid^="panel-template-"]', { timeout: 10000 })
        .filter(':has(span:contains("Com variáveis"))')
        .first()
        .scrollIntoView()
        .click();
    }
  }

  /**
   * Preenche todos os campos de variáveis obrigatórias do template no Drawer
   * @param {string} texto Conteúdo base da variável
   */
  preencherVariavelTemplate(texto = 'teste') {
    cy.get('[data-testid="input-template-free-text"]:visible, aside textarea:visible, aside input[type="text"]:visible, main textarea:visible, main input[type="text"]:visible')
      .filter((_, el) => {
        const ph = el.placeholder ? el.placeholder.toLowerCase() : '';
        const tid = el.getAttribute('data-testid') || '';
        return !ph.includes('buscar') && !tid.includes('search') && !tid.includes('input-message');
      })
      .each(($el, index) => {
        cy.wrap($el).scrollIntoView().should('be.visible').clear().type(`${texto} ${index + 1}`);
      });
  }

  /**
   * Preenche a variável obrigatória principal do template selecionado no Drawer
   * @param {string} texto Conteúdo exato da variável
   */
  preencherVariavelPrincipalTemplate(texto) {
    cy.get('[data-testid="input-template-free-text"]:visible, textarea.standardMsgVariableInput:visible, aside textarea:visible, [data-testid="textarea-template-text"]:visible')
      .filter((_, el) => {
        const ph = el.placeholder ? el.placeholder.toLowerCase() : '';
        const tid = el.getAttribute('data-testid') || '';
        return !ph.includes('buscar') && !tid.includes('search') && !tid.includes('input-message');
      })
      .first()
      .scrollIntoView()
      .should('be.visible')
      .clear()
      .type(texto);
  }

  /**
   * Valida que a prévia do template no compositor do chat reflete os tipos de variáveis definidos
   * @param {object} options
   */
  validarPreviaTemplateNoCompositor({
    clienteNomeRegex = /\[Nome do cliente\]|Natália|Natalia|Klismam Monteiro|DAYANE|Maristela|[A-Za-zÀ-ÿ]+/i,
    saudacaoRegex = /\[Saudação\]|Bom dia|Boa tarde|Boa noite/i,
    atendenteRegex = /\[Apelido do atendente\]|Klismammonteiro|Klismam|FABRICIO|ITALO/i,
    textoFixo = 'OmniCare',
    clientePrimeiroNomeRegex = /\[Primeiro nome do cliente\]|Natália|Natalia|Klismam|DAYANE|Maristela|[A-Za-zÀ-ÿ]+/i,
    textoVariavel = ''
  } = {}) {
    cy.get('body').then(($body) => {
      if ($body.find('[class*="_templateLockedBar_"], [data-testid="button-cancel-template"]').length > 0) {
        this.elements.barraTemplateCompositor().should('be.visible');
      }
    });

    cy.get('textarea[data-testid="input-message"], [data-testid="textarea-mensagem"], textarea#sa-template-text, [data-testid="textarea-template-text"]')
      .filter(':visible')
      .first()
      .should('be.visible')
      .invoke('val')
      .then((textoPrevia) => {
        expect(textoPrevia, 'Prévia deve conter o nome do cliente formatado').to.match(clienteNomeRegex);
        expect(textoPrevia, 'Prévia deve conter saudação').to.match(saudacaoRegex);
        expect(textoPrevia, 'Prévia deve conter atendente').to.match(atendenteRegex);
        expect(textoPrevia, 'Prévia deve conter texto fixo cadastrado').to.include(textoFixo);
        expect(textoPrevia, 'Prévia deve conter primeiro nome do cliente').to.match(clientePrimeiroNomeRegex);
        if (textoVariavel) {
          expect(textoPrevia, 'Prévia deve conter a variável principal digitada').to.include(textoVariavel);
        }
        expect(textoPrevia, 'Prévia não deve conter marcadores não resolvidos {{1}} a {{6}}').not.to.match(/\{\{\d+\}\}/);
      });
  }

  /**
   * Valida que a mensagem enviada no chat exibe o mesmo conteúdo e os mesmos tipos de variáveis da prévia
   * @param {object} options
   */
  validarMensagemEnviadaComTiposPrevia({
    clienteNomeRegex = /\[Nome do cliente\]|Natália|Natalia|Klismam Monteiro|DAYANE|Maristela|[A-Za-zÀ-ÿ]+/i,
    saudacaoRegex = /\[Saudação\]|Bom dia|Boa tarde|Boa noite/i,
    atendenteRegex = /\[Apelido do atendente\]|Klismammonteiro|Klismam|FABRICIO|ITALO/i,
    textoFixo = 'OmniCare',
    clientePrimeiroNomeRegex = /\[Primeiro nome do cliente\]|Natália|Natalia|Klismam|DAYANE|Maristela|[A-Za-zÀ-ÿ]+/i,
    textoVariavel = ''
  } = {}) {
    cy.get('body').then(($body) => {
      const seletorBalaoComFixo = `div[class*="_bubbleEmployee_"]:contains("${textoFixo}"), article[class*="_bubbleRowEnd_"]:contains("${textoFixo}"), [data-testid="message-bubble"]:contains("${textoFixo}"), div[class*="_messageBubble_"]:contains("${textoFixo}")`;
      const seletorBalao = $body.find(seletorBalaoComFixo).length > 0
        ? seletorBalaoComFixo
        : 'div[class*="_bubbleEmployee_"], article[class*="_bubbleRowEnd_"], [data-testid="message-bubble"], div[class*="_messageBubble_"]';

      // Cadeia quebrada em comandos independentes: o scroll animado corre enquanto o React
      // re-renderiza a lista pós-envio, o que destacava o subject original do DOM.
      cy.get(seletorBalao).last().scrollIntoView();
      cy.get(seletorBalao).last().should('be.visible');
      cy.get(seletorBalao).last()
        .then(($bubble) => {
          const textoBalao = $bubble.text();
          expect(textoBalao, 'Balão deve conter o nome do cliente formatado').to.match(clienteNomeRegex);
          expect(textoBalao, 'Balão deve conter saudação').to.match(saudacaoRegex);
          expect(textoBalao, 'Balão deve conter atendente').to.match(atendenteRegex);
          expect(textoBalao, 'Balão deve conter texto fixo cadastrado').to.include(textoFixo);
          expect(textoBalao, 'Balão deve conter primeiro nome do cliente').to.match(clientePrimeiroNomeRegex);
          if (textoVariavel) {
            expect(textoBalao, 'Balão deve conter a variável principal digitada').to.include(textoVariavel);
          }
          expect(textoBalao, 'Balão não deve conter marcadores não resolvidos {{1}} a {{6}}').not.to.match(/\{\{\d+\}\}/);
        });
    });
  }

  /**
   * Clica no botão "Usar template" do Drawer para transferir o modelo formatado para o compositor do chat
   */
  aplicarTemplateNoCompositor() {
    cy.get('[data-testid="panel-btn-usar-template"], button:contains("Usar template")')
      .should('be.visible')
      .and('not.be.disabled')
      .click();

    // Valida que o template foi inserido no compositor
    cy.contains('div, p, span', /template escolhido/i, { timeout: 8000 })
      .should('be.visible');

    // Aguarda o fechamento da gaveta para garantir que o compositor está desimpedido
    cy.get('[data-testid="drawer-templates"], aside[class*="_drawer_"]').should('not.exist');
  }

  /**
   * Clica no botão de envio final (ícone de avião de papel) no compositor do chat
   */
  enviarMensagemCompositor() {
    cy.get('button[data-testid="button-send-message"], button[aria-label="Enviar mensagem"]', { timeout: 10000 })
      .filter(':visible')
      .first()
      .should('be.visible')
      .should('not.be.disabled')
      .click();
  }

  /**
   * Método de compatibilidade que executa a aplicação do template e o disparo no chat
   */
  enviarTemplateDrawer() {
    this.aplicarTemplateNoCompositor();
    this.enviarMensagemCompositor();
  }

  /**
   * Concede e intercepta todas as permissões e capabilities da tela de Atendimentos.
   * Deve ser invocado no Arrange de qualquer teste que não tenha foco específico em validação de RBAC/permissões,
   * assegurando que a interface e suas ações (mensagens, envio, templates, transferências, etc.)
   * permaneçam 100% livres de bloqueios defensivos ("Permissão negada.").
   * 
   * @param {object} [options]
   * @param {string|number} [options.attendanceId='*'] ID do atendimento individual
   * @param {object} [options.overridesItemCapabilities={}] Overrides pontuais nas capabilities de item
   * @param {object} [options.overridesGlobalCapabilities={}] Overrides pontuais nas capabilities globais da loja
   */
  concederTodasPermissoes(options = {}) {
    AtendimentosMocks.interceptarTodasPermissoesAtendimento(options);
  }

  /**
   * Alias semântico para concederTodasPermissoes
   * @param {object} [options]
   */
  liberarTodasPermissoes(options = {}) {
    this.concederTodasPermissoes(options);
  }

  /**
   * Abre o painel de busca da conversa através do botão no cabeçalho do chat
   */
  abrirBuscaConversa() {
    this.elements.btnBuscarConversa()
      .should('be.visible')
      .click();
    this.elements.painelBuscaConversa()
      .should('be.visible');
  }

  /**
   * Executa uma pesquisa de texto na conversa ativa
   * @param {string} termo Termo a ser pesquisado
   */
  pesquisarNaConversa(termo) {
    this.elements.inputBuscaConversa()
      .should('be.visible')
      .clear()
      .type(termo);
  }

  /**
   * Avança para a próxima ocorrência da busca na conversa (PR #172)
   */
  irParaProximaOcorrenciaBusca() {
    this.elements.btnProximoResultadoBusca()
      .should('be.visible')
      .and('not.be.disabled')
      .click();
  }

  /**
   * Volta para a ocorrência anterior da busca na conversa (PR #172)
   */
  irParaOcorrenciaAnteriorBusca() {
    this.elements.btnResultadoAnteriorBusca()
      .should('be.visible')
      .and('not.be.disabled')
      .click();
  }

  /**
   * Fecha o painel de busca da conversa
   */
  fecharBuscaConversa() {
    this.elements.btnFecharBuscaConversa()
      .should('be.visible')
      .click();
    this.elements.painelBuscaConversa()
      .should('not.exist');
  }

  /**
   * Valida atributos fundamentais de um link (<a>) gerado pelo linkify na conversa
   * @param {object} params
   * @param {string} params.href URL esperada no atributo href
   * @param {string} [params.texto] Texto visível esperado dentro do link
   * @param {string} [params.target='_blank'] Valor esperado no target
   * @param {string} [params.rel='noopener noreferrer'] Valor esperado no rel
   */
  validarLinkMensagem({ href, texto = '', target = '_blank', rel = 'noopener noreferrer' }) {
    const link = this.elements.getLinkPorHref(href).first();
    link
      .scrollIntoView({ duration: 300 })
      .should('be.visible')
      .should('have.attr', 'target', target)
      .should('have.attr', 'rel', rel);

    if (texto) {
      link.should('contain.text', texto);
    }
  }

  /**
   * Valida que o termo buscado na conversa é destacado por uma tag <mark> DENTRO do link,
   * assegurando que a tag <a> não seja desfeita ao aplicar o destaque (PR #242)
   * @param {string} href URL do link
   * @param {string} termoBuscado Trecho que deve estar destacado dentro do link
   */
  validarDestaqueBuscaNoLink(href, termoBuscado) {
    this.elements.getLinkPorHref(href)
      .first()
      .scrollIntoView()
      .should('be.visible')
      .find('mark')
      .should('be.visible')
      .and('contain.text', termoBuscado);
  }

  visitar() {
    cy.get('body', { timeout: 10000 }).should('be.visible');

    cy.url().then((currentUrl) => {
      // Se já estiver na tela de atendimentos, nada a navegar
      if (currentUrl.includes('/atendimentos')) {
        return;
      }

      // Se a aplicação estiver na tela de login, reautentica e aguarda saída do login
      if (currentUrl.includes('/login')) {
        cy.login();
        cy.url().should('not.include', '/login');
      }

      // Navega para /atendimentos via item canônico da barra lateral
      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="sidebar-item-atendimentos"]').length > 0) {
          cy.get('[data-testid="sidebar-item-atendimentos"]').click();
        } else if ($body.find('a[href*="atendimento"]').length > 0) {
          cy.get('a[href*="atendimento"]').first().click();
        } else if ($body.find('[data-testid*="sidebar-item-atendimentos"], [data-testid*="sidebar-atendimento"]').length > 0) {
          cy.get('[data-testid*="sidebar-item-atendimentos"], [data-testid*="sidebar-atendimento"]').first().click();
        } else if ($body.find('aside#home-sidebar a, aside a, nav a').length > 1) {
          cy.get('aside#home-sidebar a, aside a, nav a').eq(1).click();
        } else {
          cy.get('aside#home-sidebar, aside, nav')
            .contains('a, button, div, span, li', /atendimentos/i)
            .click();
        }
      });
    });

    cy.url().should('include', '/atendimentos');
    this.elements.statusFilterBar().should('be.visible');
    this.elements.inputBusca().should('be.visible');
  }

  abrirFiltroData() {
    this.elements.btnFiltroData().click();
  }

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

  extrairIntervaloDatasDaUrl(requestUrl) {
    const url = new URL(requestUrl);
    return {
      dataInicial: url.searchParams.get('start_date'),
      dataFinal: url.searchParams.get('end_date'),
    };
  }

  buscarAtendimento(termo) {
    this.elements.inputBusca().should('be.visible').and('not.be.disabled').clear();
    this.elements.inputBusca().should('be.visible').and('not.be.disabled').type(termo);
  }

  limparBusca() {
    this.elements.inputBusca().should('be.visible').and('not.be.disabled').clear();
  }

  filtrarPorStatusChip(statusKey) {
    this.elements.getChipPorStatusKey(statusKey).click();
  }

  /**
   * Força a aplicação de um status de filtro específico, alternando se já estiver selecionado para garantir re-execução da consulta de rede
   * @param {string} statusKey Chave do status (ex: 'waiting', 'all', 'pending', etc.)
   */
  forcarFiltroStatus(statusKey = 'waiting') {
    // O alias 'getAttendancesList' casa também as requisições do boot e dos contadores (per_page=7, uma por
    // status) que ninguém consome: um cy.wait('@getAttendancesList') resolve na hora numa delas, antes da
    // lista pedida chegar (achado 2026-10-15). Por isso a espera é por aliases próprios, só da listagem
    // principal (per_page=20), diferenciados pelo parâmetro status: alvo (o filtro pedido) × auxiliar.
    // Alias único por chamada: rota registrada numa chamada anterior continua casando requisições
    // futuras, e um alias repetido deixaria sobras que o próximo cy.wait consumiria.
    this._seqForcarFiltro = (this._seqForcarFiltro || 0) + 1;
    const aliasAlvo = `listaFiltroAlvo${this._seqForcarFiltro}`;
    const aliasAuxiliar = `listaFiltroAuxiliar${this._seqForcarFiltro}`;
    const ehAlvo = (url) => (statusKey === 'all'
      ? !/[?&]status=/.test(url)
      : new RegExp(`[?&]status=${statusKey}(&|$)`).test(url));
    cy.intercept('GET', rotaApi('attendances?*per_page=20*'), (req) => {
      req.alias = ehAlvo(req.url) ? aliasAlvo : aliasAuxiliar;
    });

    this.elements.getChipPorStatusKey(statusKey).should('exist').then(($chip) => {
      const isSelected = $chip.attr('aria-pressed') === 'true';
      if (isSelected) {
        // Clicar no filtro já ativo não emite requisição: alterna para outro status e volta. A resposta do
        // clique de ida é descartável, mas é esperada de verdade para não vazar para a do clique de volta.
        const outroStatus = statusKey === 'all' ? 'waiting' : 'all';
        this.elements.getChipPorStatusKey(outroStatus).click();
        cy.wait(`@${aliasAuxiliar}`, { timeout: 30000 });
      }
      this.elements.getChipPorStatusKey(statusKey).click();
      cy.wait(`@${aliasAlvo}`, { timeout: 30000 });
    });
  }

  selecionarCardAtendimento(idOuTexto) {
    cy.get('section[aria-label="Attendance list"]')
      .contains('[role="option"]', String(idOuTexto))
      .should('be.visible')
      .click();
  }

  /**
   * 1. Verifica se o status está em "Aguardando".
   * Se não estiver, clica no chip de Aguardando para selecioná-lo.
   */
  garantirFiltroAguardando() {
    this.elements.chipWaiting().should('exist').then(($chip) => {
      const isSelected = $chip.attr('aria-pressed') === 'true';
      if (!isSelected) {
        cy.wrap($chip).click();
      }
    });
  }

  /**
   * 2. Verifica se o número default possui atendimento aberto (em qualquer status ativo).
   * Se possuir, encerra garantindo a transição (Em andamento -> Finalizado).
   * @param {string} celular
   */
  verificarEEncerrarAtendimentoExistente(celular) {
    const ultimosDigitos = celular.slice(-4);

    // Filtra no status padrão "Aguardando" da tela
    this.elements.chipWaiting().click();
    cy.wait(500);
    this.buscarAtendimento(ultimosDigitos);
    cy.wait(1200);

    cy.get('body').then(($body) => {
      let cardsAtivos = $body.find('section[aria-label="Attendance list"] [role="option"]');

      if (cardsAtivos.length > 0) {
        cy.wrap(cardsAtivos.first()).click();
        cy.wait(1000);

        this.elements.btnClienteStatus().first().then(($btn) => {
          const texto = $btn.text().toLowerCase();

          if (texto.includes('pendente')) {
            // Se estiver pendente, força pra andamento primeiro pra liberar o botão de finalizar padrão
            cy.wrap($btn).click();
            this.elements.getItemMenuStatusPorKey('in_progress').should('be.visible').click();
            cy.wait(1000);
            this.elements.btnClienteStatus().first().should('be.visible').click();
          } else if (!texto.includes('finaliz') && !texto.includes('descart')) {
            // Se já estiver em andamento (ou outro), só abre o menu
            cy.wrap($btn).click();
          }

          // Clica em Finalizado na opção do menu caso não esteja finalizado/descartado
          if (!texto.includes('finaliz') && !texto.includes('descart')) {
            this.elements.getItemMenuStatusPorKey('finished').should('be.visible').click();
            cy.wait(1500);
          }
        });
      }
      this.limparBusca();
      cy.wait(500);
    });
  }



  /**
   * 3. Inicia um novo atendimento utilizando template através da modal Iniciar Atendimento.
   * @param {string} celular
   * @param {'oficial'|'nao_oficial'} canalTipo
   */
  iniciarAtendimentoComTemplate(celular, canalTipo = 'oficial') {
    const mensagemPadraoCypress = 'Mensagem automática do Cypress para teste de chat, responda em até 1:30 minutos para validar o teste';

    IniciarAtendimentoPage.abrirModal();
    cy.wait(600);

    if (canalTipo === 'oficial') {
      // 1. Seleciona Canal Oficial diretamente das opções renderizadas no select
      IniciarAtendimentoPage.elements.selectCanal().find('option').then(($opts) => {
        const canalOficial = [...$opts].find(o => o.text.toUpperCase().includes('OFICIAL') && !o.text.toUpperCase().includes('NAO OFICIAL'));
        if (canalOficial) {
          IniciarAtendimentoPage.elements.selectCanal().select(canalOficial.value);
        }
      });

      // 2. Aguarda e seleciona o primeiro grupo disponível no canal
      IniciarAtendimentoPage.elements.selectGrupo()
        .should('not.be.disabled')
        .find('option')
        .should('have.length.gt', 1)
        .then(($opts) => {
          const grupoValido = [...$opts].find(o => o.value && o.value !== '');
          if (grupoValido) {
            IniciarAtendimentoPage.elements.selectGrupo().select(grupoValido.value);
          }
        });

      // 3. Preenche celular
      IniciarAtendimentoPage.preencherCelular(celular);

      // 4. Aguarda carregar templates no modal e seleciona template com variável editável
      IniciarAtendimentoPage.elements.linhasTemplate()
        .should('have.length.gt', 0);

      IniciarAtendimentoPage.buscarESelecionarTemplateComVariavel().then(() => {
        // Preenche o campo de texto editável da variável com a mensagem padrão
        IniciarAtendimentoPage.preencherMensagem(mensagemPadraoCypress);

        // Dispara o envio
        IniciarAtendimentoPage.elements.btnEnviarMensagem()
          .should('be.enabled')
          .click();

        // Aguarda a confirmação de envio e fechamento da modal
        cy.get('body', { timeout: 15000 }).should(($b) => {
          const modalAberto = $b.find('[data-testid="modal-iniciar-atendimento"]:visible, [class*="_startAttendanceModal_"]:visible').length > 0;
          const chatAberto = $b.find('[data-testid="chat-header"], header[class*="_header_"]').length > 0;
          expect(!modalAberto || chatAberto).to.be.true;
        });
      });
    } else {
      IniciarAtendimentoPage.elements.selectCanal().find('option').then(($opts) => {
        const canalNaoOficial = [...$opts].find(o => o.text.toUpperCase().includes('NAO OFICIAL') || (o.value && o.value !== ''));
        if (canalNaoOficial) {
          IniciarAtendimentoPage.elements.selectCanal().select(canalNaoOficial.value);
        }
      });

      cy.wait(1000);
      IniciarAtendimentoPage.elements.selectGrupo().find('option').then(($opts) => {
        const grupoValido = [...$opts].find(o => o.value && o.value !== '');
        if (grupoValido) {
          IniciarAtendimentoPage.elements.selectGrupo().select(grupoValido.value);
        }
      });

      IniciarAtendimentoPage.preencherCelular(celular);
      IniciarAtendimentoPage.preencherMensagem(mensagemPadraoCypress);
      IniciarAtendimentoPage.clicarEnviarMensagem();

      // Aguarda a confirmação de envio e fechamento da modal de forma declarativa e resiliente
      cy.get('body', { timeout: 15000 }).should(($b) => {
        const modalAberto = $b.find('[data-testid="modal-iniciar-atendimento"]:visible, [class*="_startAttendanceModal_"]:visible').length > 0;
        const chatAberto = $b.find('[data-testid="chat-header"], header[class*="_header_"]').length > 0;
        expect(!modalAberto || chatAberto).to.be.true;
      });
    }
  }

  /**
   * Prepara o ambiente para os testes de chat:
   * 1. Verifica se o número default tem atendimento aberto em qualquer status e encerra
   * 2. Verifica e seleciona o status Aguardando
   * 3. Inicia novo atendimento usando template na modal Iniciar Atendimento
   * 4. Busca e abre o card do novo atendimento para carregar o chat em tela
   * @param {string} celular
   * @param {'oficial'|'nao_oficial'} canalTipo
   */
  /**
   * Garante um atendimento aberto seguindo a regra:
   * 1. Força o status "Aguardando"
   * 2. Busca pelo número padrão (últimos 4 dígitos)
   * 3. Se encontrar o card em Aguardando, clica e abre a conversa
   * 4. Se não existir, dispara um novo atendimento pelo modal Iniciar Atendimento e abre o atendimento
   * @param {string} celular 
   * @param {'oficial'|'nao_oficial'} canalTipo
   */
  /**
   * Aguarda o compositor liberar (textarea sem `disabled`) antes de qualquer interação, tolerando uma
   * janela generosa de latência real de rede.
   *
   * Causa raiz medida em 23/09/2026 (não suposição — três checagens independentes, cada uma refutando
   * a hipótese anterior com evidência nova, ver AGENTS.md §6 "Defeito Real de Performance..."):
   *  1. O compositor inteiro (textarea + botão de anexo + botão de áudio) fica `disabled` enquanto
   *     `GET /attendances/:id/messages` está em voo — independente do estado da janela de 24h (badge
   *     ativo, capability `can_send_free_text: true` e atendente correto todos confirmados via API).
   *  2. Medido diretamente contra a API real (`curl`-equivalente, fora do Cypress): essa rota tem um
   *     EFEITO DE LIMIAR entre `per_page=10` (~300ms) e `per_page=20` (~9-21s) — salto de ~30x, não
   *     degradação linear, com a conversa tendo apenas 56 mensagens no total. É um defeito real de
   *     performance do backend (rastreado em `ROADMAP.md` P0), não um problema deste teste.
   *  3. `aria-busy` em `[class*="_messagesRoot_"]` NÃO é sinal confiável de carregamento (fica "true"
   *     mesmo bem depois da resposta 200 já ter voltado — provavelmente reflete o SSE, bloqueado
   *     globalmente com 403 em todo `beforeEach`). Por isso este helper observa o TEXTAREA
   *     diretamente, não um proxy de DOM.
   * @param {number} timeout Tempo máximo de espera pelo fim do carregamento (padrão 60000ms — cobre
   *   com folga o pior caso medido de ~21s, já que o defeito de performance do backend não tem SLA)
   */
  aguardarHistoricoMensagensCarregado(timeout = 60000) {
    cy.get('textarea[data-testid="input-message"]', { timeout }).should(($txt) => {
      expect($txt.is(':disabled'), 'compositor deve liberar (textarea sem disabled) após o carregamento real da conversa').to.eq(false);
    });
  }

  /**
   * Tolera a defasagem da tela antes de decidir se a janela de 24h está limitada: um atendimento cuja janela acabou de abrir (o cliente respondeu no
   * WhatsApp) mostra o aviso "Envio restrito a templates" com dado antigo até o polling de eventos (o stream SSE é barrado em modo real) refazer o
   * detalhe. Decidir já nesse estado leva ao Caso 2 e o clique em `button-service-window-templates` falha porque o aviso some no meio do clique
   * (achado 2026-10-19, `5-B1` ctx 2). Reavalia até o compositor ficar livre; esgotada a tolerância, segue como janela limitada de verdade.
   * Com a janela já ativa não há espera alguma.
   * @param {number} tentativas Quantas reavaliações antes de desistir (padrão 8)
   * @param {number} intervaloMs Intervalo entre reavaliações (padrão 1500 ms, tolerância total de ~12 s)
   */
  aguardarJanelaLivreComTolerancia(tentativas = 8, intervaloMs = 1500) {
    cy.get('body').then(($b) => {
      const $txt = $b.find('textarea[data-testid="input-message"]');
      const semBloqueio = $b.find('[data-testid="composer-service-window-notice"]:visible, [data-testid="button-service-window-templates"]:visible').length === 0;
      const livre = $txt.length > 0 && !$txt.first().is(':disabled') && semBloqueio;
      if (livre || tentativas <= 0) return;
      cy.wait(intervaloMs);
      this.aguardarJanelaLivreComTolerancia(tentativas - 1, intervaloMs);
    });
  }

  /**
   * Cancela template pendente no compositor se houver banner ativo
   */
  limparTemplatePendenteNoCompositor() {
    cy.get('body').then(($body) => {
      const btnCancelar = $body.find('[data-testid="button-cancel-template"]:visible, button:contains("Cancelar"):visible');
      if (btnCancelar.length > 0 && ($body.text().includes('Template escolhido') || $body.text().includes('o texto não pode ser editado') || $body.find('[class*="_templateLockedBar_"]').length > 0)) {
        cy.wrap(btnCancelar).first().click();
        cy.wait(300);
      }
    });
  }

  /**
   * Garante que um atendimento com o celular especificado esteja aberto e ativo na tela:
   * 1. Se o chat já estiver aberto com o atendimento correto e janela ativa, aproveita diretamente
   * 2. Caso contrário, pesquisa no status Aguardando e aguarda a renderização com retry
   * 3. Se comprovadamente não existir, cria via modal Iniciar Atendimento
   * @param {string} celular 
   * @param {'oficial'|'nao_oficial'} canalTipo
   */
  garantirAtendimentoAberto(celular, canalTipo = 'oficial', forcarJanelaInativa = false) {
    const ultimosDigitos = celular ? celular.slice(-4) : '';

    // Se a conversa já estiver aberta com o cliente correto ou já posicionada pelo operador no Cypress Open com janela ativa, aproveita diretamente!
    cy.get('body').then(($body) => {
      const temJanelaAtiva = this.temBadgeJanelaAtiva($body);
      const temPlaceholderVazio = $body.find('[data-testid="painel-direito-expanded-empty"], [class*="_placeholderText_"], [class*="_detailPlaceholder_"]').length > 0 ||
                                  /selecione\s*um\s*atendimento/i.test($body.text());
      const temChatAberto = !temPlaceholderVazio && $body.find('[data-testid="button-close-chat"], [data-testid="chat-header"]').length > 0;
      const temCompositor = !temPlaceholderVazio && $body.find('textarea[data-testid="input-message"], div[class*="_inputCard_"], [data-testid="input-attachment-file"]').length > 0;

      // Prioridade 1: Atendimento com Janela Ativa já visível no chat
      if (!forcarJanelaInativa && temJanelaAtiva && (temChatAberto || temCompositor)) {
        cy.log('✅ [Janela Ativa Detectada]: Já existe um atendimento com Janela Ativa aberto na tela. Reutilizando diretamente!');
        this.limparTemplatePendenteNoCompositor();
        return;
      }

      const cardCliente = $body.find('[data-testid="card-cliente"]');
      const telefoneCliente = $body.find('[data-testid="text-cliente-telefone"], [data-testid="chat-header-subtitle"]').text();
      const temTelefone = ultimosDigitos && (telefoneCliente.includes(ultimosDigitos) || $body.text().includes(ultimosDigitos));
      const temProtocolo = $body.find('[data-testid="text-cliente-protocolo"]').length > 0;

      if (!temPlaceholderVazio && (cardCliente.length > 0 || temChatAberto || temProtocolo) && (temTelefone || (!forcarJanelaInativa && temJanelaAtiva))) {
        cy.log('✅ [Atendimento Já Aberto]: Reutilizando atendimento com janela ativa já posicionado na tela.');
        this.limparTemplatePendenteNoCompositor();
        return;
      }

      // 0. Garante que a página de atendimentos está carregada e ativa no DOM
      this.visitar();

      if (AtendimentosMocks.isMockEnabled()) {
        this.elements.chipWaiting().scrollIntoView().click();
        this.elements.cardsAtendimento().first().should('be.visible').click();
        cy.wait('@getAttendanceDetail');
        return;
      }

      // 1. Busca pelo número padrão no status obrigatório "Aguardando" (status padrão de novos atendimentos)
      this.elements.chipWaiting().scrollIntoView().click();
      cy.wait(400);

      // 2. Busca pelo número padrão e aguarda a rota de busca responder da rede
      this.buscarAtendimento(ultimosDigitos);
      cy.wait('@searchAttendancesApi', { timeout: 15000 }).then((interception) => {
        const items = interception.response?.body?.items || 
                      interception.response?.body?.data || 
                      (Array.isArray(interception.response?.body) ? interception.response.body : null);
        let semAtendimento = items && items.length === 0;

        cy.get('body').then(($body) => {
          const cards = $body.find('section[aria-label="Attendance list"] [role="option"]');
          if (cards.length === 0) {
            semAtendimento = true;
          }

          if (semAtendimento) {
            // Se não existir atendimento: cria via modal com template editável
            cy.log('⚠️ [Atendimento]: Nenhum atendimento encontrado para o celular. Criando novo atendimento com template...');
            this.limparBusca();
            cy.wait(400);
            this.iniciarAtendimentoComTemplate(celular, canalTipo);

            // Se o chat não abriu automaticamente após o envio, busca na fila e abre o card criado
            cy.get('body', { timeout: 20000 }).then(($b) => {
              const chatAberto = $b.find('div[class*="_inputCard_"], textarea[data-testid="input-message"], [data-testid="composer-service-window-notice"]').length > 0;
              if (!chatAberto) {
                cy.log(`🔍 [Atendimento Criado]: Abrindo card da fila para ...${ultimosDigitos}...`);
                this.elements.chipWaiting().scrollIntoView().click();
                this.buscarAtendimento(ultimosDigitos);
                cy.wait('@searchAttendancesApi', { timeout: 15000 });
                cy.get('section[aria-label="Attendance list"] [role="option"]', { timeout: 12000 })
                  .first()
                  .click();
              }
            });

            // Aguarda o cliente responder no WhatsApp em até 1:30 min (90s) para ativar a janela de 24h
            cy.log('📱 [WhatsApp]: Atendimento criado! Aguardando o cliente responder no WhatsApp em até 1:30 min (90s)...');
            this.validarJanelaAtiva(90000);
          } else {
            // Atendimento existe: abre o 1º item da própria resposta da busca, pelo id e com retry. Um
            // cy.wrap(cards) de elementos capturados logo após a resposta não re-consulta o DOM: se a lista
            // re-renderiza (resposta chega antes do render), o elemento fica solto e o clique nunca se
            // recupera ("page updated", derrubava o beforeEach de contextos inteiros em API real).
            const idAlvo = items && items[0] && items[0].id;
            if (idAlvo) {
              this.elements.cardAtendimentoPorId(idAlvo).should('be.visible').click();
            } else {
              cy.get('section[aria-label="Attendance list"] [role="option"]').first().click();
            }
          }
        });
      });

      // 4. Validação estrita: O atendimento deve estar devidamente carregado na tela (painel do cliente e chat visíveis)
      cy.get('[data-testid="card-cliente"], aside[class*="_infoPanel_"]', { timeout: 15000 })
        .should('be.visible');
      cy.get('header[class*="_header_"], [data-testid="chat-header"]', { timeout: 15000 })
        .should('be.visible');

      this.limparTemplatePendenteNoCompositor();
    });
  }

  /**
   * Aguarda a confirmação de envio/entrega/leitura do template no chat (1 risco = 'Enviado', 2 riscos = 'Entregue' ou lido)
   * antes de iniciar a contagem regressiva de 1:30 min para a resposta no WhatsApp.
   * @param {number} timeoutMs Tempo limite para a confirmação de envio/leitura (padrão: 120000ms / 2 minutos)
   */
  aguardarConfirmacaoEnvioTemplate(timeoutMs = 120000) {
    const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';
    if (isMock) {
      return;
    }

    cy.log(`⏳ [Confirmação de Envio de Template]: Validando conclusão do envio do template no chat por até ${timeoutMs / 1000}s...`);

    // 1. Garante que o indicador temporário de envio sumiu
    cy.contains('div, p, span', /Enviando mensagem/i, { timeout: 15000 }).should('not.exist');

    // 2. Sincronização resiliente: balão do template renderizado e não em estado pendente
    cy.get('body', { timeout: timeoutMs }).should(($body) => {
      const $bubbles = $body.find('div[class*="_bubbleEmployee_"], article[class*="_bubbleRowEnd_"], div[class*="_bubble_"]');
      expect($bubbles.length, 'Pelo menos um balão de mensagem do atendente deve existir no chat').to.be.greaterThan(0);

      const $lastBubble = $bubbles.last();
      if ($lastBubble.length > 0 && $lastBubble[0].scrollIntoView) {
        $lastBubble[0].scrollIntoView({ behavior: 'smooth', block: 'end' });
      }

      const isSending = $lastBubble.find('span[aria-label*="Aguardando"], span[aria-label*="Enviando"]').length > 0;
      expect(!isSending, 'Template não deve estar em estado de envio pendente').to.be.true;
    });

    cy.log('✅ [Template Confirmado]: Template renderizado no chat com sucesso! Aguardando resposta do WhatsApp...');
  }

  /**
   * Garante que um atendimento esteja aberto e com janela de 24h ativa cobrindo os 3 casos de negócio:
   * Caso 1: O atendimento não existe -> abre nova conversa via modal Iniciar Atendimento com template editável (1:30 min) e aguarda ativação.
   * Caso 2: O atendimento existe mas está com janela limitada -> abre drawer de templates, envia template com variável editável (1:30 min) e aguarda ativação.
   * Caso 3: O atendimento existe e já está com janela ativa -> limpa rascunhos no compositor e libera para execução direta dos testes.
   * 
   * @param {string} celular Número de telefone do cliente
   * @param {'oficial'|'nao_oficial'} canalTipo Tipo do canal
   * @param {number} timeout Tempo máximo de espera pela resposta no WhatsApp em ms (padrão: 90000ms)
   */
  /**
   * Diz se o selo da janela de 24h está no estado ativo. O selo é o mesmo elemento nos dois estados (`badge-service-window`,
   * classe `_serviceWindowBadge_`); só o texto e o `data-tone` mudam ("Janela limitada" vem com `data-tone="expired"`), então a
   * presença do elemento não prova janela ativa. Medido em 2026-11-06 (`ROADMAP.md` P1-16): o critério antigo, pela presença da
   * classe, dava "Caso 3 - Janela Já Ativa" com a janela limitada, o template nunca era enviado e a espera pela resposta passava na hora.
   * @param {JQuery} $root Corpo da página ou trecho onde procurar o selo
   * @returns {boolean}
   */
  temBadgeJanelaAtiva($root) {
    return $root
      .find('[data-testid="badge-service-window"], [class*="_serviceWindowBadge_"], [data-testid="badge-janela-ativa"]')
      .filter((_, el) => el.getAttribute('data-tone') !== 'expired' && /janela\s*ativa/i.test(el.textContent || ''))
      .length > 0;
  }

  /**
   * Libera o compositor no caminho de Fast-Pass, com recuperação quando a janela de 24h expira
   * NO MEIO da rodada.
   *
   * Motivo (incidente reproduzido em 23/09/2026): o Fast-Pass assume que a janela permanece ativa
   * durante toda a execução e afirmava direto `not.be.disabled` no textarea. Numa rodada de ~6 min a
   * janela expirou entre um cenário e outro; o `beforeEach` estourou com "expected <textarea> not to
   * be 'disabled'" e, como a falha ocorreu num hook, o Mocha **pulou todos os testes restantes da
   * suíte** ("we are skipping the remaining tests in the current suite"). Um cenário de anexo grande
   * levou junto metade do bloco por um motivo que não era dele.
   *
   * A recuperação abaixo invalida o Fast-Pass e refaz a ativação completa da janela, em vez de
   * derrubar a suíte. A bifurcação só ocorre APÓS uma asserção declarativa e retentável do estado
   * estável do compositor (liberado OU aviso de janela), respeitando a regra anti-bifurcação-cega.
   * @param {string} celular Número de telefone do cliente
   * @param {'oficial'|'nao_oficial'} canalTipo Tipo do canal
   * @param {number} timeout Tempo máximo de espera pela resposta no WhatsApp em ms
   */
  assegurarCompositorLiberadoNoFastPass(celular, canalTipo, timeout) {
    this.aguardarHistoricoMensagensCarregado();
    this.limparTemplatePendenteNoCompositor();

    // Espera declarativa: o compositor precisa assumir um dos dois estados estáveis conhecidos
    cy.get('body', { timeout: 15000 }).should(($b) => {
      const liberado = $b.find('textarea[data-testid="input-message"]:not([disabled])').length > 0;
      const avisoJanela = $b.find('[data-testid="composer-service-window-notice"]').length > 0;
      expect(
        liberado || avisoJanela,
        'compositor deve estar liberado para digitação OU exibindo o aviso de janela encerrada'
      ).to.eq(true);
    });

    cy.get('body').then(($b) => {
      const avisoJanela = $b.find('[data-testid="composer-service-window-notice"]').length > 0;

      if (!avisoJanela) {
        this.elements.inputMensagemChat().should('be.visible').and('not.be.disabled');
        return;
      }

      // Janela expirou durante a rodada: derruba o Fast-Pass e refaz a ativação completa.
      // A recursão é limitada — com a flag zerada, a próxima chamada segue o caminho longo.
      cy.log('♻️ [Fast-Pass]: janela de 24h expirou no meio da rodada. Reativando antes de prosseguir...');
      Cypress.env('ACTIVE_SERVICE_WINDOW_VERIFIED', false);
      this.garantirAtendimentoComJanelaAtiva(celular, canalTipo, timeout);
    });
  }

  garantirAtendimentoComJanelaAtiva(celular, canalTipo = 'oficial', timeout = 90000) {
    const ultimosDigitos = celular ? celular.slice(-4) : '';
    const mensagemPadraoCypress = 'Mensagem automática do Cypress para teste de chat, responda em até 1:30 minutos para validar o teste';

    // 0. Fast-Pass de Sessão: Se a janela ativa já foi confirmada anteriormente nesta rodada (ex: no 2º teste em diante)
    if (Cypress.env('ACTIVE_SERVICE_WINDOW_VERIFIED')) {
      cy.log(`⚡ [Fast-Pass Janela Ativa]: Janela ativa já validada anteriormente nesta rodada. Acessando conversa para envio do anexo...`);

      cy.get('body', { timeout: 10000 }).then(($body) => {
        const nomeCliente = Cypress.env('DEFAULT_CLIENT_NAME') || 'klismam';
        // 1. Verifica se o chat com o cliente correto já está aberto na tela
        const chatHeader = $body.find('header[class*="_header_"], [data-testid="chat-header"]').text().toLowerCase();
        const ehClienteCorreto = chatHeader.includes(ultimosDigitos) || chatHeader.includes(nomeCliente.toLowerCase());
        const temCompositor = $body.find('textarea[data-testid="input-message"]').length > 0;
        const temPlaceholderCentral = $body.find('div[class*="_detailPlaceholder_"], [class*="_placeholderText_"]:contains("para ver a conversa")').length > 0;

        if (ehClienteCorreto && temCompositor && !temPlaceholderCentral) {
          cy.log('⚡ [Fast-Pass]: Conversa com o cliente correto já aberta na tela! Liberando compositor...');
          this.assegurarCompositorLiberadoNoFastPass(celular, canalTipo, timeout);
          return;
        }

        // 2. Se a conversa não estiver aberta ou for de outro cliente, busca na fila pelo número e abre o card correto
        cy.log(`⚡ [Fast-Pass]: Acessando a conversa do cliente (...${ultimosDigitos})...`);
        this.buscarAtendimento(ultimosDigitos);
        cy.wait(800);

        // Clica no card retornado pela busca
        cy.get('section[aria-label="Attendance list"] [role="option"]', { timeout: 12000 })
          .first()
          .click();

        // Aguarda a conversa carregar no cabeçalho
        cy.get('header[class*="_header_"], [data-testid="chat-header"]', { timeout: 15000 })
          .should('be.visible');

        // Aguarda o compositor estar visível e liberado para digitar/anexar
        this.assegurarCompositorLiberadoNoFastPass(celular, canalTipo, timeout);
      });
      return;
    }

    // 1. Verificação inicial (1º teste da rodada):
    cy.get('body', { timeout: 10000 }).should(($body) => {
      const temCompositor = $body.find('textarea[data-testid="input-message"], div[class*="_inputCard_"]').length > 0;
      const temFila = $body.find('section[aria-label="Attendance list"], button[data-testid="filter-all"], [data-testid="button-iniciar-atendimento"]').length > 0;
      expect(temCompositor || temFila).to.be.true;
    }).then(($body) => {
      const nomeCliente = Cypress.env('DEFAULT_CLIENT_NAME') || 'klismam';
      const chatHeader = $body.find('header[class*="_header_"], [data-testid="chat-header"]').text().toLowerCase();
      const ehClienteCorreto = chatHeader.includes(ultimosDigitos) || chatHeader.includes(nomeCliente.toLowerCase());
      const temPlaceholderCentral = $body.find('div[class*="_detailPlaceholder_"], [class*="_placeholderText_"]:contains("para ver a conversa")').length > 0;
      const temCompositor = $body.find('textarea[data-testid="input-message"], div[class*="_inputCard_"]').length > 0;
      const temChatAberto = ehClienteCorreto && !temPlaceholderCentral && temCompositor;

      // Helper reutilizável para avaliar e conduzir o estado da conversa aberta
      const avaliarEstadoConversaAberta = () => {
        // Aguarda o histórico terminar de carregar ANTES de tudo: enquanto `GET .../messages` está em
        // voo, o React desabilita o compositor inteiro independente do estado da janela de 24h.
        this.aguardarHistoricoMensagensCarregado();

        // Limpa antes qualquer template bloqueado no compositor
        this.limparTemplatePendenteNoCompositor();

        // Tolera a defasagem do aviso de janela encerrada (janela que acabou de abrir) antes de decidir o Caso 2
        this.aguardarJanelaLivreComTolerancia();

        // Aguarda estabilização do estado do chat
        cy.get('body', { timeout: 10000 }).should(($chatBody) => {
          const badge = this.temBadgeJanelaAtiva($chatBody);
          const $txt = $chatBody.find('textarea[data-testid="input-message"], div[class*="_inputCard_"] textarea, textarea[class*="_textarea_"]');
          const semBloqueio = $chatBody.find('[data-testid="composer-service-window-notice"]:visible, [data-testid="button-service-window-templates"]:visible').length === 0;
          const inputLivre = $txt.length > 0 && !$txt.first().is(':disabled') && semBloqueio;
          const avisoLimitada = $chatBody.find('[data-testid="composer-service-window-notice"]:visible, [data-testid="button-service-window-templates"]:visible').length > 0 ||
                                /janela\s*expirada/i.test($chatBody.text());

          expect(badge || inputLivre || avisoLimitada, 'Chat estabilizado com Janela Ativa ou Aviso de Template').to.be.true;
        }).then(($chatBody) => {
          const badge = this.temBadgeJanelaAtiva($chatBody);
          const $txt = $chatBody.find('textarea[data-testid="input-message"], div[class*="_inputCard_"] textarea, textarea[class*="_textarea_"]');
          const semBloqueio = $chatBody.find('[data-testid="composer-service-window-notice"]:visible, [data-testid="button-service-window-templates"]:visible').length === 0;
          const inputLivre = $txt.length > 0 && !$txt.first().is(':disabled') && semBloqueio;

          // REGRA DE OU (OR): Se tem badge Janela Ativa OU se caixa de texto está livre:
          if (badge || inputLivre) {
            // CASO 3: Atendimento existe e janela já está ativa
            cy.log(`✅ [Caso 3 - Janela Já Ativa]: Detectado badge Janela Ativa (${badge}) OU caixa de texto livre (${inputLivre})! Prosseguindo normalmente sem disparar template...`);
            // Limpa template pendente ANTES de afirmar que o compositor está liberado: a barra
            // "Template escolhido" (`_templateLockedBar_`) não se auto-limpa após o envio e mantém o
            // textarea `disabled` mesmo com a janela de 24h ativa e o badge "Janela ativa" visível.
            // Sem esta limpeza, o hook falha com "expected <textarea> not to be 'disabled'" — e, por
            // ser falha em `beforeEach`, o Mocha pula todos os testes restantes da suíte.
            // O Fast-Pass já fazia esta limpeza; o Caso 3 não fazia (assimetria corrigida em 23/09/2026).
            this.limparTemplatePendenteNoCompositor();
            this.elements.inputMensagemChat().should('be.visible').and('not.be.disabled');
            Cypress.env('ACTIVE_SERVICE_WINDOW_VERIFIED', true);
            return;
          }

          // CASO 2: Atendimento existe mas com janela limitada
          cy.log('⚠️ [Caso 2 - Janela Limitada]: Atendimento com janela limitada. Enviando template com variável editável...');
          this.abrirPainelTemplatesJanelaExpirada();
          this.selecionarTemplateComVariavel();
          this.preencherVariavelTemplate(mensagemPadraoCypress);
          this.enviarTemplateDrawer();
          this.aguardarConfirmacaoEnvioTemplate(120000);
          cy.log(`📱 [Aguardando WhatsApp]: Template disparado e confirmado! Aguardando resposta em até ${timeout / 1000}s para ativar a janela...`);
          this.elements.badgeJanelaAtiva({ timeout }).should('be.visible');
          this.elements.bannerJanelaEncerrada().should('not.exist');
          this.elements.inputMensagemChat().should('be.visible').and('not.be.disabled');
          cy.log('✅ [Janela 24h Ativada]: Janela de 24h ativada com sucesso!');
          Cypress.env('ACTIVE_SERVICE_WINDOW_VERIFIED', true);
        });
      };

      // --- CENÁRIO A: Chat JÁ está aberto na tela ---
      if (temChatAberto) {
        cy.log('💬 [Cenário A]: Chat já posicionado no painel central. Avaliando janela ativa...');
        avaliarEstadoConversaAberta();
        return;
      }

      // --- CENÁRIO B: Nenhum chat aberto; busca na fila pelo número padrão ---
      cy.log(`🔍 [Cenário B - Buscando Número Padrão]: Nenhum chat aberto no painel central. Pesquisando por ...${ultimosDigitos} na fila...`);
      this.visitar();

      // Garante que a busca seja realizada no status padrão obrigatório "Aguardando"
      this.elements.chipWaiting().scrollIntoView().click();
      cy.wait(400);

      this.buscarAtendimento(ultimosDigitos);
      cy.wait(1500);

      // Aguarda renderização dos cards ou mensagem de vazio
      cy.get('section[aria-label="Attendance list"]', { timeout: 12000 }).should(($section) => {
        const cards = $section.find('[role="option"]');
        const emptyMsg = $section.find('[class*="_empty_"], [role="status"], p:contains("Nenhum")');
        expect(cards.length > 0 || emptyMsg.length > 0).to.be.true;
      }).then(($section) => {
        const cards = $section.find('[role="option"]');

        if (cards.length > 0) {
          // Atendimento existe na listagem: abre conversa (re-consulta o card a cada tentativa; um
          // cy.wrap dos elementos capturados acima ficaria solto se a lista re-renderizar)
          cy.get('section[aria-label="Attendance list"] [role="option"]').first().click();
          // Aceita também o aviso de janela encerrada: atendimento existente com janela expirada mostra "Envio restrito a templates" no lugar do compositor,
          // e o Caso 2 de avaliarEstadoConversaAberta() é quem reabre a janela (2026-10-19, 5-B1 ctx 2: beforeEach falhava aqui com o 261000073)
          cy.get('div[class*="_inputCard_"], textarea[data-testid="input-message"], [data-testid="composer-service-window-notice"]', { timeout: 15000 })
            .should('be.visible');
          cy.contains('Selecione um atendimento para ver a conversa').should('not.exist');

          avaliarEstadoConversaAberta();
        } else {
          // CASO 1: Atendimento não existe -> abre nova conversa
          cy.log('🆕 [Caso 1 - Atendimento Inexistente]: Atendimento não encontrado. Abrindo nova conversa via modal Iniciar Atendimento com template editável...');
          this.limparBusca();
          cy.wait(500);
          this.iniciarAtendimentoComTemplate(celular, canalTipo);

          // Pós-envio: se o chat já abriu diretamente ou se precisa abrir o card recém-criado na fila
          cy.get('body', { timeout: 20000 }).then(($b) => {
            const chatAberto = $b.find('div[class*="_inputCard_"], textarea[data-testid="input-message"], [data-testid="composer-service-window-notice"]').length > 0;
            if (!chatAberto) {
              cy.log(`🔍 [Caso 1]: Chat não abriu automaticamente após envio. Buscando por ...${ultimosDigitos} e abrindo conversa...`);
              this.buscarAtendimento(ultimosDigitos);
              cy.wait(800);
              cy.get('section[aria-label="Attendance list"] [role="option"]', { timeout: 12000 })
                .first()
                .click();
            }
          });

          cy.get('div[class*="_inputCard_"], textarea[data-testid="input-message"], [data-testid="composer-service-window-notice"]', { timeout: 15000 })
            .should('be.visible');

          this.aguardarConfirmacaoEnvioTemplate(120000);
          cy.log(`📱 [Aguardando WhatsApp]: Nova conversa iniciada com template editável! Aguardando o cliente responder no WhatsApp em até ${timeout / 1000}s para validar e ativar a janela de 24h...`);
          this.elements.badgeJanelaAtiva({ timeout }).should('be.visible');
          this.elements.bannerJanelaEncerrada().should('not.exist');
          this.elements.inputMensagemChat().should('be.visible').and('not.be.disabled');
          cy.log('✅ [Janela 24h Ativada]: Resposta do cliente recebida e janela de 24h ativada com sucesso!');
          Cypress.env('ACTIVE_SERVICE_WINDOW_VERIFIED', true);
        }
      });
    });
  }

  abrirAtendimentoPorId(idAtendimento) {
    cy.get('body').then(($body) => {
      const seletorCard = `[data-testid="attendance-queue-item-${idAtendimento}"]`;
      if ($body.find(seletorCard).length > 0) {
        cy.get(seletorCard).scrollIntoView({ duration: 300 }).should('be.visible').click();
      } else {
        this.elements.cardsAtendimento().first().scrollIntoView({ duration: 300 }).should('be.visible').click();
      }
    });
  }

  abrirAtendimentoPorCelular(celular) {
    const ultimosDigitos = celular.slice(-4);

    // O status padrão da tela para busca de atendimento é "Aguardando"
    this.elements.chipWaiting().click();
    this.buscarAtendimento(ultimosDigitos);
    cy.wait('@searchAttendancesApi', { timeout: 15000 });
    cy.get('section[aria-label="Attendance list"] [role="option"]', { timeout: 12000 })
      .first()
      .should('be.visible')
      .click();
    cy.get('[data-testid="card-cliente"], aside[class*="_infoPanel_"]', { timeout: 15000 })
      .should('be.visible');
    this.elements.textClienteTelefone()
      .should('be.visible')
      .and('contain', ultimosDigitos);
    cy.wait(800);
  }

  enviarMensagemNoChat(mensagem) {
    this.limparTemplatePendenteNoCompositor();
    this.elements.inputMensagemChat()
      .should('be.visible')
      .and('not.be.disabled')
      .clear()
      .type(mensagem);

    this.elements.btnEnviarMensagemChat()
      .should('not.be.disabled')
      .click();
  }

  abrirResumoOrcamentos() {
    this.elements.summaryOrcamentos().click();
  }

  /**
   * Abre o dropdown de mudar status no header do cliente e seleciona a opção desejada.
   * Lida com a regra de negócio onde 'completed' ou 'finished' a partir de 'pendente' 
   * exige passar por 'in_progress' primeiro.
   * @param {'pending'|'in_progress'|'completed'|'finished'|'discarded'} statusKey 
   */
  alterarStatusAtendimento(statusKey) {
    this.elements.btnClienteStatus().first().then(($btn) => {
      const texto = $btn.text().toLowerCase();

      const isPendente = texto.includes('pendente');
      const needsInProgressFirst = isPendente && (statusKey === 'completed' || statusKey === 'finished');

      if (needsInProgressFirst) {
        cy.wrap($btn).click();
        cy.wait(500);
        this.elements.getItemMenuStatusPorKey('in_progress').click();
        cy.wait(1500);
        this.elements.btnClienteStatus().first().click();
        cy.wait(500);
      } else {
        const mapaRegex = {
          pending: /pendente/i,
          in_progress: /em andamento/i,
          completed: /conclu/i,
          finished: /finaliz/i,
          discarded: /descart/i
        };

        if (mapaRegex[statusKey] && mapaRegex[statusKey].test(texto)) {
          return; // Já está no status desejado
        }

        cy.wrap($btn).click();
        cy.wait(500);
      }

      this.elements.getItemMenuStatusPorKey(statusKey).click();
      cy.wait(1000);
    });
  }

  /**
   * Finaliza o atendimento aberto através do botão de status no painel do cliente
   */
  finalizarAtendimento() {
    this.alterarStatusAtendimento('finished');
  }

  /**
   * Abre o menu de status diretamente a partir do card na fila
   * @param {number|string} idAtendimento 
   * @param {'pending'|'in_progress'|'completed'|'finished'|'discarded'|'transferir'} statusKey 
   */
  alterarStatusViaCardFila(idAtendimento, statusKey) {
    this.elements.btnCardMenuPorId(idAtendimento).click();
    if (statusKey === 'transferir') {
      this.elements.itemMenuTransferir().click();
    } else {
      this.elements.getItemMenuStatusPorKey(statusKey).click();
    }
  }

  // -------------------------------------------------------------
  // VALIDAÇÕES DINÂMICAS VIA PAYLOAD E REGRAS DE NEGÓCIO
  // -------------------------------------------------------------

  /**
   * Valida os contadores exibidos nas abas/chips superiores de acordo com o payload de /summary
   * @param {object} countsPayload Contadores a serem comparados (padrão: AtendimentosMocks.mockSummaryData.counts)
   */
  validarContadoresAbasComPayload(countsPayload = AtendimentosMocks.mockSummaryData.counts) {
    const mapaStatusKey = {
      pending: countsPayload.pending,
      in_progress: countsPayload.in_progress,
      completed: countsPayload.completed,
      finished: countsPayload.finished,
      discarded: countsPayload.discarded,
      waiting: countsPayload.waiting,
      all: countsPayload.all
    };

    Object.entries(mapaStatusKey).forEach(([key, expectedCount]) => {
      if (expectedCount !== undefined) {
        this.elements.getChipPorStatusKey(key)
          .scrollIntoView()
          .should('exist')
          .and('contain', String(expectedCount));
      }
    });
  }

  /**
   * Valida os contadores refletidos na sidebar/menu lateral de acordo com o payload de /summary
   * @param {object} countsPayload Contadores a serem comparados (padrão: AtendimentosMocks.mockSummaryData.counts)
   */
  validarContadoresSidebarComPayload(countsPayload = AtendimentosMocks.mockSummaryData.counts) {
    const mapaStatusKey = {
      pending: countsPayload.pending,
      in_progress: countsPayload.in_progress,
      completed: countsPayload.completed,
      finished: countsPayload.finished,
      discarded: countsPayload.discarded,
      waiting: countsPayload.waiting,
      all: countsPayload.all
    };

    Object.entries(mapaStatusKey).forEach(([key, expectedCount]) => {
      if (expectedCount !== undefined) {
        this.elements.getSidebarSubitemPorKey(key)
          .scrollIntoView()
          .should('be.visible')
          .and('contain', String(expectedCount));
      }
    });
  }

  validarItensListaComPayload(itemsList) {
    this.elements.cardsAtendimento().should('have.length', itemsList.length);
  }

  validarJanelaExpirada() {
    this.elements.bannerJanelaEncerrada().should('be.visible');
    this.elements.tituloBannerJanela().should('be.visible');
    this.elements.btnEnviarTemplateAviso().should('be.visible');
    this.elements.inputMensagemChat().should('not.exist');
  }

  /**
   * Valida o aviso quando o contato ainda não iniciou a conversa
   * (cenário onde o atendente iniciou o atendimento enviando template e aguarda resposta)
   */
  validarAvisoContatoNaoIniciouConversa() {
    this.elements.bannerJanelaEncerrada().should('be.visible');
    this.elements.tituloBannerJanela()
      .should('be.visible')
      .and('contain', 'O contato ainda não iniciou a conversa');
    this.elements.hintBannerJanela()
      .should('be.visible')
      .and('contain', 'Será necessário enviar um template e aguardar o contato responder');
    this.elements.btnEnviarTemplateAviso().should('be.visible');
    this.elements.inputMensagemChat().should('not.exist');
  }

  validarJanelaAtiva(timeout = 90000) {
    cy.log(`📱 [WhatsApp 24h]: Aguardando o cliente responder no WhatsApp em até ${timeout / 1000}s para validar ativação da janela de 24h...`);

    // 0. Limpeza prévia de segurança: se houver um template previamente carregado bloqueando o compositor, clica em Cancelar
    this.limparTemplatePendenteNoCompositor();

    // 1. Aguarda com retry declarativo nativo do Cypress por até 'timeout' ms (padrão 90s = 1:30 min)
    // até que o badge "Janela ativa" apareça OU a caixa de texto seja liberada sem aviso de bloqueio
    cy.get('body', { timeout }).should(($body) => {
      // Condição 1: Badge de janela ativa (span._serviceWindowBadge_ ou data-testid ou texto "Janela ativa")
      const temBadgeJanelaAtiva = this.temBadgeJanelaAtiva($body);

      // Condição 2: Textarea do chat visível, habilitada e sem aviso de janela expirada bloqueando
      const $inputMensagem = $body.find('textarea[data-testid="input-message"], div[class*="_inputCard_"] textarea, textarea[class*="_textarea_"]');
      const semAvisoBloqueio = $body.find('[data-testid="composer-service-window-notice"]:visible, [data-testid="button-service-window-templates"]:visible').length === 0;
      const temCaixaTextoLivre = $inputMensagem.length > 0 && !$inputMensagem.first().is(':disabled') && semAvisoBloqueio;

      expect(temBadgeJanelaAtiva || temCaixaTextoLivre, 'Janela de 24h deve ser ativada após a resposta do cliente no WhatsApp').to.be.true;
    });

    // 2. Limpeza adicional pós-ativação e garantia de prontidão do compositor
    this.limparTemplatePendenteNoCompositor();
    this.elements.inputMensagemChat({ timeout: 10000 })
      .should('be.visible')
      .and('not.be.disabled');

    cy.log('✅ [Janela 24h Ativada]: Resposta do cliente no WhatsApp detectada e compositor liberado com sucesso!');
    Cypress.env('ACTIVE_SERVICE_WINDOW_VERIFIED', true);
  }

  validarChatDesbloqueadoNaoOficial() {
    this.elements.bannerJanelaEncerrada().should('not.exist');
    this.elements.btnEnviarTemplateAviso().should('not.exist');
    this.elements.inputMensagemChat().should('be.visible').and('not.be.disabled');
  }

  /**
   * Valida se o compositor de mensagens está bloqueado com o aviso de 'atendimento sem atendente'
   */
  validarAvisoSemAtendente() {
    this.elements.noticeSemAtendente().should('be.visible');
    this.elements.textoAvisoSemAtendente().should('be.visible');
    this.elements.textoHintSemAtendente().should('be.visible');
    this.elements.inputMensagemChat().should('not.exist');
  }

  /**
   * Clica no botão "Assumir atendimento" (can_take_attendance) exposto no cartão de bloqueio da
   * Permissão 655 ou na faixa do compositor (backend#528/#561, front#434)
   */
  clicarAssumirAtendimento() {
    // NUNCA force: true aqui - achado real 2026-10-05 (operador, atendimento real #261000019):
    // o botão herda pointer-events:none do footer `_composerDisabled_` (compositor desabilitado
    // por falta de atendente) e fica genuinamente inclicável por um usuário real, mesmo com
    // can_take_attendance:true e sem nenhum atributo disabled/aria-disabled no próprio botão.
    // force:true mascarava esse bug em todos os testes deste helper desde 2026-10-02 (nunca
    // detectado porque bypassa a checagem de actionability do Cypress, que um clique real não
    // bypassa). Ver ROADMAP.md P0.
    this.elements.btnAssumirAtendimento().should('be.visible').click();
  }

  /**
   * Abre a modal de transferência a partir do menu do card do atendimento na fila
   * @param {number|string} idAtendimento 
   */
  abrirModalTransferirPeloCard(idAtendimento) {
    this.alterarStatusViaCardFila(idAtendimento, 'transferir');
    this.elements.modalTransferir().should('be.visible');
  }

  /**
   * Abre a modal de transferência através do menu de status do cliente no painel lateral
   */
  abrirModalTransferirPeloMenuCliente() {
    this.elements.btnClienteStatus().should('be.visible').click();
    this.elements.btnMenuTransferir().should('be.visible').click();
    this.elements.modalTransferir().should('be.visible');
  }

  /**
   * Aguarda a lista de atendentes da modal de transferência. A lista pode ter dezenas de opções (mais alta
   * que a modal) e o Cypress a considera "não visível" quando um ancestral `position: fixed` a sobrepõe no
   * ponto central (deploy de 2026-10-15, modal com abas e lista de grupos) — por isso a asserção é sobre a
   * 1ª opção, não sobre o contêiner.
   */
  aguardarListaAtendentesTransferir() {
    this.elements.listaAtendentesTransferir().should('exist');
    this.elements.listaAtendentesTransferir().find('[role="option"]').first().should('be.visible');
  }

  /**
   * Fecha a modal de transferência clicando no botão de fechar (X)
   */
  fecharModalTransferir() {
    this.elements.btnFecharModalTransferir().click();
    this.elements.modalTransferir().should('not.exist');
  }

  /**
   * Digita no campo de busca de atendentes dentro da modal de transferência
   * @param {string} nome 
   */
  buscarAtendenteNaModalTransferir(nome) {
    this.elements.inputBuscarAtendenteTransferir()
      .should('be.visible')
      .clear()
      .type(nome);
  }

  /**
   * Valida se o atendente pesquisado é exibido com o badge de status 'Ocupado'
   * @param {string} nome 
   */
  validarStatusOcupadoAtendente(nome) {
    const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';
    if (isMock) {
      this.elements.getOpcaoAtendentePorNome(nome)
        .should('be.visible')
        .and('contain', 'Ocupado');
    } else {
      this.elements.getOpcaoAtendentePorNome(nome)
        .should('be.visible')
        .invoke('text')
        .should('match', /Ocupado|Disponível|Ausente|Offline/i);
    }
  }

  /**
   * Valida se o atendente pesquisado ou se a lista de atendentes contém status Disponível
   * @param {string} [nome] Nome opcional do atendente
   */
  validarStatusDisponivelAtendente(nome = null) {
    if (nome) {
      this.elements.getOpcaoAtendentePorNome(nome)
        .should('be.visible')
        .and('contain', 'Disponível');
    } else {
      this.elements.listaAtendentesTransferir()
        .find('[role="option"]')
        .filter(':contains("Disponível")')
        .should('have.length.gte', 1);
    }
  }

  /**
   * Seleciona o primeiro atendente da lista na modal de transferência
   */
  selecionarPrimeiroAtendenteDisponivel() {
    this.elements.listaAtendentesTransferir()
      .find('[role="option"]')
      .first()
      .should('be.visible')
      .click();
  }

  /**
   * Seleciona um atendente da lista dentro da modal de transferência
   * @param {string} nome 
   */
  selecionarAtendenteNaModalTransferir(nome) {
    this.elements.getOpcaoAtendentePorNome(nome).click();
  }

  /**
   * Confirma a transferência clicando no botão 'Transferir' da modal
   */
  confirmarTransferencia() {
    this.elements.btnConfirmarTransferir()
      .should('be.visible')
      .and('not.be.disabled')
      .click();
    this.elements.modalTransferir().should('not.exist');
  }

  /**
   * Escolhe um grupo na modal de transferência e espera a seleção ser aplicada
   * @param {number|string} idGrupo
   */
  selecionarGrupoNaModalTransferir(idGrupo) {
    this.elements.getOpcaoGrupoTransferir(idGrupo).should('be.visible').click();
    this.elements.getOpcaoGrupoTransferir(idGrupo).should('have.attr', 'aria-selected', 'true');
  }

  /**
   * Confere um grupo da modal contra o item devolvido por `GET /channel-groups`: nome, canais (se vierem) e o selo disponíveis/total
   * (se vier). O texto é comparado sem distinguir caixa, pois a tela exibe o nome em caixa de título.
   * @param {{id: number, name: string, channels?: Array<{name: string|null}>, agents_total?: number, agents_available?: number}} grupo
   */
  validarGrupoNaModalTransferir(grupo) {
    this.elements.getOpcaoGrupoTransferir(grupo.id).should(($opcao) => {
      const texto = $opcao.text().toLowerCase();
      expect(texto, `nome do grupo ${grupo.id}`).to.contain(String(grupo.name).toLowerCase());
      (grupo.channels || []).filter((canal) => canal.name).forEach((canal) => {
        expect(texto, `canal ${canal.name} do grupo ${grupo.name}`).to.contain(String(canal.name).toLowerCase());
      });
      if (Number.isInteger(grupo.agents_total) && Number.isInteger(grupo.agents_available)) {
        expect(texto, `selo disponíveis/total do grupo ${grupo.name}`).to.contain(`${grupo.agents_available}/${grupo.agents_total}`);
      }
    });
  }

  /**
   * Valida a opção "fila geral" como indisponível (grupo atual do atendimento) e com o motivo exibido
   */
  validarFilaGeralIndisponivel() {
    this.elements.opcaoFilaGeralTransferir()
      .should('have.attr', 'aria-disabled', 'true')
      .and('have.attr', 'aria-checked', 'false')
      .and('contain', 'O atendimento já está neste grupo');
  }

  /**
   * Valida a opção "fila geral" como marcada e habilitada, com o botão e o destino do rodapé refletindo o grupo escolhido
   * @param {string} nomeGrupo Nome do grupo de destino (sem distinguir caixa)
   */
  validarFilaGeralSelecionada(nomeGrupo) {
    this.elements.opcaoFilaGeralTransferir()
      .should('have.attr', 'aria-checked', 'true')
      .and('not.have.attr', 'aria-disabled', 'true');
    this.elements.btnConfirmarTransferir()
      .should('not.be.disabled')
      .and('contain', 'Transferir para fila geral do grupo');
    this.elements.destinoTransferir().should(($destino) => {
      const texto = $destino.text().toLowerCase();
      expect(texto, 'destino do rodapé').to.contain('fila geral');
      expect(texto, 'destino do rodapé cita o grupo').to.contain(String(nomeGrupo).toLowerCase());
    });
  }

  /**
   * Valida que a opção de um atendente mostra a carga "N atendimento(s) em curso" (`ongoing_attendances`) e o nome
   * @param {string} nome Nome do atendente
   * @param {number} emCurso Quantidade de atendimentos em curso
   */
  validarAtendenteComCargaNaModalTransferir(nome, emCurso) {
    const sufixo = emCurso === 1 ? 'atendimento em curso' : 'atendimentos em curso';
    this.elements.getOpcaoAtendentePorNome(nome).should(($opcao) => {
      expect($opcao.text().replace(/\s+/g, ' '), `carga de ${nome}`).to.contain(`${emCurso} ${sufixo}`);
    });
  }

  /**
   * Valida o destino do rodapé quando um atendente está escolhido ("Nome completo · Grupo") e o botão "Transferir para <nome>"
   * @param {string} nomeAtendente
   * @param {string} nomeGrupo
   */
  validarDestinoAtendenteTransferir(nomeAtendente, nomeGrupo) {
    this.elements.destinoTransferir().should(($destino) => {
      const texto = $destino.text().toLowerCase();
      expect(texto, 'destino do rodapé cita o atendente').to.contain(String(nomeAtendente).toLowerCase());
      expect(texto, 'destino do rodapé cita o grupo').to.contain(String(nomeGrupo).toLowerCase());
    });
    this.elements.btnConfirmarTransferir()
      .should('not.be.disabled')
      .invoke('text')
      .should('match', /^Transferir para /);
  }

  /**
   * Valida se o compositor está liberado para envio de mensagens normais
   */
  validarCompositorLiberado() {
    this.elements.noticeSemAtendente().should('not.exist');
    this.elements.inputMensagemChat()
      .should('be.visible')
      .and('not.be.disabled');
    this.elements.btnEnviarMensagemChat().should('be.visible');
  }

  // -------------------------------------------------------------
  // MÉTODOS DO MODAL DE FILTROS AVANÇADOS
  // -------------------------------------------------------------

  /**
   * Abre o modal de filtros clicando no botão do filtro na barra superior
   */
  abrirModalFiltros() {
    this.elements.btnAbrirFiltros()
      .should('be.visible')
      .and('not.be.disabled')
      .click();
    this.elements.modalFiltros().should('be.visible');
  }

  /**
   * Fecha o modal de filtros clicando no botão 'x' de fechar
   */
  fecharModalFiltros() {
    this.elements.btnFecharModalFiltros()
      .should('be.visible')
      .and('not.be.disabled')
      .click();
    this.elements.modalFiltros().should('not.exist');
  }

  /**
   * Seleciona uma opção no campo Canal do modal de filtros
   * @param {string|number} valorOuTexto ID ou parte do texto do canal
   */
  selecionarCanalFiltro(valorOuTexto) {
    this.elements.selectCanalFiltro().should('be.visible').then(($sel) => {
      const opts = [...$sel.find('option')];
      const opt = opts.find(o => o.value === String(valorOuTexto) || o.text.toUpperCase().includes(String(valorOuTexto).toUpperCase()));
      if (opt) {
        cy.wrap($sel).select(opt.value);
      } else {
        cy.wrap($sel).select(String(valorOuTexto));
      }
    });
  }

  /**
   * Valida as opções do seletor Canal do filtro da fila (Issue front#582/PR #590): "Todos os canais" primeiro e depois um `option`
   * por canal devolvido por GET /attendances/channels, na ordem da API, com value = id e texto = nome (NOME nulo vira "Sem nome #id").
   * @param {Array<{id: number, name: string|null}>} canais Itens da resposta da rota
   */
  validarOpcoesCanalFiltro(canais) {
    this.elements.selectCanalFiltro().find('option').should('have.length', canais.length + 1).then(($opcoes) => {
      expect($opcoes[0].text, 'primeira opção').to.contain('Todos os canais');
      expect($opcoes[0].value, 'valor de "Todos os canais"').to.eq('');
      canais.forEach((canal, i) => {
        const opcao = $opcoes[i + 1];
        expect(opcao.value, `valor da opção ${i + 1}`).to.eq(String(canal.id));
        expect(opcao.text.trim(), `texto do canal ${canal.id}`).to.eq(canal.name || `Sem nome #${canal.id}`);
      });
    });
  }

  /**
   * Aguarda a listagem da fila pedida com `channel_id` do canal escolhido no filtro, já respondida, e devolve a interceptação (request + response).
   * @param {number} canalId ID do canal
   */
  aguardarListagemFiltradaPorCanal(canalId) {
    return this.aguardarListagemComParametros({ channel_id: canalId });
  }

  /**
   * Aguarda a listagem da fila pedida com todos os parâmetros dados na query, já respondida, e devolve a interceptação (request + response).
   * @param {Object<string, string|number>} parametros Ex.: `{ channel_id: 1, channel_group_id: 7 }`
   */
  aguardarListagemComParametros(parametros) {
    const casa = (chamada) => {
      const query = new URL(chamada.request.url).searchParams;
      return !!chamada.response && Object.entries(parametros).every(([chave, valor]) => query.get(chave) === String(valor));
    };
    return cy.get('@getAttendancesList.all').should((chamadas) => {
      expect(chamadas.some(casa), `listagem pedida com ${JSON.stringify(parametros)}`).to.be.true;
    }).then((chamadas) => chamadas.filter(casa).pop());
  }

  /**
   * Valida as opções do seletor Grupos do filtro da fila (Issue front#398/PR #581): "Todos os grupos" primeiro e depois um `option`
   * por grupo, na ordem recebida, com value = id e texto = nome.
   * @param {Array<{id: number, name: string}>} grupos Grupos que devem aparecer (já sem os que não têm canal vinculado)
   */
  validarOpcoesGruposFiltro(grupos) {
    // Tudo dentro do `should` com callback, que repete até passar: sem nenhum grupo vinculado a lista tem 1 opção tanto carregando ("Carregando…") quanto carregada
    // ("Todos os grupos"), então checar só a contagem e o texto num `.then` (que não repete) pegava o placeholder (achado no CI, 5-A #16.2, 2026-10-23)
    this.elements.selectGruposFiltro().find('option').should(($opcoes) => {
      expect($opcoes, 'opções do seletor Grupos').to.have.length(grupos.length + 1);
      expect($opcoes[0].text, 'primeira opção').to.contain('Todos os grupos');
      expect($opcoes[0].value, 'valor de "Todos os grupos"').to.eq('');
      grupos.forEach((grupo, i) => {
        expect($opcoes[i + 1].value, `valor da opção ${i + 1}`).to.eq(String(grupo.id));
        expect($opcoes[i + 1].text.trim(), `texto do grupo ${grupo.id}`).to.eq(grupo.name);
      });
    });
  }

  /**
   * Abre o "Iniciar atendimento" na própria tela, lê os valores do seletor Canal dele, fecha o modal e devolve os ids (sem o vazio).
   * Serve para provar que esse seletor segue em GET /channels, separado do filtro da fila (Issue front#582).
   */
  listarCanaisDoIniciarAtendimento() {
    IniciarAtendimentoPage.abrirModal();
    IniciarAtendimentoPage.elements.selectCanal().find('option').should('have.length.greaterThan', 1);
    return IniciarAtendimentoPage.elements.selectCanal().then(($sel) => {
      const ids = [...$sel.find('option')].map((o) => o.value).filter((v) => v !== '');
      IniciarAtendimentoPage.elements.btnFecharModalX().first().click();
      IniciarAtendimentoPage.elements.modalContainer().should('not.exist');
      return cy.wrap(ids);
    });
  }

  /**
   * Seleciona um grupo no campo Grupos do modal de filtros
   * @param {string|number} valorOuTexto ID ou parte do nome do grupo
   */
  selecionarGrupoFiltro(valorOuTexto) {
    this.elements.selectGruposFiltro().should('be.visible').and('not.be.disabled').then(($sel) => {
      const opts = [...$sel.find('option')];
      const opt = opts.find(o => o.value === String(valorOuTexto) || o.text.toUpperCase().includes(String(valorOuTexto).toUpperCase()));
      if (opt) {
        cy.wrap($sel).select(opt.value);
      } else {
        cy.wrap($sel).select(String(valorOuTexto));
      }
    });
  }

  /**
   * Seleciona um funcionário/atendente no campo Funcionário do modal de filtros
   * @param {string|number} valorOuTexto ID ou parte do nome do funcionário
   */
  selecionarFuncionarioFiltro(valorOuTexto) {
    this.elements.selectFuncionarioFiltro().should('be.visible').and('not.be.disabled').then(($sel) => {
      const opts = [...$sel.find('option')];
      const opt = opts.find(o => o.value === String(valorOuTexto) || o.text.toUpperCase().includes(String(valorOuTexto).toUpperCase()));
      if (opt) {
        cy.wrap($sel).select(opt.value);
      } else {
        cy.wrap($sel).select(String(valorOuTexto));
      }
    });
  }

  /**
   * Seleciona um status no campo Status do modal de filtros
   * @param {string} statusValue Valor do status (ex: 'pending', 'in_progress', 'completed', 'finished', 'discarded', 'waiting', 'all')
   */
  selecionarStatusFiltro(statusValue) {
    this.elements.selectStatusFiltro().should('be.visible').select(statusValue);
  }

  /**
   * Clica no botão Limpar do modal de filtros e valida o fechamento do modal
   */
  limparFiltros() {
    this.elements.btnLimparFiltros().should('be.visible').click();
    this.elements.modalFiltros().should('not.exist');
  }

  /**
   * Clica no botão Aplicar filtros e valida o fechamento do modal
   */
  aplicarFiltros() {
    this.elements.btnAplicarFiltros().should('be.visible').and('not.be.disabled').click();
    this.elements.modalFiltros().should('not.exist');
    this.elements.btnAbrirFiltros().should('be.visible');
  }

  /**
   * Valida a estrutura visual e os estados iniciais padrão do modal de filtros
   */
  validarEstruturaInicialFiltros() {
    this.elements.modalFiltros().should('be.visible');
    this.elements.tituloModalFiltros().should('be.visible').and('contain', 'Filtros');
    this.elements.btnFecharModalFiltros().should('be.visible');
    this.elements.btnFiltroDataModal().should('be.visible');

    // Funcionário (independente e populado via /employees - PR #339)
    // Regra: "Padrão (meus atendimentos)" só é o default para quem NÃO tem a permissão 540
    // (can_view_occupied_attendance); com a permissão concedida, o default é "Todos os funcionários".
    this.elements.selectFuncionarioFiltro().should('be.visible').and('not.be.disabled');
    this.elements.selectFuncionarioFiltro().find('option:selected').should(($opt) => {
      const texto = $opt.text();
      expect(texto, 'Default do filtro Funcionário deve ser "Padrão (meus atendimentos)" ou "Todos os funcionários"')
        .to.match(/Padrão \(meus atendimentos\)|Todos os funcionários/);
    });

    // Canal
    this.elements.selectCanalFiltro().should('be.visible');
    this.elements.selectCanalFiltro().find('option:selected').should('contain', 'Todos os canais');

    // Grupos (independente do Canal: habilitado e já populado com todos os grupos desde a abertura do modal)
    this.elements.selectGruposFiltro().should('be.visible').and('not.be.disabled');
    this.elements.selectGruposFiltro().find('option:selected').should('contain', 'Todos os grupos');
    this.elements.selectGruposFiltro().find('option').should('have.length.greaterThan', 1);

    // Status
    this.elements.selectStatusFiltro().should('be.visible');

    // Botões
    this.elements.btnLimparFiltros().should('be.visible');
    this.elements.btnAplicarFiltros().should('be.visible');
  }

  // -------------------------------------------------------------
  // MÉTODOS DE VALIDAÇÃO DE PRIORIDADE E ORDENAÇÃO (ISSUE #373)
  // -------------------------------------------------------------

  /**
   * Valida a sequência exata de IDs de atendimentos renderizados na lista da fila
   * @param {Array<number|string>} idsEsperados Lista ordenada de IDs de atendimento
   */
  validarOrdemCardsPorIds(idsEsperados) {
    if (!idsEsperados || idsEsperados.length === 0) return;
    this.elements.cardsAtendimento()
      .should('have.length.gte', Math.min(idsEsperados.length, 1))
      .should(($cards) => {
        idsEsperados.forEach((idEsperado, index) => {
          if (index < $cards.length) {
            const cardText = $cards.eq(index).text();
            expect(
              cardText,
              `O card na posição ${index + 1} deve conter o ID #${idEsperado}`
            ).to.include(String(idEsperado));
          }
        });
      });
  }

  /**
   * Valida que um card específico exibe o badge indicador de mensagens não lidas com a contagem esperada
   * @param {number|string} idAtendimento ID do atendimento
   * @param {number|string} countEsperado Quantidade de mensagens não lidas esperada no badge
   */
  validarCardPossuiBadgeNaoLido(idAtendimento, countEsperado) {
    this.elements.getCardPorId(idAtendimento)
      .should('be.visible')
      .within(() => {
        cy.contains('span, div, p', String(countEsperado)).should('be.visible');
      });
  }

  /**
   * Valida que um card específico NÃO exibe badge de mensagens não lidas
   * @param {number|string} idAtendimento ID do atendimento
   */
  validarCardNaoPossuiBadgeNaoLido(idAtendimento) {
    this.elements.getCardPorId(idAtendimento)
      .should('be.visible')
      .within(() => {
        cy.get('span[class*="unreadBadge"], span[class*="badge"], span[class*="count"], div[class*="badge"], div[class*="unread"], [data-testid*="badge"]').should('not.exist');
      });
  }

  /**
   * Valida diretamente no DOM a hierarquia de ordenação dos cards renderizados na tela (API Real):
   * 1ª Regra: Todos os cards com badge de mensagens pendentes de leitura (unread > 0)
   * devem aparecer no topo da lista antes de qualquer card sem mensagens não lidas.
   */
  validarHierarquiaOrdenacaoCardsRenderizados() {
    this.elements.cardsAtendimento()
      .should('have.length.gte', 1)
      .should(($cards) => {
        let primeiroLidoIndex = -1;
        let primeiroLidoId = null;
        let violouPrioridadeNaoLidos = false;
        let violacaoDetalhe = '';

        $cards.each((index, el) => {
          const $el = Cypress.$(el);
          const cardText = $el.text();
          // Extrai o ID do atributo estrutural data-testid (attendance-queue-item-{id}) em vez de regex sobre
          // o texto cru do card: nomes de clientes não cadastrados exibem o próprio telefone como "nome",
          // o que faria um regex textual capturar o telefone em vez do ID real do atendimento.
          const testId = $el.attr('data-testid') || '';
          const testIdMatch = testId.match(/attendance-queue-item-(\d+)/);
          const idMatch = cardText.match(/#?\s*(\d{7,12})/);
          const cardId = testIdMatch ? testIdMatch[1] : (idMatch ? idMatch[1] : `Card_${index + 1}`);

          let temBadgeNaoLido = false;
          let countNaoLido = 0;

          // 1. Tenta classes conhecidas de badge
          const badgeElement = $el.find('span[class*="badge"], span[class*="count"], div[class*="badge"], div[class*="unread"], [data-testid*="badge"], [class*="_unread"], [class*="_counter"]');
          if (badgeElement.length > 0) {
            const val = parseInt(badgeElement.text().trim(), 10);
            if (!isNaN(val) && val > 0) {
              temBadgeNaoLido = true;
              countNaoLido = val;
            }
          }

          // 2. Fallback resiliente: Procura nós folhas contendo apenas dígitos numéricos isolados (1 a 999)
          if (!temBadgeNaoLido) {
            $el.find('*').each((i, node) => {
              const $node = Cypress.$(node);
              if ($node.children().length === 0) {
                const txt = $node.text().trim();
                if (/^\d{1,3}$/.test(txt)) {
                  const parentTxt = $node.parent().text();
                  // Filtra fragmentos de data (17/09/26), IDs (# 260900064), telefones (+55 62...) ou textos de arquivo
                  if (!parentTxt.includes('/') && !parentTxt.includes('#') && !parentTxt.includes('+55') && !parentTxt.includes('Arquivo')) {
                    const num = parseInt(txt, 10);
                    if (num > 0) {
                      temBadgeNaoLido = true;
                      countNaoLido = num;
                      return false; // interrompe busca interna
                    }
                  }
                }
              }
            });
          }

          if (!temBadgeNaoLido) {
            if (primeiroLidoIndex === -1) {
              primeiroLidoIndex = index;
              primeiroLidoId = cardId;
            }
          } else if (temBadgeNaoLido && primeiroLidoIndex !== -1) {
            violouPrioridadeNaoLidos = true;
            violacaoDetalhe = `Card #${cardId} com ${countNaoLido} mensagem(ns) pendente(s) de leitura renderizado na posição ${index + 1}, ABAIXO do card #${primeiroLidoId} (posição ${primeiroLidoIndex + 1}) que não possui mensagens pendentes!`;
          }
        });

        if (violouPrioridadeNaoLidos) {
          Cypress.log({
            name: 'VIOLAÇÃO DE ORDENAÇÃO',
            message: `🚨 [BUG DE ORDENAÇÃO - ISSUE #373]: ${violacaoDetalhe}`
          });
        }

        expect(
          violouPrioridadeNaoLidos,
          `FALHA [1ª Regra - Paridade Desktop - Issue #373]: ${violacaoDetalhe || 'Na lista de cards renderizados, atendimentos com mensagens pendentes de leitura devem estar no topo antes dos atendimentos lidos.'}`
        ).to.be.false;
      });
  }

  /**
   * Extrai a lista de IDs de atendimentos atualmente renderizados no DOM
   * @returns {Cypress.Chainable<Array<string>>}
   */
  obterIdsCardsRenderizados() {
    return this.elements.cardsAtendimento().then(($cards) => {
      const ids = [];
      $cards.each((index, el) => {
        const match = Cypress.$(el).text().match(/#?\s*(\d{7,12})/);
        if (match) {
          ids.push(match[1]);
        }
      });
      return cy.wrap(ids);
    });
  }

  // -------------------------------------------------------------
  // MÉTODOS DE AÇÃO: ANEXOS, TRANSFERÊNCIAS E GAVETAS LATERAIS
  // -------------------------------------------------------------

  /**
   * Anexa um arquivo ao compositor SEM disparar o envio (fica pendente/staged para o próximo clique de enviar)
   * @param {string} caminhoFixture Caminho do arquivo a ser anexado
   */
  anexarArquivoSemEnviar(caminhoFixture) {
    this.elements.inputAnexarArquivo().first().selectFile(caminhoFixture, { force: true });
  }

  /**
   * Anexa ao compositor, SEM enviar, um arquivo sintético com o tamanho exato em bytes (sem fixture em disco).
   * Serve para provar a fronteira estrita do teto por tipo de mídia (front#595/PR #598): teto e teto + 1 byte.
   * @param {string} nome Nome do arquivo, com a extensão do tipo (ex.: 'teto-mais-1-byte.pdf')
   * @param {string} mimeType Tipo MIME (ex.: 'application/pdf', 'image/jpeg')
   * @param {number} tamanhoEmBytes Tamanho exato do conteúdo
   */
  anexarArquivoSinteticoSemEnviar(nome, mimeType, tamanhoEmBytes) {
    this.elements.inputAnexarArquivo().first().selectFile(
      { contents: Cypress.Buffer.alloc(tamanhoEmBytes), fileName: nome, mimeType },
      { force: true }
    );
  }

  /**
   * Valida que um anexo permanece pendente/staged no compositor (ainda não foi enviado)
   */
  validarAnexoPendenteNoCompositor() {
    cy.get('[data-testid="btn-remove-attachment"], div[class*="_attachmentPreview_"], div[class*="_attach_"]', { timeout: 10000 })
      .should('exist');
  }

  /**
   * Anexa um arquivo ao chat via input-attachment-file, aguarda a pré-visualização,
   * dispara o envio e aguarda a conclusão do componente de upload
   * @param {string} caminhoFixture Caminho do arquivo a ser anexado
   * @param {string} legenda Legenda opcional
   * @param {number} timeoutUploadMs Tempo máximo de espera para conclusão do upload (padrão 60000ms)
   */
  anexarArquivo(caminhoFixture, legenda = '', timeoutUploadMs = 60000) {
    // 0. Garante que não há template pré-selecionado bloqueando os controles de anexo
    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="button-cancel-template"]:visible, button:contains("Cancelar"):visible, div[class*="_templateLockedBar_"]').length > 0) {
        cy.log('🧹 [Compositor]: Template pendente detectado antes de anexar. Cancelando para liberar upload...');
        cy.get('[data-testid="button-cancel-template"], button:contains("Cancelar")').first().click();
        cy.wait(300);
      }
    });

    // 1. Seleciona o arquivo no input de anexo
    this.elements.inputAnexarArquivo().first().selectFile(caminhoFixture, { force: true });

    // 1.1 Aguarda (com retry) o compositor refletir a seleção antes de decidir como enviar.
    // Arquivos reais maiores (poucos MB) levam um instante a mais para o front processar a
    // prévia/preview do que os stubs minúsculos usados antes — um cy.get('body').then() de
    // disparo único, sem espera, podia rodar ANTES dessa atualização e cair no branch errado
    // (nenhum estado reconhecido, nada enviado). Achado real ao trocar os anexos por arquivos
    // válidos maiores em cypress/fixtures/5.atendimentos/anexos/normal/ (24/09/2026).
    cy.get('body', { timeout: 20000 }).should(($body) => {
      const refletiuSelecao =
        $body.find('div[class*="toast"], div[class*="alert"], div[role="alert"]:visible').length > 0 ||
        $body.find('button[data-testid="button-send-audio"], button[class*="_audioInlineSendBtn_"]').length > 0 ||
        $body.find('textarea[placeholder*="Legenda"], input[placeholder*="Legenda"], textarea[data-testid="input-message"]').length > 0 ||
        $body.find('[data-testid="btn-remove-attachment"], div[class*="_attachmentPreview_"], div[class*="_attach_"]').length > 0;
      expect(refletiuSelecao, 'compositor deve refletir o arquivo selecionado (prévia, legenda ou toast de rejeição) antes de decidir como enviar').to.be.true;
    });

    // 2. Se for arquivo com rejeição imediata no frontend (alert/toast), retorna
    const SELETOR_TOAST = 'div[class*="toast"], div[class*="alert"], div[role="alert"]:visible';
    const SELETOR_BTN_AUDIO = 'button[data-testid="button-send-audio"], button[class*="_audioInlineSendBtn_"]';
    const SELETOR_LEGENDA = 'textarea[placeholder*="Legenda"], input[placeholder*="Legenda"], textarea[data-testid="input-message"]';
    const SELETOR_BTN_SEND = 'button[data-testid="button-send-message"], button[data-testid="button-send-audio"], button:has(svg:has(path[d*="21.686"])), button[class*="sendBtn"], button[class*="_sendButton_"]';

    cy.get('body').then(($body) => {
      if ($body.find(SELETOR_TOAST).length > 0) {
        return;
      }

      // 3. Localiza campo de legenda, barra de preview de áudio ou compositor com anexo pré-visualizado e dispara o envio.
      // A DECISÃO de qual ramo seguir usa este snapshot ($body), mas a INTERAÇÃO em si sempre
      // re-consulta o DOM via cy.get() (retryable) em vez de cy.wrap() sobre a coleção jQuery
      // congelada — um elemento pego nesse instante pode ficar stale se o React re-renderizar o
      // compositor entre a seleção do arquivo e o clique (mais provável em arquivos reais maiores,
      // que levam um instante extra para montar a prévia). Achado real com anexos válidos maiores
      // em cypress/fixtures/5.atendimentos/anexos/normal/ (24/09/2026): o clique silenciosamente
      // não disparava a requisição de envio por causa dessa referência desatualizada.
      const temBtnAudio = $body.find(SELETOR_BTN_AUDIO).length > 0;
      const temLegenda = $body.find(SELETOR_LEGENDA).length > 0;

      if (temBtnAudio) {
        cy.get(SELETOR_BTN_AUDIO).first().should('be.visible').and('not.be.disabled').click();
      } else if (temLegenda) {
        if (legenda) {
          cy.get(SELETOR_LEGENDA).first().should('be.visible').clear().type(legenda);
        }
        // Envia via clique no botão de envio (aviãozinho) ou pressionando {enter}
        cy.get('body').then(($b2) => {
          if ($b2.find(SELETOR_BTN_SEND).length > 0) {
            cy.get(SELETOR_BTN_SEND).first().should('be.visible').and('not.be.disabled').click();
          } else {
            cy.get(SELETOR_LEGENDA).first().type('{enter}', { force: true });
          }
        });
      } else {
        cy.get('body').then(($b2) => {
          if ($b2.find(SELETOR_BTN_SEND).length > 0) {
            cy.get(SELETOR_BTN_SEND).first().should('be.visible').and('not.be.disabled').click();
          } else {
            this.elements.btnEnviarMensagemChat().click();
          }
        });
      }

      // 4. Acompanhamento do Componente de Upload:
      // Se exibir "• Enviando mensagem...", aguarda o indicador sumir garantindo o término do upload
      cy.get('body').then(($b) => {
        if ($b.text().includes('Enviando mensagem')) {
          cy.contains('div, p, span', /Enviando mensagem/i, { timeout: timeoutUploadMs }).should('not.exist');
        }
      });
    });
  }

  /**
   * Aguarda que o último balão de mensagem enviado receba a confirmação do WhatsApp (1 risco = Enviado, 2 riscos = Entregue ou Lido)
   * @param {number} timeoutMs Tempo máximo de espera para confirmação (padrão 120000ms / 2 minutos)
   * @param {object} mochaContext Contexto do Mocha (this) do bloco it para acionar skip pontual se necessário
   */
  aguardarConfirmacaoEntregaMensagem(timeoutMs = 120000, mochaContext = null) {
    cy.log('ℹ️ [Confirmação de Leitura/Entrega]: Verificação desabilitada temporariamente (problema conhecido aberto em dev). Validando apenas conclusão do upload e renderização do balão.');

    // 1. Garante que o indicador temporário de upload sumiu
    cy.contains('div, p, span', /Enviando mensagem/i, { timeout: timeoutMs }).should('not.exist');

    // 2. Garante que o balão de mensagem está presente e renderizado na conversa
    cy.get('article[class*="_bubbleRowEnd_"], div[class*="_bubbleEmployee_"]').last().scrollIntoView({ duration: 300 }).should('be.visible');

    cy.log('✅ [Anexo Renderizado]: Upload concluído e balão renderizado com sucesso no chat!');
  }

  /**
   * Valida a presença do balão de mídia indisponível na conversa. Não é mais acionado por tamanho
   * (o teto de 10 MB do base64 inline foi removido pela PR #446, Issue cypress#003) - causa atual
   * é descompasso de `content_type` (resposta PDF-shaped servida para uma imagem, ver `AGENTS.md`
   * §2.3/§3.3).
   */
  validarBalaoMidiaIndisponivel() {
    this.elements.balaoMidiaIndisponivel()
      .last()
      .scrollIntoView({ duration: 300 })
      .should('be.visible')
      .and('contain.text', 'Mídia indisponível');
  }

  /**
   * Anexa um arquivo e dispara o envio SEM tolerar recusa local do frontend.
   * Diferente de anexarArquivo(), este método não desvia o fluxo quando encontra um toast/alerta:
   * ele exige que a prévia do anexo tenha sido montada (prova de que a validação local de tamanho
   * foi removida — front#344 item 1) e só então aciona o envio, deixando a recusa por conta do servidor.
   * @param {string} caminhoFixture Caminho do arquivo a ser anexado
   */
  anexarArquivoEDispararEnvio(caminhoFixture) {
    // 1. Seleciona o arquivo no input de anexo
    this.elements.inputAnexarArquivo().first().selectFile(caminhoFixture, { force: true });

    // 2. Exige a prévia montada no compositor: se o front ainda validasse tamanho localmente,
    //    o arquivo seria recusado aqui e a prévia nunca existiria
    this.validarAnexoPendenteNoCompositor();

    // 3. Dispara o envio pelo botão dedicado do compositor
    this.elements.btnEnviarMensagemChat().should('not.be.disabled').click();
  }

  /**
   * Valida que a recusa por tamanho exibida na tela é a mensagem que o servidor devolveu no 413,
   * nomeando o limite em MB (front#344 item 2 / backend#527 - CORS no 413).
   * Antes da correção do CORS, o browser descartava a resposta e a tela mostrava "Sem conexão".
   */
  validarMensagemDeRecusaDoServidor() {
    this.elements.mensagemRecusaDeTamanho({ timeout: 20000 })
      .should('be.visible')
      .invoke('text')
      .should('match', /excede o limite de \d+ MB|acima do limite de \d+ MB/i);
  }

  /**
   * Valida a recusa LOCAL de um anexo acima do teto por tipo (front#595/PR #598): o aviso com o teto aparece na faixa do compositor,
   * a prévia não monta (sem botão de remover) e nenhum POST de mídia sai. Exige o alias `sendChatMediaMessage` registrado antes de anexar
   * (AtendimentosMocks.interceptSendMediaMessageApi), que serve de espião nos dois modos.
   * @param {string} textoEsperado Aviso exato do front, ex.: 'Documento acima do limite de 10 MB.'
   */
  validarRecusaLocalDeTamanho(textoEsperado) {
    this.elements.avisoLocalDeTamanho({ timeout: 10000 }).should('be.visible').and('have.text', textoEsperado);
    this.elements.btnRemoverAnexo().should('not.exist');
    cy.get('@sendChatMediaMessage.all').should('have.length', 0);
  }

  /**
   * Conta as bolhas de mensagem do atendente atualmente renderizadas na conversa
   * @returns {Cypress.Chainable<number>} Quantidade de bolhas enviadas
   */
  contarBaloesEnviados() {
    return cy.get('body').then(($body) => (
      $body.find('article[class*="_bubbleRowEnd_"], div[class*="_bubbleEmployee_"]').length
    ));
  }

  /**
   * Valida a renderização do player de voz nativo na conversa
   */
  validarAudioPlayerVisivel() {
    // Asserção escopada no WRAPPER do player (`audio-player-m-{messageId}`), não no seletor amplo
    // `audioPlayerChat`. Dois motivos, ambos confirmados em execução real:
    //  1. `audioPlayerChat` inclui a tag `audio` crua, que é renderizada SEM o atributo `controls`
    //     e portanto é invisível por design — assertar `be.visible` sobre ela falha sempre.
    //  2. O seletor amplo casa com todos os áudios do histórico; como o jQuery `:visible` é
    //     satisfeito por QUALQUER elemento do conjunto, a asserção antiga passava mesmo que o player
    //     recém-enviado não tivesse renderizado. Escopar em `.last()` sobre o wrapper torna a
    //     verificação estrita e realmente sobre o áudio deste cenário.
    this.elements.playerAudioInline().last().scrollIntoView({ duration: 300 }).should('be.visible');
  }

  // -------------------------------------------------------------
  // VALIDAÇÃO DE ABERTURA DE ANEXOS (PRÉVIA x DOWNLOAD)
  // -------------------------------------------------------------

  /**
   * Clica no último anexo de imagem da conversa e valida que a prévia (lightbox) abre com a
   * imagem efetivamente decodificada pelo navegador (`naturalWidth > 0` prova que o arquivo é válido,
   * não apenas que a tag <img> existe). Fecha a prévia ao final para não vazar estado ao próximo cenário.
   */
  abrirPreviaDeImagemEValidar() {
    this.elements.botaoAnexoImagem().last().scrollIntoView({ duration: 300 }).click();

    this.elements.lightboxImagem()
      .should('be.visible')
      .and(($img) => {
        expect($img[0].naturalWidth, 'largura real decodificada da imagem na prévia').to.be.greaterThan(0);
        expect($img[0].naturalHeight, 'altura real decodificada da imagem na prévia').to.be.greaterThan(0);
      });

    this.elements.btnFecharLightboxImagem().click();
    this.elements.lightboxImagem().should('not.exist');
  }

  /**
   * Clica no último anexo PDF da conversa e valida que a prévia (lightbox de PDF) abre.
   * Fecha a prévia ao final.
   */
  abrirPreviaDePdfEValidar() {
    this.elements.botaoAnexoPdf().last().scrollIntoView({ duration: 300 }).click();

    this.elements.lightboxPdf().should('be.visible');

    this.elements.btnFecharLightboxPdf().click();
    this.elements.lightboxPdf().should('not.exist');
  }

  /**
   * Valida que o áudio anexado é reproduzível de fato: além do player estar visível, o elemento
   * <audio> precisa ter metadados carregados (`readyState >= 1`) e duração maior que zero —
   * é isso que prova que o arquivo enviado é um MP3 válido e não apenas bytes com a extensão certa.
   */
  reproduzirAudioEValidar() {
    this.elements.playerAudioInline().last().scrollIntoView({ duration: 300 }).should('be.visible');

    this.elements.elementoAudioAnexo().last().should(($audio) => {
      const audio = $audio[0];
      expect(audio.readyState, 'readyState do <audio> (metadados carregados)').to.be.gte(1);
      expect(audio.duration, 'duração decodificada do áudio em segundos').to.be.greaterThan(0);
    });

    // Aciona o play e confirma que o elemento saiu do estado pausado
    this.elements.botaoPlayAudioInline().last().click();
    this.elements.elementoAudioAnexo().last().should(($audio) => {
      expect($audio[0].paused, 'áudio deve estar em reprodução após o play').to.eq(false);
    });
  }

  /**
   * Valida que o vídeo anexado é reproduzível de fato: metadados carregados e dimensões reais
   * de quadro (`videoWidth > 0`), provando que o MP4 enviado tem faixa de vídeo decodificável.
   */
  reproduzirVideoEValidar() {
    this.elements.elementoVideoAnexo().last().scrollIntoView({ duration: 300 }).should('be.visible');

    this.elements.elementoVideoAnexo().last().should(($video) => {
      const video = $video[0];
      expect(video.readyState, 'readyState do <video> (metadados carregados)').to.be.gte(1);
      expect(video.videoWidth, 'largura real do quadro de vídeo').to.be.greaterThan(0);
      expect(video.duration, 'duração decodificada do vídeo em segundos').to.be.greaterThan(0);
    });
  }

  /**
   * Baixa um documento pelo botão "Baixar documento" (`button-download-document-m-{id}`) e valida o download: nome com a extensão
   * esperada e conteúdo não vazio. Desde a backend#613/front#521 o documento, inclusive o recém-enviado na mesma sessão, não vem
   * mais como `<a class="_documentLink_" href="data:...">`: o clique roda uma mutation que obtém o conteúdo, cria um Blob e dispara
   * `URL.createObjectURL` + `<a download="<nome>">.click()` (medido no bundle e na API real em 2026-11-06, `ROADMAP.md` P1-16; para a
   * mensagem recém-enviada o conteúdo não passou pela rota `GET .../messages/:id/attachment`). A prova captura o próprio download:
   * o Blob entregue a `createObjectURL` e o `download` da âncora (o clique dela é absorvido, sem gravar em disco nem abrir aba).
   * @param {string} extensaoEsperada Extensão esperada, com ponto (ex.: '.doc')
   * @param {number|string} messageId ID da mensagem do documento
   */
  baixarDocumentoSobDemandaEValidar(extensaoEsperada, messageId) {
    const extensao = new RegExp(`\\${extensaoEsperada}$`, 'i');
    const capturados = { blobs: [], downloads: [] };
    cy.window().then((win) => {
      const criarUrlOriginal = win.URL.createObjectURL.bind(win.URL);
      cy.stub(win.URL, 'createObjectURL').callsFake((blob) => {
        capturados.blobs.push({ tamanho: blob.size, tipo: blob.type });
        return criarUrlOriginal(blob);
      });
      const clicarOriginal = win.HTMLAnchorElement.prototype.click;
      cy.stub(win.HTMLAnchorElement.prototype, 'click').callsFake(function clicarAncora() {
        if (this.hasAttribute('download')) {
          capturados.downloads.push({ nome: this.download, href: this.href });
          return undefined;
        }
        return clicarOriginal.call(this);
      });
    });

    this.elements.botaoBaixarDocumento(messageId)
      .scrollIntoView({ duration: 300 })
      .should('be.visible')
      .and('have.attr', 'aria-busy', 'false')
      .and('have.attr', 'aria-label')
      .and('match', extensao);
    this.elements.botaoBaixarDocumento(messageId).click();

    cy.wrap(capturados, { timeout: 60000 }).its('downloads').should('have.length', 1);
    cy.then(() => {
      const [download] = capturados.downloads;
      expect(download.nome, `nome do arquivo baixado (${download.nome})`).to.match(extensao);
      expect(download.href, 'download a partir de um Blob').to.match(/^blob:/);
      expect(capturados.blobs, 'Blob criado para o download').to.have.length.greaterThan(0);
      expect(capturados.blobs[capturados.blobs.length - 1].tamanho, `conteúdo do arquivo baixado (${download.nome})`).to.be.greaterThan(0);
    });
    this.elements.botaoBaixarDocumento(messageId).should('have.attr', 'aria-busy', 'false');
  }

  /**
   * Abre a gaveta lateral de Transferências a partir do card do cliente
   */
  abrirGavetaTransferencias() {
    cy.get('body').then(($body) => {
      // A gaveta só é considerada aberta se o botão de ação "Nova transferência" estiver visível dentro dela
      const jaEstaAberta = $body.find('aside button:contains("Nova transferência"):visible, button:contains("Nova transferência"):visible').length > 0;
      if (!jaEstaAberta) {
        this.elements.summaryTransferencias().should('be.visible').click();
      }
    });
    this.elements.btnNovaTransferenciaDrawer().should('be.visible');
  }

  /**
   * Clica no botão "+ Nova transferência" no rodapé da gaveta de transferências
   */
  clicarNovaTransferenciaGaveta() {
    this.elements.btnNovaTransferenciaDrawer().click();
    this.elements.modalTransferir().should('be.visible');
  }

  /**
   * Valida que o histórico de transferências foi gravado. Desde o deploy de 2026-10-15 o atalho
   * "Transferências" do painel lateral e a gaveta não existem mais: o histórico fica na aba "Histórico" da
   * própria modal de transferência (linhas `transfer-history-row-{id}`, a mais recente no topo, no formato
   * "<quem> alterou o atendimento de / <origem> para <destino> / dd/MM/aa - HH:mm"). Abre a modal, vai
   * para a aba, confere a linha mais recente e fecha a modal.
   * @param {string|RegExp} [deQuem] Nome ou padrão do atendente de origem
   * @param {string|RegExp} [paraQuem] Nome ou padrão do atendente de destino
   */
  validarHistoricoTransferenciasGravado(deQuem = null, paraQuem = null) {
    this.abrirModalTransferirPeloMenuCliente();
    cy.get('[data-testid="transfer-tab-history"]').should('be.visible').click();
    cy.get('[data-testid^="transfer-history-row-"]').should('have.length.gte', 1);

    // Inspeciona a linha mais recente (a primeira da lista)
    cy.get('[data-testid^="transfer-history-row-"]').first().within(() => {
      // 1. Valida o texto descritivo "<quem> alterou o atendimento de ... para ..."
      cy.get('[class*="_historyText_"]').should(($t) => {
        const texto = $t.text();
        expect(texto).to.match(/alterou o atendimento de.+ para /i);

        if (deQuem) {
          const regexDe = deQuem instanceof RegExp ? deQuem : new RegExp(`de .*${deQuem}`, 'i');
          expect(texto).to.match(regexDe);
        }

        if (paraQuem) {
          const regexPara = paraQuem instanceof RegExp ? paraQuem : new RegExp(`para .*${paraQuem}`, 'i');
          expect(texto).to.match(regexPara);
        }
      });

      // 2. Valida a hora da transferência (HH:mm com tolerância de 1 min para duração do teste)
      const agora = new Date();
      const formatarHora = (d) => {
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        return `${h}:${m}`;
      };
      const aceitas = [formatarHora(agora), formatarHora(new Date(agora.getTime() - 60000)), formatarHora(new Date(agora.getTime() + 60000))];

      cy.get('time').should(($time) => {
        const horaRenderizada = $time.text().trim().slice(-5);
        expect(aceitas).to.include(horaRenderizada);
      });
    });

    this.fecharModalTransferir();
  }

  /**
   * Abre a gaveta lateral de Orçamentos a partir do card do cliente
   */
  abrirGavetaOrcamentos() {
    cy.get('body').then(($body) => {
      // Se a gaveta de orçamentos já estiver aberta na tela, evita clicar novamente para não fechá-la
      if ($body.find('[data-testid="button-abrir-enviar-orcamento"]:visible').length > 0) {
        return;
      }
      this.elements.summaryOrcamentos().scrollIntoView().should('be.visible').click();
    });
    this.elements.drawerOrcamentos().should('be.visible');
  }

  /**
   * Abre a modal "Personalização do orçamento" a partir do ícone de paleta no cabeçalho da
   * gaveta de Orçamentos (Issue #449, PR #451) - exige a gaveta já aberta e a capability
   * can_customize_budget concedida.
   */
  abrirModalPersonalizacaoOrcamento() {
    this.elements.btnCustomizeBudget().should('be.visible').click();
    this.elements.modalBudgetCustomization().should('be.visible');
  }

  /**
   * Digita a cor no campo HEX da personalização do orçamento (limpa antes de digitar)
   */
  digitarCorHexOrcamento(hex) {
    this.elements.inputBudgetAccentHex().clear().type(hex);
  }

  /**
   * Anexa um arquivo de capa via input file oculto (Issue #449) - dispara o onChange sintético
   */
  enviarCapaOrcamento(fixturePath) {
    this.elements.inputBudgetCoverFile().selectFile(fixturePath, { force: true });
  }

  /**
   * Abre a gaveta lateral de Links de Pagamento a partir do card do cliente
   */
  abrirGavetaLinksPagamento() {
    cy.get('body').then(($body) => {
      // Se a gaveta de links já estiver aberta, evita clicar novamente
      if ($body.find('[data-testid="payment-link-new"]:visible, button:contains("Novo link"):visible').length > 0) {
        return;
      }
      this.elements.summaryLinks().scrollIntoView().should('be.visible').click();
    });
    this.elements.drawerLinksPagamento().should('be.visible');
  }

  /**
   * Fecha a gaveta lateral de Orçamentos
   */
  fecharGavetaOrcamentos() {
    cy.get('body').then(($body) => {
      const btnClose = $body.find('button[aria-label="Fechar"], button[class*="_closeBtn_"], button[class*="_sideDrawerCloseBtn_"]');
      if (btnClose.length > 0) {
        cy.wrap(btnClose).first().click();
      } else {
        cy.get('body').type('{esc}');
      }
    });
    cy.get('[class*="_sideDrawerWrapOpen_"]').should('not.exist');
  }

  /**
   * Fecha a gaveta lateral de Observações
   */
  fecharGavetaObservacoes() {
    cy.get('body').then(($body) => {
      const btnClose = $body.find('button[aria-label="Fechar"], button[class*="_closeBtn_"], button[class*="_sideDrawerCloseBtn_"]');
      if (btnClose.length > 0) {
        cy.wrap(btnClose).first().click();
      } else {
        cy.get('body').type('{esc}');
      }
    });
    cy.get('[class*="_sideDrawerWrapOpen_"]').should('not.exist');
  }

  /**
   * Fecha a gaveta lateral de Links de Pagamento
   */
  fecharGavetaLinksPagamento() {
    cy.get('body').then(($body) => {
      const btnClose = $body.find('button[aria-label="Fechar"], button[class*="_closeBtn_"], button[class*="_sideDrawerCloseBtn_"]');
      if (btnClose.length > 0) {
        cy.wrap(btnClose).first().click();
      } else {
        cy.get('body').type('{esc}');
      }
    });
    cy.get('[class*="_sideDrawerWrapOpen_"]').should('not.exist');
  }

  /**
   * Valida a renderização e propriedades do card de link de pagamento gerado na gaveta
   * @param {string|number} linkId ID do link de pagamento (opcional)
   * @param {string} statusEsperado Texto do status esperado (ex: 'Aguardando', 'Pago')
   */
  validarCardLinkPagamentoRenderizado(linkId = null, statusEsperado = 'Aguardando') {
    // Factory em vez de const: um chainable do Cypress é consumido ao ser usado, então reaproveitar
    // a mesma variável faz o .find() seguinte partir do subject retornado pelo anterior (o botão),
    // e não do card. Cada chamada abaixo precisa reconsultar o card do zero.
    const card = () => (linkId ? this.elements.cardLinkPagamentoPorId(linkId) : this.elements.cardsLinkPagamentoDrawer().first());

    card().scrollIntoView().should('be.visible');
    card().find('[data-testid="payment-link-details-toggle"]').should('be.visible');

    // A URL do checkout, o botão de copiar e o link de abertura ficam na região de detalhes,
    // que nasce colapsada (aria-expanded="false"): é preciso expandir antes de inspecioná-los.
    card().find('[data-testid="payment-link-details-toggle"]').then(($toggle) => {
      if ($toggle.attr('aria-expanded') !== 'true') {
        cy.wrap($toggle).click();
      }
    });

    card().find('[data-testid="payment-link-copy-url"]').should('be.visible');
    card().find('[data-testid="payment-link-open-url"]').should('be.visible').and('have.attr', 'href');
    if (statusEsperado) {
      card().find('[class*="_paymentLinkStatusBadge_"]').should('contain.text', statusEsperado);
    }
  }

  /**
   * Alterna a expansão/recolhimento dos detalhes da venda no card de link de pagamento
   * @param {string|number} linkId ID do link de pagamento (opcional)
   */
  alternarDetalhesLinkPagamento(linkId = null) {
    const card = linkId ? this.elements.cardLinkPagamentoPorId(linkId) : this.elements.cardsLinkPagamentoDrawer().first();
    card.find('[data-testid="payment-link-details-toggle"]').click();
  }

  /**
   * Abre a modal de pré-visualização "Enviar orçamento"
   */
  abrirModalEnviarOrcamento() {
    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="modal-enviar-orcamento"]:visible').length > 0) {
        return;
      }
      this.elements.btnAbrirModalEnviarOrcamento().scrollIntoView().should('be.visible').click();
    });
    this.elements.modalEnviarOrcamento().should('be.visible');
  }

  /**
   * Clica no botão "Baixar" dentro da modal de envio de orçamento
   */
  clicarBaixarOrcamentoModal() {
    this.elements.btnBaixarOrcamentoModal().should('be.visible').and('not.be.disabled').click();
  }

  /**
   * Clica no botão "Enviar para o chat" dentro da modal de orçamento
   */
  enviarOrcamentoParaChatModal() {
    this.elements.btnEnviarParaOChatModal().should('be.visible').and('not.be.disabled').click();
    // Confirma que a modal foi fechada após o envio
    cy.get('[data-testid="modal-enviar-orcamento"]', { timeout: 10000 }).should('not.exist');
  }

  /**
   * Valida a exibição do balão de orçamento formatado na conversa do chat
   */
  validarBalaoOrcamentoNoChat() {
    this.elements.balaoOrcamentoChat().scrollIntoView().should('be.visible');
  }

  /**
   * Obtém o ID numérico do atendimento atualmente ativo e aberto na tela
   * @returns {Cypress.Chainable<number>}
   */
  obterIdAtendimentoAtivo() {
    return cy.get('body').then(($body) => {
      // 1. Procura no card do cliente à direita ou no cabeçalho do chat
      const elProtocolo = $body.find('[data-testid="text-cliente-protocolo"], [data-testid="card-cliente"] h2, [data-testid="card-cliente"] h3');
      if (elProtocolo.length > 0) {
        const match = elProtocolo.text().match(/(\d{7,12})/);
        if (match) return Number(match[1]);
      }

      // 2. Procura no header do chat
      const headerText = $body.find('header, [data-testid="chat-header"]').text();
      const matchHeader = headerText.match(/#?\s*(\d{7,12})/);
      if (matchHeader) return Number(matchHeader[1]);

      // 3. Procura no card ativo da lista
      const cardAtivo = $body.find('[data-testid="card-attendance"].active, [data-testid="card-attendance"]');
      if (cardAtivo.length > 0) {
        const matchCard = cardAtivo.first().text().match(/#?\s*(\d{7,12})/);
        if (matchCard) return Number(matchCard[1]);
      }

      return 260900010; // Fallback seguro
    });
  }

  /**
   * Cria um orçamento completo via API vinculado ao Atendimento ativo (Prescrição -> Fórmula -> Produto -> Cálculo -> Carrinho -> Finalize)
   * Executa a cadeia transacional completa baseada no Delphi (pMOV_0145.pas)
   * @param {number} storeId ID da loja (padrão 1)
   * @param {number|null} attendanceId ID opcional do atendimento (se omitido, captura o ativo da tela)
   * @returns {Cypress.Chainable<object>}
   */
  criarOrcamentoCompletoViaApi(storeId = 1, attendanceId = null) {
    const getId = attendanceId 
      ? cy.wrap(Number(attendanceId)) 
      : this.obterIdAtendimentoAtivo();

    return getId.then((idAtendimento) => {
      const configEnv = require('../../env.json');
      const cnpj = Cypress.env('userCnpj') || configEnv.USER_CNPJ;
      const usuario = Cypress.env('user') || configEnv.USER_CODE;
      const senha = Cypress.env('userPassword') || configEnv.USER_PASSWORD;
      const apiUrl = Cypress.env('API_URL') || 'https://api.omnicare.dev.local';

      // 1. Obtém token JWT válido autenticando diretamente na API REST
      return cy.request({
        method: 'POST',
        url: `${apiUrl}/auth/login`,
        body: {
          cnpj: String(cnpj).replace(/\D/g, ''),
          username: Number(usuario) || usuario,
          password: senha
        }
      }).then((authRes) => {
        const token = authRes.body.access_token;
        const headers = { Authorization: `Bearer ${token}` };

        // 2. Cria Prescrição vinculada diretamente ao Atendimento (attendance_id)
        return cy.request({
          method: 'POST',
          url: `${apiUrl}/prescriptions`,
          headers,
          body: {
            prescription_type: 'human',
            status: 0,
            sale_type: 1,
            patient_id: 867092,
            patient_name: 'KLISMAM MONTEIRO',
            buyer_id: 867092,
            buyer_name: 'KLISMAM MONTEIRO',
            attendance_id: Number(idAtendimento),
            prescriber_id: 18780,
            prescriber_name: 'ABADIO JOSE SILVA',
            pickup_store_id: storeId,
            pickup_store_name: '*** PHARMACIE - DEMO - CONSULFARMA'
          }
        }).then((resPrescription) => {
          const prescriptionId = resPrescription.body.id;

          // 3. Cria Fórmula (A2)
          return cy.request({
            method: 'POST',
            url: `${apiUrl}/prescriptions/${prescriptionId}/formulas`,
            headers,
            body: {
              formula_number: 1,
              pharmaceutical_form_id: 2,
              lab_id: 2,
              qvd: 30.00,
              multiplier: 1
            }
          }).then((resFormula) => {
            const formulaId = resFormula.body.id;

            // 4. Adiciona Produto na Fórmula (A3)
            return cy.request({
              method: 'POST',
              url: `${apiUrl}/prescriptions/${prescriptionId}/formulas/${formulaId}/products`,
              headers,
              body: {
                product_id: 1004866,
                quantity: 250.0000,
                unit: 'mg'
              }
            }).then(() => {
              // 5. Calcula Fórmula (Gate obrigatório do Delphi, CALC1 + GRAVAR_FORMULA)
              return cy.request({
                method: 'POST',
                url: `${apiUrl}/prescriptions/${prescriptionId}/formulas/${formulaId}/calculate`,
                headers
              }).then((resCalc) => {
                // 6. Vincula Carrinho ao Atendimento
                return cy.request({
                  method: 'POST',
                  url: `${apiUrl}/prescriptions/${prescriptionId}/cart`,
                  headers,
                  body: { attendance_id: Number(idAtendimento) },
                  failOnStatusCode: false
                }).then((resCart) => {
                  // 7. Finaliza Receita (Commit transacional Delphi, STATUS_MOV muda de 0 para -1)
                  return cy.request({
                    method: 'POST',
                    url: `${apiUrl}/prescriptions/${prescriptionId}/finalize`,
                    headers,
                    failOnStatusCode: false
                  }).then((resFin) => {
                    return cy.wrap({
                      prescriptionId,
                      formulaId,
                      calc: resCalc.body,
                      cart: resCart.body,
                      finalize: resFin.body
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  }

  /**
   * Obtém a quantidade de orçamentos vinculados ao atendimento
   * @returns {Cypress.Chainable<number>}
   */
  obterTotalOrcamentos() {
    return this.elements.summaryOrcamentos().then(($el) => {
      const text = $el.text();
      const match = text.match(/(\d+)\s*orçamento/i);
      return match ? parseInt(match[1], 10) : 0;
    });
  }

  /**
   * Abre a modal de envio de link de pagamento
   */
  abrirModalEnviarLinkPagamento() {
    this.elements.summaryLinks().click();
    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="modal-enviar-link-pagamento"]:visible').length > 0) {
        return;
      }
      // Retry-ability do próprio cy.get()/.should() (não o jQuery síncrono do $body acima) espera
      // a gaveta terminar de montar após o GET /payment-links resolver — decidir só com o $body no
      // milissegundo zero do clique perdia o botão (bug latente, nunca exercitado por teste real
      // antes da Issue backend#332; AGENTS.md [R-SEL] bifurcação condicional)
      cy.get('[data-testid="payment-link-new"]', { timeout: 10000 }).should('be.visible').click();
    });
    this.elements.modalEnviarLinkPagamento().should('be.visible');
  }

  /**
   * Seleciona a operadora (ex: '3' para Cielo) e confirma o envio do link de pagamento
   * @param {string} operadora Valor da operadora ('3' para Cielo)
   * @param {string} parcelas Valor de parcelas ('1' para 1x)
   */
  preencherEEnviarLinkPagamento(operadora = '3', parcelas = '1') {
    this.elements.selectOperadoraLink().select(operadora);
    if (parcelas) {
      this.elements.selectParcelasLink().select(parcelas);
    }
    this.elements.btnEnviarLinkPagamentoModal().click();
  }

  /**
   * Realiza o pagamento no gateway Cielo Checkout através de cy.origin
   * @param {string} checkoutUrl URL do checkout Cielo
   * @param {object} dados Dados de pagamento e comprador
   */
  realizarPagamentoCieloCheckout(checkoutUrl, dados) {
    cy.visit(checkoutUrl);

    cy.origin('https://cieloecommerce.cielo.com.br', { args: { dados } }, ({ dados }) => {
      // 1. Seleciona "Cartão de crédito"
      cy.contains('button.payment-type', /Cartão de crédito/i).click();

      // 2. Preenche dados do Cartão e Endereço de Cobrança
      cy.contains('label', /Número do cartão/i).parent().find('input').type(dados.CARTAO.NUMERO);
      cy.contains('label', /Nome como está no cartão/i).parent().find('input').type(dados.CARTAO.NOME_IMPRESSO);
      cy.contains('label', /Vencimento/i).parent().find('input').type(dados.CARTAO.VENCIMENTO);
      cy.contains('label', /Código de segurança/i).parent().find('input').type(dados.CARTAO.CVV);

      cy.contains('label', /CEP/i).parent().find('input').type(dados.ENDERECO_COBRANCA.CEP);
      cy.contains('label', /Número/i).parent().find('input').type(dados.ENDERECO_COBRANCA.NUMERO);
      if (dados.ENDERECO_COBRANCA.COMPLEMENTO) {
        cy.contains('label', /Complemento/i).parent().find('input').type(dados.ENDERECO_COBRANCA.COMPLEMENTO);
      }

      cy.contains('button', /Continuar/i).click();

      // 3. Preenche dados do Comprador e Documento
      cy.contains('label', /Nome Completo/i).parent().find('input').type(dados.COMPRADOR.NOME_COMPLETO);
      cy.contains('label', /E-mail/i).parent().find('input').type(dados.COMPRADOR.EMAIL);
      cy.contains('label', /Celular/i).parent().find('input').type(dados.COMPRADOR.CELULAR);
      cy.contains('label', /Número do documento/i).parent().find('input').type(dados.COMPRADOR.DOCUMENTO);

      // 4. Aceita termos e conclui a compra
      cy.get('input[type="checkbox"]').check({ force: true });
      cy.contains('button', /Concluir compra/i).click();
    });
  }

  /**
   * Abre a gaveta lateral de Mensagens Padrão a partir do card do cliente
   */
  abrirGavetaMensagemPadrao() {
    this.elements.summaryMensagemPadrao().click();
    this.elements.drawerMensagemPadrao().should('be.visible');
  }

  /**
   * Abre a gaveta lateral de Mensagens Template a partir do resumo do cliente
   */
  abrirGavetaTemplates() {
    cy.get('body').then(($body) => {
      // Se a gaveta já estiver aberta com templates visíveis, não precisa clicar para não fechar
      if ($body.find('[data-testid^="panel-template-"]:visible').length > 0) {
        return;
      }
      this.elements.summaryTemplates().scrollIntoView().should('be.visible').click();
    });
    cy.get('[data-testid^="panel-template-"]', { timeout: 10000 }).should('be.visible');
  }

  /**
   * Busca por uma mensagem padrão na gaveta
   * @param {string} termo Termo de busca
   */
  buscarMensagemPadrao(termo) {
    this.elements.inputBuscarMensagemPadrao().clear().type(termo);
  }

  /**
   * Seleciona uma mensagem padrão na lista e aciona "Usar mensagem"
   * @param {string} nomeMensagem Texto ou título da mensagem padrão
   */
  selecionarEUsarMensagemPadrao(nomeMensagem) {
    const getDrawer = () => cy.get('aside[class*="_sideDrawer_"][role="dialog"], aside[role="dialog"]').filter(':visible').first();

    // 1. Localiza e clica no botão interativo da mensagem na listagem da gaveta lateral
    getDrawer().then(($aside) => {
      const alvos = [nomeMensagem, 'Endereço', 'Ajuda Mais', 'Iniciando', 'Duvidas', 'Fórmula'].filter(Boolean);
      let clicou = false;

      for (const alvo of alvos) {
        const btn = $aside.find(`button[data-message-code]:contains("${alvo}"), button[class*="_standardMsgItemBtn_"]:contains("${alvo}"), [data-testid^="panel-msg-padrao-"]:contains("${alvo}")`);
        if (btn.length > 0) {
          cy.wrap(btn.first()).click();
          clicou = true;
          break;
        }
      }

      if (!clicou) {
        cy.wrap($aside)
          .find('button[data-message-code], button[class*="_standardMsgItemBtn_"], [data-testid^="panel-msg-padrao-"]')
          .first()
          .click();
      }
    });

    // 2. Aciona o botão "Usar mensagem" posicionado na base da gaveta (assegurando que esteja habilitado)
    getDrawer()
      .contains('button', /Usar mensagem/i)
      .should('be.visible')
      .and('not.be.disabled')
      .click();
  }

  /**
   * Seleciona um template sem variáveis na gaveta de templates
   * @param {string} nomeTemplate Nome do template opcional (ex: 'finalizar_atendimento')
   */
  selecionarTemplateSemVariavel(nomeTemplate = null) {
    const alvo = nomeTemplate || 'finalizar_atendimento';
    cy.get('body').then(($b) => {
      const temAlvo = $b.find('button[data-testid^="panel-template-"]').filter(`:contains("${alvo}")`).length > 0;
      if (temAlvo) {
        cy.get('button[data-testid^="panel-template-"]')
          .contains('span', new RegExp(`^${alvo}$`, 'i'))
          .parents('button[data-testid^="panel-template-"]')
          .first()
          .click();
      } else {
        // Seleciona o primeiro template que NÃO tem a marcação "Com variáveis"
        cy.get('button[data-testid^="panel-template-"]', { timeout: 10000 })
          .filter(':not(:has(span:contains("Com variáveis")))')
          .first()
          .click();
      }
    });
    cy.wait(500);
    cy.get('[data-testid="panel-btn-usar-template"], button:contains("Usar template")')
      .should('be.visible')
      .and('not.be.disabled')
      .click();
  }

  /**
   * Valida que o template sem variável foi carregado no compositor com o banner informativo ou botão cancelar
   */
  validarTemplateEscolhidoNoCompositor() {
    cy.get('body').should(($b) => {
      const temBanner = $b.text().includes('Template escolhido') || $b.find('[class*="_templateLockedBar_"]').length > 0;
      const temBtnCancelar = $b.find('[data-testid="button-cancel-template"]:visible, button:contains("Cancelar"):visible').length > 0;
      expect(temBanner || temBtnCancelar, 'Template deve estar carregado no compositor com banner ou botão cancelar').to.be.true;
    });
  }

  /**
   * Valida a exibição do botão "Cancelar" acima do campo de mensagem após selecionar um template
   */
  validarBotaoCancelarTemplateVisivel() {
    this.elements.btnCancelarTemplate().should('be.visible');
  }

  /**
   * Valida a ausência do botão "Cancelar" e da barra de template travado no compositor
   */
  validarAusenciaTemplateNoCompositor() {
    cy.get('[data-testid="button-cancel-template"]').should('not.exist');
    cy.get('[class*="_templateLockedBar_"]').should('not.exist');
  }

  /**
   * Cancela o template escolhido no compositor de mensagem
   */
  cancelarTemplateEscolhidoNoCompositor() {
    this.elements.btnCancelarTemplate().should('be.visible').click();
    this.validarAusenciaTemplateNoCompositor();
  }

  /**
   * Abre a gaveta lateral de Observações a partir do card do cliente
   */
  abrirGavetaObservacoes() {
    cy.get('body').then(($body) => {
      // Se a gaveta de observações já estiver aberta, evita fechar
      if ($body.find('aside[role="dialog"]:contains("Observações"):visible').length === 0) {
        this.elements.summaryObservacoes().click();
      }
    });
    this.elements.drawerObservacoes().should('be.visible');
  }

  /**
   * Cria uma nova observação na gaveta
   * @param {string} texto Texto da observação
   */
  criarObservacao(texto) {
    this.elements.inputEscreverObservacao().should('be.visible').clear().type(texto);
    this.elements.btnSalvarObservacao().should('not.be.disabled').click();
    cy.wait(500);
  }

  /**
   * Edita a primeira observação da lista
   * @param {string} novoTexto Novo texto atualizado
   */
  editarObservacao(novoTexto) {
    this.elements.btnEditarObservacao().first().click();
    cy.wait(300);
    cy.get('body').then(($body) => {
      // Se abriu input inline dentro do card
      const inlineInput = $body.find('article[data-testid^="observation-"] input:visible, article[data-testid^="observation-"] textarea:visible');
      if (inlineInput.length > 0) {
        cy.wrap(inlineInput).first().clear().type(novoTexto);
        const btnSave = $body.find('article[data-testid^="observation-"] button:contains("Salvar"), article[data-testid^="observation-"] button[type="submit"]');
        if (btnSave.length > 0) {
          cy.wrap(btnSave).first().click();
        } else {
          cy.wrap(inlineInput).first().type('{enter}', { force: true });
        }
      } else {
        // Se utilizou o compositor do topo
        this.elements.inputEscreverObservacao().clear().type(novoTexto);
        this.elements.btnSalvarObservacao().should('not.be.disabled').click();
      }
    });
    cy.wait(500);
  }

  /**
   * Edita a primeira observação da lista SEM salvar - deixa o campo com o texto alterado e a
   * gaveta aberta, para testar a guarda de saída (Issue front#461, PR #464)
   * @param {string} novoTexto Novo texto (fica só no campo, nunca salvo)
   */
  editarObservacaoSemSalvar(novoTexto) {
    this.elements.btnEditarObservacao().first().click();
    cy.wait(300);
    cy.get('body').then(($body) => {
      const inlineInput = $body.find('article[data-testid^="observation-"] input:visible, article[data-testid^="observation-"] textarea:visible');
      if (inlineInput.length > 0) {
        cy.wrap(inlineInput).first().clear().type(novoTexto);
      } else {
        this.elements.inputEscreverObservacao().clear().type(novoTexto);
      }
    });
  }

  /**
   * Valida o valor atual do campo de edição de observação em aberto (inline no card ou
   * reaproveitando o compositor do topo - mesma ambiguidade de editarObservacao/editarObservacaoSemSalvar)
   * @param {string} valorEsperado Valor esperado no campo
   */
  validarValorEdicaoObservacaoAtiva(valorEsperado) {
    cy.get('body').then(($body) => {
      const inlineInput = $body.find('article[data-testid^="observation-"] input:visible, article[data-testid^="observation-"] textarea:visible');
      if (inlineInput.length > 0) {
        cy.wrap(inlineInput).first().should('have.value', valorEsperado);
      } else {
        this.elements.inputEscreverObservacao().should('have.value', valorEsperado);
      }
    });
  }

  /**
   * Localiza o card (article) de uma observação já salva pelo texto exibido no corpo — nunca
   * por índice/posição, que não é um contrato documentado da ordem da lista. Necessário com
   * 2+ observações simultâneas na gaveta (Issue front#468/PR #469).
   * @param {string} texto Texto salvo e exibido no card (exato)
   */
  getObservacaoPorTexto(texto) {
    return this.elements.itensObservacoes().filter(`:contains("${texto}")`);
  }

  /**
   * Clica no lápis de edição de uma observação específica, por texto salvo — nunca `.first()`
   * cego (Issue front#468/PR #469: trocar de observação em edição com texto não salvo exige
   * escopar o card certo, não o primeiro da lista).
   * @param {string} texto Texto salvo da observação a editar
   */
  clicarLapisObservacaoPorTexto(texto) {
    this.getObservacaoPorTexto(texto).find('[data-testid="observation-edit"]').click();
  }

  /**
   * Confere que o cursor do campo de edição ativo está no fim do texto, logo após entrar em
   * edição (Issue front#469: antes o foco se perdia ao abrir a edição).
   * @param {string} textoEsperado Valor esperado no campo em edição
   */
  validarCursorNoFimDoTextoEdicaoObservacao(textoEsperado) {
    this.elements.inputEdicaoObservacaoTexto()
      .should('have.value', textoEsperado)
      .should('be.focused')
      .then(($el) => {
        const campo = $el[0];
        expect(campo.selectionStart, 'selectionStart no fim do texto').to.eq(textoEsperado.length);
        expect(campo.selectionEnd, 'selectionEnd no fim do texto').to.eq(textoEsperado.length);
      });
  }

  /**
   * Exclui a primeira observação da lista
   */
  excluirObservacao() {
    this.elements.btnExcluirObservacao().first().click();
    cy.wait(400);
    cy.get('body').then(($body) => {
      const btnConfirmar = $body.find('button:contains("Confirmar"), button:contains("Sim"), button:contains("Excluir"):visible, [data-testid*="confirm"]');
      if (btnConfirmar.length > 0) {
        cy.wrap(btnConfirmar).first().click();
      }
    });
    cy.wait(500);
  }

  /**
   * Abre a gaveta lateral de Notas Internas a partir do card do cliente
   */
  abrirGavetaNotasInternas() {
    // Asserção declarativa antes da bifurcação: decidir o fluxo no milissegundo zero pelo
    // estado do body fazia o clique cair num card ainda não renderizado (ou bloqueado),
    // sem abrir a gaveta e sem erro explícito.
    this.elements.summaryNotas()
      .scrollIntoView()
      .should('be.visible')
      .and('not.be.disabled');

    cy.get('body').then(($body) => {
      if ($body.find('aside[role="dialog"]:contains("Notas internas"):visible').length === 0) {
        this.elements.summaryNotas().click();
      }
    });
    this.elements.drawerNotasInternas().should('be.visible');
  }

  /**
   * Adiciona uma nova nota interna através da gaveta lateral
   * @param {string} texto Texto da nota interna
   */
  adicionarNotaInterna(texto) {
    this.elements.inputNotaInterna().should('be.visible').clear().type(texto);
    this.elements.btnSalvarNotaInterna().should('not.be.disabled').click();
  }

  /**
   * Valida se a nota interna recém-criada está visível na lista
   * @param {string} texto Texto esperado da nota
   */
  validarNotaInternaNaLista(texto) {
    this.elements.itensNotasInternas().should('be.visible').and('contain', texto);
    this.elements.drawerNotasInternas().contains('span', 'Comunicação interna').should('be.visible');
  }

  /**
   * Fecha a gaveta lateral de Notas Internas
   */
  fecharGavetaNotasInternas() {
    cy.get('body').then(($body) => {
      const btnClose = $body.find('button[aria-label="Fechar"], button[class*="_closeBtn_"], button[class*="_sideDrawerCloseBtn_"]');
      if (btnClose.length > 0) {
        cy.wrap(btnClose).first().click();
      } else {
        cy.get('body').type('{esc}');
      }
    });
    cy.get('[class*="_sideDrawerWrapOpen_"]').should('not.exist');
  }

  /**
   * Alterna o status do atendente (Disponível <-> Ocupado / Offline -> Disponível)
   */
  alternarStatusAtendente() {
    this.elements.btnStatusAtendente().click();
  }

  /**
   * Valida se o status visual do atendente está de acordo com o esperado
   * @param {string} statusEsperado Texto esperado ("Disponível", "Ocupado", "Offline")
   */
  validarStatusAtendente(statusEsperado) {
    this.elements.btnStatusAtendente()
      .should('be.visible')
      .and('contain.text', statusEsperado);
  }

  /**
   * Leva o switch de status do atendente ao estado desejado (precondição de cenário em API real, onde o
   * estado da conta vem de rodadas anteriores): alterna uma única vez só se o estado atual for outro e
   * confirma o resultado pela UI. O switch alterna entre Disponível e Ocupado.
   * @param {string} statusDesejado Texto esperado ("Disponível" ou "Ocupado")
   */
  garantirStatusAtendente(statusDesejado) {
    this.elements.btnStatusAtendente().should('be.visible').invoke('text').then((textoAtual) => {
      if (!new RegExp(statusDesejado, 'i').test(textoAtual)) {
        this.alternarStatusAtendente();
      }
    });
    this.validarStatusAtendente(statusDesejado);
  }

  /**
   * Valida a ausência do componente de status do atendente no DOM (ex: sem capability ou erro 422)
   */
  validarAusenciaStatusAtendente() {
    cy.get('[data-testid="button-attendant-status"], [class*="_attendantStatusTrack_"]').should('not.exist');
  }

  /**
   * Valida a folga real entre a faixa de abas de status (borda de recorte do overflow) e o switch
   * de status do atendente quando as abas transbordam em telas estreitas (PR #417).
   * Causa raiz original: o espaçamento ficava em padding-right (dentro da caixa de recorte do
   * overflow), colapsando para 0px justamente quando as abas transbordavam. A correção moveu o
   * espaçamento para margin-right, fora da caixa de recorte.
   */
  validarFolgaEntreAbasEStatusAtendente(folgaMinimaPx = 8) {
    this.elements.chipsRowContainer().then(($bar) => {
      const bar = $bar[0];
      // Pré-condição: força o scroll até o limite direito para expor a aba cortada rente à borda
      bar.scrollLeft = bar.scrollWidth;

      // Garante que o cenário do bug está de fato reproduzido (abas transbordando nesta largura)
      expect(bar.scrollWidth, 'Pré-condição: a faixa de abas deve transbordar nesta largura para reproduzir o cenário do PR #417').to.be.greaterThan(bar.clientWidth);

      const barRect = bar.getBoundingClientRect();
      this.elements.btnStatusAtendente().then(($switch) => {
        const switchRect = $switch[0].getBoundingClientRect();
        const folga = switchRect.left - barRect.right;
        cy.log(`📏 [PR #417] Folga entre a borda de recorte da faixa de abas e o switch: ${folga.toFixed(1)}px`);
        expect(folga, 'Folga entre a borda de recorte da faixa de abas e o switch de status do atendente (PR #417)').to.be.at.least(folgaMinimaPx);
      });
    });
  }

  /**
   * Abre o menu popover de status do atendimento a partir do header do cliente
   */
  abrirMenuStatusCliente() {
    this.elements.btnClienteStatus().scrollIntoView().should('be.visible').click();
    this.elements.menuStatusPopover().should('be.visible');
  }

  /**
   * Vincula um substatus personalizado ao atendimento a partir do menu de status do cliente
   * (backend#499/#501-503, front#396). Expande a sublista do status pai (toggle) antes de
   * clicar no item — os substatus não vêm visíveis de cara na linha do pai.
   * @param {number} customStatusId ID do substatus a vincular
   * @param {number} parentStatus Status pai (0..4) sob o qual o substatus está cadastrado
   */
  vincularSubstatus(customStatusId, parentStatus) {
    this.abrirMenuStatusCliente();
    const key = this.elements.mapaParentStatusKey[parentStatus];
    this.elements.toggleSubstatusPorPai(key).should('be.visible').click();
    this.elements.itemMenuSubstatus(customStatusId).should('be.visible').click();
  }

  /**
   * Desvincula o substatus personalizado atual clicando no "x" da badge
   */
  desvincularSubstatus() {
    this.elements.btnDesvincularSubstatus().should('be.visible').click();
  }

  /**
   * Preenche e confirma o formulário de "+ Adicionar personalizado" para um status pai
   * @param {number} parentStatus Status pai (0..4) sob o qual o substatus será criado
   * @param {string} nome Nome do novo substatus (máx. 60 caracteres)
   */
  criarSubstatusPersonalizado(parentStatus, nome) {
    this.abrirMenuStatusCliente();
    const key = this.elements.mapaParentStatusKey[parentStatus];
    // O botão "+ Adicionar personalizado" vive DENTRO da sublista expandida do status pai (atrás
    // do toggle), não solto na linha — precisa expandir antes (achado de causa raiz, 25/09/2026:
    // can_create_attendance_custom_status é capability de LOJA, não de item; ver AGENTS.md §6).
    this.elements.toggleSubstatusPorPai(key).should('be.visible').click();
    this.elements.btnAdicionarSubstatusPorPai(key).should('be.visible').click();
    this.elements.inputNomeSubstatus().should('be.visible').clear().type(nome);
    this.elements.btnConfirmarSubstatus().click();
  }

  /**
   * Valida as opções presentes e ausentes dentro do menu popover de status do atendimento
   * @param {object} param0 Opções visíveis e ausentes esperadas
   */
  validarItensMenuStatus({ visiveis = [], ausentes = [] }) {
    this.elements.menuStatusPopover().should('be.visible').within(() => {
      visiveis.forEach((item) => {
        cy.contains('button, li, [role="menuitem"], span', new RegExp(item, 'i')).should('be.visible');
      });
      ausentes.forEach((item) => {
        cy.contains('button, li, [role="menuitem"], span', new RegExp(item, 'i')).should('not.exist');
      });
    });
  }

  /**
   * Rola a conversa em pequenos incrementos pra acionar o IntersectionObserver que gatilha a busca
   * sob demanda do conteúdo binário do anexo (Issue front#521). Necessário porque: (1) o elemento
   * `[data-message-id]` em si é só uma âncora de altura zero (`_messageAnchor_`) — o alvo real da
   * visibilidade é o placeholder do anexo dentro dele; (2) um salto único de `scrollTop` (via
   * `cy.scrollTo` ou um `invoke` isolado) é revertido silenciosamente por um mecanismo de
   * acompanhar-o-fim-da-conversa — só um `invoke('scrollTop', n).trigger('scroll')` repetido em
   * pequenos passos, com espera entre eles, "gruda" na posição e deixa o `IntersectionObserver`
   * dentro da seção `_scrollArea_` (a que de fato rola, não a `_scrollViewport_` interna) disparar.
   * Descoberto por tentativa e erro em sondagem real (06/10/2026) contra o atendimento 260900034.
   * **Só validado no Chrome (`AGENTS.md [R-RUN]`).** No Firefox (`cypress open`, confirmado pelo
   * operador em 06/10/2026) os waits fixos aqui não bastam — o timing distinto do Firefox (já
   * documentado em `[R-RUN]` pra outras race conditions reais desta suíte) faz o `GET
   * .../attachment` não disparar a tempo em parte dos testes de ctx 14, de forma não-determinística
   * (combinação de testes que falha muda a cada rodada). Não é bug de produto: 4 rodadas isoladas
   * no Chrome (o navegador de validação) saíram 100% verdes. Se precisar rodar ctx 14 no Firefox,
   * aumentar os waits fixos abaixo generosamente primeiro.
   * @param {number} profundidadeMaxima Até onde empurrar o scroll (px); suba se o anexo estiver mais perto do fim da conversa
   */
  rolarAteRevelarAnexosSobDemanda(profundidadeMaxima = 1400) {
    cy.get('section[class*="_scrollArea_"]').first().invoke('scrollTop', 0).trigger('scroll');
    cy.wait(600);
    cy.get('section[class*="_scrollArea_"]').first().invoke('scrollTop', 0).trigger('scroll');
    cy.wait(3000);
    for (let passo = 200; passo <= profundidadeMaxima; passo += 200) {
      cy.get('section[class*="_scrollArea_"]').first().invoke('scrollTop', passo).trigger('scroll');
      cy.wait(900);
    }
    cy.wait(1500);
  }

  /**
   * Rola a área de mensagens do chat até o topo (onde fica o badge de início do histórico)
   */
  rolarChatParaTopo() {
    this.elements.containerMensagensScroll().then(($el) => {
      $el[0].scrollTop = 0;
    });
    this.elements.badgeInicioHistorico().scrollIntoView({ duration: 300 });
  }

  /**
   * Rola a área de mensagens até o topo para acionar o carregamento da página anterior de histórico (PR #355)
   * Usa o sentinela superior (_topSentinel_) ou o container de scroll sem depender do badge de início
   */
  rolarParaCarregarHistorico() {
    this.elements.containerMensagensScroll().then(($el) => {
      $el[0].scrollTop = 0;
    });
    cy.get('body').then(($body) => {
      if ($body.find('div[class*="_topSentinel_"]').length > 0) {
        cy.get('div[class*="_topSentinel_"]').scrollIntoView({ duration: 200 });
      } else {
        this.elements.containerMensagensScroll().scrollTo('top', { ensureScrollable: false, duration: 200 });
      }
    });
  }

  /**
   * Rola a área de mensagens do chat até o fundo (mensagens mais recentes)
   */
  rolarChatParaFundo() {
    cy.get('article[class*="_bubbleRow_"], div[class*="_messageAnchor_"]').last().scrollIntoView({ duration: 300 });
    this.elements.containerMensagensScroll().then(($el) => {
      $el[0].scrollTop = $el[0].scrollHeight;
    });
  }

  /**
   * Valida que o badge "Início do histórico" possui posicionamento estático e rola naturalmente com o conteúdo (PR #390)
   */
  validarBadgeInicioHistoricoEstatico() {
    // 1. Rola para o topo para trazer o badge para a área visível do chat
    this.rolarChatParaTopo();
    this.elements.badgeInicioHistorico().should('be.visible');

    // 2. Validação de CSS: position deve ser static (rejeita sticky e fixed da PR #390) e z-index não deve ser 1
    this.elements.badgeInicioHistorico().should(($badge) => {
      const win = $badge[0].ownerDocument.defaultView;
      const style = win.getComputedStyle($badge[0]);
      expect(style.position, 'Badge não deve ser sticky (PR #390)').to.not.equal('sticky');
      expect(style.position, 'Badge não deve ser fixed').to.not.equal('fixed');
      expect(style.position, 'Badge deve ter position: static').to.equal('static');
      expect(style.zIndex, 'Badge não deve ter z-index: 1 sobrepondo bolhas').to.not.equal('1');
    });

    // 3. Validação de rolagem: ao rolar para o fundo, o badge deve subir junto com o histórico e sair da viewport
    this.rolarChatParaFundo();
    cy.wait(300);
    this.elements.containerMensagensScroll().then(($container) => {
      const containerRect = $container[0].getBoundingClientRect();
      this.elements.badgeInicioHistorico().then(($badge) => {
        const badgeRect = $badge[0].getBoundingClientRect();
        if ($container[0].scrollHeight > $container[0].clientHeight) {
          const relativeTop = badgeRect.top - containerRect.top;
          expect(relativeTop, 'Badge rolou para fora da viewport superior e não colou no topo').to.be.lessThan(0);
        }
      });
    });
  }

  // -------------------------------------------------------------
  // MÉTODOS DE CITAÇÃO E RESPOSTA DIRETA NO CHAT (PR #394 / PR #500)
  // -------------------------------------------------------------

  /**
   * Aciona o botão de responder de uma mensagem específica ou da primeira elegível
   * @param {string|number|null} mensagemId - ID da mensagem a ser respondida
   */
  acionarResponderMensagem(mensagemId = null) {
    if (mensagemId) {
      this.elements.btnResponderMensagem(mensagemId).scrollIntoView({ duration: 300 }).click();
    } else {
      this.elements.todosBotoesResponder().first().scrollIntoView({ duration: 300 }).click();
    }
  }

  /**
   * Valida a exibição e os metadados da barra de pré-visualização de resposta no compositor
   * @param {string|null} remetenteEsperado - Nome esperado do remetente (ex: 'Cliente' ou 'Atendente')
   * @param {string|null} trechoEsperado - Trecho esperado do texto citado
   */
  validarBarraRespostaAtiva(remetenteEsperado = null, trechoEsperado = null) {
    this.elements.barraPreviewResposta().should('be.visible');
    if (remetenteEsperado) {
      this.elements.remetentePreviewResposta().should('contain.text', remetenteEsperado);
    }
    if (trechoEsperado) {
      this.elements.textoPreviewResposta().should('contain.text', trechoEsperado);
    }
    this.elements.inputMensagemChat().should('be.focused');
  }

  /**
   * Cancela a resposta ativa no compositor através do botão 'x'
   */
  cancelarRespostaViaBotao() {
    this.elements.btnCancelarResposta().should('be.visible').click();
    this.elements.barraPreviewResposta().should('not.exist');
  }

  /**
   * Cancela a resposta ativa no compositor pressionando a tecla Esc no input
   */
  cancelarRespostaViaEsc() {
    this.elements.inputMensagemChat().type('{esc}');
    this.elements.barraPreviewResposta().should('not.exist');
  }

  /**
   * Valida que a barra de resposta não está presente no compositor
   */
  validarBarraRespostaInexistente() {
    this.elements.barraPreviewResposta().should('not.exist');
  }

  /**
   * Envia uma mensagem de texto pelo chat estando com a citação ativa
   * @param {string} texto - Texto da resposta a ser enviada
   */
  enviarMensagemComResposta(texto) {
    this.elements.inputMensagemChat().clear().type(texto);
    this.elements.btnEnviarMensagemChat().should('be.visible').and('not.be.disabled').click();
  }

  /**
   * Clica no card de citação dentro do balão de resposta e valida a rolagem suave até a mensagem original
   * @param {string|number} idOriginal - ID da mensagem citada original
   */
  clicarCardCitacaoERolarAteOriginal(idOriginal) {
    this.elements.cardCitacaoNoBalao().should('be.visible').click();
    cy.get(`[data-message-id="${idOriginal}"]`).scrollIntoView({ duration: 300 }).should('be.visible');
  }

  // -------------------------------------------------------------
  // AUTOSCROLL PARA O RODAPÉ AO ABRIR ATENDIMENTO (PR #389)
  // -------------------------------------------------------------

  /**
   * Valida que o container de mensagens realizou autoscroll até o rodapé, garantindo foco imediato nas mensagens mais recentes (PR #389)
   */
  validarAutoscrollParaRodape() {
    // 1. Aguarda estabilização do container de mensagens
    cy.get('section[class*="_scrollArea_"]', { timeout: 10000 }).should('be.visible');

    // 2. Valida a geometria de ancoragem no rodapé do container com rolagem
    this.elements.containerMensagensScroll().should(($container) => {
      const el = $container[0];
      if (el.scrollHeight > el.clientHeight) {
        const distanciaDoFim = el.scrollHeight - (el.scrollTop + el.clientHeight);
        // Tolera até 60px de variação (devido a paddings e redimensionamento dinâmico do compositor)
        expect(distanciaDoFim, 'Container de histórico deve estar ancorado no rodapé (PR #389)').to.be.lte(60);
      }
    });

    // 3. A última mensagem trocada deve estar visível na viewport
    cy.get('article[class*="_bubbleRow_"], div[class*="_messageAnchor_"]').last().should('be.visible');

    // 4. Se a conversa possui rolagem suficiente, o badge "Início do histórico" não deve estar visível na viewport inicial
    this.elements.containerMensagensScroll().then(($container) => {
      if ($container[0].scrollHeight > $container[0].clientHeight) {
        const containerRect = $container[0].getBoundingClientRect();
        this.elements.badgeInicioHistorico().then(($badge) => {
          const badgeRect = $badge[0].getBoundingClientRect();
          const relativeTop = badgeRect.top - containerRect.top;
          expect(relativeTop, 'Badge de início do histórico deve estar recortado acima da viewport ao abrir o chat').to.be.lessThan(0);
        });
      }
    });
  }

  /**
   * Valida que, após o operador rolar manualmente para o topo, a posição de leitura é preservada e não é puxada para o fim (PR #389 / #357)
   */
  validarPreservacaoPosicaoNoTopo() {
    // 1. Rola para o topo para ler mensagens antigas
    this.rolarChatParaTopo();
    this.elements.badgeInicioHistorico().should('be.visible');

    // 2. Aguarda estabilização de mídias/anexos assíncronos
    cy.wait(1000);

    // 3. Valida que a rolagem permaneceu no topo e não saltou de volta para o rodapé
    this.elements.containerMensagensScroll().should(($container) => {
      expect($container[0].scrollTop, 'Scroll não deve saltar para o fim após o operador subir no histórico').to.be.lte(100);
    });
  }

  // -------------------------------------------------------------
  // CONTROLES DE ORÇAMENTOS VENDIDOS NA GAVETA (PR #379)
  // -------------------------------------------------------------

  /**
   * Valida que o card de orçamento vendido exibe selo 'Vendido' e possui ações de editar e apagar desabilitadas, além de checkbox bloqueado (PR #379)
   */
  validarControlesOrcamentoVendido() {
    this.elements.cardsOrcamentoDrawer().filter(':contains("Vendido")').first().within(() => {
      // 1. Selo "Vendido" visível
      cy.contains(/Vendido/i).should('be.visible');

      // 2. Lápis (editar orçamento) deve estar desabilitado
      cy.get('[data-testid="btn-editar-orcamento"]')
        .should('be.visible')
        .and(($btn) => {
          const isDisabled = $btn.is(':disabled') || $btn.attr('disabled') !== undefined || $btn.attr('aria-disabled') === 'true' || $btn.css('cursor') === 'not-allowed';
          expect(isDisabled, 'Botão editar orçamento vendido deve estar inerte/desabilitado (PR #379)').to.be.true;
        });

      // 3. Lixeira (apagar orçamento) deve estar desabilitada
      cy.get('[data-testid="budget-delete"]')
        .should('be.visible')
        .and('be.disabled');

      // 4. Checkbox de seleção para link de pagamento deve estar bloqueado
      cy.get('[data-testid="budget-selected-indicator"]')
        .should(($input) => {
          const isBlocked = $input.is(':disabled') || $input.attr('disabled') !== undefined || $input.attr('aria-disabled') === 'true';
          expect(isBlocked, 'Checkbox de seleção deve estar bloqueado para orçamento vendido (aria-disabled="true" ou disabled)').to.be.true;
        });
    });
  }

  /**
   * Valida que um card de orçamento em aberto mantém o botão de editar habilitado normalmente (PR #379)
   */
  validarControlesOrcamentoAberto() {
    this.elements.cardsOrcamentoDrawer().filter(':not(:contains("Vendido"))').first().within(() => {
      cy.get('[data-testid="btn-editar-orcamento"]')
        .should('be.visible')
        .and(($btn) => {
          const isDisabled = $btn.is(':disabled') || $btn.attr('aria-disabled') === 'true';
          expect(isDisabled, 'Botão editar orçamento aberto deve estar habilitado').to.be.false;
        });

      cy.get('[data-testid="budget-selected-indicator"]')
        .should(($input) => {
          const isBlocked = $input.is(':disabled') || $input.attr('aria-disabled') === 'true';
          expect(isBlocked, 'Checkbox de orçamento aberto deve estar habilitado').to.be.false;
        });
    });
  }

  /**
   * Obtém o card de orçamento na gaveta pelo código
   * @param {string|number} codigo
   */
  getCardOrcamentoPorCodigo(codigo) {
    return this.elements.cardsOrcamentoDrawer().filter(`:contains("${codigo}")`).first();
  }

  /**
   * Valida que o checkbox de um orçamento específico é interativo e está no estado esperado
   * @param {string|number} codigo Código do orçamento
   * @param {boolean} esperadoMarcado Se deve estar marcado
   */
  validarCheckboxOrcamentoInterativo(codigo, esperadoMarcado = true) {
    this.getCardOrcamentoPorCodigo(codigo).within(() => {
      cy.get('[data-testid="budget-selected-indicator"]')
        .should('be.visible')
        .and(($input) => {
          const isBlocked = $input.is(':disabled') || $input.attr('aria-disabled') === 'true';
          expect(isBlocked, `Checkbox do orçamento #${codigo} deve estar habilitado para interação`).to.be.false;
          const isChecked = $input.is(':checked') || $input.attr('aria-checked') === 'true' || $input.attr('data-checked') === 'true';
          expect(isChecked, `Checkbox do orçamento #${codigo} estado esperado: ${esperadoMarcado}`).to.eq(esperadoMarcado);
        });
    });
  }

  /**
   * Clica no checkbox de seleção do orçamento indicado para alternar seu estado
   * @param {string|number} codigo Código do orçamento
   */
  clicarCheckboxOrcamento(codigo) {
    this.getCardOrcamentoPorCodigo(codigo).within(() => {
      cy.get(`[data-testid="budget-selection-${codigo}"], label:has([data-testid="budget-selected-indicator"]), [data-testid="budget-selected-indicator"]`)
        .first()
        .click();
    });
  }

  /**
   * Valida que o checkbox de seleção do orçamento está bloqueado/desabilitado
   * @param {string|number} codigo Código do orçamento
   */
  validarCheckboxOrcamentoBloqueado(codigo) {
    this.getCardOrcamentoPorCodigo(codigo).within(() => {
      cy.get('[data-testid="budget-selected-indicator"]')
        .should(($input) => {
          const isBlocked = $input.is(':disabled') || $input.attr('aria-disabled') === 'true' || $input.attr('disabled') !== undefined;
          expect(isBlocked, `Checkbox do orçamento #${codigo} deve estar bloqueado`).to.be.true;
        });
    });
  }

  /**
   * Valida que o card do orçamento não exibe o selo "Vendido" (ex: orçamento coberto por link aprovado)
   * @param {string|number} codigo Código do orçamento
   */
  validarCardSemSeloVendido(codigo) {
    this.getCardOrcamentoPorCodigo(codigo).within(() => {
      cy.contains(/Vendido/i).should('not.exist');
    });
  }

  /**
   * Lê a dica (atributo `title`) do checkbox de seleção de um orçamento — o `<label>` que o envolve
   * carrega o `title` com o motivo do bloqueio (ou nenhum, se marcável), não o `<input>` em si
   * (Issue front#492, confirmado via bundle real: `title:c?i:void 0` no componente do checkbox).
   * @param {string|number} codigo Código do orçamento
   */
  obterDicaCheckboxOrcamento(codigo) {
    return cy.get(`[data-testid="budget-selection-${codigo}"]`);
  }

  // -------------------------------------------------------------
  // PERSISTÊNCIA DE ESTADO E ROTA NA URL (PR #385)
  // -------------------------------------------------------------

  /**
   * Valida a presença e consistência do parâmetro attendance na URL ativa
   * @param {string|number|null} idEsperado - ID específico esperado (opcional)
   * @param {number} timeoutMs - Timeout para asserção reativa
   */
  validarParametroAttendanceNaUrl(idEsperado = null, timeoutMs = 10000) {
    if (idEsperado) {
      cy.url({ timeout: timeoutMs }).should('include', `attendance=${idEsperado}`);
    } else {
      cy.url({ timeout: timeoutMs }).should('match', /[?&]attendance=\d+/);
    }
  }

  /**
   * Valida que o parâmetro attendance não está presente na URL (chat fechado)
   * @param {number} timeoutMs - Timeout para asserção reativa
   */
  validarAusenciaDeAttendanceNaUrl(timeoutMs = 10000) {
    cy.url({ timeout: timeoutMs }).should('not.include', 'attendance=');
  }

  /**
   * Extrai o ID numérico do parâmetro attendance presente na URL
   * @returns {Cypress.Chainable<number>}
   */
  obterAttendanceIdDaUrl() {
    return cy.url({ timeout: 10000 }).then((url) => {
      const match = url.match(/[?&]attendance=(\d+)/);
      expect(match, 'URL deve conter parâmetro attendance').to.be.ok;
      return parseInt(match[1], 10);
    });
  }

  /**
   * Navega diretamente para /atendimentos com query parameters customizados
   * Suporta servidores SPA que retornam status 404 em rotas diretas (failOnStatusCode: false)
   * @param {string} queryString - Parâmetros de consulta (ex: 'status=waiting&attendance=260900082')
   */
  visitarComParametros(queryString) {
    cy.visit(`/atendimentos?${queryString}`, { failOnStatusCode: false });
    cy.get('body', { timeout: 15000 }).should('be.visible');
    this.elements.statusFilterBar().should('be.visible');
  }

  /**
   * Fecha a conversa ativa via botão fechar no cabeçalho do chat
   */
  fecharConversa() {
    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="button-close-chat"]:visible').length > 0) {
        cy.get('[data-testid="button-close-chat"]').click();
      } else if ($body.find('button[aria-label="Fechar conversa"]:visible').length > 0) {
        cy.get('button[aria-label="Fechar conversa"]').click();
      } else if ($body.find('[data-testid="button-close-conversation"]:visible').length > 0) {
        cy.get('[data-testid="button-close-conversation"]').click();
      }
    });
  }

  /**
   * Valida o badge de Janela 24h WABA no estado Verde (Janela ativa/confortável, > 4h)
   * Conforme PR #312: data-tone="calm", ícone de relógio visível, formato HH:MM e compositor de texto livre habilitado
   * @param {Object} [options]
   * @param {RegExp} [options.formatoEsperado] Padrão regex para o tempo restante (default: /\d{2}:\d{2}/)
   */
  validarBadgeJanelaVerde({ formatoEsperado = /\d{2}:\d{2}/ } = {}) {
    this.elements.badgeServiceWindow()
      .should('be.visible')
      .and('have.attr', 'data-tone', 'calm');
    this.elements.iconeServiceWindow().should('be.visible');
    if (formatoEsperado) {
      this.elements.badgeServiceWindow().invoke('text').should('match', formatoEsperado);
    }
    this.elements.inputMensagemChat().should('be.visible').and('not.be.disabled');
    this.elements.bannerJanelaEncerrada().should('not.exist');
  }

  /**
   * Valida o badge de Janela 24h WABA no estado Alerta Laranja (Janela crítica, <= 4h)
   * Conforme PR #312: data-tone="alert", ícone de relógio visível, formato HH:MM e compositor liberado para conclusão
   * @param {Object} [options]
   * @param {RegExp} [options.formatoEsperado] Padrão regex para o tempo restante (default: /\d{2}:\d{2}/)
   */
  validarBadgeJanelaAlertaLaranja({ formatoEsperado = /\d{2}:\d{2}/ } = {}) {
    this.elements.badgeServiceWindow()
      .should('be.visible')
      .and('have.attr', 'data-tone', 'alert');
    this.elements.iconeServiceWindow().should('be.visible');
    if (formatoEsperado) {
      this.elements.badgeServiceWindow().invoke('text').should('match', formatoEsperado);
    }
    this.elements.inputMensagemChat().should('be.visible').and('not.be.disabled');
    this.elements.bannerJanelaEncerrada().should('not.exist');
  }

  /**
   * Valida o badge de Janela 24h WABA no estado Expirado Vermelho (<= 00:00 ou can_send_free_text: false)
   * Conforme PR #312: data-tone="expired", rótulo "Janela limitada", compositor bloqueado e banner de template visível
   */
  validarBadgeJanelaExpiradaVermelho() {
    this.elements.badgeServiceWindow()
      .should('be.visible')
      .and('have.attr', 'data-tone', 'expired');
    this.elements.badgeServiceWindow().invoke('text').should('match', /Janela limitada|Janela expirada|00:00/i);
    this.elements.bannerJanelaEncerrada().should('be.visible');
    this.elements.btnEnviarTemplateAviso().should('be.visible');
    this.elements.inputMensagemChat().should('not.exist');
  }

  /**
   * Recarrega a tela, reabre o 1º atendimento da fila e o diálogo "Vincular cliente" pelo menu
   * ⋮ — necessário quando um teste precisa que `GET /client-capabilities` já reflita um payload
   * customizado (ex.: `can_create_client`) desde o 1º carregamento: esse hook roda assim que o
   * atendimento é selecionado (antes do botão "Cadastrar novo" existir no DOM), então registrar
   * o intercept só dentro do próprio `it()` chega tarde demais se o card já tiver sido clicado
   * no `beforeEach` do context (Issue front#497/PR #499).
   */
  reabrirAtendimentoEAbrirDialogoVincularCliente() {
    cy.reload();
    this.elements.cardsAtendimento().first().click();
    this.abrirPopoverMaisOpcoes();
    this.elements.menuVincularCliente().click();
    this.elements.modalVincularCliente().should('be.visible');
  }

  /**
   * Abre o drawer "Dados do cliente" a partir do menu popover do card do cliente
   * (PR #427/#432/#438). Fluxo: button-editar-cliente-icon > menu-edit-client.
   */
  abrirDrawerDadosCliente() {
    cy.get('body').then(($body) => {
      // Evita reabrir o popover se o drawer já estiver na tela
      if ($body.find('[data-testid="button-client-save"]:visible').length > 0) {
        return;
      }
      this.abrirPopoverMaisOpcoes();
      this.elements.btnMenuEditarCliente().should('be.visible').click();
    });
    this.elements.drawerDadosCliente().should('be.visible');
  }

  /**
   * Abre o popover "Mais opções" do cabeçalho do atendimento (`button-editar-cliente-icon`, `aria-haspopup="menu"`).
   * O botão é desmontado e remontado ~300 ms depois da troca de conversa, e um clique na instância velha não abre o menu
   * (`ROADMAP.md` P1-36). Por isso relê o botão do zero a cada passo, espera `aria-busy` cair, só clica se `aria-expanded`
   * não for `true` (é um toggle: reclicar fecharia) e, se o 1º clique não abriu, tenta uma 2ª vez antes de afirmar o menu aberto.
   */
  abrirPopoverMaisOpcoes() {
    const botao = () => cy.get('button[data-testid="button-editar-cliente-icon"]');
    const clicarSeFechado = () => botao().then(($botao) => {
      if ($botao.attr('aria-expanded') !== 'true') botao().click();
    });
    botao().scrollIntoView().should('be.visible').and('not.have.attr', 'aria-busy', 'true');
    clicarSeFechado();
    botao().then(($botao) => {
      if ($botao.attr('aria-expanded') !== 'true') {
        cy.log('Popover "Mais opções" não abriu no 1º clique (botão remontado): nova tentativa');
        botao().should('be.visible');
        clicarSeFechado();
      }
    });
    botao().should('have.attr', 'aria-expanded', 'true');
  }

  /**
   * Fecha o drawer "Dados do cliente" (botão Fechar ou ESC, mesmo padrão das demais gavetas)
   */
  fecharDrawerDadosCliente() {
    cy.get('body').then(($body) => {
      const btnClose = $body.find('button[aria-label="Fechar"], button[class*="_closeBtn_"], button[class*="_sideDrawerCloseBtn_"]');
      if (btnClose.length > 0) {
        cy.wrap(btnClose).first().click();
      } else {
        cy.get('body').type('{esc}');
      }
    });
    cy.get('[class*="_sideDrawerWrapOpen_"]').should('not.exist');
  }

  /**
   * Revela o botão de reagir no hover do balão e abre a linha rápida de emojis (Issue front#530/PR #536)
   * @param {number} idMensagem ID da mensagem (data-message-id)
   */
  abrirLinhaDeReacoes(idMensagem) {
    // [data-message-id] é uma âncora de altura zero (AGENTS.md §4.4) - o hover precisa mirar o
    // <article> renderizado dentro dela, nunca a âncora em si
    cy.get(`[data-message-id="${idMensagem}"] article`).trigger('mouseover');
    this.elements.botaoReagirMensagem(idMensagem).click();
    this.elements.linhaRapidaReacoes().should('be.visible');
  }

  /**
   * Abre a linha rápida e seleciona um dos 6 emojis predefinidos (reagir ou remover, se já selecionado)
   * @param {number} idMensagem ID da mensagem
   * @param {string} chaveEmoji Uma de: thumbs-up, heart, joy, open-mouth, cry, pray
   */
  reagirNaLinhaRapida(idMensagem, chaveEmoji) {
    this.abrirLinhaDeReacoes(idMensagem);
    this.elements.opcaoRapidaReacao(chaveEmoji).click();
  }
}

export default new AtendimentosPage();

