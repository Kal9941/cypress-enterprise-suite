import BaseMock from './BaseMock';
import mockSummaryData from '../fixtures/3.central/summary.json';
import mockAttendancesInProgressData from '../fixtures/3.central/attendances_in_progress.json';
import mockAttendancesPendingData from '../fixtures/3.central/attendances_pending.json';
import mockAttendancesWaitingData from '../fixtures/3.central/attendances_waiting.json';
import mockAttendanceCapabilitiesData from '../fixtures/3.central/attendance_capabilities.json';
import { rotaApi } from '../support/rotaApi';

/**
 * Classe responsável pela centralização de Mocks, Payloads e Interceptações de API
 * para a tela Central / Dashboard do Pharmacie Web.
 * 
 * Estende BaseMock com suporte ao Strategy Pattern (Mock Hermético vs API Real Auto-Sync).
 */
class CentralMocks extends BaseMock {
  // -------------------------------------------------------------
  // DADOS DE MOCK PADRÃO (CARREGADOS DE CYPRESS/FIXTURES/)
  // -------------------------------------------------------------

  mockSummaryData = mockSummaryData;
  mockAttendancesInProgressData = mockAttendancesInProgressData;
  mockAttendancesPendingData = mockAttendancesPendingData;
  mockAttendancesWaitingData = mockAttendancesWaitingData;
  mockAttendanceCapabilitiesData = mockAttendanceCapabilitiesData;

  // -------------------------------------------------------------
  // MÉTODOS DE INTERCEPTAÇÃO DE API (CY.INTERCEPT)
  // -------------------------------------------------------------

  /**
   * Intercepta a API de métricas/resumo dos atendimentos (/attendances/summary)
   * @param {object|null} customPayload Payload customizado opcional
   */
  interceptSummaryApi(customPayload = null) {
    this.interceptRoute({
      method: 'GET',
      urlPattern: rotaApi('attendances/summary*'),
      customPayload,
      defaultBody: this.mockSummaryData,
      fixturePath: '3.central/summary.json',
      alias: 'getDashboardMetrics'
    });
  }

  /**
   * Intercepta a listagem de atendimentos filtrando por status na query string
   * @param {string} status Status do atendimento ('in_progress', 'pending', 'waiting', '*' para todos)
   * @param {object|null} customPayload Payload customizado opcional
   */
  interceptAttendancesList(status = '*', customPayload = null) {
    const urlPattern = rotaApi(`attendances?*${status !== '*' ? `*status=${status}*` : ''}`);
    const aliasName = status !== '*' ? `getAttendances_${status}` : 'getAttendancesList';

    let defaultBody = null;
    let fixturePath = null;

    if (status === 'in_progress') {
      defaultBody = this.mockAttendancesInProgressData;
      fixturePath = '3.central/attendances_in_progress.json';
    } else if (status === 'pending') {
      defaultBody = this.mockAttendancesPendingData;
      fixturePath = '3.central/attendances_pending.json';
    } else if (status === 'waiting') {
      defaultBody = this.mockAttendancesWaitingData;
      fixturePath = '3.central/attendances_waiting.json';
    }

    this.interceptRoute({
      method: 'GET',
      urlPattern,
      customPayload,
      defaultBody,
      fixturePath,
      alias: aliasName
    });
  }

  /**
   * Intercepta a listagem de atendimentos em andamento (status=in_progress)
   * @param {object|null} customPayload Payload customizado
   */
  interceptAttendancesInProgress(customPayload = null) {
    this.interceptAttendancesList('in_progress', customPayload);
  }

  /**
   * Intercepta a listagem de atendimentos pendentes (status=pending)
   * @param {object|null} customPayload Payload customizado
   */
  interceptAttendancesPending(customPayload = null) {
    this.interceptAttendancesList('pending', customPayload);
  }

  /**
   * Intercepta a listagem de atendimentos aguardando (status=waiting)
   * @param {object|null} customPayload Payload customizado
   */
  interceptAttendancesWaiting(customPayload = null) {
    this.interceptAttendancesList('waiting', customPayload);
  }

  /**
   * Intercepta as permissões/capabilities de atendimento (/attendance-capabilities)
   * @param {object|null} customPayload Payload customizado opcional
   */
  interceptAttendanceCapabilities(customPayload = null) {
    this.interceptRoute({
      method: 'GET',
      urlPattern: rotaApi('attendance-capabilities*'),
      customPayload,
      defaultBody: this.mockAttendanceCapabilitiesData,
      fixturePath: '3.central/attendance_capabilities.json',
      alias: 'getAttendanceCapabilities'
    });
  }

  /**
   * Remove os mocks para permitir que os testes interajam com a rede real
   */
  clearMocksForRealE2ETests() {
    cy.intercept('GET', rotaApi('attendances/summary*'), (req) => req.continue()).as('getDashboardMetrics');
    cy.intercept('GET', rotaApi('attendances?*'), (req) => req.continue()).as('getAttendancesList');
    cy.intercept('GET', rotaApi('attendance-capabilities*'), (req) => req.continue()).as('getAttendanceCapabilities');
  }
}

export default new CentralMocks();
