/**
 * Módulo de Diagnóstico e Tratamento Inteligente de Erros E2E (Pharmacie Web)
 *
 * Analisa as falhas do Cypress em tempo de execução, classifica a causa raiz
 * e formata uma mensagem clara, estruturada e acionável para o operador.
 */

class ErrorHandler {
  /**
   * Diz se o spec é um dos de contrato de backend (`0-A`, `0-B` e `0-C.backend-*.cy.js`), pelo nome exato
   * do arquivo, nunca por trecho do título. O critério antigo (`0.backend.cy.js`) deixou de casar no split
   * de 2026-10-20 (`ROADMAP.md` P2-01).
   * @param {string} specPath Caminho relativo do spec (`Cypress.spec.relative`)
   * @returns {boolean}
   */
  ehSpecBackend(specPath) {
    return /(^|[/\\])0-[A-D]\.backend-[^/\\]+\.cy\.js$/i.test(specPath || '');
  }

  /**
   * Sanitiza strings removendo tokens JWT gigantescos e cabeçalhos extensos
   * para não poluir o terminal ou o relatório do Mochawesome.
   * @param {string} msg Mensagem original
   * @returns {string} Mensagem limpa
   */
  sanitizarMensagem(msg) {
    if (!msg || typeof msg !== 'string') return '';
    return msg
      .replace(/Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, 'Bearer [TOKEN_JWT_OMITIDO]')
      .replace(/authorization:\s*"Bearer\s+[^"]+"/gi, 'authorization: "Bearer [OMITIDO]"')
      .replace(/ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, '[TOKEN_OMITIDO]');
  }

  /**
   * Identifica a categoria do erro com base na mensagem e na pilha de execução.
   * @param {Error} err Objeto de erro capturado pelo Cypress
   * @param {object} [runnable] Metadados do teste em execução
   * @returns {object} Informações diagnósticas (categoria, icone, descricao, acaoRecomendada)
   */
  classificarErro(err, runnable = null) {
    const rawMsg = (err.message || '') + ' ' + (err.stack || '');

    // 1. Timeout de Rede / Socket da API (ESOCKETTIMEDOUT / responseTimeout)
    if (
      rawMsg.includes('ESOCKETTIMEDOUT') ||
      rawMsg.includes('ETIMEDOUT') ||
      rawMsg.includes('responseTimeout') ||
      rawMsg.includes('ClientRequest.<anonymous>') ||
      rawMsg.includes('intercept the upstream response, but the request timed out')
    ) {
      // Tenta extrair a rota afetada
      const matchUrl = rawMsg.match(/"url":\s*"([^"]+)"/) || rawMsg.match(/https?:\/\/[^\s"']+/);
      const endpoint = matchUrl ? matchUrl[1] || matchUrl[0] : 'Rota de API desconhecida';

      return {
        categoria: 'TIMEOUT DE REDE / API LENTA (ESOCKETTIMEDOUT)',
        icone: '🚨',
        descricao: `A requisição para a API remota (${endpoint}) excedeu o tempo limite de resposta ou teve a conexão de socket interrompida pelo servidor.`,
        acaoRecomendada: '1. Verifique se o servidor backend da Pharmacie (api.omnicare.dev.local) está operante e estável.\n2. Se este teste deve validar regras de tela sem depender da velocidade da rede externa, utilize Mocks de API.\n3. Se a lentidão for esperada para esta rota, ajuste o `responseTimeout` pontualmente.'
      };
    }

