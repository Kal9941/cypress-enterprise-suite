import BaseMock from './BaseMock';
import AtendimentosMocks from './5.atendimentosMocks';
import RecursosMocks from './1.recursosMocks';
import prescriptionCreateData from '../fixtures/6.receitas/prescriptionCreate.json';
import prescriptionFormulaCreateData from '../fixtures/6.receitas/prescriptionFormulaCreate.json';
import prescriptionProductCreateData from '../fixtures/6.receitas/prescriptionProductCreate.json';
import prescriptionCalculateData from '../fixtures/6.receitas/prescriptionCalculate.json';
import prescriptionDetailData from '../fixtures/6.receitas/prescriptionDetail.json';
import prescriptionCapabilitiesData from '../fixtures/6.receitas/prescriptionCapabilities.json';
import prescriptionsSearchData from '../fixtures/6.receitas/prescriptionsSearch.json';
// Formato real medido na API em 2026-10-22 e 2026-11-06: GET devolve { items: [{ id, process_type_id, process_type_name, employee_id, employee_name, date, time, sequence, commissioned, blocks_calculation, blocks_prescription }] }.
// O retorno de POST/PATCH não foi medido (grava na receita): o padrão usa o 1º item como corpo (ROADMAP.md P2-37).
import manipulationProcessesData from '../fixtures/6.receitas/manipulationProcesses.json';
import trackingStepsData from '../fixtures/6.receitas/trackingSteps.json';
import laboratoriesData from '../fixtures/6.receitas/laboratories.json';
import pharmaceuticalFormsData from '../fixtures/6.receitas/pharmaceuticalForms.json';
import unitsData from '../fixtures/6.receitas/units.json';
import attendanceBudgetsEmptyData from '../fixtures/6.receitas/attendanceBudgetsEmpty.json';
import productsData from '../fixtures/6.receitas/products.json';
import formulaCalculationsPreviewData from '../fixtures/6.receitas/formulaCalculationsPreview.json';
import { regexApi, rotaApi } from '../support/rotaApi';

/**
 * Mocking e interceptações de rede para o módulo de Receitas e Prescrições
 */
class ReceitasMocks extends BaseMock {

  /**
   * Intercepta a criação de prescrição/receita (POST /prescriptions)
   */
  interceptCreatePrescriptionApi(customPayload = null) {
    this.interceptRoute({
      method: 'POST',
      urlPattern: rotaApi('prescriptions'),
      customPayload,
      defaultBody: prescriptionCreateData,
      fixturePath: '6.receitas/prescriptionCreate.json',
      alias: 'createPrescriptionApi',
      statusCode: 200
    });
  }

  /**
   * Intercepta a criação de fórmula na receita (POST /prescriptions/:id/formulas)
   */
  interceptCreateFormulaApi(prescriptionId = '*', customPayload = null) {
    this.interceptRoute({
      method: 'POST',
      urlPattern: rotaApi(`prescriptions/${prescriptionId}/formulas`),
      customPayload,
      defaultBody: prescriptionFormulaCreateData,
      fixturePath: '6.receitas/prescriptionFormulaCreate.json',
      alias: 'createFormulaApi',
      statusCode: 200
    });
  }

  /**
   * Intercepta a adição de produtos na fórmula (POST /prescriptions/:id/formulas/:formulaId/products)
   */
  interceptAddProductFormulaApi(prescriptionId = '*', formulaId = '*', customPayload = null) {
    this.interceptRoute({
      method: 'POST',
      urlPattern: rotaApi(`prescriptions/${prescriptionId}/formulas/${formulaId}/products`),
      customPayload,
      defaultBody: prescriptionProductCreateData,
      fixturePath: '6.receitas/prescriptionProductCreate.json',
      alias: 'addProductFormulaApi',
      statusCode: 200
    });
  }

