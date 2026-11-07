import BaseMock from './BaseMock';
import RecursosMocks from './1.recursosMocks';
import IniciarAtendimentoMocks from './4.iniciarAtendimentoMocks';
import mockSummaryData from '../fixtures/5.atendimentos/summary.json';
import mockAttendanceTemplatesData from '../fixtures/5.atendimentos/messageTemplates.json';
import mockTemplatesWabaData from '../fixtures/4.iniciarAtendimento/wabaTemplates_6.json';
import mockStandardMessagesData from '../fixtures/4.iniciarAtendimento/standardMessages.json';
import mockStandardMessageCapabilitiesData from '../fixtures/4.iniciarAtendimento/standardMessageCapabilities.json';
import mockUserData from '../fixtures/2.login/userMe.json';
import mockAgentsGroup7Data from '../fixtures/5.atendimentos/agentsGroup_7.json';
import mockAttendanceCapabilitiesRealData from '../fixtures/5.atendimentos/attendanceCapabilities.json';
import mockAttendanceChannelsData from '../fixtures/5.atendimentos/attendanceChannels.json';
import mockAttendanceMessagesRealData from '../fixtures/5.atendimentos/attendanceMessages.json';
import mockClientDetailData from '../fixtures/5.atendimentos/clientDetail.json';
import { validarSchemaMock } from '../support/schemas';

const configEnv = require('../../env.json');
import { regexApi, rotaApi } from '../support/rotaApi';

/**
 * Classe responsável pela centralização de Mocks, Payloads e Interceptações de API
 * para a tela de Gestão de Atendimentos do OmniCare Web.
 * 
 * Estende BaseMock com suporte ao Strategy Pattern (Mock Hermético vs API Real Auto-Sync).
 */
class AtendimentosMocks extends BaseMock {
  // -------------------------------------------------------------
  // DADOS DE MOCK PADRÃO (CARREGADOS DE CYPRESS/FIXTURES/)
  // -------------------------------------------------------------

  mockSummaryData = mockSummaryData;
  mockAttendanceTemplatesData = mockAttendanceTemplatesData;
  mockTemplatesWabaData = mockTemplatesWabaData;
  mockStandardMessagesData = mockStandardMessagesData;
  mockStandardMessageCapabilitiesData = mockStandardMessageCapabilitiesData;
  mockUserData = mockUserData;
  mockAgentsGroup7Data = mockAgentsGroup7Data;

  /**
   * Retorna os dados do atendente logado dinamicamente a partir de env.json
   */
  getLoggedAttendant() {
    const userCode = Cypress.env('USER_CODE') || Cypress.env('user') || configEnv.USER_CODE || '122';
    const clientName = Cypress.env('DEFAULT_CLIENT_NAME') || configEnv.DEFAULT_CLIENT_NAME || 'klismam';
    const attendantId = parseInt(userCode, 10) || 122;
    const attendantName = clientName.toUpperCase();
    return { id: attendantId, name: attendantName, user_id: attendantId };
  }

  get mockAttendancesListData() {
    const attendant = this.getLoggedAttendant();
    return {
      items: [
        {
          id: 260800035,
          reference_at: "2026-08-11T11:23:47.908Z",
          attendant_name: attendant.name,
          attendant: attendant,
          attendant_id: attendant.id,
          customer_name: "MARISTELA",
          messages: {
            unread_count: 5,
            last_message: {
              type: 1,
              body: "Continuar",
              occurred_at: "2026-08-20T16:36:30.240Z"
            }
          },
          status: 1,
          channel: {
            id: 6,
            name: "WHATSAPP OFICIAL - 62 98222-4382",
            type: 1,
            subtype: 1
          },
          group: {
            id: 7,
            name: "ATENDIMENTO"
          }
        },
        {
          id: 260900003,
          reference_at: "2026-09-01T15:52:41.915Z",
          attendant_name: "ITALO PATRICK",
          attendant: {
            id: 10,
            name: "ITALO PATRICK"
          },
          attendant_id: 10,
          customer_name: "My Blue Pet",
          messages: {
            unread_count: 3,
            last_message: {
              type: 1,
              body: "Ticket para acompanhamento: 260900004",
              occurred_at: "2026-09-01T15:52:42.130Z"
            }
          },
          status: 1,
          channel: {
            id: 1,
            name: "PEDIDO PAGO - CHATBOT",
            type: 1,
            subtype: 2
          },
          group: {
            id: 6,
            name: "CHATBOT"
          }
        },
        {
          id: 260900004,
          reference_at: "2026-09-01T16:07:40.850Z",
          attendant_name: "MATHEUS MUDESTO",
          attendant: {
            id: 15,
            name: "MATHEUS MUDESTO"
          },
          attendant_id: 15,
          customer_name: "5585984657055",
          messages: {
            unread_count: 1,
            last_message: {
              type: 1,
              body: "Olá",
              occurred_at: "2026-09-01T16:07:41.000Z"
            }
          },
          status: 0,
          channel: {
            id: 6,
            name: "WHATSAPP OFICIAL - 62 98222-4382",
            type: 1,
            subtype: 1
          },
          group: {
            id: 7,
            name: "ATENDIMENTO"
          }
        }
      ],
      pagination: {
        page: 1,
        per_page: 20,
        total: 3,
        total_pages: 1,
        has_next: false,
        has_previous: false
      }
    };
  }

  /**
   * Mock com atendimentos estruturados para validar as 3 regras de prioridade e ordenação (Issue #373):
   * 1ª regra: Mensagens pendentes de leitura (unread_count > 0)
   * 2ª regra: Atendimento há mais tempo sem resposta ao cliente (última mensagem do cliente)
   * 3ª regra: Atendimento há mais tempo sem mensagem do atendente (última mensagem do atendente)
   */
  get mockAttendancesOrdenacaoData() {
    const attendant = this.getLoggedAttendant();
    return {
      items: [
        // 1ª REGRA: Mensagem pendente de leitura (unread_count > 0)
        {
          id: 260800077,
          reference_at: "2026-08-20T14:00:00.000Z",
          attendant_name: "ITALO PATRICK",
          customer_name: "Cliente sem nome (2 não lidas)",
          messages: {
            unread_count: 2,
            last_message: {
              type: 0,
              body: "[STICKER]",
              occurred_at: "2026-08-20T14:30:00.000Z"
            }
          },
          status: 0,
          channel: { id: 6, name: "WHATSAPP OFICIAL - 62 98222-4382", type: 1, subtype: 1 },
          group: { id: 7, name: "ATENDIMENTO" }
        },
        {
          id: 260800076,
          reference_at: "2026-08-20T15:00:00.000Z",
          attendant_name: "Sem atendente",
          customer_name: "Dayane (1 não lida)",
          messages: {
            unread_count: 1,
            last_message: {
              type: 0,
              body: "Link para Detalhes e Pagamento...",
              occurred_at: "2026-08-20T15:30:00.000Z"
            }
          },
          status: 0,
          channel: { id: 6, name: "WHATSAPP OFICIAL - 62 98222-4382", type: 1, subtype: 1 },
          group: { id: 7, name: "ATENDIMENTO" }
        },
        // 2ª REGRA: Atendimento há mais tempo sem resposta ao cliente (unread_count = 0, última mensagem enviada pelo cliente)
        {
          id: 260800081,
          reference_at: "2026-08-21T08:00:00.000Z",
          attendant_name: attendant.name,
          attendant: attendant,
          customer_name: "Carlos (Aguardando resposta há 4h)",
          messages: {
            unread_count: 0,
            last_message: {
              type: 0,
              body: "Gostaria de confirmar o pedido por favor",
              occurred_at: "2026-08-21T08:00:00.000Z"
            }
          },
          status: 1,
          channel: { id: 6, name: "WHATSAPP OFICIAL - 62 98222-4382", type: 1, subtype: 1 },
          group: { id: 7, name: "ATENDIMENTO" }
        },
        {
          id: 260800082,
          reference_at: "2026-08-21T11:00:00.000Z",
          attendant_name: attendant.name,
          attendant: attendant,
          customer_name: "Mariana (Aguardando resposta recente)",
          messages: {
            unread_count: 0,
            last_message: {
              type: 0,
              body: "Qual o prazo de entrega?",
              occurred_at: "2026-08-21T11:00:00.000Z"
            }
          },
          status: 1,
          channel: { id: 6, name: "WHATSAPP OFICIAL - 62 98222-4382", type: 1, subtype: 1 },
          group: { id: 7, name: "ATENDIMENTO" }
        },
        // 3ª REGRA: Atendimento há mais tempo sem mensagem do atendente (unread_count = 0, última mensagem enviada pelo atendente)
        {
          id: 260800078,
          reference_at: "2026-08-21T07:00:00.000Z",
          attendant_name: "JEFERSON MARTINS",
          customer_name: "Dayane (Respondido antigo)",
          messages: {
            unread_count: 0,
            last_message: {
              type: 1,
              body: "[STICKER ANIMADO]",
              occurred_at: "2026-08-21T07:30:00.000Z"
            }
          },
          status: 1,
          channel: { id: 6, name: "WHATSAPP OFICIAL - 62 98222-4382", type: 1, subtype: 1 },
          group: { id: 7, name: "ATENDIMENTO" }
        },
        {
          id: 260800079,
          reference_at: "2026-08-21T12:00:00.000Z",
          attendant_name: "JEFERSON MARTINS",
          customer_name: "Lucas (Respondido recente)",
          messages: {
            unread_count: 0,
            last_message: {
              type: 1,
              body: "Seu pedido foi despachado.",
              occurred_at: "2026-08-21T12:30:00.000Z"
            }
          },
          status: 1,
          channel: { id: 6, name: "WHATSAPP OFICIAL - 62 98222-4382", type: 1, subtype: 1 },
          group: { id: 7, name: "ATENDIMENTO" }
        }
      ],
      pagination: {
        page: 1,
        per_page: 20,
        total: 6,
        total_pages: 1,
        has_next: false,
        has_previous: false
      }
    };
  }

  mockSearchData = {
    items: [
      {
        id: 260800008,
        reference_at: "2026-08-04T13:46:11.834Z",
        attendant_name: "GUSTAVO HENRIQUE",
        customer_name: "GUSTAVO HENRIQUE",
        messages: {
          unread_count: 0,
          last_message: {
            type: 1,
            body: "oi",
            occurred_at: "2026-08-24T14:49:15.549Z"
          }
        },
        status: 0,
        channel: {
          id: 6,
          name: "WHATSAPP OFICIAL - 62 98222-4382",
          type: 1,
          subtype: 1
        },
        group: {
          id: 7,
          name: "ATENDIMENTO"
        }
      }
    ],
    pagination: { page: 1, per_page: 20, total: 1, total_pages: 1, has_next: false, has_previous: false }
  };

  mockMessagesListData = {
    data: [
      {
        id: 2,
        created_at: new Date().toISOString(),
        origin: "customer",
        employee_code: null,
        transfer_type: 0,
        content_type: "text",
        message_status: "ready",
        content: "Gostaria de saber o status do meu pedido",
        attachment: null
      },
      {
        id: 1,
        created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
        origin: "employee",
        employee_code: "122",
        transfer_type: 0,
        content_type: "text",
        message_status: "sent",
        content: "Olá, como posso ajudar?",
        attachment: null
      }
    ],
    pagination: { page: 1, per_page: 20, total: 2, total_pages: 1, has_next: false, has_previous: false }
  };

  mockMessagesExpiradas = {
    data: [
      {
        id: 1,
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
        origin: "employee",
        employee_code: "122",
        transfer_type: 0,
        content_type: "text",
        message_status: "sent",
        content: "Olá, segue um status do seu pedido. \nteste \nVocê pode verificar o status do seu pedido no botão abaixo:",
        attachment: null
      }
    ],
    pagination: { page: 1, per_page: 20, total: 1, total_pages: 1, has_next: false, has_previous: false }
  };

  mockMessagesAtivas = {
    data: [
      {
        id: 4854483,
        created_at: new Date().toISOString(),
        origin: "employee",
        employee_code: "122",
        transfer_type: 0,
        content_type: "document",
        message_status: "sent",
        content: "Orçamento #260900052 - R$ 168,12",
        attachment: {
          id: 4854483,
          name: "Orçamento #260900052.pdf",
          content_type: "application/pdf",
          url: "https://api.omnicare.dev.local/storage/budget.pdf"
        }
      },
      {
        id: 4854482,
        created_at: new Date().toISOString(),
        origin: "customer",
        employee_code: null,
        transfer_type: 0,
        content_type: "text",
        message_status: "ready",
        content: "Continuar",
        attachment: null
      },
      {
        id: 4854481,
        created_at: new Date(Date.now() - 1000 * 60).toISOString(),
        origin: "employee",
        employee_code: "122",
        transfer_type: 0,
        content_type: "text",
        message_status: "sent",
        content: "Olá, segue um status do seu pedido. \nteste \nVocê pode verificar o status do seu pedido no botão abaixo:",
        attachment: null
      }
    ],
    items: [
      {
        id: 4854483,
        created_at: new Date().toISOString(),
        origin: "employee",
        employee_code: "122",
        transfer_type: 0,
        content_type: "document",
        message_status: "sent",
        content: "Orçamento #260900052 - R$ 168,12",
        attachment: {
          id: 4854483,
          name: "Orçamento #260900052.pdf",
          content_type: "application/pdf",
          url: "https://api.omnicare.dev.local/storage/budget.pdf"
        }
      },
      {
        id: 4854482,
        created_at: new Date().toISOString(),
        origin: "customer",
        employee_code: null,
        transfer_type: 0,
        content_type: "text",
        message_status: "ready",
        content: "Continuar",
        attachment: null
      },
      {
        id: 4854481,
        created_at: new Date(Date.now() - 1000 * 60).toISOString(),
        origin: "employee",
        employee_code: "122",
        transfer_type: 0,
        content_type: "text",
        message_status: "sent",
        content: "Olá, segue um status do seu pedido. \nteste \nVocê pode verificar o status do seu pedido no botão abaixo:",
        attachment: null
      }
    ],
    pagination: {
      page: 1,
      per_page: 20,
      total: 3,
      total_pages: 1,
      has_next: false,
      has_previous: false
    }
  };

  get mockAttendanceDetailData() {
    const attendant = this.getLoggedAttendant();
    return {
      attendance: {
        id: 260800148,
        reference_at: "2026-08-28T19:09:14.164Z",
        attendant_name: attendant.name,
        customer_name: "DAYANE",
        status: 1,
        channel: {
          id: 6,
          name: "WHATSAPP OFICIAL - 62 98222-4382",
          type: 1,
          subtype: 1
        },
        group: {
          id: 7,
          name: "ATENDIMENTO"
        },
        attendant: attendant,
        attendant_id: attendant.id,
        last_customer_message_at: new Date().toISOString(),
        service_window: null
      },
      customer: {
        name: "DAYANE",
        phone: "5511999998888",
        email: null,
        store_name: "LOJA TESTE"
      },
      summaries: {
        quotes: { count: 0, total_amount: 0 },
        payment_links: { count: 0, pending_confirmation_count: 0 }
      },
      capabilities: {
        can_view_attendance_detail: true,
        can_list_attendance_messages: true,
        can_send_attendance_messages: true,
        can_send_free_text: true,
        can_mark_completed: true,
        can_mark_discarded: true,
        can_mark_finished: true,
        can_transfer_assigned_attendance: true,
        can_transfer_pending_attendance: true,
        can_create_quote: true,
        can_create_payment_link: true,
        can_send_payment_link: true
      }
    };
  }

  // -------------------------------------------------------------
  // MÉTODOS DE INTERCEPTAÇÃO DE API (CY.INTERCEPT)
  // -------------------------------------------------------------

  /**
   * Intercepta a rota de modelos de mensagem/templates WABA de um atendimento (/attendances/:id/message-templates)
   * @param {string|number} attendanceId ID do atendimento ('*' para todos)
   * @param {object|null} customPayload Payload customizado opcional
   */
  interceptAttendanceMessageTemplatesApi(attendanceId = '*', customPayload = null) {
    this.interceptRoute({
      method: 'GET',
      urlPattern: rotaApi(`attendances/${attendanceId}/message-templates*`),
      customPayload,
      defaultBody: this.mockAttendanceTemplatesData,
      fixturePath: '5.atendimentos/messageTemplates.json',
      alias: 'getAttendanceMessageTemplates'
    });
  }

  /**
   * Intercepta a rota global de modelos de mensagem/templates WABA (/waba-message-templates)
   * @param {object|null} customPayload Payload customizado opcional
   */
  interceptTemplatesWabaApi(customPayload = null) {
    this.interceptRoute({
      method: 'GET',
      urlPattern: rotaApi('waba-message-templates*'),
      customPayload,
      defaultBody: this.mockTemplatesWabaData,
      fixturePath: '4.iniciarAtendimento/wabaTemplates_6.json',
      alias: 'getTemplatesWaba'
    });
  }