    // 2. Janela de 24h Fechada / Sessão Não Iniciada (distinto de aguardar resposta numa janela já
    // ativa: aqui o compositor de texto livre nunca chegou a ficar disponível, então não adianta
    // esperar mais — precisa abrir a janela antes, não só responder mais rápido)
    if (
      rawMsg.includes('validarJanelaAtiva') &&
      (rawMsg.includes('input-message') || rawMsg.includes('composer-service-window-notice'))
    ) {
      return {
        categoria: 'JANELA DE 24H FECHADA / SESSÃO NÃO INICIADA',
        icone: '🔒',
        descricao: 'O compositor de texto livre (`input-message`) nunca ficou disponível — a Janela de 24h está fechada (contato ainda não iniciou a conversa ou não responde há mais de 24h). Diferente de um timeout aguardando resposta: aqui a janela nem chegou a abrir, então esperar mais não resolve.',
        acaoRecomendada: '1. Abra o WhatsApp do número de teste (DEFAULT_CELULAR, env.json) e responda a última mensagem/template para abrir a Janela de 24h.\n2. Confirme visualmente o badge "Janela ativa" no cabeçalho do chat antes de rodar o teste de novo.\n3. Se o cenário exige Janela ativa de forma determinística, prefira blindar o teste 100% mockado (`AGENTS.md` `[R-BLIND]`) em vez de depender do WhatsApp físico.'
      };
    }

    // 3. Timeout de Resposta Humana no WhatsApp (Janela 24h já ativa/abrindo, aguardando resposta)
    if (
      rawMsg.includes('validarJanelaAtiva') ||
      (rawMsg.includes('badge-janela-ativa') && rawMsg.includes('Timed out retrying')) ||
      rawMsg.includes('90000ms') ||
      rawMsg.includes('responda em até')
    ) {
      return {
        categoria: 'TIMEOUT DE RESPOSTA NO WHATSAPP (JANELA 24H)',
        icone: '📱',
        descricao: 'O template WABA foi disparado com sucesso, mas o número de teste no WhatsApp não respondeu dentro do prazo de 90 segundos.',
        acaoRecomendada: '1. Certifique-se de que o aparelho celular físico cadastrado em env.json (DEFAULT_CELULAR) está com WhatsApp aberto e com conexão à internet.\n2. Responda qualquer mensagem no chat do WhatsApp logo após o disparo do teste.'
      };
    }