  /**
   * Intercepta o cálculo da fórmula (POST /prescriptions/:id/formulas/:formulaId/calculate)
   */
  interceptCalculateFormulaApi(prescriptionId = '*', formulaId = '*', customPayload = null) {
    this.interceptRoute({
      method: 'POST',
      urlPattern: rotaApi(`prescriptions/${prescriptionId}/formulas/${formulaId}/calculate`),
      customPayload,
      defaultBody: prescriptionCalculateData,
      fixturePath: '6.receitas/prescriptionCalculate.json',
      alias: 'calculateFormulaApi',
      statusCode: 200
    });
  }

  /**
   * Intercepta a consulta de detalhe da receita (GET /prescriptions/:id)
   * Utiliza RegExp estrita para evitar que curingas abertos capturem sub-rotas (/formulas, /tracking-steps)
   */
  interceptGetPrescriptionApi(prescriptionId = '*', customPayload = null) {
    const urlPattern = prescriptionId === '*'
      ? new RegExp(regexApi('prescriptions/\\d+([?#].*)?$'))
      : rotaApi(`prescriptions/${prescriptionId}`);

    this.interceptRoute({
      method: 'GET',
      urlPattern,
      customPayload,
      defaultBody: prescriptionDetailData,
      fixturePath: '6.receitas/prescriptionDetail.json',
      alias: 'getPrescriptionDetailApi',
      statusCode: 200
    });
  }

  /**
   * Intercepta a lista de receitas da loja (GET /prescriptions/search, backend#723, front#569).
   * Em modo real deixa passar e só registra o alias (serve de espera: cada busca, chip, ordem e rolagem dispara uma chamada).
   */
  interceptPrescriptionsSearchApi(customPayload = null) {
    this.interceptRoute({
      method: 'GET',
      urlPattern: rotaApi('prescriptions/search*'),
      customPayload,
      defaultBody: prescriptionsSearchData,
      // Sem fixturePath de propósito: a fixture é sintética (1 item) e o AUTO_SYNC_MOCKS não pode sobrescrevê-la com a lista real
      alias: 'getPrescriptionsSearchApi',
      statusCode: 200
    });
  }

  /**
   * Responde a lista de receitas com atraso, para o estado de carregamento (skeleton) ficar observável.
   */
  interceptPrescriptionsSearchApiComAtraso(delayMs = 2000, body = prescriptionsSearchData) {
    cy.intercept('GET', rotaApi('prescriptions/search*'), { statusCode: 200, body, delay: delayMs }).as('getPrescriptionsSearchApi');
  }

  /**
   * Responde a lista de receitas com 500 (envelope de erro do backend), para o estado de erro da tela. O front repete a chamada
   * uma vez antes de mostrar o erro (medido em 2026-11-06: 2 chamadas), então o intercept responde 500 a todas até ser substituído.
   */
  interceptPrescriptionsSearchApiErro(statusCode = 500) {
    cy.intercept('GET', rotaApi('prescriptions/search*'), {
      statusCode,
      body: { status: statusCode, error: 'Internal Server Error', message: 'Erro interno.', timestamp: new Date().toISOString() },
    }).as('getPrescriptionsSearchApiErro');
  }

  /**
   * Intercepta as capabilities de prescrição (GET /prescription-capabilities)
   */
  interceptPrescriptionCapabilitiesApi(customPayload = null) {
    this.interceptRoute({
      method: 'GET',
      urlPattern: rotaApi('prescription-capabilities*'),
      customPayload,
      defaultBody: prescriptionCapabilitiesData,
      fixturePath: '6.receitas/prescriptionCapabilities.json',
      alias: 'getPrescriptionCapabilitiesApi',
      statusCode: 200
    });
  }

  /**
   * Capabilities de receita sem a permissão 145 (can_list_recipes: false), para a lista mostrar "Sem acesso à lista de receitas".
   */
  interceptPrescriptionCapabilitiesSemListarReceitas() {
    this.interceptPrescriptionCapabilitiesApi({ capabilities: { ...prescriptionCapabilitiesData.capabilities, can_list_recipes: false } });
  }

