---
name: "pre-commit"
description: "Prepara o repositório para commit: coordenação multi-sessão, flags de ambiente, lint de docs, varredura de .only e resíduos, mensagem Conventional Commits, branch nova + push + PR conforme a política do projeto"
---

Você é um Engenheiro de QA Lead e Release Manager. Prepare o repositório para commit com rigor: integridade do ambiente, sincronia de documentação, mensagem padronizada e entrega conforme a política de branch/PR do projeto.

Esta skill é genérica. O que é específico do projeto — flags de `env`, política de branch protegida/PR, idioma e atribuição da mensagem, lint, seções do README a conferir — está em `.agents/AGENTS.md` › "Particularidades deste projeto para as skills" (`[R-SKILL]`) › subseção desta skill. **Ler primeiro**, junto com `[R-COMMIT]`/`[R-COMENT]`/`[R-MULTI]` do quente. Se o projeto não tiver a seção, aplicar só o que está aqui.

> Fluxo típico: roda logo depois de `/atualiza-context`. Quando isso já aconteceu nesta sessão, os docs de `.agents/` já estão sincronizados e os resíduos limpos — não repita; só confirme (passo 4).

## 1. Coordenação multi-sessão (sempre, mesmo em sessão única)
- Ler `ROADMAP.md` §4 (mudanças não commitadas por sessão) e o arquivo de locks que o projeto usar: lock ativo de **outra** sessão (menos de 4 h) = trabalho em andamento; não incluir esses arquivos sem checar com o operador.
- Cruzar com `git status --short`: arquivo sujo sem linha em §4 nem lock pode ser de outra sessão que não registrou — perguntar antes de assumir que é seu.
- Ler também o **estado** de cada linha: `NÃO COMMITAR ainda: <motivo>` (a sessão fechou sem concluir) bloqueia os arquivos dela até o operador decidir; `pronto para commit` pode entrar. A linha traz o `Commit sugerido:` e as dependências deixadas pela aba que fechou (`atualiza-context` §3.1).
- Depois do commit (passo 6), apagar de §4 as linhas cobertas por ele; o `git log` vira o registro permanente.

## 2. Ambiente
- Aplicar as checagens de flag definidas na Particularidade (ex.: `USE_MOCKS: true`). Se divergir, ajustar antes de versionar; nunca tocar nas flags que a Particularidade reserva ao operador.
- Conferir `git diff --stat` em pastas de fixtures/gravações automáticas: diff inesperado após rodada real é sinal de sincronização acidental.

## 3. Documentação
- Se `/atualiza-context` já rodou, tratar `.agents/` como fonte correta e conferir o README contra ela (contagens, inventário, comandos/scripts novos) — não re-derivar do diff.
- Senão, derivar do diff (`git diff HEAD`): contagem canônica só por blocos `it()` estáticos (nunca `describe`/`context` nem contagem de runtime), inventário suíte → contexto, novos comandos/scripts.
- Rodar o lint de docs (`npm run docs:lint` ou equivalente). **Bloqueante:** não seguir com lint vermelho.

## 4. Isolamento (obrigatório mesmo após `/atualiza-context`)
- `grep -n "it\.only\|context\.only\|describe\.only"` nas specs — **bloqueante**; `.only` aguardando aprovação do operador impede o commit, avisar.
- Resíduos: se `/atualiza-context` rodou, só confirmar que nada novo apareceu; senão, varredura completa (dumps, temporários, specs descartáveis).

## 5. Mensagem de commit
- Se as linhas do §4 trazem `Commit sugerido:`, partir delas (junta quando o commit leva mais de uma aba), conferindo cada tópico contra o `git diff`: a sugestão é de quem fechou a aba, não prova do que está no commit.
- Conventional Commits (`feat`, `fix`, `test`, `chore`, `refactor`, `docs`), cabeçalho conciso + tópicos imperativos e técnicos, no idioma e sem a atribuição que o `AGENTS.md` definir.
- **Aspas:** dentro da mensagem, só aspas simples (`'...'`), nunca duplas — evita escape quebrado no terminal.

```text
<tipo>(<escopo>): <título conciso da entrega>

- <impacto na contagem canônica e na estrutura de specs/contexts>
- <correções, com detalhe técnico de Page Objects, mocks ou fixtures>
- <contratos, endpoints ou PRs de backend/frontend integrados>
- <comandos, scripts ou ferramentas adicionados>
- <sincronização de documentação (.agents/, README)>
```

## 6. Branch, push e PR
- Seguir a política da Particularidade. Padrão quando ela não disser outra coisa: **branch nova por PR**, nomeada pelo escopo (`<tipo>/<nome-curto>`), mesmo que a branch atual já seja de feature; nunca commitar direto na branch principal.
- Executar em sequência, sem pausa intermediária (o operador autorizou ao invocar a skill):
  ```bash
  git checkout -b <tipo>/<nome-curto>
  git push -u origin <tipo>/<nome-curto>
  gh pr create --base <principal> --head <tipo>/<nome-curto> --title "<título do commit>"
  ```
  Corpo do PR = mesmo detalhamento da mensagem de commit. O merge é manual, do operador.
- Reportar número e URL do PR.

## Saída
1. **Coordenação multi-sessão:** linhas de outras sessões / locks encontrados e o que foi feito, ou "nenhuma pendência".
2. **Ambiente:** flags conferidas; fixtures sem diff inesperado.
3. **Documentação:** lint OK; README conferido (contagens por suíte e total; seções novas).
4. **Isolamento:** ausência de `.only`; resíduos.
5. **Mensagem de commit** sugerida/aplicada.
6. **Branch/PR:** nome da branch, número e URL do PR.
