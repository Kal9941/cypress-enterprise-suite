/**
 * Monta o modelo do relatório (contrato em `scripts/relatorio/MODELO.md`) a partir das execuções lidas.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { sanitizar } = require('./sanitizar');
const { classificarErro } = require('./categorias');
const { extrairRefs } = require('./refs');
const { passosDoTeste } = require('./leitura');
const { montarContagem } = require('./contagem');

const RAIZ = path.join(__dirname, '..', '..', '..');
const LINHAS_TRECHO = 40;
const MAX_CARACTERES_LINHA = 500;
const SEM_AREA = '(sem área)';

function pct(parte, total) {
  return total > 0 ? ((parte / total) * 100).toFixed(2) : '0.00';
}

function nomeSeguro(texto) {
  return String(texto).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}

function tirarPrefixoDoMotivo(texto) {
  return String(texto).replace(/^[\s⏭⏩️]+/, '').trim();
}

// --- erro -----------------------------------------------------------------------------------------------------------------

/** Monta `{categoria, mensagem, trecho}` sem segredos. A "Ação Sugerida" do errorHandler fica de fora (o modelo não tem campo para ela). */
function montarErro(err, arquivoSpec) {
  const categoria = classificarErro(err, arquivoSpec);
  const bruta = sanitizar(err.message || '');
  const idxAcao = bruta.indexOf('💡 Ação Sugerida');
  const idxDetalhe = bruta.indexOf('Detalhe Técnico:');
  const mensagem = (idxAcao >= 0 ? bruta.slice(0, idxAcao) : bruta).trim().slice(0, 1000);
  const partes = [];
  if (idxDetalhe >= 0) partes.push(bruta.slice(idxDetalhe + 'Detalhe Técnico:'.length).trim());
  else if (idxAcao < 0 && bruta.split('\n').length > 1) partes.push(bruta);
  // a pilha do Mocha repete a mensagem inteira antes dos quadros: ficam só as linhas "at …"
  const pilha = sanitizar(err.estack || err.stack || '');
  const quadros = pilha.split('\n').filter((l) => /^\s*at\s/.test(l));
  if (quadros.length) partes.push(quadros.join('\n'));
  else if (pilha.trim() && !partes.length && pilha.trim() !== bruta.trim()) partes.push(pilha.trim());
  const trecho = partes.join('\n\n').split('\n').slice(0, LINHAS_TRECHO)
    .map((l) => (l.length > MAX_CARACTERES_LINHA ? `${l.slice(0, MAX_CARACTERES_LINHA)}…` : l))
    .join('\n');
  return { categoria, mensagem, trecho };
}

// --- pulado por falta de massa --------------------------------------------------------------------------------------------

let constantesCache = new Map();

