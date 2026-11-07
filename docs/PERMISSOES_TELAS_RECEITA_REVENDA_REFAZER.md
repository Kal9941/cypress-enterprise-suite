# Permissões das telas 145 (Receita), 232 (Revenda) e 378 (Refazer)

Levantamento feito em 2026-10-14, **somente leitura** (`SELECT`), no banco do tenant de teste
`consulfarma`, tabela de catálogo `PERMISSAO_MENU`.

## Como ler

- **Origem do vínculo permissão ↔ tela:** o nome da permissão e o caminho no menu
  (`DESCRICAOPERMISSAO`) e, quando existe, o formulário (`FRM_NOME`). **Não foi lido o código do
  Pharmacie**, então não está confirmado quais permissões a tela consulta de fato — a lista é
  "o que o catálogo associa à tela", não "o que o formulário checa".
- **Tipo:** `I/A/E` = suporta incluir, alterar e excluir (colunas `TP_INCLUIR`/`TP_ALTERAR`/
  `TP_EXCLUIR` do catálogo). `liga/desliga` = os três em `0`, vale só a coluna `ATIVO` de
  `PERMISSAO_DETALHE`.
- **Valores:** `-1` = sim, `0` = não (padrão `RADIO_CHECK` do Pharmacie).
- **Modelo:** `PERMISSAO_MENU` (catálogo) → `PERMISSAO_DETALHE` (uma linha por funcionário × item,
  criada zerada pela procedure `CAD_PERMISSAO_DETALHE_I`). Perfis prontos em `PERMISSAO_PADRAO`.

| Tela | Código | Formulário | Permissões | Só liga/desliga |
|---|---|---|---|---|
| Receita | 145 | `FMOV_0145` | 53 | 48 |
| Revenda | 232 | `FCS_MOV_0232` | 30 | 26 |
| Refazer | 378 | — (não cadastrado) | 4 | 3 |

---

## 1. Tela 145 — Receita (`Movimentos > Atendimento > Receita`)

### Acesso à tela e sub-telas

| Código | Permissão | Tipo |
|---|---|---|
| 145 | Receita (abre a tela) | I/A, sem excluir |
| 387 | Receita > Detalhes da receita (`FDET_0387`) | liga/desliga |
| 220 | Receita > Fórmula | I/A/E |
| 222 | Receita > Fórmula > Produto | I/A/E |
| 384 | Receita > Fórmula > Detalhes da fórmula (`FDET_0384`) | liga/desliga |

### Botões

| Código | Permissão | Tipo |
|---|---|---|
| 221 | Receita [ digitalização ] | I/A/E |
| 103 | Receita [ fichas ] | liga/desliga |
| 217 | Receita [ rótulos ] | liga/desliga |
| 307 | Receita { finalizar movimento s/ financeiro } | I e E, sem alterar |

### Alterações em movimento já avançado

| Código | Permissão |
|---|---|
| 301 | alterar movimento concluído |
| 352 | alterar movimento entregue ao cliente |
| 662 | alterar movimento finalizado s/ financeiro |
| 259 | alterar movimento de outra loja |
| 623 | alterar receita com bloqueio no livro de registro geral ou processo de produção |
| 595 | Fórmula > alterar fórmula de movimento pago |
| 596 | alterar desconto de movimento com financeiro ( pago ) |

### Status e fluxo

| Código | Permissão |
|---|---|
| 169 | alterar o status de concluído |
| 681 | alterar o status de concluído de movimento com financeiro/ documento fiscal emitido |
| 680 | Fórmula { alterar o status de concluído de movimento com financeiro/ documento fiscal emitido } (mesmo texto do 681, sob "Fórmula") |
| 208 | alterar o status aviar fórmula |
| 682 | alterar o status inclusão automática |
| 213 | alterar o receituário ok |
| 652 | Fórmula { bloquear fórmula no refazer } (atua no Refazer, ver §3) |

### Valores e preços

| Código | Permissão |
|---|---|
| 62 | alterar o valor do medicamento |
| 154 | alterar desconto |
| 152 | alterar o valor da taxa técnica |
| 153 | alterar o valor extra da fórmula |
| 400 | mostrar o valor de custo da fórmula/ receita |

### Loja, setor, convênio, estoque e operação

| Código | Permissão |
|---|---|
| 287 | alterar a loja de venda |
| 294 | alterar a loja de retirada |
| 290 | alterar o setor de venda |
| 335 | alterar o convênio |
| 60 | alterar o estoque de baixa |
| 215 | alterar o tipo de operação |
| 150 | alterar funcionário comissionado |
| 338 | alterar funcionário comissionado de outra loja |

### Datas e horários

| Código | Permissão |
|---|---|
| 449 | alterar a data de retorno |
| 57 | alterar a data de vencimento |
| 402 | alterar data/ hora do laboratório no atendimento |
| 151 | alterar horário de entrega do laboratório |
| 427 | autorizar horário de entrega p/ o cliente fora da tabela |

### Texto da receita

