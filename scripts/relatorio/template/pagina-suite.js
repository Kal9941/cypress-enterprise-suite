/**
 * Página de uma suíte (features/<slug>.html): totais, gráficos, contextos
 * e a lista de testes expansíveis.
 */
const C = require('./comum');
const { esc } = C;

const ICONE_PASSO = {
  passed: 'fa-circle-check pn-cor pn-st-passed',
  failed: 'fa-circle-xmark pn-cor pn-st-failed',
  skipped: 'fa-circle-minus pn-cor pn-st-skipped',
};

// Chip de issue/PR; sem URL http(s) válida vira texto simples
function chipRef(ref) {
  const rotulo = `${ref.tipo === 'pr' ? 'PR' : 'Issue'} ${ref.repo}#${ref.numero}`;
  const icone = ref.tipo === 'pr' ? 'fa-code-pull-request' : 'fa-circle-dot';
  const url = C.urlSegura(ref.url);
  if (!url) return `<span class="pn-ficha"><i class="fa-solid ${icone}"></i>${esc(rotulo)}</span>`;
  return `<a class="pn-ficha" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="Abrir ${esc(rotulo)} em nova aba"><i class="fa-solid ${icone}"></i>${esc(rotulo)} <i class="fa-solid fa-arrow-up-right-from-square text-[9px] opacity-60"></i></a>`;
}

function chipArea(area) {
  return `<span class="pn-ficha"><i class="fa-solid fa-layer-group text-[10px]"></i>${esc(area)}</span>`;
}

// Texto de um data URI (base64 ou percent-encoding), em UTF-8; '' se não for decodificável
function textoDoDataUri(uri) {
  const i = String(uri || '').indexOf(',');
  if (i < 0) return '';
  const cabecalho = uri.slice(0, i);
  const dados = uri.slice(i + 1);
  try {
    return /;base64/i.test(cabecalho) ? Buffer.from(dados, 'base64').toString('utf8') : decodeURIComponent(dados);
  } catch (e) {
    return '';
  }
}

function blocoErro(erro, idBase) {
  // O bloco de código traz o trecho completo (ou a mensagem, se não houver trecho);
  // a mensagem em destaque é só a primeira linha, como resumo.
  const trecho = erro.trecho || erro.mensagem || '';
  const resumo = erro.trecho && erro.mensagem ? String(erro.mensagem).split('\n')[0] : '';
  return `<div>
    <p class="pn-secao-titulo">Falha</p>
    <div class="pn-erro">
      <div class="pn-erro-cab">
        <span class="pn-erro-cat"><i class="fa-solid fa-bug"></i> ${esc(erro.categoria || 'Erro sem categoria')}</span>
        <button type="button" class="pn-botao pn-copiar" data-alvo="${idBase}-erro"><i class="fa-solid fa-copy"></i><span>Copiar erro</span></button>
      </div>
      ${resumo ? `<p class="pn-erro-msg">${esc(resumo)}</p>` : ''}
      <pre class="pn-codigo" id="${idBase}-erro">${esc(trecho)}</pre>
    </div>
  </div>`;
}

function blocoPassos(passos) {
  const linhas = passos.map((p, n) => {
    const origem = p.origem === 'cy.log' ? 'cy.log' : 'comando automático';
    const icone = ICONE_PASSO[p.status] || 'fa-circle text-muted-foreground';
    return `<li class="pn-passo">
      <span class="pn-passo-n">${n + 1}</span>
      <i class="fa-solid ${icone} text-sm" style="margin-top:.15rem" title="${esc(p.status || '')}"></i>
      <span class="pn-passo-texto">${esc(p.texto)}</span>
      <span class="pn-passo-origem" title="${p.origem === 'cy.log' ? 'Passo escrito no teste (cy.log)' : 'Registrado automaticamente a partir do comando do Cypress'}">${origem}</span>
      <span class="pn-passo-dur">${p.duracaoMs === null || p.duracaoMs === undefined ? '' : esc(C.duracao(p.duracaoMs))}</span>
    </li>`;
  });
  return `<div>
    <p class="pn-secao-titulo">Passos (${passos.length})</p>
    <ol class="pn-passos">${linhas.join('')}</ol>
  </div>`;
}

