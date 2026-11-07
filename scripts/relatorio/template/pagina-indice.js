/**
 * Página inicial do painel (index.html): execução, totais, gráficos,
 * contagem x docs e tabela das suítes.
 */
const C = require('./comum');
const { esc } = C;

// Link do commit: deduzido do runUrl do GitHub Actions (https://github.com/org/repo/actions/runs/N)
function urlCommit(meta) {
  const m = /^(https?:\/\/[^/]+\/[^/]+\/[^/]+)\/actions\/runs\//i.exec(meta.runUrl || '');
  return m && meta.sha ? `${m[1]}/commit/${meta.sha}` : null;
}

function itemInfo(icone, rotulo, valorHtml) {
  return `<div class="pn-info-item">
    <div class="pn-info-icone"><i class="${icone} text-sm"></i></div>
    <div class="min-w-0"><p class="pn-info-rotulo">${esc(rotulo)}</p><div class="pn-info-valor">${valorHtml}</div></div>
  </div>`;
}

function faixaExecucao(meta, resumo) {
  const itens = [];
  const origemCi = meta.origem === 'ci';
  const runUrl = C.urlSegura(meta.runUrl);
  itens.push(itemInfo(
    origemCi ? 'fa-solid fa-cloud' : 'fa-solid fa-laptop',
    'Origem',
    origemCi
      ? `CI${runUrl ? ` · <a class="pn-link" href="${esc(runUrl)}" target="_blank" rel="noopener noreferrer">ver execução <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i></a>` : ''}`
      : 'Execução local',
  ));
  if (meta.branch) itens.push(itemInfo('fa-solid fa-code-branch', 'Branch', esc(meta.branch)));
  if (meta.sha) {
    const curto = String(meta.sha).slice(0, 7);
    const link = C.urlSegura(urlCommit(meta));
    itens.push(itemInfo(
      'fa-solid fa-code-commit',
      'Commit',
      link
        ? `<a class="pn-link font-mono" href="${esc(link)}" target="_blank" rel="noopener noreferrer" title="${esc(meta.sha)}">${esc(curto)}</a>`
        : `<span class="font-mono" title="${esc(meta.sha)}">${esc(curto)}</span>`,
    ));
  }
  itens.push(itemInfo('fa-solid fa-calendar-days', 'Data', esc(C.formatarData(meta.geradoEm))));
  itens.push(itemInfo('fa-solid fa-clock', 'Duração', esc(C.duracao(resumo.duracaoMs))));
  if (meta.cypressVersion) itens.push(itemInfo('fa-solid fa-flask', 'Cypress', esc(meta.cypressVersion)));
  if (meta.nodeVersion) itens.push(itemInfo('fa-brands fa-node-js', 'Node', esc(meta.nodeVersion)));
  if (meta.navegador) {
    const icone = /chrome|electron|edge/i.test(meta.navegador.nome || '') ? 'fa-brands fa-chrome' : 'fa-solid fa-globe';
    itens.push(itemInfo(icone, 'Navegador', esc(`${meta.navegador.nome || ''} ${meta.navegador.versao || ''}`.trim())));
  }
  const modo = meta.useMocks === true ? 'Mock (API simulada)' : meta.useMocks === false ? 'Real (API de verdade)' : 'Não informado';
  itens.push(itemInfo('fa-solid fa-plug', 'Modo', esc(modo)));
  if (meta.sessionLabel) itens.push(itemInfo('fa-solid fa-tag', 'Sessão', esc(meta.sessionLabel)));

  return `<section class="rounded-xl border bg-card text-card-foreground shadow p-4 md:p-6">
    <div class="pn-info">${itens.join('\n')}</div>
  </section>`;
}