  /**
   * Intercepta os passos de rastreamento (GET /prescriptions/:prescriptionId/formulas/:formulaId/tracking-steps)
   */
  interceptGetTrackingStepsApi(prescriptionId = '*', formulaId = '*', customPayload = null) {
    this.interceptRoute({
      method: 'GET',
      urlPattern: rotaApi(`prescriptions/${prescriptionId}/formulas/${formulaId}/tracking-steps`),
      customPayload,
      defaultBody: trackingStepsData,
      fixturePath: '6.receitas/trackingSteps.json',
      alias: 'getTrackingStepsApi',
      statusCode: 200
    });
  }

  /**
   * Intercepta a listagem de processos de manipulação (GET /prescriptions/:prescriptionId/formulas/:formulaId/manipulation-processes)
   */
  interceptGetManipulationProcessesApi(prescriptionId = '*', formulaId = '*', customPayload = null) {
    this.interceptRoute({
      method: 'GET',
      urlPattern: rotaApi(`prescriptions/${prescriptionId}/formulas/${formulaId}/manipulation-processes`),
      customPayload,
      defaultBody: manipulationProcessesData,
      fixturePath: '6.receitas/manipulationProcesses.json',
      alias: 'getManipulationProcessesApi',
      statusCode: 200
    });
  }

  /**
   * Intercepta o registro de processo de manipulação (POST /prescriptions/:prescriptionId/formulas/:formulaId/manipulation-processes)
   */
  interceptCreateManipulationProcessApi(prescriptionId = '*', formulaId = '*', customPayload = null) {
    this.interceptRoute({
      method: 'POST',
      urlPattern: rotaApi(`prescriptions/${prescriptionId}/formulas/${formulaId}/manipulation-processes`),
      customPayload,
      // O 201 traz o item e o aviso não bloqueante (`warning_message`, null sem aviso): o front exige a chave (RegisterManipulationProcessDtoSchema)
      defaultBody: { ...manipulationProcessesData.items[0], warning_message: null },
      // Sem fixturePath: o fixture é o da lista (GET); o Auto-Sync gravaria um item único por cima dela
      alias: 'createManipulationProcessApi',
      statusCode: 201
    });
  }

  /**
   * Intercepta o PATCH da fórmula (PATCH /prescriptions/:prescriptionId/formulas/:formulaId), alias `@updateFormulaApi`. Em API real só observa (front#629:
   * o Gravar manda só os campos alterados, ex.: `{ return_date }`); em mock responde a fórmula sintetizada a partir da criação.
   */
  interceptUpdateFormulaApi(prescriptionId = '*', formulaId = '*', customPayload = null) {
    this.interceptRoute({
      method: 'PATCH',
      urlPattern: rotaApi(`prescriptions/${prescriptionId}/formulas/${formulaId}`),
      customPayload,
      defaultBody: prescriptionFormulaCreateData,
      alias: 'updateFormulaApi',
      statusCode: 200
    });
  }

  /**
   * Intercepta a atualização de processo de manipulação (PATCH /prescriptions/:prescriptionId/formulas/:formulaId/manipulation-processes/:processId)
   */
  interceptUpdateManipulationProcessApi(prescriptionId = '*', formulaId = '*', processId = '*', customPayload = null) {
    this.interceptRoute({
      method: 'PATCH',
      urlPattern: rotaApi(`prescriptions/${prescriptionId}/formulas/${formulaId}/manipulation-processes/${processId}`),
      customPayload,
      defaultBody: { ...manipulationProcessesData.items[0], commissioned: true },
      // Sem fixturePath: o fixture é o da lista (GET); o Auto-Sync gravaria um item único por cima dela
      alias: 'updateManipulationProcessApi',
      statusCode: 200
    });
  }

