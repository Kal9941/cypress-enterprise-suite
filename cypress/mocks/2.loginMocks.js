import BaseMock from './BaseMock';
import mockAuthLoginSuccess from '../fixtures/2.login/authLoginSuccess.json';
import mockUserMeData from '../fixtures/2.login/userMe.json';

const configEnv = require('../../env.json');

/**
 * Classe responsável pela centralização de Mocks, Payloads e Interceptações de API
 * para a tela de Login e Autenticação do OmniCare Web.
 * 
 * Estende BaseMock com suporte ao Strategy Pattern (Mock Hermético vs API Real Auto-Sync).
 */
class LoginMocks extends BaseMock {
  // -------------------------------------------------------------
  // DADOS DE MOCK PADRÃO (CARREGADOS DE CYPRESS/FIXTURES/)
  // -------------------------------------------------------------

  mockAuthLoginSuccess = mockAuthLoginSuccess;
  mockUserMeData = mockUserMeData;

  mockAuthLoginInvalidCredentials = {
    message: "Credenciais inválidas",
    statusCode: 401
  };

  // Contrato real confirmado pelo operador em 2026-09-26 (POST /auth/login, 422 Unprocessable Content)
  mockAuthLoginCnpjInvalido = {
    message: "Campos obrigatórios não informados",
    errors: {
      cnpj: ["O CNPJ informado é inválido."]
    }
  };

  // -------------------------------------------------------------
  // MÉTODOS DE INTERCEPTAÇÃO DE API (CY.INTERCEPT)
  // -------------------------------------------------------------

  /**
   * Intercepta a rota de autenticação (/auth/login)
   * @param {object|null} customPayload Payload customizado opcional
   * @param {number} statusCode Código de status HTTP (padrão: 200)
   */
  interceptAuthLogin(customPayload = null, statusCode = 200) {
    this.interceptRoute({
      method: 'POST',
      urlPattern: '**/auth/login',
      customPayload,
      defaultBody: this.mockAuthLoginSuccess,
      fixturePath: '2.login/authLoginSuccess.json',
      alias: 'authLogin',
      statusCode
    });
  }

  /**
   * Intercepta a rota de autenticação simulando falha de credenciais inválidas (401)
   * @param {object|null} customPayload Payload de erro customizado opcional
   */
  interceptAuthLoginInvalidCredentials(customPayload = this.mockAuthLoginInvalidCredentials) {
    cy.intercept('POST', '**/auth/login', {
      statusCode: 401,
      body: customPayload
    }).as('authLoginInvalid');
  }

  /**
   * Intercepta a rota de autenticação simulando CNPJ malformado (422 Unprocessable Content)
   * @param {object|null} customPayload Payload de erro customizado opcional
   */
  interceptAuthLoginCnpjInvalido(customPayload = this.mockAuthLoginCnpjInvalido) {
    cy.intercept('POST', '**/auth/login', {
      statusCode: 422,
      body: customPayload
    }).as('authLoginCnpjInvalido');
  }

  /**
   * Intercepta a rota de dados do usuário autenticado (/users/me)
   * @param {object|null} customPayload Payload customizado opcional
   */
  interceptUserMe(customPayload = null) {
    const userCode = Cypress.env('USER_CODE') || Cypress.env('user') || configEnv.USER_CODE || "122";
    const userCnpj = Cypress.env('USER_CNPJ') || Cypress.env('userCnpj') || configEnv.USER_CNPJ || "11111111111111";
    const clientName = Cypress.env('DEFAULT_CLIENT_NAME') || configEnv.DEFAULT_CLIENT_NAME || "klismam";
    const displayName = clientName.toUpperCase();

    const dynamicUserMe = {
      ...this.mockUserMeData,
      id: parseInt(userCode, 10) || 122,
      user_id: parseInt(userCode, 10) || 122,
      cnpj: userCnpj,
      display_name: displayName,
      profile: displayName.replace(/\s+/g, '')
    };

    this.interceptRoute({
      method: 'GET',
      urlPattern: '**/users/me',
      customPayload,
      defaultBody: dynamicUserMe,
      fixturePath: '2.login/userMe.json',
      alias: 'getUserMe'
    });
  }

