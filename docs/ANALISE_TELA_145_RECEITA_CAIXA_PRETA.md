# Tela 145 (Receita) — permissões legado × web e teste de caixa preta na API real

Levantamento de 2026-10-14 (aba-a), contra `api.omnicare.dev.local` (tenant dev, loja 1, operador `USER_CODE` do `env.json`).
Sem issue formal. Produto de teste: **PASSIFLORA EXTRATO SECO** (id `1004866`, localizado por `GET /products?usage=human&q=passiflora`).

**Fontes cruzadas**
1. `docs/PERMISSOES_TELAS_RECEITA_REVENDA_REFAZER.md` — catálogo legado `PERMISSAO_MENU` (53 permissões da 145).
2. `docs/PERMISSION_REFERENCE.md` — o que já foi mapeado para o backend (domínio Receita, MOV 0145).
3. `appium-OmniCare-desktop` — inventário estático da tela (`tests/fixtures/screen-inventory/145.{png,xml}`, `.agents/PROJECT_CONTEXT.md` §"Inventário de telas"): `TfMOV_0145`, botões `TBitBtn` com `Name` próprio, grids owner-drawn (sem linha em UIA). O projeto Appium só automatiza login hoje; **não há cenário da 145 executado** — a análise do desktop é de interface, não de comportamento.
4. Bundle real do front (`app.omnicare.dev.local`, `index-Rp8uKcJK.js` + `responseParser-B9aFvyXJ.js`) — rotas, schemas zod e testids da tela de receita.
5. 7 rodadas de sonda na API real (spec descartável, removido): ~450 chamadas.

**Limites desta análise:** (a) uma única conta, com **todas** as capabilities `true` — os caminhos de revogação (RBAC negativo) não foram exercitados (`[R-CAPXACAO]`); (b) o desktop não foi executado; (c) o mapeamento capability web ↔ código legado é por **nome** (o backend não expõe `legacyCode`).

---

## 1. Permissões: legado × referência × web

| Situação | Qtde | Códigos |
|---|---:|---|
| Catálogo 145 (legado) | 53 | — |
| Com capability equivalente na web (por nome) | 30 | 145, 307, 222, 595, 596, 154, 680, 436, 335, 215, 290, 150, 338, 294, 287, 702, 696, 697, 698, 060, 591, 152, 153, 062, 057, 449, 151, 682, 213, 582 |
| **Sem capability na web** | 23 | 387, 220 (sobrescrito pela 222), 384, 221, 103, 217, 301, 352, 662, 259, 623, 169, 681, 208, 652, 400, 402, 427, 699, 110, 583, 193, 621 |
| No catálogo mas **ausentes do `PERMISSION_REFERENCE.md`** | 3 | **583** (autorizar controlados), **400** (mostrar valor de custo), **217** (botão rótulos; a referência lista só a 096) |
| Na referência mas **não** no catálogo da 145 | ≥ 16 (fora as telas externas) | 323, 488, 310, 320, 495, 231, 337, 607, 509, 461, 410, 580, 033, 705, 922, 919 (vêm do código Delphi, não do catálogo — as duas fontes divergem nos dois sentidos) |

Capabilities reais (`GET /prescription-capabilities`, 24 chaves, nível conta): `can_create_recipe`, `can_create_with_pending_recipes`, `can_update_covenant`, `can_update_operation_type`, `can_update_sales_sector`, `can_update_commissioned_employee`, `can_update_commissioned_other_store`, `can_update_pickup_store`, `can_update_registration_store`, `can_update_formula_with_financial`, `can_uncalculate_formula_with_financial`, `can_calculate_with_minimum_validity`, `can_edit_discount`, `can_edit_discount_with_financial`, 5 de manipulação, `can_finalize_with_insufficient_stock`, `can_link_cart`, `can_generate_nfse`, `can_register_stock_shortage`, `can_search_client_agreements`.
Por recurso: receita (`can_update`, `can_finalize`, `can_cancel_finalization`) e fórmula (18 chaves, entre elas `can_edit_calculated` e `can_edit_product_in_completed_formula`, que o front **não** lê — o schema zod dele tem 16).

