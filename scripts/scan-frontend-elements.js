/**
 * Scanner Estático de Elementos de Interface do Frontend
 * OmniCare Web - Automação Cypress
 *
 * Faz download do HTML inicial e dos chunks JavaScript (/assets/*.js)
 * servidos em produção/homologação, cataloga todos os data-testid,
 * data-cy e rótulos acessíveis (aria-label), e detecta novos elementos
 * introduzidos após novos deploys.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// 1. Carrega configuração de ambiente
let baseUrl = 'https://app.omnicare.dev.local';
try {
  const envPath = path.join(__dirname, '..', 'env.json');
  if (fs.existsSync(envPath)) {
    const envData = JSON.parse(fs.readFileSync(envPath, 'utf-8'));
    if (envData.BASE_URL) {
      baseUrl = envData.BASE_URL;
    }
  }
} catch (e) {
  // Mantém baseUrl padrão
}

const REPORT_DIR = path.join(__dirname, '..', 'cypress', 'reports');
const INVENTORY_PATH = path.join(REPORT_DIR, 'elements-inventory.json');

// Função helper para requisições HTTP/HTTPS com suporte a redirecionamentos
function fetchUrl(targetUrl, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error('Muitos redirecionamentos'));
    }

    const parsed = new URL(targetUrl);
    const client = parsed.protocol === 'https:' ? https : http;

    const req = client.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) OmniCare-Element-Scanner/1.0',
        'Accept': '*/*'
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirected = new URL(res.headers.location, targetUrl).href;
        return fetchUrl(redirected, maxRedirects - 1).then(resolve).catch(reject);
      }

      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error(`Falha HTTP ${res.statusCode} ao acessar ${targetUrl}`));
      }

      let data = '';
      res.setEncoding('utf-8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    });

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error(`Timeout ao baixar ${targetUrl}`));
    });
  });
}

// Extrai URLs de scripts do HTML (incluindo tags script e link rel="modulepreload")
function extrairScripts(html, baseUrlStr) {
  const scripts = new Set();
  
  // 1. Tags <script src="...">
  const scriptRegex = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    const src = match[1];
    try {
      const fullUrl = new URL(src, baseUrlStr).href;
      if (fullUrl.includes('/assets/') || src.endsWith('.js')) {
        scripts.add(fullUrl);
      }
    } catch (e) {}
  }

  // 2. Tags <link rel="modulepreload" href="...">
  const preloadRegex = /<link\b[^>]*\bhref=["']([^"']+\.js[^"']*)["'][^>]*>/gi;
  while ((match = preloadRegex.exec(html)) !== null) {
    const href = match[1];
    try {
      const fullUrl = new URL(href, baseUrlStr).href;
      scripts.add(fullUrl);
    } catch (e) {}
  }

  return Array.from(scripts);
}