  /**
   * Intercepta a exclusão de processo de manipulação (DELETE /prescriptions/:prescriptionId/formulas/:formulaId/manipulation-processes/:processId)
   * Respeita o Strategy Pattern via this.interceptRoute (Mock Hermético vs API Real Auto-Sync)
   */
  interceptDeleteManipulationProcessApi(prescriptionId = '*', formulaId = '*', processId = '*', customPayload = null) {
    this.interceptRoute({
      method: 'DELETE',
      urlPattern: rotaApi(`prescriptions/${prescriptionId}/formulas/${formulaId}/manipulation-processes/${processId}`),
      customPayload,
      defaultBody: {},
      alias: 'deleteManipulationProcessApi',
      statusCode: 204
    });
  }

  /**
   * Intercepta a lista de laboratórios/setores (GET /laboratories)
   * Corpo real medido em 2026-10-16: { items: [{ id, name, short_name }], total } — sem paginação, o front resolve o código digitado nessa lista.
   */
  interceptLaboratoriesApi(customPayload = null) {
    this.interceptRoute({
      method: 'GET',
      urlPattern: new RegExp(regexApi('laboratories(\\?.*)?$')),
      customPayload,
      defaultBody: laboratoriesData,
      fixturePath: '6.receitas/laboratories.json',
      alias: 'getLaboratoriesApi',
      statusCode: 200
    });
  }

  /**
   * Intercepta as formas farmacêuticas de um laboratório (GET /laboratories/:labId/pharmaceutical-forms?q=)
   * Comportamento real medido em 2026-10-16: `q` vazio devolve lista vazia; com `q` devolve as formas do laboratório cujo código é igual a `q`
   * ou cujo nome contém `q` (sem acento/caixa). Corpo: { items: [{ id, name, lab_id, stock_id }], total }.
   * @param {object} formasPorLaboratorio mapa labId -> formas (padrão: fixture medida na API real)
   */
  interceptPharmaceuticalFormsApi(formasPorLaboratorio = pharmaceuticalFormsData) {
    const urlPattern = rotaApi('laboratories/*/pharmaceutical-forms*');
    if (!this.isMockEnabled()) {
      cy.intercept('GET', urlPattern, (req) => req.continue()).as('getPharmaceuticalFormsApi');
      return;
    }
    cy.intercept('GET', urlPattern, (req) => {
      const url = new URL(req.url);
      const labId = (url.pathname.match(/laboratories\/(\d+)\/pharmaceutical-forms/) || [])[1];
      const q = (url.searchParams.get('q') || '').trim().toLowerCase();
      const formas = formasPorLaboratorio[labId] || [];
      const items = q ? formas.filter((f) => String(f.id) === q || f.name.toLowerCase().includes(q)) : [];
      req.reply({ statusCode: 200, body: { items, total: items.length } });
    }).as('getPharmaceuticalFormsApi');
  }

  /**
   * Intercepta a busca de unidades de medida (GET /units?page=&per_page=&q=)
   * Corpo real medido em 2026-10-16: { items: [{ unit, description }], pagination }; `q` casa por trecho da sigla.
   */
  interceptUnitsApi(unidades = unitsData) {
    const urlPattern = rotaApi('units*');
    if (!this.isMockEnabled()) {
      cy.intercept('GET', urlPattern, (req) => req.continue()).as('getUnitsApi');
      return;
    }
    cy.intercept('GET', urlPattern, (req) => {
      const q = (new URL(req.url).searchParams.get('q') || '').trim().toLowerCase();
      const items = unidades.items.filter((u) => !q || u.unit.toLowerCase().includes(q));
      req.reply({
        statusCode: 200,
        body: {
          items,
          pagination: { page: 1, per_page: 50, total: items.length, total_pages: items.length ? 1 : 0, has_next: false, has_previous: false }
        }
      });
    }).as('getUnitsApi');
  }

  /**
   * Registra as rotas de apoio do formulário da fórmula (laboratórios, formas farmacêuticas e unidades) em Mock ou passthrough
   */
  interceptFormularioFormulaApis() {
    this.interceptLaboratoriesApi();
    this.interceptPharmaceuticalFormsApi();
    this.interceptUnitsApi();
  }

