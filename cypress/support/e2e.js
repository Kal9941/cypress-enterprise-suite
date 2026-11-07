// ***********************************************************
// This example support/e2e.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands'
import 'cypress-mochawesome-reporter/register';
import errorHandler from './errorHandler';
// Trace de falha para diagnóstico de rodadas no cypress open (ativo só no modo interativo ou com TRACE_FALHAS=true).
import './traceFalha';
// Passos de cada teste (cy.log ou comandos) gravados em cypress/reports/passos/ para o relatório próprio; passivo e fail-safe.
import './passos';
// Padrões de intercept na forma nova das rotas, sem /stores/:id (backend#677): URL absoluta da API_URL, ver rotaApi.js.
import { rotaApi } from './rotaApi';
// `networkRecorder` (Record & Replay via RECORD_MOCKS) foi desligado do fluxo global em
// 25/09/2026 — análise de arquitetura concluiu que nenhum teste depende do replay para passar
// (BaseMock/fixtures canônicas já cobrem toda asserção; um replay ausente só gera um cy.log de
// aviso, nunca falha) e que rodar startRecording/startReplay em TODO teste, mesmo quando
// ninguém consome o resultado, é overhead redundante com o padrão oficial de mocks do projeto.
// Módulo e fixtures gravadas em `cypress/fixtures/recorded/` foram preservados intactos para uso
// pontual sob demanda (import direto em um spec específico), caso ainda façam sentido depois desta
// mudança. Ver `.agents/ROADMAP.md` (Log Executivo, 25/09/2026) e `.agents/AGENTS.md` §6.

// Diagnóstico inteligente de falhas com logs detalhados e sugestões para o operador
Cypress.on('fail', (err, runnable) => {
  const formattedError = errorHandler.formatarDiagnostico(err, runnable);
  // Falha em `before`/`after` de contexto não passa pelo `afterEach` (medido em 2026-11-06, P2-12: sem nenhum arquivo em
  // cypress/reports/failures/<SESSION_LABEL>/). Fica pendente aqui e o `after` global abaixo grava.
  if (runnable && runnable.type === 'hook' && /before all|after all/.test(runnable.hookName || runnable.title || '')) {
    const pendentes = Cypress.env('FALHAS_DE_HOOK_PENDENTES') || [];
    pendentes.push(Cypress.env('CURRENT_FAILURE_RECORD'));
    Cypress.env('FALHAS_DE_HOOK_PENDENTES', pendentes);
  }
  throw formattedError;
});


// Hook global executado uma única vez antes de iniciar a suíte: limpa logs de falhas anteriores e
// inicializa buffer. NÃO resincroniza USE_MOCKS aqui (2ª correção em 23/09/2026 — a primeira tentativa,
// mover a reatribuição de `beforeEach` para cá, ainda sobrescrevia `--env USE_MOCKS=...` da CLI de
// volta para o valor de `env.json` UMA vez por spec, o que já é suficiente para a spec inteira rodar
// no modo errado — reproduzido: `--env USE_MOCKS=true` continuou virando `false` mesmo só rodando
// uma vez no início). A correção real é a mesma dos outros dois flags logo abaixo: remover a
// reatribuição por completo e confiar na resolução nativa de env do Cypress (`--env` > bloco `env`
// de `cypress.config.js`, que já lê `env.json` como padrão de fallback quando nada é passado na CLI).
// Um bloco "100% mockado" continua funcionando normalmente: seu próprio `before()`/`after()` de
// contexto captura e restaura `Cypress.env('USE_MOCKS')` a partir do que a resolução nativa já
// estabeleceu, sem depender de nenhuma reatribuição customizada aqui.
before(() => {
  Cypress.env('ALL_FAILURES', []);
  cy.task('limparLogsFalha', null, { log: false });
  // Purga só os .json de merge do mochawesome mais antigos que 3h — necessário desde que
  // `cypressParallel: true` (cypress.config.js) parou de limpar essa pasta automaticamente para
  // não colidir com instâncias concorrentes. Ver comentário da task `limparJsonsAntigos`.
  cy.task('limparJsonsAntigos', null, { log: false });
});

