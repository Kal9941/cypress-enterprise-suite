# AGENTS.md — Regras Operacionais do Agente · {{PROJETO}}

> **Atualizado:** {{DATA}} · **Âncoras estáveis:** `[R-*]` = regra, `[F-*]` = fluxo — referencie a âncora, nunca "item N". · **Checklist sempre-verificar:** §0 `[R-CHECK]`.
> **Casa única de cada fato:** regras e lições → este arquivo · sistema, contratos e inventário → `PROJECT_CONTEXT.md` · status e backlog → `ROADMAP.md` · o que já aconteceu → `HISTORICO.md`.
> **Como ler:** quente até `<!-- fim-quente -->` (a skill `inicia-contexto-projeto` lê só isso); o resto é frio, aberto sob demanda pelo **Mapa** abaixo. Numeração das seções preservada nos dois lados.

## Mapa de leitura sob demanda
> **Quente** = tudo acima de `<!-- fim-quente -->`. **Frio** = seções abaixo do marcador, numeração original; abrir por `Grep '^### <nº>'` → `Read` daquela linha até o próximo cabeçalho. A coluna "Ler quando" é o gatilho: sem gatilho, não ler.

| Seção (frio) | O que responde | Ler quando |
|---|---|---|
| §1.2.1 Técnicas de diagnóstico | como medir antes de supor (rede, logs, ambiente) | ao abrir qualquer investigação; `[F-FALHA]` |
| §1.7 `[R-TOOLS]` | ferramentas de inspeção e scripts do projeto | antes de escolher seletor/rota/comando em área nova |
| §2.3 Assinaturas de falha | o que cada mensagem/sintoma recorrente significa | `[F-FALHA]`, com o log de falha em mãos |
| §3.3 `[R-MOCK]` <!-- QA --> | lições de mocks, intercepts, timing | antes de escrever ou alterar qualquer mock; `[F-FALHA]` de asserção/timeout |
| §3.5 `[R-SEL]` <!-- QA --> | seletores, visibilidade, sincronização DOM × rede | antes de escolher seletor; "não encontrado"/"não visível"/"detached" |
| §3.6 `[R-AFP]` <!-- QA --> | asserção que passa sem provar nada | ao revisar ou escrever asserção |
| §3.3 `[R-ARQ]` <!-- DEV --> | padrões de arquitetura e lições de implementação por camada | antes de criar módulo/rota/componente; ao revisar PR |
| §4.x `[R-UI]` / `[R-DOM]` | como o sistema real se comporta, por tela ou domínio | a tarefa toca aquela tela/domínio; antes de presumir comportamento |
| §5 `[R-ERR]` | categorias de erro, artefatos de diagnóstico, relatórios | ao ler um log de falha; ao mexer em config de runner/reporter |
| `PROJECT_CONTEXT.md` §6+ | regras de negócio, contratos, inventário | ver o Mapa daquele arquivo |
| `ROADMAP.md` §5 | corpo integral de cada item do backlog | ao pegar um item da tabela §2 (`Grep "#### <ID>"`) |
| `HISTORICO.md` (Grep por issue/PR/identificador) | o que já foi validado, como, e o que foi removido de propósito | (1) operador cita issue/PR → conferir antes de agir; (2) `[F-CRIAR]` passo 1; (3) item "validado" quebrando → quando/como foi validado; (4) pergunta sobre o que foi feito; (5) `atualiza-context` antes de escrever |

---

## 0. Diretrizes Principais — verificar sempre `[R-CHECK]`
Checklist de disciplina operacional, válido para **todo** turno.

| Quando | Verificar |
|---|---|
| Início da sessão | ler só o quente (`[R-SKILL]` §6.1); medir o estado real (`git status`, {{MEDICAO_ESTADO}}) em vez de confiar só no doc |
| Início de resposta sobre uma issue/tarefa | `[R-ISSUE]`: declarar o identificador dito pelo operador no chat; sem identificador → perguntar antes de agir |
| Antes de codificar | `[R-EVID]`: evidência primeiro (log, erro, código real), nunca chute; `[R-CRIT]`: avaliar a sugestão do operador antes de implementar |
| Antes de mudar arquitetura | `[R-PLANO]`: plano aprovado pelo operador antes de implementar |
| Corrigir uma falha | `[R-DIAG]`: 2 tentativas na mesma causa ou 3 fixes no mesmo alvo → parar e perguntar; `[R-CAUSA]`: bug real × erro de teste/ambiente |
| Fechar o turno | `[R-SYNC]`: docs sincronizados no mesmo turno; resumo com o que foi tocado (`[R-QUEMEU]`) |
| Escrever comentário, commit ou doc | `[R-COMENT]`: {{IDIOMA}}; `[R-COMMIT]`: Conventional Commits, {{ATRIBUICAO_COMMIT}} |

