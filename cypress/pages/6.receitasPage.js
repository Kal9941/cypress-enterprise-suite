// cypress/pages/6.receitasPage.js
// Page Object para a tela de Receitas (Prescrições)

import api from '../services/backendApiService';
const configEnv = require('../../env.json');
import ReceitasMocks from '../mocks/6.receitasMocks';
import laboratoriesData from '../fixtures/6.receitas/laboratories.json';
import pharmaceuticalFormsData from '../fixtures/6.receitas/pharmaceuticalForms.json';

class ReceitasPage {
  elements = {
    // Cabeçalho e Título da tela
    tituloPagina: () => cy.get('h1, h2, header', { timeout: 10000 }).filter(':contains("Receitas"), :contains("receitas")'),

    // Campo de busca / filtro rápido
    inputBusca: () => cy.get('input[placeholder*="buscar" i], input[placeholder*="pesquisar" i], input[type="search"]'),

    // Botão de ação para iniciar/criar nova receita
    btnNovaReceita: () => cy.contains('button', /nova receita|criar receita|adicionar/i),

    // Elemento container ou tabela principal da listagem
    containerListagem: () => cy.get('table, [role="table"], div[class*="_table_"], div[class*="_list_"], div[class*="_container_"]'),

    // -------------------------------------------------------------
    // Cards/seções do formulário real da receita (testids confirmados
    // via cy.salvarSnapshotDom contra app.omnicare.dev.local, 2026-10-07)
    // -------------------------------------------------------------
    conteudoPrincipal: () => cy.get('[data-testid="receita-main-content"]'),
    cardCabecalho: () => cy.get('[data-testid="card-receita-header"]'),
    cardFormula: () => cy.get('[data-testid="card-formula-info"]'),
    cardAbas: () => cy.get('[data-testid="card-receita-tabs"]'),
    cardPacientePrescritor: () => cy.get('[data-testid="card-paciente-prescritor"]'),
    cardEntrega: () => cy.get('[data-testid="card-delivery"]'),
    cardFinanceiro: () => cy.get('[data-testid="card-financeiro"]'),
    rodapeAcoes: () => cy.get('[data-testid="receita-actions-footer"]'),
    // Data de retorno da fórmula ativa no rodapé (front PRs #642/#647, backend#791): <input type="date">, habilitado só com can_edit_return_date (grant 449)
    campoDataRetorno: () => cy.get('[data-testid="prescription-footer-return-date-input"]'),
    // Modal "Tratamento de uso contínuo" (front#629, front PR #647; medido na dev em 2026-11-06): abre depois do Calcular na fórmula de uso contínuo sem data de retorno,
    // pelo botão "Calcular data de retorno" do rodapé e, na loja que exige a data, ao marcar "Concluído" (um por fórmula, "(1 de N)" no título)
    botaoAbrirDataRetorno: () => cy.get('[data-testid="button-open-return-date"]'),
    // Entrega do laboratório da fórmula ativa no rodapé (front#630, front PR #645; medido em 2026-11-06): a data é texto DD/MM/AAAA ("00/00/0000" vazia), a hora é input HH:mm
    dataLaboratorio: () => cy.get('[data-testid="receita-footer-data-laboratorio"]'),
    horaLaboratorio: () => cy.get('[data-testid="receita-footer-hora-laboratorio-input"]'),
    modalUsoContinuo: () => cy.get('[data-testid="continuous-use-dialog"]'),
    posologiaQuantidade: () => cy.get('[data-testid="input-posology-amount"]'),
    posologiaUnidade: (unidade) => cy.get(`[data-testid="button-posology-unit-${unidade}"]`), // hour | day | week | month
    usoContinuoQuantidade: () => cy.get('[data-testid="continuous-use-quantity"]'),
    usoContinuoDias: () => cy.get('[data-testid="continuous-use-days"]'),
    usoContinuoRetorno: () => cy.get('[data-testid="continuous-use-return-date"]'),
    usoContinuoConfirmar: () => cy.get('[data-testid="continuous-use-confirm"]'),
    usoContinuoCancelar: () => cy.get('[data-testid="continuous-use-cancel"]'),
    btnLimpar: () => cy.get('[data-testid="acao-limpar"]'),
    btnDigitalizar: () => cy.get('[data-testid="acao-digitalizar"]'),
    btnGravar: () => cy.get('[data-testid="acao-gravar"]'),
    // Rodapé da receita (front PRs #632/#633, front#628): "Concluído" é <button role="checkbox" aria-checked>; data e hora de entrega ao cliente são <input type="date"> e <input type="time">
    chkConcluido: () => cy.get('[data-testid="valor-total-concluido"]'),
    campoDataEntrega: () => cy.get('[data-testid="input-delivery-date"]'),
    campoHoraEntrega: () => cy.get('[data-testid="valor-total-hora"]'),

    // -------------------------------------------------------------
    // Receita aberta pelo atendimento (overlay) e campos do formulário —
    // testids medidos na UI real (app.omnicare.dev.local, 2026-10-16, Issue front#576)
    // -------------------------------------------------------------
    btnReceitaDoAtendimento: () => cy.get('[data-testid="btn-header-receita"]'),
    overlayReceita: () => cy.get('[data-testid="receita-overlay"]'),
    btnFecharOverlay: () => cy.get('[data-testid="receita-overlay-close"]'),
    // Aviso de descarte do overlay com a Receita suja (X, Esc ou menu lateral): "Há alterações não gravadas nesta receita." (AttendanceReceitaOverlayBars)
    btnContinuarEditandoOverlay: () => cy.get('[data-testid="receita-overlay-keep-editing"]'),
    btnDescartarOverlay: () => cy.get('[data-testid="receita-overlay-discard"]'),
    codigoReceita: () => cy.get('[data-testid="receita-codigo"]'),
    atendimentoDaReceita: () => cy.get('[data-testid="prescription-shortcut-attendance"]'),
    pacienteNome: () => cy.get('[data-testid="pessoa-paciente-nome"]'),
    compradorNome: () => cy.get('[data-testid="pessoa-comprador-nome"]'),
    quantidadeProduto: () => cy.get('[data-testid="formula-produto-quantidade"]'),
    unidadeMedida: () => cy.get('[data-testid="unidade-medida-nome"]'),
    sugestoesUnidade: () => cy.get('[data-testid="unidade-medida-suggestions"]'),
    codigoLaboratorio: () => cy.get('[data-testid="formula-laboratorio-codigo"]'),
    nomeLaboratorio: () => cy.get('[data-testid="formula-laboratorio-nome"]'),
    sugestoesLaboratorio: () => cy.get('[data-testid="laboratorio-suggestions"]'),
    codigoFormaFarmaceutica: () => cy.get('[data-testid="formula-forma-farmaceutica-codigo"]'),
    nomeFormaFarmaceutica: () => cy.get('[data-testid="formula-forma-farmaceutica-nome"]'),
    sugestoesFormaFarmaceutica: () => cy.get('[data-testid="forma-farmaceutica-suggestions"]'),
    totalMultiplo: () => cy.get('[data-testid="formula-total-multiple"]'),
    estoqueBaixa: () => cy.get('[data-testid="formula-estoque-baixa"]'),

    // -------------------------------------------------------------
    // Fórmula acrescentada a uma receita gravada — testids medidos na UI real
    // (app.omnicare.dev.local, 2026-10-16, receita 260800008, Issue front#159)
    // -------------------------------------------------------------
    buscarReceita: () => cy.get('[data-testid="receita-buscar"]'),
    formulaNavigate: () => cy.get('[data-testid="formula-navigate"]'),
    formulaMais: () => cy.get('[data-testid="formula-navigate-increase"]'),
    formulaMenos: () => cy.get('[data-testid="formula-navigate-decrease"]'),
    btnCalcular: () => cy.get('[data-testid="formula-calcular"]'),
    nomeProduto: () => cy.get('[data-testid="formula-produto-nome"]'),
    sugestoesProduto: () => cy.get('[data-testid="formula-produto-suggestions"]'),
    btnAdicionarProduto: () => cy.get('[data-testid="formula-adicionar-produto"]'),
    avisoDoCalculo: () => cy.get('[data-testid="calcular-aviso-modal"]'),
    avisoDoCalculoOk: () => cy.get('[data-testid="calcular-aviso-ok"]'),
    avisoDoCalculoFechar: () => cy.get('[data-testid="calcular-aviso-close"]'),
    // Rodapé do aviso: o testid ainda diz "countdown", mas desde a PR #571 mostra só "Pressione ESC p/ sair", sem contagem
    avisoDoCalculoRodape: () => cy.get('[data-testid="calcular-aviso-countdown"]'),
    btnAumentarQuantidade: () => cy.get('[data-testid="formula-produto-quantidade-increase"]'),
    btnAumentarTotalMultiplo: () => cy.get('[data-testid="formula-total-multiple-increase"]'),
    tabelaDeProdutos: () => cy.get('[data-testid="receita-produtos-table"]'),
    // Aviso de erro (toast de tom crítico) dentro de um contêiner role="alert"; antes vinha em role="status", que hoje fica vazio (medido no DOM real em 2026-11-05)
    avisoDeErro: () => cy.get('[data-testid="toast-critical"]'),

    // -------------------------------------------------------------
    // Aba "Posologia e rótulo" da fórmula — testids medidos na UI real
    // (app.omnicare.dev.local, 2026-10-19, Issue backend#655)
    // -------------------------------------------------------------
    abaPosologia: () => cy.get('[data-testid="tab-posologia"]'),
    posologiaTexto: () => cy.get('[data-testid="posologia-card-posologia-input"]'),
    rotuloTexto: () => cy.get('[data-testid="posologia-card-rotulo-input"]'),
    obsRotuloTexto: () => cy.get('[data-testid="posologia-card-obs-rotulo-input"]'),

    // -------------------------------------------------------------
    // Campo Prescritor do card "Paciente, comprador, prescritor e convênio" — testids medidos na UI real
    // (app.omnicare.dev.local, 2026-10-19, Issue backend#658)
    // -------------------------------------------------------------
    campoPrescritor: () => cy.get('[data-testid="pessoa-prescritor-nome"]'),
    sugestoesDePrescritor: () => cy.get('[data-testid^="pessoa-prescritor-suggestion-"]', { timeout: 15000 }),

    // -------------------------------------------------------------
    // Campo Produto da fórmula — testids medidos na UI real (app.omnicare.dev.local, 2026-10-19, Issue backend#661):
    // cada sugestão é `formula-produto-suggestion-<id do produto>` (o contêiner é `formula-produto-suggestions`, no plural)
    // -------------------------------------------------------------
    sugestoesDeProduto: () => cy.get('[data-testid^="formula-produto-suggestion-"]', { timeout: 15000 }),
    // Uma sugestão da busca de produtos pelo id; os selos (Monitorado, Receituário, Aviso) são <span> sem testid dentro dela (front PR #663)
    sugestaoDeProduto: (id) => cy.get(`[data-testid="formula-produto-suggestion-${id}"]`, { timeout: 15000 }),

    // -------------------------------------------------------------
    // Lista de receitas (/receitas) — testids medidos na UI real (app.omnicare.dev.local, 2026-10-22, Issue front#569/PR #620)
    // -------------------------------------------------------------
    tituloDaPagina: () => cy.get('[data-testid="page-title"]'),
    paginaDaLista: () => cy.get('[data-testid="prescriptions-page"]'),
    btnNovaReceitaDaLista: () => cy.get('[data-testid="button-new-prescription"]'),
    buscaDaLista: () => cy.get('[data-testid="input-search-prescriptions"]'),
    btnOrdemDaLista: () => cy.get('[data-testid="button-sort-prescriptions"]'),
    chipDaLista: (nome) => cy.get(`[data-testid="filter-chip-${nome}"]`),
    tabelaDaLista: () => cy.get('[data-testid="table-prescriptions"]'),
    cabecalhosDaLista: () => cy.get('[data-testid="table-prescriptions"] th'),
    contagemDaLista: () => cy.get('[data-testid="prescriptions-count"]'),
    linhasDaLista: () => cy.get('[data-testid^="row-prescription-"]'),
    linksDaLista: () => cy.get('[data-testid^="link-prescription-"]'),
    vazioDaLista: () => cy.get('[data-testid="prescriptions-empty"]'),
    btnLimparFiltros: () => cy.get('[data-testid="button-clear-prescription-filters"]'),
    listaSemAcesso: () => cy.get('[data-testid="prescriptions-denied"]'),
    listaCarregando: () => cy.get('[data-testid="prescriptions-loading"]'),
    // Estado de erro da lista (medido em mock em 2026-11-06): "Não foi possível carregar as receitas." e o botão "Tentar de novo"
    erroDaLista: () => cy.get('[data-testid="prescriptions-error"]'),
    btnTentarDeNovoLista: () => cy.get('[data-testid="button-retry-prescriptions"]'),
    avisoDeLimiteDaLista: () => cy.get('[data-testid="prescriptions-limit-reached"]'),
    areaDeRolagemDaLista: () => cy.get('main'),

    // Menu lateral e diálogo "Sair sem salvar?" da receita em edição (Issue front#569/PR #620)
    menuReceitas: () => cy.get('[data-testid="sidebar-item-receitas"]'),
    menuClientes: () => cy.get('[data-testid="sidebar-item-clientes"]'),
    dialogoSairSemSalvar: () => cy.get('[data-testid="modal-prescription-unsaved-changes"]'),
    btnContinuarEditando: () => cy.get('[data-testid="modal-prescription-unsaved-changes-cancel"]'),
    btnSairSemSalvar: () => cy.get('[data-testid="modal-prescription-unsaved-changes-confirm"]'),
    multiploDaFormula: () => cy.get('[data-testid="formula-multiple"]'),
    // Aviso da receita vendida sem a permissão 595 ("Receita já vendida: alterar a fórmula exige a permissão 595…", front#397/PR #664, medido em 2026-11-06)
    avisoReceitaVendida: () => cy.get('[data-testid="receita-paid-formula-notice"]'),
    btnAumentarMultiplo: () => cy.get('[data-testid="formula-multiple-increase"]'),
    btnAlternarTema: () => cy.get('button[aria-label="Alternar tema"]'),

    // Aba Rastreabilidade (processos de manipulação) e convênio, gateados por capability (Issue front#570/PR #592): medidos na UI real em 2026-10-22.
    // O Múltiplo é `multiploDaFormula` e o QVD é `totalMultiplo` ("Total múltiplo", mostra o `qvd` da fórmula).
    abaRastreabilidade: () => cy.get('[data-testid="tab-rastreabilidade"]'),
    painelRastreabilidade: () => cy.get('[data-testid="tabpanel-rastreabilidade"]'),
    carregandoRastreabilidade: () => cy.get('[data-testid="receita-rastreabilidade-loading"]'),
    tabelaRastreabilidade: () => cy.get('[data-testid="receita-rastreabilidade-table"]'),
    btnEditarProcesso: (idDoProcesso) => cy.get(`[data-testid="receita-rastreabilidade-editar-${idDoProcesso}"]`),
    botoesEditarProcesso: () => cy.get('[data-testid^="receita-rastreabilidade-editar-"]'),
    convenioNome: () => cy.get('[data-testid="pessoa-convenio-nome"]'),
    convenioBuscar: () => cy.get('[data-testid="pessoa-convenio-buscar"]'),
  };

