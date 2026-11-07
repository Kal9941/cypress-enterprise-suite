/**
 * Links de issue/PR (extraídos do título do `context`) e área (coluna `Área` do §10.0 do PROJECT_CONTEXT).
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..', '..');

// Só linka repositório conhecido (contrato em MODELO.md)
const REPOS = {
  backend: 'omnicare-org/pharmacie-backend',
  front: 'omnicare-org/pharmacie-front',
  cypress: 'omnicare-org/cypress-enterprise-suite',
};

function urlDaRef(tipo, repo, numero) {
  return `https://github.com/${REPOS[repo]}/${tipo === 'pr' ? 'pull' : 'issues'}/${numero}`;
}

/**
 * Extrai as referências de um título de context.
 * Exemplos: `(Issue backend#783/PR #773)` → issue backend#783 e PR backend#773;
 * `(Issue front#344 / srv#455, #463)` → só a front#344 (repo `srv` é desconhecido e o que o segue herda o repo);
 * `(PRs #344 e #345)` → nada (sem repo conhecido, `#N` solto não linka).
 * @param {string} titulo
 * @returns {Array<{tipo: string, repo: string, numero: number, url: string}>}
 */
function extrairRefs(titulo) {
  const grupos = (titulo || '').match(/\([^()]*#[^()]*\)/g);
  if (!grupos) return [];
  const refs = [];
  const vistos = new Set();

  for (const grupo of grupos) {
    const texto = grupo.slice(1, -1);
    // repo do título: o primeiro `repo#N` citado, herdado por `PR #N` sem repo
    const primeiroRepo = (titulo.match(/\b([A-Za-z]+)#\d+/) || [])[1];
    const repoDoTexto = primeiroRepo ? primeiroRepo.toLowerCase() : null;

    // (`\b` do JS não reconhece "é", por isso "épico" fica sem fronteira à esquerda)
    const tokens = /(Issues?\b|PRs?\b|[ÉEé]picos?\b)|\b([A-Za-z]+)#(\d+)|#(\d+)(?:-(\d+))?/g;
    let tipo = null; // 'issue' | 'pr' | 'outro' (épico não linka)
    let repoAtual = null;
    let palavraRecente = false; // acabou de aparecer "Issue"/"PR": o próximo número é desse tipo
    let ultimoFim = 0;
    let ultimaFoiIssueComRepo = false;
    let m;
    while ((m = tokens.exec(texto)) !== null) {
      const separador = texto.slice(ultimoFim, m.index);
      ultimoFim = tokens.lastIndex;

      if (m[1]) { // palavra-chave
        const palavra = m[1].toLowerCase();
        tipo = palavra.startsWith('issue') ? 'issue' : palavra.startsWith('pr') ? 'pr' : 'outro';
        palavraRecente = true;
        continue;
      }

      let repo;
      let numeros;
      let tipoRef;
      if (m[2]) { // repo#N
        repo = m[2].toLowerCase();
        numeros = [Number(m[3])];
        tipoRef = palavraRecente ? tipo : 'issue';
        repoAtual = repo;
        ultimaFoiIssueComRepo = tipoRef === 'issue';
      } else { // #N (ou #N-M) sem repo
        const a = Number(m[4]);
        const b = m[5] ? Number(m[5]) : null;
        numeros = b && b > a && b - a <= 20 ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a];
        if (palavraRecente) {
          tipoRef = tipo;
        } else if (separador.includes('/') && ultimaFoiIssueComRepo) {
          tipoRef = 'pr'; // `Issue backend#606/#615`: o segundo número é o PR da issue
        } else {
          tipoRef = tipo || 'outro';
        }
        repo = repoAtual || repoDoTexto;
        ultimaFoiIssueComRepo = false;
      }
      palavraRecente = false;
      tipo = tipoRef;
      if (tipoRef !== 'issue' && tipoRef !== 'pr') continue;
      if (!repo || !REPOS[repo]) continue;
      if (m[4]) repoAtual = repo;
      for (const numero of numeros) {
        const chave = `${tipoRef}|${repo}|${numero}`;
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        refs.push({ tipo: tipoRef, repo, numero, url: urlDaRef(tipoRef, repo, numero) });
      }
    }
  }
  return refs;
}

/**
 * Lê o índice §10.0 do PROJECT_CONTEXT e devolve `Map` `"<suíte>|<n° do context>"` → áreas[].
 * A linha é `| <suíte> · <n>. <nome> | <faixa #> | <qtd> | <Área> | … |`; o número do context vem da faixa
 * (`3.1-3.7` → 3), porque no 1.permissoes e no 6.receitas o nome do context não carrega o número certo.
 * @param {string} [raiz] raiz do repositório (para teste)
 * @returns {{mapa: Map<string, string[]>, lido: boolean}}
 */
function lerAreasDoIndice(raiz = RAIZ) {
  const mapa = new Map();
  let texto;
  try {
    texto = fs.readFileSync(path.join(raiz, '.agents', 'PROJECT_CONTEXT.md'), 'utf8').replace(/\r\n/g, '\n');
  } catch (e) {
    return { mapa, lido: false };
  }
  const linhas = texto.split('\n');
  let i = linhas.findIndex((l) => /^###\s+10\.0\b/.test(l));
  if (i < 0) return { mapa, lido: false };
  for (i += 1; i < linhas.length; i++) {
    const linha = linhas[i];
    if (!linha.startsWith('|')) {
      if (mapa.size > 0) break; // fim da tabela
      continue; // linhas em branco antes da tabela
    }
    const celulas = linha.split('|').map((c) => c.trim());
    // celulas[0] é vazia (antes do primeiro "|"); 1 = suíte · context, 2 = faixa, 3 = qtd, 4 = área
    const suiteContext = celulas[1] || '';
    const faixa = (celulas[2] || '').match(/^(\d+)\.\d+/);
    const suite = suiteContext.split(' · ')[0].trim();
    if (!faixa || !suite) continue;
    const areas = (celulas[4] || '').split(' · ').map((a) => a.trim()).filter(Boolean);
    mapa.set(`${suite}|${faixa[1]}`, areas);
  }
  return { mapa, lido: mapa.size > 0 };
}

module.exports = { extrairRefs, lerAreasDoIndice, REPOS };
