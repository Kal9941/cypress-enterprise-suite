import AtendimentosPage from '../pages/5.atendimentosPage';
import AtendimentosMocks from '../mocks/5.atendimentosMocks';
import IniciarAtendimentoMocks from '../mocks/4.iniciarAtendimentoMocks';
const configEnv = require('../../env.json');
import { regexApi, rotaApi } from '../support/rotaApi';

// Captura os dados configurados em env.json
const CELULAR_PADRAO = Cypress.env('DEFAULT_CELULAR') || Cypress.env('defaultCelular') || configEnv.DEFAULT_CELULAR || '11999998888';


describe('5-B3. Atendimentos - Chat: Mensagens, Reações, Orçamento por Canal e Estado do Compositor', () => {


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
  // 12. TIMEOUT DE UPLOAD DE MÍDIA EM REDE LENTA (ISSUE #485/PR #478)
  // -------------------------------------------------------------

  context('12. Timeout de Upload de Mídia em Rede Lenta (Issue #485/PR #478)', () => {
    let originalUseMocksState;

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
    });

    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    beforeEach(() => {
      AtendimentosMocks.interceptAttendanceDetailApi('*', {
        ...AtendimentosMocks.mockAttendanceDetailData,
        attendance: {
          ...AtendimentosMocks.mockAttendanceDetailData.attendance,
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
      AtendimentosPage.elements.cardsAtendimento().first().click();
      AtendimentosPage.validarJanelaAtiva(5000);
    });

    it('12.1 não deve exibir "Sem conexão. Tente novamente." nem abortar o envio de um anexo grande quando o servidor demora além do antigo prazo fixo de 15 s (Issue #485/PR #478)', () => {
      // Atraso mockado (20 s) simula o cenário de rede lenta da issue: acima do antigo timeout
      // fixo de 15 s do transporte e bem abaixo do novo mínimo de 120 s (PR #478). O atraso é só
      // na resposta de rede - o temporizador de abort do próprio cliente, que a PR mudou, roda de
      // verdade no browser durante essa espera; se ainda abortasse aos 15 s, pegaria aqui mesmo
      // com a chamada 100% mockada.
      AtendimentosMocks.interceptSendMediaMessageApi('*', 201, null, 20000);

      // Anexo grande = o maior aceito pelo front: desde a front#595/PR #598 o documento acima de 10 MB é recusado na seleção, sem upload
      // (o antigo abaixo-teto-15mb.pdf nunca chegava ao POST). 10 MB exatos (10.485.760 bytes) é a fronteira inclusiva, aceita
      AtendimentosPage.anexarArquivo('cypress/fixtures/5.atendimentos/anexos/limites/teto-global-10mb.pdf', '', 30000);

      cy.wait('@sendChatMediaMessage', { timeout: 30000 }).its('response.statusCode').should('be.oneOf', [200, 201]);

      // Resultado esperado da issue: o envio conclui e o card renderiza - sem a mensagem genérica
      // de rede (que apareceria se o front tivesse abortado a requisição sozinho aos 15 s)
      cy.contains(/Sem conexão\. Tente novamente\./i).should('not.exist');
      cy.get('article[class*="_bubbleRowEnd_"]').last().scrollIntoView({ duration: 300 }).should('be.visible');
    });

    it('12.2 deve exibir "O envio demorou demais..." em vez de "Sem conexão" ao estourar o prazo do upload, mantendo o anexo no compositor (Issue front#488, PR #482)', () => {
      // Nunca responde dentro da janela deste teste (bem acima dos 125 s virtuais que avançamos
      // com cy.tick) - simula o prazo (mínimo 120 s, front#485/PR #478) estourando de verdade.
      AtendimentosMocks.interceptSendMediaMessageApi('*', 201, null, 999999);

      // Estuba os timers do app sob teste (setTimeout/Date) para avançar o relógio sem esperar
      // 125 s de parede - não afeta os retries internos do próprio Cypress (rodam fora do AUT).
      // cy.clock() SEM argumento zera o relógio pro epoch Unix (1970) - quebrou a Janela de 24h e
      // a bolha otimista da mensagem (renderizou "Mídia indisponível" com timestamp 31/12/1969);
      // passar Date.now() preserva a hora real, só controlando o avanço via cy.tick() (achado real
      // ao rodar este teste, front#488).
      cy.clock(Date.now(), ['setTimeout', 'clearTimeout', 'Date']);

      AtendimentosPage.anexarArquivoEDispararEnvio('cypress/fixtures/5.atendimentos/anexos/normal/Anexo de teste jpg.jpg');

      // Avança 125 s virtuais - acima do prazo mínimo de 120 s
      cy.tick(125000);

      // Mensagem nova da PR #482, nunca a genérica de rede
      cy.get('[role="alert"]:visible', { timeout: 20000 })
        .should('be.visible')
        .and('contain.text', 'O envio demorou demais. Confira se a mensagem apareceu na conversa antes de reenviar.');
      cy.contains(/Sem conexão\. Tente novamente\./i).should('not.exist');

      // Anexo continua no compositor, pronto pra decisão do operador (reenviar ou não)
      AtendimentosPage.elements.btnRemoverAnexo().should('be.visible');

      // NÃO coberto aqui (gap conhecido, ver ROADMAP P1): a releitura automática da conversa
      // mostrando a mensagem que o servidor já tinha gravado. 3 tentativas de mock (override
      // direto, dentro de .then() pós-wait) não fizeram o payload customizado substituir o
      // default em nenhuma chamada capturada de @getAttendanceMessages - circuit breaker do
      // R-DIAG acionado, gap deixado para nova investigação ou confirmação manual.
    });

    it('12.3 deve manter "Sem conexão. Tente novamente." numa queda de rede real ao enviar anexo, distinto do timeout do cliente (Issue front#488, PR #482, contraprova)', () => {
      AtendimentosMocks.interceptSendMediaMessageApiComFalhaDeRede('*');

      AtendimentosPage.anexarArquivoEDispararEnvio('cypress/fixtures/5.atendimentos/anexos/normal/Anexo de teste jpg.jpg');

      cy.get('[role="alert"]:visible', { timeout: 20000 })
        .should('be.visible')
        .and('contain.text', 'Sem conexão. Tente novamente.');
      cy.contains(/O envio demorou demais/i).should('not.exist');
    });

  });

  // -------------------------------------------------------------
  // 13. ÍCONE E TOOLTIP DE ERRO DE ENVIO
  // -------------------------------------------------------------

  context('13. Ícone, Tooltip e Reenvio de Mensagem com Falha no Envio (Issue front#522/backend#614, PR #523)', () => {

    // Só roda em API real: depende do atendimento real 260900137 (loja 1, curado pelo dev com 3
    // documentos de 15 MB em "Falha no envio", mesma massa do #13.1/PR #484). Tentei 100% mockado
    // primeiro (AGENTS.md [R-BLIND] seria o padrão) - abandonado: o gatilho "Não enviada ·
    // Reenviar" depende de uma combinação de sinais (capability por mensagem/detalhe/item,
    // atendente, status) que não consegui replicar via mock sintético em tempo hábil (bundle
    // minificado colide nomes de variável entre módulos, 2 pistas falsas seguidas) - confirmado
    // funcionando perfeitamente no atendimento real, então a abordagem virou híbrida por decisão
    // do operador: GETs passam de verdade (API real), só o POST .../retry é interceptado por
    // cenário (200/409/422/rede) - evita mutar de verdade as 3 mensagens de evidência curadas.
    // IDs reais medidos em 2026-10-06: #4856503/#4856485/#4856484 (documento, "Mídia excede
    // tamanho máximo..."), #4856438 (texto "Teste!", sent), #4856502 (texto "Eai", customer).
    const ID_MSG_ERRO = 4856503;
    const ID_MSG_ERRO_2 = 4856485;
    const ID_MSG_ENVIADA = 4856438;
    const ID_MSG_CLIENTE = 4856502;

    function abrirAtendimentoReal() {
      if (AtendimentosMocks.isMockEnabled()) {
        cy.log('ℹ️ [Modo Mock]: cenário depende da massa real do atendimento 260900137 (API real).');
        return false;
      }
      AtendimentosPage.visitarComParametros('attendance=260900137');
      cy.wait('@getAttendanceMessages', { timeout: 30000 });
      return true;
    }

    it('13.2 deve mostrar "Não enviada · Reenviar" só nas mensagens de saída com status error, nunca em enviada ou mensagem do cliente', () => {
      if (!abrirAtendimentoReal()) return;

      AtendimentosPage.elements.statusNaoEnviadaPorId(ID_MSG_ERRO).scrollIntoView().should('be.visible').and('contain.text', 'Não enviada');
      AtendimentosPage.elements.botaoReenviarMensagem(ID_MSG_ERRO).should('be.visible').and('contain.text', 'Reenviar');

      // Contraprovas na mesma conversa real: enviada e mensagem do cliente não mostram a linha
      AtendimentosPage.elements.statusNaoEnviadaPorId(ID_MSG_ENVIADA).should('not.exist');
      AtendimentosPage.elements.botaoReenviarMensagem(ID_MSG_ENVIADA).should('not.exist');
      AtendimentosPage.elements.botaoReenviarMensagem(ID_MSG_CLIENTE).should('not.exist');
    });

    it('13.3 deve chamar POST .../messages/{id}/retry com os ids corretos ao clicar em Reenviar, desabilitando o botão com "Reenviando…" e ignorando um 2º clique', () => {
      if (!abrirAtendimentoReal()) return;
      AtendimentosMocks.interceptRetryMessageApi(ID_MSG_ERRO, 200, null, 800);

      AtendimentosPage.elements.botaoReenviarMensagem(ID_MSG_ERRO).scrollIntoView().click();

      // Clique duplo antes da resposta: só 1 chamada deve sair. force:true necessário aqui: o
      // próprio teste confirma 1 linha acima que o botão está aria-disabled="true" (reenviando) -
      // o clique forçado prova que o app ignora cliques repetidos nesse estado, não mascara bug
      // (AGENTS.md §3.5)
      AtendimentosPage.elements.botaoReenviarMensagem(ID_MSG_ERRO)
        .should('contain.text', 'Reenviando')
        .and('have.attr', 'aria-disabled', 'true')
        .click({ force: true });

      cy.wait('@retryMessage').then((interception) => {
        expect(interception.request.url, 'URL deve conter os ids do atendimento e da mensagem, sem a loja no caminho').to.match(
          new RegExp(regexApi(`attendances/260900137/messages/${ID_MSG_ERRO}/retry`))
        );
        expect(interception.request.body, 'POST sem corpo').to.satisfy((b) => !b || Object.keys(b).length === 0);
      });
      cy.get('@retryMessage.all').should('have.length', 1);
    });

    it('13.4 deve remover a linha e voltar a mesma mensagem para pendente no sucesso (200), sem inserir mensagem nova', () => {
      if (!abrirAtendimentoReal()) return;
      // onSuccess faz um patch direto no cache do React Query (setQueriesData), trocando
      // message_status/error_reason da MESMA mensagem em memória - sem novo GET .../messages
      // (engenharia reversa do bundle real, useRetryAttendanceMessageMutation, 2026-10-06).
      AtendimentosMocks.interceptRetryMessageApi(ID_MSG_ERRO, 200, { id: ID_MSG_ERRO, status: 'ready' });

      AtendimentosPage.elements.botaoReenviarMensagem(ID_MSG_ERRO).scrollIntoView().click();
      cy.wait('@retryMessage');

      // O cache já reflete o sucesso instantaneamente (patch direto, sem esperar rede) - a conversa
      // pode disparar uma releitura adicional logo em seguida (onSettled invalida o "poll scope" da
      // confirmação de ~10s/5min descrita na issue), por isso não afirmamos a contagem de GETs aqui,
      // só o resultado visual: a mesma mensagem, sem duplicar, agora pendente.
      AtendimentosPage.elements.statusNaoEnviadaPorId(ID_MSG_ERRO).should('not.exist');
      cy.get(`[data-message-id="${ID_MSG_ERRO}"]`).should('have.length', 1).find('span[aria-label*="Aguardando"]').should('exist');
    });

    it('13.5 deve mostrar o toast "Esta mensagem não pode ser reenviada. A conversa foi atualizada." no 409 ATTENDANCE_MESSAGE_NOT_RETRYABLE, relendo só a página 1 (Issue front#524/PR #532, ponto 2)', () => {
      if (!abrirAtendimentoReal()) return;
      AtendimentosMocks.interceptRetryMessageApi(ID_MSG_ERRO, 409, {
        status: 409, error: 'Conflict', message: 'Mensagem não pode ser reenviada', code: 'ATTENDANCE_MESSAGE_NOT_RETRYABLE'
      });

      AtendimentosPage.elements.botaoReenviarMensagem(ID_MSG_ERRO).scrollIntoView().click();
      cy.wait('@retryMessage');
      cy.get('div[class*="toast"], div[class*="alert"], div[role="alert"]:visible')
        .should('contain.text', 'Esta mensagem não pode ser reenviada. A conversa foi atualizada.');

      // PR #532 (ponto 2): mensagem no topo do histórico (caso comum, sem histórico rolado) deve
      // reler só a página 1 (via onSettled), não invalidar/recarregar as páginas mais antigas já
      // carregadas - cenário de "mensagem antiga" (precisa de histórico rolado pra existir página
      // 2/3) não coberto aqui por falta de massa real com histórico suficiente (ROADMAP.md P2).
      cy.wait('@getAttendanceMessages').then((interception) => {
        expect(interception.request.url, 'releitura pós-409 deve pedir a página 1').to.match(/[?&]page=1(&|$)/);
      });
      cy.get('@getAttendanceMessages.all').then((chamadas) => {
        const chamadasDePaginaProfunda = chamadas.filter((c) => /[?&]page=([2-9]|\d{2,})(&|$)/.test(c.request.url));
        expect(chamadasDePaginaProfunda, 'não deve recarregar páginas além da 1ª (invalidação de histórico antigo indevida)').to.have.length(0);
      });
    });

    it('13.6 deve mostrar o toast "Este atendimento está sem atendente." no 409 ATTENDANCE_UNASSIGNED', () => {
      if (!abrirAtendimentoReal()) return;
      AtendimentosMocks.interceptRetryMessageApi(ID_MSG_ERRO_2, 409, {
        status: 409, error: 'Conflict', message: 'Atendimento sem atendente', code: 'ATTENDANCE_UNASSIGNED'
      });

      AtendimentosPage.elements.botaoReenviarMensagem(ID_MSG_ERRO_2).scrollIntoView().click();
      cy.wait('@retryMessage');
      cy.get('div[class*="toast"], div[class*="alert"], div[role="alert"]:visible')
        .should('contain.text', 'Este atendimento está sem atendente.');
    });

    it('13.7 deve mostrar o mesmo toast de janela de 24h fechada do envio normal no 422 do reenvio', () => {
      if (!abrirAtendimentoReal()) return;
      // O front NÃO traduz pelo `code` neste caso - mapeia pelo texto cru de `message` (campo que
      // vira `serverMessage` no erro parseado), normalizado e comparado contra uma tabela fixa de
      // frases conhecidas (achado via engenharia reversa do bundle real, 2026-10-06); por isso o
      // mock precisa da frase exata do backend, nunca a cópia amigável que o teste afirma depois.
      AtendimentosMocks.interceptRetryMessageApi(ID_MSG_ERRO_2, 422, {
        status: 422, error: 'Unprocessable Content',
        message: 'A janela de conversa foi encerrada. Envie um template aprovado e aguarde a resposta do cliente.'
      });

      AtendimentosPage.elements.botaoReenviarMensagem(ID_MSG_ERRO_2).scrollIntoView().click();
      cy.wait('@retryMessage');
      cy.get('div[class*="toast"], div[class*="alert"], div[role="alert"]:visible')
        .should('contain.text', 'Só é possível enviar um template aprovado.');
    });

    it('13.8 deve mostrar "Não foi possível reenviar a mensagem. Verifique a conexão." em erro de rede, voltando o botão a ficar clicável', () => {
      if (!abrirAtendimentoReal()) return;
      cy.intercept('POST', rotaApi(`attendances/*/messages/${ID_MSG_ERRO}/retry*`), { forceNetworkError: true }).as('retryMessage');

      AtendimentosPage.elements.botaoReenviarMensagem(ID_MSG_ERRO).scrollIntoView().click();
      cy.wait('@retryMessage');
      cy.get('div[class*="toast"], div[class*="alert"], div[role="alert"]:visible')
        .should('contain.text', 'Não foi possível reenviar a mensagem. Verifique a conexão.');
      AtendimentosPage.elements.botaoReenviarMensagem(ID_MSG_ERRO).should('not.have.attr', 'aria-disabled', 'true');
    });

    it('13.9 não deve exibir toast de recusa do reenvio se o atendente já tiver trocado de conversa antes da resposta chegar', () => {
      if (!abrirAtendimentoReal()) return;
      AtendimentosMocks.interceptRetryMessageApi(ID_MSG_ERRO, 409, {
        status: 409, error: 'Conflict', message: 'Mensagem não pode ser reenviada', code: 'ATTENDANCE_MESSAGE_NOT_RETRYABLE'
      }, 1000);

      AtendimentosPage.elements.botaoReenviarMensagem(ID_MSG_ERRO).scrollIntoView().click();
      // Troca de conversa antes da resposta do retry chegar (1000ms de atraso)
      AtendimentosPage.elements.cardsAtendimento().eq(1).click();
      cy.wait('@retryMessage');
      cy.wait(500);
      cy.get('div[class*="toast"], div[class*="alert"], div[role="alert"]:visible').should('not.exist');
    });

    // Gap aceito: não achamos, na massa real disponível, um atendimento com mensagem em erro E
    // sem atendente/sem permissão de envio ao mesmo tempo, pra confirmar com a mesma evidência das
    // demais acima que a linha de reenvio simplesmente não aparece nesse caso. Mock sintético
    // tentado nesta sessão não reproduziu nem a condição positiva nem a negativa de forma
    // confiável (ver nota no topo do context) - não incluído como teste até achar massa real ou
    // confirmação do dev sobre a condição exata de canSendMessages.

    it('13.1 deve exibir o ícone de erro de envio sem o atributo title nativo, com o motivo completo em tooltip acessível por mouse e teclado (Issue front#490, PR #484)', () => {
      // Só roda em API real: depende do atendimento real 260900137 (loja 1), curado pelo dev na
      // issue com 3 PDFs de 15 MB em "Falha no envio" — ainda não sabemos o valor de message_status
      // que aciona o ícone no front, então não há como blindar isso em mock por enquanto (R-EVID).
      if (AtendimentosMocks.isMockEnabled()) {
        cy.log('ℹ️ [Modo Mock]: cenário depende da massa real do atendimento 260900137 (API real).');
        return;
      }

      // Act: abre diretamente o atendimento conhecido com mensagens em falha de envio
      AtendimentosPage.visitarComParametros('attendance=260900137');
      cy.wait('@getAttendanceMessages', { timeout: 30000 });

      // Assert: pelo menos um ícone de erro visível na conversa
      AtendimentosPage.elements.iconesErroEnvio().should('have.length.greaterThan', 0);

      // Assert: sem o atributo title nativo (removido pela PR #484) — falha aqui se o DOM ainda
      // usa o padrão antigo (AGENTS.md §2.3), gerando last-failure-dom.html pra inspeção
      AtendimentosPage.elements.iconesErroEnvio().last()
        .scrollIntoView({ duration: 300 })
        .should('be.visible')
        .and('not.have.attr', 'title');

      // Assert: hover mostra o tooltip acessível com o motivo completo
      AtendimentosPage.elements.iconesErroEnvio().last().trigger('mouseover');
      AtendimentosPage.elements.tooltipErroEnvio()
        .should('be.visible')
        .invoke('text')
        .should('match', /excede.*m[aá]ximo|excede o limite|limite de \d/i);

      // Assert: some ao tirar o mouse
      AtendimentosPage.elements.iconesErroEnvio().last().trigger('mouseout');
      cy.get('[role="tooltip"]').should('not.exist');

      // Assert: foco pelo teclado também abre o mesmo tooltip (Tab, não só mouse)
      AtendimentosPage.elements.iconesErroEnvio().last().focus();
      AtendimentosPage.elements.tooltipErroEnvio().should('be.visible');
      AtendimentosPage.elements.iconesErroEnvio().last().blur();
      cy.get('[role="tooltip"]').should('not.exist');
    });

    it('13.10 deve parar a animação do spinner de "Reenviando…" com prefers-reduced-motion:reduce (Issue front#524/PR #532, ponto 3)', () => {
      if (!abrirAtendimentoReal()) return;
      // Emulação via CDP (cy.forcarPrefersReducedMotion, cypress/support/commands.js) - Cypress não
      // expõe essa media feature como config nativa; confirmado funcional só em família Chromium
      // (AGENTS.md [R-RUN] já exige --browser chrome aqui). Classe real confirmada no DOM:
      // "_retrySpinner_..." (renomeada de "_statusRetrySpinner_" pela própria PR #532).
      cy.forcarPrefersReducedMotion(true);
      AtendimentosMocks.interceptRetryMessageApi(ID_MSG_ERRO, 200, null, 3000);

      AtendimentosPage.elements.botaoReenviarMensagem(ID_MSG_ERRO).scrollIntoView().click();

      cy.get(`[data-testid="button-retry-message-${ID_MSG_ERRO}"] [class*="retrySpinner"]`)
        .should('exist')
        .should(($el) => {
          const estilo = $el[0].ownerDocument.defaultView.getComputedStyle($el[0]);
          expect(estilo.animationName, 'animação do spinner deve ficar parada (none) com prefers-reduced-motion:reduce').to.eq('none');
        });

      cy.wait('@retryMessage');
    });

    it('13.11 contraprova: sem prefers-reduced-motion, o spinner de "Reenviando…" continua animando normalmente', () => {
      if (!abrirAtendimentoReal()) return;
      cy.forcarPrefersReducedMotion(false);
      AtendimentosMocks.interceptRetryMessageApi(ID_MSG_ERRO, 200, null, 3000);

      AtendimentosPage.elements.botaoReenviarMensagem(ID_MSG_ERRO).scrollIntoView().click();

      cy.get(`[data-testid="button-retry-message-${ID_MSG_ERRO}"] [class*="retrySpinner"]`)
        .should('exist')
        .should(($el) => {
          const estilo = $el[0].ownerDocument.defaultView.getComputedStyle($el[0]);
          expect(estilo.animationName, 'animação do spinner deve estar ativa sem prefers-reduced-motion').to.not.eq('none');
        });

      cy.wait('@retryMessage');
    });
  });

  context('14. Busca Sob Demanda do Conteúdo Binário de Anexos (Issue front#521/backend#612/#613)', () => {

    // Só roda em API real: depende do atendimento real 260900034 (loja 1), curado pelo dev com 1
    // anexo de cada tipo (jpg/pdf/doc/docx/xls/xlsx/txt/mp3/mp4) já sem `attachment.url`/`data` na
    // listagem (backend#613 já no ar na dev) — é o mesmo atendimento citado no critério de aceite
    // da issue e o mesmo já usado no diagnóstico de performance do ROADMAP.md (21 mensagens).
    // IDs reais medidos em 2026-10-06 (GET .../messages, confirmados sem url/data):
    const ID_IMG = 4854967;      // sample.jpg
    const ID_PDF = 4854968;      // sample.pdf
    const ID_DOC = 4854969;      // sample.doc
    const ID_DOCX = 4854970;     // sample.docx
    const ID_XLS = 4854971;      // sample.xls
    const ID_XLSX = 4854972;     // sample.xlsx
    const ID_TXT = 4854973;      // sample.txt
    const ID_AUDIO = 4854974;    // sample.mp3
    const ID_VIDEO = 4854975;    // sample.mp4

    function abrirAtendimentoReal() {
      if (AtendimentosMocks.isMockEnabled()) {
        cy.log('ℹ️ [Modo Mock]: cenário depende da massa real do atendimento 260900034 (API real).');
        return false;
      }
      AtendimentosPage.visitarComParametros('attendance=260900034');
      cy.wait('@getAttendanceMessages', { timeout: 30000 });
      return true;
    }

    it('14.1 deve buscar o conteúdo de imagem/PDF pela rota nova quando a listagem não traz url/data, renderizando via Blob tipado pelo mime_type da listagem', () => {
      if (!abrirAtendimentoReal()) return;
      cy.intercept('GET', `**/messages/${ID_IMG}/attachment*`).as('getImgAttachment');
      cy.intercept('GET', `**/messages/${ID_PDF}/attachment*`).as('getPdfAttachment');

      AtendimentosPage.rolarAteRevelarAnexosSobDemanda(400);

      cy.wait('@getImgAttachment').its('response.statusCode').should('eq', 200);
      cy.wait('@getPdfAttachment').its('response.statusCode').should('eq', 200);

      AtendimentosPage.elements.botaoAnexoImagem()
        .filter(`[data-testid="attachment-image-${ID_IMG}"]`)
        .should('be.visible')
        .find('img')
        .should('have.attr', 'src')
        .and('match', /^blob:/);

      cy.get(`[data-testid="attachment-pdf-${ID_PDF}"]`).should('be.visible');

      // O <img> renderiza a partir de um Blob tipado por `attachment.mime_type` da listagem
      // (image/jpeg), não pelo Content-Type da resposta da rota — reconfirma via fetch() do
      // próprio blob: URL dentro do browser (engenharia reversa do bundle, `new Blob([...], {type})`)
      cy.get(`[data-testid="attachment-image-${ID_IMG}"] img`).invoke('attr', 'src').then((src) => {
        cy.window().then((win) => win.fetch(src).then((r) => r.blob()).then((blob) => {
          expect(blob.type, 'tipo do Blob da imagem deve vir do mime_type da listagem').to.eq('image/jpeg');
        }));
      });
    });

    it('14.2 deve renderizar documentos sem prévia (doc/docx/xls/xlsx/txt) com o botão de baixar imediatamente, sem buscar o conteúdo antes do clique', () => {
      if (!abrirAtendimentoReal()) return;
      cy.intercept('GET', '**/messages/*/attachment*').as('getAnyAttachment');

      const documentos = [
        { id: ID_DOC, nome: 'sample.doc' },
        { id: ID_DOCX, nome: 'sample.docx' },
        { id: ID_XLS, nome: 'sample.xls' },
        { id: ID_XLSX, nome: 'sample.xlsx' },
        { id: ID_TXT, nome: 'sample.txt' },
      ];
      documentos.forEach(({ id, nome }) => {
        AtendimentosPage.elements.botaoBaixarDocumento(id)
          .scrollIntoView()
          .should('be.visible')
          .and('have.attr', 'aria-label', `Baixar documento ${nome}`);
      });

      // Nenhum desses 5 documentos dispara a rota de conteúdo sem clique (botão, não query eager)
      cy.get('@getAnyAttachment.all').should('have.length', 0);
    });

    it('14.3 deve buscar o conteúdo só ao clicar em "Baixar documento" e devolver ao estado normal depois', () => {
      if (!abrirAtendimentoReal()) return;
      cy.intercept('GET', `**/messages/${ID_DOC}/attachment*`).as('getDocAttachment');

      AtendimentosPage.elements.botaoBaixarDocumento(ID_DOC).scrollIntoView().should('be.visible').click();

      cy.wait('@getDocAttachment').its('response.statusCode').should('eq', 200);
      // Download via anchor/Blob transiente (sem href persistente no DOM) — o ambiente real já
      // tem flakiness conhecida e documentada pra gravação em disco de cliques sintéticos
      // (AGENTS.md/Issue backend#564, 2026-09-30); a prova de conteúdo correto é a própria
      // resposta 200 da rota com o id certo, consistente com o padrão já adotado em
      // `baixarDocumentoSobDemandaEValidar` no 5-B1.
      AtendimentosPage.elements.botaoBaixarDocumento(ID_DOC)
        .should('have.attr', 'aria-busy', 'false')
        .and('not.have.attr', 'aria-disabled', 'true');
    });

    it('14.4 deve mostrar "Mídia indisponível" sem botão de tentar novamente quando a rota devolve 404 (mensagem sem conteúdo binário)', () => {
      if (!abrirAtendimentoReal()) return;
      AtendimentosMocks.interceptAttachmentRouteApi(ID_AUDIO, 404);

      AtendimentosPage.rolarAteRevelarAnexosSobDemanda(1400);
      cy.wait('@getAttachmentContent').its('response.statusCode').should('eq', 404);

      AtendimentosPage.elements.placeholderAnexoIndisponivel(ID_AUDIO).scrollIntoView().should('be.visible').and('contain.text', 'Mídia indisponível');
      AtendimentosPage.elements.botaoTentarNovamenteAnexo(ID_AUDIO).should('not.exist');
    });

    it('14.5 deve mostrar "Não foi possível carregar o anexo" com botão "Tentar novamente" em erro genérico, e resolver ao clicar o retry', () => {
      if (!abrirAtendimentoReal()) return;
      AtendimentosMocks.interceptAttachmentRouteApi(ID_VIDEO, 500);

      AtendimentosPage.rolarAteRevelarAnexosSobDemanda(1400);
      cy.wait('@getAttachmentContent').its('response.statusCode').should('eq', 500);

      AtendimentosPage.elements.placeholderAnexoComErro(ID_VIDEO).scrollIntoView().should('be.visible').and('contain.text', 'Não foi possível carregar o anexo');
      AtendimentosPage.elements.botaoTentarNovamenteAnexo(ID_VIDEO).should('be.visible').and('contain.text', 'Tentar novamente');

      // Deixa a 2ª tentativa passar pra API real (sucesso) e confirma que resolve
      AtendimentosMocks.interceptAttachmentRouteApi(ID_VIDEO, null);
      AtendimentosPage.elements.botaoTentarNovamenteAnexo(ID_VIDEO).click();
      cy.wait('@getAttachmentContent').its('response.statusCode').should('eq', 200);
      AtendimentosPage.elements.placeholderAnexoComErro(ID_VIDEO).should('not.exist');
      cy.get(`[data-message-id="${ID_VIDEO}"] video`).should('have.attr', 'src').and('match', /^blob:/);
    });

    it('14.6 não deve refazer o GET da rota pro mesmo anexo já visível de novo (cache por message_id, sem recarregar a página)', () => {
      if (!abrirAtendimentoReal()) return;
      cy.intercept('GET', `**/messages/${ID_IMG}/attachment*`).as('getImgAttachment');

      AtendimentosPage.rolarAteRevelarAnexosSobDemanda(400);
      cy.wait('@getImgAttachment');
      cy.get('@getImgAttachment.all').should('have.length', 1);

      // Rola pro fundo da conversa (anexo sai de vista) e volta pro topo outra vez, na mesma
      // sessão SPA (sem cy.visit/reload, que apagaria o cache em memória de propósito) — o
      // IntersectionObserver é "one-shot" (função Ng do bundle: dispara 1x e nunca reobserva),
      // então mesmo saindo e voltando a ficar visível não deve gerar um 2º GET
      cy.get('section[class*="_scrollArea_"]').first().invoke('scrollTop', 2000).trigger('scroll');
      cy.wait(2000);
      AtendimentosPage.rolarAteRevelarAnexosSobDemanda(400);
      cy.wait(2000);

      cy.get('@getImgAttachment.all').should('have.length', 1);
    });

    // Gap aceito (ponto 5 da issue, compositor liberado durante o carregamento da listagem): não
    // criamos um teste automatizado pra isso. Por engenharia reversa do bundle real confirmamos
    // que o texto `composer.loadingConversation` ("Carregando a conversa…") é condicionado por um
    // estado desacoplado de `disabled`/`canSubmit` do compositor (que vêm de capabilities/estado
    // de envio, não do loading da listagem de mensagens) — mas 2 tentativas de prova ponta-a-ponta
    // com `cy.intercept`/`setDelay` no atendimento real 260900034 falharam por motivos distintos
    // em cada rodada (texto nunca observável na janela de retry do Cypress, mesmo com atraso de
    // 3s e depois 8s) e essa conversa tem a janela de 24h encerrada (contexto 4 deste arquivo) —
    // sem textarea livre pra provar "não desabilita o envio" mesmo se o texto fosse capturado.
    // Precisa de um atendimento real com janela ABERTA e controle de atraso confiável no GET de
    // mensagens (ou confirmação do dev sobre o gatilho exato do texto) pra fechar esta lacuna.
  });

  context('15. Reações em Mensagens (Issue front#530/PR #536, épico #515, backend#617)', () => {
    // Blindagem 100% mockada (AGENTS.md §3.2 [R-BLIND], critério (c): estado transiente de
    // reação/mutação otimista/SSE não é reproduzível de forma determinística contra a API real).
    let originalUseMocksState;
    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
    });
    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    const EMOJI_LINHA_RAPIDA = { 'thumbs-up': '👍', heart: '❤️', joy: '😂', 'open-mouth': '😮', cry: '😢', pray: '🙏' };
    const PAGINACAO_1_ITEM = { page: 1, per_page: 20, total: 1, total_pages: 1, has_next: false, has_previous: false };

    // Esquema {{e:HEX}} (1 token por code point Unicode) inferido do único exemplo confirmado na
    // issue (🙏 -> {{e:1F64F}}, hex bate exatamente com o code point U+1F64F) - não localizei a
    // função de codificação real no bundle eager (pode estar em chunk lazy não analisado); se
    // divergir pra emoji multi-code-point, ajustar aqui (AGENTS.md [R-EVID]).
    function codificarEmoji(emoji) {
      return [...emoji].map((cp) => `{{e:${cp.codePointAt(0).toString(16).toUpperCase()}}}`).join('');
    }

    function mensagemBase(id, overrides = {}) {
      return {
        id,
        created_at: new Date().toISOString(),
        origin: 'customer',
        employee_code: null,
        transfer_type: 0,
        content_type: 'text',
        message_status: 'sent',
        content: 'Mensagem de teste',
        attachment: null,
        replied_message: null,
        reactions: [],
        ...overrides
      };
    }

    function interceptarComMensagem(mensagem) {
      AtendimentosMocks.interceptMessagesListApi('*', { data: [mensagem], pagination: PAGINACAO_1_ITEM });
    }

    beforeEach(() => {
      AtendimentosMocks.interceptAttendanceDetailApi('*', {
        ...AtendimentosMocks.mockAttendanceDetailData,
        attendance: {
          ...AtendimentosMocks.mockAttendanceDetailData.attendance,
          status: 1,
          last_customer_message_at: new Date().toISOString(),
          service_window_active: true,
          service_window: { started_at: new Date().toISOString(), expires_at: new Date(Date.now() + 86400000).toISOString() }
        },
        capabilities: { ...AtendimentosMocks.mockAttendanceDetailData.capabilities, can_send_free_text: true }
      });
      interceptarComMensagem(mensagemBase(900000));
      AtendimentosPage.elements.cardsAtendimento().first().click();
      cy.wait('@getAttendanceMessages');
    });

    it('15.1 deve mostrar a reação do cliente e a do atendente simultaneamente, até duas por mensagem', () => {
      const idMsg = 900101;
      interceptarComMensagem(mensagemBase(idMsg, {
        reactions: [
          { author: 'customer', emoji: codificarEmoji('🙏'), status: null, error_reason: null },
          { author: 'employee', emoji: codificarEmoji('👍'), status: 'sent', error_reason: null }
        ]
      }));
      cy.reload();
      cy.wait('@getAttendanceMessages');

      AtendimentosPage.elements.badgeReacaoCliente(idMsg).should('be.visible').and('have.text', '🙏');
      // data-state reflete o estado de UI (jr()), não o `status` cru da API - medido contra o DOM
      // real em 2026-10-07: status "sent" renderiza data-state "settled"
      AtendimentosPage.elements.badgeReacaoAtendente(idMsg).should('be.visible').and('have.text', '👍').and('have.attr', 'data-state', 'settled');
    });

    it('15.2 deve renderizar a reação do atendente em estado "enviando" (pending) esmaecida, com aria-busy', () => {
      const idMsg = 900102;
      interceptarComMensagem(mensagemBase(idMsg, {
        reactions: [{ author: 'employee', emoji: codificarEmoji('❤️'), status: 'pending', error_reason: null }]
      }));
      cy.reload();
      cy.wait('@getAttendanceMessages');

      // data-state reflete o estado de UI (jr()), não o `status` cru da API - medido contra o DOM
      // real em 2026-10-07: status "pending" renderiza data-state "sending"
      AtendimentosPage.elements.badgeReacaoAtendente(idMsg)
        .should('be.visible')
        .and('have.attr', 'aria-busy', 'true')
        .and('have.attr', 'data-state', 'sending');
    });

    it('15.3 deve mostrar o indicador de falha com o motivo em tooltip acessível no hover e no foco por teclado', () => {
      const idMsg = 900103;
      const motivo = 'A janela de conversa do WhatsApp está fechada.';
      interceptarComMensagem(mensagemBase(idMsg, {
        reactions: [{ author: 'employee', emoji: codificarEmoji('😮'), status: 'error', error_reason: motivo }]
      }));
      cy.reload();
      cy.wait('@getAttendanceMessages');

      AtendimentosPage.elements.indicadorFalhaReacao(idMsg).scrollIntoView().should('be.visible');

      // Reaproveita o mesmo componente de tooltip de `message-status-error` (bundle real,
      // bubbleClassName: Z.statusReasonTooltip) - seletor por classe como fallback ao `role`
      // nativo, caso a variante usada aqui (`describe:false`) não grave `role="tooltip"`
      // (achado desta sessão: `[role="tooltip"]:visible` sozinho não encontrou o elemento,
      // apesar do texto certo aparecer visualmente no screenshot da falha, 2026-10-07)
      // Causa medida em 2026-10-15 (trace de falha, Chrome 155 e Firefox 158): o tooltip existe, com o
      // texto certo e desenhado por cima da bolha, mas é position:fixed com pointer-events:none; o
      // :visible do Cypress decide a visibilidade de elemento fixo por elementFromPoint e o toma como
      // coberto pela bolha do cliente embaixo. Por isso a visibilidade é checada por estilo calculado e
      // retângulo dentro da viewport, nunca por :visible.
      const seletorTooltipQualquerEstado = '[role="tooltip"], [class*="statusReasonTooltip"]';
      const validarTooltipVisivel = () => {
        cy.get(seletorTooltipQualquerEstado).should('contain.text', motivo).first().should(($el) => {
          const el = $el[0];
          const win = el.ownerDocument.defaultView;
          const css = win.getComputedStyle(el);
          const r = el.getBoundingClientRect();
          expect(css.display, 'display do tooltip').to.not.eq('none');
          expect(css.visibility, 'visibility do tooltip').to.eq('visible');
          expect(Number(css.opacity), 'opacity do tooltip').to.be.greaterThan(0);
          expect(r.width, 'largura do tooltip').to.be.greaterThan(0);
          expect(r.height, 'altura do tooltip').to.be.greaterThan(0);
          expect(r.left, 'tooltip dentro da viewport (esquerda)').to.be.at.least(0);
          expect(r.top, 'tooltip dentro da viewport (topo)').to.be.at.least(0);
          expect(r.right, 'tooltip dentro da viewport (direita)').to.be.at.most(win.innerWidth);
          expect(r.bottom, 'tooltip dentro da viewport (base)').to.be.at.most(win.innerHeight);
        });
      };

      AtendimentosPage.elements.indicadorFalhaReacao(idMsg).trigger('mouseover');
      validarTooltipVisivel();
      AtendimentosPage.elements.indicadorFalhaReacao(idMsg).trigger('mouseout');
      cy.get(seletorTooltipQualquerEstado).should('not.exist');

      AtendimentosPage.elements.indicadorFalhaReacao(idMsg).focus();
      validarTooltipVisivel();
      AtendimentosPage.elements.indicadorFalhaReacao(idMsg).blur();
      cy.get(seletorTooltipQualquerEstado).should('not.exist');
    });

    it('15.4 deve abrir a linha rápida de reações com as 6 opções padrão e o "+" ao clicar no botão de reagir no hover do balão', () => {
      const idMsg = 900104;
      interceptarComMensagem(mensagemBase(idMsg));
      cy.reload();
      cy.wait('@getAttendanceMessages');

      AtendimentosPage.abrirLinhaDeReacoes(idMsg);

      Object.keys(EMOJI_LINHA_RAPIDA).forEach((chave) => {
        AtendimentosPage.elements.opcaoRapidaReacao(chave).should('be.visible').and('contain.text', EMOJI_LINHA_RAPIDA[chave]);
      });
      AtendimentosPage.elements.botaoMaisReacoes().should('be.visible');
    });

    it('15.5 deve disparar PUT com o emoji codificado ao escolher na linha rápida, atualizando o badge antes da resposta do servidor (otimista)', () => {
      const idMsg = 900105;
      interceptarComMensagem(mensagemBase(idMsg));
      AtendimentosMocks.interceptReactionApi(idMsg, 'PUT', 204, null, 800);
      cy.reload();
      cy.wait('@getAttendanceMessages');

      AtendimentosPage.reagirNaLinhaRapida(idMsg, 'heart');

      // Otimista (onMutate seta status "pending" no cache antes da resposta): o badge já aparece
      // esmaecido antes da resposta do servidor (delay de 800ms)
      AtendimentosPage.elements.badgeReacaoAtendente(idMsg)
        .should('be.visible')
        .and('have.text', '❤️')
        .and('have.attr', 'aria-busy', 'true');

      cy.wait('@putReaction').then((interception) => {
        expect(interception.request.body, 'corpo do PUT deve trazer o emoji codificado').to.deep.equal({ emoji: codificarEmoji('❤️') });
      });
    });

    it('15.6 deve disparar DELETE e remover a reação otimisticamente ao clicar na própria reação do atendente já aplicada', () => {
      const idMsg = 900106;
      interceptarComMensagem(mensagemBase(idMsg, {
        reactions: [{ author: 'employee', emoji: codificarEmoji('👍'), status: 'sent', error_reason: null }]
      }));
      AtendimentosMocks.interceptReactionApi(idMsg, 'DELETE', 204, null, 500);
      cy.reload();
      cy.wait('@getAttendanceMessages');

      AtendimentosPage.elements.badgeReacaoAtendente(idMsg).should('be.visible').click();

      // Otimista: o badge já some antes da resposta do servidor (delay de 500ms)
      AtendimentosPage.elements.badgeReacaoAtendente(idMsg).should('not.exist');

      // onSettled dispara uma releitura de invalidação (messagesPollScope) - sem atualizar o mock
      // de listagem pro estado pós-remoção, essa releitura reintroduz a reação antiga e derruba o
      // otimismo (achado real desta sessão, 2026-10-07); atualiza o mock antes de aguardar o DELETE
      interceptarComMensagem(mensagemBase(idMsg));
      cy.wait('@removeReaction');
      AtendimentosPage.elements.badgeReacaoAtendente(idMsg).should('not.exist');
    });

    it('15.7 deve remover a reação ao selecionar na linha rápida o mesmo emoji já aplicado (equivalente ao DELETE)', () => {
      const idMsg = 900107;
      // onSettled do DELETE dispara uma releitura de invalidação (messagesPollScope): sem o mock de
      // listagem no estado pós-remoção, essa releitura reintroduz a reação antiga e derruba a asserção
      // (achado 2026-10-07). Causa medida em 2026-10-15 pelo trace de falha: removeReaction seguido de
      // nova listagem, só em headless (Chrome 155 e Firefox 158; no cypress open com tela, mais lento,
      // passava). Trocar o mock por ordem de comandos não serve: a tela lê a listagem mais de uma vez
      // após o reload. A transição fica ligada ao evento (DELETE atendido), como o servidor real, e o
      // DELETE tem atraso (padrão do 15.5) para provar a remoção otimista antes da resposta.
      const reacaoDoAtendente = [{ author: 'employee', emoji: codificarEmoji('😂'), status: 'sent', error_reason: null }];
      AtendimentosMocks.interceptListagemComRemocaoDeReacao(
        '*',
        idMsg,
        { data: [mensagemBase(idMsg, { reactions: reacaoDoAtendente })], pagination: PAGINACAO_1_ITEM },
        { data: [mensagemBase(idMsg)], pagination: PAGINACAO_1_ITEM },
        800
      );
      cy.reload();
      cy.wait('@getAttendanceMessages');

      AtendimentosPage.abrirLinhaDeReacoes(idMsg);
      AtendimentosPage.elements.opcaoRapidaReacao('joy').should('have.attr', 'aria-pressed', 'true').click();

      // Otimista: o badge já some antes da resposta do servidor (que demora 800 ms)
      AtendimentosPage.elements.badgeReacaoAtendente(idMsg).should('not.exist');

      cy.wait('@removeReaction');
      AtendimentosPage.elements.badgeReacaoAtendente(idMsg).should('not.exist');
    });

    it('15.8 deve abrir o picker completo de emojis ao clicar no "+", inteiro dentro da tela', () => {
      const idMsg = 900108;
      interceptarComMensagem(mensagemBase(idMsg));
      cy.reload();
      cy.wait('@getAttendanceMessages');

      AtendimentosPage.abrirLinhaDeReacoes(idMsg);
      AtendimentosPage.elements.botaoMaisReacoes().click();

      AtendimentosPage.elements.pickerCompletoEmoji().should('be.visible').then(($el) => {
        const rect = $el[0].getBoundingClientRect();
        expect(rect.left, 'picker não deve vazar a tela à esquerda').to.be.at.least(0);
        expect(rect.right, 'picker não deve vazar a tela à direita').to.be.at.most(Cypress.config('viewportWidth'));
        expect(rect.top, 'picker não deve vazar a tela por cima').to.be.at.least(0);
      });
    });

    it('15.9 deve reverter a atualização otimista e manter a reação anterior quando o servidor recusa o PUT (409)', () => {
      const idMsg = 900109;
      interceptarComMensagem(mensagemBase(idMsg, {
        reactions: [{ author: 'employee', emoji: codificarEmoji('🙏'), status: 'sent', error_reason: null }]
      }));
      AtendimentosMocks.interceptReactionApi(idMsg, 'PUT', 409, {
        status: 409, error: 'Conflict', message: 'Mensagem não pode receber reação.', code: 'MESSAGE_NOT_REACTABLE'
      });
      cy.reload();
      cy.wait('@getAttendanceMessages');

      AtendimentosPage.reagirNaLinhaRapida(idMsg, 'heart');
      cy.wait('@putReaction');

      // onError reverte sincronamente pro valor anterior (🙏) - nunca fica sem badge nem com ❤️
      AtendimentosPage.elements.badgeReacaoAtendente(idMsg).should('be.visible').and('have.text', '🙏').and('have.attr', 'data-state', 'settled');
    });

    it('15.10 não deve exibir o botão de reagir em mensagem com envio ainda pendente (sem wamid confirmado)', () => {
      const idMsg = 900110;
      interceptarComMensagem(mensagemBase(idMsg, { origin: 'employee', employee_code: '122', message_status: 'ready', content: 'Enviando...' }));
      cy.reload();
      cy.wait('@getAttendanceMessages');

      cy.get(`[data-message-id="${idMsg}"] article`).trigger('mouseover');
      AtendimentosPage.elements.botaoReagirMensagem(idMsg).should('not.exist');
    });

    it('15.11 deve renderizar um emoji multi-code-point (👍🏽) inteiro no badge, sem quebrar em pedaços', () => {
      const idMsg = 900111;
      const emojiComTomDePele = '👍🏽'; // U+1F44D + U+1F3FD (skin tone modifier)
      interceptarComMensagem(mensagemBase(idMsg, {
        reactions: [{ author: 'customer', emoji: codificarEmoji(emojiComTomDePele), status: null, error_reason: null }]
      }));
      cy.reload();
      cy.wait('@getAttendanceMessages');

      AtendimentosPage.elements.badgeReacaoCliente(idMsg)
        .should('be.visible')
        .invoke('text')
        .should('eq', emojiComTomDePele);
    });

    // Gaps aceitos, não cobertos nesta rodada (dependem de telefone físico ou mecanismo de SSE
    // sintético inexistente no repo - AGENTS.md [R-DIAG]): (1) chegada ao vivo da reação do cliente
    // via SSE real do celular; (2) reação fora da janela de 24h mostrando o motivo real de falha
    // (não sintético); (3) dependência da trigger `OC_ATENDIMENTO_REACAO_AIUD` em outros tenants
    // (DDL de banco, não testável por E2E); (4) tema escuro e área de toque em tablet (visuais, não
    // funcionais); (5) invalidação seletiva do evento SSE `message.reaction_changed` (confirmada só
    // por leitura do bundle real - `ah['message.reaction_changed']` só invalida `[messages,
    // messageHistory]` da conversa aberta, nunca fila/summary - sem helper de simulação de SSE no
    // repo pra provar via E2E, ver `cypress/support/e2e.js` que já responde 403 fixo ao stream);
    // (6) exclusão específica do botão em card de orçamento enviado - não confirmei a condição
    // exata que distingue "orçamento" de "documento genérico" no gating da feature (função
    // minificada não localizada com confiança na janela de tempo desta sessão), só a condição de
    // mensagem sem wamid (#15.10); (7) navegação por teclado (Tab/Enter) - não incluída por risco
    // de instabilidade de foco já documentado em outros pontos deste arquivo sem um precedente
    // confiável de como simular Tab sequencial no repo (sem plugin de Tab real).
  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 16: NOTIFICAÇÃO DE ORÇAMENTO GERADO PELA I.A. (exploração do operador,
  // 2026-10-07, sem issue aberta) - 100% mockado [R-BLIND]: o tempo real de
  // processamento da IA (segundos a minutos) não é reproduzível de forma determinística.
  // ---------------------------------------------------------------------------
  context('16. Notificação de Orçamento Gerado pela I.A. (exploração do operador, sem issue)', () => {

    beforeEach(() => {
      // Abre uma conversa com a janela 24h ativa (mesmo padrão do ctx 1) - só pra ter um
      // atendimento selecionado antes de trocar o mock de mensagens e recarregar.
      AtendimentosMocks.interceptAttendanceDetailApi('*', {
        ...AtendimentosMocks.mockAttendanceDetailData,
        attendance: {
          ...AtendimentosMocks.mockAttendanceDetailData.attendance,
          status: 1,
          last_customer_message_at: new Date().toISOString(),
          service_window_active: true,
          service_window: { started_at: new Date().toISOString(), expires_at: new Date(Date.now() + 86400000).toISOString() }
        }
      });
      AtendimentosPage.elements.cardsAtendimento().first().click();
      cy.wait('@getAttendanceMessages');
    });

    it('16.1 deve atualizar sozinho o aviso "processando" para o texto final com o orçamento, sem reload nem ação do usuário, quando a I.A. termina (achado real: edição in-place da mesma mensagem)', () => {
      // Achado real (escuta ao vivo contra api.omnicare.dev.local, 2026-10-07, atendimento
      // 261000039, massa usada em 0-B ctx 36): a notificação da IA renderiza como
      // evento de sistema centralizado (_transferEvent_, mesmo mecanismo de aviso de
      // transferência), nunca uma bolha de chat comum - e o front refaz sozinho GET .../messages
      // a cada ~60s mesmo sem mensagem "ready" pendente (poll de fallback, AGENTS.md §4.1).
      const idMensagem = 998899;
      const mensagemProcessando = {
        id: idMensagem, created_at: new Date().toISOString(), origin: 'employee', employee_code: '0',
        transfer_type: 4, content_type: 'text', message_status: 'sent',
        content: '# Arquivo nº: 9001 processando o orçamento pela I.A., aguarde...', attachment: null
      };
      const paginacao = { page: 1, per_page: 20, total: 1, total_pages: 1, has_next: false, has_previous: false };
      const listaProcessando = { data: [mensagemProcessando], pagination: paginacao };
      // A IA termina "entre um poll e outro": a mesma mensagem (mesmo id) volta com o content
      // reescrito - nunca uma 2ª mensagem de conclusão (0-B #36.3).
      const listaConcluida = { data: [{ ...mensagemProcessando, content: '# Arquivo nº: 9001\rReceita nº: 999001 processada pela I.A.!' }], pagination: paginacao };

      // Transição por tempo real decorrido, não por contagem de chamada (AGENTS.md [R-MOCK]:
      // "nunca decidir por chamada > 1" - o boot do reload pode disparar mais de 1 GET de
      // montagem antes do clique/assert deliberado, consumindo posições do array cedo demais).
      const inicioMock = Date.now();
      const JANELA_PROCESSANDO_MS = 4000;
      cy.intercept('GET', rotaApi('attendances/*/messages*'), (req) => {
        const corpo = (Date.now() - inicioMock) < JANELA_PROCESSANDO_MS ? listaProcessando : listaConcluida;
        req.reply({ statusCode: 200, body: corpo });
      }).as('getAttendanceMessages');

      cy.reload();
      cy.wait('@getAttendanceMessages');

      AtendimentosPage.elements.getEventoSistemaPorId(idMensagem)
        .should('be.visible')
        .and('contain.text', 'processando o orçamento pela I.A.');

      // Sem nenhuma ação do teste daqui em diante (sem reload, sem clique) - a atualização
      // precisa vir sozinha do poll de fallback. Timeout generoso (> 60s medidos ao vivo) aplicado
      // no cy.get (não no .should() - a opção de timeout não se aplica ali, só no comando que
      // produz o subject).
      cy.get(`[data-message-id="${idMensagem}"] span[class*="_transferEvent_"]`, { timeout: 70000 })
        .should('contain.text', 'Receita nº: 999001 processada pela I.A.!');
    });

  });

  // ---------------------------------------------------------------------------
  // 17. TEXTO DO ORÇAMENTO POR CANAL (SINTÉTICO / PRODUTOS DIGITADOS / TEXTO DO RÓTULO)
  // ---------------------------------------------------------------------------
  context('17. Texto do Orçamento por Canal na Modal "Enviar Orçamento" (Issue front#443/PR #548)', () => {

    // Fórmula de referência (mesmos campos do orçamento real #260900369, Issue backend#620/#621,
    // já confirmado por contrato em 0-A ctx 35) - clonada por teste (JSON.parse/stringify,
    // AGENTS.md [R-MOCK]) para nunca compartilhar a mesma instância entre cenários.
    function budgetFormula(overrides = {}) {
      return {
        id: 260900369, code: 260900369, formula_number: 1, type: 1, status: -1,
        amount: 61.87, discount: 0, amount_with_discount: 61.87,
        selected_for_payment_link: true, covered_by_approved_link: false, financial_id: null,
        shipping_label: 'Retirada',
        quantity: 30, pharmaceutical_form: 'CAPSULAS',
        label_text: 'Passiflora Extrato 250mg - Base Efervescente P/condroitina/glucosamina Sabor Laranja',
        products: [{ line_number: 1, quantity: 250, unit: 'mg', product_name: 'Passiflora Extrato', amount: 61.87 }],
        ...overrides
      };
    }

    function budgetRevenda(overrides = {}) {
      return {
        id: 260900230, code: 260900230, formula_number: null, type: 2, status: -1,
        amount: 25, discount: 0, amount_with_discount: 25,
        selected_for_payment_link: true, covered_by_approved_link: false, financial_id: null,
        shipping_label: 'Retirada',
        products: [{ line_number: 1, quantity: 1, unit: 'un', product_name: 'Produto De Revenda Teste', amount: 25 }],
        ...overrides
      };
    }

    // Blindagem [R-BLIND]: combinação canal × tipo de orçamento não é garantida de forma
    // determinística na API real (o tenant só tem 2 canais reais, um tipo 0 e outro tipo 2 -
    // PROJECT_CONTEXT.md §8) - 100% mockado para cobrir as 3 variações + revenda sem depender de massa.
    function abrirModalComCanalEOrcamento(budgetTextType, budget) {
      AtendimentosMocks.interceptAttendanceDetailApi('*', {
        ...AtendimentosMocks.mockAttendanceDetailData,
        attendance: {
          ...AtendimentosMocks.mockAttendanceDetailData.attendance,
          channel: budgetTextType === undefined
            ? { id: 6, name: 'WHATSAPP OFICIAL - 62 98222-4382', type: 1, subtype: 1 }
            : { id: 6, name: 'WHATSAPP OFICIAL - 62 98222-4382', type: 1, subtype: 1, budget_text_type: budgetTextType, show_discount: false }
        }
      });
      AtendimentosMocks.interceptBudgetsApi('*', {
        data: [budget],
        totals: { budget_total: budget.amount, completed_total: 0, receivable_total: budget.amount_with_discount },
        pagination: { page: 1, per_page: 20, total: 1, total_pages: 1, has_next: false, has_previous: false }
      }, true);
      cy.reload();
      AtendimentosPage.elements.tituloAtendimentos().should('be.visible');
      AtendimentosPage.elements.cardsAtendimento().first().click();
      AtendimentosPage.abrirGavetaOrcamentos();
      AtendimentosPage.abrirModalEnviarOrcamento();
    }

    function cardOrcamento() {
      return cy.get('[data-testid="budget-quote-preview-card"]');
    }

    it('17.1 deve exibir só o cabeçalho sintético da fórmula, sem produtos, quando o canal usa budget_text_type 0 - Sintético', () => {
      abrirModalComCanalEOrcamento(0, budgetFormula());

      cardOrcamento().within(() => {
        cy.get('[class*="_sendBudgetQuotePreviewItemTitle_"]').should('have.text', 'Fórmula nº 1');
        cy.get('[class*="_sendBudgetQuotePreviewItemSubtitle_"]').should('have.text', '30 Capsulas');
        cy.get('[class*="_sendBudgetQuotePreviewItemLabel_"]').should('not.exist');
      });
    });

    it('17.2 deve exibir os princípios ativos digitados quando o canal usa budget_text_type 1 - Produtos Digitados', () => {
      abrirModalComCanalEOrcamento(1, budgetFormula());

      cardOrcamento().within(() => {
        cy.get('[class*="_sendBudgetQuotePreviewItemTitle_"]').should('have.text', 'Passiflora Extrato 250mg');
        cy.get('[class*="_sendBudgetQuotePreviewItemLabel_"]').should('not.exist');
      });
    });

    it('17.3 deve exibir os produtos digitados e o texto do rótulo da fórmula quando o canal usa budget_text_type 2 - Texto do Rótulo', () => {
      const budget = budgetFormula();
      abrirModalComCanalEOrcamento(2, budget);

      cardOrcamento().within(() => {
        cy.get('[class*="_sendBudgetQuotePreviewItemTitle_"]').should('have.text', 'Passiflora Extrato 250mg');
        cy.get('[class*="_sendBudgetQuotePreviewItemLabel_"]').should('have.text', budget.label_text);
      });
    });

    it('17.4 não deve exibir o texto do rótulo num orçamento de revenda (sem fórmula) mesmo com o canal em budget_text_type 2', () => {
      // Revenda não tem fórmula - label_text/quantity/pharmaceutical_form ficam ausentes no
      // contrato real (PROJECT_CONTEXT.md §8, mesmo padrão de formula_number).
      abrirModalComCanalEOrcamento(2, budgetRevenda());

      cardOrcamento().within(() => {
        cy.get('[class*="_sendBudgetQuotePreviewItemTitle_"]').should('have.text', 'Produto De Revenda Teste');
        cy.get('[class*="_sendBudgetQuotePreviewItemLabel_"]').should('not.exist');
      });
    });

    it('17.5 deve listar os produtos de um orçamento de revenda mesmo com o canal em budget_text_type 0 - Sintético (revenda não tem fórmula para resumir)', () => {
      abrirModalComCanalEOrcamento(0, budgetRevenda());

      cardOrcamento().within(() => {
        cy.get('[class*="_sendBudgetQuotePreviewItemTitle_"]').should('have.text', 'Produto De Revenda Teste');
      });
    });

    it('17.6 deve manter o comportamento atual (produtos digitados) quando o canal não traz budget_text_type (compatibilidade com backend ainda sem o campo, PR #548)', () => {
      abrirModalComCanalEOrcamento(undefined, budgetFormula());

      cardOrcamento().within(() => {
        cy.get('[class*="_sendBudgetQuotePreviewItemTitle_"]').should('have.text', 'Passiflora Extrato 250mg');
        cy.get('[class*="_sendBudgetQuotePreviewItemLabel_"]').should('not.exist');
      });
    });

  });

  // ---------------------------------------------------------------------------
  // 18. DISCRIMINAÇÃO DE DESCONTO NO ORÇAMENTO ("TEXTO DESCONTO DO ORÇAMENTO" POR CANAL)
  // ---------------------------------------------------------------------------
  context('18. Discriminação de Desconto no Orçamento na Modal "Enviar Orçamento" (Issue front#444/PR #548)', () => {

    // Fórmula de referência (mesma massa real #260900369, Issue backend#620/#621). amount/discount/
    // amount_with_discount variam por teste - sempre com decimais não-redondos (nunca .00/.50) para
    // nunca confundir o valor real exibido com um fallback/arredondamento acidental (achado do
    // diagnóstico desta sessão: valores "redondos" demais mascaram bug de teste, não de produto).
    function budgetComDesconto(overrides = {}) {
      return {
        id: 260900369, code: 260900369, formula_number: 1, type: 1, status: -1,
        amount: 61.87, discount: 7.76, amount_with_discount: 54.11,
        selected_for_payment_link: true, covered_by_approved_link: false, financial_id: null,
        shipping_label: 'Retirada',
        quantity: 30, pharmaceutical_form: 'CAPSULAS',
        label_text: 'Passiflora Extrato 250mg - Base Efervescente P/condroitina/glucosamina Sabor Laranja',
        products: [{ line_number: 1, quantity: 250, unit: 'mg', product_name: 'Passiflora Extrato', amount: 61.87 }],
        ...overrides
      };
    }

    // Blindagem [R-BLIND]: só os 2 canais reais do tenant (PROJECT_CONTEXT.md §8) têm show_discount
    // hoje, e é configuração viva (tela [628] do Desktop, já mudou sozinha entre medições do mesmo
    // dia - ver ROADMAP.md §2 P0) - sem reprodução determinística real, 100% mockado.
    function abrirModalComDesconto(showDiscount, budget) {
      AtendimentosMocks.interceptAttendanceDetailApi('*', {
        ...AtendimentosMocks.mockAttendanceDetailData,
        attendance: {
          ...AtendimentosMocks.mockAttendanceDetailData.attendance,
          channel: showDiscount === undefined
            ? { id: 6, name: 'WHATSAPP OFICIAL - 62 98222-4382', type: 1, subtype: 1 }
            : { id: 6, name: 'WHATSAPP OFICIAL - 62 98222-4382', type: 1, subtype: 1, budget_text_type: 2, show_discount: showDiscount }
        }
      });
      AtendimentosMocks.interceptBudgetsApi('*', {
        data: [budget],
        totals: { budget_total: budget.amount, completed_total: 0, receivable_total: budget.amount_with_discount },
        pagination: { page: 1, per_page: 20, total: 1, total_pages: 1, has_next: false, has_previous: false }
      }, true);
      cy.reload();
      AtendimentosPage.elements.tituloAtendimentos().should('be.visible');
      AtendimentosPage.elements.cardsAtendimento().first().click();
      AtendimentosPage.abrirGavetaOrcamentos();
      AtendimentosPage.abrirModalEnviarOrcamento();
    }

    function cardOrcamento() {
      return cy.get('[data-testid="budget-quote-preview-card"]');
    }

    it('18.1 não deve exibir subtotal nem desconto quando o canal está em "Não mostrar desconto" - só o valor líquido final (AC1)', () => {
      const budget = budgetComDesconto();
      abrirModalComDesconto(false, budget);

      cardOrcamento().within(() => {
        // Fórmula mostra o valor líquido (amount_with_discount), não o bruto
        cy.get('[class*="_sendBudgetQuotePreviewItemAmount_"]').should('contain.text', '54,11').and('not.contain.text', '61,87');
        cy.get('[class*="_sendBudgetQuotePreviewTotalsRow_"]').should('not.exist');
        cy.get('[class*="_sendBudgetQuotePreviewTotalsDiscount_"]').should('not.exist');
        cy.get('[class*="_sendBudgetQuotePreviewTotalsGrand_"]').should('contain.text', 'Valor total').and('contain.text', '54,11');
      });
    });

    it('18.2 deve exibir o comparativo bruto/desconto/líquido quando o canal está em "Mostrar desconto" e há desconto real (AC2)', () => {
      const budget = budgetComDesconto();
      abrirModalComDesconto(true, budget);

      cardOrcamento().within(() => {
        // Fórmula mostra o valor bruto (amount), não o líquido
        cy.get('[class*="_sendBudgetQuotePreviewItemAmount_"]').should('contain.text', '61,87').and('not.contain.text', '54,11');
        cy.get('[class*="_sendBudgetQuotePreviewTotalsRow_"]').should('contain.text', 'Subtotal bruto').and('contain.text', '61,87');
        cy.get('[class*="_sendBudgetQuotePreviewTotalsDiscount_"]').should('contain.text', 'Total de descontos').and('contain.text', '7,76');
        cy.get('[class*="_sendBudgetQuotePreviewTotalsGrand_"]').should('contain.text', 'Valor total').and('contain.text', '54,11');
      });
    });

    it('18.3 não deve exibir a linha de desconto quando o canal está em "Mostrar desconto" mas o orçamento não tem desconto real', () => {
      const budget = budgetComDesconto({ discount: 0, amount_with_discount: 61.87 });
      abrirModalComDesconto(true, budget);

      cardOrcamento().within(() => {
        cy.get('[class*="_sendBudgetQuotePreviewTotalsDiscount_"]').should('not.exist');
        cy.get('[class*="_sendBudgetQuotePreviewTotalsRow_"]').should('contain.text', 'Subtotal bruto').and('contain.text', '61,87');
        cy.get('[class*="_sendBudgetQuotePreviewTotalsGrand_"]').should('contain.text', 'Valor total').and('contain.text', '61,87');
      });
    });

    it('18.4 deve se comportar como "Não mostrar desconto" quando o canal não traz show_discount (compatibilidade com backend ainda sem o campo, coluna nula cai em false)', () => {
      const budget = budgetComDesconto();
      abrirModalComDesconto(undefined, budget);

      cardOrcamento().within(() => {
        cy.get('[class*="_sendBudgetQuotePreviewItemAmount_"]').should('contain.text', '54,11');
        cy.get('[class*="_sendBudgetQuotePreviewTotalsRow_"]').should('not.exist');
        cy.get('[class*="_sendBudgetQuotePreviewTotalsDiscount_"]').should('not.exist');
        cy.get('[class*="_sendBudgetQuotePreviewTotalsGrand_"]').should('contain.text', '54,11');
      });
    });

  });

  // ---------------------------------------------------------------------------
  // 19. CONTRASTE NO TEMA ESCURO DA MODAL "ENVIAR ORÇAMENTO"
  // ---------------------------------------------------------------------------
  context('19. Contraste no Tema Escuro da Modal "Enviar Orçamento" (Issue front#552/PR #553)', () => {

    // Fórmula de luminância relativa e razão de contraste da WCAG 2.1
    // (https://www.w3.org/TR/WCAG21/#dfn-relative-luminance / #dfn-contrast-ratio) - não há
    // utilitário de contraste pronto neste repo, então a fórmula fica local a este context.
    function luminanciaRelativa([r, g, b]) {
      const canal = [r, g, b].map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * canal[0] + 0.7152 * canal[1] + 0.0722 * canal[2];
    }

    function razaoContraste(rgb1, rgb2) {
      const l1 = luminanciaRelativa(rgb1);
      const l2 = luminanciaRelativa(rgb2);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }

    // Converte "rgb(r, g, b)"/"rgba(r, g, b, a)" (formato devolvido por getComputedStyle) em [r,g,b,a]
    function parseCor(corCss) {
      const n = corCss.match(/[\d.]+/g).map(Number);
      return [n[0], n[1], n[2], n.length > 3 ? n[3] : 1];
    }

    function compor([r, g, b, a], fundoRgb) {
      return [r, g, b].map((canal, i) => canal * a + fundoRgb[i] * (1 - a));
    }

    // Resolve a cor de fundo EFETIVA de um elemento subindo a árvore do DOM e compondo
    // alpha-blending de cada camada semitransparente (ex.: `_sendBudgetQuoteSelectionItem_` usa
    // fundo com alpha, não cor sólida) até achar uma camada opaca - achado desta sessão: o
    // `getComputedStyle` sozinho devolve a cor DECLARADA de cada camada, nunca o resultado já
    // composto que o olho humano vê, então contraste exige compor manualmente (Issue front#552).
    function corDeFundoEfetiva(elemento) {
      const win = elemento.ownerDocument.defaultView;
      const camadas = [];
      let atual = elemento;
      while (atual) {
        const [r, g, b, a] = parseCor(win.getComputedStyle(atual).backgroundColor);
        if (a > 0) camadas.push([r, g, b, a]);
        if (a >= 1) break;
        atual = atual.parentElement;
      }
      let resultado = [255, 255, 255]; // base final: fundo branco da página, se nada mais for opaco
      for (let i = camadas.length - 1; i >= 0; i--) {
        resultado = compor(camadas[i], resultado);
      }
      return resultado;
    }

    function budgetContraste(overrides = {}) {
      return {
        id: 260900369, code: 260900369, formula_number: 1, type: 1, status: -1,
        amount: 61.87, discount: 0, amount_with_discount: 61.87,
        selected_for_payment_link: true, covered_by_approved_link: false, financial_id: null,
        shipping_label: 'Retirada', quantity: 30, pharmaceutical_form: 'CAPSULAS',
        label_text: 'Passiflora Extrato 250mg',
        products: [{ line_number: 1, quantity: 250, unit: 'mg', product_name: 'Passiflora Extrato', amount: 61.87 }],
        ...overrides
      };
    }

    // Blindagem [R-BLIND]: cor/contraste de CSS não é garantida de forma determinística contra
    // dado real (depende só do deploy do front, não de massa) - 100% mockado, igual aos contexts
    // 17/18 da mesma modal.
    function abrirModalEnviarOrcamentoComTema(tema) {
      AtendimentosMocks.interceptAttendanceDetailApi('*', {
        ...AtendimentosMocks.mockAttendanceDetailData,
        summaries: {
          quotes: { count: 1, total_amount: 61.87 },
          payment_links: { count: 0, pending_confirmation_count: 0 }
        }
      });
      AtendimentosMocks.interceptBudgetsApi('*', {
        data: [budgetContraste()],
        totals: { budget_total: 61.87, completed_total: 0, receivable_total: 61.87 },
        pagination: { page: 1, per_page: 20, total: 1, total_pages: 1, has_next: false, has_previous: false }
      }, true);
      cy.reload();
      AtendimentosPage.elements.tituloAtendimentos().should('be.visible');

      // O tema padrão da aplicação logo após o reload é sempre "claro" (confirmado por evidência,
      // AGENTS.md [R-TOOLS]/[R-EVID]) - só alterna quando o teste pede "dark". O botão de alternar
      // tema fica coberto pelo overlay full-screen da própria modal depois de aberta (achado desta
      // sessão: `cy.click()` nele recusa com "being covered by" `_sendBudgetQuoteOverlay_`) - por
      // isso o tema é sempre decidido ANTES de abrir a modal, nunca com ela já aberta.
      if (tema === 'dark') {
        AtendimentosPage.elements.botaoAlternarTema().click();
      }

      AtendimentosPage.elements.cardsAtendimento().first().click();
      AtendimentosPage.abrirGavetaOrcamentos();
      AtendimentosPage.abrirModalEnviarOrcamento();
      cy.get('[class*="_sendBudgetQuoteOverlay_"]').should('have.attr', 'data-theme', tema);
    }

    function cardSelecaoOrcamento() {
      return cy.get('[data-testid="orcamento-item-260900369"]');
    }

    // Valida as 4 superfícies citadas no critério de aceite da issue (card, código, valor, badge
    // REC) mais a borda da checkbox de seleção, no tema informado.
    function validarContrasteDoCard(tema, luminanciaMinimaEsperada) {
      cardSelecaoOrcamento().then(($item) => {
        const win = $item[0].ownerDocument.defaultView;
        const fundoCard = corDeFundoEfetiva($item[0]);

        if (luminanciaMinimaEsperada === 'escura') {
          expect(luminanciaRelativa(fundoCard), `fundo do card deve ser escuro no tema ${tema}, não branco sólido (bug original)`).to.be.lessThan(0.2);
        } else {
          expect(luminanciaRelativa(fundoCard), `fundo do card deve seguir claro no tema ${tema} (sem regressão)`).to.be.greaterThan(0.7);
        }

        const corCodigo = parseCor(win.getComputedStyle($item[0].querySelector('[class*="_sendBudgetQuoteSelectionCode_"]')).color);
        const corValor = parseCor(win.getComputedStyle($item[0].querySelector('[class*="_sendBudgetQuoteSelectionAmount_"]')).color);
        const elementoBadge = $item[0].querySelector('[class*="_sendBudgetQuoteTypeBadge_"]');
        const corBadge = parseCor(win.getComputedStyle(elementoBadge).color);
        const fundoBadge = corDeFundoEfetiva(elementoBadge);
        const elementoCheckbox = $item[0].querySelector('[class*="_sendBudgetQuoteSelectionCheckbox_"]');
        const corBorda = parseCor(win.getComputedStyle(elementoCheckbox).borderColor);

        expect(razaoContraste(corCodigo, fundoCard), `contraste do código da receita/orçamento no tema ${tema} (WCAG AA, mínimo 4.5:1)`).to.be.at.least(4.5);
        expect(razaoContraste(corValor, fundoCard), `contraste do valor em reais no tema ${tema} (WCAG AA, mínimo 4.5:1)`).to.be.at.least(4.5);
        expect(razaoContraste(corBadge, fundoBadge), `contraste do badge REC no tema ${tema} (WCAG AA, mínimo 4.5:1)`).to.be.at.least(4.5);
        // Borda de componente de UI (não-texto) - WCAG 2.1 SC 1.4.11, mínimo 3:1, não 4.5:1.
        expect(razaoContraste(corBorda, fundoCard), `contraste da borda da checkbox de seleção no tema ${tema} (WCAG 1.4.11, mínimo 3:1)`).to.be.at.least(3);
      });
    }

    it('19.1 deve exibir fundo escuro nos cards de seleção da modal "Enviar Orçamento" e manter contraste ≥ 4.5:1 (WCAG AA) no código, valor e badge REC no tema escuro', () => {
      abrirModalEnviarOrcamentoComTema('dark');
      validarContrasteDoCard('dark', 'escura');
    });

    it('19.2 deve manter fundo claro e o mesmo contraste ≥ 4.5:1 (WCAG AA) no tema claro, sem regressão de layout ou cores', () => {
      abrirModalEnviarOrcamentoComTema('light');
      validarContrasteDoCard('light', 'clara');
    });

  });

  // -------------------------------------------------------------
  // 20. ESTADO DO COMPOSITOR ENQUANTO A LISTAGEM DE MENSAGENS CARREGA (Issue backend#572)
  // -------------------------------------------------------------

  context('20. Estado do Compositor Enquanto a Listagem de Mensagens Carrega (Issue backend#572 / front#562)', () => {

    let originalUseMocksState;
    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
    });
    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    // Textos reais do compositor (chaves i18n composer.loadingConversation / composer.placeholder): a
    // reticência é o caractere "…" (U+2026) e o placeholder padrão carrega o atalho completo (Issue front#562/PR #563).
    const PH_CARREGANDO = 'Carregando a conversa…';
    const PH_PADRAO = 'Digite uma mensagem… (Enter para enviar, Shift+Enter para nova linha)';

    // Janela 24h ativa e texto livre, para o único bloqueio possível ser a carga
    function prepararConversaLiberavel() {
      AtendimentosMocks.interceptAttendanceDetailApi('*', {
        ...AtendimentosMocks.mockAttendanceDetailData,
        attendance: {
          ...AtendimentosMocks.mockAttendanceDetailData.attendance,
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
      AtendimentosMocks.interceptStandardMessagesApi();
      AtendimentosMocks.interceptStandardMessageCapabilitiesApi();
    }

    // Sentinela do sintoma da issue: campo travado com o placeholder padrão e sem aviso de carregamento.
    // Roda a cada 30 ms dentro do app e acumula violações para o assert final (um .should() não prova "nunca").
    function instalarSentinelaCampoTravadoSemAviso() {
      cy.window().then((win) => {
        win.__violacoesCompositor = [];
        win.clearInterval(win.__sentinelaCompositor);
        win.__sentinelaCompositor = win.setInterval(() => {
          const ta = win.document.querySelector('textarea[data-testid="input-message"]');
          if (ta && ta.disabled && ta.getAttribute('placeholder') === PH_PADRAO) {
            win.__violacoesCompositor.push(Date.now());
          }
        }, 30);
      });
    }
    function violacoesDoCompositor() {
      return cy.window().then((win) => win.__violacoesCompositor || []);
    }

    it('20.1 deve mostrar o carregamento da conversa (skeleton, faixa "Carregando a conversa…" e placeholder do campo) com o compositor bloqueado enquanto GET .../messages demora, e liberá-lo sozinho voltando ao placeholder padrão quando a resposta chega', () => {
      // Arrange
      prepararConversaLiberavel();
      // Resposta lenta (faixa de 5-21 s medida na backend#572 antes do fix) controlada pelo mock, sem depender de espera fixa
      const mensagens = AtendimentosMocks.mockMessagesAtivas;
      cy.intercept('GET', rotaApi('attendances/*/messages*'), (req) => {
        req.reply({ statusCode: 200, body: mensagens, delay: 6000 });
      }).as('getAttendanceMessages');

      // Act: abre a conversa
      AtendimentosPage.elements.cardsAtendimento().first().click();

      // Assert 1: feedback visual de carregamento, campo bloqueado e placeholder explicando o motivo
      AtendimentosPage.elements.statusCarregandoConversa().should('be.visible');
      cy.get('[class*="_skeletonBubble_"]').should('have.length.at.least', 1);
      AtendimentosPage.elements.inputMensagemChat().should('be.disabled').and('have.attr', 'placeholder', PH_CARREGANDO);
      AtendimentosPage.elements.btnAudio().should('be.disabled');
      cy.get('[data-testid="input-attachment-file"]').should('be.disabled');
      // O aviso é anunciado uma única vez, pela faixa role="status" (o placeholder não repete o anúncio)
      cy.get('[role="status"]').filter(':contains("Carregando a conversa")').should('have.length', 1);
      AtendimentosPage.elements.inputMensagemChat().should('not.have.attr', 'aria-live');
      // Não é bloqueio de janela/permissão: o aviso de janela encerrada não existe
      cy.get('[data-testid="composer-service-window-notice"]').should('not.exist');

      // Assert 2: a resposta chega e o compositor libera sozinho, sem ação do usuário, e o placeholder volta ao padrão
      cy.wait('@getAttendanceMessages', { timeout: 20000 });
      AtendimentosPage.elements.statusCarregandoConversa().should('not.exist');
      cy.get('[class*="_skeletonBubble_"]').should('not.exist');
      AtendimentosPage.elements.inputMensagemChat().should('not.be.disabled').and('have.attr', 'placeholder', PH_PADRAO);
      AtendimentosPage.elements.btnAudio().should('not.be.disabled');
    });

    it('20.2 deve voltar ao carregamento a cada atendimento novo e liberar o último ao alternar rapidamente entre vários da fila, sem ficar preso em "Carregando a conversa…" nem travar com o placeholder padrão (Issue front#562/PR #563)', () => {
      // Arrange: respostas com atraso curto para sobrepor as trocas
      prepararConversaLiberavel();
      const mensagens = AtendimentosMocks.mockMessagesAtivas;
      cy.intercept('GET', rotaApi('attendances/*/messages*'), (req) => {
        req.reply({ statusCode: 200, body: mensagens, delay: 2500 });
      }).as('getAttendanceMessages');
      instalarSentinelaCampoTravadoSemAviso();
      AtendimentosPage.elements.cardsAtendimento().should('have.length.at.least', 2);

      // Act: clica em sequência nos cards (até 4) sem esperar a carga
      AtendimentosPage.elements.cardsAtendimento().then(($cards) => {
        const total = Math.min($cards.length, 4);
        for (let i = 0; i < total; i += 1) {
          AtendimentosPage.elements.cardsAtendimento().eq(i).click();
        }
      });

      // Assert 1: logo após a troca o atendimento corrente está em carregamento, explicado pelo placeholder
      AtendimentosPage.elements.inputMensagemChat().should('have.attr', 'placeholder', PH_CARREGANDO);
      AtendimentosPage.elements.statusCarregandoConversa().should('be.visible');

      // Assert 2: o último libera sozinho e nada fica preso
      cy.get('[role="status"]', { timeout: 30000 }).filter(':contains("Carregando a conversa")').should('not.exist');
      AtendimentosPage.elements.inputMensagemChat().should('not.be.disabled').and('have.attr', 'placeholder', PH_PADRAO);
      cy.get('textarea[data-testid="input-message"]').should('have.length', 1);

      // Assert 3: nenhum instante de campo travado sem aviso durante as trocas
      violacoesDoCompositor().should('have.length', 0);
    });

    it('20.3 deve reabrir direto com o placeholder padrão, sem faixa de carregamento, um atendimento já visitado na sessão (cache de 5 minutos), sem piscar o carregamento (Issue front#562/PR #563)', () => {
      // Arrange
      prepararConversaLiberavel();
      const mensagens = AtendimentosMocks.mockMessagesAtivas;
      cy.intercept('GET', rotaApi('attendances/*/messages*'), (req) => {
        req.reply({ statusCode: 200, body: mensagens, delay: 1500 });
      }).as('getAttendanceMessages');
      AtendimentosPage.elements.cardsAtendimento().should('have.length.at.least', 2);

      // Act 1: 1ª visita ao atendimento A, com carregamento visível, até liberar
      AtendimentosPage.elements.cardsAtendimento().eq(0).click();
      AtendimentosPage.elements.statusCarregandoConversa().should('be.visible');
      cy.wait('@getAttendanceMessages', { timeout: 20000 });
      AtendimentosPage.elements.statusCarregandoConversa().should('not.exist');
      AtendimentosPage.elements.inputMensagemChat().should('not.be.disabled').and('have.attr', 'placeholder', PH_PADRAO);

      // Act 2: vai para o atendimento B e volta para o A
      AtendimentosPage.elements.cardsAtendimento().eq(1).click();
      cy.wait('@getAttendanceMessages', { timeout: 20000 });
      AtendimentosPage.elements.cardsAtendimento().eq(0).click();

      // Assert: A reabre do cache, sem faixa de carregamento e com o placeholder padrão
      AtendimentosPage.elements.statusCarregandoConversa().should('not.exist');
      AtendimentosPage.elements.inputMensagemChat().should('have.attr', 'placeholder', PH_PADRAO);
    });

  });

  // ---------------------------------------------------------------------------
  // 21. MARCAR TODOS / DESMARCAR TODOS NA MODAL "ENVIAR ORÇAMENTO"
  // ---------------------------------------------------------------------------
  context('21. Marcar Todos / Desmarcar Todos na Modal "Enviar Orçamento" (Issue front#559)', () => {

    // Blindagem [R-BLIND]: 3 orçamentos sintéticos com valores não-redondos e sem desconto, para o
    // total esperado ser a soma exata; a combinação não é garantida de forma determinística na API real.
    let originalUseMocksState;
    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
    });
    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    function budgetSimples(code, amount) {
      return {
        id: code, code, formula_number: 1, type: 1, status: -1,
        amount, discount: 0, amount_with_discount: amount,
        selected_for_payment_link: true, covered_by_approved_link: false, financial_id: null,
        shipping_label: 'Retirada',
        quantity: 30, pharmaceutical_form: 'CAPSULAS', label_text: `Fórmula sintética ${code}`,
        products: [{ line_number: 1, quantity: 250, unit: 'mg', product_name: `Produto ${code}`, amount }]
      };
    }

    const BUDGETS = [budgetSimples(260900901, 61.87), budgetSimples(260900902, 40.13), budgetSimples(260900903, 25.55)];
    const TOTAL_TODOS = '127,55';

    function abrirModalComTresOrcamentos() {
      AtendimentosMocks.interceptBudgetsApi('*', {
        data: BUDGETS,
        totals: { budget_total: 127.55, completed_total: 0, receivable_total: 127.55 },
        pagination: { page: 1, per_page: 20, total: 3, total_pages: 1, has_next: false, has_previous: false }
      }, true);
      cy.reload();
      AtendimentosPage.elements.tituloAtendimentos().should('be.visible');
      AtendimentosPage.elements.cardsAtendimento().first().click();
      AtendimentosPage.abrirGavetaOrcamentos();
      AtendimentosPage.abrirModalEnviarOrcamento();
    }

    const toggleTodos = () => cy.get('[data-testid="button-toggle-select-all-budgets"]');
    const checkboxes = () => cy.get('[data-testid="budget-item-checkbox"]');
    const totalGeral = () => cy.get('[data-testid="budget-quote-preview-card"] [class*="_sendBudgetQuotePreviewTotalsGrand_"]');

    it('21.1 deve abrir com todos marcados exibindo "Desmarcar todos" e, ao clicar, limpar a seleção, trocar para "Marcar todos" e zerar o total e os botões de ação (AC3/AC4/AC5)', () => {
      abrirModalComTresOrcamentos();

      toggleTodos().should('have.text', 'Desmarcar todos');
      checkboxes().should('have.length', 3).each(($c) => expect($c).to.be.checked);
      totalGeral().should('contain.text', TOTAL_TODOS);
      AtendimentosPage.elements.btnBaixarOrcamentoModal().should('not.be.disabled');
      AtendimentosPage.elements.btnEnviarParaOChatModal().should('not.be.disabled');

      toggleTodos().click();

      toggleTodos().should('have.text', 'Marcar todos');
      checkboxes().each(($c) => expect($c).not.to.be.checked);
      totalGeral().should('not.contain.text', TOTAL_TODOS).and('contain.text', '0,00');
      AtendimentosPage.elements.btnBaixarOrcamentoModal().should('be.disabled');
      AtendimentosPage.elements.btnEnviarParaOChatModal().should('be.disabled');
    });

    it('21.2 deve marcar todos e recalcular o total da pré-visualização ao clicar em "Marcar todos" depois de desmarcar tudo (AC1/AC2)', () => {
      abrirModalComTresOrcamentos();
      toggleTodos().click();
      toggleTodos().should('have.text', 'Marcar todos');

      toggleTodos().click();

      toggleTodos().should('have.text', 'Desmarcar todos');
      checkboxes().should('have.length', 3).each(($c) => expect($c).to.be.checked);
      totalGeral().should('contain.text', TOTAL_TODOS);
      AtendimentosPage.elements.btnBaixarOrcamentoModal().should('not.be.disabled');
      AtendimentosPage.elements.btnEnviarParaOChatModal().should('not.be.disabled');
    });

    it('21.3 deve manter "Desmarcar todos" com seleção parcial e, ao clicar, limpar tudo (AC3)', () => {
      abrirModalComTresOrcamentos();
      checkboxes().first().uncheck({ force: true });

      toggleTodos().should('have.text', 'Desmarcar todos');
      totalGeral().should('not.contain.text', TOTAL_TODOS);

      toggleTodos().click();

      toggleTodos().should('have.text', 'Marcar todos');
      checkboxes().each(($c) => expect($c).not.to.be.checked);
      totalGeral().should('contain.text', '0,00');
    });

    it('21.4 deve voltar para "Desmarcar todos" ao marcar um único item manualmente depois de desmarcar tudo', () => {
      abrirModalComTresOrcamentos();
      toggleTodos().click();
      toggleTodos().should('have.text', 'Marcar todos');

      checkboxes().first().check({ force: true });

      toggleTodos().should('have.text', 'Desmarcar todos');
      totalGeral().should('contain.text', '61,87').and('not.contain.text', TOTAL_TODOS);
    });

    it('21.5 deve ser um botão nativo habilitado e alcançável pelo teclado (acionável por Enter e Espaço pelo navegador) e manter o foco após alternar', () => {
      abrirModalComTresOrcamentos();

      // Enter/Espaço em <button> nativo é comportamento do navegador: cy.type simulado não o aciona e a tecla real
      // via CDP não existe fora do Chromium (Firefox no cypress open: "No handler registered for remote:debugger:protocol").
      // Prova estrutural independente de navegador: elemento nativo, habilitado, fora de tabindex negativo e focável.
      toggleTodos().should(($b) => {
        expect($b[0].tagName).to.eq('BUTTON');
        expect($b[0].type).to.eq('button');
        expect($b[0].disabled).to.eq(false);
        expect($b.attr('tabindex')).not.to.eq('-1');
      });
      toggleTodos().focus().should('have.focus');

      toggleTodos().click();

      toggleTodos().should('have.text', 'Marcar todos').and('have.focus');
    });

  });

});