function kpis(resumo, flaky) {
  const p = resumo.percentuais || {};
  return `<section class="pn-kpis">
    ${C.cartaoKpi('total', resumo.total, 'Testes', `${C.duracao(resumo.duracaoMs)} no total`)}
    ${C.cartaoKpi('passed', resumo.passed, C.ROTULOS.passed, `${C.percentual(p.passed)}%`)}
    ${C.cartaoKpi('failed', resumo.failed, C.ROTULOS.failed, `${C.percentual(p.failed)}%`)}
    ${C.cartaoKpi('skipped', resumo.skipped, C.ROTULOS.skipped, `${C.percentual(p.skipped)}%`)}
    ${C.cartaoKpi('skippedMassa', resumo.skippedMassa, C.ROTULOS.skippedMassa, `${C.percentual(p.skippedMassa)}%`)}
    ${C.cartaoKpi('flaky', flaky, 'Instáveis (flaky)', 'passaram só na 2ª tentativa')}
  </section>`;
}

const SELO_OK = '<span class="pn-selo pn-st-passed"><i class="fa-solid fa-circle-check"></i>OK</span>';
const SELO_DIVERGENTE = '<span class="pn-selo pn-st-skippedMassa"><i class="fa-solid fa-triangle-exclamation"></i>Divergente</span>';

function painelContagem(contagem) {
  if (!contagem) return '';
  const linhas = contagem.porSpec || [];
  const avisos = contagem.avisos || [];
  const divergente = avisos.length > 0 || linhas.some((l) => l.ok === false);

  // Número documentado diferente do código fica destacado
  const celulaDoc = (valor, codigo) => {
    if (valor === null || valor === undefined) return '<td class="num opacity-50">—</td>';
    return `<td class="num ${valor !== codigo ? 'pn-celula-div' : ''}">${esc(valor)}</td>`;
  };

  const corpo = linhas
    .map((l) => `<tr class="${l.ok === false ? 'pn-divergente' : ''}">
      <td class="font-mono text-xs">${esc(l.spec)}</td>
      <td class="num">${esc(l.codigo)}</td>
      <td class="num ${l.executados !== l.codigo ? 'pn-celula-div' : ''}">${esc(l.executados)}</td>
      ${celulaDoc(l.docProjectContext, l.codigo)}
      ${celulaDoc(l.docReadme, l.codigo)}
      <td>${l.ok === false ? SELO_DIVERGENTE : SELO_OK}</td>
    </tr>`)
    .join('\n');

  const avisosHtml = avisos.length
    ? `<div class="pn-aviso mt-4"><b><i class="fa-solid fa-triangle-exclamation"></i> ${avisos.length === 1 ? '1 aviso' : `${avisos.length} avisos`} de divergência</b>
        <ul>${avisos.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>`
    : '<div class="pn-aviso pn-aviso-ok mt-4"><i class="fa-solid fa-circle-check"></i> Código, execução e documentação batem na contagem de testes.</div>';

  return `<section class="rounded-xl border bg-card text-card-foreground shadow p-6">
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <h3 class="pn-titulo-cartao" style="margin:0">Contagem x docs</h3>
      ${divergente ? SELO_DIVERGENTE : SELO_OK}
    </div>
    <p class="pn-nota" style="margin:0 0 .75rem">Compara os testes escritos nos specs (código) com os executados nesta rodada e com os números documentados no PROJECT_CONTEXT e no README. Valores diferentes do código aparecem em destaque.</p>
    <div class="overflow-x-auto">
      <table class="pn-tabela">
        <thead><tr><th>Suíte</th><th class="num">Código</th><th class="num">Executados</th><th class="num">PROJECT_CONTEXT</th><th class="num">README</th><th>Situação</th></tr></thead>
        <tbody>${corpo}</tbody>
        <tfoot><tr class="pn-total">
          <td>Total</td>
          <td class="num">${esc(contagem.totalCodigo)}</td>
          <td class="num">${esc(contagem.totalExecutados)}</td>
          <td class="num">${esc(contagem.totalDocs)}</td>
          <td></td><td></td>
        </tr></tfoot>
      </table>
    </div>
    ${avisosHtml}
  </section>`;
}

