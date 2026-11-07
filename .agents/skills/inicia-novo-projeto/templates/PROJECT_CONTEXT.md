# PROJECT_CONTEXT.md — Contexto Mestre de Arquitetura e Domínio · {{PROJETO}}

> **Atualizado:** {{DATA}} · Regras de trabalho: `AGENTS.md` · Status e backlog: `ROADMAP.md` · Histórico: `HISTORICO.md`.
> **Como ler:** quente até `<!-- fim-quente -->` (§1–§5) mais o §10.0 `[QUENTE]`; o resto é frio, aberto sob demanda pelo **Mapa** abaixo. Numeração preservada.

## Mapa de leitura sob demanda
> **Quente** = §1–§5 + §10.0 (índice, `[QUENTE]`). **Frio** = §6–§9 e §10.1+; abrir por `Grep` (rota, identificador, nome, tag).

| Seção (frio) | O que responde | Ler quando |
|---|---|---|
| §6 Regras de negócio | regras do domínio, estados, transições | a tarefa toca essa regra; antes de afirmar o comportamento esperado |
| §7 Permissões e acessos | quem pode o quê, por escopo | tarefa/teste liga permissão a comportamento |
| §8 Contratos por rota / interface | status, campos, erros medidos | **sempre** antes de escrever contra uma rota/interface: `Grep` pela rota |
| §9 {{TEMA_9}} | {{TEMA_9_DESC}} | a tarefa toca {{TEMA_9}} |
| §10.1+ Inventário | cada {{UNIDADE_INVENTARIO}} com localização e o que faz | duplicidade antes de criar; impacto de uma issue/PR; localizar pelo sintoma |

---

## 1. Visão Geral e Contagem Canônica
{{DESCRICAO_PROJETO}}

| {{COLUNA_INVENTARIO}} | Qtd | Escopo | Observações |
|---|---|---|---|
| (preencher a partir do repositório) | | | |
| **Total** | **0** | | |

Estado atual de exceções (desativados, pendentes de validação): ver `ROADMAP.md` §1. Histórico: `HISTORICO.md` §1.

---

## 2. Stack Tecnológica
- {{STACK}}

---

## 3. Estrutura de Diretórios
```text
{{ARVORE_DIRETORIOS}}
```

---

## 4. Variáveis de Ambiente e Configuração
- {{VARIAVEIS_AMBIENTE}}

---

## 5. Arquitetura
- {{ARQUITETURA}}

---

<!-- fim-quente -->

# Seções sob demanda (frio) — abrir pelo Mapa; §10.0 é o único bloco quente abaixo daqui

## 6. Regras de Negócio e Domínio
### {{DOMINIO_1}}
- (sem regras registradas ainda — só o que foi medido/confirmado)

## 7. Permissões e Acessos
- (sem registros ainda)

## 8. Contratos por Rota / Interface `[ROTA]`
| `[ROTA]` | Contrato | Origem (PR/issue) |
|---|---|---|
| (sem registros ainda) | | |

## 9. {{TEMA_9}}
- (sem registros ainda)

## 10. Inventário Canônico de {{UNIDADE_INVENTARIO_PLURAL}}
> **Como usar:** Grep por rota, PR, nome ou tag — o índice §10.0 diz onde está; cada linha do §10.x traz a localização (`L:` conferida por Grep), o nome e o que faz/valida. Sincronização: `AGENTS.md` `[R-SYNC]`.

### 10.0 Índice `[QUENTE]`
| Arquivo · grupo | Identificadores | Qtd | Área | Rotas · PR |
|---|---|---|---|---|
| (preencher) | | | | |

### 10.1 {{ARQUIVO_1}}
| # | Local | Nome | O que faz/valida |
|---|---|---|---|
| (preencher) | | | |
