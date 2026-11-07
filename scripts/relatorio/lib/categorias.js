/**
 * Categoria da falha de um teste vermelho.
 *
 * As famílias saem do `cypress/support/errorHandler.js`. Ele classifica no navegador e já escreve o
 * rótulo entre colchetes na mensagem do erro (`🔍 [ELEMENTO NÃO ENCONTRADO NO DOM] - …`); aqui o rótulo
 * é lido primeiro. Sem rótulo (erro que não passou pelo handler), as mesmas regras do handler são
 * reaplicadas sobre mensagem e pilha. As variantes do handler foram agrupadas em 9 famílias, mais a
 * genérica `OUTROS`.
 */

const CATEGORIAS = {
  TIMEOUT_REDE: 'Timeout de rede / API lenta',
  JANELA_WHATSAPP: 'Janela de 24h / WhatsApp',
  ESPERA_ROTA: 'Espera de rota (cy.wait)',
  PERMISSAO: 'Permissão / capabilities',
  ELEMENTO_DOM: 'Elemento não encontrado, oculto ou desabilitado',
  HTTP_API: 'Resposta HTTP / API',
  CONTRATO: 'Contrato do payload (JSON)',
  ASSERCAO: 'Regra de negócio / asserção',
  CRASH_APP: 'Crash da aplicação (frontend)',
  OUTROS: 'Erro de execução E2E',
};

// Rótulo do handler (maiúsculo, como escrito na mensagem) → família. A ordem importa.
const POR_ROTULO = [
  [/TIMEOUT DE REDE/, 'TIMEOUT_REDE'],
  [/JANELA DE 24H|TIMEOUT DE RESPOSTA NO WHATSAPP/, 'JANELA_WHATSAPP'],
  [/CY\.WAIT/, 'ESPERA_ROTA'],
  [/BOTÃO \/ AÇÃO NÃO RENDERIZADA/, 'PERMISSAO'],
  [/ELEMENTO NÃO ENCONTRADO|ELEMENTO OCULTO/, 'ELEMENTO_DOM'],
  [/DIVERGÊNCIA DE CONTRATO NO PAYLOAD/, 'CONTRATO'],
  [/RESPOSTA HTTP|FALHA DE SEGURANÇA \/ RBAC|FALHA NA REQUISIÇÃO CY\.REQUEST/, 'HTTP_API'],
  [/REGRA DE NEGÓCIO/, 'ASSERCAO'],
  [/CRASH \/ EXCEÇÃO/, 'CRASH_APP'],
  [/ERRO DE EXECUÇÃO E2E/, 'OUTROS'],
];

/**
 * Classifica o erro.
 * @param {{message?: string, estack?: string, stack?: string}} err erro do Mochawesome
 * @param {string} [arquivoSpec] caminho do spec (o handler trata spec de backend à parte)
 * @returns {string} nome da família (valor de `CATEGORIAS`)
 */
function classificarErro(err, arquivoSpec) {
  const mensagem = (err && err.message) || '';
  const pilha = (err && (err.estack || err.stack)) || '';

  // 1. Rótulo já escrito pelo errorHandler: "[CATEGORIA EM MAIÚSCULAS]"
  const rotulo = mensagem.match(/\[([^\]\n]{4,200})\]\s*-/);
  if (rotulo) {
    const texto = rotulo[1].toUpperCase();
    for (const [regex, chave] of POR_ROTULO) {
      if (regex.test(texto)) return CATEGORIAS[chave];
    }
  }

  // 2. Sem rótulo: mesmas regras do errorHandler.classificarErro, na mesma ordem
  const raw = `${mensagem} ${pilha}`;

  if (
    raw.includes('ESOCKETTIMEDOUT') || raw.includes('ETIMEDOUT') || raw.includes('responseTimeout') ||
    raw.includes('ClientRequest.<anonymous>') ||
    raw.includes('intercept the upstream response, but the request timed out')
  ) return CATEGORIAS.TIMEOUT_REDE;

  if (
    raw.includes('validarJanelaAtiva') ||
    (raw.includes('badge-janela-ativa') && raw.includes('Timed out retrying')) ||
    raw.includes('90000ms') || raw.includes('responda em até')
  ) return CATEGORIAS.JANELA_WHATSAPP;

  if (
    raw.includes('cy.wait() timed out waiting') ||
    /for the (1st|2nd) (response|request) to the route:/.test(raw)
  ) return CATEGORIAS.ESPERA_ROTA;

  if (
    (raw.includes('Expected to find') || raw.includes('never found it')) &&
    /Permissão|transferir|completed|discarded|status-dropdown|menu-status|mensagem-padrao/.test(raw)
  ) return CATEGORIAS.PERMISSAO;

  if (
    raw.includes('Expected to find element:') || raw.includes('Expected to find content:') ||
    raw.includes('never found it') ||
    raw.includes('is not visible') || raw.includes('is being covered by another element') ||
    raw.includes('is disabled') || raw.includes('has CSS property: display: none')
  ) return CATEGORIAS.ELEMENTO_DOM;

  // Mesmo critério do `errorHandler.ehSpecBackend` (0-A/0-B/0-C/0-D.backend-*), aceitando também o nome antigo `0.backend.cy.js` de relatórios velhos
  const specBackend = /(^|[/\\])0(-[ABCD])?\.backend[^/\\]*\.cy\.js$/i.test(arquivoSpec || '');
  const status = raw.match(/(?:status|code|statusCode|expected)\D*(\d{3})\D*to\s+(?:equal|eq)\D*(\d{3})/i) ||
    raw.match(/expected\s+(\d{3})\s+to\s+equal\s+(\d{3})/i);
  if (status || specBackend || raw.includes('cy.request')) {
    if (status) return CATEGORIAS.HTTP_API;
    if (raw.includes('to have property') || raw.includes('to be an array') || raw.includes('to be an object')) {
      return CATEGORIAS.CONTRATO;
    }
    if (raw.includes('cy.request() failed')) return CATEGORIAS.HTTP_API;
  }

  if (
    raw.includes('AssertionError') ||
    (raw.includes('expected') && /to equal|to include|to match|to have/.test(raw))
  ) return CATEGORIAS.ASSERCAO;

  if (
    raw.includes('The following error originated from your application code') ||
    raw.includes('uncaught:exception')
  ) return CATEGORIAS.CRASH_APP;

  return CATEGORIAS.OUTROS;
}

module.exports = { CATEGORIAS, classificarErro };