  /**
   * Busca de produtos da fórmula (GET /products?usage=human&mode=containing&q=).
   * Medido em 2026-10-16 (dev): corpo { items: [produto completo], total }, `q` casa por trecho do nome. A fixture é um recorte real de 4 produtos
   * (ACIDO ACETICO e ACIDO ACETICO GLACIAL sem aviso de estoque na prévia; ACETILUM ACIDULATUM com aviso; ACIDO 5-AMINOSALICILICO sem aviso), com `total` igual ao recorte.
   */
  interceptProductsApi(produtos = productsData) {
    const urlPattern = rotaApi('products*');
    if (!this.isMockEnabled()) {
      cy.intercept('GET', urlPattern, (req) => req.continue()).as('getProductsApi');
      return;
    }
    const semAcento = (t) => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    cy.intercept('GET', urlPattern, (req) => {
      const q = semAcento(new URL(req.url).searchParams.get('q') || '').trim();
      const items = produtos.items.filter((p) => !q || semAcento(p.name).includes(q));
      req.reply({ statusCode: 200, body: { items, total: items.length } });
    }).as('getProductsApi');
  }

  /**
   * Prévia do cálculo da fórmula (POST /prescriptions/formula-calculations): não grava nada; é o que o Calcular da fórmula
   * acrescentada dispara. Corpo medido em 2026-10-16 (dev): { lines, totals, warnings, incompatibilities, system_error }; a fixture guarda a resposta real
   * por id do 1º produto enviado. Só para contextos 100% mockados (o alias @postFormulaCalculations registra o corpo enviado).
   */
  interceptFormulaCalculationsApi(previas = formulaCalculationsPreviewData) {
    cy.intercept('POST', rotaApi('prescriptions/formula-calculations'), (req) => {
      const primeiro = req.body && req.body.products && req.body.products[0];
      const corpo = primeiro ? previas[primeiro.product_id] : null;
      if (!corpo) {
        req.reply({ statusCode: 422, body: { status: 422, error: 'Unprocessable Content', message: 'produto sem prévia na fixture do teste' } });
        return;
      }
      req.reply({ statusCode: 200, body: corpo });
    }).as('postFormulaCalculations');
  }

  /**
   * Barra qualquer escrita (POST, PATCH, PUT, DELETE) nas rotas de receita, também com USE_MOCKS=false: responde 500 sem chegar ao tenant
   * (receita não tem DELETE) e o alias @escritaDeReceita registra toda tentativa, para o teste provar que a tela não enviou nada.
   * Casa pela URL com "prescri" (o front chama `/prescriptions/:id` sem `/stores/<id>/`, medido em 2026-10-19) e só atinge escrita, nunca os GET.
   */
  /**
   * Observa, sem alterar, as escritas da conclusão da receita na API real (front#628): o finalize, o cancelamento da conclusão e o PATCH da receita.
   * Os aliases deixam o teste esperar cada chamada e ler o corpo enviado.
   */
  observarConclusaoDaReceita() {
    cy.intercept('POST', rotaApi('prescriptions/*/finalize'), (req) => req.continue()).as('postFinalizarReceita');
    cy.intercept('POST', rotaApi('prescriptions/*/cancel-finalization'), (req) => req.continue()).as('postCancelarConclusao');
    cy.intercept('PATCH', rotaApi('prescriptions/*'), (req) => req.continue()).as('patchReceitaReal');
  }

  bloquearEscritasDeReceita() {
    cy.intercept({ method: /^(POST|PATCH|PUT|DELETE)$/, url: /\/prescri/ }, { statusCode: 500, body: { message: 'escrita de receita barrada pelo teste' } }).as('escritaDeReceita');
  }

