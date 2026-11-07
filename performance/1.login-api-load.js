import http from 'k6/http';
import { check, sleep, group } from 'k6';

// Lê e faz o parse do env.json nativamente no k6
const configEnv = JSON.parse(open('../env.json'));

export const options = {
  stages: [
    { duration: '30s', target: 5 }, // sobe para 5 usuários em 30 segundos
    { duration: '1m',  target: 5 }, // mantém 5 usuários por 1 minuto
    { duration: '15s', target: 0 }, // desce para 0 usuários em 15 segundos
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'], // 95% das requisições devem ser menores que 800ms
    http_req_failed: ['rate<0.01'], // menos de 1% das requisições podem falhar
  },
};

// Função principal do teste de carga
export default function () {
  group('Fluxo de Autenticação - Tela de Login', function () {

    const loginPayload = JSON.stringify({
      cnpj: configEnv.USER_CNPJ,
      username: configEnv.USER_CODE, // Corrigido de 'user' para 'username' conforme exigido pela API
      password: configEnv.USER_PASSWORD,
    });

    const loginParams = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    const resLogin = http.post(`${configEnv.API_URL}/auth/login`, loginPayload, loginParams);

    const loginSuccess = check(resLogin, {
      'Login - Status é 200': (r) => r.status === 200,
      'Login - Retornou Token': (r) => r.json('token') !== undefined || r.json('access_token') !== undefined,
    });

    // Se o login for bem-sucedido, faz uma requisição para /users/me para validar o token
    if (loginSuccess) {
      const token = resLogin.json('token') || resLogin.json('access_token');

      const authParams = {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      };

      const resMe = http.get(`${configEnv.API_URL}/users/me`, authParams);

      check(resMe, {
        'Users Me - Status é 200': (r) => r.status === 200, // Verifica se a requisição para /users/me foi bem-sucedida
      });
    }

  });

  sleep(Math.random() * 2 + 1); // Pausa aleatória entre 1 e 3 segundos para simular comportamento humano
}