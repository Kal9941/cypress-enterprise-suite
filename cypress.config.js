const { defineConfig } = require("cypress");
const path = require('path');
const configEnv = require('./env.json'); // Carrega variáveis de ambiente do arquivo env.json
const {
  beforeRunHook: mochawesomeBeforeRunHook,
  afterRunHook: mochawesomeAfterRunHook,
} = require('cypress-mochawesome-reporter/lib');

// Função para formatar a data e hora atual no padrão brasileiro (Ex: 06-08-2026_09-42-45)
const data = new Date();
const pad = (n) => String(n).padStart(2, '0');
const dataFormatada = `${pad(data.getDate())}-${pad(data.getMonth() + 1)}-${data.getFullYear()}`;
const horaFormatada = `${pad(data.getHours())}-${pad(data.getMinutes())}-${pad(data.getSeconds())}`;

const timestamp = `${dataFormatada}_${horaFormatada}`;

/**
 * Resolve o rótulo da sessão/aba multi-instância para namespacing de artefatos compartilhados
 * (failures, downloads) — ver `.agents/AGENTS.md` "Coordenação Multi-Sessão" e ROADMAP P0
 * "Arquitetura de Testes para Múltiplas Instâncias".
 *
 * Sem isso, duas instâncias do Cypress rodando ao mesmo tempo (ex: aba-A na spec 5, aba-B na
 * spec 0) escreviam nos MESMOS caminhos fixos (`cypress/reports/failures/*`,
 * `cypress/downloads/*`), e o `before()` de qualquer uma delas apagava a pasta inteira no
 * início de cada execução — destruindo o diagnóstico da outra instância ainda em andamento
 * (achado real, 23/09/2026).
 *
 * Uso: `cypress run --env SESSION_LABEL=aba-A`. Sem rótulo explícito, cai num fallback por PID
 * do processo Node do Cypress — garante que duas instâncias concorrentes SEM rótulo nunca
 * colidam entre si (ainda que gerem pastas órfãs com o tempo; o operador pode limpar
 * manualmente subpastas antigas de `sessao-pid-*` quando conveniente).
 * @param {object} env Objeto `config.env` já mesclado com overrides de `--env`
 * @returns {string} Rótulo seguro para uso em nome de diretório
 */
function resolveSessionLabel(env) {
  const bruto = (env && env.SESSION_LABEL) ? String(env.SESSION_LABEL).trim() : '';
  const seguro = bruto.replace(/[^a-zA-Z0-9_-]/g, '_');
  return seguro || `sessao-pid-${process.pid}`;
}

// ---------------------------------------------------------------------------
// Registro de Execução Ativa (`.claude/active-runs.json`) — ROADMAP P0
// "Arquitetura de Testes para Múltiplas Instâncias", item 2.
//
// Mesmo soft-lock cooperativo já aceito pelo projeto para EDIÇÃO de arquivo-fonte
// (`.claude/locks.json`, ver `.agents/AGENTS.md` "Coordenação Multi-Sessão"), aplicado agora à
// EXECUÇÃO de `cypress run`/`cypress open` — que aquele mecanismo nunca cobriu. Diferente do
// locks.json (mantido manualmente pelo agente), este registro é gravado automaticamente pelo
// próprio Cypress via node events (`before:run`/`before:spec`/`after:run`), então não depende de
// nenhuma sessão lembrar de anotar nada: toda execução real se autorregistra.
//
// Uso pretendido: antes de disparar uma nova `cypress run`/`open` em modo API Real com
// `AUTO_SYNC_MOCKS=true` (o cenário de corrida documentado no ROADMAP), o agente pode ler este
// arquivo e alertar o operador se outra sessão com rótulo diferente já estiver ativa há menos de
// 4h. Mesma limitação conhecida do locks.json: é cooperativo, não é uma trava física (duas
// gravações quase simultâneas podem colidir num read-modify-write não atômico) — aceitável pelo
// mesmo padrão já documentado em `.agents/AGENTS.md`.
const ACTIVE_RUNS_PATH = path.join(__dirname, 'cypress', 'reports', 'active-runs.json');
const ACTIVE_RUN_STALE_MS = 4 * 60 * 60 * 1000; // 4h — mesmo limiar de "lock abandonado" do locks.json

