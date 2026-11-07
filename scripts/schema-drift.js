/**
 * Detecção de schema drift dos mocks (ROADMAP P2-15, decisão do operador em 2026-11-06: comparar só a forma).
 *
 * Depois de uma rodada em API real com `--env USE_MOCKS=false,AUTO_SYNC_MOCKS=true`, os fixtures `.json` em
 * `cypress/fixtures/` ficam reescritos com a resposta do servidor. O `git diff` cru desses arquivos é inútil como
 * alarme: contagens e listas mudam a cada rodada (medido na 3.central: 243+/277- linhas em 5 arquivos, quase tudo valor).
 * Este script compara só a FORMA (chaves e tipos, recursivamente) de cada fixture alterado contra a versão do HEAD e
 * aponta o que importa para o mock: chave que o servidor passou a mandar, chave que ele deixou de mandar e tipo trocado.
 *
 * Regras da comparação:
 * - objeto: compara chave a chave; listas: junta a forma de todos os itens (um item pode ter chave que outro não tem);
 * - lista vazia de um dos lados não diz nada sobre os itens (não acusa);
 * - `null` contra outro tipo é campo anulável, não drift (vira nota, não reprova);
 * - objeto usado como dicionário (chaves só numéricas, ex.: id → valor) compara só a forma dos valores.
 *
 * Uso:
 *   node scripts/schema-drift.js            → compara os fixtures .json alterados no working tree contra o HEAD
 *   node scripts/schema-drift.js --base REF → compara contra outra referência do git
 * Saída 1 quando há chave nova, chave sumida ou tipo trocado; 0 quando só valores mudaram.
 * Com `GITHUB_STEP_SUMMARY` definido (GitHub Actions), também escreve o relatório no resumo do job.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const base = args.includes('--base') ? args[args.indexOf('--base') + 1] : 'HEAD';

const git = (cmd) => execSync(`git ${cmd}`, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const tipoDe = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
const ehDicionario = (obj) => {
  const chaves = Object.keys(obj);
  return chaves.length > 0 && chaves.every((k) => /^\d+$/.test(k));
};

/** Forma de um valor: { tipo, chaves?: {k: forma}, itens?: forma|null, dicionario?: forma|null } */
function forma(v) {
  const tipo = tipoDe(v);
  if (tipo === 'array') return { tipo, itens: v.reduce((acc, item) => juntar(acc, forma(item)), null) };
  if (tipo === 'object') {
    if (ehDicionario(v)) return { tipo, dicionario: Object.values(v).reduce((acc, item) => juntar(acc, forma(item)), null) };
    const chaves = {};
    for (const [k, filho] of Object.entries(v)) chaves[k] = forma(filho);
    return { tipo, chaves };
  }
  return { tipo };
}

/** União de duas formas (itens de uma lista): chaves de ambos; tipos diferentes viram "a|b". */
function juntar(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (a.tipo === 'null') return { ...b, anulavel: true };
  if (b.tipo === 'null') return { ...a, anulavel: true };
  if (a.tipo !== b.tipo) return { tipo: [...new Set([...a.tipo.split('|'), ...b.tipo.split('|')])].sort().join('|') };
  if (a.tipo === 'array') return { tipo: 'array', itens: juntar(a.itens, b.itens), anulavel: a.anulavel || b.anulavel };
  if (a.tipo === 'object') {
    if (a.dicionario !== undefined || b.dicionario !== undefined) return { tipo: 'object', dicionario: juntar(a.dicionario, b.dicionario) };
    const chaves = { ...a.chaves };
    for (const [k, f] of Object.entries(b.chaves)) chaves[k] = juntar(chaves[k], f);
    return { tipo: 'object', chaves, anulavel: a.anulavel || b.anulavel };
  }
  return { tipo: a.tipo, anulavel: a.anulavel || b.anulavel };
}