  /**
   * Intercepta a rota de identificação do usuário autenticado (/users/me)
   * @param {object|null} customPayload Payload customizado opcional
   */
  interceptUserMeApi(customPayload = null) {
    const userCode = Cypress.env('USER_CODE') || Cypress.env('user') || configEnv.USER_CODE || "122";
    const userCnpj = Cypress.env('USER_CNPJ') || Cypress.env('userCnpj') || configEnv.USER_CNPJ || "11111111111111";
    const clientName = Cypress.env('DEFAULT_CLIENT_NAME') || configEnv.DEFAULT_CLIENT_NAME || "klismam";
    const displayName = clientName.toUpperCase();

    const dynamicUserMe = {
      ...this.mockUserData,
      id: parseInt(userCode, 10) || 122,
      user_id: parseInt(userCode, 10) || 122,
      cnpj: userCnpj,
      display_name: displayName,
      profile: displayName.replace(/\s+/g, ''),
      company_code: 10199,
      store_code: 1
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
   * Intercepta a API de métricas/resumo dos atendimentos (/attendances/summary)
   * @param {object|null} customPayload Payload customizado opcional
   */
  interceptSummaryApi(customPayload = null) {
    this.interceptRoute({
      method: 'GET',
      urlPattern: rotaApi('attendances/summary*'),
      customPayload,
      defaultBody: this.mockSummaryData,
      fixturePath: '5.atendimentos/summary.json',
      alias: 'getAttendancesSummary'
    });
  }

  /**
   * Canais do seletor Canal do filtro da fila (GET /attendances/channels, backend#685/#687, front#582/PR #590).
   * Formato medido na API real da dev em 2026-10-16: todos os canais de OC_CANAL, inclusive Pedido Pago (channel_subtype 2) e inativos,
   * ordenados por nome, com o mesmo item de /channels. O padrão `rotaApi('channels*')` do "Iniciar atendimento" NÃO casa com esta rota.
   * @param {object|null} customPayload Payload customizado opcional (ex.: canal sem nome, `name: null`)
   */
  interceptAttendanceChannelsApi(customPayload = null) {
    this.interceptRoute({
      method: 'GET',
      urlPattern: rotaApi('attendances/channels*'),
      customPayload,
      defaultBody: mockAttendanceChannelsData,
      fixturePath: '5.atendimentos/attendanceChannels.json',
      alias: 'getCanaisFiltroFila'
    });
  }

  /**
   * Responde GET /attendances/channels (seletor Canal do filtro da fila) com erro, no envelope do backend. Sempre mockado: a rota real só
   * recusa sem a permissão 418, que a conta de teste tem (ROADMAP.md P2-20).
   * @param {number} statusCode Status HTTP da resposta (403 sem a 418, 500 falha do servidor)
   */
  interceptAttendanceChannelsApiErro(statusCode = 403) {
    const corpos = {
      403: { status: 403, error: 'Forbidden', message: 'Você não tem permissão para acessar este recurso.', code: 'PERMISSION_DENIED' },
      500: { status: 500, error: 'Internal Server Error', message: 'Erro interno.' },
    };
    const body = { ...(corpos[statusCode] || corpos[500]), status: statusCode, timestamp: new Date().toISOString() };
    cy.intercept('GET', rotaApi('attendances/channels*'), { statusCode, body }).as('getCanaisFiltroFila');
  }

  /**
   * Intercepta a API da listagem de atendimentos (/attendances)
   * @param {object|null} customPayload Payload customizado opcional
   */
  interceptAttendancesListApi(customPayload = null) {
    this.interceptRoute({
      method: 'GET',
      urlPattern: rotaApi('attendances?*'),
      customPayload,
      defaultBody: this.mockAttendancesListData,
      fixturePath: '5.atendimentos/attendancesList.json',
      alias: 'getAttendancesList'
    });
  }

  /**
   * Capabilities canônicas de um atendimento individual (/attendances/:id/capabilities).
   * Parte do contrato real gravado da API (attendanceCapabilities.json) e sobrepõe apenas
   * as chaves que a automação de UI precisa liberadas (aliases legados e permissões amplas).
   *
   * ATENÇÃO: esta é a ÚNICA declaração desta propriedade. Declarar o mesmo class field duas
   * vezes faz o JavaScript descartar silenciosamente a primeira — foi o que mantinha a fixture
   * real ignorada e `can_send_payment_link` ausente (checkboxes de orçamento e botões de link
   * de pagamento bloqueados apenas no modo mock).
   */
  mockAttendanceItemCapabilitiesData = {
    capabilities: {
      ...mockAttendanceCapabilitiesRealData.capabilities,
      can_transfer_pending_attendance: true,
      can_transfer_attendance: true,
      can_transfer: true,
      can_transfer_occupied_attendance: true,
      can_change_status: true,
      can_complete_attendance: true,
      can_discard_attendance: true,
      can_send_free_text: true,
      can_save_customer_on_attendance: true,
      can_create_quote: true,
      can_create_payment_link: true,
      can_list_group_agents: true
    }
  };

  /**
   * Intercepta a rota de detalhes de um atendimento (/attendances/:id)
   * Ignora sub-rotas como /summary, /capabilities, /messages para não colidir com outros intercepts
   * @param {string|number} attendanceId ID do atendimento ('*' para todos)
   * @param {object|null} customPayload Payload customizado opcional
   */
  interceptAttendanceDetailApi(attendanceId = '*', customPayload = null) {
    const idPattern = attendanceId === '*' ? '\\d+' : String(attendanceId);
    const detailRegex = new RegExp(regexApi(`attendances/${idPattern}([?#].*)?$`));

    if (customPayload !== null && customPayload !== undefined) {
      if (customPayload.capabilities) {
        Cypress.env('LAST_ATTENDANCE_ITEM_CAPABILITIES', customPayload.capabilities);
      }
      cy.intercept('GET', detailRegex, (req) => {
        const url = req.url;
        const match = url.match(/\/attendances\/(\d+)/);
        const reqId = match ? parseInt(match[1], 10) : (customPayload && customPayload.attendance ? customPayload.attendance.id : 260800035);

        let responseBody = JSON.parse(JSON.stringify(customPayload));
        if (responseBody && responseBody.attendance) {
          responseBody.attendance.id = reqId;
        }

        if (responseBody && responseBody.capabilities) {
          Cypress.env('LAST_ATTENDANCE_ITEM_CAPABILITIES', responseBody.capabilities);
        }

        validarSchemaMock('AtendimentosMocks', 'getAttendanceDetail', responseBody);
        req.reply({
          statusCode: 200,
          body: responseBody
        });
      }).as('getAttendanceDetail');
      return;
    }

    if (this.isMockEnabled()) {
      if (this.mockAttendanceDetailData?.capabilities) {
        Cypress.env('LAST_ATTENDANCE_ITEM_CAPABILITIES', this.mockAttendanceDetailData.capabilities);
      }
      cy.intercept('GET', detailRegex, (req) => {
        const url = req.url;
        const match = url.match(/\/attendances\/(\d+)/);
        const reqId = match ? parseInt(match[1], 10) : 260800035;

        let responseBody = JSON.parse(JSON.stringify(this.mockAttendanceDetailData));
        if (responseBody && responseBody.attendance) {
          responseBody.attendance.id = reqId;
        }

        if (responseBody && responseBody.capabilities) {
          Cypress.env('LAST_ATTENDANCE_ITEM_CAPABILITIES', responseBody.capabilities);
        }

        validarSchemaMock('AtendimentosMocks', 'getAttendanceDetail', responseBody);
        req.reply({
          statusCode: 200,
          body: responseBody
        });
      }).as('getAttendanceDetail');
    } else {
      cy.intercept('GET', detailRegex, (req) => {
        req.continue((res) => {
          if (res && res.body) {
            let body = res.body;
            if (typeof body === 'string') {
              try { body = JSON.parse(body); } catch (e) {}
            }
            if (body && body.capabilities) {
              Cypress.env('LAST_ATTENDANCE_ITEM_CAPABILITIES', body.capabilities);
            }
          }
        });
      }).as('getAttendanceDetail');
    }
  }

  /**
   * Configura o mock do detalhe de atendimento com janela de serviço e contagem regressiva (PR #312)
   * Permite alternar deterministicamente entre os estados Verde (> 4h), Laranja (<= 4h) e Expirado (<= 00:00 / can_send_free_text: false)
   * 
   * @param {Object} options
   * @param {number|string} [options.attendanceId=260800035] ID do atendimento
   * @param {number} [options.horasRestantes=18] Horas restantes da janela (ex: 18 para verde, 3 para laranja, -1 para expirado)
   * @param {number} [options.minutosRestantes=0] Minutos adicionais
   * @param {boolean} [options.canSendFreeText=true] Se texto livre está habilitado
   * @param {boolean} [options.serviceWindowActive=true] Flag de janela ativa
   */
  interceptMockDetalheComJanelaHoras({
    attendanceId = 260800035,
    horasRestantes = 18,
    minutosRestantes = 0,
    canSendFreeText = true,
    serviceWindowActive = true
  } = {}) {
    const attendant = this.getLoggedAttendant();
    const idNum = attendanceId === '*' ? 260800035 : parseInt(attendanceId, 10);

    const msOffset = (horasRestantes * 3600 + minutosRestantes * 60) * 1000;
    const expiresAt = new Date(Date.now() + msOffset).toISOString();
    const startedAt = new Date(Date.now() + msOffset - (24 * 3600 * 1000)).toISOString();

    const detailPayload = {
      attendance: {
        id: idNum,
        reference_at: "2026-08-28T19:09:14.164Z",
        attendant_name: attendant.name,
        customer_name: "DAYANE",
        status: 1, // Em andamento
        channel: {
          id: 6,
          name: "WHATSAPP OFICIAL - 62 98222-4382",
          type: 1,
          subtype: 1,
          official: true
        },
        group: {
          id: 7,
          name: "ATENDIMENTO"
        },
        attendant: attendant,
        attendant_id: attendant.id,
        last_customer_message_at: startedAt,
        service_window_active: serviceWindowActive,
        service_window: {
          started_at: startedAt,
          expires_at: expiresAt
        }
      },
      customer: {
        name: "DAYANE",
        phone: "5511999998888",
        email: null,
        store_name: "LOJA TESTE"
      },
      summaries: {
        quotes: { count: 0, total_amount: 0 },
        payment_links: { count: 0, pending_confirmation_count: 0 }
      },
      capabilities: {
        can_view_attendance_detail: true,
        can_list_attendance_messages: true,
        can_send_attendance_messages: true,
        can_send_free_text: canSendFreeText,
        can_mark_completed: true,
        can_mark_discarded: true,
        can_mark_finished: true,
        can_transfer_assigned_attendance: true,
        can_transfer_pending_attendance: true
      }
    };

    const listItem = {
      id: idNum,
      reference_at: "2026-08-28T19:09:14.164Z",
      attendant_name: attendant.name,
      attendant: attendant,
      attendant_id: attendant.id,
      customer_name: "DAYANE",
      messages: {
        unread_count: 0,
        last_message: {
          type: 1,
          body: "Olá, segue status do pedido",
          occurred_at: startedAt
        }
      },
      status: 1,
      channel: {
        id: 6,
        name: "WHATSAPP OFICIAL - 62 98222-4382",
        type: 1,
        subtype: 1,
        official: true
      },
      group: {
        id: 7,
        name: "ATENDIMENTO"
      }
    };

    const queuePayload = {
      items: [listItem],
      pagination: { page: 1, per_page: 20, total: 1, total_pages: 1, has_next: false, has_previous: false }
    };

    cy.intercept('GET', rotaApi('attendances?*'), {
      statusCode: 200,
      body: queuePayload
    }).as('getAttendancesList');

    this.interceptAttendanceDetailApi(idNum, detailPayload);
    return detailPayload;
  }

  /**
   * Intercepta as permissões específicas do atendimento individual (/attendances/:id/capabilities)
   * @param {string|number} attendanceId ID do atendimento ('*' para todos)
   * @param {object|null} customPayload Payload customizado opcional
   */
  interceptAttendanceItemCapabilitiesApi(attendanceId = '*', customPayload = null) {
    this.interceptRoute({
      method: 'GET',
      urlPattern: rotaApi(`attendances/${attendanceId}/capabilities*`),
      customPayload,
      defaultBody: this.mockAttendanceItemCapabilitiesData,
      fixturePath: '5.atendimentos/attendanceCapabilities.json',
      alias: 'getAttendanceItemCapabilities'
    });
  }

  /**
   * Intercepta as capabilities de mensagens padrão (/standard-message-capabilities)
   * @param {object|null} customPayload Payload customizado opcional
   */
  interceptStandardMessageCapabilitiesApi(customPayload = null) {
    const defaultPayload = {
      capabilities: {
        can_view_standard_messages: true,
        can_create_standard_messages: true,
        can_edit_standard_messages: true,
        can_delete_standard_messages: true
      }
    };

    this.interceptRoute({
      method: 'GET',
      urlPattern: rotaApi('standard-message-capabilities*'),
      customPayload,
      defaultBody: defaultPayload,
      fixturePath: '4.iniciarAtendimento/standardMessageCapabilities.json',
      alias: 'getStandardMessageCapabilities'
    });
  }

  /**
   * Configura e intercepta todas as permissões e capabilities da tela de Atendimentos
   * concedendo acesso total irrestrito (todas as capabilities como true).
   * 
   * Útil para testes funcionais que não avaliam restrições de RBAC/permissão, garantindo
   * que nenhum recurso da interface caia em bloqueio defensivo ("Permissão negada.").
   * 
   * @param {object} [options]
   * @param {string|number} [options.attendanceId='*'] ID do atendimento alvo ('*' para todos)
   * @param {object} [options.overridesItemCapabilities={}] Overrides pontuais nas capabilities de item
   * @param {object} [options.overridesGlobalCapabilities={}] Overrides pontuais nas capabilities globais da loja
   */
  interceptarTodasPermissoesAtendimento({
    attendanceId = '*',
    overridesItemCapabilities = {},
    overridesGlobalCapabilities = {}
  } = {}) {
    // 1. Permissões de Módulos da Loja (Recursos Globais)
    RecursosMocks.interceptResources({
      central: true,
      attendance: true,
      prescription: true,
      patient: true,
      prescriber: true,
      resale: true,
      redo: true,
      delivery: true,
      financial: true,
      metrics: true,
      report: true
    });

    // 2. Permissões Globais do Módulo de Atendimento (/attendance-capabilities)
    const todasCapabilitiesGlobais = {
      can_access_attendance_module: true,
      can_create_attendance: true,
      can_view_pending_attendance: true,
      can_view_occupied_attendance: true,
      can_create_customer_without_gender: true,
      can_list_group_agents: true,
      can_change_attendant_status: true,
      can_transfer_attendance: true,
      can_change_status: true,
      ...overridesGlobalCapabilities
    };
    this.interceptAttendanceCapabilitiesApi({ capabilities: todasCapabilitiesGlobais });

    // 3. Capabilities do Atendimento Individual (/attendances/:id/capabilities)
    const todasCapabilitiesItem = {
      can_view_attendance_detail: true,
      can_list_attendance_messages: true,
      can_send_attendance_messages: true,
      can_send_free_text: true,
      can_mark_completed: true,
      can_mark_discarded: true,
      can_mark_finished: true,
      can_transfer_assigned_attendance: true,
      can_transfer_pending_attendance: true,
      can_send_payment_link: true,
      can_add_movement: true,
      can_remove_movement: true,
      can_save_customer_on_attendance: true,
      can_change_attendant_status: true,
      can_change_default_customer: true,
      can_change_online_payment_with_benefit_program: true,
      can_transfer_omni_movement: true,
      can_manage_os_support: true,
      ...overridesItemCapabilities
    };
    this.interceptAttendanceItemCapabilitiesApi(attendanceId, { capabilities: todasCapabilitiesItem });

    // Registra no ambiente do Cypress para helpers de validação
    Cypress.env('LAST_ATTENDANCE_CAPABILITIES', todasCapabilitiesGlobais);
    Cypress.env('LAST_ATTENDANCE_ITEM_CAPABILITIES', todasCapabilitiesItem);

    // 4. Capabilities de Mensagens Padrão (/standard-message-capabilities)
    this.interceptStandardMessageCapabilitiesApi({
      capabilities: {
        can_view_standard_messages: true,
        can_create_standard_messages: true,
        can_edit_standard_messages: true,
        can_delete_standard_messages: true
      }
    });

    // 5. Dados do Usuário Atendente (/user/me)
    this.interceptUserMeApi();

    // 6. Agentes dos Grupos de Atendimento (/attendance-groups/:groupId/agents)
    this.interceptMockAgentsGroup('*');

    // 7. Canais, Grupos e Templates
    IniciarAtendimentoMocks.interceptarCanais();
    IniciarAtendimentoMocks.interceptarBuscaGrupos();
    IniciarAtendimentoMocks.interceptarMensagensPadrao();
    IniciarAtendimentoMocks.interceptarBuscaTemplatesWaba();
    this.interceptAttendanceMessageTemplatesApi('*');
    this.interceptAttendanceEventsApi('*');
  }

  /**
   * Intercepta ambiente 100% mockado para teste da Permissão 557 (Transferência com outro atendente atribuído)
   * @param {object} options
   * @param {boolean} options.canTransferAssigned Se a permissão 557 está concedida
   * @param {boolean} options.canTransferPending Sempre false para atendimento atribuído
   */
  interceptMockPermissao557({ canTransferAssigned = true, canTransferPending = false, attendanceId = null } = {}) {
    const idNum = attendanceId || (canTransferAssigned ? 260800095 : 260800096);
    const itemCapabilities = {
      ...this.mockAttendanceItemCapabilitiesData.capabilities,
      can_transfer_assigned_attendance: canTransferAssigned,
      can_transfer_pending_attendance: canTransferPending,
      can_transfer: canTransferAssigned || canTransferPending,
      can_transfer_attendance: canTransferAssigned || canTransferPending,
      can_transfer_occupied_attendance: canTransferAssigned
    };

    Cypress.env('LAST_ATTENDANCE_ITEM_CAPABILITIES', itemCapabilities);

    // 1. Listagem com atendimento atribuído a outro colega (ITALO PATRICK)
    const cardColega = {
      id: idNum,
      reference_at: "2026-09-17T19:19:15.294Z",
      attendant_name: "ITALO PATRICK",
      customer_name: "Marcia",
      customer_phone: "556296566248",
      messages: {
        unread_count: 0,
        last_message: {
          type: 1,
          content_type: "text",
          body: "Olá",
          occurred_at: "2026-09-17T19:19:18.515Z"
        }
      },
      status: 0,
      custom_status: null,
      channel: {
        id: 6,
        name: "WHATSAPP OFICIAL - 62 98222-4382",
        type: 1,
        subtype: 1
      },
      group: {
        id: 7,
        name: "ATENDIMENTO"
      }
    };

    const listPayload = {
      items: [cardColega],
      pagination: {
        page: 1,
        per_page: 20,
        total: 1,
        total_pages: 1,
        has_next: false,
        has_previous: false,
        has_prev: false
      }
    };

    this.interceptAttendancesListApi(listPayload);
    cy.intercept('GET', new RegExp(regexApi('attendances(\\?.*)?$')), {
      statusCode: 200,
      body: listPayload
    }).as('getAttendancesList');

    // 2. Detalhe do atendimento
    const detailPayload = {
      attendance: {
        ...this.mockAttendanceDetailData.attendance,
        id: idNum,
        status: 0,
        attendant: { id: 10, name: "ITALO PATRICK" },
        attendant_id: 10,
        attendant_name: "ITALO PATRICK",
        service_window_active: true
      },
      customer: {
        ...this.mockAttendanceDetailData.customer,
        customer_id: 867092,
        name: "Marcia",
        phone: "556296566248"
      },
      summaries: { quotes: { count: 0, total_amount: 0 }, payment_links: { count: 0, pending_confirmation_count: 0 } },
      capabilities: itemCapabilities
    };
    this.interceptAttendanceDetailApi('*', detailPayload);

    // 3. Capabilities do item
    this.interceptAttendanceItemCapabilitiesApi('*', { capabilities: itemCapabilities });

    // 4. Mensagens e Orçamentos
    this.interceptMessagesListApi(idNum, { data: [] });
    this.interceptBudgetsApi(idNum, []);
  }

  /**
   * Intercepta ambiente 100% mockado para teste da Permissão 649 (Transferência de conversa sem atendente vinculado)
   * @param {object} options
   * @param {boolean} options.canTransferPending Se a permissão 649 está concedida
   * @param {boolean} options.canTransferAssigned Sempre false para conversa sem atendente
   * @param {number|null} options.attendanceId ID opcional do atendimento
   */
  interceptMockPermissao649({ canTransferPending = true, canTransferAssigned = false, attendanceId = null } = {}) {
    const idNum = attendanceId || (canTransferPending ? 260800097 : 260800098);
    const itemCapabilities = {
      ...this.mockAttendanceItemCapabilitiesData.capabilities,
      can_transfer_pending_attendance: canTransferPending,
      can_transfer_assigned_attendance: canTransferAssigned,
      can_transfer: canTransferPending || canTransferAssigned,
      can_transfer_attendance: canTransferPending || canTransferAssigned,
      can_transfer_occupied_attendance: canTransferAssigned
    };

    Cypress.env('LAST_ATTENDANCE_ITEM_CAPABILITIES', itemCapabilities);

    // 1. Listagem com atendimento sem atendente vinculado (órfão / sem atendente)
    const cardOrfao = {
      id: idNum,
      reference_at: "2026-09-17T19:19:15.294Z",
      attendant_name: null,
      customer_name: "CLIENTE TESTE ORFAO",
      customer_phone: "556296566248",
      messages: {
        unread_count: 0,
        last_message: {
          type: 1,
          content_type: "text",
          body: "Olá",
          occurred_at: "2026-09-17T19:19:18.515Z"
        }
      },
      status: 0,
      custom_status: null,
      channel: {
        id: 6,
        name: "WHATSAPP OFICIAL - 62 98222-4382",
        type: 1,
        subtype: 1
      },
      group: {
        id: 7,
        name: "ATENDIMENTO"
      }
    };

    const listPayload = {
      items: [cardOrfao],
      pagination: {
        page: 1,
        per_page: 20,
        total: 1,
        total_pages: 1,
        has_next: false,
        has_previous: false,
        has_prev: false
      }
    };

    this.interceptAttendancesListApi(listPayload);
    cy.intercept('GET', new RegExp(regexApi('attendances(\\?.*)?$')), {
      statusCode: 200,
      body: listPayload
    }).as('getAttendancesList');

    // 2. Detalhe do atendimento
    const detailPayload = {
      attendance: {
        ...this.mockAttendanceDetailData.attendance,
        id: idNum,
        status: 0,
        attendant: null,
        attendant_id: null,
        attendant_name: null,
        service_window_active: true
      },
      customer: {
        ...this.mockAttendanceDetailData.customer,
        customer_id: 867093,
        name: "CLIENTE TESTE ORFAO",
        phone: "556296566248"
      },
      summaries: { quotes: { count: 0, total_amount: 0 }, payment_links: { count: 0, pending_confirmation_count: 0 } },
      capabilities: itemCapabilities
    };
    this.interceptAttendanceDetailApi('*', detailPayload);

    // 3. Capabilities do item
    this.interceptAttendanceItemCapabilitiesApi('*', { capabilities: itemCapabilities });

    // 4. Mensagens e Orçamentos
    this.interceptMessagesListApi(idNum, { data: [] });
    this.interceptBudgetsApi(idNum, []);
  }

  /**
   * Intercepta ambiente 100% mockado para a Permissão 650 (can_change_default_customer) — item "Vincular
   * cliente" no menu ⋮, exibido só quando customer.customer_id vier ausente (Issue #440/#441).
   * Confirmado por inspeção real (cy.salvarSnapshotDom, 2026-09-29): o gate lê a capability da rota
   * separada GET /attendances/:id/capabilities (interceptAttendanceItemCapabilitiesApi), não do campo
   * embutido no GET /attendances/:id — sobrescrever só o embutido não esconde o item.
   * @param {object} options
   * @param {boolean} options.canChangeDefaultCustomer Se a permissão 650 está concedida
   * @param {number|null} options.attendanceId ID opcional do atendimento
   */
  interceptMockPermissao650({ canChangeDefaultCustomer = true, attendanceId = null } = {}) {
    const idNum = attendanceId || (canChangeDefaultCustomer ? 260800200 : 260800201);
    const itemCapabilities = {
      ...this.mockAttendanceItemCapabilitiesData.capabilities,
      can_change_default_customer: canChangeDefaultCustomer
    };

    Cypress.env('LAST_ATTENDANCE_ITEM_CAPABILITIES', itemCapabilities);

    // 1. Detalhe do atendimento — customer.customer_id AUSENTE (pré-condição do item "Vincular cliente")
    const detailPayload = {
      attendance: { ...this.mockAttendanceDetailData.attendance, id: idNum },
      customer: { name: null, phone: '5511999990000', email: null, store_name: 'LOJA TESTE' },
      summaries: { quotes: { count: 0, total_amount: 0 }, payment_links: { count: 0, pending_confirmation_count: 0 } },
      capabilities: itemCapabilities
    };
    this.interceptAttendanceDetailApi('*', detailPayload);

    // 2. Capabilities do item (rota real usada pelo gate, confirmada por evidência)
    this.interceptAttendanceItemCapabilitiesApi('*', { capabilities: itemCapabilities });

    // 3. Mensagens e Orçamentos
    this.interceptMessagesListApi(idNum, { data: [] });
    this.interceptBudgetsApi(idNum, []);
  }

  /**
   * Intercepta ambiente 100% mockado para a Permissão 655 (can_view_pending_attendance) e a capability
   * can_take_attendance em atendimento sem atendente vinculado (backend#528/#561, front#434).
   * can_view_pending_attendance é capability de LOJA (/attendance-capabilities); can_take_attendance é
   * capability de ITEM (/attendances/:id/capabilities), computada pelo backend por grupo do atendente
   * (ou pelo grant 649, que segue funcionando como override e como guarda de "entregar para terceiro").
   * @param {object} options
   * @param {boolean} options.canView Concede/revoga can_view_pending_attendance (655)
   * @param {boolean} options.canTake Concede/revoga can_take_attendance (botão Assumir)
   * @param {boolean} options.canTransferPending Concede/revoga can_transfer_pending_attendance (649)
   * @param {number|null} options.attendanceId ID opcional do atendimento
   * @returns {{idNum: number, itemCapabilities: object}}
   */
  interceptMockPermissao655({ canView = true, canTake = true, canTransferPending = false, attendanceId = null } = {}) {
    const idNum = attendanceId || (canView ? 260800150 : 260800151);

    // 1. Capability de loja (655)
    this.interceptAttendanceCapabilitiesApi({
      capabilities: {
        can_access_attendance_module: true,
        can_create_attendance: true,
        can_view_pending_attendance: canView,
        can_view_occupied_attendance: true,
        can_create_customer_without_gender: false,
        can_list_group_agents: true,
        can_change_attendant_status: true,
        can_transfer_attendance: true,
        can_change_status: true
      }
    });

    // 2. Capabilities de item: envio sempre false sem atendente (regra do PR, com ou sem 655)
    const itemCapabilities = {
      ...this.mockAttendanceItemCapabilitiesData.capabilities,
      can_view_pending_attendance: canView,
      can_take_attendance: canTake,
      can_transfer_pending_attendance: canTransferPending,
      can_transfer_assigned_attendance: false,
      can_list_attendance_messages: canView,
      can_send_attendance_messages: false,
      can_send_free_text: false
    };

    Cypress.env('LAST_ATTENDANCE_ITEM_CAPABILITIES', itemCapabilities);

    // 3. Listagem: card sem atendente. Sem 655, last_message.body degrada para null preservando
    //    type/content_type/occurred_at (contrato documentado na issue front#420).
    const cardSemAtendente = {
      id: idNum,
      reference_at: "2026-09-25T12:00:00.000Z",
      attendant_name: null,
      customer_name: "CLIENTE PENDENTE SEM ATENDENTE",
      customer_phone: "556296566249",
      messages: {
        unread_count: 1,
        last_message: {
          type: 1,
          content_type: "text",
          body: canView ? "Preciso de ajuda com meu pedido" : null,
          occurred_at: "2026-09-25T12:00:05.000Z"
        }
      },
      status: 0,
      custom_status: null,
      channel: {
        id: 6,
        name: "WHATSAPP OFICIAL - 62 98222-4382",
        type: 1,
        subtype: 1
      },
      group: {
        id: 7,
        name: "ATENDIMENTO"
      }
    };

    const listPayload = {
      items: [cardSemAtendente],
      pagination: {
        page: 1,
        per_page: 20,
        total: 1,
        total_pages: 1,
        has_next: false,
        has_previous: false,
        has_prev: false
      }
    };

    this.interceptAttendancesListApi(listPayload);
    cy.intercept('GET', new RegExp(regexApi('attendances(\\?.*)?$')), {
      statusCode: 200,
      body: listPayload
    }).as('getAttendancesList');

    // 4. Detalhe: attendant null; notes/summaries.quotes/summaries.payment_links podem vir null
    //    (bug corrigido no front#434 — antes derrubava o detalhe inteiro, "Não foi possível carregar
    //    os detalhes do atendimento"; agora deve virar contadores zerados sem crashar).
    const detailPayload = {
      attendance: {
        ...this.mockAttendanceDetailData.attendance,
        id: idNum,
        status: 0,
        attendant: null,
        attendant_id: null,
        attendant_name: null,
        notes: null,
        service_window_active: true
      },
      customer: {
        ...this.mockAttendanceDetailData.customer,
        customer_id: 867094,
        name: "CLIENTE PENDENTE SEM ATENDENTE",
        phone: "556296566249"
      },
      summaries: { quotes: null, payment_links: null },
      capabilities: itemCapabilities
    };
    this.interceptAttendanceDetailApi('*', detailPayload);
    this.interceptAttendanceItemCapabilitiesApi('*', { capabilities: itemCapabilities });

    // 5. Rotas de conteúdo: sem 655, o front não deve buscá-las (guard client-side). Registramos a
    //    resposta real esperada pelo backend (403 ATTENDANCE_TAKE_REQUIRED) só como rede de segurança —
    //    a asserção do teste prova a ausência da chamada, não o corpo desta resposta (ver "Precedência
    //    de Rota HTTP", AGENTS.md §6 / PR #306).
    const respostaTakeRequired = {
      statusCode: 403,
      body: { error: 'ATTENDANCE_TAKE_REQUIRED', message: 'Assuma este atendimento para acessar o conteúdo.' }
    };

    if (canView) {
      this.interceptMessagesListApi(idNum, {
        data: [{ id: 1, origin: 'customer', content_type: 'text', content: 'Preciso de ajuda com meu pedido', created_at: '2026-09-25T12:00:05.000Z', message_status: 'ready', attachment: null, replied_message: null }],
        pagination: { page: 1, per_page: 20, total: 1, total_pages: 1, has_next: false, has_previous: false }
      });
      this.interceptBudgetsApi(idNum, [], true);
      this.interceptPaymentLinksApi(idNum, { items: [], data: [] }, true);
    } else {
      cy.intercept('GET', rotaApi(`attendances/${idNum}/messages*`), respostaTakeRequired).as('getAttendanceMessages');
      cy.intercept('GET', rotaApi(`attendances/${idNum}/budgets*`), respostaTakeRequired).as('getAttendanceBudgets');
      cy.intercept('GET', rotaApi(`attendances/${idNum}/payment-links*`), respostaTakeRequired).as('getPaymentLinks');
    }

    return { idNum, itemCapabilities };
  }

  /**
   * Intercepta a ação de Assumir Atendimento (PATCH .../attendances/:id com target_attendant_id do
   * usuário logado, SEM channel_group_id — backend#528/#571, front#505/PR #511).
   * Códigos de erro atualizados pela front#505: `ATTENDANCE_GROUP_MISMATCH` (backend#561, fechada
   * sem merge) nunca existiu na API real e foi substituído por `ATTENDANCE_GROUP_REQUIRED`
   * (403 — não é do grupo, ou o atendimento não tem grupo) e `ATTENDANCE_NOT_PENDING` (409 — o
   * atendimento já não está Pendente); confirmado via bundle real (`index-D44fQXrl.js`: zero
   * ocorrências de `ATTENDANCE_GROUP_MISMATCH`, `VC` mapeia os dois códigos novos para mensagem
   * própria do assumir, nunca o aviso genérico de transferência).
   * @param {string|number} attendanceId ID do atendimento
   * @param {'sucesso'|'conflito'|'grupo'|'pendente'} resultado Resultado simulado da ação
   * @param {string} nomeConflito Nome do atendente que assumiu primeiro (cenário de conflito 409)
   */
  interceptAssumirAtendimentoApi(attendanceId, resultado = 'sucesso', nomeConflito = 'ITALO PATRICK') {
    const attendant = this.getLoggedAttendant();
    const pattern = new RegExp(regexApi(`attendances/${attendanceId}([?#].*)?$`));

    const respostas = {
      sucesso: {
        statusCode: 200,
        body: {
          id: Number(attendanceId),
          status: 0,
          attendant_id: attendant.id,
          attendant: { id: attendant.id, name: attendant.name },
          attendance: {
            id: Number(attendanceId),
            status: 0,
            attendant_id: attendant.id,
            attendant: { id: attendant.id, name: attendant.name }
          }
        }
      },
      // Campo do código de erro é "code", não "error" — confirmado em responseParser-*.js (_u:
      // `t?.code?.trim()`), achado real 2026-10-02: com "error", o front nunca reconhece o código
      // (errorCode vem undefined) e cai no toast genérico "Você não tem permissão para transferir
      // este atendimento" em vez da mensagem própria do assumir (VC, front#505/PR #511).
      conflito: {
        statusCode: 409,
        body: { code: 'ATTENDANCE_ALREADY_ASSIGNED', message: `${nomeConflito} já assumiu este atendimento.` }
      },
      grupo: {
        statusCode: 403,
        body: { code: 'ATTENDANCE_GROUP_REQUIRED', message: 'Você não pertence ao grupo deste atendimento.' }
      },
      pendente: {
        statusCode: 409,
        body: { code: 'ATTENDANCE_NOT_PENDING', message: 'Só é possível assumir atendimentos pendentes.' }
      }
    };

    cy.intercept('PATCH', pattern, (req) => {
      // Confirma o contrato documentado: assumir exige apenas target_attendant_id, SEM channel_group_id
      expect(req.body).to.have.property('target_attendant_id', attendant.id);
      expect(req.body).to.not.have.property('channel_group_id');
      req.reply(respostas[resultado]);
      // Sinaliza pra interceptDetalheComTransicaoDeAssumir que a transição já pode valer no
      // próximo GET que vier a ser respondido - nunca contar chamadas (ver nota acima).
      this._assumirTransicaoDisparada = true;
    }).as('assumirAtendimentoPatch');
  }

  /**
   * Intercepta o detalhe do atendimento com transição de estado após a 1ª chamada: nasce sem
   * atendente (can_take_attendance: true) e passa a refletir o resultado da ação de Assumir a partir
   * da 2ª chamada (refetch pós-PATCH) — 'sucesso' (dono passa a ser o atendente logado, mensagens e
   * envio liberados) ou 'conflito' (dono passa a ser um terceiro, simulando dois atendentes assumindo
   * ao mesmo tempo / ATTENDANCE_ALREADY_ASSIGNED).
   * @param {string|number} attendanceId ID do atendimento
   * @param {object} itemCapabilities Capabilities-base do item a estender
   * @param {'sucesso'|'conflito'} resultado Resultado da transição pós-refetch
   * @param {string} nomeConflito Nome do atendente que vence a corrida (cenário 'conflito')
   * @param {number} idConflito ID do atendente que vence a corrida (cenário 'conflito')
   */
  interceptDetalheComTransicaoDeAssumir(attendanceId, itemCapabilities, resultado = 'sucesso', nomeConflito = 'ITALO PATRICK', idConflito = 10) {
    const attendant = this.getLoggedAttendant();
    const detailRegex = new RegExp(regexApi(`attendances/${attendanceId}([?#].*)?$`));
    // Reseta por cenário, nunca por contagem de GET (achado real 2026-10-07, medido contra
    // api.omnicare.dev.local: o app faz exatamente 1 refetch do detalhe, ~150ms depois do PATCH
    // responder; contar chamadas quebrava quando o `cy.reload()` do teste disparava um GET
    // extra de boot antes do clique deliberado - a 2ª chamada nominal nem sempre era a pós-PATCH).
    // A transição só vale depois que o PATCH de assumir responder de verdade (sinalizado por
    // interceptAssumirAtendimentoApi), nunca pela ordem/contagem de GETs.
    this._assumirTransicaoDisparada = false;

    cy.intercept('GET', detailRegex, (req) => {
      const jaTransicionou = this._assumirTransicaoDisparada;
      const donoId = resultado === 'sucesso' ? attendant.id : idConflito;
      const donoNome = resultado === 'sucesso' ? attendant.name : nomeConflito;

      req.reply({
        statusCode: 200,
        body: {
          attendance: {
            ...this.mockAttendanceDetailData.attendance,
            id: Number(attendanceId),
            status: 0,
            attendant: jaTransicionou ? { id: donoId, name: donoNome } : null,
            attendant_id: jaTransicionou ? donoId : null,
            attendant_name: jaTransicionou ? donoNome : null,
            notes: jaTransicionou ? '' : null,
            service_window_active: true
          },
          customer: {
            ...this.mockAttendanceDetailData.customer,
            customer_id: 867095,
            name: "CLIENTE TRANSICAO ASSUMIR",
            phone: "556296566250"
          },
          summaries: jaTransicionou
            ? { quotes: { count: 0, total_amount: 0 }, payment_links: { count: 0, pending_confirmation_count: 0 } }
            : { quotes: null, payment_links: null },
          capabilities: {
            ...itemCapabilities,
            can_take_attendance: !jaTransicionou,
            can_send_attendance_messages: jaTransicionou && resultado === 'sucesso',
            can_send_free_text: jaTransicionou && resultado === 'sucesso'
          }
        }
      });
    }).as('getAttendanceDetail');

    if (resultado === 'sucesso') {
      this.interceptMessagesListApi(Number(attendanceId), {
        data: [{ id: 1, origin: 'customer', content_type: 'text', content: 'Preciso de ajuda com meu pedido', created_at: '2026-09-25T12:00:05.000Z', message_status: 'ready', attachment: null, replied_message: null }],
        pagination: { page: 1, per_page: 20, total: 1, total_pages: 1, has_next: false, has_previous: false }
      });
    }
  }

  /**
   * Intercepta o envio de mensagem retornando 409 ATTENDANCE_UNASSIGNED (tentativa de enviar sem
   * assumir o atendimento primeiro — backend#528/#561).
   * @param {string|number} attendanceId ID do atendimento ('*' para todos)
   */
  interceptEnvioMensagemSemAtendenteApi(attendanceId = '*') {
    cy.intercept('POST', rotaApi(`attendances/${attendanceId}/messages*`), {
      statusCode: 409,
      body: { error: 'ATTENDANCE_UNASSIGNED', message: 'Assuma este atendimento antes de enviar mensagens.' }
    }).as('sendChatMessage');
  }

  /**
   * Intercepta ambiente 100% mockado para a Badge de Substatus Personalizado na fila e no
   * cabeçalho do chat (backend#499/#501-503, front#396). O card da fila declara group.name,
   * customer_phone e custom_status (contrato que o zod do front descartava antes desta entrega).
   * @param {object} options
   * @param {object|null} options.customStatus Objeto { id, name, parent_status, text_color, background_color } ou null
   * @param {number|null} options.attendanceId ID opcional do atendimento
   * @param {string} options.groupName Nome do grupo exibido no card (regressão do campo descartado pelo zod)
   * @returns {{idNum: number, itemCapabilities: object}}
   */
  interceptMockSubstatusPersonalizado({ customStatus = null, attendanceId = null, groupName = 'FARMÁCIA CENTRAL' } = {}) {
    const idNum = attendanceId || 260800200;
    const attendant = this.getLoggedAttendant();
    const parentStatus = customStatus?.parent_status ?? 1;

    // Estado vivo do cenário (mesmo padrão de interceptDetalheComTransicaoDeAssumir): após o PATCH
    // de vincular/desvincular substatus ou de mudar o status, o front faz setQueryData com a
    // resposta e, logo em seguida, invalida o detalhe e a lista. Com GET estático o refetch
    // devolvia o estado ANTERIOR e desfazia a badge — a asserção só passava se caísse na janela
    // entre o setQueryData e o refetch (intermitência real dos #12.6-#12.8 da 5-A). Os PATCHes
    // (interceptVincularSubstatusApi / interceptUpdateAttendanceStatusApi) atualizam este estado e
    // os GETs abaixo respondem a partir dele.
    this._statusAtual = parentStatus;
    this._substatusAtual = customStatus;

    const montarCard = () => ({
      id: idNum,
      reference_at: "2026-09-25T12:00:00.000Z",
      attendant_name: attendant.name,
      attendant: attendant,
      attendant_id: attendant.id,
      customer_name: "CLIENTE SUBSTATUS",
      customer_phone: "556299887766",
      messages: {
        unread_count: 0,
        last_message: { type: 1, content_type: "text", body: "Preciso de um orçamento", occurred_at: "2026-09-25T12:00:05.000Z" }
      },
      status: this._statusAtual,
      custom_status: this._substatusAtual,
      channel: { id: 6, name: "WHATSAPP OFICIAL - 62 98222-4382", type: 1, subtype: 1 },
      group: { id: 7, name: groupName }
    });

    const montarListPayload = () => ({
      items: [montarCard()],
      pagination: { page: 1, per_page: 20, total: 1, total_pages: 1, has_next: false, has_previous: false, has_prev: false }
    });
    this.interceptAttendancesListApi(montarListPayload());
    cy.intercept('GET', new RegExp(regexApi('attendances(\\?.*)?$')), (req) => {
      req.reply({ statusCode: 200, body: montarListPayload() });
    }).as('getAttendancesList');

    const itemCapabilities = {
      ...this.mockAttendanceItemCapabilitiesData.capabilities,
      can_create_attendance_custom_status: true,
      can_update_attendance_custom_status: true
    };
    Cypress.env('LAST_ATTENDANCE_ITEM_CAPABILITIES', itemCapabilities);

    const montarDetailPayload = (reqId) => ({
      attendance: {
        ...this.mockAttendanceDetailData.attendance,
        id: reqId,
        status: this._statusAtual,
        custom_status: this._substatusAtual,
        attendant,
        attendant_id: attendant.id,
        attendant_name: attendant.name,
        service_window_active: true
      },
      customer: {
        ...this.mockAttendanceDetailData.customer,
        customer_id: 867200,
        name: "CLIENTE SUBSTATUS",
        phone: "556299887766"
      },
      summaries: { quotes: { count: 0, total_amount: 0 }, payment_links: { count: 0, pending_confirmation_count: 0 } },
      capabilities: itemCapabilities
    });
    // Espelha interceptAttendanceDetailApi('*', payload) (id lido da URL, capabilities em env,
    // validação de schema), mas montando o corpo a cada GET a partir do estado vivo.
    cy.intercept('GET', new RegExp(regexApi('attendances/\\d+([?#].*)?$')), (req) => {
      const match = req.url.match(/\/attendances\/(\d+)/);
      const reqId = match ? parseInt(match[1], 10) : idNum;
      const responseBody = montarDetailPayload(reqId);
      Cypress.env('LAST_ATTENDANCE_ITEM_CAPABILITIES', responseBody.capabilities);
      validarSchemaMock('AtendimentosMocks', 'getAttendanceDetail', responseBody);
      req.reply({ statusCode: 200, body: responseBody });
    }).as('getAttendanceDetail');
    this.interceptAttendanceItemCapabilitiesApi('*', { capabilities: itemCapabilities });
    this.interceptMessagesListApi(idNum, {
      data: [],
      pagination: { page: 1, per_page: 20, total: 0, total_pages: 0, has_next: false, has_previous: false }
    });
    this.interceptBudgetsApi(idNum, [], true);
    this.interceptPaymentLinksApi(idNum, { items: [], data: [] }, true);

    return { idNum, itemCapabilities };
  }

  /**
   * Intercepta o catálogo de substatus personalizados (GET .../attendance-custom-statuses),
   * agrupados por parent_status. Formato de resposta: {items, total, truncated} (backend#499/#501-503).
   * @param {Array} items Lista de substatus (cada um com {id, name, parent_status, order, text_color, background_color})
   * @param {boolean} truncated Se o corte FIRST 500 do backend cortou o catálogo
   */
  interceptAttendanceCustomStatusesApi(items = null, truncated = false) {
    const defaultItems = [
      { id: 2, name: 'BANIDO', parent_status: 3, order: 1, text_color: '#FFFFFF', background_color: null },
      { id: 7, name: 'AGUARDANDO RESPOSTA', parent_status: 0, order: 1, text_color: '#FFFFFF', background_color: '#FFFFFF' },
      { id: 8, name: 'ORCAMENTO CRIADO', parent_status: 1, order: 1, text_color: '#FFFFFF', background_color: '#FFFFFF' }
    ];
    const payloadItems = items || defaultItems;

    cy.intercept('GET', rotaApi('attendance-custom-statuses*'), {
      statusCode: 200,
      body: { items: payloadItems, total: payloadItems.length, truncated }
    }).as('getAttendanceCustomStatuses');
  }

  /**
   * Intercepta o PATCH de vincular/desvincular substatus (custom_status_id: int vincula,
   * null desvincula, ausente não mexe). O contrato real devolve custom_status SEMPRE, mas
   * pode devolver a resposta SEM o campo status quando só custom_status_id foi tocado —
   * quem consumir a resposta não pode presumir a presença de status (achado real do dev, 25/09/2026).
   * @param {string|number} attendanceId ID do atendimento
   * @param {object|null} customStatusResultante Objeto custom_status devolvido pelo PATCH (null = desvinculado)
   * @param {object} opcoes { incluirStatusNaResposta, statusCode, erro }
   */
  interceptVincularSubstatusApi(attendanceId, customStatusResultante, { incluirStatusNaResposta = false, statusCode = 200, erro = null } = {}) {
    const pattern = new RegExp(regexApi(`attendances/${attendanceId}([?#].*)?$`));

    cy.intercept('PATCH', pattern, (req) => {
      if (erro) {
        req.reply({ statusCode, body: erro });
        return;
      }

      const body = { custom_status: customStatusResultante };
      if (incluirStatusNaResposta) {
        body.status = req.body?.status ?? 1;
      }
      // Estado vivo lido pelos GETs de interceptMockSubstatusPersonalizado: o refetch pós-PATCH
      // passa a devolver o substatus resultante, em vez de desfazer a badge com o estado anterior.
      this._substatusAtual = customStatusResultante;
      req.reply({ statusCode: 200, body });
    }).as('vincularSubstatusPatch');
  }

  /**
   * Intercepta a criação de substatus personalizado (POST .../attendance-custom-statuses).
   * @param {'sucesso'|'erro500'} resultado Resultado simulado
   * @param {object|null} novoSubstatus Objeto devolvido em caso de sucesso
   */
  interceptCriarSubstatusApi(resultado = 'sucesso', novoSubstatus = null) {
    const respostas = {
      sucesso: {
        statusCode: 201,
        body: novoSubstatus || { id: 99, name: 'NOVO SUBSTATUS', parent_status: 1, order: 2, text_color: null, background_color: null }
      },
      // backend#509 (achado do dev em 25/09/2026): INSERT em OC_STATUS_PERSONALIZADO não escreve
      // ALTERACAO_CF (NOT NULL), Firebird recusa e não há handler de DataAccessException — 500 genérico.
      // Mantido como cenário simulado (não medido ao vivo nesta rodada: POST real cria um registro
      // permanente e IRREMOVÍVEL pela web no catálogo do tenant — ver item 5 da issue).
      erro500: {
        statusCode: 500,
        body: { message: 'An unexpected error occurred' }
      }
    };

    cy.intercept('POST', rotaApi('attendance-custom-statuses*'), respostas[resultado]).as('criarSubstatusPost');
  }

  /**
   * Intercepta a listagem de atendimentos retornando um mock customizável para testes de permissão
   * @param {string|null} nomeAtendenteMock Nome do atendente a ser injetado
   * @param {number|null} idAtendenteMock ID do atendente a ser injetado
   */
  interceptMockSemAtendente(nomeAtendenteMock = null, idAtendenteMock = null) {
    const itemCapabilities = {
      can_view_attendance_detail: true,
      can_list_attendance_messages: true,
      can_send_attendance_messages: true,
      can_mark_completed: true,
      can_mark_discarded: true,
      can_mark_finished: true,
      can_transfer_assigned_attendance: true,
      can_transfer_pending_attendance: true,
      can_send_payment_link: true,
      can_add_movement: true,
      can_remove_movement: true,
      can_save_customer_on_attendance: true,
      can_change_default_customer: true,
      can_change_online_payment_with_benefit_program: true,
      can_transfer_omni_movement: true,
      can_manage_os_support: false
    };

    this.interceptSummaryApi();
    this.interceptAttendanceCapabilitiesApi();
    this.interceptAttendanceItemCapabilitiesApi('*', { capabilities: itemCapabilities });
    this.interceptAttendanceDetailApi('*');
    this.interceptMessagesListApi('*');
    this.interceptAttendanceMessageTemplatesApi('*');
    this.interceptMockAgentsGroup('*');

    const payload = {
      "items": [
        {
          "id": 260800098,
          "reference_at": "2026-08-24T14:03:53.601Z",
          "attendant_name": null,
          "customer_name": "Klismam Monteiro",
          "messages": {
            "unread_count": 0,
            "last_message": {
              "type": 1,
              "body": "oi",
              "occurred_at": "2026-08-24T17:15:12.370Z"
            }
          },
          "status": 0,
          "capabilities": itemCapabilities,
          "channel": {
            "id": 6,
            "name": "WHATSAPP OFICIAL - 62 98222-4382",
            "type": 1,
            "subtype": 1
          },
          "group": {
            "id": 7,
            "name": "ATENDIMENTO"
          }
        },
        {
          "id": 260800095,
          "reference_at": "2026-08-24T14:03:53.601Z",
          "attendant_name": "ITALO PATRICK",
          "customer_name": "ITALO PATRICK",
          "attendant": {
            "id": 10,
            "name": "ITALO PATRICK"
          },
          "attendant_id": 10,
          "messages": {
            "unread_count": 0,
            "last_message": {
              "type": 0,
              "body": "Teste Anexo!",
              "occurred_at": "2026-08-24T17:15:12.370Z"
            }
          },
          "status": 1,
          "capabilities": itemCapabilities,
          "channel": {
            "id": 6,
            "name": "WHATSAPP OFICIAL - 62 98222-4382",
            "type": 1,
            "subtype": 1
          },
          "group": {
            "id": 7,
            "name": "ATENDIMENTO"
          }
        },
        {
          "id": 260800053,
          "reference_at": "2026-08-17T11:59:23.181Z",
          "attendant_name": nomeAtendenteMock || "KLISMAM MONTEIRO",
          "attendant": {
            "id": idAtendenteMock || 122,
            "name": nomeAtendenteMock || "KLISMAM MONTEIRO",
            "user_id": idAtendenteMock || 122
          },
          "attendant_id": idAtendenteMock || 122,
          "customer_name": "VINICIUS GOMES",
          "messages": {
            "unread_count": 1,
            "last_message": {
              "type": 1,
              "body": "Pagamento On-Line Cód.: 260800060, Aprovado!",
              "occurred_at": "2026-08-24T14:47:27.431Z"
            }
          },
          "status": 1,
          "capabilities": itemCapabilities,
          "channel": {
            "id": 6,
            "name": "WHATSAPP OFICIAL - 62 98222-4382",
            "type": 1,
            "subtype": 1
          },
          "group": {
            "id": 7,
            "name": "ATENDIMENTO"
          }
        },
        {
          "id": 260800035,
          "reference_at": "2026-08-11T11:23:47.908Z",
          "attendant_name": "NICOLAS AGUIAR",
          "customer_name": "MARISTELA",
          "messages": {
            "unread_count": 0,
            "last_message": {
              "type": 1,
              "body": "oi",
              "occurred_at": "2026-08-24T14:48:47.017Z"
            }
          },
          "status": 2,
          "channel": {
            "id": 6,
            "name": "WHATSAPP OFICIAL - 62 98222-4382",
            "type": 1,
            "subtype": 1
          },
          "group": {
            "id": 7,
            "name": "ATENDIMENTO"
          }
        },
        {
          "id": 260800008,
          "reference_at": "2026-08-04T13:46:11.834Z",
          "attendant_name": nomeAtendenteMock || "GUSTAVO HENRIQUE",
          "customer_name": "GUSTAVO HENRIQUE",
          "attendant": {
            "id": idAtendenteMock || 10,
            "name": nomeAtendenteMock || "GUSTAVO HENRIQUE"
          },
          "messages": {
            "unread_count": 0,
            "last_message": {
              "type": 1,
              "body": "oi",
              "occurred_at": "2026-08-24T14:49:15.549Z"
            }
          },
          "status": 2,
          "channel": {
            "id": 6,
            "name": "WHATSAPP OFICIAL - 62 98222-4382",
            "type": 1,
            "subtype": 1
          },
          "group": {
            "id": 7,
            "name": "ATENDIMENTO"
          }
        }
      ],
      "pagination": { "page": 1, "per_page": 20, "total": 5, "total_pages": 1, "has_next": false, "has_previous": false }
    };

    cy.intercept('GET', rotaApi('attendances?*'), {
      statusCode: 200,
      body: payload
    }).as('getAttendancesList');
  }

  /**
   * Intercepta a busca de atendimentos especificando o parâmetro de query ?search=
   * @param {object|null} customPayload Payload customizado opcional
   */
  interceptSearchApi(customPayload = null) {
    this.interceptRoute({
      method: 'GET',
      urlPattern: rotaApi('attendances?*search=*'),
      customPayload,
      defaultBody: this.mockSearchData,
      fixturePath: '5.atendimentos/searchAttendances.json',
      alias: 'searchAttendancesApi'
    });
  }

  /**
   * Intercepta a busca forçando um resultado de Canal Oficial com Janela Expirada
   */
  interceptMockBuscaJanelaExpirada() {
    const payload = JSON.parse(JSON.stringify(this.mockAttendancesListData));
    if (payload.items && payload.items.length > 0) {
      payload.items[0].status = 0;
      payload.items[0].service_window_active = false;
      payload.items[0].channel = {
        id: 6,
        name: "WHATSAPP OFICIAL - 62 98222-4382",
        type: 1,
        subtype: 1,
        official: true
      };
    }
    this.interceptSearchApi(payload);
  }

  /**
   * Intercepta suíte 100% hermética para atendimento com Janela Expirada (PR #250)
   * Intercepta a listagem, o detalhe, capabilities, mensagens, orçamentos e links de pagamento
   */
  interceptMockDetalheJanelaExpirada(attendanceId = 26080076) {
    const attendant = this.getLoggedAttendant();
    const idNum = parseInt(attendanceId, 10) || 26080076;

    const listItem = {
      id: idNum,
      reference_at: "2026-08-11T11:23:47.908Z",
      attendant_name: attendant.name,
      attendant: attendant,
      attendant_id: attendant.id,
      customer_name: "MARISTELA",
      messages: {
        unread_count: 0,
        last_message: {
          type: 1,
          body: "Olá, gostaria de um orçamento",
          occurred_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString()
        }
      },
      status: 1,
      channel: {
        id: 6,
        name: "WHATSAPP OFICIAL - 62 98222-4382",
        type: 1,
        subtype: 1,
        official: true
      },
      group: {
        id: 7,
        name: "ATENDIMENTO"
      }
    };

    const queuePayload = {
      items: [listItem],
      pagination: { page: 1, per_page: 20, total: 1, total_pages: 1, has_next: false, has_previous: false }
    };

    // 1. Intercepta a listagem e busca da fila de atendimentos
    cy.intercept('GET', rotaApi('attendances?*'), {
      statusCode: 200,
      body: queuePayload
    }).as('getAttendancesList');

    cy.intercept('GET', rotaApi('attendances?*search=*'), {
      statusCode: 200,
      body: queuePayload
    }).as('searchAttendancesApi');

    // 2. Intercepta o detalhe do atendimento
    const detailRegex = new RegExp(regexApi(`attendances/(${idNum}|\\*|\\d+)([?#].*)?$`));
    cy.intercept('GET', detailRegex, {
      statusCode: 200,
      body: {
        attendance: {
          id: idNum,
          reference_at: "2026-08-11T11:23:47.908Z",
          notes: null,
          status: 1,
          channel: {
            id: 6,
            name: "WHATSAPP OFICIAL - 62 98222-4382",
            type: 1,
            subtype: 1,
            official: true
          },
          group: {
            id: 7,
            name: "ATENDIMENTO"
          },
          attendant: attendant,
          attendant_id: attendant.id,
          attendant_name: attendant.name,
          service_window_active: false,
          last_customer_message_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
          service_window: null
        },
        customer: {
          customer_id: 867092,
          name: "MARISTELA",
          phone: "5511999998888",
          email: null,
          store_name: "LOJA TESTE"
        },
        summaries: {
          quotes: { count: 2, total_amount: 346.49 },
          payment_links: { count: 1, pending_confirmation_count: 1 }
        },
        capabilities: {
          ...this.mockAttendanceItemCapabilitiesData.capabilities,
          can_send_free_text: false,
          can_create_quote: true,
          can_create_payment_link: true,
          can_send_payment_link: true
        }
      }
    }).as('getAttendanceDetail');

    // 3. Capabilities específicas do atendimento
    cy.intercept('GET', rotaApi(`attendances/${idNum}/capabilities*`), {
      statusCode: 200,
      body: {
        capabilities: {
          ...this.mockAttendanceItemCapabilitiesData.capabilities,
          can_send_free_text: false,
          can_create_quote: true,
          can_create_payment_link: true,
          can_send_payment_link: true
        }
      }
    }).as('getAttendanceItemCapabilities');

    // 4. Mensagens
    this.interceptMessagesListApi(idNum, this.mockMessagesExpiradas);

    // 5. Orçamentos vinculados (utiliza defaultBudgets com itens e totais canônicos)
    this.interceptBudgetsApi(idNum, null, true);

    // 6. Links de pagamento (utiliza defaultPayload canônico)
    this.interceptPaymentLinksApi(idNum, null, true);

    // 7. Configurações de pagamento / operadoras ativas (necessário para habilitar criação de links)
    cy.intercept('GET', rotaApi('payment-configs*'), {
      statusCode: 200,
      body: {
        items: [
          {
            id: 3,
            description: "Cielo",
            installment_min_amount: 10,
            installment_max_count: 12,
            online_payment_type: 1
          },
          {
            id: 6,
            description: "PIX - Banco Inter",
            installment_min_amount: 1,
            installment_max_count: 1,
            online_payment_type: 5
          }
        ]
      }
    }).as('getPaymentConfigs');

    // 8. Sub-recursos adicionais
    cy.intercept('GET', rotaApi(`attendances/${idNum}/observations*`), { statusCode: 200, body: { items: [], total: 0 } }).as('getAttendanceObservations');
    cy.intercept('GET', rotaApi(`attendances/${idNum}/message-templates*`), { statusCode: 200, body: this.mockAttendanceTemplatesData }).as('getAttendanceTemplatesDrawer');
    cy.intercept('GET', rotaApi('attendances/*/message-templates*'), { statusCode: 200, body: this.mockAttendanceTemplatesData });
  }

  /**
   * Intercepta suíte 100% hermética para atendimento com Janela Aberta/Ativa (PR #250)
   */
  interceptMockDetalheJanelaAberta(attendanceId = 26080077) {
    const attendant = this.getLoggedAttendant();
    const idNum = parseInt(attendanceId, 10) || 26080077;

    const listItem = {
      id: idNum,
      reference_at: "2026-08-11T11:23:47.908Z",
      attendant_name: attendant.name,
      attendant: attendant,
      attendant_id: attendant.id,
      customer_name: "MARISTELA",
      messages: {
        unread_count: 0,
        last_message: {
          type: 1,
          body: "Olá, quero o orçamento",
          occurred_at: new Date().toISOString()
        }
      },
      status: 1,
      channel: {
        id: 6,
        name: "WHATSAPP OFICIAL - 62 98222-4382",
        type: 1,
        subtype: 1,
        official: true
      },
      group: {
        id: 7,
        name: "ATENDIMENTO"
      }
    };

    const queuePayload = {
      items: [listItem],
      pagination: { page: 1, per_page: 20, total: 1, total_pages: 1, has_next: false, has_previous: false }
    };

    cy.intercept('GET', rotaApi('attendances?*'), {
      statusCode: 200,
      body: queuePayload
    }).as('getAttendancesList');

    cy.intercept('GET', rotaApi('attendances?*search=*'), {
      statusCode: 200,
      body: queuePayload
    }).as('searchAttendancesApi');

    const detailRegex = new RegExp(regexApi(`attendances/(${idNum}|\\*|\\d+)([?#].*)?$`));
    cy.intercept('GET', detailRegex, {
      statusCode: 200,
      body: {
        attendance: {
          id: idNum,
          reference_at: "2026-08-11T11:23:47.908Z",
          notes: null,
          status: 1,
          channel: {
            id: 6,
            name: "WHATSAPP OFICIAL - 62 98222-4382",
            type: 1,
            subtype: 1,
            official: true
          },
          group: {
            id: 7,
            name: "ATENDIMENTO"
          },
          attendant: attendant,
          attendant_id: attendant.id,
          attendant_name: attendant.name,
          service_window_active: true,
          last_customer_message_at: new Date().toISOString(),
          service_window: {
            started_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 86400000).toISOString(),
            remaining_seconds: 72000
          }
        },
        customer: {
          customer_id: 867092,
          name: "MARISTELA",
          phone: "5511999998888",
          email: null,
          store_name: "LOJA TESTE"
        },
        summaries: {
          quotes: { count: 2, total_amount: 346.49 },
          payment_links: { count: 1, pending_confirmation_count: 1 }
        },
        capabilities: {
          ...this.mockAttendanceItemCapabilitiesData.capabilities,
          can_send_free_text: true,
          can_create_quote: true,
          can_create_payment_link: true,
          can_send_payment_link: true
        }
      }
    }).as('getAttendanceDetail');

    cy.intercept('GET', rotaApi(`attendances/${idNum}/capabilities*`), {
      statusCode: 200,
      body: {
        capabilities: {
          ...this.mockAttendanceItemCapabilitiesData.capabilities,
          can_send_free_text: true,
          can_create_quote: true,
          can_create_payment_link: true,
          can_send_payment_link: true
        }
      }
    }).as('getAttendanceItemCapabilities');

    // 4. Mensagens
    this.interceptMessagesListApi(idNum, this.mockMessagesAtivas);

    // 5. Orçamentos vinculados (utiliza defaultBudgets com itens e totais canônicos)
    this.interceptBudgetsApi(idNum, null, true);

    // 6. Links de pagamento (utiliza defaultPayload canônico)
    this.interceptPaymentLinksApi(idNum, null, true);

    // 7. Configurações de pagamento / operadoras ativas (necessário para habilitar criação de links)
    cy.intercept('GET', rotaApi('payment-configs*'), {
      statusCode: 200,
      body: {
        items: [
          {
            id: 3,
            description: "Cielo",
            installment_min_amount: 10,
            installment_max_count: 12,
            online_payment_type: 1
          },
          {
            id: 6,
            description: "PIX - Banco Inter",
            installment_min_amount: 1,
            installment_max_count: 1,
            online_payment_type: 5
          }
        ]
      }
    }).as('getPaymentConfigs');

    cy.intercept('GET', rotaApi(`attendances/${idNum}/observations*`), { statusCode: 200, body: { items: [], total: 0 } }).as('getAttendanceObservations');
    cy.intercept('GET', rotaApi(`attendances/${idNum}/ia-files*`), { statusCode: 200, body: { items: [], total: 0 } });
    cy.intercept('GET', rotaApi(`attendances/${idNum}/message-templates*`), { statusCode: 200, body: this.mockAttendanceTemplatesData }).as('getAttendanceTemplatesDrawer');
    cy.intercept('GET', rotaApi('attendances/*/message-templates*'), { statusCode: 200, body: this.mockAttendanceTemplatesData });
  }

  /**
   * Intercepta suíte 100% hermética para atendimento sem atendente designado (Regra #212)
   */
  interceptMockDetalheSemAtendente(attendanceId = 26080078) {
    const idNum = parseInt(attendanceId, 10) || 26080078;

    const listItem = {
      id: idNum,
      reference_at: "2026-08-11T11:23:47.908Z",
      attendant_name: null,
      attendant: null,
      attendant_id: null,
      customer_name: "MARISTELA",
      messages: {
        unread_count: 0,
        last_message: {
          type: 1,
          body: "Olá",
          occurred_at: new Date().toISOString()
        }
      },
      status: 0,
      channel: {
        id: 6,
        name: "WHATSAPP OFICIAL - 62 98222-4382",
        type: 1,
        subtype: 1,
        official: true
      },
      group: {
        id: 7,
        name: "ATENDIMENTO"
      }
    };

    const queuePayload = {
      items: [listItem],
      pagination: { page: 1, per_page: 20, total: 1, total_pages: 1, has_next: false, has_previous: false }
    };

    cy.intercept('GET', rotaApi('attendances?*'), {
      statusCode: 200,
      body: queuePayload
    }).as('getAttendancesList');

    cy.intercept('GET', rotaApi('attendances?*search=*'), {
      statusCode: 200,
      body: queuePayload
    }).as('searchAttendancesApi');

    const detailRegex = new RegExp(regexApi(`attendances/(${idNum}|\\*|\\d+)([?#].*)?$`));
    cy.intercept('GET', detailRegex, {
      statusCode: 200,
      body: {
        attendance: {
          id: idNum,
          reference_at: "2026-08-11T11:23:47.908Z",
          notes: null,
          status: 0,
          channel: {
            id: 6,
            name: "WHATSAPP OFICIAL - 62 98222-4382",
            type: 1,
            subtype: 1,
            official: true
          },
          group: {
            id: 7,
            name: "ATENDIMENTO"
          },
          attendant: null,
          attendant_id: null,
          attendant_name: null,
          service_window_active: false,
          last_customer_message_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
          service_window: null
        },
        customer: {
          customer_id: 867092,
          name: "MARISTELA",
          phone: "5511999998888",
          email: null,
          store_name: "LOJA TESTE"
        },
        summaries: {
          quotes: { count: 2, total_amount: 346.49 },
          payment_links: { count: 1, pending_confirmation_count: 0 }
        },
        capabilities: {
          ...this.mockAttendanceItemCapabilitiesData.capabilities,
          can_send_free_text: false,
          can_create_quote: false,
          can_create_payment_link: false,
          can_send_payment_link: false
        }
      }
    }).as('getAttendanceDetail');

    cy.intercept('GET', rotaApi(`attendances/${idNum}/capabilities*`), {
      statusCode: 200,
      body: {
        capabilities: {
          ...this.mockAttendanceItemCapabilitiesData.capabilities,
          can_send_free_text: false,
          can_create_quote: false,
          can_create_payment_link: false,
          can_send_payment_link: false
        }
      }
    }).as('getAttendanceItemCapabilities');

    cy.intercept('GET', rotaApi(`attendances/${idNum}/messages*`), {
      statusCode: 200,
      body: {
        items: [],
        pagination: { page: 1, per_page: 20, total: 0, total_pages: 1, has_next: false, has_previous: false }
      }
    }).as('getAttendanceMessages');

    this.interceptBudgetsApi(idNum, { items: [], total: 0 }, true);
    this.interceptPaymentLinksApi(idNum, { items: [], data: [], total: 0 }, true);
    cy.intercept('GET', rotaApi(`attendances/${idNum}/observations*`), { statusCode: 200, body: { items: [], total: 0 } }).as('getAttendanceObservations');
    cy.intercept('GET', rotaApi(`attendances/${idNum}/ia-files*`), { statusCode: 200, body: { items: [], total: 0 } });
  }

  /**
   * Intercepta a listagem de mensagens do atendimento (/attendances/:id/messages)
   * @param {string|number} attendanceId ID do atendimento ('*' para todos)
   * @param {object|null} customPayload Payload customizado opcional
   */
  interceptMessagesListApi(attendanceId = '*', customPayload = null) {
    this.interceptRoute({
      method: 'GET',
      urlPattern: rotaApi(`attendances/${attendanceId}/messages*`),
      customPayload,
      defaultBody: this.mockMessagesListData,
      fixturePath: '5.atendimentos/attendanceMessages.json',
      alias: 'getAttendanceMessages'
    });
  }

  /**
   * Intercepta a listagem de mensagens retornando um payload diferente em cada chamada sucessiva.
   * Usado para simular a revalidação de status de uma mensagem pendente (ready -> sent) sem que
   * o teste precise enviar uma nova mensagem ou disparar qualquer outra ação (PR #418).
   * @param {string|number} attendanceId ID do atendimento ('*' para todos)
   * @param {object[]} respostasSequenciais Lista de payloads; cada chamada consome o próximo (repete o último)
   */
  interceptMessagesListApiSequencial(attendanceId = '*', respostasSequenciais = []) {
    let chamada = 0;
    cy.intercept('GET', rotaApi(`attendances/${attendanceId}/messages*`), (req) => {
      const indice = Math.min(chamada, respostasSequenciais.length - 1);
      chamada += 1;
      req.reply({ statusCode: 200, body: respostasSequenciais[indice] });
    }).as('getAttendanceMessages');
  }

  /**
   * Intercepta a remoção de uma reação (DELETE) e a listagem de mensagens com transição de estado
   * ligada ao EVENTO: a listagem devolve `payloadAntes` até o DELETE chegar e `payloadDepois` a partir
   * dele, como o servidor real faria. Não depende da ordem nem da contagem de GETs: a tela faz mais de
   * uma leitura da listagem depois de um `cy.reload()` e a releitura de invalidação do `onSettled`
   * vem logo após o DELETE (medido pelo trace de falha, 2026-10-15, 5-B3 #15.7). Mesmo padrão de
   * `interceptDetalheComTransicaoDeAssumir` (flag ligada dentro do intercept da mutação).
   * @param {string|number} attendanceId ID do atendimento ('*' para todos)
   * @param {string|number} messageId ID da mensagem cuja reação será removida
   * @param {object} payloadAntes Listagem com a reação ainda aplicada
   * @param {object} payloadDepois Listagem já sem a reação
   * @param {number} delayMs Atraso da resposta do DELETE (mantém a remoção otimista observável)
   */
  interceptListagemComRemocaoDeReacao(attendanceId = '*', messageId, payloadAntes, payloadDepois, delayMs = 0) {
    let removida = false;
    cy.intercept('DELETE', rotaApi(`attendances/*/messages/${messageId}/reaction*`), (req) => {
      removida = true;
      req.reply({ statusCode: 204, delay: delayMs });
    }).as('removeReaction');
    cy.intercept('GET', rotaApi(`attendances/${attendanceId}/messages*`), (req) => {
      req.reply({ statusCode: 200, body: removida ? payloadDepois : payloadAntes });
    }).as('getAttendanceMessages');
  }

  /**
   * Intercepta a listagem de mensagens retornando dados de janela de 24h expirada
   * @param {string|number} attendanceId ID do atendimento ('*' para todos)
   */
  interceptMockMensagensExpiradas(attendanceId = '*') {
    this.interceptMessagesListApi(attendanceId, this.mockMessagesExpiradas);
  }

  /**
   * Intercepta a listagem de mensagens retornando dados de janela de 24h ativa com resposta do cliente
   * @param {string|number} attendanceId ID do atendimento ('*' para todos)
   */
  interceptMockMensagensAtivas(attendanceId = '*') {
    this.interceptMessagesListApi(attendanceId, this.mockMessagesAtivas);
  }

  /**
   * Intercepta a listagem de mensagens retornando histórico completo com paginação finalizada (has_previous: false)
   * Ideal para testes do badge "Início do histórico" e testes de rolagem (PR #390)
   * @param {string|number} attendanceId ID do atendimento ('*' para todos)
   */
  interceptMockMensagensHistoricoCompleto(attendanceId = '*') {
    this.interceptRoute({
      method: 'GET',
      urlPattern: rotaApi(`attendances/${attendanceId}/messages*`),
      // defaultBody é obrigatório no modo mock: `fixturePath` sozinho serve apenas ao Auto-Sync
      // do modo real, e sem ele o intercept respondia `body: null` (tela "Erro ao carregar mensagens")
      defaultBody: mockAttendanceMessagesRealData,
      fixturePath: '5.atendimentos/attendanceMessages.json',
      alias: 'getAttendanceMessages'
    });
  }

  /**
   * Intercepta e simula um atendimento em status Finalizado (STATUS = 3)
   * com capacidades específicas para teste de permissão de transição (PR #442 / #330)
   * @param {number} attendanceId ID do atendimento
   * @param {object} capabilitiesOverride Sobrescrita de capabilities
   */
  interceptMockAtendimentoFinalizado(attendanceId = 260800099, capabilitiesOverride = {}) {
    const attendant = this.getLoggedAttendant();
    const idNum = parseInt(attendanceId, 10) || 260800099;

    const capabilities = {
      can_view_attendance_detail: true,
      can_list_attendance_messages: true,
      can_send_attendance_messages: false,
      can_send_free_text: false,
      can_mark_completed: false,
      can_mark_discarded: false,
      can_mark_finished: false,
      can_transfer_assigned_attendance: true,
      can_transfer_pending_attendance: false,
      ...capabilitiesOverride
    };

    const finalizadoDetail = {
      attendance: {
        id: idNum,
        protocol: String(idNum),
        reference_at: new Date().toISOString(),
        customer_name: "CLIENTE FINALIZADO",
        status: 3, // STATUS = 3 (Finalizado)
        channel: { id: 6, name: "WHATSAPP OFICIAL - 62 98222-4382", type: 1, subtype: 1, official: true },
        group: { id: 7, name: "ATENDIMENTO" },
        attendant: attendant,
        attendant_id: attendant.id,
        last_customer_message_at: new Date().toISOString(),
        service_window: null
      },
      customer: {
        name: "CLIENTE FINALIZADO",
        phone: "5511999998888",
        email: null,
        store_name: "LOJA TESTE"
      },
      summaries: {
        quotes: { count: 0, total_amount: 0 },
        payment_links: { count: 0, pending_confirmation_count: 0 }
      },
      capabilities
    };

    const queuePayload = {
      items: [
        {
          id: idNum,
          reference_at: new Date().toISOString(),
          attendant_name: attendant.name,
          attendant: attendant,
          attendant_id: attendant.id,
          customer_name: "CLIENTE FINALIZADO",
          messages: {
            unread_count: 0,
            last_message: {
              type: 1,
              body: "Atendimento finalizado com sucesso.",
              occurred_at: new Date().toISOString()
            }
          },
          status: 3,
          capabilities,
          channel: { id: 6, name: "WHATSAPP OFICIAL - 62 98222-4382", type: 1, subtype: 1, official: true },
          group: { id: 7, name: "ATENDIMENTO" }
        }
      ],
      pagination: {
        page: 1,
        per_page: 20,
        total: 1,
        total_pages: 1,
        has_next: false,
        has_prev: false
      }
    };

    this.interceptAttendancesListApi(queuePayload);
    this.interceptAttendanceDetailApi(idNum, finalizadoDetail);
    this.interceptMessagesListApi(idNum, { items: [], total: 0 });
    this.interceptAttendanceItemCapabilitiesApi(idNum, { capabilities });
    this.interceptBudgetsApi(idNum, []);
  }

  /**
   * Intercepta atendimento em STATUS = 4 (Descartado) com capabilities customizáveis (PR #486)
   * @param {string|number} attendanceId ID do atendimento
   * @param {object} capabilitiesOverride Objeto de capabilities sobrescritas (ex: can_mark_finished)
   */
  interceptMockAtendimentoDescartado(attendanceId = 260800098, capabilitiesOverride = {}) {
    const attendant = this.getLoggedAttendant();
    const idNum = parseInt(attendanceId, 10) || 260800098;

    const capabilities = {
      can_view_attendance_detail: true,
      can_list_attendance_messages: true,
      can_send_attendance_messages: false,
      can_send_free_text: false,
      can_mark_completed: false,
      can_mark_discarded: false,
      can_mark_finished: false,
      can_transfer_assigned_attendance: true,
      can_transfer_pending_attendance: false,
      ...capabilitiesOverride
    };

    const descartadoDetail = {
      attendance: {
        id: idNum,
        protocol: String(idNum),
        reference_at: new Date().toISOString(),
        customer_name: "CLIENTE DESCARTADO",
        status: 4, // STATUS = 4 (Descartado)
        channel: { id: 6, name: "WHATSAPP OFICIAL - 62 98222-4382", type: 1, subtype: 1, official: true },
        group: { id: 7, name: "ATENDIMENTO" },
        attendant: attendant,
        attendant_id: attendant.id,
        last_customer_message_at: new Date().toISOString(),
        service_window: null
      },
      customer: {
        name: "CLIENTE DESCARTADO",
        phone: "5511999998888",
        email: null,
        store_name: "LOJA TESTE"
      },
      summaries: {
        quotes: { count: 0, total_amount: 0 },
        payment_links: { count: 0, pending_confirmation_count: 0 }
      },
      capabilities
    };

    const queuePayload = {
      items: [
        {
          id: idNum,
          reference_at: new Date().toISOString(),
          attendant_name: attendant.name,
          attendant: attendant,
          attendant_id: attendant.id,
          customer_name: "CLIENTE DESCARTADO",
          messages: {
            unread_count: 0,
            last_message: {
              type: 1,
              body: "Atendimento descartado.",
              occurred_at: new Date().toISOString()
            }
          },
          status: 4,
          capabilities,
          channel: { id: 6, name: "WHATSAPP OFICIAL - 62 98222-4382", type: 1, subtype: 1, official: true },
          group: { id: 7, name: "ATENDIMENTO" }
        }
      ],
      pagination: {
        page: 1,
        per_page: 20,
        total: 1,
        total_pages: 1,
        has_next: false,
        has_prev: false
      }
    };

    this.interceptAttendancesListApi(queuePayload);
    this.interceptAttendanceDetailApi(idNum, descartadoDetail);
    this.interceptMessagesListApi(idNum, { items: [], total: 0 });
    this.interceptAttendanceItemCapabilitiesApi(idNum, { capabilities });
    this.interceptBudgetsApi(idNum, []);
  }

  /**
   * Intercepta o envio de mensagens de texto (/attendances/:id/messages)
   * @param {string|number} attendanceId ID do atendimento ('*' para todos)
   * @param {object|null} customPayload Payload customizado opcional
   */
  interceptSendMessageApi(attendanceId = '*', customPayload = null) {
    if (!this.isMockEnabled()) {
      cy.intercept('POST', rotaApi(`attendances/${attendanceId}/messages*`), (req) => req.continue()).as('sendChatMessage');
      return;
    }

    const defaultResponse = {
      id: 4854475,
      created_at: new Date().toISOString()
    };

    cy.intercept('POST', rotaApi(`attendances/${attendanceId}/messages*`), {
      statusCode: 201,
      body: customPayload || defaultResponse
    }).as('sendChatMessage');
  }

  /**
   * Intercepta o reenvio de uma mensagem falhada (POST .../messages/:messageId/retry — Issue
   * front#522/backend#614, PR #523). Sem corpo na requisição; resposta de sucesso ecoa o mesmo
   * `id` da mensagem (nenhum id novo) com `status: "ready"` — ainda não deployado no ambiente de
   * dev no momento da escrita (2026-10-06, confirmado: rota viva no backend, front não encontrado
   * no bundle real) — construído a partir da especificação da issue/PR, não medido ao vivo.
   * @param {string|number} messageId ID da mensagem ('*' para qualquer uma)
   * @param {number} statusCode Código HTTP (200 sucesso, 409/422/403/404 recusa)
   * @param {object|null} customPayload Corpo customizado (default: eco do id com status "ready")
   * @param {number} delayMs Atraso artificial antes de responder (0 = imediato) — usado pra manter
   *   o botão em "Reenviando…" tempo suficiente pra validar o estado de loading/duplo-clique
   */
  interceptRetryMessageApi(messageId = '*', statusCode = 200, customPayload = null, delayMs = 0) {
    const defaultResponse = { id: Number(messageId) || 4856175, status: 'ready' };
    cy.intercept('POST', rotaApi(`attendances/*/messages/${messageId}/retry*`), {
      statusCode,
      body: customPayload || defaultResponse,
      delay: delayMs
    }).as('retryMessage');
  }

  /**
   * Intercepta a rota de reação a mensagem (PUT reage / DELETE remove), Issue front#530/PR #536
   * (backend#617). Sucesso (204) não tem corpo; recusa (409) traz um dos três `code`:
   * MESSAGE_NOT_REACTABLE, REACTIONS_UNAVAILABLE ou ATTENDANCE_UNASSIGNED.
   * @param {string|number} messageId ID da mensagem ('*' para qualquer uma)
   * @param {'PUT'|'DELETE'} method Método HTTP a interceptar
   * @param {number} statusCode Código HTTP (204 sucesso; 409 para recusa)
   * @param {object|null} customPayload Corpo customizado da recusa (ignorado em sucesso)
   * @param {number} delayMs Atraso artificial antes de responder (valida o estado "pending"/"enviando")
   */
  interceptReactionApi(messageId = '*', method = 'PUT', statusCode = 204, customPayload = null, delayMs = 0) {
    const alias = method === 'DELETE' ? 'removeReaction' : 'putReaction';
    const defaultError = {
      status: statusCode, error: 'Conflict',
      message: 'Não é possível reagir a esta mensagem.', code: 'MESSAGE_NOT_REACTABLE'
    };
    cy.intercept(method, rotaApi(`attendances/*/messages/${messageId}/reaction*`), {
      statusCode,
      body: statusCode >= 400 ? (customPayload || defaultError) : undefined,
      delay: delayMs
    }).as(alias);
  }

  /**
   * Intercepta a rota nova de conteúdo binário de anexo (GET .../messages/:id/attachment),
   * Issue front#521/backend#612/#613 — usada pra forçar os estados de erro (404 "sem conteúdo
   * binário"/indisponível, ou erro genérico com retry) num anexo real que ainda não foi buscado.
   * Por padrão deixa passar pra API real (`req.continue`), já que o conteúdo em si (200) é melhor
   * validado contra a massa real curada (atendimento 260900034) do que por um binário sintético.
   * @param {number|string} messageId ID da mensagem cujo anexo será interceptado
   * @param {number|null} statusCode Código HTTP a forçar (404, 500...); null = deixa passar (200 real)
   * @param {object|null} customPayload Corpo customizado do erro (default: shape real da API)
   */
  interceptAttachmentRouteApi(messageId, statusCode = null, customPayload = null) {
    const urlPattern = rotaApi(`attendances/*/messages/${messageId}/attachment*`);
    if (statusCode === null) {
      cy.intercept('GET', urlPattern, (req) => req.continue()).as('getAttachmentContent');
      return;
    }
    const defaultError = { status: statusCode, error: statusCode === 404 ? 'Not Found' : 'Internal Server Error', message: statusCode === 404 ? 'Anexo não encontrado' : 'Erro interno' };
    cy.intercept('GET', urlPattern, { statusCode, body: customPayload || defaultError }).as('getAttachmentContent');
  }

  /**
   * Intercepta o envio de mensagens de mídia/anexo (/attendances/:id/messages/media)
   * @param {string|number} attendanceId ID do atendimento ('*' para todos)
   * @param {number} statusCode Código HTTP (201 para sucesso, 422/413 para erros de limite)
   * @param {object|null} customPayload Payload customizado
   * @param {number} delayMs Atraso artificial antes de responder (0 = imediato); usado pra manter
   *   o upload "em andamento" tempo suficiente pra clicar em "Cancelar envio" (front#489, PR #483)
   */
  interceptSendMediaMessageApi(attendanceId = '*', statusCode = 201, customPayload = null, delayMs = 0) {
    if (!this.isMockEnabled()) {
      // Sem handler (Issue cypress#003): com callback, o proxy do Cypress bufferiza o corpo inteiro
      // (até 15 MB) antes de repassar à API real, somando latência ao upload - se o front abortar
      // (timeout de 15s/120s) antes do proxy concluir, o driver nunca registra a requisição e o
      // cy.wait trava com "Timed out waiting for the 1st request". Sem callback, o proxy só observa.
      cy.intercept('POST', rotaApi(`attendances/${attendanceId}/messages/media*`)).as('sendChatMediaMessage');
      return;
    }

    const defaultResponse = {
      id: 4854480,
      attachment_id: 4854480,
      created_at: new Date().toISOString(),
      origin: "employee",
      content_type: "document",
      message_status: "sent",
      content: "Orçamento #260900036",
      attachment: {
        id: 4854480,
        name: "Orçamento #260900036.pdf",
        content_type: "application/pdf",
        url: "https://api.omnicare.dev.local/storage/budget.pdf"
      }
    };

    cy.intercept('POST', rotaApi(`attendances/${attendanceId}/messages/media*`), {
      statusCode,
      delay: delayMs,
      body: customPayload || (statusCode >= 400 ? { message: 'Erro no upload de mídia' } : defaultResponse)
    }).as('sendChatMediaMessage');
  }

  /**
   * Intercepta o envio de mídia simulando uma queda de rede REAL (não o timeout do próprio
   * cliente) - `forceNetworkError` derruba a conexão na hora, sem status HTTP algum, replicando
   * o cenário de contraprova da issue front#488/PR #482: o front precisa continuar mostrando
   * "Sem conexão. Tente novamente." aqui, distinto da nova mensagem de timeout de upload.
   * @param {string|number} attendanceId ID do atendimento ('*' para todos)
   */
  interceptSendMediaMessageApiComFalhaDeRede(attendanceId = '*') {
    cy.intercept('POST', rotaApi(`attendances/${attendanceId}/messages/media*`), {
      forceNetworkError: true
    }).as('sendChatMediaMessage');
  }

  /**
   * Intercepta a listagem e confirmação de links de pagamento (/attendances/:id/payment-links)
   * @param {string|number} attendanceId ID do atendimento ('*' para todos)
   * @param {object|null} customPayload Payload customizado
   * @param {boolean} forceMock Força resposta mockada mesmo se USE_MOCKS for falso
   */
  interceptPaymentLinksApi(attendanceId = '*', customPayload = null, forceMock = false) {
    if (!this.isMockEnabled() && !forceMock) {
      cy.intercept('GET', rotaApi(`attendances/${attendanceId}/payment-links*`), (req) => req.continue()).as('getPaymentLinks');
      return;
    }

    const defaultPayload = {
      items: [
        {
          id: 260900007,
          reference: "10199_260900007_OC",
          status: 0,
          amount: 346.49,
          paid_amount: 0,
          installments: 3,
          store_id: 1,
          employee_id: 122,
          financial_id: null,
          payment_url: "https://cieloecommerce.cielo.com.br/TransactionalVNext/Checkout/Index/b4a6512d-5316-488a-8c1f-4f21863e21f5",
          created_at: new Date().toISOString(),
          confirmed_at: null
        }
      ],
      data: [
        {
          id: 260900007,
          reference: "10199_260900007_OC",
          status: 0,
          amount: 346.49,
          paid_amount: 0,
          installments: 3,
          store_id: 1,
          employee_id: 122,
          financial_id: null,
          payment_url: "https://cieloecommerce.cielo.com.br/TransactionalVNext/Checkout/Index/b4a6512d-5316-488a-8c1f-4f21863e21f5",
          created_at: new Date().toISOString(),
          confirmed_at: null
        }
      ],
      total: 1,
      pagination: {
        page: 1,
        per_page: 20,
        total: 1,
        total_pages: 1,
        has_next: false,
        has_previous: false
      }
    };

    cy.intercept('GET', rotaApi(`attendances/${attendanceId}/payment-links*`), {
      statusCode: 200,
      body: customPayload || defaultPayload
    }).as('getPaymentLinks');

  }

  /**
   * Intercepta a criação/envio de link de pagamento (POST /attendances/:id/payment-links)
   * @param {string|number} attendanceId ID do atendimento ('*' para todos)
   * @param {object|null} customPayload Payload customizado opcional
   */
  interceptCreatePaymentLinkApi(attendanceId = '*', customPayload = null) {
    if (!this.isMockEnabled()) {
      cy.intercept('POST', rotaApi(`attendances/${attendanceId}/payment-links*`), (req) => req.continue()).as('sendPaymentLink');
      return;
    }

    const defaultResponse = {
      id: 260900007,
      reference: '10199_260900007_OC',
      status: 0,
      amount: 167.79,
      paid_amount: 0,
      installments: 1,
      store_id: 1,
      payment_url: 'https://cieloecommerce.cielo.com.br/TransactionalVNext/Checkout/Index/b4a6512d-5316-488a-8c1f-4f21863e21f5',
      created_at: new Date().toISOString()
    };

    cy.intercept('POST', rotaApi(`attendances/${attendanceId}/payment-links*`), {
      statusCode: 201,
      body: customPayload || defaultResponse
    }).as('sendPaymentLink');
  }

  /**
   * Responde o POST /attendances/:id/payment-links com erro, no envelope compartilhado do backend
   * (`{ status, error, message, code?, timestamp }`, `code` ausente quando não há código; omnicare-backend#445).
   * Sempre mockado: é o que permite exercitar a classificação do erro na modal (front#332) sem cobrar ninguém.
   * @param {string|number} attendanceId ID do atendimento ('*' para todos)
   * @param {number} statusCode Status HTTP da resposta
   * @param {{ message?: string, code?: string, error?: string }} erro Campos do envelope
   */
  interceptCreatePaymentLinkErroApi(attendanceId = '*', statusCode = 502, { message = 'Falha ao gerar o link de pagamento.', code, error = 'Bad Gateway' } = {}) {
    const body = { status: statusCode, error, message, timestamp: new Date().toISOString() };
    if (code) body.code = code;
    cy.intercept('POST', rotaApi(`attendances/${attendanceId}/payment-links*`), { statusCode, body }).as('sendPaymentLink');
  }

  /**
   * Intercepta a listagem de orçamentos vinculados (/attendances/:id/budgets e /quotes)
   * A rota oficial do frontend OmniCare Web é /attendances/:id/budgets
   * @param {string|number} attendanceId ID do atendimento ('*' para todos)
   * @param {object|null} customPayload Payload customizado
   * @param {boolean} forceMock Força resposta mockada mesmo se USE_MOCKS for falso
   */
  interceptBudgetsApi(attendanceId = '*', customPayload = null, forceMock = false) {
    if (!this.isMockEnabled() && !forceMock) {
      cy.intercept('GET', rotaApi(`attendances/${attendanceId}/budgets*`), (req) => req.continue()).as('getAttendanceBudgets');
      cy.intercept('GET', rotaApi(`attendances/${attendanceId}/quotes*`), (req) => req.continue()).as('getAttendanceQuotes');
      return;
    }

    const defaultBudgets = {
      data: [
        {
          id: 260900036,
          code: 260900036,
          formula_number: 1,
          type: 1,
          status: -1,
          amount: 178.37,
          discount: 0,
          amount_with_discount: 178.37,
          selected_for_payment_link: true,
          covered_by_approved_link: false,
          financial_id: 260900036,
          shipping_label: "Retirada",
          products: [
            {
              line_number: 1,
              quantity: 25,
              unit: "mg",
              product_name: "Tadalafil",
              amount: 178.37
            }
          ]
        },
        {
          id: 260900035,
          code: 260900035,
          formula_number: 2,
          type: 1,
          status: -1,
          amount: 168.12,
          discount: 0,
          amount_with_discount: 168.12,
          selected_for_payment_link: true,
          covered_by_approved_link: false,
          financial_id: 260900035,
          shipping_label: "Retirada",
          products: [
            {
              line_number: 1,
              quantity: 250,
              unit: "mg",
              product_name: "PASSIFLORA EXTRATO",
              amount: 168.12
            }
          ]
        }
      ],
      totals: {
        budget_total: 178.37,
        completed_total: 168.12,
        receivable_total: 346.49
      },
      pagination: {
        page: 1,
        per_page: 20,
        total: 2,
        total_pages: 1,
        has_next: false,
        has_previous: false
      }
    };

    // Intercepta rotas com wildcard e com query params variáveis (page=1, per_page=20, per_page=100)
    cy.intercept('GET', rotaApi(`attendances/${attendanceId}/budgets*`), {
      statusCode: 200,
      body: customPayload || defaultBudgets
    }).as('getAttendanceBudgets');

    cy.intercept('GET', rotaApi(`attendances/${attendanceId}/quotes*`), {
      statusCode: 200,
      body: customPayload || defaultBudgets
    }).as('getAttendanceQuotes');

  }

  /**
   * Alias de compatibilidade com chamadas existentes
   */
  interceptQuotesApi(attendanceId = '*', customPayload = null) {
    this.interceptBudgetsApi(attendanceId, customPayload);
  }

  /**
   * Intercepta a listagem de orçamentos simulando cenário 100% mockado com orçamento Vendido e Em Aberto (PR #379)
   * @param {string|number} attendanceId ID do atendimento
   */
  interceptMockBudgetsComVendido(attendanceId = '*') {
    const payload = {
      data: [
        {
          id: 260900081,
          code: 260900081,
          formula_number: 1,
          type: 1,
          status: 1,
          sold: true,
          amount: 175.40,
          discount: 0,
          amount_with_discount: 175.40,
          selected_for_payment_link: false,
          covered_by_approved_link: false,
          financial_id: 260900081,
          shipping_label: "Retirada",
          products: [
            {
              line_number: 1,
              quantity: 30,
              unit: "caps",
              product_name: "Composto Anti-inflamatório",
              amount: 175.40
            }
          ]
        },
        {
          id: 260900082,
          code: 260900082,
          formula_number: 2,
          type: 1,
          status: 0,
          sold: false,
          amount: 89.90,
          discount: 0,
          amount_with_discount: 89.90,
          selected_for_payment_link: false,
          covered_by_approved_link: false,
          financial_id: null,
          shipping_label: "Entrega",
          products: [
            {
              line_number: 1,
              quantity: 1,
              unit: "un",
              product_name: "Vitamina C 500mg",
              amount: 89.90
            }
          ]
        }
      ],
      totals: {
        budget_total: 89.90,
        completed_total: 175.40,
        receivable_total: 265.30
      },
      pagination: {
        page: 1,
        per_page: 20,
        total: 2,
        total_pages: 1,
        has_next: false,
        has_previous: false
      }
    };

    this.interceptBudgetsApi(attendanceId, payload, true);
  }

  /**
   * Intercepta a atualização de seleção de orçamento para link de pagamento
   * (PATCH /attendances/:attendanceId/budgets/:budgetCode)
   * @param {string|number} attendanceId ID do atendimento ('*' para todos)
   * @param {string|number} budgetCode Código do orçamento ('*' para todos)
   * @param {object|null} customResponse Resposta customizada (status e body)
   * @param {boolean} forceMock Força resposta mockada mesmo se USE_MOCKS for falso
   */
  interceptUpdateBudgetApi(attendanceId = '*', budgetCode = '*', customResponse = null, forceMock = false) {
    if (!this.isMockEnabled() && !forceMock) {
      cy.intercept('PATCH', /.*budgets\/\d+.*/, (req) => req.continue()).as('patchAttendanceBudget');
      return;
    }

    const handler = (req) => {
      if (customResponse) {
        req.reply({
          statusCode: customResponse.statusCode || 200,
          body: customResponse.body || customResponse
        });
        return;
      }

      const urlMatch = req.url.match(/budgets\/(\d+)/);
      const codeFromUrl = urlMatch ? Number(urlMatch[1]) : (Number(budgetCode) || 260900036);
      const selected = req.body?.selected_for_payment_link ?? true;
      req.reply({
        statusCode: 200,
        body: {
          code: codeFromUrl,
          status: 0,
          financial_id: null,
          covered_by_approved_link: false,
          selected_for_payment_link: selected
        }
      });
    };

    cy.intercept('PATCH', /.*budgets\/\d+.*/, handler).as('patchAttendanceBudget');
  }

  /**
   * Intercepta GET /budget-customization (Issue #449, backend#529/#567, PR #451).
   * `accent_color` vem sempre preenchida (salva ou padrão); `is_default: true` = loja sem
   * personalização própria (visual padrão `#337BA8`, sem capa).
   * @param {object|null} customPayload Payload customizado opcional
   * @param {number} statusCode Código de status HTTP (padrão: 200)
   */
  interceptBudgetCustomizationApi(customPayload = null, statusCode = 200) {
    const defaultBody = {
      accent_color: '#337BA8',
      cover_url: null,
      is_default: true
    };

    this.interceptRoute({
      method: 'GET',
      urlPattern: rotaApi('budget-customization*'),
      customPayload,
      defaultBody,
      fixturePath: '5.atendimentos/orcamentos/budgetCustomization.json',
      alias: 'getBudgetCustomization',
      statusCode
    });
  }

  /**
   * Intercepta PUT /budget-customization (salvar personalização, multipart).
   * `cy.intercept` não serializa `multipart/form-data` (AGENTS.md [R-MOCK]) — não dá pra inspecionar
   * `accent_color`/`cover` pelo corpo da requisição; os testes validam pelo EFEITO (resposta relida
   * aplicada na prévia/card), não pelo payload bruto.
   * @param {object|null} customResponse Corpo de resposta customizado (estado relido)
   * @param {number} statusCode Código de status HTTP (padrão: 200)
   */
  interceptUpdateBudgetCustomizationApi(customResponse = null, statusCode = 200) {
    const defaultBody = {
      accent_color: '#337BA8',
      cover_url: null,
      is_default: false
    };

    cy.intercept('PUT', rotaApi('budget-customization*'), {
      statusCode,
      body: customResponse || defaultBody
    }).as('putBudgetCustomization');
  }

  /**
   * Intercepta GET .../budget-customization/cover (imagem da capa, autenticada por Bearer).
   * @param {number} statusCode Código de status HTTP (200 ou 503, quando o banco de imagens cai)
   */
  interceptBudgetCoverImageApi(statusCode = 200) {
    if (statusCode !== 200) {
      cy.intercept('GET', '**/budget-customization/cover*', { statusCode }).as('getBudgetCover');
      return;
    }
    cy.intercept('GET', '**/budget-customization/cover*', {
      statusCode: 200,
      fixture: '5.atendimentos/orcamentos/capa-ideal-1200x450.png',
      headers: { 'content-type': 'image/png' }
    }).as('getBudgetCover');
  }

  /**
   * Intercepta ambiente 100% mockado com orçamento pendente interativo (#260900036),
   * orçamento coberto por link aprovado (#260900035 - PR #324) e orçamento vendido (#260900081 - PR #311/PR #379).
   * @param {object} options
   * @param {string|number} options.attendanceId ID do atendimento
   * @param {boolean} options.pendenteSelecionado Se o orçamento pendente #260900036 inicia marcado
   * @param {boolean} options.cobertoSelecionado Se o orçamento coberto #260900035 inicia marcado (preso)
   */
  interceptMockBudgetsComSelecaoECoberto({ attendanceId = '*', pendenteSelecionado = true, cobertoSelecionado = false } = {}) {
    const payload = {
      data: [
        {
          id: 260900036,
          code: 260900036,
          formula_number: 1,
          type: 1,
          status: 0,
          sold: false,
          amount: 178.37,
          discount: 0,
          amount_with_discount: 178.37,
          selected_for_payment_link: pendenteSelecionado,
          covered_by_approved_link: false,
          financial_id: null,
          shipping_label: "Entrega",
          products: [
            {
              line_number: 1,
              quantity: 1,
              unit: "un",
              product_name: "Creme Dermatológico 50g",
              amount: 178.37
            }
          ]
        },
        {
          id: 260900035,
          code: 260900035,
          formula_number: 2,
          type: 1,
          status: 0,
          sold: false,
          amount: 168.12,
          discount: 0,
          amount_with_discount: 168.12,
          selected_for_payment_link: cobertoSelecionado,
          covered_by_approved_link: true,
          financial_id: null,
          shipping_label: "Retirada",
          products: [
            {
              line_number: 1,
              quantity: 60,
              unit: "caps",
              product_name: "Composto Imunidade",
              amount: 168.12
            }
          ]
        },
        {
          id: 260900081,
          code: 260900081,
          formula_number: 3,
          type: 1,
          status: 1,
          sold: true,
          amount: 175.40,
          discount: 0,
          amount_with_discount: 175.40,
          selected_for_payment_link: false,
          covered_by_approved_link: false,
          financial_id: 260900081,
          shipping_label: "Retirada",
          products: [
            {
              line_number: 1,
              quantity: 30,
              unit: "caps",
              product_name: "Composto Anti-inflamatório",
              amount: 175.40
            }
          ]
        }
      ],
      totals: {
        budget_total: 178.37,
        completed_total: 343.52,
        receivable_total: 521.89
      },
      pagination: {
        page: 1,
        per_page: 20,
        total: 3,
        total_pages: 1,
        has_next: false,
        has_previous: false
      }
    };

    this.interceptBudgetsApi(attendanceId, payload, true);
    this.interceptUpdateBudgetApi(attendanceId, '*', null, true);
  }

  /**
   * Intercepta cenário de elegibilidade de orçamento concluído para link de pagamento (Issue front#492,
   * sub-issue de backend#562/#583): `isBudgetOpenForPaymentLink` passou a aceitar status -1 (concluído)
   * além de 0 (aberto), desde que não vendido (financial_id) nem coberto por link aprovado
   * (covered_by_approved_link). Terceiro orçamento cobre o edge case medido pelo operador em 2026-10-01
   * (comentário da issue): concluído SEM o campo `covered_by_approved_link` no payload (ausente, não
   * `false` explícito) continua bloqueado — o front trata ausência como "não confirmado", não como
   * "não coberto" (`fc(e)` no bundle real exige `covered_by_approved_link===false` estrito).
   * @param {string|number} attendanceId ID do atendimento ('*' para todos)
   */
  interceptMockBudgetsElegibilidadeStatusConcluido(attendanceId = '*') {
    const payload = {
      data: [
        {
          id: 260900100,
          code: 260900100,
          formula_number: 1,
          type: 1,
          status: -1,
          sold: false,
          amount: 54.11,
          discount: 0,
          amount_with_discount: 54.11,
          selected_for_payment_link: false,
          covered_by_approved_link: false,
          financial_id: null,
          shipping_label: "Entrega",
          products: [
            {
              line_number: 1,
              quantity: 1,
              unit: "un",
              product_name: "Creme Hidratante 100g",
              amount: 54.11
            }
          ]
        },
        {
          id: 260900101,
          code: 260900101,
          formula_number: 2,
          type: 1,
          status: 2,
          sold: false,
          amount: 72.30,
          discount: 0,
          amount_with_discount: 72.30,
          selected_for_payment_link: false,
          covered_by_approved_link: false,
          financial_id: null,
          shipping_label: "Retirada",
          products: [
            {
              line_number: 1,
              quantity: 1,
              unit: "un",
              product_name: "Xarope Expectorante 150ml",
              amount: 72.30
            }
          ]
        },
        {
          id: 260900102,
          code: 260900102,
          formula_number: 3,
          type: 1,
          status: -1,
          sold: false,
          amount: 38.90,
          discount: 0,
          amount_with_discount: 38.90,
          selected_for_payment_link: false,
          financial_id: null,
          shipping_label: "Entrega",
          products: [
            {
              line_number: 1,
              quantity: 1,
              unit: "un",
              product_name: "Pomada Cicatrizante 30g",
              amount: 38.90
            }
          ]
        }
      ],
      totals: {
        budget_total: 54.11,
        completed_total: 165.31,
        receivable_total: 0
      },
      pagination: {
        page: 1,
        per_page: 20,
        total: 3,
        total_pages: 1,
        has_next: false,
        has_previous: false
      }
    };

    this.interceptBudgetsApi(attendanceId, payload, true);
    this.interceptUpdateBudgetApi(attendanceId, '*', null, true);
  }

  /**
   * Intercepta cenário onde o atendente não possui permissão para gerar link de pagamento (PR #321)
   * @param {string|number} attendanceId ID do atendimento
   */
  interceptMockOrcamentosSemGrantLink(attendanceId = '*') {
    const capabilities = {
      ...this.mockAttendanceItemCapabilitiesData.capabilities,
      can_send_payment_link: false,
      can_create_payment_link: false
    };
    this.interceptAttendanceItemCapabilitiesApi(attendanceId, { capabilities }, true);

    const detailPayload = JSON.parse(JSON.stringify(this.mockAttendanceDetailData));
    detailPayload.capabilities = { ...detailPayload.capabilities, ...capabilities };
    if (detailPayload.attendance) {
      detailPayload.attendance.capabilities = { ...detailPayload.attendance.capabilities, ...capabilities };
    }
    this.interceptAttendanceDetailApi(attendanceId, detailPayload);

    this.interceptMockBudgetsComSelecaoECoberto({ attendanceId });
  }

  /**
   * Intercepta a listagem e gestão de Observações do atendimento (/attendances/:id/observations e /customers/:id/observations)
   */
  interceptObservationsApi(attendanceId = '*', customPayload = null) {
    if (!this.isMockEnabled()) {
      cy.intercept('GET', rotaApi(`attendances/${attendanceId}/observations*`), (req) => req.continue()).as('getObservations');
      cy.intercept('GET', rotaApi('customers/*/observations*'), (req) => req.continue()).as('getCustomerObservations');
      cy.intercept('GET', '**/observations*', (req) => req.continue()).as('getAllObservations');
      return;
    }

    const attendant = this.getLoggedAttendant();
    let observationsList = customPayload ? (customPayload.items || customPayload.data || customPayload) : [];

    const handleGetObservations = (req) => {
      req.reply({
        statusCode: 200,
        body: {
          items: observationsList,
          data: observationsList,
          observations: observationsList,
          total: observationsList.length
        }
      });
    };

    cy.intercept('GET', rotaApi(`attendances/${attendanceId}/observations*`), handleGetObservations).as('getObservations');
    cy.intercept('GET', rotaApi('customers/*/observations*'), handleGetObservations).as('getCustomerObservations');
    cy.intercept('GET', '**/observations*', handleGetObservations).as('getAllObservations');

    const handlePostObservation = (req) => {
      const texto = req.body?.body || req.body?.observation || req.body?.text || req.body?.content || "Nova observação registrada no atendimento";
      const novaObs = {
        id: Date.now(),
        author_name: attendant.name,
        user_name: attendant.name,
        created_by: attendant.name,
        body: texto,
        observation: texto,
        text: texto,
        content: texto,
        created_at: new Date().toISOString()
      };
      observationsList.unshift(novaObs);
      req.reply({
        statusCode: 201,
        body: novaObs
      });
    };

    cy.intercept('POST', rotaApi(`attendances/${attendanceId}/observations*`), handlePostObservation).as('createObservation');
    cy.intercept('POST', rotaApi('customers/*/observations*'), handlePostObservation).as('createCustomerObservation');
    cy.intercept('POST', '**/observations*', handlePostObservation).as('createObservationGeneric');

    const handlePatchObservation = (req) => {
      const match = req.url.match(/\/observations\/(\d+)/);
      const obsId = match ? parseInt(match[1], 10) : null;
      const novoTexto = req.body?.body || req.body?.observation || req.body?.text || req.body?.content || "Observação editada com sucesso";
      const index = observationsList.findIndex(o => o.id === obsId);
      if (index !== -1) {
        observationsList[index].body = novoTexto;
        observationsList[index].observation = novoTexto;
        observationsList[index].text = novoTexto;
        observationsList[index].content = novoTexto;
        req.reply({ statusCode: 200, body: observationsList[index] });
      } else if (observationsList.length > 0) {
        observationsList[0].body = novoTexto;
        observationsList[0].observation = novoTexto;
        observationsList[0].text = novoTexto;
        observationsList[0].content = novoTexto;
        req.reply({ statusCode: 200, body: observationsList[0] });
      } else {
        const obsAtualizada = { id: 1, author_name: attendant.name, user_name: attendant.name, body: novoTexto, observation: novoTexto, text: novoTexto, content: novoTexto, created_at: new Date().toISOString() };
        req.reply({ statusCode: 200, body: obsAtualizada });
      }
    };

    cy.intercept('PATCH', rotaApi(`attendances/${attendanceId}/observations*`), handlePatchObservation).as('updateObservation');
    cy.intercept('PATCH', rotaApi('customers/*/observations*'), handlePatchObservation).as('updateCustomerObservation');
    cy.intercept('PATCH', '**/observations*', handlePatchObservation).as('updateObservationGeneric');
    cy.intercept('PUT', rotaApi(`attendances/${attendanceId}/observations*`), handlePatchObservation).as('updateObservationPut');
    cy.intercept('PUT', rotaApi('customers/*/observations*'), handlePatchObservation).as('updateCustomerObservationPut');
    cy.intercept('PUT', '**/observations*', handlePatchObservation).as('updateObservationGenericPut');

    const handleDeleteObservation = (req) => {
      const match = req.url.match(/\/observations\/(\d+)/);
      const obsId = match ? parseInt(match[1], 10) : null;
      if (obsId) {
        observationsList = observationsList.filter(o => o.id !== obsId);
      } else if (observationsList.length > 0) {
        observationsList.shift();
      }
      req.reply({
        statusCode: 200,
        body: { ok: true }
      });
    };

    cy.intercept('DELETE', rotaApi(`attendances/${attendanceId}/observations/*`), handleDeleteObservation).as('deleteObservation');
    cy.intercept('DELETE', rotaApi('customers/*/observations/*'), handleDeleteObservation).as('deleteCustomerObservation');
    cy.intercept('DELETE', '**/observations/*', handleDeleteObservation).as('deleteObservationGeneric');
  }

  /**
   * Intercepta a listagem de mensagens padrão (/standard-messages)
   */
  interceptStandardMessagesApi(customPayload = null) {
    if (!this.isMockEnabled()) {
      cy.intercept('GET', rotaApi('standard-messages*'), (req) => req.continue()).as('getStandardMessages');
      return;
    }

    cy.intercept('GET', rotaApi('standard-messages*'), {
      statusCode: 200,
      body: customPayload || this.mockStandardMessagesData
    }).as('getStandardMessages');
  }

  /**
   * Intercepta as permissões de mensagens padrão (/standard-message-capabilities)
   */
  interceptStandardMessageCapabilitiesApi(customPayload = null) {
    if (!this.isMockEnabled()) {
      cy.intercept('GET', rotaApi('standard-message-capabilities*'), (req) => req.continue()).as('getStandardMessageCapabilities');
      return;
    }

    cy.intercept('GET', rotaApi('standard-message-capabilities*'), {
      statusCode: 200,
      body: customPayload || this.mockStandardMessageCapabilitiesData
    }).as('getStandardMessageCapabilities');
  }



  /**
   * Intercepta arquivos de IA (/attendances/:id/ia-files)
   */
  interceptIaFilesApi(attendanceId = '*', customPayload = null) {
    if (!this.isMockEnabled()) {
      cy.intercept('GET', rotaApi(`attendances/${attendanceId}/ia-files*`), (req) => req.continue()).as('getIaFiles');
      return;
    }

    cy.intercept('GET', rotaApi(`attendances/${attendanceId}/ia-files*`), {
      statusCode: 200,
      body: customPayload || { items: [], total: 0 }
    }).as('getIaFiles');
  }

  /**
   * Intercepta a rota de status do atendente (/attendants/:id/status)
   * @param {string|number} attendantId ID do atendente ('*' para todos)
   * @param {object|null} customPayload Payload customizado opcional
   * @param {number} statusCode Código HTTP de resposta (padrão 200)
   */
  interceptAttendantStatusApi(attendantId = '*', customPayload = null, statusCode = 200) {
    if (!this.isMockEnabled()) {
      cy.intercept('GET', rotaApi(`attendants/${attendantId}/status*`), (req) => req.continue()).as('getAttendantStatus');
      return;
    }

    const defaultStatus = {
      attendant_id: attendantId !== '*' ? Number(attendantId) : 122,
      status: "available",
      group_relations_count: 1,
      active_attendance_count: 1,
      status_changed_at: new Date().toISOString(),
      status_consistent: true
    };

    cy.intercept('GET', rotaApi(`attendants/${attendantId}/status*`), {
      statusCode,
      body: customPayload !== null ? customPayload : (statusCode === 200 ? defaultStatus : { message: 'Atendente não vinculado a grupo de canal' })
    }).as('getAttendantStatus');
  }

  /**
   * Intercepta a alteração de status do atendente (/attendants/:id)
   * @param {string|number} attendantId ID do atendente ('*' para todos)
   * @param {object|null} customPayload Payload customizado opcional
   * @param {number} statusCode Código HTTP de resposta (padrão 200)
   */
  interceptUpdateAttendantStatusApi(attendantId = '*', customPayload = null, statusCode = 200) {
    if (!this.isMockEnabled()) {
      cy.intercept('PATCH', rotaApi(`attendants/${attendantId}*`), (req) => req.continue()).as('updateAttendantStatus');
      return;
    }

    cy.intercept('PATCH', rotaApi(`attendants/${attendantId}*`), (req) => {
      if (statusCode !== 200) {
        req.reply({
          statusCode,
          body: customPayload || { message: 'Erro ao atualizar status do atendente' }
        });
        return;
      }

      const nextStatus = req.body?.status || 'busy';
      req.reply({
        statusCode: 200,
        body: customPayload || {
          attendant_id: attendantId !== '*' ? Number(attendantId) : 122,
          status: nextStatus,
          group_relations_count: 1,
          active_attendance_count: 1,
          status_changed_at: new Date().toISOString(),
          status_consistent: true
        }
      });
    }).as('updateAttendantStatus');
  }

  /**
   * Intercepta a alteração de status do atendimento (Finalizar, Concluir, etc.)
   * @param {string|number} attendanceId ID do atendimento ('*' para todos)
   * @param {object|null} customPayload Payload customizado opcional
   */
  interceptUpdateAttendanceStatusApi(attendanceId = '*', customPayload = null) {
    const pattern = attendanceId === '*'
      ? new RegExp(regexApi('attendances/\\d+([?#].*)?$'))
      : new RegExp(regexApi(`attendances/${attendanceId}([?#].*)?$`));

    if (!this.isMockEnabled()) {
      cy.intercept('PATCH', pattern, (req) => req.continue()).as('updateAttendanceStatusPatch');
      cy.intercept('PUT', pattern, (req) => req.continue()).as('updateAttendanceStatusPut');
      return;
    }

    const handlerStatusOrNotes = (req) => {
      const notes = req.body?.notes;
      const status = req.body?.status ?? 2;
      const resp = {
        id: attendanceId !== '*' ? Number(attendanceId) : 260800069,
        status: status,
        notes: notes !== undefined ? notes : null,
        updated_at: new Date().toISOString(),
        attendance: {
          id: attendanceId !== '*' ? Number(attendanceId) : 260800069,
          status: status,
          notes: notes !== undefined ? notes : null,
          updated_at: new Date().toISOString()
        }
      };
      // Só com customPayload trazendo status/custom_status (cenário de substatus, 5-A #12.8):
      // atualiza o estado vivo lido pelos GETs de interceptMockSubstatusPersonalizado, para o
      // refetch pós-PATCH refletir a mudança. A resposta sintética padrão segue sem estado.
      if (customPayload && Object.prototype.hasOwnProperty.call(customPayload, 'status')) {
        this._statusAtual = customPayload.status;
      }
      if (customPayload && Object.prototype.hasOwnProperty.call(customPayload, 'custom_status')) {
        this._substatusAtual = customPayload.custom_status;
      }
      req.reply({
        statusCode: 200,
        body: customPayload || resp
      });
    };

    cy.intercept('PATCH', pattern, handlerStatusOrNotes).as('updateAttendanceStatusPatch');
    cy.intercept('PUT', pattern, handlerStatusOrNotes).as('updateAttendanceStatusPut');
  }

  /**
   * Intercepta o PATCH de vínculo de cliente ao atendimento (Issue #440/#441, PR #470).
   * Registrar SEMPRE depois do beforeEach global (que já intercepta a mesma rota via
   * interceptUpdateAttendanceStatusApi) — o registro mais recente vence (AGENTS.md §3.3).
   * @param {string|number} attendanceId ID do atendimento ('*' para todos)
   * @param {object|null} customPayload Payload customizado opcional (mescla sobre o padrão de sucesso)
   * @param {number} statusCode HTTP status a responder (200 = sucesso; 4xx/5xx simula falha do vínculo)
   */
  interceptLinkCustomerApi(attendanceId = '*', customPayload = null, statusCode = 200) {
    const pattern = attendanceId === '*'
      ? new RegExp(regexApi('attendances/\\d+([?#].*)?$'))
      : new RegExp(regexApi(`attendances/${attendanceId}([?#].*)?$`));

    const corpoSucesso = {
      id: attendanceId !== '*' ? Number(attendanceId) : 260800035,
      customer: { customer_id: 867092, name: 'KLISMAM MONTEIRO', phone: '5511999998888' }
    };
    const corpoErro = { error: 'Internal Server Error' };
    const body = statusCode >= 200 && statusCode < 300
      ? { ...corpoSucesso, ...customPayload }
      : { ...corpoErro, ...customPayload };

    cy.intercept('PATCH', pattern, { statusCode, body }).as('linkCustomerPatch');
  }

  /**
   * Intercepta a busca de grupos de cliente (GET /client-groups), consultada
   * assim que o modal "Novo Cliente" abre (typeahead "Buscar grupo") — reaproveitado dentro do
   * diálogo "Vincular cliente" (botão "Cadastrar novo", Issue front#497/PR #499). Equivalente a
   * `ClientesMocks.interceptClientGroupsApi` da tela standalone (mesmo padrão de duplicação por
   * módulo já usado em `interceptClientCapabilitiesApi`).
   * @param {object|null} customPayload Payload customizado opcional
   */
  interceptClientGroupsApi(customPayload = null) {
    this.interceptRoute({
      method: 'GET',
      urlPattern: rotaApi('client-groups*'),
      customPayload,
      defaultBody: {
        items: [
          { id: 800014, name: 'Academia Prime Gym' }
        ]
      },
      alias: 'getClientGroups'
    });
  }

  /**
   * Payload-base de sucesso do cadastro de cliente a partir do diálogo "Vincular cliente"
   * (botão "Cadastrar novo", Issue front#497/PR #499) — getter: cada acesso devolve um objeto
   * novo, mesmo padrão de isolamento de `mockClientDetailData` acima.
   */
  get mockCreateClientFromAttendanceSuccessData() {
    return {
      id: 999101,
      name: 'Cliente Teste E2E',
      person_type: 1,
      document: null,
      active: true,
      // Obrigatório no schema de resposta do front (mesmo achado documentado em
      // 7.clientesMocks.js: ausência derruba a validação zod e exibe "Resposta do serviço
      // inválida" mesmo com 201).
      capabilities: {
        can_update_client: true,
        can_create_client: true,
        can_deactivate_client: true,
        can_view_client: true
      }
    };
  }

  /**
   * Payload de `client-capabilities` com as 4 dispensas concedidas (documento/telefone/
   * endereço/gênero) — necessário para o modal "Novo Cliente" aceitar gravar só com o nome
   * preenchido (Issue front#497/PR #499; mesmo padrão de `ClientesMocks.mockClientCapabilitiesAllWaivedData`
   * em `7.clientesMocks.js`). Sem isso, `interceptClientCapabilitiesApi()` no seu default (sem
   * dispensas) exige documento/telefone/endereço também — "Salvar" fica habilitado mas a
   * validação bloqueia o submit em silêncio (nenhum `POST` dispara, achado real 2026-10-02).
   */
  get mockClientCapabilitiesAllWaivedData() {
    return {
      capabilities: {
        can_update_client: true,
        can_create_client: true,
        can_deactivate_client: true,
        can_view_client: true,
        can_create_client_without_document: true,
        can_create_client_without_phone: true,
        can_create_client_without_address: true,
        can_create_client_without_gender: true
      }
    };
  }

  /**
   * Intercepta o POST de criação de cliente (POST /clients) disparado pelo
   * modal "Novo cliente" reaproveitado dentro do diálogo "Vincular cliente" (botão "Cadastrar
   * novo", Issue front#497/PR #499 — mesmo componente `NewClientModalSession` da tela de
   * Clientes, confirmado via bundle real; `7.clientesMocks.js` tem o equivalente para a tela
   * standalone, duplicado aqui por módulo, mesmo padrão de `interceptClientCapabilitiesApi`).
   * @param {object|null} customPayload Payload customizado opcional (mescla sobre o sucesso padrão)
   * @param {number} statusCode HTTP status a responder (201 = sucesso; 409 = CLIENT_ALREADY_EXISTS; 4xx/5xx = falha)
   * @param {number} delayMs Atraso artificial antes de responder (0 = imediato); usado pra manter
   * `isSaving` verdadeiro tempo suficiente pra testar que X/Escape/clique fora não fecham o modal
   * durante a gravação (mesmo padrão de `interceptSendMediaMessageApi`/`interceptCreateInternalNoteApi`)
   */
  interceptCreateClientApi(customPayload = null, statusCode = 201, delayMs = 0) {
    if (delayMs > 0) {
      const body = customPayload || this.mockCreateClientFromAttendanceSuccessData;
      cy.intercept('POST', new RegExp(regexApi('clients([?#].*)?$')), (req) => {
        req.reply({ statusCode, delay: delayMs, body });
      }).as('postCreateClientFromAttendance');
      return;
    }

    this.interceptRoute({
      method: 'POST',
      urlPattern: new RegExp(regexApi('clients([?#].*)?$')),
      customPayload,
      defaultBody: this.mockCreateClientFromAttendanceSuccessData,
      statusCode,
      alias: 'postCreateClientFromAttendance'
    });
  }

  /**
   * Intercepta a transferência de atendimento para um novo atendente
   * @param {string|number} attendanceId ID do atendimento ('*' para todos)
   * @param {object|null} customPayload Payload customizado opcional
   */
  interceptTransferAttendanceApi(attendanceId = '*', customPayload = null) {
    const attendant = this.getLoggedAttendant();
    const defaultResponse = {
      id: attendanceId !== '*' ? Number(attendanceId) : 260800106,
      status: 2,
      attendant_id: attendant.id,
      target_attendant_id: attendant.id,
      attendant: {
        id: attendant.id,
        name: attendant.name
      },
      group_id: 7,
      group: {
        id: 7,
        name: 'ATENDIMENTO'
      },
      channel_id: 6,
      channel: {
        id: 6,
        name: 'WHATSAPP OFICIAL - 62 98222-4382',
        type: 1,
        subtype: 1
      },
      customer_name: 'Cliente Teste',
      updated_at: new Date().toISOString(),
      attendance: {
        id: attendanceId !== '*' ? Number(attendanceId) : 260800106,
        reference_at: new Date().toISOString(),
        status: 2,
        channel: {
          id: 6,
          name: 'WHATSAPP OFICIAL - 62 98222-4382',
          type: 1,
          subtype: 1
        },
        group: {
          id: 7,
          name: 'ATENDIMENTO'
        },
        attendant_id: attendant.id,
        attendant: {
          id: attendant.id,
          name: attendant.name
        },
        last_customer_message_at: new Date().toISOString(),
        service_window: null
      },
      customer: {
        name: 'Cliente Teste',
        phone: '5562999999999',
        email: null,
        store_name: 'LOJA TESTE'
      },
      summaries: {
        quotes: { count: 0, total_amount: 0 },
        payment_links: { count: 0, pending_confirmation_count: 0 }
      },
      capabilities: {
        can_transfer_attendance: true,
        can_transfer: true,
        can_transfer_pending_attendance: true,
        can_transfer_occupied_attendance: true,
        can_change_status: true,
        can_complete_attendance: true,
        can_discard_attendance: true,
        can_mark_completed: true,
        can_mark_discarded: true,
        can_mark_finished: true,
        can_send_free_text: true,
        can_send_attendance_messages: true,
        can_view_attendance_detail: true,
        can_list_attendance_messages: true,
        can_create_quote: true,
        can_create_payment_link: true,
        can_list_group_agents: true
      }
    };

    const transferPattern = attendanceId === '*'
      ? new RegExp(regexApi('attendances/\\d+([?#].*)?$'))
      : new RegExp(regexApi(`attendances/${attendanceId}([?#].*)?$`));

    cy.intercept('POST', rotaApi(`attendances/${attendanceId}/transfer*`), {
      statusCode: 200,
      body: customPayload || defaultResponse
    }).as('transferAttendancePost');

    cy.intercept('PATCH', transferPattern, {
      statusCode: 200,
      body: customPayload || defaultResponse
    }).as('transferAttendancePatch');

    cy.intercept('PUT', transferPattern, {
      statusCode: 200,
      body: customPayload || defaultResponse
    }).as('transferAttendancePut');

    // Intercepta listagem de histórico de transferências via rota de mensagens com transfer_type=true
    const transferHistoryMessage = {
      id: 9999999,
      created_at: new Date().toISOString(),
      occurred_at: new Date().toISOString(),
      origin: "employee",
      employee_code: String(attendant.id || 122),
      employee: { id: attendant.id || 122, name: attendant.name },
      attendant: { id: attendant.id || 122, name: attendant.name },
      author: { id: attendant.id || 122, name: attendant.name },
      author_name: attendant.name,
      transfer_type: 1,
      content_type: "text",
      message_status: "sent",
      content: `Atendente alterado de ITALO PATRICK p/ ${attendant.name}`,
      body: `Atendente alterado de ITALO PATRICK p/ ${attendant.name}`,
      text: `Atendente alterado de ITALO PATRICK p/ ${attendant.name}`,
      attachment: null
    };

    const transferMessagesPayload = {
      items: [transferHistoryMessage],
      data: [transferHistoryMessage],
      messages: [transferHistoryMessage],
      pagination: { page: 1, per_page: 100, total: 1, total_pages: 1, has_next: false, has_previous: false }
    };

    cy.intercept('GET', rotaApi(`attendances/${attendanceId}/messages*transfer_type=true*`), {
      statusCode: 200,
      body: transferMessagesPayload
    }).as('getAttendanceTransferMessages');

    cy.intercept('GET', rotaApi('attendances/*/messages*transfer_type=true*'), {
      statusCode: 200,
      body: transferMessagesPayload
    }).as('getAttendanceTransferMessagesAll');

    cy.intercept('GET', rotaApi(`attendances/${attendanceId}/transfers*`), {
      statusCode: 200,
      body: transferMessagesPayload
    }).as('getAttendanceTransfers');

    cy.intercept('GET', rotaApi(`attendances/${attendanceId}/transfer*`), {
      statusCode: 200,
      body: transferMessagesPayload
    }).as('getAttendanceTransferSingle');

    cy.intercept('GET', rotaApi(`attendances/${attendanceId}/movements*`), {
      statusCode: 200,
      body: transferMessagesPayload
    }).as('getAttendanceMovements');

    cy.intercept('GET', rotaApi(`attendances/${attendanceId}/history*`), {
      statusCode: 200,
      body: transferMessagesPayload
    }).as('getAttendanceHistory');
  }

  /**
   * Intercepta consultas de eventos de atendimento (excluindo streams persistentes de SSE)
   */
  interceptAttendanceEventsApi() {
    cy.intercept('GET', rotaApi('attendance-events/stream*'), {
      statusCode: 403
    }).as('attendanceEventsStream');

    cy.intercept('GET', rotaApi('attendance-events?*'), {
      statusCode: 200,
      body: { items: [], cursor: 34, has_more: false }
    }).as('getAttendanceEvents');
  }

  /**
   * Intercepta consultas de eventos de atendimento permitindo injetar eventos customizados no feed
   * @param {Array} items Lista de eventos a serem retornados no feed
   * @param {number} cursor Cursor de paginação
   */
  interceptAttendanceEventsFeed(items = [], cursor = 34) {
    cy.intercept('GET', rotaApi('attendance-events/stream*'), {
      statusCode: 403
    }).as('attendanceEventsStream');

    cy.intercept('GET', rotaApi('attendance-events?*'), {
      statusCode: 200,
      body: { items, cursor, has_more: false }
    }).as('getAttendanceEventsFeed');
  }

  /**
   * Intercepta as permissões/capabilities de atendimento (/attendance-capabilities)
   * @param {object|null} customPayload Payload customizado opcional
   */
  interceptAttendanceCapabilitiesApi(customPayload = null) {
    const defaultPayload = {
      capabilities: {
        can_access_attendance_module: true,
        can_create_attendance: true,
        can_view_pending_attendance: true,
        can_view_occupied_attendance: true,
        can_create_customer_without_gender: false,
        can_list_group_agents: true,
        can_change_attendant_status: true,
        can_transfer_attendance: true,
        can_change_status: true
      }
    };

    this.interceptRoute({
      method: 'GET',
      urlPattern: rotaApi('attendance-capabilities*'),
      customPayload,
      defaultBody: defaultPayload,
      fixturePath: '3.central/attendance_capabilities.json',
      alias: 'getAttendanceCapabilities'
    });
  }

  /**
   * Intercepta a listagem de atendentes de um grupo (/attendance-groups/:groupId/agents ou /agents)
   * @param {number|string} groupId ID do grupo ('*' para todos)
   * @param {object|null} customPayload Payload customizado opcional
   */
  interceptAttendanceGroupAgentsApi(groupId = '*', customPayload = null) {
    this.interceptRoute({
      method: 'GET',
      urlPattern: /.*agents.*/,
      customPayload,
      defaultBody: this.mockAgentsGroup7Data,
      fixturePath: `5.atendimentos/agentsGroup_${groupId !== '*' ? groupId : '7'}.json`,
      alias: 'getAttendanceGroupAgents'
    });
  }

  /**
   * Intercepta a listagem de atendentes retornando mock com status configurável (busy, available, etc.)
   * @param {number|string} groupId ID do grupo ('*' para todos)
   * @param {string} status Status dos atendentes ('busy' | 'available')
   * @param {object|null} customPayload Payload customizado opcional
   */
  interceptMockAgentsGroup(groupId = '*', status = 'busy', customPayload = null) {
    let payload = customPayload || JSON.parse(JSON.stringify(this.mockAgentsGroup7Data));
    const attendant = this.getLoggedAttendant();

    if (!customPayload && status) {
      payload.agents = payload.agents.map((agent) => ({
        ...agent,
        status: status
      }));

      // Garante que o atendente configurado em env.json está presente na lista com o status solicitado
      const exists = payload.agents.some(a => a.id === attendant.id || a.name.toLowerCase() === attendant.name.toLowerCase());
      if (!exists && payload.agents.length > 0) {
        payload.agents[0] = {
          ...payload.agents[0],
          id: attendant.id,
          name: attendant.name,
          status: status
        };
      }
    }

    if (this.isMockEnabled()) {
      cy.intercept('GET', /.*agents.*/, (req) => {
        if (req.url.includes('attendance-groups')) {
          req.reply({ statusCode: 200, body: payload });
        } else {
          req.reply({ statusCode: 200, body: payload.agents || payload });
        }
      }).as('getAttendanceGroupAgents');
    } else {
      cy.intercept('GET', /.*agents.*/).as('getAttendanceGroupAgents');
    }
  }

  // -------------------------------------------------------------
  // MODAL DE TRANSFERÊNCIA: GRUPOS, ATENDENTES E TRANSFERÊNCIA PARA A FILA GERAL (Issue front#561/PR #574 e #578, backend#666)
  // Formato medido na API real da dev em 2026-10-16: `GET /channel-groups` traz `channels`, `agents_total` e `agents_available` por grupo;
  // `GET /attendance-groups/:id/agents` traz `agents[]` com `ongoing_attendances`.
  // -------------------------------------------------------------

  get mockTransferGroupsData() {
    return {
      items: [
        { id: 7, name: 'ATENDIMENTO', channels: [{ id: 6, name: 'WHATSAPP OFICIAL - 62 98222-4382' }], agents_total: 3, agents_available: 1 },
        { id: 1, name: 'BALCAO', channels: [{ id: 6, name: 'WHATSAPP OFICIAL - 62 98222-4382' }, { id: 3, name: 'WHATSAPP NAO OFICIAL - 4001' }], agents_total: 2, agents_available: 1 },
        { id: 5, name: 'E-COMMERCE', channels: [], agents_total: 1, agents_available: 0 }
      ]
    };
  }

  // Nomes com acento de propósito (a massa real não tem): a busca da modal precisa ignorar caixa e acento
  get mockTransferAgentsByGroup() {
    return {
      7: {
        group_id: 7,
        group_name: 'ATENDIMENTO',
        agents: [
          { agent_id: 501, name: 'José Conceição', status: 'available', last_attendance_at: null, ongoing_attendances: 2 },
          { agent_id: 502, name: 'MARIA LUÍSA', status: 'busy', last_attendance_at: null, ongoing_attendances: 0 },
          { agent_id: 503, name: 'Ana Júlia Araújo', status: 'offline', last_attendance_at: null, ongoing_attendances: 1 }
        ]
      },
      1: {
        group_id: 1,
        group_name: 'BALCAO',
        agents: [
          { agent_id: 511, name: 'Carlos Eduardo', status: 'available', last_attendance_at: null, ongoing_attendances: 0 },
          { agent_id: 512, name: 'Beatriz Souza', status: 'busy', last_attendance_at: null, ongoing_attendances: 3 }
        ]
      },
      5: {
        group_id: 5,
        group_name: 'E-COMMERCE',
        agents: [
          { agent_id: 521, name: 'Fernanda Lima', status: 'busy', last_attendance_at: null, ongoing_attendances: 1 }
        ]
      }
    };
  }

  /**
   * Intercepta a lista de grupos da modal de transferência (GET /channel-groups).
   * Modo real: passa para a rede e mantém o alias. Modo mock (ou `forcarMock`): devolve os grupos no formato real medido.
   * @param {boolean} forcarMock Força o payload fixo mesmo em API real (blindagem pontual, `[R-BLIND]`)
   * @param {object|null} payload Corpo próprio da lista (ex.: todos os grupos sem canal); só vale com mock ligado ou `forcarMock`
   */
  interceptTransferGroupsApi(forcarMock = false, payload = null) {
    if (forcarMock || this.isMockEnabled()) {
      cy.intercept('GET', rotaApi('channel-groups*'), { statusCode: 200, body: payload || this.mockTransferGroupsData }).as('getGruposCanal');
    } else {
      cy.intercept('GET', rotaApi('channel-groups*'), (req) => req.continue()).as('getGruposCanal');
    }
  }

  /**
   * Intercepta os atendentes de cada grupo da modal de transferência (GET /attendance-groups/:groupId/agents).
   * Modo real: passa para a rede e mantém o alias. Modo mock (ou `forcarMock`): devolve a lista do grupo pedido na URL.
   * @param {boolean} forcarMock Força o payload fixo mesmo em API real (blindagem pontual, `[R-BLIND]`)
   */
  interceptTransferAgentsApi(forcarMock = false) {
    const urlAgentes = new RegExp(regexApi('attendance-groups/\\d+/agents([?#].*)?$'));
    if (forcarMock || this.isMockEnabled()) {
      cy.intercept('GET', urlAgentes, (req) => {
        const idGrupo = Number(req.url.match(/attendance-groups\/(\d+)/)[1]);
        req.reply({ statusCode: 200, body: this.mockTransferAgentsByGroup[idGrupo] || { group_id: idGrupo, group_name: '', agents: [] } });
      }).as('getAttendanceGroupAgents');
    } else {
      cy.intercept('GET', urlAgentes, (req) => req.continue()).as('getAttendanceGroupAgents');
    }
  }

  /**
   * Simula o PATCH da transferência de um atendimento (alias `transferAttendancePatch`), SEMPRE com resposta fixa, em qualquer modo:
   * transferir para a fila geral de um grupo é uma gravação que não se desfaz (o atendimento vira Pendente e sem dono), então nunca deixa passar à API real.
   * @param {number|string} idAtendimento ID do atendimento
   * @param {object} opcoes `statusCode` (padrão 200) e `body` (padrão: atendimento Pendente, sem atendente, no grupo informado)
   */
  interceptTransferPatchApi(idAtendimento, { statusCode = 200, body = null, grupo = { id: 1, name: 'BALCAO' } } = {}) {
    const urlAtendimento = new RegExp(regexApi(`attendances/${idAtendimento}([?#].*)?$`));
    cy.intercept('PATCH', urlAtendimento, {
      statusCode,
      body: body || { id: Number(idAtendimento), status: 0, attendant_id: null, attendant: null, group_id: grupo.id, group: grupo }
    }).as('transferAttendancePatch');
  }

  /**
   * Intercepta a listagem e busca retornando um atendimento recente sem atendente vinculado
   * @param {number} idAtendimento ID do atendimento mockado
   * @param {string} nomeCliente Nome do cliente
   * @param {{id: number, name: string}} grupo Grupo do atendimento (padrão: 7 ATENDIMENTO)
   */
  interceptMockAtendimentoSemAtendente(idAtendimento = 260800105, nomeCliente = 'Klismam Monteiro', grupo = { id: 7, name: 'ATENDIMENTO' }) {
    this.interceptAttendanceItemCapabilitiesApi(idAtendimento);

    const detailRegex = new RegExp(regexApi(`attendances/${idAtendimento}([?#].*)?$`));
    cy.intercept('GET', detailRegex, (req) => {
      req.reply({
        statusCode: 200,
        body: {
          attendance: {
            id: idAtendimento,
            reference_at: new Date().toISOString(),
            status: 0,
            channel: {
              id: 6,
              name: "WHATSAPP OFICIAL - 62 98222-4382",
              type: 1,
              subtype: 1
            },
            group: {
              id: grupo.id,
              name: grupo.name
            },
            attendant: null,
            last_customer_message_at: new Date().toISOString(),
            service_window: null
          },
          customer: {
            name: nomeCliente,
            phone: "5562999999999",
            email: null,
            store_name: "LOJA TESTE"
          },
          summaries: {
            quotes: { count: 0, total_amount: 0 },
            payment_links: { count: 0, pending_confirmation_count: 0 }
          },
          capabilities: {
            can_view_attendance_detail: true,
            can_list_attendance_messages: true,
            can_send_attendance_messages: true,
            can_send_free_text: true,
            can_mark_completed: true,
            can_mark_discarded: true,
            can_mark_finished: true,
            can_transfer_assigned_attendance: true,
            can_transfer_pending_attendance: true
          }
        }
      });
    }).as('getAttendanceDetail');

    const payload = {
      items: [
        {
          id: idAtendimento,
          reference_at: new Date().toISOString(),
          attendant_name: null,
          attendant: null,
          customer_name: nomeCliente,
          messages: {
            unread_count: 1,
            last_message: {
              type: 1,
              body: "Oi",
              occurred_at: new Date().toISOString()
            }
          },
          status: 0,
          channel: {
            id: 6,
            name: "WHATSAPP OFICIAL - 62 98222-4382",
            type: 1,
            subtype: 1
          },
          group: {
            id: grupo.id,
            name: grupo.name
          }
        }
      ],
      pagination: { page: 1, per_page: 20, total: 1, total_pages: 1, has_next: false, has_previous: false }
    };

    cy.intercept('GET', rotaApi('attendances?*'), {
      statusCode: 200,
      body: payload
    }).as('getAttendancesList');

    cy.intercept('GET', rotaApi('attendances?*search=*'), {
      statusCode: 200,
      body: payload
    }).as('searchAttendancesApi');
  }

  /**
   * Intercepta a listagem e busca retornando um atendimento vinculado ao operador
   * @param {number} idAtendimento ID do atendimento mockado
   * @param {string} nomeAtendente Nome do atendente logado
   * @param {number} idAtendente ID do atendente logado
   * @param {string} nomeCliente Nome do cliente
   */
  interceptMockAtendimentoVinculado(
    idAtendimento = 260800106,
    nomeAtendente = null,
    idAtendente = null,
    nomeCliente = 'Klismam Monteiro'
  ) {
    const defaultAttendant = this.getLoggedAttendant();
    const finalNomeAtendente = nomeAtendente || defaultAttendant.name;
    const finalIdAtendente = idAtendente || defaultAttendant.id;

    this.interceptAttendanceItemCapabilitiesApi(idAtendimento);

    const payload = {
      items: [
        {
          id: idAtendimento,
          reference_at: new Date().toISOString(),
          attendant_name: finalNomeAtendente,
          attendant: {
            id: finalIdAtendente,
            name: finalNomeAtendente
          },
          customer_name: nomeCliente,
          messages: {
            unread_count: 0,
            last_message: {
              type: 0,
              body: "Oi",
              occurred_at: new Date().toISOString()
            }
          },
          status: 2,
          channel: {
            id: 6,
            name: "WHATSAPP OFICIAL - 62 98222-4382",
            type: 1,
            subtype: 1
          },
          group: {
            id: 7,
            name: "ATENDIMENTO"
          }
        }
      ],
      pagination: { page: 1, per_page: 20, total: 1, total_pages: 1, has_next: false, has_previous: false }
    };

    const detailRegex = new RegExp(regexApi(`attendances/${idAtendimento}([?#].*)?$`));
    cy.intercept('GET', detailRegex, (req) => {
      req.reply({
        statusCode: 200,
        body: {
          attendance: {
            id: idAtendimento,
            reference_at: new Date().toISOString(),
            status: 2,
            channel: {
              id: 6,
              name: "WHATSAPP OFICIAL - 62 98222-4382",
              type: 1,
              subtype: 1
            },
            group: {
              id: 7,
              name: "ATENDIMENTO"
            },
            attendant_name: nomeAtendente,
            attendant: {
              id: idAtendente,
              name: nomeAtendente
            },
            attendant_id: idAtendente,
            service_window_active: true,
            last_customer_message_at: new Date().toISOString(),
            service_window: {
              started_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 86400000).toISOString()
            }
          },
          customer: {
            name: nomeCliente,
            phone: "5562999999999",
            email: null,
            store_name: "LOJA TESTE"
          },
          summaries: {
            quotes: { count: 0, total_amount: 0 },
            payment_links: { count: 0, pending_confirmation_count: 0 }
          },
          capabilities: { ...this.mockAttendanceItemCapabilitiesData.capabilities }
        }
      });
    }).as('getAttendanceDetail');

    this.interceptSendMessageApi(idAtendimento);

    cy.intercept('GET', rotaApi('attendances?*'), {
      statusCode: 200,
      body: payload
    }).as('getAttendancesList');

    cy.intercept('GET', rotaApi('attendances?*search=*'), {
      statusCode: 200,
      body: payload
    }).as('searchAttendancesApi');
  }