function blocoAnexos(anexos, i, idBase) {
  const itens = anexos.map((a, j) => {
    if (a.tipo === 'log') {
      const texto = a.dataUri ? textoDoDataUri(a.dataUri) : '';
      if (texto) {
        return `<div style="flex-basis:100%">
          <div class="flex items-center justify-between gap-2 mb-1">
            <span class="text-xs font-semibold"><i class="fa-solid fa-terminal"></i> ${esc(a.titulo || 'Log')}</span>
            <button type="button" class="pn-botao pn-copiar" data-alvo="${idBase}-log${j}"><i class="fa-solid fa-copy"></i><span>Copiar log</span></button>
          </div>
          <pre class="pn-codigo" style="margin:0" id="${idBase}-log${j}">${esc(texto)}</pre>
        </div>`;
      }
      const url = a.arquivo ? `../${a.arquivo}` : '';
      return url
        ? `<a class="pn-botao" href="${esc(url)}" target="_blank" rel="noopener"><i class="fa-solid fa-terminal"></i>${esc(a.titulo || 'Log')}</a>`
        : `<span class="pn-ficha">${esc(a.titulo || 'Log')} (sem conteúdo)</span>`;
    }
    // Screenshot (ou qualquer imagem): abre no modal; o conteúdo vem do featureData
    return `<button type="button" class="pn-botao modal-trigger" data-ref="${i}.${j}"><i class="fa-solid fa-image"></i>${esc(a.titulo || 'Captura de tela')}</button>`;
  });
  return `<div>
    <p class="pn-secao-titulo">Anexos (${anexos.length})</p>
    <div class="pn-linhas">${itens.join('')}</div>
  </div>`;
}

function cartaoTeste(c, i, ids) {
  let idBase = `t-${String(c.id).replace(/[^A-Za-z0-9]+/g, '-')}`;
  if (ids.has(idBase)) idBase = `${idBase}-${i}`;
  ids.add(idBase);

  const erro = c.erro || null;
  const areas = c.areas || [];
  const refs = c.issues || [];
  const passos = c.passos || [];
  const anexos = c.anexos || [];
  const busca = [c.id, c.titulo, erro && erro.categoria, erro && erro.mensagem, areas.join(' '), refs.map((r) => `${r.repo}#${r.numero}`).join(' ')]
    .filter(Boolean).join(' ').toLowerCase();
  const tentativas = c.tentativas || 1;

  const detalhes = [];
  detalhes.push(`<div class="pn-linhas">
    ${C.selo(c.status)}
    <span class="text-muted-foreground"><i class="fa-regular fa-clock"></i> ${esc(C.duracao(c.duracaoMs))}</span>
    <span class="text-muted-foreground"><i class="fa-solid fa-rotate"></i> ${tentativas} ${tentativas === 1 ? 'tentativa' : 'tentativas'}</span>
    ${c.flaky ? '<span class="pn-selo pn-st-flaky" title="Falhou na 1ª tentativa e passou na 2ª"><i class="fa-solid fa-shuffle"></i>Instável (flaky): passou só na 2ª tentativa</span>' : ''}
  </div>`);
  if (areas.length || refs.length) {
    detalhes.push(`<div class="pn-linhas">${areas.map(chipArea).join('')}${refs.map(chipRef).join('')}</div>`);
  }
  if (c.motivoPulo) {
    detalhes.push(`<div class="pn-pulo pn-st-${c.status === 'skippedMassa' ? 'skippedMassa' : 'skipped'}">
      <i class="fa-solid ${c.status === 'skippedMassa' ? 'fa-database' : 'fa-forward'} pn-cor" style="margin-top:.15rem"></i>
      <div><b>${c.status === 'skippedMassa' ? 'Pulado por falta de massa' : 'Motivo do pulo'}</b><br>${esc(c.motivoPulo)}</div>
    </div>`);
  }
  if (erro) detalhes.push(blocoErro(erro, idBase));
  if (passos.length) detalhes.push(blocoPassos(passos));
  if (anexos.length) detalhes.push(blocoAnexos(anexos, i, idBase));

  return `<details class="pn-teste pn-st-${esc(c.status)}" id="${idBase}"${c.status === 'failed' ? ' open' : ''}
      data-status="${esc(c.status)}" data-ctx="${esc(c.contexto)}" data-areas="${esc(areas.join('|'))}" data-busca="${esc(busca)}">
    <summary>
      <i class="fa-solid fa-chevron-right pn-seta text-xs"></i>
      <i class="fa-solid ${C.ICONES[c.status] || 'fa-circle'} pn-cor text-lg shrink-0" title="${esc(C.ROTULOS[c.status] || c.status)}"></i>
      <span class="pn-teste-id">${esc(c.id)}</span>
      <span class="pn-teste-titulo">${esc(c.titulo)}</span>
      ${c.flaky ? '<span class="pn-selo pn-st-flaky"><i class="fa-solid fa-shuffle"></i>flaky</span>' : ''}
      <span class="font-mono text-[11px] text-muted-foreground shrink-0">${esc(C.duracao(c.duracaoMs))}</span>
    </summary>
    <div class="pn-teste-corpo">
      ${detalhes.join('\n')}
    </div>
  </details>`;
}

