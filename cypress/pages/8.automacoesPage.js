// cypress/pages/8.automacoesPage.js
// Page Object da tela de Automações (/automacoes, /automacoes/nova, /automacoes/:id, /automacoes/:id/execucoes) — Issue front#605 (PR #604).
// Testids medidos no código do front (`developer`, features/automations) e conferidos na UI real da dev em 2026-11-05.
// Os testids de passo e de "+" usam o caminho de posição (`root-0`, `root-1-yes-0`), estável entre recargas; inserir um passo antes de
// outro desloca os índices seguintes.

class AutomacoesPage {
  elements = {
    // --- Menu lateral e cabeçalho do app ---
    itemMenu: () => cy.get('[data-testid="sidebar-item-automacoes"]'),
    botaoVoltar: () => cy.get('[data-testid="button-page-back"]'),
    tituloPagina: () => cy.get('[data-testid="page-title"]'),
    avisoRecursoNaoContratado: () => cy.get('[data-testid="notice-resource-not-contracted"]'),

    // --- Toasts (componente compartilhado; um por vez, some em ~5 s) ---
    toast: (tom, opcoes = {}) => cy.get(`[data-testid="toast-${tom}"]`, opcoes),

    // --- Listagem ---
    paginaLista: () => cy.get('[data-testid="automations-page"]'),
    botaoNova: () => cy.get('[data-testid="button-new-automation"]'),
    tileNova: () => cy.get('[data-testid="button-automation-new-tile"]'), // ladrilho 'Criar automação' no fim da grade (some sem can_create)
    estadoLista: (estado) => cy.get(`[data-testid="automations-${estado}"]`), // loading | forbidden | unavailable | error | empty ...
    botaoTentarNovamente: () => cy.get('[data-testid="automations-retry"]'),
    filtroLista: (filtro) => cy.get(`[data-testid="automations-filter-${filtro}"]`), // all | active | paused
    inputBuscaLista: () => cy.get('[data-testid="input-automations-search"]'),
    grade: () => cy.get('[data-testid="automations-grid"]'),
    cartao: (id) => cy.get(`[data-testid="automation-card-${id}"]`),
    cartaoAbrir: (id) => cy.get(`[data-testid="automation-card-open-${id}"]`),
    cartaoSwitch: (id) => cy.get(`[data-testid="automation-card-toggle-${id}"]`),
    cartaoExecucoes: (id) => cy.get(`[data-testid="automation-card-logs-${id}"]`),
    cartaoEditar: (id) => cy.get(`[data-testid="automation-card-edit-${id}"]`),
    cartaoMenu: (id) => cy.get(`[data-testid="automation-card-menu-${id}"]`),
    cartaoDuplicar: (id) => cy.get(`[data-testid="automation-card-duplicate-${id}"]`),
    cartaoExcluir: (id) => cy.get(`[data-testid="automation-card-delete-${id}"]`),
    cartoes: () => cy.get('article[data-testid^="automation-card-"]'),
    cartaoSeloPadrao: (id) => cy.get(`[data-testid="automation-card-default-${id}"]`), // selo "Padrão" da automação is_default (front PR #679, no lugar da galeria de modelos)

    // --- Diálogos de confirmação (portal no body; `-confirm`, `-cancel` e `-close` em cada um) ---
    dialogo: (base) => cy.get(`[data-testid="${base}"]`), // automation-delete-confirm | automation-conflict | automation-leave-confirm
    dialogoConfirmar: (base) => cy.get(`[data-testid="${base}-confirm"]`),
    dialogoCancelar: (base) => cy.get(`[data-testid="${base}-cancel"]`),

    // --- Construtor: cabeçalho ---
    construtor: () => cy.get('[data-testid="automation-builder"]'),
    inputNome: () => cy.get('[data-testid="input-automation-name"]'),
    // Guarda de saída do construtor (medida em 2026-11-06): o menu lateral abre o diálogo próprio; o voltar do navegador, o global `navigation-unsaved-dialog`
    dialogoSairSemSalvarConstrutor: () => cy.get('[data-testid="automation-leave-confirm"]'),
    btnContinuarEditandoConstrutor: () => cy.get('[data-testid="automation-leave-confirm-cancel"]'),
    btnSairConstrutor: () => cy.get('[data-testid="automation-leave-confirm-confirm"]'),
    dialogoSairSemSalvarNavegador: () => cy.get('[data-testid="navigation-unsaved-dialog"]'),
    btnContinuarEditandoNavegador: () => cy.get('[data-testid="navigation-unsaved-dialog-cancel"]'),
    btnSairNavegador: () => cy.get('[data-testid="navigation-unsaved-dialog-confirm"]'),
    sidebarItemCentral: () => cy.get('[data-testid="sidebar-item-central"]').first(),
    inputDescricao: () => cy.get('[data-testid="input-automation-description"]'),
    seloEstado: () => cy.get('[data-testid="automation-status"]'), // data-status: draft | active | paused
    switchAtiva: () => cy.get('[data-testid="automation-builder-active"]'),
    botaoSalvar: () => cy.get('[data-testid="button-save-automation"]'),
    botaoExecucoes: () => cy.get('[data-testid="button-automation-logs"]'),
    botaoMaisAcoes: () => cy.get('[data-testid="button-automation-more"]'),
    botaoExcluirConstrutor: () => cy.get('[data-testid="button-automation-delete"]'),
    estadoConstrutor: (estado) => cy.get(`[data-testid="automation-builder-${estado}"]`), // loading | forbidden | notFound | error ...

    // --- Construtor: gatilho ---
    selectGatilho: () => cy.get('[data-testid="automation-trigger-type"]'),
    // Cabeçalho do cartão do gatilho: mostra o selo "1×/Nh" quando o limite por cliente é válido e maior que 0 (TriggerCard, sem testid no selo)
    cabecalhoGatilho: () => cy.get('section[aria-labelledby="automation-trigger-title"] > header'),
    inputPalavras: () => cy.get('[data-testid="automation-trigger-keywords"]'),
    inputHorarioAgendado: () => cy.get('[data-testid="automation-trigger-schedule"]'), // gatilho time_based (front PR #678): <input type="time">
    botaoDiaAgendado: (dia) => cy.get(`[data-testid="automation-trigger-window-day-${dia}"]`), // 0 (domingo) a 6
    selectFusoAgendado: () => cy.get('[data-testid="automation-trigger-window-timezone"]'),
    inputCooldown: () => cy.get('[data-testid="input-automation-reply-cooldown"]'),
    botaoCanal: (id) => cy.get(`[data-testid="button-automation-channel-${id}"]`),
    botaoTodosCanais: () => cy.get('[data-testid="button-automation-channel-all"]'),
    // Pílulas dos canais da loja, sem a "Todos os canais" (aria-pressed marca a escolhida)
    botoesCanais: () => cy.get('[data-testid^="button-automation-channel-"]').not('[data-testid="button-automation-channel-all"]'),

    // --- Construtor: lista de passos ---
    // `lista` = `root` ou o caminho de um ramo (`root-0-yes`); `n` = posição de inserção (0 = no início).
    botaoAdicionarPasso: (lista, n) => cy.get(`[data-testid="automation-add-step-${lista}-${n}"]`),
    botoesAdicionarPasso: () => cy.get('[data-testid^="automation-add-step-"]'), // todos os '+' da árvore (somem no construtor só-leitura)
    itemMenuPasso: (lista, n, tipo) => cy.get(`[data-testid="automation-add-step-${lista}-${n}-${tipo}"]`), // tipo em kebab: send-message, condition...
    itensMenuPasso: () => cy.get('[role="menuitem"][data-testid^="automation-add-step-"]'),
    cabecalhoPasso: (pathId) => cy.get(`[data-testid="automation-step-${pathId}-toggle"]`),
    avisosPasso: (pathId) => cy.get(`[data-testid="automation-step-${pathId}-warnings"]`),
    passoSubir: (pathId) => cy.get(`[data-testid="automation-step-${pathId}-move-up"]`),
    passoDescer: (pathId) => cy.get(`[data-testid="automation-step-${pathId}-move-down"]`),
    passoExcluir: (pathId) => cy.get(`[data-testid="automation-step-${pathId}-delete"]`),
    campoPasso: (pathId, campo) => cy.get(`[data-testid="automation-step-${pathId}-${campo}"]`), // text, condition-subject, condition-value, close-status...
    // Dica ligada ao campo do passo pelo `aria-describedby` (ex.: o corpo do webhook explica o envelope e o `null`, front#672, medido em 2026-11-06)
    dicaDoCampoPasso: (pathId, campo) => cy.get(`[data-testid="automation-step-${pathId}-${campo}"]`)
      .invoke('attr', 'aria-describedby')
      .then((ids) => cy.get(`[id="${String(ids).split(' ')[0]}"]`)),
    ramo: (lado) => cy.get(`[data-branch="${lado}"]`), // yes | no
    pendencia: (pathId, codigo) => cy.get(`[data-testid="automation-issue-${pathId}-${codigo}"]`), // codigo em kebab: text-required
    // O painel de pendências é uma <section> sem testid: o <h2> diz "Pendências para ativar (N)" (só erros) e só aparece depois da 1ª tentativa de Salvar.
    tituloPainelPendencias: () => cy.contains('h2', 'Pendências para ativar'),

    // --- Histórico de execuções ---
    paginaExecucoes: () => cy.get('[data-testid="automation-logs-page"]'),
    estadoExecucoes: (estado) => cy.get(`[data-testid="automation-logs-${estado}"]`), // loading | empty | error | notFound ...
    tabelaExecucoes: () => cy.get('[data-testid="automation-logs-table"]'),
    filtroExecucoes: (filtro) => cy.get(`[data-testid="automation-logs-filter-${filtro}"]`), // all | success | waiting | problem
    // Linha do run: botão com o selo da situação (`data-tone`), "Atendimento <id>", gatilho, nº de passos e início (medido na dev em 2026-11-06, backend#741)
    linhaExecucao: (logId) => cy.get(`[data-testid="automation-log-row-${logId}"]`),
    botaoExecucao: (logId) => cy.get(`[data-testid="automation-log-${logId}"]`), // aria-expanded, aria-controls = automation-log-detail-<id>
    // Detalhe aberto: um <li data-status="success|failed"> por passo, com "passo N", o tipo e o motivo da falha
    passosExecucao: (logId) => cy.get(`#automation-log-detail-${logId} li[data-status]`),
    // Paginação do histórico (backend#743, medido na dev em 2026-11-06): 20 linhas por página; "Carregar mais" pede a página seguinte e some quando `has_next` é false
    linhasExecucao: () => cy.get('[data-testid^="automation-log-row-"]'),
    botaoCarregarMais: () => cy.get('[data-testid="automation-logs-load-more"]'),
  };