/**
 * Grava o diagnóstico de uma falha em cypress/reports/failures/<SESSION_LABEL>/ (acumulado, último registro e snapshot do DOM).
 * Usada pelo `afterEach` (falha no teste ou no `beforeEach`) e pelo `after` global (falha em `before`/`after` de contexto, P2-12).
 */
function gravarDiagnosticoDeFalha(failureRecord, isBackend) {
  cy.window({ log: false }).then((win) => {
    const doc = win ? win.document : null;
    const snapshot = errorHandler.extrairSnapshotDOM(doc, win, isBackend);

    failureRecord.url = snapshot.url;
    failureRecord.modaisAbertos = snapshot.modaisAbertos;
    failureRecord.elementFocado = snapshot.elementFocado;

    let failureLogText = errorHandler.gerarRelatorioTexto(failureRecord);

    // Sanidade do próprio snapshot: os dois caminhos de fallback (backend/cy.request e "sem window")
    // produzem HTML pequeno (~1-2KB) e genérico. Um snapshot real desta aplicação historicamente sai
    // entre 15KB e 35KB. Abaixo de 5KB é sinal de que a captura caiu num fallback — sem este aviso,
    // o agente/operador pode confiar silenciosamente num snapshot vazio e perder tempo investigando
    // "por que o DOM não mostra nada" quando na verdade o DOM nunca foi capturado de fato
    // (achado real, 23/09/2026: colisão de heurística "backend" custou ~1h por esse motivo exato).
    if ((snapshot.htmlCompleto || '').length < 5000) {
      failureLogText += '\n\n⚠️ AVISO DE SANIDADE: last-failure-dom.html saiu com menos de 5KB — provavelmente é um snapshot GENÉRICO (fallback de backend/sem window), não o DOM real da falha. Não confie neste arquivo para diagnóstico de UI; investigue por que a captura caiu no fallback (ver isBackend em errorHandler.js/e2e.js).';
    }

    const allFailures = Cypress.env('ALL_FAILURES') || [];
    allFailures.push(failureRecord);
    Cypress.env('ALL_FAILURES', allFailures);

    const allFailuresLogText = errorHandler.gerarRelatorioTextoMultiplo(allFailures);

    // Namespaced por SESSION_LABEL (ver resolveSessionLabel em cypress.config.js) — corrigido em
    // 23/09/2026: antes, o caminho era fixo e compartilhado entre QUALQUER instância do Cypress
    // rodando ao mesmo tempo (ex: aba-A na spec 5, aba-B na spec 0), então a falha de uma instância
    // sobrescrevia silenciosamente a da outra em last-failure.json/last-failure-dom.html — o
    // arquivo que o agente abre primeiro para diagnosticar. `Cypress.env('SESSION_LABEL')` sempre
    // existe neste ponto (propagado por setupNodeEvents, com fallback por PID se não informado via
    // `--env SESSION_LABEL=<rotulo>`). `cy.writeFile` cria os diretórios intermediários sozinho.
    const dirFalhas = `cypress/reports/failures/${Cypress.env('SESSION_LABEL')}`;
    cy.writeFile(`${dirFalhas}/failures.json`, allFailures, { log: false });
    cy.writeFile(`${dirFalhas}/failures.log`, allFailuresLogText, { log: false });
    cy.writeFile(`${dirFalhas}/last-failure.json`, failureRecord, { log: false });
    cy.writeFile(`${dirFalhas}/last-failure.log`, failureLogText, { log: false });
    cy.writeFile(`${dirFalhas}/last-failure-dom.html`, snapshot.htmlCompleto, { log: false });
  });
}

