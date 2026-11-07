// Configurações iniciais de ambiente
const configEnv = require('../../env.json');
import LoginMocks from '../mocks/2.loginMocks';
import CentralMocks from '../mocks/3.centralMocks';
import IniciarAtendimentoMocks from '../mocks/4.iniciarAtendimentoMocks';
import { rotaApi } from './rotaApi';

// Comando customizado de Login com suporte agnóstico (API Real vs Modo Mock)
Cypress.Commands.add('login', (
  cnpj = Cypress.env('userCnpj') || configEnv.USER_CNPJ,
  usuario = Cypress.env('user') || configEnv.USER_CODE,
  senha = Cypress.env('userPassword') || configEnv.USER_PASSWORD,
  esperarSucesso = true
) => {
  // Puxa a URL base da web diretamente da variável do env.json
  const targetUrl = configEnv.BASE_URL || 'https://app.omnicare.dev.local';
  const isMockMode = Cypress.env('USE_MOCKS') === true || Cypress.env('USE_MOCKS') === 'true';

  // Configura os mocks de autenticação e tela inicial caso esteja no modo mock e o teste espere sucesso
  const setupMocksSeNecessario = () => {
    if (isMockMode && esperarSucesso) {
      LoginMocks.setupMockAuthSession();
      CentralMocks.interceptAttendanceCapabilities();
      CentralMocks.interceptSummaryApi();
      CentralMocks.interceptAttendancesList('*');
      IniciarAtendimentoMocks.interceptarCanais();
      IniciarAtendimentoMocks.interceptarBuscaGrupos();
      IniciarAtendimentoMocks.interceptarMensagensPadrao();
      IniciarAtendimentoMocks.interceptarStandardMessageCapabilities();

      // Intercepta recursos da barra lateral e configs
      cy.intercept('GET', rotaApi('resources*'), {
        statusCode: 200,
        body: {
          resources: {
            central: true,
            attendance: true,
            prescription: true,
            patient: true,
            prescriber: true,
            resale: true,
            redo: true,
            delivery: true,
            financial: true,
            metrics: true,
            report: true
          }
        }
      }).as('getResourcesSession');

      cy.intercept('GET', rotaApi('payment-configs*'), { statusCode: 200, body: { items: [] } }).as('getPaymentConfigsSession');

      // Intercepta status do atendente para evitar 401 e logout durante cy.session
      cy.intercept('GET', rotaApi('attendants/*/status*'), {
        statusCode: 200,
        body: {
          attendant_id: 122,
          status: "available",
          group_relations_count: 1,
          active_attendance_count: 1,
          status_changed_at: new Date().toISOString(),
          status_consistent: true
        }
      }).as('getAttendantStatusSession');

      cy.intercept('GET', rotaApi('attendants/*'), {
        statusCode: 200,
        body: { id: 122, name: "KLISMAM MONTEIRO", status: "available" }
      }).as('getAttendantDetailSession');
    }
  };

  const fillAndSubmit = () => { // Função para preencher e submeter o formulário de login
    setupMocksSeNecessario();
    cy.visit(targetUrl, { retryOnStatusCodeFailure: true });
    cy.get('[id$="-cnpj"]').clear().type(cnpj);
    cy.get('[id$="-usuario"]').clear().type(usuario);
    cy.get('[id$="-senha"]').clear().type(senha, { log: false });
    cy.get('button[type="submit"]').click();
    
    if (esperarSucesso) {
      cy.url().should('not.include', '/login'); // Espera que a URL não contenha '/login' após o login
    }
  };

  const isDefaultUser =
    cnpj === (Cypress.env('userCnpj') || configEnv.USER_CNPJ) &&
    usuario === (Cypress.env('user') || configEnv.USER_CODE) &&
    senha === (Cypress.env('userPassword') || configEnv.USER_PASSWORD);

  if (isDefaultUser && esperarSucesso) {
    cy.session(
      [cnpj, usuario, isMockMode ? 'mock' : 'real'],
      () => {
        fillAndSubmit();
      },
      {
        validate() {
          // Valida se a sessão contém token e o usuário permanece autenticado
          cy.window().then((win) => {
            const token = win.sessionStorage.getItem('omnicare_access_token');
            expect(token).to.be.a('string').and.not.be.empty;
          });
        }
      }
    );

    setupMocksSeNecessario();
    cy.visit(targetUrl, { retryOnStatusCodeFailure: true });
    cy.url().then((currentUrl) => {
      if (currentUrl.includes('/login')) {
        fillAndSubmit();
      }
    });
  } else {
    fillAndSubmit();
  }
});

