// Trace de falha para diagnóstico de rodadas feitas pelo operador no `cypress open`.
//
// Problema que resolve: o artefato padrão de falha (`cypress/reports/failures/<label>/`) grava o erro e
// o DOM final, mas não diz em qual navegador/versão rodou, se a janela tinha foco (decisivo em testes de
// hover/foco no Firefox), quais requisições aconteceram, o que o app escreveu no console nem como estava
// o elemento que o erro cita. Sem isso, "falha no Firefox" não é diagnosticável por quem não está na tela.
//
// Ativação: só no modo interativo (`cypress open`) ou com `--env TRACE_FALHAS=true`. Fora disso o módulo
// não registra nada, então CI, Lambda e `cypress run` seguem sem custo extra.
//
// Saída (gravada só quando um teste falha):
//   cypress/reports/trace/<SESSION_LABEL>/<teste>.json   um arquivo por teste que falhou
//   cypress/reports/trace/ultimo.json                    a falha mais recente, de qualquer rótulo
// `cypress/reports/` é git-ignorado. Ver `.agents/AGENTS.md` [R-TOOLS].

const LIMITE_COMANDOS = 80;
const LIMITE_REDE = 80;
const LIMITE_CONSOLE = 60;

const ativo = () => {
  const flag = Cypress.env('TRACE_FALHAS');
  return Cypress.config('isInteractive') === true || flag === true || flag === 'true';
};

// Buffers em memória, zerados a cada teste. Guardam só os últimos N eventos.
let comandos = [];
let rede = [];
let consoleApp = [];
let errosPagina = [];
const porId = new Map();

const cortar = (valor, max = 220) => {
  let texto;
  try {
    texto = typeof valor === 'string' ? valor : JSON.stringify(valor);
  } catch (e) {
    texto = String(valor);
  }
  texto = texto == null ? '' : texto;
  return texto.length > max ? `${texto.slice(0, max)}…` : texto;
};

const empilhar = (lista, item, limite) => {
  lista.push(item);
  if (lista.length > limite) lista.shift();
};

const REDE = new Set(['xhr', 'fetch', 'request']);

if (typeof Cypress !== 'undefined') {
  Cypress.on('test:before:run', () => {
    if (!ativo()) return;
    comandos = [];
    rede = [];
    consoleApp = [];
    errosPagina = [];
    porId.clear();
  });

  // Console e erros não tratados do app sob teste. O wrap é passivo: chama o método original.
  Cypress.on('window:before:load', (win) => {
    if (!ativo()) return;
    ['error', 'warn'].forEach((nivel) => {
      const original = win.console[nivel];
      win.console[nivel] = (...args) => {
        empilhar(consoleApp, { nivel, t: Date.now(), texto: cortar(args.map((a) => (a && a.message) || String(a)).join(' '), 300) }, LIMITE_CONSOLE);
        return original.apply(win.console, args);
      };
    });
    win.addEventListener('error', (e) => empilhar(errosPagina, { tipo: 'error', t: Date.now(), texto: cortar(e.message, 300) }, LIMITE_CONSOLE));
    win.addEventListener('unhandledrejection', (e) => empilhar(errosPagina, { tipo: 'unhandledrejection', t: Date.now(), texto: cortar((e.reason && e.reason.message) || String(e.reason), 300) }, LIMITE_CONSOLE));
  });

  // Linha do tempo de comandos e de requisições, lida do próprio Command Log (não interfere nos intercepts).
  Cypress.on('log:added', (attrs) => {
    if (!ativo()) return;
    const base = { t: Date.now(), nome: attrs.name, estado: attrs.state, mensagem: cortar(attrs.message) };
    if (REDE.has(attrs.name)) {
      const item = { ...base, alias: attrs.alias || undefined };
      porId.set(attrs.id, item);
      empilhar(rede, item, LIMITE_REDE);
    } else if (attrs.instrument === 'command') {
      const item = { ...base };
      porId.set(attrs.id, item);
      empilhar(comandos, item, LIMITE_COMANDOS);
    }
  });

  Cypress.on('log:changed', (attrs) => {
    if (!ativo()) return;
    const item = porId.get(attrs.id);
    if (!item) return;
    item.estado = attrs.state;
    if (attrs.message != null) item.mensagem = cortar(attrs.message);
    if (attrs.alias) item.alias = attrs.alias;
  });
}