  /**
   * Escritas do Gravar com fórmula acrescentada, todas por stub e com alias para provar o que foi (e o que NÃO foi) enviado:
   * @patchReceita (cabeçalho), @postFormula, @postProdutoDaFormula, @postCalcularFormula e @postReceita (que a tela nunca deve chamar: responde 500).
   * Medido em 2026-10-16 (dev): o Gravar faz PATCH da receita, POST .../formulas { pharmaceutical_form_id, qvd, multiplier } e POST .../formulas/:id/products
   * { product_id, quantity, unit }, sem POST /prescriptions e sem calculate. Sintetizado: a resposta do POST de fórmula é o clone de uma fórmula real do
   * detalhe (fixture 260900018), com id novo, número seguinte, `products: []` e `needs_recalculate: true` (com a fixture `prescriptionFormulaCreate.json` a tela
   * não enviou o POST de produto); o 422 do produto usa o envelope real dos 422 do backend com mensagem sintética.
   * @param {object} opcoes
   * @param {boolean} opcoes.produtoRecusado true = o POST de produto responde 422
   */
  interceptEscritasDaFormulaPendente({ produtoRecusado = false } = {}) {
    const detalhe = this.receitaGravada;
    const modelo = detalhe.formulas[0];
    let proximoId = 990000;
    cy.intercept('PATCH', new RegExp(regexApi('prescriptions/\\d+$')), { statusCode: 200, body: detalhe }).as('patchReceita');
    cy.intercept('POST', new RegExp(regexApi('prescriptions$')), { statusCode: 500, body: { message: 'a tela não pode criar outra receita (POST /prescriptions)' } }).as('postReceita');
    cy.intercept('POST', rotaApi('prescriptions/*/formulas'), (req) => {
      proximoId += 1;
      req.reply({
        statusCode: 201,
        body: {
          ...JSON.parse(JSON.stringify(modelo)),
          id: proximoId,
          formula_number: detalhe.formulas.length + 1,
          pharmaceutical_form_id: req.body.pharmaceutical_form_id,
          qvd: req.body.qvd,
          multiplier: req.body.multiplier,
          products: [],
          calculated: false,
          needs_recalculate: true
        }
      });
    }).as('postFormula');
    cy.intercept('POST', rotaApi('prescriptions/*/formulas/*/products'), (req) => {
      if (produtoRecusado) {
        req.reply({ statusCode: 422, body: { status: 422, error: 'Unprocessable Content', message: 'Quantidade inválida.', timestamp: '2026-10-16T13:00:00Z' } });
        return;
      }
      req.reply({ statusCode: 201, body: { ...prescriptionProductCreateData, id: 880000 + Math.floor(Math.random() * 1000) } });
    }).as('postProdutoDaFormula');
    cy.intercept('POST', rotaApi('prescriptions/*/formulas/*/calculate'), { statusCode: 200, body: prescriptionCalculateData }).as('postCalcularFormula');
  }

  /**
   * Cliente vinculado ao atendimento, no formato real do detalhe (`customer` de GET /attendances/:id, medido em 2026-10-16
   * no atendimento 261000075): o detalhe traz só id, nome, telefone, e-mail e loja — sem CPF, por isso o card do paciente fica sem CPF até gravar.
   */
  get clienteDoAtendimento() {
    return { customer_id: 849146, name: 'PABLO', phone: '556282264220', email: null, store_name: 'LOJA TESTE' };
  }

  /**
   * Receita já gravada (fixture real da 260900018), com paciente diferente do cliente do atendimento.
   */
  get receitaGravada() {
    return JSON.parse(JSON.stringify(prescriptionDetailData));
  }

