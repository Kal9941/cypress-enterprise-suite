// cypress/services/backendApiService.js
// Classe de serviço dedicada a testes de Backend e Integração na API Real.
// Executa requisições via cy.request() no processo Node.js do Cypress,
// sendo totalmente desacoplada de interfaces gráficas e imune a mocks (USE_MOCKS).

const configEnv = require('../../env.json');

class BackendApiService {
  constructor() {
    this.apiUrl = configEnv.API_URL || 'https://api.omnicare.dev.local';
    this.token = null;
  }

  /**
   * Realiza login direto no backend para obtenção do Bearer Token JWT.
   * Não interage com o navegador nem aciona cy.visit().
   */
  autenticar(
    cnpj = configEnv.USER_CNPJ,
    usuario = configEnv.USER_CODE,
    senha = configEnv.USER_PASSWORD
  ) {
    return cy.request({
      method: 'POST',
      url: `${this.apiUrl}/auth/login`,
      body: {
        cnpj: cnpj,
        username: usuario,
        password: senha,
      },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status, 'Status de autenticação direta no backend').to.eq(200);
      this.token = response.body.token || response.body.access_token;
      Cypress.env('backendAuthToken', this.token);
      return this.token;
    });
  }

  /**
   * Retorna os headers padronizados com o Bearer Token.
   * Permite que headersCustomizados sobrescrevam ou excluam cabeçalhos padrão.
   */
  getHeaders(headersCustomizados = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const merged = { ...headers, ...headersCustomizados };

    // Se Authorization for explicitamente string vazia ou nulo, remove para teste de RBAC sem token
    if (merged['Authorization'] === '' || merged['Authorization'] === null) {
      delete merged['Authorization'];
    }

    return merged;
  }

  /**
   * Retorna intervalo de datas padrão (últimos 30 dias até hoje em formato YYYY-MM-DD)
   * exigido obrigatoriamente pelas rotas de atendimentos do backend.
   */
  obterIntervaloDatasPadrao() {
    const formatar = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    const agora = new Date();
    const dataInicial = new Date(agora.getTime() - (30 * 24 * 60 * 60 * 1000));

    return {
      start_date: formatar(dataInicial),
      end_date: formatar(agora),
    };
  }

  /**
   * Executa requisição genérica na API com tratamento de falhas flexível.
   */
  request(options = {}) {
    const urlCompleta = options.url?.startsWith('http')
      ? options.url
      : `${this.apiUrl}${options.url?.startsWith('/') ? '' : '/'}${options.url || ''}`;

    return cy.request({
      failOnStatusCode: false,
      ...options,
      url: urlCompleta,
      headers: this.getHeaders(options.headers),
    });
  }

  /**
   * Requisição GET auxiliar.
   */
  get(endpoint, qs = {}, options = {}) {
    return this.request({
      method: 'GET',
      url: endpoint,
      qs: qs,
      ...options,
    });
  }

  /**
   * Requisição POST auxiliar.
   */
  post(endpoint, body = {}, options = {}) {
    return this.request({
      method: 'POST',
      url: endpoint,
      body: body,
      ...options,
    });
  }

  /**
   * Requisição PUT auxiliar.
   */
  put(endpoint, body = {}, options = {}) {
    return this.request({
      method: 'PUT',
      url: endpoint,
      body: body,
      ...options,
    });
  }

  /**
   * Requisição PATCH auxiliar.
   */
  patch(endpoint, body = {}, options = {}) {
    return this.request({
      method: 'PATCH',
      url: endpoint,
      body: body,
      ...options,
    });
  }

  /**
   * Requisição DELETE auxiliar.
   */
  delete(endpoint, options = {}) {
    return this.request({
      method: 'DELETE',
      url: endpoint,
      ...options,
    });
  }

  /**
   * Envia o corpo como texto JSON literal (POST, PATCH ou PUT), sem passar por JSON.stringify.
   * Necessário para números que o JavaScript não preserva, como `1e-999999999` (vira 0 em `Number`) — Issue backend#650.
   */
  requestJsonBruto(method, endpoint, textoJson, options = {}) {
    return this.request({
      method,
      url: endpoint,
      body: textoJson,
      ...options,
    });
  }

  // =========================================================================
  // MÉTODOS DE NEGÓCIO E ROTAS MAPEADAS DA API OmniCare
  // =========================================================================

  /**
   * Obtém os dados e perfil do operador logado (/users/me)
   */
  obterUsuarioLogado(options = {}) {
    return this.get('/users/me', {}, options);
  }

  /**
   * Consulta os módulos/recursos habilitados para a loja (/resources)
   */
  obterRecursosLoja(storeId, options = {}) {
    return this.get(`/resources`, {}, options);
  }

  /**
   * Consulta as métricas de resumo dos atendimentos (/attendances/summary)
   * Injeta dinamicamente start_date e end_date caso não informados.
   */
  obterResumoAtendimentos(storeId, qs = {}, options = {}) {
    const queryParams = { ...this.obterIntervaloDatasPadrao(), ...qs };
    return this.get(`/attendances/summary`, queryParams, options);
  }

  /**
   * Consulta a matriz de permissões/capabilities da loja (/attendance-capabilities)
   */
  obterCapabilitiesLoja(storeId, options = {}) {
    return this.get(`/attendance-capabilities`, {}, options);
  }

  /**
   * Consulta as configurações de pagamento cadastradas (/payment-configs)
   */
  obterConfiguracoesPagamento(storeId, options = {}) {
    return this.get(`/payment-configs`, {}, options);
  }

  /**
   * Lista os canais de atendimento vinculados à loja (/channels)
   */
  listarCanais(storeId, options = {}) {
    return this.get(`/channels`, {}, options);
  }

  /**
   * Lista os canais do seletor Canal do filtro da fila (GET /attendances/channels, backend#685/#687, cypress#47).
   * Traz todos os canais de OC_CANAL (inclusive Pedido Pago, channel_subtype 2, e inativos), ordenados por nome, com o item de /channels.
   * Exige só o acesso ao módulo de atendimento (418); /channels (Iniciar atendimento) continua exigindo 636.
   */
  listarCanaisFiltroFila(storeId, options = {}) {
    return this.get(`/attendances/channels`, {}, options);
  }

  /**
   * Lista os grupos de atendimento de canais (/channel-groups)
   * Exige obrigatoriamente channel_id para evitar erro 500 no backend.
   */
  listarGruposCanal(storeId, channelId = 6, options = {}) {
    const qs = { channel_id: channelId };
    return this.get(`/channel-groups`, qs, options);
  }

  /**
   * Lista os grupos de atendimento com filtros livres (/channel-groups).
   * `channel_id`, `employee_id` e `linked_to_channel` são opcionais e combináveis (Issue backend#686/PR #720);
   * sem nenhum, devolve todos os grupos da loja, inclusive os sem vínculo a canal.
   */
  listarGruposComFiltros(storeId, qs = {}, options = {}) {
    return this.get(`/channel-groups`, qs, options);
  }

  /**
   * Lista os funcionários ativos do tenant/loja (/employees)
   * Utilizado pelo modal de Filtros (PR #339) para busca sem grant e sem gate de recurso.
   */
  listarFuncionarios(storeId, params = {}, options = {}) {
    return this.get(`/employees`, params, options);
  }

  /**
   * Lista as mensagens rápidas / padrão (/standard-messages)
   */
  listarMensagensPadrao(storeId, options = {}) {
    return this.get(`/standard-messages`, {}, options);
  }

  /**
   * Consulta as permissões de mensagens padrão (/standard-message-capabilities)
   */
  obterCapabilitiesMensagensPadrao(storeId, options = {}) {
    return this.get(`/standard-message-capabilities`, {}, options);
  }

  /**
   * Lista os templates de mensagem WABA da loja (/waba-message-templates)
   * Suporta channel_id e customer_id para interpolação de variáveis e projeção de rendered_body (PR #483 / #484).
   * @param {number|string} storeId ID da loja
   * @param {object} qs Query parameters (channel_id, customer_id)
   * @param {object} options Opções adicionais de requisição
   */
  listarTemplatesWaba(storeId, qs = {}, options = {}) {
    return this.get(`/waba-message-templates`, qs, options);
  }

  /**
   * Lista os templates de mensagem associados a um atendimento (/attendances/:attendanceId/message-templates)
   * Retorna templates enriquecidos com rendered_body interpolado com o cliente do atendimento (PR #483 / #484).
   * @param {number|string} storeId ID da loja
   * @param {number|string} attendanceId ID do atendimento
   * @param {object} qs Query parameters opcionais
   * @param {object} options Opções adicionais de requisição
   */
  listarTemplatesAtendimento(storeId, attendanceId, qs = {}, options = {}) {
    return this.get(`/attendances/${attendanceId}/message-templates`, qs, options);
  }

  /**
   * Lista a fila de atendimentos da loja com paginação e filtros (/attendances)
   * Injeta dinamicamente start_date e end_date caso não informados.
   */
  listarAtendimentos(storeId, qs = {}, options = {}) {
    const queryParams = { ...this.obterIntervaloDatasPadrao(), ...qs };
    return this.get(`/attendances`, queryParams, options);
  }

  /**
   * Consulta os detalhes de um atendimento específico (/attendances/:attendanceId)
   * Retorna objeto customer contendo customer_id originado do LEFT JOIN em CLIENTE (PR #429).
   */
  obterDetalheAtendimento(storeId, attendanceId, options = {}) {
    return this.get(`/attendances/${attendanceId}`, {}, options);
  }

  /**
   * Lista as mensagens trocadas em um atendimento (/attendances/:attendanceId/messages)
   * Projeta anexo com filename e mime_type (PR #457) e citação replied_message (PR #500).
   * Suporta passagem flexível de query parameters e options de requisição (ex: headers).
   */
  listarMensagensAtendimento(storeId, attendanceId, qsOrOptions = {}, options = {}) {
    const isOptionsOnly = qsOrOptions && (qsOrOptions.headers !== undefined || qsOrOptions.timeout !== undefined);
    const qs = isOptionsOnly ? {} : qsOrOptions;
    const opts = isOptionsOnly ? qsOrOptions : options;
    return this.get(`/attendances/${attendanceId}/messages`, qs, opts);
  }

  /**
   * Cria/atualiza a reação do atendente numa mensagem (PUT .../messages/:messageId/reaction, Issue backend#617)
   * Sempre grava AUTOR=1 (atendente) com DATA_REACAO renovada e ENVIO_STATUS=0 (pending).
   * @param {string} emoji Placeholder cru no formato {{e:HEX}}, até 100 caracteres
   */
  reagirMensagem(storeId, attendanceId, messageId, emoji, options = {}) {
    return this.put(`/attendances/${attendanceId}/messages/${messageId}/reaction`, { emoji }, options);
  }

  /**
   * Remove a reação do atendente numa mensagem (DELETE .../messages/:messageId/reaction, Issue backend#617)
   * Idempotente: mensagem válida sem reação do atendente responde 204 sem gravar nada.
   */
  removerReacaoMensagem(storeId, attendanceId, messageId, options = {}) {
    return this.delete(`/attendances/${attendanceId}/messages/${messageId}/reaction`, options);
  }

  /**
   * Consulta as 17 capabilities específicas de um atendimento (/attendances/:attendanceId/capabilities)
   * Otimizado em lote (hasAll) com latência reduzida (~100ms) conforme PR #393 / #405.
   */
  obterCapabilitiesAtendimento(storeId, attendanceId, options = {}) {
    return this.get(`/attendances/${attendanceId}/capabilities`, {}, options);
  }

  /**
   * Atualiza dados e status do atendimento (PATCH /attendances/:attendanceId)
   * Suporta alteração de status (0 = pendente, 1 = em andamento, 2 = concluído, 3 = finalizado, 4 = descartado) e notes.
   */
  atualizarStatusAtendimento(storeId, attendanceId, body = {}, options = {}) {
    return this.patch(`/attendances/${attendanceId}`, body, options);
  }

  /**
   * Busca clientes cadastrados por texto ou número (/clients)
   */
  buscarClientes(storeId, termoBusca, options = {}) {
    return this.get(`/clients`, { q: termoBusca }, options);
  }

  /**
   * Lista as receitas da loja da sessão para a tela "Lista de receitas" (GET /prescriptions/search, backend#723/PR #749 e #750).
   * Parâmetros opcionais: page, per_page, q, type (human|animal), status (open|awaiting_delivery|delivered|discarded),
   * sort (asc|desc), from, to (YYYY-MM-DD, até 90 dias; sem eles vale o corte padrão de 90 dias). Exige a permissão 145 (can_list_recipes).
   * Devolve items, pagination e summary (contadores por faceta). Não confundir com GET /prescriptions?filter=, que segue sem grant.
   */
  buscarReceitasDaLoja(storeId, qs = {}, options = {}) {
    return this.get(`/prescriptions/search`, qs, options);
  }

  /**
   * Consulta as capabilities do módulo de Receitas/Prescrições (/prescription-capabilities)
   */
  obterCapabilitiesReceitas(storeId, options = {}) {
    return this.get(`/prescription-capabilities`, {}, options);
  }

  /**
   * Consulta as capabilities do módulo de Entregas (/delivery-capabilities)
   */
  obterCapabilitiesEntrega(storeId, options = {}) {
    return this.get(`/delivery-capabilities`, {}, options);
  }

  /**
   * Consulta as capabilities do módulo Financeiro (/financial-capabilities)
   */
  obterCapabilitiesFinanceiro(storeId, options = {}) {
    return this.get(`/financial-capabilities`, {}, options);
  }

  /**
   * Cria uma nova prescrição/receita para a loja (POST /prescriptions)
   * Suporta opcionalmente attendance_id para vincular a receita diretamente a um atendimento do chat.
   */
  criarPrescricao(storeId, body = {}, options = {}) {
    return this.post(`/prescriptions`, body, options);
  }

  /**
   * Altera o cabeçalho de uma prescrição (PATCH /prescriptions/:prescriptionId)
   * Campos de texto: rg_ie, issuing_body, issuing_body_uf e observation (Issue backend#655, recusam o que não cabe em WIN1252 com 422).
   */
  atualizarPrescricao(storeId, prescriptionId, body = {}, options = {}) {
    return this.patch(`/prescriptions/${prescriptionId}`, body, options);
  }

  /**
   * Busca prescritores (GET /prescribers?q=)
   * Termo numérico procura pelo CRM (sem espaço, tab e zero à esquerda, dos dois lados) e pelo código, com os de CRM primeiro; cada item traz
   * id, name, council, council_number e council_uf (Issue backend#658/PR #712).
   */
  buscarPrescritores(storeId, q, options = {}) {
    return this.get(`/prescribers`, { q }, options);
  }

  /**
   * Consulta os detalhes de uma prescrição com suas fórmulas (/prescriptions/:prescriptionId)
   */
  obterDetalhePrescricao(storeId, prescriptionId, options = {}) {
    return this.get(`/prescriptions/${prescriptionId}`, {}, options);
  }

  /**
   * Lista os produtos cadastrados da loja com suporte a busca e tipo de uso (/products)
   * Exige obrigatoriamente usage ('human' ou 'animal').
   */
  listarProdutos(storeId, qs = {}, options = {}) {
    const queryParams = { usage: 'human', ...qs };
    return this.get(`/products`, queryParams, options);
  }

  /**
   * Cria uma nova fórmula vinculada a uma prescrição (/prescriptions/:prescriptionId/formulas)
   */
  criarFormulaPrescricao(storeId, prescriptionId, body = {}, options = {}) {
    return this.post(`/prescriptions/${prescriptionId}/formulas`, body, options);
  }

  /**
   * Adiciona um produto/insumo a uma fórmula (POST /prescriptions/:prescriptionId/formulas/:formulaId/products)
   */
  adicionarProdutoFormula(storeId, prescriptionId, formulaId, body = {}, options = {}) {
    return this.post(`/prescriptions/${prescriptionId}/formulas/${formulaId}/products`, body, options);
  }

  /**
   * Altera um produto de uma fórmula (PATCH /prescriptions/:prescriptionId/formulas/:formulaId/products/:productId)
   */
  atualizarProdutoFormula(storeId, prescriptionId, formulaId, productId, body = {}, options = {}) {
    return this.patch(`/prescriptions/${prescriptionId}/formulas/${formulaId}/products/${productId}`, body, options);
  }

  /**
   * Dispara o cálculo de preço da fórmula (POST /prescriptions/:prescriptionId/formulas/:formulaId/calculate)
   */
  calcularFormula(storeId, prescriptionId, formulaId, options = {}) {
    return this.post(`/prescriptions/${prescriptionId}/formulas/${formulaId}/calculate`, {}, options);
  }

  /**
   * Altera campos de uma fórmula da prescrição (PATCH /prescriptions/:prescriptionId/formulas/:formulaId)
   */
  atualizarFormulaPrescricao(storeId, prescriptionId, formulaId, body = {}, options = {}) {
    return this.patch(`/prescriptions/${prescriptionId}/formulas/${formulaId}`, body, options);
  }

  /**
   * Prévia do cálculo de uma fórmula, sem gravar nada (POST /prescriptions/formula-calculations)
   */
  preverCalculoFormula(storeId, body = {}, options = {}) {
    return this.post(`/prescriptions/formula-calculations`, body, options);
  }

  /**
   * Consulta os passos de rastreamento de uma fórmula (/prescriptions/:prescriptionId/formulas/:formulaId/tracking-steps)
   */
  obterPassosRastreamento(storeId, prescriptionId, formulaId, options = {}) {
    return this.get(`/prescriptions/${prescriptionId}/formulas/${formulaId}/tracking-steps`, {}, options);
  }

  /**
   * Lista os processos de manipulação de uma fórmula (/prescriptions/:prescriptionId/formulas/:formulaId/manipulation-processes)
   */
  listarProcessosManipulacao(storeId, prescriptionId, formulaId, options = {}) {
    return this.get(`/prescriptions/${prescriptionId}/formulas/${formulaId}/manipulation-processes`, {}, options);
  }

  /**
   * Registra um novo processo de manipulação na fórmula (POST /prescriptions/:prescriptionId/formulas/:formulaId/manipulation-processes)
   * Entidade de banco: MOV_PROCESSO_MANIPULACAO (grant 231)
   */
  criarProcessoManipulacao(storeId, prescriptionId, formulaId, body = {}, options = {}) {
    return this.post(`/prescriptions/${prescriptionId}/formulas/${formulaId}/manipulation-processes`, body, options);
  }

  /**
   * Atualiza comissão ou reatribui funcionário em um processo de manipulação (PATCH /prescriptions/:prescriptionId/formulas/:formulaId/manipulation-processes/:processId)
   * Suporta grant 509 (comissão) e grant 337 (reatribuir funcionário)
   */
  atualizarProcessoManipulacao(storeId, prescriptionId, formulaId, processId, body = {}, options = {}) {
    return this.patch(`/prescriptions/${prescriptionId}/formulas/${formulaId}/manipulation-processes/${processId}`, body, options);
  }

  /**
   * Remove um processo de manipulação registrado (DELETE /prescriptions/:prescriptionId/formulas/:formulaId/manipulation-processes/:processId)
   */
  excluirProcessoManipulacao(storeId, prescriptionId, formulaId, processId, options = {}) {
    return this.delete(`/prescriptions/${prescriptionId}/formulas/${formulaId}/manipulation-processes/${processId}`, options);
  }

  // =========================================================================
  // MÓDULO DE CADASTRO E GESTÃO DE CLIENTES (PR #413 E #438)
  // =========================================================================

  /**
   * Consulta as 18 capabilities do módulo de clientes (/client-capabilities)
   */
  obterCapabilitiesClientes(storeId, options = {}) {
    return this.get(`/client-capabilities`, {}, options);
  }

  /**
   * Consulta os grupos de clientes disponíveis (/client-groups)
   */
  listarGruposClientes(storeId, options = {}) {
    return this.get(`/client-groups`, {}, options);
  }

  /**
   * Consulta as classes de movimentação de clientes (/client-movement-classes)
   */
  listarClassesMovimentacaoClientes(storeId, options = {}) {
    return this.get(`/client-movement-classes`, {}, options);
  }

  /**
   * Consulta as classes de pós-venda de clientes (/client-post-sale-classes)
   */
  listarClassesPosVendaClientes(storeId, options = {}) {
    return this.get(`/client-post-sale-classes`, {}, options);
  }

  /**
   * Busca cidades por termo (/cities?q=...)
   */
  listarCidades(storeId, qs = {}, options = {}) {
    return this.get(`/cities`, qs, options);
  }

  /**
   * Busca bairros filtrando obrigatoriamente por city_id (/neighborhoods?city_id=...)
   */
  listarBairros(storeId, cityId, qs = {}, options = {}) {
    const query = { city_id: cityId, ...qs };
    return this.get(`/neighborhoods`, query, options);
  }

  /**
   * Consulta o endereço de um CEP pela cep-api interna (GET /zip-codes?zip_code=<CEP>, backend#751/PR #752 e #753).
   * Aceita o CEP com ou sem hífen; `zipCode` indefinido não manda o parâmetro. Só pede o token: sem grant, sem resource gate
   * e sem o prefixo /stores/:storeId. Devolve `city.id` e `neighborhood.id` do catálogo só quando exatamente uma linha casa.
   */
  consultarCep(zipCode, options = {}) {
    return this.get(`/zip-codes`, zipCode === undefined ? {} : { zip_code: zipCode }, options);
  }

  /**
   * Revenda (orçamento de balcão, ATENDIMENTO_A1 tipo 2; backend#27 e sub-issues). Todas as rotas exigem o recurso contratado `resale`,
   * leem a loja do token e nascem sem o prefixo /stores/:storeId (o caminho antigo responde 404).
   * `POST /resales` cria o orçamento aberto (`patient_id` e `prescriber_id` obrigatórios; o comprador vem do paciente).
   */
  criarRevenda(body = {}, options = {}) {
    return this.post(`/resales`, body, options);
  }

  /**
   * Edita o cabeçalho da revenda (PATCH /resales/:id, backend#782/PR #771): comprador, prescritor, tipo de operação, setor, comissionado,
   * comissão, loja de retirada e vínculo omni. Campo com o valor já gravado não exige grant e não grava; `patient_id` e qualquer campo fora da lista recusam com 422.
   */
  atualizarRevenda(resaleId, body = {}, options = {}) {
    return this.patch(`/resales/${resaleId}`, body, options);
  }

  /**
   * Detalhe da revenda com produtos, totais e `capabilities` (GET /resales/:id, backend#780/PR #768).
   */
  obterDetalheRevenda(resaleId, options = {}) {
    return this.get(`/resales/${resaleId}`, {}, options);
  }

  /**
   * Inclui um produto na revenda (POST /resales/:id/products, backend#783/PR #773): `product_id` e `quantity` obrigatórios, `unit` e `lot_id` opcionais.
   * O preço nunca vem do cliente (tabela ou promoção ativa) e qualquer outro campo recusa com 422. Responde 201 com o detalhe inteiro da revenda.
   * Na revenda concluída o lote é obrigatório e a linha baixa o estoque do lote.
   */
  incluirProdutoRevenda(resaleId, body = {}, options = {}) {
    return this.post(`/resales/${resaleId}/products`, body, options);
  }

  /**
   * Altera uma linha de produto da revenda (PATCH /resales/:id/products/:lineId, backend#784/PR #775): só `quantity`, `unit` e `lot_id` (`null` tira o lote).
   * Só conta o que muda (pedido sem mudança responde 200 sem gravar) e responde com o detalhe inteiro da revenda. Qualquer outro campo recusa com 422.
   * Na revenda concluída a linha precisa terminar com lote e a troca baixa ou devolve estoque.
   */
  atualizarProdutoRevenda(resaleId, lineId, body = {}, options = {}) {
    return this.patch(`/resales/${resaleId}/products/${lineId}`, body, options);
  }

  /**
   * Exclui logicamente uma linha de produto da revenda (DELETE /resales/:id/products/:lineId, backend#784/PR #775): 204, e repetir também responde 204 sem gravar.
   * Na revenda concluída o gatilho devolve o estoque do lote e a quantidade vendida da promoção.
   */
  excluirProdutoRevenda(resaleId, lineId, options = {}) {
    return this.delete(`/resales/${resaleId}/products/${lineId}`, options);
  }

  /**
   * Busca de produtos da revenda (GET /products?context=resale, backend#785/PR #776): um item por produto de revenda, com `lots` (`id`, `number`, `expires_on`,
   * `balance`, `promotion`) por vencimento e depois por id, `promotion` do item só sem lote e `max_discount_percentage`. `usage` é opcional e ignorado
   * (na busca da receita, `listarProdutos`, continua obrigatório). `mode` `starting` busca pelo começo do nome e `containing` por qualquer parte.
   */
  buscarProdutosRevenda(qs = {}, options = {}) {
    return this.get(`/products`, { context: 'resale', ...qs }, options);
  }

  /**
   * As onze capabilities da revenda que dependem só de grant (GET /resale-capabilities, backend#780/PR #768). Nunca responde 403 por permissão.
   */
  obterCapabilitiesRevenda(options = {}) {
    return this.get(`/resale-capabilities`, {}, options);
  }

  /**
   * Lista clientes da loja com suporte a paginação e busca (/clients)
   */
  listarClientes(storeId, qs = {}, options = {}) {
    return this.get(`/clients`, qs, options);
  }

  /**
   * Consulta a ficha completa do cliente com documento cru (/clients/:id)
   */
  obterDetalheCliente(storeId, clientId, options = {}) {
    return this.get(`/clients/${clientId}`, {}, options);
  }

  /**
   * Atualiza dados cadastrais do cliente via dirty patch (/clients/:id)
   */
  atualizarCliente(storeId, clientId, body = {}, options = {}) {
    return this.patch(`/clients/${clientId}`, body, options);
  }

  /**
   * Altera o status de ativação do cliente de forma idempotente (/clients/:id/deactivation)
   */
  alterarAtivacaoCliente(storeId, clientId, active = true, options = {}) {
    return this.post(`/clients/${clientId}/deactivation`, { active }, options);
  }

  /**
   * Cria um novo cliente na loja (/clients)
   */
  criarCliente(storeId, body = {}, options = {}) {
    return this.post(`/clients`, body, options);
  }

  /**
   * Lista os telefones vinculados a um cliente (/clients/:id/phones)
   */
  listarTelefonesCliente(storeId, clientId, options = {}) {
    return this.get(`/clients/${clientId}/phones`, {}, options);
  }

  /**
   * Lista os endereços cadastrados para um cliente (/clients/:id/addresses)
   */
  listarEnderecosCliente(storeId, clientId, options = {}) {
    return this.get(`/clients/${clientId}/addresses`, {}, options);
  }

  /**
   * Adiciona um novo telefone ao cliente (POST /clients/:clientId/phones)
   */
  criarTelefoneCliente(storeId, clientId, body = {}, options = {}) {
    return this.post(`/clients/${clientId}/phones`, body, options);
  }

  /**
   * Atualiza dados de um telefone do cliente (PATCH /clients/:clientId/phones/:phoneId)
   */
  atualizarTelefoneCliente(storeId, clientId, phoneId, body = {}, options = {}) {
    return this.patch(`/clients/${clientId}/phones/${phoneId}`, body, options);
  }

  /**
   * Remove um telefone do cliente (DELETE /clients/:clientId/phones/:phoneId)
   */
  excluirTelefoneCliente(storeId, clientId, phoneId, options = {}) {
    return this.delete(`/clients/${clientId}/phones/${phoneId}`, options);
  }

  /**
   * Adiciona um novo endereço ao cliente (POST /clients/:clientId/addresses)
   */
  criarEnderecoCliente(storeId, clientId, body = {}, options = {}) {
    return this.post(`/clients/${clientId}/addresses`, body, options);
  }

  /**
   * Atualiza dados de um endereço do cliente (PATCH /clients/:clientId/addresses/:addressId)
   */
  atualizarEnderecoCliente(storeId, clientId, addressId, body = {}, options = {}) {
    return this.patch(`/clients/${clientId}/addresses/${addressId}`, body, options);
  }

  /**
   * Remove um endereço do cliente (DELETE /clients/:clientId/addresses/:addressId)
   */
  excluirEnderecoCliente(storeId, clientId, addressId, options = {}) {
    return this.delete(`/clients/${clientId}/addresses/${addressId}`, options);
  }

  /**
   * Consulta o status atual de disponibilidade operacional do atendente (/attendants/:attendantId/status)
   */
  obterStatusAtendente(storeId, attendantId, options = {}) {
    return this.get(`/attendants/${attendantId}/status`, {}, options);
  }

  /**
   * Altera a disponibilidade operacional do atendente (PATCH /attendants/:attendantId)
   * Suporta enums: 'available', 'busy', 'offline'.
   */
  atualizarStatusAtendente(storeId, attendantId, body = {}, options = {}) {
    return this.patch(`/attendants/${attendantId}`, body, options);
  }

  /**
   * Lista os documentos e imagens anexados a uma prescrição (/prescriptions/:prescriptionId/documents)
   */
  listarDocumentosPrescricao(storeId, prescriptionId, qs = {}, options = {}) {
    return this.get(`/prescriptions/${prescriptionId}/documents`, qs, options);
  }

  /**
   * Realiza upload multipart de documento/imagem para uma prescrição (/prescriptions/:prescriptionId/documents)
   */
  anexarDocumentoPrescricao(storeId, prescriptionId, filePath, fileName = 'sample.jpg', mimeType = 'image/jpeg') {
    return cy.task('anexarDocumentoPrescricao', {
      apiUrl: this.apiUrl,
      storeId,
      prescriptionId,
      token: this.token,
      filePath,
      fileName,
      mimeType,
    });
  }

  /**
   * Envia mídia/documento no chat via multipart (POST /attendances/:attendanceId/messages/media, Issue backend#563).
   * `caption` é opcional e volta no campo `content` da mensagem; o nome do arquivo volta em `attachment.filename`.
   * `mediaType: null` omite o campo e `nomeCampoArquivo` troca o nome da parte do arquivo (ambos só para provar a recusa de parâmetro ausente, Issue backend#640).
   */
  enviarMidiaAtendimento(storeId, attendanceId, { filePath, fileName, mimeType, caption, mediaType = 'document', employeeId, nomeCampoArquivo } = {}) {
    return cy.task('enviarMidiaAtendimento', {
      apiUrl: this.apiUrl,
      storeId,
      attendanceId,
      token: this.token,
      filePath,
      fileName,
      mimeType,
      campos: { ...(mediaType ? { media_type: mediaType } : {}), ...(employeeId != null ? { employee_id: String(employeeId) } : {}), ...(caption ? { caption } : {}) },
      ...(nomeCampoArquivo ? { nomeCampoArquivo } : {}),
    });
  }

  /**
   * Consulta as preview-urls ou dados binários de documentos da receita (/prescriptions/:prescriptionId/documents/preview-urls)
   */
  obterPreviewDocumentosPrescricao(storeId, prescriptionId, ids, options = {}) {
    return this.get(`/prescriptions/${prescriptionId}/documents/preview-urls`, { ids }, options);
  }

  /**
   * Exclui logicamente um documento vinculado à receita (DELETE /prescriptions/:prescriptionId/documents/:documentId)
   */
  excluirDocumentoPrescricao(storeId, prescriptionId, documentId, options = {}) {
    return this.delete(`/prescriptions/${prescriptionId}/documents/${documentId}`, options);
  }

  // =========================================================================
  // MÓDULO DE CICLO DE VIDA DA RECEITA (FINALIZAR E CANCELAR FINALIZAÇÃO)
  // =========================================================================

  /**
   * Data de entrega ao cliente calculada na hora, daqui a `dias` dias (ISO-8601 com `Z`), para nunca ficar vencida nem depender de uma data fixa.
   */
  dataDeEntregaFutura(dias = 3) {
    return new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString();
  }

  /**
   * Data de retorno da fórmula calculada na hora, daqui a `dias` dias (`AAAA-MM-DD`), para nunca ficar vencida nem depender de uma data fixa.
   * Desde a backend PR #805 (backend#792) o finalize responde 422 RETURN_DATE_REQUIRED quando a loja exige o retorno (`settings.return_date_required`)
   * e alguma fórmula concluída não tem `return_date`; mandar a data é inofensivo com a exigência desligada, então a massa a envia sempre.
   */
  dataDeRetornoFutura(dias = 30) {
    return new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  /**
   * Finaliza uma receita (POST /prescriptions/:prescriptionId/finalize)
   * Altera status_mov de 0 para -1 no ERP (Delphi) e expõe capabilities atualizadas.
   * Desde o backend#792 a finalização data a entrega: loja manual sem `expected_delivery_at` responde 422 DELIVERY_DATE_REQUIRED, e na automática
   * a data informada pode ser movida para o primeiro dia útil (a resposta traz a gravada). Por padrão manda uma data futura calculada, válida nos dois modos
   * (na automática, data diferente da tabela exige a 427, que a conta de teste tem); `body` explícito (ex.: `{}`) testa a recusa sem data.
   */
  finalizarPrescricao(storeId, prescriptionId, options = {}, body = { expected_delivery_at: this.dataDeEntregaFutura() }) {
    return this.post(`/prescriptions/${prescriptionId}/finalize`, body, options);
  }

  /**
   * Cancela a finalização de uma receita (POST /prescriptions/:prescriptionId/cancel-finalization)
   * Retorna status_mov de -1 para 0 no ERP (Delphi).
   */
  cancelarFinalizacaoPrescricao(storeId, prescriptionId, options = {}) {
    return this.post(`/prescriptions/${prescriptionId}/cancel-finalization`, {}, options);
  }

  /**
   * Registra a falta de estoque de um produto (POST /stock-shortages, rota da capability can_register_stock_shortage, backend#224/#707).
   * Rota sem o prefixo /stores/:storeId. O produto é obrigatório e deve ser válido (422 "O produto é obrigatório e deve ser válido."); um produto válido grava a falta de verdade.
   */
  registrarFaltaEstoque(storeId, body = {}, options = {}) {
    return this.post(`/stock-shortages`, body, options);
  }

  /**
   * Cria o carrinho da receita (sem `cart_id`, devolvendo o que ela já tem) ou a vincula a um carrinho existente (`{ cart_id }`)
   * (POST /prescriptions/:prescriptionId/cart, backend#718/PR #730). Exige receita finalizada, não paga, não descartada nem cancelada.
   * Rota sem o prefixo /stores/:storeId e sem grant (a 23 saiu do catálogo). Cada carrinho novo queima 1 número da sequência.
   */
  vincularCarrinhoReceita(prescriptionId, body = {}, options = {}) {
    return this.post(`/prescriptions/${prescriptionId}/cart`, body, options);
  }

  /**
   * Retira a receita do carrinho (DELETE /prescriptions/:prescriptionId/cart, 204; receita sem carrinho também responde 204).
   */
  retirarCarrinhoReceita(prescriptionId, options = {}) {
    return this.delete(`/prescriptions/${prescriptionId}/cart`, options);
  }

  /**
   * Estado regulatório da receita: itens controlados aplicáveis, portaria e conselhos aceitos de cada um, o que falta e a autorização
   * (GET /prescriptions/:prescriptionId/controlled-items, Issue backend#227). Rota sem o prefixo /stores/:storeId: a loja vem do token (backend#677).
   */
  obterItensControladosReceita(prescriptionId, options = {}) {
    return this.get(`/prescriptions/${prescriptionId}/controlled-items`, {}, options);
  }

  /**
   * Autoriza os insumos controlados da receita numa única transação (POST /prescriptions/:prescriptionId/controlled-authorization, Issue backend#227).
   * Valida tudo antes de gravar documento, prescritor e dados por linha, e estampa a autorização; devolve a receita completa, `controlled_authorization` e `warnings`.
   */
  autorizarControladosReceita(prescriptionId, body = {}, options = {}) {
    return this.post(`/prescriptions/${prescriptionId}/controlled-authorization`, body, options);
  }

  // =========================================================================
  // MÓDULO DE ENTREGAS (DELIVERY) E ENFORCEMENT DE RECURSOS
  // =========================================================================

  /**
   * Consulta a lista de entregas da loja (/deliveries)
   * Utilizado para validar o gate de recurso @RequiresResource("delivery").
   */
  listarEntregas(storeId, qs = {}, options = {}) {
    return this.get(`/deliveries`, qs, options);
  }

  // =========================================================================
  // MÓDULO DE SUBSTATUS PERSONALIZADOS DE ATENDIMENTO (PR #526)
  // =========================================================================

  /**
   * Consulta o catálogo de substatus personalizados da loja (/attendance-custom-statuses)
   */
  obterStatusPersonalizados(storeId, options = {}) {
    return this.get(`/attendance-custom-statuses`, {}, options);
  }

  /**
   * Registra um novo substatus personalizado (POST /attendance-custom-statuses)
   * Regressão da PR #526: o INSERT antes omitia ALTERACAO_LJ/ALTERACAO_CF/ALTERACAO_DT,
   * violando a constraint NOT NULL do domínio de ALTERACAO_CF e respondendo 500.
   */
  criarStatusPersonalizado(storeId, payload, options = {}) {
    return this.post(`/attendance-custom-statuses`, payload, options);
  }

  /**
   * Devolve o substatus de nome fixo do catálogo e só o cria (POST) quando falta: a rota não tem DELETE, então a massa reaproveitada
   * é criada uma vez por base. Uso: gatilho exclusivo das automações de teste (backend#741), que ninguém mais põe num atendimento,
   * para que a automação ativa da rodada não dispare no atendimento de outra pessoa.
   */
  garantirStatusPersonalizado(nome, parentStatus, options = {}) {
    return this.obterStatusPersonalizados(null, options).then((res) => {
      const existente = (res.body.items || []).find((s) => s.name === nome && s.parent_status === parentStatus);
      if (existente) return existente;
      return this.criarStatusPersonalizado(null, { parent_status: parentStatus, name: nome }, options).then((resNovo) => {
        expect(resNovo.status, `Status do POST /attendance-custom-statuses "${nome}"`).to.be.oneOf([200, 201]);
        return resNovo.body;
      });
    });
  }

  /**
   * Atualiza um substatus personalizado existente (PATCH /attendance-custom-statuses/:id)
   */
  atualizarStatusPersonalizado(storeId, statusId, payload, options = {}) {
    return this.patch(`/attendance-custom-statuses/${statusId}`, payload, options);
  }

  // =========================================================================
  // MÓDULO DE FILIAIS (BRANCHES) E ESCOPO DE DADOS INTERLOJAS
  // =========================================================================

  /**
   * Consulta a lista de filiais da rede (/branches?purpose=pickup)
   * Utilizado para validar o escopo de dados interlojas (PR #412).
   */
  listarFiliais(storeId, purpose = 'pickup', options = {}) {
    const qs = purpose ? { purpose } : {};
    return this.get(`/branches`, qs, options);
  }

  // =========================================================================
  // MÓDULO DE LINKS DE PAGAMENTO (PR #445)
  // =========================================================================

  /**
   * Consulta os links de pagamento de um atendimento (/attendances/:attendanceId/payment-links)
   */
  listarLinksPagamentoAtendimento(storeId, attendanceId, options = {}) {
    return this.get(`/attendances/${attendanceId}/payment-links`, {}, options);
  }

  /**
   * Dispara a geração de link de pagamento (POST /attendances/:attendanceId/payment-links)
   */
  gerarLinkPagamento(storeId, attendanceId, body = {}, options = {}) {
    return this.post(`/attendances/${attendanceId}/payment-links`, body, options);
  }

  /**
   * Tenta disparar a geração de link de pagamento por financeiro (POST /financials/:financialId/payment-link)
   * Rota descontinuada e removida na PR #451 (retorna 404 Not Found).
   */
  gerarLinkPagamentoFinanceiro(storeId, financialId, body = {}, options = {}) {
    return this.post(`/financials/${financialId}/payment-link`, body, options);
  }

  /**
   * Tenta consultar links de pagamento diretamente no domínio financeiro (/financials/:financialId/payment-link)
   * Rota inexistente (retorna 404 Not Found).
   */
  consultarLinksPagamentoFinanceiro(storeId, financialId, options = {}) {
    return this.get(`/financials/${financialId}/payment-link`, {}, options);
  }

  // =========================================================================
  // MÓDULO DE ORÇAMENTOS DO ATENDIMENTO (PR #449)
  // =========================================================================

  /**
   * Lista os orçamentos vinculados ao atendimento (/attendances/:attendanceId/budgets)
   * Retorna envelope { data: [...], totals: {...}, pagination: {...} }
   */
  listarOrcamentosAtendimento(storeId, attendanceId, options = {}) {
    return this.get(`/attendances/${attendanceId}/budgets`, {}, options);
  }

  /**
   * Atualiza a seleção de um orçamento para link de pagamento (PATCH /attendances/:attendanceId/budgets/:budgetCode)
   */
  atualizarSelecaoOrcamento(storeId, attendanceId, budgetCode, selected, options = {}) {
    return this.patch(
      `/attendances/${attendanceId}/budgets/${budgetCode}`,
      { selected_for_payment_link: selected },
      options
    );
  }
  
  // =========================================================================
  // MÉTODOS PARA VALIDAÇÃO DA PR #472 (TIMESTAMPS INSTANT/Z)
  // =========================================================================

  listarPrescricoes(storeId, params = {}, options = {}) {
    return this.get(`/prescriptions`, params, options);
  }

  listarAutorizacoes(storeId, params = {}, options = {}) {
    const defaultParams = { role: 'requester', ...params };
    return this.get(`/authorization-requests`, defaultParams, options);
  }

  listarArquivosIa(storeId, attendanceId, options = {}) {
    return this.get(`/attendances/${attendanceId}/ia-files`, {}, options);
  }

  /**
   * Envia arquivos de IA do atendimento para a fila IA_ORCAMENTO, como o desktop
   * (POST /attendances/:attendanceId/ia-files/submissions — Issue backend#667/PR #670).
   * Corpo: { file_ids: [n, ...], movement_type?: 1 }. Responde 202 { message, accepted_file_ids } sem esperar a IA;
   * 409 IA_FILE_ALREADY_QUEUED quando algum arquivo do lote já está na fila (nada é gravado).
   */
  enviarArquivosIa(storeId, attendanceId, body = {}, options = {}) {
    return this.post(`/attendances/${attendanceId}/ia-files/submissions`, body, options);
  }

  listarEventosAtendimento(storeId, params = {}, options = {}) {
    return this.get(`/attendance-events`, params, options);
  }

  /**
   * Dispara a baixa / marcação de leitura de mensagens do atendimento (POST /attendances/:attendanceId/read - PR #415 / #495)
   * Retorna { attendance_id, unread_count, messages_marked, captured }
   */
  marcarMensagensLidas(storeId, attendanceId, body = {}, options = {}) {
    return this.post(`/attendances/${attendanceId}/read`, body, options);
  }

  /**
   * Automações (Issue front#605; backend#735 e #738/#739). Todas as rotas leem a loja do token (sem o prefixo /stores/:storeId) e exigem o recurso contratado `automation`.
   * `GET /automation-capabilities` devolve `{ can_list, can_create, can_edit, can_delete }` (legado 635: presença, GRAVAR, ALTERAR, EXCLUIR).
   */
  obterCapabilitiesAutomacoes(options = {}) {
    return this.get(`/automation-capabilities`, {}, options);
  }

  /** Lista as automações da loja: `{ data: [{ id, name, trigger_type, is_active, run_count, last_run_at, ... }] }` (GET /automations). */
  listarAutomacoes(options = {}) {
    return this.get(`/automations`, {}, options);
  }

  /** Detalhe com a árvore de passos e o `updated_at` usado na edição concorrente: `{ automation: {...} }` (GET /automations/:id). */
  obterAutomacao(automationId, options = {}) {
    return this.get(`/automations/${automationId}`, {}, options);
  }

  /** Cria a automação por árvore aninhada (`name`, `trigger_type`, `trigger_config`, `is_active`, `steps`) ou por modelo (`{ template_slug }`). POST /automations. */
  criarAutomacao(body = {}, options = {}) {
    return this.post(`/automations`, body, options);
  }

  /** Altera a automação (PATCH /automations/:id). O `updated_at` lido vai em todo PATCH, exceto no do switch (`{ is_active }` sozinho). */
  atualizarAutomacao(automationId, body = {}, options = {}) {
    return this.patch(`/automations/${automationId}`, body, options);
  }

  /** Exclui a automação (DELETE /automations/:id): exclusão lógica, `204` e depois `404`; as linhas ficam no banco e a purga só limpa o histórico de execução. */
  excluirAutomacao(automationId, options = {}) {
    return this.delete(`/automations/${automationId}`, options);
  }

  /** Duplica a automação, que nasce pausada (POST /automations/:id/duplicate, sem corpo). */
  duplicarAutomacao(automationId, options = {}) {
    return this.post(`/automations/${automationId}/duplicate`, {}, options);
  }

  /** Histórico de execuções, `page` a partir de 1: `{ data: [...], has_next }` (GET /automations/:id/logs). */
  listarExecucoesAutomacao(automationId, page = 1, options = {}) {
    return this.get(`/automations/${automationId}/logs`, { page }, options);
  }

  /**
   * Histórico de execuções com a paginação inteira (backend#743): `query` = `{ page, per_page }` em qualquer combinação, inclusive vazia (padrão: página 1, 20 por página).
   * `per_page` vai de 1 a 100; fora disso, `page` < 1, texto ou um deslocamento que não cabe em `Int` → `422` "Parâmetros de paginação inválidos.".
   */
  listarExecucoesAutomacaoPaginado(automationId, query = {}, options = {}) {
    return this.get(`/automations/${automationId}/logs`, query, options);
  }
}

export { BackendApiService };
export default new BackendApiService();
