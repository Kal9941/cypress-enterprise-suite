// cypress/support/rotaApi.js
// Padrões de `cy.intercept` na forma nova das rotas, sem o prefixo /stores/:id (backend#677: a loja vem do token).
// O padrão é a URL absoluta da API (API_URL do env.json ou --env), o que ancora o host e o caminho num lugar só:
// sem o host, `**/resources*` casa um arquivo JS do app (`/assets/resources.queries-XXXX.js`) e a SPA não monta;
// sem a âncora no primeiro segmento, `**/channels*` (Iniciar atendimento) casa `/attendances/channels` (filtro da fila).
//  - rotaApi('attendances?*')  → 'https://api.../attendances?*'  (glob do minimatch: `*` não cruza `/`)
//  - regexApi('attendances/\\d+([?#].*)?$') → '^https://api\\.\\.\\./attendances/\\d+([?#].*)?$' (fonte para `new RegExp`)

const configEnv = require('../../env.json');

const baseDaApi = () => String(Cypress.env('API_URL') || configEnv.API_URL).replace(/\/+$/, '');
const semBarraInicial = (resto) => String(resto).replace(/^\/+/, '');
const escaparRegex = (texto) => texto.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

export const rotaApi = (resto) => `${baseDaApi()}/${semBarraInicial(resto)}`;

export const regexApi = (resto) => `^${escaparRegex(baseDaApi())}/${semBarraInicial(resto)}`;