// Hook global: define os timeouts padrão para TODOS os testes da suíte
beforeEach(function () {
  Cypress.config('defaultCommandTimeout', 10000); // Timeout padrão para comandos DOM (ex: cy.get, cy.contains)
  Cypress.config('requestTimeout', 10000);        // Timeout para cy.intercept / cy.request aguardar uma requisição
  Cypress.config('responseTimeout', 10000);       // Timeout para aguardar a resposta de uma requisição
  Cypress.config('pageLoadTimeout', 30000);       // Timeout para cy.visit carregar a página

  // Desativa telemetria e streams persistentes de SSE para não manter requisições abertas indefinidamente
  cy.intercept('POST', '**/cdn-cgi/rum*', { statusCode: 403, log: false });
  cy.intercept('GET', rotaApi('attendance-events/stream*'), { statusCode: 403, log: false });

  // USE_MOCKS/RECORD_MOCKS/AUTO_SYNC_MOCKS NÃO são resincronizados aqui a cada teste (corrigido em
  // 23/09/2026 — ver comentário no `before()` global no topo do arquivo e a lição "Override de
  // `--env` Agora Cobre as Três Flags de Mock" em `AGENTS.md` §6). Um bloco "100% mockado" continua
  // funcionando normalmente: seu próprio `before()`/`after()` de contexto captura e restaura
  // `Cypress.env('USE_MOCKS')` e `USE_MOCKS_FORCED_BY_TEST`, sem depender deste hook global.
  const useMocks = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';

  // Os specs de contrato de backend (0-A/0-B/0-C/0-D) rodam sempre contra a API real, com qualquer USE_MOCKS (AGENTS.md [R-BACKEND]):
  // sem o catch-all e os mocks de shell abaixo, também o fetch/XHR do navegador nesses specs chega ao servidor (ROADMAP.md P2-01).
  const specDeBackend = errorHandler.ehSpecBackend(Cypress.spec ? Cypress.spec.relative : '');

  // Modo Reprodução (Replay): Se estiver em modo Mock, carrega a gravação se existir
  if (useMocks && !specDeBackend) {
    // 1. GUARDA DE REDE GLOBAL HERMÉTICO (CATCH-ALL MOCK GUARD)
    // Intercepta qualquer chamada direcionada à API real que não foi explicitamente tratada por um mock específico.
    // Como o Cypress avalia os intercepts em ordem reversa, qualquer intercept registrado posteriormente no teste terá precedência.
    // Este guard impede que requisições órfãs cheguem ao servidor real com token mockado, prevenindo retornos HTTP 401 e logouts acidentais.
    cy.intercept(/^https?:\/\/api\.pharmacie\.dev\.br\/.*/, (req) => {
      if (req.url.endsWith('.js') || req.url.endsWith('.css') || req.url.includes('/assets/')) {
        return req.continue();
      }
      Cypress.log({
        name: 'MockGuard',
        displayName: '🛡️ Catch-All',
        message: `${req.method} ${req.url}`
      });
      req.reply({
        statusCode: 200,
        body: {
          items: [],
          data: [],
          total: 0,
          counts: {},
          totals: { budget_total: 0, completed_total: 0, receivable_total: 0 },
          pagination: { page: 1, per_page: 20, total: 0, total_pages: 1, has_next: false, has_previous: false }
        }
      });
    }).as('networkCatchAllGuard');

    // No modo mock, intercepta rota de dados do usuário autenticado para manter consistência de perfil e loja
    cy.intercept('GET', '**/users/me*', {
      statusCode: 200,
      body: {
        user_id: 122,
        cnpj: Cypress.env('USER_CNPJ') || "11111111111111",
        profile: Cypress.env('USER_CODE') || "KLISMAMMONTEIRO",
        display_name: Cypress.env('DEFAULT_CLIENT_NAME') || "KLISMAM MONTEIRO",
        company_code: 10199,
        store_code: 1
      },
      log: false
    });

    // No modo mock, responde ao polling periódico de eventos com lista vazia para evitar 401 e deslogamentos
    cy.intercept('GET', rotaApi('attendance-events*'), {
      statusCode: 200,
      body: { items: [], cursor: 1, has_more: false },
      log: false
    });

    // No modo mock, intercepta status e dados do atendente para evitar 401 e logout prematuro no SPA
    cy.intercept('GET', rotaApi('attendants/*/status*'), {
      statusCode: 200,
      body: {
        attendant_id: 122,
        status: "available",
        group_relations_count: 1,
        active_attendance_count: 1,
        status_changed_at: new Date().toISOString(),
        status_consistent: true
      },
      log: false
    });

    cy.intercept('GET', rotaApi('attendants/*'), {
      statusCode: 200,
      body: {
        id: 122,
        name: "KLISMAM MONTEIRO",
        status: "available"
      },
      log: false
    });

    // No modo mock, intercepta resources para evitar 401 e desbloquear módulos da sidebar
    cy.intercept('GET', rotaApi('resources*'), {
      statusCode: 200,
      body: {
        resources: {
          central: true,
          attendance: true,
          prescription: true,
          patient: true,
          prescriber: true,
          resale: true,
          redo: true,
          delivery: true,
          financial: true,
          metrics: true,
          report: true
        }
      },
      log: false
    });

    // No modo mock, intercepta configurações de pagamento e tabelas de apoio
    cy.intercept('GET', rotaApi('payment-configs*'), { statusCode: 200, body: { items: [] }, log: false });
    cy.intercept('GET', rotaApi('branches*'), { statusCode: 200, body: { items: [], total: 0 }, log: false });
    cy.intercept('GET', rotaApi('operation-types*'), { statusCode: 200, body: { items: [], total: 0 }, log: false });
    cy.intercept('GET', rotaApi('sales-sectors*'), { statusCode: 200, body: { items: [], total: 0 }, log: false });
    cy.intercept('GET', rotaApi('employees*'), { statusCode: 200, body: { items: [], total: 0 }, log: false });

    // Fallback inteligente para endpoints de capabilities no modo mock (loja e atendimento individual)
    cy.intercept('GET', rotaApi('**/*capabilities*'), {
      statusCode: 200,
      body: {
        capabilities: {
          can_list_standard_messages: true,
          can_access_attendance_module: true,
          can_create_attendance: true,
          can_view_pending_attendance: true,
          can_view_occupied_attendance: true,
          can_create_customer_without_gender: true,
          can_list_group_agents: true,
          can_transfer_attendance: true,
          can_transfer_assigned_attendance: true,
          can_transfer_pending_attendance: true,
          can_change_status: true,
          can_mark_completed: true,
          can_mark_discarded: true,
          can_mark_finished: true
        }
      },
      log: false
    });

    // Sub-recursos de atendimento no modo mock (observações, arquivos IA, links de pagamento e prescrições)
    cy.intercept('GET', rotaApi('attendances/*/observations*'), { statusCode: 200, body: { items: [], total: 0 }, log: false });
    cy.intercept('GET', rotaApi('attendances/*/payment-links*'), { statusCode: 200, body: { items: [], data: [], total: 0 }, log: false });
    cy.intercept('GET', rotaApi('attendances/*/ia-files*'), { statusCode: 200, body: { items: [], total: 0 }, log: false });
    cy.intercept('GET', rotaApi('prescriptions*'), { statusCode: 200, body: { items: [], data: [], total: 0 }, log: false });
  }
});

