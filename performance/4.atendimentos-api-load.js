import http from 'k6/http';
import { check, sleep, group } from 'k6';

// -------------------------------------------------------------
// CONFIGURAÇÃO E VARIÁVEIS GLOBAIS (env.json)
// -------------------------------------------------------------
const configEnv = JSON.parse(open('../env.json'));

/**
 * Função utilitária para calcular dinamicamente o intervalo dos últimos 30 dias (YYYY-MM-DD)
 * Obrigatório para todas as rotas de attendances da API REST
 */
function obterIntervaloMesAtual() {
  const agora = new Date();
  const dataInicialObj = new Date(agora);
  dataInicialObj.setDate(agora.getDate() - 30);

  const formatarData = (dataObj) => {
    const yyyy = dataObj.getFullYear();
    const mm = String(dataObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dataObj.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  return {
    startDate: formatarData(dataInicialObj),
    endDate: formatarData(agora),
  };
}

export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp-up: sobe gradualmente para 10 usuários em 30 segundos
    { duration: '1m',  target: 10 }, // Carga constante: mantém 10 usuários virtuais concorrentes por 1 minuto
    { duration: '20s', target: 0  }, // Ramp-down: reduz gradualmente para 0 usuários em 20 segundos
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // SLA de Performance: 95% das requisições devem responder em menos de 2.0s sob carga
    http_req_failed: ['rate<0.01'],    // Confiabilidade: Taxa de erros HTTP permitida menor que 1%
  },
};

// -------------------------------------------------------------
// 1. SETUP: Autenticação e Descoberta Dinâmica de Recursos
// -------------------------------------------------------------
export function setup() {
  const { startDate, endDate } = obterIntervaloMesAtual();

  // 1.1 Autenticação na API REST
  const loginPayload = JSON.stringify({
    cnpj: configEnv.USER_CNPJ,
    username: configEnv.USER_CODE,
    password: configEnv.USER_PASSWORD,
  });

  const loginParams = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };

  const resLogin = http.post(`${configEnv.API_URL}/auth/login`, loginPayload, loginParams);

  if (resLogin.status !== 200) {
    throw new Error(`[k6 Setup] Falha na autenticação: Status ${resLogin.status} - ${resLogin.body}`);
  }

  const token = resLogin.json('token') || resLogin.json('access_token');

  const authParams = {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };

  // 1.2 Captura dinâmica de canais para descoberta do Canal Oficial
  const resChannels = http.get(`${configEnv.API_URL}/channels`, authParams);
  let channelId = 6;
  if (resChannels.status === 200) {
    const channelsData = resChannels.json('items') || (Array.isArray(resChannels.json()) ? resChannels.json() : []);
    const canalOficial = channelsData.find(c =>
      (c.name && c.name.toUpperCase().includes('OFICIAL') && !c.name.toUpperCase().includes('NAO OFICIAL')) ||
      c.channel_subtype === 1
    );
    channelId = canalOficial ? canalOficial.id : (channelsData[0]?.id || 6);
  }

  // 1.3 Captura dinâmica de grupo associado ao canal
  const resGroups = http.get(`${configEnv.API_URL}/channel-groups?channel_id=${channelId}`, authParams);
  let groupId = 7;
  if (resGroups.status === 200) {
    const groupsData = resGroups.json('items') || (Array.isArray(resGroups.json()) ? resGroups.json() : []);
    groupId = groupsData[0]?.id || 7;
  }

  // 1.4 Captura dinâmica de um ID de atendimento válido com parâmetros de data dinâmicos
  const resAttendances = http.get(
    `${configEnv.API_URL}/attendances?start_date=${startDate}&end_date=${endDate}&page=1&per_page=10`,
    authParams
  );
  let sampleAttendanceId = 260800105;
  if (resAttendances.status === 200) {
    const attendancesData = resAttendances.json('items') || (Array.isArray(resAttendances.json()) ? resAttendances.json() : []);
    if (attendancesData.length > 0 && attendancesData[0].id) {
      sampleAttendanceId = attendancesData[0].id;
    }
  }

  const sampleSearchTerm = configEnv.DEFAULT_CELULAR ? String(configEnv.DEFAULT_CELULAR).slice(-4) : '337';

  return {
    authToken: token,
    channelId: channelId,
    groupId: groupId,
    attendanceId: sampleAttendanceId,
    searchTerm: sampleSearchTerm
  };
}