/**
 * Sanitiza HTML para evitar vazamento acidental de tokens JWT e credenciais no disco.
 */
function sanitizarHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, 'Bearer [TOKEN_JWT_OMITIDO]')
    .replace(/ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, '[TOKEN_OMITIDO]')
    .replace(/authorization:\s*"Bearer\s+[^"]+"/gi, 'authorization: "Bearer [OMITIDO]"');
}

/**
 * cy.salvarSnapshotDom([nomeIdentificador])
 * Captura o documento HTML completo da página atual em qualquer etapa do teste,
 * sanitiza credenciais e salva em cypress/reports/snapshots/snapshot-[nomeIdentificador].html
 */
Cypress.Commands.add('salvarSnapshotDom', (identificador = 'tela-completa') => {
  const nomeLimpo = String(identificador).replace(/[^a-zA-Z0-9_-]/g, '_');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const nomeArquivo = `snapshot_${timestamp}_${nomeLimpo}.html`;

  return cy.window({ log: false }).then((win) => {
    const rawHtml = win.document.documentElement ? win.document.documentElement.outerHTML : '';
    const htmlLimpo = sanitizarHtml(rawHtml);

    return cy.task('salvarSnapshotHtml', {
      nomeArquivo,
      conteudoHtml: htmlLimpo
    }, { log: false }).then((caminho) => {
      Cypress.log({
        name: '📸 SNAPSHOT',
        message: `Salvo: ${nomeArquivo}`,
        consoleProps: () => ({
          Arquivo: nomeArquivo,
          CaminhoCompleto: caminho,
          TamanhoBytes: htmlLimpo.length
        })
      });
      return cy.wrap(caminho, { log: false });
    });
  });
});

/**
 * cy.get(seletor).salvarHtml([nomeIdentificador])
 * Captura o outerHTML de um elemento específico (componente, modal, drawer)
 * e salva em cypress/reports/snapshots/elemento-[nomeIdentificador].html
 */
Cypress.Commands.add('salvarHtml', { prevSubject: 'element' }, (subject, identificador = 'componente') => {
  const nomeLimpo = String(identificador).replace(/[^a-zA-Z0-9_-]/g, '_');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const nomeArquivo = `elemento_${timestamp}_${nomeLimpo}.html`;

  const el = subject[0];
  const rawHtml = el ? el.outerHTML : '';
  const htmlLimpo = sanitizarHtml(rawHtml);

  return cy.task('salvarSnapshotHtml', {
    nomeArquivo,
    conteudoHtml: htmlLimpo
  }, { log: false }).then((caminho) => {
    Cypress.log({
      name: '🧩 ELEM HTML',
      message: `Salvo: ${nomeArquivo}`,
      consoleProps: () => ({
        Elemento: el.tagName.toLowerCase(),
        Arquivo: nomeArquivo,
        CaminhoCompleto: caminho
      })
    });
    return cy.wrap(subject, { log: false });
  });
});

/**
 * cy.inspecionarElemento([seletor]) ou cy.get(...).inspecionarElemento()
 * Exibe no Cypress Command Log e no console da janela de teste um resumo detalhado
 * de todos os atributos, dados de acessibilidade e interatividade do elemento alvo.
 */
