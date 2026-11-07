// cypress/e2e/0-C.backend-receitas.cy.js
// Suíte de Backend e Integração na API Real, parte C: receitas, fórmulas, cálculo, documentos, insumos controlados e portarias.
// Dividida do 0-A/0-B/0-C.backend-*.cy.js em 2026-10-20 (3 arquivos por tema, contexts com os números originais); executa via cy.request(), imune a mocks de interface.

import api from '../services/backendApiService';
const configEnv = require('../../env.json');
const massaResidualReceitas = require('../fixtures/0.backend/massaResidualReceitas');

describe('0-C. Backend: Receitas (API Real)', () => {

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
  // CONTEXTO 7: RASTREABILIDADE E PROCESSOS DE MANIPULAÇÃO (MOV_PROCESSO_MANIPULACAO)
  // ---------------------------------------------------------------------------
  context('1. Rastreabilidade e Processos de Manipulação por Fórmula (MOV_PROCESSO_MANIPULACAO)', () => {

    let testPrescriptionId = null;
    let testFormulaId = null;
    let testProcessId = null;

    before(() => {
      // Busca cliente ativo para associar à prescrição com integridade referencial
      return api.buscarClientes(storeId, configEnv.DEFAULT_CLIENT_NAME).then((resCli) => {
        const clienteEncontrado = resCli.body?.items?.[0] || resCli.body?.[0];
        const clientId = clienteEncontrado?.id;
        expect(clientId, '🔒 DEFAULT_CLIENT_NAME não achou cliente (massa)').to.be.ok;
        const clientName = clienteEncontrado.name;

        // Cria prescrição e fórmula temporárias com paciente e prescritor válidos
        return api.criarPrescricao(storeId, {
          prescription_type: 'human',
          status: 0,
          sale_type: 1,
          patient_id: clientId,
          patient_name: clientName,
          buyer_id: clientId,
          buyer_name: clientName,
          prescriber_id: 18780,
          pickup_store_id: storeId
        }).then((resPresc) => {
          testPrescriptionId = resPresc.body?.id || resPresc.body?.prescription_id;
          expect(testPrescriptionId, '🔒 A receita temporária do context não foi criada').to.be.ok;
          if (testPrescriptionId) {
            return api.criarFormulaPrescricao(storeId, testPrescriptionId, {
              formula_number: 1,
              pharmaceutical_form_id: 2,
              lab_id: 2,
              qvd: 30.00,
              multiplier: 1
            }).then((resForm) => {
              testFormulaId = resForm.body?.id || resForm.body?.formula_id;
              expect(testFormulaId, '🔒 A fórmula temporária do context não foi criada').to.be.ok;
            });
          }
        });
      });
    });

    it('1.1 Deve validar capabilities e permissões dos processos de manipulação (Grants 231, 509 e 337)', () => {
      // Act
      api.obterCapabilitiesReceitas(storeId).then((res) => {
        // Assert
        expect(res.status, 'Status das capabilities de prescrição').to.eq(200);
        expect(res.body).to.have.property('capabilities');
        const caps = res.body.capabilities;
        expect(caps, 'Grant 231 - can_access_manipulation_processes').to.have.property('can_access_manipulation_processes');
        expect(caps, 'Grant 509 - can_mark_process_commissioned').to.have.property('can_mark_process_commissioned');
        expect(caps, 'Grant 337 - can_reassign_process_employee').to.have.property('can_reassign_process_employee');
      });
    });

    it('1.2 Deve consultar os passos de rastreamento da fórmula (/tracking-steps)', () => {
      const pId = testPrescriptionId;
      const fId = testFormulaId;

      // Act
      api.obterPassosRastreamento(storeId, pId, fId).then((res) => {
        // Assert: Quando implementado retorna 200 com array de passos; caso descontinuado, 404 Not Found
        if (res.status === 200) {
          const steps = res.body.items || res.body.data || res.body;
          expect(steps, 'Passos de rastreamento').to.be.an('array');
        } else {
          expect(res.status, 'Status quando rota não implementada no backend').to.eq(404);
          expect(res.body.error, 'Erro 404 Not Found').to.eq('Not Found');
        }
      });
    });

    it('1.3 Deve listar os processos de manipulação vinculados à fórmula (/manipulation-processes)', () => {
      const pId = testPrescriptionId;
      const fId = testFormulaId;

      // Act
      api.listarProcessosManipulacao(storeId, pId, fId).then((res) => {
        // Assert: 200 OK estrito eliminando tolerância a 404
        expect(res.status, 'Status esperado da listagem de processos').to.eq(200);
        const processos = res.body.items || res.body.data || res.body;
        expect(processos, 'Lista de processos de manipulação').to.be.an('array');
      });
    });

    it('1.4 Deve registrar um novo processo de manipulação na fórmula (POST /manipulation-processes - Grant 231)', () => {
      const pId = testPrescriptionId;
      const fId = testFormulaId;

      const payloadProcesso = {
        sequence: 1,
        process_id: 1,
        date_time: new Date().toISOString(),
        commissioned: true,
        employee_id: loggedUserId
      };

      // Act
      api.criarProcessoManipulacao(storeId, pId, fId, payloadProcesso).then((res) => {
        // Assert: 200 OK ou 201 Created (elimina 404 e 500)
        expect(res.status, 'Status da criação de processo de manipulação').to.be.oneOf([200, 201]);
        testProcessId = res.body?.id || res.body?.process_id;
        expect(res.body, 'Corpo do processo criado').to.be.an('object');
        expect(testProcessId, 'ID do processo criado').to.be.ok;
      });
    });

    it('1.5 Deve atualizar comissão e reatribuir funcionário no processo (PATCH /manipulation-processes/:id - Grants 337 e 509)', () => {
      const pId = testPrescriptionId;
      const fId = testFormulaId;
      const procId = testProcessId;

      const payloadAtualizacao = {
        commissioned: false,
        employee_id: loggedUserId
      };

      // Act
      api.atualizarProcessoManipulacao(storeId, pId, fId, procId, payloadAtualizacao).then((res) => {
        // Assert: 200 OK ou 204 No Content
        expect(res.status, 'Status da atualização de processo de manipulação').to.be.oneOf([200, 204]);
        if (res.status === 200) {
          expect(res.body, 'Corpo da resposta de atualização').to.be.an('object');
        }
      });
    });

    it('1.6 Deve remover o processo de manipulação registrado (DELETE /manipulation-processes/:id)', () => {
      const pId = testPrescriptionId;
      const fId = testFormulaId;
      const procId = testProcessId;

      // Act
      api.excluirProcessoManipulacao(storeId, pId, fId, procId).then((res) => {
        // Assert: 200 OK ou 204 No Content (sem tolerar 404)
        expect(res.status, 'Status da exclusão de processo').to.be.oneOf([200, 204]);
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 9: DOCUMENTOS E IMAGENS DE RECEITAS (PRs #344 e #345)
  // ---------------------------------------------------------------------------
  context('2. Documentos e Imagens de Receitas (PRs #344 e #345)', () => {

    let testPrescriptionDocId = null;
    let createdDocumentId = null;

    before(() => {
      // Cria uma prescrição temporária com paciente e prescritor válidos
      return api.buscarClientes(storeId, configEnv.DEFAULT_CLIENT_NAME).then((resCli) => {
        const cliente = resCli.body?.items?.[0] || resCli.body?.[0];
        const clientId = cliente?.id;
        expect(clientId, '🔒 DEFAULT_CLIENT_NAME não achou cliente (massa)').to.be.ok;
        const clientName = cliente.name;

        return api.criarPrescricao(storeId, {
          prescription_type: 'human',
          status: 0,
          sale_type: 1,
          patient_id: clientId,
          patient_name: clientName,
          buyer_id: clientId,
          buyer_name: clientName,
          prescriber_id: 18780,
          pickup_store_id: storeId,
        }).then((resPresc) => {
          testPrescriptionDocId = resPresc.body?.id || resPresc.body?.prescription_id;
          expect(testPrescriptionDocId, '🔒 A receita temporária do context não foi criada').to.be.ok;
        });
      });
    });

    it('2.1 Deve listar os documentos e imagens anexados à receita com paginação (GET /documents)', () => {
      const pId = testPrescriptionDocId;

      // Act
      api.listarDocumentosPrescricao(storeId, pId).then((res) => {
        // Assert: 200 OK estrito
        expect(res.status, 'Status da listagem de documentos').to.eq(200);
        expect(res.body).to.have.property('items');
        expect(res.body.items).to.be.an('array');
        expect(res.body).to.have.property('pagination');
        expect(res.body.pagination).to.have.property('page');
        expect(res.body.pagination).to.have.property('per_page');
      });
    });

    it('2.2 Deve realizar upload de anexo de imagem para a receita (POST /documents)', () => {
      const pId = testPrescriptionDocId;
      const sampleFixture = 'cypress/fixtures/5.atendimentos/anexos/normal/Anexo de teste jpg.jpg';

      // Act: Dispara upload multipart
      api.anexarDocumentoPrescricao(storeId, pId, sampleFixture, 'receita_teste.jpg', 'image/jpeg').then((res) => {
        // Assert: 200 OK ou 201 Created
        expect(res.status, 'Status do upload de documento').to.be.oneOf([200, 201]);
        createdDocumentId = res.body?.id || res.body?.document_id;
        expect(res.body).to.have.property('id');
        expect(res.body).to.have.property('source');
        expect(res.body).to.have.property('description');
      });
    });

    it('2.3 Deve obter preview-urls e dados binários dos documentos da receita (GET /documents/preview-urls)', () => {
      const pId = testPrescriptionDocId;
      const docId = createdDocumentId;

      // Act
      api.obterPreviewDocumentosPrescricao(storeId, pId, docId).then((res) => {
        // Assert: 200 OK
        expect(res.status, 'Status das preview-urls').to.eq(200);
        expect(res.body).to.have.property('items');
        expect(res.body.items).to.be.an('array');
        expect(res.body.items.length, `preview-urls do documento #${docId} deve conter ao menos 1 item`).to.be.gte(1);
        expect(res.body.items[0]).to.have.property('id');
        expect(res.body.items[0]).to.have.property('content_type');
      });
    });

    it('2.4 Deve excluir logicamente um documento da receita (DELETE /documents/:id)', () => {
      const pId = testPrescriptionDocId;
      const docId = createdDocumentId;

      // Act
      api.excluirDocumentoPrescricao(storeId, pId, docId).then((res) => {
        // Assert: 200 OK ou 204 No Content
        expect(res.status, 'Status da exclusão do documento').to.be.oneOf([200, 204]);
      });
    });

    it('2.5 Deve retornar 404 ao consultar documentos de receita inexistente', () => {
      // Act: Dispara para receita 999999 que não existe
      api.listarDocumentosPrescricao(storeId, 999999).then((res) => {
        // Assert
        expect(res.status, 'Status de receita inexistente').to.eq(404);
        expect(res.body.message, 'Mensagem de erro').to.include('Receita não encontrada');
      });
    });

    it('2.6 Issue backend#603/#604 - documento de receita antigo (pré-migração 29/09/2026, PrescriptionDocumentService) deve continuar resolvendo para conteúdo binário válido, não uma key crua do S3', () => {
      // Massa real e permanente, achada numa varredura (node+https direto na API real) pra validar
      // o gap do ROADMAP P2: prescrição 260700281 (30/07/2026) tem 3 documentos com source
      // "attendance_message" (cópia do anexo de uma mensagem do chat) - exatamente o caminho que a
      // Issue backend#603 descreve como afetado (PrescriptionDocumentService lê a mesma coluna
      // ATENDIMENTO_DIGITAL.IMAGEM_URL). Assinatura binária (magic bytes) confirma que `data` é a
      // imagem/PDF real decodificada, não a key crua (`<matriz>/file/<nome>`) vazando como bytes.
      const casos = [
        { prescriptionId: 260700281, docId: 441, contentType: 'image/png', assinaturaBase64: 'iVBORw0KGgo' },
        { prescriptionId: 260700251, docId: 392, contentType: 'image/jpeg', assinaturaBase64: '/9j/' },
      ];

      casos.forEach(({ prescriptionId, docId, contentType, assinaturaBase64 }) => {
        api.obterPreviewDocumentosPrescricao(storeId, prescriptionId, docId).then((res) => {
          expect(res.status, `Status das preview-urls do documento ${docId}`).to.eq(200);
          const item = res.body.items.find((i) => i.id === docId);
          expect(item, `documento ${docId} presente na resposta`).to.not.be.undefined;
          expect(item.content_type, `Content-Type do documento ${docId}`).to.eq(contentType);
          // Achado real: documentos pequenos nunca expõem uma URL assinada pro front, só `data`
          // inline em base64 - `url` fica sempre null nesta faixa de tamanho (não quebra a issue,
          // é a resolução correta por outro caminho: resolve a key e decodifica os bytes direto).
          expect(item.url, `documento ${docId} não expõe URL crua/assinada nesta faixa de tamanho`).to.be.null;
          expect(item.data, `documento ${docId} tem conteúdo binário real, começando pela assinatura de ${contentType}`).to.satisfy((d) => typeof d === 'string' && d.startsWith(assinaturaBase64));
        });
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 10: CICLO DE VIDA DE RECEITAS - FINALIZAR E CANCELAR FINALIZAÇÃO
  // ---------------------------------------------------------------------------
  context('3. Ciclo de Vida de Receitas (Finalizar e Cancelar Finalização)', () => {

    let pIdCalculada = null;
    let pIdSemFormulas = null;

    // Sem código fixo de reserva: a receita vem do before(); se ele não a criou, o teste acusa a massa em vez de usar o código de uma receita de outro dia
    const receitaDoCiclo = (id, rotulo) => {
      expect(id, `🔒 A receita ${rotulo} não foi criada no before()`).to.be.ok;
      return id;
    };

    before(() => {
      // 1. Busca cliente válido para associar às prescrições
      api.buscarClientes(storeId, configEnv.DEFAULT_CLIENT_NAME).then((resCli) => {
        const cliente = resCli.body?.items?.[0] || resCli.body?.[0];
        const clientId = cliente?.id;
        expect(clientId, '🔒 DEFAULT_CLIENT_NAME não achou cliente (massa)').to.be.ok;
        const clientName = cliente.name;

        // 2. Cria prescrição de teste que receberá fórmula calculada
        api.criarPrescricao(storeId, {
          prescription_type: 'human',
          status: 0,
          sale_type: 1,
          patient_id: clientId,
          patient_name: clientName,
          buyer_id: clientId,
          buyer_name: clientName,
          prescriber_id: 18780,
          pickup_store_id: storeId,
        }).then((resPresc) => {
          if (resPresc.status === 200 || resPresc.status === 201) {
            pIdCalculada = resPresc.body?.id || resPresc.body?.prescription_id;

            // 3. Cria fórmula vinculada
            api.criarFormulaPrescricao(storeId, pIdCalculada, {
              formula_number: 1,
              pharmaceutical_form_id: 2,
              lab_id: 2,
              qvd: 30.00,
              multiplier: 1,
              return_date: api.dataDeRetornoFutura(),
            }).then((resFormula) => {
              const formulaId = resFormula.body?.id;

              // 4. Adiciona produto na fórmula
              api.adicionarProdutoFormula(storeId, pIdCalculada, formulaId, {
                product_id: 1004866,
                quantity: 250.0000,
                unit: 'mg',
              }).then(() => {
                // 5. Dispara o cálculo de preço da fórmula (gate obrigatório para finalizar)
                api.calcularFormula(storeId, pIdCalculada, formulaId);
              });
            });
          }
        });

        // 6. Cria prescrição secundária sem fórmulas para testes de bloqueio 422
        api.criarPrescricao(storeId, {
          prescription_type: 'human',
          status: 0,
          sale_type: 1,
          patient_id: clientId,
          patient_name: clientName,
          buyer_id: clientId,
          buyer_name: clientName,
          prescriber_id: 18780,
          pickup_store_id: storeId,
        }).then((resSemFormulas) => {
          if (resSemFormulas.status === 200 || resSemFormulas.status === 201) {
            pIdSemFormulas = resSemFormulas.body?.id || resSemFormulas.body?.prescription_id;
          }
        });
      });
    });

    it('3.1 Deve finalizar uma receita com fórmula calculada com sucesso (POST /finalize - Status 200, status: -1)', () => {
      const pId = receitaDoCiclo(pIdCalculada, 'com fórmula calculada');
      // Backend#792: no modo manual a data informada é gravada como veio e vira a data do laboratório de cada fórmula calculada (medido na dev em 2026-11-06, aba-c);
      // no automático a procedure pode movê-la para o primeiro dia útil, então só se afirma que veio uma data e que as fórmulas ganharam a sua
      const dataInformada = api.dataDeEntregaFutura();

      // Act: Dispara finalização da receita
      api.finalizarPrescricao(storeId, pId, {}, { expected_delivery_at: dataInformada }).then((res) => {
        // Assert: 200 OK
        expect(res.status, 'Status de sucesso na finalização').to.eq(200);
        expect(res.body).to.have.property('id', pId);
        expect(res.body).to.have.property('status', -1);
        expect(res.body).to.have.property('sale_value');
        expect(res.body).to.have.property('sale_value_discounted');
        expect(res.body).to.have.property('cost_value');
        expect(res.body).to.have.property('updated_at');
        // Validação PR #472: Timestamps padronizados em Instant (UTC / Z)
        expect(res.body.updated_at, 'updated_at em UTC').to.match(/Z$/);
        // Backend#792: a finalização data a entrega e devolve a gravada (a automática pode mover a informada para o primeiro dia útil)
        expect(res.body.expected_delivery_at, 'Data de entrega ao cliente gravada na finalização, em UTC').to.match(/Z$/);

        expect(res.body).to.have.property('updated_by');
        expect(res.body).to.have.property('capabilities');
        expect(res.body.capabilities).to.have.property('can_update', true);
        expect(res.body.capabilities).to.have.property('can_finalize', false);
        expect(res.body.capabilities).to.have.property('can_cancel_finalization', true);
        expect(res.body).to.have.property('warnings');
        expect(res.body.warnings).to.be.an('array');
      });

      // Assert (backend#792): o modo da loja, a data gravada e a do laboratório em cada fórmula calculada
      api.obterDetalhePrescricao(storeId, pId).then((det) => {
        expect(det.status, 'Status do GET /prescriptions/:id depois da finalização').to.eq(200);
        const { settings } = det.body;
        expect(settings, 'settings do detalhe da receita').to.be.an('object');
        expect(settings.delivery_schedule, 'settings.delivery_schedule (tela 146 da loja da sessão)').to.be.oneOf(['manual', 'automatic']);
        const calculadas = (det.body.formulas || []).filter((f) => f.calculated);
        expect(calculadas, 'Fórmulas calculadas da receita').to.not.be.empty;
        if (settings.delivery_schedule === 'manual') {
          expect(det.body.expected_delivery_at, 'Modo manual: a data gravada é a informada').to.eq(dataInformada);
          calculadas.forEach((f) => expect(f.lab_delivery_at, `Modo manual: lab_delivery_at da fórmula ${f.formula_number} igual à do cliente`).to.eq(dataInformada));
        } else {
          expect(det.body.expected_delivery_at, 'Modo automático: data de entrega gravada').to.match(/Z$/);
          calculadas.forEach((f) => expect(f.lab_delivery_at, `Modo automático: lab_delivery_at da fórmula ${f.formula_number}`).to.match(/Z$/));
        }
      });
      // A capability do grant 427 (data fora da tabela de horários) vem como booleana
      api.obterCapabilitiesReceitas(storeId).then((caps) => {
        expect(caps.body.capabilities.can_authorize_delivery_outside_schedule, 'can_authorize_delivery_outside_schedule (grant 427)').to.be.a('boolean');
      });
    });

    it('3.2 Deve cancelar a finalização de uma receita concluída retornando para rascunho (POST /cancel-finalization - Status 200, status: 0)', () => {
      const pId = receitaDoCiclo(pIdCalculada, 'com fórmula calculada');

      // Act: Dispara cancelamento da finalização
      api.cancelarFinalizacaoPrescricao(storeId, pId).then((res) => {
        // Assert: 200 OK
        expect(res.status, 'Status de sucesso no cancelamento da finalização').to.eq(200);
        expect(res.body).to.have.property('id', pId);
        expect(res.body).to.have.property('status', 0);
        expect(res.body).to.have.property('updated_at');
        expect(res.body).to.have.property('updated_by');
        expect(res.body).to.have.property('capabilities');
        expect(res.body.capabilities).to.have.property('can_update', true);
        expect(res.body.capabilities).to.have.property('can_finalize', true);
        expect(res.body.capabilities).to.have.property('can_cancel_finalization', false);
      });

      // Assert (backend#792, decisão 9): o cancelamento limpa a data do cliente e a do laboratório de todas as fórmulas, nos dois modos
      api.obterDetalhePrescricao(storeId, pId).then((det) => {
        expect(det.status, 'Status do GET /prescriptions/:id depois do cancelamento').to.eq(200);
        expect(det.body.expected_delivery_at, 'expected_delivery_at limpo').to.be.null;
        (det.body.formulas || []).forEach((f) => expect(f.lab_delivery_at, `lab_delivery_at da fórmula ${f.formula_number} limpo`).to.be.null);
      });
    });

    it('3.3 Deve rejeitar finalização de receita que já está finalizada (422 Unprocessable Content)', () => {
      const pId = receitaDoCiclo(pIdCalculada, 'com fórmula calculada');

      // Arrange: Finaliza a receita para deixá-la em status -1
      api.finalizarPrescricao(storeId, pId).then(() => {
        // Act: Tenta finalizar novamente a mesma receita
        api.finalizarPrescricao(storeId, pId).then((res) => {
          // Assert
          expect(res.status, 'Status de validação de receita já finalizada').to.eq(422);
          expect(res.body.message, 'Mensagem de validação').to.include('Receita já está finalizada');
        });
      });
    });

    it('3.4 Deve rejeitar cancelamento de finalização em receita de rascunho (422 Unprocessable Content)', () => {
      const pId = receitaDoCiclo(pIdCalculada, 'com fórmula calculada');

      // Arrange: Cancela a finalização para voltar a rascunho (status: 0)
      api.cancelarFinalizacaoPrescricao(storeId, pId).then(() => {
        // Act: Tenta cancelar novamente enquanto ainda em rascunho
        api.cancelarFinalizacaoPrescricao(storeId, pId).then((res) => {
          // Assert
          expect(res.status, 'Status de validação de cancelamento em rascunho').to.eq(422);
          expect(res.body.message, 'Mensagem de validação').to.include('Receita ainda não foi finalizada');
        });
      });
    });

    it('3.5 Deve rejeitar finalização de receita sem fórmulas (422 Unprocessable Content)', () => {
      const pId = receitaDoCiclo(pIdSemFormulas, 'sem fórmulas');

      // Act: Tenta finalizar receita de rascunho sem nenhuma fórmula vinculada
      api.finalizarPrescricao(storeId, pId).then((res) => {
        // Assert
        expect(res.status, 'Status para receita sem fórmulas').to.eq(422);
        expect(res.body.message, 'Mensagem de bloqueio de fórmula').to.include('A receita não possui fórmulas para finalizar');
      });
    });

    it('3.6 Deve retornar 404 ao tentar finalizar receita inexistente', () => {
      // Act: Dispara finalização para ID inexistente
      api.finalizarPrescricao(storeId, 99999999).then((res) => {
        // Assert
        expect(res.status, 'Status de receita inexistente').to.eq(404);
        expect(res.body.message, 'Mensagem de erro 404').to.include('Receita não encontrada');
      });
    });

    it('3.7 Deve retornar 404 ao tentar cancelar finalização de receita inexistente', () => {
      // Act: Dispara cancelamento para ID inexistente
      api.cancelarFinalizacaoPrescricao(storeId, 99999999).then((res) => {
        // Assert
        expect(res.status, 'Status de receita inexistente').to.eq(404);
        expect(res.body.message, 'Mensagem de erro 404').to.include('Receita não encontrada');
      });
    });

    it('3.8 Deve recusar com 422 DELIVERY_DATE_REQUIRED a finalização sem data de entrega na loja de modo manual, com {} ou com a data nula, sem finalizar (backend#792)', function () {
      // Medido em 2026-11-06 (ROADMAP.md P1-56): a loja de teste é manual (`settings.delivery_schedule: "manual"` no detalhe). Na automática o `{}` usaria a data da tabela
      // e finalizaria, então o teste pula com motivo se o modo mudar. A receita do ciclo está em rascunho e calculada depois do #3.4.
      const pId = receitaDoCiclo(pIdCalculada, 'com fórmula calculada');
      api.obterDetalhePrescricao(storeId, pId).then((det) => {
        expect(det.status, 'Status do detalhe da receita do ciclo').to.eq(200);
        if (!det.body.settings || det.body.settings.delivery_schedule !== 'manual') {
          cy.log(`⏭️ A loja de teste não está no modo manual (delivery_schedule: ${det.body.settings && det.body.settings.delivery_schedule}): sem data, a finalização usaria a tabela`);
          this.skip();
        }
        expect(det.body.status, 'A receita do ciclo está em rascunho antes da recusa').to.eq(0);
      });
      [{}, { expected_delivery_at: null }].forEach((corpo) => {
        api.finalizarPrescricao(storeId, pId, { failOnStatusCode: false }, corpo).then((res) => {
          expect(res.status, `Status da finalização com ${JSON.stringify(corpo)}`).to.eq(422);
          expect(res.body.code, `code com ${JSON.stringify(corpo)}`).to.eq('DELIVERY_DATE_REQUIRED');
          expect(res.body.message, `Mensagem com ${JSON.stringify(corpo)}`).to.eq('Informe a data de entrega ao cliente.');
        });
      });
      api.obterDetalhePrescricao(storeId, pId).then((det) => {
        expect(det.body.status, 'A receita continua em rascunho depois das recusas').to.eq(0);
        expect(det.body.expected_delivery_at, 'Nenhuma data de entrega gravada').to.be.null;
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 21: CONSISTÊNCIA DE CARIMBOS, DERIVAÇÃO NEEDS_RECALCULATE E EXPIRAÇÃO (PR #461 - ISSUE #341)
  // ---------------------------------------------------------------------------
  context('4. Consistência de Carimbos, Derivação needs_recalculate e Expiração (PR #461 - Issue #341)', () => {

    let clienteTesteId = null;
    let clienteTesteNome = null;
    let prescricaoCriadaId = null;
    let formulaCriadaId = null;

    before(() => {
      // 1. Localiza cliente padrão para associar à prescrição
      api.buscarClientes(storeId, configEnv.DEFAULT_CLIENT_NAME).then((resCli) => {
        const cliente = resCli.body?.items?.[0] || resCli.body?.[0];
        expect(cliente && cliente.id, '🔒 DEFAULT_CLIENT_NAME não achou cliente (massa)').to.be.ok;
        clienteTesteId = cliente.id;
        clienteTesteNome = cliente.name;
      });
    });

    it('4.1 deve validar consistência temporal e ausência de defasagem de 3h em receitas recém-criadas', () => {
      const payloadPrescricao = {
        prescription_type: 'human',
        status: 0,
        sale_type: 1,
        patient_id: clienteTesteId,
        patient_name: clienteTesteNome,
        buyer_id: clienteTesteId,
        buyer_name: clienteTesteNome,
        prescriber_id: 18780,
        pickup_store_id: storeId,
      };

      const momentoAntesCriacao = Date.now();

      api.criarPrescricao(storeId, payloadPrescricao).then((res) => {
        expect(res.status).to.be.oneOf([200, 201]);
        expect(res.body).to.have.property('id');
        prescricaoCriadaId = res.body.id || res.body.prescription_id;

        const momentoAposCriacao = Date.now();

        // 1. Valida existência dos timestamps
        expect(res.body).to.have.property('created_at');
        const createdAtStr = res.body.created_at;
        expect(createdAtStr, 'created_at deve ser uma string de data').to.be.a('string');

        // 2. Valida ausência de defasagem de 3 horas (Issue #341 / PR #461):
        // O container em UTC não pode mais gravar hora de parede UTC em coluna sem fuso.
        // A data gravada deve estar a poucos minutos do momento atual (< 15 minutos).
        const createdAtTime = new Date(createdAtStr).getTime();
        const diferencaMinutos = Math.abs(momentoAposCriacao - createdAtTime) / (1000 * 60);

        expect(
          diferencaMinutos,
          `Carimbo created_at (${createdAtStr}) deve estar alinhado com a hora corrente (diferença atual: ${diferencaMinutos.toFixed(1)} min, sem defasagem de 3h/180 min)`
        ).to.be.lessThan(15);

        // 3. Se houver updated_at retornado, valida coerência com created_at (diferença < 5 minutos)
        if (res.body.updated_at) {
          const updatedAtTime = new Date(res.body.updated_at).getTime();
          const diferencaUpdateCreateMin = Math.abs(updatedAtTime - createdAtTime) / (1000 * 60);
          expect(
            diferencaUpdateCreateMin,
            `created_at (${createdAtStr}) e updated_at (${res.body.updated_at}) devem ser consistentes entre si sem gap de 3h`
          ).to.be.lessThan(5);
        }
      });
    });

    it('4.2 deve validar a derivação needs_recalculate: false após cálculo e transição para true após alteração na fórmula', () => {
      expect(prescricaoCriadaId, 'Prescrição deve ter sido criada no teste anterior').to.be.ok;

      // 1. Cria fórmula vinculada à prescrição
      api.criarFormulaPrescricao(storeId, prescricaoCriadaId, {
        formula_number: 1,
        pharmaceutical_form_id: 2,
        lab_id: 2,
        qvd: 30.00,
        multiplier: 1,
      }).then((resFormula) => {
        expect(resFormula.status).to.be.oneOf([200, 201]);
        formulaCriadaId = resFormula.body?.id;
        expect(formulaCriadaId, 'ID da fórmula gerada').to.be.ok;

        // 2. Adiciona primeiro insumo/produto na fórmula
        api.adicionarProdutoFormula(storeId, prescricaoCriadaId, formulaCriadaId, {
          product_id: 1004866,
          quantity: 250.0000,
          unit: 'mg',
        }).then((resProd1) => {
          expect(resProd1.status).to.be.oneOf([200, 201]);

          // 3. Dispara o cálculo da fórmula (POST /calculate)
          api.calcularFormula(storeId, prescricaoCriadaId, formulaCriadaId).then((resCalc) => {
            expect(resCalc.status).to.eq(200);

            // Localiza a fórmula no payload do cálculo
            const formulaCalculada = resCalc.body?.formulas?.find(f => f.id === formulaCriadaId) || resCalc.body?.formula || resCalc.body;
            expect(formulaCalculada.calculated, 'calculated deve ser true').to.be.true;
            expect(formulaCalculada.calculated_at, 'calculated_at deve existir').to.be.ok;
            expect(formulaCalculada.needs_recalculate, 'needs_recalculate deve ser false após o cálculo').to.be.false;

            // 4. Consulta via GET detalhe da prescrição para confirmar persistência de needs_recalculate: false
            api.obterDetalhePrescricao(storeId, prescricaoCriadaId).then((resGet1) => {
              expect(resGet1.status).to.eq(200);
              const fGet1 = resGet1.body?.formulas?.find(f => f.id === formulaCriadaId);
              expect(fGet1, 'Fórmula encontrada no detalhe').to.be.ok;
              expect(fGet1.needs_recalculate, 'needs_recalculate deve permanecer false no GET').to.be.false;

              // 5. Altera a fórmula adicionando um segundo produto para disparar alteração (updated_at > calculated_at)
              api.adicionarProdutoFormula(storeId, prescricaoCriadaId, formulaCriadaId, {
                product_id: 1004867,
                quantity: 100.0000,
                unit: 'mg',
              }).then((resProd2) => {
                expect(resProd2.status).to.be.oneOf([200, 201]);

                // 6. Consulta via GET e valida a derivação: needs_recalculate deve ter transicionado para TRUE!
                api.obterDetalhePrescricao(storeId, prescricaoCriadaId).then((resGet2) => {
                  expect(resGet2.status).to.eq(200);
                  const fGet2 = resGet2.body?.formulas?.find(f => f.id === formulaCriadaId);
                  expect(fGet2, 'Fórmula após alteração').to.be.ok;
                  expect(
                    fGet2.needs_recalculate,
                    'needs_recalculate deve transicionar para true após inclusão de novo insumo/edição'
                  ).to.be.true;

                  // 7. Dispara novo cálculo para revalidar que retorna para false
                  api.calcularFormula(storeId, prescricaoCriadaId, formulaCriadaId).then((resRecalc) => {
                    expect(resRecalc.status).to.eq(200);
                    const formulaRecalculada = resRecalc.body?.formulas?.find(f => f.id === formulaCriadaId) || resRecalc.body?.formula || resRecalc.body;
                    expect(formulaRecalculada.needs_recalculate, 'needs_recalculate deve retornar a false após recálculo').to.be.false;
                  });
                });
              });
            });
          });
        });
      });
    });

    it('4.3 deve validar prazos de expiração de pedidos de autorização sem acréscimo indevido de 3h', () => {
      // Act: Consulta os pedidos de autorização da loja
      api.listarAutorizacoes(storeId, { role: 'requester', limit: 10 }).then((res) => {
        expect(res.status, 'Status de consulta de autorizações').to.eq(200);
        expect(res.body, 'Envelope da resposta deve existir').to.be.an('object');
        expect(res.body).to.have.property('pagination');
        expect(res.body.pagination).to.have.property('total');
        const itens = res.body?.items || (Array.isArray(res.body) ? res.body : []);
        expect(itens, 'Lista de autorizações deve ser um array').to.be.an('array');

        if (itens.length > 0) {
          itens.forEach((auth) => {
            if (auth.requested_at && auth.expires_at) {
              const requestedTime = new Date(auth.requested_at).getTime();
              const expiresTime = new Date(auth.expires_at).getTime();
              const duracaoMinutos = (expiresTime - requestedTime) / (1000 * 60);

              // Janela padrão de autorização é de minutos (ex: 5 a 60 min).
              // Com o bug corrigido na PR #461, o prazo NÃO ganha 3 horas (180 min) a mais!
              expect(
                duracaoMinutos,
                `Duração da autorização #${auth.id} (${duracaoMinutos.toFixed(1)} min) não deve carregar 3h extras de timezone`
              ).to.be.lessThan(120);
            }
          });
        } else {
          // Validação explícita de schema e paridade com a Nota da PR #461 (tenant limpo)
          expect(res.body.pagination.total, 'Tenant medido possui 0 autorizações abertas conforme Nota da PR #461').to.eq(0);
          cy.log('✅ [Paridade com Nota PR #461]: Tabela de pedidos de autorização com 0 linhas no tenant (tenant limpo validado no schema).');
        }
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 22: REGULAÇÃO DE PORTARIAS E EXIGÊNCIA DE RECEITUÁRIO (PR #452)
  // ---------------------------------------------------------------------------
  context('5. Regulação de Portarias e Exigência de Receituário (PR #452)', () => {

    let clienteTesteId = null;
    let clienteTesteNome = null;
    let prescricaoId = null;

    before(() => {
      // 1. Localiza cliente padrão para associar à prescrição
      api.buscarClientes(storeId, configEnv.DEFAULT_CLIENT_NAME).then((resCli) => {
        const cliente = resCli.body?.items?.[0] || resCli.body?.[0];
        expect(cliente && cliente.id, '🔒 DEFAULT_CLIENT_NAME não achou cliente (massa)').to.be.ok;
        clienteTesteId = cliente.id;
        clienteTesteNome = cliente.name;
      });
    });

    it('5.1 deve validar a presença dos novos campos regulatórios e derivação booleana em produtos de portaria (/products)', () => {
      // Act: Consulta lista de produtos com usage obrigatório
      api.listarProdutos(storeId, { usage: 'human', limit: 100 }).then((res) => {
        expect(res.status, 'Status da busca de produtos').to.eq(200);
        expect(res.body, 'Corpo da resposta').to.be.an('object');
        const items = res.body?.items || (Array.isArray(res.body) ? res.body : []);
        expect(items.length, 'Deve retornar ao menos 1 produto cadastrado').to.be.gte(1);

        // 1. Valida que o campo ambíguo prescription_required foi substituído pelos novos campos estruturais
        const primeiroItem = items[0];
        expect(primeiroItem).to.have.property('prescription_required_code');
        expect(primeiroItem).to.have.property('prescription_date_required');
        expect(primeiroItem).to.have.property('notification_number_required');

        // 2. Filtra produtos com portaria / controlados para testar a derivação regulatória
        const produtosComPortaria = items.filter(it => it.regulation_id !== null && it.regulation_id !== undefined);
        expect(produtosComPortaria.length, 'Deve encontrar produtos vinculados a portaria no catálogo').to.be.gte(1);

        produtosComPortaria.forEach((prod) => {
          const code = prod.prescription_required_code;
          expect(code, `prescription_required_code do produto #${prod.id} deve estar entre 0 e 3`).to.be.oneOf([0, 1, 2, 3]);

          // Valida a invariante lógica entregue pela PR #452:
          // prescription_date_required: true para 1 ou 3
          const dataExigidaEsperada = (code === 1 || code === 3);
          expect(
            prod.prescription_date_required,
            `prescription_date_required do produto #${prod.id} (code: ${code})`
          ).to.eq(dataExigidaEsperada);

          // notification_number_required: true para 2 ou 3
          const notificacaoExigidaEsperada = (code === 2 || code === 3);
          expect(
            prod.notification_number_required,
            `notification_number_required do produto #${prod.id} (code: ${code})`
          ).to.eq(notificacaoExigidaEsperada);
        });
      });
    });

    it('5.2 deve validar consistência dos campos de portaria dentro de produtos de fórmulas da receita (/prescriptions/:id)', () => {
      // Arrange: Cria uma prescrição com fórmula e produto
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
        expect(resPresc.status).to.be.oneOf([200, 201]);
        prescricaoId = resPresc.body?.id || resPresc.body?.prescription_id;
        expect(prescricaoId, 'ID da prescrição criada').to.be.ok;

        // Cria fórmula na prescrição
        api.criarFormulaPrescricao(storeId, prescricaoId, {
          formula_number: 1,
          pharmaceutical_form_id: 2,
          lab_id: 2,
          qvd: 30.00,
          multiplier: 1,
        }).then((resFormula) => {
          expect(resFormula.status).to.be.oneOf([200, 201]);
          const formulaId = resFormula.body?.id;

          // Adiciona insumo na fórmula
          api.adicionarProdutoFormula(storeId, prescricaoId, formulaId, {
            product_id: 1004866,
            quantity: 250.0000,
            unit: 'mg',
          }).then((resProd) => {
            expect(resProd.status).to.be.oneOf([200, 201]);

            // Act: Consulta os detalhes da receita via GET /prescriptions/:id
            api.obterDetalhePrescricao(storeId, prescricaoId).then((resDetalhe) => {
              expect(resDetalhe.status, 'Status do detalhe da prescrição').to.eq(200);
              const formulas = resDetalhe.body?.formulas || [];
              expect(formulas.length, 'Receita deve conter ao menos 1 fórmula').to.be.gte(1);

              const produtosDaFormula = formulas[0].products || [];
              expect(produtosDaFormula.length, 'Fórmula deve conter ao menos 1 produto').to.be.gte(1);

              const produto = produtosDaFormula[0];

              // Assert: Valida que o produto dentro da fórmula expõe os campos da PR #452
              expect(produto).to.have.property('prescription_required_code');
              expect(produto).to.have.property('prescription_date_required');
              expect(produto).to.have.property('notification_number_required');

              const code = produto.prescription_required_code;
              expect(code, 'Código de exigência de receituário').to.be.oneOf([0, 1, 2, 3]);

              // Invariante lógica da portaria
              expect(produto.prescription_date_required).to.eq(code === 1 || code === 3);
              expect(produto.notification_number_required).to.eq(code === 2 || code === 3);
            });
          });
        });
      });
    });

    it('5.3 deve rejeitar busca de produtos sem o parâmetro obrigatório usage (422 Unprocessable Content)', () => {
      // Act: Dispara requisição direta sem o parâmetro usage
      api.get(`/products`).then((res) => {
        // Assert: 422 Unprocessable Content
        expect(res.status, 'Status de validação de parâmetro usage obrigatório').to.eq(422);
        expect(res.body.message, 'Mensagem de validação de usage').to.include('O parâmetro usage é obrigatório');
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 44: LIMITE SUPERIOR DO MULTIPLICADOR DA FÓRMULA (CRIAÇÃO, PATCH E PRÉVIA DO CÁLCULO)
  // ---------------------------------------------------------------------------
  context('6. Limite Superior do Multiplicador da Fórmula nas Três Rotas (Issue backend#636/PR #644)', () => {

    // multiplier grava em ATENDIMENTO_A2.MULTIPLO (SMALLINT, máx. 32767). Antes da PR #644 a criação com 99999 respondia 500 (o driver recusava a conversão),
    // o PATCH truncava 4294967297 para 1 e gravava, e a prévia aceitava um valor que a criação recusava.
    // Só valores RECUSADOS são enviados às rotas de escrita (receita não tem DELETE) e a prévia não grava: nenhuma massa é criada.
    // Fora de escopo: 32767 na criação e no PATCH (gravaria uma fórmula/valor no tenant); o limite exato fica provado só na prévia.
    const TIMEOUT_ROTA = { timeout: 90000 };
    const LIMITE_MULTIPLICADOR = 32767;
    const MSG_INVALIDO = 'Multiplicador inválido.';
    const MSG_MAXIMO = 'O múltiplo deve ser no máximo 32767.';
    const MSG_MINIMO = 'O múltiplo deve ser maior que zero.';
    const MSG_INTEIRO = 'O campo multiplier deve ser um número inteiro.';

    let massa = null; // { prescricao, formula } — fórmula real com multiplier 1, produto e QVD, só lida

    // Percorre as receitas pendentes até achar uma fórmula com multiplier 1, QVD e ao menos 1 produto (só leitura)
    const acharFormulaComMultiplicador1 = (ids, i) => {
      if (i >= ids.length) return cy.wrap(null, { log: false });
      return api.obterDetalhePrescricao(storeId, ids[i], TIMEOUT_ROTA).then((det) => {
        const formula = ((det.body && det.body.formulas) || []).find((f) => (
          Number(f.multiplier) === 1 && Number(f.qvd) > 0 && f.pharmaceutical_form_id && Array.isArray(f.products) && f.products.length >= 1
        ));
        return formula ? cy.wrap({ prescricao: ids[i], formula }, { log: false }) : acharFormulaComMultiplicador1(ids, i + 1);
      });
    };

    before(() => {
      api.listarPrescricoes(storeId, { filter: 'pending', page: 1, per_page: 40 }, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status da listagem de receitas pendentes').to.eq(200);
        const ids = ((res.body && res.body.items) || []).map((r) => r.id).slice(0, 25);
        acharFormulaComMultiplicador1(ids, 0).then((achada) => { massa = achada; });
      });
    });

    const detalheFormula = () => api.obterDetalhePrescricao(storeId, massa.prescricao, TIMEOUT_ROTA).then((det) => {
      const formulas = (det.body && det.body.formulas) || [];
      return { total: formulas.length, formula: formulas.find((f) => f.id === massa.formula.id) };
    });

    const corpoPrevia = (multiplier) => {
      const p = massa.formula.products[0];
      return {
        pharmaceutical_form_id: massa.formula.pharmaceutical_form_id,
        qvd: Number(massa.formula.qvd),
        multiplier,
        products: [{ product_id: p.product_id || p.id, quantity: p.quantity, unit: p.unit }],
      };
    };

    it('6.1 Deve recusar com 422 a criação de fórmula com multiplier acima de 32767, sem criar nada e sem responder 500', () => {
      expect(massa, '🔒 Nenhuma receita pendente com fórmula de multiplier 1, QVD e produto (massa)').to.exist;
      detalheFormula().then(({ total: antes }) => {
        [LIMITE_MULTIPLICADOR + 1, 99999, 100000].forEach((multiplier) => {
          api.criarFormulaPrescricao(storeId, massa.prescricao, {
            formula_number: 99,
            pharmaceutical_form_id: massa.formula.pharmaceutical_form_id,
            lab_id: massa.formula.lab_id,
            qvd: 30,
            multiplier,
          }, TIMEOUT_ROTA).then((res) => {
            expect(res.status, `Status da criação com multiplier=${multiplier} (antes da PR #644, 99999 respondia 500)`).to.eq(422);
            expect(res.body.message, `Mensagem com multiplier=${multiplier}`).to.eq(MSG_INVALIDO);
          });
        });

        // Além de Int o corpo nem chega ao validador: 400 de corpo malformado, nunca gravado
        api.criarFormulaPrescricao(storeId, massa.prescricao, {
          formula_number: 99,
          pharmaceutical_form_id: massa.formula.pharmaceutical_form_id,
          lab_id: massa.formula.lab_id,
          qvd: 30,
          multiplier: 4294967297,
        }, TIMEOUT_ROTA).then((res) => {
          expect(res.status, 'Status da criação com multiplier acima de Int').to.be.oneOf([400, 422]);
        });

        detalheFormula().then(({ total: depois }) => {
          expect(depois, 'nenhuma fórmula pode ter sido criada pelas tentativas recusadas').to.eq(antes);
        });
      });
    });

    it('6.2 Deve recusar com 422 o PATCH da fórmula com multiplier acima de 32767 ou além de Int, sem truncar nem gravar o valor', () => {
      expect(massa, '🔒 Nenhuma receita pendente com fórmula de multiplier 1, QVD e produto (massa)').to.exist;
      // 4294967297 virava 1 em silêncio e era gravado (o valor 4294967297 é 2^32 + 1)
      [LIMITE_MULTIPLICADOR + 1, 4294967297].forEach((multiplier) => {
        api.atualizarFormulaPrescricao(storeId, massa.prescricao, massa.formula.id, { multiplier }, TIMEOUT_ROTA).then((res) => {
          expect(res.status, `Status do PATCH com multiplier=${multiplier}`).to.eq(422);
          expect(res.body.message, `Mensagem do PATCH com multiplier=${multiplier}`).to.eq(MSG_INVALIDO);
        });
      });
      detalheFormula().then(({ formula }) => {
        expect(formula, 'a fórmula continua na receita').to.exist;
        expect(Number(formula.multiplier), 'o multiplier da fórmula não pode ter mudado').to.eq(1);
        expect(formula.updated_at, 'nem o carimbo de alteração').to.eq(massa.formula.updated_at);
      });
    });

    it('6.3 Deve aceitar na prévia do cálculo multiplier de 1 até 32767, o teto que a criação também aceita', () => {
      expect(massa, '🔒 Nenhuma receita pendente com fórmula de multiplier 1, QVD e produto (massa)').to.exist;
      [1, 2, 10, LIMITE_MULTIPLICADOR].forEach((multiplier) => {
        api.preverCalculoFormula(storeId, corpoPrevia(multiplier), TIMEOUT_ROTA).then((res) => {
          expect(res.status, `Status da prévia com multiplier=${multiplier}`).to.eq(200);
          expect(res.body.lines, `linhas da prévia com multiplier=${multiplier}`).to.be.an('array').and.not.be.empty;
          expect(res.body, 'totais da prévia').to.have.property('totals');
        });
      });
    });

    it('6.4 Deve recusar na prévia do cálculo multiplier acima de 32767, menor que 1, fracionário ou além de Int', () => {
      expect(massa, '🔒 Nenhuma receita pendente com fórmula de multiplier 1, QVD e produto (massa)').to.exist;
      // A prévia aceitava 32768 e a criação o recusava (o parâmetro MULTIPLO_IP da procedure é INTEGER)
      [
        [LIMITE_MULTIPLICADOR + 1, MSG_MAXIMO],
        [99999, MSG_MAXIMO],
        [0, MSG_MINIMO],
        [-1, MSG_MINIMO],
        [1.5, MSG_INTEIRO],
      ].forEach(([multiplier, mensagem]) => {
        api.preverCalculoFormula(storeId, corpoPrevia(multiplier), TIMEOUT_ROTA).then((res) => {
          expect(res.status, `Status da prévia com multiplier=${multiplier}`).to.eq(422);
          expect(res.body.message, `Mensagem da prévia com multiplier=${multiplier}`).to.eq(mensagem);
        });
      });
      api.preverCalculoFormula(storeId, corpoPrevia(4294967297), TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status da prévia com multiplier acima de Int (corpo malformado)').to.be.oneOf([400, 422]);
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 45: TAMANHO MÁXIMO DOS CAMPOS DE TEXTO DA FÓRMULA (CRIAÇÃO E PATCH)
  // ---------------------------------------------------------------------------
  context('7. Tamanho Máximo dos Campos de Texto da Fórmula na Criação e no PATCH (Issue backend#637/PR #645)', () => {

    // Os 8 campos de texto da fórmula não tinham limite: acima da coluna o banco recusava (Data truncation) e a API respondia 500.
    // Agora, na criação e no PATCH, acima do máximo responde 422 "O campo <campo> deve ter no máximo <n> caracteres.".
    // Receita não tem DELETE: tudo roda numa receita temporária própria (1 por rodada, no tenant dev — mesmo padrão do ctx 4), sem tocar em receita real.
    // O CID é texto livre, sem cadastro por trás: só o tamanho é validado (não há existência a provar).
    const TIMEOUT_ROTA = { timeout: 90000 };
    const LIMITES = { drops: 7, cid_code: 15, repetition_text: 20, label_description: 150, posology: 7000, label_text: 7000, label_observation: 7000, formula_observation: 7000 };
    const msgExcedido = (campo) => `O campo ${campo} deve ter no máximo ${LIMITES[campo]} caracteres.`;
    const textoDe = (tamanho, letra = 'X') => letra.repeat(tamanho);

    let prescricaoId = null;
    let formulaId = null;
    let formulaBase = null;
    let proximoNumeroFormula = 2;

    const formulasDaReceita = () => api.obterDetalhePrescricao(storeId, prescricaoId, TIMEOUT_ROTA).then((det) => (det.body && det.body.formulas) || []);
    const corpoNovaFormula = (extra = {}) => ({
      formula_number: proximoNumeroFormula++,
      pharmaceutical_form_id: formulaBase.pharmaceutical_form_id,
      lab_id: formulaBase.lab_id,
      qvd: 30,
      multiplier: 1,
      ...extra,
    });

    before(() => {
      // Cliente padrão do env.json (R-POM) como paciente e comprador da receita temporária
      api.buscarClientes(storeId, configEnv.DEFAULT_CLIENT_NAME).then((resCli) => {
        const cliente = (resCli.body && (resCli.body.items || resCli.body))[0];
        expect(cliente && cliente.id, '🔒 DEFAULT_CLIENT_NAME não achou cliente (massa)').to.be.ok;
        api.criarPrescricao(storeId, {
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
          prescricaoId = resPresc.body.id || resPresc.body.prescription_id;
          expect(prescricaoId, 'ID da receita temporária').to.be.ok;
          api.criarFormulaPrescricao(storeId, prescricaoId, {
            formula_number: 1, pharmaceutical_form_id: 2, lab_id: 2, qvd: 30, multiplier: 1,
          }).then((resFormula) => {
            expect(resFormula.status, 'Status da criação da fórmula temporária').to.be.oneOf([200, 201]);
            formulaId = resFormula.body.id;
            expect(formulaId, 'ID da fórmula temporária').to.be.ok;
            formulaBase = { id: formulaId, pharmaceutical_form_id: 2, lab_id: 2 };
          });
        });
      });
    });

    it('7.1 Deve recusar com 422 a criação de fórmula com campo de texto acima do tamanho da coluna, sem criar nada e sem responder 500', () => {
      formulasDaReceita().then((antes) => {
        Object.keys(LIMITES).forEach((campo) => {
          api.criarFormulaPrescricao(storeId, prescricaoId, corpoNovaFormula({ [campo]: textoDe(LIMITES[campo] + 1) }), TIMEOUT_ROTA).then((res) => {
            expect(res.status, `Status da criação com ${campo} de ${LIMITES[campo] + 1} caracteres (antes: 500 por Data truncation)`).to.eq(422);
            expect(res.body.message, `Mensagem com ${campo}`).to.eq(msgExcedido(campo));
          });
        });
        formulasDaReceita().then((depois) => {
          expect(depois.length, 'nenhuma fórmula pode ter sido criada pelas tentativas recusadas').to.eq(antes.length);
        });
      });
    });

    it('7.2 Deve recusar com 422 o PATCH da fórmula com campo de texto acima do tamanho da coluna, sem alterar a fórmula', () => {
      formulasDaReceita().then((antes) => {
        const original = antes.find((f) => f.id === formulaId);
        Object.keys(LIMITES).forEach((campo) => {
          api.atualizarFormulaPrescricao(storeId, prescricaoId, formulaId, { [campo]: textoDe(LIMITES[campo] + 1) }, TIMEOUT_ROTA).then((res) => {
            expect(res.status, `Status do PATCH com ${campo} de ${LIMITES[campo] + 1} caracteres (antes: 500 por Data truncation)`).to.eq(422);
            expect(res.body.message, `Mensagem do PATCH com ${campo}`).to.eq(msgExcedido(campo));
          });
        });
        formulasDaReceita().then((depois) => {
          const atual = depois.find((f) => f.id === formulaId);
          Object.keys(LIMITES).forEach((campo) => {
            expect(atual[campo], `${campo} não pode ter mudado`).to.eq(original[campo]);
          });
          expect(atual.updated_at, 'nem o carimbo de alteração').to.eq(original.updated_at);
        });
      });
    });

    it('7.3 Deve aceitar e gravar na criação e no PATCH os campos de texto com exatamente o tamanho da coluna', () => {
      const noLimite = Object.fromEntries(Object.entries(LIMITES).map(([campo, max]) => [campo, textoDe(max, campo === 'cid_code' ? 'C' : 'L')]));

      // PATCH: os 8 campos no limite de uma vez
      api.atualizarFormulaPrescricao(storeId, prescricaoId, formulaId, noLimite, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status do PATCH com todos os campos no limite').to.eq(200);
      });
      // Criação: os 8 campos no limite de uma vez
      api.criarFormulaPrescricao(storeId, prescricaoId, corpoNovaFormula(noLimite), TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status da criação com todos os campos no limite').to.be.oneOf([200, 201]);
        const idCriada = res.body.id;
        expect(idCriada, 'ID da fórmula criada no limite').to.be.ok;

        formulasDaReceita().then((formulas) => {
          [formulaId, idCriada].forEach((id) => {
            const f = formulas.find((x) => x.id === id);
            expect(f, `fórmula #${id} na receita`).to.exist;
            Object.entries(LIMITES).forEach(([campo, max]) => {
              expect(String(f[campo]).length, `${campo} da fórmula #${id} gravado por inteiro (${max} caracteres)`).to.eq(max);
            });
          });
        });
      });
    });

    it('7.4 Deve contar o tamanho do cid_code em caracteres e não em bytes: 15 acentuados aceitos e 16 recusados', () => {
      const quinze = 'ç'.repeat(15); // 15 caracteres, 30 bytes em UTF-8
      const dezesseis = 'ç'.repeat(16);
      api.atualizarFormulaPrescricao(storeId, prescricaoId, formulaId, { cid_code: dezesseis }, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status do PATCH com 16 acentuados').to.eq(422);
        expect(res.body.message, 'Mensagem com 16 acentuados').to.eq(msgExcedido('cid_code'));
      });
      api.atualizarFormulaPrescricao(storeId, prescricaoId, formulaId, { cid_code: quinze }, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status do PATCH com 15 acentuados (se 500, a coluna conta bytes e o limite em caracteres engana)').to.eq(200);
      });
      formulasDaReceita().then((formulas) => {
        const f = formulas.find((x) => x.id === formulaId);
        expect(f.cid_code, 'os 15 acentuados gravados sem perda').to.eq(quinze);
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 46: LIMITE DE 10 CARACTERES DA QUANTIDADE E DA UNIDADE NO CÁLCULO DA FÓRMULA
  // ---------------------------------------------------------------------------
  context('8. Limites da Quantidade e da Unidade do Produto no Cálculo da Fórmula (Issue backend#638/PR #646 e backend#734/PR #756)', () => {

    // O bloco PRODUTOS_IP enviado à procedure é posicional, em campos de 10 caracteres (produto, quantidade, unidade, quantidade definida).
    // Um valor maior deslocava os campos seguintes e a UTIL_CALC_PRODUTOS quebrava com 500 (conversion error from string "mg0000000").
    // Agora a quantidade que não cabe responde 422 com o nome do campo, na prévia do cálculo, e também no POST e no PATCH do produto.
    // Só valores RECUSADOS vão às rotas de escrita (receita não tem DELETE) e a prévia não grava: nenhuma massa é criada.
    // PR #756 (backend#734): a unidade só cabe com até 7 caracteres (o motor lê 7: com 8 ou mais, `string right truncation`, antes 500), e o estouro
    // numérico do motor (`numeric value is out of range` e `Integer overflow`, antes 500) passa a responder 422. A PR #761 trocou a mensagem e tirou as bordas fixas do contrato:
    // o limite depende da conversão da unidade (em MG a quantidade é dividida por 1000, em G não) e das linhas que a forma farmacêutica inclui (cadastro de cada farmácia),
    // então nenhum teste fixa uma borda: o que cabe é uso normal e o que estoura é claramente acima. Todo caso de quantidade informa a unidade e o QVD (`qvd: 0` é 422 na rota).
    // Fora de escopo: o cálculo persistente (`POST .../calculate` e `PATCH calculated: true`) com quantidade que estoura exige gravar o valor na fórmula (receita não tem DELETE).
    const TIMEOUT_ROTA = { timeout: 90000 };
    const LIMITE_UNIDADE = 7;
    const MSG_QUANTIDADE_COM_VALOR = (q) => `A quantidade ${q} excede o limite de 10 caracteres do cálculo.`;
    const MSG_QUANTIDADE_SEM_VALOR = 'A quantidade excede o limite de 10 caracteres do cálculo.';
    const MSG_UNIDADE = (u) => `A unidade ${u} excede o limite de ${LIMITE_UNIDADE} caracteres do cálculo.`;
    const MSG_QUANTIDADE_EXCEDE_LIMITE = 'A quantidade dos produtos excede o limite do cálculo para esta forma farmacêutica.';
    const DETALHE_INTERNO = /numeric value|out of range|string right truncation|MOV_ATENDIMENTO|UTIL_CALC|SQLSTATE|Firebird|Exception|An unexpected error/i;

    let massa = null; // { prescricao, formula, produto } — fórmula real com produto, só lida

    const acharFormulaComProduto = (ids, i) => {
      if (i >= ids.length) return cy.wrap(null, { log: false });
      return api.obterDetalhePrescricao(storeId, ids[i], TIMEOUT_ROTA).then((det) => {
        const formula = ((det.body && det.body.formulas) || []).find((f) => (
          f.pharmaceutical_form_id && Number(f.qvd) > 0 && Array.isArray(f.products) && f.products.length >= 1 && f.products[0].product_id && f.products[0].unit
        ));
        return formula ? cy.wrap({ prescricao: ids[i], formula, produto: formula.products[0] }, { log: false }) : acharFormulaComProduto(ids, i + 1);
      });
    };

    before(() => {
      api.listarPrescricoes(storeId, { filter: 'pending', page: 1, per_page: 40 }, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status da listagem de receitas pendentes').to.eq(200);
        const ids = ((res.body && res.body.items) || []).map((r) => r.id).slice(0, 25);
        acharFormulaComProduto(ids, 0).then((achada) => { massa = achada; });
      });
    });

    const semMassa = '🔒 Nenhuma receita pendente com fórmula que tenha produto, QVD e forma farmacêutica (massa)';

    const corpoPrevia = (quantity, unit, produtosExtras = []) => ({
      pharmaceutical_form_id: massa.formula.pharmaceutical_form_id,
      qvd: Number(massa.formula.qvd),
      multiplier: 1,
      products: [{ product_id: massa.produto.product_id, quantity, unit: unit === undefined ? massa.produto.unit : unit }, ...produtosExtras],
    });

    // Mesma prévia, com a unidade e o QVD fixados: o limite de gramas × QVD depende dos dois, então o QVD da massa não serve
    const corpoPreviaQvd = (quantity, unit, qvd) => ({ ...corpoPrevia(quantity, unit), qvd });

    // 422 com a mensagem esperada e sem detalhe interno do banco, do motor ou da procedure
    const esperarRecusa422 = (res, mensagem, descricao) => {
      expect(res.status, `Status da prévia com ${descricao}`).to.eq(422);
      expect(res.body.message, `Mensagem da prévia com ${descricao}`).to.eq(mensagem);
      expect(JSON.stringify(res.body), `A resposta da prévia com ${descricao} não pode expor detalhe interno`).not.to.match(DETALHE_INTERNO);
    };

    const estadoDaFormula = () => api.obterDetalhePrescricao(storeId, massa.prescricao, TIMEOUT_ROTA).then((det) => {
      const formula = ((det.body && det.body.formulas) || []).find((f) => f.id === massa.formula.id);
      return { formula, produto: formula.products.find((p) => p.id === massa.produto.id) };
    });

    it('8.1 Deve recusar com 422 na prévia do cálculo a quantidade de 11 caracteres, sem chegar à procedure nem responder 500', () => {
      expect(massa, semMassa).to.exist;
      // Antes da PR #646 a quantidade passava e a procedure quebrava com 500 (conversion error from string "mg0000000")
      [
        [123456.1234, MSG_QUANTIDADE_COM_VALOR('123456.1234')],
        ['123456.1234', MSG_QUANTIDADE_COM_VALOR('123456.1234')],
        [12345678901, MSG_QUANTIDADE_SEM_VALOR],
      ].forEach(([quantity, mensagem]) => {
        api.preverCalculoFormula(storeId, corpoPrevia(quantity), TIMEOUT_ROTA).then((res) => {
          expect(res.status, `Status da prévia com quantity=${JSON.stringify(quantity)}`).to.eq(422);
          expect(res.body.message, `Mensagem da prévia com quantity=${JSON.stringify(quantity)}`).to.eq(mensagem);
        });
      });

      // Um produto que não cabe derruba a prévia inteira, mesmo sendo o 2º da lista
      const segundo = { product_id: massa.produto.product_id, quantity: 123456.1234, unit: massa.produto.unit };
      api.preverCalculoFormula(storeId, corpoPrevia(500, undefined, [segundo]), TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status da prévia com o 2º produto estourado').to.eq(422);
        expect(res.body.message, 'Mensagem da prévia com o 2º produto estourado').to.eq(MSG_QUANTIDADE_COM_VALOR('123456.1234'));
      });
    });

    // Reativado e reescrito com unidade e QVD explícitos (Issue backend#734/PR #756): antes esperava 200 também para 1234567890, que em MG com QVD 30 passa de 9.223.372 g × QVD.
    it('8.2 Deve aceitar na prévia do cálculo a quantidade de 10 caracteres que cabe no limite e as quantidades de uso normal', () => {
      expect(massa, semMassa).to.exist;
      // 123456.123 tem 10 caracteres (o teto exato do bloco); 500, 0.25 e 250 são o uso do dia a dia
      [123456.123, 500, 0.25, 250].forEach((quantity) => {
        api.preverCalculoFormula(storeId, corpoPreviaQvd(quantity, 'MG', 30), TIMEOUT_ROTA).then((res) => {
          expect(res.status, `Status da prévia com quantity=${quantity}`).to.eq(200);
          expect(res.body.lines, `linhas da prévia com quantity=${quantity}`).to.be.an('array').and.not.be.empty;
        });
      });
    });

    it('8.3 Deve recusar com 422 na prévia do cálculo a unidade de 11 caracteres, citando a unidade', () => {
      expect(massa, semMassa).to.exist;
      const unidadeLonga = 'abcdefghijk';
      api.preverCalculoFormula(storeId, corpoPrevia(500, unidadeLonga), TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status da prévia com unidade de 11 caracteres').to.eq(422);
        expect(res.body.message, 'Mensagem da prévia com unidade de 11 caracteres').to.eq(MSG_UNIDADE(unidadeLonga));
      });
    });

    it('8.4 Deve recusar com 422 ao adicionar produto à fórmula com quantidade de 11 caracteres, sem gravar o produto', () => {
      expect(massa, semMassa).to.exist;
      estadoDaFormula().then(({ formula: antes }) => {
        // Antes da PR #646 o produto era gravado e só quebrava no cálculo
        [
          [123456.1234, MSG_QUANTIDADE_COM_VALOR('123456.1234')],
          [12345678901, MSG_QUANTIDADE_SEM_VALOR],
        ].forEach(([quantity, mensagem]) => {
          api.adicionarProdutoFormula(storeId, massa.prescricao, massa.formula.id, {
            product_id: massa.produto.product_id,
            quantity,
            unit: massa.produto.unit,
          }, TIMEOUT_ROTA).then((res) => {
            expect(res.status, `Status do POST de produto com quantity=${quantity}`).to.eq(422);
            expect(res.body.message, `Mensagem do POST de produto com quantity=${quantity}`).to.eq(mensagem);
          });
        });
        estadoDaFormula().then(({ formula: depois }) => {
          expect(depois.products.length, 'nenhum produto pode ter sido gravado pelas tentativas recusadas').to.eq(antes.products.length);
          expect(depois.updated_at, 'nem o carimbo de alteração da fórmula').to.eq(antes.updated_at);
        });
      });
    });

    it('8.5 Deve recusar com 422 o PATCH do produto da fórmula com quantidade de 11 caracteres, sem alterar o produto', () => {
      expect(massa, semMassa).to.exist;
      estadoDaFormula().then(({ produto: antes }) => {
        api.atualizarProdutoFormula(storeId, massa.prescricao, massa.formula.id, massa.produto.id, { quantity: 123456.1234 }, TIMEOUT_ROTA).then((res) => {
          expect(res.status, 'Status do PATCH de produto com quantity de 11 caracteres').to.eq(422);
          expect(res.body.message, 'Mensagem do PATCH de produto').to.eq(MSG_QUANTIDADE_COM_VALOR('123456.1234'));
        });
        estadoDaFormula().then(({ produto: depois }) => {
          expect(Number(depois.quantity), 'a quantidade do produto não pode ter mudado').to.eq(Number(antes.quantity));
          expect(depois.updated_at, 'nem o carimbo de alteração do produto').to.eq(antes.updated_at);
        });
      });
    });

    it('8.6 Deve aceitar na prévia do cálculo a quantidade de uso normal e recusar com 422 a quantidade claramente acima do limite, sem 500 (backend#734)', () => {
      expect(massa, semMassa).to.exist;
      // Sem bordas fixas (PR #761): o limite muda com o cadastro da forma farmacêutica. Uso normal em MG cabe com os dois QVD; 999999999 MG estoura com os dois (antes 500)
      [
        [1000, 'MG', 30, true],
        [500, 'MG', 100, true],
        [999999999, 'MG', 30, false],
        [999999999, 'MG', 100, false],
      ].forEach(([quantity, unit, qvd, cabe]) => {
        const descricao = `quantity=${quantity} ${unit} e qvd=${qvd}`;
        api.preverCalculoFormula(storeId, corpoPreviaQvd(quantity, unit, qvd), TIMEOUT_ROTA).then((res) => {
          if (cabe) {
            expect(res.status, `Status da prévia com ${descricao} (dentro do limite)`).to.eq(200);
            expect(res.body.lines, `linhas da prévia com ${descricao}`).to.be.an('array').and.not.be.empty;
          } else {
            esperarRecusa422(res, MSG_QUANTIDADE_EXCEDE_LIMITE, descricao);
          }
        });
      });
    });

    it('8.7 Deve aplicar o limite do cálculo conforme a unidade informada: a mesma quantidade passa em MG e é recusada em G (backend#734)', () => {
      expect(massa, semMassa).to.exist;
      // Sem borda fixa: o limite muda com o cadastro da forma farmacêutica da massa e com o QVD (100000 G coube numa forma e estourou noutra). Em MG a quantidade é dividida por 1000, em G não;
      // então o teste acha na hora a primeira potência de 10 que G recusa e prova a regra relativa: essa mesma quantidade, recusada em G, cabe em MG (o limite de MG é cerca de 1000 vezes o de G).
      const LIMITE_DE_CARACTERES = 1e9; // 10 caracteres: acima disso a recusa é outra (a do tamanho do campo)
      const previa = (quantity, unit, qvd) => api.preverCalculoFormula(storeId, corpoPreviaQvd(quantity, unit, qvd), TIMEOUT_ROTA);
      const acharPrimeiraRecusadaEmG = (qvd, quantity = 10) => previa(quantity, 'G', qvd).then((res) => {
        if (res.status === 422) return { quantity, res };
        expect(res.status, `Status da prévia com quantity=${quantity} G e qvd=${qvd} (dentro do limite)`).to.eq(200);
        expect(quantity, `G aceitou até ${quantity} com qvd=${qvd}: o limite do cálculo em gramas deixou de existir`).to.be.lessThan(LIMITE_DE_CARACTERES);
        return acharPrimeiraRecusadaEmG(qvd, quantity * 10);
      });
      [30, 100].forEach((qvd) => {
        acharPrimeiraRecusadaEmG(qvd).then(({ quantity, res }) => {
          esperarRecusa422(res, MSG_QUANTIDADE_EXCEDE_LIMITE, `quantity=${quantity} G e qvd=${qvd}`);
          previa(quantity, 'MG', qvd).then((resMg) => {
            const descricao = `quantity=${quantity} MG e qvd=${qvd}`;
            expect(resMg.status, `Status da prévia com ${descricao} (a mesma quantidade que G recusou)`).to.eq(200);
            expect(resMg.body.lines, `linhas da prévia com ${descricao}`).to.be.an('array').and.not.be.empty;
          });
        });
      });
    });

    it('8.8 Deve recusar com 422 na prévia do cálculo a unidade de 8 a 10 caracteres, citando a unidade e o limite de 7, sem 500 (backend#734)', () => {
      expect(massa, semMassa).to.exist;
      // O motor lê a unidade em 7 caracteres; com 8 ou mais dava `string right truncation` e 500 (achado fora da issue backend#638, ROADMAP P1-04)
      ['ABCDEFGH', 'ABCDEFGHI', 'ABCDEFGHIJ'].forEach((unidade) => {
        api.preverCalculoFormula(storeId, corpoPrevia(500, unidade), TIMEOUT_ROTA).then((res) => {
          esperarRecusa422(res, MSG_UNIDADE(unidade), `unit=${unidade} (${unidade.length} caracteres)`);
        });
      });
    });

    it('8.9 Deve tratar a unidade de exatamente 7 caracteres sem 500 e sem a mensagem do limite de caracteres (backend#734)', () => {
      expect(massa, semMassa).to.exist;
      // Essa unidade não existe no cadastro: o motor pode responder 200 ou 422 próprio, mas o limite de 7 não pode ser acusado nem a procedure quebrar
      const unidade = 'ABCDEFG';
      api.preverCalculoFormula(storeId, corpoPrevia(500, unidade), TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status da prévia com unidade de 7 caracteres').to.be.oneOf([200, 422]);
        expect(JSON.stringify(res.body), 'A resposta da prévia com unidade de 7 caracteres não pode acusar o limite de caracteres').not.to.contain(MSG_UNIDADE(unidade));
        expect(JSON.stringify(res.body), 'nem expor detalhe interno').not.to.match(DETALHE_INTERNO);
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 50: DECIMAL COM EXPOENTE EXTREMO RESPONDE 400, NÃO ESGOTA A MEMÓRIA DO SERVIDOR
  // ---------------------------------------------------------------------------
  context('9. Decimal com Expoente Extremo Responde 400, não Esgota a Memória do Servidor (Issue backend#650/PR #651)', () => {

    // O Jackson aceita `1e-999999999` e `1e999999999` como BigDecimal (scale de ±999999999) e o texto é curto, então nenhum limite de tamanho barra o valor.
    // Qualquer toPlainString() sobre ele monta uma string de 1 bilhão de caracteres e esgota a heap da task (OutOfMemoryError, visto em validate-discount com persist=true).
    // A PR #651 recusa na desserialização, em um ponto só, todo BigDecimal com scale fora de ±100: 400 "Malformed request body" antes de qualquer service.
    // Só são enviados valores que o contrato recusa e, nas rotas de escrita, só com a recusa provada antes por um valor sentinela (expoente 101): se a correção
    // não estiver no ar o teste para ali, sem mandar o extremo, que derrubaria a task de dev de todos os tenants. Nada é gravado: o estado da fórmula é conferido depois.
    // JSON.stringify não preserva `1e-999999999` (Number vira 0): o corpo vai como texto literal (`requestJsonBruto`).
    // Caminho `JsonNode` (PATCH): coberto em 9.3 pelo `multiplier` da fórmula, que responde 422 próprio (a validação da rota roda antes do 400 do JsonNodeException).
    // Fora de escopo: PATCH de `quantity` do produto com Infinity (a PR #646 recusa por tamanho de texto e "Infinity" cabe em 10 caracteres: gravaria lixo se a recusa falhar).
    const TIMEOUT_ROTA = { timeout: 90000 };
    const EXTREMOS = ['1e-999999999', '1e999999999', '-1e999999999'];
    const MSG_MALFORMADO = 'Malformed request body';

    let massa = null; // { prescricao, formula } — fórmula real com multiplier 1, produto e QVD, só lida

    // Percorre as receitas pendentes até achar uma fórmula CALCULADA com multiplier 1, QVD e ao menos 1 produto (só leitura). Sem `calculated`, o validate-discount responde 422
    // "Nenhuma fórmula calculada para ajustar desconto." (2026-10-20: receitas temporárias de outros contexts, sem cálculo, tomaram o topo da lista de pendentes)
    const acharFormulaComMultiplicador1 = (ids, i) => {
      if (i >= ids.length) return cy.wrap(null, { log: false });
      return api.obterDetalhePrescricao(storeId, ids[i], TIMEOUT_ROTA).then((det) => {
        const formula = ((det.body && det.body.formulas) || []).find((f) => (
          Number(f.multiplier) === 1 && Number(f.qvd) > 0 && f.pharmaceutical_form_id && Array.isArray(f.products) && f.products.length >= 1 && f.calculated === true
        ));
        return formula ? cy.wrap({ prescricao: ids[i], formula }, { log: false }) : acharFormulaComMultiplicador1(ids, i + 1);
      });
    };

    before(() => {
      api.listarPrescricoes(storeId, { filter: 'pending', page: 1, per_page: 40 }, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status da listagem de receitas pendentes').to.eq(200);
        const ids = ((res.body && res.body.items) || []).map((r) => r.id).slice(0, 25);
        acharFormulaComMultiplicador1(ids, 0).then((achada) => { massa = achada; });
      });
    });

    const semMassa = '🔒 Nenhuma receita pendente com fórmula calculada de multiplier 1, QVD e produto (massa)';
    const urlValidar = () => `/prescriptions/${massa.prescricao}/validate-discount`;
    const urlPrevia = () => `/prescriptions/formula-calculations`;
    const urlFormula = () => `/prescriptions/${massa.prescricao}/formulas/${massa.formula.id}`;

    const corpoValidar = (valor, persist) => `{"discount_percentage":${valor},"persist":${persist}}`;
    const corpoPrevia = (valor) => {
      const p = massa.formula.products[0];
      return `{"pharmaceutical_form_id":${massa.formula.pharmaceutical_form_id},"qvd":${Number(massa.formula.qvd)},"multiplier":1,"discount_percentage":${valor},`
        + `"products":[{"product_id":${p.product_id || p.id},"quantity":${JSON.stringify(p.quantity)},"unit":${JSON.stringify(p.unit)}}]}`;
    };

    const estadoDasFormulas = () => api.obterDetalhePrescricao(storeId, massa.prescricao, TIMEOUT_ROTA).then((det) => JSON.stringify((det.body && det.body.formulas) || []));

    const exigirCorpoMalformado = (res, rotulo) => {
      expect(res.status, `Status de ${rotulo} (antes da PR #651 o extremo esgotava a heap: 500 OutOfMemoryError)`).to.eq(400);
      expect(res.body.error, `error de ${rotulo}`).to.eq('Bad Request');
      expect(res.body.message, `Mensagem de ${rotulo}`).to.eq(MSG_MALFORMADO);
    };

    // Sentinela: scale 101 é inofensivo (101 caracteres) e já é recusado pela PR #651; sem a correção responderia 200 e o teste não manda o extremo
    const garantirCorrecaoNoAr = () => api.requestJsonBruto('POST', urlValidar(), corpoValidar('1e-101', false), TIMEOUT_ROTA).then((res) => {
      expect(res.status, '🛑 A PR #651 não está no ar (scale 101 deveria responder 400): extremos NÃO enviados para não esgotar a heap da task').to.eq(400);
    });

    it('9.1 Deve recusar com 400 o desconto com expoente extremo no validate-discount com persist=true, sem gravar nada nem esgotar a memória', () => {
      expect(massa, semMassa).to.exist;
      garantirCorrecaoNoAr().then(() => estadoDasFormulas()).then((antes) => {
        EXTREMOS.forEach((valor) => {
          api.requestJsonBruto('POST', urlValidar(), corpoValidar(valor, true), TIMEOUT_ROTA).then((res) => {
            exigirCorpoMalformado(res, `validate-discount persist=true com discount_percentage=${valor}`);
          });
        });
        estadoDasFormulas().then((depois) => {
          expect(depois, 'as fórmulas da receita não podem mudar com um desconto recusado').to.eq(antes);
        });
      });
    });

    it('9.2 Deve recusar com 400 o desconto com expoente extremo na prévia do cálculo da fórmula', () => {
      expect(massa, semMassa).to.exist;
      garantirCorrecaoNoAr().then(() => {
        EXTREMOS.forEach((valor) => {
          api.requestJsonBruto('POST', urlPrevia(), corpoPrevia(valor), TIMEOUT_ROTA).then((res) => {
            exigirCorpoMalformado(res, `prévia com discount_percentage=${valor}`);
          });
        });
      });
    });

    it('9.3 Deve recusar o multiplier com expoente extremo no PATCH da fórmula (corpo lido como JsonNode), sem gravar nada nem responder 500', () => {
      expect(massa, semMassa).to.exist;
      garantirCorrecaoNoAr().then(() => estadoDasFormulas()).then((antes) => {
        EXTREMOS.forEach((valor) => {
          api.requestJsonBruto('PATCH', urlFormula(), `{"multiplier":${valor}}`, TIMEOUT_ROTA).then((res) => {
            expect(res.status, `Status do PATCH com multiplier=${valor} (antes: Infinity dava 500 em decimalValue())`).to.eq(422);
            expect(res.body.message, `Mensagem com multiplier=${valor}`).to.eq('Multiplicador inválido.');
          });
        });
        estadoDasFormulas().then((depois) => {
          expect(depois, 'a fórmula não pode mudar com um multiplier recusado').to.eq(antes);
        });
      });
    });

    it('9.4 Deve continuar aceitando os decimais legítimos, com até 4 casas e com expoente comum, no validate-discount e na prévia', () => {
      expect(massa, semMassa).to.exist;
      // Controle positivo: sem ele, recusar tudo passaria nos testes anteriores
      ['10.5', '10.1234', '0.0001', '1.5e-3', '1e2'].forEach((valor) => {
        api.requestJsonBruto('POST', urlValidar(), corpoValidar(valor, false), TIMEOUT_ROTA).then((res) => {
          expect(res.status, `Status do validate-discount com discount_percentage=${valor}`).to.eq(200);
          expect(Number(res.body.requested_discount_percentage), `Desconto pedido devolvido para ${valor}`).to.eq(Number(valor));
        });
        api.requestJsonBruto('POST', urlPrevia(), corpoPrevia(valor), TIMEOUT_ROTA).then((res) => {
          expect(res.status, `Status da prévia com discount_percentage=${valor}`).to.eq(200);
          expect(res.body.lines, `Linhas da prévia com discount_percentage=${valor}`).to.be.an('array').and.not.be.empty;
        });
      });
    });

    it('9.5 Deve aceitar o scale 100 e recusar o 101 com 400, e deixar o valor fora da faixa de negócio para a validação da rota (422)', () => {
      expect(massa, semMassa).to.exist;
      // Fronteira da PR #651: scale entre -100 e 100 passa pela desserialização (1e-100 e 1e100 têm scale 100 e -100); 1e-101 e 1e101 não
      [urlValidar, urlPrevia].forEach((url, i) => {
        const corpo = (valor) => (i === 0 ? corpoValidar(valor, false) : corpoPrevia(valor));
        const rotulo = i === 0 ? 'validate-discount' : 'prévia';
        api.requestJsonBruto('POST', url(), corpo('1e-100'), TIMEOUT_ROTA).then((res) => {
          expect(res.status, `Status de ${rotulo} com 1e-100 (scale 100, dentro do limite)`).to.eq(200);
        });
        ['1e-101', '1e101'].forEach((valor) => {
          api.requestJsonBruto('POST', url(), corpo(valor), TIMEOUT_ROTA).then((res) => {
            exigirCorpoMalformado(res, `${rotulo} com ${valor} (scale 101)`);
          });
        });
        // 1e100 passa pela desserialização e cai na validação de faixa do desconto, que é da rota
        api.requestJsonBruto('POST', url(), corpo('1e100'), TIMEOUT_ROTA).then((res) => {
          expect(res.status, `Status de ${rotulo} com 1e100 (acima de 100%)`).to.eq(422);
          expect(res.body.message, `Mensagem de ${rotulo} com 1e100`).to.eq('Percentual de desconto inválido.');
        });
      });
    });

  });

  context('10. Prévia do Cálculo da Fórmula Recusa Desconto Fora de 0 a 100 com 422 (Issue backend#652/PR #663)', () => {

    // Subissue da #649: a prévia (`POST .../prescriptions/formula-calculations`) aceitava qualquer `discount_percentage` (-10 inflava a receita, 150 deixava o total negativo).
    // A PR #663 recusa fora de 0 a 100 com 422 "Percentual de desconto inválido.", a mesma regra e a mesma mensagem do `validate-discount`.
    // Medido em 2026-10-16 na dev (PR no ar): -10, 150, -1, 101, -0.01 e 100.01 → 422 nas duas rotas; 0, 0.01, 10, 99.99 e 100 → 200 nas duas; sem o campo ou `null` → 200 sem desconto.
    // Só leitura: a prévia não grava nada e o `validate-discount` é chamado sempre com `persist=false`.
    const TIMEOUT_ROTA = { timeout: 90000 };
    const MSG_INVALIDO = 'Percentual de desconto inválido.';

    let massa = null; // { prescricao, formula } — fórmula real com multiplier 1, produto e QVD, só lida

    // Percorre as receitas pendentes até achar uma fórmula CALCULADA com multiplier 1, QVD e ao menos 1 produto (só leitura). Sem `calculated`, o validate-discount responde 422
    // "Nenhuma fórmula calculada para ajustar desconto." (2026-10-20: receitas temporárias de outros contexts, sem cálculo, tomaram o topo da lista de pendentes)
    const acharFormula = (ids, i) => {
      if (i >= ids.length) return cy.wrap(null, { log: false });
      return api.obterDetalhePrescricao(storeId, ids[i], TIMEOUT_ROTA).then((det) => {
        const formula = ((det.body && det.body.formulas) || []).find((f) => (
          Number(f.multiplier) === 1 && Number(f.qvd) > 0 && f.pharmaceutical_form_id && Array.isArray(f.products) && f.products.length >= 1 && f.calculated === true
        ));
        return formula ? cy.wrap({ prescricao: ids[i], formula }, { log: false }) : acharFormula(ids, i + 1);
      });
    };

    before(() => {
      api.listarPrescricoes(storeId, { filter: 'pending', page: 1, per_page: 40 }, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status da listagem de receitas pendentes').to.eq(200);
        const ids = ((res.body && res.body.items) || []).map((r) => r.id).slice(0, 25);
        acharFormula(ids, 0).then((achada) => { massa = achada; });
      });
    });

    const semMassa = '🔒 Nenhuma receita pendente com fórmula calculada de multiplier 1, QVD e produto (massa)';

    // Corpo da prévia; `desconto` indefinido omite o campo
    const corpoPrevia = (desconto) => {
      const p = massa.formula.products[0];
      const corpo = {
        pharmaceutical_form_id: massa.formula.pharmaceutical_form_id,
        qvd: Number(massa.formula.qvd),
        multiplier: 1,
        products: [{ product_id: p.product_id || p.id, quantity: p.quantity, unit: p.unit }],
      };
      if (desconto !== undefined) corpo.discount_percentage = desconto;
      return corpo;
    };
    const previa = (desconto) => api.preverCalculoFormula(storeId, corpoPrevia(desconto), TIMEOUT_ROTA);
    const validar = (desconto) => api.post(`/prescriptions/${massa.prescricao}/validate-discount`, { discount_percentage: desconto, persist: false }, TIMEOUT_ROTA);

    const exigirRecusa = (res, rotulo) => {
      expect(res.status, `Status de ${rotulo} (antes da PR #663 a prévia calculava com o valor fora da faixa)`).to.eq(422);
      expect(res.body.message, `Mensagem de ${rotulo}`).to.eq(MSG_INVALIDO);
      expect(res.body, `Corpo de ${rotulo} não traz totais calculados`).to.not.have.property('totals');
    };

    it('10.1 Deve recusar com 422 a prévia com desconto negativo (-10) ou acima de 100 (150), sem calcular o total', () => {
      expect(massa, semMassa).to.exist;
      [-10, 150].forEach((desconto) => {
        previa(desconto).then((res) => exigirRecusa(res, `prévia com discount_percentage=${desconto}`));
      });
    });

    it('10.2 Deve recusar com 422 a prévia com desconto a um centésimo além de cada limite (-0.01 e 100.01)', () => {
      expect(massa, semMassa).to.exist;
      [-0.01, 100.01].forEach((desconto) => {
        previa(desconto).then((res) => exigirRecusa(res, `prévia com discount_percentage=${desconto}`));
      });
    });

    it('10.3 Deve continuar calculando a prévia com desconto 0, 10 e 100, e com 100 o valor com desconto fica 0,00', () => {
      expect(massa, semMassa).to.exist;
      previa(0).then((semDesconto) => {
        expect(semDesconto.status, 'Status da prévia com discount_percentage=0').to.eq(200);
        const venda = semDesconto.body.totals.sale_value;
        expect(venda, 'Valor de venda da fórmula (massa real)').to.be.greaterThan(0);
        expect(semDesconto.body.totals.sale_value_discounted, 'Com desconto 0 o valor com desconto é o de venda').to.eq(venda);

        previa(10).then((res) => {
          expect(res.status, 'Status da prévia com discount_percentage=10').to.eq(200);
          expect(res.body.totals.sale_value, 'O valor de venda não muda com o desconto').to.eq(venda);
          expect(res.body.totals.sale_value_discounted, 'Com 10% o valor com desconto é 90% da venda (tolerância de 1 centavo de arredondamento)').to.be.closeTo(venda * 0.9, 0.011);
        });

        previa(100).then((res) => {
          expect(res.status, 'Status da prévia com discount_percentage=100').to.eq(200);
          expect(res.body.totals.sale_value, 'O valor de venda não muda com o desconto').to.eq(venda);
          expect(res.body.totals.sale_value_discounted, 'Com 100% o valor com desconto é 0,00 (nunca negativo)').to.eq(0);
        });
      });
    });

    it('10.4 Deve calcular sem desconto quando a prévia não manda discount_percentage', () => {
      expect(massa, semMassa).to.exist;
      previa(undefined).then((res) => {
        expect(res.status, 'Status da prévia sem discount_percentage').to.eq(200);
        expect(res.body.lines, 'Linhas da prévia').to.be.an('array').and.not.be.empty;
        expect(res.body.totals.sale_value_discounted, 'Sem o campo não há desconto').to.eq(res.body.totals.sale_value);
      });
    });

    it('10.5 Deve aplicar na prévia a mesma regra e a mesma mensagem do validate-discount, nos limites e além deles', () => {
      expect(massa, semMassa).to.exist;
      // 422 nas duas rotas fora da faixa; 200 nas duas dentro dela (incluindo os limites exatos 0 e 100)
      [-10, -1, -0.01, 150, 101, 100.01].forEach((desconto) => {
        validar(desconto).then((resValidar) => {
          exigirRecusa(resValidar, `validate-discount com discount_percentage=${desconto}`);
          previa(desconto).then((resPrevia) => {
            exigirRecusa(resPrevia, `prévia com discount_percentage=${desconto}`);
            expect(resPrevia.body.message, `Mensagem da prévia = mensagem do validate-discount (${desconto})`).to.eq(resValidar.body.message);
          });
        });
      });
      [0, 0.01, 10, 99.99, 100].forEach((desconto) => {
        validar(desconto).then((resValidar) => {
          expect(resValidar.status, `Status do validate-discount com discount_percentage=${desconto}`).to.eq(200);
          previa(desconto).then((resPrevia) => {
            expect(resPrevia.status, `Status da prévia com discount_percentage=${desconto}`).to.eq(200);
          });
        });
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 54: CAMPOS NUMÉRICOS DA FÓRMULA (QVD, PESO, TAXA TÉCNICA, VALOR EXTRA E DO TIPO DE MEDICAMENTO) — ISSUE BACKEND#654, PR #665
  // ---------------------------------------------------------------------------
  context('11. Campos Numéricos da Fórmula: QVD, Peso, Taxa Técnica, Valor Extra e do Tipo de Medicamento Recusam o Inválido com 422 (Issue backend#654/PR #665)', () => {

    // Subissue da #649. As colunas são NUMERIC(18,2): `qvd: 0.001` passava na regra "maior que zero" e gravava 0, as casas a mais eram arredondadas sem aviso, valores negativos
    // eram gravados e um valor acima do teto da coluna (`1e17`) dava 500. A PR #665 recusa com 422 no `POST` e no `PATCH` da fórmula e na prévia do cálculo:
    //   - `qvd` fora de 0,01 a 9999999999999999,99 ou com mais de 2 casas → "QVD deve estar entre 0,01 e 9999999999999999,99, com até 2 casas decimais."; ausente no POST ou nulo no PATCH → "QVD obrigatório.";
    //   - `weight`, `technical_fee_value`, `extra_value` e `medicine_type_value` negativos, acima do teto ou com mais de 2 casas → "O campo <campo> deve estar entre 0 e 9999999999999999,99, com até 2 casas decimais.".
    // Na prévia `technical_fee_value` é só saída e não é validado; sem `qvd` ela calcula como antes. Zeros à direita não contam como casa (`1.500` é aceito).
    // Receita não tem DELETE: tudo que escreve roda numa receita temporária própria (1 por rodada, no tenant dev — mesmo padrão do ctx 7), sem tocar em receita real; a prévia só lê
    // (fórmula real de uma receita pendente, como nos ctx 9 e 10). Os corpos vão como texto JSON literal (`requestJsonBruto`): `9999999999999999.99` não sobrevive a `JSON.stringify`.
    // Limites do que a automação consegue provar: o `JSON.parse` do Cypress arredonda `9999999999999999.99` para `1e16`, então o teto exato só prova o aceite (201), não o valor gravado.
    // Achado fora da issue (ver `ROADMAP.md` P1): o PATCH lê o número como double, então recusa o teto exato de `extra_value`/`qvd` (que o POST aceita) e perde precisão acima de ~1e15
    // (`1000000000000000.55` grava `1000000000000000.5`); sem teste, para não fixar como esperado um comportamento que provavelmente é defeito.
    const TIMEOUT_ROTA = { timeout: 90000 };
    const MSG_QVD = 'QVD deve estar entre 0,01 e 9999999999999999,99, com até 2 casas decimais.';
    const MSG_QVD_OBRIGATORIO = 'QVD obrigatório.';
    const msgCampo = (campo) => `O campo ${campo} deve estar entre 0 e 9999999999999999,99, com até 2 casas decimais.`;
    const CAMPOS_VALOR = ['weight', 'technical_fee_value', 'extra_value', 'medicine_type_value'];

    let prescricaoId = null;
    let formulaId = null;
    let proximoNumeroFormula = 2;
    let massa = null; // { formula } — fórmula real de receita pendente (multiplier 1, QVD e produto), só lida, usada na prévia

    const urlFormulas = () => `/prescriptions/${prescricaoId}/formulas`;
    const urlFormula = () => `${urlFormulas()}/${formulaId}`;
    const formulasDaReceita = () => api.obterDetalhePrescricao(storeId, prescricaoId, TIMEOUT_ROTA).then((det) => (det.body && det.body.formulas) || []);

    // `campos` é texto JSON já pronto (sem as chaves), ex.: '"qvd":30,"extra_value":-5'
    const criar = (campos) => api.requestJsonBruto('POST', urlFormulas(), `{"formula_number":${proximoNumeroFormula++},"pharmaceutical_form_id":2,"lab_id":2,"multiplier":1${campos ? `,${campos}` : ''}}`, TIMEOUT_ROTA);
    const alterar = (campos) => api.requestJsonBruto('PATCH', urlFormula(), `{${campos}}`, TIMEOUT_ROTA);
    const previa = (campos) => {
      const f = massa.formula;
      const p = f.products[0];
      return api.requestJsonBruto('POST', `/prescriptions/formula-calculations`,
        `{"pharmaceutical_form_id":${f.pharmaceutical_form_id},"multiplier":1,${campos ? `${campos},` : ''}"products":[{"product_id":${p.product_id || p.id},"quantity":${JSON.stringify(p.quantity)},"unit":${JSON.stringify(p.unit)}}]}`,
        TIMEOUT_ROTA);
    };

    const exigir422 = (res, mensagem, rotulo) => {
      expect(res.status, `Status de ${rotulo} (antes da PR #665 gravava o valor, arredondava em silêncio ou dava 500)`).to.eq(422);
    // Percorre as receitas pendentes até achar uma fórmula com multiplier 1, QVD e ao menos 1 produto (só leitura)
    };

    // Percorre as receitas pendentes até achar uma fórmula com multiplier 1, QVD e ao menos 1 produto (só leitura)
    const acharFormula = (ids, i) => {
      if (i >= ids.length) return cy.wrap(null, { log: false });
      return api.obterDetalhePrescricao(storeId, ids[i], TIMEOUT_ROTA).then((det) => {
        const formula = ((det.body && det.body.formulas) || []).find((f) => (
          Number(f.multiplier) === 1 && Number(f.qvd) > 0 && f.pharmaceutical_form_id && Array.isArray(f.products) && f.products.length >= 1
        ));
        return formula ? cy.wrap({ formula }, { log: false }) : acharFormula(ids, i + 1);
      });
    };

    before(() => {
      api.listarPrescricoes(storeId, { filter: 'pending', page: 1, per_page: 40 }, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status da listagem de receitas pendentes').to.eq(200);
        const ids = ((res.body && res.body.items) || []).map((r) => r.id).slice(0, 25);
        acharFormula(ids, 0).then((achada) => { massa = achada; });
      });
      // Cliente padrão do env.json (R-POM) como paciente e comprador da receita temporária
      api.buscarClientes(storeId, configEnv.DEFAULT_CLIENT_NAME).then((resCli) => {
        const cliente = (resCli.body && (resCli.body.items || resCli.body))[0];
        expect(cliente && cliente.id, '🔒 DEFAULT_CLIENT_NAME não achou cliente (massa)').to.be.ok;
        api.criarPrescricao(storeId, {
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
          prescricaoId = resPresc.body.id || resPresc.body.prescription_id;
          expect(prescricaoId, 'ID da receita temporária').to.be.ok;
          api.criarFormulaPrescricao(storeId, prescricaoId, {
            formula_number: 1, pharmaceutical_form_id: 2, lab_id: 2, qvd: 30, multiplier: 1,
          }).then((resFormula) => {
            expect(resFormula.status, 'Status da criação da fórmula temporária').to.be.oneOf([200, 201]);
            formulaId = resFormula.body.id;
            expect(formulaId, 'ID da fórmula temporária').to.be.ok;
          });
        });
      });
    });

    it('11.1 Deve recusar com 422 a criação de fórmula com QVD abaixo de 0,01, com mais de 2 casas, acima do teto ou ausente, sem criar nada', () => {
      formulasDaReceita().then((antes) => {
        ['0.001', '0', '30.125', '1e17', '-1'].forEach((qvd) => {
          criar(`"qvd":${qvd}`).then((res) => exigir422(res, MSG_QVD, `criação com qvd=${qvd}`));
        });
        criar('').then((res) => exigir422(res, MSG_QVD_OBRIGATORIO, 'criação sem qvd'));
        criar('"qvd":null').then((res) => exigir422(res, MSG_QVD_OBRIGATORIO, 'criação com qvd nulo'));
        formulasDaReceita().then((depois) => {
          expect(depois.length, 'nenhuma fórmula pode ter sido criada pelas tentativas recusadas').to.eq(antes.length);
        });
      });
    });

    it('11.2 Deve recusar com 422 o PATCH do QVD abaixo de 0,01, com mais de 2 casas, acima do teto ou nulo, sem alterar a fórmula', () => {
      formulasDaReceita().then((antes) => {
        const original = antes.find((f) => f.id === formulaId);
        ['0.001', '0', '30.125', '1e17'].forEach((qvd) => {
          alterar(`"qvd":${qvd}`).then((res) => exigir422(res, MSG_QVD, `PATCH com qvd=${qvd}`));
        });
        alterar('"qvd":null').then((res) => exigir422(res, MSG_QVD_OBRIGATORIO, 'PATCH com qvd nulo'));
        formulasDaReceita().then((depois) => {
          const atual = depois.find((f) => f.id === formulaId);
          expect(atual.qvd, 'o QVD não pode ter mudado').to.eq(original.qvd);
          expect(atual.updated_at, 'nem o carimbo de alteração').to.eq(original.updated_at);
        });
      });
    });

    it('11.3 Deve recusar com 422 a prévia com QVD 0, 0.001, com mais de 2 casas ou acima do teto, e seguir calculando com QVD válido, no mínimo 0,01 e sem QVD', () => {
      expect(massa, '🔒 Nenhuma receita pendente com fórmula de multiplier 1, QVD e produto (massa)').to.exist;
      ['0', '0.001', '30.125', '1e17'].forEach((qvd) => {
        previa(`"qvd":${qvd}`).then((res) => exigir422(res, MSG_QVD, `prévia com qvd=${qvd}`));
      });
      // Controles positivos: sem eles, recusar tudo passaria nos casos acima
      ['"qvd":30', '"qvd":0.01', '', '"qvd":null'].forEach((qvd) => {
        previa(qvd).then((res) => {
          expect(res.status, `Status da prévia com ${qvd || 'qvd ausente'} (como antes da PR #665)`).to.eq(200);
          expect(res.body.totals.sale_value, `Valor de venda da prévia com ${qvd || 'qvd ausente'}`).to.be.greaterThan(0);
        });
      });
    });

    it('11.4 Deve recusar com 422 peso, taxa técnica, valor extra e valor do tipo de medicamento negativos, com mais de 2 casas ou acima do teto, no POST e no PATCH, sem gravar nada', () => {
      const invalidos = [
        ['technical_fee_value', '-5'], ['extra_value', '-5'], ['medicine_type_value', '-5'], ['weight', '-3'],
        ['extra_value', '1.005'], ['weight', '1.005'], ['technical_fee_value', '1.005'], ['medicine_type_value', '1.005'],
        ['extra_value', '1e17'], ['extra_value', '10000000000000000.00'],
      ];
      // O peso só pode ser informado com o peso manual habilitado: liga antes, para a recusa vir do valor e não dessa regra
      alterar('"manual_weight":true').then((res) => expect(res.status, 'Status do PATCH que habilita o peso manual').to.eq(200));
      formulasDaReceita().then((antes) => {
        const original = antes.find((f) => f.id === formulaId);
        invalidos.forEach(([campo, valor]) => {
          criar(`"qvd":30,"${campo}":${valor}`).then((res) => exigir422(res, msgCampo(campo), `criação com ${campo}=${valor}`));
          alterar(`"${campo}":${valor}`).then((res) => exigir422(res, msgCampo(campo), `PATCH com ${campo}=${valor}`));
        });
        formulasDaReceita().then((depois) => {
          expect(depois.length, 'nenhuma fórmula pode ter sido criada pelas tentativas recusadas').to.eq(antes.length);
          const atual = depois.find((f) => f.id === formulaId);
          CAMPOS_VALOR.forEach((campo) => {
            expect(atual[campo], `${campo} não pode ter mudado`).to.eq(original[campo]);
          });
        });
      });
    });

    it('11.5 Deve recusar com 422 na prévia peso, valor extra e valor do tipo de medicamento negativos, com mais de 2 casas ou acima do teto, e não validar a taxa técnica (só saída)', () => {
      expect(massa, '🔒 Nenhuma receita pendente com fórmula de multiplier 1, QVD e produto (massa)').to.exist;
      [['weight', '-1'], ['extra_value', '-1'], ['medicine_type_value', '-1'], ['extra_value', '1.005'], ['extra_value', '1e17']].forEach(([campo, valor]) => {
        previa(`"qvd":30,"${campo}":${valor}`).then((res) => exigir422(res, msgCampo(campo), `prévia com ${campo}=${valor}`));
      });
      // Controles positivos: valores válidos com até 2 casas calculam; a taxa técnica é só saída, não é validada (mesmo negativa)
      previa('"qvd":30,"weight":1.5,"extra_value":2.5,"medicine_type_value":1.25').then((res) => {
        expect(res.status, 'Status da prévia com valores válidos').to.eq(200);
      });
      previa('"qvd":30,"technical_fee_value":-1').then((res) => {
        expect(res.status, 'Status da prévia com technical_fee_value negativo (só saída, não validado)').to.eq(200);
      });
    });

    it('11.6 Deve continuar gravando exatamente o que foi enviado nos valores válidos com até 2 casas, zeros à direita e nos limites, no POST e no PATCH', () => {
      // POST: valores com até 2 casas e zeros à direita (1.500 não conta como 3 casas)
      criar('"qvd":0.5,"extra_value":2.50,"technical_fee_value":1.500,"medicine_type_value":1.25,"weight":1.25').then((res) => {
        expect(res.status, 'Status da criação com valores válidos').to.eq(201);
        const id = res.body.id;
        expect(id, 'ID da fórmula criada').to.be.ok;
        formulasDaReceita().then((formulas) => {
          const f = formulas.find((x) => x.id === id);
          expect(f.qvd, 'qvd gravado').to.eq(0.5);
          expect(f.extra_value, 'extra_value gravado (2.50)').to.eq(2.5);
          expect(f.technical_fee_value, 'technical_fee_value gravado (1.500 sem arredondar)').to.eq(1.5);
          expect(f.medicine_type_value, 'medicine_type_value gravado').to.eq(1.25);
          expect(f.weight, 'weight gravado').to.eq(1.25);
        });
      });
      // POST: mínimo do QVD e zero nos demais campos (0 é válido; só negativo é recusado)
      criar('"qvd":0.01,"extra_value":0,"technical_fee_value":0,"medicine_type_value":0,"weight":0').then((res) => {
        expect(res.status, 'Status da criação com QVD 0,01 e demais campos 0').to.eq(201);
        formulasDaReceita().then((formulas) => {
          const f = formulas.find((x) => x.id === res.body.id);
          expect(f.qvd, 'qvd mínimo gravado').to.eq(0.01);
          [...CAMPOS_VALOR].forEach((campo) => expect(f[campo], `${campo} 0 gravado`).to.eq(0));
        });
      });
      // POST: tetos exatos aceitos (o JSON.parse do Cypress arredonda 9999999999999999.99 para 1e16, então só o aceite e a ordem de grandeza são provados)
      criar('"qvd":9999999999999999.99,"extra_value":9999999999999999.99').then((res) => {
        expect(res.status, 'Status da criação com QVD e valor extra no teto da coluna').to.eq(201);
        formulasDaReceita().then((formulas) => {
          const f = formulas.find((x) => x.id === res.body.id);
          expect(f.qvd, 'qvd no teto gravado').to.be.at.least(9999999999999999);
          expect(f.extra_value, 'extra_value no teto gravado').to.be.at.least(9999999999999999);
        });
      });
      // PATCH: valores válidos com 2 casas (peso exige o peso manual habilitado)
      alterar('"manual_weight":true').then((res) => expect(res.status, 'Status do PATCH que habilita o peso manual').to.eq(200));
      alterar('"qvd":12345678.12,"extra_value":100.10,"technical_fee_value":1.500,"medicine_type_value":1.25,"weight":2.5').then((res) => {
        expect(res.status, 'Status do PATCH com valores válidos').to.eq(200);
        formulasDaReceita().then((formulas) => {
          const f = formulas.find((x) => x.id === formulaId);
          expect(f.qvd, 'qvd gravado pelo PATCH').to.eq(12345678.12);
          expect(f.extra_value, 'extra_value gravado pelo PATCH (100.10)').to.eq(100.1);
          expect(f.technical_fee_value, 'technical_fee_value gravado pelo PATCH (1.500)').to.eq(1.5);
          expect(f.medicine_type_value, 'medicine_type_value gravado pelo PATCH').to.eq(1.25);
          expect(f.weight, 'weight gravado pelo PATCH').to.eq(2.5);
        });
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 55: NÚMERO FRACIONÁRIO EM CAMPO INTEIRO RESPONDE 422 — ISSUE BACKEND#653, PR #664
  // ---------------------------------------------------------------------------
  context('12. Número Fracionário em Campo Inteiro Responde 422, não é Truncado (Issue backend#653/PR #664)', () => {

    // Subissue da #649. O Jackson aceitava `1.5` em campo inteiro do DTO e o truncava para `1`: `multiplier` na criação da fórmula e na prévia do cálculo virava 1 sem aviso, enquanto o PATCH
    // (corpo lido como JsonNode) já recusava. A PR #664 desliga `ACCEPT_FLOAT_AS_INT` para todo corpo de requisição: 422 "O campo <campo> deve ser um número inteiro.", com o caminho completo
    // dentro de lista (`products[0].product_id`). Texto em campo inteiro segue 400 e o PATCH do multiplier segue com a mensagem própria "Multiplicador inválido.".
    // O `2.0` também é recusado (literal com ponto é decimal para o Jackson): só vai pelo texto cru (`requestJsonBruto`), pois `JSON.stringify(2.0)` vira `2`.
    // `qvd` é decimal e aceita `30.5`; `lab_id` e `production_store_id` não são campos de entrada da criação (ignorados, medido 2026-10-16): nenhum dos dois entra aqui.
    // Receita não tem DELETE: tudo que escreve roda numa receita temporária própria (1 por rodada, no tenant dev — mesmo padrão do ctx 7), sem tocar em receita real; a prévia só lê
    // (fórmula real de uma receita pendente, como nos ctx 6 e 11). O 422 vem da desserialização, antes de qualquer service: nada é gravado nem enviado ao provedor.
    // Regressão do link de pagamento (cenário 7 do QA): os `0-A #11.2` a `#11.5` já provam o corpo e o status de antes (PIX recusado, Cielo 502 sem `code`, sem orçamento 422, corpo vazio 400);
    // a leitura ilegível da resposta do provedor (erro de integração em vez de 500) não é alcançável pelo repo.
    const TIMEOUT_ROTA = { timeout: 90000 };
    const msgInteiro = (campo) => `O campo ${campo} deve ser um número inteiro.`;
    const MSG_MULTIPLICADOR = 'Multiplicador inválido.';
    const MSG_MALFORMADO = 'Malformed request body';
    // Mesmo atendimento e operadora PIX do 0-A ctx 11: a recusa vem antes do serviço, então nenhum link é gerado (o `#11.2` já prova que a PIX nunca grava)
    const ATENDIMENTO_LINK = 260800149;
    const CONFIG_PIX = 6;

    let prescricaoId = null;
    let formulaId = null;
    let proximoNumeroFormula = 2;
    let massa = null; // { formula } — fórmula real de receita pendente (QVD e produto), só lida, usada na prévia

    const urlFormulas = () => `/prescriptions/${prescricaoId}/formulas`;
    const formulasDaReceita = () => api.obterDetalhePrescricao(storeId, prescricaoId, TIMEOUT_ROTA).then((det) => (det.body && det.body.formulas) || []);
    const corpoFormula = (extra = {}) => ({
      formula_number: proximoNumeroFormula++, pharmaceutical_form_id: 2, lab_id: 2, qvd: 30, multiplier: 1, ...extra,
    });
    // Criação com o `multiplier` como literal JSON cru (ex.: `2.0`)
    const criarComMultiplicadorBruto = (literal) => api.requestJsonBruto('POST', urlFormulas(),
      `{"formula_number":${proximoNumeroFormula++},"pharmaceutical_form_id":2,"lab_id":2,"qvd":30,"multiplier":${literal}}`, TIMEOUT_ROTA);
    const corpoPrevia = (extra = {}) => {
      const f = massa.formula;
      const p = f.products[0];
      return {
        pharmaceutical_form_id: f.pharmaceutical_form_id,
        qvd: Number(f.qvd),
        multiplier: 1,
        products: [{ product_id: p.product_id || p.id, quantity: p.quantity, unit: p.unit }],
        ...extra,
      };
    };
    const previaComMultiplicadorBruto = (literal) => api.requestJsonBruto('POST', `/prescriptions/formula-calculations`,
      JSON.stringify(corpoPrevia()).replace('"multiplier":1,', `"multiplier":${literal},`), TIMEOUT_ROTA);

    // Percorre as receitas pendentes até achar uma fórmula com QVD e ao menos 1 produto (só leitura)
    const acharFormula = (ids, i) => {
      if (i >= ids.length) return cy.wrap(null, { log: false });
      return api.obterDetalhePrescricao(storeId, ids[i], TIMEOUT_ROTA).then((det) => {
        const formula = ((det.body && det.body.formulas) || []).find((f) => (
          Number(f.qvd) > 0 && f.pharmaceutical_form_id && Array.isArray(f.products) && f.products.length >= 1
        ));
        return formula ? cy.wrap({ formula }, { log: false }) : acharFormula(ids, i + 1);
      });
    };

    before(() => {
      api.listarPrescricoes(storeId, { filter: 'pending', page: 1, per_page: 40 }, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status da listagem de receitas pendentes').to.eq(200);
        const ids = ((res.body && res.body.items) || []).map((r) => r.id).slice(0, 25);
        acharFormula(ids, 0).then((achada) => { massa = achada; });
      });
      // Cliente padrão do env.json (R-POM) como paciente e comprador da receita temporária
      api.buscarClientes(storeId, configEnv.DEFAULT_CLIENT_NAME).then((resCli) => {
        const cliente = (resCli.body && (resCli.body.items || resCli.body))[0];
        expect(cliente && cliente.id, '🔒 DEFAULT_CLIENT_NAME não achou cliente (massa)').to.be.ok;
        api.criarPrescricao(storeId, {
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
          prescricaoId = resPresc.body.id || resPresc.body.prescription_id;
          expect(prescricaoId, 'ID da receita temporária').to.be.ok;
          api.criarFormulaPrescricao(storeId, prescricaoId, corpoFormula({ formula_number: 1 })).then((resFormula) => {
            expect(resFormula.status, 'Status da criação da fórmula temporária').to.be.oneOf([201, 200]);
            formulaId = resFormula.body.id;
            expect(formulaId, 'ID da fórmula temporária').to.be.ok;
          });
        });
      });
    });

    it('12.1 Deve recusar com 422 a criação de fórmula com multiplier fracionário (1.5 e 2.0), sem criar nada, e aceitar o inteiro 2', () => {
      formulasDaReceita().then((antes) => {
        ['1.5', '2.0'].forEach((literal) => {
          criarComMultiplicadorBruto(literal).then((res) => {
            expect(res.status, `Status da criação com multiplier=${literal} (antes da PR #664 criava a fórmula com multiplicador 1)`).to.eq(422);
            expect(res.body.message, `Mensagem da criação com multiplier=${literal}`).to.eq(msgInteiro('multiplier'));
          });
        });
        formulasDaReceita().then((depois) => {
          expect(depois.length, 'nenhuma fórmula pode ter sido criada pelas tentativas recusadas').to.eq(antes.length);
        });
        // Controle: o inteiro 2 segue aceito e é gravado como 2
        criarComMultiplicadorBruto('2').then((res) => {
          expect(res.status, 'Status da criação com multiplier=2').to.eq(201);
          expect(res.body.multiplier, 'multiplier devolvido na criação').to.eq(2);
          formulasDaReceita().then((depois) => {
            const criada = depois.find((f) => f.id === res.body.id);
            expect(criada, 'a fórmula criada aparece na receita').to.exist;
            expect(Number(criada.multiplier), 'multiplier gravado').to.eq(2);
            expect(depois.length, 'só a fórmula do controle foi criada').to.eq(antes.length + 1);
          });
        });
      });
    });

    it('12.2 Deve recusar com 422 na prévia do cálculo o multiplier fracionário (1.5 e 2.0), sem gravar nada', () => {
      expect(massa, '🔒 Nenhuma receita pendente com fórmula de QVD e produto (massa)').to.exist;
      // O multiplier inteiro aceito na prévia (1, 2, 10 e 32767) já está provado no `6.3`
      api.preverCalculoFormula(storeId, corpoPrevia({ multiplier: 1.5 }), TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status da prévia com multiplier=1.5 (antes da PR #664 calculava com multiplicador 1)').to.eq(422);
        expect(res.body.message, 'Mensagem da prévia com multiplier=1.5').to.eq(msgInteiro('multiplier'));
      });
      previaComMultiplicadorBruto('2.0').then((res) => {
        expect(res.status, 'Status da prévia com multiplier=2.0').to.eq(422);
        expect(res.body.message, 'Mensagem da prévia com multiplier=2.0').to.eq(msgInteiro('multiplier'));
      });
    });

    it('12.3 Deve recusar com 422 qualquer campo inteiro fracionário nas rotas da fórmula e do link, citando o nome (e o caminho na lista), sem gravar nada', () => {
      expect(massa, '🔒 Nenhuma receita pendente com fórmula de QVD e produto (massa)').to.exist;
      const produto = massa.formula.products[0];
      const idProduto = Number(produto.product_id || produto.id);
      const casos = [
        ['prévia com stock_store_id', () => api.preverCalculoFormula(storeId, corpoPrevia({ stock_store_id: 4.5 }), TIMEOUT_ROTA), 'stock_store_id'],
        ['prévia com pharmaceutical_form_id', () => api.preverCalculoFormula(storeId, corpoPrevia({ pharmaceutical_form_id: Number(massa.formula.pharmaceutical_form_id) + 0.5 }), TIMEOUT_ROTA), 'pharmaceutical_form_id'],
        ['prévia com product_id dentro da lista', () => api.preverCalculoFormula(storeId, corpoPrevia({ products: [{ product_id: idProduto + 0.5, quantity: produto.quantity, unit: produto.unit }] }), TIMEOUT_ROTA), 'products[0].product_id'],
        ['criação com stock_store_id', () => api.criarFormulaPrescricao(storeId, prescricaoId, corpoFormula({ stock_store_id: 4.5 }), TIMEOUT_ROTA), 'stock_store_id'],
        ['criação com repetition', () => api.criarFormulaPrescricao(storeId, prescricaoId, corpoFormula({ repetition: 1.5 }), TIMEOUT_ROTA), 'repetition'],
        ['criação com pharmaceutical_form_id', () => api.criarFormulaPrescricao(storeId, prescricaoId, corpoFormula({ pharmaceutical_form_id: 2.5 }), TIMEOUT_ROTA), 'pharmaceutical_form_id'],
        ['PATCH com stock_store_id', () => api.atualizarFormulaPrescricao(storeId, prescricaoId, formulaId, { stock_store_id: 4.5 }, TIMEOUT_ROTA), 'stock_store_id'],
        ['PATCH com repetition', () => api.atualizarFormulaPrescricao(storeId, prescricaoId, formulaId, { repetition: 1.5 }, TIMEOUT_ROTA), 'repetition'],
        ['PATCH com pharmaceutical_form_id', () => api.atualizarFormulaPrescricao(storeId, prescricaoId, formulaId, { pharmaceutical_form_id: 2.5 }, TIMEOUT_ROTA), 'pharmaceutical_form_id'],
        ['produto da fórmula com product_id', () => api.adicionarProdutoFormula(storeId, prescricaoId, formulaId, { product_id: idProduto + 0.5, quantity: produto.quantity, unit: produto.unit }, TIMEOUT_ROTA), 'product_id'],
        ['link de pagamento com payment_config_id', () => api.gerarLinkPagamento(storeId, ATENDIMENTO_LINK, { payment_config_id: CONFIG_PIX + 0.5, installments: 1 }, TIMEOUT_ROTA), 'payment_config_id'],
        ['link de pagamento com installments', () => api.gerarLinkPagamento(storeId, ATENDIMENTO_LINK, { payment_config_id: CONFIG_PIX, installments: 1.5 }, TIMEOUT_ROTA), 'installments'],
      ];

      formulasDaReceita().then((antes) => {
        casos.forEach(([rotulo, chamar, campo]) => {
          chamar().then((res) => {
            expect(res.status, `Status de ${rotulo} (antes da PR #664 o valor era truncado)`).to.eq(422);
            expect(res.body.message, `Mensagem de ${rotulo}`).to.eq(msgInteiro(campo));
          });
        });
        formulasDaReceita().then((depois) => {
          expect(depois, 'nenhuma fórmula criada nem alterada pelas tentativas recusadas').to.deep.eq(antes);
        });
        api.listarLinksPagamentoAtendimento(storeId, ATENDIMENTO_LINK, TIMEOUT_ROTA).then((resLinks) => {
          expect(resLinks.status, 'Status da listagem de links').to.eq(200);
          expect(resLinks.body.items, 'nenhum link gerado pelas tentativas recusadas').to.be.an('array').and.have.length(0);
        });
      });
    });

    it('12.4 Deve manter 400 de corpo malformado para texto em campo inteiro, só o número fracionário virou 422', () => {
      expect(massa, '🔒 Nenhuma receita pendente com fórmula de QVD e produto (massa)').to.exist;
      const produto = massa.formula.products[0];
      formulasDaReceita().then((antes) => {
        [
          ['prévia com multiplier "abc"', () => api.preverCalculoFormula(storeId, corpoPrevia({ multiplier: 'abc' }), TIMEOUT_ROTA)],
          ['criação com multiplier "abc"', () => api.criarFormulaPrescricao(storeId, prescricaoId, corpoFormula({ multiplier: 'abc' }), TIMEOUT_ROTA)],
          ['produto da fórmula com product_id "abc"', () => api.adicionarProdutoFormula(storeId, prescricaoId, formulaId, { product_id: 'abc', quantity: produto.quantity, unit: produto.unit }, TIMEOUT_ROTA)],
        ].forEach(([rotulo, chamar]) => {
          chamar().then((res) => {
            expect(res.status, `Status de ${rotulo}`).to.eq(400);
            expect(res.body.message, `Mensagem de ${rotulo}`).to.eq(MSG_MALFORMADO);
          });
        });
        formulasDaReceita().then((depois) => {
          expect(depois, 'nada gravado pelas tentativas malformadas').to.deep.eq(antes);
        });
      });
    });

    it('12.5 Deve manter a mensagem própria "Multiplicador inválido." no PATCH com multiplier 1.5, sem alterar a fórmula', () => {
      formulasDaReceita().then((antes) => {
        api.atualizarFormulaPrescricao(storeId, prescricaoId, formulaId, { multiplier: 1.5 }, TIMEOUT_ROTA).then((res) => {
          expect(res.status, 'Status do PATCH com multiplier=1.5').to.eq(422);
          expect(res.body.message, 'O PATCH tem mensagem própria, diferente da criação e da prévia').to.eq(MSG_MULTIPLICADOR);
        });
        formulasDaReceita().then((depois) => {
          expect(depois.find((f) => f.id === formulaId), 'a fórmula do PATCH não pode ter mudado (nem o updated_at)').to.deep.eq(antes.find((f) => f.id === formulaId));
        });
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 57: TEXTO FORA DO WIN1252 (EMOJI) NA RECEITA E NA FÓRMULA RESPONDE 422, NÃO VIRA "?" (Issue backend#655/PR #701)
  // ---------------------------------------------------------------------------
  context('13. Texto Fora do WIN1252 (Emoji) na Receita e na Fórmula Responde 422, não Vira "?" (Issue backend#655/PR #701)', () => {

    // Subissue da #649. O banco e a conexão do Firebird são WIN1252 (mesmo schema do desktop) e o driver trocava por `?` o que não cabe, sem erro: o texto ficava corrompido.
    // A PR #701 recusa com 422 "O campo <campo> contém caracteres que não podem ser gravados, como emoji." (a mensagem diz "emoji" mesmo para CJK, cirílico, grego etc.), sem gravar:
    //   - receita, no POST e no PATCH: `rg_ie`, `issuing_body`, `issuing_body_uf` e `observation`;
    //   - fórmula, na criação e no PATCH: os 8 campos de texto (`drops`, `cid_code`, `repetition_text`, `label_description`, `posology`, `label_text`, `label_observation`, `formula_observation`).
    // Passam acentos do português e a pontuação do WIN1252 (aspas curvas, travessão, reticências, euro, bullet etc.), além de tabulação e quebra de linha.
    // O dev (19/10/2026) disse que os textos da fórmula ficavam fora desta issue, mas a API real já os recusa (medido em 2026-10-19, ver `ROADMAP.md`): coberto aqui como observado, ver os #13.7 e #13.8.
    // Receita não tem DELETE: tudo roda numa receita temporária própria (1 por rodada, no tenant dev — mesmo padrão dos ctx 7 e 11), sem tocar em receita real. As recusas não mudam nada,
    // então o teste confere que os campos e o `updated_at` continuam idênticos. O POST recusado não tem como provar "nada criado" (sem DELETE nem contagem estável no tenant): prova que não devolve id.
    // Os emojis vão como escape `\u{...}` para o arquivo não depender do editor.
    const TIMEOUT_ROTA = { timeout: 90000 };
    const CAMPOS_RECEITA = ['rg_ie', 'issuing_body', 'issuing_body_uf', 'observation'];
    const CAMPOS_FORMULA = ['drops', 'cid_code', 'repetition_text', 'label_description', 'posology', 'label_text', 'label_observation', 'formula_observation'];
    const EMOJI = '\u{1F600}';
    const TEXTO_PT = 'Teste #655: ação, coração, pílula, ônibus, maçã – “aspas” … € 10,00';
    const msgRecusa = (campo) => `O campo ${campo} contém caracteres que não podem ser gravados, como emoji.`;

    let corpoBase = null;
    let detalheDaCriacao = null;
    let prescricaoId = null;
    let formulaId = null;
    let proximoNumeroFormula = 2;

    const detalhe = () => api.obterDetalhePrescricao(storeId, prescricaoId, TIMEOUT_ROTA).then((det) => {
      expect(det.status, 'Status do detalhe da receita temporária').to.eq(200);
      return det.body;
    });
    const camposDaReceita = (corpo) => CAMPOS_RECEITA.reduce((acc, campo) => ({ ...acc, [campo]: corpo[campo] }), { updated_at: corpo.updated_at });
    const alterar = (corpo) => api.atualizarPrescricao(storeId, prescricaoId, corpo, TIMEOUT_ROTA);
    const exigirRecusa = (res, campo, rotulo) => {
      expect(res.status, `Status de ${rotulo} (antes da PR #701 gravava "?" sem avisar)`).to.eq(422);
      expect(res.body.message, `Mensagem de ${rotulo}`).to.eq(msgRecusa(campo));
    };

    before(() => {
      // Cliente padrão do env.json (R-POM) como paciente e comprador da receita temporária
      api.buscarClientes(storeId, configEnv.DEFAULT_CLIENT_NAME).then((resCli) => {
        const cliente = (resCli.body && (resCli.body.items || resCli.body))[0];
        expect(cliente && cliente.id, '🔒 DEFAULT_CLIENT_NAME não achou cliente (massa)').to.be.ok;
        corpoBase = {
          prescription_type: 'human',
          status: 0,
          sale_type: 1,
          patient_id: cliente.id,
          patient_name: cliente.name,
          buyer_id: cliente.id,
          buyer_name: cliente.name,
          prescriber_id: 18780,
          pickup_store_id: storeId,
        };
        // A receita temporária já nasce com texto do português: o #13.6 prova que o POST grava sem alterar
        api.criarPrescricao(storeId, {
          ...corpoBase, observation: TEXTO_PT, rg_ie: 'MG-12.345.678', issuing_body: 'Seção', issuing_body_uf: 'GO',
        }, TIMEOUT_ROTA).then((resPresc) => {
          expect(resPresc.status, 'Status da criação da receita temporária').to.be.oneOf([200, 201]);
          prescricaoId = resPresc.body.id || resPresc.body.prescription_id;
          expect(prescricaoId, 'ID da receita temporária').to.be.ok;
          // Foto do detalhe logo depois da criação, antes de qualquer PATCH dos outros testes: é o que o #13.6 confere
          detalhe().then((corpo) => { detalheDaCriacao = corpo; });
          api.criarFormulaPrescricao(storeId, prescricaoId, {
            formula_number: 1, pharmaceutical_form_id: 2, lab_id: 2, qvd: 30, multiplier: 1,
          }, TIMEOUT_ROTA).then((resFormula) => {
            expect(resFormula.status, 'Status da criação da fórmula temporária').to.be.oneOf([200, 201]);
            formulaId = resFormula.body.id;
            expect(formulaId, 'ID da fórmula temporária').to.be.ok;
          });
        });
      });
    });

    it('13.1 Deve recusar com 422 a criação de receita com emoji em rg_ie, issuing_body, issuing_body_uf ou observation, sem devolver id', () => {
      const valores = { rg_ie: `MG ${EMOJI}`, issuing_body: `SSP ${EMOJI}`, issuing_body_uf: EMOJI, observation: `${EMOJI} teste 655` };
      CAMPOS_RECEITA.forEach((campo) => {
        api.criarPrescricao(storeId, { ...corpoBase, [campo]: valores[campo] }, TIMEOUT_ROTA).then((res) => {
          exigirRecusa(res, campo, `criação com emoji em ${campo}`);
          expect(res.body.id || res.body.prescription_id, `Receita não pode ser criada com emoji em ${campo}`).to.be.undefined;
        });
      });
    });

    it('13.2 Deve recusar com 422 o PATCH da receita com emoji em cada campo de texto e deixar campos e updated_at como estavam', () => {
      detalhe().then((antes) => {
        const valores = { rg_ie: '✓', issuing_body: '✓', issuing_body_uf: '✓', observation: EMOJI };
        CAMPOS_RECEITA.forEach((campo) => {
          alterar({ [campo]: valores[campo] }).then((res) => exigirRecusa(res, campo, `PATCH com ${campo} fora do WIN1252`));
        });
        detalhe().then((depois) => {
          expect(camposDaReceita(depois), 'Receita idêntica depois das recusas').to.deep.eq(camposDaReceita(antes));
        });
      });
    });

    it('13.3 Deve recusar com 422 qualquer caractere fora do WIN1252 (CJK, cirílico, grego, ı, sequência com ZWJ e controle C1), não só emoji', () => {
      const foraDoWin1252 = ['漢字', 'Жук', 'Ωmega', 'ı', '\u{1F468}‍\u{1F469}‍\u{1F467}', '❤️', 'a\u0081b'];
      detalhe().then((antes) => {
        foraDoWin1252.forEach((texto) => {
          alterar({ observation: texto }).then((res) => exigirRecusa(res, 'observation', `PATCH com observation ${JSON.stringify(texto)}`));
        });
        detalhe().then((depois) => {
          expect(depois.observation, 'Observação intacta depois das recusas').to.eq(antes.observation);
        });
      });
    });

    it('13.4 Deve recusar o PATCH inteiro, sem gravar o campo válido, quando um dos campos enviados tem emoji', () => {
      detalhe().then((antes) => {
        alterar({ observation: 'NAO DEVE GRAVAR', rg_ie: '✓' }).then((res) => {
          exigirRecusa(res, 'rg_ie', 'PATCH com observação válida e rg_ie fora do WIN1252');
        });
        detalhe().then((depois) => {
          expect(camposDaReceita(depois), 'Nenhum campo gravado quando um deles é recusado').to.deep.eq(camposDaReceita(antes));
        });
      });
    });

    it('13.5 Deve aceitar no PATCH da receita acentos do português e a pontuação do WIN1252, devolvendo e gravando o texto idêntico', () => {
      const textos = [
        TEXTO_PT,
        '‘simples’ — • ™ Š œ ž Ÿ ƒ † ‡ ‰',
        'ª º ° ± ¼ ¿ ñ ü ß ÿ ¡ £ ¥ ©',
        'Linha 1\nLinha 2\tcom tabulação',
      ];
      textos.forEach((texto) => {
        alterar({ observation: texto }).then((res) => {
          expect(res.status, `Status do PATCH com ${JSON.stringify(texto)}`).to.eq(200);
          expect(res.body.observation, 'Observação devolvida pelo PATCH').to.eq(texto);
          detalhe().then((det) => {
            expect(det.observation, 'Observação gravada, lida do detalhe').to.eq(texto);
            expect(det.observation, 'Nenhum "?" no lugar de caractere válido').to.not.include('?');
          });
        });
      });
      // Os outros 3 campos de texto da receita aceitam acento
      alterar({ rg_ie: 'ÀÉ-12', issuing_body: 'Seção', issuing_body_uf: 'GO' }).then((res) => {
        expect(res.status, 'Status do PATCH com acento em rg_ie, issuing_body e issuing_body_uf').to.eq(200);
        detalhe().then((det) => {
          expect(det.rg_ie, 'rg_ie com acento').to.eq('ÀÉ-12');
          expect(det.issuing_body, 'issuing_body com acento').to.eq('Seção');
          expect(det.issuing_body_uf, 'issuing_body_uf').to.eq('GO');
        });
      });
    });

    it('13.6 Deve gravar sem alterar, na criação da receita (POST), o texto com acentos e a pontuação do WIN1252 nos 4 campos de texto', () => {
      // `detalheDaCriacao` é o detalhe lido no before, logo depois do POST com texto do português (antes dos PATCH dos outros testes)
      expect(detalheDaCriacao, 'Detalhe lido logo depois da criação').to.be.an('object');
      expect(detalheDaCriacao.observation, 'observation gravada pelo POST').to.eq(TEXTO_PT);
      expect(detalheDaCriacao.rg_ie, 'rg_ie gravado pelo POST').to.eq('MG-12.345.678');
      expect(detalheDaCriacao.issuing_body, 'issuing_body com acento gravado pelo POST').to.eq('Seção');
      expect(detalheDaCriacao.issuing_body_uf, 'issuing_body_uf gravado pelo POST').to.eq('GO');
    });

    it('13.7 Deve recusar com 422 a criação de fórmula com emoji em cada um dos 8 campos de texto, sem criar a fórmula', () => {
      detalhe().then((antes) => {
        CAMPOS_FORMULA.forEach((campo) => {
          api.criarFormulaPrescricao(storeId, prescricaoId, {
            formula_number: proximoNumeroFormula++, pharmaceutical_form_id: 2, lab_id: 2, qvd: 30, multiplier: 1, [campo]: EMOJI,
          }, TIMEOUT_ROTA).then((res) => exigirRecusa(res, campo, `criação de fórmula com emoji em ${campo}`));
        });
        detalhe().then((depois) => {
          expect(depois.formulas.length, 'Nenhuma fórmula criada pelas recusas').to.eq(antes.formulas.length);
        });
      });
    });

    it('13.8 Deve recusar com 422 o PATCH da fórmula com emoji em cada campo de texto, preservar o valor e aceitar texto com acento', () => {
      const textosDaFormula = (corpo) => {
        const formula = corpo.formulas.find((f) => f.id === formulaId);
        expect(formula, 'Fórmula temporária no detalhe').to.be.ok;
        return CAMPOS_FORMULA.reduce((acc, campo) => ({ ...acc, [campo]: formula[campo] }), {});
      };
      detalhe().then((antes) => {
        CAMPOS_FORMULA.forEach((campo) => {
          api.atualizarFormulaPrescricao(storeId, prescricaoId, formulaId, { [campo]: EMOJI }, TIMEOUT_ROTA).then((res) => {
            exigirRecusa(res, campo, `PATCH da fórmula com emoji em ${campo}`);
          });
        });
        detalhe().then((depois) => {
          expect(textosDaFormula(depois), 'Textos da fórmula idênticos depois das recusas').to.deep.eq(textosDaFormula(antes));
        });
      });
      const posologia = 'Tomar ação ç ã é “x” – €';
      api.atualizarFormulaPrescricao(storeId, prescricaoId, formulaId, { posology: posologia }, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status do PATCH da fórmula com acento e pontuação do WIN1252').to.eq(200);
        expect(res.body.posology, 'Posologia devolvida pelo PATCH').to.eq(posologia);
        detalhe().then((det) => {
          expect(textosDaFormula(det).posology, 'Posologia gravada, lida do detalhe').to.eq(posologia);
        });
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 58: AUTORIZAÇÃO DE INSUMOS CONTROLADOS NA RECEITA (Issue backend#227, PRs #708, #709 e #710)
  // ---------------------------------------------------------------------------
  // Rotas novas SEM o prefixo /stores/:id (a loja vem do token, backend#677). O contexto monta a própria receita (receita não tem DELETE:
  // 2 por rodada, uma com os insumos e uma vazia) e nunca grava na receita de outra pessoa. Os testes dependem da ordem: as recusas
  // vêm antes da autorização, que vem antes da barreira liberada e da reautorização.
  context('14. Autorização de Insumos Controlados na Receita: Leitura, Recusas, Autorização Transacional e Barreira na Finalização (Issue backend#227/PR #708, #709 e #710)', () => {
    const PRESCRITOR_ID = 18780; // o mesmo dos demais contexts de receita (conselho CRM completo)
    const TIPO_DOCUMENTO_ID = 2;
    const COMPRADOR_GENERICO = 9999999;
    const PRODUTO_CODIGO_3 = 1002096; // PURO CLONAZEPAM, PORTARIA 344 (LISTA B1): exige data e número do receituário
    const PRODUTO_CODIGO_1 = 1000842; // FOSFATO DE CODEINA, LISTA A2: exige só a data
    const PRODUTO_CODIGO_0 = 1001889; // BUPROPIONA, LISTA C1: não exige nada
    const PRODUTO_SEM_PORTARIA = 1004866; // o mesmo do ctx 3 (0-C) e do ctx 15 (0-A)
    const MSG_BARREIRA = 'Autorize os insumos controlados antes de finalizar a receita.';

    let prescricaoId;
    let prescricaoSemControladoId;
    let clienteId;
    let podeAutorizar;
    let carimboAutorizacao;

    const dataRelativa = (dias) => {
      const d = new Date();
      d.setDate(d.getDate() + dias);
      return d.toISOString().slice(0, 10);
    };

    // Preenche o que a portaria do item exige; o resto é opcional
    const preencherItem = (item, extra = {}) => {
      const codigo = item.ordinance.requirement_code;
      const base = { formula_number: item.formula_number, line_number: item.line_number, cid: 'F41.1', long_term_use: false };
      if (codigo === 3) return { ...base, prescription_date: dataRelativa(-1), notification_number: '123456', ...extra };
      if (codigo === 1) return { ...base, prescription_date: dataRelativa(-1), ...extra };
      return { ...base, ...extra };
    };

    const corpo = (items, sobrescritas = {}, extras = {}) => ({
      buyer_id: clienteId,
      document_type_id: TIPO_DOCUMENTO_ID,
      rg_ie: '1234567',
      issuing_body: 'SSP',
      issuing_body_uf: 'GO',
      prescriber_id: PRESCRITOR_ID,
      items: items.map((i, k) => preencherItem(i, extras[k])),
      ...sobrescritas,
    });

    const indicePorCodigo = (items, codigo) => items.findIndex((i) => i.ordinance.requirement_code === codigo);
    const lerItens = () => api.obterItensControladosReceita(prescricaoId).then((res) => {
      expect(res.status, 'Status da leitura dos itens controlados').to.eq(200);
      return res.body;
    });
    // A recusa não pode ter gravado nada: a receita segue sem autorização
    const confirmarNaoAutorizada = () => lerItens().then((body) => {
      expect(body.authorization.authorized, 'Recusa não grava a autorização').to.eq(false);
    });

    before(() => {
      api.buscarClientes(storeId, configEnv.DEFAULT_CLIENT_NAME).then((resCli) => {
        const cliente = resCli.body?.items?.[0] || resCli.body?.[0];
        clienteId = cliente?.id;
        expect(clienteId, '🔒 DEFAULT_CLIENT_NAME não achou cliente (massa)').to.be.ok;
        const nome = cliente.name;
        const novaReceita = () => api.criarPrescricao(storeId, {
          prescription_type: 'human',
          status: 0,
          sale_type: 1,
          patient_id: clienteId,
          patient_name: nome,
          buyer_id: clienteId,
          buyer_name: nome,
          prescriber_id: PRESCRITOR_ID,
          pickup_store_id: storeId,
        }).then((res) => {
          expect(res.status, 'Status da criação da receita de teste').to.eq(201);
          return res.body.id;
        });
        const novaFormula = (id, numero, productId, unit, calcular) => api.criarFormulaPrescricao(storeId, id, {
          formula_number: numero, pharmaceutical_form_id: 2, lab_id: 2, qvd: 30.0, multiplier: 1,
        }).then((resF) => {
          expect(resF.status, `Status da criação da fórmula ${numero}`).to.eq(201);
          return api.adicionarProdutoFormula(storeId, id, resF.body.id, { product_id: productId, quantity: 1, unit }).then((resA) => {
            expect(resA.status, `Status do produto ${productId} na fórmula ${numero}`).to.be.oneOf([200, 201]);
            if (calcular) {
              return api.calcularFormula(storeId, id, resF.body.id).then((resC) => {
                expect(resC.status, `Status do cálculo da fórmula ${numero}`).to.eq(200);
              });
            }
            return undefined;
          });
        });

        novaReceita().then((id) => {
          prescricaoId = id;
          // 3 controladas calculadas (códigos 3, 1 e 0), 1 sem portaria calculada e 1 controlada que fica sem cálculo
          novaFormula(id, 1, PRODUTO_CODIGO_3, 'g', true);
          novaFormula(id, 2, PRODUTO_CODIGO_1, 'g', true);
          novaFormula(id, 3, PRODUTO_CODIGO_0, 'g', true);
          novaFormula(id, 4, PRODUTO_SEM_PORTARIA, 'mg', true);
          novaFormula(id, 5, PRODUTO_CODIGO_3, 'g', false);
        });
        novaReceita().then((id) => { prescricaoSemControladoId = id; });
      });
    });

    it('14.1 deve listar na leitura só os insumos controlados de fórmula calculada, com a portaria, os conselhos aceitos e o que falta em cada um', () => {
      lerItens().then(({ prescription, authorization, items, capabilities }) => {
        // Cabeçalho: comprador, documento ainda não informado e prescritor com conselho
        expect(prescription.id, 'Receita lida').to.eq(prescricaoId);
        expect(prescription.status_mov, 'Receita em rascunho').to.eq(0);
        expect(prescription.buyer.id, 'Comprador da receita').to.eq(clienteId);
        expect(prescription.document.complete, 'Documento do paciente ainda não informado').to.eq(false);
        expect(prescription.prescriber).to.include({ id: PRESCRITOR_ID, complete: true });
        expect(prescription.prescriber.council, 'Conselho lido do cadastro do prescritor').to.be.a('string').and.not.be.empty;
        expect(authorization, 'Receita ainda não autorizada').to.deep.include({ authorized: false, store_id: null, employee_id: null });

        // Itens: só os 3 controlados de fórmula calculada; o sem portaria e o da fórmula sem cálculo ficam fora
        expect(items.map((i) => i.product_id).sort(), 'Itens aplicáveis').to.deep.eq([PRODUTO_CODIGO_0, PRODUTO_CODIGO_1, PRODUTO_CODIGO_3].sort());

        const esperado = {
          [PRODUTO_CODIGO_3]: { codigo: 3, data: true, numero: true, falta: ['prescription_date', 'notification_number'] },
          [PRODUTO_CODIGO_1]: { codigo: 1, data: true, numero: false, falta: ['prescription_date'] },
          [PRODUTO_CODIGO_0]: { codigo: 0, data: false, numero: false, falta: [] },
        };
        items.forEach((item) => {
          const e = esperado[item.product_id];
          expect(item.ordinance.requirement_code, `Código de exigência do produto ${item.product_id}`).to.eq(e.codigo);
          expect(item.ordinance.prescription_date_required, `Data exigida do produto ${item.product_id}`).to.eq(e.data);
          expect(item.ordinance.notification_number_required, `Número exigido do produto ${item.product_id}`).to.eq(e.numero);
          expect(item.missing, `O que falta no produto ${item.product_id}`).to.deep.eq(e.falta);
          expect(item.ordinance.accepted_councils, `Conselhos aceitos pela portaria do produto ${item.product_id}`).to.be.an('array').and.include(prescription.prescriber.council);
          expect(item.ordinance.name, 'Nome da portaria').to.be.a('string').and.not.be.empty;
          expect(item.ordinance.prescription_validity_days, 'Validade da portaria em dias').to.be.a('number');
          expect(item, 'Dados do receituário ainda vazios').to.include({ prescription_date: null, notification_number: null, prescription_checked: false });
        });

        expect(capabilities.can_authorize_controlled_ingredient_sale, 'Capability do grant 583').to.be.a('boolean');
        expect(capabilities.can_edit_return_date, 'Capability do grant 449').to.be.a('boolean');
        podeAutorizar = capabilities.can_authorize_controlled_ingredient_sale;
      });
    });

    it('14.2 deve recusar a leitura sem token (401), de receita inexistente (404) e com identificador inválido (422 INVALID_CONTEXT)', () => {
      api.obterItensControladosReceita(prescricaoId, { headers: { Authorization: '' } }).then((res) => {
        expect(res.status, 'Status sem token').to.eq(401);
      });
      api.obterItensControladosReceita(999999999).then((res) => {
        expect(res.status, 'Status de receita inexistente').to.eq(404);
        expect(res.body.message, 'Mensagem de receita inexistente').to.eq('Receita não encontrada.');
      });
      api.obterItensControladosReceita(0).then((res) => {
        expect(res.status, 'Status do identificador 0').to.eq(422);
        expect(res.body.code, 'Código do erro de contexto').to.eq('INVALID_CONTEXT');
      });
    });

    it('14.3 deve recusar com 422 a autorização que não traz o que a portaria exige no item (data no código 1 e 3, número no código 3 e nunca "0")', () => {
      lerItens().then(({ items }) => {
        const i3 = indicePorCodigo(items, 3);
        const i1 = indicePorCodigo(items, 1);
        const recusa = (extras, regex, rotulo) => api.autorizarControladosReceita(prescricaoId, corpo(items, {}, extras)).then((res) => {
          expect(res.status, rotulo).to.eq(422);
          expect(res.body.message, `Mensagem: ${rotulo}`).to.match(regex);
        });
        recusa({ [i3]: { notification_number: '0' } }, new RegExp(`^Informe o número do receituário/notificação do produto ${PRODUTO_CODIGO_3} `), 'número "0" no código 3');
        recusa({ [i3]: { notification_number: '' } }, new RegExp(`^Informe o número do receituário/notificação do produto ${PRODUTO_CODIGO_3} `), 'número vazio no código 3');
        recusa({ [i3]: { prescription_date: undefined } }, new RegExp(`^Informe a data da prescrição do produto ${PRODUTO_CODIGO_3} `), 'data ausente no código 3');
        recusa({ [i1]: { prescription_date: undefined } }, new RegExp(`^Informe a data da prescrição do produto ${PRODUTO_CODIGO_1} `), 'data ausente no código 1');
      });
      confirmarNaoAutorizada();
    });

    it('14.4 deve recusar com 422 comprador genérico, documento incompleto, tipo de documento inexistente, prescritor genérico e órgão expedidor acima de 10 caracteres', () => {
      lerItens().then(({ items }) => {
        const recusa = (sobrescritas, mensagem, rotulo) => api.autorizarControladosReceita(prescricaoId, corpo(items, sobrescritas)).then((res) => {
          expect(res.status, rotulo).to.eq(422);
          expect(res.body.message, `Mensagem: ${rotulo}`).to.eq(mensagem);
        });
        const MSG_DOCUMENTO = 'Informe tipo de documento, número, órgão expedidor e UF do paciente.';
        recusa({ buyer_id: COMPRADOR_GENERICO }, 'Selecione o comprador da receita: o cliente genérico não pode ser usado em insumo controlado.', 'comprador genérico');
        recusa({ prescriber_id: COMPRADOR_GENERICO }, 'Selecione o prescritor da receita: o prescritor genérico não pode ser usado em insumo controlado.', 'prescritor genérico');
        recusa({ document_type_id: 999999 }, 'Tipo de documento não encontrado.', 'tipo de documento inexistente');
        recusa({ rg_ie: '' }, MSG_DOCUMENTO, 'número do documento vazio');
        recusa({ issuing_body_uf: 'GOO' }, MSG_DOCUMENTO, 'UF com 3 letras');
        recusa({ issuing_body: 'ABCDEFGHIJK' }, 'O campo issuing_body deve ter no máximo 10 caracteres.', 'órgão expedidor com 11 caracteres');
      });
      confirmarNaoAutorizada();
    });

    it('14.5 deve exigir todos os insumos controlados da receita, recusar item repetido, sem token (401) e receita inexistente (404)', () => {
      lerItens().then(({ items }) => {
        const faltou = items[items.length - 1];
        api.autorizarControladosReceita(prescricaoId, corpo(items.slice(0, -1))).then((res) => {
          expect(res.status, 'Status com um insumo a menos').to.eq(422);
          expect(res.body.message, 'Mensagem com o insumo que faltou').to.eq(`Informe todos os insumos controlados da receita. Faltam: ${faltou.formula_number}/${faltou.line_number}.`);
        });
        // Um par que não é da receita no lugar do último não é apontado por si: a recusa é a de insumo faltando (a spec previa mensagem própria)
        const alheio = { formula_number: 99, line_number: 99, prescription_date: dataRelativa(-1), notification_number: '1' };
        api.autorizarControladosReceita(prescricaoId, { ...corpo(items.slice(0, -1)), items: [...corpo(items.slice(0, -1)).items, alheio] }).then((res) => {
          expect(res.status, 'Status com item que não é da receita').to.eq(422);
          expect(res.body.message, 'Mensagem de insumo faltando').to.match(/^Informe todos os insumos controlados da receita\. Faltam: /);
        });
        api.autorizarControladosReceita(prescricaoId, corpo([...items, items[0]])).then((res) => {
          expect(res.status, 'Status com item repetido').to.eq(422);
          expect(res.body.message, 'Mensagem de duplicidade').to.eq('Item controlado informado em duplicidade.');
        });
        api.autorizarControladosReceita(prescricaoId, corpo([])).then((res) => {
          expect(res.status, 'Status sem itens').to.eq(422);
          expect(res.body.message, 'Mensagem sem itens').to.eq('Informe os itens controlados a autorizar.');
        });
        api.autorizarControladosReceita(prescricaoId, corpo(items), { headers: { Authorization: '' } }).then((res) => {
          expect(res.status, 'Status sem token').to.eq(401);
        });
        api.autorizarControladosReceita(999999999, corpo(items)).then((res) => {
          expect(res.status, 'Status de receita inexistente').to.eq(404);
          expect(res.body.message, 'Mensagem de receita inexistente').to.eq('Receita não encontrada.');
        });
      });
      confirmarNaoAutorizada();
    });

    it('14.6 deve responder a leitura com lista vazia e recusar com 422 a autorização de receita sem insumo controlado', () => {
      api.obterItensControladosReceita(prescricaoSemControladoId).then((res) => {
        expect(res.status, 'Status da leitura sem controlado').to.eq(200);
        expect(res.body.items, 'Receita sem controlado não tem itens').to.deep.eq([]);
        expect(res.body.authorization.authorized, 'Receita sem controlado não está autorizada').to.eq(false);
      });
      const item = { formula_number: 1, line_number: 1, prescription_date: dataRelativa(-1), notification_number: '1' };
      api.autorizarControladosReceita(prescricaoSemControladoId, { ...corpo([]), items: [item] }).then((res) => {
        expect(res.status, 'Status da autorização sem controlado').to.eq(422);
        expect(res.body.message, 'Mensagem sem insumo controlado').to.eq('Esta receita não possui insumo controlado a autorizar.');
      });
    });

    it('14.7 deve barrar com 422 a finalização de receita com insumo controlado sem autorização, antes de qualquer outra validação', () => {
      // A fórmula 5 segue sem cálculo, e a barreira vem antes da checagem de fórmulas calculadas
      api.finalizarPrescricao(storeId, prescricaoId).then((res) => {
        expect(res.status, 'Status da finalização sem autorização').to.eq(422);
        expect(res.body.message, 'Mensagem da barreira').to.eq(MSG_BARREIRA);
      });
      confirmarNaoAutorizada();
    });

    it('14.8 deve autorizar numa única operação, gravando documento e dados de cada insumo e estampando o autorizador (operador com o grant 583, sem ticket)', () => {
      expect(podeAutorizar, 'A conta de teste precisa do grant 583 (capability da leitura 58.1)').to.eq(true);
      lerItens().then(({ items }) => {
        const extras = items.map((_, k) => ({ long_term_use: k === 0, cid: `F4${k}.1` }));
        api.autorizarControladosReceita(prescricaoId, corpo(items, {}, extras)).then((res) => {
          expect(res.status, 'Status da autorização').to.eq(200);
          expect(res.body.id, 'Devolve a receita completa').to.eq(prescricaoId);
          expect(res.body.warnings, 'Avisos como lista').to.be.an('array');
          const ca = res.body.controlled_authorization;
          expect(ca, 'Bloco da autorização').to.deep.include({ authorized: true, store_id: storeId, employee_id: loggedUserId, items_count: items.length });
          expect(ca.at, 'Carimbo em UTC (Instant/Z)').to.match(/Z$/);
          carimboAutorizacao = ca.at;
          expect(res.body, 'Documento gravado no cabeçalho').to.deep.include({ document_type_id: TIPO_DOCUMENTO_ID, rg_ie: '1234567', issuing_body: 'SSP', issuing_body_uf: 'GO' });
        });
        lerItens().then((body) => {
          expect(body.authorization, 'Leitura passa a mostrar a autorização').to.deep.include({ authorized: true, store_id: storeId, employee_id: loggedUserId });
          expect(body.prescription.document.complete, 'Documento completo').to.eq(true);
          expect(body.items, 'Mesmos itens depois de autorizar').to.have.length(items.length);
          body.items.forEach((item, k) => {
            const enviado = preencherItem(items[k], extras[k]);
            expect(item.missing, `Nada falta no produto ${item.product_id}`).to.deep.eq([]);
            expect(item.prescription_date, `Data gravada do produto ${item.product_id}`).to.eq(enviado.prescription_date || null);
            expect(item.notification_number, `Número gravado do produto ${item.product_id}`).to.eq(enviado.notification_number || null);
            expect(item.cid, `CID gravado do produto ${item.product_id}`).to.eq(enviado.cid);
            expect(item.long_term_use, `Uso prolongado gravado do produto ${item.product_id}`).to.eq(enviado.long_term_use);
          });
        });
      });
    });

    it('14.9 deve deixar de barrar a finalização depois de autorizar, passando para a próxima validação (fórmula sem cálculo)', () => {
      api.finalizarPrescricao(storeId, prescricaoId).then((res) => {
        expect(res.status, 'Status da finalização com a fórmula 5 sem cálculo').to.eq(422);
        expect(res.body.message, 'Já não é a mensagem da barreira').to.not.eq(MSG_BARREIRA);
        expect(res.body.message, 'A próxima validação da finalização').to.eq('Todas as fórmulas devem estar calculadas antes de finalizar a receita.');
      });
    });

    it('14.10 deve reautorizar a receita já autorizada, re-estampando o carimbo e devolvendo avisos (vencida, data futura e retorno que não é posterior ao aviamento) sem recusar', () => {
      lerItens().then(({ items }) => {
        const i3 = indicePorCodigo(items, 3);
        const i1 = indicePorCodigo(items, 1);
        const i0 = indicePorCodigo(items, 0);
        const extras = {
          [i3]: { prescription_date: dataRelativa(-40) },
          [i1]: { prescription_date: dataRelativa(365) },
          [i0]: { return_date: dataRelativa(-30) },
        };
        api.autorizarControladosReceita(prescricaoId, corpo(items, {}, extras)).then((res) => {
          expect(res.status, 'Avisos não bloqueiam').to.eq(200);
          const avisos = res.body.warnings;
          expect(avisos.find((a) => a.includes(String(PRODUTO_CODIGO_3))), 'Aviso de prescrição vencida').to.match(/está vencida: prescrita em \d{2}\/\d{2}\/\d{4}, validade de \d+ dias\.$/);
          expect(avisos.find((a) => a.includes(String(PRODUTO_CODIGO_1))), 'Aviso de data futura').to.match(/tem data futura: \d{2}\/\d{2}\/\d{4}\.$/);
          expect(avisos.find((a) => a.includes(String(PRODUTO_CODIGO_0))), 'Aviso de retorno').to.match(/em \d{2}\/\d{2}\/\d{4} não é posterior ao aviamento\.$/);
          expect(res.body.controlled_authorization.employee_id, 'Reautorização estampa o autorizador de novo').to.eq(loggedUserId);
          expect(new Date(res.body.controlled_authorization.at).getTime(), 'Carimbo re-estampado').to.be.at.least(new Date(carimboAutorizacao).getTime());
        });
        // Os avisos não limpam o campo: a data vencida e a futura ficam gravadas como enviadas
        lerItens().then((body) => {
          expect(body.items[i3].prescription_date, 'Data vencida gravada').to.eq(extras[i3].prescription_date);
          expect(body.items[i1].prescription_date, 'Data futura gravada').to.eq(extras[i1].prescription_date);
        });
      });
    });

    it('14.11 deve gravar na linha e devolver na leitura a data de retorno enviada na autorização (com o grant 449; a matriz da permissão está no #58.14)', () => {
      lerItens().then(({ items, capabilities }) => {
        expect(capabilities.can_edit_return_date, '🔒 a conta precisa da 449 para gravar a data de retorno (massa; os ramos sem o grant ficam no #14.14)').to.eq(true);
        const i0 = indicePorCodigo(items, 0);
        const retorno = dataRelativa(30);
        api.autorizarControladosReceita(prescricaoId, corpo(items, {}, { [i0]: { return_date: retorno } })).then((res) => {
          expect(res.status, 'Autorização com a data de retorno').to.eq(200);
          lerItens().then((body) => {
            expect(body.items[i0].return_date, 'Data de retorno gravada e servida pela leitura').to.eq(retorno);
          });
        });
      });
    });

    // Issue backend#711/PR #727 (fallback da fórmula na leitura) — cenários 6 e 3 (só a parte que a conta com a 449 alcança; sem a 449 fica no P1-47)
    const formulasGravadas = () => api.obterDetalhePrescricao(storeId, prescricaoId).then((res) => {
      expect(res.status, 'Status do detalhe da receita').to.eq(200);
      return res.body.formulas.map((f) => ({ id: f.id, formula_number: f.formula_number, return_date: f.return_date, cid_code: f.cid_code }));
    });
    // Reenvia exatamente o que a leitura serviu para o item (só o que veio preenchido), sem o `cid`/datas padrão de `preencherItem`
    const servidoPeloGet = (item) => Object.fromEntries(
      ['prescription_date', 'notification_number', 'return_date', 'cid', 'long_term_use'].filter((c) => item[c] !== null && item[c] !== undefined).map((c) => [c, item[c]])
    );

    it('14.12 deve servir na leitura a data e o CID da linha quando ela tem valor próprio diferente do da fórmula (cenário 6 da backend#711)', () => {
      const retornoLinha = dataRelativa(30);
      const retornoFormula = dataRelativa(60);
      const cidLinha = 'F41.1';
      const cidFormula = 'G40.9';
      lerItens().then(({ items, capabilities }) => {
        expect(capabilities.can_edit_return_date, '🔒 a conta precisa da 449 para gravar a data de retorno na linha (massa)').to.eq(true);
        const i0 = indicePorCodigo(items, 0);
        // Arrange 1: a linha ganha valor próprio (data e CID) pela autorização
        api.autorizarControladosReceita(prescricaoId, corpo(items, {}, { [i0]: { return_date: retornoLinha, cid: cidLinha } })).then((res) => {
          expect(res.status, 'Autorização que grava a data e o CID na linha').to.eq(200);
          // Arrange 2: a fórmula da mesma linha ganha outra data e outro CID
          formulasGravadas().then((formulas) => {
            const formula = formulas.find((f) => f.formula_number === items[i0].formula_number);
            expect(formula, '🔒 Fórmula da linha de código 0 no detalhe (massa)').to.exist;
            api.atualizarFormulaPrescricao(storeId, prescricaoId, formula.id, { return_date: retornoFormula, cid_code: cidFormula }).then((resP) => {
              expect(resP.status, 'PATCH da fórmula com data e CID diferentes dos da linha').to.eq(200);
              // Assert: a leitura serve o valor da linha, não o da fórmula
              lerItens().then(({ items: depois }) => {
                expect(depois[i0].return_date, 'Data de retorno servida é a da linha').to.eq(retornoLinha);
                expect(depois[i0].cid, 'CID servido é o da linha').to.eq(cidLinha);
              });
              formulasGravadas().then((f2) => {
                const f = f2.find((x) => x.id === formula.id);
                expect(f.return_date, 'A fórmula continua com a data própria').to.eq(retornoFormula);
                expect(f.cid_code, 'A fórmula continua com o CID próprio').to.eq(cidFormula);
              });
            });
          });
        });
      });
    });

    it('14.13 deve aceitar o reenvio exato do que a leitura serviu, sem alterar a fórmula nem o que a leitura mostra (cenário 3 da backend#711, parte alcançável com a 449)', () => {
      lerItens().then((antes) => {
        formulasGravadas().then((formulasAntes) => {
          const extras = Object.fromEntries(antes.items.map((item, k) => [k, servidoPeloGet(item)]));
          api.autorizarControladosReceita(prescricaoId, corpo(antes.items, {}, extras)).then((res) => {
            expect(res.status, 'Reenviar o que a leitura serviu autoriza normalmente').to.eq(200);
            expect(res.body.controlled_authorization.employee_id, 'Carimbo do operador').to.eq(loggedUserId);
            formulasGravadas().then((formulasDepois) => {
              expect(formulasDepois, 'Nenhuma fórmula mudou (data de retorno e CID)').to.deep.eq(formulasAntes);
            });
            lerItens().then((depois) => {
              const semCarimbo = (body) => body.items.map((i) => ({ ...i }));
              expect(semCarimbo(depois), 'A leitura mostra os mesmos itens de antes').to.deep.eq(semCarimbo(antes));
            });
          });
        });
      });
    });

    // Issue backend#711/PR #727 e #732 — permissão 449 (`can_edit_return_date`, vem em `capabilities` da leitura dos itens controlados) nos cenários 3 a 5 da issue.
    // Validação só de backend (decisão do operador, 2026-10-20): o front não mostra, não edita nem autoriza a data de retorno (ROADMAP P1-48), então não há grau UI.
    // Padrão [R-CAPXACAO]: a capability real da conta decide o ramo — com o grant os cenários 4 e 5 respondem 200 e gravam; sem o grant respondem 403 e não gravam.
    // Hoje a conta tem a 449: os ramos 403 ficam dormentes até o dev revogar o grant da conta de teste ou fornecer outra conta. Receita própria, porque a do ctx já
    // tem data na linha depois do #14.11/#14.12 e o cenário 3 precisa de linha sem data própria.
    it('14.14 deve exigir a permissão 449 só para mudar ou apagar a data de retorno na autorização, nunca para reenviar a data que a leitura serviu (cenários 3 a 5 da backend#711, ramificado por can_edit_return_date)', () => {
      const RETORNO_FORMULA = dataRelativa(30);
      const OUTRA_DATA = dataRelativa(60);
      let receitaId; let formulaId; let temGrant;
      const lerItensDaReceita = () => api.obterItensControladosReceita(receitaId).then((res) => {
        expect(res.status, 'Status da leitura dos itens controlados').to.eq(200);
        return res.body;
      });
      const corpoDaReceita = (items, porIndice = {}) => ({
        buyer_id: clienteId, document_type_id: TIPO_DOCUMENTO_ID, rg_ie: '1234567', issuing_body: 'SSP', issuing_body_uf: 'GO', prescriber_id: PRESCRITOR_ID,
        items: items.map((item, k) => ({ formula_number: item.formula_number, line_number: item.line_number, cid: 'F41.1', long_term_use: false, ...(porIndice[k] || {}) })),
      });
      const autorizarReceita = (items, porIndice) => api.autorizarControladosReceita(receitaId, corpoDaReceita(items, porIndice));
      const retornoDaFormula = () => api.obterDetalhePrescricao(storeId, receitaId).then((res) => res.body.formulas.find((f) => f.id === formulaId).return_date);

      // Arrange: receita própria com a BUPROPIONA (código 0, não exige nada no item) calculada; a fórmula ganha data de retorno, que a leitura passa a servir
      api.buscarClientes(storeId, configEnv.DEFAULT_CLIENT_NAME).then((resCli) => {
        const cliente = resCli.body?.items?.[0] || resCli.body?.[0];
        expect(cliente && cliente.id, '🔒 DEFAULT_CLIENT_NAME não achou cliente (massa)').to.be.ok;
        api.criarPrescricao(storeId, {
          prescription_type: 'human', status: 0, sale_type: 1, patient_id: cliente.id, patient_name: cliente.name,
          buyer_id: cliente.id, buyer_name: cliente.name, prescriber_id: PRESCRITOR_ID, pickup_store_id: storeId,
        }).then((resPresc) => {
          expect(resPresc.status, 'Status da criação da receita própria').to.eq(201);
          receitaId = resPresc.body.id;
          api.criarFormulaPrescricao(storeId, receitaId, { formula_number: 1, pharmaceutical_form_id: 2, lab_id: 2, qvd: 30.0, multiplier: 1 }).then((resF) => {
            expect(resF.status, 'Status da criação da fórmula').to.eq(201);
            formulaId = resF.body.id;
            api.adicionarProdutoFormula(storeId, receitaId, formulaId, { product_id: PRODUTO_CODIGO_0, quantity: 1, unit: 'g' }).then((resA) => {
              expect(resA.status, 'Status do produto na fórmula').to.be.oneOf([200, 201]);
              api.calcularFormula(storeId, receitaId, formulaId).then((resC) => expect(resC.status, 'Status do cálculo').to.eq(200));
              api.atualizarFormulaPrescricao(storeId, receitaId, formulaId, { return_date: RETORNO_FORMULA }).then((resP) => expect(resP.status, 'Data de retorno gravada na fórmula').to.eq(200));
            });
          });
        });
      }).then(() => lerItensDaReceita()).then(({ items, capabilities }) => {
        temGrant = capabilities.can_edit_return_date;
        expect(temGrant, 'can_edit_return_date é booleana').to.be.a('boolean');
        expect(items, '🔒 1 item controlado (BUPROPIONA) na leitura').to.have.length(1);
        expect(items[0].return_date, 'A leitura serve a data da fórmula (linha sem data própria)').to.eq(RETORNO_FORMULA);

        // Cenário 3: reenviar exatamente o que a leitura serviu nunca pede a 449 e não altera a fórmula
        autorizarReceita(items, { 0: { return_date: items[0].return_date } }).then((res) => {
          expect(res.status, `Reenviar a data servida com can_edit_return_date: ${temGrant}`).to.eq(200);
          retornoDaFormula().then((r) => expect(r, 'A fórmula continua com a mesma data').to.eq(RETORNO_FORMULA));
        });

        // Cenário 4: outra data de retorno é alteração — só com a 449
        autorizarReceita(items, { 0: { return_date: OUTRA_DATA } }).then((res) => {
          if (temGrant) {
            expect(res.status, 'Outra data com o grant 449').to.eq(200);
            lerItensDaReceita().then((b) => expect(b.items[0].return_date, 'Data nova gravada na linha').to.eq(OUTRA_DATA));
          } else {
            expect(res.status, 'Outra data sem o grant 449').to.eq(403);
            lerItensDaReceita().then((b) => expect(b.items[0].return_date, 'Recusa não grava: a leitura segue com a data servida').to.eq(RETORNO_FORMULA));
          }
        });

        // Cenário 5: apagar a data que a leitura mostrou também é alteração — só com a 449 (e, com ela, apaga a data da fórmula: comportamento esperado, backend 2026-10-20)
        lerItensDaReceita().then(({ items: antes }) => {
          autorizarReceita(antes, { 0: { return_date: null } }).then((res) => {
            if (temGrant) {
              expect(res.status, 'Apagar a data com o grant 449').to.eq(200);
              retornoDaFormula().then((r) => expect(r, 'Com a 449, apagar a data da linha apaga a da fórmula').to.eq(null));
            } else {
              expect(res.status, 'Apagar a data sem o grant 449').to.eq(403);
              retornoDaFormula().then((r) => expect(r, 'Recusa não toca a fórmula').to.eq(RETORNO_FORMULA));
            }
          });
        });
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 59: PATCH DA RECEITA EXIGE AS PARTES DA CRIAÇÃO E NÃO MUDA O TIPO (Issue backend#656/PR #700)
  // ---------------------------------------------------------------------------
  context('15. PATCH da Receita Exige as Mesmas Partes da Criação e não Muda o Tipo (Issue backend#656/PR #700)', () => {

    // Subissue da #649. O PATCH aceitava `patient_id: null` e apagava o paciente de receita humana, enquanto o POST exige. A PR #700 faz o PATCH exigir as mesmas partes:
    //   - receita humana: `patient_id: null` → 422 "Paciente obrigatório para receita humana.";
    //   - receita animal: `buyer_id: null` → 422 "Comprador obrigatório para receita animal.".
    // O tipo não tem coluna própria (vem do `CODIGO_ANIMAL`), então o PATCH também não troca o tipo: `animal_id` informado em receita humana ou nulo em receita animal → 422 "Tipo de receita não pode ser alterado.".
    // O que o POST também não exige continua aceito: paciente na receita animal pode ser nulo (medido em 2026-10-19).
    // Receita não tem DELETE: tudo roda em 2 receitas temporárias próprias (1 humana e 1 animal por rodada, no tenant dev — mesmo padrão dos ctx 7, 11 e 13), sem tocar em receita real.
    // As recusas não mudam nada: o teste confere que paciente, comprador, animal e `updated_at` continuam idênticos. Os controles de `200` ficam por último, pois gravam na receita temporária.
    const TIMEOUT_ROTA = { timeout: 90000 };
    const MSG_PACIENTE = 'Paciente obrigatório para receita humana.';
    const MSG_COMPRADOR = 'Comprador obrigatório para receita animal.';
    const MSG_TIPO = 'Tipo de receita não pode ser alterado.';

    let cliente = null;
    let outroCliente = null;
    let animal = null;
    let humanaId = null;
    let animalId = null;

    const detalhe = (id) => api.obterDetalhePrescricao(storeId, id, TIMEOUT_ROTA).then((det) => {
      expect(det.status, `Status do detalhe da receita temporária #${id}`).to.eq(200);
      return det.body;
    });
    const partesDe = (corpo) => ({
      patient_id: corpo.patient_id, buyer_id: corpo.buyer_id, animal_id: corpo.animal_id, updated_at: corpo.updated_at,
    });
    const alterar = (id, corpo) => api.atualizarPrescricao(storeId, id, corpo, TIMEOUT_ROTA);
    // Recusa de PATCH: 422 com a mensagem certa e a receita exatamente como estava
    const exigirRecusa = (id, corpo, mensagem, rotulo) => detalhe(id).then((antes) => {
      alterar(id, corpo).then((res) => {
        expect(res.status, `Status de ${rotulo} (antes da PR #700 o PATCH aceitava e apagava o campo)`).to.eq(422);
        expect(res.body.message, `Mensagem de ${rotulo}`).to.eq(mensagem);
      });
      detalhe(id).then((depois) => {
        expect(partesDe(depois), `Receita #${id} não pode mudar após ${rotulo}`).to.deep.eq(partesDe(antes));
      });
    });

    before(() => {
      // Cliente padrão do env.json (R-POM) como paciente e comprador da receita humana temporária
      api.buscarClientes(storeId, configEnv.DEFAULT_CLIENT_NAME).then((resCli) => {
        cliente = (resCli.body && (resCli.body.items || resCli.body))[0];
        expect(cliente && cliente.id, '🔒 DEFAULT_CLIENT_NAME não achou cliente (massa)').to.be.ok;
        api.listarClientes(storeId, { type: 'all', per_page: 20 }, TIMEOUT_ROTA).then((resLista) => {
          // Segundo cliente (pessoa) para o controle de troca válida de paciente e comprador
          outroCliente = ((resLista.body && resLista.body.items) || []).find((c) => c.type !== 'animal' && c.id !== cliente.id);
          expect(outroCliente, '🔒 Nenhum segundo cliente (pessoa) na listagem (massa)').to.exist;
          api.listarClientes(storeId, { type: 'animal', per_page: 20 }, TIMEOUT_ROTA).then((resAnimais) => {
            animal = ((resAnimais.body && resAnimais.body.items) || []).find((a) => a.guardian_id && a.guardian_name);
            expect(animal, '🔒 Nenhum animal com tutor na listagem (massa)').to.exist;
            api.criarPrescricao(storeId, {
              prescription_type: 'human', status: 0, sale_type: 1,
              patient_id: cliente.id, patient_name: cliente.name, buyer_id: cliente.id, buyer_name: cliente.name,
              prescriber_id: 18780, pickup_store_id: storeId,
            }, TIMEOUT_ROTA).then((resHumana) => {
              expect(resHumana.status, 'Status da criação da receita humana temporária').to.be.oneOf([200, 201]);
              humanaId = resHumana.body.id || resHumana.body.prescription_id;
              expect(humanaId, 'ID da receita humana temporária').to.be.ok;
            });
            api.criarPrescricao(storeId, {
              prescription_type: 'animal', status: 0, sale_type: 1,
              animal_id: animal.id, animal_name: animal.name, buyer_id: animal.guardian_id, buyer_name: animal.guardian_name,
              prescriber_id: 18780, pickup_store_id: storeId,
            }, TIMEOUT_ROTA).then((resAnimal) => {
              expect(resAnimal.status, 'Status da criação da receita animal temporária').to.be.oneOf([200, 201]);
              animalId = resAnimal.body.id || resAnimal.body.prescription_id;
              expect(animalId, 'ID da receita animal temporária').to.be.ok;
            });
          });
        });
      });
    });

    it('15.1 Deve recusar com 422 o patient_id nulo no PATCH de receita humana, sozinho ou com o buyer_id nulo, sem apagar o paciente', () => {
      exigirRecusa(humanaId, { patient_id: null }, MSG_PACIENTE, 'PATCH com patient_id nulo');
      exigirRecusa(humanaId, { patient_id: null, buyer_id: null }, MSG_PACIENTE, 'PATCH com patient_id e buyer_id nulos');
    });

    it('15.2 Deve recusar com 422 o animal_id informado no PATCH de receita humana, sem mudar o tipo da receita', () => {
      exigirRecusa(humanaId, { animal_id: animal.id }, MSG_TIPO, 'PATCH de receita humana com animal_id');
      detalhe(humanaId).then((corpo) => {
        expect(corpo.prescription_type, 'Tipo da receita humana depois da recusa').to.eq('human');
      });
    });

    it('15.3 Deve recusar com 422 o buyer_id nulo no PATCH de receita animal, sem apagar o comprador', () => {
      exigirRecusa(animalId, { buyer_id: null }, MSG_COMPRADOR, 'PATCH de receita animal com buyer_id nulo');
    });

    it('15.4 Deve recusar com 422 o animal_id nulo no PATCH de receita animal, sem mudar o tipo da receita', () => {
      exigirRecusa(animalId, { animal_id: null }, MSG_TIPO, 'PATCH de receita animal com animal_id nulo');
      detalhe(animalId).then((corpo) => {
        expect(corpo.prescription_type, 'Tipo da receita animal depois da recusa').to.eq('animal');
        expect(corpo.animal_id, 'Animal da receita depois da recusa').to.eq(animal.id);
      });
    });

    it('15.5 Deve manter a criação exigindo as mesmas partes, com as mesmas mensagens do PATCH, sem devolver id', () => {
      // A issue pede "a mesma mensagem do POST": prova que POST e PATCH recusam com o mesmo texto
      api.criarPrescricao(storeId, {
        prescription_type: 'human', status: 0, sale_type: 1, buyer_id: cliente.id, buyer_name: cliente.name,
        prescriber_id: 18780, pickup_store_id: storeId,
      }, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status do POST de receita humana sem paciente').to.eq(422);
        expect(res.body.message, 'Mensagem do POST sem paciente').to.eq(MSG_PACIENTE);
        expect(res.body, 'POST recusado não pode devolver id').to.not.have.property('id');
      });
      api.criarPrescricao(storeId, {
        prescription_type: 'animal', status: 0, sale_type: 1, animal_id: animal.id, animal_name: animal.name,
        prescriber_id: 18780, pickup_store_id: storeId,
      }, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status do POST de receita animal sem comprador').to.eq(422);
        expect(res.body.message, 'Mensagem do POST sem comprador').to.eq(MSG_COMPRADOR);
        expect(res.body, 'POST recusado não pode devolver id').to.not.have.property('id');
      });
    });

    it('15.6 Deve continuar aceitando a troca de paciente e de comprador por outro cadastro válido e o paciente nulo na receita animal', () => {
      // Controles de 200 (gravam na receita temporária, por isso ficam por último)
      alterar(humanaId, { patient_id: outroCliente.id }).then((res) => {
        expect(res.status, 'Status da troca de paciente da receita humana').to.eq(200);
        expect(res.body.patient_id, 'Paciente devolvido pelo PATCH').to.eq(outroCliente.id);
        detalhe(humanaId).then((corpo) => {
          expect(corpo.patient_id, 'Paciente gravado').to.eq(outroCliente.id);
          expect(corpo.prescription_type, 'Tipo da receita humana segue igual').to.eq('human');
        });
      });
      alterar(animalId, { buyer_id: outroCliente.id }).then((res) => {
        expect(res.status, 'Status da troca de comprador da receita animal').to.eq(200);
        expect(res.body.buyer_id, 'Comprador devolvido pelo PATCH').to.eq(outroCliente.id);
      });
      // Paciente na receita animal não é exigido nem na criação: segue aceito
      alterar(animalId, { patient_id: null }).then((res) => {
        expect(res.status, 'Status de patient_id nulo na receita animal (o POST também não exige)').to.eq(200);
        expect(res.body.patient_id, 'Paciente da receita animal').to.eq(null);
        detalhe(animalId).then((corpo) => {
          expect(corpo.animal_id, 'Animal da receita segue igual').to.eq(animal.id);
          expect(corpo.buyer_id, 'Comprador gravado na receita animal').to.eq(outroCliente.id);
        });
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 60: INCLUSÃO NA FÓRMULA DE PRODUTO QUE É FÓRMULA CADASTRADA BLOQUEADA RESPONDE COM O MOTIVO (Issue backend#660/PR #703)
  // ---------------------------------------------------------------------------
  context('16. Inclusão na Fórmula de Produto que é Fórmula Cadastrada com Inclusão Bloqueada Responde 422 com o Motivo (Issue backend#660/PR #703)', () => {

    // Subissue da #649. Ao incluir certos produtos na fórmula (ex.: "CLONAZEPAM FC:100", id 1000175) a procedure `MOV_ATENDIMENTO_CALC11` respondia "Inclusão de fórmula não permitida!".
    // O produto tem fórmula própria cadastrada (`ESTOQUEF`) com `INCLUSAO_A = 0`; não tem relação com controlado nem com permissão do funcionário (o "PURO CLONAZEPAM", da mesma portaria, entra).
    // A PR #703 troca só o texto: "O produto <nome> é uma fórmula cadastrada que não pode ser incluída na receita. Libere a inclusão no cadastro dessa fórmula ou escolha outro produto.".
    // A regra segue na procedure e as outras mensagens dela passam sem mudança (sem massa para provar: a fórmula sem `INCLUSAO_A` preenchido responde "Produto não tem fórmula cadastrada!", que a issue não pediu para mudar).
    // O <nome> é o do cadastro (`GET /products`), com os espaços dele ("CLONAZEPAM  FC:100" tem dois): o teste lê o nome da listagem, nunca o digita.
    // Receita não tem DELETE: tudo roda numa receita temporária própria com 1 fórmula (1 por rodada, no tenant dev — mesmo padrão dos ctx 7, 11 e 15). A recusa não grava nada, então o teste confere que a fórmula continua sem produtos.
    const TIMEOUT_ROTA = { timeout: 90000 };
    const MSG_ANTIGA = 'Inclusão de fórmula não permitida!';
    const msgBloqueada = (nome) => `O produto ${nome} é uma fórmula cadastrada que não pode ser incluída na receita. Libere a inclusão no cadastro dessa fórmula ou escolha outro produto.`;

    let bloqueado = null;
    let puro = null;
    let prescricaoId = null;
    let formulaId = null;

    const produtosDaFormula = () => api.obterDetalhePrescricao(storeId, prescricaoId, TIMEOUT_ROTA).then((det) => {
      expect(det.status, 'Status do detalhe da receita temporária').to.eq(200);
      const formula = ((det.body && det.body.formulas) || []).find((f) => f.id === formulaId);
      expect(formula, 'Fórmula temporária no detalhe da receita').to.exist;
      return formula.products || formula.items || [];
    });
    const incluir = (produto, extra = {}) => api.adicionarProdutoFormula(storeId, prescricaoId, formulaId, {
      product_id: produto.id, quantity: 250, unit: 'mg', ...extra,
    }, TIMEOUT_ROTA);

    before(() => {
      // Os dois produtos saem da busca por "CLONAZEPAM": o nome do cadastro é a fonte do texto da mensagem
      api.listarProdutos(storeId, { usage: 'human', mode: 'containing', q: 'CLONAZEPAM' }, TIMEOUT_ROTA).then((resProdutos) => {
        const itens = (resProdutos.body && resProdutos.body.items) || [];
        bloqueado = itens.find((p) => p.id === 1000175);
        puro = itens.find((p) => /^PURO CLONAZEPAM/.test(p.name));
        expect(bloqueado, '🔒 Produto 1000175 (CLONAZEPAM FC:100, fórmula cadastrada com inclusão bloqueada) não achado (massa)').to.exist;
        expect(puro, '🔒 PURO CLONAZEPAM (mesma portaria, entra normalmente) não achado (massa)').to.exist;
        // Cliente padrão do env.json (R-POM) como paciente e comprador da receita temporária
        api.buscarClientes(storeId, configEnv.DEFAULT_CLIENT_NAME).then((resCli) => {
          const cliente = (resCli.body && (resCli.body.items || resCli.body))[0];
          expect(cliente && cliente.id, '🔒 DEFAULT_CLIENT_NAME não achou cliente (massa)').to.be.ok;
          api.criarPrescricao(storeId, {
            prescription_type: 'human', status: 0, sale_type: 1,
            patient_id: cliente.id, patient_name: cliente.name, buyer_id: cliente.id, buyer_name: cliente.name,
            prescriber_id: 18780, pickup_store_id: storeId,
          }, TIMEOUT_ROTA).then((resPresc) => {
            expect(resPresc.status, 'Status da criação da receita temporária').to.be.oneOf([200, 201]);
            prescricaoId = resPresc.body.id || resPresc.body.prescription_id;
            expect(prescricaoId, 'ID da receita temporária').to.be.ok;
            api.criarFormulaPrescricao(storeId, prescricaoId, {
              formula_number: 1, pharmaceutical_form_id: 2, lab_id: 2, qvd: 30, multiplier: 1,
            }, TIMEOUT_ROTA).then((resFormula) => {
              expect(resFormula.status, 'Status da criação da fórmula temporária').to.be.oneOf([200, 201]);
              formulaId = resFormula.body.id;
              expect(formulaId, 'ID da fórmula temporária').to.be.ok;
            });
          });
        });
      });
    });

    it('16.1 Deve recusar com 422 a inclusão de produto que é fórmula cadastrada com inclusão bloqueada, com a mensagem que diz o motivo e cita o produto, sem gravar nada', () => {
      produtosDaFormula().then((antes) => {
        // Duas quantidades diferentes: a mensagem não depende do que foi digitado
        [{ quantity: 250, unit: 'mg' }, { quantity: 1, unit: 'g' }].forEach((qtd) => {
          incluir(bloqueado, qtd).then((res) => {
            expect(res.status, `Status da inclusão de ${bloqueado.name} com ${qtd.quantity} ${qtd.unit}`).to.eq(422);
            expect(res.body.message, 'Mensagem não pode ser mais o texto cru da procedure (antes da PR #703)').to.not.eq(MSG_ANTIGA);
            expect(res.body.message, 'Mensagem com o motivo e o nome do produto no cadastro').to.eq(msgBloqueada(bloqueado.name));
          });
        });
        produtosDaFormula().then((depois) => {
          expect(depois.length, 'a recusa não pode ter gravado linha na fórmula').to.eq(antes.length);
        });
      });
    });

    it('16.2 Deve continuar incluindo normalmente o produto sem a flag, inclusive o PURO CLONAZEPAM da mesma portaria', () => {
      // Controles de 201 (gravam na fórmula temporária, por isso ficam por último). O PURO CLONAZEPAM prova que o bloqueio não é do princípio ativo nem da portaria.
      produtosDaFormula().then((antes) => {
        incluir(puro).then((res) => {
          expect(res.status, `Status da inclusão de ${puro.name} (não é fórmula cadastrada bloqueada)`).to.be.oneOf([200, 201]);
        });
        produtosDaFormula().then((depois) => {
          expect(depois.length, 'o produto sem a flag entra na fórmula').to.eq(antes.length + 1);
        });
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 61: AVISOS DO CÁLCULO DA FÓRMULA SEPARADOS EM DOIS CÓDIGOS (Issue backend#657/PR #705)
  // ---------------------------------------------------------------------------
  // Só a prévia (POST .../prescriptions/formula-calculations), que não grava nada. A barreira da permissão 621 no cálculo e na conclusão
  // (PR #706) fica de fora: a conta de teste tem o grant (`can_calculate_out_of_range_dosage: true`), então o 403 não é alcançável.
  // Os limites vêm do catálogo a cada rodada (cadastro é dado vivo): os testes afirmam a regra, não 220 mg ou 430 mg.
  context('17. Avisos do Cálculo da Fórmula: Dose Fora do Intervalo (out_of_range_dosage) e Aviso do Produto (product_notice), sem monitored_product (Issue backend#657/PR #705)', () => {
    const TIMEOUT_ROTA = { timeout: 90000 };
    const NALTREXONA = 1003180; // mínimo e máximo ligados no cadastro
    const BUPROPIONA = 1001889; // mínimo e máximo ligados no cadastro
    const PASSIFLORA_EXTRATO = 1004866; // o exemplo da issue: máximo ligado
    const GENGIBRE_EXTRATO = 1005312; // tem aviso de atendimento no cadastro e intervalo ligado
    const CODIGOS_DE_AVISO = ['out_of_range_dosage', 'product_notice'];
    const CHAVES_DO_AVISO = ['code', 'direction', 'message', 'product_id', 'product_name'];
    const cadastro = {};

    const previa = (produtos) => api.preverCalculoFormula(storeId, {
      pharmaceutical_form_id: 2, qvd: 30.0, multiplier: 1, products: produtos,
    }, TIMEOUT_ROTA).then((res) => {
      expect(res.status, 'Status da prévia do cálculo').to.eq(200);
      expect(res.body.warnings, 'A prévia devolve os avisos como lista').to.be.an('array');
      return res.body.warnings;
    });
    const produto = (id, quantity, unit) => ({ product_id: id, quantity, unit });
    const nome = (id) => cadastro[id].name.trim();
    const foraDoIntervalo = (avisos, id) => avisos.filter((a) => a.code === 'out_of_range_dosage' && a.product_id === id);
    const mensagemDoIntervalo = (id, sentido) => `${nome(id)} com quantidade ${sentido} do intervalo cadastrado.`;

    // Pré-condições de massa: o cadastro do produto precisa ter o limite ligado, em mg (a conta a seguir é em mg)
    const exigeMaximo = (id) => {
      const p = cadastro[id];
      expect(p, `🔒 produto ${id} no catálogo (GET /products)`).to.be.ok;
      expect(p.check_max, `🔒 CHECARMAX ligado no produto ${id}`).to.eq(true);
      expect(p.max_unit, `🔒 unidade do máximo do produto ${id}`).to.eq('mg');
      expect(Number(p.max_quantity), `🔒 máximo cadastrado do produto ${id}`).to.be.greaterThan(0);
      return Number(p.max_quantity);
    };
    const exigeMinimo = (id) => {
      const p = cadastro[id];
      expect(p, `🔒 produto ${id} no catálogo (GET /products)`).to.be.ok;
      expect(p.check_min, `🔒 CHECARMIN ligado no produto ${id}`).to.eq(true);
      expect(p.min_unit, `🔒 unidade do mínimo do produto ${id}`).to.eq('mg');
      expect(Number(p.min_quantity), `🔒 mínimo cadastrado do produto ${id}`).to.be.greaterThan(0);
      return Number(p.min_quantity);
    };

    before(() => {
      ['NALTREXONA', 'BUPROPIONA', 'PASSIFLORA', 'GENGIBRE'].forEach((q) => {
        api.listarProdutos(storeId, { usage: 'human', q, limit: 10 }).then((res) => {
          (res.body?.items || []).forEach((p) => { cadastro[p.id] = p; });
        });
      });
    });

    it('17.1 deve avisar out_of_range_dosage com direction above quando a quantidade passa do máximo cadastrado, e não avisar no limite exato (PASSIFLORA, exemplo da issue)', () => {
      const maximo = exigeMaximo(PASSIFLORA_EXTRATO);
      previa([produto(PASSIFLORA_EXTRATO, maximo, 'mg')]).then((avisos) => {
        expect(foraDoIntervalo(avisos, PASSIFLORA_EXTRATO), 'No máximo exato não avisa (limite inclusivo)').to.have.length(0);
      });
      previa([produto(PASSIFLORA_EXTRATO, maximo + 1, 'mg')]).then((avisos) => {
        const fora = foraDoIntervalo(avisos, PASSIFLORA_EXTRATO);
        expect(fora, 'Um mg acima do máximo avisa uma vez').to.have.length(1);
        expect(fora[0], 'Aviso de dose acima').to.deep.include({ code: 'out_of_range_dosage', direction: 'above', product_id: PASSIFLORA_EXTRATO });
        expect(fora[0].message, 'Mensagem do aviso acima').to.eq(mensagemDoIntervalo(PASSIFLORA_EXTRATO, 'acima'));
        expect(fora[0].product_name, 'Nome do produto no aviso').to.eq(nome(PASSIFLORA_EXTRATO));
      });
    });

    it('17.2 deve avisar out_of_range_dosage com direction below quando a quantidade fica abaixo do mínimo cadastrado, e não avisar no limite exato (NALTREXONA)', () => {
      const minimo = exigeMinimo(NALTREXONA);
      previa([produto(NALTREXONA, minimo, 'mg')]).then((avisos) => {
        expect(foraDoIntervalo(avisos, NALTREXONA), 'No mínimo exato não avisa (limite inclusivo)').to.have.length(0);
      });
      previa([produto(NALTREXONA, Number((minimo - 0.01).toFixed(2)), 'mg')]).then((avisos) => {
        const fora = foraDoIntervalo(avisos, NALTREXONA);
        expect(fora, 'Um centésimo de mg abaixo do mínimo avisa uma vez').to.have.length(1);
        expect(fora[0], 'Aviso de dose abaixo').to.deep.include({ code: 'out_of_range_dosage', direction: 'below', product_id: NALTREXONA });
        expect(fora[0].message, 'Mensagem do aviso abaixo').to.eq(mensagemDoIntervalo(NALTREXONA, 'abaixo'));
      });
    });

    it('17.3 deve avisar cada produto fora do intervalo na mesma prévia, com a sua direção, e não avisar o que está dentro', () => {
      const maximoBupropiona = exigeMaximo(BUPROPIONA);
      const minimoNaltrexona = exigeMinimo(NALTREXONA);
      const maximoPassiflora = exigeMaximo(PASSIFLORA_EXTRATO);
      previa([
        produto(BUPROPIONA, maximoBupropiona * 2, 'mg'),
        produto(NALTREXONA, minimoNaltrexona / 2, 'mg'),
        produto(PASSIFLORA_EXTRATO, maximoPassiflora / 2, 'mg'),
      ]).then((avisos) => {
        expect(avisos.map((a) => a.code), 'Só os dois fora do intervalo geram aviso').to.deep.eq(['out_of_range_dosage', 'out_of_range_dosage']);
        expect(foraDoIntervalo(avisos, BUPROPIONA)[0], 'BUPROPIONA acima').to.deep.include({ direction: 'above' });
        expect(foraDoIntervalo(avisos, NALTREXONA)[0], 'NALTREXONA abaixo').to.deep.include({ direction: 'below' });
        expect(avisos.some((a) => a.product_id === PASSIFLORA_EXTRATO), 'PASSIFLORA dentro do intervalo não avisa').to.eq(false);
      });
    });

    it('17.4 deve comparar a dose depois de converter a unidade: o máximo cadastrado em mg vale igual enviado em g', () => {
      const maximo = exigeMaximo(BUPROPIONA);
      previa([produto(BUPROPIONA, maximo / 1000, 'g')]).then((avisos) => {
        expect(foraDoIntervalo(avisos, BUPROPIONA), 'O máximo em g equivalente não avisa').to.have.length(0);
      });
      previa([produto(BUPROPIONA, (maximo * 2) / 1000, 'g')]).then((avisos) => {
        const fora = foraDoIntervalo(avisos, BUPROPIONA);
        expect(fora, 'O dobro do máximo em g avisa').to.have.length(1);
        expect(fora[0], 'Direção do aviso em g').to.deep.include({ direction: 'above' });
      });
    });

    it('17.5 deve devolver o aviso de atendimento do cadastro com o código product_notice, sem direction, junto de out_of_range_dosage quando a dose também está fora', () => {
      const gengibre = cadastro[GENGIBRE_EXTRATO];
      const maximo = exigeMaximo(GENGIBRE_EXTRATO);
      const minimo = exigeMinimo(GENGIBRE_EXTRATO);
      expect(String(gengibre.warning_message || '').trim(), `🔒 aviso de atendimento cadastrado no produto ${GENGIBRE_EXTRATO}`).to.not.be.empty;
      const textoDoCadastro = String(gengibre.warning_message).trim();

      previa([produto(GENGIBRE_EXTRATO, (minimo + maximo) / 2, 'mg')]).then((avisos) => {
        expect(avisos, 'Dentro do intervalo só o aviso do produto').to.have.length(1);
        expect(avisos[0], 'Aviso do produto').to.deep.include({ code: 'product_notice', direction: null, product_id: GENGIBRE_EXTRATO, product_name: nome(GENGIBRE_EXTRATO) });
        expect(avisos[0].message, 'Texto do aviso é o do cadastro, sem os espaços das pontas').to.eq(textoDoCadastro);
      });
      previa([produto(GENGIBRE_EXTRATO, maximo * 2, 'mg')]).then((avisos) => {
        expect(avisos.map((a) => a.code).sort(), 'Fora do intervalo vêm os dois avisos').to.deep.eq(['out_of_range_dosage', 'product_notice']);
        expect(avisos.find((a) => a.code === 'out_of_range_dosage'), 'Direção da dose').to.deep.include({ direction: 'above' });
      });
    });

    it('17.6 não deve devolver mais o código monitored_product: todo aviso é out_of_range_dosage ou product_notice, com as 5 chaves do aviso', () => {
      const maximoBupropiona = exigeMaximo(BUPROPIONA);
      const minimoNaltrexona = exigeMinimo(NALTREXONA);
      const maximoPassiflora = exigeMaximo(PASSIFLORA_EXTRATO);
      const maximoGengibre = exigeMaximo(GENGIBRE_EXTRATO);
      const minimoGengibre = exigeMinimo(GENGIBRE_EXTRATO);
      previa([
        produto(BUPROPIONA, maximoBupropiona * 2, 'mg'),
        produto(NALTREXONA, minimoNaltrexona / 2, 'mg'),
        produto(PASSIFLORA_EXTRATO, maximoPassiflora / 2, 'mg'),
        produto(GENGIBRE_EXTRATO, (minimoGengibre + maximoGengibre) / 2, 'mg'),
      ]).then((avisos) => {
        expect(avisos, 'Dois fora do intervalo e um aviso de produto').to.have.length(3);
        expect(avisos.map((a) => a.code), 'Nenhum monitored_product').to.not.include('monitored_product');
        avisos.forEach((aviso) => {
          expect(aviso.code, 'Código de aviso conhecido').to.be.oneOf(CODIGOS_DE_AVISO);
          expect(aviso, `Chaves do aviso ${aviso.code}`).to.have.all.keys(CHAVES_DO_AVISO);
        });
      });
    });

    it('17.7 deve expor a capability can_calculate_out_of_range_dosage (grant 621) como booleana em /prescription-capabilities', () => {
      api.obterCapabilitiesReceitas(storeId).then((res) => {
        expect(res.status, 'Status das capabilities de receita').to.eq(200);
        expect(res.body.capabilities, 'Capability da dose fora do intervalo').to.have.property('can_calculate_out_of_range_dosage').that.is.a('boolean');
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 62: BUSCA DE PRESCRITORES PELO CRM (ISSUE BACKEND#658, PR #712)
  // ---------------------------------------------------------------------------
  context('18. Busca de Prescritores pelo Número do Conselho (CRM), com os Achados pelo CRM antes dos Achados pelo Código (Issue backend#658/PR #712)', () => {

    // Subissue da #649. `GET /prescribers?q=` com termo numérico procurava só pelo código interno do cadastro, nunca pelo CRM: `q=23325` trazia o prescritor de código 23325 e
    // escondia os dois com CRM 23325, que é o número que o atendente digita. A PR #712 procura também em `MEDICO.CRM`, comparado sem espaço, tab e zero à esquerda dos dois lados
    // (`8746` acha `08746`), e devolve primeiro os achados pelo CRM, depois os demais (nome e código). Cada item ganha `council`, `council_number` e `council_uf` para distinguir
    // quem tem o mesmo número (6.296 números de CRM se repetem na dev). A busca por nome fica igual. Só leitura.
    // Massa do tenant dev, com precondição 🔒: CRM 23325 de 2 prescritores (MG e GO) e de código 23325 (CRM 25631); CRM 8746 salvo como "08746" e como "8746" e o prescritor de
    // código 8746 com outro CRM. O teste afirma a regra (CRM antes do código), nunca a lista inteira, e a ordem por nome só na busca por nome.
    const TIMEOUT_ROTA = { timeout: 90000 };
    const CRM_DE_DOIS_PRESCRITORES = '23325';
    const CRM_COM_ZERO_A_ESQUERDA = '8746';
    const TERMO_DE_NOME = 'abadio';
    const CHAVES_DO_ITEM = ['id', 'name', 'council', 'council_number', 'council_uf'];
    const semFormatacao = (numero) => String(numero).replace(/\s/g, '').replace(/^0+/, '');
    const buscar = (q) => api.buscarPrescritores(storeId, q, TIMEOUT_ROTA).then((res) => {
      expect(res.status, `Status da busca de prescritores por "${q}"`).to.eq(200);
      expect(res.body.items, `Itens da busca por "${q}"`).to.be.an('array');
      return res.body.items;
    });

    // Os achados pelo CRM do termo vêm todos antes dos achados só pelo código
    const exigirCrmAntesDoCodigo = (itens, termo) => {
      const porCrm = itens.filter((i) => semFormatacao(i.council_number) === semFormatacao(termo));
      const soPeloCodigo = itens.filter((i) => semFormatacao(i.council_number) !== semFormatacao(termo));
      expect(porCrm.length, `🔒 massa: nenhum prescritor com CRM ${termo} na dev`).to.be.greaterThan(0);
      expect(soPeloCodigo.length, `🔒 massa: nenhum prescritor achado só pelo código ${termo} na dev`).to.be.greaterThan(0);
      const ids = itens.map((i) => i.id);
      expect(Math.max(...porCrm.map((i) => ids.indexOf(i.id))), 'posição do último achado pelo CRM (antes da PR #712 nem aparecia)').to.be.lessThan(Math.min(...soPeloCodigo.map((i) => ids.indexOf(i.id))));
      return { porCrm, soPeloCodigo };
    };

    it('18.1 Deve devolver primeiro os prescritores com o CRM digitado e só depois o prescritor de código igual', () => {
      buscar(CRM_DE_DOIS_PRESCRITORES).then((itens) => {
        const { porCrm, soPeloCodigo } = exigirCrmAntesDoCodigo(itens, CRM_DE_DOIS_PRESCRITORES);
        expect(porCrm.length, `🔒 massa: ao menos 2 prescritores com CRM ${CRM_DE_DOIS_PRESCRITORES}`).to.be.at.least(2);
        expect(soPeloCodigo.map((i) => i.id), 'o achado só pelo código é o prescritor de código igual ao termo').to.include(Number(CRM_DE_DOIS_PRESCRITORES));
      });
    });

    it('18.2 Deve trazer em cada item o conselho, o número e a UF, além do código e do nome, na busca por número e na busca por nome', () => {
      [CRM_DE_DOIS_PRESCRITORES, TERMO_DE_NOME].forEach((termo) => {
        buscar(termo).then((itens) => {
          expect(itens.length, `🔒 massa: nenhum item para "${termo}"`).to.be.greaterThan(0);
          itens.forEach((item) => {
            expect(item, `Chaves do item ${item.id} em "${termo}"`).to.have.all.keys(...CHAVES_DO_ITEM);
            expect(item.id, 'id (código do cadastro)').to.be.a('number');
            expect(item.name, 'name').to.be.a('string').and.not.be.empty;
          });
        });
      });
      // Os de CRM 23325 distinguem-se pelo conselho, número e UF
      buscar(CRM_DE_DOIS_PRESCRITORES).then((itens) => {
        itens.filter((i) => semFormatacao(i.council_number) === CRM_DE_DOIS_PRESCRITORES).forEach((i) => {
          expect(i.council, `council do prescritor ${i.id}`).to.be.a('string').and.not.be.empty;
          expect(i.council_uf, `council_uf do prescritor ${i.id}`).to.be.a('string').and.not.be.empty;
        });
      });
    });

    it('18.3 Deve achar o CRM salvo com zero à esquerda digitando o número sem o zero, e devolver o mesmo resultado digitando com o zero', () => {
      buscar(CRM_COM_ZERO_A_ESQUERDA).then((itens) => {
        expect(itens.some((i) => i.council_number === `0${CRM_COM_ZERO_A_ESQUERDA}`), `🔒 massa: nenhum CRM salvo como 0${CRM_COM_ZERO_A_ESQUERDA} na dev`).to.eq(true);
        exigirCrmAntesDoCodigo(itens, CRM_COM_ZERO_A_ESQUERDA);
        // Comparação sem zero à esquerda dos dois lados: o termo com zero devolve os mesmos itens, na mesma ordem
        buscar(`0${CRM_COM_ZERO_A_ESQUERDA}`).then((comZero) => {
          expect(comZero.map((i) => i.id), 'ids da busca com o zero à esquerda no termo').to.deep.eq(itens.map((i) => i.id));
        });
      });
    });

    it('18.4 Deve manter a busca por nome: todo item traz o termo no nome, em ordem de nome', () => {
      buscar(TERMO_DE_NOME).then((itens) => {
        expect(itens.length, `🔒 massa: nenhum prescritor com "${TERMO_DE_NOME}" no nome`).to.be.greaterThan(0);
        itens.forEach((i) => expect(i.name.toLowerCase(), `nome do prescritor ${i.id}`).to.include(TERMO_DE_NOME));
        const nomes = itens.map((i) => i.name);
        expect(nomes, 'nomes em ordem crescente, como antes da PR #712').to.deep.eq([...nomes].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
      });
    });

    it('18.5 Deve responder 401 sem token na busca de prescritores', () => {
      api.buscarPrescritores(storeId, CRM_DE_DOIS_PRESCRITORES, { headers: { Authorization: '' }, ...TIMEOUT_ROTA }).then((res) => {
        expect(res.status, 'Status sem token').to.eq(401);
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 63: PERMISSÃO 621 (DOSE FORA DO INTERVALO) NO CÁLCULO E NA CONCLUSÃO MANUAL DA FÓRMULA (Issue backend#657/PR #706)
  // ---------------------------------------------------------------------------
  // Capability × ação (R-CAPXACAO, como o 0-B ctx 12): `can_calculate_out_of_range_dosage` diz se o operador tem a 621. Com `true` o cálculo e a
  // conclusão passam; com `false` a ação é recusada com 403 AUTHORIZATION_REQUIRED antes de gravar. A conta de teste (env.json só tem 1 USER_CODE)
  // tem o grant, então só o ramo `true` é exercitado de verdade; o ramo `false` está escrito, mas nunca rodou (o formato do 403 vem da nota da PR #706).
  // O fluxo com ticket (aprovador com a 621) não é alcançável sem uma 2ª conta. Roda numa receita própria (receita não tem DELETE): grava só nela.
  context('19. Permissão 621 (Dose Fora do Intervalo): Cálculo e Conclusão Manual Coerentes com can_calculate_out_of_range_dosage (Issue backend#657/PR #706)', () => {
    const BUPROPIONA = 1001889; // máximo ligado no cadastro
    const PASSIFLORA_EXTRATO = 1004866; // máximo ligado no cadastro
    const cadastro = {};
    let prescricaoId;
    let formulaForaId; // dose fora do intervalo, ainda sem cálculo
    let formulaDentroId; // dose dentro do intervalo, ainda sem cálculo
    let formulaConcluivelId; // calculada dentro do intervalo; o teste 62.3 muda a dose
    let maximoBupropiona;
    let maximoPassiflora;

    const exigeMaximo = (id) => {
      const p = cadastro[id];
      expect(p, `🔒 produto ${id} no catálogo (GET /products)`).to.be.ok;
      expect(p.check_max, `🔒 CHECARMAX ligado no produto ${id}`).to.eq(true);
      expect(p.max_unit, `🔒 unidade do máximo do produto ${id}`).to.eq('mg');
      expect(Number(p.max_quantity), `🔒 máximo cadastrado do produto ${id}`).to.be.greaterThan(0);
      return Number(p.max_quantity);
    };
    const podeCalcularForaDoIntervalo = () => api.obterCapabilitiesReceitas(storeId).then((res) => {
      expect(res.status, 'Status das capabilities de receita').to.eq(200);
      const pode = res.body.capabilities.can_calculate_out_of_range_dosage;
      expect(pode, 'Capability do grant 621').to.be.a('boolean');
      return pode;
    });
    const formulaDaReceita = (id) => api.obterDetalhePrescricao(storeId, prescricaoId).then((res) => res.body.formulas.find((f) => f.id === id));
    const validar403Autorizacao = (res, rotulo) => {
      expect(res.status, `${rotulo}: sem a 621 e sem ticket a ação é recusada`).to.eq(403);
      expect(res.body.error_code || res.body.code, `${rotulo}: código da recusa`).to.eq('AUTHORIZATION_REQUIRED');
      expect(res.body.authorization_context?.required_grants, `${rotulo}: grant exigido`).to.deep.eq([621]);
    };

    before(() => {
      ['BUPROPIONA', 'PASSIFLORA'].forEach((q) => {
        api.listarProdutos(storeId, { usage: 'human', q, limit: 10 }).then((res) => {
          (res.body?.items || []).forEach((p) => { cadastro[p.id] = p; });
        });
      });
      api.buscarClientes(storeId, configEnv.DEFAULT_CLIENT_NAME).then((resCli) => {
        const cliente = resCli.body?.items?.[0] || resCli.body?.[0];
        const clienteId = cliente?.id;
        expect(clienteId, '🔒 DEFAULT_CLIENT_NAME não achou cliente (massa)').to.be.ok;
        const nome = cliente.name;
        api.criarPrescricao(storeId, {
          prescription_type: 'human',
          status: 0,
          sale_type: 1,
          patient_id: clienteId,
          patient_name: nome,
          buyer_id: clienteId,
          buyer_name: nome,
          prescriber_id: 18780,
          pickup_store_id: storeId,
        }).then((resP) => {
          expect(resP.status, 'Status da criação da receita de teste').to.eq(201);
          prescricaoId = resP.body.id;
          maximoBupropiona = exigeMaximo(BUPROPIONA);
          maximoPassiflora = exigeMaximo(PASSIFLORA_EXTRATO);
          const novaFormula = (numero, productId, quantity) => api.criarFormulaPrescricao(storeId, prescricaoId, {
            formula_number: numero, pharmaceutical_form_id: 2, lab_id: 2, qvd: 30.0, multiplier: 1,
          }).then((resF) => {
            expect(resF.status, `Status da criação da fórmula ${numero}`).to.eq(201);
            return api.adicionarProdutoFormula(storeId, prescricaoId, resF.body.id, { product_id: productId, quantity, unit: 'mg' }).then((resA) => {
              expect(resA.status, `Status do produto ${productId} na fórmula ${numero}`).to.eq(201);
              return resF.body.id;
            });
          });
          novaFormula(1, BUPROPIONA, maximoBupropiona * 2).then((id) => { formulaForaId = id; });
          novaFormula(2, PASSIFLORA_EXTRATO, maximoPassiflora / 2).then((id) => { formulaDentroId = id; });
          // Calculada dentro do intervalo: o 62.3 altera a dose depois e tenta concluí-la sem recalcular
          novaFormula(3, PASSIFLORA_EXTRATO, maximoPassiflora / 2).then((id) => {
            formulaConcluivelId = id;
            api.calcularFormula(storeId, prescricaoId, id).then((resC) => {
              expect(resC.status, 'Status do cálculo da fórmula 3 dentro do intervalo').to.eq(200);
            });
          });
        });
      });
    });

    it('19.1 deve calcular a fórmula com dose fora do intervalo e devolver o aviso com formula_id quando a conta tem a 621, e recusar com 403 AUTHORIZATION_REQUIRED sem gravar quando não tem', () => {
      podeCalcularForaDoIntervalo().then((pode) => {
        api.calcularFormula(storeId, prescricaoId, formulaForaId).then((res) => {
          if (pode) {
            expect(res.status, 'Com a 621 o cálculo fora do intervalo passa').to.eq(200);
            const aviso = res.body.warnings.find((a) => a.code === 'out_of_range_dosage' && a.formula_id === formulaForaId);
            expect(aviso, 'Aviso de dose fora do intervalo na resposta do cálculo').to.deep.include({ direction: 'above', product_id: BUPROPIONA, formula_number: 1 });
            formulaDaReceita(formulaForaId).then((formula) => {
              expect(formula.calculated, 'A fórmula ficou calculada').to.eq(true);
            });
          } else {
            validar403Autorizacao(res, 'Calcular com dose fora do intervalo');
            formulaDaReceita(formulaForaId).then((formula) => {
              expect(formula.calculated, 'A recusa não grava o cálculo').to.eq(false);
            });
          }
        });
      });
    });

    it('19.2 deve calcular a fórmula com dose dentro do intervalo sem avisos e sem depender da 621, com ou sem o grant', () => {
      podeCalcularForaDoIntervalo().then((pode) => {
        expect(pode, 'A capability é lida só para mostrar que o resultado não depende dela').to.be.a('boolean');
        api.calcularFormula(storeId, prescricaoId, formulaDentroId).then((res) => {
          expect(res.status, 'Dose dentro do intervalo calcula com ou sem a 621').to.eq(200);
          expect(res.body.warnings.filter((a) => a.formula_id === formulaDentroId), 'Sem aviso de dose na fórmula dentro do intervalo').to.have.length(0);
        });
      });
    });

    it('19.3 deve concluir à mão (PATCH calculated: true) a fórmula que passou a ter dose fora do intervalo quando a conta tem a 621, e recusar com 403 AUTHORIZATION_REQUIRED quando não tem', () => {
      podeCalcularForaDoIntervalo().then((pode) => {
        formulaDaReceita(formulaConcluivelId).then((formula) => {
          expect(formula.calculated, 'A fórmula 3 nasce calculada, dentro do intervalo').to.eq(true);
          // Dose para fora do intervalo: a fórmula perde o cálculo e passa a pedir recálculo
          api.atualizarProdutoFormula(storeId, prescricaoId, formulaConcluivelId, formula.products[0].id, { quantity: maximoPassiflora * 2, unit: 'mg' }).then((resProduto) => {
            expect(resProduto.status, 'Alterar a dose do produto da fórmula').to.eq(200);
            formulaDaReceita(formulaConcluivelId).then((alterada) => {
              expect(alterada, 'Fórmula com a dose alterada pede recálculo').to.deep.include({ calculated: false, needs_recalculate: true });
              api.atualizarFormulaPrescricao(storeId, prescricaoId, formulaConcluivelId, { calculated: true }).then((res) => {
                if (pode) {
                  expect(res.status, 'Com a 621 a conclusão manual passa').to.eq(200);
                  expect(res.body.id, 'Devolve a fórmula concluída').to.eq(formulaConcluivelId);
                } else {
                  validar403Autorizacao(res, 'Concluir à mão com dose fora do intervalo');
                  formulaDaReceita(formulaConcluivelId).then((depois) => {
                    expect(depois.calculated, 'A recusa não conclui a fórmula').to.eq(false);
                  });
                }
              });
            });
          });
        });
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 64: BUSCA DE PRODUTOS SEM DISTINGUIR ACENTO (ISSUE BACKEND#661, PR #713)
  // ---------------------------------------------------------------------------
  context('20. Busca de Produtos da Receita sem Distinguir Acento nem Caixa, nos Modos containing e starting (Issue backend#661/PR #713)', () => {

    // Subissue da #649. `GET /products?usage=&mode=&q=` comparava o nome dentro da procedure MOV_ATENDIMENTO_PRODUTOS (`NOME_INICIAL_IP`) sem `COLLATE`: `passiflóra` não achava
    // `PASSIFLORA EXTRATO SECO`. A #628 tinha tornado as outras buscas insensíveis a acento e deixado esta pendente. O script v014 (v016 na rotina de atualização) põe `COLLATE WIN_PTBR`
    // nos dois modos; o código da API não muda. Efeito colateral aceito: a procedure é compartilhada, então o desktop também ignora acento e o `starting` deixa de diferenciar caixa.
    // Medido na dev em 2026-10-19: `containing` com `passiflora`, `passiflóra`, `PASSIFLORA` e `Passiflóra` → os mesmos 7 produtos; `starting` → os mesmos 6; `solução` e `solucao` → 67.
    // Só vale onde o script foi aplicado (a dev; os bancos dos clientes recebem depois da pharmacie-script-runner-aws #31), por isso a massa tem precondição 🔒. Só leitura.
    // Fora do teste: o limite de tempo (até 10% acima do atual) é medida de desempenho com muito ruído de rede, sem asserção (a PR relata 339 ms contra 357 ms de uma consulta vazia).
    const TIMEOUT_ROTA = { timeout: 90000 };
    const VARIACOES = ['passiflora', 'passiflóra', 'PASSIFLORA', 'Passiflóra'];
    const PRODUTO_DA_ISSUE = 'PASSIFLORA EXTRATO SECO';
    const idsOrdenados = (itens) => itens.map((i) => i.id).sort((a, b) => a - b);
    const buscar = (mode, q) => api.listarProdutos(storeId, { usage: 'human', mode, q }, TIMEOUT_ROTA).then((res) => {
      expect(res.status, `Status da busca de produtos mode=${mode} q=${q}`).to.eq(200);
      expect(res.body.items, `Itens de mode=${mode} q=${q}`).to.be.an('array');
      return res.body.items;
    });

    // Consulta cada variação (em sequência) e exige os mesmos produtos que a primeira, que não pode vir vazia
    const compararVariacoesDeProduto = (mode, variacoes) => {
      const resultados = [];
      const encadear = (i) => {
        if (i >= variacoes.length) return cy.wrap(resultados, { log: false });
        return buscar(mode, variacoes[i]).then((itens) => { resultados.push({ termo: variacoes[i], itens }); return encadear(i + 1); });
      };
      return encadear(0).then((lista) => {
        const [base, ...demais] = lista;
        expect(base.itens.length, `🔒 massa: mode=${mode} deve achar ao menos 1 produto para "${base.termo}"`).to.be.at.least(1);
        demais.forEach((r) => {
          expect(idsOrdenados(r.itens), `mode=${mode}: "${r.termo}" deve trazer os mesmos produtos que "${base.termo}" (antes da PR #713 o termo com acento não achava nada)`).to.deep.eq(idsOrdenados(base.itens));
        });
        return base.itens;
      });
    };

    it('20.1 Deve achar os mesmos produtos no modo containing com e sem acento e em qualquer caixa, incluindo o produto da issue', () => {
      compararVariacoesDeProduto('containing', VARIACOES).then((itens) => {
        expect(itens.map((i) => i.name), `🔒 massa: produto "${PRODUTO_DA_ISSUE}" na dev`).to.include(PRODUTO_DA_ISSUE);
      });
    });

    it('20.2 Deve achar os mesmos produtos no modo starting com e sem acento e em qualquer caixa, sempre dentro do resultado do modo containing', () => {
      compararVariacoesDeProduto('starting', VARIACOES).then((iniciando) => {
        buscar('containing', 'passiflóra').then((contendo) => {
          const ids = idsOrdenados(contendo);
          iniciando.forEach((p) => expect(ids, `produto ${p.id} achado no starting também aparece no containing`).to.include(p.id));
          expect(iniciando.length, 'starting nunca traz mais que containing').to.be.at.most(contendo.length);
        });
      });
    });

    it('20.3 Deve achar os mesmos produtos com o acento em outra palavra (solução e solucao) no modo containing', () => {
      compararVariacoesDeProduto('containing', ['solucao', 'solução', 'SOLUÇÃO']);
    });

    it('20.4 Deve manter o formato do item e responder 401 sem token na busca de produtos', () => {
      buscar('containing', 'passiflóra').then((itens) => {
        itens.forEach((item) => {
          expect(item, `Chaves do produto ${item.id}`).to.include.keys('id', 'name', 'primary_code', 'unit', 'sale_value', 'cost_value');
          expect(item.id, 'id').to.be.a('number');
          expect(item.name, 'name').to.be.a('string').and.not.be.empty;
        });
      });
      api.listarProdutos(storeId, { usage: 'human', mode: 'containing', q: 'passiflora' }, { headers: { Authorization: '' }, ...TIMEOUT_ROTA }).then((res) => {
        expect(res.status, 'Status sem token').to.eq(401);
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 65: LEITURA DOS ITENS CONTROLADOS SERVE O RETORNO E O CID DA FÓRMULA QUANDO A LINHA NÃO OS TEM (Issue backend#711/PR #727)
  // ---------------------------------------------------------------------------
  context('21. Leitura dos Itens Controlados Serve o Retorno e o CID da Fórmula quando a Linha não os Tem (Issue backend#711/PR #727)', () => {

    // Subissue da #649, achada na revisão da #227. A rota da fórmula e o desktop gravam retorno e CID só na fórmula (`ATENDIMENTO_A2`), mas a leitura mostrava os da linha (`ATENDIMENTO_A3`),
    // vazios na maioria das receitas. A PR #727 faz a leitura (`GET /prescriptions/:id/controlled-items`) servir o valor da fórmula quando a linha não tem; o da linha, quando existe, vence.
    // Medido na API real em 2026-10-20: a receita 260102732 do dev serve o retorno 2026-03-18; em receita própria, retorno e CID gravados só na fórmula aparecem na linha, cada um por si.
    // Receita não tem DELETE: roda numa receita temporária própria por rodada, no tenant dev (mesmo padrão dos ctx 7, 11, 13 e 15). Retorno e CID entram pelo PATCH da fórmula (grant 449) ANTES do cálculo:
    // o PATCH tira o cálculo da fórmula e a linha controlada só aparece na leitura com a fórmula calculada.
    // Fora do teste: o reenvio do que a leitura serviu e a linha com valor próprio diferente da fórmula (cenários 3 e 6) estão no ctx 14 (`#14.12`-`#14.14`), porque nascem pela autorização;
    // o `403` de quem não tem a 449 (cenários 4 e 5) exige uma conta sem esse grant, que o `env.json` não tem (`ROADMAP.md` P1-47).
    const PRODUTO_CODIGO_3 = 1002096; // PURO CLONAZEPAM, portaria 344 (lista B1)
    const PRODUTO_CODIGO_1 = 1000842; // FOSFATO DE CODEINA, lista A2
    const PRODUTO_CODIGO_0 = 1001889; // BUPROPIONA, lista C1
    const PRESCRITOR_ID = 18780;
    const CID_FORMULA_COMPLETA = 'F10.2';
    const CID_FORMULA_SO_CID = 'G40.9';

    const dataRelativa = (dias) => {
      const d = new Date();
      d.setDate(d.getDate() + dias);
      return d.toISOString().slice(0, 10);
    };
    const RETORNO_COMPLETA = dataRelativa(30);
    const RETORNO_SO_RETORNO = dataRelativa(45);

    let prescricaoId;

    // O PATCH vai antes do cálculo, senão a fórmula perde o cálculo e a linha some da leitura
    const novaFormula = (numero, productId, patch) => api.criarFormulaPrescricao(storeId, prescricaoId, {
      formula_number: numero, pharmaceutical_form_id: 2, lab_id: 2, qvd: 30.0, multiplier: 1,
    }).then((resF) => {
      expect(resF.status, `Status da criação da fórmula ${numero}`).to.eq(201);
      const formulaId = resF.body.id;
      return api.adicionarProdutoFormula(storeId, prescricaoId, formulaId, { product_id: productId, quantity: 1, unit: 'g' }).then((resA) => {
        expect(resA.status, `Status do produto ${productId} na fórmula ${numero}`).to.be.oneOf([200, 201]);
        return api.atualizarFormulaPrescricao(storeId, prescricaoId, formulaId, patch).then((resP) => {
          expect(resP.status, `Status do PATCH da fórmula ${numero} (retorno exige o grant 449)`).to.eq(200);
          expect(resP.body, `Fórmula ${numero} com o que o PATCH gravou`).to.include(patch);
        });
      }).then(() => api.calcularFormula(storeId, prescricaoId, formulaId)).then((resC) => {
        expect(resC.status, `Status do cálculo da fórmula ${numero}`).to.eq(200);
      });
    });

    const lerItens = () => api.obterItensControladosReceita(prescricaoId).then((res) => {
      expect(res.status, 'Status da leitura dos itens controlados').to.eq(200);
      return res.body.items;
    });
    const itemDoProduto = (items, productId) => {
      const item = items.find((i) => i.product_id === productId);
      expect(item, `Item do produto ${productId} na leitura`).to.exist;
      return item;
    };
    const formulasGravadas = () => api.obterDetalhePrescricao(storeId, prescricaoId).then((res) => {
      expect(res.status, 'Status do detalhe da receita').to.eq(200);
      return res.body.formulas.map((f) => ({ formula_number: f.formula_number, return_date: f.return_date, cid_code: f.cid_code }));
    });

    before(() => {
      api.buscarClientes(storeId, configEnv.DEFAULT_CLIENT_NAME).then((resCli) => {
        const cliente = resCli.body?.items?.[0] || resCli.body?.[0];
        const clienteId = cliente?.id;
        expect(clienteId, '🔒 DEFAULT_CLIENT_NAME não achou cliente (massa)').to.be.ok;
        const nome = cliente.name;
        api.criarPrescricao(storeId, {
          prescription_type: 'human',
          status: 0,
          sale_type: 1,
          patient_id: clienteId,
          patient_name: nome,
          buyer_id: clienteId,
          buyer_name: nome,
          prescriber_id: PRESCRITOR_ID,
          pickup_store_id: storeId,
        }).then((res) => {
          expect(res.status, 'Status da criação da receita de teste').to.eq(201);
          prescricaoId = res.body.id;
          // Fórmula 1: retorno e CID; fórmula 2: só retorno; fórmula 3: só CID. Nenhuma linha foi autorizada, então nenhuma tem valor próprio.
          novaFormula(1, PRODUTO_CODIGO_3, { return_date: RETORNO_COMPLETA, cid_code: CID_FORMULA_COMPLETA });
          novaFormula(2, PRODUTO_CODIGO_1, { return_date: RETORNO_SO_RETORNO });
          novaFormula(3, PRODUTO_CODIGO_0, { cid_code: CID_FORMULA_SO_CID });
        });
      });
    });

    it('21.1 deve servir na leitura o retorno e o CID da fórmula nas linhas que não têm os seus, cada campo por si (só retorno, só CID, os dois)', () => {
      lerItens().then((items) => {
        expect(items, 'Os 3 itens controlados das 3 fórmulas calculadas').to.have.length(3);
        expect(itemDoProduto(items, PRODUTO_CODIGO_3), 'Fórmula com retorno e CID').to.include({ return_date: RETORNO_COMPLETA, cid: CID_FORMULA_COMPLETA });
        expect(itemDoProduto(items, PRODUTO_CODIGO_1), 'Fórmula só com retorno: o CID segue vazio').to.include({ return_date: RETORNO_SO_RETORNO, cid: null });
        expect(itemDoProduto(items, PRODUTO_CODIGO_0), 'Fórmula só com CID: o retorno segue vazio').to.include({ return_date: null, cid: CID_FORMULA_SO_CID });
        items.forEach((item) => {
          // O que o receituário ainda exige não muda por causa do fallback
          expect(item.prescription_date, `Data do receituário do produto ${item.product_id}`).to.eq(null);
          expect(item.prescription_checked, `Receituário conferido do produto ${item.product_id}`).to.eq(false);
        });
      });
    });

    it('21.2 deve manter a fórmula intacta na leitura: duas leituras iguais e o retorno e o CID da fórmula continuam os mesmos', () => {
      const esperadas = [
        { formula_number: 1, return_date: RETORNO_COMPLETA, cid_code: CID_FORMULA_COMPLETA },
        { formula_number: 2, return_date: RETORNO_SO_RETORNO, cid_code: null },
        { formula_number: 3, return_date: null, cid_code: CID_FORMULA_SO_CID },
      ];
      formulasGravadas().then((antes) => {
        expect(antes, 'Fórmulas como o PATCH gravou').to.deep.eq(esperadas);
        lerItens().then((primeira) => {
          lerItens().then((segunda) => {
            expect(segunda, 'A leitura repetida devolve os mesmos itens').to.deep.eq(primeira);
          });
        });
        formulasGravadas().then((depois) => {
          expect(depois, 'A leitura não grava na fórmula').to.deep.eq(esperadas);
        });
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 67: TAMANHO MÁXIMO DOS CAMPOS DE TEXTO DO CABEÇALHO DA RECEITA (Issue backend#702)
  // ---------------------------------------------------------------------------
  context('22. Tamanho Máximo dos Campos de Texto do Cabeçalho da Receita (rg_ie, issuing_body, issuing_body_uf e observation) na Criação e no PATCH (Issue backend#702)', () => {

    // Subissue da #649, achada na #655. O POST e o PATCH da receita não conferiam a largura dos 4 campos de texto do cabeçalho: acima da coluna o driver recusava
    // (Data truncation) e a API respondia 500, o mesmo defeito que a #637 corrigiu nos campos da fórmula (ctx 7). Agora, acima do máximo, responde 422
    // "O campo <campo> deve ter no máximo <n> caracteres." e nada é gravado.
    // Máximos do dev (19/10/2026): rg_ie 20, issuing_body 10, issuing_body_uf 2 e observation 7000. A issue lista `issuing_body` com 20 (largura da coluna
    // `ORGAOEXPEDIDOR`), mas o dev fixou 10 porque o banco guarda só os 10 primeiros caracteres (mesmo limite da autorização de controlados): vale o do dev, o #22.6 prova o 20.
    // Receita não tem DELETE: tudo roda numa receita temporária própria (mesmo padrão dos ctx 7 e 13), mais 1 criada no limite pelo #22.4, sem tocar em receita real.
    // As recusas não mudam nada, então o teste confere que os campos e o `updated_at` continuam idênticos. O POST recusado não tem como provar "nada criado"
    // (sem DELETE nem contagem estável no tenant): prova que não devolve id.
    const TIMEOUT_ROTA = { timeout: 90000 };
    const LIMITES = { rg_ie: 20, issuing_body: 10, issuing_body_uf: 2, observation: 7000 };
    const CAMPOS = Object.keys(LIMITES);
    const msgExcedido = (campo) => `O campo ${campo} deve ter no máximo ${LIMITES[campo]} caracteres.`;
    const textoDe = (tamanho, letra = 'X') => letra.repeat(tamanho);

    let corpoBase = null;
    let prescricaoId = null;

    const detalhe = (id = prescricaoId) => api.obterDetalhePrescricao(storeId, id, TIMEOUT_ROTA).then((det) => {
      expect(det.status, `Status do detalhe da receita #${id}`).to.eq(200);
      return det.body;
    });
    const camposDaReceita = (corpo) => CAMPOS.reduce((acc, campo) => ({ ...acc, [campo]: corpo[campo] }), { updated_at: corpo.updated_at });
    const alterar = (corpo) => api.atualizarPrescricao(storeId, prescricaoId, corpo, TIMEOUT_ROTA);
    const exigirRecusa = (res, campo, rotulo) => {
      expect(res.status, `Status de ${rotulo} (antes da correção: 500 por Data truncation)`).to.eq(422);
      expect(res.body.message, `Mensagem de ${rotulo}`).to.eq(msgExcedido(campo));
    };

    before(() => {
      // Cliente padrão do env.json (R-POM) como paciente e comprador da receita temporária
      api.buscarClientes(storeId, configEnv.DEFAULT_CLIENT_NAME).then((resCli) => {
        const cliente = (resCli.body && (resCli.body.items || resCli.body))[0];
        expect(cliente && cliente.id, '🔒 DEFAULT_CLIENT_NAME não achou cliente (massa)').to.be.ok;
        corpoBase = {
          prescription_type: 'human',
          status: 0,
          sale_type: 1,
          patient_id: cliente.id,
          patient_name: cliente.name,
          buyer_id: cliente.id,
          buyer_name: cliente.name,
          prescriber_id: 18780,
          pickup_store_id: storeId,
        };
        api.criarPrescricao(storeId, corpoBase, TIMEOUT_ROTA).then((resPresc) => {
          expect(resPresc.status, 'Status da criação da receita temporária').to.be.oneOf([200, 201]);
          prescricaoId = resPresc.body.id || resPresc.body.prescription_id;
          expect(prescricaoId, 'ID da receita temporária').to.be.ok;
        });
      });
    });

    it('22.1 Deve recusar com 422 a criação de receita com campo de texto 1 caractere acima do máximo, sem devolver id e sem responder 500', () => {
      CAMPOS.forEach((campo) => {
        api.criarPrescricao(storeId, { ...corpoBase, [campo]: textoDe(LIMITES[campo] + 1) }, TIMEOUT_ROTA).then((res) => {
          exigirRecusa(res, campo, `criação com ${campo} de ${LIMITES[campo] + 1} caracteres`);
          expect(res.body.id || res.body.prescription_id, `Receita não pode ser criada com ${campo} acima do máximo`).to.be.undefined;
        });
      });
    });

    it('22.2 Deve recusar com 422 o PATCH da receita com campo de texto 1 caractere acima do máximo e deixar campos e updated_at como estavam', () => {
      detalhe().then((antes) => {
        CAMPOS.forEach((campo) => {
          alterar({ [campo]: textoDe(LIMITES[campo] + 1) }).then((res) => {
            exigirRecusa(res, campo, `PATCH com ${campo} de ${LIMITES[campo] + 1} caracteres`);
          });
        });
        detalhe().then((depois) => {
          expect(camposDaReceita(depois), 'Receita idêntica depois das recusas').to.deep.eq(camposDaReceita(antes));
        });
      });
    });

    it('22.3 Deve aceitar e gravar por inteiro no PATCH os 4 campos de texto com exatamente o máximo', () => {
      const noLimite = Object.fromEntries(Object.entries(LIMITES).map(([campo, max]) => [campo, textoDe(max, 'L')]));
      alterar(noLimite).then((res) => {
        expect(res.status, 'Status do PATCH com os 4 campos no máximo').to.eq(200);
      });
      detalhe().then((det) => {
        CAMPOS.forEach((campo) => {
          expect(String(det[campo]).length, `${campo} gravado por inteiro (${LIMITES[campo]} caracteres)`).to.eq(LIMITES[campo]);
        });
      });
    });

    it('22.4 Deve aceitar e gravar por inteiro na criação os 4 campos de texto com exatamente o máximo', () => {
      const noLimite = Object.fromEntries(Object.entries(LIMITES).map(([campo, max]) => [campo, textoDe(max, 'C')]));
      api.criarPrescricao(storeId, { ...corpoBase, ...noLimite }, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status da criação com os 4 campos no máximo').to.be.oneOf([200, 201]);
        const idCriada = res.body.id || res.body.prescription_id;
        expect(idCriada, 'ID da receita criada no máximo').to.be.ok;
        detalhe(idCriada).then((det) => {
          CAMPOS.forEach((campo) => {
            expect(String(det[campo]).length, `${campo} gravado por inteiro pelo POST (${LIMITES[campo]} caracteres)`).to.eq(LIMITES[campo]);
          });
        });
      });
    });

    it('22.5 Deve recusar o PATCH inteiro, sem gravar o campo válido, quando um dos campos enviados passa do máximo', () => {
      detalhe().then((antes) => {
        alterar({ observation: 'NAO DEVE GRAVAR', rg_ie: textoDe(LIMITES.rg_ie + 1) }).then((res) => {
          exigirRecusa(res, 'rg_ie', 'PATCH com observação válida e rg_ie acima do máximo');
        });
        detalhe().then((depois) => {
          expect(camposDaReceita(depois), 'Nenhum campo gravado quando um deles é recusado').to.deep.eq(camposDaReceita(antes));
        });
      });
    });

    it('22.6 Deve recusar o issuing_body de 20 caracteres (a largura da coluna na issue): o máximo do dev é 10, porque o banco guarda só os 10 primeiros', () => {
      alterar({ issuing_body: textoDe(20) }).then((res) => {
        exigirRecusa(res, 'issuing_body', 'PATCH com issuing_body de 20 caracteres');
      });
      api.criarPrescricao(storeId, { ...corpoBase, issuing_body: textoDe(20) }, TIMEOUT_ROTA).then((res) => {
        exigirRecusa(res, 'issuing_body', 'criação com issuing_body de 20 caracteres');
      });
    });

    it('22.7 Deve contar o tamanho em caracteres e não em bytes: 20 acentuados no rg_ie aceitos e 21 recusados', () => {
      const vinte = 'ç'.repeat(20); // 20 caracteres, 40 bytes em UTF-8
      const vinteEUm = 'ç'.repeat(21);
      alterar({ rg_ie: vinteEUm }).then((res) => {
        exigirRecusa(res, 'rg_ie', 'PATCH com 21 acentuados em rg_ie');
      });
      alterar({ rg_ie: vinte }).then((res) => {
        expect(res.status, 'Status do PATCH com 20 acentuados (se 500, a coluna conta bytes e o limite em caracteres engana)').to.eq(200);
      });
      detalhe().then((det) => {
        expect(det.rg_ie, 'os 20 acentuados gravados sem perda').to.eq(vinte);
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 68: CALCULAR A FÓRMULA GRAVA A OBSERVAÇÃO DO SISTEMA (Issue backend#704/PR #726)
  // ---------------------------------------------------------------------------
  context('23. Calcular a Fórmula Grava a Observação do Sistema em system_observation, como o Desktop (Issue backend#704/PR #726)', () => {

    // Subissue da #649, achada na #657. O `POST .../formulas/:id/calculate` lia `OBSERVACAOSISTEMA_OP` da `MOV_ATENDIMENTO_CALC1` só para detectar erro e nunca gravava o texto em `ATENDIMENTO_A2.OBSERVACAOSISTEMA`.
    // A PR #726 grava o texto que a procedure devolve (volume, avisos de quantidade fora das especificações, portarias dos controlados, ficha de pesagem, lotes vencidos e fotossensíveis) e o `GET /prescriptions/:id` o serve em `system_observation` da fórmula.
    // Medido na API real em 2026-10-20 (receita própria): o texto começa com `Volume:<n>` seguido de `\r`; o aviso sai como `*** <produto> com quantidade acima das especificações ***` (o nome sai abreviado, `PASSIFLORA EXTRATO` e não `PASSIFLORA EXTRATO SECO`);
    // o controlado traz a portaria (`CLONAZEPAM(PURO) PORTARIA 344 (LISTA B1)`); o resto do texto é a base e as observações do cadastro, por isso as asserções olham o começo e as frases da issue, não o texto inteiro.
    // O cálculo RECRIA as linhas do produto com ids novos: o id do produto para o `PATCH` tem de ser relido depois de cada cálculo. O `PATCH` do produto ignora `product_id` (200 e mantém o produto), então "trocar o produto" é provado mudando a quantidade.
    // Dose fora do intervalo no cálculo exige o grant 621 (ctx 19); a conta de teste tem. A tela de Receitas não mostra o texto: a aba "Obs. Sistema" é um placeholder vazio (`ROADMAP.md` P2-29).
    // Receita não tem DELETE: roda numa receita temporária própria por rodada, no tenant dev (mesmo padrão dos ctx 7, 11, 13, 15 e 21).
    const TIMEOUT_ROTA = { timeout: 90000 };
    const PASSIFLORA_EXTRATO = 1004866; // máximo ligado, em mg (o exemplo da issue backend#657)
    const NALTREXONA = 1003180; // mínimo ligado, em mg
    const PURO_CLONAZEPAM = 1002096; // controlado, portaria 344 (lista B1)
    const PRESCRITOR_ID = 18780;
    const COMECO_DO_TEXTO = /^Volume:\d+\.\d{4}\r/;
    const AVISO_ACIMA = /\*\*\* .+ com quantidade acima das especificações \*\*\*/;
    const AVISO_ABAIXO = /\*\*\* .+ com quantidade abaixo das especificações \*\*\*/;

    // Fórmula 1: dentro do intervalo · 2: acima do máximo · 3: controlado · 4: abaixo do mínimo · 5: para recalcular · 6: nunca calculada
    const F = { dentro: 1, acima: 2, controlado: 3, abaixo: 4, recalculo: 5, semCalculo: 6 };

    let prescricaoId;
    let maximo;
    let minimo;
    const formulaId = {};
    let observacoesAntesDoCalculo;

    const produtoDaLinha = (id, quantity, unit) => ({ product_id: id, quantity, unit });
    const novaFormula = (nome, produto) => api.criarFormulaPrescricao(storeId, prescricaoId, {
      formula_number: F[nome], pharmaceutical_form_id: 2, lab_id: 2, qvd: 30.0, multiplier: 1,
    }, TIMEOUT_ROTA).then((resF) => {
      expect(resF.status, `Status da criação da fórmula ${nome}`).to.eq(201);
      formulaId[nome] = resF.body.id;
      return api.adicionarProdutoFormula(storeId, prescricaoId, formulaId[nome], produto, TIMEOUT_ROTA).then((resA) => {
        expect(resA.status, `Status do produto da fórmula ${nome}`).to.be.oneOf([200, 201]);
      });
    });

    const formulasDaReceita = () => api.obterDetalhePrescricao(storeId, prescricaoId, TIMEOUT_ROTA).then((res) => {
      expect(res.status, 'Status do detalhe da receita').to.eq(200);
      return res.body.formulas;
    });
    const observacaoDe = (nome) => formulasDaReceita().then((formulas) => {
      const formula = formulas.find((f) => f.formula_number === F[nome]);
      expect(formula, `Fórmula ${nome} no detalhe da receita`).to.exist;
      return formula.system_observation;
    });
    // O cálculo recria as linhas: o id do produto só vale depois do último cálculo
    const alterarQuantidade = (nome, quantity) => formulasDaReceita().then((formulas) => {
      const formula = formulas.find((f) => f.formula_number === F[nome]);
      const linha = formula.products.find((p) => p.product_id === PASSIFLORA_EXTRATO);
      return api.atualizarProdutoFormula(storeId, prescricaoId, formulaId[nome], linha.id, { quantity, unit: 'mg' }, TIMEOUT_ROTA).then((res) => {
        expect(res.status, `Status do PATCH da quantidade da fórmula ${nome}`).to.eq(200);
      });
    });
    const recalcular = (nome) => api.calcularFormula(storeId, prescricaoId, formulaId[nome], TIMEOUT_ROTA).then((res) => {
      expect(res.status, `Status do cálculo da fórmula ${nome} (dose fora do intervalo exige o grant 621)`).to.eq(200);
    });
    const ocorrencias = (texto, trecho) => texto.split(trecho).length - 1;

    before(() => {
      ['PASSIFLORA', 'NALTREXONA'].forEach((q) => {
        api.listarProdutos(storeId, { usage: 'human', q, limit: 10 }).then((res) => {
          const p = (res.body?.items || []).find((i) => i.id === (q === 'PASSIFLORA' ? PASSIFLORA_EXTRATO : NALTREXONA));
          expect(p, `🔒 produto ${q} no catálogo`).to.be.ok;
          if (q === 'PASSIFLORA') {
            expect(p.check_max, '🔒 CHECARMAX ligado na PASSIFLORA').to.eq(true);
            expect(p.max_unit, '🔒 unidade do máximo da PASSIFLORA').to.eq('mg');
            maximo = Number(p.max_quantity);
          } else {
            expect(p.check_min, '🔒 CHECARMIN ligado na NALTREXONA').to.eq(true);
            expect(p.min_unit, '🔒 unidade do mínimo da NALTREXONA').to.eq('mg');
            minimo = Number(p.min_quantity);
          }
        });
      });
      api.buscarClientes(storeId, configEnv.DEFAULT_CLIENT_NAME).then((resCli) => {
        const cliente = resCli.body?.items?.[0] || resCli.body?.[0];
        const clienteId = cliente?.id;
        expect(clienteId, '🔒 DEFAULT_CLIENT_NAME não achou cliente (massa)').to.be.ok;
        const nome = cliente.name;
        api.criarPrescricao(storeId, {
          prescription_type: 'human',
          status: 0,
          sale_type: 1,
          patient_id: clienteId,
          patient_name: nome,
          buyer_id: clienteId,
          buyer_name: nome,
          prescriber_id: PRESCRITOR_ID,
          pickup_store_id: storeId,
        }, TIMEOUT_ROTA).then((res) => {
          expect(res.status, 'Status da criação da receita de teste').to.eq(201);
          prescricaoId = res.body.id;
        });
      });
      cy.then(() => novaFormula('dentro', produtoDaLinha(PASSIFLORA_EXTRATO, maximo, 'mg')));
      cy.then(() => novaFormula('acima', produtoDaLinha(PASSIFLORA_EXTRATO, maximo + 1, 'mg')));
      cy.then(() => novaFormula('controlado', produtoDaLinha(PURO_CLONAZEPAM, 1, 'g')));
      cy.then(() => novaFormula('abaixo', produtoDaLinha(NALTREXONA, Number((minimo - 0.01).toFixed(2)), 'mg')));
      cy.then(() => novaFormula('recalculo', produtoDaLinha(PASSIFLORA_EXTRATO, maximo + 1, 'mg')));
      cy.then(() => novaFormula('semCalculo', produtoDaLinha(PASSIFLORA_EXTRATO, maximo + 1, 'mg')));
      cy.then(() => formulasDaReceita()).then((formulas) => {
        observacoesAntesDoCalculo = formulas.map((f) => f.system_observation);
      });
      // Calcula as 5 primeiras; a 6ª nunca é calculada (controle da prévia)
      ['dentro', 'acima', 'controlado', 'abaixo', 'recalculo'].forEach((nome) => {
        cy.then(() => recalcular(nome));
      });
    });

    it('23.1 deve gravar ao calcular a fórmula simples a observação do sistema começando com Volume:, que antes do cálculo estava vazia, e servi-la no GET da receita (sem aviso de quantidade dentro do intervalo)', () => {
      expect(observacoesAntesDoCalculo, 'Antes do cálculo nenhuma fórmula tem observação do sistema').to.deep.eq(Array(6).fill(null));
      observacaoDe('dentro').then((texto) => {
        expect(texto, 'Observação gravada').to.be.a('string').and.match(COMECO_DO_TEXTO);
        expect(texto, 'Dentro do intervalo não há aviso de quantidade').to.not.include('especificações');
      });
    });

    it('23.2 deve gravar o aviso de quantidade acima das especificações e o de abaixo, cada um na sua fórmula', () => {
      observacaoDe('acima').then((texto) => {
        expect(texto, 'Começo da observação da fórmula acima do máximo').to.match(COMECO_DO_TEXTO);
        expect(texto, 'Aviso de quantidade acima').to.match(AVISO_ACIMA);
        expect(texto, 'Sem o aviso de abaixo').to.not.match(AVISO_ABAIXO);
      });
      observacaoDe('abaixo').then((texto) => {
        expect(texto, 'Começo da observação da fórmula abaixo do mínimo').to.match(COMECO_DO_TEXTO);
        expect(texto, 'Aviso de quantidade abaixo').to.match(AVISO_ABAIXO);
        expect(texto, 'Sem o aviso de acima').to.not.match(AVISO_ACIMA);
      });
    });

    it('23.3 deve gravar a portaria do produto controlado na observação do sistema', () => {
      observacaoDe('controlado').then((texto) => {
        expect(texto, 'Começo da observação da fórmula controlada').to.match(COMECO_DO_TEXTO);
        expect(texto, 'Portaria do produto controlado').to.include('PORTARIA 344 (LISTA B1)');
        expect(texto, 'Dose dentro do intervalo, sem aviso de quantidade').to.not.include('especificações');
      });
    });

    it('23.4 deve substituir o texto ao recalcular, sem acumular o anterior: o aviso some com a dose dentro do intervalo e volta, uma só vez, com a dose fora', () => {
      observacaoDe('recalculo').then((antes) => {
        expect(antes, 'Antes de mexer: aviso de acima, um só Volume:').to.match(AVISO_ACIMA);
        expect(ocorrencias(antes, 'Volume:'), 'Um só Volume: na primeira observação').to.eq(1);
        alterarQuantidade('recalculo', maximo).then(() => {
          recalcular('recalculo').then(() => {
            observacaoDe('recalculo').then((dentro) => {
              expect(dentro, 'Dose no máximo exato: recalcular tira o aviso').to.match(COMECO_DO_TEXTO).and.not.include('especificações');
              expect(dentro, 'O volume mudou com a dose').to.not.eq(antes);
              expect(ocorrencias(dentro, 'Volume:'), 'Um só Volume: depois do recálculo dentro').to.eq(1);
              alterarQuantidade('recalculo', maximo + 1).then(() => {
                recalcular('recalculo').then(() => {
                  observacaoDe('recalculo').then((fora) => {
                    expect(fora, 'Dose acima outra vez: o aviso volta').to.match(AVISO_ACIMA);
                    expect(ocorrencias(fora, 'Volume:'), 'Um só Volume: depois do segundo recálculo').to.eq(1);
                    expect(ocorrencias(fora, 'especificações'), 'Um só aviso, o do cálculo anterior não acumula').to.eq(1);
                  });
                });
              });
            });
          });
        });
      });
    });

    it('23.5 deve manter a prévia do cálculo sem gravar nada: a fórmula que nunca foi calculada segue sem observação do sistema', () => {
      api.preverCalculoFormula(storeId, {
        pharmaceutical_form_id: 2, qvd: 30.0, multiplier: 1, products: [produtoDaLinha(PASSIFLORA_EXTRATO, maximo + 1, 'mg')],
      }, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status da prévia').to.eq(200);
        expect(res.body.warnings.map((w) => w.code), 'A prévia avisa a dose fora do intervalo').to.include('out_of_range_dosage');
        expect(res.body, 'A prévia não traz a observação do sistema').to.not.have.property('system_observation');
      });
      observacaoDe('semCalculo').then((texto) => {
        expect(texto, 'A fórmula não calculada continua sem observação').to.eq(null);
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 24: LISTA DE RECEITAS DA LOJA (Issue backend#723/PR #749 e #750)
  // ---------------------------------------------------------------------------
  context('24. Lista de Receitas da Loja (GET /prescriptions/search): Escopo, Filtros, Busca, Janela de 90 Dias e Contadores por Faceta (Issue backend#723/PR #749 e #750)', () => {

    // Rota nova para a tela "Lista de receitas" do front (front#569), sem mudar `GET /prescriptions?filter=` nem `/me/prescription-stats`. Medido na API real em 2026-10-22 (dev, 1.972 receitas
    // nos últimos 90 dias na loja 1): `items` (id, client_id, client_name, animal_id, animal_name, prescriber_id, prescriber_name, registered_at, status, sale_value_discounted), `pagination` e
    // `summary` (total, human, animal, open, awaiting_delivery, delivered, discarded) no mesmo payload. Status derivado da receita: `open` (STATUS_MOV 0), `awaiting_delivery` (STATUS_MOV -1 sem
    // entrega), `delivered` e `discarded` (DESCARTE_CF, com precedência). Contadores por faceta: os de status respeitam `q` e `type`, os de tipo respeitam `q` e `status`, o `total` respeita `q`.
    // Janela: corte padrão de 90 dias sobre CADASTRO_DT; `from`/`to` opcionais, intervalo de até 89 dias de diferença (90 dias de diferença já responde 422 "Período inválido.").
    // Gate: grant 145, exposto como `can_list_recipes` em `GET /prescription-capabilities`. A conta de teste tem o grant, então o 403 PERMISSION_DENIED não é alcançável (`[R-CAPXACAO]`,
    // `ROADMAP.md` P1-49), e a exclusão de receita de outra loja só se prova com massa da loja 2 (24.17 prova que o que aparece é da loja da sessão). Só leitura: não grava nada, sem massa própria.
    const TIMEOUT_ROTA = { timeout: 90000 };
    const STATUS_DA_RECEITA = ['open', 'awaiting_delivery', 'delivered', 'discarded'];
    const CHAVES_DO_ITEM = ['id', 'client_id', 'client_name', 'animal_id', 'animal_name', 'prescriber_id', 'prescriber_name', 'registered_at', 'status', 'sale_value_discounted'];
    const CHAVES_DO_RESUMO = ['total', 'human', 'animal', ...STATUS_DA_RECEITA];
    const DIA_EM_MS = 24 * 60 * 60 * 1000;

    const buscar = (qs = {}, options = {}) => api.buscarReceitasDaLoja(storeId, qs, { ...TIMEOUT_ROTA, ...options });
    const buscarOk = (qs = {}, rotulo = 'Busca') => buscar(qs).then((res) => {
      expect(res.status, `${rotulo}: status`).to.eq(200);
      return res.body;
    });
    const diasAtras = (n) => new Date(Date.now() - n * DIA_EM_MS).toISOString().slice(0, 10);
    const somaDosStatus = (resumo) => STATUS_DA_RECEITA.reduce((total, chave) => total + resumo[chave], 0);
    const semAcento = (texto) => String(texto || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const instantes = (itens) => itens.map((item) => new Date(item.registered_at).getTime());
    const naoCrescente = (lista) => lista.every((valor, i) => i === 0 || valor <= lista[i - 1]);
    const naoDecrescente = (lista) => lista.every((valor, i) => i === 0 || valor >= lista[i - 1]);
    const validar422 = (res, mensagem, rotulo) => {
      expect(res.status, `${rotulo}: status`).to.eq(422);
      expect(res.body.message, `${rotulo}: mensagem`).to.eq(mensagem);
      expect(res.body, `${rotulo}: não traz lista`).to.not.have.property('items');
    };

    // Massa dos casos raros (receita descartada, aberta de animal) sai da janela padrão de 90 dias com o tempo, e não há rota para descartar receita
    // (ROADMAP.md P1-49). `from`/`to` aceitam janela antiga (medido em 2026-11-06: 2 a 22 descartadas por bloco de 89 dias no último ano), então
    // procura-se a janela mais recente que tenha o caso: a padrão primeiro, depois blocos de 89 dias recuando até ~1 ano. Devolve os parâmetros
    // da janela ({} = padrão) ou null quando nenhuma tem; aí o teste pula com o motivo ([R-ATEMPORAL]).
    const BLOCOS_ANTERIORES = 4;
    const janelaCom = (qs, chaveDoResumo) => {
      const tentar = (k) => {
        if (k > BLOCOS_ANTERIORES) return cy.wrap(null, { log: false });
        const janela = k === 0 ? {} : { from: diasAtras(89 * k + 89), to: diasAtras(89 * k) };
        return buscarOk({ ...qs, ...janela, per_page: 1 }, `Procura de massa (${chaveDoResumo}), bloco ${k}`).then((body) => (
          body.summary[chaveDoResumo] > 0 ? cy.wrap(janela, { log: false }) : tentar(k + 1)
        ));
      };
      return tentar(0);
    };
    const pularSemMassa = (ctx, janela, motivo) => {
      if (janela) return false;
      cy.log(`🔒 sem massa: ${motivo}`);
      ctx.skip();
      return true;
    };

    before(() => {
      api.autenticar();
    });

    it('24.1 deve recusar sem token com 401, sem devolver nenhuma receita', () => {
      buscar({}, { headers: { Authorization: '' } }).then((res) => {
        expect(res.status, 'Status sem token').to.eq(401);
        expect(res.body, 'A recusa não traz lista').to.not.have.property('items');
        expect(res.body, 'A recusa não traz contadores').to.not.have.property('summary');
      });
    });

    it('24.2 deve manter o contrato de GET /prescriptions?filter= (200, items e pagination, sem summary)', () => {
      api.get('/prescriptions', { filter: 'today', per_page: 5 }, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status da listagem antiga').to.eq(200);
        expect(res.body, 'A listagem antiga continua com items').to.have.property('items');
        expect(res.body, 'A listagem antiga continua com pagination').to.have.property('pagination');
        expect(res.body, 'A listagem antiga não ganhou summary').to.not.have.property('summary');
      });
    });

    it('24.3 deve alinhar a capability can_list_recipes à rota: com a 145 responde 200, sem ela 403 PERMISSION_DENIED', () => {
      api.obterCapabilitiesReceitas(storeId).then((resCap) => {
        expect(resCap.status, 'Status das capabilities de receita').to.eq(200);
        const pode = resCap.body.capabilities.can_list_recipes;
        expect(pode, 'Capability do grant 145 (listar receitas)').to.be.a('boolean');
        buscar({ per_page: 1 }).then((res) => {
          expect(res.status, `Status da rota com can_list_recipes=${pode}`).to.eq(pode ? 200 : 403);
          expect(res.body.error_code || res.body.code, `Código da resposta com can_list_recipes=${pode}`).to.eq(pode ? undefined : 'PERMISSION_DENIED');
        });
      });
    });

    it('24.4 deve devolver items, pagination e summary no formato da tela, com os padrões page 1 e per_page 20', () => {
      buscarOk({}, 'Busca sem filtro').then((body) => {
        expect(Object.keys(body).sort(), 'Chaves do payload').to.deep.eq(['items', 'pagination', 'summary']);
        expect(body.pagination, 'Paginação padrão').to.include({ page: 1, per_page: 20, has_previous: false });
        expect(body.pagination.total_pages, 'Total de páginas').to.eq(Math.ceil(body.pagination.total / 20));
        expect(body.pagination.has_next, 'has_next').to.eq(body.pagination.total_pages > 1);
        expect(Object.keys(body.summary).sort(), 'Chaves dos contadores').to.deep.eq([...CHAVES_DO_RESUMO].sort());
        expect(body.items.length, '🔒 massa: a loja precisa ter receitas nos últimos 90 dias').to.be.greaterThan(0);
        expect(body.items.length, 'Itens da 1ª página').to.be.at.most(20);
        body.items.forEach((item) => {
          expect(Object.keys(item).sort(), `Chaves do item ${item.id}`).to.deep.eq([...CHAVES_DO_ITEM].sort());
          expect(item.id, 'id').to.be.a('number');
          expect(item.registered_at, `registered_at do item ${item.id} em Instant/Z`).to.match(/Z$/);
          expect(item.status, `status do item ${item.id}`).to.be.oneOf(STATUS_DA_RECEITA);
          expect(item.sale_value_discounted, `sale_value_discounted do item ${item.id}`).to.be.a('number');
          expect(item.prescriber_name, `prescriber_name do item ${item.id}`).to.be.a('string');
        });
        expect(body.summary.total, 'summary.total sem filtro').to.eq(body.pagination.total);
        expect(body.summary.human + body.summary.animal, 'human + animal = total').to.eq(body.summary.total);
        expect(somaDosStatus(body.summary), 'Soma dos status = total').to.eq(body.summary.total);
      });
    });

    it('24.5 deve ordenar da emissão mais recente para a mais antiga por padrão e cortar a lista em 90 dias', () => {
      buscarOk({ per_page: 100 }, 'Busca sem sort').then((body) => {
        expect(naoCrescente(instantes(body.items)), 'registered_at em ordem decrescente por padrão').to.eq(true);
        buscarOk({ per_page: 100, sort: 'desc' }, 'Busca com sort=desc').then((comSort) => {
          expect(naoCrescente(instantes(comSort.items)), 'sort=desc ordena do mais recente para o mais antigo').to.eq(true);
        });
        // A última página traz as receitas mais antigas da janela: nenhuma passa de 90 dias (com 1 dia de folga pelo fuso)
        buscarOk({ per_page: 100, page: body.pagination.total_pages }, 'Última página').then((ultima) => {
          const maisAntiga = Math.min(...instantes(ultima.items));
          expect(maisAntiga, 'A receita mais antiga da janela padrão').to.be.at.least(Date.now() - 91 * DIA_EM_MS);
        });
      });
    });

    it('24.6 deve ordenar da mais antiga para a mais recente com sort=asc', () => {
      buscarOk({ per_page: 100, sort: 'asc' }, 'Busca com sort=asc').then((crescente) => {
        expect(crescente.items.length, '🔒 massa: itens com sort=asc').to.be.greaterThan(1);
        expect(naoDecrescente(instantes(crescente.items)), 'registered_at em ordem crescente').to.eq(true);
        buscarOk({ per_page: 1 }, 'Busca padrão').then((padrao) => {
          expect(instantes(crescente.items)[0], 'O 1º do asc não é mais novo que o 1º do padrão').to.be.at.most(instantes(padrao.items)[0]);
        });
      });
    });

    it('24.7 deve paginar com page e per_page (máximo 100) e recusar valores fora do limite com 422', () => {
      buscarOk({ per_page: 5 }, 'Página 1').then((pagina1) => {
        expect(pagina1.items, 'Itens da página 1').to.have.length(5);
        expect(pagina1.pagination.total_pages, 'Total de páginas com per_page 5').to.eq(Math.ceil(pagina1.pagination.total / 5));
        buscarOk({ per_page: 5, page: 2 }, 'Página 2').then((pagina2) => {
          expect(pagina2.pagination, 'Paginação da página 2').to.include({ page: 2, per_page: 5, has_previous: true });
          const idsDaPagina1 = pagina1.items.map((i) => i.id);
          pagina2.items.forEach((item) => expect(idsDaPagina1, `Item ${item.id} da página 2 não repete a página 1`).to.not.include(item.id));
        });
      });
      buscarOk({ per_page: 100 }, 'per_page 100').then((cheia) => {
        expect(cheia.pagination.per_page, 'per_page máximo aceito').to.eq(100);
        expect(cheia.items.length, 'Itens com per_page 100').to.be.at.most(100);
      });
      [{ per_page: 101 }, { per_page: 0 }, { page: 0 }].forEach((qs) => {
        buscar(qs).then((res) => validar422(res, 'Parâmetros de paginação inválidos.', `Paginação ${JSON.stringify(qs)}`));
      });
    });

    it('24.8 deve recusar type, status e sort fora do conjunto com 422 e a mensagem do parâmetro', () => {
      buscar({ type: 'plant' }).then((res) => validar422(res, 'Tipo inválido.', 'type=plant'));
      buscar({ status: 'pending' }).then((res) => validar422(res, 'Status inválido.', 'status=pending (da fila de atendimento, não da receita)'));
      buscar({ sort: 'newest' }).then((res) => validar422(res, 'Ordenação inválida.', 'sort=newest'));
    });

    it('24.9 deve aceitar from e to até 89 dias de diferença e recusar 90 dias, from depois de to e data inválida com 422 "Período inválido."', () => {
      buscarOk({ from: diasAtras(89), to: diasAtras(0), per_page: 5 }, 'Período de 89 dias de diferença').then((body) => {
        expect(body.pagination.total, 'Total do período de 89 dias').to.be.greaterThan(0);
      });
      buscar({ from: diasAtras(90), to: diasAtras(0) }).then((res) => validar422(res, 'Período inválido.', 'Período de 90 dias de diferença'));
      buscar({ from: diasAtras(0), to: diasAtras(10) }).then((res) => validar422(res, 'Período inválido.', 'from depois de to'));
      buscar({ from: '2026-13-45', to: diasAtras(0) }).then((res) => validar422(res, 'Período inválido.', 'Data inválida'));
      buscarOk({ per_page: 1 }, 'Sem período').then((padrao) => {
        buscarOk({ from: diasAtras(30), per_page: 1 }, 'Só from').then((recorte) => {
          expect(recorte.pagination.total, 'Só `from` recorta a janela padrão').to.be.at.most(padrao.pagination.total);
          expect(recorte.summary.total, 'summary.total acompanha o recorte').to.eq(recorte.pagination.total);
        });
      });
    });

    it('24.10 deve filtrar por type e contar só aquele tipo nos contadores de status, sem mexer em human, animal e total', () => {
      ['animal', 'human'].forEach((tipo) => {
        buscarOk({ type: tipo, per_page: 100 }, `type=${tipo}`).then((body) => {
          expect(body.items.length, `🔒 massa: receitas do tipo ${tipo}`).to.be.greaterThan(0);
          body.items.forEach((item) => {
            expect(item.animal_id !== null, `Item ${item.id} com type=${tipo}: animal_id preenchido só no animal`).to.eq(tipo === 'animal');
          });
          expect(body.pagination.total, `pagination.total com type=${tipo}`).to.eq(body.summary[tipo]);
          expect(somaDosStatus(body.summary), `Os contadores de status contam só o tipo ${tipo}`).to.eq(body.summary[tipo]);
          expect(body.summary.human + body.summary.animal, 'human + animal segue igual a total').to.eq(body.summary.total);
        });
      });
    });

    it('24.11 deve filtrar por cada status e devolver só receitas daquele status, com pagination.total igual ao contador', function () {
      STATUS_DA_RECEITA.forEach((status) => {
        janelaCom({}, status).then((janela) => {
          if (pularSemMassa(this, janela, `nenhuma receita ${status} no último ano`)) return;
          buscarOk({ status, ...janela, per_page: 100 }, `status=${status} ${JSON.stringify(janela)}`).then((body) => {
            expect(body.pagination.total, `Receita ${status} na janela ${JSON.stringify(janela)}`).to.be.greaterThan(0);
            body.items.forEach((item) => expect(item.status, `Status do item ${item.id}`).to.eq(status));
            expect(body.pagination.total, `pagination.total com status=${status}`).to.eq(body.summary[status]);
            expect(body.summary.human + body.summary.animal, 'Os contadores de tipo contam só o status filtrado').to.eq(body.summary[status]);
            expect(somaDosStatus(body.summary), 'Os contadores de status ignoram o filtro de status').to.eq(body.summary.total);
          });
        });
      });
    });

    it('24.12 deve combinar status e type nos contadores por faceta (cada grupo respeita o outro filtro e ignora o próprio)', function () {
      janelaCom({ type: 'animal' }, 'open').then((janela) => {
        if (pularSemMassa(this, janela, 'nenhuma receita aberta de animal no último ano')) return;
        buscarOk({ type: 'animal', ...janela }, `type=animal ${JSON.stringify(janela)}`).then((soAnimal) => {
          buscarOk({ status: 'open', type: 'animal', ...janela, per_page: 100 }, 'status=open e type=animal').then((body) => {
            expect(body.pagination.total, `Receita aberta de animal na janela ${JSON.stringify(janela)}`).to.be.greaterThan(0);
            expect(body.pagination.total, 'pagination.total = abertas dos animais').to.eq(body.summary.open);
            expect(body.summary.animal, 'O contador animal respeita o status filtrado').to.eq(body.summary.open);
            expect(body.summary.human, 'O contador human também respeita só o status filtrado (ignora o type)').to.be.greaterThan(0);
            expect(body.summary.human + body.summary.animal, 'Tipos contam as abertas dos dois tipos').to.be.greaterThan(body.pagination.total);
            expect(somaDosStatus(body.summary), 'Os contadores de status respeitam o type e ignoram o status filtrado').to.eq(soAnimal.summary.animal);
            expect(body.summary.open, 'open dos animais é o mesmo com ou sem o filtro de status').to.eq(soAnimal.summary.open);
            body.items.forEach((item) => {
              expect(item.status, `Status do item ${item.id}`).to.eq('open');
              expect(item.animal_id, `animal_id do item ${item.id}`).to.not.eq(null);
            });
          });
        });
      });
    });

    it('24.13 deve derivar o status da receita: descartada (discarded_at) tem precedência, aberta é STATUS_MOV 0 e aguardando entrega é -1', function () {
      const detalhe = (id) => api.obterDetalhePrescricao(storeId, id, TIMEOUT_ROTA).then((res) => {
        expect(res.status, `Detalhe da receita ${id}`).to.eq(200);
        return res.body;
      });
      const STATUS_DO_DETALHE = { open: 0, awaiting_delivery: -1 };
      STATUS_DA_RECEITA.forEach((status) => {
        janelaCom({}, status).then((janela) => {
          if (pularSemMassa(this, janela, `nenhuma receita ${status} no último ano`)) return;
          buscarOk({ status, ...janela, per_page: 1 }, `status=${status} ${JSON.stringify(janela)}`).then((body) => {
            expect(body.items.length, `Receita ${status} na janela ${JSON.stringify(janela)}`).to.eq(1);
            detalhe(body.items[0].id).then((receita) => {
              expect(receita.discarded_at !== null, `Receita ${receita.id} (${status}): discarded_at preenchido só na descartada`).to.eq(status === 'discarded');
              expect(receita.status, `Receita ${receita.id} (${status}): status do detalhe`).to.eq(STATUS_DO_DETALHE[status] ?? receita.status);
            });
          });
        });
      });
    });

    it('24.14 deve buscar por q sem diferenciar maiúsculas nem acentos, em cliente, animal ou prescritor, e contar o total já com a busca', function () {
      // O termo vem da massa da rodada ([R-ATEMPORAL]): a 1ª palavra de 5+ letras com vogal de um nome de cliente das receitas mais recentes, buscada
      // sem acento, com acento posto na 1ª vogal (a dev grava os nomes em maiúsculas quase sempre sem acento: 1 acentuado em 400, medido em 2026-11-06)
      // e em maiúsculas.
      const ACENTO_DA_VOGAL = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' };
      buscarOk({ per_page: 100 }, 'Receitas mais recentes').then((recentes) => {
        const palavra = recentes.items
          .flatMap((item) => String(item.client_name || '').split(/[^\p{L}]+/u))
          .map(semAcento)
          .find((p) => p.length >= 5 && /[aeiou]/.test(p));
        if (!palavra) {
          cy.log('🔒 sem massa: nenhum nome de cliente com palavra de 5+ letras nas 100 receitas mais recentes');
          this.skip();
          return;
        }
        const alvo = palavra;
        const comAcento = alvo.replace(/[aeiou]/, (vogal) => ACENTO_DA_VOGAL[vogal]);
        const termos = [alvo, comAcento, alvo.toUpperCase()];
        const totais = [];
        termos.forEach((termo) => {
          buscarOk({ q: termo, per_page: 100 }, `q=${termo}`).then((body) => {
            expect(body.items.length, `Receita com "${alvo}" no cliente, animal ou prescritor (q=${termo})`).to.be.greaterThan(0);
            totais.push(body.pagination.total);
            body.items.forEach((item) => {
              const nomes = [item.client_name, item.animal_name, item.prescriber_name].map(semAcento).join(' | ');
              expect(nomes, `Item ${item.id} casa com "${alvo}" em algum dos nomes`).to.include(alvo);
            });
            expect(body.summary.total, `summary.total respeita q=${termo}`).to.eq(body.pagination.total);
            expect(somaDosStatus(body.summary), `Os contadores respeitam q=${termo}`).to.eq(body.summary.total);
          });
        });
        cy.then(() => {
          expect(new Set(totais).size, `Mesmo total para os três jeitos de escrever (${totais.join(', ')})`).to.eq(1);
        });
      });
    });

    it('24.15 deve achar a receita pelo código exato em q (só dígitos) e não achar por pedaço do código', () => {
      buscarOk({ per_page: 1 }, 'Receita mais recente').then((recente) => {
        const id = recente.items[0].id;
        buscarOk({ q: String(id) }, `q=${id}`).then((body) => {
          expect(body.items.map((i) => i.id), 'A receita aparece pelo código').to.deep.eq([id]);
          expect(body.pagination.total, 'Só a receita do código').to.eq(1);
        });
        buscarOk({ q: String(id).slice(0, -1) }, 'q com o código incompleto').then((body) => {
          expect(body.pagination.total, 'Código incompleto não acha receita').to.eq(0);
        });
      });
    });

    it('24.16 deve devolver 200 com lista vazia, páginas zeradas e contadores zerados quando a busca não acha nada', () => {
      buscarOk({ q: 'zzzxyzqwk' }, 'Busca sem resultado').then((body) => {
        expect(body.items, 'items').to.deep.eq([]);
        expect(body.pagination, 'pagination').to.include({ page: 1, per_page: 20, total: 0, total_pages: 0, has_next: false, has_previous: false });
        CHAVES_DO_RESUMO.forEach((chave) => expect(body.summary[chave], `summary.${chave}`).to.eq(0));
      });
    });

    it('24.17 deve listar só receitas da loja da sessão (store_id do detalhe igual ao da loja do token)', () => {
      buscarOk({ per_page: 5 }, 'Primeiros itens').then((body) => {
        expect(body.items.length, '🔒 massa: receitas na loja').to.be.greaterThan(0);
        body.items.forEach((item) => {
          api.obterDetalhePrescricao(storeId, item.id, TIMEOUT_ROTA).then((res) => {
            expect(res.status, `Detalhe da receita ${item.id}`).to.eq(200);
            expect(res.body.store_id, `Loja de cadastro da receita ${item.id}`).to.eq(storeId);
          });
        });
      });
    });

    it('24.18 deve devolver client_id e client_name nulos juntos (nunca vazios) quando a receita não tem cliente', () => {
      buscarOk({ type: 'animal', per_page: 100 }, 'Receitas de animal').then((body) => {
        const semCliente = body.items.filter((item) => item.client_id === null);
        expect(semCliente.length, '🔒 massa: receita de animal sem cliente').to.be.greaterThan(0);
        body.items.forEach((item) => {
          expect(item.client_name === null, `Item ${item.id}: client_id e client_name nulos juntos`).to.eq(item.client_id === null);
          expect((item.client_name ?? 'ok').trim(), `client_name do item ${item.id} não é branco`).to.not.eq('');
        });
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 25: CAPABILITIES DA RECEITA, MESMA REGRA EM TODAS AS RESPOSTAS (Issue backend#716/PR #728)
  // ---------------------------------------------------------------------------
  context('25. Capabilities da Receita (can_update, can_finalize, can_cancel_finalization): a Mesma Regra em Todas as Respostas (Issue backend#716/PR #728)', () => {

    // Sub-issue da #707. A receita tinha duas regras para o bloco `capabilities`: uma servia GET, PATCH, calculate e desconto, outra servia finalize e cancel-finalization, e a API prometia ações que ela mesma recusava.
    // A PR #728 monta o bloco numa função só: `can_finalize` responde "o finalize aceitaria agora" (aberta, com fórmula, todas calculadas, grants e controlados) e `can_cancel_finalization` olha entrega, descarte e cancelamento.
    // Medido na API real em 2026-10-22: o bloco vem em POST /prescriptions, GET, PATCH, calculate, finalize e cancel-finalization e é igual entre elas no mesmo estado; `can_finalize` sai false sem fórmula e com fórmula não calculada.
    // O `POST .../validate-discount` NÃO devolve `capabilities` (só `requested_discount_percentage`, `all_valid` e `formulas`): a issue o lista entre as seis respostas, divergência registrada em `ROADMAP.md`.
    // O detalhe de receita entregue vem com `delivery_id: null`; a receita entregue é achada pela lista da loja (`status=delivered`, janela de 90 dias, grant 145) e conferida pelo `status: -1` do detalhe.
    // Sem massa na dev: receita cancelada, conta sem os grants 301 e 582 e controlado não autorizado (o `can_update` pós-finalize só é provado coerente com o PATCH, o ramo sem grant fica dormente, `[R-CAPXACAO]`).
    // Receita não tem DELETE: roda numa receita temporária própria por rodada, no tenant dev (mesmo padrão dos ctx 3, 13, 21 e 23). O #25.1 vem primeiro (parte da receita sem fórmula); os demais reabrem e recalculam sozinhos se o estado mudou.
    const TIMEOUT_ROTA = { timeout: 90000 };
    const TOLERA_RECUSA = { timeout: 90000, failOnStatusCode: false };
    const PRESCRITOR_ID = 18780;
    const PRODUTO_ID = 1004866;
    const CHAVES = ['can_update', 'can_finalize', 'can_cancel_finalization'];

    let prescricaoId;
    let clienteId;
    let formulaId;

    // Lê o bloco de uma resposta, exigindo as 3 chaves booleanas
    const bloco = (res, rotulo) => {
      expect(res.body, `Corpo de ${rotulo}`).to.have.property('capabilities');
      CHAVES.forEach((chave) => expect(res.body.capabilities[chave], `${chave} em ${rotulo}`).to.be.a('boolean'));
      return {
        can_update: res.body.capabilities.can_update,
        can_finalize: res.body.capabilities.can_finalize,
        can_cancel_finalization: res.body.capabilities.can_cancel_finalization,
      };
    };
    const detalhe = () => api.obterDetalhePrescricao(storeId, prescricaoId, TIMEOUT_ROTA).then((res) => {
      expect(res.status, 'Status do detalhe da receita').to.eq(200);
      return res;
    });
    // A resposta de escrita tem de trazer o mesmo bloco que o GET feito logo depois, no mesmo estado
    const igualAoDetalhe = (res, rotulo) => detalhe().then((det) => {
      expect(bloco(res, rotulo), `Bloco de ${rotulo} igual ao do GET feito em seguida`).to.deep.eq(bloco(det, `GET após ${rotulo}`));
    });
    const criarFormulaComProduto = () => api.criarFormulaPrescricao(storeId, prescricaoId, {
      formula_number: 1, pharmaceutical_form_id: 2, lab_id: 2, qvd: 30.0, multiplier: 1, return_date: api.dataDeRetornoFutura(),
    }, TIMEOUT_ROTA).then((resF) => {
      expect(resF.status, 'Status da criação da fórmula').to.eq(201);
      formulaId = resF.body.id;
      return api.adicionarProdutoFormula(storeId, prescricaoId, formulaId, { product_id: PRODUTO_ID, quantity: 250.0, unit: 'mg' }, TIMEOUT_ROTA).then((resP) => {
        expect(resP.status, 'Status do produto da fórmula').to.be.oneOf([200, 201]);
      });
    });
    const calcular = () => api.calcularFormula(storeId, prescricaoId, formulaId, TIMEOUT_ROTA).then((res) => {
      expect(res.status, 'Status do cálculo da fórmula').to.eq(200);
      return res;
    });
    const reabrirSeFinalizada = () => detalhe().then((det) => {
      if (det.body.status === -1) {
        return api.cancelarFinalizacaoPrescricao(storeId, prescricaoId, TIMEOUT_ROTA).then((res) => {
          expect(res.status, 'Status do cancelamento da finalização para reabrir a receita').to.eq(200);
        });
      }
    });
    const garantirFormulaCalculada = () => detalhe().then((det) => {
      const formulas = det.body.formulas || [];
      if (formulas.length === 0) {
        return criarFormulaComProduto().then(calcular);
      }
      formulaId = formulas[0].id;
      if (!formulas.every((f) => f.calculated)) {
        return calcular();
      }
    });
    const prepararReceitaPronta = () => reabrirSeFinalizada().then(garantirFormulaCalculada);

    before(() => {
      api.buscarClientes(storeId, configEnv.DEFAULT_CLIENT_NAME).then((resCli) => {
        const cliente = (resCli.body?.items || resCli.body)?.[0];
        expect(cliente, '🔒 massa: cliente DEFAULT_CLIENT_NAME').to.be.ok;
        clienteId = cliente.id;
        api.criarPrescricao(storeId, {
          prescription_type: 'human',
          status: 0,
          sale_type: 1,
          patient_id: cliente.id,
          patient_name: cliente.name,
          buyer_id: cliente.id,
          buyer_name: cliente.name,
          prescriber_id: PRESCRITOR_ID,
          pickup_store_id: storeId,
        }, TIMEOUT_ROTA).then((res) => {
          expect(res.status, 'Status da criação da receita temporária').to.eq(201);
          prescricaoId = res.body.id;
        });
      });
    });

    it('25.1 deve devolver can_finalize false na receita sem fórmula e na receita com fórmula ainda não calculada, e o finalize recusa as duas com 422', () => {
      detalhe().then((det) => {
        expect(det.body.formulas, '🔒 receita recém-criada, sem fórmula (este é o primeiro teste do context)').to.have.length(0);
        expect(bloco(det, 'GET da receita sem fórmula').can_finalize, 'can_finalize sem fórmula').to.eq(false);
      });
      api.finalizarPrescricao(storeId, prescricaoId, TOLERA_RECUSA).then((res) => {
        expect(res.status, 'O finalize recusa a receita sem fórmula, como a capability anunciou').to.eq(422);
      });
      criarFormulaComProduto().then(detalhe).then((det) => {
        expect(det.body.formulas[0].calculated, 'Fórmula ainda não calculada').to.eq(false);
        expect(bloco(det, 'GET da receita com fórmula não calculada').can_finalize, 'can_finalize com fórmula não calculada').to.eq(false);
      });
      api.finalizarPrescricao(storeId, prescricaoId, TOLERA_RECUSA).then((res) => {
        expect(res.status, 'O finalize recusa a receita com fórmula não calculada, como a capability anunciou').to.eq(422);
      });
    });

    it('25.2 deve devolver can_finalize true na receita aberta com todas as fórmulas calculadas, e o finalize aceita', () => {
      prepararReceitaPronta();
      detalhe().then((det) => {
        expect(det.body.status, 'Receita aberta').to.eq(0);
        expect(bloco(det, 'GET da receita pronta').can_finalize, 'can_finalize com tudo calculado (a conta tem a 307, o #3.1 finaliza)').to.eq(true);
      });
      api.finalizarPrescricao(storeId, prescricaoId, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'O finalize aceita a receita que a capability anunciou').to.eq(200);
        expect(res.body.status, 'Receita finalizada').to.eq(-1);
      });
      reabrirSeFinalizada();
    });

    it('25.3 deve devolver as 3 chaves iguais no PATCH, no calculate, no finalize e no cancel-finalization e no GET feito logo depois de cada um', () => {
      prepararReceitaPronta();

      api.atualizarPrescricao(storeId, prescricaoId, { patient_id: clienteId, buyer_id: clienteId, observation: 'Teste backend#716' }, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status do PATCH da receita').to.eq(200);
        igualAoDetalhe(res, 'PATCH da receita');
        expect(bloco(res, 'PATCH da receita').can_finalize, 'can_finalize na receita pronta').to.eq(true);
      });

      calcular().then((res) => {
        igualAoDetalhe(res, 'calculate da fórmula');
        expect(bloco(res, 'calculate da fórmula').can_finalize, 'can_finalize depois do cálculo').to.eq(true);
      });

      api.finalizarPrescricao(storeId, prescricaoId, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status do finalize').to.eq(200);
        igualAoDetalhe(res, 'finalize');
        const caps = bloco(res, 'finalize');
        expect(caps.can_finalize, 'can_finalize na receita finalizada').to.eq(false);
        expect(caps.can_cancel_finalization, 'can_cancel_finalization na receita finalizada (a conta tem a 307)').to.eq(true);
      });

      api.cancelarFinalizacaoPrescricao(storeId, prescricaoId, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status do cancel-finalization').to.eq(200);
        igualAoDetalhe(res, 'cancel-finalization');
        const caps = bloco(res, 'cancel-finalization');
        expect(caps.can_finalize, 'can_finalize na receita reaberta').to.eq(true);
        expect(caps.can_cancel_finalization, 'can_cancel_finalization na receita reaberta').to.eq(false);
      });
    });

    it('25.4 deve devolver can_cancel_finalization false na receita finalizada e entregue, achada na lista da loja', () => {
      api.buscarReceitasDaLoja(storeId, { status: 'delivered', per_page: 5 }, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status da lista de receitas entregues').to.eq(200);
        const ids = (res.body.items || []).map((item) => item.id);
        expect(ids.length, '🔒 massa: receita entregue na janela de 90 dias da lista da loja').to.be.greaterThan(0);
        ids.forEach((id) => {
          api.obterDetalhePrescricao(storeId, id, TIMEOUT_ROTA).then((det) => {
            expect(det.status, `Status do detalhe da receita ${id}`).to.eq(200);
            expect(det.body.status, `Receita entregue ${id} está finalizada`).to.eq(-1);
            const caps = bloco(det, `GET da receita entregue ${id}`);
            expect(caps.can_cancel_finalization, `can_cancel_finalization da receita entregue ${id}`).to.eq(false);
            expect(caps.can_finalize, `can_finalize da receita entregue ${id}`).to.eq(false);
          });
        });
      });
    });

    it('25.5 deve manter o can_update da resposta do finalize coerente com o PATCH da receita finalizada (capability x ação)', () => {
      prepararReceitaPronta();
      // [R-CAPXACAO]: a conta de teste tem o grant de alterar receita finalizada (true); o ramo sem o grant fica dormente, a recusa não foi medida
      api.finalizarPrescricao(storeId, prescricaoId, TIMEOUT_ROTA).then((resFin) => {
        expect(resFin.status, 'Status do finalize').to.eq(200);
        const podeAlterar = bloco(resFin, 'finalize').can_update;
        api.atualizarPrescricao(storeId, prescricaoId, { patient_id: clienteId, buyer_id: clienteId, observation: 'Teste backend#716 finalizada' }, TOLERA_RECUSA).then((resPatch) => {
          if (podeAlterar) {
            expect(resPatch.status, 'can_update true no finalize: o PATCH da receita finalizada aceita').to.eq(200);
          } else {
            expect(resPatch.status, 'can_update false no finalize: o PATCH da receita finalizada recusa').to.be.oneOf([403, 422]);
          }
        });
      });
      reabrirSeFinalizada();
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 26: PATCH DA FÓRMULA SÓ DE TEXTO OU DATA MANTÉM O CÁLCULO; SÓ CAMPO DO CÁLCULO DESMARCA (Issue backend#717/PR #729)
  // ---------------------------------------------------------------------------
  context('26. PATCH da Fórmula só de Texto ou Data Mantém o Cálculo, só Campo do Cálculo Desmarca e needs_recalculate Nunca Vem com a Fórmula Calculada (Issue backend#717/PR #729)', () => {

    // Sub-issue da #707. Antes da PR #729 qualquer PATCH da fórmula sem `calculated` a desmarcava (CONCLUIDOFORMULA) e, como `needs_recalculate` era derivado de
    // ALTERACAO_DT > CALCULO_DT, corrigir só a posologia travava o finalize até recalcular. O Delphi (tela 145) não faz isso: texto e vencimento mantêm o cálculo.
    // Agora o PATCH só desmarca quando toca um campo do cálculo (forma farmacêutica, tipo de medicamento, gotas, múltiplo, QVD, peso, peso manual, taxa técnica,
    // valor extra, valor do tipo de medicamento, loja de baixa e inclusão automática), e `needs_recalculate` = fórmula já calculada que hoje está desmarcada.
    // Não alcançáveis por API: a linha "descalculou" (`DAV_HIST`, `TIPO_HIST = 3`) é só de banco, e o PATCH de posologia sem a 680 numa receita com financeiro
    // pede uma conta sem o grant (`R-CAPXACAO`). Receita não tem DELETE: roda numa receita temporária própria por rodada, no tenant dev (mesmo padrão dos ctx 3, 4 e 25).
    const TIMEOUT_ROTA = { timeout: 90000 };
    const TOLERA_RECUSA = { timeout: 90000, failOnStatusCode: false };
    const PRESCRITOR_ID = 18780;
    const PRODUTO_ID = 1004866;

    let prescricaoId = null;
    let formulaId = null;

    const formulaDaReceita = () => api.obterDetalhePrescricao(storeId, prescricaoId, TIMEOUT_ROTA).then((res) => {
      expect(res.status, 'Status do detalhe da receita').to.eq(200);
      const formula = (res.body.formulas || []).find((f) => f.id === formulaId);
      expect(formula, 'A fórmula da receita temporária').to.exist;
      return formula;
    });

    const esperarCalculada = (formula, descricao) => {
      expect(formula.calculated, `calculated ${descricao}`).to.eq(true);
      expect(formula.needs_recalculate, `needs_recalculate ${descricao}`).to.eq(false);
    };

    const esperarDescalculada = (formula, descricao) => {
      expect(formula.calculated, `calculated ${descricao}`).to.eq(false);
      expect(formula.needs_recalculate, `needs_recalculate ${descricao}`).to.eq(true);
    };

    const recalcular = () => api.calcularFormula(storeId, prescricaoId, formulaId, TIMEOUT_ROTA).then((res) => {
      expect(res.status, 'Status do recálculo').to.eq(200);
    });

    // Vencimento daqui a 30 dias, no formato da API (AAAA-MM-DD)
    const vencimento = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    before(() => {
      api.buscarClientes(storeId, configEnv.DEFAULT_CLIENT_NAME).then((resCli) => {
        const cliente = resCli.body?.items?.[0] || resCli.body?.[0];
        const clienteId = cliente?.id;
        expect(clienteId, '🔒 DEFAULT_CLIENT_NAME não achou cliente (massa)').to.be.ok;
        const clienteNome = cliente.name;
        api.criarPrescricao(storeId, {
          prescription_type: 'human',
          status: 0,
          sale_type: 1,
          patient_id: clienteId,
          patient_name: clienteNome,
          buyer_id: clienteId,
          buyer_name: clienteNome,
          prescriber_id: PRESCRITOR_ID,
          pickup_store_id: storeId,
        }, TIMEOUT_ROTA).then((resPresc) => {
          expect(resPresc.status, 'Criação da receita temporária').to.be.oneOf([200, 201]);
          prescricaoId = resPresc.body?.id || resPresc.body?.prescription_id;
          api.criarFormulaPrescricao(storeId, prescricaoId, { formula_number: 1, pharmaceutical_form_id: 2, lab_id: 2, qvd: 30.00, multiplier: 1, return_date: api.dataDeRetornoFutura() }, TIMEOUT_ROTA).then((resFormula) => {
            expect(resFormula.status, 'Criação da fórmula').to.be.oneOf([200, 201]);
            formulaId = resFormula.body?.id;
            api.adicionarProdutoFormula(storeId, prescricaoId, formulaId, { product_id: PRODUTO_ID, quantity: 250.0000, unit: 'mg' }, TIMEOUT_ROTA).then((resProduto) => {
              expect(resProduto.status, 'Inclusão do produto').to.be.oneOf([200, 201]);
              api.calcularFormula(storeId, prescricaoId, formulaId, TIMEOUT_ROTA).then((resCalc) => {
                expect(resCalc.status, 'Cálculo inicial da fórmula').to.eq(200);
              });
            });
          });
        });
      });
    });

    it('26.1 Nenhuma fórmula calculada das receitas pendentes deve vir com needs_recalculate: true (era a regra derivada de ALTERACAO_DT > CALCULO_DT)', () => {
      const divergentes = [];
      api.listarPrescricoes(storeId, { filter: 'pending', page: 1, per_page: 40 }, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status da listagem de receitas pendentes').to.eq(200);
        const ids = ((res.body && res.body.items) || []).map((r) => r.id);
        expect(ids, 'Receitas pendentes lidas').to.not.be.empty;
        ids.forEach((id) => {
          api.obterDetalhePrescricao(storeId, id, TIMEOUT_ROTA).then((det) => {
            ((det.body && det.body.formulas) || []).forEach((f) => {
              if (f.calculated === true && f.needs_recalculate === true) divergentes.push(`${id}/${f.id}`);
            });
          });
        });
      }).then(() => {
        expect(divergentes, 'Fórmulas com calculated: true e needs_recalculate: true ao mesmo tempo').to.deep.eq([]);
      });
    });

    it('26.2 Deve manter a fórmula calculada no PATCH só de posologia e a receita continuar finalizável', () => {
      expect(prescricaoId, 'Receita temporária criada no before').to.be.ok;
      formulaDaReceita().then((antes) => esperarCalculada(antes, 'antes do PATCH'));
      api.atualizarFormulaPrescricao(storeId, prescricaoId, formulaId, { posology: 'TOMAR 2 CAPSULAS AO DIA' }, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status do PATCH só de posologia').to.eq(200);
      });
      formulaDaReceita().then((depois) => {
        expect(depois.posology, 'A posologia gravada').to.eq('TOMAR 2 CAPSULAS AO DIA');
        esperarCalculada(depois, 'depois do PATCH só de posologia');
      });
      // O finalize aceita a receita sem recálculo; a finalização é desfeita para o resto do context
      api.finalizarPrescricao(storeId, prescricaoId, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'O finalize aceita a receita com a posologia corrigida').to.eq(200);
        expect(res.body.status, 'Receita finalizada').to.eq(-1);
      });
      api.cancelarFinalizacaoPrescricao(storeId, prescricaoId, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Desfaz a finalização').to.eq(200);
      });
    });

    it('26.3 Deve manter a fórmula calculada no PATCH só de rótulo, descrição, observações ou vencimento', () => {
      expect(prescricaoId, 'Receita temporária criada no before').to.be.ok;
      [
        { label_text: 'ROTULO ALTERADO' },
        { label_description: 'DESCRICAO ALTERADA' },
        { label_observation: 'OBSERVACAO DO ROTULO ALTERADA' },
        { formula_observation: 'OBSERVACAO DA FORMULA ALTERADA' },
        { expiry_date: vencimento() },
      ].forEach((corpo) => {
        const campo = Object.keys(corpo)[0];
        api.atualizarFormulaPrescricao(storeId, prescricaoId, formulaId, corpo, TIMEOUT_ROTA).then((res) => {
          expect(res.status, `Status do PATCH só de ${campo}`).to.eq(200);
        });
        formulaDaReceita().then((formula) => {
          expect(formula[campo], `O ${campo} gravado`).to.eq(corpo[campo]);
          esperarCalculada(formula, `depois do PATCH só de ${campo}`);
        });
      });
    });

    it('26.4 Deve desmarcar a fórmula e pedir recálculo no PATCH de campo do cálculo, e o finalize recusar até recalcular', () => {
      expect(prescricaoId, 'Receita temporária criada no before').to.be.ok;
      [
        { qvd: 31 },
        { multiplier: 2 },
        { automatic_inclusion: false },
      ].forEach((corpo) => {
        const campo = Object.keys(corpo)[0];
        api.atualizarFormulaPrescricao(storeId, prescricaoId, formulaId, corpo, TIMEOUT_ROTA).then((res) => {
          expect(res.status, `Status do PATCH de ${campo}`).to.eq(200);
        });
        formulaDaReceita().then((formula) => esperarDescalculada(formula, `depois do PATCH de ${campo}`));
        api.finalizarPrescricao(storeId, prescricaoId, TOLERA_RECUSA).then((res) => {
          expect(res.status, `O finalize recusa a fórmula com ${campo} alterado e sem recálculo`).to.eq(422);
        });
        recalcular();
        formulaDaReceita().then((formula) => esperarCalculada(formula, `depois de recalcular com ${campo} alterado`));
      });
    });

    it('26.5 Deve desmarcar a fórmula no PATCH misto de texto e campo do cálculo', () => {
      expect(prescricaoId, 'Receita temporária criada no before').to.be.ok;
      api.atualizarFormulaPrescricao(storeId, prescricaoId, formulaId, { posology: 'TOMAR 1 CAPSULA AO DIA', qvd: 32 }, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status do PATCH misto').to.eq(200);
      });
      formulaDaReceita().then((formula) => {
        expect(formula.posology, 'O texto do PATCH misto é gravado').to.eq('TOMAR 1 CAPSULA AO DIA');
        esperarDescalculada(formula, 'depois do PATCH misto de posologia e qvd');
      });
      recalcular();
      formulaDaReceita().then((formula) => esperarCalculada(formula, 'depois de recalcular o PATCH misto'));
    });
    // P2-32 (c), medido na dev em 2026-11-06: os demais campos que a issue lista. `drops` é string; `weight` só é aceito com `manual_weight` ligado
    // ("Peso só pode ser informado com peso manual habilitado."); `lab_delivery_at` exige data e hora ISO 8601 completa e volta normalizada em UTC.
    it('26.6 Deve desmarcar a fórmula e pedir recálculo no PATCH de cada um dos demais campos do cálculo, inclusive a loja de baixa reenviada com o mesmo valor', () => {
      expect(prescricaoId, 'Receita temporária criada no before').to.be.ok;
      formulaDaReceita().then((inicial) => {
        [
          { pharmaceutical_form_id: 63 },
          { pharmaceutical_form_id: 2 },
          { medicine_type_id: 1 },
          { drops: '10' },
          { manual_weight: true },
          { weight: 5 },
          { technical_fee_value: Number(inicial.technical_fee_value || 0) + 1 },
          { extra_value: 2 },
          { medicine_type_value: 1 },
          // Basta o campo vir no corpo: a loja de baixa reenviada com o valor que já está gravado também desmarca
          { stock_store_id: inicial.stock_store_id },
        ].forEach((corpo) => {
          const campo = Object.keys(corpo)[0];
          api.atualizarFormulaPrescricao(storeId, prescricaoId, formulaId, corpo, TIMEOUT_ROTA).then((res) => {
            expect(res.status, `Status do PATCH de ${campo}`).to.eq(200);
          });
          formulaDaReceita().then((formula) => {
            expect(formula[campo], `O ${campo} gravado`).to.eq(corpo[campo]);
            esperarDescalculada(formula, `depois do PATCH de ${campo}`);
          });
          recalcular();
          formulaDaReceita().then((formula) => esperarCalculada(formula, `depois de recalcular com ${campo} alterado`));
        });
      });
    });

    it('26.7 Deve manter a fórmula calculada no PATCH só de repetição, texto da repetição, retorno, entrega no laboratório, CID ou receituário ok', () => {
      expect(prescricaoId, 'Receita temporária criada no before').to.be.ok;
      const daqui = (dias) => new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
      [
        { repetition: 1 },
        { repetition_text: 'REPETIR 1 VEZ' },
        { return_date: daqui(40).toISOString().slice(0, 10) },
        { lab_delivery_at: daqui(5).toISOString() },
        { cid_code: 'F32' },
        { prescription_ok: true },
      ].forEach((corpo) => {
        const campo = Object.keys(corpo)[0];
        api.atualizarFormulaPrescricao(storeId, prescricaoId, formulaId, corpo, TIMEOUT_ROTA).then((res) => {
          expect(res.status, `Status do PATCH só de ${campo}`).to.eq(200);
        });
        formulaDaReceita().then((formula) => {
          // A entrega no laboratório volta normalizada em UTC: compara o instante, não o texto
          if (campo === 'lab_delivery_at') expect(new Date(formula[campo]).getTime(), 'O lab_delivery_at gravado').to.eq(new Date(corpo[campo]).getTime());
          else expect(formula[campo], `O ${campo} gravado`).to.eq(corpo[campo]);
          esperarCalculada(formula, `depois do PATCH só de ${campo}`);
        });
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 27: CARRINHO DA RECEITA, PRÉ-CONDIÇÃO, VÍNCULO E RETIRADA (Issue backend#718/PR #730)
  // ---------------------------------------------------------------------------
  context('27. Carrinho da Receita: Pré-condição, Vínculo a Carrinho Existente e Retirada (Issue backend#718/PR #730)', () => {

    // Sub-issue da #707. O `POST /prescriptions/:id/cart` vinculava um carrinho sem olhar o estado da receita e uma 2ª chamada trocava o código em silêncio (a procedure sobrescreve o campo `CARTAOATENDIMENTO`).
    // A PR #730 segue o Delphi: receita finalizada (`STATUS_MOV = -1`), não descartada, não cancelada e não paga. Sem body cria o carrinho (ou devolve o que a receita já tem, sem queimar número da sequência);
    // com `{ cart_id }` vincula ao carrinho existente (404 se não existe, 422 se a receita é de outra loja, 409 se já está em outro carrinho); `DELETE` retira (204, também sem carrinho). Sem grant: a 23 saiu do catálogo.
    // Medido na API real em 2026-10-22 (receitas próprias): 422 "Não é possível adicionar um carrinho em um orçamento." na aberta; 422 "Movimento já foi pago. Código do financeiro: N." na paga;
    // 404 "Carrinho não encontrado."; 409 "A receita já está no carrinho N." (com `code: CONFLICT`); 422 "A receita pertence a outra loja e não pode entrar neste carrinho."; `can_link_cart` não vem mais em `GET /prescription-capabilities`.
    // O detalhe da receita NÃO expõe o carrinho, então "nada foi gravado" nas recusas não é provável: os testes afirmam só o status e a mensagem. Cada rodada cria 3 receitas e 2 carrinhos (cada um queima 1 número da sequência);
    // a limpeza é o `DELETE` do #27.6, que só tira a receita do carrinho (receita e carrinho não têm `DELETE` próprio). Sem teste: carrinho com link de pagamento aguardando, `DELETE` em receita paga e conta sem a 23 (`ROADMAP.md` P2-33).
    // Estado compartilhado entre os testes: as receitas A, B e C nascem abertas no `before()`; o #27.1 vem primeiro (usa a A aberta) e os demais finalizam e acham o carrinho sozinhos, então o `.only` isolado em qualquer um funciona.
    const TIMEOUT_ROTA = { timeout: 90000 };
    const TOLERA_RECUSA = { timeout: 90000, failOnStatusCode: false };
    const PRESCRITOR_ID = 18780;
    const PRODUTO_ID = 1004866;
    const MSG_ORCAMENTO = 'Não é possível adicionar um carrinho em um orçamento.';
    const MSG_NAO_ENCONTRADO = 'Carrinho não encontrado.';
    const MSG_OUTRA_LOJA = 'A receita pertence a outra loja e não pode entrar neste carrinho.';

    const ids = {};

    const novaReceitaCalculada = (nome, cliente) => api.criarPrescricao(storeId, {
      prescription_type: 'human',
      status: 0,
      sale_type: 1,
      patient_id: cliente.id,
      patient_name: cliente.name,
      buyer_id: cliente.id,
      buyer_name: cliente.name,
      prescriber_id: PRESCRITOR_ID,
      pickup_store_id: storeId,
    }, TIMEOUT_ROTA).then((res) => {
      expect(res.status, `Status da criação da receita ${nome}`).to.eq(201);
      ids[nome] = res.body.id;
      return api.criarFormulaPrescricao(storeId, ids[nome], { formula_number: 1, pharmaceutical_form_id: 2, lab_id: 2, qvd: 30.0, multiplier: 1, return_date: api.dataDeRetornoFutura() }, TIMEOUT_ROTA).then((resF) => {
        expect(resF.status, `Status da criação da fórmula da receita ${nome}`).to.eq(201);
        return api.adicionarProdutoFormula(storeId, ids[nome], resF.body.id, { product_id: PRODUTO_ID, quantity: 250.0, unit: 'mg' }, TIMEOUT_ROTA).then((resP) => {
          expect(resP.status, `Status do produto da fórmula da receita ${nome}`).to.be.oneOf([200, 201]);
          return api.calcularFormula(storeId, ids[nome], resF.body.id, TIMEOUT_ROTA).then((resC) => {
            expect(resC.status, `Status do cálculo da fórmula da receita ${nome}`).to.eq(200);
          });
        });
      });
    });
    const garantirFinalizada = (nome) => api.obterDetalhePrescricao(storeId, ids[nome], TIMEOUT_ROTA).then((det) => {
      if (det.body.status !== -1) {
        return api.finalizarPrescricao(storeId, ids[nome], TIMEOUT_ROTA).then((res) => {
          expect(res.status, `Status do finalize da receita ${nome}`).to.eq(200);
        });
      }
    });
    // Sem body cria o carrinho ou devolve o que a receita já tem: serve para achar o carrinho em qualquer ordem de teste
    const carrinhoDe = (nome) => garantirFinalizada(nome).then(() => api.vincularCarrinhoReceita(ids[nome], {}, TIMEOUT_ROTA)).then((res) => {
      expect(res.status, `Status do carrinho da receita ${nome}`).to.eq(200);
      expect(res.body.cart_id, `cart_id da receita ${nome}`).to.be.a('number');
      return res.body.cart_id;
    });
    const exigirRecusa = (res, status, mensagem, rotulo) => {
      expect(res.status, `Status de ${rotulo}`).to.eq(status);
      expect(res.body.message, `Mensagem de ${rotulo}`).to.eq(mensagem);
    };

    before(() => {
      api.buscarClientes(storeId, configEnv.DEFAULT_CLIENT_NAME).then((resCli) => {
        const cliente = (resCli.body?.items || resCli.body)?.[0];
        expect(cliente, '🔒 massa: cliente DEFAULT_CLIENT_NAME').to.be.ok;
        novaReceitaCalculada('A', cliente).then(() => novaReceitaCalculada('B', cliente)).then(() => novaReceitaCalculada('C', cliente));
      });
    });

    it('27.1 deve recusar com 422 o carrinho de uma receita aberta, com a mensagem do Delphi', () => {
      api.obterDetalhePrescricao(storeId, ids.A, TIMEOUT_ROTA).then((det) => {
        expect(det.body.status, '🔒 receita A ainda aberta (este é o primeiro teste do context)').to.eq(0);
      });
      api.vincularCarrinhoReceita(ids.A, {}, TOLERA_RECUSA).then((res) => {
        exigirRecusa(res, 422, MSG_ORCAMENTO, 'carrinho sem body numa receita aberta');
      });
      api.vincularCarrinhoReceita(ids.A, { cart_id: 999999999 }, TOLERA_RECUSA).then((res) => {
        exigirRecusa(res, 422, MSG_ORCAMENTO, 'carrinho com cart_id numa receita aberta (a pré-condição vem antes da busca do carrinho)');
      });
    });

    it('27.2 deve recusar com 422 o carrinho de uma receita paga, com o código do financeiro, achada na lista da loja', () => {
      const achar = (lista, i) => {
        if (i >= lista.length) return cy.wrap(null);
        return api.obterDetalhePrescricao(storeId, lista[i], TIMEOUT_ROTA).then((det) => {
          if (det.body.status === -1 && det.body.financial_id) return { id: det.body.id, financeiro: det.body.financial_id };
          return achar(lista, i + 1);
        });
      };
      const ids20 = (status) => api.buscarReceitasDaLoja(storeId, { status, per_page: 20 }, TIMEOUT_ROTA).then((res) => {
        expect(res.status, `Status da lista de receitas ${status}`).to.eq(200);
        return (res.body.items || []).map((item) => item.id);
      });
      ids20('awaiting_delivery').then((aguardando) => ids20('delivered').then((entregues) => achar([...aguardando, ...entregues], 0))).then((massa) => {
        expect(massa, '🔒 massa: receita finalizada com financeiro (paga) entre as 40 primeiras da lista (janela de 90 dias)').to.be.ok;
        api.vincularCarrinhoReceita(massa.id, {}, TOLERA_RECUSA).then((res) => {
          exigirRecusa(res, 422, `Movimento já foi pago. Código do financeiro: ${massa.financeiro}.`, `carrinho da receita paga ${massa.id}`);
        });
      });
    });

    it('27.3 deve criar o carrinho da receita finalizada sem body e devolver o mesmo carrinho ao repetir, sem trocar o código', () => {
      garantirFinalizada('A');
      carrinhoDe('A').then((cartId) => {
        expect(cartId, 'cart_id positivo').to.be.greaterThan(0);
        api.vincularCarrinhoReceita(ids.A, {}, TIMEOUT_ROTA).then((res) => {
          expect(res.status, 'Status da repetição sem body').to.eq(200);
          expect(res.body.cart_id, 'A repetição devolve o mesmo carrinho (antes da PR #730 trocava o código e queimava número)').to.eq(cartId);
        });
        api.vincularCarrinhoReceita(ids.A, { cart_id: cartId }, TIMEOUT_ROTA).then((res) => {
          expect(res.status, 'Status do vínculo ao carrinho que a receita já tem').to.eq(200);
          expect(res.body.cart_id, 'O vínculo ao próprio carrinho devolve o mesmo').to.eq(cartId);
        });
      });
    });

    it('27.4 deve vincular a um carrinho existente, recusar o inexistente com 404 e a receita que já está em outro carrinho com 409', () => {
      garantirFinalizada('B');
      // B ainda sem carrinho (nenhum teste a vincula antes deste): o 404 vem da busca do carrinho
      api.vincularCarrinhoReceita(ids.B, { cart_id: 999999999 }, TOLERA_RECUSA).then((res) => {
        exigirRecusa(res, 404, MSG_NAO_ENCONTRADO, 'carrinho inexistente');
      });
      carrinhoDe('A').then((cartA) => {
        api.vincularCarrinhoReceita(ids.B, { cart_id: cartA }, TIMEOUT_ROTA).then((res) => {
          expect(res.status, 'Status do vínculo da B ao carrinho da A').to.eq(200);
          expect(res.body.cart_id, 'A B entra no carrinho da A').to.eq(cartA);
        });
        api.vincularCarrinhoReceita(ids.B, { cart_id: cartA }, TIMEOUT_ROTA).then((res) => {
          expect(res.status, 'Status do vínculo repetido da B ao mesmo carrinho').to.eq(200);
          expect(res.body.cart_id, 'O vínculo repetido devolve o mesmo carrinho').to.eq(cartA);
        });
        carrinhoDe('C').then((cartC) => {
          expect(cartC, 'A C tem carrinho próprio, diferente do da A').to.not.eq(cartA);
          api.vincularCarrinhoReceita(ids.B, { cart_id: cartC }, TOLERA_RECUSA).then((res) => {
            exigirRecusa(res, 409, `A receita já está no carrinho ${cartA}.`, 'receita já em outro carrinho');
            expect(res.body.code, 'code do 409').to.eq('CONFLICT');
          });
        });
      });
    });

    it('27.5 deve recusar com 422 o vínculo de uma receita da loja 2 a um carrinho da loja da sessão', function () {
      // A sessão só cria receita na própria loja (a loja vem do token, backend#659), então a receita de outra loja é a única massa fixa deste context (`massaResidualReceitas.js`).
      // Se ela sumir ou deixar de ser de outra loja, o teste pula com o motivo em vez de ficar vermelho (`[R-ATEMPORAL]`).
      const receitaOutraLoja = massaResidualReceitas.RECEITA_FINALIZADA_DA_LOJA_2;
      api.obterDetalhePrescricao(storeId, receitaOutraLoja, TOLERA_RECUSA).then((det) => {
        if (det.status !== 200 || !det.body.store_id || det.body.store_id === storeId) {
          cy.log(`⏭️ Sem massa: a receita ${receitaOutraLoja} não é mais de outra loja (status ${det.status}, store_id ${det.body && det.body.store_id})`);
          this.skip();
        }
      });
      carrinhoDe('A').then((cartA) => {
        api.vincularCarrinhoReceita(receitaOutraLoja, { cart_id: cartA }, TOLERA_RECUSA).then((res) => {
          expect(res.status, '🔒 massa: receita finalizada da loja 2 (`massaResidualReceitas.js`); 404 indica que a receita sumiu').to.eq(422);
          expect(res.body.message, 'Mensagem da recusa por loja').to.eq(MSG_OUTRA_LOJA);
        });
      });
    });

    it('27.6 deve retirar a receita do carrinho com DELETE (204), repetir com 204 e liberar a receita para entrar em outro carrinho', () => {
      carrinhoDe('A').then((cartA) => {
        carrinhoDe('C').then((cartC) => {
          api.vincularCarrinhoReceita(ids.B, { cart_id: cartA }, TIMEOUT_ROTA).then((res) => {
            expect(res.body.cart_id, 'A B está no carrinho da A antes da retirada').to.eq(cartA);
          });
          api.vincularCarrinhoReceita(ids.B, { cart_id: cartC }, TOLERA_RECUSA).then((res) => {
            expect(res.status, 'Antes da retirada a B não entra no carrinho da C').to.eq(409);
          });
          api.retirarCarrinhoReceita(ids.B, TIMEOUT_ROTA).then((res) => {
            expect(res.status, 'Status da retirada da B').to.eq(204);
          });
          api.vincularCarrinhoReceita(ids.B, { cart_id: cartC }, TIMEOUT_ROTA).then((res) => {
            expect(res.status, 'Depois da retirada a B entra no carrinho da C (a retirada fez efeito)').to.eq(200);
            expect(res.body.cart_id, 'A B entra no carrinho da C').to.eq(cartC);
          });
          // Limpeza: tira as 3 receitas dos carrinhos; a repetição prova o 204 da receita sem carrinho
          ['B', 'A', 'C'].forEach((nome) => {
            api.retirarCarrinhoReceita(ids[nome], TIMEOUT_ROTA).then((res) => {
              expect(res.status, `Status da retirada da ${nome}`).to.eq(204);
            });
          });
          api.retirarCarrinhoReceita(ids.A, TIMEOUT_ROTA).then((res) => {
            expect(res.status, 'Retirar de novo a receita que já está sem carrinho também responde 204').to.eq(204);
          });
        });
      });
    });

    it('27.7 deve tirar can_link_cart do mapa de GET /prescription-capabilities (as rotas de carrinho não cobram grant)', () => {
      api.obterCapabilitiesReceitas(storeId, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status das capabilities de receitas').to.eq(200);
        expect(res.body.capabilities, 'Mapa de capabilities').to.be.an('object');
        expect(res.body.capabilities, 'can_link_cart saiu do mapa').to.not.have.property('can_link_cart');
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 28: REGISTRO DE FALTA DE ESTOQUE (POST /stock-shortages), SÓ OS CASOS QUE NÃO GRAVAM (Issue backend#707, can_register_stock_shortage)
  // ---------------------------------------------------------------------------
  context('28. Registro de Falta de Estoque (POST /stock-shortages): a Rota Existe e Recusa o que Não Grava (Issue backend#707, can_register_stock_shortage)', () => {

    // A caixa preta da tela 145 (docs/ANALISE_TELA_145_RECEITA_CAIXA_PRETA.md §6) achou `can_register_stock_shortage` "sem rota" (404 em `stock-shortage` e `stock-shortages`); a #707 corrigiu o achado:
    // a rota existe desde a #224 e o 404 veio de outro caminho. Medido na dev em 2026-10-22: `GET /stock-shortages` responde 405 (o caminho existe só para POST), sem token o POST responde 401 e
    // autenticado, sem produto válido, responde 422 "O produto é obrigatório e deve ser válido." (`GET /stock-shortage` e `GET /prescriptions/:id/stock-shortages` seguem 404).
    // Só entram os casos que não gravam: o registro de uma falta real grava na tabela de faltas e não há como desfazer pela API, e o grant que a rota cobra não foi medido (a conta de teste tem a capability `true`).
    // Sem teste: o registro com produto válido (sucesso) e a recusa por falta do grant (`ROADMAP.md` P2-35). O front ainda não tem a tela dessa ação (informado na issue, não medido aqui).
    const TIMEOUT_ROTA = { timeout: 90000, failOnStatusCode: false };
    const MSG_PRODUTO = 'O produto é obrigatório e deve ser válido.';
    const DETALHE_INTERNO = /SQLSTATE|Firebird|Exception|An unexpected error|numeric value|string right truncation/i;

    it('28.1 Deve recusar com 401 o POST /stock-shortages sem token', () => {
      api.registrarFaltaEstoque(storeId, {}, { ...TIMEOUT_ROTA, headers: { Authorization: '' } }).then((res) => {
        expect(res.status, 'Status do POST /stock-shortages sem token').to.eq(401);
        expect(res.body.error, 'Erro de autenticação').to.eq('Unauthorized');
      });
    });

    it('28.2 Deve recusar com 422 o POST /stock-shortages sem produto, o que também prova que a rota existe (não é 404)', () => {
      api.registrarFaltaEstoque(storeId, {}, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status do POST /stock-shortages com corpo vazio').to.eq(422);
        expect(res.body.message, 'Mensagem do 422').to.eq(MSG_PRODUTO);
        expect(JSON.stringify(res.body), 'A resposta não pode expor detalhe interno').not.to.match(DETALHE_INTERNO);
      });
    });

    it('28.3 Deve recusar com 422 o POST /stock-shortages com produto inválido, sem gravar a falta', () => {
      [-1, 0].forEach((productId) => {
        api.registrarFaltaEstoque(storeId, { product_id: productId }, TIMEOUT_ROTA).then((res) => {
          expect(res.status, `Status do POST /stock-shortages com product_id=${productId}`).to.eq(422);
          expect(res.body.message, `Mensagem do 422 com product_id=${productId}`).to.eq(MSG_PRODUTO);
          expect(JSON.stringify(res.body), `A resposta com product_id=${productId} não pode expor detalhe interno`).not.to.match(DETALHE_INTERNO);
        });
      });
    });

  });

  context('29. Vínculo da Receita com o Atendimento (attendance_id no POST e no PATCH): Destino Fechado, sem Atendente e Código Inválido (Issue backend#760/PR #764)', () => {

    // A PR #764 deixa o `PATCH /prescriptions/:id` incluir (599), remover (640) ou trocar (689) o vínculo da receita já gravada, e a criação passa a recusar destino fechado.
    // Regras do destino: aberto (Pendente, Em andamento ou Concluído) e com atendente; Finalizado ou Descartado responde 409 `ATTENDANCE_CLOSED`, aberto sem atendente responde 409 `ATTENDANCE_UNASSIGNED`.
    // Medido na dev em 2026-10-26: a conta de teste tem 599, 640 e 689 (`can_add_movement`, `can_remove_movement`, `can_transfer_omni_movement` `true`) e os dois atendimentos abertos e com atendente da issue (261000201 e 261000202)
    // já estavam Finalizados, então só entram as recusas, que não gravam vínculo; incluir, trocar e remover, o `403` por permissão e o log `[WEB]` ficam sem teste (`ROADMAP.md` P1-27).
    // Receita não tem DELETE: roda em 1 receita temporária por rodada (mesmo padrão dos ctx 15 e 22), e cada recusa confere que ela continua sem vínculo e sem alteração.
    const TIMEOUT_ROTA = { timeout: 90000 };
    const MSG_FECHADO = 'Atendimento finalizado ou descartado não aceita movimento.';
    const MSG_SEM_ATENDENTE = 'Assuma este atendimento antes de incluir movimento.';
    const MSG_INVALIDO = 'Atendimento inválido.';
    const MSG_NAO_ENCONTRADO = 'Atendimento não encontrado.';
    const MSG_INTEIRO = 'O campo attendance_id deve ser um número inteiro.';
    const DETALHE_INTERNO = /SQLSTATE|Firebird|Exception|An unexpected error|numeric value|string right truncation/i;
    const SEM_FINALIZADO = '⏭️ Sem massa: nenhum atendimento finalizado na listagem desta rodada';
    const SEM_PENDENTE_SEM_ATENDENTE = '⏭️ Sem massa: nenhum atendimento Pendente sem atendente na fila desta rodada (só existe quando a fila tem um; o teste não cria, criar mandaria WhatsApp de verdade)';

    // Atemporal: nenhum código de atendimento fixo. Os destinos são descobertos na listagem a cada rodada (finalizado: há centenas; pendente sem atendente: só quando a fila tiver um,
    // hoje a dev não tem nenhum) e o teste que não achar o seu destino termina como pulado, nunca vermelho por massa (a issue backend#760 pedia o atendimento 261000207, que já não é pendente).
    let atendimentoFinalizado = null;
    let atendimentoPendenteSemAtendente = null;
    let cliente = null;
    let receitaId = null;

    // Primeiro atendimento da listagem do `status` que o detalhe confirma (`aceita`); `preFiltro` só poupa chamadas de detalhe
    const descobrirAtendimento = (status, aceita, preFiltro = () => true) => api.listarAtendimentos(storeId, { status, page: 1, per_page: 100 }, TIMEOUT_ROTA).then((res) => {
      expect(res.status, `Status da listagem de atendimentos ${status}`).to.eq(200);
      const candidatos = ((res.body && res.body.items) || []).filter(preFiltro);
      const achar = (i) => {
        if (i >= candidatos.length) return cy.wrap(null, { log: false });
        return api.obterDetalheAtendimento(storeId, candidatos[i].id, TIMEOUT_ROTA).then((det) => (
          aceita(det.body.attendance) ? cy.wrap(candidatos[i].id, { log: false }) : achar(i + 1)
        ));
      };
      return achar(0);
    });
    const pularSemMassa = (ctx, id, motivo) => {
      if (id) return false;
      cy.log(motivo);
      ctx.skip();
      return true;
    };

    const corpoDaReceita = () => ({
      prescription_type: 'human', status: 0, sale_type: 1,
      patient_id: cliente.id, patient_name: cliente.name, buyer_id: cliente.id, buyer_name: cliente.name,
      prescriber_id: 18780, pickup_store_id: storeId,
    });
    const detalhe = () => api.obterDetalhePrescricao(storeId, receitaId, TIMEOUT_ROTA).then((det) => {
      expect(det.status, `Status do detalhe da receita temporária #${receitaId}`).to.eq(200);
      return det.body;
    });
    const estadoDe = (corpo) => ({ attendance_id: corpo.attendance_id, updated_at: corpo.updated_at });
    const exigirRecusa = (res, status, rotulo) => {
      expect(res.status, `Status de ${rotulo}`).to.eq(status);
      expect(JSON.stringify(res.body), `A resposta de ${rotulo} não pode expor detalhe interno`).not.to.match(DETALHE_INTERNO);
    };
    // Recusa de PATCH: o status e a mensagem certos e a receita exatamente como estava
    const exigirPatchRecusado = (corpo, status, mensagem, codigo, rotulo) => detalhe().then((antes) => {
      api.atualizarPrescricao(storeId, receitaId, corpo, { ...TIMEOUT_ROTA, failOnStatusCode: false }).then((res) => {
        exigirRecusa(res, status, rotulo);
        expect(res.body.message, `Mensagem de ${rotulo}`).to.eq(mensagem);
        if (codigo) expect(res.body.code, `Código de erro de ${rotulo}`).to.eq(codigo);
      });
      detalhe().then((depois) => {
        expect(depois.attendance_id, `A receita não pode ficar vinculada após ${rotulo}`).to.be.null;
        expect(estadoDe(depois), `A receita não pode mudar após ${rotulo}`).to.deep.eq(estadoDe(antes));
      });
    });

    before(() => {
      // Cliente padrão do env.json (R-POM) como paciente e comprador da receita temporária
      api.buscarClientes(storeId, configEnv.DEFAULT_CLIENT_NAME).then((resCli) => {
        cliente = (resCli.body && (resCli.body.items || resCli.body))[0];
        expect(cliente && cliente.id, '🔒 DEFAULT_CLIENT_NAME não achou cliente (massa)').to.be.ok;
        api.criarPrescricao(storeId, corpoDaReceita(), TIMEOUT_ROTA).then((res) => {
          expect(res.status, 'Status da criação da receita temporária').to.be.oneOf([200, 201]);
          receitaId = res.body.id || res.body.prescription_id;
          expect(receitaId, 'ID da receita temporária').to.be.ok;
          expect(res.body.attendance_id, 'A receita temporária nasce sem vínculo').to.be.null;
        });
      });
      descobrirAtendimento('finished', (a) => a.status === 3).then((id) => { atendimentoFinalizado = id; });
      descobrirAtendimento('pending', (a) => a.status === 0 && !a.attendant, (i) => !i.attendant_name).then((id) => { atendimentoPendenteSemAtendente = id; });
    });

    it('29.1 Deve recusar com 401 o PATCH da receita com attendance_id sem token', () => {
      // Sem token o 401 vem antes de qualquer leitura do destino: qualquer código serve, então não depende de massa
      api.atualizarPrescricao(storeId, receitaId, { attendance_id: 999999999 }, { ...TIMEOUT_ROTA, failOnStatusCode: false, headers: { Authorization: '' } }).then((res) => {
        expect(res.status, 'Status do PATCH com attendance_id sem token').to.eq(401);
        expect(res.body.error, 'Erro de autenticação').to.eq('Unauthorized');
      });
    });

    it('29.2 Deve recusar com 409 ATTENDANCE_CLOSED o PATCH que inclui a receita num atendimento finalizado, sem vincular', function () {
      if (pularSemMassa(this, atendimentoFinalizado, SEM_FINALIZADO)) return;
      const alvo = atendimentoFinalizado;
      api.obterDetalheAtendimento(storeId, alvo, TIMEOUT_ROTA).then((det) => {
        expect(det.body.attendance.status, `O atendimento ${alvo} descoberto como finalizado mudou de status antes do teste (status 3 esperado)`).to.eq(3);
      });
      exigirPatchRecusado({ attendance_id: alvo }, 409, MSG_FECHADO, 'ATTENDANCE_CLOSED', `PATCH com o atendimento finalizado ${alvo}`);
    });

    it('29.3 Deve recusar com 409 ATTENDANCE_UNASSIGNED o PATCH que inclui a receita num atendimento pendente sem atendente, sem vincular', function () {
      if (pularSemMassa(this, atendimentoPendenteSemAtendente, SEM_PENDENTE_SEM_ATENDENTE)) return;
      const alvo = atendimentoPendenteSemAtendente;
      api.obterDetalheAtendimento(storeId, alvo, TIMEOUT_ROTA).then((det) => {
        expect(det.body.attendance.status, `O atendimento ${alvo} descoberto como pendente mudou de status antes do teste (status 0 esperado)`).to.eq(0);
        expect(det.body.attendance.attendant, `O atendimento ${alvo} descoberto sem atendente ganhou atendente antes do teste`).not.to.be.ok;
      });
      exigirPatchRecusado({ attendance_id: alvo }, 409, MSG_SEM_ATENDENTE, 'ATTENDANCE_UNASSIGNED', `PATCH com o atendimento pendente sem atendente ${alvo}`);
    });

    it('29.4 Deve recusar com 422 o PATCH com attendance_id zero, negativo, inexistente ou que não é número, com a mensagem de cada caso', () => {
      [
        { valor: 0, mensagem: MSG_INVALIDO },
        { valor: -1, mensagem: MSG_INVALIDO },
        { valor: 999999999, mensagem: MSG_NAO_ENCONTRADO },
        { valor: 'abc', mensagem: MSG_INTEIRO },
      ].forEach(({ valor, mensagem }) => {
        exigirPatchRecusado({ attendance_id: valor }, 422, mensagem, null, `PATCH com attendance_id=${JSON.stringify(valor)}`);
      });
    });

    it('29.5 Deve recusar com 409 ATTENDANCE_CLOSED o POST /prescriptions com attendance_id de atendimento finalizado (antes da PR #764 era aceito)', function () {
      if (pularSemMassa(this, atendimentoFinalizado, SEM_FINALIZADO)) return;
      api.criarPrescricao(storeId, { ...corpoDaReceita(), attendance_id: atendimentoFinalizado }, { ...TIMEOUT_ROTA, failOnStatusCode: false }).then((res) => {
        exigirRecusa(res, 409, 'POST com o atendimento finalizado');
        expect(res.body.code, 'Código de erro do POST com o atendimento finalizado').to.eq('ATTENDANCE_CLOSED');
        expect(res.body.message, 'Mensagem do POST com o atendimento finalizado').to.eq(MSG_FECHADO);
      });
    });

    it('29.6 Deve recusar com 409 ATTENDANCE_UNASSIGNED o POST /prescriptions com attendance_id de atendimento pendente sem atendente', function () {
      if (pularSemMassa(this, atendimentoPendenteSemAtendente, SEM_PENDENTE_SEM_ATENDENTE)) return;
      api.criarPrescricao(storeId, { ...corpoDaReceita(), attendance_id: atendimentoPendenteSemAtendente }, { ...TIMEOUT_ROTA, failOnStatusCode: false }).then((res) => {
        exigirRecusa(res, 409, 'POST com o atendimento pendente sem atendente');
        expect(res.body.code, 'Código de erro do POST com o atendimento pendente sem atendente').to.eq('ATTENDANCE_UNASSIGNED');
        expect(res.body.message, 'Mensagem do POST com o atendimento pendente sem atendente').to.eq(MSG_SEM_ATENDENTE);
      });
    });

    // Cenários 1 a 4 do QA (ROADMAP.md P1-27, decisão do operador de 2026-11-06): incluir, repetir, trocar e remover o vínculo na mesma receita temporária.
    // Destinos descobertos a cada rodada: abertos (Pendente, Em andamento ou Concluído) e com atendente, fora o do DEFAULT_CELULAR (compartilhado pelo 5-B/5-C em API real).
    // Os #29.7 a #29.10 compartilham o estado da receita (isolar os quatro juntos); o after() desfaz o vínculo se uma rodada parar no meio.
    const SEM_DOIS_DESTINOS = '⏭️ Sem massa: menos de 2 atendimentos abertos e com atendente (fora o do DEFAULT_CELULAR) nesta rodada';
    const CELULAR_COMPARTILHADO = String(configEnv.DEFAULT_CELULAR || '').replace(/\D/g, '').slice(-8);
    let destinos = [];
    const descobrirDestinosAbertos = () => {
      const achados = [];
      const porStatus = (status) => api.listarAtendimentos(storeId, { status, page: 1, per_page: 100 }, TIMEOUT_ROTA).then((res) => {
        expect(res.status, `Status da listagem de atendimentos ${status}`).to.eq(200);
        const candidatos = ((res.body && res.body.items) || []).filter((i) => i.attendant_name && !(CELULAR_COMPARTILHADO && JSON.stringify(i).includes(CELULAR_COMPARTILHADO)));
        const conferir = (i) => {
          if (achados.length >= 2 || i >= candidatos.length) return cy.wrap(null, { log: false });
          return api.obterDetalheAtendimento(storeId, candidatos[i].id, TIMEOUT_ROTA).then((det) => {
            const a = det.body.attendance;
            if ([0, 1, 2].includes(a.status) && a.attendant && !achados.includes(candidatos[i].id)) achados.push(candidatos[i].id);
            return conferir(i + 1);
          });
        };
        return conferir(0);
      });
      return porStatus('pending').then(() => porStatus('in_progress')).then(() => porStatus('completed')).then(() => achados);
    };
    const vincular = (attendanceId, rotulo) => api.atualizarPrescricao(storeId, receitaId, { attendance_id: attendanceId }, { ...TIMEOUT_ROTA, failOnStatusCode: false }).then((res) => {
      expect(res.status, `Status de ${rotulo}`).to.eq(200);
      expect(res.body.attendance_id, `attendance_id na resposta de ${rotulo}`).to.eq(attendanceId);
      return detalhe().then((corpo) => {
        expect(corpo.attendance_id, `attendance_id gravado após ${rotulo}`).to.eq(attendanceId);
      });
    });
    // Medido na 1ª rodada (2026-11-06): até a receita aberta entra na lista de orçamentos do atendimento ao ser vinculada e sai da origem na troca
    const exigirNosOrcamentos = (attendanceId, presente, momento) => api.listarOrcamentosAtendimento(storeId, attendanceId, TIMEOUT_ROTA).then((res) => {
      expect(res.status, `Status dos orçamentos do atendimento ${attendanceId} ${momento}`).to.eq(200);
      const itens = (res.body && (res.body.data || res.body.items)) || [];
      const achou = itens.some((b) => JSON.stringify(b).includes(String(receitaId)));
      expect(achou, `Receita ${receitaId} ${presente ? 'presente' : 'ausente'} nos orçamentos do atendimento ${attendanceId} ${momento}`).to.eq(presente);
    });

    before(() => {
      descobrirDestinosAbertos().then((ids) => { destinos = ids; });
    });

    after(() => {
      // Segurança: a receita temporária nunca termina vinculada a um atendimento real
      if (receitaId) api.atualizarPrescricao(storeId, receitaId, { attendance_id: null }, { ...TIMEOUT_ROTA, failOnStatusCode: false });
    });

    it('29.7 Deve incluir a receita num atendimento aberto e com atendente pelo PATCH, e ela passa a aparecer no detalhe e nos orçamentos do atendimento', function () {
      if (pularSemMassa(this, destinos.length >= 2 ? destinos[0] : null, SEM_DOIS_DESTINOS)) return;
      exigirNosOrcamentos(destinos[0], false, 'antes do vínculo');
      vincular(destinos[0], `PATCH que inclui a receita no atendimento ${destinos[0]}`);
      exigirNosOrcamentos(destinos[0], true, 'depois do vínculo');
    });

    it('29.8 Deve aceitar repetir o PATCH com o mesmo atendimento, mantendo o vínculo', function () {
      if (pularSemMassa(this, destinos.length >= 2 ? destinos[0] : null, SEM_DOIS_DESTINOS)) return;
      vincular(destinos[0], `PATCH repetido com o atendimento ${destinos[0]}`);
    });

    it('29.9 Deve trocar o vínculo da receita para outro atendimento aberto e com atendente, saindo dos orçamentos da origem e entrando nos do destino', function () {
      if (pularSemMassa(this, destinos.length >= 2 ? destinos[1] : null, SEM_DOIS_DESTINOS)) return;
      vincular(destinos[1], `PATCH que troca o vínculo de ${destinos[0]} para ${destinos[1]}`);
      exigirNosOrcamentos(destinos[0], false, 'depois da troca (origem)');
      exigirNosOrcamentos(destinos[1], true, 'depois da troca (destino)');
    });

    it('29.10 Deve remover o vínculo da receita com attendance_id nulo, e ela sai do detalhe e dos orçamentos do atendimento', function () {
      if (pularSemMassa(this, destinos.length >= 2 ? destinos[1] : null, SEM_DOIS_DESTINOS)) return;
      api.atualizarPrescricao(storeId, receitaId, { attendance_id: null }, { ...TIMEOUT_ROTA, failOnStatusCode: false }).then((res) => {
        expect(res.status, 'Status do PATCH que remove o vínculo').to.eq(200);
        expect(res.body.attendance_id, 'attendance_id na resposta da remoção').to.be.null;
      });
      detalhe().then((corpo) => {
        expect(corpo.attendance_id, 'attendance_id gravado após a remoção').to.be.null;
      });
      exigirNosOrcamentos(destinos[1], false, 'depois da remoção');
    });

  });

  context('30. Loja da Sessão Gravada na Criação da Receita, Nunca a Loja do Caminho (Issue backend#659, sub-issue da #649)', () => {

    // A backend#659 tira a loja do caminho: a receita passa a gravar a loja da sessão (`store_code` do token) em `CADASTRO_LJ`, exposta no detalhe como `store_id`.
    // Antes, `POST /stores/999/prescriptions` gravava a loja 999, que nem existe. Medido na dev em 2026-11-06 (aba-a): o JWT traz `store_code`, o detalhe traz `store_id`
    // e `pickup_store_id` separados, e a rota antiga com `/stores/:id` ainda responde (o passo 3 da #659, que a faz responder 404, ainda não chegou).
    // Receita não tem DELETE: cada teste cria 1 receita temporária por rodada (mesmo padrão dos ctx 15, 22 e 29). Paciente: DEFAULT_CLIENT_NAME; prescritor descoberto na hora.
    const TIMEOUT_ROTA = { timeout: 90000 };
    const LOJA_INEXISTENTE = 999999999;
    let lojaDaSessao = null;
    let cliente = null;
    let prescritorId = null;

    const corpoDaReceita = () => ({
      prescription_type: 'human', status: 0, sale_type: 1,
      patient_id: cliente.id, patient_name: cliente.name, buyer_id: cliente.id, buyer_name: cliente.name,
      prescriber_id: prescritorId, pickup_store_id: lojaDaSessao,
    });
    // O detalhe relido do servidor tem que repetir a loja da sessão, não só a resposta da criação
    const exigirLojaDaSessaoNoDetalhe = (receitaId, rotulo) => api.obterDetalhePrescricao(storeId, receitaId, TIMEOUT_ROTA).then((det) => {
      expect(det.status, `Status do detalhe da receita criada ${rotulo}`).to.eq(200);
      expect(det.body.store_id, `Loja gravada no detalhe da receita criada ${rotulo}`).to.eq(lojaDaSessao);
    });

    before(() => {
      api.obterUsuarioLogado(TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status de GET /users/me').to.eq(200);
        lojaDaSessao = res.body.store_code;
        expect(lojaDaSessao, 'Loja da sessão (store_code) é um inteiro positivo').to.be.a('number').and.to.be.greaterThan(0);
        expect(lojaDaSessao, 'A loja do caminho usada no teste não pode ser a da sessão').not.to.eq(LOJA_INEXISTENTE);
      });
      api.buscarClientes(storeId, configEnv.DEFAULT_CLIENT_NAME).then((resCli) => {
        cliente = (resCli.body && (resCli.body.items || resCli.body))[0];
        expect(cliente && cliente.id, '🔒 DEFAULT_CLIENT_NAME não achou cliente (massa)').to.be.ok;
      });
      // Atemporal: o primeiro prescritor que a busca devolver, sem código fixo (a busca só responde a partir de 3 caracteres; medido em 2026-11-06)
      api.buscarPrescritores(storeId, 'silva', TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status da busca de prescritores').to.eq(200);
        const item = ((res.body && (res.body.items || res.body)) || [])[0];
        expect(item && item.id, '🔒 A busca de prescritores não devolveu nenhum (massa)').to.be.ok;
        prescritorId = item.id;
      });
    });

    it('30.1 Deve gravar a loja da sessão como store_id da receita criada pela rota sem /stores/:id', () => {
      api.criarPrescricao(storeId, corpoDaReceita(), TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status do POST /prescriptions').to.be.oneOf([200, 201]);
        const receitaId = res.body.id || res.body.prescription_id;
        expect(receitaId, 'ID da receita criada pelo POST /prescriptions').to.be.ok;
        expect(res.body.store_id, 'Loja gravada na resposta do POST /prescriptions').to.eq(lojaDaSessao);
        exigirLojaDaSessaoNoDetalhe(receitaId, 'pelo POST /prescriptions');
      });
    });

    it('30.2 Deve gravar a loja da sessão, nunca a do caminho, ao criar a receita pela rota antiga com uma loja que não existe (ou responder 404 depois de removida)', () => {
      // Critério de aceite da #659: `POST /stores/999/prescriptions` grava a loja da sessão. O passo 3 da issue remove a rota antiga, e aí ela responde 404 sem criar nada.
      api.post(`/stores/${LOJA_INEXISTENTE}/prescriptions`, corpoDaReceita(), { ...TIMEOUT_ROTA, failOnStatusCode: false }).then((res) => {
        expect(res.status, `Status do POST /stores/${LOJA_INEXISTENTE}/prescriptions`).to.be.oneOf([200, 201, 404]);
        if (res.status === 404) {
          cy.log('Rota antiga removida (passo 3 da backend#659): 404 sem criar receita');
          return;
        }
        const receitaId = res.body.id || res.body.prescription_id;
        expect(receitaId, 'ID da receita criada pela rota antiga').to.be.ok;
        expect(res.body.store_id, 'A receita não pode gravar a loja do caminho').not.to.eq(LOJA_INEXISTENTE);
        expect(res.body.store_id, 'Loja gravada na resposta da rota antiga').to.eq(lojaDaSessao);
        exigirLojaDaSessaoNoDetalhe(receitaId, 'pela rota antiga');
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 31: DATA DE RETORNO EXIGIDA NA CONCLUSÃO E USO CONTÍNUO SÓ LEITURA (Issue backend#791)
  // ---------------------------------------------------------------------------
  context('31. Data de Retorno Exigida na Conclusão pela Loja (RETURN_DATE_REQUIRED) e Uso Contínuo Só Leitura na Fórmula (Issue backend#791)', () => {

    // A backend#791 pedia aceitar `continuous_use` no PATCH da fórmula, mas a flag não é coluna da fórmula: vem dos produtos (`ESTOQUE_GERAL.USOCONTINUO`) e segue só leitura.
    // O que entrou (PR #805, em produção desde 29/10) foi a regra do Desktop: se a loja da sessão exige a data de retorno (`settings.return_date_required`, tela 146),
    // o finalize recusa com `422 RETURN_DATE_REQUIRED` enquanto alguma fórmula calculada estiver sem `return_date`, citando os números das fórmulas.
    // Medido na dev em 2026-11-06 (aba-b, loja 1, receitas 261100416 e 261100417): "As fórmulas nº 1, 2 não possuem data de retorno registrada." com as duas,
    // "A fórmula nº 2 não possui data de retorno registrada." com só uma, `200` com as duas; o PATCH da data mantém a fórmula calculada; o PATCH só com `continuous_use`
    // responde 422 "Nenhum campo válido para atualização." e, junto de `return_date`, o campo é ignorado sem aviso.
    // Massa própria ([R-ATEMPORAL]): 1 receita temporária por rodada (receita não tem DELETE), com 2 fórmulas calculadas sem data; se a loja da sessão deixar de exigir a data, pula com o motivo.
    // Não afirma `can_finalize` (`ROADMAP.md` P1-62: segue `true` com a data faltando, a decidir com o dev).
    // Sem teste (`ROADMAP.md` P1-73): loja que não exige a data (conta e loja únicas na sessão), "fórmula não concluída não impede" (fórmula não calculada já barra o finalize) e a conta sem a 449.
    const TIMEOUT_ROTA = { timeout: 90000 };
    const TOLERA_RECUSA = { timeout: 90000, failOnStatusCode: false };
    const PRESCRITOR_ID = 18780;
    // Produto com uso contínuo no cadastro (`continuous_use: true` na fórmula), o mesmo dos contexts 25 e 26
    const PRODUTO_ID = 1004866;
    let prescricaoId = null;
    let exige = null;
    const formulas = {};

    const detalhe = () => cy.then(() => api.obterDetalhePrescricao(storeId, prescricaoId, TIMEOUT_ROTA)).then((res) => {
      expect(res.status, 'Status do detalhe da receita').to.eq(200);
      return res.body;
    });
    const criarFormula = (numero) => cy.then(() => api.criarFormulaPrescricao(storeId, prescricaoId, { formula_number: numero, pharmaceutical_form_id: 2, lab_id: 2, qvd: 30.0, multiplier: 1 }, TIMEOUT_ROTA)).then((resF) => {
      expect(resF.status, `Status da criação da fórmula ${numero} (sem return_date)`).to.eq(201);
      formulas[numero] = resF.body.id;
      return api.adicionarProdutoFormula(storeId, prescricaoId, resF.body.id, { product_id: PRODUTO_ID, quantity: 250.0, unit: 'mg' }, TIMEOUT_ROTA).then((resP) => {
        expect(resP.status, `Status do produto da fórmula ${numero}`).to.be.oneOf([200, 201]);
        return api.calcularFormula(storeId, prescricaoId, resF.body.id, TIMEOUT_ROTA).then((resC) => expect(resC.status, `Status do cálculo da fórmula ${numero}`).to.eq(200));
      });
    });
    const pularSemExigencia = (ctx) => {
      if (exige !== true) {
        cy.log('⏭️ A loja da sessão não exige a data de retorno (settings.return_date_required diferente de true): a recusa não se aplica nesta rodada');
        ctx.skip();
      }
    };

    before(() => {
      api.buscarClientes(storeId, configEnv.DEFAULT_CLIENT_NAME).then((resCli) => {
        const cliente = (resCli.body?.items || resCli.body)?.[0];
        expect(cliente, '🔒 massa: cliente DEFAULT_CLIENT_NAME').to.be.ok;
        api.criarPrescricao(storeId, {
          prescription_type: 'human', status: 0, sale_type: 1,
          patient_id: cliente.id, patient_name: cliente.name, buyer_id: cliente.id, buyer_name: cliente.name,
          prescriber_id: PRESCRITOR_ID, pickup_store_id: storeId,
        }, TIMEOUT_ROTA).then((res) => {
          expect(res.status, 'Status da criação da receita temporária').to.eq(201);
          prescricaoId = res.body.id;
        });
      });
      criarFormula(1);
      criarFormula(2);
      detalhe().then((receita) => {
        expect(receita.settings, 'settings do detalhe da receita').to.be.an('object');
        expect(receita.settings.return_date_required, 'settings.return_date_required').to.be.a('boolean');
        exige = receita.settings.return_date_required;
      });
    });

    it('31.1 Deve recusar a conclusão com 422 RETURN_DATE_REQUIRED citando as fórmulas sem data de retorno, no plural e no singular, manter a receita aberta e a fórmula calculada, e concluir quando as duas têm a data', function () {
      pularSemExigencia(this);
      // Act 1: as duas fórmulas calculadas, nenhuma com data
      cy.then(() => api.finalizarPrescricao(storeId, prescricaoId, TOLERA_RECUSA)).then((res) => {
        expect(res.status, 'Finalize sem nenhuma data de retorno').to.eq(422);
        expect(res.body.code, 'code da recusa').to.eq('RETURN_DATE_REQUIRED');
        expect(res.body.message, 'Mensagem no plural, com as duas fórmulas').to.eq('As fórmulas nº 1, 2 não possuem data de retorno registrada.');
      });
      detalhe().then((receita) => expect(receita.status, 'A receita continua aberta depois da recusa').to.eq(0));
      // Act 2: a data só na fórmula 1
      cy.then(() => api.atualizarFormulaPrescricao(storeId, prescricaoId, formulas[1], { return_date: api.dataDeRetornoFutura() }, TIMEOUT_ROTA)).then((res) => {
        expect(res.status, 'PATCH da data de retorno na fórmula 1 (grant 449)').to.eq(200);
      });
      detalhe().then((receita) => {
        const f1 = receita.formulas.find((f) => f.id === formulas[1]);
        expect(f1.return_date, 'A data gravada na fórmula 1').to.eq(api.dataDeRetornoFutura());
        expect(f1.calculated, 'O PATCH só da data não descalcula a fórmula').to.eq(true);
      });
      cy.then(() => api.finalizarPrescricao(storeId, prescricaoId, TOLERA_RECUSA)).then((res) => {
        expect(res.status, 'Finalize com só a fórmula 1 datada').to.eq(422);
        expect(res.body.code, 'code da recusa').to.eq('RETURN_DATE_REQUIRED');
        expect(res.body.message, 'Mensagem no singular, só com a fórmula 2').to.eq('A fórmula nº 2 não possui data de retorno registrada.');
      });
      // Act 3: a data também na fórmula 2
      cy.then(() => api.atualizarFormulaPrescricao(storeId, prescricaoId, formulas[2], { return_date: api.dataDeRetornoFutura() }, TIMEOUT_ROTA)).then((res) => {
        expect(res.status, 'PATCH da data de retorno na fórmula 2').to.eq(200);
      });
      cy.then(() => api.finalizarPrescricao(storeId, prescricaoId, TIMEOUT_ROTA)).then((res) => {
        expect(res.status, 'Finalize com as duas fórmulas datadas').to.eq(200);
      });
      detalhe().then((receita) => expect(receita.status, 'A receita concluída').to.eq(-1));
    });

    it('31.2 Deve manter continuous_use só leitura: derivado do produto no detalhe e recusado sozinho no PATCH da fórmula (Nenhum campo válido para atualização)', () => {
      // Arrange: o #31.1 conclui a receita; reabre para o PATCH não ser recusado por outro motivo
      detalhe().then((receita) => {
        if (receita.status === -1) {
          api.cancelarFinalizacaoPrescricao(storeId, prescricaoId, TIMEOUT_ROTA).then((res) => expect(res.status, 'Cancelamento da finalização para reabrir a receita').to.eq(200));
        }
      });
      detalhe().then((receita) => {
        expect(receita.status, 'Receita aberta antes do PATCH').to.eq(0);
        const f2 = receita.formulas.find((f) => f.id === formulas[2]);
        expect(f2.continuous_use, 'continuous_use derivado do produto de uso contínuo').to.eq(true);
        cy.then(() => api.atualizarFormulaPrescricao(storeId, prescricaoId, formulas[2], { continuous_use: false }, TOLERA_RECUSA)).then((res) => {
          expect(res.status, 'PATCH só com continuous_use').to.eq(422);
          expect(res.body.message, 'Mensagem da recusa').to.eq('Nenhum campo válido para atualização.');
        });
      });
      detalhe().then((receita) => {
        expect(receita.formulas.find((f) => f.id === formulas[2]).continuous_use, 'O PATCH recusado não muda o continuous_use').to.eq(true);
      });
    });

  });

});
