import { validarSchemaMock } from '../support/schemas';

/**
 * Classe Base para a Gestão de Mocks e Interceptações do Pharmacie Web.
 *
 * Implementa o Strategy Pattern para gerenciar a alternância entre:
 * 1. Modo 100% Mock (USE_MOCKS: true): responde instantaneamente com a fixture local (req.reply).
 * 2. Modo API Real (USE_MOCKS: false): permite a passagem para a rede (req.continue) e grava o payload retornado no disco via Auto-Sync.
 */
export default class BaseMock {
  /**
   * Verifica se o modo Mock está habilitado globalmente via variável de ambiente do Cypress
   * @returns {boolean}
   */
  isMockEnabled() {
    let useMocks = Cypress.env('USE_MOCKS');
    if (useMocks === undefined || useMocks === null) {
      try {
        const configEnv = require('../../env.json');
        useMocks = configEnv.USE_MOCKS;
      } catch (e) {
        useMocks = false;
      }
    }
    return useMocks === true || useMocks === 'true';
  }

  /**
   * Registra o payload capturado na memória para gravação automática em disco (cypress/fixtures/)
   * executada no hook global afterEach
   * @protected
   * @param {string} fixturePath Caminho relativo do arquivo JSON dentro de cypress/fixtures/
   * @param {object} body Corpo da resposta HTTP retornado pela API real
   */
  _saveFixture(fixturePath, body) {
    if (!fixturePath) return;
    const current = Cypress.env('CAPTURED_FIXTURES') || {};
    current[fixturePath] = body;
    Cypress.env('CAPTURED_FIXTURES', current);
  }

  /**
   * Intercepta uma rota HTTP aplicando o comportamento adequado (Mock Hermético vs Rede Real com Auto-Sync)
   * 
   * @param {object} params
   * @param {string} params.method Verbo HTTP da rota ('GET', 'POST', 'PATCH', 'DELETE', etc.)
   * @param {string|RegExp} params.urlPattern Padrão de URL a interceptar (glob ou regex)
   * @param {object|null} [params.customPayload=null] Payload customizado explícito fornecido pelo teste
   * @param {object|null} [params.defaultBody=null] Fixture padrão a ser usada no Modo Mock
   * @param {string|null} [params.fixturePath=null] Caminho relativo para Auto-Sync em disco
   * @param {string} params.alias Nome do alias Cypress (sem o prefixo '@')
   * @param {number} [params.statusCode=200] Código de status HTTP a retornar
   */
  interceptRoute({
    method,
    urlPattern,
    customPayload = null,
    defaultBody = null,
    fixturePath = null,
    alias,
    statusCode = 200
  }) {
    // 1. Se um payload customizado explícito foi passado no teste, ele tem precedência absoluta
    if (customPayload !== null && customPayload !== undefined) {
      // Corpo de erro (4xx/5xx) não segue o DTO de sucesso: só a resposta 2xx é validada
      if (statusCode >= 200 && statusCode < 300) validarSchemaMock(this.constructor.name, alias, customPayload);
      if (customPayload.capabilities) {
        if (alias === 'getAttendanceCapabilities') Cypress.env('LAST_ATTENDANCE_CAPABILITIES', customPayload.capabilities);
        else Cypress.env('LAST_ATTENDANCE_ITEM_CAPABILITIES', customPayload.capabilities);
      }
      cy.intercept(method, urlPattern, {
        statusCode: statusCode,
        body: customPayload
      }).as(alias);
      return;
    }

    // 2. Se o modo 100% Mock estiver ativado, responde imediatamente com a fixture padrão
    if (this.isMockEnabled()) {
      if (statusCode >= 200 && statusCode < 300) validarSchemaMock(this.constructor.name, alias, defaultBody);
      if (defaultBody?.capabilities) {
        if (alias === 'getAttendanceCapabilities') Cypress.env('LAST_ATTENDANCE_CAPABILITIES', defaultBody.capabilities);
        else Cypress.env('LAST_ATTENDANCE_ITEM_CAPABILITIES', defaultBody.capabilities);
      }
      cy.intercept(method, urlPattern, {
        statusCode: statusCode,
        body: defaultBody
      }).as(alias);
    } else {
      // 3. Modo API Real: deixa a requisição passar para o backend e captura o payload para o Auto-Sync
      const isAutoSync = Cypress.env('AUTO_SYNC_MOCKS') === true || Cypress.env('AUTO_SYNC_MOCKS') === 'true';

      cy.intercept(method, urlPattern, (req) => {
        req.continue((res) => {
          if (res && res.body) {
            let body = res.body;
            if (typeof body === 'string') {
              try {
                body = JSON.parse(body);
              } catch (e) {}
            }
            if (body && body.capabilities) {
              if (alias === 'getAttendanceCapabilities') Cypress.env('LAST_ATTENDANCE_CAPABILITIES', body.capabilities);
              else Cypress.env('LAST_ATTENDANCE_ITEM_CAPABILITIES', body.capabilities);
            }
            if (isAutoSync && fixturePath && res.statusCode >= 200 && res.statusCode < 300) {
              this._saveFixture(fixturePath, res.body);
            }
          }
        });
      }).as(alias);
    }
  }
}
