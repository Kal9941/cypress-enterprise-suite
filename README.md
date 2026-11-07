# 🧪 Enterprise Cypress Automation Suite — Omnichannel Platform & CRM

[![GitHub Actions Status](https://img.shields.io/badge/GitHub%20Actions-Executar%20e%20Ver%20Status-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)](https://github.com/Kal9941/cypress-enterprise-suite/actions/workflows/cypress.yml)
[![Cypress Version](https://img.shields.io/badge/Cypress-v15.20.0-17202C?style=for-the-badge&logo=cypress&logoColor=white)](https://www.cypress.io/)
[![k6 Load Testing](https://img.shields.io/badge/k6-Performance%20Testing-7D64FF?style=for-the-badge&logo=k6&logoColor=white)](https://k6.io/)
[![Architecture](https://img.shields.io/badge/Architecture-Strategy%20Pattern%20%7C%20POM%20%7C%20Zod-green?style=for-the-badge)](#-estrutura-de-arquitetura-e-padrões)
[![AI-Governance](https://img.shields.io/badge/AI%20Governance-.agents%20Framework-blueviolet?style=for-the-badge)](#-recursos-para-agentes-de-ia)

> **Framework Corporativo de Alta Fidelidade**: Mais de **1.190 testes automatizados** (E2E, Contratos de API REST e Carga com k6), Strategy Pattern de Mocks (`BaseMock.js`) com validação de schemas em Zod para execução 100% hermética offline em CI/CD, diagnóstico inteligente de falhas com snapshots de DOM e governança orientada a agentes de IA (`.agents/`).

---

## 📌 Visão Geral do Projeto

Este repositório contém a automação corporativa de testes para uma plataforma Omnichannel e CRM (SPA React + API REST): testes E2E com **Cypress** (interface e contratos de API) e testes de carga com **k6**, rodando em matriz paralela no **GitHub Actions** com relatórios consolidados em HTML (Mochawesome) e XML (JUnit).

A suíte conta com **1.190 testes automatizados** distribuídos em 16 specs E2E/backend (`cypress/e2e/`), além dos scripts de carga do k6 (`performance/`) — detalhamento completo em [🧪 Cobertura Atual de Testes](#-cobertura-atual-de-testes).

Principais arquiteturas e padrões: execução híbrida Mock/API Real (Strategy Pattern via `BaseMock.js`), Page Object Pattern (`cypress/pages/`) e Service Object Pattern para testes de backend (`cypress/services/backendApiService.js`), validação de schema dos mocks com Zod, padrão AAA e execução multi-instância isolada por sessão — detalhamento em [🏗️ Estrutura de Arquitetura e Padrões](#-estrutura-de-arquitetura-e-padrões).

O projeto também mantém uma **base de conhecimento dedicada a agentes de IA** (pasta `.agents/`) e um **módulo de diagnóstico inteligente de falhas** (`errorHandler.js`), construídos para que um agente consiga investigar, corrigir e validar testes com o mínimo de intervenção manual do operador — ver [🤖 Recursos para Agentes de IA](#-recursos-para-agentes-de-ia) abaixo.

---

## 🌐 Endereços e Credenciais Globais

O projeto padroniza a separação entre o **Frontend Web** e o **Backend API REST**, utilizando o arquivo `env.json` como fonte única de configuração:

| Variável (`env.json`) | Responsabilidade | Consumido por |
|---|---|---|
| `BASE_URL` | URL do frontend web da aplicação (alinhado ao `baseUrl` nativo do Cypress) | Cypress E2E (`cypress.config.js`) |
| `API_URL` | URL base da API REST (backend) | Testes de Carga (`k6`) |
| `USE_MOCKS` | Alterna entre **Modo 100% Mock Hermético** (`true`) e **Modo API Real** (`false`) | `BaseMock`, `cy.login()`, Suítes E2E |
| `AUTO_SYNC_MOCKS` | Gravação automática de payloads reais em `cypress/fixtures/` no final de cada teste em modo API Real. **Uso não recomendado como padrão persistente** — sobrescreve fixtures canônicas versionadas sem diff revisado e é fonte de corrida em execução multi-instância. Prefira `--env AUTO_SYNC_MOCKS=true` pontual, ou medir contrato novo direto na API real fora do Cypress. | `cypress/support/e2e.js`, `BaseMock` |
| `USER_CNPJ` / `USER_CODE` / `USER_PASSWORD` | Credenciais do operador de teste | Cypress E2E (`cy.login()`) e k6 |
| `DEFAULT_CELULAR` | Número de celular padrão para testes de atendimento via WhatsApp | Cypress E2E e k6 |
| `DEFAULT_CLIENT_NAME` | Nome/termo padrão para busca e validação de clientes cadastrados | Cypress E2E (`4.iniciar-atendimento.cy.js`) |

> 🔒 Os valores reais dessas variáveis (credenciais, celular, nome de cliente) não aparecem neste README — consulte o `env.json` do projeto.

---

### ⚙️ Como Configurar os Endereços e Credenciais

Você pode sobrescrever as URLs, credenciais e modos de execução de três formas:

#### 1. Editando o arquivo local `env.json` (Recomendado):
Crie ou edite o arquivo `env.json` na raiz do projeto:
```json
{
  "BASE_URL": "https://app.omnicare.dev.local",
  "API_URL": "https://api.omnicare.dev.local",
  "USE_MOCKS": false,
  "AUTO_SYNC_MOCKS": false,
  "USER_CNPJ": "<cnpj_da_loja>",
  "USER_CODE": "<codigo_do_operador>",
  "USER_PASSWORD": "<senha_do_operador>",
  "DEFAULT_CELULAR": "<celular_padrao_testes>",
  "DEFAULT_CLIENT_NAME": "<nome_cliente_padrao>"
}
```

> 💡 **`env.json` é a fonte única de verdade:** o `cypress.config.js` consome `BASE_URL` para o `baseUrl` nativo do Cypress; os scripts k6 leem `API_URL` diretamente para realizar as chamadas HTTP ao backend; e o `USE_MOCKS` dita a estratégia de mock em tempo de execução.

#### 2. Configuração centralizada no `cypress.config.js`:
```javascript
const { defineConfig } = require("cypress");
const configEnv = require('./env.json');

module.exports = defineConfig({
  e2e: {
    baseUrl: configEnv.BASE_URL || 'https://app.omnicare.dev.local',
    env: {
      USE_MOCKS: configEnv.USE_MOCKS ?? false,
      // Default `false` — ver nota na tabela acima sobre uso recomendado apenas via
      // `--env AUTO_SYNC_MOCKS=true` pontual, nunca persistente.
      AUTO_SYNC_MOCKS: configEnv.AUTO_SYNC_MOCKS ?? false,
      userCnpj: configEnv.USER_CNPJ,
      user: configEnv.USER_CODE,
      userPassword: configEnv.USER_PASSWORD,
    },
  },
});
```

#### 3. Sobrescrevendo via linha de comando no Terminal:
```bash
# Executar em modo 100% Mock (desacoplado de backend e WhatsApp)
npx cypress run --env USE_MOCKS=true

# Executar contra API Real
npx cypress run --env USE_MOCKS=false

# Sincronizar fixtures a partir de respostas reais pontualmente (uso deliberado, não deixe como padrão em env.json)
npx cypress run --env USE_MOCKS=false,AUTO_SYNC_MOCKS=true
```

---

## 🛠️ Tecnologias e Dependências

* **[Cypress](https://www.cypress.io/) (`v15.x`)**: Framework principal de automação E2E UI e validação de contratos de API.
* **[k6 (Grafana)](https://k6.io/)**: Ferramenta open-source de testes de carga e performance para estresse e resiliência das APIs.
* **[cypress-mochawesome-reporter](https://www.npmjs.com/package/cypress-mochawesome-reporter)**: Gerador de relatórios gráficos interativos em HTML com screenshots embutidos.
* **[mocha-junit-reporter](https://www.npmjs.com/package/mocha-junit-reporter)**: Gerador de relatórios em XML compatível com dashboards de CI/CD.
* **[cypress-multi-reporters](https://www.npmjs.com/package/cypress-multi-reporters)**: Gerenciamento e compilação simultânea dos relatórios HTML e XML.
* **[zod](https://www.npmjs.com/package/zod)**: Validação de schema dos payloads mockados em tempo de execução (`cypress/support/schemas.js`).
* **[patch-package](https://www.npmjs.com/package/patch-package)**: Aplica correções em `node_modules` sem fork, reaplicadas via `postinstall` a cada `npm install`/`npm ci`.

---

## 🏗️ Estrutura de Arquitetura e Padrões

O projeto segue rigorosamente os seguintes padrões de engenharia de software e automação:

* **Arquitetura Híbrida de Mocks (Strategy Pattern & `BaseMock.js`):** Todas as classes em `cypress/mocks/` herdam de `BaseMock`. Quando `USE_MOCKS: true`, os endpoints respondem deterministicamente com fixtures locais (`req.reply`). Quando `USE_MOCKS: false`, o tráfego flui normalmente para o backend (`req.continue`); `AUTO_SYNC_MOCKS: true` captura e persiste payloads atualizados em disco automaticamente, mas é **desligado por padrão** — o padrão preferido do projeto para descobrir/validar contrato novo é medir direto contra a API real fora do Cypress (`node`+`https`) e atualizar a fixture manualmente com diff revisado, evitando sobrescrever fixtures canônicas compartilhadas sem revisão.
* **Blindagem "100% Mockada":** `context`s que dependem de um estado não-determinístico na API real (ex.: atendimento garantidamente sem cliente vinculado) capturam e restauram `Cypress.env('USE_MOCKS')` em `before`/`after`, forçando mock só naquele agrupamento, independente do modo de execução escolhido para o resto da suíte.
* **Validação de Schema dos Mocks (Zod, `cypress/support/schemas.js`):** valida o payload (`customPayload`/`defaultBody`) no exato momento do intercept, falhando de forma síncrona e explícita antes de qualquer `cy.wait` confuso a jusante.
* **Padrões de intercept na forma nova das rotas (`cypress/support/rotaApi.js`):** o backend lê a loja do token e o front chama as rotas sem `/stores/:id` (backend#677); `rotaApi('recurso…')` e `regexApi('…')` montam o padrão como URL absoluta da `API_URL`, o que ancora host e caminho (sem o host, `**/resources*` casaria um arquivo JS do app; sem a âncora, `**/channels*` casaria `/attendances/channels`). Mocks, `e2e.js`, `commands.js`, specs, `backendApiService.js`, k6 e `audit:routes` usam só a forma nova. Entre 2026-10-19 e 2026-10-20 um atalho (`urlsComOuSemLoja.js`) fez os padrões antigos aceitarem as duas formas; foi removido quando os padrões passaram à forma nova.
* **Service Object Pattern para Backend (`cypress/services/backendApiService.js`):** fonte única das rotas de API consumidas pela suíte `0-A/0-B/0-C.backend-*.cy.js`, que testa contratos via `cy.request()` sem renderização de tela.
* **Page Object Pattern Reorganizado:** Todos os seletores (`elements`) e ações da UI ficam isolados em classes específicas (`cypress/pages/`).
* **Centralização da Lógica de APIs nos Mocks e Page Objects:** Chamadas HTTP, interceptações e payloads ficam estritamente encapsulados nos módulos de mock (`cypress/mocks/`), mantendo os arquivos `.cy.js` limpos e legíveis.
* **Padrão AAA (Arrange, Act, Assert):** todo `it()` do projeto é dividido mentalmente (e geralmente também visualmente, por espaçamento/comentário) em 3 blocos sequenciais, sem misturar as responsabilidades de um bloco no outro:
  1. **Arrange (Organizar):** prepara o estado inicial do cenário — login, mocks/intercepts da rota envolvida, navegação até a tela, dados de massa necessários. Nada é verificado aqui, só preparado.
  2. **Act (Agir):** executa a única ação que o teste existe para validar — um clique, um `cy.visit()`, um envio de formulário, uma chamada de API. Idealmente uma ação por teste; vários `Act`s no mesmo `it()` são sinal de que ele deveria ser dividido em mais de um teste.
  3. **Assert (Verificar):** confere o resultado esperado daquela ação — o DOM mudou, a rota foi chamada com o payload certo, o status HTTP é o esperado. É aqui (nunca dentro de um `if`, ver `AGENTS.md` `[R-AFP]`) que o teste realmente falha quando algo quebra.

  Na prática: `cy.login()` + `AtendimentosMocks.interceptAttendancesListApi()` é Arrange; `cy.visit('/atendimentos')` é Act; `cy.get('[data-testid="attendance-queue-item-123"]').should('be.visible')` é Assert. Esse isolamento é o que permite rodar qualquer teste sozinho (`.only`) sem depender da ordem de execução dos outros.
* **Autenticação Desacoplada e Rápida (`cy.login`):** No modo mock, o login forja um token JWT dinâmico com base nos dados de `env.json` (`USER_CODE`, `USER_CNPJ`, `DEFAULT_CLIENT_NAME`), acelerando o bootstrap dos testes para execução em CI/CD em poucos segundos.
* **Coordenação Multi-Sessão (`.claude/locks.json`, `.claude/active-runs.json`, `SESSION_LABEL`):** isola artefatos e evita corrida entre execuções simultâneas no mesmo diretório — detalhamento em [🧩 Execução Multi-Instância](#-execução-multi-instância-múltiplas-abassessões-simultâneas).
* **Patch de Dependências (`patch-package`, `patches/`):** corrige bugs pontuais em `node_modules` (hoje usado no `cypress-mochawesome-reporter`) sem fork, reaplicado via `postinstall` a cada instalação.
* **Suporte Inteligente a Modais com Scroll:** Tratamento automático de elementos com scroll interno (`scrollIntoView`) e detecção dinâmica de componentes de texto (`#sa-template-text`, `#sa-template-body`, `#sa-message`).
* **Status Obrigatório da Fila (Aguardando):** Novos atendimentos ingressam estritamente no status "Aguardando" (`chipWaiting`). Todos os fluxos de busca, abertura de chats e testes de fila respeitam essa regra de negócio, garantindo fidelidade ao estado padrão do sistema.
* **Resiliência e Auto-Criação de Atendimentos:** Quando a busca por celular não localiza atendimento no status "Aguardando", a automação instancia um novo atendimento via modal com template WABA editável e aguarda a ativação da janela por até 1:30 min no WhatsApp físico do cliente.
* **Diagnóstico Inteligente de Falhas (`cypress/support/errorHandler.js`):** Classificação automática de causa raiz com sanitização de tokens JWT, gravação de snapshot DOM em tempo real e geração unificada de logs estruturados — ver detalhamento completo em [🤖 Recursos para Agentes de IA](#-recursos-para-agentes-de-ia).
* **Logs Semânticos de Acompanhamento (`cy.log`):** Rastreabilidade passo a passo das ações da automação diretamente no runner para identificação imediata da etapa em execução.

---

## 🤖 Recursos para Agentes de IA

O projeto foi deliberadamente instrumentado para que um agente de IA consiga **diagnosticar, corrigir e validar testes com o mínimo de intervenção do operador**. Esta seção documenta tecnicamente as peças dessa instrumentação.

### 🧠 Diagnóstico Inteligente de Falhas (`cypress/support/errorHandler.js`)

Módulo que intercepta toda falha do Cypress em tempo de execução (`Cypress.on('fail')`), classifica a causa raiz e produz um diagnóstico estruturado — pensado tanto para leitura humana quanto para consumo direto por um agente de IA, sem que ele precise reabrir o Cypress ou adivinhar o que aconteceu.

* **Classificação automática de causa raiz (`classificarErro`):** analisa a mensagem de erro e a stack trace e enquadra a falha em uma de 9 categorias amplas, cada uma com ícone, descrição e **ação recomendada específica e acionável** (não genérica):
  1. 🚨 **Timeout de Rede / API Lenta (`ESOCKETTIMEDOUT`)** — extrai a rota afetada da própria mensagem de erro.
  2. 📱 **Timeout de Resposta no WhatsApp (Janela 24h)** — distingue especificamente o cenário de espera por resposta humana no aparelho físico, com a janela já aberta.
  3. ⏱️ **Timeout de `cy.wait('@alias')`** — subdividido em "API não respondeu a tempo" vs. "requisição nunca foi disparada pelo frontend", já sugerindo se o problema é cache do React Query ou ação anterior que não disparou a rota.
  4. 🛡️ **Botão/Ação Não Renderizada por Falha de Capabilities ou Permissões** — reconhece padrões de seletor ligados a permissões e aponta exatamente quais rotas de `capabilities` conferir.
  5. 🔍 **Elemento Não Encontrado no DOM** — extrai o seletor exato que falhou da mensagem do Cypress.
  6. 👁️ **Elemento Oculto, Coberto ou Desabilitado** — distingue de "não encontrado", sugerindo `scrollIntoView()` ou verificação de backdrop/modal.
  7. 🌐 **Falhas de Backend/API REST**, com sub-classificação própria por código HTTP (400, 401 inesperado, 401 esperado mas recebeu 200 — falha de RBAC, 403, 404, 500, divergência de schema JSON) — cada uma com a ação recomendada específica daquele código.
  8. ⚖️ **Divergência de Regra de Negócio/Asserção**, 💥 **Crash de Frontend (exceção não tratada)** e um fallback genérico para o resto.
  9. 🔒 **Janela de 24h Fechada / Sessão Não Iniciada** — `input-message` nunca fica disponível; distinta da categoria 2 (ali a janela já chegou a abrir e só demora a responder, aqui ela nem chegou a abrir, então esperar mais não resolve).
* **Extração automática de contexto via regex:** a rota afetada, o nome do alias esperado, o seletor procurado, a propriedade de schema ausente e os códigos de status recebido vs. esperado são extraídos diretamente da mensagem de erro e embutidos no diagnóstico — o agente não precisa reprocessar o erro bruto.
* **Sanitização de dados sensíveis (`sanitizarMensagem`):** remove tokens JWT/`Bearer` de mensagens de erro e do próprio HTML capturado antes de gravar qualquer coisa em disco.
* **Snapshot estruturado de DOM (`extrairSnapshotDOM`):** no momento da falha, captura URL, título da página, modais/gavetas/popovers abertos (`[role="dialog"]`, `aside`, `[data-testid*="modal"]`, `[data-testid*="drawer"]`), o elemento com foco e o HTML completo do `<body>` (sanitizado), empacotando tudo como uma página HTML navegável e autocontida (`last-failure-dom.html`) com um banner de contexto no topo. Para specs de **backend** (sem DOM/`cy.request()`), gera uma variante explicando onde olhar (`failures.log`, aba de rede do Cypress) em vez de um snapshot vazio e confuso.
* **Registro estruturado em JSON (`criarRegistroFalha`):** grava `timestamp` (ISO e horário de Brasília), `spec`, `suite`, `test`, `categoria`, `descricao`, `acaoRecomendada`, `detalheTecnico` e `stack` (sanitizados e truncados) — é literalmente o payload por trás de `failures.json` e `last-failure.json`, desenhado para ser lido por um agente sem parsing manual de texto livre.
* **Integração com Mochawesome (`formatarDiagnostico`):** reescreve a própria `err.message` do Cypress para que o relatório HTML final já mostre categoria, descrição e ação recomendada diretamente na tela de falha.

### 🔎 Trace de Falha no `cypress open` (`cypress/support/traceFalha.js`)

Complemento do diagnóstico acima para rodadas feitas por uma pessoa na interface do Cypress, em qualquer navegador (Chrome, Edge, Firefox). Fica desligado no `cypress run` e na Lambda e só liga no modo interativo ou com `--env TRACE_FALHAS=true`, então não pesa no CI.

* **O que grava quando um teste falha:** navegador e versão, foco da janela (decisivo em hover e foco por teclado no Firefox), tamanho da viewport, `prefers-reduced-motion`, os últimos comandos do Command Log, as últimas requisições com o alias de cada uma, `console.error`/`console.warn` e erros não tratados do app.
* **Sonda dos seletores do erro:** para cada seletor citado na mensagem, informa quantos elementos existem, o veredito de visibilidade do próprio Cypress com o motivo textual, `position`, `pointer-events`, o elemento que cobre o alvo e o ancestral que o recorta. Separa "não existe" de "existe, mas o Cypress o considera oculto".
* **Onde fica:** `cypress/reports/trace/<SESSION_LABEL>/<teste>.json`, um por teste que falhou, e `cypress/reports/trace/ultimo.json` com a falha mais recente. A pasta `cypress/reports/` é ignorada pelo git.
* **Observação:** o arquivo de suporte é carregado ao abrir o spec. Como o projeto desliga o `watchForFileChanges`, é preciso fechar e reabrir o spec para a mudança valer.

### 📚 Base de Conhecimento para Agentes (`.agents/`)

Pasta dedicada que funciona como memória operacional persistente para agentes de IA trabalhando neste repositório. Desde 2026-10-16 segue o padrão **quente/frio**: cada arquivo tem o marcador `<!-- fim-quente -->`; o agente lê na abertura da sessão só o que está acima dele (regras, estado, índices — cerca de 25k tokens em vez de 150k) e abre o resto sob demanda pelo **Mapa de leitura** no topo de cada arquivo, cuja coluna "Ler quando" diz o gatilho. A numeração das seções é preservada dos dois lados, então toda citação (`AGENTS.md §3.5`) continua válida.

* **`AGENTS.md`** — regras de comportamento do agente. Quente: checklist de disciplina, governança, orçamento de diagnóstico, ciclo de vida de `.only`/`.skip`, execução, multi-sessão, fluxos canônicos e as **particularidades deste projeto para as skills** (`[R-SKILL]`). Frio: lições de mocks, seletores, anti-falso-positivo, heurísticas do app por tela e diagnóstico automático.
* **`PROJECT_CONTEXT.md`** — fonte única de verdade do sistema. Quente: contagem canônica, stack, estrutura, variáveis de ambiente, arquitetura de mocks e o índice por context (§10.0, `[QUENTE]`). Frio: regras de negócio, permissões, contratos por rota, anexos e o **inventário canônico de todos os testes** (linha exata + descrição de cada `it()`), consultado por Grep antes de criar testes novos.
* **`ROADMAP.md`** — status atual da suíte (só números e exceções), backlog priorizado em tabela (ID, título, resumo de 1 linha) e a tabela de mudanças não commitadas por sessão; o corpo de cada item do backlog fica no frio (§5).
* **`HISTORICO.md`** — changelog só de escrita: homologações (`.only` removido) e log executivo de entregas; nunca lido na abertura, consultado por Grep de issue/PR/teste.
* **`skills/`** — versões genéricas das skills `inicia-contexto-projeto`, `atualiza-context` e `pre-commit` (publicadas no painel do Claude; o que é específico do repositório fica no `AGENTS.md` §6, lido por elas antes de agir; ao fechar a aba sem commit garantido, `atualiza-context` deixa a linha do §4 completa com arquivos, estado e commit sugerido, e `pre-commit` parte dela) e a skill `inicia-novo-projeto`, que cria esta mesma base `.agents/` num repositório novo (QA ou Dev) ou migra uma base existente para o padrão quente/frio — leva os moldes dos 4 arquivos, do lint e das 3 skills em `templates/`.
* **`npm run docs:lint`** (`scripts/lint-agents.js`) — guarda mecânica do padrão: falha se faltar o marcador, se a parte quente passar do teto por arquivo ou se alguma linha passar de 5.000 caracteres (a leitura do agente é por linha). Chamado pela skill `pre-commit`.

### 🏷️ Identificação Automática de Sessão (Claude Code)

Hooks (`.claude/hooks/` e `.claude/settings.json`, versionados; o estado — `sessions.json`, `locks.json`, `logs/` — segue git-ignorado) ajudam a distinguir múltiplas sessões de agente de IA abertas ao mesmo tempo neste diretório — mecanismo independente do `SESSION_LABEL` do Cypress (que namespacia artefatos de execução, não sessões de agente):

* **`auto-rename.js` (`SessionStart`):** define o título inicial da sessão a partir do branch git atual (fallback: nome da pasta) **e** registra o rótulo (`aba-a`/`aba-b`/…) desta sessão em `.claude/sessions.json`, correlacionado pelo `session_id` que o Claude Code envia no stdin do hook (fallback: variável de ambiente `CLAUDE_CODE_SESSION_ID`). Os dois hooks são registrados em `.claude/settings.json` (versionado, com `${CLAUDE_PROJECT_DIR}`, sem caminho absoluto); o `UserPromptSubmit` usa o `session_title` do stdin para não sobrescrever um `/rename` manual.
* **`auto-rename-on-prompt.js` (`UserPromptSubmit`):** citou `issue` + número na própria linha digitada (nunca em texto colado) → renomeia o título para `issue <número> <repositório>`; o prefixo (`backend`/`back`/`back-end`, `front`/`frontend`/`front-end`, `cypress`) é opcional — sem ele o título é só `issue <número>`, e o repositório nunca é inferido. Prefixo e número podem estar colados (`front#489`) ou na mesma frase em qualquer ordem (`issue 010 do cypress`). Sem issue no prompt **e** nenhuma issue citada ainda nesta sessão → título cai pro rótulo da própria aba (`aba-a`/`aba-b`/…); depois da 1ª issue citada, prompts de acompanhamento sem repetir o número não revertem mais o título (evita alternar a cada mensagem). Prompts automáticos (avisos do Monitor de locks e de tarefas em segundo plano, que trazem a issue de **outras** abas no texto) são ignorados e nunca mudam o título; o hook guarda o título da issue em `.claude/sessions.json` e o reaplica nos prompts seguintes sem número novo, o que corrige qualquer sobrescrita.
* **O que o `auto-rename-on-prompt.js` ignora:** texto colado, avisos automáticos (Monitor, tarefas em segundo plano, `system-reminder`), mensagens de outra sessão (`<cross-session-message>`, que trazem o título da aba remetente) e relatórios de subagente (`<agent-message>`); só a linha digitada pelo operador renomeia a aba.
* **`.claude/logs/auto-rename.log` e `ler-log.js`:** os dois hooks gravam uma linha por execução (o que receberam e o que decidiram: prompt automático ignorado, issue achada, título reaplicado, sessão fora do `sessions.json`, erro) para explicar um título que não mudou. Ver com `node .claude/hooks/ler-log.js [aba-x] [N] [--problemas]`; o arquivo é aparado em 1 MB e nunca derruba o hook.
* **`.claude/sessions.json`:** registro cooperativo (não é lock) dos rótulos `aba-a`/`aba-b`/… atribuídos a cada sessão ativa, correlacionado por `sessionId`, usado para coordenar múltiplas abas no mesmo diretório — ver `.agents/AGENTS.md` §1.5 para o detalhamento completo do protocolo. O `auto-rename-on-prompt.js` renova o `lastSeenAt` da própria entrada a cada prompt (no máximo a cada 10 min, inclusive nos avisos do Monitor), porque a poda por inatividade (4 h, no `SessionStart`) apagava a aba ainda ativa quando outra sessão iniciava, e o rótulo e o título da issue iam junto.

### 🔎 Ferramentas de Descoberta de Elementos

* **Scanner Estático de Bundles (`npm run scan:elements`):** baixa e varre os chunks JS publicados em produção, catalogando todos os `data-testid`s do frontend em `cypress/reports/elements-inventory.json` — permite identificar seletores novos (ou renomeados) publicados em deploy sem depender de inspeção manual via DevTools.
* **`cy.salvarSnapshotDom('identificador')`:** captura a árvore DOM completa da tela no momento da chamada (sanitizada contra tokens JWT), útil para inspecionar o estado real de uma tela durante o desenvolvimento de um teste novo, sem precisar forçar uma falha artificial.
* **`cy.get(seletor).salvarHtml('identificador')`:** captura apenas o HTML de um componente isolado (modal, gaveta, formulário) para análise focada.
* **`cy.inspecionarElemento(seletor)`:** registra no Command Log e no console uma tabela com `data-testid`, `role`, atributos `aria-*`, classes, dimensões reais e flags de habilitação (`disabled`) do elemento.
* **Auditoria de Rotas de Backend (`npm run audit:routes` / `audit:routes:live`):** identifica rotas do `0-A/0-B/0-C.backend-*.cy.js` que ficaram inválidas sem precisar rodar a suíte inteira nem ler logs de falha. O modo estático (padrão) extrai todas as rotas de `cypress/services/backendApiService.js`, cruza com as chamadas reais nos testes e aponta métodos órfãos (rota mapeada mas sem nenhum teste chamando-a) e rotas documentadas como "fantasma"/descontinuadas. O modo `--live` autentica na API real e dispara um GET leve (somente leitura) para cada rota GET mapeada, comparando a resposta atual com o documentado — sem nunca chamar rotas de escrita ao vivo. Resultado em `cypress/reports/backend-routes-audit.json`.

### 📊 Painel de Testes Próprio (`npm run relatorio`)

Site estático em português que consolida o resultado dos testes num lugar só (adaptado do relatório de testes de outro projeto da casa). `npm run relatorio` lê os relatórios de `cypress/reports/` e gera `cypress/reports/painel/index.html` (abre por `file://`, sem servidor); `--entrada <dir>[,<dir>]` e `--saida <dir>` escolhem as pastas, `--ci` lê os metadados do GitHub Actions.

* **O que mostra:** status dos testes e por suíte, duração e os testes mais lentos, falhas por **categoria** (as mesmas famílias do `errorHandler`), testes por **área** (coluna `Área` do `PROJECT_CONTEXT.md` §10.0), links de **issue e PR** tirados do título do `context`, **passos** de cada teste, anexos de falha e o painel **Contagem x docs** (`it()` no código × executados × `PROJECT_CONTEXT.md` × README, com aviso quando divergem).
* **Pulado por falta de massa:** o teste que não achou o dado de que precisa e terminou com `cy.log('⏭️ Sem massa: …')` + `this.skip()` (regra `[R-ATEMPORAL]`) aparece separado do `[SKIP]` de backlog, com o motivo.
* **Passos (`cypress/support/passos.js`):** hook global e passivo que grava, por teste, o `cy.log` escrito no corpo dele (e, quando não há nenhum, um resumo dos comandos: `request GET /…  → 200`, `click [data-testid=…]`) em `cypress/reports/passos/`. Nunca grava texto digitado, token, senha nem CNPJ, e não altera o resultado dos testes.
* **No CI:** o job `relatorio-consolidado` baixa os artefatos `relatorios-testes-<spec>` dos 15 jobs, gera o painel único e o sobe como artefato `painel-relatorio` (14 dias), mesmo com spec vermelho. O JSON do Mochawesome vai embutido no HTML do relatório, por isso o artefato basta.
* **Onde fica o código:** `scripts/relatorio/` (gerador em `gerar-relatorio.js` e `lib/`, site em `template/`, contrato de dados em `MODELO.md`). `node scripts/relatorio/template/renderizar.js --exemplo` gera uma amostra com dados fictícios em `cypress/reports/painel-exemplo/`. Gráficos em ApexCharts e ícones em Font Awesome Free: licenças e a decisão sobre o ApexCharts em `scripts/relatorio/template/assets/LICENCAS.md`.

---

## 📑 Estrutura de Relatórios e Evidências

Os relatórios e diagnósticos são gerados automaticamente com timestamp no formato brasileiro (`DD-MM-AAAA_HH-MM-SS`), garantindo histórico incremental sem sobrescritas:

* 📄 **Relatórios HTML (Mochawesome):** `cypress/reports/html/relatorio-execucao_DD-MM-AAAA_HH-MM-SS_[name].html`
* 📑 **Relatórios XML (JUnit):** `cypress/reports/junit/test-results_DD-MM-AAAA_HH-MM-SS-[hash].xml`
* 🚨 **Diagnósticos Estruturados de Falha (ver [🤖 Recursos para Agentes de IA](#-recursos-para-agentes-de-ia) para o detalhamento técnico):**
  * `cypress/reports/failures/<SESSION_LABEL>/failures.json` e `last-failure.json`: Arquivos estruturados legíveis por máquina/IA com campos diretos (`spec`, `suite`, `test`, `categoria`, `descricao`, `acaoRecomendada`, `detalheTecnico`, `stack`).
  * `cypress/reports/failures/<SESSION_LABEL>/failures.log` e `last-failure.log`: Relatório visual em texto com instruções de resolução passo a passo para o operador.
  * `cypress/reports/failures/<SESSION_LABEL>/last-failure-dom.html`: Snapshot navegável do DOM real da tela no momento da falha.
  * 🧹 **Limpeza Automática:** No início de cada bateria de testes, a pasta de falhas **da própria sessão** é limpa automaticamente via task Node, garantindo **zero lixo** no projeto caso a suíte passe com 100% de sucesso — sem apagar o diagnóstico de outra instância concorrente (ver abaixo).
* 📸 **Screenshots:** Capturados automaticamente no final de fluxos críticos e em eventuais falhas em `cypress/screenshots/`.
* 🔍 **Inventário de Elementos:** `cypress/reports/elements-inventory.json` — catálogo de `data-testid`s do frontend gerado por `npm run scan:elements`.
* 📊 **Painel de Testes:** `cypress/reports/painel/index.html` — site consolidado gerado por `npm run relatorio` (ver [📊 Painel de Testes Próprio](#-painel-de-testes-próprio-npm-run-relatorio)); passos de cada teste em `cypress/reports/passos/`.

### 🧩 Execução Multi-Instância (Múltiplas Abas/Sessões Simultâneas)

Quando mais de uma sessão roda `cypress run`/`open` ao mesmo tempo no mesmo diretório de trabalho, os artefatos compartilhados são isolados por sessão para que uma instância nunca apague ou misture o diagnóstico de outra ainda em andamento:

* **`SESSION_LABEL` (flag `--env`, não uma chave de `env.json`):** namespacia `cypress/reports/failures/<label>/` e `cypress/downloads/<label>/` (`resolveSessionLabel()` em `cypress.config.js`). Informe explicitamente ao rodar mais de uma instância: `npx cypress run --env SESSION_LABEL=aba-A`. Sem rótulo, cai num fallback automático por PID (`sessao-pid-<PID>`) — sem colisão, mas gera pastas órfãs; prefira o rótulo explícito.
* **Merge de relatório Mochawesome (`cypress/reports/html/.jsons/`):** `cypressParallel: true` (`cypress.config.js`) impede que o `before:run` de uma instância apague essa pasta compartilhada enquanto outra ainda está gerando seu relatório (fix de 25/09/2026). Como efeito colateral, a lib para de limpar essa pasta sozinha — mitigado pela task `limparJsonsAntigos`, chamada no `before()` global, que purga só os `.json` com mais de 3h (nunca a pasta inteira).
* Ver `.agents/ROADMAP.md` (item P0 "Arquitetura de Testes para Múltiplas Instâncias") para o histórico completo e as lacunas ainda em aberto (ex: `env.json` continua um arquivo único por máquina).

---

## 🧪 Cobertura Atual de Testes

**Total E2E e Backend:** **1190 testes automatizados** em 16 suítes:

- **`0-A.backend-acesso-cadastros-orcamentos`** (216) — contratos da API real, sem interface: autenticação, permissões e recursos, loja do token, timestamps, catálogos e busca, clientes, orçamentos, links de pagamento, revenda e automações.
- **`0-B.backend-atendimentos`** (106) — contratos da API real, sem interface: fila, atendentes, status, mensagens e anexos, reações, eventos, canais e grupos, transferência e arquivos de IA.
- **`0-C.backend-receitas`** (181) — contratos da API real, sem interface: receitas, fórmulas e cálculo, documentos, insumos controlados, portarias, vínculo da receita com o atendimento e loja da sessão gravada na criação da receita.
- **`0-D.backend-automacoes-fluxos-campanhas`** (29) — contratos da API real, sem interface: automações, fluxos e campanhas rodando no motor (disparo dos eventos, execução dos passos, fila da espera, webhook e gatilho Agendado), em job próprio porque cada teste espera o ciclo do motor.
- **`1.permissoes`** (45) — matriz de permissões do operador, validada no payload (`can_*`) e na interface.
- **`2.login`** (25) — tela de login: autenticação, validações, máscaras, aviso de sessão expirada e restauração de sessão (2 blocos usam `forEach` e cobrem 8 cenários em runtime).
- **`3.central`** (17) — dashboards, filtro de período, métricas, tema e encerramento de sessão.
- **`4.iniciar-atendimento`** (19) — modal de iniciar atendimento: canais e grupos, templates WABA, mensagens padrão e busca de clientes.
- **`5-A.atendimentos-fila`** (95) — fila de atendimentos: busca, filtros, prioridade e ordenação, canal oficial e não oficial, status do atendente, transferência, substatus e prévia de mídia.
- **`5-B1.atendimentos-chat-componentes`** (59) — componentes do chat (mensagens, orçamentos, templates, citação, link de pagamento) e anexos (envio, colagem e limites).
- **`5-B2.atendimentos-chat-janela`** (59) — janela de 24h, templates WABA, busca na conversa, legenda em anexos e personalização do orçamento.
- **`5-B3.atendimentos-chat-mensagens`** (52) — upload em rede lenta, mensagem com falha e reenvio, reações, orçamento por canal e estado do compositor.
- **`5-C.atendimentos-clientes`** (96) — cliente do atendimento: drawer "Dados do Cliente" (com consulta de CEP no endereço), vincular cliente, troca PF/PJ e guardas de saída (inclusive da Receita aberta no atendimento).
- **`6.receitas`** (68) — formulário e lista de receitas: receita aberta pelo atendimento, preenchimento da fórmula pelo teclado, fórmula acrescentada a receita gravada, aviso do Calcular fixo e teto dos campos numéricos da fórmula, lista com busca, filtros, ordem e rolagem, e guarda de saída pelo menu lateral.
- **`7.clientes`** (63) — listagem, busca, cadastro, edição e inativação de clientes, com consulta de CEP no endereço da ficha e do cadastro novo.
- **`8.automacoes`** (60) — tela de Automações: listagem com busca e filtros, recurso não contratado e automações padrão, cadastro (criar, salvar, ativar, pausar, duplicar e excluir), construtor de passos com ramos da condição, espera, webhook, gatilho Agendado e matriz gatilho × passo, validação de ativação, edição concorrente (409) e recusa do servidor (422).

> 💡 Cada suíte abaixo expande numa lista de **contextos** (agrupamentos temáticos); cada contexto expande na lista exaustiva dos seus testes. A fonte de verdade linha-a-linha (incluindo o número exato da linha no código) é `.agents/PROJECT_CONTEXT.md` §10, mantida em sincronia com o código a cada teste criado, movido ou removido.

---

### 0. Backend e Integração API (`cypress/e2e/0-A`, `0-B`, `0-C` e `0-D.backend-*.cy.js`) — 530 Testes

Suíte unificada para validação de **histórias e regras de negócio de backend na API real**. Utiliza a camada de serviço `cypress/services/backendApiService.js`, comunicando-se via `cy.request()` sem renderização de tela e totalmente imune a mocks (`USE_MOCKS`):

<details>
<summary><b>🔍 0 — 527 testes em 4 specs (clique para expandir)</b></summary>

<dl><dd>

<br>

<details>
<summary><b>0-A — Acesso, Cadastros e Orçamentos (<code>0-A.backend-acesso-cadastros-orcamentos.cy.js</code>) — 216 testes em 33 contextos</b></summary>


<dl><dd>

<br>

<details>
<summary><b>Contexto 1: Autenticação e Perfil de Usuário — 3 testes</b></summary>

<dl><dd>

- 1.1. **Autenticar com sucesso usando credenciais válidas e retornar token JWT:** Login via `POST /auth` com credenciais do `env.json`; valida status 200 e presença do JWT.
- 1.2. **Rejeitar autenticação com senha incorreta retornando status 401:** Rejeição de login com senha errada; valida 401 Unauthorized.
- 1.3. **Consultar os dados cadastrais do operador autenticado (`/users/me`):** `GET /users/me`; valida retorno do perfil com nome, loja e permissões.

</dd></dl>

</details>

<details>
<summary><b>Contexto 2: Central, Métricas e Recursos da Loja — 6 testes</b></summary>

<dl><dd>

- 2.1. **Consultar a matriz de recursos e módulos habilitados (`/resources`):** `GET /resources`; valida presença dos 11 slugs canônicos. Desde a backend#808 o recurso de Clientes é `customer`; o `patient` vem com o mesmo valor só durante a transição.
- 2.2. **Rejeitar consulta de recursos sem autenticação ou com token inválido (401):** Proteção de autenticação na rota de recursos.
- 2.3. **Consultar o resumo e contadores de atendimentos (`/attendances/summary`):** `GET /attendances/summary`; valida contadores de status.
- 2.4. **Consultar as permissões e capabilities da loja (`/attendance-capabilities`):** `GET /attendance-capabilities`; valida tipagem booleana das capabilities.
- 2.5. **Deve publicar no mapa de módulo as permissões de incluir, remover e trocar o atendimento da receita (599, 640, 689) sem estreitar pelo estado de um atendimento (Issue backend#810):** a Receita sabe o que o usuário pode antes de existir o vínculo.
- 2.6. **Deve trazer completed_at em todo item da lista de atendimentos, preenchido só no Concluído (Issue backend#810):** a data de conclusão aparece no seletor de atendimento da Receita.

</dd></dl>

</details>

<details>
<summary><b>Contexto 3: Canais de Comunicação e Mensagens Rápidas — 4 testes</b></summary>

<dl><dd>

- 3.1. **Listar os canais de atendimento vinculados à loja (`/channels`):** `GET /channels`; valida array de canais com `id`, `name` e `type`.
- 3.2. **Listar os grupos de canais de atendimento (`/channel-groups`):** `GET /channel-groups`; valida estrutura de grupos.
- 3.3. **Listar as mensagens rápidas cadastradas (`/standard-messages`):** `GET /standard-messages`; valida presença de conteúdo.
- 3.4. **Consultar as capabilities de mensagens padrão (`/standard-message-capabilities`):** `GET /standard-message-capabilities`; valida capabilities booleanas.

</dd></dl>

</details>

<details>
<summary><b>Contexto 4: Prescrições e Capabilities de Módulos — 3 testes</b></summary>

<dl><dd>

- 4.1. **Consultar as capabilities do módulo de Receitas (`/prescription-capabilities`):** `GET /prescription-capabilities`; valida tipagem booleana.
- 4.2. **Consultar as capabilities do módulo de Entregas (`/delivery-capabilities`):** `GET /delivery-capabilities`; valida campos e tipos.
- 4.3. **Consultar as capabilities do módulo Financeiro (`/financial-capabilities`):** `GET /financial-capabilities`; valida `has_route=false` e sub-flags.

</dd></dl>

</details>

<details>
<summary><b>Contexto 5: Segurança e Controle de Acesso (RBAC) — 3 testes</b></summary>

<dl><dd>

- 5.1. **Rejeitar requisição protegida sem token de autorização com status 401:** Requisição sem header `Authorization` retorna 401.
- 5.2. **Rejeitar requisição com Bearer Token adulterado com status 401:** Token JWT manipulado retorna 401.
- 5.3. **Garantir autenticação obrigatória (401) nas rotas de capabilities de módulos:** Varredura de múltiplas rotas de capabilities sem token.

</dd></dl>

</details>

<details>
<summary><b>Contexto 6: Enforcement de Recursos Contratados pelo Núcleo (PRs #407, #408, #409 e #410) — 6 testes</b></summary>

<dl><dd>

- 6.1. **Recusar chamada direta a rota de recurso não contratado com 403 `RESOURCE_NOT_ENTITLED` (delivery):** Gate de recurso fail-closed; 403 para delivery não contratado.
- 6.2. **Permitir acesso normal a rotas de recursos contratados pela farmácia (attendance):** Acesso liberado a recurso contratado retorna 200.
- 6.3. **Permitir acesso irrestrito a endpoints e catálogos isentos de gate de recurso (clients, `users/me`):** Rotas isentas do gate de recurso passam sem verificação.
- 6.4. **Manter mapas `can_*` funcionais mesmo quando o recurso estiver desabilitado no contrato da loja (RN3 - `financial-capabilities`):** Capabilities retornam valores mesmo com recurso desabilitado.
- 6.5. **Verificar a integridade e fail-closed dos 11 slugs canônicos retornados por `GET /resources` (RN2):** Valida presença e tipagem de todos os 11 slugs.
- 6.6. **Rejeitar acesso sem token com 401 antes da avaliação do gate de recurso:** 401 antes do gate; autenticação precede autorização.

</dd></dl>

</details>

<details>
<summary><b>Contexto 7: Otimização e Latência de Capabilities por Atendimento (PRs #393 e #405) — 5 testes</b></summary>

<dl><dd>

- 7.1. **Consultar capabilities do atendimento com latência otimizada (&lt;500ms) após resolução `hasAll` (PR #393):** Benchmark de latência &lt; 500ms em capabilities.
- 7.2. **Validar a integridade e tipagem booleana estrita das 18 chaves de capabilities do atendimento:** 18 chaves booleanas presentes e tipadas (backend#561 acrescentou `can_take_attendance`).
- 7.3. **Validar a resolução em memória das flags de transferência (`can_transfer_*`):** Flags de transferência resolvidas corretamente.
- 7.4. **Demonstrar estabilidade e ausência de overhead N+1 em consultas consecutivas de capabilities:** N consultas consecutivas sem degradação.
- 7.5. **Rejeitar consulta de capabilities do atendimento sem autenticação (401):** Proteção 401 em capabilities do atendimento.

</dd></dl>

</details>

<details>
<summary><b>Contexto 8: Escopo de Avaliação de Grants pela Loja do Token (PR #412) — 2 testes</b></summary>

<dl><dd>

- 8.1. **Exigir parâmetro `purpose` válido na listagem de filiais (422 `INVALID_CONTEXT`):** Parâmetro obrigatório `purpose` validado.
- 8.2. **Rejeitar requisição sem autenticação com 401 antes da validação de loja:** Autenticação precede validação de loja.

</dd></dl>

</details>

<details>
<summary><b>Contexto 9: Cadastro de Clientes e Sub-recursos (PRs #416 a #422 e #438) — 16 testes</b></summary>

<dl><dd>

- 9.1. **Expor as 18 capabilities de clientes e confirmar governança sob o recurso `customer`, antigo `patient` (PR #418 e #438, backend#808):** 18 capabilities tipadas e governadas por slug `patient`; `can_change_label_name` (341) só como booleana, porque é grant da conta.
- 9.2. **Consultar catálogos e lookups de apoio sem exigência de grants de permissão:** Catálogos públicos (cidades, bairros) acessíveis sem grant.
- 9.3. **Exigir parâmetro `city_id` na busca de bairros respondendo 422 (CA-12):** Parâmetro obrigatório `city_id` validado.
- 9.4. **Listar clientes da tela (`type=all`/`human`/`animal`) sem exigir termo de busca, com fallback 200 vazio em termo curto e busca por nome/código/CPF agnóstica a caixa e acento (Issue backend#586/#588):** Contrato reescrito (era 422/500 abaixo de 3 caracteres) — `q` vazio ou curto responde 200 (procedure `CAD_CLIENTE_CON`), ordem por `last_prescription_at` desc, busca ignora caixa/acento e acha por nome, código ou CPF.
- 9.5. **Retornar ficha completa do cliente com documento cru e capabilities embutidas:** `GET /clients/:id`; valida ficha completa.
- 9.6. **Permitir criação de novo cliente aproveitando grants de dispensa de obrigatoriedade (CA-08 e CA-09):** `POST /clients`; valida criação com dispensas.
- 9.7. **Bloquear tentativa de cadastrar cliente com documento duplicado respondendo 409 `CLIENT_ALREADY_EXISTS` (CA-10):** 409 para documento duplicado.
- 9.8. **Atualizar dados cadastrais via dirty patch sem exigir campos não enviados (Não-Retroatividade):** `PATCH` parcial; valida não-retroatividade.
- 9.9. **Executar ciclo de desativação e reativação com idempotência (CA-13):** Desativação + reativação; valida idempotência.
- 9.10. **Executar CRUD completo de telefones vinculados ao cliente (PR #422):** CRUD de telefones; `POST`, `GET`, `PATCH`, `DELETE`.
- 9.11. **Executar CRUD completo de endereços preservando o apelido `description` na criação e isolar acesso com 404 para sub-recursos de outros clientes (PR #422, CA-15 e PR #533):** CRUD de endereços; `description` persistido já na criação (PR #533) e preservado no `PATCH`; isolamento cross-client.
- 9.12. **Preservar o apelido `description` do endereço embutido na criação do cliente (`POST /clients` - PR #533):** Endereço embutido (campo `address`) na criação do cliente projeta `description` corretamente.
- 9.13. **Aplicar trim de espaços nas pontas e o limite de 60 caracteres (`NAME_MAX`) no apelido `description` do endereço, em paridade entre criação e edição (PR #533):** Trim aplicado já na criação; `422` para apelido acima de 60 caracteres tanto na criação quanto na edição.
- 9.14. **Exibir e gravar RG (`identity_document`), órgão emissor (`issuing_body`) e UF em maiúscula na ficha do cliente pessoa física, preservando os demais campos em edição parcial e validando o tamanho máximo (PR #531):** Grava os três campos com UF normalizada para maiúscula; dirty patch do RG preserva órgão emissor e UF; `422` para UF acima de 2 caracteres e RG acima de 20 caracteres.
- 9.15. **Gravar `identity_document` como inscrição estadual ao cadastrar cliente pessoa jurídica, reaproveitando o mesmo campo do RG da pessoa física (PR #531):** `POST /clients` pessoa jurídica projeta a inscrição estadual no mesmo campo `identity_document` usado pelo RG da pessoa física.
- 9.16. **Paginar a listagem sem os campos `total`/`total_pages`, navegando por `has_next`/`has_previous` e recusando `page`/`per_page`/`q` fora dos limites (Issue backend#586/#588):** Envelope de paginação perdeu `total`/`total_pages`; página 2 não repete itens da página 1; `page`/`per_page`/`q` fora dos limites (200/30/60) recusam com `422`.

</dd></dl>

</details>

<details>
<summary><b>Contexto 10: Sub-flags de Permissão do Legado (PR #417 - Issue #414) — 5 testes</b></summary>

<dl><dd>

- 10.1. **Validar sub-flags no módulo Financeiro separando cancelamento (`EXCLUIR`) e visão (presença) sobre o código 345:** Decomposição do código 345 em sub-flags.
- 10.2. **Projetar capabilities de ciclo de vida da receita diferenciando finalização (`GRAVAR`) e cancelamento (`EXCLUIR`) sobre o código 307:** Decomposição do código 307.
- 10.3. **Decompor o código legado 46 em três capabilities distintas por sub-flag (`GRAVAR`, `ALTERAR`, `EXCLUIR` - PR #418):** Código 46 decomposto em create/update/deactivate.
- 10.4. **Preservar concessão por presença pura para definições transversais sem sub-flag declarada (CA-03):** Presença pura sem sub-flag = grant ativo.
- 10.5. **Garantir consistência e estabilidade na resolução de permissões em cache (`RequestPermissionCache` - CA-05):** Cache de permissões estável entre chamadas.

</dd></dl>

</details>

<details>
<summary><b>Contexto 11: Tratamento de Erros e Observabilidade de Link de Pagamento (PR #445) — 5 testes</b></summary>

<dl><dd>

- 11.1. **Listar as configurações de pagamento ativas da loja (`/payment-configs`):** `GET /payment-configs`; valida gateways ativos.
- 11.2. `[SKIP]` **Classificar recusa determinística de negócio do provedor com 422 e código canônico `PROVIDER_REFUSED` (PR #445):** 422 com código `PROVIDER_REFUSED` em recusa — bug real confirmado em rodadas repetidas, API retorna `502 Bad Gateway` em vez do 422 determinístico (ver `ROADMAP.md` P1).
- 11.3. **Tratar falha upstream ou indisponibilidade de gateway como 502 com proteção de envio incerto:** 502 para falha de gateway upstream.
- 11.4. **Validar regra de negócio e bloquear geração de link para atendimento sem orçamento elegível marcado (422):** 422 sem orçamento elegível selecionado.
- 11.5. **Rejeitar requisição com payload malformado ou ausente com 400:** 400 para payload inválido.

</dd></dl>

</details>

<details>
<summary><b>Contexto 12: Remoção de Link por Financeiro e Invariante `hasRoute = false` (PR #451) — 4 testes</b></summary>

<dl><dd>

- 12.1. **Confirmar que a rota legada `POST /financials/:id/payment-link` foi removida (404 - PR #451):** Rota legada removida retorna 404.
- 12.2. **Validar que a capability `can_generate_payment_link` responde estritamente `false` por invariante `hasRoute = false`:** Invariante `hasRoute=false`; capability sempre `false`.
- 12.3. **Assegurar que o grant 597 permanece ativo e aplicado no catálogo de atendimento (`can_send_payment_link`):** Grant 597 ativo em capabilities de atendimento.
- 12.4. **Confirmar que não existem rotas fantasmas de leitura de links no domínio financeiro (`GET /financials/:id/payment-link` -&gt; 404):** `GET` fantasma retorna 404.

</dd></dl>

</details>

<details>
<summary><b>Contexto 13: Elegibilidade de Orçamentos e Bloqueio de Cobrança Dupla (PR #449) — 6 testes</b></summary>

<dl><dd>

- 13.1. **Projetar a flag `covered_by_approved_link` em cada item de orçamento (`/attendances/:id/budgets` - PR #449):** Projeção de `covered_by_approved_link` na listagem.
- 13.2. **Projetar `financial_id` distinguindo orçamentos já vendidos de pendentes (`/attendances/:id/budgets` - PR #426):** `financial_id` `number` vs `null`.
- 13.3. **Bloquear tentativa de marcar orçamento já pago por link aprovado respondendo 422 (PR #449):** 422 para orçamento coberto.
- 13.4. **Permitir desmarcar e remarcar livremente orçamento aberto e não coberto (200):** Operação livre em orçamento não coberto.
- 13.5. **Excluir orçamentos cobertos por link aprovado da elegibilidade de envio (422 `requireEligibleBudgets`):** 422 ao tentar gerar link sem elegíveis.
- 13.6. **Exigir autenticação obrigatória (401) na consulta e atualização de orçamentos:** 401 em `GET` e `PATCH` de orçamentos.

</dd></dl>

</details>

<details>
<summary><b>Contexto 14: Contrato de Orçamentos e Códigos Estáveis de Recusa (PR #474) — 6 testes</b></summary>

<dl><dd>

- 14.1. **Garantir a projeção do campo `status` (Int não-nulo) em todas as linhas da listagem de orçamentos (`/budgets`):** Campo `status` projetado na listagem.
- 14.2. **Garantir a projeção do campo `status` (Int não-nulo) no retorno da mutação de seleção (`PATCH /budgets/:code`):** Campo `status` projetado no `PATCH`.
- 14.3. **Recusar marcação de orçamento já coberto por link aprovado com erro 422 e código `BUDGET_COVERED_BY_APPROVED_LINK`:** Código canônico de recusa.
- 14.4. **Recusar marcação de orçamento que já virou venda com erro 422 e código `BUDGET_ALREADY_SOLD`:** Código canônico `BUDGET_ALREADY_SOLD`.
- 14.5. **Validar a recusa de marcação de orçamento fora do aberto assegurando que movimentos concluídos ou vendidos não são cobráveis (PR #474):** Bloqueio em orçamento fora do aberto.
- 14.6. **Deve recusar com 422 BUDGET_ZERO_AMOUNT a marcação de um orçamento aberto e sem valor, sem gravar a marcação (Issue front#408):** orçamento sem valor não entra no link de pagamento.

</dd></dl>

</details>

<details>
<summary><b>Contexto 15: Padronização Global de Timestamps em Instant (PR 3 - #341) — 7 testes</b></summary>

<dl><dd>

- 15.1. **Eliminar a assimetria e emitir `reference_at` com sufixo Z tanto no detalhe quanto na listagem de atendimentos:** `reference_at` com sufixo Z.
- 15.2. **Emitir timestamp em formato Instant (Z) nas mensagens do chat (`/attendances/:id/messages`):** Timestamps Z nas mensagens.
- 15.3. **Emitir timestamps em formato Instant (Z) em pedidos de autorização (`/authorization-requests`):** Timestamps Z em autorizações.
- 15.4. **Projetar `registered_at` em formato Instant (Z) na listagem de prescrições da loja (`/prescriptions`):** `registered_at` com Z em prescrições.
- 15.5. **Emitir timestamps em formato Instant (Z) nas transições de ciclo de vida da receita (`/finalize`):** Timestamps Z no `finalize`.
- 15.6. **Deve gravar o agora no fuso do banco do tenant: automação e receita criadas agora voltam com o instante a minutos do relógio, sem deslocamento de horas (Issue backend#834):** o instante sai no fuso da farmácia.
- 15.7. **Deve devolver a data de entrega enviada no finalize como o mesmo instante, no finalize e no detalhe (Issue backend#834):** gravação e leitura usam o mesmo fuso.

</dd></dl>

</details>

<details>
<summary><b>Contexto 16: Bloqueio de Marcação de Orçamento Fora do Aberto (PR #474) — 4 testes</b></summary>

<dl><dd>

- 16.1. **Permitir marcar para link de pagamento o orçamento residual com status -1, sem venda e sem link aprovado (regra da backend#583):** `200`, flag marcada e status preservado; o `BUDGET_NOT_OPEN` segue só para status fora de 0 e -1.
- 16.2. **Permitir desmarcar livremente qualquer orçamento mesmo fora do aberto (200):** Desmarcação livre permitida.
- 16.3. **Respeitar a precedência estrita do `requireChargeable` priorizando venda e link aprovado sobre o status residual -1:** cascata venda, link aprovado e, por último, o residual cobrável (`200`), desmarcado ao fim.
- 16.4. **Exigir autenticação obrigatória (401) ao tentar alterar status de orçamento:** 401 em `PATCH` de orçamentos.

</dd></dl>

</details>

<details>
<summary><b>Contexto 17: Unificação de Visibilidade de Loja e Escrita de Atendimento (PR #487) — 2 testes</b></summary>

<dl><dd>

- 17.1. **Permitir acesso completo ao detalhe e sub-rotas do atendimento da loja da sessão (200):** Acesso pela loja proprietária retorna 200.
- 17.2. **Exigir autenticação obrigatória (401) ao consultar atendimento e sub-rotas:** 401 em atendimento e sub-rotas.

</dd></dl>

</details>

<details>
<summary><b>Contexto 18: Configuração de Texto do Orçamento por Canal e Campos de Fórmula (Issue backend#620, implementada na #621) — 6 testes</b></summary>

<dl><dd>

- 18.1. **Servir `channel.budget_text_type` e `channel.show_discount` no detalhe do atendimento, respeitando o enum do contrato:** afirma só o shape (`budget_text_type` ∈ {0,1,2}, `show_discount` booleano) — achado real: é configuração viva do canal (tela `[628]` do Desktop), o canal oficial mudou de valor sozinho horas depois da 1ª medição, então o teste nunca afirma o valor vigente de um canal específico.
- 18.2. **Não incluir os 2 campos no `channel` da listagem de atendimentos:** exclusivos do detalhe, confirmado por critério de aceite explícito da issue.
- 18.3. **Cada fórmula da listagem de orçamentos deve servir `quantity`, `pharmaceutical_form` e `label_text`:** validado contra o próprio exemplo de referência da issue (orçamento `#260900369`: `quantity: 30`, `pharmaceutical_form: "CAPSULAS"`).
- 18.4. **Servir `multiple > 1` quando a fórmula tiver multiplicador configurado:** achado fora do escopo original da issue (Desktop imprime o multiplicador no texto enviado).
- 18.5. **Orçamento de revenda (sem fórmula) não deve servir nenhum dos 4 campos novos:** ausentes, não `null` — mesmo padrão já usado por `formula_number`.
- 18.6. **Fórmula com o texto do rótulo em branco não deve servir a chave `label_text`:** trim + ausência, não string vazia.

> 💡 Gap aceito: esta loja só tem 2 canais reais configurados — o fallback (`budget_text_type: 1`/`show_discount: false`) para coluna **nula** não tem reprodução determinística aqui (já validado via MockMvc do lado do backend). Divergências já documentadas e aceitas na própria issue: cabeçalho sintético de envelope/creme diverge do Desktop, e o rótulo sai em maiúsculas (ajuste de apresentação é escopo do front, pharmacie-front#443).

</dd></dl>

</details>

<details>
<summary><b>Contexto 19: Documento do Cliente Travado e Capability can_change_label_name (Issue backend#606/#615) — 4 testes</b></summary>

<dl><dd>

- 19.1. **Recusar trocar, apagar ou mudar o person_type de um documento já preenchido:** cliente temporário com CPF gerado; `422 CLIENT_DOCUMENT_LOCKED` nos 4 casos e documento inalterado.
- 19.2. **Aceitar reenviar o mesmo documento, cru ou mascarado:** `200`, documento inalterado.
- 19.3. **Aceitar o primeiro documento de cliente sem documento e travar o segundo:** `200` e depois `422 CLIENT_DOCUMENT_LOCKED`.
- 19.4. **Expor `can_change_label_name` na loja e no detalhe e fazer o PATCH de `label_name` seguir a capability:** `200` se `true`, `403 PERMISSION_DENIED` se `false` (esta conta só tem `true`).

> 💡 A 341 cobre só `label_name` (Razão Social); CPF/CNPJ trava por regra de dado, sem permissão. Clientes temporários são desativados ao fim de cada teste.

</dd></dl>

</details>

<details>
<summary><b>Contexto 20: Busca sem Distinção de Acento e Caixa nas Rotas do Backend (Issue backend#628/PR #629) — 4 testes</b></summary>

<dl><dd>

- 20.1. **Buscar clientes no typeahead sem distinguir acento nem caixa:** `sao`/`são`/`SÃO` trazem o mesmo conjunto, com `SÃO` e `SAO` juntos; `jose`/`josé`/`JOSÉ` idem em tempo razoável; menos de 3 caracteres devolve vazio.
- 20.2. `[SKIP]` **Buscar na fila sem distinguir acento nem caixa:** o nome gravado com acento (massa dinâmica) é achado digitado sem acento, com acento e em maiúsculas, com o mesmo conjunto de ids; a busca pelo código continua funcionando.
- 20.3. **Buscar nos catálogos com massa acentuada:** prescritor (`conceicao` traz `CONCEIÇÃO` e `CONCEIÇAO`), funcionário (`jose` traz `JOSÉ` e `JOSE`), cidade e operação.
- 20.4. **Achar no catálogo de laboratórios, sem massa acentuada, o registro sem acento digitando com acento:** palavra real da listagem com acento injetado (`laboratório`).

> 💡 Os catálogos filtram por `q`. Gaps aceitos: `/units?q=` responde 500 com termo de 8+ caracteres (achado, fora do teste); `branches`, `sales-sectors`, `medicine-types`, forma farmacêutica, convênio, entregas (403), mensagem padrão e `NICKNAME` de atendimento com cliente vinculado sem massa; produtos dependem da procedure do ERP; índice `CLI_IDX_NOME_PTBR` é teste de integração do backend; typeahead por código/CPF não repetido aqui (coberto em `#9.4`).

</dd></dl>

</details>

<details>
<summary><b>Contexto 21: Typeahead de Clientes: Nome Fantasia, Filtro person_type e Tipo de Pessoa no Item (Issue backend#581/PR #634) — 6 testes</b></summary>

<dl><dd>

- 21.1. **Achar a empresa pelo início do Nome fantasia:** sem distinguir acento nem caixa, o PJ aparece com `person_type: 2` no item e as variações trazem o mesmo conjunto.
- 21.2. **Não achar a empresa por um trecho do meio do Nome fantasia:** a busca é pelo início, de propósito.
- 21.3. **Não achar uma pessoa física pelo nome do rótulo:** PF temporário (desativado ao fim) continua achado pelo nome e pelo código, com `person_type: 1`.
- 21.4. **Filtrar por person_type em todos os ramos:** `1` e `2` trazem exatamente os itens daquele tipo do resultado sem filtro; o PJ do fantasia some com `1`.
- 21.5. **Recusar person_type inválido:** `3`, `0` e `x` respondem `422`; menos de 3 caracteres continua devolvendo vazio, também com o filtro.
- 21.6. **Responder rápido a um termo sem resultado:** sem filtro e com cada tipo, em até 1,5 s — prova de que todos os ramos usam índice.

> 💡 A tela ainda não envia `person_type` (só a API). A busca pelo meio do nome continua fora de escopo.

</dd></dl>

</details>

<details>
<summary><b>Contexto 22: Termo de Busca Maior que a Coluna Pesquisada Devolve Lista Vazia, não 500 (Issue backend#639/PR #647) — 7 testes</b></summary>

<dl><dd>

- 22.1. **Responder lista vazia na busca de unidades com termo maior que a coluna:** `q` de 10, 11, 61 e 500 caracteres → `200` com `items: []` (antes, 11 caracteres davam `500` por *string right truncation*).
- 22.2. **Continuar achando unidades pela sigla com termo curto:** `q=m` acha ao menos 1 unidade e toda sigla contém "m" (controle positivo).
- 22.3. **Responder lista vazia no typeahead de clientes com documento de 21 dígitos e nomes muito longos:** 20 e 21 dígitos, 61 e 500 letras → `200` vazia.
- 22.4. **Responder lista vazia nos catálogos com termo de mais de 60 caracteres:** prescritores, laboratórios, cidades, funcionários, tipos de operação e filiais.
- 22.5. **Responder lista vazia nas buscas de bairros e formas farmacêuticas com termo de mais de 60 caracteres:** rotas aninhadas, com o id da 1ª cidade e do 1º laboratório vindos da própria listagem.
- 22.6. **Responder lista vazia na busca da fila de atendimentos com termo muito longo:** 61/300 letras e 21/40 dígitos no `search`.
- 22.7. **Continuar achando na fila e nos catálogos o registro buscado por um termo comum:** a 1ª palavra do nome de um atendimento acha o próprio atendimento; `cities`, `employees` e `prescribers` acham ao menos 1 registro.

> 💡 Só leitura (GET), nenhuma massa criada. `/standard-messages` ignora `q` e `/deliveries` exige recurso não contratado, ficam sem teste; a busca sem acento já é coberta no contexto 20.

</dd></dl>

</details>

<details>
<summary><b>Contexto 23: Parâmetro Obrigatório Ausente Responde 400, não 500 (Issue backend#640/PR #642) — 3 testes</b></summary>

<dl><dd>

- 23.1. **Recusar com 400 o envio de mídia sem `media_type`:** arquivo presente, `media_type` ausente → `400` "Parâmetro obrigatório ausente: media_type." (antes, `500`).
- 23.2. **Recusar com 400 o envio de mídia sem o arquivo:** `media_type` presente, parte `file` ausente → `400` "Parâmetro obrigatório ausente: file.".
- 23.3. **Manter o 422 do preview de documentos da receita sem `ids`:** a rota já valida no serviço e não vira `400`.

> 💡 A recusa vem antes do serviço: nada é gravado nem enviado ao WhatsApp. Busca de cliente sem `type` e preview de arquivo da IA sem `ids` ficam sem teste até o dev informar as rotas.

</dd></dl>

</details>

<details>
<summary><b>Contexto 24: Loja de Venda sem Rota: can_update_registration_store Sai Sempre false e GET /branches só Aceita purpose=pickup (Issue backend#719/PR #731) — 3 testes</b></summary>

<dl><dd>

- 24.1. **Devolver `can_update_registration_store` sempre `false` nas capabilities da receita, enquanto a loja de retirada segue booleana:** o grant 287 não tem rota que grave a loja de venda, então a capability sai fixa em `false`; `can_update_pickup_store` (grant 294) continua anunciada.
- 24.2. **Recusar com `422 INVALID_CONTEXT` o `GET /branches` com `purpose=registration` e com qualquer valor que não seja `pickup`:** `registration`, `abc`, `PICKUP` e vazio respondem "O parâmetro purpose é obrigatório e deve ser pickup." (antes, `registration` respondia `200` ou `403`).
- 24.3. **Continuar aceitando o `GET /branches` com `purpose=pickup`:** `200` com a lista de filiais para retirada, sem `5xx`.

> 💡 Só API. Pela API não dá para provar que a conta tem o grant 287 (o perfil do usuário não lista grants); o `false` da capability é o contrato do grant sem rota. A escrita da loja de venda fica para uma issue própria.

</dd></dl>

</details>

<details>
<summary><b>Contexto 25: Consulta de CEP pela cep-api: Validação, Resolução de Cidade e Bairro pelo Catálogo e Erros (Issue backend#751/PR #752 e #753) — 8 testes</b></summary>

<dl><dd>

- 25.1. **Deve recusar com 400 o CEP com 7 ou 9 dígitos, com letra, ausente ou vazio, com a mensagem do backend:** `GET /zip-codes` responde `400` "CEP inválido: informe 8 dígitos." nos cinco casos, sem endereço no corpo.
- 25.2. **Deve devolver a mesma resposta com e sem hífen, só com as 5 chaves da issue (sem fonte, cache nem ibge) e os campos nulos aceitos:** `01001-000` e `01001000` dão a mesma resposta, com `zip_code` sem hífen e `street` e `complement` como texto ou nulo.
- 25.3. **Deve resolver a cidade e o bairro do 01001000 para linhas do catálogo, com o nome do catálogo:** `city.id` e `neighborhood.id` existem nas buscas de cidades e de bairros, e o nome da resposta é o do catálogo.
- 25.4. **Deve devolver city.id nulo e o nome da cep-api na cidade repetida (Jandaia/GO) e na cidade fora do catálogo (Sarandi/PR):** sem linha única no catálogo a cidade vem sem `id`, com o nome e a UF da cep-api, e o bairro também não resolve.
- 25.5. **Deve devolver neighborhood nulo no CEP único de uma cidade pequena, com a cidade resolvida e os campos de endereço nulos ou texto:** o CEP de Acreúna/GO vem sem bairro e com a cidade do catálogo.
- 25.6. **Deve responder 404 "CEP não encontrado." para um CEP que não existe:** `00000000` responde `404` com a mensagem.
- 25.7. **Deve recusar com 401 a consulta de CEP sem token:** sem `Authorization` a rota responde `401`, sem endereço.
- 25.8. **Deve responder 404 na rota com o prefixo da loja, porque a consulta de CEP só existe sem /stores/:id:** `GET /stores/:id/zip-codes` responde `404`.

> 💡 Só API, leitura sem gravar. O texto de logradouro, complemento e bairro depende do provedor que respondeu primeiro, então só é tipado. O `503` da cep-api fora do ar não dá para provocar na dev, e a permissão de "qualquer perfil" exige outra conta. A tela de CEP da ficha do cliente é testada no `7.clientes`.

</dd></dl>

</details>

<details>
<summary><b>Contexto 26: Revenda: Edição do Cabeçalho (PATCH /resales/:id), Campos Editáveis, Valor Igual sem Gravar e Recusas 422, 404 e 401 (Issue backend#782/PR #771) — 9 testes</b></summary>

<dl><dd>

- 26.1. **Deve trocar o prescritor da revenda aberta com 200, persistir e gravar o usuário da sessão em updated_by:** o detalhe mostra o prescritor novo e `updated_by` igual ao usuário logado.
- 26.2. **Deve trocar a loja de retirada e desmarcar o pagamento de comissão ao funcionário no mesmo PATCH, e persistir os dois:** resposta e detalhe trazem os dois valores novos.
- 26.3. **Deve trocar o funcionário comissionado pelo da sessão e persistir:** resposta e detalhe trazem o comissionado novo.
- 26.4. **Não deve gravar quando o valor enviado é o que já está na revenda: 200 com updated_at e todos os campos iguais:** repetir o mesmo prescritor responde `200` e deixa o detalhe inteiro idêntico.
- 26.5. **Deve recusar com 422 o PATCH sem nenhum campo, sem alterar a revenda:** a mensagem pede ao menos um campo válido.
- 26.6. **Deve recusar com 422 a troca do paciente, sem alterar a revenda:** o paciente da revenda não muda.
- 26.7. **Deve recusar com 422 o campo que a rota não aceita (preço e campo desconhecido), sem alterar a revenda:** quem mandar `sale_value` não acha que mudou o preço.
- 26.8. **Deve recusar com 422 limpar o comprador ou o prescritor, sem alterar a revenda:** os dois são obrigatórios.
- 26.9. **Deve responder 404 para revenda inexistente e para o caminho antigo com /stores/:id, e 401 sem token, sem gravar nada:** as três recusas deixam a revenda idêntica.

> 💡 Só API, na revenda de teste que o próprio context cria: a revenda não tem exclusão, então cada rodada deixa uma revenda aberta no tenant. Ficam fora a escada de permissões (concluída, finalizada, outra loja, tipo de operação, setor, comissionado e loja de retirada), porque a conta de teste é uma só, e o vínculo com atendimento.

</dd></dl>

</details>

<details>
<summary><b>Contexto 27: Revenda: Leitura do Detalhe e das Capabilities, Criação (POST /resales) e Recusas 422, 404 e 401 (Issue backend#780/PR #768 e backend#781/PR #771) — 10 testes</b></summary>

<dl><dd>

- 27.1. **Deve devolver as onze capabilities da revenda como booleanos, sem 403, pelo caminho sem /stores/:id:** a rota responde `200` com as onze chaves e todas booleanas.
- 27.2. **Deve devolver o detalhe da revenda aberta da loja 1 com cabeçalho, o produto com lote e as quatro capabilities:** cliente, prescritor, atendimento, produto com lote, quantidade, valores e custo. O custo só aparece com o grant 401 (`can_view_cost`).
- 27.3. **Deve devolver a revenda concluída sem financeiro com status -1 e sem financial_id:** a concluída traz os produtos e nenhum financeiro. Com a 232 e a 302, a concluída pode ser alterada (`can_update`).
- 27.4. **Deve sair false nas três chaves de produto da revenda com financeiro, mesmo com todos os grants da conta:** incluir, alterar e excluir produto saem `false`.
- 27.5. **Deve responder 404 "Revenda não encontrada." para o código de uma receita e para um código inexistente:** a rota de revenda não devolve receita.
- 27.6. **Deve responder 404 nas três rotas pelo caminho antigo com /stores/:id:** detalhe, capabilities e criação só existem sem o prefixo da loja.
- 27.7. **Deve responder 401 sem token no detalhe, nas capabilities e na criação:** as três rotas exigem o token.
- 27.8. **Deve criar a revenda aberta com os valores padrão (comprador igual ao paciente, loja de retirada da sessão, comissão ligada, totais zerados) e devolver o mesmo no detalhe:** a revenda nasce como orçamento aberto, com o número do DAV, sem produtos e com o mesmo corpo no `GET`.
- 27.9. **Deve recusar com 422 o POST sem paciente e sem prescritor, cada um com a sua mensagem:** os dois são obrigatórios.
- 27.10. **Deve recusar com 422 o POST com paciente inexistente:** o cadastro informado precisa existir.

> 💡 Só API. As revendas lidas são registros reais da dev, listados numa fixture única. A revenda não tem exclusão, então cada rodada deixa uma revenda aberta no tenant. Ficam fora a escada de permissões do `can_update` (concluída, finalizada, outra loja), o custo oculto sem a permissão de custo e a recusa sem a permissão de gravar, porque a conta de teste é uma só, e o vínculo com atendimento.

</dd></dl>

</details>

<details>
<summary><b>Contexto 28: Revenda: Inclusão de Produto (POST /resales/:id/products), Lote, Preço pela Tabela, Totais do Cabeçalho e Recusas 422, 404 e 401 (Issue backend#783/PR #773) — 8 testes</b></summary>

<dl><dd>

- 28.1. **Deve incluir produto com lote na revenda aberta, com o lote, o preço da tabela e o total do cabeçalho somado, e devolver o detalhe inteiro com 201:** a linha nova traz o lote escolhido, o preço unitário da tabela vezes a quantidade, e o total do cabeçalho cresce pelo valor da linha.
- 28.2. **Deve incluir produto sem lote na revenda aberta, com lote nulo, numeração da linha crescente e o total do cabeçalho somado:** sem lote a linha vem com `lot` nulo e `line_number` maior que o das anteriores.
- 28.3. **Deve recusar com 422 o produto que não é de revenda (insumo de manipulação e código inexistente), sem gravar nada:** só entra produto da busca de revenda da loja.
- 28.4. **Deve recusar com 422 o lote de outro produto e o saldo menor que a quantidade, sem gravar nada:** o lote é do produto e precisa cobrir a quantidade.
- 28.5. **Deve recusar com 422 a quantidade zero, fracionária com lote e acima de 99999, sem gravar nada:** quantidade acima de zero, inteira com lote, até 99999.
- 28.6. **Deve recusar com 422 o preço enviado pelo cliente, o campo desconhecido e o produto ausente, cada um com a sua mensagem e sem gravar nada:** o preço nunca vem do cliente e só os quatro campos da rota são aceitos.
- 28.7. **Deve recusar com 422 a inclusão na revenda concluída sem lote, porque ela baixa estoque, sem gravar nada:** na concluída o lote é obrigatório.
- 28.8. **Deve responder 404 para revenda inexistente, código de receita e o caminho antigo com /stores/:id, e 401 sem token, sem gravar nada:** a revenda fica idêntica depois das recusas.

> 💡 Só API, numa revenda de teste que o próprio context cria: a revenda não tem exclusão, então cada rodada deixa uma revenda aberta com 2 produtos no tenant. Ficam fora o sucesso na revenda concluída (baixa o estoque do lote de verdade, sem como devolver), a recusa por financeiro registrado (grava em revenda de terceiros se regredir) e as recusas por falta de permissão, porque a conta de teste é uma só.

</dd></dl>

</details>

<details>
<summary><b>Contexto 29: Revenda: Alteração e Exclusão de Produto (PATCH e DELETE /resales/:id/products/:linha), Quantidade, Lote, Unidade, Estoque na Concluída e Recusas 409, 422, 404 e 401 (Issue backend#784/PR #775) — 12 testes</b></summary>

<dl><dd>

- 29.1. **Deve alterar a quantidade da linha de 3 para 1 no orçamento aberto, recalculando a linha pelo valor unitário dela e o total do cabeçalho, e devolver o detalhe inteiro com 200:** o valor unitário da linha se mantém, o bruto é o unitário vezes a quantidade nova e o total do cabeçalho cai as unidades tiradas.
- 29.2. **Deve responder 200 sem gravar nada quando o PATCH traz a quantidade e a unidade que a linha já tem:** só conta o que muda; nem a data de alteração muda.
- 29.3. **Deve trocar o lote da linha do orçamento aberto (26705, 29392 e nenhum) sem mexer no preço, no total nem no saldo do lote:** o orçamento aberto não baixa estoque.
- 29.4. **Deve trocar só a unidade da linha sem mexer no preço nem nos totais:** a unidade vem do cadastro de unidades.
- 29.5. **Deve recusar com 422 o PATCH com sale_value, porque o preço nunca vem do cliente, sem gravar nada:** só `quantity`, `unit` e `lot_id` são aceitos.
- 29.6. **Deve recusar com 422 o PATCH sem nenhum campo válido, com quantidade zero e com unidade fora do cadastro, sem gravar nada:** cada recusa tem a sua mensagem e deixa a revenda idêntica.
- 29.7. **Deve responder 404 para a linha de outra revenda, sem tocar nela, e para a linha excluída, que não é reaberta:** a linha é da revenda ou não existe.
- 29.8. **Deve excluir a linha do orçamento aberto com 204, tirando o produto do detalhe e do total, e responder 204 de novo sem gravar nada:** a exclusão é lógica e repetir não grava.
- 29.9. **Deve alterar a quantidade na revenda concluída baixando o saldo do lote e devolver o saldo todo ao excluir a linha:** o saldo do lote é conferido na busca de produtos de revenda antes e depois de cada passo.
- 29.10. **Deve recusar com 422 tirar o lote da linha da revenda concluída e trocar unidade e lote no mesmo pedido, sem gravar nem mexer no saldo:** a revenda concluída baixa estoque, então a linha precisa terminar com lote e unidade e lote mudam em pedidos separados.
- 29.11. **Deve responder 409 RESALE_HAS_FINANCIAL no PATCH e no DELETE de produto da revenda com financeiro, sem gravar nada:** com financeiro registrado os produtos não mudam.
- 29.12. **Deve responder 404 para revenda inexistente, código de receita e o caminho antigo com /stores/:id, e 401 sem token, sem gravar nada:** a revenda de teste fica idêntica depois das recusas.

> 💡 Só API. A revenda de teste é criada pelo próprio context (a revenda não tem exclusão, então cada rodada deixa uma revenda aberta no tenant); na revenda concluída a linha entra e sai no mesmo teste e uma limpeza ao fim de cada teste exclui o que sobrar, devolvendo o saldo. O cadastro de unidades da dev não tem `cx`, então o teste usa `UN`. Ficam fora a recusa por falta da permissão de alterar, porque a conta de teste é uma só, e a linha em promoção na revenda concluída, porque a loja de teste não tem promoção.

</dd></dl>

</details>

<details>
<summary><b>Contexto 30: Revenda: Busca de Produtos (GET /products?context=resale), Lotes com Saldo, Ordem por Vencimento, Formato do Item, Validação do Parâmetro, Modo de Busca e Acento (Issue backend#785/PR #776) — 8 testes</b></summary>

<dl><dd>

- 30.1. **Deve devolver o produto da busca de revenda com os lotes por vencimento, o saldo e a promoção de cada lote, o custo e o máximo de desconto:** cada lote traz número, vencimento, saldo e promoção, e o que vence antes vem antes.
- 30.2. **Deve devolver só produtos de revenda com lots sempre como lista ordenada, o promotion do item presente e no máximo 500 produtos, para o termo vazio:** um item por produto, sem repetir.
- 30.3. **Deve devolver o produto com um só lote com o lote e o saldo da busca de revenda:** o lote e o saldo vêm no item.
- 30.4. **Deve devolver o produto sem lote com lots vazio e o promotion do item presente:** sem saldo em lote a lista vem vazia, nunca nula.
- 30.5. **Deve manter a busca da receita igual sem context e com context=recipe, com lots, promotion e max_discount_percentage nulos e o mesmo formato de item da revenda:** a busca da receita não muda.
- 30.6. **Deve recusar com 422 o context inválido e manter o usage opcional e ignorado na revenda e obrigatório na receita:** só `recipe` e `resale` são aceitos.
- 30.7. **Deve buscar pelo começo do nome em starting e por qualquer parte em containing, e distinguir o acento na revenda como o Desktop, ao contrário da busca da receita:** a busca de revenda distingue o acento e a da receita não.
- 30.8. **Deve responder 401 à busca de revenda sem token:** a rota exige autenticação.

> 💡 Só leitura, sem gravar nada na API real. O saldo dos lotes não é conferido, porque muda com as inclusões e alterações de produto da revenda. Ficam fora o lote com promoção ativa, porque a loja de teste não tem promoção, o custo nulo sem a permissão de ver custo, porque a conta de teste é uma só, e a comparação com a busca do Desktop.

</dd></dl>

</details>

<details>
<summary><b>Contexto 31: Automações: CRUD, Duplicar e Capabilities, Árvore de Passos, Edição Concorrente, Escopo por Canal e Recusas (Issue backend#738) — 13 testes</b></summary>

<dl><dd>

- 31.1. **Deve devolver as quatro capabilities de automação como booleanos, sem 403, e a conta de teste ter a 635 com gravar, alterar e excluir:** `can_list`, `can_create`, `can_edit` e `can_delete`.
- 31.2. **Deve responder 401 sem token e 404 ao caminho antigo com /stores/:id, na listagem e nas capabilities:** a loja vem do token.
- 31.3. **Deve criar a automação com os valores padrão, ler o detalhe com a mesma árvore e listá-la sem os passos:** nasce pausada, para todos os canais, com `updated_at` em UTC; a listagem traz só o resumo.
- 31.4. **Deve renomear com o updated_at lido, devolver o updated_at novo e aceitar o save seguinte com ele, sem 409:** dois saves seguidos na mesma tela não se bloqueiam.
- 31.5. **Deve ativar e pausar só com is_active, sem updated_at, e o switch invalidar o updated_at lido antes dele (409):** quem edita depois de uma pausa pela listagem recarrega.
- 31.6. **Deve duplicar a automação pausada, com o sufixo "(cópia)", contadores zerados e a mesma árvore:** a original não muda.
- 31.7. **Deve apagar com 204 e a automação passar a responder 404 no detalhe, no segundo DELETE e na listagem:** a exclusão é lógica.
- 31.8. **Deve gravar e devolver a árvore com condição e passos dentro dos ramos, na mesma ordem, e avisar service_window_risk nos passos depois da espera:** só a condição tem ramos.
- 31.9. **Deve substituir a árvore inteira no PATCH com steps e, se um passo for recusado, responder 422 sem gravar nada:** a árvore anterior continua inteira.
- 31.10. **Deve recusar o PATCH sem updated_at (422 updated_at_required), com updated_at antigo (409 AUTOMATION_CHANGED), com campo que a rota não aceita e com corpo vazio:** nenhuma recusa grava.
- 31.11. **Deve recusar o POST sem nome (400) e com ramo em passo que não é condição (422), e responder 422 ao id 0 e 404 ao id inexistente:** sem expor detalhe interno do banco.
- 31.12. **Deve gravar o escopo por canal: lista de canais vale "estes canais", repetido cai e all_channels true zera a lista:** o canal é descoberto na hora, sem id fixo.
- 31.13. **Deve recusar o escopo por canal com all_channels false e nenhum canal (422 channels_required):** o escopo restrito exige pelo menos um canal.
- 31.14. **Deve servir o histórico de execuções do mais recente para o mais antigo, 20 por página por padrão, fatiando page e per_page sem repetir nem pular e com has_next coerente até depois do fim (Issue backend#743):** a paginação do histórico não repete nem perde execução.
- 31.15. **Deve recusar com 422 a paginação inválida do histórico (per_page 0 e 101, page 0, negativa e texto e o deslocamento que estoura o inteiro) e aceitar per_page 100 (Issue backend#743):** parâmetro inválido é recusado sem erro interno.
- 31.16. **Deve listar o histórico da automação pausada e responder 404 ao da excluída, ao da inexistente e ao caminho antigo com /stores/:id (Issue backend#743):** a pausa não esconde o histórico; a exclusão sim.

> 💡 Toda a massa é criada e apagada pelo próprio teste, sempre pausada e com palavra-chave única. Como a exclusão é lógica, as linhas apagadas continuam no banco. Ficam fora a escada de permissão (a conta de teste é uma só e tem todas as caixas), o `PATCH` transacional com falha no meio do insert, a criação por modelo da galeria e o passo de espera pendente cancelado ao salvar.

</dd></dl>

</details>

<details>
<summary><b>Contexto 32: Automações: Validação no Save e na Ativação, Recusas 422 por Regra, Contraprova Pausada, PATCH que Julga o Resultado e Avisos da Janela de 24h (Issue backend#739) — 21 testes</b></summary>

<dl><dd>

- 32.1. **Deve aceitar o texto com o emoji codificado em {{e:HEX}} (que não é placeholder), ativar, renomear a automação ativa e completa e pausar sem aviso:** o emoji chega codificado e não conta como variável.
- 32.2. **Deve criar ativa a automação com send_template de template aprovado e o template_text com placeholder do gatilho, sem aviso:** template pode sair fora da janela de 24h.
- 32.3. **Deve recusar na gravação, mesmo pausada, o gatilho desconhecido, o passo incompatível com o gatilho e o placeholder que o gatilho não fornece, sem gravar:** o servidor é a barreira, o front não.
- 32.4. **Deve recusar o quarto nível de condição aninhada (nesting_too_deep, no passo do 4º nível) e aceitar o terceiro:** o teto é de 3 níveis.
- 32.5. **Deve recusar a janela de horário inválida (time_window_invalid) no valor, nos dias e no fuso, apontando o campo:** cada recusa aponta o campo certo.
- 32.6. **Deve recusar o id inválido do atendente (invalid_id), o rodízio sem grupo (group_required) e o passo que não existe na v1 (step_unavailable):** nada é gravado.
- 32.7. **Deve recusar o nome de 126 caracteres, a descrição de 501 e o config acima de 7000 caracteres, e aceitar o nome de 125 e a descrição de 500:** os tetos vêm das colunas do banco.
- 32.8. **Deve recusar o emoji cru no nome (unsupported_characters), porque o banco é WIN1252 e o emoji chega codificado em {{e:HEX}}:** só o texto codificado é aceito.
- 32.9. **Deve recusar o canal inexistente (channel_invalid) e devolver os issues na ordem estrutura, depois canal:** o front mostra o primeiro problema.
- 32.10. **Deve recusar ativar com o texto vazio (text_required) e sem passos (steps_required), e salvar o mesmo texto vazio como rascunho pausado:** o rascunho pausado pode estar incompleto.
- 32.11. **Deve recusar ativar com template, grupo, atendente ou substatus inexistente, e salvar o template inexistente como rascunho pausado:** a referência só é conferida na ativação.
- 32.12. **Deve recusar ativar com a variável principal do template mal preenchida (template_text_required): sem o texto quando o template tem variável principal e com o texto quando não tem:** a regra vale nos dois sentidos.
- 32.13. **Deve aceitar ativa a troca de substatus que limpa (custom_status_id null) e a que aponta para um substatus existente:** `null` limpa o substatus.
- 32.14. **Deve julgar o que está gravado ao ativar pelo switch (text_required), nunca recusar a pausa e não julgar a cópia pela completude:** o switch da listagem não manda os passos.
- 32.15. **Deve recusar o save que deixaria a automação ativa quebrada (text_required) e manter a gravada ativa e inteira:** a recusa não grava nada.
- 32.16. **Deve julgar o resultado do PATCH e não só o corpo: trocar o gatilho para um incompatível com o passo gravado é recusado (step_not_allowed_for_trigger):** o passo gravado conta.
- 32.17. **Deve avisar service_window_risk (sem bloquear) no passo depois de uma espera e sob gatilho que não é de mensagem, e não avisar no send_template:** o aviso não bloqueia o save.
- 32.18. **Deve aceitar ativa a espera de até 30 dias (43200 minutos), recusar ativa a de 43201 minutos, a de 31 dias e a de zero (wait_amount_invalid) e salvar a acima do teto só como rascunho pausado (Issue backend#742):** o teto da espera é checado na ativação.
- 32.19. **Deve aceitar ativo o limite de resposta por cliente de 0 a 168 horas, nulo ou ausente, recusar ativo o negativo, o 169, o fracionário e o texto (reply_cooldown_invalid), salvar o inválido só como rascunho pausado e ignorá-lo no gatilho Agendado (Issue backend#744):** o limite é checado na ativação.
- 32.20. **Deve aceitar o gatilho Agendado (time_based) com horário HH:mm, recusar o horário, os dias e o fuso inválidos mesmo no rascunho (schedule_invalid), exigir o horário só na ativação (schedule_required) e limitar os passos aos que não dependem de atendimento (Issue backend#746):** o formato do agendamento é checado em qualquer save.
- 32.21. **Deve aceitar a janela de horário que passa da meia-noite, o fim 24:00 e os sete dias, e recusar a lista de dias vazia, os dias repetidos e o início 24:00 (time_window_invalid) (Issue backend#735, A6):** a janela que vira a noite é válida.

> 💡 Toda a massa é criada e apagada pelo próprio teste, sempre pausada ou com palavra-chave única, e template, substatus e canal são descobertos na hora. Como a exclusão é lógica, as linhas apagadas continuam no banco. Ficam fora a conta WABA do canal, o atendente do grupo, cooldown e webhook, o número em notação exponencial e a tradução dos códigos novos pelo front.

</dd></dl>

</details>

<details>
<summary><b>Contexto 33: Automações Padrão: is_default na Lista e no Detalhe, Estrutura que Passa no Save, Duplicar em Cópia Comum, Ativar só com o Dado da Loja e Editar sem Perder a Marca (Issue backend#747) — 4 testes</b></summary>

<dl><dd>

- 33.1. **Deve marcar is_default em todo item da lista, igual no detalhe, e a árvore de cada padrão passar na validação do save quando recriada como rascunho comum:** toda padrão gravada no banco é uma automação válida.
- 33.2. **Deve duplicar a automação padrão numa cópia comum e pausada, que pode ser excluída:** a cópia não herda a marca de padrão.
- 33.3. **Deve recusar ativar a padrão que depende de dado da loja (grupo e substatus, ou template WABA) apontando só esses campos, sem ativá-la:** o que é da loja não é adivinhado.
- 33.4. **Deve editar a automação padrão sem perder a marca is_default e devolver o nome original:** a padrão editada continua padrão.

> 💡 As padrão vêm do banco de cada farmácia e são compartilhadas: os testes as descobrem pelo `is_default`, provam a estrutura recriando cada árvore como rascunho próprio e só tocam numa padrão para tentar ativá-la (esperando a recusa) ou trocar o nome por alguns segundos. Excluir uma padrão fica fora do teste: uma regressão a apagaria de vez.

</dd></dl>

</details>
</dd></dl>

</details>
<br>

<details>
<summary><b>0-B — Atendimentos (<code>0-B.backend-atendimentos.cy.js</code>) — 106 testes em 22 contextos</b></summary>


<dl><dd>

<br>

<details>
<summary><b>Contexto 1: Gestão de Filas de Atendimento — 8 testes</b></summary>

<dl><dd>

- 1.1. **Listar a fila geral de atendimentos com paginação (`/attendances`):** `GET /attendances` com paginação; valida array e metadata.
- 1.2. **Filtrar atendimentos com status em andamento (`in_progress`):** Filtro `status=1`; valida todos os itens retornados com status correto.
- 1.3. **Filtrar atendimentos com status pendente (`pending`):** Filtro `status=0`; valida coerência do filtro.
- 1.4. **Filtrar atendimentos com status aguardando cliente (`waiting`):** Filtro de status `waiting`; valida retorno filtrado.
- 1.5. **Consultar as capabilities específicas do atendimento com `can_change_attendant_status` (`/attendances/:id/capabilities` - PR #442):** `GET /attendances/:id/capabilities`; valida presença de `can_change_attendant_status`.
- 1.6. **Atualizar observações e validar transição no atendimento com sucesso (`PATCH /attendances/:id`):** `PATCH` de observações; valida status 200 e persistência.
- 1.7. **Exigir autenticação obrigatória (401) na consulta de capabilities e mutação de atendimento:** Proteção 401 em capabilities e `PATCH`.
- 1.8. **Listar mensagens do atendimento projetando `attachment` com `filename` e `mime_type` por extensão (`/attendances/:id/messages` - PR #457):** `GET /messages`; valida projeção de `filename` e `mime_type` inferido.

</dd></dl>

</details>

<details>
<summary><b>Contexto 2: Gestão e Disponibilidade de Atendentes (PR #279 e PR #442) — 8 testes</b></summary>

<dl><dd>

- 2.1. **Consultar o status atual de disponibilidade do atendente com dispensa de permissão 554 para o próprio usuário (`GET /attendants/:id/status` - PR #442):** `GET` status do atendente; valida dispensa de grant para `self`.
- 2.2. **Alterar o status de disponibilidade do atendente com permissão 554 com sucesso e idempotência (`PATCH /attendants/:id` - PR #442):** `PATCH` status; valida idempotência e persistência; `updated_group_relations` é número.
- 2.3. **Exigir autenticação obrigatória (401) na consulta e alteração de status do atendente:** Proteção 401 em `GET` e `PATCH` de status.
- 2.4. **Rejeitar alteração de status com valor fora do enum (422):** Validação de enum; valor inválido retorna 422.
- 2.5. **Retornar 404 ao tentar atualizar status de atendente inexistente:** Atendente com ID inválido retorna 404.
- 2.6. **Recusar status de atendente sem grupo de canal com `code` próprio (GET, Issue #575):** 422 `ATTENDANT_WITHOUT_CHANNEL_GROUP`, mesma mensagem de antes.
- 2.7. **Mesma recusa no PATCH, sem alterar nada (Issue #575):** mesmo `code`; o atendente segue recusado depois.
- 2.8. **Demais 422 do endpoint sem o `code` de grupo (Issue #575):** enum inválido, status nulo e corpo vazio não herdam o `code`.

</dd></dl>

</details>

<details>
<summary><b>Contexto 3: Identificador de Cliente no Atendimento e Integração com a Ficha (PR #429) — 4 testes</b></summary>

<dl><dd>

- 3.1. **Projetar a chave `customer_id` dentro do objeto `customer` no detalhe do atendimento (PR #429):** Projeção de `customer_id` no detalhe.
- 3.2. **Resolver `customer_id` numérico para atendimentos vinculados a clientes cadastrados (LEFT JOIN em CLIENTE):** `customer_id` resolvido para clientes existentes.
- 3.3. **Retornar `customer_id` `null` de forma defensiva para atendimentos sem cliente na base (~53% da base):** `customer_id` `null` para atendimentos sem vínculo.
- 3.4. **Permitir navegação direta e íntegra do atendimento para a ficha completa via `customer_id` (PR #429 + PR #419):** Deep-link de atendimento para ficha do cliente.

</dd></dl>

</details>

<details>
<summary><b>Contexto 4: Escada de Transição de Status de Atendimento e RBAC (PR #442 e PR #486) — 5 testes</b></summary>

<dl><dd>

- 4.1. **Permitir des-concluir atendimento (2 → 1) sem exigência de grant de status (PR #442 e PR #486):** Transição 2→1 livre de grant.
- 4.2. **Exigir e aplicar grant 562 ao des-descartar atendimento (4 → 1) com sucesso (PR #486):** Transição 4→1 com grant 562.
- 4.3. **Exigir e aplicar grant 562 ao retirar status de finalizado (3 → 1) (PR #442 e PR #486):** Transição 3→1 com grant 562.
- 4.4. **Garantir idempotência ao reenviar o mesmo status atual do atendimento:** Idempotência de status; sem erro ao reenviar.
- 4.5. **Rejeitar transição com status fora do enum permitido (422):** 422 para status inválido no enum.

</dd></dl>

</details>

<details>
<summary><b>Contexto 5: Feed de Eventos e Sinal Endereçado de Leitura (PR #490) — 6 testes</b></summary>

<dl><dd>

- 5.1. **Validar a estrutura canônica e o cursor do feed de eventos (`/attendance-events`):** `GET /attendance-events`; valida cursor e estrutura.
- 5.2. **Projetar o evento `attendance.unread_changed` com `attendance_id` obrigatório e sinal puro sem contador:** Evento `unread_changed` com ID endereçado, achado na varredura completa do feed (do cursor 0 ao fim); sem nenhum no feed o teste pula com motivo.
- 5.3. **Validar a coexistência do sinal endereçado `unread_changed` com o evento cego legado `attendance.changed`:** Coexistência de eventos novos e legados sobre o histórico inteiro do feed; pula com motivo sem `unread_changed`.
- 5.4. **Garantir avanço consistente e idempotência do cursor ao paginar por `after`:** Paginação por cursor idempotente a partir do evento achado; pula com motivo sem `unread_changed`.
- 5.5. **Exigir autenticação obrigatória (401) ao consultar o feed de eventos:** 401 sem token no feed.
- 5.6. **Emitir o evento `attendant.status_changed` com `attendance_id` nulo e `attendant_id` obrigatório ao alterar status operacional do atendente:** Evento `status_changed` com `attendant_id`.

</dd></dl>

</details>

<details>
<summary><b>Contexto 6: Derivação Dinâmica de Mensagens Não Lidas e Remoção de Filtro Excludente (PR #495) — 4 testes</b></summary>

<dl><dd>

- 6.1. **Projetar `messages.unread_count` como inteiro &gt;= 0 em todos os itens da fila de atendimentos:** `unread_count` projetado na listagem.
- 6.2. **Garantir coerência estrita entre o `unread_count` da listagem e a recontagem da rota de baixa (`POST /read`):** Consistência `unread_count` vs `POST /read`.
- 6.3. **Manter atendimentos visíveis e contabilizados no sumário independentemente de `MSG_QTDE` no banco:** Visibilidade sem filtro excludente.
- 6.4. **Exigir autenticação obrigatória (401) ao consultar listagem de atendimentos sem token:** 401 na listagem sem token.

</dd></dl>

</details>

<details>
<summary><b>Contexto 7: Exposição de `content_type` na Prévia da Última Mensagem da Fila (PR #497) — 4 testes</b></summary>

<dl><dd>

- 7.1. **Projetar o campo `content_type` dentro do envelope `last_message` em todos os cards da fila que possuem última mensagem:** `content_type` projetado em `last_message`.
- 7.2. **Rotular com precisão mídias de áudio enviadas pelo atendente (`type = 0`) com body vazio como `content_type: audio` (PR #497 / Issue #383):** Áudio sem body rotulado como `audio`.
- 7.3. **Garantir paridade de `content_type` entre a prévia da fila e a rota de mensagens (`/attendances/:id/messages`):** Paridade fila vs detalhe.
- 7.4. **Exigir autenticação obrigatória (401) ao consultar listagem de atendimentos sem token:** 401 na listagem.

</dd></dl>

</details>

<details>
<summary><b>Contexto 8: Projeção de Citação e Resposta a Mensagem no Chat (PR #500) — 4 testes</b></summary>

<dl><dd>

- 8.1. **Projetar o campo `replied_message` em todas as mensagens da conversa (objeto estruturado ou `null`):** Projeção `replied_message` em todas as msgs.
- 8.2. **Mapear com precisão os metadados da mensagem citada ao responder sticker recebido do cliente (PR #500):** Citação de sticker com `content_type` e `origin`.
- 8.3. **Projetar `replied_message` com preview de texto ao responder mensagem de atendente:** Preview truncado em citação de texto.
- 8.4. **Exigir autenticação obrigatória (401) ao consultar mensagens do atendimento sem token:** 401 em mensagens.

</dd></dl>

</details>

<details>
<summary><b>Contexto 9: Enriquecimento de Templates WABA com `rendered_body` e Interpolação de Variáveis (PR #483 e #484) — 4 testes</b></summary>

<dl><dd>

- 9.1. **Retornar `rendered_body` com saudação e atendente interpolados na listagem global de templates (`/waba-message-templates`):** `rendered_body` com variáveis globais.
- 9.2. **Interpolar o nome do cliente no `rendered_body` quando fornecido `customer_id` opcional na listagem (`/waba-message-templates`):** Interpolação de `customer_id` no `rendered_body`.
- 9.3. **Retornar `rendered_body` contextualizado no atendimento (`/attendances/:id/message-templates`):** `rendered_body` contextual ao atendimento.
- 9.4. **Exigir autenticação (401) ao consultar templates WABA sem token JWT:** 401 em templates WABA.

</dd></dl>

</details>

<details>
<summary><b>Contexto 10: Integridade de Auditoria no Insert de Substatus Personalizados (PR #526) — 5 testes</b></summary>

<dl><dd>

- 10.1. **Consultar o catálogo de substatus personalizados retornando array (`GET /attendance-custom-statuses`):** Baseline do catálogo antes da criação.
- 10.2. **Registrar um novo substatus personalizado sem o 500 de integridade de `ALTERACAO_CF` (`POST /attendance-custom-statuses` - PR #526):** Regressão principal: `POST` não retorna mais 500 (`DataIntegrityViolationException`); o item persiste de fato e aparece no catálogo.
- 10.3. **Rejeitar `parent_status` fora do enum permitido preservando a validação após a correção (422):** Validação de enum do service preservada após o fix.
- 10.4. **Atualizar a ordem de um substatus existente com sucesso, sem regressão no PATCH (`PATCH /attendance-custom-statuses/:id`):** Contra-prova de que o `PATCH` (já funcional antes da PR) não regrediu.
- 10.5. **Exigir autenticação obrigatória (401) ao consultar e registrar substatus personalizados:** 401 em `GET` e `POST`.

</dd></dl>

</details>

<details>
<summary><b>Contexto 11: Telefone Cru da Conversa no Card da Fila (Issue #569, PR #560) — 1 teste</b></summary>

<dl><dd>

- 11.1. **Retornar customer_phone (listagem) e customer.phone (detalhe) sempre como o número cru da conversa, com código do país ou o identificador @lid do WhatsApp:** bug original — o card mostrava um telefone antigo do cadastro (`TELEFONE1`/`2`, ex.: `6234813108`, 10 dígitos sem código do país) em vez do número real da conversa (`ID_USUARIO`); regex `/^(55\d{10,11}|\d+@lid)$/` medida em amostra real de itens da fila, aceitando também o identificador `@lid` do WhatsApp (contas que escondem o número real atrás de um Linked ID). O valor chega cru (sem máscara); a formatação de exibição, se houver, é responsabilidade do frontend.

> 💡 Homologado pelo operador.

</dd></dl>

</details>

<details>
<summary><b>Contexto 12: Consistência entre Capability e Ação Real — Assumir Atendimento (Issue backend#570/#599) — 2 testes</b></summary>

<dl><dd>

- 12.1. **Confirmar que `can_take_attendance` é consistente com o resultado real do `PATCH` de assumir, num atendimento Pendente sem atendente:** arquitetura nova — lê a capability booleana já calculada pelo servidor para a conta de teste real corrente e confere que a ação subsequente é consistente com ela, autoadaptável a qualquer grant que a conta tenha (sem precisar de contas de teste por combinação da matriz). Só exercita a chamada real quando a capability é `false` (rejeição não muda estado); quando é `true`, só loga o achado sem mutar o atendimento (massa escassa, Pendente-sem-atendente).
- 12.2. **Rejeitar com `409 ATTENDANCE_NOT_PENDING` a tentativa de assumir um atendimento que não está Pendente, independente do grant do funcionário:** medido contra um Finalizado real sem atendente (massa abundante).

> 💡 Helper reaproveitável `validarConsistenciaCapabilityXAcao()` — mesmo padrão serve para qualquer par capability×ação futuro sem precisar de múltiplas contas de teste.

</dd></dl>

</details>

<details>
<summary><b>Contexto 13: Orçamento Gerado Automaticamente pela I.A. a partir de Receita Enviada por Anexo (exploração do operador, 2026-10-07, sem issue) — 5 testes</b></summary>

<dl><dd>

- 13.1. **Servir o arquivo de IA com `ia_status` concluído e o schema mínimo:** massa real permanente (atendimento `261000039`, arquivo `1423`) — `file_type`, `message_id`, `message_at`, `ia_status: 1`.
- 13.2. **A mensagem de notificação da I.A. deve referenciar o orçamento gerado, que precisa existir de fato na listagem:** extrai o código via regex do texto final (`"Receita nº: {código} processada pela I.A.!"`) e confirma contra `GET .../budgets` — correlação real, sem depender de proximidade temporal.
- 13.3. **Deve haver só 1 mensagem para o arquivo de IA, nunca uma 2ª de conclusão:** trava a descoberta-chave desta investigação — a mensagem de "processando" é **editada in-place** (mesmo id) quando a IA termina, nunca chega uma mensagem nova.
- 13.4. **`ia_status` tem um 3º valor real (`-1`, falha), nunca documentado antes:** massa real permanente (atendimento `260700034`, arquivo `257`, mensagem `4851916`) — reescrita pra "Receita não orçada! Não foi encontrado produtos disponíveis para orçamento." Homologado pelo operador ("validado") e `.only` removido em 2026-10-08.
- 13.5. **Issue backend#603/#604 — o anexo original de arquivos de IA antigos (migrado de URL para key no S3) continua servindo o binário correto:** massa real permanente (atendimento `260700034`, 5 anexos de 03-06/07/2026, pré-migração) — todos resolvem `200`/`image/*` pela rota sob demanda mesmo após a migração. Homologado pelo operador ("validado") e `.only` removido em 2026-10-08.

> 💡 Origem: escuta ao vivo (~6 min) contra a API real, enviando de verdade uma receita pelo WhatsApp do atendimento `261000039` e observando a resposta da IA (~111s até o orçamento sair, bem abaixo do teto de 10 min relatado). Avaliação de automação: o gatilho (receita chegando por WhatsApp) não é automatizável sem envio manual — mantido como contrato de backend, não como fluxo de ponta a ponta. Em aberto: se o front atualiza a bolha da mensagem sozinho, sem reload, quando a IA termina (depende de confirmação ao vivo observando o navegador). **Achado colateral (13.4/13.5, 2026-10-08):** 2 dos 5 arquivos de IA antigos (`300`/`301`) têm `ia_status: -1` mas a mensagem no chat nunca foi reescrita (ainda diz "processando, aguarde") — ver `ROADMAP.md` P2.

</dd></dl>

</details>

<details>
<summary><b>Contexto 14: Reações em Mensagens (Issue backend#617/PR #618) — 10 testes</b></summary>

<dl><dd>

- 14.1. **Criar a reação do atendente numa mensagem reagível, refletindo na listagem com status pending:** `PUT .../messages/:id/reaction` → `204`; `reactions[]` traz `{author: "employee", emoji, status: "pending"}` logo após o PUT.
- 14.2. **Atualizar a reação existente ao reagir de novo com outro emoji, sem duplicar entrada:** só 1 reação do atendente por mensagem (`UNIQUE MSG_ID_ALVO+AUTOR`), sempre reflete o emoji mais recente.
- 14.3. **Remover a reação do atendente ao chamar DELETE, sumindo da listagem:** `204`; reação deixa de aparecer no array.
- 14.4. **Responder 204 de forma idempotente ao chamar DELETE sem reação prévia do atendente:** não grava nada, não falha.
- 14.5. **Recusar reagir a um evento de sistema (transfer_type fora de 0/9) com 409 MESSAGE_NOT_REACTABLE:** regra mais estrita que "MSG_ID não vazio" — só mensagens comuns são reagíveis.
- 14.6. **Recusar emoji vazio com 422.**
- 14.7. **Recusar emoji acima de 100 caracteres com 422.**
- 14.8. **Responder 404 ao reagir usando o id de uma mensagem de outro atendimento.**
- 14.9. **Exigir autenticação obrigatória (401) para reagir a uma mensagem.**
- 14.10. **Disparar o evento `message.reaction_changed` no feed de eventos ao reagir (SSE/drain floor):** mesmo padrão do ctx 5 `#5.6` — captura o cursor antes da mutação que o próprio teste provoca, poll com espera de parede real.

> 💡 Massa real curada pelo QA no atendimento `260900034` (conteúdo de teste, não cliente real): mensagem `#4854985` (transfer_type 0, já com wamid) como reagível; `#4854982` (transfer_type 1, evento de transferência) como não reagível. `#14.8` reaproveita o `messageId` `4856181` citado na própria Issue backend#566 como evidência, sem precisar de uma 2ª consulta. `afterEach` sempre limpa a reação, sem deixar resíduo na massa compartilhada. Gaps aceitos (exigem WhatsApp real): reação do cliente pelo celular e falha fora da janela de 24h.

</dd></dl>

</details>

<details>
<summary><b>Contexto 15: Listagem de Mensagens sem Bytes de Anexo e Rota de Anexo Sob Demanda (Issue backend#612) — 3 testes</b></summary>

<dl><dd>

- 15.1. **Devolver os 10.485.760 bytes crus de um anexo pela rota de anexo:** `GET .../messages/:id/attachment` → `200` com `Content-Type` igual ao `mime_type` da listagem, `Cache-Control` privado e sem `Content-Disposition`.
- 15.2. **Listar com `per_page=20` sem `attachment.data` e em tempo sub-segundo:** mantém `filename`/`mime_type`; payload sem os bytes dos anexos de 8 MB e 10 MB da página.
- 15.3. **Responder 404 na rota de anexo para mensagem de outro atendimento.**

> 💡 Sem massa/alcance para `503` (banco de imagens indisponível), `404` de linha só com `IMAGEM_URL` e `403` de Pendente sem dono.

</dd></dl>

</details>

<details>
<summary><b>Contexto 16: Reenvio Manual de Mensagem com Falha (Issue backend#574/PR #614) — 3 testes</b></summary>

<dl><dd>

- 16.1. **Responder 404 para mensagem inexistente e para mensagem de outro atendimento** em `POST .../messages/:id/retry`.
- 16.2. **Recusar o reenvio sem token (401).**
- 16.3. **Recusar com `409 ATTENDANCE_MESSAGE_NOT_RETRYABLE` a mensagem já enviada, a do cliente e o evento de sistema:** ids descobertos pela listagem, sem valor fixo.

> 💡 O sucesso do reenvio devolve uma mensagem real à fila do sender e depende de uma mensagem em erro existente hoje; não é coberto.

</dd></dl>

</details>

<details>
<summary><b>Contexto 17: Nome e Legenda de Documentos no Chat (Issue backend#563/#585) — 3 testes</b></summary>

<dl><dd>

- 17.1. `[SKIP]` **Devolver o nome original do documento enviado e a legenda em `content`:** upload multipart → `201`; a listagem traz `attachment.filename` igual ao enviado, `mime_type` e a legenda em `content` (não existe campo `caption` próprio).
- 17.2. `[SKIP]` **Cortar o meio do nome acima de 60 caracteres, preservando a extensão:** o nome volta com no máximo 60 caracteres, terminado em `….pdf`; sem legenda, `content` é `null`.
- 17.3. **Devolver o nome real do documento recebido do cliente:** `filename` com extensão (nunca `documento_<id>`) e `content` igual ao nome quando não há legenda.

> 💡 Os testes 17.1/17.2 exigem um atendimento Em andamento do operador com janela de 24h ativa e enviam mensagens reais ao `DEFAULT_CELULAR`. O corte em 60 caracteres é limitação aceita (`DESCRICAO VARCHAR(60)`); sem massa para o fallback `documento_<id>`.

</dd></dl>

</details>

<details>
<summary><b>Contexto 18: Baixa de Leitura das Mensagens (POST /read) Nunca Responde 500 sob Conflito de Atualização (Issue backend#641/PR #648) — 3 testes</b></summary>

<dl><dd>

- 18.1. **Responder 200 com `attendance_id`, `unread_count` e `messages_marked` na baixa e repetir o resultado na 2ª chamada:** atendimento sem não lidas, nada é consumido (idempotência).
- 18.2. **Responder só 200 ou 409 `ATTENDANCE_READ_CONFLICT`, nunca 5xx, a 10 baixas simultâneas no mesmo atendimento:** `fetch` em paralelo no navegador; a soma de `messages_marked` não passa das não lidas de antes.
- 18.3. **Responder 401 sem token e 404 para atendimento inexistente na baixa.**

> 💡 O conflito de atualização do trigger e o `409` não são reproduzíveis na massa atual (nenhum atendimento aceita a baixa), então ficam para QA manual; os testes fixam o contrato e o invariante de que não há `5xx`.

</dd></dl>

</details>

<details>
<summary><b>Contexto 19: Transferência de Atendimento só para o Grupo e Dados do Modal de Transferência (Issue backend#666/PR #671 e #672) — 6 testes</b></summary>

<dl><dd>

- 19.1. **Recusar com 422 `ATTENDANCE_SAME_GROUP` a transferência para o grupo em que o atendimento já está:** "O atendimento já está neste grupo."; o atendimento não muda.
- 19.2. **Recusar com 422 a transferência para o grupo com status ou substatus no corpo:** "A transferência para o grupo não aceita status."; `target_attendant_id` nulo segue recusado.
- 19.3. **Recusar com 409 `ATTENDANCE_TRANSFER_CLOSED` a troca de grupo de um atendimento encerrado:** o atendimento (status, grupo e atendente) não muda; só é enviado depois de um sentinela que prova a PR #671 no ar.
- 19.4. **Listar os grupos com canais ativos, total e disponíveis de atendentes:** `channels[{id,name}]`, `agents_total` e `agents_available`; com `channel_id`, só os grupos vinculados ao canal.
- 19.5. **Bater `agents_total` e `agents_available` do grupo com a lista de atendentes:** e `ongoing_attendances` inteiro em cada atendente.
- 19.6. **Recusar com 409 `ATTENDANCE_TRANSFER_CLOSED` a transferência para atendente de outro grupo em atendimento Finalizado ou Descartado:** grupo + atendente, o corpo da tela; o atendimento (status, grupo e atendente) não muda; só é enviado depois do sentinela que prova a PR #671 no ar (Issue backend#515).

> 💡 Nenhum atendimento é transferido: só corpos que o contrato recusa e leituras. O sucesso da transferência, os `403` por permissão e a variação de `ongoing_attendances` ficam sem teste (mudam atendimento real e/ou exigem conta restrita).

</dd></dl>

</details>

<details>
<summary><b>Contexto 20: Envio de Arquivos para a IA pela Fila IA_ORCAMENTO, sem Chamar a PH24 (Issue backend#667/PR #670) — 6 testes</b></summary>

<dl><dd>

- 20.1. **Recusar com 422 o lote sem arquivos:** "Selecione ao menos um arquivo."; nada entra na fila da IA.
- 20.2. **Recusar com 422 os identificadores 0 e negativo e com 400 o corpo malformado:** "Identificadores de arquivo inválidos." (mesmo ao lado de um id válido); id em texto ou corpo sem `file_ids` → "Malformed request body".
- 20.3. **Recusar com 422 o arquivo de outro atendimento ou inexistente:** "Um ou mais arquivos não pertencem a este atendimento.", também com `movement_type: 1`; o lote inteiro é recusado.
- 20.4. **Recusar com 422 `INVALID_CONTEXT` o `movement_type` diferente de 1:** "Tipo de movimento inválido.", validado antes da posse dos arquivos.
- 20.5. **Responder 404 para atendimento inexistente e 401 sem token ou com token adulterado:** "Atendimento não encontrado"; o lote vazio ainda responde 422 antes de carregar o atendimento.
- 20.6. **Aceitar com `202` o envio real à fila da IA, recusar com `409 IA_FILE_ALREADY_QUEUED` o reenvio imediato e listar o arquivo como processando:** só roda com `--env IA_SUBMISSAO_REAL=true`; sem a flag o teste pula com o motivo, porque cada envio real grava na fila, posta a mensagem no chat e consome a PH24.

> 💡 Nenhum arquivo é enviado para a IA: só corpos que o contrato recusa, com a listagem de arquivos de IA fotografada antes e depois. O `202` (linha na fila e mensagem "processando" no chat), o `409 IA_FILE_ALREADY_QUEUED`, a loja/funcionário da sessão e o reenvio de arquivo calculado ou com erro ficam sem teste: gravam na fila e consomem a PH24 a cada rodada.

</dd></dl>

</details>

<details>
<summary><b>Contexto 21: Lista de Canais do Filtro da Fila: Só os Canais Ativos, Inclusive Pedido Pago, Exigindo só o Acesso ao Módulo de Atendimento (Issue cypress#47/backend#685 e #687; backend#721/PR #733) — 7 testes</b></summary>

<dl><dd>

- 21.1. **Listar os canais ativos, inclusive os de Pedido Pago, ordenados por nome:** `GET /attendances/channels`; ids únicos e ao menos um canal de Pedido Pago.
- 21.2. **Trazer em cada item só os campos de `/channels`, sem campo novo:** e idêntico ao de `/channels` nos canais comuns.
- 21.3. **Exigir só o acesso ao módulo de atendimento (418) na lista do filtro e a criação de atendimento (636) em `/channels`:** consistência com as capabilities da conta.
- 21.4. **Responder 401 sem token:** na lista do filtro e em `/channels`.
- 21.5. **Manter `/channels` (Iniciar atendimento) sem os canais de Pedido Pago:** todos presentes na lista do filtro, que tem mais canais.
- 21.6. **Manter o detalhe do atendimento (`/attendances/:id`) como antes:** a rota nova `/attendances/channels` divide o prefixo e não interfere; id inexistente segue `404` (Issue backend#685).
- 21.7. **Não listar canal inativo no filtro (backend#721):** prova por diferença, porque a API não expõe o status — nenhum canal do filtro fora de `/channels` que não seja Pedido Pago; os de Pedido Pago seguem; item com os mesmos campos; `/channels` inalterada e contida no filtro.

> 💡 Só leitura. Os canais e a ordem do homolog são massa: os testes afirmam a regra, não a lista fixa. O usuário com 418 sem 636 e o sem 418 pedem conta restrita e ficam só na consistência com as capabilities da conta.

</dd></dl>

</details>

<details>
<summary><b>Contexto 22: Filtro linked_to_channel Devolve só os Grupos com Vínculo a Canal Ativo (Issue backend#686/PR #720) — 5 testes</b></summary>

<dl><dd>

- 22.1. **Devolver com `linked_to_channel=true` só os grupos com canal ativo vinculado:** a lista filtrada é a lista completa sem os grupos de `channels` vazio, na mesma ordem, e o item mantém `agents_total` e `agents_available`.
- 22.2. **Manter a lista completa, com os grupos sem vínculo, sem o parâmetro e com `linked_to_channel=false`:** as duas listas são iguais e maiores que a filtrada.
- 22.3. **Combinar com `channel_id`:** o filtro por canal devolve os mesmos grupos com e sem `linked_to_channel=true`.
- 22.4. **Combinar com `employee_id`:** só os grupos do atendente que têm canal ativo vinculado.
- 22.5. **Recusar valor inválido:** `linked_to_channel=abc` responde `422` `INVALID_CONTEXT`, sem lista.

> 💡 Só leitura. Grupo ligado só a canal inativo, canal inativado no meio do teste e atendimento do grupo sem vínculo seguir na fila não são cobertos: não há massa nem rota que os produza.

</dd></dl>

</details>

</dd></dl>

</details>
<br>

<details>
<summary><b>0-C — Receitas (<code>0-C.backend-receitas.cy.js</code>) — 181 testes em 31 contextos</b></summary>


<dl><dd>

<br>

<details>
<summary><b>Contexto 1: Rastreabilidade e Processos de Manipulação por Fórmula — 6 testes</b></summary>

<dl><dd>

- 1.1. **Validar capabilities e permissões dos processos de manipulação (Grants 231, 509 e 337):** `GET` capabilities de manipulação; valida grants específicos.
- 1.2. **Consultar os passos de rastreamento da fórmula (`/tracking-steps`):** `GET /tracking-steps`; valida array de passos com estrutura.
- 1.3. **Listar os processos de manipulação vinculados à fórmula (`/manipulation-processes`):** `GET /manipulation-processes`; valida listagem.
- 1.4. **Registrar um novo processo de manipulação na fórmula (`POST /manipulation-processes` - Grant 231):** `POST` de novo processo; valida 201 Created.
- 1.5. **Atualizar comissão e reatribuir funcionário no processo (`PATCH /manipulation-processes/:id` - Grants 337 e 509):** `PATCH` de comissão; valida 200 e persistência.
- 1.6. **Remover o processo de manipulação registrado (`DELETE /manipulation-processes/:id`):** `DELETE` de processo; valida 200/204.

</dd></dl>

</details>

<details>
<summary><b>Contexto 2: Documentos e Imagens de Receitas (PRs #344 e #345) — 6 testes</b></summary>

<dl><dd>

- 2.1. **Listar os documentos e imagens anexados à receita com paginação (`GET /documents`):** `GET /documents`; valida paginação e estrutura.
- 2.2. **Realizar upload de anexo de imagem para a receita (`POST /documents`):** `POST` de upload; valida 201 e vínculo.
- 2.3. **Obter `preview-urls` e dados binários dos documentos da receita (`GET /documents/preview-urls`):** `GET preview-urls`; valida paginação/schema contra o documento recém-criado no mesmo run.
- 2.4. **Excluir logicamente um documento da receita (`DELETE /documents/:id`):** `DELETE` lógico; valida soft-delete.
- 2.5. **Retornar 404 ao consultar documentos de receita inexistente:** Receita com ID inválido retorna 404.
- 2.6. **Issue backend#603/#604 — documento de receita antigo (pré-migração 29/09/2026) deve continuar resolvendo para conteúdo binário válido:** massa real permanente (prescrição `260700281`/doc `441` PNG; prescrição `260700251`/doc `392` JPEG, ambos de 07/2026) — `url` sempre `null`, `data` base64 decodifica pra assinatura binária correta. Homologado pelo operador ("validado") e `.only` removido em 2026-10-08.

</dd></dl>

</details>

<details>
<summary><b>Contexto 3: Ciclo de Vida de Receitas (Finalizar e Cancelar Finalização) — 7 testes</b></summary>

<dl><dd>

- 3.1. **Finalizar uma receita com fórmula calculada com sucesso (`POST /finalize` - Status 200, `status: -1`):** `POST /finalize` com a data de entrega futura calculada na hora; valida a transição para status finalizado e a data de entrega gravada, em UTC. No modo manual, a data gravada e a do laboratório de cada fórmula calculada são a data informada (Issue backend#792).
- 3.2. **Cancelar a finalização de uma receita concluída retornando para rascunho (`POST /cancel-finalization` - Status 200, `status: 0`):** `POST /cancel-finalization`; valida volta para rascunho. As datas do cliente e do laboratório voltam vazias (Issue backend#792).
- 3.3. **Rejeitar finalização de receita que já está finalizada (422):** Idempotência negativa; 422 em dupla finalização.
- 3.4. **Rejeitar cancelamento de finalização em receita de rascunho (422):** 422 ao cancelar receita já no status rascunho.
- 3.5. **Rejeitar finalização de receita sem fórmulas (422):** 422 ao finalizar receita vazia.
- 3.6. **Retornar 404 ao tentar finalizar receita inexistente:** Receita com ID inválido retorna 404.
- 3.7. **Retornar 404 ao tentar cancelar finalização de receita inexistente:** 404 para ID inexistente.
- 3.8. **Recusar com `422 DELIVERY_DATE_REQUIRED` a finalização sem data de entrega na loja de modo manual (backend#792):** com `{}` e com a data nula; a receita continua em rascunho e sem data.

</dd></dl>

</details>

<details>
<summary><b>Contexto 4: Consistência de Carimbos, Derivação `needs_recalculate` e Expiração (PR #461 - Issue #341) — 3 testes</b></summary>

<dl><dd>

- 4.1. **Validar consistência temporal e ausência de defasagem de 3h em receitas recém-criadas:** Timestamps sem +3h da JVM.
- 4.2. **Validar a derivação `needs_recalculate: false` após cálculo e transição para `true` após alteração na fórmula:** Flag reativa de recálculo.
- 4.3. **Validar prazos de expiração de pedidos de autorização sem acréscimo indevido de 3h:** Expiração sem drift de fuso.

</dd></dl>

</details>

<details>
<summary><b>Contexto 5: Regulação de Portarias e Exigência de Receituário (PR #452) — 3 testes</b></summary>

<dl><dd>

- 5.1. **Validar a presença dos novos campos regulatórios e derivação booleana em produtos de portaria (`/products`):** Campos regulatórios em produtos.
- 5.2. **Validar consistência dos campos de portaria dentro de produtos de fórmulas da receita (`/prescriptions/:id`):** Portaria consistente em receitas.
- 5.3. **Rejeitar busca de produtos sem o parâmetro obrigatório `usage` (422):** 422 sem parâmetro `usage`.

</dd></dl>

</details>

<details>
<summary><b>Contexto 6: Limite Superior do Multiplicador da Fórmula nas Três Rotas (Issue backend#636/PR #644) — 4 testes</b></summary>

<dl><dd>

- 6.1. **Recusar a criação de fórmula com multiplier acima de 32767:** `32768`, `99999` e `100000` respondem `422` "Multiplicador inválido." (antes, `500`); nada é criado.
- 6.2. **Recusar o PATCH da fórmula com multiplier acima de 32767 ou além de Int:** `32768` e `4294967297` respondem `422` e o valor da fórmula não muda (antes, o segundo era truncado para 1 e gravado).
- 6.3. **Aceitar na prévia do cálculo multiplier de 1 até 32767:** a prévia devolve linhas e totais, sem gravar nada.
- 6.4. **Recusar na prévia do cálculo multiplier acima de 32767, menor que 1, fracionário ou além de Int:** `422` com a mensagem de cada caso.

> 💡 O teto é o da coluna (`SMALLINT`, 32767); abaixo dele não há regra de negócio. `32767` na criação e no PATCH não é exercitado, para não gravar no tenant.

</dd></dl>

</details>

<details>
<summary><b>Contexto 7: Tamanho Máximo dos Campos de Texto da Fórmula na Criação e no PATCH (Issue backend#637/PR #645) — 4 testes</b></summary>

<dl><dd>

- 7.1. **Recusar a criação de fórmula com campo de texto acima da coluna:** cada um dos 8 campos com 1 caractere a mais responde `422` "O campo <campo> deve ter no máximo <n> caracteres." (antes, `500`); nada é criado.
- 7.2. **Recusar o PATCH da fórmula com campo de texto acima da coluna:** mesma mensagem; a fórmula não é alterada.
- 7.3. **Aceitar e gravar os campos no tamanho exato da coluna:** os 8 campos no limite, na criação e no PATCH, voltam por inteiro na leitura da receita.
- 7.4. **Contar o `cid_code` em caracteres, não em bytes:** 15 caracteres acentuados são aceitos e 16 são recusados.

> 💡 Roda numa receita temporária própria (1 por rodada na dev, receita não tem exclusão). O CID é texto livre, sem cadastro: só o tamanho é validado.

</dd></dl>

</details>

<details>
<summary><b>Contexto 8: Limites da Quantidade e da Unidade do Produto no Cálculo da Fórmula (Issue backend#638/PR #646 e backend#734/PR #756) — 9 testes</b></summary>

<dl><dd>

- 8.1. **Recusar na prévia do cálculo a quantidade de 11 caracteres:** `422` com a mensagem do campo (antes, `500` dentro da procedure); um produto estourado derruba a prévia inteira.
- 8.2. **Aceitar na prévia a quantidade de 10 caracteres que cabe no limite e as de uso normal:** `123456.123`, `500`, `0.25` e `250` em `MG` com `qvd` 30.
- 8.3. **Recusar na prévia a unidade de 11 caracteres:** `422` citando a unidade e o limite de 7 caracteres.
- 8.4. **Recusar ao adicionar produto à fórmula a quantidade de 11 caracteres:** `422`, sem gravar o produto (antes só quebrava no cálculo).
- 8.5. **Recusar no PATCH do produto a quantidade de 11 caracteres:** `422`, sem alterar o produto.
- 8.6. **Aceitar na prévia a quantidade de uso normal e recusar com `422` a quantidade claramente acima do limite:** `MG` com `qvd` 30 e 100 (`1000` e `500` passam, `999999999` recusa), sem `500` nem detalhe interno do banco.
- 8.7. **Aplicar o limite do cálculo conforme a unidade informada:** sem borda fixa, acha a primeira quantidade que `G` recusa (com `qvd` 30 e 100) e a mesma quantidade passa em `MG`.
- 8.8. **Recusar na prévia a unidade de 8 a 10 caracteres:** `422` citando a unidade e o limite de 7 (antes, `500`).
- 8.9. **Tratar a unidade de exatamente 7 caracteres:** nunca `500` nem a mensagem do limite de caracteres.

> 💡 Só massa lida e valores recusados: nenhuma receita é criada. O limite do cálculo depende da conversão da unidade (em `MG` a quantidade é dividida por 1000, em `G` não) e das linhas que a forma farmacêutica inclui, então nenhum teste fixa uma borda e todo caso de quantidade informa a unidade e o QVD.
>
> ⚠️ O cálculo persistente com quantidade que estoura não é coberto, porque exigiria gravar o valor numa receita real.

</dd></dl>

</details>

<details>
<summary><b>Contexto 9: Decimal com Expoente Extremo Responde 400, não Esgota a Memória do Servidor (Issue backend#650/PR #651) — 5 testes</b></summary>

<dl><dd>

- 9.1. **Recusar com 400 o desconto com expoente extremo no `validate-discount` com `persist=true`:** `1e-999999999`, `1e999999999` e `-1e999999999` → `400` "Malformed request body" (antes, `OutOfMemoryError` e `500`); a receita não muda. O extremo só é enviado depois de um valor sentinela (`1e-101`) provar a correção no ar.
- 9.2. **Recusar com 400 o desconto com expoente extremo na prévia do cálculo da fórmula:** os mesmos 3 extremos em `discount_percentage`.
- 9.3. **Recusar o `multiplier` com expoente extremo no `PATCH` da fórmula (corpo lido como `JsonNode`):** `422` "Multiplicador inválido." e fórmula inalterada.
- 9.4. **Continuar aceitando os decimais legítimos:** `10.5`, `10.1234`, `0.0001`, `1.5e-3` e `1e2` → `200` nas duas rotas (controle positivo).
- 9.5. **Fronteira do `scale`:** `1e-100` aceito, `1e-101` e `1e101` → `400`; `1e100` passa pela desserialização e cai na validação de faixa da rota (`422`).

> 💡 `PATCH` de `quantity` do produto com `Infinity` ficou sem teste de propósito (gravaria lixo numa fórmula real se a recusa falhasse).

</dd></dl>

</details>

<details>
<summary><b>Contexto 10: Prévia do Cálculo da Fórmula Recusa Desconto Fora de 0 a 100 com 422 (Issue backend#652/PR #663) — 5 testes</b></summary>

<dl><dd>

- 10.1. **Recusar com 422 a prévia com desconto negativo (-10) ou acima de 100 (150):** "Percentual de desconto inválido.", sem calcular o total.
- 10.2. **Recusar com 422 a prévia com desconto a um centésimo além de cada limite (-0.01 e 100.01):** mesma recusa e mesma mensagem.
- 10.3. **Continuar calculando a prévia com desconto 0, 10 e 100:** o valor com desconto acompanha o percentual e com 100 fica 0,00, nunca negativo.
- 10.4. **Calcular sem desconto quando a prévia não manda `discount_percentage`:** o valor com desconto é o de venda.
- 10.5. **Aplicar na prévia a mesma regra e a mesma mensagem do `validate-discount`:** nos limites e além deles, os dois respondem igual.

> 💡 Só leitura: a prévia não grava nada e o `validate-discount` roda sem persistir.

</dd></dl>

</details>

<details>
<summary><b>Contexto 11: Campos Numéricos da Fórmula: QVD, Peso, Taxa Técnica, Valor Extra e do Tipo de Medicamento Recusam o Inválido com 422 (Issue backend#654/PR #665) — 6 testes</b></summary>

<dl><dd>

- 11.1. **Recusar com 422 a criação de fórmula com QVD abaixo de 0,01, com mais de 2 casas, acima do teto ou ausente:** "QVD deve estar entre 0,01 e 9999999999999999,99, com até 2 casas decimais." e "QVD obrigatório."; nada é criado.
- 11.2. **Recusar com 422 o `PATCH` do QVD inválido ou nulo:** a fórmula não muda.
- 11.3. **Recusar com 422 a prévia com QVD 0, 0.001, com mais de 2 casas ou acima do teto:** e seguir calculando com QVD válido, no mínimo 0,01 e sem QVD.
- 11.4. **Recusar com 422 peso, taxa técnica, valor extra e valor do tipo de medicamento negativos, com mais de 2 casas ou acima do teto, no `POST` e no `PATCH`:** a mensagem traz o nome do campo; nada é gravado.
- 11.5. **Recusar com 422 na prévia peso, valor extra e valor do tipo de medicamento inválidos:** a taxa técnica não é validada na prévia (só saída).
- 11.6. **Continuar gravando exatamente o que foi enviado nos valores válidos com até 2 casas:** zeros à direita não contam como casa, `0` é válido e o mínimo do QVD é 0,01, no `POST` e no `PATCH`.

> 💡 Tudo que escreve roda numa receita temporária própria (receita não tem exclusão); a prévia só lê. O `PATCH` do teto exato e da precisão acima de ~1e15 fica sem teste: lê o número como double, comportamento provavelmente defeituoso.

</dd></dl>

</details>

<details>
<summary><b>Contexto 12: Número Fracionário em Campo Inteiro Responde 422, não é Truncado (Issue backend#653/PR #664) — 5 testes</b></summary>

<dl><dd>

- 12.1. **Recusar com 422 a criação de fórmula com `multiplier` fracionário (`1.5` e `2.0`):** "O campo multiplier deve ser um número inteiro."; nada é criado e o inteiro `2` segue aceito e gravado como 2.
- 12.2. **Recusar com 422 o mesmo `multiplier` fracionário na prévia do cálculo:** a prévia só lê, nada é gravado.
- 12.3. **Recusar com 422 qualquer campo inteiro fracionário nas rotas da fórmula e do link de pagamento:** a mensagem traz o nome do campo (e o caminho dentro da lista, como `products[0].product_id`); nenhuma fórmula é criada ou alterada e nenhum link é gerado.
- 12.4. **Manter 400 de corpo malformado para texto em campo inteiro:** só o número fracionário virou 422.
- 12.5. **Manter a mensagem própria "Multiplicador inválido." no `PATCH` com `multiplier` 1.5:** a fórmula não muda.

> 💡 Tudo que escreve roda numa receita temporária própria (receita não tem exclusão); a prévia só lê. A regressão do link de pagamento está nos testes 11.2 a 11.5.

</dd></dl>

</details>

<details>
<summary><b>Contexto 13: Texto Fora do WIN1252 (Emoji) na Receita e na Fórmula Responde 422, não Vira "?" (Issue backend#655/PR #701) — 8 testes</b></summary>

<dl><dd>

- 13.1. **Recusar com 422 a criação de receita com emoji em `rg_ie`, `issuing_body`, `issuing_body_uf` ou `observation`:** com a mensagem do campo e sem devolver `id`.
- 13.2. **Recusar com 422 o `PATCH` da receita com emoji em cada campo de texto:** campos e `updated_at` ficam como estavam.
- 13.3. **Recusar com 422 qualquer caractere fora do WIN1252, não só emoji:** CJK, cirílico, grego, `ı`, sequência com ZWJ e controle C1.
- 13.4. **Recusar o `PATCH` inteiro quando um dos campos enviados tem emoji:** o campo válido enviado junto não é gravado.
- 13.5. **Aceitar no `PATCH` da receita acentos do português e a pontuação do WIN1252:** o texto volta e grava idêntico, sem `?`, com tabulação e quebra de linha.
- 13.6. **Gravar sem alterar, na criação da receita, o texto com acentos e a pontuação do WIN1252:** nos 4 campos de texto.
- 13.7. **Recusar com 422 a criação de fórmula com emoji em cada um dos 8 campos de texto:** sem criar a fórmula.
- 13.8. **Recusar com 422 o `PATCH` da fórmula com emoji em cada campo de texto:** o valor é preservado e a posologia com acento é aceita.

> 💡 Tudo que escreve roda numa receita temporária própria (receita não tem exclusão). A mensagem diz "emoji" para qualquer caractere fora do WIN1252, e a recusa da fórmula é coberta como observada na API real.

</dd></dl>

</details>

<details>
<summary><b>Contexto 14: Autorização de Insumos Controlados na Receita: Leitura, Recusas, Autorização Transacional e Barreira na Finalização (Issue backend#227/PR #708, #709 e #710) — 14 testes</b></summary>

<dl><dd>

- 14.1. **Listar só os insumos controlados de fórmula calculada, com portaria, conselhos aceitos e o que falta:** só as 3 controladas de fórmula calculada, com `missing` por código da portaria (3 → data e número, 1 → data, 0 → nada), conselhos aceitos e capabilities.
- 14.2. **Recusar a leitura sem token (401), de receita inexistente (404) e com identificador inválido (422):** `401`, `404` "Receita não encontrada." e `422 INVALID_CONTEXT`.
- 14.3. **Recusar a autorização sem o que a portaria exige no item:** número `"0"` ou vazio no código 3 e data ausente nos códigos 3 e 1, com a mensagem do produto; nada grava.
- 14.4. **Recusar comprador genérico, documento incompleto, tipo inexistente, prescritor genérico e órgão acima de 10 caracteres:** comprador e prescritor genéricos, tipo de documento inexistente, `rg_ie` vazio, UF com 3 letras e `issuing_body` com 11 caracteres.
- 14.5. **Exigir todos os insumos controlados, recusar repetido, sem token e receita inexistente:** `Faltam: <formula>/<linha>.`, duplicidade, `items` vazio, `401` e `404`.
- 14.6. **Ler lista vazia e recusar a autorização de receita sem insumo controlado:** leitura `200` com `items: []`; `POST` → `422` "Esta receita não possui insumo controlado a autorizar.".
- 14.7. **Barrar a finalização de receita com controlado sem autorização:** `422` com a barreira, que vem antes da checagem de fórmulas calculadas.
- 14.8. **Autorizar numa única operação, gravando documento e dados de cada insumo:** `200` com a receita completa e `controlled_authorization` (`employee_id` do operador com o 583); a leitura mostra documento e dados por insumo.
- 14.9. **Deixar de barrar a finalização depois de autorizar:** a finalização cai na próxima validação, "Todas as fórmulas devem estar calculadas…".
- 14.10. **Reautorizar com avisos que não bloqueiam:** vencida, data futura e retorno não posterior ao aviamento voltam em `warnings` sem recusar.
- 14.11. **Gravar na linha e devolver na leitura a data de retorno enviada na autorização (com o grant 449):** a matriz da permissão 449 fica no 58.14.
- 14.12. **Servir na leitura a data e o CID da linha quando ela tem valor próprio diferente do da fórmula (backend#711, cenário 6):** a linha autorizada com data e CID próprios continua mostrando os seus depois de a fórmula receber outros; a fórmula mantém os dela.
- 14.13. **Aceitar o reenvio exato do que a leitura serviu sem alterar nada (backend#711, cenário 3, parte com a 449):** reenviar por item só o que o `GET` devolveu autoriza com 200, mantém as fórmulas e os itens idênticos; a dispensa da permissão 449 depende de conta sem o grant.
- 14.14. **Exigir a permissão 449 só para mudar ou apagar a data de retorno na autorização, nunca para reenviar a data servida (backend#711, cenários 3 a 5):** receita própria com a data na fórmula; reenviar o que a leitura serviu passa com ou sem o grant; outra data ou data apagada passam e gravam com a 449 e recusam com 403 sem ela (ramos 403 dormentes até haver conta sem a 449). Só backend: o front não expõe a data de retorno.

> 💡 As rotas ficam em `/prescriptions/:id/...`, sem o prefixo `/stores/:id`. Tudo roda numa receita própria (receita não tem exclusão). Sem conta para medir: o `403` do grant 583 sem ticket, o `403` do grant 449 e o conselho não aceito pela portaria.

</dd></dl>

</details>

<details>
<summary><b>Contexto 15: PATCH da Receita Exige as Mesmas Partes da Criação e não Muda o Tipo (Issue backend#656/PR #700) — 6 testes</b></summary>

<dl><dd>

- 15.1. **Recusar o paciente nulo no PATCH de receita humana:** `422` "Paciente obrigatório para receita humana.", sozinho ou com o comprador nulo; o paciente continua gravado.
- 15.2. **Recusar o animal informado no PATCH de receita humana:** `422` "Tipo de receita não pode ser alterado."; o tipo segue humano.
- 15.3. **Recusar o comprador nulo no PATCH de receita animal:** `422` "Comprador obrigatório para receita animal."; o comprador continua gravado.
- 15.4. **Recusar o animal nulo no PATCH de receita animal:** `422` "Tipo de receita não pode ser alterado."; o tipo e o animal seguem iguais.
- 15.5. **Manter a criação exigindo as mesmas partes:** `POST` de humana sem paciente e de animal sem comprador recusam com as mesmas mensagens e sem devolver `id`.
- 15.6. **Continuar aceitando as trocas válidas:** troca de paciente (humana) e de comprador (animal) por outro cadastro, e paciente nulo na receita animal, com `200`.

> 💡 Tudo roda em 2 receitas temporárias próprias (1 humana e 1 animal; receita não tem exclusão). As recusas não gravam nada; o paciente na receita animal e o comprador na humana não são exigidos.

</dd></dl>

</details>

<details>
<summary><b>Contexto 16: Inclusão na Fórmula de Produto que é Fórmula Cadastrada com Inclusão Bloqueada Responde 422 com o Motivo (Issue backend#660/PR #703) — 2 testes</b></summary>

<dl><dd>

- 16.1. **Recusar a inclusão de produto que é fórmula cadastrada com inclusão bloqueada:** `422` "O produto <nome> é uma fórmula cadastrada que não pode ser incluída na receita. Libere a inclusão no cadastro dessa fórmula ou escolha outro produto.", com o nome lido do cadastro e sem depender da quantidade; a fórmula continua sem produtos.
- 16.2. **Continuar incluindo o produto sem a flag:** o PURO CLONAZEPAM, da mesma portaria, entra com `201` e a fórmula passa a ter 1 produto.

> 💡 Roda numa receita temporária própria com 1 fórmula (receita não tem exclusão). As outras mensagens da procedure seguem repassadas como estão, mas não há massa para provocá-las.

</dd></dl>

</details>

<details>
<summary><b>Contexto 17: Avisos do Cálculo da Fórmula: Dose Fora do Intervalo (out_of_range_dosage) e Aviso do Produto (product_notice), sem monitored_product (Issue backend#657/PR #705) — 7 testes</b></summary>

<dl><dd>

- 17.1. **Avisar dose acima do máximo cadastrado, e não avisar no limite exato:** `out_of_range_dosage` com `direction: "above"`, mensagem e nome do produto; o máximo exato não avisa.
- 17.2. **Avisar dose abaixo do mínimo cadastrado, e não avisar no limite exato:** `direction: "below"`; o mínimo exato não avisa.
- 17.3. **Avisar cada produto fora do intervalo na mesma prévia, com a sua direção:** dois avisos, um por produto fora do intervalo, e nenhum para o que está dentro.
- 17.4. **Comparar a dose depois de converter a unidade:** o máximo em mg vale igual em g.
- 17.5. **Devolver o aviso de atendimento do cadastro como `product_notice`:** `product_notice` sem `direction` e com o texto do cadastro; junto de `out_of_range_dosage` quando a dose também está fora.
- 17.6. **Nunca mais devolver `monitored_product`:** só `out_of_range_dosage` e `product_notice`, com as 5 chaves do aviso.
- 17.7. **Expor a capability `can_calculate_out_of_range_dosage` como booleana:** capability do grant 621 booleana em `/prescription-capabilities`.

> 💡 Só a prévia do cálculo, que não grava nada; os limites vêm do catálogo a cada rodada. A barreira da permissão 621 no cálculo e na conclusão está no Contexto 63.

</dd></dl>

</details>

<details>
<summary><b>Contexto 18: Busca de Prescritores pelo Número do Conselho (CRM), com os Achados pelo CRM antes dos Achados pelo Código (Issue backend#658/PR #712) — 5 testes</b></summary>

<dl><dd>

- 18.1. **Devolver primeiro os prescritores com o CRM digitado e só depois o de código igual:** `q=23325` traz os de CRM 23325 antes do prescritor de código 23325.
- 18.2. **Trazer em cada item o conselho, o número e a UF:** além do código e do nome, na busca por número e na busca por nome.
- 18.3. **Achar o CRM salvo com zero à esquerda digitando o número sem o zero:** `8746` acha `08746`, e o termo com zero devolve o mesmo resultado.
- 18.4. **Manter a busca por nome:** todo item traz o termo no nome, em ordem de nome.
- 18.5. **Responder 401 sem token:** na busca de prescritores.

> 💡 Só leitura. A massa do tenant dev (CRM 23325 de 2 prescritores e CRM 8746 salvo com e sem zero) tem precondição: os testes afirmam a regra, não a lista inteira.

</dd></dl>

</details>

<details>
<summary><b>Contexto 19: Permissão 621 (Dose Fora do Intervalo): Cálculo e Conclusão Manual Coerentes com can_calculate_out_of_range_dosage (Issue backend#657/PR #706) — 3 testes</b></summary>

<dl><dd>

- 19.1. **Calcular fora do intervalo conforme a capability do grant 621:** com o grant, `200` com o aviso `out_of_range_dosage` (`formula_id`, `formula_number`) e fórmula calculada; sem o grant, `403 AUTHORIZATION_REQUIRED` sem gravar (ramo não exercitado nesta conta).
- 19.2. **Calcular dentro do intervalo sem depender do grant:** a dose dentro do intervalo calcula sem aviso, com ou sem o grant.
- 19.3. **Concluir à mão fórmula com dose fora do intervalo conforme a capability:** depois de alterar a dose para fora do intervalo, `calculated: true` passa com o grant e dá `403 AUTHORIZATION_REQUIRED` sem ele (ramo não exercitado).

> 💡 Padrão capability × ação: a conta de teste tem o grant 621, então só o ramo com o grant roda; o `403 AUTHORIZATION_REQUIRED` sem o grant e o fluxo com ticket ficam sem teste. Roda numa receita própria (receita não tem exclusão).

</dd></dl>

</details>

<details>
<summary><b>Contexto 20: Busca de Produtos da Receita sem Distinguir Acento nem Caixa, nos Modos containing e starting (Issue backend#661/PR #713) — 4 testes</b></summary>

<dl><dd>

- 20.1. **Achar os mesmos produtos no modo `containing` com e sem acento e em qualquer caixa:** `passiflora`, `passiflóra`, `PASSIFLORA` e `Passiflóra` trazem os mesmos produtos, com `PASSIFLORA EXTRATO SECO` entre eles.
- 20.2. **Achar os mesmos produtos no modo `starting` com e sem acento e em qualquer caixa:** sempre dentro do resultado do modo `containing`.
- 20.3. **Achar os mesmos produtos com o acento em outra palavra:** `solução` e `solucao`.
- 20.4. **Manter o formato do item e responder 401 sem token:** na busca de produtos.

> 💡 Só leitura. A correção é um script de banco e só vale onde foi aplicado; a massa do tenant dev tem precondição. O limite de tempo da issue não tem asserção, por causa do ruído de rede.

</dd></dl>

</details>

<details>
<summary><b>Contexto 21: Leitura dos Itens Controlados Serve o Retorno e o CID da Fórmula quando a Linha não os Tem (Issue backend#711/PR #727) — 2 testes</b></summary>

<dl><dd>

- 21.1. **Servir na leitura o retorno e o CID da fórmula nas linhas que não têm os seus, cada campo por si:** receita com 3 fórmulas controladas (retorno e CID, só retorno, só CID); a leitura devolve em cada linha o valor da fórmula e vazio no que a fórmula não tem.
- 21.2. **Manter a fórmula intacta na leitura:** duas leituras iguais, e o retorno e o CID das fórmulas continuam os mesmos.

> 💡 Só leitura. Reenviar na autorização o que a leitura mostrou, sem pedir a permissão de retorno, ainda não é coberto: a rota de autorização responde erro interno na dev.

</dd></dl>

</details>

<details>
<summary><b>Contexto 22: Tamanho Máximo dos Campos de Texto do Cabeçalho da Receita na Criação e no PATCH (Issue backend#702) — 7 testes</b></summary>

<dl><dd>

- 22.1. **Recusar a criação de receita com campo de texto 1 caractere acima do máximo:** `rg_ie` (20), `issuing_body` (10), `issuing_body_uf` (2) e `observation` (7000) respondem `422` "O campo <campo> deve ter no máximo <n> caracteres.", sem id e sem `500`.
- 22.2. **Recusar o PATCH com campo de texto acima do máximo:** a mesma `422`, e os 4 campos e o `updated_at` seguem idênticos.
- 22.3. **Aceitar no PATCH os 4 campos com exatamente o máximo:** `200` e gravados por inteiro.
- 22.4. **Aceitar na criação os 4 campos com exatamente o máximo:** `201` e gravados por inteiro.
- 22.5. **Recusar o PATCH inteiro quando um dos campos passa do máximo:** o campo válido enviado junto não é gravado.
- 22.6. **Recusar o `issuing_body` de 20 caracteres:** o máximo é 10, porque o banco guarda só os 10 primeiros.
- 22.7. **Contar o tamanho em caracteres e não em bytes:** 20 acentuados no `rg_ie` são aceitos e 21 recusados.

> 💡 Cada rodada cria 2 receitas temporárias no ambiente de teste, pois receita não tem exclusão.

</dd></dl>

</details>

<details>
<summary><b>Contexto 23: Calcular a Fórmula Grava a Observação do Sistema em system_observation, como o Desktop (Issue backend#704/PR #726) — 5 testes</b></summary>

<dl><dd>

- 23.1. **Gravar ao calcular a observação do sistema da fórmula simples, que antes do cálculo estava vazia:** o `GET` da receita serve um texto que começa com `Volume:` e, com a dose dentro do intervalo, não traz aviso de quantidade.
- 23.2. **Gravar o aviso de quantidade acima das especificações e o de abaixo:** cada um na sua fórmula, sem o aviso do outro sentido.
- 23.3. **Gravar a portaria do produto controlado:** a observação traz a portaria do insumo.
- 23.4. **Substituir o texto ao recalcular, sem acumular o anterior:** o aviso some com a dose dentro do intervalo e volta, uma só vez, com a dose fora.
- 23.5. **Manter a prévia do cálculo sem gravar nada:** a fórmula que nunca foi calculada segue sem observação do sistema.

> 💡 Só API. A dose fora do intervalo no cálculo exige a permissão correspondente, que a conta de teste tem. A tela de Receitas ainda não mostra esse texto: a aba "Obs. Sistema" é um espaço vazio.

</dd></dl>

</details>

<details>
<summary><b>Contexto 24: Lista de Receitas da Loja (GET /prescriptions/search): Escopo, Filtros, Busca, Janela de 90 Dias e Contadores por Faceta (Issue backend#723/PR #749 e #750) — 18 testes</b></summary>

<dl><dd>

- 24.1. **Deve recusar sem token com 401, sem devolver nenhuma receita:** `GET /prescriptions/search` com `Authorization` vazio responde `401`, sem `items` nem `summary` no corpo.
- 24.2. **Deve manter o contrato de GET /prescriptions?filter= (200, items e pagination, sem summary):** `GET /prescriptions?filter=today` segue `200` com `items` e `pagination` e não ganhou `summary` (rota antiga inalterada, sem grant novo).
- 24.3. **Deve alinhar a capability can_list_recipes à rota (com a 145 responde 200, sem ela 403 PERMISSION_DENIED):** lê `can_list_recipes` de `GET /prescription-capabilities` (booleano) e confere que a rota responde `200` com `true` e `403 PERMISSION_DENIED` com `false`; a conta de teste só tem `true`, então o ramo `403` fica dormente.
- 24.4. **Deve devolver items, pagination e summary no formato da tela, com os padrões page 1 e per_page 20:** chaves exatas do payload, do item (10 campos) e do `summary` (7 contadores); `registered_at` em Instant/Z; paginação padrão 1/20; `total_pages` igual ao teto de total/20; human+animal igual ao total e soma dos 4 status igual ao total.
- 24.5. **Deve ordenar da emissão mais recente para a mais antiga por padrão e cortar a lista em 90 dias:** `registered_at` não crescente sem `sort` e com `sort=desc`; a última página (`per_page=100`) não tem receita com mais de 91 dias.
- 24.6. **Deve ordenar da mais antiga para a mais recente com sort=asc:** `sort=asc` deixa `registered_at` não decrescente; o 1º do asc não é mais novo que o 1º do padrão.
- 24.7. **Deve paginar com page e per_page (máximo 100) e recusar valores fora do limite com 422:** `per_page=5` nas páginas 1 e 2 sem repetir item, com `has_previous`; `per_page=100` aceito; `per_page=101`, `per_page=0` e `page=0` respondem `422` "Parâmetros de paginação inválidos.".
- 24.8. **Deve recusar type, status e sort fora do conjunto com 422 e a mensagem do parâmetro:** `type=plant` responde "Tipo inválido."; `status=pending`, "Status inválido."; `sort=newest`, "Ordenação inválida.".
- 24.9. **Deve aceitar from e to até 89 dias de diferença e recusar 90 dias, from depois de to e data inválida com 422 "Período inválido.":** 89 dias de diferença respondem `200`; 90 dias, `from` maior que `to` e data impossível respondem `422`; só `from` recorta a janela padrão e `summary.total` acompanha.
- 24.10. **Deve filtrar por type e contar só aquele tipo nos contadores de status, sem mexer em human, animal e total:** `type=animal` e `type=human`: `animal_id` preenchido só no animal; `pagination.total` igual a `summary[type]`; soma dos status igual a `summary[type]`; human+animal igual ao total.
- 24.11. **Deve filtrar por cada status e devolver só receitas daquele status, com pagination.total igual ao contador:** `open`, `awaiting_delivery`, `delivered` e `discarded`: todo item com o status filtrado; `pagination.total` igual a `summary[status]`; os tipos contam só o status; os contadores de status ignoram o filtro de status. A massa dos casos raros vem da janela padrão ou, sem ela, de blocos de 89 dias recuando até cerca de 1 ano; sem massa, o teste pula com o motivo.
- 24.12. **Deve combinar status e type nos contadores por faceta (cada grupo respeita o outro filtro e ignora o próprio):** `status=open` com `type=animal`: `pagination.total` igual a `summary.open` e a `summary.animal`; human conta as abertas de humanos (ignora o type); a soma dos status respeita o type (igual ao `animal` de `type=animal` sozinho). A massa dos casos raros vem da janela padrão ou, sem ela, de blocos de 89 dias recuando até cerca de 1 ano; sem massa, o teste pula com o motivo.
- 24.13. **Deve derivar o status da receita (descartada tem precedência, aberta é STATUS_MOV 0 e aguardando entrega é -1):** o 1º item de cada status consultado em `GET /prescriptions/:id`: `discarded_at` preenchido só na descartada; `status` 0 na aberta e -1 na aguardando entrega. A massa dos casos raros vem da janela padrão ou, sem ela, de blocos de 89 dias recuando até cerca de 1 ano; sem massa, o teste pula com o motivo.
- 24.14. **Deve buscar por q sem diferenciar maiúsculas nem acentos, em cliente, animal ou prescritor, e contar o total já com a busca:** uma palavra real do nome de cliente mais recente, buscada sem acento, com acento na 1ª vogal e em maiúsculas, dá o mesmo total; todo item casa em cliente, animal ou prescritor; `summary.total` igual a `pagination.total` e soma dos status igual ao total.
- 24.15. **Deve achar a receita pelo código exato em q (só dígitos) e não achar por pedaço do código:** `q=<código>` devolve só aquela receita; `q=<código sem o último dígito>` devolve total 0.
- 24.16. **Deve devolver 200 com lista vazia, páginas zeradas e contadores zerados quando a busca não acha nada:** `items: []`, `total` e `total_pages` em 0, `has_next` e `has_previous` falsos e os 7 contadores em 0.
- 24.17. **Deve listar só receitas da loja da sessão (store_id do detalhe igual ao da loja do token):** os 5 primeiros itens consultados em `GET /prescriptions/:id` trazem `store_id` igual à loja do token.
- 24.18. **Deve devolver client_id e client_name nulos juntos (nunca vazios) quando a receita não tem cliente:** `type=animal`: há receita sem cliente (massa) e, em todas, `client_id` e `client_name` são nulos juntos, sem nome em branco.

> 💡 Só API. A conta de teste tem o grant 145, então o `403 PERMISSION_DENIED` não é alcançável e o ramo fica dormente. A ausência de receita de outra loja só se prova com massa da loja 2: o teste de escopo confere apenas que as receitas listadas são da loja do token.

</dd></dl>

</details>

<details>
<summary><b>Contexto 25: Capabilities da Receita (can_update, can_finalize, can_cancel_finalization): a Mesma Regra em Todas as Respostas (Issue backend#716/PR #728) — 5 testes</b></summary>

<dl><dd>

- 25.1. **Deve devolver can_finalize false na receita sem fórmula e na receita com fórmula ainda não calculada, e o finalize recusa as duas com 422:** `GET` da receita criada pelo teste, sem fórmula e com fórmula não calculada, devolve `can_finalize: false`, e o `POST .../finalize` das duas responde `422`.
- 25.2. **Deve devolver can_finalize true na receita aberta com todas as fórmulas calculadas, e o finalize aceita:** `GET` da receita aberta calculada devolve `can_finalize: true` e o `POST .../finalize` responde `200` com `status: -1`.
- 25.3. **Deve devolver as 3 chaves iguais no PATCH, no calculate, no finalize e no cancel-finalization e no GET feito logo depois de cada um:** cada resposta de escrita traz o mesmo bloco que o `GET` seguinte, no mesmo estado, com os valores esperados de cada estado (pronta, finalizada e reaberta).
- 25.4. **Deve devolver can_cancel_finalization false na receita finalizada e entregue, achada na lista da loja:** a receita entregue vem de `GET /prescriptions/search?status=delivered` (sem ID fixo) e o detalhe devolve `status: -1`, `can_cancel_finalization: false` e `can_finalize: false`.
- 25.5. **Deve manter o can_update da resposta do finalize coerente com o PATCH da receita finalizada (capability x ação):** com `can_update` verdadeiro no finalize, o `PATCH` da receita finalizada responde `200`; com falso, recusa.

> 💡 Só API. A rota `validate-discount` não devolve o bloco `capabilities`. A conta de teste tem os grants de alterar receita finalizada, finalizar e finalizar com estoque insuficiente, então os ramos sem eles ficam dormentes; receita cancelada e controlado não autorizado não têm massa.

</dd></dl>

</details>

<details>
<summary><b>Contexto 26: PATCH da Fórmula só de Texto ou Data Mantém o Cálculo, só Campo do Cálculo Desmarca e needs_recalculate Nunca Vem com a Fórmula Calculada (Issue backend#717/PR #729) — 7 testes</b></summary>

<dl><dd>

- 26.1. **Nenhuma fórmula calculada das receitas pendentes deve vir com needs_recalculate: true:** leitura da 1ª página (40) de pendentes e do detalhe de cada receita; antes, `needs_recalculate` era derivado de `ALTERACAO_DT > CALCULO_DT` e a maioria das fórmulas calculadas saía com os dois `true`.
- 26.2. **Manter a fórmula calculada no PATCH só de posologia e a receita continuar finalizável:** receita temporária calculada; `PATCH { posology }` responde `200`, a posologia é gravada e a fórmula segue `calculated: true` com `needs_recalculate: false`; o `finalize` aceita e o `cancel-finalization` desfaz.
- 26.3. **Manter a fórmula calculada no PATCH só de rótulo, descrição, observações ou vencimento:** `label_text`, `label_description`, `label_observation`, `formula_observation` e `expiry_date`, um por vez, gravam o valor sem pedir recálculo.
- 26.4. **Desmarcar a fórmula e pedir recálculo no PATCH de campo do cálculo, e o finalize recusar até recalcular:** `qvd`, `multiplier` e `automatic_inclusion`, um por vez, deixam `calculated: false` e `needs_recalculate: true`; o `finalize` responde `422` e o `calculate` restaura.
- 26.5. **Desmarcar a fórmula no PATCH misto de texto e campo do cálculo:** `{ posology, qvd }` grava o texto e desmarca a fórmula; o recálculo restaura.
- 26.6. **Desmarcar a fórmula e pedir recálculo no PATCH de cada um dos demais campos do cálculo:** forma farmacêutica, tipo de medicamento, gotas, peso manual, peso, taxa técnica, valor extra, valor do tipo de medicamento e loja de baixa, esta até reenviada com o mesmo valor; o recálculo restaura a cada um.
- 26.7. **Manter a fórmula calculada no PATCH só de repetição, texto da repetição, retorno, entrega no laboratório, CID ou receituário ok.**

> 💡 Só API, numa receita temporária por rodada (receita não tem `DELETE`). A linha "descalculou" do histórico da fórmula é só de banco e o PATCH de posologia sem a permissão 680 exige uma conta sem o grant, então ficam sem teste. A tela de Receitas só edita posologia e rótulo em fórmula gravada, com o Gravar desabilitado, e por isso não há teste de front.

</dd></dl>

</details>

<details>
<summary><b>Contexto 27: Carrinho da Receita: Pré-condição, Vínculo a Carrinho Existente e Retirada (Issue backend#718/PR #730) — 7 testes</b></summary>

<dl><dd>

- 27.1. **Deve recusar com 422 o carrinho de uma receita aberta, com a mensagem do Delphi:** `POST .../cart` numa receita ainda aberta, sem body e com `cart_id`, responde `422` "Não é possível adicionar um carrinho em um orçamento.".
- 27.2. **Deve recusar com 422 o carrinho de uma receita paga, com o código do financeiro, achada na lista da loja:** a receita paga vem da lista (sem ID fixo) e a recusa traz "Movimento já foi pago. Código do financeiro: N.".
- 27.3. **Deve criar o carrinho da receita finalizada sem body e devolver o mesmo carrinho ao repetir, sem trocar o código:** a 1ª chamada devolve um `cart_id`; repetir sem body e com o próprio `cart_id` devolve o mesmo.
- 27.4. **Deve vincular a um carrinho existente, recusar o inexistente com 404 e a receita que já está em outro carrinho com 409:** `cart_id` inexistente responde "Carrinho não encontrado."; a receita entra no carrinho de outra (repetível) e, já dentro, recebe `409` ao tentar outro carrinho.
- 27.5. **Deve recusar com 422 o vínculo de uma receita da loja 2 a um carrinho da loja da sessão:** a recusa traz "A receita pertence a outra loja e não pode entrar neste carrinho.".
- 27.6. **Deve retirar a receita do carrinho com DELETE (204), repetir com 204 e liberar a receita para entrar em outro carrinho:** depois da retirada a receita que dava `409` entra no outro carrinho; repetir a retirada numa receita sem carrinho também responde `204`.
- 27.7. **Deve tirar can_link_cart do mapa de GET /prescription-capabilities (as rotas de carrinho não cobram grant):** o mapa de capabilities de receitas não traz mais a chave.

> 💡 Só API, com 3 receitas e 2 carrinhos novos por rodada (receita e carrinho não têm `DELETE`; a limpeza só retira a receita do carrinho). A retirada com link de pagamento aguardando, o `DELETE` em receita paga e a conta sem a permissão 23 ficam sem teste. A tela de Receitas não tem botão de carrinho, e por isso não há teste de front.

</dd></dl>

</details>

<details>
<summary><b>Contexto 28: Registro de Falta de Estoque (POST /stock-shortages): a Rota Existe e Recusa o que Não Grava (Issue backend#707, can_register_stock_shortage) — 3 testes</b></summary>

<dl><dd>

- 28.1. **Recusar com `401` o `POST /stock-shortages` sem token:** `Authorization` vazio responde `401 Unauthorized`.
- 28.2. **Recusar com `422` o `POST /stock-shortages` sem produto, o que também prova que a rota existe:** corpo vazio responde "O produto é obrigatório e deve ser válido.", e não `404`, sem detalhe interno na resposta.
- 28.3. **Recusar com `422` o `POST /stock-shortages` com produto inválido, sem gravar a falta:** `product_id` `-1` e `0` respondem a mesma mensagem.

> 💡 Só API, só os casos que não gravam: o registro de uma falta real grava na tabela de faltas e não há como desfazer pela API. O registro com produto válido e a recusa por falta do grant ficam sem teste, e o front ainda não tem a tela dessa ação.

</dd></dl>

</details>

<details>
<summary><b>Contexto 29: Vínculo da Receita com o Atendimento (attendance_id no POST e no PATCH): Destino Fechado, sem Atendente e Código Inválido; Incluir, Repetir, Trocar e Remover (Issue backend#760/PR #764) — 10 testes</b></summary>

<dl><dd>

- 29.1. **Recusar com `401` o `PATCH` da receita com `attendance_id` sem token:** `Authorization` vazio responde `401 Unauthorized`.
- 29.2. **Recusar com `409 ATTENDANCE_CLOSED` o `PATCH` que inclui a receita num atendimento finalizado, sem vincular:** a mensagem diz que atendimento finalizado ou descartado não aceita movimento e a receita continua sem vínculo e sem alteração. O atendimento finalizado é descoberto na listagem a cada rodada.
- 29.3. **Recusar com `409 ATTENDANCE_UNASSIGNED` o `PATCH` que inclui a receita num atendimento pendente sem atendente, sem vincular:** a mensagem pede para assumir o atendimento antes de incluir movimento. O destino é descoberto na fila; sem atendimento pendente sem atendente o teste pula com motivo.
- 29.4. **Recusar com `422` o `PATCH` com `attendance_id` zero, negativo, inexistente ou que não é número, com a mensagem de cada caso:** "Atendimento inválido.", "Atendimento não encontrado." e "O campo attendance_id deve ser um número inteiro.", com a receita intacta a cada recusa.
- 29.5. **Recusar com `409 ATTENDANCE_CLOSED` o `POST /prescriptions` com `attendance_id` de atendimento finalizado:** antes era aceito.
- 29.6. **Recusar com `409 ATTENDANCE_UNASSIGNED` o `POST /prescriptions` com `attendance_id` de atendimento pendente sem atendente:** a mesma mensagem do `PATCH`; pula com motivo se a fila não tiver um.

- 29.7. **Incluir a receita num atendimento aberto e com atendente pelo `PATCH`:** ela passa a aparecer no detalhe e na lista de orçamentos do atendimento.
- 29.8. **Repetir o `PATCH` com o mesmo atendimento:** o vínculo continua.
- 29.9. **Trocar o vínculo para outro atendimento aberto e com atendente:** a receita sai dos orçamentos da origem e entra nos do destino.
- 29.10. **Remover o vínculo com `attendance_id` nulo:** a receita sai do detalhe e dos orçamentos do atendimento.

> 💡 Só API, sem código de atendimento fixo: os destinos saem da listagem a cada rodada (o atendimento do celular padrão fica de fora) e um teste sem destino pula com o motivo. O `403` por falta de uma das três permissões e o log da alteração ficam sem teste: a conta tem as três permissões e o log não tem rota.

</dd></dl>

</details>

<details>
<summary><b>Contexto 30: Loja da Sessão Gravada na Criação da Receita, Nunca a Loja do Caminho (Issue backend#659) — 2 testes</b></summary>

<dl><dd>

- 30.1. **Gravar a loja da sessão como `store_id` da receita criada pela rota sem `/stores/:id`:** a resposta da criação e o detalhe relido trazem a loja do token (`store_code`).
- 30.2. **Gravar a loja da sessão, nunca a do caminho, ao criar a receita pela rota antiga com uma loja que não existe:** `POST /stores/999999999/prescriptions` grava a loja da sessão; quando a rota antiga for removida, o teste aceita o `404` sem receita criada.

> 💡 Só API, com paciente do `env.json` e prescritor descoberto na busca. A loja de alteração (`ALTERACAO_LJ`) não aparece na API e fica sem teste.

</dd></dl>

</details>

<details>
<summary><b>Contexto 31: Data de Retorno Exigida na Conclusão pela Loja (RETURN_DATE_REQUIRED) e Uso Contínuo Só Leitura na Fórmula (Issue backend#791) — 2 testes</b></summary>

<dl><dd>

- 31.1. **Deve recusar a conclusão com 422 RETURN_DATE_REQUIRED citando as fórmulas sem data de retorno, no plural e no singular, manter a receita aberta e a fórmula calculada, e concluir quando as duas têm a data:** a loja que exige a data de retorno só conclui receita com a data em toda fórmula calculada, como o Desktop.
- 31.2. **Deve manter continuous_use só leitura: derivado do produto no detalhe e recusado sozinho no PATCH da fórmula (Nenhum campo válido para atualização):** o uso contínuo vem do cadastro do produto.

> 💡 Uma receita temporária por rodada, com duas fórmulas calculadas sem data de retorno. Se a loja da sessão deixar de exigir a data, o teste da recusa pula com o motivo.

</dd></dl>

</details>

</dd></dl>

</details>
<br>

<details>
<summary><b>0-D — Automações, Fluxos e Campanhas (<code>0-D.backend-automacoes-fluxos-campanhas.cy.js</code>) — 29 testes em 6 contextos</b></summary>

<dl><dd>

> 💡 Separado do `0-A` em 2026-11-06: cada teste espera o ciclo de 30 s do motor de automações, então o spec roda num job próprio. Os contextos 1 a 5 eram os contextos 33 a 36 e 38 do `0-A`.

<details>
<summary><b>Contexto 1: Automações: Disparo pelo Motor no Cliente Novo e na Mudança de Status, uma Vez por Evento, com Escopo por Canal, Pausada e Ordem de Cadastro (Issue backend#740) — 9 testes</b></summary>

<dl><dd>

- 1.1. **Deve disparar no cliente novo a automação ativa de todos os canais, com o log do evento (gatilho, cliente, sem atendimento) e run_count e last_run_at atualizados:** o motor confere os eventos a cada 30 s e registra a execução no histórico da automação.
- 1.2. **Deve reivindicar uma vez só o mesmo evento, mesmo depois de a fonte relê-lo no ciclo seguinte (CHAVE_EVENTO única no log):** a fonte relê o ciclo anterior de propósito, e o log único impede a segunda execução.
- 1.3. **Não deve disparar no cliente novo, que não tem canal, a automação restrita a um canal:** evento sem canal só dispara automação de todos os canais.
- 1.4. **Não deve disparar a automação pausada, nem contar execução nela:** a pausa é o freio do usuário.
- 1.5. **Deve executar, no mesmo evento, as automações na ordem de cadastro:** a primeira cadastrada é reivindicada antes.
- 1.6. **Deve disparar a automação de mudança de status sem filtro em toda mudança real de status ou de substatus do atendimento:** um registro por mudança.
- 1.7. **Deve disparar a automação de status X só quando o status passa a ser X, e não quando só o substatus muda com o status já em X:** o filtro olha o valor depois da mudança.
- 1.8. **Deve disparar a automação de substatus Y só quando o substatus passa a ser Y, e a de status e substatus só quando os dois batem depois da mudança:** mudar o status pai limpa o substatus.
- 1.9. **Não deve disparar, no cliente cadastrado antes da ativação, a automação ativada depois, e deve disparar no cliente cadastrado em seguida (Issue backend#788):** ativar uma automação não reprocessa o que aconteceu antes.

> 💡 O motor não tem rota própria: o teste cria o evento (um cliente novo e três mudanças num atendimento Em andamento do próprio operador, restaurado no fim) e lê o histórico das automações. As automações da rodada só têm um passo de condição, que não envia mensagem; os gatilhos de mensagem recebida, atribuição e abertura de atendimento ficam sem teste, porque só disparam com WhatsApp real.

</dd></dl>

</details>

<details>
<summary><b>Contexto 2: Automações: Execução dos Passos pelo Motor — Substatus, Condição por Status e por Horário, Atribuição, Encerramento, Janela de 24h Fechada e Passo que Falha sem Parar o Run (Issue backend#741) — 7 testes</b></summary>

<dl><dd>

- 2.1. **Deve rodar todos os passos depois de um que falha e fechar o log do evento como partial, com path, tipo, status, detalhe e horário de cada passo:** um passo com falha não interrompe a execução.
- 2.2. **Deve falhar o send_message com a janela de 24h fechada (service_window_closed) sem gravar a mensagem no atendimento:** fora da janela, nada é enviado.
- 2.3. **Deve aplicar o substatus, recusar o de outro status (custom_status_mismatch) sem mover o status e limpar com custom_status_id null:** o substatus precisa pertencer ao status atual.
- 2.4. **Deve escolher o ramo da condição de horário pelo fuso de São Paulo, informado ou padrão, e pelo dia da semana:** o horário é o da farmácia, não o do servidor.
- 2.5. **Deve falhar a atribuição a um atendente fora do grupo (agent_not_in_group) sem trocar o dono nem o grupo do atendimento:** só membros do grupo recebem o atendimento.
- 2.6. **Deve falhar a atribuição no atendimento encerrado (attendance_closed) e contar como sucesso, sem mudar nada, o encerramento para o status que ele já tem:** atendimento encerrado não é reatribuído.
- 2.7. **Não deve gerar evento de mudança de status a escrita do próprio motor (anti-loop), disparando a automação sem filtro só nas mudanças feitas pela API (Issue backend#788):** uma automação não dispara outra em cadeia.

> 💡 Massa própria: um atendimento Finalizado do operador, com a janela de 24h vencida, é reaberto, recebe um substatus exclusivo dos testes que dispara as automações da rodada e volta a Finalizado no fim. Nenhuma mensagem chega ao WhatsApp. A tela de Automações (`8.automacoes`, contexto 7) usa a mesma receita com outro atendimento e outro gatilho, para as duas suítes rodarem em paralelo.

</dd></dl>

</details>

<details>
<summary><b>Contexto 3: Automações: Fila do Passo wait — Suspende e Retoma na Mesma Execução, wait Dentro de Ramo, Pausar e Salvar Cancelam e um Pendente por Cliente (Issue backend#742) — 4 testes</b></summary>

<dl><dd>

- 3.1. **Deve suspender a execução no wait com o log waiting e retomá-la depois do prazo na mesma linha do log, como success, com o passo seguinte acrescentado:** a espera não abre uma execução nova.
- 3.2. **Deve suspender a execução inteira no wait dentro de um ramo e, na retomada, terminar o ramo antes de seguir para a raiz:** a raiz não roda enquanto o ramo espera.
- 3.3. **Deve cancelar a espera ao pausar a automação e ao salvar os passos, levando o log a partial com o motivo, sem retomar nem tocar nos passos:** a espera cancelada não volta a rodar.
- 3.4. **Deve descartar o segundo disparo para o mesmo cliente durante a espera (skipped, already_waiting) sem estacionar outro wait:** um cliente tem uma espera pendente por automação.

> 💡 Massa própria: automações só com espera e condição de horário, que não enviam nada, um cliente criado por rodada e o atendimento Em andamento do operador, que volta ao substatus original no fim. A retomada sai no ciclo de 30 s do motor, cerca de um minuto depois da espera de 1 minuto.

</dd></dl>

</details>

<details>
<summary><b>Contexto 4: Automações: Passo send_webhook — Credencial e Dado de Paciente Recusados no Save, URL Interna ou Dinâmica Recusada na Ativação e Destino Interno Bloqueado pelo DNS na Execução (Issue backend#745) — 4 testes</b></summary>

<dl><dd>

- 4.1. **Deve recusar em qualquer save, rascunho pausado incluído, a credencial na URL e o placeholder fora de client.id, attendance.id e store.id, e aceitar os ids permitidos:** só ids saem da farmácia, e senha não fica gravada na URL.
- 4.2. **Deve aceitar no rascunho e recusar na ativação a URL inválida ou não https, o host interno literal ou nome local, o host ou a porta dinâmicos e o corpo que não é JSON, e ativar a URL https pública com corpo vazio:** o rascunho é livre, mas nada aponta para a rede interna quando ativa.
- 4.3. **Deve bloquear na execução o destino cujo nome resolve para IP interno (webhook_blocked), falhar o nome que não resolve (webhook_unreachable) e o status 404 (webhook_http_404), seguindo os passos até o fim do run:** a barreira contra SSRF está na conexão, depois do DNS.
- 4.4. **Deve gravar no passo send_webhook só url e body_template, descartando headers e qualquer outra chave na raiz, no ramo e no PATCH, e recusar url ou body_template que não seja texto (Issue backend#745, PR #870):** nenhum header de autenticação fica gravado nem aparece para os editores.

> 💡 Nenhum dado sai para terceiros: os destinos da execução são nomes públicos que resolvem para endereço interno (só a consulta de DNS), um nome que não existe e a própria API da dev. O cliente criado para disparar a automação é inativado no fim.

</dd></dl>

</details>

<details>
<summary><b>Contexto 5: Automações: Gatilho Agendado (time_based) pelo Relógio do Motor — Disparo no Horário, uma Vez por Horário, Fuso, Dias da Semana e Horário que Já Passou (Issue backend#746) — 4 testes</b></summary>

<dl><dd>

- 5.1. **Deve disparar no horário pelo fuso padrão de São Paulo, com o log do gatilho sem cliente nem atendimento, e uma vez só no mesmo horário depois de vários ciclos:** o mesmo horário não dispara duas vezes.
- 5.2. **Deve disparar no horário do fuso informado e não disparar o mesmo HH:mm lido no fuso padrão:** o horário é lido no fuso da automação.
- 5.3. **Deve disparar com o dia de hoje na lista de dias e não disparar com outro dia:** os dias da semana restringem o disparo.
- 5.4. **Não deve disparar a automação criada depois do horário, ainda dentro dos 10 minutos, nem a pausada:** o horário que já passou não é recuperado.

> 💡 Massa própria: automações só com a condição de horário, que não enviam nada, com o horário calculado a partir do momento da rodada. O relógio do motor confere a cada 30 s, então o context espera o horário, o disparo e mais um ciclo (~2 min).

</dd></dl>

</details>

<details>
<summary><b>Contexto 6: Automações: Condição de Horário com Janela que Passa da Meia-Noite Pertence ao Dia em que Abriu (Issue backend#735, A6) — 1 teste</b></summary>

<dl><dd>

- 6.1. **Deve tomar o ramo sim na janela que passa da meia-noite quando o dia em que ela abriu está em days, e o ramo não quando só o dia anterior está:** a janela noturna conta para o dia em que começou.

> 💡 A janela é calculada a partir do momento da rodada (abre de 1 a 2 h antes e dura 23 h), então o teste vale em qualquer horário.

</dd></dl>

</details>

</dd></dl>

</details>

</dd></dl>

</details>


---

### 1. Permissões e Validação de Acessos (`cypress/e2e/1.permissoes.cy.js`) — 45 Testes

A suíte valida a matriz de permissões do operador com **duplo grau de validação** (Contrato de Payload `can_*` via API real/`sessionStorage` **E** Interface de Usuário no front). Nomenclatura dos testes: `[código legado - capability] - nome`; sem código legado confirmado, só `[capability] - nome` (nunca um número fabricado). Cobre a Permissão 655 (`can_view_pending_attendance`), a ação de Assumir Atendimento sem atendente vinculado (PATCH com `target_attendant_id`, conflito 409 `ATTENDANCE_ALREADY_ASSIGNED`), a Permissão 577 (`can_create_attendance_custom_status`, gate do "+ Adicionar personalizado" de substatus) e a Permissão 540 (`can_view_occupied_attendance`, bloqueio 403 `PERMISSION_DENIED` ao reabrir via "Iniciar Atendimento" um atendimento ocupado por outro atendente):

<details>
<summary><b>🔍 1.permissoes.cy.js — 45 testes em 4 contextos (clique para expandir)</b></summary>

<dl><dd>

<br>

<details>
<summary><b>Contexto 1: Atendimentos - Permissões — 26 testes, híbrido</b></summary>

<dl><dd>

- 1.1. **[418 - can_access_attendance_module] Ter acesso ao módulo de Atendimentos (Menu e Acesso Direto):** Acesso ao módulo via menu e URL direta com grant 418.
- 1.2. **[636 - can_create_attendance] Conseguir iniciar um atendimento pelo WhatsApp:** Botão de novo atendimento habilitado com grant 636.
- 1.3. **[540 - can_view_occupied_attendance] Visualizar atendimentos de outras pessoas na fila:** Visibilidade de atendimentos de terceiros com grant 540.
- 1.4. **[414 - can_mark_completed] Ter a opção de Concluir atendimento (Menu da Fila e Menu Interno):** Opção Concluir visível com grant 414.
- 1.5. **[475 - can_mark_discarded] Ter a opção de Descartar atendimento (Menu da Fila e Menu Interno):** Opção Descartar visível com grant 475.
- 1.6. **[557 - can_transfer_assigned_attendance] Ter a opção de Transferir em atendimentos de QUALQUER funcionário:** Transferência de atendimentos atribuídos com grant 557.
- 1.7. **[418 - can_list_group_agents] Listar os atendentes do grupo na modal de transferência só com a permissão concedida (backend#584, Issue backend#558):** código legado corrigido de 471 para 418; gate client-side confirmado no bundle real — sem a flag, zero chamada de rede e aviso direto "Você não tem permissão para listar atendentes deste grupo.".
- 1.8. **[649 - can_transfer_pending_attendance] Ter a opção de Transferir em atendimentos pendentes sem atendente vinculado:** Transferência de atendimentos pendentes com grant 649.
- 1.9. **[650 - can_change_default_customer] Exibir a opção "Vincular cliente" quando o atendimento não tem cliente vinculado (Issue #440/#441):** RBAC bidirecional; o gate lê a rota separada `GET /attendances/:id/capabilities`, não o campo embutido no detalhe.
- 1.10. **[046 - can_create_client] Exibir o botão "Cadastrar novo" no diálogo "Vincular cliente" só quando a capability de criar cliente estiver concedida (Issue front#497, PR #499):** mesma capability/código já usados pelo "Novo cliente" da tela `/clientes` (Contexto 2, #22) — aqui gateia o mesmo componente reaproveitado dentro do diálogo "Vincular cliente"; "Vincular cliente" continua funcionando sem a capability.
- 1.11. **[562 - can_mark_finished] Exibir opções de reabertura em atendimento finalizado (STATUS = 3):** Reabertura de atendimento finalizado com grant 562.
- 1.12. **[562 - can_mark_finished] Exibir opções de reabertura em atendimento descartado (STATUS = 4) (PR #442 / PR #486):** Reabertura de atendimento descartado com grant 562.
- 1.13. **[554 - can_change_attendant_status] Permitir alterar status do atendente:** Alternância de status operacional com grant 554.
- 1.14. **[577 - can_create_attendance_custom_status] Exibir "+ Adicionar personalizado" apenas quando concedida (backend#499/front#396):** movido de `5.atendimentos.cy.js`; causa raiz do botão resolvida — `can_create_attendance_custom_status` é capability de loja (`/attendance-capabilities`), não de item, e o botão vive dentro da sublista expandida do status pai (`chat-header-menu-custom-toggle-{key}` → `chat-header-menu-custom-add-{key}`).
- 1.15. **[655 - can_view_pending_attendance] Pré-visualizar mensagens mantendo o atendimento sem atendente até o clique em Assumir (backend#528/front#434):** Preview liberado com `can_view_pending_attendance: true`, sem atribuição automática.
- 1.16. **[655 - can_view_pending_attendance] Não buscar mensagens/arquivos/orçamentos/links e exibir o cartão de bloqueio quando revogada:** Prova pela ausência de chamada de rede (guard client-side).
- 1.17. **[can_take_attendance] Ocultar o botão Assumir e explicar a ausência de permissão quando o atendente não é do grupo, ou o atendimento não tem grupo (Issue front#505, PR #511):** botão não existe sem `can_take_attendance`, mesmo com a 649 concedida (649 só vale para transferir); "Você também não pode assumir este atendimento." some sozinho, nunca fica desabilitado.
- 1.18. **[649 - can_transfer_pending_attendance] Assumir com sucesso um atendimento sem atendente vinculado:** `PATCH` com `target_attendant_id`, sem `channel_group_id`; libera mensagens e envio.
- 1.19. **[649 - can_transfer_pending_attendance] Tratar o conflito de concorrência (409 `ATTENDANCE_ALREADY_ASSIGNED`):** Recarrega o detalhe refletindo o dono real (o concorrente).
- 1.20. **[can_take_attendance] Assumir mesmo sem a 649, sendo membro do grupo (Issue front#505, PR #511):** `canAssume` passou a ler `can_take_attendance`; a 649 não substitui ser do grupo.
- 1.21. **[can_take_attendance] Rejeitar com 403 `ATTENDANCE_GROUP_REQUIRED` quando o atendente deixa de pertencer ao grupo entre a carga da tela e o clique (Issue front#505, PR #511):** `ATTENDANCE_GROUP_MISMATCH` (backend#561, fechada sem merge) nunca existiu na API real.
- 1.22. **[can_take_attendance] Rejeitar com 409 `ATTENDANCE_NOT_PENDING` quando o atendimento deixa de estar Pendente entre a carga da tela e o clique (Issue front#505, PR #511):** mesmo padrão do #19, para o código de "não está mais pendente".
- 1.23. **[Envio Bloqueado Sem Atendente] Ocultar o campo de mensagem e tratar 409 `ATTENDANCE_UNASSIGNED`:** Envio sempre bloqueado sem atendente, com ou sem 655.
- 1.24. **[Fila] Exibir "Assuma para ver" quando `last_message.body` vier `null`:** Contrato degradado da fila sem a Permissão 655.
- 1.25. **[046 - can_update_client] Permitir editar a ficha e exibir "Salvar dados" só quando a capability estiver concedida (drawer "Dados do Cliente" em Atendimentos):** mesma capability embutida `can_update_client` (`GET /clients/:id`) já coberta pelo `#2.2` na ficha standalone, agora no drawer de Atendimentos — concedida, campos editáveis e botão presente; revogada, campos desabilitados e o botão some do DOM por completo.
- 1.26. **[540 - can_view_occupied_attendance] Exibir o cartão "Permissão negada" (403 PERMISSION_DENIED) ao reabrir via "Iniciar Atendimento" um atendimento ocupado por outro atendente, quando revogada:** reabrir pelo redirecionamento de "Iniciar Atendimento" um número cujo atendimento já está "Em andamento" com OUTRO atendente — sem a 540, `GET /attendances/:id` responde `403 PERMISSION_DENIED` e o front bloqueia o conteúdo com um estado dedicado (ícone de cadeado), sem vazar mensagens/anexos.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 2: Clientes - Permissões — 9 testes, 100% mockado</b></summary>

<dl><dd>

O código legado **046** (CAD 0046) já está confirmado (`0-A/0-B/0-C.backend-*.cy.js` #88) como decomposto em 3 das 18 capabilities de `GET /client-capabilities` — `can_create_client`/`can_update_client`/`can_deactivate_client`. As outras 5 não têm código legado confirmado em nenhuma fonte disponível (a referência do operador só nomeia mais 2 códigos de CUSTOMER_DOMAIN com capability — 650, já coberto no Contexto 1 acima, e 658, do domínio Atendimento) — por isso só #22-24 citam "046":

- 2.1. **[046 - can_create_client] Exibir o botão "Novo cliente" só quando a capability de loja estiver concedida.**
- 2.2. **[046 - can_update_client] Permitir editar a ficha e exibir "Salvar dados" só quando a capability estiver concedida.**
- 2.3. **[046 - can_deactivate_client] Permitir alternar o cliente para inativo só quando a capability estiver concedida.**
- 2.4. **[026 - can_change_debt_status] Permitir alternar "Em débito" só quando a capability estiver concedida.**
- 2.5. **[027 - can_change_client_name] Permitir editar o campo Nome só quando a capability estiver concedida.**
- 2.6. **[492 - can_change_discount_type] Permitir editar o tipo de desconto só quando a capability estiver concedida.**
- 2.7. **[067 - can_change_discount_percentage] Permitir editar o percentual de desconto só quando a capability estiver concedida.**
- 2.8. **[487 - can_change_free_delivery] Permitir alternar "Entrega grátis" só quando a capability estiver concedida.**
- 2.9. **[341 - can_change_label_name] Permitir editar o Nome fantasia da pessoa jurídica só quando a capability estiver concedida (Issue backend#606/#615):** a Razão Social segue a 027 e continua editável; na pessoa física a 341 não trava o Nome.

</dd></dl>

</details>

<details>
<summary><b>Contexto 3: Receitas - Permissões (Issue backend#657/PR #706 e front#570/PR #592) — 7 testes, híbrido em API real</b></summary>

<dl><dd>

- 3.1. **[621 - can_calculate_out_of_range_dosage] Calcular a fórmula com dose fora do intervalo e mostrar o aviso da dose só quando a capability estiver concedida:** com o grant, o Calcular real abre o diálogo com "<produto> com quantidade acima do intervalo cadastrado."; sem ele (capability `false` e recusa 403 forçada), a tela mostra só "Você não tem permissão para esta ação", sem a dose.

- 3.2. **[can_update_formula] Bloquear o Múltiplo e o QVD da fórmula gravada só quando a capability da fórmula estiver revogada:** com `can_update_formula: true` os dois campos ficam editáveis; com a capability forçada em `false` no detalhe ficam desabilitados e somente leitura (antes ignoravam a capability).
- 3.3. **[231 - can_update_other_employee_process] Mostrar o Editar do processo do próprio operador sempre e o de outro funcionário ou sem funcionário só com a capability:** com a capability o Editar aparece nos três processos; sem ela, só no do operador (o funcionário do processo é comparado ao `user_id` do token).
- 3.4. **[capabilities vazias] Operar fail-closed:** sem nenhuma chave nas capabilities da conta, o convênio fica desabilitado e a aba Rastreabilidade fica travada com o aviso de falta de permissão, sem tabela nem Editar; com as capabilities reais continua livre.
- 3.5. **[capabilities indisponíveis] Manter o convênio desabilitado e a aba Rastreabilidade sem painel quando a rota das capabilities falha (404 e 500):** a aba não mostra o aviso de permissão, porque rota fora do ar não é falta de permissão.
- 3.6. **[can_update_formula] Deixar o Múltiplo e o QVD da fórmula nova editáveis mesmo com as fórmulas gravadas bloqueadas:** só a fórmula que o Gravar vai criar (acrescentada com a seta ↑) fica livre; a fórmula gravada segue travada pela capability.
- 3.7. **[595 - can_update_formula_with_financial] Travar a fórmula da receita vendida, com o aviso da permissão, só quando a capability estiver revogada (Issue front#397):** quem não tem a 595 vê "Receita já vendida" e não altera a fórmula; a receita não vendida segue editável.

> 💡 Roda numa receita própria, em API real (receita não tem exclusão). A conta de teste tem o grant, então a recusa é simulada; a tela não mostra a mensagem do backend nem pede autorização. As capabilities e os processos adulterados entram por resposta estática; o diálogo de edição do processo e as demais capabilities de fórmula e conta sem efeito na tela não têm teste.

</dd></dl>

</details>

<details>
<summary><b>Contexto 4: Automações - Permissões (Issue front#605/PR #604) — 3 testes, 100% mockado</b></summary>

<dl><dd>

- 4.1. **[635 - can_create] Mostrar "Criar automação" e liberar o Duplicar só quando a capability estiver concedida:** sem ela, o botão e o ladrilho da grade somem e o Duplicar trava com o motivo, sem chamar o servidor.
- 4.2. **[635 - can_edit] Liberar o Editar, o switch do cartão e o construtor só quando a capability estiver concedida, e abrir o construtor só-leitura sem ela:** sem ela, Editar e switch travam com o motivo e o construtor aberto pelo nome fica sem Salvar e com os campos desabilitados.
- 4.3. **[635 - can_delete] Liberar o Excluir do cartão e o menu "Mais ações" do construtor só quando a capability estiver concedida:** sem ela, o Excluir trava com o motivo e o construtor fica sem "Mais ações".

</dd></dl>

</details>
<br>

</dd></dl>

</details>

---

### 2. Tela de Login (`cypress/e2e/2.login.cy.js`) — 25 Testes

A suíte da tela de login abrange **28 blocos `it()` estáticos** (cobrindo 31 cenários em runtime — 2 blocos usam `forEach`, `AGENTS.md` `[R-CONTA]`), cobrindo autenticação, validações de entrada, máscaras, regras de recuperação, o aviso de sessão expirada e a falha transitória na restauração de sessão no boot:

<details>
<summary><b>🔍 2.login.cy.js — 25 testes em 4 contextos (clique para expandir)</b></summary>

<dl><dd>

<br>

<details>
<summary><b>Contexto 1: Autenticação, Validações de Formulário e Navegação — 11 testes</b></summary>

<dl><dd>

- 1.1. **Realizar login com credenciais válidas:** Login com sucesso; redirecionamento para Central.
- 1.2. **Exibir mensagem de erro ao tentar login com CNPJ inválido:** Validação de CNPJ inexistente.
- 1.3. **Exibir mensagem de erro ao tentar login com senha inválida:** Mensagem de erro para senha incorreta.
- 1.4. **Exibir mensagem de erro ao tentar login com usuário inválido:** Mensagem de erro para código de usuário incorreto.
- 1.5. **Exibir validações para todos os campos ao submeter formulário vazio:** Validações de campos obrigatórios no submit vazio.
- 1.6. **Aplicar a máscara de CNPJ automaticamente ao digitar apenas números:** Máscara `XX.XXX.XXX/XXXX-XX` aplicada no campo CNPJ.
- 1.7. **Alternar a visibilidade da senha ao clicar no ícone de olho:** Toggle de `type` password/text no campo senha.
- 1.8. **Impedir a digitação de letras e caracteres especiais no campo de usuário:** Filtro de input numérico no campo usuário.
- 1.9. **Formatar o CNPJ aceitando letras/números e bloqueando caracteres especiais (Formato Alfanumérico):** Máscara alfanumérica do CNPJ.
- 1.10. **Persistir o valor do CNPJ ao marcar a opção "Salvar CNPJ":** Persistência em `localStorage` do CNPJ salvo.
- 1.11. **Exibir todos os elementos principais do formulário de login ao carregar a tela:** CNPJ, Usuário, Senha, botão de entrar, "mostrar senha", checkbox+label "Salvar CNPJ".

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 2: Validação de Limite Máximo de Caracteres — 3 testes</b></summary>

<dl><dd>

- 2.1. **Limitar o campo de CNPJ em 18 caracteres (Máscara):** `maxLength` do campo CNPJ.
- 2.2. **Limitar a quantidade de caracteres no campo de Usuário em 10 caracteres:** `maxLength` do campo Usuário.
- 2.3. **Limitar a quantidade de caracteres no campo de Senha em 100 caracteres:** `maxLength` do campo Senha.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 3: Sessão Expirada (401 global) — PR #477, 7 testes, híbrido</b></summary>

<dl><dd>

- 3.1. **Exibir "Sessão expirada. Faça login novamente." e redirecionar para /login ao receber 401 numa requisição autenticada:** Corrompe o token em `sessionStorage` e dispara uma requisição real em uso (sem reload) — aviso aparece e a SPA redireciona.
- 3.2. **Ocultar o aviso e exibir "Campos obrigatórios" ao tentar entrar com os campos vazios:** O dismiss do aviso é síncrono ao clique em "Entrar", antes de qualquer validação.
- 3.3. **Não reexibir o aviso durante o fluxo de credenciais inválidas:** O aviso não volta em nenhum momento, nem durante o carregamento do erro de credenciais.
- 3.4. **Não exibir o aviso ao sair pelo menu da conta:** Logout explícito nunca passa pelo handler global de 401.
- 3.5. **Manter o aviso ao recarregar a página com o token inválido (Issue cypress#017):** corrompe o token via `onBeforeLoad` do próprio `cy.visit('/')`, antes de qualquer código do app rodar — elimina a corrida que existia no teste (não no produto) entre corromper o token e o `cy.reload()`, com requisições autenticadas do dashboard ainda em voo decidindo o resultado. F5 com token inválido sempre mostra o aviso e redireciona para `/login`.
- 3.6. **`GET /resources` só dispara após o `/users/me` responder com sucesso (Issue front#493/PR #513):** antes, o boot lia loja/farmácia de um token ainda não validado e disparava os dois pedidos em paralelo — suspeito de agravar a instabilidade de 5-20s só no Chrome relatada na issue original (o dev não reproduziu a lentidão em si: `/users/me` responde em ~210ms). Com token inválido, `/resources` nunca deveria disparar.

> 💡 Roda em API real e mock: o gatilho corrompe `pharmacie_access_token` em `sessionStorage` (rejeitado de verdade pelo backend real); em mock, os testes 16-19 forçam 1 requisição real 401 via troca do filtro de período do dashboard.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 4: Falha Transitória na Restauração de Sessão (Issue front#474, PR #476) — 5 testes estáticos (8 cenários em runtime), 100% mockado</b></summary>

<dl><dd>

- 4.1. **Falha transitória no `GET /users/me` do boot** (1 bloco `it()` com `forEach` sobre 3 cenários, `AGENTS.md` `[R-CONTA]`): rede instável (`forceNetworkError`), timeout acima do prazo interno do front (15s) e 5xx do servidor — nos três, painel `panel-session-restore-error` ("Não foi possível validar sua sessão" / "Sua sessão continua ativa."), sessão e URL preservadas.
- 4.2. **[Comportamento antigo mantido] 403/404 no `/users/me`** (1 bloco `it()` com `forEach` sobre 2 cenários): limpa a sessão e vai para `/login`, sem o painel novo, nos dois status.
- 4.3. **"Tentar novamente" depois que a rede volta:** `button-session-restore-retry` — entra direto no app, sem passar pelo login.
- 4.4. **Reconexão automática sem clique:** evento `online` do navegador com a tela de erro aberta — entra sozinho.
- 4.5. **"Sair" na tela de erro:** `button-session-restore-logout` → `/login`.

> 💡 Contexto blindado (`AGENTS.md [R-BLIND]`): forçar rede/timeout/5xx determinísticos no `/users/me` não é reproduzível contra a API real. Testids confirmados via `elements-inventory.json` + snapshot DOM real antes de escrever. Homologado pelo operador, `.only` removido.

</dd></dl>

</details>
<br>

</dd></dl>

</details>

---

### 3. Central (`cypress/e2e/3.central.cy.js`) — 17 Testes

A suíte de testes E2E do módulo **Central** valida dashboards, temas, filtros, navegação e encerramento de sessão:

<details>
<summary><b>🔍 3.central.cy.js — 17 testes em 7 contextos (clique para expandir)</b></summary>

<dl><dd>

<br>

<details>
<summary><b>Contexto 1: Estrutura Visual e Elementos Principais — 2 testes, híbrido</b></summary>

<dl><dd>

- 1.1. **Carregar o cabeçalho, blocos de visão geral e botão de novo atendimento:** Renderização do header, cards de visão geral e botão CTA.
- 1.2. **Exibir os quadros de acompanhamento das filas de atendimento:** Colunas de filas de status com contadores.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 2: Header, Menu Lateral e Tema — 2 testes, híbrido</b></summary>

<dl><dd>

- 2.1. **Recolher e expandir o menu lateral ao clicar no botão de alternância:** Sidebar collapse/expand com toggle.
- 2.2. **Alternar entre o tema claro e escuro ao clicar no botão de tema:** Alternância light/dark e persistência de classe.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 3: Links do Rodapé — 1 teste, híbrido</b></summary>

<dl><dd>

- 3.1. **Validar se os links de Termos e Privacidade estão visíveis e direcionam para a política:** Links do footer apontam para URLs corretas.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 4: Ações Rápidas e Filtro de Período — 7 testes, híbrido</b></summary>

<dl><dd>

- 4.1. **Abrir o modal de novo atendimento ao clicar no botão do topo:** Modal de novo atendimento abre pelo botão CTA.
- 4.2. **Exibir o mês e ano atuais como padrão no botão do filtro:** Filtro de data exibe mês/ano corrente.
- 4.3. **Exibir o mesmo intervalo de datas padrão do filtro que a tela de Atendimentos:** Paridade de intervalo padrão entre Central e Atendimentos.
- 4.4. **Abrir o popover e exibir todos os controles do filtro:** Popover do filtro com inputs de data e botões.
- 4.5. **Alterar o intervalo de datas digitando um período válido e atualizar o dashboard de acordo com a API:** Filtro funcional dispara requisição com período.
- 4.6. **Desabilitar o botão Aplicar ao selecionar uma data no futuro:** Validação de data futura desabilita submit.
- 4.7. **Fechar o popover do filtro de data ao pressionar a tecla ESC:** Tecla ESC fecha o popover.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 5: Integração com API, Mocks e Dados — 3 testes, híbrido</b></summary>

<dl><dd>

- 5.1. **Exibir os valores exatos nos cards de Orçamentos de acordo com a API:** Dados dos cards de orçamento match com payload API.
- 5.2. **Carregar e renderizar os cards de atendimento nas colunas conforme a API:** Cards renderizados consistentes com dados da API.
- 5.3. **Validar se as métricas da Visão Geral exibidas na tela correspondem ao payload real da API:** Métricas de visão geral coincidem com endpoint.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 6: Navegação das Colunas para Filas Correspondentes — 1 teste, híbrido</b></summary>

<dl><dd>

- 6.1. **Clicar em "Ir para fila" da coluna e direcionar para a aba correspondente (parametrizado):** Navegação de cada coluna para sua fila respectiva.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 7: Encerramento de Sessão — 1 teste, híbrido</b></summary>

<dl><dd>

- 7.1. **Deslogar o usuário com sucesso ao clicar em "Sair" no menu de perfil:** Logout via menu; limpa sessão e redireciona para login.

</dd></dl>

</details>
<br>

</dd></dl>

</details>

---

### 4. Iniciar Atendimento (`cypress/e2e/4.iniciar-atendimento.cy.js`) — 19 Testes

A suíte foca no comportamento do modal de inicialização de atendimentos WhatsApp, com validação dinâmica de payloads, mocks de integração e otimização de busca (debounce/race condition):

<details>
<summary><b>🔍 4.iniciar-atendimento.cy.js — 19 testes em 7 contextos (clique para expandir)</b></summary>

<dl><dd>

<br>

<details>
<summary><b>Contexto 1: Estrutura Visual e Ações Iniciais do Modal — 3 testes, híbrido</b></summary>

<dl><dd>

- 1.1. **Limpar todos os campos ao clicar no botão Limpar:** Botão Limpar reseta canal, celular, cliente e mensagem.
- 1.2. **Fechar o modal ao clicar no botão Fechar:** Modal fecha sem submeter dados.
- 1.3. **Exibir todos os elementos principais do modal ao abrir:** título, Canal, Cliente, Celular e os botões Limpar/Fechar/X/Enviar mensagem — "Grupo" fica de fora por só renderizar depois que um canal é selecionado (cascata).

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 2: Comportamento por Tipo de Canal (Oficial vs. Não Oficial) — 2 testes, híbrido</b></summary>

<dl><dd>

- 2.1. **Carregar a seção de Templates WABA ao selecionar um canal do tipo WhatsApp Oficial:** Seção de templates carregada para canal oficial.
- 2.2. **Liberar o campo de mensagem para digitação livre e remover a legenda de WhatsApp Oficial ao selecionar canal WhatsApp Não Oficial:** Campo de texto livre para canal não oficial.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 3: Validações do Campo Celular, Mensagem Padrão e Busca de Cliente — 3 testes, híbrido</b></summary>

<dl><dd>

- 3.1. **Aceitar DDD + número e rejeitar letras no campo Celular (Máscara):** Máscara de celular aceita apenas números.
- 3.2. **Injetar o conteúdo da mensagem padrão na área de texto ao selecioná-la no painel:** Mensagem padrão preenche o compositor.
- 3.3. **Permitir buscar e selecionar um cliente cadastrado da base:** Busca + seleção de cliente da lista.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 4: Otimização da Busca de Clientes (Debounce, Limite Mínimo e Prevenção de Race Condition) — 3 testes, 100% mockado</b></summary>

<dl><dd>

- 4.1. **Exigir ao menos 3 caracteres no campo Cliente e não disparar requisição HTTP para termos curtos:** Mínimo de 3 caracteres para busca.
- 4.2. **Aplicar debounce de 300ms e consolidar uma única requisição HTTP com o termo final digitado:** Debounce de 300ms consolidando requisição.
- 4.3. **Exibir o indicador "Buscando clientes..." e nunca renderizar registros da busca anterior enquanto a nova consulta estiver em voo:** Loading state e prevenção de race condition.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 5: Regras do Formulário, Templates WABA e Redirecionamento da API — 4 testes, híbrido</b></summary>

<dl><dd>

- 5.1. **Manter o botão Enviar Mensagem desabilitado se nenhum template for selecionado:** Botão submit desabilitado sem template.
- 5.2. **Habilitar o botão Enviar Mensagem após selecionar um template WABA sem variáveis:** Botão habilitado com template sem variáveis.
- 5.3. **Exigir o preenchimento de variáveis de texto antes de habilitar o botão Enviar Mensagem:** Botão desabilitado com variáveis vazias.
- 5.4. **Habilitar o botão Enviar Mensagem após preencher todas as variáveis de texto do template:** Botão habilitado após todas as variáveis preenchidas.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 6: Preservação de Mensagem da Modal no Chat (Janela Ativa vs Janela Inativa) — 2 testes, híbrido</b></summary>

<dl><dd>

- 6.1. **Redirecionar para conversa existente com Janela Ativa e carregar a mensagem com template bloqueado no compositor:** Redirecionamento com template em janela ativa.
- 6.2. **Redirecionar para conversa existente com Janela Inativa e carregar a mensagem com template no compositor:** Redirecionamento com template em janela inativa.

</dd></dl>

</details>

<details>
<summary><b>Contexto 7: Busca de Clientes sem Distinção de Acento e Caixa (Issue backend#628/PR #629) — 2 testes, API real</b></summary>

<dl><dd>

- 7.1. **Listar juntos "SÃO" e "SAO" ao digitar o termo sem acento, com acento ou em maiúsculas.**
- 7.2. **Achar "CONCEIÇÃO" ao digitar "conceicao" e manter o recorte mínimo de 3 caracteres.**

> 💡 Roda com `USE_MOCKS=false` (o filtro é do servidor) e restaura o valor no fim.

</dd></dl>

</details>
<br>

</dd></dl>

</details>

---

### 5-A. Atendimentos: Fila e Status (`cypress/e2e/5-A.atendimentos-fila.cy.js`) — 95 Testes

A primeira parte da suíte de **Atendimentos** cobre o lado operacional da fila: estrutura visual e contadores dinâmicos, campo de busca, regras de rota e estado padrão, canal oficial (Janela 24h WABA) e canal não oficial, status e disponibilidade do atendente (transferências), painel de filtros avançados, prioridade e ordenação da fila, acessibilidade da busca com a fila recolhida, prévia de mídia no card da fila, substatus personalizado e responsividade do cabeçalho:

<details>
<summary><b>🔍 5-A.atendimentos-fila.cy.js — 95 testes em 16 contextos (clique para expandir)</b></summary>

<dl><dd>

<br>

<details>
<summary><b>Contexto 1: Estrutura Visual, Contadores e Status da Fila — 4 testes, híbrido</b></summary>

<dl><dd>

- 1.1. **Carregar a tela de atendimentos com a barra de filtros, campo de busca e lista de cards:** Layout principal com filtros, busca e cards.
- 1.2. **Exibir os contadores das abas superiores de acordo com o payload de `/summary`:** Contadores de status consistentes com API.
- 1.3. **Refletir os contadores de status no menu lateral conforme o payload de `/summary`:** Badges do menu lateral consistentes com summary.
- 1.4. **Selecionar o chip de status ao clicar nas abas superiores:** Seleção de chip altera filtro de status.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 2: Funcionalidade do Campo de Busca — 2 testes, híbrido</b></summary>

<dl><dd>

- 2.1. **Disparar a busca na API ao digitar os 4 últimos dígitos do celular (definido em `env.json`):** Busca via API com 4 dígitos do celular.
- 2.2. **Restaurar a lista completa ao limpar o campo de busca:** Limpeza de busca restaura lista original.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 3: Validação de Estado Padrão e Regras de Rota — 8 testes, híbrido</b></summary>

<dl><dd>

- 3.1. **Ter "Aguardando" como o status padrão selecionado ao acessar a tela ou navegar da Central:** Status padrão "Aguardando" na entrada.
- 3.2. **Sincronizar e manter o ID do atendimento aberto na URL via query param `?attendance=` (PR #385):** ID na URL sincronizado com conversa aberta.
- 3.3. **Preservar a conversa aberta, filtros e termo de busca na tela após recarregamento (F5) (PR #385):** Persistência de estado após F5.
- 3.4. **Abrir diretamente o atendimento ao acessar via deep link com parâmetros na URL (PR #385):** Deep link abre atendimento diretamente.
- 3.5. **Fechar a conversa aberta e remover o parâmetro `attendance` da URL ao trocar de status (PR #385):** Troca de status limpa conversa e URL.
- 3.6. **Fechar a conversa aberta mantendo os filtros ao clicar no botão fechar conversa do cabeçalho (PR #385):** Botão fechar conversa funcional.
- 3.7. **Restaurar a URL padrão ao limpar filtros e termos de busca (PR #385):** URL padrão restaurada sem filtros.
- 3.8. **Ignorar termo de busca com menos de 3 caracteres mantendo a URL no padrão (PR #385):** Mínimo de 3 caracteres na busca.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 4: Regras de Canal Oficial (WhatsApp Oficial - Janela 24h &amp; WABA) — 5 testes, híbrido</b></summary>

<dl><dd>

- 4.1. **Exibir aviso de janela encerrada, botão de template e bloquear chat quando em Canal Oficial com janela inativa:** UI bloqueada com aviso de janela expirada.
- 4.2. **Permitir enviar template WABA com variável de texto editável durante janela inativa:** Envio de template com variável em janela expirada.
- 4.3. **Ativar a janela de 24h e liberar o campo de digitação livre assim que o cliente responder:** Ativação de janela 24h com resposta do cliente.
- 4.4. **Exibir o botão "Cancelar" acima do campo de mensagem ao selecionar template WABA em atendimento com Janela Ativa e restaurar digitação livre ao cancelar:** Cancelamento de template em janela ativa.
- 4.5. **Exibir o botão "Cancelar" acima do campo de mensagem ao selecionar template WABA em atendimento com Janela Expirada e restaurar aviso de janela ao cancelar:** Cancelamento de template em janela expirada.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 5: Regras de Canal Não Oficial e Interações de Chat Livre <code>[SKIP]</code> — 3 testes, híbrido</b></summary>

<dl><dd>

- 5.1. **Manter o chat 100% liberado e sem restrições de template quando o canal for WhatsApp Não Oficial:** Chat livre sem template em canal não oficial.
- 5.2. **Enviar mensagem no chat aberto e disparar a API com sucesso:** Envio de mensagem com `POST /messages`.
- 5.3. **Permitir alterar o status do atendimento para Concluído pelo menu do cliente:** Transição de status para concluído via menu.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 6: Status e Disponibilidade do Atendente (Transferência e Alternância) — 20 testes, híbrido</b></summary>

<dl><dd>

- 6.1. **Bloquear o compositor quando o atendimento estiver sem atendente e indicar status Ocupado do operador logado na modal de transferência:** Compositor bloqueado sem atendente; status na modal.
- 6.2. **Iniciar com chat bloqueado sem atendente, permitir transferência para atendente disponível e liberar o compositor após transferência:** Transferência libera compositor.
- 6.3. **Simular o ciclo completo de transferência (ida e volta) e validar a gravação no histórico da gaveta:** Transferência ida e volta com histórico.
- 6.4. **Sincronizar imediatamente a alteração de status do operador no modal de transferência após transferir o atendimento (PR #380):** Transfere para outro operador, alterna o próprio status Ocupado ➔ Disponível e valida que a lista da modal já reflete "Disponível" sem reload, concluindo a transferência de volta.
- 6.5. **Exibir o switch de status operacional com estado válido (Disponível, Ocupado ou Offline):** Switch com estados válidos.
- 6.6. **Alternar o status operacional persistindo a alteração no backend:** Alternância persiste via `PATCH`.
- 6.7. **Alternar novamente o status operacional retornando ao estado anterior:** Toggle duplo retorna ao estado anterior.
- 6.8. **Tratar o estado inicial "Offline" e alternar diretamente para "Disponível":** Offline → Disponível direto.
- 6.9. **Persistir o status do atendente entre recarregamentos de página:** Status persistido após F5.
- 6.10. **Não exibir o componente quando o usuário não possui a capability `can_access_attendance_module`:** Componente oculto sem grant 418.
- 6.11. **Lidar de forma resiliente quando o atendente não possui vínculo com grupo de canal (erro 422):** Tratamento de 422 sem grupo de canal.
- 6.12. **Listar na modal de transferência os grupos vinculados a canal devolvidos por `GET /channel-groups` (Issue front#561/PR #574, front#583/PR #591):** cada grupo visível aparece com o nome, os canais e o selo disponíveis/total; o esperado vem da própria resposta, em mock e em API real.
- 6.13. **Mostrar a fila geral do grupo atual como indisponível (Issue front#561/PR #574):** com o motivo "O atendimento já está neste grupo", destino vazio e confirmação desabilitada; nada é enviado.
- 6.14. **Marcar por padrão a fila geral de outro grupo (Issue front#561/PR #574):** o botão vira "Transferir para fila geral do grupo" e o destino cita o grupo escolhido; cancelar não envia nada.
- 6.15. **Mostrar a carga de cada atendente do grupo atual e o destino ao escolhê-lo (Issue front#561/PR #574):** "N atendimento(s) em curso" vem da API; o botão vira "Transferir para <nome>" e o destino traz o nome e o grupo.
- 6.16. **Filtrar os atendentes da modal sem distinguir maiúsculas, minúsculas nem acentos (Issue front#561):** nomes com acento achados por termo sem acento, e o inverso; termo sem correspondência não deixa nenhum atendente.
- 6.17. **Transferir para a fila geral de outro grupo enviando só `channel_group_id` (Issue front#561/PR #574):** toast de sucesso e card "Sem atendente" no grupo de destino, sem recarregar a página; o `PATCH` é sempre simulado.
- 6.18. **Tratar na modal as recusas da fila geral (Issue front#561/PR #574):** `422 ATTENDANCE_SAME_GROUP` fica no rodapé e `409 ATTENDANCE_TRANSFER_CLOSED` vira toast de atendimento encerrado; os dois releem o detalhe do atendimento.
- 6.19. **Omitir da modal de transferência os grupos sem vínculo a canal (Issue front#583/PR #591):** os grupos que a API devolve sem canal (ex.: SAC) não aparecem, e o atendimento continua na fila; em mock e em API real.
- 6.20. **Manter na modal o grupo atual do atendimento mesmo sem vínculo a canal (Issue front#583/PR #591):** ele aparece selecionado, junto dos grupos vinculados, com a fila geral dele indisponível.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 7: Painel de Filtros Avançados de Atendimentos — 7 testes, híbrido</b></summary>

<dl><dd>

- 7.1. **Abrir o modal de filtros e validar todos os elementos e estados iniciais padrão:** Modal de filtros com elementos em estado inicial.
- 7.2. **Exibir os campos do modal de filtros na ordem Data > Status > Canal > Grupos > Funcionário (PR #435):** Ordem visual/DOM medida via `getBoundingClientRect`; a navegação por teclado (Tab/Shift+Tab) segue a mesma ordem, pois os campos não usam `tabIndex`.
- 7.3. **Manter os campos Canal e Grupos independentes, sem que a seleção de um dependa do outro:** Canal e Grupos não são cascata: Grupos vem habilitado e populado desde a abertura do modal, e selecionar um não afeta nem reseta o outro.
- 7.4. **Listar funcionários independentemente de canal e grupo sem erro 403 (PR #339):** Lista de funcionários sem 403 cross-context.
- 7.5. **Aplicar os filtros selecionados disparando as requisições e fechando o modal:** Filtros aplicados disparam requisição.
- 7.6. **Resetar todos os campos para o estado inicial ao clicar em Limpar:** Botão Limpar reseta filtros.
- 7.7. **Fechar o modal de filtros sem aplicar alterações ao clicar no botão Fechar (×) ou pressionar ESC:** Fechar sem aplicar via X ou ESC.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 8: Regras de Prioridade e Ordenação de Atendimentos (Paridade Desktop - Issue #373) — 4 testes, híbrido</b></summary>

<dl><dd>

- 8.1. **Priorizar atendimentos com mensagens pendentes de leitura no topo da lista (1ª regra):** 1ª regra: unread no topo.
- 8.2. **Priorizar atendimentos há mais tempo sem resposta ao cliente entre conversas lidas (2ª regra):** 2ª regra: maior tempo sem resposta.
- 8.3. **Priorizar atendimentos há mais tempo sem mensagem do atendente entre conversas já respondidas (3ª regra):** 3ª regra: maior tempo sem msg do atendente.
- 8.4. **Aplicar a hierarquia completa de ordenação: Mensagem pendente &gt; Mais tempo sem resposta &gt; Mais tempo sem mensagem do atendente:** Hierarquia completa integrada.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 9: Acessibilidade da Busca com a Fila Recolhida (PR #326 / PR #328) — 3 testes, híbrido</b></summary>

<dl><dd>

- 9.1. **Expandir o campo de busca com foco ao clicar na lupa após recolher a fila pelo botão do header (PR #326):** Lupa funcional com fila recolhida manualmente via botão do cabeçalho do chat.
- 9.2. **Expandir o campo de busca com foco ao clicar na lupa após abrir uma gaveta lateral que recolhe a fila automaticamente (PR #328):** Lupa funcional com fila recolhida automaticamente por gaveta lateral (Notas Internas).
- 9.3. **Expandir o campo de busca com um único clique na lupa ao recolher pelo botão e depois abrir uma gaveta lateral (PR #326 / PR #328):** Caso combinado (recolhimento manual + automático); regressão que antes exigia 2 cliques.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 10: Prévia de Mídia no Card da Fila por content_type (Issue #383 / PRs #386, #387, #415, #497) — 8 testes, 100% mockado</b></summary>

<dl><dd>

- 10.1. **Exibir "Áudio" na prévia do card quando o último áudio foi enviado pela farmácia (type=0, body vazio, content_type=audio):** Card não fica em branco para áudio enviado pela farmácia (PR #415/#497).
- 10.2. **Exibir "Imagem" na prévia do card quando a última imagem foi enviada pela farmácia:** Rótulo de imagem enviada pela farmácia.
- 10.3. **Exibir "Vídeo" na prévia do card quando o último vídeo foi enviado pela farmácia:** Rótulo de vídeo enviado pela farmácia.
- 10.4. **Exibir "Documento" na prévia do card quando o último documento foi enviado pela farmácia:** Rótulo de documento enviado pela farmácia.
- 10.5. **Rotular como "Áudio" a prévia quando o cliente envia o marcador legado puro `[MENSAGEM DE VOZ]` (não-regressão PR #386/#387):** Marcador legado de entrada traduzido, não exibido cru.
- 10.6. **Exibir a legenda real da imagem do cliente em vez do rótulo genérico quando o body não é o marcador puro (não-regressão PR #387):** Legenda real do cliente não é sobrescrita pelo rótulo genérico.
- 10.7. **Rotular como "Figurinha" a prévia quando o cliente envia o marcador puro `[STICKER]` (não-regressão PR #386/#387):** Marcador puro de figurinha traduzido.
- 10.8. **Não converter em rótulo o marcador `[STICKER]` embutido em uma frase maior do cliente:** Comparação por igualdade total do body, não por prefixo (fix do code review da PR #386).

> 💡 Validado contra o app real (`app.omnicare.dev.local`, rede mockada): os 8 cenários passaram na primeira execução, confirmando que o bug original da Issue #383 (card em branco para mídia enviada pela farmácia) está corrigido em produção. Homologado pelo operador; `.only` removido.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 11: Responsividade do Cabeçalho — Folga entre a Faixa de Abas de Status e o Switch do Atendente (PR #417) — 1 teste, híbrido</b></summary>

<dl><dd>

- 11.1. **Manter uma folga real entre a última aba de status e o switch do atendente quando a faixa de abas transborda em telas estreitas:** Mede via `getBoundingClientRect` a distância entre a borda de recorte real do `.chipsRow` e o switch, em viewport estreito (900x900) com a faixa rolada até o fim.

> 💡 **Causa raiz (PR #417):** o espaçamento entre a faixa de abas e o switch estava em `padding-right: 16px` — como `overflow` recorta na borda do padding box (não do content box), a folga colapsava para 0px exatamente quando as abas transbordavam, colando visualmente o conteúdo cortado no switch. Corrigido movendo o espaçamento para `margin-right`, fora da caixa de recorte. Validado contra o app real (`app.omnicare.dev.local`, rede mockada); passou na primeira execução após identificar que a caixa de recorte real é `[class*="_chipsRow_"]` (não o `status-filter-bar` inteiro, que engloba o próprio switch — ver `.agents/AGENTS.md` §6). Homologado pelo operador; `.only` removido e integrado definitivamente à suíte geral.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 12: Badge de Substatus Personalizado na Fila e no Cabeçalho do Chat (backend#499/#501-503, front#396) — 12 testes, híbrido (1 cenário pontual blindado individualmente; 1 cenário exclusivo de API real)</b></summary>

<dl><dd>

- 12.1. **Exibir o nome do grupo (group.name) no card da fila, junto ao atendente:** Regressão do zod que descartava o campo mesmo a API já servindo.
- 12.2. **Exibir o telefone do cliente (customer_phone) no card da fila:** Novo campo declarado no card.
- 12.3. **Renderizar o card normalmente, sem erro e sem sumir da lista, quando custom_status vier null:** 304/1.134 vínculos reais apontam para substatus excluído — a API responde `null`, não derruba a conversa.
- 12.4. **Exibir a badge de substatus no card da fila e no cabeçalho do chat quando custom_status estiver presente:** Mesma badge replicada nos dois lugares.
- 12.5. **Ignorar as cores próprias do substatus e herdar sempre a paleta do status pai na badge (decisão da issue #329):** Decisão final do time após medir o catálogo real do tenant (3 de 4 linhas em branco-sobre-branco com as cores próprias) — a badge ignora `text_color`/`background_color` do substatus sempre, herdando o par inteiro do pai.
- 12.6. **Vincular um substatus pelo menu de status, gravando custom_status_id via PATCH e atualizando a badge mesmo quando a resposta vier sem o campo status:** Contrato real — vincular responde só o que o pedido tocou.
- 12.7. **Desvincular o substatus pelo "x" da badge, enviando custom_status_id: null e preservando o status pai:** `null` explícito como pedido de desvínculo.
- 12.8. **Limpar a badge de substatus ao mudar o status do atendimento, mesmo sem o payload da mudança mencionar custom_status:** Paridade com o legado — PATCH de status limpa o vínculo por conta própria.
- 12.9. **Montar o menu de substatus agrupado por pai a partir do catálogo, ignorando item com parent_status: null:** Catálogo `{items, total, truncated}`; item órfão não aparece.
- 12.10. **Criar um novo substatus personalizado com sucesso e refletir o novo item no menu:** `POST` com `{parent_status, name}`; 201 e contrato do body validados.
- 12.11. **Tratar o erro 500 ao tentar criar um substatus personalizado, sem afirmar sucesso indevido (bug real backend#509):** vermelho de propósito — form não fecha/confirma sucesso indevido quando o servidor recusa.
- 12.12. **Preservar a badge de substatus ao enviar mensagem num atendimento que já estava Em andamento (regressão backend#577/#611):** exclusivo de API real — contraprova de que a guarda `WHERE STATUS=0` do backend não afeta um atendimento que já não está Pendente.

> 💡 **Causa raiz do "+ Adicionar personalizado" (apontada pelo operador):** `can_create_attendance_custom_status` é capability de **loja** (`/attendance-capabilities`), não de item — o botão (`chat-header-menu-custom-add-{key}`) vive dentro da sublista expandida do status pai, atrás do toggle `chat-header-menu-custom-toggle-{key}` (que só renderiza quando o pai já tem substatus OU quando a capability de loja é `true`). Validado primeiro em `1.permissoes.cy.js` (`[Permissão 577]`, movido de cá) e depois reaplicado aqui para reativar os testes #136-#137.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 13: Tempo Relativo desde a Última Mensagem no Card da Fila (Issue front#526, PR #528/#529) — 4 testes, 100% mockado</b></summary>

<dl><dd>

- 13.1. **Exibir "agora" para a mensagem mais recente e avançar para "há 1 minuto"/"há 2 minutos" pelo poll de 60s, sem recarregar a tela.**
- 13.2. **Exibir "há 1 hora" (singular) e "há N horas" (plural).**
- 13.3. **Reverter para a data `dd/MM/yy` quando a última mensagem passa de 24 horas.**
- 13.4. **Usar a data do próprio atendimento (`reference_at`) quando não há nenhuma mensagem ainda.**

> 💡 A listagem já devolve `messages.last_message.occurred_at` (confirmado contra `api.omnicare.dev.local` antes de escrever, `AGENTS.md [R-EVID]`) — o front só formata o tempo relativo. Achado de infra: `cy.clock()`/`cy.tick()` colidem com um poll real de 60s de fallback (ativo porque o SSE é sempre bloqueado neste harness) já agendado antes do fake clock entrar em cena — resolvido com esperas de parede reais, como o próprio roteiro de QA da issue já pede ao operador ("deixe a tela parada por 1 ou 2 minutos"). Gap aceito: "conversa fechada recebe mensagem nova e card atualiza sozinho" não comprovado (chamadas de rede extras e não-determinísticas mesmo mockado); i18n es/en também não coberto (nenhum seletor de idioma localizável encontrado na tela). Homologado pelo operador.

</dd></dl>

</details>

<details>
<summary><b>Contexto 14: Busca na Fila sem Distinção de Acento e Caixa (Issue backend#628/PR #629) — 1 teste, API real</b></summary>

<dl><dd>

- 14.1. `[SKIP]` **Achar o card do cliente gravado com acento digitando o nome sem acento, com acento ou em maiúsculas na barra de busca da fila.**

> 💡 Massa dinâmica: atendimento Aguardando cujo cliente tenha acento no nome; o card é conferido pelo código, pois a UI exibe o nome em caixa de título.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 15: Seletor Canal do Filtro da Fila Lista só os Canais Ativos pela Rota GET /attendances/channels (Issue front#582/PR #590, backend#685/#687; backend#721/PR #733) — 8 testes, híbrido (o 15.3, o 15.7 e o 15.8 são mockados)</b></summary>

<dl><dd>

- 15.1. **Abrir o filtro chamando `GET /attendances/channels`, sem a loja no caminho, e listar "Todos os canais" mais um item por canal devolvido, na ordem da API, sem chamar `/channels`.**
- 15.2. **Listar no seletor Canal os canais de Pedido Pago (`channel_subtype` 2), que antes ficavam fora.**
- 15.3. **Exibir "Sem nome #id" no seletor Canal quando o canal chega com o nome vazio** (100% mockado; `name: null` faz o front recusar a lista, `ROADMAP.md` P2-20).
- 15.4. **Filtrar a fila por um canal de Pedido Pago enviando `channel_id` na listagem e trazendo só atendimentos desse canal.**
- 15.5. **Manter o "Iniciar atendimento" em `GET /channels`, só com canais ativos fora de Pedido Pago, sem contaminar a lista do filtro (query key própria).**
- 15.6. **Não listar no seletor Canal nenhum canal inativo (backend#721):** todo canal do filtro que não é de Pedido Pago está em `GET /channels` (só ativos) e o seletor espelha a lista da rota. Reativado quando o backend tirou os inativos da rota.
- 15.7. **Mostrar "Erro ao carregar as opções." com "Tentar novamente" no seletor Canal quando a lista responde `403`:** o seletor fica só com "Todos os canais".
- 15.8. **Carregar os canais ao clicar em "Tentar novamente" depois de a lista falhar com `500`.**

> 💡 Os canais da dev são massa: os testes afirmam a regra (ordem da API, Pedido Pago presente), nunca a lista fixa. Mock da rota nova: `interceptAttendanceChannelsApi`, registrado no `beforeEach` da `5-A`.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 16: Seletor Grupos do Filtro da Fila Lista só os Grupos Vinculados a Canal, sem Cascata com o Canal (Issue front#398/PR #581, backend#672) — 5 testes, híbrido (o 16.2 e o 16.5 são 100% mockados)</b></summary>

<dl><dd>

- 16.1. **Listar no seletor Grupos só os grupos com canal vinculado, na ordem da API, escondendo os que chegam com `channels` vazio.**
- 16.2. **Deixar só "Todos os grupos" no seletor, habilitado e sem erro, quando nenhum grupo tem canal vinculado** (100% mockado).
- 16.3. **Manter a lista de Grupos e o grupo escolhido ao trocar o Canal por um canal que o grupo não tem, enviando os dois na listagem** (sem cascata).
- 16.4. **Filtrar a fila por um grupo vinculado a canal enviando `channel_group_id` na listagem e trazendo só atendimentos desse grupo.**
- 16.5. **Esconder do seletor Grupos o grupo inativo, que chega sem canal ativo vinculado (`channels` vazio), e manter os vinculados** (100% mockado; decisão de produto: grupo inativo não aparece).

> 💡 Os grupos da dev são massa: os testes afirmam a regra (só `channels` preenchido, na ordem da API), nunca a lista fixa. Em produção a regra só vale depois do merge da backend#672 na `main`.

</dd></dl>

</details>
<br>

</dd></dl>

</details>

### 5-B. Atendimentos: Chat e Anexos (`5-B1`, `5-B2` e `5-B3` em `cypress/e2e/`) — 170 Testes

A segunda parte cobre o conteúdo da conversa em si e está dividida em três specs, para caber nos limites de memória e tempo da Lambda: **5-B1** (componentes do chat — mensagens, orçamentos, templates, observações, notas internas, citação/resposta, linkify, link de pagamento Cielo —, envio e cancelamento de anexos com recusa local por tipo de mídia e colagem de imagem), **5-B2** (janela 24h, gavetas com janela expirada, template WABA com múltiplas variáveis, precedência de template sobre anexo, busca na conversa, legenda em anexos e personalização do orçamento) e **5-B3** (timeout de upload, ícone/tooltip/reenvio de mensagem com falha, busca sob demanda de anexos, reações, notificação da I.A., orçamento por canal, desconto e contraste no tema escuro, estado do compositor e "Marcar todos"/"Desmarcar todos"). Clique para expandir cada spec:

<details>
<summary><b>🔍 5-B — 170 testes em 3 specs (clique para expandir)</b></summary>

<dl><dd>

<br>

<details>
<summary><b>5-B1 — Componentes, Anexos e Colagem (<code>5-B1.atendimentos-chat-componentes.cy.js</code>) — 59 testes em 3 contextos</b></summary>

<dl><dd>

<br>

<details>
<summary><b>Contexto 1: Validações dos Componentes do Chat — 35 testes, híbrido (alguns cenários pontuais blindados individualmente)</b></summary>

<dl><dd>

- 1.1. **Enviar mensagem de texto simples no compositor via clique no botão e via tecla Enter:** Envio por clique e Enter.
- 1.2. **Exibir o ícone "Aguardando envio" imediatamente após o envio, sem nascer como "Entregue" (PR #418):** Bolha nasce em `message_status: ready` (não `sent`); contrato do POST 201 respeitado.
- 1.3. **Revalidar automaticamente o ícone de "Aguardando envio" para "Entregue" sem depender da chegada de uma nova mensagem (PR #418):** Revalidação automática `ready -> sent` sem nova mensagem ou ação manual.
- 1.4. **Preservar a mensagem do cliente recebida durante o upload quando o envio de um anexo falha, removendo só a bolha que falhou (front#486, PR #480):** falha de envio de mídia não reverte o cache inteiro — mensagem concorrente do cliente sobrevive, só a prévia do anexo fica pendente no compositor.
- 1.5. **Cancelar um envio de anexo em andamento pelo botão "Cancelar envio", mantendo o anexo no compositor sem mensagem de erro (front#489, PR #483):** `button-cancel-media-send` interrompe o upload; sem aviso de erro; anexo continua disponível pra reenviar ou remover.
- 1.6. **Abrir gaveta de orçamentos, testar botão Baixar e enviar orçamento para o chat validando sua renderização:** Gaveta de orçamentos + envio para chat.
- 1.7. **Buscar e usar mensagem padrão preenchendo automaticamente o compositor do chat:** Mensagem padrão preenche compositor.
- 1.8. **Gerenciar e enviar os dois tipos de templates para o chat (com variável e sem variável):** Templates com e sem variável.
- 1.9. **Realizar o ciclo completo de CRUD na gaveta de observações (criar, editar e excluir):** CRUD de observações na gaveta.
- 1.10. **Adicionar uma nota interna com sucesso e validar a gravação na gaveta:** Nota interna criada e listada.
- 1.11. **Validar a renderização estruturada do card de link de pagamento gerado na gaveta lateral:** Card de link na gaveta com estrutura completa.
- 1.12. **Validar os controles de ação do cabeçalho do chat (buscar, recolher fila e fechar conversa):** Controles do header do chat funcionais.
- 1.13. **Renderizar o badge de início do histórico estático no topo sem flutuar ou sobrepor mensagens (PR #390):** Badge de início estático no topo.
- 1.14. **Abrir a barra de citação no compositor ao acionar responder em mensagem do chat e focar no input (PR #394):** Citação abre ao responder + foco.
- 1.15. **Permitir cancelar a citação tanto pelo botão cancelar quanto pressionando a tecla Esc (PR #394):** Cancelamento de citação por botão e ESC.
- 1.16. **Garantir exclusão mútua entre citação e uso de template no compositor (PR #394):** Citação e template são mutuamente exclusivos.
- 1.17. **Enviar resposta direta com `reply_to_message_id` no payload e renderizar citação no histórico (PR #394):** Envio com `reply_to_message_id` e citação visual.
- 1.18. **Rolar suavemente até a mensagem original ao clicar no card de citação no histórico (PR #394):** Scroll-to-message ao clicar na citação.
- 1.19. **Realizar autoscroll para o rodapé ao carregar atendimento mantendo foco na última mensagem (PR #389):** Autoscroll para última mensagem.
- 1.20. **Preservar o foco no rodapé da conversa ao alternar entre atendimentos na fila (PR #389):** Foco mantido no rodapé ao alternar.
- 1.21. **Não puxar a tela para o rodapé automaticamente quando o operador sobe para ler o histórico (PR #389 / anti-regressão #357):** Anti-regressão: scroll não força rodapé.
- 1.22. **Desabilitar botões de editar e apagar além do checkbox em orçamentos vendidos na gaveta (PR #379):** Botões bloqueados em orçamentos vendidos.
- 1.23. **Permitir marcar e desmarcar checkbox de orçamento pendente disparando `PATCH` com novo estado (PR #321):** Toggle de checkbox dispara `PATCH`.
- 1.24. **Bloquear o checkbox para novas cobranças em orçamento já coberto por link aprovado sem exibir selo Vendido (PR #324 / PR #311):** Checkbox bloqueado em coberto sem selo.
- 1.25. **Permitir desmarcar orçamento coberto por link aprovado que esteja previamente preso marcado (PR #324):** Desmarcação de orçamento coberto.
- 1.26. **Manter o checkbox permanentemente bloqueado em orçamento com status Vendido (PR #321 / PR #379):** Checkbox permanentemente bloqueado em vendido.
- 1.27. **Permitir marcar um orçamento concluído (status -1) sem financeiro e sem cobertura para o link de pagamento (Issue front#492/backend#562/#583):** antes da PR #495, `isBudgetOpenForPaymentLink` aceitava só `status === 0`, recusando com a dica "Só orçamento em aberto..." — agora aceita também o concluído, desde que não vendido nem coberto por link aprovado.
- 1.28. **Continuar bloqueando o checkbox de um orçamento com status fora de aberto (0) e concluído (-1), com a dica atualizada (Issue front#492):** texto revisado pela PR #495: "Só orçamento em aberto ou concluído entra em link de pagamento."
- 1.29. **Bloquear um orçamento concluído quando a API não envia o campo `covered_by_approved_link` (Issue front#492):** ausência do campo é tratada como "não confirmado", não como "não coberto" — o front exige `covered_by_approved_link === false` explícito para liberar um concluído.
- 1.30. **Bloquear todos os checkboxes de seleção quando o atendente não possuir permissão para gerar link de pagamento (PR #321):** Checkboxes bloqueados sem `can_send_payment_link`.
- 1.31. **Não fazer sumir a bolha do anexo em andamento quando a lista de mensagens é atualizada automaticamente antes da resposta do servidor, nem duplicá-la ao concluir (Issue front#487, PR #481):** resposta do `POST .../messages/media` atrasada 25s; um `GET .../messages` automático (poll) durante o upload não conhece a mensagem otimista (`data-message-id="-1"`) — a bolha segue visível e única, sem duplicar ao concluir.
- 1.32. **Exibir os elementos principais do chat (cabeçalho, lista de mensagens, atalhos e compositor) ao abrir uma conversa:** cabeçalho, lista de mensagens, atalhos de gavetas (orçamentos/notas/observações/transferências) e o compositor completo (campo de texto, enviar, anexar, áudio, emoji).
- 1.33. **Deve avisar que o orçamento sem valor não entra no link de pagamento quando o servidor recusa a marcação com 422 BUDGET_ZERO_AMOUNT, sem reler os cards (Issue front#408/PR #680):** o operador vê o motivo da recusa.
- 1.34. **Deve avisar que a seleção não foi gravada quando o servidor responde 409 BUDGET_WRITE_NOT_APPLIED, desfazendo a marcação (Issue front#408/PR #680):** a marcação não fica marcada sem ter gravado.
- 1.35. **Deve manter a frase de orçamento que já não pode ser cobrado e reler os cards quando a recusa é BUDGET_ALREADY_SOLD (regressão da Issue front#408/PR #680):** os códigos antigos seguem com o aviso e a releitura.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 2: Validações de Envio de Anexos no Chat (Mínimos, Teto por Tipo de Mídia e Recusa Local no Front — front#344 / srv#455, #463, #527 / front#595) — 19 testes, híbrido</b></summary>

<dl><dd>

> Contexto validado contra a API real. O teto global de container é **16 MB** (`max-file-size`), o backend não publica esse número e, desde a PR #598 (front#595), o front recusa o anexo na própria seleção do arquivo, com teto fixo por tipo e o aviso do limite — a recusa do servidor (`413`/`422`) ficou como rede de proteção. Desde 2026-10-02 (Issue cypress#003) existe também um teto **síncrono por tipo de mídia**, dentro desse teto global, que o Issue backend#600/#602 (05/10/2026) estendeu de documento/imagem para **todo tipo de mídia**: arquivo acima de 10 MB recebe `422` direto na resposta do upload (`"{Tipo} acima do limite de 10 MB."`) — origem no `omnichannel-aws` (teto de busca do BLOB do cliente, `omnichannel-aws#72`/`#85`). Medido que o `413` de container ficou inalcançável pra qualquer tipo (confirmado até com vídeo de 64 MB), não só documento.

- 2.1. **Enviar anexo de imagem JPG, renderizar na conversa e abrir a prévia da imagem ao clicar:** Upload de JPG; o clique no anexo abre o lightbox com a imagem efetivamente decodificada.
- 2.2. **Enviar anexo de documento PDF, renderizar o card e abrir a prévia do PDF ao clicar:** Upload de PDF; o clique abre o visualizador de PDF.
- 2.3. **Enviar anexo de documento Word (DOC), renderizar na conversa e baixar com a extensão .doc ao clicar:** Sem prévia; valida o download e a extensão do arquivo gravado em disco.
- 2.4. **Enviar anexo de documento Word (DOCX), renderizar na conversa e baixar com a extensão .docx ao clicar:** Download e extensão.
- 2.5. **Enviar anexo de planilha Excel (XLS), renderizar na conversa e baixar com a extensão .xls ao clicar:** Download e extensão.
- 2.6. **Enviar anexo de planilha Excel (XLSX), renderizar na conversa e baixar com a extensão .xlsx ao clicar:** Download e extensão.
- 2.7. **Enviar anexo de texto simples (TXT), renderizar na conversa e baixar com a extensão .txt ao clicar:** Download e extensão.
- 2.8. **Enviar anexo de áudio MP3, renderizar o player nativo e reproduzir o áudio ao clicar:** Upload de MP3; valida duração decodificada e reprodução efetiva.
- 2.9. **Enviar anexo de vídeo MP4, renderizar na conversa e reproduzir o vídeo no player inline:** Upload de MP4; valida dimensões reais de quadro e duração.
- 2.10. **Recusar localmente o vídeo de 64 MB acima do teto de 10 MB:** aviso "Vídeo acima do limite de 10 MB." no compositor, sem prévia e sem upload (front#595/PR #598).
- 2.11. **Recusar localmente o documento de 15 MB, citando o teto de 10 MB:** aviso "Documento acima do limite de 10 MB." no compositor, sem prévia, sem upload e sem bolha nova (antes o servidor recusava com `422` depois do upload, Issue cypress#003).
- 2.12. **Recusar localmente a imagem de 8 MB, citando o teto de 5 MB:** aviso "Imagem acima do limite de 5 MB." no compositor, sem prévia e sem upload (antes o servidor recusava com `422`).
- 2.13. **Aceitar documento de exatamente 10 MB, fronteira inferior do teto de busca do BLOB (Issue backend#600/#602):** 10.485.760 bytes exatos — fronteira inclusiva, deve ser `201` aceito, nunca `422`.
- 2.14. **Recusar localmente o áudio de 15 MB, citando o teto de 10 MB:** aviso "Áudio acima do limite de 10 MB." no compositor, também no fluxo de áudio, sem prévia e sem upload.
- 2.15. **Recusar localmente o vídeo de 15 MB, citando o teto de 10 MB:** aviso "Vídeo acima do limite de 10 MB." no compositor, sem prévia e sem upload.
- 2.16. **Recusar localmente o documento com 1 byte acima do teto de 10 MB (front#595/PR #598):** arquivo sintético de 10.485.761 bytes recebe o aviso "Documento acima do limite de 10 MB.", sem prévia e sem upload; o de exatos 10 MB é aceito (2.13).
- 2.17. **Aceitar localmente a imagem de exatamente 5 MB (front#595/PR #598):** 5.242.880 bytes sintéticos montam a prévia, sem aviso de tamanho e sem upload (só observa a seleção).
- 2.18. **Recusar localmente a imagem com 1 byte acima do teto de 5 MB (front#595/PR #598):** 5.242.881 bytes sintéticos recebem o aviso "Imagem acima do limite de 5 MB.", sem prévia e sem upload.
- 2.19. **Apagar o aviso de tamanho ao escolher um arquivo válido logo depois de um recusado (front#595/PR #598):** a imagem de 8 MB é recusada com aviso; em seguida o JPG pequeno some com o aviso e monta a prévia, ainda sem upload.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 3: Colagem de Imagem no Compositor via Ctrl+V / Menu "Colar" do Navegador (PR #424) — 5 testes, híbrido</b></summary>

<dl><dd>

> Simula o evento nativo `paste` com uma imagem no `clipboardData` — `Ctrl+V` e "Botão direito > Colar" do menu nativo do navegador disparam o mesmo `ClipboardEvent` (confirmado pelo dev na PR #424), sem caminho de código separado para o mouse. O clique no item nativo "Colar" do menu do sistema operacional não é um elemento do DOM da página e por isso não é controlável pelo Cypress diretamente.

- 3.1. **Colar uma imagem no compositor e abrir a modal de prévia com legenda opcional, enviando pela mesma esteira de mídia do ícone de anexo:** `paste` com imagem abre `modal-paste-image`; legenda em `input-paste-image-caption`; envio via `button-paste-image-send` dispara a mesma rota `POST .../messages/media` do ícone de anexo.
- 3.2. **Colar uma imagem via botão direito do mouse + "Colar" do menu de contexto e abrir a mesma modal de prévia:** Dispara `contextmenu` (botão direito) seguido do mesmo `paste` sintético, provando que o gesto do mouse chega ao mesmo fluxo completo (modal, legenda, envio) do Ctrl+V.
- 3.3. **Fechar a modal de prévia de imagem colada sem enviar nenhuma mídia ao clicar em Cancelar:** `button-paste-image-cancel` fecha a modal sem disparar a rota de envio de mídia.
- 3.4. **Cancelar o envio de uma imagem colada durante o upload, mantendo a modal de prévia aberta (front#489, PR #483):** o mesmo `button-paste-image-cancel`, agora clicado durante o envio, interrompe o upload sem fechar a modal e sem mensagem de erro.
- 3.5. **Recusar localmente a imagem colada acima do teto de 5 MB (front#595/PR #598):** o `paste` de uma imagem de 5.242.881 bytes mostra "Imagem acima do limite de 5 MB." no compositor, sem abrir a modal de prévia e sem upload.

</dd></dl>

</details>
<br>
<br>

</dd></dl>

</details>
<br>

<details>
<summary><b>5-B2 — Janela 24h, Templates, Busca, Legenda e Personalização do Orçamento (<code>5-B2.atendimentos-chat-janela.cy.js</code>) — 59 testes em 8 contextos</b></summary>

<dl><dd>

<br>

<details>
<summary><b>Contexto 4: Regras de Janela Expirada - Acesso a Gavetas de Orçamentos e Links de Pagamento (PR #250) — 3 testes, híbrido</b></summary>

<dl><dd>

- 4.1. **Manter botões "X orçamentos" e "X links de pagamento" habilitados na Janela Expirada, abrindo as gavetas com ações de criação/envio desabilitadas:** Gavetas acessíveis mas ações bloqueadas em janela expirada.
- 4.2. **Manter todas as ações habilitadas (envio de orçamento e novo link) quando o atendimento possui Janela Aberta:** Ações liberadas em janela ativa.
- 4.3. **Manter as gavetas de orçamentos e links bloqueadas na porta quando não há atendente designado (Regra #212):** Gavetas bloqueadas sem atendente.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 5: Leitura de Mensagens, Badge e Contagem Regressiva da Janela 24h (PR #312) — 6 testes, 100% mockado</b></summary>

<dl><dd>

- 5.1. **Ignorar a chamada da API de leitura ao abrir conversa sem badge:** Sem badge = sem `POST /read`.
- 5.2. **Manter o badge intacto quando um terceiro abre a conversa do titular:** Badge mantido para terceiro.
- 5.3. **Tratar falhas de API de forma silenciosa mantendo o badge intacto:** Falha de API não remove badge.
- 5.4. **Exibir o contador regressivo em verde com ícone de relógio e caixa de mensagem livre quando a janela restante for superior a 4 horas:** Contador verde &gt; 4h.
- 5.5. **Exibir o contador regressivo em tom de alerta laranja quando a janela restante for menor ou igual a 4 horas mantendo a digitação livre:** Contador laranja ≤ 4h.
- 5.6. **Exibir o badge em vermelho de janela limitada e bloquear o compositor com aviso de template quando a janela estiver expirada:** Badge vermelho e compositor bloqueado.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 6: Prévia e Envio de Template WABA com Múltiplas Variáveis (PR #284 e #285) — 1 teste, 100% mockado</b></summary>

<dl><dd>

- 6.1. **Selecionar o template `teste_seis_variaveis` no chat, preencher validando a prévia com os dados e enviar para o chat validando os dados:** Template com 6 variáveis; prévia + envio + payload.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 7: Janela 24h WABA — Linkify, Bloqueio de Janela Encerrada e Ancoragem de Scroll (PRs #242, #204 e #355) — 9 testes, 100% mockado</b></summary>

<dl><dd>

- 7.1. **Transformar URLs externas (http/https e www) em links clicáveis com target blank e noopener noreferrer:** Linkify de URLs http/https/www (PR #242).
- 7.2. **Preservar o ponto final fora do link quando a URL estiver colada ao final de uma frase:** Pontuação separada do link (PR #242).
- 7.3. **Manter o link clicável e com o trecho destacado por dentro ao realizar busca na conversa:** Linkify preservado durante busca (PR #242).
- 7.4. **Renderizar URLs como links clicáveis em legendas de imagem e em notas internas:** Linkify em legendas e notas internas (PR #242).
- 7.5. **Permitir navegação por teclado com foco no link e manter markdown falso, e-mail e telefone como texto puro:** Foco de teclado; e-mail/telefone sem linkify (PR #242).
- 7.6. **Desabilitar visualmente e bloquear interação dos recursos que dependem de janela ativa quando a janela do WhatsApp Oficial estiver encerrada:** Bloqueio de cards e botões com janela encerrada (PR #204).
- 7.7. **Aplicar os bloqueios da janela encerrada mesmo em atendimento sem inbound inicial (sem a tag Janela Expirada):** Bloqueio sem inbound inicial sem tag expirada (PR #204).
- 7.8. **Reabilitar automaticamente os cards e ações bloqueadas após resposta do cliente (inbound) sem recarregar a página:** Cura automática por resposta do cliente sem reload (PR #204).
- 7.9. **Manter o scroll ancorado na última mensagem do chat após transferir o atendimento para outro atendente (PR #355):** Distância até o fim do container de mensagens após a transferência (ancoragem, válido com ou sem overflow).

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 8: Precedência de Template sobre Anexo Pendente no Compositor (PR #306) — 2 testes, híbrido</b></summary>

<dl><dd>

- 8.1. **Enviar o template com precedência sobre o anexo pendente, preservando o anexo para o próximo envio, com janela ativa (PR #306):** Template vence a rota de mídia (assert por rota HTTP, não por render); anexo sobrevive pendente após o envio do template.
- 8.2. **Enviar o anexo normalmente com a legenda digitada quando não há template pendente (PR #306):** Não-regressão: sem template pendente, a mídia segue a rota normal e a rota de template nunca é chamada.

> 💡 O cenário de não-regressão "janela fechada com anexo + template pendente" citado na issue original não é alcançável pela UI — com a janela de 24h expirada o compositor não renderiza nenhum controle de anexo — e foi intencionalmente omitido (detalhes em `.agents/PROJECT_CONTEXT.md` §10.6).

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 9: Navegação de Resultados na Busca da Conversa (PR #172) — 4 testes, 100% mockado</b></summary>

<dl><dd>

- 9.1. **Exibir o contador de ocorrências ao pesquisar um termo presente em múltiplas mensagens:** Contador "X / Y" reflete corretamente o total de ocorrências.
- 9.2. **Destacar todas as ocorrências do termo e marcar a primeira como ativa ao pesquisar:** **Bug real confirmado** — a ocorrência ativa inicial (mais antiga, fora da viewport) fica marcada no DOM (`aria-current`) mas não é rolada até a tela.
- 9.3. **Avançar para a próxima ocorrência, atualizar o contador e rolar até a mensagem seguinte ao clicar em "Próximo resultado":** Navegação para ocorrência mais recente funciona corretamente.
- 9.4. **Voltar para a ocorrência anterior, atualizar o contador e rolar até a mensagem anterior ao clicar em "Resultado anterior":** Mesmo bug — contador e marcação corretos, mas sem rolagem até a mensagem mais antiga.

> ⚠️ **Bug real de frontend:** a PR #172 corrigiu o `scrollIntoView` (antes mirava o wrapper `.messageAnchor` com `display:contents`, sem efeito), mas só funciona ao navegar para ocorrências **mais recentes**. A busca inicial e o botão "Anterior" não rolam até mensagens mais antigas — confirmado com timeout de até 20s (não é lentidão). Testes 116 e 118 mantidos ativos intencionalmente para documentar o bug (ver `.agents/ROADMAP.md` P1), não forçados a passar. Homologado pelo operador; `.only` removido e integrado definitivamente à suíte geral.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 10: Preservação de Legenda em Anexos de Mídia no Painel do Atendente (Issue #146/PR #216, Issue front#491/PR #512, Issue front#336) — 10 testes, 100% mockado</b></summary>

<dl><dd>

- 10.1. **Preservar a legenda "teste anexo" no balão do próprio atendente ao enviar uma imagem com legenda (repro exata):** Repro literal do relato original — legenda sobrevive no balão local otimista.
- 10.2. **Preservar legendas curtas alfanuméricas anteriormente removidas pelo guard de base64 (varredura de regressão):** Reenvia a mesma imagem com 8 legendas em sequência (6 previamente quebradas + 2 controles).
- 10.3. **Preservar a legenda no balão de vídeo enviado pelo atendente:** Cobertura do outro tipo de mídia citado no fix além de imagem.
- 10.4. **Exibir a legenda de uma imagem recebida do cliente em vez de omiti-la (não-regressão):** Direção inbound (cliente → atendente).
- 10.5. **Omitir a legenda do documento quando content vier igual ao filename (dedup):** Mesma regra de deduplicação já usada em imagem/vídeo, aplicada ao card de documento.
- 10.6. **Exibir o nome completo no atributo title do card, com a extensão num span próprio:** Nome longo trunca mantendo a extensão visível; nome completo acessível via tooltip/leitor de tela.
- 10.7. **Não renderizar elemento de legenda quando o documento não tiver content:** Sem legenda, nenhum `<p>` vazio fica no DOM — título segue resolvendo pelo `filename` normalmente.
- 10.8. **Cair no título genérico "Documento" quando o backend não enviar `attachment.filename`, mantendo a legenda visível separadamente:** Sem `filename`, o título não usa a legenda como fallback (diverge do texto da issue) — vai direto para "Documento"; a legenda segue num componente próprio, sempre separado do título.
- 10.9. **Realçar o termo buscado também na legenda do documento:** Busca na conversa (`<mark>`) alcança a legenda do card de documento, mesmo padrão já usado em link (PR #242).
- 10.10. **Usar o content como título do documento recebido do cliente, nunca o filename sintetizado pelo backend:** No fluxo inbound, `content` (nome real digitado/enviado) vence `filename` (sintetizado tipo `documento_<id>.pdf`) como título do card.

> 💡 **Causa raiz (PR #216):** o guard que protege o render contra exibir payload base64 bruto de anexo tratava qualquer legenda puramente alfanumérica (sem espaços) com comprimento múltiplo de 4 como suspeita de base64 — "Ouro", "Receita", "Nota", "foto", "urgente" e "Bom dia" caíam nessa armadilha, enquanto "teste"/"Segue" não, explicando o comportamento intermitente. Corrigido exigindo ≥64 caracteres antes de suspeitar de base64. Legenda em anexo de áudio enviado pelo painel foi omitida intencionalmente: inalcançável pela UI atual (mesmo padrão do Contexto 16 / PR #306). Homologado pelo operador; `.only` removido.
>
> 💡 **Título e legenda do documento (PR #512):** o card de documento passou a usar `attachment.filename` como título (base e extensão em elementos separados, nome completo disponível via tooltip) e a exibir `content` como legenda abaixo do card, igual a imagem/vídeo — confirmado ao vivo contra `app.omnicare.dev.local`. Achado relacionado: `backend#585`/`omnichannel-aws#93` (documento recebido sem legenda passa a vir com `content` igual ao nome do arquivo) já estão implantados na dev, confirmado via mensagem real. Um 3º teste chegou a ser escrito supondo um documento recebido com legenda distinta do nome, mas essa hipótese foi descartada: o próprio roteiro de QA da issue já registra que o backend não grava legenda de documento recebido ("limitação conhecida, não é bug desta issue") — esse estado não ocorre em produção, então o teste foi removido.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 11: Personalização do Orçamento (Issue #449, PR #451, backend#529/#567) — 18 testes, 100% mockado</b></summary>

<dl><dd>

- 11.1. **Não exibir o ícone de personalização sem a capability can_customize_budget (AC1):** Botão `button-customize-budget` ausente sem a 635.
- 11.2. **Exibir o ícone com a dica "Personalizar orçamentos" quando a capability é concedida:** `aria-label`/tooltip do botão.
- 11.3. **Abrir a modal com o botão Salvar desabilitado:** Estado inicial sem alterações.
- 11.4. **Atualizar a prévia em tempo real ao mudar a cor e habilitar Salvar:** Seletor+HEX refletem no cabeçalho da prévia antes de salvar.
- 11.5. **Desabilitar Salvar ao digitar de volta a cor salva no servidor:** Comparação case-insensitive entre a cor digitada e a cor do servidor.
- 11.6. **Não aplicar a prévia nem habilitar Salvar com um HEX incompleto:** Cor inválida não muda nada.
- 11.7. **Normalizar um HEX digitado com espaço e minúsculas para maiúsculas:** `" #1a2b3c"` → `"#1A2B3C"`.
- 11.8. **Ajustar o contraste do texto para escuro ao escolher uma cor clara:** Regra de acessibilidade da issue.
- 11.9. **Substituir o cabeçalho da prévia ao enviar uma capa ideal (1200×450), sem aviso:** Upload dentro do tamanho recomendado.
- 11.10. **Exibir o aviso de imagem pequena ao enviar uma capa abaixo do ideal, sem bloquear:** Abaixo de 600×225 mostra aviso, mas permite salvar.
- 11.11. **Recusar formato não suportado e depois tamanho acima de 5 MB, sem alterar a capa:** `.gif` → "Formato não suportado."; PNG > 5MB → "A imagem passa de 5 MB."
- 11.12. **Fechar só a modal ao pressionar Esc, mantendo a gaveta de Orçamentos aberta:** Esc não propaga para a gaveta por trás.
- 11.13. **Salvar cor e capa via PUT multipart e fechar a modal:** `PUT .../budget-customization` 200 + modal fecha.
- 11.14. **Aplicar a cor e a capa personalizadas da loja na prévia do orçamento enviado ao cliente (AC3):** com capa o front renderiza a Cover no lugar do Hero; a cor vai pelas CSS vars do card (`--ph-brand`), a Cover fica visível com `src` `data:image/png` e o Hero não existe.
- 11.15. **Voltar ao cabeçalho padrão mantendo a cor da loja ao remover a capa e salvar:** Remover capa não reseta a cor (sem controle de "voltar ao padrão" — decisão do protótipo, nota da PR #451).
- 11.16. **Enviar o orçamento no visual padrão #337BA8 quando a loja não tem personalização (AC4):** `is_default:true`, sem capa.
- 11.17. **Manter a modal aberta e exibir a mensagem da API ao receber 422 do PUT:** Mensagem do `ErrorResponse` no toast de erro, modal não fecha.
- 11.18. **Não travar o envio do orçamento quando a capa responde 503:** Card sai sem capa, envio segue liberado.

> 💡 Contexto blindado (`AGENTS.md [R-BLIND]`): a capability 635 e o contrato de personalização por loja não são determinísticos na API real, e o `PUT` é escrita não-idempotente. Testids confirmados direto no bundle de `app.omnicare.dev.local` — achado: o botão de fechar real é `button-close-budget-customization`, não `budget-customization-close` como a PR documentou. Achado de timing: o toast de sucesso é filho da própria modal e fecha junto com ela — não é isoladamente observável, então o teste #182 valida o efeito (PUT 200 + modal fecha), não o toast. Homologado pelo operador e `.only` removido.

</dd></dl>

</details>

<details>
<summary><b>Contexto 22: Modal "Enviar Link de Pagamento": Valor Total só dos Orçamentos Cobráveis e Erro do Envio Classificado pelo Código (Issue front#311, front#332) — 6 testes, 100% mockado</b></summary>

<dl><dd>

- 22.1. **Somar no valor total só o orçamento que ainda pode ser cobrado, avisar que o faturado ficou de fora e parcelar sobre esse total (front#311).**
- 22.2. **Contraprova: com todos os orçamentos marcados cobráveis, o valor total soma todos e não mostra o aviso (front#311).**
- 22.3. **Mostrar o motivo do provedor na recusa `422 PROVIDER_REFUSED` e deixar corrigir e reenviar (front#332).**
- 22.4. **Avisar resultado indeterminado no `502` sem `code`:** pede para conferir a lista de links antes de reenviar e não mostra motivo (front#332).
- 22.5. **Tratar um `code` desconhecido como resultado indeterminado, sem mostrar o motivo do servidor (front#332).**
- 22.6. **Tratar o `502` com `PROVIDER_REFUSED` como recusa, com o texto genérico e sem o aviso de incerteza (front#332).**

> 💡 A modal só abre com `GET /payment-configs` no formato real (`{ items }`): o front valida a resposta de forma estrita, e uma chave a mais derruba a modal num erro de carregamento.

</dd></dl>

</details>
<br>
<br>

</dd></dl>

</details>
<br>

<details>
<summary><b>5-B3 — Mensagens, Reações, Orçamento por Canal e Estado do Compositor (<code>5-B3.atendimentos-chat-mensagens.cy.js</code>) — 52 testes em 10 contextos</b></summary>

<dl><dd>

<br>

<details>
<summary><b>Contexto 12: Timeout de Upload de Mídia em Rede Lenta (Issue #485, PR #478; Issue front#488, PR #482) — 3 testes, 100% mockado</b></summary>

<dl><dd>

- 12.1. **Não exibir "Sem conexão. Tente novamente." nem abortar o envio de um anexo grande quando o servidor demora além do antigo prazo fixo de 15 s:** resposta mockada do upload atrasada 20 s (acima do antigo timeout fixo de 15 s do transporte, abaixo do novo mínimo de 120 s da PR #478) — prova que o temporizador de abort do cliente não corta a requisição antes da conclusão.
- 12.2. **Exibir "O envio demorou demais..." em vez de "Sem conexão" ao estourar o prazo do upload, mantendo o anexo no compositor:** `cy.clock()`/`cy.tick(125000)` avança o relógio do app 125 s (acima do mínimo de 120 s da PR #478) sem esperar de verdade; o `POST` de mídia nunca responde nessa janela.
- 12.3. **[Contraprova] Manter "Sem conexão. Tente novamente." numa queda de rede real, distinto do timeout do cliente:** `forceNetworkError: true` no intercept — prova que o front trata os dois casos com mensagens diferentes.

> 💡 Contexto blindado (`AGENTS.md [R-BLIND]`): o atraso é estado de timing artificial, não reproduzível de forma determinística contra a API real. Reusa `abaixo-teto-15mb.pdf` (#188) e `Anexo de teste jpg.jpg` (#200-#201) já existentes. #188, #200 e #201 homologados pelo operador via `cypress open` no Firefox, `.only` removido. Gap conhecido não coberto (P1, `ROADMAP.md`): a releitura automática da conversa mostrando a mensagem que o servidor já tinha gravado não foi possível validar de forma determinística em rodadas de mock (circuit breaker `AGENTS.md [R-DIAG]`).

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 13: Ícone, Tooltip e Reenvio de Mensagem com Falha no Envio (Issue front#490/PR #484; Issue front#522/backend#614/PR #523; Issue front#524/PR #532) — 11 testes, API real</b></summary>

<dl><dd>

- 13.1. **Exibir o ícone de erro de envio sem o atributo `title` nativo, com o motivo completo em tooltip acessível por mouse e teclado:** valida contra o atendimento real 260900137 (loja 1) que `[data-testid="message-status-error"]` não tem mais `title`, que `[role="tooltip"]` abre com o motivo completo no hover **e** no foco por teclado (Tab), e fecha em mouseout/blur.
- 13.2. **Mostrar "Não enviada · Reenviar" só nas mensagens de saída com status error:** a linha (com `button-retry-message-{id}`) nunca aparece em mensagem enviada ou do cliente.
- 13.3. **Chamar `POST .../messages/{id}/retry` com os ids corretos ao clicar em Reenviar:** sem corpo; botão vira "Reenviando…" com `aria-disabled`; um 2º clique durante a chamada não dispara outra.
- 13.4. **Remover a linha e voltar a mesma mensagem para pendente no sucesso (200), sem inserir mensagem nova:** o sucesso faz um patch direto no cache (React Query), sem esperar um novo `GET` da lista.
- 13.5. **Mostrar o toast "Esta mensagem não pode ser reenviada. A conversa foi atualizada." no 409 `ATTENDANCE_MESSAGE_NOT_RETRYABLE`, relendo só a página 1 da conversa.**
- 13.6. **Mostrar o toast "Este atendimento está sem atendente." no 409 `ATTENDANCE_UNASSIGNED`.**
- 13.7. **Mostrar o mesmo toast de janela de 24h fechada do envio normal no 422 do reenvio** — o front reconhece pelo texto cru do backend, não pelo `code`.
- 13.8. **Mostrar "Não foi possível reenviar a mensagem. Verifique a conexão." em erro de rede**, voltando o botão a ficar clicável.
- 13.9. **Não exibir toast de recusa do reenvio se o atendente já tiver trocado de conversa antes da resposta chegar.**
- 13.10. **Parar a animação do spinner de "Reenviando…" quando o sistema operacional pede `prefers-reduced-motion:reduce`:** emulação via Chrome DevTools Protocol (`cy.forcarPrefersReducedMotion()`).
- 13.11. **[Contraprova] Manter o spinner de "Reenviando…" animando normalmente sem `prefers-reduced-motion`.**

> 💡 Confirmado ao vivo em `app.omnicare.dev.local` antes de escrever (`AGENTS.md [R-TOOLS]`/`[R-EVID]`). #13.2-#13.9 são híbridos: abrem o mesmo atendimento real 260900137 (GETs reais), mas interceptam só o `POST .../retry` por cenário — evita mutar de verdade as 3 mensagens de evidência curadas pelo dev. Gap aceito: não cobrimos "sem permissão/sem atendente" (a linha não deveria aparecer) por falta de massa real com as duas condições ao mesmo tempo; não cobrimos o cenário de "mensagem antiga com histórico rolado" do #13.5 (recarrega tudo) por falta de massa real com histórico suficiente. #13.10/#13.11 não cobrem o spinner de "carregando histórico" nem o skeleton inicial (gap aceito, já têm vitest unitário dedicado). Homologado pelo operador.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 14: Busca Sob Demanda do Conteúdo Binário de Anexos (Issue front#521/backend#612/#613) — 6 testes, API real/híbrido</b></summary>

<dl><dd>

- 14.1. **Buscar o conteúdo de imagem/PDF pela rota nova quando a listagem não traz `url`/`data`, renderizando via Blob tipado pelo `mime_type` da listagem:** confirma `GET .../messages/{id}/attachment` (200) e que o `<img src="blob:...">` carrega um Blob cujo `type` é `image/jpeg` — vindo do `mime_type` da listagem, não do `Content-Type` da resposta.
- 14.2. **Renderizar documentos sem prévia (doc/docx/xls/xlsx/txt) com o botão de baixar imediatamente, sem buscar o conteúdo antes do clique:** `button-download-document-m-{id}` com `aria-label="Baixar documento {filename}"`, nenhum `GET` disparado antes do clique.
- 14.3. **Buscar o conteúdo só ao clicar em "Baixar documento" e devolver ao estado normal depois.**
- 14.4. **Mostrar "Mídia indisponível" sem botão de tentar novamente quando a rota devolve 404** (mensagem sem conteúdo binário) — o front trata o 404 como sucesso com dado nulo, não como erro.
- 14.5. **Mostrar "Não foi possível carregar o anexo" com botão "Tentar novamente" em erro genérico, e resolver ao clicar o retry.**
- 14.6. **Não refazer o `GET` da rota pro mesmo anexo já visível de novo (cache por `message_id`), sem recarregar a página:** o `IntersectionObserver` é one-shot (nunca reobserva).

> 💡 Recurso já no ar na dev. Reverse engineering do bundle real (`index-*.js` + chunk `attachment.rules-*.js`) confirmado antes de escrever (`AGENTS.md [R-EVID]`): mídia busca por visibilidade, documento sem prévia só ao clicar, Blob tipado pelo `mime_type` da listagem. Depende do atendimento real `260900034` (loja 1), curado com 1 anexo de cada tipo já sem `url`/`data` — o mesmo citado no critério de aceite da issue. Achado de infra: o `[data-message-id]` é uma âncora de altura zero, e a conversa reverte um salto único de `scrollTop` (segue-o-fim) — só nudges repetidos resolvem. Gap aceito: não provamos que o compositor segue liberado pro envio durante o carregamento da listagem — o atendimento usado tem a janela de 24h encerrada, sem textarea livre pra testar. **Só validado no Chrome (`AGENTS.md [R-RUN]`):** no Firefox (`cypress open`) a técnica de scroll que aciona a busca sob demanda não tem o mesmo timing e pode falhar de forma não-determinística — confirmado não ser bug de produto (4 rodadas isoladas no Chrome saíram 100% verdes). Homologado pelo operador.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 15: Reações em Mensagens (Issue front#530/PR #536, épico #515, backend#617) — 11 testes, 100% mockado</b></summary>

<dl><dd>

- 15.1. **Mostrar a reação do cliente e a do atendente simultaneamente, até duas por mensagem:** `message-reaction-badge-customer-{id}` e `-employee-{id}` coexistem.
- 15.2. **Renderizar a reação do atendente em estado "enviando" (pending) esmaecida, com `aria-busy`.**
- 15.3. **Mostrar o indicador de falha com o motivo em tooltip acessível no hover e no foco por teclado:** o tooltip com o motivo aparece no hover e no foco e some no `mouseout` e no `blur`; a visibilidade é checada por estilo calculado e retângulo dentro da viewport, porque o tooltip é fixo e sem eventos de ponteiro e o `:visible` do Cypress o rejeita.
- 15.4. **Abrir a linha rápida de reações com as 6 opções padrão (👍 ❤️ 😂 😮 😢 🙏) e o "+" ao clicar no botão de reagir no hover do balão.**
- 15.5. **Disparar `PUT` com o emoji codificado ao escolher na linha rápida, atualizando o badge antes da resposta do servidor (otimista).**
- 15.6. **Disparar `DELETE` e remover a reação otimisticamente ao clicar na própria reação do atendente já aplicada.**
- 15.7. **Remover a reação ao selecionar na linha rápida o mesmo emoji já aplicado** (equivalente ao `DELETE`): o badge some de forma otimista antes da resposta do `DELETE` e continua ausente depois da releitura da listagem, que o mock devolve já sem a reação.
- 15.8. **Abrir o picker completo de emojis ao clicar no "+", inteiro dentro da tela.**
- 15.9. **Reverter a atualização otimista e manter a reação anterior quando o servidor recusa o `PUT` (409).**
- 15.10. **Não exibir o botão de reagir em mensagem com envio ainda pendente (sem wamid confirmado).**
- 15.11. **Renderizar um emoji multi-code-point (👍🏽) inteiro no badge, sem quebrar em pedaços.**

> 💡 Recurso já no ar na dev (PR #536, base `developer`). Testids confirmados via `npm run scan:elements` antes de escrever (`AGENTS.md [R-EVID]`). `data-state` do badge reflete o estado de UI, não o `status` cru da API (`"sent"` → `data-state="settled"`, `"pending"` → `data-state="sending"`, medido contra o DOM real). Gaps aceitos, não cobertos (dependem de telefone físico ou de um mecanismo de SSE sintético inexistente no repo): chegada ao vivo da reação do cliente, reação fora da janela de 24h com motivo real, tema escuro/touch, exclusão do botão especificamente em orçamento, navegação por teclado completa (Tab/Enter).

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 16: Notificação de Orçamento Gerado pela I.A. (exploração do operador, 2026-10-07, sem issue) — 1 teste, 100% mockado</b></summary>

<dl><dd>

- 16.1. **Atualizar sozinho o aviso "processando" para o texto final com o orçamento, sem reload nem ação do usuário, quando a I.A. termina:** a notificação renderiza como evento de sistema centralizado (`_transferEvent_`), e o front refaz `GET .../messages` sozinho a cada ~60s (poll de fallback) mesmo sem nada pendente — o mock troca a resposta por **tempo real decorrido**, não por contagem de chamada, pra não depender de quantos `GET`s de boot o `cy.reload()` dispara.

> 💡 Mesma exploração do `0-B` ctx 13 — escuta ao vivo contra a API real enviando de verdade uma receita pelo WhatsApp (atendimento `261000039`). Achado no caminho: `origin: "internal"` + `transfer_type: 6` é outro contrato já existente ("Nota interna"), não o usado aqui (`origin: "employee"` + `transfer_type: 4`) — só descoberto medindo contra o DOM real.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 17: Texto do Orçamento por Canal na Modal "Enviar Orçamento" (Issue front#443/PR #548) — 6 testes, 100% mockado</b></summary>

<dl><dd>

- 17.1. **Exibir só o cabeçalho sintético da fórmula, sem produtos, quando o canal usa budget_text_type 0 - Sintético:** item mostra "Fórmula nº N" + quantidade/forma farmacêutica, sem detalhar os princípios ativos.
- 17.2. **Exibir os princípios ativos digitados quando o canal usa budget_text_type 1 - Produtos Digitados:** item mostra o produto digitado (nome + quantidade/unidade), sem o texto do rótulo.
- 17.3. **Exibir os produtos digitados e o texto do rótulo da fórmula quando o canal usa budget_text_type 2 - Texto do Rótulo:** mesmo título do tipo 1, com um parágrafo adicional trazendo a composição descritiva completa do rótulo.
- 17.4. **Não exibir o texto do rótulo num orçamento de revenda (sem fórmula) mesmo com o canal em budget_text_type 2:** revenda não tem `label_text` no contrato real, então o parágrafo de rótulo nunca aparece.
- 17.5. **Listar os produtos de um orçamento de revenda mesmo com o canal em budget_text_type 0 - Sintético:** revenda sempre lista o produto (sem fórmula para resumir).
- 17.6. **Manter o comportamento atual (produtos digitados) quando o canal não traz budget_text_type:** compatibilidade com backends ainda não migrados para o campo novo (Issue backend#620/#621).

> 💡 DOM real confirmado contra `app.omnicare.dev.local` (orçamento `#260900369`/atendimento `260900111`) antes de escrever: ícone do item muda entre fórmula (pílula) e revenda (cubo); a forma farmacêutica sai em Title Case ("Capsulas") mas a unidade do produto de revenda sai maiúscula crua ("UN"). 100% mockado: o tenant real só tem 2 canais com tipo fixo, não dá pra medir as 4 variações de forma determinística contra a API real.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 18: Discriminação de Desconto no Orçamento na Modal "Enviar Orçamento" (Issue front#444/PR #548) — 4 testes, 100% mockado</b></summary>

<dl><dd>

- 18.1. **Não exibir subtotal nem desconto quando o canal está em "Não mostrar desconto" (AC1):** item mostra o valor líquido (`amount_with_discount`); totais só com "Valor total".
- 18.2. **Exibir o comparativo bruto/desconto/líquido quando o canal está em "Mostrar desconto" e há desconto real (AC2):** item mostra o valor bruto (`amount`); totais com "Subtotal bruto"/"Total de descontos"/"Valor total".
- 18.3. **Não exibir a linha de desconto quando o canal está em "Mostrar desconto" mas o orçamento não tem desconto real:** "Total de descontos" some, só "Subtotal bruto"/"Valor total" ficam.
- 18.4. **Comportar-se como "Não mostrar desconto" quando o canal não traz `show_discount` (compatibilidade com backend ainda sem o campo):** mesma regra do contrato backend (coluna nula cai em `false`).

> 💡 Mesma variação irmã do context 17 (mesma PR #548, mesmo card) — aqui o canal controla `show_discount` em vez de `budget_text_type`. 100% mockado pelo mesmo motivo (combinação canal × desconto não garantida de forma determinística na API real). O comparativo por fórmula "Valor de ~R$ 60,12~ por R$ 54,11" (riscado) pedido na issue original não existe no front nem no design — gap aceito, bloqueado por definição de UI/UX (Figma #450), não testado aqui.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 19: Contraste no Tema Escuro da Modal "Enviar Orçamento" (Issue front#552/PR #553) — 2 testes, 100% mockado</b></summary>

<dl><dd>

- 19.1. **Exibir fundo escuro nos cards de seleção da modal "Enviar Orçamento" e manter contraste ≥ 4.5:1 (WCAG AA) no código, valor e badge REC no tema escuro:** fundo do card deixa de ser branco sólido; código da receita/orçamento, valor em reais e badge "REC" calculados com razão de contraste ≥ 4.5:1 contra o fundo efetivo; borda da checkbox ≥ 3:1 (WCAG 1.4.11).
- 19.2. **Manter fundo claro e o mesmo contraste ≥ 4.5:1 (WCAG AA) no tema claro, sem regressão de layout ou cores:** contraprova das mesmas 4 verificações do `#19.1` no tema padrão.

> 💡 Medido ao vivo contra `app.omnicare.dev.local`: cores reais capturadas por diagnóstico descartável batem com a tabela de contraste publicada na própria PR #553 (código 13.79:1, valor 5.26:1, badge REC 7.35:1 no tema escuro). Sem utilitário de contraste pronto no repo — fórmula WCAG 2.1 (luminância relativa + razão de contraste, com compositor de alpha-blending para fundos semitransparentes) escrita localmente neste context. Achado no caminho: o botão de alternar tema fica coberto pelo overlay full-screen da própria modal depois de aberta — por isso o tema é sempre decidido antes de abrir a modal, e a alternância dinâmica "com o modal já aberto" citada no roteiro de QA da issue não foi coberta por automação (ver `ROADMAP.md` P2).

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 20: Estado do Compositor Enquanto a Listagem de Mensagens Carrega (Issue backend#572 / front#562) — 3 testes, 100% mockados</b></summary>

<dl><dd>

- 20.1. **Mostrar o carregamento da conversa com o compositor bloqueado enquanto a listagem demora, e liberá-lo sozinho na resposta:** com a resposta de mensagens atrasada, aparecem o skeleton, o aviso "Carregando a conversa…" e o mesmo texto como placeholder do campo, e texto, áudio e anexo ficam desabilitados sem aviso de janela; ao chegar a resposta, o carregamento some, o compositor libera e o placeholder volta ao texto padrão.
- 20.2. **Voltar ao carregamento a cada atendimento novo ao alternar rapidamente entre vários da fila:** o campo mostra "Carregando a conversa…" logo após cada troca, o último atendimento libera sozinho com o placeholder padrão e em nenhum instante o campo fica desabilitado com o placeholder padrão e sem aviso.
- 20.3. **Reabrir direto um atendimento já visitado na sessão:** o atendimento volta do cache sem faixa de carregamento e com o placeholder padrão, sem piscar o carregamento.

</dd></dl>

</details>

<details>
<summary><b>Contexto 21: Marcar Todos / Desmarcar Todos na Modal "Enviar Orçamento" (Issue front#559) — 5 testes, 100% mockado</b></summary>

<dl><dd>

- 21.1. **Abrir com todos marcados e limpar a seleção:** o controle exibe "Desmarcar todos"; ao clicar, os checkboxes desmarcam, o texto vira "Marcar todos", o total zera e "Baixar"/"Enviar para o chat" ficam desabilitados.
- 21.2. **Marcar todos e recalcular o total:** depois de limpar, "Marcar todos" seleciona os 3 orçamentos, volta a "Desmarcar todos" e o total da pré-visualização reflete a soma.
- 21.3. **Seleção parcial:** mantém "Desmarcar todos" e, ao clicar, limpa tudo.
- 21.4. **Marcar um item depois de limpar:** o texto volta a "Desmarcar todos" e o total é só o do item marcado.
- 21.5. **Acessibilidade por teclado:** o controle é um botão nativo habilitado, alcançável por Tab (sem `tabindex` negativo), focável, e mantém o foco depois de alternar.

</dd></dl>

</details>
<br>

</dd></dl>

</details>

</dd></dl>

</details>

### 5-C. Atendimentos: Dados do Cliente (`cypress/e2e/5-C.atendimentos-clientes.cy.js`) — 96 Testes

A terceira parte cobre o cliente vinculado ao atendimento e as guardas de saída: drawer "Dados do Cliente" (com busca e troca de cliente do atendimento), diálogo "Vincular Cliente ao Atendimento" (incl. "Cadastrar novo"), troca de tipo de cliente PF/PJ, e todas as guardas de saída ao fechar gavetas, trocar de atendimento, navegar pelo menu lateral ou atualizar/fechar a aba e voltar pelo navegador com texto não salvo:

<details>
<summary><b>🔍 5-C.atendimentos-clientes.cy.js — 96 testes em 13 contextos (clique para expandir)</b></summary>

<dl><dd>

<br>

<details>
<summary><b>Contexto 1: Painel "Dados do Cliente" (Novo Drawer de Edição - PR #427/#432/#438) — 10 testes, híbrido</b></summary>

<dl><dd>

- 1.1. **Abrir o drawer "Dados do cliente" pelo menu do card do cliente e renderizar a estrutura principal:** Fluxo `button-editar-cliente-icon` > `menu-edit-client`; drawer `painel-editar-cliente` renderiza campos principais.
- 1.2. **Exibir apenas "Pessoa física" e "Pessoa jurídica" no tipo de cliente, sem a opção "Animal" (critério 1 da issue):** Confirma remoção de "Animal" (já ausente no bundle real).
- 1.3. **Alternar o rótulo do documento entre CPF e CNPJ ao trocar o tipo de cliente, exigindo razão social apenas em Pessoa jurídica:** Toggle PF/PJ sem submeter (não muta cliente real).
- 1.4. **Salvar RG e órgão emissor, refletindo os valores enviados no corpo do PATCH:** `PATCH /clients/:id` real; RG dinâmico (`Date.now()`) para não colidir com o fixture já sincronizado de uma rodada anterior.
- 1.5. **Popular o formulário de edição (apelido e CEP) ao selecionar um endereço existente na lista:** Radio de endereço existente abre o formulário de edição.
- 1.6. **Abrir um formulário de novo endereço em branco ao clicar em "Adicionar novo endereço":** `button-client-new-address` reseta o formulário.
- 1.7. **Persistir o apelido do endereço enviado no PATCH:** `PATCH` dedicado `/clients/:id/addresses/:addressId` (rota distinta do PATCH do cliente); apelido dinâmico pelo mesmo motivo do RG.
- 1.8. **Exibir a lupa de busca do CEP no endereço e não exibir mais o link para os Correios:** `button-client-zip-code-search` existe no formulário de endereço e `link-client-zip-lookup` não existe.
- 1.9. **Documento já preenchido (Issue front#527, PR #531): exibir a dica de bloqueio, buscar sem marcar o formulário como alterado e restaurar o valor gravado ao sair sem selecionar:** o campo aqui nunca fica desabilitado — é a mesma busca de troca de cliente do atendimento (Issue front#457); digitar dispara busca, mas não suja o form nem dispara `PATCH`; sair sem escolher sugestão reverte ao documento gravado.
- 1.10. **Cliente sem documento (Issue front#527, PR #531): manter o campo como busca/edição dupla, habilitando Salvar e persistindo o documento digitado no `PATCH` quando nenhuma sugestão for escolhida:** mesmo campo de busca, mas sem documento prévio o valor digitado também vale como edição.

> 💡 **Causa raiz (PRs #427, #432, #438):** menu exige `customer.customer_id`; `client-capabilities`/`resources` são buscados no boot (exige `cy.reload()`); fixture precisa de `notes` objeto (não string) e `gender`/`audit`/`phones[].phone_type`/`addresses[].city.state`, senão "Resposta do serviço inválida". Roda em API real e mock (híbrido); UF do órgão emissor fora do escopo (decisão do operador). Homologado, 19/19 verde em mock. **Documento travado (Issue front#527/PR #531):** regra de dado (nenhuma permissão libera), ver `PROJECT_CONTEXT.md` §8 `/clients`.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 2: Painel "Dados do Cliente" - Fallback de Lista de Endereços Vazia — 1 teste, 100% mockado</b></summary>

<dl><dd>

- 2.1. **Exibir a mensagem de fallback "Nenhum endereço salvo" quando o cliente não possui endereços cadastrados:** 100% mockado (estado sintético não garantido em cliente real); sem endereço prévio, o formulário de criação já vem aberto direto.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 3: Diálogo "Vincular Cliente ao Atendimento" (Issue #440/#441, PR #470; Issue front#497, PR #499) — 14 testes, 100% mockado</b></summary>

<dl><dd>

- 3.1. **Exibir a opção "Vincular cliente" no menu quando o atendimento não tem cliente vinculado:** `menu-link-client` só aparece com `customer.customer_id` ausente (mutuamente exclusivo com `menu-edit-client`).
- 3.2. **Rolar a lista de sugestões com a roda do mouse sem perder a navegação por teclado (regressão corrigida na PR #470):** prova real de scroll via `cy.scrollTo()` no container das sugestões, proxy do conflito de CSS que antes bloqueava o overflow; navegação por seta ↓ continua funcionando.
- 3.3. **Vincular o cliente selecionado, fechar o diálogo e exibir o aviso de sucesso (PR #470):** `PATCH /attendances/:id { customer_id }`; diálogo fecha e um toast (`role="status"`) exibe "Cliente vinculado ao atendimento.".
- 3.4. **Manter o diálogo aberto com o erro em destaque quando o vínculo falhar, permitindo tentar de novo sem recadastrar (PR #470):** erro do servidor mantém o diálogo aberto com um alerta inline (`role="alert"`), nunca um toast solto atrás dele; reenviar sem escolher o cliente de novo funciona.
- 3.5. **Exibir a mensagem "Cliente não encontrado" (422), distinta do erro genérico, quando o cliente selecionado não existir mais (Issue #440/#441):** mensagem própria por tipo de erro — "Cliente não encontrado. Busque novamente." (422) ≠ "Não foi possível vincular o cliente. Tente novamente." (500 genérico).
- 3.6. **Mostrar "Dados do cliente" no menu ⋮, e não "Vincular cliente", depois de vincular com sucesso, quando o detalhe refeito já traz o cliente (Issue #440/#441):** o front invalida o detalhe depois do vínculo e refaz o `GET`; o teste devolve o cliente nesse `GET` e confere `menu-edit-client` visível e `menu-link-client` ausente.
- 3.7. **Exibir o botão "Cadastrar novo" no rodapé, ao lado de Cancelar e Vincular, quando a capability de criar cliente estiver concedida (Issue front#497, PR #499):** `button-link-customer-new-client` só renderiza com `can_create_client` concedida — RBAC bidirecional em `1.permissoes.cy.js`.
- 3.8. **Fechar a busca e abrir o modal "Novo Cliente" ao clicar em "Cadastrar novo":** mesmo componente `NewClientModalSession` da tela de Clientes.
- 3.9. **Criar o cliente, vincular automaticamente ao atendimento e exibir o aviso de sucesso:** mesma mutation `PATCH customer_id` do "Vincular cliente" existente; toast "Cliente cadastrado e vinculado ao atendimento.".
- 3.10. **Avisar quando o vínculo falhar após criar o cliente, e permitir achá-lo pela busca do "Vincular cliente" sem recadastrar.**
- 3.11. **Avisar sobre falta de permissão quando o vínculo falhar com 403 após criar o cliente.**
- 3.12. **Não fechar o modal "Novo Cliente" pelo X, Escape ou clique fora enquanto o cadastro está gravando.**
- 3.13. **Com um drawer lateral aberto (Notas Internas) e Escape com o formulário vazio, fechar só o modal "Novo Cliente", mantendo o drawer aberto.**
- 3.14. **Com um drawer lateral aberto e Escape com o formulário preenchido, perguntar "Descartar este cadastro?" mantendo o drawer aberto.**

> 💡 #148-#151 cobrem só o que a PR #470 entregou. #152-#153 cobrem critérios de aceite adicionais da issue-mãe #440/#441 (a permissão 650 ficou no Contexto 1 de `1.permissoes.cy.js`). #153 (hoje 3.6) era vermelho por causa do mock estático do detalhe e foi corrigido. #238-#246 (Issue front#497, PR #499) implementam o cadastro de cliente novo dentro deste diálogo (corpo original da issue #440 sub-issue, pendente desde a PR #470) — reaproveita o mesmo modal "Novo Cliente" e a mesma mutation de vínculo, confirmado via bundle real. Gap aceito: atualização do cabeçalho/card da fila com o nome do cliente novo não testada (sem `data-testid` confirmado no bundle atual para esse texto); o toast de sucesso já prova o vínculo. Homologado pelo operador.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 4: Guarda de Saída ao Fechar Gavetas com Texto Não Salvo (Issue #345/#458, PR #459/#465/#463; Issue front#461/PR #464; Issue front#468/PR #469) — 20 testes, 100% mockado</b></summary>

<dl><dd>

Diálogo genérico "Descartar texto?" (`role="alertdialog"`, `data-testid="drawer-draft-discard-dialog"`), compartilhado por Notas Internas, Observações e pela troca para qualquer outro painel — testids confirmados via `cy.salvarSnapshotDom`, não supostos. #163-#166 validam o refactor do componente para `shared/components/ConfirmDialog` (Issue #458, PR #463) nesta mesma superfície.

- 4.1. **Abrir "Descartar texto?" ao clicar no X da gaveta de Notas Internas com texto não salvo — "Continuar editando" preserva o texto e "Descartar" limpa e fecha.**
- 4.2. **Disparar o mesmo diálogo ao pressionar Esc com texto não salvo na gaveta.**
- 4.3. **Disparar o diálogo ao clicar em "Mostrar fila" — "Continuar editando" não expande a fila (preferência do atendente inalterada):** o toggle nunca é de fato executado antes da confirmação.
- 4.4. **Disparar o diálogo ao clicar na lupa da busca com a fila recolhida.**
- 4.5. **Disparar o diálogo ao tentar abrir outro painel (IA) — "Descartar" fecha Notas Internas e abre o painel escolhido:** regressão da PR #459 nos painéis da coluna, corrigida pela PR #465.
- 4.6. **Disparar o mesmo diálogo ao fechar a gaveta de Observações com texto não salvo:** paridade entre os dois composers.
- 4.7. **Contraprova — campo vazio fecha direto, sem diálogo.**
- 4.8. **Contraprova — logo depois de Salvar, fecha direto.**
- 4.9. **Contraprova — enquanto a nota está sendo enviada (request em voo), fecha direto sem perguntar.**
- 4.10. **Associar a mensagem do diálogo via aria-describedby (Issue #458):** leitor de tela passa a anunciar a mensagem, não só o título; ids gerados pelo React, não mais pelo `data-testid`.
- 4.11. **Cancelar com Esc sem fechar a gaveta por trás do diálogo (Issue #458):** `stopPropagation` preservado no refactor.
- 4.12. **Não cancelar ao arrastar uma seleção de texto de dentro do diálogo e soltar no fundo (Issue #458):** fix da PR #463 para seleção de texto arrastada.
- 4.13. **Cancelar ao clicar no fundo escuro do diálogo (Issue #458):** contraprova do teste anterior — clique direto (sem seleção) cancela normalmente.
- 4.14. **Exibir "Descartar texto?" ao editar uma observação existente e alterar o texto, preservando a edição em "Continuar editando" e descartando em "Descartar" (Issue front#461, PR #464):** a guarda da #459 só enxergava o composer de nova observação — editar uma observação já existente não publicava nada nela.
- 4.15. **Contraprova — editar uma observação existente sem alterar o texto não pergunta nada.**
- 4.16. **Contraprova — alterar só espaços nas pontas do texto de uma observação existente não pergunta nada (é o mesmo texto).**
- 4.17. **Exibir "Descartar texto?" ao editar a observação A, alterar o texto e clicar no lápis de B — "Continuar editando" preserva a edição de A e "Descartar" a descarta e abre B para edição (Issue front#468, PR #469):** a guarda da #461 só protegia o fechamento da gaveta — trocar de edição entre observações sem fechar nada não disparava nada (o lápis de B ficava habilitado durante a edição de A).
- 4.18. **Contraprova — editar A sem alterar o texto e clicar no lápis de B troca direto, sem perguntar.**
- 4.19. **Contraprova — texto não salvo só no compositor de nova observação não aciona a guarda ao editar outra observação, e o texto novo não se perde.**
- 4.20. **Posicionar o cursor no fim do texto ao entrar em edição de uma observação (Issue front#469):** antes o foco se perdia ao abrir a edição.

> 💡 100% mockado (`AGENTS.md` `[R-BLIND]`) — "gaveta com texto não salvo" não é estado garantido em nenhum atendimento real. Cobertura de "outro painel" (PR #465) usa o painel de IA como representante; Receita e Editar cliente compartilham o mesmo `close()`, não testados individualmente por redundância de mecanismo. Sem regressão nos 26 testes pré-existentes de `7.clientes.cy.js` que passam pelo mesmo `ConfirmDialog`. Homologado pelo operador e `.only` removido (#154-#166). #211-#213 (front#461/PR #464): a lista de Observações não faz nenhuma chamada de rede dedicada visível (sondado sem sucesso antes de desistir de semear via mock) — os 3 testes reusam o fluxo criar→editar já comprovado pelo CRUD #51 em vez de depender do carregamento inicial da lista. Homologado pelo operador e `.only` removido. #223-#226 (front#468/PR #469): mesmo diálogo `drawer-draft-discard-dialog` reaproveitado para a troca entre observações em edição — confirmado via código real dos chunks `NotesDrawerConnected-*.js`/`index-*.js`, não suposto.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 5: Busca de Cliente no Drawer "Dados do Cliente" (Issue front#457, PR #498) — 11 testes, 100% mockado</b></summary>

<dl><dd>

- 5.1. **[RBAC] Não exibir a lista de sugestões sem a permissão 650:** campos continuam inputs comuns — digitar 3 letras não abre popover nem dispara a busca.
- 5.2. **Não abrir a lista só por focar o campo Nome já preenchido, sem digitar.**
- 5.3. **Exibir só o aviso de mínimo de caracteres ao digitar 2 letras, sem disparar a busca.**
- 5.4. **Abrir a lista de sugestões ao completar o 3º caractere no campo Nome completo (Pessoa física).**
- 5.5. **Buscar pelo campo Documento com CPF pontuado e sem pontuação, encontrando o cliente nos dois formatos.**
- 5.6. **Pessoa jurídica — Nome Fantasia dispara a busca mas não acha por fantasia (gap aceito, backend#581); Razão Social funciona normalmente.**
- 5.7. **Não trocar o cliente ao pressionar Enter sem usar as setas do teclado antes.**
- 5.8. **Trocar o cliente do atendimento ao navegar com seta ↓ e Enter, exibir o aviso de sucesso e reabrir a ficha do cliente escolhido com "Salvar dados" desativado:** espera a opção do cliente ficar visível antes da seta e confirma que o destaque do teclado mudou antes do Enter.
- 5.9. **Não mudar nada ao selecionar o próprio cliente já vinculado à ficha (no-op).**
- 5.10. **Bloquear a troca de cliente com aviso quando a ficha tiver alteração não salva, preservando o valor editado.**
- 5.11. **Permitir a troca de cliente normalmente depois de desfazer a alteração não salva.**

> 💡 Componente de busca novo (`edit-client-<campo>-search[-suggestions/-suggestion-<id>]`), distinto do diálogo "Vincular Cliente" do Contexto 25 — mesma rota de busca (`GET /clients?q=`) e mesmo `PATCH .../attendances/:id { customer_id }`. Deploy do PR #498 confirmado ao vivo em `app.omnicare.dev.local` antes de escrever os testes (`AGENTS.md [R-TOOLS]`). Contexto blindado (`AGENTS.md [R-BLIND]`): "atendimento com cliente vinculado, permissão 650 variável" não é estado garantido de forma determinística no ambiente.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 6: Guarda de Saída ao Trocar de Atendimento com Texto Não Salvo (Issue front#460, PR #465) — 7 testes, 100% mockado</b></summary>

<dl><dd>

- 6.1. **Perguntar "Descartar texto?" ao clicar em outra conversa na fila com Notas Internas não salvas:** "Continuar editando" mantém a conversa A aberta com o texto; "Descartar" troca de fato para a conversa B.
- 6.2. **Perguntar ao trocar de conversa pelo rail compacto (fila recolhida) com Notas Internas não salvas.**
- 6.3. **Perguntar ao clicar no X do chat (fechar a conversa) com Notas Internas não salvas, e fechar de fato ao confirmar.**
- 6.4. **Perguntar ao clicar num chip de status da fila com Notas Internas não salvas.**
- 6.5. **Disparar o mesmo diálogo ao trocar de conversa com Observações não salvas.**
- 6.6. **Contraprova: não perguntar ao trocar de conversa com a gaveta vazia (sem texto digitado).**
- 6.7. **Contraprova: não perguntar ao clicar de novo na própria conversa já aberta.**

> 💡 Estende o context 26 (Issue #345/PR #459/#465): antes, trocar de atendimento não consultava a guarda da gaveta, só a da Receita — o texto sumia sem aviso. PR #465 confirmada em produção via bundle real (`app.omnicare.dev.local`): um `leaveGuardRef` composto (`fj(receitaRequestLeave, drawerRequestLeave)`) agora é consultado ao selecionar card/rail, chip de status e X do chat. Achado no caminho: com a gaveta aberta, a fila renderiza automaticamente em modo compacto — os testes usam o rail (`attendance-queue-compact-item-*`), não a lista cheia. Fora do escopo (decisão da issue): Transferir com texto na gaveta não passa pela pergunta. Gap conhecido: composição com a guarda da Receita não testada aqui por falta de seletor confirmado.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 7: Troca de Tipo de Cliente (PF ↔ PJ) no Drawer "Dados do Cliente" (Issue front#506, PR #508) — 4 testes, 100% mockado</b></summary>

<dl><dd>

- 7.1. **Esvaziar documento, nome/razão social, telefone, e-mail, RG e a lista de endereços ao trocar para o tipo oposto ao do cliente vinculado (PF → PJ), bloqueando o Salvar sem disparar PATCH:** o botão Salvar não ganha o atributo `disabled` nativo nesse estado — fica `aria-disabled="true"`, com um guard próprio no código que ignora o clique.
- 7.2. **Manter documento e razão social desabilitados e exibir o aviso de falta de permissão quando o operador não tem a 650 (sem busca disponível):** sem a permissão, o aviso muda de texto e a busca deixa de existir.
- 7.3. **Restaurar os dados carregados ao voltar para o tipo original, sem disparar uma nova requisição de detalhe do cliente:** reversão 100% client-side.
- 7.4. **Recusar a troca de tipo com o mesmo aviso de edição pendente quando houver telefone editado e não salvo, preservando o valor editado e o tipo atual:** reaproveita o aviso/testid `client-pick-blocked` do context 29.

> 💡 Antes da PR #508, clicar no tipo oposto ao do cliente vinculado mantinha os dados do cliente anterior no formulário — risco de o Salvar converter PF em PJ por cima. Evidência extraída diretamente do bundle real (`EditClientDrawerContent-ijM_-VNe.js`, `useEditClientDrawer-BGh5U3t1.js`) e do chunk de tradução (`translate-D6KJ6wqd.js`), nunca adivinhada. Testid novo único da PR (`client-opposite-person-type-hint`) confirmado via `npm run scan:elements`. Fora do escopo (decisão do próprio PR #508): busca não filtra por tipo; o round-trip completo "buscar e vincular" a partir do modo busca já está coberto pelo context 29, não reduplicado. Homologado pelo operador e `.only` removido.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 8: Guarda de Saída ao Navegar pelo Menu Lateral para Fora de Atendimentos (Issue front#467, PR #471) — 6 testes, 100% mockado</b></summary>

<dl><dd>

- 8.1. **Perguntar "Descartar texto?" ao clicar em "Clientes" no menu lateral com Notas Internas não salvas:** "Continuar editando" mantém em Atendimentos com o texto intacto; "Descartar" navega de fato para Clientes.
- 8.2. **Perguntar ao clicar em "Receitas" no menu lateral com uma nova Observação não salva:** paridade de destino.
- 8.3. **Perguntar ao clicar em "Central" (Home) no menu lateral ao editar uma Observação existente e alterar o texto:** paridade com edição, não só criação.
- 8.4. **Contraprova: não perguntar ao clicar no menu lateral com a gaveta aberta mas sem texto digitado.**
- 8.5. **Contraprova: não perguntar no menu lateral ao editar uma observação existente sem alterar o texto.**
- 8.6. **Continuar perguntando "Descartar texto?" no menu lateral depois de ir à tela de Receitas e voltar para Atendimentos (Issue front#569/PR #620):** "Continuar editando" mantém o rascunho.

> 💡 Achado levantado como fora de escopo na correção da #460/PR #465: só a ficha do cliente publicava a guarda de saída no `leaveGuardRef` do outlet (consumido pelo menu lateral) — Atendimentos nunca preenchia esse ref, então sair pelo menu descartava trabalho não salvo sem perguntar, mesmo com as guardas internas (#460) já funcionando para trocar de conversa/fechar o chat/chips. PR #471 publica a mesma guarda encadeada (Receita + gaveta) também nesse ref — reaproveita o mesmo diálogo `drawer-draft-discard-dialog` dos contexts 26/31, sem mecanismo novo. Ids do menu lateral (`sidebar-item-central`/`-receitas`/`-clientes`) confirmados via bundle real (`navRoutes-*.js`), nunca adivinhados. Fora do escopo (decisão do próprio PR #471): voltar do navegador e URL digitada continuam sem perguntar. Gap aceito, não coberto: guarda da Receita suja bloqueando a navegação pelo menu, por falta de seletor confirmado do formulário da Receita dentro do painel do atendimento. Homologado pelo operador via `cypress open` e `.only` removido.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 9: Guarda de Saída ao Atualizar/Fechar a Aba e ao Voltar pelo Navegador — Gaveta de Notas e Observações (Issue front#472, PR #473/#475) — 5 testes, 100% mockado</b></summary>

<dl><dd>

- 9.1. **Acionar o aviso nativo do navegador (beforeunload) com uma Nota Interna não salva, e não acionar sem alteração na gaveta:** testado via evento sintético (`cy.beforeUnloadFoiPrevenido()`) — o Cypress não exibe o diálogo nativo real.
- 9.2. **Acionar o aviso nativo do navegador (beforeunload) com uma Observação nova não salva:** paridade Notas Internas × Observações no mesmo mecanismo.
- 9.3. **Abrir "Sair sem salvar?" ao voltar pelo navegador com uma Nota Interna não salva:** "Continuar editando" mantém a tela e o texto intacto; "Sair" volta para a tela anterior no histórico.
- 9.4. **Contraprova: não abrir nenhum diálogo ao voltar pelo navegador sem alteração na gaveta.**
- 9.5. **Contraprova: sair pelo menu lateral com texto não salvo aciona só o diálogo "Descartar texto?" de sempre, nunca "Sair sem salvar?":** o `useBlocker` só intercepta `historyAction === 'POP'` (voltar/avançar reais), nunca `PUSH` (clique de menu/link).

> 💡 Mecanismo novo e unificado (PR #473 "beforeunload nativo" + PR #475 "voltar/avançar do navegador"): `usePublishUnsavedDraft` — já usada pelas guardas antigas (contexts 26/31/33) — passou também a armar um `beforeunload` nativo e a alimentar um `useBlocker` por trás do diálogo `[data-testid="navigation-unsaved-dialog"]` (título "Sair sem salvar?", mensagem "As alterações não salvas desta tela serão perdidas.", cancelar "Continuar editando", confirmar "Sair"). A Parte B exigiu migrar o roteamento de `BrowserRouter` para `RouterProvider`/`createBrowserRouter` — confirmado no bundle real. Fora do escopo desta rodada (decisão do operador, 2026-10-02): Receita aberta pelo atendimento (mesmo gap dos contexts 31/33) e `/receitas` standalone (sem Page Object real hoje).

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 10: Guarda de Saída ao Atualizar/Fechar a Aba e ao Voltar pelo Navegador — Personalização do Orçamento (Issue front#472, PR #473/#475) — 3 testes, 100% mockado</b></summary>

<dl><dd>

- 10.1. **Acionar o aviso nativo do navegador (beforeunload) ao mudar a cor da personalização, e não acionar sem alteração.**
- 10.2. **Abrir "Sair sem salvar?" ao voltar pelo navegador com a cor da personalização alterada:** "Continuar editando" mantém o valor digitado; "Sair" volta para a tela anterior.
- 10.3. **Contraprova: não acionar nenhum aviso (beforeunload ou voltar do navegador) sem alteração na personalização.**

> 💡 Mesmo mecanismo unificado do context 34, aqui alimentado pelo `isDirty` da modal de personalização de orçamento (Issue #449).

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 11: Guarda de Saída ao Atualizar/Fechar a Aba e ao Voltar pelo Navegador — Drawer "Dados do Cliente" no Atendimento (Issue front#472, PR #473/#475) — 3 testes</b></summary>

<dl><dd>

- 11.1. **Acionar o aviso nativo do navegador (beforeunload) ao editar o RG no drawer "Dados do Cliente", e não acionar sem alteração.**
- 11.2. **Abrir "Sair sem salvar?" ao voltar pelo navegador com o RG editado:** "Continuar editando" mantém o drawer aberto e o valor digitado; "Sair" volta para a tela anterior.
- 11.3. **Contraprova: não acionar nenhum aviso (beforeunload ou voltar do navegador) sem alteração no drawer.**

> 💡 Mesmo mecanismo unificado do context 34, aplicado ao drawer "Dados do Cliente" (context 23). Achado de teste real: reabrir a mesma conversa após navegar (ida-e-volta) reclica o card em vez de usar `garantirAtendimentoAberto()` — o React Query serve do cache sem nova requisição, e o helper trava esperando um `@getAttendanceDetail` que nunca dispara.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 12: Consulta de CEP no Endereço do Drawer "Dados do Cliente" (Issue front#616/PR #619) — 6 testes, 100% mockado</b></summary>

<dl><dd>

- 12.1. **Preencher rua, cidade, UF e bairro ao completar os 8 dígitos do CEP, sem tocar no complemento nem no número:** no formulário de novo endereço do drawer, o CEP `01001000` preenche rua, cidade, UF e bairro, e complemento e número ficam vazios.
- 12.2. **Não sobrescrever a rua editada à mão ao trocar o CEP, mas atualizar cidade, UF e bairro, sem usar o complemento do CEP:** a rua digitada permanece ao trocar para `20040002` (cuja resposta traz complemento), cidade, UF e bairro são atualizados e o Complemento segue vazio.
- 12.3. **Deixar cidade e bairro para escolha manual quando a cidade está fora do catálogo (id nulo), com o nome como termo e o aviso:** com o CEP `99999999`, a cidade recebe o termo da resposta, a UF é preenchida, o bairro fica travado e aparece o aviso "Escolha uma opção da lista.".
- 12.4. **Avisar "CEP não encontrado" no 404 e deixar os campos livres para preencher à mão:** o CEP `00000000` retorna `404`, o aviso aparece e a rua fica editável.
- 12.5. **Avisar que a consulta está indisponível no 503, liberar o preenchimento e consultar de novo pela lupa:** a 1ª consulta retorna `503` e mostra o aviso com os campos livres; a lupa consulta de novo, o aviso some e a rua digitada permanece.
- 12.6. **Bloquear o Salvar (`aria-disabled`) e mostrar "Buscando endereço…" enquanto a consulta do CEP não volta:** com a resposta atrasada em 2 s, aparecem "Buscando endereço…" e o Salvar do drawer com `aria-disabled=true`; quando a resposta chega, o Salvar volta e a rua do CEP é preenchida.

> 💡 Sintetizados: o corpo do `503` e o cliente do drawer. O teste 1.8 verifica a lupa de busca do CEP e a ausência do link dos Correios.

</dd></dl>

</details>

<details>
<summary><b>Contexto 13: Guarda de Saída da Receita em Edição no Overlay do Atendimento (Issue front#467/PR #471, front#472/PR #473/#475) — 6 testes, 100% mockado</b></summary>

<dl><dd>

- 13.1. **Acionar o aviso nativo do navegador (beforeunload) com a Receita suja no overlay, e não acionar com ela limpa.**
- 13.2. **Pedir confirmação ao fechar o overlay pelo X com a Receita suja:** "Continuar editando" mantém a Receita e o valor; "Descartar alterações" fecha e fica no atendimento.
- 13.3. **Pedir a mesma confirmação ao fechar o overlay pelo Esc com a Receita suja:** "Descartar alterações" fecha o overlay.
- 13.4. **Segurar a navegação pelo menu lateral com a Receita suja:** "Continuar editando" fica no atendimento; "Descartar alterações" segue para Receitas.
- 13.5. **Abrir "Sair sem salvar?" ao voltar pelo navegador com a Receita suja:** "Continuar editando" mantém a Receita aberta com o valor.
- 13.6. **Contraprova: com a Receita limpa, o X fecha o overlay e o menu lateral navega sem nenhum aviso.**

> 💡 Trocar de atendimento pela fila com a Receita aberta não tem teste: o overlay cobre a fila, e nenhum usuário chega ao card pelo mouse.

</dd></dl>

</details>
<br>

</dd></dl>

</details>

---

### 6. Receitas (`cypress/e2e/6.receitas.cy.js`) — 68 Testes

Suíte dedicada à validação do módulo de **Receitas (Prescrições)**, operando com o page object `cypress/pages/6.receitasPage.js` e mocks em `cypress/mocks/6.receitasMocks.js`:

<details>
<summary><b>🔍 6.receitas.cy.js — 68 testes em 16 contextos (clique para expandir)</b></summary>

<dl><dd>

<br>

<details>
<summary><b>Contexto 0: Rota e Formulário de Receitas — 2 testes, híbrido</b></summary>

<dl><dd>

- 0.1. **Acessar a página de receitas com sucesso:** Navega até `/receitas` e valida a renderização do título da página e da interface de prescrições.
- 0.2. **Exibir todos os cards e ações principais do formulário de receita ao carregar a tela:** a rota renderiza direto um formulário completo de criação de receita — cabeçalho, fórmula, abas (produtos/posologia/rastreabilidade), paciente/prescritor, entrega, financeiro e o rodapé de ações (Limpar/Digitalizar/Gravar).

> 💡 Achado no caminho: a tela por trás de `/receitas` é um formulário rico (confirmado via `cy.salvarSnapshotDom` contra `app.omnicare.dev.local`), mas a suíte tinha só 1 teste de rota até esta auditoria — nenhum outro elemento tinha sido mapeado.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 1: Receita Aberta pelo Atendimento: Campo Atendimento e Cliente como Paciente (Issue front#576/PR #579) — 6 testes, 100% mockado</b></summary>

<dl><dd>

- 1.1. **Preencher o campo Atendimento com o código do atendimento de onde a Receita foi aberta:** o campo é somente leitura e vem igual ao atendimento aberto.
- 1.2. **Deixar o campo Atendimento vazio quando a permissão 599 (`can_add_movement`) está revogada:** o Paciente já preenchido prova que o rascunho carregou.
- 1.3. **Preencher Paciente e Comprador com o cliente do atendimento:** com "Mesmo que paciente" em Sim.
- 1.4. **Não preencher Paciente nem Comprador quando o atendimento não tem cliente cadastrado:** "Mesmo que paciente" em Não.
- 1.5. **Mostrar o paciente gravado, e não o cliente do atendimento, quando já existe receita gravada:** o overlay abre a receita vinculada.
- 1.6. **Não alterar laboratório, forma nem estoque da receita gravada ao passar com Tab pelos códigos:** o foco segue para a forma e para o Total múltiplo e nenhuma escrita é enviada.

> 💡 100% mockado porque o cenário exige massa específica (cliente vinculado e não vinculado, permissão 599 ligada e desligada, receita gravada). O comportamento foi medido na dev; o cliente do atendimento e a receita gravada são sintéticos. O "Gravar" e o usuário real sem a 599 ficam sem teste.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 2: Preenchimento da Fórmula pelo Teclado: Quantidade para Unidade e Tab nos Códigos (Issue front#576/PR #579) — 9 testes, híbrido</b></summary>

<dl><dd>

- 2.1. **Mover o foco da Quantidade para a Unidade ao digitar a primeira letra:** `100mg` fica Quantidade `100` e Unidade `mg`, com a busca de unidade aberta.
- 2.2. **Manter a quantidade decimal com vírgula (`1,5mg`):** Quantidade `1.5` e Unidade `mg`.
- 2.3. **Tratar o valor colado por cima do número selecionado (`100mg`):** o mesmo resultado da digitação.
- 2.4. **Manter a quantidade anterior quando só uma letra é digitada por cima do número selecionado (`g`):** o número fica e a letra vai para a Unidade.
- 2.5. **Selecionar o laboratório e levar o foco ao código da forma ao pressionar Tab num código existente.**
- 2.6. **Selecionar a forma e levar o foco ao Total múltiplo ao pressionar Tab num código de forma existente.**
- 2.7. **Não selecionar nada ao pressionar Tab num código inexistente:** no laboratório o foco vai à busca por nome; na forma o foco não avança para o Total múltiplo.
- 2.8. **Não escolher nenhum laboratório nem abrir a busca de forma ao pressionar Tab com o código vazio.**
- 2.9. **Não escolher outro laboratório cujo código apenas contém o código digitado:** com os laboratórios 12 e 21, o código `1` não escolhe nada.

> 💡 Roda em Mock e em API real; em API real os códigos vêm da própria API. O Tab é um `keydown` com a ação padrão emulada porque `cy.press` trava o runner. Nenhum teste grava receita.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 3: Fórmula Acrescentada a uma Receita Gravada: Seta ↑, Calcular só com Prévia e Gravar que Cria (Issue front#159/PR #164) — 11 testes, 100% mockado</b></summary>

<dl><dd>

- 3.1. **Acrescentar a 2ª fórmula com a seta ↑, vazia, sem empilhar outra vazia:** a seta e o Calcular ficam desabilitados até a fórmula nova ter conteúdo; nenhuma escrita.
- 3.2. **Fazer só a prévia ao calcular a fórmula acrescentada:** sem criar receita, fórmula nem produto.
- 3.3. **Mostrar o aviso de estoque da prévia e fechá-lo só com o Ok:** nada é criado.
- 3.4. **Criar a fórmula e o produto ao gravar:** o cabeçalho é gravado, a fórmula e o produto são criados e nenhuma outra receita é criada nem calculada.
- 3.5. **Não criar a fórmula de novo ao gravar outra vez depois de o produto ser recusado com 422:** a mensagem da API aparece e o produto fica na tabela.
- 3.6. **Manter as setas do Nº fórmula na ordem de tabulação:** alcançáveis por Tab a partir do campo do Nº fórmula.
- 3.7. **Manter a fórmula acrescentada ao voltar à fórmula 1 e recalculá-la:** laboratório, forma e produto da 2ª continuam lá.
- 3.8. **Manter o aviso do Calcular aberto depois de mais de 10 s (Issue front#568/PR #571):** sem contagem regressiva, com o rodapé "Pressione ESC p/ sair".
- 3.9. **Fechar o aviso do Calcular pelo X e pelo ESC (Issue front#568/PR #571):** calcular de novo reabre o aviso; nada é criado.
- 3.10. **Limitar Quantidade, Múltiplo e QVD ao teto ao sair do campo com um valor absurdo (Issue front#568/PR #572):** viram 999999, 32767 e 999999.
- 3.11. **Desabilitar a seta ↑ de Quantidade, Múltiplo e QVD no teto (Issue front#568/PR #572):** um passo abaixo do teto a seta ainda anda e leva ao teto.

> 💡 100% mockado porque criar fórmula na API real é irreversível (receita não tem exclusão). O comportamento foi medido na dev com as escritas bloqueadas por stub: o Calcular da fórmula acrescentada faz só a prévia e é o Gravar que cria a fórmula e o produto. A ativação das setas por tecla não é comprovável com as ferramentas do Cypress; só a ordem de tabulação é verificada.

</dd></dl>

</details>

<details>
<summary><b>Contexto 4: Texto da Fórmula com Acentos e Pontuação do Word Aparece Íntegro na Tela (Issue backend#655/PR #701) — 3 testes, API real</b></summary>

<dl><dd>

- 4.1. **Mostrar íntegra a posologia gravada com acentos do português e a pontuação do Word:** aspas curvas, travessão, reticências e euro voltam idênticos do banco, sem `?` no lugar.
- 4.2. **Mostrar íntegros o texto do rótulo e a observação do rótulo:** pontuação tipográfica e símbolos do Latin-1.
- 4.3. **Aceitar o emoji digitado na posologia de uma fórmula gravada sem enviar escrita:** o Gravar segue desabilitado, nenhuma escrita de receita sai e o texto gravado no servidor continua o original.

> 💡 Roda contra a API real: a receita temporária nasce pela API (receita não tem exclusão). A tela não tem campo que envie emoji ao servidor (a aba "Obs. receita" é só leitura e a posologia e o rótulo só mudam numa fórmula gravada, com o Gravar desabilitado), então o teste cobre só a leitura.

</dd></dl>

</details>

<details>
<summary><b>Contexto 5: Busca de Prescritor pelo Número do Conselho (CRM) na Tela (Issue backend#658/PR #712) — 3 testes, API real</b></summary>

<dl><dd>

- 5.1. **Listar, ao digitar o número do conselho, os prescritores com esse CRM antes do prescritor de código igual:** a lista da tela fica igual, na ordem, à resposta do servidor.
- 5.2. **Achar o prescritor com CRM salvo com zero à esquerda ao digitar o número sem o zero:** `8746` acha o CRM `08746`, antes do que só tem o código igual.
- 5.3. **Manter a busca por nome:** a tela lista os prescritores que o servidor devolve para o nome.

> 💡 Roda contra a API real; a referência é a própria resposta do servidor. Cada sugestão mostra só o nome e o código: o conselho, o número e a UF que o servidor já devolve ainda não aparecem na tela.

</dd></dl>

</details>

<details>
<summary><b>Contexto 6: Busca de Produto da Fórmula sem Distinguir Acento na Tela (Issue backend#661/PR #713) — 2 testes, API real</b></summary>

<dl><dd>

- 6.1. **Listar, ao digitar o termo com acento, os mesmos produtos do termo sem acento:** `passiflóra` lista na tela o mesmo conjunto de `passiflora`, com `PASSIFLORA EXTRATO SECO`.
- 6.2. **Manter a busca do termo sem acento:** a tela lista os produtos que o servidor devolve.

> 💡 Roda contra a API real; a referência é a própria resposta do servidor. A correção é um script de banco e só vale onde foi aplicado.

</dd></dl>

</details>

<details>
<summary><b>Contexto 7: Lista de Receitas: Tela, Busca, Filtros, Ordem, Rolagem e Navegação (Issue front#569/PR #620) — 14 testes, API real</b></summary>

<dl><dd>

- 7.1. **Exibir o título, as ações, as 7 colunas, a contagem e os chips com contadores ao abrir a lista:** título "Lista de receitas", botão de nova receita, placeholder da busca e ordem "Mais recentes"; colunas Código, Cliente, Prescritor, Tipo, Emissão, Status e Valor total; cada linha com `#código`, tipo, data de emissão, um dos 4 status e valor em reais; contagem "N receitas" e 7 chips com número, só o Todos aceso.
- 7.2. **Manter os contadores coerentes:** a contagem é igual ao chip Todos, que é igual a Humano mais Animal e à soma dos 4 status, sempre por relação entre os contadores da mesma resposta, nunca por valores fixos, porque a massa muda.
- 7.3. **Buscar sem diferenciar maiúsculas nem acentos, em cliente ou prescritor:** `jose` e `JOSÉ` dão o mesmo total, toda linha tem o termo (sem acento) no cliente ou no prescritor e `vinicius` acha clientes "Vinícius".
- 7.4. **Achar a receita pelo código, com ou sem o # da coluna Código:** o código da primeira linha, com e sem `#`, devolve "1 receita" e a linha `row-prescription-<código>`.
- 7.5. **Mostrar "Nenhuma receita encontrada" quando a busca não acha nada e voltar ao início com "Limpar filtros":** a busca sem resultado exibe o estado vazio e nenhuma linha; o botão de limpar apaga a busca, acende só o Todos e traz a lista de volta.
- 7.6. **Filtrar pelo chip Animal só linhas de animal, com os status contando só os animais, e voltar com Todos:** todas as linhas têm o selo Animal, Todos é igual a Humano mais Animal, a soma dos status é igual a Animal e à contagem, e o chip Todos volta ao início.
- 7.7. **Filtrar pelo chip de status Aberta, contando os tipos só nas abertas, e sair do filtro ao clicar de novo:** todas as linhas ficam Aberta, os chips Todos e Aberta ficam acesos, Humano mais Animal é igual a Aberta, os status somam Todos e um novo clique desliga o filtro.
- 7.8. **Combinar Animal com um status sem receitas, mostrar o estado vazio e voltar ao início com "Limpar filtros":** Animal com o status que não tem nenhuma receita de animal (escolhido pelos contadores) exibe o estado vazio, e o botão de limpar volta ao início.
- 7.9. **Alternar a ordem por emissão, mais recentes por padrão e, no clique, mais antigas primeiro:** o botão de ordem começa com título e rótulo "Mais recentes" e emissões não crescentes; o clique muda para "Mais antigas", troca a primeira linha, deixa as emissões não decrescentes com a mais antiga antes da mais recente; um novo clique volta.
- 7.10. **Carregar mais linhas ao rolar e parar em 400 com o aviso para refinar a busca:** abre com 20 linhas, carrega mais ao rolar até parar em 400 e mostra "Mostrando as primeiras 400 receitas. Refine a busca ou use os filtros para ver as demais."
- 7.11. **Abrir a receita pelo link da linha (/receitas/<código>) e voltar à lista pelo botão do navegador:** o link da linha aponta para `/receitas/<código>`, abre o formulário com o código igual e o voltar do navegador retorna à lista.
- 7.12. **Abrir a receita em branco em /receitas/nova ao clicar em "+ Nova receita", sem o botão na tela do formulário:** a rota nova abre com o código vazio e o título "Receitas", sem o botão de nova receita.
- 7.13. **Levar o "Limpar" da receita aberta para /receitas/nova, não para a lista:** o Limpar numa receita aberta leva a `/receitas/nova` com o código vazio.
- 7.14. **Manter a cor própria de cada status (azul, roxo, verde, cinza) nos dois temas, claro e escuro:** o selo de Aberta fica na família azul, Aguardando entrega roxo, Entregue verde e Descartada cinza, no tema em que a tela abre e no alternado; o roxo muda de tom ao trocar de tema. Não afirma contraste mínimo, porque o visual segue o protótipo e é decisão de produto.

> 💡 Só leitura, medido na tela real. Sem teste: a linha de animal com tutor ("Tutor(a): <nome>"), porque a massa de dev só tem animal sem cliente, e a guarda de Atendimentos ao vir da receita.

</dd></dl>

</details>

<details>
<summary><b>Contexto 8: Lista de Receitas: Carregamento, Erro e Sem Acesso à Lista (Issue front#569/PR #620) — 3 testes, 100% mockado</b></summary>

<dl><dd>

- 8.1. **Mostrar "Sem acesso à lista de receitas", sem tabela, quando a permissão 145 (can_list_recipes) está revogada:** com `can_list_recipes` falso nas capabilities, a tela exibe "Sem acesso à lista de receitas" e "Peça ao administrador a permissão de listar receitas.", sem a tabela.
- 8.2. **Mostrar o skeleton enquanto a lista carrega e trocá-lo pelas linhas quando a resposta chega:** com a busca de receitas atrasada em 2 s, o skeleton aparece e depois dá lugar à linha e a "1 receita", sem o skeleton.
- 8.3. **Mostrar "Não foi possível carregar as receitas." com "Tentar de novo" quando a lista falha:** a busca e os filtros continuam na tela, e tentar de novo carrega as linhas e tira o erro.

> 💡 Sintetizado: as capabilities com `can_list_recipes` falso e a lista de 1 receita (`prescriptionsSearch.json`). O identificador do skeleton vem do bundle do front e o texto do "sem acesso" foi visto na tela real.

</dd></dl>

</details>

<details>
<summary><b>Contexto 9: Guarda de Saída da Receita em Edição pelo Menu Lateral (Issue front#569/PR #620) — 4 testes, API real</b></summary>

<dl><dd>

- 9.1. **Perguntar "Sair sem salvar?" ao clicar em "Receitas" com o Múltiplo alterado e manter a receita com "Continuar editando":** em `/receitas/nova`, com o Múltiplo de 1 para 2, o clique em "Receitas" abre o diálogo ("Sair sem salvar?" / "As alterações não salvas desta tela serão perdidas.") sem mudar a rota; "Continuar editando" fecha o diálogo e mantém o Múltiplo 2.
- 9.2. **Sair para a lista de receitas ao confirmar "Sair":** o "Sair" fecha o diálogo e leva a `/receitas` com a tabela.
- 9.3. **Perguntar também ao clicar em outra aba do menu (Clientes) e só trocar de tela no "Sair":** o clique em "Clientes" abre o diálogo com a rota inalterada e o "Sair" vai a `/clientes`.
- 9.4. **Contraprova: não perguntar ao clicar em "Receitas" com a receita em branco, sem alteração:** sem alteração, o clique em "Receitas" vai direto à lista, sem diálogo.

> 💡 Nenhuma escrita (sem POST nem PATCH). Sem teste: a guarda de Atendimentos ao vir da receita ou da ficha do cliente.

</dd></dl>

</details>

<details>
<summary><b>Contexto 10: Data de Retorno da Fórmula Gravada no Rodapé da Receita (Issue backend#791, front PRs #642/#647) — 1 teste, API real</b></summary>

<dl><dd>

- 10.1. **Deve mostrar no rodapé a data de retorno gravada na fórmula, habilitada para a conta com a 449:** a data gravada aparece no rodapé da fórmula e pode ser editada por quem tem a permissão.

> 💡 A receita temporária é criada pela API com a data de retorno calculada a partir do dia da rodada.

</dd></dl>

</details>

<details>
<summary><b>Contexto 11: Selo Receituário na Busca de Produtos e Receita com Produto Carregando, contra a API Real (Issue front#331) — 2 testes</b></summary>

<dl><dd>

- 11.1. **Deve mostrar o selo Receituário na sugestão do produto cuja portaria exige o receituário e não mostrá-lo no produto comum:** o controlado é sinalizado na busca.
- 11.2. **Deve abrir a receita com produto na fórmula sem erro de carregamento, com o payload novo do receituário:** a receita com produtos continua abrindo.

> 💡 Os produtos (um controlado e um comum) são descobertos pela busca a cada rodada; o 11.2 cria uma receita temporária.

</dd></dl>

</details>

<details>
<summary><b>Contexto 12: Selo Receituário Decidido pelos Dois Booleanos, não pelo Código da Portaria — 100% Mockado (Issue front#331) — 1 teste</b></summary>

<dl><dd>

- 12.1. **Deve mostrar o selo quando só o número ou só a data é exigido e não mostrá-lo no código fora da faixa com os dois booleanos falsos:** a tela segue os campos prontos do servidor, não reinterpreta o código.

</dd></dl>

</details>

<details>
<summary><b>Contexto 13: Concluir a Receita com Data e Hora de Entrega, Trocar a Hora Concluída e Desfazer a Conclusão, contra a API Real (Issue front#628) — 1 teste</b></summary>

<dl><dd>

- 13.1. **Deve concluir a receita com a data e a hora de entrega do rodapé, gravar a hora trocada depois de concluída e apagar a data ao desfazer a conclusão:** a data de entrega vai junto com a conclusão e some ao desfazê-la.

> 💡 Uma receita temporária pronta para concluir é criada pela API a cada rodada; a data e a hora são preenchidas sem clicar no campo, porque o seletor nativo de data exige gesto real do usuário.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 14: Data de Retorno da Fórmula: Tratamento de Uso Contínuo depois do Calcular, Gravar e Reabrir, Cancelar e a Fila ao Concluir, contra a API Real (Issue front#629) — 4 testes</b></summary>

<dl><dd>

- 14.1. **Abrir o Tratamento de uso contínuo depois do Calcular e calcular os dias e a data pela posologia:** Dia, Hora e Semana, com vírgula; zero não deixa confirmar.
- 14.2. **Gravar a data do Confirmar e mostrá-la ao reabrir:** o Gravar manda só a data de retorno.
- 14.3. **Não reabrir o modal no Calcular seguinte depois de Cancelar:** o botão "Calcular data de retorno" do rodapé reabre.
- 14.4. **Pedir a data de retorno de cada fórmula concluída sem ela ao marcar Concluído, na loja que exige:** uma fórmula por vez, "(1 de 2)" e "(2 de 2)".

> 💡 Receitas temporárias com um produto de uso contínuo são criadas pela API a cada rodada (3 por execução); nada é concluído no Gravar.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 15: Entrega do Laboratório no Rodapé ao Concluir e ao Desfazer, e o Cliente antes do Laboratório Recusado, contra a API Real (Issue front#630) — 2 testes</b></summary>

<dl><dd>

- 15.1. **Preencher a Data e a Hora do laboratório com a entrega do cliente ao concluir, sem recarregar, mantê-las ao reabrir e limpá-las ao desfazer a conclusão:** no modo manual, o laboratório acompanha o cliente.
- 15.2. **Recusar na receita concluída a entrega do cliente antes da do laboratório, com o aviso traduzido:** as datas gravadas não mudam.

> 💡 Duas receitas temporárias prontas para concluir são criadas pela API a cada rodada; o modo automático da tabela de horários fica fora do teste porque a loja de teste está em modo manual.

</dd></dl>

</details>
<br>

</dd></dl>

</details>

---

### 7. Clientes (`cypress/e2e/7.clientes.cy.js`) — 63 Testes

Suíte dedicada à validação do módulo de **Clientes** (`/clientes`, listagem/busca/cadastro/edição), operando com o page object `cypress/pages/7.clientesPage.js` e mocks em `cypress/mocks/7.clientesMocks.js`:

<details>
<summary><b>🔍 7.clientes.cy.js — 63 testes em 11 contextos (clique para expandir)</b></summary>

<dl><dd>

<br>

<details>
<summary><b>Contexto 1: Navegação e Formulário de Busca — 1 teste, híbrido</b></summary>

<dl><dd>

- 1.1. **Navegar até clientes e renderizar o formulário:** Navega pelo item canônico da barra lateral (`sidebar-item-clientes`) até `/clientes` e valida a renderização da página, do formulário de busca (`client-filter-bar`: campo de busca e filtros Todos/Pessoa/Animal) e da lista já cheia sem termo digitado (Issue backend#586/#588/front#510 — recorte mínimo de 3 caracteres removido).

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 2: Cadastro de Cliente (Modal Novo Cliente) — 7 testes, 100% mockado</b></summary>

<dl><dd>

- 2.1. **Abrir a modal Novo Cliente e exibir os campos do formulário:** Com a dispensa de gênero desativada (perfil padrão), valida `modal-new-client`, tipo de pessoa (física, default), nome e gênero visíveis e botão salvar habilitado.
- 2.2. **Exibir o campo de gênero só para pessoa física:** Alterna entre pessoa física/jurídica e confirma que `select-new-client-gender` monta e desmonta conforme o tipo selecionado.
- 2.3. **Cadastrar um cliente pessoa física informando só o nome (dispensas concedidas) e redirecionar para a ficha:** Com as 5 dispensas de obrigatoriedade concedidas, `POST /clients` sai só com `{name, person_type}`; valida o fechamento da modal e a navegação para `/clientes/:id`.
- 2.4. **Tratar 409 CLIENT_ALREADY_EXISTS exibindo o link para a ficha existente:** Simula documento duplicado e valida o link `link-new-client-existing` apontando para o cliente conflitante, com a modal permanecendo aberta.
- 2.5. **Cadastrar PJ com Razão Social e CNPJ:** Medido na API real: PJ envia `name` (mesma chave da PF), não `label_name`.
- 2.6. **Exibir "Descartar este cadastro?" ao fechar a modal com campo preenchido (Issue #458, PR #463):** mesmo `ConfirmDialog` compartilhado da gaveta de notas (`modal-new-client-discard`, `-cancel`, `-confirm`); "Continuar preenchendo" mantém o texto, "Descartar" fecha as duas modais.
- 2.7. **Filtrar o campo de grupo ignorando acento e caixa (Issue front#551/PR #558):** a lista de grupos vem inteira de `GET /client-groups` e é filtrada no front; digitar `sao`, `SÃO`, `indicação` ou `ACADEMIA` acha o grupo cadastrado com outra grafia, e um termo sem correspondência mostra "Nenhum resultado encontrado.".

> 💡 Contexto blindado (`AGENTS.md [R-BLIND]`): a capability `can_create_client` e as dispensas de obrigatoriedade não são garantidas de forma determinística na API real, e o cadastro é uma escrita não-idempotente que deixaria dado de teste permanente na base — o contrato bruto de `POST /clients` já é validado com limpeza em `0-A/0-B/0-C.backend-*.cy.js`. Homologado pelo operador.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 3: Editar Cliente (Ficha do Cliente) — 15 testes, 100% mockado</b></summary>

<dl><dd>

- 3.1. **Renderizar as seções da ficha ao abrir a partir da lista:** Busca um cliente na listagem, clica no resultado e valida todos os cards da ficha (identificação, telefones, endereços, email, imposto, desconto, classificação, notas, animais).
- 3.2. **Botão Salvar dados desabilitado sem alterações:** Confirma o gate por `isDirty` — desabilitado no carregamento, habilita ao editar um campo.
- 3.3. **Editar nome e "em débito" com PATCH seletivo:** `PATCH /clients/:id` sai só com os campos realmente alterados (dirty-patch), com toast de sucesso.
- 3.4. **Adicionar um novo telefone (escrita imediata):** O card de telefones tem mutação própria — `POST /clients/:id/phones` dispara direto, sem passar pelo botão "Salvar dados".
- 3.5. **Remover um telefone existente com confirmação:** `DELETE /clients/:id/phones/:phoneId` após confirmar no modal.
- 3.6. **Adicionar um novo endereço via busca de cidade/bairro e salvar:** Formulário inline com typeahead; `POST /clients/:id/addresses` (endereço tem endpoint próprio, não é PATCH de cliente).
- 3.7. **Remover um endereço existente com confirmação:** `DELETE /clients/:id/addresses/:addressId` após confirmar no modal.
- 3.8. **Guarda de saída com alterações não salvas:** Suja o formulário, clica em voltar, confirma a saída no modal de alterações não salvas e descarta.
- 3.9. **Editar o endereço existente pelo formulário inline:** `PATCH /clients/:id/addresses/:addressId`.
- 3.10. **Campo Nome em leitura sem `can_change_client_name`:** Capability ausente desabilita o campo em vez de escondê-lo.
- 3.11. **Inativar o cliente confirmando a modal do toggle Ativo:** `POST /clients/:id/deactivation` `{active:false}`, fora do fluxo "Salvar dados".
- 3.12. **Mapear as 3 abas para `notes.client/weighing/attendance`:** Alternar aba troca o conteúdo do textarea.
- 3.13. **Documento (CPF/CNPJ) travado quando já preenchido (Issue front#527, PR #531):** campo de documento e seletor Pessoa física/jurídica desabilitados, com a dica "O documento (CPF/CNPJ) já preenchido e o tipo de cliente não podem ser alterados." — regra de dado, nenhuma capability libera.
- 3.14. **Cliente sem documento: campo e seletor editáveis, gravando o documento no `PATCH` e travando o campo na hora, sem reload:** atualização otimista do cache logo após o sucesso da mutação.
- 3.15. **Tratar o `422 CLIENT_DOCUMENT_LOCKED` exibindo a mensagem do backend:** cenário de ficha desatualizada (documento já gravado por outra via entre o carregamento e o salvamento).

> 💡 Contexto blindado (`AGENTS.md [R-BLIND]`): o "Salvar dados" pode disparar até 3 escritas não-idempotentes em sequência (cliente, telefone, endereço); o contrato bruto já está coberto em `0-A/0-B/0-C.backend-*.cy.js` (dirty patch e CRUD de telefones/endereços). **Documento travado (Issue front#527/PR #531):** backend pharmacie-backend#615/#606, ver `PROJECT_CONTEXT.md` §8 `/clients`.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 4: Listagem — Filtros, Rolagem Infinita, Busca e Ordenação — 15 testes, 100% mockado</b></summary>

<dl><dd>

- 4.1. **Mapear as pills Todos/Humano/Animal para o parâmetro `type`, sem exigir termo de busca:** Cada pill dispara `GET /clients?type=all|human|animal`; a 1ª chamada já sai com `q` vazio.
- 4.2. **Exibir o nome do tutor e manter a linha de animal não-navegável:** `guardian_id` já vem na API real, mas o front ainda não navega com ele — a linha de animal segue sem link, com `title` explicando o motivo.
- 4.3. **Abrir a tela com a lista cheia sem exigir termo de busca (Issue backend#586/#588):** Recorte mínimo de 3 caracteres removido — a tela já lista de cara.
- 4.4. **Marcar visualmente um cliente inativo:** Linha com `active:false` renderiza sem quebrar.
- 4.5. **Aguardar a digitação parar antes de buscar:** Só 1 requisição adicional após digitar sem pausas (debounce de 300ms).
- 4.6. **Descartar resposta de termo antigo em corrida com o mais recente:** Resposta atrasada de um termo anterior não sobrescreve o resultado do termo final.
- 4.7. **Alternar o rótulo do botão e reordenar sem nova requisição:** Medido na API real que não existe parâmetro de ordenação — o toggle reordena só os itens já carregados.
- 4.8. **Mostrar a dica de recorte mínimo só para termo de 1-2 caracteres (Issue backend#586/#588):** "Busque um cliente"/"Digite ao menos 3 caracteres" — não aparece com o campo vazio, só com 1-2 caracteres digitados.
- 4.9. **Limitar o campo de busca a 60 caracteres com o texto "nome, código ou documento".**
- 4.10. **Carregar a página seguinte automaticamente ao rolar até o fim (rolagem infinita, Issue backend#586/#588):** Substitui os antigos botões "Anterior"/"Próxima".
- 4.11. **Deduplicar uma linha repetida entre duas páginas** (mesmo tipo+id).
- 4.12. **Desligar o carregamento automático ao ordenar por "Nome (A-Z)":** Ordenação por nome só reorganiza o que já carregou, sem puxar mais páginas.
- 4.13. **Manter as linhas carregadas e oferecer "Tentar novamente" só pra página que falhou ao rolar.**
- 4.14. **Parar no teto de 20 páginas (600 linhas) e avisar "Refine a busca para ver mais clientes".**
- 4.15. **Resetar a rolagem pra só a página 1 ao sair da tela e voltar:** cache truncado no cleanup, sem nova requisição dentro do `staleTime`.

> 💡 Reescrito em 2026-10-06 (Issue backend#586/#588, front#510): recorte mínimo de busca removido, paginação por botões substituída por rolagem infinita, envelope sem `total`/`total_pages`.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 5: Navegação — Gate por Recurso "customer" (antigo "patient") — 2 testes, 100% mockado</b></summary>

<dl><dd>

- 5.1. **Bloquear sidebar e conteúdo sem o recurso contratado:** Sem `patient`, o item some da sidebar e a rota exibe aviso de recurso não contratado (fail-closed).
- 5.2. **Decidir o item Clientes da sidebar pelo recurso "customer", ignorando o nome anterior "patient" (Issue backend#808, front#643):** só o `customer` liga ou desliga o menu de Clientes.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 6: Guarda de Saída ao Atualizar/Fechar a Aba e ao Voltar pelo Navegador — Ficha do Cliente (Issue front#472, PR #473/#475) — 3 testes, 100% mockado</b></summary>

<dl><dd>

- 6.1. **Acionar o aviso nativo do navegador (beforeunload) ao editar o nome na ficha, e não acionar sem alteração.**
- 6.2. **Abrir "Sair sem salvar?" ao voltar pelo navegador com o nome editado na ficha:** "Continuar editando" mantém o valor digitado; "Sair" volta para a listagem. Entra na ficha pela busca + clique no resultado (navegação real da SPA) — abrir via `cy.visit()` direto é carga completa e cai fora do escopo do `useBlocker`.
- 6.3. **Contraprova: não acionar nenhum aviso (beforeunload ou voltar do navegador) sem alteração na ficha.**

> 💡 Mesmo mecanismo unificado de `5-C.atendimentos-clientes.cy.js` context 9 (`usePublishUnsavedDraft`/`navigation-unsaved-dialog`), aqui alimentado pelo `isDirty` da própria `ClientDetailPage`.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 7: Guarda de Saída ao Atualizar/Fechar a Aba e ao Voltar pelo Navegador — Cadastro de Cliente (Modal Novo Cliente) (Issue front#472, PR #473/#475) — 3 testes, 100% mockado</b></summary>

<dl><dd>

- 7.1. **Acionar o aviso nativo do navegador (beforeunload) com o cadastro de Novo Cliente preenchido, e não acionar com a modal vazia.**
- 7.2. **Abrir "Sair sem salvar?" ao voltar pelo navegador com o cadastro preenchido:** "Continuar editando" mantém a modal aberta e o valor digitado; "Sair" volta para a tela anterior. O diálogo é global — dispara mesmo com uma modal (não uma rota inteira) suja.
- 7.3. **Contraprova: não acionar nenhum aviso (beforeunload ou voltar do navegador) com a modal vazia.**

> 💡 Distinto do diálogo pré-existente "Descartar este cadastro?" (`modal-new-client-discard`, context 2 #7, Issue #458): aquele cobre fechar a modal pelo X/clique fora, este cobre especificamente voltar/avançar pelo navegador e atualizar/fechar a aba.

</dd></dl>

</details>

<details>
<summary><b>Contexto 8: Busca na Listagem de Clientes sem Distinção de Acento e Caixa (Issue backend#628/PR #629) — 1 teste, API real</b></summary>

<dl><dd>

- 8.1. **Devolver os mesmos clientes ao buscar "mar", "már" e "MAR" na barra de busca da tela Clientes.**

> 💡 Referência da issue (procedure `CAD_CLIENTE_CON`): prova que a mudança dos demais predicados não a regrediu.

</dd></dl>

</details>

<details>
<summary><b>Contexto 9: Consulta de CEP no Endereço da Ficha do Cliente (Issue front#616/PR #619) — 9 testes, API real</b></summary>

<dl><dd>

- 9.1. **Trocar o link "Consultar CEP nos Correios" pela lupa de busca ao lado do CEP:** no formulário de novo endereço da ficha, `button-client-zip-code-search` fica visível, e `link-client-zip-lookup` e `a[href*=correios]` não existem.
- 9.2. **Preencher rua, cidade, UF e bairro ao completar os 8 dígitos do CEP, sem tocar no complemento nem no número:** o CEP `01001000` dispara `GET /zip-codes` com 200 e o campo exibe a máscara `01001-000`; a rua é igual à da resposta, cidade e bairro são iguais aos da resposta sem acento nem caixa (a tela mostra iniciais maiúsculas), a UF é a da resposta, e complemento e número ficam vazios.
- 9.3. **Não preencher o complemento com a faixa do CEP ("de 128 a 144 - lado par"):** com o CEP `20040002`, a resposta traz `complement` e o campo Complemento continua vazio.
- 9.4. **Não sobrescrever a rua editada à mão ao trocar o CEP, mas atualizar cidade, UF e bairro:** a rua digitada à mão permanece ao trocar para `20040002`, enquanto cidade, UF e bairro passam a ser os do novo CEP.
- 9.5. **Voltar a aceitar o CEP num campo esvaziado à mão:** a rua preenchida pelo CEP e depois esvaziada à mão volta a receber a rua do próximo CEP.
- 9.6. **Deixar cidade e bairro para escolha manual quando a cidade está fora do catálogo (id nulo), com o nome como termo e o aviso:** com o CEP `99999999` (`city.id` nulo), a cidade recebe o nome devolvido como termo, a UF é a da resposta, o bairro fica travado e aparece o aviso "Escolha uma opção da lista.".
- 9.7. **Zerar a UF ao editar a cidade sugerida pelo CEP e manter o aviso até escolher uma cidade da lista:** apagar uma letra da cidade zera a UF e o aviso continua visível.
- 9.8. **Avisar "CEP não encontrado" no 404 e deixar os campos livres para preencher à mão:** o CEP `00000000` retorna `404`, o aviso "CEP não encontrado. Preencha o endereço manualmente." aparece e rua e cidade ficam editáveis.
- 9.9. **Tentar de novo pela lupa depois de um CEP não encontrado, sem tirar os campos do preenchimento manual:** a lupa repete a consulta (2 chamadas), o aviso segue visível e os campos continuam livres.

> 💡 Medido na UI real: a consulta chama só `GET /zip-codes?zip_code=<cep>`, sem rotas de cidade nem de bairro (a tela usa os nomes e o `id` da própria resposta), e não grava nada. As asserções comparam a tela com a resposta da própria API. A lupa não repete a consulta de um CEP já resolvido; ela consulta o CEP salvo do endereço aberto e tenta de novo depois de uma falha.

</dd></dl>

</details>

<details>
<summary><b>Contexto 10: Consulta de CEP na Ficha: Endereço Salvo, Consulta Indisponível e Salvar Bloqueado (Issue front#616/PR #619) — 4 testes, 100% mockado</b></summary>

<dl><dd>

- 10.1. **Não consultar o CEP ao abrir um endereço salvo e mostrar a lupa no lugar do link dos Correios:** um endereço salvo com o CEP `74610030` abre com o CEP mascarado e a lupa visível, sem o link e sem nenhuma chamada a `GET /zip-codes`.
- 10.2. **Avisar que a consulta está indisponível no 503, liberar o preenchimento e a gravação e consultar de novo pela lupa:** a 1ª consulta retorna `503` e mostra o aviso "Consulta de CEP indisponível no momento. Preencha o endereço manualmente.", com a rua editável e o Salvar liberado; a lupa consulta de novo (200), o aviso some, a rua digitada permanece e a cidade vem do CEP.
- 10.3. **Bloquear o Salvar (`aria-disabled`) enquanto a consulta do CEP não volta e só gravar depois, com o CEP, a rua e a cidade novos:** com a resposta atrasada em 2 s, aparecem "Buscando endereço…" e o Salvar com `aria-disabled=true`, e o clique não envia o `PATCH`; quando a resposta chega, o Salvar volta e o `PATCH` leva `zip_code`, `street`, `city_id` e `neighborhood_id` do CEP, sem `complement`.
- 10.4. **Consultar o CEP salvo ao clicar na lupa de um endereço aberto, sem mexer no número:** a lupa consulta `zip_code=74610030` (o CEP que já estava no endereço), atualiza a rua e preserva o número.

> 💡 Sintetizados: o corpo do `503` (a queda da consulta não dá para provocar na dev) e o cliente da ficha (endereço com CEP salvo). As respostas de CEP são as medidas na API real. O Salvar durante a consulta não fica `disabled`: fica `aria-disabled` e ignora o clique.

</dd></dl>

</details>

<details>
<summary><b>Contexto 11: Consulta de CEP no Cadastro Novo de Cliente (Issue front#616/PR #619) — 3 testes, 100% mockado</b></summary>

<dl><dd>

- 11.1. **Mostrar a lupa no campo CEP, sem o link dos Correios, quando o endereço é obrigatório no cadastro:** com `can_create_client_without_address: false`, a modal "Novo cliente" mostra `input-new-client-zip-code` com a lupa `button-new-client-zip-code-search` e sem o link.
- 11.2. **Preencher rua, cidade, UF e bairro ao completar os 8 dígitos do CEP, sem tocar no complemento nem no número:** o CEP `01001000` no cadastro novo preenche rua, cidade, UF e bairro a partir da resposta, e complemento e número ficam vazios.
- 11.3. **Avisar "CEP não encontrado" no 404 e deixar os campos livres para preencher à mão:** o CEP `00000000` retorna `404`, o aviso aparece na modal e a rua fica editável.

> 💡 A seção de endereço só aparece na modal quando o endereço é obrigatório para o usuário; a conta de teste tem a dispensa, por isso o contexto é mockado. O componente é o mesmo da ficha, com o prefixo `new-client`.

</dd></dl>

</details>
<br>

</dd></dl>

</details>

---

### 8. Automações (`cypress/e2e/8.automacoes.cy.js`) — 60 Testes

Suíte dedicada à validação da tela de **Automações** (`/automacoes`: listagem, cadastro, construtor de passos, validação de ativação e histórico de execuções), operando com o page object `cypress/pages/8.automacoesPage.js` e mocks em `cypress/mocks/8.automacoesMocks.js`; a massa temporária é criada e apagada pela API (`backendApiService.js`), sem depender de automação fixa da dev:

<details>
<summary><b>🔍 8.automacoes.cy.js — 60 testes em 7 contextos (clique para expandir)</b></summary>

<dl><dd>

<br>

<details>
<summary><b>Contexto 1: Navegação e Listagem de Automações (Issue front#605/PR #604) — 9 testes, API real</b></summary>

<dl><dd>

- 1.1. **Abrir Automações pelo item do menu e mostrar a busca e os filtros Todas, Ativas e Pausadas:** a URL casa `/automacoes` e a página da lista, o campo de busca e os três filtros (`all`, `active`, `paused`) ficam visíveis.
- 1.2. **Mostrar a automação criada com o nome gravado e o switch de pausada:** o cartão da automação temporária exibe o nome gravado e o switch com `aria-checked="false"`.
- 1.3. **Buscar pelo nome sem distinguir acento nem caixa:** digitar o nome sem acento e em minúsculas deixa só o cartão que casa; com acento e em maiúsculas, também.
- 1.4. **Separar as automações pausadas das ativas pelos filtros:** Pausadas traz as duas automações da massa; Ativas não traz nenhuma.
- 1.5. **Abrir o construtor pelo botão Editar do cartão:** o campo de nome vem com o nome gravado e o selo de estado em `paused`.
- 1.6. **Abrir o histórico de execuções e mostrar o estado vazio:** a URL vai para `/automacoes/{id}/execucoes` e a automação que nunca rodou mostra "Nenhuma execução ainda.".
- 1.7. **Carregar o histórico de 20 em 20 pelo botão Carregar mais, sem repetir nem pular execução, e esconder o botão no fim (Issue backend#743):** a lista da tela bate com o histórico da API, página a página.
- 1.8. **Marcar com o selo Padrão toda automação padrão da lista real e travar o Excluir dela, sem marcar nem travar a automação comum da rodada (Issue backend#747):** as padrão da farmácia aparecem marcadas e não podem ser excluídas pela tela.
- 1.9. **Mostrar no histórico um texto próprio para cada falha do passo Enviar webhook, sem o código cru (Issue front#672):** rede interna, sem resposta a tempo, sem conexão, status do destino e passo indisponível têm cada um a sua frase.

> 💡 Front contra a API real, só leitura: o `before` cria 2 automações pausadas pela API (nome e palavra-chave com um token único da rodada, que nunca casa com mensagem real) e o `after` apaga as duas.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 2: Listagem de Automações: Recurso Não Contratado, Estados e Automações Padrão (Issue front#605/PR #604, PR #679) — 4 testes, 100% mockado</b></summary>

<dl><dd>

- 2.1. **Esconder o item Automações do menu e mostrar o aviso de recurso não contratado quando a farmácia não tem o recurso `automation`:** o item `Automações` some da barra lateral e a rota direta mostra "Automações não está disponível para a sua farmácia.".
- 2.2. **Marcar com o selo "Padrão" só a automação padrão e travar o Excluir dela com o motivo, sem travar o da comum e sem chamar a galeria de modelos:** a automação `is_default` mostra o selo "Padrão" e o Excluir desabilitado com "Esta automação é padrão: pode ser desativada, mas não excluída."; a comum fica sem selo e com o Excluir livre; a tela não chama mais a rota de modelos (a galeria saiu do front, PR #679).
- 2.3. **Mostrar o erro de carregamento e recarregar a lista ao clicar em "Tentar novamente":** a lista responde `500`; com o servidor de volta, o clique traz o cartão recuperado.
- 2.4. **Listar sem quebrar uma automação com gatilho que o front não conhece, mostrando o gatilho cru:** `trigger_type` desconhecido aparece como veio, sem estado de erro.

> 💡 100% mockado (`AGENTS.md` `[R-BLIND]`): a dev não produz sob demanda a lista vazia, o erro de rota nem o gatilho desconhecido, e as automações padrão dependem de cada banco. O mock segue o formato medido na dev.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 3: Cadastro de Automações: Criar, Salvar, Ativar, Pausar, Duplicar e Excluir; Emoji como {{e:HEX}} (Issue front#605/PR #604) — 7 testes, API real</b></summary>

<dl><dd>

- 3.1. **Criar uma automação do zero pela tela, salvar como rascunho e abrir a automação gravada como Pausada:** o `POST` leva a árvore aninhada de passos com `is_active: false`, o toast confirma, a URL vai para `/automacoes/{id}` e o servidor devolve o nome gravado.
- 3.2. **Salvar a edição do nome e mandar o `updated_at` lido no `PATCH`:** a trava otimista envia o `updated_at` do `GET`; o servidor passa a ter o nome novo.
- 3.3. **Ativar e pausar pelo switch do cartão, mandando só `is_active`, e o servidor refletir cada estado:** o corpo do `PATCH` é exatamente `{ is_active: true }` e depois `{ is_active: false }`, com os toasts "Automação ativada" e "Automação pausada".
- 3.4. **Duplicar pelo menu do cartão e a cópia nascer pausada com o sufixo "(cópia)":** a cópia existe na listagem do servidor, inativa, e aparece na tela com o switch desligado.
- 3.5. **Pedir confirmação ao excluir: cancelar mantém a automação e confirmar a remove do servidor:** o diálogo cita o nome; depois de confirmar, o cartão some e o `GET` da automação responde `404`.
- 3.6. **Gravar o emoji do nome e do texto do passo como `{{e:HEX}}` e mostrá-lo de volta como emoji ao reabrir a automação.**
- 3.7. **Salvar como rascunho o passo Enviar webhook com URL de rede interna, que só a ativação barra, e oferecer o webhook também dentro do ramo da condição (Issue front#672):** a dica do corpo explica o envelope padrão.

> 💡 Front contra a API real, gravando: cada teste cria a própria automação temporária (pela API, ou pela tela no 3.1) e o `after` apaga tudo que leva o token da rodada. A ativação do 3.3 usa só a palavra-chave única da rodada e deixa a automação pausada de novo no fim.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 4: Construtor de Automações: Passos, Reordenação, Ramos da Condição e Matriz Gatilho × Passo, Guarda de Saída, Escopo por Canal, Condição de Horário, Seletores dos Passos e Selo do Limite (Issue front#605/PR #604) — 21 testes, API real sem gravar</b></summary>

<dl><dd>

- 4.1. **Inserir dois passos de mensagem, reordenar com ↑ e deixar os botões das pontas desabilitados:** a ordem troca e o ↑ do primeiro e o ↓ do último ficam com `aria-disabled="true"`.
- 4.2. **Remover um passo da lista sem mexer nos outros:** o passo excluído some e o outro mantém o texto.
- 4.3. **Ramificar a condição em duas colunas Sim e Não e montar um passo dentro do ramo Sim:** o passo novo mora só na coluna Sim; a coluna Não segue sem passos.
- 4.4. **Pedir confirmação ao excluir uma condição com passos nos ramos e excluir direto a que está vazia:** cancelar mantém a condição e o filho, confirmar leva os dois; a condição sem filhos sai sem diálogo.
- 4.5. **Barrar o quarto nível de condição:** o menu do ramo da terceira condição aninhada oferece mensagem, mas não Condição.
- 4.6. **Oferecer no menu "adicionar passo" os 8 tipos que o motor roda, com espera e webhook:** mensagem, modelo, status personalizado, transferir, esperar, condição, enviar webhook e encerrar atendimento; campo do cliente e flow ficam fora.
- 4.7. **Esconder do menu os passos de atendimento quando o gatilho é Cliente cadastrado:** esse gatilho só traz o cliente, então mensagem e encerrar atendimento ficam fora do menu e a condição continua.
- 4.8. **Marcar com erro, e não apagar, o passo que ficou incompatível ao trocar o gatilho, e limpar a marca ao voltar:** a pendência `step-not-allowed-for-trigger` aparece no caminho exato do passo e some ao voltar para o gatilho que o suporta.
- 4.9. **Listar os 8 gatilhos com o Agendado e, ao escolhê-lo, pedir horário, dias e fuso:** o select traz `time_based` ("Agendado"); escolhido, aparecem o campo de horário, os 7 dias da semana e o fuso, e o menu oferece só esperar, condição e enviar webhook (PR #678).
- 4.10. **Acionar o aviso nativo do navegador (beforeunload) com a automação nova alterada, e não acionar com ela intacta.**
- 4.11. **Perguntar "Sair sem salvar?" ao clicar no menu lateral com a automação alterada:** "Continuar editando" mantém o rascunho e "Sair" navega.
- 4.12. **Abrir "Sair sem salvar?" ao voltar pelo navegador com a automação alterada:** "Continuar editando" mantém o rascunho e "Sair" volta para a lista.
- 4.13. **Contraprova: sem nenhuma alteração, o menu lateral sai do construtor sem perguntar.**
- 4.14. **Começar com "Todos os canais" marcado, marcar só o canal escolhido e voltar ao padrão ao clicar em "Todos os canais".**
- 4.15. **Travar o escopo em "Todos os canais", com as pílulas desabilitadas, quando o gatilho é Cliente cadastrado, e liberar ao trocar de gatilho.**
- 4.16. **Mostrar na condição de Horário a janela padrão das 08:00 às 18:00, os 7 dias marcados e o fuso de São Paulo, e permitir desmarcar um dia e trocar o fuso.**
- 4.17. **Barrar o salvar quando o início e o fim da condição de Horário são iguais, com a pendência no passo, sem gravar.**
- 4.18. **Listar no passo Enviar template os templates do canal oficial e, escolhido um, mostrar o texto com os botões de variável que a inserem no texto.**
- 4.19. **Listar no passo Mudar substatus os substatus da loja e a opção "Limpar substatus".**
- 4.20. **Começar o passo Atribuir em Rodízio com o seletor de grupo e, no modo específico, listar os atendentes do grupo escolhido.**
- 4.21. **Mostrar no cabeçalho do gatilho o selo "1×/24h" com o limite de 24 horas por cliente, e escondê-lo com 0 e com um limite inválido.**

> 💡 Front contra a API real, sem gravar: o construtor só monta a árvore em `/automacoes/nova` e o `afterEach` confirma que nenhum `POST` saiu. Os passos usam o caminho de posição como identificador (`root-0`, `root-0-yes-0`).

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 5: Validação do Construtor: o que Bloqueia Ativar e Salvar, com o Erro no Passo Certo e Teto de 7000 (Issue front#605/PR #604) — 9 testes, API real sem gravar</b></summary>

<dl><dd>

- 5.1. **Barrar ativar sem nenhum passo, avisar no toast e listar a pendência no painel:** toast "Adicione ao menos um passo." e título do painel de pendências visível.
- 5.2. **Barrar ativar o gatilho Palavra-chave sem nenhuma palavra:** toast "Informe ao menos uma palavra-chave.".
- 5.3. **Barrar ativar com mensagem sem texto e apontar o passo exato, abrindo-o ao clicar na pendência:** a pendência `text-required` fica no caminho do passo e o clique expande o passo.
- 5.4. **Limitar o nome a 125 caracteres e a descrição a 500 já no campo:** `maxlength` nos dois campos e o nome digitado com 130 caracteres fica em 125.
- 5.5. **Barrar ativar com o limite de resposta por cliente fora de 0 a 168 horas:** o campo declara `min` 0 e `max` 168 e o valor 169 é recusado com o toast do limite.
- 5.6. **Barrar até o rascunho com rodízio sem grupo, que o servidor também recusa:** passo Transferir em modo rodízio sem grupo bloqueia o salvar com "Escolha o grupo do rodízio.".
- 5.7. **Barrar ativar com espera acima de 30 dias e apontar a quantidade do passo (Issue backend#742, front#671):** 31 dias bloqueia o salvar com "A espera pode ser de até 30 dias." e marca a quantidade do passo.
- 5.8. **Barrar ativar o webhook com URL http, com credencial, de rede interna ou com host dinâmico e com corpo fora da allowlist ou que não é JSON, apontando a pendência do passo (Issue backend#745, front#672):** a tela barra antes do servidor, com o motivo traduzido, e nada é enviado.
- 5.9. **Barrar até o rascunho quando o texto do passo passa de 7000 caracteres só depois de codificar os emojis, com a pendência no passo.**

> 💡 Front contra a API real, sem gravar: a validação do front barra o salvar antes de qualquer requisição, e cada teste confirma que nenhum `POST` saiu. Automação ativa passa por todas as regras; o rascunho só barra o estrutural.

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 6: Construtor de Automações: Edição Concorrente (409), Recusa do Servidor (422), Avisos, Automação Inexistente, Duplicar Recusado e Timeout ao Criar (Issue front#605/PR #604) — 9 testes, 100% mockado</b></summary>

<dl><dd>

- 6.1. **Abrir o diálogo "Outra pessoa salvou esta automação" no 409 sem toast e manter o rascunho ao escolher Continuar editando:** o diálogo fecha, o nome digitado fica no campo e nenhum toast crítico aparece (o 409 é pergunta, não erro).
- 6.2. **Descartar o rascunho e reler a automação do servidor ao escolher Recarregar no diálogo do 409:** o campo volta ao nome que o servidor tem e o `GET` do detalhe é refeito.
- 6.3. **Mostrar no toast a mensagem traduzida do primeiro problema do 422 e abrir o passo do caminho apontado:** só o primeiro problema aparece, no texto do locale, e o passo do `path` abre.
- 6.4. **Mostrar o problema do 422 fora de passo com a área "Nome da automação" no toast:** o problema do caminho `name` cita a área.
- 6.5. **Salvar com sucesso e mostrar o aviso `service_window_risk` preso ao passo, sem toast de aviso:** o aviso "Fora da janela de 24h só passa modelo aprovado." mora no passo e não há toast de aviso.
- 6.6. **Mostrar "Automação não encontrada." no construtor quando o detalhe responde 404:** o estado de não encontrada aparece e o construtor não é montado.
- 6.7. **Mostrar no toast o motivo do servidor quando duplicar uma automação é recusado com `422`.**
- 6.8. **Mostrar "Não foi possível duplicar a automação." quando duplicar falha com `500`.**
- 6.9. **Avisar que a automação pode ter sido criada quando a criação passa do tempo limite de 15 s, sem sair da tela de criação.**

> 💡 100% mockado (`AGENTS.md` `[R-BLIND]`): a dev não produz sob demanda o conflito de edição (exigiria duas sessões salvando no mesmo instante), a recusa do servidor depois de o front aprovar nem os avisos do `200`. Os corpos seguem o formato medido na dev (`code: AUTOMATION_CHANGED` no 409, `issues: [{ path, message, code }]` no 422, `{ automation, warnings }` no ack do `PATCH`). No 6.1, o texto do diálogo diz que salvar fica bloqueado até recarregar, mas o front só fecha o diálogo e um segundo Salvar manda outro `PATCH` com o `updated_at` velho, que o servidor recusa de novo; a divergência de texto está no `ROADMAP.md` (P1-57).

</dd></dl>

</details>
<br>

<details>
<summary><b>Contexto 7: Histórico de Execuções com um Run Real do Motor: Situação, Passos e Motivo da Falha (Issue backend#741) — 1 teste, API real</b></summary>

<dl><dd>

- 7.1. **Mostrar o run real como Parcial, com o atendimento e os passos, e abrir o detalhe com o passo que falhou fora da janela de 24h e o que rodou depois:** o filtro "Com problema" acha o run e "Sucesso" não.

> 💡 O run nasce de verdade no motor: uma automação da rodada tenta enviar mensagem num atendimento com a janela de 24h vencida (falha, nada vai ao WhatsApp) e depois limpa o substatus (sucesso).

</dd></dl>

</details>
<br>

</dd></dl>

</details>

---

### Testes de Performance API (`performance/`) — k6

Para garantir a resiliência e a estabilidade da nossa comunicação backend, possuímos uma camada de testes de estresse e performance (Load Tests) escrita em **k6**. Os testes consomem nativamente nosso `env.json` e avaliam limites rigorosos (*thresholds*), como exigir que o **P95 do tempo de resposta seja menor que `2000ms`** sob alta concorrência e que a **taxa de falha seja inferior a `1%`**:

<details>
<summary><b>🔍 Clique para expandir os 4 cenários de teste</b></summary>

<dl><dd>

<br />

1. **`1.login-api-load.js`:** Aplica um fluxo de carga progressivo na autenticação (geração e validação de Token JWT), validando resiliência sob múltiplos usuários virtuais simultâneos.
2. **`2.central-api-load.js`:** Testa o estresse e a latência das buscas simultâneas nos dados renderizados no dashboard central, simulando sobrecarga nas filas de atendimento.
3. **`3.iniciarAtendimento-api-load.js`:** Avalia a latência das consultas `GET` de abertura do modal (canais, grupos e templates WABA) sob concorrência, utilizando `http.batch()` e isolando operações de escrita.
4. **`4.atendimentos-api-load.js`:** Avalia o desempenho sob concorrência de 10 VUs nas consultas `GET` completas do módulo de Atendimentos (carregamento inicial, contadores de status, listagem de filas com datas dinâmicas, renderização de chat/mensagens, templates WABA e modal de transferência/filtros).

</dd></dl>

</details>

---

## 🚀 Como Executar Localmente

### 1. Preparação (Clone e Instalação):

```bash
git clone https://github.com/Kal9941/cypress-enterprise-suite.git
cd cypress-enterprise-suite
npm install
```

### 2. Executar Testes E2E (Interface Gráfica do Cypress):

```bash
npm run cypress:open
# ou
npx cypress open
```

### 3. Executar Testes E2E em modo Headless (Terminal / CI):

```bash
# Execução padrão (conforme configurado no env.json)
npm run cypress:run
# ou
npm test

# Modo 100% Mock Hermético (execução ultra-rápida desacoplada de backend)
npx cypress run --env USE_MOCKS=true

# Executar contra API Real
npx cypress run --env USE_MOCKS=false

# Executar mais de uma instância ao mesmo tempo (multi-sessão) — rotule cada uma
npx cypress run --env USE_MOCKS=false,SESSION_LABEL=aba-A
```

### 4. Executar Testes de Performance (k6):

Certifique-se de ter o [k6 instalado na sua máquina](https://k6.io/docs/get-started/installation/) e execute os comandos via npm scripts:

```bash
# Teste de carga no Login
npm run k6:login

# Teste de carga na Central
npm run k6:central

# Teste de carga no Iniciar Atendimento
npm run k6:iniciar-atendimento

# Teste de carga na Tela de Atendimentos
npm run k6:atendimentos
```

### 5. Descobrir Elementos e Depurar sem DevTools (Ferramentas para Agentes de IA):

```bash
# Varre os bundles JS publicados em produção e atualiza cypress/reports/elements-inventory.json
npm run scan:elements

# Audita as rotas de backend estaticamente (sem tocar rede)
npm run audit:routes

# Idem, mais uma checagem GET ao vivo contra a API real (env.json)
npm run audit:routes:live
```

Dentro de um teste ou no Cypress Open, também é possível usar os comandos customizados de inspeção:

```javascript
cy.salvarSnapshotDom('identificador');           // Captura a árvore DOM completa da tela atual
cy.get(seletor).salvarHtml('identificador');      // Captura o HTML de um componente isolado
cy.inspecionarElemento(seletor);                  // Loga testid, aria-*, classes e estado do elemento
```

### 6. Como Simular o Link de Pagamento com a API Real (Cielo Sandbox):

O Pharmacie Web integra links de pagamento online para facilitar a cobrança de orçamentos gerados aos clientes. A automação Cypress possui suporte completo para testar esse fluxo ponta a ponta contra a **API Real** e o **gateway Cielo em modo de testes (Sandbox)** via `cy.origin()`.

#### 🔐 Segurança e Dados Sensíveis (`payment.credentials.json`):
Para proteger informações pessoais e evitar o vazamento de dados no Git, as credenciais de pagamento e dados de cobrança ficam segregados em um arquivo local separado, protegido pelo `.gitignore`:

1. **Copie o arquivo de modelo para criar o seu arquivo local:**
   ```bash
   cp payment.credentials.example.json payment.credentials.json
   ```
2. **Edite o arquivo `payment.credentials.json` na raiz do projeto:**
   ```json
   {
     "CARTAO": {
       "NUMERO": "4242 4242 4242 4242",
       "NOME_IMPRESSO": "NOME DO TITULAR",
       "VENCIMENTO": "12/30",
       "CVV": "123",
       "PARCELAS": "1"
     },
     "ENDERECO_COBRANCA": {
       "CEP": "00000-000",
       "LOGRADOURO": "Avenida Exemplo de Teste",
       "NUMERO": "123",
       "COMPLEMENTO": "Sala 101",
       "BAIRRO": "Centro",
       "CIDADE": "São Paulo",
       "ESTADO": "São Paulo"
     },
     "COMPRADOR": {
       "NOME_COMPLETO": "Nome Completo do Cliente",
       "EMAIL": "cliente.teste@email.com",
       "CELULAR": "(11) 99999-9999",
       "TIPO_DOCUMENTO": "CPF",
       "DOCUMENTO": "000.000.000-00"
     }
   }
   ```
   > ⚠️ **Atenção:** O arquivo `payment.credentials.json` está explicitamente listado no `.gitignore` e **nunca é versionado**. No CI/CD (GitHub Actions) ou quando o arquivo não existir localmente, a automação utiliza automaticamente o fallback seguro de `payment.credentials.example.json`.

#### ⚙️ Como Executar a Simulação na API Real:

1. Garanta que o arquivo `env.json` esteja com `"USE_MOCKS": false`.
2. Certifique-se de que o atendimento possua um **orçamento vinculado** (o teste anterior na suíte cria uma receita e calcula o orçamento automaticamente via API).
3. Execute a suíte de Atendimentos:
   ```bash
   # Pela interface interativa do Cypress:
   npx cypress open

   # Ou via terminal em modo headless:
   npx cypress run --spec "cypress/e2e/5-B1.atendimentos-chat-componentes.cy.js" --env USE_MOCKS=false
   ```

#### 🔄 Ciclo Automatizado da Simulação:
* **Validação de Pré-requisito (Skip Automático):** O teste verifica a existência de orçamentos no card lateral do cliente. Se a contagem for zero, o Cypress aplica um `this.skip()` dinâmico, registrando um aviso amigável no relatório e evitando falsas falhas.
* **Envio do Link:** Abre a modal `[data-testid="modal-enviar-link-pagamento"]`, seleciona a operadora **"3 - Cielo"**, escolhe o parcelamento e clica em **"Enviar Link"**.
* **Checkout Cross-Origin (`cy.origin`):** O Cypress intercepta a URL gerada pela API (`POST /payment-links`), navega para a página de checkout da Cielo (`cieloecommerce.cielo.com.br`), seleciona a opção *"Cartão de crédito"*, preenche os dados do cartão fake e do endereço de cobrança, avança para a identificação do comprador, aceita os termos de uso e aciona *"Concluir compra"*.
* **Auditoria de Confirmação:** O teste retorna à interface do Pharmacie Web e valida que a confirmação de pagamento e a notificação do sistema foram devidamente gravadas na gaveta de **Notas Internas**.

---

## 🔄 CI/CD - GitHub Actions

Os testes são executados automaticamente a cada `push` ou `pull request` nas branches `main` e `master`. Também é possível disparar a execução manualmente a qualquer momento através do botão do workflow na aba **Actions**.

Cada arquivo de spec (`0-A/0-B/0-C.backend-*.cy.js` a `8.automacoes.cy.js`) roda em um **job separado, em paralelo** (matriz do GitHub Actions), cada um com seu próprio navegador Chrome isolado — evita que a degradação de memória/timing de um Chrome único rodando todos os testes em sequência mascare falhas que só aparecem sob carga prolongada (ver `.agents/ROADMAP.md`).

Após cada execução no GitHub Actions:

* Os **relatórios de testes E2E** ficam disponíveis para download nos **Artefatos** da execução, um conjunto (`relatorios-testes-<spec>`/`cypress-screenshots-<spec>`) por arquivo de spec.
* O job **`relatorio-consolidado`** (depois dos 15 specs, mesmo com falha) junta os relatórios num **painel único** e o publica como artefato `painel-relatorio` (14 dias).
