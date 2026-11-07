# Modelo de dados do relatório de testes (OmniCare Web)

Fluxo: **entradas** (JSON do Mochawesome, passos do hook, categorias de falha, docs) → `gerar-relatorio.js` monta o **modelo** abaixo → `template/` renderiza o site estático em `cypress/reports/painel/`. O gerador e o template só conversam por este contrato.

## Entradas do gerador
1. **Mochawesome** (dados do teste), nesta ordem de preferência: `cypress/reports/html/.jsons/*.json`; o JSON embutido nos HTML `cypress/reports/html/*.html` (atributo `data-raw="…"` do `<body>`, HTML-escapado); JUnit `cypress/reports/junit/*.xml` (fallback sem erro estruturado). No CI o artefato traz só o HTML e o JUnit, então o `data-raw` é a fonte real.
2. **Passos** gravados pelo hook (`cypress/reports/passos/*.json`), formato abaixo.
3. **Categoria da falha**: a mesma classificação do `cypress/support/errorHandler.js` (9 famílias, a mensagem do erro já vem com o rótulo, ex. `[ELEMENTO NÃO ENCONTRADO NO DOM]`).
4. **Docs** para "contagem x docs" e áreas: `README.md`, `.agents/PROJECT_CONTEXT.md` (§1 contagem por suíte; §10.0 índice com a coluna `Área` e `[ROTA] · [PR]`) e os `it()` estáticos dos specs em `cypress/e2e/`.
5. Metadados do CI por variável de ambiente (`GITHUB_REF_NAME`, `GITHUB_SHA`, `GITHUB_SERVER_URL`, `GITHUB_REPOSITORY`, `GITHUB_RUN_ID`); local: `git rev-parse`.

## Passos (saída do hook, entrada do gerador)
`cypress/reports/passos/<slug-do-spec>.<timestamp>.json`, um array de testes:
```json
[{
  "spec": "cypress/e2e/0-C.backend-receitas.cy.js",
  "titulo": "<título completo do teste, igual ao fullTitle do Mocha>",
  "passos": [{ "texto": "Dado …", "origem": "cy.log", "duracaoMs": 12 }, { "texto": "request GET /prescriptions", "origem": "comando", "duracaoMs": 340 }],
  "motivoPulo": null
}]
```
`origem: "cy.log"` é o passo escrito no teste; `"comando"` é o fallback automático (request, visit, click, type…) quando o teste não tem `cy.log`. `motivoPulo` só preenche quando o teste pulou chamando `this.skip()` depois de um `cy.log` que começa com `⏭️ Sem massa`.

## `chartData` (índice)
```
meta:    { titulo, geradoEm (ISO), origem: 'ci'|'local', branch, sha, runUrl|null, cypressVersion, nodeVersion,
           navegador: { nome, versao }|null, useMocks: boolean|null, sessionLabel|null }
resumo:  { total, passed, failed, skipped, skippedMassa, duracaoMs,
           percentuais: { passed, failed, skipped, skippedMassa }   // strings '12.34'
specs:   [ Spec ]
falhasPorCategoria: [ { categoria, qtd } ]
areas:   [ { area, total, passed, failed, skipped } ]
contagem:{ totalCodigo, totalDocs, totalExecutados,
           porSpec: [ { spec, codigo, executados, docProjectContext, docReadme, ok } ], avisos: [string] }
```
## `Spec` (também é o `featureData` da página do spec)
```
id ('0-C.backend-receitas'), nome, arquivo, slug (nome do HTML), duracaoMs,
totais: { total, passed, failed, skipped, skippedMassa },
contexts: [ { numero, nome, totais, area|null, issues: [Ref] } ],
cenarios: [ Cenario ]
```
## `Cenario`
```
id ('0-C #3.1', regra R-TESTE-ID: suíte + #contexto.índice), titulo, contexto (número), indice,
status: 'passed' | 'failed' | 'skipped' | 'skippedMassa',
duracaoMs, tentativas, flaky (passou só na 2ª tentativa),
issues: [Ref], areas: [string],
erro: null | { categoria, mensagem, trecho (até 40 linhas, sem token) },
motivoPulo: null | string,
passos: [ { texto, origem: 'cy.log'|'comando', duracaoMs|null, status } ],
anexos: [ { tipo: 'screenshot'|'log', titulo, arquivo (relativo ao painel) | dataUri } ]
```
`skipped` = `it.skip` / `[SKIP]` de backlog / pulado por outro motivo; `skippedMassa` = pulou por falta de massa (`motivoPulo` preenchido, regra `[R-ATEMPORAL]` do `AGENTS.md`).
## `Ref`
`{ tipo: 'issue'|'pr', repo: 'backend'|'front'|'cypress', numero, url }`. Extraído do título do `context` (`Issue backend#783/PR #773`). Só linka repositório conhecido: `backend` → `omnicare-org/omnicare-backend`, `front` → `omnicare-org/omnicare-front`, `cypress` → `omnicare-org/cypress-enterprise-suite`; `PR #N` sem repo herda o da issue do mesmo texto; `#N` solto não linka.

## Regras
- Nenhum segredo no relatório: remover Bearer/JWT, senhas e o CNPJ/usuário do `env.json` de mensagens, passos e anexos (o `errorHandler.js` já tem os `replace` de token).
- O site abre por `file://` (sem servidor): nada de `fetch` de arquivo local; dados embutidos como `const chartData = …` e `const featureData = …`.
- Textos de interface em português do Brasil.
