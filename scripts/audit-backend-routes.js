/**
 * Auditoria de Rotas de Backend (OmniCare Web)
 *
 * Extrai estaticamente todas as rotas mapeadas em cypress/services/backendApiService.js
 * (fonte única de verdade das rotas de backend, per .agents/AGENTS.md), cruza com o uso
 * real nos specs de backend cypress/e2e/0-A/0-B/0-C.backend-*.cy.js para achar métodos órfãos (rota mapeada mas nunca
 * exercitada por nenhum it() ativo) e rotas documentadas como "fantasma"/removidas no
 * próprio JSDoc do service.
 *
 * Modo padrão: 100% estático, sem tocar rede.
 * Modo --live: além da auditoria estática, autentica na API real (env.json) e dispara
 * uma requisição GET leve e somente-leitura para cada rota GET mapeada, comparando o
 * status HTTP retornado agora contra o que está documentado. Rotas de escrita
 * (POST/PUT/PATCH/DELETE) nunca são chamadas ao vivo — permanecem cobertas só pela
 * auditoria estática, para never gerar efeito colateral em produção/homologação.
 *
 * Uso:
 *   node scripts/audit-backend-routes.js          (estático)
 *   npm run audit:routes                          (estático)
 *   node scripts/audit-backend-routes.js --live    (estático + checagem ao vivo)
 *   npm run audit:routes:live                      (estático + checagem ao vivo)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const ROOT = path.join(__dirname, '..');
const SERVICE_PATH = path.join(ROOT, 'cypress', 'services', 'backendApiService.js');
// Os specs de backend (0-A/0-B/0-C, divididos do 0.backend.cy.js em 2026-10-20) são lidos juntos para o cruzamento com o service
const SPEC_PATHS = ['0-A.backend-acesso-cadastros-orcamentos.cy.js', '0-B.backend-atendimentos.cy.js', '0-C.backend-receitas.cy.js', '0-D.backend-automacoes-fluxos-campanhas.cy.js'].map((f) => path.join(ROOT, 'cypress', 'e2e', f));
const REPORT_DIR = path.join(ROOT, 'cypress', 'reports');
const REPORT_PATH = path.join(REPORT_DIR, 'backend-routes-audit.json');
const ENV_PATH = path.join(ROOT, 'env.json');

const LIVE = process.argv.includes('--live');

// Palavras-chave no JSDoc do método que indicam que a rota é intencionalmente
// descontinuada/inexistente e DEVE responder com erro (normalmente 404).
const PALAVRAS_ROTA_FANTASMA = [
  'descontinuada', 'removida', 'inexistente', 'legada', 'fantasma', '404 not found'
];

// -----------------------------------------------------------------------
// PARTE 1: Extração estática de cypress/services/backendApiService.js
// -----------------------------------------------------------------------

function extrairMetodosDoServico(codigo) {
  const metodos = [];
  // Casa blocos de método de classe com 2 espaços de indentação, com JSDoc opcional acima.
  const regex = /(?:\/\*\*([\s\S]*?)\*\/\s*\n)?  (\w+)\(([^)]*)\)\s*\{\n([\s\S]*?)\n  \}\n/g;
  let m;
  while ((m = regex.exec(codigo)) !== null) {
    const [, jsDocBruto, nomeMetodo, params, corpo] = m;
    const jsDoc = (jsDocBruto || '').replace(/^\s*\*\s?/gm, '').trim();

    // Ignora helpers genéricos internos (get/post/put/patch/delete/request/getHeaders/obterIntervaloDatasPadrao)
    if (['request', 'get', 'post', 'put', 'patch', 'delete', 'getHeaders', 'obterIntervaloDatasPadrao', 'autenticar', 'constructor'].includes(nomeMetodo)) {
      continue;
    }

    const rotaMatch = corpo.match(/this\.(get|post|put|patch|delete)\(\s*\n?\s*`([^`]*)`/);
    const usaTask = /cy\.task\(/.test(corpo);

    if (!rotaMatch && !usaTask) {
      continue; // método utilitário sem chamada HTTP direta reconhecível
    }

    const jsDocLower = jsDoc.toLowerCase();
    const fantasma = PALAVRAS_ROTA_FANTASMA.some((p) => jsDocLower.includes(p));
    const prMatches = [...jsDoc.matchAll(/PR\s*#?(\d{3,4})/gi)].map((x) => x[1]);
    const issueMatches = [...jsDoc.matchAll(/Issue\s*#?(\d{3,4})/gi)].map((x) => x[1]);

    metodos.push({
      metodo: nomeMetodo,
      verbo: rotaMatch ? rotaMatch[1].toUpperCase() : 'UPLOAD (cy.task)',
      rota: rotaMatch ? rotaMatch[2] : null,
      jsDoc: jsDoc || null,
      fantasma,
      prsReferenciadas: [...new Set(prMatches)],
      issuesReferenciadas: [...new Set(issueMatches)],
    });
  }
  return metodos;
}

function extrairChamadasNoSpec(codigoSpec, nomesDeMetodos) {
  const contagem = {};
  nomesDeMetodos.forEach((nome) => { contagem[nome] = 0; });

  // Casa qualquer `<algo>.<nomeDoMetodo>(` no spec (api.xxx(, apiSemToken.xxx(, etc.)
  const regex = /\b\w+\.(\w+)\(/g;
  let m;
  while ((m = regex.exec(codigoSpec)) !== null) {
    const nome = m[1];
    if (Object.prototype.hasOwnProperty.call(contagem, nome)) {
      contagem[nome]++;
    }
  }
  return contagem;
}

function auditoriaEstatica() {
  // Normaliza o fim de linha: na cópia de trabalho do Windows os arquivos chegam em CRLF e as regex abaixo casam só LF
  const codigoServico = fs.readFileSync(SERVICE_PATH, 'utf-8').replace(/\r\n/g, '\n');
  const codigoSpec = SPEC_PATHS.map((f) => fs.readFileSync(f, 'utf-8').replace(/\r\n/g, '\n')).join('\n');

  const metodos = extrairMetodosDoServico(codigoServico);
  const contagemUso = extrairChamadasNoSpec(codigoSpec, metodos.map((m) => m.metodo));

  const orfaos = [];
  const fantasmasSemTeste = [];
  const fantasmasComTeste = [];

  metodos.forEach((m) => {
    m.chamadasNoSpec = contagemUso[m.metodo] || 0;
    if (m.chamadasNoSpec === 0) {
      orfaos.push(m);
      if (m.fantasma) fantasmasSemTeste.push(m);
    } else if (m.fantasma) {
      fantasmasComTeste.push(m);
    }
  });

  return { metodos, orfaos, fantasmasSemTeste, fantasmasComTeste };
}

// -----------------------------------------------------------------------
// PARTE 2 (opcional, --live): checagem ao vivo contra a API real
// -----------------------------------------------------------------------

// Valores de amostra para variáveis de path — cobrem o caso feliz de "a rota existe e
// aplica regra de negócio", não a existência de um recurso específico.
const AMOSTRAS_PATH = {
  storeId: '1',
  attendanceId: '1',
  clientId: '1',
  prescriptionId: '1',
  formulaId: '1',
  processId: '1',
  attendantId: '1',
  documentId: '1',
  financialId: '1',
  budgetCode: '1',
  phoneId: '1',
  addressId: '1',
};

// Query strings obrigatórias/necessárias para algumas rotas específicas não travarem
// em 400/422 por ausência de parâmetro (mirror dos defaults já usados no próprio
// backendApiService.js), indexadas pelo template de rota original.
const QUERY_POR_ROTA = {
  '/channel-groups': { channel_id: '6' },
  '/products': { usage: 'human' },
  '/neighborhoods': { city_id: '1' },
  '/clients': { q: 'a' },
  '/attendances': { start_date: dataDeDiasAtras(30), end_date: dataDeDiasAtras(0) },
  '/attendances/summary': { start_date: dataDeDiasAtras(30), end_date: dataDeDiasAtras(0) },
  '/authorization-requests': { role: 'requester' },
};

function dataDeDiasAtras(dias) {
  const d = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function montarUrlConcreta(apiUrl, rotaTemplate) {
  const caminhoConcreto = rotaTemplate.replace(/\$\{(\w+)\}/g, (_, nome) => AMOSTRAS_PATH[nome] || '1');
  const query = QUERY_POR_ROTA[rotaTemplate];
  const qs = query ? '?' + new URLSearchParams(query).toString() : '';
  return `${apiUrl}${caminhoConcreto}${qs}`;
}

function requisicaoHttp(urlStr, { method = 'GET', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const client = parsed.protocol === 'https:' ? https : http;
    const payload = body ? JSON.stringify(body) : null;

    const req = client.request(urlStr, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers,
      },
    }, (res) => {
      let data = '';
      res.setEncoding('utf-8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });

    req.on('error', (err) => resolve({ status: 0, error: err.message }));
    req.setTimeout(10000, () => {
      req.destroy();
      resolve({ status: 0, error: 'timeout (10s)' });
    });

    if (payload) req.write(payload);
    req.end();
  });
}

function classificarResposta(resp) {
  if (resp.status === 0) {
    return { classe: 'ERRO_DE_REDE', detalhe: resp.error };
  }
  let corpoJson = null;
  try { corpoJson = JSON.parse(resp.body); } catch (e) { /* corpo não é JSON */ }

  if (resp.status >= 200 && resp.status < 300) {
    return { classe: 'OK', detalhe: `HTTP ${resp.status}` };
  }
  if ([401, 403, 422].includes(resp.status)) {
    return { classe: 'ROTA_RECONHECIDA_REGRA_DE_NEGOCIO', detalhe: `HTTP ${resp.status} (rota existe, backend aplicou validação/permissão)` };
  }
  if (resp.status === 404) {
    if (corpoJson && (corpoJson.code || corpoJson.message)) {
      return { classe: 'ROTA_RECONHECIDA_404_NEGOCIO', detalhe: `HTTP 404 com corpo JSON estruturado (${corpoJson.code || corpoJson.message})` };
    }
    return { classe: 'ROTA_POSSIVELMENTE_INVALIDA', detalhe: 'HTTP 404 sem corpo JSON estruturado — pode ser 404 de roteamento (rota não existe) em vez de negócio' };
  }
  if (resp.status === 405) {
    return { classe: 'ROTA_POSSIVELMENTE_INVALIDA', detalhe: 'HTTP 405 Method Not Allowed — verbo pode ter mudado' };
  }
  return { classe: 'INESPERADO', detalhe: `HTTP ${resp.status}` };
}