  /**
   * Intercepta a listagem de notas internas da gaveta (/attendances/:id/messages?*origin=internal*)
   * @param {string|number} attendanceId ID do atendimento ('*' para todos)
   * @param {Array} initialNotes Lista inicial de notas
   */
  interceptInternalNotesApi(attendanceId = '*', initialNotes = []) {
    if (!this.isMockEnabled()) {
      cy.intercept('GET', rotaApi(`attendances/${attendanceId}/messages*origin=internal*`), (req) => req.continue()).as('getInternalNotes');
      return;
    }

    this._internalNotesStore = Array.isArray(initialNotes) ? [...initialNotes] : [];

    cy.intercept('GET', rotaApi(`attendances/${attendanceId}/messages*origin=internal*`), (req) => {
      req.reply({
        statusCode: 200,
        body: {
          data: this._internalNotesStore,
          pagination: {
            page: 1,
            per_page: 100,
            total: this._internalNotesStore.length,
            total_pages: 1,
            has_next: false,
            has_previous: false
          }
        }
      });
    }).as('getInternalNotes');
  }

  /**
   * Intercepta a criação de uma nota interna (/attendances/:id/messages)
   * Mantém o store local atualizado para que o background refetch do React Query receba a nova nota imediatamente
   * @param {string|number} attendanceId ID do atendimento ('*' para todos)
   */
  interceptCreateInternalNoteApi(attendanceId = '*', delayMs = 0) {
    if (!this.isMockEnabled()) {
      cy.intercept('POST', rotaApi(`attendances/${attendanceId}/messages*`), (req) => req.continue()).as('createInternalNote');
      return;
    }

    cy.intercept('POST', rotaApi(`attendances/${attendanceId}/messages*`), (req) => {
      const conteudo = req.body?.content || req.body?.body || req.body?.text || 'Nota interna';
      const novaNotaId = Date.now();
      const novaNota = {
        id: novaNotaId,
        created_at: new Date().toISOString(),
        origin: 'internal',
        employee_code: '122',
        transfer_type: 6,
        content_type: 'text',
        message_status: 'ready',
        content: conteudo,
        attachment: null
      };

      if (!this._internalNotesStore) {
        this._internalNotesStore = [];
      }
      this._internalNotesStore.unshift(novaNota);

      req.reply({
        statusCode: 201,
        delay: delayMs,
        body: {
          id: novaNotaId,
          created_at: novaNota.created_at
        }
      });
    }).as('createInternalNote');
  }

