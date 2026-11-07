import http from 'k6/http';
import { check, sleep, group } from 'k6';

// Lê as variáveis globais centralizadas no env.json
const configEnv = JSON.parse(open('../env.json'));

export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp-up: sobe para 10 usuários em 30s
    { duration: '1m',  target: 10 }, // Carga constante: 10 usuários por 1m
    { duration: '20s', target: 0  }, // Ramp-down: reduz a 0 usuários em 20s
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // SLA de Performance: 95% das requisições < 500ms
    http_req_failed: ['rate<0.01'],   // Taxa de erros < 1%
  },
};

// 1. SETUP: Autenticação e descoberta dinâmica do Canal Oficial
export function setup() {
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
    throw new Error(`Falha na autenticação no Setup: ${resLogin.status} - ${resLogin.body}`);
  }

  const token = resLogin.json('token') || resLogin.json('access_token');

  const authParams = {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };

  // Mapeia dinamicamente os canais cadastrados
  const resChannels = http.get(`${configEnv.API_URL}/channels`, authParams);
  
  if (resChannels.status !== 200) {
    throw new Error(`Falha ao buscar canais no Setup: ${resChannels.status}`);
  }

  const channelsData = resChannels.json('items') || [];
  
  const canalOficial = channelsData.find(c => 
    (c.name && c.name.toUpperCase().includes('OFICIAL') && !c.name.toUpperCase().includes('NAO OFICIAL')) ||
    c.channel_subtype === 1
  );

  const channelId = canalOficial ? canalOficial.id : (channelsData[0]?.id || 1);

  return { 
    authToken: token,
    channelId: channelId
  };
}

// 2. TESTE DE CARGA (VU Execution - Consultas de Abertura do Modal)
export default function (data) {
  const selectedChannelId = data.channelId;

  const params = {
    headers: {
      'Authorization': `Bearer ${data.authToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };

  group('APIs do Modal Iniciar Atendimento', function () {

    // Carregamento do Modal (Requisições GET paralelas acionadas ao abrir a tela)
    const reqsAberturaModal = {
      channels: {
        method: 'GET',
        url: `${configEnv.API_URL}/channels`,
        params: params,
      },
      groups: {
        method: 'GET',
        url: `${configEnv.API_URL}/channel-groups?channel_id=${selectedChannelId}`,
        params: params,
      },
      templates: {
        method: 'GET',
        url: `${configEnv.API_URL}/waba-message-templates?channel_id=${selectedChannelId}`,
        params: params,
      },
      standardMessages: {
        method: 'GET',
        url: `${configEnv.API_URL}/standard-messages`,
        params: params,
      },
    };

    const responsesAbertura = http.batch(reqsAberturaModal);

    check(responsesAbertura['channels'], {
      'GET Canais - Status é 200': (r) => r.status === 200,
      'GET Canais - Tempo < 400ms': (r) => r.timings.duration < 400,
    });

    check(responsesAbertura['groups'], {
      'GET Grupos do Canal - Status é 200': (r) => r.status === 200,
      'GET Grupos do Canal - Tempo < 500ms': (r) => r.timings.duration < 500,
    });

    check(responsesAbertura['templates'], {
      'GET Templates WABA - Status é 200': (r) => r.status === 200,
      'GET Templates WABA - Tempo < 500ms': (r) => r.timings.duration < 500,
    });

    check(responsesAbertura['standardMessages'], {
      'GET Mensagens Padrão - Status é 200': (r) => r.status === 200,
      'GET Mensagens Padrão - Tempo < 400ms': (r) => r.timings.duration < 400,
    });

  });

  sleep(Math.random() * 2 + 1); // Pacing aleatório entre interações dos VUs
}