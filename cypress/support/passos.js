// Passos de cada teste para o relatório próprio (scripts/relatorio/, contrato em scripts/relatorio/MODELO.md).
//
// O que grava: por teste, a lista de passos executados no CORPO do teste, em `cypress/reports/passos/<spec>.<timestamp>.json`.
//   - origem "cy.log": todo `cy.log` do teste (é o roteiro escrito por quem criou o teste).
//   - origem "comando": fallback, só quando o teste não tem nenhum `cy.log`. Resumo curto de request, visit, click,
//     type, select, check, intercept e wait @alias (ex.: `request GET /resales/261000819 → 200`).
//   - motivoPulo: texto do `cy.log` que começa com "⏭️ Sem massa", quando o teste termina pulado (this.skip()).
//
// FAIL-SAFE (exigência nº 1): nada aqui pode alterar o resultado, a ordem ou a duração dos testes.
//   - Captura passiva por eventos (`command:*`), sem comandos do Cypress, sem cy.wait, sem rede.
//   - O `afterEach` só empilha o registro em memória (JS puro, tudo em try/catch). O único comando do Cypress é UM
//     `cy.task` por spec, num `after()` na raiz, e a task Node nunca lança erro (ver `gravarPassos` em cypress.config.js).
//   - Por que `afterEach` e não `test:after:run`: o Cypress adia o `test:after:run` do ÚLTIMO teste do arquivo para depois
//     dos hooks `after`, então o último teste ficaria fora do arquivo. O `afterEach` roda inclusive para teste pulado com
//     this.skip() (state "pending") e para teste que falhou.
//
// Filtro de ruído (só vale o que é do corpo do teste):
//   1. `Cypress.state('runnable').type === 'test'`: comandos de `before`/`beforeEach`/`afterEach`/`after` (inclusive os
//      globais de e2e.js, com screenshot e failures.log) ficam de fora.
//   2. Comando enfileirado DENTRO de um comando personalizado (Cypress.Commands.add, cy.session…) é do suporte e fica de
//      fora; o `then`/`within`/`each` do teste não conta como suporte (o cy.log dentro de um `.then` do teste é passo).
// Limitações: um `cy.log` de hook local do spec (beforeEach do próprio arquivo) não vira passo; um comando
// personalizado definido DENTRO de um spec também é tratado como suporte. Se o Cypress mudar o estado interno
// (`Cypress.state`), a captura simplesmente para (sem erro).

const MAX_PASSOS = 200; // por teste, e por origem
const MAX_TEXTO = 200; // caracteres por passo
const MAX_MOTIVO = 300;

// Comandos que executam callback com código do próprio teste: o que eles enfileiram continua sendo corpo do teste.
const COM_CALLBACK_DO_TESTE = new Set(['then', 'within', 'each', 'spread', 'origin']);
// Comandos que viram passo de fallback.
const COMANDOS_PASSO = new Set([
  'visit', 'reload', 'request', 'click', 'dblclick', 'rightclick', 'type', 'clear',
  'check', 'uncheck', 'select', 'selectFile', 'intercept', 'wait',
]);
// Comandos de ação sobre elemento: o seletor vem do `get`/`find`/`contains` anterior da cadeia.
const COMANDOS_COM_ALVO = new Set(['click', 'dblclick', 'rightclick', 'type', 'clear', 'check', 'uncheck', 'select', 'selectFile']);

let testeAtual = null; // { logs: [], comandos: [], ruido: Set, emExecucao: cmd|null }
let registros = []; // testes finalizados deste spec, na ordem de execução
let segredos = null;

const novoTeste = () => ({ logs: [], comandos: [], ruido: new Set(), emExecucao: null, porId: new Map() });

// ---------------------------------------------------------------------------
// Higienização: nenhum segredo vai para o arquivo (token, senha, CNPJ, usuário, CPF/telefone).
// ---------------------------------------------------------------------------
const carregarSegredos = () => {
  if (segredos) return segredos;
  segredos = [];
  try {
    ['userCnpj', 'user', 'userPassword', 'USER_CNPJ', 'USER_CODE', 'USER_PASSWORD', 'backendAuthToken'].forEach((chave) => {
      const valor = Cypress.env(chave);
      // Valores curtos (ex.: "122") corromperiam ids legítimos do texto; esses casos caem nos padrões numéricos abaixo.
      if (typeof valor === 'string' && valor.length >= 6) segredos.push(valor);
    });
  } catch (e) { /* sem env: só os padrões */ }
  return segredos;
};

const limpar = (valor, max = MAX_TEXTO) => {
  let texto = typeof valor === 'string' ? valor : String(valor);
  carregarSegredos().forEach((s) => { texto = texto.split(s).join('***'); });
  texto = texto
    .replace(/eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g, '***')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer ***')
    .replace(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, '***') // CNPJ formatado
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '***') // CPF formatado
    .replace(/(?<!\d)(\d{11}|\d{14})(?!\d)/g, '***') // CPF/telefone/CNPJ só com dígitos
    .replace(/\s+/g, ' ')
    .trim();
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
};