**Leitura:** as 23 sem capability se dividem em (i) botões/telas externas (387, 384, 221, 103, 217, 402 — não têm endpoint), (ii) **desbloqueios contextuais** (301, 352, 662, 259, 623, 169, 681, 583, 193, 621, 427) — são justamente as que protegem edição de movimento avançado, venda de controlado, cliente em débito e dosagem fora de faixa, e (iii) visibilidade (400 custo, 110 produtos ocultos). O `PERMISSION_REFERENCE.md` já prevê as do grupo (ii) como "embutidas no recurso", mas **nada disso aparece** nas capabilities do recurso hoje (ver B4, B9, B10).

---

## 2. Achados do backend (caixa preta, API real)

Severidade: 🔴 alta · 🟠 média · 🟡 baixa. IDs de evidência = receitas criadas no tenant dev (`2610005xx`).

### 🔴 B1 — Escopo de loja não validado nas rotas de receita
- `POST /stores/999/prescriptions` responde **201** e grava a receita com `store_id: 999` (receita `261000572`, `patient_name: null` na resposta).
- `GET /stores/2/prescriptions/{id da loja 1}`, `GET /stores/999/...`, `PATCH /stores/2/...` e `POST /stores/2/.../formulas` respondem 200/201 sobre a receita da loja 1.
- Contradiz a decisão registrada em `PERMISSION_REFERENCE.md` ("`{store_id}` ≠ `storeCode` → `422 INVALID_CONTEXT`") e o padrão das rotas de atendimento (403). Gera registro órfão (loja inexistente) e leitura/escrita cruzada por path.

### 🔴 B2 — 500 não tratado com entrada aceita antes
- `quantity: 1e12` em `POST .../products` → **201**; depois `POST .../calculate` e a prévia → **500**. A fórmula fica incalculável até remover a linha (o `calculate` da receita "suja" falhou 3× seguidas).
- `multiplier ≥ ~99999` (100000 e 99999) → 500 na criação da fórmula (9999 passa).
- `cid_code` com 50 caracteres (PATCH fórmula) → 500 (coluna estoura sem validação).
- Sem limite superior em nenhum desses campos; a mensagem é o genérico "An unexpected error occurred".

### 🔴 B3 — Desconto não tem caminho de escrita; prévia aceita faixa inválida
- `can_edit_discount`/`can_edit_discount_with_financial` existem, mas: `PATCH` da fórmula com `discount_percentage`/`discount_value`/`discount_location` → 422 "Nenhum campo válido"; `PATCH` da receita idem; corpo no `calculate` é ignorado (`discount_percentage:10` → 0); produto adicionado com `discount_percentage:20` → 0.
- A prévia (`POST /prescriptions/formula-calculations`) aceita `discount_percentage` **-10** (total sobe de 28,01 para 30,81) e **150** (total **-14,00**). 100 → 0,00.
- Resultado: o desconto só existe na prévia; não é persistível pela API.

### 🔴 B4 — Receita finalizada continua totalmente editável
Com a receita em `status: -1` (finalizada), todas aceitas com 200/201: `PATCH` da receita, `PATCH` da fórmula (posologia, `qvd`), adicionar produto, criar fórmula nova e recalcular (excluir produto/fórmula só foi testado em receita em rascunho, onde também funciona). `capabilities.can_update` segue `true`.
O `PATCH qvd` deixa a fórmula `needs_recalculate: true` **dentro de uma receita finalizada** (`sale_value` da receita fica desatualizado até recalcular). Não existe capability de recurso equivalente a 301/352/662.
> Não foi possível provar se há enforcement para usuário **sem** a 301 (conta de teste tem tudo). Pendência: repetir com conta restrita.