  /**
   * Abre a tela de Automações pelo item "Automações" da barra lateral (a rota direta `/automacoes` responde 404 do servidor web da dev
   * antes de a SPA carregar, então a navegação é sempre pelo menu). Mesmo padrão de ClientesPage.visitar().
   */
  visitar() {
    cy.get('body', { timeout: 10000 }).should('be.visible');
    cy.url().then((urlAtual) => {
      if (/\/automacoes(\?|$)/.test(urlAtual)) return;
      if (urlAtual.includes('/login')) {
        cy.login();
        cy.url().should('not.include', '/login');
      }
      this.elements.itemMenu().click();
      cy.url().should('match', /\/automacoes(\?|$)/);
    });
    this.elements.paginaLista().should('be.visible');
  }

  /** Abre o construtor vazio pelo botão "Criar automação" da lista (precisa de `can_create`). */
  abrirNova() {
    this.elements.botaoNova().click();
    cy.url().should('include', '/automacoes/nova');
    this.elements.construtor().should('be.visible');
  }

  /** Abre o construtor de uma automação existente pelo botão "Editar" do cartão. */
  abrirEdicao(id) {
    this.elements.cartaoEditar(id).click();
    cy.url().should('match', new RegExp(`/automacoes/${id}$`));
    this.elements.construtor().should('be.visible');
  }