  /**
   * Lista de orçamentos do atendimento (GET /attendances/:id/budgets).
   * É ela que decide se a Receita aberta pelo atendimento começa como rascunho novo (lista vazia, corpo real medido em 2026-10-16)
   * ou abre direto a receita existente (o `code` do orçamento é o código da receita).
   */
  orcamentosDoAtendimento(receita = null) {
    const vazio = JSON.parse(JSON.stringify(attendanceBudgetsEmptyData));
    if (!receita) return vazio;
    return {
      ...vazio,
      data: [{
        code: receita.id, formula_number: 1, type: 1, status: 0, amount: 0, discount: 0, amount_with_discount: 0,
        selected_for_payment_link: false, financial_id: null, covered_by_approved_link: false, products: [],
        multiple: 1, quantity: 70, pharmaceutical_form: 'CAPSULAS', label_text: ''
      }],
      pagination: { ...vazio.pagination, total: 1, total_pages: 1 }
    };
  }

  /**
   * Registra todo o cenário "abrir a Receita pelo atendimento" em Mock hermético: fila, detalhe com o cliente informado (ou sem cliente),
   * capabilities do item com `can_add_movement` (permissão 599) ligada/desligada, orçamentos do atendimento e, se houver, a receita gravada.
   * @param {object} opcoes
   * @param {object|null} opcoes.cliente cliente vinculado ao atendimento (`null` = atendimento sem cliente cadastrado, `customer_id: null`)
   * @param {boolean} opcoes.podeIncluirMovimento valor de `can_add_movement` (permissão 599)
   * @param {boolean} opcoes.receitaGravada true = o atendimento já tem uma receita gravada vinculada
   */
  interceptReceitaPeloAtendimento({ cliente = null, podeIncluirMovimento = true, receitaGravada = false } = {}) {
    const clienteDoDetalhe = cliente
      ? cliente
      : { customer_id: null, name: '', phone: '5511999998888', email: null, store_name: 'LOJA TESTE' };

    RecursosMocks.interceptResources();
    AtendimentosMocks.interceptUserMeApi();
    AtendimentosMocks.interceptSummaryApi();
    AtendimentosMocks.interceptAttendancesListApi();
    AtendimentosMocks.interceptSearchApi();
    AtendimentosMocks.interceptAttendanceCapabilitiesApi();
    AtendimentosMocks.interceptAttendanceItemCapabilitiesApi('*', {
      capabilities: { ...AtendimentosMocks.mockAttendanceItemCapabilitiesData.capabilities, can_add_movement: podeIncluirMovimento }
    });
    AtendimentosMocks.interceptAttendanceDetailApi('*', { ...AtendimentosMocks.mockAttendanceDetailData, customer: clienteDoDetalhe });
    AtendimentosMocks.interceptMessagesListApi('*');
    AtendimentosMocks.interceptAttendanceMessageTemplatesApi('*');
    AtendimentosMocks.interceptAttendanceEventsApi();
    AtendimentosMocks.interceptAttendantStatusApi();
    AtendimentosMocks.interceptUpdateAttendantStatusApi();
    const receita = receitaGravada ? this.receitaGravada : null;
    AtendimentosMocks.interceptBudgetsApi('*', this.orcamentosDoAtendimento(receita), true);
    if (receita) this.interceptGetPrescriptionApi(String(receita.id), receita);
    this.interceptPrescriptionCapabilitiesApi();
    this.interceptFormularioFormulaApis();
  }

  /**
   * Lista de laboratórios sintética (formato real: { items: [{ id, name, short_name }], total }) com os códigos 12 e 21 e nenhum
   * código 1: serve ao cenário do código parcial, que na massa real não existe (os 6 laboratórios da dev têm códigos de 1 a 6).
   */
  get laboratoriosComCodigosProximos() {
    return {
      items: [
        { id: 12, name: 'LABORATORIO DOZE', short_name: 'DOZE' },
        { id: 21, name: 'LABORATORIO VINTE E UM', short_name: 'VINTE E UM' }
      ],
      total: 2
    };
  }

  /**
   * Registra, só para espionar, qualquer escrita (POST/PATCH/PUT/DELETE) em /prescriptions: o alias `@escritaDeReceita` permite provar
   * que nada foi enviado. A resposta é um 500 de bloqueio, então a escrita nunca chega ao tenant nem em API real.
   */
  interceptEscritasDeReceita() {
    cy.intercept(
      { method: /^(POST|PATCH|PUT|DELETE)$/, url: rotaApi('prescriptions*') },
      { statusCode: 500, body: { message: 'escrita bloqueada pelo teste' } }
    ).as('escritaDeReceita');
  }