### 🟠 B5 — Laboratório não é gravável
`lab_id` no `POST .../formulas` é ignorado: 1, 3, 4, 6, 2 e 999999 resultam sempre no laboratório padrão da forma farmacêutica (forma 2 → lab 2 "SOLIDOS"; forma 1 → lab 1). No `PATCH`, `lab_id` e `production_store_id` → "Nenhum campo válido". No desktop o campo Laboratório é editável (a tela tem lupa). `stock_store_id`, `cid_code` e `medicine_type_id` são graváveis.

### 🟠 B6 — Validação ausente ou coerção silenciosa
| Entrada | Resultado |
|---|---|
| `multiplier: 1.5` | 201, gravado `1` (trunca em silêncio) |
| `qvd: 0` | 422 · mas `qvd: 0.001` → 201, gravado `0` (burla a regra "QVD > 0") |
| `qvd: 99999999` | 201 |
| `technical_fee_value: -5`, `extra_value: -5`, `weight: -3` | 201, gravados negativos |
| `expiry_date`/`return_date` em 2020 | 201 |
| `quantity: 250.123456` | gravado `250.1235` (4 casas) |
| posologia / rótulo / observação com 5000 caracteres | 201, retornados íntegros (sem limite documentado) |
| texto com emoji (💊) | persistido como `?` (charset do banco) |
| `lab_delivery_at` sem fuso / `expiry_date: "ontem"` | 400 "Malformed request body" (genérico, sem campo) |

### 🟠 B7 — `expected_delivery_at` aceita pelo schema, mas nunca grava
`PATCH` com ISO-8601 com fuso (Z, offset; passado ou futuro) → **409 `PRESCRIPTION_WRITE_NOT_APPLIED`** nas 4 tentativas (passado, futuro, com `Z` e com offset). Sem fuso → 422 coerente. A "Data e hora de entrega" (e a 427) não é gravável.

### 🟠 B8 — Regras de domínio frouxas ou inconsistentes
- `commissioned_employee_id` de funcionário **não comissionado** (id 55) → 201 (o front filtra `commissioned=true`; o back não).
- `PATCH patient_id: null` → 200, mas `POST` sem paciente → 422 "Paciente obrigatório para receita humana".
- `animal_id` em receita **humana**: `POST` descarta; `PATCH` **persiste** (`animal_id: 1`).
- Mesmo produto duas vezes na fórmula → duas linhas (`line_number` 1 e 2), sem aviso.
- Ordem de validação do `POST`: "Prescritor obrigatório" vem antes de checar paciente/loja/convênio (mensagem encobre os demais erros).
- `status` no corpo do `POST` é ignorado (correto); mudar tipo → 422 correto.

### 🟠 B9 — Produtos controlados: bloqueio sem caminho de autorização
`CLONAZEPAM FC:100` (Lista B1, `prescription_required_code: 3`): a prévia devolve só um `warning` (`monitored_product`, texto da Portaria 344), mas `POST .../products` real → **422 "Inclusão de fórmula não permitida!"** (mensagem genérica, sem `code`). Não há capability/rota para autorizar (583 ausente na web e na referência). Causa exata da recusa (nº de notificação/data da receita?) **não determinada**.

### 🟠 B10 — Dosagem fora da faixa só gera aviso
`PASSIFLORA EXTRATO SECO` tem máximo cadastrado de 430 mg. 500 mg e 5 g: adicionar → 201; prévia/cálculo → `warning` "Produto com quantidade acima das especificações" e **permite finalizar** (621 sem capability). O `code` do aviso é `monitored_product` — o mesmo de controlado — apesar de a mensagem tratar de quantidade (código ambíguo para o front).