  /**
   * Navega para a lista de receitas (/receitas): desde a lista de receitas recentes do front, a rota raiz não abre mais o formulário.
   */
  visitar() {
    cy.visit('/receitas', { failOnStatusCode: false });
  }

  /**
   * Navega direto para o formulário de receita nova (/receitas/nova), medido na UI real em 2026-10-22: é o destino do botão "Nova receita" da lista.
   */
  visitarNova() {
    cy.visit('/receitas/nova', { failOnStatusCode: false });
  }

  /**
   * Abre o formulário de receita nova e espera o formulário da fórmula (campo Quantidade) ficar utilizável.
   */
  abrirFormulario() {
    this.visitarNova();
    cy.get('[data-testid="formula-produto-quantidade"]', { timeout: 30000 }).should('be.visible');
  }

  /**
   * Abre a Receita pelo botão do painel do atendimento já aberto (overlay "Receita do atendimento").
   */
  abrirReceitaDoAtendimento() {
    this.elements.btnReceitaDoAtendimento().should('be.visible').click();
    this.elements.conteudoPrincipal().should('exist');
  }

  /**
   * Prova que o aviso do Calcular continua aberto durante `milissegundos` de relógio real, sem espera estática: a asserção repete até o tempo passar e falha se o aviso
   * fechar antes (o `cy.get` não o encontra mais). O início é marcado dentro de `cy.then`, na hora em que o comando roda, e não quando a fila de comandos é montada.
   */
  confirmarAvisoAbertoPor(milissegundos) {
    let inicio = 0;
    cy.then(() => { inicio = Date.now(); });
    cy.get('[data-testid="calcular-aviso-modal"]', { timeout: milissegundos + 5000 }).should(($aviso) => {
      expect($aviso, 'aviso do Calcular aberto').to.have.length(1);
      expect(Date.now() - inicio, `tempo de relógio com o aviso aberto (ms)`).to.be.gte(milissegundos);
    });
  }