    // 3. Timeout de Espera por Intercept / cy.wait('@alias')
    if (
      rawMsg.includes('cy.wait() timed out waiting') ||
      rawMsg.includes('for the 1st response to the route:') ||
      rawMsg.includes('for the 2nd response to the route:') ||
      rawMsg.includes('for the 1st request to the route:') ||
      rawMsg.includes('for the 2nd request to the route:')
    ) {
      const aliasMatch = rawMsg.match(/route:\s*['"`]?@?([^'"`)\s]+)/i);
      const aliasName = aliasMatch ? aliasMatch[1] : 'alias desconhecido';

      if (rawMsg.includes('response to the route:') || rawMsg.includes('No response ever occurred')) {
        return {
          categoria: 'API NÃO RESPONDEU A TEMPO (cy.wait Response Timeout)',
          icone: '⏱️',
          descricao: `A requisição para o alias '@${aliasName}' foi emitida pelo frontend, mas a API backend demorou mais de 10s para responder ou a conexão foi perdida.`,
          acaoRecomendada: `1. Verifique a saúde e a latência do servidor da API (api.omnicare.dev.local).\n2. Se o backend estiver instável no ambiente de teste, utilize dados mockados para o alias '@${aliasName}'.\n3. Caso a rota seja naturalmente lenta, aumentue o 'responseTimeout' na configuração do Cypress.`
        };
      }

      return {
        categoria: 'REQUISIÇÃO NÃO DISPARADA PELO FRONTEND (cy.wait Request Timeout)',
        icone: '⏱️',
        descricao: `O Cypress aguardou a chamada de rede associada ao alias '@${aliasName}', mas o frontend não realizou a requisição HTTP.`,
        acaoRecomendada: `1. Verifique se a ação anterior no DOM (clique, digitação ou abertura de modal) de fato dispara a rota '@${aliasName}'.\n2. O TanStack/React Query pode ter mantido os dados em cache em memória em vez de fazer nova requisição.\n3. Em testes com dados reais, prefira validar elementos renderizados no DOM em vez de 'cy.wait' em rotas cacheadas.`
      };
    }

    // 4. Falha de Permissão / Capabilities (Botões de Ação não Renderizados no Menu/Header)
    if (
      (rawMsg.includes('Expected to find') || rawMsg.includes('never found it')) &&
      (rawMsg.includes('Permissão') || rawMsg.includes('transferir') || rawMsg.includes('completed') || rawMsg.includes('discarded') || rawMsg.includes('status-dropdown') || rawMsg.includes('menu-status') || rawMsg.includes('mensagem-padrao'))
    ) {
      const seletorMatch = rawMsg.match(/Expected to find (?:element|content):\s*`?([^`,]+)`?/i);
      const seletor = seletorMatch ? seletorMatch[1].trim() : 'botão de permissão';

      return {
        categoria: 'BOTÃO / AÇÃO NÃO RENDERIZADA (FALHA DE CAPABILITIES OU PERMISSÕES)',
        icone: '🛡️',
        descricao: `A ação '${seletor}' não apareceu na interface. Isso ocorre quando o Frontend não recebe a chave booleana correspondente (true) no payload da rota de capabilities ou quando o atendimento pertence a outro operador.`,
        acaoRecomendada: `1. Verifique se as rotas de capabilities estão interceptadas com as chaves corretas:\n   - Loja: GET /attendance-capabilities (ex: can_access_attendance_module, can_list_group_agents)\n   - Atendimento Individual: GET /attendances/:id/capabilities (ex: can_mark_completed, can_mark_discarded, can_transfer_assigned_attendance, can_transfer_pending_attendance)\n   - Mensagens: GET /standard-message-capabilities (ex: can_list_standard_messages)\n2. Confirme se o usuário logado possui a propriedade do atendimento (attendant.id === user.id) ou se possui permissão de gerenciamento global.`
      };
    }

    // 5. Elemento Não Encontrado no DOM (Seletor Inexistente / Timeout de DOM Genérico)
    if (
      rawMsg.includes('Expected to find element:') ||
      rawMsg.includes('Expected to find content:') ||
      rawMsg.includes('never found it')
    ) {
      const seletorMatch = rawMsg.match(/Expected to find element:\s*`?([^`,]+)`?/i) ||
                           rawMsg.match(/Expected to find content:\s*`?([^`,]+)`?/i);
      const seletor = seletorMatch ? seletorMatch[1].trim() : 'seletor desconhecido';

      return {
        categoria: 'ELEMENTO NÃO ENCONTRADO NO DOM',
        icone: '🔍',
        descricao: `O elemento identificado por "${seletor}" não apareceu na interface dentro do tempo limite.`,
        acaoRecomendada: `1. Verifique se a rota/tela carregou completamente antes da interação.\n2. Inspecione se o atributo 'data-testid' ou classe CSS foi renomeado no código do Frontend.\n3. Confirme se os dados da listagem/modal não vieram vazios, impedindo a renderização do elemento.`
      };
    }

    // 5. Elemento Oculto, Coberto ou Desabilitado
    if (
      rawMsg.includes('is not visible') ||
      rawMsg.includes('is being covered by another element') ||
      rawMsg.includes('is disabled') ||
      rawMsg.includes('has CSS property: display: none')
    ) {
      return {
        categoria: 'ELEMENTO OCULTO, COBERTO OU DESABILITADO',
        icone: '👁️',
        descricao: 'O elemento existe no HTML, mas está invisível, fora da área de rolagem (scroll), bloqueado por um modal/backdrop ou com estado desabilitado.',
        acaoRecomendada: '1. Utilize `.scrollIntoView()` antes de validar visibilidade de elementos longos ou em painéis laterais.\n2. Verifique se há algum backdrop, drawer ou indicador de carregamento (spinner) sobrepondo o elemento.\n3. Caso o botão esteja desabilitado, valide se todos os campos obrigatórios do formulário foram preenchidos.'
      };
    }

    // 6. Falhas de Backend, APIs REST e Resposta HTTP (cy.request / Códigos de Status / JSON Schema)
    const specPath = (typeof Cypress !== 'undefined' && Cypress.spec) ? Cypress.spec.relative : (runnable && runnable.file ? runnable.file : '');
    // IMPORTANTE: checagem por NOME EXATO do arquivo de spec, nunca substring livre em título de
    // describe/context/it. Um substring-match (`.includes('backend')`) em título quebra com qualquer
    // texto legítimo que mencione uma issue/PR de backend (ex: "front#344 / backend#455") — o teste
    // vira "classificado como API pura" e o snapshot real do DOM é substituído por um template
    // genérico, cegando o diagnóstico de falhas de UI (achado real, 23/09/2026, custou ~1h de
    // investigação numa suíte de anexos até a causa ser encontrada). Ver AGENTS.md §6.
    const isBackendSpec = this.ehSpecBackend(specPath);
    const matchStatus = rawMsg.match(/(?:status|code|statusCode|expected)\D*(\d{3})\D*to\s+(?:equal|eq)\D*(\d{3})/i) ||
                        rawMsg.match(/expected\s+(\d{3})\s+to\s+equal\s+(\d{3})/i);

    if (matchStatus || isBackendSpec || rawMsg.includes('cy.request')) {
      if (matchStatus) {
        const recebido = matchStatus[1];
        const esperado = matchStatus[2];

        // 400 Bad Request
        if (recebido === '400') {
          return {
            categoria: 'RESPOSTA HTTP 400 (BAD REQUEST) - REQUISIÇÃO INVÁLIDA NA API',
            icone: '🌐',
            descricao: `O servidor backend recusou a chamada com HTTP 400 Bad Request (esperava-se status ${esperado}). Isso decorre de query params obrigatórios ausentes (ex: start_date e end_date em rotas de atendimentos ou channel_id em grupos) ou formato de payload incorreto.`,
            acaoRecomendada: '1. Verifique se os parâmetros de busca ou query string atendem às regras da rota no backendApiService.js.\n2. Em rotas de listagem de atendimentos, envie obrigatoriamente start_date e end_date no formato YYYY-MM-DD.\n3. Inspecione o payload enviado e compare com a documentação do backend.'
          };
        }

        // 401 Unauthorized quando não era esperado
        if (recebido === '401' && esperado !== '401') {
          return {
            categoria: 'RESPOSTA HTTP 401 (UNAUTHORIZED) - FALHA DE AUTENTICAÇÃO NA API',
            icone: '🔒',
            descricao: `A requisição foi rejeitada com HTTP 401 Unauthorized (esperava-se status ${esperado}). O Bearer Token JWT é inválido, expirou ou o header Authorization não foi enviado.`,
            acaoRecomendada: '1. Confirme se api.autenticar() obteve o token antes da chamada.\n2. Verifique se o cabeçalho Authorization: Bearer <token> foi anexado corretamente no getHeaders().\n3. Valide a validade das credenciais de acesso em env.json.'
          };
        }

        // 401 Esperado (RBAC), mas recebeu 200
        if (esperado === '401' && recebido === '200') {
          return {
            categoria: 'FALHA DE SEGURANÇA / RBAC (ROTA PROTEGIDA PERMITIU ACESSO NÃO AUTORIZADO)',
            icone: '🛡️',
            descricao: 'O teste de controle de acesso esperava HTTP 401 Unauthorized ao enviar requisição sem token ou com token adulterado, mas o servidor retornou HTTP 200 OK.',
            acaoRecomendada: '1. Verifique se getHeaders() no backendApiService.js removeu de fato o header Authorization.\n2. Confirme se o endpoint testado é autenticado ou se é uma rota pública da API Pharmacie.'
          };
        }

        // 403 Forbidden
        if (recebido === '403') {
          return {
            categoria: 'RESPOSTA HTTP 403 (FORBIDDEN) - PERMISSÃO INSUFICIENTE NO BACKEND',
            icone: '🚫',
            descricao: `O backend recusou a chamada com HTTP 403 Forbidden (esperava-se status ${esperado}). O usuário autenticado não tem permissão no RBAC para este recurso ou loja.`,
            acaoRecomendada: '1. Verifique se o operador possui o grupo de acesso adequado na base de dados.\n2. Certifique-se de que a loja informada na rota coincide com o store_code do operador autenticado.'
          };
        }

        // 404 Not Found
        if (recebido === '404') {
          return {
            categoria: 'RESPOSTA HTTP 404 (NOT FOUND) - ENDPOINT OU RECURSO NÃO ENCONTRADO',
            icone: '🔍',
            descricao: `O backend retornou HTTP 404 Not Found (esperava-se status ${esperado}). O endpoint da rota ou o identificador do recurso (loja, canal ou atendimento) não existe.`,
            acaoRecomendada: '1. Verifique a grafia e o caminho do endpoint no backendApiService.js.\n2. Certifique-se de que o ID do recurso existe no banco de dados da API Real.'
          };
        }

        // 500 Internal Server Error
        if (recebido === '500') {
          return {
            categoria: 'RESPOSTA HTTP 500 (INTERNAL SERVER ERROR) - CRASH NO BACKEND',
            icone: '💥',
            descricao: `O servidor backend sofreu uma falha interna não tratada (HTTP 500, esperava-se status ${esperado}). Isso indica quebra de query SQL, violação de constraint ou falha no serviço backend.`,
            acaoRecomendada: '1. Verifique se algum filtro exigido pelo banco foi omitido (ex: channel_id na rota /channel-groups).\n2. Inspecione os logs do servidor backend da Pharmacie para identificar a exceção SQL/Node.\n3. Acione o time de backend se a requisição estiver estritamente aderente ao contrato.'
          };
        }

        // Outro status HTTP divergente
        return {
          categoria: `RESPOSTA HTTP ${recebido} - DIVERGÊNCIA DE STATUS DA API`,
          icone: '🌐',
          descricao: `A API retornou código HTTP ${recebido}, enquanto o teste esperava status ${esperado}.`,
          acaoRecomendada: '1. Compare a resposta recebida com o comportamento esperado da rota.\n2. Inspecione o corpo (body) e cabeçalhos retornados na requisição.'
        };
      }

      // Falha de schema / atributos no body da resposta da API
      if (rawMsg.includes('to have property') || rawMsg.includes('to be an array') || rawMsg.includes('to be an object')) {
        const propMatch = rawMsg.match(/to have property ['"`]?([^'"`\s]+)/i);
        const propName = propMatch ? propMatch[1] : 'propriedade esperada';
        return {
          categoria: 'DIVERGÊNCIA DE CONTRATO NO PAYLOAD DA API (JSON SCHEMA)',
          icone: '📋',
          descricao: `O corpo JSON retornado pela API não possui o formato esperado pelo teste (ausência da chave '${propName}').`,
          acaoRecomendada: `1. Inspecione o payload retornado pela API real para verificar o nome correto do campo (ex: 'user_id' vs 'id').\n2. Valide se houve evolução ou alteração no schema da rota no backend.`
        };
      }

      // Falha genérica de cy.request
      if (rawMsg.includes('cy.request() failed')) {
        return {
          categoria: 'FALHA NA REQUISIÇÃO CY.REQUEST (API BACKEND)',
          icone: '🌐',
          descricao: 'O comando cy.request() falhou ao tentar se comunicar com o endpoint do backend.',
          acaoRecomendada: '1. Verifique a URL do backend configurada em env.json (API_URL).\n2. Se o status retornado for parte do cenário de teste, adicione { failOnStatusCode: false } na requisição.'
        };
      }
    }

    // 7. Divergência de Regra de Negócio / Asserção (AssertionError)
    if (
      rawMsg.includes('AssertionError') ||
      rawMsg.includes('expected') && (rawMsg.includes('to equal') || rawMsg.includes('to include') || rawMsg.includes('to match') || rawMsg.includes('to have'))
    ) {
      return {
        categoria: 'DIVERGÊNCIA DE REGRA DE NEGÓCIO / ASSERÇÃO',
        icone: '⚖️',
        descricao: 'O valor exibido na interface ou retornado pelo componente divergiu do valor esperado pelo teste.',
        acaoRecomendada: '1. Compare o valor retornado pela aplicação com a expectativa da regra de negócio.\n2. Verifique se o arquivo `env.json` possui dados de teste consistentes com a base do ambiente (ex: contadores, CNPJ, celular).'
      };
    }

    // 7. Crash ou Exceção Não Tratada da Aplicação Web (Uncaught Exception)
    if (
      rawMsg.includes('The following error originated from your application code') ||
      rawMsg.includes('uncaught:exception')
    ) {
      return {
        categoria: 'CRASH / EXCEÇÃO NO CÓDIGO DA APLICAÇÃO (FRONTEND)',
        icone: '💥',
        descricao: 'A aplicação React disparou uma exceção JavaScript não capturada durante a renderização de um componente.',
        acaoRecomendada: '1. Inspecione o stack trace do erro no console do navegador para identificar a linha no código do Frontend.\n2. Se for um erro benigno de ciclo de vida do React Query já conhecido, registre-o no filtro de exceções em `cypress/support/e2e.js`.'
      };
    }

    // 8. Categoria Genérica / Outros Erros
    return {
      categoria: 'ERRO DE EXECUÇÃO E2E',
      icone: '⚠️',
      descricao: 'O teste falhou durante a execução de um comando Cypress.',
      acaoRecomendada: 'Verifique o print de evidência capturado e o stack trace do Cypress para mais detalhes.'
    };
  }