function lerExecucoesAtivas() {
  const fs = require('fs');
  if (!fs.existsSync(ACTIVE_RUNS_PATH)) return {};
  try {
    const conteudo = JSON.parse(fs.readFileSync(ACTIVE_RUNS_PATH, 'utf-8'));
    return (conteudo && typeof conteudo === 'object') ? conteudo : {};
  } catch (e) {
    // Arquivo corrompido/sendo escrito por outra sessão no exato instante — trata como vazio
    return {};
  }
}

function gravarExecucoesAtivas(execucoes) {
  const fs = require('fs');
  fs.mkdirSync(path.dirname(ACTIVE_RUNS_PATH), { recursive: true });
  fs.writeFileSync(ACTIVE_RUNS_PATH, JSON.stringify(execucoes, null, 2), 'utf-8');
}

// Remove entradas de sessões que nunca chegaram a desregistrar (crash, kill -9, queda de energia)
// — sem isso, o arquivo cresceria para sempre com sessões "fantasma".
function podarExecucoesAntigas(execucoes) {
  const agora = Date.now();
  Object.keys(execucoes).forEach((chave) => {
    const iniciadoEm = Date.parse((execucoes[chave] && execucoes[chave].startedAt) || '');
    if (!iniciadoEm || (agora - iniciadoEm) > ACTIVE_RUN_STALE_MS) {
      delete execucoes[chave];
    }
  });
  return execucoes;
}

function registrarExecucaoAtiva(sessionLabel, detalhes) {
  const execucoes = podarExecucoesAntigas(lerExecucoesAtivas());
  execucoes[sessionLabel] = {
    sessionLabel,
    pid: process.pid,
    mode: detalhes.mode,
    spec: detalhes.spec,
    useMocks: detalhes.useMocks,
    autoSyncMocks: detalhes.autoSyncMocks,
    startedAt: new Date().toISOString(),
  };
  gravarExecucoesAtivas(execucoes);
}

function atualizarSpecAtual(sessionLabel, specRelativo) {
  const execucoes = lerExecucoesAtivas();
  if (!execucoes[sessionLabel]) return; // sessão pode ter sido podada por staleness; não recria
  execucoes[sessionLabel].spec = specRelativo;
  execucoes[sessionLabel].updatedAt = new Date().toISOString();
  gravarExecucoesAtivas(execucoes);
}

function removerExecucaoAtiva(sessionLabel) {
  const execucoes = lerExecucoesAtivas();
  delete execucoes[sessionLabel];
  gravarExecucoesAtivas(execucoes);
}