  /**
   * Digita num campo numérico da fórmula (Quantidade, Múltiplo ou QVD) e sai dele clicando no campo Laboratório. É essa saída que confirma o rascunho do Stepper e aplica
   * o teto: o `blur()` do Cypress não confirma (medido na UI real em 2026-10-26), o Enter e o clique em outro campo sim.
   */
  digitarNoStepperESair(elemento, texto) {
    elemento().click().type(`{selectall}${texto}`);
    this.elements.nomeLaboratorio().click();
  }

  /**
   * Digita no campo Quantidade substituindo o conteúdo atual (letras movem o foco para a Unidade).
   */
  digitarQuantidade(texto) {
    this.elements.quantidadeProduto().click().type(`{selectall}${texto}`);
  }

  /**
   * Simula a colagem de um texto por cima do conteúdo do campo Quantidade: um único evento de entrada com o valor
   * inteiro (o `type` do Cypress digita tecla a tecla e não exercita o caminho de colar).
   */
  colarNaQuantidade(texto) {
    this.elements.quantidadeProduto().focus().then(($el) => {
      const el = $el[0];
      const setter = Object.getOwnPropertyDescriptor(el.ownerDocument.defaultView.HTMLInputElement.prototype, 'value').set;
      setter.call(el, texto);
      el.dispatchEvent(new el.ownerDocument.defaultView.Event('input', { bubbles: true }));
    });
  }

