import BaseMock from './BaseMock';
import mockChannelsData from '../fixtures/4.iniciarAtendimento/channels.json';
import mockChannelGroupsOfficialData from '../fixtures/4.iniciarAtendimento/channelGroups_6.json';
import mockChannelGroupsNonOfficialData from '../fixtures/4.iniciarAtendimento/channelGroups_3.json';
import mockWabaTemplatesData from '../fixtures/4.iniciarAtendimento/wabaTemplates_6.json';
import mockAttendanceCapabilitiesData from '../fixtures/3.central/attendance_capabilities.json';
import mockClientsData from '../fixtures/4.iniciarAtendimento/clients.json';
import mockClientPhonesData from '../fixtures/4.iniciarAtendimento/clientPhones.json';
import mockStandardMessagesData from '../fixtures/4.iniciarAtendimento/standardMessages.json';
import mockStandardMessageCapabilitiesData from '../fixtures/4.iniciarAtendimento/standardMessageCapabilities.json';
import { rotaApi } from '../support/rotaApi';

/**
 * Classe responsável pela centralização de Mocks, Payloads e Interceptações de API
 * para o modal de Iniciar Atendimento do OmniCare Web.
 * 
 * Estende BaseMock com suporte ao Strategy Pattern (Mock Hermético vs API Real Auto-Sync).
 */
class IniciarAtendimentoMocks extends BaseMock {
  // -------------------------------------------------------------
  // DADOS DE MOCK PADRÃO (CARREGADOS DE CYPRESS/FIXTURES/)
  // -------------------------------------------------------------

  mockChannelsData = mockChannelsData;
  mockChannelGroupsOfficialData = mockChannelGroupsOfficialData;
  mockChannelGroupsNonOfficialData = mockChannelGroupsNonOfficialData;
  mockWabaTemplatesData = mockWabaTemplatesData;
  mockAttendanceCapabilitiesData = mockAttendanceCapabilitiesData;
  mockClientsData = mockClientsData;
  mockClientPhonesData = mockClientPhonesData;
  mockStandardMessagesData = mockStandardMessagesData;
  mockStandardMessageCapabilitiesData = mockStandardMessageCapabilitiesData;

  mockWhatsappCheckData = {
    has_whatsapp: true,
    raw_message: '1,5511999998888,Número tem Whatsapp.',
    should_block_start: false
  };

  mockCreateAttendanceData = {
    id: 260800069,
    message_id: 4853743,
    message_at: new Date().toISOString(),
    reused_existing_attendance: true
  };

  // -------------------------------------------------------------
  // MÉTODOS DE INTERCEPTAÇÃO DE API (CY.INTERCEPT)
  // -------------------------------------------------------------

  /**
   * Intercepta a listagem de canais (/channels)
   * @param {object|null} customPayload Payload customizado opcional
   */
  interceptarCanais(customPayload = null) {
    this.interceptRoute({
      method: 'GET',
      urlPattern: rotaApi('channels*'),
      customPayload,
      defaultBody: this.mockChannelsData,
      fixturePath: '4.iniciarAtendimento/channels.json',
      alias: 'getChannels'
    });
  }