  /**
   * Intercepta a listagem de funcionários da loja/tenant (/employees)
   * Utilizada no modal de filtros avançados (PR #339)
   * @param {string|number} storeId ID da loja ('*' para todos)
   * @param {object|null} customPayload Payload customizado
   * @param {boolean} forceMock Força resposta mockada mesmo se USE_MOCKS for falso
   */
  interceptStoreEmployeesApi(storeId = '*', customPayload = null, forceMock = false) {
    if (!this.isMockEnabled() && !forceMock) {
      cy.intercept('GET', rotaApi('employees*'), (req) => req.continue()).as('getStoreEmployees');
      return;
    }

    const attendant = this.getLoggedAttendant();
    const defaultPayload = {
      items: [
        { id: attendant.id || 122, name: attendant.name || "KLISMAM MONTEIRO", commissioned: false },
        { id: 55, name: "AGENCIAULAB", commissioned: false },
        { id: 3, name: "ALEX-PH24", commissioned: false },
        { id: 114, name: "JOAO RICARDO DA SILVA", commissioned: false }
      ],
      total: 4
    };

    cy.intercept('GET', rotaApi('employees*'), {
      statusCode: 200,
      body: customPayload || defaultPayload
    }).as('getStoreEmployees');
  }

  /**
   * Remove os mocks de dados para permitir que os testes interajam com a API real (End-to-End).
   * No Cypress, para sobreescrever um mock anterior, devemos passar um handler chamando req.continue()
   */
  clearMocksForRealE2ETests() {
    const isAutoSync = Cypress.env('AUTO_SYNC_MOCKS') === true || Cypress.env('AUTO_SYNC_MOCKS') === 'true';
    const continueWithSync = (fixturePath) => (req) => {
      if (isAutoSync && fixturePath) {
        req.continue((res) => {
          if (res && res.statusCode >= 200 && res.statusCode < 300 && res.body) {
            this._saveFixture(fixturePath, res.body);
          }
        });
      } else {
        req.continue();
      }
    };

    cy.intercept('GET', rotaApi('attendance-events/stream*'), { statusCode: 403 }).as('attendanceEventsStream');
    cy.intercept('GET', rotaApi('attendances/summary*'), continueWithSync('5.atendimentos/summary.json')).as('getAttendancesSummary');
    cy.intercept('GET', rotaApi('attendances?*'), continueWithSync('5.atendimentos/attendancesList.json')).as('getAttendancesList');
    cy.intercept('GET', rotaApi('attendances?*search=*'), (req) => req.continue()).as('searchAttendancesApi');
    cy.intercept('GET', rotaApi('attendances/*/message-templates*'), continueWithSync('5.atendimentos/messageTemplates.json')).as('getAttendanceMessageTemplates');
    cy.intercept('GET', rotaApi('attendance-groups/*/agents*'), (req) => req.continue()).as('getAttendanceGroupAgents');
    cy.intercept('GET', rotaApi('employees*'), (req) => req.continue()).as('getStoreEmployees');
    cy.intercept('PATCH', rotaApi('attendances/*'), (req) => req.continue()).as('transferAttendancePatch');
    cy.intercept('PUT', rotaApi('attendances/*'), (req) => req.continue()).as('updateAttendanceStatusPut');
    cy.intercept('GET', rotaApi('attendances/*/messages*'), (req) => req.continue()).as('getAttendanceMessages');
    cy.intercept('GET', rotaApi('attendances/*/messages*origin=internal*'), (req) => req.continue()).as('getInternalNotes');
    cy.intercept('POST', rotaApi('attendances/*/messages*'), (req) => req.continue()).as('sendChatMessage');
    cy.intercept('GET', rotaApi('attendance-capabilities*'), continueWithSync('5.atendimentos/attendanceCapabilities.json')).as('getAttendanceCapabilities');
    // Sem handler (Issue cypress#003): ver nota em interceptSendMediaMessageApi - com callback, o
    // proxy bufferiza o upload inteiro antes de repassar, somando latência real ao envio de mídia.
    cy.intercept('POST', rotaApi('attendances/*/messages/media*')).as('sendChatMediaMessage');
    cy.intercept('GET', rotaApi('attendances/*/payment-links*'), (req) => req.continue()).as('getPaymentLinks');
    cy.intercept('POST', rotaApi('attendances/*/payment-links*'), (req) => req.continue()).as('sendPaymentLink');
    cy.intercept('GET', rotaApi('attendances/*/quotes*'), (req) => req.continue()).as('getAttendanceQuotes');
    cy.intercept('GET', rotaApi('attendants/*/status*'), (req) => req.continue()).as('getAttendantStatus');
    cy.intercept('PATCH', rotaApi('attendants/*'), (req) => req.continue()).as('updateAttendantStatus');
  }
  /**
   * Intercepta a rota de marcar como lido
   * @param {number|string} attendanceId 
   * @param {object} responsePayload 
   * @param {number} statusCode 
   */
  interceptReadApi(attendanceId, responsePayload, statusCode = 200) {
    if (!this.isMockEnabled()) {
      cy.intercept('POST', rotaApi(`attendances/${attendanceId}/read*`), (req) => req.continue()).as('postReadApi');
      return;
    }
    
    // Fallback pra string genérica se não vier ID
    const urlPattern = attendanceId === '*' 
      ? rotaApi('attendances/*/read*') 
      : rotaApi(`attendances/${attendanceId}/read*`);

    // Regra de Ouro (Reflexão Dinâmica de Atributos em Mocks de Mutação):
    // TanStack Query precisa do objeto atualizado dentro da chave `attendance` 
    // para sobreescrever o cache adequadamente após a resposta do POST.
    if (responsePayload && !responsePayload.attendance) {
      responsePayload.attendance = {
        id: attendanceId === '*' ? 260800035 : parseInt(attendanceId),
        messages: {
          unread_count: responsePayload.unread_count !== undefined ? responsePayload.unread_count : 0
        }
      };
    }

    cy.intercept('POST', urlPattern, {
      statusCode,
      body: responsePayload
    }).as('postReadApi');
  }

