// cypress/mocks/7.clientesMocks.js
// Mocks para o módulo de Clientes (/clientes): capabilities, grupos, cadastro e ficha

import BaseMock from './BaseMock';
import { regexApi, rotaApi } from '../support/rotaApi';

class ClientesMocks extends BaseMock {
  /**
   * Payload-base de sucesso na criação de cliente (POST /clients). Getter: cada
   * acesso devolve um objeto novo (AGENTS.md [R-MOCK] "Payload-base... getter, nunca campo fixo").
   */
  get mockCreateClientSuccessData() {
    return {
      id: 999001,
      name: 'Cliente Teste E2E',
      person_type: 1,
      document: null,
      active: true,
      // Obrigatório no schema de resposta do front (W, editClientDrawer.catalog): "capabilities" não
      // é nullish/opcional ao contrário dos demais campos - a ausência derruba a validação zod e
      // exibe "Resposta do serviço inválida" mesmo com status 201 (achado 2026-09-28).
      capabilities: {
        can_update_client: true,
        can_change_client_name: true,
        can_change_label_name: true,
        can_deactivate_client: true,
        can_change_debt_status: true,
        can_change_discount_type: true,
        can_change_discount_percentage: true,
        can_change_free_delivery: true,
        can_change_weighing_notes: true
      },
      created_at: new Date().toISOString()
    };
  }

  /**
   * Payload mínimo e seguro da ficha do cliente (GET /clients/:id) — usado só para
   * a tela de detalhe não quebrar após o redirecionamento pós-cadastro. Campos obrigatórios
   * medidos na PR #427/#432/#438 (drawer "Dados do cliente"): notes objeto, gender, audit,
   * phones[].phone_type, addresses[].city.state — PROJECT_CONTEXT.md §8 "/clients".
   */
  get mockClientDetailMinimalData() {
    return {
      id: 999001,
      name: 'Cliente Teste E2E',
      person_type: 1,
      document: null,
      label_name: null,
      active: true,
      gender: null,
      group: null,
      notes: { client: '', weighing: '', attendance: '' },
      audit: {},
      phones: [],
      addresses: [],
      // Chaves do schema embutido "capabilities" da ficha (Ae, editClientDrawer.catalog) — 9
      // flags de UI da tela de edição, distintas das 18 de GET /client-capabilities acima.
      capabilities: {
        can_update_client: true,
        can_change_client_name: true,
        can_change_label_name: true,
        can_deactivate_client: true,
        can_change_debt_status: true,
        can_change_discount_type: true,
        can_change_discount_percentage: true,
        can_change_free_delivery: true,
        can_change_weighing_notes: true
      }
    };
  }

  /**
   * Ficha completa e realista de um cliente existente (GET /clients/:id), usada
   * nos testes de edição — 1 telefone e 1 endereço já cadastrados (ids sintéticos 810001/928076).
   * Getter: cada acesso devolve um objeto novo.
   */
  get mockClientDetailEditData() {
    return {
      id: 700001,
      name: 'Cliente Ficha Teste E2E',
      label_name: null,
      person_type: 1,
      document: '01992573298',
      identity_document: '6656558',
      issuing_body: 'SSP',
      birth_date: '1990-09-01',
      email: 'cliente.ficha.e2e@example.com',
      group: { id: 800014, name: 'Academia Prime Gym' },
      active: true,
      in_debt: false,
      tax: { non_taxpayer: false, final_consumer: true, withhold_iss: false },
      discount: { type: null, percentage: null },
      classification: { movement: null, post_sale: null, price_table_id: null },
      delivery: { free_delivery: false },
      notes: { client: '', weighing: '', attendance: '' },
      animals: [],
      phones: [
        { id: 810001, prefix: '62', number: '999998888', whatsapp: true, primary: true }
      ],
      addresses: [
        {
          id: 928076,
          primary: true,
          invoice: false,
          zip_code: '74610030',
          street: 'Rua Teste E2E',
          number: '100',
          complement: null,
          description: 'Casa',
          neighborhood: { id: 106, name: 'Setor Leste' },
          city: { id: 33, name: 'Goiania', state: 'GO' }
        }
      ],
      capabilities: {
        can_update_client: true,
        can_change_client_name: true,
        can_change_label_name: true,
        can_deactivate_client: true,
        can_change_debt_status: true,
        can_change_discount_type: true,
        can_change_discount_percentage: true,
        can_change_free_delivery: true,
        can_change_weighing_notes: true
      }
    };
  }