const aTexto = (v) => {
  if (typeof v === 'string') return v;
  if (v instanceof RegExp) return v.toString();
  try { return JSON.stringify(v); } catch (e) { return String(v); }
};

// Só o caminho da URL (sem origem, query nem fragmento): a query pode carregar dado pessoal.
const caminho = (url) => {
  const bruto = aTexto(url == null ? '' : url);
  try {
    return new URL(bruto, Cypress.config('baseUrl') || 'http://localhost').pathname;
  } catch (e) {
    return bruto.replace(/^https?:\/\/[^/]+/i, '').split(/[?#]/)[0];
  }
};

// ---------------------------------------------------------------------------
// Texto de cada comando
// ---------------------------------------------------------------------------
const alvoDaCadeia = (cmd) => {
  try {
    let anterior = cmd.get('prev');
    for (let i = 0; anterior && i < 8; i += 1, anterior = anterior.get('prev')) {
      const nome = anterior.get('name');
      const args = anterior.get('args') || [];
      if (nome === 'get' || nome === 'find') return aTexto(args[0]);
      if (nome === 'contains') {
        const textos = args.filter((a) => typeof a === 'string' || a instanceof RegExp);
        return `contains ${aTexto(textos[textos.length - 1])}`;
      }
    }
  } catch (e) { /* sem alvo */ }
  return '';
};

const descreverRequest = (args) => {
  let metodo = 'GET';
  let url = '';
  const a0 = args[0];
  if (a0 && typeof a0 === 'object') {
    metodo = a0.method || 'GET';
    url = a0.url || '';
  } else if (typeof args[1] === 'string' && /^[A-Za-z]+$/.test(a0)) {
    metodo = a0;
    url = args[1];
  } else {
    url = a0;
  }
  return `request ${String(metodo).toUpperCase()} ${caminho(url)}`;
};

const descreverIntercept = (args) => {
  const a0 = args[0];
  const a1 = args[1];
  let metodo = 'ANY';
  let url = '';
  if (a0 && typeof a0 === 'object' && !(a0 instanceof RegExp)) {
    metodo = a0.method || 'ANY';
    url = a0.url || a0.pathname || '';
  } else if (typeof a0 === 'string' && /^[A-Za-z]{3,7}$/.test(a0) && (typeof a1 === 'string' || a1 instanceof RegExp)) {
    metodo = a0;
    url = a1;
  } else {
    url = a0;
  }
  return `intercept ${String(metodo).toUpperCase()} ${aTexto(url).replace(/^https?:\/\/[^/]+/i, '')}`;
};

// Devolve o texto do passo de fallback, ou null quando o comando não vira passo.
const descreverComando = (cmd) => {
  const nome = cmd.get('name');
  const args = cmd.get('args') || [];
  if (nome === 'request') return descreverRequest(args);
  if (nome === 'visit') {
    const a0 = args[0];
    return `visit ${caminho(a0 && typeof a0 === 'object' ? a0.url : a0)}`;
  }
  if (nome === 'reload') return 'reload';
  if (nome === 'intercept') return descreverIntercept(args);
  if (nome === 'wait') return (typeof args[0] === 'string' && args[0].startsWith('@')) ? `wait ${args[0]}` : null;
  if (COMANDOS_COM_ALVO.has(nome)) {
    const alvo = alvoDaCadeia(cmd);
    // O texto digitado fica de fora (pode ser senha ou dado pessoal); do select vai só o rótulo da opção.
    if (nome === 'select' && typeof args[0] === 'string') return `select ${alvo} = "${args[0]}"`.replace('  ', ' ');
    return alvo ? `${nome} ${alvo}` : nome;
  }
  return null;
};

// Complementa o passo com o resultado quando o comando termina (status da resposta).
const completarComStatus = (nome, passo, cmd) => {
  try {
    const sujeito = cmd.get('subject');
    if (nome === 'request' && sujeito && typeof sujeito.status === 'number') {
      passo.texto = limpar(`${passo.texto} → ${sujeito.status}`);
    } else if (nome === 'wait') {
      const lista = Array.isArray(sujeito) ? sujeito : [sujeito];
      const ultimo = lista[lista.length - 1];
      const status = ultimo && ultimo.response && ultimo.response.statusCode;
      if (typeof status === 'number') passo.texto = limpar(`${passo.texto} → ${status}`);
    }
  } catch (e) { /* mantém o texto sem status */ }
};

// ---------------------------------------------------------------------------
// Captura por eventos do Cypress (passiva: nenhum comando é enfileirado aqui)
// ---------------------------------------------------------------------------
const ehDoCorpoDoTeste = () => {
  const runnable = Cypress.state('runnable');
  return !!runnable && runnable.type === 'test';
};

if (typeof Cypress !== 'undefined') {
  // Cada tentativa (inclusive retry) começa com buffers limpos.
  Cypress.on('test:before:run', () => {
    try { testeAtual = novoTeste(); } catch (e) { testeAtual = null; }
  });

  // Marca como suporte o comando enfileirado enquanto um comando personalizado/session está executando.
  Cypress.on('command:enqueued', (attrs) => {
    try {
      const t = testeAtual;
      if (!t || !t.emExecucao) return;
      const pai = t.emExecucao;
      if (!COM_CALLBACK_DO_TESTE.has(pai.get('name')) || t.ruido.has(pai.get('id'))) t.ruido.add(attrs.id);
    } catch (e) { /* ignora */ }
  });

  Cypress.on('command:start', (cmd) => {
    try {
      const t = testeAtual;
      if (!t) return;
      t.emExecucao = cmd;
      if (!ehDoCorpoDoTeste() || t.ruido.has(cmd.get('id'))) return;
      const nome = cmd.get('name');
      const inicio = Date.now();
      if (nome === 'log') {
        if (t.logs.length >= MAX_PASSOS) return;
        const args = cmd.get('args') || [];
        const passo = { texto: limpar(args.map(aTexto).join(' ')), origem: 'cy.log', duracaoMs: null, _inicio: inicio };
        t.logs.push(passo);
        t.porId.set(cmd.get('id'), passo);
      } else if (COMANDOS_PASSO.has(nome) && t.comandos.length < MAX_PASSOS) {
        const texto = descreverComando(cmd);
        if (!texto) return;
        const passo = { texto: limpar(texto), origem: 'comando', duracaoMs: null, _inicio: inicio };
        t.comandos.push(passo);
        t.porId.set(cmd.get('id'), passo);
      }
    } catch (e) { /* nunca interfere no teste */ }
  });

  Cypress.on('command:end', (cmd) => {
    try {
      const t = testeAtual;
      if (!t) return;
      t.emExecucao = null;
      const passo = t.porId.get(cmd.get('id'));
      if (!passo) return;
      passo.duracaoMs = Math.max(0, Date.now() - passo._inicio);
      completarComStatus(cmd.get('name'), passo, cmd);
    } catch (e) { /* ignora */ }
  });

  // Comando que falhou (ex.: cy.request com status 4xx/5xx): fecha o passo marcando o erro.
  Cypress.on('command:failed', (cmd, err) => {
    try {
      const t = testeAtual;
      if (!t) return;
      t.emExecucao = null;
      const passo = t.porId.get(cmd.get('id'));
      if (!passo) return;
      passo.duracaoMs = Math.max(0, Date.now() - passo._inicio);
      if (passo.origem === 'comando') {
        const status = /(?:^|\D)([1-5]\d{2}):\s/.exec(String((err && err.message) || ''));
        passo.texto = limpar(`${passo.texto} → ${status ? status[1] : 'falhou'}`);
      }
    } catch (e) { /* ignora */ }
  });
}

// Fecha o teste: sem nenhum cy.log, vale o fallback de comandos. Roda em JS puro, sem comandos do Cypress.
afterEach(function () {
  try {
    const t = testeAtual;
    const teste = this.currentTest;
    testeAtual = null;
    if (!t || !teste) return;

    const usaLogs = t.logs.length > 0;
    const passos = (usaLogs ? t.logs : t.comandos).map(({ texto, origem, duracaoMs }) => ({ texto, origem, duracaoMs }));

    let motivoPulo = null;
    const pulado = teste.state === 'pending' || (typeof teste.isPending === 'function' && teste.isPending());
    if (pulado) {
      const sem = t.logs.filter((p) => p.texto.startsWith('⏭️ Sem massa'));
      if (sem.length) motivoPulo = limpar(sem[sem.length - 1].texto, MAX_MOTIVO);
    }
    // Teste sem passo também entra (passos: []): o gerador casa por título e sabe que o teste rodou sem roteiro.

    const spec = String((Cypress.spec && Cypress.spec.relative) || teste.file || '').replace(/\\/g, '/');
    const titulo = typeof teste.fullTitle === 'function' ? teste.fullTitle() : (teste.titlePath ? teste.titlePath().join(' ') : teste.title);
    // Retry: a última tentativa substitui a anterior do mesmo teste.
    registros = registros.filter((r) => r.titulo !== titulo);
    registros.push({ spec, titulo: limpar(titulo, 400), passos, motivoPulo });
  } catch (e) {
    // nunca falha o teste por causa do relatório
    try { console.warn('[passos] registro ignorado:', e && e.message); } catch (e2) { /* nada */ }
  }
});

// Um único cy.task por spec, depois do último teste. Falha de gravação é engolida na task Node.
after(() => {
  try {
    if (registros.length === 0) return;
    const spec = registros[0].spec;
    const testes = registros;
    registros = [];
    cy.task('gravarPassos', { spec, testes }, { log: false, timeout: 15000 });
  } catch (e) {
    try { console.warn('[passos] gravação ignorada:', e && e.message); } catch (e2) { /* nada */ }
  }
});
