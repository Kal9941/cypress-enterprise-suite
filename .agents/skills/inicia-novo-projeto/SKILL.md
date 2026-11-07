---
name: "inicia-novo-projeto"
description: "Cria (repositório novo, QA ou Dev) ou migra (repositório com docs de agente já existentes) a base .agents/ no padrão quente/frio: AGENTS.md, PROJECT_CONTEXT.md, ROADMAP.md, HISTORICO.md, Mapa de leitura, marcador fim-quente, Particularidades para as skills, skills genéricas e lint de docs"
---

Você é um Engenheiro de Documentação para agentes de IA. Sua tarefa é deixar este repositório no **padrão quente/frio** de base de conhecimento para agentes — o mesmo usado em `cypress-enterprise-suite` — para que a skill `inicia-contexto-projeto` carregue só o essencial na abertura e o resto seja lido sob demanda.

Os moldes estão na pasta desta skill: `templates/AGENTS.md`, `templates/PROJECT_CONTEXT.md`, `templates/ROADMAP.md`, `templates/HISTORICO.md`, `templates/lint-agents.js` e `templates/skills/` (as 3 skills genéricas). Placeholders `{{ASSIM}}` são substituídos; blocos `<!-- QA -->`/`<!-- DEV -->` ficam só na variante escolhida.

## O padrão, em 6 regras (o que o resultado precisa ter)
1. **4 arquivos em `.agents/`:** `AGENTS.md` (regras de trabalho), `PROJECT_CONTEXT.md` (o sistema), `ROADMAP.md` (estado e backlog), `HISTORICO.md` (changelog, só escrita). Casa única de cada fato: regra → AGENTS; fato do sistema/inventário → PROJECT_CONTEXT; estado/backlog → ROADMAP; o que já aconteceu → HISTORICO.
2. **Marcador `<!-- fim-quente -->`** sozinho numa linha nos três primeiros. **Quente** (acima) = só o que muda a ação do próximo turno para qualquer tarefa. **Frio** (abaixo) = consulta por tema, numeração de seção preservada. Seção fria que precisa ser lida na abertura leva `[QUENTE]` no cabeçalho (ex.: um índice).
3. **Mapa de leitura sob demanda** no topo de `AGENTS.md` e `PROJECT_CONTEXT.md`: tabela `Seção (frio) | O que responde | Ler quando`. A 3ª coluna é obrigatória e concreta (momento do fluxo, categoria de erro, tipo de pedido) — sem gatilho, a seção nunca será lida.
4. **Backlog em tabela** (`ROADMAP.md` §2: `ID | Item | Resumo de 1 linha | §5 ID`) com o corpo de cada item no §5 (frio, `#### <ID> · título`). Histórico de entregas e homologações só em `HISTORICO.md`.
5. **Particularidades para as skills** (`AGENTS.md` §6 `[R-SKILL]`): uma subseção por skill genérica (`inicia-contexto-projeto`, `atualiza-context`, `pre-commit`) com o que é específico do repositório (registro de sessão, flags de ambiente, política de branch/PR, idioma/atribuição do commit, o que sincronizar). As skills ficam genéricas e leem essa seção primeiro.
6. **Lint mecânico** (`scripts/lint-agents.js`, `npm run docs:lint` ou equivalente): marcador presente e único, teto de KB do quente por arquivo, teto de caracteres por linha, Mapa presente. Chamado pela skill `pre-commit`.

## Passo 0 — Diagnóstico (sem perguntar nada ainda)
- `ls .agents/ 2>/dev/null`; `Grep -l "fim-quente" .agents/*.md`; procurar outras bases de agente já existentes (`AGENTS.md`/`CLAUDE.md` na raiz, `docs/agent*`, `.cursorrules`, `.github/copilot-instructions.md`).
- Tipo de projeto: **QA** (há `cypress/`, `playwright/`, `tests/e2e`, specs) ou **Dev** (app/serviço/lib); stack (`package.json`, `pom.xml`, `pyproject.toml`, `go.mod`…); se é Node (para o `npm run docs:lint`); se usa Claude Code multi-aba (`.claude/hooks/`, `.claude/sessions.json`).
- Resultado: **CRIAR** (nenhuma base) ou **MIGRAR** (há base, sem marcador). Se já houver marcador nos 3 arquivos, só auditar contra as 6 regras e corrigir o que faltar.

## Passo 1 — Perguntar ao operador só o que não dá para inferir
Uma pergunta só, com as opções que o diagnóstico não resolveu: idioma dos docs e comentários (padrão: o do README); projeto QA ou Dev (se ambíguo); multi-aba sim/não; política de branch (principal protegida → PR obrigatório? merge manual?); flags de ambiente que precisam estar num estado fixo no commit (ex.: `USE_MOCKS: true`); atribuição ao agente na mensagem de commit (sim/não); unidade do inventário (QA: `it()`/cenário por spec; Dev: módulo, rota, componente, comando). Não perguntar o que já está no repositório.