  /**
   * Intercepta `/users/me` simulando uma queda de rede real (sem status HTTP algum) - usado
   * para testar a tela de restauração de sessão (Issue front#474, PR #476): falha transitória
   * preserva a sessão e mostra `panel-session-restore-error`, diferente de 401/403/404 que
   * limpam a sessão e vão para o login.
   */
  interceptUserMeFalhaDeRede() {
    cy.intercept('GET', '**/users/me', { forceNetworkError: true }).as('getUserMe');
  }

  /**
   * Nunca responde dentro da janela do teste - simula o fetch de `/users/me` estourando o
   * prazo interno do front (`DEFAULT_FETCH_TIMEOUT_MS` = 15s, Issue front#474/PR #476).
   */
  interceptUserMeTimeout() {
    cy.intercept('GET', '**/users/me', { delay: 999999, statusCode: 200, body: this.mockUserMeData }).as('getUserMe');
  }

  /**
   * Intercepta `/users/me` devolvendo um status HTTP específico (500, 403, 404...) - usado
   * para testar a tela de restauração de sessão (Issue front#474, PR #476).
   * @param {number} statusCode Código HTTP a devolver
   */
  interceptUserMeComStatus(statusCode) {
    cy.intercept('GET', '**/users/me', { statusCode, body: { message: 'Erro simulado' } }).as('getUserMe');
  }

  /**
   * Alterna `/users/me` entre falha (rede real) e sucesso: começa falhando e passa a responder
   * normalmente assim que `liberar()` é chamado - usado para testar o botão "Tentar novamente"
   * da tela de restauração de sessão (Issue front#474, PR #476).
   * @returns {{liberar: function}} `liberar()` destrava a resposta normal a partir da próxima chamada
   */
  interceptUserMeComFalhaAlternavel() {
    let liberado = false;
    cy.intercept('GET', '**/users/me', (req) => {
      if (liberado) {
        req.continue();
      } else {
        req.reply({ forceNetworkError: true });
      }
    }).as('getUserMe');
    return { liberar: () => { liberado = true; } };
  }

  /**
   * Gera um token JWT sintético válido com data de expiração futura (1 ano)
   * permitindo que o frontend SPA decodifique a sessão sem rejeição por expiração
   * @param {object} customPayload Objeto de sobreposição do payload JWT
   * @returns {string} Token no formato header.payload.signature
   */
  gerarMockToken(customPayload = {}) {
    const header = { alg: "HS384", typ: "JWT" };
    const nowSec = Math.floor(Date.now() / 1000);
    const userCode = Cypress.env('USER_CODE') || Cypress.env('user') || configEnv.USER_CODE || "122";
    const userCnpj = Cypress.env('USER_CNPJ') || Cypress.env('userCnpj') || configEnv.USER_CNPJ || "11111111111111";
    const clientName = Cypress.env('DEFAULT_CLIENT_NAME') || configEnv.DEFAULT_CLIENT_NAME || "klismam";
    const displayName = clientName.toUpperCase();

    const payload = {
      sub: displayName.replace(/\s+/g, ''),
      user_id: parseInt(userCode, 10) || 122,
      cnpj: userCnpj,
      profile: displayName.replace(/\s+/g, ''),
      display_name: displayName,
      company_code: 10199,
      store_code: 1,
      iat: nowSec,
      exp: nowSec + (60 * 60 * 24 * 365), // 1 ano de validade
      ...customPayload
    };

    const toB64Url = (obj) => {
      const jsonStr = JSON.stringify(obj);
      const b64 = typeof btoa === 'function'
        ? btoa(unescape(encodeURIComponent(jsonStr)))
        : Buffer.from(jsonStr).toString('base64');
      return b64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    };

    return `${toB64Url(header)}.${toB64Url(payload)}.mock_signature_OmniCare_web`;
  }

  /**
   * Configura os intercepts essenciais de autenticação no modo Mock
   */
  setupMockAuthSession() {
    const token = this.gerarMockToken();
    const mockAuthSuccess = {
      access_token: token,
      token: token
    };
    this.interceptAuthLogin(mockAuthSuccess);
    this.interceptUserMe();
  }

  /**
   * Remove os mocks para permitir que os testes interajam com a rede real
   */
  clearMocksForRealE2ETests() {
    cy.intercept('POST', '**/auth/login', (req) => req.continue()).as('authLogin');
    cy.intercept('GET', '**/users/me', (req) => req.continue()).as('getUserMe');
  }
}

export default new LoginMocks();
