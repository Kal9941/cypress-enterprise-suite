/**
 * Peças comuns às páginas do painel: escape de HTML, formatação, JSON seguro
 * para embutir em <script> e o esqueleto (cabeçalho, rodapé, modal).
 * Tudo que vem do modelo passa por esc() antes de virar HTML.
 */

const TITULO = 'OmniCare Web — Relatório de testes E2E';
const CHAVE_TEMA = 'omnicare-relatorio-tema';

const STATUS = ['passed', 'failed', 'skipped', 'skippedMassa'];
const ROTULOS = {
  passed: 'Passou',
  failed: 'Falhou',
  skipped: 'Pulado (backlog)',
  skippedMassa: 'Pulado por falta de massa',
};
const ICONES = {
  passed: 'fa-circle-check',
  failed: 'fa-circle-xmark',
  skipped: 'fa-circle-minus',
  skippedMassa: 'fa-database',
};

function esc(texto) {
  return String(texto === null || texto === undefined ? '' : texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 340 -> "340 ms"; 2400 -> "2,4 s"; 83000 -> "1 min 23 s"
function duracao(ms) {
  if (ms === null || ms === undefined || isNaN(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 10000) return `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
  const totalS = Math.round(ms / 1000);
  if (totalS < 60) return `${totalS} s`;
  const min = Math.floor(totalS / 60);
  if (min < 60) return `${min} min ${totalS % 60} s`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

// JSON que pode ir dentro de <script>: "<" vira \u003c (fecha "</script>" e "<!--"),
// e os separadores de linha U+2028/U+2029 também são escapados.
function jsonSeguro(dados) {
  return JSON.stringify(dados)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

// Só aceita http(s) em links vindos do modelo (nada de javascript:)
function urlSegura(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url) ? url : null;
}

// Nome de arquivo seguro para a página da suíte
function nomeArquivo(slug) {
  return String(slug || 'suite').replace(/[^A-Za-z0-9._-]+/g, '_');
}

function formatarData(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'medium' });
}

function percentual(valor) {
  return String(valor === undefined || valor === null ? '0' : valor).replace('.', ',');
}

// Soma flaky de uma suíte (campo derivado: o modelo guarda a flag em cada teste)
function contarFlaky(spec) {
  return (spec.cenarios || []).filter((c) => c.flaky).length;
}

function selo(status, texto) {
  return `<span class="pn-selo pn-st-${esc(status)}"><i class="fa-solid ${ICONES[status] || 'fa-circle'}"></i>${esc(texto || ROTULOS[status] || status)}</span>`;
}

function cartaoKpi(status, numero, rotulo, sub) {
  return `<div class="pn-kpi pn-st-${status}">
    <div class="pn-kpi-num">${esc(numero)}</div>
    <div class="pn-kpi-rotulo">${esc(rotulo)}</div>
    ${sub ? `<div class="pn-kpi-sub">${esc(sub)}</div>` : ''}
  </div>`;
}

function cabecalho(subtitulo, prefixo) {
  return `<header class="border-b bg-background px-4 md:px-6 py-4 sticky top-0 z-40 backdrop-blur">
  <div class="mx-auto max-w-7xl flex items-center justify-between gap-4">
    <a href="${prefixo}index.html" class="flex items-center gap-3 truncate">
      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
        <i class="fa-solid fa-vial-circle-check text-xl"></i>
      </div>
      <div class="truncate">
        <h1 class="text-lg md:text-2xl font-bold text-foreground tracking-tight truncate">${esc(TITULO)}</h1>
        <p class="pn-cabecalho-sub mt-0.5 truncate">${esc(subtitulo)}</p>
      </div>
    </a>
    <button id="theme-toggle" type="button" class="p-2 rounded-md hover:bg-accent transition-colors shrink-0" title="Alternar tema claro/escuro" aria-label="Alternar tema claro/escuro">
      <i id="sun-icon" class="fa-solid fa-sun text-lg pn-oculto"></i>
      <i id="moon-icon" class="fa-solid fa-moon text-lg"></i>
    </button>
  </div>
</header>`;
}

function rodape(geradoEm) {
  return `<footer class="border-t bg-background px-6 py-4 mt-8">
  <div class="mx-auto max-w-7xl pn-rodape">
    <p>${esc(TITULO)} · gerado em ${esc(formatarData(geradoEm))} (horário de Brasília)</p>
    <p class="mt-1 opacity-70">Gráficos: ApexCharts · Ícones: Font Awesome Free (licenças em assets/LICENCAS.md)</p>
  </div>
</footer>`;
}

const MODAL = `<div id="media-modal" class="pn-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <div class="pn-modal-caixa">
    <div class="pn-modal-cab">
      <h2 id="modal-title" class="text-base font-semibold truncate">Anexo</h2>
      <button id="modal-fechar" type="button" class="rounded-lg p-1 px-2 hover:bg-muted transition-colors" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div id="modal-content" class="pn-modal-corpo"></div>
  </div>
</div>`;

// Esqueleto HTML completo. "prefixo" é o caminho até a raiz do painel ('' ou '../').
function pagina({ titulo, subtitulo, prefixo, corpo, dados, geradoEm, comModal }) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(titulo)}</title>
<link rel="stylesheet" href="${prefixo}assets/css/styles.min.css">
<link rel="stylesheet" href="${prefixo}assets/css/font-awesome.css">
<link rel="stylesheet" href="${prefixo}assets/css/painel.css">
<script src="${prefixo}assets/js/apex-charts.js"></script>
<script>
  // Tema antes de pintar. "?tema=escuro" ou "?tema=claro" vale só para esta visita.
  (function () {
    var tema = null;
    try {
      var forcado = new URLSearchParams(location.search).get('tema');
      tema = forcado === 'escuro' ? 'dark' : forcado === 'claro' ? 'light' : localStorage.getItem('${CHAVE_TEMA}');
    } catch (e) {}
    if (!tema) tema = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    if (tema === 'dark') document.documentElement.classList.add('dark');
  })();
</script>
</head>
<body class="min-h-screen bg-background text-foreground">
${cabecalho(subtitulo, prefixo)}
<main class="px-4 md:px-6 py-8">
  <div class="mx-auto max-w-7xl space-y-6">
${corpo}
  </div>
</main>
${rodape(geradoEm)}
${comModal ? MODAL : ''}
<script>
${dados}
</script>
<script src="${prefixo}scripts/utils.js"></script>
<script src="${prefixo}scripts/theme.js"></script>
<script src="${prefixo}scripts/modal.js"></script>
<script src="${prefixo}scripts/charts.js"></script>
<script src="${prefixo}scripts/table.js"></script>
<script src="${prefixo}scripts/scenarios.js"></script>
<script src="${prefixo}scripts/main.js"></script>
</body>
</html>
`;
}

module.exports = {
  TITULO, STATUS, ROTULOS, ICONES,
  esc, duracao, jsonSeguro, urlSegura, nomeArquivo, formatarData, percentual,
  contarFlaky, selo, cartaoKpi, pagina,
};
