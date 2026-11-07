import AtendimentosPage from '../pages/5.atendimentosPage';
import AtendimentosMocks from '../mocks/5.atendimentosMocks';
import IniciarAtendimentoMocks from '../mocks/4.iniciarAtendimentoMocks';
import RecursosMocks from '../mocks/1.recursosMocks';
import ClientesMocks from '../mocks/7.clientesMocks';
import ClientesPage from '../pages/7.clientesPage';
import ReceitasMocks from '../mocks/6.receitasMocks';
import ReceitasPage from '../pages/6.receitasPage';
const configEnv = require('../../env.json');

// Captura os dados configurados em env.json
const CELULAR_PADRAO = Cypress.env('DEFAULT_CELULAR') || Cypress.env('defaultCelular') || configEnv.DEFAULT_CELULAR || '11999998888';

describe('5-C. Atendimentos - Dados do Cliente', () => {

  beforeEach(() => {
    // 1. Autenticação via sessão (executado antes para evitar que requisições temporárias da sessão colidam com os intercepts de gravação)
    cy.login();

    // 2. Arrange: Configura interceptações centralizadas na classe de Mocks
    AtendimentosMocks.interceptUserMeApi();
    AtendimentosMocks.interceptSummaryApi();
    AtendimentosMocks.interceptAttendancesListApi();
    AtendimentosMocks.interceptSearchApi();
    AtendimentosMocks.interceptAttendanceCapabilitiesApi();
    AtendimentosMocks.interceptAttendanceItemCapabilitiesApi('*');
    AtendimentosMocks.interceptAttendanceDetailApi('*');
    AtendimentosMocks.interceptMessagesListApi('*');
    AtendimentosMocks.interceptAttendanceMessageTemplatesApi('*');
    AtendimentosMocks.interceptBudgetsApi('*');
    AtendimentosMocks.interceptMockAgentsGroup('*');
    AtendimentosMocks.interceptAttendanceEventsApi();
    AtendimentosMocks.interceptAttendantStatusApi();
    AtendimentosMocks.interceptUpdateAttendantStatusApi();
    AtendimentosMocks.interceptUpdateAttendanceStatusApi();
    AtendimentosMocks.interceptObservationsApi();
    IniciarAtendimentoMocks.interceptarCanais();
    IniciarAtendimentoMocks.interceptarBuscaGrupos();
    IniciarAtendimentoMocks.interceptarBuscaTemplatesWaba();
    IniciarAtendimentoMocks.interceptarMensagensPadrao();
    IniciarAtendimentoMocks.interceptarStandardMessageCapabilities();

    // 3. Act: Visita a rota da tela de Atendimentos e confirma a renderização inicial da UI
    AtendimentosPage.visitar();
    AtendimentosPage.elements.tituloAtendimentos().should('be.visible');
  });

  // -------------------------------------------------------------
  // 1. PAINEL "DADOS DO CLIENTE" (NOVO DRAWER DE EDIÇÃO - PR #427/#432/#438)
  // -------------------------------------------------------------

  context('1. Painel "Dados do Cliente" (Novo Drawer de Edição - PR #427/#432/#438)', () => {

    beforeEach(() => {
      // GET/PATCH do cliente não fazem parte do beforeEach global da suíte — precisam de intercept
      // próprio mesmo em modo mock, senão a requisição vaza para a rede real (AGENTS.md §6, regra
      // "Defesa Estrita de Testes de Estados Transientes").
      // "Dados do cliente" só renderiza no popover quando can_update_client=true (client-capabilities)
      // e o recurso comercial "patient" estiver contratado (GET /resources) — confirmado via
      // inspeção do bundle real (função Uh() de index-*.js), não presumido.
      RecursosMocks.interceptResources();
      AtendimentosMocks.interceptClientCapabilitiesApi();
      AtendimentosMocks.interceptClientDetailApi('*');
      AtendimentosMocks.interceptPatchClientApi('*');
      AtendimentosMocks.interceptPostClientAddressApi('*');
      AtendimentosMocks.interceptPatchClientAddressApi('*');
      // A ação "Dados do cliente" só existe quando customer.customer_id vier preenchido no detalhe do
      // atendimento (função Uh() do bundle real: customerCode nulo derruba a ação mesmo com as
      // capabilities corretas) — o payload-base de detalhe não traz esse campo por padrão.
      AtendimentosMocks.interceptAttendanceDetailApi('*', {
        ...AtendimentosMocks.mockAttendanceDetailData,
        customer: { ...AtendimentosMocks.mockAttendanceDetailData.customer, customer_id: 867092 }
      });
      // resources/client-capabilities são buscados no boot da tela — o beforeEach global já visitou
      // a rota antes deste bloco registrar os intercepts acima, então um reload força o refetch sob
      // eles (AGENTS.md §6B: "AtendimentosPage.visitar() é No-Op... use cy.reload() para trocar de mock").
      cy.reload();
      AtendimentosPage.elements.tituloAtendimentos().should('be.visible');
      // Híbrido de verdade: busca o atendimento do número padrão (DEFAULT_CELULAR); se não houver
      // conversa aberta para ele em modo API Real, inicia uma nova via modal "Iniciar Atendimento"
      // (canal Não Oficial, sem exigência de template WABA) — helper já existente e robusto do
      // Page Object, em vez de abrir qualquer card aleatório da fila.
      AtendimentosPage.garantirAtendimentoAberto(CELULAR_PADRAO, 'nao_oficial');
      // Timeout generoso: bug real de performance documentado no ROADMAP.md P0 (GET .../messages
      // com efeito de limiar per_page=10→20, 9-21s de latência em modo API Real). Observa o
      // compositor diretamente em vez de um alias de rede (aria-busy não é sinal confiável).
      AtendimentosPage.aguardarHistoricoMensagensCarregado();
      AtendimentosPage.abrirDrawerDadosCliente();
      cy.wait('@getClientDetail');
    });

    it('1.1 deve abrir o drawer "Dados do cliente" pelo menu do card do cliente e renderizar a estrutura principal', () => {
      AtendimentosPage.elements.radioTipoClientePF().should('be.visible');
      AtendimentosPage.elements.radioTipoClientePJ().should('be.visible');
      AtendimentosPage.elements.inputDocumentoCliente().should('be.visible');
      AtendimentosPage.elements.inputRgCliente().should('be.visible');
      AtendimentosPage.elements.selectOrgaoEmissorCliente().should('be.visible');
      AtendimentosPage.elements.inputDataNascimentoCliente().should('be.visible');
      AtendimentosPage.elements.btnAbrirCalendarioNascimento().should('be.visible');
      AtendimentosPage.elements.btnSalvarDadosCliente().should('be.visible');
    });

    it('1.2 deve exibir apenas "Pessoa física" e "Pessoa jurídica" no tipo de cliente, sem a opção "Animal" (critério 1 da issue)', () => {
      AtendimentosPage.elements.radioTipoClientePF().should('exist');
      AtendimentosPage.elements.radioTipoClientePJ().should('exist');
      AtendimentosPage.elements.drawerDadosCliente().within(() => {
        cy.contains(/animal/i).should('not.exist');
      });
    });

    it('1.3 deve alternar o rótulo do documento entre CPF e CNPJ ao trocar o tipo de cliente, exigindo razão social apenas em Pessoa jurídica', () => {
      // Estado inicial: Pessoa física, documento rotulado como CPF
      AtendimentosPage.elements.labelDocumentoCliente().invoke('text').should('match', /cpf/i);
      AtendimentosPage.elements.inputRazaoSocialClientePJ().should('not.exist');

      // force:true legítimo em todo clique de radio PF/PJ e de endereço deste arquivo: o <input>
      // tem pointer-events:none por estilo (dot customizado via <span> sobreposto), documentado
      // em AGENTS.md §3.5 - confirmado de novo nesta varredura (2026-10-07), sem bug real.
      AtendimentosPage.elements.radioTipoClientePJ().click({ force: true });
      AtendimentosPage.elements.labelDocumentoCliente().invoke('text').should('match', /cnpj/i);
      AtendimentosPage.elements.inputRazaoSocialClientePJ().should('be.visible');

      // Restaura o estado original sem salvar — o teste só valida a reação da UI, nunca muta o cliente real
      AtendimentosPage.elements.radioTipoClientePF().click({ force: true });
      AtendimentosPage.elements.labelDocumentoCliente().invoke('text').should('match', /cpf/i);
    });

    it('1.4 deve salvar RG e órgão emissor, refletindo os valores enviados no corpo do PATCH', () => {
      // Valor dinâmico: em modo API Real o AUTO_SYNC pode reescrever o fixture com o RG salvo por
      // uma rodada anterior — digitar sempre o mesmo valor estático arriscaria não gerar "dirty
      // state" algum dia (o formulário só habilita Salvar quando o valor difere do atual).
      const rgDinamico = `RG${Date.now()}`.slice(0, 20);
      AtendimentosPage.elements.inputRgCliente().clear().type(rgDinamico);
      AtendimentosPage.elements.selectOrgaoEmissorCliente().select('SSP');
      AtendimentosPage.elements.btnSalvarDadosCliente().click();

      cy.wait('@patchClient').its('request.body').should((body) => {
        expect(JSON.stringify(body)).to.match(new RegExp(rgDinamico));
      });
    });

    it('1.5 deve popular o formulário de edição (apelido e CEP) ao selecionar um endereço existente na lista', () => {
      AtendimentosPage.elements.listaEnderecosCliente().should('have.length.at.least', 1);
      AtendimentosPage.elements.listaEnderecosCliente().first().click({ force: true });
      AtendimentosPage.elements.inputApelidoEnderecoCliente().scrollIntoView({ duration: 300 }).should('be.visible').and('not.be.disabled');
    });

    it('1.6 deve abrir um formulário de novo endereço em branco ao clicar em "Adicionar novo endereço"', () => {
      AtendimentosPage.elements.listaEnderecosCliente().first().click({ force: true });
      AtendimentosPage.elements.inputApelidoEnderecoCliente().scrollIntoView({ duration: 300 }).should('be.visible');

      AtendimentosPage.elements.btnNovoEnderecoCliente().scrollIntoView({ duration: 300 }).click();
      AtendimentosPage.elements.inputApelidoEnderecoCliente().should('have.value', '');
    });

    it('1.7 deve persistir o apelido do endereço enviado no PATCH', () => {
      // Editar apenas o apelido de um endereço já existente dispara a mutação dedicada
      // PATCH /clients/:id/addresses/:addressId (alias patchClientAddress) — não o
      // PATCH /clients/:id do cliente (alias patchClient), confirmado via diagnóstico de rede.
      // Valor dinâmico pelo mesmo motivo do teste de RG: o AUTO_SYNC pode deixar o fixture com o
      // apelido salvo por uma rodada anterior, e o formulário só habilita Salvar em "dirty state".
      const apelidoDinamico = `Endereco Teste E2E ${Date.now()}`;
      AtendimentosPage.elements.listaEnderecosCliente().first().click({ force: true });
      AtendimentosPage.elements.inputApelidoEnderecoCliente().scrollIntoView({ duration: 300 }).clear().type(apelidoDinamico);
      AtendimentosPage.elements.btnSalvarDadosCliente().scrollIntoView({ duration: 300 }).click();

      cy.wait('@patchClientAddress').its('request.body').should((body) => {
        expect(JSON.stringify(body)).to.include(apelidoDinamico);
      });
    });

    it('1.8 deve exibir a lupa "Buscar endereço pelo CEP" no campo CEP do endereço, sem o link "Consultar CEP nos Correios" (Issue front#616/PR #619)', () => {
      AtendimentosPage.elements.listaEnderecosCliente().first().click({ force: true });
      ClientesPage.lupaDoCep('client').scrollIntoView({ duration: 300 }).should('be.visible');
      ClientesPage.linkDosCorreios().should('not.exist');
      cy.get('a[href*="correios"]').should('not.exist');
    });

    // Documento (CPF/CNPJ) travado após preenchido (Issue front#527/PR #531): neste drawer o
    // campo NUNCA fica disabled (continua sendo a busca de troca de cliente do atendimento,
    // Issue front#457) — a trava aqui é comportamental: digitar não suja o formulário, não
    // dispara PATCH, e sair sem escolher uma sugestão devolve o documento gravado. O cliente
    // deste context (mockClientDetailData) já tem document ('01992573298').
    it('1.9 documento já preenchido: deve exibir a dica de bloqueio, buscar sem marcar o formulário como alterado e restaurar o valor gravado ao sair sem selecionar', () => {
      AtendimentosPage.elements.hintDocumentoTravadoDrawer()
        .should('be.visible')
        .and('contain.text', 'O documento (CPF/CNPJ) já preenchido não pode ser alterado. Digite para buscar outro cliente.');

      IniciarAtendimentoMocks.interceptarBuscaCliente({ items: [], total: 0 });
      AtendimentosPage.elements.btnSalvarDadosCliente().should('be.disabled');
      AtendimentosPage.elements.inputDocumentoCliente().clear().type('70221440100');
      cy.wait('@searchClients');

      // Buscar não é editar: o botão Salvar segue desabilitado e nenhum PATCH é disparado
      AtendimentosPage.elements.btnSalvarDadosCliente().should('be.disabled');
      cy.get('@patchClient.all').should('have.length', 0);

      // Sair do campo sem escolher uma sugestão devolve o documento gravado
      AtendimentosPage.elements.inputNomeOuRazaoSocialCliente().click();
      AtendimentosPage.elements.inputDocumentoCliente().should('have.value', '019.925.732-98');
    });

    it('1.10 cliente sem documento: deve manter o campo editável como busca/edição dupla, habilitando Salvar e persistindo o documento digitado no PATCH quando nenhuma sugestão for escolhida', () => {
      AtendimentosMocks.interceptClientDetailApi('*', { ...AtendimentosMocks.mockClientDetailData, document: null });
      cy.reload();
      AtendimentosPage.elements.tituloAtendimentos().should('be.visible');
      AtendimentosPage.garantirAtendimentoAberto(CELULAR_PADRAO, 'nao_oficial');
      AtendimentosPage.aguardarHistoricoMensagensCarregado();
      AtendimentosPage.abrirDrawerDadosCliente();
      cy.wait('@getClientDetail');

      AtendimentosPage.elements.hintDocumentoTravadoDrawer().should('not.exist');
      IniciarAtendimentoMocks.interceptarBuscaCliente({ items: [], total: 0 });
      AtendimentosPage.elements.btnSalvarDadosCliente().should('be.disabled');
      AtendimentosPage.elements.inputDocumentoCliente().type('70221440100');
      cy.wait('@searchClients');

      AtendimentosPage.elements.btnSalvarDadosCliente().should('not.be.disabled').click();
      cy.wait('@patchClient').its('request.body').should('deep.equal', { document: '70221440100' });
    });
  });

  // -------------------------------------------------------------
  // 2. PAINEL "DADOS DO CLIENTE" - FALLBACK DE LISTA DE ENDEREÇOS VAZIA
  // -------------------------------------------------------------

  context('2. Painel "Dados do Cliente" - Fallback de Lista de Endereços Vazia', () => {
    let originalUseMocksState;

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
      Cypress.env('USE_MOCKS_FORCED_BY_TEST', true);
    });

    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
      Cypress.env('USE_MOCKS_FORCED_BY_TEST', false);
    });

    beforeEach(() => {
      RecursosMocks.interceptResources();
      AtendimentosMocks.interceptClientCapabilitiesApi();
      AtendimentosMocks.interceptAttendanceDetailApi('*', {
        ...AtendimentosMocks.mockAttendanceDetailData,
        customer: { ...AtendimentosMocks.mockAttendanceDetailData.customer, customer_id: 867092 }
      });
      const clienteSemEndereco = { ...AtendimentosMocks.mockClientDetailData, addresses: [] };
      AtendimentosMocks.interceptClientDetailApi('*', clienteSemEndereco);
      cy.reload();
      AtendimentosPage.elements.tituloAtendimentos().should('be.visible');
      AtendimentosPage.elements.cardsAtendimento().first().click();
      // Timeout generoso: bug real de performance documentado no ROADMAP.md P0 (GET .../messages
      // com efeito de limiar per_page=10→20, 9-21s de latência em modo API Real).
      cy.wait('@getAttendanceMessages', { timeout: 60000 });
      AtendimentosPage.abrirDrawerDadosCliente();
      cy.wait('@getClientDetail');
    });

    it('2.1 deve exibir a mensagem de fallback "Nenhum endereço salvo" quando o cliente não possui endereços cadastrados', () => {
      // Sem endereços, a lista/radios não existe e o formulário de criação já vem aberto direto
      // (não há botão "Adicionar novo endereço" nesse estado — confirmado via snapshot de DOM real:
      // sem endereço prévio para selecionar, o componente já entra em modo de criação).
      AtendimentosPage.elements.listaEnderecosCliente().should('not.exist');
      AtendimentosPage.elements.hintSemEnderecoCliente().scrollIntoView({ duration: 300 }).should('be.visible');
      AtendimentosPage.elements.inputApelidoEnderecoCliente().scrollIntoView({ duration: 300 }).should('be.visible').and('have.value', '');
    });
  });

  // -------------------------------------------------------------
  // 3. DIÁLOGO "VINCULAR CLIENTE AO ATENDIMENTO" (ISSUE #440/#441, PR #470)
  // -------------------------------------------------------------

  context('3. Diálogo "Vincular Cliente ao Atendimento" (Issue #440/#441, PR #470)', () => {
    let originalUseMocksState;

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
    });

    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    beforeEach(() => {
      IniciarAtendimentoMocks.interceptarBuscaCliente();
      AtendimentosPage.elements.cardsAtendimento().first().click();
      AtendimentosPage.elements.btnClienteStatus().click();
    });

    it('3.1 deve exibir a opção "Vincular cliente" no menu quando o atendimento não tem cliente vinculado', () => {
      AtendimentosPage.elements.menuVincularCliente().should('be.visible').and('contain.text', 'Vincular cliente');
    });

    it('3.2 deve rolar a lista de sugestões com a roda do mouse sem perder a navegação por teclado (regressão corrigida na PR #470)', () => {
      const muitosClientes = {
        items: Array.from({ length: 15 }, (_, i) => ({
          id: 900000 + i,
          name: `MARIA TESTE ${String(i).padStart(2, '0')}`,
          cpf_cnpj: '***.111.222-**',
          phone: { prefix: '62', number: `99900${String(i).padStart(4, '0')}`, whatsapp: true },
          phone_count: 1
        })),
        total: 15
      };
      IniciarAtendimentoMocks.interceptarBuscaCliente(muitosClientes);

      AtendimentosPage.elements.menuVincularCliente().click();
      AtendimentosPage.elements.modalVincularCliente().should('be.visible');
      AtendimentosPage.elements.inputBuscaVincularCliente().type('mar');
      cy.wait('@searchClients');
      AtendimentosPage.elements.listaSugestoesVincularCliente().should('be.visible');

      // Pré-condição: a lista precisa realmente transbordar, senão o scroll não prova nada.
      AtendimentosPage.elements.listaSugestoesVincularCliente().should(($lista) => {
        const el = $lista[0];
        expect(el.scrollHeight, 'lista deve transbordar para o teste de scroll fazer sentido').to.be.greaterThan(el.clientHeight);
      });

      // cy.trigger('wheel') dispara um WheelEvent não confiável (isTrusted: false) — o Chrome não
      // executa o scroll nativo por ele. cy.scrollTo() prova o mesmo regressão de forma real: só
      // funciona se o elemento for de fato rolável (overflow correto); se o conflito de CSS da
      // PR #470 reaparecer, o próprio comando falha ("This element is not scrollable").
      AtendimentosPage.elements.listaSugestoesVincularCliente().scrollTo('bottom', { duration: 200 });
      AtendimentosPage.elements.listaSugestoesVincularCliente().should(($l) => {
        expect($l[0].scrollTop, 'lista deve responder ao scroll até o fim (bug da PR #470: CSS bloqueava o overflow)').to.be.greaterThan(0);
      });

      // Navegação por teclado continua funcionando após o scroll (mesmo componente compartilhado).
      AtendimentosPage.elements.inputBuscaVincularCliente()
        .invoke('attr', 'aria-activedescendant')
        .then((ativoAntes) => {
          AtendimentosPage.elements.inputBuscaVincularCliente().type('{downarrow}');
          AtendimentosPage.elements.inputBuscaVincularCliente()
            .should('have.attr', 'aria-activedescendant')
            .and('not.eq', ativoAntes);
        });
    });

    it('3.3 deve vincular o cliente selecionado, fechar o diálogo e exibir o aviso de sucesso (PR #470)', () => {
      AtendimentosMocks.interceptLinkCustomerApi();

      AtendimentosPage.elements.menuVincularCliente().click();
      AtendimentosPage.elements.inputBuscaVincularCliente().type('mar');
      cy.wait('@searchClients');
      AtendimentosPage.elements.getSugestaoVincularClientePorId(867092).click();
      AtendimentosPage.elements.btnVincularClienteConfirmar().should('not.be.disabled').click();
      cy.wait('@linkCustomerPatch');

      AtendimentosPage.elements.modalVincularCliente().should('not.exist');
      AtendimentosPage.elements.avisoVincularClienteSucesso().should('be.visible').and('contain.text', 'Cliente vinculado ao atendimento.');
    });

    it('3.4 deve manter o diálogo aberto com o erro em destaque quando o vínculo falhar, permitindo tentar de novo sem recadastrar (PR #470)', () => {
      AtendimentosMocks.interceptLinkCustomerApi('*', null, 500);

      AtendimentosPage.elements.menuVincularCliente().click();
      AtendimentosPage.elements.inputBuscaVincularCliente().type('mar');
      cy.wait('@searchClients');
      AtendimentosPage.elements.getSugestaoVincularClientePorId(867092).click();
      AtendimentosPage.elements.btnVincularClienteConfirmar().should('not.be.disabled').click();
      cy.wait('@linkCustomerPatch');

      // Diálogo continua aberto com o erro inline — nunca um toast solto atrás do diálogo (PR #470).
      AtendimentosPage.elements.modalVincularCliente().should('be.visible');
      AtendimentosPage.elements.erroVincularClienteInline().should('be.visible').and('contain.text', 'Não foi possível vincular o cliente. Tente novamente.');

      // Tentar de novo funciona sem recadastrar o cliente (mesma seleção, novo PATCH bem-sucedido).
      AtendimentosMocks.interceptLinkCustomerApi();
      AtendimentosPage.elements.btnVincularClienteConfirmar().should('not.be.disabled').click();
      cy.wait('@linkCustomerPatch');
      AtendimentosPage.elements.modalVincularCliente().should('not.exist');
      AtendimentosPage.elements.avisoVincularClienteSucesso().should('be.visible');
    });

    it('3.5 deve exibir a mensagem "Cliente não encontrado" (422), distinta do erro genérico, quando o cliente selecionado não existir mais (Issue #440/#441)', () => {
      AtendimentosMocks.interceptLinkCustomerApi('*', { error: 'CUSTOMER_NOT_FOUND', message: 'Cliente não encontrado.' }, 422);

      AtendimentosPage.elements.menuVincularCliente().click();
      AtendimentosPage.elements.inputBuscaVincularCliente().type('mar');
      cy.wait('@searchClients');
      AtendimentosPage.elements.getSugestaoVincularClientePorId(867092).click();
      AtendimentosPage.elements.btnVincularClienteConfirmar().should('not.be.disabled').click();
      cy.wait('@linkCustomerPatch');

      AtendimentosPage.elements.modalVincularCliente().should('be.visible');
      AtendimentosPage.elements.erroVincularClienteInline()
        .should('be.visible')
        .and('contain.text', 'Cliente não encontrado. Busque novamente.')
        .and('not.contain.text', 'Não foi possível vincular o cliente. Tente novamente.');
    });

    // Corrigido em 2026-10-19 (Issue front#597): o vermelho que aqui se lia como "gap do front" vinha do mock. O `GET .../attendances/:id` do beforeEach é estático e devolve
    // sempre um atendimento SEM cliente (`customer` sem `customer_id`); o PATCH do vínculo devolve `customer_id: 867092`, mas a tela não monta o detalhe a partir dessa resposta, e sim
    // do GET. O front invalida o detalhe no onSuccess da mutação (`invalidateAttendanceOwnedSurfaces`), refaz o GET e, recebendo de novo um atendimento sem cliente, mantém
    // "Vincular cliente": o comportamento certo para o dado recebido. Por isso o teste registra de novo o GET do detalhe, já com o cliente, antes de confirmar (o intercept
    // registrado por último vence, e o GET do carregamento inicial, feito antes, segue sem cliente) e espera o refetch. "Dados do cliente" só renderiza no popover com
    // `can_update_client` (client-capabilities) e o recurso `patient` contratado (GET /resources, como no ctx 1): o ctx 3 não os registra, então o teste os registra.
    it('3.6 deve mostrar "Dados do cliente" no menu ⋮, e não "Vincular cliente", depois de vincular com sucesso, quando o detalhe refeito já traz o cliente (invalidação do onSuccess, Issue #440/#441)', () => {
      RecursosMocks.interceptResources();
      AtendimentosMocks.interceptClientCapabilitiesApi();
      AtendimentosMocks.interceptLinkCustomerApi();
      // Recarrega e reabre o diálogo para a tela buscar as capabilities já mockadas; o GET do detalhe segue sem cliente (o do carregamento é anterior ao intercept abaixo)
      AtendimentosPage.reabrirAtendimentoEAbrirDialogoVincularCliente();
      const base = AtendimentosMocks.mockAttendanceDetailData;
      AtendimentosMocks.interceptAttendanceDetailApi('*', {
        ...base,
        customer: { ...base.customer, customer_id: 867092, name: 'KLISMAM MONTEIRO' },
      });

      AtendimentosPage.elements.inputBuscaVincularCliente().type('mar');
      cy.wait('@searchClients');
      AtendimentosPage.elements.getSugestaoVincularClientePorId(867092).click();
      AtendimentosPage.elements.btnVincularClienteConfirmar().should('not.be.disabled').click();
      cy.wait('@linkCustomerPatch');
      cy.wait('@getAttendanceDetail'); // refetch disparado pela invalidação
      AtendimentosPage.elements.modalVincularCliente().should('not.exist');

      AtendimentosPage.elements.btnClienteStatus().click();
      AtendimentosPage.elements.btnMenuEditarCliente().should('be.visible');
      AtendimentosPage.elements.menuVincularCliente().should('not.exist');
    });

    // -----------------------------------------------------------
    // Cadastro de cliente a partir do diálogo "Vincular cliente" (Issue front#497, PR #499) —
    // o rodapé ganha o botão "Cadastrar novo", que abre o MESMO modal "Novo Cliente" da tela de
    // Clientes (NewClientModalSession, confirmado via bundle real de app.omnicare.dev.local); ao
    // gravar, o cliente criado já fica vinculado ao atendimento (mesma mutation `PATCH
    // customer_id` do "Vincular cliente" existente). Botão só renderiza com `can_create_client`
    // concedida (GET /client-capabilities) — RBAC bidirecional dessa capability fica em
    // `1.permissoes.cy.js` (AGENTS.md [R-SUITE]); aqui assume-se a permissão já concedida.
    // -----------------------------------------------------------
    it('3.7 deve exibir o botão "Cadastrar novo" no rodapé, ao lado de Cancelar e Vincular, quando a capability de criar cliente estiver concedida (Issue front#497, PR #499)', () => {
      AtendimentosMocks.interceptClientCapabilitiesApi();
      AtendimentosPage.reabrirAtendimentoEAbrirDialogoVincularCliente();

      AtendimentosPage.elements.btnVincularClienteCadastrarNovo().should('be.visible').and('contain.text', 'Cadastrar novo');
      AtendimentosPage.elements.btnVincularClienteCancelar().should('be.visible');
      AtendimentosPage.elements.btnVincularClienteConfirmar().should('be.visible');
    });

    it('3.8 deve fechar a busca e abrir o modal "Novo Cliente" ao clicar em "Cadastrar novo" (Issue front#497, PR #499)', () => {
      AtendimentosMocks.interceptClientCapabilitiesApi();
      AtendimentosMocks.interceptClientGroupsApi();
      AtendimentosPage.reabrirAtendimentoEAbrirDialogoVincularCliente();

      AtendimentosPage.elements.btnVincularClienteCadastrarNovo().click();

      AtendimentosPage.elements.modalVincularCliente().should('not.exist');
      AtendimentosPage.elements.modalNovoCliente().should('be.visible');
    });

    it('3.9 deve criar o cliente, vincular automaticamente ao atendimento e exibir o aviso de sucesso (Issue front#497, PR #499)', () => {
      AtendimentosMocks.interceptClientCapabilitiesApi(AtendimentosMocks.mockClientCapabilitiesAllWaivedData);
      AtendimentosMocks.interceptClientGroupsApi();
      AtendimentosMocks.interceptCreateClientApi();
      AtendimentosMocks.interceptLinkCustomerApi();
      AtendimentosPage.reabrirAtendimentoEAbrirDialogoVincularCliente();

      AtendimentosPage.elements.btnVincularClienteCadastrarNovo().click();
      AtendimentosPage.elements.modalNovoCliente().should('be.visible');
      AtendimentosPage.elements.inputNomeNovoCliente().type('Cliente Teste E2E');
      AtendimentosPage.elements.btnSalvarNovoCliente().click();

      cy.wait('@postCreateClientFromAttendance');
      cy.wait('@linkCustomerPatch');

      AtendimentosPage.elements.modalNovoCliente().should('not.exist');
      AtendimentosPage.elements.modalVincularCliente().should('not.exist');
      AtendimentosPage.elements.avisoVincularClienteSucesso()
        .should('be.visible')
        .and('contain.text', 'Cliente cadastrado e vinculado ao atendimento.');
    });

    it('3.10 deve avisar quando o vínculo falhar após criar o cliente, e permitir achá-lo pela busca do "Vincular cliente" sem recadastrar (Issue front#497, PR #499)', () => {
      AtendimentosMocks.interceptClientCapabilitiesApi(AtendimentosMocks.mockClientCapabilitiesAllWaivedData);
      AtendimentosMocks.interceptClientGroupsApi();
      AtendimentosMocks.interceptCreateClientApi();
      AtendimentosMocks.interceptLinkCustomerApi('*', null, 500);
      AtendimentosPage.reabrirAtendimentoEAbrirDialogoVincularCliente();

      AtendimentosPage.elements.btnVincularClienteCadastrarNovo().click();
      AtendimentosPage.elements.inputNomeNovoCliente().type('Cliente Teste E2E');
      AtendimentosPage.elements.btnSalvarNovoCliente().click();
      cy.wait('@postCreateClientFromAttendance');
      cy.wait('@linkCustomerPatch');

      // O modal fecha mesmo com o vínculo falhando (cliente já foi criado) - aviso específico,
      // distinto do genérico usado para o PATCH de cliente já existente.
      AtendimentosPage.elements.modalNovoCliente().should('not.exist');
      AtendimentosPage.elements.modalVincularCliente().should('not.exist');
      AtendimentosPage.elements.avisoVincularClienteSucesso()
        .should('be.visible')
        .and('contain.text', 'Cliente cadastrado, mas não foi possível vinculá-lo. Use "Vincular cliente" para tentar de novo.');

      // Reabre "Vincular cliente" e acha o cliente recém-criado pela busca, sem recadastrar
      IniciarAtendimentoMocks.interceptarBuscaCliente({
        items: [{
          id: 999101,
          name: 'Cliente Teste E2E',
          cpf_cnpj: null,
          phone: { prefix: '62', number: '993225337', whatsapp: false },
          phone_count: 1
        }],
        total: 1
      });
      AtendimentosMocks.interceptLinkCustomerApi();
      AtendimentosPage.elements.btnClienteStatus().click();
      AtendimentosPage.elements.menuVincularCliente().click();
      AtendimentosPage.elements.inputBuscaVincularCliente().type('cliente');
      cy.wait('@searchClients');
      AtendimentosPage.elements.getSugestaoVincularClientePorId(999101).click();
      AtendimentosPage.elements.btnVincularClienteConfirmar().should('not.be.disabled').click();
      cy.wait('@linkCustomerPatch');
      AtendimentosPage.elements.modalVincularCliente().should('not.exist');
      AtendimentosPage.elements.avisoVincularClienteSucesso().should('be.visible').and('contain.text', 'Cliente vinculado ao atendimento.');
    });

    it('3.11 deve avisar sobre falta de permissão quando o vínculo falhar com 403 após criar o cliente (Issue front#497, PR #499)', () => {
      AtendimentosMocks.interceptClientCapabilitiesApi(AtendimentosMocks.mockClientCapabilitiesAllWaivedData);
      AtendimentosMocks.interceptClientGroupsApi();
      AtendimentosMocks.interceptCreateClientApi();
      AtendimentosMocks.interceptLinkCustomerApi('*', null, 403);
      AtendimentosPage.reabrirAtendimentoEAbrirDialogoVincularCliente();

      AtendimentosPage.elements.btnVincularClienteCadastrarNovo().click();
      AtendimentosPage.elements.inputNomeNovoCliente().type('Cliente Teste E2E');
      AtendimentosPage.elements.btnSalvarNovoCliente().click();
      cy.wait('@postCreateClientFromAttendance');
      cy.wait('@linkCustomerPatch');

      AtendimentosPage.elements.avisoVincularClienteSucesso()
        .should('be.visible')
        .and('contain.text', 'Cliente cadastrado, mas você não tem permissão para vinculá-lo ao atendimento.');
    });

    it('3.12 não deve fechar o modal "Novo Cliente" pelo X, Escape ou clique fora enquanto o cadastro está gravando (Issue front#497, PR #499)', () => {
      AtendimentosMocks.interceptClientCapabilitiesApi(AtendimentosMocks.mockClientCapabilitiesAllWaivedData);
      AtendimentosMocks.interceptClientGroupsApi();
      AtendimentosMocks.interceptCreateClientApi(null, 201, 3000);
      AtendimentosMocks.interceptLinkCustomerApi();
      AtendimentosPage.reabrirAtendimentoEAbrirDialogoVincularCliente();

      AtendimentosPage.elements.btnVincularClienteCadastrarNovo().click();
      AtendimentosPage.elements.inputNomeNovoCliente().type('Cliente Teste E2E');
      AtendimentosPage.elements.btnSalvarNovoCliente().click();

      // Ainda gravando (delay de 3s) - X, Escape e clique fora não devem fechar. O modal bloqueia
      // o fechamento de propósito durante a gravação (ver ROADMAP.md); force:true é necessário
      // aqui pra forçar o clique através do bloqueio e confirmar que o handler realmente ignora
      // a ação (sem force, o Cypress recusa clicar e o teste nunca prova o bloqueio de verdade).
      AtendimentosPage.elements.btnFecharNovoCliente().click({ force: true });
      AtendimentosPage.elements.modalNovoCliente().should('be.visible');

      cy.get('body').type('{esc}');
      AtendimentosPage.elements.modalNovoCliente().should('be.visible');

      AtendimentosPage.elements.overlayNovoCliente().click('topLeft');
      AtendimentosPage.elements.modalNovoCliente().should('be.visible');

      cy.wait('@postCreateClientFromAttendance');
      cy.wait('@linkCustomerPatch');
      AtendimentosPage.elements.modalNovoCliente().should('not.exist');
    });

    it('3.13 ao abrir o cadastro com um drawer lateral aberto (Notas Internas) e apertar Escape com o formulário vazio, deve fechar só o modal "Novo Cliente", mantendo o drawer aberto (Issue front#497, PR #499)', () => {
      AtendimentosMocks.interceptClientCapabilitiesApi();
      AtendimentosMocks.interceptClientGroupsApi();
      AtendimentosMocks.interceptInternalNotesApi('*', []);
      cy.reload();
      AtendimentosPage.elements.cardsAtendimento().first().click();
      AtendimentosPage.abrirGavetaNotasInternas();
      AtendimentosPage.elements.btnClienteStatus().click();
      AtendimentosPage.elements.menuVincularCliente().click();
      AtendimentosPage.elements.btnVincularClienteCadastrarNovo().click();
      AtendimentosPage.elements.modalNovoCliente().should('be.visible');

      cy.get('body').type('{esc}');

      AtendimentosPage.elements.modalNovoCliente().should('not.exist');
      AtendimentosPage.elements.drawerNotasInternas().should('be.visible');
    });

    it('3.14 ao abrir o cadastro com um drawer lateral aberto e apertar Escape com o formulário preenchido, deve perguntar "Descartar este cadastro?" mantendo o drawer aberto (Issue front#497, PR #499)', () => {
      AtendimentosMocks.interceptClientCapabilitiesApi();
      AtendimentosMocks.interceptClientGroupsApi();
      AtendimentosMocks.interceptInternalNotesApi('*', []);
      cy.reload();
      AtendimentosPage.elements.cardsAtendimento().first().click();
      AtendimentosPage.abrirGavetaNotasInternas();
      AtendimentosPage.elements.btnClienteStatus().click();
      AtendimentosPage.elements.menuVincularCliente().click();
      AtendimentosPage.elements.btnVincularClienteCadastrarNovo().click();
      AtendimentosPage.elements.modalNovoCliente().should('be.visible');

      AtendimentosPage.elements.inputNomeNovoCliente().type('Rascunho Novo Cliente');
      cy.get('body').type('{esc}');

      AtendimentosPage.elements.modalDescartarCadastroNovoCliente().should('be.visible').and('contain.text', 'Descartar este cadastro?');
      AtendimentosPage.elements.modalNovoCliente().should('exist');
      AtendimentosPage.elements.drawerNotasInternas().should('be.visible');

      AtendimentosPage.elements.btnConfirmarDescartarCadastroNovoCliente().click();
      AtendimentosPage.elements.modalNovoCliente().should('not.exist');
      AtendimentosPage.elements.drawerNotasInternas().should('be.visible');
    });

    // O antigo #3.15 ("fechar o modal Novo Cliente ao trocar de atendimento com o cadastro aberto") foi removido em 2026-11-06 (ROADMAP.md P1-14, decisão do operador):
    // só existia com force:true. A modal prende o foco e cobre a fila, e abrir um card não cria entrada no histórico, então nenhum usuário troca de atendimento com ela aberta.
  });

  // -------------------------------------------------------------
  // 4. GUARDA DE SAÍDA AO FECHAR GAVETAS COM TEXTO NÃO SALVO (ISSUE #345, PR #459/#465)
  // -------------------------------------------------------------

  context('4. Guarda de Saída ao Fechar Gavetas com Texto Não Salvo (Issue #345, PR #459/#465)', () => {
    let originalUseMocksState;

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
    });

    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    beforeEach(() => {
      AtendimentosMocks.interceptInternalNotesApi('*', []);
      AtendimentosPage.elements.cardsAtendimento().first().click();
    });

    it('4.1 deve abrir "Descartar texto?" ao clicar no X da gaveta de Notas Internas com texto não salvo — "Continuar editando" preserva o texto e "Descartar" limpa e fecha', () => {
      AtendimentosPage.abrirGavetaNotasInternas();
      AtendimentosPage.elements.inputNotaInterna().type('Rascunho não salvo de teste');

      // 1. X da gaveta abre o diálogo, sem fechar nada ainda
      AtendimentosPage.elements.btnFecharGavetaLateral().first().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('be.visible').and('contain.text', 'Descartar texto?');
      AtendimentosPage.elements.drawerNotasInternas().should('be.visible');

      // 2. "Continuar editando" mantém a gaveta aberta com o texto intacto
      AtendimentosPage.elements.btnDescartarTextoManterEditando().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('not.exist');
      AtendimentosPage.elements.inputNotaInterna().should('be.visible').and('have.value', 'Rascunho não salvo de teste');

      // 3. Tentar fechar de novo e "Descartar" limpa o texto e fecha a gaveta
      AtendimentosPage.elements.btnFecharGavetaLateral().first().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('be.visible');
      AtendimentosPage.elements.btnDescartarTextoConfirmar().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('not.exist');
      AtendimentosPage.elements.drawerNotasInternas().should('not.exist');
      // Aguarda o wrapper da gaveta desmontar de verdade (não só o <aside>), senão a animação de
      // saída pode vazar e engolir o clique de abertura do próximo teste (achado 2026-09-29,
      // mesmo padrão já documentado em fecharGavetaNotasInternas()/fecharGavetaObservacoes()).
      cy.get('[class*="_sideDrawerWrapOpen_"]').should('not.exist');
    });

    it('4.2 deve disparar o mesmo diálogo ao pressionar Esc com texto não salvo na gaveta', () => {
      AtendimentosPage.abrirGavetaNotasInternas();
      AtendimentosPage.elements.inputNotaInterna().type('Rascunho via Esc');

      cy.get('body').type('{esc}');
      AtendimentosPage.elements.dialogDescartarTexto().should('be.visible');
      AtendimentosPage.elements.drawerNotasInternas().should('be.visible');
    });

    it('4.3 deve disparar o diálogo ao clicar em "Mostrar fila" — "Continuar editando" não deve expandir a fila (preferência do atendente inalterada)', () => {
      AtendimentosPage.abrirGavetaNotasInternas();
      AtendimentosPage.elements.inputNotaInterna().type('Rascunho antes de mostrar fila');
      AtendimentosPage.elements.cardsAtendimentoCompactos().should('exist');

      cy.get('[data-testid="button-queue-show"]').click();
      AtendimentosPage.elements.dialogDescartarTexto().should('be.visible');
      AtendimentosPage.elements.btnDescartarTextoManterEditando().click();

      // A fila continua recolhida (compacta) — o toggle nunca foi de fato executado
      AtendimentosPage.elements.cardsAtendimentoCompactos().should('exist');
      AtendimentosPage.elements.inputNotaInterna().should('have.value', 'Rascunho antes de mostrar fila');
    });

    it('4.4 deve disparar o diálogo ao clicar na lupa da busca com a fila recolhida', () => {
      AtendimentosPage.abrirGavetaNotasInternas();
      AtendimentosPage.elements.inputNotaInterna().type('Rascunho antes da busca');

      cy.get('[data-testid="button-chat-search"], [data-testid="button-search-expand"]').first().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('be.visible');
      AtendimentosPage.elements.drawerNotasInternas().should('be.visible');
    });

    it('4.5 deve disparar o diálogo ao tentar abrir outro painel (IA) — "Descartar" fecha Notas Internas e abre o painel escolhido', () => {
      AtendimentosPage.abrirGavetaNotasInternas();
      AtendimentosPage.elements.inputNotaInterna().type('Rascunho antes do painel IA');

      cy.get('[data-testid="btn-header-ia"]').click();
      AtendimentosPage.elements.dialogDescartarTexto().should('be.visible');

      AtendimentosPage.elements.btnDescartarTextoConfirmar().click();
      AtendimentosPage.elements.drawerNotasInternas().should('not.exist');
      // Ao trocar para outro painel (em vez de fechar para nada), o wrapper da gaveta é
      // reaproveitado para o novo conteúdo — continua "aberto" de propósito, só troca o que
      // renderiza dentro. Sem checagem de _sideDrawerWrapOpen_ aqui (achado 2026-09-29): ela
      // nunca fecha nesse caminho, diferente de "fechar para nada" nos outros testes deste ctx.
      cy.get('[data-testid="painel-ia-mensagens"]', { timeout: 5000 }).should('be.visible');
    });

    it('4.6 deve disparar o mesmo diálogo ao fechar a gaveta de Observações com texto não salvo', () => {
      AtendimentosPage.abrirGavetaObservacoes();
      AtendimentosPage.elements.inputEscreverObservacao().type('Observação não salva de teste');

      AtendimentosPage.elements.btnFecharGavetaLateral().first().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('be.visible');
      AtendimentosPage.elements.drawerObservacoes().should('be.visible');

      AtendimentosPage.elements.btnDescartarTextoConfirmar().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('not.exist');
      AtendimentosPage.elements.drawerObservacoes().should('not.exist');
      cy.get('[class*="_sideDrawerWrapOpen_"]').should('not.exist');
    });

    it('4.7 contraprova: não deve perguntar quando o campo estiver vazio — fecha direto', () => {
      AtendimentosPage.abrirGavetaNotasInternas();
      // Campo vazio (nunca digitado) — X deve fechar sem diálogo algum
      AtendimentosPage.elements.btnFecharGavetaLateral().first().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('not.exist');
      AtendimentosPage.elements.drawerNotasInternas().should('not.exist');
      cy.get('[class*="_sideDrawerWrapOpen_"]').should('not.exist');
    });

    it('4.8 contraprova: não deve perguntar logo depois de Salvar — fecha direto', () => {
      AtendimentosMocks.interceptCreateInternalNoteApi('*');
      AtendimentosPage.abrirGavetaNotasInternas();
      AtendimentosPage.elements.inputNotaInterna().type('Nota que será salva antes de fechar');
      AtendimentosPage.elements.btnSalvarNotaInterna().click();
      cy.wait('@createInternalNote');

      AtendimentosPage.elements.btnFecharGavetaLateral().first().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('not.exist');
      AtendimentosPage.elements.drawerNotasInternas().should('not.exist');
      cy.get('[class*="_sideDrawerWrapOpen_"]').should('not.exist');
    });

    it('4.9 contraprova: não deve perguntar enquanto a nota está sendo enviada (request em voo)', () => {
      AtendimentosMocks.interceptCreateInternalNoteApi('*', 3000);
      AtendimentosPage.abrirGavetaNotasInternas();
      AtendimentosPage.elements.inputNotaInterna().type('Nota em envio no momento do fechamento');
      AtendimentosPage.elements.btnSalvarNotaInterna().click();

      // Fecha enquanto o POST ainda está em voo (delay de 3s) — não deve perguntar, o texto já
      // está a caminho do servidor.
      AtendimentosPage.elements.btnFecharGavetaLateral().first().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('not.exist');
      AtendimentosPage.elements.drawerNotasInternas().should('not.exist');
      cy.get('[class*="_sideDrawerWrapOpen_"]').should('not.exist');

      cy.wait('@createInternalNote');
    });

    // -----------------------------------------------------------
    // Refactor do ConfirmDialog compartilhado (Issue #458, PR #463) — o mesmo diálogo genérico
    // passou de features/client/presentation/ para shared/components/ConfirmDialog/, sem mudar
    // testid nem visual. 3 comportamentos novos, validados aqui no "Descartar texto?" (superfície
    // apontada pela própria issue como a de maior risco de regressão pelo stopPropagation do Esc).
    // -----------------------------------------------------------
    it('4.10 deve associar a mensagem do diálogo via aria-describedby, para o leitor de tela anunciá-la (Issue #458)', () => {
      AtendimentosPage.abrirGavetaNotasInternas();
      AtendimentosPage.elements.inputNotaInterna().type('Rascunho para checar acessibilidade');
      AtendimentosPage.elements.btnFecharGavetaLateral().first().click();

      AtendimentosPage.elements.dialogDescartarTexto()
        .should('be.visible')
        .invoke('attr', 'aria-describedby')
        .should('be.a', 'string')
        .and('not.be.empty')
        .then((describedById) => {
          AtendimentosPage.elements.mensagemDescartarTexto()
            .should('have.attr', 'id', describedById)
            .and('contain.text', 'O texto digitado ainda não foi salvo e será perdido.');
        });
    });

    it('4.11 deve cancelar com Esc sem fechar a gaveta por trás do diálogo (stopPropagation, Issue #458)', () => {
      AtendimentosPage.abrirGavetaNotasInternas();
      AtendimentosPage.elements.inputNotaInterna().type('Rascunho para checar o Esc');
      AtendimentosPage.elements.btnFecharGavetaLateral().first().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('be.visible');

      cy.get('body').type('{esc}');

      // O diálogo cancela (some), mas o Esc não deve subir e fechar a gaveta por trás — o texto
      // continua lá, intacto (achado do bug original da #345, preservado pelo refactor da #458).
      AtendimentosPage.elements.dialogDescartarTexto().should('not.exist');
      AtendimentosPage.elements.drawerNotasInternas().should('be.visible');
      AtendimentosPage.elements.inputNotaInterna().should('have.value', 'Rascunho para checar o Esc');
    });

    it('4.12 não deve cancelar ao arrastar uma seleção de texto de dentro do diálogo e soltar no fundo (Issue #458)', () => {
      AtendimentosPage.abrirGavetaNotasInternas();
      AtendimentosPage.elements.inputNotaInterna().type('Rascunho para checar o drag de seleção');
      AtendimentosPage.elements.btnFecharGavetaLateral().first().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('be.visible');

      // Simula selecionar o texto da mensagem (mousedown dentro) e soltar fora, no fundo escuro.
      AtendimentosPage.elements.mensagemDescartarTexto().trigger('mousedown', { which: 1 });
      AtendimentosPage.elements.overlayDescartarTexto().trigger('mousemove').trigger('mouseup', { which: 1 });

      AtendimentosPage.elements.dialogDescartarTexto().should('be.visible');
      AtendimentosPage.elements.drawerNotasInternas().should('be.visible');
    });

    it('4.13 deve cancelar ao clicar no fundo escuro do diálogo (Issue #458)', () => {
      AtendimentosPage.abrirGavetaNotasInternas();
      AtendimentosPage.elements.inputNotaInterna().type('Rascunho para checar o clique no fundo');
      AtendimentosPage.elements.btnFecharGavetaLateral().first().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('be.visible');

      AtendimentosPage.elements.overlayDescartarTexto().click('topLeft');

      AtendimentosPage.elements.dialogDescartarTexto().should('not.exist');
      AtendimentosPage.elements.drawerNotasInternas().should('be.visible');
    });

    it('4.14 deve exibir "Descartar texto?" ao editar uma observação existente e alterar o texto, preservando a edição em "Continuar editando" e descartando em "Descartar" (Issue front#461, PR #464)', () => {
      const textoOriginal = 'Observação original front#461';
      const textoEditado = 'Observação original front#461 (editada, não salva)';

      AtendimentosPage.abrirGavetaObservacoes();
      AtendimentosPage.criarObservacao(textoOriginal);

      // Edita sem salvar: a guarda da #459 só enxergava o composer de nova observação - a edição
      // de uma observação já existente não publicava nada nela (causa raiz da issue)
      AtendimentosPage.editarObservacaoSemSalvar(textoEditado);

      // 1. X da gaveta abre o diálogo
      AtendimentosPage.elements.btnFecharGavetaLateral().first().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('be.visible').and('contain.text', 'Descartar texto?');
      AtendimentosPage.elements.drawerObservacoes().should('be.visible');

      // 2. "Continuar editando" mantém a gaveta aberta com a edição intacta
      AtendimentosPage.elements.btnDescartarTextoManterEditando().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('not.exist');
      AtendimentosPage.validarValorEdicaoObservacaoAtiva(textoEditado);

      // 3. Tentar fechar de novo e "Descartar" fecha a gaveta
      AtendimentosPage.elements.btnFecharGavetaLateral().first().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('be.visible');
      AtendimentosPage.elements.btnDescartarTextoConfirmar().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('not.exist');
      AtendimentosPage.elements.drawerObservacoes().should('not.exist');
      cy.get('[class*="_sideDrawerWrapOpen_"]').should('not.exist');
    });

    it('4.15 contraprova: não deve perguntar ao editar uma observação existente sem alterar o texto (Issue front#461, PR #464)', () => {
      const textoOriginal = 'Observação sem alteração front#461';

      AtendimentosPage.abrirGavetaObservacoes();
      AtendimentosPage.criarObservacao(textoOriginal);

      AtendimentosPage.editarObservacaoSemSalvar(textoOriginal);

      AtendimentosPage.elements.btnFecharGavetaLateral().first().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('not.exist');
      AtendimentosPage.elements.drawerObservacoes().should('not.exist');
      cy.get('[class*="_sideDrawerWrapOpen_"]').should('not.exist');
    });

    it('4.16 contraprova: não deve perguntar ao alterar só espaços nas pontas do texto de uma observação existente — é o mesmo texto (Issue front#461, PR #464)', () => {
      const textoOriginal = 'Observação com espaços front#461';

      AtendimentosPage.abrirGavetaObservacoes();
      AtendimentosPage.criarObservacao(textoOriginal);

      AtendimentosPage.editarObservacaoSemSalvar(`  ${textoOriginal}  `);

      AtendimentosPage.elements.btnFecharGavetaLateral().first().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('not.exist');
      AtendimentosPage.elements.drawerObservacoes().should('not.exist');
      cy.get('[class*="_sideDrawerWrapOpen_"]').should('not.exist');
    });

    // -----------------------------------------------------------
    // Trocar de observação em edição (Issue front#468, PR #469) — levantado como fora de escopo
    // na correção da #461/PR #464: aquela guarda só protegia o fechamento da gaveta, não a troca
    // de edição de A para B sem fechar nada. Mesmo diálogo "Descartar texto?" (testid
    // drawer-draft-discard-dialog), confirmado reaproveitado via bundle real (NotesDrawerConnected
    // + index chunk de app.omnicare.dev.local) — não é um mecanismo novo.
    // -----------------------------------------------------------
    it('4.17 deve exibir "Descartar texto?" ao editar a observação A, alterar o texto e clicar no lápis de B — "Continuar editando" preserva a edição de A e "Descartar" a descarta e abre B para edição (Issue front#468, PR #469)', () => {
      const textoA = 'Observação A front#468';
      const textoB = 'Observação B front#468';
      const textoAEditado = 'Observação A front#468 (editada, não salva)';

      AtendimentosPage.abrirGavetaObservacoes();
      AtendimentosPage.criarObservacao(textoA);
      AtendimentosPage.criarObservacao(textoB);

      // Edita A sem salvar — o lápis de B continua habilitado durante a edição de A (causa raiz
      // da issue: o gate de ações só considerava salvamento/exclusão/mutação em voo).
      AtendimentosPage.clicarLapisObservacaoPorTexto(textoA);
      AtendimentosPage.elements.inputEdicaoObservacaoTexto().should('be.visible').clear().type(textoAEditado);

      // 1. Lápis de B abre o diálogo, sem trocar a edição ainda
      AtendimentosPage.clicarLapisObservacaoPorTexto(textoB);
      AtendimentosPage.elements.dialogDescartarTexto().should('be.visible').and('contain.text', 'Descartar texto?');
      AtendimentosPage.elements.inputEdicaoObservacaoTexto().should('have.value', textoAEditado);
      AtendimentosPage.getObservacaoPorTexto(textoB).find('[data-testid="observation-edit"]').should('be.visible');

      // 2. "Continuar editando" mantém A em edição com o texto intacto; B não entra em edição
      AtendimentosPage.elements.btnDescartarTextoManterEditando().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('not.exist');
      AtendimentosPage.elements.inputEdicaoObservacaoTexto().should('have.value', textoAEditado);
      AtendimentosPage.getObservacaoPorTexto(textoB).find('[data-testid="observation-edit"]').should('be.visible');

      // 3. Tentar de novo e "Descartar" descarta a edição de A (volta ao texto original salvo) e
      // abre B para edição
      AtendimentosPage.clicarLapisObservacaoPorTexto(textoB);
      AtendimentosPage.elements.dialogDescartarTexto().should('be.visible');
      AtendimentosPage.elements.btnDescartarTextoConfirmar().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('not.exist');
      AtendimentosPage.elements.inputEdicaoObservacaoTexto().should('have.value', textoB);
      AtendimentosPage.getObservacaoPorTexto(textoA).should('contain.text', textoA).and('not.contain.text', textoAEditado);
    });

    it('4.18 contraprova: não deve perguntar ao clicar no lápis de B enquanto edita A sem alterar o texto — troca direto (Issue front#468, PR #469)', () => {
      const textoA = 'Observação A sem alteração front#468';
      const textoB = 'Observação B sem alteração front#468';

      AtendimentosPage.abrirGavetaObservacoes();
      AtendimentosPage.criarObservacao(textoA);
      AtendimentosPage.criarObservacao(textoB);

      AtendimentosPage.clicarLapisObservacaoPorTexto(textoA);
      AtendimentosPage.elements.inputEdicaoObservacaoTexto().should('have.value', textoA);

      AtendimentosPage.clicarLapisObservacaoPorTexto(textoB);
      AtendimentosPage.elements.dialogDescartarTexto().should('not.exist');
      AtendimentosPage.elements.inputEdicaoObservacaoTexto().should('have.value', textoB);
    });

    it('4.19 contraprova: texto não salvo só no compositor de nova observação não aciona a guarda ao editar outra observação, e o texto novo não se perde (Issue front#468, PR #469)', () => {
      const textoA = 'Observação A composer front#468';
      const textoNovoComposer = 'Rascunho de nova observação ainda não salvo front#468';

      AtendimentosPage.abrirGavetaObservacoes();
      AtendimentosPage.criarObservacao(textoA);

      AtendimentosPage.elements.inputEscreverObservacao().should('be.visible').clear().type(textoNovoComposer);

      AtendimentosPage.clicarLapisObservacaoPorTexto(textoA);
      AtendimentosPage.elements.dialogDescartarTexto().should('not.exist');
      AtendimentosPage.elements.inputEdicaoObservacaoTexto().should('have.value', textoA);
      AtendimentosPage.elements.inputEscreverObservacao().should('have.value', textoNovoComposer);
    });

    it('4.20 deve posicionar o cursor no fim do texto ao entrar em edição de uma observação (Issue front#469)', () => {
      const texto = 'Observação com foco no fim do texto front#469';

      AtendimentosPage.abrirGavetaObservacoes();
      AtendimentosPage.criarObservacao(texto);

      AtendimentosPage.clicarLapisObservacaoPorTexto(texto);
      AtendimentosPage.validarCursorNoFimDoTextoEdicaoObservacao(texto);
    });
  });

  // -------------------------------------------------------------
  // 5. BUSCA DE CLIENTE NO DRAWER "DADOS DO CLIENTE" (ISSUE FRONT#457, PR #498)
  // -------------------------------------------------------------

  context('5. Busca de Cliente no Drawer "Dados do Cliente" (Issue front#457, PR #498)', () => {
    let originalUseMocksState;
    const CLIENTE_ATUAL_NOME = 'KLISMAM MONTEIRO';
    const CLIENTE_NOVO_ID = 900001;
    const CLIENTE_NOVO_NOME = 'MARIA TESTE NOVA';

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
    });

    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    const candidatoBusca = (overrides = {}) => ({
      items: [{
        id: CLIENTE_NOVO_ID,
        name: CLIENTE_NOVO_NOME,
        cpf_cnpj: '***.111.222-**',
        phone: { prefix: '62', number: '999000001', whatsapp: true },
        phone_count: 1,
        ...overrides
      }],
      total: 1
    });

    const abrirDrawerComPermissao650 = (canChangeDefaultCustomer = true) => {
      RecursosMocks.interceptResources();
      AtendimentosMocks.interceptClientCapabilitiesApi();
      AtendimentosMocks.interceptClientDetailApi('*');
      AtendimentosMocks.interceptAttendanceItemCapabilitiesApi('*', {
        capabilities: {
          ...AtendimentosMocks.mockAttendanceItemCapabilitiesData.capabilities,
          can_change_default_customer: canChangeDefaultCustomer
        }
      });
      AtendimentosMocks.interceptAttendanceDetailApi('*', {
        ...AtendimentosMocks.mockAttendanceDetailData,
        customer: { ...AtendimentosMocks.mockAttendanceDetailData.customer, customer_id: 867092, name: CLIENTE_ATUAL_NOME }
      });
      IniciarAtendimentoMocks.interceptarBuscaCliente();
      cy.reload();
      AtendimentosPage.elements.tituloAtendimentos().should('be.visible');
      AtendimentosPage.garantirAtendimentoAberto(CELULAR_PADRAO, 'nao_oficial');
      AtendimentosPage.aguardarHistoricoMensagensCarregado();
      AtendimentosPage.abrirDrawerDadosCliente();
      cy.wait('@getClientDetail');
    };

    it('5.1 não deve exibir a lista de sugestões sem a permissão 650 (campos continuam comuns)', () => {
      abrirDrawerComPermissao650(false);
      IniciarAtendimentoMocks.interceptarBuscaCliente(candidatoBusca());

      AtendimentosPage.elements.inputNomeOuRazaoSocialCliente().clear().type('mar');
      AtendimentosPage.elements.getPopoverBuscaClienteDrawer('name').should('not.exist');
      cy.get('@searchClients.all').should('have.length', 0);
    });

    it('5.2 não deve abrir a lista só por focar o campo Nome já preenchido, sem digitar (com a permissão 650)', () => {
      abrirDrawerComPermissao650(true);
      IniciarAtendimentoMocks.interceptarBuscaCliente(candidatoBusca());

      AtendimentosPage.elements.inputNomeOuRazaoSocialCliente().focus();
      AtendimentosPage.elements.getPopoverBuscaClienteDrawer('name').should('not.exist');
      cy.get('@searchClients.all').should('have.length', 0);
    });

    it('5.3 deve exibir só o aviso de mínimo de caracteres ao digitar 2 letras, sem disparar a busca', () => {
      abrirDrawerComPermissao650(true);
      IniciarAtendimentoMocks.interceptarBuscaCliente(candidatoBusca());

      AtendimentosPage.elements.inputNomeOuRazaoSocialCliente().clear().type('ma');
      AtendimentosPage.elements.getPopoverBuscaClienteDrawer('name')
        .should('be.visible')
        .and('contain.text', 'Digite ao menos 3 caracteres para buscar.');
      cy.get('@searchClients.all').should('have.length', 0);
    });

    it('5.4 deve abrir a lista de sugestões ao completar o 3º caractere no campo Nome completo (Pessoa física)', () => {
      abrirDrawerComPermissao650(true);
      IniciarAtendimentoMocks.interceptarBuscaCliente(candidatoBusca());

      AtendimentosPage.elements.inputNomeOuRazaoSocialCliente().clear().type('mar');
      cy.wait('@searchClients');
      AtendimentosPage.elements.getPopoverBuscaClienteDrawer('name')
        .should('be.visible')
        .and('contain.text', CLIENTE_NOVO_NOME);
      AtendimentosPage.elements.getSugestaoBuscaClienteDrawer('name', CLIENTE_NOVO_ID).should('be.visible');
    });

    it('5.5 deve buscar pelo campo Documento com CPF pontuado e sem pontuação, encontrando o cliente nos dois formatos', () => {
      abrirDrawerComPermissao650(true);
      IniciarAtendimentoMocks.interceptarBuscaCliente(candidatoBusca());

      AtendimentosPage.elements.inputDocumentoCliente().clear().type('702.214.401');
      cy.wait('@searchClients');
      AtendimentosPage.elements.getPopoverBuscaClienteDrawer('document').should('contain.text', CLIENTE_NOVO_NOME);

      // Sem cy.wait('@searchClients') aqui de propósito: "702.214.401" e "702214401" normalizam
      // para o mesmo termo de busca — o React Query serve a 2ª consulta do cache em memória, sem
      // round-trip de rede novo (achado ao rodar, 2026-09-30). O critério de aceite é a lista
      // continuar mostrando o cliente com o valor sem pontuação, não a contagem de requisições.
      AtendimentosPage.elements.inputDocumentoCliente().clear().type('702214401');
      AtendimentosPage.elements.getPopoverBuscaClienteDrawer('document').should('contain.text', CLIENTE_NOVO_NOME);
    });

    it('5.6 Pessoa jurídica: Nome Fantasia dispara a busca mas não acha por fantasia (gap aceito, backend#581); Razão Social funciona normalmente', () => {
      abrirDrawerComPermissao650(true);
      AtendimentosPage.elements.radioTipoClientePJ().click({ force: true });

      // Nome Fantasia reusa o mesmo campo/hook de busca (id "edit-client-name"), mas o backend só
      // indexa NOMECLIENTE (Razão Social) — sem match por fantasia até a backend#581 (dev,
      // front#457/PR #498). O request sai (mesma rota), a resposta só não traz candidato.
      IniciarAtendimentoMocks.interceptarBuscaCliente({ items: [], total: 0 });
      AtendimentosPage.elements.inputNomeOuRazaoSocialCliente().clear().type('fantasiateste');
      cy.wait('@searchClients');
      AtendimentosPage.elements.getPopoverBuscaClienteDrawer('name')
        .should('be.visible')
        .and('contain.text', 'Nenhum resultado encontrado.');

      // Razão Social usa o campo dedicado (id "edit-client-company-name") e encontra normalmente.
      IniciarAtendimentoMocks.interceptarBuscaCliente(candidatoBusca());
      AtendimentosPage.elements.inputRazaoSocialClientePJ().clear().type('mar');
      cy.wait('@searchClients');
      AtendimentosPage.elements.getPopoverBuscaClienteDrawer('company-name').should('contain.text', CLIENTE_NOVO_NOME);
    });

    it('5.7 não deve trocar o cliente ao pressionar Enter sem usar as setas do teclado antes', () => {
      abrirDrawerComPermissao650(true);
      IniciarAtendimentoMocks.interceptarBuscaCliente(candidatoBusca());
      AtendimentosMocks.interceptLinkCustomerApi();

      AtendimentosPage.elements.inputNomeOuRazaoSocialCliente().clear().type('mar');
      cy.wait('@searchClients');
      AtendimentosPage.elements.inputNomeOuRazaoSocialCliente().type('{enter}');

      cy.get('@linkCustomerPatch.all').should('have.length', 0);
      AtendimentosPage.elements.getPopoverBuscaClienteDrawer('name').should('be.visible');
    });

    it('5.8 deve trocar o cliente do atendimento ao navegar com seta ↓ e Enter, exibir o aviso de sucesso e reabrir a ficha do cliente escolhido com "Salvar dados" desativado', () => {
      abrirDrawerComPermissao650(true);
      IniciarAtendimentoMocks.interceptarBuscaCliente(candidatoBusca());
      AtendimentosMocks.interceptLinkCustomerApi('*', {
        customer: { customer_id: CLIENTE_NOVO_ID, name: CLIENTE_NOVO_NOME, phone: '5562999000001' }
      });
      AtendimentosMocks.interceptClientDetailApi(CLIENTE_NOVO_ID, {
        ...AtendimentosMocks.mockClientDetailData,
        id: CLIENTE_NOVO_ID,
        name: CLIENTE_NOVO_NOME,
        label_name: CLIENTE_NOVO_NOME
      });

      AtendimentosPage.elements.inputNomeOuRazaoSocialCliente().clear().type('mar');
      cy.wait('@searchClients');

      // cy.wait('@searchClients') só espera a rede, não a renderização das opções: o trace de falha
      // do cypress open (Firefox 158, 2026-10-15) mostrou o campo focado e a lista aberta, mas sem
      // aria-activedescendant — a seta chegou antes de a opção estar pronta e foi ignorada, e o
      // should() abaixo só relê o atributo, não reenvia a tecla. Espera a opção visível antes da seta.
      AtendimentosPage.elements.getSugestaoBuscaClienteDrawer('name', CLIENTE_NOVO_ID).should('be.visible');

      // Mesmo padrão já validado no context 25 (Vincular Cliente): confirmar que o
      // aria-activedescendant realmente mudou após a seta, antes do Enter — em `cypress open`
      // interativo (render real), mandar `{downarrow}{enter}` de uma vez só pode disparar o Enter
      // antes do destaque mover para o item, e o Enter cai no estado "nada selecionado" (sem
      // reproduzir em `cypress run` headless, achado 2026-09-30).
      AtendimentosPage.elements.inputNomeOuRazaoSocialCliente()
        .invoke('attr', 'aria-activedescendant')
        .then((ativoAntes) => {
          AtendimentosPage.elements.inputNomeOuRazaoSocialCliente().type('{downarrow}');
          AtendimentosPage.elements.inputNomeOuRazaoSocialCliente()
            .should('have.attr', 'aria-activedescendant')
            .and('not.eq', ativoAntes);
        });
      AtendimentosPage.elements.inputNomeOuRazaoSocialCliente().type('{enter}');
      cy.wait('@linkCustomerPatch');

      AtendimentosPage.elements.getPopoverBuscaClienteDrawer('name').should('not.exist');
      cy.get('div[role="status"]').should('be.visible').and('contain.text', 'Cliente vinculado ao atendimento.');
      cy.wait('@getClientDetail');
      AtendimentosPage.elements.btnSalvarDadosCliente().should('be.disabled');
    });

    it('5.9 não deve mudar nada ao selecionar o próprio cliente já vinculado à ficha (no-op)', () => {
      abrirDrawerComPermissao650(true);
      IniciarAtendimentoMocks.interceptarBuscaCliente({
        items: [{ id: 867092, name: CLIENTE_ATUAL_NOME, cpf_cnpj: '***.925.732-**', phone: { prefix: '62', number: '993225337', whatsapp: false }, phone_count: 2 }],
        total: 1
      });
      AtendimentosMocks.interceptLinkCustomerApi();

      AtendimentosPage.elements.inputNomeOuRazaoSocialCliente().clear().type('kli');
      cy.wait('@searchClients');
      AtendimentosPage.elements.getSugestaoBuscaClienteDrawer('name', 867092).click();

      AtendimentosPage.elements.getPopoverBuscaClienteDrawer('name').should('not.exist');
      AtendimentosPage.elements.inputNomeOuRazaoSocialCliente().should('have.value', CLIENTE_ATUAL_NOME);
    });

    it('5.10 deve bloquear a troca de cliente com aviso quando a ficha tiver alteração não salva, preservando o valor editado', () => {
      abrirDrawerComPermissao650(true);
      IniciarAtendimentoMocks.interceptarBuscaCliente(candidatoBusca());
      AtendimentosMocks.interceptLinkCustomerApi();

      const rgDinamico = `RG${Date.now()}`.slice(0, 20);
      AtendimentosPage.elements.inputRgCliente().clear().type(rgDinamico);

      AtendimentosPage.elements.inputNomeOuRazaoSocialCliente().clear().type('mar');
      cy.wait('@searchClients');
      AtendimentosPage.elements.getSugestaoBuscaClienteDrawer('name', CLIENTE_NOVO_ID).click();

      AtendimentosPage.elements.avisoBloqueioTrocaClienteDrawer()
        .scrollIntoView({ duration: 300 })
        .should('be.visible')
        .and('contain.text', 'Salve ou desfaça as alterações desta ficha antes de trocar o cliente do atendimento.');
      cy.get('@linkCustomerPatch.all').should('have.length', 0);
      AtendimentosPage.elements.inputRgCliente().should('have.value', rgDinamico);
    });

    it('5.11 deve permitir a troca de cliente normalmente depois de desfazer a alteração não salva', () => {
      abrirDrawerComPermissao650(true);
      IniciarAtendimentoMocks.interceptarBuscaCliente(candidatoBusca());
      AtendimentosMocks.interceptLinkCustomerApi('*', {
        customer: { customer_id: CLIENTE_NOVO_ID, name: CLIENTE_NOVO_NOME, phone: '5562999000001' }
      });
      AtendimentosMocks.interceptClientDetailApi(CLIENTE_NOVO_ID, {
        ...AtendimentosMocks.mockClientDetailData,
        id: CLIENTE_NOVO_ID,
        name: CLIENTE_NOVO_NOME,
        label_name: CLIENTE_NOVO_NOME
      });

      const rgOriginal = AtendimentosMocks.mockClientDetailData.identity_document;
      AtendimentosPage.elements.inputRgCliente().clear().type('RG_TEMPORARIO_DIRTY');
      // Desfaz manualmente: volta ao valor original persistido no servidor (mesmo mecanismo de
      // dirty-check por comparação de valor usado no restante do drawer — AGENTS.md [R-MOCK]).
      AtendimentosPage.elements.inputRgCliente().clear().type(rgOriginal);

      AtendimentosPage.elements.avisoBloqueioTrocaClienteDrawer().should('not.exist');

      AtendimentosPage.elements.inputNomeOuRazaoSocialCliente().clear().type('mar');
      cy.wait('@searchClients');
      AtendimentosPage.elements.getSugestaoBuscaClienteDrawer('name', CLIENTE_NOVO_ID).click();
      cy.wait('@linkCustomerPatch');

      AtendimentosPage.elements.avisoBloqueioTrocaClienteDrawer().should('not.exist');
      cy.get('div[role="status"]').should('be.visible').and('contain.text', 'Cliente vinculado ao atendimento.');
    });
  });

  // -------------------------------------------------------------
  // 6. GUARDA DE SAÍDA AO TROCAR DE ATENDIMENTO COM TEXTO NÃO SALVO (ISSUE FRONT#460, PR #465)
  // -------------------------------------------------------------

  context('6. Guarda de Saída ao Trocar de Atendimento com Texto Não Salvo (Issue front#460, PR #465)', () => {
    let originalUseMocksState;

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
    });

    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    beforeEach(() => {
      AtendimentosMocks.interceptInternalNotesApi('*', []);
      AtendimentosPage.elements.cardsAtendimento().first().click();
    });

    it('6.1 deve perguntar "Descartar texto?" ao clicar em outra conversa na fila com Notas Internas não salvas — "Continuar editando" mantém A aberta, "Descartar" troca para B', () => {
      AtendimentosPage.abrirGavetaNotasInternas();
      AtendimentosPage.elements.inputNotaInterna().type('Rascunho antes de trocar de conversa');
      // Com a gaveta aberta, a fila renderiza no modo compacto (rail) automaticamente — a lista
      // cheia (section[aria-label="Attendance list"]) não existe nesse estado (achado 2026-09-30).
      AtendimentosPage.elements.cardsAtendimentoCompactos().should('have.length.at.least', 2);

      // 1. Clicar no card B (rail compacto) dispara o diálogo, sem trocar de conversa ainda
      AtendimentosPage.elements.cardsAtendimentoCompactos().eq(1).click();
      AtendimentosPage.elements.dialogDescartarTexto().should('be.visible').and('contain.text', 'Descartar texto?');
      AtendimentosPage.elements.drawerNotasInternas().should('be.visible');

      // 2. "Continuar editando" mantém a conversa A aberta com o texto intacto
      AtendimentosPage.elements.btnDescartarTextoManterEditando().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('not.exist');
      AtendimentosPage.elements.inputNotaInterna().should('be.visible').and('have.value', 'Rascunho antes de trocar de conversa');

      // 3. Clicar em B de novo e "Descartar" troca de fato para a conversa B
      AtendimentosPage.elements.cardsAtendimentoCompactos().eq(1).click();
      AtendimentosPage.elements.dialogDescartarTexto().should('be.visible');
      AtendimentosPage.elements.btnDescartarTextoConfirmar().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('not.exist');
      AtendimentosPage.elements.drawerNotasInternas().should('not.exist');
      AtendimentosPage.elements.headerChat().should('be.visible');
    });

    it('6.2 deve perguntar ao trocar de conversa pelo rail compacto (fila recolhida) com Notas Internas não salvas', () => {
      AtendimentosPage.abrirGavetaNotasInternas();
      AtendimentosPage.elements.inputNotaInterna().type('Rascunho antes do rail compacto');
      AtendimentosPage.elements.cardsAtendimentoCompactos().should('exist');

      AtendimentosPage.elements.cardsAtendimentoCompactos().eq(1).click();
      AtendimentosPage.elements.dialogDescartarTexto().should('be.visible');
      AtendimentosPage.elements.drawerNotasInternas().should('be.visible');
    });

    it('6.3 deve perguntar ao clicar no X do chat (fechar a conversa) com Notas Internas não salvas, e fechar de fato ao confirmar', () => {
      AtendimentosPage.abrirGavetaNotasInternas();
      AtendimentosPage.elements.inputNotaInterna().type('Rascunho antes de fechar o chat');

      AtendimentosPage.elements.btnFecharConversa().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('be.visible');

      AtendimentosPage.elements.btnDescartarTextoConfirmar().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('not.exist');
      // headerChat() encadeia .first(), que falha em vez de resolver "ausente" quando 0 elementos
      // combinam (achado 2026-09-30) — seletor bruto aqui só para a checagem negativa.
      cy.get('[data-testid="chat-header"], header:has([data-testid="button-cliente-status"]), header:has(h2), div[class*="_conversation_"] header, main header').should('not.exist');
    });

    it('6.4 deve perguntar ao clicar num chip de status da fila com Notas Internas não salvas', () => {
      AtendimentosPage.abrirGavetaNotasInternas();
      AtendimentosPage.elements.inputNotaInterna().type('Rascunho antes de trocar o chip de status');

      AtendimentosPage.elements.chipInProgress().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('be.visible');
      AtendimentosPage.elements.drawerNotasInternas().should('be.visible');
    });

    it('6.5 deve disparar o mesmo diálogo ao trocar de conversa com Observações não salvas', () => {
      AtendimentosPage.abrirGavetaObservacoes();
      AtendimentosPage.elements.inputEscreverObservacao().type('Observação não salva antes de trocar de conversa');

      AtendimentosPage.elements.cardsAtendimentoCompactos().eq(1).click();
      AtendimentosPage.elements.dialogDescartarTexto().should('be.visible');
      AtendimentosPage.elements.drawerObservacoes().should('be.visible');

      AtendimentosPage.elements.btnDescartarTextoConfirmar().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('not.exist');
      AtendimentosPage.elements.headerChat().should('be.visible');
    });

    it('6.6 contraprova: não deve perguntar ao trocar de conversa com a gaveta vazia (sem texto digitado)', () => {
      AtendimentosPage.abrirGavetaNotasInternas();
      // Gaveta aberta, mas nunca digitada — trocar de conversa deve ir direto, sem diálogo.
      AtendimentosPage.elements.cardsAtendimentoCompactos().eq(1).click();
      AtendimentosPage.elements.dialogDescartarTexto().should('not.exist');
      AtendimentosPage.elements.headerChat().should('be.visible');
    });

    it('6.7 contraprova: não deve perguntar ao clicar de novo na própria conversa já aberta', () => {
      AtendimentosPage.abrirGavetaNotasInternas();
      AtendimentosPage.elements.inputNotaInterna().type('Rascunho clicando na própria conversa');

      AtendimentosPage.elements.cardsAtendimentoCompactos().first().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('not.exist');
      AtendimentosPage.elements.drawerNotasInternas().should('be.visible');
      AtendimentosPage.elements.inputNotaInterna().should('have.value', 'Rascunho clicando na própria conversa');
    });
  });

  // -------------------------------------------------------------
  // 7. TROCA DE TIPO DE CLIENTE (PF ↔ PJ) NO DRAWER "DADOS DO CLIENTE" (ISSUE FRONT#506, PR #508)
  // -------------------------------------------------------------

  context('7. Troca de Tipo de Cliente (PF ↔ PJ) no Drawer "Dados do Cliente" (Issue front#506, PR #508)', () => {
    let originalUseMocksState;

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
    });

    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    const abrirDrawerComPermissao650 = (canChangeDefaultCustomer = true) => {
      RecursosMocks.interceptResources();
      AtendimentosMocks.interceptClientCapabilitiesApi();
      AtendimentosMocks.interceptClientDetailApi('*');
      AtendimentosMocks.interceptPatchClientApi('*');
      AtendimentosMocks.interceptAttendanceItemCapabilitiesApi('*', {
        capabilities: {
          ...AtendimentosMocks.mockAttendanceItemCapabilitiesData.capabilities,
          can_change_default_customer: canChangeDefaultCustomer
        }
      });
      AtendimentosMocks.interceptAttendanceDetailApi('*', {
        ...AtendimentosMocks.mockAttendanceDetailData,
        customer: { ...AtendimentosMocks.mockAttendanceDetailData.customer, customer_id: 867092 }
      });
      IniciarAtendimentoMocks.interceptarBuscaCliente();
      cy.reload();
      AtendimentosPage.elements.tituloAtendimentos().should('be.visible');
      AtendimentosPage.garantirAtendimentoAberto(CELULAR_PADRAO, 'nao_oficial');
      AtendimentosPage.aguardarHistoricoMensagensCarregado();
      AtendimentosPage.abrirDrawerDadosCliente();
      cy.wait('@getClientDetail');
    };

    it('7.1 deve esvaziar documento, nome/razão social, telefone, e-mail, RG e a lista de endereços ao trocar para o tipo oposto ao do cliente vinculado (PF → PJ), bloqueando o Salvar sem disparar PATCH', () => {
      abrirDrawerComPermissao650(true);

      AtendimentosPage.elements.radioTipoClientePJ().click({ force: true });

      AtendimentosPage.elements.inputDocumentoCliente().should('have.value', '');
      AtendimentosPage.elements.inputNomeOuRazaoSocialCliente().should('have.value', '');
      AtendimentosPage.elements.inputRazaoSocialClientePJ().should('have.value', '');
      AtendimentosPage.elements.inputTelefoneCliente().should('have.value', '');
      AtendimentosPage.elements.inputEmailCliente().should('have.value', '');
      AtendimentosPage.elements.inputRgCliente().should('have.value', '');
      AtendimentosPage.elements.listaEnderecosCliente().should('not.exist');

      AtendimentosPage.elements.avisoTipoClienteOposto()
        .should('be.visible')
        .and('contain.text', 'Busque pelo documento ou nome para vincular outro cliente a este atendimento.');

      AtendimentosPage.elements.btnSalvarDadosCliente().should('have.attr', 'aria-disabled', 'true');
      AtendimentosPage.elements.btnSalvarDadosCliente().click();
      cy.get('@patchClient.all').should('have.length', 0);
    });

    it('7.2 deve manter documento e razão social desabilitados e exibir o aviso de falta de permissão quando o operador não tem a 650 (sem busca disponível)', () => {
      abrirDrawerComPermissao650(false);

      AtendimentosPage.elements.radioTipoClientePJ().click({ force: true });

      AtendimentosPage.elements.avisoTipoClienteOposto()
        .should('be.visible')
        .and('contain.text', 'Você não tem permissão para trocar o cliente deste atendimento.');
      AtendimentosPage.elements.inputDocumentoCliente().should('be.disabled');
      AtendimentosPage.elements.inputRazaoSocialClientePJ().should('be.disabled');
    });

    it('7.3 deve restaurar os dados carregados ao voltar para o tipo original, sem disparar uma nova requisição de detalhe do cliente', () => {
      abrirDrawerComPermissao650(true);

      AtendimentosPage.elements.radioTipoClientePJ().click({ force: true });
      AtendimentosPage.elements.inputDocumentoCliente().should('have.value', '');

      AtendimentosPage.elements.radioTipoClientePF().click({ force: true });

      AtendimentosPage.elements.inputDocumentoCliente().should('have.value', '019.925.732-98');
      AtendimentosPage.elements.listaEnderecosCliente().should('have.length.at.least', 1);
      AtendimentosPage.elements.avisoTipoClienteOposto().should('not.exist');
      AtendimentosPage.elements.btnSalvarDadosCliente().should('not.have.attr', 'aria-disabled', 'true');
      cy.get('@getClientDetail.all').should('have.length', 1);
    });

    it('7.4 deve recusar a troca de tipo com o mesmo aviso de edição pendente quando houver telefone editado e não salvo, preservando o valor editado e o tipo atual', () => {
      abrirDrawerComPermissao650(true);

      const telefoneDinamico = `62${Date.now()}`.slice(0, 11);
      AtendimentosPage.elements.inputTelefoneCliente().clear().type(telefoneDinamico);

      AtendimentosPage.elements.inputTelefoneCliente().invoke('val').then((valorEditado) => {
        AtendimentosPage.elements.radioTipoClientePJ().click({ force: true });

        AtendimentosPage.elements.avisoBloqueioTrocaClienteDrawer()
          .scrollIntoView({ duration: 300 })
          .should('be.visible')
          .and('contain.text', 'Salve ou desfaça as alterações desta ficha antes de trocar o cliente do atendimento.');
        AtendimentosPage.elements.labelDocumentoCliente().invoke('text').should('match', /cpf/i);
        AtendimentosPage.elements.inputTelefoneCliente().should('have.value', valorEditado);
      });
      cy.get('@patchClient.all').should('have.length', 0);
    });
  });

  // -------------------------------------------------------------
  // 8. GUARDA DE SAÍDA AO NAVEGAR PELO MENU LATERAL PARA FORA DE ATENDIMENTOS (ISSUE FRONT#467, PR #471)
  // -------------------------------------------------------------

  context('8. Guarda de Saída ao Navegar pelo Menu Lateral para Fora de Atendimentos (Issue front#467, PR #471)', () => {
    let originalUseMocksState;

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
    });

    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    beforeEach(() => {
      AtendimentosMocks.interceptInternalNotesApi('*', []);
      AtendimentosPage.elements.cardsAtendimento().first().click();
    });

    it('8.1 deve perguntar "Descartar texto?" ao clicar em "Clientes" no menu lateral com Notas Internas não salvas — "Continuar editando" mantém em Atendimentos com o texto intacto, "Descartar" navega para Clientes', () => {
      AtendimentosPage.abrirGavetaNotasInternas();
      AtendimentosPage.elements.inputNotaInterna().type('Rascunho antes de sair pelo menu lateral');

      // 1. Clicar em "Clientes" dispara o diálogo, sem trocar de rota ainda
      AtendimentosPage.elements.sidebarItemClientes().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('be.visible').and('contain.text', 'Descartar texto?');
      cy.url().should('include', '/atendimentos');

      // 2. "Continuar editando" mantém a página com o texto intacto
      AtendimentosPage.elements.btnDescartarTextoManterEditando().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('not.exist');
      AtendimentosPage.elements.inputNotaInterna().should('be.visible').and('have.value', 'Rascunho antes de sair pelo menu lateral');
      cy.url().should('include', '/atendimentos');

      // 3. Clicar em "Clientes" de novo e "Descartar" navega de fato
      AtendimentosPage.elements.sidebarItemClientes().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('be.visible');
      AtendimentosPage.elements.btnDescartarTextoConfirmar().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('not.exist');
      cy.url().should('include', '/clientes');
    });

    it('8.2 deve perguntar ao clicar em "Receitas" no menu lateral com uma nova Observação não salva', () => {
      AtendimentosPage.abrirGavetaObservacoes();
      AtendimentosPage.elements.inputEscreverObservacao().type('Observação não salva antes de sair pelo menu lateral');

      AtendimentosPage.elements.sidebarItemReceitas().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('be.visible');
      AtendimentosPage.elements.drawerObservacoes().should('be.visible');
      cy.url().should('include', '/atendimentos');

      AtendimentosPage.elements.btnDescartarTextoConfirmar().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('not.exist');
      cy.url().should('include', '/receitas');
    });

    it('8.3 deve perguntar ao clicar em "Central" (Home) no menu lateral ao editar uma Observação existente e alterar o texto', () => {
      AtendimentosPage.abrirGavetaObservacoes();
      AtendimentosPage.criarObservacao('Observação original a ser editada');
      AtendimentosPage.editarObservacaoSemSalvar('Observação original a ser editada - alterada sem salvar');

      AtendimentosPage.elements.sidebarItemCentral().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('be.visible');
      cy.url().should('include', '/atendimentos');

      AtendimentosPage.elements.btnDescartarTextoManterEditando().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('not.exist');
      AtendimentosPage.validarValorEdicaoObservacaoAtiva('Observação original a ser editada - alterada sem salvar');
    });

    it('8.4 contraprova: não deve perguntar ao clicar no menu lateral com a gaveta aberta mas sem texto digitado', () => {
      AtendimentosPage.abrirGavetaNotasInternas();
      AtendimentosPage.elements.sidebarItemClientes().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('not.exist');
      cy.url().should('include', '/clientes');
    });

    it('8.5 contraprova: não deve perguntar no menu lateral ao editar uma observação existente sem alterar o texto', () => {
      AtendimentosPage.abrirGavetaObservacoes();
      AtendimentosPage.criarObservacao('Observação sem alteração nenhuma');
      AtendimentosPage.editarObservacaoSemSalvar('Observação sem alteração nenhuma');

      AtendimentosPage.elements.sidebarItemReceitas().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('not.exist');
      cy.url().should('include', '/receitas');
    });

    it('8.6 deve continuar perguntando "Descartar texto?" no menu lateral depois de ir à tela de Receitas e voltar para Atendimentos (Issue front#569/PR #620)', () => {
      // A PR #620 diz preservar a guarda de Atendimentos ao voltar da Receita (mesmo defeito da #467); o #8.1 cobre só o caminho direto.
      AtendimentosPage.elements.sidebarItemReceitas().click();
      cy.url().should('include', '/receitas');
      AtendimentosPage.elements.sidebarItemAtendimentos().click();
      cy.url().should('include', '/atendimentos');
      // Ao voltar, o app pode reabrir o último atendimento sozinho (corrida, AGENTS.md §4.2); sem ele, abre o 1º card da fila
      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="summary-notas"]:visible').length === 0) {
          AtendimentosPage.elements.cardsAtendimento().first().click();
        }
      });

      AtendimentosPage.abrirGavetaNotasInternas();
      AtendimentosPage.elements.inputNotaInterna().type('Rascunho depois de passar pela Receitas');
      AtendimentosPage.elements.sidebarItemClientes().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('be.visible').and('contain.text', 'Descartar texto?');
      cy.url().should('include', '/atendimentos');

      AtendimentosPage.elements.btnDescartarTextoManterEditando().click();
      AtendimentosPage.elements.inputNotaInterna().should('be.visible').and('have.value', 'Rascunho depois de passar pela Receitas');
      cy.url().should('include', '/atendimentos');
    });
  });

  // -------------------------------------------------------------
  // 9. GUARDA DE SAÍDA AO ATUALIZAR/FECHAR A ABA E AO VOLTAR PELO NAVEGADOR — GAVETA DE NOTAS E OBSERVAÇÕES (ISSUE FRONT#472, PR #473/#475)
  // -------------------------------------------------------------

  context('9. Guarda de Saída ao Atualizar/Fechar a Aba e ao Voltar pelo Navegador — Gaveta de Notas e Observações (Issue front#472, PR #473/#475)', () => {
    let originalUseMocksState;

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
    });

    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    beforeEach(() => {
      AtendimentosMocks.interceptInternalNotesApi('*', []);
    });

    it('9.1 deve acionar o aviso nativo do navegador (beforeunload) com uma Nota Interna não salva, e não acionar sem alteração na gaveta', () => {
      AtendimentosPage.elements.cardsAtendimento().first().click();
      AtendimentosPage.abrirGavetaNotasInternas();

      cy.beforeUnloadFoiPrevenido().should('be.false');

      AtendimentosPage.elements.inputNotaInterna().type('Rascunho antes de atualizar a página');
      cy.beforeUnloadFoiPrevenido().should('be.true');
    });

    it('9.2 deve acionar o aviso nativo do navegador (beforeunload) com uma Observação nova não salva', () => {
      AtendimentosPage.elements.cardsAtendimento().first().click();
      AtendimentosPage.abrirGavetaObservacoes();
      AtendimentosPage.elements.inputEscreverObservacao().type('Observação não salva antes de atualizar a página');

      cy.beforeUnloadFoiPrevenido().should('be.true');
    });

    it('9.3 deve abrir "Sair sem salvar?" ao voltar pelo navegador com uma Nota Interna não salva — "Continuar editando" mantém a tela e o texto intacto, "Sair" volta para a tela anterior', () => {
      // Histórico dentro da app (useBlocker só intercepta historyAction 'POP' vindo de navegação real
      // da SPA - voltar de uma URL digitada/F5 recarrega a página de verdade, caso coberto pela Parte
      // A): sem nenhuma conversa pré-selecionada (beforeEach não abre card, diferente dos demais
      // contexts de guarda - uma seleção prévia poluiria a pilha de histórico real do navegador e
      // faria o "voltar" pousar na mesma tela em vez da anterior, achado real ao rodar). Receitas ->
      // Atendimentos -> abrir conversa.
      AtendimentosPage.elements.sidebarItemReceitas().click();
      cy.url().should('include', '/receitas');
      AtendimentosPage.elements.sidebarItemAtendimentos().click();
      cy.url().should('include', '/atendimentos');
      AtendimentosPage.elements.cardsAtendimento().first().click();

      AtendimentosPage.abrirGavetaNotasInternas();
      AtendimentosPage.elements.inputNotaInterna().type('Rascunho antes de voltar pelo navegador');

      cy.go('back');
      AtendimentosPage.elements.dialogSairSemSalvar().should('be.visible')
        .and('contain.text', 'Sair sem salvar?')
        .and('contain.text', 'As alterações não salvas desta tela serão perdidas.');
      cy.url().should('include', '/atendimentos');

      // "Continuar editando" mantém a página com o texto intacto
      AtendimentosPage.elements.btnSairSemSalvarContinuarEditando().click();
      AtendimentosPage.elements.dialogSairSemSalvar().should('not.exist');
      AtendimentosPage.elements.inputNotaInterna().should('be.visible').and('have.value', 'Rascunho antes de voltar pelo navegador');
      cy.url().should('include', '/atendimentos');

      // Voltar de novo e "Sair" navega de fato para a tela anterior no histórico (Receitas)
      cy.go('back');
      AtendimentosPage.elements.dialogSairSemSalvar().should('be.visible');
      AtendimentosPage.elements.btnSairSemSalvarConfirmar().click();
      AtendimentosPage.elements.dialogSairSemSalvar().should('not.exist');
      cy.url().should('include', '/receitas');
    });

    it('9.4 contraprova: não deve abrir nenhum diálogo ao voltar pelo navegador sem alteração na gaveta', () => {
      AtendimentosPage.elements.sidebarItemReceitas().click();
      cy.url().should('include', '/receitas');
      AtendimentosPage.elements.sidebarItemAtendimentos().click();
      cy.url().should('include', '/atendimentos');
      AtendimentosPage.elements.cardsAtendimento().first().click();
      AtendimentosPage.abrirGavetaNotasInternas();

      cy.go('back');
      AtendimentosPage.elements.dialogSairSemSalvar().should('not.exist');
      cy.url().should('include', '/receitas');
    });

    it('9.5 contraprova: sair pelo menu lateral com texto não salvo aciona só o diálogo "Descartar texto?" de sempre (Issue front#467), nunca "Sair sem salvar?" do voltar do navegador (useBlocker só intercepta historyAction POP, não PUSH)', () => {
      AtendimentosPage.elements.cardsAtendimento().first().click();
      AtendimentosPage.abrirGavetaNotasInternas();
      AtendimentosPage.elements.inputNotaInterna().type('Rascunho antes de sair pelo menu lateral');

      AtendimentosPage.elements.sidebarItemClientes().click();
      AtendimentosPage.elements.dialogDescartarTexto().should('be.visible');
      AtendimentosPage.elements.dialogSairSemSalvar().should('not.exist');

      AtendimentosPage.elements.btnDescartarTextoConfirmar().click();
      cy.url().should('include', '/clientes');
    });
  });

  // -------------------------------------------------------------
  // 10. GUARDA DE SAÍDA AO ATUALIZAR/FECHAR A ABA E AO VOLTAR PELO NAVEGADOR — PERSONALIZAÇÃO DO ORÇAMENTO (ISSUE FRONT#472, PR #473/#475)
  // -------------------------------------------------------------

  context('10. Guarda de Saída ao Atualizar/Fechar a Aba e ao Voltar pelo Navegador — Personalização do Orçamento (Issue front#472, PR #473/#475)', () => {
    let originalUseMocksState;

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
    });

    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    const capabilitiesComPersonalizacao = {
      can_access_attendance_module: true,
      can_create_attendance: true,
      can_view_pending_attendance: true,
      can_view_occupied_attendance: true,
      can_create_customer_without_gender: false,
      can_list_group_agents: true,
      can_change_attendant_status: true,
      can_transfer_attendance: true,
      can_change_status: true,
      can_customize_budget: true
    };

    function abrirAtendimentoEGavetaOrcamentos() {
      AtendimentosPage.elements.tituloAtendimentos().should('be.visible');
      AtendimentosPage.elements.cardsAtendimento().first().click();
      AtendimentosPage.abrirGavetaOrcamentos();
    }

    beforeEach(() => {
      AtendimentosMocks.interceptAttendanceDetailApi('*', {
        ...AtendimentosMocks.mockAttendanceDetailData,
        summaries: {
          quotes: { count: 1, total_amount: 167.79 },
          payment_links: { count: 0, pending_confirmation_count: 0 }
        }
      });
      AtendimentosMocks.interceptBudgetsApi('*');
      AtendimentosMocks.interceptBudgetCustomizationApi();
      AtendimentosMocks.interceptAttendanceCapabilitiesApi({ capabilities: capabilitiesComPersonalizacao });
      cy.reload();
    });

    it('10.1 deve acionar o aviso nativo do navegador (beforeunload) ao mudar a cor da personalização, e não acionar sem alteração', () => {
      abrirAtendimentoEGavetaOrcamentos();
      AtendimentosPage.abrirModalPersonalizacaoOrcamento();

      cy.beforeUnloadFoiPrevenido().should('be.false');

      AtendimentosPage.digitarCorHexOrcamento('#AA00AA');
      cy.beforeUnloadFoiPrevenido().should('be.true');
    });

    it('10.2 deve abrir "Sair sem salvar?" ao voltar pelo navegador com a cor da personalização alterada — "Continuar editando" mantém o valor digitado, "Sair" volta para a tela anterior', () => {
      AtendimentosPage.elements.sidebarItemReceitas().click();
      cy.url().should('include', '/receitas');
      AtendimentosPage.elements.sidebarItemAtendimentos().click();
      cy.url().should('include', '/atendimentos');
      abrirAtendimentoEGavetaOrcamentos();
      AtendimentosPage.abrirModalPersonalizacaoOrcamento();
      AtendimentosPage.digitarCorHexOrcamento('#AA00AA');

      cy.go('back');
      AtendimentosPage.elements.dialogSairSemSalvar().should('be.visible').and('contain.text', 'Sair sem salvar?');
      cy.url().should('include', '/atendimentos');

      AtendimentosPage.elements.btnSairSemSalvarContinuarEditando().click();
      AtendimentosPage.elements.dialogSairSemSalvar().should('not.exist');
      AtendimentosPage.elements.inputBudgetAccentHex().should('have.value', '#AA00AA');

      cy.go('back');
      AtendimentosPage.elements.dialogSairSemSalvar().should('be.visible');
      AtendimentosPage.elements.btnSairSemSalvarConfirmar().click();
      AtendimentosPage.elements.dialogSairSemSalvar().should('not.exist');
      cy.url().should('include', '/receitas');
    });

    it('10.3 contraprova: não deve acionar nenhum aviso (beforeunload ou voltar do navegador) sem alteração na personalização', () => {
      // Sem force:true (ROADMAP.md P1-14, sonda de foco de 2026-11-06): a modal prende o foco e o overlay cobre a barra lateral, então nenhuma navegação
      // pela barra acontece com ela aberta. A entrada de histórico vem antes de abrir o atendimento (mesma ordem do #10.2): depois de um atendimento aberto,
      // voltar a Atendimentos restaura o último atendimento numa corrida (Chrome sim, Firefox não; medido em 2026-11-06), o que mudava o histórico.
      AtendimentosPage.elements.sidebarItemReceitas().click();
      cy.url().should('include', '/receitas');
      AtendimentosPage.elements.sidebarItemAtendimentos().click();
      cy.url().should('include', '/atendimentos');
      abrirAtendimentoEGavetaOrcamentos();
      AtendimentosPage.abrirModalPersonalizacaoOrcamento();
      cy.beforeUnloadFoiPrevenido().should('be.false');

      cy.go('back');
      AtendimentosPage.elements.dialogSairSemSalvar().should('not.exist');
      cy.url().should('include', '/receitas');
    });
  });

  // -------------------------------------------------------------
  // 11. GUARDA DE SAÍDA AO ATUALIZAR/FECHAR A ABA E AO VOLTAR PELO NAVEGADOR — DRAWER "DADOS DO CLIENTE" NO ATENDIMENTO (ISSUE FRONT#472, PR #473/#475)
  // -------------------------------------------------------------

  context('11. Guarda de Saída ao Atualizar/Fechar a Aba e ao Voltar pelo Navegador — Drawer "Dados do Cliente" no Atendimento (Issue front#472, PR #473/#475)', () => {

    beforeEach(() => {
      RecursosMocks.interceptResources();
      AtendimentosMocks.interceptClientCapabilitiesApi();
      AtendimentosMocks.interceptClientDetailApi('*');
      AtendimentosMocks.interceptPatchClientApi('*');
      AtendimentosMocks.interceptPostClientAddressApi('*');
      AtendimentosMocks.interceptPatchClientAddressApi('*');
      AtendimentosMocks.interceptAttendanceDetailApi('*', {
        ...AtendimentosMocks.mockAttendanceDetailData,
        customer: { ...AtendimentosMocks.mockAttendanceDetailData.customer, customer_id: 867092 }
      });
      cy.reload();
      AtendimentosPage.elements.tituloAtendimentos().should('be.visible');
      AtendimentosPage.garantirAtendimentoAberto(CELULAR_PADRAO, 'nao_oficial');
      AtendimentosPage.aguardarHistoricoMensagensCarregado();
    });

    it('11.1 deve acionar o aviso nativo do navegador (beforeunload) ao editar o RG no drawer "Dados do Cliente", e não acionar sem alteração', () => {
      AtendimentosPage.abrirDrawerDadosCliente();
      cy.wait('@getClientDetail');

      cy.beforeUnloadFoiPrevenido().should('be.false');

      AtendimentosPage.elements.inputRgCliente().clear().type(`RG${Date.now()}`.slice(0, 20));
      cy.beforeUnloadFoiPrevenido().should('be.true');
    });

    it('11.2 deve abrir "Sair sem salvar?" ao voltar pelo navegador com o RG editado no drawer "Dados do Cliente" — "Continuar editando" mantém o drawer aberto e o valor digitado, "Sair" volta para a tela anterior', () => {
      AtendimentosPage.elements.sidebarItemReceitas().click();
      cy.url().should('include', '/receitas');
      AtendimentosPage.elements.sidebarItemAtendimentos().click();
      cy.url().should('include', '/atendimentos');
      // Reclicar o card após a navegação de ida-e-volta reabre a MESMA conversa já cacheada pelo
      // React Query (sem 2ª requisição) - diferente de garantirAtendimentoAberto(), que espera um
      // novo @getAttendanceDetail e trava (achado real ao rodar: timeout "No request ever occurred").
      AtendimentosPage.elements.cardsAtendimento().first().click();
      AtendimentosPage.abrirDrawerDadosCliente();
      cy.wait('@getClientDetail');

      const rgDinamico = `RG${Date.now()}`.slice(0, 20);
      AtendimentosPage.elements.inputRgCliente().clear().type(rgDinamico);

      cy.go('back');
      AtendimentosPage.elements.dialogSairSemSalvar().should('be.visible').and('contain.text', 'Sair sem salvar?');
      cy.url().should('include', '/atendimentos');

      AtendimentosPage.elements.btnSairSemSalvarContinuarEditando().click();
      AtendimentosPage.elements.dialogSairSemSalvar().should('not.exist');
      AtendimentosPage.elements.inputRgCliente().should('be.visible').and('have.value', rgDinamico);

      cy.go('back');
      AtendimentosPage.elements.dialogSairSemSalvar().should('be.visible');
      AtendimentosPage.elements.btnSairSemSalvarConfirmar().click();
      AtendimentosPage.elements.dialogSairSemSalvar().should('not.exist');
      cy.url().should('include', '/receitas');
    });

    it('11.3 contraprova: não deve acionar nenhum aviso (beforeunload ou voltar do navegador) sem alteração no drawer "Dados do Cliente"', () => {
      AtendimentosPage.abrirDrawerDadosCliente();
      cy.wait('@getClientDetail');
      cy.beforeUnloadFoiPrevenido().should('be.false');

      AtendimentosPage.elements.sidebarItemReceitas().click();
      cy.url().should('include', '/receitas');
      AtendimentosPage.elements.sidebarItemAtendimentos().click();
      AtendimentosPage.elements.cardsAtendimento().first().click();
      AtendimentosPage.abrirDrawerDadosCliente();
      cy.wait('@getClientDetail');

      cy.go('back');
      AtendimentosPage.elements.dialogSairSemSalvar().should('not.exist');
      cy.url().should('include', '/receitas');
    });
  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 12: CONSULTA DE CEP NO ENDEREÇO DO DRAWER "DADOS DO CLIENTE" (ISSUE FRONT#616, PR #619)
  // ---------------------------------------------------------------------------
  // 100% mockado ([R-BLIND]): o drawer depende do atendimento vinculado a um cliente e da capability de edição, e o 503 e o "Buscando endereço…" não dão para provocar na dev. Parte do cliente com
  // endereço salvo (o mesmo setup do ctx 1), seleciona o 1º endereço e abre "Adicionar novo endereço" em branco. O componente do endereço é o mesmo da ficha (prefixo "client"), medido na UI real em 2026-10-22 (7.clientes ctx 9): a consulta
  // chama só `GET /zip-codes?zip_code=<cep>`; as respostas do mock são as medidas na API real (ClientesMocks.zipCodesMedidos); sintetizado: o 503 (corpo) e o cliente do drawer.
  context('12. Consulta de CEP no Endereço do Drawer "Dados do Cliente" (Issue front#616/PR #619)', () => {

    const P = 'client';
    const MSG_NAO_ENCONTRADO = 'CEP não encontrado. Preencha o endereço manualmente.';
    const MSG_INDISPONIVEL = 'Consulta de CEP indisponível no momento. Preencha o endereço manualmente.';
    const MSG_ESCOLHA_NA_LISTA = 'Escolha uma opção da lista.';
    let originalUseMocksState;

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
      Cypress.env('USE_MOCKS_FORCED_BY_TEST', true);
    });

    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
      Cypress.env('USE_MOCKS_FORCED_BY_TEST', false);
    });

    beforeEach(() => {
      RecursosMocks.interceptResources();
      AtendimentosMocks.interceptClientCapabilitiesApi();
      AtendimentosMocks.interceptAttendanceDetailApi('*', {
        ...AtendimentosMocks.mockAttendanceDetailData,
        customer: { ...AtendimentosMocks.mockAttendanceDetailData.customer, customer_id: 867092 }
      });
      AtendimentosMocks.interceptClientDetailApi('*');
      AtendimentosMocks.interceptPostClientAddressApi('*');
      cy.reload();
      AtendimentosPage.elements.tituloAtendimentos().should('be.visible');
      AtendimentosPage.elements.cardsAtendimento().first().click();
      cy.wait('@getAttendanceMessages', { timeout: 60000 });
      AtendimentosPage.abrirDrawerDadosCliente();
      cy.wait('@getClientDetail');
      // Seleciona o 1º endereço salvo e abre o formulário de novo endereço em branco (mesmo caminho do 1.6)
      AtendimentosPage.elements.listaEnderecosCliente().first().click({ force: true });
      AtendimentosPage.elements.btnNovoEnderecoCliente().scrollIntoView({ duration: 300 }).click();
      ClientesPage.campoDoEndereco(P, 'zip-code').scrollIntoView({ duration: 300 }).should('be.visible');
    });

    // A tela mostra cidade e bairro em iniciais maiúsculas: compara sem acento e sem caixa com o que a API devolveu
    const campoIgualA = (campo, valorDaApi) => ClientesPage.campoDoEndereco(P, campo).should(($campo) => {
      expect(ClientesPage.semAcento($campo.val()), `Campo ${campo}`).to.eq(ClientesPage.semAcento(valorDaApi));
    });

    it('12.1 deve preencher rua, cidade, UF e bairro ao completar os 8 dígitos do CEP, sem tocar no complemento nem no número', () => {
      // Arrange
      ClientesMocks.interceptZipCodesApi();

      // Act
      ClientesPage.digitarCep(P, '01001000').then((resposta) => {
        const cep = resposta.body;

        // Assert
        ClientesPage.campoDoEndereco(P, 'zip-code').should('have.value', '01001-000');
        ClientesPage.campoDoEndereco(P, 'street').should('have.value', cep.street);
        campoIgualA('city', cep.city.name);
        ClientesPage.ufDoEndereco(P).should('have.value', cep.city.state);
        campoIgualA('neighborhood', cep.neighborhood.name);
        ClientesPage.campoDoEndereco(P, 'complement').should('have.value', '');
        ClientesPage.campoDoEndereco(P, 'address-number').should('have.value', '');
      });
    });

    it('12.2 não deve sobrescrever a rua editada à mão ao trocar o CEP, mas deve atualizar cidade, UF e bairro, sem usar o complemento do CEP', () => {
      // Arrange
      ClientesMocks.interceptZipCodesApi();
      ClientesPage.digitarCep(P, '01001000');
      ClientesPage.campoDoEndereco(P, 'street').clear().type('Rua Teste QA');

      // Act
      ClientesPage.digitarCep(P, '20040002').then((resposta) => {
        const cep = resposta.body;
        expect(cep.complement, 'A resposta traz um complemento (a faixa do CEP)').to.be.a('string').and.not.be.empty;

        // Assert
        ClientesPage.campoDoEndereco(P, 'street').should('have.value', 'Rua Teste QA');
        campoIgualA('city', cep.city.name);
        ClientesPage.ufDoEndereco(P).should('have.value', cep.city.state);
        campoIgualA('neighborhood', cep.neighborhood.name);
        ClientesPage.campoDoEndereco(P, 'complement').should('have.value', '');
      });
    });

    it('12.3 deve deixar cidade e bairro para escolha manual quando a cidade está fora do catálogo (id nulo), com o nome como termo e o aviso', () => {
      // Arrange
      ClientesMocks.interceptZipCodesApi();

      // Act
      ClientesPage.digitarCep(P, '99999999').then((resposta) => {
        const cep = resposta.body;
        expect(cep.city.id, 'A resposta traz a cidade fora do catálogo (city.id nulo)').to.eq(null);

        // Assert
        campoIgualA('city', cep.city.name);
        ClientesPage.ufDoEndereco(P).should('have.value', cep.city.state);
        ClientesPage.campoDoEndereco(P, 'neighborhood').should('be.disabled');
        AtendimentosPage.elements.drawerDadosCliente().should('contain.text', MSG_ESCOLHA_NA_LISTA);
      });
    });

    it('12.4 deve avisar "CEP não encontrado" no 404 e deixar os campos livres para preencher à mão', () => {
      // Arrange
      ClientesMocks.interceptZipCodesApi();

      // Act
      ClientesPage.digitarCep(P, '00000000').then((resposta) => {
        // Assert
        expect(resposta.statusCode, 'Status da consulta de CEP inexistente').to.eq(404);
        AtendimentosPage.elements.drawerDadosCliente().should('contain.text', MSG_NAO_ENCONTRADO);
        ClientesPage.campoDoEndereco(P, 'street').should('not.be.disabled').type('Rua Digitada à Mão').should('have.value', 'Rua Digitada à Mão');
      });
    });

    it('12.5 deve avisar que a consulta está indisponível no 503, liberar o preenchimento e consultar de novo pela lupa', () => {
      // Arrange: a 1ª consulta responde 503 e as seguintes o normal
      ClientesMocks.interceptZipCodesApi({ falhasAntes: 1 });

      // Act
      ClientesPage.digitarCep(P, '01001000').then((resposta) => {
        expect(resposta.statusCode, 'Status da 1ª consulta').to.eq(503);
      });

      // Assert: aviso e campos livres
      AtendimentosPage.elements.drawerDadosCliente().should('contain.text', MSG_INDISPONIVEL);
      ClientesPage.campoDoEndereco(P, 'street').should('not.be.disabled').type('Rua Digitada à Mão');

      // Act: a lupa tenta de novo
      ClientesPage.clicarNaLupaDoCep(P).then((resposta) => {
        // Assert
        expect(resposta.statusCode, 'Status da consulta pela lupa').to.eq(200);
        AtendimentosPage.elements.drawerDadosCliente().should('not.contain.text', MSG_INDISPONIVEL);
        ClientesPage.campoDoEndereco(P, 'street').should('have.value', 'Rua Digitada à Mão');
        campoIgualA('city', resposta.body.city.name);
      });
    });

    it('12.6 deve bloquear o Salvar (aria-disabled) e mostrar "Buscando endereço…" enquanto a consulta do CEP não volta', () => {
      // Arrange: a resposta demora 2 s
      ClientesMocks.interceptZipCodesApi({ atrasoMs: 2000 });

      // Act
      ClientesPage.campoDoEndereco(P, 'zip-code').type('01001000');

      // Assert: durante a consulta
      AtendimentosPage.elements.drawerDadosCliente().should('contain.text', 'Buscando endereço…');
      AtendimentosPage.elements.btnSalvarDadosCliente().should('have.attr', 'aria-disabled', 'true');

      // Assert: com a resposta
      cy.wait('@getZipCodesApi');
      AtendimentosPage.elements.drawerDadosCliente().should('not.contain.text', 'Buscando endereço…');
      AtendimentosPage.elements.btnSalvarDadosCliente().should('not.have.attr', 'aria-disabled', 'true');
      ClientesPage.campoDoEndereco(P, 'street').should('have.value', 'Praça da Sé');
    });

  });

  // -------------------------------------------------------------
  // 13. GUARDA DE SAÍDA DA RECEITA EM EDIÇÃO NO OVERLAY DO ATENDIMENTO (ISSUE FRONT#467/PR #471 E FRONT#472/PR #473/#475)
  // -------------------------------------------------------------
  context('13. Guarda de Saída da Receita em Edição no Overlay do Atendimento: Fechar, Esc, Menu Lateral, Atualizar e Voltar pelo Navegador (Issue front#467/PR #471, front#472/PR #473/#475)', () => {

    // 100% mockado ([R-BLIND]): a Receita abre no overlay do atendimento pelo `btn-header-receita` (mesmo caminho do 6.receitas ctx 1) e fica "suja" com o + do Múltiplo.
    // Medido em mock em 2026-11-06 (ROADMAP.md P1-17): com a Receita suja, o X, o Esc e o menu lateral mostram o aviso do próprio overlay ("Há alterações não gravadas nesta receita.",
    // `receita-overlay-keep-editing`/`receita-overlay-discard`), o voltar do navegador mostra o "Sair sem salvar?" e o beforeunload é acionado. Trocar de card da fila com o overlay
    // aberto não tem teste: o overlay cobre a fila (o clique cai num `<th>` da Receita), então nenhum usuário chega lá pelo mouse.
    const AVISO_RECEITA = 'Há alterações não gravadas nesta receita.';
    let originalUseMocksState;
    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
    });
    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    const abrirReceitaPeloAtendimento = () => {
      ReceitasMocks.interceptReceitaPeloAtendimento({ cliente: ReceitasMocks.clienteDoAtendimento });
      ReceitasMocks.interceptEscritasDeReceita();
      AtendimentosPage.visitar();
      AtendimentosPage.elements.tituloAtendimentos().should('be.visible');
      AtendimentosPage.elements.chipWaiting().click();
      AtendimentosPage.elements.cardsAtendimento().first().should('be.visible').click();
      cy.wait('@getAttendanceDetail');
      ReceitasPage.abrirReceitaDoAtendimento();
      ReceitasPage.elements.overlayReceita().should('be.visible');
    };
    // Suja a Receita com o + do Múltiplo e devolve o valor novo, para conferir que "Continuar editando" o mantém
    const sujarReceita = () => ReceitasPage.elements.multiploDaFormula().first().invoke('val').then((antes) => {
      ReceitasPage.elements.btnAumentarMultiplo().first().click();
      ReceitasPage.elements.multiploDaFormula().first().should('not.have.value', String(antes));
      return ReceitasPage.elements.multiploDaFormula().first().invoke('val');
    });
    const exigirAvisoDaReceita = () => {
      ReceitasPage.elements.btnDescartarOverlay().should('be.visible');
      ReceitasPage.elements.btnContinuarEditandoOverlay().should('be.visible');
      cy.contains('[role="alert"]', AVISO_RECEITA).should('be.visible');
    };

    it('13.1 deve acionar o aviso nativo do navegador (beforeunload) com a Receita suja no overlay, e não acionar com ela limpa', () => {
      abrirReceitaPeloAtendimento();
      cy.beforeUnloadFoiPrevenido().should('be.false');

      sujarReceita();
      cy.beforeUnloadFoiPrevenido().should('be.true');
    });

    it('13.2 deve pedir confirmação ao fechar o overlay pelo X com a Receita suja — "Continuar editando" mantém a Receita e o valor, "Descartar alterações" fecha e fica no atendimento', () => {
      abrirReceitaPeloAtendimento();
      sujarReceita().then((valor) => {
        ReceitasPage.elements.btnFecharOverlay().click();
        exigirAvisoDaReceita();

        ReceitasPage.elements.btnContinuarEditandoOverlay().click();
        ReceitasPage.elements.btnDescartarOverlay().should('not.exist');
        ReceitasPage.elements.overlayReceita().should('be.visible');
        ReceitasPage.elements.multiploDaFormula().first().should('have.value', valor);
      });

      cy.location('search').then((busca) => {
        ReceitasPage.elements.btnFecharOverlay().click();
        ReceitasPage.elements.btnDescartarOverlay().click();
        ReceitasPage.elements.overlayReceita().should('not.exist');
        cy.location('search').should('eq', busca);
      });
    });

    it('13.3 deve pedir a mesma confirmação ao fechar o overlay pelo Esc com a Receita suja, e "Descartar alterações" fecha o overlay', () => {
      abrirReceitaPeloAtendimento();
      sujarReceita();

      cy.get('body').type('{esc}');
      exigirAvisoDaReceita();
      ReceitasPage.elements.btnDescartarOverlay().click();
      ReceitasPage.elements.overlayReceita().should('not.exist');
    });

    it('13.4 deve segurar a navegação pelo menu lateral com a Receita suja — "Continuar editando" fica no atendimento, "Descartar alterações" segue para Receitas', () => {
      abrirReceitaPeloAtendimento();
      sujarReceita();

      AtendimentosPage.elements.sidebarItemReceitas().click();
      exigirAvisoDaReceita();
      cy.location('pathname').should('eq', '/atendimentos');
      ReceitasPage.elements.btnContinuarEditandoOverlay().click();
      ReceitasPage.elements.overlayReceita().should('be.visible');
      cy.location('pathname').should('eq', '/atendimentos');

      AtendimentosPage.elements.sidebarItemReceitas().click();
      ReceitasPage.elements.btnDescartarOverlay().click();
      cy.location('pathname').should('eq', '/receitas');
    });

    it('13.5 deve abrir "Sair sem salvar?" ao voltar pelo navegador com a Receita suja, e "Continuar editando" mantém a Receita aberta com o valor', () => {
      abrirReceitaPeloAtendimento();
      sujarReceita().then((valor) => {
        cy.location('search').then((busca) => {
          cy.go('back');
          AtendimentosPage.elements.dialogSairSemSalvar().should('be.visible').and('contain.text', 'Sair sem salvar?');
          AtendimentosPage.elements.btnSairSemSalvarContinuarEditando().click();
          AtendimentosPage.elements.dialogSairSemSalvar().should('not.exist');
          cy.location('search').should('eq', busca);
          ReceitasPage.elements.overlayReceita().should('be.visible');
          ReceitasPage.elements.multiploDaFormula().first().should('have.value', valor);
        });
      });
    });

    it('13.6 contraprova: com a Receita limpa, o X fecha o overlay e o menu lateral navega sem nenhum aviso', () => {
      abrirReceitaPeloAtendimento();

      ReceitasPage.elements.btnFecharOverlay().click();
      ReceitasPage.elements.btnDescartarOverlay().should('not.exist');
      ReceitasPage.elements.overlayReceita().should('not.exist');

      ReceitasPage.abrirReceitaDoAtendimento();
      ReceitasPage.elements.overlayReceita().should('be.visible');
      AtendimentosPage.elements.sidebarItemReceitas().click();
      ReceitasPage.elements.btnDescartarOverlay().should('not.exist');
      cy.location('pathname').should('eq', '/receitas');
    });
  });

});
