import LoginPage from '../pages/2.loginPage';
import LoginMocks from '../mocks/2.loginMocks';
import CentralPage from '../pages/3.centralPage';
import CentralMocks from '../mocks/3.centralMocks';
import { rotaApi } from '../support/rotaApi';

describe('2. Tela de login - OmniCare Web', () => {

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  context('1. Autenticação, Validações de Formulário e Navegação', () => {

    it('1.1 deve realizar login com credenciais válidas', () => {
      // Act
      cy.login(); // Executa via custom command com suporte agnóstico (API Real / Mock)

      // Assert
      cy.url().should('include', '/dashboard');
    });

    it('1.2 deve exibir mensagem de erro ao tentar login com CNPJ inválido', () => {
      const usuarioValido = Cypress.env('user');
      const senhaValida = Cypress.env('userPassword');

      // Arrange: Se estiver em modo mock, intercepta o retorno 422 (contrato real: message + errors.cnpj)
      if (LoginMocks.isMockEnabled()) {
        LoginMocks.interceptAuthLoginCnpjInvalido();
      }

      // Act
      cy.login('00.000.000/0000-01', usuarioValido, senhaValida, false);

      // Assert
      cy.contains('Campos obrigatórios não informados').should('be.visible');
      cy.contains('O CNPJ informado é inválido.').should('be.visible');
    });

    it('1.3 deve exibir mensagem de erro ao tentar login com senha inválida', () => {
      const cnpjValido = Cypress.env('userCnpj');
      const usuarioValido = Cypress.env('user');

      // Arrange: Se estiver em modo mock, intercepta o retorno 401
      if (LoginMocks.isMockEnabled()) {
        LoginMocks.interceptAuthLoginInvalidCredentials();
      }

      // Act
      cy.login(cnpjValido, usuarioValido, 'senha_invalida', false);

      // Assert
      cy.contains('Credenciais inválidas').should('be.visible');
    });

    it('1.4 deve exibir mensagem de erro ao tentar login com usuário inválido', () => {
      const cnpjValido = Cypress.env('userCnpj');
      const senhaValida = Cypress.env('userPassword');

      // Arrange: Se estiver em modo mock, intercepta o retorno 401
      if (LoginMocks.isMockEnabled()) {
        LoginMocks.interceptAuthLoginInvalidCredentials();
      }

      // Act
      cy.login(cnpjValido, '9999', senhaValida, false);

      // Assert
      cy.contains('Credenciais inválidas').should('be.visible');
    });

    it('1.5 deve exibir validações para todos os campos ao submeter formulário vazio', () => {
      // Act
      LoginPage.visitar();
      LoginPage.submeterFormulario();

      // Assert
      cy.contains('Campos obrigatórios').should('be.visible');
      cy.contains('Informe o CNPJ.').should('be.visible');
      cy.contains('Informe o código numérico do usuário.').should('be.visible');
      cy.contains('Informe sua senha.').should('be.visible');
    });

    it('1.6 deve aplicar a máscara de CNPJ automaticamente ao digitar apenas números', () => {
      // Act
      LoginPage.visitar();
      LoginPage.elements.inputCnpj().type('11111111111111');

      // Assert
      LoginPage.elements.inputCnpj().should('have.value', '11.111.111/1111-11');
    });

    it('1.7 deve alternar a visibilidade da senha ao clicar no ícone de olho', () => {
      LoginPage.visitar();
      const senhaValida = Cypress.env('userPassword');
      LoginPage.preencherSenha(senhaValida);

      // Assert Inicial: Campo protegido
      LoginPage.elements.inputSenha().should('have.attr', 'type', 'password');

      // Act 1: Revela a senha
      LoginPage.elements.btnMostrarSenha().click();

      // Assert 1: Tipo altera para text
      LoginPage.elements.inputSenha().should('have.attr', 'type', 'text');

      // Act 2: Oculta a senha novamente
      LoginPage.elements.btnOcultarSenha().click();

      // Assert 2: Retorna para password
      LoginPage.elements.inputSenha().should('have.attr', 'type', 'password');
    });

    it('1.8 deve impedir a digitação de letras e caracteres especiais no campo de usuário', () => {
      LoginPage.visitar();

      // Act 1 & Assert 1
      LoginPage.elements.inputUsuario().type('abc@#$');
      LoginPage.elements.inputUsuario().should('have.value', '');

      // Act 2 & Assert 2
      LoginPage.elements.inputUsuario().clear().type('12a3b4');
      LoginPage.elements.inputUsuario().should('have.value', '1234');
    });

    it('1.9 deve formatar o CNPJ aceitando letras/números e bloqueando caracteres especiais (Formato Alfanumérico)', () => {
      LoginPage.visitar();

      // Act 1: Tenta digitar apenas caracteres especiais (deve bloquear e ficar vazio)
      LoginPage.elements.inputCnpj().type('@#$!%');
      LoginPage.elements.inputCnpj().should('have.value', '');

      // Act 2: Digita letras minúsculas, números e caracteres especiais misturados
      // Esperado: Limpar especiais, converter minúsculas para maiúsculas e aplicar a máscara XX.XXX.XXX/XXXX-XX
      LoginPage.elements.inputCnpj().clear().type('12abc345000101@#$');

      // 12.ABC.345/0001-01
      LoginPage.elements.inputCnpj().should('have.value', '12.ABC.345/0001-01');

      // Act 3: Limite de 14 caracteres úteis (tenta digitar 15+ caracteres)
      LoginPage.elements.inputCnpj().clear().type('12ABC3450001019999');
      LoginPage.elements.inputCnpj().should('have.value', '12.ABC.345/0001-01');
    });

    it('1.10 deve persistir o valor do CNPJ ao marcar a opção "Salvar CNPJ"', () => {
      LoginPage.visitar();
      const cnpjParaSalvar = '11.111.111/1111-11';

      // Act 1
      LoginPage.elements.inputCnpj().type(cnpjParaSalvar);
      LoginPage.elements.labelSalvarCnpj().click();

      // Assert 1
      LoginPage.elements.checkboxSalvarCnpj().should('be.checked');

      // Act 2: Recarrega a página
      cy.reload();

      // Assert 2
      LoginPage.elements.inputCnpj().should('have.value', cnpjParaSalvar);
    });

    it('1.11 deve exibir todos os elementos principais do formulário de login ao carregar a tela', () => {
      LoginPage.visitar();

      LoginPage.elements.inputCnpj().should('be.visible');
      LoginPage.elements.inputUsuario().should('be.visible');
      LoginPage.elements.inputSenha().should('be.visible');
      LoginPage.elements.btnSubmit().should('be.visible');
      LoginPage.elements.btnMostrarSenha().should('be.visible');
      LoginPage.elements.checkboxSalvarCnpj().should('be.visible');
      LoginPage.elements.labelSalvarCnpj().should('be.visible');
    });

  });

  context('2. Validação de Limite Máximo de Caracteres', () => {

    it('2.1 deve limitar o campo de CNPJ em 18 caracteres (Máscara)', () => {
      LoginPage.visitar();
      const cnpjComExcesso = '1111111111111199999';

      LoginPage.elements.inputCnpj().type(cnpjComExcesso);

      LoginPage.elements.inputCnpj().should(($input) => {
        expect($input.val().length).to.be.at.most(18);
      });
    });

    it('2.2 deve limitar a quantidade de caracteres no campo de Usuário em 10 caracteres', () => {
      LoginPage.visitar();
      const usuarioLongo = '1'.repeat(11);

      LoginPage.elements.inputUsuario().clear().type(usuarioLongo);

      LoginPage.elements.inputUsuario()
        .invoke('val')
        .then((valorFinal) => {
          expect(valorFinal.length).to.be.lessThan(usuarioLongo.length);
        });
    });

    it('2.3 deve limitar a quantidade de caracteres no campo de Senha em 100 caracteres', () => {
      LoginPage.visitar();
      const senhaLonga = 'A'.repeat(101);

      LoginPage.elements.inputSenha().clear().type(senhaLonga);

      LoginPage.elements.inputSenha()
        .invoke('val')
        .then((valorFinal) => {
          expect(valorFinal.length).to.be.lessThan(senhaLonga.length);
        });
    });

  });

  // -------------------------------------------------------------
  // SESSÃO EXPIRADA (401 GLOBAL) — PR #477
  // -------------------------------------------------------------
  // Gatilho: após o login, corrompe o token em sessionStorage (mesma técnica do "Como testar" da
  // PR, sem esperar as 14h reais de validade). Em API real isso basta - medido em 2026-09-29:
  // o dashboard já tem chamadas autenticadas de fundo (poll/SSE) que rejeitam o token corrompido
  // em poucos segundos, sem nenhuma ação explícita, então as asserções finais só aguardam com
  // retry. Em modo mock as rotas não validam o token (respondem 200 fixo) - é preciso forçar 1
  // requisição real: troca o intervalo do filtro de período do dashboard (cache-miss garantido
  // do React Query) e sobrepõe só o clique em "Aplicar" com um 401 pontual.
  context('3. Sessão Expirada (401 global)', () => {

    function dispararRequisicaoAutenticadaComTokenInvalido() {
      if (!CentralMocks.isMockEnabled()) return;

      const hojeObj = new Date();
      const dataInicialObj = new Date(hojeObj);
      dataInicialObj.setDate(hojeObj.getDate() - 10);
      const dataInicial = dataInicialObj.toISOString().split('T')[0];
      const dataFinal = hojeObj.toISOString().split('T')[0];

      // Abre o popover e preenche as datas com os mocks padrão (200) ainda em vigor - só troca
      // para o 401 imediatamente antes do clique em "Aplicar", que é a requisição que precisa
      // simular a sessão expirada (registrar o override mais cedo arrisca capturar um poll de
      // fundo do dashboard e redirecionar para /login antes do popover terminar de abrir).
      CentralPage.abrirFiltroData();
      CentralPage.elements.popoverFiltroData().should('be.visible');
      CentralPage.elements.inputDataInicial().clear().type(dataInicial);
      CentralPage.elements.inputDataFinal().clear().type(dataFinal);

      cy.intercept('GET', rotaApi('attendances/summary*'), {
        statusCode: 401,
        body: { message: 'Unauthorized' }
      }).as('getDashboardMetrics401');

      CentralPage.elements.btnAplicarFiltro().click();
    }

    it('3.1 deve exibir "Sessão expirada. Faça login novamente." e redirecionar para /login ao receber 401 numa requisição autenticada', () => {
      cy.login();
      LoginPage.corromperTokenSessao();
      dispararRequisicaoAutenticadaComTokenInvalido();

      cy.url({ timeout: 15000 }).should('include', '/login');
      cy.contains('Sessão expirada. Faça login novamente.').should('be.visible');
    });

    it('3.2 deve ocultar o aviso de sessão expirada e exibir "Campos obrigatórios" ao tentar entrar com os campos vazios', () => {
      cy.login();
      LoginPage.corromperTokenSessao();
      dispararRequisicaoAutenticadaComTokenInvalido();
      cy.url({ timeout: 15000 }).should('include', '/login');
      cy.contains('Sessão expirada. Faça login novamente.').should('be.visible');

      // Act: submete o formulário vazio - o dismiss do aviso é síncrono ao clique, antes de
      // qualquer validação (achado no código-fonte: handleSubmit chama dismissSessionExpired()
      // tanto no caminho de sucesso quanto no de validação vazia)
      LoginPage.submeterFormulario();

      cy.contains('Sessão expirada. Faça login novamente.').should('not.exist');
      cy.contains('Campos obrigatórios').should('be.visible');
    });

    it('3.3 não deve reexibir o aviso de sessão expirada durante o fluxo de credenciais inválidas', () => {
      cy.login();
      LoginPage.corromperTokenSessao();
      dispararRequisicaoAutenticadaComTokenInvalido();
      cy.url({ timeout: 15000 }).should('include', '/login');
      cy.contains('Sessão expirada. Faça login novamente.').should('be.visible');

      // Arrange: se estiver em modo mock, intercepta o retorno 401 de credenciais inválidas
      if (LoginMocks.isMockEnabled()) {
        LoginMocks.interceptAuthLoginInvalidCredentials();
      }

      // Act: preenche credenciais válidas de usuário com senha errada e submete
      LoginPage.preencherCnpj(Cypress.env('userCnpj'));
      LoginPage.preencherUsuario(Cypress.env('user'));
      LoginPage.preencherSenha('senha_invalida_teste_e2e');
      LoginPage.submeterFormulario();

      // Assert: erro de credenciais aparece e o aviso de sessão expirada não volta em nenhum momento
      cy.contains('Credenciais inválidas').should('be.visible');
      cy.contains('Sessão expirada. Faça login novamente.').should('not.exist');
    });

    it('3.4 não deve exibir o aviso de sessão expirada ao sair pelo menu da conta', () => {
      // Logout explícito (menu "Sair") nunca passa pelo handler global de 401 - não precisa
      // corromper o token para provar que o aviso não aparece nesse fluxo.
      cy.login();
      CentralPage.realizarLogout();

      cy.url().should('include', '/login');
      cy.contains('Sessão expirada. Faça login novamente.').should('not.exist');
    });

    // Corrigido (Issue cypress#017, achado do operador em 2026-10-01): a intermitência NÃO era uma
    // corrida real no boot da SPA (hipótese anterior registrada em 2026-09-29, já corrigida uma vez
    // - ver ROADMAP.md Log) - era a ordem dos comandos do próprio teste. Corromper o token com
    // `cy.login()` + `LoginPage.corromperTokenSessao()` e só depois `cy.reload()` deixava, entre os
    // dois passos, o dashboard disparando requisições autenticadas (capabilities/summary/fila/
    // polling, o SSE forçado a 403 em `cypress/support/e2e.js`) ainda em voo: se uma dessas
    // respondesse 401 ANTES do reload, o front já mostrava o aviso e limpava o token - mas o aviso é
    // estado em memória, não sobrevive ao F5, e sem token não há novo `GET /users/me` para trazê-lo
    // de volta (timeout). Se o `cy.reload()` vencesse a corrida, o token corrompido ainda estava no
    // `sessionStorage` no boot e o aviso aparecia em < 250ms (verde). Fix: corromper o token via
    // `onBeforeLoad` do próprio `cy.visit()`, antes de qualquer código do app rodar - elimina o
    // estado intermediário "token válido, app rodando" contra o qual o reload competia. `timeout:
    // 20000` deixou de ser necessário (não há mais corrida a esperar).
    it('3.5 deve manter o aviso de sessão expirada ao recarregar a página com o token inválido', () => {
      cy.login();

      // O boot da SPA revalida a sessão via GET /users/me - simula a rejeição dessa validação
      if (LoginMocks.isMockEnabled()) {
        cy.intercept('GET', '**/users/me', {
          statusCode: 401,
          body: { message: 'Unauthorized' }
        }).as('getUserMe401');
      }

      cy.window().then((win) => {
        const tokenAtual = win.sessionStorage.getItem('omnicare_access_token');
        cy.visit('/', {
          onBeforeLoad(w) {
            w.sessionStorage.setItem('omnicare_access_token', `${tokenAtual}_invalido_e2e`);
          }
        });
      });

      cy.url({ timeout: 15000 }).should('include', '/login');
      cy.contains('Sessão expirada. Faça login novamente.').should('be.visible');
    });

    // PR #513 (Issue front#493): antes, o boot lia loja/farmácia das claims de um token ainda não
    // validado e disparava GET /resources em paralelo ao /users/me - motivo suspeito da
    // instabilidade de 5-20s só no Chrome relatada na issue (2 chamadas 401 concorrentes no boot, não
    // 1). Agora, sem perfil confirmado, o escopo é nulo e esse pedido só sai depois que o /users/me
    // responde com sucesso - com token inválido, nunca deveria disparar.
    it('3.6 deve chamar GET /resources somente após o /users/me responder com sucesso, nunca em paralelo com claims de um token não validado, ao recarregar com token inválido (Issue front#493/PR #513)', () => {
      cy.login();
      // Espera o boot do dashboard (login válido) assentar antes de registrar o tracking do
      // reload seguinte - sem isso, a própria chamada legítima de /resources deste cy.login()
      // (token válido) ainda em voo no momento do registro do intercept pode ser capturada pelo
      // alias abaixo, sendo confundida com uma chamada do boot com token inválido (mesma classe de
      // corrida de comandos já corrigida na Issue cypress#017).
      CentralPage.elements.tituloCentral().should('be.visible');

      if (LoginMocks.isMockEnabled()) {
        cy.intercept('GET', '**/users/me', {
          statusCode: 401,
          body: { message: 'Unauthorized' }
        }).as('getUserMe401');
      }
      cy.intercept('GET', rotaApi('resources*'), (req) => req.continue()).as('getResourcesDuranteBoot');

      cy.window().then((win) => {
        const tokenAtual = win.sessionStorage.getItem('omnicare_access_token');
        cy.visit('/', {
          onBeforeLoad(w) {
            w.sessionStorage.setItem('omnicare_access_token', `${tokenAtual}_invalido_e2e`);
          }
        });
      });

      cy.url({ timeout: 15000 }).should('include', '/login');
      cy.contains('Sessão expirada. Faça login novamente.').should('be.visible');

      cy.get('@getResourcesDuranteBoot.all').should('have.length', 0);
    });

  });

  context('4. Falha Transitória na Restauração de Sessão (Issue front#474, PR #476)', () => {
    let originalUseMocksState;

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
    });

    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    function tokenSessao() {
      return cy.window().then((win) => win.sessionStorage.getItem('omnicare_access_token'));
    }

    function validarTelaDeErroExibida() {
      cy.get('[data-testid="panel-session-restore-error"]', { timeout: 20000 }).should('be.visible');
      cy.contains('Não foi possível validar sua sessão').should('be.visible');
      cy.contains('Sua sessão continua ativa.').should('be.visible');
      cy.contains('Sessão expirada. Faça login novamente.').should('not.exist');
      cy.url().should('not.include', '/login');
    }

    [
      { rotulo: 'rede instável', registrarFalha: () => LoginMocks.interceptUserMeFalhaDeRede() },
      { rotulo: 'timeout acima do prazo interno do front (15s)', registrarFalha: () => LoginMocks.interceptUserMeTimeout() },
      { rotulo: '5xx do servidor', registrarFalha: () => LoginMocks.interceptUserMeComStatus(500) }
    ].forEach(({ rotulo, registrarFalha }) => {
      it(`4.1 deve exibir a tela "Não foi possível validar sua sessão" preservando a sessão e a URL quando o /users/me falha por ${rotulo}`, function () {
        cy.login();
        let tokenAntes;
        tokenSessao().then((t) => { tokenAntes = t; });

        registrarFalha();
        cy.reload();

        validarTelaDeErroExibida();

        tokenSessao().then((tokenDepois) => {
          expect(tokenDepois, 'token de sessão preservado após falha transitória').to.eq(tokenAntes);
        });
      });
    });

    [403, 404].forEach((statusCode) => {
      it(`4.2 deve limpar a sessão e ir para o login quando o /users/me responde ${statusCode} (comportamento antigo mantido)`, () => {
        cy.login();
        LoginMocks.interceptUserMeComStatus(statusCode);
        cy.reload();

        cy.url({ timeout: 15000 }).should('include', '/login');
        cy.get('[data-testid="panel-session-restore-error"]').should('not.exist');
        tokenSessao().then((token) => {
          expect(token, 'sessão limpa após rejeição definitiva do /users/me').to.be.null;
        });
      });
    });

    it('4.3 deve entrar direto no app ao clicar em "Tentar novamente" depois que a rede volta, sem passar pelo login', () => {
      cy.login();
      const controleFalha = LoginMocks.interceptUserMeComFalhaAlternavel();
      cy.reload();
      validarTelaDeErroExibida();

      cy.then(() => controleFalha.liberar());
      cy.get('[data-testid="button-session-restore-retry"]').click();

      cy.get('[data-testid="panel-session-restore-error"]', { timeout: 15000 }).should('not.exist');
      cy.url().should('not.include', '/login');
    });

    it('4.4 deve entrar sozinho, sem clique, quando o navegador dispara o evento "online" com a tela de erro aberta', () => {
      cy.login();
      const controleFalha = LoginMocks.interceptUserMeComFalhaAlternavel();
      cy.reload();
      validarTelaDeErroExibida();

      cy.then(() => controleFalha.liberar())
        .window().then((win) => win.dispatchEvent(new Event('online')));

      cy.get('[data-testid="panel-session-restore-error"]', { timeout: 15000 }).should('not.exist');
      cy.url().should('not.include', '/login');
    });

    it('4.5 deve ir para o login ao clicar em "Sair" na tela de restauração de sessão', () => {
      cy.login();
      LoginMocks.interceptUserMeFalhaDeRede();
      cy.reload();
      validarTelaDeErroExibida();

      cy.get('[data-testid="button-session-restore-logout"]').click();

      cy.url({ timeout: 15000 }).should('include', '/login');
    });

  });

});