  /**
   * Esvazia o campo Unidade para que a asserção prove que a sigla chegou até ele (o campo nasce com "mg").
   */
  limparUnidade() {
    this.elements.unidadeMedida().clear();
  }

  /**
   * Digita um código (ou esvazia o campo, com texto vazio) no código do laboratório/setor, sem confirmar.
   */
  digitarCodigoLaboratorio(codigo) {
    this.elements.codigoLaboratorio().click().type('{selectall}{backspace}');
    if (codigo !== '') this.elements.codigoLaboratorio().type(String(codigo));
  }

  /**
   * Digita um código (ou esvazia o campo, com texto vazio) no código da forma farmacêutica, sem confirmar.
   */
  digitarCodigoFormaFarmaceutica(codigo) {
    this.elements.codigoFormaFarmaceutica().click().type('{selectall}{backspace}');
    if (codigo !== '') this.elements.codigoFormaFarmaceutica().type(String(codigo));
  }

  /**
   * Pressiona Tab no campo em foco como o navegador: dispara o keydown cancelável que o formulário observa (o código de laboratório/forma
   * trata Tab como Enter: resolve o código e, se o front chamar preventDefault, ele mesmo decide para onde vai o foco) e, quando o front
   * NÃO cancela o evento, executa a ação padrão do Tab: o foco vai para o próximo elemento focável, na ordem do documento.
   * Não usa `cy.press`: no Chrome 155 headless com o Cypress 15.20 ele trava o runner sem timeout (reproduzido em 2026-10-16 num spec
   * mínimo de 3 testes, com e sem mock); o keydown sintético passa 3 de 3 e o processo termina normalmente.
   */
  pressionarTab() {
    cy.focused().then(($el) => {
      const el = $el[0];
      const doc = el.ownerDocument;
      const evento = new doc.defaultView.KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', keyCode: 9, which: 9, bubbles: true, cancelable: true });
      const semTratamento = el.dispatchEvent(evento);
      if (semTratamento) {
        const focaveis = Array.from(doc.querySelectorAll('input, button, select, textarea, a[href], [tabindex]'))
          .filter((e) => !e.disabled && e.tabIndex >= 0 && e.offsetParent !== null);
        const proximo = focaveis[focaveis.indexOf(el) + 1];
        if (proximo) proximo.focus();
      }
    });
  }

  /**
   * Abre a lista de receitas e espera a 1ª página chegar (a busca à API é a espera: o alias vem de ReceitasMocks.interceptPrescriptionsSearchApi).
   */
  abrirLista() {
    this.visitar();
    this.esperarLista();
    this.elements.linhasDaLista().should('have.length.greaterThan', 0);
  }

  /**
   * Espera a próxima resposta de GET /prescriptions/search e a tela refletir o total dela: a contagem "N receitas" com N = pagination.total,
   * ou o estado vazio quando o total é 0. Devolve o corpo da resposta (items, pagination e summary).
   */
  esperarLista() {
    return cy.wait('@getPrescriptionsSearchApi').then((interceptacao) => {
      const corpo = interceptacao.response.body;
      const total = corpo.pagination.total;
      this.elements.paginaDaLista().should(($pagina) => {
        const contagem = $pagina.find('[data-testid="prescriptions-count"]');
        const vazio = $pagina.find('[data-testid="prescriptions-empty"]');
        const telaEmDia = total === 0 ? vazio.length === 1 : contagem.length === 1 && Number(contagem.text().replace(/\D/g, '')) === total;
        expect(telaEmDia, `A tela mostra o total ${total} da resposta`).to.eq(true);
      });
      return cy.wrap(corpo);
    });
  }