function tabelaContextos(contexts) {
  const contagem = (t, s) => `<span class="pn-st-${s} pn-cor" title="${esc(C.ROTULOS[s])}">${(t && t[s]) || 0}</span>`;
  const linhas = contexts.map((ctx) => `<tr class="cursor-pointer" data-filtra-contexto="${esc(ctx.numero)}" title="Clique para filtrar os testes deste contexto">
    <td class="font-mono text-xs">${esc(ctx.numero)}</td>
    <td style="min-width:14rem">${esc(ctx.nome)}</td>
    <td>${ctx.area ? chipArea(ctx.area) : '<span class="opacity-40">—</span>'}</td>
    <td class="num" style="white-space:nowrap">${C.STATUS.map((s) => contagem(ctx.totais, s)).join(' <span class="opacity-30">/</span> ')}</td>
    <td><div class="pn-linhas">${(ctx.issues || []).map(chipRef).join('') || '<span class="opacity-40">—</span>'}</div></td>
  </tr>`);
  return `<div class="overflow-x-auto mt-4">
    <table class="pn-tabela">
      <thead><tr><th>Nº</th><th>Contexto</th><th>Área</th><th class="num" title="passou / falhou / pulado (backlog) / pulado por falta de massa">P / F / Pul. / S. massa</th><th>Issues e PRs</th></tr></thead>
      <tbody>${linhas.join('')}</tbody>
    </table>
  </div>`;
}