  /**
   * Perfil de capabilities com a dispensa de gênero também concedida (as demais 4 dispensas já
   * são concedidas no perfil padrão) — usado nos testes de cadastro feliz/conflito, que só
   * preenchem nome (e opcionalmente documento), nunca gênero.
   */
  get mockClientCapabilitiesAllWaivedData() {
    const base = this._clientCapabilitiesDefaultBody();
    base.capabilities.can_create_client_without_gender = true;
    return base;
  }

  /**
   * Corpo padrão de GET /client-capabilities: 18 capabilities + 5 dispensas de obrigatoriedade
   * (contrato medido na API real em 0-A.backend-acesso-cadastros-orcamentos.cy.js, contexto 9). Por padrão a
   * dispensa de gênero fica `false` (obrigatório para pessoa física) para poder validar a regra
   * condicional PF/PJ do campo de gênero na modal "Novo Cliente".
   * @private
   */
  _clientCapabilitiesDefaultBody() {
    return {
      capabilities: {
        can_create_client: true,
        can_update_client: true,
        can_deactivate_client: true,
        can_change_client_name: true,
        can_change_label_name: true,
        can_use_distinct_label_name: true,
        can_change_debt_status: true,
        can_change_discount_type: true,
        can_change_discount_percentage: true,
        can_change_free_delivery: true,
        can_change_weighing_notes: true,
        can_change_wildcard_client: true,
        can_create_client_without_address: true,
        can_create_client_without_document: true,
        can_create_client_without_phone: true,
        can_create_client_from_other_state_without_document: true,
        can_create_client_without_gender: false,
        can_view_hidden_lgpd_data: false
      }
    };
  }

  /**
   * Intercepta as 18 capabilities + 5 dispensas de obrigatoriedade do módulo de clientes
   * (GET /client-capabilities - PR #418/#438).
   */
  interceptClientCapabilitiesApi(customPayload = null) {
    this.interceptRoute({
      method: 'GET',
      urlPattern: rotaApi('client-capabilities*'),
      customPayload,
      defaultBody: this._clientCapabilitiesDefaultBody(),
      alias: 'getClientCapabilities'
    });
  }

  /**
   * Intercepta a busca de grupos de clientes (GET /client-groups), disparada
   * sempre que a modal "Novo Cliente" abre (typeahead "Buscar grupo") — independente de o teste
   * interagir com o campo ou não.
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
   * Intercepta a criação de cliente (POST /clients). RegExp estrita para não
   * colidir com sub-rotas de escrita (/phones, /addresses, /deactivation) — AGENTS.md [R-MOCK]
   * "Rota de detalhe com RegExp estrita".
   * @param {object|null} customPayload Corpo customizado (ex.: 409 CLIENT_ALREADY_EXISTS)
   * @param {number} statusCode Status HTTP da resposta (default 201)
   */
  interceptCreateClientApi(customPayload = null, statusCode = 201) {
    this.interceptRoute({
      method: 'POST',
      urlPattern: new RegExp(regexApi('clients([?#].*)?$')),
      customPayload,
      defaultBody: this.mockCreateClientSuccessData,
      statusCode,
      alias: 'postCreateClient'
    });
  }

