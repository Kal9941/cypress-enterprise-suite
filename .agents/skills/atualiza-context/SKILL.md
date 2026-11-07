---
name: "atualiza-context"
description: "Sincroniza .agents/ ao fim de uma sessão no padrão quente/frio: lição vai para a seção fria do tema, backlog em tabela + corpo, histórico em HISTORICO.md; limpa resíduos, locks e roda o lint de docs"
---

Você é um Engenheiro de Documentação e QA Lead. Analise criticamente o histórico desta sessão e atualize **incrementalmente** os arquivos de `.agents/`, respeitando o padrão quente/frio: o quente (acima de `<!-- fim-quente -->`) só cresce quando uma regra muda a ação de **todo** turno; o resto entra na seção fria do tema ou em `HISTORICO.md`.

Esta skill é genérica. Regras específicas do projeto (quais contagens, qual README, que locks, qual lint) estão em `.agents/AGENTS.md` › "Particularidades deste projeto para as skills" (`[R-SKILL]`) › subseção desta skill — ler primeiro, junto com `[R-DOC]` e `[R-SYNC]` do quente.

## Diretrizes de contenção (zero ruído)
- **Sem histórico conversacional:** nada de tentativas, comandos errados ou passo a passo. Só a regra/fato final consolidado.
- **Edição cirúrgica:** alterar só os blocos necessários; nunca reescrever arquivo inteiro, duplicar título ou criar seção genérica.
- **Fato, não dedução:** só o que foi efetivamente medido, decidido ou tratado na sessão.
- **Reescrever no lugar:** regra superada é substituída; nunca empilhar "Atualização (data)" sob a antiga.
- **Linhas curtas e um fato em um só lugar:** respeitar os tetos do lint; não repetir o mesmo fato em dois arquivos — o segundo só aponta (`ver X §n`).
- **Antes de escrever em `HISTORICO.md`:** `Grep` pelo número da issue/PR e pelo `#<ctx>.<índice>`; se já houver entrada, completar essa linha (nova data/aba/resultado), nunca criar uma segunda.

## 1. Saneamento de resíduos (obrigatório)
Remover o que não pertence ao repositório: dumps/snapshots soltos (`last-failure-dom.html`, `*.tmp`, `*.log`, JSON fora de fixtures canônicas), relatórios órfãos, specs/arquivos de diagnóstico descartável (`zz-*`, `test-temp.*`, `draft_*`), backups de editor (`*~`, `*.bak`, `.DS_Store`). Conferir `git status` antes e depois.

## 2. Onde cada coisa entra
| O que a sessão produziu | Vai para | Formato |
|---|---|---|
| Lição técnica (mock, seletor, timing, comportamento do app, técnica de diagnóstico) | **seção fria** do tema em `AGENTS.md` — achar pelo Mapa de leitura | 1 linha: sintoma → causa → regra, data `AAAA-MM-DD`, issue/PR. Tema sem seção → criar a seção fria **e** a linha correspondente no Mapa |
| Regra de disciplina nova, pedida pelo operador, que vale para todo turno | **quente** de `AGENTS.md` (checklist §0 ou tabela de governança) | 1 linha. É a única coisa que justifica crescer o quente |
| Fato do sistema (contrato de rota, permissão, regra de negócio, schema) | seção fria correspondente de `PROJECT_CONTEXT.md` | linha na tabela da seção; nunca narrativa |
| Teste criado/alterado/removido | `PROJECT_CONTEXT.md` §1 (contagem) + §10.x (linha com `L:` conferido por Grep, tags `[SKIP]`/`[ONLY]`); `ROADMAP.md` §1 (contagem); README se a Particularidade mandar | mesmo texto nos dois inventários |
| Item de backlog novo | `ROADMAP.md` §2 (tabela) **+** §5 (corpo) | tabela: `\| <PRIO>-NN \| título \| resumo de 1 linha \| §5 <ID> \|`; corpo: `#### <ID> · título` + o detalhe. ID = próximo da prioridade |
| Item de backlog que mudou | `ROADMAP.md` §5 (corpo) | tabela só se título/resumo mudou |
| Item entregue / validado | sai de §2 e §5 → `HISTORICO.md` §2 | ≤ 3 linhas: data, issue/PR, resultado, testes |
| Homologação (`.only` removido após "ok"), revalidação, reativação de `.skip` | `HISTORICO.md` §1 | 1 linha, mais recente no topo |
| Estado atual de `.only`/`.skip` | `ROADMAP.md` §1 + tags do inventário | só o estado, sem histórico |
| Mudança em hook, skill, script de agente ou arquitetura de teste | seção fria de `AGENTS.md` do tema + README (seção de agentes/arquitetura) | 1 linha cada |

## 3. Encerramento da sessão (esta skill costuma rodar antes de fechar a aba)
1. `grep -n "it\.only\|context\.only"` nos arquivos tocados por **esta** sessão — `.only` já homologado sai; `.only` pendente de "ok" fica e é citado no relatório. Nunca tocar `.only`/`.skip` de outra sessão ou do operador.
2. Linha própria em `ROADMAP.md` §4 (sessão, timestamp ISO, arquivos, resumo de 1 linha) cobrindo tudo que esta execução sujou.
3. Limpar os locks desta sessão (`.claude/locks.json` ou o que a Particularidade definir) **depois** do passo 2.
4. Rodar o lint de docs (`npm run docs:lint` ou o equivalente do projeto). Se falhar, corrigir antes de terminar — nunca deixar para o commit.

### 3.1 Sessão que fecha sem garantia de commit
O commit pode sair logo depois, muito depois ou por **outra** aba, e esta aba não estará lá para explicar. Antes de terminar, deixar no working tree tudo que quem commitar precisa, sem depender da memória desta conversa:
1. **Linha do §4 completa:** todos os arquivos que a sessão tocou (novos, alterados, removidos, specs de diagnóstico apagados), resumo de 1 linha e o **estado**: `pronto para commit` ou `NÃO COMMITAR ainda: <motivo>` (aguarda homologação, `.only` ativo, teste vermelho de propósito, depende de outra aba). Esta aba não apaga a linha: quem commita apaga.
2. **`Commit sugerido:` na própria linha:** título e tópicos no formato e idioma do projeto, cobrindo só o que esta aba fez; quem commita junta as mensagens quando o commit leva o trabalho de mais de uma aba e confere tudo contra o `git diff`.
3. **Docs coerentes com o código:** contagens, inventário (`L:` e tags por Grep) e README conferidos e o lint verde. Nada de "atualizo depois do commit".
4. **Sem `.only` já homologado e sem lock da sessão** (arquivar no §4 antes de liberar), para a outra aba não esbarrar.
5. **Dependências:** se o commit depende de outra aba (arquivo compartilhado, contagem somada, branch em uso), dizer na linha.
6. **Relatório final** diz que o commit ficou pendente, em que linha do §4 está a informação e o que o bloqueia, se houver.

## Saída
Diff resumido, por arquivo, separando **quente** de **frio** tocado:
- **Resíduos removidos:** lista ou "nenhum".
- **AGENTS.md:** regras (quente) e lições (frio, com a seção) adicionadas/reescritas.
- **PROJECT_CONTEXT.md:** contagens, linhas do inventário, fatos de sistema.
- **ROADMAP.md:** itens novos/alterados (IDs), entregues (movidos), §1 e §4.
- **HISTORICO.md:** entradas adicionadas.
- **Lint:** resultado.