  /**
   * Intercepta e ignora telemetria RUM Cloudflare
   */
  interceptRumTelemetry() {
    cy.intercept('POST', '**/cdn-cgi/rum*', { statusCode: 204, body: {} }).as('rumTelemetry');
  }

  /**
   * Configura todos os mocks do fluxo de criação e cálculo de receita/orçamento
   */
  setupFullBudgetMocks(prescriptionId = '260900018', formulaId = '246784') {
    this.interceptRumTelemetry();
    this.interceptPrescriptionCapabilitiesApi();
    this.interceptCreatePrescriptionApi();
    this.interceptCreateFormulaApi(prescriptionId);
    this.interceptAddProductFormulaApi(prescriptionId, formulaId);
    this.interceptCalculateFormulaApi(prescriptionId, formulaId);
    this.interceptGetPrescriptionApi(prescriptionId);
    this.interceptGetTrackingStepsApi(prescriptionId, formulaId);
    this.interceptGetManipulationProcessesApi(prescriptionId, formulaId);
    this.interceptCreateManipulationProcessApi(prescriptionId, formulaId);
    this.interceptUpdateManipulationProcessApi(prescriptionId, formulaId);
    this.interceptDeleteManipulationProcessApi(prescriptionId, formulaId);
  }

  /**
   * Libera as rotas para execução na API real (End-to-End)
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

    cy.intercept('POST', '**/cdn-cgi/rum*', { statusCode: 204, body: {} }).as('rumTelemetry');
    cy.intercept('GET', rotaApi('prescription-capabilities*'), continueWithSync('6.receitas/prescriptionCapabilities.json')).as('getPrescriptionCapabilitiesApi');
    cy.intercept('POST', rotaApi('prescriptions'), continueWithSync('6.receitas/prescriptionCreate.json')).as('createPrescriptionApi');
    cy.intercept('POST', rotaApi('prescriptions/*/formulas'), continueWithSync('6.receitas/prescriptionFormulaCreate.json')).as('createFormulaApi');
    cy.intercept('POST', rotaApi('prescriptions/*/formulas/*/products'), continueWithSync('6.receitas/prescriptionProductCreate.json')).as('addProductFormulaApi');
    cy.intercept('POST', rotaApi('prescriptions/*/formulas/*/calculate'), continueWithSync('6.receitas/prescriptionCalculate.json')).as('calculateFormulaApi');
    cy.intercept('GET', new RegExp(regexApi('prescriptions/\\d+([?#].*)?$')), continueWithSync('6.receitas/prescriptionDetail.json')).as('getPrescriptionDetailApi');
    cy.intercept('GET', rotaApi('prescriptions/*/formulas/*/tracking-steps'), continueWithSync('6.receitas/trackingSteps.json')).as('getTrackingStepsApi');
    cy.intercept('GET', rotaApi('prescriptions/*/formulas/*/manipulation-processes'), continueWithSync('6.receitas/manipulationProcesses.json')).as('getManipulationProcessesApi');
    // POST e PATCH de processo só passam: a resposta é um item, e o fixture manipulationProcesses.json é o da lista (GET)
    cy.intercept('POST', rotaApi('prescriptions/*/formulas/*/manipulation-processes'), (req) => req.continue()).as('createManipulationProcessApi');
    cy.intercept('PATCH', rotaApi('prescriptions/*/formulas/*/manipulation-processes/*'), (req) => req.continue()).as('updateManipulationProcessApi');
    cy.intercept('DELETE', rotaApi('prescriptions/*/formulas/*/manipulation-processes/*'), (req) => req.continue()).as('deleteManipulationProcessApi');
  }
}

export default new ReceitasMocks();
