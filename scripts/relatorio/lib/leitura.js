/**
 * Leitura das entradas: Mochawesome (`.jsons/*.json`, depois o JSON embutido no HTML, depois JUnit) e passos do hook.
 *
 * Tudo é normalizado para uma "execução" de um spec:
 *   { spec, nomeSpec, fonte, arquivo, dir, timestamp, inicio, fim, duracaoMs, testes: [Teste] }
 *   Teste = { uuid, contexto: {uuid, titulo, nivel}, titulo, tituloCompleto, estado, duracaoMs, erro, anexosBrutos, codigo, hook }
 *   estado: 'passed' | 'failed' | 'pending' | 'skipped'
 */
const fs = require('fs');
const path = require('path');

const RE_DATA = /(\d{2})-(\d{2})-(\d{4})_(\d{2})-(\d{2})-(\d{2})/;

/** Timestamp do nome do arquivo (`28-10-2026_19-30-36`) como número ordenável; 0 se não houver. */
function timestampDoNome(nome) {
  const m = nome.match(RE_DATA);
  if (!m) return 0;
  return Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6]));
}

function listar(dir, extensao) {
  try {
    return fs.readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(extensao))
      .map((f) => path.join(dir, f));
  } catch (e) {
    return [];
  }
}

/** Decodifica as entidades HTML do atributo `data-raw` (nomeadas e numéricas) numa passada só. */
function decodificarEntidades(texto) {
  const nomeadas = { quot: '"', amp: '&', lt: '<', gt: '>', apos: "'", nbsp: ' ' };
  return texto.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (inteiro, corpo) => {
    if (corpo[0] === '#') {
      const codigo = corpo[1].toLowerCase() === 'x' ? parseInt(corpo.slice(2), 16) : parseInt(corpo.slice(1), 10);
      try { return String.fromCodePoint(codigo); } catch (e) { return inteiro; }
    }
    const chave = corpo.toLowerCase();
    return Object.prototype.hasOwnProperty.call(nomeadas, chave) ? nomeadas[chave] : inteiro;
  });
}

/** Extrai e interpreta o JSON do Mochawesome embutido num HTML (`<body data-raw="…">`). */
function lerJsonDoHtml(arquivo) {
  const html = fs.readFileSync(arquivo, 'utf8');
  const inicio = html.indexOf('data-raw="');
  if (inicio < 0) throw new Error('atributo data-raw ausente');
  const comeco = inicio + 'data-raw="'.length;
  const fim = html.indexOf('"', comeco);
  if (fim < 0) throw new Error('atributo data-raw sem fechamento');
  return JSON.parse(decodificarEntidades(html.slice(comeco, fim)));
}

function lerJson(arquivo) {
  return JSON.parse(fs.readFileSync(arquivo, 'utf8'));
}

/** Há erro estruturado no objeto `err` do Mochawesome? (`{}` quando o teste não falhou). */
function temErro(err) {
  return !!err && typeof err === 'object' && Object.keys(err).length > 0 && !!(err.message || err.estack || err.stack);
}

function contextoComoLista(bruto) {
  if (!bruto) return [];
  try {
    const dados = typeof bruto === 'string' ? JSON.parse(bruto) : bruto;
    return Array.isArray(dados) ? dados : [dados];
  } catch (e) {
    return [];
  }
}

function estadoDoTeste(t) {
  if (t.state === 'passed' || t.pass) return 'passed';
  if (t.state === 'failed' || t.fail) return 'failed';
  if (t.pending) return 'pending';
  return 'skipped';
}

/**
 * Normaliza um JSON do Mochawesome (um `results[]` por spec; no CI e no `.jsons` costuma ser um só).
 * @returns {Array} execuções (uma por `results[]` que tenha spec)
 */
