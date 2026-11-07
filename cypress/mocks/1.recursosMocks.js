import BaseMock from './BaseMock';
import mockResourcesData from '../fixtures/1.recursos/resources.json';
import { rotaApi } from '../support/rotaApi';

/**
 * Classe responsável pela centralização de Mocks e Interceptações do Eixo de Recursos
 * da Farmácia (GET /resources - PR #309).
 * 
 * Permite simular dinamicamente o catálogo de módulos contratados pela farmácia
 * (sidebar na interseção, guarda de rota direta, redirecionamento pós-login e estado terminal).
 */
class RecursosMocks extends BaseMock {
  // Baseline canônico dos 11 slugs da API
  defaultResources = mockResourcesData.resources || {
    central: true,
    attendance: true,
    prescription: true,
    patient: true,
    prescriber: false,
    resale: false,
    redo: false,
    delivery: false,
    financial: false,
    metrics: false,
    report: false
  };

  /**
   * Intercepta a rota de recursos da loja (GET /resources)
   * permitindo sobrescrever chaves específicas ou todo o mapa de recursos.
   * Quando chamado sem argumentos (customResources = null), habilita Auto-Sync
   * gravando a resposta da API real em cypress/fixtures/1.recursos/resources.json.
   * 
   * @param {object|null} customResources Objeto parcial com overrides dos slugs
   * @param {number} statusCode Código HTTP da resposta (default 200)
   */
  interceptResources(customResources = null, statusCode = 200) {
    let payloadResources = { ...this.defaultResources };

    if (customResources) {
      payloadResources = { ...payloadResources, ...customResources };
    }

    // O backend responde o recurso `patient` e o novo `customer` ao mesmo tempo (renomeação em andamento, backend commit cc16a9c de 2026-10-27, medido em 2026-10-28):
    // o front da `developer` lê `customer` e o da `main` ainda lê `patient`. Os dois andam juntos, a menos que o teste informe os dois.
    const temPatient = Boolean(customResources) && 'patient' in customResources;
    const temCustomer = Boolean(customResources) && 'customer' in customResources;
    if (temPatient && !temCustomer) payloadResources.customer = payloadResources.patient;
    if (temCustomer && !temPatient) payloadResources.patient = payloadResources.customer;
    if (!('customer' in payloadResources)) payloadResources.customer = payloadResources.patient;

    this.interceptRoute({
      method: 'GET',
      urlPattern: rotaApi('resources*'),
      customPayload: customResources !== null ? { resources: payloadResources } : null,
      defaultBody: { resources: this.defaultResources },
      fixturePath: '1.recursos/resources.json',
      alias: 'getStoreResources',
      statusCode: statusCode
    });
  }

  /**
   * Intercepta a rota de recursos simulando indisponibilidade / erro de infraestrutura
   * 
   * @param {number} statusCode Código de erro HTTP (ex: 503, 500)
   * @param {object} customBody Corpo de erro customizado
   */
  interceptResourcesError(statusCode = 503, customBody = { message: 'Serviço temporariamente indisponível' }) {
    this.interceptRoute({
      method: 'GET',
      urlPattern: rotaApi('resources*'),
      customPayload: customBody,
      alias: 'getStoreResourcesError',
      statusCode: statusCode
    });
  }

  /**
   * Libera a rota de recursos para execução na API real (com suporte a Auto-Sync)
   */
  clearMocksForRealE2ETests() {
    const isAutoSync = Cypress.env('AUTO_SYNC_MOCKS') === true || Cypress.env('AUTO_SYNC_MOCKS') === 'true';
    if (isAutoSync) {
      cy.intercept('GET', rotaApi('resources*'), (req) => {
        req.continue((res) => {
          if (res && res.statusCode >= 200 && res.statusCode < 300 && res.body) {
            this._saveFixture('1.recursos/resources.json', res.body);
          }
        });
      }).as('getStoreResources');
    } else {
      cy.intercept('GET', rotaApi('resources*'), (req) => req.continue()).as('getStoreResources');
    }
  }
}

export default new RecursosMocks();