async function autenticar(apiUrl) {
  const env = JSON.parse(fs.readFileSync(ENV_PATH, 'utf-8'));
  const resp = await requisicaoHttp(`${apiUrl}/auth/login`, {
    method: 'POST',
    body: {
      cnpj: env.USER_CNPJ,
      username: env.USER_CODE,
      password: env.USER_PASSWORD,
    },
  });
  if (resp.status !== 200) {
    throw new Error(`Falha ao autenticar na API real para checagem ao vivo (HTTP ${resp.status}). Abortando modo --live.`);
  }
  const body = JSON.parse(resp.body);
  return body.token || body.access_token;
}

async function checagemAoVivo(metodosGet) {
  const env = JSON.parse(fs.readFileSync(ENV_PATH, 'utf-8'));
  const apiUrl = env.API_URL || 'https://api.omnicare.dev.local';

  console.log(`\n🌐 Autenticando em ${apiUrl} para checagem ao vivo...`);
  const token = await autenticar(apiUrl);
  console.log('✓ Autenticado.\n');

  const resultados = [];
  for (const m of metodosGet) {
    const urlConcreta = montarUrlConcreta(apiUrl, m.rota);
    process.stdout.write(` [GET] ${m.rota} ... `);
    const resp = await requisicaoHttp(urlConcreta, { headers: { Authorization: `Bearer ${token}` } });
    const classificacao = classificarResposta(resp);
    const conflitaComEsperado = m.fantasma
      ? classificacao.classe !== 'ROTA_RECONHECIDA_404_NEGOCIO' && classificacao.classe !== 'ROTA_POSSIVELMENTE_INVALIDA'
      : classificacao.classe === 'ROTA_POSSIVELMENTE_INVALIDA' || classificacao.classe === 'ERRO_DE_REDE';

    console.log(`${classificacao.classe} — ${classificacao.detalhe}`);
    resultados.push({ ...m, urlConcreta, statusAoVivo: resp.status, classificacao: classificacao.classe, detalheClassificacao: classificacao.detalhe, conflitaComEsperado });
  }
  return resultados;
}