function renderizarSuite(spec, meta) {
  meta = meta || {};
  const t = spec.totais || {};
  const cenarios = spec.cenarios || [];
  const contexts = spec.contexts || [];
  const flaky = C.contarFlaky(spec);
  const ids = new Set();
  const areasUnicas = Array.from(new Set(cenarios.flatMap((c) => c.areas || []))).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const filtroStatus = (valor, rotulo, classe) =>
    `<button type="button" class="pn-filtro filtro-status ${classe || ''}${valor === 'all' ? ' ativo' : ''}" data-status="${valor}">${rotulo}</button>`;

  const corpo = `
    <nav class="flex items-center gap-2 text-sm text-muted-foreground" aria-label="Navegação">
      <a href="../index.html" class="hover:text-foreground transition-colors"><i class="fa-solid fa-arrow-left text-xs"></i> Painel</a>
      <span>/</span>
      <span class="text-foreground font-medium">Suíte</span>
    </nav>

    <section class="rounded-xl border bg-card text-card-foreground shadow p-4 md:p-6">
      <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
        <div class="space-y-3 min-w-0">
          <h2 class="text-xl md:text-2xl font-bold leading-tight">${esc(spec.nome || spec.id)}</h2>
          <div class="pn-linhas text-muted-foreground">
            <span class="pn-teste-id">${esc(spec.id)}</span>
            ${spec.arquivo ? `<span class="font-mono text-xs"><i class="fa-solid fa-file-code"></i> ${esc(spec.arquivo)}</span>` : ''}
            <span class="text-xs"><i class="fa-regular fa-clock"></i> ${esc(C.duracao(spec.duracaoMs))}</span>
            ${meta.branch ? `<span class="text-xs"><i class="fa-solid fa-code-branch"></i> ${esc(meta.branch)}</span>` : ''}
          </div>
        </div>
        <div class="pn-kpis pn-kpis-3">
          ${C.cartaoKpi('total', t.total || 0, 'Testes')}
          ${C.cartaoKpi('passed', t.passed || 0, C.ROTULOS.passed)}
          ${C.cartaoKpi('failed', t.failed || 0, C.ROTULOS.failed)}
          ${C.cartaoKpi('skipped', t.skipped || 0, C.ROTULOS.skipped)}
          ${C.cartaoKpi('skippedMassa', t.skippedMassa || 0, C.ROTULOS.skippedMassa)}
          ${C.cartaoKpi('flaky', flaky, 'Instáveis')}
        </div>
      </div>
    </section>

    <div class="pn-grade-1-2">
      <section class="rounded-xl border bg-card text-card-foreground shadow p-6 pn-min0">
        <h3 class="pn-titulo-cartao">Status dos testes</h3>
        <div id="grafico-status" class="pn-grafico"></div>
      </section>
      <section class="rounded-xl border bg-card text-card-foreground shadow p-6 pn-min0">
        <h3 class="pn-titulo-cartao">Testes mais lentos (top 10)</h3>
        <div id="grafico-lentos" class="pn-grafico"></div>
      </section>
    </div>

    <section class="rounded-xl border bg-card text-card-foreground shadow p-6 pn-min0">
      <h3 class="pn-titulo-cartao">Contextos</h3>
      <div id="grafico-contextos" class="pn-grafico"></div>
      ${tabelaContextos(contexts)}
    </section>

    <section class="space-y-4" id="lista-testes">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <h3 class="text-xl font-bold">Testes</h3>
        <div class="flex flex-wrap items-center gap-3">
          <div class="relative">
            <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground"><i class="fa-solid fa-magnifying-glass text-xs"></i></span>
            <input type="text" id="busca-testes" class="pn-campo pn-busca" placeholder="Buscar por id, título, erro..." aria-label="Buscar testes">
          </div>
          <select id="filtro-contexto" class="pn-campo" aria-label="Filtrar por contexto">
            <option value="">Todos os contextos</option>
            ${contexts.map((ctx) => `<option value="${esc(ctx.numero)}">${esc(ctx.numero)} · ${esc(ctx.nome)}</option>`).join('')}
          </select>
          <select id="filtro-area" class="pn-campo" aria-label="Filtrar por área">
            <option value="">Todas as áreas</option>
            ${areasUnicas.map((a) => `<option value="${esc(a)}">${esc(a)}</option>`).join('')}
          </select>
          <div class="pn-botoes" role="group" aria-label="Filtrar por status">
            ${filtroStatus('all', 'Todos')}
            ${filtroStatus('passed', 'Passou', 'pn-st-passed')}
            ${filtroStatus('failed', 'Falhou', 'pn-st-failed')}
            ${filtroStatus('skipped', 'Pulado (backlog)', 'pn-st-skipped')}
            ${filtroStatus('skippedMassa', 'Sem massa', 'pn-st-skippedMassa')}
          </div>
        </div>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span id="testes-contador"></span>
        <span class="flex gap-2">
          <button type="button" class="pn-botao" id="expandir-todos"><i class="fa-solid fa-angles-down"></i>Expandir todos</button>
          <button type="button" class="pn-botao" id="recolher-todos"><i class="fa-solid fa-angles-up"></i>Recolher todos</button>
        </span>
      </div>
      <div id="testes-vazio" class="hidden py-12 text-center bg-muted/20 rounded-xl border border-dashed text-sm text-muted-foreground">Nenhum teste encontrado. Ajuste os filtros ou a busca.</div>
      <div class="space-y-3" id="testes-container">
        ${cenarios.map((c, i) => cartaoTeste(c, i, ids)).join('\n')}
      </div>
    </section>`;

  return C.pagina({
    titulo: `${spec.nome || spec.id} — ${C.TITULO}`,
    subtitulo: `Suíte ${spec.id}`,
    prefixo: '../',
    corpo,
    dados: `const featureData = ${C.jsonSeguro(spec)};`,
    geradoEm: meta.geradoEm,
    comModal: true,
  });
}

module.exports = { renderizarSuite };