### 🟡 B11 — Catálogos e listagens com contratos peculiares
- `GET /laboratories/{id}/pharmaceutical-forms` devolve **lista vazia sem `q`** (labs 1–6, `total: 0`); com `q=cre` traz 3 formas do lab 1.
- `GET /prescribers`: `q` com < 3 caracteres → vazio; `q=23325` casou **id** 23325 (outro prescritor), não o CRM 23325 de ABADIO JOSE SILVA.
- `GET /products`: parâmetro é `q` (o `search` é ignorado e devolve o catálogo inteiro, 565 KB, com um item de `name: ""`, id 2000465); `usage` obrigatório (422). Busca é case-insensitive (`Passiflora Extrato Seco` acha) mas **sensível a acento** (`passiflóra` → 0) — o `#42` de `0.backend` cobre só o `COLLATE` dos catálogos da PR #629, não `/products`.
- `GET /prescriptions`: só `filter=pending` é válido (`all`, `completed`, `draft`… → 422 "Filtro inválido"); sem `filter` → 422. `q` não filtra.
- Não existe `GET` de fórmula/produto isolado (405); tudo vem pelo detalhe (≈34 KB com 14 fórmulas). Não existe `DELETE` de receita (405), nem rota de descarte/cancelamento, apesar de `discarded_at`/`cancelled_at` no schema.
- `GET /prescriptions/{id}/formulas/{id}/tracking-steps`: 404 (rota do `backendApiService`).

### 🟡 B12 — Demais comportamentos confirmados (corretos)
401 sem token; 404 receita/fórmula/produto inexistente; `id` textual → 422 `INVALID_CONTEXT`; FKs inexistentes (prescritor, paciente, comprador, loja de retirada, tipo de operação, setor, convênio, funcionário, forma, estoque, tipo de medicamento, unidade) → 422 com mensagem específica; finalizar exige todas as fórmulas calculadas; finalizar/cancelar são idempotentes (422 "já finalizada"/"ainda não finalizada"); `calculated:true` via PATCH recusado; formula_number é sempre sequencial (o enviado é ignorado).

### Cálculo — Passiflora (referência numérica para o desktop)
Forma 2 (cápsulas), `qvd 30`, `multiplier 1`, **250 mg**: venda **28,01**, custo **4,03**, validade `2027-01-14`; 8 linhas (Passiflora 8,771 g calc. + base efervescente 0,3101 g + cápsula, frasco, tampa, etiquetas, sachê de sílica). Escala linear coerente: `qvd 60` → 46,52; `multiplier 2` → 56,02; extra 5 → 33,01; medicine_type_value 2 → 30,01; 500 mg → 31,20; forma 1 (creme) 2 g → 57,08 com taxa técnica 28,00. Latência: criar receita 0,25–1,2 s; fórmula ~0,35 s; calcular 0,65–0,8 s; prévia 0,1–0,6 s; detalhe ~0,2 s.

---

## 3. Achados do front (bundle real + testids)

### 🔴 F1 — Desconto digitado não é gravado
A tela tem o rodapé de desconto (`receita-footer-desconto`, `receita-footer-desconto-input`), mas o corpo de `update` (`zB`/`LB`) não envia desconto e o `calculate` não leva corpo. O valor só alimenta a prévia — **perde-se ao Gravar** (par de B3). O schema não limita a faixa (`discount_percentage: number`).

### 🟠 F2 — Partes da tela são stub
- "Origem da venda": `saleOrigin: () => Promise.resolve({items: []})` (sempre vazio).
- Financeiro: `finance = {movements: [], form: {method: '', value: 0}, totals.receipts: 0}` fixo; `totals.techFee`/`extraValue` da receita fixos em 0 (valores reais vêm só da fórmula).
- `sale_type: 1` fixo (a API aceita 2 — `PATCH sale_type: 2` → 200).
- Laboratório: o front lê `/laboratories` e `/laboratories/{id}/pharmaceutical-forms`, mas a escolha não tem efeito (B5).

### 🟠 F3 — Paridade funcional com o desktop (tela `TfMOV_0145`)
Presentes no desktop e sem equivalente na tela web: **Registrar baixa, botão Registrar processo, Gerar NF-e, Rótulos, Fichas, Consultar, Relatórios**, botões **Orçamentos (n)** e **Pendências (n)**, campo **Código CID** (a API devolve `cid_code`, sem campo no front), "Revenda", "Comissão"/"Origem da venda"/"Forma de pagto." (parcial). Presentes na web: tipo humana/animal, busca por código, navegação entre fórmulas (`receita-switcher-*`), abas, tabela de produtos, rastreabilidade (processos), rodapé de valores, Limpar/Digitalizar/Gravar.

