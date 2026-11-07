// cypress/e2e/0-D.backend-automacoes-fluxos-campanhas.cy.js
// Suíte de Backend e Integração na API Real, parte D: automações, fluxos e campanhas rodando no motor (disparo dos eventos, execução dos passos, fila do passo wait, webhook e gatilho Agendado).
// Separada do 0-A em 2026-11-06 (decisão do operador): o motor confere os eventos a cada 30 s e cada context espera o ciclo real (~11 a 14 min no total), então roda num job
// próprio da matrix do CI e não estoura o teto de 900 s da Lambda no 0-A. Contexts 1 a 5 = antigos 0-A ctx 33, 34, 35, 36 e 38 (de/para no HISTORICO.md). Executa via cy.request(), imune a mocks.

import api from '../services/backendApiService';

describe('0-D. Backend: Automações, Fluxos e Campanhas (API Real)', () => {

  let storeId = 1;

  before(() => {
    // Autentica diretamente no backend real e recupera o ID da loja vinculada
    api.autenticar().then(() => {
      api.obterUsuarioLogado().then((res) => {
        if (res.body && (res.body.store_code || res.body.store_id)) {
          storeId = res.body.store_code || res.body.store_id;
        }
      });
    });
  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 1: AUTOMAÇÕES — DISPARO PELO MOTOR (Issue backend#740)
  // ---------------------------------------------------------------------------
  context('1. Automações: Disparo pelo Motor no Cliente Novo e na Mudança de Status, uma Vez por Evento, com Escopo por Canal, Pausada e Ordem de Cadastro (Issue backend#740)', () => {

    // O motor (backend#740, PRs #827, #828 e #830 a #833) lê os eventos do banco a cada 30 s (fonte: backend#788), casa cada um com as automações ativas e reivindica a execução no log,
    // uma vez por evento (`UNIQUE (automação, CHAVE_EVENTO)`): a fonte relê um ciclo atrás de propósito, então esperar mais de 2 ciclos depois do 1º log prova a idempotência.
    // Medido na dev em 2026-11-06 (aba-b): o log do cliente novo chega em ~20 s, com `trigger_event`, `client_id`, `attendance_id` nulo e `steps_executed`; restrita a canal e pausada não disparam;
    // os filtros do `attendance_status_changed` seguem a decisão 4 da issue (o substatus que muda sem o status não dispara `status: X`; mudar o status pai limpa o substatus).
    // Massa própria ([R-ATEMPORAL]): automações com só um passo `condition` (não envia nada) e nome único, 1 cliente criado por rodada (desativado no after) e um atendimento Em andamento do
    // próprio operador descoberto na hora, com status e substatus restaurados no after; sem esse atendimento, os testes de status pulam. Nenhuma automação ativa da dev reage a cliente novo nem a status.
    // Sem teste (`ROADMAP.md` P1-64): `attendance_assigned` e `attendance_opened` (as automações [Teste] ativas da dev mandam WhatsApp real nesses eventos), os gatilhos de mensagem
    // (`new_message_received`, `first_inbound_message`, `keyword_match`: só com mensagem real recebida), recurso não contratado (conta única), `trigger_config` ilegível e a linha INFO do ciclo.
    const TIMEOUT_ROTA = { timeout: 90000 };
    const TOKEN = Date.now().toString(36);
    const nome = (sufixo) => `[Cypress] Backend 740 ${TOKEN} ${sufixo}`;
    const STATUS_DO_LOG = ['success', 'partial', 'failed', 'waiting'];
    const ESPERA_DO_MOTOR_MS = 180000;
    const DOIS_CICLOS_MS = 65000;
    // Passo que não age sobre nada: a condição de horário cabe em todo gatilho, inclusive no de cliente novo, que não tem atendimento.
    const passos = [{ step_type: 'condition', step_config: { subject: 'time_of_day', value: '00:00-23:59' }, branches: { yes: [], no: [] } }];
    const auts = {};
    let clienteId = null;
    let clienteCriadoEm = null;
    let clienteDepoisDaAtivacao = null;
    let atendimento = null;
    let substatusUsado = null;

    const semEspaco = (texto) => String(texto || '').replace(/\s+/g, '').toUpperCase();
    const criar = (chave, extra) => cy.then(() => api.criarAutomacao({ name: nome(chave), description: 'Massa temporária do contexto 1 de 0-D (backend#740)', all_channels: true, is_active: true, trigger_config: {}, steps: passos, ...extra }, TIMEOUT_ROTA)).then((res) => {
      expect(res.status, `Status do POST /automations "${chave}": ${JSON.stringify(res.body.issues || res.body.message || '')}`).to.eq(201);
      auts[chave] = res.body.automation.id;
    });
    // Logs da automação para a entidade do evento (o tenant é compartilhado: outros eventos da dev também disparam as automações da rodada).
    const logsDe = (chave, filtro) => cy.then(() => api.listarExecucoesAutomacao(auts[chave], 1, TIMEOUT_ROTA)).then((res) => {
      expect(res.status, `Status do GET /automations/${auts[chave]}/logs`).to.eq(200);
      return (res.body.data || []).filter(filtro);
    });
    const doCliente = (log) => log.client_id === clienteId && log.trigger_event === 'new_client_created';
    const doAtendimento = (log) => atendimento && log.attendance_id === atendimento.id && log.trigger_event === 'attendance_status_changed';
    const statusDoAtendimento = (id) => cy.then(() => api.obterDetalheAtendimento(storeId, id, TIMEOUT_ROTA)).then((res) => {
      const att = res.body.attendance || res.body;
      return { status: att.status, substatus: (att.custom_status && att.custom_status.id) ?? att.custom_status_id ?? null };
    });
    const mudar = (corpo) => cy.then(() => api.atualizarStatusAtendimento(storeId, atendimento.id, corpo, TIMEOUT_ROTA)).then((res) => {
      expect(res.status, `Status do PATCH ${JSON.stringify(corpo)} no atendimento ${atendimento.id}`).to.eq(200);
    });
    // Espera o motor processar os eventos da rodada: o 1º log do cliente e, com massa de atendimento, os 3 da automação sem filtro.
    const esperarMotor = (inicio = Date.now()) => logsDe('todos1', doCliente).then((doCli) => (atendimento ? logsDe('statusQualquer', doAtendimento) : cy.wrap([])).then((doAtt) => {
      const pronto = doCli.length > 0 && (!atendimento || doAtt.length >= 3);
      if (pronto || Date.now() - inicio > ESPERA_DO_MOTOR_MS) return;
      cy.wait(10000);
      esperarMotor(inicio);
    }));

    before(() => {
      // Arrange 1: automações do cliente novo (duas de todos os canais, na ordem de cadastro; uma restrita a canal; uma pausada)
      criar('todos1', { trigger_type: 'new_client_created' });
      criar('todos2', { trigger_type: 'new_client_created' });
      cy.then(() => api.listarCanais(storeId, TIMEOUT_ROTA)).then((res) => {
        const canal = (res.body.items || res.body.data || res.body)[0];
        expect(canal, '🔒 nenhum canal na loja (massa)').to.be.an('object');
        criar('canal', { trigger_type: 'new_client_created', all_channels: false, channel_ids: [canal.id] });
      });
      criar('pausada', { trigger_type: 'new_client_created', is_active: false });

      // Arrange 2: atendimento Em andamento do próprio operador e um substatus de Em andamento diferente do atual
      cy.then(() => api.obterUsuarioLogado(TIMEOUT_ROTA)).then((resMe) => api.listarAtendimentos(storeId, { status: 'in_progress', page: 1, per_page: 100 }, TIMEOUT_ROTA).then((resFila) => {
        const meu = (resFila.body.items || []).find((a) => semEspaco(a.attendant_name) === semEspaco(resMe.body.display_name));
        if (!meu) return;
        return statusDoAtendimento(meu.id).then((original) => api.obterStatusPersonalizados(storeId, TIMEOUT_ROTA).then((resSub) => {
          // Nunca um substatus gatilho de teste: a automação ativa com send_message do 0-D ctx 2 ou da 8.automacoes ctx 7 dispararia aqui e mandaria WhatsApp com a janela aberta
          const sub = (resSub.body.items || []).find((s) => s.parent_status === 1 && s.id !== original.substatus && !String(s.name || '').startsWith('[Cypress] Gatilho'));
          if (original.status !== 1 || !sub) return;
          atendimento = { id: meu.id, ...original };
          substatusUsado = sub.id;
        }));
      }));
      cy.then(() => {
        if (!atendimento) return;
        criar('statusQualquer', { trigger_type: 'attendance_status_changed' });
        criar('status1', { trigger_type: 'attendance_status_changed', trigger_config: { status: 1 } });
        criar('status2', { trigger_type: 'attendance_status_changed', trigger_config: { status: 2 } });
        criar('substatus', { trigger_type: 'attendance_status_changed', trigger_config: { custom_status_id: substatusUsado } });
        criar('ambos', { trigger_type: 'attendance_status_changed', trigger_config: { status: 1, custom_status_id: substatusUsado } });
      });

      // Act: o cliente novo e as 3 mudanças reais do atendimento (só o substatus; o status para 2, que limpa o substatus; de volta para 1)
      cy.then(() => {
        clienteCriadoEm = Date.now();
        return api.criarCliente(storeId, { name: `CYPRESS BACKEND 740 ${TOKEN}`, person_type: 1 }, TIMEOUT_ROTA);
      }).then((res) => {
        expect(res.status, 'Status do POST /clients (evento new_client_created)').to.eq(201);
        clienteId = res.body.id;
      });
      cy.then(() => {
        if (!atendimento) return;
        mudar({ custom_status_id: substatusUsado });
        mudar({ status: 2 });
        mudar({ status: 1 });
      });

      // Espera o motor e mais de dois ciclos depois, para a releitura da fonte ter acontecido
      esperarMotor();
      cy.wait(DOIS_CICLOS_MS);
    });

    after(() => {
      Object.values(auts).forEach((id) => api.excluirAutomacao(id, TIMEOUT_ROTA));
      if (clienteId) api.alterarAtivacaoCliente(storeId, clienteId, false, TIMEOUT_ROTA);
      if (clienteDepoisDaAtivacao) api.alterarAtivacaoCliente(storeId, clienteDepoisDaAtivacao, false, TIMEOUT_ROTA);
      if (atendimento) {
        statusDoAtendimento(atendimento.id).then((agora) => {
          if (agora.status !== atendimento.status) api.atualizarStatusAtendimento(storeId, atendimento.id, { status: atendimento.status }, TIMEOUT_ROTA);
        });
        statusDoAtendimento(atendimento.id).then((agora) => {
          if (agora.substatus !== atendimento.substatus) api.atualizarStatusAtendimento(storeId, atendimento.id, { custom_status_id: atendimento.substatus }, TIMEOUT_ROTA);
        });
      }
    });

    it('1.1 Deve disparar no cliente novo a automação ativa de todos os canais, com o log do evento (gatilho, cliente, sem atendimento) e run_count e last_run_at atualizados', () => {
      logsDe('todos1', doCliente).then((logs) => {
        expect(logs, `Log da automação de todos os canais para o cliente ${clienteId} (o motor confere a cada 30 s)`).to.have.length(1);
        const log = logs[0];
        expect(log.attendance_id, 'Cliente novo não tem atendimento').to.eq(null);
        expect(log.status, 'status do log é um dos 4 do CHECK de OC_AUTOMACAO_LOG').to.be.oneOf(STATUS_DO_LOG);
        expect(log.steps_executed, 'steps_executed do log').to.be.an('array');
        expect(new Date(log.created_at).getTime(), 'O log nasce depois do cadastro do cliente').to.be.at.least(clienteCriadoEm - 5000);
      });
      cy.then(() => api.listarAutomacoes(TIMEOUT_ROTA)).then((res) => {
        const automacao = (res.body.data || []).find((a) => a.id === auts.todos1);
        expect(automacao.run_count, 'run_count conta a reivindicação').to.be.at.least(1);
        expect(automacao.last_run_at, 'last_run_at da reivindicação').to.be.a('string');
        expect(new Date(automacao.last_run_at).getTime(), 'last_run_at depois do cadastro do cliente').to.be.at.least(clienteCriadoEm - 5000);
      });
    });

    it('1.2 Deve reivindicar uma vez só o mesmo evento, mesmo depois de a fonte relê-lo no ciclo seguinte (CHAVE_EVENTO única no log)', () => {
      // Arrange: o before esperou mais de dois ciclos de 30 s depois do 1º log; a fonte relê o ciclo anterior de propósito
      logsDe('todos1', doCliente).then((logs) => {
        expect(logs, 'Uma reivindicação por evento na 1ª automação').to.have.length(1);
      });
      logsDe('todos2', doCliente).then((logs) => {
        expect(logs, 'Uma reivindicação por evento na 2ª automação').to.have.length(1);
      });
    });

    it('1.3 não deve disparar no cliente novo, que não tem canal, a automação restrita a um canal', () => {
      // Contraprova: o evento aconteceu (a de todos os canais tem o log)
      logsDe('todos1', doCliente).then((logs) => expect(logs, 'Contraprova: o evento do cliente disparou a de todos os canais').to.have.length(1));
      logsDe('canal', doCliente).then((logs) => {
        expect(logs, 'Evento sem canal só dispara automação de todos os canais').to.have.length(0);
      });
    });

    it('1.4 não deve disparar a automação pausada, nem contar execução nela', () => {
      logsDe('todos1', doCliente).then((logs) => expect(logs, 'Contraprova: o evento do cliente disparou a ativa').to.have.length(1));
      logsDe('pausada', () => true).then((logs) => {
        expect(logs, 'Pausada não reivindica').to.have.length(0);
      });
      cy.then(() => api.listarAutomacoes(TIMEOUT_ROTA)).then((res) => {
        const automacao = (res.body.data || []).find((a) => a.id === auts.pausada);
        expect(automacao.run_count, 'run_count da pausada').to.eq(0);
        expect(automacao.last_run_at, 'last_run_at da pausada').to.eq(null);
      });
    });

    it('1.5 Deve executar, no mesmo evento, as automações na ordem de cadastro', () => {
      logsDe('todos1', doCliente).then((primeira) => logsDe('todos2', doCliente).then((segunda) => {
        expect(primeira, 'Log da 1ª cadastrada').to.have.length(1);
        expect(segunda, 'Log da 2ª cadastrada').to.have.length(1);
        expect(primeira[0].id, 'A 1ª cadastrada é reivindicada antes (id do log menor)').to.be.lessThan(segunda[0].id);
        expect(new Date(primeira[0].created_at).getTime(), 'e o created_at do log dela não vem depois').to.be.at.most(new Date(segunda[0].created_at).getTime());
      }));
    });

    it('1.6 Deve disparar a automação de mudança de status sem filtro em toda mudança real de status ou de substatus do atendimento', function () {
      if (!atendimento) {
        cy.log('⏭️ Sem massa: nenhum atendimento Em andamento do operador com substatus de Em andamento disponível');
        this.skip();
      }
      // As 3 mudanças do before: só o substatus, o status para 2 e de volta para 1
      logsDe('statusQualquer', doAtendimento).then((logs) => {
        expect(logs, 'Um log por mudança real (substatus, status 2, status 1)').to.have.length(3);
        logs.forEach((log) => expect(log.status, 'status do log').to.be.oneOf(STATUS_DO_LOG));
      });
    });

    it('1.7 Deve disparar a automação de status X só quando o status passa a ser X, e não quando só o substatus muda com o status já em X', function () {
      if (!atendimento) {
        cy.log('⏭️ Sem massa: nenhum atendimento Em andamento do operador com substatus de Em andamento disponível');
        this.skip();
      }
      logsDe('status2', doAtendimento).then((logs) => {
        expect(logs, 'status: 2 só na mudança para 2').to.have.length(1);
      });
      // O substatus mudou com o status já em 1: status: 1 só dispara na volta de 2 para 1
      logsDe('status1', doAtendimento).then((logs) => {
        expect(logs, 'status: 1 só na volta para 1, não na troca do substatus').to.have.length(1);
      });
    });

    it('1.8 Deve disparar a automação de substatus Y só quando o substatus passa a ser Y, e a de status e substatus só quando os dois batem depois da mudança', function () {
      if (!atendimento) {
        cy.log('⏭️ Sem massa: nenhum atendimento Em andamento do operador com substatus de Em andamento disponível');
        this.skip();
      }
      logsDe('substatus', doAtendimento).then((logs) => {
        expect(logs, 'custom_status_id: Y só quando passa a ser Y (o status 2 o limpa e a volta para 1 não o traz)').to.have.length(1);
      });
      logsDe('ambos', doAtendimento).then((logs) => {
        expect(logs, 'status: 1 + substatus Y só na troca para Y com o status em 1 (na volta para 1 o substatus já é nulo)').to.have.length(1);
      });
    });

    it('1.9 não deve disparar, no cliente cadastrado antes da ativação, a automação ativada depois, e deve disparar no cliente cadastrado em seguida (Issue backend#788)', () => {
      // backend#788, decisão 5: histórico nunca é reprocessado; ativar uma boas-vindas às 10:00 não cumprimenta quem escreveu às 9:30.
      // O cliente do before foi cadastrado mais de 2 ciclos de 30 s antes (o before espera o motor e mais dois ciclos): fora da releitura de um ciclo atrás.
      // Medido na dev em 2026-11-06 (aba-c): o cliente de antes não dispara a automação nova; o de depois dispara em ~25 s.
      const doDepois = (log) => log.client_id === clienteDepoisDaAtivacao && log.trigger_event === 'new_client_created';
      const esperarDepois = (inicio = Date.now()) => logsDe('tardia', doDepois).then((achados) => {
        if (achados.length || Date.now() - inicio > ESPERA_DO_MOTOR_MS) return;
        cy.wait(10000);
        esperarDepois(inicio);
      });

      // Arrange: a automação de cliente novo nasce agora, ativa
      criar('tardia', { trigger_type: 'new_client_created' });

      // Act: um cliente novo depois da ativação
      cy.then(() => api.criarCliente(storeId, { name: `CYPRESS BACKEND 788 ${TOKEN}`, person_type: 1 }, TIMEOUT_ROTA)).then((res) => {
        expect(res.status, 'Status do POST /clients depois da ativação').to.eq(201);
        clienteDepoisDaAtivacao = res.body.id;
      });
      esperarDepois();

      // Assert: dispara no de depois e não no de antes (o motor já processou o ciclo do cliente novo, que vem depois do antigo)
      logsDe('tardia', doDepois).then((logs) => {
        expect(logs, `Log da automação ativada para o cliente ${clienteDepoisDaAtivacao}, cadastrado depois`).to.have.length(1);
      });
      logsDe('tardia', doCliente).then((logs) => {
        expect(logs, `Nenhum log para o cliente ${clienteId}, cadastrado antes da ativação`).to.have.length(0);
      });
      // Contraprova: o cliente de antes gerou evento (a automação já ativa naquela hora disparou)
      logsDe('todos1', doCliente).then((logs) => expect(logs, 'O cliente de antes disparou a automação que já estava ativa').to.have.length(1));
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 2: AUTOMAÇÕES — EXECUÇÃO DOS PASSOS PELO MOTOR (Issue backend#741)
  // ---------------------------------------------------------------------------
  context('2. Automações: Execução dos Passos pelo Motor — Substatus, Condição por Status e por Horário, Atribuição, Encerramento, Janela de 24h Fechada e Passo que Falha sem Parar o Run (Issue backend#741)', () => {

    // O motor (backend#741, PRs #836 a #840) roda os passos logo depois de reivindicar o evento e grava no log `status` (`success`, `partial`, `failed`) e `steps_executed`
    // (`path`, `step_type`, `status`, `detail`, `at`); a `condition` grava o ramo escolhido no `detail` e os passos do ramo levam o `path` `N.yes.M`/`N.no.M`.
    // Medido na dev em 2026-11-06 (aba-c, diagnóstico descartável): o log chega em ~31 s; com a janela fechada o `send_message` falha com `service_window_closed`;
    // `agent_not_in_group`, `custom_status_mismatch` e `attendance_closed` saem como na issue; `close_attendance` só aceita 2, 3 ou 4 no save (`status_required`).
    // Massa própria ([R-ATEMPORAL]): um atendimento Finalizado (3) do próprio operador, no canal oficial (tipo 1, subtipo 1) e com a janela de 24h vencida, descoberto na hora,
    // reaberto (3 → 1, grant 562) para disparar e devolvido a 3 no fim, o que dispara a 2ª automação. O gatilho é um substatus exclusivo dos testes (`garantirStatusPersonalizado`):
    // um substatus real da farmácia faria a automação ativa da rodada disparar no atendimento de outra pessoa, e o `send_message` mandaria WhatsApp se a janela dela estivesse aberta.
    // Isolado da `8.automacoes` ctx 7, que usa a mesma receita e roda em paralelo no matrix do CI: gatilho próprio (sufixo "0-A") e só atendimento de id par
    // (a 8 fica com os ímpares). Achado de 2026-11-06 (aba-c): rodando juntos, um devolvia a 3 o atendimento do outro no meio do run.
    // As automações nascem com nome único e são apagadas no after. Nada é enviado ao WhatsApp: a mensagem só é tentada no atendimento da massa, com a janela fechada.
    // Sem teste (`ROADMAP.md` P1-65): o envio real de `send_message`/`send_template` (interpolação, `{{e:HEX}}`, `text_invalid`, `template_unavailable`), o `round_robin`,
    // `message_content`, `entity_missing` (sem rota que apague substatus) e o `failed` do atendimento que sumiu.
    // Anti-loop A2 (backend#788, decisão 7, #2.7): as escritas do motor rodam com a marca `PHARMACIE_AUTOMACAO` na transação e o trigger de `OC_ATENDIMENTO` não grava
    // evento; uma automação "observador" sem filtro registra só as 2 mudanças feitas pela API (status 1 e o substatus gatilho), nunca as 3 escritas do passo
    // `set_custom_status` do motor. Medido na dev em 2026-11-06 (aba-c): nenhum 3º log mais de 2 ciclos depois da escrita do motor.
    const TIMEOUT_ROTA = { timeout: 90000 };
    const TOKEN = Date.now().toString(36);
    const nome = (sufixo) => `[Cypress] Backend 741 ${TOKEN} ${sufixo}`;
    const ESPERA_DO_MOTOR_MS = 180000;
    const FUSO = 'America/Sao_Paulo';
    const SUBSTATUS_GATILHO = '[Cypress] Gatilho de automações 0-A';
    const semEspaco = (texto) => String(texto || '').replace(/\s+/g, '').toUpperCase();
    const auts = {};
    const logs = {};
    let massa = null;
    let depoisDosPassos = null;
    let depoisDoEncerrado = null;
    let mensagensDoToken = null;

    // Hora e dia da semana em São Paulo (UTC-3, sem horário de verão desde 2019) no momento do disparo
    const agoraEmSaoPaulo = () => {
      const local = new Date(Date.now() - 3 * 3600 * 1000);
      return { hora: local.getUTCHours(), dia: local.getUTCDay() };
    };
    const hh = (n) => String(n).padStart(2, '0');
    // Janela que contém a hora de São Paulo e não a de UTC (3 h à frente): um motor que lesse o horário em UTC cairia no ramo "não"
    const janelaDeAgora = () => {
      const { hora } = agoraEmSaoPaulo();
      return `${hh(hora)}:00-${hora >= 22 ? '24' : hh(hora + 2)}:00`;
    };

    const statusDoAtendimento = (id) => cy.then(() => api.obterDetalheAtendimento(storeId, id, TIMEOUT_ROTA)).then((res) => {
      const att = res.body.attendance || res.body;
      return {
        status: att.status,
        substatus: (att.custom_status && att.custom_status.id) ?? null,
        dono: (att.attendant && att.attendant.id) ?? null,
        grupo: (att.group && att.group.id) ?? null,
        canal: att.channel || {},
        janelaVenceEm: att.service_window ? att.service_window.expires_at : null,
      };
    });
    const mudar = (corpo) => cy.then(() => api.atualizarStatusAtendimento(storeId, massa.id, corpo, TIMEOUT_ROTA)).then((res) => {
      expect(res.status, `Status do PATCH ${JSON.stringify(corpo)} no atendimento ${massa.id}`).to.eq(200);
    });
    const criar = (chave, corpo) => cy.then(() => api.criarAutomacao({ name: nome(chave), description: 'Massa temporária do contexto 2 de 0-D (backend#741)', all_channels: true, channel_ids: [], is_active: true, trigger_type: 'attendance_status_changed', ...corpo }, TIMEOUT_ROTA)).then((res) => {
      expect(res.status, `Status do POST /automations "${chave}": ${JSON.stringify(res.body.issues || res.body.message || '')}`).to.eq(201);
      auts[chave] = res.body.automation.id;
    });
    // Espera o log da automação para o atendimento da massa (o motor confere os eventos a cada 30 s)
    const esperarLog = (chave, inicio = Date.now()) => cy.then(() => api.listarExecucoesAutomacao(auts[chave], 1, TIMEOUT_ROTA)).then((res) => {
      const doAtendimento = (res.body.data || []).filter((log) => log.attendance_id === massa.id);
      if (doAtendimento.length || Date.now() - inicio > ESPERA_DO_MOTOR_MS) {
        logs[chave] = doAtendimento;
        return;
      }
      cy.wait(10000);
      esperarLog(chave, inicio);
    });
    const pularSemMassa = (ctx) => {
      if (!massa) {
        cy.log('⏭️ Sem massa: nenhum atendimento Finalizado do operador no canal oficial com a janela de 24h vencida, ou faltam substatus de Em andamento e de outro status');
        ctx.skip();
      }
    };
    const passo = (chave, path) => (logs[chave][0].steps_executed || []).find((p) => p.path === path);

    before(() => {
      // Arrange 1: atendimento Finalizado do operador, no canal oficial, com a janela vencida e sem substatus
      cy.then(() => api.obterUsuarioLogado(TIMEOUT_ROTA)).then((resMe) => api.listarAtendimentos(storeId, { status: 'finished', page: 1, per_page: 100 }, TIMEOUT_ROTA).then((resFila) => {
        const meus = (resFila.body.items || []).filter((a) => semEspaco(a.attendant_name) === semEspaco(resMe.body.display_name)).slice(0, 15);
        const procurar = (i) => {
          if (i >= meus.length) return;
          return statusDoAtendimento(meus[i].id).then((att) => {
            const janelaVencida = att.janelaVenceEm && new Date(att.janelaVenceEm).getTime() < Date.now();
            if (meus[i].id % 2 === 0 && att.status === 3 && att.substatus === null && att.dono && att.grupo && att.canal.type === 1 && att.canal.subtype === 1 && janelaVencida) {
              massa = { id: meus[i].id, ...att };
              return;
            }
            return procurar(i + 1);
          });
        };
        return procurar(0);
      }));

      // Arrange 2: o substatus gatilho exclusivo dos testes (criado uma vez por base), um substatus de Em andamento como alvo, um de outro status
      // e um funcionário fora do grupo do atendimento
      cy.then(() => {
        if (!massa) return;
        return api.garantirStatusPersonalizado(SUBSTATUS_GATILHO, 1, TIMEOUT_ROTA).then((gatilho) => api.obterStatusPersonalizados(storeId, TIMEOUT_ROTA).then((resSub) => {
          const itens = resSub.body.items || [];
          // O alvo nunca é um gatilho de teste: o passo 1 dispararia a automação da `8.automacoes` ctx 7 se ela estivesse rodando
          const alvo = itens.find((s) => s.parent_status === 1 && !String(s.name || '').startsWith('[Cypress] Gatilho'));
          const deOutro = itens.find((s) => s.parent_status !== 1);
          if (!alvo || !deOutro) {
            massa = null;
            return;
          }
          massa.subGatilho = gatilho.id;
          massa.subAlvo = alvo.id;
          massa.subOutroStatus = deOutro.id;
        }));
      });
      cy.then(() => {
        if (!massa) return;
        return api.get(`/attendance-groups/${massa.grupo}/agents`, {}, TIMEOUT_ROTA).then((resGrupo) => api.listarFuncionarios(storeId, { per_page: 100 }, TIMEOUT_ROTA).then((resFunc) => {
          const membros = (resGrupo.body.agents || []).map((a) => a.agent_id);
          expect(membros, `O operador é membro do grupo ${massa.grupo} do atendimento`).to.include(massa.dono);
          const fora = (resFunc.body.items || []).find((f) => f.id > 0 && !membros.includes(f.id));
          if (!fora) {
            massa = null;
            return;
          }
          massa.foraDoGrupo = fora.id;
        }));
      });

      // Arrange 3: as duas automações — os passos (no substatus gatilho) e o atendimento encerrado (no status 3, que é a restauração)
      cy.then(() => {
        if (!massa) return;
        const { dia } = agoraEmSaoPaulo();
        const janela = janelaDeAgora();
        const ramo = (sub) => [{ step_type: 'set_custom_status', step_config: { custom_status_id: sub } }];
        criar('passos', {
          trigger_config: { custom_status_id: massa.subGatilho },
          steps: [
            { step_type: 'send_message', step_config: { text: `Teste automatizado ${TOKEN} {{attendance.id}}` } },
            { step_type: 'set_custom_status', step_config: { custom_status_id: massa.subAlvo } },
            { step_type: 'condition', step_config: { subject: 'attendance_status', value: `custom:${massa.subAlvo}` }, branches: { yes: ramo(massa.subAlvo), no: ramo(massa.subAlvo) } },
            { step_type: 'condition', step_config: { subject: 'time_of_day', value: janela, days: [dia], timezone: FUSO }, branches: { yes: ramo(massa.subAlvo), no: ramo(massa.subAlvo) } },
            { step_type: 'condition', step_config: { subject: 'time_of_day', value: janela, days: [dia] }, branches: { yes: ramo(massa.subAlvo), no: ramo(massa.subAlvo) } },
            { step_type: 'condition', step_config: { subject: 'time_of_day', value: janela, days: [(dia + 1) % 7], timezone: FUSO }, branches: { yes: ramo(massa.subAlvo), no: ramo(massa.subAlvo) } },
            { step_type: 'assign_attendance', step_config: { mode: 'specific', agent_id: massa.foraDoGrupo, group_id: massa.grupo } },
            { step_type: 'set_custom_status', step_config: { custom_status_id: massa.subOutroStatus } },
            { step_type: 'set_custom_status', step_config: { custom_status_id: null } },
          ],
        });
        criar('encerrado', {
          trigger_config: { status: 3 },
          steps: [
            { step_type: 'assign_attendance', step_config: { mode: 'specific', agent_id: massa.dono, group_id: massa.grupo } },
            { step_type: 'close_attendance', step_config: { status: 3 } },
          ],
        });
        // Observador do anti-loop (#2.7): qualquer mudança de status ou substatus, com um passo que não age sobre nada
        criar('observador', {
          trigger_config: {},
          steps: [{ step_type: 'condition', step_config: { subject: 'time_of_day', value: '00:00-23:59' }, branches: { yes: [], no: [] } }],
        });
      });

      // Act 1: reabre (3 → 1) e põe o substatus gatilho; o motor roda os passos
      cy.then(() => {
        if (!massa) return;
        mudar({ status: 1 });
        mudar({ custom_status_id: massa.subGatilho });
        esperarLog('passos');
        statusDoAtendimento(massa.id).then((att) => { depoisDosPassos = att; });
        cy.then(() => api.listarMensagensAtendimento(storeId, massa.id, TIMEOUT_ROTA)).then((res) => {
          expect(res.status, 'Status do GET /attendances/:id/messages').to.eq(200);
          const lidas = res.body.data || [];
          expect(lidas, 'Contraprova: a leitura das mensagens do atendimento trouxe a conversa').to.not.be.empty;
          mensagensDoToken = lidas.filter((m) => String(m.content || '').includes(TOKEN));
        });
        // Mais de 2 ciclos depois das escritas do motor, antes da devolução a 3: o que o observador viu no atendimento
        cy.wait(65000);
        cy.then(() => api.listarExecucoesAutomacao(auts.observador, 1, TIMEOUT_ROTA)).then((res) => {
          logs.observador = (res.body.data || []).filter((log) => log.attendance_id === massa.id);
        });
      });

      // Act 2: devolve a 3 (o status de antes), o que dispara a automação do atendimento encerrado
      cy.then(() => {
        if (!massa) return;
        mudar({ status: 3 });
        esperarLog('encerrado');
        statusDoAtendimento(massa.id).then((att) => { depoisDoEncerrado = att; });
      });
    });

    after(() => {
      Object.values(auts).forEach((id) => api.excluirAutomacao(id, TIMEOUT_ROTA));
      if (massa) {
        statusDoAtendimento(massa.id).then((agora) => {
          if (agora.status !== 3) api.atualizarStatusAtendimento(storeId, massa.id, { status: 3 }, TIMEOUT_ROTA);
        });
      }
    });

    it('2.1 Deve rodar todos os passos depois de um que falha e fechar o log do evento como partial, com path, tipo, status, detalhe e horário de cada passo', function () {
      pularSemMassa(this);
      expect(logs.passos, `Um log da automação para o atendimento ${massa && massa.id} (o motor confere a cada 30 s)`).to.have.length(1);
      const log = logs.passos[0];
      expect(log.trigger_event, 'Gatilho do log').to.eq('attendance_status_changed');
      expect(log.status, 'Passo que falha não interrompe o run: o log fica partial').to.eq('partial');
      expect(log.error_message, 'error_message só no failed').to.eq(null);
      const caminhos = log.steps_executed.map((p) => p.path);
      expect(caminhos, 'Todos os passos, os dos ramos escolhidos logo depois da condição, na ordem').to.deep.eq(['0', '1', '2', '2.yes.0', '3', '3.yes.0', '4', '4.yes.0', '5', '5.no.0', '6', '7', '8']);
      expect(log.steps_executed[0].status, 'O 1º passo falhou').to.eq('failed');
      expect(log.steps_executed[log.steps_executed.length - 1].status, 'e o último, depois de três falhas, rodou com sucesso').to.eq('success');
      log.steps_executed.forEach((p) => {
        expect(p.at, `at do passo ${p.path} em Instant UTC`).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
        expect(p.status, `status do passo ${p.path}`).to.be.oneOf(['success', 'failed']);
      });
    });

    it('2.2 Deve falhar o send_message com a janela de 24h fechada (service_window_closed) sem gravar a mensagem no atendimento', function () {
      pularSemMassa(this);
      expect(new Date(massa.janelaVenceEm).getTime(), 'Massa: a janela do atendimento já venceu').to.be.lessThan(Date.now());
      const envio = passo('passos', '0');
      expect(envio.step_type, 'Passo 0').to.eq('send_message');
      expect(envio.status, 'send_message com a janela fechada').to.eq('failed');
      expect(envio.detail, 'detail do send_message').to.eq('service_window_closed');
      expect(mensagensDoToken, 'Nenhuma mensagem com o texto do passo foi gravada no atendimento').to.have.length(0);
    });

    it('2.3 Deve aplicar o substatus, recusar o de outro status (custom_status_mismatch) sem mover o status e limpar com custom_status_id null', function () {
      pularSemMassa(this);
      expect(passo('passos', '1'), 'set_custom_status para o substatus de Em andamento').to.include({ step_type: 'set_custom_status', status: 'success', detail: null });
      // A condição seguinte lê o atendimento depois do passo 1: o ramo "sim" prova que o substatus foi aplicado
      expect(passo('passos', '2'), 'condition custom:<substatus aplicado>').to.include({ step_type: 'condition', status: 'success', detail: 'yes' });
      expect(passo('passos', '7'), 'substatus cujo pai não é o status do atendimento').to.include({ step_type: 'set_custom_status', status: 'failed', detail: 'custom_status_mismatch' });
      expect(passo('passos', '8'), 'custom_status_id null limpa').to.include({ step_type: 'set_custom_status', status: 'success', detail: null });
      expect(depoisDosPassos.status, 'O status não se move com o substatus recusado').to.eq(1);
      expect(depoisDosPassos.substatus, 'Substatus limpo pelo último passo').to.eq(null);
    });

    it('2.4 Deve escolher o ramo da condição de horário pelo fuso de São Paulo, informado ou padrão, e pelo dia da semana', function () {
      pularSemMassa(this);
      // A janela contém a hora de São Paulo e não a de UTC: um motor em UTC escolheria "no"
      expect(passo('passos', '3'), 'time_of_day com timezone America/Sao_Paulo e o dia de hoje').to.include({ step_type: 'condition', status: 'success', detail: 'yes' });
      expect(passo('passos', '4'), 'time_of_day sem timezone usa America/Sao_Paulo, não UTC').to.include({ step_type: 'condition', status: 'success', detail: 'yes' });
      expect(passo('passos', '5'), 'time_of_day com a mesma janela em outro dia da semana').to.include({ step_type: 'condition', status: 'success', detail: 'no' });
    });

    it('2.5 Deve falhar a atribuição a um atendente fora do grupo (agent_not_in_group) sem trocar o dono nem o grupo do atendimento', function () {
      pularSemMassa(this);
      expect(passo('passos', '6'), 'assign_attendance specific com atendente que não é membro do grupo').to.include({ step_type: 'assign_attendance', status: 'failed', detail: 'agent_not_in_group' });
      expect(depoisDosPassos.dono, 'Dono do atendimento inalterado').to.eq(massa.dono);
      expect(depoisDosPassos.grupo, 'Grupo do atendimento inalterado').to.eq(massa.grupo);
    });

    it('2.6 Deve falhar a atribuição no atendimento encerrado (attendance_closed) e contar como sucesso, sem mudar nada, o encerramento para o status que ele já tem', function () {
      pularSemMassa(this);
      expect(logs.encerrado, 'Um log da automação do status 3 para o atendimento (a devolução a 3 disparou)').to.have.length(1);
      const log = logs.encerrado[0];
      expect(log.status, 'Um passo falhou e o outro rodou').to.eq('partial');
      expect(passo('encerrado', '0'), 'assign_attendance com o atendimento Finalizado').to.include({ step_type: 'assign_attendance', status: 'failed', detail: 'attendance_closed' });
      expect(passo('encerrado', '1'), 'close_attendance para o status que o atendimento já tem').to.include({ step_type: 'close_attendance', status: 'success', detail: null });
      expect(depoisDoEncerrado.status, 'Atendimento continua Finalizado').to.eq(3);
      expect(depoisDoEncerrado.dono, 'Dono inalterado').to.eq(massa.dono);
      expect(depoisDoEncerrado.grupo, 'Grupo inalterado').to.eq(massa.grupo);
    });

    it('2.7 não deve gerar evento de mudança de status a escrita do próprio motor (anti-loop), disparando a automação sem filtro só nas mudanças feitas pela API (Issue backend#788)', function () {
      pularSemMassa(this);
      // Contraprova: o motor escreveu no atendimento (substatus aplicado e depois limpo pelos passos da automação "passos")
      expect(passo('passos', '1'), 'O motor aplicou o substatus (escrita do motor)').to.include({ step_type: 'set_custom_status', status: 'success' });
      expect(passo('passos', '8'), 'e o limpou (outra escrita do motor)').to.include({ step_type: 'set_custom_status', status: 'success' });
      // Assert: só os 2 eventos da API (3 → 1 e o substatus gatilho); as escritas do motor não geram evento
      expect(logs.observador, 'Logs do observador no atendimento até 2 ciclos depois das escritas do motor').to.have.length(2);
      logs.observador.forEach((log) => expect(log.trigger_event, 'gatilho do log do observador').to.eq('attendance_status_changed'));
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 3: AUTOMAÇÕES — FILA DO PASSO WAIT (Issue backend#742)
  // ---------------------------------------------------------------------------
  context('3. Automações: Fila do Passo wait — Suspende e Retoma na Mesma Execução, wait Dentro de Ramo, Pausar e Salvar Cancelam e um Pendente por Cliente (Issue backend#742)', () => {

    // O `wait` (backend#742, PRs #851, #852 e #853) não segura thread: a execução para no passo, o log fica `waiting` com os passos até ali e um item vai para `OC_AUTOMACAO_AGENDA`;
    // o ciclo de 30 s do despacho retoma o que venceu na MESMA linha do log, que vira `success` com os passos seguintes acrescentados. `wait` dentro de ramo suspende a execução inteira:
    // na retomada termina o ramo e só então segue na raiz. Pausar ou salvar os passos cancela o pendente e leva o log a `partial` com o motivo em `error_message`, sem tocar nos passos.
    // Um pendente por (automação, cliente): o 2º disparo durante a espera vira `success` com o `wait` `skipped`/`already_waiting`, sem estacionar outro.
    // Medido na dev em 2026-11-06 (aba-b): retomada ~61 s depois do `wait` de 1 minuto; o 2º disparo no mesmo atendimento já sai `already_waiting`. O tenant é compartilhado (outros
    // atendimentos também disparam a automação de status), então os logs são filtrados pela entidade do evento.
    // Massa própria ([R-ATEMPORAL]): automações só com `wait` de 1 minuto e `condition` de horário (não enviam nada), 1 cliente criado por rodada (desativado no after) e o atendimento
    // Em andamento do próprio operador descoberto na hora, com o substatus restaurado no after; sem esse atendimento, o teste do 2º disparo pula.
    // Sem teste (`ROADMAP.md` P1-66): expirado por atraso de 1 h e preso em `running` por 15 min (worker parado), o claim de dois workers (integração do backend), `ATTENDANCE_NOT_FOUND`
    // na retomada (atendimento sem DELETE), o texto da mensagem relido na retomada (gatilho de mensagem, P1-58) e a exclusão da automação (os logs somem com ela).
    const TIMEOUT_ROTA = { timeout: 90000 };
    const TOKEN = Date.now().toString(36);
    const nome = (sufixo) => `[Cypress] Backend 742 ${TOKEN} ${sufixo}`;
    const ESPERA_DO_MOTOR_MS = 180000;
    const UM_MINUTO_MS = 60000;
    const PRECISAO_MS = 5000;
    const espera = { step_type: 'wait', step_config: { amount: 1, unit: 'minutes' } };
    // As que são canceladas e a do 2º disparo esperam 2 minutos: folga para agir durante a espera, e ainda retomariam dentro da rodada se o cancelamento falhasse
    const esperaLonga = { step_type: 'wait', step_config: { amount: 2, unit: 'minutes' } };
    const DOIS_MINUTOS_E_UM_CICLO_MS = 120000 + 35000;
    // Condição que cabe em todo gatilho e sempre cai no `yes`
    const condicao = (yes = []) => ({ step_type: 'condition', step_config: { subject: 'time_of_day', value: '00:00-23:59' }, branches: { yes, no: [] } });
    const auts = {};
    const aguardando = {};
    let todosDup = [];
    let clienteId = null;
    let atendimento = null;

    const semEspaco = (texto) => String(texto || '').replace(/\s+/g, '').toUpperCase();
    const criar = (chave, extra) => cy.then(() => api.criarAutomacao({ name: nome(chave), description: 'Massa temporária do contexto 3 de 0-D (backend#742)', all_channels: true, is_active: true, trigger_type: 'new_client_created', trigger_config: {}, ...extra }, TIMEOUT_ROTA)).then((res) => {
      expect(res.status, `Status do POST /automations "${chave}": ${JSON.stringify(res.body.issues || res.body.message || '')}`).to.eq(201);
      auts[chave] = res.body.automation.id;
    });
    const logsDe = (chave, filtro) => cy.then(() => api.listarExecucoesAutomacao(auts[chave], 1, TIMEOUT_ROTA)).then((res) => {
      expect(res.status, `Status do GET /automations/${auts[chave]}/logs`).to.eq(200);
      return (res.body.data || []).filter(filtro);
    });
    const doCliente = (log) => log.client_id === clienteId && log.trigger_event === 'new_client_created';
    const doAtendimento = (log) => atendimento && log.attendance_id === atendimento.id && log.trigger_event === 'attendance_status_changed';
    const caminhos = (log) => (log.steps_executed || []).map((p) => p.path);
    const instante = (log, path) => new Date((log.steps_executed || []).find((p) => p.path === path).at).getTime();
    const mudarSubstatus = (id) => cy.then(() => api.atualizarStatusAtendimento(storeId, atendimento.id, { custom_status_id: id }, TIMEOUT_ROTA)).then((res) => {
      expect(res.status, `Status do PATCH custom_status_id ${id} no atendimento ${atendimento.id}`).to.eq(200);
    });
    // Espera até cada automação do grupo ter o 1º log `waiting` da sua entidade e guarda essa foto (antes de qualquer retomada ou cancelamento)
    const esperarAguardando = (chaves, inicio = Date.now()) => cy.wrap(chaves).each((chave) => logsDe(chave, chave === 'dup' ? doAtendimento : doCliente).then((logs) => {
      const log = logs.find((l) => l.status === 'waiting');
      if (log && !aguardando[chave]) aguardando[chave] = log;
    })).then(() => {
      if (chaves.every((c) => aguardando[c]) || Date.now() - inicio > ESPERA_DO_MOTOR_MS) return;
      cy.wait(5000);
      esperarAguardando(chaves, inicio);
    });
    // Espera a retomada da raiz e mais um ciclo de 30 s, para o cancelado ter tido a chance de retomar se o cancelamento falhasse
    const esperarRetomada = (inicio = Date.now()) => logsDe('raiz', doCliente).then((logs) => {
      if ((logs[0] && logs[0].status !== 'waiting') || Date.now() - inicio > ESPERA_DO_MOTOR_MS) return;
      cy.wait(10000);
      esperarRetomada(inicio);
    });

    before(() => {
      // Arrange 1: automações do cliente novo, todas com wait de 1 minuto
      criar('raiz', { steps: [espera, condicao()] });
      criar('ramo', { steps: [condicao([espera, condicao()]), condicao()] });
      criar('pausar', { steps: [esperaLonga, condicao()] });
      criar('salvar', { steps: [esperaLonga, condicao()] });

      // Arrange 2: atendimento Em andamento do próprio operador e dois substatus de Em andamento diferentes do atual
      cy.then(() => api.obterUsuarioLogado(TIMEOUT_ROTA)).then((resMe) => api.listarAtendimentos(storeId, { status: 'in_progress', page: 1, per_page: 100 }, TIMEOUT_ROTA).then((resFila) => {
        const meu = (resFila.body.items || []).find((a) => semEspaco(a.attendant_name) === semEspaco(resMe.body.display_name));
        if (!meu) return;
        return api.obterDetalheAtendimento(storeId, meu.id, TIMEOUT_ROTA).then((resDet) => {
          const att = resDet.body.attendance || resDet.body;
          const atual = (att.custom_status && att.custom_status.id) ?? att.custom_status_id ?? null;
          return api.obterStatusPersonalizados(storeId, TIMEOUT_ROTA).then((resSub) => {
            // Nunca um substatus gatilho de teste: a automação ativa com send_message do 0-D ctx 2 ou da 8.automacoes ctx 7 dispararia aqui e mandaria WhatsApp com a janela aberta
            const outros = (resSub.body.items || []).filter((s) => s.parent_status === 1 && s.id !== atual && !String(s.name || '').startsWith('[Cypress] Gatilho'));
            if (att.status !== 1 || outros.length < 2) return;
            atendimento = { id: meu.id, substatus: atual, primeiro: outros[0].id, segundo: outros[1].id };
          });
        });
      }));
      cy.then(() => {
        if (atendimento) criar('dup', { trigger_type: 'attendance_status_changed', steps: [esperaLonga, condicao()] });
      });

      // Act 1: o cliente novo e o 1º disparo do atendimento
      cy.then(() => api.criarCliente(storeId, { name: `CYPRESS BACKEND 742 ${TOKEN}`, person_type: 1 }, TIMEOUT_ROTA)).then((res) => {
        expect(res.status, 'Status do POST /clients (evento new_client_created)').to.eq(201);
        clienteId = res.body.id;
      });
      cy.then(() => { if (atendimento) mudarSubstatus(atendimento.primeiro); });

      // Act 2: assim que estacionam, pausar uma e salvar os passos da outra
      esperarAguardando(['pausar', 'salvar', 'raiz', 'ramo']);
      cy.then(() => api.atualizarAutomacao(auts.pausar, { is_active: false }, TIMEOUT_ROTA)).then((res) => expect(res.status, 'PATCH { is_active: false } durante a espera').to.eq(200));
      cy.then(() => api.obterAutomacao(auts.salvar, TIMEOUT_ROTA)).then((res) => {
        const gravada = res.body.automation;
        api.atualizarAutomacao(auts.salvar, { steps: [esperaLonga, condicao()], updated_at: gravada.updated_at }, TIMEOUT_ROTA).then((r) => expect(r.status, 'PATCH dos passos durante a espera').to.eq(200));
      });

      // Act 3: com o 1º disparo do atendimento esperando, o 2º disparo
      cy.then(() => {
        if (!atendimento) return;
        esperarAguardando(['dup']);
        mudarSubstatus(atendimento.segundo);
      });

      // Espera a retomada da raiz e, depois, o prazo das esperas de 2 minutos e mais um ciclo
      esperarRetomada();
      cy.then(() => {
        const nascimentos = ['pausar', 'salvar', 'dup'].filter((c) => aguardando[c]).map((c) => new Date(aguardando[c].created_at).getTime());
        const restante = nascimentos.length ? Math.max(...nascimentos) + DOIS_MINUTOS_E_UM_CICLO_MS - Date.now() : 0;
        if (restante > 0) cy.wait(restante);
      });
      cy.then(() => { if (atendimento) logsDe('dup', () => true).then((logs) => { todosDup = logs.map(({ id, status, attendance_id, client_id, steps_executed }) => ({ id, status, attendance_id, client_id, steps_executed })); }); });
    });

    after(() => {
      Object.values(auts).forEach((id) => api.excluirAutomacao(id, TIMEOUT_ROTA));
      if (clienteId) api.alterarAtivacaoCliente(storeId, clienteId, false, TIMEOUT_ROTA);
      if (atendimento) api.atualizarStatusAtendimento(storeId, atendimento.id, { custom_status_id: atendimento.substatus }, TIMEOUT_ROTA);
    });

    it('3.1 Deve suspender a execução no wait com o log waiting e retomá-la depois do prazo na mesma linha do log, como success, com o passo seguinte acrescentado', () => {
      expect(aguardando.raiz, 'Log waiting da raiz (o motor confere a cada 30 s)').to.be.an('object');
      expect(caminhos(aguardando.raiz), 'Na espera, só o wait executado').to.deep.eq(['0']);
      expect(aguardando.raiz.steps_executed[0].step_type, 'O passo 0 é o wait').to.eq('wait');
      logsDe('raiz', doCliente).then((logs) => {
        expect(logs, 'Uma execução só para o cliente: a retomada não abre outra').to.have.length(1);
        const log = logs[0];
        expect(log.id, 'A retomada acrescenta à linha original').to.eq(aguardando.raiz.id);
        expect(log.status, 'Retomada até o fim').to.eq('success');
        expect(caminhos(log), 'O wait e o passo seguinte, sem repetir o wait').to.deep.eq(['0', '1']);
        expect(instante(log, '1') - instante(log, '0'), 'O passo seguinte roda depois do minuto da espera').to.be.at.least(UM_MINUTO_MS - PRECISAO_MS);
      });
    });

    it('3.2 Deve suspender a execução inteira no wait dentro de um ramo e, na retomada, terminar o ramo antes de seguir para a raiz', () => {
      expect(aguardando.ramo, 'Log waiting da automação com o wait no ramo').to.be.an('object');
      expect(caminhos(aguardando.ramo), 'Na espera, a raiz depois da condição ainda não rodou').to.deep.eq(['0', '0.yes.0']);
      logsDe('ramo', doCliente).then((logs) => {
        expect(logs, 'Uma execução só para o cliente').to.have.length(1);
        const log = logs[0];
        expect(log.id, 'A retomada acrescenta à linha original').to.eq(aguardando.ramo.id);
        expect(log.status, 'Retomada até o fim').to.eq('success');
        expect(caminhos(log), 'Termina o ramo e só então a raiz').to.deep.eq(['0', '0.yes.0', '0.yes.1', '1']);
        expect(instante(log, '1') - instante(log, '0.yes.0'), 'A raiz roda depois da espera, não na hora').to.be.at.least(UM_MINUTO_MS - PRECISAO_MS);
      });
    });

    it('3.3 Deve cancelar a espera ao pausar a automação e ao salvar os passos, levando o log a partial com o motivo, sem retomar nem tocar nos passos', () => {
      // Contraprova: a raiz, com o mesmo minuto de espera, já retomou
      logsDe('raiz', doCliente).then((logs) => expect(logs[0].status, 'Contraprova: a espera de 1 minuto já venceu').to.eq('success'));
      ['pausar', 'salvar'].forEach((chave) => {
        expect(aguardando[chave], `Log waiting da automação "${chave}" antes do cancelamento`).to.be.an('object');
        logsDe(chave, doCliente).then((logs) => {
          expect(logs, `Uma execução só em "${chave}"`).to.have.length(1);
          const log = logs[0];
          expect(log.id, `A linha de "${chave}" é a mesma`).to.eq(aguardando[chave].id);
          expect(log.status, `"${chave}" cancelada vira partial`).to.eq('partial');
          expect(log.error_message, `Motivo do cancelamento em "${chave}"`).to.be.a('string').and.not.to.be.empty;
          expect(caminhos(log), `O cancelamento não toca nos passos de "${chave}" nem retoma`).to.deep.eq(['0']);
        });
      });
    });

    it('3.4 Deve descartar o segundo disparo para o mesmo cliente durante a espera (skipped, already_waiting) sem estacionar outro wait', function () {
      if (!atendimento) {
        cy.log('⏭️ Sem massa: nenhum atendimento Em andamento do operador com dois substatus de Em andamento disponíveis');
        this.skip();
      }
      expect(aguardando.dup, `Log waiting do 1º disparo no atendimento ${atendimento.id}. Logs da automação: ${JSON.stringify(todosDup)}`).to.be.an('object');
      logsDe('dup', doAtendimento).then((logs) => {
        const ordenados = [...logs].sort((a, b) => a.id - b.id);
        expect(ordenados.length, 'Os dois disparos do atendimento têm log (o QTD_EXECUCAO conta os dois)').to.be.at.least(2);
        const [primeiro, segundo] = ordenados;
        expect(primeiro.id, 'O 1º disparo é o que ficou esperando').to.eq(aguardando.dup.id);
        expect(caminhos(primeiro), 'O 1º retoma até o fim').to.deep.eq(['0', '1']);
        expect(segundo.status, 'O descarte é success').to.eq('success');
        expect(segundo.steps_executed, 'Só o wait, pulado por já haver um pendente').to.have.length(1);
        expect(segundo.steps_executed[0], 'Entrada do descarte').to.include({ path: '0', step_type: 'wait', status: 'skipped', detail: 'already_waiting' });
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 4: AUTOMAÇÕES — PASSO send_webhook SEGURO (Issue backend#745)
  // ---------------------------------------------------------------------------
  context('4. Automações: Passo send_webhook — Credencial e Dado de Paciente Recusados no Save, URL Interna ou Dinâmica Recusada na Ativação e Destino Interno Bloqueado pelo DNS na Execução (Issue backend#745)', () => {

    // O `send_webhook` (backend#745, PRs #855 e #856) sai da rede da farmácia. O save recusa, em qualquer gravação (rascunho incluído), credencial na URL e placeholder
    // fora de `{{client.id}}`, `{{attendance.id}}` e `{{store.id}}`; a ativação recusa URL inválida ou não https, host interno literal ou nome local, host/porta dinâmicos
    // e corpo que não é JSON. Na execução o motor resolve o DNS antes de conectar e recusa qualquer endereço interno (`webhook_blocked`). Medido na dev em 2026-11-06 (aba-c).
    // Massa própria ([R-ATEMPORAL]): automações com token único, apagadas no after; a execução usa o gatilho cliente novo e um cliente criado na rodada (inativado no fim).
    // Destinos da execução: nomes públicos que resolvem para IP interno (localtest.me → 127.0.0.1, *.nip.io), um `.invalid` e um caminho inexistente da própria API da dev:
    // nenhum dado sai para terceiros. Depende do DNS público responder; sem ele o passo vira `webhook_unreachable` e o teste falha (decisão do operador, 2026-11-06).
    // Sem teste (`ROADMAP.md` P1-69): 2xx, envelope e interpolação do corpo, Content-Type, timeout, 3xx não seguido (precisam de um receptor nosso), o pulo do host morto
    // no mesmo despacho (não aparece no log) e o duplicar de uma origem gravada antes da PR #870 (não há mais como criar uma).
    // A chave `headers` gravada no step_config foi devolvida ao dev e corrigida na PR #870 (2026-11-06): coberta no #4.4.
    const TIMEOUT_ROTA = { timeout: 90000 };
    const TOKEN = Date.now().toString(36);
    const nome = (sufixo) => `[Cypress] Backend 745 ${TOKEN} ${sufixo}`;
    const ESPERA_DO_MOTOR_MS = 150000;
    const API = api.apiUrl;
    const criadas = [];
    let clienteId = null;
    let logExecucao = null;

    const webhook = (url, body_template) => ({ step_type: 'send_webhook', step_config: body_template === undefined ? { url } : { url, body_template } });
    const corpo = (sufixo, passos, extra = {}) => ({
      name: nome(sufixo), description: 'Massa temporária do contexto 4 de 0-D (backend#745)', all_channels: true, channel_ids: [],
      is_active: false, trigger_type: 'new_client_created', trigger_config: {}, steps: passos, ...extra,
    });
    const salvar = (sufixo, passo) => cy.then(() => api.criarAutomacao(corpo(sufixo, [passo]), TIMEOUT_ROTA)).then((res) => {
      if (res.body && res.body.automation) criadas.push(res.body.automation.id);
      return res;
    });
    const exigirIssue = (res, codigo, campo, rotulo) => {
      expect(res.status, `Status de ${rotulo}`).to.eq(422);
      expect((res.body.issues || []).map((i) => `${i.code}@${i.path}`), `Problemas de ${rotulo}`).to.deep.eq([`${codigo}@steps.0.step_config.${campo}`]);
    };

    before(() => {
      api.autenticar();
    });

    after(() => {
      criadas.forEach((id) => api.excluirAutomacao(id, TIMEOUT_ROTA));
      if (clienteId) api.alterarAtivacaoCliente(storeId, clienteId, false, TIMEOUT_ROTA);
    });

    it('4.1 Deve recusar em qualquer save, rascunho pausado incluído, a credencial na URL e o placeholder fora de client.id, attendance.id e store.id, e aceitar os ids permitidos', () => {
      // Credencial: usuário e senha, só usuário e a autoridade sem barras que o navegador normaliza
      [['https://u:p@example.com/hook', 'usuário e senha'], ['https://u@example.com/hook', 'só usuário'], ['https:u:p@example.com/hook', 'sem as barras']].forEach(([url, rotulo]) => {
        salvar(`credencial ${rotulo}`, webhook(url)).then((res) => exigirIssue(res, 'webhook_url_credentials', 'url', `URL com credencial (${rotulo})`));
      });
      // Dado de paciente: placeholder fora da allowlist no corpo, na URL e o escape de emoji
      salvar('nome no corpo', webhook('https://example.com/hook', '{"n":"{{client.name}}"}')).then((res) => exigirIssue(res, 'webhook_placeholder_not_allowed', 'body_template', '{{client.name}} no corpo'));
      salvar('telefone na url', webhook('https://example.com/hook?c={{client.phone}}')).then((res) => exigirIssue(res, 'webhook_placeholder_not_allowed', 'url', '{{client.phone}} na URL'));
      salvar('emoji', webhook('https://example.com/hook', '{"e":"{{e:1F600}}"}')).then((res) => exigirIssue(res, 'webhook_placeholder_not_allowed', 'body_template', 'escape de emoji'));
      // Permitido, mas o gatilho cliente novo não tem atendimento
      salvar('atendimento sem atendimento', webhook('https://example.com/hook', '{"a":{{attendance.id}}}')).then((res) => exigirIssue(res, 'placeholder_unavailable', 'body_template', '{{attendance.id}} no gatilho cliente novo'));
      // Contraprova: os ids permitidos, na URL e no corpo
      salvar('ids permitidos', webhook('https://example.com/hook?c={{client.id}}', '{"c":{{client.id}},"s":{{store.id}}}')).then((res) => {
        expect(res.status, 'Save com client.id e store.id').to.eq(201);
        expect(res.body.automation.is_active, 'Rascunho pausado').to.eq(false);
      });
    });

    it('4.2 Deve aceitar no rascunho e recusar na ativação a URL inválida ou não https, o host interno literal ou nome local, o host ou a porta dinâmicos e o corpo que não é JSON, e ativar a URL https pública com corpo vazio', () => {
      const naAtivacao = [
        ['http://example.com/hook', undefined, 'webhook_url_invalid', 'url', 'http'],
        ['https://2130706433/hook', undefined, 'webhook_url_invalid', 'url', 'host numérico que não é IPv4 com pontos'],
        ['https://example.com:70000/hook', undefined, 'webhook_url_invalid', 'url', 'porta acima de 65535'],
        ['https://@example.com/hook', undefined, 'webhook_url_invalid', 'url', 'userinfo vazio'],
        ['https://127.0.0.1/hook', undefined, 'webhook_url_internal', 'url', 'loopback'],
        ['https://169.254.169.254/latest', undefined, 'webhook_url_internal', 'url', 'metadata da AWS'],
        ['https://localhost/hook', undefined, 'webhook_url_internal', 'url', 'nome local'],
        ['https://{{client.id}}.example.com/hook', undefined, 'webhook_url_dynamic_host', 'url', 'host dinâmico'],
        ['https://example.com:{{client.id}}/hook', undefined, 'webhook_url_dynamic_host', 'url', 'porta dinâmica'],
        ['https://example.com/hook', '{"a": ', 'webhook_body_invalid', 'body_template', 'corpo que não é JSON'],
      ];
      naAtivacao.forEach(([url, bodyTemplate, codigo, campo, rotulo]) => {
        salvar(`ativação ${rotulo}`, webhook(url, bodyTemplate)).then((res) => {
          expect(res.status, `O rascunho com ${rotulo} é aceito`).to.eq(201);
          const { id } = res.body.automation;
          cy.then(() => api.atualizarAutomacao(id, { is_active: true }, TIMEOUT_ROTA)).then((resAtivar) => exigirIssue(resAtivar, codigo, campo, `ativar com ${rotulo}`));
          cy.then(() => api.obterAutomacao(id, TIMEOUT_ROTA)).then((resDetalhe) => {
            expect(resDetalhe.body.automation.is_active, `A recusa de ${rotulo} não ativou`).to.eq(false);
          });
        });
      });
      // Contraprova: https público com corpo vazio (o motor manda o envelope) ativa
      salvar('ativação ok', webhook('https://example.com/hook', '')).then((res) => {
        const { id } = res.body.automation;
        cy.then(() => api.atualizarAutomacao(id, { is_active: true }, TIMEOUT_ROTA)).then((resAtivar) => {
          expect(resAtivar.status, 'Ativar a URL https pública com corpo vazio').to.eq(200);
          expect(resAtivar.body.automation.is_active, 'Ativa').to.eq(true);
        });
        cy.then(() => api.atualizarAutomacao(id, { is_active: false }, TIMEOUT_ROTA));
      });
    });

    it('4.3 Deve bloquear na execução o destino cujo nome resolve para IP interno (webhook_blocked), falhar o nome que não resolve (webhook_unreachable) e o status 404 (webhook_http_404), seguindo os passos até o fim do run', () => {
      // Arrange: automação ativa no cliente novo, um passo por destino (a ativação aceita: nenhum é IP literal nem nome local)
      const destinos = [
        webhook('https://localtest.me/hook'),
        webhook('https://169.254.169.254.nip.io/latest'),
        webhook('https://10.0.0.1.nip.io/hook'),
        webhook(`https://zz-${TOKEN}.invalid/hook`),
        webhook(`${API}/zz-webhook-cypress-${TOKEN}`, '{"c":{{client.id}},"s":{{store.id}}}'),
      ];
      let automacaoId;
      cy.then(() => api.criarAutomacao(corpo('execução', destinos, { is_active: true }), TIMEOUT_ROTA)).then((res) => {
        expect(res.status, `POST da automação ativa com os 5 webhooks: ${JSON.stringify(res.body.issues || '')}`).to.eq(201);
        automacaoId = res.body.automation.id;
        criadas.push(automacaoId);
      });

      // Act: o cliente novo dispara a automação; o motor confere os eventos a cada 30 s
      cy.then(() => api.criarCliente(storeId, { name: `CYPRESS BACKEND 745 ${TOKEN}`, person_type: 1 }, TIMEOUT_ROTA)).then((res) => {
        expect(res.status, 'POST /clients').to.be.oneOf([200, 201]);
        clienteId = res.body.id;
      });
      const esperar = (inicio) => cy.then(() => api.listarExecucoesAutomacao(automacaoId, 1, TIMEOUT_ROTA)).then((res) => {
        logExecucao = (res.body.data || []).find((log) => log.client_id === clienteId) || null;
        if (logExecucao || Date.now() - inicio > ESPERA_DO_MOTOR_MS) return;
        cy.wait(10000);
        esperar(inicio);
      });
      cy.then(() => esperar(Date.now()));

      // Assert
      cy.then(() => {
        expect(logExecucao, `Log da automação para o cliente ${clienteId} (o motor confere a cada 30 s)`).to.be.an('object');
        expect(logExecucao.status, 'Passo que falha não para o run').to.eq('partial');
        const resultado = logExecucao.steps_executed.map((p) => `${p.path}:${p.step_type}:${p.status}:${p.detail}`);
        expect(resultado, 'Um resultado por destino, na ordem').to.deep.eq([
          '0:send_webhook:failed:webhook_blocked',
          '1:send_webhook:failed:webhook_blocked',
          '2:send_webhook:failed:webhook_blocked',
          '3:send_webhook:failed:webhook_unreachable',
          '4:send_webhook:failed:webhook_http_404',
        ]);
      });
    });

    it('4.4 Deve gravar no passo send_webhook só url e body_template, descartando headers e qualquer outra chave na raiz, no ramo e no PATCH, e recusar url ou body_template que não seja texto (Issue backend#745, PR #870)', () => {
      // Devolutiva de 2026-11-06 corrigida na PR #870: um header de autenticação ficava em texto puro no step_config e voltava no GET. Medido na dev no mesmo dia (aba-c).
      const soUrl = (passos, rotulo) => {
        const passo = passos[0].step_type === 'send_webhook' ? passos[0] : passos[0].branches.yes[0];
        expect(passo.step_config, `step_config de ${rotulo}`).to.deep.eq({ url: 'https://example.com/hook' });
      };
      const conferirGravado = (sufixo, passos) => cy.then(() => api.criarAutomacao(corpo(sufixo, passos), TIMEOUT_ROTA)).then((res) => {
        expect(res.status, `POST ${sufixo}`).to.eq(201);
        criadas.push(res.body.automation.id);
        soUrl(res.body.automation.steps, `${sufixo} no 201`);
        cy.then(() => api.obterAutomacao(res.body.automation.id, TIMEOUT_ROTA)).then((resGet) => soUrl(resGet.body.automation.steps, `${sufixo} no GET`));
      });

      // headers e outra chave na raiz, e headers dentro do ramo de uma condição
      conferirGravado('headers', [{ step_type: 'send_webhook', step_config: { url: 'https://example.com/hook', headers: { Authorization: `Bearer ${TOKEN}` } } }]);
      conferirGravado('outra chave', [{ step_type: 'send_webhook', step_config: { url: 'https://example.com/hook', segredo: TOKEN } }]);
      conferirGravado('no ramo', [{ step_type: 'condition', step_config: { subject: 'time_of_day', value: '00:00-23:59' }, branches: { yes: [{ step_type: 'send_webhook', step_config: { url: 'https://example.com/hook', headers: { A: TOKEN } } }], no: [] } }]);

      // PATCH com steps também descarta
      salvar('patch', webhook('https://example.com/outro')).then((res) => {
        const { automation } = res.body;
        cy.then(() => api.atualizarAutomacao(automation.id, { updated_at: automation.updated_at, steps: [{ step_type: 'send_webhook', step_config: { url: 'https://example.com/hook', headers: { X: TOKEN } } }] }, TIMEOUT_ROTA)).then((resPatch) => {
          expect(resPatch.status, 'PATCH com steps').to.eq(200);
          soUrl(resPatch.body.automation.steps, 'PATCH no 200');
        });
      });

      // Valor que não é texto em url ou body_template: recusado, no rascunho e na ativa
      [['url', { url: { a: 'b' } }, false], ['body_template', { url: 'https://example.com/hook', body_template: { id: 1 } }, false], ['body_template', { url: 'https://example.com/hook', body_template: { id: 1 } }, true]].forEach(([campo, cfg, ativa]) => {
        cy.then(() => api.criarAutomacao(corpo(`${campo} objeto ${ativa ? 'ativa' : 'rascunho'}`, [{ step_type: 'send_webhook', step_config: cfg }], { is_active: ativa }), TIMEOUT_ROTA)).then((res) => {
          if (res.body && res.body.automation) criadas.push(res.body.automation.id);
          expect(res.status, `${campo} objeto (${ativa ? 'ativa' : 'rascunho'})`).to.eq(422);
          expect(res.body.message, `Mensagem de ${campo} objeto`).to.eq(`O campo steps[0].step_config.${campo} deve ser um texto.`);
        });
      });
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 5: AUTOMAÇÕES — GATILHO AGENDADO PELO RELÓGIO DO MOTOR (Issue backend#746)
  // ---------------------------------------------------------------------------
  context('5. Automações: Gatilho Agendado (time_based) pelo Relógio do Motor — Disparo no Horário, uma Vez por Horário, Fuso, Dias da Semana e Horário que Já Passou (Issue backend#746)', () => {

    // O relógio do motor (backend#746, PR #857) roda no ciclo de 30 s do despacho: cada automação `time_based` viva dispara quando um ciclo vê o horário entre `schedule` e `schedule` + 10 min,
    // no fuso de `timezone` (ausente = America/Sao_Paulo) e nos `days` (ausente = todo dia). A chave do log é `time:<slot em UTC>`, com o `UNIQUE (automação, CHAVE_EVENTO)`: o mesmo horário
    // dispara uma vez só. O horário só dispara se for posterior ao último save da automação: criada (ou salva) depois do horário, ela pula aquele dia, mesmo dentro dos 10 min.
    // Medido na dev em 2026-11-06 (aba-b): o horário marcado para daqui a 2 minutos disparou 26 s depois dele, com `trigger_event: time_based`, cliente e atendimento nulos,
    // e um log só nos ciclos seguintes; o mesmo `HH:mm` de UTC sem fuso (São Paulo) e o horário 2 minutos antes da criação não dispararam.
    // Massa própria ([R-ATEMPORAL]): automações só com a condição de horário (não enviam nada), com o horário calculado a partir de agora; apagadas no after.
    // Sem teste (`ROADMAP.md` P1-71): o horário perdido com o servidor fora do ar e duas tasks disputando o mesmo horário (integração do backend).
    const TIMEOUT_ROTA = { timeout: 90000 };
    const TOKEN = Date.now().toString(36);
    const nome = (sufixo) => `[Cypress] Backend 746 ${TOKEN} ${sufixo}`;
    const FUSO_PADRAO = 'America/Sao_Paulo';
    // Folga mínima entre a criação e o horário: o horário só dispara se for posterior ao último save (decisão 5), e as 7 automações levam ~5 s
    const FOLGA_MINIMA_MS = 30000;
    const UM_MINUTO_MS = 60000;
    // Depois do minuto do horário: o disparo (até 30 s, um ciclo) e mais um ciclo inteiro, que relê o horário e prova a idempotência
    const DEPOIS_DO_HORARIO_MS = 70000;
    const condicao = { step_type: 'condition', step_config: { subject: 'time_of_day', value: '00:00-23:59' }, branches: { yes: [], no: [] } };
    const auts = {};
    const logs = {};
    let horario = null;

    const hhmm = (data, fuso) => new Intl.DateTimeFormat('en-GB', { timeZone: fuso, hour: '2-digit', minute: '2-digit', hour12: false }).format(data);
    const diaDaSemana = (data, fuso) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(new Intl.DateTimeFormat('en-US', { timeZone: fuso, weekday: 'short' }).format(data));
    const criar = (chave, trigger_config, is_active = true) => cy.then(() => api.criarAutomacao({ name: nome(chave), description: 'Massa temporária do contexto 5 de 0-D (backend#746)', all_channels: true, is_active, trigger_type: 'time_based', trigger_config, steps: [condicao] }, TIMEOUT_ROTA)).then((res) => {
      expect(res.status, `Status do POST /automations "${chave}": ${JSON.stringify(res.body.issues || res.body.message || '')}`).to.eq(201);
      auts[chave] = res.body.automation.id;
    });
    const runCount = (chave) => cy.then(() => api.listarAutomacoes(TIMEOUT_ROTA)).then((res) => (res.body.data || []).find((a) => a.id === auts[chave]).run_count);

    before(() => {
      // Arrange: o próximo minuto cheio (ou o seguinte, se faltarem menos de 30 s), em São Paulo e em UTC, e o de 2 minutos atrás
      cy.then(() => {
        const agora = new Date();
        let alvo = new Date(Math.ceil(agora.getTime() / UM_MINUTO_MS) * UM_MINUTO_MS);
        if (alvo.getTime() - agora.getTime() < FOLGA_MINIMA_MS) alvo = new Date(alvo.getTime() + UM_MINUTO_MS);
        const passado = new Date(agora.getTime() - 2 * UM_MINUTO_MS);
        const hoje = diaDaSemana(alvo, FUSO_PADRAO);
        horario = { alvo, sp: hhmm(alvo, FUSO_PADRAO), utc: hhmm(alvo, 'UTC') };
        criar('padrao', { schedule: horario.sp });
        criar('utc', { schedule: horario.utc, timezone: 'UTC' });
        criar('utc sem fuso', { schedule: horario.utc });
        criar('hoje', { schedule: horario.sp, days: [hoje] });
        criar('outro dia', { schedule: horario.sp, days: [(hoje + 1) % 7] });
        criar('ja passou', { schedule: hhmm(passado, FUSO_PADRAO) });
        criar('pausada', { schedule: horario.sp }, false);
      });

      // Act: o relógio do motor; espera o minuto do horário, o disparo e mais um ciclo
      cy.then(() => {
        const inicioDoMinuto = new Date(horario.alvo.getTime());
        inicioDoMinuto.setSeconds(0, 0);
        const espera = inicioDoMinuto.getTime() + DEPOIS_DO_HORARIO_MS - Date.now();
        if (espera > 0) cy.wait(espera);
      });
      cy.then(() => cy.wrap(Object.keys(auts)).each((chave) => api.listarExecucoesAutomacao(auts[chave], 1, TIMEOUT_ROTA).then((res) => {
        expect(res.status, `Status do GET /automations/${auts[chave]}/logs`).to.eq(200);
        logs[chave] = res.body.data || [];
      })));
    });

    after(() => {
      Object.values(auts).forEach((id) => api.excluirAutomacao(id, TIMEOUT_ROTA));
    });

    it('5.1 Deve disparar no horário pelo fuso padrão de São Paulo, com o log do gatilho sem cliente nem atendimento, e uma vez só no mesmo horário depois de vários ciclos', () => {
      expect(logs.padrao, `Um log só para o horário ${horario.sp} (São Paulo), mesmo depois do ciclo seguinte ao disparo`).to.have.length(1);
      const log = logs.padrao[0];
      expect(log.trigger_event, 'Gatilho do log').to.eq('time_based');
      expect(log.client_id, 'O Agendado não tem cliente').to.eq(null);
      expect(log.attendance_id, 'O Agendado não tem atendimento').to.eq(null);
      expect(log.status, 'A condição rodou').to.eq('success');
      const inicioDoMinuto = new Date(horario.alvo.getTime());
      inicioDoMinuto.setSeconds(0, 0);
      expect(new Date(log.created_at).getTime(), 'Dispara no horário ou depois, nunca antes').to.be.at.least(inicioDoMinuto.getTime() - 1000);
      runCount('padrao').then((n) => expect(n, 'run_count conta um disparo').to.eq(1));
    });

    it('5.2 Deve disparar no horário do fuso informado e não disparar o mesmo HH:mm lido no fuso padrão', () => {
      expect(logs.utc, `timezone UTC às ${horario.utc}: dispara`).to.have.length(1);
      expect(logs['utc sem fuso'], `${horario.utc} sem fuso é São Paulo, 3 h depois: não dispara agora`).to.have.length(0);
    });

    it('5.3 Deve disparar com o dia de hoje na lista de dias e não disparar com outro dia', () => {
      expect(logs.hoje, 'Hoje está em days: dispara').to.have.length(1);
      expect(logs['outro dia'], 'Só amanhã em days: não dispara').to.have.length(0);
      // Contraprova: o mesmo horário sem days disparou
      expect(logs.padrao, 'Contraprova: o horário sem days disparou').to.have.length(1);
    });

    it('5.4 não deve disparar a automação criada depois do horário, ainda dentro dos 10 minutos, nem a pausada', () => {
      expect(logs['ja passou'], 'Criada 2 minutos depois do horário: o horário de hoje não é recuperado').to.have.length(0);
      expect(logs.pausada, 'Pausada não dispara').to.have.length(0);
      runCount('pausada').then((n) => expect(n, 'run_count da pausada').to.eq(0));
      expect(logs.padrao, 'Contraprova: o relógio disparou a ativa').to.have.length(1);
    });

  });

  // ---------------------------------------------------------------------------
  // CONTEXTO 6: AUTOMAÇÕES — JANELA DE HORÁRIO QUE PASSA DA MEIA-NOITE NO MOTOR (Issue backend#735, A6)
  // ---------------------------------------------------------------------------
  context('6. Automações: Condição de Horário com Janela que Passa da Meia-Noite Pertence ao Dia em que Abriu (Issue backend#735, A6)', () => {

    // A A6 da backend#735: a janela `HH:mm-HH:mm` que passa da meia-noite (início maior que o fim) pertence ao dia em que ABRIU, e `days` filtra por esse dia.
    // O `0-D #2.4` prova o fuso e o dia numa janela do mesmo dia; aqui a janela atravessa a meia-noite e o dia que decide é o da abertura, não o de agora.
    // Janela calculada a partir de agora ([R-ATEMPORAL]): abre no minuto cheio de 1 a 2 h atrás e fecha 1 h antes disso no dia seguinte (23 h de largura),
    // então sempre passa da meia-noite e sempre contém o agora. O dia de abertura é o de (agora - 1 h) em São Paulo: com `days` nele, a condição cai em `yes`;
    // com `days` no dia anterior (a janela que abriu ontem fechou há pelo menos 1 h), cai em `no`. Uma automação de cliente novo por caso, 1 cliente por rodada.
    // Massa própria: automações só com a condição (não enviam nada), apagadas no after; o cliente é desativado no after.
    const TIMEOUT_ROTA = { timeout: 90000 };
    const TOKEN = Date.now().toString(36);
    const nome = (sufixo) => `[Cypress] Backend 735 ${TOKEN} ${sufixo}`;
    const FUSO = 'America/Sao_Paulo';
    const ESPERA_DO_MOTOR_MS = 180000;
    const auts = {};
    const logs = {};
    let clienteId = null;
    let janela = null;

    const partesEmSaoPaulo = (data) => {
      const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: FUSO, hour: '2-digit', hour12: false, weekday: 'short' }).formatToParts(data).map((x) => [x.type, x.value]));
      return { hora: Number(p.hour) % 24, dia: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) };
    };
    const hh = (n) => `${String(n).padStart(2, '0')}:00`;
    const condicao = (days) => ({ step_type: 'condition', step_config: { subject: 'time_of_day', value: janela.valor, days, timezone: FUSO }, branches: { yes: [], no: [] } });
    const criar = (chave, days) => cy.then(() => api.criarAutomacao({ name: nome(chave), description: 'Massa temporária do contexto 6 de 0-D (backend#735)', all_channels: true, is_active: true, trigger_type: 'new_client_created', trigger_config: {}, steps: [condicao(days)] }, TIMEOUT_ROTA)).then((res) => {
      expect(res.status, `Status do POST /automations "${chave}": ${JSON.stringify(res.body.issues || res.body.message || '')}`).to.eq(201);
      auts[chave] = res.body.automation.id;
    });
    const esperarLogs = (inicio = Date.now()) => cy.wrap(Object.keys(auts)).each((chave) => api.listarExecucoesAutomacao(auts[chave], 1, TIMEOUT_ROTA).then((res) => {
      logs[chave] = (res.body.data || []).filter((l) => l.client_id === clienteId && l.trigger_event === 'new_client_created');
    })).then(() => {
      if (Object.keys(auts).every((c) => logs[c] && logs[c].length) || Date.now() - inicio > ESPERA_DO_MOTOR_MS) return;
      cy.wait(10000);
      esperarLogs(inicio);
    });
    const ramo = (chave) => ((logs[chave][0].steps_executed || []).find((p) => p.path === '0') || {}).detail;

    before(() => {
      // Arrange: a janela de 23 h que abriu de 1 a 2 h atrás e passa da meia-noite
      cy.then(() => {
        const abertura = partesEmSaoPaulo(new Date(Date.now() - 3600000));
        const inicio = abertura.hora;
        const fim = (inicio + 23) % 24;
        janela = { valor: `${hh(inicio)}-${hh(fim)}`, diaDeAbertura: abertura.dia, diaAnterior: (abertura.dia + 6) % 7 };
      });
      cy.then(() => criar('dia de abertura', [janela.diaDeAbertura]));
      cy.then(() => criar('dia anterior', [janela.diaAnterior]));

      // Act: o cliente novo dispara as duas
      cy.then(() => api.criarCliente(storeId, { name: `CYPRESS BACKEND 735 ${TOKEN}`, person_type: 1 }, TIMEOUT_ROTA)).then((res) => {
        expect(res.status, 'Status do POST /clients (evento new_client_created)').to.eq(201);
        clienteId = res.body.id;
      });
      esperarLogs();
    });

    after(() => {
      Object.values(auts).forEach((id) => api.excluirAutomacao(id, TIMEOUT_ROTA));
      if (clienteId) api.alterarAtivacaoCliente(storeId, clienteId, false, TIMEOUT_ROTA);
    });

    it('6.1 Deve tomar o ramo sim na janela que passa da meia-noite quando o dia em que ela abriu está em days, e o ramo não quando só o dia anterior está', () => {
      expect(janela.valor.split('-')[0] > janela.valor.split('-')[1], `A janela ${janela.valor} passa da meia-noite`).to.eq(true);
      expect(logs['dia de abertura'], 'Log da automação com o dia de abertura (o motor confere a cada 30 s)').to.have.length(1);
      expect(logs['dia anterior'], 'Log da automação com o dia anterior').to.have.length(1);
      expect(ramo('dia de abertura'), `${janela.valor} aberta no dia ${janela.diaDeAbertura}: o agora está dentro e o dia é o da abertura`).to.eq('yes');
      expect(ramo('dia anterior'), `A janela do dia ${janela.diaAnterior} já fechou: o agora pertence à que abriu no dia ${janela.diaDeAbertura}`).to.eq('no');
    });

  });

});
