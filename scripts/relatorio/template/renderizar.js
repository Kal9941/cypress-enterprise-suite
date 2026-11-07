#!/usr/bin/env node
/**
 * Renderizador do painel de testes (site estático que abre por file://).
 *
 * Uso como módulo (o gerador chama assim):
 *   const { renderizar } = require('./template/renderizar');
 *   renderizar(modelo, 'cypress/reports/painel');
 *
 * Uso na linha de comando (só para ver o visual com dados de exemplo):
 *   node scripts/relatorio/template/renderizar.js --exemplo
 *   -> lê template/exemplo/modelo-exemplo.json e gera cypress/reports/painel-exemplo/
 *
 * O formato do `modelo` está em scripts/relatorio/MODELO.md.
 * Saída: index.html, features/<slug>.html (um por suíte), assets/ e scripts/.
 */
const fs = require('fs');
const path = require('path');
const { renderizarIndice } = require('./pagina-indice');
const { renderizarSuite } = require('./pagina-suite');
const { nomeArquivo } = require('./comum');

const DIR_TEMPLATE = __dirname;
const RAIZ_PROJETO = path.resolve(__dirname, '..', '..', '..');

function validar(modelo) {
  if (!modelo || typeof modelo !== 'object') throw new Error('renderizar: modelo ausente');
  if (!modelo.resumo) throw new Error('renderizar: modelo.resumo ausente');
  if (!Array.isArray(modelo.specs)) throw new Error('renderizar: modelo.specs precisa ser uma lista');
}

function escrever(arquivo, conteudo) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  fs.writeFileSync(arquivo, conteudo, 'utf8');
}

/**
 * Gera o painel em `dirSaida`. Devolve a lista de HTML escritos.
 * Só mexe em index.html, features/, assets/ e scripts/ (anexos que o gerador
 * copiou para outras pastas de dirSaida ficam como estão).
 */
function renderizar(modelo, dirSaida) {
  validar(modelo);
  const saida = path.resolve(dirSaida);

  // Páginas de uma rodada anterior não podem sobrar
  fs.rmSync(path.join(saida, 'features'), { recursive: true, force: true });
  fs.mkdirSync(saida, { recursive: true });

  fs.cpSync(path.join(DIR_TEMPLATE, 'assets'), path.join(saida, 'assets'), { recursive: true });
  fs.cpSync(path.join(DIR_TEMPLATE, 'scripts'), path.join(saida, 'scripts'), { recursive: true });

  const escritos = [];
  const indice = path.join(saida, 'index.html');
  escrever(indice, renderizarIndice(modelo));
  escritos.push(indice);

  for (const spec of modelo.specs) {
    const nome = nomeArquivo(spec.slug);
    const arquivo = path.join(saida, 'features', `${nome}.html`);
    escrever(arquivo, renderizarSuite({ ...spec, slug: nome }, modelo.meta));
    escritos.push(arquivo);
  }
  return escritos;
}

module.exports = { renderizar };

if (require.main === module) {
  if (process.argv.includes('--exemplo')) {
    const modelo = JSON.parse(fs.readFileSync(path.join(DIR_TEMPLATE, 'exemplo', 'modelo-exemplo.json'), 'utf8'));
    const destino = path.join(RAIZ_PROJETO, 'cypress', 'reports', 'painel-exemplo');
    const arquivos = renderizar(modelo, destino);
    console.log(`Painel de exemplo gerado em ${destino} (${arquivos.length} páginas)`);
    console.log(path.join(destino, 'index.html'));
  } else {
    console.error('Uso: node scripts/relatorio/template/renderizar.js --exemplo');
    process.exit(1);
  }
}