  /**
   * Número de um texto como "1.973 receitas" ou "Todos 1973" (só os dígitos).
   */
  paraNumero(texto) {
    return Number(String(texto).replace(/\D/g, ''));
  }

  /**
   * Texto sem acento e em minúsculas, para comparar com o termo da busca.
   */
  semAcento(texto) {
    return String(texto || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  }

  /**
   * "DD/MM/AAAA" → número AAAAMMDD, para comparar a ordem das linhas.
   */
  dataParaNumero(texto) {
    const [dia, mes, ano] = String(texto).split('/');
    return Number(`${ano}${mes}${dia}`);
  }

  /**
   * Células de cada linha da lista, em ordem: código, cliente, prescritor, tipo, emissão, status e valor total.
   */
  textosDasLinhas() {
    return this.elements.linhasDaLista().then(($linhas) => $linhas.toArray().map((tr) => Array.from(tr.children).map((td) => td.innerText.replace(/\s+/g, ' ').trim())));
  }

  /**
   * Número de cada chip (Todos, Humano, Animal e os 4 status), mais o chip aceso: { all, human, animal, open, ... , ativos: [...] }.
   */
  numerosDosChips() {
    return cy.get('[data-testid^="filter-chip-"]').then(($chips) => {
      const numeros = { ativos: [] };
      $chips.toArray().forEach((chip) => {
        const nome = chip.getAttribute('data-testid').replace('filter-chip-', '');
        numeros[nome] = this.paraNumero(chip.innerText);
        if (chip.getAttribute('aria-pressed') === 'true') numeros.ativos.push(nome);
      });
      return numeros;
    });
  }

  /**
   * Digita na busca da lista e espera a resposta da API (o debounce de 300 ms junta as teclas numa chamada só).
   */
  buscarNaLista(termo) {
    this.elements.buscaDaLista().clear().type(termo);
    return this.esperarLista();
  }

  /**
   * Clica num chip da lista e espera a resposta da API.
   */
  clicarNoChip(nome) {
    this.elements.chipDaLista(nome).click();
    return this.esperarLista();
  }

  /**
   * Rola a lista até o fim, página a página, até ela parar no teto de linhas (a cada rolagem a lista carrega mais 20).
   * O gatilho do carregamento (um IntersectionObserver no rodapé da lista) reage quando o rodapé ENTRA na tela: uma rolagem logo depois da 1ª
   * renderização, ou feita enquanto a página anterior ainda carrega, pode não disparar nada (achado 2026-10-22: a lista ficou em 20 linhas
   * com a rolagem imediata). Como um usuário, quando a lista não cresce o método sobe ao topo, espera um instante e desce de novo; desiste
   * depois de 8 tentativas sem crescer.
   * Para quando a lista chega a `limite` linhas OU quando o aviso de limite aparece: a paginação é por deslocamento e a lista é ordenada pelas mais
   * novas, então uma receita criada por outra sessão durante a rolagem empurra um item para a página seguinte, o front descarta a repetição e a
   * lista fecha o teto com algumas linhas a menos (medido em 2026-10-23: 3 receitas criadas no meio da rolagem deram 397 linhas; no CI os outros jobs criam receitas em paralelo).
   */
  rolarListaAteOLimite(limite = 400) {
    const rolar = (tentativasSemCrescer = 0) => this.elements.linhasDaLista().then(($linhas) => {
      const antes = $linhas.length;
      const avisoDeLimiteNaTela = Cypress.$('[data-testid="prescriptions-limit-reached"]', $linhas[0].ownerDocument).length > 0;
      if (antes >= limite || avisoDeLimiteNaTela) return;
      expect(tentativasSemCrescer, `A lista parou de crescer em ${antes} linhas depois de rolar ${tentativasSemCrescer} vezes`).to.be.lessThan(8);
      if (tentativasSemCrescer > 0) {
        this.elements.areaDeRolagemDaLista().scrollTo('top', { ensureScrollable: false });
        cy.wait(300);
      }
      this.elements.areaDeRolagemDaLista().scrollTo('bottom', { ensureScrollable: false });
      cy.wait(700);
      this.elements.linhasDaLista().then(($depois) => rolar($depois.length > antes ? 0 : tentativasSemCrescer + 1));
    });
    rolar();
  }

  /**
   * Cor de texto do selo de status da 1ª linha, ex.: "rgb(51, 123, 168)".
   */
  corDoSeloDeStatus() {
    return this.elements.linhasDaLista().first().find('td').eq(5).then(($td) => {
      const selo = $td[0].firstElementChild || $td[0];
      return getComputedStyle(selo).color;
    });
  }

  /**
   * Classifica uma cor "rgb(r, g, b)" em azul, roxo, verde ou cinza (a família de cor do selo, que vale nos dois temas).
   */
  familiaDaCor(cor) {
    const [r, g, b] = cor.match(/\d+/g).map(Number);
    if (Math.max(r, g, b) - Math.min(r, g, b) <= 30) return 'cinza';
    if (g < r && g < b) return 'roxo';
    if (g >= r && g >= b) return 'verde';
    return 'azul';
  }

  /**
   * Abre uma receita já gravada pela tela de Receitas: digita o código no campo da receita e clica em Buscar; espera o stepper "Nº fórmula" na 1ª fórmula.
   */
  abrirReceitaGravada(codigo) {
    this.visitarNova();
    this.elements.codigoReceita().should('be.visible').type(String(codigo));
    this.elements.buscarReceita().click();
    this.elements.formulaNavigate().should('have.value', '1');
  }

  /**
   * Clica na seta ↑ do "Nº fórmula" e confere o número que o stepper passa a mostrar.
   */
  irParaFormulaSeguinte(numeroEsperado) {
    this.elements.formulaMais().should('not.be.disabled').click();
    this.elements.formulaNavigate().should('have.value', String(numeroEsperado));
  }

  /**
   * Preenche a fórmula acrescentada: escolhe o 1º laboratório e a 1ª forma que a busca devolve, procura o produto pelo nome, escolhe a sugestão com
   * esse nome e adiciona com a quantidade informada.
   */
  preencherFormulaNova({ nomeDoProduto, termoDoProduto = 'acid', quantidade = '1' }) {
    this.elements.nomeLaboratorio().click().type('a');
    cy.get('[data-testid^="laboratorio-suggestion-"]').first().click();
    this.elements.nomeFormaFarmaceutica().click().type('a');
    cy.get('[data-testid^="forma-farmaceutica-suggestion-"]').first().click();
    this.elements.nomeProduto().click().type(termoDoProduto);
    this.elements.sugestoesProduto().contains(nomeDoProduto).click();
    this.elements.quantidadeProduto().click().type(`{selectall}${quantidade}`);
    this.elements.btnAdicionarProduto().click();
  }

  /**
   * Cria pela API real uma receita temporária (receita não tem DELETE: 1 por chamada, no tenant dev) com 1 fórmula que já nasce com os textos
   * informados (`posology`, `label_text`, `label_observation`). Laboratório e forma saem de obterMassaDeCodigos(); cliente = DEFAULT_CLIENT_NAME do env.json;
   * prescritor 18780 como nos contexts de receita do 0-C.backend-receitas. Devolve o código da receita.
   * @returns {Cypress.Chainable<number>}
   */
  /**
   * Descobre na API real um produto que exige receituário (data ou número da notificação) e um que não exige, varrendo termos de classes de medicamento
   * (front#331, backend#452): nunca um id fixo. Devolve { controlado, comum } com id, nome e os dois booleanos; um dos dois pode faltar se a busca não trouxer.
   */
  descobrirProdutosPorReceituario(termos = ['clonazepam', 'diazepam', 'alprazolam', 'zolpidem', 'sibutramina', 'fluoxetina', 'sertralina', 'passiflora']) {
    const achados = {};
    const exige = (prod) => prod.prescription_date_required === true || prod.notification_number_required === true;
    return cy.wrap(termos).each((termo) => {
      if (achados.controlado && achados.comum) return;
      this.buscarProdutosNaApi(termo).then((itens) => {
        (itens || []).forEach((prod) => {
          if (!achados.controlado && exige(prod)) achados.controlado = { termo, ...prod };
          if (!achados.comum && prod.prescription_date_required === false && prod.notification_number_required === false) achados.comum = { termo, ...prod };
        });
      });
    }).then(() => achados);
  }

  /**
   * Cria pela API uma receita temporária com uma fórmula e um produto (receita não tem DELETE; 1 por rodada) e devolve o código da receita.
   */
  criarReceitaTemporariaComProduto(produto) {
    return this.criarReceitaTemporariaComTextos({}).then((receitaId) => api.obterUsuarioLogado().then((resMe) => {
      const storeId = resMe.body.store_code || resMe.body.store_id;
      return api.obterDetalhePrescricao(storeId, receitaId).then((resDet) => {
        const formulaId = resDet.body.formulas[0].id;
        return api.adicionarProdutoFormula(storeId, receitaId, formulaId, { product_id: produto.id, quantity: 1, unit: produto.unit || 'mg' }).then((resP) => {
          expect(resP.status, 'Status do produto da fórmula temporária').to.be.oneOf([200, 201]);
          return receitaId;
        });
      });
    }));
  }

  /**
   * Cria pela API uma receita temporária pronta para concluir (front#628): fórmula com data de retorno (a loja exige, backend#791), um produto e calculada.
   * Receita não tem DELETE; 1 por rodada. O produto 1004866 é o mesmo do `0-C` (cadastro estável do tenant).
   */
  criarReceitaTemporariaProntaParaConcluir() {
    return this.criarReceitaTemporariaComTextos({ return_date: api.dataDeRetornoFutura() }).then((receitaId) => api.obterUsuarioLogado().then((resMe) => {
      const storeId = resMe.body.store_code || resMe.body.store_id;
      return api.obterDetalhePrescricao(storeId, receitaId).then((resDet) => {
        const formulaId = resDet.body.formulas[0].id;
        return api.adicionarProdutoFormula(storeId, receitaId, formulaId, { product_id: 1004866, quantity: 250.0, unit: 'mg' })
          .then(() => api.calcularFormula(storeId, receitaId, formulaId))
          .then((resCalc) => {
            expect(resCalc.status, 'Cálculo da fórmula da receita temporária').to.eq(200);
            return receitaId;
          });
      });
    }));
  }

  /**
   * Preenche um input controlado pelo React sem clicar nele: o campo de data/hora chama showPicker() no clique, que exige gesto real do usuário
   * e dispara uncaught exception no Cypress (medido em 2026-11-06, front#628). Usa o setter nativo do value e os eventos que o React escuta.
   */
  preencherCampoSemClique(elemento, valor) {
    return elemento.scrollIntoView().then(($el) => {
      const el = $el[0];
      const setter = Object.getOwnPropertyDescriptor(el.ownerDocument.defaultView.HTMLInputElement.prototype, "value").set;
      setter.call(el, valor);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  /**
   * Preenche a data (AAAA-MM-DD) e a hora (HH:mm) de entrega do rodapé e confere o que ficou nos campos.
   */
  preencherEntrega(data, hora) {
    if (data !== undefined) this.preencherCampoSemClique(this.elements.campoDataEntrega(), data);
    if (hora !== undefined) this.preencherCampoSemClique(this.elements.campoHoraEntrega(), hora);
    if (data !== undefined) this.elements.campoDataEntrega().should("have.value", data);
    if (hora !== undefined) this.elements.campoHoraEntrega().should("have.value", hora);
  }

  /**
   * Lê o rodapé de entrega da receita aberta: { concluido, data, hora }.
   */
  lerRodapeDeEntrega() {
    const rodape = {};
    return this.elements.chkConcluido().invoke('attr', 'aria-checked').then((v) => { rodape.concluido = v === 'true'; })
      .then(() => this.elements.campoDataEntrega().invoke('val')).then((v) => { rodape.data = v; })
      .then(() => this.elements.campoHoraEntrega().invoke('val')).then((v) => { rodape.hora = v; })
      .then(() => rodape);
  }

  criarReceitaTemporariaComTextos(textos) {
    return api.autenticar().then(() => api.obterUsuarioLogado()).then((resMe) => {
      const storeId = resMe.body.store_code || resMe.body.store_id;
      return this.obterMassaDeCodigos().then(({ lab, forma }) => api.buscarClientes(storeId, configEnv.DEFAULT_CLIENT_NAME).then((resCli) => {
        const cliente = (resCli.body && (resCli.body.items || resCli.body))[0];
        expect(cliente && cliente.id, '🔒 DEFAULT_CLIENT_NAME não achou cliente (massa)').to.be.ok;
        return api.criarPrescricao(storeId, {
          prescription_type: 'human',
          status: 0,
          sale_type: 1,
          patient_id: cliente.id,
          patient_name: cliente.name,
          buyer_id: cliente.id,
          buyer_name: cliente.name,
          prescriber_id: 18780,
          pickup_store_id: storeId,
        }).then((resPresc) => {
          expect(resPresc.status, 'Status da criação da receita temporária').to.be.oneOf([200, 201]);
          const receitaId = resPresc.body.id || resPresc.body.prescription_id;
          expect(receitaId, 'ID da receita temporária').to.be.ok;
          return api.criarFormulaPrescricao(storeId, receitaId, {
            formula_number: 1, pharmaceutical_form_id: forma.id, lab_id: lab.id, qvd: 30, multiplier: 1, ...textos,
          }).then((resFormula) => {
            expect(resFormula.status, 'Status da criação da fórmula temporária com texto').to.be.oneOf([200, 201]);
            return receitaId;
          });
        });
      }));
    });
  }

  /**
   * Cria pela API uma receita temporária com `quantas` fórmulas de uso contínuo (QVD 30 × múltiplo 1, produto 1004866, cujo cadastro é de uso contínuo,
   * medido em 2026-11-06), sem data de retorno; com `calcular`, calcula todas. Receita não tem DELETE: 1 por chamada. Front#629.
   */
  criarReceitaTemporariaUsoContinuo(quantas = 1, calcular = false) {
    return this.criarReceitaTemporariaComTextos({}).then((receitaId) => api.obterUsuarioLogado().then((resMe) => {
      const storeId = resMe.body.store_code || resMe.body.store_id;
      return api.obterDetalhePrescricao(storeId, receitaId).then((resDet) => {
        const primeira = resDet.body.formulas[0];
        const comProduto = (formulaId) => api.adicionarProdutoFormula(storeId, receitaId, formulaId, { product_id: 1004866, quantity: 250.0, unit: 'mg' }).then((resP) => {
          expect(resP.status, 'Produto de uso contínuo na fórmula temporária').to.be.oneOf([200, 201]);
          return formulaId;
        });
        const ids = [primeira.id];
        let cadeia = comProduto(primeira.id);
        for (let n = 2; n <= quantas; n += 1) {
          cadeia = cadeia.then(() => api.criarFormulaPrescricao(storeId, receitaId, { formula_number: n, pharmaceutical_form_id: primeira.pharmaceutical_form_id, lab_id: primeira.lab_id, qvd: 30, multiplier: 1 }))
            .then((resF) => { ids.push(resF.body.id); return comProduto(resF.body.id); });
        }
        if (calcular) {
          cadeia = cadeia.then(() => ids.reduce((c, id) => c.then(() => api.calcularFormula(storeId, receitaId, id).then((resC) => {
            expect(resC.status, `Cálculo da fórmula ${id}`).to.eq(200);
          })), cy.wrap(null)));
        }
        return cadeia.then(() => receitaId);
      });
    }));
  }

  /**
   * Clica em Calcular e espera o fim do cálculo da fórmula de uso contínuo: o aviso do motor (observações dos produtos, fechado aqui) ou direto o modal
   * de uso contínuo. Front#629: o modal abre depois do aviso.
   */
  calcularFormulaDeUsoContinuo() {
    ReceitasMocks.interceptCalculateFormulaApi();
    this.elements.btnCalcular().click();
    cy.wait('@calculateFormulaApi', { timeout: 30000 }).its('response.statusCode').should('eq', 200);
    // O aviso do motor aparece logo depois da resposta, quando o produto tem observações: espera até 3 s e fecha, sem falhar se não vier
    const fecharAviso = (tentativa = 0) => cy.get('body').then(($b) => {
      if ($b.find('[data-testid="calcular-aviso-ok"]').length) return this.elements.avisoDoCalculoOk().click();
      if (tentativa >= 12) return null;
      cy.wait(250);
      return fecharAviso(tentativa + 1);
    });
    fecharAviso();
  }

  /**
   * Digita o termo no campo Prescritor (o card fica abaixo da dobra: rola até ele antes) e espera ao menos uma sugestão.
   * As sugestões vêm do servidor a cada tecla; para provar a lista final use esperarSugestoesDePrescritor().
   */
  digitarNoPrescritor(termo) {
    this.elements.campoPrescritor().scrollIntoView({ duration: 300 }).click().type(`{selectall}${termo}`, { delay: 30 });
    this.elements.sugestoesDePrescritor().should('have.length.greaterThan', 0);
  }

  /**
   * Espera (com nova tentativa) as sugestões abertas do campo Prescritor ficarem iguais, na mesma ordem, aos ids esperados.
   * Cada sugestão é `pessoa-prescritor-suggestion-<código do prescritor>`, com o nome e o código como texto.
   */
  esperarSugestoesDePrescritor(idsEsperados) {
    this.elements.sugestoesDePrescritor().should(($itens) => {
      const ids = [...$itens].map((el) => Number(el.getAttribute('data-testid').replace('pessoa-prescritor-suggestion-', '')));
      expect(ids, 'códigos dos prescritores sugeridos, na ordem da tela').to.deep.eq(idsEsperados);
    });
  }

  /**
   * Busca prescritores pela API real: a ordem que o servidor devolve é a referência do que a tela deve listar.
   * @returns {Cypress.Chainable<Array<{id:number,name:string,council:string,council_number:string,council_uf:string}>>}
   */
  buscarPrescritoresNaApi(termo) {
    return api.autenticar().then(() => api.obterUsuarioLogado()).then((resMe) => {
      const storeId = resMe.body.store_code || resMe.body.store_id;
      return api.buscarPrescritores(storeId, termo).then((res) => {
        expect(res.status, `Status da busca de prescritores por "${termo}"`).to.eq(200);
        return res.body.items;
      });
    });
  }

  /**
   * Digita o termo no campo Produto da fórmula (rola até ele) e espera ao menos uma sugestão. As sugestões vêm do servidor a cada tecla;
   * para provar a lista final use esperarSugestoesDeProduto().
   */
  digitarNoProduto(termo) {
    this.elements.nomeProduto().scrollIntoView({ duration: 300 }).click().type(`{selectall}${termo}`, { delay: 30 });
    this.elements.sugestoesDeProduto().should('have.length.greaterThan', 0);
  }

  /**
   * Espera (com nova tentativa) as sugestões de produto ficarem com exatamente os ids esperados. A ordem não é comparada: a busca não a promete para esta tela.
   */
  esperarSugestoesDeProduto(idsEsperados) {
    this.elements.sugestoesDeProduto().should(($itens) => {
      const ids = [...$itens].map((el) => Number(el.getAttribute('data-testid').replace('formula-produto-suggestion-', ''))).sort((a, b) => a - b);
      expect(ids, 'ids dos produtos sugeridos na tela').to.deep.eq([...idsEsperados].sort((a, b) => a - b));
    });
  }

  /**
   * Busca produtos pela API real como o front faz (mode=containing, uso humano): a resposta do servidor é a referência do que a tela deve listar.
   * @returns {Cypress.Chainable<Array<{id:number,name:string}>>}
   */
  buscarProdutosNaApi(termo) {
    return api.autenticar().then(() => api.obterUsuarioLogado()).then((resMe) => {
      const storeId = resMe.body.store_code || resMe.body.store_id;
      return api.listarProdutos(storeId, { usage: 'human', mode: 'containing', q: termo }).then((res) => {
        expect(res.status, `Status da busca de produtos por "${termo}"`).to.eq(200);
        return res.body.items;
      });
    });
  }

  /**
   * Devolve um laboratório e uma forma farmacêutica dele que existem de verdade, para digitar os códigos.
   * Mock: o primeiro laboratório da fixture (medida na API real) que tem forma. API real: percorre os
   * laboratórios da loja e usa o primeiro com forma (a rota de formas só lista com `q`, e os códigos de forma
   * são globais, não por laboratório) — nunca um código fixo, para valer com qualquer tenant.
   * @returns {Cypress.Chainable<{lab: {id:number,name:string}, forma: {id:number,name:string}}>}
   */
  obterMassaDeCodigos() {
    if (ReceitasMocks.isMockEnabled()) {
      const lab = laboratoriesData.items.find((l) => (pharmaceuticalFormsData[l.id] || []).length > 0);
      return cy.wrap({ lab, forma: pharmaceuticalFormsData[lab.id][0] });
    }
    return api.autenticar().then(() => api.obterUsuarioLogado()).then((resMe) => {
      const storeId = resMe.body.store_code || resMe.body.store_id;
      return api.get(`/laboratories`).then((resLabs) => {
        expect(resLabs.status, 'Status da listagem de laboratórios').to.eq(200);
        const labs = resLabs.body.items;
        const procurar = (i) => {
          if (i >= labs.length) return cy.wrap(null);
          return api.get(`/laboratories/${labs[i].id}/pharmaceutical-forms`, { q: 'a' }).then((resFormas) => {
            const formas = (resFormas.body && resFormas.body.items) || [];
            return formas.length > 0 ? { lab: labs[i], forma: formas[0] } : procurar(i + 1);
          });
        };
        return procurar(0).then((massa) => {
          expect(massa, '🔒 Nenhum laboratório com forma farmacêutica na loja (massa)').to.not.be.null;
          return massa;
        });
      });
    });
  }
}

export default new ReceitasPage();