### 🟠 F4 — Sem limites superiores nem autorização
Schemas zod exigem só `qvd > 0`, `multiplier ≥ 1`, `quantity > 0`: nada impede `1e12`/`99999` (B2), então o usuário recebe o 500 genérico. Para controlado/dosagem fora da faixa o front só exibe a mensagem do servidor — não há fluxo de "autorizar" (583/621).

### 🟡 F5 — Avisos regulatórios fecham sozinhos
O painel de avisos de cálculo (controlado, quantidade fora da especificação, incompatibilidade) tem auto-dismiss de **10 s** (`dH = 10`) — avisos de portaria somem sem confirmação do operador.

### 🟡 F6 — Contrato front × back
Front lê 3 capabilities de receita e 16 de fórmula; o backend devolve 18 por fórmula (`can_edit_calculated`, `can_edit_product_in_completed_formula` ignoradas). Campos novos do detalhe (`attendance_id`, `patient_phone`, `buyer_phone`, `patient_birth_date`, `patient_cpf_cnpj`) também não entram no schema do front. Sem teste E2E: `6.receitas.cy.js` tem só 2 testes de estrutura (já registrado em `ROADMAP.md` P2).

---

## 4. Recomendações (ordem sugerida)

1. **Backend**: validar `{store_id}` × token em todas as rotas `/prescriptions` (B1); limites superiores + 422 em `quantity`, `multiplier`, `qvd`, `cid_code` (B2/B6) e valores negativos; definir e expor escrita de desconto com faixa 0–100 (B3); travar/condicionar edição pós-finalização com capabilities de recurso (B4); gravar `lab_id` ou documentar que é derivado (B5); corrigir 409 de `expected_delivery_at` (B7).
2. **Produto/dev**: decidir o caminho de autorização de 583/621/193/301/352/662 (hoje inexistente) e incluir 583, 400 e 217 no `PERMISSION_REFERENCE.md`.
3. **Front**: parar de exibir desconto não persistível ou implementar a gravação junto com o backend; remover stubs (origem da venda, financeiro) ou marcar como indisponíveis; limites de campo; revisar o auto-dismiss dos avisos.
4. **QA/automação**: (a) conta restrita no `env.json` para RBAC negativo da 145 (pendência B4); (b) cenário Appium da 145 com a mesma fórmula (Passiflora 250 mg, qvd 30) para comparar **28,01 / 4,03** com o desktop — é o oráculo do cálculo; (c) após correção, converter B1/B2/B3/B6/B7 em testes de contrato em `0.backend.cy.js` (novo contexto ao final).

---

## 5. Resíduos no ambiente

Não existe `DELETE` de receita: ficaram ~20 receitas de teste (`261000560`–`2610005xx`, observação "CAIXA PRETA 145…") com dezenas de fórmulas no tenant dev, incluindo a `261000572` com `store_id = 999`. Os specs de sonda foram removidos; ver também o §6 (permissões).

---

## 6. Caixa preta das permissões (2026-10-14, 2ª etapa)

**Método.** Caminho `true` na API real (conta com tudo concedido): para cada capability, a ação que ela governa. Caminho `false` na **UI real** (`app.omnicare.dev.local/receitas/:id`) com a resposta **real** adulterada em voo (`cy.intercept` + `req.continue`), uma capability por vez, lendo o estado (`disabled`/`readOnly`/`aria-disabled`/presença) de todos os controles com `data-testid`: 65 cenários em 2 receitas (rascunho e finalizada), mais o painel de rastreabilidade e as abas de posologia/rótulo por dentro. Limite: a revogação **no backend** (recusa real com a capability `false`) não é alcançável sem conta restrita.