// Tratamento de exceções não capturadas originadas do código do Frontend (React / TanStack Query)
// Evita que erros de ciclo de vida interno da aplicação interrompam prematuramente os testes E2E
Cypress.on('uncaught:exception', (err) => {
  // Ignora erros conhecidos de inicialização do React Query / bibliotecas de UI / long-polling
  if (
    err.message.includes('attendanceQueryKeys') ||
    err.message.includes('id inválido') ||
    err.message.includes('ResizeObserver loop') ||
    err.message.includes('Element attr did not return a valid number') ||
    err.name === 'BrowserConnectionClosedError' ||
    err.message.includes('BrowserConnectionClosedError') ||
    err.message.includes('The browser closed the connection') ||
    err.message.includes('ESOCKETTIMEDOUT')
  ) {
    return false; // Retorna false para impedir que o Cypress falhe o teste
  }
  // Permite que outros erros não mapeados continuem falhando o teste normalmente
});

afterEach(function () {
  const testName = this.currentTest.title;
  const suiteName = this.currentTest.parent.title;

  // Captura de evidencia apenas de testes que passaram em modo CI/Headless (evita congelamento da UI no modo interativo cypress open)
  if (this.currentTest.state === 'passed' && !suiteName.includes('API REST') && !Cypress.config('isInteractive')) {

    // Pausa curta de estabilização para permitir o esvaziamento do buffer de E/S antes da gravação do arquivo.
    cy.wait(300);

    // Higienizar o título do teste substituindo caracteres especiais
    const safeName = testName.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 60);

    // Capture uma captura de tela usando o modo de viewport leve em vez de página inteira.
    // `timeout` explícito e maior que o `responseTimeout` global (10000ms, `beforeEach` deste
    // arquivo): sob DOM pesado (ex.: histórico completo de mensagens), a captura+codificação da
    // imagem pode passar de 10s e derrubava um teste que já tinha passado (achado 2026-09-25,
    // ROADMAP §2 P2 "Timeout de cy.screenshot()"). Não altera o `responseTimeout` usado para
    // detectar API real lenta — só este comando específico de evidência.
    cy.screenshot(`PASS-${safeName}`, {
      capture: 'viewport',
      overwrite: true,
      timeout: 20000,
    });
  }

  // Gravação de Diagnóstico de Falhas em cypress/reports/failures/ (acumula falhas e extrai live DOM snapshot)
  if (this.currentTest.state === 'failed') {
    const specPath = Cypress.spec ? Cypress.spec.relative : (this.currentTest.file || '');
    // Checagem por NOME EXATO do arquivo, não substring livre de título — ver mesma nota em
    // errorHandler.js linha ~146 (achado real, 23/09/2026: título mencionando "backend#455" travava
    // a captura do snapshot real do DOM em suítes de UI, mascarando falhas por ~1h de investigação).
    const isBackend = errorHandler.ehSpecBackend(specPath);

    gravarDiagnosticoDeFalha(Cypress.env('CURRENT_FAILURE_RECORD') || errorHandler.criarRegistroFalha(this.currentTest.err || new Error('Falha desconhecida'), this.currentTest), isBackend);
  }

  // Auto-Sync de Mocks: grava em disco qualquer payload capturado da API Real durante o teste
  const isAutoSyncEnabled = Cypress.env('AUTO_SYNC_MOCKS') !== false && Cypress.env('AUTO_SYNC_MOCKS') !== 'false';
  const isMockEnabled = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';
  const captured = Cypress.env('CAPTURED_FIXTURES');

  if (isAutoSyncEnabled && !isMockEnabled && captured && typeof captured === 'object') {
    const filePaths = Object.keys(captured);
    if (filePaths.length > 0) {
      filePaths.forEach((filePath) => {
        cy.writeFile(`cypress/fixtures/${filePath}`, captured[filePath], { log: false });
      });
      // Limpa os payloads gravados da memória após a persistência em disco
      Cypress.env('CAPTURED_FIXTURES', {});
    }
  }
});

// Falha em `before`/`after` de contexto (P2-12): o Mocha não roda o `afterEach` nesse caso, então o `fail` acima deixa o registro
// pendente e este `after` da raiz, que roda mesmo depois de um hook de contexto falhar, grava o diagnóstico.
after(function () {
  const pendentes = Cypress.env('FALHAS_DE_HOOK_PENDENTES') || [];
  if (!pendentes.length) return;
  Cypress.env('FALHAS_DE_HOOK_PENDENTES', []);
  const isBackend = errorHandler.ehSpecBackend(Cypress.spec ? Cypress.spec.relative : '');
  pendentes.filter(Boolean).forEach((registro) => gravarDiagnosticoDeFalha(registro, isBackend));
});
