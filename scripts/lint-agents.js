#!/usr/bin/env node
/**
 * Lint dos documentos de `.agents/` — padrão quente/frio (`AGENTS.md` §0.1 `[R-DOC]`).
 *
 * Falha (exit 1) quando:
 *  - um arquivo com marcador obrigatório não tem `<!-- fim-quente -->` sozinho numa linha (ou o tem duplicado);
 *  - a parte quente (acima do marcador) passa do teto em KB daquele arquivo;
 *  - qualquer linha passa do teto de caracteres (a ferramenta de leitura do agente é por linha);
 *  - AGENTS.md ou PROJECT_CONTEXT.md não têm o "## Mapa de leitura" na parte quente.
 *
 * Uso: `npm run docs:lint` (chamado pela skill `pre-commit`). Ajustar os tetos aqui, nunca contornar no commit.
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', '.agents');
const MARCADOR = '<!-- fim-quente -->';
const MAX_LINHA = 5000; // caracteres por linha, em qualquer arquivo de .agents/
const TETO_QUENTE_KB = { 'AGENTS.md': 70, 'ROADMAP.md': 45, 'PROJECT_CONTEXT.md': 30 };
const SEM_MARCADOR = ['HISTORICO.md'];
const EXIGE_MAPA = ['AGENTS.md', 'PROJECT_CONTEXT.md'];

const erros = [];
const arquivos = fs.readdirSync(DIR).filter((f) => f.endsWith('.md')).sort();

for (const f of arquivos) {
  const texto = fs.readFileSync(path.join(DIR, f), 'utf8').replace(/\r\n/g, '\n');
  const linhas = texto.split('\n');
  const maior = Math.max(...linhas.map((l) => l.length));

  linhas.forEach((l, i) => {
    if (l.length > MAX_LINHA) erros.push(`${f}:${i + 1} — linha com ${l.length} caracteres (máx. ${MAX_LINHA}); quebrar em itens ou mover para HISTORICO.md`);
  });

  let quenteKb = null;
  if (!SEM_MARCADOR.includes(f)) {
    const idx = linhas.indexOf(MARCADOR);
    if (idx < 0) erros.push(`${f} — marcador ${MARCADOR} ausente (precisa estar sozinho numa linha)`);
    else {
      if (linhas.indexOf(MARCADOR, idx + 1) >= 0) erros.push(`${f} — marcador ${MARCADOR} duplicado`);
      const quente = linhas.slice(0, idx).join('\n');
      quenteKb = Buffer.byteLength(quente) / 1024;
      const teto = TETO_QUENTE_KB[f];
      if (teto && quenteKb > teto) erros.push(`${f} — parte quente com ${quenteKb.toFixed(0)} KB (teto ${teto} KB); mover seção para baixo do marcador e apontar no Mapa`);
      if (EXIGE_MAPA.includes(f) && !/^## Mapa de leitura/m.test(quente)) erros.push(`${f} — sem "## Mapa de leitura sob demanda" na parte quente`);
    }
  }

  console.log(
    `${f.padEnd(20)} total ${String((texto.length / 1024).toFixed(0)).padStart(4)} KB · quente ${quenteKb === null ? '  —  ' : String(quenteKb.toFixed(0)).padStart(3) + ' KB'} · ${linhas.length} linhas · maior linha ${maior}`,
  );
}

if (erros.length) {
  console.error(`\n❌ docs:lint — ${erros.length} problema(s):`);
  for (const e of erros) console.error(' - ' + e);
  process.exit(1);
}
console.log('\n✅ docs:lint OK');
