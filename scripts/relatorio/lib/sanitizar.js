/**
 * Remove segredos de qualquer texto que vá para o relatório (mensagens, trechos, passos, anexos).
 *
 * Mesmos `replace` de token do `cypress/support/errorHandler.js` (ele roda no navegador e é ESM, por isso
 * as regexes são portadas aqui, sem `require`), mais: senha, CNPJ formatado e os valores sensíveis do
 * `env.json` (CNPJ, senha, celular) ou das variáveis `CYPRESS_*` do CI.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..', '..');

// Chaves do env.json cujo valor nunca pode aparecer no relatório.
const CHAVES_ENV_SENSIVEIS = ['USER_CNPJ', 'USER_PASSWORD', 'DEFAULT_CELULAR'];
// Variáveis de ambiente equivalentes no CI (secrets do workflow).
const VARIAVEIS_SENSIVEIS = [
  'CYPRESS_userCnpj', 'CYPRESS_USER_CNPJ', 'CYPRESS_userPassword', 'CYPRESS_USER_PASSWORD', 'CYPRESS_DEFAULT_CELULAR',
];
// Valores curtos demais (ex.: usuário "4") destruiriam o texto se trocados às cegas.
const TAMANHO_MINIMO_SEGREDO = 6;

let segredosCache = null;

/** Lê os valores sensíveis do env.json e do ambiente, uma vez só. */
function carregarSegredos() {
  if (segredosCache) return segredosCache;
  const valores = new Set();
  try {
    const env = JSON.parse(fs.readFileSync(path.join(RAIZ, 'env.json'), 'utf8'));
    for (const chave of CHAVES_ENV_SENSIVEIS) {
      if (typeof env[chave] === 'string') valores.add(env[chave]);
    }
  } catch (e) {
    // sem env.json (caso do CI): só as variáveis de ambiente abaixo
  }
  for (const nome of VARIAVEIS_SENSIVEIS) {
    if (process.env[nome]) valores.add(process.env[nome]);
  }
  segredosCache = [...valores].filter((v) => v.length >= TAMANHO_MINIMO_SEGREDO);
  return segredosCache;
}

/**
 * Sanitiza um texto.
 * @param {*} texto qualquer valor (não string vira '')
 * @returns {string}
 */
function sanitizar(texto) {
  if (typeof texto !== 'string' || !texto) return '';
  let out = texto
    // os três replace do errorHandler.js (sanitizarMensagem)
    .replace(/Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, 'Bearer [TOKEN_JWT_OMITIDO]')
    .replace(/authorization:\s*"Bearer\s+[^"]+"/gi, 'authorization: "Bearer [OMITIDO]"')
    .replace(/ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, '[TOKEN_OMITIDO]')
    // senha em JSON ("password": "x") ou em par chave=valor
    .replace(/("(?:user)?_?(?:password|senha)"\s*:\s*)"[^"]*"/gi, '$1"[SENHA_OMITIDA]"')
    .replace(/\b((?:user)?_?(?:password|senha))=([^\s&"']+)/gi, '$1=[SENHA_OMITIDA]')
    // CNPJ formatado
    .replace(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, '[CNPJ_OMITIDO]');
  for (const segredo of carregarSegredos()) {
    out = out.split(segredo).join('[OMITIDO]');
  }
  return out;
}

module.exports = { sanitizar };
