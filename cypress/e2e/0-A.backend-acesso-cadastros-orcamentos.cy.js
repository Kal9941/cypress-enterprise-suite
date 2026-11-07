// cypress/e2e/0-A.backend-acesso-cadastros-orcamentos.cy.js
// Suíte de Backend e Integração na API Real, parte A: acesso, RBAC/capabilities, recursos, loja, timestamps, catálogos e busca, clientes, orçamentos e links de pagamento.
// Dividida do 0-A/0-B/0-C.backend-*.cy.js em 2026-10-20 (3 arquivos por tema, contexts com os números originais); executa via cy.request(), imune a mocks de interface.

import api from '../services/backendApiService';
const configEnv = require('../../env.json');
const massaResidualOrcamentos = require('../fixtures/0.backend/massaResidualOrcamentos');

// Guarda da massa residual de orçamentos (ROADMAP.md P1-54, onda 3): os IDs vêm da fixture (atendimentos finalizados de jul-set, o único
// coberto por link aprovado da dev) e cada teste confere o estado antes de usá-lo; se derivou, pula com o motivo em vez de ficar vermelho.
const ESTADOS_ORCAMENTO = {
  elegivel: (o) => o.status === 0 && !o.financial_id && o.covered_by_approved_link === false,
  coberto: (o) => o.covered_by_approved_link === true,
  vendido: (o) => Number(o.financial_id) > 0,
  foraDoAbertoCobravel: (o) => o.status === -1 && !o.financial_id && o.covered_by_approved_link === false,
};
const exigirMassaOrcamento = (ctx, attendanceId, budgetCode, estado) => api.listarOrcamentosAtendimento(1, attendanceId).then((res) => {
  const orcamento = ((res.body && res.body.data) || []).find((b) => b.code === budgetCode);
  if (res.status !== 200 || !orcamento || !ESTADOS_ORCAMENTO[estado](orcamento)) {
    cy.log(`⏭️ Sem massa: o orçamento ${budgetCode} do atendimento ${attendanceId} não está mais no estado "${estado}" (massaResidualOrcamentos.js)`);
    ctx.skip();
  }
  return orcamento;
});
// Guarda da massa de revenda (ROADMAP.md P1-54, onda 4): não há rota que liste revendas nem que conclua uma, então os registros vêm de
// `massaRevenda.js` e cada context confere, num before() próprio, as chaves que usa; se alguma derivou, o context inteiro pula com o motivo.
const massaRevendaDaGuarda = require('../fixtures/0.backend/massaRevenda');
const CONFERE_MASSA_REVENDA = {
  REVENDA_ABERTA: (m) => api.obterDetalheRevenda(m.REVENDA_ABERTA.id, { failOnStatusCode: false }).then((r) => r.status === 200 && r.body.status === 0 && !r.body.financial_id),
  REVENDA_CONCLUIDA_SEM_FINANCEIRO: (m) => api.obterDetalheRevenda(m.REVENDA_CONCLUIDA_SEM_FINANCEIRO, { failOnStatusCode: false }).then((r) => r.status === 200 && r.body.status === -1 && !r.body.financial_id),
  REVENDA_COM_FINANCEIRO: (m) => api.obterDetalheRevenda(m.REVENDA_COM_FINANCEIRO, { failOnStatusCode: false }).then((r) => r.status === 200 && Number(r.body.financial_id) > 0),
  CODIGO_DE_RECEITA: (m) => api.obterDetalheRevenda(m.CODIGO_DE_RECEITA, { failOnStatusCode: false }).then((r) => r.status === 404),
  PRODUTO_COM_LOTE: (m) => api.buscarProdutosRevenda({ q: m.PRODUTO_COM_LOTE.termo_busca, per_page: 50 }, { failOnStatusCode: false }).then((r) => {
    const p = ((r.body && r.body.items) || []).find((i) => i.id === m.PRODUTO_COM_LOTE.id);
    const lote = (id) => p && (p.lots || []).find((l) => l.id === id);
    return !!(lote(m.PRODUTO_COM_LOTE.lote_id) && lote(m.PRODUTO_COM_LOTE.lote_saldo_pequeno_id) && lote(m.PRODUTO_COM_LOTE.lote_saldo_pequeno_id).balance < 99999);
  }),
  PRODUTO_COM_UM_LOTE_NA_BUSCA: (m) => api.buscarProdutosRevenda({ q: m.PRODUTO_COM_UM_LOTE_NA_BUSCA.termo, per_page: 50 }, { failOnStatusCode: false }).then((r) => {
    const p = ((r.body && r.body.items) || []).find((i) => i.id === m.PRODUTO_COM_UM_LOTE_NA_BUSCA.id);
    return !!(p && (p.lots || []).length === 1 && p.lots[0].id === m.PRODUTO_COM_UM_LOTE_NA_BUSCA.lote_id);
  }),
  PRODUTO_SEM_LOTE_NA_BUSCA: (m) => api.buscarProdutosRevenda({ q: m.PRODUTO_SEM_LOTE_NA_BUSCA.termo, per_page: 50 }, { failOnStatusCode: false }).then((r) => {
    const p = ((r.body && r.body.items) || []).find((i) => i.id === m.PRODUTO_SEM_LOTE_NA_BUSCA.id);
    return !!(p && Array.isArray(p.lots) && p.lots.length === 0);
  }),
  TERMO_COM_ACENTO: (m) => api.buscarProdutosRevenda({ q: m.TERMO_COM_ACENTO.com, per_page: 50 }, { failOnStatusCode: false }).then((r) => ((r.body && r.body.items) || []).length > 0),
};
const conferirMassaRevenda = (ctx, chaves) => {
  const derivadas = [];
  chaves.forEach((chave) => CONFERE_MASSA_REVENDA[chave](massaRevendaDaGuarda).then((ok) => { if (!ok) derivadas.push(chave); }));
  cy.then(() => {
    if (derivadas.length) {
      cy.log(`⏭️ Sem massa: ${derivadas.join(', ')} derivou em massaRevenda.js; o context pula em vez de ficar vermelho ([R-ATEMPORAL])`);
      ctx.skip();
    }
  });
};

describe('0-A. Backend: Acesso, Cadastros e Orçamentos (API Real)', () => {

  let storeId = 1;
  let loggedUserId = Number(configEnv.USER_CODE) || 122;

  before(() => {
    // Autentica diretamente no backend real e recupera o ID da loja vinculada e usuário logado
    api.autenticar().then(() => {
      api.obterUsuarioLogado().then((res) => {
        if (res.body && (res.body.store_code || res.body.store_id)) {
          storeId = res.body.store_code || res.body.store_id;
        }
        if (res.body && res.body.user_id) {
          loggedUserId = res.body.user_id;
        }
      });
    });
  });


  // ---------------------------------------------------------------------------
  // CONTEXTO 1: AUTENTICAÇÃO E PERFIL DO OPERADOR
  // ---------------------------------------------------------------------------
  context('1. Autenticação e Perfil de Usuário', () => {

    it('1.1 Deve autenticar com sucesso usando credenciais válidas e retornar token JWT', () => {
      // Arrange
      const credenciais = {
        cnpj: configEnv.USER_CNPJ,
        username: configEnv.USER_CODE,
        password: configEnv.USER_PASSWORD,
      };

      // Act
      api.post('/auth/login', credenciais).then((res) => {
        // Assert
        expect(res.status, 'Status de login válido').to.eq(200);
        expect(res.body, 'Corpo da resposta').to.be.an('object');
        const token = res.body.token || res.body.access_token;
        expect(token, 'Token JWT retornado').to.be.a('string').and.not.be.empty;
      });
    });

    it('1.2 Deve rejeitar autenticação com senha incorreta retornando status 401', () => {
      // Arrange
      const credenciaisInvalidas = {
        cnpj: configEnv.USER_CNPJ,
        username: configEnv.USER_CODE,
        password: 'SenhaIncorreta@999',
      };

      // Act
      api.post('/auth/login', credenciaisInvalidas).then((res) => {
        // Assert: 401 Unauthorized com envelope de erro
        expect(res.status, 'Status de credenciais incorretas').to.eq(401);
        expect(res.body, 'Corpo da resposta de erro').to.be.an('object');
        expect(res.body.message, 'Mensagem de credenciais inválidas').to.eq('Credenciais inválidas');
      });
    });

    it('1.3 Deve consultar os dados cadastrais do operador autenticado (/users/me)', () => {
      // Act
      api.obterUsuarioLogado().then((res) => {
        // Assert
        expect(res.status, 'Status da consulta do operador').to.eq(200);
        expect(res.body).to.have.property('user_id');
        expect(res.body).to.have.property('display_name');
        expect(res.body).to.have.property('cnpj');
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 2: CENTRAL, MÉTRICAS E RECURSOS DA LOJA
  // ---------------------------------------------------------------------------
  context('2. Central, Métricas e Recursos da Loja', () => {

    it('2.1 Deve consultar a matriz de recursos e módulos habilitados (/resources)', () => {
      // Backend#808: o recurso de Clientes se chama `customer`; `patient` segue publicado com o mesmo valor só até a etapa 3 (medido na dev em 2026-11-06)
      const slugsCanonicos = [
        'central', 'attendance', 'prescription', 'customer', 'prescriber',
        'resale', 'redo', 'delivery', 'financial', 'metrics', 'report'
      ];

      // Act
      api.obterRecursosLoja(storeId).then((res) => {
        // Assert
        expect(res.status, 'Status da matriz de recursos').to.eq(200);
        expect(res.body).to.have.property('resources');
        expect(res.body.resources).to.be.an('object');

        // Valida presença e tipagem estrita de cada um dos 11 slugs canônicos
        slugsCanonicos.forEach((slug) => {
          expect(res.body.resources, `Slug canônico '${slug}'`).to.have.property(slug);
          expect(res.body.resources[slug], `Tipo booleano de '${slug}'`).to.be.a('boolean');
        });
        // Transição do backend#808: enquanto `patient` vier, ele espelha o `customer`
        if ('patient' in res.body.resources) {
          expect(res.body.resources.patient, 'patient (nome anterior) com o mesmo valor de customer').to.eq(res.body.resources.customer);
        }
      });
    });

    it('2.2 Deve rejeitar consulta de recursos sem autenticação ou com token inválido (401 Unauthorized)', () => {
      // 1. Requisição sem cabeçalho Authorization
      api.obterRecursosLoja(storeId, { headers: { Authorization: '' } }).then((res) => {
        expect(res.status, 'Status sem token').to.eq(401);
        expect(res.body.error, 'Erro de autenticação').to.eq('Unauthorized');
        expect(res.body.message, 'Mensagem de autenticação necessária').to.include('Authentication required');
      });

      // 2. Requisição com token JWT adulterado/inválido
      api.obterRecursosLoja(storeId, { headers: { Authorization: 'Bearer token_invalido_expirado' } }).then((res) => {
        expect(res.status, 'Status com token inválido').to.eq(401);
        expect(res.body.error, 'Erro com token inválido').to.eq('Unauthorized');
      });
    });

    it('2.3 Deve consultar o resumo e contadores de atendimentos (/attendances/summary)', () => {
      // Act
      api.obterResumoAtendimentos(storeId).then((res) => {
        // Assert
        expect(res.status, 'Status do resumo de atendimentos').to.eq(200);
        expect(res.body).to.be.an('object');
        expect(res.body).to.have.property('counts');
        expect(res.body.counts).to.have.property('all').that.is.a('number').and.gte(0);
      });
    });

    it('2.4 Deve consultar as permissões e capabilities da loja (/attendance-capabilities)', () => {
      // Act
      api.obterCapabilitiesLoja(storeId).then((res) => {
        // Assert
        expect(res.status, 'Status das capabilities de atendimento').to.eq(200);
        expect(res.body).to.have.property('capabilities');
        expect(res.body.capabilities).to.be.an('object');

        // Valida presença e tipagem booleana das chaves essenciais do contrato de capabilities (#399 / PR #267)
        const chavesObrigatorias = [
          'can_access_attendance_module',
          'can_list_group_agents',
          'can_change_attendant_status',
          'can_create_attendance',
          'can_view_pending_attendance',
          'can_view_occupied_attendance'
        ];

        chavesObrigatorias.forEach((chave) => {
          expect(res.body.capabilities, `Presença de '${chave}'`).to.have.property(chave);
          expect(res.body.capabilities[chave], `Tipagem booleana de '${chave}'`).to.be.a('boolean');
        });
      });
    });


    // backend#810 (PR #864): o mapa de módulo passou a publicar 599, 640 e 689 como permissão nua (sem olhar estado de atendimento), para a Receita saber
    // antes de existir o vínculo se pode incluir, remover e trocar o atendimento (front#623). O mapa por atendimento segue estreitando (fechado ou sem dono = false).
    const CHAVES_DE_MOVIMENTO = ['can_add_movement', 'can_remove_movement', 'can_transfer_omni_movement'];
    it('2.5 Deve publicar no mapa de módulo as permissões de incluir, remover e trocar o atendimento da receita (599, 640, 689) sem estreitar pelo estado de um atendimento (Issue backend#810)', () => {
      let modulo;
      api.obterCapabilitiesLoja(storeId).then((res) => {
        expect(res.status, 'Status de /attendance-capabilities').to.eq(200);
        modulo = res.body.capabilities;
        CHAVES_DE_MOVIMENTO.forEach((chave) => expect(modulo[chave], `${chave} no mapa de módulo`).to.be.a('boolean'));
      });
      // Um atendimento Finalizado, descoberto na hora: no mapa dele, incluir a receita é sempre false (fechado)
      cy.then(() => api.listarAtendimentos(storeId, { status: 'finished', page: 1, per_page: 5 })).then((res) => {
        const finalizado = (res.body.items || [])[0];
        expect(finalizado, '🔒 massa: um atendimento Finalizado na janela da lista').to.be.an('object');
        return api.get(`/attendances/${finalizado.id}/capabilities`).then((resAt) => {
          expect(resAt.status, `Status das capabilities do atendimento ${finalizado.id}`).to.eq(200);
          const doAtendimento = resAt.body.capabilities || resAt.body;
          expect(doAtendimento.can_add_movement, 'No atendimento Finalizado, incluir a receita é false (o mapa por atendimento estreita)').to.eq(false);
          // Coerência: o mapa por atendimento só estreita; nunca libera o que o módulo nega ([R-CAPXACAO])
          CHAVES_DE_MOVIMENTO.forEach((chave) => {
            if (modulo[chave] === false) expect(doAtendimento[chave], `${chave} negado no módulo também negado no atendimento`).to.eq(false);
          });
          // A permissão nua: com a 599, o módulo diz true mesmo com o atendimento fechado
          if (modulo.can_add_movement === true) cy.log('Módulo true × atendimento Finalizado false: o módulo não estreita pelo estado');
          else cy.log('⚠️ A conta está sem a 599: só a coerência foi provada');
        });
      });
    });

    it('2.6 Deve trazer completed_at em todo item da lista de atendimentos, preenchido em Instant (Z, segundos 00) só no Concluído e nulo nos demais status (Issue backend#810)', function () {
      const STATUS = { pending: 0, in_progress: 1, completed: 2, finished: 3, discarded: 4 };
      let concluidosPreenchidos = 0;
      cy.wrap(Object.keys(STATUS)).each((status) => api.listarAtendimentos(storeId, { status, page: 1, per_page: 100 }).then((res) => {
        expect(res.status, `Status da lista com status=${status}`).to.eq(200);
        (res.body.items || []).forEach((item) => {
          expect(item, `completed_at presente no atendimento ${item.id} (${status})`).to.have.property('completed_at');
          if (STATUS[status] === 2) {
            if (item.completed_at !== null) {
              concluidosPreenchidos++;
              expect(item.completed_at, `completed_at do Concluído ${item.id}`).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00Z$/);
            }
          } else {
            expect(item.completed_at, `completed_at fora do Concluído (${status}, atendimento ${item.id})`).to.eq(null);
          }
        });
      })).then(() => {
        if (concluidosPreenchidos === 0) {
          cy.log('⏭️ Sem massa: nenhum atendimento Concluído com completed_at na janela da lista (só a ausência fora do Concluído foi provada)');
          this.skip();
        }
      });
    });
  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 3: CANAIS DE COMUNICAÇÃO E MENSAGENS RÁPIDAS
  // ---------------------------------------------------------------------------
  context('3. Canais de Comunicação e Mensagens Rápidas', () => {

    it('3.1 Deve listar os canais de atendimento vinculados à loja (/channels)', () => {
      // Act
      api.listarCanais(storeId).then((res) => {
        // Assert
        expect(res.status, 'Status da listagem de canais').to.eq(200);
        const canais = res.body.items || res.body.data || res.body;
        expect(canais, 'Lista de canais').to.be.an('array');
      });
    });

    it('3.2 Deve listar os grupos de canais de atendimento (/channel-groups)', () => {
      // Act
      api.listarGruposCanal(storeId, 6).then((res) => {
        // Assert
        expect(res.status, 'Status dos grupos de canais').to.eq(200);
        const grupos = res.body.items || res.body.data || res.body;
        expect(grupos, 'Lista de grupos').to.be.an('array');
      });
    });

    it('3.3 Deve listar as mensagens rápidas cadastradas (/standard-messages)', () => {
      // Act
      api.listarMensagensPadrao(storeId).then((res) => {
        // Assert
        expect(res.status, 'Status de mensagens padrão').to.eq(200);
        const mensagens = res.body.items || res.body.data || res.body;
        expect(mensagens, 'Lista de mensagens padrão').to.be.an('array');
      });
    });

    it('3.4 Deve consultar as capabilities de mensagens padrão (/standard-message-capabilities)', () => {
      // Act
      api.obterCapabilitiesMensagensPadrao(storeId).then((res) => {
        // Assert
        expect(res.status, 'Status de capabilities de mensagem').to.eq(200);
        expect(res.body).to.have.property('capabilities');
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 5: PRESCRIÇÕES E CAPABILITIES DE MÓDULOS
  // ---------------------------------------------------------------------------
  context('4. Prescrições e Capabilities de Módulos', () => {

    it('4.1 Deve consultar as capabilities do módulo de Receitas (/prescription-capabilities)', () => {
      // Act
      api.obterCapabilitiesReceitas(storeId).then((res) => {
        // Assert
        expect(res.status, 'Status das capabilities de prescrição').to.eq(200);
        expect(res.body).to.have.property('capabilities');
        expect(res.body.capabilities).to.be.an('object');

        // Valida as 5 chaves de processo de manipulação e as 2 de convênio (spec #399 / PR #268)
        const chavesPrescricao = [
          'can_create_recipe',
          'can_update_covenant',
          'can_search_client_agreements',
          'can_access_manipulation_processes',
          'can_update_other_employee_process',
          'can_reassign_process_employee',
          'can_mark_process_commissioned',
          'can_delete_manipulation_process'
        ];

        chavesPrescricao.forEach((chave) => {
          expect(res.body.capabilities, `Presença de '${chave}'`).to.have.property(chave);
          expect(res.body.capabilities[chave], `Tipagem booleana de '${chave}'`).to.be.a('boolean');
        });

        // Garante a eliminação da chave legada/fantasma can_edit_agreement
        expect(res.body.capabilities, 'Chave legada can_edit_agreement não deve existir').to.not.have.property('can_edit_agreement');
      });
    });

    it('4.2 Deve consultar as capabilities do módulo de Entregas (/delivery-capabilities)', () => {
      // Act
      api.obterCapabilitiesEntrega(storeId).then((res) => {
        // Assert
        expect(res.status, 'Status das capabilities de entrega').to.eq(200);
        expect(res.body).to.have.property('capabilities');
        expect(res.body.capabilities).to.be.an('object');

        // Valida presença das chaves de entrega
        const chavesEntrega = [
          'can_view_delivery',
          'can_create_delivery',
          'can_cancel_delivery',
          'can_update_delivery',
          'can_view_delivery_details',
          'can_view_delivery_change_log'
        ];

        chavesEntrega.forEach((chave) => {
          expect(res.body.capabilities, `Presença de '${chave}'`).to.have.property(chave);
          expect(res.body.capabilities[chave], `Tipagem booleana de '${chave}'`).to.be.a('boolean');
        });

        // Confirmação de que detalhes e log de entrega são fixados como booleanos false conforme spec #399
        expect(res.body.capabilities.can_view_delivery_details, 'can_view_delivery_details deve ser false').to.be.false;
        expect(res.body.capabilities.can_view_delivery_change_log, 'can_view_delivery_change_log deve ser false').to.be.false;
      });
    });

    it('4.3 Deve consultar as capabilities do módulo Financeiro (/financial-capabilities)', () => {
      const chavesFinanceiro = [
        'can_view_customer_financial',
        'can_cancel_customer_financial',
        'can_register_client_credit',
        'can_generate_payment_link',
        'can_generate_financial_nfse',
        'can_view_financial_attachments'
      ];

      // Act
      api.obterCapabilitiesFinanceiro(storeId).then((res) => {
        // Assert
        expect(res.status, 'Status das capabilities financeiras').to.eq(200);
        expect(res.body).to.have.property('capabilities');
        expect(res.body.capabilities).to.be.an('object');

        // Valida presença e tipagem estrita das 6 chaves do módulo financeiro
        chavesFinanceiro.forEach((chave) => {
          expect(res.body.capabilities, `Presença de '${chave}'`).to.have.property(chave);
          expect(res.body.capabilities[chave], `Tipagem booleana de '${chave}'`).to.be.a('boolean');
        });
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 6: SEGURANÇA E CONTROLE DE ACESSO (RBAC)
  // ---------------------------------------------------------------------------
  context('5. Segurança e Controle de Acesso (RBAC)', () => {

    it('5.1 Deve rejeitar requisição protegida sem token de autorização com status 401', () => {
      // Act: Dispara requisição direta removendo explicitamente o Bearer Token
      api.request({
        method: 'GET',
        url: '/users/me',
        headers: {
          'Authorization': '',
        },
      }).then((res) => {
        // Assert: 401 Unauthorized com validação de envelope de segurança
        expect(res.status, 'Status de rota protegida sem token').to.eq(401);
        expect(res.body, 'Corpo de erro').to.be.an('object');
        expect(res.body.error, 'Erro de autenticação').to.eq('Unauthorized');
      });
    });

    it('5.2 Deve rejeitar requisição com Bearer Token adulterado com status 401', () => {
      // Act: Dispara requisição com token inválido/malformado
      api.request({
        method: 'GET',
        url: '/users/me',
        headers: {
          'Authorization': 'Bearer token_invalido_adulterado_12345',
        },
      }).then((res) => {
        // Assert: 401 Unauthorized com validação de envelope de segurança
        expect(res.status, 'Status de token adulterado').to.eq(401);
        expect(res.body, 'Corpo de erro').to.be.an('object');
        expect(res.body.error, 'Erro de autenticação').to.eq('Unauthorized');
      });
    });

    it('5.3 Deve garantir autenticação obrigatória (401) nas rotas de capabilities de módulos', () => {
      // Valida que as 4 rotas de capabilities recusam chamadas não autenticadas
      api.obterCapabilitiesLoja(storeId, { headers: { Authorization: '' } }).then((res) => {
        expect(res.status, 'Status sem token em attendance-capabilities').to.eq(401);
      });

      api.obterCapabilitiesReceitas(storeId, { headers: { Authorization: '' } }).then((res) => {
        expect(res.status, 'Status sem token em prescription-capabilities').to.eq(401);
      });

      api.obterCapabilitiesEntrega(storeId, { headers: { Authorization: '' } }).then((res) => {
        expect(res.status, 'Status sem token em delivery-capabilities').to.eq(401);
      });

      api.obterCapabilitiesFinanceiro(storeId, { headers: { Authorization: '' } }).then((res) => {
        expect(res.status, 'Status sem token em financial-capabilities').to.eq(401);
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 11: ENFORCEMENT DE RECURSOS CONTRATADOS PELO NÚCLEO (PRs #407, #408, #409 e #410)
  // ---------------------------------------------------------------------------
  context('6. Enforcement de Recursos Contratados pelo Núcleo (PRs #407, #408, #409 e #410)', () => {

    it('6.1 Deve recusar chamada direta a rota de recurso não contratado com 403 RESOURCE_NOT_ENTITLED (delivery)', () => {
      // Act: Dispara requisição direta para /deliveries (recurso desativado no contrato da farmácia)
      api.listarEntregas(storeId).then((res) => {
        // Assert: 403 Forbidden com código e mensagem padronizada
        expect(res.status, 'Status de recurso não contratado').to.eq(403);
        expect(res.body.code, 'Código de erro de recurso').to.eq('RESOURCE_NOT_ENTITLED');
        expect(res.body.resource, 'Slug do recurso recusado').to.eq('delivery');
        expect(res.body.message, 'Mensagem padronizada').to.include('Este recurso não está disponível para a sua farmácia');
      });
    });

    it('6.2 Deve permitir acesso normal a rotas de recursos contratados pela farmácia (attendance)', () => {
      // Act: Dispara requisição para /attendances (recurso contratado pela farmácia)
      api.listarAtendimentos(storeId).then((res) => {
        // Assert: 200 OK liberado pelo interceptor de recursos
        expect(res.status, 'Status de acesso a recurso contratado').to.eq(200);
        expect(res.body).to.have.property('items');
      });
    });

    it('6.3 Deve permitir acesso irrestrito a endpoints e catálogos isentos de gate de recurso (clients, users/me)', () => {
      // 1. Catálogo compartilhado de clientes (/clients?q=...)
      api.buscarClientes(storeId, configEnv.DEFAULT_CLIENT_NAME || 'klismam').then((resCli) => {
        expect(resCli.status, 'Status de catálogo isento').to.eq(200);
      });

      // 2. Endpoint de identidade (/users/me)
      api.obterUsuarioLogado().then((resUser) => {
        expect(resUser.status, 'Status de identidade isenta').to.eq(200);
        expect(resUser.body).to.have.property('user_id');
      });
    });

    it('6.4 Deve manter mapas can_* funcionais mesmo quando o recurso estiver desabilitado no contrato da loja (RN3 - financial-capabilities)', () => {
      // Act: Consulta capabilities financeiras com o recurso financial desligado no contrato
      api.obterCapabilitiesFinanceiro(storeId).then((res) => {
        // Assert: Responde 200 OK avaliando os grants individuais sem sofrer interferência do recurso
        expect(res.status, 'Status de capabilities com recurso desativado').to.eq(200);
        expect(res.body).to.have.property('capabilities');
        expect(res.body.capabilities).to.have.property('can_view_customer_financial');
        expect(res.body.capabilities).to.have.property('can_register_client_credit');
      });
    });

    it('6.5 Deve verificar a integridade e fail-closed dos 11 slugs canônicos retornados por GET /resources (RN2)', () => {
      // Backend#808: `customer` é o slug de Clientes; o `patient` da transição é conferido no #2.1
      const slugsEsperados = [
        'central', 'attendance', 'prescription', 'customer', 'prescriber',
        'resale', 'redo', 'delivery', 'financial', 'metrics', 'report'
      ];

      // Act
      api.obterRecursosLoja(storeId).then((res) => {
        // Assert: 200 OK com exatamente os 11 slugs e tipagem booleana estrita
        expect(res.status, 'Status de consulta de recursos').to.eq(200);
        expect(res.body).to.have.property('resources');
        slugsEsperados.forEach((slug) => {
          expect(res.body.resources, `Slug '${slug}'`).to.have.property(slug);
          expect(res.body.resources[slug], `Booleano para '${slug}'`).to.be.a('boolean');
        });
      });
    });

    it('6.6 Deve rejeitar acesso sem token com 401 Unauthorized antes da avaliação do gate de recurso', () => {
      // Act: Tenta acessar rota gateada sem header Authorization
      api.listarEntregas(storeId, {}, { headers: { Authorization: '' } }).then((res) => {
        // Assert: AuthInterceptor intercepta antes de ResourceInterceptor
        expect(res.status, 'Status de autenticação prioritária').to.eq(401);
        expect(res.body.error, 'Erro de autenticação').to.eq('Unauthorized');
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 12: OTIMIZAÇÃO E LATÊNCIA DE CAPABILITIES POR ATENDIMENTO (PRs #393 E #405)
  // ---------------------------------------------------------------------------
  context('7. Otimização e Latência de Capabilities por Atendimento (PRs #393 e #405)', () => {

    const attendanceIdTeste = 1;

    it('7.1 Deve consultar capabilities do atendimento com latência otimizada (< 500ms) após resolução hasAll (PR #393)', () => {
      const start = Date.now();

      // Act: Dispara consulta de capabilities da conversa
      api.obterCapabilitiesAtendimento(storeId, attendanceIdTeste).then((res) => {
        const duration = Date.now() - start;

        // Assert: 200 OK e latência consideravelmente menor que o 1s histórico pré-PR #393
        expect(res.status, 'Status da consulta de capabilities').to.eq(200);
        expect(res.body).to.have.property('capabilities');
        expect(duration, 'Latência otimizada da rota (< 500ms)').to.be.lessThan(500);
      });
    });

    it('7.2 Deve validar a integridade e tipagem booleana estrita das 18 chaves de capabilities do atendimento', () => {
      const chavesEsperadas = [
        'can_view_attendance_detail',
        'can_list_attendance_messages',
        'can_send_attendance_messages',
        'can_mark_completed',
        'can_mark_discarded',
        'can_mark_finished',
        'can_transfer_assigned_attendance',
        'can_transfer_pending_attendance',
        'can_send_payment_link',
        'can_add_movement',
        'can_remove_movement',
        'can_save_customer_on_attendance',
        'can_change_attendant_status',
        'can_change_default_customer',
        'can_change_online_payment_with_benefit_program',
        'can_transfer_omni_movement',
        'can_manage_os_support',
        'can_take_attendance',
      ];

      // Act
      api.obterCapabilitiesAtendimento(storeId, attendanceIdTeste).then((res) => {
        // Assert: Valida a presença e tipo booleano de cada uma das 18 definições (backend#561 acrescentou can_take_attendance)
        expect(res.status, 'Status da resposta').to.eq(200);
        const caps = res.body.capabilities;
        expect(Object.keys(caps).length, 'Total de capabilities').to.eq(18);

        chavesEsperadas.forEach((chave) => {
          expect(caps, `Chave '${chave}' presente`).to.have.property(chave);
          expect(caps[chave], `Chave '${chave}' deve ser booleana`).to.be.a('boolean');
        });
      });
    });

    it('7.3 Deve validar a resolução em memória das flags de transferência (can_transfer_*)', () => {
      // Act
      api.obterCapabilitiesAtendimento(storeId, attendanceIdTeste).then((res) => {
        // Assert: Ambas as flags são calculadas em memória sem requisições adicionais
        expect(res.status, 'Status da resposta').to.eq(200);
        expect(res.body.capabilities).to.have.property('can_transfer_assigned_attendance');
        expect(res.body.capabilities).to.have.property('can_transfer_pending_attendance');
        expect(res.body.capabilities.can_transfer_assigned_attendance).to.be.a('boolean');
        expect(res.body.capabilities.can_transfer_pending_attendance).to.be.a('boolean');
      });
    });

    it('7.4 Deve demonstrar estabilidade e ausência de overhead N+1 em consultas consecutivas de capabilities', () => {
      // Act: Dispara 3 requisições consecutivas para validar consistência do cache de requisição/lote
      api.obterCapabilitiesAtendimento(storeId, attendanceIdTeste).then((res1) => {
        expect(res1.status, 'Status da chamada 1').to.eq(200);

        api.obterCapabilitiesAtendimento(storeId, attendanceIdTeste).then((res2) => {
          expect(res2.status, 'Status da chamada 2').to.eq(200);

          api.obterCapabilitiesAtendimento(storeId, attendanceIdTeste).then((res3) => {
            expect(res3.status, 'Status da chamada 3').to.eq(200);
            expect(res3.body.capabilities).to.deep.eq(res1.body.capabilities);
          });
        });
      });
    });

    it('7.5 Deve rejeitar consulta de capabilities do atendimento sem autenticação (401 Unauthorized)', () => {
      // Act: Dispara sem token
      api.obterCapabilitiesAtendimento(storeId, attendanceIdTeste, { headers: { Authorization: '' } }).then((res) => {
        // Assert
        expect(res.status, 'Status sem token').to.eq(401);
        expect(res.body.error, 'Erro de autenticação').to.eq('Unauthorized');
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 13: ESCOPO DE AVALIAÇÃO DE GRANTS PELA LOJA DO TOKEN (PR #412)
  // ---------------------------------------------------------------------------
  context('8. Escopo de Avaliação de Grants pela Loja do Token (PR #412)', () => {

    it('8.1 Deve exigir parâmetro purpose válido na listagem de filiais (422 INVALID_CONTEXT)', () => {
      // Act: Dispara listagem de filiais sem informar o purpose obrigatório
      api.get(`/branches`).then((res) => {
        // Assert: 422 Unprocessable Content com mensagem contextual
        expect(res.status, 'Status de validação de parâmetro').to.eq(422);
        expect(res.body.message, 'Mensagem de obrigatoriedade de purpose').to.include('parâmetro purpose é obrigatório');
      });
    });

    it('8.2 Deve rejeitar requisição sem autenticação com 401 Unauthorized antes da validação de loja', () => {
      // Act: Dispara sem Bearer token
      api.listarFiliais(storeId, 'pickup', { headers: { Authorization: '' } }).then((res) => {
        // Assert: AuthInterceptor intercepta com 401
        expect(res.status, 'Status sem token').to.eq(401);
        expect(res.body.error, 'Erro de autenticação').to.eq('Unauthorized');
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 14: CADASTRO DE CLIENTES E SUB-RECURSOS (PRs #416 a #422 e #438)
  // ---------------------------------------------------------------------------
  context('9. Cadastro de Clientes e Sub-recursos (PRs #416 a #422 e #438)', () => {

    const clientIdTeste = 867092;
    let novoClienteCriadoId = null;

    it('9.1 Deve expor as 18 capabilities de clientes e confirmar governança sob o recurso customer, antigo patient (PR #418 e #438, backend#808)', () => {
      // Act: Consulta capabilities do módulo de clientes
      api.obterCapabilitiesClientes(storeId).then((res) => {
        // Assert: 200 OK com mapa estrito das 18 capabilities
        expect(res.status, 'Status de capabilities de clientes').to.eq(200);
        expect(res.body).to.have.property('capabilities');
        const caps = res.body.capabilities;

        // Validação das capabilities de CRUD e campos condicionais
        expect(caps).to.have.property('can_create_client', true);
        expect(caps).to.have.property('can_update_client', true);
        expect(caps).to.have.property('can_deactivate_client', true);
        expect(caps).to.have.property('can_change_client_name', true);
        // A 341 é grant da conta (a do CI e a local hoje vêm com false): só o formato; a coerência com o PATCH está no #19.4
        expect(caps).to.have.property('can_change_label_name').that.is.a('boolean');
        expect(caps).to.have.property('can_use_distinct_label_name', true);
        expect(caps).to.have.property('can_change_debt_status', true);
        expect(caps).to.have.property('can_change_discount_type', true);
        expect(caps).to.have.property('can_change_discount_percentage', true);
        expect(caps).to.have.property('can_change_free_delivery', true);
        expect(caps).to.have.property('can_change_weighing_notes', true);
        expect(caps).to.have.property('can_change_wildcard_client', true);

        // Validação das dispensas de obrigatoriedade cadastral
        expect(caps).to.have.property('can_create_client_without_address', true);
        expect(caps).to.have.property('can_create_client_without_document', true);
        expect(caps).to.have.property('can_create_client_without_phone', true);
        expect(caps).to.have.property('can_create_client_from_other_state_without_document', true);
        expect(caps).to.have.property('can_create_client_without_gender', true);
        expect(caps).to.have.property('can_view_hidden_lgpd_data', false);
      });

      // Assert complementar: o recurso de Clientes no Núcleo é `customer` desde a backend#808 (era `patient`, PR #438); o nome anterior só espelha durante a transição
      api.obterRecursosLoja(storeId).then((resRec) => {
        expect(resRec.status, 'Status de recursos').to.eq(200);
        expect(resRec.body.resources.customer, 'Recurso customer contratado').to.eq(true);
        if ('patient' in resRec.body.resources) {
          expect(resRec.body.resources.patient, 'patient (nome anterior) espelha customer').to.eq(true);
        }
      });
    });

    it('9.2 Deve consultar catálogos e lookups de apoio sem exigência de grants de permissão', () => {
      // 1. Grupos de clientes (TIPOGRUPO = 8)
      api.listarGruposClientes(storeId).then((resGrupos) => {
        expect(resGrupos.status, 'Status de grupos').to.eq(200);
        expect(resGrupos.body).to.have.property('items');
        expect(resGrupos.body.items).to.be.an('array');
      });

      // 2. Classes de movimentação (CLIENTE_CLASSE_M)
      api.listarClassesMovimentacaoClientes(storeId).then((resClasseM) => {
        expect(resClasseM.status, 'Status de classe M').to.eq(200);
        expect(resClasseM.body).to.have.property('items');
        expect(resClasseM.body.items).to.be.an('array');
      });

      // 3. Classes de pós-venda (CLIENTE_CLASSE_R)
      api.listarClassesPosVendaClientes(storeId).then((resClasseR) => {
        expect(resClasseR.status, 'Status de classe R').to.eq(200);
        expect(resClasseR.body).to.have.property('items');
        expect(resClasseR.body.items).to.be.an('array');
      });

      // 4. Busca territorial de cidades (CIDADEESTADO)
      api.listarCidades(storeId, { q: 'GOIANIA' }).then((resCidades) => {
        expect(resCidades.status, 'Status de cidades').to.eq(200);
        expect(resCidades.body).to.have.property('items');
        expect(resCidades.body.items).to.be.an('array');
      });

      // 5. Busca territorial de bairros vinculados a uma cidade (REGIAODETALHE)
      api.listarBairros(storeId, 66).then((resBairros) => {
        expect(resBairros.status, 'Status de bairros com city_id').to.eq(200);
        expect(resBairros.body).to.have.property('items');
        expect(resBairros.body.items).to.be.an('array');
      });
    });

    it('9.3 Deve exigir parâmetro city_id na busca de bairros respondendo 422 (CA-12)', () => {
      // Act: Dispara consulta de bairros sem informar city_id obrigatório
      api.get(`/neighborhoods`).then((res) => {
        // Assert: 422 Unprocessable Content protegendo a regra territorial
        expect(res.status, 'Status sem city_id').to.eq(422);
        expect(res.body.message, 'Mensagem de obrigatoriedade').to.match(/cidade|city_id/i);
      });
    });

    it('9.4 Deve listar clientes da tela (type=all/human/animal) sem exigir termo de busca, com fallback 200 vazio em termo curto e busca por nome/código/CPF agnóstica a caixa e acento (Issue backend#586/#588)', () => {
      // Contrato anterior (CA-01/CA-06) exigia recorte mínimo de 3 caracteres em `q` e respondia 422/500
      // sem ele — a ordenação padrão (MAX(CADASTRO_DT) correlacionado por cliente) não resolvia por
      // índice sobre a base inteira (816 mil clientes): termo curto e comum (`mar`) chegava a 500 após
      // 120 s. A #588 trocou a fonte para a procedure CAD_CLIENTE_CON, tornando a query barata o
      // suficiente para dispensar a exigência de recorte mínimo (medido em 2026-10-06).
      const termoBusca = configEnv.DEFAULT_CLIENT_NAME || 'klismam';

      // 1. Typeahead padrão da Receita/Atendimento (sem `type`) não muda — fora do escopo desta issue
      api.buscarClientes(storeId, termoBusca).then((resTypeahead) => {
        expect(resTypeahead.status, 'Status typeahead padrão').to.eq(200);
        expect(resTypeahead.body).to.have.property('items');
      });

      // 2. Listagem da tela (type=all) sem `q`: 200, itens ordenados do mais recente pro mais antigo por last_prescription_at
      api.listarClientes(storeId, { type: 'all' }).then((resSemQ) => {
        expect(resSemQ.status, 'Status sem termo q').to.eq(200);
        const itens = resSemQ.body.items;
        expect(itens, 'itens devem vir na página cheia').to.be.an('array').and.have.length.gte(1);
        itens.forEach((item) => expect(item, `item #${item.id} deve ter last_prescription_at`).to.have.property('last_prescription_at'));
        const timestamps = itens.map((item) => new Date(item.last_prescription_at).getTime());
        const ordenadoDesc = timestamps.every((t, i) => i === 0 || t <= timestamps[i - 1]);
        expect(ordenadoDesc, 'ordem deve ser last_prescription_at decrescente (mais recente primeiro)').to.be.true;
      });

      // 3. Termo curto e comum: 200 rápido (não mais 422 nem 500 após 120s)
      const inicioMedicao = Date.now();
      api.listarClientes(storeId, { type: 'all', q: 'mar' }).then((resCurtoComum) => {
        expect(resCurtoComum.status, 'Status com termo curto e comum').to.eq(200);
        expect(Date.now() - inicioMedicao, 'tempo de resposta deve ficar bem abaixo do antigo limiar de 120s').to.be.lessThan(10000);
        expect(resCurtoComum.body.items.length, 'deve haver resultados para "mar"').to.be.gte(1);
        resCurtoComum.body.items.forEach((item) => {
          expect(item.name.toUpperCase(), `nome de #${item.id} deve começar com MAR`).to.match(/^MAR/);
        });
      });

      // 4. Busca ignora caixa e acento (mesmo resultado de "mar")
      api.listarClientes(storeId, { type: 'all', q: 'mar' }).then((resBase) => {
        return api.listarClientes(storeId, { type: 'all', q: 'MAR' }).then((resMaiuscula) => {
          expect(resMaiuscula.status, 'Status com termo maiúsculo').to.eq(200);
          expect(resMaiuscula.body.items.length, 'MAR deve achar o mesmo volume que mar').to.eq(resBase.body.items.length);
          return api.listarClientes(storeId, { type: 'all', q: 'már' });
        }).then((resAcento) => {
          expect(resAcento.status, 'Status com termo acentuado').to.eq(200);
          expect(resAcento.body.items.length, 'már deve achar o mesmo volume que mar').to.eq(resBase.body.items.length);
        });
      });

      // 5. Termo curto sem resultado algum: 200 com items vazio (não mais 422)
      api.listarClientes(storeId, { type: 'all', q: 'ma' }).then((resCurto) => {
        expect(resCurto.status, 'Status com termo curto (2 caracteres)').to.eq(200);
        expect(resCurto.body.items, 'items deve vir vazio, não 422').to.be.an('array').and.have.length(0);
      });

      // 6. Busca pelo código do cliente e pelo CPF (cru e formatado) acham o mesmo registro único
      api.obterDetalheCliente(storeId, clientIdTeste).then((resFicha) => {
        const documentoCru = resFicha.body.document;
        return api.listarClientes(storeId, { type: 'all', q: String(clientIdTeste) }).then((resPorCodigo) => {
          expect(resPorCodigo.status, 'Status busca por código').to.eq(200);
          expect(resPorCodigo.body.items, 'busca por código deve achar o cliente').to.have.length(1);
          expect(resPorCodigo.body.items[0].id, 'id do cliente achado por código').to.eq(clientIdTeste);
          return api.listarClientes(storeId, { type: 'all', q: documentoCru });
        }).then((resPorCpfCru) => {
          expect(resPorCpfCru.status, 'Status busca por CPF cru').to.eq(200);
          expect(resPorCpfCru.body.items, 'busca por CPF cru deve achar o cliente').to.have.length(1);
          expect(resPorCpfCru.body.items[0].id).to.eq(clientIdTeste);
        });
      });

      // 7. type=human e type=animal filtram cada um só o próprio tipo; type=all mistura os dois
      api.listarClientes(storeId, { type: 'human' }).then((resHuman) => {
        resHuman.body.items.forEach((item) => expect(item.type, `item #${item.id} em type=human`).to.eq('human'));
        return api.listarClientes(storeId, { type: 'animal' });
      }).then((resAnimal) => {
        resAnimal.body.items.forEach((item) => expect(item.type, `item #${item.id} em type=animal`).to.eq('animal'));
      });
    });

    it('9.5 Deve retornar ficha completa do cliente com documento cru e capabilities embutidas', () => {
      // Act: Consulta ficha completa do cliente
      api.obterDetalheCliente(storeId, clientIdTeste).then((res) => {
        // Assert: 200 OK com schema estruturado e dados crus
        expect(res.status, 'Status ficha cliente').to.eq(200);
        const cliente = res.body;

        expect(cliente.id, 'ID do cliente').to.eq(clientIdTeste);
        expect(cliente).to.have.property('name');
        expect(cliente).to.have.property('document');
        expect(cliente.document, 'Documento com dígitos puros').to.not.include('.');
        expect(cliente).to.have.property('person_type');
        expect(cliente).to.have.property('active');
        expect(cliente).to.have.property('group');
        expect(cliente).to.have.property('tax');
        expect(cliente).to.have.property('phones');
        expect(cliente).to.have.property('addresses');
        expect(cliente).to.have.property('capabilities');
        expect(cliente.capabilities).to.have.property('can_update_client', true);
      });
    });

    it('9.6 Deve permitir criação de novo cliente aproveitando grants de dispensa de obrigatoriedade (CA-08 e CA-09)', () => {
      const nomeNovoCliente = `Cliente Teste E2E ${Date.now()}`;

      // Act: Cria cliente informando nome e tipo de pessoa (grants 447/443/555 dispensam CPF, endereço e telefone)
      api.criarCliente(storeId, {
        name: nomeNovoCliente,
        person_type: 1,
      }).then((resCriacao) => {
        // Assert: 201 Created com cliente ativo
        expect(resCriacao.status, 'Status criação de cliente').to.eq(201);
        expect(resCriacao.body).to.have.property('id');
        expect(resCriacao.body.name, 'Nome do cliente criado').to.eq(nomeNovoCliente);
        expect(resCriacao.body.active, 'Cliente recém-criado ativo').to.eq(true);

        novoClienteCriadoId = resCriacao.body.id;

        // Limpeza imediata: Desativa o cliente criado para preservar a base de teste
        api.alterarAtivacaoCliente(storeId, novoClienteCriadoId, false).then((resDesativ) => {
          expect(resDesativ.status, 'Status desativação pós-criação').to.eq(200);
          expect(resDesativ.body.active, 'Cliente desativado').to.eq(false);
        });
      });
    });

    it('9.7 Deve bloquear tentativa de cadastrar cliente com documento duplicado respondendo 409 CLIENT_ALREADY_EXISTS (CA-10)', () => {
      // Act: Tenta criar cliente com CPF idêntico ao já persistido
      api.criarCliente(storeId, {
        name: 'Cliente Duplicado Teste E2E',
        person_type: 1,
        document: '01992573298',
      }).then((resDup) => {
        // Assert: 409 Conflict com código padronizado
        expect(resDup.status, 'Status documento duplicado').to.eq(409);
        expect(resDup.body.code, 'Código de duplicidade').to.eq('CLIENT_ALREADY_EXISTS');
        expect(resDup.body.message, 'Mensagem de documento duplicado').to.include('Já existe um cliente com este documento');
        expect(resDup.body).to.have.property('client_id');
      });
    });

    it('9.8 Deve atualizar dados cadastrais via dirty patch sem exigir campos não enviados (Não-Retroatividade)', () => {
      const notaAtualizada = `Observação E2E ${Date.now()}`;

      // Act: Dispara alteração parcial sem informar CPF de cliente histórico
      api.atualizarCliente(storeId, clientIdTeste, {
        notes: { client: notaAtualizada },
      }).then((resPatch) => {
        // Assert: 200 OK confirmando atualização sem exigir campos omitidos
        expect(resPatch.status, 'Status atualização parcial').to.eq(200);
        expect(resPatch.body.notes.client, 'Nota atualizada').to.eq(notaAtualizada);
      });
    });

    it('9.9 Deve executar ciclo de desativação e reativação com idempotência (CA-13)', () => {
      // Cria cliente temporário para validação isolada do ciclo de vida
      api.criarCliente(storeId, {
        name: `Cliente Ciclo Desativacao ${Date.now()}`,
        person_type: 1,
      }).then((resCriado) => {
        expect(resCriado.status, 'Status criação').to.eq(201);
        const idAlvo = resCriado.body.id;

        // 1. Desativação do cliente
        api.alterarAtivacaoCliente(storeId, idAlvo, false).then((resDesativ1) => {
          expect(resDesativ1.status, 'Status primeira desativação').to.eq(200);
          expect(resDesativ1.body.active, 'Status inativo').to.eq(false);

          // 2. Segunda desativação confirma idempotência
          api.alterarAtivacaoCliente(storeId, idAlvo, false).then((resDesativ2) => {
            expect(resDesativ2.status, 'Status desativação redundante').to.eq(200);
            expect(resDesativ2.body.active, 'Permanece inativo').to.eq(false);

            // 3. Reativação do cliente
            api.alterarAtivacaoCliente(storeId, idAlvo, true).then((resReativ) => {
              expect(resReativ.status, 'Status reativação').to.eq(200);
              expect(resReativ.body.active, 'Status reativado').to.eq(true);

              // 4. Deixa desativado ao final
              api.alterarAtivacaoCliente(storeId, idAlvo, false);
            });
          });
        });
      });
    });

    it('9.10 Deve executar CRUD completo de telefones vinculados ao cliente (PR #422)', () => {
      const numeroTeste = `97777${Math.floor(1000 + Math.random() * 9000)}`;
      let telefoneId = null;

      // 1. Criação de telefone (POST)
      api.criarTelefoneCliente(storeId, clientIdTeste, {
        prefix: '62',
        number: numeroTeste,
        whatsapp: true,
        primary: false,
      }).then((resPostPhone) => {
        expect(resPostPhone.status, 'Status criação de telefone').to.eq(201);
        expect(resPostPhone.body).to.have.property('items');
        const telCriado = resPostPhone.body.items.find((t) => t.number === numeroTeste);
        expect(telCriado, 'Telefone localizado na lista').to.not.be.undefined;
        telefoneId = telCriado.id;

        // 2. Atualização de telefone (PATCH)
        api.atualizarTelefoneCliente(storeId, clientIdTeste, telefoneId, {
          whatsapp: false,
        }).then((resPatchPhone) => {
          expect(resPatchPhone.status, 'Status atualização de telefone').to.eq(200);
          const telAtualizado = resPatchPhone.body.items.find((t) => t.id === telefoneId);
          expect(telAtualizado.whatsapp, 'Flag whatsapp alterada').to.eq(false);

          // 3. Exclusão de telefone (DELETE)
          api.excluirTelefoneCliente(storeId, clientIdTeste, telefoneId).then((resDelPhone) => {
            expect(resDelPhone.status, 'Status exclusão de telefone').to.eq(204);
          });
        });
      });
    });

    it('9.11 Deve executar CRUD completo de endereços preservando o apelido description na criação e isolar acesso com 404 para sub-recursos de outros clientes (PR #422, CA-15 e PR #533)', () => {
      const ruaTeste = `Rua E2E Automação ${Date.now()}`;
      const apelidoTeste = `Apelido E2E ${Date.now()}`;
      let enderecoId = null;

      // 1. Criação de endereço (POST) informando description (PR #533: antes gravava DESCRICAO como null literal, perdendo o apelido no nascimento)
      api.criarEnderecoCliente(storeId, clientIdTeste, {
        street: ruaTeste,
        number: '100',
        zip_code: '74000000',
        city_id: 66,
        neighborhood_id: 2692,
        primary: false,
        invoice: false,
        description: apelidoTeste,
      }).then((resPostAddr) => {
        expect(resPostAddr.status, 'Status criação de endereço').to.eq(201);
        expect(resPostAddr.body).to.have.property('items');
        const endCriado = resPostAddr.body.items.find((a) => a.street === ruaTeste);
        expect(endCriado, 'Endereço localizado na lista').to.not.be.undefined;
        expect(endCriado.description, 'Apelido (description) persistido já na criação (PR #533)').to.eq(apelidoTeste);
        enderecoId = endCriado.id;

        // 2. Atualização de endereço (PATCH) trocando o apelido, confirmando ausência de regressão no PATCH
        const apelidoAtualizado = `${apelidoTeste} - editado`;
        api.atualizarEnderecoCliente(storeId, clientIdTeste, enderecoId, {
          complement: 'Bloco E2E',
          description: apelidoAtualizado,
        }).then((resPatchAddr) => {
          expect(resPatchAddr.status, 'Status atualização de endereço').to.eq(200);
          const endAtualizado = resPatchAddr.body.items.find((a) => a.id === enderecoId);
          expect(endAtualizado.complement, 'Complemento atualizado').to.eq('Bloco E2E');
          expect(endAtualizado.description, 'Apelido atualizado via PATCH').to.eq(apelidoAtualizado);

          // 3. Sub-recurso de outro cliente responde 404 Not Found (CA-15)
          api.excluirEnderecoCliente(storeId, 9999998, enderecoId).then((resOutro) => {
            expect(resOutro.status, 'Status outro cliente').to.eq(404);
            expect(resOutro.body.message, 'Mensagem de cliente não encontrado').to.include('Cliente não encontrado');

            // 4. Exclusão no cliente correto (DELETE)
            api.excluirEnderecoCliente(storeId, clientIdTeste, enderecoId).then((resDelAddr) => {
              expect(resDelAddr.status, 'Status exclusão de endereço').to.eq(204);
            });
          });
        });
      });
    });

    it('9.12 Deve preservar o apelido description do endereço embutido na criação do cliente (POST /clients - PR #533)', () => {
      const nomeClienteComEndereco = `Cliente Endereco Embutido E2E ${Date.now()}`;
      const apelidoEmbutido = `Apelido Embutido E2E ${Date.now()}`;

      // Act: Cria cliente já com um endereço embutido no payload (campo singular "address", mesmo addressOf/ClientAddressInput do POST avulso)
      api.criarCliente(storeId, {
        name: nomeClienteComEndereco,
        person_type: 1,
        address: {
          street: 'Rua Endereço Embutido E2E',
          number: '200',
          zip_code: '74000000',
          city_id: 66,
          neighborhood_id: 2692,
          description: apelidoEmbutido,
        },
      }).then((resCriacao) => {
        // Assert: 201 Created com o endereço embutido projetando description (PR #533 corrigiu os dois INSERT)
        expect(resCriacao.status, 'Status criação de cliente com endereço embutido').to.eq(201);
        expect(resCriacao.body, 'Cliente criado deve projetar addresses').to.have.property('addresses');
        const enderecoEmbutido = resCriacao.body.addresses.find((a) => a.number === '200');
        expect(enderecoEmbutido, 'Endereço embutido deve existir na ficha criada').to.not.be.undefined;
        expect(enderecoEmbutido.description, 'Apelido do endereço embutido persistido na criação (PR #533)').to.eq(apelidoEmbutido);

        // Limpeza imediata: Desativa o cliente criado para preservar a base de teste
        api.alterarAtivacaoCliente(storeId, resCriacao.body.id, false);
      });
    });

    it('9.13 deve aplicar trim de espaços nas pontas e o limite de 60 caracteres (NAME_MAX) no apelido description do endereço, em paridade entre criação e edição (PR #533)', () => {
      const apelidoComEspacos = `  Apelido Trim E2E ${Date.now()}  `;
      const apelidoTrimado = apelidoComEspacos.trim();
      let enderecoIdTeste = null;

      // 1. Criação (POST) com espaços nas pontas: DESCRICAO deve ser gravado já sem os espaços (mesmo textPatch do PATCH)
      api.criarEnderecoCliente(storeId, clientIdTeste, {
        street: `Rua Trim E2E ${Date.now()}`,
        number: '301',
        zip_code: '74000000',
        city_id: 66,
        neighborhood_id: 2692,
        description: apelidoComEspacos,
      }).then((resPostTrim) => {
        expect(resPostTrim.status, 'Status criação de endereço com espaços no apelido').to.eq(201);
        const endCriado = resPostTrim.body.items.find((a) => a.number === '301');
        expect(endCriado, 'Endereço com espaços localizado na lista').to.not.be.undefined;
        expect(endCriado.description, 'Apelido gravado sem espaços nas pontas (trim) já na criação').to.eq(apelidoTrimado);
        enderecoIdTeste = endCriado.id;

        // 2. Criação (POST) com apelido acima de 60 caracteres: rejeitado com 422, nenhum endereço criado
        const apelidoAcimaDoLimite = 'A'.repeat(61);
        api.criarEnderecoCliente(storeId, clientIdTeste, {
          street: `Rua Limite E2E ${Date.now()}`,
          number: '302',
          zip_code: '74000000',
          city_id: 66,
          neighborhood_id: 2692,
          description: apelidoAcimaDoLimite,
        }).then((resPostAcimaLimite) => {
          expect(resPostAcimaLimite.status, 'Status para apelido acima de 60 caracteres na criação (422)').to.eq(422);

          // 3. Edição (PATCH) do mesmo limite de 60 caracteres: mesma rejeição 422, confirmando paridade entre os dois verbos (NAME_MAX)
          api.atualizarEnderecoCliente(storeId, clientIdTeste, enderecoIdTeste, {
            description: apelidoAcimaDoLimite,
          }).then((resPatchAcimaLimite) => {
            expect(resPatchAcimaLimite.status, 'Status para apelido acima de 60 caracteres na edição (422, paridade com a criação)').to.eq(422);

            // Limpeza: remove o endereço criado no passo 1
            api.excluirEnderecoCliente(storeId, clientIdTeste, enderecoIdTeste);
          });
        });
      });
    });

    it('9.14 deve exibir e gravar RG (identity_document), órgão emissor (issuing_body) e UF em maiúscula na ficha do cliente pessoa física, preservando os demais campos em edição parcial e validando o tamanho máximo (PR #531)', () => {
      // Captura o estado original do cliente de teste para restaurar ao final (cliente reutilizado por outros testes do contexto)
      api.obterDetalheCliente(storeId, clientIdTeste).then((resOriginal) => {
        const original = {
          identity_document: resOriginal.body.identity_document,
          issuing_body: resOriginal.body.issuing_body,
          issuing_body_uf: resOriginal.body.issuing_body_uf,
        };

        // 1. Grava os três campos com a UF em minúsculo: PR #531 exige normalização para maiúscula
        api.atualizarCliente(storeId, clientIdTeste, {
          identity_document: '12.345.678-9',
          issuing_body: 'SSP',
          issuing_body_uf: 'sp',
        }).then((resPatchInicial) => {
          expect(resPatchInicial.status, 'Status gravação inicial de RG/órgão emissor/UF').to.eq(200);
          expect(resPatchInicial.body.identity_document, 'RG gravado como informado').to.eq('12.345.678-9');
          expect(resPatchInicial.body.issuing_body, 'Órgão emissor gravado como informado').to.eq('SSP');
          expect(resPatchInicial.body.issuing_body_uf, 'UF normalizada para maiúscula (sp -> SP)').to.eq('SP');

          // 2. Dirty patch: altera somente o RG e confirma que órgão emissor e UF permanecem intocados (Não-Retroatividade)
          api.atualizarCliente(storeId, clientIdTeste, {
            identity_document: '99.999.999-9',
          }).then((resPatchParcial) => {
            expect(resPatchParcial.status, 'Status edição parcial do RG').to.eq(200);
            expect(resPatchParcial.body.identity_document, 'RG atualizado pela edição parcial').to.eq('99.999.999-9');
            expect(resPatchParcial.body.issuing_body, 'Órgão emissor intocado pela edição parcial do RG').to.eq('SSP');
            expect(resPatchParcial.body.issuing_body_uf, 'UF intocada pela edição parcial do RG').to.eq('SP');

            // 3. UF acima de 2 caracteres é rejeitada com 422
            api.atualizarCliente(storeId, clientIdTeste, {
              issuing_body_uf: 'SPX',
            }).then((resUfInvalida) => {
              expect(resUfInvalida.status, 'Status para UF acima de 2 caracteres (422)').to.eq(422);

              // 4. RG acima do tamanho máximo da coluna (20 caracteres) é rejeitado com 422
              api.atualizarCliente(storeId, clientIdTeste, {
                identity_document: 'A'.repeat(21),
              }).then((resRgInvalido) => {
                expect(resRgInvalido.status, 'Status para RG acima de 20 caracteres (422)').to.eq(422);

                // Limpeza: restaura o estado original do cliente de teste
                api.atualizarCliente(storeId, clientIdTeste, original);
              });
            });
          });
        });
      });
    });

    it('9.15 deve gravar identity_document como inscrição estadual ao cadastrar cliente pessoa jurídica, reaproveitando o mesmo campo do RG da pessoa física (PR #531)', () => {
      const nomeClientePJ = `Cliente PJ Inscricao Estadual E2E ${Date.now()}`;

      // Act: Cria cliente pessoa jurídica informando identity_document como inscrição estadual (mesmo campo do RG na PF)
      api.criarCliente(storeId, {
        name: nomeClientePJ,
        person_type: 2,
        identity_document: '123456789',
      }).then((resCriacaoPJ) => {
        // Assert: 201 Created projetando a inscrição estadual no mesmo campo identity_document
        expect(resCriacaoPJ.status, 'Status criação de cliente PJ com inscrição estadual').to.eq(201);
        expect(resCriacaoPJ.body.person_type, 'Tipo de pessoa jurídica').to.eq(2);
        expect(resCriacaoPJ.body.identity_document, 'Inscrição estadual projetada em identity_document (PR #531)').to.eq('123456789');

        // Limpeza imediata: Desativa o cliente criado para preservar a base de teste
        api.alterarAtivacaoCliente(storeId, resCriacaoPJ.body.id, false);
      });
    });

    it('9.16 Deve paginar a listagem sem os campos total/total_pages, navegando por has_next/has_previous e recusando page/per_page/q fora dos limites (Issue backend#586/#588)', () => {
      // A procedure CAD_CLIENTE_CON (#588) não calcula mais o total da base inteira — o envelope de
      // paginação perdeu `total`/`total_pages` (front#520 ainda não consome essa mudança; a tela segue
      // fora do escopo desta cobertura, só a API é validada aqui).
      api.listarClientes(storeId, { type: 'all' }).then((resPagina1) => {
        expect(resPagina1.status, 'Status página 1').to.eq(200);
        const paginacao = resPagina1.body.pagination;
        expect(paginacao, 'envelope de paginação').to.include.keys('page', 'per_page', 'has_next', 'has_previous');
        expect(paginacao, 'total/total_pages não devem mais existir no envelope').to.not.have.any.keys('total', 'total_pages');
        expect(paginacao.page, 'página 1').to.eq(1);
        expect(paginacao.has_previous, 'página 1 não tem anterior').to.eq(false);

        return api.listarClientes(storeId, { type: 'all', page: 2 }).then((resPagina2) => {
          expect(resPagina2.status, 'Status página 2').to.eq(200);
          expect(resPagina2.body.pagination.page, 'página 2').to.eq(2);
          expect(resPagina2.body.pagination.has_previous, 'página 2 tem anterior').to.eq(true);

          const idsPagina1 = resPagina1.body.items.map((item) => `${item.type}-${item.id}`);
          const idsPagina2 = resPagina2.body.items.map((item) => `${item.type}-${item.id}`);
          const intersecao = idsPagina2.filter((id) => idsPagina1.includes(id));
          expect(intersecao, 'página 2 não deve repetir itens da página 1').to.have.length(0);
        });
      });

      // Limites: page acima de 200, per_page acima de 30 e q acima de 60 caracteres recusam com 422
      api.listarClientes(storeId, { type: 'all', page: 201 }).then((resPageLimite) => {
        expect(resPageLimite.status, 'Status page=201').to.eq(422);
        expect(resPageLimite.body.message, 'Mensagem de limite de page').to.match(/page.*entre 1 e 200/i);
      });

      api.listarClientes(storeId, { type: 'all', per_page: 31 }).then((resPerPageLimite) => {
        expect(resPerPageLimite.status, 'Status per_page=31').to.eq(422);
        expect(resPerPageLimite.body.message, 'Mensagem de limite de per_page').to.match(/per_page.*entre 1 e 30/i);
      });

      api.listarClientes(storeId, { type: 'all', q: 'a'.repeat(61) }).then((resQLimite) => {
        expect(resQLimite.status, 'Status q com 61 caracteres').to.eq(422);
        expect(resQLimite.body.message, 'Mensagem de limite de q').to.match(/q.*m[áa]ximo.*60/i);
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 15: SUB-FLAGS DE PERMISSÃO DO LEGADO (PR #417 - ISSUE #414)
  // ---------------------------------------------------------------------------
  context('10. Sub-flags de Permissão do Legado (PR #417 - Issue #414)', () => {

    it('10.1 Deve validar sub-flags no módulo Financeiro separando cancelamento (EXCLUIR) e visão (presença) sobre o código 345', () => {
      // Act: Consulta capabilities financeiras
      api.obterCapabilitiesFinanceiro(storeId).then((res) => {
        // Assert: 200 OK com resolução precisa das sub-flags
        expect(res.status, 'Status capabilities financeiro').to.eq(200);
        expect(res.body).to.have.property('capabilities');
        const caps = res.body.capabilities;

        // cancel_customer_financial declara sub-flag EXCLUIR sobre o código 345
        expect(caps).to.have.property('can_cancel_customer_financial');
        expect(caps.can_cancel_customer_financial, 'Cancelamento financeiro').to.be.a('boolean');

        // view_customer_financial opera por presença pura (READ não lê flag)
        expect(caps).to.have.property('can_view_customer_financial');
        expect(caps.can_view_customer_financial, 'Visualização financeira por presença').to.be.a('boolean');

        // register_client_credit opera por presença (a tela 345 não oferece TP_INCLUIR no menu)
        expect(caps).to.have.property('can_register_client_credit');
        expect(caps.can_register_client_credit, 'Registro de crédito por presença').to.be.a('boolean');
      });
    });

    it('10.2 Deve projetar capabilities de ciclo de vida da receita diferenciando finalização (GRAVAR) e cancelamento (EXCLUIR) sobre o código 307', () => {
      const prescIdTeste = 260900004;

      // Act: Consulta detalhe da receita no backend
      api.get(`/prescriptions/${prescIdTeste}`).then((res) => {
        // Assert: 200 OK com projeção correta de capabilities em nível de registro
        expect(res.status, 'Status detalhe da receita').to.eq(200);
        expect(res.body).to.have.property('capabilities');
        const caps = res.body.capabilities;

        // finalize_movement lê sub-flag GRAVAR do código 307
        expect(caps).to.have.property('can_finalize');
        expect(caps.can_finalize, 'Capacidade de finalizar').to.be.a('boolean');

        // cancel_finalization lê sub-flag EXCLUIR do código 307
        expect(caps).to.have.property('can_cancel_finalization');
        expect(caps.can_cancel_finalization, 'Capacidade de cancelar finalização').to.be.a('boolean');

        // can_update reflete edição geral do orçamento
        expect(caps).to.have.property('can_update');
        expect(caps.can_update, 'Capacidade de alteração').to.be.a('boolean');
      });
    });

    it('10.3 Deve decompor o código legado 46 em três capabilities distintas por sub-flag (GRAVAR, ALTERAR, EXCLUIR - PR #418)', () => {
      // Act: Consulta capabilities do módulo de clientes
      api.obterCapabilitiesClientes(storeId).then((res) => {
        // Assert: 200 OK confirmando as três capabilities geradas sobre a mesma permissão 46
        expect(res.status, 'Status capabilities clientes').to.eq(200);
        expect(res.body).to.have.property('capabilities');
        const caps = res.body.capabilities;

        // can_create_client lê sub-flag GRAVAR
        expect(caps).to.have.property('can_create_client');
        expect(caps.can_create_client, 'Criação de cliente (GRAVAR)').to.be.a('boolean');

        // can_update_client lê sub-flag ALTERAR
        expect(caps).to.have.property('can_update_client');
        expect(caps.can_update_client, 'Atualização de cliente (ALTERAR)').to.be.a('boolean');

        // can_deactivate_client lê sub-flag EXCLUIR
        expect(caps).to.have.property('can_deactivate_client');
        expect(caps.can_deactivate_client, 'Desativação de cliente (EXCLUIR)').to.be.a('boolean');
      });
    });

    it('10.4 Deve preservar concessão por presença pura para definições transversais sem sub-flag declarada (CA-03)', () => {
      // 1. Atendimentos: Permissão 418 (can_access_attendance_module) não declara subFlag
      api.obterCapabilitiesLoja(storeId).then((resAtt) => {
        expect(resAtt.status, 'Status capabilities atendimento').to.eq(200);
        expect(resAtt.body.capabilities.can_access_attendance_module, 'Presença pura sem sub-flag no 418').to.eq(true);
      });

      // 2. Receitas: Permissão 231 (can_access_manipulation_processes) não declara subFlag
      api.obterCapabilitiesReceitas(storeId).then((resPresc) => {
        expect(resPresc.status, 'Status capabilities receitas').to.eq(200);
        expect(resPresc.body.capabilities.can_access_manipulation_processes, 'Presença pura sem sub-flag no 231').to.eq(true);
      });
    });

    it('10.5 Deve garantir consistência e estabilidade na resolução de permissões em cache (RequestPermissionCache - CA-05)', () => {
      // Act: Dispara consultas consecutivas de capabilities para aferir o cache de requisição
      api.obterCapabilitiesClientes(storeId).then((res1) => {
        expect(res1.status, 'Primeira consulta de capabilities').to.eq(200);
        const caps1 = res1.body.capabilities;

        api.obterCapabilitiesClientes(storeId).then((res2) => {
          expect(res2.status, 'Segunda consulta de capabilities').to.eq(200);
          const caps2 = res2.body.capabilities;

          // Assert: Integridade idêntica entre consultas subsequentes
          expect(caps2.can_create_client).to.eq(caps1.can_create_client);
          expect(caps2.can_update_client).to.eq(caps1.can_update_client);
          expect(caps2.can_deactivate_client).to.eq(caps1.can_deactivate_client);
        });
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 17: TRATAMENTO DE ERROS E OBSERVABILIDADE DE LINK DE PAGAMENTO (PR #445)
  // ---------------------------------------------------------------------------
  context('11. Tratamento de Erros e Observabilidade de Link de Pagamento (PR #445)', () => {

    const attendanceIdComOrcamento = 260800149; // Atendimento com orçamento elegível marcado (260800195)
    const attendanceIdSemOrcamento = 260900027; // Atendimento sem orçamentos marcados
    const configPixInterId = 6;                 // Operadora PIX-Banco Inter (online_payment_type: 5)
    const configCieloId = 3;                    // Operadora Cielo (online_payment_type: 1)

    it('11.1 Deve listar as configurações de pagamento ativas da loja (/payment-configs)', () => {
      // Act: Consulta as configurações ativas
      api.obterConfiguracoesPagamento(storeId).then((res) => {
        // Assert: 200 OK com array items populado
        expect(res.status, 'Status da listagem de payment-configs').to.eq(200);
        expect(res.body).to.have.property('items');
        expect(res.body.items).to.be.an('array').and.have.length.at.least(3);

        // Valida a presença e contrato das operadoras mapeadas (Cielo id 3, PIX id 6, Pixpixpix id 12)
        const cielo = res.body.items.find((item) => item.id === configCieloId);
        expect(cielo, 'Config Cielo (id 3) presente').to.not.be.undefined;
        expect(cielo.online_payment_type).to.eq(1);

        const pix = res.body.items.find((item) => item.id === configPixInterId);
        expect(pix, 'Config PIX-Banco Inter (id 6) presente').to.not.be.undefined;
        expect(pix.online_payment_type).to.eq(5);

        // Valida schema obrigatório de cada item
        res.body.items.forEach((item) => {
          expect(item).to.have.property('id').and.be.a('number');
          expect(item).to.have.property('description').and.be.a('string');
          expect(item).to.have.property('installment_min_amount').and.be.a('number');
          expect(item).to.have.property('installment_max_count').and.be.a('number');
          expect(item).to.have.property('online_payment_type').and.be.a('number');
        });
      });
    });

    // Correção 2026-10-05 (Issue backend#332, PR #514): a chave do contrato é a PRESENÇA do
    // `code`, nunca o status — PROVIDER_REFUSED é recusa determinística (nada foi criado) tanto em
    // 422 (motivo específico do provedor) quanto em 502 (frase fixa genérica, sem motivo). As 3
    // reproduções de 502 em 2026-09-25/26 que motivaram o .skip eram esse 2º ramo válido, não
    // instabilidade do provedor — o teste antigo só sabia aceitar 422.
    it('11.2 Deve classificar recusa determinística de negócio do provedor com PROVIDER_REFUSED, em 422 (motivo específico) ou 502 (frase genérica) (PR #445, Issue backend#332/PR #514)', () => {
      // Act: Tenta gerar link de pagamento com a config PIX no atendimento com orçamento
      api.gerarLinkPagamento(storeId, attendanceIdComOrcamento, {
        payment_config_id: configPixInterId,
        installments: 1,
      }).then((res) => {
        // Assert: recusa determinística do provedor — a chave é o code, não o status
        expect([422, 502], 'Status de recusa determinística do provedor').to.include(res.status);
        expect(res.body.code, 'Código canônico de recusa determinística').to.eq('PROVIDER_REFUSED');

        if (res.status === 422) {
          expect(res.body.message, 'Mensagem com prefixo explicativo em português').to.include('O provedor de pagamento recusou:');
          expect(res.body.message, 'Detalhe de erro repassado do provedor').to.include('incomplete PIX ACBr payload');
        } else {
          // 502 com code PROVIDER_REFUSED: frase fixa genérica, sem o motivo específico do provedor
          expect(res.body.message, 'Mensagem genérica de falha ao gerar link').to.eq('Falha ao gerar link de pagamento');
        }

        // Confirma que nenhum link foi registrado no atendimento (geração de link é mutável;
        // uma recusa determinística não pode deixar artefato gravado, em nenhum dos dois status)
        api.listarLinksPagamentoAtendimento(storeId, attendanceIdComOrcamento).then((resLinks) => {
          expect(resLinks.status, 'Status da listagem de links').to.eq(200);
          expect(resLinks.body.items, 'Nenhum link gerado no atendimento').to.be.an('array').and.have.length(0);
        });
      });
    });

    // Correção 2026-10-05 (Issue backend#332, PR #514): a premissa antiga ("502 nunca vem com
    // PROVIDER_REFUSED") estava errada — ver 11.2. O que realmente distingue resultado incerto é a
    // AUSÊNCIA de `code` no corpo, não o status 502 em si.
    it('11.3 Deve tratar falha upstream ou indisponibilidade de gateway como 502 Bad Gateway sem code, resultado indeterminado (Issue backend#332/PR #514)', () => {
      // Act: Dispara envio com operadora Cielo (indisponibilidade upstream / 502 de transporte)
      api.gerarLinkPagamento(storeId, attendanceIdComOrcamento, {
        payment_config_id: configCieloId,
        installments: 1,
      }).then((res) => {
        // Assert: 502 Bad Gateway
        expect(res.status, 'Status de falha upstream').to.eq(502);

        // Proteção de envio incerto: a chave é a AUSÊNCIA de `code` (não o status) — 502 com
        // code: PROVIDER_REFUSED é recusa determinística válida (ver 11.2); aqui é falha pura de
        // transporte/indisponibilidade, sem o backend saber decidir, logo sem code algum,
        // garantindo que o front trate como incerto (evitando retentativas que duplicam cobranças)
        if (res.body && typeof res.body === 'object') {
          expect(res.body, 'Nenhum code no corpo — resultado indeterminado, não recusa decidida').to.not.have.property('code');
        }

        // Confirma que nenhum link foi registrado no atendimento
        api.listarLinksPagamentoAtendimento(storeId, attendanceIdComOrcamento).then((resLinks) => {
          expect(resLinks.status, 'Status da listagem de links').to.eq(200);
          expect(resLinks.body.items, 'Nenhum link gerado no atendimento').to.be.an('array').and.have.length(0);
        });
      });
    });

    it('11.4 Deve validar regra de negócio e bloquear geração de link para atendimento sem orçamento elegível marcado (422)', () => {
      // Act: Tenta gerar link de pagamento para atendimento sem orçamento pendente selecionado
      api.gerarLinkPagamento(storeId, attendanceIdSemOrcamento, {
        payment_config_id: configPixInterId,
        installments: 1,
      }).then((res) => {
        // Assert: 422 Unprocessable Content por validação de negócio (requireEligibleBudgets)
        expect(res.status, 'Status de bloqueio de negócio').to.eq(422);
        expect(res.body.message, 'Mensagem de ausência de orçamento marcado').to.eq('Nenhum orçamento pendente marcado para link de pagamento.');
      });
    });

    it('11.5 Deve rejeitar requisição com payload malformado ou ausente com 400 Bad Request', () => {
      // Act: Envia body vazio {} sem os campos obrigatórios
      api.gerarLinkPagamento(storeId, attendanceIdComOrcamento, {}).then((res) => {
        // Assert: 400 Bad Request
        expect(res.status, 'Status de payload malformado').to.eq(400);
        expect(res.body.error, 'Erro de bad request').to.eq('Bad Request');
        expect(res.body.message, 'Mensagem de validação de schema').to.include('Malformed request body');
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 18: REMOÇÃO DE LINK POR FINANCEIRO E INVARIANTE HASROUTE = FALSE (PR #451)
  // ---------------------------------------------------------------------------
  context('12. Remoção de Link por Financeiro e Invariante hasRoute = false (PR #451)', () => {

    const financialIdTeste = 240501334;
    const attendanceIdTeste = 260800149;

    it('12.1 Deve confirmar que a rota legada POST /financials/:id/payment-link foi removida (404 Not Found - PR #451)', () => {
      // Act: Tenta disparar a geração de link pela rota financeira extinta
      api.gerarLinkPagamentoFinanceiro(storeId, financialIdTeste, {
        payment_config_id: 6,
        installments: 1,
      }).then((res) => {
        // Assert: 404 Not Found confirmando remoção completa dos 12 arquivos do backend
        expect(res.status, 'Status da rota removida').to.eq(404);
        expect(res.body.error, 'Erro retornado').to.eq('Not Found');
        expect(res.body.message, 'Mensagem de recurso inexistente').to.eq('Resource not found');
      });
    });

    it('12.2 Deve validar que a capability can_generate_payment_link responde estritamente false por invariante hasRoute = false', () => {
      // Act: Consulta capabilities do módulo Financeiro
      api.obterCapabilitiesFinanceiro(storeId).then((res) => {
        // Assert: Responde 200 OK com can_generate_payment_link fixado em false
        expect(res.status, 'Status de capabilities financeiras').to.eq(200);
        expect(res.body).to.have.property('capabilities');
        expect(res.body.capabilities.can_generate_payment_link, 'hasRoute = false desativa o botão').to.eq(false);
        expect(res.body.capabilities.can_view_financial_attachments, 'hasRoute = false para anexos').to.eq(false);
      });
    });

    it('12.3 Deve assegurar que o grant 597 permanece ativo e aplicado no catálogo de atendimento (can_send_payment_link)', () => {
      // Act: Consulta capabilities do atendimento onde o link legitimamente nasce
      api.obterCapabilitiesAtendimento(storeId, attendanceIdTeste).then((res) => {
        // Assert: can_send_payment_link permanece true na rota do checkout por movimento
        expect(res.status, 'Status de capabilities do atendimento').to.eq(200);
        expect(res.body).to.have.property('capabilities');
        expect(res.body.capabilities.can_send_payment_link, 'Grant 597 ativo no atendimento').to.eq(true);
      });
    });

    it('12.4 Deve confirmar que não existem rotas fantasmas de leitura de links no domínio financeiro (GET /financials/:id/payment-link -> 404)', () => {
      // Act: Tenta consultar links diretamente na rota financeira inexistente
      api.consultarLinksPagamentoFinanceiro(storeId, financialIdTeste).then((res) => {
        // Assert: 404 Not Found
        expect(res.status, 'Status de rota inexistente').to.eq(404);
        expect(res.body.error, 'Erro retornado').to.eq('Not Found');
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 19: ELEGIBILIDADE DE ORÇAMENTOS E BLOQUEIO DE COBRANÇA DUPLA (PR #449)
  // ---------------------------------------------------------------------------
  context('13. Elegibilidade de Orçamentos e Bloqueio de Cobrança Dupla (PR #449)', () => {

    // Massa residual compartilhada com os contexts 14 e 16 - fonte única em
    // cypress/fixtures/0.backend/massaResidualOrcamentos.js (AGENTS.md secao 0)
    const attendanceIdElegivel = massaResidualOrcamentos.ATENDIMENTO_ELEGIVEL;
    const budgetCodeElegivel = massaResidualOrcamentos.ORCAMENTO_ELEGIVEL;
    const attendanceIdCoberto = massaResidualOrcamentos.ATENDIMENTO_COBERTO_POR_LINK_APROVADO;
    const budgetCodeCoberto = massaResidualOrcamentos.ORCAMENTO_COBERTO_POR_LINK_APROVADO;

    // O #13.4 desmarca e remarca o orçamento elegível: a marcação original é restaurada no fim do context
    let selecaoOriginalElegivel = null;
    before(() => {
      api.listarOrcamentosAtendimento(storeId, attendanceIdElegivel).then((res) => {
        const o = ((res.body && res.body.data) || []).find((b) => b.code === budgetCodeElegivel);
        selecaoOriginalElegivel = o ? o.selected_for_payment_link : null;
      });
    });
    after(() => {
      if (selecaoOriginalElegivel !== null) api.atualizarSelecaoOrcamento(storeId, attendanceIdElegivel, budgetCodeElegivel, selecaoOriginalElegivel);
    });

    it('13.1 Deve projetar a flag covered_by_approved_link em cada item de orçamento (/attendances/:id/budgets - PR #449)', function () {
      exigirMassaOrcamento(this, attendanceIdElegivel, budgetCodeElegivel, 'elegivel');
      // Act: Consulta orçamentos do atendimento
      api.listarOrcamentosAtendimento(storeId, attendanceIdElegivel).then((res) => {
        // Assert: 200 OK com array data estruturado
        expect(res.status, 'Status da listagem de orçamentos').to.eq(200);
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.be.an('array').and.have.length.at.least(1);

        // Valida presença e tipagem estrita de covered_by_approved_link e financial_id em cada orçamento (PR #449 e #426)
        res.body.data.forEach((budget) => {
          expect(budget).to.have.property('code').and.be.a('number');
          expect(budget).to.have.property('status').and.be.a('number');
          expect(budget).to.have.property('amount').and.be.a('number');
          expect(budget).to.have.property('selected_for_payment_link').and.be.a('boolean');
          expect(budget).to.have.property('covered_by_approved_link').and.be.a('boolean');
          expect(budget).to.have.property('financial_id');
          expect(budget.financial_id === null || typeof budget.financial_id === 'number', 'financial_id deve ser null ou number').to.be.true;
        });

        // No atendimento elegível, o orçamento não está coberto por link aprovado
        const budget = res.body.data.find((b) => b.code === budgetCodeElegivel);
        expect(budget, 'Orçamento elegível localizado').to.not.be.undefined;
        expect(budget.covered_by_approved_link, 'Orçamento não coberto').to.eq(false);
        expect(budget.financial_id, 'Orçamento elegível sem vínculo financeiro').to.be.null;
      });
    });

    it('13.2 Deve projetar financial_id distinguindo orçamentos já vendidos de pendentes (/attendances/:id/budgets - PR #426)', function () {
      exigirMassaOrcamento(this, massaResidualOrcamentos.ATENDIMENTO_VENDIDO, massaResidualOrcamentos.ORCAMENTO_VENDIDO, 'vendido');
      exigirMassaOrcamento(this, massaResidualOrcamentos.ATENDIMENTO_VENDIDO, massaResidualOrcamentos.ORCAMENTO_PENDENTE_DO_VENDIDO, 'elegivel');
      const attendanceIdPar = massaResidualOrcamentos.ATENDIMENTO_VENDIDO;

      // Act: Consulta orçamentos do atendimento (contém par exato: 1 vendido e 1 pendente)
      api.listarOrcamentosAtendimento(storeId, attendanceIdPar).then((res) => {
        expect(res.status, 'Status da listagem de orçamentos').to.eq(200);
        expect(res.body.data).to.be.an('array').and.have.length.at.least(2);

        // 1. Orçamento já virou venda (financial_id preenchido). Não afirma covered_by_approved_link
        // aqui: não é parte do contrato de projeção que este teste nomeia (financial_id), é um
        // valor incidental do registro residual específico usado — fica sujeito ao mesmo drift por
        // edição manual no Desktop que já afetou outros orçamentos residuais (ROADMAP.md P1). A
        // regra de precedência "Vendido bloqueia independente de covered_by_approved_link" já é
        // coberta 100% mockada em `5-B1.atendimentos-chat-componentes.cy.js` #1.26 (achado 2026-10-05).
        const budgetVendido = res.body.data.find((b) => b.code === massaResidualOrcamentos.ORCAMENTO_VENDIDO);
        expect(budgetVendido, 'Orçamento vendido localizado').to.not.be.undefined;
        expect(budgetVendido.financial_id, 'financial_id preenchido com código da venda').to.eq(massaResidualOrcamentos.FINANCEIRO_DO_VENDIDO);

        // 2. Orçamento pendente do mesmo atendimento: em aberto (financial_id null)
        const budgetPendente = res.body.data.find((b) => b.code === massaResidualOrcamentos.ORCAMENTO_PENDENTE_DO_VENDIDO);
        expect(budgetPendente, 'Orçamento pendente localizado').to.not.be.undefined;
        expect(budgetPendente.financial_id, 'financial_id nulo para orçamento em aberto').to.be.null;
        expect(budgetPendente.covered_by_approved_link, 'covered_by_approved_link false').to.eq(false);
      });
    });

    it('13.3 Deve bloquear tentativa de marcar orçamento já pago por link aprovado respondendo 422 (PR #449)', function () {
      exigirMassaOrcamento(this, attendanceIdCoberto, budgetCodeCoberto, 'coberto');
      // Act: Tenta marcar para cobrança online um orçamento coberto por link aprovado
      api.atualizarSelecaoOrcamento(storeId, attendanceIdCoberto, budgetCodeCoberto, true).then((res) => {
        // Assert: 422 Unprocessable Content protegendo contra cobrança dupla
        expect(res.status, 'Status de bloqueio de marcação').to.eq(422);
        expect(res.body.error, 'Erro de negócio').to.eq('Unprocessable Content');
        expect(res.body.message, 'Mensagem de orçamento já pago em link aprovado')
          .to.include('já foi pago em um link aprovado e não pode ser marcado');
      });
    });

    it('13.4 Deve permitir desmarcar e remarcar livremente orçamento aberto e não coberto (200 OK)', function () {
      exigirMassaOrcamento(this, attendanceIdElegivel, budgetCodeElegivel, 'elegivel');
      // 1. Desmarcar orçamento elegível (selected_for_payment_link: false)
      api.atualizarSelecaoOrcamento(storeId, attendanceIdElegivel, budgetCodeElegivel, false).then((resUnselect) => {
        expect(resUnselect.status, 'Status de desmarcação livre').to.eq(200);
        expect(resUnselect.body.selected_for_payment_link, 'Orçamento desmarcado').to.eq(false);

        // 2. Remarcar orçamento elegível (selected_for_payment_link: true)
        api.atualizarSelecaoOrcamento(storeId, attendanceIdElegivel, budgetCodeElegivel, true).then((resSelect) => {
          expect(resSelect.status, 'Status de remarcação').to.eq(200);
          expect(resSelect.body.selected_for_payment_link, 'Orçamento remarcado').to.eq(true);
        });
      });
    });

    it('13.5 Deve excluir orçamentos cobertos por link aprovado da elegibilidade de envio (422 requireEligibleBudgets)', function () {
      exigirMassaOrcamento(this, attendanceIdCoberto, budgetCodeCoberto, 'coberto');
      // Act: Tenta gerar link de pagamento no atendimento cujos orçamentos estão cobertos por link aprovado
      api.gerarLinkPagamento(storeId, attendanceIdCoberto, {
        payment_config_id: 6,
        installments: 1,
      }).then((res) => {
        // Assert: 422 Unprocessable Content impedindo envio ao provedor (elimina cobrança dupla)
        expect(res.status, 'Status de bloqueio de envio').to.eq(422);
        expect(res.body.message, 'Mensagem de ausência de orçamentos elegíveis')
          .to.eq('Nenhum orçamento pendente marcado para link de pagamento.');
      });
    });

    it('13.6 Deve exigir autenticação obrigatória (401 Unauthorized) na consulta e atualização de orçamentos', () => {
      // 1. Consulta sem token
      api.listarOrcamentosAtendimento(storeId, attendanceIdElegivel, { headers: { Authorization: '' } }).then((resList) => {
        expect(resList.status, 'Status sem token na listagem').to.eq(401);
        expect(resList.body.error, 'Erro de autenticação').to.eq('Unauthorized');
      });

      // 2. Mutação sem token
      api.atualizarSelecaoOrcamento(storeId, attendanceIdElegivel, budgetCodeElegivel, false, { headers: { Authorization: '' } }).then((resPatch) => {
        expect(resPatch.status, 'Status sem token no patch').to.eq(401);
        expect(resPatch.body.error, 'Erro de autenticação').to.eq('Unauthorized');
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 23: CONTRATO DE ORÇAMENTOS E CÓDIGOS ESTÁVEIS DE RECUSA (PR #474)
  // ---------------------------------------------------------------------------
  context('14. Contrato de Orçamentos e Códigos Estáveis de Recusa (PR #474)', () => {

    // Massa residual compartilhada com os contexts 13 e 16 - fonte única em
    // cypress/fixtures/0.backend/massaResidualOrcamentos.js (AGENTS.md secao 0)
    const attendanceIdElegivel = massaResidualOrcamentos.ATENDIMENTO_ELEGIVEL;
    const budgetCodeElegivel = massaResidualOrcamentos.ORCAMENTO_ELEGIVEL;
    const attendanceIdCoberto = massaResidualOrcamentos.ATENDIMENTO_COBERTO_POR_LINK_APROVADO;
    const budgetCodeCoberto = massaResidualOrcamentos.ORCAMENTO_COBERTO_POR_LINK_APROVADO;
    const attendanceIdVendido = massaResidualOrcamentos.ATENDIMENTO_VENDIDO;
    const budgetCodeVendido = massaResidualOrcamentos.ORCAMENTO_VENDIDO;

    // O #14.2 marca o orçamento elegível: a marcação original é restaurada no fim do context
    let selecaoOriginalElegivel = null;
    before(() => {
      api.listarOrcamentosAtendimento(storeId, attendanceIdElegivel).then((res) => {
        const o = ((res.body && res.body.data) || []).find((b) => b.code === budgetCodeElegivel);
        selecaoOriginalElegivel = o ? o.selected_for_payment_link : null;
      });
    });
    after(() => {
      if (selecaoOriginalElegivel !== null) api.atualizarSelecaoOrcamento(storeId, attendanceIdElegivel, budgetCodeElegivel, selecaoOriginalElegivel);
    });

    it('14.1 deve garantir a projeção do campo status (Int não-nulo) em todas as linhas da listagem de orçamentos (/budgets)', function () {
      exigirMassaOrcamento(this, attendanceIdElegivel, budgetCodeElegivel, 'elegivel');
      // Act: Consulta a listagem de orçamentos do atendimento
      api.listarOrcamentosAtendimento(storeId, attendanceIdElegivel).then((res) => {
        // Assert: 200 OK e validação estrutural do campo status
        expect(res.status, 'Status da listagem de orçamentos').to.eq(200);
        expect(res.body.data, 'Array de orçamentos').to.be.an('array').and.have.length.at.least(1);

        res.body.data.forEach((budget) => {
          // Garantia contratual PR #474 / omnicare-front#334:
          // status é Int não-nulo em todas as linhas para suportar fail-closed na UI
          expect(budget).to.have.property('status');
          expect(budget.status, `Campo status do orçamento #${budget.code} não pode ser nulo`).to.not.be.null;
          expect(budget.status, `Campo status do orçamento #${budget.code} deve ser number`).to.be.a('number');
          expect(Number.isInteger(budget.status), `Campo status do orçamento #${budget.code} deve ser inteiro`).to.be.true;
        });
      });
    });

    it('14.2 deve garantir a projeção do campo status (Int não-nulo) no retorno da mutação de seleção (PATCH /budgets/:code)', function () {
      exigirMassaOrcamento(this, attendanceIdElegivel, budgetCodeElegivel, 'elegivel');
      // Act: Atualiza a seleção do orçamento elegível
      api.atualizarSelecaoOrcamento(storeId, attendanceIdElegivel, budgetCodeElegivel, true).then((res) => {
        // Assert: 200 OK e integridade do modelo BudgetItem devolvido pelo PATCH
        expect(res.status, 'Status da mutação de seleção').to.eq(200);
        expect(res.body, 'Payload retornado pelo PATCH').to.be.an('object');
        expect(res.body).to.have.property('status');
        expect(res.body.status, 'Campo status do retorno do PATCH não pode ser nulo').to.not.be.null;
        expect(res.body.status, 'Campo status do retorno do PATCH deve ser number').to.be.a('number');
        expect(Number.isInteger(res.body.status), 'Campo status do retorno do PATCH deve ser inteiro').to.be.true;
        expect(res.body.selected_for_payment_link, 'Flag selected_for_payment_link').to.eq(true);
      });
    });

    it('14.3 deve recusar marcação de orçamento já coberto por link aprovado com erro 422 e código BUDGET_COVERED_BY_APPROVED_LINK', function () {
      exigirMassaOrcamento(this, attendanceIdCoberto, budgetCodeCoberto, 'coberto');
      // Act: Tenta marcar para link de pagamento orçamento já coberto por link aprovado
      api.atualizarSelecaoOrcamento(storeId, attendanceIdCoberto, budgetCodeCoberto, true).then((res) => {
        // Assert: 422 Unprocessable Content com código estável discriminador
        expect(res.status, 'Status de recusa de marcação').to.eq(422);
        expect(res.body.error, 'Tipo do erro').to.eq('Unprocessable Content');
        expect(res.body.code, 'Código de negócio estável').to.eq('BUDGET_COVERED_BY_APPROVED_LINK');
        expect(res.body.message, 'Mensagem explicativa').to.include('já foi pago em um link aprovado e não pode ser marcado');
      });
    });

    it('14.4 deve recusar marcação de orçamento que já virou venda com erro 422 e código BUDGET_ALREADY_SOLD', function () {
      exigirMassaOrcamento(this, attendanceIdVendido, budgetCodeVendido, 'vendido');
      // Act: Tenta marcar para link de pagamento orçamento já vendido (financial_id preenchido)
      api.atualizarSelecaoOrcamento(storeId, attendanceIdVendido, budgetCodeVendido, true).then((res) => {
        // Assert: 422 Unprocessable Content com código estável discriminador
        expect(res.status, 'Status de recusa de marcação').to.eq(422);
        expect(res.body.error, 'Tipo do erro').to.eq('Unprocessable Content');
        expect(res.body.code, 'Código de negócio estável').to.eq('BUDGET_ALREADY_SOLD');
        expect(res.body.message, 'Mensagem explicativa').to.include('já virou venda e não pode ser marcado');
      });
    });

    it('14.5 deve validar a recusa de marcação de orçamento fora do aberto assegurando que movimentos concluídos ou vendidos não são cobráveis (PR #474)', function () {
      exigirMassaOrcamento(this, attendanceIdVendido, budgetCodeVendido, 'vendido');
      // Act: Consulta orçamentos do atendimento com venda e confirma status_mov != 0
      api.listarOrcamentosAtendimento(storeId, attendanceIdVendido).then((resList) => {
        expect(resList.status).to.eq(200);
        const budgetNaoAberto = resList.body.data.find(b => b.code === budgetCodeVendido);
        expect(budgetNaoAberto, 'Orçamento não-aberto localizado').to.be.ok;
        expect(budgetNaoAberto.status, 'Status não pode ser 0 (em aberto)').to.not.eq(0);

        // Submete mutação de seleção e valida recusa estrita da família de bloqueios de cobrança
        api.atualizarSelecaoOrcamento(storeId, attendanceIdVendido, budgetCodeVendido, true).then((resPatch) => {
          expect(resPatch.status, 'Deve recusar orçamento fora do estado aberto').to.eq(422);
          expect(resPatch.body.code, 'Código de erro deve pertencer à família de recusa de cobrança')
            .to.be.oneOf(['BUDGET_ALREADY_SOLD', 'BUDGET_NOT_OPEN', 'BUDGET_COVERED_BY_APPROVED_LINK']);
        });
      });
    });

    // O backend olha o valor do orçamento INTEIRO (VALORVENDA_DESC), e a lista `GET .../budgets` traz um card por fórmula: medido em 2026-11-06 (aba-b), o orçamento
    // 261100407 tinha dois cards com 0 e um com 55, e a marcação passou (200). Por isso o orçamento sem valor é descoberto somando os cards do mesmo código ([R-ATEMPORAL]).
    let orcamentoSemValor = null;
    it('14.6 deve recusar com 422 BUDGET_ZERO_AMOUNT a marcação de um orçamento aberto e sem valor, sem gravar a marcação (Issue front#408, backend PR #514 e sucessoras)', function () {
      // Arrange: varre os atendimentos da loja até achar um orçamento aberto cujo valor somado (todos os cards do código) é zero
      const fila = [];
      cy.wrap(['in_progress', 'pending', 'finished']).each((status) => api.listarAtendimentos(storeId, { status, page: 1, per_page: 100 }).then((res) => {
        (res.body.items || []).forEach((att) => fila.push(att.id));
      }));
      const varrer = (i) => cy.then(() => {
        if (orcamentoSemValor || i >= fila.length) return;
        return api.listarOrcamentosAtendimento(storeId, fila[i]).then((res) => {
          const porCodigo = {};
          ((res.body && res.body.data) || []).forEach((o) => { (porCodigo[o.code] = porCodigo[o.code] || []).push(o); });
          const achado = Object.entries(porCodigo).find(([, cards]) => cards.every((c) => c.status === 0 && !c.financial_id && !c.sold && !c.covered_by_approved_link)
            && cards.reduce((soma, c) => soma + Number(c.amount_with_discount || 0), 0) === 0);
          if (achado) orcamentoSemValor = { atendimento: fila[i], code: Number(achado[0]), selecionado: achado[1][0].selected_for_payment_link };
        }).then(() => varrer(i + 1));
      });
      varrer(0);
      cy.then(() => {
        if (!orcamentoSemValor) {
          cy.log('⏭️ Sem massa: nenhum orçamento aberto e sem valor nos atendimentos da loja');
          this.skip();
        }
      });

      // Act
      cy.then(() => api.atualizarSelecaoOrcamento(storeId, orcamentoSemValor.atendimento, orcamentoSemValor.code, true, { failOnStatusCode: false })).then((res) => {
        // Se a recusa não vier, a marcação gravou: o after deste teste a desfaz antes de falhar
        if (res.status === 200) orcamentoSemValor.gravou = true;
        expect(res.status, `PATCH do orçamento ${orcamentoSemValor.code} sem valor`).to.eq(422);
        expect(res.body.code, 'Código estável da recusa').to.eq('BUDGET_ZERO_AMOUNT');
        expect(res.body.message, 'Mensagem da recusa').to.be.a('string').and.not.to.be.empty;
      });

      // Assert: a marcação continua a de antes
      cy.then(() => api.listarOrcamentosAtendimento(storeId, orcamentoSemValor.atendimento)).then((res) => {
        const cards = ((res.body && res.body.data) || []).filter((o) => o.code === orcamentoSemValor.code);
        cards.forEach((c) => expect(c.selected_for_payment_link, 'A recusa não gravou a marcação').to.eq(orcamentoSemValor.selecionado));
      });
    });

    after(() => {
      if (orcamentoSemValor && orcamentoSemValor.gravou) api.atualizarSelecaoOrcamento(storeId, orcamentoSemValor.atendimento, orcamentoSemValor.code, orcamentoSemValor.selecionado);
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 25: PADRONIZAÇÃO GLOBAL DE TIMESTAMPS EM INSTANT (PR 3 - #341)
  // ---------------------------------------------------------------------------
  context('15. Padronização Global de Timestamps em Instant (PR 3 - #341)', () => {

    const attendanceIdTeste = 260800149;
    let clienteTesteId = 867092;
    let clienteTesteNome = 'KLISMAM MONTEIRO';

    before(() => {
      // Localiza cliente padrão para associar à prescrição
      api.buscarClientes(storeId, configEnv.DEFAULT_CLIENT_NAME || 'klismam').then((resCli) => {
        const cliente = resCli.body?.items?.[0] || resCli.body?.[0];
        if (cliente?.id) clienteTesteId = cliente.id;
        if (cliente?.name) clienteTesteNome = cliente.name;
      });
    });

    it('15.1 deve eliminar a assimetria e emitir reference_at com sufixo Z tanto no detalhe quanto na listagem de atendimentos', () => {
      // 1. Act: Consulta detalhe do atendimento (/attendances/:id)
      api.obterDetalheAtendimento(storeId, attendanceIdTeste).then((resDet) => {
        expect(resDet.status, 'Status do detalhe do atendimento').to.eq(200);
        const attendance = resDet.body.attendance || resDet.body;

        // Assert: reference_at no detalhe DEVE terminar com 'Z' e NUNCA com '-03:00'
        expect(attendance).to.have.property('reference_at');
        expect(attendance.reference_at, 'reference_at do detalhe deve ser Instant (Z)').to.match(/Z$/);
        expect(attendance.reference_at, 'reference_at do detalhe não deve conter offset -03:00').to.not.include('-03:00');

        // Valida last_customer_message_at caso presente
        if (attendance.last_customer_message_at) {
          expect(attendance.last_customer_message_at, 'last_customer_message_at do detalhe deve ser Instant (Z)').to.match(/Z$/);
          expect(attendance.last_customer_message_at).to.not.include('-03:00');
        }

        // 2. Act: Consulta listagem de atendimentos na fila para comparar simetria
        const dataHoje = new Date().toISOString().slice(0, 10);
        api.listarAtendimentos(storeId, { start_date: '2026-08-01', end_date: dataHoje, limit: 10 }).then((resList) => {
          expect(resList.status, 'Status da listagem de atendimentos').to.eq(200);
          const items = resList.body.items || [];
          if (items.length > 0) {
            const primeiro = items[0];
            expect(primeiro.reference_at, 'reference_at da listagem deve ser Instant (Z)').to.match(/Z$/);
            expect(primeiro.reference_at).to.not.include('-03:00');
          } else {
            // Janela sem atendimentos no tenant medido: valida ao menos o envelope de paginação
            expect(resList.body, 'Envelope da listagem deve existir mesmo sem itens na janela').to.have.property('items');
            cy.log('ℹ️ [Simetria de timestamps]: janela 2026-08-01..hoje sem atendimentos no tenant — comparação de reference_at da listagem não exercitada.');
          }
        });
      });
    });

    it('15.2 deve emitir timestamp em formato Instant (Z) nas mensagens do chat (/attendances/:id/messages)', () => {
      // Act: Consulta mensagens vinculadas ao atendimento
      api.listarMensagensAtendimento(storeId, attendanceIdTeste).then((res) => {
        expect(res.status, 'Status da listagem de mensagens').to.eq(200);
        const messages = res.body.data || res.body.items || (Array.isArray(res.body) ? res.body : []);
        expect(messages.length, 'Atendimento deve conter mensagens').to.be.gte(1);

        // Assert: created_at deve terminar com Z (AttendanceMessageTimestampSerializer migrado para Instant)
        messages.slice(0, 5).forEach((msg) => {
          expect(msg).to.have.property('created_at');
          expect(msg.created_at, `Mensagem #${msg.id} created_at deve terminar com Z`).to.match(/Z$/);
          expect(msg.created_at, `Mensagem #${msg.id} não deve ter offset -03:00`).to.not.include('-03:00');
        });
      });
    });

    it('15.3 deve emitir timestamps em formato Instant (Z) em pedidos de autorização (/authorization-requests)', () => {
      // Act: Consulta pedidos de autorização da loja
      api.listarAutorizacoes(storeId, { role: 'requester', limit: 5 }).then((res) => {
        expect(res.status, 'Status da consulta de autorizações').to.eq(200);
        const items = res.body.items || [];

        if (items.length > 0) {
          items.forEach((auth) => {
            if (auth.requested_at) {
              expect(auth.requested_at, `Autorização #${auth.id} requested_at deve ser Instant (Z)`).to.match(/Z$/);
              expect(auth.requested_at).to.not.include('-03:00');
            }
            if (auth.expires_at) {
              expect(auth.expires_at, `Autorização #${auth.id} expires_at deve ser Instant (Z)`).to.match(/Z$/);
              expect(auth.expires_at).to.not.include('-03:00');
            }
          });
        } else {
          // Garante que o schema respondeu corretamente mesmo sem itens abertos no momento
          expect(res.body).to.have.property('pagination');
        }
      });
    });

    it('15.4 deve projetar registered_at em formato Instant (Z) na listagem de prescrições da loja (/prescriptions)', () => {
      // Arrange: Cria prescrição no dia de hoje para garantir presença na listagem
      api.criarPrescricao(storeId, {
        prescription_type: 'human',
        status: 0,
        sale_type: 1,
        patient_id: clienteTesteId,
        patient_name: clienteTesteNome,
        buyer_id: clienteTesteId,
        buyer_name: clienteTesteNome,
        prescriber_id: 18780,
        pickup_store_id: storeId,
      }).then((resCreate) => {
        expect(resCreate.status).to.be.oneOf([200, 201]);
        const pId = resCreate.body?.id || resCreate.body?.prescription_id;

        // Act: Consulta listagem de receitas filtrada por filter=today (PR #469 / PR 3 #341)
        api.listarPrescricoes(storeId, { filter: 'today' }).then((resList) => {
          expect(resList.status, 'Status da listagem de prescrições').to.eq(200);
          const items = resList.body.items || [];
          expect(items.length, 'Deve encontrar prescrição na listagem de hoje').to.be.gte(1);

          // Localiza a prescrição recém-criada ou a primeira da lista
          const presc = items.find(it => it.id === pId) || items[0];
          expect(presc).to.have.property('registered_at');
          expect(presc.registered_at, 'registered_at da receita deve terminar com Z').to.match(/Z$/);
          expect(presc.registered_at, 'registered_at não deve conter offset -03:00').to.not.include('-03:00');
        });
      });
    });

    it('15.5 deve emitir timestamps em formato Instant (Z) nas transições de ciclo de vida da receita (/finalize)', () => {
      // Arrange: Cria prescrição completa com fórmula e insumo
      api.criarPrescricao(storeId, {
        prescription_type: 'human',
        status: 0,
        sale_type: 1,
        patient_id: clienteTesteId,
        patient_name: clienteTesteNome,
        buyer_id: clienteTesteId,
        buyer_name: clienteTesteNome,
        prescriber_id: 18780,
        pickup_store_id: storeId,
      }).then((resPresc) => {
        const pId = resPresc.body?.id || resPresc.body?.prescription_id || (resPresc.headers?.location ? parseInt(resPresc.headers.location.split('/').pop(), 10) : null);
        expect(pId, 'ID da prescrição').to.be.ok;

        // Cria fórmula necessária para finalização
        api.criarFormulaPrescricao(storeId, pId, {
          formula_number: 1,
          pharmaceutical_form_id: 2,
          lab_id: 2,
          qvd: 30.00,
          multiplier: 1,
          return_date: api.dataDeRetornoFutura(),
        }).then((resForm) => {
          const fId = resForm.body?.id;
          expect(fId, 'ID da fórmula').to.be.ok;

          // Adiciona insumo
          api.adicionarProdutoFormula(storeId, pId, fId, {
            product_id: 1004866,
            quantity: 250.0000,
            unit: 'mg',
          }).then(() => {
            // Dispara cálculo da fórmula (pré-requisito de negócio para finalizar)
            api.calcularFormula(storeId, pId, fId).then((resCalc) => {
              expect(resCalc.status).to.eq(200);

              // Act: Dispara a finalização da receita (RecipeLifecycleDtos)
              api.finalizarPrescricao(storeId, pId).then((resFin) => {
                expect(resFin.status, 'Status de finalização da receita').to.eq(200);
                expect(resFin.body).to.have.property('updated_at');

                // Assert: RecipeLifecycleDtos.updated_at DEVE terminar em Z
                expect(resFin.body.updated_at, 'updated_at na finalização deve ser Instant (Z)').to.match(/Z$/);
                expect(resFin.body.updated_at).to.not.include('-03:00');
              });
            });
          });
        });
      });
    });

    // Desde a backend#834 (PRs #867 e #868) o instante sai no fuso do banco do tenant (pela UF das lojas), não no fixo de São Paulo. O tenant de teste fica em UTC-3,
    // então o resultado não muda: os dois testes abaixo provam o VALOR do instante (o 15.1 a 15.5 só provam o formato). Um fuso resolvido errado desloca tudo em 1 h ou mais.
    // Tolerância de 5 min entre o relógio da máquina e o do servidor (medido em 2026-11-06: ~0,2 s).
    const TOLERANCIA_RELOGIO_MS = 5 * 60000;
    const pertoDeAgora = (iso, rotulo, inicio, fim) => {
      expect(iso, `${rotulo} em Instant (Z)`).to.be.a('string').and.match(/Z$/);
      const t = new Date(iso).getTime();
      expect(t, `${rotulo} (${iso}) perto do relógio da rodada`).to.be.within(inicio - TOLERANCIA_RELOGIO_MS, fim + TOLERANCIA_RELOGIO_MS);
    };

    it('15.6 deve gravar o agora no fuso do banco do tenant: automação e receita criadas agora voltam com o instante a minutos do relógio, sem deslocamento de horas (Issue backend#834)', () => {
      const TOKEN = Date.now().toString(36);
      let inicio;
      let automacaoId = null;
      // Act 1: automação pausada com palavra-chave única (nunca dispara), apagada no fim
      cy.then(() => { inicio = Date.now(); });
      cy.then(() => api.criarAutomacao({
        name: `[Cypress] Backend 834 ${TOKEN}`, description: 'Massa temporária do 0-A #15.6 (backend#834)', all_channels: true, is_active: false,
        trigger_type: 'keyword_match', trigger_config: { keywords: [`zz${TOKEN}`], match_type: 'contains', case_sensitive: false },
        steps: [{ step_type: 'condition', step_config: { subject: 'time_of_day', value: '08:00-18:00' }, branches: { yes: [], no: [] } }],
      })).then((res) => {
        expect(res.status, 'Status do POST /automations').to.eq(201);
        automacaoId = res.body.automation.id;
        pertoDeAgora(res.body.automation.updated_at, 'updated_at da automação', inicio, Date.now());
      });
      cy.then(() => api.excluirAutomacao(automacaoId));
      // Act 2: receita temporária (receita não tem DELETE)
      cy.then(() => { inicio = Date.now(); });
      cy.then(() => api.criarPrescricao(storeId, {
        prescription_type: 'human', status: 0, sale_type: 1,
        patient_id: clienteTesteId, patient_name: clienteTesteNome, buyer_id: clienteTesteId, buyer_name: clienteTesteNome,
        prescriber_id: 18780, pickup_store_id: storeId,
      })).then((res) => {
        expect(res.status, 'Status do POST /prescriptions').to.eq(201);
        const fim = Date.now();
        pertoDeAgora(res.body.created_at, 'created_at da receita', inicio, fim);
        pertoDeAgora(res.body.updated_at, 'updated_at da receita', inicio, fim);
      });
    });

    it('15.7 deve devolver a data de entrega enviada no finalize como o mesmo instante, no finalize e no detalhe, sem deslocamento entre a gravação e a leitura (Issue backend#834)', () => {
      // Arrange: receita temporária com fórmula calculada e data de retorno (a loja exige, backend#791)
      let receitaId;
      // Instante exato, minuto cheio, daqui a 3 dias às 14:30 UTC (o horário comercial de UTC-3 a UTC-5)
      const entrega = new Date(Date.now() + 3 * 86400000);
      entrega.setUTCHours(14, 30, 0, 0);
      const enviada = entrega.toISOString().replace('.000Z', 'Z');
      cy.then(() => api.criarPrescricao(storeId, {
        prescription_type: 'human', status: 0, sale_type: 1,
        patient_id: clienteTesteId, patient_name: clienteTesteNome, buyer_id: clienteTesteId, buyer_name: clienteTesteNome,
        prescriber_id: 18780, pickup_store_id: storeId,
      })).then((res) => {
        expect(res.status, 'Status do POST /prescriptions').to.eq(201);
        receitaId = res.body.id;
      });
      cy.then(() => api.criarFormulaPrescricao(storeId, receitaId, { formula_number: 1, pharmaceutical_form_id: 2, lab_id: 2, qvd: 30.0, multiplier: 1, return_date: api.dataDeRetornoFutura() })).then((resF) => {
        expect(resF.status, 'Status da fórmula').to.eq(201);
        return api.adicionarProdutoFormula(storeId, receitaId, resF.body.id, { product_id: 1004866, quantity: 250.0, unit: 'mg' }).then(() => api.calcularFormula(storeId, receitaId, resF.body.id));
      });
      // Act: finaliza com a data de entrega exata (loja em modo manual: a data gravada é a enviada)
      cy.then(() => api.finalizarPrescricao(storeId, receitaId, {}, { expected_delivery_at: entrega.toISOString() })).then((resFin) => {
        expect(resFin.status, 'Status do finalize').to.eq(200);
        expect(resFin.body.expected_delivery_at, 'A data de entrega volta como o mesmo instante no finalize').to.eq(enviada);
      });
      // Assert: a leitura do detalhe devolve o mesmo instante (gravação e leitura no mesmo fuso)
      cy.then(() => api.obterDetalhePrescricao(storeId, receitaId)).then((resDet) => {
        expect(resDet.status, 'Status do detalhe').to.eq(200);
        if (resDet.body.settings && resDet.body.settings.delivery_schedule !== 'manual') {
          cy.log(`⚠️ A loja está em modo ${resDet.body.settings.delivery_schedule}: a data pode ter ido ao 1º dia útil; o teste confere só o finalize × detalhe`);
        }
        expect(resDet.body.expected_delivery_at, 'O detalhe devolve o mesmo instante do finalize').to.eq(enviada);
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 26: BLOQUEIO DE MARCAÇÃO DE ORÇAMENTO FORA DO ABERTO (PR #474)
  // ---------------------------------------------------------------------------
  context('16. Bloqueio de Marcação de Orçamento Fora do Aberto (PR #474)', () => {

    // Massa residual compartilhada com os contexts 13 e 14 - fonte única em
    // cypress/fixtures/0.backend/massaResidualOrcamentos.js (AGENTS.md secao 0)
    const attendanceIdResidual = massaResidualOrcamentos.ATENDIMENTO_RESIDUAL_FORA_DO_ABERTO;
    const budgetCodeResidual = massaResidualOrcamentos.ORCAMENTO_RESIDUAL_FORA_DO_ABERTO;
    const attendanceIdVenda = massaResidualOrcamentos.ATENDIMENTO_VENDIDO;
    const budgetCodeVenda = massaResidualOrcamentos.ORCAMENTO_VENDIDO;
    const attendanceIdLinkAprovado = massaResidualOrcamentos.ATENDIMENTO_COBERTO_POR_LINK_APROVADO;
    const budgetCodeLinkAprovado = massaResidualOrcamentos.ORCAMENTO_COBERTO_POR_LINK_APROVADO;

    // Regra vigente (backend#583, medida em 2026-10-19): o status -1 sem venda e sem link aprovado é cobrável e aceita a marcação (200).
    // O BUDGET_NOT_OPEN só vale para status fora de 0 e -1, e a massa de dev não tem orçamento assim (120 atendimentos recentes: só 0 e -1).
    it('16.1 deve permitir marcar para link de pagamento o orçamento residual com status -1, sem venda e sem link aprovado (cobrável pela regra da backend#583)', function () {
      exigirMassaOrcamento(this, attendanceIdResidual, budgetCodeResidual, 'foraDoAbertoCobravel');
      // 1. Consulta orçamento para comprovar que está no status -1 e não virou venda nem link aprovado
      api.listarOrcamentosAtendimento(storeId, attendanceIdResidual).then((resList) => {
        expect(resList.status).to.eq(200);
        const budget = resList.body.data.find(b => b.code === budgetCodeResidual);
        expect(budget, 'Orçamento residual localizado').to.be.ok;
        expect(budget.status, 'Status residual -1 (fora do aberto, mas cobrável)').to.eq(-1);
        expect(budget.financial_id, 'Orçamento sem vínculo financeiro de venda').to.be.null;
        expect(budget.covered_by_approved_link, 'Orçamento não coberto por link aprovado').to.eq(false);

        // 2. Act: Marca para link de pagamento (selected_for_payment_link: true)
        api.atualizarSelecaoOrcamento(storeId, attendanceIdResidual, budgetCodeResidual, true).then((resPatch) => {
          // Assert: 200 OK, flag marcada e status original preservado
          expect(resPatch.status, 'Status da marcação do orçamento residual cobrável').to.eq(200);
          expect(resPatch.body.selected_for_payment_link, 'Flag marcada').to.eq(true);
          expect(resPatch.body.status, 'Status original do orçamento permanece -1').to.eq(-1);
        });
      });
    });

    it('16.2 deve permitir desmarcar livremente qualquer orçamento mesmo fora do aberto (200 OK)', function () {
      exigirMassaOrcamento(this, attendanceIdResidual, budgetCodeResidual, 'foraDoAbertoCobravel');
      // Act: Desmarca o orçamento fora do aberto (selected_for_payment_link: false)
      api.atualizarSelecaoOrcamento(storeId, attendanceIdResidual, budgetCodeResidual, false).then((resUnmark) => {
        // Assert: 200 OK — desmarcar continua 100% livre
        expect(resUnmark.status, 'Status de desmarcação bem-sucedida').to.eq(200);
        expect(resUnmark.body.selected_for_payment_link, 'Flag desmarcada').to.eq(false);
        expect(resUnmark.body.status, 'Status original do orçamento permanece inalterado').to.not.eq(0);
      });
    });

    it('16.3 deve respeitar a precedência estrita do requireChargeable priorizando venda e link aprovado sobre o status residual -1, que só é cobrável sem venda e sem link', function () {
      exigirMassaOrcamento(this, attendanceIdVenda, budgetCodeVenda, 'vendido');
      exigirMassaOrcamento(this, attendanceIdLinkAprovado, budgetCodeLinkAprovado, 'coberto');
      exigirMassaOrcamento(this, attendanceIdResidual, budgetCodeResidual, 'foraDoAbertoCobravel');
      // 1. Precedência 1: Venda concluída -> BUDGET_ALREADY_SOLD
      api.atualizarSelecaoOrcamento(storeId, attendanceIdVenda, budgetCodeVenda, true).then((resVenda) => {
        expect(resVenda.status).to.eq(422);
        expect(resVenda.body.code, 'Precedência máxima: venda concluída').to.eq('BUDGET_ALREADY_SOLD');
        expect(resVenda.body.message).to.include('já virou venda');

        // 2. Precedência 2: Já pago em link aprovado -> BUDGET_COVERED_BY_APPROVED_LINK
        api.atualizarSelecaoOrcamento(storeId, attendanceIdLinkAprovado, budgetCodeLinkAprovado, true).then((resLink) => {
          expect(resLink.status).to.eq(422);
          expect(resLink.body.code, 'Precedência secundária: coberto por link aprovado').to.eq('BUDGET_COVERED_BY_APPROVED_LINK');
          expect(resLink.body.message).to.include('já foi pago em um link aprovado');

          // 3. Precedência 3 (Residual): status -1 sem venda e sem link é cobrável -> 200; desmarca em seguida para não deixar a massa marcada
          api.atualizarSelecaoOrcamento(storeId, attendanceIdResidual, budgetCodeResidual, true).then((resResidual) => {
            expect(resResidual.status, 'Residual -1 sem venda e sem link aceita a marcação').to.eq(200);
            expect(resResidual.body.selected_for_payment_link, 'Flag marcada').to.eq(true);

            api.atualizarSelecaoOrcamento(storeId, attendanceIdResidual, budgetCodeResidual, false).then((resDesmarca) => {
              expect(resDesmarca.status, 'Desmarcação do residual restaura a massa').to.eq(200);
            });
          });
        });
      });
    });

    it('16.4 deve exigir autenticação obrigatória (401 Unauthorized) ao tentar alterar status de orçamento', () => {
      // Act: Dispara mutação sem cabeçalho Authorization
      api.atualizarSelecaoOrcamento(storeId, attendanceIdResidual, budgetCodeResidual, true, {
        headers: { Authorization: '' },
      }).then((res) => {
        // Assert: 401 Unauthorized
        expect(res.status, 'Status sem autenticação').to.eq(401);
        expect(res.body.error, 'Erro de autenticação').to.eq('Unauthorized');
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 27: UNIFICAÇÃO DE VISIBILIDADE DE LOJA E ESCRITA DE ATENDIMENTO (PR #487)
  // ---------------------------------------------------------------------------
  context('17. Unificação de Visibilidade de Loja e Escrita de Atendimento (PR #487)', () => {

    const attendanceIdLoja1 = 260800149; // Atendimento vinculado à Loja 1

    it('17.1 deve permitir acesso completo ao detalhe e sub-rotas do atendimento da loja da sessão (200 OK)', () => {
      // 1. Act & Assert: Detalhe do atendimento (/attendances/:id)
      api.obterDetalheAtendimento(storeId, attendanceIdLoja1).then((resDet) => {
        expect(resDet.status, 'Status detalhe na loja de origem').to.eq(200);
        expect(resDet.body).to.have.property('attendance');
        expect(resDet.body.attendance.id).to.eq(attendanceIdLoja1);

        // 2. Act & Assert: Mensagens do atendimento
        api.listarMensagensAtendimento(storeId, attendanceIdLoja1).then((resMsg) => {
          expect(resMsg.status, 'Status mensagens na loja de origem').to.eq(200);

          // 3. Act & Assert: Orçamentos do atendimento
          api.listarOrcamentosAtendimento(storeId, attendanceIdLoja1).then((resBudgets) => {
            expect(resBudgets.status, 'Status orçamentos na loja de origem').to.eq(200);

            // 4. Act & Assert: Arquivos IA do atendimento
            api.listarArquivosIa(storeId, attendanceIdLoja1).then((resIa) => {
              expect(resIa.status, 'Status arquivos IA na loja de origem').to.eq(200);

              // 5. Act & Assert: Links de pagamento do atendimento
              api.listarLinksPagamentoAtendimento(storeId, attendanceIdLoja1).then((resLinks) => {
                expect(resLinks.status, 'Status links de pagamento na loja de origem').to.eq(200);
              });
            });
          });
        });
      });
    });

    it('17.2 deve exigir autenticação obrigatória (401 Unauthorized) ao consultar atendimento e sub-rotas', () => {
      // Act: Consulta atendimento sem token JWT
      api.obterDetalheAtendimento(storeId, attendanceIdLoja1, { headers: { Authorization: '' } }).then((res) => {
        // Assert: 401 Unauthorized
        expect(res.status, 'Status sem autenticação').to.eq(401);
        expect(res.body.error, 'Erro de autenticação').to.eq('Unauthorized');
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 35: CONFIGURAÇÃO DE TEXTO DO ORÇAMENTO POR CANAL E CAMPOS DE FÓRMULA
  // (Issue backend#620, implementada na #621 — paridade com o Desktop, sub-issue
  // de omnicare-front#443)
  // ---------------------------------------------------------------------------
  context('18. Configuração de Texto do Orçamento por Canal e Campos de Fórmula (Issue backend#620)', () => {

    // Únicos 2 canais reais desta loja (GET /channels, medido em 2026-10-07): não há
    // canal com TEXTOORCAMENTO nulo nem com TEXTOORCAMENTO_DESCONTO = 0 na massa atual — fallback
    // (budget_text_type: 1, show_discount: false) e o tipo 1 "Produtos digitados" ficam sem
    // reprodução determinística; ver nota de gap no rodapé do turno/ROADMAP.md P1.
    const attendanceIdCanalOficial = massaResidualOrcamentos.ATENDIMENTO_ELEGIVEL; // canal 6, budget_text_type 2
    const attendanceIdCanalNaoOficial = 260800081; // canal 3, budget_text_type 0
    const attendanceIdFormulaExemplo = 260900111; // orçamento 260900369, citado na própria issue
    const attendanceIdComMultiplo = 261000001; // orçamento 261000004, formula_number 2, multiple: 2
    const attendanceIdRevenda = 260900088; // orçamento 260900230, type 2 (revenda, sem fórmula)

    it('18.1 Deve servir channel.budget_text_type e channel.show_discount no detalhe do atendimento, respeitando o enum do contrato (GET /attendances/:id)', () => {
      // Achado real 2026-10-07: budget_text_type é configuração viva do canal (tela [628] do
      // Desktop, OC_CANAL.TEXTOORCAMENTO) - o canal 6 (oficial) estava em 2 na validação original
      // da Issue backend#620 e já apareceu em 1 horas depois, sem nenhuma ação da automação (regra
      // de dado, não de contrato). Por isso o teste afirma só o shape do enum, nunca um valor fixo
      // por canal - quem quiser confirmar o valor vigente de um canal específico deve medir ao vivo.
      api.obterDetalheAtendimento(storeId, attendanceIdCanalOficial).then((res) => {
        expect(res.status, 'Status do detalhe (canal oficial)').to.eq(200);
        const canal = res.body.attendance.channel;
        expect(canal, 'budget_text_type deve ser um dos 3 valores do enum').to.have.property('budget_text_type').and.be.oneOf([0, 1, 2]);
        expect(canal, 'show_discount deve ser booleano').to.have.property('show_discount').and.be.a('boolean');
      });

      api.obterDetalheAtendimento(storeId, attendanceIdCanalNaoOficial).then((res) => {
        expect(res.status, 'Status do detalhe (canal não oficial)').to.eq(200);
        const canal = res.body.attendance.channel;
        expect(canal, 'budget_text_type deve ser um dos 3 valores do enum').to.have.property('budget_text_type').and.be.oneOf([0, 1, 2]);
        expect(canal.show_discount).to.be.a('boolean');
      });
    });

    it('18.2 Não deve incluir budget_text_type/show_discount no channel da listagem de atendimentos (GET /attendances) — os 2 campos são exclusivos do detalhe', () => {
      api.listarAtendimentos(storeId, { page: 1, per_page: 20 }).then((res) => {
        expect(res.status, 'Status da listagem').to.eq(200);
        const itens = res.body.items || res.body.data || res.body;
        expect(itens, 'Lista de atendimentos').to.be.an('array').and.have.length.at.least(1);

        itens.forEach((item) => {
          if (item.channel) {
            expect(item.channel, `channel do item ${item.id} na listagem não deve trazer budget_text_type`).to.not.have.property('budget_text_type');
            expect(item.channel, `channel do item ${item.id} na listagem não deve trazer show_discount`).to.not.have.property('show_discount');
          }
        });
      });
    });

    it('18.3 Cada fórmula da listagem de orçamentos deve servir quantity, pharmaceutical_form e label_text (GET /attendances/:id/budgets)', () => {
      // Orçamento #260900369 citado na própria issue como exemplo de referência (A2.QVD=30,
      // forma CAPSULAS, A2.TEXTOROTULO do tipo 2 - Texto do rótulo)
      api.listarOrcamentosAtendimento(storeId, attendanceIdFormulaExemplo).then((res) => {
        expect(res.status, 'Status da listagem de orçamentos').to.eq(200);
        const formula = res.body.data.find((b) => b.code === 260900369);
        expect(formula, 'orçamento de referência #260900369 localizado').to.not.be.undefined;

        expect(formula).to.have.property('quantity', 30);
        expect(formula).to.have.property('pharmaceutical_form', 'CAPSULAS');
        expect(formula).to.have.property('label_text', 'PASSIFLORA EXTRATO 250mg - BASE EFERVESCENTE P/CONDROITINA/GLUCOSAMINA SABOR LARANJA');
        expect(formula).to.have.property('multiple').and.be.a('number');
      });
    });

    it('18.4 Deve servir multiple > 1 quando a fórmula tiver multiplicador configurado (A2.MULTIPLO)', () => {
      api.listarOrcamentosAtendimento(storeId, attendanceIdComMultiplo).then((res) => {
        expect(res.status, 'Status da listagem de orçamentos').to.eq(200);
        const formulaMultiplicada = res.body.data.find((b) => b.code === 261000004 && b.formula_number === 2);
        expect(formulaMultiplicada, 'fórmula com multiplicador localizada').to.not.be.undefined;
        expect(formulaMultiplicada.multiple, 'multiple deve refletir o multiplicador real (> 1)').to.be.greaterThan(1);
      });
    });

    it('18.5 Orçamento de revenda (sem fórmula) não deve servir quantity, pharmaceutical_form, label_text nem multiple', () => {
      api.listarOrcamentosAtendimento(storeId, attendanceIdRevenda).then((res) => {
        expect(res.status, 'Status da listagem de orçamentos').to.eq(200);
        const revenda = res.body.data.find((b) => b.code === 260900230);
        expect(revenda, 'orçamento de revenda localizado').to.not.be.undefined;
        expect(revenda.type, 'orçamento de revenda tem type distinto de fórmula').to.not.eq(1);

        // Mesmo padrão já usado por formula_number (ausente, não null) - ausência nas 2 pontas
        // se lê igual para o front, mas o contrato real omite a chave por completo
        expect(revenda, 'revenda não deve ter quantity').to.not.have.property('quantity');
        expect(revenda, 'revenda não deve ter pharmaceutical_form').to.not.have.property('pharmaceutical_form');
        expect(revenda, 'revenda não deve ter label_text').to.not.have.property('label_text');
        expect(revenda, 'revenda não deve ter multiple').to.not.have.property('multiple');
      });
    });

    it('18.6 Fórmula com o texto do rótulo em branco não deve servir a chave label_text (trim + ausência, não string vazia)', () => {
      api.listarOrcamentosAtendimento(storeId, attendanceIdCanalOficial).then((res) => {
        expect(res.status, 'Status da listagem de orçamentos').to.eq(200);
        // formula_number 3 do orçamento 260900232 - produtos vazios e sem rótulo cadastrado
        const formulaSemRotulo = res.body.data.find((b) => b.code === 260900232 && b.formula_number === 3);
        expect(formulaSemRotulo, 'fórmula sem rótulo localizada').to.not.be.undefined;
        expect(formulaSemRotulo, 'quantity e pharmaceutical_form continuam presentes mesmo sem rótulo').to.have.property('quantity');
        expect(formulaSemRotulo, 'label_text ausente quando TEXTOROTULO está em branco').to.not.have.property('label_text');
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 41: DOCUMENTO DO CLIENTE TRAVADO E CAPABILITY 341 (ISSUE BACKEND#606, TRAVA ENTREGUE NA #615)
  // ---------------------------------------------------------------------------
  context('19. Documento do Cliente Travado e Capability can_change_label_name (Issue backend#606/#615)', () => {

    // A 341 cobre só label_name (Razão Social); a 027, o nome. O CPF/CNPJ preenchido trava por regra de dado, sem permissão.
    // Clientes temporários próprios (CPF gerado), desativados ao fim de cada teste.
    const gerarCpf = () => {
      const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 9));
      const dv = (base) => { const soma = base.reduce((acc, d, i) => acc + d * (base.length + 1 - i), 0); const r = (soma * 10) % 11; return r === 10 ? 0 : r; };
      const d1 = dv(n); const d2 = dv([...n, d1]);
      return [...n, d1, d2].join('');
    };
    const mascarar = (cpf) => `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;

    // Cria o cliente, roda o cenário e sempre desativa no fim
    const comClienteTemporario = (extra, cenario) => {
      const nome = `Cliente Doc Travado E2E ${Date.now()}`;
      api.criarCliente(storeId, { name: nome, person_type: 1, ...extra }).then((resCriacao) => {
        expect(resCriacao.status, 'Status da criação do cliente temporário').to.eq(201);
        const id = resCriacao.body.id;
        cenario(id, resCriacao.body);
        api.alterarAtivacaoCliente(storeId, id, false).then((resDesativ) => {
          expect(resDesativ.status, 'Status da desativação do cliente temporário').to.eq(200);
        });
      });
    };

    const esperarTravado = (res, rotulo) => {
      expect(res.status, `Status ${rotulo}`).to.eq(422);
      expect(res.body.code, `code ${rotulo}`).to.eq('CLIENT_DOCUMENT_LOCKED');
    };

    it('19.1 deve recusar com 422 CLIENT_DOCUMENT_LOCKED trocar, apagar ou mudar o person_type de um documento já preenchido', () => {
      const cpf = gerarCpf();
      comClienteTemporario({ document: cpf }, (id) => {
        api.atualizarCliente(storeId, id, { document: gerarCpf() }).then((res) => esperarTravado(res, 'ao trocar o documento'));
        api.atualizarCliente(storeId, id, { document: '' }).then((res) => esperarTravado(res, 'ao apagar com string vazia'));
        api.atualizarCliente(storeId, id, { document: null }).then((res) => esperarTravado(res, 'ao apagar com null'));
        api.atualizarCliente(storeId, id, { person_type: 2 }).then((res) => esperarTravado(res, 'ao trocar o person_type'));
        api.obterDetalheCliente(storeId, id).then((res) => {
          expect(res.body.document, 'documento permanece o original após as recusas').to.eq(cpf);
        });
      });
    });

    it('19.2 deve aceitar com 200 reenviar o mesmo documento, cru ou mascarado, sem alterá-lo', () => {
      const cpf = gerarCpf();
      comClienteTemporario({ document: cpf }, (id) => {
        api.atualizarCliente(storeId, id, { document: cpf, person_type: 1 }).then((res) => {
          expect(res.status, 'Status ao reenviar o documento cru').to.eq(200);
        });
        api.atualizarCliente(storeId, id, { document: mascarar(cpf) }).then((res) => {
          expect(res.status, 'Status ao reenviar o documento mascarado').to.eq(200);
        });
        api.obterDetalheCliente(storeId, id).then((res) => {
          expect(res.body.document, 'documento inalterado').to.eq(cpf);
        });
      });
    });

    it('19.3 deve aceitar o primeiro documento de um cliente sem documento e travar o segundo (CLIENT_DOCUMENT_LOCKED)', () => {
      comClienteTemporario({}, (id) => {
        const primeiro = gerarCpf();
        api.atualizarCliente(storeId, id, { document: primeiro }).then((res) => {
          expect(res.status, 'Status do primeiro documento').to.eq(200);
        });
        api.atualizarCliente(storeId, id, { document: gerarCpf() }).then((res) => esperarTravado(res, 'ao trocar o primeiro documento'));
      });
    });

    it('19.4 deve expor can_change_label_name na loja e no detalhe e fazer o PATCH de label_name seguir a capability (200 se true, 403 PERMISSION_DENIED se false)', () => {
      api.obterCapabilitiesClientes(storeId).then((resLoja) => {
        expect(resLoja.status, 'Status das capabilities da loja').to.eq(200);
        const podeNaLoja = resLoja.body.capabilities.can_change_label_name;
        expect(podeNaLoja, 'can_change_label_name exposta na loja').to.be.a('boolean');
        comClienteTemporario({}, (id) => {
          api.obterDetalheCliente(storeId, id).then((resDet) => {
            expect(resDet.body.capabilities.can_change_label_name, 'detalhe concorda com a loja').to.eq(podeNaLoja);
            api.atualizarCliente(storeId, id, { label_name: `Razao Social E2E ${Date.now()}` }).then((res) => {
              if (podeNaLoja) {
                expect(res.status, 'Status do PATCH de label_name com a 341').to.eq(200);
              } else {
                expect(res.status, 'Status do PATCH de label_name sem a 341').to.eq(403);
                expect(res.body.code, 'code da recusa sem a 341').to.eq('PERMISSION_DENIED');
              }
            });
          });
        });
      });
    });

  });

  context('20. Busca sem Distinção de Acento e Caixa nas Rotas do Backend (Issue backend#628/PR #629)', () => {

    // A issue aplica COLLATE WIN_PTBR nos predicados de texto: "jose" acha JOSÉ, "josé" acha JOSE e a caixa não pesa.
    // Todo teste compara as variações do MESMO termo e exige o mesmo conjunto de registros nas três.
    // Fora de escopo: produtos (depende da procedure MOV_ATENDIMENTO_PRODUTOS do ERP) e o índice CLI_IDX_NOME_PTBR (teste de integração do backend).
    const TIMEOUT_BUSCA = { timeout: 90000 };
    const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    const itensDe = (res) => (res.body && (res.body.items || res.body.data)) || [];
    const nomeDe = (item) => item.name || item.description || item.title || item.customer_name || '';
    const assinatura = (itens) => itens.map((i) => JSON.stringify(i)).sort();

    // Injeta um acento na primeira vogal (laboratorio -> laboratório) para provar que "com acento" acha o registro sem acento
    const comAcentoInjetado = (palavra) => palavra.replace(/[aeiou]/i, (v) => ({ a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' }[v.toLowerCase()]));

    // Consulta a rota com cada variação do termo (em sequência) e exige o mesmo conjunto de registros nas três
    const compararVariacoes = (rota, parametro, variacoes) => {
      const consultas = [];
      const encadear = (i) => {
        if (i >= variacoes.length) return cy.wrap(consultas, { log: false });
        return api.get(`/${rota}`, { [parametro]: variacoes[i] }, TIMEOUT_BUSCA).then((res) => {
          expect(res.status, `Status de /${rota}?${parametro}=${variacoes[i]}`).to.eq(200);
          consultas.push({ termo: variacoes[i], itens: itensDe(res) });
          return encadear(i + 1);
        });
      };
      return encadear(0).then((resultados) => {
        const [base, ...demais] = resultados;
        expect(base.itens.length, `/${rota} deve achar ao menos 1 registro para "${base.termo}"`).to.be.at.least(1);
        demais.forEach((r) => {
          expect(assinatura(r.itens), `/${rota}: "${r.termo}" deve trazer os mesmos registros que "${base.termo}"`).to.deep.eq(assinatura(base.itens));
        });
        return base.itens;
      });
    };

    it('20.1 Deve buscar clientes no typeahead sem distinguir acento nem caixa, trazer juntos os nomes com e sem acento e manter o recorte mínimo de 3 caracteres', () => {
      // "sao" → 7 clientes na massa, entre eles "SÃO" e "SAO"; as 3 formas têm de trazer exatamente os mesmos
      compararVariacoes('clients', 'q', ['sao', 'são', 'SÃO']).then((itens) => {
        const nomes = itens.map(nomeDe);
        expect(nomes.some((n) => /SÃO/.test(n)), 'deve vir o nome gravado com acento').to.be.true;
        expect(nomes.some((n) => /^SAO/.test(n)), 'deve vir o nome gravado sem acento').to.be.true;
      });

      // Termo comum e grande (limite de 500): o mesmo recorte nas três formas, em tempo razoável
      const inicio = Date.now();
      compararVariacoes('clients', 'q', ['jose', 'josé', 'JOSÉ']).then(() => {
        expect(Date.now() - inicio, 'as 3 consultas de "jose" devem fechar em tempo razoável (cache frio do COLLATE chegou a 14 s)').to.be.lessThan(60000);
      });

      // Menos de 3 caracteres continua sem resultado
      api.buscarClientes(storeId, 'jo', TIMEOUT_BUSCA).then((res) => {
        expect(res.status, 'Status com 2 caracteres').to.eq(200);
        expect(itensDe(res), 'termo curto não pesquisa').to.have.length(0);
      });
    });

    // [SKIP] 2026-10-15 (aba-c, decisão do operador): depende de um atendimento Aguardando cujo cliente tenha acento no nome, massa que o CI não tem (TypeError em split de valor indefinido).
    // Falhou no CI do GitHub Actions por falta dessa massa; reativar quando o backend entregar as rotas de massa de teste.
    it.skip('20.2 Deve buscar na fila de atendimentos sem distinguir acento nem caixa, achando o nome gravado com acento digitado sem acento', () => {
      // Massa dinâmica: o primeiro atendimento Aguardando/Finalizado cujo nome de cliente tenha acento
      const procurar = (status) => api.listarAtendimentos(storeId, { status, page: 1, per_page: 100 }, TIMEOUT_BUSCA).then((res) => {
        return itensDe(res).find((a) => /[À-ÿ]/.test(a.customer_name || '') && semAcento(a.customer_name.split(' ')[0]).length >= 3);
      });

      procurar('waiting').then((achado) => (achado ? { status: 'waiting', att: achado } : procurar('finished').then((att) => ({ status: 'finished', att })))).then(({ status, att }) => {
        expect(att, '🔒 Nenhum atendimento com acento no nome do cliente na fila (massa)').to.exist;
        const primeiro = att.customer_name.split(' ')[0];
        const variacoes = [semAcento(primeiro).toLowerCase(), primeiro.toLowerCase(), primeiro.toUpperCase()];
        const idsDe = (termo) => api.listarAtendimentos(storeId, { status, search: termo, page: 1, per_page: 100 }, TIMEOUT_BUSCA).then((res) => {
          expect(res.status, `Status de search=${termo}`).to.eq(200);
          return itensDe(res).map((a) => a.id).sort();
        });
        idsDe(variacoes[0]).then((ids0) => {
          expect(ids0, `search="${variacoes[0]}" deve achar o atendimento #${att.id} de "${att.customer_name}"`).to.include(att.id);
          idsDe(variacoes[1]).then((ids1) => expect(ids1, `"${variacoes[1]}" deve trazer o mesmo que "${variacoes[0]}"`).to.deep.eq(ids0));
          idsDe(variacoes[2]).then((ids2) => expect(ids2, `"${variacoes[2]}" deve trazer o mesmo que "${variacoes[0]}"`).to.deep.eq(ids0));
        });
        // Busca pelo código do atendimento continua funcionando
        idsDe(String(att.id)).then((ids) => expect(ids, 'busca pelo código do atendimento').to.include(att.id));
      });
    });

    it('20.3 Deve buscar nos catálogos com massa acentuada (prescritor, funcionário, cidade e operação) sem distinguir acento nem caixa', () => {
      // Prescritor: "CONCEIÇÃO" e "CONCEIÇAO" na mesma resposta de "conceicao"
      compararVariacoes('prescribers', 'q', ['conceicao', 'conceição', 'CONCEIÇÃO']).then((itens) => {
        expect(itens.map(nomeDe).some((n) => /CONCEIÇÃO/.test(n)), 'prescritor gravado com acento').to.be.true;
      });
      compararVariacoes('prescribers', 'q', ['sao', 'são', 'SÃO']);
      // Funcionário: massa descoberta na hora (o nome com acento muda no tenant compartilhado: "JOSÉ GUILHERME" virou "JOSE GUILHERME TESTE", [R-ATEMPORAL]).
      // A busca sem acento achar o registro com acento já prova o caso "gravado sem acento digitado com acento", então não há asserção de nome fixo.
      api.get('/employees', {}, TIMEOUT_BUSCA).then((resLista) => {
        expect(resLista.status, 'Status da listagem de /employees').to.eq(200);
        const palavra = itensDe(resLista).map(nomeDe).flatMap((n) => n.split(/[^A-Za-zÀ-ÿ]+/)).find((p) => /[À-ÿ]/.test(p) && semAcento(p).length >= 3);
        if (!palavra) {
          cy.log('⏭️ Sem funcionário com acento no nome na massa: a busca de /employees fica sem prova nesta rodada (as demais rotas seguem)');
          return;
        }
        const base = semAcento(palavra).toLowerCase();
        compararVariacoes('employees', 'q', [base, palavra.toLowerCase(), palavra.toUpperCase()]).then((itens) => {
          expect(itens.map(nomeDe).some((n) => n.toUpperCase().includes(palavra.toUpperCase())), `funcionário gravado com acento ("${palavra}")`).to.be.true;
        });
      });
      compararVariacoes('cities', 'q', ['sao', 'são', 'SÃO']);
      compararVariacoes('cities', 'q', ['conceicao', 'conceição', 'CONCEIÇÃO']);
      compararVariacoes('operation-types', 'q', ['sao', 'são', 'SÃO']);
    });

    it('20.4 Deve achar no catálogo de laboratórios, sem massa acentuada, o registro gravado sem acento digitando o termo com acento', () => {
      // Pega uma palavra real da própria listagem e injeta o acento: "laboratorio" → "laboratório" → "LABORATÓRIO"
      // /units fica de fora: com termo de 8+ caracteres responde 500 (achado de 2026-10-13, ver PROJECT_CONTEXT §10.1 ctx 20)
      ['laboratories'].forEach((rota) => {
        api.get(`/${rota}`, {}, TIMEOUT_BUSCA).then((res) => {
          expect(res.status, `Status da listagem de /${rota}`).to.eq(200);
          const palavra = itensDe(res).map(nomeDe).flatMap((n) => n.split(/[^A-Za-zÀ-ÿ]+/)).find((p) => p.length >= 5 && /[aeiou]/i.test(p));
          expect(palavra, `🔒 /${rota} sem nome com palavra de 5+ letras (massa)`).to.be.a('string');
          const base = semAcento(palavra).toLowerCase();
          compararVariacoes(rota, 'q', [base, comAcentoInjetado(base), comAcentoInjetado(base).toUpperCase()]);
        });
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 43: TYPEAHEAD DE CLIENTES — NOME FANTASIA, FILTRO DE TIPO E TIPO NO ITEM
  // ---------------------------------------------------------------------------
  context('21. Typeahead de Clientes: Nome Fantasia, Filtro person_type e Tipo de Pessoa no Item (Issue backend#581/PR #634)', () => {

    // GET /clients?q=...[&person_type=1|2], sem `type` (com `type` a rota vira a listagem da tela de Clientes).
    // A issue acrescenta ao typeahead: (1) busca pelo início do Nome fantasia (NOMEROTULO), só para PJ; (2) filtro opcional person_type;
    // (3) person_type em cada item. Fora de escopo: busca pelo meio do nome (continua STARTING WITH, de propósito, por desempenho).
    // Massa dinâmica: o fantasia é lido da ficha (label_name), nunca fixado; o teto do FIRST 500 é checado antes de concluir "ausente".
    const TIMEOUT_BUSCA = { timeout: 90000 };
    const TETO_TYPEAHEAD = 500;
    const itensDe = (res) => (res.body && (res.body.items || res.body.data)) || [];
    const normalizar = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    const idsDe = (itens) => itens.map((i) => i.id).sort((a, b) => a - b);

    let pjComFantasia = null;

    const typeahead = (qs) => api.get(`/clients`, qs, TIMEOUT_BUSCA);

    // Percorre prefixos comuns até achar um cliente do tipo pedido cujo label_name não seja encontrado pelo próprio nome.
    // Só PJ é descoberto na massa real: PF com rótulo distinto do nome é raro (1 em ~320 medidos) e o rótulo dele estoura o teto de 500 — o PF do 21.3 é criado
    const acharComRotuloDistinto = (personType, prefixos) => {
      const tentarPrefixo = (iPref) => {
        if (iPref >= prefixos.length) return cy.wrap(null, { log: false });
        return typeahead({ q: prefixos[iPref], person_type: personType }).then((res) => {
          expect(res.status, `Status de q=${prefixos[iPref]}&person_type=${personType}`).to.eq(200);
          const candidatos = itensDe(res).slice(0, 40);
          const olhar = (iItem) => {
            if (iItem >= candidatos.length) return tentarPrefixo(iPref + 1);
            return api.get(`/clients/${candidatos[iItem].id}`, {}, TIMEOUT_BUSCA).then((ficha) => {
              const b = ficha.body || {};
              const rotulo = (b.label_name || '').trim();
              const distinto = rotulo.length >= 5 && !normalizar(b.name).startsWith(normalizar(rotulo));
              if (!distinto || b.active === false) return olhar(iItem + 1);
              // Só serve se buscar pelo rótulo não estourar o teto (senão "ausente" poderia ser só corte do FIRST 500)
              return typeahead({ q: rotulo }).then((resRotulo) => (
                itensDe(resRotulo).length < TETO_TYPEAHEAD
                  ? cy.wrap({ id: candidatos[iItem].id, name: b.name, label_name: rotulo }, { log: false })
                  : olhar(iItem + 1)
              ));
            });
          };
          return olhar(0);
        });
      };
      return tentarPrefixo(0);
    };

    before(() => {
      acharComRotuloDistinto(2, ['jos', 'farm', 'dro', 'com', 'ind', 'clin', 'hosp', 'cent']).then((pj) => { pjComFantasia = pj; });
    });

    it('21.1 Deve achar a empresa pelo início do Nome fantasia, sem distinguir acento nem caixa, e trazer o tipo de pessoa no item', () => {
      expect(pjComFantasia, '🔒 Nenhum PJ ativo com Nome fantasia diferente da Razão social (massa)').to.exist;
      const fantasia = pjComFantasia.label_name;
      const variacoes = [fantasia, normalizar(fantasia), fantasia.toUpperCase()];

      const consultas = [];
      variacoes.forEach((q) => {
        typeahead({ q }).then((res) => {
          expect(res.status, `Status de q=${q}`).to.eq(200);
          const itens = itensDe(res);
          expect(itens.length, `q="${q}" não pode estourar o teto de ${TETO_TYPEAHEAD} (senão "achou/não achou" não prova nada)`).to.be.lessThan(TETO_TYPEAHEAD);
          const alvo = itens.find((i) => i.id === pjComFantasia.id);
          expect(alvo, `q="${q}" deve achar o PJ #${pjComFantasia.id} (razão social "${pjComFantasia.name}", fantasia "${fantasia}")`).to.exist;
          expect(alvo.person_type, 'person_type do item PJ').to.eq(2);
          consultas.push(idsDe(itens));
        });
      });
      cy.then(() => {
        consultas.slice(1).forEach((ids, i) => {
          expect(ids, `"${variacoes[i + 1]}" deve trazer o mesmo conjunto que "${variacoes[0]}"`).to.deep.eq(consultas[0]);
        });
      });
    });

    it('21.2 Não deve achar a empresa por um trecho do meio do Nome fantasia (a busca é pelo início, de propósito)', () => {
      expect(pjComFantasia, '🔒 Nenhum PJ ativo com Nome fantasia diferente da Razão social (massa)').to.exist;
      const trecho = pjComFantasia.label_name.slice(1);
      typeahead({ q: trecho }).then((res) => {
        expect(res.status, `Status de q=${trecho}`).to.eq(200);
        const itens = itensDe(res);
        expect(itens.length, `q="${trecho}" não pode estourar o teto de ${TETO_TYPEAHEAD}`).to.be.lessThan(TETO_TYPEAHEAD);
        expect(idsDe(itens), `"${trecho}" é o fantasia "${pjComFantasia.label_name}" sem a 1ª letra: não pode achar o PJ #${pjComFantasia.id}`).to.not.include(pjComFantasia.id);
      });
    });

    it('21.3 Não deve achar uma pessoa física pelo nome do rótulo, mas deve continuar achando pelo nome e pelo código', () => {
      // PF temporário com nome e rótulo únicos (a massa real quase não tem PF com rótulo distinto); desativado ao fim, como no ctx 19
      const sufixo = String(Date.now());
      const nome = `Zzpessoa Typeahead ${sufixo}`;
      const rotulo = `Zzrotulo Typeahead ${sufixo}`;
      api.criarCliente(storeId, { name: nome, person_type: 1, label_name: rotulo }).then((resCriacao) => {
        expect(resCriacao.status, 'Status da criação do PF temporário').to.eq(201);
        const id = resCriacao.body.id;
        expect(resCriacao.body.label_name, 'o PF guarda o rótulo').to.eq(rotulo);

        typeahead({ q: rotulo }).then((res) => {
          expect(res.status, 'Status da busca pelo rótulo').to.eq(200);
          expect(idsDe(itensDe(res)), `o rótulo "${rotulo}" não pode achar o PF #${id}`).to.not.include(id);
        });
        typeahead({ q: nome }).then((res) => {
          const alvo = itensDe(res).find((i) => i.id === id);
          expect(alvo, 'o nome continua achando o PF').to.exist;
          expect(alvo.person_type, 'person_type do item PF').to.eq(1);
        });
        typeahead({ q: String(id) }).then((res) => {
          expect(idsDe(itensDe(res)), `o código ${id} continua achando o PF`).to.include(id);
        });

        api.alterarAtivacaoCliente(storeId, id, false).then((resDesativ) => {
          expect(resDesativ.status, 'Status da desativação do PF temporário').to.eq(200);
        });
      });
    });

    it('21.4 Deve filtrar por person_type em todos os ramos e manter, sem o parâmetro, o mesmo resultado como a soma dos dois tipos', () => {
      expect(pjComFantasia, '🔒 Nenhum PJ ativo com Nome fantasia diferente da Razão social (massa)').to.exist;
      // O prefixo do fantasia casa também nomes de PF, então traz os dois tipos
      const q = pjComFantasia.label_name;
      const prefixo = q.slice(0, Math.min(q.length, 6));
      typeahead({ q: prefixo }).then((resTodos) => {
        const todos = itensDe(resTodos);
        expect(todos.length, `q="${prefixo}" sem filtro não pode estourar o teto de ${TETO_TYPEAHEAD}`).to.be.lessThan(TETO_TYPEAHEAD);
        todos.forEach((i) => expect([0, 1, 2], `person_type do item #${i.id}`).to.include(i.person_type));

        [1, 2].forEach((tipo) => {
          typeahead({ q: prefixo, person_type: tipo }).then((res) => {
            expect(res.status, `Status com person_type=${tipo}`).to.eq(200);
            const filtrados = itensDe(res);
            filtrados.forEach((i) => expect(i.person_type, `item #${i.id} com person_type=${tipo}`).to.eq(tipo));
            expect(idsDe(filtrados), `person_type=${tipo} deve trazer exatamente os itens daquele tipo do resultado sem filtro`).to.deep.eq(idsDe(todos.filter((i) => i.person_type === tipo)));
          });
        });
      });

      // O PJ do fantasia só aparece com 2 (ramo do Nome fantasia também obedece ao filtro)
      typeahead({ q, person_type: 2 }).then((res) => expect(idsDe(itensDe(res)), 'person_type=2 acha o PJ pelo fantasia').to.include(pjComFantasia.id));
      typeahead({ q, person_type: 1 }).then((res) => expect(idsDe(itensDe(res)), 'person_type=1 não acha o PJ').to.not.include(pjComFantasia.id));
    });

    it('21.5 Deve recusar com 422 um person_type diferente de 1 ou 2 e manter o recorte mínimo de 3 caracteres', () => {
      // 0 existe no cadastro (nem PF nem PJ), mas não é um filtro válido
      [3, 0, 'x'].forEach((valor) => {
        typeahead({ q: 'jos', person_type: valor }).then((res) => {
          expect(res.status, `Status com person_type=${valor}`).to.eq(422);
          expect(res.body.message, `Mensagem com person_type=${valor}`).to.match(/person_type/);
        });
      });

      // Menos de 3 caracteres continua sem resultado, também com o filtro
      typeahead({ q: 'jo', person_type: 2 }).then((res) => {
        expect(res.status, 'Status com 2 caracteres').to.eq(200);
        expect(itensDe(res), 'termo curto não pesquisa').to.have.length(0);
      });
    });

    it('21.6 Deve responder rápido a um termo sem resultado (todos os ramos usam índice, inclusive o do Nome fantasia)', () => {
      // Sem índice em NOMEROTULO o ramo varre ~816 mil clientes: medido ~2,6 s contra ~100 ms com a DDL v013 aplicada
      const LIMITE_MS = 1500;
      const termo = 'zzqxjw';
      const medidas = [];
      typeahead({ q: termo }); // aquece o cache frio do COLLATE, fora da medição
      [undefined, 1, 2].forEach((tipo) => {
        cy.then(() => {
          const inicio = Date.now();
          return typeahead(tipo ? { q: termo, person_type: tipo } : { q: termo }).then((res) => {
            expect(res.status, `Status com person_type=${tipo}`).to.eq(200);
            expect(itensDe(res), 'termo sem correspondência').to.have.length(0);
            medidas.push({ tipo: tipo || 'sem filtro', ms: Date.now() - inicio });
          });
        });
      });
      cy.then(() => {
        medidas.forEach((m) => expect(m.ms, `busca sem resultado (${m.tipo}) deve fechar em até ${LIMITE_MS} ms — acima disso o plano deixou de usar índice (DDL v013 ausente?)`).to.be.lessThan(LIMITE_MS));
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 47: TERMO DE BUSCA MAIOR QUE A COLUNA PESQUISADA
  // ---------------------------------------------------------------------------
  context('22. Termo de Busca Maior que a Coluna Pesquisada Devolve Lista Vazia, não 500 (Issue backend#639/PR #647)', () => {

    // O Firebird dá ao "?" o tamanho da coluna comparada: um termo maior que ela estourava "string right truncation" e a rota respondia 500
    // (UNIDADES.UNIDADE tem 10 caracteres, CPF_CNPJ 20, nomes e descrições 60). A PR #647 passa o termo como CAST(? AS VARCHAR(8191)) nas 20 buscas
    // por CONTAINING/STARTING WITH: um termo que não cabe simplesmente não casa nada e a rota responde 200 com lista vazia.
    // Só leitura (GET). O "antes" não é reproduzível (corrigido na dev): o teste fixa o contrato novo e o controle positivo prova que a busca continua achando termo comum.
    // Fora de escopo: a busca sem acento ("jose"/"josé") e o tempo do índice de cliente já são guardados em 20.1 e 21.6; /standard-messages ignora q e /deliveries
    // responde 403 (recurso não contratado), então ficam sem teste.
    const TIMEOUT_BUSCA = { timeout: 90000 };
    const itensDe = (res) => (res.body && (res.body.items || res.body.data)) || [];
    const totalDe = (res) => (res.body && res.body.pagination ? res.body.pagination.total : res.body.total);

    const exigirListaVazia = (res, rotulo) => {
      expect(res.status, `Status de ${rotulo} (termo que não cabe na coluna não pode ser 500)`).to.eq(200);
      expect(itensDe(res), `Itens de ${rotulo}`).to.have.length(0);
      const total = totalDe(res);
      if (total !== undefined) expect(total, `Total de ${rotulo}`).to.eq(0);
    };

    it('22.1 Deve responder 200 com lista vazia na busca de unidades com termo maior que a coluna de 10 caracteres', () => {
      // 10 caracteres é o tamanho exato da coluna UNIDADE: cabe, não quebra; 11 é o caso do relato (7 ocorrências no dev em 13/10)
      [10, 11, 61, 500].forEach((tamanho) => {
        api.get(`/units`, { q: 'a'.repeat(tamanho) }, TIMEOUT_BUSCA).then((res) => {
          exigirListaVazia(res, `/units?q=(${tamanho} caracteres)`);
        });
      });
    });

    it('22.2 Deve continuar achando unidades pela sigla com um termo curto na busca de unidades', () => {
      // Controle positivo: sem ele, devolver sempre vazio passaria no 22.1 (a spec backend#228 busca só pela sigla)
      api.get(`/units`, { q: 'm' }, TIMEOUT_BUSCA).then((res) => {
        expect(res.status, 'Status de /units?q=m').to.eq(200);
        const itens = itensDe(res);
        expect(itens.length, '/units?q=m deve achar ao menos 1 unidade').to.be.at.least(1);
        itens.forEach((i) => expect(String(i.unit).toLowerCase(), `sigla "${i.unit}" deve conter "m"`).to.contain('m'));
      });
    });

    it('22.3 Deve responder 200 com lista vazia no typeahead de clientes com documento de 21 dígitos e nomes muito longos', () => {
      // CPF_CNPJ tem 20 caracteres: 20 dígitos cabem, 21 estouravam; nomes têm 60
      ['9'.repeat(20), '9'.repeat(21), 'a'.repeat(61), 'a'.repeat(500)].forEach((q) => {
        api.buscarClientes(storeId, q, TIMEOUT_BUSCA).then((res) => {
          exigirListaVazia(res, `/clients?q=(${q.length} caracteres)`);
        });
      });
    });

    it('22.4 Deve responder 200 com lista vazia nos catálogos de prescritores, laboratórios, cidades, funcionários, tipos de operação e filiais com termo de mais de 60 caracteres', () => {
      ['prescribers', 'laboratories', 'cities', 'employees', 'operation-types'].forEach((rota) => {
        [61, 300].forEach((tamanho) => {
          api.get(`/${rota}`, { q: 'a'.repeat(tamanho) }, TIMEOUT_BUSCA).then((res) => {
            exigirListaVazia(res, `/${rota}?q=(${tamanho} caracteres)`);
          });
        });
      });
      [61, 300].forEach((tamanho) => {
        api.get(`/branches`, { purpose: 'pickup', q: 'a'.repeat(tamanho) }, TIMEOUT_BUSCA).then((res) => {
          exigirListaVazia(res, `/branches?q=(${tamanho} caracteres)`);
        });
      });
    });

    it('22.5 Deve responder 200 com lista vazia nas buscas de bairros e formas farmacêuticas com termo de mais de 60 caracteres', () => {
      // Rotas aninhadas: o id da cidade e do laboratório vem da própria listagem (massa dinâmica, só leitura)
      api.get(`/cities`, { q: 'sao' }, TIMEOUT_BUSCA).then((res) => {
        const cidade = itensDe(res)[0];
        expect(cidade, '🔒 /cities?q=sao sem nenhuma cidade (massa)').to.exist;
        [61, 300].forEach((tamanho) => {
          api.listarBairros(storeId, cidade.id, { q: 'a'.repeat(tamanho) }, TIMEOUT_BUSCA).then((r) => {
            exigirListaVazia(r, `/neighborhoods?city_id=${cidade.id}&q=(${tamanho} caracteres)`);
          });
        });
      });
      api.get(`/laboratories`, {}, TIMEOUT_BUSCA).then((res) => {
        const laboratorio = itensDe(res)[0];
        expect(laboratorio, '🔒 /laboratories sem nenhum laboratório (massa)').to.exist;
        [61, 300].forEach((tamanho) => {
          api.get(`/laboratories/${laboratorio.id}/pharmaceutical-forms`, { q: 'a'.repeat(tamanho) }, TIMEOUT_BUSCA).then((r) => {
            exigirListaVazia(r, `/laboratories/${laboratorio.id}/pharmaceutical-forms?q=(${tamanho} caracteres)`);
          });
        });
      });
    });

    it('22.6 Deve responder 200 com lista vazia na busca da fila de atendimentos com termo muito longo ou telefone de mais dígitos que a coluna', () => {
      ['a'.repeat(61), 'a'.repeat(300), '9'.repeat(21), '9'.repeat(40)].forEach((search) => {
        api.listarAtendimentos(storeId, { status: 'waiting', search, page: 1, per_page: 20 }, TIMEOUT_BUSCA).then((res) => {
          exigirListaVazia(res, `/attendances?search=(${search.length} caracteres)`);
        });
      });
    });

    it('22.7 Deve continuar achando na fila e nos catálogos o registro buscado por um termo comum que cabe na coluna', () => {
      // Controle positivo do 22.3-22.6: o CAST não pode ter estreitado a busca normal (cenário 7 do roteiro de QA da issue)
      // Fila: o nome real do 1º atendimento listado, buscado por sua 1ª palavra, devolve o próprio atendimento
      const procurar = (status) => api.listarAtendimentos(storeId, { status, page: 1, per_page: 20 }, TIMEOUT_BUSCA).then((res) => {
        return itensDe(res).find((a) => String(a.customer_name || '').trim().split(/\s+/)[0].length >= 3);
      });
      procurar('waiting').then((achado) => (achado ? { status: 'waiting', att: achado } : procurar('finished').then((att) => ({ status: 'finished', att })))).then(({ status, att }) => {
        expect(att, '🔒 Nenhum atendimento Aguardando/Finalizado com nome de cliente de 3+ letras (massa)').to.exist;
        const primeiro = att.customer_name.trim().split(/\s+/)[0];
        api.listarAtendimentos(storeId, { status, search: primeiro, page: 1, per_page: 100 }, TIMEOUT_BUSCA).then((res) => {
          expect(res.status, `Status de search=${primeiro}`).to.eq(200);
          expect(itensDe(res).map((a) => a.id), `search="${primeiro}" deve achar o atendimento #${att.id}`).to.include(att.id);
        });
      });

      // Catálogos: termos comuns que a suíte já usa em 20.3 continuam achando registros
      [['cities', 'sao'], ['employees', 'jose'], ['prescribers', 'sao']].forEach(([rota, q]) => {
        api.get(`/${rota}`, { q }, TIMEOUT_BUSCA).then((res) => {
          expect(res.status, `Status de /${rota}?q=${q}`).to.eq(200);
          expect(itensDe(res).length, `/${rota}?q=${q} deve achar ao menos 1 registro`).to.be.at.least(1);
        });
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 48: PARÂMETRO OBRIGATÓRIO AUSENTE RESPONDE 400, NÃO 500
  // ---------------------------------------------------------------------------
  context('23. Parâmetro Obrigatório Ausente Responde 400, não 500 (Issue backend#640/PR #642)', () => {

    // O GlobalExceptionHandler não tratava MissingServletRequestParameterException/MissingServletRequestPartException: a falta de um parâmetro
    // obrigatório caía no handler genérico e a rota respondia 500 (visto no dev em 13/10 com o envio de mídia sem media_type). A PR #642 responde 400
    // com "Parâmetro obrigatório ausente: <nome>." e sem logar em ERROR. O envio é recusado antes do serviço: nada é gravado nem chega ao WhatsApp.
    // Medido em 2026-10-16 só nas rotas do envio de mídia. Ficam de fora (rota não confirmada pelo dev): busca de cliente sem `type` e preview de arquivo da IA sem `ids`.
    // O envio normal (cenário 3 do roteiro de QA) já é provado pelo 0-B ctx 17 a cada rodada, então não manda outra mensagem real aqui.
    const TIMEOUT_ROTA = { timeout: 90000 };
    const ARQUIVO = 'cypress/fixtures/5.atendimentos/anexos/normal/Anexo de teste txt.txt';
    let attendanceId;

    before(() => {
      // Qualquer atendimento serve: o parâmetro ausente é recusado antes de olhar o atendimento, a janela de 24h ou o atendente
      api.listarAtendimentos(storeId, { page: 1, per_page: 1 }, TIMEOUT_ROTA).then((res) => {
        const itens = (res.body && (res.body.items || res.body.data)) || [];
        expect(itens.length, '🔒 Nenhum atendimento na fila para endereçar o envio (massa)').to.be.at.least(1);
        attendanceId = itens[0].id;
      });
    });

    const exigirRecusaDeParametroAusente = (res, nome) => {
      expect(res.status, `Status do envio sem ${nome} (antes da PR #642 respondia 500)`).to.eq(400);
      expect(res.body.status, 'status no corpo').to.eq(400);
      expect(res.body.error, 'error no corpo').to.eq('Bad Request');
      expect(res.body.message, 'Mensagem da recusa').to.eq(`Parâmetro obrigatório ausente: ${nome}.`);
    };

    it('23.1 Deve recusar com 400 o envio de mídia com arquivo e sem media_type, sem responder 500', () => {
      api.enviarMidiaAtendimento(storeId, attendanceId, { filePath: ARQUIVO, fileName: 'sem-media-type.txt', mimeType: 'text/plain', mediaType: null }).then((res) => {
        exigirRecusaDeParametroAusente(res, 'media_type');
      });
    });

    it('23.2 Deve recusar com 400 o envio de mídia com media_type e sem o arquivo, sem responder 500', () => {
      // O arquivo vai numa parte de outro nome: do ponto de vista do servidor a parte `file` não existe (MissingServletRequestPartException)
      api.enviarMidiaAtendimento(storeId, attendanceId, { filePath: ARQUIVO, fileName: 'sem-file.txt', mimeType: 'text/plain', nomeCampoArquivo: 'arquivo_errado' }).then((res) => {
        exigirRecusaDeParametroAusente(res, 'file');
      });
    });

    it('23.3 Deve manter o 422 das rotas de documento da receita que já validam o parâmetro no serviço, sem virar 400', () => {
      // Fica de fora de propósito na PR #642: preview-urls sem `ids` valida no serviço e responde 422 (controle de que o handler novo não engoliu essa regra)
      api.listarPrescricoes(storeId, { filter: 'pending', page: 1, per_page: 1 }, TIMEOUT_ROTA).then((resLista) => {
        const itens = (resLista.body && (resLista.body.items || resLista.body.data)) || [];
        expect(itens.length, '🔒 Nenhuma receita para endereçar o preview (massa)').to.be.at.least(1);
        api.get(`/prescriptions/${itens[0].id}/documents/preview-urls`, {}, TIMEOUT_ROTA).then((res) => {
          expect(res.status, 'Status do preview de documento da receita sem ids').to.eq(422);
          expect(res.body.message, 'Mensagem do 422 do serviço').to.match(/identificadores/i);
        });
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 24: LOJA DE VENDA SEM ROTA, A CAPABILITY SAI SEMPRE FALSE E A BUSCA DE LOJAS SÓ ACEITA purpose=pickup (Issue backend#719/PR #731)
  // ---------------------------------------------------------------------------
  context('24. Loja de Venda sem Rota: can_update_registration_store Sai Sempre false e GET /branches só Aceita purpose=pickup (Issue backend#719/PR #731)', () => {

    // Sub-issue da #707. O grant 287 ("alterar a loja de venda") era anunciado como `can_update_registration_store: true`, mas nenhuma rota grava a loja de venda: o front
    // podia habilitar um campo que não salva. A PR #731 marcou o grant como sem rota (`hasRoute = false`): a capability sai sempre `false` e nada pode cobrá-lo; por isso a busca
    // de lojas com `purpose=registration`, que só servia para preencher esse campo, deixou de existir e responde 422 ("só pickup é válido").
    // Medido na dev em 2026-10-22: a conta de teste devolve `can_update_pickup_store: true` (grant 294) e quase todas as outras capabilities da receita `true`, e mesmo assim
    // `can_update_registration_store: false`. Não dá para provar pela API que a conta tem o grant 287 (o `/users/me` não lista grants), então o `false` aqui é o contrato, não
    // a ausência do grant. A escrita da loja de venda entra numa issue própria quando o produto pedir (nesse dia o build obriga a tirar a marcação).
    const TIMEOUT_ROTA = { timeout: 90000 };
    const MSG_PURPOSE = 'O parâmetro purpose é obrigatório e deve ser pickup.';

    it('24.1 Deve devolver can_update_registration_store sempre false nas capabilities da receita, enquanto a loja de retirada segue booleana', () => {
      api.obterCapabilitiesReceitas(storeId, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status das capabilities de prescrição').to.eq(200);
        const capabilities = res.body.capabilities;
        expect(capabilities, 'A chave da loja de venda segue anunciada, agora fixa em false').to.have.property('can_update_registration_store', false);
        // A loja de retirada (grant 294) continua anunciada: só a loja de venda ficou sem rota
        expect(capabilities.can_update_pickup_store, 'can_update_pickup_store segue booleana').to.be.a('boolean');
      });
    });

    it('24.2 Deve recusar com 422 INVALID_CONTEXT o GET /branches com purpose=registration e com qualquer valor que não seja pickup', () => {
      ['registration', 'abc', 'PICKUP', ''].forEach((purpose) => {
        api.get('/branches', { purpose, q: 'filial' }, { ...TIMEOUT_ROTA, failOnStatusCode: false }).then((res) => {
          expect(res.status, `Status do GET /branches com purpose=${JSON.stringify(purpose)}`).to.eq(422);
          expect(res.body.code, `code do GET /branches com purpose=${JSON.stringify(purpose)}`).to.eq('INVALID_CONTEXT');
          expect(res.body.message, `Mensagem do GET /branches com purpose=${JSON.stringify(purpose)}`).to.eq(MSG_PURPOSE);
        });
      });
    });

    it('24.3 Deve continuar aceitando o GET /branches com purpose=pickup, sem o purpose antigo e sem 5xx', () => {
      api.listarFiliais(storeId, 'pickup', TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status do GET /branches com purpose=pickup').to.eq(200);
        const itens = Array.isArray(res.body) ? res.body : res.body.items;
        expect(itens, 'A lista de filiais para retirada').to.be.an('array');
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 25: CONSULTA DE CEP PELA CEP-API (Issue backend#751/PR #752 e #753)
  // ---------------------------------------------------------------------------
  context('25. Consulta de CEP pela cep-api: Validação, Resolução de Cidade e Bairro pelo Catálogo e Erros (Issue backend#751/PR #752 e #753)', () => {

    // `GET /zip-codes?zip_code=<CEP>` (LocationCatalogController, junto com /cities e /neighborhoods) consulta a cep-api interna (ViaCEP, BrasilAPI e AwesomeAPI, cache de 30 dias) e devolve o endereço já resolvido para o legado:
    // `city.id` e `neighborhood.id` são os códigos do catálogo que o formulário de endereço grava, preenchidos só quando EXATAMENTE uma linha casa (IBGE > 0 e único; senão nome + UF sem acento; o bairro dentro da cidade resolvida); senão `null`, com o nome da cep-api.
    // Só pede o token: sem grant, sem resource gate e sem o prefixo /stores/:id. Medido na API real em 2026-10-22: 400 "CEP inválido: informe 8 dígitos." (7 e 9 dígitos, letra, sem o parâmetro e vazio), 404 "CEP não encontrado.", 401 sem token, 404 em /stores/:id/zip-codes.
    // `logradouro`, `complemento` e `bairro` dependem do provedor que respondeu primeiro: os testes tipam como `string` ou `null` e não afirmam o texto. `fonte`, `cache` e `ibge` não saem. O catálogo é dado vivo do tenant: a resolução é conferida contra o próprio catálogo lido na hora, não contra ID fixo.
    // Sem teste (`ROADMAP.md` P2-36): o 503 (cep-api fora do ar, timeout ou chave recusada; não dá para provocar na dev), "qualquer perfil sem permissão" (a conta de teste é uma só) e o bairro repetido na mesma cidade (sem CEP conhecido). A tela de CEP da ficha do cliente é do `7.clientes` (Issue front#616).
    const TIMEOUT_ROTA = { timeout: 90000 };
    const TOLERA_RECUSA = { timeout: 90000, failOnStatusCode: false };
    const CEP_PRACA_DA_SE = '01001000'; // São Paulo/SP: cidade e bairro únicos no catálogo
    const CEP_JANDAIA_GO = '75950000'; // Jandaia/GO: 2 linhas no catálogo; CEP único, sem logradouro nem bairro
    const CEP_SARANDI_PR = '99999999'; // Sarandi/PR: fora do catálogo
    const CEP_ACREUNA_GO = '75960000'; // Acreúna/GO: cidade única, CEP único, sem bairro
    const CEP_INEXISTENTE = '00000000';
    const MSG_CEP_INVALIDO = 'CEP inválido: informe 8 dígitos.';
    const CHAVES_DA_RESPOSTA = ['zip_code', 'street', 'complement', 'neighborhood', 'city'];

    const semAcento = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
    const textoOuNulo = (valor) => valor === null || typeof valor === 'string';
    const consultar = (cep, options = TOLERA_RECUSA) => api.consultarCep(cep, options);
    const consultarOk = (cep, rotulo) => consultar(cep, TIMEOUT_ROTA).then((res) => {
      expect(res.status, `Status da consulta do CEP ${rotulo}`).to.eq(200);
      return res.body;
    });
    const listaDe = (res) => (Array.isArray(res.body) ? res.body : res.body.items);
    // Linhas do catálogo de cidades com o nome e a UF dados (a busca ignora acento e caixa)
    const linhasDaCidade = (nome, uf) => api.listarCidades(storeId, { q: nome }, TIMEOUT_ROTA).then((res) => {
      expect(res.status, `Status da busca da cidade ${nome}`).to.eq(200);
      return listaDe(res).filter((c) => c.state === uf && semAcento(c.name) === semAcento(nome));
    });

    it('25.1 Deve recusar com 400 o CEP com 7 ou 9 dígitos, com letra, ausente ou vazio, com a mensagem do backend', () => {
      ['0100100', '010010000', '01OO1000', '', undefined].forEach((cep) => {
        consultar(cep).then((res) => {
          const rotulo = cep === undefined ? 'sem o parâmetro zip_code' : `zip_code="${cep}"`;
          expect(res.status, `Status de ${rotulo}`).to.eq(400);
          expect(res.body.error, `error de ${rotulo}`).to.eq('Bad Request');
          expect(res.body.message, `Mensagem de ${rotulo}`).to.eq(MSG_CEP_INVALIDO);
          expect(res.body, `Corpo de ${rotulo} sem endereço`).to.not.have.property('zip_code');
        });
      });
    });

    it('25.2 Deve devolver a mesma resposta com e sem hífen, só com as 5 chaves da issue (sem fonte, cache nem ibge) e os campos nulos aceitos', () => {
      consultarOk('01001-000', 'com hífen').then((comHifen) => {
        consultarOk(CEP_PRACA_DA_SE, 'sem hífen').then((semHifen) => {
          expect(comHifen, 'A resposta com hífen é igual à sem hífen').to.deep.eq(semHifen);
          expect(semHifen.zip_code, 'zip_code normalizado, sem hífen').to.eq(CEP_PRACA_DA_SE);
          expect(Object.keys(semHifen), 'Chaves da resposta').to.have.members(CHAVES_DA_RESPOSTA);
          expect(semHifen, 'fonte, cache e ibge não saem').to.not.have.any.keys('fonte', 'cache', 'ibge');
          expect(semHifen.street === null || typeof semHifen.street === 'string', 'street é texto ou nulo').to.eq(true);
          expect(semHifen.complement === null || typeof semHifen.complement === 'string', 'complement é texto ou nulo').to.eq(true);
          expect(Object.keys(semHifen.city), 'Chaves da cidade').to.have.members(['id', 'name', 'state']);
          expect(semHifen.city.name, 'Cidade sempre preenchida').to.be.a('string').and.not.be.empty;
          expect(semHifen.city.state, 'UF da cidade').to.eq('SP');
          expect(semHifen.neighborhood, 'Bairro é objeto com id e name ou nulo').to.be.an('object');
          expect(Object.keys(semHifen.neighborhood), 'Chaves do bairro').to.have.members(['id', 'name']);
        });
      });
    });

    it('25.3 Deve resolver a cidade e o bairro do 01001000 para linhas do catálogo, com o nome do catálogo', () => {
      consultarOk(CEP_PRACA_DA_SE, 'da Praça da Sé').then(({ city, neighborhood }) => {
        expect(city.id, '🔒 massa: São Paulo/SP com uma única linha no catálogo resolve city.id').to.be.a('number');
        expect(neighborhood.id, '🔒 massa: bairro da Sé único dentro de São Paulo resolve neighborhood.id').to.be.a('number');
        api.listarCidades(storeId, { q: city.name }, TIMEOUT_ROTA).then((res) => {
          const linha = listaDe(res).find((c) => c.id === city.id);
          expect(linha, `Linha ${city.id} no catálogo de cidades`).to.be.ok;
          expect(linha.name, 'O nome da cidade vem do catálogo').to.eq(city.name);
          expect(linha.state, 'UF do catálogo').to.eq(city.state);
        });
        api.listarBairros(storeId, city.id, { q: neighborhood.name }, TIMEOUT_ROTA).then((res) => {
          const linha = listaDe(res).find((b) => b.id === neighborhood.id);
          expect(linha, `Linha ${neighborhood.id} no catálogo de bairros da cidade ${city.id}`).to.be.ok;
          expect(linha.name, 'O nome do bairro vem do catálogo').to.eq(neighborhood.name);
        });
      });
    });

    it('25.4 Deve devolver city.id nulo e o nome da cep-api na cidade repetida (Jandaia/GO) e na cidade fora do catálogo (Sarandi/PR)', () => {
      consultarOk(CEP_JANDAIA_GO, 'de Jandaia/GO').then(({ city, neighborhood }) => {
        linhasDaCidade('JANDAIA', 'GO').then((linhas) => {
          expect(linhas.length, '🔒 massa: Jandaia/GO repetida no catálogo (a API não escolhe uma das linhas)').to.be.greaterThan(1);
        });
        expect(city.id, 'Cidade ambígua não resolve').to.eq(null);
        expect(semAcento(city.name), 'O nome vem da cep-api').to.eq('JANDAIA');
        expect(city.state, 'UF da cep-api').to.eq('GO');
        expect(neighborhood, 'Sem bairro na cep-api').to.eq(null);
      });
      consultarOk(CEP_SARANDI_PR, 'de Sarandi/PR').then(({ city, neighborhood }) => {
        linhasDaCidade('SARANDI', 'PR').then((linhas) => {
          expect(linhas.length, '🔒 massa: Sarandi/PR fora do catálogo').to.eq(0);
        });
        expect(city.id, 'Cidade fora do catálogo não resolve').to.eq(null);
        expect(semAcento(city.name), 'O nome vem da cep-api').to.eq('SARANDI');
        expect(city.state, 'UF da cep-api').to.eq('PR');
        expect(neighborhood.id, 'Sem cidade resolvida o bairro também não resolve').to.eq(null);
        expect(neighborhood.name, 'O bairro vem com o nome da cep-api').to.be.a('string').and.not.be.empty;
      });
    });

    it('25.5 Deve devolver neighborhood nulo no CEP único de uma cidade pequena, com a cidade resolvida e os campos de endereço nulos ou texto', () => {
      consultarOk(CEP_ACREUNA_GO, 'de Acreúna/GO').then((corpo) => {
        expect(corpo.neighborhood, 'CEP de cidade única não tem bairro').to.eq(null);
        expect(textoOuNulo(corpo.street), 'street é texto ou nulo').to.eq(true);
        expect(textoOuNulo(corpo.complement), 'complement é texto ou nulo').to.eq(true);
        expect(corpo.city.id, '🔒 massa: Acreúna/GO resolve city.id no catálogo').to.be.a('number');
        expect(semAcento(corpo.city.name), 'Cidade do catálogo').to.eq('ACREUNA');
        expect(corpo.city.state, 'UF').to.eq('GO');
      });
    });

    it('25.6 Deve responder 404 "CEP não encontrado." para um CEP que não existe', () => {
      consultar(CEP_INEXISTENTE).then((res) => {
        expect(res.status, 'Status do CEP inexistente').to.eq(404);
        expect(res.body.error, 'error do 404').to.eq('Not Found');
        expect(res.body.message, 'Mensagem do 404').to.eq('CEP não encontrado.');
        expect(res.body, 'Corpo do 404 sem endereço').to.not.have.property('zip_code');
      });
    });

    it('25.7 Deve recusar com 401 a consulta de CEP sem token', () => {
      consultar(CEP_PRACA_DA_SE, { ...TOLERA_RECUSA, headers: { Authorization: '' } }).then((res) => {
        expect(res.status, 'Status sem token').to.eq(401);
        expect(res.body, 'Corpo sem endereço').to.not.have.property('zip_code');
      });
    });

    it('25.8 Deve responder 404 na rota com o prefixo da loja, porque a consulta de CEP só existe sem /stores/:id', () => {
      api.get(`/stores/${storeId}/zip-codes`, { zip_code: CEP_PRACA_DA_SE }, TOLERA_RECUSA).then((res) => {
        expect(res.status, 'Status de /stores/:id/zip-codes').to.eq(404);
        expect(res.body, 'Corpo sem endereço').to.not.have.property('zip_code');
      });
    });

  });

  context('26. Revenda: Edição do Cabeçalho (PATCH /resales/:id), Campos Editáveis, Valor Igual sem Gravar e Recusas 422, 404 e 401 (Issue backend#782/PR #771)', () => {

    // `PATCH /resales/:id` (backend#782/PR #771, sub-issue da #27) edita o cabeçalho da revenda: comprador, prescritor, tipo de operação, setor, comissionado, comissão, loja de retirada e vínculo omni.
    // Só o campo que muda de valor conta: mandar o valor já gravado não exige grant e não grava (`updated_at` não se mexe). `patient_id` e qualquer campo fora da lista recusam com 422; comprador e prescritor não podem ser limpos.
    // Exige o recurso contratado `resale` (sem ele todas as rotas respondem 403 RESOURCE_NOT_ENTITLED, medido em 2026-10-27 antes da ativação) e a 232 (alterar) da conta. Medido na API real em 2026-10-27 com o recurso ativo.
    // A revenda não tem DELETE: cada rodada cria 1 revenda aberta (`POST /resales`, só `patient_id` e `prescriber_id`) e edita só ela; nunca mexe nas revendas existentes. Os testes não dependem da ordem entre si.
    // Sem teste (`ROADMAP.md` P1-53): a escada de grants (302 concluída, 663 finalizada, 260 outra loja, 328, 293, 327, 339, 326), porque a conta de teste é uma só e tem todos; o vínculo com atendimento (599, 640, 689) e o cabeçalho de revenda com financeiro, que gravam em massa de terceiros; `409 RESALE_BUSY` e `RESALE_WRITE_NOT_APPLIED`, que só ocorrem com concorrência.
    const TIMEOUT_ROTA = { timeout: 90000 };
    const TOLERA_RECUSA = { timeout: 90000, failOnStatusCode: false };
    const PRESCRITOR_NAO_INFORMADO = 9999999; // cadastro genérico "MEDICO NÃO INFORMADO", escolhido na tela (não há prescritor padrão)
    const PRESCRITOR_GENERICO = 9629; // outro cadastro genérico do dev, destino das trocas
    const LOJA_DE_RETIRADA_OUTRA = 2;
    const REVENDA_INEXISTENTE = 999999999;
    const DETALHE_INTERNO = /SQLSTATE|Firebird|Exception|An unexpected error|numeric value|string right truncation/i;

    let revendaId = null;
    let cliente = null;

    const detalhe = () => api.obterDetalheRevenda(revendaId, TIMEOUT_ROTA).then((res) => {
      expect(res.status, `Status do detalhe da revenda de teste #${revendaId}`).to.eq(200);
      return res.body;
    });
    const exigirRecusa = (res, status, mensagem, rotulo) => {
      expect(res.status, `Status de ${rotulo}`).to.eq(status);
      expect(res.body.message, `Mensagem de ${rotulo}`).to.eq(mensagem);
      expect(JSON.stringify(res.body), `A resposta de ${rotulo} não pode expor detalhe interno`).not.to.match(DETALHE_INTERNO);
    };
    // Recusa: o status e a mensagem certos e a revenda exatamente como estava (nada gravado)
    const exigirPatchRecusado = (corpo, status, mensagem, rotulo) => detalhe().then((antes) => {
      api.atualizarRevenda(revendaId, corpo, TOLERA_RECUSA).then((res) => exigirRecusa(res, status, mensagem, rotulo));
      detalhe().then((depois) => {
        expect(depois, `A revenda não pode mudar após ${rotulo}`).to.deep.eq(antes);
      });
    });

    before(() => {
      // Cliente padrão do env.json (R-POM) como paciente; o comprador nasce igual ao paciente
      api.buscarClientes(storeId, configEnv.DEFAULT_CLIENT_NAME || 'klismam').then((resCli) => {
        cliente = (resCli.body && (resCli.body.items || resCli.body))[0];
        expect(cliente && cliente.id, '🔒 DEFAULT_CLIENT_NAME não achou cliente (massa)').to.be.ok;
        api.criarRevenda({ patient_id: cliente.id, prescriber_id: PRESCRITOR_NAO_INFORMADO }, TIMEOUT_ROTA).then((res) => {
          expect(res.status, 'Status da criação da revenda de teste (exige o recurso resale e a 232)').to.eq(201);
          revendaId = res.body.id;
          expect(revendaId, 'ID da revenda de teste').to.be.ok;
          expect(res.body.status, 'A revenda de teste nasce aberta (orçamento)').to.eq(0);
          expect(res.body.buyer_id, 'O comprador nasce igual ao paciente').to.eq(cliente.id);
        });
      });
    });

    it('26.1 Deve trocar o prescritor da revenda aberta com 200, persistir e gravar o usuário da sessão em updated_by', () => {
      api.atualizarRevenda(revendaId, { prescriber_id: PRESCRITOR_GENERICO }, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status do PATCH do prescritor').to.eq(200);
        expect(res.body.prescriber_id, 'Prescritor na resposta do PATCH').to.eq(PRESCRITOR_GENERICO);
      });
      detalhe().then((det) => {
        expect(det.prescriber_id, 'Prescritor persistido no detalhe').to.eq(PRESCRITOR_GENERICO);
        expect(det.updated_by, 'updated_by é o usuário da sessão (o log de eventos do Desktop mostra a alteração como dele)').to.eq(loggedUserId);
        expect(det.status, 'A revenda continua aberta').to.eq(0);
      });
    });

    it('26.2 Deve trocar a loja de retirada e desmarcar o pagamento de comissão ao funcionário no mesmo PATCH, e persistir os dois', () => {
      api.atualizarRevenda(revendaId, { pickup_store_id: LOJA_DE_RETIRADA_OUTRA, pay_employee_commission: false }, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status do PATCH da loja de retirada e da comissão').to.eq(200);
        expect(res.body.pickup_store_id, 'Loja de retirada na resposta').to.eq(LOJA_DE_RETIRADA_OUTRA);
        expect(res.body.pay_employee_commission, 'Pagamento de comissão na resposta').to.eq(false);
      });
      detalhe().then((det) => {
        expect(det.pickup_store_id, 'Loja de retirada persistida').to.eq(LOJA_DE_RETIRADA_OUTRA);
        expect(det.pay_employee_commission, 'Pagamento de comissão persistido').to.eq(false);
      });
    });

    it('26.3 Deve trocar o funcionário comissionado pelo da sessão e persistir', () => {
      api.atualizarRevenda(revendaId, { commissioned_employee_id: loggedUserId }, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status do PATCH do comissionado (a conta tem a 327 e a 339)').to.eq(200);
        expect(res.body.commissioned_employee_id, 'Comissionado na resposta').to.eq(loggedUserId);
      });
      detalhe().then((det) => {
        expect(det.commissioned_employee_id, 'Comissionado persistido').to.eq(loggedUserId);
      });
    });

    it('26.4 Não deve gravar quando o valor enviado é o que já está na revenda: 200 com updated_at e todos os campos iguais', () => {
      api.atualizarRevenda(revendaId, { prescriber_id: PRESCRITOR_GENERICO }, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status do PATCH que garante o estado de partida').to.eq(200);
      });
      detalhe().then((antes) => {
        api.atualizarRevenda(revendaId, { prescriber_id: PRESCRITOR_GENERICO }, TIMEOUT_ROTA).then((res) => {
          expect(res.status, 'Status do PATCH com o valor já gravado').to.eq(200);
          expect(res.body.updated_at, 'updated_at na resposta não muda').to.eq(antes.updated_at);
        });
        detalhe().then((depois) => {
          expect(depois, 'Nada é gravado quando o valor é o mesmo').to.deep.eq(antes);
        });
      });
    });

    it('26.5 Deve recusar com 422 o PATCH sem nenhum campo, sem alterar a revenda', () => {
      exigirPatchRecusado({}, 422, 'Nenhum campo válido para atualização.', 'PATCH com corpo vazio');
    });

    it('26.6 Deve recusar com 422 a troca do paciente, sem alterar a revenda', () => {
      exigirPatchRecusado({ patient_id: cliente.id }, 422, 'O paciente da revenda não pode ser alterado.', 'PATCH com patient_id');
    });

    it('26.7 Deve recusar com 422 o campo que a rota não aceita (preço e campo desconhecido), sem alterar a revenda', () => {
      exigirPatchRecusado({ sale_value: 1 }, 422, 'O campo sale_value não pode ser alterado nesta rota.', 'PATCH com sale_value');
      exigirPatchRecusado({ campo_desconhecido: 1 }, 422, 'O campo campo_desconhecido não pode ser alterado nesta rota.', 'PATCH com campo desconhecido');
    });

    it('26.8 Deve recusar com 422 limpar o comprador ou o prescritor, sem alterar a revenda', () => {
      exigirPatchRecusado({ buyer_id: null }, 422, 'Comprador obrigatório.', 'PATCH com buyer_id nulo');
      exigirPatchRecusado({ prescriber_id: null }, 422, 'Prescritor obrigatório.', 'PATCH com prescriber_id nulo');
    });

    it('26.9 Deve responder 404 para revenda inexistente e para o caminho antigo com /stores/:id, e 401 sem token, sem gravar nada', () => {
      detalhe().then((antes) => {
        api.atualizarRevenda(REVENDA_INEXISTENTE, { prescriber_id: PRESCRITOR_GENERICO }, TOLERA_RECUSA).then((res) => {
          exigirRecusa(res, 404, 'Revenda não encontrada.', 'PATCH da revenda inexistente');
        });
        api.patch(`/stores/${storeId}/resales/${revendaId}`, { prescriber_id: PRESCRITOR_NAO_INFORMADO }, TOLERA_RECUSA).then((res) => {
          expect(res.status, 'Status do PATCH no caminho antigo com /stores/:id').to.eq(404);
        });
        api.atualizarRevenda(revendaId, { prescriber_id: PRESCRITOR_NAO_INFORMADO }, { ...TOLERA_RECUSA, headers: { Authorization: '' } }).then((res) => {
          expect(res.status, 'Status do PATCH sem token').to.eq(401);
        });
        detalhe().then((depois) => {
          expect(depois, 'A revenda não pode mudar após as três recusas').to.deep.eq(antes);
        });
      });
    });

  });

  context('27. Revenda: Leitura do Detalhe e das Capabilities, Criação (POST /resales) e Recusas 422, 404 e 401 (Issue backend#780/PR #768 e backend#781/PR #771)', () => {

    // Guarda da massa (P1-54 onda 4): antes de qualquer outro hook, para não criar revenda quando a massa fixa derivou
    before(function () { conferirMassaRevenda(this, ['REVENDA_ABERTA', 'REVENDA_CONCLUIDA_SEM_FINANCEIRO', 'REVENDA_COM_FINANCEIRO', 'CODIGO_DE_RECEITA']); });

    // `GET /resale-capabilities` e `GET /resales/:id` (backend#780/PR #768) e `POST /resales` (backend#781/PR #771), sub-issues da #27: leitura do cabeçalho com produtos e criação do orçamento de balcão aberto.
    // Exigem o recurso contratado `resale` (sem ele respondem 403 RESOURCE_NOT_ENTITLED antes de qualquer validação, medido em 2026-10-27 antes da ativação) e leem a loja do token: o caminho antigo com /stores/:id responde 404.
    // As revendas lidas são reais e ficam em `massaRevenda.js` (fonte única). A revenda não tem DELETE: o `27.8` cria 1 revenda aberta por rodada (somando a do `before` do context 26, são 2 por execução do arquivo) e nunca edita as existentes.
    // Sem teste (`ROADMAP.md` P1-53): a escada de grants do `can_update` (302 concluída, 663 finalizada, 260 outra loja), o `cost_value` nulo sem a 401, a conta sem grant (tudo false, nunca 403) e o 403 do POST sem a 232, porque a conta de teste é uma só e tem todos; o vínculo com atendimento (599, 409 ATTENDANCE_CLOSED e ATTENDANCE_UNASSIGNED), que grava em massa de terceiros.
    const massaRevenda = require('../fixtures/0.backend/massaRevenda');
    const TIMEOUT_ROTA = { timeout: 90000 };
    const TOLERA_RECUSA = { timeout: 90000, failOnStatusCode: false };
    const PRESCRITOR_NAO_INFORMADO = 9999999; // cadastro genérico "MEDICO NÃO INFORMADO", escolhido na tela (não há prescritor padrão)
    const PACIENTE_INEXISTENTE = 999999999;
    const CHAVES_CAPABILITIES = [
      'can_create', 'can_update', 'can_add_product', 'can_update_product', 'can_remove_product', 'can_update_operation_type',
      'can_update_sales_sector', 'can_update_commissioned_employee', 'can_update_commissioned_other_store', 'can_update_pickup_store', 'can_view_cost'
    ];
    const CHAVES_CAPABILITIES_DETALHE = ['can_update', 'can_add_product', 'can_update_product', 'can_remove_product'];
    const DETALHE_INTERNO = /SQLSTATE|Firebird|Exception|An unexpected error|numeric value|string right truncation/i;

    const lerDetalhe = (resaleId, rotulo) => api.obterDetalheRevenda(resaleId, TIMEOUT_ROTA).then((res) => {
      expect(res.status, `Status do detalhe da ${rotulo} #${resaleId}`).to.eq(200);
      return res.body;
    });
    const exigirRecusa = (res, status, mensagem, rotulo) => {
      expect(res.status, `Status de ${rotulo}`).to.eq(status);
      expect(res.body.message, `Mensagem de ${rotulo}`).to.eq(mensagem);
      expect(JSON.stringify(res.body), `A resposta de ${rotulo} não pode expor detalhe interno`).not.to.match(DETALHE_INTERNO);
    };

    it('27.1 Deve devolver as onze capabilities da revenda como booleanos, sem 403, pelo caminho sem /stores/:id', () => {
      api.obterCapabilitiesRevenda(TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status de GET /resale-capabilities').to.eq(200);
        expect(res.body.capabilities, 'Bloco capabilities').to.be.an('object');
        expect(Object.keys(res.body.capabilities), 'As onze chaves, nem mais nem menos').to.have.members(CHAVES_CAPABILITIES);
        CHAVES_CAPABILITIES.forEach((chave) => {
          expect(res.body.capabilities[chave], `capabilities.${chave}`).to.be.a('boolean');
        });
        expect(res.body.capabilities.can_create, 'A conta de teste tem a 232 (gravar), a mesma que o POST exige').to.eq(true);
      });
    });

    it('27.2 Deve devolver o detalhe da revenda aberta da loja 1 com cabeçalho, o produto com lote e as quatro capabilities', () => {
      const aberta = massaRevenda.REVENDA_ABERTA;
      lerDetalhe(aberta.id, 'revenda aberta').then((det) => {
        expect(det.id, 'id').to.eq(aberta.id);
        expect(det.status, 'Orçamento aberto').to.eq(0);
        expect(det.store_id, 'Loja do token').to.eq(storeId);
        expect(det.patient_id, 'patient_id').to.eq(aberta.patient_id);
        expect(det.prescriber_id, 'prescriber_id').to.eq(aberta.prescriber_id);
        expect(det.attendance_id, 'Atendimento omni vinculado').to.eq(aberta.attendance_id);
        expect(det.financial_id, 'Aberta sem financeiro').to.eq(null);
        expect(det.products, 'Produtos vivos da revenda').to.be.an('array').with.length.greaterThan(0);
        const produto = det.products[0];
        expect(produto.lot, 'Lote do produto').to.include.all.keys('id', 'number', 'expires_on');
        ['quantity', 'unit_sale_value', 'sale_value'].forEach((campo) => {
          expect(produto[campo], `products[0].${campo}`).to.be.a('number');
        });
        // Cenário 7 do roteiro (backend#780) no padrão R-CAPXACAO: o custo segue o grant 401 lido em `can_view_cost`, no cabeçalho e em todos os produtos
        cy.then(() => api.obterCapabilitiesRevenda(TIMEOUT_ROTA)).then((resCaps) => {
          const veCusto = resCaps.body.capabilities.can_view_cost;
          expect(veCusto, 'can_view_cost (grant 401)').to.be.a('boolean');
          const conferir = (valor, rotulo) => (veCusto
            ? expect(valor, `${rotulo}: com a 401 o custo vem preenchido`).to.be.a('number')
            : expect(valor, `${rotulo}: sem a 401 o custo vem nulo`).to.eq(null));
          conferir(det.cost_value, 'cost_value do cabeçalho');
          det.products.forEach((p, i) => conferir(p.cost_value, `products[${i}].cost_value`));
        });
        expect(Object.keys(det.capabilities), 'Quatro capabilities no detalhe').to.have.members(CHAVES_CAPABILITIES_DETALHE);
        CHAVES_CAPABILITIES_DETALHE.forEach((chave) => {
          expect(det.capabilities[chave], `capabilities.${chave} da revenda aberta (a conta tem a 232 e a 329)`).to.eq(true);
        });
      });
    });

    it('27.3 Deve devolver a revenda concluída sem financeiro com status -1 e sem financial_id', () => {
      lerDetalhe(massaRevenda.REVENDA_CONCLUIDA_SEM_FINANCEIRO, 'revenda concluída').then((det) => {
        expect(det.status, 'Revenda concluída').to.eq(-1);
        expect(det.financial_id, 'Concluída sem financeiro').to.eq(null);
        expect(det.products, 'Produtos da concluída').to.be.an('array').with.length.greaterThan(0);
        // Cenário 4 do roteiro (backend#780): na concluída, `can_update` exige a 232 e a 302; a conta de teste tem as duas (confirmado pelo dev em 2026-11-06).
        // A 302 não aparece em nenhuma capability, então o lado sem ela (false) fica como gap aceito (P1-53, conta única)
        expect(det.capabilities.can_update, 'can_update da concluída (a conta tem a 232 e a 302)').to.eq(true);
      });
    });

    it('27.4 Deve sair false nas três chaves de produto da revenda com financeiro, mesmo com todos os grants da conta', () => {
      lerDetalhe(massaRevenda.REVENDA_COM_FINANCEIRO, 'revenda com financeiro').then((det) => {
        expect(det.financial_id, 'Revenda com financeiro').to.be.a('number');
        ['can_add_product', 'can_update_product', 'can_remove_product'].forEach((chave) => {
          expect(det.capabilities[chave], `capabilities.${chave} com financeiro`).to.eq(false);
        });
      });
    });

    it('27.5 Deve responder 404 "Revenda não encontrada." para o código de uma receita e para um código inexistente', () => {
      api.obterDetalheRevenda(massaRevenda.CODIGO_DE_RECEITA, TOLERA_RECUSA).then((res) => {
        exigirRecusa(res, 404, 'Revenda não encontrada.', 'GET do código de receita');
      });
      api.obterDetalheRevenda(massaRevenda.CODIGO_INEXISTENTE, TOLERA_RECUSA).then((res) => {
        exigirRecusa(res, 404, 'Revenda não encontrada.', 'GET do código inexistente');
      });
    });

    it('27.6 Deve responder 404 nas três rotas pelo caminho antigo com /stores/:id', () => {
      api.get(`/stores/${storeId}/resales/${massaRevenda.REVENDA_ABERTA.id}`, {}, TOLERA_RECUSA).then((res) => {
        expect(res.status, 'Status de GET /stores/:id/resales/:id').to.eq(404);
      });
      api.get(`/stores/${storeId}/resale-capabilities`, {}, TOLERA_RECUSA).then((res) => {
        expect(res.status, 'Status de GET /stores/:id/resale-capabilities').to.eq(404);
      });
      api.post(`/stores/${storeId}/resales`, {}, TOLERA_RECUSA).then((res) => {
        expect(res.status, 'Status de POST /stores/:id/resales').to.eq(404);
      });
    });

    it('27.7 Deve responder 401 sem token no detalhe, nas capabilities e na criação', () => {
      const semToken = { ...TOLERA_RECUSA, headers: { Authorization: '' } };
      api.obterDetalheRevenda(massaRevenda.REVENDA_ABERTA.id, semToken).then((res) => {
        expect(res.status, 'Status de GET /resales/:id sem token').to.eq(401);
      });
      api.obterCapabilitiesRevenda(semToken).then((res) => {
        expect(res.status, 'Status de GET /resale-capabilities sem token').to.eq(401);
      });
      api.criarRevenda({ patient_id: massaRevenda.REVENDA_ABERTA.patient_id, prescriber_id: PRESCRITOR_NAO_INFORMADO }, semToken).then((res) => {
        expect(res.status, 'Status de POST /resales sem token').to.eq(401);
      });
    });

    it('27.8 Deve criar a revenda aberta com os valores padrão (comprador igual ao paciente, loja de retirada da sessão, comissão ligada, totais zerados) e devolver o mesmo no detalhe', () => {
      // Cliente padrão do env.json (R-POM) como paciente
      api.buscarClientes(storeId, configEnv.DEFAULT_CLIENT_NAME).then((resCli) => {
        const cliente = (resCli.body && (resCli.body.items || resCli.body))[0];
        expect(cliente && cliente.id, '🔒 DEFAULT_CLIENT_NAME não achou cliente (massa)').to.be.ok;
        api.criarRevenda({ patient_id: cliente.id, prescriber_id: PRESCRITOR_NAO_INFORMADO }, TIMEOUT_ROTA).then((res) => {
          expect(res.status, 'Status de POST /resales (exige o recurso resale e a 232)').to.eq(201);
          const criada = res.body;
          expect(criada.id, 'Código da revenda criada').to.be.a('number');
          expect(criada.status, 'Nasce como orçamento aberto').to.eq(0);
          expect(criada.sale_type, 'Venda de balcão').to.eq(0);
          expect(criada.store_id, 'Loja do token').to.eq(storeId);
          expect(criada.patient_id, 'patient_id').to.eq(cliente.id);
          expect(criada.buyer_id, 'O comprador nasce igual ao paciente').to.eq(cliente.id);
          expect(criada.prescriber_id, 'prescriber_id').to.eq(PRESCRITOR_NAO_INFORMADO);
          expect(criada.pickup_store_id, 'A loja de retirada nasce a da sessão').to.eq(storeId);
          expect(criada.pay_employee_commission, 'Comissão ligada').to.eq(true);
          expect(criada.attendance_id, 'Sem atendimento vinculado').to.eq(null);
          expect(criada.financial_id, 'Sem financeiro').to.eq(null);
          expect(criada.dav_number, 'Número do DAV vindo do trigger').to.be.a('number').and.to.be.greaterThan(0);
          expect(criada.sale_value, 'Total zerado').to.eq(0);
          expect(criada.products, 'Sem produtos').to.deep.eq([]);
          // Tipo de operação, setor e comissionado vêm do cadastro do funcionário: a chave existe, o valor depende do cadastro
          expect(criada, 'Chaves do cadastro do funcionário').to.include.all.keys('operation_type_id', 'sales_sector_id', 'commissioned_employee_id');
          lerDetalhe(criada.id, 'revenda criada').then((det) => {
            expect(det, 'O detalhe devolve o mesmo que o POST').to.deep.eq(criada);
          });
        });
      });
    });

    it('27.9 Deve recusar com 422 o POST sem paciente e sem prescritor, cada um com a sua mensagem', () => {
      api.criarRevenda({ prescriber_id: PRESCRITOR_NAO_INFORMADO }, TOLERA_RECUSA).then((res) => {
        exigirRecusa(res, 422, 'Paciente obrigatório.', 'POST sem patient_id');
      });
      api.criarRevenda({ patient_id: massaRevenda.REVENDA_ABERTA.patient_id }, TOLERA_RECUSA).then((res) => {
        exigirRecusa(res, 422, 'Prescritor obrigatório.', 'POST sem prescriber_id');
      });
    });

    it('27.10 Deve recusar com 422 o POST com paciente inexistente', () => {
      api.criarRevenda({ patient_id: PACIENTE_INEXISTENTE, prescriber_id: PRESCRITOR_NAO_INFORMADO }, TOLERA_RECUSA).then((res) => {
        exigirRecusa(res, 422, 'Paciente não encontrado.', 'POST com paciente inexistente');
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 28: REVENDA, INCLUSÃO DE PRODUTO (POST /resales/:id/products)
  // ---------------------------------------------------------------------------
  context('28. Revenda: Inclusão de Produto (POST /resales/:id/products), Lote, Preço pela Tabela, Totais do Cabeçalho e Recusas 422, 404 e 401 (Issue backend#783/PR #773)', () => {

    // Guarda da massa (P1-54 onda 4): antes de qualquer outro hook, para não criar revenda quando a massa fixa derivou
    before(function () { conferirMassaRevenda(this, ['PRODUTO_COM_LOTE', 'PRODUTO_COM_UM_LOTE_NA_BUSCA', 'REVENDA_CONCLUIDA_SEM_FINANCEIRO', 'CODIGO_DE_RECEITA']); });

    // `POST /resales/:id/products` (backend#783/PR #773, sub-issue da #27) inclui um produto de revenda no orçamento: `product_id`, `quantity` e, opcionais, `unit` e `lot_id`.
    // O preço nunca vem do cliente (tabela ou promoção ativa; qualquer outro campo recusa com 422) e a resposta é `201` com o detalhe inteiro, porque os totais do cabeçalho mudam.
    // Só entra produto da busca de revenda da loja (`MOVIMENTOESTOQUE = 3`); o lote é do produto, aberto e da loja, e a quantidade com lote é inteira (até 99999, quatro casas sem lote).
    // Exige o recurso contratado `resale`, a 232 e a 329 da conta. Medido na API real em 2026-10-28.
    // A revenda não tem DELETE: cada rodada cria 1 revenda aberta e inclui produto só nela (o orçamento aberto não baixa estoque). Os testes não dependem da ordem entre si: cada um compara com o detalhe lido antes.
    // Fora de alcance (`ROADMAP.md` P1-53): o `403` sem a 329 e sem a 302 (a conta de teste é uma só e tem todos os grants), o `409 RESALE_HAS_FINANCIAL` (grava em revenda de terceiros se regredir, sem como remover até a #784) e a inclusão na revenda concluída com lote (baixa estoque de verdade, sem como devolver até a #784).
    const massaRevenda = require('../fixtures/0.backend/massaRevenda');
    const TIMEOUT_ROTA = { timeout: 90000 };
    const TOLERA_RECUSA = { timeout: 90000, failOnStatusCode: false };
    const PRESCRITOR_NAO_INFORMADO = 9999999; // cadastro genérico "MEDICO NÃO INFORMADO", escolhido na tela (não há prescritor padrão)
    const DETALHE_INTERNO = /SQLSTATE|Firebird|Exception|An unexpected error|numeric value|string right truncation/i;
    const { PRODUTO_COM_LOTE, PRODUTO_SEM_LOTE, PRODUTO_FORA_DA_REVENDA, PRODUTO_INEXISTENTE } = massaRevenda;

    let revendaId = null;

    const detalheDe = (resaleId) => api.obterDetalheRevenda(resaleId, TIMEOUT_ROTA).then((res) => {
      expect(res.status, `Status do detalhe da revenda #${resaleId}`).to.eq(200);
      return res.body;
    });
    const exigirRecusa = (res, status, mensagem, rotulo) => {
      expect(res.status, `Status de ${rotulo}`).to.eq(status);
      expect(res.body.message, `Mensagem de ${rotulo}`).to.eq(mensagem);
      expect(JSON.stringify(res.body), `A resposta de ${rotulo} não pode expor detalhe interno`).not.to.match(DETALHE_INTERNO);
    };
    // Recusa: o status e a mensagem certos e a revenda exatamente como estava (nada gravado)
    const exigirInclusaoRecusada = (resaleId, corpo, status, mensagem, rotulo) => detalheDe(resaleId).then((antes) => {
      api.incluirProdutoRevenda(resaleId, corpo, TOLERA_RECUSA).then((res) => exigirRecusa(res, status, mensagem, rotulo));
      detalheDe(resaleId).then((depois) => {
        expect(depois, `A revenda #${resaleId} não pode mudar após ${rotulo}`).to.deep.eq(antes);
      });
    });
    // A linha que o POST acrescentou: a única com `id` que o detalhe anterior não tinha
    const linhaNova = (antes, depois) => {
      const novas = depois.products.filter((p) => !antes.products.some((a) => a.id === p.id));
      expect(novas, 'Exatamente 1 linha nova em products').to.have.length(1);
      return novas[0];
    };
    // Inclui o produto com `exigirOk` e confere o que vale para qualquer inclusão: preço da tabela vezes a quantidade e total do cabeçalho
    const incluirEConferir = (corpo, rotulo) => detalheDe(revendaId).then((antes) => {
      api.incluirProdutoRevenda(revendaId, corpo, TIMEOUT_ROTA).then((res) => {
        expect(res.status, `Status da inclusão de ${rotulo} (exige o recurso resale, a 232 e a 329)`).to.eq(201);
        const depois = res.body;
        expect(depois.id, 'A resposta é o detalhe da própria revenda').to.eq(revendaId);
        const linha = linhaNova(antes, depois);
        expect(linha.product_id, 'product_id da linha').to.eq(corpo.product_id);
        expect(linha.quantity, 'quantity da linha').to.eq(corpo.quantity);
        expect(linha.unit, 'unit da linha').to.be.a('string').and.not.to.be.empty;
        expect(linha.unit_sale_value, 'Preço unitário vem da tabela, nunca do cliente').to.be.a('number').and.to.be.greaterThan(0);
        expect(linha.sale_value, 'sale_value = preço unitário x quantidade').to.be.closeTo(linha.unit_sale_value * corpo.quantity, 0.01);
        expect(linha.sale_value_discounted, 'sale_value_discounted numérico e sem passar do valor cheio').to.be.a('number').and.to.be.at.most(linha.sale_value);
        expect(linha, 'A linha traz a promoção (nula sem promoção ativa)').to.have.property('promotion');
        expect(linha.updated_by, 'updated_by da sessão').to.eq(loggedUserId);
        expect(depois.sale_value, 'O total do cabeçalho soma a linha nova').to.be.closeTo(antes.sale_value + linha.sale_value, 0.01);
        expect(depois.products, 'As linhas que já existiam seguem iguais').to.include.deep.members(antes.products);
        expect(depois.status, 'A revenda segue aberta').to.eq(0);
        detalheDe(revendaId).then((det) => {
          expect(det, 'O detalhe devolve o mesmo que o POST').to.deep.eq(depois);
        });
        return cy.wrap(linha);
      });
    });

    before(() => {
      // Cliente padrão do env.json (R-POM) como paciente; o comprador nasce igual ao paciente
      api.buscarClientes(storeId, configEnv.DEFAULT_CLIENT_NAME || 'klismam').then((resCli) => {
        const cliente = (resCli.body && (resCli.body.items || resCli.body))[0];
        expect(cliente && cliente.id, '🔒 DEFAULT_CLIENT_NAME não achou cliente (massa)').to.be.ok;
        api.criarRevenda({ patient_id: cliente.id, prescriber_id: PRESCRITOR_NAO_INFORMADO }, TIMEOUT_ROTA).then((res) => {
          expect(res.status, 'Status da criação da revenda de teste (exige o recurso resale e a 232)').to.eq(201);
          revendaId = res.body.id;
          expect(revendaId, 'ID da revenda de teste').to.be.ok;
          expect(res.body.status, 'A revenda de teste nasce aberta (orçamento)').to.eq(0);
        });
      });
    });

    it('28.1 Deve incluir produto com lote na revenda aberta, com o lote, o preço da tabela e o total do cabeçalho somado, e devolver o detalhe inteiro com 201', () => {
      incluirEConferir({ product_id: PRODUTO_COM_LOTE.id, quantity: 2, lot_id: PRODUTO_COM_LOTE.lote_id }, 'produto com lote').then((linha) => {
        expect(linha.lot, 'A linha traz o lote escolhido').to.be.an('object');
        expect(linha.lot.id, 'lot.id').to.eq(PRODUTO_COM_LOTE.lote_id);
        expect(linha.lot.number, 'lot.number').to.be.a('string').and.not.to.be.empty;
        expect(linha.lot, 'Chaves do lote').to.include.all.keys('id', 'number', 'expires_on');
      });
    });

    it('28.2 Deve incluir produto sem lote na revenda aberta, com lote nulo, numeração da linha crescente e o total do cabeçalho somado', () => {
      detalheDe(revendaId).then((antes) => {
        const maiorLinhaAntes = Math.max(0, ...antes.products.map((p) => p.line_number));
        incluirEConferir({ product_id: PRODUTO_SEM_LOTE, quantity: 1 }, 'produto sem lote').then((linha) => {
          expect(linha.lot, 'Sem lote informado a linha vem com lot nulo').to.eq(null);
          expect(linha.line_number, 'line_number segue a ordem de inclusão').to.be.greaterThan(maiorLinhaAntes);
        });
      });
    });

    it('28.3 Deve recusar com 422 o produto que não é de revenda (insumo de manipulação e código inexistente), sem gravar nada', () => {
      exigirInclusaoRecusada(revendaId, { product_id: PRODUTO_FORA_DA_REVENDA, quantity: 1 }, 422, 'Produto não disponível para revenda.', 'insumo fora da busca de revenda');
      exigirInclusaoRecusada(revendaId, { product_id: PRODUTO_INEXISTENTE, quantity: 1 }, 422, 'Produto não disponível para revenda.', 'produto inexistente');
    });

    it('28.4 Deve recusar com 422 o lote de outro produto e o saldo menor que a quantidade, sem gravar nada', () => {
      exigirInclusaoRecusada(revendaId, { product_id: PRODUTO_SEM_LOTE, quantity: 1, lot_id: PRODUTO_COM_LOTE.lote_id }, 422, 'Lote inválido para este produto.', 'lote de outro produto');
      exigirInclusaoRecusada(revendaId, { product_id: PRODUTO_COM_LOTE.id, quantity: 99999, lot_id: PRODUTO_COM_LOTE.lote_saldo_pequeno_id }, 422, 'Saldo insuficiente no lote.', 'quantidade acima do saldo do lote');
    });

    it('28.5 Deve recusar com 422 a quantidade zero, fracionária com lote e acima de 99999, sem gravar nada', () => {
      const cenarios = [
        { corpo: { product_id: PRODUTO_COM_LOTE.id, quantity: 0, lot_id: PRODUTO_COM_LOTE.lote_id }, rotulo: 'quantidade 0' },
        { corpo: { product_id: PRODUTO_COM_LOTE.id, quantity: 1.5, lot_id: PRODUTO_COM_LOTE.lote_id }, rotulo: 'quantidade 1.5 com lote (inteira com lote)' },
        { corpo: { product_id: PRODUTO_COM_LOTE.id, quantity: 100000, lot_id: PRODUTO_COM_LOTE.lote_id }, rotulo: 'quantidade 100000 (teto 99999)' },
      ];
      cenarios.forEach(({ corpo, rotulo }) => {
        exigirInclusaoRecusada(revendaId, corpo, 422, 'Quantidade inválida.', rotulo);
      });
    });

    it('28.6 Deve recusar com 422 o preço enviado pelo cliente, o campo desconhecido e o produto ausente, cada um com a sua mensagem e sem gravar nada', () => {
      exigirInclusaoRecusada(revendaId, { product_id: PRODUTO_SEM_LOTE, quantity: 1, sale_value: 1 }, 422, 'O campo sale_value não é aceito nesta rota.', 'sale_value no corpo');
      exigirInclusaoRecusada(revendaId, { product_id: PRODUTO_SEM_LOTE, quantity: 1, campo_desconhecido: 1 }, 422, 'O campo campo_desconhecido não é aceito nesta rota.', 'campo desconhecido');
      exigirInclusaoRecusada(revendaId, { quantity: 1 }, 422, 'Produto obrigatório.', 'sem product_id');
      exigirInclusaoRecusada(revendaId, {}, 422, 'Produto obrigatório.', 'corpo vazio');
    });

    it('28.7 Deve recusar com 422 a inclusão na revenda concluída sem lote, porque ela baixa estoque, sem gravar nada', () => {
      exigirInclusaoRecusada(massaRevenda.REVENDA_CONCLUIDA_SEM_FINANCEIRO, { product_id: PRODUTO_COM_LOTE.id, quantity: 1 }, 422, 'Informe o lote: a revenda concluída baixa estoque.', 'revenda concluída sem lote');
    });

    it('28.8 Deve responder 404 para revenda inexistente, código de receita e o caminho antigo com /stores/:id, e 401 sem token, sem gravar nada', () => {
      const corpo = { product_id: PRODUTO_SEM_LOTE, quantity: 1 };
      api.incluirProdutoRevenda(massaRevenda.CODIGO_INEXISTENTE, corpo, TOLERA_RECUSA).then((res) => {
        exigirRecusa(res, 404, 'Revenda não encontrada.', 'revenda inexistente');
      });
      api.incluirProdutoRevenda(massaRevenda.CODIGO_DE_RECEITA, corpo, TOLERA_RECUSA).then((res) => {
        exigirRecusa(res, 404, 'Revenda não encontrada.', 'código de receita');
      });
      detalheDe(revendaId).then((antes) => {
        api.post(`/stores/${storeId}/resales/${revendaId}/products`, corpo, TOLERA_RECUSA).then((res) => {
          expect(res.status, 'Status de POST com o caminho antigo /stores/:id').to.eq(404);
        });
        const semToken = { ...TOLERA_RECUSA, headers: { Authorization: '' } };
        api.incluirProdutoRevenda(revendaId, corpo, semToken).then((res) => {
          expect(res.status, 'Status de POST sem token').to.eq(401);
        });
        detalheDe(revendaId).then((depois) => {
          expect(depois, 'A revenda não pode mudar após o 404 do caminho antigo e o 401').to.deep.eq(antes);
        });
      });
    });

  });

  context('29. Revenda: Alteração e Exclusão de Produto (PATCH e DELETE /resales/:id/products/:linha), Quantidade, Lote, Unidade, Estoque na Concluída e Recusas 409, 422, 404 e 401 (Issue backend#784/PR #775)', () => {

    // Guarda da massa (P1-54 onda 4): antes de qualquer outro hook, para não criar revenda quando a massa fixa derivou
    before(function () { conferirMassaRevenda(this, ['PRODUTO_COM_LOTE', 'REVENDA_ABERTA', 'REVENDA_CONCLUIDA_SEM_FINANCEIRO', 'REVENDA_COM_FINANCEIRO', 'CODIGO_DE_RECEITA']); });

    // `PATCH` (`quantity`, `unit`, `lot_id`) e `DELETE` de uma linha de produto da revenda (backend#784/PR #775, sub-issue da #27). Só conta o que muda (pedido sem mudança responde `200` sem gravar),
    // quantidade ou lote novos recalculam a linha pelo valor unitário dela, e a resposta do `PATCH` é o detalhe inteiro da revenda. Exigem o recurso `resale`, a 232 e a 329 da conta.
    // Orçamento aberto não mexe em estoque; na concluída a linha baixa o lote e o `DELETE` devolve. O saldo por lote vem de `GET /products?context=resale` (`lots[].balance`) e o teste que mexe nele
    // inclui a linha, confere o saldo e exclui no mesmo `it()`; o `afterEach` exclui de novo qualquer linha que sobrou na concluída (o `DELETE` repetido é `204`).
    // Cada rodada cria 1 revenda aberta (sem `DELETE` de revenda). Fora de alcance (`ROADMAP.md` P1-53): o `403` sem a 329 (conta única com todos os grants), a troca de lote de linha em promoção na concluída
    // (sem promoção na loja 1), o desconto dado à mão (só a revenda 260504410 tem, e é de terceiros), o `409 RESALE_BUSY` (concorrência) e o lote fora do bloco de 20 dígitos (só o Desktop grava).
    const massaRevenda = require('../fixtures/0.backend/massaRevenda');
    const TIMEOUT_ROTA = { timeout: 90000 };
    const TOLERA_RECUSA = { timeout: 90000, failOnStatusCode: false };
    const PRESCRITOR_NAO_INFORMADO = 9999999; // cadastro genérico "MEDICO NÃO INFORMADO", escolhido na tela (não há prescritor padrão)
    const DETALHE_INTERNO = /SQLSTATE|Firebird|Exception|An unexpected error|numeric value|string right truncation/i;
    const { PRODUTO_COM_LOTE } = massaRevenda;
    const CONCLUIDA = massaRevenda.REVENDA_CONCLUIDA_SEM_FINANCEIRO;
    const UNIDADE_OUTRA = 'UN'; // existe no cadastro de unidades da dev; o produto nasce em 'u' e 'cx' não existe
    const UNIDADE_INEXISTENTE = 'cx';
    const LINHA_INEXISTENTE = 1; // os ids de linha da dev passam de 3 milhões: nenhuma revenda tem a linha 1

    let revendaId = null;
    let linhasConcluidasPendentes = [];

    const detalheDe = (resaleId) => api.obterDetalheRevenda(resaleId, TIMEOUT_ROTA).then((res) => {
      expect(res.status, `Status do detalhe da revenda #${resaleId}`).to.eq(200);
      return res.body;
    });
    const exigirRecusa = (res, status, mensagem, rotulo) => {
      expect(res.status, `Status de ${rotulo}`).to.eq(status);
      expect(res.body.message, `Mensagem de ${rotulo}`).to.eq(mensagem);
      expect(JSON.stringify(res.body), `A resposta de ${rotulo} não pode expor detalhe interno`).not.to.match(DETALHE_INTERNO);
    };
    // Inclui o produto e devolve a linha nova (a de maior id: os ids de linha só crescem)
    const incluirLinha = (resaleId, corpo, rotulo) => api.incluirProdutoRevenda(resaleId, corpo, TIMEOUT_ROTA).then((res) => {
      expect(res.status, `Status da inclusão de ${rotulo} (exige o recurso resale, a 232 e a 329)`).to.eq(201);
      return res.body.products.reduce((a, b) => (b.id > a.id ? b : a));
    });
    const incluirNaConcluida = (corpo, rotulo) => incluirLinha(CONCLUIDA, corpo, rotulo).then((linha) => {
      linhasConcluidasPendentes.push(linha.id);
      return linha;
    });
    const linhaDe = (detalhe, linhaId) => detalhe.products.find((p) => p.id === linhaId);
    // Saldo do lote do produto de teste na busca de revenda da loja
    const saldoDoLote = (loteId) => api.listarProdutos(storeId, { context: 'resale', q: PRODUTO_COM_LOTE.termo_busca, per_page: 50 }, TIMEOUT_ROTA).then((res) => {
      expect(res.status, 'Status da busca de produtos de revenda').to.eq(200);
      const produto = res.body.items.find((p) => p.id === PRODUTO_COM_LOTE.id);
      expect(produto, `Produto ${PRODUTO_COM_LOTE.id} na busca de revenda`).to.be.ok;
      const lote = produto.lots.find((l) => l.id === loteId);
      expect(lote, `Lote ${loteId} do produto`).to.be.ok;
      return lote.balance;
    });
    // Recusa: o status e a mensagem certos e a revenda exatamente como estava (nada gravado)
    const exigirAlteracaoRecusada = (resaleId, linhaId, corpo, status, mensagem, rotulo) => detalheDe(resaleId).then((antes) => {
      api.atualizarProdutoRevenda(resaleId, linhaId, corpo, TOLERA_RECUSA).then((res) => exigirRecusa(res, status, mensagem, rotulo));
      detalheDe(resaleId).then((depois) => {
        expect(depois, `A revenda #${resaleId} não pode mudar após ${rotulo}`).to.deep.eq(antes);
      });
    });

    before(() => {
      // Cliente padrão do env.json (R-POM) como paciente; o comprador nasce igual ao paciente
      api.buscarClientes(storeId, configEnv.DEFAULT_CLIENT_NAME || 'klismam').then((resCli) => {
        const cliente = (resCli.body && (resCli.body.items || resCli.body))[0];
        expect(cliente && cliente.id, '🔒 DEFAULT_CLIENT_NAME não achou cliente (massa)').to.be.ok;
        api.criarRevenda({ patient_id: cliente.id, prescriber_id: PRESCRITOR_NAO_INFORMADO }, TIMEOUT_ROTA).then((res) => {
          expect(res.status, 'Status da criação da revenda de teste (exige o recurso resale e a 232)').to.eq(201);
          revendaId = res.body.id;
          expect(revendaId, 'ID da revenda de teste').to.be.ok;
          expect(res.body.status, 'A revenda de teste nasce aberta (orçamento)').to.eq(0);
        });
      });
    });

    afterEach(() => {
      // Estorno de segurança: o DELETE de linha já excluída responde 204, então repetir não faz mal
      const pendentes = linhasConcluidasPendentes;
      linhasConcluidasPendentes = [];
      pendentes.forEach((linhaId) => api.excluirProdutoRevenda(CONCLUIDA, linhaId, TOLERA_RECUSA));
    });

    it('29.1 Deve alterar a quantidade da linha de 3 para 1 no orçamento aberto, recalculando a linha pelo valor unitário dela e o total do cabeçalho, e devolver o detalhe inteiro com 200', () => {
      incluirLinha(revendaId, { product_id: PRODUTO_COM_LOTE.id, quantity: 3 }, 'produto com quantidade 3').then((linha) => {
        detalheDe(revendaId).then((antes) => {
          api.atualizarProdutoRevenda(revendaId, linha.id, { quantity: 1 }, TIMEOUT_ROTA).then((res) => {
            expect(res.status, 'Status do PATCH de quantidade (exige o recurso resale, a 232 e a 329)').to.eq(200);
            expect(res.body.id, 'A resposta é o detalhe da própria revenda').to.eq(revendaId);
            const nova = linhaDe(res.body, linha.id);
            expect(nova.quantity, 'quantity da linha').to.eq(1);
            expect(nova.unit_sale_value, 'O valor unitário da linha se mantém').to.eq(linha.unit_sale_value);
            expect(nova.sale_value, 'sale_value = valor unitário x 1').to.be.closeTo(linha.unit_sale_value, 0.01);
            expect(nova.sale_value_discounted, 'Sem desconto nem promoção, o líquido é o bruto').to.be.closeTo(nova.sale_value, 0.01);
            expect(nova.updated_by, 'updated_by da sessão').to.eq(loggedUserId);
            expect(res.body.sale_value, 'O total do cabeçalho cai as 2 unidades tiradas').to.be.closeTo(antes.sale_value - 2 * linha.unit_sale_value, 0.01);
            detalheDe(revendaId).then((det) => {
              expect(det, 'O detalhe devolve o mesmo que o PATCH').to.deep.eq(res.body);
            });
          });
        });
      });
    });

    it('29.2 Deve responder 200 sem gravar nada quando o PATCH traz a quantidade e a unidade que a linha já tem', () => {
      incluirLinha(revendaId, { product_id: PRODUTO_COM_LOTE.id, quantity: 2 }, 'produto com quantidade 2').then((linha) => {
        detalheDe(revendaId).then((antes) => {
          api.atualizarProdutoRevenda(revendaId, linha.id, { quantity: linha.quantity, unit: linha.unit }, TIMEOUT_ROTA).then((res) => {
            expect(res.status, 'Status do PATCH sem mudança').to.eq(200);
            expect(res.body, 'Nada muda, nem o updated_at da linha e do cabeçalho').to.deep.eq(antes);
          });
        });
      });
    });

    it('29.3 Deve trocar o lote da linha do orçamento aberto (26705, 29392 e nenhum) sem mexer no preço, no total nem no saldo do lote', () => {
      incluirLinha(revendaId, { product_id: PRODUTO_COM_LOTE.id, quantity: 1 }, 'produto sem lote').then((linha) => {
        expect(linha.lot, 'A inclusão sem lote_id nasce sem lote no orçamento aberto').to.eq(null);
        saldoDoLote(PRODUTO_COM_LOTE.lote_id).then((saldoAntes) => {
          detalheDe(revendaId).then((antes) => {
            [PRODUTO_COM_LOTE.lote_saldo_pequeno_id, PRODUTO_COM_LOTE.lote_id, null].forEach((loteId) => {
              api.atualizarProdutoRevenda(revendaId, linha.id, { lot_id: loteId }, TIMEOUT_ROTA).then((res) => {
                expect(res.status, `Status do PATCH com lot_id ${loteId}`).to.eq(200);
                const nova = linhaDe(res.body, linha.id);
                if (loteId === null) {
                  expect(nova.lot, 'lot_id null tira o lote').to.eq(null);
                } else {
                  expect(nova.lot.id, 'Lote novo da linha').to.eq(loteId);
                }
                expect(nova.unit_sale_value, 'O valor unitário não muda com o lote').to.eq(linha.unit_sale_value);
                expect(res.body.sale_value, 'O total do cabeçalho não muda com o lote').to.be.closeTo(antes.sale_value, 0.01);
              });
            });
            saldoDoLote(PRODUTO_COM_LOTE.lote_id).then((saldoDepois) => {
              expect(saldoDepois, 'O orçamento aberto não baixa estoque').to.eq(saldoAntes);
            });
          });
        });
      });
    });

    it('29.4 Deve trocar só a unidade da linha sem mexer no preço nem nos totais', () => {
      incluirLinha(revendaId, { product_id: PRODUTO_COM_LOTE.id, quantity: 2 }, 'produto com quantidade 2').then((linha) => {
        detalheDe(revendaId).then((antes) => {
          api.atualizarProdutoRevenda(revendaId, linha.id, { unit: UNIDADE_OUTRA }, TIMEOUT_ROTA).then((res) => {
            expect(res.status, 'Status do PATCH só com unit').to.eq(200);
            const nova = linhaDe(res.body, linha.id);
            expect(nova.unit, 'Unidade nova da linha').to.eq(UNIDADE_OUTRA);
            expect(nova.quantity, 'quantity não muda').to.eq(linha.quantity);
            expect(nova.unit_sale_value, 'unit_sale_value não muda').to.eq(linha.unit_sale_value);
            expect(nova.sale_value, 'sale_value não muda').to.eq(linha.sale_value);
            expect(res.body.sale_value, 'O total do cabeçalho não muda').to.be.closeTo(antes.sale_value, 0.01);
          });
        });
      });
    });

    it('29.5 Deve recusar com 422 o PATCH com sale_value, porque o preço nunca vem do cliente, sem gravar nada', () => {
      incluirLinha(revendaId, { product_id: PRODUTO_COM_LOTE.id, quantity: 1 }, 'produto para a recusa de sale_value').then((linha) => {
        exigirAlteracaoRecusada(revendaId, linha.id, { sale_value: 10 }, 422, 'O campo sale_value não é aceito nesta rota.', 'PATCH com sale_value');
      });
    });

    it('29.6 Deve recusar com 422 o PATCH sem nenhum campo válido, com quantidade zero e com unidade fora do cadastro, sem gravar nada', () => {
      incluirLinha(revendaId, { product_id: PRODUTO_COM_LOTE.id, quantity: 1 }, 'produto para as recusas de corpo').then((linha) => {
        exigirAlteracaoRecusada(revendaId, linha.id, {}, 422, 'Nenhum campo válido para atualização.', 'PATCH com corpo vazio');
        exigirAlteracaoRecusada(revendaId, linha.id, { quantity: 0 }, 422, 'Quantidade inválida.', 'PATCH com quantidade zero');
        exigirAlteracaoRecusada(revendaId, linha.id, { unit: UNIDADE_INEXISTENTE }, 422, 'Unidade não encontrada no cadastro.', 'PATCH com unidade fora do cadastro');
      });
    });

    it('29.7 Deve responder 404 para a linha de outra revenda, sem tocar nela, e para a linha excluída, que não é reaberta', () => {
      detalheDe(massaRevenda.REVENDA_ABERTA.id).then((outra) => {
        const linhaDeOutra = outra.products[0];
        expect(linhaDeOutra, 'A revenda aberta da massa tem produto').to.be.ok;
        // A mesma quantidade que a linha já tem: se a rota regredisse e achasse a linha, responderia 200 sem gravar nada na revenda de terceiros
        api.atualizarProdutoRevenda(revendaId, linhaDeOutra.id, { quantity: linhaDeOutra.quantity }, TOLERA_RECUSA).then((res) => {
          exigirRecusa(res, 404, 'Produto não encontrado na revenda.', 'PATCH com linha de outra revenda');
        });
        detalheDe(massaRevenda.REVENDA_ABERTA.id).then((depois) => {
          expect(depois, 'A revenda de terceiros não pode mudar').to.deep.eq(outra);
        });
      });
      incluirLinha(revendaId, { product_id: PRODUTO_COM_LOTE.id, quantity: 1 }, 'produto que será excluído').then((linha) => {
        api.excluirProdutoRevenda(revendaId, linha.id, TIMEOUT_ROTA).then((res) => {
          expect(res.status, 'Status do DELETE da linha').to.eq(204);
        });
        detalheDe(revendaId).then((antes) => {
          api.atualizarProdutoRevenda(revendaId, linha.id, { quantity: 2 }, TOLERA_RECUSA).then((res) => {
            exigirRecusa(res, 404, 'Produto não encontrado na revenda.', 'PATCH na linha excluída');
          });
          detalheDe(revendaId).then((depois) => {
            expect(depois, 'A linha excluída não é reaberta').to.deep.eq(antes);
            expect(depois.products.map((p) => p.id), 'A linha excluída não aparece no detalhe').not.to.include(linha.id);
          });
        });
      });
    });

    it('29.8 Deve excluir a linha do orçamento aberto com 204, tirando o produto do detalhe e do total, e responder 204 de novo sem gravar nada', () => {
      incluirLinha(revendaId, { product_id: PRODUTO_COM_LOTE.id, quantity: 2 }, 'produto que será excluído').then((linha) => {
        detalheDe(revendaId).then((antes) => {
          api.excluirProdutoRevenda(revendaId, linha.id, TIMEOUT_ROTA).then((res) => {
            expect(res.status, 'Status do DELETE da linha (exige o recurso resale, a 232 e a 329)').to.eq(204);
          });
          detalheDe(revendaId).then((depois) => {
            expect(depois.products.map((p) => p.id), 'A linha excluída sai do detalhe').not.to.include(linha.id);
            expect(depois.products, 'As outras linhas seguem iguais').to.have.length(antes.products.length - 1);
            expect(depois.sale_value, 'O total do cabeçalho tira a linha').to.be.closeTo(antes.sale_value - linha.sale_value, 0.01);
            api.excluirProdutoRevenda(revendaId, linha.id, TIMEOUT_ROTA).then((res) => {
              expect(res.status, 'Status do DELETE repetido').to.eq(204);
            });
            detalheDe(revendaId).then((repetido) => {
              expect(repetido, 'Excluir de novo não grava nada').to.deep.eq(depois);
            });
          });
        });
      });
    });

    it('29.9 Deve alterar a quantidade na revenda concluída baixando o saldo do lote e devolver o saldo todo ao excluir a linha', () => {
      saldoDoLote(PRODUTO_COM_LOTE.lote_id).then((inicial) => {
        detalheDe(CONCLUIDA).then((antes) => {
          incluirNaConcluida({ product_id: PRODUTO_COM_LOTE.id, quantity: 1, lot_id: PRODUTO_COM_LOTE.lote_id }, 'produto com lote na revenda concluída').then((linha) => {
            saldoDoLote(PRODUTO_COM_LOTE.lote_id).then((saldo) => {
              expect(saldo, 'A inclusão de 1 unidade baixa 1 do lote').to.eq(inicial - 1);
            });
            api.atualizarProdutoRevenda(CONCLUIDA, linha.id, { quantity: 2 }, TIMEOUT_ROTA).then((res) => {
              expect(res.status, 'Status do PATCH de quantidade na concluída (exige a 302)').to.eq(200);
              const nova = linhaDe(res.body, linha.id);
              expect(nova.quantity, 'quantity da linha').to.eq(2);
              expect(nova.lot.id, 'O lote da linha segue o mesmo').to.eq(PRODUTO_COM_LOTE.lote_id);
              expect(nova.sale_value, 'sale_value = valor unitário x 2').to.be.closeTo(linha.unit_sale_value * 2, 0.01);
            });
            saldoDoLote(PRODUTO_COM_LOTE.lote_id).then((saldo) => {
              expect(saldo, 'A quantidade nova baixa mais 1 do lote').to.eq(inicial - 2);
            });
            api.excluirProdutoRevenda(CONCLUIDA, linha.id, TIMEOUT_ROTA).then((res) => {
              expect(res.status, 'Status do DELETE na concluída').to.eq(204);
            });
            saldoDoLote(PRODUTO_COM_LOTE.lote_id).then((saldo) => {
              expect(saldo, 'A exclusão devolve o saldo todo, sem baixa sobrando').to.eq(inicial);
            });
            detalheDe(CONCLUIDA).then((depois) => {
              expect(depois.products.map((p) => p.id), 'A linha excluída sai do detalhe').not.to.include(linha.id);
              expect(depois.sale_value, 'O total da concluída volta ao de antes').to.be.closeTo(antes.sale_value, 0.01);
            });
          });
        });
      });
    });

    it('29.10 Deve recusar com 422 tirar o lote da linha da revenda concluída e trocar unidade e lote no mesmo pedido, sem gravar nem mexer no saldo', () => {
      incluirNaConcluida({ product_id: PRODUTO_COM_LOTE.id, quantity: 1, lot_id: PRODUTO_COM_LOTE.lote_id }, 'produto com lote na revenda concluída').then((linha) => {
        saldoDoLote(PRODUTO_COM_LOTE.lote_id).then((saldoAntes) => {
          exigirAlteracaoRecusada(CONCLUIDA, linha.id, { lot_id: null }, 422, 'Informe o lote: a revenda concluída baixa estoque.', 'PATCH sem lote na concluída');
          exigirAlteracaoRecusada(
            CONCLUIDA, linha.id, { unit: UNIDADE_OUTRA, lot_id: PRODUTO_COM_LOTE.lote_saldo_pequeno_id }, 422,
            'Altere a unidade e o lote em pedidos separados: a revenda concluída baixa estoque.', 'PATCH com unidade e lote juntos na concluída'
          );
          saldoDoLote(PRODUTO_COM_LOTE.lote_id).then((saldoDepois) => {
            expect(saldoDepois, 'As recusas não mexem no saldo do lote').to.eq(saldoAntes);
          });
        });
      });
    });

    it('29.11 Deve responder 409 RESALE_HAS_FINANCIAL no PATCH e no DELETE de produto da revenda com financeiro, sem gravar nada', () => {
      const mensagem = 'Revenda com financeiro registrado não pode ter os produtos alterados.';
      detalheDe(massaRevenda.REVENDA_COM_FINANCEIRO).then((antes) => {
        expect(antes.financial_id, 'A revenda da massa tem financeiro').to.be.a('number');
        api.atualizarProdutoRevenda(massaRevenda.REVENDA_COM_FINANCEIRO, LINHA_INEXISTENTE, { quantity: 1 }, TOLERA_RECUSA).then((res) => {
          exigirRecusa(res, 409, mensagem, 'PATCH de produto com financeiro');
          expect(res.body.code, 'code do PATCH').to.eq('RESALE_HAS_FINANCIAL');
        });
        api.excluirProdutoRevenda(massaRevenda.REVENDA_COM_FINANCEIRO, LINHA_INEXISTENTE, TOLERA_RECUSA).then((res) => {
          exigirRecusa(res, 409, mensagem, 'DELETE de produto com financeiro');
          expect(res.body.code, 'code do DELETE').to.eq('RESALE_HAS_FINANCIAL');
        });
        detalheDe(massaRevenda.REVENDA_COM_FINANCEIRO).then((depois) => {
          expect(depois, 'A revenda com financeiro não pode mudar').to.deep.eq(antes);
        });
      });
    });

    it('29.12 Deve responder 404 para revenda inexistente, código de receita e o caminho antigo com /stores/:id, e 401 sem token, sem gravar nada', () => {
      [massaRevenda.CODIGO_INEXISTENTE, massaRevenda.CODIGO_DE_RECEITA].forEach((codigo) => {
        api.atualizarProdutoRevenda(codigo, LINHA_INEXISTENTE, { quantity: 1 }, TOLERA_RECUSA).then((res) => {
          exigirRecusa(res, 404, 'Revenda não encontrada.', `PATCH em ${codigo}`);
        });
        api.excluirProdutoRevenda(codigo, LINHA_INEXISTENTE, TOLERA_RECUSA).then((res) => {
          exigirRecusa(res, 404, 'Revenda não encontrada.', `DELETE em ${codigo}`);
        });
      });
      incluirLinha(revendaId, { product_id: PRODUTO_COM_LOTE.id, quantity: 1 }, 'produto para o 404 do caminho antigo e o 401').then((linha) => {
        detalheDe(revendaId).then((antes) => {
          // Sempre a quantidade que a linha já tem: se a recusa regredisse, o PATCH responderia 200 sem gravar
          api.patch(`/stores/${storeId}/resales/${revendaId}/products/${linha.id}`, { quantity: linha.quantity }, TOLERA_RECUSA).then((res) => {
            expect(res.status, 'Status de PATCH com o caminho antigo /stores/:id').to.eq(404);
          });
          api.delete(`/stores/${storeId}/resales/${revendaId}/products/${linha.id}`, TOLERA_RECUSA).then((res) => {
            expect(res.status, 'Status de DELETE com o caminho antigo /stores/:id').to.eq(404);
          });
          const semToken = { ...TOLERA_RECUSA, headers: { Authorization: '' } };
          api.atualizarProdutoRevenda(revendaId, linha.id, { quantity: linha.quantity }, semToken).then((res) => {
            expect(res.status, 'Status de PATCH sem token').to.eq(401);
          });
          api.excluirProdutoRevenda(revendaId, linha.id, semToken).then((res) => {
            expect(res.status, 'Status de DELETE sem token').to.eq(401);
          });
          detalheDe(revendaId).then((depois) => {
            expect(depois, 'A revenda não pode mudar após o 404 do caminho antigo e o 401').to.deep.eq(antes);
          });
        });
      });
    });

  });

  context('30. Revenda: Busca de Produtos (GET /products?context=resale), Lotes com Saldo, Ordem por Vencimento, Formato do Item, Validação do Parâmetro, Modo de Busca e Acento (Issue backend#785/PR #776)', () => {

    // Guarda da massa (P1-54 onda 4): antes de qualquer outro hook, para não criar revenda quando a massa fixa derivou
    before(function () { conferirMassaRevenda(this, ['PRODUTO_COM_LOTE', 'PRODUTO_COM_UM_LOTE_NA_BUSCA', 'PRODUTO_SEM_LOTE_NA_BUSCA', 'TERMO_COM_ACENTO']); });

    // `GET /products` ganhou o parâmetro `context` (backend#785/PR #776, sub-issue da #27): `resale` usa a busca de revenda do Desktop (um item por produto, com `lots` e a promoção de cada lote),
    // `recipe` ou sem valor mantém a busca da receita. Outro valor responde `422`. `usage` é opcional e ignorado na revenda; a resposta traz só `items` e `total` (sem paginação, o limite de 500 conta produtos).
    // Só leitura: nada grava, então os testes não dependem da ordem. Os produtos e termos vêm de `massaRevenda.js` (registros reais da dev; o saldo muda com as inclusões das backend#783 e backend#784, por isso só se afirma o tipo).
    // Medido na API real em 2026-10-28. Fora de alcance (`ROADMAP.md` P1-53): o lote com promoção ativa (nenhum lote da dev tem hoje), o `cost_value` nulo sem a 401 (conta única com todos os grants), a comparação com o Desktop
    // e o `mode=starting` ignorar a caixa (a issue diz que ignora e a dev devolve 0 itens com `farmula`; divergência registrada no P1-53, sem teste, decisão do operador).
    const massaRevenda = require('../fixtures/0.backend/massaRevenda');
    const TIMEOUT_ROTA = { timeout: 90000 };
    const TOLERA_RECUSA = { timeout: 90000, failOnStatusCode: false };
    const DETALHE_INTERNO = /SQLSTATE|Firebird|Exception|An unexpected error|numeric value|string right truncation/i;
    const { PRODUTO_COM_LOTE, PRODUTO_COM_UM_LOTE_NA_BUSCA, PRODUTO_SEM_LOTE_NA_BUSCA, TERMO_COM_ACENTO } = massaRevenda;
    const CHAVES_DO_LOTE = ['id', 'number', 'expires_on', 'balance', 'promotion'];
    const CHAVES_SO_DA_REVENDA = ['lots', 'promotion', 'max_discount_percentage'];

    const buscarRevenda = (qs) => api.buscarProdutosRevenda(qs, TIMEOUT_ROTA).then((res) => {
      expect(res.status, `Status de GET /products?context=resale com ${JSON.stringify(qs)}`).to.eq(200);
      expect(res.body.items, 'items da busca').to.be.an('array');
      return res.body.items;
    });
    const itemDe = (itens, produtoId) => {
      const item = itens.find((i) => i.id === produtoId);
      expect(item, `Produto ${produtoId} na busca de revenda`).to.be.ok;
      return item;
    };
    // Vencimento crescente e, no empate, id crescente; lote sem vencimento fecha a lista
    const chaveDeOrdem = (lote) => `${lote.expires_on || '9999-12-31'}#${String(lote.id).padStart(12, '0')}`;
    const exigirLotesOrdenados = (lotes, rotulo) => {
      const chaves = lotes.map(chaveDeOrdem);
      expect(chaves, `Lotes de ${rotulo} por vencimento e depois por id`).to.deep.eq([...chaves].sort());
    };

    it('30.1 Deve devolver o produto da busca de revenda com os lotes por vencimento, o saldo e a promoção de cada lote, o custo e o máximo de desconto', () => {
      buscarRevenda({ q: 'FARMULA', mode: 'starting' }).then((itens) => {
        const item = itemDe(itens, PRODUTO_COM_LOTE.id);
        expect(item.name, 'Nome do produto').to.be.a('string').and.to.match(/^FARMULA/);
        expect(item.movement_type, 'Só produto de revenda (MOVIMENTOESTOQUE 3)').to.eq(3);
        expect(item.lots, 'Lotes do produto').to.be.an('array');
        const idsDosLotes = item.lots.map((l) => l.id);
        expect(idsDosLotes, 'O produto de teste tem os dois lotes da massa').to.include.members([PRODUTO_COM_LOTE.lote_saldo_pequeno_id, PRODUTO_COM_LOTE.lote_id]);
        item.lots.forEach((lote) => {
          expect(lote, `Chaves do lote ${lote.id}`).to.include.all.keys(...CHAVES_DO_LOTE);
          expect(lote.number, `number do lote ${lote.id}`).to.be.a('string').and.not.to.be.empty;
          expect(lote.balance, `balance do lote ${lote.id}`).to.be.a('number');
        });
        exigirLotesOrdenados(item.lots, `o produto ${item.id}`);
        expect(idsDosLotes.indexOf(PRODUTO_COM_LOTE.lote_saldo_pequeno_id), 'O lote que vence antes (26705) vem antes do 29392').to.be.lessThan(idsDosLotes.indexOf(PRODUTO_COM_LOTE.lote_id));
        expect(item.promotion, 'O promotion do item só vem para produto sem lote').to.eq(null);
        expect(item.max_discount_percentage, 'max_discount_percentage da procedure').to.be.a('number');
        expect(item.cost_value, 'A conta tem a 401: o custo vem preenchido').to.be.a('number');
        expect(item.sale_value, 'sale_value (preço de tabela)').to.be.a('number').and.to.be.greaterThan(0);
      });
    });

    it('30.2 Deve devolver só produtos de revenda com lots sempre como lista ordenada, o promotion do item presente e no máximo 500 produtos, para o termo vazio', () => {
      buscarRevenda({}).then((itens) => {
        expect(itens, 'Termo vazio acha os produtos de revenda da loja').to.have.length.greaterThan(0);
        expect(itens.length, 'O limite de 500 conta produtos').to.be.at.most(500);
        itens.forEach((item) => {
          expect(item.movement_type, `movement_type do produto ${item.id}`).to.eq(3);
          expect(item.lots, `lots do produto ${item.id}`).to.be.an('array');
          expect(item, `O item ${item.id} traz o promotion`).to.have.property('promotion');
          exigirLotesOrdenados(item.lots, `o produto ${item.id}`);
        });
        expect(new Set(itens.map((i) => i.id)).size, 'Um item por produto, sem repetir').to.eq(itens.length);
      });
    });

    it('30.3 Deve devolver o produto com um só lote com o lote e o saldo da busca de revenda', () => {
      buscarRevenda({ q: PRODUTO_COM_UM_LOTE_NA_BUSCA.termo, mode: 'starting' }).then((itens) => {
        const item = itemDe(itens, PRODUTO_COM_UM_LOTE_NA_BUSCA.id);
        expect(item.lots, 'O produto tem 1 lote').to.have.length(1);
        expect(item.lots[0].id, 'Lote do produto').to.eq(PRODUTO_COM_UM_LOTE_NA_BUSCA.lote_id);
        expect(item.lots[0].balance, 'Saldo do lote').to.be.a('number');
        expect(item.cost_value, 'Custo do produto').to.be.a('number');
      });
    });

    it('30.4 Deve devolver o produto sem lote com lots vazio e o promotion do item presente', () => {
      buscarRevenda({ q: PRODUTO_SEM_LOTE_NA_BUSCA.termo, mode: 'starting' }).then((itens) => {
        const item = itemDe(itens, PRODUTO_SEM_LOTE_NA_BUSCA.id);
        expect(item.lots, 'Produto sem saldo em lote: lots vazio, não nulo').to.deep.eq([]);
        expect(item, 'O promotion do item vale para produto sem lote').to.have.property('promotion');
        expect(item.max_discount_percentage, 'max_discount_percentage').to.be.a('number');
      });
    });

    it('30.5 Deve manter a busca da receita igual sem context e com context=recipe, com lots, promotion e max_discount_percentage nulos e o mesmo formato de item da revenda', () => {
      const comUsage = { q: 'FARMULA', mode: 'starting' };
      api.listarProdutos(storeId, comUsage, TIMEOUT_ROTA).then((semContext) => {
        expect(semContext.status, 'Status da busca da receita sem context').to.eq(200);
        api.listarProdutos(storeId, { ...comUsage, context: 'recipe' }, TIMEOUT_ROTA).then((recipe) => {
          expect(recipe.status, 'Status da busca da receita com context=recipe').to.eq(200);
          expect(recipe.body.items, 'context=recipe é igual a sem context').to.deep.eq(semContext.body.items);
          expect(semContext.body.items, 'A busca da receita acha os produtos').to.have.length.greaterThan(0);
          semContext.body.items.forEach((item) => {
            CHAVES_SO_DA_REVENDA.forEach((chave) => {
              expect(item[chave], `${chave} do produto ${item.id} na busca da receita`).to.eq(null);
            });
          });
          buscarRevenda({ q: 'FARMULA', mode: 'starting' }).then((itensRevenda) => {
            const daReceita = itemDe(semContext.body.items, PRODUTO_COM_LOTE.id);
            const daRevenda = itemDe(itensRevenda, PRODUTO_COM_LOTE.id);
            expect(Object.keys(daRevenda), 'O item da revenda tem as mesmas chaves do item da receita').to.have.members(Object.keys(daReceita));
          });
        });
      });
    });

    it('30.6 Deve recusar com 422 o context inválido e manter o usage opcional e ignorado na revenda e obrigatório na receita', () => {
      api.buscarProdutosRevenda({ q: 'a', context: 'receita' }, TOLERA_RECUSA).then((res) => {
        expect(res.status, 'Status do context inválido').to.eq(422);
        expect(res.body.message, 'Mensagem do context inválido').to.eq("Valor inválido para context. Use 'recipe' ou 'resale'.");
        expect(JSON.stringify(res.body), 'A resposta não pode expor detalhe interno').not.to.match(DETALHE_INTERNO);
      });
      buscarRevenda({ q: 'FARMULA', mode: 'starting' }).then((semUsage) => {
        buscarRevenda({ q: 'FARMULA', mode: 'starting', usage: 'animal' }).then((comUsage) => {
          expect(comUsage.map((i) => i.id), 'usage é ignorado na revenda').to.deep.eq(semUsage.map((i) => i.id));
        });
      });
      api.get('/products', { q: 'FARMULA', mode: 'starting' }, TOLERA_RECUSA).then((res) => {
        expect(res.status, 'Status da busca da receita sem usage').to.eq(422);
        expect(res.body.message, 'Mensagem da busca da receita sem usage').to.eq('O parâmetro usage é obrigatório.');
      });
    });

    it('30.7 Deve buscar pelo começo do nome em starting e por qualquer parte em containing, e distinguir o acento na revenda como o Desktop, ao contrário da busca da receita', () => {
      buscarRevenda({ q: PRODUTO_COM_LOTE.termo_no_meio, mode: 'starting' }).then((itens) => {
        expect(itens, 'starting com um trecho do meio do nome não acha nada').to.have.length(0);
      });
      buscarRevenda({ q: PRODUTO_COM_LOTE.termo_no_meio, mode: 'containing' }).then((itens) => {
        itemDe(itens, PRODUTO_COM_LOTE.id);
      });
      buscarRevenda({ q: TERMO_COM_ACENTO.com, mode: 'containing' }).then((itens) => {
        expect(itens, `O termo com acento (${TERMO_COM_ACENTO.com}) acha produto`).to.have.length.greaterThan(0);
        itens.forEach((item) => expect(item.name, 'Nome com o termo').to.contain(TERMO_COM_ACENTO.com));
      });
      buscarRevenda({ q: TERMO_COM_ACENTO.sem, mode: 'containing' }).then((itens) => {
        expect(itens, `O termo sem acento (${TERMO_COM_ACENTO.sem}) não acha o produto com acento na revenda`).to.have.length(0);
      });
      api.listarProdutos(storeId, { q: TERMO_COM_ACENTO.sem, mode: 'containing' }, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status da busca da receita sem acento').to.eq(200);
        expect(res.body.items, 'A busca da receita segue sem distinguir acento (backend#628)').to.have.length.greaterThan(0);
      });
    });

    it('30.8 Deve responder 401 à busca de revenda sem token', () => {
      api.buscarProdutosRevenda({ q: 'FARMULA', mode: 'starting' }, { ...TOLERA_RECUSA, headers: { Authorization: '' } }).then((res) => {
        expect(res.status, 'Status de GET /products?context=resale sem token').to.eq(401);
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 31: AUTOMAÇÕES — CRUD, DUPLICAR E CAPABILITIES (Issue backend#738)
  // ---------------------------------------------------------------------------
  context('31. Automações: CRUD, Duplicar e Capabilities, Árvore de Passos, Edição Concorrente, Escopo por Canal e Recusas (Issue backend#738)', () => {

    // As 9 rotas de `/automations` (backend#738, spec #735) e `GET /automation-capabilities`: loja do token (o caminho antigo `/stores/:id` responde 404), recurso contratado `automation` e permissão legada 635
    // (`can_list` = a 635, `can_create` = GRAVAR, `can_edit` = ALTERAR, `can_delete` = EXCLUIR). A exclusão é lógica: a linha fica no banco para sempre, então a rodada apaga só o que criou e a dev acumula ~8 linhas apagadas por execução.
    // Massa temporária própria ([R-ATEMPORAL]): nenhum teste depende de automação da dev. O gatilho é `keyword_match` com palavra única que nunca casa com mensagem real (o motor da dev confere eventos a cada 30 s) e nenhuma fica ativa no fim.
    // Sem teste (`ROADMAP.md` P1-60): a escada de permissão (funcionário sem a 635 ou com as caixas desmarcadas, `403` nas escritas e `200` com tudo `false` nas capabilities), porque a conta de teste é uma só e tem todas; o `PATCH` transacional com falha no meio do insert, que não se provoca de forma determinística;
    // `POST` com `template_slug` (galeria da backend#747) e o `wait` pendente cancelado ao salvar ou apagar (o disparo só vem de mensagem real).
    const TIMEOUT_ROTA = { timeout: 90000 };
    const SEM_TOKEN = { timeout: 90000, headers: { Authorization: '' } };
    const TOKEN = Date.now().toString(36);
    const PALAVRA = `zz${TOKEN}`;
    const nome = (sufixo) => `[Cypress] Backend 738 ${TOKEN} ${sufixo}`;
    const CHAVES_CAPABILITIES_AUTOMACAO = ['can_list', 'can_create', 'can_edit', 'can_delete'];
    const AUTOMACAO_INEXISTENTE = 999999999;
    const DETALHE_INTERNO = /SQLSTATE|Firebird|Exception|An unexpected error|numeric value|string right truncation/i;
    const criadas = [];
    let principal;

    const corpo = (sufixo, extra = {}) => ({
      name: nome(sufixo),
      description: 'Massa temporária do contexto 31 de 0-A (backend#738)',
      trigger_type: 'keyword_match',
      trigger_config: { keywords: [PALAVRA], match_type: 'contains', case_sensitive: false },
      steps: [{ step_type: 'send_message', step_config: { text: 'Olá {{client.name}}' } }],
      ...extra
    });
    // Cria pela API, confere o `201` e registra o id para a limpeza do `after`.
    const criar = (sufixo, extra = {}) => cy.then(() => api.criarAutomacao(corpo(sufixo, extra), TIMEOUT_ROTA)).then((res) => {
      expect(res.status, `Status do POST /automations "${sufixo}"`).to.eq(201);
      criadas.push(res.body.automation.id);
      return res;
    });
    const detalhe = (automationId) => cy.then(() => api.obterAutomacao(automationId, TIMEOUT_ROTA)).then((res) => {
      expect(res.status, `Status do GET /automations/${automationId}`).to.eq(200);
      return res.body.automation;
    });
    // Tira os `id` dos passos (a cópia leva ids novos) e o `branches: null` dos passos que não são condição (o wire devolve `null` neles; o `31.3` e o `31.8` afirmam isso) para comparar só a forma da árvore enviada.
    const semIds = (passos) => JSON.parse(JSON.stringify(passos || []), (chave, valor) => ((chave === 'id' || (chave === 'branches' && valor === null)) ? undefined : valor));
    const exigirRecusa = (res, status, rotulo) => {
      expect(res.status, `Status de ${rotulo}`).to.eq(status);
      expect(JSON.stringify(res.body), `A resposta de ${rotulo} não pode expor detalhe interno`).not.to.match(DETALHE_INTERNO);
    };

    before(() => {
      api.autenticar();
      criar('principal').then((res) => { principal = res.body.automation; });
    });

    after(() => {
      criadas.forEach((id) => api.excluirAutomacao(id, TIMEOUT_ROTA));
    });

    it('31.1 Deve devolver as quatro capabilities de automação como booleanos, sem 403, e a conta de teste ter a 635 com gravar, alterar e excluir', () => {
      api.obterCapabilitiesAutomacoes(TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status de GET /automation-capabilities').to.eq(200);
        expect(res.body.capabilities, 'Bloco capabilities').to.be.an('object');
        expect(Object.keys(res.body.capabilities), 'As quatro chaves, nem mais nem menos (can_activate virou can_edit)').to.have.members(CHAVES_CAPABILITIES_AUTOMACAO);
        CHAVES_CAPABILITIES_AUTOMACAO.forEach((chave) => {
          expect(res.body.capabilities[chave], `capabilities.${chave}`).to.eq(true);
        });
      });
    });

    it('31.2 Deve responder 401 sem token e 404 ao caminho antigo com /stores/:id, na listagem e nas capabilities', () => {
      api.listarAutomacoes(SEM_TOKEN).then((res) => {
        expect(res.status, 'GET /automations sem token').to.eq(401);
      });
      api.obterCapabilitiesAutomacoes(SEM_TOKEN).then((res) => {
        expect(res.status, 'GET /automation-capabilities sem token').to.eq(401);
      });
      api.get(`/stores/${storeId}/automations`, {}, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'GET /stores/:id/automations').to.eq(404);
      });
      api.get(`/stores/${storeId}/automation-capabilities`, {}, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'GET /stores/:id/automation-capabilities').to.eq(404);
      });
    });

    it('31.3 Deve criar a automação com os valores padrão, ler o detalhe com a mesma árvore e listá-la sem os passos', () => {
      criar('padrão').then((res) => {
        const criada = res.body.automation;
        expect(res.body.warnings, 'Avisos do POST').to.be.an('array');
        expect(criada.id, 'id').to.be.a('number');
        expect(criada.name, 'name').to.eq(nome('padrão'));
        expect(criada.trigger_type, 'trigger_type').to.eq('keyword_match');
        expect(criada.is_active, 'is_active é booleano JSON e nasce pausada').to.eq(false);
        expect(criada.all_channels, 'all_channels padrão').to.eq(true);
        expect(criada.channel_ids, 'channel_ids padrão').to.deep.eq([]);
        expect(criada.run_count, 'run_count').to.eq(0);
        expect(criada.last_run_at, 'last_run_at').to.eq(null);
        expect(criada.updated_at, 'updated_at em Instant/Z').to.match(/Z$/);
        expect(criada.steps[0].branches, 'Só a condição tem branches: o passo de mensagem devolve null').to.eq(null);
        expect(semIds(criada.steps), 'Árvore devolvida pelo POST').to.deep.eq(semIds(corpo('padrão').steps));

        detalhe(criada.id).then((lida) => {
          expect(semIds(lida.steps), 'Árvore do detalhe igual à do POST').to.deep.eq(semIds(criada.steps));
          expect(lida.updated_at, 'updated_at do detalhe = o da criação').to.eq(criada.updated_at);
          expect(lida.trigger_config, 'trigger_config do detalhe').to.deep.eq(corpo('padrão').trigger_config);
        });

        cy.then(() => api.listarAutomacoes(TIMEOUT_ROTA)).then((lista) => {
          expect(lista.status, 'Status de GET /automations').to.eq(200);
          expect(lista.body.data, 'data').to.be.an('array');
          expect(lista.body.total, 'total').to.be.a('number').and.to.be.at.least(lista.body.data.length);
          const linha = lista.body.data.find((a) => a.id === criada.id);
          expect(linha, 'A automação criada aparece na listagem').to.exist;
          expect(linha, 'A linha da listagem é o resumo').to.include.keys('id', 'name', 'trigger_type', 'is_active', 'run_count', 'last_run_at');
          expect(linha, 'A linha da listagem não traz os passos').not.to.have.property('steps');
          expect(linha, 'A linha da listagem não traz o trigger_config').not.to.have.property('trigger_config');
        });
      });
    });

    it('31.4 Deve renomear com o updated_at lido, devolver o updated_at novo e aceitar o save seguinte com ele, sem 409', () => {
      detalhe(principal.id).then((antes) => {
        api.atualizarAutomacao(principal.id, { name: nome('renomeada'), updated_at: antes.updated_at }, TIMEOUT_ROTA).then((res) => {
          expect(res.status, 'Status do 1º PATCH').to.eq(200);
          expect(res.body.automation.name, 'Nome novo').to.eq(nome('renomeada'));
          expect(res.body.automation.updated_at, 'updated_at novo em Instant/Z').to.match(/Z$/).and.not.to.eq(antes.updated_at);
          expect(res.body.warnings, 'Avisos do PATCH').to.be.an('array');

          api.atualizarAutomacao(principal.id, { name: nome('principal'), updated_at: res.body.automation.updated_at }, TIMEOUT_ROTA).then((seguinte) => {
            expect(seguinte.status, '2º PATCH seguido, com o updated_at da resposta anterior').to.eq(200);
            expect(seguinte.body.automation.name, 'Nome devolvido ao original').to.eq(nome('principal'));
          });
        });
      });
    });

    it('31.5 Deve ativar e pausar só com is_active, sem updated_at, e o switch invalidar o updated_at lido antes dele (409)', () => {
      detalhe(principal.id).then((antes) => {
        api.atualizarAutomacao(principal.id, { is_active: true }, TIMEOUT_ROTA).then((ligou) => {
          expect(ligou.status, 'PATCH { is_active: true } sem updated_at').to.eq(200);
          expect(ligou.body.automation.is_active, 'is_active booleano').to.eq(true);
        });
        // O switch também grava ALTERACAO_DT: quem editou depois de uma pausa pela listagem leva 409 e recarrega (decisão 3).
        api.atualizarAutomacao(principal.id, { name: nome('velha'), updated_at: antes.updated_at }, TIMEOUT_ROTA).then((velha) => {
          expect(velha.status, 'PATCH com o updated_at anterior ao switch').to.eq(409);
          expect(velha.body.code, 'code do 409').to.eq('AUTOMATION_CHANGED');
        });
        api.atualizarAutomacao(principal.id, { is_active: false }, TIMEOUT_ROTA).then((pausou) => {
          expect(pausou.status, 'PATCH { is_active: false } sem updated_at').to.eq(200);
          expect(pausou.body.automation.is_active, 'is_active booleano').to.eq(false);
        });
        detalhe(principal.id).then((depois) => {
          expect(depois.name, 'O 409 não gravou o nome').to.eq(nome('principal'));
          expect(depois.is_active, 'Pausada no fim').to.eq(false);
        });
      });
    });

    it('31.6 Deve duplicar a automação pausada, com o sufixo "(cópia)", contadores zerados e a mesma árvore', () => {
      detalhe(principal.id).then((origem) => {
        api.duplicarAutomacao(principal.id, TIMEOUT_ROTA).then((res) => {
          expect(res.status, 'Status de POST /automations/:id/duplicate').to.eq(201);
          const copia = res.body.automation;
          criadas.push(copia.id);
          expect(copia.id, 'A cópia tem outro id').to.be.a('number').and.not.to.eq(principal.id);
          expect(copia.name, 'Nome da cópia').to.eq(`${origem.name} (cópia)`);
          expect(copia.is_active, 'A cópia nasce pausada').to.eq(false);
          expect(copia.run_count, 'run_count da cópia').to.eq(0);
          expect(copia.last_run_at, 'last_run_at da cópia').to.eq(null);
          expect(copia.trigger_type, 'trigger_type da cópia').to.eq(origem.trigger_type);
          expect(semIds(copia.steps), 'A cópia leva a mesma árvore').to.deep.eq(semIds(origem.steps));
          detalhe(principal.id).then((intacta) => {
            expect(intacta.updated_at, 'Duplicar não mexe na original').to.eq(origem.updated_at);
          });
        });
      });
    });

    it('31.7 Deve apagar com 204 e a automação passar a responder 404 no detalhe, no segundo DELETE e na listagem', () => {
      criar('apagar').then((res) => {
        const id = res.body.automation.id;
        api.excluirAutomacao(id, TIMEOUT_ROTA).then((apagou) => {
          expect(apagou.status, 'Status do DELETE').to.eq(204);
        });
        api.obterAutomacao(id, TIMEOUT_ROTA).then((lida) => {
          expect(lida.status, 'GET da automação apagada').to.eq(404);
          expect(lida.body.message, 'Mensagem do 404').to.eq('Automação não encontrada.');
        });
        api.excluirAutomacao(id, TIMEOUT_ROTA).then((outra) => {
          expect(outra.status, 'Segundo DELETE da mesma automação').to.eq(404);
        });
        api.listarAutomacoes(TIMEOUT_ROTA).then((lista) => {
          expect(lista.body.data.map((a) => a.id), 'A apagada some da listagem').not.to.include(id);
        });
      });
    });

    it('31.8 Deve gravar e devolver a árvore com condição e passos dentro dos ramos, na mesma ordem, e avisar service_window_risk nos passos depois da espera', () => {
      const passos = [
        {
          step_type: 'condition',
          step_config: { subject: 'message_content', value: 'preço' },
          branches: {
            yes: [{ step_type: 'send_message', step_config: { text: 'Já te passo o valor.' } }],
            no: [
              { step_type: 'wait', step_config: { amount: 1, unit: 'hours' } },
              { step_type: 'send_message', step_config: { text: 'Posso ajudar?' } }
            ]
          }
        },
        { step_type: 'send_message', step_config: { text: 'Obrigado!' } }
      ];
      criar('árvore', { steps: passos }).then((res) => {
        const criada = res.body.automation;
        expect(semIds(criada.steps), 'Árvore devolvida pelo POST').to.deep.eq(semIds(passos));
        const avisos = res.body.warnings.filter((w) => w.code === 'service_window_risk').map((w) => w.path);
        expect(avisos, 'Avisos de janela de 24 h: o passo depois da espera, no ramo e fora dele').to.have.members(['steps.0.branches.no.1', 'steps.1']);
        detalhe(criada.id).then((lida) => {
          const [condicao, final] = lida.steps;
          expect(condicao.step_type, 'Passo 0').to.eq('condition');
          expect(condicao.branches.yes.map((p) => p.step_type), 'Ramo Sim').to.deep.eq(['send_message']);
          expect(condicao.branches.no.map((p) => p.step_type), 'Ramo Não, na ordem').to.deep.eq(['wait', 'send_message']);
          expect(final.step_type, 'Passo 1 fora da condição').to.eq('send_message');
          lida.steps.filter((p) => p.step_type !== 'condition').forEach((p) => {
            expect(p.branches ?? null, `branches do passo ${p.step_type}`).to.eq(null);
          });
          expect(semIds(lida.steps), 'Árvore do detalhe igual à enviada').to.deep.eq(semIds(passos));
        });
      });
    });

    it('31.9 Deve substituir a árvore inteira no PATCH com steps e, se um passo for recusado, responder 422 sem gravar nada', () => {
      const novos = [
        { step_type: 'send_message', step_config: { text: 'Primeira' } },
        { step_type: 'send_message', step_config: { text: 'Segunda' } }
      ];
      detalhe(principal.id).then((antes) => {
        api.atualizarAutomacao(principal.id, { steps: novos, updated_at: antes.updated_at }, TIMEOUT_ROTA).then((res) => {
          expect(res.status, 'PATCH com steps novos').to.eq(200);
          expect(semIds(res.body.automation.steps), 'A árvore nova substitui a antiga').to.deep.eq(semIds(novos));
        });
        detalhe(principal.id).then((trocada) => {
          expect(semIds(trocada.steps), 'O detalhe traz só a árvore nova').to.deep.eq(semIds(novos));
          const invalidos = [novos[0], { step_type: 'send_message', step_config: { text: 'Com ramo' }, branches: { yes: [], no: [] } }];
          api.atualizarAutomacao(principal.id, { steps: invalidos, updated_at: trocada.updated_at }, TIMEOUT_ROTA).then((recusa) => {
            exigirRecusa(recusa, 422, 'PATCH com ramo em passo que não é condição');
          });
          detalhe(principal.id).then((intacta) => {
            expect(semIds(intacta.steps), 'A árvore anterior continua inteira depois da recusa').to.deep.eq(semIds(novos));
            expect(intacta.updated_at, 'A recusa não mexeu no updated_at').to.eq(trocada.updated_at);
          });
        });
      });
    });

    it('31.10 Deve recusar o PATCH sem updated_at (422 updated_at_required), com updated_at antigo (409 AUTOMATION_CHANGED), com campo que a rota não aceita e com corpo vazio', () => {
      detalhe(principal.id).then((atual) => {
        api.atualizarAutomacao(principal.id, { name: nome('sem versão') }, TIMEOUT_ROTA).then((res) => {
          exigirRecusa(res, 422, 'PATCH sem updated_at');
          expect(res.body.issues[0].code, 'code do 1º problema').to.eq('updated_at_required');
        });
        api.atualizarAutomacao(principal.id, { name: nome('versão antiga'), updated_at: '2020-01-01T00:00:00.000Z' }, TIMEOUT_ROTA).then((res) => {
          exigirRecusa(res, 409, 'PATCH com updated_at antigo');
          expect(res.body.code, 'code do 409').to.eq('AUTOMATION_CHANGED');
        });
        api.atualizarAutomacao(principal.id, { run_count: 5, updated_at: atual.updated_at }, TIMEOUT_ROTA).then((res) => {
          exigirRecusa(res, 422, 'PATCH com campo que a rota não aceita (run_count)');
        });
        api.atualizarAutomacao(principal.id, {}, TIMEOUT_ROTA).then((res) => {
          exigirRecusa(res, 422, 'PATCH com corpo vazio');
        });
        detalhe(principal.id).then((depois) => {
          expect(depois.name, 'Nenhuma recusa gravou o nome').to.eq(atual.name);
          expect(depois.run_count, 'Nenhuma recusa gravou o run_count').to.eq(atual.run_count);
          expect(depois.updated_at, 'Nenhuma recusa mexeu no updated_at').to.eq(atual.updated_at);
        });
      });
    });

    it('31.11 Deve recusar o POST sem nome (400) e com ramo em passo que não é condição (422), e responder 422 ao id 0 e 404 ao id inexistente', () => {
      cy.then(() => api.criarAutomacao({ ...corpo('sem nome'), name: undefined }, TIMEOUT_ROTA)).then((res) => {
        exigirRecusa(res, 400, 'POST sem name');
      });
      cy.then(() => api.criarAutomacao(corpo('com ramo', { steps: [{ step_type: 'send_message', step_config: { text: 'Oi' }, branches: { yes: [], no: [] } }] }), TIMEOUT_ROTA)).then((res) => {
        exigirRecusa(res, 422, 'POST com branches em send_message');
      });
      api.obterAutomacao(0, TIMEOUT_ROTA).then((res) => {
        exigirRecusa(res, 422, 'GET /automations/0');
      });
      api.obterAutomacao(AUTOMACAO_INEXISTENTE, TIMEOUT_ROTA).then((res) => {
        exigirRecusa(res, 404, 'GET de automação inexistente');
        expect(res.body.message, 'Mensagem do 404').to.eq('Automação não encontrada.');
      });
    });

    it('31.12 Deve gravar o escopo por canal: lista de canais vale "estes canais", repetido cai e all_channels true zera a lista', function () {
      api.listarCanais(storeId, TIMEOUT_ROTA).then((canais) => {
        const lista = canais.body.items || canais.body.data || canais.body;
        // GET /channels já devolve só canais ativos da loja (o item não tem flag de ativo); descobre o canal na hora, sem id fixo.
        if (!lista.length) {
          cy.log('⏭️ Sem massa: nenhum canal ativo em GET /channels');
          this.skip();
        }
        const canal = lista[0].id;
        criar('canal', { all_channels: false, channel_ids: [canal] }).then((res) => {
          expect(res.body.automation.all_channels, 'all_channels false').to.eq(false);
          expect(res.body.automation.channel_ids, 'channel_ids').to.deep.eq([canal]);
        });
        criar('canal repetido', { channel_ids: [canal, canal] }).then((res) => {
          expect(res.body.automation.all_channels, 'Só a lista, sem all_channels: vale "estes canais"').to.eq(false);
          expect(res.body.automation.channel_ids, 'O repetido cai').to.deep.eq([canal]);
        });
        criar('canal e todos', { all_channels: true, channel_ids: [canal] }).then((res) => {
          expect(res.body.automation.all_channels, 'all_channels true').to.eq(true);
          expect(res.body.automation.channel_ids, 'all_channels true zera a lista').to.deep.eq([]);
        });
      });
    });

    it('31.13 Deve recusar o escopo por canal com all_channels false e nenhum canal (422 channels_required)', () => {
      cy.then(() => api.criarAutomacao(corpo('sem canal', { all_channels: false, channel_ids: [] }), TIMEOUT_ROTA)).then((res) => {
        exigirRecusa(res, 422, 'POST com all_channels false e channel_ids vazio');
        expect(res.body.issues.map((i) => i.code), 'Códigos dos problemas').to.include('channels_required');
      });
    });

    // Histórico de execuções (backend#743, PR #841): `GET /automations/:id/logs` → `{ data, has_next }`, do mais recente para o mais antigo (índice decrescente por automação e `CODIGO`),
    // `page` a partir de 1 e `per_page` de 1 a 100 (padrão 20), `has_next` lido com `per_page + 1` linhas. Medido na dev em 2026-11-06 (aba-c). O passo a passo de cada linha
    // (`steps_executed`) e o `run_count`/`last_run_at` já são provados no ctx 34 e no ctx 33; a retomada do `wait` no mesmo log é da backend#742.
    const LINHA_DO_LOG = ['id', 'client_id', 'attendance_id', 'trigger_event', 'status', 'steps_executed', 'error_message', 'created_at'];
    const INSTANT_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
    const historico = (automationId, query) => cy.then(() => api.listarExecucoesAutomacaoPaginado(automationId, query, TIMEOUT_ROTA)).then((res) => {
      expect(res.status, `Status do GET /automations/${automationId}/logs ${JSON.stringify(query)}`).to.eq(200);
      expect(res.body.has_next, `has_next de ${JSON.stringify(query)}`).to.be.a('boolean');
      return res.body;
    });

    it('31.14 Deve servir o histórico de execuções do mais recente para o mais antigo, 20 por página por padrão, fatiando page e per_page sem repetir nem pular e com has_next coerente até depois do fim (Issue backend#743)', function () {
      cy.then(() => api.listarAutomacoes(TIMEOUT_ROTA)).then((res) => {
        // Massa descoberta na hora ([R-ATEMPORAL]): entre as automações com execuções que cabem numa página de 100, a que rodou há mais tempo,
        // para um run novo não entrar no meio das leituras (se entrar, a rodada relê, até 3 vezes)
        const candidatas = (res.body.data || [])
          .filter((a) => a.run_count >= 5 && a.run_count <= 90 && a.last_run_at)
          .sort((a, b) => new Date(a.last_run_at) - new Date(b.last_run_at));
        if (!candidatas.length) {
          cy.log('⏭️ Sem massa: nenhuma automação com 5 a 90 execuções');
          this.skip();
        }
        const id = candidatas[0].id;
        const ids = (corpo) => corpo.data.map((linha) => linha.id);

        const medir = (tentativa) => historico(id, { per_page: 100 }).then((tudo) => {
          const n = tudo.data.length;
          const lido = {};
          historico(id, {}).then((c) => { lido.padrao = c; });
          historico(id, { page: 2, per_page: 2 }).then((c) => { lido.pagina2 = c; });
          historico(id, { page: 1, per_page: 1 }).then((c) => { lido.primeira = c; });
          historico(id, { page: n, per_page: 1 }).then((c) => { lido.ultima = c; });
          historico(id, { page: n + 1, per_page: 1 }).then((c) => { lido.alem = c; });
          return historico(id, { per_page: 100 }).then((depois) => {
            if (JSON.stringify(ids(depois)) !== JSON.stringify(ids(tudo)) && tentativa < 3) {
              cy.log(`Um run novo entrou durante as leituras (tentativa ${tentativa}); relendo`);
              return medir(tentativa + 1);
            }
            expect(ids(depois), 'O histórico não mudou durante as leituras').to.deep.eq(ids(tudo));
            expect(n, `Execuções da automação ${id} (run_count ${candidatas[0].run_count})`).to.be.within(5, 99);

            // Assert: ordem, forma da linha e has_next da página que cabe tudo
            const lista = ids(tudo);
            expect(lista, 'ids do mais recente para o mais antigo, sem repetir').to.deep.eq([...lista].sort((a, b) => b - a));
            expect(new Set(lista).size, 'Nenhum id repetido').to.eq(n);
            tudo.data.forEach((linha) => {
              expect(Object.keys(linha), `Chaves da linha ${linha.id}`).to.have.members(LINHA_DO_LOG);
              expect(linha.created_at, `created_at da linha ${linha.id} em Instant UTC`).to.match(INSTANT_UTC);
              expect(linha.steps_executed, `steps_executed da linha ${linha.id}`).to.be.an('array');
            });
            for (let i = 1; i < n; i += 1) {
              expect(new Date(tudo.data[i - 1].created_at).getTime(), `created_at da linha ${lista[i - 1]} não anterior ao da ${lista[i]}`).to.be.at.least(new Date(tudo.data[i].created_at).getTime());
            }
            expect(tudo.has_next, 'per_page 100 com menos de 100 linhas: has_next false').to.eq(false);

            // Assert: as fatias batem com a lista inteira
            expect(ids(lido.padrao), 'Sem parâmetros: as 20 mais recentes').to.deep.eq(lista.slice(0, 20));
            expect(lido.padrao.has_next, 'Sem parâmetros: has_next só se houver mais de 20').to.eq(n > 20);
            expect(ids(lido.pagina2), 'page 2 de 2: a 3ª e a 4ª, sem repetir nem pular').to.deep.eq(lista.slice(2, 4));
            expect(lido.pagina2.has_next, 'page 2 de 2: há uma 5ª').to.eq(true);
            expect(ids(lido.primeira), 'page 1 de 1: a mais recente').to.deep.eq([lista[0]]);
            expect(lido.primeira.has_next, 'page 1 de 1: há mais').to.eq(true);
            expect(ids(lido.ultima), `page ${n} de 1: a mais antiga`).to.deep.eq([lista[n - 1]]);
            expect(lido.ultima.has_next, 'Última página: has_next false').to.eq(false);
            expect(lido.alem.data, 'Página depois do fim: vazia, sem erro').to.deep.eq([]);
            expect(lido.alem.has_next, 'Página depois do fim: has_next false').to.eq(false);
          });
        });
        medir(1);
      });
    });

    it('31.15 Deve recusar com 422 a paginação inválida do histórico (per_page 0 e 101, page 0, negativa e texto e o deslocamento que estoura o inteiro) e aceitar per_page 100 (Issue backend#743)', () => {
      // O deslocamento de page 999999999 com per_page 100 não cabe em Int: antes da PR #841 chegava ao Firebird como SKIP negativo e respondia 500
      const invalidas = [{ per_page: 0 }, { per_page: 101 }, { page: 0 }, { page: -1 }, { page: 'abc' }, { page: 999999999, per_page: 100 }];
      invalidas.forEach((query) => {
        cy.then(() => api.listarExecucoesAutomacaoPaginado(principal.id, query, TIMEOUT_ROTA)).then((res) => {
          exigirRecusa(res, 422, `GET /automations/:id/logs ${JSON.stringify(query)}`);
          expect(res.body.message, `Mensagem de ${JSON.stringify(query)}`).to.eq('Parâmetros de paginação inválidos.');
        });
      });
      // Contraprova: o teto aceito (a principal nunca rodou: a palavra-chave não casa com mensagem real)
      historico(principal.id, { page: 1, per_page: 100 }).then((corpo) => {
        expect(corpo.data, 'per_page 100 aceito; a principal não tem execução').to.deep.eq([]);
        expect(corpo.has_next, 'has_next da lista vazia').to.eq(false);
      });
    });

    it('31.16 Deve listar o histórico da automação pausada e responder 404 ao da excluída, ao da inexistente e ao caminho antigo com /stores/:id (Issue backend#743)', () => {
      criar('histórico', { is_active: false }).then((res) => {
        const id = res.body.automation.id;
        expect(res.body.automation.is_active, 'Massa: automação pausada').to.eq(false);
        historico(id, {}).then((corpo) => {
          expect(corpo.data, 'Pausada lista normalmente (vazia, nunca rodou)').to.deep.eq([]);
          expect(corpo.has_next, 'has_next da pausada').to.eq(false);
        });
        api.get(`/stores/${storeId}/automations/${id}/logs`, {}, TIMEOUT_ROTA).then((r) => {
          expect(r.status, 'GET /stores/:id/automations/:id/logs').to.eq(404);
        });
        cy.then(() => api.excluirAutomacao(id, TIMEOUT_ROTA)).its('status').should('eq', 204);
        cy.then(() => api.listarExecucoesAutomacaoPaginado(id, {}, TIMEOUT_ROTA)).then((r) => {
          exigirRecusa(r, 404, 'GET /logs da automação excluída');
          expect(r.body.message, 'Mensagem do 404 da excluída').to.eq('Automação não encontrada.');
        });
      });
      cy.then(() => api.listarExecucoesAutomacaoPaginado(AUTOMACAO_INEXISTENTE, {}, TIMEOUT_ROTA)).then((r) => {
        exigirRecusa(r, 404, 'GET /logs de automação inexistente');
        expect(r.body.message, 'Mensagem do 404 da inexistente').to.eq('Automação não encontrada.');
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 32: AUTOMAÇÕES — VALIDAÇÃO NO SAVE E NA ATIVAÇÃO (Issue backend#739)
  // ---------------------------------------------------------------------------
  context('32. Automações: Validação no Save e na Ativação, Recusas 422 por Regra, Contraprova Pausada, PATCH que Julga o Resultado e Avisos da Janela de 24h (Issue backend#739)', () => {

    // A validação do save e da ativação de `/automations` (backend#739, PR #802, #803 e #804, sobre o CRUD da backend#738): o front valida enquanto o usuário edita, mas o servidor é a barreira.
    // Toda gravação valida a estrutura (tipos, matriz gatilho × passo, placeholders, aninhamento, janela de horário, ids, tamanhos, charset, canais); a ativação, e toda gravação de automação já ativa, valida também se está completa e se o que referencia existe.
    // Rascunho pausado salva incompleto (a contraprova de cada recusa de ativação é o mesmo corpo pausado respondendo 201). O 422 traz `issues: [{ path, message, code }]` e o front mostra o primeiro, então o teste confere o `issues[0]`.
    // Massa temporária própria ([R-ATEMPORAL]): gatilho `keyword_match` com palavra única que nunca casa com mensagem real (o motor da dev confere eventos a cada 30 s); template, substatus e canal são descobertos na hora (sem o 341, o 342, o canal 4 nem o funcionário 7 do roteiro de QA)
    // e o que não dá para descobrir vira id inexistente. A exclusão é lógica: a rodada apaga o que criou, mas a dev acumula as linhas apagadas (~15 por execução).
    // Sem teste (`ROADMAP.md` P1-61): a conta WABA do canal contra a do template (falha na execução, backend#741), o atendente que pertence ao grupo (motor), cooldown, webhook e `schedule` (issues desses gatilhos e passos), a divergência de serialização de número em notação exponencial nos 7000 caracteres
    // e a tradução dos cinco códigos novos pelo front (front#615, o construtor ainda roda no mock).
    const TIMEOUT_ROTA = { timeout: 90000 };
    const TOKEN = Date.now().toString(36);
    const PALAVRA = `zz${TOKEN}`;
    const nome = (sufixo) => `[Cypress] Backend 739 ${TOKEN} ${sufixo}`;
    const INEXISTENTE = 999999999;
    const DETALHE_INTERNO = /SQLSTATE|Firebird|Exception|An unexpected error|numeric value|string right truncation/i;
    const criadas = [];
    let principal;

    const passoTexto = (text) => ({ step_type: 'send_message', step_config: { text } });
    const corpo = (sufixo, extra = {}) => ({
      name: nome(sufixo),
      description: 'Massa temporária do contexto 32 de 0-A (backend#739)',
      trigger_type: 'keyword_match',
      trigger_config: { keywords: [PALAVRA], match_type: 'contains', case_sensitive: false },
      steps: [passoTexto('Olá {{client.name}}')],
      ...extra
    });
    // Gatilho que não é de palavra-chave: o `trigger_config` de `keyword_match` não vale para ele.
    const comGatilho = (trigger_type, extra = {}) => ({ trigger_type, trigger_config: undefined, ...extra });
    const condicaoHorario = (config = {}, yes = [], no = []) => ({ step_type: 'condition', step_config: { subject: 'time_of_day', value: '08:00-18:00', ...config }, branches: { yes, no } });
    const aninhar = (niveis) => {
      let passo = condicaoHorario();
      for (let i = 1; i < niveis; i++) passo = condicaoHorario({}, [passo]);
      return passo;
    };

    // Cria pela API, confere o `201` e registra o id para a limpeza do `after`. Devolve o corpo (`{ automation, warnings }`).
    const criar = (sufixo, extra = {}) => cy.then(() => api.criarAutomacao(corpo(sufixo, extra), TIMEOUT_ROTA)).then((res) => {
      expect(res.status, `Status do POST /automations "${sufixo}": ${JSON.stringify(res.body.issues || res.body.message || '')}`).to.eq(201);
      criadas.push(res.body.automation.id);
      return res.body;
    });
    // Tenta gravar o que o servidor deve recusar: o nome leva `recusa <sufixo>` para provar depois que nada ficou gravado.
    const tentar = (sufixo, extra = {}) => cy.then(() => api.criarAutomacao(corpo(`recusa ${sufixo}`, extra), TIMEOUT_ROTA));
    const detalhe = (automationId) => cy.then(() => api.obterAutomacao(automationId, TIMEOUT_ROTA)).then((res) => {
      expect(res.status, `Status do GET /automations/${automationId}`).to.eq(200);
      return res.body.automation;
    });
    const exigirIssue = (res, code, path, rotulo) => {
      expect(res.status, `Status de ${rotulo}: ${JSON.stringify(res.body)}`).to.eq(422);
      expect(res.body.issues, `issues de ${rotulo}`).to.be.an('array').and.not.to.be.empty;
      expect(res.body.issues[0].code, `code do 1º problema de ${rotulo}`).to.eq(code);
      expect(res.body.issues[0].path, `path do 1º problema de ${rotulo}`).to.eq(path);
      expect(res.body.issues[0].message, `message do 1º problema de ${rotulo}`).to.be.a('string').and.not.to.be.empty;
      expect(JSON.stringify(res.body), `A resposta de ${rotulo} não pode expor detalhe interno`).not.to.match(DETALHE_INTERNO);
    };
    const exigirNaoGravada = (sufixo) => cy.then(() => api.listarAutomacoes(TIMEOUT_ROTA)).then((res) => {
      const gravadas = (res.body.data || []).filter((a) => String(a.name).includes(`${TOKEN} recusa ${sufixo}`));
      expect(gravadas, `Nenhuma automação "recusa ${sufixo}" pode ter sido gravada pela recusa`).to.have.length(0);
    });
    // Descobre na hora um template com a variável principal e um sem ela (o roteiro de QA cita o 341 e o 342, ids da homologação).
    const descobrirTemplates = () => cy.then(() => api.listarCanais(storeId, TIMEOUT_ROTA)).then((canais) => {
      const lista = canais.body.items || canais.body.data || canais.body;
      const oficial = lista.find((c) => c.channel_subtype === 1) || lista[0];
      if (!oficial) return {};
      return cy.then(() => api.listarTemplatesWaba(storeId, { channel_id: oficial.id }, TIMEOUT_ROTA)).then((res) => {
        const itens = res.body.items || res.body.data || [];
        const temPrincipal = (t) => (t.variables || []).some((v) => v.principal === true);
        return { comPrincipal: itens.find(temPrincipal), semPrincipal: itens.find((t) => !temPrincipal(t)) };
      });
    });
    const passoTemplate = (template, texto) => ({ step_type: 'send_template', step_config: { template_id: template.id, ...(texto ? { template_text: texto } : {}) } });

    before(() => {
      api.autenticar();
      criar('principal').then((corpoCriado) => { principal = corpoCriado.automation; });
    });

    after(() => {
      criadas.forEach((id) => api.excluirAutomacao(id, TIMEOUT_ROTA));
    });

    it('32.1 Deve aceitar o texto com o emoji codificado em {{e:HEX}} (que não é placeholder), ativar, renomear a automação ativa e completa e pausar sem aviso', () => {
      criar('sucesso', { steps: [passoTexto('Olá {{client.name}} {{e:1F600}}')] }).then((criado) => {
        expect(criado.warnings, 'O {{e:1F600}} não é placeholder: sem aviso').to.deep.eq([]);
        expect(criado.automation.is_active, 'Nasce pausada').to.eq(false);
        const id = criado.automation.id;
        api.atualizarAutomacao(id, { is_active: true }, TIMEOUT_ROTA).then((ligou) => {
          expect(ligou.status, 'PATCH { is_active: true }').to.eq(200);
          expect(ligou.body.automation.is_active, 'Ativa').to.eq(true);
        });
        detalhe(id).then((ativa) => {
          api.atualizarAutomacao(id, { name: nome('sucesso renomeada'), updated_at: ativa.updated_at }, TIMEOUT_ROTA).then((renomeou) => {
            expect(renomeou.status, 'Renomear uma automação ativa e completa passa').to.eq(200);
            expect(renomeou.body.automation.name, 'Nome novo').to.eq(nome('sucesso renomeada'));
          });
        });
        api.atualizarAutomacao(id, { is_active: false }, TIMEOUT_ROTA).then((pausou) => {
          expect(pausou.status, 'PATCH { is_active: false }').to.eq(200);
          expect(pausou.body.automation.is_active, 'Pausada').to.eq(false);
          expect(pausou.body.warnings, 'Pausar sem aviso').to.deep.eq([]);
        });
      });
    });

    it('32.2 Deve criar ativa a automação com send_template de template aprovado e o template_text com placeholder do gatilho, sem aviso', function () {
      descobrirTemplates().then(({ comPrincipal }) => {
        if (!comPrincipal) {
          cy.log('⏭️ Sem massa: nenhum template WABA com variável principal em GET /waba-message-templates');
          this.skip();
        }
        criar('template ativo', { is_active: true, steps: [passoTemplate(comPrincipal, 'Pedido {{attendance.id}}')] }).then((criado) => {
          expect(criado.automation.is_active, 'Criada ativa').to.eq(true);
          expect(criado.warnings, 'send_template pode sair fora da janela de 24h: sem aviso').to.deep.eq([]);
        });
      });
    });

    it('32.3 Deve recusar na gravação, mesmo pausada, o gatilho desconhecido, o passo incompatível com o gatilho e o placeholder que o gatilho não fornece, sem gravar', () => {
      tentar('gatilho', comGatilho('foo')).then((res) => {
        exigirIssue(res, 'unknown_type', 'trigger_type', 'trigger_type desconhecido');
      });
      tentar('matriz', comGatilho('new_client_created')).then((res) => {
        exigirIssue(res, 'step_not_allowed_for_trigger', 'steps.0', 'send_message sob new_client_created (o gatilho não tem atendimento)');
      });
      tentar('placeholder', { steps: [passoTexto('Olá {{foo}}')] }).then((res) => {
        exigirIssue(res, 'placeholder_unavailable', 'steps.0.step_config.text', 'placeholder {{foo}}');
      });
      exigirNaoGravada('gatilho');
      exigirNaoGravada('matriz');
      exigirNaoGravada('placeholder');
    });

    it('32.4 Deve recusar o quarto nível de condição aninhada (nesting_too_deep, no passo do 4º nível) e aceitar o terceiro', () => {
      tentar('aninhamento', { steps: [aninhar(4)] }).then((res) => {
        exigirIssue(res, 'nesting_too_deep', 'steps.0.branches.yes.0.branches.yes.0.branches.yes.0', 'quatro condições aninhadas');
      });
      exigirNaoGravada('aninhamento');
      criar('três níveis', { steps: [aninhar(3)] }).then((criado) => {
        expect(criado.automation.steps[0].branches.yes[0].branches.yes[0].step_type, 'O 3º nível foi gravado').to.eq('condition');
      });
    });

    it('32.5 Deve recusar a janela de horário inválida (time_window_invalid) no valor, nos dias e no fuso, apontando o campo', () => {
      tentar('janela valor', { steps: [condicaoHorario({ value: '25:00-08:00' })] }).then((res) => {
        exigirIssue(res, 'time_window_invalid', 'steps.0.step_config.value', 'janela 25:00-08:00');
      });
      tentar('janela dias', { steps: [condicaoHorario({ days: [7] })] }).then((res) => {
        exigirIssue(res, 'time_window_invalid', 'steps.0.step_config.days', 'dia 7 na janela');
      });
      tentar('janela fuso', { steps: [condicaoHorario({ timezone: 'Marte/Base' })] }).then((res) => {
        exigirIssue(res, 'time_window_invalid', 'steps.0.step_config.timezone', 'fuso Marte/Base');
      });
      exigirNaoGravada('janela');
    });

    it('32.6 Deve recusar o id inválido do atendente (invalid_id), o rodízio sem grupo (group_required) e o passo que não existe na v1 (step_unavailable)', () => {
      tentar('id inválido', { steps: [{ step_type: 'assign_attendance', step_config: { mode: 'specific', agent_id: 0 } }] }).then((res) => {
        exigirIssue(res, 'invalid_id', 'steps.0.step_config.agent_id', 'agent_id 0');
      });
      tentar('rodízio', { steps: [{ step_type: 'assign_attendance', step_config: { mode: 'round_robin' } }] }).then((res) => {
        exigirIssue(res, 'group_required', 'steps.0.step_config.group_id', 'round_robin sem group_id');
      });
      tentar('indisponível', { steps: [{ step_type: 'update_client_field', step_config: {} }] }).then((res) => {
        exigirIssue(res, 'step_unavailable', 'steps.0', 'update_client_field (fora da v1)');
      });
      exigirNaoGravada('id inválido');
      exigirNaoGravada('rodízio');
      exigirNaoGravada('indisponível');
    });

    it('32.7 Deve recusar o nome de 126 caracteres, a descrição de 501 e o config acima de 7000 caracteres, e aceitar o nome de 125 e a descrição de 500', () => {
      tentar('nome longo', { name: nome('recusa nome longo').padEnd(126, 'x') }).then((res) => {
        exigirIssue(res, 'name_too_long', 'name', 'nome com 126 caracteres');
      });
      tentar('descrição longa', { description: 'd'.repeat(501) }).then((res) => {
        exigirIssue(res, 'description_too_long', 'description', 'descrição com 501 caracteres');
      });
      tentar('config longo', { steps: [passoTexto('a'.repeat(7000))] }).then((res) => {
        exigirIssue(res, 'config_too_long', 'steps.0.step_config', 'texto de 7000 caracteres (o config serializado passa do teto)');
      });
      exigirNaoGravada('nome longo');
      exigirNaoGravada('descrição longa');
      exigirNaoGravada('config longo');
      criar('limite', { name: nome('limite').padEnd(125, 'x'), description: 'd'.repeat(500) }).then((criado) => {
        expect(criado.automation.name, 'Nome de 125 caracteres gravado inteiro').to.have.length(125);
        expect(criado.automation.description, 'Descrição de 500 caracteres gravada inteira').to.have.length(500);
      });
    });

    it('32.8 Deve recusar o emoji cru no nome (unsupported_characters), porque o banco é WIN1252 e o emoji chega codificado em {{e:HEX}}', () => {
      tentar('emoji', { name: `${nome('recusa emoji')} 😀` }).then((res) => {
        exigirIssue(res, 'unsupported_characters', 'name', 'nome com emoji cru');
      });
      exigirNaoGravada('emoji');
    });

    it('32.9 Deve recusar o canal inexistente (channel_invalid) e devolver os issues na ordem estrutura, depois canal', () => {
      tentar('canal', { all_channels: false, channel_ids: [INEXISTENTE] }).then((res) => {
        exigirIssue(res, 'channel_invalid', 'channel_ids[0]', 'canal inexistente');
      });
      tentar('ordem', { steps: [passoTexto('Olá {{foo}}')], all_channels: false, channel_ids: [] }).then((res) => {
        expect(res.status, 'Status com dois problemas').to.eq(422);
        const codigos = res.body.issues.map((i) => i.code);
        expect(codigos, 'Os dois problemas vêm na resposta').to.include.members(['placeholder_unavailable', 'channels_required']);
        expect(codigos.indexOf('placeholder_unavailable'), 'A estrutura vem antes do canal: o front mostra o 1º').to.be.lessThan(codigos.indexOf('channels_required'));
      });
      exigirNaoGravada('canal');
      exigirNaoGravada('ordem');
    });

    it('32.10 Deve recusar ativar com o texto vazio (text_required) e sem passos (steps_required), e salvar o mesmo texto vazio como rascunho pausado', () => {
      tentar('texto vazio ativa', { is_active: true, steps: [passoTexto('')] }).then((res) => {
        exigirIssue(res, 'text_required', 'steps.0.step_config.text', 'ativar com texto vazio');
      });
      tentar('sem passos ativa', { is_active: true, steps: [] }).then((res) => {
        exigirIssue(res, 'steps_required', 'steps', 'ativar sem passos');
      });
      exigirNaoGravada('texto vazio ativa');
      exigirNaoGravada('sem passos ativa');
      criar('rascunho vazio', { is_active: false, steps: [passoTexto('')] }).then((criado) => {
        expect(criado.automation.is_active, 'O rascunho pausado salva incompleto').to.eq(false);
      });
    });

    it('32.11 Deve recusar ativar com template, grupo, atendente ou substatus inexistente, e salvar o template inexistente como rascunho pausado', () => {
      const ativar = (passo) => ({ is_active: true, steps: [passo] });
      tentar('template inexistente', ativar({ step_type: 'send_template', step_config: { template_id: INEXISTENTE } })).then((res) => {
        exigirIssue(res, 'template_not_found', 'steps.0.step_config.template_id', 'template inexistente');
      });
      tentar('grupo inexistente', ativar({ step_type: 'assign_attendance', step_config: { mode: 'round_robin', group_id: INEXISTENTE } })).then((res) => {
        exigirIssue(res, 'group_not_found', 'steps.0.step_config.group_id', 'grupo inexistente');
      });
      tentar('atendente inexistente', ativar({ step_type: 'assign_attendance', step_config: { mode: 'specific', agent_id: INEXISTENTE } })).then((res) => {
        exigirIssue(res, 'agent_not_found', 'steps.0.step_config.agent_id', 'atendente inexistente');
      });
      tentar('substatus inexistente', ativar({ step_type: 'set_custom_status', step_config: { custom_status_id: INEXISTENTE } })).then((res) => {
        exigirIssue(res, 'custom_status_not_found', 'steps.0.step_config.custom_status_id', 'substatus inexistente');
      });
      exigirNaoGravada('template inexistente');
      exigirNaoGravada('grupo inexistente');
      exigirNaoGravada('atendente inexistente');
      exigirNaoGravada('substatus inexistente');
      criar('rascunho template inexistente', { is_active: false, steps: [{ step_type: 'send_template', step_config: { template_id: INEXISTENTE } }] }).then((criado) => {
        expect(criado.automation.is_active, 'A referência inexistente só é recusada na ativação').to.eq(false);
      });
    });

    it('32.12 Deve recusar ativar com a variável principal do template mal preenchida (template_text_required): sem o texto quando o template tem variável principal e com o texto quando não tem', function () {
      descobrirTemplates().then(({ comPrincipal, semPrincipal }) => {
        if (!comPrincipal || !semPrincipal) {
          cy.log('⏭️ Sem massa: a loja não tem um template com e outro sem variável principal em GET /waba-message-templates');
          this.skip();
        }
        tentar('sem texto', { is_active: true, steps: [passoTemplate(comPrincipal)] }).then((res) => {
          exigirIssue(res, 'template_text_required', 'steps.0.step_config.template_text', 'template com variável principal sem template_text');
        });
        tentar('com texto', { is_active: true, steps: [passoTemplate(semPrincipal, 'Oi')] }).then((res) => {
          exigirIssue(res, 'template_text_required', 'steps.0.step_config.template_text', 'template sem variável principal com template_text');
        });
        exigirNaoGravada('sem texto');
        exigirNaoGravada('com texto');
      });
    });

    it('32.13 Deve aceitar ativa a troca de substatus que limpa (custom_status_id null) e a que aponta para um substatus existente', function () {
      criar('substatus limpa', { is_active: true, steps: [{ step_type: 'set_custom_status', step_config: { custom_status_id: null } }] }).then((criado) => {
        expect(criado.automation.is_active, 'custom_status_id null limpa o substatus e vale ativa').to.eq(true);
      });
      cy.then(() => api.obterStatusPersonalizados(storeId, TIMEOUT_ROTA)).then((res) => {
        const lista = res.body.items || res.body.data || res.body;
        const existente = (Array.isArray(lista) ? lista : []).find((s) => Number.isInteger(s.id));
        if (!existente) {
          cy.log('⏭️ Sem massa: nenhum substatus personalizado em GET /attendance-custom-statuses (só o null foi provado)');
          return;
        }
        criar('substatus existente', { is_active: true, steps: [{ step_type: 'set_custom_status', step_config: { custom_status_id: existente.id } }] }).then((criado) => {
          expect(criado.automation.is_active, 'Substatus existente vale ativa').to.eq(true);
        });
      });
    });

    it('32.14 Deve julgar o que está gravado ao ativar pelo switch (text_required), nunca recusar a pausa e não julgar a cópia pela completude', () => {
      criar('gravada vazia', { is_active: false, steps: [passoTexto('')] }).then((criado) => {
        const id = criado.automation.id;
        api.atualizarAutomacao(id, { is_active: true }, TIMEOUT_ROTA).then((res) => {
          exigirIssue(res, 'text_required', 'steps.0.step_config.text', 'switch que ativa a automação gravada com texto vazio');
        });
        api.atualizarAutomacao(id, { is_active: false }, TIMEOUT_ROTA).then((res) => {
          expect(res.status, 'Pausar nunca é recusado').to.eq(200);
        });
        api.duplicarAutomacao(id, TIMEOUT_ROTA).then((res) => {
          expect(res.status, 'Duplicar a automação incompleta').to.eq(201);
          criadas.push(res.body.automation.id);
          expect(res.body.automation.name, 'Nome da cópia').to.eq(`${nome('gravada vazia')} (cópia)`);
          expect(res.body.automation.is_active, 'A cópia nasce pausada').to.eq(false);
        });
      });
    });

    it('32.15 Deve recusar o save que deixaria a automação ativa quebrada (text_required) e manter a gravada ativa e inteira', () => {
      criar('ativa completa', { is_active: true }).then((criado) => {
        const id = criado.automation.id;
        detalhe(id).then((antes) => {
          api.atualizarAutomacao(id, { steps: [passoTexto('')], updated_at: antes.updated_at }, TIMEOUT_ROTA).then((res) => {
            exigirIssue(res, 'text_required', 'steps.0.step_config.text', 'PATCH que esvazia o texto de uma automação ativa');
          });
          detalhe(id).then((depois) => {
            expect(depois.is_active, 'Continua ativa').to.eq(true);
            expect(depois.steps[0].step_config.text, 'O texto gravado continua o de antes').to.eq(antes.steps[0].step_config.text);
            expect(depois.updated_at, 'A recusa não mexeu no updated_at').to.eq(antes.updated_at);
          });
        });
      });
    });

    it('32.16 Deve julgar o resultado do PATCH e não só o corpo: trocar o gatilho para um incompatível com o passo gravado é recusado (step_not_allowed_for_trigger)', () => {
      detalhe(principal.id).then((antes) => {
        api.atualizarAutomacao(principal.id, { trigger_type: 'new_client_created', updated_at: antes.updated_at }, TIMEOUT_ROTA).then((res) => {
          exigirIssue(res, 'step_not_allowed_for_trigger', 'steps.0', 'PATCH do gatilho com send_message gravado');
        });
        detalhe(principal.id).then((depois) => {
          expect(depois.trigger_type, 'O gatilho não mudou').to.eq('keyword_match');
          expect(depois.updated_at, 'A recusa não mexeu no updated_at').to.eq(antes.updated_at);
        });
      });
    });

    it('32.17 Deve avisar service_window_risk (sem bloquear) no passo depois de uma espera e sob gatilho que não é de mensagem, e não avisar no send_template', function () {
      const espera = { step_type: 'wait', step_config: { amount: 1, unit: 'hours' } };
      const riscos = (corpoCriado) => corpoCriado.warnings.filter((w) => w.code === 'service_window_risk');
      criar('aviso espera', { steps: [espera, passoTexto('Oi')] }).then((criado) => {
        expect(riscos(criado).map((w) => w.path), 'Aviso só no passo depois da espera').to.deep.eq(['steps.1']);
        expect(riscos(criado)[0].message, 'message do aviso').to.be.a('string').and.not.to.be.empty;
      });
      criar('aviso gatilho', comGatilho('attendance_opened', { steps: [passoTexto('Oi')] })).then((criado) => {
        expect(riscos(criado).map((w) => w.path), 'attendance_opened não é uma mensagem do cliente: aviso no passo 0').to.deep.eq(['steps.0']);
      });
      descobrirTemplates().then(({ comPrincipal, semPrincipal }) => {
        const template = semPrincipal || comPrincipal;
        if (!template) {
          cy.log('⏭️ Sem massa: nenhum template em GET /waba-message-templates (só os avisos de mensagem foram provados)');
          return;
        }
        criar('aviso template', comGatilho('attendance_opened', { steps: [passoTemplate(template, template === comPrincipal ? 'Pedido {{attendance.id}}' : undefined)] })).then((criado) => {
          expect(riscos(criado), 'Template pode sair fora da janela de 24h: sem aviso').to.have.length(0);
        });
      });
    });

    it('32.18 Deve aceitar ativa a espera de até 30 dias (43200 minutos), recusar ativa a de 43201 minutos, a de 31 dias e a de zero (wait_amount_invalid) e salvar a acima do teto só como rascunho pausado (Issue backend#742)', () => {
      // A palavra-chave única nunca casa com mensagem real: a espera ativa não chega a estacionar nada no motor
      const comEspera = (amount, unit = 'minutes') => ({ steps: [{ step_type: 'wait', step_config: { amount, unit } }, passoTexto('Oi')] });
      const CAMPO = 'steps.0.step_config.amount';
      criar('espera 30 dias', { is_active: true, ...comEspera(43200) }).then((criado) => {
        expect(criado.automation.is_active, 'O teto exato (43200 minutos) ativa').to.eq(true);
      });
      tentar('espera 43201', { is_active: true, ...comEspera(43201) }).then((res) => exigirIssue(res, 'wait_amount_invalid', CAMPO, 'ativar com espera de 43201 minutos'));
      tentar('espera 31 dias', { is_active: true, ...comEspera(31, 'days') }).then((res) => exigirIssue(res, 'wait_amount_invalid', CAMPO, 'ativar com espera de 31 dias'));
      tentar('espera zero', { is_active: true, ...comEspera(0) }).then((res) => exigirIssue(res, 'wait_amount_invalid', CAMPO, 'ativar com espera de 0 minutos'));
      exigirNaoGravada('espera 43201');
      exigirNaoGravada('espera 31 dias');
      exigirNaoGravada('espera zero');
      // O teto é checagem de completude: o rascunho pausado grava e só a ativação dele é recusada
      criar('rascunho espera 43201', { is_active: false, ...comEspera(43201) }).then((criado) => {
        const id = criado.automation.id;
        api.atualizarAutomacao(id, { is_active: true }, TIMEOUT_ROTA).then((res) => exigirIssue(res, 'wait_amount_invalid', CAMPO, 'switch que ativa o rascunho com espera de 43201 minutos'));
        detalhe(id).then((gravada) => {
          expect(gravada.is_active, 'O rascunho continua pausado').to.eq(false);
          expect(gravada.steps[0].step_config.amount, 'A espera gravada não muda').to.eq(43201);
        });
      });
    });

    it('32.19 Deve aceitar ativo o limite de resposta por cliente de 0 a 168 horas, nulo ou ausente, recusar ativo o negativo, o 169, o fracionário e o texto (reply_cooldown_invalid), salvar o inválido só como rascunho pausado e ignorá-lo no gatilho Agendado (Issue backend#744)', () => {
      // A palavra-chave única nunca casa com mensagem real: nenhuma automação ativa daqui chega a enviar
      const comLimite = (horas) => ({ trigger_config: { keywords: [PALAVRA], match_type: 'contains', case_sensitive: false, ...(horas === undefined ? {} : { reply_cooldown_hours: horas }) } });
      const CAMPO = 'trigger_config.reply_cooldown_hours';
      [0, 168, null, undefined].forEach((horas) => {
        criar(`limite ${horas}`, { is_active: true, ...comLimite(horas) }).then((criado) => {
          expect(criado.automation.is_active, `Limite ${horas} ativa`).to.eq(true);
          if (horas !== undefined) expect(criado.automation.trigger_config.reply_cooldown_hours, `O limite ${horas} gravado como veio`).to.eq(horas);
        });
      });
      [-1, 169, 1.5, '2'].forEach((horas) => {
        tentar(`limite ${horas}`, { is_active: true, ...comLimite(horas) }).then((res) => exigirIssue(res, 'reply_cooldown_invalid', CAMPO, `ativar com reply_cooldown_hours ${JSON.stringify(horas)}`));
        exigirNaoGravada(`limite ${horas}`);
      });
      // O limite é checagem de completude: o rascunho pausado grava e só a ativação dele é recusada
      criar('rascunho limite 169', { is_active: false, ...comLimite(169) }).then((criado) => {
        const id = criado.automation.id;
        api.atualizarAutomacao(id, { is_active: true }, TIMEOUT_ROTA).then((res) => exigirIssue(res, 'reply_cooldown_invalid', CAMPO, 'switch que ativa o rascunho com reply_cooldown_hours 169'));
        detalhe(id).then((gravada) => expect(gravada.is_active, 'O rascunho continua pausado').to.eq(false));
      });
      // O gatilho Agendado não tem cliente: o limite é ignorado nele, mesmo fora de 0 a 168
      criar('agendado limite 500', comGatilho('time_based', {
        is_active: true,
        trigger_config: { schedule: '03:00', days: [0], timezone: 'America/Sao_Paulo', reply_cooldown_hours: 500 },
        steps: [condicaoHorario()],
      })).then((criado) => {
        expect(criado.automation.is_active, 'Agendado ativa com o limite fora da faixa').to.eq(true);
      });
    });

    it('32.20 Deve aceitar o gatilho Agendado (time_based) com horário HH:mm, recusar o horário, os dias e o fuso inválidos mesmo no rascunho (schedule_invalid), exigir o horário só na ativação (schedule_required) e limitar os passos aos que não dependem de atendimento (Issue backend#746)', () => {
      // Domingo às 03:00: o relógio do motor não chega a disparar nada durante a rodada
      const agendado = (trigger_config, extra = {}) => comGatilho('time_based', { trigger_config, steps: [condicaoHorario()], ...extra });
      criar('agendado completo', { is_active: true, ...agendado({ schedule: '03:00', days: [0, 6], timezone: 'America/Manaus' }) }).then((criado) => {
        expect(criado.automation.is_active, 'O Agendado completo ativa').to.eq(true);
        expect(criado.automation.trigger_config, 'Horário, dias e fuso gravados como vieram').to.include({ schedule: '03:00', timezone: 'America/Manaus' });
      });
      criar('agendado com espera', { is_active: true, ...agendado({ schedule: '03:00', days: [0] }, { steps: [{ step_type: 'wait', step_config: { amount: 1, unit: 'minutes' } }, condicaoHorario()] }) });
      // O horário em branco ou ausente só é cobrado na ativação: a tela salva { schedule: '' } enquanto o usuário escolhe
      tentar('agendado em branco ativo', { is_active: true, ...agendado({ schedule: '' }) }).then((res) => exigirIssue(res, 'schedule_required', 'trigger_config.schedule', 'ativar o Agendado com o horário em branco'));
      tentar('agendado sem horario ativo', { is_active: true, ...agendado({}) }).then((res) => exigirIssue(res, 'schedule_required', 'trigger_config.schedule', 'ativar o Agendado sem o horário'));
      criar('agendado em branco rascunho', { is_active: false, ...agendado({ schedule: '' }) }).then((criado) => expect(criado.automation.is_active, 'O rascunho em branco grava').to.eq(false));
      // Formato inválido é recusado em qualquer save, rascunho pausado incluído
      ['25:00', '3:00', '03:00:00', '03h00', 3].forEach((horario) => {
        tentar(`agendado horario ${horario}`, { is_active: false, ...agendado({ schedule: horario }) }).then((res) => exigirIssue(res, 'schedule_invalid', 'trigger_config.schedule', `rascunho com o horário ${JSON.stringify(horario)}`));
      });
      [[7], [1, 1], []].forEach((dias) => {
        tentar(`agendado dias ${JSON.stringify(dias)}`, { is_active: false, ...agendado({ schedule: '03:00', days: dias }) }).then((res) => exigirIssue(res, 'schedule_invalid', 'trigger_config.days', `rascunho com os dias ${JSON.stringify(dias)}`));
      });
      tentar('agendado fuso inexistente', { is_active: false, ...agendado({ schedule: '03:00', timezone: 'Mars/Olympus' }) }).then((res) => exigirIssue(res, 'schedule_invalid', 'trigger_config.timezone', 'rascunho com o fuso desconhecido'));
      // Sem cliente nem atendimento no disparo: só espera, condição de horário e webhook
      tentar('agendado com mensagem', { is_active: true, ...agendado({ schedule: '03:00' }, { steps: [passoTexto('Oi')] }) }).then((res) => exigirIssue(res, 'step_not_allowed_for_trigger', 'steps.0', 'Agendado com send_message'));
      tentar('agendado com condicao de status', { is_active: false, ...agendado({ schedule: '03:00' }, { steps: [{ step_type: 'condition', step_config: { subject: 'attendance_status', value: '1' }, branches: { yes: [], no: [] } }] }) }).then((res) => exigirIssue(res, 'step_not_allowed_for_trigger', 'steps.0', 'Agendado com condição de status do atendimento'));
      ['agendado em branco ativo', 'agendado sem horario ativo', 'agendado horario 25:00', 'agendado dias []', 'agendado fuso inexistente', 'agendado com mensagem'].forEach((sufixo) => exigirNaoGravada(sufixo));
    });

    it('32.21 Deve aceitar a janela de horário que passa da meia-noite, o fim 24:00 e os sete dias, e recusar a lista de dias vazia, os dias repetidos e o início 24:00 (time_window_invalid) (Issue backend#735, A6)', () => {
      // Arrange: rascunho pausado, porque a janela é validação de estrutura (vale em qualquer save)
      const comJanela = (config) => ({ is_active: false, steps: [condicaoHorario(config)] });
      // Assert: as formas que a A6 define como válidas gravam como vieram
      [
        ['meia-noite', { value: '22:00-06:00' }],
        ['fim 24h', { value: '18:00-24:00' }],
        ['sete dias', { days: [0, 1, 2, 3, 4, 5, 6] }],
      ].forEach(([sufixo, config]) => {
        criar(`janela ${sufixo}`, comJanela(config)).then((criado) => {
          expect(criado.automation.steps[0].step_config, `A janela "${sufixo}" grava como veio`).to.include(config.value ? { value: config.value } : {});
          if (config.days) expect(criado.automation.steps[0].step_config.days, 'Os sete dias gravados').to.deep.eq(config.days);
        });
      });
      // Assert: as inválidas são recusadas no campo certo, sem gravar
      tentar('janela dias vazios', comJanela({ days: [] })).then((res) => exigirIssue(res, 'time_window_invalid', 'steps.0.step_config.days', 'lista de dias vazia'));
      tentar('janela dias repetidos', comJanela({ days: [1, 1] })).then((res) => exigirIssue(res, 'time_window_invalid', 'steps.0.step_config.days', 'dias repetidos'));
      tentar('janela inicio 24h', comJanela({ value: '24:00-06:00' })).then((res) => exigirIssue(res, 'time_window_invalid', 'steps.0.step_config.value', 'início 24:00'));
      ['janela dias vazios', 'janela dias repetidos', 'janela inicio 24h'].forEach((sufixo) => exigirNaoGravada(sufixo));
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 33: AUTOMAÇÕES — AUTOMAÇÕES PADRÃO (Issue backend#747)
  // ---------------------------------------------------------------------------
  context('33. Automações Padrão: is_default na Lista e no Detalhe, Estrutura que Passa no Save, Duplicar em Cópia Comum, Ativar só com o Dado da Loja e Editar sem Perder a Marca (Issue backend#747)', () => {

    // As automações padrão (backend#747, Decisões de 04/11, PR #858) são gravadas no banco de cada farmácia pelo runner (v022, coluna MODELO), nascem pausadas e
    // não podem ser excluídas; a API só expõe `is_default`. Medido na dev em 2026-11-06 (aba-c): 11 padrão, todas pausadas e em todos os canais.
    // Massa: as padrão são descobertas na hora pelo `is_default` (nada por id nem nome; um script futuro pode acrescentar outras). Nenhum teste muda o conteúdo de uma
    // padrão de forma duradoura: a estrutura é provada recriando a árvore como rascunho da rodada; a ativação só é tentada esperando a recusa (e, se um dia ativar,
    // pausa na hora); a edição troca o nome de uma padrão pausada e o devolve no mesmo teste e no after.
    // Sem teste (`ROADMAP.md` P1-70): o `DELETE` numa padrão (`422 DEFAULT_AUTOMATION_NOT_DELETABLE`), porque uma regressão apagaria de vez uma padrão compartilhada da dev
    // (decisão do operador, 2026-11-06), e o `403` sem o grant de exclusão (conta única).
    const TIMEOUT_ROTA = { timeout: 90000 };
    const TOKEN = Date.now().toString(36);
    const minhas = [];
    let padrao = [];
    let renomeada = null;

    const semIds = (passos) => JSON.parse(JSON.stringify(passos || []), (chave, valor) => (chave === 'id' ? undefined : valor));
    const detalhe = (id) => cy.then(() => api.obterAutomacao(id, TIMEOUT_ROTA)).then((res) => {
      expect(res.status, `Status do GET /automations/${id}`).to.eq(200);
      return res.body.automation;
    });
    const pularSemPadrao = (ctx) => {
      if (!padrao.length) {
        cy.log('⏭️ Sem massa: nenhuma automação com is_default na loja');
        ctx.skip();
      }
    };
    const temPasso = (passos, tipo, filtro = () => true) => (passos || []).some((p) => p.step_type === tipo && filtro(p.step_config || {}));

    before(() => {
      api.autenticar();
      cy.then(() => api.listarAutomacoes(TIMEOUT_ROTA)).then((res) => {
        expect(res.status, 'Status do GET /automations').to.eq(200);
        padrao = (res.body.data || []).filter((a) => a.is_default === true);
      });
    });

    after(() => {
      minhas.forEach((id) => api.excluirAutomacao(id, TIMEOUT_ROTA));
      // Devolve o nome da padrão editada, caso o teste tenha parado no meio
      if (renomeada) {
        api.obterAutomacao(renomeada.id, TIMEOUT_ROTA).then((res) => {
          const atual = res.body.automation;
          if (atual && atual.name !== renomeada.name) api.atualizarAutomacao(renomeada.id, { name: renomeada.name, updated_at: atual.updated_at }, TIMEOUT_ROTA);
        });
      }
    });

    it('33.1 Deve marcar is_default em todo item da lista, igual no detalhe, e a árvore de cada padrão passar na validação do save quando recriada como rascunho comum', function () {
      cy.then(() => api.listarAutomacoes(TIMEOUT_ROTA)).then((res) => {
        (res.body.data || []).forEach((item) => {
          expect(item.is_default, `is_default do item ${item.id} da lista`).to.be.a('boolean');
        });
      });
      pularSemPadrao(this);
      padrao.forEach((item) => {
        detalhe(item.id).then((automacao) => {
          expect(automacao.is_default, `is_default do detalhe ${item.id} igual ao da lista`).to.eq(true);
          // Arrange + Act: a mesma árvore, como rascunho pausado da rodada
          const corpo = {
            name: `[Cypress] Backend 747 ${TOKEN} ${item.id}`, description: automacao.description, trigger_type: automacao.trigger_type, trigger_config: automacao.trigger_config,
            all_channels: automacao.all_channels, channel_ids: automacao.channel_ids || [], is_active: false, steps: semIds(automacao.steps),
          };
          cy.then(() => api.criarAutomacao(corpo, TIMEOUT_ROTA)).then((resCopia) => {
            // Assert: a estrutura passa no save (Decisão 10) e a cópia não herda a marca
            expect(resCopia.status, `A árvore da padrão ${item.id} ("${item.name}") passa no save: ${JSON.stringify(resCopia.body.issues || '')}`).to.eq(201);
            minhas.push(resCopia.body.automation.id);
            expect(resCopia.body.automation.is_default, `A recriação da padrão ${item.id} é comum`).to.eq(false);
            expect(semIds(resCopia.body.automation.steps), `Mesma árvore de passos da padrão ${item.id}`).to.deep.eq(semIds(automacao.steps));
          });
        });
      });
    });

    it('33.2 Deve duplicar a automação padrão numa cópia comum e pausada, que pode ser excluída', function () {
      pularSemPadrao(this);
      const origem = padrao[0];
      cy.then(() => api.duplicarAutomacao(origem.id, TIMEOUT_ROTA)).then((res) => {
        expect(res.status, `Status do POST /automations/${origem.id}/duplicate`).to.eq(201);
        const copia = res.body.automation;
        minhas.push(copia.id);
        expect(copia.is_default, 'A cópia da padrão é comum').to.eq(false);
        expect(copia.is_active, 'A cópia nasce pausada').to.eq(false);
        expect(copia.name, 'Nome da cópia').to.eq(`${origem.name} (cópia)`);
        cy.then(() => api.excluirAutomacao(copia.id, TIMEOUT_ROTA)).its('status').should('eq', 204);
      });
      // Contraprova: a padrão de origem segue padrão
      detalhe(origem.id).its('is_default').should('eq', true);
    });

    it('33.3 Deve recusar ativar a padrão que depende de dado da loja (grupo e substatus, ou template WABA) apontando só esses campos, sem ativá-la', function () {
      pularSemPadrao(this);
      // As padrão pausadas que dependem de dado da loja, identificadas pela árvore (Decisão 4): gatilho de atribuição com substatus vazio, ou template sem id
      const casos = [];
      padrao.filter((item) => item.is_active === false).forEach((item) => {
        detalhe(item.id).then((automacao) => {
          if (automacao.trigger_type === 'attendance_assigned' && !(automacao.trigger_config || {}).group_id && temPasso(automacao.steps, 'set_custom_status', (c) => !c.custom_status_id)) {
            casos.push({ id: item.id, esperado: ['group_required@trigger_config.group_id', 'status_required@steps.0.step_config.custom_status_id'] });
          } else if (temPasso(automacao.steps, 'send_template', (c) => !c.template_id)) {
            const indice = automacao.steps.findIndex((p) => p.step_type === 'send_template');
            casos.push({ id: item.id, esperado: [`template_required@steps.${indice}.step_config.template_id`] });
          }
        });
      });
      cy.then(() => {
        if (!casos.length) {
          cy.log('⏭️ Sem massa: nenhuma padrão pausada que dependa de dado da loja');
          this.skip();
        }
        casos.forEach(({ id, esperado }) => {
          // Act
          cy.then(() => api.atualizarAutomacao(id, { is_active: true }, TIMEOUT_ROTA)).then((res) => {
            if (res.status === 200) api.atualizarAutomacao(id, { is_active: false }, TIMEOUT_ROTA); // regressão: devolve a pausa antes de falhar
            // Assert
            expect(res.status, `Ativar a padrão ${id} sem o dado da loja`).to.eq(422);
            expect((res.body.issues || []).map((i) => `${i.code}@${i.path}`), `Problemas da padrão ${id}: só os campos da loja`).to.have.members(esperado);
          });
          detalhe(id).its('is_active').should('eq', false);
        });
      });
    });

    it('33.4 Deve editar a automação padrão sem perder a marca is_default e devolver o nome original', function () {
      pularSemPadrao(this);
      const alvo = padrao.find((item) => item.is_active === false);
      if (!alvo) {
        cy.log('⏭️ Sem massa: nenhuma padrão pausada para editar');
        this.skip();
      }
      renomeada = { id: alvo.id, name: alvo.name };
      detalhe(alvo.id).then((antes) => {
        // Act: troca o nome
        cy.then(() => api.atualizarAutomacao(alvo.id, { name: `${alvo.name} ${TOKEN}`, updated_at: antes.updated_at }, TIMEOUT_ROTA)).then((res) => {
          // Assert: editada e ainda padrão
          expect(res.status, `PATCH do nome da padrão ${alvo.id}`).to.eq(200);
          expect(res.body.automation.name, 'Nome editado').to.eq(`${alvo.name} ${TOKEN}`);
          expect(res.body.automation.is_default, 'A padrão editada continua padrão (Decisão 6)').to.eq(true);
          // Devolve o nome original
          cy.then(() => api.atualizarAutomacao(alvo.id, { name: alvo.name, updated_at: res.body.automation.updated_at }, TIMEOUT_ROTA)).then((resVolta) => {
            expect(resVolta.status, 'PATCH que devolve o nome original').to.eq(200);
            expect(resVolta.body.automation.name, 'Nome original de volta').to.eq(alvo.name);
            expect(resVolta.body.automation.is_default, 'Segue padrão').to.eq(true);
          });
        });
      });
    });

  });

});