  /**
   * Gera a estrutura de dados completa da falha para persistência em disco na raiz do projeto.
   * @param {Error} err Objeto de erro
   * @param {object} runnable Metadados do teste
   * @returns {object} Registro estruturado da falha
   */
  criarRegistroFalha(err, runnable) {
    const diagnostico = this.classificarErro(err, runnable);
    const msgLimpa = this.sanitizarMensagem(err.message || '');
    const nomeTeste = runnable ? runnable.title : 'Teste em execução';
    const suitePai = runnable && runnable.parent ? runnable.parent.title : 'Suíte de Testes';
    const specPath = (typeof Cypress !== 'undefined' && Cypress.spec) ? Cypress.spec.relative : (runnable && runnable.file ? runnable.file : 'Spec desconhecida');

    return {
      timestamp: new Date().toISOString(),
      timestampBr: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      spec: specPath,
      suite: suitePai,
      test: nomeTeste,
      categoria: diagnostico.categoria,
      icone: diagnostico.icone,
      descricao: diagnostico.descricao,
      acaoRecomendada: diagnostico.acaoRecomendada,
      detalheTecnico: msgLimpa.substring(0, 1500),
      stack: err.stack ? this.sanitizarMensagem(err.stack).substring(0, 1500) : ''
    };
  }