function normalizarMochawesome(dados, info) {
  const execucoes = [];
  const resultados = (dados && dados.results) || [];
  for (const raiz of resultados) {
    const testes = [];
    let nomeSpec = null;

    const percorrer = (suite, nivel) => {
      const ehRaiz = !!suite.root;
      if (nivel === 1 && !nomeSpec && suite.title) nomeSpec = suite.title;
      const contexto = { uuid: suite.uuid, titulo: suite.title || '', nivel: ehRaiz ? 0 : nivel };
      for (const t of suite.tests || []) {
        testes.push({
          uuid: t.uuid,
          contexto,
          titulo: t.title,
          tituloCompleto: t.fullTitle || t.title,
          estado: estadoDoTeste(t),
          duracaoMs: t.duration || 0,
          erro: temErro(t.err) ? t.err : null,
          anexosBrutos: contextoComoLista(t.context),
          codigo: typeof t.code === 'string' ? t.code : '',
          hook: false,
        });
      }
      // hook que falhou vira um "teste" vermelho (o Mocha não roda os testes seguintes do bloco)
      for (const h of [].concat(suite.beforeHooks || [], suite.afterHooks || [])) {
        if (h && (h.fail || h.state === 'failed') && temErro(h.err)) {
          testes.push({
            uuid: h.uuid,
            contexto,
            titulo: h.title,
            tituloCompleto: h.fullTitle || h.title,
            estado: 'failed',
            duracaoMs: h.duration || 0,
            erro: h.err,
            anexosBrutos: contextoComoLista(h.context),
            codigo: typeof h.code === 'string' ? h.code : '',
            hook: true,
          });
        }
      }
      for (const filha of suite.suites || []) percorrer(filha, nivel + 1);
    };
    percorrer(raiz, 0);

    const arquivoSpec = raiz.file || raiz.fullFile || '';
    if (!arquivoSpec) continue;
    const stats = dados.stats || {};
    execucoes.push({
      spec: arquivoSpec.replace(/\\/g, '/'),
      nomeSpec,
      fonte: info.fonte,
      arquivo: info.arquivo,
      dir: info.dir,
      timestamp: info.timestamp,
      inicio: resultados.length === 1 ? stats.start || null : null,
      fim: resultados.length === 1 ? stats.end || null : null,
      duracaoMs: resultados.length === 1 && typeof stats.duration === 'number'
        ? stats.duration
        : testes.reduce((s, t) => s + t.duracaoMs, 0),
      testes,
    });
  }
  return execucoes;
}

function atributo(tag, nome) {
  const m = tag.match(new RegExp(`\\s${nome}="([^"]*)"`));
  return m ? decodificarEntidades(m[1]) : '';
}

