import AtendimentosPage from '../pages/5.atendimentosPage';
import AtendimentosMocks from '../mocks/5.atendimentosMocks';
import IniciarAtendimentoMocks from '../mocks/4.iniciarAtendimentoMocks';
import IniciarAtendimentoPage from '../pages/4.iniciarAtendimentoPage';
import RecursosMocks from '../mocks/1.recursosMocks';
import ClientesPage from '../pages/7.clientesPage';
import ClientesMocks from '../mocks/7.clientesMocks';
import api from '../services/backendApiService';
import ReceitasPage from '../pages/6.receitasPage';
import ReceitasMocks from '../mocks/6.receitasMocks';
import AutomacoesPage from '../pages/8.automacoesPage';
import AutomacoesMocks from '../mocks/8.automacoesMocks';
const configEnv = require('../../env.json');
import { regexApi } from '../support/rotaApi';

// Aproveita as variáveis globais configuradas no env.json / commands.js
const CELULAR_PADRAO = Cypress.env('DEFAULT_CELULAR') || configEnv.DEFAULT_CELULAR || '11999998888';

describe('1. Permissões - Validação de Acessos', () => {

  /**
   * Valida o duplo grau de permissão com coerência bidirecional de RBAC:
   * - Se esperaAtivo === true (Caminho Feliz / Concessão):
   *   Exige que o payload seja TRUE e que o elemento esteja HABILITADO na interface.
   * - Se esperaAtivo === false (Caminho Contrário / Bloqueio):
   *   Exige que quando a capability for FALSE, o elemento esteja BLOQUEADO/OCULTO no front.
   *   Se a capability for FALSE e o front continuar com o recurso habilitado, lança erro de VAZAMENTO DE RBAC no front!
   * Compartilhado entre todos os contexts deste arquivo (Atendimentos e Clientes).
   */
  function validarDuploGrauPermissao({
    codigo,
    capability,
    payloadValido,
    frontValido,
    esperaAtivo = true,
    mensagemSucesso = 'Permissão confirmada com sucesso no payload e na interface.',
    mensagemFalhaFront = 'Elemento de interface não renderizou como esperado.',
    mensagemFalhaVazamento = 'Recurso permaneceu habilitado/visível no frontend mesmo com a permissão desativada no contrato!'
  }) {
    const logs = [];

    if (esperaAtivo) {
      // -----------------------------------------------------------------
      // 1. CAMINHO FELIZ (Expectativa: Recurso Concedido e Ativo na UI)
      // -----------------------------------------------------------------
      if (payloadValido) {
        Cypress.log({ name: 'DUPLO_GRAU', message: `✅ [PAYLOAD OK] Permissão ${codigo} (${capability}) === true` });
      } else {
        logs.push(`❌ [FALHA NO PAYLOAD - PERMISSÃO ${codigo}]: A capability '${capability}' não retornou 'true' no contrato da API.`);
      }

      if (frontValido) {
        Cypress.log({ name: 'DUPLO_GRAU', message: `✅ [FRONT OK] Permissão ${codigo}: ${mensagemSucesso}` });
      } else {
        logs.push(`❌ [FALHA NO FRONT - PERMISSÃO ${codigo}]: ${mensagemFalhaFront}`);
      }

      const aprovado = Boolean(payloadValido && frontValido);
      expect(aprovado, logs.join(' | ') || `Permissão ${codigo} aprovada em ambos os graus`).to.be.true;
    } else {
      // -----------------------------------------------------------------
      // 2. CAMINHO CONTRÁRIO (Expectativa: Recurso Revogado e Bloqueado na UI)
      // -----------------------------------------------------------------
      if (!payloadValido) {
        Cypress.log({ name: 'DUPLO_GRAU', message: `✅ [PAYLOAD BLOQUEADO] Permissão ${codigo} (${capability}) === false` });
      } else {
        logs.push(`⚠️ [AVISO]: O payload retornou true quando a expectativa do teste de bloqueio era false.`);
      }

      if (!frontValido) {
        Cypress.log({ name: 'DUPLO_GRAU', message: `✅ [FRONT BLOQUEADO OK] Permissão ${codigo}: Recurso desabilitado/oculto corretamente na interface.` });
      } else {
        // Flag de Bug Grave no Frontend (Vazamento de RBAC)
        logs.push(`🚨 [BUG GRAVE NO FRONTEND - VAZAMENTO DE RBAC - PERMISSÃO ${codigo}]: A capability '${capability}' é FALSE no backend, mas o frontend continuou exibindo/habilitando o recurso indevidamente! ${mensagemFalhaVazamento}`);
      }

      const bloqueioConforme = Boolean(!payloadValido && !frontValido);
      expect(bloqueioConforme, logs.join(' | ') || `Permissão ${codigo} bloqueada com sucesso em ambos os graus`).to.be.true;
    }
  }

  // ---------------------------------------------------------------------------------
  // CONTEXTO 1: PERMISSÕES DO ATENDIMENTO
  // ---------------------------------------------------------------------------------
  context('1. Atendimentos - Permissões', () => {

    let abortSuite = false;

    /**
     * Helper resiliente para obter o mapa de capabilities da loja.
     * Suporta cache em memória, modo mock (fixtures) e consulta direta via API com token do sessionStorage.
     */
    function obterCapabilitiesLoja() {
      return cy.then(() => {
        const cached = Cypress.env('LAST_ATTENDANCE_CAPABILITIES');
        if (cached && Object.keys(cached).length > 0 && cached.can_access_attendance_module !== undefined) {
          return cached;
        }

        const isMock = Cypress.env('USE_MOCKS') === true || configEnv.USE_MOCKS === true;
        if (isMock) {
          return cy.fixture('3.central/attendance_capabilities.json').then((fix) => {
            const caps = fix.capabilities || fix;
            Cypress.env('LAST_ATTENDANCE_CAPABILITIES', caps);
            return caps;
          });
        }

        // Modo API Real: obtém diretamente via cy.request com o Bearer token do sessionStorage
        // Isso é imune a timing, streaming, gzip/brotli ou cache 304 do navegador
        return cy.window().then((win) => {
          const token = win?.sessionStorage?.getItem('omnicare_access_token') || Cypress.env('backendAuthToken');
          const apiUrl = configEnv.API_URL || 'https://api.omnicare.dev.local';

          if (token) {
            return cy.request({
              method: 'GET',
              url: `${apiUrl}/attendance-capabilities`,
              headers: {
                Authorization: `Bearer ${token}`
              },
              failOnStatusCode: false
            }).then((res) => {
              if (res.status === 200 && res.body?.capabilities) {
                Cypress.env('LAST_ATTENDANCE_CAPABILITIES', res.body.capabilities);
                return res.body.capabilities;
              }
              return Cypress.env('LAST_ATTENDANCE_CAPABILITIES') || {};
            });
          }

          // Fallback para espera de interceptação caso o token ainda não esteja acessível
          return cy.wait('@getAttendanceCapabilities', { timeout: 15000 }).then((interception) => {
            const body = interception?.response?.body;
            const bodyObj = typeof body === 'string' ? JSON.parse(body) : body;
            const caps = bodyObj?.capabilities || Cypress.env('LAST_ATTENDANCE_CAPABILITIES') || {};
            Cypress.env('LAST_ATTENDANCE_CAPABILITIES', caps);
            return caps;
          });
        });
      });
    }

    /**
     * Helper resiliente para obter o mapa de capabilities do atendimento individual (/attendances/:id/capabilities)
     */
    function obterCapabilitiesItem() {
      return cy.then(() => {
        const isMock = Cypress.env('USE_MOCKS') === true || configEnv.USE_MOCKS === true;
        if (isMock) {
          const cached = Cypress.env('LAST_ATTENDANCE_ITEM_CAPABILITIES');
          if (cached && Object.keys(cached).length > 0) {
            return cached;
          }
          return cy.fixture('5.atendimentos/attendanceCapabilities.json').then((fix) => {
            const caps = fix.capabilities || fix;
            Cypress.env('LAST_ATTENDANCE_ITEM_CAPABILITIES', caps);
            return caps;
          });
        }

        // Modo API Real: extrai o ID do atendimento ativo na URL (ex: ?attendance=260900064)
        return cy.url().then((currentUrl) => {
          const match = currentUrl.match(/attendance=(\d+)/);
          const id = match ? match[1] : null;

          return cy.window().then((win) => {
            const token = win?.sessionStorage?.getItem('omnicare_access_token') || Cypress.env('backendAuthToken');
            const apiUrl = configEnv.API_URL || 'https://api.omnicare.dev.local';

            if (token && id) {
              return cy.request({
                method: 'GET',
                url: `${apiUrl}/attendances/${id}/capabilities`,
                headers: {
                  Authorization: `Bearer ${token}`
                },
                failOnStatusCode: false
              }).then((res) => {
                if (res.status === 200 && res.body?.capabilities) {
                  return res.body.capabilities;
                }
                return Cypress.env('LAST_ATTENDANCE_ITEM_CAPABILITIES') || {};
              });
            }

            return cy.wait('@getAttendanceItemCapabilities', { timeout: 15000 }).then((interception) => {
              const body = interception?.response?.body;
              const bodyObj = typeof body === 'string' ? JSON.parse(body) : body;
              return bodyObj?.capabilities || Cypress.env('LAST_ATTENDANCE_ITEM_CAPABILITIES') || {};
            });
          });
        });
      });
    }

    beforeEach(function () {
      // Se a permissão raiz 418 falhou, ignoramos a execução dos demais testes da suíte
      if (abortSuite) {
        this.skip();
      }

      // 1. Limpa capabilities de item para evitar interferência entre testes consecutivos
      Cypress.env('LAST_ATTENDANCE_ITEM_CAPABILITIES', null);

      // 2. Efetua login primeiro para garantir a estabilidade da sessão
      cy.login();

      // 3. Intercepta chamadas essenciais com fallback de fixtures
      AtendimentosMocks.interceptUserMeApi();
      AtendimentosMocks.interceptSummaryApi();
      AtendimentosMocks.interceptAttendancesListApi();
      AtendimentosMocks.interceptAttendanceCapabilitiesApi();
      AtendimentosMocks.interceptAttendanceItemCapabilitiesApi('*');
      AtendimentosMocks.interceptAttendanceDetailApi('*');
      AtendimentosMocks.interceptMessagesListApi('*');
      AtendimentosMocks.interceptAttendanceMessageTemplatesApi('*');
      AtendimentosMocks.interceptAttendanceEventsApi();
      IniciarAtendimentoMocks.interceptarCanais();
      IniciarAtendimentoMocks.interceptarBuscaGrupos();
      IniciarAtendimentoMocks.interceptarMensagensPadrao();
      IniciarAtendimentoMocks.interceptarStandardMessageCapabilities();
      AtendimentosMocks.interceptMockAgentsGroup('*');

      // A Permissão 418 é avaliada diretamente na tela inicial "Central" após o login.
      // Portanto, só navegamos para a tela de Atendimentos se o teste atual NÃO for o da 418.
      if (!this.currentTest.title.includes('[418 - can_access_attendance_module]')) {
        AtendimentosPage.visitar();
      }
    });

    afterEach(function () {
      // Se a permissão raiz (418) falhar, disparamos a flag para pular todos os testes seguintes
      if (this.currentTest.state === 'failed' && this.currentTest.title.includes('[418 - can_access_attendance_module]')) {
        abortSuite = true;
      }
    });

    // ---------------------------------------------------------------------------------
    // Padrão de Nomenclatura: [NNN - capability] - Ação (Validação Bidirecional: Concessão & Bloqueio)
    // Sem código legado confirmado, usa só [capability] (nunca fabricar um NNN) - AGENTS.md [R-EVID].
    // ---------------------------------------------------------------------------------

    it('1.1 [418 - can_access_attendance_module] - deve ter acesso ao módulo de Atendimentos (Menu e Acesso Direto)', () => {
      // 1. Caminho Concessão (Happy Path): Com permissão 418 ativa, módulo acessível via menu e URL direta
      cy.get('body', { timeout: 10000 }).should(($body) => {
        const menuExiste = $body.find('aside').text().toLowerCase().includes('atendimentos');
        expect(menuExiste, 'Menu lateral Atendimentos deve estar visível na Central').to.be.true;
      });

      cy.visit('/atendimentos', { failOnStatusCode: false });
      cy.url().should('include', '/atendimentos');
      cy.get('h1, h2, header', { timeout: 10000 })
        .contains('Atendimentos')
        .should('be.visible');

      obterCapabilitiesLoja().then((caps) => {
        const payloadOk = caps.can_access_attendance_module === true;

        validarDuploGrauPermissao({
          codigo: 418,
          capability: 'can_access_attendance_module',
          payloadValido: payloadOk,
          frontValido: true,
          esperaAtivo: true,
          mensagemSucesso: 'Menu lateral Atendimentos visível e tela acessível por URL direta.',
          mensagemFalhaFront: 'Menu lateral Atendimentos não foi encontrado ou tela inacessível.'
        });

        // 2. Caminho Revogação (Caminho Contrário): Com permissão revogada (can_access_attendance_module: false)
        cy.then(() => {
          AtendimentosMocks.interceptAttendanceCapabilitiesApi({
            capabilities: { ...caps, can_access_attendance_module: false }
          });
          cy.visit('/', { failOnStatusCode: false });
          cy.get('body', { timeout: 10000 }).then(($body) => {
            const menuExiste = $body.find('aside').text().toLowerCase().includes('atendimentos');
            validarDuploGrauPermissao({
              codigo: 418,
              capability: 'can_access_attendance_module',
              payloadValido: false,
              frontValido: menuExiste,
              esperaAtivo: false,
              mensagemFalhaVazamento: 'Menu lateral continuou exibindo Atendimentos mesmo com a permissão 418 revogada no contrato!'
            });
          });
        });
      });
    });

    it('1.2 [636 - can_create_attendance] - deve conseguir iniciar um atendimento pelo WhatsApp', () => {
      // 1. Caminho Concessão (Happy Path)
      obterCapabilitiesLoja().then((caps) => {
        const payloadOk = caps.can_create_attendance === true;

        cy.contains('button', /iniciar atendimento/i, { timeout: 10000 })
          .should('be.visible')
          .then(($btn) => {
            const frontOk = $btn.length > 0 && !$btn.prop('disabled');

            validarDuploGrauPermissao({
              codigo: 636,
              capability: 'can_create_attendance',
              payloadValido: payloadOk,
              frontValido: frontOk,
              esperaAtivo: true,
              mensagemSucesso: 'Botão Iniciar atendimento visível e habilitado.',
              mensagemFalhaFront: 'Botão Iniciar atendimento não foi encontrado na interface.'
            });

            // 2. Caminho Revogação (Caminho Contrário): Com can_create_attendance: false, botão deve desabilitar/ocultar
            cy.then(() => {
              AtendimentosMocks.interceptAttendanceCapabilitiesApi({
                capabilities: { ...caps, can_create_attendance: false }
              });
              cy.reload();
              cy.get('body', { timeout: 10000 }).then(($body) => {
                const btnIniciar = $body.find('button:contains("Iniciar atendimento")');
                const botaoAtivo = btnIniciar.length > 0 && !btnIniciar.prop('disabled');

                validarDuploGrauPermissao({
                  codigo: 636,
                  capability: 'can_create_attendance',
                  payloadValido: false,
                  frontValido: botaoAtivo,
                  esperaAtivo: false,
                  mensagemFalhaVazamento: 'Botão Iniciar atendimento permaneceu ativo na tela mesmo com can_create_attendance: false!'
                });
              });
            });
          });
      });
    });

    it('1.3 [540 - can_view_occupied_attendance] - deve visualizar atendimentos de outras pessoas na fila', () => {
      // 1. Caminho Concessão (Happy Path)
      obterCapabilitiesLoja().then((caps) => {
        const payloadOk = caps.can_view_occupied_attendance === true;

        cy.get('section[aria-label="Attendance list"], [data-testid="attendance-queue-list"], aside', { timeout: 10000 })
          .should('be.visible')
          .then(($queue) => {
            const frontOk = $queue.length > 0;

            validarDuploGrauPermissao({
              codigo: 540,
              capability: 'can_view_occupied_attendance',
              payloadValido: payloadOk,
              frontValido: frontOk,
              esperaAtivo: true,
              mensagemSucesso: 'Fila de atendimentos renderizada e permissão de visualização ativa (can_view_occupied_attendance: true).',
              mensagemFalhaFront: 'Fila de atendimentos não foi renderizada na interface.'
            });

            // 2. Caminho Revogação (Caminho Contrário)
            cy.then(() => {
              AtendimentosMocks.interceptAttendanceCapabilitiesApi({
                capabilities: { ...caps, can_view_occupied_attendance: false }
              });
              cy.reload();
              cy.get('body', { timeout: 10000 }).then(($body) => {
                const queueExiste = $body.find('[data-testid^="attendance-queue-item-"]').length > 0;
                validarDuploGrauPermissao({
                  codigo: 540,
                  capability: 'can_view_occupied_attendance',
                  payloadValido: false,
                  frontValido: queueExiste,
                  esperaAtivo: false,
                  mensagemFalhaVazamento: 'Fila continuou exibindo atendimentos de terceiros com can_view_occupied_attendance: false!'
                });
              });
            });
          });
      });
    });

    it('1.4 [414 - can_mark_completed] - deve ter a opção de Concluir atendimento (Menu da Fila e Menu Interno)', () => {
      AtendimentosPage.elements.cardsAtendimento().first().click();
      cy.wait('@getAttendanceMessages');

      obterCapabilitiesItem().then((caps) => {
        const payloadOk = caps.can_mark_completed === true;

        // 1. Caminho Concessão: Com can_mark_completed: true, opção Concluir visível no menu
        AtendimentosPage.abrirMenuStatusCliente();
        cy.contains('div[role="menu"] button, div[role="dialog"] button, [data-testid*="status"], button', /conclu/i, { timeout: 10000 })
          .should('be.visible')
          .then(($btn) => {
            const frontOk = $btn.length > 0;

            validarDuploGrauPermissao({
              codigo: 414,
              capability: 'can_mark_completed',
              payloadValido: payloadOk,
              frontValido: frontOk,
              esperaAtivo: true,
              mensagemSucesso: 'Opção Concluir visível no menu do chat e autorizada no contrato (can_mark_completed: true).',
              mensagemFalhaFront: 'Opção Concluir não foi encontrada no menu de status.'
            });

            cy.get('body').type('{esc}');

            // 2. Caminho Revogação (Caminho Contrário): Com can_mark_completed: false, opção deve sumir
            cy.then(() => {
              AtendimentosMocks.interceptAttendanceItemCapabilitiesApi('*', {
                capabilities: { ...caps, can_mark_completed: false }
              });
              cy.reload();
              AtendimentosPage.elements.cardsAtendimento().first().click();
              cy.wait('@getAttendanceMessages');
              AtendimentosPage.abrirMenuStatusCliente();
              cy.get('body', { timeout: 10000 }).then(($body) => {
                const opcaoConcluir = $body.find('div[role="menu"] button:contains("Concluir"), [data-testid*="status"]:contains("Concluir")');
                const frontAtivo = opcaoConcluir.length > 0;

                validarDuploGrauPermissao({
                  codigo: 414,
                  capability: 'can_mark_completed',
                  payloadValido: false,
                  frontValido: frontAtivo,
                  esperaAtivo: false,
                  mensagemFalhaVazamento: 'Opção Concluir permaneceu visível no menu do cliente com can_mark_completed: false!'
                });
              });
              cy.get('body').type('{esc}');
            });
          });
      });
    });

    it('1.5 [475 - can_mark_discarded] - deve ter a opção de Descartar atendimento (Menu da Fila e Menu Interno)', () => {
      AtendimentosPage.elements.cardsAtendimento().first().click();
      cy.wait('@getAttendanceMessages');

      obterCapabilitiesItem().then((caps) => {
        const payloadOk = caps.can_mark_discarded === true;

        // 1. Caminho Concessão: Com can_mark_discarded: true, opção Descartar visível
        AtendimentosPage.abrirMenuStatusCliente();
        cy.contains('div[role="menu"] button, div[role="dialog"] button, [data-testid*="status"], button', /descart/i, { timeout: 10000 })
          .should('be.visible')
          .then(($btn) => {
            const frontOk = $btn.length > 0;

            validarDuploGrauPermissao({
              codigo: 475,
              capability: 'can_mark_discarded',
              payloadValido: payloadOk,
              frontValido: frontOk,
              esperaAtivo: true,
              mensagemSucesso: 'Opção Descartar visível no menu do chat e autorizada no contrato (can_mark_discarded: true).',
              mensagemFalhaFront: 'Opção Descartar não foi encontrada no menu de status.'
            });

            cy.get('body').type('{esc}');

            // 2. Caminho Revogação (Caminho Contrário): Com can_mark_discarded: false, opção deve sumir
            cy.then(() => {
              AtendimentosMocks.interceptAttendanceItemCapabilitiesApi('*', {
                capabilities: { ...caps, can_mark_discarded: false }
              });
              cy.reload();
              AtendimentosPage.elements.cardsAtendimento().first().click();
              cy.wait('@getAttendanceMessages');
              AtendimentosPage.abrirMenuStatusCliente();
              cy.get('body', { timeout: 10000 }).then(($body) => {
                const opcaoDescartar = $body.find('div[role="menu"] button:contains("Descartar"), [data-testid*="status"]:contains("Descartar")');
                const frontAtivo = opcaoDescartar.length > 0;

                validarDuploGrauPermissao({
                  codigo: 475,
                  capability: 'can_mark_discarded',
                  payloadValido: false,
                  frontValido: frontAtivo,
                  esperaAtivo: false,
                  mensagemFalhaVazamento: 'Opção Descartar permaneceu visível no menu do cliente com can_mark_discarded: false!'
                });
              });
              cy.get('body').type('{esc}');
            });
          });
      });
    });

    it('1.6 [557 - can_transfer_assigned_attendance] - deve ter a opção de Transferir em atendimentos de QUALQUER funcionário', () => {
      // 1. Caminho Concessão (100% Mock): Atendimento atribuído a outro atendente na fila com permissão 557 ativa
      cy.then(() => {
        AtendimentosMocks.interceptMockPermissao557({ canTransferAssigned: true, canTransferPending: false });
        cy.reload();
        AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').click();
        cy.wait('@getAttendanceMessages');

        obterCapabilitiesItem().then((caps) => {
          // Regra PR #523: A conversa pertence a outro atendente, portanto 557 é true e 649 é false
          const payloadOk = caps.can_transfer_assigned_attendance === true;
          expect(caps.can_transfer_pending_attendance, '649 deve ser false em conversa com atendente').to.be.false;

          AtendimentosPage.abrirMenuStatusCliente();
          AtendimentosPage.elements.btnMenuTransferir()
            .should('be.visible')
            .then(($btn) => {
              const frontOk = $btn.length > 0;

              validarDuploGrauPermissao({
                codigo: 557,
                capability: 'can_transfer_assigned_attendance',
                payloadValido: payloadOk,
                frontValido: frontOk,
                esperaAtivo: true,
                mensagemSucesso: 'Opção Transferir visível para atendimento atribuído a colega (can_transfer_assigned_attendance: true).',
                mensagemFalhaFront: 'Opção Transferir não foi encontrada no menu do atendimento atribuído.'
              });

              cy.get('body').type('{esc}');

              // 2. Caminho Revogação (Caminho Contrário via Mock): Sem permissão 557 (can_transfer_assigned_attendance: false)
              cy.then(() => {
                AtendimentosMocks.interceptMockPermissao557({ canTransferAssigned: false, canTransferPending: false });
                cy.reload();
                AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').click();
                cy.wait('@getAttendanceMessages');

                AtendimentosPage.abrirMenuStatusCliente();
                cy.get('body', { timeout: 10000 }).then(($body) => {
                  const btnTransferir = $body.find('[data-testid="menu-transferir"]');
                  const frontAtivo = btnTransferir.length > 0 && !btnTransferir.prop('disabled');

                  validarDuploGrauPermissao({
                    codigo: 557,
                    capability: 'can_transfer_assigned_attendance',
                    payloadValido: false,
                    frontValido: frontAtivo,
                    esperaAtivo: false,
                    mensagemSucesso: 'Opção Transferir bloqueada com sucesso para atendimento atribuído sem permissão 557.',
                    mensagemFalhaVazamento: 'Opção Transferir permaneceu visível para atendimento atribuído com can_transfer_assigned_attendance: false!'
                  });
                });
                cy.get('body').type('{esc}');
              });
            });
        });
      });
    });

    // Permissão de módulo (loja), não de item — código legado corrigido de 471 para 418 pela
    // backend#584 (Issue backend#558): a listagem de atendentes de um grupo exigia indevidamente
    // a 471 (permissão de incluir/remover atendente no grupo), bloqueando a modal de transferência
    // mesmo com can_transfer_assigned_attendance/557 concedida. Gate confirmado como client-side via
    // varredura do bundle real de app.omnicare.dev.local em 2026-09-30 (hook QC/YC do
    // TransferAttendanceModal, prop `canListGroupAgents`): com a flag false, o front nem chega a
    // chamar GET /attendance-groups/:groupId/agents — mostra direto
    // <p role="alert">{transferModalAgentsForbidden}</p> ("Você não tem permissão para listar
    // atendentes deste grupo."). AGENTS.md [R-SUITE]: teste de permissão fica aqui, não em
    // 5.atendimentos.cy.js, mesmo a tela afetada sendo a de Atendimentos.
    it('1.7 [418 - can_list_group_agents] - deve listar os atendentes do grupo na modal de transferência só com a permissão concedida (backend#584, Issue backend#558)', () => {
      cy.then(() => {
        // 1. Caminho Concessão: can_list_group_agents: true (padrão do beforeEach global) — reaproveita
        // o mock de atendimento atribuído a outro colega (557) usado no teste acima só para abrir o
        // menu "Transferir" de forma confiável; o que este teste mede é a listagem de atendentes.
        AtendimentosMocks.interceptMockPermissao557({ canTransferAssigned: true, canTransferPending: false });
        cy.reload();
        AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').click();
        cy.wait('@getAttendanceMessages');

        obterCapabilitiesLoja().then((caps) => {
          const payloadOk = caps.can_list_group_agents === true;

          AtendimentosPage.abrirModalTransferirPeloMenuCliente();
          cy.wait('@getAttendanceGroupAgents');

          // .should(callback) com retry nativo — o container fica visível antes dos botões de
          // atendente terminarem de renderizar (achado ao rodar, 2026-09-30); um .then() síncrono
          // pega o instante errado (lista ainda vazia) mesmo após o cy.wait da rede.
          AtendimentosPage.elements.listaAtendentesTransferir()
            .should(($lista) => {
              expect($lista.find('button[role="option"]').length, 'ao menos 1 atendente na lista').to.be.greaterThan(0);
            })
            .then(($lista) => {
              const frontOk = $lista.find('button[role="option"]').length > 0;

              validarDuploGrauPermissao({
                codigo: 418,
                capability: 'can_list_group_agents',
                payloadValido: payloadOk,
                frontValido: frontOk,
                esperaAtivo: true,
                mensagemSucesso: 'Lista de atendentes do grupo carregada normalmente (can_list_group_agents: true).',
                mensagemFalhaFront: 'Lista de atendentes não carregou nenhum atendente com a permissão concedida.'
              });

              AtendimentosPage.fecharModalTransferir();
              cy.get('body').type('{esc}');

              // 2. Caminho Revogação (Caminho Contrário): can_list_group_agents: false — bug original
              // da Issue backend#558. customPayload substitui o payload inteiro (BaseMock.interceptRoute
              // não faz merge), por isso repete as demais chaves do fixture padrão. cy.intercept
              // sobrevive ao cy.reload() (não é por página) — o alias acumula desde o início do
              // teste, por isso comparamos a contagem ANTES/DEPOIS deste bloco, nunca um "0" absoluto
              // (achado ao rodar, 2026-09-30: a 1ª chamada, do caminho de concessão acima, já contava).
              let chamadasAntesDaRevogacao = 0;
              cy.get('@getAttendanceGroupAgents.all').its('length').then((n) => { chamadasAntesDaRevogacao = n; });

              cy.then(() => {
                AtendimentosMocks.interceptAttendanceCapabilitiesApi({
                  capabilities: {
                    can_access_attendance_module: true,
                    can_create_attendance: true,
                    can_view_pending_attendance: true,
                    can_view_occupied_attendance: true,
                    can_create_customer_without_gender: false,
                    can_list_group_agents: false,
                    can_change_attendant_status: true,
                    can_transfer_attendance: true,
                    can_change_status: true
                  }
                });
                cy.reload();
                AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').click();
                cy.wait('@getAttendanceMessages');

                AtendimentosPage.abrirModalTransferirPeloMenuCliente();

                cy.get('[role="alert"]:visible', { timeout: 10000 })
                  .should('be.visible')
                  .and('contain.text', 'Você não tem permissão para listar atendentes deste grupo.');

                cy.get('body', { timeout: 5000 }).then(($body) => {
                  const vazouListaDeAgentes = $body.find('[data-testid="lista-atendentes"] button[role="option"]').length > 0;

                  validarDuploGrauPermissao({
                    codigo: 418,
                    capability: 'can_list_group_agents',
                    payloadValido: false,
                    frontValido: vazouListaDeAgentes,
                    esperaAtivo: false,
                    mensagemSucesso: 'Modal de transferência bloqueada com sucesso: aviso exibido e nenhum atendente listado sem can_list_group_agents.',
                    mensagemFalhaVazamento: 'A lista de atendentes carregou mesmo com can_list_group_agents: false!'
                  });
                });

                // O endpoint de agentes nem chega a ser chamado com a flag false (gate client-side,
                // confirmado no bundle real) — nunca a expectativa de um 403 vindo da rede.
                cy.get('@getAttendanceGroupAgents.all').should(($chamadas) => {
                  expect($chamadas.length, 'nenhuma chamada nova a GET .../agents desde a concessão').to.eq(chamadasAntesDaRevogacao);
                });
                AtendimentosPage.elements.btnConfirmarTransferir().should('be.disabled');
                cy.get('body').type('{esc}');
              });
            });
        });
      });
    });

    it('1.8 [649 - can_transfer_pending_attendance] - deve ter a opção de Transferir em atendimentos pendentes sem atendente vinculado', () => {
      // Blindagem pontual `[R-BLIND]`: o cenário exige um atendimento Pendente sem atendente com a 649
      // concedida — estado que a API real não garante e que, com id sintético, faria a leitura das
      // capabilities do item cair no backend real (medido em 2026-10-15: 557 true).
      const originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);

      // 1. Caminho Concessão (100% Mock): Atendimento sem atendente vinculado (órfão) com permissão 649 ativa
      cy.then(() => {
        AtendimentosMocks.interceptMockPermissao649({ canTransferPending: true, canTransferAssigned: false });
        cy.reload();
        AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').click();
        cy.wait('@getAttendanceMessages');

        obterCapabilitiesItem().then((caps) => {
          // Regra de produto do operador (2026-10-15): 557 e 649 são independentes — a 557 só vale com
          // atendente vinculado e a 649 só em atendimento Pendente sem atendente. Conversa sem atendente:
          // 649 true e 557 false.
          const payloadOk = caps.can_transfer_pending_attendance === true;
          expect(caps.can_transfer_assigned_attendance, '557 deve ser false em conversa sem atendente').to.be.false;

          AtendimentosPage.abrirMenuStatusCliente();
          AtendimentosPage.elements.btnMenuTransferir()
            .should('be.visible')
            .then(($btn) => {
              const frontOk = $btn.length > 0;

              validarDuploGrauPermissao({
                codigo: 649,
                capability: 'can_transfer_pending_attendance',
                payloadValido: payloadOk,
                frontValido: frontOk,
                esperaAtivo: true,
                mensagemSucesso: 'Opção Transferir visível para atendimento sem atendente vinculado (can_transfer_pending_attendance: true).',
                mensagemFalhaFront: 'Opção Transferir não foi encontrada no menu do atendimento sem atendente.'
              });

              cy.get('body').type('{esc}');

              // 2. Caminho Revogação (Caminho Contrário via Mock): Sem permissão 649 (can_transfer_pending_attendance: false)
              cy.then(() => {
                AtendimentosMocks.interceptMockPermissao649({ canTransferPending: false, canTransferAssigned: false });
                cy.reload();
                AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').click();
                cy.wait('@getAttendanceMessages');

                AtendimentosPage.abrirMenuStatusCliente();
                cy.get('body', { timeout: 10000 }).then(($body) => {
                  const btnTransferir = $body.find('[data-testid="menu-transferir"]');
                  const frontAtivo = btnTransferir.length > 0 && !btnTransferir.prop('disabled');

                  validarDuploGrauPermissao({
                    codigo: 649,
                    capability: 'can_transfer_pending_attendance',
                    payloadValido: false,
                    frontValido: frontAtivo,
                    esperaAtivo: false,
                    mensagemSucesso: 'Opção Transferir bloqueada com sucesso em atendimento sem atendente com can_transfer_pending_attendance: false.',
                    mensagemFalhaVazamento: 'Opção Transferir permaneceu visível em atendimento sem atendente com can_transfer_pending_attendance: false!'
                  });
                });
                cy.get('body').type('{esc}');
              });
            });
        });
      });
      cy.then(() => Cypress.env('USE_MOCKS', originalUseMocksState));
    });

    it('1.9 [650 - can_change_default_customer] - deve exibir a opção "Vincular cliente" quando o atendimento não tem cliente vinculado', () => {
      // 1. Caminho Concessão (100% Mock): atendimento sem cliente vinculado com permissão 650 ativa
      cy.then(() => {
        AtendimentosMocks.interceptMockPermissao650({ canChangeDefaultCustomer: true });
        cy.reload();
        AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').click();
        cy.wait('@getAttendanceMessages');

        obterCapabilitiesItem().then((caps) => {
          const payloadOk = caps.can_change_default_customer === true;

          AtendimentosPage.abrirMenuStatusCliente();
          AtendimentosPage.elements.menuVincularCliente()
            .should('be.visible')
            .then(($btn) => {
              const frontOk = $btn.length > 0;

              validarDuploGrauPermissao({
                codigo: 650,
                capability: 'can_change_default_customer',
                payloadValido: payloadOk,
                frontValido: frontOk,
                esperaAtivo: true,
                mensagemSucesso: 'Opção "Vincular cliente" visível para atendimento sem cliente vinculado (can_change_default_customer: true).',
                mensagemFalhaFront: 'Opção "Vincular cliente" não foi encontrada no menu do atendimento sem cliente.'
              });

              cy.get('body').type('{esc}');

              // 2. Caminho Revogação (Caminho Contrário via Mock): sem a permissão 650
              cy.then(() => {
                AtendimentosMocks.interceptMockPermissao650({ canChangeDefaultCustomer: false });
                cy.reload();
                AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').click();
                cy.wait('@getAttendanceMessages');

                AtendimentosPage.abrirMenuStatusCliente();
                cy.get('body', { timeout: 10000 }).then(($body) => {
                  const btnVincular = $body.find('[data-testid="menu-link-client"]');
                  const frontAtivo = btnVincular.length > 0;

                  validarDuploGrauPermissao({
                    codigo: 650,
                    capability: 'can_change_default_customer',
                    payloadValido: false,
                    frontValido: frontAtivo,
                    esperaAtivo: false,
                    mensagemSucesso: 'Opção "Vincular cliente" bloqueada com sucesso em atendimento sem cliente com can_change_default_customer: false.',
                    mensagemFalhaVazamento: 'Opção "Vincular cliente" permaneceu visível em atendimento sem cliente com can_change_default_customer: false!'
                  });
                });
                cy.get('body').type('{esc}');
              });
            });
        });
      });
    });

    it('1.10 [046 - can_create_client] - deve exibir o botão "Cadastrar novo" no diálogo "Vincular cliente" só quando a capability de criar cliente estiver concedida (Issue front#497, PR #499)', () => {
      // Mesma capability (can_create_client, GET /client-capabilities) e código legado já usados
      // em 1.permissoes.cy.js para o botão "Novo cliente" da tela /clientes (contexto "Clientes -
      // Permissões") — aqui é o MESMO componente NewClientModalSession reaproveitado dentro do
      // diálogo "Vincular cliente" (Issue front#497/PR #499, confirmado via bundle real), não uma
      // capability nova. 650 precisa estar concedida só para o "Vincular cliente" aparecer no
      // menu ⋮ e dar acesso ao rodapé onde "Cadastrar novo" mora.
      cy.then(() => {
        AtendimentosMocks.interceptMockPermissao650({ canChangeDefaultCustomer: true });
        AtendimentosMocks.interceptClientCapabilitiesApi({ capabilities: { can_create_client: true } });
        cy.reload();
        AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').click();
        cy.wait('@getAttendanceMessages');

        AtendimentosPage.abrirMenuStatusCliente();
        AtendimentosPage.elements.menuVincularCliente().click();
        AtendimentosPage.elements.modalVincularCliente().should('be.visible');

        // 1. Caminho Concessão
        AtendimentosPage.elements.btnVincularClienteCadastrarNovo().should('be.visible').then(($btn) => {
          validarDuploGrauPermissao({
            codigo: '046',
            capability: 'can_create_client',
            payloadValido: true,
            frontValido: $btn.length > 0,
            esperaAtivo: true,
            mensagemSucesso: 'Botão "Cadastrar novo" visível no diálogo "Vincular cliente" com can_create_client: true.',
            mensagemFalhaFront: 'Botão "Cadastrar novo" não foi encontrado no diálogo "Vincular cliente".'
          });

          cy.get('body').type('{esc}');

          // 2. Caminho Revogação — "Vincular cliente" continua funcionando normalmente
          cy.then(() => {
            AtendimentosMocks.interceptClientCapabilitiesApi({ capabilities: { can_create_client: false } });
            cy.reload();
            AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').click();
            cy.wait('@getAttendanceMessages');

            AtendimentosPage.abrirMenuStatusCliente();
            AtendimentosPage.elements.menuVincularCliente().click();
            AtendimentosPage.elements.modalVincularCliente().should('be.visible');

            cy.get('body', { timeout: 10000 }).then(($body) => {
              const btnExiste = $body.find('[data-testid="button-link-customer-new-client"]').length > 0;

              validarDuploGrauPermissao({
                codigo: '046',
                capability: 'can_create_client',
                payloadValido: false,
                frontValido: btnExiste,
                esperaAtivo: false,
                mensagemSucesso: 'Botão "Cadastrar novo" bloqueado com sucesso no diálogo "Vincular cliente" com can_create_client: false.',
                mensagemFalhaVazamento: 'Botão "Cadastrar novo" permaneceu no diálogo "Vincular cliente" mesmo com can_create_client: false!'
              });
            });

            AtendimentosPage.elements.inputBuscaVincularCliente().should('be.visible').and('not.be.disabled');
            cy.get('body').type('{esc}');
          });
        });
      });
    });

    it('1.11 [562 - can_mark_finished] - deve exibir opções de reabertura em atendimento finalizado (STATUS = 3)', () => {
      const attendanceId = 260800099;

      cy.then(() => {
        // 1. Caminho Concessão: Atendimento em STATUS = 3 (Finalizado) com a permissão 562 (can_mark_finished: true)
        AtendimentosMocks.interceptMockAtendimentoFinalizado(attendanceId, {
          can_mark_finished: true,
          can_mark_completed: false,
          can_mark_discarded: true,
          can_transfer_assigned_attendance: true
        });

        AtendimentosPage.filtrarPorStatusChip('finished');
        cy.wait('@getAttendancesList');

        AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').click();
        cy.wait('@getAttendanceDetail');

        obterCapabilitiesItem().then((caps) => {
          const payloadOk = caps.can_mark_finished === true;

          AtendimentosPage.abrirMenuStatusCliente();
          cy.contains('div[role="menu"] button, div[role="dialog"] button, [data-testid*="status"], button', /pendente|em andamento/i, { timeout: 10000 })
            .should('be.visible')
            .then(($btn) => {
              const frontOk = $btn.length > 0;

              validarDuploGrauPermissao({
                codigo: 562,
                capability: 'can_mark_finished',
                payloadValido: payloadOk,
                frontValido: frontOk,
                esperaAtivo: true,
                mensagemSucesso: 'Opções de reabertura (retirar finalizado) visíveis no atendimento finalizado (STATUS = 3).',
                mensagemFalhaFront: 'Opções de reabertura não foram exibidas para atendimento finalizado.'
              });

              cy.get('body').type('{esc}');

              // 2. Caminho Revogação (Caminho Contrário): Sem permissão 562 (can_mark_finished: false)
              cy.then(() => {
                AtendimentosMocks.interceptMockAtendimentoFinalizado(attendanceId, {
                  can_mark_finished: false,
                  can_mark_completed: false,
                  can_mark_discarded: false,
                  can_transfer_assigned_attendance: false
                });
                cy.reload();
                AtendimentosPage.filtrarPorStatusChip('finished');
                cy.wait('@getAttendancesList');
                AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').click();
                cy.wait('@getAttendanceDetail');

                // Validação de Bloqueio no Frontend:
                // Quando can_mark_finished é false, o frontend oculta o botão de edição de status (tornando-o estático).
                // Caso o botão ainda exista, verifica se as opções de reabertura foram suprimidas.
                cy.get('body', { timeout: 10000 }).then(($body) => {
                  const btnEditar = $body.find('button[data-testid="button-editar-cliente-icon"], button[data-testid="button-cliente-status"], button[class*="_statusMenuTrigger_"]');
                  let frontAtivo = false;

                  if (btnEditar.length > 0 && !btnEditar.prop('disabled')) {
                    // jQuery .click() (não é cy.click()) - dispara o handler direto, sem
                    // actionability do Cypress; o guard de "disabled" já está checado acima
                    btnEditar.first().click();
                    const menuAberto = $body.find('div[role="menu"] button:contains("Pendente"), div[role="menu"] button:contains("Em andamento")');
                    frontAtivo = menuAberto.length > 0;
                    cy.get('body').type('{esc}');
                  }

                  validarDuploGrauPermissao({
                    codigo: 562,
                    capability: 'can_mark_finished',
                    payloadValido: false,
                    frontValido: frontAtivo,
                    esperaAtivo: false,
                    mensagemSucesso: 'Menu de alteração de status/reabertura bloqueado com sucesso em atendimento finalizado (can_mark_finished: false).',
                    mensagemFalhaVazamento: 'Opções de reabertura permaneceram visíveis para atendimento finalizado com can_mark_finished: false!'
                  });
                });
              });
            });
        });
      });
    });

    it('1.12 [562 - can_mark_finished] - deve exibir opções de reabertura em atendimento descartado (STATUS = 4) (PR #442 / PR #486)', () => {
      const attendanceId = 260800098;

      cy.then(() => {
        // 1. Caminho Concessão: Atendimento em STATUS = 4 com permissão 562 (can_mark_finished: true)
        AtendimentosMocks.interceptMockAtendimentoDescartado(attendanceId, {
          can_mark_finished: true,
          can_mark_completed: false,
          can_mark_discarded: false,
          can_transfer_assigned_attendance: true
        });

        AtendimentosPage.filtrarPorStatusChip('discarded');
        cy.wait('@getAttendancesList');

        AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').click();
        cy.wait('@getAttendanceDetail');

        obterCapabilitiesItem().then((caps) => {
          const payloadOk = caps.can_mark_finished === true;

          AtendimentosPage.abrirMenuStatusCliente();
          cy.contains('div[role="menu"] button, div[role="dialog"] button, [data-testid*="status"], button', /pendente|em andamento/i, { timeout: 10000 })
            .should('be.visible')
            .then(($btn) => {
              const frontOk = $btn.length > 0;

              validarDuploGrauPermissao({
                codigo: 562,
                capability: 'can_mark_finished',
                payloadValido: payloadOk,
                frontValido: frontOk,
                esperaAtivo: true,
                mensagemSucesso: 'Opções de reabertura (des-descartar) visíveis em atendimento descartado (STATUS = 4).',
                mensagemFalhaFront: 'Opções de reabertura não foram exibidas para atendimento descartado.'
              });

              cy.get('body').type('{esc}');

              // 2. Validação de Conformidade PR #442:
              // Conforme definido na PR #442, des-descartar (4 -> 0 / 4 -> 1) não exige grant 562 ('can_mark_finished').
              // O frontend deve manter as opções de reabertura disponíveis para o atendente mesmo sem o grant.
              cy.then(() => {
                AtendimentosMocks.interceptMockAtendimentoDescartado(attendanceId, {
                  can_mark_finished: false
                });
                cy.reload();
                AtendimentosPage.filtrarPorStatusChip('discarded');
                cy.wait('@getAttendancesList');
                AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').click();
                cy.wait('@getAttendanceDetail');

                AtendimentosPage.abrirMenuStatusCliente();
                cy.get('body', { timeout: 10000 }).then(($body) => {
                  const opcoesReabertura = $body.find('div[role="menu"] button:contains("Pendente"), div[role="menu"] button:contains("Em andamento")');
                  const frontDisponivel = opcoesReabertura.length > 0;

                  expect(frontDisponivel, 'Opções de des-descartar devem permanecer disponíveis mesmo sem grant 562 (transição livre conforme PR #442)').to.be.true;
                  Cypress.log({ name: 'DUPLO_GRAU', message: '✅ [PR #442 OK] Opções de des-descartar mantidas disponíveis sem exigência de grant 562.' });
                });
                cy.get('body').type('{esc}');
              });
            });
        });
      });
    });

    it('1.13 [554 - can_change_attendant_status] - deve permitir alterar status do atendente', () => {
      obterCapabilitiesLoja().then((caps) => {
        const payloadOk = caps.can_change_attendant_status === true;

        // 1. Caminho Concessão: Switch visível e habilitado (sem aria-disabled="true")
        AtendimentosPage.elements.btnStatusAtendente().should('be.visible').then(($switch) => {
          const ariaDisabled = $switch.attr('aria-disabled');
          const frontOk = ariaDisabled !== 'true';

          validarDuploGrauPermissao({
            codigo: 554,
            capability: 'can_change_attendant_status',
            payloadValido: payloadOk,
            frontValido: frontOk,
            esperaAtivo: true,
            mensagemSucesso: 'Switch de status do atendente ativo e habilitado para alternância (can_change_attendant_status: true).',
            mensagemFalhaFront: 'Switch de status do atendente está inerte com aria-disabled="true".'
          });

          // 2. Caminho Revogação (Caminho Contrário): Com can_change_attendant_status: false, switch deve ficar inerte
          cy.then(() => {
            AtendimentosMocks.interceptAttendanceCapabilitiesApi({
              capabilities: { ...caps, can_change_attendant_status: false }
            });
            cy.reload();
            AtendimentosPage.elements.btnStatusAtendente().should('be.visible').then(($switchRevogado) => {
              const ariaDisabledRevogado = $switchRevogado.attr('aria-disabled');
              const switchAtivo = ariaDisabledRevogado !== 'true' && !$switchRevogado.prop('disabled');

              validarDuploGrauPermissao({
                codigo: 554,
                capability: 'can_change_attendant_status',
                payloadValido: false,
                frontValido: switchAtivo,
                esperaAtivo: false,
                mensagemFalhaVazamento: 'Switch de status continuou interativo mesmo com can_change_attendant_status: false!'
              });
            });
          });
        });
      });
    });

    // -----------------------------------------------------------------------------
    // Permissão 577 (can_create_attendance_custom_status / can_create_attendance_custom_status)
    // — gate de visibilidade do "+ Adicionar personalizado" no menu de substatus.
    // Referência: backend#499/#501-503, front#396 (issue de produto #329).
    // Movido de 5.atendimentos.cy.js para cá a pedido do operador (25/09/2026): é teste de
    // matriz de permissão (duplo grau Payload + UI), não funcionalidade da tela — critério de
    // divisão de responsabilidades entre as duas suítes.
    // -----------------------------------------------------------------------------

    // Achado de diagnóstico (25/09/2026, causa raiz apontada pelo operador): can_create_attendance_
    // custom_status e can_update_attendance_custom_status são capabilities de LOJA (GET
    // /attendance-capabilities, junto de can_change_attendant_status), não de item — igual à 655
    // (can_view_pending_attendance). O toggle de expandir (`chat-header-menu-custom-toggle-{key}`)
    // só renderiza numa linha de status pai quando ela JÁ TEM substatus cadastrado OU quando
    // can_create_attendance_custom_status é true; o botão "+ Adicionar personalizado"
    // (`chat-header-menu-custom-add-{key}`) vive DENTRO da sublista expandida (após o toggle), não
    // solto na linha do pai — por isso o diagnóstico anterior não o encontrou.
    it('1.14 [577 - can_create_attendance_custom_status] - deve exibir "+ Adicionar personalizado" apenas quando concedida', () => {
      const { itemCapabilities } = AtendimentosMocks.interceptMockSubstatusPersonalizado({ customStatus: null });
      AtendimentosMocks.interceptAttendanceCustomStatusesApi();
      // Capability de LOJA (mesma rota de can_change_attendant_status) — hipótese nova do operador.
      AtendimentosMocks.interceptAttendanceCapabilitiesApi({
        capabilities: {
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
        }
      });
      cy.reload();
      AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').click();
      cy.wait('@getAttendanceMessages');

      // 1. Caminho Concessão: com can_create_attendance_custom_status: true, o toggle do pai
      // "Concluído" (sem nenhum substatus cadastrado) passa a existir e, ao expandir, revela o
      // botão "+ Adicionar personalizado" dentro da sublista (mesmo vazia).
      AtendimentosPage.abrirMenuStatusCliente();
      AtendimentosPage.elements.toggleSubstatusPorPai('completed').should('be.visible').click();
      AtendimentosPage.elements.btnAdicionarSubstatusPorPai('completed').should('be.visible').then(($btn) => {
        const frontOk = $btn.length > 0;

        validarDuploGrauPermissao({
          codigo: 577,
          capability: 'can_create_attendance_custom_status',
          payloadValido: true,
          frontValido: frontOk,
          esperaAtivo: true,
          mensagemSucesso: '"+ Adicionar personalizado" visível com can_create_attendance_custom_status: true.',
          mensagemFalhaFront: '"+ Adicionar personalizado" não foi encontrado no menu de status.'
        });

        cy.get('body').type('{esc}');

        // 2. Caminho Revogação: com can_create_attendance_custom_status: false, o "+" some
        cy.then(() => {
          AtendimentosMocks.interceptAttendanceCapabilitiesApi({
            capabilities: {
              can_access_attendance_module: true,
              can_create_attendance: true,
              can_view_pending_attendance: true,
              can_view_occupied_attendance: true,
              can_create_customer_without_gender: false,
              can_list_group_agents: true,
              can_change_attendant_status: true,
              can_transfer_attendance: true,
              can_change_status: true,
              can_create_attendance_custom_status: false,
              can_update_attendance_custom_status: true
            }
          });
          cy.reload();
          AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').click();
          cy.wait('@getAttendanceMessages');
          AtendimentosPage.abrirMenuStatusCliente();

          cy.get('body', { timeout: 10000 }).then(($body) => {
            const botaoAdicionar = $body.find('[data-testid="chat-header-menu-custom-add-completed"]');
            const frontAtivo = botaoAdicionar.length > 0;

            validarDuploGrauPermissao({
              codigo: 577,
              capability: 'can_create_attendance_custom_status',
              payloadValido: false,
              frontValido: frontAtivo,
              esperaAtivo: false,
              mensagemFalhaVazamento: '"+ Adicionar personalizado" permaneceu visível mesmo com can_create_attendance_custom_status: false!'
            });
          });
        });
      });
    });

    // -----------------------------------------------------------------------------
    // Permissão 655 (can_view_pending_attendance) e Ação de Assumir Atendimento em
    // atendimento sem atendente vinculado. Referência: backend#528, front#434.
    // Mantidas neste mesmo context (e não em context à parte) por regra deste arquivo
    // (AGENTS.md §2 "Organização de Contextos": um único context por tela/módulo — Atendimento).
    //
    // NOTA DE ESCOPO (validado por inspeção de DOM real em 25/09/2026 — ver rodapé do turno):
    // o botão "Assumir atendimento" e a mensagem de bloqueio no front hoje leem
    // can_transfer_pending_attendance (649), não a nova capability can_take_attendance do
    // backend#561. O ajuste de front descrito em backend#561 (canAssume passar a ler
    // can_take_attendance, permitindo assumir por grupo mesmo sem 649, e o 403
    // ATTENDANCE_GROUP_MISMATCH) ainda não foi deployado — por isso esses dois cenários
    // específicos foram mantidos como .skip, documentados abaixo, em vez de forçados a
    // passar com mock incompatível com a UI real.
    // -----------------------------------------------------------------------------

    it('1.15 [655 - can_view_pending_attendance] - deve pré-visualizar mensagens e manter o atendimento sem atendente até o clique em Assumir, quando estiver ativa', () => {
      cy.then(() => {
        AtendimentosMocks.interceptMockPermissao655({ canView: true, canTake: true, canTransferPending: true });
        cy.reload();
        AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').click();
        cy.wait('@getAttendanceMessages');

        // Lê a capability direto do cache que o próprio mock preencheu (Cypress.env), e NÃO via
        // obterCapabilitiesItem(): esse helper, com USE_MOCKS: false em env.json (padrão do operador
        // fora do --env de CLI), cai no branco "Modo API Real" e dispara um cy.request() contra o
        // backend de produção para o ID sintético desta suíte — sempre divergente do mock. Ver rodapé.
        cy.then(() => Cypress.env('LAST_ATTENDANCE_ITEM_CAPABILITIES')).then((caps) => {
          const payloadOk = caps.can_view_pending_attendance === true;

          cy.get('body', { timeout: 10000 }).then(($body) => {
            const previaVisivel = $body.text().includes('Preciso de ajuda com meu pedido');

            validarDuploGrauPermissao({
              codigo: 655,
              capability: 'can_view_pending_attendance',
              payloadValido: payloadOk,
              frontValido: previaVisivel,
              esperaAtivo: true,
              mensagemSucesso: 'Mensagens do atendimento sem atendente pré-visualizadas com can_view_pending_attendance: true.',
              mensagemFalhaFront: 'Conteúdo do chat não foi pré-visualizado mesmo com can_view_pending_attendance: true.'
            });
          });

          // Pré-visualizar não assume o atendimento: o botão Assumir continua disponível
          AtendimentosPage.elements.btnAssumirAtendimento().should('be.visible');
        });
      });
    });

    it('1.16 [655 - can_view_pending_attendance] - não deve buscar mensagens, arquivos, orçamentos nem links de pagamento e deve exibir o cartão de bloqueio quando estiver revogada', () => {
      cy.then(() => {
        AtendimentosMocks.interceptMockPermissao655({ canView: false, canTake: true, canTransferPending: true });
        cy.reload();
        AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').click();
        cy.wait('@getAttendanceDetail');

        AtendimentosPage.elements.cardBloqueioPermissao655().should('be.visible');

        // Ver nota na 1ª asserção deste bloco (teste anterior): lê o cache do próprio mock, não a
        // API real, pelo mesmo motivo (ID sintético desta suíte não existe no backend real).
        cy.then(() => Cypress.env('LAST_ATTENDANCE_ITEM_CAPABILITIES')).then((caps) => {
          const payloadOk = caps.can_view_pending_attendance;

          cy.get('body', { timeout: 10000 }).then(($body) => {
            const conteudoVazou = $body.find('article[class*="_bubble"], textarea[data-testid="input-message"]').length > 0;

            validarDuploGrauPermissao({
              codigo: 655,
              capability: 'can_view_pending_attendance',
              payloadValido: payloadOk,
              frontValido: conteudoVazou,
              esperaAtivo: false,
              mensagemFalhaVazamento: 'Conteúdo do atendimento sem atendente (mensagens/composer) ficou acessível mesmo com can_view_pending_attendance: false!'
            });
          });

          // Precedência de Rota HTTP (AGENTS.md §6 / PR #306): prova pela AUSÊNCIA de chamada,
          // nunca pelo texto renderizado, que o guard client-side impediu a busca de conteúdo.
          cy.get('@getAttendanceMessages.all').should('have.length', 0);
          cy.get('@getAttendanceBudgets.all').should('have.length', 0);
          cy.get('@getPaymentLinks.all').should('have.length', 0);

          // Com 649 ativa, o botão Assumir permanece disponível mesmo sem 655
          AtendimentosPage.elements.btnAssumirAtendimento().should('be.visible');
        });
      });
    });

    it('1.17 [can_take_attendance] - deve ocultar o botão Assumir e explicar a ausência de permissão quando o atendente não é do grupo (ou o atendimento não tem grupo) (Issue front#505, PR #511)', () => {
      // canAssume deixou de ler can_transfer_pending_attendance (649) — a 649 só vale para
      // transferir um atendimento sem atendente para OUTRA pessoa (ver testes #6/#7 acima). O
      // gate de "Assumir" agora é só can_take_attendance, calculado pelo backend (membro do grupo
      // OU 557; atendimento sem grupo = ninguém assume). canTransferPending segue true aqui de
      // propósito, provando que ele não concede mais o botão sozinho.
      cy.then(() => {
        AtendimentosMocks.interceptMockPermissao655({ canView: false, canTake: false, canTransferPending: true });
        cy.reload();
        AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').click();
        cy.wait('@getAttendanceDetail');

        AtendimentosPage.elements.cardBloqueioPermissao655().should('be.visible');

        cy.get('body', { timeout: 10000 }).then(($body) => {
          const botaoAssumir = $body.find('[data-testid="button-assume-attendance"]');
          expect(botaoAssumir.length, 'botão Assumir não deve existir sem can_take_attendance, mesmo com can_transfer_pending_attendance (649) concedida').to.eq(0);
        });

        // "Você também não pode assumir este atendimento." (não fica desabilitado — some de vez)
        AtendimentosPage.elements.textoNaoPodeAssumirAtendimento().should('be.visible');
      });
    });

    // Bug real do botão "Assumir atendimento" inclicável (pointer-events:none herdado do footer
    // do compositor, achado 2026-10-05, atendimento real #261000019) corrigido pela front#535
    // (Issue front#534) — confirmado em 2026-10-07 via os 5 testes abaixo (sem `force`) e via
    // clique real contra a API real no atendimento #261000036. `clicarAssumirAtendimento()`
    // (`5.atendimentosPage.js`) segue sem `force` de propósito, pra nunca mais mascarar esse tipo
    // de bloqueio de CSS.
    it('1.18 [649 - can_transfer_pending_attendance] - deve assumir com sucesso um atendimento sem atendente vinculado (PATCH com target_attendant_id, sem channel_group_id)', () => {
      cy.then(() => {
        const { idNum, itemCapabilities } = AtendimentosMocks.interceptMockPermissao655({ canView: true, canTake: true, canTransferPending: true });

        // Registrado ANTES do clique (Ordem Estrita de Interceptação, AGENTS.md §3): a 1ª chamada
        // reflete o estado sem atendente e a 2ª (refetch pós-PATCH) já reflete o sucesso da ação.
        AtendimentosMocks.interceptDetalheComTransicaoDeAssumir(idNum, itemCapabilities, 'sucesso');
        AtendimentosMocks.interceptAssumirAtendimentoApi(idNum, 'sucesso');

        cy.reload();
        AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').click();
        cy.wait('@getAttendanceDetail');

        AtendimentosPage.clicarAssumirAtendimento();
        cy.wait('@assumirAtendimentoPatch').then((interception) => {
          expect(interception.response.statusCode, 'PATCH de assumir deve suceder').to.eq(200);
          expect(interception.response.body.attendant.id, 'resposta do PATCH deve confirmar o atendente logado como novo dono').to.eq(AtendimentosMocks.getLoggedAttendant().id);
        });

        // Achado real 2026-10-07 (medido rodando o arquivo inteiro × isolado): o refetch do
        // detalhe que a UI dispara ao montar a tela nem sempre acontece DEPOIS do clique — às
        // vezes é consumido por um refetch incidental de montagem, anterior ao clique, e depois
        // nenhum outro GET chega. Depender dele pra confirmar capabilities é não-determinístico;
        // a prova de sucesso que o teste controla de ponta a ponta é o PATCH em si (verificado
        // acima) e o efeito observável de o cartão de bloqueio sumir.
        AtendimentosPage.elements.cardBloqueioPermissao655().should('not.exist');
        cy.wait('@getAttendanceMessages');
      });
    });

    it('1.19 [649 - can_transfer_pending_attendance] - deve tratar o conflito de concorrência (409 ATTENDANCE_ALREADY_ASSIGNED) recarregando o detalhe com o dono real do atendimento', () => {
      cy.then(() => {
        const nomeConcorrente = 'ITALO PATRICK';
        const { idNum, itemCapabilities } = AtendimentosMocks.interceptMockPermissao655({ canView: true, canTake: true, canTransferPending: true });

        AtendimentosMocks.interceptDetalheComTransicaoDeAssumir(idNum, itemCapabilities, 'conflito', nomeConcorrente, 10);
        AtendimentosMocks.interceptAssumirAtendimentoApi(idNum, 'conflito', nomeConcorrente);

        cy.reload();
        AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').click();
        cy.wait('@getAttendanceDetail');

        AtendimentosPage.clicarAssumirAtendimento();
        cy.wait('@assumirAtendimentoPatch').its('response.statusCode').should('eq', 409);

        // NOTA: a cópia exata exibida na UI para o 409 (toast/snackbar com o nome de quem assumiu)
        // não foi confirmada por inspeção de DOM nesta rodada — ver rodapé do turno. A asserção
        // abaixo valida o contrato mecânico e verificável: o recarregamento automático do detalhe
        // após o conflito passa a refletir o dono real (o concorrente), não mais null. Lê a ÚLTIMA
        // chamada já capturada (não "a próxima da fila") pelo mesmo motivo do #1.18 acima.
        cy.get('@getAttendanceDetail.all', { timeout: 20000 }).should((calls) => {
          const ultima = calls[calls.length - 1];
          const body = ultima.response.body;
          expect(body.attendance.attendant, 'última resposta de detalhe deve refletir o dono real após o conflito').to.not.be.null;
          expect(body.attendance.attendant.name, 'detalhe recarregado deve refletir o atendente que venceu a corrida').to.eq(nomeConcorrente);
          expect(body.capabilities.can_take_attendance, 'can_take_attendance deve virar false: o atendimento já tem dono (o concorrente)').to.be.false;
        });
      });
    });

    // Reativados pela front#505/PR #511: canAssume passou a ler can_take_attendance em vez de
    // can_transfer_pending_attendance (649), habilitando assumir por grupo mesmo sem o grant 649.
    // Confirmado via bundle real (index-D44fQXrl.js): o código ATTENDANCE_GROUP_MISMATCH citado em
    // comentários antigos da issue #528 nunca existiu de fato (veio da backend#561, fechada sem
    // merge) — a API usa ATTENDANCE_GROUP_REQUIRED (403) e ATTENDANCE_NOT_PENDING (409), mapeados
    // para mensagem própria do assumir (`VC` no bundle), nunca o aviso genérico de transferência.
    it('1.20 [can_take_attendance] - deve assumir um atendimento sem atendente vinculado quando can_take_attendance for true, mesmo sem o grant 649 (regra de grupo, Issue front#505, PR #511)', () => {
      cy.then(() => {
        const { idNum, itemCapabilities } = AtendimentosMocks.interceptMockPermissao655({ canView: true, canTake: true, canTransferPending: false });
        AtendimentosMocks.interceptDetalheComTransicaoDeAssumir(idNum, itemCapabilities, 'sucesso');
        AtendimentosMocks.interceptAssumirAtendimentoApi(idNum, 'sucesso');

        cy.reload();
        AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').click();
        cy.wait('@getAttendanceDetail');

        AtendimentosPage.clicarAssumirAtendimento();
        cy.wait('@assumirAtendimentoPatch').its('response.statusCode').should('eq', 200);
      });
    });

    it('1.21 [can_take_attendance] - deve rejeitar a tentativa de assumir com 403 ATTENDANCE_GROUP_REQUIRED quando o atendente deixou de pertencer ao grupo entre a carga da tela e o clique (Issue front#505, PR #511)', () => {
      // O botão só aparece com can_take_attendance: true (carga inicial) — a recusa simula o
      // backend mudando de ideia depois (grupo trocado/atendente removido do grupo em outra
      // sessão), cenário 8 da devolutiva da PR #511. can_take_attendance: false aqui representaria
      // "o botão nunca apareceu", já coberto pelo teste anterior (cartão/ausência de botão).
      cy.then(() => {
        const { idNum } = AtendimentosMocks.interceptMockPermissao655({ canView: true, canTake: true, canTransferPending: false });
        AtendimentosMocks.interceptAssumirAtendimentoApi(idNum, 'grupo');

        cy.reload();
        AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').click();
        cy.wait('@getAttendanceDetail');

        AtendimentosPage.clicarAssumirAtendimento();
        cy.wait('@assumirAtendimentoPatch').then((interception) => {
          expect(interception.response.statusCode, 'status HTTP da recusa').to.eq(403);
          expect(interception.response.body.code, 'código de erro reconhecido pelo front').to.eq('ATTENDANCE_GROUP_REQUIRED');
        });

        // O toast com a mensagem própria ("Você não pertence ao grupo deste atendimento.") existe
        // e foi confirmado via bundle real + rodada isolada — mas é efêmero (some sozinho em 4s,
        // componente genérico `pu()`) e intermitente só quando a suíte inteira roda em sequência
        // (achado 2026-10-02, `AGENTS.md` [R-DIAG] — 3 tentativas de diagnóstico, não resolvido;
        // mesmo padrão de aceite do ctx 30/front#490). A asserção acima já prova que o front
        // reconhece o código certo; o botão volta a ficar clicável (não trava em "Assumindo…").
        AtendimentosPage.elements.btnAssumirAtendimento().should('not.have.attr', 'aria-busy', 'true');
      });
    });

    it('1.22 [can_take_attendance] - deve rejeitar a tentativa de assumir com 409 ATTENDANCE_NOT_PENDING quando o atendimento deixou de estar Pendente entre a carga da tela e o clique (Issue front#505, PR #511)', () => {
      // Cenário 7 da devolutiva da PR #511: outra sessão finaliza/descarta o atendimento antes do
      // clique em Assumir, sem a aba atual recarregar.
      cy.then(() => {
        const { idNum } = AtendimentosMocks.interceptMockPermissao655({ canView: true, canTake: true, canTransferPending: false });
        AtendimentosMocks.interceptAssumirAtendimentoApi(idNum, 'pendente');

        cy.reload();
        AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').click();
        cy.wait('@getAttendanceDetail');

        AtendimentosPage.clicarAssumirAtendimento();
        cy.wait('@assumirAtendimentoPatch').then((interception) => {
          expect(interception.response.statusCode, 'status HTTP da recusa').to.eq(409);
          expect(interception.response.body.code, 'código de erro reconhecido pelo front').to.eq('ATTENDANCE_NOT_PENDING');
        });

        // Mesma nota do teste anterior (403 ATTENDANCE_GROUP_REQUIRED) sobre o toast ser efêmero e
        // intermitente só na suíte completa — a asserção acima já prova o código certo.
        AtendimentosPage.elements.btnAssumirAtendimento().should('not.have.attr', 'aria-busy', 'true');
      });
    });

    it('1.23 [Envio Bloqueado Sem Atendente] - deve ocultar o campo de mensagem e tratar 409 ATTENDANCE_UNASSIGNED ao tentar enviar mensagem antes de assumir o atendimento', () => {
      cy.then(() => {
        const { idNum } = AtendimentosMocks.interceptMockPermissao655({ canView: true, canTake: true, canTransferPending: true });
        AtendimentosMocks.interceptEnvioMensagemSemAtendenteApi(idNum);

        cy.reload();
        AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').click();
        cy.wait('@getAttendanceMessages');

        // Capabilities de envio chegam false para todos em atendimento sem atendente, com ou sem 655.
        // Lê o cache do mock diretamente (não obterCapabilitiesItem()) pelo mesmo motivo documentado
        // no 1º teste deste bloco: com USE_MOCKS: false em env.json, o helper cairia no branco de API
        // Real e consultaria o backend de produção para o ID sintético desta suíte.
        cy.then(() => Cypress.env('LAST_ATTENDANCE_ITEM_CAPABILITIES')).then((caps) => {
          expect(caps.can_send_attendance_messages, 'envio deve estar bloqueado (false) em atendimento sem atendente').to.be.false;
        });

        cy.get('textarea[data-testid="input-message"]').should('not.exist');
      });
    });

    it('1.24 [Fila - Contrato Degradado Sem 655] - deve exibir "Assuma para ver" no card da fila quando last_message.body vier null, preservando type/content_type/occurred_at no payload enviado ao front', () => {
      cy.then(() => {
        AtendimentosMocks.interceptMockPermissao655({ canView: false, canTake: true, canTransferPending: true });
        cy.reload();

        // Prova pelo DOM (a introspecção de cy.wait().response.body para este endpoint se mostrou
        // instável entre execuções nesta rodada — ver rodapé do turno): o rótulo "Assuma para ver"
        // só é exibido pelo front no lugar do preview quando o body chega null; o preview normal com
        // o texto real da mensagem já é coberto pelo primeiro teste deste bloco (can_view_pending_attendance: true).
        AtendimentosPage.elements.textoAssumaParaVerFila().should('be.visible');
      });
    });

    it('1.25 [046 - can_update_client] - deve permitir editar a ficha e exibir "Salvar dados" só quando a capability estiver concedida (drawer "Dados do Cliente" em Atendimentos)', () => {
      // Blindagem 100% mockada (AGENTS.md [R-BLIND]): capabilities.can_update_client embutida no
      // GET /clients/:id não é garantida para nenhum cliente real.
      // Achado real (AGENTS.md [R-PERM]): docs/PERMISSION_REFERENCE.md sugere o código 046 no
      // domínio Atendimento como `can_save_customer_on_attendance`, mas a medição real (DOM real
      // via cy.salvarSnapshotDom, 2026-10-07) confirma que o drawer lê a MESMA capability embutida
      // can_update_client do módulo de clientes (schema compartilhado com a ficha standalone,
      // mesmo campo já coberto no context 2 #2.2) — a medição vale sobre a sugestão do documento.
      const originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);

      RecursosMocks.interceptResources();
      AtendimentosMocks.interceptClientCapabilitiesApi();
      AtendimentosMocks.interceptPatchClientApi('*');
      AtendimentosMocks.interceptAttendanceDetailApi('*', {
        ...AtendimentosMocks.mockAttendanceDetailData,
        customer: { ...AtendimentosMocks.mockAttendanceDetailData.customer, customer_id: 867092 }
      });

      // 1. Caminho Concessão
      AtendimentosMocks.interceptClientDetailApi('*', {
        ...AtendimentosMocks.mockClientDetailData,
        capabilities: { ...AtendimentosMocks.mockClientDetailData.capabilities, can_update_client: true }
      });
      cy.reload();
      AtendimentosPage.elements.tituloAtendimentos().should('be.visible');
      AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').click({ force: true });
      AtendimentosPage.abrirDrawerDadosCliente();
      cy.wait('@getClientDetail');

      AtendimentosPage.elements.inputRgCliente().should('be.visible').then(($input) => {
        const frontOk = !$input.prop('disabled');
        validarDuploGrauPermissao({
          codigo: '046',
          capability: 'can_update_client',
          payloadValido: true,
          frontValido: frontOk,
          esperaAtivo: true,
          mensagemSucesso: 'Campos do drawer editáveis e "Salvar dados" presente com can_update_client: true.',
          mensagemFalhaFront: 'Campo RG não estava habilitado para edição no drawer.'
        });
      });
      AtendimentosPage.elements.btnSalvarDadosCliente().should('exist');

      // 2. Caminho Revogação: o botão "Salvar dados" some do DOM por completo (não só desabilita) —
      // por isso o reabrir aqui é manual (btnClienteStatus > btnMenuEditarCliente), sem usar
      // abrirDrawerDadosCliente()/drawerDadosCliente(), que dependem de `:has([data-testid="button-client-save"])`
      // pra confirmar que o drawer abriu — condição que nunca se cumpre neste cenário (achado real).
      AtendimentosMocks.interceptClientDetailApi('*', {
        ...AtendimentosMocks.mockClientDetailData,
        capabilities: { ...AtendimentosMocks.mockClientDetailData.capabilities, can_update_client: false }
      });
      cy.reload();
      AtendimentosPage.elements.tituloAtendimentos().should('be.visible');
      AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').click({ force: true });
      AtendimentosPage.elements.btnClienteStatus().scrollIntoView().should('be.visible').click();
      AtendimentosPage.elements.btnMenuEditarCliente().should('be.visible').click();
      cy.wait('@getClientDetail');

      AtendimentosPage.elements.inputRgCliente().should('be.visible').then(($input) => {
        const frontAtivo = !$input.prop('disabled');
        validarDuploGrauPermissao({
          codigo: '046',
          capability: 'can_update_client',
          payloadValido: false,
          frontValido: frontAtivo,
          esperaAtivo: false,
          mensagemFalhaVazamento: 'Campo RG permaneceu editável no drawer mesmo com can_update_client: false!'
        });
      });
      AtendimentosPage.elements.inputDocumentoCliente().should('be.disabled');
      AtendimentosPage.elements.radioTipoClientePF().should('be.disabled');
      AtendimentosPage.elements.btnSalvarDadosCliente().should('not.exist');

      cy.then(() => Cypress.env('USE_MOCKS', originalUseMocksState));
    });

    it('1.26 [540 - can_view_occupied_attendance] - deve exibir o cartão "Permissão negada" (403 PERMISSION_DENIED) ao reabrir via "Iniciar Atendimento" um atendimento ocupado por outro atendente, quando revogada', () => {
      // Blindagem 100% mockada (AGENTS.md [R-BLIND]): não há como garantir, no tenant real, um
      // atendimento "Em andamento" de OUTRO atendente para o DEFAULT_CELULAR com 1 única conta de
      // teste (AGENTS.md [R-CAPXACAO]).
      // Contrato medido ao vivo contra a API real em 2026-10-09 (operador removeu a 540 da própria
      // conta e reproduziu manualmente, atendimento real 261000039): `GET /attendances/:id` responde
      // 403 `PERMISSION_DENIED` ("Permissão negada.") quando o atendimento pertence a OUTRO atendente
      // e a loja não tem a 540 — o bloqueio é no detalhe, não só na listagem (#1.3). O front renderiza
      // um estado dedicado (ícone de cadeado, `role="status"`) tanto na coluna do chat
      // (`_stateText_`, "Permissão negada.") quanto no painel direito (`_infoPanelPrompt_`, "Você não
      // tem permissão para visualizar este atendimento."), sem vazar nenhum conteúdo. **Achado de
      // teste corrigido no caminho:** uma 1ª versão deste teste mockava o detalhe como sempre bem-
      // sucedido (200) e concluiu, por engano, que a 540 vazava RBAC — o mock não representava o 403
      // real do backend; corrigido após o operador reproduzir ao vivo e eu confirmar via `cy.request`
      // direto na API real (`AGENTS.md [R-CAUSA]`: bug de teste, não de produto).
      // `interceptarCriacaoAtendimentoReutilizado` sem `customPayload` só mocka com `USE_MOCKS:true`
      // (`isMockEnabled()`); força aqui para o cenário sintético valer com qualquer flag da CLI.
      const originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);

      const idNum = 260899997;
      const outroAtendente = { id: 999887, name: 'Outro Atendente De Teste' };

      IniciarAtendimentoMocks.interceptarBuscaTemplatesWaba();
      IniciarAtendimentoMocks.interceptarChecagemWhatsapp(CELULAR_PADRAO);
      IniciarAtendimentoMocks.interceptarCriacaoAtendimentoReutilizado(true, idNum);

      const detailPayload = {
        attendance: {
          id: idNum,
          reference_at: '2026-08-28T19:09:14.164Z',
          attendant_name: outroAtendente.name,
          customer_name: 'CLIENTE OCUPADO POR OUTRO ATENDENTE',
          status: 1, // Em andamento
          channel: { id: 6, name: 'WHATSAPP OFICIAL - 62 98222-4382', type: 1, subtype: 1, official: true },
          group: { id: 7, name: 'ATENDIMENTO' },
          attendant: outroAtendente,
          attendant_id: outroAtendente.id,
          last_customer_message_at: new Date().toISOString(),
          service_window_active: true,
          service_window: { started_at: new Date().toISOString(), expires_at: new Date(Date.now() + 3600000).toISOString() }
        },
        customer: { name: 'CLIENTE OCUPADO POR OUTRO ATENDENTE', phone: `55${CELULAR_PADRAO}`, email: null, store_name: 'LOJA TESTE' },
        summaries: { quotes: { count: 0, total_amount: 0 }, payment_links: { count: 0, pending_confirmation_count: 0 } },
        capabilities: {
          can_view_attendance_detail: true,
          can_list_attendance_messages: true,
          can_send_attendance_messages: true,
          can_send_free_text: true,
          can_mark_completed: true,
          can_mark_discarded: true,
          can_mark_finished: true,
          can_transfer_assigned_attendance: true,
          can_transfer_pending_attendance: true
        }
      };
      AtendimentosMocks.interceptAttendanceDetailApi(idNum, detailPayload);
      AtendimentosMocks.interceptAttendanceItemCapabilitiesApi(idNum);
      AtendimentosMocks.interceptMessagesListApi(idNum, AtendimentosMocks.mockMessagesAtivas);
      AtendimentosMocks.interceptAttendanceMessageTemplatesApi(idNum);

      // 1. Act: reabre, via "Iniciar Atendimento", o número de um atendimento já "Em andamento" de
      //    OUTRO atendente (attendant_id !== logado) — redireciona para a conversa existente.
      IniciarAtendimentoPage.abrirModal();
      IniciarAtendimentoPage.validarESelecionarCanalOficialViaAPI();
      IniciarAtendimentoPage.validarESelecionarGrupoDoCanalViaAPI();
      IniciarAtendimentoPage.preencherCelular(CELULAR_PADRAO);

      IniciarAtendimentoPage.buscarESelecionarTemplateComVariavel().then(() => {
        IniciarAtendimentoPage.preencherMensagem('validacao permissao 540');
        IniciarAtendimentoPage.clicarEnviarMensagem();

        cy.url({ timeout: 15000 }).should('include', `attendance=${idNum}`);
        AtendimentosPage.elements.tituloAtendimentos().should('be.visible');
        cy.wait('@getAttendanceMessages');

        // 2. Caminho Concessão (baseline): com can_view_occupied_attendance:true (padrão do
        //    beforeEach global), o conteúdo do atendimento de outro atendente é visível normalmente.
        //    Retry nativo do `.should()` (nunca checagem única): a renderização do histórico segue
        //    alguns ciclos de React depois da resposta de rede (achado real desta investigação).
        cy.get('[class*="_bubbleRow_"]', { timeout: 10000 }).should('have.length.gte', 1).then(() => {
          validarDuploGrauPermissao({
            codigo: 540,
            capability: 'can_view_occupied_attendance',
            payloadValido: true,
            frontValido: true,
            esperaAtivo: true,
            mensagemSucesso: 'Mensagens do atendimento ocupado por outro atendente visíveis com can_view_occupied_attendance: true.',
            mensagemFalhaFront: 'Mensagens não renderizaram mesmo com can_view_occupied_attendance: true.'
          });
        });

        // 3. Caminho Revogação: revoga a 540 (loja) e, para a MESMA URL (?attendance=<id>, já
        //    fixada pelo redirecionamento), troca o mock do detalhe para o 403 PERMISSION_DENIED
        //    medido ao vivo contra a API real — reflete o que o backend realmente faz quando o
        //    atendimento pertence a outro atendente e a loja não tem a 540.
        cy.then(() => {
          AtendimentosMocks.interceptAttendanceCapabilitiesApi({
            capabilities: {
              can_access_attendance_module: true,
              can_create_attendance: true,
              can_view_pending_attendance: true,
              can_view_occupied_attendance: false,
              can_list_group_agents: true,
              can_change_attendant_status: true
            }
          });
          cy.intercept('GET', new RegExp(regexApi(`attendances/${idNum}([?#].*)?$`)), {
            statusCode: 403,
            body: { status: 403, error: 'Forbidden', message: 'Permissão negada.', code: 'PERMISSION_DENIED' }
          }).as('getAttendanceDetail');

          cy.reload();
          AtendimentosPage.elements.tituloAtendimentos().should('be.visible');
          cy.wait('@getAttendanceDetail');

          cy.contains('[role="status"]', 'Permissão negada.', { timeout: 10000 }).should('be.visible');
          cy.contains('[role="status"]', 'Você não tem permissão para visualizar este atendimento.').should('be.visible');

          cy.get('body').then(($body) => {
            const mensagensVisiveisSemPermissao = $body.find('[class*="_bubbleRow_"]').length > 0;

            validarDuploGrauPermissao({
              codigo: 540,
              capability: 'can_view_occupied_attendance',
              payloadValido: false,
              frontValido: mensagensVisiveisSemPermissao,
              esperaAtivo: false,
              mensagemFalhaVazamento: 'Mensagens/anexos do atendimento ocupado por outro atendente (attendant_id diferente do logado) ficaram visíveis mesmo com o backend respondendo 403 PERMISSION_DENIED no detalhe!'
            });
          });

          cy.then(() => Cypress.env('USE_MOCKS', originalUseMocksState));
        });
      });
    });

  });

  // ---------------------------------------------------------------------------------
  // CONTEXTO 2: PERMISSÕES DE CLIENTES — 100% MOCKADO [R-BLIND]
  // ---------------------------------------------------------------------------------
  // COMPARAÇÃO CAPABILITIES × PERMISSÕES LEGADAS (obrigatória antes de escrever os testes,
  // pedido do operador em 2026-09-28) — referência: docs/PERMISSION_REFERENCE.md
  // (seção "Ficha de Cliente CAD 0046", classificação CUSTOMER_DOMAIN).
  //
  // As 18 capabilities reais de GET /client-capabilities (medidas em
  // 0-A/0-B/0-C.backend-*.cy.js #71 e espelhadas em 7.clientesMocks.js _clientCapabilitiesDefaultBody()):
  //   can_create_client, can_update_client, can_deactivate_client, can_change_client_name,
  //   can_change_label_name, can_use_distinct_label_name, can_change_debt_status,
  //   can_change_discount_type, can_change_discount_percentage, can_change_free_delivery,
  //   can_change_weighing_notes, can_change_wildcard_client, can_create_client_without_address,
  //   can_create_client_without_document, can_create_client_without_phone,
  //   can_create_client_from_other_state_without_document, can_create_client_without_gender,
  //   can_view_hidden_lgpd_data.
  //
  // Confirmação por código legado, na seção CUSTOMER_DOMAIN (CAD 0046): 046
  // (can_save_customer_on_attendance), 650 (can_change_default_customer) e 658
  // (can_create_customer_without_gender) pertencem ao domínio ATENDIMENTO (fluxo de criar/trocar
  // cliente durante um atendimento, já coberto pelo context "Atendimentos - Permissões" acima), não
  // ao módulo /clientes standalone testado aqui. "658" nomeia inclusive uma capability
  // quase-homônima porém DISTINTA da nossa can_create_client_without_gender (customer vs client,
  // escopo attendance vs módulo clientes) — não são o mesmo código.
  //
  // 5 capabilities confirmadas pelo dev em 2026-09-30 (fonte: docs/architecture/permissions.md,
  // tabela gerada a partir dos catálogos, backend#580) — atualizado em docs/PERMISSION_REFERENCE.md:
  //   can_change_debt_status → 026 · can_change_client_name → 027 ·
  //   can_change_discount_type → 492 · can_change_free_delivery → 487 ·
  //   can_change_discount_percentage → 067 (tela distinta, FCS_CAD_0067, não fCAD_0046).
  //
  // Os demais 24 códigos CUSTOMER_DOMAIN do documento (443, 447, 555, 624, 309, 515, 528, 674, 064,
  // 066, 101, 186, 197, 378, 391, 461, 499, 503, 507, 510, 511, 513, 514, 633, 154, 235, 341, 690)
  // seguem `SCREEN_ACCESS`/`UNCONFIRMED` e sem capability sugerida — o próprio documento diz "Specs
  // de cliente devem criar catálogo próprio no domínio customer" (ainda não existe). As demais 13
  // capabilities reais sem código legado confirmado em nenhuma fonte seguem com a tag `[capability]`
  // (mesmo padrão já usado no context de Atendimentos para can_take_attendance), nunca
  // `[Permissão NNN]` — não há código legado a citar sem fabricá-lo (AGENTS.md [R-EVID]).
  context('2. Clientes - Permissões', () => {
    const CLIENT_ID = 700001;
    let originalUseMocksState;

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
    });

    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    beforeEach(() => {
      cy.login();
      ClientesMocks.interceptClientGroupsApi();
      ClientesMocks.interceptClientMovementClassesApi();
      ClientesMocks.interceptClientPostSaleClassesApi();
    });

    it('2.1 [046 - can_create_client] - deve exibir o botão "Novo cliente" só quando a capability de loja estiver concedida', () => {
      // 1. Caminho Concessão
      ClientesMocks.interceptClientCapabilitiesApi();
      ClientesPage.visitar();
      ClientesPage.elements.btnNovoCliente().should('be.visible').then(($btn) => {
        validarDuploGrauPermissao({
          codigo: '046',
          capability: 'can_create_client',
          payloadValido: true,
          frontValido: $btn.length > 0 && !$btn.prop('disabled'),
          esperaAtivo: true,
          mensagemSucesso: 'Botão "Novo cliente" visível e habilitado com can_create_client: true.',
          mensagemFalhaFront: 'Botão "Novo cliente" não foi encontrado na tela de listagem.'
        });
      });

      // 2. Caminho Revogação
      ClientesMocks.interceptClientCapabilitiesApi({ capabilities: { can_create_client: false } });
      cy.reload();
      cy.get('body', { timeout: 10000 }).then(($body) => {
        const btnExiste = $body.find('[data-testid="button-new-client"]').length > 0;
        validarDuploGrauPermissao({
          codigo: '046',
          capability: 'can_create_client',
          payloadValido: false,
          frontValido: btnExiste,
          esperaAtivo: false,
          mensagemFalhaVazamento: 'Botão "Novo cliente" permaneceu no DOM mesmo com can_create_client: false!'
        });
      });
    });

    it('2.2 [046 - can_update_client] - deve permitir editar a ficha e exibir "Salvar dados" só quando a capability estiver concedida', () => {
      // 1. Caminho Concessão
      ClientesMocks.interceptClientDetailApi(CLIENT_ID, {
        ...ClientesMocks.mockClientDetailEditData,
        capabilities: { ...ClientesMocks.mockClientDetailEditData.capabilities, can_update_client: true }
      });
      ClientesPage.visitarFicha(CLIENT_ID);
      ClientesPage.elements.inputNomeFicha().should('be.visible').then(($input) => {
        const frontOk = !$input.prop('disabled');
        validarDuploGrauPermissao({
          codigo: '046',
          capability: 'can_update_client',
          payloadValido: true,
          frontValido: frontOk,
          esperaAtivo: true,
          mensagemSucesso: 'Campo Nome editável e ficha em modo de edição com can_update_client: true.',
          mensagemFalhaFront: 'Campo Nome não estava habilitado para edição.'
        });
      });
      ClientesPage.elements.btnSalvarFicha().should('exist');

      // 2. Caminho Revogação: ficha inteira vira somente leitura (footer com "Salvar dados" some)
      ClientesMocks.interceptClientDetailApi(CLIENT_ID, {
        ...ClientesMocks.mockClientDetailEditData,
        capabilities: { ...ClientesMocks.mockClientDetailEditData.capabilities, can_update_client: false }
      });
      ClientesPage.visitarFicha(CLIENT_ID);
      ClientesPage.elements.inputNomeFicha().should('be.visible').then(($input) => {
        const frontAtivo = !$input.prop('disabled');
        validarDuploGrauPermissao({
          codigo: '046',
          capability: 'can_update_client',
          payloadValido: false,
          frontValido: frontAtivo,
          esperaAtivo: false,
          mensagemFalhaVazamento: 'Campo Nome permaneceu editável mesmo com can_update_client: false!'
        });
      });
      ClientesPage.elements.btnSalvarFicha().should('not.exist');
    });

    it('2.3 [046 - can_deactivate_client] - deve permitir alternar o cliente para inativo só quando a capability estiver concedida', () => {
      // 1. Caminho Concessão
      ClientesMocks.interceptClientDetailApi(CLIENT_ID, {
        ...ClientesMocks.mockClientDetailEditData,
        capabilities: { ...ClientesMocks.mockClientDetailEditData.capabilities, can_deactivate_client: true }
      });
      ClientesPage.visitarFicha(CLIENT_ID);
      ClientesPage.elements.checkboxAtivoFicha().should('be.visible').then(($checkbox) => {
        validarDuploGrauPermissao({
          codigo: '046',
          capability: 'can_deactivate_client',
          payloadValido: true,
          frontValido: !$checkbox.prop('disabled'),
          esperaAtivo: true,
          mensagemSucesso: 'Toggle "Ativo" habilitado com can_deactivate_client: true.',
          mensagemFalhaFront: 'Toggle "Ativo" não foi encontrado ou está sempre habilitado.'
        });
      });

      // 2. Caminho Revogação
      ClientesMocks.interceptClientDetailApi(CLIENT_ID, {
        ...ClientesMocks.mockClientDetailEditData,
        capabilities: { ...ClientesMocks.mockClientDetailEditData.capabilities, can_deactivate_client: false }
      });
      ClientesPage.visitarFicha(CLIENT_ID);
      ClientesPage.elements.checkboxAtivoFicha().should('be.visible').then(($checkbox) => {
        validarDuploGrauPermissao({
          codigo: '046',
          capability: 'can_deactivate_client',
          payloadValido: false,
          frontValido: !$checkbox.prop('disabled'),
          esperaAtivo: false,
          mensagemFalhaVazamento: 'Toggle "Ativo" permaneceu clicável mesmo com can_deactivate_client: false!'
        });
      });
    });

    it('2.4 [026 - can_change_debt_status] - deve permitir alternar "Em débito" só quando a capability estiver concedida', () => {
      // 1. Caminho Concessão
      ClientesMocks.interceptClientDetailApi(CLIENT_ID, {
        ...ClientesMocks.mockClientDetailEditData,
        capabilities: { ...ClientesMocks.mockClientDetailEditData.capabilities, can_change_debt_status: true }
      });
      ClientesPage.visitarFicha(CLIENT_ID);
      ClientesPage.elements.checkboxEmDebitoFicha().should('be.visible').then(($checkbox) => {
        validarDuploGrauPermissao({
          codigo: 'can_change_debt_status',
          capability: 'can_change_debt_status',
          payloadValido: true,
          frontValido: !$checkbox.prop('disabled'),
          esperaAtivo: true,
          mensagemSucesso: 'Checkbox "Em débito" habilitado com can_change_debt_status: true.',
          mensagemFalhaFront: 'Checkbox "Em débito" não foi encontrado ou está sempre habilitado.'
        });
      });

      // 2. Caminho Revogação
      ClientesMocks.interceptClientDetailApi(CLIENT_ID, {
        ...ClientesMocks.mockClientDetailEditData,
        capabilities: { ...ClientesMocks.mockClientDetailEditData.capabilities, can_change_debt_status: false }
      });
      ClientesPage.visitarFicha(CLIENT_ID);
      ClientesPage.elements.checkboxEmDebitoFicha().should('be.visible').then(($checkbox) => {
        validarDuploGrauPermissao({
          codigo: 'can_change_debt_status',
          capability: 'can_change_debt_status',
          payloadValido: false,
          frontValido: !$checkbox.prop('disabled'),
          esperaAtivo: false,
          mensagemFalhaVazamento: 'Checkbox "Em débito" permaneceu clicável mesmo com can_change_debt_status: false!'
        });
      });
    });

    it('2.5 [027 - can_change_client_name] - deve permitir editar o campo Nome só quando a capability estiver concedida', () => {
      // 1. Caminho Concessão
      ClientesMocks.interceptClientDetailApi(CLIENT_ID, {
        ...ClientesMocks.mockClientDetailEditData,
        capabilities: { ...ClientesMocks.mockClientDetailEditData.capabilities, can_change_client_name: true }
      });
      ClientesPage.visitarFicha(CLIENT_ID);
      ClientesPage.elements.inputNomeFicha().should('be.visible').then(($input) => {
        validarDuploGrauPermissao({
          codigo: 'can_change_client_name',
          capability: 'can_change_client_name',
          payloadValido: true,
          frontValido: !$input.prop('disabled'),
          esperaAtivo: true,
          mensagemSucesso: 'Campo Nome editável com can_change_client_name: true.',
          mensagemFalhaFront: 'Campo Nome está desabilitado mesmo com a capability concedida.'
        });
      });

      // 2. Caminho Revogação
      ClientesMocks.interceptClientDetailApi(CLIENT_ID, {
        ...ClientesMocks.mockClientDetailEditData,
        capabilities: { ...ClientesMocks.mockClientDetailEditData.capabilities, can_change_client_name: false }
      });
      ClientesPage.visitarFicha(CLIENT_ID);
      ClientesPage.elements.inputNomeFicha().should('be.visible').then(($input) => {
        validarDuploGrauPermissao({
          codigo: 'can_change_client_name',
          capability: 'can_change_client_name',
          payloadValido: false,
          frontValido: !$input.prop('disabled'),
          esperaAtivo: false,
          mensagemFalhaVazamento: 'Campo Nome permaneceu editável mesmo com can_change_client_name: false!'
        });
      });
    });

    it('2.6 [492 - can_change_discount_type] - deve permitir editar o tipo de desconto só quando a capability estiver concedida', () => {
      // 1. Caminho Concessão
      ClientesMocks.interceptClientDetailApi(CLIENT_ID, {
        ...ClientesMocks.mockClientDetailEditData,
        capabilities: { ...ClientesMocks.mockClientDetailEditData.capabilities, can_change_discount_type: true }
      });
      ClientesPage.visitarFicha(CLIENT_ID);
      ClientesPage.elements.inputTipoDescontoFicha().scrollIntoView().should('be.visible').then(($input) => {
        validarDuploGrauPermissao({
          codigo: 'can_change_discount_type',
          capability: 'can_change_discount_type',
          payloadValido: true,
          frontValido: !$input.prop('disabled'),
          esperaAtivo: true,
          mensagemSucesso: 'Campo Tipo de Desconto editável com can_change_discount_type: true.',
          mensagemFalhaFront: 'Campo Tipo de Desconto está desabilitado mesmo com a capability concedida.'
        });
      });

      // 2. Caminho Revogação
      ClientesMocks.interceptClientDetailApi(CLIENT_ID, {
        ...ClientesMocks.mockClientDetailEditData,
        capabilities: { ...ClientesMocks.mockClientDetailEditData.capabilities, can_change_discount_type: false }
      });
      ClientesPage.visitarFicha(CLIENT_ID);
      ClientesPage.elements.inputTipoDescontoFicha().scrollIntoView().should('be.visible').then(($input) => {
        validarDuploGrauPermissao({
          codigo: 'can_change_discount_type',
          capability: 'can_change_discount_type',
          payloadValido: false,
          frontValido: !$input.prop('disabled'),
          esperaAtivo: false,
          mensagemFalhaVazamento: 'Campo Tipo de Desconto permaneceu editável mesmo com can_change_discount_type: false!'
        });
      });
    });

    it('2.7 [067 - can_change_discount_percentage] - deve permitir editar o percentual de desconto só quando a capability estiver concedida', () => {
      // 1. Caminho Concessão
      ClientesMocks.interceptClientDetailApi(CLIENT_ID, {
        ...ClientesMocks.mockClientDetailEditData,
        capabilities: { ...ClientesMocks.mockClientDetailEditData.capabilities, can_change_discount_percentage: true }
      });
      ClientesPage.visitarFicha(CLIENT_ID);
      ClientesPage.elements.inputPercentualDescontoFicha().scrollIntoView().should('be.visible').then(($input) => {
        validarDuploGrauPermissao({
          codigo: 'can_change_discount_percentage',
          capability: 'can_change_discount_percentage',
          payloadValido: true,
          frontValido: !$input.prop('disabled'),
          esperaAtivo: true,
          mensagemSucesso: 'Campo % Desconto editável com can_change_discount_percentage: true.',
          mensagemFalhaFront: 'Campo % Desconto está desabilitado mesmo com a capability concedida.'
        });
      });

      // 2. Caminho Revogação
      ClientesMocks.interceptClientDetailApi(CLIENT_ID, {
        ...ClientesMocks.mockClientDetailEditData,
        capabilities: { ...ClientesMocks.mockClientDetailEditData.capabilities, can_change_discount_percentage: false }
      });
      ClientesPage.visitarFicha(CLIENT_ID);
      ClientesPage.elements.inputPercentualDescontoFicha().scrollIntoView().should('be.visible').then(($input) => {
        validarDuploGrauPermissao({
          codigo: 'can_change_discount_percentage',
          capability: 'can_change_discount_percentage',
          payloadValido: false,
          frontValido: !$input.prop('disabled'),
          esperaAtivo: false,
          mensagemFalhaVazamento: 'Campo % Desconto permaneceu editável mesmo com can_change_discount_percentage: false!'
        });
      });
    });

    it('2.8 [487 - can_change_free_delivery] - deve permitir alternar "Entrega grátis" só quando a capability estiver concedida', () => {
      // 1. Caminho Concessão
      ClientesMocks.interceptClientDetailApi(CLIENT_ID, {
        ...ClientesMocks.mockClientDetailEditData,
        capabilities: { ...ClientesMocks.mockClientDetailEditData.capabilities, can_change_free_delivery: true }
      });
      ClientesPage.visitarFicha(CLIENT_ID);
      ClientesPage.elements.checkboxEntregaGratisFicha().scrollIntoView().should('be.visible').then(($checkbox) => {
        validarDuploGrauPermissao({
          codigo: 'can_change_free_delivery',
          capability: 'can_change_free_delivery',
          payloadValido: true,
          frontValido: !$checkbox.prop('disabled'),
          esperaAtivo: true,
          mensagemSucesso: 'Checkbox "Entrega grátis" habilitado com can_change_free_delivery: true.',
          mensagemFalhaFront: 'Checkbox "Entrega grátis" está desabilitado mesmo com a capability concedida.'
        });
      });

      // 2. Caminho Revogação
      ClientesMocks.interceptClientDetailApi(CLIENT_ID, {
        ...ClientesMocks.mockClientDetailEditData,
        capabilities: { ...ClientesMocks.mockClientDetailEditData.capabilities, can_change_free_delivery: false }
      });
      ClientesPage.visitarFicha(CLIENT_ID);
      ClientesPage.elements.checkboxEntregaGratisFicha().scrollIntoView().should('be.visible').then(($checkbox) => {
        validarDuploGrauPermissao({
          codigo: 'can_change_free_delivery',
          capability: 'can_change_free_delivery',
          payloadValido: false,
          frontValido: !$checkbox.prop('disabled'),
          esperaAtivo: false,
          mensagemFalhaVazamento: 'Checkbox "Entrega grátis" permaneceu clicável mesmo com can_change_free_delivery: false!'
        });
      });
    });

    it('2.9 [341 - can_change_label_name] - deve permitir editar o Nome fantasia da pessoa jurídica só quando a capability estiver concedida, sem travar a Razão Social nem o Nome da pessoa física', () => {
      // Ficha PJ com as chaves medidas na API real em 2026-11-06 (GET /clients/:id de uma PJ: person_type 2, label_name = fantasia, name = razão social).
      // No front (EditClientNameFields), na PJ o campo ao lado do código é o fantasia e trava por can_change_label_name; a Razão Social trava pela 027 e, na PF, o Nome também.
      const fichaPJ = (capabilities) => ({
        ...ClientesMocks.mockClientDetailEditData,
        person_type: 2,
        label_name: 'Fantasia Ficha E2E',
        name: 'Razao Social Ficha E2E LTDA',
        document: null,
        birth_date: null,
        identity_document: null,
        issuing_body: 'IE',
        capabilities: { ...ClientesMocks.mockClientDetailEditData.capabilities, can_change_client_name: true, ...capabilities }
      });

      // 1. Caminho Concessão: fantasia e razão social editáveis
      ClientesMocks.interceptClientDetailApi(CLIENT_ID, fichaPJ({ can_change_label_name: true }));
      ClientesPage.visitarFicha(CLIENT_ID);
      ClientesPage.elements.inputNomeFicha().should('be.visible').and('have.value', 'Fantasia Ficha E2E').then(($input) => {
        validarDuploGrauPermissao({
          codigo: '341',
          capability: 'can_change_label_name',
          payloadValido: true,
          frontValido: !$input.prop('disabled'),
          esperaAtivo: true,
          mensagemSucesso: 'Nome fantasia editável com can_change_label_name: true.',
          mensagemFalhaFront: 'Nome fantasia está desabilitado mesmo com a capability concedida.'
        });
      });
      ClientesPage.elements.inputRazaoSocialFicha().should('have.value', 'Razao Social Ficha E2E LTDA').and('not.be.disabled');

      // 2. Caminho Revogação: só o fantasia trava; a Razão Social segue a 027 (concedida) e continua editável
      ClientesMocks.interceptClientDetailApi(CLIENT_ID, fichaPJ({ can_change_label_name: false }));
      ClientesPage.visitarFicha(CLIENT_ID);
      ClientesPage.elements.inputNomeFicha().should('be.visible').and('have.value', 'Fantasia Ficha E2E').then(($input) => {
        validarDuploGrauPermissao({
          codigo: '341',
          capability: 'can_change_label_name',
          payloadValido: false,
          frontValido: !$input.prop('disabled'),
          esperaAtivo: false,
          mensagemFalhaVazamento: 'Nome fantasia permaneceu editável mesmo com can_change_label_name: false!'
        });
      });
      ClientesPage.elements.inputRazaoSocialFicha().should('have.value', 'Razao Social Ficha E2E LTDA').and('not.be.disabled');

      // 3. Contraprova na PF: sem a 341 o Nome continua editável, porque na pessoa física ele segue a 027
      ClientesMocks.interceptClientDetailApi(CLIENT_ID, {
        ...ClientesMocks.mockClientDetailEditData,
        capabilities: { ...ClientesMocks.mockClientDetailEditData.capabilities, can_change_client_name: true, can_change_label_name: false }
      });
      ClientesPage.visitarFicha(CLIENT_ID);
      ClientesPage.elements.inputNomeFicha().should('be.visible').and('have.value', 'Cliente Ficha Teste E2E').and('not.be.disabled');
      ClientesPage.elements.inputRazaoSocialFicha().should('not.exist');
    });

  });

  // ---------------------------------------------------------------------------------
  // CONTEXTO 3: PERMISSÕES DE RECEITAS (Issue backend#657/PR #706)
  // ---------------------------------------------------------------------------------
  // Contexto de front contra API real ([R-BLIND]: USE_MOCKS=false no before). O front passou a chamar as rotas de receita SEM o prefixo /stores/:id (`GET /prescriptions/:id`,
  // `POST /prescriptions/:id/formulas/:id/calculate`, `GET /prescription-capabilities`, medido em 2026-10-19), então os mocks por `**/prescriptions/...` não casam mais.
  // A receita nasce pela API (1 por rodada: receita não tem DELETE) com a fórmula 1 em dose acima do máximo cadastrado da BUPROPIONA.
  // Concessão: a conta de teste tem a 621, o Calcular real passa e o diálogo mostra o aviso da dose. Revogação: capability false e 403 forçado no calculate (a conta tem o
  // grant, então a recusa real não existe; o corpo do 403 é o da nota da PR #706, não medido). Medido na UI real: com o 403 a tela mostra só "Você não tem permissão para
  // esta ação", não mostra a mensagem do backend e não pede autorização (nenhum POST em /authorization-requests); a QA da PR #706 fala em "pedir a autorização pelo front".
  context('3. Receitas - Permissões', () => {
    const BUPROPIONA = 1001889;
    let originalUseMocksState;
    let receitaId;
    let nomeDoProduto;

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', false);
      api.autenticar().then(() => api.obterUsuarioLogado()).then((resMe) => {
        const storeId = resMe.body.store_code || resMe.body.store_id;
        api.listarProdutos(storeId, { usage: 'human', q: 'BUPROPIONA', limit: 10 }).then((resProd) => {
          const produto = (resProd.body?.items || []).find((p) => p.id === BUPROPIONA);
          expect(produto, '🔒 BUPROPIONA no catálogo (GET /products)').to.be.ok;
          expect(produto.check_max, '🔒 CHECARMAX ligado na BUPROPIONA').to.eq(true);
          expect(produto.max_unit, '🔒 unidade do máximo da BUPROPIONA').to.eq('mg');
          nomeDoProduto = produto.name.trim();
          const doseForaDoIntervalo = Number(produto.max_quantity) * 2;
          api.buscarClientes(storeId, configEnv.DEFAULT_CLIENT_NAME).then((resCli) => {
            const cliente = (resCli.body && (resCli.body.items || resCli.body))[0];
            expect(cliente && cliente.id, '🔒 DEFAULT_CLIENT_NAME não achou cliente (massa)').to.be.ok;
            api.criarPrescricao(storeId, {
              prescription_type: 'human',
              status: 0,
              sale_type: 1,
              patient_id: cliente.id,
              patient_name: cliente.name,
              buyer_id: cliente.id,
              buyer_name: cliente.name,
              prescriber_id: 18780,
              pickup_store_id: storeId,
            }).then((resPresc) => {
              expect(resPresc.status, 'Status da criação da receita de teste').to.eq(201);
              receitaId = resPresc.body.id;
              api.criarFormulaPrescricao(storeId, receitaId, {
                formula_number: 1, pharmaceutical_form_id: 2, lab_id: 2, qvd: 30.0, multiplier: 1,
              }).then((resFormula) => {
                expect(resFormula.status, 'Status da criação da fórmula de teste').to.eq(201);
                api.adicionarProdutoFormula(storeId, receitaId, resFormula.body.id, { product_id: BUPROPIONA, quantity: doseForaDoIntervalo, unit: 'mg' }).then((resProduto) => {
                  expect(resProduto.status, 'Status do produto em dose fora do intervalo').to.eq(201);
                });
              });
            });
          });
        });
      });
    });

    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    beforeEach(() => {
      cy.login();
      ReceitasMocks.interceptRumTelemetry();
    });

    it('3.1 [621 - can_calculate_out_of_range_dosage] - deve calcular a fórmula com dose fora do intervalo e mostrar o aviso da dose só quando a capability estiver concedida', () => {
      let capabilitiesReais;
      cy.intercept('GET', '**/prescription-capabilities*', (req) => {
        req.continue((res) => { capabilitiesReais = res.body && res.body.capabilities; });
      }).as('getCapabilities');
      cy.intercept('POST', '**/formulas/*/calculate').as('postCalcularFormula');

      // 1. Caminho Concessão: o Calcular real passa e o diálogo lista o produto com a dose acima do intervalo
      ReceitasPage.abrirReceitaGravada(receitaId);
      cy.wait('@getCapabilities');
      ReceitasPage.elements.btnCalcular().should('not.be.disabled').click();
      cy.wait('@postCalcularFormula');
      ReceitasPage.elements.avisoDoCalculo().should('be.visible').then(($dialogo) => {
        const texto = $dialogo.text();
        validarDuploGrauPermissao({
          codigo: '621',
          capability: 'can_calculate_out_of_range_dosage',
          payloadValido: capabilitiesReais && capabilitiesReais.can_calculate_out_of_range_dosage === true,
          frontValido: texto.includes(`${nomeDoProduto} com quantidade acima do intervalo cadastrado.`),
          esperaAtivo: true,
          mensagemSucesso: 'O Calcular real passou e o diálogo mostrou a dose acima do intervalo com can_calculate_out_of_range_dosage: true.',
          mensagemFalhaFront: 'O diálogo do Calcular não trouxe o aviso de dose acima do intervalo (ou a conta não tem a 621: o Calcular foi recusado).'
        });
      });
      ReceitasPage.elements.avisoDoCalculoOk().click();

      // 2. Caminho Revogação: capability false e a recusa 403 AUTHORIZATION_REQUIRED no calculate (forçada: a conta tem o grant)
      cy.intercept('GET', '**/prescription-capabilities*', (req) => {
        req.continue((res) => {
          res.body = { ...res.body, capabilities: { ...res.body.capabilities, can_calculate_out_of_range_dosage: false } };
        });
      }).as('getCapabilitiesSem621');
      cy.intercept('POST', '**/formulas/*/calculate', {
        statusCode: 403,
        body: {
          status: 403,
          error: 'Forbidden',
          message: `Dosagem fora do intervalo cadastrado: ${nomeDoProduto} (acima). Solicite autorização.`,
          error_code: 'AUTHORIZATION_REQUIRED',
          authorization_context: { operation: 'prescription.calculate', resource_type: 'prescription', resource_id: receitaId, required_grants: [621] },
          timestamp: new Date().toISOString(),
        },
      }).as('postCalcularFormulaRecusado');
      ReceitasPage.abrirReceitaGravada(receitaId);
      cy.wait('@getCapabilitiesSem621').its('response.body.capabilities.can_calculate_out_of_range_dosage').should('eq', false);
      ReceitasPage.elements.btnCalcular().should('not.be.disabled').click();
      cy.wait('@postCalcularFormulaRecusado');
      ReceitasPage.elements.avisoDoCalculo().should('be.visible').then(($dialogo) => {
        const texto = $dialogo.text();
        validarDuploGrauPermissao({
          codigo: '621',
          capability: 'can_calculate_out_of_range_dosage',
          payloadValido: false,
          frontValido: texto.includes('com quantidade acima do intervalo cadastrado.'),
          esperaAtivo: false,
          mensagemFalhaVazamento: 'O diálogo mostrou a dose aceita mesmo com can_calculate_out_of_range_dosage: false e o calculate recusado!'
        });
        expect(texto, 'A tela recusa por falta de permissão').to.contain('Você não tem permissão para esta ação');
      });
    });

    // Issue front#570/PR #592 (a parte de front do épico das capabilities da receita; o backend é a #707, `0-C` ctx 25 a 28): o gate da tela passa a depender só de `true` explícito.
    // Medido na UI real em 2026-10-22: o Múltiplo (`formula-multiple`) e o QVD (`formula-total-multiple`, rótulo "Total múltiplo") ficam desabilitados e somente leitura com
    // `formulas[].capabilities.can_update_formula: false`; com `capabilities: {}` o convênio (`pessoa-convenio-nome` e `-buscar`) fica desabilitado e a aba Rastreabilidade não mostra a
    // tabela nem o Editar (painel vazio); com 404 na rota a aba nem renderiza o painel. O Editar do processo do operador (funcionário do processo = `user_id` do token) aparece sempre e o de outro funcionário
    // só com `can_update_other_employee_process` (grant 231). Capabilities e processos entram por resposta estática (a conta tem todas as capabilities e a receita de teste não tem processos).
    const editavel = ($campo) => !$campo[0].disabled && !$campo[0].readOnly;

    it('3.2 [can_update_formula] - deve bloquear o Múltiplo e o QVD da fórmula gravada só quando a capability da fórmula estiver revogada', () => {
      let capacidadeReal;
      cy.intercept('GET', /\/prescriptions\/\d+(\?.*)?$/, (req) => {
        req.continue((res) => { capacidadeReal = res.body.formulas[0].capabilities.can_update_formula; });
      }).as('getDetalheReal');

      // 1. Caminho Concessão: a fórmula gravada vem com can_update_formula true e os dois campos ficam editáveis
      ReceitasPage.abrirReceitaGravada(receitaId);
      cy.wait('@getDetalheReal');
      ReceitasPage.elements.multiploDaFormula().then(($multiplo) => {
        ReceitasPage.elements.totalMultiplo().then(($qvd) => {
          validarDuploGrauPermissao({
            codigo: 'fórmula',
            capability: 'can_update_formula',
            payloadValido: capacidadeReal === true,
            frontValido: editavel($multiplo) && editavel($qvd),
            esperaAtivo: true,
            mensagemSucesso: 'Múltiplo e QVD editáveis com can_update_formula: true.',
            mensagemFalhaFront: 'Múltiplo ou QVD ficou bloqueado mesmo com can_update_formula: true.'
          });
        });
      });

      // 2. Caminho Revogação: o mesmo detalhe com can_update_formula false (a conta tem a capability, então a revogação é forçada na resposta)
      cy.intercept('GET', /\/prescriptions\/\d+(\?.*)?$/, (req) => {
        req.continue((res) => {
          res.body = { ...res.body, formulas: (res.body.formulas || []).map((f) => ({ ...f, capabilities: { ...f.capabilities, can_update_formula: false } })) };
        });
      }).as('getDetalheSemEdicao');
      ReceitasPage.abrirReceitaGravada(receitaId);
      cy.wait('@getDetalheSemEdicao').its('response.body.formulas.0.capabilities.can_update_formula').should('eq', false);
      ReceitasPage.elements.multiploDaFormula().then(($multiplo) => {
        ReceitasPage.elements.totalMultiplo().then(($qvd) => {
          validarDuploGrauPermissao({
            codigo: 'fórmula',
            capability: 'can_update_formula',
            payloadValido: false,
            frontValido: editavel($multiplo) || editavel($qvd),
            esperaAtivo: false,
            mensagemFalhaVazamento: 'O Múltiplo ou o QVD ficou editável mesmo com can_update_formula: false (antes da PR #592 os dois ignoravam a capability)!'
          });
        });
      });
    });

    it('3.3 [231 - can_update_other_employee_process] - deve mostrar o Editar do processo do próprio operador sempre e o de outro funcionário ou sem funcionário só com a capability', () => {
      const PROCESSO_PROPRIO = 910001;
      const PROCESSO_DE_OUTRO = 910002;
      const PROCESSO_SEM_FUNCIONARIO = 910003;
      // O "processo do próprio operador" compara o funcionário com o user_id de quem está logado NO NAVEGADOR (`cy.login` usa Cypress.env('user'); o CI loga com outra conta que o env.json),
      // mas `api.autenticar` usa sempre o env.json: o user_id do service seria o de outra conta e o Editar do processo próprio nunca apareceria. Por isso o user_id vem da conta do navegador.
      let userId;
      const apiUrl = configEnv.API_URL || 'https://api.omnicare.dev.local';
      cy.request({
        method: 'POST',
        url: `${apiUrl}/auth/login`,
        body: {
          cnpj: Cypress.env('userCnpj') || configEnv.USER_CNPJ,
          username: Cypress.env('user') || configEnv.USER_CODE,
          password: Cypress.env('userPassword') || configEnv.USER_PASSWORD
        },
        log: false
      }).then((resLogin) => cy.request({
        url: `${apiUrl}/users/me`,
        headers: { Authorization: `Bearer ${resLogin.body.token || resLogin.body.access_token}` }
      })).then((resMeNavegador) => {
        userId = resMeNavegador.body.user_id;
        expect(userId, 'user_id da conta logada no navegador').to.be.a('number');
      });
      api.obterUsuarioLogado().then((resMe) => {
        const storeId = resMe.body.store_code || resMe.body.store_id;
        api.obterCapabilitiesReceitas(storeId).then((resCaps) => {
          api.obterDetalhePrescricao(storeId, receitaId).then((resDetalhe) => {
            const formulaId = resDetalhe.body.formulas[0].id;
            // Formato medido na API real em 2026-10-22: `{ items: [...] }` com process_type_id/process_type_name, date e time (a fixture padrão manipulationProcesses.json, um array com process_name, está defasada)
            const processo = (id, sequencia, funcionarioId, nome) => ({
              id, process_type_id: sequencia, process_type_name: 'PESAGEM SOLIDOS', employee_id: funcionarioId, employee_name: nome, date: '2026-10-22', time: '10:00', sequence: sequencia, commissioned: false, blocks_calculation: false, blocks_prescription: false
            });
            const processos = { items: [processo(PROCESSO_PROPRIO, 1, userId, 'OPERADOR LOGADO'), processo(PROCESSO_DE_OUTRO, 2, userId + 1, 'OUTRO FUNCIONARIO'), processo(PROCESSO_SEM_FUNCIONARIO, 3, null, null)] };
            const abrirRastreabilidade = (podeEditarOutro) => {
              ReceitasMocks.interceptPrescriptionCapabilitiesApi({ ...resCaps.body, capabilities: { ...resCaps.body.capabilities, can_update_other_employee_process: podeEditarOutro } });
              ReceitasMocks.interceptGetManipulationProcessesApi(receitaId, formulaId, processos);
              ReceitasPage.abrirReceitaGravada(receitaId);
              ReceitasPage.elements.abaRastreabilidade().click();
              ReceitasPage.elements.carregandoRastreabilidade().should('not.exist');
            };

            // 1. Caminho Concessão: com a capability, o Editar aparece nos dois processos
            abrirRastreabilidade(true);
            ReceitasPage.elements.btnEditarProcesso(PROCESSO_PROPRIO).should('exist');
            cy.get('body').then(($body) => {
              validarDuploGrauPermissao({
                codigo: '231',
                capability: 'can_update_other_employee_process',
                payloadValido: true,
                frontValido: $body.find(`[data-testid="receita-rastreabilidade-editar-${PROCESSO_DE_OUTRO}"]`).length > 0 && $body.find(`[data-testid="receita-rastreabilidade-editar-${PROCESSO_SEM_FUNCIONARIO}"]`).length > 0,
                esperaAtivo: true,
                mensagemSucesso: 'O Editar do processo de outro funcionário apareceu com can_update_other_employee_process: true.',
                mensagemFalhaFront: 'O Editar do processo de outro funcionário ou do processo sem funcionário não apareceu mesmo com can_update_other_employee_process: true.'
              });
            });

            // 2. Caminho Revogação: sem a capability o processo do operador segue editável (compara o funcionário com o user_id do token) e o de outro some
            abrirRastreabilidade(false);
            ReceitasPage.elements.btnEditarProcesso(PROCESSO_PROPRIO).should('exist');
            cy.get('body').then(($body) => {
              validarDuploGrauPermissao({
                codigo: '231',
                capability: 'can_update_other_employee_process',
                payloadValido: false,
                frontValido: $body.find(`[data-testid="receita-rastreabilidade-editar-${PROCESSO_DE_OUTRO}"]`).length > 0 || $body.find(`[data-testid="receita-rastreabilidade-editar-${PROCESSO_SEM_FUNCIONARIO}"]`).length > 0,
                esperaAtivo: false,
                mensagemFalhaVazamento: 'O Editar do processo de outro funcionário ou do processo sem funcionário apareceu com can_update_other_employee_process: false (antes da PR #592 o sem funcionário era editável e o backend respondia 403)!'
              });
            });
          });
        });
      });
    });

    it('3.4 [capabilities vazias] - deve operar fail-closed: sem nenhuma chave nas capabilities da conta, o convênio fica desabilitado e a aba Rastreabilidade não libera os processos', () => {
      // 1. Contraprova: com as capabilities reais da conta (can_update_covenant true) o convênio fica habilitado
      ReceitasPage.abrirReceitaGravada(receitaId);
      ReceitasPage.elements.convenioNome().should('not.be.disabled');
      ReceitasPage.elements.convenioBuscar().should('not.be.disabled');
      ReceitasPage.elements.abaRastreabilidade().should('not.have.attr', 'aria-disabled', 'true');

      // 2. Capabilities vazias: nada é liberado por omissão
      ReceitasMocks.interceptPrescriptionCapabilitiesApi({ capabilities: {} });
      ReceitasPage.abrirReceitaGravada(receitaId);
      ReceitasPage.elements.convenioNome().should('be.disabled');
      ReceitasPage.elements.convenioBuscar().should('be.disabled');
      // A aba fica travada e avisa o motivo pelo title (medido em 2026-10-22: aria-disabled=true e a mensagem abaixo)
      ReceitasPage.elements.abaRastreabilidade().should('have.attr', 'aria-disabled', 'true').and('have.attr', 'title').and('contain', 'Você não tem permissão para acessar os processos de manipulação');
      ReceitasPage.elements.abaRastreabilidade().click();
      ReceitasPage.elements.carregandoRastreabilidade().should('not.exist');
      ReceitasPage.elements.tabelaRastreabilidade().should('not.exist');
      ReceitasPage.elements.botoesEditarProcesso().should('not.exist');
    });

    it('3.5 [capabilities indisponíveis] - deve manter o convênio desabilitado e a aba Rastreabilidade sem painel quando a rota das capabilities da conta falha (404 e 500)', () => {
      [404, 500].forEach((statusCode) => {
        cy.intercept('GET', '**/prescription-capabilities*', { statusCode, body: { status: statusCode, error: statusCode === 404 ? 'Not Found' : 'Internal Server Error' } }).as(`getCapabilities${statusCode}`);
        ReceitasPage.abrirReceitaGravada(receitaId);
        cy.wait(`@getCapabilities${statusCode}`);
        ReceitasPage.elements.convenioNome().should('be.disabled');
        ReceitasPage.elements.convenioBuscar().should('be.disabled');
        // Rota fora do ar não é falta de permissão: a aba não mostra o aviso de permissão (fica pendente)
        ReceitasPage.elements.abaRastreabilidade().should($aba => {
          expect($aba.attr('title') || '', 'title da aba com a rota em ' + statusCode).not.to.contain('permissão');
        });
        ReceitasPage.elements.abaRastreabilidade().click();
        ReceitasPage.elements.painelRastreabilidade().should('not.exist');
        ReceitasPage.elements.botoesEditarProcesso().should('not.exist');
      });
    });


    it('3.6 [can_update_formula] - deve deixar o Múltiplo e o QVD da fórmula nova editáveis mesmo com as fórmulas gravadas bloqueadas, porque o Gravar é quem as cria', () => {
      // Só a fórmula que o Gravar vai criar (rascunho ou acrescentada com a seta ↑) fica livre; as gravadas seguem can_update_formula (forçado em false no detalhe)
      cy.intercept('GET', /\/prescriptions\/\d+(\?.*)?$/, (req) => {
        req.continue((res) => {
          res.body = { ...res.body, formulas: (res.body.formulas || []).map((f) => ({ ...f, capabilities: { ...f.capabilities, can_update_formula: false } })) };
        });
      }).as('getDetalheSemEdicao');
      ReceitasPage.abrirReceitaGravada(receitaId);
      cy.wait('@getDetalheSemEdicao');

      // 1. Contraprova: a fórmula gravada (nº 1) está bloqueada
      ReceitasPage.elements.multiploDaFormula().should('be.disabled');
      ReceitasPage.elements.totalMultiplo().should('be.disabled');

      // 2. Fórmula acrescentada (nº 2, ainda não gravada): os dois ficam editáveis
      ReceitasPage.irParaFormulaSeguinte(2);
      ReceitasPage.elements.multiploDaFormula().should('not.be.disabled').and('not.have.attr', 'readonly');
      ReceitasPage.elements.totalMultiplo().should('not.be.disabled').and('not.have.attr', 'readonly');
    });

    it('3.7 [595 - can_update_formula_with_financial] - deve travar a fórmula da receita vendida, com o aviso da permissão, só quando a capability estiver revogada, sem travar a receita não vendida (Issue front#397)', function () {
      // Front#397/PR #664: a regra do Desktop — fórmula com financeiro vinculado só se altera com a 595. A trava é do front (lê a 595 do mapa do módulo); a fórmula
      // continua com can_update_formula true sem a 595 (backend#835, aberta). Medido na dev em 2026-11-06 (aba-c). Massa: receita paga descoberta na lista da loja.
      const capacidadeDaConta = {};
      let paga = null;
      const ids = (storeId, status) => api.buscarReceitasDaLoja(storeId, { status, per_page: 20 }).then((res) => (res.body.items || []).map((item) => item.id));
      const achar = (storeId, lista, i) => (i >= lista.length
        ? cy.wrap(null)
        : api.obterDetalhePrescricao(storeId, lista[i]).then((det) => (det.body.status === -1 && det.body.financial_id ? det.body.id : achar(storeId, lista, i + 1))));
      cy.then(() => api.obterUsuarioLogado()).then((resMe) => {
        const storeId = resMe.body.store_code || resMe.body.store_id;
        api.obterCapabilitiesReceitas(storeId).then((res) => { capacidadeDaConta.valor = res.body.capabilities.can_update_formula_with_financial; });
        ids(storeId, 'awaiting_delivery').then((a) => ids(storeId, 'delivered').then((b) => achar(storeId, [...a, ...b], 0))).then((id) => { paga = id; });
      });
      cy.then(() => {
        if (!paga) {
          cy.log('⏭️ Sem massa: nenhuma receita finalizada com financeiro entre as 40 primeiras da lista da loja');
          this.skip();
        }
      });

      // 1. Caminho Concessão: a capability real (a conta tem a 595) deixa a fórmula da receita vendida editável e sem aviso
      cy.then(() => {
        ReceitasPage.abrirReceitaGravada(paga);
        ReceitasPage.elements.multiploDaFormula().then(($multiplo) => {
          ReceitasPage.elements.totalMultiplo().then(($qvd) => {
            validarDuploGrauPermissao({
              codigo: '595',
              capability: 'can_update_formula_with_financial',
              payloadValido: capacidadeDaConta.valor === true,
              frontValido: editavel($multiplo) && editavel($qvd),
              esperaAtivo: true,
              mensagemSucesso: 'Receita vendida editável com can_update_formula_with_financial: true.',
              mensagemFalhaFront: 'A fórmula da receita vendida travou mesmo com a 595.'
            });
          });
        });
        ReceitasPage.elements.avisoReceitaVendida().should('not.exist');
      });

      // 2. Caminho Revogação: a mesma receita com a capability forçada em false (a conta tem a 595)
      cy.intercept('GET', /\/prescription-capabilities(\?.*)?$/, (req) => {
        req.continue((res) => { res.body = { ...res.body, capabilities: { ...res.body.capabilities, can_update_formula_with_financial: false } }; });
      }).as('getCapsSem595');
      cy.then(() => ReceitasPage.abrirReceitaGravada(paga));
      ReceitasPage.elements.avisoReceitaVendida().should('be.visible').and('contain.text', 'Receita já vendida: alterar a fórmula exige a permissão 595');
      ReceitasPage.elements.multiploDaFormula().then(($multiplo) => {
        ReceitasPage.elements.totalMultiplo().then(($qvd) => {
          validarDuploGrauPermissao({
            codigo: '595',
            capability: 'can_update_formula_with_financial',
            payloadValido: false,
            frontValido: editavel($multiplo) || editavel($qvd),
            esperaAtivo: false,
            mensagemFalhaVazamento: 'O Múltiplo ou o QVD da receita vendida ficou editável sem a 595!'
          });
        });
      });

      // 3. Contraprova: sem a 595, a receita não vendida do before continua editável e sem aviso
      ReceitasPage.abrirReceitaGravada(receitaId);
      ReceitasPage.elements.avisoReceitaVendida().should('not.exist');
      ReceitasPage.elements.multiploDaFormula().should('not.be.disabled');
    });
  });

  // ---------------------------------------------------------------------------------
  // CONTEXTO 4: PERMISSÕES DAS AUTOMAÇÕES (Issue front#605, P1-59 parte 8)
  // ---------------------------------------------------------------------------------
  // 100% mock: a conta de teste tem a 635 com gravar, alterar e excluir (0-A #31.1) e a dev não tem conta sem elas.
  // Cada teste revoga uma capability por vez (as outras ficam true), para provar que a trava é daquela chave.
  // Medido no front (developer, 2026-11-06): sem can_create somem o "Criar automação" e o ladrilho da grade e o Duplicar trava;
  // sem can_edit o Editar e o switch do cartão travam (aria-disabled, motivo no title) e o construtor aberto pelo nome fica só-leitura;
  // sem can_delete o Excluir do cartão trava e o menu "Mais ações" do construtor some.
  context('4. Automações - Permissões', () => {
    const ID = 9001;
    let originalUseMocksState;

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
    });

    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    beforeEach(() => {
      cy.login();
    });

    // Abre a lista com a capability revogada (ou todas concedidas, sem argumento)
    const abrirLista = (revogadas = {}) => {
      RecursosMocks.interceptResources({ automation: true });
      AutomacoesMocks.interceptAutomationCapabilitiesApi({ capabilities: { ...AutomacoesMocks.capabilitiesCompletas.capabilities, ...revogadas } });
      AutomacoesMocks.interceptAutomationsListApi({ data: [AutomacoesMocks.itemDaLista()] });
      AutomacoesMocks.interceptAutomationDetailApi(ID, { automation: AutomacoesMocks.detalhe() });
      cy.reload();
      AutomacoesPage.visitar();
      cy.wait('@getAutomationCapabilities');
      AutomacoesPage.elements.cartao(ID).should('be.visible');
    };

    // Abre o construtor pelo nome do cartão (o nome abre mesmo sem can_edit; o Editar trava)
    const abrirConstrutorPeloNome = () => {
      AutomacoesPage.elements.cartaoAbrir(ID).click();
      cy.location('pathname').should('eq', `/automacoes/${ID}`);
      AutomacoesPage.elements.construtor().should('be.visible');
      AutomacoesPage.elements.inputNome().should('have.value', AutomacoesMocks.detalhe().name);
    };

    it('4.1 [635 - can_create] - deve mostrar "Criar automação" e liberar o Duplicar só quando a capability estiver concedida', () => {
      // 1. Caminho Concessão: botão da barra, ladrilho da grade e Duplicar livres
      abrirLista();
      AutomacoesPage.elements.botaoNova().should('be.visible');
      AutomacoesPage.elements.tileNova().should('be.visible');
      AutomacoesPage.elements.cartaoMenu(ID).scrollIntoView().click();
      AutomacoesPage.elements.cartaoDuplicar(ID).should('be.visible').then(($dup) => {
        validarDuploGrauPermissao({
          codigo: '635',
          capability: 'can_create',
          payloadValido: true,
          frontValido: $dup.attr('aria-disabled') !== 'true',
          esperaAtivo: true,
          mensagemSucesso: '"Criar automação" visível e Duplicar livre com can_create: true.',
          mensagemFalhaFront: 'O Duplicar ficou travado mesmo com can_create: true.'
        });
      });

      // 2. Caminho Revogação: o "Criar automação" e o ladrilho somem; o Duplicar trava com o motivo e não chama o servidor
      AutomacoesMocks.interceptAutomationDuplicateApi(ID);
      abrirLista({ can_create: false });
      AutomacoesPage.elements.botaoNova().should('not.exist');
      AutomacoesPage.elements.tileNova().should('not.exist');
      AutomacoesPage.elements.cartaoMenu(ID).scrollIntoView().click();
      AutomacoesPage.elements.cartaoDuplicar(ID).should('be.visible')
        .and('have.attr', 'title', 'Você não tem permissão para criar automações.')
        .then(($dup) => {
          validarDuploGrauPermissao({
            codigo: '635',
            capability: 'can_create',
            payloadValido: false,
            frontValido: $dup.attr('aria-disabled') !== 'true',
            esperaAtivo: false,
            mensagemFalhaVazamento: 'O Duplicar ficou livre mesmo com can_create: false!'
          });
        });
      AutomacoesPage.elements.cartaoDuplicar(ID).click();
      cy.get('@postAutomationDuplicate.all').should('have.length', 0);
      AutomacoesPage.elements.toast('success').should('not.exist');
    });

    it('4.2 [635 - can_edit] - deve liberar o Editar, o switch do cartão e o construtor só quando a capability estiver concedida, e abrir o construtor só-leitura sem ela', () => {
      // 1. Caminho Concessão: Editar e switch livres; o construtor tem Salvar e campos editáveis
      abrirLista();
      AutomacoesPage.elements.cartaoSwitch(ID).should('not.have.attr', 'aria-disabled');
      AutomacoesPage.elements.cartaoEditar(ID).should('be.visible').then(($editar) => {
        validarDuploGrauPermissao({
          codigo: '635',
          capability: 'can_edit',
          payloadValido: true,
          frontValido: $editar.attr('aria-disabled') !== 'true',
          esperaAtivo: true,
          mensagemSucesso: 'Editar e switch do cartão livres com can_edit: true.',
          mensagemFalhaFront: 'O Editar do cartão ficou travado mesmo com can_edit: true.'
        });
      });
      abrirConstrutorPeloNome();
      AutomacoesPage.elements.botaoSalvar().should('be.visible');
      AutomacoesPage.elements.switchAtiva().should('not.have.attr', 'aria-disabled');
      AutomacoesPage.elements.inputNome().should('be.enabled');
      AutomacoesPage.elements.botoesAdicionarPasso().should('have.length.greaterThan', 0);

      // 2. Caminho Revogação na lista: Editar e switch travam com o motivo e não saem da lista nem gravam
      AutomacoesMocks.interceptAutomationUpdateApi(ID);
      abrirLista({ can_edit: false });
      AutomacoesPage.elements.cartaoSwitch(ID).should('have.attr', 'aria-disabled', 'true')
        .and('have.attr', 'title', 'Você não tem permissão para editar automações.');
      AutomacoesPage.elements.cartaoEditar(ID).should('have.attr', 'title', 'Você não tem permissão para editar automações.')
        .then(($editar) => {
          validarDuploGrauPermissao({
            codigo: '635',
            capability: 'can_edit',
            payloadValido: false,
            frontValido: $editar.attr('aria-disabled') !== 'true',
            esperaAtivo: false,
            mensagemFalhaVazamento: 'O Editar do cartão ficou livre mesmo com can_edit: false!'
          });
        });
      AutomacoesPage.elements.cartaoEditar(ID).click();
      AutomacoesPage.elements.cartaoSwitch(ID).click();
      cy.location('pathname').should('eq', '/automacoes');
      cy.get('@patchAutomation.all').should('have.length', 0);

      // 3. Construtor aberto pelo nome sem can_edit: só-leitura (sem Salvar, campos desabilitados, sem "+" de passo)
      abrirConstrutorPeloNome();
      AutomacoesPage.elements.botaoSalvar().should('not.exist');
      AutomacoesPage.elements.switchAtiva().should('have.attr', 'aria-disabled', 'true')
        .and('have.attr', 'title', 'Você não tem permissão para editar automações.');
      AutomacoesPage.elements.inputNome().should('be.disabled');
      AutomacoesPage.elements.inputDescricao().should('be.disabled');
      AutomacoesPage.elements.selectGatilho().should('be.disabled');
      AutomacoesPage.elements.botoesAdicionarPasso().should('not.exist');
    });

    it('4.3 [635 - can_delete] - deve liberar o Excluir do cartão e o menu "Mais ações" do construtor só quando a capability estiver concedida', () => {
      // 1. Caminho Concessão: Excluir do cartão livre e menu "Mais ações" no construtor
      abrirLista();
      AutomacoesPage.elements.cartaoMenu(ID).scrollIntoView().click();
      AutomacoesPage.elements.cartaoExcluir(ID).should('be.visible').then(($excluir) => {
        validarDuploGrauPermissao({
          codigo: '635',
          capability: 'can_delete',
          payloadValido: true,
          frontValido: $excluir.attr('aria-disabled') !== 'true',
          esperaAtivo: true,
          mensagemSucesso: 'Excluir do cartão livre com can_delete: true.',
          mensagemFalhaFront: 'O Excluir do cartão ficou travado mesmo com can_delete: true.'
        });
      });
      cy.get('body').type('{esc}');
      abrirConstrutorPeloNome();
      AutomacoesPage.elements.botaoMaisAcoes().should('be.visible');

      // 2. Caminho Revogação: o Excluir trava com o motivo e não abre a confirmação; o construtor fica sem "Mais ações" e segue editável
      abrirLista({ can_delete: false });
      AutomacoesPage.elements.cartaoMenu(ID).scrollIntoView().click();
      AutomacoesPage.elements.cartaoExcluir(ID).should('be.visible')
        .and('have.attr', 'title', 'Você não tem permissão para excluir automações.')
        .then(($excluir) => {
          validarDuploGrauPermissao({
            codigo: '635',
            capability: 'can_delete',
            payloadValido: false,
            frontValido: $excluir.attr('aria-disabled') !== 'true',
            esperaAtivo: false,
            mensagemFalhaVazamento: 'O Excluir do cartão ficou livre mesmo com can_delete: false!'
          });
        });
      AutomacoesPage.elements.cartaoExcluir(ID).click();
      AutomacoesPage.elements.dialogo('automation-delete-confirm').should('not.exist');
      cy.get('body').type('{esc}');
      abrirConstrutorPeloNome();
      AutomacoesPage.elements.botaoMaisAcoes().should('not.exist');
      AutomacoesPage.elements.botaoSalvar().should('be.visible');
    });
  });

});