  /**
   * Modifica a fila padrão do AtendimentosMocks para devolver um contador específico
   * para um determinado card. Usado no CA-02 (sem badge) e CA-05 (aumento de contador).
   * @param {number} targetId 
   * @param {number} newUnreadCount 
   */
  interceptQueueWithCustomCount(targetId, newUnreadCount) {
    // Clonamos o objeto padrão retornado pelo getter
    const queueData = JSON.parse(JSON.stringify(this.mockAttendancesListData));
    
    const targetItem = queueData.items.find(item => item.id === targetId);
    if (targetItem) {
      targetItem.messages.unread_count = newUnreadCount;
    }

    this.interceptAttendancesListApi(queueData);
  }

  /**
   * Sobrescreve apenas o messages.last_message de um card específico da fila (type, body,
   * content_type, occurred_at), preservando o restante do item. Usado para validar a prévia
   * de mídia do card por content_type (Issue #383 / PRs #386, #387, #415, #497).
   * @param {number} targetId
   * @param {object} lastMessageOverrides
   */
  interceptQueueWithLastMessagePreview(targetId, lastMessageOverrides) {
    const queueData = JSON.parse(JSON.stringify(this.mockAttendancesListData));

    const targetItem = queueData.items.find(item => item.id === targetId);
    if (targetItem) {
      targetItem.messages.last_message = {
        ...targetItem.messages.last_message,
        ...lastMessageOverrides
      };
    }

    this.interceptAttendancesListApi(queueData);
  }

