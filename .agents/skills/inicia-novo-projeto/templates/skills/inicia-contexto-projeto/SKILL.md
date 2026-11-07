---
name: "inicia-contexto-projeto"
description: "Inicia o contexto do projeto lendo só a parte quente de .agents/ (regras, estado e índices); lições, histórico e inventário ficam sob demanda pelo Mapa de leitura"
---

Você está abrindo uma sessão de trabalho neste repositório. Carregue o mínimo que muda a ação do próximo turno e nada mais: o resto é aberto sob demanda, quando o fluxo pedir.

Esta skill é genérica. Tudo que é específico do projeto (registro de sessão multi-aba, flags de ambiente, formato do relatório) vive em `.agents/AGENTS.md`, na seção **"Particularidades deste projeto para as skills"** (`[R-SKILL]`), lida no passo 1. Se o projeto não tiver essa seção, siga só o que está aqui.

## Convenção dos arquivos (padrão quente/frio)
- Cada arquivo de `.agents/` tem o marcador `<!-- fim-quente -->` sozinho numa linha. **Quente** = tudo acima dele. **Frio** = tudo abaixo, com numeração de seção preservada, aberto por `Grep` no cabeçalho (`^### 3.3`) seguido de `Read` daquela linha até o próximo cabeçalho.
- Uma seção abaixo do marcador cujo cabeçalho termina com `[QUENTE]` também é lida na abertura (ex.: um índice que roteia buscas).
- O "Mapa de leitura sob demanda" no topo de cada arquivo tem a coluna **"Ler quando"**: esse é o gatilho para abrir uma seção fria. Sem gatilho, não ler.
- `HISTORICO.md` (quando existir) é só escrita: nunca é lido na abertura; consulta-se por `Grep` de issue/PR/teste/data.

## Passos
1. **`.agents/AGENTS.md`** — ler do início até a linha do marcador (exclusive). Se o arquivo não tiver o marcador, ler inteiro e avisar no relatório que o projeto ainda não está no padrão quente/frio. Localizar a seção de Particularidades e **executar primeiro** o que a subseção desta skill manda (ex.: registro de sessão, rótulo da aba), antes de qualquer outra leitura.
2. **`.agents/ROADMAP.md`** e **`.agents/PROJECT_CONTEXT.md`** — ler até o marcador, mais as seções `[QUENTE]` abaixo dele (achar por `Grep '^##.*\[QUENTE\]'`; ler do cabeçalho até o próximo cabeçalho de nível igual ou superior). Se um trecho estourar o limite de leitura, ler em partes (offset/limit) até cobrir 100% do quente; nunca parar numa fatia truncada.
3. **Nunca ler na abertura:** seções frias sem `[QUENTE]`, `HISTORICO.md`, inventários/tabelas linha a linha, logs de entrega.
4. **Medir o estado real, não só o documentado:** `grep -n "it\.only\|context\.only\|describe\.only"` e `grep -n "\.skip("` nas specs (ou o equivalente que o `AGENTS.md` definir); locks e sessões ativas se o projeto usar; `git status --short`. Divergência entre doc e código entra no relatório.
5. **Carregar as regras ativas** do `AGENTS.md` quente: checklist de disciplina, orçamento de diagnóstico, ciclo de vida de `.only`/`.skip`, execução de testes, multi-sessão, sincronização de docs. Mapear as contagens canônicas (`PROJECT_CONTEXT.md` §1, `ROADMAP.md` §1) e o índice de cobertura (`PROJECT_CONTEXT.md` §10.0 ou equivalente).

## Relatório de confirmação (compacto, sem despejar o conteúdo lido)
- 🔖 **Sessão:** o que a Particularidade pedir (rótulo da aba, outras abas ativas, limpeza diária, locks de terceiros). Omitir se o projeto não for multi-aba.
- ✅ **Ficheiros lidos:** arquivo e faixa de linhas lida (ex.: `AGENTS.md` 1–270, até o marcador; `PROJECT_CONTEXT.md` 1–98 + §10.0).
- 📌 **Estado dos Testes:** total canônico e por suíte (§1), `.only`/`.skip` ativos **medidos** no código, árvore suja (`git status`) com atribuição por sessão quando houver.
- 🚨 **Itens Críticos Activos:** só os títulos P0/P1 da tabela do backlog (`ROADMAP.md` §2); o corpo fica no frio.
- Finalizar com: *"Contexto integral carregado e regras operacionais activas. Pronto para o próximo comando."*
