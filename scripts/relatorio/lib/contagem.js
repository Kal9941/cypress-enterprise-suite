/**
 * Contagem x docs: `it()` estáticos de cada spec x §1 do PROJECT_CONTEXT x README x testes executados no run.
 * Regra `[R-CONTA]` do AGENTS.md: conta blocos `it(`, `it.only(` e `it.skip(` no começo da linha (nunca
 * `describe`/`context`); um `it()` dentro de `forEach` conta 1, mesmo que gere vários testes em runtime.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..', '..');
const RE_IT = /^ *it(?:\.only|\.skip)?\(/;

/** Conta os `it()` de um arquivo (mesma regra do `grep -cE "^ *it([.]only|[.]skip)?[(]"` do PROJECT_CONTEXT). */
function contarIts(arquivo) {
  const linhas = fs.readFileSync(arquivo, 'utf8').split(/\r?\n/);
  return linhas.filter((l) => RE_IT.test(l)).length;
}

/** `it()` estáticos de todos os `cypress/e2e/*.cy.js`: `Map` nome do arquivo → quantidade. */
function contarSpecs(raiz = RAIZ) {
  const mapa = new Map();
  const dir = path.join(raiz, 'cypress', 'e2e');
  let arquivos = [];
  try { arquivos = fs.readdirSync(dir).filter((f) => f.endsWith('.cy.js')).sort(); } catch (e) { return mapa; }
  for (const f of arquivos) mapa.set(f, contarIts(path.join(dir, f)));
  return mapa;
}

/** Tabela do §1 do PROJECT_CONTEXT: contagem por suíte e Total. */
function lerDocProjectContext(raiz = RAIZ) {
  const out = { porSpec: new Map(), total: null, lido: false };
  let texto;
  try {
    texto = fs.readFileSync(path.join(raiz, '.agents', 'PROJECT_CONTEXT.md'), 'utf8').replace(/\r\n/g, '\n');
  } catch (e) {
    return out;
  }
  for (const linha of texto.split('\n')) {
    const spec = linha.match(/^\|\s*`([^`]+\.cy\.js)`\s*\|\s*(\d+)\s*\|/);
    if (spec && !out.porSpec.has(spec[1])) out.porSpec.set(spec[1], Number(spec[2]));
    const total = linha.match(/^\|\s*\*\*Total\*\*\s*\|\s*\*\*(\d+)\*\*/);
    if (total && out.total === null) out.total = Number(total[1]);
  }
  out.lido = out.porSpec.size > 0;
  return out;
}

/** README: `**N testes automatizados**` e `- **`suíte`** (N)` na lista de cobertura. */
function lerDocReadme(raiz = RAIZ) {
  const out = { porSuite: new Map(), total: null, lido: false };
  let texto;
  try {
    texto = fs.readFileSync(path.join(raiz, 'README.md'), 'utf8').replace(/\r\n/g, '\n');
  } catch (e) {
    return out;
  }
  const total = texto.match(/\*\*(\d+) testes automatizados\*\*/);
  if (total) out.total = Number(total[1]);
  for (const linha of texto.split('\n')) {
    const m = linha.match(/^- \*\*`([^`]+)`\*\*\s*\((\d+)\)/);
    if (m && !out.porSuite.has(m[1])) out.porSuite.set(m[1], Number(m[2]));
  }
  out.lido = out.porSuite.size > 0 || out.total !== null;
  return out;
}

/**
 * Monta o bloco `contagem` do modelo.
 * @param {Array<{arquivo: string, totais: {total: number}}>} specs specs executados (arquivo = `cypress/e2e/X.cy.js`)
 * @param {string} [raiz]
 * @returns {{totalCodigo, totalDocs, totalExecutados, porSpec: Array, avisos: string[]}}
 */