  /**
   * Altera a permissão 'can_view_occupied_attendance' dinamicamente
   */
  interceptCapabilities(canViewOccupied) {
    const caps = {
      can_access_attendance_module: true,
      can_view_occupied_attendance: canViewOccupied
    };
    this.interceptAttendanceCapabilitiesApi({ capabilities: caps });
  }

  // -------------------------------------------------------------
  // DRAWER "DADOS DO CLIENTE" (PR #427 / #432 / #438 - editClientDrawer)
  // -------------------------------------------------------------

  /**
   * Payload-base da ficha do cliente consumida pelo drawer "Dados do cliente" (getter: cada
   * acesso devolve um objeto novo, evitando vazamento de customização entre testes — ver
   * AGENTS.md §2 "Isolamento de Payloads Compartilhados").
   */
  get mockClientDetailData() {
    return JSON.parse(JSON.stringify(mockClientDetailData));
  }

  /**
   * Intercepta as capabilities do módulo de clientes (GET /client-capabilities -
   * PR #418/#438). Necessário para que o menu "Dados do cliente" seja renderizado: a ação só existe
   * quando can_update_client vier true (confirmado via inspeção do bundle real, função Uh() de
   * index-*.js: `canUpdateClient && !isPatientResourceDenied ? customerCode : null`).
   * @param {object|null} customPayload Payload customizado opcional (ex: { capabilities: { can_update_client: false } })
   */
  interceptClientCapabilitiesApi(customPayload = null) {
    this.interceptRoute({
      method: 'GET',
      urlPattern: rotaApi('client-capabilities*'),
      customPayload,
      defaultBody: {
        capabilities: {
          can_update_client: true,
          can_create_client: true,
          can_deactivate_client: true,
          can_view_client: true
        }
      },
      alias: 'getClientCapabilities'
    });
  }