| Código | Permissão |
|---|---|
| 696 | alterar posologia |
| 697 | alterar texto do rótulo |
| 698 | alterar observação da ficha de pesagem |
| 699 | alterar observação da receita |
| 591 | alterar o campo calcular peso "c.p." ao digitar a fórmula veterinária |
| 110 | mostrar produtos ocultos da fórmula |

### Autorizações (liberam o que o sistema bloquearia)

| Código | Permissão |
|---|---|
| 582 | autorizar conclusão de receitas com estoque insuficiente |
| 583 | autorizar venda de produtos controlados |
| 193 | autorizar venda p/ cliente em débito |
| 702 | autorizar venda p/ usuários com movimentos pendentes |
| 621 | Fórmula { autorizar fórmula com dosagem fora do intervalo permitido } |
| 436 | Fórmula { autorizar fórmula com vencimento menor que o permitido } |

---

## 2. Tela 232 — Revenda (`Movimentos > Atendimento > Revenda`)

Formulário `FCS_MOV_0232`, título "Atendimento ao cliente (Revenda)".

### Acesso à tela e sub-telas

| Código | Permissão | Tipo |
|---|---|---|
| 232 | Revenda (abre a tela) | I/A, sem excluir |
| 388 | Revenda > Detalhes da revenda (usa o mesmo `FDET_0387` dos detalhes da receita) | liga/desliga |
| 329 | Revenda > Produto | I/A/E |

### Botões

| Código | Permissão | Tipo |
|---|---|---|
| 585 | Revenda [ digitalização ] | I/A/E (tipo 1) |
| 121 | Revenda [ fichas ] | liga/desliga |
| 486 | Revenda [ rótulos ] | liga/desliga |
| 609 | Revenda [ nota fiscal ( nf-e ) ] > Conceder desconto | liga/desliga |
| 308 | Revenda { finalizar movimento s/ financeiro } | I e E, sem alterar |

### Alterações em movimento já avançado

| Código | Permissão |
|---|---|
| 302 | alterar movimento concluído |
| 663 | alterar movimento finalizado s/ financeiro |
| 260 | alterar movimento de outra loja |
| 137 | alterar o status de concluído |
| 342 | alterar o valor da venda com financeiro registrado |

### Valores, descontos e comissão

| Código | Permissão |
|---|---|
| 235 | alterar desconto |
| 333 | alterar desconto de produtos em promoção |
| 518 | alterar porcentagem de comissão do produto |
| 327 | alterar funcionário comissionado |
| 339 | alterar funcionário comissionado de outra loja |
| 401 | mostrar o valor de custo do produto/ revenda |

### Loja, setor, convênio e operação

| Código | Permissão |
|---|---|
| 243 | alterar a loja de venda |
| 326 | alterar a loja de retirada |
| 293 | alterar o setor de venda |
| 336 | alterar o convênio |
| 328 | alterar o tipo de operação |
| 239 | alterar o receituário ok |

### Datas

| Código | Permissão |
|---|---|
| 519 | alterar a data de entrega |
| 450 | alterar a data de retorno |

### Autorizações

| Código | Permissão |
|---|---|
| 559 | autorizar venda de produtos controlados |
| 207 | autorizar venda p/ cliente em débito |
| 703 | autorizar venda p/ usuários com movimentos pendentes |

---

## 3. Tela 378 — Refazer (`Movimentos > Atendimento > Refazer`)

O 378 não tem `FRM_NOME` nem título cadastrado no catálogo; a busca foi pelo número e por
descrições com "refazer".

| Código | Permissão | Tipo |
|---|---|---|
| 378 | Refazer (abre a tela) | liga/desliga |
| 219 | Refazer [ digitalização ] | I/A/E |
| 524 | Refazer { autorizar o refazer de fórmula com produto controlado } | liga/desliga |
| 652 | Receita > Fórmula { bloquear fórmula no refazer } | liga/desliga |

A 652 está catalogada sob a Receita (145), mas o nome indica que atua no Refazer. Se ligada
bloqueia ou libera: **não confirmado** — só o comportamento do desktop responde.

---

## Observações

- **Receita × Revenda:** estrutura espelhada, códigos diferentes para a mesma ação (ex.: "alterar
  desconto" = 154 na Receita, 235 na Revenda; "autorizar venda de controlados" = 583 e 559).
  Só na Revenda: 333, 342, 518, 519, 609. Só na Receita: tudo de fórmula/manipulação (posologia,
  rótulo, dosagem, vencimento, aviar, peso).
- **Botões sem permissão própria no catálogo:** Registrar baixa, Registrar processo e Gerar NF-e
  (tela 145) e Gerar NF-e (tela 232) não têm item próprio; o 609 cobre só o desconto dentro da
  NF-e. Podem estar em outras telas (baixa de fórmulas, fiscal) — não pesquisado.
- **Dependência Refazer → Receita:** não verificado se quem usa o Refazer também precisa da 145.
- **Não cruzado com dados reais:** este levantamento é só do catálogo; não diz quem (funcionário
  ou perfil de `PERMISSAO_PADRAO`) tem cada permissão ligada.
