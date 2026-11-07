// cypress/e2e/8.automacoes.cy.js
// Automações (/automacoes): listagem, cadastro, construtor de passos, validação de ativação e edição concorrente — Issue front#605 (PR #604).
import AutomacoesPage from '../pages/8.automacoesPage';
import AutomacoesMocks from '../mocks/8.automacoesMocks';
import RecursosMocks from '../mocks/1.recursosMocks';
import api from '../services/backendApiService';

describe('8. Automações - Testes de Interface e Comportamento', () => {

  // Massa temporária própria da rodada ([R-ATEMPORAL]): nenhum teste depende de automação fixa da dev (as `[Teste]` do QA, as de modelo).
  // O token único entra no nome e na palavra-chave: a palavra nunca casa com mensagem real (o motor do backend confere eventos a cada 30 s na dev).
  const TOKEN = Date.now().toString(36);
  const PALAVRA = `zz${TOKEN}`;
  const nome = (sufixo) => `[Cypress] Automação ${TOKEN} ${sufixo}`;

  const corpoAutomacao = (sufixo, sobrescrever = {}) => ({
    name: nome(sufixo),
    description: 'Massa temporária da suíte 8.automacoes',
    trigger_type: 'keyword_match',
    trigger_config: { keywords: [PALAVRA], match_type: 'contains', case_sensitive: false },
    is_active: false,
    all_channels: true,
    channel_ids: [],
    steps: [{ step_type: 'send_message', step_config: { text: 'Olá!' } }],
    ...sobrescrever
  });

  // Cria a automação temporária pela API e devolve o detalhe (`id`, `name`, `updated_at`...).
  const criarTemporaria = (sufixo, sobrescrever = {}) =>
    cy.then(() => api.criarAutomacao(corpoAutomacao(sufixo, sobrescrever))).then((res) => {
      expect(res.status, `criar a automação temporária "${sufixo}"`).to.eq(201);
      return res.body.automation;
    });

  // Apaga tudo que esta rodada criou (pela tela, por duplicar ou pela API): qualquer automação cujo nome leva o token.
  const limparTemporarias = () => {
    api.autenticar().then(() => api.listarAutomacoes()).then((res) => {
      const minhas = (res.body?.data || []).filter((a) => String(a.name).includes(TOKEN));
      minhas.forEach((a) => api.excluirAutomacao(a.id));
    });
  };

  // `cy.login()` é agnóstico a API real/mock: o `before` do context roda antes e já define o modo.
  beforeEach(() => {
    cy.login();
  });

  // -------------------------------------------------------------
  // 1. NAVEGAÇÃO E LISTAGEM (API REAL)
  // -------------------------------------------------------------
  context('1. Navegação e Listagem de Automações (Issue front#605)', () => {

    // Front contra a API real: a tela, o recurso `automation` e as capabilities da dev. Só lê; a massa são 2 automações pausadas criadas pelo `before` e apagadas no `after`.
    let originalUseMocksState;
    let principal;
    let secundaria;

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', false);
      api.autenticar();
      criarTemporaria('principal').then((a) => { principal = a; });
      criarTemporaria('secundaria').then((a) => { secundaria = a; });
    });

    after(() => {
      limparTemporarias();
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    beforeEach(() => {
      AutomacoesMocks.interceptAutomationsListApi();
      AutomacoesPage.visitar();
      cy.wait('@getAutomationsList').its('response.statusCode').should('eq', 200);
    });

    it('1.1 deve abrir Automações pelo item do menu e mostrar a busca e os filtros Todas, Ativas e Pausadas', () => {
      // Assert
      cy.url().should('match', /\/automacoes(\?|$)/);
      AutomacoesPage.elements.paginaLista().should('be.visible');
      AutomacoesPage.elements.inputBuscaLista().should('be.visible');
      ['all', 'active', 'paused'].forEach((filtro) => {
        AutomacoesPage.elements.filtroLista(filtro).should('be.visible');
      });
    });

    it('1.2 deve mostrar a automação criada com o nome gravado e o switch de pausada', () => {
      // Assert
      AutomacoesPage.elements.cartao(principal.id).scrollIntoView().should('be.visible');
      AutomacoesPage.elements.cartaoAbrir(principal.id).should('contain.text', nome('principal'));
      AutomacoesPage.elements.cartaoSwitch(principal.id).should('have.attr', 'aria-checked', 'false');
    });

    it('1.3 deve buscar pelo nome sem distinguir acento nem caixa e deixar só o cartão que casa', () => {
      // Act: sem acento e em minúsculas
      AutomacoesPage.buscar(`automacao ${TOKEN} secundaria`);

      // Assert
      AutomacoesPage.elements.cartoes().should('have.length', 1);
      AutomacoesPage.elements.cartao(secundaria.id).should('be.visible');
      AutomacoesPage.elements.cartao(principal.id).should('not.exist');

      // Act: com acento e em maiúsculas
      AutomacoesPage.buscar(`AUTOMAÇÃO ${TOKEN.toUpperCase()} PRINCIPAL`);

      // Assert
      AutomacoesPage.elements.cartoes().should('have.length', 1);
      AutomacoesPage.elements.cartao(principal.id).should('be.visible');
    });

    it('1.4 deve separar as automações pausadas das ativas pelos filtros Ativas e Pausadas', () => {
      // Arrange: a massa está pausada
      AutomacoesPage.buscar(`${TOKEN}`);

      // Act + Assert: Pausadas traz as duas, Ativas não traz nenhuma
      AutomacoesPage.elements.filtroLista('paused').click();
      AutomacoesPage.elements.cartao(principal.id).should('be.visible');
      AutomacoesPage.elements.cartao(secundaria.id).should('be.visible');

      AutomacoesPage.elements.filtroLista('active').click();
      AutomacoesPage.elements.cartao(principal.id).should('not.exist');
      AutomacoesPage.elements.cartao(secundaria.id).should('not.exist');
    });

    it('1.5 deve abrir o construtor pelo botão Editar do cartão com o nome gravado e o estado Pausada', () => {
      // Act
      AutomacoesPage.abrirEdicao(principal.id);

      // Assert
      AutomacoesPage.elements.inputNome().should('have.value', nome('principal'));
      AutomacoesPage.elements.seloEstado().should('have.attr', 'data-status', 'paused');
    });

    it('1.6 deve abrir o histórico de execuções da automação e mostrar o estado vazio quando ela nunca rodou', () => {
      // Act
      AutomacoesPage.elements.cartaoExecucoes(principal.id).click();

      // Assert
      cy.url().should('match', new RegExp(`/automacoes/${principal.id}/execucoes$`));
      AutomacoesPage.elements.paginaExecucoes().should('be.visible');
      AutomacoesPage.elements.estadoExecucoes('empty').should('be.visible').and('contain.text', 'Nenhuma execução ainda.');
    });

    it('1.7 deve carregar o histórico de 20 em 20 pelo botão Carregar mais, sem repetir nem pular execução, e esconder o botão no fim (Issue backend#743)', function () {
      // Massa descoberta na hora ([R-ATEMPORAL]): a automação com 21 a 90 execuções (tem 2ª página e cabe numa leitura de 100) que rodou há mais tempo.
      // O histórico da tela é comparado com os ids da API lidos antes e depois; se um run novo entrar no meio, o teste pula (a comparação não vale).
      const idsDasLinhas = ($linhas) => [...$linhas].map((el) => Number(el.getAttribute('data-testid').replace('automation-log-row-', '')));
      const telas = [];
      let alvo;
      let idsDaApi;

      cy.then(() => api.listarAutomacoes({ timeout: 90000 })).then((res) => {
        alvo = (res.body.data || [])
          .filter((a) => a.run_count > 20 && a.run_count <= 90 && a.last_run_at)
          .sort((a, b) => new Date(a.last_run_at) - new Date(b.last_run_at))[0];
        if (!alvo) {
          cy.log('⏭️ Sem massa: nenhuma automação com 21 a 90 execuções');
          this.skip();
        }
      });
      cy.then(() => api.listarExecucoesAutomacaoPaginado(alvo.id, { per_page: 100 }, { timeout: 90000 })).then((res) => {
        expect(res.status, 'Status do GET /logs?per_page=100').to.eq(200);
        idsDaApi = res.body.data.map((linha) => linha.id);
        expect(idsDaApi.length, `Massa: a automação ${alvo.id} tem 2ª página`).to.be.greaterThan(20);
      });

      // Act: abre o histórico pelo cartão
      cy.then(() => {
        AutomacoesMocks.interceptAutomationLogsApi(alvo.id);
        AutomacoesPage.buscar(alvo.name);
        AutomacoesPage.elements.cartaoExecucoes(alvo.id).click();
      });
      cy.wait('@getAutomationLogs').its('request.url').should('match', /[?&]page=1(&|$)/);
      AutomacoesPage.elements.linhasExecucao().should('have.length', 20).then(($l) => { telas.push(idsDasLinhas($l)); });

      // Act: Carregar mais até o fim, uma página por clique
      const carregar = (pagina) => cy.then(() => {
        if ((pagina - 1) * 20 >= idsDaApi.length) return;
        AutomacoesPage.elements.botaoCarregarMais().should('be.visible').click();
        cy.wait('@getAutomationLogs').its('request.url').should('match', new RegExp(`[?&]page=${pagina}(&|$)`));
        AutomacoesPage.elements.linhasExecucao().should('have.length', Math.min(20 * pagina, idsDaApi.length)).then(($l) => { telas.push(idsDasLinhas($l)); });
        carregar(pagina + 1);
      });
      carregar(2);

      // Assert: o botão some no fim e as linhas são o histórico inteiro, na ordem, página a página
      AutomacoesPage.elements.botaoCarregarMais().should('not.exist');
      cy.then(() => api.listarExecucoesAutomacaoPaginado(alvo.id, { per_page: 100 }, { timeout: 90000 })).then((res) => {
        const depois = res.body.data.map((linha) => linha.id);
        if (JSON.stringify(depois) !== JSON.stringify(idsDaApi)) {
          cy.log('⏭️ Um run novo entrou durante o teste: a comparação com a API não vale nesta rodada');
          this.skip();
        }
        telas.forEach((ids, i) => {
          expect(ids, `Linhas depois de ${i} clique(s) em Carregar mais`).to.deep.eq(idsDaApi.slice(0, Math.min(20 * (i + 1), idsDaApi.length)));
        });
        expect(new Set(telas[telas.length - 1]).size, 'Nenhuma execução repetida na tela').to.eq(idsDaApi.length);
      });
    });

    it('1.8 deve marcar com o selo Padrão toda automação padrão da lista real e travar o Excluir dela, sem marcar nem travar a automação comum da rodada (Issue backend#747)', function () {
      // Contra a API real: as padrão vêm do banco da farmácia (runner v022), descobertas na hora pelo is_default; o #2.2 prova o mesmo com mock
      cy.then(() => api.listarAutomacoes({ timeout: 90000 })).then((res) => {
        const padrao = (res.body.data || []).filter((a) => a.is_default === true);
        if (!padrao.length) {
          cy.log('⏭️ Sem massa: nenhuma automação com is_default na loja');
          this.skip();
        }

        // Assert: o selo em cada padrão
        padrao.forEach((a) => {
          AutomacoesPage.elements.cartao(a.id).scrollIntoView();
          AutomacoesPage.elements.cartaoSeloPadrao(a.id).should('be.visible').and('have.text', 'Padrão');
        });

        // Assert: o Excluir da padrão travado, com o motivo
        const primeira = padrao[0];
        AutomacoesPage.elements.cartaoMenu(primeira.id).click();
        AutomacoesPage.elements.cartaoExcluir(primeira.id)
          .should('have.attr', 'aria-disabled', 'true')
          .and('have.attr', 'title', 'Esta automação é padrão: pode ser desativada, mas não excluída.');
        AutomacoesPage.elements.cartaoMenu(primeira.id).click();

        // Contraprova: a automação comum da rodada sem selo e com o Excluir livre
        AutomacoesPage.elements.cartao(principal.id).scrollIntoView();
        AutomacoesPage.elements.cartaoSeloPadrao(principal.id).should('not.exist');
        AutomacoesPage.elements.cartaoMenu(principal.id).click();
        AutomacoesPage.elements.cartaoExcluir(principal.id).should('be.visible').and('not.have.attr', 'aria-disabled', 'true');
      });
    });

    it('1.9 deve mostrar no histórico um texto próprio para cada falha do passo Enviar webhook, sem o código cru (Issue front#672, backend#745)', () => {
      // [R-BLIND] pontual: o histórico vem mockado para a automação real da rodada, porque o `webhook_timeout` não se produz sob demanda na dev;
      // o formato do log (`steps_executed` com `detail` por passo) é o medido na execução real do `0-D #4.3` em 2026-11-06. Textos medidos na tela no mesmo dia (front PR #677).
      const agora = new Date().toISOString();
      const casos = [
        ['webhook_blocked', 'o endereço cai numa rede interna e a chamada não saiu'],
        ['webhook_timeout', 'o destino não respondeu a tempo'],
        ['webhook_unreachable', 'não foi possível conectar ao destino'],
        ['webhook_http_404', 'o destino respondeu com o status 404'],
        ['step_unavailable', 'o passo não pôde rodar com a configuração atual; revise o passo'],
      ];
      const LOG = 990001;
      AutomacoesMocks.interceptAutomationLogsApi(principal.id, {
        data: [{
          id: LOG, client_id: 1, attendance_id: null, trigger_event: 'new_client_created', status: 'partial', error_message: null, created_at: agora,
          steps_executed: casos.map(([detail], i) => ({ path: String(i), step_type: 'send_webhook', status: 'failed', detail, at: agora })),
        }],
        has_next: false,
      });

      // Act: abre o histórico e o detalhe do run
      AutomacoesPage.buscar(TOKEN);
      AutomacoesPage.elements.cartaoExecucoes(principal.id).click();
      cy.wait('@getAutomationLogs');
      AutomacoesPage.elements.botaoExecucao(LOG).click();

      // Assert: um texto por código, e nenhum código cru na tela
      AutomacoesPage.elements.passosExecucao(LOG).should('have.length', casos.length);
      casos.forEach(([detail, texto], i) => {
        AutomacoesPage.elements.passosExecucao(LOG).eq(i)
          .should('have.attr', 'data-status', 'failed')
          .and('contain.text', 'Enviar webhook')
          .and('contain.text', texto)
          .and('not.contain.text', detail);
      });
    });
  });

  // -------------------------------------------------------------
  // 2. LISTAGEM: RECURSO NÃO CONTRATADO, ESTADOS E AUTOMAÇÕES PADRÃO (100% MOCKADO)
  // -------------------------------------------------------------
  context('2. Listagem de Automações: Recurso Não Contratado, Estados e Automações Padrão (Issue front#605)', () => {

    // 100% mockado [R-BLIND]: a dev não produz sob demanda a lista vazia, o erro de rota nem o gatilho desconhecido, e as automações padrão (`is_default`) dependem do runner v022
    // em cada banco. O mock nasce do formato medido na dev (itemDaLista, com `is_default` desde a front PR #679, medido em 2026-11-06). O app já subiu com o `/resources` do login
    // mockado, então cada teste registra os mocks e recarrega antes de abrir o menu.
    let originalUseMocksState;

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
    });

    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    const abrirListaMockada = ({ lista = { data: [] }, statusLista = 200 } = {}) => {
      RecursosMocks.interceptResources({ automation: true });
      AutomacoesMocks.interceptAutomationCapabilitiesApi();
      AutomacoesMocks.interceptAutomationsListApi(lista, statusLista);
      AutomacoesMocks.interceptAutomationTemplatesApi(); // só espião: a galeria saiu (front PR #679) e a rota não deve ser chamada
      cy.reload();
      AutomacoesPage.visitar();
    };

    it('2.1 deve esconder o item Automações do menu e mostrar o aviso de recurso não contratado quando a farmácia não tem o recurso automation', () => {
      // Arrange
      RecursosMocks.interceptResources({ automation: false });
      AutomacoesMocks.interceptAutomationCapabilitiesApi();
      cy.reload();

      // Assert: o item some do menu
      cy.get('[data-testid="sidebar-item-central"]').should('be.visible');
      AutomacoesPage.elements.itemMenu().should('not.exist');

      // Act: rota direta (a dev responde 404 do servidor web, mas a SPA carrega)
      cy.visit('/automacoes', { failOnStatusCode: false });

      // Assert
      AutomacoesPage.elements.avisoRecursoNaoContratado().should('be.visible').and('contain.text', 'Automações não está disponível para a sua farmácia.');
    });

    it('2.2 deve marcar com o selo Padrão só a automação padrão e travar o Excluir dela com o motivo, sem travar o da comum e sem chamar a galeria de modelos', () => {
      // Arrange: uma padrão e uma comum (a padrão nasce no banco de cada farmácia e pode ser pausada, editada e duplicada, mas não excluída; front PR #679)
      const padrao = AutomacoesMocks.itemDaLista({ id: 9301, name: 'Boas-vindas com horário de atendimento', trigger_type: 'first_inbound_message', is_default: true });
      const comum = AutomacoesMocks.itemDaLista({ id: 9302, name: 'Automação da farmácia', is_default: false });

      // Act
      abrirListaMockada({ lista: { data: [padrao, comum] } });

      // Assert: o selo só na padrão
      AutomacoesPage.elements.cartaoSeloPadrao(9301).should('be.visible').and('have.text', 'Padrão');
      AutomacoesPage.elements.cartao(9302).should('be.visible');
      AutomacoesPage.elements.cartaoSeloPadrao(9302).should('not.exist');

      // Assert: Excluir da padrão travado, com o motivo no title
      AutomacoesPage.elements.cartaoMenu(9301).click();
      AutomacoesPage.elements.cartaoExcluir(9301)
        .should('have.attr', 'aria-disabled', 'true')
        .and('have.attr', 'title', 'Esta automação é padrão: pode ser desativada, mas não excluída.');
      AutomacoesPage.elements.cartaoMenu(9301).click();

      // Contraprova: o Excluir da comum fica livre
      AutomacoesPage.elements.cartaoMenu(9302).click();
      AutomacoesPage.elements.cartaoExcluir(9302).should('be.visible').and('not.have.attr', 'aria-disabled', 'true');

      // Assert: a galeria saiu, a tela não chama mais a rota de modelos
      cy.get('@getAutomationTemplates.all').should('have.length', 0);
    });

    it('2.3 deve mostrar o erro de carregamento e recarregar a lista ao clicar em Tentar novamente', () => {
      // Arrange
      abrirListaMockada({ lista: { message: 'Erro interno' }, statusLista: 500 });
      AutomacoesPage.elements.estadoLista('error').should('be.visible');

      // Act: o servidor volta; o novo mock vale para a próxima chamada
      AutomacoesMocks.interceptAutomationsListApi({ data: [AutomacoesMocks.itemDaLista({ id: 9101, name: 'Automação recuperada' })] });
      AutomacoesPage.elements.botaoTentarNovamente().click();

      // Assert
      AutomacoesPage.elements.estadoLista('error').should('not.exist');
      AutomacoesPage.elements.cartaoAbrir(9101).should('contain.text', 'Automação recuperada');
    });

    it('2.4 deve listar sem quebrar uma automação com gatilho que o front não conhece, mostrando o gatilho cru', () => {
      // Act
      abrirListaMockada({ lista: { data: [AutomacoesMocks.itemDaLista({ id: 9201, name: 'Gatilho novo', trigger_type: 'gatilho_do_futuro' })] } });

      // Assert
      AutomacoesPage.elements.cartao(9201).should('be.visible').and('contain.text', 'gatilho_do_futuro');
      AutomacoesPage.elements.estadoLista('error').should('not.exist');
    });
  });

  // -------------------------------------------------------------
  // 3. CADASTRO (CRUD) DE AUTOMAÇÕES (API REAL)
  // -------------------------------------------------------------
  context('3. Cadastro de Automações: Criar, Salvar, Ativar, Pausar, Duplicar e Excluir (Issue front#605)', () => {

    // Front contra a API real, gravando: cada teste cria a própria automação temporária pela API (ou pela tela, no 3.1) e o `after` apaga tudo que leva o token.
    // A ativação do 3.3 só usa a palavra-chave única da rodada e deixa a automação pausada de novo no fim (o motor da dev confere eventos a cada 30 s).
    let originalUseMocksState;

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', false);
      api.autenticar();
    });

    after(() => {
      limparTemporarias();
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    it('3.1 deve criar uma automação do zero pela tela, salvar como rascunho e abrir a automação gravada como Pausada', () => {
      // Arrange
      let criadaId;
      AutomacoesMocks.interceptAutomationCreateApi();
      AutomacoesPage.visitar();

      // Act
      AutomacoesPage.abrirNova();
      AutomacoesPage.elements.seloEstado().should('have.attr', 'data-status', 'draft');
      AutomacoesPage.elements.inputNome().type(nome('criada pela tela'));
      AutomacoesPage.adicionarPasso('root', 0, 'send-message');
      AutomacoesPage.escreverTextoDoPasso('root-0', 'Olá pela tela!');
      AutomacoesPage.elements.botaoSalvar().click();

      // Assert: o corpo enviado é a árvore aninhada e o rascunho nasce inativo
      cy.wait('@postAutomation').then(({ request, response }) => {
        expect(response.statusCode, 'status do POST').to.eq(201);
        expect(request.body.name).to.eq(nome('criada pela tela'));
        expect(request.body.is_active, 'rascunho nasce inativo').to.eq(false);
        expect(request.body.steps, 'passos enviados').to.have.length(1);
        expect(request.body.steps[0].step_type).to.eq('send_message');
        expect(request.body.steps[0].step_config.text).to.eq('Olá pela tela!');
        criadaId = response.body.automation.id;
      });
      AutomacoesPage.elements.toast('success').should('contain.text', 'Automação criada');
      cy.url().should('match', /\/automacoes\/\d+$/);
      AutomacoesPage.elements.inputNome().should('have.value', nome('criada pela tela'));
      AutomacoesPage.elements.seloEstado().should('have.attr', 'data-status', 'paused');
      cy.then(() => api.obterAutomacao(criadaId)).then((res) => {
        expect(res.body.automation.name, 'nome gravado no servidor').to.eq(nome('criada pela tela'));
        expect(res.body.automation.is_active).to.eq(false);
      });
    });

    it('3.2 deve salvar a edição do nome e mandar o updated_at lido no PATCH', () => {
      criarTemporaria('edicao').then((a) => {
        // Arrange
        AutomacoesMocks.interceptAutomationUpdateApi();
        AutomacoesPage.visitar();
        AutomacoesPage.abrirEdicao(a.id);

        // Act
        AutomacoesPage.elements.inputNome().clear().type(nome('editada'));
        AutomacoesPage.elements.botaoSalvar().click();

        // Assert
        cy.wait('@patchAutomation').then(({ request, response }) => {
          expect(response.statusCode, 'status do PATCH').to.eq(200);
          expect(request.body.name).to.eq(nome('editada'));
          expect(request.body.updated_at, 'trava otimista: o updated_at lido no GET').to.eq(a.updated_at);
        });
        AutomacoesPage.elements.toast('success').should('contain.text', 'Automação salva');
        cy.then(() => api.obterAutomacao(a.id)).its('body.automation.name').should('eq', nome('editada'));
      });
    });

    it('3.3 deve ativar e pausar pelo switch do cartão, mandando só is_active, e o servidor refletir cada estado', () => {
      criarTemporaria('switch').then((a) => {
        // Arrange
        AutomacoesMocks.interceptAutomationUpdateApi();
        AutomacoesPage.visitar();

        // Act: ativar
        AutomacoesPage.elements.cartaoSwitch(a.id).scrollIntoView().click();

        // Assert
        cy.wait('@patchAutomation').its('request.body').should('deep.equal', { is_active: true });
        AutomacoesPage.elements.toast('success').should('contain.text', 'Automação ativada');
        AutomacoesPage.elements.cartaoSwitch(a.id).should('have.attr', 'aria-checked', 'true');
        cy.then(() => api.obterAutomacao(a.id)).its('body.automation.is_active').should('eq', true);

        // Act: pausar de novo
        AutomacoesPage.elements.cartaoSwitch(a.id).click();

        // Assert
        cy.wait('@patchAutomation').its('request.body').should('deep.equal', { is_active: false });
        AutomacoesPage.elements.toast('success').should('contain.text', 'Automação pausada');
        AutomacoesPage.elements.cartaoSwitch(a.id).should('have.attr', 'aria-checked', 'false');
        cy.then(() => api.obterAutomacao(a.id)).its('body.automation.is_active').should('eq', false);
      });
    });

    it('3.4 deve duplicar pelo menu do cartão e a cópia nascer pausada com o sufixo "(cópia)"', () => {
      criarTemporaria('duplicar').then((a) => {
        // Arrange
        AutomacoesPage.visitar();

        // Act
        AutomacoesPage.elements.cartaoMenu(a.id).scrollIntoView().click();
        AutomacoesPage.elements.cartaoDuplicar(a.id).click();

        // Assert
        AutomacoesPage.elements.toast('success').should('contain.text', 'Automação duplicada');
        cy.then(() => api.listarAutomacoes()).then((res) => {
          const copia = (res.body.data || []).find((x) => x.name === `${a.name} (cópia)`);
          expect(copia, 'a cópia existe na listagem do servidor').to.exist;
          expect(copia.is_active, 'a cópia nasce pausada').to.eq(false);
          AutomacoesPage.elements.cartao(copia.id).scrollIntoView().should('be.visible');
          AutomacoesPage.elements.cartaoSwitch(copia.id).should('have.attr', 'aria-checked', 'false');
        });
      });
    });

    it('3.5 deve pedir confirmação ao excluir: cancelar mantém a automação e confirmar a remove do servidor', () => {
      criarTemporaria('excluir').then((a) => {
        // Arrange
        AutomacoesPage.visitar();

        // Act: cancelar
        AutomacoesPage.elements.cartaoMenu(a.id).scrollIntoView().click();
        AutomacoesPage.elements.cartaoExcluir(a.id).click();
        AutomacoesPage.elements.dialogo('automation-delete-confirm').should('be.visible').and('contain.text', a.name);
        AutomacoesPage.elements.dialogoCancelar('automation-delete-confirm').click();

        // Assert
        AutomacoesPage.elements.dialogo('automation-delete-confirm').should('not.exist');
        AutomacoesPage.elements.cartao(a.id).should('exist');

        // Act: confirmar
        AutomacoesPage.elements.cartaoMenu(a.id).click();
        AutomacoesPage.elements.cartaoExcluir(a.id).click();
        AutomacoesPage.elements.dialogoConfirmar('automation-delete-confirm').click();

        // Assert
        AutomacoesPage.elements.toast('success').should('contain.text', 'Automação excluída');
        AutomacoesPage.elements.cartao(a.id).should('not.exist');
        cy.then(() => api.obterAutomacao(a.id)).its('status').should('eq', 404);
      });
    });

    it('3.6 deve gravar o emoji do nome e do texto do passo como {{e:HEX}} e mostrá-lo de volta como emoji ao reabrir a automação', () => {
      // ROADMAP.md P1-59, parte 6: o front codifica o emoji fora do WIN1252 como `{{e:<código em hexa>}}` antes de enviar (front `encodeMessageEmoji`, developer);
      // 😀 = U+1F600 → `{{e:1F600}}`. Grava de verdade e o `after` do context apaga (o nome leva o token da rodada).
      let criadaId;
      AutomacoesMocks.interceptAutomationCreateApi();
      AutomacoesPage.visitar();
      AutomacoesPage.abrirNova();
      AutomacoesPage.elements.inputNome().type(nome('emoji 😀'));
      AutomacoesPage.adicionarPasso('root', 0, 'send-message');
      AutomacoesPage.escreverTextoDoPasso('root-0', 'Olá 😀 tudo bem?');
      AutomacoesPage.elements.botaoSalvar().click();

      cy.wait('@postAutomation').then(({ request, response }) => {
        expect(response.statusCode, 'status do POST').to.eq(201);
        expect(request.body.name, 'nome enviado com o emoji codificado').to.eq(nome('emoji {{e:1F600}}'));
        expect(request.body.steps[0].step_config.text, 'texto do passo com o emoji codificado').to.eq('Olá {{e:1F600}} tudo bem?');
        criadaId = response.body.automation.id;
      });
      cy.then(() => api.obterAutomacao(criadaId)).then((res) => {
        expect(res.body.automation.name, 'nome gravado no servidor').to.eq(nome('emoji {{e:1F600}}'));
      });

      // Reaberta, a tela decodifica de volta para o emoji
      AutomacoesPage.elements.inputNome().should('have.value', nome('emoji 😀'));
      AutomacoesPage.abrirPasso('root-0');
      AutomacoesPage.elements.campoPasso('root-0', 'text').should('have.value', 'Olá 😀 tudo bem?');
    });

    it('3.7 deve salvar como rascunho o passo Enviar webhook com URL de rede interna, que só a ativação barra, e oferecer o webhook também dentro do ramo da condição (Issue front#672, backend#745)', () => {
      // Cenário 3 do roteiro de QA da front#672 (passo 2): o rascunho é livre, a regra de host interno é só da ativação (a recusa na ativação está no #5.8).
      // Grava de verdade e o `after` do context apaga (o nome leva o token da rodada).
      AutomacoesMocks.interceptAutomationCreateApi();
      AutomacoesPage.visitar();
      AutomacoesPage.abrirNova();
      AutomacoesPage.elements.inputNome().type(nome('webhook interno'));
      AutomacoesPage.escolherGatilho('new_client_created');

      // Arrange: o webhook com URL interna e uma condição com o webhook no ramo "sim"
      AutomacoesPage.adicionarPasso('root', 0, 'send-webhook');
      // Cenário 2 do roteiro: a dica do Corpo (JSON) explica o envelope do corpo vazio e o null do id que falta
      AutomacoesPage.elements.dicaDoCampoPasso('root-0', 'webhook-body')
        .should('contain.text', 'Vazio, vai um JSON com automation_id, trigger_type, client_id, attendance_id e store_id')
        .and('contain.text', 'Id que o gatilho não tem vai como null');
      AutomacoesPage.preencherWebhook('root-0', 'https://127.0.0.1/hook');
      AutomacoesPage.adicionarPasso('root', 1, 'condition');
      AutomacoesPage.adicionarPasso('root-1-yes', 0, 'send-webhook');
      AutomacoesPage.preencherWebhook('root-1-yes-0', 'https://example.com/hook');

      // Act: salva pausada (rascunho)
      AutomacoesPage.elements.botaoSalvar().click();

      // Assert: o POST sai e grava, com a URL interna no rascunho e o webhook dentro do ramo
      cy.wait('@postAutomation').then(({ request, response }) => {
        expect(response.statusCode, 'status do POST do rascunho').to.eq(201);
        expect(request.body.is_active, 'rascunho pausado').to.eq(false);
        expect(request.body.steps[0], 'webhook na raiz').to.deep.include({ step_type: 'send_webhook' });
        expect(request.body.steps[0].step_config.url, 'URL interna aceita no rascunho').to.eq('https://127.0.0.1/hook');
        expect(request.body.steps[1].branches.yes[0], 'webhook dentro do ramo sim').to.deep.include({ step_type: 'send_webhook' });
        // A tela manda o corpo vazio como body_template "", e o servidor guarda só url e body_template (PR #870)
        const gravado = response.body.automation.steps[0].step_config;
        expect(Object.keys(gravado), 'chaves gravadas no step_config').to.satisfy((chaves) => chaves.every((c) => ['url', 'body_template'].includes(c)));
        expect(gravado.url, 'URL gravada').to.eq('https://127.0.0.1/hook');
      });
    });
  });

  // -------------------------------------------------------------
  // 4. CONSTRUTOR E PASSOS (API REAL, SEM GRAVAR)
  // -------------------------------------------------------------
  context('4. Construtor de Automações: Passos, Reordenação, Ramos da Condição e Matriz Gatilho × Passo (Issue front#605)', () => {

    // Front contra a API real, sem gravar: monta a árvore em /automacoes/nova e nunca salva (o único GET que importa é o dos seletores). Os testids de passo usam o caminho de
    // posição (`root-0`, `root-0-yes-0`), estável entre recargas: o primeiro passo inserido é `root-0` e o seguinte, depois dele, é `root-1`.
    let originalUseMocksState;

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', false);
    });

    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    beforeEach(() => {
      AutomacoesMocks.interceptAutomationCreateApi();
      AutomacoesPage.visitar();
      AutomacoesPage.abrirNova();
    });

    afterEach(() => {
      // Nada pode ter sido gravado: o construtor só monta a árvore
      cy.get('@postAutomation.all').should('have.length', 0);
    });

    it('4.1 deve inserir dois passos de mensagem, reordenar com ↑ e deixar os botões das pontas desabilitados', () => {
      // Arrange
      AutomacoesPage.adicionarPasso('root', 0, 'send-message');
      AutomacoesPage.escreverTextoDoPasso('root-0', 'Primeiro');
      AutomacoesPage.adicionarPasso('root', 1, 'send-message');
      AutomacoesPage.escreverTextoDoPasso('root-1', 'Segundo');

      // Act: sobe o segundo
      AutomacoesPage.elements.passoSubir('root-1').click();

      // Assert: a ordem trocou
      // (os botões ↑/↓ só existem com o passo aberto, e só um passo fica aberto por vez)
      AutomacoesPage.abrirPasso('root-0');
      AutomacoesPage.elements.campoPasso('root-0', 'text').should('have.value', 'Segundo');
      AutomacoesPage.elements.passoSubir('root-0').should('have.attr', 'aria-disabled', 'true');
      AutomacoesPage.abrirPasso('root-1');
      AutomacoesPage.elements.campoPasso('root-1', 'text').should('have.value', 'Primeiro');
      AutomacoesPage.elements.passoDescer('root-1').should('have.attr', 'aria-disabled', 'true');
    });

    it('4.2 deve remover um passo da lista sem mexer nos outros', () => {
      // Arrange
      AutomacoesPage.adicionarPasso('root', 0, 'send-message');
      AutomacoesPage.escreverTextoDoPasso('root-0', 'Fica');
      AutomacoesPage.adicionarPasso('root', 1, 'send-message');
      AutomacoesPage.escreverTextoDoPasso('root-1', 'Sai');

      // Act
      AutomacoesPage.elements.passoExcluir('root-1').click();

      // Assert
      AutomacoesPage.elements.cabecalhoPasso('root-1').should('not.exist');
      AutomacoesPage.abrirPasso('root-0');
      AutomacoesPage.elements.campoPasso('root-0', 'text').should('have.value', 'Fica');
    });

    it('4.3 deve ramificar a condição em duas colunas Sim e Não e montar um passo dentro do ramo Sim', () => {
      // Act
      AutomacoesPage.adicionarPasso('root', 0, 'condition');
      AutomacoesPage.adicionarPasso('root-0-yes', 0, 'send-message');

      // Assert: o passo novo mora só na coluna Sim
      AutomacoesPage.elements.ramo('yes').should('be.visible').and('contain.text', 'Sim');
      AutomacoesPage.elements.ramo('no').should('be.visible').and('contain.text', 'Não');
      AutomacoesPage.elements.ramo('yes').find('[data-testid="automation-step-root-0-yes-0-toggle"]').should('exist');
      AutomacoesPage.elements.ramo('no').find('[data-testid$="-toggle"]').should('not.exist');
    });

    it('4.4 deve pedir confirmação ao excluir uma condição com passos nos ramos e excluir direto a que está vazia', () => {
      // Arrange: condição com 1 filho
      AutomacoesPage.adicionarPasso('root', 0, 'condition');
      AutomacoesPage.adicionarPasso('root-0-yes', 0, 'send-message');

      // Act: excluir a condição com filho abre o diálogo (o filho recém-criado abriu e fechou a condição: reabre antes de excluir)
      AutomacoesPage.abrirPasso('root-0');
      AutomacoesPage.elements.passoExcluir('root-0').click();
      AutomacoesPage.elements.dialogo('automation-step-root-0-delete-confirm').should('be.visible');

      // Assert: cancelar mantém a condição e o filho
      AutomacoesPage.elements.dialogoCancelar('automation-step-root-0-delete-confirm').click();
      AutomacoesPage.elements.cabecalhoPasso('root-0').should('exist');
      AutomacoesPage.elements.cabecalhoPasso('root-0-yes-0').should('exist');

      // Act: confirmar leva a condição e o filho
      AutomacoesPage.abrirPasso('root-0');
      AutomacoesPage.elements.passoExcluir('root-0').click();
      AutomacoesPage.elements.dialogoConfirmar('automation-step-root-0-delete-confirm').click();

      // Assert
      AutomacoesPage.elements.cabecalhoPasso('root-0').should('not.exist');
      AutomacoesPage.elements.cabecalhoPasso('root-0-yes-0').should('not.exist');

      // Act + Assert: condição sem filhos sai direto, sem diálogo
      AutomacoesPage.adicionarPasso('root', 0, 'condition');
      AutomacoesPage.elements.passoExcluir('root-0').click();
      AutomacoesPage.elements.cabecalhoPasso('root-0').should('not.exist');
      AutomacoesPage.elements.dialogo('automation-step-root-0-delete-confirm').should('not.exist');
    });

    it('4.5 deve barrar o quarto nível de condição: o menu do ramo da terceira condição não oferece Condição', () => {
      // Arrange: três condições aninhadas, cada uma no ramo Sim da anterior
      AutomacoesPage.adicionarPasso('root', 0, 'condition');
      AutomacoesPage.adicionarPasso('root-0-yes', 0, 'condition');
      AutomacoesPage.adicionarPasso('root-0-yes-0-yes', 0, 'condition');

      // Act: abre o "+" do ramo Sim da terceira condição
      AutomacoesPage.elements.botaoAdicionarPasso('root-0-yes-0-yes-0-yes', 0).click();

      // Assert: oferece mensagem, mas não oferece outra condição
      AutomacoesPage.elements.itemMenuPasso('root-0-yes-0-yes-0-yes', 0, 'send-message').should('be.visible');
      AutomacoesPage.elements.itemMenuPasso('root-0-yes-0-yes-0-yes', 0, 'condition').should('not.exist');
    });

    it('4.6 deve oferecer no menu "adicionar passo" os 8 tipos que o motor roda, com espera e webhook, e esconder campo do cliente e flow', () => {
      // Act (gatilho padrão do construtor: Nova mensagem recebida, que traz cliente e atendimento)
      AutomacoesPage.elements.botaoAdicionarPasso('root', 0).click();

      // Assert: `wait` e `send_webhook` voltaram ao menu nas front PRs #676 e #677 (backend#742 e #745); campo do cliente e flow seguem fora
      ['send-message', 'send-template', 'set-custom-status', 'assign-attendance', 'wait', 'condition', 'send-webhook', 'close-attendance'].forEach((tipo) => {
        AutomacoesPage.elements.itemMenuPasso('root', 0, tipo).should('exist');
      });
      ['update-client-field', 'start-flow'].forEach((tipo) => {
        AutomacoesPage.elements.itemMenuPasso('root', 0, tipo).should('not.exist');
      });
      AutomacoesPage.elements.itensMenuPasso().should('have.length', 8);
    });

    it('4.7 deve esconder do menu os passos de atendimento quando o gatilho é Cliente cadastrado, que só traz o cliente', () => {
      // Act
      AutomacoesPage.escolherGatilho('new_client_created');
      AutomacoesPage.elements.botaoAdicionarPasso('root', 0).click();

      // Assert: só a condição cabe sem atendimento
      AutomacoesPage.elements.itemMenuPasso('root', 0, 'condition').should('exist');
      AutomacoesPage.elements.itemMenuPasso('root', 0, 'send-message').should('not.exist');
      AutomacoesPage.elements.itemMenuPasso('root', 0, 'close-attendance').should('not.exist');
    });

    it('4.8 deve marcar com erro, e não apagar, o passo que ficou incompatível ao trocar o gatilho, e limpar a marca ao voltar', () => {
      // Arrange
      AutomacoesPage.adicionarPasso('root', 0, 'send-message');
      AutomacoesPage.escreverTextoDoPasso('root-0', 'Olá');

      // Act: gatilho sem atendimento
      AutomacoesPage.escolherGatilho('new_client_created');

      // Assert: o passo continua e vira pendência no caminho exato
      AutomacoesPage.elements.cabecalhoPasso('root-0').should('exist');
      AutomacoesPage.elements.pendencia('root-0', 'step-not-allowed-for-trigger').should('be.visible');

      // Act: volta ao gatilho que suporta o passo
      AutomacoesPage.escolherGatilho('new_message_received');

      // Assert
      AutomacoesPage.elements.pendencia('root-0', 'step-not-allowed-for-trigger').should('not.exist');
    });

    it('4.9 deve listar os 8 gatilhos com o Agendado e, ao escolhê-lo, pedir horário, dias e fuso e oferecer só os passos que não dependem de atendimento', () => {
      // Assert: o Agendado (`time_based`) entrou no select na front PR #678 (backend#746)
      const esperados = ['new_message_received', 'attendance_opened', 'first_inbound_message', 'keyword_match', 'new_client_created', 'attendance_assigned', 'attendance_status_changed', 'time_based'];
      AutomacoesPage.elements.selectGatilho().find('option').then(($opcoes) => {
        const valores = [...$opcoes].map((o) => o.value).filter(Boolean);
        expect(valores, 'gatilhos oferecidos').to.have.members(esperados);
      });

      // Act
      AutomacoesPage.escolherGatilho('time_based');

      // Assert: o formulário do agendamento (horário HH:mm, os 7 dias da semana e o fuso)
      AutomacoesPage.elements.inputHorarioAgendado().should('be.visible').and('have.attr', 'type', 'time');
      [0, 1, 2, 3, 4, 5, 6].forEach((dia) => AutomacoesPage.elements.botaoDiaAgendado(dia).should('be.visible'));
      AutomacoesPage.elements.selectFusoAgendado().should('be.visible');

      // Assert: sem cliente nem atendimento no disparo, o menu só oferece espera, condição e webhook
      AutomacoesPage.elements.botaoAdicionarPasso('root', 0).click();
      ['wait', 'condition', 'send-webhook'].forEach((tipo) => {
        AutomacoesPage.elements.itemMenuPasso('root', 0, tipo).should('exist');
      });
      AutomacoesPage.elements.itemMenuPasso('root', 0, 'send-message').should('not.exist');
      AutomacoesPage.elements.itemMenuPasso('root', 0, 'close-attendance').should('not.exist');
      AutomacoesPage.elements.itensMenuPasso().should('have.length', 3);
    });

    // Guarda de saída do construtor (ROADMAP.md P1-59, parte 7; medida em 2026-11-06 contra a API real): o rascunho é o nome digitado, nada é salvo
    const RASCUNHO = 'Rascunho guarda de saída E2E';

    it('4.10 deve acionar o aviso nativo do navegador (beforeunload) com a automação nova alterada, e não acionar com ela intacta', () => {
      cy.beforeUnloadFoiPrevenido().should('be.false');
      AutomacoesPage.elements.inputNome().type(RASCUNHO);
      cy.beforeUnloadFoiPrevenido().should('be.true');
    });

    it('4.11 deve perguntar "Sair sem salvar?" ao clicar no menu lateral com a automação alterada — "Continuar editando" mantém o rascunho, "Sair" navega', () => {
      AutomacoesPage.elements.inputNome().type(RASCUNHO);

      AutomacoesPage.elements.sidebarItemCentral().click();
      AutomacoesPage.elements.dialogoSairSemSalvarConstrutor().should('be.visible').and('contain.text', 'Sair sem salvar?');
      cy.location('pathname').should('eq', '/automacoes/nova');

      AutomacoesPage.elements.btnContinuarEditandoConstrutor().click();
      AutomacoesPage.elements.dialogoSairSemSalvarConstrutor().should('not.exist');
      AutomacoesPage.elements.inputNome().should('have.value', RASCUNHO);
      cy.location('pathname').should('eq', '/automacoes/nova');

      AutomacoesPage.elements.sidebarItemCentral().click();
      AutomacoesPage.elements.btnSairConstrutor().click();
      cy.location('pathname').should('eq', '/dashboard');
    });

    it('4.12 deve abrir "Sair sem salvar?" ao voltar pelo navegador com a automação alterada — "Continuar editando" mantém o rascunho, "Sair" volta para a lista', () => {
      AutomacoesPage.elements.inputNome().type(RASCUNHO);

      cy.go('back');
      AutomacoesPage.elements.dialogoSairSemSalvarNavegador().should('be.visible').and('contain.text', 'Sair sem salvar?');
      cy.location('pathname').should('eq', '/automacoes/nova');

      AutomacoesPage.elements.btnContinuarEditandoNavegador().click();
      AutomacoesPage.elements.dialogoSairSemSalvarNavegador().should('not.exist');
      AutomacoesPage.elements.inputNome().should('have.value', RASCUNHO);

      cy.go('back');
      AutomacoesPage.elements.btnSairNavegador().click();
      cy.location('pathname').should('eq', '/automacoes');
    });

    it('4.13 contraprova: sem nenhuma alteração, o menu lateral sai do construtor sem perguntar', () => {
      AutomacoesPage.elements.sidebarItemCentral().click();
      AutomacoesPage.elements.dialogoSairSemSalvarConstrutor().should('not.exist');
      cy.location('pathname').should('eq', '/dashboard');
    });

    // Escopo por canal (ROADMAP.md P1-59, parte 3; medido em 2026-11-06 contra a API real): pílulas `button-automation-channel-<id>` com `aria-pressed`,
    // "Todos os canais" (`-all`) marcado por padrão. O canal é o primeiro que a loja tiver, sem código fixo.
    it('4.14 deve começar com "Todos os canais" marcado, marcar só o canal escolhido e voltar ao padrão ao clicar em "Todos os canais"', () => {
      AutomacoesPage.elements.botaoTodosCanais().should('have.attr', 'aria-pressed', 'true');
      AutomacoesPage.elements.botoesCanais().should('have.length.at.least', 1).each(($b) => expect($b, 'canal desmarcado no padrão').to.have.attr('aria-pressed', 'false'));

      AutomacoesPage.elements.botoesCanais().first().click();
      AutomacoesPage.elements.botoesCanais().first().should('have.attr', 'aria-pressed', 'true');
      AutomacoesPage.elements.botaoTodosCanais().should('have.attr', 'aria-pressed', 'false');

      AutomacoesPage.elements.botaoTodosCanais().click();
      AutomacoesPage.elements.botaoTodosCanais().should('have.attr', 'aria-pressed', 'true');
      AutomacoesPage.elements.botoesCanais().each(($b) => expect($b, 'canal desmarcado ao voltar ao padrão').to.have.attr('aria-pressed', 'false'));
    });

    it('4.15 deve travar o escopo em "Todos os canais", com as pílulas desabilitadas, quando o gatilho é Cliente cadastrado, e liberar ao trocar de gatilho', () => {
      AutomacoesPage.elements.botoesCanais().first().click();
      AutomacoesPage.elements.botaoTodosCanais().should('have.attr', 'aria-pressed', 'false');

      AutomacoesPage.escolherGatilho('new_client_created');
      AutomacoesPage.elements.botaoTodosCanais().should('have.attr', 'aria-pressed', 'true').and('be.disabled');
      AutomacoesPage.elements.botoesCanais().each(($b) => {
        expect($b, 'canal desmarcado com Cliente cadastrado').to.have.attr('aria-pressed', 'false');
        expect($b, 'canal desabilitado com Cliente cadastrado').to.be.disabled;
      });

      AutomacoesPage.escolherGatilho('new_message_received');
      AutomacoesPage.elements.botaoTodosCanais().should('not.be.disabled');
      AutomacoesPage.elements.botoesCanais().each(($b) => expect($b, 'canal liberado fora de Cliente cadastrado').not.to.be.disabled);
    });

    // Condição de horário (ROADMAP.md P1-59, parte 4; medida em 2026-11-06 contra a API real): assunto "Horário" (`time_of_day`) com início, fim, 7 dias e fuso.
    // A virada de meia-noite (22:00 a 06:00) e a condição sem nenhum dia marcado são aceitas pelo front sem pendência; o início igual ao fim é barrado, com o texto
    // "Preencha início e fim do horário." mesmo com os dois preenchidos (as três coisas vão na devolutiva ao front; o teste não afirma o texto enganoso).
    const abrirCondicaoDeHorario = () => {
      AutomacoesPage.adicionarPasso('root', 0, 'condition');
      AutomacoesPage.abrirPasso('root-0');
      AutomacoesPage.elements.campoPasso('root-0', 'condition-subject').select('time_of_day');
    };

    it('4.16 deve mostrar na condição de Horário a janela padrão das 08:00 às 18:00, os 7 dias marcados e o fuso de São Paulo, e permitir desmarcar um dia e trocar o fuso', () => {
      abrirCondicaoDeHorario();

      AutomacoesPage.elements.campoPasso('root-0', 'window-start').should('have.value', '08:00');
      AutomacoesPage.elements.campoPasso('root-0', 'window-end').should('have.value', '18:00');
      for (let dia = 0; dia < 7; dia++) AutomacoesPage.elements.campoPasso('root-0', `window-day-${dia}`).should('have.attr', 'aria-pressed', 'true');
      AutomacoesPage.elements.campoPasso('root-0', 'window-timezone').should('have.value', '').find('option:selected').should('contain.text', 'America/Sao_Paulo');

      AutomacoesPage.elements.campoPasso('root-0', 'window-day-0').click();
      AutomacoesPage.elements.campoPasso('root-0', 'window-day-0').should('have.attr', 'aria-pressed', 'false');
      AutomacoesPage.elements.campoPasso('root-0', 'window-day-1').should('have.attr', 'aria-pressed', 'true');
      AutomacoesPage.elements.campoPasso('root-0', 'window-timezone').select('America/Manaus').should('have.value', 'America/Manaus');
    });

    it('4.17 deve barrar o salvar quando o início e o fim da condição de Horário são iguais, com a pendência no passo, sem gravar', () => {
      AutomacoesPage.elements.inputNome().type('Horário inválido E2E');
      abrirCondicaoDeHorario();
      AutomacoesPage.elements.campoPasso('root-0', 'window-start').clear().type('10:00');
      AutomacoesPage.elements.campoPasso('root-0', 'window-end').clear().type('10:00');

      AutomacoesPage.elements.botaoSalvar().click();

      AutomacoesPage.elements.pendencia('root-0', 'time-window-invalid').scrollIntoView().should('be.visible');
      cy.location('pathname').should('eq', '/automacoes/nova');
      // O afterEach do context confere que nenhum POST /automations saiu
    });

    // Seletores dos passos (ROADMAP.md P1-59, parte 2; medidos em 2026-11-06 contra a API real): cada seletor espelha a resposta da rota que o alimenta,
    // sem lista fixa. Enviar template: `template-id` (GET /waba-message-templates do canal oficial) e, escolhido, `template-text` com 5 botões de variável;
    // Mudar substatus: `custom-status-id` (GET /attendance-custom-statuses) com "Limpar substatus"; Atribuir: `assign-mode` (Rodízio por padrão), `group-id`
    // (GET /channel-groups) e, no modo específico, `agent-id` (GET /attendance-groups/:id/agents do grupo escolhido).
    // Asserção que se repete até as opções renderizarem (o Firefox do cypress open as monta depois da resposta; um .then lia a lista vazia, 2026-11-06)
    const exigirOpcoes = (pathId, campo, esperados, modo = 'deep.eq') => AutomacoesPage.elements.campoPasso(pathId, campo).find('option').should(($o) => {
      const ids = $o.toArray().map((o) => o.value).filter((v) => v !== '' && v !== 'null');
      if (modo === 'members') expect(ids, `opções de ${campo}`).to.have.members(esperados); else expect(ids, `opções de ${campo}`).to.deep.eq(esperados);
    });

    it('4.18 deve listar no passo Enviar template os templates do canal oficial e, escolhido um, mostrar o texto com os botões de variável que a inserem no texto', () => {
      cy.intercept('GET', '**/waba-message-templates*').as('getTemplatesPasso');
      AutomacoesPage.adicionarPasso('root', 0, 'send-template');
      AutomacoesPage.abrirPasso('root-0');

      cy.wait('@getTemplatesPasso').its('response').then((res) => {
        expect(res.statusCode, 'Status da lista de templates').to.eq(200);
        const templates = (res.body && (res.body.items || res.body)) || [];
        expect(templates.length, '🔒 O canal oficial não tem template (massa)').to.be.greaterThan(0);
        exigirOpcoes('root-0', 'template-id', templates.map((tpl) => String(tpl.id)));
      });

      AutomacoesPage.elements.campoPasso('root-0', 'template-id').find('option').eq(1).then(($o) => {
        AutomacoesPage.elements.campoPasso('root-0', 'template-id').select($o.val());
      });
      AutomacoesPage.elements.campoPasso('root-0', 'template-text').should('be.visible').and('have.value', '');
      ['client-name', 'client-id', 'attendance-id', 'message-text', 'store-id'].forEach((variavel) => {
        AutomacoesPage.elements.campoPasso('root-0', `template-text-placeholder-${variavel}`).should('exist');
      });
      AutomacoesPage.elements.campoPasso('root-0', 'template-text-placeholder-client-name').scrollIntoView().should('be.visible').click();
      AutomacoesPage.elements.campoPasso('root-0', 'template-text').invoke('val').should('match', /\{\{[^}]+\}\}/);
    });

    it('4.19 deve listar no passo Mudar substatus os substatus da loja e a opção "Limpar substatus"', () => {
      cy.intercept('GET', '**/attendance-custom-statuses*').as('getSubstatusPasso');
      AutomacoesPage.adicionarPasso('root', 0, 'set-custom-status');
      AutomacoesPage.abrirPasso('root-0');

      cy.wait('@getSubstatusPasso').its('response').then((res) => {
        expect(res.statusCode, 'Status da lista de substatus').to.eq(200);
        const substatus = (res.body && (res.body.items || res.body)) || [];
        expect(substatus.length, '🔒 A loja não tem substatus (massa)').to.be.greaterThan(0);
        exigirOpcoes('root-0', 'custom-status-id', substatus.map((st) => String(st.id)));
      });
      AutomacoesPage.elements.campoPasso('root-0', 'custom-status-id').find('option[value="null"]').should('have.text', 'Limpar substatus');
    });

    it('4.20 deve começar o passo Atribuir em Rodízio com o seletor de grupo e, no modo específico, listar os atendentes do grupo escolhido', () => {
      AutomacoesPage.adicionarPasso('root', 0, 'assign-attendance');
      AutomacoesPage.abrirPasso('root-0');

      AutomacoesPage.elements.campoPasso('root-0', 'assign-mode').should('have.value', 'round_robin');
      AutomacoesPage.elements.campoPasso('root-0', 'group-id').find('option').should('have.length.greaterThan', 1);
      AutomacoesPage.elements.campoPasso('root-0', 'agent-id').should('not.exist');

      AutomacoesPage.elements.campoPasso('root-0', 'group-id').find('option').eq(1).then(($o) => {
        const grupoId = $o.val();
        cy.intercept('GET', `**/attendance-groups/${grupoId}/agents*`).as('getAtendentesDoGrupo');
        AutomacoesPage.elements.campoPasso('root-0', 'group-id').select(grupoId);
        AutomacoesPage.elements.campoPasso('root-0', 'assign-mode').select('specific');

        cy.wait('@getAtendentesDoGrupo').its('response').then((res) => {
          expect(res.statusCode, `Status dos atendentes do grupo ${grupoId}`).to.eq(200);
          const atendentes = (res.body && (res.body.agents || res.body.items)) || [];
          expect(atendentes.length, `🔒 O grupo ${grupoId} não tem atendente (massa)`).to.be.greaterThan(0);
          exigirOpcoes('root-0', 'agent-id', atendentes.map((a) => String(a.agent_id || a.id)), 'members');
        });
      });
    });

    it('4.21 deve mostrar no cabeçalho do gatilho o selo "1×/24h" com o limite de 24 horas por cliente, e escondê-lo com 0 e com um limite inválido', () => {
      // ROADMAP.md P1-59, parte 5: o selo vem do TriggerCard (front `replyCooldownHours`): só com limite inteiro de 1 a 168 horas. Sem gravar.
      AutomacoesPage.elements.cabecalhoGatilho().should('not.contain.text', '×/');

      AutomacoesPage.elements.inputCooldown().clear().type('24');
      AutomacoesPage.elements.cabecalhoGatilho().should('contain.text', '1×/24h');

      AutomacoesPage.elements.inputCooldown().clear().type('0');
      AutomacoesPage.elements.cabecalhoGatilho().should('not.contain.text', '×/');

      AutomacoesPage.elements.inputCooldown().clear().type('169');
      AutomacoesPage.elements.cabecalhoGatilho().should('not.contain.text', '×/');
    });
  });

  // -------------------------------------------------------------
  // 5. VALIDAÇÃO DE ATIVAÇÃO (API REAL, SEM GRAVAR)
  // -------------------------------------------------------------
  context('5. Validação do Construtor: o que Bloqueia Ativar e Salvar, com o Erro no Passo Certo (Issue front#605)', () => {

    // Front contra a API real, sem gravar: a validação do front barra o save antes de qualquer requisição, então cada teste confirma que nenhum POST saiu.
    // Automação ativa passa por todas as regras; rascunho pausado só barra o estrutural (limites, passo indisponível, aninhamento, rodízio sem grupo, canais).
    let originalUseMocksState;

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', false);
    });

    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    beforeEach(() => {
      AutomacoesMocks.interceptAutomationCreateApi();
      AutomacoesPage.visitar();
      AutomacoesPage.abrirNova();
      AutomacoesPage.elements.inputNome().type(nome('validacao'));
    });

    afterEach(() => {
      cy.get('@postAutomation.all').should('have.length', 0);
    });

    it('5.1 deve barrar ativar sem nenhum passo, avisar no toast e listar a pendência no painel', () => {
      // Act
      AutomacoesPage.elements.switchAtiva().click();
      AutomacoesPage.elements.botaoSalvar().click();

      // Assert
      AutomacoesPage.elements.toast('warning').should('contain.text', 'Adicione ao menos um passo.');
      AutomacoesPage.elements.tituloPainelPendencias().should('be.visible');
    });

    it('5.2 deve barrar ativar o gatilho Palavra-chave sem nenhuma palavra', () => {
      // Arrange
      AutomacoesPage.escolherGatilho('keyword_match');
      AutomacoesPage.adicionarPasso('root', 0, 'send-message');
      AutomacoesPage.escreverTextoDoPasso('root-0', 'Olá');

      // Act
      AutomacoesPage.elements.switchAtiva().click();
      AutomacoesPage.elements.botaoSalvar().click();

      // Assert
      AutomacoesPage.elements.toast('warning').should('contain.text', 'Informe ao menos uma palavra-chave.');
    });

    it('5.3 deve barrar ativar com mensagem sem texto e apontar o passo exato, abrindo-o ao clicar na pendência', () => {
      // Arrange: passo recém-criado, texto vazio
      AutomacoesPage.adicionarPasso('root', 0, 'send-message');
      AutomacoesPage.elements.cabecalhoPasso('root-0').click(); // fecha o passo

      // Act
      AutomacoesPage.elements.switchAtiva().click();
      AutomacoesPage.elements.botaoSalvar().click();

      // Assert: a pendência aponta o caminho do passo e leva até ele
      AutomacoesPage.elements.toast('warning').should('contain.text', 'Escreva o texto da mensagem.');
      AutomacoesPage.elements.pendencia('root-0', 'text-required').scrollIntoView().should('be.visible').click();
      AutomacoesPage.elements.cabecalhoPasso('root-0').should('have.attr', 'aria-expanded', 'true');
    });

    it('5.4 deve limitar o nome a 125 caracteres e a descrição a 500 já no campo', () => {
      // Assert
      AutomacoesPage.elements.inputNome().should('have.attr', 'maxlength', '125');
      AutomacoesPage.elements.inputDescricao().should('have.attr', 'maxlength', '500');
      AutomacoesPage.elements.inputNome().clear().type('x'.repeat(130), { delay: 0 });
      AutomacoesPage.elements.inputNome().invoke('val').should('have.length', 125);
    });

    it('5.5 deve barrar ativar com o limite de resposta por cliente fora de 0 a 168 horas', () => {
      // Arrange
      AutomacoesPage.adicionarPasso('root', 0, 'send-message');
      AutomacoesPage.escreverTextoDoPasso('root-0', 'Olá');
      AutomacoesPage.elements.inputCooldown().should('have.attr', 'min', '0').and('have.attr', 'max', '168');

      // Act
      AutomacoesPage.elements.inputCooldown().clear().type('169');
      AutomacoesPage.elements.switchAtiva().click();
      AutomacoesPage.elements.botaoSalvar().click();

      // Assert
      AutomacoesPage.elements.toast('warning').should('contain.text', 'O limite por cliente vai de 0 a 168 horas, em número inteiro.');
    });

    it('5.6 deve barrar até o rascunho com rodízio sem grupo, que o servidor também recusa', () => {
      // Arrange: passo Transferir com modo rodízio e nenhum grupo escolhido
      AutomacoesPage.adicionarPasso('root', 0, 'assign-attendance');
      AutomacoesPage.elements.campoPasso('root-0', 'assign-mode').select('round_robin');

      // Act: salvar como rascunho (sem ativar)
      AutomacoesPage.elements.botaoSalvar().click();

      // Assert
      AutomacoesPage.elements.toast('warning').should('contain.text', 'Escolha o grupo do rodízio.');
    });

    it('5.7 deve barrar ativar com espera acima de 30 dias e apontar a quantidade do passo (Issue backend#742, front#671)', () => {
      // Arrange: passo Esperar com 31 dias (o teto é 30 dias, o mesmo do servidor: 43200 minutos)
      AutomacoesPage.adicionarPasso('root', 0, 'wait');
      AutomacoesPage.elements.campoPasso('root-0', 'wait-unit').select('days');
      AutomacoesPage.elements.campoPasso('root-0', 'wait-amount').clear().type('31');

      // Act
      AutomacoesPage.elements.switchAtiva().click();
      AutomacoesPage.elements.botaoSalvar().click();

      // Assert: o aviso, a pendência do passo e o campo marcado como inválido
      AutomacoesPage.elements.toast('warning').should('contain.text', 'A espera pode ser de até 30 dias.');
      AutomacoesPage.elements.pendencia('root-0', 'wait-too-long').scrollIntoView().should('be.visible');
      AutomacoesPage.elements.campoPasso('root-0', 'wait-amount').should('have.attr', 'aria-invalid', 'true');
    });

    it('5.8 deve barrar ativar o webhook com URL http, com credencial, de rede interna ou com host dinâmico e com corpo fora da allowlist ou que não é JSON, apontando a pendência do passo (Issue backend#745, front#672)', () => {
      // Os mesmos códigos que o servidor devolve (0-D ctx 4): o front barra antes, como defesa em profundidade; o afterEach exige que nenhum POST saia
      const casos = [
        ['http://example.com/hook', '', 'A URL precisa começar com https://.', 'webhook-url-invalid'],
        ['https://u:p@example.com/hook', '', 'A URL não pode ter usuário e senha.', 'webhook-url-credentials'],
        ['https://127.0.0.1/hook', '', 'A URL aponta para a rede interna. Use um endereço público.', 'webhook-url-internal'],
        ['https://localhost/hook', '', 'A URL aponta para a rede interna. Use um endereço público.', 'webhook-url-internal'],
        ['https://{{client.id}}.example.com/hook', '', 'O endereço (host e porta) não pode ter placeholder.', 'webhook-url-dynamic-host'],
        ['https://example.com/hook', '{"n":"{{client.name}}"}', 'client.name não pode sair por webhook: só ids.', 'webhook-placeholder-not-allowed'],
        ['https://example.com/hook', '{"a": ', 'O corpo precisa ser um JSON válido.', 'webhook-body-invalid'],
      ];

      // Arrange
      AutomacoesPage.adicionarPasso('root', 0, 'send-webhook');
      AutomacoesPage.elements.switchAtiva().click();

      casos.forEach(([url, corpo, mensagem, codigo]) => {
        // Act
        AutomacoesPage.preencherWebhook('root-0', url, corpo);
        AutomacoesPage.elements.botaoSalvar().click();

        // Assert: o aviso traduzido e a pendência do passo com o código do caso, e só ela
        AutomacoesPage.elements.toast('warning').should('contain.text', mensagem);
        AutomacoesPage.elements.pendencia('root-0', codigo).should('exist');
        cy.get('[data-testid^="automation-issue-root-0-"]').should('have.length', 1);
      });
    });

    it('5.9 deve barrar até o rascunho quando o texto do passo passa de 7000 caracteres só depois de codificar os emojis, com a pendência no passo', () => {
      // ROADMAP.md P1-59, parte 6: o teto de 7000 vale para o config do passo já com o emoji codificado como `{{e:HEX}}` (front `automationLimits.rules`, developer).
      // 6950 letras + 10 emojis: cru, o config `{"text":"…"}` tem ~6990 caracteres; codificado (😀 → `{{e:1F600}}`, +9 cada), passa de 7000.
      const texto = 'a'.repeat(6950) + ' 😀'.repeat(10);
      expect(JSON.stringify({ text: texto }).length, 'config cru cabe no teto').to.be.at.most(7000);
      expect(JSON.stringify({ text: texto.replace(/😀/g, '{{e:1F600}}') }).length, 'config codificado passa do teto').to.be.greaterThan(7000);

      AutomacoesPage.adicionarPasso('root', 0, 'send-message');
      AutomacoesPage.abrirPasso('root-0');
      // Setter nativo + evento input: o React só aceita assim um texto desse tamanho sem digitar letra por letra
      AutomacoesPage.elements.campoPasso('root-0', 'text').then(($t) => {
        const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf($t[0]), 'value').set;
        setter.call($t[0], texto);
        $t[0].dispatchEvent(new Event('input', { bubbles: true }));
      });
      AutomacoesPage.elements.campoPasso('root-0', 'text').invoke('val').its('length').should('eq', texto.length);

      AutomacoesPage.elements.botaoSalvar().click();

      AutomacoesPage.elements.pendencia('root-0', 'config-too-long').scrollIntoView().should('be.visible');
      cy.location('pathname').should('eq', '/automacoes/nova');
    });
  });

  // -------------------------------------------------------------
  // 6. EDIÇÃO CONCORRENTE E ERROS DO SERVIDOR AO SALVAR (100% MOCKADO)
  // -------------------------------------------------------------
  context('6. Construtor de Automações: Edição Concorrente (409), Recusa do Servidor (422), Avisos e Automação Inexistente (Issue front#605)', () => {

    // 100% mockado [R-BLIND]: a dev não produz sob demanda o conflito de edição (precisaria de duas sessões salvando no mesmo instante), a recusa do servidor depois de o front aprovar
    // nem os avisos do 200. Os corpos nascem do formato medido na dev em 2026-11-05: o 409 responde `code: AUTOMATION_CHANGED`, o 422 responde `issues: [{ path, message, code }]` e o ack do PATCH
    // traz `{ automation, warnings }`. O detalhe mockado é uma automação pausada de palavra-chave com 1 passo de mensagem.
    let originalUseMocksState;
    const ID = 9001;

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
    });

    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    const prepararMocks = (detalhe = { automation: AutomacoesMocks.detalhe() }, statusDetalhe = 200) => {
      RecursosMocks.interceptResources({ automation: true });
      AutomacoesMocks.interceptAutomationCapabilitiesApi();
      AutomacoesMocks.interceptAutomationsListApi({ data: [AutomacoesMocks.itemDaLista()] });
      AutomacoesMocks.interceptAutomationDetailApi(ID, detalhe, statusDetalhe);
      cy.reload();
      AutomacoesPage.visitar();
    };

    const abrirConstrutorMockado = () => {
      prepararMocks();
      AutomacoesPage.abrirEdicao(ID);
    };

    // Altera o nome (sujando o rascunho) e clica em Salvar
    const editarNomeESalvar = (novoNome) => {
      AutomacoesPage.elements.inputNome().clear().type(novoNome);
      AutomacoesPage.elements.botaoSalvar().click();
    };

    it('6.1 deve abrir o diálogo "Outra pessoa salvou esta automação" no 409 sem toast e manter o rascunho ao escolher Continuar editando', () => {
      // Arrange
      abrirConstrutorMockado();
      AutomacoesMocks.interceptAutomationUpdateApi(ID, AutomacoesMocks.corpoConflito, 409);

      // Act
      editarNomeESalvar('Nome do meu rascunho');

      // Assert
      cy.wait('@patchAutomation').its('response.statusCode').should('eq', 409);
      AutomacoesPage.elements.dialogo('automation-conflict').should('be.visible').and('contain.text', 'Outra pessoa salvou esta automação');

      // Act: continuar editando
      AutomacoesPage.elements.dialogoCancelar('automation-conflict').click();

      // Assert: o diálogo fecha e o rascunho fica. O 409 é pergunta, não erro: nenhum toast. (O texto do diálogo diz que salvar fica bloqueado até recarregar, mas o
      // front só fecha o diálogo e um segundo Salvar manda outro PATCH com o updated_at velho: o servidor recusa de novo, nada é sobrescrito. Divergência de texto: ROADMAP P1-57.)
      AutomacoesPage.elements.dialogo('automation-conflict').should('not.exist');
      AutomacoesPage.elements.inputNome().should('have.value', 'Nome do meu rascunho');
      AutomacoesPage.elements.toast('critical').should('not.exist');
    });

    it('6.2 deve descartar o rascunho e reler a automação do servidor ao escolher Recarregar no diálogo do 409', () => {
      // Arrange
      abrirConstrutorMockado();
      AutomacoesMocks.interceptAutomationUpdateApi(ID, AutomacoesMocks.corpoConflito, 409);
      editarNomeESalvar('Nome que será descartado');
      AutomacoesPage.elements.dialogo('automation-conflict').should('be.visible');

      // Act
      AutomacoesPage.elements.dialogoConfirmar('automation-conflict').click();

      // Assert: volta ao que o servidor tem e refaz o GET do detalhe
      AutomacoesPage.elements.dialogo('automation-conflict').should('not.exist');
      AutomacoesPage.elements.inputNome().should('have.value', 'Automação de exemplo');
      cy.get('@getAutomationDetail.all').should('have.length.at.least', 2);
    });

    it('6.3 deve mostrar no toast a mensagem traduzida do primeiro problema do 422 e abrir o passo do caminho apontado', () => {
      // Arrange
      abrirConstrutorMockado();
      AutomacoesMocks.interceptAutomationUpdateApi(ID, AutomacoesMocks.corpoRejeitado([
        { path: 'steps.0.step_config.text', message: 'Mensagem do servidor', code: 'text_required' },
        { path: 'name', message: 'Segundo problema', code: 'name_required' }
      ]), 422);

      // Act
      editarNomeESalvar('Nome válido');

      // Assert: só o primeiro problema, no texto do locale, e o passo do caminho abre
      cy.wait('@patchAutomation').its('response.statusCode').should('eq', 422);
      AutomacoesPage.elements.toast('critical').should('contain.text', 'Escreva o texto da mensagem.').and('not.contain.text', 'Segundo problema');
      AutomacoesPage.elements.cabecalhoPasso('root-0').should('have.attr', 'aria-expanded', 'true');
    });

    it('6.4 deve mostrar o problema do 422 fora de passo com a área "Nome da automação" no toast', () => {
      // Arrange
      abrirConstrutorMockado();
      AutomacoesMocks.interceptAutomationUpdateApi(ID, AutomacoesMocks.corpoRejeitado([
        { path: 'name', message: 'Mensagem do servidor', code: 'name_required' }
      ]), 422);

      // Act
      editarNomeESalvar('Nome válido');

      // Assert
      AutomacoesPage.elements.toast('critical').should('contain.text', 'Dê um nome à automação.').and('contain.text', 'Nome da automação');
    });

    it('6.5 deve salvar com sucesso e mostrar o aviso service_window_risk preso ao passo, sem toast de aviso', () => {
      // Arrange
      abrirConstrutorMockado();
      AutomacoesMocks.interceptAutomationUpdateApi(ID, {
        automation: AutomacoesMocks.detalhe({ name: 'Nome salvo', updated_at: '2026-11-05T12:30:00.000Z' }),
        warnings: [{ path: 'steps.0.step_config.text', message: 'Mensagem do servidor', code: 'service_window_risk' }]
      }, 200);

      // Act
      editarNomeESalvar('Nome salvo');

      // Assert: salvou, o aviso mora no passo e não há toast de aviso
      cy.wait('@patchAutomation').its('response.statusCode').should('eq', 200);
      AutomacoesPage.elements.toast('success').should('contain.text', 'Automação salva');
      AutomacoesPage.abrirPasso('root-0');
      AutomacoesPage.elements.avisosPasso('root-0').should('contain.text', 'Fora da janela de 24h só passa modelo aprovado. Use "Enviar modelo".');
      AutomacoesPage.elements.toast('warning').should('not.exist');
    });

    it('6.6 deve mostrar "Automação não encontrada." no construtor quando o detalhe responde 404', () => {
      // Arrange
      prepararMocks({ message: 'Automação não encontrada.' }, 404);

      // Act: o cartão ainda está na lista (ex.: excluída em outra aba depois de listar)
      AutomacoesPage.elements.cartaoEditar(ID).click();

      // Assert
      AutomacoesPage.elements.estadoConstrutor('notFound').should('be.visible').and('contain.text', 'Automação não encontrada.');
      AutomacoesPage.elements.construtor().should('not.exist');
    });

    // P1-59, parte 10 (front `useAutomationListActions` e `useAutomationPersist`, developer, lidos em 2026-11-06): o 422 do duplicar mostra o motivo do servidor no toast,
    // o 5xx mostra a frase da ação, e a criação que passa dos 15 s do fetch (`DEFAULT_FETCH_TIMEOUT_MS`) avisa que a automação pode ter sido criada.
    it('6.7 deve mostrar no toast o motivo do servidor quando duplicar uma automação é recusado com 422', () => {
      const MOTIVO = 'O canal 99 não existe mais.';
      prepararMocks();
      AutomacoesMocks.interceptAutomationDuplicateApi(ID, { message: MOTIVO, issues: [{ path: 'channel_ids[0]', message: MOTIVO, code: 'channel_invalid' }] }, 422);

      AutomacoesPage.elements.cartaoMenu(ID).scrollIntoView().click();
      AutomacoesPage.elements.cartaoDuplicar(ID).click();

      cy.wait('@postAutomationDuplicate');
      AutomacoesPage.elements.toast('critical').should('contain.text', MOTIVO);
      AutomacoesPage.elements.toast('success').should('not.exist');
    });

    it('6.8 deve mostrar "Não foi possível duplicar a automação." quando duplicar falha com 500', () => {
      prepararMocks();
      AutomacoesMocks.interceptAutomationDuplicateApi(ID, { status: 500, error: 'Internal Server Error', message: 'internal error' }, 500);

      AutomacoesPage.elements.cartaoMenu(ID).scrollIntoView().click();
      AutomacoesPage.elements.cartaoDuplicar(ID).click();

      cy.wait('@postAutomationDuplicate');
      AutomacoesPage.elements.toast('critical').should('contain.text', 'Não foi possível duplicar a automação.').and('not.contain.text', 'internal error');
    });

    it('6.9 deve avisar que a automação pode ter sido criada quando a criação passa do tempo limite de 15 s, sem sair da tela de criação', () => {
      prepararMocks();
      // A resposta chega depois dos 15 s do fetch do front: ele aborta e trata como timeout
      AutomacoesMocks.interceptAutomationCreateApiLenta(16000);
      AutomacoesPage.abrirNova();
      AutomacoesPage.elements.inputNome().type('Criação lenta E2E');
      AutomacoesPage.adicionarPasso('root', 0, 'send-message');
      AutomacoesPage.escreverTextoDoPasso('root-0', 'Olá');

      AutomacoesPage.elements.botaoSalvar().click();

      AutomacoesPage.elements.toast('warning', { timeout: 25000 }).should('contain.text', 'A conexão demorou e a automação pode ter sido criada. Confira a lista antes de salvar de novo.');
      cy.location('pathname').should('eq', '/automacoes/nova');
    });
  });

  // -------------------------------------------------------------
  // 7. HISTÓRICO COM UM RUN REAL DO MOTOR (API REAL)
  // -------------------------------------------------------------
  context('7. Histórico de Execuções com um Run Real do Motor: Situação, Passos e Motivo da Falha (Issue backend#741)', () => {

    // Front contra a API real, com um run de verdade (backend#741): o before cria uma automação ativa que dispara num substatus exclusivo dos testes
    // (`garantirStatusPersonalizado`, ninguém mais o usa), reabre um atendimento Finalizado do próprio operador com a janela de 24h vencida (3 → 1, grant 562),
    // põe o substatus, espera o log do motor (~30 s) e devolve o atendimento a 3. O `send_message` falha com a janela fechada (nada vai ao WhatsApp) e o passo
    // seguinte limpa o substatus, então o run fica Parcial. Sem atendimento assim na rodada, o teste pula. Mesma receita do `0-D` ctx 2, que roda em paralelo
    // no matrix do CI: gatilho próprio (sufixo "8") e só atendimento de id ímpar (o 0-D fica com os pares). Achado de 2026-11-06 (aba-c): juntos, colidiam.
    const TIMEOUT_ROTA = { timeout: 90000 };
    const ESPERA_DO_MOTOR_MS = 180000;
    const semEspaco = (texto) => String(texto || '').replace(/\s+/g, '').toUpperCase();
    let originalUseMocksState;
    let automacao = null;
    let atendimento = null;
    let log = null;

    const statusDoAtendimento = (id) => cy.then(() => api.obterDetalheAtendimento(null, id, TIMEOUT_ROTA)).then((res) => {
      const att = res.body.attendance || res.body;
      const janela = att.service_window ? att.service_window.expires_at : null;
      return { status: att.status, substatus: (att.custom_status && att.custom_status.id) ?? null, canal: att.channel || {}, janelaVencida: !!janela && new Date(janela).getTime() < Date.now() };
    });
    const esperarLog = (inicio = Date.now()) => cy.then(() => api.listarExecucoesAutomacao(automacao.id, 1, TIMEOUT_ROTA)).then((res) => {
      const doAtendimento = (res.body.data || []).filter((l) => l.attendance_id === atendimento);
      if (doAtendimento.length || Date.now() - inicio > ESPERA_DO_MOTOR_MS) {
        log = doAtendimento[0] || null;
        return;
      }
      cy.wait(10000);
      esperarLog(inicio);
    });

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', false);
      api.autenticar();

      // Arrange: atendimento Finalizado do operador, no canal oficial, com a janela vencida e sem substatus
      cy.then(() => api.obterUsuarioLogado(TIMEOUT_ROTA)).then((resMe) => api.listarAtendimentos(null, { status: 'finished', page: 1, per_page: 100 }, TIMEOUT_ROTA).then((resFila) => {
        const meus = (resFila.body.items || []).filter((a) => semEspaco(a.attendant_name) === semEspaco(resMe.body.display_name)).slice(0, 15);
        const procurar = (i) => {
          if (i >= meus.length) return;
          return statusDoAtendimento(meus[i].id).then((att) => {
            if (meus[i].id % 2 === 1 && att.status === 3 && att.substatus === null && att.canal.type === 1 && att.canal.subtype === 1 && att.janelaVencida) {
              atendimento = meus[i].id;
              return;
            }
            return procurar(i + 1);
          });
        };
        return procurar(0);
      }));

      // Arrange: a automação ativa no substatus exclusivo — mensagem (falha com a janela fechada) e limpar o substatus (sucesso)
      cy.then(() => {
        if (!atendimento) return;
        return api.garantirStatusPersonalizado('[Cypress] Gatilho de automações 8', 1, TIMEOUT_ROTA).then((gatilho) => {
          criarTemporaria('historico', {
            trigger_type: 'attendance_status_changed',
            trigger_config: { custom_status_id: gatilho.id },
            is_active: true,
            steps: [
              { step_type: 'send_message', step_config: { text: `Teste automatizado ${TOKEN}` } },
              { step_type: 'set_custom_status', step_config: { custom_status_id: null } },
            ],
          }).then((a) => { automacao = a; });

          // Act: reabre, põe o substatus gatilho, espera o run e devolve o atendimento a Finalizado
          cy.then(() => api.atualizarStatusAtendimento(null, atendimento, { status: 1 }, TIMEOUT_ROTA)).its('status').should('eq', 200);
          cy.then(() => api.atualizarStatusAtendimento(null, atendimento, { custom_status_id: gatilho.id }, TIMEOUT_ROTA)).its('status').should('eq', 200);
          esperarLog();
          cy.then(() => api.atualizarStatusAtendimento(null, atendimento, { status: 3 }, TIMEOUT_ROTA)).its('status').should('eq', 200);
        });
      });
    });

    after(() => {
      limparTemporarias();
      if (atendimento) {
        statusDoAtendimento(atendimento).then((agora) => {
          if (agora.status !== 3) api.atualizarStatusAtendimento(null, atendimento, { status: 3 }, TIMEOUT_ROTA);
        });
      }
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    it('7.1 deve mostrar o run real como Parcial, com o atendimento e os passos, e abrir o detalhe com o passo que falhou fora da janela de 24h e o que rodou depois', function () {
      if (!atendimento) {
        cy.log('⏭️ Sem massa: nenhum atendimento Finalizado do operador no canal oficial com a janela de 24h vencida');
        this.skip();
      }
      expect(log, `Run do motor para o atendimento ${atendimento} (o motor confere os eventos a cada 30 s)`).to.be.an('object');
      expect(log.status, 'Situação gravada pelo motor').to.eq('partial');

      // Arrange: abre o histórico pelo cartão da automação
      AutomacoesMocks.interceptAutomationsListApi();
      AutomacoesMocks.interceptAutomationLogsApi(automacao.id);
      AutomacoesPage.visitar();
      cy.wait('@getAutomationsList');
      AutomacoesPage.buscar(TOKEN);
      AutomacoesPage.elements.cartaoExecucoes(automacao.id).click();
      cy.wait('@getAutomationLogs').its('response.statusCode').should('eq', 200);

      // Assert: a linha do run
      AutomacoesPage.elements.linhaExecucao(log.id).should('be.visible').and('contain.text', `Atendimento ${atendimento}`);
      AutomacoesPage.elements.linhaExecucao(log.id).find('td').eq(3).should('have.text', '2');
      AutomacoesPage.elements.botaoExecucao(log.id).should('have.attr', 'aria-expanded', 'false').find('[data-tone]').should('have.attr', 'data-tone', 'orange').and('have.text', 'Parcial');

      // Act + Assert: o detalhe com o passo que falhou e o que rodou depois
      AutomacoesPage.elements.botaoExecucao(log.id).click();
      AutomacoesPage.elements.botaoExecucao(log.id).should('have.attr', 'aria-expanded', 'true');
      AutomacoesPage.elements.passosExecucao(log.id).should('have.length', 2);
      AutomacoesPage.elements.passosExecucao(log.id).eq(0).should('have.attr', 'data-status', 'failed').and('contain.text', 'Enviar mensagem').and('contain.text', 'fora da janela de 24h');
      AutomacoesPage.elements.passosExecucao(log.id).eq(1).should('have.attr', 'data-status', 'success').and('contain.text', 'passo 2');

      // Act + Assert: o run Parcial sai em "Com problema" e não em "Sucesso"
      AutomacoesPage.elements.filtroExecucoes('success').click();
      AutomacoesPage.elements.linhaExecucao(log.id).should('not.exist');
      AutomacoesPage.elements.filtroExecucoes('problem').click();
      AutomacoesPage.elements.linhaExecucao(log.id).should('be.visible');
    });
  });
});
