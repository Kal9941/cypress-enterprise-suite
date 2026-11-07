import BaseMock from './BaseMock';
import { regexApi, rotaApi } from '../support/rotaApi';

/**
 * Mocks e interceptações da tela de Automações (Issue front#605, PR #604).
 * Formatos medidos na dev em 2026-11-05 (GET/POST/PATCH/DELETE /automations, /automation-capabilities): a loja vem do token (sem /stores/:id),
 * o detalhe traz a árvore de passos e o `updated_at` (trava otimista do PATCH), o 409 responde `AUTOMATION_CHANGED` e o 422 responde `issues`.
 * Em API real, sem `customPayload`, tudo passa pela rede (interceptação passiva) — só o `customPayload` força a resposta.
 */
class AutomacoesMocks extends BaseMock {
  // Passo mínimo válido (`send_message`) e árvores prontas como getters: cada acesso devolve um objeto novo ([R-MOCK])
  get passoMensagem() {
    return { step_type: 'send_message', step_config: { text: 'Olá!' }, branches: null };
  }

  /** Item da listagem (`GET /automations` devolve resumo, sem árvore nem canais). */
  itemDaLista(sobrescrever = {}) {
    return {
      id: 9001,
      name: 'Automação de exemplo',
      description: 'Descrição de exemplo',
      trigger_type: 'keyword_match',
      is_active: false,
      all_channels: true,
      run_count: 0,
      last_run_at: null,
      is_default: false,
      ...sobrescrever
    };
  }

  /** Detalhe da automação (`GET /automations/:id`, ack do POST/PATCH): árvore aninhada e `updated_at`. */
  detalhe(sobrescrever = {}) {
    return {
      id: 9001,
      name: 'Automação de exemplo',
      description: 'Descrição de exemplo',
      trigger_type: 'keyword_match',
      trigger_config: { keywords: ['exemplo'], match_type: 'contains', case_sensitive: false },
      is_active: false,
      all_channels: true,
      channel_ids: [],
      run_count: 0,
      last_run_at: null,
      updated_at: '2026-11-05T12:00:00.000Z',
      steps: [this.passoMensagem],
      is_default: false,
      ...sobrescrever
    };
  }

  get capabilitiesCompletas() {
    return { capabilities: { can_list: true, can_create: true, can_edit: true, can_delete: true } };
  }

  /** `GET /automation-capabilities`: `{ can_list, can_create, can_edit, can_delete }` (legado 635). O fallback `**\/*capabilities*` do e2e.js responde capabilities de Atendimento, por isso o mock próprio. */
  interceptAutomationCapabilitiesApi(customPayload = null, statusCode = 200) {
    this.interceptRoute({
      method: 'GET',
      urlPattern: rotaApi('automation-capabilities*'),
      customPayload,
      defaultBody: this.capabilitiesCompletas,
      alias: 'getAutomationCapabilities',
      statusCode
    });
  }

  /** `GET /automations`: `{ data: [...] }`. */
  interceptAutomationsListApi(customPayload = null, statusCode = 200) {
    this.interceptRoute({
      method: 'GET',
      urlPattern: rotaApi('automations*'),
      customPayload,
      defaultBody: { data: [this.itemDaLista()] },
      alias: 'getAutomationsList',
      statusCode
    });
  }

  /**
   * `GET /automations/templates`: a galeria de modelos saiu do front (PR #679, 2026-11-05) e a tela não chama mais a rota; o intercept fica só como espião
   * (`@getAutomationTemplates.all` com 0 chamadas em `8.automacoes #2.2`). Medido na dev em 2026-11-06: nenhuma chamada ao abrir a lista.
   */
  interceptAutomationTemplatesApi(customPayload = null, statusCode = 200) {
    this.interceptRoute({
      method: 'GET',
      urlPattern: rotaApi('automations/templates*'),
      customPayload,
      defaultBody: { templates: [] },
      alias: 'getAutomationTemplates',
      statusCode
    });
  }