  /**
   * Intercepta as permissões/capabilities de atendimento (/attendance-capabilities)
   * @param {object|null} customPayload Payload customizado opcional
   */
  interceptarAttendanceCapabilities(customPayload = null) {
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
   * Intercepta a listagem de grupos do canal (/channel-groups)
   * @param {string|number} channelId ID do canal ('*' para todos)
   * @param {object|null} customPayload Payload customizado opcional
   */
  interceptarBuscaGrupos(channelId = '*', customPayload = null) {
    const urlPattern = rotaApi(`channel-groups*${channelId !== '*' ? `*channel_id=${channelId}*` : ''}`);
    const fileName = channelId === 3 || channelId === '3' ? 'channelGroups_3.json' : 'channelGroups_6.json';
    const defaultBody = (channelId === 3 || channelId === '3') ? this.mockChannelGroupsNonOfficialData : this.mockChannelGroupsOfficialData;

    this.interceptRoute({
      method: 'GET',
      urlPattern,
      customPayload,
      defaultBody,
      fixturePath: `4.iniciarAtendimento/${fileName}`,
      alias: 'getGruposCanal'
    });
  }

  /**
   * Intercepta a listagem de templates WABA do canal (/waba-message-templates)
   * @param {string|number} channelId ID do canal ('*' para todos)
   * @param {object|null} customPayload Payload customizado opcional
   */
  interceptarBuscaTemplatesWaba(channelId = '*', customPayload = null) {
    const urlPattern = rotaApi(`waba-message-templates*${channelId !== '*' ? `*channel_id=${channelId}*` : ''}`);

    this.interceptRoute({
      method: 'GET',
      urlPattern,
      customPayload,
      defaultBody: this.mockWabaTemplatesData,
      fixturePath: '4.iniciarAtendimento/wabaTemplates_6.json',
      alias: 'getTemplatesWaba'
    });
  }

  /**
   * Intercepta a listagem de mensagens padrão (/standard-messages)
   * @param {object|null} customPayload Payload customizado opcional
   */
  interceptarMensagensPadrao(customPayload = null) {
    this.interceptRoute({
      method: 'GET',
      urlPattern: rotaApi('standard-messages*'),
      customPayload,
      defaultBody: this.mockStandardMessagesData,
      fixturePath: '4.iniciarAtendimento/standardMessages.json',
      alias: 'getMensagensPadrao'
    });
  }

  /**
   * Intercepta as permissões de mensagens padrão (/standard-message-capabilities)
   * @param {object|null} customPayload Payload customizado opcional
   */
  interceptarStandardMessageCapabilities(customPayload = null) {
    this.interceptRoute({
      method: 'GET',
      urlPattern: rotaApi('standard-message-capabilities*'),
      customPayload,
      defaultBody: this.mockStandardMessageCapabilitiesData,
      fixturePath: '4.iniciarAtendimento/standardMessageCapabilities.json',
      alias: 'getStandardMessageCapabilities'
    });
  }

  /**
   * Intercepta a busca de clientes (/clients?q=...)
   * @param {object|null} customPayload Payload customizado opcional
   */
  interceptarBuscaCliente(customPayload = null) {
    this.interceptRoute({
      method: 'GET',
      urlPattern: rotaApi('clients*'),
      customPayload,
      defaultBody: this.mockClientsData,
      fixturePath: '4.iniciarAtendimento/clients.json',
      alias: 'searchClients'
    });
  }

  /**
   * Intercepta a busca de clientes (/clients?q=...) com simulação
   * de termos distintos ('maria' imediato e 'jose' com delay configurável) para validação
   * de debounce, indicador de loading e prevenção de race condition / cache estagnado.
   * @param {object} options
   * @param {number} [options.delayJoseMs=800] Atraso em ms para a resposta de 'jose' (em voo)
   */
  interceptarBuscaClienteComDebounceERaceCondition({ delayJoseMs = 800 } = {}) {
    cy.intercept('GET', rotaApi('clients*'), (req) => {
      const url = new URL(req.url);
      const q = (url.searchParams.get('q') || '').toLowerCase();

      if (q.includes('maria')) {
        req.reply({
          statusCode: 200,
          body: {
            items: [
              {
                id: 101,
                name: 'MARIA SILVA',
                cpf_cnpj: '***.111.222-**',
                phone: { prefix: '62', number: '999991111', whatsapp: true },
                phone_count: 1
              }
            ],
            total: 1
          }
        });
      } else if (q.includes('jose')) {
        req.reply({
          statusCode: 200,
          delay: delayJoseMs,
          body: {
            items: [
              {
                id: 102,
                name: 'JOSE SANTOS',
                cpf_cnpj: '***.333.444-**',
                phone: { prefix: '62', number: '999992222', whatsapp: true },
                phone_count: 1
              }
            ],
            total: 1
          }
        });
      } else {
        req.reply({
          statusCode: 200,
          body: this.mockClientsData
        });
      }
    }).as('searchClients');
  }

  /**
   * Intercepta a rota de busca de clientes como spy com retorno vazio
   * para validar que nenhuma requisição é disparada para termos curtos.
   */
  interceptarBuscaClienteSpy() {
    cy.intercept('GET', rotaApi('clients*'), {
      statusCode: 200,
      body: { items: [], total: 0 }
    }).as('searchClientsSpy');
  }

  /**
   * Intercepta a listagem de telefones de um cliente (/clients/[clientId]/phones)
   * @param {string|number} clientId ID do cliente ('*' para todos)
   * @param {object|null} customPayload Payload customizado opcional
   */
  interceptarPhonesCliente(clientId = '*', customPayload = null) {
    const urlPattern = rotaApi(`clients/${clientId}/phones*`);

    this.interceptRoute({
      method: 'GET',
      urlPattern,
      customPayload,
      defaultBody: this.mockClientPhonesData,
      fixturePath: '4.iniciarAtendimento/clientPhones.json',
      alias: 'getClientPhones'
    });
  }

  /**
   * Intercepta a verificação de existência do número no WhatsApp (/whatsapp-number-check)
   * @param {string} celular Número de telefone utilizado no teste
   * @param {object|null} customPayload Payload customizado opcional
   */
  interceptarChecagemWhatsapp(celular = '11999998888', customPayload = null) {
    const defaultBody = {
      has_whatsapp: true,
      raw_message: `1,55${celular},Número tem Whatsapp.`,
      should_block_start: false
    };

    if (customPayload) {
      cy.intercept('POST', '**/whatsapp-number-check*', {
        statusCode: 200,
        body: customPayload
      }).as('whatsappCheck');
    } else if (this.isMockEnabled()) {
      cy.intercept('POST', '**/whatsapp-number-check*', {
        statusCode: 200,
        body: defaultBody
      }).as('whatsappCheck');
    } else {
      cy.intercept('POST', '**/whatsapp-number-check*', (req) => req.continue()).as('whatsappCheck');
    }
  }

  /**
   * Intercepta a criação/reaproveitamento de atendimento no backend (/attendances)
   * @param {boolean} reutilizado Define se o atendimento é reutilizado (default: true)
   * @param {number|null} attendanceId ID único do atendimento (opcional)
   * @param {number|null} messageId ID da mensagem enviada (opcional)
   * @param {object|null} customPayload Payload customizado opcional
   */
  interceptarCriacaoAtendimentoReutilizado(reutilizado = true, attendanceId = null, messageId = null, customPayload = null) {
    const idAtendimentoDinamico = attendanceId || 260800148;
    const idMensagemDinamico = messageId || 4853743;

    const defaultBody = reutilizado ? {
      code: 'OPEN_ATTENDANCE_EXISTS',
      attendance_id: idAtendimentoDinamico,
      message: 'Já existe um atendimento em andamento para este cliente.'
    } : {
      id: idAtendimentoDinamico,
      message_id: idMensagemDinamico,
      message_at: new Date().toISOString(),
      reused_existing_attendance: false
    };

    const statusCode = reutilizado ? 409 : 200;

    if (customPayload) {
      cy.intercept('POST', '**/attendances*', {
        statusCode: customPayload.statusCode || statusCode,
        body: customPayload.body || customPayload
      }).as('createAttendance');
    } else if (this.isMockEnabled()) {
      cy.intercept('POST', '**/attendances*', {
        statusCode,
        body: defaultBody
      }).as('createAttendance');
    } else {
      cy.intercept('POST', '**/attendances*', (req) => req.continue()).as('createAttendance');
    }
  }

  /**
   * Remove os mocks para permitir que os testes interajam com a rede real
   */
  clearMocksForRealE2ETests() {
    cy.intercept('GET', rotaApi('channels'), (req) => req.continue()).as('getChannels');
    cy.intercept('GET', rotaApi('attendance-capabilities*'), (req) => req.continue()).as('getAttendanceCapabilities');
    cy.intercept('GET', rotaApi('channel-groups*'), (req) => req.continue()).as('getGruposCanal');
    cy.intercept('GET', rotaApi('waba-message-templates*'), (req) => req.continue()).as('getTemplatesWaba');
    cy.intercept('GET', rotaApi('standard-messages*'), (req) => req.continue()).as('getMensagensPadrao');
    cy.intercept('GET', rotaApi('clients*'), (req) => req.continue()).as('searchClients');
    cy.intercept('GET', rotaApi('clients/*/phones*'), (req) => req.continue()).as('getClientPhones');
    cy.intercept('POST', '**/whatsapp-number-check*', (req) => req.continue()).as('whatsappCheck');
    cy.intercept('POST', '**/attendances*', (req) => req.continue()).as('createAttendance');
  }
}

export default new IniciarAtendimentoMocks();