function montarContagem(specs, raiz = RAIZ) {
  const avisos = [];
  const codigo = contarSpecs(raiz);
  const pc = lerDocProjectContext(raiz);
  const readme = lerDocReadme(raiz);
  if (codigo.size === 0) avisos.push('Não foi possível ler cypress/e2e: a contagem de it() do código ficou indisponível.');
  if (!pc.lido) avisos.push('Não foi possível ler a tabela do §1 do .agents/PROJECT_CONTEXT.md: a comparação com o PROJECT_CONTEXT ficou indisponível.');
  if (!readme.lido) avisos.push('Não foi possível ler a lista de cobertura do README.md: a comparação com o README ficou indisponível.');

  const executados = new Map(specs.map((s) => [path.basename(s.arquivo), s]));
  // run completo = todos os specs documentados no §1 foram executados
  const documentados = pc.lido ? [...pc.porSpec.keys()] : [...codigo.keys()];
  const completo = documentados.length > 0 && documentados.every((f) => executados.has(f));
  if (!completo && executados.size > 0) {
    const nomes = [...executados.keys()].join(', ');
    avisos.push(`Run parcial: ${executados.size} de ${documentados.length || codigo.size} specs (${nomes}). A comparação com os docs vale só para esses specs.`);
  }

  const porSpec = [];
  for (const [arquivoSpec, spec] of executados) {
    const suite = arquivoSpec.replace(/\.cy\.js$/, '');
    const nCodigo = codigo.has(arquivoSpec) ? codigo.get(arquivoSpec) : null;
    const nPc = pc.porSpec.has(arquivoSpec) ? pc.porSpec.get(arquivoSpec) : null;
    const nReadme = readme.porSuite.has(suite) ? readme.porSuite.get(suite) : null;
    const nExecutados = spec.totais.total;
    const referencias = [nCodigo, nPc, nReadme].filter((n) => n !== null);
    const ok = referencias.length > 0 && referencias.every((n) => n === referencias[0]);
    porSpec.push({ spec: arquivoSpec, codigo: nCodigo, executados: nExecutados, docProjectContext: nPc, docReadme: nReadme, ok });

    if (nCodigo === null) {
      avisos.push(`${arquivoSpec}: arquivo não encontrado em cypress/e2e (contagem do código indisponível).`);
      continue;
    }
    if (pc.lido && nPc === null) avisos.push(`${arquivoSpec}: não consta na tabela do §1 do PROJECT_CONTEXT.`);
    if (readme.lido && nReadme === null) avisos.push(`${arquivoSpec}: não consta na lista de cobertura do README.`);
    if (nPc !== null && nPc !== nCodigo) avisos.push(`${arquivoSpec}: ${nCodigo} it() no código, mas o §1 do PROJECT_CONTEXT diz ${nPc}.`);
    if (nReadme !== null && nReadme !== nCodigo) avisos.push(`${arquivoSpec}: ${nCodigo} it() no código, mas o README diz ${nReadme}.`);
    if (nExecutados > nCodigo) {
      avisos.push(`${arquivoSpec}: ${nExecutados} testes executados para ${nCodigo} it() no código (it() dentro de forEach gera vários testes, regra [R-CONTA]).`);
    } else if (nExecutados < nCodigo) {
      avisos.push(`${arquivoSpec}: só ${nExecutados} testes executados para ${nCodigo} it() no código (it.only, falha em hook ou execução filtrada).`);
    }
  }

  const somar = (itens, campo) => itens.reduce((s, i) => s + (i[campo] || 0), 0);
  let totalCodigo;
  let totalDocs;
  if (completo) {
    totalCodigo = [...codigo.values()].reduce((s, n) => s + n, 0);
    totalDocs = pc.total;
    if (pc.total !== null && pc.total !== totalCodigo) {
      avisos.push(`Total: ${totalCodigo} it() no código, mas o §1 do PROJECT_CONTEXT diz ${pc.total}.`);
    }
    if (readme.total !== null && readme.total !== totalCodigo) {
      avisos.push(`Total: ${totalCodigo} it() no código, mas o README diz ${readme.total} testes automatizados.`);
    }
    for (const arquivoSpec of codigo.keys()) {
      if (!pc.porSpec.has(arquivoSpec) && pc.lido) avisos.push(`${arquivoSpec}: spec do código fora da tabela do §1 do PROJECT_CONTEXT.`);
    }
  } else {
    totalCodigo = somar(porSpec, 'codigo');
    totalDocs = pc.lido ? somar(porSpec, 'docProjectContext') : null;
  }
  return { totalCodigo, totalDocs, totalExecutados: somar(porSpec, 'executados'), porSpec, avisos };
}

module.exports = { montarContagem, contarIts, contarSpecs, lerDocProjectContext, lerDocReadme };