  /**
   * Gera uma versão em texto estruturado / markdown para o arquivo de log consolidado com todas as falhas.
   * @param {Array<object>} records Lista de registros de falha
   * @returns {string} Texto consolidado formatado
   */
  gerarRelatorioTextoMultiplo(records) {
    if (!Array.isArray(records) || records.length === 0) return '';

    const cabecalhoGeral = [
      '================================================================================',
      ` 🚨 RELATÓRIO CONSOLIDADO DE FALHAS E2E (TOTAL: ${records.length} ${records.length === 1 ? 'FALHA' : 'FALHAS'})`,
      '================================================================================',
      '📋 SUMÁRIO DAS FALHAS:',
      ...records.map((r, i) => `   [${i + 1}] ${r.icone} [${r.categoria}] -> ${r.suite} > "${r.test}" (${r.spec})`),
      '================================================================================',
      ''
    ].join('\n');

    const corpoFalhas = records.map((record, index) => {
      return [
        '--------------------------------------------------------------------------------',
        ` 💥 DETALHE DA FALHA [${index + 1}/${records.length}] - ${record.icone} ${record.categoria}`,
        '--------------------------------------------------------------------------------',
        `📅 DATA/HORA: ${record.timestampBr} (${record.timestamp})`,
        `📁 ARQUIVO SPEC: ${record.spec}`,
        `📌 SUÍTE: ${record.suite}`,
        `🧪 TESTE (IT): "${record.test}"`,
        '',
        `🏷️ CATEGORIA DO ERRO:`,
        `   ${record.categoria}`,
        '',
        `📋 O QUE ACONTECEU:`,
        `   ${record.descricao}`,
        '',
        `💡 AÇÕES RECOMENDADAS PARA RESOLUÇÃO:`,
        `   ${record.acaoRecomendada.replace(/\n/g, '\n   ')}`,
        '',
        `🔍 DETALHE TÉCNICO HIGIENIZADO:`,
        `   ${record.detalheTecnico}`,
        '--------------------------------------------------------------------------------'
      ].join('\n');
    }).join('\n\n');

    return `${cabecalhoGeral}\n${corpoFalhas}\n`;
  }