## Passo 2A — CRIAR (repositório sem base)
1. `.agents/` com os 4 arquivos a partir dos templates, placeholders substituídos, variante QA ou DEV aplicada. Seções frias nascem com o cabeçalho e uma linha "sem lições registradas ainda" — nunca inventar regra ou fato que não foi medido; preencher só com o que o diagnóstico leu no repositório (stack, estrutura de pastas, scripts, comandos de teste/execução).
2. `AGENTS.md` §6 Particularidades preenchido com as respostas do passo 1. Sem multi-aba, a subseção 6.1 diz "sessão única: sem registro de rótulo".
3. `.agents/skills/` = cópia de `templates/skills/` (as 3 skills genéricas, para o time e para publicar no painel).
4. `scripts/lint-agents.js` a partir de `templates/lint-agents.js`; em projeto Node, script `"docs:lint": "node scripts/lint-agents.js"` no `package.json`; fora de Node, documentar em `AGENTS.md` §0.1 o comando direto (`node scripts/lint-agents.js`) e, se houver, um alvo no `Makefile`/task runner do projeto.
5. `.gitignore`: garantir que `.agents/` e `.agents/skills/` **não** estão ignorados; artefatos de sessão (`.claude/`, locks, sessions) ignorados.
6. README: seção curta "Base de conhecimento para agentes (`.agents/`)" explicando o padrão quente/frio, o Mapa, o `HISTORICO.md`, as skills e o lint (modelo: `cypress-enterprise-suite` › "📚 Base de Conhecimento para Agentes").
7. Rodar o lint; depois rodar mentalmente a skill `inicia-contexto-projeto` e conferir que o relatório sai completo com o que existe.

## Passo 2B — MIGRAR (repositório com base existente)
Mover blocos inteiros por cabeçalho, nunca reescrever texto; preservar a numeração das seções (toda citação `§n.m` em docs, specs e skills continua válida). Sequência:
1. **Backup** dos arquivos atuais fora do repositório (pasta temporária); se houver trabalho não commitado de outra sessão nesses arquivos, migrar sobre o conteúdo atual (preserva) e avisar.
2. **Classificar cada seção** pelo critério: muda a ação de todo turno → quente; só importa quando o fluxo chega no tema (lições, contratos, heurísticas, corpo de backlog) → frio; registro do que aconteceu (homologações, log de entregas, "revalidado em…") → `HISTORICO.md`. Em dúvida, frio: o Mapa traz de volta pelo gatilho.
3. **AGENTS.md:** inserir "Como ler" + Mapa no topo; descer as seções frias para baixo do marcador mantendo seus números; criar `§6 Particularidades` extraindo das skills locais (ou do próprio arquivo) o que é específico do projeto; acrescentar em `[R-DOC]` as regras quente/frio e linhas curtas. Linha de tabela com narrativa longa (ex.: histórico de um hook dentro de uma regra) → dividir no primeiro `<br><br>`: a regra fica, a narrativa vira subseção fria `§n.m.1`.
4. **ROADMAP.md:** §1 só números + estado atual; §2 vira tabela gerada dos itens (`ID` por prioridade, título = texto em negrito do item, resumo = 1ª frase, `§5 ID`); corpo de cada item desce para §5 (`#### ID · título` + texto integral); log de entregas e linhas de homologação vão para `HISTORICO.md` (quebrar linhas gigantes em 1 bullet por evento, no separador natural: `; ` ou "Homologado pelo operador"); §3 vira só um ponteiro, §4 (multi-aba) continua quente.
5. **PROJECT_CONTEXT.md:** Mapa no topo; marcador depois das seções de visão geral/stack/estrutura/ambiente/arquitetura; regras de negócio, permissões, contratos e inventário ficam frios; o índice do inventário leva `[QUENTE]`; notas históricas do §1 vão para `HISTORICO.md`.
6. **Reapontar referências** ao que mudou de lugar (ex.: "Log §3" → `HISTORICO.md` §2) nos docs, skills e README; conferir que nenhuma seção citada por `§n.m` sumiu.
7. **Lint, skills, `.gitignore`, README** como no passo 2A (itens 3–6).
8. **Verificação obrigatória antes de encerrar:** (a) toda linha não vazia do backup existe literalmente no conjunto novo, exceto as transformadas de propósito — listar essas exceções no relatório; (b) toda âncora `[R-*]`/`[F-*]` citada em qualquer arquivo do repositório tem definição em `AGENTS.md`; (c) toda citação `AGENTS.md §n.m` resolve num cabeçalho; (d) lint verde; (e) medir KB do quente antes × depois.

## Passo 3 — Relatório
- Modo (CRIAR/MIGRAR), tipo (QA/Dev), respostas do operador aplicadas.
- Por arquivo: tamanho total, tamanho do quente, seções quentes e frias (lista), seções `[QUENTE]`.
- Para MIGRAR: exceções da verificação (a), âncoras/citações conferidas, antes × depois em KB/tokens.
- Skills criadas, lint instalado e resultado, `.gitignore`/README tocados.
- Próximo passo sugerido: abrir nova sessão e rodar `inicia-contexto-projeto` para validar a leitura; publicar as skills no painel se ainda não estiverem.

## Proibições
- Inventar regra, lição, contrato ou contagem: template vazio é melhor que template errado.
- Reescrever texto existente durante a migração (só mover, dividir em separador natural e reapontar referências).
- Renumerar seções (quebra citações) ou apagar histórico (vai para `HISTORICO.md`).
- Deixar o lint vermelho ou o marcador fora de algum dos 3 arquivos.