### 6.1 Receita (3 capabilities de recurso)
| Capability | API real (`true`) | UI com `false` |
|---|---|---|
| `can_update` | PATCH da receita 200 | **só o "Gravar"** fica `disabled`/`aria-disabled`; todos os campos continuam editáveis, e as edições de fórmula/produto (que persistem na hora) não são afetadas |
| `can_finalize` | finalizar 200 · ⚠ vem `true` em receita **sem fórmulas** e com fórmula **não calculada/`needs_recalculate`**, onde `finalize` responde 422 | "Concluído" (`valor-total-concluido`) desabilitado; em receita já finalizada sem efeito (correto) |
| `can_cancel_finalization` | cancelar 200 | em receita finalizada, "Concluído" desabilitado; em rascunho sem efeito (correto) |

### 6.2 Fórmula (18 capabilities) — a UI só consome 6
| Capability | API (`true`) | UI com `false` |
|---|---|---|
| `can_update_formula` | PATCH 200 | desabilita "Concluído" da fórmula, quantidade, unidade, adicionar, editar e excluir produto — **mas não** multiplicador nem QVD (o front fixa `multipleDisabled`/`qvdDisabled` em `false`, ignorando a capability) |
| `can_calculate` | `false` em fórmula sem produto (422 coerente); `true` com produto | desabilita "Calcular" ✔ |
| `can_edit_posology` | PATCH 200 | campo posologia vira texto estático ✔ |
| `can_edit_label` | PATCH 200 | somem os 2 campos (texto do rótulo e obs. do rótulo) ✔ |
| `can_edit_technical_fee` / `can_edit_extra_value` | PATCH 200 | `receita-footer-tx-tecnica-input` / `-valor-extra-input` desabilitados ✔ |
| `can_delete_formula` | DELETE 204 (inclusive calculada) | **sem efeito**: não existe botão de excluir fórmula |
| `can_edit_calculated`, `can_edit_product_in_completed_formula` | edição de fórmula calculada e inclusão de produto 200 | sem efeito (front não lê as duas) |
| `can_edit_formula_observation`, `can_edit_stock_store`, `can_edit_manual_weight`, `can_edit_medicine_type_value`, `can_edit_expiry_date`, `can_edit_return_date`, `can_edit_lab_delivery`, `can_edit_automatic_inclusion`, `can_edit_prescription_ok` | PATCH 200 em todos | **sem efeito**: os controles correspondentes são **sempre** somente leitura/desabilitados (`formula-estoque-baixa` R, `formula-auto-include` D, `formula-controlled` ("Receituário Ok") D, `receita-footer-hora-laboratorio-input` D, datas de vencimento/retorno sem input) ou não existem; as abas "Obs. ficha pesagem/sistema/receita" só têm um `textarea` placeholder somente leitura |

`continuous_use` (aceito no `POST` da fórmula) não é gravável por `PATCH` (422 "Nenhum campo válido").
Toda edição de uma fórmula **calculada** (inclusive posologia, rótulo e observação, que não mudam preço) a devolve para `calculated:false`/`needs_recalculate:true` e passa a bloquear a finalização.