  /**
   * Intercepta a listagem/busca de clientes (GET /clients?type&q&page&per_page —
   * ClientsPage). Mesma base de rota da criação/ficha, mas sem `:id` — RegExp estrita evita
   * colidir com `GET /clients/:id`.
   * @param {object|null} customPayload Corpo customizado opcional (default: 1 item)
   */
  interceptClientsListApi(customPayload = null) {
    this.interceptRoute({
      method: 'GET',
      urlPattern: new RegExp(regexApi('clients(\\?.*)?$')),
      customPayload,
      defaultBody: {
        items: [{
          type: 'human',
          id: 700001,
          name: 'Cliente Ficha Teste E2E',
          document: '01992573298',
          guardian_name: '',
          guardian_id: null,
          phone: { prefix: '62', number: '999998888', whatsapp: true },
          prescription_count: 0,
          last_prescription_at: null,
          active: true
        }],
        // Schema de paginação (iA, index-*.js) exige snake_case cru - o mapeamento pro envelope
        // final (hasNext/hasPrevious) é feito depois da validação zod, no front. Sem `total`/
        // `total_pages` (Issue backend#586/#588, front#510, 2026-10-06 - saíram do contrato real).
        // guardian_id medido na API real em 2026-09-28 (GET .../clients?type=animal): presente
        // no payload atual - resolve a OQ2 do épico #290 (documentada como bloqueio de CLI-05).
        pagination: { page: 1, per_page: 30, has_next: false, has_previous: false }
      },
      alias: 'getClientsList'
    });
  }

  /**
   * Item-base de uma linha da listagem de clientes, reaproveitável pelos testes de rolagem
   * infinita (Issue backend#586/#588, front#510).
   * @param {object} overrides Campos a sobrepor
   */
  itemListagem(overrides = {}) {
    return {
      type: 'human',
      id: 700010,
      name: 'Cliente Lista E2E',
      document: null,
      guardian_name: '',
      guardian_id: null,
      phone: null,
      prescription_count: 0,
      last_prescription_at: null,
      active: true,
      ...overrides
    };
  }

  /**
   * Gera uma página sintética de N itens para a listagem (rolagem infinita), com ids previsíveis
   * (`numeroPagina * 1000 + índice`) para montar cenários de deduplicação/paginação.
   * @param {number} numeroPagina Número da página (1-based, eco'ado em `pagination.page`)
   * @param {number} quantidade Itens nesta página (default 30, igual ao `per_page` real)
   * @param {boolean} temProxima Valor de `pagination.has_next`
   * @param {object[]} itensExtras Itens adicionais a prefixar na página (ex.: repetir um id de outra página, para testar deduplicação)
   */
  paginaListagem(numeroPagina, quantidade = 30, temProxima = true, itensExtras = []) {
    const itens = Array.from({ length: quantidade }, (_, i) =>
      this.itemListagem({ id: numeroPagina * 1000 + i, name: `Cliente P${numeroPagina} ${i}` })
    );
    return {
      items: [...itensExtras, ...itens],
      pagination: { page: numeroPagina, per_page: 30, has_next: temProxima, has_previous: numeroPagina > 1 }
    };
  }

  /**
   * Intercepta a listagem de clientes com uma página sintética por número de página (rolagem
   * infinita, Issue backend#586/#588 e front#510) — bypassa `interceptRoute`/`BaseMock` por
   * precisar ramificar a resposta pelo `page` da query string, mesmo padrão ad-hoc já usado em
   * `7.clientes.cy.js` #4.6 (corrida de busca) e documentado em `AGENTS.md` [R-MOCK].
   * @param {Object<number, object|'erro'>} paginasPorNumero Mapa `{ [page]: corpoDaResposta }`;
   *   o valor `'erro'` responde 500 genérico (simula falha ao carregar aquela página); página sem
   *   entrada no mapa devolve uma página vazia com `has_next: false` (fecha a lista).
   */
  interceptClientsListPaginadoApi(paginasPorNumero) {
    cy.intercept('GET', new RegExp(regexApi('clients(\\?.*)?$')), (req) => {
      const numeroPagina = Number(req.query.page || 1);
      const resposta = paginasPorNumero[numeroPagina];
      if (resposta === 'erro') {
        req.reply({
          statusCode: 500,
          body: { status: 500, error: 'Internal Server Error', message: 'Falha simulada pelo teste' }
        });
      } else if (resposta) {
        req.reply({ body: resposta });
      } else {
        req.reply({ body: this.paginaListagem(numeroPagina, 0, false) });
      }
    }).as('getClientsList');
  }