// Extrai seletores citados na mensagem de erro do Cypress, sem a pseudo-classe :visible
// (queremos saber se o elemento existe, mesmo oculto).
const extrairSeletores = (mensagem) => {
  const achados = new Set();
  const texto = String(mensagem || '');
  for (const m of texto.matchAll(/`([^`\n]{2,200})`/g)) {
    // Descarta nomes de arquivo citados na mensagem (ex.: env.json) e aceita só o que parece seletor CSS.
    if (/\.(json|js|ts|md|html|log)$/i.test(m[1])) continue;
    if (/[.#\[\]>]|^[a-z]+$/i.test(m[1])) achados.add(m[1]);
  }
  for (const m of texto.matchAll(/Expected <([^>\s]{2,120})>/g)) achados.add(m[1]);
  return [...achados]
    .flatMap((s) => s.split(/,(?![^\[]*\])/))
    .map((s) => s.replace(/:visible/g, '').trim())
    .filter(Boolean)
    .slice(0, 6);
};

const resumo = (el) => {
  if (!el) return null;
  const testid = el.getAttribute('data-testid');
  const classes = (el.getAttribute('class') || '').trim().split(/\s+/).join('.');
  return `${el.tagName.toLowerCase()}${testid ? `[data-testid=${testid}]` : ''}.${cortar(classes, 80)}`;
};

// Veredito do próprio Cypress sobre visibilidade (é o que o `:visible` usa) e o motivo textual dele.
const visibilidadeCypress = (el) => {
  try {
    const $el = Cypress.$(el);
    const visivel = Cypress.dom.isVisible($el);
    return { visivelParaCypress: visivel, motivoOculto: visivel ? undefined : cortar(Cypress.dom.getReasonIsHidden($el), 400) };
  } catch (e) {
    return { visivelParaCypress: null, motivoOculto: `indisponível: ${cortar(e.message, 80)}` };
  }
};

// Ancestrais que recortam o elemento (overflow diferente de visible e caixa menor que o elemento).
const recortadoPor = (el, win) => {
  const r = el.getBoundingClientRect();
  const lista = [];
  for (let p = el.parentElement; p && p !== el.ownerDocument.documentElement; p = p.parentElement) {
    const c = win.getComputedStyle(p);
    if (c.overflow === 'visible' && c.overflowX === 'visible' && c.overflowY === 'visible') continue;
    const pr = p.getBoundingClientRect();
    if (r.left < pr.left || r.right > pr.right || r.top < pr.top || r.bottom > pr.bottom) {
      lista.push({ ancestral: resumo(p), overflow: `${c.overflowX}/${c.overflowY}` });
    }
    if (lista.length >= 3) break;
  }
  return lista;
};

const descrever = (el, win) => {
  const css = win.getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const cx = Math.round(r.x + r.width / 2);
  const cy = Math.round(r.y + r.height / 2);
  const topo = r.width > 0 && r.height > 0 ? el.ownerDocument.elementFromPoint(cx, cy) : null;
  const coberto = !!topo && topo !== el && !el.contains(topo);
  return {
    ...visibilidadeCypress(el),
    position: css.position,
    cobertoPor: coberto ? resumo(topo) : null,
    recortadoPor: recortadoPor(el, win),
    tag: el.tagName.toLowerCase(),
    classes: cortar(el.getAttribute('class') || '', 120),
    testid: el.getAttribute('data-testid') || undefined,
    role: el.getAttribute('role') || undefined,
    ariaDescribedby: el.getAttribute('aria-describedby') || undefined,
    ariaLabel: cortar(el.getAttribute('aria-label') || '', 80) || undefined,
    texto: cortar((el.textContent || '').trim(), 100),
    rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    display: css.display,
    visibility: css.visibility,
    opacity: css.opacity,
    pointerEvents: css.pointerEvents,
    ariaHidden: el.getAttribute('aria-hidden') || undefined,
    emViewport: r.bottom > 0 && r.right > 0 && r.top < win.innerHeight && r.left < win.innerWidth,
    ehFoco: el.ownerDocument.activeElement === el,
    html: cortar(el.outerHTML, 320),
  };
};

const sondarSeletor = (doc, win, seletor) => {
  try {
    const lista = [...doc.querySelectorAll(seletor)];
    return { seletor, total: lista.length, amostra: lista.slice(0, 3).map((el) => descrever(el, win)) };
  } catch (e) {
    return { seletor, erro: cortar(e.message, 120) };
  }
};

// Contagens fixas de elementos de aviso/overlay: tooltip e diálogo costumam ser o que falta ou sobra.
const SONDAS_FIXAS = ['[role="tooltip"]', '[role="alert"]', '[role="status"]', '[role="dialog"]'];

afterEach(function () {
  if (!ativo() || !this.currentTest || this.currentTest.state !== 'failed') return;
  const teste = this.currentTest;
  const erro = teste.err || {};
  const rotulo = Cypress.env('SESSION_LABEL') || 'sem-rotulo';
  const specPath = Cypress.spec ? Cypress.spec.relative : (teste.file || '');
  const slug = teste.title.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').substring(0, 70);

  cy.window({ log: false }).then((win) => {
    const doc = win.document;
    const mq = (q) => { try { return win.matchMedia(q).matches; } catch (e) { return null; } };
    const trace = {
      geradoEm: new Date().toISOString(),
      rotulo,
      modo: Cypress.config('isInteractive') ? 'open' : 'run',
      navegador: {
        nome: Cypress.browser && Cypress.browser.name,
        versao: Cypress.browser && Cypress.browser.version,
        familia: Cypress.browser && Cypress.browser.family,
        comTela: Cypress.browser && Cypress.browser.isHeaded,
        userAgent: win.navigator.userAgent,
      },
      spec: specPath,
      suite: teste.parent && teste.parent.title,
      teste: teste.title,
      duracaoMs: teste.duration,
      useMocks: Cypress.env('USE_MOCKS'),
      erro: {
        mensagem: cortar(erro.message, 1200),
        stack: cortar((erro.stack || '').split('\n').slice(0, 14).join('\n'), 1800),
      },
      janela: {
        url: win.location.href,
        largura: win.innerWidth,
        altura: win.innerHeight,
        pixelRatio: win.devicePixelRatio,
        // Em Firefox sem foco de janela, hover e foco por teclado deixam de disparar tooltips e popovers.
        documentoComFoco: doc.hasFocus(),
        visibilityState: doc.visibilityState,
        prefereMenosMovimento: mq('(prefers-reduced-motion: reduce)'),
        elementoAtivo: doc.activeElement ? descrever(doc.activeElement, win) : null,
      },
      seletoresDoErro: extrairSeletores(erro.message).map((s) => sondarSeletor(doc, win, s)),
      sondasFixas: SONDAS_FIXAS.map((s) => {
        try { return { seletor: s, total: doc.querySelectorAll(s).length }; } catch (e) { return { seletor: s, erro: true }; }
      }),
      rede: rede.slice(),
      comandos: comandos.slice(),
      consoleApp: consoleApp.slice(),
      errosPagina: errosPagina.slice(),
    };

    cy.writeFile(`cypress/reports/trace/${rotulo}/${slug}.json`, trace, { log: false });
    cy.writeFile('cypress/reports/trace/ultimo.json', trace, { log: false });
  });
});
