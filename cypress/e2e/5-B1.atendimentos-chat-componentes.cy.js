import AtendimentosPage from '../pages/5.atendimentosPage';
import AtendimentosMocks from '../mocks/5.atendimentosMocks';
import IniciarAtendimentoMocks from '../mocks/4.iniciarAtendimentoMocks';
const configEnv = require('../../env.json');

// Captura os dados configurados em env.json
const CELULAR_PADRAO = Cypress.env('DEFAULT_CELULAR') || Cypress.env('defaultCelular') || configEnv.DEFAULT_CELULAR || '11999998888';


describe('5-B1. Atendimentos - Chat: Componentes, Anexos e Colagem', () => {


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
  // 1. VALIDAÇÕES DOS COMPONENTES DO CHAT
  // -------------------------------------------------------------

  context('1. Validações dos Componentes do Chat', () => {

    beforeEach(() => {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';

      if (isMock) {
        // Modo Mock: Configura o atendimento com a Janela 24h ativa e o compositor liberado
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
          },
          summaries: {
            quotes: { count: 1, total_amount: 167.79 },
            payment_links: { count: 0, pending_confirmation_count: 0 }
          }
        });
        AtendimentosMocks.interceptMessagesListApi('*', AtendimentosMocks.mockMessagesAtivas);
        AtendimentosMocks.interceptBudgetsApi('*');
        AtendimentosMocks.interceptStandardMessagesApi();
        AtendimentosMocks.interceptStandardMessageCapabilitiesApi();
        AtendimentosMocks.interceptObservationsApi('*');
        AtendimentosPage.elements.cardsAtendimento().first().click();
      } else {
        // Modo Real: Limpa os mocks para liberar a rede real
        AtendimentosMocks.clearMocksForRealE2ETests();
        AtendimentosPage.garantirAtendimentoAberto(CELULAR_PADRAO, 'oficial', false);
      }
    });

    it('1.1 deve enviar mensagem de texto simples no compositor via clique no botão e via tecla Enter', () => {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';

      // Pré-condição mandatória para digitação livre de texto: Janela de 24h ativa
      AtendimentosPage.validarJanelaAtiva(isMock ? 5000 : 90000);

      // Arrange: Registra o intercept (no modo real apenas monitora via req.continue)
      AtendimentosMocks.interceptSendMessageApi('*');

      // Act 1: Digita e envia via clique no botão com ícone de avião
      AtendimentosPage.enviarMensagemNoChat('Primeira mensagem de teste do compositor');
      cy.wait('@sendChatMessage').its('response.statusCode').should('be.oneOf', [200, 201]);

      // Act 2: Digita e envia pressionando {enter}
      AtendimentosPage.elements.inputMensagemChat().type('Segunda mensagem enviada via Enter{enter}');
      cy.wait('@sendChatMessage').its('response.statusCode').should('be.oneOf', [200, 201]);

      // Assert
      AtendimentosPage.elements.inputMensagemChat().should('have.value', '');
    });

    it('1.2 deve exibir o ícone "Aguardando envio" imediatamente após o envio, sem nascer como "Entregue" (PR #418)', () => {
      // Contrato do backend (POST /messages -> 201): a mensagem é sempre inserida com message_status "ready".
      // Antes da PR #418, o builder do front ignorava esse contrato e montava a bolha otimista já como "sent",
      // fazendo o ícone nascer em "Entregue" e retroceder para "Aguardando envio" no primeiro GET subsequente.
      AtendimentosMocks.interceptSendMessageApi('*', { id: 998866, created_at: new Date().toISOString(), message_status: 'ready' });

      AtendimentosPage.enviarMensagemNoChat('Mensagem de verificação do status de envio');
      cy.wait('@sendChatMessage');

      cy.contains('div[class*="_bubbleEmployee_"]', 'Mensagem de verificação do status de envio')
        .find('span[aria-label]').should('have.attr', 'aria-label', 'Aguardando envio');
    });

    it('1.3 deve revalidar automaticamente o ícone de "Aguardando envio" para "Entregue" sem depender da chegada de uma nova mensagem (PR #418)', () => {
      const mensagemPendente = {
        id: 998877, created_at: new Date().toISOString(), origin: 'employee', employee_code: '122',
        transfer_type: 0, content_type: 'text', message_status: 'ready',
        content: 'Mensagem aguardando confirmação do backend', attachment: null
      };
      const paginacao = { page: 1, per_page: 20, total: 1, total_pages: 1, has_next: false, has_previous: false };
      const listaPendente = { data: [mensagemPendente], pagination: paginacao };
      const listaConfirmada = { data: [{ ...mensagemPendente, message_status: 'sent' }], pagination: paginacao };

      // A 1ª chamada devolve o status ainda pendente (ready); as chamadas seguintes já vêm confirmadas (sent),
      // simulando o backend carimbando o envio poucos segundos depois do POST (PR #418). O teste não dispara
      // nenhuma nova mensagem, reload adicional ou ação de UI após o reload inicial — a revalidação deve ser
      // inteiramente automática.
      AtendimentosMocks.interceptMessagesListApiSequencial('*', [listaPendente, listaConfirmada, listaConfirmada, listaConfirmada]);

      cy.reload();
      cy.wait('@getAttendanceMessages');

      cy.contains('div[class*="_bubbleEmployee_"]', 'Mensagem aguardando confirmação do backend', { timeout: 20000 })
        .find('span[aria-label]', { timeout: 20000 }).should('have.attr', 'aria-label', 'Entregue');
    });

    it('1.4 deve preservar a mensagem do cliente recebida durante o upload quando o envio de um anexo falha, removendo só a bolha que falhou (front#486, PR #480)', () => {
      // Blindagem 100% mockada (AGENTS.md §3.2 [R-BLIND]): a falha determinística do envio de
      // mídia e o timing exato de "mensagem chegou antes da falha" não são reproduzíveis de forma
      // confiável contra a API real.
      const originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);

      // Arrange: mensagem do cliente já presente no cache antes da tentativa de envio — representa
      // o que "chegou durante o upload" (AGENTS.md §4.1: reconsultar a lista ao vivo não dispara os
      // efeitos de chegada; uma mensagem já carregada no cache expõe a mesma regressão original: antes
      // da PR #480, a falha do envio revertia o cache inteiro pro estado anterior ao envio, apagando
      // junto tudo que tinha chegado nesse meio-tempo — não só a bolha otimista do anexo que falhou).
      const mensagemConcorrente = {
        id: 555001, created_at: new Date().toISOString(), origin: 'customer', employee_code: null,
        transfer_type: 0, content_type: 'text', message_status: 'ready',
        content: 'Cheguei durante o upload', attachment: null
      };
      const paginacao = { page: 1, per_page: 20, total: 1, total_pages: 1, has_next: false, has_previous: false };
      AtendimentosMocks.interceptMessagesListApi('*', { data: [mensagemConcorrente], pagination: paginacao });
      AtendimentosMocks.interceptSendMediaMessageApi('*', 500, { message: 'Erro no upload de mídia' });

      cy.reload();
      cy.wait('@getAttendanceMessages');
      cy.contains('Cheguei durante o upload').should('be.visible');

      // Arrange: fotografa quantas bolhas do atendente existem antes da tentativa que vai falhar
      AtendimentosPage.contarBaloesEnviados().then((baloesAntes) => {
        // Act: anexa (prévia monta, sem recusa local) e dispara o envio, que o servidor vai recusar
        AtendimentosPage.anexarArquivoEDispararEnvio('cypress/fixtures/5.atendimentos/anexos/normal/Anexo de teste jpg.jpg');
        cy.wait('@sendChatMediaMessage', { timeout: 60000 }).its('response.statusCode').should('eq', 500);

        // Assert 1: aviso de erro aparece no compositor. Elemento real confirmado via
        // last-failure-dom.html: <p class="_composerError_..." role="alert">Não foi possível
        // enviar a mensagem. Tente novamente.</p> — sem data-testid próprio, por isso o seletor
        // por role (não por classe: sem prefixo estável) e a asserção de texto para não casar com
        // qualquer outro elemento role="alert" da tela.
        cy.get('[role="alert"]:visible', { timeout: 20000 })
          .should('be.visible')
          .and('contain.text', 'Não foi possível enviar a mensagem');

        // Assert 2: nenhuma bolha nova do atendente é criada na conversa — o anexo que falhou fica
        // só como prévia pendente no compositor (com "Remover anexo"), nunca vira bolha no chat
        AtendimentosPage.elements.baloesEnviados().should('have.length', baloesAntes);

        // Assert 3 (o cerne da regressão, front#486/PR #480): a mensagem do cliente que chegou antes
        // da falha continua na tela — antes da correção, ela sumia junto com a bolha do envio falho
        cy.contains('Cheguei durante o upload').should('be.visible');
      });

      cy.then(() => Cypress.env('USE_MOCKS', originalUseMocksState));
    });

    it('1.5 deve cancelar um envio de anexo em andamento pelo botão "Cancelar envio", mantendo o anexo no compositor sem mensagem de erro (front#489, PR #483)', () => {
      // Blindagem 100% mockada (AGENTS.md §3.2 [R-BLIND]): o atraso artificial que mantém o
      // upload "em andamento" tempo suficiente pra clicar em cancelar não é reproduzível de
      // forma determinística contra a API real.
      const originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);

      // Arrange: resposta de sucesso, mas atrasada — mantém "Enviando mensagem..." visível tempo
      // suficiente pra interagir com o botão "Cancelar envio" antes do upload terminar
      AtendimentosMocks.interceptSendMediaMessageApi('*', 201, null, 5000);

      // Act: anexa e dispara o envio
      AtendimentosPage.anexarArquivoEDispararEnvio('cypress/fixtures/5.atendimentos/anexos/normal/Anexo de teste jpg.jpg');
      AtendimentosPage.elements.indicadorUploadMensagem().should('be.visible');

      // Regressão (Issue front#534/PR #535): o fix do botão "Assumir atendimento" só deveria
      // liberar o clique no caso `attendantBlocked` (faixa sem atendente); durante um envio em
      // andamento o compositor continua travado. Leitura síncrona (sem `.should()` com retry) —
      // a janela real dura só os 5s do atraso mockado do envio. Achado no caminho: o estado de
      // envio usa uma classe própria (`_composerSendingLocked_`), distinta de `_composerDisabled_`
      // (reservada ao caso `disabled` genérico/sem atendente) — confirmado via DOM real de falha,
      // não suposto.
      cy.get('footer[class*="_composer_"]').invoke('attr', 'class').then((classes) => {
        expect(classes, 'footer do compositor deve ficar bloqueado durante o upload').to.match(/_composerSendingLocked_/);
      });

      // Act: cancela o envio em andamento
      cy.get('[data-testid="button-cancel-media-send"]').should('be.visible').click();

      // Assert 1: o indicador de envio some e nenhuma mensagem de erro aparece (comportamento
      // diferente de uma falha real — cancelamento não é erro)
      AtendimentosPage.elements.indicadorUploadMensagem().should('not.exist');
      cy.get('[role="alert"]:visible').should('not.exist');

      // Assert 2: o anexo continua no compositor, pronto pra reenviar ou remover pelo "X"
      cy.get('[data-testid="composer-media-preview"]').should('be.visible');
      cy.get('[data-testid="btn-remove-attachment"]').should('be.visible');

      cy.then(() => Cypress.env('USE_MOCKS', originalUseMocksState));
    });

    it('1.6 deve abrir gaveta de orçamentos, testar botão Baixar e enviar orçamento para o chat validando sua renderização', () => {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';

      // Registra o alias de envio de mídia em ambos os modos (em API Real, apenas encaminha a requisição via req.continue())
      AtendimentosMocks.interceptSendMediaMessageApi('*');

      if (isMock) {
        // Arrange (Modo Mock): Intercepta listagem de orçamentos e envio de mensagem
        AtendimentosMocks.interceptBudgetsApi('*');
        AtendimentosMocks.interceptSendMessageApi('*');
      } else {
        // Arrange (API Real): Verifica no resumo lateral se há orçamento; se não houver, dispara a criação via POST API
        AtendimentosPage.elements.summaryOrcamentos().scrollIntoView().should('be.visible').then(($el) => {
          const textoOrc = $el.text();
          const matchOrc = textoOrc.match(/(\d+)\s*orçamento/i);
          const totalOrc = matchOrc ? parseInt(matchOrc[1], 10) : 0;

          if (totalOrc === 0) {
            cy.log('📋 [Orçamentos]: Nenhum orçamento vinculado. Disparando criação via POST API...');
            AtendimentosPage.criarOrcamentoCompletoViaApi();
          } else {
            cy.log(`📋 [Orçamentos]: Atendimento já possui ${totalOrc} orçamento(s) vinculado(s). Reutilizando orçamento existente.`);
          }
        });
      }

      // Act 1: Abre a gaveta de orçamentos vinculados
      AtendimentosPage.abrirGavetaOrcamentos();

      // Validação intermediária: Confirma que os cards de orçamentos estão listados na gaveta
      cy.get('[class*="_budgetDrawerCard_"], [data-testid^="budget-"]').should('have.length.gte', 1);

      // Act 2: Clica em "Enviar orçamento" na base da gaveta para abrir a modal com pré-visualização
      AtendimentosPage.abrirModalEnviarOrcamento();

      // Act 3: Valida a seleção do(s) orçamento(s) na modal (checkbox de seleção)
      AtendimentosPage.elements.checkboxItemOrcamento().first().should('be.visible');

      // Act 4: Testa o botão de baixar o orçamento
      AtendimentosPage.clicarBaixarOrcamentoModal();

      // Act 5: Clica em "Enviar para o chat"
      AtendimentosPage.enviarOrcamentoParaChatModal();
      cy.wait('@sendChatMediaMessage');

      // A lista de mensagens não se auto-atualiza via TanStack Query após o envio (depende de SSE);
      // força um reload para refletir a nova mensagem enviada na conversa.
      cy.reload();
      cy.wait('@getAttendanceMessages');

      // Assert: Valida que o card formatado do orçamento foi inserido na conversa
      AtendimentosPage.validarBalaoOrcamentoNoChat();
    });

    it('1.7 deve buscar e usar mensagem padrão preenchendo automaticamente o compositor do chat', () => {
      // Act 1: Abre a gaveta de Mensagens Padrão
      AtendimentosPage.abrirGavetaMensagemPadrao();

      // Act 2: Pesquisa e seleciona a mensagem padrão
      AtendimentosPage.buscarMensagemPadrao('Abertura');
      AtendimentosPage.selecionarEUsarMensagemPadrao('Abertura');

      // Assert: Valida que o compositor foi preenchido com o texto da mensagem padrão
      AtendimentosPage.elements.inputMensagemChat().invoke('val').should('not.be.empty');
    });

    it('1.8 deve gerenciar e enviar os dois tipos de templates para o chat (com variável e sem variável)', () => {
      // Arrange
      AtendimentosMocks.interceptSendMessageApi('*');

      // Act 1: Abre a gaveta de templates
      AtendimentosPage.abrirGavetaTemplates();

      // Act 2 (Sem Variável): Seleciona template sem variável e valida transferência direta para o compositor com tarja
      AtendimentosPage.selecionarTemplateSemVariavel();
      AtendimentosPage.validarTemplateEscolhidoNoCompositor();

      // Envia o template sem variável para o chat
      cy.get('[data-testid="drawer-templates"], aside[class*="_drawer_"]').should('not.exist');
      AtendimentosPage.elements.btnEnviarMensagemChat()
        .should('be.visible')
        .and('not.be.disabled')
        .click();
      if (Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true') {
        cy.wait('@sendChatMessage');
      }

      // Act 3 (Com Variável): Abre gaveta de templates novamente e seleciona template com variável
      AtendimentosPage.abrirGavetaTemplates();
      AtendimentosPage.selecionarTemplateComVariavel();
      AtendimentosPage.preencherVariavelTemplate('Pedido confirmado');
      AtendimentosPage.enviarTemplateDrawer();
      if (Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true') {
        cy.wait('@sendChatMessage');
      }

      // Assert: Confirma que ambos os envios foram processados no chat
      cy.get('div[class*="_bubble_"]').should('be.visible');
    });

    it('1.9 deve realizar o ciclo completo de CRUD na gaveta de observações (criar, editar e excluir)', () => {
      const textoOriginal = 'Observação de teste E2E Cypress';
      const textoEditado = 'Observação de teste E2E Cypress (Atualizada)';

      // Act 1: Abre a gaveta de Observações
      AtendimentosPage.abrirGavetaObservacoes();

      // Act 2 (Criar): Cria nova observação
      AtendimentosPage.criarObservacao(textoOriginal);

      // Assert 1: Valida que a observação aparece na lista
      AtendimentosPage.elements.drawerObservacoes().should('contain', textoOriginal);

      // Act 3 (Editar): Edita a observação criada
      AtendimentosPage.editarObservacao(textoEditado);

      // Assert 2: Valida atualização do texto
      AtendimentosPage.elements.drawerObservacoes().should('contain', textoEditado);

      // Act 4 (Excluir): Remove a observação
      AtendimentosPage.excluirObservacao();

      // Assert 3: Valida remoção
      AtendimentosPage.elements.drawerObservacoes().should('not.contain', textoEditado);

      // Teardown: fecha a gaveta. AtendimentosPage.visitar() é no-op quando já em /atendimentos
      // (guarda documentada em AGENTS.md), então sem isso a gaveta ficava aberta e bloqueava
      // o clique em summary-notas do próximo teste (falha intermitente em "aside[role=dialog]").
      AtendimentosPage.fecharGavetaObservacoes();
    });

    it('1.10 deve adicionar uma nota interna com sucesso e validar a gravação na gaveta', () => {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';
      const textoNota = 'Nota interna de teste automatizado Cypress';

      if (isMock) {
        // Arrange (Modo Mock): Prepara a listagem inicial e a criação com background re-fetch
        AtendimentosMocks.interceptInternalNotesApi('*', []);
        AtendimentosMocks.interceptCreateInternalNoteApi('*');
      }

      // Act 1: Abre a gaveta lateral de Notas Internas
      AtendimentosPage.abrirGavetaNotasInternas();

      // Act 2: Digita e salva a nova nota interna
      AtendimentosPage.adicionarNotaInterna(textoNota);

      if (isMock) {
        cy.wait('@createInternalNote');
        cy.wait('@getInternalNotes');
      }

      // Assert: Valida que a nota recém-criada é exibida na gaveta com o badge de Comunicação interna
      AtendimentosPage.validarNotaInternaNaLista(textoNota);

      // Limpeza: Fecha a gaveta lateral
      AtendimentosPage.fecharGavetaNotasInternas();
    });

    it('1.11 deve validar a renderização estruturada do card de link de pagamento gerado na gaveta lateral', () => {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';

      // 1. Arrange: Garante interceptação de links de pagamento (com payload canônico no mock)
      if (isMock) {
        AtendimentosMocks.interceptPaymentLinksApi('*');
      }

      // 2. Act: Abre a gaveta lateral de links de pagamento
      AtendimentosPage.abrirGavetaLinksPagamento();
      AtendimentosPage.elements.drawerLinksPagamento().should('be.visible');

      // 3. Assert: Valida a renderização e controles do card de link na gaveta
      cy.get('body').then(($body) => {
        if ($body.find('article[data-testid^="payment-link-"], article[class*="_paymentLinkDrawerCard_"]').length > 0) {
          AtendimentosPage.validarCardLinkPagamentoRenderizado(null, 'Aguardando');

          // Valida presença de botão para copiar URL e link direto de abertura do checkout
          AtendimentosPage.elements.btnCopiarUrlLink().first().should('be.visible');
          AtendimentosPage.elements.linkAbrirUrlLink().first()
            .should('be.visible')
            .and('have.attr', 'href')
            .and('include', 'http');

          // Alterna expansão de detalhes do link (Código e valor de venda)
          AtendimentosPage.alternarDetalhesLinkPagamento();
        } else {
          cy.log('ℹ️ Nenhum link de pagamento gerado para este atendimento no momento.');
        }
      });

      // 4. Teardown: Fecha a gaveta de links de pagamento
      AtendimentosPage.fecharGavetaLinksPagamento();
    });

    it('1.12 deve validar os controles de ação do cabeçalho do chat (buscar, recolher fila e fechar conversa)', () => {
      // Act & Assert 1: Botão buscar na conversa
      AtendimentosPage.elements.btnBuscarConversa().should('be.visible').click();

      // Act & Assert 2: Botão recolher/expandir fila
      AtendimentosPage.elements.btnRecolherFila().should('be.visible').click();

      // Act & Assert 3: Botão fechar conversa
      AtendimentosPage.elements.btnFecharConversa().should('be.visible');
    });

    it('1.13 deve renderizar o badge de início do histórico estático no topo sem flutuar ou sobrepor mensagens (PR #390)', () => {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';

      if (isMock) {
        // Modo Hermético: Garante mensagens completas com has_previous: false e altura para rolagem.
        // O card já está selecionado pelo beforeEach do context — reclicar é no-op (React Query serve
        // do cache e a requisição nem sai, AGENTS.md [R-SEL]); cy.reload() força o refetch com o novo intercept.
        cy.then(() => {
          AtendimentosMocks.interceptMockMensagensHistoricoCompleto('*');
        });
        cy.reload();
        cy.wait('@getAttendanceMessages');
      }

      // Garante que o container de mensagens está renderizado antes de validar rolagem e badge
      cy.get('section[class*="_scrollArea_"]', { timeout: 10000 }).should('be.visible');

      // Validação de posicionamento estático (rejeita sticky/fixed) e geometria de rolagem (PR #390)
      AtendimentosPage.validarBadgeInicioHistoricoEstatico();
    });

    it('1.14 deve abrir a barra de citação no compositor ao acionar responder em mensagem do chat e focar no input (PR #394)', () => {
      // Act: Clica no botão de responder da primeira mensagem elegível do histórico
      AtendimentosPage.acionarResponderMensagem();

      // Assert: Barra de pré-visualização deve ser exibida e o campo de texto deve receber foco
      AtendimentosPage.validarBarraRespostaAtiva();

      // Cleanup: Cancela a resposta para não poluir o estado dos próximos testes
      AtendimentosPage.cancelarRespostaViaBotao();
    });

    it('1.15 deve permitir cancelar a citação tanto pelo botão cancelar quanto pressionando a tecla Esc (PR #394)', () => {
      // 1. Act & Assert: Cancelamento via botão 'x' (button-cancel-reply)
      AtendimentosPage.acionarResponderMensagem();
      AtendimentosPage.validarBarraRespostaAtiva();
      AtendimentosPage.cancelarRespostaViaBotao();
      AtendimentosPage.validarBarraRespostaInexistente();

      // 2. Act & Assert: Cancelamento via tecla Esc no input
      AtendimentosPage.acionarResponderMensagem();
      AtendimentosPage.validarBarraRespostaAtiva();
      AtendimentosPage.cancelarRespostaViaEsc();
      AtendimentosPage.validarBarraRespostaInexistente();
    });

    it('1.16 deve garantir exclusão mútua entre citação e uso de template no compositor (PR #394)', () => {
      // 1. Arrange: Abre uma citação ativa
      AtendimentosPage.acionarResponderMensagem();
      AtendimentosPage.validarBarraRespostaAtiva();

      // 2. Act: Abre a gaveta de templates e seleciona um template
      AtendimentosPage.abrirGavetaTemplates();
      AtendimentosPage.selecionarTemplateSemVariavel();

      // 3. Assert: O template substitui a citação (a barra de citação não deve coexistir com o template travado)
      AtendimentosPage.validarBarraRespostaInexistente();
      AtendimentosPage.validarTemplateEscolhidoNoCompositor();

      // 4. Teardown: Cancela o template para restaurar o compositor livre
      AtendimentosPage.cancelarTemplateEscolhidoNoCompositor();
    });

    it('1.17 deve enviar resposta direta com reply_to_message_id no payload e renderizar citação no histórico (PR #394)', () => {
      // 1. Arrange: Intercepta envio de mensagem para validar o payload da requisição
      AtendimentosMocks.interceptSendMessageApi('*');

      // Obtém o ID da mensagem que será respondida através do data-testid do botão
      AtendimentosPage.elements.todosBotoesResponder().first().invoke('attr', 'data-testid').then((testId) => {
        const matchId = testId ? testId.match(/button-reply-(\d+)/) : null;
        const idMensagemCitada = matchId ? parseInt(matchId[1], 10) : null;

        // 2. Act: Clica no botão responder, digita o texto e envia
        AtendimentosPage.acionarResponderMensagem(idMensagemCitada);
        AtendimentosPage.validarBarraRespostaAtiva();
        AtendimentosPage.enviarMensagemComResposta(`Resposta de teste E2E PR #394 - ${Date.now()}`);

        // 3. Assert: Valida payload enviado na rota POST /messages
        cy.wait('@sendChatMessage').then((interception) => {
          expect(interception.response.statusCode).to.be.oneOf([200, 201]);
          if (idMensagemCitada) {
            expect(interception.request.body).to.have.property('reply_to_message_id');
            expect(Number(interception.request.body.reply_to_message_id)).to.eq(idMensagemCitada);
          }
        });

        // Valida que a barra de citação foi limpa após o disparo
        AtendimentosPage.validarBarraRespostaInexistente();
      });
    });

    it('1.18 deve rolar suavemente até a mensagem original ao clicar no card de citação no histórico (PR #394)', () => {
      // Localiza mensagens com citação renderizada no histórico (bloco interno de citação)
      cy.get('body').then(($body) => {
        const cardCitacao = $body.find('[class*="_quote_"], [class*="_replyQuote_"], [class*="_repliedMessage_"]');
        if (cardCitacao.length > 0) {
          // Act: Clica no card de citação
          cy.wrap(cardCitacao.first()).scrollIntoView({ duration: 300 }).click();

          // Assert: Valida que a rolagem direciona o usuário no histórico
          cy.get('section[class*="_scrollArea_"]').should('be.visible');
        } else {
          cy.log('ℹ️ Nenhuma mensagem com citação pré-existente no histórico atual para teste de clique.');
        }
      });
    });

    it('1.19 deve realizar autoscroll para o rodapé ao carregar atendimento mantendo foco na última mensagem (PR #389)', () => {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';

      if (isMock) {
        // O card já está selecionado pelo beforeEach do context — reclicar é no-op (React Query serve
        // do cache e a requisição nem sai, AGENTS.md [R-SEL]); cy.reload() força o refetch com o novo intercept.
        cy.then(() => {
          AtendimentosMocks.interceptMockMensagensHistoricoCompleto('*');
        });
        cy.reload();
        cy.wait('@getAttendanceMessages');
      }

      // Validação geométrica e de visibilidade do autoscroll ao rodapé (PR #389)
      AtendimentosPage.validarAutoscrollParaRodape();
    });

    it('1.20 deve preservar o foco no rodapé da conversa ao alternar entre atendimentos na fila (PR #389)', () => {
      // Act: Alterna para outro card de atendimento na fila (se houver mais de um)
      cy.get('body').then(($body) => {
        const cards = $body.find('section[aria-label="Attendance list"] button[role="option"]');
        if (cards.length > 1) {
          cy.wrap(cards.eq(1)).click();
          cy.get('header[class*="_header_"], [data-testid="chat-header"]').should('be.visible');

          // Assert: A nova conversa também deve realizar o autoscroll para o rodapé
          AtendimentosPage.validarAutoscrollParaRodape();

          // Retorna ao primeiro card para manter estabilidade
          cy.wrap(cards.first()).click();
        } else {
          cy.log('ℹ️ Apenas um atendimento disponível na fila para teste de alternância.');
          AtendimentosPage.validarAutoscrollParaRodape();
        }
      });
    });

    it('1.21 não deve puxar a tela para o rodapé automaticamente quando o operador sobe para ler o histórico (PR #389 / anti-regressão #357)', () => {
      // Valida que ao subir no histórico para leitura, a tela não é empurrada para baixo (PR #389 / #357)
      AtendimentosPage.validarPreservacaoPosicaoNoTopo();
    });

    it('1.22 deve desabilitar botões de editar e apagar além do checkbox em orçamentos vendidos na gaveta (PR #379)', () => {
      // 1. Arrange: Registra cenário 100% mockado com orçamento vendido e em aberto (PR #379)
      AtendimentosMocks.interceptMockBudgetsComVendido('*');

      // 2. Act: Abre a gaveta lateral de orçamentos
      AtendimentosPage.abrirGavetaOrcamentos();

      // 3. Assert: Valida no card com status "Vendido" o bloqueio de editar, apagar e selecionar
      AtendimentosPage.validarControlesOrcamentoVendido();

      // Validação de controle positivo: confirma que orçamento em aberto mantém a edição habilitada
      AtendimentosPage.validarControlesOrcamentoAberto();

      // 4. Teardown: Fecha a gaveta de orçamentos
      AtendimentosPage.fecharGavetaOrcamentos();
    });

    it('1.23 deve permitir marcar e desmarcar checkbox de orçamento pendente disparando PATCH com novo estado (PR #321)', () => {
      // 1. Arrange: Cenário 100% mockado com orçamento pendente #260900036 marcado
      AtendimentosMocks.interceptMockBudgetsComSelecaoECoberto({
        attendanceId: '*',
        pendenteSelecionado: true,
        cobertoSelecionado: false
      });

      // 2. Act: Abre a gaveta lateral de orçamentos
      AtendimentosPage.abrirGavetaOrcamentos();

      // Confirma que o orçamento pendente #260900036 está inicialmente marcado e interativo
      AtendimentosPage.validarCheckboxOrcamentoInterativo(260900036, true);

      // Clica no checkbox para desmarcar
      AtendimentosPage.clicarCheckboxOrcamento(260900036);

      // 3. Assert: Valida emissão da requisição PATCH para desmarcação
      cy.wait('@patchAttendanceBudget').then((interception) => {
        expect(interception.request.body).to.have.property('selected_for_payment_link', false);
      });

      // 4. Teardown: Fecha a gaveta
      AtendimentosPage.fecharGavetaOrcamentos();
    });

    it('1.24 deve bloquear o checkbox para novas cobranças em orçamento já coberto por link aprovado sem exibir selo Vendido (PR #324 / PR #311)', () => {
      // 1. Arrange: Cenário 100% mockado com orçamento #260900035 coberto por link aprovado e desmarcado
      AtendimentosMocks.interceptMockBudgetsComSelecaoECoberto({
        attendanceId: '*',
        pendenteSelecionado: true,
        cobertoSelecionado: false
      });

      // 2. Act: Abre a gaveta lateral de orçamentos
      AtendimentosPage.abrirGavetaOrcamentos();

      // 3. Assert: Card coberto não deve exibir selo "Vendido" (selo exclusivo de venda finalizada)
      AtendimentosPage.validarCardSemSeloVendido(260900035);

      // Checkbox deve estar permanentemente bloqueado para marcar novas cobranças
      AtendimentosPage.validarCheckboxOrcamentoBloqueado(260900035);

      // 4. Teardown: Fecha a gaveta
      AtendimentosPage.fecharGavetaOrcamentos();
    });

    it('1.25 deve permitir desmarcar orçamento coberto por link aprovado que esteja previamente preso marcado (PR #324)', () => {
      // 1. Arrange: Cenário 100% mockado com orçamento #260900035 coberto mas preso marcado (assimetria da PR #324)
      AtendimentosMocks.interceptMockBudgetsComSelecaoECoberto({
        attendanceId: '*',
        pendenteSelecionado: true,
        cobertoSelecionado: true
      });

      // 2. Act: Abre a gaveta lateral de orçamentos
      AtendimentosPage.abrirGavetaOrcamentos();

      // Valida que o checkbox permite desmarcação para soltar o orçamento preso
      AtendimentosPage.validarCheckboxOrcamentoInterativo(260900035, true);

      // Clica para desmarcar o orçamento coberto
      AtendimentosPage.clicarCheckboxOrcamento(260900035);

      // 3. Assert: Valida emissão do PATCH de desmarcação
      cy.wait('@patchAttendanceBudget').then((interception) => {
        expect(interception.request.body).to.have.property('selected_for_payment_link', false);
      });

      // 4. Teardown: Fecha a gaveta
      AtendimentosPage.fecharGavetaOrcamentos();
    });

    it('1.26 deve manter o checkbox permanentemente bloqueado em orçamento com status Vendido (PR #321 / PR #379)', () => {
      // 1. Arrange: Cenário 100% mockado com orçamento vendido #260900081
      AtendimentosMocks.interceptMockBudgetsComSelecaoECoberto({
        attendanceId: '*'
      });

      // 2. Act: Abre a gaveta lateral de orçamentos
      AtendimentosPage.abrirGavetaOrcamentos();

      // 3. Assert: Card vendido exibe selo "Vendido" e checkbox bloqueado
      AtendimentosPage.validarControlesOrcamentoVendido();
      AtendimentosPage.validarCheckboxOrcamentoBloqueado(260900081);

      // 4. Teardown: Fecha a gaveta
      AtendimentosPage.fecharGavetaOrcamentos();
    });

    it('1.27 deve permitir marcar um orçamento concluído (status -1) sem financeiro e sem cobertura para o link de pagamento (Issue front#492/backend#562/#583)', () => {
      // 1. Arrange: Cenário 100% mockado com orçamento concluído #260900100 (status -1, sem financial_id,
      // covered_by_approved_link: false) — antes da PR #495/pharmacie-front, isBudgetOpenForPaymentLink
      // aceitava só status === 0, recusando com a dica "Só orçamento em aberto..."
      AtendimentosMocks.interceptMockBudgetsElegibilidadeStatusConcluido('*');

      // 2. Act: Abre a gaveta lateral de orçamentos
      AtendimentosPage.abrirGavetaOrcamentos();

      // 3. Assert: checkbox interativo e desmarcado (estado inicial), sem dica de bloqueio
      AtendimentosPage.validarCheckboxOrcamentoInterativo(260900100, false);
      AtendimentosPage.obterDicaCheckboxOrcamento(260900100).should('not.have.attr', 'title');

      // Marca o orçamento concluído e confirma o PATCH com o novo estado
      AtendimentosPage.clicarCheckboxOrcamento(260900100);
      cy.wait('@patchAttendanceBudget').then((interception) => {
        expect(interception.request.body).to.have.property('selected_for_payment_link', true);
      });

      // 4. Teardown: Fecha a gaveta
      AtendimentosPage.fecharGavetaOrcamentos();
    });

    it('1.28 deve continuar bloqueando o checkbox de um orçamento com status fora de aberto (0) e concluído (-1), com a dica atualizada (Issue front#492)', () => {
      // 1. Arrange: orçamento #260900101 com status 2 (nem aberto nem concluído), sem venda nem cobertura
      AtendimentosMocks.interceptMockBudgetsElegibilidadeStatusConcluido('*');

      // 2. Act: Abre a gaveta lateral de orçamentos
      AtendimentosPage.abrirGavetaOrcamentos();

      // 3. Assert: checkbox bloqueado com a dica revisada pela PR #495 (não mais "só em aberto")
      AtendimentosPage.validarCheckboxOrcamentoBloqueado(260900101);
      AtendimentosPage.obterDicaCheckboxOrcamento(260900101)
        .should('have.attr', 'title', 'Só orçamento em aberto ou concluído entra em link de pagamento.');

      // 4. Teardown: Fecha a gaveta
      AtendimentosPage.fecharGavetaOrcamentos();
    });

    it('1.29 deve bloquear um orçamento concluído quando a API não envia o campo covered_by_approved_link (Issue front#492, achado do operador em 2026-10-01)', () => {
      // 1. Arrange: orçamento #260900102, status -1, mas sem o campo covered_by_approved_link no payload
      // (ausente, não `false` explícito) — o front trata ausência como "não confirmado", bloqueando
      // (fc(e) no bundle real exige covered_by_approved_link===false estrito, não só !==true)
      AtendimentosMocks.interceptMockBudgetsElegibilidadeStatusConcluido('*');

      // 2. Act: Abre a gaveta lateral de orçamentos
      AtendimentosPage.abrirGavetaOrcamentos();

      // 3. Assert: checkbox bloqueado mesmo com status -1, por falta de confirmação do campo
      AtendimentosPage.validarCheckboxOrcamentoBloqueado(260900102);

      // 4. Teardown: Fecha a gaveta
      AtendimentosPage.fecharGavetaOrcamentos();
    });

    it('1.30 deve bloquear todos os checkboxes de seleção quando o atendente não possuir permissão para gerar link de pagamento (PR #321)', () => {
      // 1. Arrange: Cenário 100% mockado onde o atendente não possui permissão de link de pagamento
      cy.then(() => {
        AtendimentosMocks.interceptMockOrcamentosSemGrantLink('*');
      });

      // Recarrega a página para limpar o cache em memória do React Query
      cy.reload();
      AtendimentosPage.abrirAtendimentoPorId(260800035);
      cy.wait('@getAttendanceItemCapabilities');

      // 2. Act: Abre a gaveta lateral de orçamentos
      AtendimentosPage.abrirGavetaOrcamentos();

      // 3. Assert: Todos os checkboxes de seleção da gaveta devem estar bloqueados/desabilitados
      AtendimentosPage.elements.checkboxSelecaoOrcamentoCard().each(($chk) => {
        const isBlocked = $chk.is(':disabled') || $chk.attr('aria-disabled') === 'true' || $chk.attr('disabled') !== undefined;
        expect(isBlocked, 'Checkbox deve estar bloqueado na ausência do grant de link de pagamento').to.be.true;
      });

      // 4. Teardown: Fecha a gaveta
      AtendimentosPage.fecharGavetaOrcamentos();
    });

    it('1.31 não deve fazer sumir a bolha do anexo em andamento quando a lista de mensagens é atualizada automaticamente antes da resposta do servidor, nem duplicá-la ao concluir (Issue front#487, PR #481)', () => {
      // Blindagem 100% mockada (AGENTS.md §3.2 [R-BLIND]): o timing exato de "a lista de
      // mensagens atualiza sozinha no meio do upload" não é reproduzível de forma confiável
      // contra a API real.
      const originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);

      // Consome a carga inicial da conversa (clique no card do beforeEach), para que o próximo
      // cy.wait('@getAttendanceMessages') capture especificamente uma atualização AUTOMÁTICA
      // seguinte, não essa 1ª chamada.
      cy.wait('@getAttendanceMessages');

      AtendimentosMocks.interceptSendMediaMessageApi('*', 201, null, 25000);

      // Contagem por data-message-id (1 por mensagem, cliente ou atendente) — ao contrário do
      // seletor de contarBaloesEnviados()/baloesEnviados() (article[class*="_bubbleRowEnd_"], div[class*="_bubbleEmployee_"]),
      // que casa DUAS vezes cada bolha do atendente (o article externo e o div interno), inflando
      // qualquer comparação de "+1" (achado real ao rodar este teste: 6 elementos para 1 mensagem
      // nova, não 5). data-message-id conta mensagens de verdade, 1:1.
      cy.get('[data-message-id]').its('length').then((totalAntes) => {
        // Act: anexa e dispara o envio sem aguardar a conclusão (ao contrário de anexarArquivo(),
        // que bloqueia até "Enviando mensagem" sumir) — este teste precisa inspecionar o estado
        // em voo, no meio do upload.
        AtendimentosPage.anexarArquivoEDispararEnvio('cypress/fixtures/5.atendimentos/anexos/normal/Anexo de teste jpg.jpg');

        // A bolha otimista do envio em andamento nasce imediatamente, com id provisório
        // data-message-id="-1" (confirmado no DOM real desta app antes do 201 do servidor)
        AtendimentosPage.elements.indicadorUploadMensagem().should('be.visible');
        cy.get('[data-message-id="-1"]').should('exist');
        cy.get('[data-message-id]').should('have.length', totalAntes + 1);

        // A lista de mensagens do servidor nunca inclui o envio em andamento (é só otimista, no
        // cache do cliente) — qualquer atualização automática dela, real ou mockada, reproduz a
        // condição exata da issue: página do servidor sem conhecimento do upload em curso. Espera
        // por pelo menos 1 chamada automática enquanto o POST segue atrasado (25 s).
        cy.wait('@getAttendanceMessages', { timeout: 25000 });

        // Assert (o cerne da regressão, PR #481): a bolha do envio em andamento continua visível e
        // única mesmo depois da atualização automática que ainda não conhece o anexo
        AtendimentosPage.elements.indicadorUploadMensagem().should('be.visible');
        cy.get('[data-message-id="-1"]').should('exist');
        cy.get('[data-message-id]').should('have.length', totalAntes + 1);

        // Ao concluir: vira a mensagem real (id definitivo), sem duplicar e sem sumir
        cy.wait('@sendChatMediaMessage', { timeout: 30000 }).its('response.statusCode').should('be.oneOf', [200, 201]);
        AtendimentosPage.elements.indicadorUploadMensagem().should('not.exist');
        cy.get('[data-message-id="-1"]').should('not.exist');
        cy.get('[data-message-id]').should('have.length', totalAntes + 1);
      });

      cy.then(() => Cypress.env('USE_MOCKS', originalUseMocksState));
    });

    it('1.32 deve exibir os elementos principais do chat (cabeçalho, lista de mensagens, atalhos e compositor) ao abrir uma conversa', () => {
      // Cabeçalho da conversa. "Telefone do cliente" fica de fora — achado real (2026-10-07):
      // é condicional (só existe quando o cliente tem telefone vinculado; sem isso, o painel
      // mostra o protocolo no lugar, já coberto em `5-A.atendimentos-fila.cy.js`), não um elemento
      // sempre presente na abertura da conversa.
      AtendimentosPage.elements.headerChat().should('be.visible');

      // Lista de mensagens
      AtendimentosPage.elements.containerMensagensScroll().should('be.visible');

      // Atalhos do cabeçalho (gavetas/resumos) — painel com overflow, exige scrollIntoView
      // antes de validar visibilidade (AGENTS.md §3.5, achado real 2026-10-07 neste teste).
      AtendimentosPage.elements.summaryOrcamentos().scrollIntoView({ duration: 300 }).should('be.visible');
      AtendimentosPage.elements.summaryNotas().scrollIntoView({ duration: 300 }).should('be.visible');
      AtendimentosPage.elements.summaryObservacoes().scrollIntoView({ duration: 300 }).should('be.visible');
      // O atalho "Transferências" deixou de existir no painel (deploy de 2026-10-15): o histórico agora
      // fica na aba "Histórico" da modal de transferência — coberto em `5-A` #6.3.

      // Compositor de mensagens
      AtendimentosPage.elements.composerRoot().should('be.visible');
      AtendimentosPage.elements.inputMensagemChat().should('be.visible');
      AtendimentosPage.elements.btnEnviarMensagemChat().should('be.visible');
      AtendimentosPage.elements.btnAnexar().should('be.visible');
      AtendimentosPage.elements.btnAudio().should('be.visible');
      AtendimentosPage.elements.btnEmoji().should('be.visible');
    });

    // Frases próprias da gaveta de orçamentos (front PR #680, front#408): o PATCH da marcação para o link de pagamento recusado mostra o motivo, desfaz a marcação e,
    // só nos códigos antigos, relê os cards. Frases medidas no bundle da dev (`drawerBudgetSelection*`, 2026-11-06). 100% mockado como os vizinhos #1.23-#1.29.
    const marcarComRecusa = (resposta, frase, releCards) => {
      // Arrange: orçamento pendente #260900036 desmarcado; o PATCH responde a recusa
      AtendimentosMocks.interceptMockBudgetsComSelecaoECoberto({ attendanceId: '*', pendenteSelecionado: false, cobertoSelecionado: false });
      AtendimentosMocks.interceptUpdateBudgetApi('*', '*', resposta, true);
      AtendimentosPage.abrirGavetaOrcamentos();
      AtendimentosPage.validarCheckboxOrcamentoInterativo(260900036, false);
      cy.get('@getAttendanceBudgets.all').its('length').then((leiturasAntes) => {
        // Act
        AtendimentosPage.clicarCheckboxOrcamento(260900036);
        cy.wait('@patchAttendanceBudget').its('request.body').should('have.property', 'selected_for_payment_link', true);

        // Assert: a frase do motivo, o checkbox de volta desmarcado e a releitura (ou não) dos cards
        cy.contains(frase).should('be.visible');
        AtendimentosPage.validarCheckboxOrcamentoInterativo(260900036, false);
        cy.wait(1000);
        if (releCards) cy.get('@getAttendanceBudgets.all').its('length').should('be.greaterThan', leiturasAntes);
        else cy.get('@getAttendanceBudgets.all').should('have.length', leiturasAntes);
      });
      AtendimentosPage.fecharGavetaOrcamentos();
    };

    it('1.33 deve avisar que o orçamento sem valor não entra no link de pagamento quando o servidor recusa a marcação com 422 BUDGET_ZERO_AMOUNT, sem reler os cards (Issue front#408/PR #680)', () => {
      marcarComRecusa(
        { statusCode: 422, body: { status: 422, error: 'Unprocessable Content', code: 'BUDGET_ZERO_AMOUNT', message: 'Orçamento sem valor.' } },
        'Este orçamento não tem valor e não pode entrar no link de pagamento.',
        false,
      );
    });

    it('1.34 deve avisar que a seleção não foi gravada quando o servidor responde 409 BUDGET_WRITE_NOT_APPLIED, desfazendo a marcação (Issue front#408/PR #680)', () => {
      marcarComRecusa(
        { statusCode: 409, body: { status: 409, error: 'Conflict', code: 'BUDGET_WRITE_NOT_APPLIED', message: 'A marcação não foi aplicada.' } },
        'A seleção do orçamento não foi gravada. Tente novamente.',
        false,
      );
    });

    it('1.35 deve manter a frase de orçamento que já não pode ser cobrado e reler os cards quando a recusa é BUDGET_ALREADY_SOLD (regressão da Issue front#408/PR #680)', () => {
      marcarComRecusa(
        { statusCode: 422, body: { status: 422, error: 'Unprocessable Content', code: 'BUDGET_ALREADY_SOLD', message: 'Orçamento já vendido.' } },
        'Este orçamento já não pode ser cobrado. Confira o estado atualizado no card.',
        true,
      );
    });
  });

  // -------------------------------------------------------------
  // 2. VALIDAÇÕES DE ENVIO DE ANEXOS NO CHAT (MÍNIMOS E TETO GLOBAL DE 16 MB - FRONT#344 / SRV#455, #463, #527)
  // -------------------------------------------------------------

  context('2. Validações de Envio de Anexos no Chat (Mínimos, Teto por Tipo de Mídia e Recusa Local no Front - front#344 / srv#455, #463, #527 / front#595)', () => {

    before(() => {
      // Reseta a flag de validação de janela ativa no início da execução da suíte de anexos
      Cypress.env('ACTIVE_SERVICE_WINDOW_VERIFIED', false);
    });

    beforeEach(function () {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';

      if (isMock) {
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
      } else {
        // Modo Real: Limpa os mocks para liberar a rede real
        AtendimentosMocks.clearMocksForRealE2ETests();
        // Pré-condição canônica dos 3 Casos de Janela Ativa:
        // Caso 1: Atendimento não existe -> abre nova conversa via modal com template editável (1:30 min)
        // Caso 2: Atendimento existe mas janela limitada -> envia template com variável editável (1:30 min)
        // Caso 3: Atendimento existe e ativo -> prossegue normalmente
        AtendimentosPage.garantirAtendimentoComJanelaAtiva(CELULAR_PADRAO, 'oficial', 90000);
      }
    });

    // --- ARQUIVOS MÍNIMOS (FORMATOS ACEITOS) ---

    it('2.1 deve enviar anexo de imagem JPG, renderizar na conversa e abrir a prévia da imagem ao clicar', function () {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';
      if (isMock) {
        AtendimentosMocks.interceptSendMediaMessageApi('*');
      }
      AtendimentosPage.anexarArquivo('cypress/fixtures/5.atendimentos/anexos/normal/Anexo de teste jpg.jpg', 'Legenda imagem JPG', 60000);
      cy.wait('@sendChatMediaMessage', { timeout: 60000 }).its('response.statusCode').should('be.oneOf', [200, 201]);

      // Validação visual da imagem renderizada (visualizável, sem placeholder de erro)
      cy.get('article[class*="_bubbleRowEnd_"]')
        .last()
        .scrollIntoView({ duration: 300 })
        .within(() => {
          cy.get('button[data-testid^="attachment-image-"], img[class*="_attachmentImage_"]').should('be.visible');
          cy.contains(/Mídia indisponível/i).should('not.exist');
        });

      // Inteligência: Só avança para o próximo teste após confirmação de entrega do WhatsApp (limite 2m, senão auto-skip no restante)
      AtendimentosPage.aguardarConfirmacaoEntregaMensagem(120000, this);
      // A abertura do anexo só é validada contra a API real: em modo mock o payload de mídia é
      // sintético (PDF-shaped por padrão) e não representa o arquivo efetivamente enviado aqui.
      if (!isMock) {
        AtendimentosPage.abrirPreviaDeImagemEValidar();
      }
    });

    it('2.2 deve enviar anexo de documento PDF, renderizar o card e abrir a prévia do PDF ao clicar', function () {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';
      if (isMock) {
        AtendimentosMocks.interceptSendMediaMessageApi('*');
      }
      AtendimentosPage.anexarArquivo('cypress/fixtures/5.atendimentos/anexos/normal/Anexo de teste PDF.pdf', 'Legenda PDF', 60000);
      cy.wait('@sendChatMediaMessage', { timeout: 60000 }).its('response.statusCode').should('be.oneOf', [200, 201]);

      // Validação visual do card com rolagem no chat — mesmo padrão de 2.3-2.5/2.7 (DOC/DOCX/XLS/TXT):
      // em modo mock o payload de mídia é sintético (PDF-shaped por padrão, igual ao de orçamento) e
      // não representa o arquivo efetivamente enviado aqui, então só o surgimento da bolha é validado
      // (achado real 2026-10-05: o card otimista de um documento recém-enviado nasce e permanece como
      // `_attachmentPlaceholder_`/"Mídia indisponível" no mock, mesmo com `attachment.url`/`mime_type`
      // válidos — o reconhecimento de tipo exige o dado confirmado do servidor, que o mock estático de
      // `GET .../messages` nunca reflete; já a mensagem pré-carregada na fixture, com o mesmo shape,
      // renderiza corretamente como `_documentLink_` — diferença de ciclo de vida, não de payload).
      cy.get('article[class*="_bubbleRowEnd_"]').last().scrollIntoView({ duration: 300 }).should('be.visible');

      // Inteligência: Só avança para o próximo teste após confirmação de entrega do WhatsApp (limite 2m, senão auto-skip no restante)
      AtendimentosPage.aguardarConfirmacaoEntregaMensagem(120000, this);
      // A abertura do anexo e o card do lightbox só são validados contra a API real.
      if (!isMock) {
        AtendimentosPage.abrirPreviaDePdfEValidar();
      }
    });

    it('2.3 deve enviar anexo de documento Word (DOC), renderizar na conversa e baixar com a extensão .doc ao clicar', function () {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';
      if (isMock) {
        AtendimentosMocks.interceptSendMediaMessageApi('*');
      }
      AtendimentosPage.anexarArquivo('cypress/fixtures/5.atendimentos/anexos/normal/Anexo de teste doc.doc', 'Legenda DOC', 60000);
      cy.wait('@sendChatMediaMessage', { timeout: 60000 }).then((interception) => {
        expect(interception.response.statusCode, 'status do upload').to.be.oneOf([200, 201]);
        const messageId = interception.response.body.id;

        cy.get('article[class*="_bubbleRowEnd_"]').last().scrollIntoView({ duration: 300 }).should('be.visible');

        // Inteligência: Só avança para o próximo teste após confirmação de entrega do WhatsApp (limite 2m, senão auto-skip no restante)
        AtendimentosPage.aguardarConfirmacaoEntregaMensagem(120000, this);
        // A abertura do anexo só é validada contra a API real: em modo mock o payload de mídia é
        // sintético (PDF-shaped por padrão) e não representa o arquivo efetivamente enviado aqui.
        if (!isMock) {
          AtendimentosPage.baixarDocumentoSobDemandaEValidar('.doc', messageId);
        }
      });
    });

    it('2.4 deve enviar anexo de documento Word (DOCX), renderizar na conversa e baixar com a extensão .docx ao clicar', function () {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';
      if (isMock) {
        AtendimentosMocks.interceptSendMediaMessageApi('*');
      }
      AtendimentosPage.anexarArquivo('cypress/fixtures/5.atendimentos/anexos/normal/Anexo de teste docx.docx', 'Legenda DOCX', 60000);
      cy.wait('@sendChatMediaMessage', { timeout: 60000 }).then((interception) => {
        expect(interception.response.statusCode, 'status do upload').to.be.oneOf([200, 201]);
        const messageId = interception.response.body.id;

        cy.get('article[class*="_bubbleRowEnd_"]').last().scrollIntoView({ duration: 300 }).should('be.visible');

        // Inteligência: Só avança para o próximo teste após confirmação de entrega do WhatsApp (limite 2m, senão auto-skip no restante)
        AtendimentosPage.aguardarConfirmacaoEntregaMensagem(120000, this);
        // A abertura do anexo só é validada contra a API real: em modo mock o payload de mídia é
        // sintético (PDF-shaped por padrão) e não representa o arquivo efetivamente enviado aqui.
        if (!isMock) {
          AtendimentosPage.baixarDocumentoSobDemandaEValidar('.docx', messageId);
        }
      });
    });

    it('2.5 deve enviar anexo de planilha Excel (XLS), renderizar na conversa e baixar com a extensão .xls ao clicar', function () {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';
      if (isMock) {
        AtendimentosMocks.interceptSendMediaMessageApi('*');
      }
      AtendimentosPage.anexarArquivo('cypress/fixtures/5.atendimentos/anexos/normal/Anexo de teste xls.xls', 'Legenda XLS', 60000);
      cy.wait('@sendChatMediaMessage', { timeout: 60000 }).then((interception) => {
        expect(interception.response.statusCode, 'status do upload').to.be.oneOf([200, 201]);
        const messageId = interception.response.body.id;

        cy.get('article[class*="_bubbleRowEnd_"]').last().scrollIntoView({ duration: 300 }).should('be.visible');

        // Inteligência: Só avança para o próximo teste após confirmação de entrega do WhatsApp (limite 2m, senão auto-skip no restante)
        AtendimentosPage.aguardarConfirmacaoEntregaMensagem(120000, this);
        // A abertura do anexo só é validada contra a API real: em modo mock o payload de mídia é
        // sintético (PDF-shaped por padrão) e não representa o arquivo efetivamente enviado aqui.
        if (!isMock) {
          AtendimentosPage.baixarDocumentoSobDemandaEValidar('.xls', messageId);
        }
      });
    });

    it('2.6 deve enviar anexo de planilha Excel (XLSX), renderizar na conversa e baixar com a extensão .xlsx ao clicar', function () {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';
      if (isMock) {
        AtendimentosMocks.interceptSendMediaMessageApi('*');
      }
      AtendimentosPage.anexarArquivo('cypress/fixtures/5.atendimentos/anexos/normal/Anexo de teste xlsx.xlsx', 'Legenda XLSX', 60000);
      cy.wait('@sendChatMediaMessage', { timeout: 60000 }).then((interception) => {
        expect(interception.response.statusCode, 'status do upload').to.be.oneOf([200, 201]);
        const messageId = interception.response.body.id;

        cy.get('article[class*="_bubbleRowEnd_"]').last().scrollIntoView({ duration: 300 }).should('be.visible');

        // Inteligência: Só avança para o próximo teste após confirmação de entrega do WhatsApp (limite 2m, senão auto-skip no restante)
        AtendimentosPage.aguardarConfirmacaoEntregaMensagem(120000, this);
        // A abertura do anexo só é validada contra a API real: em modo mock o payload de mídia é
        // sintético (PDF-shaped por padrão) e não representa o arquivo efetivamente enviado aqui.
        if (!isMock) {
          AtendimentosPage.baixarDocumentoSobDemandaEValidar('.xlsx', messageId);
        }
      });
    });


    it('2.7 deve enviar anexo de texto simples (TXT), renderizar na conversa e baixar com a extensão .txt ao clicar', function () {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';
      if (isMock) {
        AtendimentosMocks.interceptSendMediaMessageApi('*');
      }
      AtendimentosPage.anexarArquivo('cypress/fixtures/5.atendimentos/anexos/normal/Anexo de teste txt.txt', 'Legenda TXT', 60000);
      cy.wait('@sendChatMediaMessage', { timeout: 60000 }).then((interception) => {
        expect(interception.response.statusCode, 'status do upload').to.be.oneOf([200, 201]);
        const messageId = interception.response.body.id;

        cy.get('article[class*="_bubbleRowEnd_"]').last().scrollIntoView({ duration: 300 }).should('be.visible');

        // Inteligência: Só avança para o próximo teste após confirmação de entrega do WhatsApp (limite 2m, senão auto-skip no restante)
        AtendimentosPage.aguardarConfirmacaoEntregaMensagem(120000, this);
        // A abertura do anexo só é validada contra a API real: em modo mock o payload de mídia é
        // sintético (PDF-shaped por padrão) e não representa o arquivo efetivamente enviado aqui.
        if (!isMock) {
          AtendimentosPage.baixarDocumentoSobDemandaEValidar('.txt', messageId);
        }
      });
    });

    it('2.8 deve enviar anexo de áudio MP3, renderizar o player nativo e reproduzir o áudio ao clicar', function () {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';
      if (isMock) {
        AtendimentosMocks.interceptSendMediaMessageApi('*');
      }
      AtendimentosPage.anexarArquivo('cypress/fixtures/5.atendimentos/anexos/normal/Anexo de teste mp3.mp3', '', 60000);
      cy.wait('@sendChatMediaMessage', { timeout: 60000 }).its('response.statusCode').should('be.oneOf', [200, 201]);
      cy.get('article[class*="_bubbleRowEnd_"]').last().scrollIntoView({ duration: 300 });
      AtendimentosPage.validarAudioPlayerVisivel();

      // A reprodução só é validada contra a API real: em modo mock o payload de mídia é sintético.
      if (!isMock) {
        AtendimentosPage.reproduzirAudioEValidar();
      }

      // Inteligência: Só avança para o próximo teste após confirmação de entrega do WhatsApp (limite 2m, senão auto-skip no restante)
      AtendimentosPage.aguardarConfirmacaoEntregaMensagem(120000, this);
    });

    it('2.9 deve enviar anexo de vídeo MP4, renderizar na conversa e reproduzir o vídeo no player inline', function () {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';
      if (isMock) {
        AtendimentosMocks.interceptSendMediaMessageApi('*');
      }
      AtendimentosPage.anexarArquivo('cypress/fixtures/5.atendimentos/anexos/normal/Anexo de teste mp4.mp4', 'Legenda Vídeo MP4', 60000);
      cy.wait('@sendChatMediaMessage', { timeout: 60000 }).its('response.statusCode').should('be.oneOf', [200, 201]);
      cy.get('article[class*="_bubbleRowEnd_"]').last().scrollIntoView({ duration: 300 }).should('be.visible');

      // Inteligência: Só avança para o próximo teste após confirmação de entrega do WhatsApp (limite 2m, senão auto-skip no restante)
      AtendimentosPage.aguardarConfirmacaoEntregaMensagem(120000, this);
      // A abertura do anexo só é validada contra a API real: em modo mock o payload de mídia é
      // sintético (PDF-shaped por padrão) e não representa o arquivo efetivamente enviado aqui.
      if (!isMock) {
        AtendimentosPage.reproduzirVideoEValidar();
      }
    });

    // --- TETO DE ANEXO POR TIPO DE MÍDIA: RECUSA LOCAL NO FRONT (front#595/PR #598, mergeada em 2026-10-19) E REDE DE PROTEÇÃO NO SERVIDOR ---
    // Contrato vigente:
    //  - o front bloqueia NA SELEÇÃO do arquivo (clipe, Ctrl+V e áudio gravado): não monta a prévia, não faz upload e mostra, na faixa
    //    do compositor (<p role="alert"> no footer "Compositor de mensagens"), "<Tipo> acima do limite de N MB." — imagem 5 MB (5.242.880
    //    bytes), documento, áudio e vídeo 10 MB (10.485.760 bytes); comparação estrita: o arquivo de EXATAMENTE o teto é aceito (#2.13);
    //  - o teto é fixo no front (nenhuma rota o expõe); o 422/413 do servidor (cypress#003, backend#600/#602, container de 16 MB) continua
    //    como rede de proteção, mas deixou de ser alcançável pela UI com arquivo acima destes tetos — a prova dele fica no `0-A/0-B/0-C`;
    //  - antes da PR #598 não havia validação local (teto removido na front#344): a prévia montava e a recusa vinha do servidor, depois do
    //    upload. Os #2.10, #2.11, #2.12, #2.14 e #2.15 cobriam isso e foram ajustados em 2026-10-19 (medido no front real: aviso, 0 POST,
    //    sem prévia; 10 MB exatos sem aviso e com prévia).

    it('2.10 deve recusar localmente o vídeo de 64 MB acima do teto de 10 MB, citando o limite, sem montar a prévia nem disparar o upload (front#595/PR #598)', () => {
      // O vídeo de 64 MB é o maior da massa de limites: antes da PR #598 montava a prévia (prova da front#344); agora é recusado na seleção
      // Espião do upload nos dois modos (em mock responde 201, em real só observa): a recusa é local, o POST não pode sair
      AtendimentosMocks.interceptSendMediaMessageApi('*');

      AtendimentosPage.contarBaloesEnviados().then((baloesAntes) => {
        AtendimentosPage.anexarArquivoSemEnviar('cypress/fixtures/5.atendimentos/anexos/limites/max-video-64mb.mp4');

        AtendimentosPage.validarRecusaLocalDeTamanho('Vídeo acima do limite de 10 MB.');
        AtendimentosPage.elements.baloesEnviados().should('have.length', baloesAntes);
      });
    });

    it('2.11 deve recusar localmente o documento de 15 MB, citando o teto de 10 MB, sem montar a prévia nem disparar o upload (front#595/PR #598; antes era 422 do servidor, Issue cypress#003)', () => {
      // Documento acima de 10 MB: antes o servidor recusava com 422 "Documento acima do limite de 10 MB." depois do upload (Issue cypress#003)
      // Espião do upload nos dois modos (em mock responde 201, em real só observa): a recusa é local, o POST não pode sair
      AtendimentosMocks.interceptSendMediaMessageApi('*');

      AtendimentosPage.contarBaloesEnviados().then((baloesAntes) => {
        AtendimentosPage.anexarArquivoSemEnviar('cypress/fixtures/5.atendimentos/anexos/limites/abaixo-teto-15mb.pdf');

        AtendimentosPage.validarRecusaLocalDeTamanho('Documento acima do limite de 10 MB.');
        AtendimentosPage.elements.baloesEnviados().should('have.length', baloesAntes);
      });
    });

    it('2.12 deve recusar localmente a imagem de 8 MB, citando o teto de 5 MB, sem montar a prévia nem disparar o upload (front#595/PR #598; antes era 422 do servidor, Issue cypress#003)', () => {
      // Imagem acima de 5 MB: antes o servidor recusava com 422 "Imagem acima do limite de 5 MB." depois do upload (Issue cypress#003)
      // Espião do upload nos dois modos (em mock responde 201, em real só observa): a recusa é local, o POST não pode sair
      AtendimentosMocks.interceptSendMediaMessageApi('*');

      AtendimentosPage.contarBaloesEnviados().then((baloesAntes) => {
        AtendimentosPage.anexarArquivoSemEnviar('cypress/fixtures/5.atendimentos/anexos/limites/midia-indisponivel-8mb.jpg');

        AtendimentosPage.validarRecusaLocalDeTamanho('Imagem acima do limite de 5 MB.');
        AtendimentosPage.elements.baloesEnviados().should('have.length', baloesAntes);
      });
    });

    it('2.13 deve aceitar documento de exatamente 10 MB (fronteira inferior do teto de busca do BLOB, Issue backend#600/#602)', () => {
      // Issue backend#600/#602 (05/10/2026): ATTENDANCE_MEDIA_FETCH_MAX_SIZE=10MB passou a ser o teto
      // de busca do BLOB no omnichannel-aws, aplicado via effectiveLimit() = minOf(rules.maxBytes,
      // containerMaxFileSize) para TODO tipo de mídia - documento, imagem, áudio e vídeo. 10 MB exatos
      // (10.485.760 bytes) é a fronteira inclusiva: deve ser aceito (201), nunca 422. Medido contra a API
      // real em 2026-10-15: 10.485.760 e 10.000.000 bytes → 201; 10.485.761 → 422 "Documento acima do
      // limite de 10 MB." — o teste só prova a fronteira se o arquivo tiver EXATAMENTE 10.485.760 bytes
      // (no Windows com autocrlf o fixture teto-global-10mb.pdf ficava com 10.485.763 bytes e era recusado com 422; o blob do repositório tem o tamanho exato e `.gitattributes` marca a pasta como binary).
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';
      if (isMock) {
        AtendimentosMocks.interceptSendMediaMessageApi('*');
      }

      AtendimentosPage.anexarArquivoEDispararEnvio('cypress/fixtures/5.atendimentos/anexos/limites/teto-global-10mb.pdf');
      cy.wait('@sendChatMediaMessage', { timeout: 180000 }).its('response.statusCode').should('be.oneOf', [200, 201]);
      cy.get('article[class*="_bubbleRowEnd_"]').last().scrollIntoView({ duration: 300 });
      cy.get('article[class*="_bubbleRowEnd_"]').last().should('be.visible');
    });

    it('2.14 deve recusar localmente o áudio de 15 MB, citando o teto de 10 MB, sem montar a prévia nem disparar o upload (front#595/PR #598; antes era 422 do servidor, Issue backend#600/#602)', () => {
      // Áudio acima de 10 MB (teto estendido pela backend#602): o aviso local aparece também no fluxo de áudio, antes de qualquer prévia
      // Espião do upload nos dois modos (em mock responde 201, em real só observa): a recusa é local, o POST não pode sair
      AtendimentosMocks.interceptSendMediaMessageApi('*');

      AtendimentosPage.contarBaloesEnviados().then((baloesAntes) => {
        AtendimentosPage.anexarArquivoSemEnviar('cypress/fixtures/5.atendimentos/anexos/limites/entre-teto-15mb.mp3');

        AtendimentosPage.validarRecusaLocalDeTamanho('Áudio acima do limite de 10 MB.');
        AtendimentosPage.elements.baloesEnviados().should('have.length', baloesAntes);
      });
    });

    it('2.15 deve recusar localmente o vídeo de 15 MB, citando o teto de 10 MB, sem montar a prévia nem disparar o upload (front#595/PR #598; antes era 422 do servidor, Issue backend#600/#602)', () => {
      // Vídeo acima de 10 MB (teto estendido pela backend#602): mesmo aviso local do #2.10, agora com um arquivo logo acima do teto
      // Espião do upload nos dois modos (em mock responde 201, em real só observa): a recusa é local, o POST não pode sair
      AtendimentosMocks.interceptSendMediaMessageApi('*');

      AtendimentosPage.contarBaloesEnviados().then((baloesAntes) => {
        AtendimentosPage.anexarArquivoSemEnviar('cypress/fixtures/5.atendimentos/anexos/limites/entre-teto-15mb.mp4');

        AtendimentosPage.validarRecusaLocalDeTamanho('Vídeo acima do limite de 10 MB.');
        AtendimentosPage.elements.baloesEnviados().should('have.length', baloesAntes);
      });
    });

    // Fronteira estrita (front#595/PR #598): o arquivo de EXATAMENTE o teto é aceito (#2.13 envia o documento de 10 MB; #2.17 a imagem de 5 MB) e
    // com 1 byte a mais é recusado. Arquivos sintéticos do tamanho exato (sem fixture em disco); nenhum dos três envia, só observa a seleção
    const TETO_DOCUMENTO_BYTES = 10 * 1024 * 1024;
    const TETO_IMAGEM_BYTES = 5 * 1024 * 1024;

    it('2.16 deve recusar localmente o documento com 1 byte acima do teto de 10 MB (10.485.761 bytes), sem montar a prévia nem disparar o upload (front#595/PR #598)', () => {
      // Espião do upload nos dois modos (em mock responde 201, em real só observa): a recusa é local, o POST não pode sair
      AtendimentosMocks.interceptSendMediaMessageApi('*');

      AtendimentosPage.anexarArquivoSinteticoSemEnviar('documento-teto-mais-1-byte.pdf', 'application/pdf', TETO_DOCUMENTO_BYTES + 1);

      AtendimentosPage.validarRecusaLocalDeTamanho('Documento acima do limite de 10 MB.');
    });

    it('2.17 deve aceitar localmente a imagem de exatamente 5 MB (5.242.880 bytes): monta a prévia, sem aviso de tamanho e sem disparar o upload (front#595/PR #598)', () => {
      // Espião do upload nos dois modos: a imagem fica só na prévia (não envia), então nenhum POST pode sair
      AtendimentosMocks.interceptSendMediaMessageApi('*');

      AtendimentosPage.anexarArquivoSinteticoSemEnviar('imagem-teto-exato.jpg', 'image/jpeg', TETO_IMAGEM_BYTES);

      AtendimentosPage.validarAnexoPendenteNoCompositor();
      AtendimentosPage.elements.btnRemoverAnexo().should('be.visible');
      AtendimentosPage.elements.avisoLocalDeTamanho().should('not.exist');
      cy.get('@sendChatMediaMessage.all').should('have.length', 0);
    });

    it('2.18 deve recusar localmente a imagem com 1 byte acima do teto de 5 MB (5.242.881 bytes), sem montar a prévia nem disparar o upload (front#595/PR #598)', () => {
      // Espião do upload nos dois modos (em mock responde 201, em real só observa): a recusa é local, o POST não pode sair
      AtendimentosMocks.interceptSendMediaMessageApi('*');

      AtendimentosPage.anexarArquivoSinteticoSemEnviar('imagem-teto-mais-1-byte.jpg', 'image/jpeg', TETO_IMAGEM_BYTES + 1);

      AtendimentosPage.validarRecusaLocalDeTamanho('Imagem acima do limite de 5 MB.');
    });

    it('2.19 deve apagar o aviso de tamanho e montar a prévia ao escolher um arquivo válido logo depois de um recusado (front#595/PR #598)', () => {
      // Espião do upload nos dois modos: nem a recusa nem a prévia do arquivo válido enviam nada
      AtendimentosMocks.interceptSendMediaMessageApi('*');

      // Arrange: o arquivo acima do teto é recusado, com aviso e sem prévia
      AtendimentosPage.anexarArquivoSemEnviar('cypress/fixtures/5.atendimentos/anexos/limites/midia-indisponivel-8mb.jpg');
      AtendimentosPage.validarRecusaLocalDeTamanho('Imagem acima do limite de 5 MB.');

      // Act: o operador escolhe em seguida um arquivo dentro do teto
      AtendimentosPage.anexarArquivoSemEnviar('cypress/fixtures/5.atendimentos/anexos/normal/Anexo de teste jpg.jpg');

      // Assert: o aviso some e a prévia do arquivo válido aparece, ainda sem upload
      AtendimentosPage.validarAnexoPendenteNoCompositor();
      AtendimentosPage.elements.btnRemoverAnexo().should('be.visible');
      AtendimentosPage.elements.avisoLocalDeTamanho().should('not.exist');
      cy.get('@sendChatMediaMessage.all').should('have.length', 0);
    });

  });

  // -------------------------------------------------------------
  // 3. COLAGEM DE IMAGEM NO COMPOSITOR VIA CTRL+V / MENU "COLAR" DO NAVEGADOR (PR #424)
  // -------------------------------------------------------------

  context('3. Colagem de Imagem no Compositor via Ctrl+V / Menu "Colar" do Navegador (PR #424)', () => {

    before(() => {
      // Reseta a flag de validação de janela ativa no início da execução deste contexto
      Cypress.env('ACTIVE_SERVICE_WINDOW_VERIFIED', false);
    });

    beforeEach(function () {
      const isMock = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';

      if (isMock) {
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
      } else {
        // Modo Real: Limpa os mocks para liberar a rede real
        AtendimentosMocks.clearMocksForRealE2ETests();
        AtendimentosPage.garantirAtendimentoComJanelaAtiva(CELULAR_PADRAO, 'oficial', 90000);
      }

      // Alias da rota de envio de mídia em ambos os modos (mocka em modo mock; apenas aliasa com
      // req.continue() em modo real - ver BaseMock.interceptRoute / interceptSendMediaMessageApi)
      AtendimentosMocks.interceptSendMediaMessageApi('*');
    });

    /**
     * Dispara um evento nativo `paste` no compositor com uma imagem no clipboardData,
     * simulando tanto o atalho Ctrl+V quanto o item "Colar" do menu de contexto do mouse.
     * @param {boolean} viaMenuContexto Quando true, dispara antes um evento `contextmenu`
     *   (botão direito) no compositor, replicando o gesto de abrir o menu nativo antes de
     *   clicar em "Colar". O clique no item "Colar" do menu NATIVO do sistema operacional
     *   não é controlável pelo Cypress (não é um elemento do DOM da página) — por isso o
     *   evento `paste` seguinte representa o resultado desse clique, exatamente como o dev
     *   descreve na PR #424: os dois gestos convergem para o mesmo ClipboardEvent, sem
     *   caminho de código separado para o mouse.
     */
    function colarImagemNoCompositor(viaMenuContexto = false) {
      if (viaMenuContexto) {
        AtendimentosPage.elements.inputMensagemChat().should('be.visible').trigger('contextmenu', { force: true });
      }

      cy.fixture('5.atendimentos/anexos/normal/Anexo de teste jpg.jpg', 'base64').then((base64) => {
        const blob = Cypress.Blob.base64StringToBlob(base64, 'image/jpeg');
        const arquivo = new File([blob], 'imagem-colada-clipboard.jpg', { type: 'image/jpeg' });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(arquivo);

        AtendimentosPage.elements.inputMensagemChat()
          .should('be.visible')
          .trigger('paste', { clipboardData: dataTransfer, force: true });
      });
    }

    /**
     * Dispara um evento nativo `paste` no compositor com uma imagem sintética do tamanho exato em bytes
     * (sem fixture em disco), para provar o teto de imagem na colagem (front#595/PR #598).
     * @param {number} tamanhoEmBytes Tamanho do conteúdo da imagem colada
     */
    function colarImagemSinteticaNoCompositor(tamanhoEmBytes) {
      const arquivo = new File([new Uint8Array(tamanhoEmBytes)], 'imagem-colada-acima-do-teto.jpg', { type: 'image/jpeg' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(arquivo);

      AtendimentosPage.elements.inputMensagemChat()
        .should('be.visible')
        .trigger('paste', { clipboardData: dataTransfer, force: true });
    }

    it('3.1 deve colar uma imagem no compositor e abrir a modal de prévia com legenda opcional, enviando pela mesma esteira de mídia do ícone de anexo (PR #424)', () => {
      // Act: cola a imagem no compositor
      colarImagemNoCompositor();

      // Assert: a modal de prévia da imagem colada abre com o campo de legenda
      cy.get('[data-testid="modal-paste-image"]').should('be.visible');
      cy.get('[data-testid="input-paste-image-caption"]').should('be.visible');

      // Act: preenche legenda opcional e confirma o envio
      cy.get('[data-testid="input-paste-image-caption"]').type('Legenda da imagem colada via Ctrl+V');
      cy.get('[data-testid="button-paste-image-send"]').click();

      // Assert: envio disparado pela mesma esteira de mídia (POST multipart) usada pelo ícone de anexo
      cy.wait('@sendChatMediaMessage', { timeout: 60000 }).its('response.statusCode').should('be.oneOf', [200, 201]);
      cy.get('[data-testid="modal-paste-image"]').should('not.exist');

      // Assert: a imagem colada é renderizada normalmente na conversa (mesmo componente de anexo de imagem)
      cy.get('article[class*="_bubbleRowEnd_"]')
        .last()
        .scrollIntoView({ duration: 300 })
        .within(() => {
          cy.get('button[data-testid^="attachment-image-"], img[class*="_attachmentImage_"]').should('be.visible');
          cy.contains(/Mídia indisponível/i).should('not.exist');
        });
    });

    it('3.2 deve colar uma imagem via botão direito do mouse + "Colar" do menu de contexto e abrir a mesma modal de prévia (PR #424)', () => {
      // Act: abre o menu de contexto (botão direito) e cola a imagem — ver nota de limitação
      // de automação no comentário de colarImagemNoCompositor()
      colarImagemNoCompositor(true);

      // Assert: a mesma modal de prévia abre, com o mesmo comportamento do atalho Ctrl+V
      cy.get('[data-testid="modal-paste-image"]').should('be.visible');
      cy.get('[data-testid="input-paste-image-caption"]').should('be.visible');

      // Act: preenche legenda opcional e confirma o envio
      cy.get('[data-testid="input-paste-image-caption"]').type('Legenda da imagem colada via botão direito + Colar');
      cy.get('[data-testid="button-paste-image-send"]').click();

      // Assert: envio disparado pela mesma esteira de mídia (POST multipart) usada pelo ícone de anexo e pelo Ctrl+V
      cy.wait('@sendChatMediaMessage', { timeout: 60000 }).its('response.statusCode').should('be.oneOf', [200, 201]);
      cy.get('[data-testid="modal-paste-image"]').should('not.exist');

      // Assert: a imagem colada é renderizada normalmente na conversa
      cy.get('article[class*="_bubbleRowEnd_"]')
        .last()
        .scrollIntoView({ duration: 300 })
        .within(() => {
          cy.get('button[data-testid^="attachment-image-"], img[class*="_attachmentImage_"]').should('be.visible');
          cy.contains(/Mídia indisponível/i).should('not.exist');
        });
    });

    it('3.3 deve fechar a modal de prévia de imagem colada sem enviar nenhuma mídia ao clicar em Cancelar', () => {
      // Act: cola a imagem e cancela a prévia
      colarImagemNoCompositor();
      cy.get('[data-testid="modal-paste-image"]').should('be.visible');
      cy.get('[data-testid="button-paste-image-cancel"]').click();

      // Assert: modal fechada e nenhuma requisição de envio de mídia disparada
      cy.get('[data-testid="modal-paste-image"]').should('not.exist');
      cy.get('@sendChatMediaMessage.all').should('have.length', 0);
    });

    it('3.4 deve cancelar o envio de uma imagem colada durante o upload, mantendo a modal de prévia aberta (front#489, PR #483)', () => {
      // Blindagem 100% mockada (AGENTS.md §3.2 [R-BLIND]): o atraso artificial que mantém o
      // upload "em andamento" não é reproduzível de forma determinística contra a API real.
      const originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);

      // Arrange: resposta de sucesso, mas atrasada — mantém o envio "em andamento" tempo
      // suficiente pra clicar em "Cancelar" antes do upload terminar
      AtendimentosMocks.interceptSendMediaMessageApi('*', 201, null, 5000);

      // Act: cola a imagem, confirma o envio pela modal
      colarImagemNoCompositor();
      cy.get('[data-testid="modal-paste-image"]').should('be.visible');
      cy.get('[data-testid="button-paste-image-send"]').click();

      // Act: durante o envio, o mesmo botão "Cancelar" da modal passa a cancelar o upload em
      // andamento (antes do envio começar, ele só fechava a modal — teste anterior)
      cy.get('[data-testid="button-paste-image-cancel"]').click();

      // Assert: a modal continua aberta com a imagem (não fecha, não é um erro) e nenhum envio
      // chega a se completar
      cy.get('[data-testid="modal-paste-image"]').should('be.visible');
      cy.get('[role="alert"]:visible').should('not.exist');

      cy.then(() => Cypress.env('USE_MOCKS', originalUseMocksState));
    });

    it('3.5 deve recusar localmente a imagem colada acima do teto de 5 MB, citando o limite, sem abrir a modal de prévia nem disparar o upload (front#595/PR #598)', () => {
      // O alias @sendChatMediaMessage já está registrado no beforeEach nos dois modos: a recusa é local, o POST não pode sair
      // Act: cola uma imagem de 1 byte acima do teto de 5 MB (5.242.881 bytes)
      colarImagemSinteticaNoCompositor(5 * 1024 * 1024 + 1);

      // Assert: aviso do teto na faixa do compositor, sem a modal de prévia e sem nenhuma requisição de mídia
      AtendimentosPage.elements.avisoLocalDeTamanho({ timeout: 10000 }).should('be.visible').and('have.text', 'Imagem acima do limite de 5 MB.');
      cy.get('[data-testid="modal-paste-image"]').should('not.exist');
      cy.get('@sendChatMediaMessage.all').should('have.length', 0);
    });

  });

});