function linhaSuite(spec) {
  const t = spec.totais || {};
  const executados = (t.passed || 0) + (t.failed || 0);
  const pct = executados > 0 ? Math.round(((t.passed || 0) / executados) * 100) : null;
  const total = t.total || 0;
  const largura = (n) => (total > 0 ? ((n || 0) / total) * 100 : 0).toFixed(2);
  const cor = pct === null ? 'skipped' : (t.failed || 0) > 0 ? 'failed' : 'passed';
  const pulos = (t.skipped || 0) + (t.skippedMassa || 0);
  const busca = `${spec.id} ${spec.nome} ${spec.arquivo}`.toLowerCase();

  return `<tr data-nome="${esc(busca)}" data-falhas="${t.failed || 0}" data-pulos="${pulos}" data-pct="${pct === null ? -1 : pct}" data-dur="${spec.duracaoMs || 0}">
    <td style="min-width:14rem">
      <a href="features/${esc(C.nomeArquivo(spec.slug))}.html" class="font-medium pn-link">${esc(spec.nome || spec.id)}</a>
      <div class="font-mono text-[10px] text-muted-foreground mt-1">${esc(spec.id)}${spec.arquivo ? ` · ${esc(spec.arquivo)}` : ''}</div>
    </td>
    <td style="min-width:15rem">
      <div class="pn-barra">
        ${C.STATUS.map((s) => `<span class="pn-st-${s}" style="width:${largura(t[s])}%"></span>`).join('')}
      </div>
      <div class="pn-legenda-mini">
        <span class="pn-st-passed">${t.passed || 0} passou</span>
        <span class="pn-st-failed">${t.failed || 0} falhou</span>
        <span class="pn-st-skipped">${t.skipped || 0} pulado</span>
        <span class="pn-st-skippedMassa">${t.skippedMassa || 0} sem massa</span>
      </div>
    </td>
    <td class="num">
      <div class="pn-anel pn-st-${cor}" title="${pct === null ? 'Nenhum teste executado' : `${pct}% dos testes executados passaram`}">
        <svg viewBox="0 0 48 48" width="44" height="44">
          <circle cx="24" cy="24" r="20" fill="none" stroke="var(--border)" stroke-width="3"/>
          <circle cx="24" cy="24" r="20" fill="none" stroke="var(--cor)" stroke-width="3" stroke-linecap="round" stroke-dasharray="125.66" stroke-dashoffset="${(125.66 * (1 - (pct || 0) / 100)).toFixed(2)}"/>
        </svg>
        <b>${pct === null ? '—' : `${pct}%`}</b>
      </div>
    </td>
    <td class="num font-mono text-xs text-muted-foreground" style="white-space:nowrap"><i class="fa-regular fa-clock"></i> ${esc(C.duracao(spec.duracaoMs))}</td>
  </tr>`;
}

function tabelaSuites(specs) {
  const th = (rotulo, ordem, classe = '') =>
    `<th class="pn-ordenavel ${classe}" data-ordem="${ordem}">${rotulo} <i class="pn-seta-ordem fa-solid fa-sort opacity-40"></i></th>`;
  return `<section class="rounded-xl border bg-card text-card-foreground shadow overflow-hidden">
    <div class="px-6 py-4 border-b flex flex-col md:flex-row md:items-center justify-between gap-4">
      <h3 class="text-lg font-semibold whitespace-nowrap">Suítes</h3>
      <div class="flex flex-wrap items-center gap-3">
        <div class="relative">
          <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground"><i class="fa-solid fa-magnifying-glass text-xs"></i></span>
          <input type="text" id="busca-suites" class="pn-campo pn-busca" placeholder="Buscar suíte ou arquivo..." aria-label="Buscar suíte">
        </div>
        <div class="pn-botoes" role="group" aria-label="Filtrar por status">
          <button type="button" class="pn-filtro filtro-suite ativo" data-filtro="todas">Todas</button>
          <button type="button" class="pn-filtro filtro-suite pn-st-failed" data-filtro="falhas">Com falhas</button>
          <button type="button" class="pn-filtro filtro-suite pn-st-skippedMassa" data-filtro="pulos">Com pulos</button>
          <button type="button" class="pn-filtro filtro-suite pn-st-passed" data-filtro="ok">Sem falhas</button>
        </div>
      </div>
    </div>
    <div class="overflow-x-auto">
      <table class="pn-tabela">
        <thead><tr>
          ${th('Suíte', 'nome')}
          ${th('Status dos testes', 'falhas')}
          ${th('Aprovação', 'pct', 'num')}
          ${th('Duração', 'dur', 'num')}
        </tr></thead>
        <tbody id="tabela-suites-corpo">
          ${specs.map(linhaSuite).join('\n')}
        </tbody>
      </table>
    </div>
    <div id="suites-vazio" class="hidden py-10 text-center text-sm text-muted-foreground border-t">Nenhuma suíte encontrada. Ajuste a busca ou o filtro.</div>
    <div class="px-6 py-3 border-t text-xs text-muted-foreground bg-muted/20" id="suites-contador"></div>
  </section>`;
}