### 6.3 Conta (24 capabilities de `/prescription-capabilities`) — a UI só consome 7
| Capability | API (`true`) | UI com `false` |
|---|---|---|
| `can_update_covenant` | PATCH `covenant_id` 1/2/null 200 | campo e busca de convênio desabilitados ✔ |
| `can_search_client_agreements` | `GET /clients/:id/agreements` 200 (vazio para o cliente de teste) | só o botão de busca do convênio ✔ |
| `can_access_manipulation_processes` | listar/registrar 200/201 | aba "Rastreabilidade" `aria-disabled` ✔ |
| `can_delete_manipulation_process` | DELETE 204 (2º → 404) | botão excluir some ✔ |
| `can_update_other_employee_process` | PATCH de funcionário 200 | botão editar some das linhas **com funcionário**, inclusive as do **próprio** operador (o front testa `employeeId != null`, não `== usuário logado`) |
| `can_mark_process_commissioned` / `can_reassign_process_employee` | PATCH 200 / 200 | **cada uma sozinha não tem efeito**; só vira efeito se as duas forem `false` (regra `!M && !N` do front); reatribuir funcionário não tem trava própria |
| `can_update_operation_type`, `can_update_sales_sector`, `can_update_commissioned_employee`, `can_update_pickup_store` | PATCH 200 (e `null` limpa) | **sem efeito** (front não lê; campos seguem editáveis) |
| `can_create_recipe`, `can_create_with_pending_recipes` | POST 201 | **sem efeito**: nenhuma trava para novo cadastro |
| `can_update_registration_store` | `store_id` não é patchável (422), sem como exercitar | sem efeito |
| `can_update_commissioned_other_store` | sem massa (funcionário de outra loja) | sem efeito |
| `can_update_formula_with_financial`, `can_uncalculate_formula_with_financial`, `can_edit_discount_with_financial` | **sem massa**: nenhuma das 4 receitas finalizadas pesquisadas tinha `financial_id` | sem efeito |
| `can_edit_discount` | **não existe escrita de desconto** (B3) | sem efeito (e `receita-footer-desconto-input` é sempre desabilitado) |
| `can_calculate_with_minimum_validity` | sem massa de validade mínima | sem efeito |
| `can_finalize_with_insufficient_stock` | sem massa de estoque insuficiente | sem efeito |
| `can_link_cart` | `POST /prescriptions/:id/cart` → 200 `{cart_id}` (⚠ **cria o carrinho de verdade**: `261000021`) | sem efeito (não há botão de carrinho na tela) |
| `can_generate_nfse` | `POST /prescriptions/:id/nfse` → 422 "Movimento sem financeiro" (coerente) | sem efeito |
| `can_register_stock_shortage` | **sem rota** (404 em `stock-shortage`/`stock-shortages`) | sem efeito |

**Fail-open:** com `capabilities` ausente/vazia (`{}`), **tudo** fica habilitado (o front usa `!== false`), o oposto da regra fail-closed adotada para `resources` (§7 item 6 do `PROJECT_CONTEXT.md`). Enquanto as capabilities carregam, convênio e rastreabilidade ficam desabilitados por instantes (transitório).

### 6.4 Achados novos (permissões)
1. 🔴 **Backend — `can_finalize` não reflete a pré-condição**: `true` em receita sem fórmulas e com fórmula não calculada, mas a ação dá 422; o front só depende dela para habilitar o "Concluído".
2. 🔴 **Front — multiplicador e QVD ignoram `can_update_formula`** (hard-coded habilitado) enquanto o mesmo flag bloqueia produtos e "Concluído".
3. 🟠 **Front — 17 das 24 capabilities de conta e 12 das 18 de fórmula não têm efeito algum na tela**: quem tem a capability revogada continua vendo/editando o campo (a recusa só viria do backend, não verificável sem conta restrita).
4. 🟠 **Front — `can_update_other_employee_process`** bloqueia também o processo do próprio operador; `mark`/`reassign` só funcionam em conjunto.
5. 🟠 **Backend — capabilities sem rota/campo**: `can_register_stock_shortage` sem endpoint, `can_edit_discount` sem escrita, `can_update_registration_store` sem campo gravável.
6. 🟠 **Backend — edição de texto invalida o cálculo** (posologia/rótulo/observação em fórmula calculada → `needs_recalculate`), bloqueando a finalização sem necessidade de recálculo de preço.
7. 🟡 **Side effect**: `POST /prescriptions/:id/cart` cria carrinho real sem pré-condição visível (`cart_id 261000021`).
8. 🟡 **Fail-open** do front para capabilities ausentes.

### 6.5 Pendências
- Revogação real no backend (403/422 com a capability `false`): exige conta restrita no tenant dev (recomendação 4a acima).
- Massa para 5 capabilities sem como exercitar: receita com financeiro, estoque insuficiente, validade mínima, funcionário de outra loja, mudança de loja de cadastro.
- Resíduo desta etapa no tenant dev: ~6 receitas "CAIXA PRETA PERMISSOES" e o carrinho `261000021`.