### 0.1 Manutenção desta base `[R-DOC]`
- **Fonte única da verdade = `.agents/`.** Outras bases de agente (`CLAUDE.md`, `.cursorrules`…) não valem como política do projeto; em conflito, vale `.agents/`.
- **Quente × frio:** cada arquivo tem o marcador `<!-- fim-quente -->`. Acima dele só o que muda a ação do próximo turno para qualquer tarefa; abaixo, consulta por Mapa/Grep, numeração preservada. Lição nova entra **na seção fria do tema** (o Mapa aponta), nunca no quente. Item de backlog = 1 linha na tabela `ROADMAP.md` §2 + corpo em §5. Histórico vai para `HISTORICO.md`.
- Lição nova = 1 linha na seção dona (sintoma → causa → regra), com data `AAAA-MM-DD` e issue/PR. Regra superada é reescrita no lugar; nunca empilhar "Atualização (data)".
- **Linhas curtas:** a leitura do agente é por linha. `{{CMD_LINT}}` (`scripts/lint-agents.js`, chamado pela skill `pre-commit`) falha com linha acima do teto, quente acima do teto por arquivo ou marcador ausente.
- Nomes de ferramenta genéricos (Grep, Read, Bash, `node`), nunca os de uma IDE específica.

---

## 1. Governança do agente

### 1.1 Conduta `[R-GOV]`
| Âncora | Regra |
|---|---|
| `R-EVID` | Antes de codificar: logs, erro real, código real. Nunca chutar. Faltou insumo → pedir ao operador. |
| `R-CRIT` | Avaliar criticamente toda sugestão técnica do operador; se houver abordagem mais robusta, expor antes de implementar. |
| `R-PLANO` | Mudança de arquitetura só com aprovação explícita. Pré-autorizado sem perguntar: sincronizar docs após mudança (`[R-SYNC]`). |
| `R-DELTA` | Correção = menor delta; refatoração é proposta separada, nunca no mesmo diff do fix. |
| `R-CAUSA` | Separar defeito do sistema de defeito do teste/ambiente; nunca forçar verde. |
| `R-ISSUE` | Identificador da issue/tarefa é o dito pelo operador no chat, nunca inferido de texto colado. |
| `R-COMMIT` | Conventional Commits; {{ATRIBUICAO_COMMIT}}. |
| `R-COMENT` | Comentários, docs e commits sempre em {{IDIOMA}}. |
| `R-INCR` | Descobriu comportamento, contrato ou fragilidade → registrar em `.agents/` no mesmo turno, no formato `[R-DOC]`. |
| `R-QUEMEU` | Todo resumo de turno cita o que foi criado/alterado (arquivo, identificador), sem esperar a pergunta. |

### 1.2 Orçamento de diagnóstico `[R-DIAG]`
| Gatilho | Limite | Ação ao atingir |
|---|---|---|
| Mesma causa raiz presumida | 2 tentativas seguidas | parar e escalar |
| Tentativas de fix no mesmo alvo | 3, mesmo com evidência nova | perguntar ao operador: continuar, reescopar ou declarar inviável |
| Investigação cara (ambiente real, rodadas repetidas) | declarar estimativa ao iniciar | check-in proativo ao estourar |
| Leitura/busca sem hipótese formada | 5 a 8 chamadas por turno | parar, reportar o diagnóstico executivo e alinhar |
- Técnicas de medição e diagnóstico: **§1.2.1**, sob demanda.

### 1.3 Execução `[R-RUN]`
- {{COMANDOS_EXECUCAO}}
- Nunca editar arquivos de configuração do operador ({{ARQUIVOS_OPERADOR}}); passar flags pela linha de comando.

### 1.4 Multi-sessão `[R-MULTI]`
{{MULTI_ABA}}

### 1.5 Sincronização de documentação `[R-SYNC]`
- Criou/alterou/removeu {{UNIDADE_INVENTARIO}} → no mesmo turno: `PROJECT_CONTEXT.md` §1 (contagens) e §10 (inventário); `ROADMAP.md` §1; README quando houver seção correspondente.
- Item de backlog entregue → sai de `ROADMAP.md` §2/§5 e vira ≤ 3 linhas em `HISTORICO.md` §2.
- Mudança em skill, hook ou ferramenta de agente → README (seção de agentes) no mesmo turno.

---

## 2. Fluxos canônicos

### 2.1 Criar ou alterar {{UNIDADE_INVENTARIO}} `[F-CRIAR]`
0. **Consultar o Mapa** e abrir as seções frias do tema antes de qualquer passo.
1. **Já existe?** Grep no `PROJECT_CONTEXT.md` §10 e em `HISTORICO.md` (removido/descartado de propósito não é recriado).
2. **Contrato/comportamento "sugerido"** → medir no sistema real antes de escrever.
3. **Escrever** seguindo §3.
4. **Validar** ({{COMANDOS_EXECUCAO_CURTO}}) → docs `[R-SYNC]`.