// -------------------------------------------------------------
// 2. TESTE DE CARGA (VU Execution - Foco Exclusivo em Consultas GET)
// -------------------------------------------------------------
export default function (data) {
  const { startDate, endDate } = obterIntervaloMesAtual();

  const params = {
    headers: {
      'Authorization': `Bearer ${data.authToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };

  // -----------------------------------------------------------
  // FLUXO 1: Carregamento Inicial da Tela de Atendimentos & Capabilities
  // -----------------------------------------------------------
  group('1. Carregamento Inicial da Tela e Capabilities', function () {
    // Simula as requisições paralelas disparadas pelo frontend ao montar a tela /atendimentos
    const reqsAberturaTela = {
      userMe: {
        method: 'GET',
        url: `${configEnv.API_URL}/users/me`,
        params: params,
      },
      storeCapabilities: {
        method: 'GET',
        url: `${configEnv.API_URL}/attendance-capabilities`,
        params: params,
      },
      standardMessageCapabilities: {
        method: 'GET',
        url: `${configEnv.API_URL}/standard-message-capabilities`,
        params: params,
      },
      summaryCounts: {
        method: 'GET',
        url: `${configEnv.API_URL}/attendances/summary?start_date=${startDate}&end_date=${endDate}`,
        params: params,
      },
      filaAguardando: {
        method: 'GET',
        url: `${configEnv.API_URL}/attendances?start_date=${startDate}&end_date=${endDate}&page=1&per_page=20&status=waiting`,
        params: params,
      },
    };

    const responsesAbertura = http.batch(reqsAberturaTela);

    check(responsesAbertura['userMe'], {
      'GET /users/me - Status 200': (r) => r.status === 200,
    });

    check(responsesAbertura['storeCapabilities'], {
      'GET Attendance Capabilities - Status 200': (r) => r.status === 200,
    });

    check(responsesAbertura['standardMessageCapabilities'], {
      'GET Standard Message Capabilities - Status 200': (r) => r.status === 200,
    });

    check(responsesAbertura['summaryCounts'], {
      'GET Summary Contadores - Status 200': (r) => r.status === 200,
    });

    check(responsesAbertura['filaAguardando'], {
      'GET Fila Aguardando - Status 200': (r) => r.status === 200,
    });
  });

  // -----------------------------------------------------------
  // FLUXO 2: Alternância de Abas e Filtros de Status (Chips Superiores)
  // -----------------------------------------------------------
  group('2. Consulta Concorrente das Filas por Status', function () {
    const reqsFilas = {
      pending: {
        method: 'GET',
        url: `${configEnv.API_URL}/attendances?start_date=${startDate}&end_date=${endDate}&page=1&per_page=20&status=pending`,
        params: params,
      },
      in_progress: {
        method: 'GET',
        url: `${configEnv.API_URL}/attendances?start_date=${startDate}&end_date=${endDate}&page=1&per_page=20&status=in_progress`,
        params: params,
      },
      all: {
        method: 'GET',
        url: `${configEnv.API_URL}/attendances?start_date=${startDate}&end_date=${endDate}&page=1&per_page=20`,
        params: params,
      },
    };

    const responsesFilas = http.batch(reqsFilas);

    check(responsesFilas['pending'], {
      'GET Fila Pendente - Status 200': (r) => r.status === 200,
    });

    check(responsesFilas['in_progress'], {
      'GET Fila Em Andamento - Status 200': (r) => r.status === 200,
    });

    check(responsesFilas['all'], {
      'GET Fila Todos - Status 200': (r) => r.status === 200,
    });
  });

  // -----------------------------------------------------------
  // FLUXO 3: Abertura do Chat, Mensagens e Templates WABA
  // -----------------------------------------------------------
  group('3. Renderização do Chat de Atendimento', function () {
    const attendanceId = data.attendanceId;

    const reqsChat = {
      detail: {
        method: 'GET',
        url: `${configEnv.API_URL}/attendances/${attendanceId}`,
        params: params,
      },
      capabilities: {
        method: 'GET',
        url: `${configEnv.API_URL}/attendances/${attendanceId}/capabilities`,
        params: params,
      },
      messages: {
        method: 'GET',
        url: `${configEnv.API_URL}/attendances/${attendanceId}/messages?page=1&per_page=50`,
        params: params,
      },
      messageTemplates: {
        method: 'GET',
        url: `${configEnv.API_URL}/attendances/${attendanceId}/message-templates`,
        params: params,
      },
    };

    const responsesChat = http.batch(reqsChat);

    check(responsesChat['detail'], {
      'GET Detalhe do Atendimento - Status 200': (r) => r.status === 200,
    });

    check(responsesChat['capabilities'], {
      'GET Item Capabilities - Status 200': (r) => r.status === 200,
    });

    check(responsesChat['messages'], {
      'GET Mensagens do Chat - Status 200': (r) => r.status === 200,
    });

    check(responsesChat['messageTemplates'], {
      'GET Templates do Atendimento - Status 200': (r) => r.status === 200,
    });
  });

  // -----------------------------------------------------------
  // FLUXO 4: Modal de Transferência, Busca de Atendentes e Filtros
  // -----------------------------------------------------------
  group('4. Modal de Transferência e Filtros Avançados', function () {
    const reqsModalTransferirEFiltros = {
      channels: {
        method: 'GET',
        url: `${configEnv.API_URL}/channels`,
        params: params,
      },
      channelGroups: {
        method: 'GET',
        url: `${configEnv.API_URL}/channel-groups?channel_id=${data.channelId}`,
        params: params,
      },
      groupAgents: {
        method: 'GET',
        url: `${configEnv.API_URL}/attendance-groups/${data.groupId}/agents`,
        params: params,
      },
      searchPhone: {
        method: 'GET',
        url: `${configEnv.API_URL}/attendances?start_date=${startDate}&end_date=${endDate}&search=${data.searchTerm}`,
        params: params,
      },
    };

    const responsesModal = http.batch(reqsModalTransferirEFiltros);

    check(responsesModal['channels'], {
      'GET Canais - Status 200': (r) => r.status === 200,
    });

    check(responsesModal['channelGroups'], {
      'GET Grupos do Canal - Status 200': (r) => r.status === 200,
    });

    check(responsesModal['groupAgents'], {
      'GET Atendentes do Grupo - Status 200': (r) => r.status === 200,
    });

    check(responsesModal['searchPhone'], {
      'GET Busca de Atendimentos - Status 200': (r) => r.status === 200,
    });
  });

  sleep(Math.random() * 2 + 1); // Pacing aleatório entre 1s e 3s simulando o intervalo de leitura do usuário
}