  /**
   * Gera uma versão em texto estruturado / markdown para o arquivo de log na raiz.
   * @param {object} record Registro de falha
   * @returns {string} Texto formatado
   */
  gerarRelatorioTexto(record) {
    return [
      '================================================================================',
      ` ${record.icone} FALHA DETECTADA NO TESTE E2E (PHARMACIE WEB)`,
      '================================================================================',
      `📅 DATA/HORA: ${record.timestampBr} (${record.timestamp})`,
      `📁 ARQUIVO SPEC: ${record.spec}`,
      `📌 SUÍTE: ${record.suite}`,
      `🧪 TESTE (IT): "${record.test}"`,
      '',
      `🏷️ CATEGORIA DO ERRO:`,
      `   ${record.categoria}`,
      '',
      `📋 O QUE ACONTECEU:`,
      `   ${record.descricao}`,
      '',
      `💡 AÇÕES RECOMENDADAS PARA RESOLUÇÃO:`,
      `   ${record.acaoRecomendada.replace(/\n/g, '\n   ')}`,
      '',
      `🔍 DETALHE TÉCNICO HIGIENIZADO:`,
      `   ${record.detalheTecnico}`,
      '================================================================================',
      ''
    ].join('\n');
  }

  /**
   * Formata e enriquece o erro para exibição destacada no console e nos relatórios.
   * @param {Error} err Objeto de erro original do Cypress
   * @param {object} runnable Metadados do teste em execução
   * @returns {Error} Erro com mensagem formatada
   */
  formatarDiagnostico(err, runnable) {
    const record = this.criarRegistroFalha(err, runnable);

    // Salva o registro no ambiente para gravação no disco durante o hook afterEach
    Cypress.env('CURRENT_FAILURE_RECORD', record);

    const diagnostico = {
      categoria: record.categoria,
      icone: record.icone,
      descricao: record.descricao,
      acaoRecomendada: record.acaoRecomendada
    };

    const banner = this.gerarRelatorioTexto(record);

    // Imprime o diagnóstico de forma destacada no console do Cypress
    console.error(banner);

    // Atualiza a mensagem original para que o Mochawesome exiba o diagnóstico formatado
    err.message = `${diagnostico.icone} [${diagnostico.categoria}] - ${diagnostico.descricao}\n\n` +
                  `💡 Ação Sugerida:\n${diagnostico.acaoRecomendada}\n\n` +
                  `Detalhe Técnico:\n${record.detalheTecnico.substring(0, 400)}`;

    return err;
  }