  /**
   * Intercepta a ficha completa do cliente (GET /clients/:id). RegExp estrita
   * pelo mesmo motivo do método acima.
   * @param {string|number} clientId ID do cliente ('*' para qualquer um)
   * @param {object|null} customPayload Corpo customizado opcional
   */
  interceptClientDetailApi(clientId = '*', customPayload = null) {
    const idPattern = clientId === '*' ? '\\d+' : String(clientId);
    this.interceptRoute({
      method: 'GET',
      urlPattern: new RegExp(regexApi(`clients/${idPattern}([?#].*)?$`)),
      customPayload,
      defaultBody: this.mockClientDetailMinimalData,
      alias: 'getClientDetail'
    });
  }

  /**
   * Intercepta a atualização de dados cadastrais do cliente (PATCH /clients/:id —
   * dirty patch, só os campos alterados). Mesma RegExp estrita do detalhe/criação.
   * @param {string|number} clientId ID do cliente ('*' para qualquer um)
   * @param {object|null} customPayload Corpo customizado opcional
   */
  interceptUpdateClientApi(clientId = '*', customPayload = null) {
    const idPattern = clientId === '*' ? '\\d+' : String(clientId);
    this.interceptRoute({
      method: 'PATCH',
      urlPattern: new RegExp(regexApi(`clients/${idPattern}([?#].*)?$`)),
      customPayload,
      defaultBody: this.mockClientDetailEditData,
      alias: 'patchClient'
    });
  }

  /**
   * Intercepta as classes de movimentação (GET /client-movement-classes),
   * consultadas assim que a ficha do cliente carrega.
   */
  interceptClientMovementClassesApi(customPayload = null) {
    this.interceptRoute({
      method: 'GET',
      urlPattern: rotaApi('client-movement-classes*'),
      customPayload,
      defaultBody: { items: [{ id: 1, name: 'Padrão' }] },
      alias: 'getClientMovementClasses'
    });
  }

  /**
   * Intercepta as classes de pós-venda (GET /client-post-sale-classes),
   * consultadas assim que a ficha do cliente carrega.
   */
  interceptClientPostSaleClassesApi(customPayload = null) {
    this.interceptRoute({
      method: 'GET',
      urlPattern: rotaApi('client-post-sale-classes*'),
      customPayload,
      defaultBody: { items: [{ id: 1, name: 'Padrão' }] },
      alias: 'getClientPostSaleClasses'
    });
  }

  /**
   * Intercepta a busca de cidades (GET /cities?q=...) do formulário de endereço.
   */
  interceptClientCitiesApi(customPayload = null) {
    this.interceptRoute({
      method: 'GET',
      urlPattern: rotaApi('cities*'),
      customPayload,
      defaultBody: { items: [{ id: 33, name: 'Goiania', state: 'GO' }], total: 1 },
      alias: 'getClientCities'
    });
  }

  /**
   * Intercepta a busca de bairros (GET /neighborhoods?city_id=...) do formulário
   * de endereço — sempre exige city_id no querystring (AGENTS.md CA-12).
   */
  interceptClientNeighborhoodsApi(customPayload = null) {
    this.interceptRoute({
      method: 'GET',
      urlPattern: rotaApi('neighborhoods*'),
      customPayload,
      defaultBody: { items: [{ id: 106, name: 'Setor Leste' }], total: 1 },
      alias: 'getClientNeighborhoods'
    });
  }