Cypress.Commands.add('inspecionarElemento', { prevSubject: ['optional', 'element'] }, (subject, seletor) => {
  const obterElemento = () => {
    if (subject) return cy.wrap(subject, { log: false });
    if (seletor) return cy.get(seletor);
    throw new Error('cy.inspecionarElemento requer um seletor ou ser encadeado após cy.get()');
  };

  return obterElemento().then(($el) => {
    const el = $el[0];
    if (!el) return;

    const atributos = {};
    for (let i = 0; i < el.attributes.length; i++) {
      const attr = el.attributes[i];
      atributos[attr.name] = attr.value;
    }

    const rect = el.getBoundingClientRect();
    const dadosInspecao = {
      tag: el.tagName.toLowerCase(),
      'data-testid': el.getAttribute('data-testid') || '(ausente)',
      'data-cy': el.getAttribute('data-cy') || '(ausente)',
      role: el.getAttribute('role') || '(ausente)',
      'aria-label': el.getAttribute('aria-label') || '(ausente)',
      textoVisivel: el.innerText ? el.innerText.trim().slice(0, 80) : '',
      classes: el.className || '',
      visivel: Cypress.dom.isVisible(el),
      desabilitado: el.disabled || el.getAttribute('aria-disabled') === 'true',
      dimensoes: `${Math.round(rect.width)}x${Math.round(rect.height)}px`
    };

    Cypress.log({
      name: '🔍 INSPEÇÃO',
      message: `<${dadosInspecao.tag}> testid="${dadosInspecao['data-testid']}"`,
      consoleProps: () => ({
        ...dadosInspecao,
        todosAtributos: atributos,
        elementoDom: el
      })
    });

    // Imprime tabela legível no DevTools console da janela
    if (typeof console !== 'undefined' && console.table) {
      console.log(`%c[INSPEÇÃO DE ELEMENTO] <${dadosInspecao.tag}>`, 'color: #3b82f6; font-weight: bold;');
      console.table(dadosInspecao);
    }

    return cy.wrap($el, { log: false });
  });
});

// Dispara um evento `beforeunload` sintético (cancelable) na window e devolve se o handler do app
// chamou preventDefault() - Issue front#472/PR #473. O Cypress não exibe nem permite interagir com
// o diálogo NATIVO do navegador (sempre deixa a navegação prosseguir, CDP não pausa para ele), então
// esta é a única forma confiável de provar que o hook está armado (dirty) ou desarmado (limpo) sem
// depender do diálogo visual - evento sintético roda fora de qualquer navegação real, sem
// side-effect (não recarrega nem fecha a aba). `win.dispatchEvent` devolve `false` quando o evento é
// cancelable e algum handler chamou `preventDefault()`.
Cypress.Commands.add('beforeUnloadFoiPrevenido', () => {
  return cy.window({ log: false }).then((win) => {
    const evento = new Event('beforeunload', { cancelable: true });
    const prosseguiuSemPrevenir = win.dispatchEvent(evento);
    Cypress.log({
      name: '🚪 beforeunload',
      message: prosseguiuSemPrevenir ? 'não prevenido (sem dirty state)' : 'prevenido (preventDefault chamado)'
    });
    return !prosseguiuSemPrevenir;
  });
});

// Força a media feature `prefers-reduced-motion` via Chrome DevTools Protocol (CDP) -
// Issue front#524/PR #532. Cypress não expõe essa emulação como comando nativo (só viewport e
// color-scheme são suportados via config); `Emulation.setEmulatedMedia` é repassado direto ao
// Chrome pelo canal `remote:debugger:protocol` do driver (família chromium apenas - no-op em
// Electron/Firefox, por isso `AGENTS.md [R-RUN]` exige --browser chrome aqui).
Cypress.Commands.add('forcarPrefersReducedMotion', (ativo = true) => {
  return cy.wrap(null, { log: false }).then(() => {
    return Cypress.automation('remote:debugger:protocol', {
      command: 'Emulation.setEmulatedMedia',
      params: { features: [{ name: 'prefers-reduced-motion', value: ativo ? 'reduce' : 'no-preference' }] }
    });
  });
});