// Extrai referências a outros chunks JS dentro de um bundle
function extrairChunksReferenciados(codigoJs, baseUrlStr) {
  const chunks = new Set();
  // Padrões como: "/assets/nome-hash.js" ou "assets/nome-hash.js"
  const chunkRegex = /["'](\/?assets\/[a-zA-Z0-9_.-]+\.js)["']/g;
  let m;
  while ((m = chunkRegex.exec(codigoJs)) !== null) {
    try {
      const fullUrl = new URL(m[1], baseUrlStr).href;
      chunks.add(fullUrl);
    } catch (e) {}
  }
  return Array.from(chunks);
}

// Extrai seletores dos conteúdos JS
function extrairSeletoresDeCodigo(codigoJs) {
  const testIds = new Set();
  const cyIds = new Set();
  const ariaLabels = new Set();

  // 1. data-testid (aspas simples, duplas ou crases de template literal)
  const testIdPatterns = [
    /["']?data-testid["']?\s*[:=]\s*[`"']([^`"'\r\n]+)[`"']/gi,
    /["']data-testid["']\s*,\s*[`"']([^`"'\r\n]+)[`"']/gi,
    /data-testid=["']([^"']+)["']/gi,
    /["']?data-testid["']?\s*[:=][^;,\n}]*?`([^`\r\n]+)`/gi
  ];

  testIdPatterns.forEach((regex) => {
    let m;
    while ((m = regex.exec(codigoJs)) !== null) {
      let val = m[1].trim();
      // Normaliza template strings com variáveis (ex: budget-selection-${o} -> budget-selection-*)
      if (val.includes('${')) {
        val = val.replace(/\$\{[^}]+\}/g, '*');
      }
      if (val && !val.includes('__') && val.length >= 2 && val.length < 100 && /^[a-zA-Z0-9*_-]+$/.test(val)) {
        testIds.add(val);
      }
    }
  });

  // 2. data-cy
  const cyPatterns = [
    /["']?data-cy["']?\s*[:=]\s*[`"']([^`"'\r\n]+)[`"']/gi,
    /["']data-cy["']\s*,\s*[`"']([^`"'\r\n]+)[`"']/gi,
    /data-cy=["']([^"']+)["']/gi,
    /["']?data-cy["']?\s*[:=][^;,\n}]*?`([^`\r\n]+)`/gi
  ];

  cyPatterns.forEach((regex) => {
    let m;
    while ((m = regex.exec(codigoJs)) !== null) {
      let val = m[1].trim();
      if (val.includes('${')) {
        val = val.replace(/\$\{[^}]+\}/g, '*');
      }
      if (val && !val.includes('__') && val.length < 100) {
        cyIds.add(val);
      }
    }
  });

  // 3. aria-label
  const ariaRegex = /["']?aria-label["']?\s*[:=]\s*[`"']([^`"'\r\n]{2,80})[`"']/gi;
  let m;
  while ((m = ariaRegex.exec(codigoJs)) !== null) {
    let val = m[1].trim();
    if (val.includes('${')) {
      val = val.replace(/\$\{[^}]+\}/g, '*');
    }
    if (val && !val.startsWith('http')) {
      ariaLabels.add(val);
    }
  }

  return { testIds, cyIds, ariaLabels };
}

async function run() {
  console.log('===============================================================');
  console.log('🔍 SCANNER ESTÁTICO DE ELEMENTOS DE FRONTEND (OmniCare Web)');
  console.log('===============================================================');
  console.log(`🌐 URL Alvo: ${baseUrl}`);
  console.log('Baixando index.html...');

  let htmlInicial;
  try {
    htmlInicial = await fetchUrl(baseUrl);
  } catch (err) {
    console.error(`❌ Erro ao acessar ${baseUrl}: ${err.message}`);
    process.exit(1);
  }

  const scriptsIniciais = extrairScripts(htmlInicial, baseUrl);
  console.log(`📦 Encontrados ${scriptsIniciais.length} scripts JS vinculados diretamente no HTML.\n`);

  const todosTestIds = new Set();
  const todosCyIds = new Set();
  const todosAriaLabels = new Set();

  const filaScripts = [...scriptsIniciais];
  const visitados = new Set();
  let indice = 0;

  while (indice < filaScripts.length) {
    const scriptUrl = filaScripts[indice++];
    if (visitados.has(scriptUrl)) continue;
    visitados.add(scriptUrl);

    const scriptNome = scriptUrl.split('/').pop().split('?')[0];
    process.stdout.write(` [${visitados.size}] Analisando ${scriptNome}... `);

    try {
      const conteudoJs = await fetchUrl(scriptUrl);
      const { testIds, cyIds, ariaLabels } = extrairSeletoresDeCodigo(conteudoJs);

      testIds.forEach((t) => todosTestIds.add(t));
      cyIds.forEach((c) => todosCyIds.add(c));
      ariaLabels.forEach((a) => todosAriaLabels.add(a));

      // Descobre chunks secundários importados dinamicamente
      const chunksFilhos = extrairChunksReferenciados(conteudoJs, baseUrl);
      chunksFilhos.forEach((ch) => {
        if (!visitados.has(ch) && !filaScripts.includes(ch)) {
          filaScripts.push(ch);
        }
      });

      console.log(`✓ (${testIds.size} testids)`);
    } catch (e) {
      console.log(`⚠️ (falha: ${e.message})`);
    }
  }

  // Carrega inventário anterior para detectar novidades
  let inventarioAnterior = null;
  if (fs.existsSync(INVENTORY_PATH)) {
    try {
      inventarioAnterior = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf-8'));
    } catch (e) {}
  }

  const testIdsArray = Array.from(todosTestIds).sort();
  const cyIdsArray = Array.from(todosCyIds).sort();
  const ariaLabelsArray = Array.from(todosAriaLabels).sort();

  const novosTestIds = [];
  if (inventarioAnterior && Array.isArray(inventarioAnterior.dataTestIds)) {
    const anteriores = new Set(inventarioAnterior.dataTestIds);
    testIdsArray.forEach((id) => {
      if (!anteriores.has(id)) {
        novosTestIds.push(id);
      }
    });
  }

  const resultado = {
    ultimaAtualizacao: new Date().toISOString(),
    baseUrl,
    totalScripts: visitados.size,
    estatisticas: {
      totalDataTestIds: testIdsArray.length,
      totalDataCy: cyIdsArray.length,
      totalAriaLabels: ariaLabelsArray.length,
      novosTestIdsDetectados: novosTestIds.length
    },
    novosTestIds,
    dataTestIds: testIdsArray,
    dataCy: cyIdsArray,
    ariaLabels: ariaLabelsArray
  };

  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }

  fs.writeFileSync(INVENTORY_PATH, JSON.stringify(resultado, null, 2), 'utf-8');

  console.log('\n===============================================================');
  console.log('📊 RESULTADO DA VARREDURA:');
  console.log(` • data-testid mapeados:  ${testIdsArray.length}`);
  console.log(` • data-cy mapeados:       ${cyIdsArray.length}`);
  console.log(` • aria-label mapeados:    ${ariaLabelsArray.length}`);
  if (novosTestIds.length > 0) {
    console.log(` • 🚀 NOVOS TESTIDS IDENTIFICADOS: ${novosTestIds.length}`);
    novosTestIds.slice(0, 10).forEach((id) => console.log(`   + [data-testid="${id}"]`));
    if (novosTestIds.length > 10) {
      console.log(`   ... e mais ${novosTestIds.length - 10} elementos novos.`);
    }
  } else if (inventarioAnterior) {
    console.log(' • 🟢 Nenhum novo data-testid detectado em relação ao inventário anterior.');
  }
  console.log(`📁 Inventário salvo com sucesso em:`);
  console.log(`   cypress/reports/elements-inventory.json`);
  console.log('===============================================================\n');
}

run().catch((err) => {
  console.error('Erro inesperado durante a execução do scanner:', err);
  process.exit(1);
});
