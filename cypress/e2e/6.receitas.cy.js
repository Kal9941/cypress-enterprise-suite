// cypress/e2e/6.receitas.cy.js
// Suíte de testes E2E para o módulo de Receitas (Prescrições)

import ReceitasPage from '../pages/6.receitasPage';
import api from '../services/backendApiService';
import ReceitasMocks from '../mocks/6.receitasMocks';
import productsData from '../fixtures/6.receitas/products.json';
import AtendimentosPage from '../pages/5.atendimentosPage';

describe('6. Receitas - Gestão e Validações', () => {

  beforeEach(() => {
    // 1. Efetua login para garantir sessão ativa
    cy.login();

    // 2. Registra interceptações e mocks de receitas caso esteja em modo mock
    const isMockMode = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';
    if (isMockMode) {
      ReceitasMocks.interceptPrescriptionCapabilitiesApi();
      ReceitasMocks.interceptRumTelemetry();
    }
  });

  it('0.1 Deve acessar a página de receitas com sucesso', () => {
    // Arrange & Act
    ReceitasPage.visitar();

    // Assert
    cy.url().should('include', '/receitas');
    ReceitasPage.elements.tituloPagina().should('be.visible');
  });

  it('0.2 deve exibir todos os cards e ações principais do formulário de receita ao carregar a tela', () => {
    // Arrange & Act
    ReceitasPage.visitarNova();

    // Assert: container raiz e os 5 cards principais do formulário — página longa de rolagem
    // única, cada card exige scrollIntoView antes do should (AGENTS.md §3.5, achado real
    // 2026-10-07: overflow do container clipa cards fora da viewport inicial).
    ReceitasPage.elements.conteudoPrincipal().should('be.visible');
    ReceitasPage.elements.cardCabecalho().scrollIntoView({ duration: 300 }).should('be.visible');
    ReceitasPage.elements.cardFormula().scrollIntoView({ duration: 300 }).should('be.visible');
    ReceitasPage.elements.cardAbas().scrollIntoView({ duration: 300 }).should('be.visible');
    ReceitasPage.elements.cardPacientePrescritor().scrollIntoView({ duration: 300 }).should('be.visible');
    ReceitasPage.elements.cardEntrega().scrollIntoView({ duration: 300 }).should('be.visible');
    ReceitasPage.elements.cardFinanceiro().scrollIntoView({ duration: 300 }).should('be.visible');

    // Assert: rodapé de ações
    ReceitasPage.elements.rodapeAcoes().scrollIntoView({ duration: 300 }).should('be.visible');
    ReceitasPage.elements.btnLimpar().should('be.visible');
    ReceitasPage.elements.btnDigitalizar().should('be.visible');
    ReceitasPage.elements.btnGravar().should('be.visible');
  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 1: RECEITA ABERTA PELO ATENDIMENTO (ISSUE FRONT#576, PR #579)
  // ---------------------------------------------------------------------------
  // 100% mockado ([R-BLIND]): o cenário exige massa específica (atendimento com e sem cliente vinculado, permissão 599 ligada e
  // desligada, atendimento com e sem receita gravada), que a API real não garante. O mock nasce da medição real de 2026-10-16
  // (dev, app.omnicare.dev.local com a PR #579 no ar): o campo ATENDIMENTO (prescription-shortcut-attendance, somente leitura) vem com o
  // código do atendimento; com can_add_movement=false (permissão 599) vem vazio; com cliente vinculado, Paciente e Comprador vêm com o
  // cliente e 'Mesmo que paciente' = Sim; com receita gravada, o overlay abre a receita e mostra o paciente gravado. Sintetizado: o
  // cliente do detalhe (copiado do atendimento 261000075), a receita gravada (fixture 260900018) e os orçamentos que apontam para ela.
  context('1. Receita Aberta pelo Atendimento: Campo Atendimento e Cliente como Paciente (Issue front#576/PR #579)', () => {

    let originalUseMocksState;
    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
    });
    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    // Abre o 1º atendimento da fila mockada e, dele, a Receita pelo botão do painel
    const abrirReceitaPeloAtendimento = (cenario) => {
      ReceitasMocks.interceptReceitaPeloAtendimento(cenario);
      ReceitasMocks.interceptEscritasDeReceita();
      AtendimentosPage.visitar();
      AtendimentosPage.elements.tituloAtendimentos().should('be.visible');
      AtendimentosPage.elements.chipWaiting().click();
      AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').click();
      cy.wait('@getAttendanceDetail');
      ReceitasPage.abrirReceitaDoAtendimento();
    };

    it('1.1 deve preencher o campo Atendimento com o código do atendimento de onde a Receita foi aberta', () => {
      // Arrange & Act
      abrirReceitaPeloAtendimento({ cliente: ReceitasMocks.clienteDoAtendimento });

      // Assert: o código vem da URL do atendimento aberto, não de um valor fixo
      cy.location('search').then((search) => {
        const atendimentoAberto = new URLSearchParams(search).get('attendance');
        expect(atendimentoAberto, 'atendimento aberto na URL').to.match(/^\d+$/);
        ReceitasPage.elements.atendimentoDaReceita().should('have.value', atendimentoAberto);
      });
    });

    it('1.2 deve deixar o campo Atendimento vazio quando a permissão 599 (can_add_movement) está revogada', () => {
      // Arrange & Act
      abrirReceitaPeloAtendimento({ cliente: ReceitasMocks.clienteDoAtendimento, podeIncluirMovimento: false });

      // Assert: o Paciente já hidratado prova que o rascunho carregou por inteiro; só então o vazio do Atendimento vale
      ReceitasPage.elements.pacienteNome().should('have.value', ReceitasMocks.clienteDoAtendimento.name);
      ReceitasPage.elements.atendimentoDaReceita().should('have.value', '');
    });

    it('1.3 deve preencher Paciente e Comprador com o cliente do atendimento, com "Mesmo que paciente" em Sim', () => {
      // Arrange & Act
      abrirReceitaPeloAtendimento({ cliente: ReceitasMocks.clienteDoAtendimento });

      // Assert
      ReceitasPage.elements.pacienteNome().should('have.value', ReceitasMocks.clienteDoAtendimento.name);
      ReceitasPage.elements.compradorNome().should('have.value', ReceitasMocks.clienteDoAtendimento.name);
      ReceitasPage.elements.cardPacientePrescritor().invoke('text').should('match', /Mesmo que paciente\s*Sim/);
    });

    it('1.4 não deve preencher Paciente nem Comprador quando o atendimento não tem cliente cadastrado', () => {
      // Arrange & Act: atendimento sem cliente (customer_id nulo e nome vazio, como o 261000076 medido na dev)
      abrirReceitaPeloAtendimento({ cliente: null });

      // Assert: o Atendimento preenchido prova que o rascunho carregou; só então o vazio de Paciente e Comprador vale
      ReceitasPage.elements.atendimentoDaReceita().invoke('val').should('match', /^\d+$/);
      ReceitasPage.elements.pacienteNome().should('have.value', '');
      ReceitasPage.elements.compradorNome().should('have.value', '');
      ReceitasPage.elements.cardPacientePrescritor().invoke('text').should('match', /Mesmo que paciente\s*Não/);
    });

    it('1.5 deve mostrar o paciente gravado, e não o cliente do atendimento, quando o atendimento já tem receita gravada', () => {
      // Arrange & Act: o atendimento tem um cliente (PABLO) diferente do paciente gravado na receita
      abrirReceitaPeloAtendimento({ cliente: ReceitasMocks.clienteDoAtendimento, receitaGravada: true });

      // Assert
      const receita = ReceitasMocks.receitaGravada;
      ReceitasPage.elements.codigoReceita().should('have.value', String(receita.id));
      ReceitasPage.elements.pacienteNome().should('have.value', receita.patient_name);
      ReceitasPage.elements.pacienteNome().should('not.have.value', ReceitasMocks.clienteDoAtendimento.name);
    });

    it('1.6 não deve alterar laboratório, forma nem estoque da receita gravada ao passar com Tab pelos códigos, nem enviar escrita', () => {
      // Arrange
      abrirReceitaPeloAtendimento({ cliente: ReceitasMocks.clienteDoAtendimento, receitaGravada: true });
      const antes = {};
      ReceitasPage.elements.codigoLaboratorio().should('not.have.value', '').invoke('val').then((v) => { antes.codigoLab = v; });
      ReceitasPage.elements.nomeLaboratorio().invoke('val').then((v) => { antes.nomeLab = v; });
      ReceitasPage.elements.codigoFormaFarmaceutica().invoke('val').then((v) => { antes.codigoForma = v; });
      ReceitasPage.elements.nomeFormaFarmaceutica().invoke('val').then((v) => { antes.nomeForma = v; });
      ReceitasPage.elements.estoqueBaixa().invoke('val').then((v) => { antes.estoque = v; });

      // Act: Tab no código do laboratório e depois no código da forma, sem digitar nada
      ReceitasPage.elements.codigoLaboratorio().click();
      ReceitasPage.pressionarTab();
      ReceitasPage.elements.codigoFormaFarmaceutica().should('have.focus');
      ReceitasPage.pressionarTab();
      ReceitasPage.elements.totalMultiplo().should('have.focus');

      // Assert: nada mudou e nenhuma escrita saiu
      cy.then(() => {
        ReceitasPage.elements.codigoLaboratorio().should('have.value', antes.codigoLab);
        ReceitasPage.elements.nomeLaboratorio().should('have.value', antes.nomeLab);
        ReceitasPage.elements.codigoFormaFarmaceutica().should('have.value', antes.codigoForma);
        ReceitasPage.elements.nomeFormaFarmaceutica().should('have.value', antes.nomeForma);
        ReceitasPage.elements.estoqueBaixa().should('have.value', antes.estoque);
      });
      cy.get('@escritaDeReceita.all').should('have.length', 0);
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 2: PREENCHIMENTO DA FÓRMULA PELO TECLADO (ISSUE FRONT#576, PR #579)
  // ---------------------------------------------------------------------------
  // Roda em Mock e em API real. Medido na dev em 2026-10-16: letras na Quantidade levam o foco para a Unidade com a busca aberta
  // (GET /units?q=); Tab no código existente de laboratório/forma seleciona e avança (a forma resolve por GET .../pharmaceutical-forms?q=<código>;
  // o laboratório é resolvido na lista de GET /laboratories); em API real os códigos vêm da própria API (nunca fixos). Nenhum teste grava receita.
  context('2. Preenchimento da Fórmula pelo Teclado: Quantidade para Unidade e Tab nos Códigos (Issue front#576/PR #579)', () => {

    let massa;

    beforeEach(() => {
      ReceitasPage.obterMassaDeCodigos().then((m) => { massa = m; });
      ReceitasMocks.interceptFormularioFormulaApis();
      ReceitasMocks.interceptEscritasDeReceita();
    });

    it('2.1 deve mover o foco da Quantidade para a Unidade ao digitar a primeira letra, levando as letras e mantendo o número', () => {
      // Arrange
      ReceitasPage.abrirFormulario();
      ReceitasPage.limparUnidade();

      // Act
      ReceitasPage.digitarQuantidade('100mg');

      // Assert
      ReceitasPage.elements.unidadeMedida().should('have.focus').and('have.value', 'mg');
      ReceitasPage.elements.quantidadeProduto().should('have.value', '100');
      ReceitasPage.elements.sugestoesUnidade().should('be.visible');
    });

    it('2.2 deve manter a quantidade decimal com vírgula ao digitar letras na sequência (1,5mg)', () => {
      // Arrange
      ReceitasPage.abrirFormulario();
      ReceitasPage.limparUnidade();

      // Act
      ReceitasPage.digitarQuantidade('1,5mg');

      // Assert: a vírgula vira ponto na quantidade
      ReceitasPage.elements.quantidadeProduto().should('have.value', '1.5');
      ReceitasPage.elements.unidadeMedida().should('have.focus').and('have.value', 'mg');
    });

    it('2.3 deve tratar o valor colado por cima do número selecionado (100mg) como quantidade e unidade', () => {
      // Arrange
      ReceitasPage.abrirFormulario();
      ReceitasPage.limparUnidade();
      ReceitasPage.digitarQuantidade('1');

      // Act
      ReceitasPage.colarNaQuantidade('100mg');

      // Assert
      ReceitasPage.elements.quantidadeProduto().should('have.value', '100');
      ReceitasPage.elements.unidadeMedida().should('have.focus').and('have.value', 'mg');
    });

    it('2.4 deve manter a quantidade anterior quando só uma letra é digitada por cima do número selecionado (g)', () => {
      // Arrange
      ReceitasPage.abrirFormulario();
      ReceitasPage.digitarQuantidade('7');
      ReceitasPage.limparUnidade();

      // Act
      ReceitasPage.digitarQuantidade('g');

      // Assert: o número digitado antes não se perde e a letra vai para a Unidade
      ReceitasPage.elements.quantidadeProduto().should('have.value', '7');
      ReceitasPage.elements.unidadeMedida().should('have.focus').and('have.value', 'g');
    });

    it('2.5 deve selecionar o laboratório e levar o foco ao código da forma ao pressionar Tab num código existente', () => {
      // Arrange
      ReceitasPage.abrirFormulario();

      // Act
      ReceitasPage.digitarCodigoLaboratorio(massa.lab.id);
      ReceitasPage.pressionarTab();

      // Assert: segue para o próximo campo do formulário, sem parar no campo de busca por nome
      ReceitasPage.elements.codigoFormaFarmaceutica().should('have.focus');
      ReceitasPage.elements.nomeLaboratorio().should('have.value', massa.lab.name);
    });

    it('2.6 deve selecionar a forma e levar o foco ao Total múltiplo ao pressionar Tab num código de forma existente', () => {
      // Arrange: a forma depende do laboratório escolhido
      ReceitasPage.abrirFormulario();
      ReceitasPage.digitarCodigoLaboratorio(massa.lab.id);
      ReceitasPage.pressionarTab();
      ReceitasPage.elements.codigoFormaFarmaceutica().should('have.focus');

      // Act
      ReceitasPage.digitarCodigoFormaFarmaceutica(massa.forma.id);
      ReceitasPage.pressionarTab();

      // Assert
      ReceitasPage.elements.totalMultiplo().should('have.focus');
      ReceitasPage.elements.nomeFormaFarmaceutica().should('have.value', massa.forma.name);
    });

    it('2.7 não deve selecionar nada ao pressionar Tab num código inexistente: no laboratório o foco vai à busca por nome e na forma não avança', () => {
      // Arrange
      ReceitasPage.abrirFormulario();

      // Act & Assert: laboratório
      ReceitasPage.digitarCodigoLaboratorio('987654');
      ReceitasPage.pressionarTab();
      ReceitasPage.elements.nomeLaboratorio().should('have.focus').and('have.value', '');

      // Act & Assert: forma (depende de um laboratório válido). Só o que o Tab nativo repetiu em todas as medições na dev: nada é
      // selecionado e o foco NÃO avança para o Total múltiplo. Onde o foco termina (código ou busca por nome) variou entre medições
      // com o Tab nativo (ver ROADMAP.md P2), então não é afirmado aqui.
      ReceitasPage.digitarCodigoLaboratorio(massa.lab.id);
      ReceitasPage.pressionarTab();
      ReceitasPage.elements.codigoFormaFarmaceutica().should('have.focus');
      ReceitasPage.digitarCodigoFormaFarmaceutica('987654');
      ReceitasPage.pressionarTab();
      ReceitasPage.elements.nomeFormaFarmaceutica().should('have.value', '');
      ReceitasPage.elements.totalMultiplo().should('not.have.focus');
    });

    it('2.8 não deve escolher nenhum laboratório nem abrir a busca de forma ao pressionar Tab com o código vazio', () => {
      // Arrange
      ReceitasPage.abrirFormulario();

      // Act: Tab normal, sem código
      ReceitasPage.elements.codigoLaboratorio().click();
      ReceitasPage.pressionarTab();

      // Assert: o foco segue o Tab normal, nenhum laboratório é escolhido sozinho e nenhuma busca de forma é aberta
      ReceitasPage.elements.nomeLaboratorio().should('have.focus').and('have.value', '');
      ReceitasPage.elements.codigoLaboratorio().should('have.value', '');
      ReceitasPage.elements.nomeFormaFarmaceutica().should('have.value', '');
      ReceitasPage.elements.sugestoesFormaFarmaceutica().should('not.exist');
    });

    it('2.9 não deve escolher outro laboratório cujo código apenas contém o código digitado (1 não escolhe 12 nem 21)', () => {
      // Arrange: laboratórios 12 e 21 e nenhum 1 (lista sintética só desta rota; o resto segue o modo da rodada)
      ReceitasMocks.interceptLaboratoriesApi(ReceitasMocks.laboratoriosComCodigosProximos);
      ReceitasPage.abrirFormulario();

      // Act: código parcial
      ReceitasPage.digitarCodigoLaboratorio('1');
      ReceitasPage.pressionarTab();

      // Assert: nada é escolhido sozinho
      ReceitasPage.elements.nomeLaboratorio().should('have.focus').and('have.value', '');

      // Controle: o código completo de um dos laboratórios da mesma lista seleciona o laboratório certo
      ReceitasPage.digitarCodigoLaboratorio('12');
      ReceitasPage.pressionarTab();
      ReceitasPage.elements.codigoFormaFarmaceutica().should('have.focus');
      ReceitasPage.elements.nomeLaboratorio().should('have.value', ReceitasMocks.laboratoriosComCodigosProximos.items[0].name);
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 3: FÓRMULA ACRESCENTADA A UMA RECEITA GRAVADA (ISSUE FRONT#159, PR #164)
  // ---------------------------------------------------------------------------
  // 100% mockado ([R-BLIND]): criar fórmula na API real é irreversível (receita não tem DELETE) e a massa não garante uma receita de 1 fórmula. O mock nasce da medição
  // real de 2026-10-16 (dev, app.omnicare.dev.local, receita 260800008 com 3 fórmulas, leituras reais e TODAS as escritas por stub): a seta ↑ acrescenta a fórmula seguinte, vazia, com a seta
  // e o Calcular desabilitados até ela ter conteúdo; o Calcular da fórmula acrescentada faz SÓ a prévia (POST .../prescriptions/formula-calculations) e, se a prévia trouxer aviso,
  // abre o diálogo calcular-aviso-modal (Ok); o Gravar faz PATCH da receita, POST .../formulas { pharmaceutical_form_id, qvd, multiplier } e POST .../formulas/:id/products
  // { product_id, quantity, unit }; em nenhum ponto há POST /prescriptions nem calculate da fórmula nova. Isso difere da descrição da PR #164 (o Calcular criar a fórmula): os testes
  // afirmam o que a tela faz hoje. Medido só em mock (o mock é a única fonte): o Calcular da fórmula 1 (já gravada) faz POST .../formulas/:id/calculate e não apaga a fórmula pendente;
  // depois do 422 no produto, o produto continua na tabela com a mensagem da API e o novo Gravar não recria a fórmula. Sintetizado: a receita gravada (fixture real 260900018, 1 fórmula),
  // o recorte de 4 produtos da busca, a resposta do POST de fórmula (clone de uma fórmula real do detalhe) e o 422 do produto (envelope real, mensagem sintética).
  context('3. Fórmula Acrescentada a uma Receita Gravada: Seta ↑, Calcular só com Prévia e Gravar que Cria (Issue front#159/PR #164)', () => {

    const RECEITA = '260900018';
    const ESCRITAS_QUE_NAO_PODEM_OCORRER = ['postReceita', 'postFormula', 'postProdutoDaFormula', 'postCalcularFormula', 'patchReceita'];

    let originalUseMocksState;
    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
    });
    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    beforeEach(() => {
      ReceitasMocks.interceptFormularioFormulaApis();
      ReceitasMocks.interceptProductsApi();
      ReceitasMocks.interceptFormulaCalculationsApi();
      ReceitasMocks.interceptGetPrescriptionApi(RECEITA);
      ReceitasMocks.interceptEscritasDaFormulaPendente();
    });

    // Prova que nenhuma das escritas indicadas foi enviada (o alias registra toda chamada, inclusive as que o stub responderia com erro)
    const semEscritas = (aliases) => aliases.forEach((alias) => cy.get(`@${alias}.all`).should('have.length', 0));

    it('3.1 deve acrescentar a 2ª fórmula com a seta ↑, vazia, e não empilhar outra fórmula vazia enquanto ela não tiver conteúdo', () => {
      // Arrange
      ReceitasPage.abrirReceitaGravada(RECEITA);

      // Act
      ReceitasPage.irParaFormulaSeguinte(2);

      // Assert: a fórmula nova nasce vazia, sem escrever nada, e a seta ↑ e o Calcular ficam desabilitados até ela ter conteúdo
      ReceitasPage.elements.nomeLaboratorio().should('have.value', '');
      ReceitasPage.elements.nomeFormaFarmaceutica().should('have.value', '');
      ReceitasPage.elements.formulaMais().should('be.disabled');
      ReceitasPage.elements.btnCalcular().should('be.disabled');
      ReceitasPage.elements.formulaMenos().should('not.be.disabled');
      semEscritas(ESCRITAS_QUE_NAO_PODEM_OCORRER);
    });

    it('3.2 deve fazer só a prévia ao calcular a fórmula acrescentada, sem criar receita, fórmula nem produto', () => {
      // Arrange
      ReceitasPage.abrirReceitaGravada(RECEITA);
      ReceitasPage.irParaFormulaSeguinte(2);
      ReceitasPage.preencherFormulaNova({ nomeDoProduto: 'ACIDO ACETICO' });

      // Act
      ReceitasPage.elements.btnCalcular().should('not.be.disabled').click();

      // Assert: uma prévia com a forma, o produto e a quantidade da fórmula nova; sem aviso (esse produto não tem), nada foi escrito
      cy.wait('@postFormulaCalculations').then(({ request }) => {
        expect(request.body.pharmaceutical_form_id, 'forma farmacêutica da prévia').to.eq(7);
        expect(request.body.products, 'produtos da prévia').to.have.length(1);
        expect(request.body.products[0].product_id, 'produto da prévia').to.eq(1000036);
        expect(request.body.products[0].quantity, 'quantidade da prévia').to.eq(1);
      });
      ReceitasPage.elements.avisoDoCalculo().should('not.exist');
      ReceitasPage.elements.formulaNavigate().should('have.value', '2');
      semEscritas(ESCRITAS_QUE_NAO_PODEM_OCORRER);
    });

    it('3.3 deve mostrar o aviso de estoque da prévia e fechá-lo só com o Ok, sem criar nada', () => {
      // Arrange
      ReceitasPage.abrirReceitaGravada(RECEITA);
      ReceitasPage.irParaFormulaSeguinte(2);
      ReceitasPage.preencherFormulaNova({ nomeDoProduto: 'ACETILUM ACIDULATUM' });

      // Act
      ReceitasPage.elements.btnCalcular().should('not.be.disabled').click();
      cy.wait('@postFormulaCalculations');

      // Assert: o diálogo traz o produto e o aviso do servidor e espera o Ok
      ReceitasPage.elements.avisoDoCalculo().should('be.visible')
        .and('contain.text', 'ACETILUM ACIDULATUM')
        .and('contain.text', 'Estoque insuficiente para fazer a fórmula!');
      ReceitasPage.elements.avisoDoCalculoOk().click();
      ReceitasPage.elements.avisoDoCalculo().should('not.exist');
      semEscritas(ESCRITAS_QUE_NAO_PODEM_OCORRER);
    });

    it('3.4 deve criar a fórmula e o produto ao gravar, sem criar outra receita nem calcular', () => {
      // Arrange
      ReceitasPage.abrirReceitaGravada(RECEITA);
      ReceitasPage.irParaFormulaSeguinte(2);
      ReceitasPage.preencherFormulaNova({ nomeDoProduto: 'ACIDO ACETICO' });

      // Act
      ReceitasPage.elements.btnGravar().click();

      // Assert: cabeçalho, depois a fórmula (com a forma escolhida), depois o produto na fórmula que o servidor acabou de criar
      cy.wait('@patchReceita');
      cy.wait('@postFormula').then(({ request, response }) => {
        expect(request.body.pharmaceutical_form_id, 'forma da fórmula criada').to.eq(7);
        expect(request.body, 'corpo da criação da fórmula').to.include.keys('qvd', 'multiplier');
        expect(response.body.formula_number, 'número que o servidor deu à fórmula').to.eq(2);
      });
      cy.wait('@postProdutoDaFormula').then(({ request, response }) => {
        expect(request.url, 'o produto vai para a fórmula nova').to.match(/\/formulas\/\d+\/products$/);
        expect(request.body.product_id, 'produto adicionado').to.eq(1000036);
        expect(response.statusCode, 'status da inclusão do produto').to.eq(201);
      });
      semEscritas(['postReceita', 'postCalcularFormula']);
      cy.get('@postFormula.all').should('have.length', 1);
    });

    it('3.5 não deve criar a fórmula de novo ao gravar outra vez depois de o produto ser recusado com 422', () => {
      // Arrange: o POST do produto responde 422 (registrado depois do padrão do beforeEach, por isso vale)
      ReceitasMocks.interceptEscritasDaFormulaPendente({ produtoRecusado: true });
      ReceitasPage.abrirReceitaGravada(RECEITA);
      ReceitasPage.irParaFormulaSeguinte(2);
      ReceitasPage.preencherFormulaNova({ nomeDoProduto: 'ACIDO ACETICO' });

      // Act 1: a fórmula é criada, o produto é recusado e a tela mostra a mensagem da API sem perder o produto da tabela
      ReceitasPage.elements.btnGravar().click();
      cy.wait('@postFormula');
      cy.wait('@postProdutoDaFormula').its('response.statusCode').should('eq', 422);
      ReceitasPage.elements.avisoDeErro().should('contain.text', 'Quantidade inválida.');
      ReceitasPage.elements.tabelaDeProdutos().should('contain.text', 'ACIDO ACETICO');

      // Act 2: grava de novo (o retry do operador)
      ReceitasPage.elements.btnGravar().should('not.be.disabled').click();
      cy.wait('@patchReceita').then(() => cy.wait('@patchReceita'));

      // Assert: a fórmula já existe no servidor, então o retry não a cria outra vez nem cria receita. A janela de 1 s dá tempo de uma criação indevida
      // chegar (a asserção de contagem sozinha passaria antes dela).
      cy.wait(1000);
      cy.get('@postFormula.all').should('have.length', 1);
      semEscritas(['postReceita']);
    });

    it('3.6 deve manter as setas do Nº fórmula na ordem de tabulação, alcançáveis por Tab a partir do campo do Nº fórmula', () => {
      // Arrange
      ReceitasPage.abrirReceitaGravada(RECEITA);

      // Assert: as setas não saem da ordem de tabulação (são o único caminho para acrescentar fórmula; com tabindex=-1 a ação não existia para quem usa teclado)
      ReceitasPage.elements.formulaMais().should('not.have.attr', 'tabindex', '-1');
      ReceitasPage.elements.formulaMenos().should('not.have.attr', 'tabindex', '-1');

      // Act + Assert: do campo do Nº fórmula, o Tab emulado de pressionarTab() (próximo elemento focável na ordem do DOM, sem os desabilitados nem os de tabindex negativo) chega à seta ↑
      // (a ↓ está desabilitada na 1ª fórmula). Não prova o Tab nativo nem a ativação por tecla: cy.press trava o runner (AGENTS.md §3.5) e, medido em 2026-10-16, type('{enter}') e
      // type(' ') não acionam o botão. A PR #164 declara o Enter validado na mão (ROADMAP.md P1-11).
      ReceitasPage.elements.formulaNavigate().focus();
      ReceitasPage.pressionarTab();
      ReceitasPage.elements.formulaMais().should('have.focus');
      semEscritas(ESCRITAS_QUE_NAO_PODEM_OCORRER);
    });

    it('3.7 deve manter a fórmula acrescentada, com laboratório, forma e produto, ao voltar à fórmula 1 e recalculá-la', () => {
      // Arrange: fórmula 2 pendente, com conteúdo
      ReceitasPage.abrirReceitaGravada(RECEITA);
      ReceitasPage.irParaFormulaSeguinte(2);
      ReceitasPage.preencherFormulaNova({ nomeDoProduto: 'ACIDO ACETICO' });

      // Act: volta à fórmula 1 (já gravada) e a recalcula (o caminho da fórmula gravada é o calculate da própria fórmula, não a prévia)
      ReceitasPage.elements.formulaMenos().click();
      ReceitasPage.elements.formulaNavigate().should('have.value', '1');
      ReceitasPage.elements.btnCalcular().should('not.be.disabled').click();
      cy.wait('@postCalcularFormula').its('request.url').should('match', /\/formulas\/\d+\/calculate$/);

      // Assert: a 2ª fórmula continua lá, com o que foi preenchido, e nada foi criado
      ReceitasPage.irParaFormulaSeguinte(2);
      ReceitasPage.elements.nomeLaboratorio().should('have.value', 'LABORATORIO DE FITOTERAPIA');
      ReceitasPage.elements.nomeFormaFarmaceutica().should('have.value', 'ENVELOPES/SACHÊ');
      ReceitasPage.elements.tabelaDeProdutos().should('contain.text', 'ACIDO ACETICO');
      semEscritas(['postReceita', 'postFormula', 'postProdutoDaFormula', 'patchReceita']);
    });

    // Issue front#568, PR #571 e #572. Medido na UI real da dev em 2026-10-26 (formulário de receita nova, só leitura, escritas barradas): Enter ou clique em outro campo confirmam o rascunho do Stepper
    // e aplicam o teto (Quantidade 999999, Múltiplo 32767, QVD 999999, mostrados sem separador de milhar), e a seta ↑ do campo fica desabilitada; o `blur()` do Cypress NÃO confirma o rascunho.
    // O teto é regra do front, igual em mock e em API real; o de Quantidade e QVD é provisório até a backend#649 publicar o limite (o do Múltiplo é o SMALLINT do banco).
    // O aviso usa a prévia do 3.3 (produto ACETILUM ACIDULATUM) e o mock continua o do ctx 3.
    it('3.8 deve manter o aviso do Calcular aberto depois de mais de 10 s, com o rodapé "Pressione ESC p/ sair" sem contagem regressiva (front#568)', () => {
      // Arrange
      ReceitasPage.abrirReceitaGravada(RECEITA);
      ReceitasPage.irParaFormulaSeguinte(2);
      ReceitasPage.preencherFormulaNova({ nomeDoProduto: 'ACETILUM ACIDULATUM' });

      // Act
      ReceitasPage.elements.btnCalcular().should('not.be.disabled').click();
      cy.wait('@postFormulaCalculations');
      ReceitasPage.elements.avisoDoCalculo().should('be.visible');
      // Assert: o aviso segue aberto por 10,5 s de relógio real (antes da PR #571 fechava sozinho aos 10 s) e o rodapé não tem contagem
      ReceitasPage.confirmarAvisoAbertoPor(10500);
      ReceitasPage.elements.avisoDoCalculo().should('be.visible').and('contain.text', 'ACETILUM ACIDULATUM');
      ReceitasPage.elements.avisoDoCalculoRodape().should('have.text', 'Pressione ESC p/ sair');
      semEscritas(ESCRITAS_QUE_NAO_PODEM_OCORRER);
    });

    it('3.9 deve fechar o aviso do Calcular pelo X e pelo ESC, sem criar nada (front#568)', () => {
      // Arrange
      ReceitasPage.abrirReceitaGravada(RECEITA);
      ReceitasPage.irParaFormulaSeguinte(2);
      ReceitasPage.preencherFormulaNova({ nomeDoProduto: 'ACETILUM ACIDULATUM' });
      ReceitasPage.elements.btnCalcular().should('not.be.disabled').click();
      cy.wait('@postFormulaCalculations');
      ReceitasPage.elements.avisoDoCalculo().should('be.visible');

      // Act e Assert: o X fecha
      ReceitasPage.elements.avisoDoCalculoFechar().click();
      ReceitasPage.elements.avisoDoCalculo().should('not.exist');

      // Act e Assert: calcular de novo reabre o aviso e o ESC fecha
      ReceitasPage.elements.btnCalcular().should('not.be.disabled').click();
      cy.wait('@postFormulaCalculations');
      ReceitasPage.elements.avisoDoCalculo().should('be.visible');
      cy.get('body').type('{esc}');
      ReceitasPage.elements.avisoDoCalculo().should('not.exist');
      semEscritas(ESCRITAS_QUE_NAO_PODEM_OCORRER);
    });

    it('3.10 deve limitar Quantidade, Múltiplo e QVD ao teto ao sair do campo com um valor absurdo (front#568)', () => {
      // Arrange
      ReceitasPage.abrirReceitaGravada(RECEITA);
      ReceitasPage.irParaFormulaSeguinte(2);
      ReceitasPage.preencherFormulaNova({ nomeDoProduto: 'ACIDO ACETICO' });

      // Act e Assert: cada campo vira o teto, não o valor digitado
      ReceitasPage.digitarNoStepperESair(ReceitasPage.elements.quantidadeProduto, '1000000000000');
      ReceitasPage.elements.quantidadeProduto().should('have.value', '999999');
      ReceitasPage.digitarNoStepperESair(ReceitasPage.elements.multiploDaFormula, '99999');
      ReceitasPage.elements.multiploDaFormula().should('have.value', '32767');
      ReceitasPage.digitarNoStepperESair(ReceitasPage.elements.totalMultiplo, '10000000');
      ReceitasPage.elements.totalMultiplo().should('have.value', '999999');
      semEscritas(ESCRITAS_QUE_NAO_PODEM_OCORRER);
    });

    it('3.11 deve desabilitar a seta ↑ de Quantidade, Múltiplo e QVD no teto e deixá-la habilitada um passo abaixo (front#568)', () => {
      // Arrange
      ReceitasPage.abrirReceitaGravada(RECEITA);
      ReceitasPage.irParaFormulaSeguinte(2);
      ReceitasPage.preencherFormulaNova({ nomeDoProduto: 'ACIDO ACETICO' });
      const campos = [
        { campo: ReceitasPage.elements.quantidadeProduto, aumentar: ReceitasPage.elements.btnAumentarQuantidade, teto: '999999', abaixo: '999998' },
        { campo: ReceitasPage.elements.multiploDaFormula, aumentar: ReceitasPage.elements.btnAumentarMultiplo, teto: '32767', abaixo: '32766' },
        { campo: ReceitasPage.elements.totalMultiplo, aumentar: ReceitasPage.elements.btnAumentarTotalMultiplo, teto: '999999', abaixo: '999998' },
      ];

      campos.forEach(({ campo, aumentar, teto, abaixo }) => {
        // Act: um passo abaixo do teto a seta ainda anda e leva ao teto
        ReceitasPage.digitarNoStepperESair(campo, abaixo);
        campo().should('have.value', abaixo);
        aumentar().should('not.be.disabled').click();

        // Assert: no teto a seta fica desabilitada
        campo().should('have.value', teto);
        aumentar().should('be.disabled');
      });
      semEscritas(ESCRITAS_QUE_NAO_PODEM_OCORRER);
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 4: TEXTO DA FÓRMULA COM ACENTOS E PONTUAÇÃO DO WORD APARECE ÍNTEGRO NA TELA (ISSUE BACKEND#655, PR #701)
  // ---------------------------------------------------------------------------
  // Contexto de front contra API real ([R-BLIND]: USE_MOCKS=false no before). O banco e a conexão do Firebird são WIN1252 (backend#655/PR #701): o texto que cabe
  // nele (acentos do português, aspas curvas, travessão, reticências, euro, bullet, símbolos do Latin-1) tem que fazer a ida e a volta pelo banco e aparecer
  // idêntico na aba "Posologia e rótulo", sem "?" no lugar. A massa nasce pela API (a receita temporária do before, 1 por rodada: receita não tem DELETE).
  // Medido na UI real em 2026-10-19 (receita temporária 261000760): a tela mostra os textos gravados pela API idênticos.
  // O 422 do emoji não é alcançável pela tela, então não há teste da mensagem (o #4.3 prova só que o emoji digitado não é enviado nem gravado). Medido: não há campo de RG nem de órgão emissor; a aba "Obs. receita" é um
  // placeholder somente leitura ("Conteúdo em breve"); a posologia, o rótulo e a observação do rótulo só são editáveis numa fórmula já gravada e o Gravar continua
  // desabilitado depois de digitar neles; numa fórmula nova a aba só diz "Calcule a fórmula para gerar a posologia e o rótulo". Nenhum caminho da tela envia esses
  // textos ao servidor (ROADMAP.md P2-24).
  context('4. Texto da Fórmula com Acentos e Pontuação do Word Aparece Íntegro na Tela (Issue backend#655/PR #701)', () => {

    const TEXTOS = {
      posology: 'Tomar 1 cápsula após o almoço: ação, coração, pílula, ônibus, maçã – “aspas” … € 10,00',
      label_text: '‘simples’ — • ™ Š œ ž Ÿ ª º ° ± ¼ ¿ ñ ü ß ÿ ¡ £ ¥ ©',
      label_observation: 'Não tomar em jejum, conforme orientação médica: atenção às contraindicações',
    };

    const EMOJI = '\u{1F600}';

    let originalUseMocksState;
    let receitaId = null;
    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', false);
      ReceitasPage.criarReceitaTemporariaComTextos(TEXTOS).then((id) => { receitaId = id; });
    });
    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    it('4.1 deve mostrar íntegra a posologia gravada com acentos do português e a pontuação do Word (aspas curvas, travessão, reticências, euro)', () => {
      // Arrange & Act
      ReceitasPage.abrirReceitaGravada(receitaId);
      ReceitasPage.elements.abaPosologia().click();

      // Assert: o texto volta idêntico do banco WIN1252, sem "?" no lugar de caractere válido
      ReceitasPage.elements.posologiaTexto().should('have.value', TEXTOS.posology);
      ReceitasPage.elements.posologiaTexto().invoke('val').should('not.include', '?');
    });

    it('4.2 deve mostrar íntegros o texto do rótulo e a observação do rótulo, com a pontuação tipográfica e os símbolos do Latin-1', () => {
      // Arrange & Act
      ReceitasPage.abrirReceitaGravada(receitaId);
      ReceitasPage.elements.abaPosologia().click();

      // Assert
      ReceitasPage.elements.rotuloTexto().should('have.value', TEXTOS.label_text);
      ReceitasPage.elements.obsRotuloTexto().should('have.value', TEXTOS.label_observation);
      ReceitasPage.elements.rotuloTexto().invoke('val').should('not.include', '?');
    });

    // Estado atual da tela, não requisito: hoje o Gravar não habilita ao editar o texto de uma fórmula gravada (ROADMAP.md P2-24). Quando o front ligar o campo ao
    // servidor, este teste falha de propósito e dá lugar ao teste do 422 com a mensagem do servidor visível ao operador.
    it('4.3 deve aceitar o emoji digitado na posologia de uma fórmula gravada sem enviar escrita e sem alterar o texto gravado (a tela não grava esse campo)', () => {
      // Arrange: toda escrita de receita é barrada e contada (nada chega ao tenant)
      ReceitasMocks.bloquearEscritasDeReceita();
      ReceitasPage.abrirReceitaGravada(receitaId);
      ReceitasPage.elements.abaPosologia().click();

      // Act: o operador digita o emoji no fim da posologia e sai do campo
      ReceitasPage.elements.posologiaTexto().click().type(` ${EMOJI}`, { delay: 0 }).blur();

      // Assert: o campo mostra o digitado, mas o Gravar segue desabilitado e nenhuma escrita foi enviada. A janela de 1 s dá tempo de um envio indevido (autosave ao sair do campo) chegar
      ReceitasPage.elements.posologiaTexto().should('have.value', `${TEXTOS.posology} ${EMOJI}`);
      ReceitasPage.elements.btnGravar().should('be.disabled');
      cy.wait(1000);
      cy.get('@escritaDeReceita.all').should('have.length', 0);

      // Assert: reabrindo a receita, o texto gravado no servidor continua o original, sem "?" e sem o emoji
      ReceitasPage.abrirReceitaGravada(receitaId);
      ReceitasPage.elements.abaPosologia().click();
      ReceitasPage.elements.posologiaTexto().should('have.value', TEXTOS.posology);
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 5: BUSCA DE PRESCRITOR PELO NÚMERO DO CONSELHO NA TELA (ISSUE BACKEND#658, PR #712)
  // ---------------------------------------------------------------------------
  // Contexto de front contra API real ([R-BLIND]: USE_MOCKS=false no before). Medido na UI real em 2026-10-19: ao digitar no campo Prescritor o front chama
  // `GET /prescribers?q=<termo>` e lista as sugestões (`pessoa-prescritor-suggestion-<código>`) na ordem do servidor. Com a PR #712 o termo numérico acha pelo CRM
  // (sem espaço, tab e zero à esquerda) e os de CRM vêm antes do de código igual. A referência de cada teste é a própria API real (a ordem do servidor) mais as
  // invariantes da issue; a massa (CRM 23325 de 2 prescritores e CRM 8746 salvo com e sem zero) é do tenant dev e as precondições 🔒 dizem quando ela sumir.
  // Fora do teste, achado do QA da issue: cada sugestão mostra só o nome e o código; conselho, número e UF (que o servidor já devolve) não aparecem na tela,
  // então os homônimos só se distinguem pelo código (ROADMAP.md P2-25).
  context('5. Busca de Prescritor pelo Número do Conselho (CRM) na Tela (Issue backend#658/PR #712)', () => {

    const CRM_DE_DOIS_PRESCRITORES = '23325';
    const CRM_COM_ZERO_A_ESQUERDA = '8746';
    const TERMO_DE_NOME = 'abadio';
    const semFormatacao = (numero) => String(numero).replace(/\s/g, '').replace(/^0+/, '');

    let originalUseMocksState;
    const massa = {};
    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', false);
      ReceitasPage.buscarPrescritoresNaApi(CRM_DE_DOIS_PRESCRITORES).then((itens) => { massa.crm = itens; });
      ReceitasPage.buscarPrescritoresNaApi(CRM_COM_ZERO_A_ESQUERDA).then((itens) => { massa.zero = itens; });
      ReceitasPage.buscarPrescritoresNaApi(TERMO_DE_NOME).then((itens) => { massa.nome = itens; });
    });
    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    // Todo prescritor achado só pelo código (CRM diferente do termo) tem que vir depois dos achados pelo CRM
    const exigirCrmAntesDoCodigo = (ids, itens, termo) => {
      const porCrm = itens.filter((i) => semFormatacao(i.council_number) === semFormatacao(termo));
      const soPeloCodigo = itens.filter((i) => semFormatacao(i.council_number) !== semFormatacao(termo));
      expect(porCrm.length, `🔒 massa: nenhum prescritor com CRM ${termo} na dev`).to.be.greaterThan(0);
      expect(soPeloCodigo.length, `🔒 massa: nenhum prescritor achado só pelo código ${termo} na dev`).to.be.greaterThan(0);
      const ultimoPorCrm = Math.max(...porCrm.map((i) => ids.indexOf(i.id)));
      const primeiroSoPeloCodigo = Math.min(...soPeloCodigo.map((i) => ids.indexOf(i.id)));
      expect(ultimoPorCrm, 'posição do último prescritor achado pelo CRM').to.be.lessThan(primeiroSoPeloCodigo);
    };

    it('5.1 deve listar na tela, ao digitar o número do conselho, os prescritores com esse CRM antes do prescritor de código igual', () => {
      // Arrange: a ordem do servidor é a referência; a massa tem 2 prescritores com o CRM e 1 só com o código
      const ids = massa.crm.map((i) => i.id);
      expect(massa.crm.filter((i) => semFormatacao(i.council_number) === CRM_DE_DOIS_PRESCRITORES).length, `🔒 massa: ao menos 2 prescritores com CRM ${CRM_DE_DOIS_PRESCRITORES}`).to.be.at.least(2);

      // Act
      ReceitasPage.visitarNova();
      ReceitasPage.digitarNoPrescritor(CRM_DE_DOIS_PRESCRITORES);

      // Assert: a tela lista o que o servidor devolveu, com os de CRM primeiro
      ReceitasPage.esperarSugestoesDePrescritor(ids);
      exigirCrmAntesDoCodigo(ids, massa.crm, CRM_DE_DOIS_PRESCRITORES);
    });

    it('5.2 deve achar na tela o prescritor com CRM salvo com zero à esquerda ao digitar o número sem o zero', () => {
      // Arrange: o CRM está salvo como "08746" em um cadastro e como "8746" em outro
      const ids = massa.zero.map((i) => i.id);
      expect(massa.zero.some((i) => i.council_number === `0${CRM_COM_ZERO_A_ESQUERDA}`), `🔒 massa: nenhum CRM salvo como 0${CRM_COM_ZERO_A_ESQUERDA}`).to.eq(true);

      // Act
      ReceitasPage.visitarNova();
      ReceitasPage.digitarNoPrescritor(CRM_COM_ZERO_A_ESQUERDA);

      // Assert: o salvo com zero aparece, junto dos demais por CRM e antes do que só tem o código igual
      ReceitasPage.esperarSugestoesDePrescritor(ids);
      exigirCrmAntesDoCodigo(ids, massa.zero, CRM_COM_ZERO_A_ESQUERDA);
    });

    it('5.3 deve manter a busca por nome, listando na tela os prescritores que o servidor devolve para o nome', () => {
      // Arrange
      const ids = massa.nome.map((i) => i.id);
      expect(ids.length, `🔒 massa: nenhum prescritor com "${TERMO_DE_NOME}" no nome`).to.be.greaterThan(0);

      // Act
      ReceitasPage.visitarNova();
      ReceitasPage.digitarNoPrescritor(TERMO_DE_NOME);

      // Assert: lista igual à do servidor e todo nome traz o termo
      ReceitasPage.esperarSugestoesDePrescritor(ids);
      massa.nome.forEach((p) => expect(p.name.toLowerCase(), `nome do prescritor ${p.id}`).to.include(TERMO_DE_NOME));
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 6: BUSCA DE PRODUTO DA FÓRMULA SEM DISTINGUIR ACENTO NA TELA (ISSUE BACKEND#661, PR #713)
  // ---------------------------------------------------------------------------
  // Contexto de front contra API real ([R-BLIND]: USE_MOCKS=false no before). Medido na UI real em 2026-10-19: ao digitar no campo Produto da fórmula o front chama
  // `GET /products?usage=human&mode=containing&q=<termo>` e lista as sugestões (`formula-produto-suggestion-<id>`). Com a PR #713 o servidor ignora acento e caixa, então
  // `passiflóra` lista os mesmos produtos de `passiflora` (antes, nenhum). A referência é a própria resposta do servidor lida no before; a massa (PASSIFLORA EXTRATO SECO e
  // outros 6) é do tenant dev e a precondição 🔒 diz quando ela sumir. A correção só vale onde o script de banco foi aplicado (a dev; os bancos dos clientes depois).
  context('6. Busca de Produto da Fórmula sem Distinguir Acento na Tela (Issue backend#661/PR #713)', () => {

    const SEM_ACENTO = 'passiflora';
    const COM_ACENTO = 'passiflóra';
    const PRODUTO_DA_ISSUE = 'PASSIFLORA EXTRATO SECO';

    let originalUseMocksState;
    const massa = {};
    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', false);
      ReceitasPage.buscarProdutosNaApi(SEM_ACENTO).then((itens) => { massa.semAcento = itens; });
      ReceitasPage.buscarProdutosNaApi(COM_ACENTO).then((itens) => { massa.comAcento = itens; });
    });
    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    it('6.1 deve listar na tela, ao digitar o termo com acento, os mesmos produtos do termo sem acento, incluindo o produto da issue', () => {
      // Arrange: o servidor devolve o mesmo conjunto com e sem acento (antes da PR #713 o termo com acento não trazia nada)
      expect(massa.semAcento.length, `🔒 massa: nenhum produto para "${SEM_ACENTO}" na dev`).to.be.greaterThan(0);
      expect(massa.semAcento.map((p) => p.name), `🔒 massa: produto "${PRODUTO_DA_ISSUE}" na dev`).to.include(PRODUTO_DA_ISSUE);
      const idsSemAcento = massa.semAcento.map((p) => p.id);
      expect(massa.comAcento.map((p) => p.id).sort(), 'servidor: termo com acento traz os mesmos produtos').to.deep.eq([...idsSemAcento].sort());

      // Act
      ReceitasPage.visitarNova();
      ReceitasPage.digitarNoProduto(COM_ACENTO);

      // Assert: a tela lista exatamente os produtos do termo sem acento, entre eles o da issue
      ReceitasPage.esperarSugestoesDeProduto(idsSemAcento);
      ReceitasPage.elements.sugestoesDeProduto().contains(PRODUTO_DA_ISSUE).should('exist');
    });

    it('6.2 deve manter na tela a busca do termo sem acento, listando os produtos que o servidor devolve', () => {
      // Arrange
      const idsSemAcento = massa.semAcento.map((p) => p.id);
      expect(idsSemAcento.length, `🔒 massa: nenhum produto para "${SEM_ACENTO}" na dev`).to.be.greaterThan(0);

      // Act
      ReceitasPage.visitarNova();
      ReceitasPage.digitarNoProduto(SEM_ACENTO);

      // Assert
      ReceitasPage.esperarSugestoesDeProduto(idsSemAcento);
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 7: LISTA DE RECEITAS (ISSUE FRONT#569, PR #620)
  // ---------------------------------------------------------------------------
  // Contexto de front contra API real ([R-BLIND]: USE_MOCKS=false no before). Medido na UI real em 2026-10-22 (dev, loja 1, com a PR #620 no ar): `/receitas` é a LISTA (`prescriptions-page`,
  // `table-prescriptions`, `row-prescription-<código>`, `link-prescription-<código>`, `prescriptions-count`) e chama `GET /prescriptions/search`; o formulário vive em `/receitas/nova` (botão "Nova receita")
  // e `/receitas/<código>` (clique no link da linha: o link cobre a linha, o clique numa célula é recusado por "covered by"). São 4 status, não os 6 do protótipo: Aberta, Aguardando entrega, Entregue e
  // Descartada (`filter-chip-open`, `-awaiting-delivery`, `-delivered`, `-discarded`). Chips com `aria-pressed`; o de tipo "Todos" fica aceso junto do status; clicar de novo no chip de status o desliga.
  // Contadores: os de status respeitam o tipo, os de tipo respeitam o status, "Todos" ignora os dois. Busca com debounce de 300 ms, aceita o `#` do código. Ordem: `button-sort-prescriptions`
  // (`title`/`aria-label` "Mais recentes"/"Mais antigas"). Rolagem carrega 20 por vez e para em 400 com `prescriptions-limit-reached`. A massa muda sozinha (outras sessões criam receitas): os testes
  // comparam relações entre os contadores da mesma resposta, nunca valores fixos. Sem teste: a linha de receita de animal COM tutor ("Tutor(a): <nome>"): a dev só tem animal sem cliente (`ROADMAP.md` P1-50).
  context('7. Lista de Receitas: Tela, Busca, Filtros, Ordem, Rolagem e Navegação (Issue front#569/PR #620)', () => {

    const STATUS_DA_LISTA = { open: 'Aberta', 'awaiting-delivery': 'Aguardando entrega', delivered: 'Entregue', discarded: 'Descartada' };
    const CHIPS = { all: 'Todos', human: 'Humano', animal: 'Animal', ...STATUS_DA_LISTA };
    const somaDosStatus = (n) => n.open + n['awaiting-delivery'] + n.delivered + n.discarded;

    let originalUseMocksState;
    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', false);
    });
    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    beforeEach(() => {
      ReceitasMocks.interceptPrescriptionsSearchApi();
    });

    it('7.1 deve exibir o título, as ações, as 7 colunas, a contagem e os chips com contadores ao abrir a lista', () => {
      // Act
      ReceitasPage.abrirLista();

      // Assert: cabeçalho e barra de ferramentas
      ReceitasPage.elements.tituloDaPagina().should('have.text', 'Lista de receitas');
      ReceitasPage.elements.btnNovaReceitaDaLista().should('be.visible').and('contain.text', 'Nova receita');
      ReceitasPage.elements.buscaDaLista().should('be.visible').and('have.attr', 'placeholder', 'Buscar por protocolo, cliente ou prescritor');
      ReceitasPage.elements.btnOrdemDaLista().should('have.attr', 'title', 'Mais recentes');

      // Assert: colunas e formato de cada linha
      ReceitasPage.elements.cabecalhosDaLista().then(($th) => {
        expect($th.toArray().map((th) => th.innerText.trim().toLowerCase()), 'Colunas da tabela').to.deep.eq(['código', 'cliente', 'prescritor', 'tipo', 'emissão', 'status', 'valor total']);
      });
      ReceitasPage.textosDasLinhas().then((linhas) => {
        expect(linhas.length, 'Linhas da 1ª página').to.be.within(1, 20);
        linhas.forEach((celulas) => {
          expect(celulas, `Células da linha ${celulas[0]}`).to.have.length(7);
          expect(celulas[0], 'Código com #').to.match(/^#\d+$/);
          expect(celulas[3], `Tipo da linha ${celulas[0]}`).to.be.oneOf(['Humano', 'Animal']);
          expect(celulas[4], `Emissão da linha ${celulas[0]}`).to.match(/^\d{2}\/\d{2}\/\d{4}$/);
          expect(celulas[5], `Status da linha ${celulas[0]}`).to.be.oneOf(Object.values(STATUS_DA_LISTA));
          expect(celulas[6], `Valor total da linha ${celulas[0]}`).to.match(/^R\$ [\d.]+,\d{2}$/);
        });
      });

      // Assert: contagem e chips (só "Todos" aceso)
      ReceitasPage.elements.contagemDaLista().invoke('text').should('match', /^[\d.]+ receitas?$/);
      Object.entries(CHIPS).forEach(([nome, rotulo]) => {
        ReceitasPage.elements.chipDaLista(nome).should('be.visible').and('contain.text', rotulo).invoke('text').should('match', /\d+$/);
      });
      ReceitasPage.numerosDosChips().then((n) => {
        expect(n.ativos, 'Chips acesos').to.deep.eq(['all']);
      });
    });

    it('7.2 deve manter os contadores coerentes: contagem = Todos = Humano + Animal = soma dos 4 status', () => {
      // Act
      ReceitasPage.abrirLista();

      // Assert
      ReceitasPage.elements.contagemDaLista().invoke('text').then((texto) => {
        ReceitasPage.numerosDosChips().then((n) => {
          expect(n.all, '🔒 massa: receitas nos últimos 90 dias').to.be.greaterThan(0);
          expect(ReceitasPage.paraNumero(texto), 'A contagem acima da tabela é o chip Todos').to.eq(n.all);
          expect(n.human + n.animal, 'Humano + Animal = Todos').to.eq(n.all);
          expect(somaDosStatus(n), 'A soma dos 4 status = Todos').to.eq(n.all);
        });
      });
    });

    it('7.3 deve buscar sem diferenciar maiúsculas nem acentos, em cliente ou prescritor (jose, JOSÉ e vinicius)', () => {
      // Arrange
      ReceitasPage.abrirLista();
      const totais = {};

      // Act & Assert: "jose" e "JOSÉ" acham as mesmas receitas, todas com o termo no cliente ou no prescritor
      ['jose', 'JOSÉ', 'vinicius'].forEach((termo) => {
        ReceitasPage.buscarNaLista(termo).then((corpo) => {
          totais[termo] = corpo.pagination.total;
          expect(corpo.pagination.total, `🔒 massa: receita com "${termo}" no cliente ou no prescritor`).to.be.greaterThan(0);
        });
        ReceitasPage.textosDasLinhas().then((linhas) => {
          linhas.forEach((celulas) => {
            expect(ReceitasPage.semAcento(`${celulas[1]} ${celulas[2]}`), `Linha ${celulas[0]} casa com a busca "${termo}"`).to.include(ReceitasPage.semAcento(termo));
          });
        });
      });
      cy.then(() => {
        expect(totais['JOSÉ'], 'Mesmo total com e sem acento e caixa').to.eq(totais.jose);
      });
    });

    it('7.4 deve achar a receita pelo código, com ou sem o # da coluna Código', () => {
      // Arrange
      ReceitasPage.abrirLista();

      ReceitasPage.textosDasLinhas().then((linhas) => {
        const codigoComTralha = linhas[0][0];
        const codigo = codigoComTralha.replace('#', '');

        // Act & Assert
        [codigoComTralha, codigo].forEach((termo) => {
          ReceitasPage.buscarNaLista(termo);
          ReceitasPage.elements.contagemDaLista().should('have.text', '1 receita');
          ReceitasPage.elements.linhasDaLista().should('have.length', 1).and('have.attr', 'data-testid', `row-prescription-${codigo}`);
        });
      });
    });

    it('7.5 deve mostrar "Nenhuma receita encontrada" quando a busca não acha nada e voltar ao início com "Limpar filtros"', () => {
      // Arrange
      ReceitasPage.abrirLista();

      // Act
      ReceitasPage.buscarNaLista('zzzxyzqwk');

      // Assert: estado vazio, sem tabela
      ReceitasPage.elements.vazioDaLista().should('be.visible').and('contain.text', 'Nenhuma receita encontrada').and('contain.text', 'Nenhuma receita dos últimos 90 dias corresponde a esta busca.');
      ReceitasPage.elements.linhasDaLista().should('not.exist');

      // Act: Limpar filtros
      ReceitasPage.elements.btnLimparFiltros().click();
      ReceitasPage.esperarLista();

      // Assert: volta ao início, com a busca apagada
      ReceitasPage.elements.vazioDaLista().should('not.exist');
      ReceitasPage.elements.buscaDaLista().should('have.value', '');
      ReceitasPage.elements.linhasDaLista().should('have.length.greaterThan', 0);
      ReceitasPage.numerosDosChips().then((n) => {
        expect(n.ativos, 'Chips acesos depois de limpar').to.deep.eq(['all']);
      });
    });

    it('7.6 deve filtrar pelo chip Animal só linhas de animal, com os status contando só os animais, e voltar com Todos', () => {
      // Arrange
      ReceitasPage.abrirLista();

      // Act
      ReceitasPage.clicarNoChip('animal');

      // Assert: só linhas com o badge Animal; "Todos" segue sendo Humano + Animal; os status contam só os animais
      ReceitasPage.textosDasLinhas().then((linhas) => {
        expect(linhas.length, '🔒 massa: receitas de animal nos últimos 90 dias').to.be.greaterThan(0);
        linhas.forEach((celulas) => expect(celulas[3], `Tipo da linha ${celulas[0]}`).to.eq('Animal'));
      });
      ReceitasPage.numerosDosChips().then((n) => {
        expect(n.ativos, 'Chips acesos com Animal').to.deep.eq(['animal']);
        expect(n.human + n.animal, 'Todos segue igual a Humano + Animal').to.eq(n.all);
        expect(somaDosStatus(n), 'Os status contam só os animais').to.eq(n.animal);
      });
      ReceitasPage.elements.contagemDaLista().invoke('text').then((texto) => {
        ReceitasPage.numerosDosChips().then((n) => expect(ReceitasPage.paraNumero(texto), 'A contagem é o chip Animal').to.eq(n.animal));
      });

      // Act: Todos
      ReceitasPage.clicarNoChip('all');

      // Assert
      ReceitasPage.numerosDosChips().then((n) => {
        expect(n.ativos, 'Chips acesos com Todos').to.deep.eq(['all']);
      });
    });

    it('7.7 deve filtrar pelo chip de status Aberta, contando os tipos só nas abertas, e sair do filtro ao clicar de novo', () => {
      // Arrange
      ReceitasPage.abrirLista();

      // Act
      ReceitasPage.clicarNoChip('open');

      // Assert
      ReceitasPage.textosDasLinhas().then((linhas) => {
        expect(linhas.length, '🔒 massa: receitas abertas nos últimos 90 dias').to.be.greaterThan(0);
        linhas.forEach((celulas) => expect(celulas[5], `Status da linha ${celulas[0]}`).to.eq('Aberta'));
      });
      ReceitasPage.numerosDosChips().then((n) => {
        expect(n.ativos, 'Chips acesos com Aberta').to.deep.eq(['all', 'open']);
        expect(n.human + n.animal, 'Os tipos contam só as abertas').to.eq(n.open);
        expect(somaDosStatus(n), 'Os status ignoram o filtro de status').to.eq(n.all);
      });

      // Act: clicar de novo no chip ativo
      ReceitasPage.clicarNoChip('open');

      // Assert
      ReceitasPage.numerosDosChips().then((n) => {
        expect(n.ativos, 'O filtro de status saiu').to.deep.eq(['all']);
      });
    });

    it('7.8 deve combinar Animal com um status sem receitas, mostrar o estado vazio e voltar ao início com "Limpar filtros"', () => {
      // Arrange
      ReceitasPage.abrirLista();
      ReceitasPage.clicarNoChip('animal');

      // Act: escolhe o status que não tem nenhuma receita de animal (hoje Entregue e Descartada)
      ReceitasPage.numerosDosChips().then((n) => {
        const semReceita = Object.keys(STATUS_DA_LISTA).filter((status) => n[status] === 0);
        expect(semReceita.length, '🔒 massa: um status sem nenhuma receita de animal').to.be.greaterThan(0);
        ReceitasPage.clicarNoChip(semReceita[0]);
      });

      // Assert
      ReceitasPage.elements.vazioDaLista().should('be.visible').and('contain.text', 'Nenhuma receita encontrada');
      ReceitasPage.elements.linhasDaLista().should('not.exist');

      // Act
      ReceitasPage.elements.btnLimparFiltros().click();
      ReceitasPage.esperarLista();

      // Assert: volta ao início (Todos aceso, lista de volta)
      ReceitasPage.numerosDosChips().then((n) => {
        expect(n.ativos, 'Chips acesos depois de limpar').to.deep.eq(['all']);
      });
      ReceitasPage.elements.linhasDaLista().should('have.length.greaterThan', 0);
    });

    it('7.9 deve alternar a ordem por emissão: mais recentes por padrão e, no clique, mais antigas primeiro', () => {
      // Arrange
      ReceitasPage.abrirLista();
      ReceitasPage.elements.btnOrdemDaLista().should('have.attr', 'title', 'Mais recentes').and('have.attr', 'aria-label', 'Ordenar por mais recentes');
      let primeiraDoPadrao;
      let datasDoPadrao;
      ReceitasPage.textosDasLinhas().then((linhas) => {
        datasDoPadrao = linhas.map((celulas) => ReceitasPage.dataParaNumero(celulas[4]));
        primeiraDoPadrao = linhas[0][0];
        expect(datasDoPadrao, 'Emissões em ordem não crescente por padrão').to.deep.eq([...datasDoPadrao].sort((a, b) => b - a));
      });

      // Act
      ReceitasPage.elements.btnOrdemDaLista().click();
      ReceitasPage.esperarLista();

      // Assert
      ReceitasPage.elements.btnOrdemDaLista().should('have.attr', 'title', 'Mais antigas').and('have.attr', 'aria-label', 'Ordenar por mais antigas');
      ReceitasPage.elements.linhasDaLista().first().find('td').first().should(($td) => expect($td.text().trim(), 'A 1ª linha mudou com a nova ordem').to.not.eq(primeiraDoPadrao));
      ReceitasPage.textosDasLinhas().then((linhas) => {
        const datas = linhas.map((celulas) => ReceitasPage.dataParaNumero(celulas[4]));
        expect(datas, 'Emissões em ordem não decrescente nas mais antigas').to.deep.eq([...datas].sort((a, b) => a - b));
        expect(datas[0], 'A mais antiga dos 90 dias vem antes da mais recente').to.be.lessThan(datasDoPadrao[0]);
      });

      // Act: volta
      ReceitasPage.elements.btnOrdemDaLista().click();
      ReceitasPage.esperarLista();

      // Assert
      ReceitasPage.elements.btnOrdemDaLista().should('have.attr', 'title', 'Mais recentes');
    });

    it('7.10 deve carregar mais linhas ao rolar e parar em 400 com o aviso para refinar a busca', () => {
      // Arrange
      ReceitasPage.abrirLista();
      ReceitasPage.numerosDosChips().then((n) => {
        expect(n.all, '🔒 massa: pelo menos 400 receitas nos últimos 90 dias para chegar ao teto').to.be.at.least(400);
      });
      ReceitasPage.elements.linhasDaLista().should('have.length', 20);
      ReceitasPage.elements.avisoDeLimiteDaLista().should('not.exist');

      // Act
      ReceitasPage.rolarListaAteOLimite(400);

      // Assert: a lista fecha o teto com 400 linhas; receitas criadas por outras sessões durante a rolagem deslocam a paginação e o front descarta
      // as repetidas (medido em 2026-10-23: 3 criadas no meio da rolagem deram 397), então o piso tolera até uma página (20) de repetidas
      ReceitasPage.elements.linhasDaLista().its('length').should('be.within', 380, 400);
      ReceitasPage.elements.avisoDeLimiteDaLista().should('contain.text', 'Mostrando as primeiras 400 receitas. Refine a busca ou use os filtros para ver as demais.');
    });

    it('7.11 deve abrir a receita pelo link da linha (/receitas/<código>) e voltar à lista pelo botão do navegador', () => {
      // Arrange
      ReceitasPage.abrirLista();

      ReceitasPage.elements.linksDaLista().first().then(($link) => {
        const caminho = $link.attr('href');
        const codigo = $link.text().replace('#', '');
        expect(caminho, 'Destino do link da linha').to.eq(`/receitas/${codigo}`);

        // Act
        ReceitasPage.elements.linksDaLista().first().click();

        // Assert: a receita aberta
        cy.location('pathname').should('eq', caminho);
        ReceitasPage.elements.conteudoPrincipal().should('be.visible');
        ReceitasPage.elements.codigoReceita().should('have.value', codigo);
        ReceitasPage.elements.tituloDaPagina().should('have.text', 'Receitas');
        ReceitasPage.elements.btnNovaReceitaDaLista().should('not.exist');

        // Act: voltar
        cy.go('back');

        // Assert: a lista de volta
        cy.location('pathname').should('eq', '/receitas');
        ReceitasPage.elements.tabelaDaLista().should('be.visible');
        ReceitasPage.elements.linhasDaLista().should('have.length.greaterThan', 0);
      });
    });

    it('7.12 deve abrir a receita em branco em /receitas/nova ao clicar em "+ Nova receita", sem o botão na tela do formulário', () => {
      // Arrange
      ReceitasPage.abrirLista();

      // Act
      ReceitasPage.elements.btnNovaReceitaDaLista().click();

      // Assert
      cy.location('pathname').should('eq', '/receitas/nova');
      ReceitasPage.elements.conteudoPrincipal().should('be.visible');
      ReceitasPage.elements.codigoReceita().should('have.value', '');
      ReceitasPage.elements.tituloDaPagina().should('have.text', 'Receitas');
      ReceitasPage.elements.btnNovaReceitaDaLista().should('not.exist');
    });

    it('7.13 deve levar o "Limpar" da receita aberta para /receitas/nova, não para a lista', () => {
      // Arrange
      ReceitasPage.abrirLista();
      ReceitasPage.elements.linksDaLista().first().click();
      ReceitasPage.elements.conteudoPrincipal().should('be.visible');
      ReceitasPage.elements.codigoReceita().should('not.have.value', '');

      // Act
      ReceitasPage.elements.btnLimpar().click();

      // Assert
      cy.location('pathname').should('eq', '/receitas/nova');
      ReceitasPage.elements.codigoReceita().should('have.value', '');
    });

    it('7.14 deve manter a cor própria de cada status (azul, roxo, verde, cinza) nos dois temas, claro e escuro', () => {
      // Arrange
      ReceitasPage.abrirLista();
      const cores = { inicial: {}, alternado: {} };
      const familias = { inicial: {}, alternado: {} };
      const medir = (tema) => Object.entries(STATUS_DA_LISTA).forEach(([status, rotulo]) => {
        ReceitasPage.clicarNoChip(status);
        ReceitasPage.textosDasLinhas().then((linhas) => expect(linhas[0][5], `Status da 1ª linha com o chip ${status} (${tema})`).to.eq(rotulo));
        ReceitasPage.corDoSeloDeStatus().then((cor) => {
          cores[tema][status] = cor;
          familias[tema][status] = ReceitasPage.familiaDaCor(cor);
        });
        ReceitasPage.clicarNoChip(status);
      });

      // Act: mede no tema que a tela abre e no tema alternado
      medir('inicial');
      ReceitasPage.elements.btnAlternarTema().click();
      medir('alternado');

      // Assert
      cy.then(() => {
        const esperado = { open: 'azul', 'awaiting-delivery': 'roxo', delivered: 'verde', discarded: 'cinza' };
        expect(familias.inicial, 'Famílias de cor dos selos no tema inicial').to.deep.eq(esperado);
        expect(familias.alternado, 'Famílias de cor dos selos no tema alternado').to.deep.eq(esperado);
        expect(cores.alternado['awaiting-delivery'], 'O tema alternou: o roxo do selo muda de tom').to.not.eq(cores.inicial['awaiting-delivery']);
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 8: LISTA DE RECEITAS — CARREGAMENTO E SEM ACESSO (ISSUE FRONT#569, PR #620)
  // ---------------------------------------------------------------------------
  // 100% mockado ([R-BLIND]): a conta de teste tem a permissão 145, então o "sem acesso" (can_list_recipes=false) só existe com capability sintética, e o skeleton do carregamento
  // exige atraso na resposta, que a API real não dá. O texto "Sem acesso à lista de receitas" / "Peça ao administrador a permissão de listar receitas." foi visto na UI real no run do CI de 2026-10-22
  // (front novo com a capability do mock sem o campo); o `prescriptions-loading` vem do bundle do front. Sintetizado: as capabilities (a fixture com `can_list_recipes` falso) e a lista de 1 receita.
  context('8. Lista de Receitas: Carregamento e Sem Acesso à Lista (Issue front#569/PR #620)', () => {

    let originalUseMocksState;
    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
    });
    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    it('8.1 deve mostrar "Sem acesso à lista de receitas", sem tabela, quando a permissão 145 (can_list_recipes) está revogada', () => {
      // Arrange
      ReceitasMocks.interceptPrescriptionCapabilitiesSemListarReceitas();
      ReceitasMocks.interceptPrescriptionsSearchApi();

      // Act
      ReceitasPage.visitar();

      // Assert
      ReceitasPage.elements.listaSemAcesso().should('be.visible')
        .and('contain.text', 'Sem acesso à lista de receitas')
        .and('contain.text', 'Peça ao administrador a permissão de listar receitas.');
      ReceitasPage.elements.tabelaDaLista().should('not.exist');
      ReceitasPage.elements.linhasDaLista().should('not.exist');
    });

    it('8.2 deve mostrar o skeleton enquanto a lista carrega e trocá-lo pelas linhas quando a resposta chega', () => {
      // Arrange: a resposta demora 2 s
      ReceitasMocks.interceptPrescriptionsSearchApiComAtraso(2000);

      // Act
      ReceitasPage.visitar();

      // Assert: o skeleton aparece primeiro e some quando a linha chega
      ReceitasPage.elements.listaCarregando().should('be.visible');
      ReceitasPage.elements.linhasDaLista().should('have.length', 1);
      ReceitasPage.elements.listaCarregando().should('not.exist');
      ReceitasPage.elements.contagemDaLista().should('have.text', '1 receita');
    });

    it('8.3 deve mostrar "Não foi possível carregar as receitas." com "Tentar de novo" quando a lista falha, e carregar as linhas ao tentar de novo', () => {
      // Arrange: a lista responde 500 (medido em mock em 2026-11-06: o front repete 1 vez e mostra o erro, mantendo os filtros)
      ReceitasMocks.interceptPrescriptionsSearchApiErro();

      // Act
      ReceitasPage.visitar();

      // Assert: erro em vez de tabela, filtros na tela
      ReceitasPage.elements.erroDaLista().should('be.visible').and('contain.text', 'Não foi possível carregar as receitas.');
      ReceitasPage.elements.btnTentarDeNovoLista().should('be.visible').and('not.be.disabled');
      ReceitasPage.elements.tabelaDaLista().should('not.exist');
      ReceitasPage.elements.buscaDaLista().should('be.visible');

      // Act: a rota volta e o operador tenta de novo
      ReceitasMocks.interceptPrescriptionsSearchApi();
      ReceitasPage.elements.btnTentarDeNovoLista().click();

      // Assert: as linhas aparecem e o erro some
      cy.wait('@getPrescriptionsSearchApi');
      ReceitasPage.elements.linhasDaLista().should('have.length', 1);
      ReceitasPage.elements.erroDaLista().should('not.exist');
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 9: GUARDA DE SAÍDA DA RECEITA EM EDIÇÃO PELO MENU LATERAL (ISSUE FRONT#569, PR #620)
  // ---------------------------------------------------------------------------
  // Contexto de front contra API real ([R-BLIND]: USE_MOCKS=false no before). Medido na UI real em 2026-10-22: em /receitas/nova, mudar o Múltiplo da fórmula (de 1 para 2) e clicar em
  // "Receitas" ou noutra aba do menu abre `modal-prescription-unsaved-changes` ("Sair sem salvar?" / "As alterações não salvas desta tela serão perdidas.", botões "Continuar editando" e "Sair"); a rota só
  // muda no "Sair". Não grava nada (nenhum POST/PATCH). Sem teste: a guarda de Atendimentos que a PR #620 passou a preservar ao vir da receita (mesmo defeito da #467) — `ROADMAP.md` P1-50.
  context('9. Guarda de Saída da Receita em Edição pelo Menu Lateral (Issue front#569/PR #620)', () => {

    let originalUseMocksState;
    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', false);
    });
    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    beforeEach(() => {
      ReceitasMocks.interceptPrescriptionsSearchApi();
      ReceitasPage.abrirFormulario();
    });

    it('9.1 deve perguntar "Sair sem salvar?" ao clicar em "Receitas" com o Múltiplo alterado e manter a receita com "Continuar editando"', () => {
      // Arrange
      ReceitasPage.elements.btnAumentarMultiplo().click();
      ReceitasPage.elements.multiploDaFormula().should('have.value', '2');

      // Act
      ReceitasPage.elements.menuReceitas().click();

      // Assert: o diálogo aparece e a rota não muda
      ReceitasPage.elements.dialogoSairSemSalvar().should('be.visible').and('contain.text', 'Sair sem salvar?').and('contain.text', 'As alterações não salvas desta tela serão perdidas.');
      cy.location('pathname').should('eq', '/receitas/nova');

      // Act
      ReceitasPage.elements.btnContinuarEditando().click();

      // Assert: segue na receita, com o que foi digitado
      ReceitasPage.elements.dialogoSairSemSalvar().should('not.exist');
      cy.location('pathname').should('eq', '/receitas/nova');
      ReceitasPage.elements.multiploDaFormula().should('have.value', '2');
    });

    it('9.2 deve sair para a lista de receitas ao confirmar "Sair"', () => {
      // Arrange
      ReceitasPage.elements.btnAumentarMultiplo().click();
      ReceitasPage.elements.menuReceitas().click();
      ReceitasPage.elements.dialogoSairSemSalvar().should('be.visible');

      // Act
      ReceitasPage.elements.btnSairSemSalvar().click();

      // Assert
      ReceitasPage.elements.dialogoSairSemSalvar().should('not.exist');
      cy.location('pathname').should('eq', '/receitas');
      ReceitasPage.elements.tabelaDaLista().should('be.visible');
    });

    it('9.3 deve perguntar também ao clicar em outra aba do menu (Clientes) e só trocar de tela no "Sair"', () => {
      // Arrange
      ReceitasPage.elements.btnAumentarMultiplo().click();

      // Act
      ReceitasPage.elements.menuClientes().click();

      // Assert
      ReceitasPage.elements.dialogoSairSemSalvar().should('be.visible');
      cy.location('pathname').should('eq', '/receitas/nova');

      // Act
      ReceitasPage.elements.btnSairSemSalvar().click();

      // Assert
      cy.location('pathname').should('eq', '/clientes');
      ReceitasPage.elements.dialogoSairSemSalvar().should('not.exist');
    });

    it('9.4 contraprova: não deve perguntar ao clicar em "Receitas" com a receita em branco, sem alteração', () => {
      // Act
      ReceitasPage.elements.menuReceitas().click();

      // Assert
      ReceitasPage.elements.dialogoSairSemSalvar().should('not.exist');
      cy.location('pathname').should('eq', '/receitas');
      ReceitasPage.elements.tabelaDaLista().should('be.visible');
    });

  });

  context('10. Data de Retorno da Fórmula Gravada no Rodapé da Receita (Issue backend#791, front PRs #642/#647)', () => {

    // A backend#791 virou a regra do Desktop: a loja que exige a data de retorno só conclui a receita com a data em toda fórmula calculada (PR #805, `0-C` ctx 31).
    // O front passou a ler e gravar a data no rodapé da fórmula (PR #642) e a pedir a data ao concluir (PR #647). Antes, o rodapé mostrava 00/00/0000 mesmo com a data gravada (ROADMAP.md P1-48).
    // API real, só leitura na tela: a receita temporária é criada pela API com a data de retorno calculada na hora ([R-ATEMPORAL]); receita não tem DELETE (1 por rodada, como o ctx 4).
    // Sem teste, por decisão do operador (2026-11-06, ROADMAP.md P1-73): o Concluído sem data (modal e aviso), a conta sem a 449 e o cálculo do tratamento de uso contínuo.
    let originalUseMocksState;
    let receitaId = null;
    let dataDeRetorno = null;
    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', false);
      dataDeRetorno = api.dataDeRetornoFutura();
      ReceitasPage.criarReceitaTemporariaComTextos({ return_date: dataDeRetorno }).then((id) => { receitaId = id; });
    });
    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    it('10.1 deve mostrar no rodapé a data de retorno gravada na fórmula, habilitada para a conta com a 449', () => {
      // Arrange & Act
      ReceitasPage.abrirReceitaGravada(receitaId);

      // Assert: o campo traz a data gravada (AAAA-MM-DD do input date), não vazio nem 00/00/0000, e pode ser editado
      ReceitasPage.elements.campoDataRetorno().scrollIntoView().should('be.visible').and('have.value', dataDeRetorno).and('not.be.disabled');
    });
  });

  // ---------------------------------------------------------------------------
  // CONTEXTOS 11 E 12: SELO RECEITUÁRIO NA BUSCA DE PRODUTOS (Issue front#331, front PR #663, backend#452)
  // ---------------------------------------------------------------------------
  context('11. Selo Receituário na Busca de Produtos e Receita com Produto Carregando, contra a API Real (Issue front#331)', () => {

    // A portaria diz qual campo do receituário exige (0 nada, 1 data, 2 número da notificação, 3 ambos); o backend expõe o código e dois booleanos derivados
    // (backend#452, `0-C` ctx 5) e o front passou a ler os booleanos (PR #663): antes o selo nunca aparecia, porque o campo antigo vinha sempre false.
    // Medido na dev em 2026-11-06 (aba-b): benzodiazepínicos e anorexígenos com código 3; fluoxetina, sertralina e passiflora com 0. O selo é um <span> "Receituário"
    // dentro de `formula-produto-suggestion-<id>`. Massa descoberta na hora ([R-ATEMPORAL]); o #11.2 cria 1 receita temporária por rodada (sem DELETE).
    let originalUseMocksState;
    let produtos = {};
    let receitaId = null;
    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', false);
      ReceitasPage.descobrirProdutosPorReceituario().then((achados) => { produtos = achados; });
    });
    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    it('11.1 deve mostrar o selo Receituário na sugestão do produto cuja portaria exige o receituário e não mostrá-lo no produto comum', function () {
      if (!produtos.controlado || !produtos.comum) {
        cy.log('⏭️ Sem massa: a busca não trouxe um produto que exige receituário e um que não exige');
        this.skip();
      }
      // Act + Assert: o controlado leva o selo
      ReceitasPage.visitarNova();
      ReceitasPage.digitarNoProduto(produtos.controlado.termo);
      ReceitasPage.elements.sugestaoDeProduto(produtos.controlado.id).contains('span', /^Receituário$/).should('be.visible');
      // Contraprova: o comum, na mesma tela, não leva
      ReceitasPage.digitarNoProduto(produtos.comum.termo);
      ReceitasPage.elements.sugestaoDeProduto(produtos.comum.id).should('be.visible').and('not.contain.text', 'Receituário');
    });

    it('11.2 deve abrir a receita com produto na fórmula sem erro de carregamento, com o payload novo do receituário', function () {
      if (!produtos.comum) {
        cy.log('⏭️ Sem massa: a busca não trouxe um produto comum');
        this.skip();
      }
      // Arrange: receita temporária com um produto comum na fórmula
      ReceitasPage.criarReceitaTemporariaComProduto(produtos.comum).then((id) => { receitaId = id; });
      // Act
      cy.then(() => ReceitasPage.abrirReceitaGravada(receitaId));
      // Assert: a tabela da fórmula traz o produto e nenhum aviso de erro aparece (o schema antigo exigia o campo removido e quebrava o parse)
      ReceitasPage.elements.tabelaDeProdutos().should('contain.text', produtos.comum.name.trim());
      ReceitasPage.elements.avisoDeErro().should('not.exist');
    });
  });

  context('12. Selo Receituário Decidido pelos Dois Booleanos, não pelo Código da Portaria — 100% Mockado (Issue front#331)', () => {

    // Critérios 3 e 4 da front#331: o selo sai de `prescription_date_required` ou `notification_number_required`, nunca do código cru reinterpretado, e código
    // fora de 0..3 vale "nada exigido". A dev só tem portarias com 0, 1 e 3 (e a busca medida só trouxe 0 e 3), então o código 2 e o código fora da faixa vêm em mock [R-BLIND],
    // a partir de um produto real da fixture (`products.json`, medida na dev) com só os campos do receituário trocados.
    const RECEITA = '260900018';
    const base = productsData.items[0];
    const produto = (id, nome, code, data, numero) => ({ ...base, id, name: nome, prescription_required_code: code, prescription_date_required: data, notification_number_required: numero, monitoring_required: false, warning_message: '' });
    const SO_NUMERO = produto(9900001, 'CYPRESS RECEITUARIO SO NUMERO', 2, false, true);
    const SO_DATA = produto(9900002, 'CYPRESS RECEITUARIO SO DATA', 1, true, false);
    const CODIGO_FORA = produto(9900003, 'CYPRESS RECEITUARIO CODIGO FORA', 5, false, false);

    let originalUseMocksState;
    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
    });
    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });
    beforeEach(() => {
      ReceitasMocks.interceptFormularioFormulaApis();
      ReceitasMocks.interceptProductsApi({ items: [SO_NUMERO, SO_DATA, CODIGO_FORA] });
      ReceitasMocks.interceptGetPrescriptionApi(RECEITA);
    });

    it('12.1 deve mostrar o selo quando só o número ou só a data é exigido e não mostrá-lo no código fora da faixa com os dois booleanos falsos', () => {
      // Arrange + Act
      ReceitasPage.abrirReceitaGravada(RECEITA);
      ReceitasPage.digitarNoProduto('CYPRESS RECEITUARIO');
      ReceitasPage.esperarSugestoesDeProduto([SO_NUMERO.id, SO_DATA.id, CODIGO_FORA.id]);

      // Assert: só o número (código 2) e só a data (código 1) levam o selo
      ReceitasPage.elements.sugestaoDeProduto(SO_NUMERO.id).contains('span', /^Receituário$/).should('be.visible');
      ReceitasPage.elements.sugestaoDeProduto(SO_DATA.id).contains('span', /^Receituário$/).should('be.visible');
      // Assert: código 5 com os dois booleanos falsos não leva (o front não reinterpreta o código cru)
      ReceitasPage.elements.sugestaoDeProduto(CODIGO_FORA.id).should('not.contain.text', 'Receituário');
    });
  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 13: DATA DE ENTREGA EXIGIDA AO CONCLUIR A RECEITA (Issue front#628, front PRs #632/#633)
  // ---------------------------------------------------------------------------
  context('13. Concluir a Receita com Data e Hora de Entrega, Trocar a Hora Concluída e Desfazer a Conclusão, contra a API Real (Issue front#628)', () => {

    // A front#628 (PRs #632 e #633, 30/10): no modo manual da loja (`settings.delivery_schedule`), a data e a hora do rodapé ficam editáveis e vão no body do finalize
    // (backend#793); desmarcar o Concluído desfaz a conclusão e apaga a data. Medido na dev em 2026-11-06 (aba-b, receita 261100442): loja 1 em modo manual, `can_finalize: true`.
    // Massa própria ([R-ATEMPORAL]): receita temporária pronta para concluir (fórmula calculada e com data de retorno), data de entrega daqui a 5 dias; 1 por rodada (sem DELETE).
    // Recusados pelo operador em 2026-11-06 (ROADMAP.md P1-79): o Concluído sem data (aviso e caixa desmarcada) e o modo automático (mock).
    let originalUseMocksState;
    let receitaId = null;
    let modo = null;
    const emDias = (n) => {
      const d = new Date(Date.now() + n * 86400000);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', false);
      ReceitasPage.criarReceitaTemporariaProntaParaConcluir().then((id) => { receitaId = id; });
      cy.then(() => api.obterUsuarioLogado()).then((resMe) => api.obterDetalhePrescricao(resMe.body.store_code || resMe.body.store_id, receitaId)).then((res) => {
        modo = res.body.settings && res.body.settings.delivery_schedule;
      });
    });
    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    it('13.1 deve concluir a receita com a data e a hora de entrega do rodapé, gravar a hora trocada depois de concluída e apagar a data ao desfazer a conclusão', function () {
      if (modo !== 'manual') {
        cy.log(`⏭️ A loja da sessão está em modo ${modo}: a data informada ao concluir só vale no modo manual`);
        this.skip();
      }
      const data = emDias(5);
      ReceitasMocks.observarConclusaoDaReceita();

      // Act 1: data e hora, Concluído e Gravar
      ReceitasPage.abrirReceitaGravada(receitaId);
      ReceitasPage.preencherEntrega(data, '10:30');
      ReceitasPage.elements.chkConcluido().click().should('have.attr', 'aria-checked', 'true');
      ReceitasPage.elements.btnGravar().click();
      cy.wait('@postFinalizarReceita').then(({ request, response }) => {
        expect(response.statusCode, 'Status do finalize').to.eq(200);
        expect(request.body, 'O finalize leva a data de entrega do rodapé').to.have.property('expected_delivery_at');
      });
      // Assert 1: reaberta, a receita está concluída com a data e a hora
      ReceitasPage.abrirReceitaGravada(receitaId);
      ReceitasPage.lerRodapeDeEntrega().then((rodape) => expect(rodape, 'Rodapé depois de concluir').to.deep.eq({ concluido: true, data, hora: '10:30' }));

      // Act 2: troca a hora da receita concluída e grava
      ReceitasPage.preencherEntrega(undefined, '15:45');
      ReceitasPage.elements.btnGravar().click();
      cy.wait('@patchReceitaReal').its('response.statusCode').should('eq', 200);
      // Assert 2: a hora nova persiste
      ReceitasPage.abrirReceitaGravada(receitaId);
      ReceitasPage.lerRodapeDeEntrega().then((rodape) => expect(rodape, 'Rodapé depois de trocar a hora').to.deep.eq({ concluido: true, data, hora: '15:45' }));

      // Act 3: desmarca o Concluído e grava
      ReceitasPage.elements.chkConcluido().click().should('have.attr', 'aria-checked', 'false');
      ReceitasPage.elements.btnGravar().click();
      cy.wait('@postCancelarConclusao').its('response.statusCode').should('eq', 200);
      // Assert 3: a receita volta a aberta, sem data nem hora
      ReceitasPage.abrirReceitaGravada(receitaId);
      ReceitasPage.lerRodapeDeEntrega().then((rodape) => expect(rodape, 'Rodapé depois de desfazer a conclusão').to.deep.eq({ concluido: false, data: '', hora: '' }));
    });
  });

  // -------------------------------------------------------------
  // 14. DATA DE RETORNO: MODAL DE USO CONTÍNUO E FILA AO CONCLUIR (API REAL)
  // -------------------------------------------------------------
  context('14. Data de Retorno da Fórmula: Tratamento de Uso Contínuo depois do Calcular, Gravar e Reabrir, Cancelar e a Fila ao Concluir, contra a API Real (Issue front#629)', () => {

    // Front#629 (front PRs #642 e #647, 30/10): a fórmula com produto de uso contínuo abre "Tratamento de uso contínuo" depois do Calcular quando está sem data de retorno;
    // os dias saem da quantidade (QVD × múltiplo) dividida pela dose por dia, arredondados para baixo; a data vai no PATCH da fórmula (`return_date`). Na loja que exige
    // a data (`settings.return_date_required`), marcar "Concluído" abre o modal para cada fórmula concluída sem data. Medido na dev em 2026-11-06 (aba-c).
    // Massa própria ([R-ATEMPORAL]): receitas temporárias com o produto 1004866 (uso contínuo no cadastro), sem DELETE: 3 por rodada. Nada é concluído no Gravar.
    // Recusa anterior (backend#791, P1-73) superada pelo operador para a front#629. Sem teste (`ROADMAP.md`): a conta sem a 449, a loja que não exige a data e o Desktop.
    let originalUseMocksState;
    let receitaModal = null;
    let receitaCancelar = null;
    let receitaFila = null;
    let exigeRetorno = null;
    const hojeMais = (dias) => {
      const d = new Date(Date.now() + dias * 86400000);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    };
    const isoMais = (dias) => {
      const d = new Date(Date.now() + dias * 86400000);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', false);
      ReceitasPage.criarReceitaTemporariaUsoContinuo(1, false).then((id) => { receitaModal = id; });
      ReceitasPage.criarReceitaTemporariaUsoContinuo(1, false).then((id) => { receitaCancelar = id; });
      ReceitasPage.criarReceitaTemporariaUsoContinuo(2, true).then((id) => { receitaFila = id; });
      cy.then(() => api.obterUsuarioLogado()).then((resMe) => api.obterDetalhePrescricao(resMe.body.store_code || resMe.body.store_id, receitaFila)).then((res) => {
        exigeRetorno = res.body.settings && res.body.settings.return_date_required;
      });
    });

    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    it('14.1 deve abrir o Tratamento de uso contínuo depois do Calcular na fórmula sem data de retorno e calcular os dias e a data pela posologia em Dia, Hora e Semana, com vírgula, recusando zero', () => {
      // Act
      ReceitasPage.abrirReceitaGravada(receitaModal);
      ReceitasPage.calcularFormulaDeUsoContinuo();

      // Assert: abre com a quantidade da fórmula (QVD 30 × múltiplo 1)
      ReceitasPage.elements.modalUsoContinuo().should('be.visible').and('contain.text', 'Fórmula nº 1');
      ReceitasPage.elements.usoContinuoQuantidade().should('contain.text', '30');

      // Assert: dias = quantidade ÷ dose por dia, arredondado para baixo; retorno = hoje + dias
      [['2', 'day', 15], ['1', 'hour', 1], ['7', 'week', 30], ['1,5', 'day', 20]].forEach(([dose, unidade, dias]) => {
        ReceitasPage.elements.posologiaQuantidade().clear().type(dose);
        ReceitasPage.elements.posologiaUnidade(unidade).click();
        ReceitasPage.elements.usoContinuoDias().should('have.text', String(dias));
        ReceitasPage.elements.usoContinuoRetorno().should('have.text', hojeMais(dias));
      });

      // Assert: zero é recusado e não deixa confirmar
      ReceitasPage.elements.posologiaQuantidade().clear().type('0');
      ReceitasPage.elements.modalUsoContinuo().should('contain.text', 'Informe um número maior que zero.');
      ReceitasPage.elements.usoContinuoConfirmar().should('be.disabled');
    });

    it('14.2 deve gravar a data do Confirmar pelo PATCH da fórmula só com return_date e mostrá-la ao reabrir a receita', () => {
      // Arrange
      ReceitasPage.abrirReceitaGravada(receitaModal);
      ReceitasPage.calcularFormulaDeUsoContinuo();
      ReceitasPage.elements.posologiaQuantidade().clear().type('2');
      ReceitasPage.elements.posologiaUnidade('day').click();
      ReceitasMocks.interceptUpdateFormulaApi();

      // Act: confirma e grava
      ReceitasPage.elements.usoContinuoConfirmar().click();
      ReceitasPage.elements.campoDataRetorno().should('have.value', isoMais(15));
      ReceitasPage.elements.btnGravar().click();

      // Assert: o PATCH leva só a data de retorno; reaberta, a data continua no rodapé
      cy.wait('@updateFormulaApi').then(({ request, response }) => {
        expect(response.statusCode, 'Status do PATCH da fórmula').to.eq(200);
        expect(request.body, 'Body do PATCH: só a data de retorno').to.deep.eq({ return_date: isoMais(15) });
      });
      ReceitasPage.abrirReceitaGravada(receitaModal);
      ReceitasPage.elements.campoDataRetorno().should('have.value', isoMais(15));
    });

    it('14.3 não deve reabrir o modal no Calcular seguinte depois de Cancelar, sem gravar data, e deve reabri-lo pelo botão Calcular data de retorno do rodapé', () => {
      // Arrange
      ReceitasPage.abrirReceitaGravada(receitaCancelar);
      ReceitasPage.calcularFormulaDeUsoContinuo();
      ReceitasPage.elements.modalUsoContinuo().should('be.visible');

      // Act: cancela e calcula de novo
      ReceitasPage.elements.usoContinuoCancelar().click();
      ReceitasPage.elements.modalUsoContinuo().should('not.exist');
      ReceitasPage.elements.campoDataRetorno().should('have.value', '');
      ReceitasPage.calcularFormulaDeUsoContinuo();

      // Assert: não reabre sozinho; o botão do rodapé reabre
      ReceitasPage.elements.modalUsoContinuo().should('not.exist');
      ReceitasPage.elements.botaoAbrirDataRetorno().click();
      ReceitasPage.elements.modalUsoContinuo().should('be.visible');
    });

    it('14.4 deve pedir a data de retorno de cada fórmula concluída sem ela, uma por vez, ao marcar Concluído na loja que exige a data', function () {
      if (exigeRetorno !== true) {
        cy.log(`⏭️ A loja da sessão não exige a data de retorno (return_date_required: ${exigeRetorno}): o Concluído não pede a data`);
        this.skip();
      }
      // Arrange: a data de entrega vem antes (front#628, loja em modo manual)
      ReceitasPage.abrirReceitaGravada(receitaFila);
      ReceitasPage.preencherEntrega(isoMais(2), '18:00');

      // Act + Assert: Concluído abre a fila, uma fórmula por vez
      ReceitasPage.elements.chkConcluido().click();
      ReceitasPage.elements.modalUsoContinuo().should('be.visible').and('contain.text', 'Fórmula nº 1').and('contain.text', '(1 de 2)');
      ReceitasPage.elements.usoContinuoConfirmar().click();
      ReceitasPage.elements.modalUsoContinuo().should('be.visible').and('contain.text', 'Fórmula nº 2').and('contain.text', '(2 de 2)');
      ReceitasPage.elements.usoContinuoConfirmar().click();

      // Assert: confirmadas as duas, a fila acaba e o Concluído fica marcado (nada é gravado)
      ReceitasPage.elements.modalUsoContinuo().should('not.exist');
      ReceitasPage.elements.chkConcluido().should('have.attr', 'aria-checked', 'true');
    });
  });

  // -------------------------------------------------------------
  // 15. ENTREGA DO LABORATÓRIO NO RODAPÉ E CLIENTE ANTES DO LABORATÓRIO (API REAL)
  // -------------------------------------------------------------
  context('15. Entrega do Laboratório no Rodapé ao Concluir e ao Desfazer, e o Cliente antes do Laboratório Recusado, contra a API Real (Issue front#630)', () => {

    // Front#630 (front PRs #633 e #645, 30/10): "Data / Laboratório" e "Hora / Laboratório" do rodapé mostram a entrega do laboratório da fórmula; no modo manual, concluir os
    // preenche com a data e a hora do cliente sem recarregar, e desfazer a conclusão os limpa. A data do cliente antes da do laboratório sai com o aviso traduzido do backend
    // (`DELIVERY_BEFORE_LAB`). Medido na dev em 2026-11-06 (aba-c): loja 1 em modo manual. Massa: 2 receitas temporárias prontas para concluir (sem DELETE).
    // Sem teste (`ROADMAP.md` P1-48): o modo automático (a loja está em manual; o mock dele foi recusado na front#628), a conta sem a 427 e o Desktop.
    let originalUseMocksState;
    let receitaConcluir = null;
    let receitaAntes = null;
    let modo = null;
    const emDias = (n) => {
      const d = new Date(Date.now() + n * 86400000);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const brDe = (iso) => iso.split('-').reverse().join('/');
    const pularSeNaoManual = (ctx) => {
      if (modo !== 'manual') {
        cy.log(`⏭️ A loja da sessão está em modo ${modo}: a entrega informada ao concluir só vale no modo manual`);
        ctx.skip();
      }
    };
    const concluir = (receitaId, data) => {
      ReceitasPage.abrirReceitaGravada(receitaId);
      ReceitasPage.preencherEntrega(data, '18:00');
      ReceitasPage.elements.chkConcluido().click();
      ReceitasPage.elements.btnGravar().click();
      return cy.wait('@postFinalizarReceita').then(({ response }) => {
        expect(response.statusCode, 'Status do finalize').to.eq(200);
        return response.body.expected_delivery_at;
      });
    };

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', false);
      ReceitasPage.criarReceitaTemporariaProntaParaConcluir().then((id) => { receitaConcluir = id; });
      ReceitasPage.criarReceitaTemporariaProntaParaConcluir().then((id) => { receitaAntes = id; });
      cy.then(() => api.obterUsuarioLogado()).then((resMe) => api.obterDetalhePrescricao(resMe.body.store_code || resMe.body.store_id, receitaConcluir)).then((res) => {
        modo = res.body.settings && res.body.settings.delivery_schedule;
      });
    });

    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    beforeEach(() => {
      ReceitasMocks.observarConclusaoDaReceita();
    });

    it('15.1 deve preencher a Data e a Hora do laboratório com a entrega do cliente ao concluir, sem recarregar, mantê-las ao reabrir e limpá-las ao desfazer a conclusão', function () {
      pularSeNaoManual(this);
      const data = emDias(5);

      // Arrange: aberta, o laboratório está vazio
      ReceitasPage.abrirReceitaGravada(receitaConcluir);
      ReceitasPage.elements.dataLaboratorio().should('contain.text', '00/00/0000');

      // Act: conclui com a entrega do cliente
      concluir(receitaConcluir, data);

      // Assert: sem recarregar, o laboratório acompanha o cliente (modo manual)
      ReceitasPage.elements.dataLaboratorio().should('contain.text', brDe(data));
      ReceitasPage.elements.horaLaboratorio().should('have.value', '18:00');

      // Assert: reaberta, continua
      ReceitasPage.abrirReceitaGravada(receitaConcluir);
      ReceitasPage.elements.dataLaboratorio().should('contain.text', brDe(data));
      ReceitasPage.elements.horaLaboratorio().should('have.value', '18:00');

      // Act + Assert: desfazer a conclusão limpa o laboratório
      ReceitasPage.elements.chkConcluido().click();
      ReceitasPage.elements.btnGravar().click();
      cy.wait('@postCancelarConclusao').its('response.statusCode').should('eq', 200);
      ReceitasPage.elements.dataLaboratorio().should('contain.text', '00/00/0000');
      ReceitasPage.elements.horaLaboratorio().should('have.value', '');
    });

    it('15.2 deve recusar na receita concluída a entrega do cliente antes da do laboratório, com o aviso traduzido, sem mudar a data gravada', function () {
      pularSeNaoManual(this);
      concluir(receitaAntes, emDias(5)).then((gravada) => {
        // A tela relê a receita depois do finalize: espera ela refletir a conclusão antes de editar, senão a releitura sobrescreve o campo e o Gravar sai sem mudança
        ReceitasPage.elements.chkConcluido().should('have.attr', 'aria-checked', 'true');
        ReceitasPage.elements.dataLaboratorio().should('contain.text', brDe(emDias(5)));

        // Act: na receita concluída, a entrega do cliente vai para o dia anterior ao laboratório
        ReceitasPage.preencherEntrega(emDias(4), '18:00');
        ReceitasPage.elements.btnGravar().click();

        // Assert: o aviso traduzido e as datas gravadas intactas (o Gravar manda mais de uma escrita; o resultado é o que importa)
        ReceitasPage.elements.avisoDeErro().should('contain.text', 'A entrega ao cliente não pode ser anterior à entrega do laboratório.');
        cy.then(() => api.obterUsuarioLogado()).then((resMe) => api.obterDetalhePrescricao(resMe.body.store_code || resMe.body.store_id, receitaAntes)).then((res) => {
          expect(res.body.expected_delivery_at, 'Data do cliente sem mudar').to.eq(gravada);
          (res.body.formulas || []).forEach((f) => expect(f.lab_delivery_at, `lab_delivery_at da fórmula ${f.formula_number} sem mudar`).to.eq(gravada));
        });
      });
    });
  });

});