// -----------------------------------------------------------------------
// Execução
// -----------------------------------------------------------------------

async function run() {
  console.log('===============================================================');
  console.log('🧭 AUDITORIA DE ROTAS DE BACKEND (OmniCare Web)');
  console.log('===============================================================');

  const { metodos, orfaos, fantasmasSemTeste, fantasmasComTeste } = auditoriaEstatica();

  console.log(`📦 ${metodos.length} métodos/rotas mapeados em cypress/services/backendApiService.js`);
  console.log(`🧪 Cross-referenciado contra os specs de backend cypress/e2e/0-A/0-B/0-C.backend-*.cy.js\n`);

  console.log('--- Rotas "fantasma" documentadas (esperado retornar erro/404) ---');
  if (fantasmasComTeste.length === 0 && fantasmasSemTeste.length === 0) {
    console.log('  Nenhuma rota fantasma documentada encontrada.');
  } else {
    fantasmasComTeste.forEach((m) => console.log(`  ✓ ${m.metodo} — ${m.verbo} ${m.rota} (testada)`));
    fantasmasSemTeste.forEach((m) => console.log(`  ⚠️  ${m.metodo} — ${m.verbo} ${m.rota} (documentada como fantasma mas SEM teste chamando-a)`));
  }

  console.log('\n--- Métodos órfãos (mapeados no service, sem nenhuma chamada nos specs de backend (0-A/0-B/0-C)) ---');
  const orfaosNaoFantasma = orfaos.filter((m) => !m.fantasma);
  if (orfaosNaoFantasma.length === 0) {
    console.log('  🟢 Nenhum método órfão — todo método mapeado é exercitado por pelo menos 1 teste.');
  } else {
    orfaosNaoFantasma.forEach((m) => {
      console.log(`  ⚠️  ${m.metodo} — ${m.verbo} ${m.rota}`);
      if (m.jsDoc) console.log(`      ${m.jsDoc.split('\n')[0]}`);
    });
    console.log('\n  Possíveis causas: teste removido sem limpar o método; método novo ainda não coberto; ou funcionalidade descontinuada e o JSDoc não foi atualizado para indicar isso.');
  }

  let resultadoLive = null;
  if (LIVE) {
    const metodosGet = metodos.filter((m) => m.verbo === 'GET' && m.rota);
    resultadoLive = await checagemAoVivo(metodosGet);

    const suspeitas = resultadoLive.filter((r) => r.conflitaComEsperado);
    console.log('\n--- Resultado da checagem ao vivo ---');
    console.log(`  ${metodosGet.length} rotas GET checadas contra a API real.`);
    if (suspeitas.length === 0) {
      console.log('  🟢 Nenhuma rota GET com resposta inconsistente em relação ao documentado.');
    } else {
      console.log(`  🚨 ${suspeitas.length} rota(s) com resposta que diverge do documentado:`);
      suspeitas.forEach((s) => {
        console.log(`     - ${s.metodo} (${s.rota}): ${s.classificacao} — ${s.detalheClassificacao}`);
      });
    }
  } else {
    console.log('\n💡 Rode com --live (ou "npm run audit:routes:live") para checar as rotas GET contra a API real agora.');
  }

  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify({
    ultimaAtualizacao: new Date().toISOString(),
    totalMetodos: metodos.length,
    fantasmasComTeste: fantasmasComTeste.map((m) => m.metodo),
    fantasmasSemTeste: fantasmasSemTeste.map((m) => m.metodo),
    orfaos: orfaosNaoFantasma.map((m) => m.metodo),
    metodos,
    checagemAoVivo: resultadoLive,
  }, null, 2), 'utf-8');

  console.log(`\n📁 Relatório completo salvo em cypress/reports/backend-routes-audit.json`);
  console.log('===============================================================\n');
}

run().catch((err) => {
  console.error('Erro inesperado durante a auditoria:', err);
  process.exit(1);
});