  /**
   * Intercepta a rota de ficha completa do cliente (GET /clients/:clientId).
   * RegExp estrita para não colidir com sub-rotas (/addresses, /phones, /deactivation) — ver
   * AGENTS.md §6 "RegExp Estrita em Intercepts de Recursos Pai".
   * @param {string|number} clientId ID do cliente ('*' para qualquer um)
   * @param {object|null} customPayload Payload customizado opcional (ex: addresses: [] para o fallback vazio)
   */
  interceptClientDetailApi(clientId = '*', customPayload = null) {
    const idPattern = clientId === '*' ? '\\d+' : String(clientId);
    const detailRegex = new RegExp(regexApi(`clients/${idPattern}([?#].*)?$`));
    this.interceptRoute({
      method: 'GET',
      urlPattern: detailRegex,
      customPayload,
      defaultBody: this.mockClientDetailData,
      fixturePath: '5.atendimentos/clientDetail.json',
      alias: 'getClientDetail'
    });
  }

  /**
   * Intercepta a mutação da ficha do cliente (PATCH /clients/:clientId).
   * Em modo mock, ecoa os campos recebidos no payload de resposta (evita que o TanStack Query
   * sobrescreva o cache local com valores desatualizados — mesmo padrão do PATCH de observações).
   * Em modo API Real, apenas deixa passar (req.continue) para validação híbrida via cy.wait.
   * @param {string|number} clientId ID do cliente ('*' para qualquer um)
   * @param {object|null} customPayload Resposta customizada explícita opcional
   */
  interceptPatchClientApi(clientId = '*', customPayload = null) {
    const idPattern = clientId === '*' ? '\\d+' : String(clientId);
    const detailRegex = new RegExp(regexApi(`clients/${idPattern}([?#].*)?$`));

    if (customPayload !== null) {
      cy.intercept('PATCH', detailRegex, { statusCode: 200, body: customPayload }).as('patchClient');
      return;
    }

    if (this.isMockEnabled()) {
      cy.intercept('PATCH', detailRegex, (req) => {
        req.reply({ statusCode: 200, body: { ...this.mockClientDetailData, ...req.body } });
      }).as('patchClient');
    } else {
      cy.intercept('PATCH', detailRegex, (req) => req.continue()).as('patchClient');
    }
  }

