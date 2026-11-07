/**
 * NetworkRecorder - Gravador e Reprodutor de Sessão de Rede (Record & Replay)
 * 
 * Permite que testes executados contra a API Real gravem automaticamente
 * a sequência exata de requisições e respostas HTTP (incluindo respostas consecutivas
 * da mesma rota com estados diferentes) e reproduzam no modo Mock com 100% de fidelidade.
 */
class NetworkRecorder {
  constructor() {
    this.sessionTimeline = [];
    this.replayQueues = {};
    this.isRecording = false;
    this.isReplaying = false;
  }

  /**
   * Gera um caminho de arquivo seguro e determinístico baseado no nome da spec e do teste
   * @param {Mocha.Test} test Objeto do teste atual (this.currentTest)
   * @returns {string} Caminho relativo dentro de cypress/fixtures/recorded/
   */
  getFixturePathForTest(test) {
    if (!test) return 'default_session.json';

    const specName = (Cypress.spec && Cypress.spec.name) 
      ? Cypress.spec.name.replace(/\.cy\.js$/, '').replace(/[^a-zA-Z0-9_-]/g, '_')
      : 'global';

    const testTitle = test.titlePath 
      ? test.titlePath().join(' - ') 
      : (test.title || 'unnamed_test');

    const safeTestName = testTitle
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9]+/g, '_')     // Caracteres especiais para _
      .replace(/^_+|_+$/g, '')         // Trim de _
      .substring(0, 100);

    return `recorded/${specName}/${safeTestName}.json`;
  }

  /**
   * Identifica o padrão genérico de uma rota para pareamento no replay
   * @param {string} url URL completa da requisição
   * @returns {string} Rota simplificada para matching
   */
  getRoutePattern(url) {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.pathname
        .replace(/\/stores\/\d+/, '/stores/*')
        .replace(/\/attendances\/\d+/, '/attendances/*')
        .replace(/\/attendance-groups\/\d+/, '/attendance-groups/*')
        .replace(/\/channels\/\d+/, '/channels/*')
        .replace(/\/prescriptions\/\d+/, '/prescriptions/*')
        .replace(/\/formulas\/\d+/, '/formulas/*')
        .replace(/\/manipulation-processes\/\d+/, '/manipulation-processes/*')
        .replace(/\/customers\/\d+/, '/customers/*')
        .replace(/\/clients\/\d+/, '/clients/*')
        .replace(/\/attendants\/\d+/, '/attendants/*')
        .replace(/\/messages\/\d+/, '/messages/*')
        .replace(/\/users\/\d+/, '/users/*')
        .replace(/\/waba-message-templates\/\d+/, '/waba-message-templates/*')
        .replace(/\/payment-links\/\d+/, '/payment-links/*');
    } catch (e) {
      return url;
    }
  }

  /**
   * Inicializa o gravador no início de um teste (beforeEach)
   */
  startRecording() {
    this.sessionTimeline = [];
    this.isRecording = true;
    this.isReplaying = false;

    // Intercepta chamadas relevantes para a API REST da Pharmacie consumindo dinamicamente a API_URL
    const apiUrl = Cypress.env('API_URL') || 'https://api.omnicare.dev.local';
    const interceptPattern = apiUrl.endsWith('/') ? `${apiUrl}**` : `${apiUrl}/**`;

    cy.intercept(interceptPattern, (req) => {
      // Ignora arquivos estáticos, telemetria, streams e long-polling periódico
      const url = req.url;
      if (
        url.includes('/attendance-events') ||
        url.includes('/cdn-cgi/rum') ||
        url.includes('.js') ||
        url.includes('.css') ||
        url.includes('.svg') ||
        url.includes('.png') ||
        url.includes('.woff')
      ) {
        return;
      }

      // Se for uma requisição para a API da Pharmacie
      if (url.includes('api.pharmacie') || url.includes('/stores/') || url.includes('/users/') || url.includes('/auth/')) {
        const startTime = Date.now();
        const requestEntry = {
          order: this.sessionTimeline.length + 1,
          method: req.method,
          url: req.url,
          pathname: new URL(req.url).pathname,
          routePattern: this.getRoutePattern(req.url),
          search: new URL(req.url).search,
          requestBody: req.body || null,
          statusCode: 200,
          responseBody: null,
          durationMs: 0
        };

        req.continue((res) => {
          if (res) {
            requestEntry.statusCode = res.statusCode;
            requestEntry.responseBody = res.body;
            requestEntry.durationMs = Date.now() - startTime;
            this.sessionTimeline.push(requestEntry);
          }
        });
      }
    }).as('networkRecorderGlobal');
  }

  /**
   * Salva a sessão gravada no disco ao final do teste (afterEach)
   * @param {Mocha.Test} test Objeto do teste que acabou de rodar
   */
  saveSession(test) {
    if (!this.isRecording || this.sessionTimeline.length === 0) {
      return;
    }

    const filePath = `cypress/fixtures/${this.getFixturePathForTest(test)}`;
    const sessionData = {
      recordedAt: new Date().toISOString(),
      testTitle: test.title,
      totalRequests: this.sessionTimeline.length,
      timeline: this.sessionTimeline
    };

    cy.writeFile(filePath, JSON.stringify(sessionData, null, 2), { log: false });
    cy.log(`💾 [NetworkRecorder]: Sessão gravada com sucesso em ${filePath} (${this.sessionTimeline.length} requisições)`);
    this.sessionTimeline = [];
    this.isRecording = false;
  }

  /**
   * Configura o reprodutor de sessão (Replay) para o teste atual
   * @param {Mocha.Test} test Objeto do teste atual
   */
  startReplay(test) {
    const fixtureRelativePath = this.getFixturePathForTest(test);
    const fullFixturePath = `cypress/fixtures/${fixtureRelativePath}`;

    cy.task('verificarArquivoExiste', fullFixturePath, { log: false }).then((existe) => {
      if (!existe) {
        cy.log(`⚠️ [NetworkRecorder]: Nenhuma gravação encontrada em ${fixtureRelativePath}. Usando mocks padrão.`);
        return;
      }

      cy.fixture(fixtureRelativePath.replace(/\.json$/, '')).then((sessionData) => {
        if (!sessionData || !sessionData.timeline || sessionData.timeline.length === 0) {
          return;
        }

        cy.log(`▶️ [NetworkRecorder]: Reproduzindo sessão gravada (${sessionData.timeline.length} requisições) de ${fixtureRelativePath}`);
        this.isReplaying = true;
        this.isRecording = false;

        // Organiza as respostas em filas sequenciais por "METHOD:routePattern"
        this.replayQueues = {};
        sessionData.timeline.forEach((item) => {
          const key = `${item.method}:${item.routePattern}`;
          if (!this.replayQueues[key]) {
            this.replayQueues[key] = [];
          }
          this.replayQueues[key].push(item);
        });

        // Intercepta e responde na ordem exata da fila gravada
        cy.intercept('**', (req) => {
          const url = req.url;
          const apiUrl = Cypress.env('API_URL');
          const isApiUrl = apiUrl && url.startsWith(apiUrl);
          if (!isApiUrl && !url.includes('api.pharmacie') && !url.includes('/stores/') && !url.includes('/users/') && !url.includes('/auth/')) {
            return;
          }

          const pattern = this.getRoutePattern(url);
          const key = `${req.method}:${pattern}`;
          const queue = this.replayQueues[key];

          if (queue && queue.length > 0) {
            // Pega o próximo item da fila (ou mantém o último se esgotar)
            const nextItem = queue.length > 1 ? queue.shift() : queue[0];
            let responseBody = nextItem.responseBody;

            // Adapta dinamicamente o ID do atendimento para coincidir com a URL solicitada pelo frontend
            const match = url.match(/\/attendances\/(\d+)/);
            if (match && responseBody && typeof responseBody === 'object') {
              const reqId = parseInt(match[1], 10);
              responseBody = JSON.parse(JSON.stringify(responseBody));
              if (responseBody.attendance && responseBody.attendance.id) {
                responseBody.attendance.id = reqId;
              }
              if (responseBody.id && typeof responseBody.id === 'number') {
                responseBody.id = reqId;
              }
            }

            // Adapta dinamicamente o atendente para coincidir com as variáveis globais de env.json
            const dynamicUserCode = Cypress.env('USER_CODE') || Cypress.env('user');
            const dynamicClientName = Cypress.env('DEFAULT_CLIENT_NAME');
            if (responseBody && typeof responseBody === 'object' && (dynamicUserCode || dynamicClientName)) {
              responseBody = JSON.parse(JSON.stringify(responseBody));
              const attId = dynamicUserCode ? parseInt(dynamicUserCode, 10) : 122;
              const attName = dynamicClientName ? dynamicClientName.toUpperCase() : 'KLISMAM MONTEIRO';
              if (responseBody.attendance && responseBody.attendance.attendant) {
                responseBody.attendance.attendant.id = attId;
                responseBody.attendance.attendant.name = attName;
                responseBody.attendance.attendant_id = attId;
                responseBody.attendance.attendant_name = attName;
              }
            }

            req.reply({
              statusCode: nextItem.statusCode || 200,
              body: responseBody,
              delay: 20 // Pequeno atraso para estabilização de render do React
            });
          }
        }).as('networkReplayGlobal');
      });
    });
  }
}

export default new NetworkRecorder();