  /** Digita no campo de busca da lista (local, sem debounce) e espera o cartão-alvo ou o vazio. */
  buscar(termo) {
    this.elements.inputBuscaLista().clear().type(termo);
  }

  /** Adiciona um passo na lista (`root` ou ramo) na posição `n`: abre o "+" e escolhe o tipo (kebab: `send-message`, `condition`...). O passo novo nasce aberto. */
  adicionarPasso(lista, n, tipo) {
    this.elements.botaoAdicionarPasso(lista, n).click();
    this.elements.itemMenuPasso(lista, n, tipo).click();
  }

  /** Abre o cartão de um passo se ele estiver fechado (só um fica aberto por vez; os campos só existem no DOM com o passo aberto). */
  abrirPasso(pathId) {
    this.elements.cabecalhoPasso(pathId).then(($cab) => {
      if ($cab.attr('aria-expanded') !== 'true') cy.wrap($cab).click();
    });
    this.elements.cabecalhoPasso(pathId).should('have.attr', 'aria-expanded', 'true');
  }

  /** Escolhe o gatilho pelo valor da <option> (`keyword_match`, `new_client_created`...). Trocar de gatilho zera o `trigger_config`. */
  escolherGatilho(tipo) {
    this.elements.selectGatilho().select(tipo);
  }

  /** Escreve o texto de um passo `send_message` (abre o passo antes). */
  escreverTextoDoPasso(pathId, texto) {
    this.abrirPasso(pathId);
    this.elements.campoPasso(pathId, 'text').clear().type(texto, { delay: 0 });
  }

  /**
   * Preenche o passo Enviar webhook (`webhook-url` e `webhook-body`, medidos na dev em 2026-11-06, backend#745/front#672). As chaves `{{...}}` são texto literal,
   * não sequência especial do `cy.type`. Corpo vazio limpa o campo (o motor manda o envelope).
   */
  preencherWebhook(pathId, url, corpo = '') {
    this.elements.campoPasso(pathId, 'webhook-url').clear().type(url, { delay: 0, parseSpecialCharSequences: false });
    this.elements.campoPasso(pathId, 'webhook-body').clear();
    if (corpo) this.elements.campoPasso(pathId, 'webhook-body').type(corpo, { delay: 0, parseSpecialCharSequences: false });
  }
}

export default new AutomacoesPage();