  /**
   * Extrai um snapshot estruturado do DOM e contexto de tela da aplicação no momento da falha.
   * @param {Document} [doc] Objeto document da aplicação
   * @param {Window} [win] Objeto window da aplicação
   * @param {boolean} [isBackend] Indica se o teste em falha é puramente de backend (sem DOM)
   * @returns {object} Contexto com URL, título, modais abertos, elemento focado e HTML sanitizado
   */
  extrairSnapshotDOM(doc, win, isBackend = false) {
    if (isBackend) {
      const htmlCompleto = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Snapshot de Falha - Teste de Backend (API REST)</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 20px; background: #0f172a; color: #f8fafc; }
    .debug-banner { background: #1e293b; border: 2px solid #3b82f6; border-radius: 8px; padding: 24px; font-family: monospace; font-size: 13px; line-height: 1.8; }
    .debug-banner h3 { margin-top: 0; color: #60a5fa; font-size: 16px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; background: #2563eb; color: #fff; font-weight: bold; font-size: 11px; margin-bottom: 12px; }
    .info-box { background: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 14px; margin-top: 14px; }
    code { background: #334155; padding: 2px 6px; border-radius: 4px; color: #38bdf8; }
  </style>
</head>
<body>
  <div class="debug-banner">
    <span class="badge">🌐 TESTE DE BACKEND / INTEGRAÇÃO (API REAL)</span>
    <h3>DIAGNÓSTICO DE REQUISIÇÃO REST</h3>
    <div><strong>📅 Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}</div>
    <div style="margin-top: 8px;"><strong>ℹ️ Informação:</strong> Este teste é executado diretamente contra a API no Node.js via <code>cy.request()</code>, sem interação com o navegador web ou renderização de elementos no DOM.</div>
    <div class="info-box">
      <strong>💡 Onde inspecionar os dados da falha:</strong><br>
      1. Consulte o arquivo <code>cypress/reports/failures/failures.log</code> para detalhes de código HTTP, parâmetros e stack trace.<br>
      2. No painel interativo do Cypress Open, clique na linha do comando <code>request</code> que falhou para expandir a resposta (status, headers e body).
    </div>
  </div>
</body>
</html>`;

      return {
        url: 'https://api.omnicare.dev.local (API REST)',
        titulo: 'Execução Backend / cy.request',
        modaisAbertos: [],
        elementFocado: 'N/A (cy.request)',
        htmlCompleto
      };
    }

    if (!doc) {
      return {
        url: 'N/A',
        titulo: 'N/A',
        modaisAbertos: [],
        elementFocado: 'N/A',
        htmlCompleto: '<!-- Documento indisponível no momento da falha -->'
      };
    }

    try {
      const url = win && win.location ? win.location.href : 'N/A';
      const titulo = doc.title || 'N/A';
      const modais = [];

      // Identifica modais, gavetas e popovers ativos na tela
      doc.querySelectorAll('div[role="dialog"], aside, [data-testid*="modal"], [data-testid*="drawer"], [class*="_drawer_"]').forEach((el) => {
        if (el.offsetWidth > 0 || el.offsetHeight > 0) {
          const idOuClass = el.getAttribute('data-testid') || el.id || el.className;
          if (idOuClass) modais.push(idOuClass.substring(0, 80));
        }
      });

      const elementFocado = doc.activeElement 
        ? (doc.activeElement.getAttribute('data-testid') || doc.activeElement.id || doc.activeElement.tagName)
        : 'N/A';

      // Sanitiza dados sensíveis (tokens JWT, authorization) do HTML capturado
      let bodyHtml = doc.body ? doc.body.innerHTML : '';
      bodyHtml = this.sanitizarMensagem(bodyHtml);

      const htmlCompleto = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Snapshot DOM na Falha - ${titulo}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 12px; background: #0f172a; color: #f8fafc; }
    .debug-banner { background: #7f1d1d; border: 2px solid #ef4444; border-radius: 8px; padding: 16px; margin-bottom: 20px; font-family: monospace; font-size: 13px; line-height: 1.6; }
    .debug-banner strong { color: #fca5a5; }
    #snapshot-root { border: 1px solid #334155; border-radius: 8px; padding: 16px; background: #1e293b; overflow: auto; max-height: 80vh; }
  </style>
</head>
<body>
  <div class="debug-banner">
    <h3 style="margin-top:0; color:#fee2e2;">🚨 SNAPSHOT DE TELA NO MOMENTO DA FALHA (PHARMACIE WEB)</h3>
    <div><strong>📅 Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}</div>
    <div><strong>🌐 URL:</strong> ${url}</div>
    <div><strong>📌 Título:</strong> ${titulo}</div>
    <div><strong>🗂️ Modais / Drawers Ativos:</strong> ${modais.length > 0 ? modais.join(' | ') : 'Nenhum'}</div>
    <div><strong>🎯 Elemento com Foco:</strong> ${elementFocado}</div>
  </div>
  <div id="snapshot-root">
    ${bodyHtml}
  </div>
</body>
</html>`;

      return {
        url,
        titulo,
        modaisAbertos: modais,
        elementFocado,
        htmlCompleto
      };
    } catch (e) {
      return {
        url: 'N/A',
        titulo: 'N/A',
        modaisAbertos: [],
        elementFocado: 'N/A',
        htmlCompleto: `<!-- Erro ao extrair snapshot: ${e.message} -->`
      };
    }
  }
}

export default new ErrorHandler();
