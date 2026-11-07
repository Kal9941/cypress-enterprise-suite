// cypress/e2e/7.clientes.cy.js
// Suíte de testes E2E para o módulo de Clientes (/clientes): navegação, busca, filtros e cadastro

import ClientesPage from '../pages/7.clientesPage';
import ClientesMocks from '../mocks/7.clientesMocks';
import RecursosMocks from '../mocks/1.recursosMocks';
import { regexApi, rotaApi } from '../support/rotaApi';
import api from '../services/backendApiService';
const configEnv = require('../../env.json');

describe('7. Clientes - Testes de Interface e Comportamento', () => {

  beforeEach(() => {
    // Login via sessão (agnóstico a API real/mock, igual às demais suítes)
    cy.login();
  });

  // -------------------------------------------------------------
  // 1. NAVEGAÇÃO E FORMULÁRIO DE BUSCA
  // -------------------------------------------------------------
  context('1. Navegação e Formulário de Busca', () => {

    it('1.1 deve navegar até clientes e renderizar o formulário', () => {
      // Bug de teste real corrigido (AGENTS.md [R-CAUSA], achado 2026-10-08): único teste do
      // arquivo sem mock da listagem - com USE_MOCKS:true o login usa token fake (cy.login()),
      // que a API real rejeita com 401 na listagem não mockada, caindo no estado vazio "Nenhum
      // cliente encontrado" (data-testid="clients-empty") em vez da tabela. Falhava 100% das vezes
      // no CI (USE_MOCKS:true sempre, confirmado no histórico do GitHub Actions), mascarado pelos
      // outros vermelhos propositais do workflow.
      ClientesMocks.interceptClientsListApi();

      // Act: navega até a tela de Clientes pelo item canônico da barra lateral
      ClientesPage.visitar();

      // Assert 1: rota correta
      cy.url().should('include', '/clientes');

      // Assert 2: estrutura da página e formulário de busca renderizados
      ClientesPage.elements.paginaClientes().should('be.visible');
      ClientesPage.elements.barraFiltros().should('be.visible');
      ClientesPage.elements.inputBusca().should('be.visible').and('be.enabled');
      ClientesPage.elements.filtroTodos().should('be.visible');
      ClientesPage.elements.filtroHumano().should('be.visible');
      ClientesPage.elements.filtroAnimal().should('be.visible');

      // Assert 3: sem termo digitado, a tela já abre com a lista cheia (rolagem infinita, Issue
      // backend#586/#588 e front#510, 2026-10-06) — recorte mínimo de 3 caracteres foi removido;
      // nenhuma dica inicial aparece (só aparece para termo de 1-2 caracteres, ver ctx 4 #4.8)
      ClientesPage.elements.dicaBuscaInicial().should('not.exist');
      ClientesPage.elements.tabelaClientes().should('be.visible');
      ClientesPage.elements.tabelaClientes().find('[data-testid^="row-client-"]').should('have.length.gte', 1);
    });

  });

  // -------------------------------------------------------------
  // 2. CADASTRO DE CLIENTE (MODAL NOVO CLIENTE) — 100% MOCKADO [R-BLIND]
  // -------------------------------------------------------------
  // Por quê blindar: (1) a capability can_create_client - que exibe o botão "Novo cliente" - e as
  // 5 dispensas de obrigatoriedade (documento/telefone/endereço/gênero) não são garantidas de forma
  // determinística na API real para o usuário de teste; (2) o cadastro em si (POST /clients) é uma
  // escrita não-idempotente que deixaria dado de teste permanente na base real - o contrato bruto já
  // é validado com limpeza (desativação) em 0-A/0-B/0-C.backend-*.cy.js #76/#77. Este contexto valida o
  // COMPORTAMENTO DE TELA da modal (campos, regra PF/PJ, sucesso e conflito), não o contrato de API.
  // Inclui também o cadastro de Pessoa Jurídica (mesma modal, mesmo motivo de blindagem).
  context('2. Cadastro de Cliente (Modal Novo Cliente)', () => {
    let originalUseMocksState;

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
    });

    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    // client-groups é consultado assim que a modal abre (typeahead "Buscar grupo"), mesmo sem
    // interação do teste - não varia entre os testes deste contexto.
    beforeEach(() => {
      ClientesMocks.interceptClientGroupsApi();
    });

    /**
     * Navega até /clientes e abre a modal "Novo Cliente". Chamada só depois de cada teste
     * registrar o payload de capabilities que precisa (gênero obrigatório vs. dispensado) - a
     * capability decide se o campo de gênero renderiza, então não pode ir num beforeEach comum.
     */
    function abrirModalNovoCliente() {
      ClientesPage.visitar();
      ClientesPage.elements.btnNovoCliente().should('be.visible').click();
      ClientesPage.elements.modalNovoCliente().should('be.visible');
    }

    it('2.1 deve abrir a modal Novo Cliente e exibir os campos do formulário', () => {
      // Perfil padrão: gênero obrigatório (dispensa can_create_client_without_gender: false)
      ClientesMocks.interceptClientCapabilitiesApi();
      abrirModalNovoCliente();

      ClientesPage.elements.radioTipoPessoaNovoCliente(1).should('be.checked');
      ClientesPage.elements.radioTipoPessoaNovoCliente(2).should('not.be.checked');
      ClientesPage.elements.inputNomeNovoCliente().should('be.visible').and('be.enabled');
      ClientesPage.elements.selectGeneroNovoCliente().should('be.visible');
      ClientesPage.elements.btnSalvarNovoCliente().should('be.visible').and('not.be.disabled');
      ClientesPage.elements.btnFecharNovoCliente().should('be.visible');
    });

    it('2.2 deve exibir o campo de gênero só para pessoa física, ocultando-o ao alternar para pessoa jurídica', () => {
      // Perfil padrão: gênero obrigatório (dispensa can_create_client_without_gender: false)
      ClientesMocks.interceptClientCapabilitiesApi();
      abrirModalNovoCliente();

      // Assert 1: pessoa física (default do formulário) exige gênero
      ClientesPage.elements.selectGeneroNovoCliente().should('be.visible');

      // Act: alterna para pessoa jurídica (o <input> é visualmente coberto pelo <span> do dot
      // customizado - _personTypeInput_ tem pointer-events: none por design; o clique real do
      // usuário cai no <label>, então force:true aqui reproduz o mesmo resultado funcional)
      ClientesPage.elements.radioTipoPessoaNovoCliente(2).click({ force: true });

      // Assert 2: pessoa jurídica selecionada e campo de gênero desmontado (regra não se aplica)
      ClientesPage.elements.radioTipoPessoaNovoCliente(2).should('be.checked');
      ClientesPage.elements.selectGeneroNovoCliente().should('not.exist');

      // Act: volta para pessoa física
      ClientesPage.elements.radioTipoPessoaNovoCliente(1).click({ force: true });

      // Assert 3: campo de gênero reaparece
      ClientesPage.elements.selectGeneroNovoCliente().should('be.visible');
    });

    it('2.3 deve cadastrar um cliente pessoa física informando só o nome (todas as dispensas concedidas) e redirecionar para a ficha', () => {
      // Perfil com as 5 dispensas concedidas, incluindo gênero - só o nome é obrigatório
      ClientesMocks.interceptClientCapabilitiesApi(ClientesMocks.mockClientCapabilitiesAllWaivedData);
      ClientesMocks.interceptCreateClientApi();
      ClientesMocks.interceptClientDetailApi('*');
      abrirModalNovoCliente();

      // Act: preenche só o campo obrigatório (nome) e salva
      ClientesPage.elements.inputNomeNovoCliente().type('Cliente Teste E2E');
      ClientesPage.elements.btnSalvarNovoCliente().click();

      // Assert 1: payload enviado sem documento/telefone/endereço (dispensados pela capability)
      cy.wait('@postCreateClient').its('request.body').should('deep.equal', {
        name: 'Cliente Teste E2E',
        person_type: 1
      });

      // Assert 2: modal fecha e a SPA navega para a ficha do cliente recém-criado
      ClientesPage.elements.modalNovoCliente().should('not.exist');
      cy.url().should('match', /\/clientes\/\d+$/);
    });

    it('2.4 deve tratar 409 CLIENT_ALREADY_EXISTS exibindo o link para abrir a ficha do cliente existente', () => {
      // Perfil com as 5 dispensas concedidas - só nome e documento são preenchidos neste teste
      ClientesMocks.interceptClientCapabilitiesApi(ClientesMocks.mockClientCapabilitiesAllWaivedData);
      ClientesMocks.interceptCreateClientApi({
        code: 'CLIENT_ALREADY_EXISTS',
        message: 'Já existe um cliente com este documento.',
        client_id: 555222
      }, 409);
      abrirModalNovoCliente();

      // Act: tenta cadastrar com um documento já pertencente a outro cliente
      ClientesPage.elements.inputNomeNovoCliente().type('Cliente Duplicado Teste E2E');
      ClientesPage.elements.inputDocNovoCliente().type('019.925.732-98');
      ClientesPage.elements.btnSalvarNovoCliente().click();
      cy.wait('@postCreateClient');

      // Assert 1: link para a ficha do cliente conflitante (client_id da resposta 409)
      ClientesPage.elements.linkClienteExistente()
        .should('be.visible')
        .and('have.attr', 'href')
        .and('include', '/clientes/555222');

      // Assert 2: a modal permanece aberta (a criação falhou; o operador decide o próximo passo)
      ClientesPage.elements.modalNovoCliente().should('be.visible');
    });

    it('2.5 deve cadastrar pessoa jurídica enviando o nome do campo Razão Social e document (CNPJ)', () => {
      ClientesMocks.interceptClientCapabilitiesApi(ClientesMocks.mockClientCapabilitiesAllWaivedData);
      ClientesMocks.interceptCreateClientApi();
      ClientesMocks.interceptClientDetailApi('*');
      ClientesPage.visitar();
      ClientesPage.elements.btnNovoCliente().should('be.visible').click();
      ClientesPage.elements.modalNovoCliente().should('be.visible');

      ClientesPage.elements.radioTipoPessoaNovoCliente(2).click({ force: true });
      ClientesPage.elements.inputRazaoSocialNovoCliente().should('be.visible').type('Farmácia Teste E2E LTDA');
      ClientesPage.elements.inputDocNovoCliente().type('11222333000181');
      ClientesPage.elements.btnSalvarNovoCliente().click();

      // Medido na API real em 2026-09-28: o cadastro envia `name` (mesma chave da PF) preenchido
      // com o texto do campo "Razão Social", não `label_name` como o épico #290 assumia (CLI-17) -
      // `label_name` só existe como campo distinto na ficha de edição (PATCH), não na criação.
      cy.wait('@postCreateClient').its('request.body').should('deep.equal', {
        name: 'Farmácia Teste E2E LTDA',
        document: '11222333000181',
        person_type: 2
      });
    });

    it('2.6 deve exibir "Descartar este cadastro?" ao fechar a modal com campo preenchido, mantendo com "Continuar preenchendo" e descartando ao confirmar (Issue #458, PR #463)', () => {
      ClientesMocks.interceptClientCapabilitiesApi();
      abrirModalNovoCliente();

      // Sujar o formulário
      ClientesPage.elements.inputNomeNovoCliente().type('Rascunho Novo Cliente');

      // 1. Fechar dispara o diálogo compartilhado (mesmo ConfirmDialog da gaveta de notas, #345)
      ClientesPage.elements.btnFecharNovoCliente().click();
      ClientesPage.elements.modalDescartarCadastroNovoCliente().should('be.visible').and('contain.text', 'Descartar este cadastro?');
      // O diálogo de descarte fica sobreposto (position: fixed) à modal Novo Cliente - continua no
      // DOM, mas coberta visualmente; 'exist' confirma que não foi desmontada, sem exigir clicabilidade.
      ClientesPage.elements.modalNovoCliente().should('exist');

      // 2. "Continuar preenchendo" mantém a modal e o texto digitado
      ClientesPage.elements.btnCancelarDescartarCadastroNovoCliente().click();
      ClientesPage.elements.modalDescartarCadastroNovoCliente().should('not.exist');
      ClientesPage.elements.inputNomeNovoCliente().should('have.value', 'Rascunho Novo Cliente');

      // 3. Fechar de novo e "Descartar" fecha as duas modais
      ClientesPage.elements.btnFecharNovoCliente().click();
      ClientesPage.elements.modalDescartarCadastroNovoCliente().should('be.visible');
      ClientesPage.elements.btnConfirmarDescartarCadastroNovoCliente().click();
      ClientesPage.elements.modalDescartarCadastroNovoCliente().should('not.exist');
      ClientesPage.elements.modalNovoCliente().should('not.exist');
    });

    it('2.7 deve filtrar o campo de grupo ignorando acento e caixa nos dois sentidos (Issue front#551/PR #558)', () => {
      // O filtro é local (o front busca a lista inteira de GET /client-groups, sem q) e a lista
      // exibe os nomes em Title Case; mock com nome acentuado e nomes sem acento em caixa alta.
      ClientesMocks.interceptClientCapabilitiesApi();
      ClientesMocks.interceptClientGroupsApi({
        items: [
          { id: 800101, name: 'SÃO PAULO CLUBE' },
          { id: 800102, name: 'ACADEMIA PRIME' },
          { id: 800103, name: 'INDICACAO AMIGOS' }
        ],
        total: 3
      });
      abrirModalNovoCliente();
      cy.wait('@getClientGroups');

      const cenarios = [
        { termo: 'sao', esperado: [800101] },
        { termo: 'SÃO', esperado: [800101] },
        { termo: 'indicação', esperado: [800103] },
        { termo: 'ACADEMIA', esperado: [800102] },
        { termo: 'academia', esperado: [800102] },
        { termo: 'zzzz', esperado: [] }
      ];

      cenarios.forEach(({ termo, esperado }) => {
        cy.log(`Termo digitado: "${termo}"`);
        ClientesPage.elements.inputGrupoNovoCliente().clear().type(termo);

        if (esperado.length === 0) {
          ClientesPage.elements.listaSugestoesGrupoNovoCliente().should('contain.text', 'Nenhum resultado encontrado.');
          ClientesPage.elements.opcoesGrupoNovoCliente().should('not.exist');
        } else {
          ClientesPage.elements.opcoesGrupoNovoCliente().should('have.length', esperado.length);
          esperado.forEach((id) => ClientesPage.elements.sugestaoGrupoNovoClientePorId(id).should('be.visible'));
        }
      });
    });

  });

  // -------------------------------------------------------------
  // 3. EDITAR CLIENTE (FICHA DO CLIENTE) — 100% MOCKADO [R-BLIND]
  // -------------------------------------------------------------
  // Por quê blindar: o "Salvar dados" da ficha é um dirty-patch que pode disparar até 3 escritas
  // em sequência (PATCH /clients/:id, POST/PATCH telefone, POST/PATCH endereço), todas não-
  // idempotentes; validar isso contra a API real exigiria um cliente descartável por rodada e não
  // garantiria as capabilities (can_update_client, can_deactivate_client...) do usuário de teste.
  // Este contexto valida COMPORTAMENTO DE TELA (dirty-gate, dirty-patch seletivo, CRUD imediato de
  // telefone/endereço, guarda de saída) — o contrato bruto de PATCH /clients/:id já está coberto em
  // 0-A/0-B/0-C.backend-*.cy.js #78 (dirty patch) e #79-#80 (CRUD de telefones/endereços).
  // Inclui também edição de endereço via formulário inline, campos em leitura sem permissão,
  // inativação (POST /deactivation) e as 3 abas de observações — mesma ficha, mesmo CLIENT_ID e
  // mesmo beforeEach base.
  context('3. Editar Cliente (Ficha do Cliente)', () => {
    const CLIENT_ID = 700001;
    let originalUseMocksState;

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
    });

    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    // Rotas sempre consultadas ao carregar a ficha, independente do teste interagir com elas.
    beforeEach(() => {
      ClientesMocks.interceptClientCapabilitiesApi();
      ClientesMocks.interceptClientGroupsApi();
      ClientesMocks.interceptClientMovementClassesApi();
      ClientesMocks.interceptClientPostSaleClassesApi();
      ClientesMocks.interceptClientDetailApi(CLIENT_ID, ClientesMocks.mockClientDetailEditData);
    });

    it('3.1 deve renderizar as seções da ficha ao abrir o cliente a partir da lista de resultados', () => {
      // Arrange: 1 resultado de busca apontando para o mesmo cliente da ficha mockada
      ClientesMocks.interceptClientsListApi();

      // Act: navega até /clientes, busca e clica no resultado
      ClientesPage.visitar();
      ClientesPage.elements.inputBusca().type('Ficha');
      cy.wait('@getClientsList');
      ClientesPage.elements.linkClientePorId(CLIENT_ID).click();

      // Assert: rota e seções principais da ficha (página rola dentro de um container próprio -
      // AGENTS.md [R-SEL] "Painéis profundos... scrollIntoView antes de should('be.visible')")
      cy.url().should('include', `/clientes/${CLIENT_ID}`);
      ClientesPage.elements.fichaCliente().should('be.visible');
      ClientesPage.elements.headerFicha().should('be.visible');
      ClientesPage.elements.cardIdentificacaoFicha().scrollIntoView().should('be.visible');
      ClientesPage.elements.cardTelefonesFicha().scrollIntoView().should('be.visible');
      ClientesPage.elements.cardEnderecosFicha().scrollIntoView().should('be.visible');
      ClientesPage.elements.cardEmailFicha().scrollIntoView().should('be.visible');
      ClientesPage.elements.cardImpostoFicha().scrollIntoView().should('be.visible');
      ClientesPage.elements.cardDescontoFicha().scrollIntoView().should('be.visible');
      ClientesPage.elements.cardClassificacaoFicha().scrollIntoView().should('be.visible');
      ClientesPage.elements.cardNotasFicha().scrollIntoView().should('be.visible');
      ClientesPage.elements.cardAnimaisFicha().scrollIntoView().should('be.visible');
      ClientesPage.elements.btnSalvarFicha().scrollIntoView().should('be.visible');
    });

    it('3.2 deve manter o botão Salvar dados desabilitado sem alterações e habilitá-lo ao editar um campo', () => {
      ClientesPage.visitarFicha(CLIENT_ID);
      ClientesPage.elements.fichaCliente().should('be.visible');

      // Assert 1: nada foi alterado ainda (isDirty = false)
      ClientesPage.elements.btnSalvarFicha().should('be.visible').and('be.disabled');

      // Act: edita o nome
      ClientesPage.elements.inputNomeFicha().clear().type(' Editado');

      // Assert 2: botão habilita assim que o formulário fica sujo
      ClientesPage.elements.btnSalvarFicha().should('not.be.disabled');
    });

    it('3.3 deve editar nome e status "em débito" e persistir via PATCH só com os campos alterados', () => {
      ClientesMocks.interceptUpdateClientApi(CLIENT_ID);
      ClientesPage.visitarFicha(CLIENT_ID);

      // Act: altera nome e marca "Em débito" (ambos mapeados por k() em useEditClientDrawer)
      ClientesPage.elements.inputNomeFicha().clear().type('Cliente Ficha Editado E2E');
      ClientesPage.elements.checkboxEmDebitoFicha().click();
      ClientesPage.elements.btnSalvarFicha().click();

      // Assert 1: dirty-patch contém só os 2 campos tocados (nenhum outro campo intacto vaza)
      cy.wait('@patchClient').its('request.body').should('deep.equal', {
        name: 'Cliente Ficha Editado E2E',
        in_debt: true
      });

      // Assert 2: confirmação de sucesso (painel de notice fica em área com overflow - AGENTS.md
      // [R-SEL] "Painéis profundos... scrollIntoView antes de should('be.visible')")
      ClientesPage.elements.toastSucessoFicha().scrollIntoView().should('be.visible').and('contain.text', 'Cadastro atualizado');
    });

    it('3.4 deve adicionar um novo telefone à ficha (escrita imediata, fora do Salvar dados)', () => {
      ClientesMocks.interceptCreatePhoneApi(CLIENT_ID);
      ClientesPage.visitarFicha(CLIENT_ID);

      // Assert 1: botão de adicionar só habilita com um telefone válido (10 ou 11 dígitos)
      ClientesPage.elements.btnAdicionarTelefoneFicha().should('be.disabled');

      // Act: preenche um telefone novo (11 dígitos - a máscara (00) 00000-0000 trunca o excedente)
      // e adiciona
      ClientesPage.elements.inputNovoTelefoneFicha().type('(54) 94546-5465');
      ClientesPage.elements.btnAdicionarTelefoneFicha().should('not.be.disabled').click();

      // Assert 2: POST imediato (não passa pelo botão "Salvar dados" - card de telefones tem
      // mutação própria, ver useEditClientDrawer.js se() ); primary=false pois já existe um
      // telefone primário na ficha mockada (H(): primary só é true na lista vazia)
      cy.wait('@postCreatePhone').its('request.body').should('deep.equal', {
        prefix: '54',
        number: '945465465',
        whatsapp: true,
        primary: false
      });

      // Assert 3: campo local limpa após o sucesso
      ClientesPage.elements.inputNovoTelefoneFicha().should('have.value', '');
    });

    it('3.5 deve remover um telefone existente com confirmação', () => {
      ClientesMocks.interceptDeletePhoneApi(CLIENT_ID);
      ClientesPage.visitarFicha(CLIENT_ID);

      // Act: clica em remover o telefone cadastrado e confirma no modal
      ClientesPage.elements.btnRemoverTelefoneFichaPorId(810001).click();
      ClientesPage.elements.modalRemoverTelefoneFicha().should('be.visible');
      ClientesPage.elements.btnConfirmarRemoverTelefoneFicha().click();

      // Assert: DELETE disparado e modal fecha
      cy.wait('@deleteClientPhone');
      ClientesPage.elements.modalRemoverTelefoneFicha().should('not.exist');
    });

    it('3.6 deve adicionar um novo endereço preenchendo cidade/bairro via busca e salvar', () => {
      ClientesMocks.interceptClientCitiesApi();
      ClientesMocks.interceptClientNeighborhoodsApi();
      ClientesMocks.interceptCreateAddressApi(CLIENT_ID);
      ClientesPage.visitarFicha(CLIENT_ID);

      // Act 1: abre o formulário inline de novo endereço
      ClientesPage.elements.btnAdicionarEnderecoFicha().click();
      ClientesPage.elements.cardFormularioEnderecoFicha().should('be.visible');

      // Act 2: busca e seleciona cidade (mínimo 2 caracteres) e bairro (qualquer termo, cidade já selecionada)
      ClientesPage.elements.inputCidadeFicha().type('GOIANIA');
      ClientesPage.elements.sugestaoCidadeFichaPorId(33).click();
      ClientesPage.elements.inputBairroFicha().type('SETOR');
      ClientesPage.elements.sugestaoBairroFichaPorId(106).click();

      // Act 3: rua, número e complemento (campos obrigatórios além de cidade/bairro)
      ClientesPage.elements.inputRuaFicha().type('Decima Primeira Avenida');
      ClientesPage.elements.inputNumeroEnderecoFicha().type('297');
      ClientesPage.elements.inputComplementoFicha().type('APT 106');
      ClientesPage.elements.btnSalvarFicha().should('not.be.disabled').click();

      // Assert: POST de endereço (não gera PATCH de cliente - nenhum campo do cliente foi tocado)
      cy.wait('@postCreateAddress').its('request.body').should('deep.equal', {
        zip_code: null,
        street: 'Decima Primeira Avenida',
        number: '297',
        complement: 'APT 106',
        description: null,
        neighborhood_id: 106,
        city_id: 33,
        primary: false
      });
    });

    it('3.7 deve remover um endereço existente com confirmação', () => {
      ClientesMocks.interceptDeleteAddressApi(CLIENT_ID);
      ClientesPage.visitarFicha(CLIENT_ID);

      // Act: clica em remover o endereço cadastrado e confirma no modal
      ClientesPage.elements.btnRemoverEnderecoFichaPorId(928076).click();
      ClientesPage.elements.modalRemoverEnderecoFicha().should('be.visible');
      ClientesPage.elements.btnConfirmarRemoverEnderecoFicha().click();

      // Assert: DELETE disparado e modal fecha
      cy.wait('@deleteClientAddress');
      ClientesPage.elements.modalRemoverEnderecoFicha().should('not.exist');
    });

    it('3.8 deve exibir a confirmação de saída ao voltar com alterações não salvas e descartar ao confirmar', () => {
      ClientesPage.visitarFicha(CLIENT_ID);

      // Act 1: suja o formulário sem salvar
      ClientesPage.elements.inputNomeFicha().clear().type('Rascunho Não Salvo');

      // Act 2: tenta voltar para a listagem
      ClientesPage.elements.btnVoltarFicha().click();

      // Assert 1: modal de alterações não salvas aparece
      ClientesPage.elements.modalAlteracoesNaoSalvasFicha().should('be.visible');

      // Act 3: confirma a saída (descarta as alterações)
      ClientesPage.elements.btnConfirmarSairSemSalvarFicha().click();

      // Assert 2: navega de volta para a listagem
      cy.url().should('include', '/clientes').and('not.include', `/clientes/${CLIENT_ID}`);
    });

    it('3.9 deve editar o endereço existente pelo formulário de edição inline', () => {
      ClientesMocks.interceptClientCitiesApi();
      ClientesMocks.interceptClientNeighborhoodsApi();
      const idPattern = '\\d+';
      cy.intercept('PATCH', new RegExp(regexApi(`clients/${CLIENT_ID}/addresses/\\d+([?#].*)?$`)), {
        statusCode: 200,
        body: { items: [{ ...ClientesMocks.mockClientDetailEditData.addresses[0], complement: 'APT 999 EDITADO' }], total: 1 }
      }).as('patchClientAddress');
      ClientesPage.visitarFicha(CLIENT_ID);

      ClientesPage.elements.btnEditarEnderecoFichaPorId(928076).click();
      ClientesPage.elements.cardFormularioEnderecoFicha().should('be.visible');
      ClientesPage.elements.inputComplementoFicha().clear().type('APT 999 EDITADO');
      ClientesPage.elements.btnSalvarFicha().click();

      cy.wait('@patchClientAddress').its('request.body').should('include', { complement: 'APT 999 EDITADO' });
    });

    it('3.10 deve manter o campo Nome em leitura quando can_change_client_name for false', () => {
      const detalheSemGrant = ClientesMocks.mockClientDetailEditData;
      detalheSemGrant.capabilities.can_change_client_name = false;

      ClientesMocks.interceptClientCapabilitiesApi();
      ClientesMocks.interceptClientGroupsApi();
      ClientesMocks.interceptClientMovementClassesApi();
      ClientesMocks.interceptClientPostSaleClassesApi();
      ClientesMocks.interceptClientDetailApi(CLIENT_ID, detalheSemGrant);
      ClientesPage.visitarFicha(CLIENT_ID);

      ClientesPage.elements.fichaCliente().should('be.visible');
      ClientesPage.elements.inputNomeFicha().should('be.visible').and('be.disabled');
    });

    it('3.11 deve inativar o cliente ao confirmar a modal aberta pelo toggle Ativo', () => {
      ClientesMocks.interceptDeactivateClientApi(CLIENT_ID);
      ClientesPage.visitarFicha(CLIENT_ID);

      // Achado 2026-09-28: ao contrário de "Em débito" (campo comum do dirty-patch), o toggle
      // "Ativo" abre uma modal de confirmação (modal-client-active) em vez de marcar o formulário
      // sujo direto - a ação dispara POST /deactivation na confirmação, fora do "Salvar dados".
      ClientesPage.elements.checkboxAtivoFicha().should('be.checked');
      cy.contains('label', 'Ativo').click();
      ClientesPage.elements.modalAtivoFicha().should('be.visible');
      ClientesPage.elements.btnConfirmarModalAtivoFicha().click();

      cy.wait('@postDeactivateClient').its('request.body').should('deep.equal', { active: false });
      ClientesPage.elements.modalAtivoFicha().should('not.exist');
    });

    it('3.12 deve mapear as 3 abas para notes.client/weighing/attendance', () => {
      ClientesMocks.interceptClientCapabilitiesApi();
      ClientesMocks.interceptClientGroupsApi();
      ClientesMocks.interceptClientMovementClassesApi();
      ClientesMocks.interceptClientPostSaleClassesApi();
      ClientesMocks.interceptClientDetailApi(CLIENT_ID, {
        ...ClientesMocks.mockClientDetailEditData,
        notes: {
          client: 'NOTA DE CLIENTE E2E',
          weighing: 'NOTA DE PESAGEM E2E',
          attendance: 'NOTA DE ATENDIMENTO E2E'
        }
      });
      ClientesPage.visitarFicha(CLIENT_ID);

      ClientesPage.elements.textareaNotasFicha().should('have.value', 'NOTA DE CLIENTE E2E');

      ClientesPage.elements.tabNotasPesagemFicha().click();
      ClientesPage.elements.textareaNotasFicha().should('have.value', 'NOTA DE PESAGEM E2E');

      ClientesPage.elements.tabNotasAtendimentoFicha().click();
      ClientesPage.elements.textareaNotasFicha().should('have.value', 'NOTA DE ATENDIMENTO E2E');

      ClientesPage.elements.tabNotasClienteFicha().click();
      ClientesPage.elements.textareaNotasFicha().should('have.value', 'NOTA DE CLIENTE E2E');
    });

    // -----------------------------------------------------------------------------
    // Documento (CPF/CNPJ) travado após preenchido (Issue front#527/PR #531,
    // backend pharmacie-backend#615/#606): regra de dado, não de permissão — nenhuma
    // capability libera a edição de um documento já gravado.
    // -----------------------------------------------------------------------------

    it('3.13 deve desabilitar o campo de documento e o seletor Pessoa física/jurídica quando o cliente já tem documento, exibindo a dica de bloqueio', () => {
      // mockClientDetailEditData (CLIENT_ID 700001) já tem document preenchido ('01992573298')
      ClientesPage.visitarFicha(CLIENT_ID);

      ClientesPage.elements.inputDocumentoFicha().should('be.disabled');
      ClientesPage.elements.radioTipoPessoaFichaFisica().should('be.disabled');
      ClientesPage.elements.radioTipoPessoaFichaJuridica().should('be.disabled');
      ClientesPage.elements.hintDocumentoTravadoFicha()
        .should('be.visible')
        .and('contain.text', 'O documento (CPF/CNPJ) já preenchido e o tipo de cliente não podem ser alterados.');
    });

    it('3.14 cliente sem documento: deve manter o campo e o seletor editáveis, gravar o documento no PATCH e travar o campo imediatamente após o sucesso, sem reload', () => {
      const clienteSemDocumento = { ...ClientesMocks.mockClientDetailEditData, document: null, person_type: 1 };
      ClientesMocks.interceptClientCapabilitiesApi();
      ClientesMocks.interceptClientGroupsApi();
      ClientesMocks.interceptClientMovementClassesApi();
      ClientesMocks.interceptClientPostSaleClassesApi();
      ClientesMocks.interceptClientDetailApi(CLIENT_ID, clienteSemDocumento);
      ClientesMocks.interceptUpdateClientApi(CLIENT_ID, { ...clienteSemDocumento, document: '70221440100' });
      ClientesPage.visitarFicha(CLIENT_ID);

      ClientesPage.elements.inputDocumentoFicha().should('not.be.disabled');
      ClientesPage.elements.radioTipoPessoaFichaFisica().should('not.be.disabled');
      ClientesPage.elements.inputDocumentoFicha().type('70221440100');
      ClientesPage.elements.btnSalvarFicha().should('not.be.disabled').click();

      cy.wait('@patchClient').its('request.body').should('deep.equal', { document: '70221440100' });
      // Trava na hora, sem esperar reload (atualização otimista do cache - PR #531)
      ClientesPage.elements.inputDocumentoFicha().should('be.disabled');
    });

    it('3.15 deve exibir a mensagem do backend ao receber 422 CLIENT_DOCUMENT_LOCKED (ficha desatualizada em relação ao registro)', () => {
      const clienteSemDocumento = { ...ClientesMocks.mockClientDetailEditData, document: null, person_type: 1 };
      ClientesMocks.interceptClientCapabilitiesApi();
      ClientesMocks.interceptClientGroupsApi();
      ClientesMocks.interceptClientMovementClassesApi();
      ClientesMocks.interceptClientPostSaleClassesApi();
      ClientesMocks.interceptClientDetailApi(CLIENT_ID, clienteSemDocumento);
      // Simula o registro já ter recebido um documento por outra via entre o GET e o PATCH desta ficha
      cy.intercept('PATCH', new RegExp(regexApi(`clients/${CLIENT_ID}([?#].*)?$`)), {
        statusCode: 422,
        body: { code: 'CLIENT_DOCUMENT_LOCKED', message: 'O documento (CPF/CNPJ) já preenchido não pode ser alterado.' }
      }).as('patchClient');
      ClientesPage.visitarFicha(CLIENT_ID);

      ClientesPage.elements.inputDocumentoFicha().type('70221440100');
      ClientesPage.elements.btnSalvarFicha().should('not.be.disabled').click();

      cy.wait('@patchClient');
      ClientesPage.elements.toastErroFicha()
        .scrollIntoView()
        .should('be.visible')
        .and('contain.text', 'O documento (CPF/CNPJ) já preenchido não pode ser alterado.');
    });

  });

  // -------------------------------------------------------------
  // 4. LISTAGEM — FILTROS, ROLAGEM INFINITA, BUSCA E ORDENAÇÃO — 100% MOCKADO [R-BLIND]
  // -------------------------------------------------------------
  // Por quê blindar: o parâmetro `type`, a marcação de inativo, a deduplicação entre páginas, o
  // teto de 20 páginas e os estados de erro/retry dependem de estados de dados (múltiplas páginas,
  // animal com tutor, cliente desativado, falha de rede) não garantidos de forma determinística na
  // base real para o usuário de teste. Inclui também busca com debounce/corrida de respostas e
  // ordenação da página carregada — mesma tela de listagem, mesma blindagem.
  // Reescrito em 2026-10-06 (Issue backend#586/#588, front#510): a tela trocou paginação por
  // botões "Anterior"/"Próxima" por rolagem infinita (`useInfiniteQuery` + `has_next`), parou de
  // exigir recorte mínimo de 3 caracteres em `q` e o envelope de paginação perdeu `total`/
  // `total_pages` — engenharia reversa do bundle real (`ClientsPage-*.js`/`clientListing.queries-
  // *.js`/`translate-*.js`, 2026-10-06): `isTermTooShort` = 1-2 caracteres (não mais >=0 e <3);
  // teto de 20 páginas (`getNextPageParam` recusa page>20); dedup por `${type}-${id}` entre
  // páginas; alternar para ordenação "Nome (A-Z)" desliga a rolagem automática (só reordena o que
  // já carregou); sair da tela e voltar trunca o cache pra só a página 1 (confirmado: 0 requisição
  // nova, volta de 60 pra 30 linhas, servido do cache ainda "fresh" dentro do `staleTime` de 30s).
  context('4. Listagem — Filtros, Rolagem Infinita, Busca e Ordenação', () => {
    let originalUseMocksState;

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
    });

    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    function itemBase(overrides = {}) {
      return ClientesMocks.itemListagem(overrides);
    }

    function paginaUnica(overrides = {}) {
      return {
        items: [itemBase(overrides)],
        pagination: { page: 1, per_page: 30, has_next: false, has_previous: false }
      };
    }

    /** Rola o container da listagem até o fim, disparando o carregamento da próxima página. */
    function rolarAteOFim() {
      ClientesPage.elements.conteudoPrincipal().then(($el) => {
        cy.wrap($el).scrollTo('bottom', { duration: 200 });
      });
    }

    it('4.1 deve mapear as pills Todos/Humano/Animal para o parâmetro type da requisição, sem exigir termo de busca', () => {
      ClientesMocks.interceptClientsListApi();
      ClientesPage.visitar();
      // Estado inicial: lista já abre cheia, pill "Todos" ativa, sem termo (Issue backend#586/#588)
      cy.wait('@getClientsList').its('request.url').should('include', 'type=all').and('include', 'q=');

      ClientesPage.elements.filtroHumano().click();
      cy.wait('@getClientsList').its('request.url').should('include', 'type=human');

      ClientesPage.elements.filtroAnimal().click();
      cy.wait('@getClientsList').its('request.url').should('include', 'type=animal');

      // Não reclica em "Todos" aqui: o React Query serve do cache a mesma chave (q+type=all) já
      // buscada no início, sem nova requisição (AGENTS.md [R-SEL] "React Query serve do cache").
    });

    it('4.2 deve exibir o nome do tutor e manter a linha de animal não-navegável, com o motivo no title', () => {
      ClientesMocks.interceptClientsListApi(paginaUnica({
        type: 'animal', id: 900001, name: 'Rex', guardian_name: 'Fulano de Tal', guardian_id: 700050
      }));
      ClientesPage.visitar();
      cy.wait('@getClientsList');

      // guardian_id já vem no payload real (medido em 2026-09-28, GET .../clients?type=animal) -
      // resolve a OQ2 do backend do épico #290, mas o front ainda não navega com ele: a linha
      // segue sem link (`link-client-900001` inexistente), com title explicando o motivo -
      // comportamento intencional documentado (CLI-05 "Divergências da spec" #1), não bug.
      ClientesPage.elements.linhaClientePorId(900001).should('be.visible')
        .and('contain.text', 'Rex')
        .and('contain.text', 'Fulano de Tal')
        .and('have.attr', 'title', 'A ficha do animal ainda não existe');
      cy.get('[data-testid="link-client-900001"]').should('not.exist');
    });

    it('4.3 deve abrir a tela com a lista cheia sem exigir termo de busca (Issue backend#586/#588)', () => {
      ClientesMocks.interceptClientsListApi(paginaUnica({ id: 700010, name: 'Cliente Sem Termo' }));
      ClientesPage.visitar();

      // Recorte mínimo de 3 caracteres removido - a 1ª chamada já sai com q vazio, sem esperar
      // nenhuma digitação do operador
      cy.wait('@getClientsList').its('request.url').should('match', /[?&]q=(&|$)/);
      ClientesPage.elements.dicaBuscaInicial().should('not.exist');
      ClientesPage.elements.linhaClientePorId(700010).should('be.visible');
    });

    it('4.4 deve marcar visualmente um cliente inativo na listagem', () => {
      ClientesMocks.interceptClientsListApi(paginaUnica({ id: 700030, name: 'Cliente Inativo E2E', active: false }));
      ClientesPage.visitar();
      cy.wait('@getClientsList');

      ClientesPage.elements.linhaClientePorId(700030).should('be.visible');
    });

    it('4.5 deve aguardar a digitação parar e disparar só 1 requisição adicional para o termo final', () => {
      ClientesMocks.interceptClientsListApi();
      ClientesPage.visitar();
      cy.wait('@getClientsList'); // 1ª chamada, sem termo (abertura da tela)
      ClientesPage.elements.inputBusca().type('ana');
      cy.wait('@getClientsList');
      cy.get('@getClientsList.all').should('have.length', 2);
    });

    it('4.6 deve descartar a resposta de um termo antigo que chega depois da resposta do termo mais recente', () => {
      cy.intercept('GET', rotaApi('clients*'), (req) => {
        if (req.query.q === 'ana') {
          req.reply({
            delay: 1500,
            body: {
              items: [{ type: 'human', id: 1, name: 'RESPOSTA ANTIGA', document: null, guardian_name: '', guardian_id: null, phone: null, prescription_count: 0, last_prescription_at: null, active: true }],
              pagination: { page: 1, per_page: 30, has_next: false, has_previous: false }
            }
          });
        } else {
          req.reply({
            body: {
              items: [{ type: 'human', id: 2, name: 'RESPOSTA NOVA', document: null, guardian_name: '', guardian_id: null, phone: null, prescription_count: 0, last_prescription_at: null, active: true }],
              pagination: { page: 1, per_page: 30, has_next: false, has_previous: false }
            }
          });
        }
      }).as('getClientsList');

      ClientesPage.visitar();
      cy.wait('@getClientsList'); // 1ª chamada, sem termo (abertura da tela)
      ClientesPage.elements.inputBusca().type('ana');
      // Aguarda o debounce disparar a busca (resposta atrasada 1500ms) antes de completar o termo
      // - gate por rede (o intercept já capturou a requisição, mesmo a resposta ainda não tendo
      // chegado), nunca por cy.wait(ms) estático (AGENTS.md [R-SEL]).
      cy.get('@getClientsList.all').should('have.length', 2);
      ClientesPage.elements.inputBusca().type('clara');

      // O front normaliza a caixa do nome (Title Case) na renderização - achado 2026-09-28: DOM
      // real mostra "Resposta Nova", não o "RESPOSTA NOVA" cru do payload - match case-insensitive.
      cy.contains('[data-testid^="row-client-"]', /resposta nova/i).should('be.visible');
      ClientesPage.elements.tabelaClientes().invoke('text').should('not.match', /resposta antiga/i);
    });

    // Contrato medido na API real em 2026-09-28 (GET .../clients?type=all): não existe parâmetro de
    // ordenação no backend (confirma R-A/R-B do épico #290) — o toggle "Ordenar" reordena só os
    // itens já carregados na página, sem nova requisição.
    it('4.7 deve alternar o rótulo do botão e reordenar a página carregada sem nova requisição', () => {
      ClientesMocks.interceptClientsListApi({
        items: [
          itemBase({ id: 1, name: 'ZULMIRA', prescription_count: 3, last_prescription_at: '2026-05-01T10:00:00Z' }),
          itemBase({ id: 2, name: 'ADALBERTO', prescription_count: 1, last_prescription_at: '2026-04-01T10:00:00Z' })
        ],
        pagination: { page: 1, per_page: 30, has_next: false, has_previous: false }
      });
      ClientesPage.visitar();
      cy.wait('@getClientsList');

      // Botão é ícone-puro (sem texto visível) - o rótulo da ordenação vigente fica no atributo
      // title (confirmado no DOM real: title="Última receita"/"Nome (A-Z)", aria-label="Alterar
      // ordenação").
      ClientesPage.elements.btnOrdenar().invoke('attr', 'title').then((rotuloAntes) => {
        ClientesPage.elements.btnOrdenar().click();

        // Reordena em memória - nenhuma nova requisição é disparada pelo toggle
        cy.get('@getClientsList.all').should('have.length', 1);

        ClientesPage.elements.btnOrdenar().should((btn) => {
          expect(btn.attr('title')).not.to.eq(rotuloAntes);
        });

        // Ordem em memória reflete o novo critério (Nome A-Z: ADALBERTO antes de ZULMIRA)
        ClientesPage.elements.tabelaClientes().find('[data-testid^="row-client-"]').first()
          .should('have.attr', 'data-testid', 'row-client-2');
      });
    });

    it('4.8 deve mostrar a dica de recorte mínimo só para termo de 1-2 caracteres, sem disparar requisição (Issue backend#586/#588)', () => {
      ClientesMocks.interceptClientsListApi();
      ClientesPage.visitar();
      cy.wait('@getClientsList'); // abertura sem termo

      ClientesPage.elements.inputBusca().type('a');
      ClientesPage.elements.dicaBuscaInicial().should('be.visible')
        .and('contain.text', 'Busque um cliente')
        .and('contain.text', 'Digite ao menos 3 caracteres');
      ClientesPage.elements.tabelaClientes().should('not.exist');

      ClientesPage.elements.inputBusca().type('n');
      cy.wait(500); // debounce de 300ms sem disparar nenhuma chamada adicional
      cy.get('@getClientsList.all').should('have.length', 1);
      ClientesPage.elements.dicaBuscaInicial().should('be.visible');

      // 3º caractere sai do recorte curto e volta a listar de verdade
      ClientesPage.elements.inputBusca().type('a');
      cy.wait('@getClientsList').its('request.url').should('include', 'q=ana');
      ClientesPage.elements.dicaBuscaInicial().should('not.exist');
    });

    it('4.9 deve limitar o campo de busca a 60 caracteres e usar o texto "nome, código ou documento"', () => {
      ClientesMocks.interceptClientsListApi();
      ClientesPage.visitar();
      cy.wait('@getClientsList');

      ClientesPage.elements.inputBusca()
        .should('have.attr', 'maxlength', '60')
        .and('have.attr', 'placeholder', 'Buscar por nome, código ou documento');
    });

    it('4.10 deve carregar a página seguinte automaticamente ao rolar até o fim (rolagem infinita, Issue backend#586/#588)', () => {
      ClientesMocks.interceptClientsListPaginadoApi({
        1: ClientesMocks.paginaListagem(1, 30, true),
        2: ClientesMocks.paginaListagem(2, 30, false)
      });
      ClientesPage.visitar();
      cy.wait('@getClientsList').its('request.url').should('include', 'page=1');
      ClientesPage.elements.tabelaClientes().find('[data-testid^="row-client-"]').should('have.length', 30);

      rolarAteOFim();
      cy.wait('@getClientsList').its('request.url').should('include', 'page=2');
      ClientesPage.elements.tabelaClientes().find('[data-testid^="row-client-"]').should('have.length', 60);
      ClientesPage.elements.limiteDePaginasAtingido().should('not.exist');
    });

    it('4.11 deve deduplicar uma linha que aparece repetida em duas páginas (mesmo type+id)', () => {
      const duplicado = ClientesMocks.itemListagem({ id: 500, name: 'Duplicado Entre Páginas' });
      ClientesMocks.interceptClientsListPaginadoApi({
        1: ClientesMocks.paginaListagem(1, 29, true, [duplicado]),
        2: ClientesMocks.paginaListagem(2, 29, false, [duplicado])
      });
      ClientesPage.visitar();
      cy.wait('@getClientsList');
      ClientesPage.elements.tabelaClientes().find('[data-testid^="row-client-"]').should('have.length', 30);

      rolarAteOFim();
      cy.wait('@getClientsList');
      // 29 + 29 itens únicos + 1 duplicado contado uma única vez = 59, nunca 60
      ClientesPage.elements.tabelaClientes().find('[data-testid^="row-client-"]').should('have.length', 59);
      ClientesPage.elements.linhaClientePorId(500).should('have.length', 1);
    });

    it('4.12 deve desligar o carregamento automático de mais páginas ao ordenar por Nome (A-Z)', () => {
      ClientesMocks.interceptClientsListPaginadoApi({
        1: ClientesMocks.paginaListagem(1, 30, true),
        2: ClientesMocks.paginaListagem(2, 30, false)
      });
      ClientesPage.visitar();
      cy.wait('@getClientsList');
      ClientesPage.elements.tabelaClientes().find('[data-testid^="row-client-"]').should('have.length', 30);

      // Ordenação padrão é "Última receita" (lastPrescription) - 1º clique troca pra "Nome (A-Z)"
      ClientesPage.elements.btnOrdenar().invoke('attr', 'title').should('eq', 'Última receita');
      ClientesPage.elements.btnOrdenar().click();
      ClientesPage.elements.btnOrdenar().invoke('attr', 'title').should('eq', 'Nome (A-Z)');

      rolarAteOFim();
      cy.wait(1500); // tempo de sobra pra uma eventual chamada de page=2 aparecer, se houver bug
      cy.get('@getClientsList.all').should('have.length', 1);
      ClientesPage.elements.tabelaClientes().find('[data-testid^="row-client-"]').should('have.length', 30);
    });

    it('4.13 deve manter as linhas já carregadas e oferecer "Tentar novamente" só pra página que falhou', () => {
      ClientesMocks.interceptClientsListPaginadoApi({
        1: ClientesMocks.paginaListagem(1, 30, true),
        2: 'erro'
      });
      ClientesPage.visitar();
      cy.wait('@getClientsList');
      ClientesPage.elements.tabelaClientes().find('[data-testid^="row-client-"]').should('have.length', 30);

      rolarAteOFim();
      cy.wait('@getClientsList');
      // O rodapé de erro cresce a lista - rola de novo pra garantir que o novo rodapé fique visível
      rolarAteOFim();
      ClientesPage.elements.erroCarregarMaisItens().scrollIntoView().should('be.visible').and('contain.text', 'Não foi possível carregar mais clientes');
      ClientesPage.elements.btnTentarNovamenteCarregarMais().scrollIntoView().should('be.visible');
      // As 30 linhas da página 1 continuam na tela - só a página 2 falhou
      ClientesPage.elements.tabelaClientes().find('[data-testid^="row-client-"]').should('have.length', 30);

      // Reintercepta com a página 2 bem-sucedida e clica em "Tentar novamente"
      ClientesMocks.interceptClientsListPaginadoApi({
        1: ClientesMocks.paginaListagem(1, 30, true),
        2: ClientesMocks.paginaListagem(2, 30, false)
      });
      ClientesPage.elements.btnTentarNovamenteCarregarMais().scrollIntoView().click();
      cy.wait('@getClientsList').its('request.url').should('include', 'page=2');
      ClientesPage.elements.tabelaClientes().find('[data-testid^="row-client-"]').should('have.length', 60);
      ClientesPage.elements.erroCarregarMaisItens().should('not.exist');
    });

    it('4.14 deve parar no teto de 20 páginas (600 linhas) e avisar "Refine a busca para ver mais clientes"', () => {
      const paginas = {};
      for (let p = 1; p <= 20; p++) {
        paginas[p] = ClientesMocks.paginaListagem(p, 30, true); // has_next:true até a última de propósito
      }
      ClientesMocks.interceptClientsListPaginadoApi(paginas);
      ClientesPage.visitar();
      cy.wait('@getClientsList');

      // Rola repetidamente até a 20ª página (a própria rolagem automática já encadeia o próximo
      // carregamento assim que o anterior assenta - basta repetir o gesto). Confere a contagem de
      // linhas a cada rodada antes de rolar de novo - sem isso, o "bottom" de uma rolagem dispara
      // antes do DOM terminar de crescer com a página anterior, perdendo o carregamento seguinte.
      for (let p = 1; p < 20; p++) {
        rolarAteOFim();
        cy.wait('@getClientsList');
        ClientesPage.elements.tabelaClientes().find('[data-testid^="row-client-"]').should('have.length', (p + 1) * 30);
      }

      ClientesPage.elements.tabelaClientes().find('[data-testid^="row-client-"]').should('have.length', 600);
      ClientesPage.elements.limiteDePaginasAtingido().scrollIntoView().should('be.visible').and('contain.text', 'Refine a busca para ver mais clientes');

      // Teto é respeitado no próprio front (getNextPageParam recusa page 21): mais uma tentativa de
      // rolagem não deve gerar uma 21ª chamada
      rolarAteOFim();
      cy.wait(1500);
      cy.get('@getClientsList.all').should('have.length', 20);
    });

    it('4.15 deve resetar a rolagem pra só a página 1 ao sair da tela e voltar (cache truncado, sem nova requisição)', () => {
      ClientesMocks.interceptClientsListPaginadoApi({
        1: ClientesMocks.paginaListagem(1, 30, true),
        2: ClientesMocks.paginaListagem(2, 30, false)
      });
      ClientesPage.visitar();
      cy.wait('@getClientsList');
      rolarAteOFim();
      cy.wait('@getClientsList').its('request.url').should('include', 'page=2');
      ClientesPage.elements.tabelaClientes().find('[data-testid^="row-client-"]').should('have.length', 60);

      // Sai pra Central e volta pra Clientes pelo menu lateral
      ClientesPage.elements.sidebarItemCentral().click();
      cy.url().should('not.include', '/clientes');
      ClientesPage.elements.sidebarItemClientes().click();
      cy.url().should('include', '/clientes');

      // Confirmado por engenharia reversa (2026-10-06): o cache é truncado pra 1 página só no
      // cleanup do hook, sem invalidar - dentro do staleTime (30s) a tela volta a mostrar só a
      // página 1 sem nenhuma nova chamada de rede (servido do próprio cache, já truncado)
      cy.wait(1500);
      cy.get('@getClientsList.all').should('have.length', 2);
      ClientesPage.elements.tabelaClientes().find('[data-testid^="row-client-"]').should('have.length', 30);
    });

  });

  // -------------------------------------------------------------
  // 5. NAVEGAÇÃO — GATE PELO RECURSO CONTRATADO "patient" (CLI-20/21) — 100% MOCKADO [R-BLIND]
  // -------------------------------------------------------------
  context('5. Navegação — Gate por Recurso "customer" (antigo "patient")', () => {
    let originalUseMocksState;

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
    });

    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    it('5.1 não deve exibir o item Clientes na sidebar e deve bloquear o conteúdo da rota sem o recurso "patient" contratado', () => {
      RecursosMocks.interceptResources({ patient: false });
      ClientesMocks.interceptClientCapabilitiesApi();

      // /resources é buscado no boot da SPA - reload força o refetch sob o mock (mesmo padrão de
      // 5.atendimentos.cy.js "Dados do Cliente": AtendimentosPage.visitar()/reload após o intercept).
      // Blindagem [R-BLIND]: sem USE_MOCKS=true aqui, o reload refaz TODAS as outras rotas de boot
      // (client-capabilities, /users/me...) contra a API real de forma híbrida e não-determinística
      // - reproduzido 2026-09-28 (validação do operador via cypress open, fora do cypress run desta
      // sessão): 401 real vazou, sessionStorage.clear() redirecionou para /login antes de qualquer
      // asserção rodar (AGENTS.md [R-SEL] "URL /login inesperada").
      cy.reload();
      cy.get('body', { timeout: 10000 }).should('be.visible');
      // Seletor puro, sem .first() do Page Object: .first() exige >= 1 elemento e quebra antes do
      // should('not.exist') poder negar (AGENTS.md [R-SEL] ".first()/.last() nunca antes de not.exist").
      cy.get('[data-testid="sidebar-item-clientes"]').should('not.exist');

      // A rota direta não redireciona: fica em /clientes com o aviso de recurso não contratado
      // (fail-closed, mesmo padrão do 403 RESOURCE_NOT_ENTITLED documentado em PROJECT_CONTEXT.md
      // §7.6) - achado 2026-09-28, testid real `notice-resource-not-contracted`.
      cy.visit('/clientes', { failOnStatusCode: false });
      cy.get('[data-testid="notice-resource-not-contracted"]').should('be.visible');
    });

    it('5.2 deve decidir o item Clientes da sidebar pelo recurso "customer", ignorando o nome anterior "patient" (Issue backend#808, front#643)', () => {
      // Backend#808: o slug de Clientes virou `customer`; o `/resources` publica os dois enquanto durar a transição. Medido na dev em 2026-11-06 (aba-c):
      // o front já lê `customer` — com os dois nomes divergentes de propósito, só o `customer` decide.
      // Arrange + Act: customer não contratado, patient contratado
      RecursosMocks.interceptResources({ customer: false, patient: true });
      ClientesMocks.interceptClientCapabilitiesApi();
      cy.reload();
      cy.get('body', { timeout: 10000 }).should('be.visible');

      // Assert: o item some (seletor puro, sem .first(), para o not.exist poder negar)
      // A sidebar já montou (outros itens visíveis), então o not.exist não passa por tela vazia
      cy.get('[data-testid^="sidebar-item-"]').should('have.length.greaterThan', 0);
      cy.get('[data-testid="sidebar-item-clientes"]').should('not.exist');

      // Arrange + Act: o inverso — customer contratado, patient não
      RecursosMocks.interceptResources({ customer: true, patient: false });
      cy.reload();
      cy.get('body', { timeout: 10000 }).should('be.visible');

      // Assert: o item aparece
      cy.get('[data-testid="sidebar-item-clientes"]').should('be.visible');
    });

  });

  // -------------------------------------------------------------
  // 6-7. GUARDA DE SAÍDA AO ATUALIZAR/FECHAR A ABA (beforeunload, PR #473) E AO VOLTAR PELO
  // NAVEGADOR (useBlocker/RouterProvider, PR #475) — ISSUE FRONT#472
  // -------------------------------------------------------------
  // Mesmo mecanismo documentado em 5.atendimentos.cy.js (contexts 34-36): usePublishUnsavedDraft
  // (bundle real) arma um contador global que (a) registra `beforeunload` nativo e (b) alimenta o
  // useBlocker por trás do diálogo [data-testid="navigation-unsaved-dialog"], acionado só em
  // historyAction === 'POP' (voltar/avançar reais do navegador), nunca por navegação de menu/link
  // (PUSH). Parte A testada via evento `beforeunload` sintético (cy.beforeUnloadFoiPrevenido,
  // cypress/support/commands.js) - o Cypress não exibe nem interage com o diálogo NATIVO do
  // navegador (sempre deixa a navegação prosseguir). `sidebar-item-central` resolve para `/dashboard`
  // (confirmado via bundle real, navRoutes-*.js: `central: e.dashboard`), não `/central`.
  context('6. Guarda de Saída ao Atualizar/Fechar a Aba e ao Voltar pelo Navegador — Ficha do Cliente (Issue front#472, PR #473/#475)', () => {
    const CLIENT_ID = 700001;
    let originalUseMocksState;

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
    });

    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    beforeEach(() => {
      ClientesMocks.interceptClientCapabilitiesApi();
      ClientesMocks.interceptClientGroupsApi();
      ClientesMocks.interceptClientMovementClassesApi();
      ClientesMocks.interceptClientPostSaleClassesApi();
      ClientesMocks.interceptClientDetailApi(CLIENT_ID, ClientesMocks.mockClientDetailEditData);
    });

    it('6.1 deve acionar o aviso nativo do navegador (beforeunload) ao editar o nome na ficha, e não acionar sem alteração', () => {
      ClientesPage.visitarFicha(CLIENT_ID);
      ClientesPage.elements.fichaCliente().should('be.visible');

      cy.beforeUnloadFoiPrevenido().should('be.false');

      ClientesPage.elements.inputNomeFicha().clear().type('Cliente Ficha Editado Beforeunload E2E');
      cy.beforeUnloadFoiPrevenido().should('be.true');
    });

    it('6.2 deve abrir "Sair sem salvar?" ao voltar pelo navegador com o nome editado na ficha — "Continuar editando" mantém o valor digitado, "Sair" volta para a tela anterior', () => {
      // useBlocker só intercepta historyAction 'POP' de navegação real da SPA - abrir a ficha via
      // ClientesPage.visitarFicha() usa cy.visit() (carga completa, equivalente a URL digitada),
      // que o próprio PR #475 documenta como fora do escopo do diálogo novo (cai no beforeunload
      // nativo da Parte A). Entrar pela busca + clique no resultado é navegação de verdade (Link),
      // mesmo caminho de ClientesMocks.interceptClientsListApi() usado no context 3 (achado real ao
      // rodar: dialog nunca apareceu com visitarFicha()).
      ClientesMocks.interceptClientsListApi();
      ClientesPage.visitar();
      ClientesPage.elements.inputBusca().type('Ficha');
      cy.wait('@getClientsList');
      ClientesPage.elements.linkClientePorId(CLIENT_ID).click();
      ClientesPage.elements.fichaCliente().should('be.visible');

      ClientesPage.elements.inputNomeFicha().clear().type('Cliente Ficha Editado Voltar E2E');

      cy.go('back');
      ClientesPage.elements.dialogSairSemSalvar().should('be.visible').and('contain.text', 'Sair sem salvar?');
      cy.url().should('include', `/clientes/${CLIENT_ID}`);

      ClientesPage.elements.btnSairSemSalvarContinuarEditando().click();
      ClientesPage.elements.dialogSairSemSalvar().should('not.exist');
      ClientesPage.elements.inputNomeFicha().should('have.value', 'Cliente Ficha Editado Voltar E2E');

      cy.go('back');
      ClientesPage.elements.dialogSairSemSalvar().should('be.visible');
      ClientesPage.elements.btnSairSemSalvarConfirmar().click();
      ClientesPage.elements.dialogSairSemSalvar().should('not.exist');
      cy.url().should('include', '/clientes');
      cy.url().should('not.include', `/clientes/${CLIENT_ID}`);
    });

    it('6.3 contraprova: não deve acionar nenhum aviso (beforeunload ou voltar do navegador) sem alteração na ficha', () => {
      ClientesMocks.interceptClientsListApi();
      ClientesPage.visitar();
      ClientesPage.elements.inputBusca().type('Ficha');
      cy.wait('@getClientsList');
      ClientesPage.elements.linkClientePorId(CLIENT_ID).click();
      ClientesPage.elements.fichaCliente().should('be.visible');
      cy.beforeUnloadFoiPrevenido().should('be.false');

      cy.go('back');
      ClientesPage.elements.dialogSairSemSalvar().should('not.exist');
      cy.url().should('include', '/clientes');
      cy.url().should('not.include', `/clientes/${CLIENT_ID}`);
    });
  });

  context('7. Guarda de Saída ao Atualizar/Fechar a Aba e ao Voltar pelo Navegador — Cadastro de Cliente (Modal Novo Cliente) (Issue front#472, PR #473/#475)', () => {
    let originalUseMocksState;

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
    });

    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    function abrirModalNovoCliente() {
      ClientesPage.visitar();
      ClientesPage.elements.btnNovoCliente().should('be.visible').click();
      ClientesPage.elements.modalNovoCliente().should('be.visible');
    }

    beforeEach(() => {
      ClientesMocks.interceptClientGroupsApi();
      ClientesMocks.interceptClientCapabilitiesApi();
    });

    it('7.1 deve acionar o aviso nativo do navegador (beforeunload) com o cadastro de Novo Cliente preenchido, e não acionar com a modal vazia', () => {
      abrirModalNovoCliente();

      cy.beforeUnloadFoiPrevenido().should('be.false');

      ClientesPage.elements.inputNomeNovoCliente().type('Cliente Cadastro Beforeunload E2E');
      cy.beforeUnloadFoiPrevenido().should('be.true');
    });

    it('7.2 deve abrir "Sair sem salvar?" ao voltar pelo navegador com o cadastro de Novo Cliente preenchido — "Continuar editando" mantém a modal aberta e o valor digitado, "Sair" volta para a tela anterior', () => {
      ClientesPage.elements.sidebarItemCentral().click();
      cy.url().should('include', '/dashboard');
      abrirModalNovoCliente();
      ClientesPage.elements.inputNomeNovoCliente().type('Cliente Cadastro Voltar E2E');

      cy.go('back');
      ClientesPage.elements.dialogSairSemSalvar().should('be.visible').and('contain.text', 'Sair sem salvar?');
      cy.url().should('include', '/clientes');

      ClientesPage.elements.btnSairSemSalvarContinuarEditando().click();
      ClientesPage.elements.dialogSairSemSalvar().should('not.exist');
      ClientesPage.elements.modalNovoCliente().should('be.visible');
      ClientesPage.elements.inputNomeNovoCliente().should('have.value', 'Cliente Cadastro Voltar E2E');

      cy.go('back');
      ClientesPage.elements.dialogSairSemSalvar().should('be.visible');
      ClientesPage.elements.btnSairSemSalvarConfirmar().click();
      ClientesPage.elements.dialogSairSemSalvar().should('not.exist');
      cy.url().should('include', '/dashboard');
    });

    it('7.3 contraprova: não deve acionar nenhum aviso (beforeunload ou voltar do navegador) com a modal Novo Cliente vazia', () => {
      abrirModalNovoCliente();
      cy.beforeUnloadFoiPrevenido().should('be.false');

      // Sem force:true (ROADMAP.md P1-14, sonda de foco de 2026-11-06): a modal prende o foco (Tab e Shift+Tab só circulam nela) e o backdrop cobre a barra lateral,
      // então um usuário real fecha a modal antes de navegar. Vazia, ela fecha sem o "Descartar este cadastro?".
      ClientesPage.elements.btnFecharNovoCliente().click();
      ClientesPage.elements.modalNovoCliente().should('not.exist');
      ClientesPage.elements.sidebarItemCentral().click();
      cy.url().should('include', '/dashboard');
      abrirModalNovoCliente();

      cy.go('back');
      ClientesPage.elements.dialogSairSemSalvar().should('not.exist');
      cy.url().should('include', '/dashboard');
    });
  });

  // -------------------------------------------------------------
  // 8. BUSCA NA LISTAGEM DE CLIENTES SEM DISTINÇÃO DE ACENTO E CAIXA (API REAL)
  // -------------------------------------------------------------
  context('8. Busca na Listagem de Clientes sem Distinção de Acento e Caixa (Issue backend#628/PR #629)', () => {

    // Referência da issue: a tela Clientes (procedure CAD_CLIENTE_CON) já ignorava acento e não mudou.
    // Contra o backend real, para garantir que a mudança dos demais predicados não a regrediu.
    let originalUseMocksState;
    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', false);
    });
    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    it('8.1 deve devolver os mesmos clientes ao buscar "mar", "már" e "MAR" na barra de busca da tela Clientes', () => {
      ClientesMocks.interceptClientsListApi();
      ClientesPage.visitar();
      cy.wait('@getClientsList'); // abertura da tela, sem termo

      const idsPorTermo = {};
      ['mar', 'már', 'MAR'].forEach((termo) => {
        ClientesPage.elements.inputBusca().clear().type(termo);
        cy.wait('@getClientsList').then((interception) => {
          expect(interception.request.url, `termo "${termo}" enviado como digitado`).to.include(`q=${encodeURIComponent(termo)}`);
          const ids = interception.response.body.items.map((i) => i.id);
          expect(ids.length, `clientes para "${termo}"`).to.be.at.least(1);
          idsPorTermo[termo] = ids;
          if (termo !== 'mar') {
            expect(ids, `"${termo}" deve trazer os mesmos clientes que "mar"`).to.deep.eq(idsPorTermo.mar);
          }
          ClientesPage.elements.linhaClientePorId(ids[0]).should('be.visible');
        });
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 9: CONSULTA DE CEP NO ENDEREÇO DA FICHA (ISSUE FRONT#616, PR #619)
  // ---------------------------------------------------------------------------
  // Contexto de front contra API real ([R-BLIND]: USE_MOCKS=false no before), sem gravar nada: o formulário de novo endereço da ficha é aberto e nunca salvo. Medido na UI real em 2026-10-22
  // (dev, com a PR #619 no ar): ao completar os 8 dígitos a tela chama só `GET /zip-codes?zip_code=<cep>` (backend#751) e preenche rua, cidade, UF e bairro a partir da resposta, com cidade e bairro em
  // iniciais maiúsculas ("SAO PAULO" → "Sao Paulo"); o complemento e o número nunca são preenchidos. Cidade ou bairro com `id` nulo (99999999: Sarandi/PR) vão para o campo como termo de busca, com o aviso
  // "Escolha uma opção da lista." e o bairro travado até escolher a cidade; editar uma letra da cidade zera a UF ("—"). O 404 (00000000) mostra "CEP não encontrado. Preencha o endereço manualmente.".
  // As asserções comparam a tela com a resposta da própria API (interceptação passiva), nunca com valor fixo do catálogo. O 503 não dá para provocar na dev: está no contexto 10, mockado.
  context('9. Consulta de CEP no Endereço da Ficha do Cliente (Issue front#616/PR #619)', () => {

    const P = 'client';
    const MSG_NAO_ENCONTRADO = 'CEP não encontrado. Preencha o endereço manualmente.';
    const MSG_ESCOLHA_NA_LISTA = 'Escolha uma opção da lista.';
    let clientId;
    let originalUseMocksState;

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', false);
      api.autenticar().then(() => api.buscarClientes(1, configEnv.DEFAULT_CLIENT_NAME || 'klismam')).then((res) => {
        const cliente = (res.body?.items || res.body || [])[0];
        expect(cliente, '🔒 massa: o cliente padrão (DEFAULT_CLIENT_NAME) para abrir a ficha').to.exist;
        clientId = cliente.id;
      });
    });

    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    beforeEach(() => {
      ClientesMocks.interceptZipCodesApi();
      ClientesPage.abrirNovoEnderecoNaFicha(clientId);
    });

    // A tela mostra cidade e bairro em iniciais maiúsculas: compara sem acento e sem caixa com o que a API devolveu
    const campoIgualA = (campo, valorDaApi) => ClientesPage.campoDoEndereco(P, campo).should(($campo) => {
      expect(ClientesPage.semAcento($campo.val()), `Campo ${campo}`).to.eq(ClientesPage.semAcento(valorDaApi));
    });

    it('9.1 deve trocar o link "Consultar CEP nos Correios" pela lupa de busca ao lado do CEP', () => {
      // Assert
      ClientesPage.lupaDoCep(P).should('be.visible');
      ClientesPage.linkDosCorreios().should('not.exist');
      cy.get('a[href*="correios"]').should('not.exist');
    });

    it('9.2 deve preencher rua, cidade, UF e bairro ao completar os 8 dígitos do CEP, sem tocar no complemento nem no número', () => {
      // Act
      ClientesPage.digitarCep(P, '01001000').then((resposta) => {
        expect(resposta.statusCode, 'Status da consulta de CEP').to.eq(200);
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

    it('9.3 não deve preencher o complemento com a faixa do CEP ("de 128 a 144 - lado par")', () => {
      // Act
      ClientesPage.digitarCep(P, '20040002').then((resposta) => {
        // Assert: a resposta traz um complemento, e a tela não o usa
        expect(resposta.body.complement, '🔒 massa: CEP com complemento na resposta da API').to.be.a('string').and.not.be.empty;
        ClientesPage.campoDoEndereco(P, 'street').should('have.value', resposta.body.street);
        ClientesPage.campoDoEndereco(P, 'complement').should('have.value', '');
      });
    });

    it('9.4 não deve sobrescrever a rua editada à mão ao trocar o CEP, mas deve atualizar cidade, UF e bairro', () => {
      // Arrange
      ClientesPage.digitarCep(P, '01001000');
      ClientesPage.campoDoEndereco(P, 'street').clear().type('Rua Teste QA');

      // Act
      ClientesPage.digitarCep(P, '20040002').then((resposta) => {
        const cep = resposta.body;

        // Assert
        ClientesPage.campoDoEndereco(P, 'street').should('have.value', 'Rua Teste QA');
        campoIgualA('city', cep.city.name);
        ClientesPage.ufDoEndereco(P).should('have.value', cep.city.state);
        campoIgualA('neighborhood', cep.neighborhood.name);
      });
    });

    it('9.5 deve voltar a aceitar o CEP num campo esvaziado à mão', () => {
      // Arrange
      ClientesPage.digitarCep(P, '01001000');
      ClientesPage.campoDoEndereco(P, 'street').clear();

      // Act
      ClientesPage.digitarCep(P, '20040002').then((resposta) => {
        // Assert
        ClientesPage.campoDoEndereco(P, 'street').should('have.value', resposta.body.street);
      });
    });

    it('9.6 deve deixar cidade e bairro para escolha manual quando a cidade está fora do catálogo (id nulo), com o nome como termo e o aviso', () => {
      // Act
      ClientesPage.digitarCep(P, '99999999').then((resposta) => {
        const cep = resposta.body;
        expect(cep.city.id, '🔒 massa: CEP com a cidade fora do catálogo (city.id nulo)').to.eq(null);

        // Assert: o nome devolvido vira o termo do campo, a UF aparece e o bairro fica travado até escolher a cidade
        campoIgualA('city', cep.city.name);
        ClientesPage.ufDoEndereco(P).should('have.value', cep.city.state);
        ClientesPage.campoDoEndereco(P, 'street').should('have.value', cep.street);
        ClientesPage.campoDoEndereco(P, 'neighborhood').should('be.disabled');
        ClientesPage.elements.cardFormularioEnderecoFicha().should('contain.text', MSG_ESCOLHA_NA_LISTA);
      });
    });

    it('9.7 deve zerar a UF ao editar a cidade sugerida pelo CEP e manter o aviso até escolher uma cidade da lista', () => {
      // Arrange
      ClientesPage.digitarCep(P, '99999999');
      ClientesPage.ufDoEndereco(P).should('have.value', 'PR');

      // Act
      ClientesPage.campoDoEndereco(P, 'city').type('{backspace}');

      // Assert
      ClientesPage.ufDoEndereco(P).should('have.value', '');
      ClientesPage.elements.cardFormularioEnderecoFicha().should('contain.text', MSG_ESCOLHA_NA_LISTA);
    });

    it('9.8 deve avisar "CEP não encontrado" no 404 e deixar os campos livres para preencher à mão', () => {
      // Act
      ClientesPage.digitarCep(P, '00000000').then((resposta) => {
        // Assert
        expect(resposta.statusCode, 'Status da consulta de CEP inexistente').to.eq(404);
        ClientesPage.elements.cardFormularioEnderecoFicha().should('contain.text', MSG_NAO_ENCONTRADO);
        ClientesPage.campoDoEndereco(P, 'street').should('not.be.disabled').type('Rua Digitada à Mão').should('have.value', 'Rua Digitada à Mão');
        ClientesPage.campoDoEndereco(P, 'city').should('not.be.disabled');
      });
    });

    it('9.9 deve tentar de novo pela lupa depois de um CEP não encontrado, sem tirar os campos do preenchimento manual', () => {
      // Arrange
      ClientesPage.digitarCep(P, '00000000').then((resposta) => {
        expect(resposta.statusCode, 'Status da 1ª consulta').to.eq(404);
      });
      ClientesPage.elements.cardFormularioEnderecoFicha().should('contain.text', MSG_NAO_ENCONTRADO);

      // Act
      ClientesPage.clicarNaLupaDoCep(P).then((resposta) => {
        // Assert: a lupa consultou de novo (2 consultas), o aviso segue e os campos continuam livres
        expect(resposta.statusCode, 'Status da consulta pela lupa').to.eq(404);
        cy.get('@getZipCodesApi.all').should('have.length', 2);
        ClientesPage.elements.cardFormularioEnderecoFicha().should('contain.text', MSG_NAO_ENCONTRADO);
        ClientesPage.campoDoEndereco(P, 'street').should('not.be.disabled');
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 10: CONSULTA DE CEP NA FICHA — ENDEREÇO SALVO, INDISPONIBILIDADE E SALVAR BLOQUEADO (ISSUE FRONT#616, PR #619)
  // ---------------------------------------------------------------------------
  // 100% mockado ([R-BLIND]): o endereço salvo exige massa conhecida, o 503 não dá para provocar na dev (a cep-api teria de cair) e o estado "Buscando endereço…" exige atraso na resposta. As respostas do
  // CEP são as medidas na API real (ClientesMocks.zipCodesMedidos); sintetizado: o 503 (corpo) e o cliente da ficha (mockClientDetailEditData, endereço com CEP 74610030).
  context('10. Consulta de CEP na Ficha: Endereço Salvo, Consulta Indisponível e Salvar Bloqueado (Issue front#616/PR #619)', () => {

    const P = 'client';
    const CLIENT_ID = 700001;
    const MSG_INDISPONIVEL = 'Consulta de CEP indisponível no momento. Preencha o endereço manualmente.';
    let originalUseMocksState;

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
    });

    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    beforeEach(() => {
      ClientesMocks.interceptClientCapabilitiesApi();
      ClientesMocks.interceptClientGroupsApi();
      ClientesMocks.interceptClientMovementClassesApi();
      ClientesMocks.interceptClientPostSaleClassesApi();
      ClientesMocks.interceptClientDetailApi(CLIENT_ID, ClientesMocks.mockClientDetailEditData);
    });

    it('10.1 não deve consultar o CEP ao abrir um endereço salvo e deve mostrar a lupa no lugar do link dos Correios', () => {
      // Arrange
      ClientesMocks.interceptZipCodesApi();
      ClientesPage.visitarFicha(CLIENT_ID);

      // Act: abre o endereço salvo (CEP 74610030) para edição
      ClientesPage.elements.btnEditarEnderecoFichaPorId(ClientesMocks.mockClientDetailEditData.addresses[0].id).click();
      ClientesPage.elements.cardFormularioEnderecoFicha().should('be.visible');

      // Assert
      ClientesPage.campoDoEndereco(P, 'zip-code').should('have.value', '74610-030');
      ClientesPage.lupaDoCep(P).should('be.visible');
      ClientesPage.linkDosCorreios().should('not.exist');
      cy.get('@getZipCodesApi.all').should('have.length', 0);
    });

    it('10.2 deve avisar que a consulta está indisponível no 503, liberar o preenchimento e a gravação e consultar de novo pela lupa', () => {
      // Arrange: a 1ª consulta responde 503 e as seguintes o normal
      ClientesMocks.interceptZipCodesApi({ falhasAntes: 1 });
      ClientesPage.abrirNovoEnderecoNaFicha(CLIENT_ID);

      // Act
      ClientesPage.digitarCep(P, '01001000').then((resposta) => {
        expect(resposta.statusCode, 'Status da 1ª consulta').to.eq(503);
      });

      // Assert: aviso, campos livres e Salvar liberado
      ClientesPage.elements.cardFormularioEnderecoFicha().should('contain.text', MSG_INDISPONIVEL);
      ClientesPage.campoDoEndereco(P, 'street').should('not.be.disabled').type('Rua Digitada à Mão');
      ClientesPage.elements.btnSalvarFicha().should('not.be.disabled');

      // Act: a lupa tenta de novo
      ClientesPage.clicarNaLupaDoCep(P).then((resposta) => {
        // Assert: o aviso some, a rua digitada fica e a cidade vem do CEP
        expect(resposta.statusCode, 'Status da consulta pela lupa').to.eq(200);
        ClientesPage.elements.cardFormularioEnderecoFicha().should('not.contain.text', MSG_INDISPONIVEL);
        ClientesPage.campoDoEndereco(P, 'street').should('have.value', 'Rua Digitada à Mão');
        ClientesPage.campoDoEndereco(P, 'city').should(($cidade) => expect(ClientesPage.semAcento($cidade.val())).to.eq('sao paulo'));
      });
    });

    it('10.3 deve bloquear o Salvar (aria-disabled) enquanto a consulta do CEP não volta e só gravar depois, com o CEP, a rua e a cidade novos', () => {
      // Arrange: edita o endereço salvo e a resposta do CEP demora 2 s
      ClientesMocks.interceptZipCodesApi({ atrasoMs: 2000 });
      ClientesMocks.interceptUpdateAddressApi(CLIENT_ID);
      ClientesPage.visitarFicha(CLIENT_ID);
      const endereco = ClientesMocks.mockClientDetailEditData.addresses[0];
      ClientesPage.elements.btnEditarEnderecoFichaPorId(endereco.id).click();
      ClientesPage.elements.cardFormularioEnderecoFicha().should('be.visible');

      // Act: troca o CEP (8 dígitos) e tenta salvar com a consulta em andamento
      ClientesPage.campoDoEndereco(P, 'zip-code').clear().type('01001000');

      // Assert: durante a consulta, o aviso aparece e o Salvar fica aria-disabled; o clique não grava
      ClientesPage.elements.cardFormularioEnderecoFicha().should('contain.text', 'Buscando endereço…');
      ClientesPage.elements.btnSalvarFicha().should('have.attr', 'aria-disabled', 'true').click();
      cy.wait('@getZipCodesApi');
      cy.get('@patchClientAddress.all').should('have.length', 0);

      // Assert: com a resposta, o Salvar volta e grava o CEP novo com a rua e a cidade do CEP (e o complemento de antes)
      ClientesPage.elements.cardFormularioEnderecoFicha().should('not.contain.text', 'Buscando endereço…');
      ClientesPage.campoDoEndereco(P, 'street').should('have.value', 'Praça da Sé');
      ClientesPage.elements.btnSalvarFicha().should('not.have.attr', 'aria-disabled', 'true').click();
      cy.wait('@patchClientAddress').its('request.body').should((corpo) => {
        expect(corpo, 'O PATCH leva o CEP novo com a rua, a cidade e o bairro do CEP').to.include({ zip_code: '01001000', street: 'Praça da Sé', city_id: 230, neighborhood_id: 7670 });
        expect(corpo, 'O complemento não mudou, então não vai no PATCH').to.not.have.property('complement');
      });
    });

    it('10.4 deve consultar o CEP salvo ao clicar na lupa de um endereço aberto, sem mexer no número', () => {
      // Arrange: o endereço salvo (CEP 74610030) abre sem consulta
      ClientesMocks.interceptZipCodesApi();
      ClientesPage.visitarFicha(CLIENT_ID);
      const endereco = ClientesMocks.mockClientDetailEditData.addresses[0];
      ClientesPage.elements.btnEditarEnderecoFichaPorId(endereco.id).click();
      ClientesPage.elements.cardFormularioEnderecoFicha().should('be.visible');
      ClientesPage.campoDoEndereco(P, 'address-number').should('have.value', endereco.number);

      // Act
      ClientesPage.lupaDoCep(P).click();

      // Assert: consulta o CEP que já estava no endereço, atualiza rua, cidade e bairro e deixa o número
      cy.wait('@getZipCodesApi').its('request.url').should('include', 'zip_code=74610030');
      ClientesPage.campoDoEndereco(P, 'street').should('have.value', 'Avenida Décima Primeira Avenida');
      ClientesPage.campoDoEndereco(P, 'address-number').should('have.value', endereco.number);
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 11: CONSULTA DE CEP NO CADASTRO NOVO (ISSUE FRONT#616, PR #619)
  // ---------------------------------------------------------------------------
  // 100% mockado ([R-BLIND]): a seção de endereço da modal "Novo cliente" só aparece quando o endereço é obrigatório para o usuário (`can_create_client_without_address: false`), e a conta de teste
  // tem a dispensa. O componente do endereço é o mesmo da ficha, com o prefixo "new-client". Respostas do CEP medidas na API real (ClientesMocks.zipCodesMedidos).
  context('11. Consulta de CEP no Cadastro Novo de Cliente (Issue front#616/PR #619)', () => {

    const P = 'new-client';
    const MSG_NAO_ENCONTRADO = 'CEP não encontrado. Preencha o endereço manualmente.';
    let originalUseMocksState;

    before(() => {
      originalUseMocksState = Cypress.env('USE_MOCKS');
      Cypress.env('USE_MOCKS', true);
    });

    after(() => {
      Cypress.env('USE_MOCKS', originalUseMocksState);
    });

    beforeEach(() => {
      ClientesMocks.interceptClientGroupsApi();
      ClientesMocks.interceptClientCapabilitiesComEnderecoObrigatorio();
      ClientesMocks.interceptZipCodesApi();
      ClientesPage.visitar();
      ClientesPage.elements.btnNovoCliente().should('be.visible').click();
      ClientesPage.elements.modalNovoCliente().should('be.visible');
    });

    it('11.1 deve mostrar a lupa no campo CEP, sem o link dos Correios, quando o endereço é obrigatório no cadastro', () => {
      // Assert
      ClientesPage.campoDoEndereco(P, 'zip-code').scrollIntoView().should('be.visible');
      ClientesPage.lupaDoCep(P).should('be.visible');
      ClientesPage.linkDosCorreios().should('not.exist');
    });

    it('11.2 deve preencher rua, cidade, UF e bairro ao completar os 8 dígitos do CEP, sem tocar no complemento nem no número', () => {
      // Act
      ClientesPage.digitarCep(P, '01001000').then((resposta) => {
        const cep = resposta.body;

        // Assert
        ClientesPage.campoDoEndereco(P, 'street').should('have.value', cep.street);
        ClientesPage.campoDoEndereco(P, 'city').should(($cidade) => expect(ClientesPage.semAcento($cidade.val())).to.eq(ClientesPage.semAcento(cep.city.name)));
        ClientesPage.ufDoEndereco(P).should('have.value', cep.city.state);
        ClientesPage.campoDoEndereco(P, 'neighborhood').should(($bairro) => expect(ClientesPage.semAcento($bairro.val())).to.eq(ClientesPage.semAcento(cep.neighborhood.name)));
        ClientesPage.campoDoEndereco(P, 'complement').should('have.value', '');
        ClientesPage.campoDoEndereco(P, 'address-number').should('have.value', '');
      });
    });

    it('11.3 deve avisar "CEP não encontrado" no 404 e deixar os campos livres para preencher à mão', () => {
      // Act
      ClientesPage.digitarCep(P, '00000000').then((resposta) => {
        // Assert
        expect(resposta.statusCode, 'Status da consulta de CEP inexistente').to.eq(404);
        ClientesPage.elements.modalNovoCliente().should('contain.text', MSG_NAO_ENCONTRADO);
        ClientesPage.campoDoEndereco(P, 'street').should('not.be.disabled').type('Rua Digitada à Mão').should('have.value', 'Rua Digitada à Mão');
      });
    });

  });

});
