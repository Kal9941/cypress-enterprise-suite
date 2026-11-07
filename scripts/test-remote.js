/**
 * Disparo manual da suíte Cypress na Lambda do dev (epic cypress#004, sub-issue cypress#009).
 *
 * Encapsula `aws lambda invoke` contra a função `cypress-enterprise-suite-runner-dev`, usando a
 * credencial/perfil AWS já configurado no ambiente do dev (`AWS_PROFILE`, ou o default do
 * `aws configure`) — este script nunca define um perfil sozinho, só repassa `--profile` se for
 * passado explicitamente via `--profile <nome>`.
 *
 * Uso:
 *   npm run test:remote                              (todas as specs de cypress/e2e/*.cy.js,
 *                                                      uma invocação por spec, em sequência)
 *   npm run test:remote -- --spec 7.clientes.cy.js    (só a spec informada)
 *   npm run test:remote -- --spec "2.login.cy.js,7.clientes.cy.js"   (lista separada por vírgula)
 *   npm run test:remote -- --profile meu-perfil-aws   (força um perfil específico)
 *
 * Resultado é informativo: imprime o resultado de cada spec conforme chega e, no fim, um resumo
 * consolidado (totais, falhas por spec, links dos relatórios). Uma 2ª execução concorrente é
 * barrada pela própria Lambda (`ReservedConcurrentExecutions: 1`, cypress#007) — detectado aqui
 * como `TooManyRequestsException` e traduzido numa mensagem clara, não numa stack trace crua.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SPEC_DIR = path.join(ROOT, 'cypress', 'e2e');
const FUNCTION_NAME = process.env.CYPRESS_LAMBDA_FUNCTION_NAME || 'cypress-enterprise-suite-runner-dev';

function listarSpecsLocais() {
  return fs
    .readdirSync(SPEC_DIR)
    .filter((nome) => nome.endsWith('.cy.js'))
    .sort();
}

function parseArgs(argv) {
  const specsIdx = argv.indexOf('--spec');
  const profileIdx = argv.indexOf('--profile');
  const specsArg = specsIdx !== -1 ? argv[specsIdx + 1] : null;
  const profile = profileIdx !== -1 ? argv[profileIdx + 1] : null;
  return {
    specs: specsArg ? specsArg.split(',').map((s) => s.trim()).filter(Boolean) : null,
    profile,
  };
}

function validarSpecsPedidas(pedidas, disponiveis) {
  const disponiveisSet = new Set(disponiveis);
  const invalidas = pedidas.filter((nome) => !disponiveisSet.has(nome));
  if (invalidas.length > 0) {
    console.error(
      `\n❌ Spec(s) inexistente(s) em cypress/e2e/: ${invalidas.join(', ')}\n` +
        `   Specs disponíveis: ${disponiveis.join(', ')}\n`,
    );
    process.exit(1);
  }
}

// Invoca a Lambda para UMA spec. Retorna { ok: true, resultado } em sucesso,
// { ok: false, throttled: true } se a Lambda recusou por concorrência, ou
// { ok: false, erro } para qualquer outra falha (handler ou AWS CLI).
function invocarLambdaParaSpec(spec, profile) {
  const payload = JSON.stringify({ specs: [spec] });
  const outputFile = path.join(os.tmpdir(), `cypress-lambda-invoke-${process.pid}-${Date.now()}.json`);

  const args = [
    'lambda',
    'invoke',
    '--function-name',
    FUNCTION_NAME,
    '--invocation-type',
    'RequestResponse',
    '--cli-read-timeout',
    '0',
    '--cli-binary-format',
    'raw-in-base64-out',
    '--payload',
    payload,
    outputFile,
  ];
  if (profile) {
    args.push('--profile', profile);
  }

  let cliStdout;
  try {
    cliStdout = execFileSync('aws', args, { encoding: 'utf-8' });
  } catch (err) {
    const stderr = String(err.stderr || err.message || '');
    if (/TooManyRequestsException|Rate Exceeded/i.test(stderr)) {
      return { ok: false, throttled: true };
    }
    return { ok: false, erro: stderr.trim() || 'Falha desconhecida ao chamar aws lambda invoke.' };
  } finally {
    // Independe de sucesso/falha do parse abaixo — nunca deixa lixo em /tmp.
  }

  let cliResult;
  try {
    cliResult = JSON.parse(cliStdout);
  } catch {
    cliResult = {};
  }

  let resultado;
  try {
    resultado = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
  } catch (err) {
    return { ok: false, erro: `Não consegui ler a resposta da Lambda: ${err.message}` };
  } finally {
    fs.rmSync(outputFile, { force: true });
  }

  if (cliResult.FunctionError) {
    // O handler jogou uma exceção não tratada (bug real no handler, não erro de negócio) — o
    // corpo nesse caso é o formato padrão de erro da Lambda ({errorType, errorMessage, ...}).
    return { ok: false, erro: resultado.errorMessage || JSON.stringify(resultado) };
  }

  if (resultado.erro) {
    // Erro de validação do próprio handler (cypress#006) — não deveria acontecer já que
    // validamos localmente antes de invocar, mas tratado aqui por defesa em profundidade.
    return { ok: false, erro: resultado.erro };
  }

  return { ok: true, resultado };
}

function formatarDuracao(ms) {
  if (typeof ms !== 'number') return '?';
  return `${(ms / 1000).toFixed(1)}s`;
}

function imprimirResultadoSpec(spec, saida) {
  if (!saida.ok) {
    if (saida.throttled) {
      console.error(
        `\n❌ ${spec}: já existe um teste rodando na Lambda agora (throttle — só 1 execução ` +
          `por vez). Aguarde terminar e tente de novo.\n`,
      );
    } else {
      console.error(`\n❌ ${spec}: ${saida.erro}\n`);
    }
    return;
  }

  const r = saida.resultado;
  const status = r.failed > 0 ? '✗' : '✓';
  console.log(`${status} ${spec} — ${r.passed}/${r.total} passed (${formatarDuracao(r.durationMs)})`);
  if (r.failed > 0) {
    for (const falha of r.failures || []) {
      console.log(`    - ${falha.title}: ${falha.error}`);
    }
  }
  if (r.reportUrl) {
    console.log(`    relatório: ${r.reportUrl}`);
  }
}

function imprimirResumoConsolidado(execucoes) {
  console.log('\n' + '='.repeat(70));
  console.log('Resumo consolidado');
  console.log('='.repeat(70));

  const sucedidas = execucoes.filter((e) => e.saida.ok);
  const falhadasNaInvocacao = execucoes.filter((e) => !e.saida.ok);

  const totais = sucedidas.reduce(
    (acc, e) => {
      acc.total += e.saida.resultado.total || 0;
      acc.passed += e.saida.resultado.passed || 0;
      acc.failed += e.saida.resultado.failed || 0;
      acc.pending += e.saida.resultado.pending || 0;
      return acc;
    },
    { total: 0, passed: 0, failed: 0, pending: 0 },
  );

  console.log(`Specs executadas: ${sucedidas.length}/${execucoes.length}`);
  console.log(`Testes: ${totais.total} total · ${totais.passed} passed · ${totais.failed} failed · ${totais.pending} pending`);

  if (falhadasNaInvocacao.length > 0) {
    console.log(`\nSpecs que não rodaram (falha de invocação, não de teste):`);
    for (const e of falhadasNaInvocacao) {
      console.log(`  - ${e.spec}: ${e.saida.throttled ? 'throttle (já havia execução em andamento)' : e.saida.erro}`);
    }
  }

  const comFalhasDeTeste = sucedidas.filter((e) => e.saida.resultado.failed > 0);
  if (comFalhasDeTeste.length > 0) {
    console.log(`\nSpecs com teste(s) falhando:`);
    for (const e of comFalhasDeTeste) {
      console.log(`  - ${e.spec}: ${e.saida.resultado.failed} falha(s)`);
    }
  }

  const relatorios = sucedidas.filter((e) => e.saida.resultado.reportUrl);
  if (relatorios.length > 0) {
    console.log(`\nRelatórios:`);
    for (const e of relatorios) {
      console.log(`  - ${e.spec}: ${e.saida.resultado.reportUrl}`);
    }
  }

  console.log('='.repeat(70));

  const houveProblema = falhadasNaInvocacao.length > 0 || totais.failed > 0;
  return houveProblema ? 1 : 0;
}

function main() {
  const disponiveis = listarSpecsLocais();
  const { specs: pedidas, profile } = parseArgs(process.argv.slice(2));

  let specs;
  if (pedidas) {
    validarSpecsPedidas(pedidas, disponiveis);
    specs = pedidas;
  } else {
    specs = disponiveis;
  }

  console.log(`Disparando ${specs.length} spec(s) contra ${FUNCTION_NAME}, uma por vez...\n`);

  const execucoes = [];
  for (const spec of specs) {
    const saida = invocarLambdaParaSpec(spec, profile);
    imprimirResultadoSpec(spec, saida);
    execucoes.push({ spec, saida });

    // Throttle: outra execução já está em andamento na Lambda (ReservedConcurrentExecutions:1)
    // — tentar a próxima spec na sequência só bateria no mesmo throttle de novo.
    if (!saida.ok && saida.throttled) {
      break;
    }
  }

  const exitCode = imprimirResumoConsolidado(execucoes);
  process.exit(exitCode);
}

main();