  /**
   * Intercepta a criação de um novo endereço do cliente (POST /clients/:clientId/addresses).
   * Em modo mock, devolve o endereço enviado com um id sintético, sem promover o endereço principal
   * existente (reflete a regra da PR #427: novo endereço nunca substitui o principal automaticamente).
   * @param {string|number} clientId ID do cliente ('*' para qualquer um)
   * @param {object|null} customPayload Resposta customizada explícita opcional
   */
  interceptPostClientAddressApi(clientId = '*', customPayload = null) {
    const idPattern = clientId === '*' ? '\\d+' : String(clientId);
    const pattern = new RegExp(regexApi(`clients/${idPattern}/addresses([?#].*)?$`));

    if (customPayload !== null) {
      cy.intercept('POST', pattern, { statusCode: 201, body: customPayload }).as('postClientAddress');
      return;
    }

    if (this.isMockEnabled()) {
      cy.intercept('POST', pattern, (req) => {
        req.reply({
          statusCode: 201,
          body: { id: Date.now(), primary: false, invoice: false, ...req.body }
        });
      }).as('postClientAddress');
    } else {
      cy.intercept('POST', pattern, (req) => req.continue()).as('postClientAddress');
    }
  }

  /**
   * Intercepta a atualização de um endereço existente do cliente
   * (PATCH /clients/:clientId/addresses/:addressId).
   * @param {string|number} clientId ID do cliente ('*' para qualquer um)
   * @param {object|null} customPayload Resposta customizada explícita opcional
   */
  interceptPatchClientAddressApi(clientId = '*', customPayload = null) {
    const idPattern = clientId === '*' ? '\\d+' : String(clientId);
    const pattern = new RegExp(regexApi(`clients/${idPattern}/addresses/\\d+([?#].*)?$`));

    if (customPayload !== null) {
      cy.intercept('PATCH', pattern, { statusCode: 200, body: customPayload }).as('patchClientAddress');
      return;
    }

    if (this.isMockEnabled()) {
      cy.intercept('PATCH', pattern, (req) => {
        req.reply({ statusCode: 200, body: { ...req.body } });
      }).as('patchClientAddress');
    } else {
      cy.intercept('PATCH', pattern, (req) => req.continue()).as('patchClientAddress');
    }
  }
}

export default new AtendimentosMocks();
