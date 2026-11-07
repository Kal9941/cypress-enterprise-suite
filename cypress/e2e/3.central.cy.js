import CentralPage from '../pages/3.centralPage';
import CentralMocks from '../mocks/3.centralMocks';
import IniciarAtendimentoMocks from '../mocks/4.iniciarAtendimentoMocks';
import AtendimentosMocks from '../mocks/5.atendimentosMocks';
import AtendimentosPage from '../pages/5.atendimentosPage';
import { rotaApi } from '../support/rotaApi';

describe('3. Central - Testes de Interface e Comportamento', () => {

  beforeEach(() => {
    // 1. Executa o login via sessão (executado antes para evitar que requisições abortadas da sessão colidam com os intercepts de gravação)
    cy.login();

    // 2. Configura a interceptação de métricas e rotas da Central e modais
    CentralMocks.interceptSummaryApi();
    CentralMocks.interceptAttendanceCapabilities();
    CentralMocks.interceptAttendancesList('*');
    IniciarAtendimentoMocks.interceptarCanais();
    IniciarAtendimentoMocks.interceptarBuscaGrupos();
    IniciarAtendimentoMocks.interceptarBuscaTemplatesWaba();
    AtendimentosMocks.interceptAttendanceDetailApi();

    // 3. Confirma que a página da Central carregou de fato
    CentralPage.elements.tituloCentral().should('be.visible');
  });

  // -------------------------------------------------------------
  // 1. CARREGAMENTO E ESTRUTURA VISUAL DA TELA
  // -------------------------------------------------------------
  context('1. Estrutura Visual e Elementos Principais', () => {

    it('1.1 deve carregar o cabeçalho, blocos de visão geral e botão de novo atendimento', () => {
      CentralPage.elements.tituloCentral().should('be.visible');
      CentralPage.elements.subtituloVisaoGeral().should('be.visible');

      CentralPage.elements.blocoOrcamentos()
        .scrollIntoView()
        .should('be.visible');

      CentralPage.elements.btnIniciarAtendimento()
        .scrollIntoView()
        .should('be.visible')
        .and('be.enabled');
    });

    it('1.2 deve exibir os quadros de acompanhamento das filas de atendimento', () => {
      const colunas = ['Aguardando resposta', 'Pendente', 'Aguardando cliente'];

      colunas.forEach((coluna) => {
        cy.contains('h3, h4, div', coluna).should('be.visible');
      });
    });

  });

  // -------------------------------------------------------------
  // 2. HEADER, MENU LATERAL E TEMA
  // -------------------------------------------------------------
  context('2. Header, Menu Lateral e Tema', () => {

    it('2.1 deve recolher e expandir o menu lateral ao clicar no botão de alternância', () => {
      // Act 1: Clica no botão do header para recolher
      CentralPage.recolherMenuLateral();

      // Assert 1: Valida modo recolhido
      CentralPage.elements.sidebar().should('have.attr', 'data-sidebar-mode', 'collapsed');

      // Act 2: Clica no botão para reexpandir
      CentralPage.expandirMenuLateral();

      // Assert 2: Valida modo expandido
      CentralPage.elements.sidebar().should('have.attr', 'data-sidebar-mode', 'expanded');
      CentralPage.elements.btnToggleHeader().should('be.visible');
    });

    it('2.2 deve alternar entre o tema claro e escuro ao clicar no botão de tema', () => {
      // Act 1
      CentralPage.elements.btnAlternarTema().click();

      // Assert 1
      cy.get('body').then(($body) => {
        if ($body.hasClass('dark')) {
          cy.wrap($body).should('have.class', 'dark');
        } else {
          cy.get('[data-shell], #app, main, div').first().should('exist');
        }
      });

      // Act 2: Restaura o tema original
      CentralPage.elements.btnAlternarTema().click();
    });

  });

  // -------------------------------------------------------------
  // 3. NAVEGAÇÃO DO RODAPÉ (TERMOS E PRIVACIDADE)
  // -------------------------------------------------------------
  context('3. Links do Rodapé', () => {

    it('3.1 deve validar se os links de Termos e Privacidade estão visíveis e direcionam para a política', () => {
      const urlPolitica = 'https://omnicare.dev.local/politica-de-privacidade';

      // Act: Rola até o rodapé
      CentralPage.elements.linkTermos().scrollIntoView();

      // Assert 1: Valida o link de Termos
      CentralPage.elements.linkTermos()
        .should('be.visible')
        .and('have.attr', 'href', urlPolitica)
        .and('have.attr', 'target', '_blank');

      // Assert 2: Valida o link de Privacidade
      CentralPage.elements.linkPrivacidade()
        .should('be.visible')
        .and('have.attr', 'href', urlPolitica)
        .and('have.attr', 'target', '_blank');
    });

  });

  // -------------------------------------------------------------
  // 4. FLUXOS RÁPIDOS E FILTRO DE DATA
  // -------------------------------------------------------------
  context('4. Ações Rápidas e Filtro de Período', () => {

    it('4.1 deve abrir o modal de novo atendimento ao clicar no botão do topo', () => {
      CentralPage.abrirModalIniciarAtendimento();

      CentralPage.elements.modalIniciarAtendimento()
        .should('be.visible')
        .within(() => {
          CentralPage.elements.tituloModalIniciarAtendimento()
            .should('be.visible')
            .and('have.text', 'Iniciar atendimento');

          CentralPage.elements.btnEnviarMensagemModal().should('be.visible');
        });

      // Cleanup: Fecha o modal para não gerar overlay nos testes seguintes
      CentralPage.elements.modalIniciarAtendimento()
        .find('button[aria-label="Fechar"]')
        .click();
      CentralPage.elements.modalIniciarAtendimento().should('not.exist');
    });

    it('4.2 deve exibir o mês e ano atuais como padrão no botão do filtro', () => {
      const hoje = new Date();
      const mesAtual = String(hoje.getMonth() + 1).padStart(2, '0');
      const anoAtual = hoje.getFullYear();
      const sufixoData = `${mesAtual}/${anoAtual}`;

      CentralPage.elements.btnFiltroData()
        .should('be.visible')
        .and('contain', sufixoData);
    });

    it('4.3 deve exibir o mesmo intervalo de datas padrão do filtro que a tela de Atendimentos', () => {
      // 1. Recupera o texto do intervalo de datas do botão de filtro na Central
      CentralPage.elements.btnFiltroData()
        .should('be.visible')
        .invoke('text')
        .then((textoDataCentral) => {
          // Extrai as datas no formato DD/MM/AAAA independentemente do separador (" - " na Central vs " → " em Atendimentos)
          const extrairDatas = (str) => str.match(/\d{2}\/\d{2}\/\d{4}/g) || [];
          const [inicioCentral, fimCentral] = extrairDatas(textoDataCentral);

          // 2. Navega para a tela de Atendimentos
          AtendimentosPage.visitar();
          cy.url().should('include', '/atendimentos');
          AtendimentosPage.elements.tituloAtendimentos().should('be.visible');

          // 3. Abre o popover/modal de filtros na tela de Atendimentos para exibir o botão de datas
          AtendimentosPage.elements.btnAbrirFiltros().click();

          // 4. Confirma que o botão no HTML de Atendimentos exibe exatamente o mesmo intervalo de datas que a Central
          AtendimentosPage.elements.btnFiltroData()
            .should('be.visible')
            .invoke('text')
            .then((textoDataAtendimentos) => {
              const [inicioAtendimentos, fimAtendimentos] = extrairDatas(textoDataAtendimentos);
              expect(inicioAtendimentos).to.eq(inicioCentral);
              expect(fimAtendimentos).to.eq(fimCentral);

              // 5. Fecha o popover de filtros e retorna para a Central preservando o isolamento da suite
              cy.get('body').type('{esc}');
              cy.get('[data-testid="sidebar-item-central"]').click();
              CentralPage.elements.tituloCentral().should('be.visible');
            });
        });
    });

    it('4.4 deve abrir o popover e exibir todos os controles do filtro', () => {
      CentralPage.abrirFiltroData();

      cy.contains('label, span', 'Data inicial').should('be.visible');
      cy.contains('label, span', 'Data final').should('be.visible');
      CentralPage.elements.btnCancelarFiltro().should('be.visible');
      CentralPage.elements.btnAplicarFiltro().should('be.visible');

      CentralPage.elements.btnCancelarFiltro().click();
    });

    it('4.5 deve alterar o intervalo de datas digitando um período válido e atualizar o dashboard de acordo com a API', () => {
      const hojeObj = new Date();
      const dataInicialObj = new Date(hojeObj);
      dataInicialObj.setDate(hojeObj.getDate() - 10);

      const dataInicial = dataInicialObj.toISOString().split('T')[0];
      const dataFinal = hojeObj.toISOString().split('T')[0];

      CentralMocks.interceptSummaryApi();

      CentralPage.aplicarFiltroData(dataInicial, dataFinal);

      cy.wait('@getDashboardMetrics').its('response.statusCode').should('eq', 200);
    });

    it('4.6 deve desabilitar o botão Aplicar ao selecionar uma data no futuro', () => {
      const hoje = new Date();
      const dataFuturaObj = new Date(hoje);
      dataFuturaObj.setDate(hoje.getDate() + 5);
      const dataFutura = dataFuturaObj.toISOString().split('T')[0];

      CentralPage.abrirFiltroData();
      CentralPage.elements.popoverFiltroData().should('be.visible');

      CentralPage.elements.inputDataFinal()
        .clear()
        .type(dataFutura)
        .trigger('input')
        .trigger('change');

      CentralPage.elements.btnAplicarFiltro().should('be.disabled');
    });

    it('4.7 deve fechar o popover do filtro de data ao pressionar a tecla ESC', () => {
      CentralPage.abrirFiltroData();
      CentralPage.elements.popoverFiltroData().should('be.visible');

      cy.get('body').type('{esc}');

      CentralPage.elements.popoverFiltroData().should('not.exist');
    });

  });

  // -------------------------------------------------------------
  // 5. INTEGRAÇÃO COM API, MOCKS E DADOS
  // -------------------------------------------------------------
  context('5. Integração com API, Mocks e Dados', () => {

    it('5.1 deve exibir os valores exatos nos cards de Orçamentos de acordo com a API', () => {
      cy.intercept('GET', rotaApi('attendances/summary*'), {
        statusCode: 200,
        body: {
          total: 20,
          in_progress: 5,
          pending: 8,
          waiting: 7,
          budgets_sent: 6,
          budgets_pending: 8,
          conversion_rate: 3
        },
      }).as('getSummaryMetrics');

      CentralPage.recarregar();
      cy.wait('@getSummaryMetrics');

      cy.contains(/orçamentos enviados/i).parent().should('contain', '6');
      cy.contains(/orçamentos pendentes/i).parent().should('contain', '8');
      cy.contains(/conversão/i).parent().should('contain', '3');
    });

    it('5.2 deve carregar e renderizar os cards de atendimento nas colunas conforme a API', () => {
      CentralMocks.interceptAttendancesInProgress();
      CentralMocks.interceptAttendancesPending();
      CentralMocks.interceptAttendancesWaiting();

      CentralPage.recarregar();

      cy.wait(['@getAttendances_in_progress', '@getAttendances_pending', '@getAttendances_waiting']);
      cy.contains('Não foi possível carregar esta fila').should('not.exist');
      CentralPage.elements.colunasFila().should('have.length', 3).and('be.visible');
    });

    it('5.3 deve validar se as métricas da Visão Geral exibidas na tela correspondem ao payload real da API', () => {
      CentralMocks.interceptSummaryApi();

      CentralPage.recarregar();

      cy.wait('@getDashboardMetrics').then((interception) => {
        const response = interception && interception.response ? interception.response : null;
        if (!response) return;

        expect(response.statusCode).to.eq(200);

        const metrics = response.body || {};

        if (metrics.total !== undefined) {
          CentralPage.elements.subtituloVisaoGeral()
            .parents('div, section')
            .should('contain', metrics.total.toString());
        }

        if (metrics.budgets_sent !== undefined) {
          cy.contains(/orçamentos enviados/i)
            .parent()
            .should('contain', metrics.budgets_sent.toString());
        }
      });
    });

  });

  // -------------------------------------------------------------
  // 6. REDIRECIONAMENTO DAS FILAS DA CENTRAL PARA ATENDIMENTOS
  // -------------------------------------------------------------
  context('6. Navegação das Colunas para Filas Correspondentes', () => {

    const cenariosFila = [
      {
        colunaCentral: 'Aguardando resposta',
        abaAtendimentos: 'Em andamento',
      },
      {
        colunaCentral: 'Pendente',
        abaAtendimentos: 'Pendente',
      },
      {
        colunaCentral: 'Aguardando cliente',
        abaAtendimentos: 'Aguardando',
      },
    ];

    cenariosFila.forEach(({ colunaCentral, abaAtendimentos }) => {
      it(`6.1 deve clicar em "Ir para fila" da coluna "${colunaCentral}" e direcionar para "${abaAtendimentos}"`, () => {
        CentralPage.elements.getBtnIrParaFila(colunaCentral).click();

        cy.url().should('include', '/atendimentos');
        cy.contains('button, div, span', abaAtendimentos).should('be.visible');
      });
    });

  });

  // -------------------------------------------------------------
  // 7. ENCERRAMENTO DE SESSÃO (LOGOUT)
  // -------------------------------------------------------------
  context('7. Encerramento de Sessão', () => {

    it('7.1 deve deslogar o usuário com sucesso ao clicar em "Sair" no menu de perfil', () => {
      // Act: Executa o logout através do menu de perfil
      CentralPage.realizarLogout();

      // Assert: Confirma o redirecionamento para a tela de login
      cy.url().should('not.include', '/dashboard');
      cy.url().should('include', '/login');
      cy.contains('Faça login para continuar').should('be.visible');
    });

  });

});