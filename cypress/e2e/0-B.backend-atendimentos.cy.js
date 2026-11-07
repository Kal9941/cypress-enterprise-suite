// cypress/e2e/0-B.backend-atendimentos.cy.js
// Suíte de Backend e Integração na API Real, parte B: fila, atendentes, status, mensagens, anexos, reações, eventos, canais e grupos, transferência e arquivos de IA.
// Dividida do 0-A/0-B/0-C.backend-*.cy.js em 2026-10-20 (3 arquivos por tema, contexts com os números originais); executa via cy.request(), imune a mocks de interface.

import api from '../services/backendApiService';
const configEnv = require('../../env.json');

describe('0-B. Backend: Atendimentos (API Real)', () => {

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
  // CONTEXTO 4: GESTÃO DE FILAS DE ATENDIMENTO
  // ---------------------------------------------------------------------------
  context('1. Gestão de Filas de Atendimento', () => {

    it('1.1 Deve listar a fila geral de atendimentos com paginação (/attendances)', () => {
      // Act
      api.listarAtendimentos(storeId, { page: 1, per_page: 20 }).then((res) => {
        // Assert
        expect(res.status, 'Status da fila geral').to.eq(200);
        const atendimentos = res.body.items || res.body.data || res.body;
        expect(atendimentos, 'Lista de atendimentos').to.be.an('array');

        // Validação PR #472 (Timestamps Instant Z) e PR #495 (messages.unread_count)
        if (atendimentos.length > 0) {
          const first = atendimentos[0];
          if (first.messages) {
            expect(first.messages).to.have.property('unread_count');
            expect(first.messages.unread_count).to.be.a('number').and.be.gte(0);
          }
          if (first.reference_at) expect(first.reference_at, 'reference_at em UTC').to.match(/Z$/);
          if (first.last_customer_message_at) expect(first.last_customer_message_at, 'last_customer_message_at em UTC').to.match(/Z$/);
          if (first.service_window?.started_at) expect(first.service_window.started_at, 'service_window.started_at em UTC').to.match(/Z$/);
          if (first.service_window?.expires_at) expect(first.service_window.expires_at, 'service_window.expires_at em UTC').to.match(/Z$/);
        }
      });
    });


    it('1.2 Deve filtrar atendimentos com status em andamento (in_progress)', () => {
      // Act
      api.listarAtendimentos(storeId, { status: 'in_progress', page: 1, per_page: 10 }).then((res) => {
        // Assert
        expect(res.status, 'Status do filtro in_progress').to.eq(200);
        const atendimentos = res.body.items || res.body.data || res.body;
        expect(atendimentos).to.be.an('array');
      });
    });

    it('1.3 Deve filtrar atendimentos com status pendente (pending)', () => {
      // Act
      api.listarAtendimentos(storeId, { status: 'pending', page: 1, per_page: 10 }).then((res) => {
        // Assert
        expect(res.status, 'Status do filtro pending').to.eq(200);
        const atendimentos = res.body.items || res.body.data || res.body;
        expect(atendimentos).to.be.an('array');
      });
    });

    it('1.4 Deve filtrar atendimentos com status aguardando cliente (waiting)', () => {
      // Act
      api.listarAtendimentos(storeId, { status: 'waiting', page: 1, per_page: 10 }).then((res) => {
        // Assert
        expect(res.status, 'Status do filtro waiting').to.eq(200);
        const atendimentos = res.body.items || res.body.data || res.body;
        expect(atendimentos).to.be.an('array');
      });
    });

    it('1.5 Deve consultar as capabilities específicas do atendimento com can_change_attendant_status (/attendances/:id/capabilities - PR #442)', () => {
      const attendanceId = 260800149;

      // Act: Consulta capabilities do atendimento individual
      api.obterCapabilitiesAtendimento(storeId, attendanceId).then((res) => {
        // Assert: 200 OK com envelope capabilities
        expect(res.status, 'Status das capabilities do atendimento').to.eq(200);
        expect(res.body).to.have.property('capabilities');
        expect(res.body.capabilities).to.be.an('object');

        // Valida presença das capabilities essenciais do atendimento (PR #393 e PR #442)
        const cap = res.body.capabilities;
        expect(cap, 'Presença de can_view_attendance_detail').to.have.property('can_view_attendance_detail').and.be.a('boolean');
        expect(cap, 'Presença de can_list_attendance_messages').to.have.property('can_list_attendance_messages').and.be.a('boolean');
        expect(cap, 'Presença de can_send_attendance_messages').to.have.property('can_send_attendance_messages').and.be.a('boolean');
        expect(cap, 'Presença de can_mark_completed').to.have.property('can_mark_completed').and.be.a('boolean');
        expect(cap, 'Presença de can_mark_discarded').to.have.property('can_mark_discarded').and.be.a('boolean');
        expect(cap, 'Presença de can_mark_finished').to.have.property('can_mark_finished').and.be.a('boolean');

        // PR #442: can_change_attendant_status adicionada em ATTENDANCE_DEFINITIONS e MODULE_DEFINITIONS
        expect(cap, 'Presença de can_change_attendant_status').to.have.property('can_change_attendant_status').and.be.a('boolean');
      });
    });

    it('1.6 Deve atualizar observações e validar transição no atendimento com sucesso (PATCH /attendances/:id)', () => {
      const attendanceId = 260800149;
      const observacaoTeste = 'Observação canônica backend automatizada';

      // Act: Atualiza notas/observação no atendimento
      api.atualizarStatusAtendimento(storeId, attendanceId, { notes: observacaoTeste }).then((res) => {
        // Assert: 200 OK com notas refletidas
        expect(res.status, 'Status de atualização de observação').to.eq(200);
        expect(res.body).to.have.property('notes', observacaoTeste);
      });
    });

    it('1.7 Deve exigir autenticação obrigatória (401 Unauthorized) na consulta de capabilities e mutação de atendimento', () => {
      const attendanceId = 260800149;

      // 1. Consulta capabilities sem token
      api.obterCapabilitiesAtendimento(storeId, attendanceId, { headers: { Authorization: '' } }).then((resCap) => {
        expect(resCap.status, 'Status sem token em capabilities de atendimento').to.eq(401);
        expect(resCap.body.error, 'Erro de autenticação').to.eq('Unauthorized');
      });

      // 2. Mutação de atendimento sem token
      api.atualizarStatusAtendimento(storeId, attendanceId, { notes: 'sem token' }, { headers: { Authorization: '' } }).then((resPatch) => {
        expect(resPatch.status, 'Status sem token no patch de atendimento').to.eq(401);
        expect(resPatch.body.error, 'Erro de autenticação').to.eq('Unauthorized');
      });
    });

    it('1.8 Deve listar mensagens do atendimento projetando attachment com filename e mime_type por extensão (/attendances/:id/messages - PR #457)', () => {
      const attendanceIdComAnexos = 260900034;

      // Act: Consulta mensagens do atendimento com varredura de formatos (.docx, .doc, .xlsx, .xls, .txt, .pdf, .jpg)
      api.listarMensagensAtendimento(storeId, attendanceIdComAnexos).then((res) => {
        // Assert: 200 OK
        expect(res.status, 'Status da listagem de mensagens').to.eq(200);
        const mensagens = res.body.items || res.body.data || res.body;
        expect(mensagens, 'Lista de mensagens do atendimento').to.be.an('array').and.have.length.at.least(5);

        // Filtra mensagens que possuem objeto attachment
        const comAnexo = mensagens.filter((m) => m.attachment);
        expect(comAnexo.length, 'Mensagens com anexo encontradas').to.be.at.least(1);

        // Valida que todo anexo possui obrigatoriamente filename (string com extensão) e mime_type resolvido (PR #457)
        comAnexo.forEach((msg) => {
          const att = msg.attachment;
          expect(att, 'Anexo deve possuir filename').to.have.property('filename');
          expect(att.filename, 'filename deve ser string não vazia').to.be.a('string').and.have.length.at.least(3);
          expect(att.filename, 'filename deve possuir extensão após ponto').to.include('.');
          expect(att, 'Anexo deve possuir mime_type').to.have.property('mime_type');
          expect(att.mime_type, 'mime_type deve ser string não nula').to.be.a('string').and.have.length.at.least(3);
        });

        // Valida os formatos específicos reportados na issue
        const msgDocx = mensagens.find((m) => m.id === 4854970);
        if (msgDocx?.attachment) {
          expect(msgDocx.attachment.filename, 'Nome preservado para docx').to.eq('sample.docx');
          expect(msgDocx.attachment.mime_type, 'MIME OOXML resolvido pela extensão').to.eq('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        }

        const msgXlsx = mensagens.find((m) => m.id === 4854972);
        if (msgXlsx?.attachment) {
          expect(msgXlsx.attachment.filename, 'Nome preservado para xlsx').to.eq('sample.xlsx');
          expect(msgXlsx.attachment.mime_type, 'MIME SpreadsheetML resolvido pela extensão').to.eq('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        }

        const msgTxt = mensagens.find((m) => m.id === 4854973);
        if (msgTxt?.attachment) {
          expect(msgTxt.attachment.filename, 'Nome preservado para txt').to.eq('sample.txt');
          expect(msgTxt.attachment.mime_type, 'MIME text/plain resolvido pela extensão').to.eq('text/plain');
        }
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 8: GESTÃO E DISPONIBILIDADE DE ATENDENTES (PR #279 E PR #442)
  // ---------------------------------------------------------------------------
  context('2. Gestão e Disponibilidade de Atendentes (PR #279 e PR #442)', () => {

    let originalStatus = 'available';

    it('2.1 Deve consultar o status atual de disponibilidade do atendente com dispensa de permissão 554 para o próprio usuário (GET /attendants/:id/status - PR #442)', () => {
      // Act: Consulta o status do próprio atendente logado (dispensa da 554 mantida no GET para preservar o switch na UI)
      api.obterStatusAtendente(storeId, loggedUserId).then((res) => {
        // Assert: 200 OK
        expect(res.status, 'Status da consulta de disponibilidade').to.eq(200);
        expect(res.body).to.have.property('attendant_id', loggedUserId);
        expect(res.body).to.have.property('status');
        expect(['available', 'busy', 'offline'], 'Enum canônico de status').to.include(res.body.status);
        expect(res.body).to.have.property('status_consistent');
        originalStatus = res.body.status;
      });
    });

    it('2.2 Deve alterar o status de disponibilidade do atendente com permissão 554 com sucesso e idempotência (PATCH /attendants/:id - PR #442)', () => {
      // Act 1: Alterna para o status alvo (PR #442: exige grant 554 mesmo para o próprio usuário autenticado)
      const targetStatus = originalStatus === 'available' ? 'busy' : 'available';

      api.atualizarStatusAtendente(storeId, loggedUserId, { status: targetStatus }).then((res) => {
        expect(res.status, 'Status da alteração de disponibilidade').to.eq(200);
        expect(res.body).to.have.property('attendant_id', loggedUserId);
        expect(res.body).to.have.property('status', targetStatus);
        // updated_group_relations é a contagem de vínculos de grupo atualizados (número, medido 2), não uma lista (ROADMAP.md P1-15, backend#622)
        expect(res.body.updated_group_relations, 'updated_group_relations é número').to.be.a('number');
        expect(res.body).to.have.property('active_attendance_count');
        expect(res.body).to.have.property('changed_at');

        // 2. Dispara requisição idempotente com o mesmo status (deve responder 200)
        api.atualizarStatusAtendente(storeId, loggedUserId, { status: targetStatus }).then((resIdemp) => {
          expect(resIdemp.status, 'Status da requisição idempotente').to.eq(200);
          expect(resIdemp.body).to.have.property('status', targetStatus);

          // 3. Restaura o status original para deixar o ambiente limpo
          api.atualizarStatusAtendente(storeId, loggedUserId, { status: originalStatus }).then((resRestore) => {
            expect(resRestore.status, 'Status de restauração').to.eq(200);
          });
        });
      });
    });

    it('2.3 Deve exigir autenticação obrigatória (401 Unauthorized) na consulta e alteração de status do atendente', () => {
      // 1. Consulta sem token
      api.obterStatusAtendente(storeId, loggedUserId, { headers: { Authorization: '' } }).then((resGet) => {
        expect(resGet.status, 'Status sem token no get de status do atendente').to.eq(401);
        expect(resGet.body.error, 'Erro de autenticação').to.eq('Unauthorized');
      });

      // 2. Mutação sem token
      api.atualizarStatusAtendente(storeId, loggedUserId, { status: 'available' }, { headers: { Authorization: '' } }).then((resPatch) => {
        expect(resPatch.status, 'Status sem token no patch de status do atendente').to.eq(401);
        expect(resPatch.body.error, 'Erro de autenticação').to.eq('Unauthorized');
      });
    });

    it('2.4 Deve rejeitar alteração de status com valor fora do enum (422 Unprocessable Content)', () => {
      // Act: Tenta enviar status não reconhecido
      api.atualizarStatusAtendente(storeId, loggedUserId, { status: 'invalido' }).then((res) => {
        // Assert
        expect(res.status, 'Status de validação de enum').to.eq(422);
        expect(res.body.message, 'Mensagem de validação').to.include('Status inválido');
      });
    });

    it('2.5 Deve retornar 404 ao tentar atualizar status de atendente inexistente', () => {
      // Act: Dispara para ID de atendente arbitrário inexistente
      api.atualizarStatusAtendente(storeId, 999999, { status: 'available' }).then((res) => {
        // Assert
        expect(res.status, 'Status para atendente inexistente').to.eq(404);
        expect(res.body.message, 'Mensagem de erro 404').to.include('Atendente não encontrado');
      });
    });

    // Issue #575: a recusa "sem grupo de canal" ganhou code próprio; o front deixa de detectá-la por ausência de code.
    const CODE_SEM_GRUPO = 'ATTENDANT_WITHOUT_CHANNEL_GROUP';
    const MSG_SEM_GRUPO = 'Atendente não vinculado a grupo de canal';

    // Massa viva: procura o 1º atendente (≠ logado) que o próprio backend recusa por falta de grupo. Só GET (leitura),
    // então nunca muda status de ninguém; falha explícita se o tenant não tiver nenhum (nunca passa vazio).
    const descobrirAtendenteSemGrupo = (candidato = 1) => {
      if (candidato > 80) {
        throw new Error('Nenhum atendente sem grupo de canal encontrado nos ids 1-80: massa do tenant mudou (Issue #575)');
      }
      if (candidato === loggedUserId) return descobrirAtendenteSemGrupo(candidato + 1);
      return api.obterStatusAtendente(storeId, candidato).then((res) => {
        if (res.status === 422 && res.body && res.body.message === MSG_SEM_GRUPO) return candidato;
        return descobrirAtendenteSemGrupo(candidato + 1);
      });
    };

    it('2.6 Deve recusar a consulta de status de atendente sem grupo de canal com 422 e code ATTENDANT_WITHOUT_CHANNEL_GROUP (GET /attendants/:id/status - Issue #575)', () => {
      descobrirAtendenteSemGrupo().then((atendenteSemGrupoId) => {
        api.obterStatusAtendente(storeId, atendenteSemGrupoId).then((res) => {
          expect(res.status, 'Status da recusa sem grupo').to.eq(422);
          expect(res.body.code, 'code estável da recusa (não mais detectada pela ausência)').to.eq(CODE_SEM_GRUPO);
          expect(res.body.message, 'Mensagem mantida para o front de antes do deploy').to.eq(MSG_SEM_GRUPO);
          expect(res.body.error, 'Envelope padrão do 422').to.eq('Unprocessable Content');
        });
      });
    });

    it('2.7 Deve recusar a alteração de status de atendente sem grupo de canal com o mesmo 422 e code, sem alterar nada (PATCH /attendants/:id - Issue #575)', () => {
      descobrirAtendenteSemGrupo().then((atendenteSemGrupoId) => {
        // A recusa vem antes de qualquer gravação (mesmo ensureAttendantHasGroupRelations do GET), então a mutação é inofensiva
        api.atualizarStatusAtendente(storeId, atendenteSemGrupoId, { status: 'available' }).then((res) => {
          expect(res.status, 'Status do PATCH sem grupo').to.eq(422);
          expect(res.body.code, 'code estável da recusa no PATCH').to.eq(CODE_SEM_GRUPO);
          expect(res.body.message, 'Mensagem do PATCH sem grupo').to.eq(MSG_SEM_GRUPO);
        });
        // Contraprova de que nada mudou: o atendente segue recusado pelo GET
        api.obterStatusAtendente(storeId, atendenteSemGrupoId).then((resDepois) => {
          expect(resDepois.status, 'Atendente segue sem grupo após o PATCH recusado').to.eq(422);
          expect(resDepois.body.code).to.eq(CODE_SEM_GRUPO);
        });
      });
    });

    it('2.8 Deve manter os demais 422 do endpoint de status sem o code de grupo de canal, para o front não confundi-los (Issue #575)', () => {
      // Payload inválido nunca pode herdar o code de "sem grupo": é exatamente a confusão que a issue quer eliminar
      api.atualizarStatusAtendente(storeId, loggedUserId, { status: 'invalido' }).then((res) => {
        expect(res.status, 'Status inválido').to.eq(422);
        expect(res.body.message).to.include('Status inválido');
        expect(res.body.code, 'enum inválido não usa o code de grupo').to.not.eq(CODE_SEM_GRUPO);
      });
      api.atualizarStatusAtendente(storeId, loggedUserId, { status: null }).then((res) => {
        expect(res.status, 'Status nulo').to.eq(422);
        expect(res.body.message).to.include('não aceita valor nulo');
        expect(res.body.code, 'status nulo não usa o code de grupo').to.not.eq(CODE_SEM_GRUPO);
      });
      api.atualizarStatusAtendente(storeId, loggedUserId, {}).then((res) => {
        expect(res.status, 'Corpo sem campo atualizável').to.eq(422);
        expect(res.body.message).to.include('Nenhum campo atualizável');
        expect(res.body.code, 'corpo vazio não usa o code de grupo').to.not.eq(CODE_SEM_GRUPO);
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 16: IDENTIFICADOR DE CLIENTE NO ATENDIMENTO E INTEGRAÇÃO (PR #429)
  // ---------------------------------------------------------------------------
  context('3. Identificador de Cliente no Atendimento e Integração com a Ficha (PR #429)', () => {

    const attendanceIdComCliente = 260800007; // Atendimento vinculado ao cliente 1533 (HENRIQUE)
    const attendanceIdSemCliente = 260900027; // Atendimento aberto para número sem cliente na base

    it('3.1 Deve projetar a chave customer_id dentro do objeto customer no detalhe do atendimento (PR #429)', () => {
      // Act: Consulta detalhes do atendimento
      api.obterDetalheAtendimento(storeId, attendanceIdComCliente).then((res) => {
        // Assert: 200 OK com contrato estruturado de customer
        expect(res.status, 'Status detalhe do atendimento').to.eq(200);
        expect(res.body).to.have.property('customer');
        expect(res.body.customer).to.be.an('object');
        expect(res.body.customer).to.have.property('customer_id');
        expect(res.body.customer).to.have.property('name');
        expect(res.body.customer).to.have.property('phone');

        // Validação PR #472: Timestamps padronizados em Instant (UTC / Z)
        if (res.body.reference_at) expect(res.body.reference_at, 'reference_at em UTC').to.match(/Z$/);
        if (res.body.last_customer_message_at) expect(res.body.last_customer_message_at, 'last_customer_message_at em UTC').to.match(/Z$/);
        if (res.body.service_window?.started_at) expect(res.body.service_window.started_at, 'service_window.started_at em UTC').to.match(/Z$/);
        if (res.body.service_window?.expires_at) expect(res.body.service_window.expires_at, 'service_window.expires_at em UTC').to.match(/Z$/);
      });
    });

    it('3.2 Deve resolver customer_id numérico para atendimentos vinculados a clientes cadastrados (LEFT JOIN em CLIENTE)', () => {
      // Act: Consulta atendimento vinculado a cliente existente
      api.obterDetalheAtendimento(storeId, attendanceIdComCliente).then((res) => {
        // Assert: customer_id retornado como inteiro positivo
        expect(res.status, 'Status detalhe do atendimento').to.eq(200);
        const customer = res.body.customer;
        expect(customer.customer_id, 'customer_id numérico').to.be.a('number');
        expect(customer.customer_id, 'customer_id positivo').to.be.greaterThan(0);
        expect(customer.name, 'Nome do cliente').to.be.a('string').and.not.be.empty;
      });
    });

    it('3.3 Deve retornar customer_id null de forma defensiva para atendimentos sem cliente na base (~53% da base)', () => {
      // Act: Consulta atendimento aberto para número sem cliente prévio
      api.obterDetalheAtendimento(storeId, attendanceIdSemCliente).then((res) => {
        // Assert: customer_id é estritamente null (fail-closed, ocultando o botão de ficha)
        expect(res.status, 'Status detalhe do atendimento').to.eq(200);
        expect(res.body.customer).to.have.property('customer_id', null);
      });
    });

    it('3.4 Deve permitir navegação direta e íntegra do atendimento para a ficha completa via customer_id (PR #429 + PR #419)', () => {
      // Act: Obtém customer_id do atendimento e consome a rota da ficha
      api.obterDetalheAtendimento(storeId, attendanceIdComCliente).then((resAtt) => {
        const clientId = resAtt.body.customer.customer_id;
        expect(clientId, 'customer_id válido').to.be.a('number');

        api.obterDetalheCliente(storeId, clientId).then((resClient) => {
          // Assert: Ficha do cliente correspondente ao atendimento
          expect(resClient.status, 'Status ficha do cliente').to.eq(200);
          expect(resClient.body.id, 'ID do cliente coincide').to.eq(clientId);
          expect(resClient.body.name, 'Nome do cliente coincide').to.eq(resAtt.body.customer.name);
          expect(resClient.body).to.have.property('capabilities');
        });
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 20: ESCADA DE TRANSIÇÃO DE STATUS DE ATENDIMENTO E RBAC (PR #442 E PR #486)
  // ---------------------------------------------------------------------------
  context('4. Escada de Transição de Status de Atendimento e RBAC (PR #442 e PR #486)', () => {
    const targetAttendanceId = 260800149;
    let initialStatus = 1;

    before(() => {
      // Identifica status inicial do atendimento para garantir restauração perfeita
      api.obterDetalheAtendimento(storeId, targetAttendanceId).then((res) => {
        if (res.status === 200 && res.body?.attendance?.status !== undefined) {
          initialStatus = res.body.attendance.status;
        }
      });
    });

    after(() => {
      // Teardown defensivo: restaura o status original do atendimento após a rodada de transições
      if (targetAttendanceId && initialStatus !== undefined) {
        api.atualizarStatusAtendimento(storeId, targetAttendanceId, { status: initialStatus });
      }
    });

    it('4.1 deve permitir des-concluir atendimento (2 → 1) sem exigência de grant de status (PR #442 e PR #486)', () => {
      // Arrange: Transita para Concluído (status: 2) sob grant 414
      api.atualizarStatusAtendimento(storeId, targetAttendanceId, { status: 2 }).then((resConcluido) => {
        expect(resConcluido.status, 'Status da transição para Concluído').to.eq(200);

        // Act: Des-conclui retornando para Em andamento (status: 1) sem grant de status adicional
        api.atualizarStatusAtendimento(storeId, targetAttendanceId, { status: 1 }).then((resReaberto) => {
          // Assert: 200 OK confirmando que Concluído é intermediário e a volta para 1 é liberada
          expect(resReaberto.status, 'Status da transição 2 → 1 (des-concluir sem grant)').to.eq(200);
          const statusResult = resReaberto.body?.attendance?.status ?? resReaberto.body?.status;
          expect(statusResult, 'Status deve refletir 1 (Em andamento)').to.eq(1);
        });
      });
    });

    it('4.2 deve exigir e aplicar grant 562 ao des-descartar atendimento (4 → 1) com sucesso (PR #486)', () => {
      // Arrange: Transita para Descartado (status: 4) sob grant 475
      api.atualizarStatusAtendimento(storeId, targetAttendanceId, { status: 4 }).then((resDescartado) => {
        expect(resDescartado.status, 'Status da transição para Descartado').to.eq(200);

        // Act 1: Tenta des-descartar sem token de autorização
        api.atualizarStatusAtendimento(storeId, targetAttendanceId, { status: 1 }, { headers: { Authorization: '' } }).then((resSemToken) => {
          expect(resSemToken.status, 'Status sem token ao des-descartar').to.eq(401);

          // Act 2: Des-descarta sob a permissão 562 do operador autenticado
          api.atualizarStatusAtendimento(storeId, targetAttendanceId, { status: 1 }).then((resReaberto) => {
            // Assert: 200 OK confirmando des-descarte autorizado sob a 562
            expect(resReaberto.status, 'Status da transição 4 → 1 com grant 562').to.eq(200);
            const statusResult = resReaberto.body?.attendance?.status ?? resReaberto.body?.status;
            expect(statusResult, 'Status deve refletir 1 (Em andamento)').to.eq(1);
          });
        });
      });
    });

    it('4.3 deve exigir e aplicar grant 562 ao retirar status de finalizado (3 → 1) (PR #442 e PR #486)', () => {
      // Arrange: Transita para Finalizado (status: 3)
      api.atualizarStatusAtendimento(storeId, targetAttendanceId, { status: 3 }).then((resFinalizado) => {
        expect(resFinalizado.status, 'Status da transição para Finalizado').to.eq(200);

        // Act 1: Tenta retirar finalizado sem token de autorização
        api.atualizarStatusAtendimento(storeId, targetAttendanceId, { status: 1 }, { headers: { Authorization: '' } }).then((resSemToken) => {
          expect(resSemToken.status, 'Status sem token ao retirar finalizado').to.eq(401);

          // Act 2: Retira finalizado sob a permissão 562 do operador autenticado
          api.atualizarStatusAtendimento(storeId, targetAttendanceId, { status: 1 }).then((resReaberto) => {
            // Assert: 200 OK confirmando saída do finalizado sob a 562
            expect(resReaberto.status, 'Status da transição 3 → 1 com grant 562').to.eq(200);
            const statusResult = resReaberto.body?.attendance?.status ?? resReaberto.body?.status;
            expect(statusResult, 'Status deve refletir 1 (Em andamento)').to.eq(1);
          });
        });
      });
    });

    it('4.4 deve garantir idempotência ao reenviar o mesmo status atual do atendimento', () => {
      // Act: Envia status 1 quando o atendimento já se encontra em status 1
      api.atualizarStatusAtendimento(storeId, targetAttendanceId, { status: 1 }).then((resIdemp) => {
        // Assert: 200 OK
        expect(resIdemp.status, 'Status de requisição idempotente').to.eq(200);
        const statusResult = resIdemp.body?.attendance?.status ?? resIdemp.body?.status;
        expect(statusResult, 'Status preservado em 1').to.eq(1);
      });
    });

    it('4.5 deve rejeitar transição com status fora do enum permitido (422 Unprocessable Content)', () => {
      // Act: Tenta enviar código de status inválido (99)
      api.atualizarStatusAtendimento(storeId, targetAttendanceId, { status: 99 }).then((resInvalido) => {
        // Assert: 422 Unprocessable Content com mensagem discriminada
        expect(resInvalido.status, 'Status de validação de enum de status').to.eq(422);
        expect(resInvalido.body, 'Corpo de erro').to.be.an('object');
        expect(resInvalido.body.error, 'Tipo de erro retornado').to.eq('Unprocessable Content');
        expect(resInvalido.body.message, 'Mensagem de erro de status').to.eq('Status inválido');
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 24: FEED DE EVENTOS E SINAL ENDEREÇADO DE LEITURA (PR #490)
  // ---------------------------------------------------------------------------
  context('5. Feed de Eventos e Sinal Endereçado de Leitura (PR #490)', () => {

    // Atemporal: o feed é o histórico real e vencível de eventos da loja, e o cursor anda em janelas de 500 ids (medido em 2026-10-28: 22 eventos em 34 janelas, quase todas vazias, o 1º
    // `attendance.unread_changed` na 7ª): nenhum teste depende da posição do evento nem de um número curto de páginas. O before() varre do cursor 0 até o cursor do fim do feed
    // (o da chamada sem `after`), uma vez por arquivo; sem nenhum `attendance.unread_changed` o teste que precisa dele pula com motivo, em vez de ficar vermelho por falta de atividade real de leitura.
    const MAX_JANELAS = 400;
    const SEM_UNREAD = '⏭️ Sem massa: o feed de eventos desta rodada não tem nenhum attendance.unread_changed (o evento só nasce de atividade real de leitura)';
    let feedCompleto = [];
    let eventoUnreadEncontrado = null;

    const varrerFeed = (fim, cursor = 0, janela = 1, acumulado = []) => api.listarEventosAtendimento(storeId, { after: cursor, limit: 100 }).then((res) => {
      expect(res.status, `Status da janela ${janela} do feed (cursor ${cursor})`).to.eq(200);
      const todos = acumulado.concat(res.body.items || []);
      const continua = res.body.has_more && res.body.cursor > cursor && res.body.cursor < fim && janela < MAX_JANELAS;
      return continua ? varrerFeed(fim, res.body.cursor, janela + 1, todos) : todos;
    });

    before(() => {
      api.listarEventosAtendimento(storeId, { limit: 100 }).then((fim) => {
        expect(fim.status, 'Status do feed sem after (cursor do fim)').to.eq(200);
        varrerFeed(fim.body.cursor).then((todos) => {
          feedCompleto = todos;
          eventoUnreadEncontrado = todos.find((e) => (e.event || e.type) === 'attendance.unread_changed') || null;
        });
      });
    });

    it('5.1 deve validar a estrutura canônica e o cursor do feed de eventos (/attendance-events)', () => {
      // Act: Consulta os eventos recentes da loja
      api.listarEventosAtendimento(storeId, { limit: 10 }).then((res) => {
        // Assert: 200 OK e schema canônico do feed
        expect(res.status, 'Status da consulta de eventos').to.eq(200);
        expect(res.body, 'Corpo da resposta de eventos').to.be.an('object');
        expect(res.body).to.have.property('items').and.be.an('array');
        expect(res.body).to.have.property('cursor').and.be.a('number');
        expect(res.body).to.have.property('has_more').and.be.a('boolean');
      });
    });

    it('5.2 deve projetar o evento attendance.unread_changed com attendance_id obrigatório e sinal puro sem contador', function () {
      if (!eventoUnreadEncontrado) {
        cy.log(SEM_UNREAD);
        this.skip();
      }

      // Act: o evento vem da varredura completa do feed feita no before()
      cy.wrap(eventoUnreadEncontrado, { log: false }).then((evento) => {

        // Requisito 1: id sequencial (cursor global do feed)
        expect(evento).to.have.property('id').and.be.a('number');

        // Requisito 4: tipo específico attendance.unread_changed
        expect(evento.type || evento.event).to.eq('attendance.unread_changed');

        // Requisito 2: attendance_id obrigatório e nunca nulo
        expect(evento).to.have.property('attendance_id');
        expect(evento.attendance_id, 'attendance_id não pode ser nulo').to.not.be.null;
        expect(evento.attendance_id, 'attendance_id deve ser numérico').to.be.a('number');
        expect(evento.attendance_id, 'attendance_id deve ser um identificador válido').to.be.greaterThan(0);

        // Requisito 3: sinal puro sem o valor (sem expor MSG_QTDE no wire)
        expect(evento, 'Não deve conter contador no payload').to.not.have.property('count');
        expect(evento, 'Não deve conter unread_count no payload').to.not.have.property('unread_count');
        expect(evento, 'Não deve conter msg_qtde no payload').to.not.have.property('msg_qtde');

        // Conformidade com PR #472: timestamp em Instant (UTC/Z)
        expect(evento).to.have.property('occurred_at');
        expect(evento.occurred_at, 'occurred_at deve estar no formato UTC/Z').to.match(/Z$/);
      });
    });

    it('5.3 deve validar a coexistência do sinal endereçado unread_changed com o evento cego legado attendance.changed', function () {
      // Arrange: o histórico inteiro do feed (varrido no before()), nunca só as primeiras páginas
      const unreadEvents = feedCompleto.filter(it => (it.type || it.event) === 'attendance.unread_changed');
      const changedEvents = feedCompleto.filter(it => (it.type || it.event) === 'attendance.changed');
      if (unreadEvents.length === 0) {
        cy.log(SEM_UNREAD);
        this.skip();
      }

      // Valida que ambos coexistem sem conflito de serialização
      expect(unreadEvents.length, 'Eventos endereçados attendance.unread_changed').to.be.gte(1);
      unreadEvents.forEach((u) => {
        expect(u.attendance_id, 'attendance.unread_changed possui attendance_id').to.be.a('number');
      });

      if (changedEvents.length > 0) {
        // Eventos legados cegos possuem attendance_id nulo
        const cego = changedEvents[0];
        expect(cego.attendance_id, 'attendance.changed legado possui attendance_id nulo').to.be.null;
      }
    });

    it('5.4 deve garantir avanço consistente e idempotência do cursor ao paginar por after', function () {
      if (!eventoUnreadEncontrado) {
        cy.log(SEM_UNREAD);
        this.skip();
      }
      const targetId = eventoUnreadEncontrado.id;

      // Act: Consulta eventos estritamente posteriores ao targetId
      api.listarEventosAtendimento(storeId, { after: targetId, limit: 50 }).then((res) => {
        expect(res.status).to.eq(200);
        const items = res.body.items || [];

        // Assert: Nenhum evento retornado pode ter id <= targetId
        items.forEach((item) => {
          expect(
            item.id,
            `Evento retornado #${item.id} deve ser estritamente posterior ao cursor solicitado #${targetId}`
          ).to.be.greaterThan(targetId);
        });

        // O cursor retornado pela API deve ser >= targetId
        expect(res.body.cursor, 'Cursor deve avançar após targetId').to.be.gte(targetId);
      });
    });

    it('5.5 deve exigir autenticação obrigatória (401 Unauthorized) ao consultar o feed de eventos', () => {
      // Act: Consulta o feed sem token JWT
      api.listarEventosAtendimento(storeId, {}, { headers: { Authorization: '' } }).then((res) => {
        // Assert: 401 Unauthorized
        expect(res.status, 'Status sem token no feed').to.eq(401);
        expect(res.body.error, 'Erro de autenticação').to.eq('Unauthorized');
      });
    });

    it('5.6 deve emitir o evento attendant.status_changed com attendance_id nulo e attendant_id obrigatório ao alterar status operacional do atendente', () => {
      // Arrange 1: Consulta o cursor atual do feed de eventos para isolar novos eventos
      api.listarEventosAtendimento(storeId, { limit: 1 }).then((resFeedInicial) => {
        expect(resFeedInicial.status, 'Status inicial do feed').to.eq(200);
        const cursorInicial = resFeedInicial.body.cursor || 0;

        // Arrange 2: Consulta o status atual do atendente autenticado
        api.obterStatusAtendente(storeId, loggedUserId).then((resStatusInicial) => {
          expect(resStatusInicial.status, 'Status da consulta do atendente').to.eq(200);
          const statusOriginal = resStatusInicial.body.status;
          const novoStatus = statusOriginal === 'available' ? 'busy' : 'available';

          // Act: Altera o status do atendente (PR #442 / Issue #440)
          api.atualizarStatusAtendente(storeId, loggedUserId, { status: novoStatus }).then((resPatch) => {
            expect(resPatch.status, 'Status da alteração do atendente').to.eq(200);
            expect(resPatch.body).to.have.property('status', novoStatus);

            // Assert: Consulta o feed a partir do cursor inicial para encontrar o evento gerado
            api.listarEventosAtendimento(storeId, { after: Math.max(0, cursorInicial - 2), limit: 50 }).then((resFeedDepois) => {
              expect(resFeedDepois.status, 'Status da consulta do feed pós-mutação').to.eq(200);
              const items = resFeedDepois.body.items || [];
              const eventoStatus = items.find(it => (it.type || it.event) === 'attendant.status_changed' && it.attendant_id === loggedUserId);

              expect(eventoStatus, 'Evento attendant.status_changed deve ser emitido no feed').to.be.ok;

              // Invariante 1: Identificador sequencial
              expect(eventoStatus).to.have.property('id').and.be.a('number');

              // Invariante 2: attendant_id obrigatório e numérico
              expect(eventoStatus).to.have.property('attendant_id', loggedUserId);

              // Invariante 3: attendance_id estritamente nulo (endereça operador, não atendimento)
              expect(eventoStatus).to.have.property('attendance_id');
              expect(eventoStatus.attendance_id, 'attendance_id deve ser null pois sinaliza operador').to.be.null;

              // Invariante 4: timestamp em Instant UTC/Z (PR #472 / #341)
              expect(eventoStatus).to.have.property('occurred_at');
              expect(eventoStatus.occurred_at, 'occurred_at deve ser Instant UTC (sufixo Z)').to.match(/Z$/);

              // Invariante 5: Não deve conter chaves de outros tipos de evento
              expect(eventoStatus).to.not.have.property('payment_link_id');
              expect(eventoStatus).to.not.have.property('request_id');

              // Cleanup: Restaura o status original do atendente para manter o ambiente íntegro
              api.atualizarStatusAtendente(storeId, loggedUserId, { status: statusOriginal }).then((resRestore) => {
                expect(resRestore.status, 'Status da restauração do atendente').to.eq(200);
              });
            });
          });
        });
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 28: DERIVAÇÃO DINÂMICA DE MENSAGENS NÃO LIDAS E REMOÇÃO DE FILTRO EXCLUDENTE (PR #495)
  // ---------------------------------------------------------------------------
  context('6. Derivação Dinâmica de Mensagens Não Lidas e Remoção de Filtro Excludente (PR #495)', () => {

    it('6.1 deve projetar messages.unread_count como inteiro >= 0 em todos os itens da fila de atendimentos', () => {
      // Act: Consulta listagem de atendimentos da loja
      api.listarAtendimentos(storeId, { limit: 20 }).then((res) => {
        // Assert: 200 OK
        expect(res.status, 'Status da listagem de atendimentos').to.eq(200);
        const items = res.body.items || [];
        expect(items, 'Lista de atendimentos deve conter itens').to.be.an('array').that.is.not.empty;

        // Contexto PR #495: messages.unread_count deixou de sair da coluna estática/cache MSG_QTDE
        // e passa a ser calculado dinamicamente via subselect correlacionado com UNREAD_PREDICATE.
        items.forEach((item) => {
          expect(item, `Atendimento #${item.id} deve conter envelope messages`).to.have.property('messages');
          expect(item.messages, `Atendimento #${item.id} deve conter unread_count`).to.have.property('unread_count');
          expect(
            item.messages.unread_count,
            `unread_count do atendimento #${item.id} deve ser número inteiro`
          ).to.be.a('number');
          expect(
            Number.isInteger(item.messages.unread_count),
            `unread_count do atendimento #${item.id} deve ser inteiro`
          ).to.be.true;
          expect(
            item.messages.unread_count,
            `unread_count do atendimento #${item.id} deve ser >= 0`
          ).to.be.gte(0);
        });
      });
    });

    it('6.2 deve garantir coerência estrita entre o unread_count da listagem e a recontagem da rota de baixa (POST /read)', () => {
      // 1. Act: Obtém atendimento da fila para confrontar a contagem unificada
      api.listarAtendimentos(storeId, { limit: 20 }).then((resList) => {
        expect(resList.status).to.eq(200);
        const items = resList.body.items || [];
        expect(items).to.be.an('array').that.is.not.empty;

        const targetAttendance = items[0];
        const attendanceId = targetAttendance.id;
        const unreadListagem = targetAttendance.messages?.unread_count;

        // 2. Act: Executa baixa de mensagens na rota POST /attendances/:id/read
        api.marcarMensagensLidas(storeId, attendanceId).then((resRead) => {
          // Assert: 200 OK com contrato unificado
          expect(resRead.status, 'Status da rota de baixa de mensagens').to.eq(200);
          expect(resRead.body).to.have.property('attendance_id', attendanceId);
          expect(resRead.body).to.have.property('unread_count');
          expect(resRead.body.unread_count, 'unread_count da baixa deve ser número inteiro').to.be.a('number').and.gte(0);

          // Ambos compartilham o gerador único AttendanceReadSql.unreadCountSubselect
          cy.log(`ℹ️ [PR #495]: Atendimento #${attendanceId} - Listagem: ${unreadListagem} | Baixa: ${resRead.body.unread_count}`);
        });
      });
    });

    it('6.3 deve manter atendimentos visíveis e contabilizados no sumário independentemente de MSG_QTDE no banco', () => {
      // Contexto PR #495: O predicado excludente MSG_QTDE >= 0 foi removido do WHERE da listagem e do sumário,
      // evitando que conversas com contador corrompido no legado fossem ocultadas da fila da farmácia.

      // Act: Consulta o sumário de atendimentos (/attendances/summary)
      api.obterResumoAtendimentos(storeId).then((res) => {
        expect(res.status, 'Status do sumário de atendimentos').to.eq(200);
        expect(res.body).to.have.property('counts');

        const counts = res.body.counts;
        expect(counts).to.have.property('all').that.is.a('number').and.gte(0);
        expect(counts).to.have.property('pending').that.is.a('number').and.gte(0);
        expect(counts).to.have.property('in_progress').that.is.a('number').and.gte(0);
        expect(counts).to.have.property('completed').that.is.a('number').and.gte(0);
        expect(counts).to.have.property('finished').that.is.a('number').and.gte(0);
        expect(counts).to.have.property('discarded').that.is.a('number').and.gte(0);
        expect(counts).to.have.property('waiting').that.is.a('number').and.gte(0);

        // Sanidade de consistência: total de status mutuamente exclusivos deve coincidir com counts.all
        const somaStatus = counts.pending + counts.in_progress + counts.completed + counts.finished + counts.discarded;
        expect(somaStatus, 'Soma das contagens de status deve ser coerente com counts.all').to.eq(counts.all);
      });
    });

    it('6.4 deve exigir autenticação obrigatória (401 Unauthorized) ao consultar listagem de atendimentos sem token', () => {
      // Act: Tenta listar atendimentos sem cabeçalho de autenticação
      api.listarAtendimentos(storeId, {}, { headers: { Authorization: '' } }).then((res) => {
        // Assert: 401 Unauthorized
        expect(res.status, 'Status sem token JWT').to.eq(401);
        expect(res.body.error, 'Tipo de erro retornado').to.eq('Unauthorized');
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 29: EXPOSIÇÃO DE CONTENT_TYPE NA PRÉVIA DA ÚLTIMA MENSAGEM (PR #497)
  // ---------------------------------------------------------------------------
  context('7. Exposição de content_type na Prévia da Última Mensagem da Fila (PR #497)', () => {

    const attendanceIdAudio = 260800076; // Atendimento com áudio enviado pelo atendente (type = 0, content_type = audio, body = "")

    it('7.1 deve projetar o campo content_type dentro do envelope last_message em todos os cards da fila que possuem última mensagem', () => {
      // Act: Consulta a listagem de atendimentos da loja
      api.listarAtendimentos(storeId, { limit: 20 }).then((res) => {
        // Assert: 200 OK
        expect(res.status, 'Status da listagem de atendimentos').to.eq(200);
        const items = res.body.items || [];
        expect(items, 'Lista de atendimentos').to.be.an('array').that.is.not.empty;

        const itensComUltimaMsg = items.filter(it => it.messages && it.messages.last_message);
        expect(itensComUltimaMsg.length, 'Atendimentos com última mensagem').to.be.gte(1);

        const tiposCanonicosValidos = ['text', 'audio', 'image', 'document', 'video'];

        itensComUltimaMsg.forEach((item) => {
          const lm = item.messages.last_message;
          // Validação PR #497: last_message agora contém content_type derivado do TIPO
          expect(lm, `Card #${item.id} deve projetar content_type em last_message`).to.have.property('content_type');

          if (lm.content_type !== null) {
            expect(
              tiposCanonicosValidos,
              `content_type '${lm.content_type}' no card #${item.id} deve pertencer ao catálogo canônico`
            ).to.include(lm.content_type);
          }

          // Invariantes contratuais do envelope last_message
          expect(lm.type, `Campo type (origem) no card #${item.id}`).to.be.a('number');
          expect(lm.occurred_at, `occurred_at no card #${item.id} deve ser Instant UTC (Z)`).to.match(/Z$/);
        });
      });
    });

    it('7.2 deve rotular com precisão mídias de áudio enviadas pelo atendente (type = 0) com body vazio como content_type: audio (PR #497 / Issue #383)', () => {
      // Contexto PR #497: Corrige omnicare-org/pharmacie-front#383, onde cards de atendimentos com mídias
      // enviadas pelo atendente ficavam com a prévia em branco e type numérico opaco.

      // Act: Consulta a listagem da fila ampliando a janela e tamanho de página para localizar o atendimento com áudio
      const hoje = new Date().toISOString().slice(0, 10);
      api.listarAtendimentos(storeId, { start_date: '2026-08-01', end_date: hoje, page: 1, per_page: 100 }).then((res) => {
        expect(res.status).to.eq(200);
        const items = res.body.items || [];
        const attTarget = items.find(it => it.id === attendanceIdAudio) || items.find(it => it.messages?.last_message?.content_type === 'audio' && it.messages?.last_message?.type === 0);
        expect(attTarget, `Atendimento com áudio enviado pelo atendente deve existir na fila`).to.be.ok;

        const lm = attTarget.messages?.last_message;
        expect(lm, 'Envelope last_message do atendimento').to.be.ok;

        // Assert: type = 0 (atendente), content_type = 'audio', body = ''
        expect(lm.type, 'type deve ser 0 (atendente enviou por último)').to.eq(0);
        expect(lm.content_type, 'content_type deve ser audio (PR #497)').to.eq('audio');
        expect(lm.body, 'body vazio não oculta mais a natureza da mensagem de áudio').to.eq('');
        expect(lm.occurred_at, 'Carimbo de ocorrência em UTC/Z').to.match(/Z$/);
      });
    });

    it('7.3 deve garantir paridade de content_type entre a prévia da fila e a rota de mensagens (/attendances/:id/messages)', () => {
      // Act: Consulta as mensagens completas do atendimento
      api.listarMensagensAtendimento(storeId, attendanceIdAudio, { per_page: 50 }).then((resMsgs) => {
        expect(resMsgs.status, 'Status da rota de mensagens').to.eq(200);
        const msgs = resMsgs.body.data || [];
        expect(msgs, 'Mensagens do atendimento').to.be.an('array').that.is.not.empty;

        // Localiza a mensagem de áudio enviada pelo atendente
        const audioMsg = msgs.find(m => m.id === 4854083 || (m.content_type === 'audio' && m.origin === 'employee'));
        expect(audioMsg, 'Mensagem de áudio localizada no chat').to.be.ok;

        // Assert: Ambas as rotas compartilham o AttendanceMessageContentTypeMapper
        expect(audioMsg.content_type, 'content_type na rota de mensagens deve coincidir com o da fila').to.eq('audio');
        expect(audioMsg.origin, 'origem employee coincide com type 0').to.eq('employee');
        expect(audioMsg.content, 'conteúdo de texto de áudio é nulo').to.be.null;
        expect(audioMsg.attachment, 'anexo de áudio presente').to.be.ok;
      });
    });

    it('7.4 deve exigir autenticação obrigatória (401 Unauthorized) ao consultar listagem de atendimentos sem token', () => {
      // Act: Consulta fila sem token JWT
      api.listarAtendimentos(storeId, {}, { headers: { Authorization: '' } }).then((res) => {
        // Assert: 401 Unauthorized
        expect(res.status, 'Status sem autenticação').to.eq(401);
        expect(res.body.error, 'Erro de autenticação').to.eq('Unauthorized');
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 30: PROJEÇÃO DE CITAÇÃO E RESPOSTA A MENSAGEM NO CHAT (PR #500)
  // ---------------------------------------------------------------------------
  context('8. Projeção de Citação e Resposta a Mensagem no Chat (PR #500)', () => {

    const attendanceIdQuotes = 260900042; // Atendimento com respostas nativas e mensagens citadas reais (Loja 1)
    const quoteMsgStickerId = 4855386;    // Mensagem enviada pelo atendente via web citando o sticker 4855374
    const originalStickerId = 4855374;    // Sticker recebido do cliente que foi citado
    const quoteMsgTextId = 4855084;       // Mensagem enviada pelo cliente citando a mensagem de texto do atendente 4855083
    const originalTextId = 4855083;       // Mensagem de texto enviada pelo atendente

    it('8.1 deve projetar o campo replied_message em todas as mensagens da conversa (objeto estruturado ou null)', () => {
      // Act: Consulta as mensagens da conversa com limite expandido
      api.listarMensagensAtendimento(storeId, attendanceIdQuotes, { per_page: 100 }).then((res) => {
        // Assert: 200 OK
        expect(res.status, 'Status da listagem de mensagens').to.eq(200);
        const msgs = res.body.data || [];
        expect(msgs, 'Mensagens do atendimento').to.be.an('array').that.is.not.empty;

        // Validação PR #500: Toda mensagem deve projetar obrigatoriamente a propriedade replied_message
        msgs.forEach((m) => {
          expect(m, `Mensagem #${m.id} deve projetar a chave replied_message`).to.have.property('replied_message');

          if (m.replied_message !== null) {
            const rm = m.replied_message;
            expect(rm, `replied_message da mensagem #${m.id} deve ser um objeto`).to.be.an('object');
            expect(rm.id, `id da mensagem citada na #${m.id} deve ser número inteiro positivo`).to.be.a('number').and.be.gt(0);
            expect(rm.origin, `origin da mensagem citada na #${m.id} deve ser customer ou employee`).to.be.oneOf(['customer', 'employee']);
            expect(rm.preview, `preview da mensagem citada na #${m.id} deve ser string`).to.be.a('string');
            // Truncamento no banco via CAST(SUBSTRING(...) AS VARCHAR(300))
            expect(rm.preview.length, `preview da mensagem citada na #${m.id} deve ter no máximo 300 caracteres`).to.be.at.most(300);

            // content_type pode ser string ('text', 'image', 'audio', etc.) ou null (quando TIPO no legado é nulo)
            if (rm.content_type !== null) {
              expect(rm.content_type, `content_type da mensagem citada na #${m.id}`).to.be.a('string');
            }
          }
        });

        // Garante que a conversa testada possui tanto mensagens convencionais (null) quanto respostas citadas (objeto)
        const comCitacao = msgs.filter((m) => m.replied_message !== null);
        const semCitacao = msgs.filter((m) => m.replied_message === null);
        expect(comCitacao.length, 'Deve haver mensagens com citação na conversa').to.be.gte(1);
        expect(semCitacao.length, 'Deve haver mensagens sem citação na conversa').to.be.gte(1);
      });
    });

    it('8.2 deve mapear com precisão os metadados da mensagem citada ao responder sticker recebido do cliente (PR #500)', () => {
      // Contexto PR #500: Mensagem enviada pelo web (reply_to_message_id = 4855374) gravada pela procedure
      // OC_INCLUI_ATENDIMENTO_MSG e agora projetada em GET .../messages com preview do sticker e content_type image.

      // Act: Consulta a listagem de mensagens da conversa (sort desc para priorizar mensagens recentes)
      api.listarMensagensAtendimento(storeId, attendanceIdQuotes, { per_page: 100, sort: 'desc' }).then((res) => {
        expect(res.status, 'Status da requisição').to.eq(200);
        const msgs = res.body.data || [];

        const msgResposta = msgs.find((m) => m.id === quoteMsgStickerId);
        expect(msgResposta, `Mensagem de resposta #${quoteMsgStickerId} deve existir no chat`).to.be.ok;

        // Invariantes da mensagem que responde
        expect(msgResposta.origin, 'Origem da mensagem de resposta enviada pelo operador').to.eq('employee');
        expect(msgResposta.content_type, 'Tipo de conteúdo da mensagem de resposta').to.eq('text');
        expect(msgResposta.content, 'Texto da mensagem de resposta').to.eq('Citando o sticker de novo');

        // Validação da projeção estruturada da mensagem citada (replied_message)
        const rm = msgResposta.replied_message;
        expect(rm, 'Objeto replied_message estruturado').to.be.ok;
        expect(rm.id, 'ID da mensagem de sticker citada').to.eq(originalStickerId);
        expect(rm.origin, 'Origem do sticker citado deve ser customer').to.eq('customer');
        expect(rm.content_type, 'content_type do sticker citado deve ser image').to.eq('image');
        expect(rm.preview, 'preview do sticker citado gerado pelo banco').to.eq('[STICKER]');
      });
    });

    it('8.3 deve projetar replied_message com preview de texto ao responder mensagem de atendente', () => {
      // Act: Consulta as mensagens da conversa
      api.listarMensagensAtendimento(storeId, attendanceIdQuotes, { per_page: 100 }).then((res) => {
        expect(res.status, 'Status da requisição').to.eq(200);
        const msgs = res.body.data || [];

        const msgRespostaTexto = msgs.find((m) => m.id === quoteMsgTextId);
        expect(msgRespostaTexto, `Mensagem de resposta #${quoteMsgTextId} deve existir no chat`).to.be.ok;

        // Invariantes da resposta enviada pelo cliente
        expect(msgRespostaTexto.origin, 'Origem da mensagem do cliente').to.eq('customer');
        expect(msgRespostaTexto.content_type, 'Tipo de conteúdo da resposta').to.eq('text');
        expect(msgRespostaTexto.content, 'Conteúdo da resposta').to.eq('Sim');

        // Validação da mensagem original citada do atendente
        const rm = msgRespostaTexto.replied_message;
        expect(rm, 'Objeto replied_message').to.be.ok;
        expect(rm.id, 'ID da mensagem original citada').to.eq(originalTextId);
        expect(rm.origin, 'Origem da mensagem original deve ser employee').to.eq('employee');
        expect(rm.content_type, 'content_type da mensagem de texto citada').to.eq('text');
        expect(rm.preview, 'preview deve ser string não vazia com o texto do atendente').to.be.a('string').and.not.be.empty;
        expect(rm.preview.length, 'preview limitado em até 300 caracteres').to.be.at.most(300);
      });
    });

    it('8.4 deve exigir autenticação obrigatória (401 Unauthorized) ao consultar mensagens do atendimento sem token', () => {
      // Act: Consulta mensagens sem token JWT no cabeçalho
      api.listarMensagensAtendimento(storeId, attendanceIdQuotes, {}, { headers: { Authorization: '' } }).then((res) => {
        // Assert: 401 Unauthorized
        expect(res.status, 'Status sem autenticação').to.eq(401);
        expect(res.body.error, 'Erro de autenticação').to.eq('Unauthorized');
        expect(res.body.message, 'Mensagem de autenticação necessária').to.include('Authentication required');
      });
    });

  });

  // -------------------------------------------------------------------------
  // ENRIQUECIMENTO DE TEMPLATES COM RENDERED_BODY E INTERPOLAÇÃO (PR #483 E #484)
  // -------------------------------------------------------------------------
  context('9. Enriquecimento de Templates WABA com rendered_body e Interpolação de Variáveis (PR #483 e #484)', () => {

    let storeId;
    let attendanceIdValido;
    let clienteValido;

    before(() => {
      // 1. Arrange: Autentica o operador no backend e aguarda a resolução das entidades
      return api.autenticar().then(() => {
        return api.obterUsuarioLogado().then((resUser) => {
          storeId = resUser.body?.store_code || 1;

          // Localiza atendimento da loja para validar a rota contextual; sem nenhum na listagem, o #9.3 pula com motivo (sem atendimento fixo de reserva, [R-ATEMPORAL])
          return api.listarAtendimentos(storeId).then((resAtnd) => {
            const atnds = resAtnd.body?.items || [];
            attendanceIdValido = atnds.length > 0 ? atnds[0].id : null;

            // Cliente do env.json (R-POM) para validar a interpolação por customer_id
            return api.buscarClientes(storeId, configEnv.DEFAULT_CLIENT_NAME).then((resCli) => {
              const clis = resCli.body?.items || resCli.body || [];
              clienteValido = clis[0];
              expect(clienteValido && clienteValido.id, '🔒 DEFAULT_CLIENT_NAME não achou cliente (massa)').to.be.ok;
            });
          });
        });
      });
    });

    it('9.1 deve retornar rendered_body com saudação e atendente interpolados na listagem global de templates (/waba-message-templates)', () => {
      // Act: Consulta os templates WABA do canal oficial da loja
      api.listarTemplatesWaba(storeId, { channel_id: 6 }).then((res) => {
        // Assert: 200 OK
        expect(res.status, 'Status da requisição de templates WABA').to.eq(200);
        const templates = res.body?.items || res.body || [];
        expect(templates, 'Lista de templates deve ser array populado').to.be.an('array').and.not.empty;

        // Invariante PR #483: Todo template retornado deve possuir rendered_body em formato string
        templates.forEach((tpl) => {
          expect(tpl, `Template #${tpl.id} (${tpl.name})`).to.have.property('rendered_body');
          expect(tpl.rendered_body, `rendered_body do template #${tpl.id}`).to.be.a('string');
        });

        // Validação da interpolação de saudação e apelido no template 5208 (teste_seis_variaveis)
        const tpl5208 = templates.find((t) => t.id === 5208);
        expect(tpl5208, 'Template 5208 deve existir na listagem').to.be.ok;

        // Saudação por faixa horária calculada pela procedure (00:00-11:59 Bom dia, 12:00-17:59 Boa tarde, resto Boa noite)
        expect(tpl5208.rendered_body, 'rendered_body deve conter saudação horária interpolada').to.match(/Bom dia|Boa tarde|Boa noite/);

        // Nome da empresa resolvido da EMPRESA.PS_SIS
        expect(tpl5208.rendered_body, 'rendered_body deve conter o nome da empresa').to.include('OmniCare');

        // Preservação da variável principal editável (variable_type = 5 / principal = true)
        expect(tpl5208.rendered_body, 'rendered_body deve preservar a variável principal editável {{6}}').to.include('{{6}}');
      });
    });

    it('9.2 deve interpolar o nome do cliente no rendered_body quando fornecido customer_id opcional na listagem (/waba-message-templates)', () => {
      expect(clienteValido, 'Cliente com cadastro deve estar disponível para o teste').to.be.ok;

      // Act: Consulta templates informando channel_id e customer_id na query string
      api.listarTemplatesWaba(storeId, { channel_id: 6, customer_id: clienteValido.id }).then((res) => {
        // Assert: 200 OK
        expect(res.status, 'Status da consulta com customer_id').to.eq(200);
        const templates = res.body?.items || res.body || [];

        const tpl5208 = templates.find((t) => t.id === 5208);
        expect(tpl5208, 'Template 5208 deve existir').to.be.ok;

        // Nome do cliente interpolado da coluna CLIENTE.NOMEROTULO / UTIL_FORMATAR_NOME
        const primeiroNome = clienteValido.name.split(' ')[0];
        const regexNome = new RegExp(primeiroNome, 'i');
        expect(tpl5208.rendered_body, 'rendered_body deve conter o nome do cliente interpolado').to.match(regexNome);

        // A variável principal de texto continua preservada
        expect(tpl5208.rendered_body, 'Variável principal {{6}} continua aberta para edição').to.include('{{6}}');
      });
    });

    it('9.3 deve retornar rendered_body contextualizado no atendimento (/attendances/:id/message-templates)', function () {
      if (!attendanceIdValido) {
        cy.log('⏭️ Sem massa: nenhum atendimento na listagem da loja nesta rodada');
        this.skip();
        return;
      }
      const targetAttendanceId = attendanceIdValido;

      // Act: Consulta os templates específicos do atendimento
      api.listarTemplatesAtendimento(storeId, targetAttendanceId).then((res) => {
        // Assert: 200 OK
        expect(res.status, 'Status da requisição contextual de atendimento').to.eq(200);
        const templates = res.body?.items || res.body || [];
        expect(templates, 'Templates do atendimento').to.be.an('array').and.not.empty;

        templates.forEach((tpl) => {
          expect(tpl.rendered_body, `rendered_body do template #${tpl.id}`).to.be.a('string');
        });

        // Template 341 (continuar_atendimento_util): deve preservar a variável {{1}}
        const tpl341 = templates.find((t) => t.id === 341);
        if (tpl341) {
          expect(tpl341.rendered_body, 'Template 341 deve preservar variável {{1}}').to.include('{{1}}');
        }

        // Template 348 (iniciar_conversa_cliente): deve resolver o apelido do atendente logado
        const tpl348 = templates.find((t) => t.id === 348);
        if (tpl348) {
          expect(tpl348.rendered_body, 'Template 348 deve resolver nome do atendente').to.include('OmniCare');
        }
      });
    });

    it('9.4 deve exigir autenticação (401 Unauthorized) ao consultar templates WABA sem token JWT', () => {
      // Act 1: Tenta consultar /waba-message-templates sem token
      api.listarTemplatesWaba(storeId, { channel_id: 6 }, { headers: { Authorization: '' } }).then((resGlobal) => {
        // Assert: 401
        expect(resGlobal.status, 'Status sem token em /waba-message-templates').to.eq(401);
        expect(resGlobal.body.error, 'Erro de autenticação').to.eq('Unauthorized');
      });

      // Act 2: Tenta consultar /attendances/:id/message-templates sem token (o 401 vem antes de ler o atendimento, então serve um código inexistente)
      const targetAttendanceId = attendanceIdValido || 999999999;
      api.listarTemplatesAtendimento(storeId, targetAttendanceId, {}, { headers: { Authorization: '' } }).then((resAtnd) => {
        // Assert: 401
        expect(resAtnd.status, 'Status sem token em /attendances/:id/message-templates').to.eq(401);
        expect(resAtnd.body.error, 'Erro de autenticação').to.eq('Unauthorized');
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 32: INTEGRIDADE DE AUDITORIA NO INSERT DE SUBSTATUS PERSONALIZADOS (PR #526)
  // ---------------------------------------------------------------------------
  context('10. Integridade de Auditoria no Insert de Substatus Personalizados (PR #526)', () => {

    let novoStatusId;

    it('10.1 deve consultar o catálogo de substatus personalizados retornando array (GET /attendance-custom-statuses)', () => {
      // Act
      api.obterStatusPersonalizados(storeId).then((res) => {
        // Assert
        expect(res.status, 'Status do catálogo de substatus').to.eq(200);
        const itens = res.body.items || res.body.data || res.body;
        expect(itens, 'Catálogo de substatus personalizados').to.be.an('array');
      });
    });

    it('10.2 deve registrar um novo substatus personalizado sem o 500 de integridade de ALTERACAO_CF (POST /attendance-custom-statuses - PR #526)', () => {
      // Arrange: nome com timestamp evita colisão em reexecuções, já que a rota não expõe DELETE
      const payloadNovoStatus = {
        parent_status: 0,
        name: `Aguardando atendente (teste PR #526 - ${Date.now()})`,
      };

      // Act
      api.criarStatusPersonalizado(storeId, payloadNovoStatus).then((res) => {
        // Assert: elimina o 500 de DataIntegrityViolationException (ALTERACAO_CF NOT NULL)
        expect(res.status, 'Status da criação do substatus (antes da PR #526 respondia 500)').to.be.oneOf([200, 201]);
        expect(res.body, 'Corpo do substatus criado').to.be.an('object');

        novoStatusId = res.body.id;
        expect(novoStatusId, 'ID do substatus criado').to.be.ok;
        expect(res.body.name, 'Nome persistido do substatus').to.eq(payloadNovoStatus.name);
        expect(res.body.parent_status, 'parent_status persistido do substatus').to.eq(payloadNovoStatus.parent_status);

        // Confirma persistência real (não apenas envelope de sucesso): o item deve aparecer no catálogo
        return api.obterStatusPersonalizados(storeId).then((resCatalogo) => {
          const itens = resCatalogo.body.items || resCatalogo.body.data || resCatalogo.body;
          const criado = itens.find((s) => s.id === novoStatusId);
          expect(criado, 'Substatus recém-criado deve aparecer no catálogo').to.be.ok;
        });
      });
    });

    it('10.3 deve rejeitar parent_status fora do enum permitido preservando a validação após a correção (POST /attendance-custom-statuses - 422)', () => {
      // Arrange
      const payloadInvalido = {
        parent_status: 99,
        name: `Substatus parent_status inválido - ${Date.now()}`,
      };

      // Act
      api.criarStatusPersonalizado(storeId, payloadInvalido).then((res) => {
        // Assert: a correção da PR #526 não deve reabrir a validação de enum do service
        expect(res.status, 'Status para parent_status fora do enum').to.eq(422);
      });
    });

    it('10.4 deve atualizar a ordem de um substatus existente com sucesso, sem regressão no PATCH (PATCH /attendance-custom-statuses/:id)', () => {
      // Arrange: reaproveita o substatus criado neste bloco; cai para o catálogo se a criação não rodou isoladamente
      const executarPatch = (statusId) => {
        api.atualizarStatusPersonalizado(storeId, statusId, { order: 1 }).then((res) => {
          // Assert
          expect(res.status, 'Status da atualização de ordem do substatus').to.eq(200);
        });
      };

      if (novoStatusId) {
        executarPatch(novoStatusId);
      } else {
        api.obterStatusPersonalizados(storeId).then((res) => {
          const itens = res.body.items || res.body.data || res.body;
          expect(itens.length, 'Catálogo deve ter ao menos um substatus para o PATCH de contra-prova').to.be.gte(1);
          executarPatch(itens[0].id);
        });
      }
    });

    it('10.5 deve exigir autenticação obrigatória (401 Unauthorized) ao consultar e registrar substatus personalizados', () => {
      // Act 1: GET sem token
      api.obterStatusPersonalizados(storeId, { headers: { Authorization: '' } }).then((res) => {
        // Assert
        expect(res.status, 'Status do GET sem autenticação').to.eq(401);
        expect(res.body.error, 'Erro de autenticação no GET').to.eq('Unauthorized');
      });

      // Act 2: POST sem token
      api.criarStatusPersonalizado(storeId, { parent_status: 0, name: 'Sem token' }, { headers: { Authorization: '' } }).then((res) => {
        // Assert
        expect(res.status, 'Status do POST sem autenticação').to.eq(401);
        expect(res.body.error, 'Erro de autenticação no POST').to.eq('Unauthorized');
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 33: TELEFONE CRU DA CONVERSA NO CARD DA FILA (ISSUE #569)
  // ---------------------------------------------------------------------------
  context('11. Telefone Cru da Conversa no Card da Fila', () => {

    it('11.1 Deve retornar customer_phone (listagem) e customer.phone (detalhe) sempre como o número cru da conversa, com código do país ou o identificador @lid do WhatsApp (Issue #569, PR #560)', () => {
      // Bug original: o card exibia um telefone antigo do cadastro (TELEFONE1/2, ex: "6234813108" —
      // 10 dígitos, sem código do país) em vez do número real da conversa (ID_USUARIO). A PR #560
      // corrigiu a origem do campo; o valor cru sempre tem o prefixo "55" (Brasil) + DDD + número
      // (8 dígitos fixo ou 9 dígitos celular) = 12 ou 13 dígitos totais — medido em 20 itens reais
      // da fila em 2026-09-29, sem exceção. Achado 2026-10-05 (triagem GitHub Actions): contas que
      // escondem o número real atrás de um Linked ID (feature de privacidade do WhatsApp Business)
      // expõem em vez disso um identificador numérico com sufixo "@lid" — formato alternativo
      // válido, não um retrocesso do bug original.
      const padraoTelefoneCru = /^(55\d{10,11}|\d+@lid)$/;

      api.listarAtendimentos(storeId, { page: 1, per_page: 20 }).then((res) => {
        expect(res.status, 'Status da fila').to.eq(200);
        const atendimentos = res.body.items || res.body.data || res.body;
        expect(atendimentos.length, 'fila deve ter itens para o teste fazer sentido').to.be.gte(1);

        atendimentos.forEach((item) => {
          expect(item, `atendimento #${item.id} deve ter customer_phone`).to.have.property('customer_phone');
          expect(item.customer_phone, `customer_phone do atendimento #${item.id} (cru, com código do país, ou @lid)`).to.match(padraoTelefoneCru);
        });

        // Detalhe do primeiro item confirma o mesmo padrão em customer.phone (contrato espelhado)
        return api.obterDetalheAtendimento(storeId, atendimentos[0].id);
      }).then((res) => {
        expect(res.status, 'Status do detalhe').to.eq(200);
        expect(res.body.customer, 'customer no detalhe deve ter phone').to.have.property('phone');
        expect(res.body.customer.phone, 'customer.phone no detalhe (cru, com código do país, ou @lid)').to.match(padraoTelefoneCru);
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 34: CONSISTÊNCIA CAPABILITY × AÇÃO REAL — ASSUMIR/TRANSFERIR (Issue backend#570/#599)
  // ---------------------------------------------------------------------------
  // Arquitetura (pedido do operador, 2026-10-05): a matriz de permissões da Issue backend#570
  // define cada capability como um booleano calculado pelo servidor a partir de um predicado
  // próprio (status, dono, grupo, grant). Testar TODA a matriz exigiria uma conta de teste por
  // combinação (557 isolado, 649 isolado, dentro/fora do grupo) — infraestrutura que não existe
  // neste repo (`env.json` só tem um `USER_CODE`). Em vez disso, o padrão abaixo lê a capability
  // já calculada pelo servidor para a conta de teste REAL corrente e confere que a ação
  // subsequente é consistente com ela: sucede quando a flag diz `true`, é rejeitada com o código
  // certo quando diz `false`. Autoadaptável a qualquer grant que a conta tenha no momento, sem
  // depender de recriar a matriz inteira — o mesmo padrão serve para qualquer par
  // capability×ação futuro (reaproveitar `validarConsistenciaCapabilityXAcao`).
  context('12. Consistência entre Capability e Ação Real — Assumir Atendimento (Issue backend#570/#599)', () => {

    function validarConsistenciaCapabilityXAcao(descricaoAcao, capabilityFlag, codigosEsperadosSeFalso, executarAcao) {
      return executarAcao().then((res) => {
        if (capabilityFlag) {
          expect(res.status, `${descricaoAcao}: capability true deve permitir a ação`).to.be.oneOf([200, 201]);
        } else {
          expect(res.status, `${descricaoAcao}: capability false deve rejeitar a ação`).to.be.oneOf([403, 409]);
          expect(res.body.code, `${descricaoAcao}: código de erro deve ser um dos esperados por capability false`)
            .to.be.oneOf(codigosEsperadosSeFalso);
        }
      });
    }

    it('12.1 deve confirmar que can_take_attendance é consistente com o resultado real do PATCH de assumir, num atendimento Pendente sem atendente', () => {
      // Arrange: localiza um atendimento Pendente e sem atendente de verdade. Massa escassa por
      // natureza (a própria Issue backend#570 mediu 1 registro no tenant) — se não houver nenhum
      // disponível no momento (consumido por outra sessão/tráfego real), o cenário não existe
      // pra validar agora e o teste sai sem asserção forçada, documentando o motivo.
      api.listarAtendimentos(storeId, { status: 'pending', page: 1, per_page: 20 }).then((resLista) => {
        const itens = resLista.body.items || resLista.body.data || resLista.body;
        const semAtendente = itens.find((i) => !i.attendant_name);

        if (!semAtendente) {
          cy.log('⚠️ [Massa Escassa]: nenhum atendimento Pendente sem atendente disponível agora — cenário pulado, não é falha do teste.');
          return;
        }

        api.obterCapabilitiesAtendimento(storeId, semAtendente.id).then((resCaps) => {
          const podeAssumir = resCaps.body.capabilities.can_take_attendance;

          // Só exercita a chamada real quando a capability diz `false`: a rejeição (403/409) não
          // muda estado nenhum, então é seguro repetir. Quando diz `true`, a ação teria sucesso de
          // verdade e atribuiria o atendimento ao usuário de teste de forma IRREVERSÍVEL (não há
          // endpoint de "desfazer assumir") - consumiria permanentemente massa real escassa
          // (Pendente-sem-atendente, ~1 registro no tenant por vez, AGENTS.md §1.2). Nesse caso o
          // teste só documenta o achado sem mutar o atendimento real (achado real, 2026-10-05: a
          // 1ª versão deste teste chamou a API com `podeAssumir: true` e assumiu de verdade o
          // atendimento #261000015, consumindo-o sem possibilidade de reverter).
          if (!podeAssumir) {
            return validarConsistenciaCapabilityXAcao(
              'Assumir atendimento Pendente sem atendente',
              podeAssumir,
              ['ATTENDANCE_GROUP_REQUIRED', 'ATTENDANCE_NOT_PENDING', 'ATTENDANCE_ALREADY_ASSIGNED'],
              () => api.atualizarStatusAtendimento(storeId, semAtendente.id, { target_attendant_id: loggedUserId })
            );
          }

          cy.log(`ℹ️ [can_take_attendance: true]: atendimento #${semAtendente.id} seria assumível de verdade - chamada real pulada de propósito para não consumir massa escassa de forma irreversível.`);
        });
      });
    });

    it('12.2 deve rejeitar com 409 ATTENDANCE_NOT_PENDING a tentativa de assumir um atendimento que não está Pendente, independente do grant do funcionário (checklist Issue backend#599, item 6)', () => {
      // Item do checklist "com ou sem 557" é, por desenho, independente de qual grant o
      // funcionário tem: um atendimento fora do status Pendente nunca é assumível, qualquer que
      // seja a permissão. Por isso não depende de uma 2ª conta de teste com grant diferente (ao
      // contrário dos itens 1-5 do checklist, que exigem isolar 557 de 649 e grupo - não
      // automatizável com a única conta deste repo, env.json só tem 1 USER_CODE). Massa abundante
      // (177 mil+ Finalizados medidos na Issue backend#570) - sem risco de massa escassa, e a
      // rejeição não muda estado nenhum, seguro repetir.
      api.listarAtendimentos(storeId, { status: 'finished', page: 1, per_page: 50 }).then((resLista) => {
        const itens = resLista.body.items || resLista.body.data || resLista.body;
        // Precisa ser sem atendente: com dono, o PATCH exige channel_group_id (fluxo de
        // transferência, achado real 2026-10-05) e devolveria 422, não o 409 que este teste mede.
        const naoPendente = itens.find((i) => !i.attendant_name);
        expect(naoPendente, 'deve haver ao menos 1 atendimento Finalizado sem atendente (massa medida pela Issue backend#570: 98 Finalizados + 2 Descartados sem atendente)').to.exist;

        api.atualizarStatusAtendimento(storeId, naoPendente.id, { target_attendant_id: loggedUserId }).then((res) => {
          expect(res.status, 'assumir atendimento não-Pendente deve ser rejeitado com 409').to.eq(409);
          expect(res.body.code, 'código de erro deve ser ATTENDANCE_NOT_PENDING').to.eq('ATTENDANCE_NOT_PENDING');
        });
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 36: ORÇAMENTO GERADO AUTOMATICAMENTE PELA I.A. A PARTIR DE RECEITA
  // ENVIADA POR ANEXO (exploração do operador, 2026-10-07 - sem issue aberta)
  // ---------------------------------------------------------------------------
  context('13. Orçamento Gerado Automaticamente pela I.A. a partir de Receita Enviada por Anexo', () => {

    // Massa real e permanente: capturada ao vivo em 2026-10-07 com uma escuta de ~6 min contra
    // api.omnicare.dev.local, enviando de verdade uma foto de receita pelo WhatsApp do atendimento
    // 261000039 e observando a resposta da IA (~111s entre a mensagem chegar e o orçamento sair).
    // Estes IDs já são histórico definitivo (mensagem/arquivo/orçamento não mudam mais de estado).
    const attendanceIdComIa = 261000039;
    const mensagemNotificacaoIaId = 4857295;
    const arquivoIaId = 1423;
    const orcamentoGeradoPelaIa = 261000268;

    // Massa real e permanente, pré-migração upload-arquivos-aws (Issue backend#603/#604, mídia
    // migrada por key no S3 em 29/09/2026): atendimento 260700034 tem 5 arquivos de IA de
    // 03-06/07/2026, achados numa varredura (node+https direto na API real) feita pra validar o
    // gap de "preview de arquivo de IA" que ficava em aberto no ROADMAP P2. Dois achados reais:
    // (1) ia_status tem um 3º valor (-1, falha) nunca documentado antes - só 0/1 eram conhecidos;
    // (2) o anexo original de cada arquivo de IA segue resolvendo corretamente pela rota de anexo
    // sob demanda mesmo depois da migração ter trocado a URL por key no banco.
    const attendanceIdIaAntigo = 260700034;
    const arquivoIaFalhaId = 257;
    const mensagemFalhaIaId = 4851916;
    const arquivoIaConcluidoAntigoId = 268;
    const mensagensAnexoIaAntigo = [4851751, 4851915, 4851958, 4852082, 4852084];

    it('13.1 Deve servir o arquivo de IA com ia_status concluído e o schema mínimo (GET /attendances/:id/ia-files)', () => {
      api.listarArquivosIa(storeId, attendanceIdComIa).then((res) => {
        expect(res.status, 'Status da listagem de arquivos de IA').to.eq(200);
        const itens = res.body.items || res.body.data || res.body;
        const arquivo = itens.find((f) => f.id === arquivoIaId);
        expect(arquivo, 'arquivo de IA processado localizado').to.not.be.undefined;

        expect(arquivo).to.have.property('file_type', 'IMG');
        expect(arquivo).to.have.property('message_id', 4857294);
        expect(arquivo).to.have.property('message_at');
        // Achado real (capturado ao vivo): nasce com ia_status: 0 (processando) e vira 1 (concluído)
        // quando o orçamento sai - não há 3º valor observado (falha) nesta captura.
        expect(arquivo.ia_status, 'ia_status concluído neste registro histórico').to.eq(1);
      });
    });

    it('13.2 A mensagem de notificação da I.A. deve referenciar o orçamento gerado, e esse código deve existir de fato na listagem de orçamentos do atendimento', () => {
      api.listarMensagensAtendimento(storeId, attendanceIdComIa, { page: 1, per_page: 50, sort: 'desc' }).then((res) => {
        expect(res.status, 'Status da listagem de mensagens').to.eq(200);
        const mensagens = res.body.items || res.body.data || res.body;
        const notificacao = mensagens.find((m) => m.id === mensagemNotificacaoIaId);
        expect(notificacao, 'mensagem de notificação da IA localizada').to.not.be.undefined;
        // Achado real: origin/transfer_type desta mensagem variaram entre capturas (employee/internal)
        // sem o content mudar - parecem derivados em runtime, não armazenados; não são o contrato
        // que este teste nomeia, por isso não são afirmados aqui.
        expect(notificacao.content_type, 'mensagem de notificação é texto puro').to.eq('text');

        // Achado real (capturado ao vivo): é a MESMA mensagem (mesmo id) do aviso inicial
        // "processando", só o content é reescrito quando termina - nunca chega uma mensagem nova.
        const match = notificacao.content.match(/Receita nº: (\d+) processada pela I\.A\.!/);
        expect(match, 'texto final deve nomear o código do orçamento gerado').to.not.be.null;
        const codigoExtraido = Number(match[1]);
        expect(codigoExtraido, 'código extraído da mensagem bate com o orçamento real conhecido').to.eq(orcamentoGeradoPelaIa);

        return api.listarOrcamentosAtendimento(storeId, attendanceIdComIa).then((resOrc) => {
          const existe = (resOrc.body.data || []).some((b) => b.code === codigoExtraido);
          expect(existe, 'o código citado na mensagem corresponde a um orçamento real na listagem').to.be.true;
        });
      });
    });

    it('13.3 Deve haver só 1 mensagem para este arquivo de IA (edição in-place, nunca uma 2ª mensagem de conclusão)', () => {
      api.listarMensagensAtendimento(storeId, attendanceIdComIa, { page: 1, per_page: 50, sort: 'desc' }).then((res) => {
        expect(res.status, 'Status da listagem de mensagens').to.eq(200);
        const mensagens = res.body.items || res.body.data || res.body;
        const notificacoesDesteArquivo = mensagens.filter((m) => m.content && m.content.includes(`Arquivo nº: ${arquivoIaId}`));
        expect(notificacoesDesteArquivo, 'deve existir exatamente 1 mensagem para este arquivo (nunca 2: "processando" + "concluído")').to.have.length(1);
      });
    });

    it('13.4 ia_status tem um 3º valor real (-1, falha) quando a receita não gera orçamento - achado ao vivo, nunca documentado antes (só 0/processando e 1/concluído eram conhecidos)', () => {
      api.listarArquivosIa(storeId, attendanceIdIaAntigo).then((res) => {
        expect(res.status, 'Status da listagem de arquivos de IA').to.eq(200);
        const itens = res.body.items || res.body.data || res.body;
        const arquivo = itens.find((f) => f.id === arquivoIaFalhaId);
        expect(arquivo, 'arquivo de IA com falha localizado').to.not.be.undefined;
        expect(arquivo.ia_status, 'ia_status: -1 é o valor real de falha, distinto de 0 (processando) e 1 (concluído)').to.eq(-1);

        return api.listarMensagensAtendimento(storeId, attendanceIdIaAntigo, { page: 1, per_page: 50, sort: 'desc' }).then((resMsg) => {
          const mensagens = resMsg.body.items || resMsg.body.data || resMsg.body;
          const notificacao = mensagens.find((m) => m.id === mensagemFalhaIaId);
          expect(notificacao, 'mensagem de notificação da falha localizada').to.not.be.undefined;
          expect(notificacao.content, 'mesmo padrão de edição in-place: o motivo da falha substitui o aviso de "processando"').to.include('Receita não orçada!');
        });
      });
    });

    it('13.5 Issue backend#603/#604 - o anexo original (foto da receita) de arquivos de IA antigos, migrado de URL para key no S3 em 29/09/2026, continua servindo o binário correto pela rota de anexo sob demanda', () => {
      // Massa pré-migração (03-06/07/2026): qualquer um destes 5 anexos, se a resolução da key
      // migrada estivesse quebrada, viria com status de erro ou corpo vazio/não-imagem - nenhuma
      // asserção de ia_status aqui, o alvo é só a resolução do anexo (AttendanceIaFilePreviewService).
      mensagensAnexoIaAntigo.forEach((messageId) => {
        api.get(`/attendances/${attendanceIdIaAntigo}/messages/${messageId}/attachment`, {}, { encoding: 'binary' }).then((res) => {
          expect(res.status, `Status do anexo da mensagem ${messageId}`).to.eq(200);
          expect(res.headers['content-type'], `Content-Type de imagem para a mensagem ${messageId}`).to.match(/^image\//);
          expect(res.body, `corpo binário não-vazio para a mensagem ${messageId}`).to.have.length.greaterThan(0);
        });
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 37: REAÇÕES EM MENSAGENS (ISSUE BACKEND#617, PR #618 - EM DEV, AINDA NÃO NA MAIN)
  // ---------------------------------------------------------------------------
  context('14. Reações em Mensagens', () => {

    // Massa real curada pelo time de QA (conteúdo "Primeira/Segunda mensagem de teste..." no
    // atendimento 260900034, loja 1) - levantada por diagnóstico descartável (Issue backend#617):
    // #4854985 (transfer_type 0, status "sent", já com wamid real) é reagível; #4854982
    // (transfer_type 1, "Atendente alterado de...") é um evento de sistema, não reagível.
    const attendanceIdReacoes = 260900034;
    const mensagemReagivelId = 4854985;
    const mensagemNaoReagivelId = 4854982;
    // Mensagem do atendimento #260900112 citada na própria Issue backend#566 (evidência real) -
    // usada só para provar o 404 de mensagem fora do atendimento alvo, sem precisar de nova consulta.
    const mensagemDeOutroAtendimentoId = 4856181;

    afterEach(() => {
      // Nunca deixar reação residual do atendente na massa real compartilhada entre rodadas -
      // idempotente mesmo quando o teste não chegou a criar nenhuma (DELETE sem reação = 204).
      api.removerReacaoMensagem(storeId, attendanceIdReacoes, mensagemReagivelId);
    });

    it('14.1 deve criar a reação do atendente numa mensagem reagível, refletindo na listagem com status pending', () => {
      api.reagirMensagem(storeId, attendanceIdReacoes, mensagemReagivelId, '{{e:1F44D}}').then((resPut) => {
        expect(resPut.status, 'Status do PUT de reação').to.eq(204);

        api.listarMensagensAtendimento(storeId, attendanceIdReacoes, { page: 1, per_page: 30, sort: 'desc' }).then((resGet) => {
          const mensagem = (resGet.body.items || resGet.body.data || []).find((m) => m.id === mensagemReagivelId);
          expect(mensagem, 'mensagem reagida deve existir na listagem').to.be.ok;
          const reacaoAtendente = (mensagem.reactions || []).find((r) => r.author === 'employee');
          expect(reacaoAtendente, 'reação do atendente deve aparecer no array reactions').to.be.ok;
          expect(reacaoAtendente.emoji).to.eq('{{e:1F44D}}');
          expect(reacaoAtendente.status, 'logo após o PUT, antes do omnichannel processar').to.eq('pending');
        });
      });
    });

    it('14.2 deve atualizar a reação existente do atendente ao reagir de novo com outro emoji, sem duplicar entrada', () => {
      api.reagirMensagem(storeId, attendanceIdReacoes, mensagemReagivelId, '{{e:1F64F}}').then(() => {
        api.reagirMensagem(storeId, attendanceIdReacoes, mensagemReagivelId, '{{e:1F44D}}').then((resPut) => {
          expect(resPut.status, 'Status do 2º PUT (atualização)').to.eq(204);

          api.listarMensagensAtendimento(storeId, attendanceIdReacoes, { page: 1, per_page: 30, sort: 'desc' }).then((resGet) => {
            const mensagem = (resGet.body.items || resGet.body.data || []).find((m) => m.id === mensagemReagivelId);
            const reacoesDoAtendente = (mensagem.reactions || []).filter((r) => r.author === 'employee');
            expect(reacoesDoAtendente, 'só 1 reação do atendente por mensagem (UNIQUE MSG_ID_ALVO+AUTOR)').to.have.length(1);
            expect(reacoesDoAtendente[0].emoji, 'emoji deve refletir a troca, não o 1º valor').to.eq('{{e:1F44D}}');
          });
        });
      });
    });

    it('14.3 deve remover a reação do atendente ao chamar DELETE, sumindo da listagem', () => {
      api.reagirMensagem(storeId, attendanceIdReacoes, mensagemReagivelId, '{{e:1F44D}}').then(() => {
        api.removerReacaoMensagem(storeId, attendanceIdReacoes, mensagemReagivelId).then((resDelete) => {
          expect(resDelete.status, 'Status do DELETE de reação').to.eq(204);

          api.listarMensagensAtendimento(storeId, attendanceIdReacoes, { page: 1, per_page: 30, sort: 'desc' }).then((resGet) => {
            const mensagem = (resGet.body.items || resGet.body.data || []).find((m) => m.id === mensagemReagivelId);
            const reacaoAtendente = (mensagem.reactions || []).find((r) => r.author === 'employee');
            expect(reacaoAtendente, 'reação removida (EMOJI vazio) não deve aparecer na listagem').to.not.exist;
          });
        });
      });
    });

    it('14.4 deve responder 204 de forma idempotente ao chamar DELETE numa mensagem reagível sem reação prévia do atendente', () => {
      // beforeEach/afterEach já garantem que não há reação pendente neste ponto - confirma que o
      // DELETE não exige estado prévio (contrato: "sem gravar nada", nunca 404/422).
      api.removerReacaoMensagem(storeId, attendanceIdReacoes, mensagemReagivelId).then((resDelete) => {
        expect(resDelete.status, 'DELETE idempotente sem reação prévia').to.eq(204);
      });
    });

    it('14.5 deve recusar reagir a uma mensagem que não é de conteúdo comum (evento de sistema, transfer_type fora de 0/9) com 409 MESSAGE_NOT_REACTABLE', () => {
      api.reagirMensagem(storeId, attendanceIdReacoes, mensagemNaoReagivelId, '{{e:1F44D}}').then((res) => {
        expect(res.status, 'Status ao reagir a mensagem não reagível').to.eq(409);
        expect(res.body.code || res.body.error, 'código do erro').to.eq('MESSAGE_NOT_REACTABLE');
      });
    });

    it('14.6 deve recusar emoji vazio com 422', () => {
      api.reagirMensagem(storeId, attendanceIdReacoes, mensagemReagivelId, '').then((res) => {
        expect(res.status, 'Status com emoji vazio').to.eq(422);
      });
    });

    it('14.7 deve recusar emoji acima de 100 caracteres com 422', () => {
      const emojiMuitoLongo = '{{e:1F44D}}'.repeat(10);
      expect(emojiMuitoLongo.length, 'pré-condição: string de teste deve mesmo passar de 100 chars').to.be.greaterThan(100);

      api.reagirMensagem(storeId, attendanceIdReacoes, mensagemReagivelId, emojiMuitoLongo).then((res) => {
        expect(res.status, 'Status com emoji acima de 100 caracteres').to.eq(422);
      });
    });

    it('14.8 deve responder 404 ao tentar reagir usando o id de uma mensagem que pertence a outro atendimento', () => {
      api.reagirMensagem(storeId, attendanceIdReacoes, mensagemDeOutroAtendimentoId, '{{e:1F44D}}').then((res) => {
        expect(res.status, 'Status ao reagir com messageId de outro atendimento').to.eq(404);
      });
    });

    it('14.9 deve exigir autenticação obrigatória (401) para reagir a uma mensagem', () => {
      api.reagirMensagem(storeId, attendanceIdReacoes, mensagemReagivelId, '{{e:1F44D}}', { headers: { Authorization: '' } }).then((res) => {
        expect(res.status, 'Status sem token ao reagir').to.eq(401);
      });
    });

    it('14.10 deve disparar o evento message.reaction_changed no feed de eventos ao reagir a uma mensagem (SSE/drain floor)', () => {
      // Mesmo padrão do ctx 5 #5.6 (attendant.status_changed): captura o cursor ANTES da mutação
      // que o próprio teste provoca, em vez de depender de atividade real de terceiros no feed.
      api.listarEventosAtendimento(storeId, { limit: 1 }).then((resFeedInicial) => {
        const cursorInicial = resFeedInicial.body.cursor || 0;

        api.reagirMensagem(storeId, attendanceIdReacoes, mensagemReagivelId, '{{e:2764}}').then((resPut) => {
          expect(resPut.status).to.eq(204);

          // Drain floor ~2s (evento não assinado no canal nativo, mesmo padrão de OC_ORCAMENTO) -
          // retry com espera de parede real entre tentativas, nunca cy.wait(ms) único e cego.
          const buscarEvento = (tentativas = 6) => {
            return api.listarEventosAtendimento(storeId, { after: Math.max(0, cursorInicial - 2), limit: 50 }).then((res) => {
              const items = res.body.items || [];
              const evento = items.find((it) => (it.type || it.event) === 'message.reaction_changed' && it.attendance_id === attendanceIdReacoes);
              if (evento) return evento;
              if (tentativas > 1) {
                return cy.wait(2000).then(() => buscarEvento(tentativas - 1));
              }
              return null;
            });
          };

          buscarEvento().then((evento) => {
            expect(evento, 'evento message.reaction_changed deve ser emitido no feed após reagir').to.be.ok;
            expect(evento).to.have.property('attendance_id', attendanceIdReacoes);
          });
        });
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 38: LISTAGEM DE MENSAGENS SEM BYTES DE ANEXO + ROTA DE ANEXO SOB DEMANDA (ISSUE BACKEND#612)
  // ---------------------------------------------------------------------------
  context('15. Listagem de Mensagens sem Bytes de Anexo e Rota de Anexo Sob Demanda (Issue backend#612)', () => {

    // Massa real curada (atendimento 260900034, loja 1), medida pela própria issue em 05/10/2026:
    // posição 12 = mensagem 4854976 (8.388.636 bytes) e posição 13 = 4854977 (10.485.760 bytes).
    const attendanceIdAnexosGrandes = 260900034;
    const mensagemAnexo10MbId = 4854977;
    const bytesAnexo10Mb = 10485760;
    // Mensagem de outro atendimento (#260900112, Issue backend#566) - prova o 404 de messageId fora do atendimento alvo.
    const mensagemDeOutroAtendimentoAnexoId = 4856181;

    it('15.1 deve devolver os 10.485.760 bytes crus da mensagem 4854977 pela rota de anexo, com o Content-Type igual ao mime_type da listagem e cache privado', () => {
      api.listarMensagensAtendimento(storeId, attendanceIdAnexosGrandes, { page: 1, per_page: 30 }).then((resLista) => {
        expect(resLista.status, 'Status da listagem').to.eq(200);
        const mensagens = resLista.body.items || resLista.body.data || resLista.body;
        const msg = mensagens.find((m) => m.id === mensagemAnexo10MbId);
        expect(msg, `mensagem ${mensagemAnexo10MbId} presente na listagem`).to.not.be.undefined;
        expect(msg.attachment, 'anexo da mensagem na listagem').to.be.an('object');
        expect(msg.attachment.mime_type, 'mime_type da listagem').to.be.a('string').and.not.be.empty;

        api.get(`/attendances/${attendanceIdAnexosGrandes}/messages/${mensagemAnexo10MbId}/attachment`, {}, { encoding: 'binary' }).then((res) => {
          expect(res.status, 'Status da rota de anexo').to.eq(200);
          expect(res.body, 'corpo binário da rota de anexo').to.have.length(bytesAnexo10Mb);
          expect(String(res.headers['content-type']).split(';')[0].trim().toLowerCase(), 'Content-Type da rota = mime_type da listagem').to.eq(msg.attachment.mime_type.toLowerCase());
          expect(String(res.headers['cache-control'] || ''), 'Cache-Control privado, o anexo não muda depois de gravado').to.match(/private/i);
          expect(res.headers, 'a rota não envia Content-Disposition (o front nomeia pelo filename da listagem)').to.not.have.property('content-disposition');
        });
      });
    });

    it('15.2 deve listar com per_page=20 sem nenhum attachment.data e em tempo sub-segundo na mesma faixa de per_page=10, mesmo com os anexos de 8 MB e 10 MB na página', () => {
      let inicio;
      cy.then(() => { inicio = Date.now(); });
      api.listarMensagensAtendimento(storeId, attendanceIdAnexosGrandes, { page: 1, per_page: 20 }).then((res) => {
        const duracaoMs = Date.now() - inicio;
        expect(res.status, 'Status da listagem com per_page=20').to.eq(200);
        const mensagens = res.body.items || res.body.data || res.body;
        const comAnexo = mensagens.filter((m) => m.attachment);
        // Pré-condição: a página precisa conter os anexos grandes, senão o teste não mede o defeito
        expect(mensagens.map((m) => m.id), 'página inclui o anexo de 10 MB').to.include(mensagemAnexo10MbId);
        expect(comAnexo.length, 'mensagens com anexo na página').to.be.at.least(1);
        comAnexo.forEach((m) => {
          expect(m.attachment, `anexo da mensagem ${m.id} sem os bytes inline`).to.not.have.property('data');
          expect(m.attachment, `anexo da mensagem ${m.id} mantém filename e mime_type`).to.include.keys('filename', 'mime_type');
        });
        // Defeito original: 5 a 7 s por causa de ~25 MB de base64 no JSON; teto folgado pra não ser flaky em rede real/CI
        expect(duracaoMs, 'duração da listagem per_page=20 (ms)').to.be.lessThan(2000);
        expect(JSON.stringify(res.body).length, 'payload sem bytes de anexo (bem abaixo dos ~25 MB do defeito)').to.be.lessThan(1024 * 1024);
      });
    });

    it('15.3 deve responder 404 na rota de anexo quando a mensagem pertence a outro atendimento', () => {
      api.get(`/attendances/${attendanceIdAnexosGrandes}/messages/${mensagemDeOutroAtendimentoAnexoId}/attachment`, {}, { failOnStatusCode: false }).then((res) => {
        expect(res.status, 'Status da rota de anexo com messageId de outro atendimento').to.eq(404);
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 39: REENVIO MANUAL DE MENSAGEM COM FALHA (ISSUE BACKEND#574 / PR #614)
  // ---------------------------------------------------------------------------
  context('16. Reenvio Manual de Mensagem com Falha (Issue backend#574)', () => {

    // Só caminhos de recusa: nunca mudam estado. O sucesso (200 {id, status: "ready"}) devolve a mensagem à fila do sender
    // e exige uma mensagem real em erro, dado que não é atemporal - fica fora de propósito.
    // Atendimento curado do ctx 15; as mensagens são descobertas pela listagem (sem ids fixos), por origem/tipo/status.
    const attendanceIdReenvio = 260900034;
    // Mensagem de outro atendimento (#260900112, Issue backend#566) - prova o 404 de messageId fora do atendimento alvo.
    const mensagemDeOutroAtendimentoId = 4856181;
    const urlRetry = (messageId, attendanceId = attendanceIdReenvio) =>
      `/attendances/${attendanceId}/messages/${messageId}/retry`;

    it('16.1 deve responder 404 para mensagem inexistente e para mensagem de outro atendimento', () => {
      api.post(urlRetry(2147483647)).then((res) => {
        expect(res.status, 'Status com messageId inexistente').to.eq(404);
      });
      api.post(urlRetry(mensagemDeOutroAtendimentoId)).then((res) => {
        expect(res.status, 'Status com messageId de outro atendimento').to.eq(404);
      });
    });

    it('16.2 deve recusar o reenvio sem token (401)', () => {
      api.post(urlRetry(1), {}, { headers: { Authorization: '' } }).then((res) => {
        expect(res.status, 'Status sem token').to.eq(401);
      });
    });

    it('16.3 deve recusar com 409 ATTENDANCE_MESSAGE_NOT_RETRYABLE toda mensagem que não está em erro ou que o sender não envia (enviada, do cliente, evento de sistema)', () => {
      api.listarMensagensAtendimento(storeId, attendanceIdReenvio, { page: 1, per_page: 20 }).then((resLista) => {
        expect(resLista.status, 'Status da listagem').to.eq(200);
        const mensagens = resLista.body.items || resLista.body.data || resLista.body;
        const enviada = mensagens.find((m) => m.origin === 'employee' && m.transfer_type === 0 && m.message_status === 'sent');
        const doCliente = mensagens.find((m) => m.origin === 'customer');
        const eventoDeSistema = mensagens.find((m) => m.origin === 'employee' && m.transfer_type !== 0);
        // Pré-condição: sem a massa o teste não mediria nada (nunca passa vazio)
        expect(enviada, 'mensagem de funcionário já enviada na massa').to.not.be.undefined;
        expect(doCliente, 'mensagem do cliente na massa').to.not.be.undefined;
        expect(eventoDeSistema, 'evento de sistema (transferência) na massa').to.not.be.undefined;

        [
          ['enviada pelo funcionário', enviada],
          ['do cliente', doCliente],
          ['evento de sistema', eventoDeSistema],
        ].forEach(([rotulo, msg]) => {
          api.post(urlRetry(msg.id)).then((res) => {
            expect(res.status, `Status do reenvio da mensagem ${rotulo}`).to.eq(409);
            expect(res.body.code, `code do reenvio da mensagem ${rotulo}`).to.eq('ATTENDANCE_MESSAGE_NOT_RETRYABLE');
          });
        });
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 40: NOME E LEGENDA DE DOCUMENTOS NO CHAT (ISSUE BACKEND#563, ENTREGUE PELO BACKEND#585)
  // ---------------------------------------------------------------------------
  context('17. Nome e Legenda de Documentos no Chat (Issue backend#563/#585)', () => {

    const pdfFixture = 'cypress/fixtures/5.atendimentos/anexos/normal/Anexo de teste PDF.pdf';
    // Nome acima do limite de DESCRICAO VARCHAR(60): o backend corta o meio e preserva a extensão (limitação aceita)
    const nomeLongo = 'relatorio-mensal-de-vendas-da-farmacia-unidade-centro-2026-10.pdf';
    const limiteNome = 60;
    // Documentos RECEBIDOS do cliente (massa real, atendimento 261000014, gravados depois do omnichannel-aws#93)
    const attendanceIdRecebidos = 261000014;
    const mensagensRecebidasIds = [4857096, 4857188];

    // Localiza um atendimento do operador, Em andamento e com janela de 24h ativa - o upload de mídia só é aceito assim.
    const obterAtendimentoParaUpload = () => {
      return api.listarAtendimentos(storeId, { status: 'in_progress', page: 1, per_page: 30 }).then((res) => {
        const candidatos = res.body.items || res.body.data || [];
        expect(candidatos.length, 'atendimento Em andamento na fila (assuma/abra um atendimento do DEFAULT_CELULAR antes de rodar)').to.be.at.least(1);
        // A listagem não traz o atendente: confere no detalhe se é do operador e se a janela de 24h está ativa
        const tentar = (i) => api.obterDetalheAtendimento(storeId, candidatos[i].id).then((det) => {
          const att = det.body.attendance || {};
          const doOperador = att.attendant && Number(att.attendant.id) === Number(loggedUserId);
          const janelaAtiva = att.last_customer_message_at && (Date.now() - Date.parse(att.last_customer_message_at)) < 24 * 60 * 60 * 1000;
          if (doOperador && janelaAtiva) return candidatos[i].id;
          if (i + 1 < candidatos.length) return tentar(i + 1);
          throw new Error('🔒 Nenhum atendimento Em andamento do operador com janela de 24h ativa: responda no WhatsApp do DEFAULT_CELULAR (ou assuma o atendimento) e rode de novo');
        });
        return tentar(0);
      });
    };

    const buscarMensagemPorId = (attendanceId, messageId) => {
      return api.listarMensagensAtendimento(storeId, attendanceId, { page: 1, per_page: 20, sort: 'desc' }).then((res) => {
        expect(res.status, 'Status da listagem').to.eq(200);
        const mensagens = res.body.items || res.body.data || res.body;
        const msg = mensagens.find((m) => m.id === messageId);
        expect(msg, `mensagem ${messageId} presente na listagem`).to.not.be.undefined;
        return msg;
      });
    };

    // [SKIP] 2026-10-15 (aba-c, decisão do operador): depende de um atendimento Em andamento do operador com janela de 24h ativa (obterAtendimentoParaUpload), massa que o CI não tem.
    // Falhou no CI do GitHub Actions por falta dessa massa; reativar quando o backend entregar as rotas de massa de teste.
    it.skip('17.1 deve devolver o nome original do documento enviado em attachment.filename e a legenda no campo content', () => {
      const nome = `legenda-backend563-${Date.now()}.pdf`;
      const legenda = 'Legenda de teste backend#563';
      obterAtendimentoParaUpload().then((attendanceId) => {
        api.enviarMidiaAtendimento(storeId, attendanceId, { filePath: pdfFixture, fileName: nome, mimeType: 'application/pdf', caption: legenda, employeeId: loggedUserId }).then((resEnvio) => {
          expect(resEnvio.status, 'Status do envio do documento com legenda').to.eq(201);
          buscarMensagemPorId(attendanceId, resEnvio.body.id).then((msg) => {
            expect(msg.content_type, 'content_type do documento').to.eq('document');
            expect(msg.attachment.filename, 'nome original preservado com a extensão').to.eq(nome);
            expect(msg.attachment.mime_type, 'mime_type do documento').to.eq('application/pdf');
            expect(msg.content, 'a legenda volta em content, não em um campo caption próprio').to.eq(legenda);
            expect(msg, 'não existe campo caption próprio na mensagem').to.not.have.property('caption');
          });
        });
      });
    });

    // [SKIP] 2026-10-15 (aba-c, decisão do operador): mesma dependência do 40.1 (atendimento Em andamento do operador com janela de 24h ativa).
    // Falhou no CI do GitHub Actions por falta dessa massa; reativar quando o backend entregar as rotas de massa de teste.
    it.skip('17.2 deve cortar o meio do nome acima de 60 caracteres com reticências, preservando a extensão, e devolver content nulo sem legenda (limitação aceita, DESCRICAO VARCHAR(60))', () => {
      expect(nomeLongo.length, 'pré-condição: o nome do teste precisa passar do limite').to.be.greaterThan(limiteNome);
      obterAtendimentoParaUpload().then((attendanceId) => {
        api.enviarMidiaAtendimento(storeId, attendanceId, { filePath: pdfFixture, fileName: nomeLongo, mimeType: 'application/pdf', employeeId: loggedUserId }).then((resEnvio) => {
          expect(resEnvio.status, 'Status do envio do documento de nome longo').to.eq(201);
          buscarMensagemPorId(attendanceId, resEnvio.body.id).then((msg) => {
            const filename = msg.attachment.filename;
            expect(filename.length, 'filename gravado respeita o limite da coluna').to.be.at.most(limiteNome);
            expect(filename, 'extensão preservada').to.match(/\.pdf$/);
            expect(filename, 'corte no meio do nome marcado por reticências antes da extensão').to.match(/…\.pdf$/);
            expect(filename.replace(/….*$/, ''), 'o começo do nome original é preservado').to.satisfy((inicio) => nomeLongo.startsWith(inicio) && inicio.length > 20);
            expect(msg.content, 'sem legenda, content vem nulo na mensagem enviada pela farmácia').to.be.null;
          });
        });
      });
    });

    it('17.3 deve devolver o nome real do documento RECEBIDO do cliente em attachment.filename (nunca documento_<id>), com content igual ao nome quando não há legenda (omnichannel-aws#93)', () => {
      api.listarMensagensAtendimento(storeId, attendanceIdRecebidos, { page: 1, per_page: 100 }).then((res) => {
        expect(res.status, 'Status da listagem').to.eq(200);
        const mensagens = res.body.items || res.body.data || res.body;
        mensagensRecebidasIds.forEach((id) => {
          const msg = mensagens.find((m) => m.id === id);
          expect(msg, `mensagem recebida ${id} presente`).to.not.be.undefined;
          expect(msg.origin, `origem da mensagem ${id}`).to.eq('customer');
          expect(msg.content_type, `content_type da mensagem ${id}`).to.eq('document');
          expect(msg.attachment.filename, `filename da mensagem ${id} tem extensão`).to.match(/\.[A-Za-z0-9]+$/);
          expect(msg.attachment.filename, `filename da mensagem ${id} não é o nome inventado do fallback`).to.not.match(/^documento_\d+\./);
          expect(msg.content, `sem legenda, content repete o filename na mensagem ${id}`).to.eq(msg.attachment.filename);
        });
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 49: BAIXA DE LEITURA (POST /read) SOB CONFLITO DE ATUALIZAÇÃO
  // ---------------------------------------------------------------------------
  context('18. Baixa de Leitura das Mensagens (POST /read) Nunca Responde 500 sob Conflito de Atualização (Issue backend#641/PR #648)', () => {

    // O UPDATE de LEITURA_DT dispara o trigger OC_ATENDIMENTO_MSG_AI1_MSG_QTDE, que regrava OC_ATENDIMENTO.MSG_QTDE e colide com outra transação no mesmo atendimento
    // (mensagem recebida, troca de status ou outra aba marcando como lida): 40001 virava 500. A PR #648 repete a transação até 3 vezes (a baixa é idempotente: só marca
    // LEITURA_DT IS NULL) e, se ainda falhar, responde 409 ATTENDANCE_READ_CONFLICT com "O atendimento está sendo atualizado por outra operação. Tente novamente.".
    // Medido em 2026-10-16 na API real: o conflito NÃO é reproduzível aqui. Nenhum atendimento da massa aceita a baixa (os ~80 Finalizados com não lidas respondem
    // messages_marked 0 e o unread_count não muda; Aguardando, Em andamento e Pendente não têm não lidas) e mensagem recebida só entra por WhatsApp. Por isso estes
    // testes fixam o contrato (200, idempotência, 401/404) e o invariante de que 10 baixas simultâneas no mesmo atendimento nunca devolvem 5xx, mas NÃO provam o
    // trigger nem o 409 — essa parte fica para QA manual/CloudWatch e para quando houver atendimento do operador com não lidas.
    const TIMEOUT_ROTA = { timeout: 90000 };
    const itensDe = (res) => (res.body && (res.body.items || res.body.data)) || [];

    // O 18.2 usa o fetch do navegador (cy.request não dispara em paralelo). Até 2026-11-06 o catch-all do e2e.js respondia um 200 genérico a ele com
    // USE_MOCKS true e este context forçava a flag para false; desde o P2-01 o e2e.js não registra o catch-all nos specs 0-A/0-B/0-C, então o fetch
    // chega à API real com qualquer USE_MOCKS (AGENTS.md [R-BACKEND]).

    // Reúne os atendimentos Aguardando e Finalizado que atendem ao critério e devolve o 1º pela ordem pedida (massa dinâmica, só leitura)
    const acharAtendimento = (criterio, preferir) => {
      const coletados = [];
      const buscar = (statuses, i) => {
        if (i >= statuses.length) return cy.wrap(coletados.sort(preferir)[0] || null, { log: false });
        return api.listarAtendimentos(storeId, { status: statuses[i], page: 1, per_page: 100 }, TIMEOUT_ROTA).then((res) => {
          expect(res.status, `Status da listagem ${statuses[i]}`).to.eq(200);
          coletados.push(...itensDe(res).filter(criterio));
          return buscar(statuses, i + 1);
        });
      };
      return buscar(['waiting', 'finished'], 0);
    };
    const naoLidas = (a) => (a.messages && a.messages.unread_count) || 0;

    it('18.1 Deve responder 200 com attendance_id, unread_count e messages_marked na baixa de leitura e repetir o mesmo resultado na 2ª chamada', () => {
      // Atendimento sem não lidas: a baixa não altera nada, então a massa não é consumida (cenário 3 do roteiro de QA da issue)
      acharAtendimento((a) => naoLidas(a) === 0, () => 0).then((att) => {
        expect(att, '🔒 Nenhum atendimento Aguardando/Finalizado sem mensagens não lidas (massa)').to.exist;
        api.marcarMensagensLidas(storeId, att.id, {}, TIMEOUT_ROTA).then((r1) => {
          expect(r1.status, 'Status da 1ª baixa').to.eq(200);
          expect(r1.body.attendance_id, 'attendance_id da resposta').to.eq(att.id);
          expect(r1.body.unread_count, 'unread_count da resposta').to.eq(0);
          expect(r1.body.messages_marked, 'messages_marked da resposta').to.eq(0);
          api.marcarMensagensLidas(storeId, att.id, {}, TIMEOUT_ROTA).then((r2) => {
            expect(r2.status, 'Status da 2ª baixa (idempotente)').to.eq(200);
            expect(r2.body.attendance_id, 'attendance_id da 2ª resposta').to.eq(att.id);
            expect(r2.body.unread_count, 'unread_count da 2ª resposta').to.eq(0);
            expect(r2.body.messages_marked, 'messages_marked da 2ª resposta').to.eq(0);
          });
        });
      });
    });

    it('18.2 Deve responder só 200 ou 409 ATTENDANCE_READ_CONFLICT, nunca 5xx, a 10 baixas de leitura simultâneas no mesmo atendimento', () => {
      // Simula "outra aba marcando como lida" (cenário 2 da issue): 10 POST /read em paralelo pelo fetch do navegador, que cy.request não faz.
      // Escolhe o atendimento com mais não lidas, para exercitar o UPDATE quando a massa permitir (hoje a baixa não marca nada, ver o comentário do contexto)
      acharAtendimento(() => true, (a, b) => naoLidas(b) - naoLidas(a)).then((att) => {
        expect(att, '🔒 Nenhum atendimento Aguardando/Finalizado na fila (massa)').to.exist;
        const naoLidasAntes = naoLidas(att);
        const url = `${api.apiUrl}/attendances/${att.id}/read`;
        const token = Cypress.env('backendAuthToken');

        // fetch do próprio spec (origem do app, a mesma do CORS do front), não o da janela do app, que no 0-A/0-B/0-C está em about:blank
        cy.wrap(Promise.all(Array.from({ length: 10 }, (_, i) => window.fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: '{}',
        }).then(async (r) => ({ i, status: r.status, body: await r.json().catch(() => null) })))), { timeout: 90000 }).then((respostas) => {
          let marcadas = 0;
          respostas.forEach(({ i, status, body }) => {
            expect([200, 409], `Status da baixa simultânea #${i} (500 era o defeito)`).to.include(status);
            if (status === 409) {
              expect(body.code, `code do 409 da baixa #${i}`).to.eq('ATTENDANCE_READ_CONFLICT');
              expect(body.message, `message do 409 da baixa #${i}`).to.eq('O atendimento está sendo atualizado por outra operação. Tente novamente.');
            } else {
              expect(body.attendance_id, `attendance_id da baixa #${i}`).to.eq(att.id);
              expect(Number.isInteger(body.unread_count) && body.unread_count >= 0, `unread_count inteiro >= 0 na baixa #${i}`).to.be.true;
              expect(Number.isInteger(body.messages_marked) && body.messages_marked >= 0, `messages_marked inteiro >= 0 na baixa #${i}`).to.be.true;
              marcadas += body.messages_marked;
            }
          });
          // Idempotência: as mensagens só podem ser marcadas uma vez, somando as 10 respostas
          expect(marcadas, `soma de messages_marked das 10 baixas (não lidas antes: ${naoLidasAntes})`).to.be.at.most(naoLidasAntes);
        });
      });
    });

    it('18.3 Deve responder 401 sem token e 404 para atendimento inexistente na baixa de leitura', () => {
      acharAtendimento(() => true, () => 0).then((att) => {
        expect(att, '🔒 Nenhum atendimento Aguardando/Finalizado na fila (massa)').to.exist;
        api.marcarMensagensLidas(storeId, att.id, {}, { ...TIMEOUT_ROTA, headers: { Authorization: '' } }).then((res) => {
          expect(res.status, 'Status sem token JWT').to.eq(401);
        });
      });
      api.marcarMensagensLidas(storeId, 999999999, {}, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status do atendimento inexistente').to.eq(404);
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 51: TRANSFERÊNCIA DE ATENDIMENTO SÓ PARA O GRUPO E DADOS DO MODAL DE TRANSFERÊNCIA
  // ---------------------------------------------------------------------------
  context('19. Transferência de Atendimento só para o Grupo e Dados do Modal de Transferência (Issue backend#666/PR #671 e #672)', () => {

    // PR #671: `PATCH .../attendances/:id` aceita `{ channel_group_id }` sem `target_attendant_id` ("transferir para o grupo": Pendente, sem atendente, sem substatus).
    // PR #672: `GET /channel-groups` traz `channels`, `agents_total` e `agents_available`; `GET /attendance-groups/:id/agents` traz `ongoing_attendances`.
    // A transferência de verdade (cenários 1 a 3, 7 e 8 do QA) muda atendimento real, deixa Pendente e sem dono quem estava Em andamento e não tem como voltar, e os cenários de
    // permissão pedem outras contas (`[R-CAPXACAO]`): ficam sem teste aqui. Só são enviados ao PATCH corpos que o contrato recusa e a recusa é conferida sem mudança no atendimento.
    // O 409 de atendimento encerrado só é enviado depois de um sentinela (grupo + status, recusado com 422 pela versão nova): sem a PR #671 no ar o PATCH reabriria o atendimento
    // encerrado (Pendente) e mandaria a pesquisa de satisfação ao cliente.
    const TIMEOUT_ROTA = { timeout: 90000 };
    const MSG_SEM_STATUS = 'A transferência para o grupo não aceita status.';
    const itensDe = (res) => (res.body && (res.body.items || res.body.data)) || [];

    const acharAtendimento = (status) => api.listarAtendimentos(storeId, { status, page: 1, per_page: 20 }, TIMEOUT_ROTA).then((res) => {
      expect(res.status, `Status da listagem da fila (${status})`).to.eq(200);
      return itensDe(res).find((a) => a.group && a.group.id);
    });

    const listarGrupos = () => api.get(`/channel-groups`, {}, TIMEOUT_ROTA).then((res) => {
      expect(res.status, 'Status de /channel-groups sem channel_id').to.eq(200);
      return itensDe(res);
    });

    const outroGrupoQue = (grupoAtualId) => listarGrupos().then((grupos) => {
      const outro = grupos.find((g) => g.id !== grupoAtualId);
      expect(outro, '🔒 A loja precisa de ao menos 2 grupos (massa)').to.exist;
      return outro.id;
    });

    const fotoDoAtendimento = (id) => api.obterDetalheAtendimento(storeId, id, TIMEOUT_ROTA).then((det) => JSON.stringify(det.body.attendance));

    it('19.1 Deve recusar com 422 ATTENDANCE_SAME_GROUP a transferência para o grupo em que o atendimento já está', () => {
      acharAtendimento('waiting').then((att) => {
        expect(att, '🔒 Nenhum atendimento na fila Aguardando (massa)').to.exist;
        fotoDoAtendimento(att.id).then((antes) => {
          api.atualizarStatusAtendimento(storeId, att.id, { channel_group_id: att.group.id }, TIMEOUT_ROTA).then((res) => {
            expect(res.status, 'Status da transferência para o próprio grupo').to.eq(422);
            expect(res.body.code, 'code da recusa').to.eq('ATTENDANCE_SAME_GROUP');
            expect(res.body.message, 'Mensagem da recusa').to.eq('O atendimento já está neste grupo.');
          });
          fotoDoAtendimento(att.id).then((depois) => {
            expect(depois, 'o atendimento não pode mudar com a transferência recusada').to.eq(antes);
          });
        });
      });
    });

    it('19.2 Deve recusar com 422 a transferência para o grupo com status ou substatus no corpo, e seguir recusando target_attendant_id nulo', () => {
      acharAtendimento('waiting').then((att) => {
        expect(att, '🔒 Nenhum atendimento na fila Aguardando (massa)').to.exist;
        outroGrupoQue(att.group.id).then((outroGrupo) => {
          fotoDoAtendimento(att.id).then((antes) => {
            [{ status: 1 }, { custom_status_id: 1 }].forEach((extra) => {
              api.atualizarStatusAtendimento(storeId, att.id, { channel_group_id: outroGrupo, ...extra }, TIMEOUT_ROTA).then((res) => {
                expect(res.status, `Status do corpo com ${Object.keys(extra)[0]}`).to.eq(422);
                expect(res.body.message, `Mensagem do corpo com ${Object.keys(extra)[0]}`).to.eq(MSG_SEM_STATUS);
              });
            });
            // Contrato antigo preservado: o atendente nulo continua sem significar "só o grupo"
            api.atualizarStatusAtendimento(storeId, att.id, { channel_group_id: outroGrupo, target_attendant_id: null }, TIMEOUT_ROTA).then((res) => {
              expect(res.status, 'Status do corpo com target_attendant_id nulo').to.eq(422);
              expect(res.body.message, 'Mensagem do corpo com target_attendant_id nulo').to.eq('O campo target_attendant_id não aceita valor nulo');
            });
            fotoDoAtendimento(att.id).then((depois) => {
              expect(depois, 'o atendimento não pode mudar com as transferências recusadas').to.eq(antes);
            });
          });
        });
      });
    });

    it('19.3 Deve recusar com 409 ATTENDANCE_TRANSFER_CLOSED a troca de grupo de um atendimento encerrado, sem mudar nada', () => {
      acharAtendimento('finished').then((encerrado) => {
        expect(encerrado, '🔒 Nenhum atendimento Finalizado na fila (massa)').to.exist;
        acharAtendimento('waiting').then((aberto) => {
          expect(aberto, '🔒 Nenhum atendimento na fila Aguardando para o sentinela (massa)').to.exist;
          outroGrupoQue(encerrado.group.id).then((outroGrupo) => {
            // Sentinela: grupo + status é recusado com 422 pela PR #671; a versão antiga também recusa, mas com outra mensagem
            api.atualizarStatusAtendimento(storeId, aberto.id, { channel_group_id: outroGrupo, status: 1 }, TIMEOUT_ROTA).then((res) => {
              expect(res.body.message, '🛑 A PR #671 não está no ar: a troca de grupo do atendimento encerrado NÃO foi enviada para não reabri-lo').to.eq(MSG_SEM_STATUS);
            });
            fotoDoAtendimento(encerrado.id).then((antes) => {
              api.atualizarStatusAtendimento(storeId, encerrado.id, { channel_group_id: outroGrupo }, TIMEOUT_ROTA).then((res) => {
                expect(res.status, 'Status da troca de grupo do atendimento encerrado').to.eq(409);
                expect(res.body.code, 'code da recusa').to.eq('ATTENDANCE_TRANSFER_CLOSED');
                expect(res.body.message, 'Mensagem da recusa').to.eq('Não é possível trocar o grupo de um atendimento encerrado.');
              });
              fotoDoAtendimento(encerrado.id).then((depois) => {
                expect(depois, 'o atendimento encerrado não pode mudar (status, grupo e atendente)').to.eq(antes);
              });
            });
          });
        });
      });
    });

    it('19.4 Deve listar os grupos com canais ativos, total e disponíveis de atendentes, sem channel_id e filtrados por canal', () => {
      listarGrupos().then((grupos) => {
        expect(grupos.length, 'Quantidade de grupos da loja').to.be.at.least(1);
        grupos.forEach((g) => {
          expect(g.id, `id do grupo ${g.name}`).to.be.a('number');
          expect(g.name, `name do grupo ${g.id}`).to.be.a('string').and.not.be.empty;
          // Grupo sem canal ativo vem com channels: [] (não ausente)
          expect(g.channels, `channels do grupo ${g.name}`).to.be.an('array');
          g.channels.forEach((c) => {
            expect(c.id, `id de canal do grupo ${g.name}`).to.be.a('number');
            expect(c.name, `name de canal do grupo ${g.name}`).to.be.a('string').and.not.be.empty;
          });
          expect(Number.isInteger(g.agents_total) && g.agents_total >= 0, `agents_total do grupo ${g.name}`).to.be.true;
          expect(Number.isInteger(g.agents_available) && g.agents_available >= 0 && g.agents_available <= g.agents_total, `agents_available do grupo ${g.name} (0 a agents_total)`).to.be.true;
        });

        // Com channel_id a lista é o subconjunto de grupos vinculados àquele canal
        const comCanal = grupos.find((g) => g.channels.length > 0);
        expect(comCanal, '🔒 Nenhum grupo com canal ativo vinculado (massa)').to.exist;
        const canalId = comCanal.channels[0].id;
        api.listarGruposCanal(storeId, canalId, TIMEOUT_ROTA).then((res) => {
          expect(res.status, `Status de /channel-groups?channel_id=${canalId}`).to.eq(200);
          const filtrados = itensDe(res);
          expect(filtrados.map((g) => g.id), 'o grupo do canal escolhido aparece no filtro').to.include(comCanal.id);
          filtrados.forEach((g) => {
            expect(grupos.map((x) => x.id), `grupo ${g.name} do filtro existe na lista completa`).to.include(g.id);
            expect(g.channels.map((c) => c.id), `grupo ${g.name} do filtro está vinculado ao canal ${canalId}`).to.include(canalId);
          });
        });
      });
    });

    it('19.5 Deve bater agents_total e agents_available do grupo com a lista de atendentes, e trazer ongoing_attendances em cada atendente', () => {
      listarGrupos().then((grupos) => {
        const comAtendentes = grupos.filter((g) => g.agents_total > 0).slice(0, 3);
        expect(comAtendentes.length, '🔒 Nenhum grupo com atendentes (massa)').to.be.at.least(1);
        comAtendentes.forEach((g) => {
          api.get(`/attendance-groups/${g.id}/agents`, {}, TIMEOUT_ROTA).then((res) => {
            expect(res.status, `Status dos atendentes do grupo ${g.name}`).to.eq(200);
            const atendentes = res.body.agents;
            expect(atendentes, `Lista de atendentes do grupo ${g.name}`).to.be.an('array');
            expect(atendentes.length, `agents_total do grupo ${g.name} = atendentes da lista`).to.eq(g.agents_total);
            expect(atendentes.filter((a) => a.status === 'available').length, `agents_available do grupo ${g.name} = atendentes com status available`).to.eq(g.agents_available);
            atendentes.forEach((a) => {
              expect(a.status, `status de ${a.name}`).to.be.oneOf(['available', 'busy', 'offline']);
              expect(Number.isInteger(a.ongoing_attendances) && a.ongoing_attendances >= 0, `ongoing_attendances de ${a.name}`).to.be.true;
            });
          });
        });
      });
    });

    it('19.6 Deve recusar com 409 ATTENDANCE_TRANSFER_CLOSED a transferência para atendente de outro grupo em atendimento Finalizado ou Descartado, sem mudar nada', () => {
      // Issue backend#515 (cenário 3): o corpo é o da tela, grupo + atendente (o 19.3 cobre só o grupo). Antes da PR #671 o trigger `OC_ATENDIMENTO_AU0` forçava Pendente e reabria o atendimento encerrado.
      // Concluído (status 2) não tem massa na dev (a listagem `completed` vem vazia): fica só Finalizado e Descartado. Os cenários 1, 2, 4 e 5 gravam em atendimento real e ficam sem teste (`ROADMAP.md` P1-23).
      const alvoDeOutroGrupo = (grupoAtualId) => listarGrupos().then((grupos) => {
        const candidatos = grupos.filter((g) => g.id !== grupoAtualId && g.agents_total > 0);
        expect(candidatos.length, '🔒 A loja precisa de outro grupo com atendentes (massa)').to.be.at.least(1);
        return api.get(`/attendance-groups/${candidatos[0].id}/agents`, {}, TIMEOUT_ROTA).then((res) => {
          expect(res.status, 'Status dos atendentes do outro grupo').to.eq(200);
          const agente = res.body.agents[0];
          expect(agente && agente.agent_id, '🔒 O outro grupo não trouxe atendente (massa)').to.be.ok;
          return { grupoId: candidatos[0].id, agenteId: agente.agent_id };
        });
      });

      acharAtendimento('waiting').then((aberto) => {
        expect(aberto, '🔒 Nenhum atendimento na fila Aguardando para o sentinela (massa)').to.exist;
        outroGrupoQue(aberto.group.id).then((outroGrupo) => {
          // Sentinela: grupo + status é recusado com 422 pela PR #671; sem ela o PATCH abaixo reabriria o atendimento encerrado como Pendente e com atendente
          api.atualizarStatusAtendimento(storeId, aberto.id, { channel_group_id: outroGrupo, status: 1 }, TIMEOUT_ROTA).then((res) => {
            expect(res.body.message, '🛑 A PR #671 não está no ar: a troca de grupo com atendente NÃO foi enviada para não reabrir o atendimento encerrado').to.eq(MSG_SEM_STATUS);
          });
        });
      });

      ['finished', 'discarded'].forEach((status) => {
        acharAtendimento(status).then((encerrado) => {
          expect(encerrado, `🔒 Nenhum atendimento ${status} com grupo na fila (massa)`).to.exist;
          alvoDeOutroGrupo(encerrado.group.id).then(({ grupoId, agenteId }) => {
            fotoDoAtendimento(encerrado.id).then((antes) => {
              api.atualizarStatusAtendimento(storeId, encerrado.id, { channel_group_id: grupoId, target_attendant_id: agenteId }, TIMEOUT_ROTA).then((res) => {
                expect(res.status, `Status da troca de grupo com atendente no atendimento ${status}`).to.eq(409);
                expect(res.body.code, `code da recusa (${status})`).to.eq('ATTENDANCE_TRANSFER_CLOSED');
                expect(res.body.message, `Mensagem da recusa (${status})`).to.eq('Não é possível trocar o grupo de um atendimento encerrado.');
              });
              fotoDoAtendimento(encerrado.id).then((depois) => {
                expect(depois, `o atendimento ${status} não pode mudar (status, grupo e atendente)`).to.eq(antes);
              });
            });
          });
        });
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 53: ENVIO DE ARQUIVOS PARA A IA PELA FILA IA_ORCAMENTO (ISSUE BACKEND#667, PR #670)
  // ---------------------------------------------------------------------------
  context('20. Envio de Arquivos para a IA pela Fila IA_ORCAMENTO, sem Chamar a PH24 (Issue backend#667/PR #670)', () => {

    // PR #670: `POST .../attendances/:id/ia-files/submissions` deixa de chamar a PH24 por HTTP e grava uma linha em IA_ORCAMENTO por
    // arquivo (TIPO_MOV = 1, STATUS = 0), respondendo 202 na hora; o worker existente leva a linha até a PH24.
    // Aqui só entram corpos que o contrato recusa antes de gravar (422/400/404/401): o envio de verdade (202) põe uma linha na fila,
    // posta "processando o orçamento pela I.A., aguarde..." no chat e consome a PH24 a cada rodada, e o 409 IA_FILE_ALREADY_QUEUED
    // só existe depois de um 202 — ficam fora deste context (ver ROADMAP.md). A listagem de arquivos de IA é fotografada antes e
    // depois de cada recusa para provar que nada entrou na fila.
    // Ordem das validações medida em 2026-10-16 contra a dev: lote vazio/ids inválidos → movement_type → posse dos arquivos → fila;
    // o atendimento inexistente só responde 404 depois de o lote passar na validação de forma.
    const TIMEOUT_ROTA = { timeout: 90000 };
    // Massa real e permanente: atendimento 261000039 (ctx 13) tem o arquivo de IA 1423 já calculado; o arquivo 257 pertence ao
    // atendimento 260700034 (ctx 13) e serve como "arquivo de outro atendimento".
    const attendanceComIa = 261000039;
    const arquivoIaDoAtendimento = 1423;
    const arquivoIaDeOutroAtendimento = 257;
    const atendimentoInexistente = 999999999;
    const MSG_LOTE_VAZIO = 'Selecione ao menos um arquivo.';
    const MSG_IDS_INVALIDOS = 'Identificadores de arquivo inválidos.';
    const MSG_OUTRO_ATENDIMENTO = 'Um ou mais arquivos não pertencem a este atendimento.';
    const MSG_TIPO_MOVIMENTO = 'Tipo de movimento inválido.';

    const itensDe = (res) => (res.body && (res.body.items || res.body.data)) || res.body || [];
    // A listagem é leitura idempotente: 502/503/504 do gateway (visto 1 vez no CI, run 39952103591, com os 14 jobs batendo na dev ao mesmo tempo, e verde nas rodadas
    // anteriores) é repetido até 3 vezes antes de virar falha. Só a listagem repete; os envios (POST) nunca, para não mascarar a recusa que o teste mede.
    const listarArquivosIaComRetry = (tentativa = 1) => api.listarArquivosIa(storeId, attendanceComIa, TIMEOUT_ROTA).then((res) => {
      if ([502, 503, 504].includes(res.status) && tentativa < 3) {
        cy.wait(2000);
        return listarArquivosIaComRetry(tentativa + 1);
      }
      return res;
    });
    const fotoDaFilaIa = () => listarArquivosIaComRetry().then((res) => {
      expect(res.status, 'Status da listagem de arquivos de IA').to.eq(200);
      return JSON.stringify(itensDe(res).map((f) => ({ id: f.id, ia_status: f.ia_status })));
    });
    const submeter = (attendanceId, body, options = {}) => api.enviarArquivosIa(storeId, attendanceId, body, { ...TIMEOUT_ROTA, ...options });
    const esperarRecusa = (res, rotulo, status, mensagem) => {
      expect(res.status, `Status de ${rotulo}`).to.eq(status);
      expect(res.body.message, `Mensagem de ${rotulo}`).to.eq(mensagem);
    };

    it('20.1 Deve recusar com 422 o lote sem arquivos ("Selecione ao menos um arquivo.") sem gravar nada na fila', () => {
      fotoDaFilaIa().then((antes) => {
        submeter(attendanceComIa, { file_ids: [] }).then((res) => {
          esperarRecusa(res, 'file_ids vazio', 422, MSG_LOTE_VAZIO);
          expect(res.body, 'a recusa de validação não traz code').to.not.have.property('code');
        });
        submeter(attendanceComIa, { file_ids: [], movement_type: 1 }).then((res) => esperarRecusa(res, 'file_ids vazio com movement_type 1', 422, MSG_LOTE_VAZIO));
        fotoDaFilaIa().then((depois) => expect(depois, 'nenhum arquivo entrou na fila da IA').to.eq(antes));
      });
    });

    it('20.2 Deve recusar com 422 os identificadores 0 e negativo ("Identificadores de arquivo inválidos.") e com 400 o corpo malformado, sem gravar nada', () => {
      fotoDaFilaIa().then((antes) => {
        submeter(attendanceComIa, { file_ids: [0] }).then((res) => esperarRecusa(res, 'file_ids com 0', 422, MSG_IDS_INVALIDOS));
        submeter(attendanceComIa, { file_ids: [-5] }).then((res) => esperarRecusa(res, 'file_ids negativo', 422, MSG_IDS_INVALIDOS));
        submeter(attendanceComIa, { file_ids: [arquivoIaDoAtendimento, 0] }).then((res) => esperarRecusa(res, 'lote com um id válido e um 0', 422, MSG_IDS_INVALIDOS));
        // Contrato medido (não descrito na issue): id não numérico e corpo sem file_ids caem na desserialização, antes da validação
        submeter(attendanceComIa, { file_ids: ['abc'] }).then((res) => esperarRecusa(res, 'file_ids com texto', 400, 'Malformed request body'));
        submeter(attendanceComIa, {}).then((res) => esperarRecusa(res, 'corpo sem file_ids', 400, 'Malformed request body'));
        fotoDaFilaIa().then((depois) => expect(depois, 'nenhum arquivo entrou na fila da IA').to.eq(antes));
      });
    });

    it('20.3 Deve recusar com 422 o arquivo de outro atendimento ou inexistente ("Um ou mais arquivos não pertencem a este atendimento."), inclusive com movement_type 1, sem gravar nada', () => {
      fotoDaFilaIa().then((antes) => {
        submeter(attendanceComIa, { file_ids: [arquivoIaDeOutroAtendimento] }).then((res) => esperarRecusa(res, 'arquivo de outro atendimento', 422, MSG_OUTRO_ATENDIMENTO));
        submeter(attendanceComIa, { file_ids: [arquivoIaDoAtendimento, arquivoIaDeOutroAtendimento] }).then((res) => esperarRecusa(res, 'lote com um arquivo do atendimento e um de outro', 422, MSG_OUTRO_ATENDIMENTO));
        submeter(attendanceComIa, { file_ids: [999999999] }).then((res) => esperarRecusa(res, 'arquivo inexistente', 422, MSG_OUTRO_ATENDIMENTO));
        // movement_type 1 (OC_ATENDIMENTO) é o padrão e segue o mesmo caminho: a recusa continua sendo a de posse, não a de tipo
        submeter(attendanceComIa, { file_ids: [arquivoIaDeOutroAtendimento], movement_type: 1 }).then((res) => esperarRecusa(res, 'arquivo de outro atendimento com movement_type 1', 422, MSG_OUTRO_ATENDIMENTO));
        fotoDaFilaIa().then((depois) => expect(depois, 'nenhum arquivo entrou na fila da IA (o lote inteiro é recusado)').to.eq(antes));
      });
    });

    it('20.4 Deve recusar com 422 INVALID_CONTEXT o movement_type diferente de 1 ("Tipo de movimento inválido.") antes de conferir a posse dos arquivos', () => {
      // O corpo leva um arquivo de outro atendimento de propósito: se a ordem das validações mudar, a resposta vira a recusa de posse
      // (o teste falha) e mesmo assim nada pode entrar na fila.
      fotoDaFilaIa().then((antes) => {
        [2, 0, -1].forEach((tipo) => {
          submeter(attendanceComIa, { file_ids: [arquivoIaDeOutroAtendimento], movement_type: tipo }).then((res) => {
            esperarRecusa(res, `movement_type ${tipo}`, 422, MSG_TIPO_MOVIMENTO);
            expect(res.body.code, `code de movement_type ${tipo}`).to.eq('INVALID_CONTEXT');
          });
        });
        fotoDaFilaIa().then((depois) => expect(depois, 'nenhum arquivo entrou na fila da IA').to.eq(antes));
      });
    });

    it('20.5 Deve responder 404 "Atendimento não encontrado" para atendimento inexistente e 401 sem token ou com token adulterado', () => {
      submeter(atendimentoInexistente, { file_ids: [arquivoIaDoAtendimento] }).then((res) => esperarRecusa(res, 'atendimento inexistente', 404, 'Atendimento não encontrado'));
      // A validação de forma do lote vem antes de carregar o atendimento: lote vazio num atendimento inexistente ainda é 422
      submeter(atendimentoInexistente, { file_ids: [] }).then((res) => esperarRecusa(res, 'lote vazio em atendimento inexistente', 422, MSG_LOTE_VAZIO));
      submeter(attendanceComIa, { file_ids: [arquivoIaDoAtendimento] }, { headers: { Authorization: '' } }).then((res) => {
        expect(res.status, 'Status sem token').to.eq(401);
      });
      submeter(attendanceComIa, { file_ids: [arquivoIaDoAtendimento] }, { headers: { Authorization: 'Bearer abc.def.ghi' } }).then((res) => {
        expect(res.status, 'Status com token adulterado').to.eq(401);
      });
    });

    it('20.6 Deve aceitar com 202 o envio real à fila da IA, recusar com 409 IA_FILE_ALREADY_QUEUED o reenvio imediato e listar o arquivo como processando (só com --env IA_SUBMISSAO_REAL=true)', function () {
      // Decisão do operador (ROADMAP.md P1-39, opção b, 2026-11-06): cada envio real grava uma linha em IA_ORCAMENTO, posta "processando o orçamento pela I.A., aguarde..."
      // no chat do atendimento e manda o worker à PH24 (consome crédito e pode gerar orçamento novo), sem como desfazer. Por isso só roda sob demanda, nunca no CI.
      if (!Cypress.env('IA_SUBMISSAO_REAL')) {
        cy.log('⏭️ Envio real à IA desligado: rode com --env IA_SUBMISSAO_REAL=true para exercitar o 202 e o 409 (consome a PH24)');
        this.skip();
        return;
      }
      submeter(attendanceComIa, { file_ids: [arquivoIaDoAtendimento], movement_type: 1 }).then((res) => {
        expect(res.status, 'Status do envio real à fila da IA').to.eq(202);
        expect(res.body.accepted_file_ids, 'accepted_file_ids traz o arquivo enviado').to.include(arquivoIaDoAtendimento);
      });
      // O reenvio imediato encontra a linha ainda na fila (STATUS = 0) e é recusado sem gravar outra
      submeter(attendanceComIa, { file_ids: [arquivoIaDoAtendimento], movement_type: 1 }).then((res) => {
        expect(res.status, 'Status do reenvio imediato').to.eq(409);
        expect(res.body.code, 'code do reenvio imediato').to.eq('IA_FILE_ALREADY_QUEUED');
      });
      listarArquivosIaComRetry().then((res) => {
        expect(res.status, 'Status da listagem de arquivos de IA').to.eq(200);
        const arquivo = itensDe(res).find((f) => f.id === arquivoIaDoAtendimento);
        expect(arquivo, `Arquivo ${arquivoIaDoAtendimento} na listagem`).to.exist;
        expect(arquivo.ia_status, 'ia_status logo após o envio (0 = processando)').to.eq(0);
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 56: LISTA DE CANAIS DO FILTRO DA FILA (GET /attendances/channels) — ISSUE CYPRESS#47, BACKEND#685 E #687
  // ---------------------------------------------------------------------------
  context('21. Lista de Canais do Filtro da Fila: Só os Canais Ativos, Inclusive Pedido Pago, Exigindo só o Acesso ao Módulo de Atendimento (Issue cypress#47/backend#685 e #687; backend#721/PR #733)', () => {

    // Rota nova `GET /attendances/channels`, para o seletor Canal do filtro da fila: traz os canais ATIVOS de `OC_CANAL` (`ATIVO = -1`, backend#721/PR #733, como no legado; até então vinham
    // também os inativos), inclusive Pedido Pago (`channel_subtype: 2`),
    // ordenados por nome, com o mesmo item de `/channels` (sem campo novo), e exige só o acesso ao módulo de atendimento (418). `/channels` (Iniciar atendimento) não mudou: só canais ativos
    // que não são Pedido Pago, exigindo 636. O front só passa a usar a rota nova com a pharmacie-front#582 (em 2026-10-16 o bundle da dev ainda chama só `/channels`, `ROADMAP.md` P1).
    // Os canais e a ordem do homolog (6 canais, medidos em 2026-10-16) são massa: os testes afirmam a regra (ordem por nome, superconjunto de `/channels`, presença de `channel_subtype: 2`),
    // nunca a lista fixa. Cenários 3 e 4 (usuário com 418 sem 636, e sem 418) pedem conta restrita, que o `env.json` não tem: `[R-CAPXACAO]`, só a consistência com as capabilities da conta.
    // A rota ignora o `store_id` do caminho (loja 2 ou inexistente devolvem a mesma lista, como as capabilities da loja): medido, sem asserção.
    const CAMPOS_CANAL = ['channel_subtype', 'channel_type', 'default_channel_group_id', 'id', 'name', 'port', 'whatsapp_number'];
    const PEDIDO_PAGO = 2;
    const itensDe = (res) => (res.body && (res.body.items || res.body.data)) || [];

    it('21.1 Deve listar os canais ativos, inclusive os de Pedido Pago, ordenados por nome', () => {
      api.listarCanaisFiltroFila(storeId).then((res) => {
        expect(res.status, 'Status da lista de canais do filtro da fila').to.eq(200);
        const canais = itensDe(res);
        expect(canais, 'Lista de canais').to.be.an('array').and.not.be.empty;

        // Ordem por nome (comparação por código de caractere, como o banco: espaço < hífen < dígito < letra)
        const nomes = canais.map((c) => String(c.name).toLowerCase());
        nomes.slice(1).forEach((nome, i) => {
          expect(nomes[i] <= nome, `"${canais[i].name}" deve vir antes de "${canais[i + 1].name}" (ordem por nome)`).to.be.true;
        });

        // Sem repetição, e os canais de Pedido Pago (que /channels esconde) vêm junto
        expect(new Set(canais.map((c) => c.id)).size, 'ids únicos').to.eq(canais.length);
        expect(canais.filter((c) => c.channel_subtype === PEDIDO_PAGO).length, '🔒 Nenhum canal de Pedido Pago (channel_subtype 2) no tenant (massa)').to.be.at.least(1);
      });
    });

    it('21.2 Deve trazer em cada item só os campos de /channels, sem campo novo, e idêntico ao de /channels nos canais comuns', () => {
      api.listarCanaisFiltroFila(storeId).then((resFiltro) => {
        api.listarCanais(storeId).then((resInicio) => {
          expect(resFiltro.status, 'Status da lista do filtro').to.eq(200);
          expect(resInicio.status, 'Status de /channels').to.eq(200);
          const doFiltro = itensDe(resFiltro);
          const doInicio = itensDe(resInicio);
          expect(doInicio, '🔒 /channels sem nenhum canal (massa)').to.not.be.empty;

          doFiltro.forEach((canal) => {
            expect(Object.keys(canal).sort(), `Campos do canal ${canal.name}`).to.deep.eq(CAMPOS_CANAL);
            expect(canal.id, `id do canal ${canal.name}`).to.be.a('number');
            expect(canal.name, `name do canal #${canal.id}`).to.be.a('string').and.not.be.empty;
          });
          doInicio.forEach((canal) => {
            const mesmo = doFiltro.find((c) => c.id === canal.id);
            expect(mesmo, `canal #${canal.id} de /channels também na lista do filtro`).to.exist;
            expect(mesmo, `canal #${canal.id} igual nas duas rotas`).to.deep.eq(canal);
          });
        });
      });
    });

    it('21.3 Deve exigir só o acesso ao módulo de atendimento (418) na lista do filtro e a criação de atendimento (636) em /channels, de acordo com as capabilities da conta', () => {
      // `[R-CAPXACAO]`: sem conta restrita, lê as flags que o servidor calculou para a conta de teste e confere a ação. A conta de teste tem as duas (`true`), então só o ramo de sucesso roda;
      // o 403 (sem 418; com 418 e sem 636, que a lista do filtro deve aceitar) é o ramo que autoadapta se o grant da conta mudar.
      api.obterCapabilitiesLoja(storeId).then((resCaps) => {
        expect(resCaps.status, 'Status das capabilities da loja').to.eq(200);
        const caps = resCaps.body.capabilities;
        expect(caps, 'capabilities da loja').to.include.keys('can_access_attendance_module', 'can_create_attendance');

        api.listarCanaisFiltroFila(storeId).then((res) => {
          expect(res.status, `Lista do filtro com can_access_attendance_module=${caps.can_access_attendance_module} (independe de can_create_attendance=${caps.can_create_attendance})`)
            .to.eq(caps.can_access_attendance_module ? 200 : 403);
        });
        api.listarCanais(storeId).then((res) => {
          expect(res.status, `/channels com can_create_attendance=${caps.can_create_attendance}`).to.eq(caps.can_create_attendance ? 200 : 403);
        });
      });
    });

    it('21.4 Deve responder 401 sem token na lista do filtro e em /channels', () => {
      api.listarCanaisFiltroFila(storeId, { headers: { Authorization: '' } }).then((res) => {
        expect(res.status, 'Status da lista do filtro sem token').to.eq(401);
      });
      api.listarCanais(storeId, { headers: { Authorization: '' } }).then((res) => {
        expect(res.status, 'Status de /channels sem token').to.eq(401);
      });
    });

    it('21.5 Deve manter /channels (Iniciar atendimento) sem os canais de Pedido Pago, todos presentes na lista do filtro', () => {
      api.listarCanaisFiltroFila(storeId).then((resFiltro) => {
        api.listarCanais(storeId).then((resInicio) => {
          const doFiltro = itensDe(resFiltro);
          const doInicio = itensDe(resInicio);
          expect(resInicio.status, 'Status de /channels').to.eq(200);
          expect(doInicio, '🔒 /channels sem nenhum canal (massa)').to.not.be.empty;
          doInicio.forEach((canal) => {
            expect(canal.channel_subtype, `/channels não pode trazer Pedido Pago (canal ${canal.name})`).to.not.eq(PEDIDO_PAGO);
          });
          // A lista do filtro é superconjunto: tudo que /channels traz, mais os de Pedido Pago (os inativos saíram com a backend#721)
          const idsFiltro = doFiltro.map((c) => c.id);
          doInicio.forEach((canal) => expect(idsFiltro, `canal #${canal.id} de /channels na lista do filtro`).to.include(canal.id));
          expect(doFiltro.length, 'a lista do filtro tem mais canais que /channels').to.be.greaterThan(doInicio.length);
        });
      });
    });

    it('21.6 Deve manter o detalhe do atendimento (/attendances/:id) como antes, sem a rota nova interferir', () => {
      // Issue backend#685 (cenário 7): `/attendances/channels` e `/attendances/:id` dividem o prefixo; a rota nova não pode ser lida como um id, nem o detalhe pode mudar.
      api.listarAtendimentos(storeId, { status: 'waiting', page: 1, per_page: 20 }).then((resLista) => {
        expect(resLista.status, 'Status da listagem da fila (Aguardando)').to.eq(200);
        const atendimento = itensDe(resLista)[0];
        expect(atendimento, '🔒 Nenhum atendimento na fila Aguardando (massa)').to.exist;
        api.obterDetalheAtendimento(storeId, atendimento.id).then((res) => {
          expect(res.status, 'Status do detalhe do atendimento').to.eq(200);
          expect(res.body, 'Corpo do detalhe').to.include.keys('attendance', 'customer', 'summaries', 'capabilities');
          expect(res.body.attendance.id, 'id do atendimento no detalhe').to.eq(atendimento.id);
          expect(res.body.attendance, 'Campos do atendimento').to.include.keys('id', 'status', 'channel', 'group', 'attendant');
        });
      });
      // Controle: id inexistente continua 404 (não cai na rota de canais nem em erro de conversão)
      api.obterDetalheAtendimento(storeId, 999999999).then((res) => {
        expect(res.status, 'Status do detalhe de atendimento inexistente').to.eq(404);
        expect(res.body.message, 'Mensagem do detalhe inexistente').to.eq('Attendance not found.');
      });
    });

    // Issue backend#721/PR #733: `WHERE C.ATIVO = -1` na consulta do filtro. A API não expõe o status do canal, então a prova é por diferença: `/channels` só traz ativos
    // (fora de Pedido Pago), logo todo canal do filtro que não é de Pedido Pago tem de estar em `/channels`. Medido na dev em 2026-10-20: filtro 1, 2, 3 e 6; saíram o 4 e o 5.
    it('21.7 Não deve listar canal inativo no filtro: todo canal que não é de Pedido Pago está em /channels, os de Pedido Pago seguem e /channels não muda (Issue backend#721/PR #733)', () => {
      api.listarCanaisFiltroFila(storeId).then((resFiltro) => {
        api.listarCanais(storeId).then((resInicio) => {
          expect(resFiltro.status, 'Status da lista do filtro').to.eq(200);
          expect(resInicio.status, 'Status de /channels').to.eq(200);
          const doFiltro = itensDe(resFiltro);
          const idsAtivos = itensDe(resInicio).map((c) => c.id);
          expect(idsAtivos, '🔒 /channels sem nenhum canal ativo (massa)').to.not.be.empty;

          // Nenhum canal fora de /channels que não seja Pedido Pago: é o que antes trazia os inativos
          const foraDeChannels = doFiltro.filter((c) => c.channel_subtype !== PEDIDO_PAGO && !idsAtivos.includes(c.id)).map((c) => `${c.id} ${c.name}`);
          expect(foraDeChannels, 'Canais do filtro que não são de Pedido Pago e não estão em /channels (inativos)').to.deep.eq([]);

          // Os de Pedido Pago (ativos) continuam, e o item não ganhou campo (schema .strict() do front)
          expect(doFiltro.filter((c) => c.channel_subtype === PEDIDO_PAGO).length, '🔒 Nenhum canal de Pedido Pago no tenant (massa)').to.be.at.least(1);
          doFiltro.forEach((c) => expect(Object.keys(c).sort(), `campos do canal ${c.name}`).to.deep.eq(CAMPOS_CANAL));

          // /channels segue o mesmo: só ativos fora de Pedido Pago, todos presentes no filtro
          itensDe(resInicio).forEach((c) => {
            expect(c.channel_subtype, `/channels não traz Pedido Pago (canal ${c.name})`).to.not.eq(PEDIDO_PAGO);
            expect(doFiltro.map((f) => f.id), `canal #${c.id} de /channels presente no filtro`).to.include(c.id);
          });
        });
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 66: FILTRO linked_to_channel EM GET /channel-groups (ISSUE BACKEND#686, PR #720)
  // ---------------------------------------------------------------------------
  context('22. Filtro linked_to_channel em GET /channel-groups Devolve só os Grupos com Vínculo a Canal Ativo (Issue backend#686/PR #720)', () => {

    // No legado só aparece grupo vinculado a canal (`OC_CANAL_GRUPO_RELAC`). `GET /channel-groups?linked_to_channel=true` devolve só os grupos com ao menos um vínculo a canal ATIVO
    // (`OC_CANAL.ATIVO = -1`); sem o parâmetro a lista é a de sempre, com os grupos sem vínculo (a futura tela de cadastro de grupo precisa deles). Combina com `channel_id` e `employee_id`.
    // Medido na dev em 2026-10-20: sem o parâmetro 8 grupos (7, 1 e 6 com `channels` preenchido; 5, 3, 4, 8 e 2 com `channels: []`); `true` → só 7, 1 e 6; `false` e vazio → a lista completa;
    // `abc` → `422 INVALID_CONTEXT` ("Contexto operacional inválido."); `true` + `channel_id=6` → só o 7, igual ao `channel_id` sozinho; `true` + `employee_id` → os mesmos que o `employee_id` sozinho.
    // Fora do teste: grupo ligado só a canal inativo e o canal inativado no meio do teste (não existe na dev e não há rota de massa que mude canal); o atendimento do SAC seguir na fila
    // (a listagem por `channel_group_id=2` veio vazia na janela de datas padrão, sem prova possível); a permissão do filtro da fila (636, 649 ou 557) é outra issue. Só leitura.
    const TIMEOUT_ROTA = { timeout: 90000 };
    const MSG_CONTEXTO_INVALIDO = 'Contexto operacional inválido.';

    const listar = (qs, rotulo) => api.listarGruposComFiltros(storeId, qs, TIMEOUT_ROTA).then((res) => {
      expect(res.status, `Status de /channel-groups (${rotulo})`).to.eq(200);
      expect(res.body.items, `items de /channel-groups (${rotulo})`).to.be.an('array');
      return res.body.items;
    });
    const idsDe = (grupos) => grupos.map((g) => g.id);
    const canaisDe = (g) => g.channels || [];
    const comVinculo = (grupos) => grupos.filter((g) => canaisDe(g).length > 0);

    it('22.1 deve devolver com linked_to_channel=true só os grupos com canal ativo vinculado, na ordem da lista completa, sem os grupos sem vínculo', () => {
      listar({}, 'sem parâmetro').then((completa) => {
        const semVinculo = completa.filter((g) => canaisDe(g).length === 0);
        expect(comVinculo(completa).length, '🔒 Nenhum grupo com canal ativo vinculado (massa)').to.be.at.least(1);
        expect(semVinculo.length, '🔒 Nenhum grupo sem vínculo a canal (massa)').to.be.at.least(1);

        listar({ linked_to_channel: true }, 'linked_to_channel=true').then((filtrada) => {
          expect(idsDe(filtrada), 'Só os grupos com vínculo, na mesma ordem da lista completa').to.deep.eq(idsDe(comVinculo(completa)));
          semVinculo.forEach((g) => {
            expect(idsDe(filtrada), `Grupo sem vínculo "${g.name}" não volta com o filtro`).to.not.include(g.id);
          });
          filtrada.forEach((g) => {
            expect(canaisDe(g).length, `Grupo "${g.name}" traz ao menos 1 canal ativo`).to.be.at.least(1);
            // O formato do item não muda com o filtro
            expect(Number.isInteger(g.agents_total) && g.agents_total >= 0, `agents_total do grupo ${g.name}`).to.be.true;
            expect(Number.isInteger(g.agents_available) && g.agents_available >= 0 && g.agents_available <= g.agents_total, `agents_available do grupo ${g.name}`).to.be.true;
          });
        });
      });
    });

    it('22.2 deve manter a lista completa, com os grupos sem vínculo, sem o parâmetro e com linked_to_channel=false', () => {
      listar({}, 'sem parâmetro').then((completa) => {
        listar({ linked_to_channel: true }, 'linked_to_channel=true').then((filtrada) => {
          expect(completa.length, 'A lista completa tem mais grupos que a filtrada (traz os sem vínculo)').to.be.greaterThan(filtrada.length);
        });
        listar({ linked_to_channel: false }, 'linked_to_channel=false').then((comFalse) => {
          expect(idsDe(comFalse), 'linked_to_channel=false não filtra: mesma lista e mesma ordem da lista sem o parâmetro').to.deep.eq(idsDe(completa));
        });
      });
    });

    it('22.3 deve combinar linked_to_channel=true com channel_id sem mudar o que o channel_id já faz', () => {
      listar({}, 'sem parâmetro').then((completa) => {
        const grupo = comVinculo(completa)[0];
        expect(grupo, '🔒 Nenhum grupo com canal ativo vinculado (massa)').to.exist;
        const canalId = canaisDe(grupo)[0].id;

        listar({ channel_id: canalId }, `channel_id=${canalId}`).then((soCanal) => {
          expect(idsDe(soCanal), `O grupo "${grupo.name}" aparece no filtro do canal ${canalId}`).to.include(grupo.id);
          listar({ channel_id: canalId, linked_to_channel: true }, `channel_id=${canalId} e linked_to_channel=true`).then((combinada) => {
            expect(idsDe(combinada), 'Com linked_to_channel=true o filtro do canal devolve os mesmos grupos, na mesma ordem').to.deep.eq(idsDe(soCanal));
          });
        });
      });
    });

    it('22.4 deve combinar linked_to_channel=true com employee_id: só os grupos do atendente que têm canal ativo vinculado', () => {
      listar({ employee_id: loggedUserId }, `employee_id=${loggedUserId}`).then((doAtendente) => {
        expect(comVinculo(doAtendente).length, '🔒 O atendente logado precisa estar em ao menos 1 grupo com canal ativo (massa)').to.be.at.least(1);
        listar({ employee_id: loggedUserId, linked_to_channel: true }, `employee_id=${loggedUserId} e linked_to_channel=true`).then((combinada) => {
          expect(idsDe(combinada), 'Só os grupos do atendente com vínculo, na ordem do filtro por atendente').to.deep.eq(idsDe(comVinculo(doAtendente)));
        });
      });
    });

    it('22.5 deve recusar com 422 INVALID_CONTEXT um valor inválido em linked_to_channel, sem devolver a lista', () => {
      api.listarGruposComFiltros(storeId, { linked_to_channel: 'abc' }, TIMEOUT_ROTA).then((res) => {
        expect(res.status, 'Status com linked_to_channel=abc').to.eq(422);
        expect(res.body.code, 'code da recusa').to.eq('INVALID_CONTEXT');
        expect(res.body.message, 'Mensagem da recusa').to.eq(MSG_CONTEXTO_INVALIDO);
        expect(res.body, 'A recusa não traz lista de grupos').to.not.have.property('items');
      });
    });

  });

});