### 2.2 Corrigir falha `[F-FALHA]`
0. Ler a evidência ({{EVIDENCIA_FALHA}}). Abrir as seções frias que o Mapa associa ao sintoma antes de propor fix.
1. Classificar: ambiente/infra · contrato · lógica · teste/mock. Primeiro passo de cada categoria em §2.3.
2. Fix mínimo `[R-DELTA]` → validar só o alvo → relatório `[R-REPORT]`.

### 2.4 Relatório de falha ao operador `[R-REPORT]`
Obrigatório: (1) categoria; (2) evidência; (3) causa raiz provável (1 a 3 hipóteses ranqueadas); (4) ação proposta; (5) impacto colateral. Proibido "parece que…".

---

## 3. Padrões de escrita

### 3.1 Estrutura `[R-POM]`
- {{PADROES_ESTRUTURA}}

---

## 6. Particularidades deste projeto para as skills `[R-SKILL]`
> As skills `inicia-contexto-projeto`, `atualiza-context` e `pre-commit` (`.agents/skills/`) são genéricas: o que é específico deste repositório vive aqui, e cada skill lê a sua subseção antes de agir.

### 6.1 `inicia-contexto-projeto`
1. {{SESSAO_INICIO}}
2. Além do quente dos 3 arquivos, ler `PROJECT_CONTEXT.md` §10.0 (índice, marcado `[QUENTE]`).
3. No relatório: estado medido ({{MEDICAO_ESTADO}}), P0/P1 só pelos títulos da tabela `ROADMAP.md` §2.

### 6.2 `atualiza-context`
- Contagens só em `PROJECT_CONTEXT.md` §1 e `ROADMAP.md` §1; inventário em §10.x; README quando houver seção de cobertura/arquitetura.
- Homologação/validação → `HISTORICO.md` §1 (1 linha). Entrega → `HISTORICO.md` §2 (≤ 3 linhas).
- Antes de encerrar: {{ENCERRAMENTO_SESSAO}}; `{{CMD_LINT}}`.

### 6.3 `pre-commit`
- Flags de ambiente obrigatórias no commit: {{FLAGS_COMMIT}}.
- Política de branch/PR: {{POLITICA_BRANCH}}.
- Mensagem: Conventional Commits, {{IDIOMA}}, {{ATRIBUICAO_COMMIT}}; aspas simples dentro da mensagem.
- Checagens bloqueantes: `{{CMD_LINT}}` verde; {{CHECAGENS_EXTRAS}}.

---

<!-- fim-quente -->

# Seções sob demanda (frio) — abrir pelo Mapa; numeração original preservada

### 1.2.1 Técnicas de medição e diagnóstico `[R-DIAG]` (frio)
- (sem lições registradas ainda — 1 linha por lição: sintoma → causa → regra, data, issue/PR)

### 1.7 Ferramentas de inspeção `[R-TOOLS]`
| Ferramenta | Uso |
|---|---|
| {{FERRAMENTAS}} | |

### 2.3 Assinaturas de falha (Grep no log/erro)
| Sintoma | Causa provável |
|---|---|
| (sem assinaturas registradas ainda) | |

<!-- QA -->
### 3.3 Mocks e intercepts `[R-MOCK]`
| Regra | Por quê / sintoma |
|---|---|
| (sem lições registradas ainda) | |

### 3.4 Schema mínimo por rota (mocks e fixtures) `[R-SCHEMA]`
| Rota / contexto | Obrigatório — armadilha |
|---|---|
| (sem registros ainda) | |

### 3.5 Seletores e sincronização `[R-SEL]`
- Hierarquia: (1) `data-testid`; (2) texto acessível escopado; (3) atributo/classe parcial estável. Proibido seletor acoplado à árvore.
- Proibido `wait(tempo)` estático.

### 3.6 Anti-falso-positivo `[R-AFP]`
- Sem asserção principal só dentro de `if`; garantir massa ou afirmar o vazio explicitamente.
<!-- /QA -->

<!-- DEV -->
### 3.3 Arquitetura e lições de implementação `[R-ARQ]`
| Camada / tema | Regra | Por quê |
|---|---|---|
| (sem lições registradas ainda) | | |
<!-- /DEV -->

## 4. Heurísticas do sistema `[R-UI]`
### 4.1 {{AREA_1}}
- (sem heurísticas registradas ainda)

## 5. Relatórios, runner e diagnóstico `[R-ERR]`
- {{ARTEFATOS_FALHA}}