/** Lê só o início do JUnit para descobrir o spec (atributo `file` do "Root Suite"). */
function especDoJunit(arquivo) {
  const fd = fs.openSync(arquivo, 'r');
  try {
    const buf = Buffer.alloc(4096);
    const n = fs.readSync(fd, buf, 0, 4096, 0);
    const m = buf.toString('utf8', 0, n).match(/<testsuite\s[^>]*\sfile="([^"]+)"/);
    return m ? decodificarEntidades(m[1]).replace(/\\/g, '/') : null;
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Normaliza um JUnit do `mocha-junit-reporter` (fallback sem erro estruturado e sem os testes pulados,
 * que o reporter não grava).
 */
function normalizarJunit(arquivo, info) {
  const xml = fs.readFileSync(arquivo, 'utf8');
  const spec = especDoJunit(arquivo);
  if (!spec) return null;
  const testes = [];
  let nomeSpec = null;
  let contador = 0;
  const reSuite = /<testsuite\s([^>]*)>([\s\S]*?)<\/testsuite>/g;
  let m;
  let indiceSuite = 0;
  while ((m = reSuite.exec(xml)) !== null) {
    indiceSuite += 1;
    const tituloSuite = atributo(`<x ${m[1]}`, 'name');
    if (indiceSuite === 1) continue; // "Root Suite"
    if (!nomeSpec) nomeSpec = tituloSuite; // o describe (nível 1), que pode ter testes próprios
    const contexto = { uuid: `junit-${indiceSuite}`, titulo: tituloSuite, nivel: tituloSuite === nomeSpec ? 1 : 2 };
    const reCase = /<testcase\s([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g;
    let c;
    while ((c = reCase.exec(m[2])) !== null) {
      const corpo = c[2] || '';
      const falha = corpo.match(/<failure\b([^>]*)>([\s\S]*?)<\/failure>|<failure\b([^>]*)\/>/);
      const pulado = /<skipped\b/.test(corpo);
      contador += 1;
      testes.push({
        uuid: `junit-${contador}`,
        contexto,
        titulo: atributo(`<x ${c[1]}`, 'classname') || atributo(`<x ${c[1]}`, 'name'),
        tituloCompleto: atributo(`<x ${c[1]}`, 'name'),
        estado: falha ? 'failed' : pulado ? 'pending' : 'passed',
        duracaoMs: Math.round(parseFloat(atributo(`<x ${c[1]}`, 'time') || '0') * 1000),
        erro: falha
          ? { message: decodificarEntidades(atributo(`<x ${falha[1] || falha[3] || ''}`, 'message')), estack: decodificarEntidades((falha[2] || '').trim()) }
          : null,
        anexosBrutos: [],
        codigo: '',
        hook: false,
      });
    }
  }
  const total = xml.match(/<testsuites\s[^>]*\stime="([\d.]+)"/);
  return {
    spec,
    nomeSpec,
    fonte: 'junit',
    arquivo: info.arquivo,
    dir: info.dir,
    timestamp: info.timestamp,
    inicio: null,
    fim: null,
    duracaoMs: total ? Math.round(parseFloat(total[1]) * 1000) : testes.reduce((s, t) => s + t.duracaoMs, 0),
    testes,
  };
}

/**
 * Descobre os arquivos de cada diretório de entrada. Cada diretório tem o formato de `cypress/reports/`.
 * Para o mesmo spec só fica a execução mais recente (pelo timestamp do nome do arquivo); execuções mais
 * antigas vindas de OUTRO diretório (reexecução baixada de outro artefato do CI) vão em `anteriores`,
 * as do mesmo diretório (histórico local) são ignoradas e contadas em `ignoradas`.
 * @returns {{selecionados: Array, anteriores: Array, junits: Array, ignoradas: number}}
 */
function descobrir(dirs) {
  const candidatos = [];
  const junits = [];
  for (const dir of dirs) {
    for (const f of listar(path.join(dir, 'html', '.jsons'), '.json')) {
      candidatos.push({ fonte: 'json', arquivo: f, dir });
    }
    for (const f of listar(path.join(dir, 'html'), '.html')) {
      candidatos.push({ fonte: 'html', arquivo: f, dir });
    }
    for (const f of listar(path.join(dir, 'junit'), '.xml')) {
      junits.push({ fonte: 'junit', arquivo: f, dir });
    }
  }
  const prioridade = { json: 0, html: 1 };
  // chave do spec: o `[name]` do reportFilename (`…_0-C.html` → `0-C`)
  const chaveDe = (c) => {
    const m = path.basename(c.arquivo).match(/_([^_]+)\.(?:html|json)$/i);
    return m ? m[1] : path.basename(c.arquivo);
  };
  const grupos = new Map();
  for (const c of candidatos) {
    c.timestamp = timestampDoNome(path.basename(c.arquivo));
    const chave = chaveDe(c);
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(c);
  }
  const selecionados = [];
  const anteriores = [];
  let ignoradas = 0;
  for (const lista of grupos.values()) {
    lista.sort((a, b) => b.timestamp - a.timestamp || prioridade[a.fonte] - prioridade[b.fonte]);
    const melhor = lista[0];
    selecionados.push(melhor);
    const vistos = new Set([`${melhor.dir}|${melhor.timestamp}`]);
    for (const c of lista.slice(1)) {
      // o .json e o .html da mesma rodada são o mesmo dado
      if (vistos.has(`${c.dir}|${c.timestamp}`)) continue;
      vistos.add(`${c.dir}|${c.timestamp}`);
      if (c.dir !== melhor.dir) anteriores.push({ ...c, alvo: melhor });
      else ignoradas += 1;
    }
  }
  for (const j of junits) j.timestamp = timestampDoNome(path.basename(j.arquivo));
  return { selecionados, anteriores, junits, ignoradas };
}

function lerExecucoes(candidato) {
  if (candidato.fonte === 'json') return normalizarMochawesome(lerJson(candidato.arquivo), candidato);
  if (candidato.fonte === 'html') return normalizarMochawesome(lerJsonDoHtml(candidato.arquivo), candidato);
  const e = normalizarJunit(candidato.arquivo, candidato);
  return e ? [e] : [];
}

/**
 * Lê os passos gravados pelo hook (`passos/*.json`): `Map` spec → lista (mais nova primeiro) de `Map` título → teste.
 * "Mais nova" é pelo mtime do arquivo, porque o formato do timestamp no nome é do hook.
 */
function lerPassos(dirs) {
  const arquivos = [];
  for (const dir of dirs) {
    for (const f of listar(path.join(dir, 'passos'), '.json')) {
      let mtime = 0;
      try { mtime = fs.statSync(f).mtimeMs; } catch (e) { /* segue com 0 */ }
      arquivos.push({ f, mtime });
    }
  }
  arquivos.sort((a, b) => b.mtime - a.mtime || (a.f < b.f ? 1 : -1));
  const porSpec = new Map();
  const problemas = [];
  for (const { f } of arquivos) {
    let lista;
    try {
      lista = JSON.parse(fs.readFileSync(f, 'utf8'));
    } catch (e) {
      problemas.push(`passos ilegíveis em ${path.basename(f)}: ${e.message}`);
      continue;
    }
    if (!Array.isArray(lista)) continue;
    for (const item of lista) {
      if (!item || !item.spec || !item.titulo) continue;
      const spec = String(item.spec).replace(/\\/g, '/');
      if (!porSpec.has(spec)) porSpec.set(spec, []);
      const camadas = porSpec.get(spec);
      // uma camada por arquivo
      let camada = camadas.find((c) => c.arquivo === f);
      if (!camada) { camada = { arquivo: f, testes: new Map() }; camadas.push(camada); }
      camada.testes.set(item.titulo, item);
    }
  }
  return { porSpec, problemas };
}

/** Passos do teste: o arquivo mais novo do spec que contenha o título. */
function passosDoTeste(passos, spec, tituloCompleto) {
  const camadas = passos.porSpec.get(spec);
  if (!camadas) return null;
  for (const camada of camadas) {
    if (camada.testes.has(tituloCompleto)) return camada.testes.get(tituloCompleto);
  }
  return null;
}

module.exports = { descobrir, lerExecucoes, lerPassos, passosDoTeste, especDoJunit, decodificarEntidades, timestampDoNome };