  /**
   * Respostas medidas na API real em 2026-10-22 (GET /zip-codes?zip_code=<8 dígitos>, backend#751; dev). O 99999999 é a cidade fora do catálogo
   * (`city.id` e `neighborhood.id` nulos, cidade "Sarandi/PR"); o 00000000 é o CEP inexistente (404). O 503 não dá para provocar na dev: o corpo é sintético.
   */
  zipCodesMedidos = {
    '01001000': { zip_code: '01001000', street: 'Praça da Sé', complement: 'lado ímpar', neighborhood: { id: 7670, name: 'SE' }, city: { id: 230, name: 'SAO PAULO', state: 'SP' } },
    '20040002': { zip_code: '20040002', street: 'Avenida Rio Branco', complement: 'de 128 a 144 - lado par', neighborhood: { id: 4840, name: 'CENTRO' }, city: { id: 283, name: 'RIO DE JANEIRO', state: 'RJ' } },
    '74610030': { zip_code: '74610030', street: 'Avenida Décima Primeira Avenida', complement: 'de 1001/1002 ao fim', neighborhood: { id: null, name: 'Setor Leste Universitário' }, city: { id: null, name: 'Goiânia', state: 'GO' } },
    '99999999': { zip_code: '99999999', street: 'Avenida das Torres', complement: null, neighborhood: { id: null, name: 'Jardim Centro Cívico' }, city: { id: null, name: 'Sarandi', state: 'PR' } },
  };

  zipCodeNaoEncontrado = { status: 404, error: 'Not Found', message: 'CEP não encontrado.' };

  zipCodeIndisponivel = { status: 503, error: 'Service Unavailable', message: 'Consulta de CEP indisponível no momento.' };

  /**
   * Intercepta a consulta de CEP (GET /zip-codes?zip_code=...). Em modo real deixa passar e só registra o alias (@getZipCodesApi).
   * Em modo mock responde com as respostas medidas (CEP desconhecido → 404). Opções: `atrasoMs` (demora a responder, para o estado "Buscando endereço…"),
   * `falhasAntes` (as N primeiras consultas respondem 503 e as seguintes o normal, para a lupa tentar de novo).
   */
  interceptZipCodesApi({ atrasoMs = 0, falhasAntes = 0 } = {}) {
    const urlPattern = rotaApi('zip-codes*');
    if (!this.isMockEnabled()) {
      cy.intercept('GET', urlPattern, (req) => req.continue()).as('getZipCodesApi');
      return;
    }
    let consultas = 0;
    cy.intercept('GET', urlPattern, (req) => {
      consultas += 1;
      if (consultas <= falhasAntes) {
        req.reply({ statusCode: 503, body: this.zipCodeIndisponivel, delay: atrasoMs });
        return;
      }
      const cep = new URL(req.url).searchParams.get('zip_code');
      const corpo = this.zipCodesMedidos[cep];
      req.reply({ statusCode: corpo ? 200 : 404, body: corpo || this.zipCodeNaoEncontrado, delay: atrasoMs });
    }).as('getZipCodesApi');
  }

  /**
   * Capabilities de cliente com o endereço obrigatório no cadastro novo (can_create_client_without_address: false): só assim a modal "Novo cliente" mostra a seção de endereço.
   */
  interceptClientCapabilitiesComEnderecoObrigatorio() {
    const corpo = this._clientCapabilitiesDefaultBody();
    corpo.capabilities.can_create_client_without_address = false;
    this.interceptClientCapabilitiesApi(corpo);
  }

  /**
   * Intercepta a criação de telefone (POST /clients/:id/phones — botão "+" do
   * card de telefones). Resposta é a LISTA completa atualizada (schema `{items, total}`), não só
   * o registro criado — o front pega o novo id pelo telefone primário/último da lista.
   */
  interceptCreatePhoneApi(clientId = '*', customPayload = null, statusCode = 201) {
    const idPattern = clientId === '*' ? '\\d+' : String(clientId);
    this.interceptRoute({
      method: 'POST',
      urlPattern: new RegExp(regexApi(`clients/${idPattern}/phones([?#].*)?$`)),
      customPayload,
      defaultBody: {
        items: [{ id: 810002, prefix: '54', number: '6454654655', whatsapp: false, primary: false }],
        total: 1
      },
      statusCode,
      alias: 'postCreatePhone'
    });
  }