/** Constantes do spec com texto `⏭️ Sem massa…` (ex.: `const SEM_FINALIZADO = '⏭️ Sem massa: …'`). */
function constantesSemMassa(raiz, arquivoSpec) {
  const chave = `${raiz}|${arquivoSpec}`;
  if (constantesCache.has(chave)) return constantesCache.get(chave);
  const mapa = new Map();
  try {
    const fonte = fs.readFileSync(path.join(raiz, arquivoSpec), 'utf8');
    const re = /const\s+(\w+)\s*=\s*(['"`])((?:(?!\2)[^\n])*Sem massa(?:(?!\2)[^\n])*)\2/g;
    let m;
    while ((m = re.exec(fonte)) !== null) mapa.set(m[1], m[3]);
  } catch (e) { /* sem o fonte do spec (ex.: artefato sem checkout): só passos e título valem */ }
  constantesCache.set(chave, mapa);
  return mapa;
}

/**
 * O teste pendente pulou por falta de massa? Devolve o motivo ou null.
 * Ordem: `motivoPulo` do hook, passo `⏭️ Sem massa…`, título/erro, e por último o código do teste
 * (`cy.log('⏭️ Sem massa…')`, ou a constante `⏭️ Sem massa…` do spec passada a `this.skip()`/`pularSemMassa()`),
 * para quando não há passos.
 */
function motivoDeFaltaDeMassa(teste, passosTeste, raiz, arquivoSpec) {
  if (passosTeste) {
    if (passosTeste.motivoPulo) return tirarPrefixoDoMotivo(passosTeste.motivoPulo);
    const passo = (passosTeste.passos || []).find((p) => /^[\s⏭️]*Sem massa/i.test(String(p.texto || '')));
    if (passo) return tirarPrefixoDoMotivo(passo.texto);
  }
  const msg = teste.erro && teste.erro.message ? String(teste.erro.message) : '';
  const noErro = msg.match(/Sem massa[^\n]*/i);
  if (noErro) return tirarPrefixoDoMotivo(noErro[0]);
  if (/sem massa/i.test(teste.titulo || '')) return tirarPrefixoDoMotivo(teste.titulo);
  const codigo = teste.codigo || '';
  // o teste só chega aqui pendente; precisa chamar skip (direto ou pelo helper `pularSemMassa(this, id, MOTIVO)`)
  if (/\bskip\s*\(|pularSemMassa\s*\(/.test(codigo)) {
    const literal = codigo.match(/cy\.log\(\s*(['"`])([^\n]*?Sem massa[^\n]*?)\1/);
    if (literal) return tirarPrefixoDoMotivo(literal[2]);
    const constantes = constantesSemMassa(raiz, arquivoSpec);
    const usada = [...constantes.keys()].find((nome) => new RegExp(`\\b${nome}\\b`).test(codigo));
    if (usada) return tirarPrefixoDoMotivo(constantes.get(usada));
  }
  return null;
}

// --- anexos ---------------------------------------------------------------------------------------------------------------

/** Grava os anexos do teste vermelho (screenshot em PNG, log em texto) e devolve a lista do modelo. */
function gravarAnexos(teste, idCenario, specId, dirSaida) {
  const anexos = [];
  let n = 0;
  for (const item of teste.anexosBrutos) {
    if (!item || typeof item !== 'object' || item.value === undefined || item.value === null) continue;
    const titulo = sanitizar(String(item.title || 'Anexo'));
    const valor = item.value;
    const imagem = typeof valor === 'string' && valor.match(/^data:image\/([a-z0-9+.-]+);base64,\s*([A-Za-z0-9+/=\s]+)$/i);
    n += 1;
    const base = `${nomeSeguro(idCenario)}${n > 1 ? `-${n}` : ''}`;
    const relativo = `anexos/${nomeSeguro(specId)}/${base}`;
    if (imagem) {
      const ext = imagem[1].toLowerCase().replace('jpeg', 'jpg').replace(/[^a-z0-9]/g, '') || 'png';
      fs.mkdirSync(path.join(dirSaida, 'anexos', nomeSeguro(specId)), { recursive: true });
      fs.writeFileSync(path.join(dirSaida, `${relativo}.${ext}`), Buffer.from(imagem[2].replace(/\s+/g, ''), 'base64'));
      anexos.push({ tipo: 'screenshot', titulo, arquivo: `${relativo}.${ext}` });
    } else if (typeof valor === 'string' && /^https?:\/\//.test(valor) === false) {
      const texto = sanitizar(valor).split('\n').slice(0, 200).join('\n');
      fs.mkdirSync(path.join(dirSaida, 'anexos', nomeSeguro(specId)), { recursive: true });
      fs.writeFileSync(path.join(dirSaida, `${relativo}.txt`), texto, 'utf8');
      anexos.push({ tipo: 'log', titulo, arquivo: `${relativo}.txt` });
    } else if (typeof valor === 'object') {
      const texto = sanitizar(JSON.stringify(valor, null, 2)).split('\n').slice(0, 200).join('\n');
      fs.mkdirSync(path.join(dirSaida, 'anexos', nomeSeguro(specId)), { recursive: true });
      fs.writeFileSync(path.join(dirSaida, `${relativo}.txt`), texto, 'utf8');
      anexos.push({ tipo: 'log', titulo, arquivo: `${relativo}.txt` });
    }
  }
  return anexos;
}

// --- passos ---------------------------------------------------------------------------------------------------------------

/** Passos do modelo, com o status derivado do resultado do teste quando o hook não o grava. */
function montarPassos(passosTeste, status) {
  if (!passosTeste || !Array.isArray(passosTeste.passos)) return [];
  const lista = passosTeste.passos.filter((p) => p && p.texto);
  return lista.map((p, i) => {
    const ultimo = i === lista.length - 1;
    let st = 'passed';
    if (p.status) st = p.status;
    else if (ultimo && status === 'failed') st = 'failed';
    else if (ultimo && (status === 'skipped' || status === 'skippedMassa')) st = 'skipped';
    return {
      texto: sanitizar(String(p.texto)),
      origem: p.origem === 'comando' ? 'comando' : 'cy.log',
      duracaoMs: typeof p.duracaoMs === 'number' ? p.duracaoMs : null,
      status: st,
    };
  });
}

// --- spec -----------------------------------------------------------------------------------------------------------------

function totaisVazios() {
  return { total: 0, passed: 0, failed: 0, skipped: 0, skippedMassa: 0 };
}

function somarTotais(alvo, status) {
  alvo.total += 1;
  alvo[status] += 1;
}

/** Número do context: o mais frequente entre os prefixos `N.M` dos testes; senão o do título do context (nível ≥ 2); senão 0. */
function numeroDoContext(testes, contexto) {
  const contagem = new Map();
  for (const t of testes) {
    const m = (t.titulo || '').match(/^(\d+)\.\d+\b/);
    if (m) contagem.set(Number(m[1]), (contagem.get(Number(m[1])) || 0) + 1);
  }
  if (contagem.size > 0) return [...contagem.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
  const doTitulo = (contexto.titulo || '').match(/^(\d+)\./);
  return doTitulo && contexto.nivel >= 2 ? Number(doTitulo[1]) : 0;
}

function construirSpec(exec, opcoes) {
  const { raiz, dirSaida, passos, areasPorContext, anteriores } = opcoes;
  const arquivo = exec.spec;
  const base = path.basename(arquivo);
  const id = base.replace(/\.cy\.js$/, '');
  const prefixo = id.split('.')[0];

  // agrupa os testes por context (ordem de aparição)
  const grupos = new Map();
  for (const t of exec.testes) {
    if (!grupos.has(t.contexto.uuid)) grupos.set(t.contexto.uuid, { contexto: t.contexto, testes: [] });
    grupos.get(t.contexto.uuid).testes.push(t);
  }

  const spec = {
    id,
    nome: exec.nomeSpec || id,
    arquivo,
    slug: nomeSeguro(id),
    duracaoMs: exec.duracaoMs,
    totais: totaisVazios(),
    contexts: [],
    cenarios: [],
  };
  const idsUsados = new Set();
  const earlier = (anteriores.get(arquivo) || []).slice(); // do mais novo para o mais antigo

  for (const grupo of grupos.values()) {
    const numero = numeroDoContext(grupo.testes, grupo.contexto);
    const areas = areasPorContext.get(`${prefixo}|${numero}`) || [];
    const issues = extrairRefs(grupo.contexto.titulo);
    const nomeContext = grupo.contexto.nivel >= 2
      ? grupo.contexto.titulo.replace(/^\d+\.\s*/, '')
      : grupo.contexto.titulo;
    const totaisContext = totaisVazios();
    let contadorSemPrefixo = 0;

    for (const t of grupo.testes) {
      const prefixoTeste = (t.titulo || '').match(/^(\d+)\.(\d+)\b/);
      let indice;
      if (t.hook) indice = 0;
      else if (prefixoTeste) indice = Number(prefixoTeste[2]);
      else { contadorSemPrefixo += 1; indice = contadorSemPrefixo; }
      const numeroDoId = prefixoTeste ? Number(prefixoTeste[1]) : numero;
      let idCenario = `${prefixo} #${numeroDoId}.${indice}`;
      for (let k = 2; idsUsados.has(idCenario); k++) idCenario = `${prefixo} #${numeroDoId}.${indice} (${k})`;
      idsUsados.add(idCenario);

      const passosTeste = passosDoTeste(passos, arquivo, t.tituloCompleto);
      let status;
      let motivoPulo = null;
      if (t.estado === 'passed') status = 'passed';
      else if (t.estado === 'failed') status = 'failed';
      else {
        motivoPulo = t.estado === 'pending' ? motivoDeFaltaDeMassa(t, passosTeste, raiz, arquivo) : null;
        status = motivoPulo ? 'skippedMassa' : 'skipped';
      }

      // reexecuções vindas de outro diretório (CI): conta tentativas e detecta flaky
      let tentativas = 1;
      let flaky = false;
      for (const anterior of earlier) {
        const igual = anterior.testes.find((x) => x.tituloCompleto === t.tituloCompleto);
        if (!igual) continue;
        tentativas += 1;
        if (tentativas === 2 && status === 'passed' && igual.estado === 'failed') flaky = true;
      }

      const erro = status === 'failed' && t.erro ? montarErro(t.erro, arquivo) : null;
      spec.cenarios.push({
        id: idCenario,
        titulo: sanitizar(t.hook ? `Hook: ${t.titulo}` : t.titulo),
        contexto: numero,
        indice,
        status,
        duracaoMs: t.duracaoMs,
        tentativas,
        flaky,
        issues,
        areas,
        erro: erro || (status === 'failed' ? { categoria: classificarErro({}, arquivo), mensagem: 'Teste falhou sem mensagem de erro registrada.', trecho: '' } : null),
        motivoPulo: motivoPulo ? sanitizar(motivoPulo) : null,
        passos: montarPassos(passosTeste, status),
        anexos: status === 'failed' ? gravarAnexos(t, idCenario, id, dirSaida) : [],
      });
      somarTotais(totaisContext, status);
      somarTotais(spec.totais, status);
    }
    spec.contexts.push({ numero, nome: nomeContext, totais: totaisContext, area: areas.length ? areas.join(' · ') : null, issues });
  }
  return spec;
}

// --- meta -----------------------------------------------------------------------------------------------------------------

function git(raiz, args) {
  try {
    return execFileSync('git', args, { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
  } catch (e) {
    return null;
  }
}

function versaoDoCypress(raiz) {
  try { return require(path.join(raiz, 'node_modules', 'cypress', 'package.json')).version; } catch (e) { /* sem node_modules (CI do painel) */ }
  try {
    const lock = JSON.parse(fs.readFileSync(path.join(raiz, 'package-lock.json'), 'utf8'));
    const v = lock.packages && lock.packages['node_modules/cypress'] && lock.packages['node_modules/cypress'].version;
    if (v) return v;
  } catch (e) { /* segue */ }
  return null;
}

function montarMeta(raiz, opcoes) {
  const env = process.env;
  const ci = !!opcoes.ci || env.GITHUB_ACTIONS === 'true';
  const meta = {
    titulo: 'Relatório de testes · OmniCare Web',
    geradoEm: new Date().toISOString(),
    origem: ci ? 'ci' : 'local',
    branch: ci ? env.GITHUB_REF_NAME || null : git(raiz, ['rev-parse', '--abbrev-ref', 'HEAD']),
    sha: ci ? env.GITHUB_SHA || null : git(raiz, ['rev-parse', 'HEAD']),
    runUrl: ci && env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY && env.GITHUB_RUN_ID
      ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`
      : null,
    cypressVersion: versaoDoCypress(raiz),
    nodeVersion: process.version,
    navegador: opcoes.navegador || null,
    // o CI força USE_MOCKS=true (workflow); local só se o operador informar (flag ou CYPRESS_USE_MOCKS)
    useMocks: typeof opcoes.useMocks === 'boolean' ? opcoes.useMocks : ci ? true : null,
    sessionLabel: opcoes.sessionLabel || null,
  };
  return meta;
}

// --- modelo ---------------------------------------------------------------------------------------------------------------

/**
 * @param {object} entrada
 * @param {Array} entrada.execucoes execuções mais recentes, uma por spec
 * @param {Map<string, Array>} entrada.anteriores spec (arquivo) → execuções mais antigas de outro diretório
 * @param {object} entrada.passos resultado de `lerPassos`
 * @param {Map<string, string[]>} entrada.areasPorContext §10.0
 * @param {string[]} entrada.avisos avisos de leitura (arquivos ignorados etc.)
 * @param {string} entrada.dirSaida
 * @param {object} entrada.opcoes flags da CLI
 */
function montarModelo(entrada) {
  const raiz = entrada.raiz || RAIZ;
  constantesCache = new Map();
  const specs = entrada.execucoes
    .map((exec) => construirSpec(exec, {
      raiz,
      dirSaida: entrada.dirSaida,
      passos: entrada.passos,
      areasPorContext: entrada.areasPorContext,
      anteriores: entrada.anteriores,
    }))
    .sort((a, b) => path.basename(a.arquivo).localeCompare(path.basename(b.arquivo), 'pt', { numeric: true }));

  const resumoTotais = totaisVazios();
  const porCategoria = new Map();
  const porArea = new Map();
  let duracaoMs = 0;
  for (const spec of specs) {
    duracaoMs += spec.duracaoMs;
    for (const k of Object.keys(resumoTotais)) resumoTotais[k] += spec.totais[k];
    for (const c of spec.cenarios) {
      if (c.erro) porCategoria.set(c.erro.categoria, (porCategoria.get(c.erro.categoria) || 0) + 1);
      for (const area of c.areas.length ? c.areas : [SEM_AREA]) {
        if (!porArea.has(area)) porArea.set(area, { area, total: 0, passed: 0, failed: 0, skipped: 0 });
        const a = porArea.get(area);
        a.total += 1;
        // `skipped` das áreas inclui os pulados por falta de massa (o contrato só tem 4 colunas)
        a[c.status === 'skippedMassa' ? 'skipped' : c.status] += 1;
      }
    }
  }

  const contagem = montarContagem(specs, raiz);
  const avisos = [...(entrada.avisos || []), ...contagem.avisos];
  contagem.avisos = avisos;

  const semArea = new Set();
  if (entrada.areasLidas) {
    for (const spec of specs) {
      for (const ctx of spec.contexts) if (!ctx.area) semArea.add(`${spec.id} · ${ctx.numero}`);
    }
    if (semArea.size > 0) {
      const lista = [...semArea];
      avisos.push(`${lista.length} context(s) sem linha na coluna Área do §10.0 do PROJECT_CONTEXT: ${lista.slice(0, 8).join('; ')}${lista.length > 8 ? '…' : ''}.`);
    }
  }

  return {
    meta: montarMeta(raiz, entrada.opcoes || {}),
    resumo: {
      total: resumoTotais.total,
      passed: resumoTotais.passed,
      failed: resumoTotais.failed,
      skipped: resumoTotais.skipped,
      skippedMassa: resumoTotais.skippedMassa,
      duracaoMs,
      percentuais: {
        passed: pct(resumoTotais.passed, resumoTotais.total),
        failed: pct(resumoTotais.failed, resumoTotais.total),
        skipped: pct(resumoTotais.skipped, resumoTotais.total),
        skippedMassa: pct(resumoTotais.skippedMassa, resumoTotais.total),
      },
    },
    specs,
    falhasPorCategoria: [...porCategoria.entries()].map(([categoria, qtd]) => ({ categoria, qtd }))
      .sort((a, b) => b.qtd - a.qtd || a.categoria.localeCompare(b.categoria, 'pt')),
    areas: [...porArea.values()].sort((a, b) => b.total - a.total || a.area.localeCompare(b.area, 'pt')),
    contagem,
  };
}

module.exports = { montarModelo };