/** Compara a forma gravada (antes) com a do servidor (depois). */
function comparar(antes, depois, caminho, achados) {
  if (!antes || !depois) return; // lista vazia de um dos lados
  if (antes.tipo === 'null' || depois.tipo === 'null') {
    if (antes.tipo !== depois.tipo) achados.notas.push(`${caminho || '(raiz)'}: ${antes.tipo} → ${depois.tipo} (anulável)`);
    return;
  }
  if (antes.tipo !== depois.tipo) {
    achados.tipos.push(`${caminho || '(raiz)'}: ${antes.tipo} → ${depois.tipo}`);
    return;
  }
  if (antes.tipo === 'array') return comparar(antes.itens, depois.itens, `${caminho}[]`, achados);
  if (antes.tipo !== 'object') return;
  if (antes.dicionario !== undefined || depois.dicionario !== undefined) {
    return comparar(antes.dicionario, depois.dicionario, `${caminho}{id}`, achados);
  }
  const ca = antes.chaves || {};
  const cd = depois.chaves || {};
  for (const k of Object.keys(cd)) if (!(k in ca)) achados.novas.push(caminho ? `${caminho}.${k}` : k);
  for (const k of Object.keys(ca)) if (!(k in cd)) achados.sumidas.push(caminho ? `${caminho}.${k}` : k);
  for (const k of Object.keys(ca)) if (k in cd) comparar(ca[k], cd[k], caminho ? `${caminho}.${k}` : k, achados);
}

const alterados = git(`diff --name-only ${base} -- cypress/fixtures/`)
  .split('\n')
  .map((s) => s.trim())
  .filter((s) => s.endsWith('.json'));

const relatorio = [];
let reprova = false;
for (const arquivo of alterados) {
  let antes;
  let depois;
  try {
    antes = JSON.parse(git(`show ${base}:${arquivo}`));
  } catch (e) {
    relatorio.push({ arquivo, erro: 'fixture novo ou ilegível no ' + base });
    continue;
  }
  try {
    depois = JSON.parse(fs.readFileSync(path.join(ROOT, arquivo), 'utf8'));
  } catch (e) {
    relatorio.push({ arquivo, erro: 'fixture apagado ou ilegível no working tree' });
    continue;
  }
  const achados = { novas: [], sumidas: [], tipos: [], notas: [] };
  comparar(forma(antes), forma(depois), '', achados);
  if (achados.novas.length || achados.sumidas.length || achados.tipos.length) reprova = true;
  relatorio.push({ arquivo, ...achados });
}

const linhas = [];
linhas.push(`## Schema drift dos mocks (base: ${base})`, '');
if (!alterados.length) linhas.push('Nenhum fixture `.json` alterado: a rodada não sincronizou nada (o servidor respondeu igual ou nenhum mock com `fixturePath` rodou em API real).');
for (const r of relatorio) {
  if (r.erro) { linhas.push(`- \`${r.arquivo}\`: ${r.erro}`); continue; }
  const temDrift = r.novas.length || r.sumidas.length || r.tipos.length;
  linhas.push(`### ${temDrift ? '🚨' : '✅'} \`${r.arquivo}\`${temDrift ? '' : ' — só valores mudaram'}`);
  if (r.novas.length) linhas.push(`- **Chaves novas no servidor (o mock não tem):** ${r.novas.map((c) => '`' + c + '`').join(', ')}`);
  if (r.sumidas.length) linhas.push(`- **Chaves que o servidor deixou de mandar (o mock ainda tem):** ${r.sumidas.map((c) => '`' + c + '`').join(', ')}`);
  if (r.tipos.length) linhas.push(`- **Tipo trocado:** ${r.tipos.map((c) => '`' + c + '`').join(', ')}`);
  if (r.notas.length) linhas.push(`- Notas (anulável, não reprova): ${r.notas.map((c) => '`' + c + '`').join(', ')}`);
  linhas.push('');
}
linhas.push(reprova
  ? '**Resultado:** há drift de forma. Atualize o mock (fixture e `defaultBody`) e confira se algum teste depende da chave.'
  : '**Resultado:** sem drift de forma.');
const texto = linhas.join('\n');
console.log(texto);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, texto + '\n');
process.exit(reprova ? 1 : 0);