function renderizarIndice(modelo) {
  const meta = modelo.meta || {};
  const resumo = modelo.resumo || {};
  const specs = modelo.specs || [];
  const flaky = specs.reduce((a, s) => a + C.contarFlaky(s), 0);

  // O índice não precisa dos testes de cada suíte (ficam nas páginas das suítes): tira para o HTML não pesar
  const dados = {
    meta,
    resumo: { ...resumo, flaky },
    specs: specs.map((s) => {
      const { cenarios, ...resto } = s;
      return { ...resto, slug: C.nomeArquivo(s.slug), flaky: C.contarFlaky(s) };
    }),
    falhasPorCategoria: modelo.falhasPorCategoria || [],
    areas: modelo.areas || [],
    contagem: modelo.contagem || null,
  };

  const corpo = `
    ${faixaExecucao(meta, resumo)}
    ${kpis(resumo, flaky)}

    <div class="pn-grade-1-2">
      <section class="rounded-xl border bg-card text-card-foreground shadow p-6 pn-min0">
        <h3 class="pn-titulo-cartao">Status dos testes</h3>
        <div id="grafico-status" class="pn-grafico"></div>
        <p class="pn-nota"><b>Pulado (backlog)</b>: teste desligado de propósito (<code>it.skip</code> ou <code>[SKIP]</code>), fica para depois.<br>
        <b>Pulado por falta de massa</b>: o teste se pulou sozinho porque o dado de que ele precisa não existe no ambiente. Não é falha (regra R-ATEMPORAL).</p>
      </section>
      <section class="rounded-xl border bg-card text-card-foreground shadow p-6 pn-min0">
        <h3 class="pn-titulo-cartao">Status por suíte <span class="normal-case font-normal opacity-70">(clique na barra para abrir)</span></h3>
        <div id="grafico-suites" class="pn-grafico"></div>
      </section>
    </div>

    <div class="pn-grade-2">
      <section class="rounded-xl border bg-card text-card-foreground shadow p-6 pn-min0">
        <h3 class="pn-titulo-cartao">Falhas por categoria</h3>
        <div id="grafico-categorias" class="pn-grafico"></div>
      </section>
      <section class="rounded-xl border bg-card text-card-foreground shadow p-6 pn-min0">
        <h3 class="pn-titulo-cartao">Testes por área</h3>
        <div id="grafico-areas" class="pn-grafico"></div>
      </section>
    </div>

    ${painelContagem(modelo.contagem)}
    ${tabelaSuites(specs)}`;

  return C.pagina({
    titulo: meta.titulo || C.TITULO,
    subtitulo: `Cypress · ${C.formatarData(meta.geradoEm)}`,
    prefixo: '',
    corpo,
    dados: `const chartData = ${C.jsonSeguro(dados)};`,
    geradoEm: meta.geradoEm,
    comModal: false,
  });
}

module.exports = { renderizarIndice };