  /** `GET /automations/:id`: `{ automation }`. Regex estrita para não colidir com `/templates` nem `/:id/logs`. */
  interceptAutomationDetailApi(id = '*', customPayload = null, statusCode = 200) {
    const idPattern = id === '*' ? '\\d+' : String(id);
    this.interceptRoute({
      method: 'GET',
      urlPattern: new RegExp(regexApi(`automations/${idPattern}([?#].*)?$`)),
      customPayload,
      defaultBody: { automation: this.detalhe() },
      alias: 'getAutomationDetail',
      statusCode
    });
  }

  /** `POST /automations` (cria por árvore ou por `template_slug`): ack `{ automation, warnings }`. Passivo em API real. */
  interceptAutomationCreateApi(customPayload = null, statusCode = 201) {
    this.interceptRoute({
      method: 'POST',
      urlPattern: rotaApi('automations'),
      customPayload,
      defaultBody: { automation: this.detalhe(), warnings: [] },
      alias: 'postAutomation',
      statusCode
    });
  }

  /** `POST /automations` que responde depois do tempo limite do fetch do front (15 s): o front aborta e trata como timeout (P1-59, parte 10). */
  interceptAutomationCreateApiLenta(delayMs = 16000) {
    cy.intercept('POST', rotaApi('automations'), { statusCode: 201, body: { automation: this.detalhe(), warnings: [] }, delay: delayMs }).as('postAutomationLento');
  }

  /**
   * `POST /automations/:id/duplicate` mockado (P1-59, parte 10): `201` com o ack da cópia, ou a recusa (`422` com `issues`, `5xx`).
   * Sempre mockado: a dev não tem automação que o servidor recuse duplicar sob demanda.
   */
  interceptAutomationDuplicateApi(id = '*', body = null, statusCode = 201) {
    cy.intercept('POST', rotaApi(`automations/${id}/duplicate`), {
      statusCode,
      body: body || { automation: this.detalhe({ id: 9099, name: 'Automação de exemplo (cópia)' }), warnings: [] },
    }).as('postAutomationDuplicate');
  }

  /** `PATCH /automations/:id`: ack `{ automation, warnings }`; 409 `AUTOMATION_CHANGED`; 422 `{ issues: [{ path, message, code }] }`. */
  interceptAutomationUpdateApi(id = '*', customPayload = null, statusCode = 200) {
    const idPattern = id === '*' ? '\\d+' : String(id);
    this.interceptRoute({
      method: 'PATCH',
      urlPattern: new RegExp(regexApi(`automations/${idPattern}([?#].*)?$`)),
      customPayload,
      defaultBody: { automation: this.detalhe(), warnings: [] },
      alias: 'patchAutomation',
      statusCode
    });
  }

  /** `GET /automations/:id/logs?page=N`: `{ data: [...], has_next }`. */
  interceptAutomationLogsApi(id = '*', customPayload = null, statusCode = 200) {
    const idPattern = id === '*' ? '\\d+' : String(id);
    this.interceptRoute({
      method: 'GET',
      urlPattern: new RegExp(regexApi(`automations/${idPattern}/logs([?#].*)?$`)),
      customPayload,
      defaultBody: { data: [], has_next: false },
      alias: 'getAutomationLogs',
      statusCode
    });
  }

  /** Corpo de erro do 409 de edição concorrente (medido na dev em 2026-11-05). */
  get corpoConflito() {
    return {
      status: 409,
      error: 'Conflict',
      message: 'Outra pessoa salvou esta automação enquanto você editava. Recarregue para ver a versão atual.',
      code: 'AUTOMATION_CHANGED',
      timestamp: '2026-11-05T12:00:00.000Z'
    };
  }

  /** Corpo de erro do 422 de validação do servidor (medido na dev em 2026-11-05): `issues` com `path`, `message` e `code`. */
  corpoRejeitado(issues) {
    return {
      status: 422,
      error: 'Unprocessable Content',
      message: 'Não foi possível salvar a automação. Corrija os campos indicados.',
      issues,
      timestamp: '2026-11-05T12:00:00.000Z'
    };
  }
}

export default new AutomacoesMocks();