  /**
   * Intercepta a remoção de telefone (DELETE .../clients/:id/phones/:phoneId).
   */
  interceptDeletePhoneApi(clientId = '*', customPayload = null, statusCode = 200) {
    const idPattern = clientId === '*' ? '\\d+' : String(clientId);
    this.interceptRoute({
      method: 'DELETE',
      urlPattern: new RegExp(regexApi(`clients/${idPattern}/phones/\\d+([?#].*)?$`)),
      customPayload,
      defaultBody: {},
      statusCode,
      alias: 'deleteClientPhone'
    });
  }

  /**
   * Intercepta a criação de endereço (POST .../clients/:id/addresses — folder inline "Adicionar
   * endereço" + botão grande "Salvar dados"). Resposta também é a lista completa (`{items, total}`).
   */
  interceptCreateAddressApi(clientId = '*', customPayload = null, statusCode = 201) {
    const idPattern = clientId === '*' ? '\\d+' : String(clientId);
    this.interceptRoute({
      method: 'POST',
      urlPattern: new RegExp(regexApi(`clients/${idPattern}/addresses([?#].*)?$`)),
      customPayload,
      defaultBody: {
        items: [{
          id: 928077,
          primary: false,
          invoice: false,
          zip_code: null,
          street: 'Decima Primeira Avenida',
          number: '297',
          complement: 'APT 106',
          description: null,
          neighborhood: { id: 106, name: 'Setor Leste' },
          city: { id: 33, name: 'Goiania', state: 'GO' }
        }],
        total: 1
      },
      statusCode,
      alias: 'postCreateAddress'
    });
  }

  /**
   * Intercepta a edição de endereço (PATCH .../clients/:id/addresses/:addressId), respondendo a lista atualizada com o endereço editado.
   */
  interceptUpdateAddressApi(clientId = '*', customPayload = null, statusCode = 200) {
    const idPattern = clientId === '*' ? '\\d+' : clientId;
    this.interceptRoute({
      method: 'PATCH',
      urlPattern: new RegExp(regexApi(`clients/${idPattern}/addresses/\\d+([?#].*)?$`)),
      customPayload,
      defaultBody: { items: this.mockClientDetailEditData.addresses, total: this.mockClientDetailEditData.addresses.length },
      alias: 'patchClientAddress',
      statusCode
    });
  }

  /**
   * Intercepta a remoção de endereço (DELETE .../clients/:id/addresses/:addressId).
   */
  interceptDeleteAddressApi(clientId = '*', customPayload = null, statusCode = 200) {
    const idPattern = clientId === '*' ? '\\d+' : String(clientId);
    this.interceptRoute({
      method: 'DELETE',
      urlPattern: new RegExp(regexApi(`clients/${idPattern}/addresses/\\d+([?#].*)?$`)),
      customPayload,
      defaultBody: {},
      statusCode,
      alias: 'deleteClientAddress'
    });
  }

  /**
   * Intercepta a (des)ativação idempotente do cliente (POST .../clients/:id/deactivation —
   * contrato `{ active }` medido em backendApiService.js `alterarStatusAtivacaoCliente`).
   * @param {string|number} clientId ID do cliente ('*' para qualquer um)
   * @param {object|null} customPayload Corpo customizado opcional
   */
  interceptDeactivateClientApi(clientId = '*', customPayload = null, statusCode = 200) {
    const idPattern = clientId === '*' ? '\\d+' : String(clientId);
    this.interceptRoute({
      method: 'POST',
      urlPattern: new RegExp(regexApi(`clients/${idPattern}/deactivation([?#].*)?$`)),
      customPayload,
      defaultBody: { active: false },
      statusCode,
      alias: 'postDeactivateClient'
    });
  }
}

export default new ClientesMocks();
