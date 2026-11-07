# ROADMAP.md — Status, Backlog Priorizado e Coordenação · {{PROJETO}}

> **Atualizado:** {{DATA}} · **Como ler:** quente até `<!-- fim-quente -->` — §1 números, §2 tabela do backlog (título + 1 linha), §3 ponteiro, §4 multi-sessão. Frio: §5 corpo de cada item (abrir por `Grep "#### P1-01"`). Histórico de validações e entregas: `HISTORICO.md`.

## 1. Status
- **0 {{UNIDADE_INVENTARIO_PLURAL}}** — (contagem por arquivo/grupo, só números; mesma fonte de `PROJECT_CONTEXT.md` §1)
- Exceções ativas (desativados, pendentes de validação, vermelhos propositais): nenhuma.

---

## 2. Backlog Ativo Priorizado
> Uma linha por item: prioridade no ID (`P0` infra/estabilidade · `P1` regra/funcionalidade pendente · `P2` melhoria contínua), título, resumo de 1 linha e onde está o corpo (§5, frio). Item entregue sai daqui e vira ≤ 3 linhas em `HISTORICO.md` §2. Nunca escrever investigação nesta tabela — vai no §5.

| ID | Item | Resumo | Detalhe |
|---|---|---|---|
| (sem itens) | | | |

---

## 3. Log de Entregas
> Vive em `HISTORICO.md` §2 (só escrita; consultar por Grep de issue/PR). Entrega nova: ≤ 3 linhas lá, nunca aqui.

---

## 4. Mudanças Não Commitadas por Sessão (coordenação multi-sessão, `AGENTS.md` `[R-MULTI]`)
> Ao concluir um arquivo no turno, registrar aqui ANTES de liberar o lock. Antes de preparar um commit, ler esta tabela e os locks ativos. Depois do commit sair, apagar as linhas cobertas por ele.

| Sessão | Quando (ISO) | Arquivos | Resumo |
|---|---|---|---|
| | | | |

---

<!-- fim-quente -->

## 5. Detalhe dos Itens do Backlog (frio — corpo integral de cada ID da tabela §2)
> Abrir por `Grep "#### <ID>"`. Ao atualizar um item: o corpo muda aqui, a linha da tabela §2 só se o título/resumo mudar.

### 🔴 P0 — Infraestrutura e estabilidade

### 🟡 P1 — Regras e funcionalidades pendentes

### 🟢 P2 — Melhorias contínuas
