#!/usr/bin/env node
/**
 * Gerador de dados do relatório de testes (OmniCare Web).
 *
 * Lê o Mochawesome (`.jsons`, depois o JSON embutido no HTML, depois o JUnit), os passos gravados pelo hook,
 * classifica as falhas, liga cada context às issues/PRs e à área, confere a contagem com os docs e grava
 * `<saida>/modelo.json` (contrato em `scripts/relatorio/MODELO.md`). Em seguida chama `template/renderizar.js`
 * (do agente do template), se ele existir, para montar o site estático.
 *
 * Uso:
 *   node scripts/relatorio/gerar-relatorio.js [--entrada <dir>[,<dir>…]] [--saida <dir>] [--ci]
 *        [--use-mocks true|false] [--session-label <rótulo>] [--navegador <nome>[:<versão>]]
 *
 * Cada `--entrada` é uma pasta no formato de `cypress/reports/` (com `html/`, `junit/` e, opcionalmente, `passos/`).
 * No CI vêm vários diretórios, um por spec (artefatos baixados). Padrão: entrada `cypress/reports`, saída `cypress/reports/painel`.
 * Só módulos nativos do Node (sem `npm ci`).
 */
const fs = require('fs');
const path = require('path');
const { descobrir, lerExecucoes, lerPassos, especDoJunit } = require('./lib/leitura');
const { lerAreasDoIndice } = require('./lib/refs');
const { montarModelo } = require('./lib/modelo');

const RAIZ = path.join(__dirname, '..', '..');

function lerArgumentos(argv) {
  const args = { entradas: [], saida: null, ci: false, useMocks: undefined, sessionLabel: null, navegador: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const proximo = () => {
      if (i + 1 >= argv.length) throw new Error(`o argumento ${a} precisa de um valor`);
      i += 1;
      return argv[i];
    };
    if (a === '--entrada') args.entradas.push(...proximo().split(',').map((s) => s.trim()).filter(Boolean));
    else if (a === '--saida') args.saida = proximo();
    else if (a === '--ci') args.ci = true;
    else if (a === '--use-mocks') args.useMocks = proximo() === 'true';
    else if (a === '--session-label') args.sessionLabel = proximo();
    else if (a === '--navegador') {
      const [nome, versao] = proximo().split(':');
      args.navegador = { nome, versao: versao || '' };
    } else if (a === '--ajuda' || a === '-h' || a === '--help') args.ajuda = true;
    else throw new Error(`argumento desconhecido: ${a}`);
  }
  return args;
}

function resolver(p) {
  return path.resolve(p.replace(/[\\/]+$/, '') || p);
}