module.exports = defineConfig({
  reporter: 'cypress-multi-reporters',
  reporterOptions: {
    reporterEnabled: 'cypress-mochawesome-reporter, mocha-junit-reporter',

    // Configurações do Relatório HTML (Mochawesome)
    cypressMochawesomeReporterReporterOptions: {
      reportDir: 'cypress/reports/html',
      reportFilename: `relatorio-execucao_${timestamp}_[name]`,
      reportPageTitle: 'Testes E2E - OmniCare Enterprise',
      charts: true,
      embeddedScreenshots: true,
      inlineAssets: true,
      saveAllAttempts: false,
      overwrite: false,
      // Evita que o before:run de uma instância apague a pasta .jsons/ compartilhada enquanto
      // outra instância concorrente ainda está gerando seu relatório (ROADMAP P0 "Arquitetura de
      // Testes para Múltiplas Instâncias") — flag nativa do cypress-mochawesome-reporter que pula
      // a limpeza do .jsons no before:run (ver node_modules/cypress-mochawesome-reporter/lib/index.js).
      cypressParallel: true,
    },

    // Configurações do Relatório XML (JUnit)
    mochaJunitReporterReporterOptions: {
      mochaFile: `cypress/reports/junit/test-results_${timestamp}-[hash].xml`,
      toConsole: true,
    },
  },
  chromeWebSecurity: false,
  numTestsKeptInMemory: 1,
  experimentalMemoryManagement: true,
  watchForFileChanges: false, // PREVINE LOOP INFINITO! O cy.writeFile() dos Mocks acionava o HMR do Cypress open, fazendo o teste reiniciar eternamente
  // Só no CI (o GitHub Actions define CI=true): reexecuta 1 vez o teste que falhou, inclusive falha de beforeEach. Existe por causa de rede transitória no cy.visit
  // (ESOCKETTIMEDOUT no host do front, 5-C #6.1 em 2026-10-23), que derrubava o resto do arquivo (32 testes pulados). Local e cypress open ficam sem retry,
  // para uma intermitência real continuar aparecendo; o relatório marca o teste que precisou da 2ª tentativa.
  retries: { runMode: process.env.CI ? 1 : 0, openMode: 0 },
  e2e: {
    viewportWidth: 1366,
    viewportHeight: 768,
    // Aponta para a URL do frontend web (BASE_URL) definida no env.json
    baseUrl: configEnv.BASE_URL || 'https://app.omnicare.dev.local',
    experimentalWebKitSupport: true,
    env: {
      userCnpj: configEnv.USER_CNPJ,
      user: configEnv.USER_CODE,
      userPassword: configEnv.USER_PASSWORD,
      // Default mudado de `true` para `false` em 25/09/2026 (análise de arquitetura multi-instância):
      // AUTO_SYNC_MOCKS sobrescreve fixtures CANÔNICAS versionadas (cypress/fixtures/*.json, as
      // mesmas que o modo hermético usa todo dia) de forma silenciosa sempre que USE_MOCKS:false,
      // sem diff revisado — e é fonte de corrida quando duas sessões rodam em modo real ao mesmo
      // tempo (ROADMAP P0). O padrão já preferido e mais seguro do projeto para descobrir/validar
      // contratos novos é medir diretamente contra a API real fora do Cypress (`node`+`https`, ver
      // vários casos em ROADMAP.md) e atualizar a fixture manualmente com o diff revisado. Se um
      // auto-sync pontual for mesmo necessário, ative só naquela execução via
      // `--env AUTO_SYNC_MOCKS=true` — nunca deixe `true` como padrão persistente em `env.json`.
      AUTO_SYNC_MOCKS: configEnv.AUTO_SYNC_MOCKS ?? false,
      USE_MOCKS: configEnv.USE_MOCKS ?? false,
      RECORD_MOCKS: configEnv.RECORD_MOCKS ?? false,
    },

    setupNodeEvents(on, config) {
      // Namespace de multi-instância: calculado uma única vez por processo (config.env já reflete
      // qualquer override de `--env` neste ponto). Propagado de volta em `config.env.SESSION_LABEL`
      // para que o código do lado do navegador (cypress/support/e2e.js) use o MESMO rótulo via
      // `Cypress.env('SESSION_LABEL')`, mesmo quando o operador não passou um explicitamente.
      const sessionLabel = resolveSessionLabel(config.env);
      config.env.SESSION_LABEL = sessionLabel;
      const failuresDir = path.join(__dirname, 'cypress', 'reports', 'failures', sessionLabel);
      config.downloadsFolder = path.join('cypress', 'downloads', sessionLabel);
      const downloadsDir = path.join(__dirname, config.downloadsFolder);

      // Namespace de screenshots por sessão (ROADMAP P0, item 3) — resolve a colisão nativa do
      // Cypress: `trashAssetsBeforeRuns` (default `true`) apaga TODO o `screenshotsFolder`
      // configurado no início de qualquer execução, inclusive screenshots de SUCESSO de uma
      // instância concorrente ainda em andamento (achado real, 25/09/2026: screenshot de sucesso
      // do teste "[Permissão 577]" existia no JSON do mochawesome e sumiu do disco logo depois,
      // destruído por outra execução). Como esse comportamento nativo apaga exatamente o caminho
      // configurado — não a pasta `cypress/screenshots/` inteira por fora do Cypress — apontar cada
      // sessão para seu próprio subdiretório (mesmo padrão já usado acima para `downloadsFolder`)
      // faz o "apagar antes de rodar" nativo ficar automaticamente restrito à própria sessão, sem
      // precisar desabilitar `trashAssetsBeforeRuns` nem implementar limpeza custom (e sem o efeito
      // colateral de parar de limpar `videosFolder`, que também é regido por essa mesma flag).
      config.screenshotsFolder = path.join('cypress', 'screenshots', sessionLabel);

      // Registro de Execução Ativa (`.claude/active-runs.json`, ROADMAP P0 item 2) — ver
      // comentário completo acima de `registrarExecucaoAtiva`. Autorregistra esta sessão ao
      // iniciar (`before:run`, dispara uma única vez por processo do Cypress, em `run` e em
      // `open`), mantém o spec atual atualizado (`before:spec`, útil sobretudo em `cypress open`
      // onde o operador troca de spec interativamente sem reiniciar o processo) e remove a
      // entrada ao encerrar (`after:run`, dispara ao fechar o navegador em `open` ou ao terminar
      // a run em modo headless).
      const modoExecucao = config.isTextTerminal ? 'run' : 'open';
      // `before:run`/`after:run` só toleram 1 handler registrado por processo — uma 2ª chamada a
      // `on('after:run', ...)` (ex.: a antiga `require('cypress-mochawesome-reporter/plugin')(on)`
      // registrada antes deste bloco) **sobrescreve silenciosamente** a anterior, sem erro nem
      // warning (achado 2026-09-29: desde o commit que adicionou este bloco, 2026-09-25 22:26, o
      // merge do relatório HTML do Mochawesome parou de rodar — só `cypress/reports/junit/` seguia
      // sendo gerado, via `cypress-multi-reporters`/Mocha, mecanismo independente destes node
      // events). Fix: um único handler por evento, chamando explicitamente os hooks do Mochawesome
      // (`cypress-mochawesome-reporter/lib`, em vez do wrapper `plugin.js` que faz seu próprio `on()`).
      on('before:run', async (details) => {
        await mochawesomeBeforeRunHook(details);

        const specsIniciais = (details && Array.isArray(details.specs))
          ? details.specs.map((s) => s.relative).join(', ')
          : null;
        registrarExecucaoAtiva(sessionLabel, {
          mode: modoExecucao,
          spec: specsIniciais,
          useMocks: config.env.USE_MOCKS,
          autoSyncMocks: config.env.AUTO_SYNC_MOCKS,
        });
      });
      on('before:spec', (spec) => {
        atualizarSpecAtual(sessionLabel, spec && spec.relative);
      });
      on('after:run', async (results) => {
        await mochawesomeAfterRunHook(results);
        removerExecucaoAtiva(sessionLabel);
      });

      // Prevenção de estouro de memória (OOM) no Chromium/Chrome
      on('before:browser:launch', (browser = {}, launchOptions) => {
        if (browser.family === 'chromium' && browser.name !== 'electron') {
          launchOptions.args.push('--js-flags=--max-old-space-size=4096');
          launchOptions.args.push('--disable-dev-shm-usage');
          launchOptions.args.push('--disable-gpu');

          // Dentro do runtime da Lambda (real ou emulado via RIE) o Chrome roda sem permissão de
          // criar o sandbox de usuário (user namespaces indisponíveis) — sem isso o processo do
          // Chrome não inicia. Guarda por env var para nunca afetar execução fora da Lambda
          // (cypress#005, spike de viabilidade da epic cypress#004).
          if (process.env.AWS_LAMBDA_RUNTIME_API) {
            launchOptions.args.push('--no-sandbox');
            launchOptions.args.push('--disable-setuid-sandbox');
            // Sem user namespaces o zygote não forka o processo de GPU (mesmo motivo do
            // ELECTRON_EXTRA_LAUNCH_ARGS do lambda/Dockerfile, que só vale para o Electron).
            launchOptions.args.push('--no-zygote');
            launchOptions.args.push('--in-process-gpu');
          }
        }
        return launchOptions;
      });

      // Tasks customizadas do Node (ex: limpeza automática de relatórios de falha e verificação de arquivos)
      on('task', {
        verificarArquivoExiste(filePath) {
          const fs = require('fs');
          const path = require('path');
          const fullPath = path.isAbsolute(filePath) ? filePath : path.join(__dirname, filePath);
          return fs.existsSync(fullPath);
        },

        // Limpa a pasta de downloads DESTA SESSÃO/ABA antes de um cenário que valida o arquivo
        // baixado. Namespaced por `sessionLabel` (ver resolveSessionLabel) — nunca toca na pasta de
        // downloads de outra instância do Cypress rodando ao mesmo tempo.
        limparDownloads() {
          const fs = require('fs');
          fs.mkdirSync(downloadsDir, { recursive: true });
          fs.readdirSync(downloadsDir).forEach((file) => {
            try {
              fs.unlinkSync(path.join(downloadsDir, file));
            } catch (e) {
              // Silencia se o arquivo ainda estiver sendo escrito pelo navegador
            }
          });
          return null;
        },

        // Lista os arquivos presentes na pasta de downloads DESTA SESSÃO/ABA com nome e tamanho em
        // bytes, permitindo asserir extensão e conteúdo real do que o navegador gravou em disco
        listarDownloads() {
          const fs = require('fs');
          if (!fs.existsSync(downloadsDir)) return [];
          return fs.readdirSync(downloadsDir)
            // Ignora arquivos parciais enquanto o Chrome ainda está gravando
            .filter((nome) => !nome.endsWith('.crdownload'))
            .map((nome) => ({ nome, bytes: fs.statSync(path.join(downloadsDir, nome)).size }));
        },

        // Limpa os relatórios de falha DESTA SESSÃO/ABA (`cypress/reports/failures/<sessionLabel>/`),
        // nunca a pasta compartilhada inteira — corrigido em 23/09/2026: antes, qualquer instância que
        // iniciasse apagava TODOS os arquivos de falha, inclusive os de uma outra instância ainda
        // rodando em paralelo (ver ROADMAP P0 "Arquitetura de Testes para Múltiplas Instâncias").
        limparLogsFalha() {
          const fs = require('fs');
          fs.mkdirSync(failuresDir, { recursive: true });

          fs.readdirSync(failuresDir).forEach((file) => {
            try {
              fs.unlinkSync(path.join(failuresDir, file));
            } catch (e) {
              // Silencia se o arquivo já estiver em uso
            }
          });

          // Limpa também arquivos legados na raiz se existirem
          ['cypress-last-failure.json', 'cypress-last-failure.log'].forEach((file) => {
            const filePath = path.join(__dirname, file);
            if (fs.existsSync(filePath)) {
              try {
                fs.unlinkSync(filePath);
              } catch (e) {}
            }
          });

          return null;
        },

        // Com `cypressParallel: true` (ver reporterOptions acima), a lib cypress-mochawesome-reporter
        // nunca mais apaga `cypress/reports/html/.jsons/` sozinha (nem antes, nem depois da run) —
        // evita que uma instância concorrente apague os .json de outra ainda em andamento, mas sem
        // limpeza alguma os relatórios HTML futuros passariam a mesclar resultados de execuções
        // antigas para sempre (ROADMAP P0 "Arquitetura de Testes para Múltiplas Instâncias").
        // Purga só os .json com mtime mais antigo que o limiar (não a pasta inteira, nem por sessão —
        // os nomes desses arquivos são gerados internamente pela lib, sem hook de namespacing
        // disponível), preservando os de qualquer execução concorrente ainda em andamento dentro da
        // janela seguinte.
        limparJsonsAntigos() {
          const fs = require('fs');
          const LIMIAR_MS = 3 * 60 * 60 * 1000; // 3h — generoso frente à duração real de uma suíte (segundos a poucos minutos)
          const jsonDir = path.join(__dirname, 'cypress', 'reports', 'html', '.jsons');
          if (!fs.existsSync(jsonDir)) return null;
          const agora = Date.now();
          fs.readdirSync(jsonDir).forEach((file) => {
            if (!file.endsWith('.json')) return;
            const fullPath = path.join(jsonDir, file);
            try {
              const { mtimeMs } = fs.statSync(fullPath);
              if (agora - mtimeMs > LIMIAR_MS) {
                fs.unlinkSync(fullPath);
              }
            } catch (e) {
              // Silencia se o arquivo estiver sendo escrito por outra instância no exato instante
            }
          });
          return null;
        },

        // Grava os passos de cada teste do spec (hook cypress/support/passos.js) para o relatório próprio, em
        // `cypress/reports/passos/<slug-do-spec>.<timestamp>.json` (contrato em scripts/relatorio/MODELO.md).
        // Fica só a rodada mais recente de cada spec. FAIL-SAFE: nunca lança erro, para uma falha de gravação não
        // derrubar o `after()` do spec; no pior caso o relatório fica sem passos desse arquivo.
        gravarPassos({ spec, testes } = {}) {
          try {
            const fs = require('fs');
            if (!spec || !Array.isArray(testes) || testes.length === 0) return null;
            const dir = path.join(__dirname, 'cypress', 'reports', 'passos');
            fs.mkdirSync(dir, { recursive: true });
            const slug = String(spec).replace(/\\/g, '/').replace(/^cypress\/e2e\//, '').replace(/\.cy\.[jt]sx?$/, '').replace(/[^a-zA-Z0-9._-]+/g, '_');
            const antigo = new RegExp(`^${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.\\d{2}-\\d{2}-\\d{4}_\\d{2}-\\d{2}-\\d{2}\\.json$`);
            fs.readdirSync(dir).forEach((nome) => {
              if (antigo.test(nome)) {
                try { fs.unlinkSync(path.join(dir, nome)); } catch (e) { /* em uso: segue */ }
              }
            });
            const destino = path.join(dir, `${slug}.${timestamp}.json`);
            fs.writeFileSync(`${destino}.tmp`, JSON.stringify(testes, null, 2), 'utf-8');
            fs.renameSync(`${destino}.tmp`, destino);
          } catch (e) {
            console.warn(`[passos] gravação ignorada: ${e && e.message}`);
          }
          return null;
        },

        salvarSnapshotHtml(dados) {
          const { nomeArquivo = 'snapshot', conteudoHtml = '', subdiretorio = '' } = dados || {};
          const fs = require('fs');
          const path = require('path');
          const baseDir = path.join(__dirname, 'cypress', 'reports', 'snapshots', subdiretorio);
          if (!fs.existsSync(baseDir)) {
            fs.mkdirSync(baseDir, { recursive: true });
          }
          const nomeNormalizado = nomeArquivo.endsWith('.html') ? nomeArquivo : `${nomeArquivo}.html`;
          const filePath = path.join(baseDir, nomeNormalizado);
          fs.writeFileSync(filePath, conteudoHtml, 'utf-8');
          return filePath;
        },

        limparSnapshots() {
          const fs = require('fs');
          const path = require('path');
          const snapshotDir = path.join(__dirname, 'cypress', 'reports', 'snapshots');
          if (fs.existsSync(snapshotDir)) {
            const removerRecursivo = (dir) => {
              fs.readdirSync(dir).forEach((file) => {
                const curPath = path.join(dir, file);
                if (fs.lstatSync(curPath).isDirectory()) {
                  removerRecursivo(curPath);
                  try { fs.rmdirSync(curPath); } catch (e) {}
                } else {
                  try { fs.unlinkSync(curPath); } catch (e) {}
                }
              });
            };
            removerRecursivo(snapshotDir);
          }
          return null;
        },

        anexarDocumentoPrescricao({ apiUrl, storeId, prescriptionId, token, filePath, fileName = 'receita.jpg', mimeType = 'image/jpeg' }) {
          const fs = require('fs');
          const https = require('https');
          const path = require('path');

          return new Promise((resolve) => {
            const fullPath = path.isAbsolute(filePath) ? filePath : path.join(__dirname, filePath);
            if (!fs.existsSync(fullPath)) {
              return resolve({ status: 400, error: `Arquivo para anexo não encontrado: ${fullPath}` });
            }

            const fileBuffer = fs.readFileSync(fullPath);
            const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
            const multipartBody = Buffer.concat([
              Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`),
              fileBuffer,
              Buffer.from(`\r\n--${boundary}--\r\n`)
            ]);

            const parsedUrl = new URL(apiUrl);
            const options = {
              hostname: parsedUrl.hostname,
              port: parsedUrl.port || 443,
              path: `/prescriptions/${prescriptionId}/documents`,
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': multipartBody.length
              }
            };

            const req = https.request(options, (res) => {
              let data = '';
              res.on('data', (chunk) => { data += chunk; });
              res.on('end', () => {
                let body;
                try {
                  body = JSON.parse(data);
                } catch (e) {
                  body = data;
                }
                resolve({ status: res.statusCode, body });
              });
            });

            req.on('error', (err) => resolve({ status: 500, error: err.message }));
            req.write(multipartBody);
            req.end();
          });
        },
        // Upload multipart de mídia no chat (POST /attendances/:attendanceId/messages/media, Issue backend#563)
        enviarMidiaAtendimento({ apiUrl, storeId, attendanceId, token, filePath, fileName, mimeType, campos = {}, nomeCampoArquivo = 'file' }) {
          const fs = require('fs');
          const https = require('https');
          const path = require('path');

          return new Promise((resolve) => {
            const fullPath = path.isAbsolute(filePath) ? filePath : path.join(__dirname, filePath);
            if (!fs.existsSync(fullPath)) {
              return resolve({ status: 400, error: `Arquivo para anexo não encontrado: ${fullPath}` });
            }

            const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
            const CRLF = String.fromCharCode(13, 10);
            const partes = Object.entries(campos).map(([nome, valor]) => Buffer.from(['--' + boundary, 'Content-Disposition: form-data; name="' + nome + '"', '', valor, ''].join(CRLF)));
            const multipartBody = Buffer.concat([
              ...partes,
              Buffer.from(['--' + boundary, 'Content-Disposition: form-data; name="' + nomeCampoArquivo + '"; filename="' + fileName + '"', 'Content-Type: ' + mimeType, '', ''].join(CRLF)),
              fs.readFileSync(fullPath),
              Buffer.from(CRLF + '--' + boundary + '--' + CRLF),
            ]);

            const parsedUrl = new URL(apiUrl);
            const req = https.request({
              hostname: parsedUrl.hostname,
              port: parsedUrl.port || 443,
              path: `/attendances/${attendanceId}/messages/media`,
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': multipartBody.length,
              },
            }, (res) => {
              let data = '';
              res.on('data', (chunk) => { data += chunk; });
              res.on('end', () => {
                let body;
                try { body = JSON.parse(data); } catch (e) { body = data; }
                resolve({ status: res.statusCode, body });
              });
            });

            req.on('error', (err) => resolve({ status: 500, error: err.message }));
            req.write(multipartBody);
            req.end();
          });
        },
      });

      return config;
    },
  },
});