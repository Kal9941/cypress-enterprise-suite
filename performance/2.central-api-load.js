import http from 'k6/http';
import { check, sleep, group } from 'k6';

// Lê o arquivo centralizado de environment variables (env.json)
const configEnv = JSON.parse(open('../env.json'));

/**
 * Função utilitária para calcular o dia atual e os últimos 30 dias no formato YYYY-MM-DD
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
    { duration: '30s', target: 10 }, // Ramp-up: sobe até 10 usuários em 30s
    { duration: '1m',  target: 10 }, // Carga constante: mantém 10 usuários por 1m
    { duration: '20s', target: 0  }, // Ramp-down: reduz a 0 usuários em 20s
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // SLA de Performance: 95% < 500ms
    http_req_failed: ['rate<0.01'],   // Taxa de falha < 1%
  },
};

// 1. SETUP: Autentica na API ANTES de iniciar a carga e gera o token dinâmico
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
  
  return { authToken: token };
}

// 2. TESTE DE CARGA (VU Execution)
export default function (data) {
  // Calcula o intervalo de datas dinamicamente para os últimos 30 dias até hoje
  const { startDate, endDate } = obterIntervaloMesAtual();

  const params = {
    headers: {
      'Authorization': `Bearer ${data.authToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };

  group('APIs da Tela Central', function () {

    // 1. Métricas do Dashboard Summary (com datas dinâmicas)
    const resSummary = http.get(
      `${configEnv.API_URL}/attendances/summary?start_date=${startDate}&end_date=${endDate}`,
      params
    );

    check(resSummary, {
      'Summary - Status é 200': (r) => r.status === 200,
      'Summary - Tempo < 300ms': (r) => r.timings.duration < 300,
    });

    // 2. Filas de Atendimento (Simulando o carregamento paralelo das 3 colunas)
    const reqs = {
      'in_progress': {
        method: 'GET',
        url: `${configEnv.API_URL}/attendances?start_date=${startDate}&end_date=${endDate}&page=1&per_page=20&status=in_progress`,
        params: params,
      },
      'pending': {
        method: 'GET',
        url: `${configEnv.API_URL}/attendances?start_date=${startDate}&end_date=${endDate}&page=1&per_page=20&status=pending`,
        params: params,
      },
      'waiting': {
        method: 'GET',
        url: `${configEnv.API_URL}/attendances?start_date=${startDate}&end_date=${endDate}&page=1&per_page=20&status=waiting`,
        params: params,
      },
    };

    const responses = http.batch(reqs);

    check(responses['in_progress'], {
      'Fila Em Andamento - Status é 200': (r) => r.status === 200,
    });

    check(responses['pending'], {
      'Fila Pendente - Status é 200': (r) => r.status === 200,
    });

    check(responses['waiting'], {
      'Fila Aguardando - Status é 200': (r) => r.status === 200,
    });

  });

  sleep(Math.random() * 2 + 1);
}