function main() {
  const args = lerArgumentos(process.argv.slice(2));
  if (args.ajuda) {
    console.log('Uso: node scripts/relatorio/gerar-relatorio.js [--entrada <dir>[,<dir>…]] [--saida <dir>] [--ci] [--use-mocks true|false] [--session-label <rótulo>] [--navegador <nome>[:<versão>]]');
    return 0;
  }
  const entradas = (args.entradas.length ? args.entradas : [path.join(RAIZ, 'cypress', 'reports')]).map(resolver);
  const dirSaida = resolver(args.saida || path.join(RAIZ, 'cypress', 'reports', 'painel'));
  if (args.useMocks === undefined && process.env.CYPRESS_USE_MOCKS) args.useMocks = process.env.CYPRESS_USE_MOCKS === 'true';
  if (!args.sessionLabel && process.env.CYPRESS_SESSION_LABEL) args.sessionLabel = process.env.CYPRESS_SESSION_LABEL;

  const avisos = [];
  for (const dir of entradas) {
    if (!fs.existsSync(dir)) avisos.push(`Diretório de entrada inexistente, ignorado: ${dir}`);
  }

  // Só no padrão (varredura de cypress/reports, que acumula histórico local): relatórios de spec renomeado, dividido
  // ou apagado ficam de fora, pois só valem os specs que existem hoje em cypress/e2e. Com --entrada explícita
  // (artefatos do CI) nada é filtrado.
  let existentes = null;
  if (args.entradas.length === 0) {
    try {
      const lista = fs.readdirSync(path.join(RAIZ, 'cypress', 'e2e')).filter((f) => f.endsWith('.cy.js'));
      if (lista.length) existentes = new Set(lista);
    } catch (e) { /* sem cypress/e2e: nada é filtrado */ }
  }
  const especExiste = (spec) => !existentes || existentes.has(path.basename(spec));
  const obsoletos = new Set();

  // 1. descobre e lê (a execução mais recente de cada spec)
  const { selecionados, anteriores: candidatosAnteriores, junits, ignoradas } = descobrir(entradas);
  const execucoes = [];
  for (const candidato of selecionados) {
    try {
      for (const exec of lerExecucoes(candidato)) {
        if (especExiste(exec.spec)) execucoes.push(exec);
        else obsoletos.add(path.basename(exec.spec));
      }
    } catch (e) {
      avisos.push(`Falha ao ler ${path.basename(candidato.arquivo)} (${candidato.fonte}): ${e.message}`);
    }
  }
  if (ignoradas > 0) avisos.push(`${ignoradas} relatório(s) antigo(s) do mesmo spec ignorado(s): vale só a execução mais recente de cada um.`);

  // 2. JUnit como último recurso: só para spec que o Mochawesome não cobriu
  const cobertos = new Set(execucoes.map((e) => e.spec));
  const junitPorSpec = new Map();
  for (const j of junits) {
    let spec = null;
    try { spec = especDoJunit(j.arquivo); } catch (e) { /* arquivo ilegível: ignora */ }
    if (!spec || cobertos.has(spec)) continue;
    if (!especExiste(spec)) { obsoletos.add(path.basename(spec)); continue; }
    const atual = junitPorSpec.get(spec);
    if (!atual || j.timestamp > atual.timestamp) junitPorSpec.set(spec, j);
  }
  const soJunit = [];
  for (const [spec, j] of junitPorSpec) {
    try {
      execucoes.push(...lerExecucoes(j));
      soJunit.push(path.basename(spec));
    } catch (e) {
      avisos.push(`Falha ao ler ${path.basename(j.arquivo)} (junit): ${e.message}`);
    }
  }
  if (soJunit.length) avisos.push(`Só havia JUnit (sem Mochawesome) para: ${soJunit.join(', ')}. Esses specs ficam sem erro estruturado e sem os testes pulados.`);
  if (obsoletos.size) avisos.push(`${obsoletos.size} spec(s) de relatórios antigos ignorado(s) por não existirem mais em cypress/e2e: ${[...obsoletos].slice(0, 6).join(', ')}${obsoletos.size > 6 ? '…' : ''}.`);

  // 3. execuções mais antigas vindas de outro diretório (reexecução no CI)
  const anteriores = new Map();
  for (const c of candidatosAnteriores) {
    try {
      for (const exec of lerExecucoes(c)) {
        if (!anteriores.has(exec.spec)) anteriores.set(exec.spec, []);
        anteriores.get(exec.spec).push(exec);
      }
    } catch (e) {
      avisos.push(`Falha ao ler ${path.basename(c.arquivo)} (${c.fonte}): ${e.message}`);
    }
  }
  for (const lista of anteriores.values()) lista.sort((a, b) => b.timestamp - a.timestamp);

  if (execucoes.length === 0) {
    console.error('Nenhum relatório do Mochawesome ou JUnit encontrado nas entradas:');
    entradas.forEach((d) => console.error(`  - ${d}`));
    return 1;
  }

  // 4. passos do hook, áreas do §10.0 e modelo
  const passos = lerPassos(entradas);
  avisos.push(...passos.problemas);
  const areas = lerAreasDoIndice();
  if (!areas.lido) avisos.push('Não foi possível ler o §10.0 do .agents/PROJECT_CONTEXT.md: contexts e cenários ficam sem área.');

  fs.mkdirSync(dirSaida, { recursive: true });
  fs.rmSync(path.join(dirSaida, 'anexos'), { recursive: true, force: true }); // anexos de uma geração antiga
  const modelo = montarModelo({
    execucoes,
    anteriores,
    passos,
    areasPorContext: areas.mapa,
    areasLidas: areas.lido,
    avisos,
    dirSaida,
    opcoes: { ci: args.ci, useMocks: args.useMocks, sessionLabel: args.sessionLabel, navegador: args.navegador },
  });
  fs.writeFileSync(path.join(dirSaida, 'modelo.json'), JSON.stringify(modelo, null, 2), 'utf8');

  const r = modelo.resumo;
  console.log(`Modelo gravado em ${path.join(dirSaida, 'modelo.json')}`);
  console.log(`${modelo.specs.length} spec(s), ${r.total} testes: ${r.passed} passaram, ${r.failed} falharam, ${r.skipped} pulados, ${r.skippedMassa} pulados por falta de massa.`);
  if (modelo.contagem.avisos.length) {
    console.log('Avisos:');
    modelo.contagem.avisos.forEach((a) => console.log(`  - ${a}`));
  }

  // 5. renderiza o site, se o template já existir
  const renderizador = path.join(__dirname, 'template', 'renderizar.js');
  if (!fs.existsSync(renderizador)) {
    console.warn('Aviso: scripts/relatorio/template/renderizar.js ainda não existe; só o modelo.json foi gerado.');
    return 0;
  }
  try {
    require(renderizador).renderizar(modelo, dirSaida);
    console.log(`Site gerado em ${dirSaida}`);
  } catch (e) {
    console.error(`Falha ao renderizar o site: ${e.message}`);
    return 1;
  }
  return 0;
}

try {
  process.exitCode = main();
} catch (e) {
  console.error(`Erro: ${e.message}`);
  process.exitCode = 1;
}
