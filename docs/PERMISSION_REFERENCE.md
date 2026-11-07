# Referência Central de Permissões Legadas

Este arquivo centraliza os códigos legados de permissão de **todos os domínios mapeados** no projeto. Use-o ao criar ou revisar qualquer spec que declare `legacyCode`, capabilities ou regras de enforcement.

**Padrão de implementação:** [`permissoes/spec-backend-permissoes-capabilities.md`](spec-backend-permissoes-capabilities.md)

---

## Como usar nas specs

Ao criar ou revisar uma spec de feature:

1. Identifique a ação protegida, filtro sensível ou endpoint afetado.
2. Localize o código legado nesta referência pela seção de domínio ou pelo índice numérico.
3. Use o código no campo `legacyCode` do catálogo do domínio **somente** quando existir operação backend equivalente.
4. Exponha capability pública (`can_*`) somente quando o frontend precisar habilitar, ocultar ou desabilitar uma ação.
5. Nunca exponha `legacyCode` em responses, mensagens de erro, URLs públicas ou logs de acesso.

**Módulos backend por domínio:**

| Domínio | Módulo backend | Tela legada |
|---------|----------------|-------------|
| Atendimento / Omni | `attendance` | MOV 0418 e subtelas |
| Receita | `recipe` | MOV 0145 |

Exemplo de referência dentro de uma spec:

```markdown
Permissão: `can_create_attendance`
Código legado: `636`
Origem: `pMOV_0418.pas`
Enforcement: antes de abrir novo fluxo de atendimento.
```

Exemplo de catálogo backend:

```kotlin
val CREATE_ATTENDANCE = PermissionDefinition(
    module = "attendance",
    protectedAction = "create_attendance",
    type = PermissionType.CREATE,
    capability = "can_create_attendance",
    legacyCode = "636"
)
```

> **Regra:** código de abertura de tela Delphi (validação **T**) não vira capability pública automaticamente. Primeiro precisa existir endpoint, ação ou filtro backend correspondente.

---

## Legenda de validação legada

| Símbolo | Significado no Delphi |
|---------|-----------------------|
| **P** | `fn_PERMISSAO` — usuário possui a permissão; bloqueia sem autorização |
| **A** | `fn_AUTORIZAR_PERMISSAO` — abre diálogo de autorização de supervisor |
| **P + A** | Verifica P; se ausente, tenta A (supervisor pode liberar) |
| **G** | Delega a `fd_REGISTRO_GRAVAR` com `strPermissao` preenchido |
| **T** | Validada ao abrir outra tela (`fn_FRM_ABRIR`) |

| intIAE | Operação |
|--------|----------|
| 1 | Incluir |
| 2 | Alterar |
| 3 | Excluir |

---

## Classificações

| Classificação | Quando usar | Capability pública |
|---------------|-------------|--------------------|
| `OPERATIONAL` | Protege ação backend clara: criar, alterar, remover, mudar status, executar ação especial | Sim, quando a UI depende dela |
| `FILTER` | Restringe listagens, buscas ou query params | Sim, quando a UI precisa conhecer a visibilidade |
| `AUXILIARY_READ` | Restringe consulta auxiliar usada por outro fluxo | Opcional; normalmente fica interno ao endpoint |
| `SCREEN_ACCESS` | Código usado para abrir tela Delphi ou controlar navegação legada | Não, salvo se houver módulo backend equivalente |
| `CUSTOMER_DOMAIN` | Permissão da ficha de cliente `CAD 0046` | Deve ser mapeada em catálogo próprio de `customer` |
| `UNCONFIRMED` | Código identificado, mas sem regra backend suficientemente clara | Não expor até confirmar regra |

---

## Domínio: Atendimento — MOV 418 e subtelas

Módulo backend: `attendance`. Telas: `pMOV_0418.pas`, `pMOV_0418_0.pas`, `pMOV_0418_3.pas`, `pCAD_0471.pas`, `pMOV_0635.pas`, `pMOV_0665.pas`, `pCAD_0046.pas`.

### Permissões operacionais

| Código legado | Capability backend | PermissionType | Classificação | Uso legado / origem |
|--------------:|--------------------|----------------|---------------|---------------------|
| `046` | `can_save_customer_on_attendance` | `UPDATE` | `OPERATIONAL` / `CUSTOMER_DOMAIN` | Inclusão/alteração de cliente dentro do fluxo; também abre `CAD 0046` |
| `414` | `can_mark_completed` | `STATUS_CHANGE` | `OPERATIONAL` | Mudar status para concluído em `pMOV_0418.pas` e `pMOV_0418_0.pas` |
| `475` | `can_mark_discarded` | `STATUS_CHANGE` | `OPERATIONAL` | Mudar status para descartado em `pMOV_0418.pas` e `pMOV_0418_0.pas` |
| `540` | `can_view_occupied_attendance` | `FILTER` | `FILTER` | Restringe abrir/listar atendimento ocupado por outro atendente |
| `554` | `can_change_attendant_status` | `STATUS_CHANGE` | `OPERATIONAL` | Alterar status do atendente em `pMOV_0418.pas` e `pMOV_0418_0.pas` |
| `557` | `can_transfer_assigned_attendance` | `TRANSFER` | `OPERATIONAL` | Transferir atendimento de outro usuário |
| `562` | `can_mark_finished` | `STATUS_CHANGE` | `OPERATIONAL` | Mudar status para finalizado; participa de bloqueio de reabertura |
| `597` | `can_send_payment_link` | `SPECIAL_ACTION` | `OPERATIONAL` | Envio de link de pagamento em `pMOV_0418_0.pas` e `pMOV_0418_3.pas` |
| `599` | `can_add_movement` | `CREATE` | `OPERATIONAL` | Incluir movimento no atendimento em `pMOV_0418_0.pas` |
| `636` | `can_create_attendance` | `CREATE` | `OPERATIONAL` | Abrir fluxo de nova mensagem/email; também abertura de tela |
| `640` | `can_remove_movement` | `DELETE` | `OPERATIONAL` | Retirar movimento do atendimento em `pMOV_0418_0.pas` |
| `649` | `can_transfer_pending_attendance` | `TRANSFER` | `OPERATIONAL` | Transferir atendimento pendente |
| `650` | `can_change_default_customer` | `UPDATE` | `OPERATIONAL` / `CUSTOMER_DOMAIN` | Alterar cliente padrão no fluxo; também pertence à ficha de cliente |
| `654` | `can_change_online_payment_with_benefit_program` | `UPDATE` | `OPERATIONAL` | Toggle de pagamento online com benefício em `pMOV_0418_0.pas` |
| `655` | `can_view_pending_attendance` | `FILTER` | `FILTER` | Visualizar atendimento pendente sem atendente |
| `658` | `can_create_customer_without_gender` | `CREATE` | `OPERATIONAL` / `CUSTOMER_DOMAIN` | Inclusão de cliente sem gênero no fluxo; também ficha de cliente |
| `689` | `can_transfer_omni_movement` | `TRANSFER` | `OPERATIONAL` | Transferir movimento em `pMOV_0418_0.pas` |
| `695` | `can_manage_os_support` | `SPECIAL_ACTION` | `OPERATIONAL` | Incluir/retirar suporte-OS em `pMOV_0418_0.pas` |

### Subtelas e consultas auxiliares

| Código legado | Capability sugerida | PermissionType | Classificação | Uso legado / origem | Observação backend |
|--------------:|---------------------|----------------|---------------|---------------------|--------------------|
| `418` | `can_view_attendance_detail`, `can_list_attendance_messages`, `can_list_attendance_budgets`, `can_list_attendance_internal_notes`, `can_list_standard_messages`, `can_list_group_agents` | `READ` | `OPERATIONAL` / `AUXILIARY_READ` | Detalhe, mensagens, orçamentos, notas internas, mensagens padrão; busca de atendentes exige `418` ativa na SQL — `can_list_group_agents` confirmado nesta capability pela backend#584/Issue #558 (2026-09-30): `GET /stores/:id/attendance-groups/:groupId/agents` exigia indevidamente a `471` (permissão de incluir/remover atendente do grupo), corrigido para `418` | Usar para cada endpoint correspondente; restringe consulta auxiliar de atendentes na transferência |
| `471` | A definir | `UPDATE` ou `SPECIAL_ACTION` | `UNCONFIRMED` | `pCAD_0471.pas` | Confirmar se protege alteração de status ou manutenção do grupo |
| `635` | A definir — módulo `omni-settings` | A definir | `OPERATIONAL` | Abertura/gravação de configurações `pMOV_0635.pas` | Será módulo backend próprio; criar `OmniSettingsPermissionCatalog` com endpoint de capabilities dedicado quando a feature for especificada |
| `665` | A definir — módulo `omni-monitoring` | A definir | `OPERATIONAL` | Abertura de monitoramento `pMOV_0665.pas` | Será módulo backend próprio; confirmar autorização exata em `pMOV_0665.pas` (sem `fn_PERMISSAO` explícita encontrada) antes de criar catálogo |
| `145`, `232`, `279`, `378`, `485`, `498` | Não expor por padrão | N/A | `SCREEN_ACCESS` | Outras telas abertas a partir de `pMOV_0418_0.pas` | Fora do catálogo de atendimento até existir endpoint correspondente |

### Ficha de Cliente (`CAD 0046`)

A ficha é aberta a partir do atendimento, mas possui permissões próprias. Specs de atendimento referenciam apenas os códigos que afetam diretamente o fluxo Omni. Specs de cliente devem criar catálogo próprio no domínio `customer`.

| Grupo | Códigos legados | Classificação | Diretriz |
|-------|-----------------|---------------|----------|
| Edição/gravação cliente | `046`, `443`, `447`, `555`, `624`, `650`, `658` | `CUSTOMER_DOMAIN` / `OPERATIONAL` | Usar `046`, `650`, `658` no atendimento para o fluxo Omni; demais pertencem exclusivamente ao domínio `customer` |
| Campos/restrições específicas | `309`, `515`, `528`, `674` | `CUSTOMER_DOMAIN` | Mapear em spec de cliente antes de expor capability |
| Opções, abas e menus extras | `064`, `066`, `101`, `186`, `197`, `378`, `391`, `461`, `499`, `503`, `507`, `510`, `511`, `513`, `514`, `633` | `CUSTOMER_DOMAIN` / `SCREEN_ACCESS` | Tratar como visibilidade/navegação até existir endpoint específico |
| Autorizações pontuais | `154`, `235`, `341`, `690` | `CUSTOMER_DOMAIN` / `UNCONFIRMED` | Exigir levantamento por caso de uso antes de implementar enforcement |

#### Confirmadas (resposta do dev, 2026-09-30 — fonte: `docs/architecture/permissions.md`, tabela gerada a partir dos catálogos, backend#580)

| Código legado | Capability backend | PermissionType | Classificação | Uso legado / origem |
|--------------:|--------------------|----------------|---------------|---------------------|
| `026` | `can_change_debt_status` | `UPDATE` | `OPERATIONAL` / `CUSTOMER_DOMAIN` | Alterar status de débito na ficha do cliente (`fCAD_0046`) |
| `027` | `can_change_client_name` | `UPDATE` | `OPERATIONAL` / `CUSTOMER_DOMAIN` | Alterar nome do cliente / nome fantasia (`fCAD_0046`) |
| `492` | `can_change_discount_type` | `UPDATE` | `OPERATIONAL` / `CUSTOMER_DOMAIN` | Alterar tipo de desconto (`fCAD_0046`) |
| `487` | `can_change_free_delivery` | `UPDATE` | `OPERATIONAL` / `CUSTOMER_DOMAIN` | Não cobrar entrega em domicílio/coleta (`fCAD_0046`) |
| `067` | `can_change_discount_percentage` | `UPDATE` | `OPERATIONAL` / `CUSTOMER_DOMAIN` | Alterar índices de desconto — **tela distinta**, `FCS_CAD_0067` (Índices de Desconto), não `fCAD_0046` |

---

## Domínio: Receita — MOV 145

Módulo backend: `recipe`. Tela: `pMOV_0145.pas`.

**Fonte completa do levantamento:** [`descricao/permissoes.md`](../descricao/permissoes.md)

> **Decisão registrada:** permissões de desbloqueio contextual (seção 2) são capabilities de **recurso**, não de módulo — o estado da receita determina se a verificação ocorre. Expor no endpoint de detalhe ou no `PUT`/`PATCH`, não em `recipe-capabilities` global.

> **Decisão registrada:** validação **G** delega enforcement a `fd_REGISTRO_GRAVAR`. No backend, o `require(...)` deve ser chamado no service **antes** do repository save.

### 1. Permissão principal

| Cód | Capability sugerida | PermissionType | Classificação | Validação legada | Rotina | Diretriz |
|----:|---------------------|----------------|---------------|------------------|--------|----------|
| **145** | `can_create_recipe` | `CREATE` | `OPERATIONAL` | P (I) | `btnGRAVARClick` | Exigir antes de inserir nova receita (CODIGO vazio) |
| **145** | `can_update_recipe` | `UPDATE` | `OPERATIONAL` | P (A) | `btnGRAVARClick` | Exigir antes de alterar receita existente |
| **145** | `can_view_recipe_reports` | `READ` | `SCREEN_ACCESS` | T | `btnCONSULTARClick` | Expor apenas se existir endpoint de consulta/relatório backend |

> **Nota:** código `145` cobre criar e alterar via `intIAE`. O cabeçalho RE1 usa validação **G** com o mesmo código — no backend, o `require` de criação/atualização cobre o save do cabeçalho.

### 2. Gravação — bloqueios e autorizações

Capabilities **contextuais** (recurso): o bloqueio depende do estado da receita no momento do save.

| Cód | Capability sugerida | PermissionType | Classificação | Validação legada | Condição de disparo | Diretriz |
|----:|---------------------|----------------|---------------|------------------|---------------------|----------|
| **702** | `can_create_with_pending_recipes` | `CREATE` | `OPERATIONAL` | P + A | Funcionário com receitas concluídas pendentes há > 10 dias | Verificar antes de aceitar novo movimento |
| **301** | `can_update_completed_recipe` | `UPDATE` | `OPERATIONAL` | P + A | `STATUS_MOV = -1` | Exigir antes de persistir alterações em receita concluída |
| **352** | `can_update_delivered_recipe` | `UPDATE` | `OPERATIONAL` | P + A | `ENTREGUE_CF` preenchido | Exigir antes de alterar receita entregue ao cliente |
| **662** | `can_update_finalized_recipe` | `UPDATE` | `OPERATIONAL` | P + A | `ENTREGUE_CF` preenchido + `CODIGO_ATEND_FL` vazio | Exigir antes de alterar receita finalizada sem financeiro |
| **323** | `can_deliver_outside_hours` | `SPECIAL_ACTION` | `OPERATIONAL` | A | Tipo operação = retirada na loja + entrega domicílio com horário bloqueado | Exigir antes de prosseguir com entrega fora do horário |
| **488** | `can_save_with_expired_covenant` | `SPECIAL_ACTION` | `OPERATIONAL` | A | Convênio com vencimento ultrapassado | Exigir antes de gravar com convênio vencido |
| **310** | `can_save_with_insufficient_covenant_balance` | `SPECIAL_ACTION` | `OPERATIONAL` | A | Saldo de convênio insuficiente | Exigir antes de gravar venda convênio sem saldo |
| **621** | `can_calculate_out_of_range_dosage` (nome medido na API, backend#657/PR #706; o levantamento sugeria `can_save_with_out_of_range_dosage`) | `SPECIAL_ACTION` | `OPERATIONAL` | P + A | Produto com dosagem fora do intervalo permitido | Exigir antes de gravar fórmula com dosagem irregular |
| **623** | `can_update_blocked_recipe` | `UPDATE` | `OPERATIONAL` | P | `RECEITA_BLOQUEADA = -1` ou `-2` | Exigir antes de alterar receita bloqueada |
| **169** | `can_revert_completed_status` | `STATUS_CHANGE` | `OPERATIONAL` | P | `STATUS_MOV` marcado como concluído | Exigir antes de desmarcar STATUS_MOV |
| **193** | `can_save_with_debtor_customer` | `SPECIAL_ACTION` | `OPERATIONAL` | A | Cliente ou comprador com débito | Exigir antes de gravar com cliente em débito |
| **259** | `can_update_other_store_recipe` | `UPDATE` | `OPERATIONAL` | P | Receita aviada em outra loja | Exigir antes de alterar receita de loja diferente |
| **582** | `can_save_without_stock` | `SPECIAL_ACTION` | `OPERATIONAL` | P + A | Produto sem estoque na fórmula | Exigir antes de gravar quando há produto sem estoque |

### 3. Cálculo de fórmula

| Cód | Capability sugerida | PermissionType | Classificação | Validação legada | Rotina | Diretriz |
|----:|---------------------|----------------|---------------|------------------|--------|----------|
| **436** | `can_accept_formula_below_min_validity` | `SPECIAL_ACTION` | `OPERATIONAL` | P + A | `CALCULAR` | Exigir ao aceitar fórmula com vencimento menor que `VALIDADE_FORMULA_MIN_A` |

### 4. Produtos — RE3 / A3

| Cód | Capability sugerida | PermissionType | Classificação | Validação legada | Rotina | Diretriz |
|----:|---------------------|----------------|---------------|------------------|--------|----------|
| **595** | `can_manage_paid_formula_product` | `UPDATE` | `OPERATIONAL` | P + A | `ABRIR_FORMULA_PRODUTO`, `pm_Excluir0Click` | Exigir antes de abrir, alterar ou excluir produto em movimento com financeiro |
| **222** | `can_delete_product_completed_recipe` | `DELETE` | `OPERATIONAL` | P (E) | `pm_Excluir0Click`, `btnEXCLUIR_3Click` | Exigir antes de excluir produto em receita concluída |
| **222** | `can_manage_product_completed_recipe` | `CREATE` / `UPDATE` | `OPERATIONAL` | G (I/A) | `btnPRO_INCEnter` → `fd_REGISTRO_GRAVAR` RE3 | Exigir antes de incluir ou alterar produto (RE3) em receita concluída |
| **220** | *(legado — sobrescrito por 222)* | — | `SCREEN_ACCESS` | — | `btnPRO_INCEnter` | Não usar em catálogos backend; controle efetivo usa **222** |

> **Nota sobre 222:** mesmo código cobre inclusão/alteração (G, I/A) e exclusão (P, E). Modelar como duas `PermissionDefinition` com `protectedAction` distintos, ambas com `legacyCode = "222"`.

### 5. Descontos e valores

| Cód | Capability sugerida | PermissionType | Classificação | Validação legada | Rotina | Diretriz |
|----:|---------------------|----------------|---------------|------------------|--------|----------|
| **154** | `can_edit_discount` | `UPDATE` | `OPERATIONAL` | A | `SpeedButton112Click`, `SpeedButton123Click` | Exigir antes de liberar edição de desconto |
| **596** | `can_edit_discount_with_financial` | `UPDATE` | `OPERATIONAL` | P + A | `DESCONTO_2PsAoAlterar` | Exigir antes de alterar desconto em movimento com financeiro |
| **152** | `can_edit_technical_fee` | `UPDATE` | `OPERATIONAL` | A | `sbVALOR_TAXATECNICA_2Click` | Exigir antes de editar taxa técnica manualmente |
| **153** | `can_edit_formula_extra_value` | `UPDATE` | `OPERATIONAL` | A | `sbVALORFORMULA_EXTRA_2Click` | Exigir antes de editar valor extra da fórmula |
| **062** | `can_edit_medication_type_value` | `UPDATE` | `OPERATIONAL` | A | `sbVLR_MEDClick` | Exigir antes de editar valor do tipo medicamento |

### 6. Campos da fórmula — RE2 / A2

| Cód | Capability sugerida | PermissionType | Classificação | Validação legada | Rotina | Diretriz |
|----:|---------------------|----------------|---------------|------------------|--------|----------|
| **449** | `can_edit_return_date` | `UPDATE` | `OPERATIONAL` | A | `sbRETORNO_DT_2Click` | Exigir antes de editar data de retorno |
| **057** | `can_edit_due_date` | `UPDATE` | `OPERATIONAL` | A | `SpeedButton15Click` | Exigir antes de editar data de vencimento |
| **151** | `can_edit_lab_delivery_datetime` | `UPDATE` | `OPERATIONAL` | A | `SpeedButton17Click` | Exigir antes de editar data/hora entrega laboratório |
| **402** | `can_edit_lab_schedule` | `SPECIAL_ACTION` | `SCREEN_ACCESS` | A + T | `SpeedButton18Click` | Abre MOV 0320; expor somente se existir endpoint backend de horários |
| **427** | `can_edit_customer_delivery_datetime` | `UPDATE` | `OPERATIONAL` | A | `sbENTREGA_DTHR_CLIClick` | Exigir antes de alterar data/hora entrega ao cliente |
| **060** | `can_edit_stock_write_off` | `UPDATE` | `OPERATIONAL` | A | `sbCODIGO_ESTOQUE_BAIXA_2Click` | Exigir antes de alterar estoque de baixa em movimento existente |
| **682** | `can_toggle_auto_inclusion` | `UPDATE` | `OPERATIONAL` | A | `INCLUSAOAUTOMATICA_2Click` | Exigir antes de marcar/desmarcar inclusão automática |
| **696** | `can_edit_posology` | `UPDATE` | `OPERATIONAL` | A | `POSOLOGIA_2Exit` | Exigir antes de alterar posologia em fórmula já salva |
| **697** | `can_edit_label_text` | `UPDATE` | `OPERATIONAL` | A | `TEXTOROTULO_2Exit` | Exigir antes de alterar texto do rótulo em fórmula já salva |
| **698** | `can_edit_formula_observation` | `UPDATE` | `OPERATIONAL` | A | `OBSERVACAOFORMULA_2Exit` | Exigir antes de alterar observação da fórmula |
| **699** | `can_edit_auxiliary_observation` | `UPDATE` | `OPERATIONAL` | A | `OBSERVACAO_AUXExit` | Exigir antes de alterar observação auxiliar |
| **213** | `can_mark_prescription_ok` | `STATUS_CHANGE` | `OPERATIONAL` | P + A | `lsRE2MouseUp`, `RECEITUARIO_OK_2Click` | Exigir antes de marcar receituário OK |
| **208** | `can_mark_formula_completed` | `STATUS_CHANGE` | `OPERATIONAL` | P + A | `CONCLUIDOFORMULA_2Click` | Exigir antes de marcar fórmula como concluída |
| **680** | `can_uncomplete_paid_formula` | `STATUS_CHANGE` | `OPERATIONAL` | A | `CONCLUIDOFORMULA_2Click` | Exigir antes de desmarcar fórmula concluída com financeiro |
| **652** | `can_block_formula_on_redo` | `SPECIAL_ACTION` | `OPERATIONAL` | P + A | `Bloquearfrmulanorefazer1Click` | Exigir antes de bloquear fórmula no refazer |
| **591** | `can_enable_manual_weight` | `SPECIAL_ACTION` | `OPERATIONAL` | P + A | `PESO_CALCULO_2Click` | Exigir antes de habilitar peso manual no cálculo |

### 7. Status do movimento

| Cód | Capability sugerida | PermissionType | Classificação | Validação legada | Rotina | Diretriz |
|----:|---------------------|----------------|---------------|------------------|--------|----------|
| **681** | `can_uncomplete_paid_movement` | `STATUS_CHANGE` | `OPERATIONAL` | A | `STATUS_MOVClick` | Exigir antes de desmarcar STATUS_MOV com financeiro ou finalizado |
| **307** | `can_finalize_movement` | `STATUS_CHANGE` | `OPERATIONAL` | P (I) | `Finalizarmovimento1Click` | Exigir antes de finalizar movimento |
| **307** | `can_cancel_finalization` | `STATUS_CHANGE` | `OPERATIONAL` | P (E) | `Cancelarfinalizao1Click` | Exigir antes de cancelar finalização |
| **320** | `can_edit_delivery` | `UPDATE` | `OPERATIONAL` | A | `sbENTREGA_ALTERARClick` | Exigir antes de alterar entrega em movimento concluído |
| **495** | `can_discard_movement` | `STATUS_CHANGE` | `OPERATIONAL` | P (I) | `FormActivate`, `Descartarmovimento1Click` | Visibilidade do menu via P; exigir P (I) antes de descartar |
| **495** | `can_cancel_discard` | `STATUS_CHANGE` | `OPERATIONAL` | P (E) | `Cancelardescarte1Click` | Exigir antes de cancelar descarte |

> **Nota sobre 307 e 495:** o mesmo código cobre ações distintas. Modelar com `PermissionDefinition` distintas por `protectedAction`, mesmo `legacyCode`.

### 8. Convênio

| Cód | Capability sugerida | PermissionType | Classificação | Validação legada | Rotina | Diretriz |
|----:|---------------------|----------------|---------------|------------------|--------|----------|
| **335** | `can_edit_covenant` | `UPDATE` | `OPERATIONAL` | A | `sbCODIGO_CONVENIOClick`, `sbCONVENIO_LIMPARClick` | Exigir antes de alterar ou limpar convênio em movimento existente |

### 9. Cabeçalho — campos extras

| Cód | Capability sugerida | PermissionType | Classificação | Validação legada | Rotina | Diretriz |
|----:|---------------------|----------------|---------------|------------------|--------|----------|
| **215** | `can_edit_operation_type` | `UPDATE` | `OPERATIONAL` | P + A | `sbTIP_OPEClick` | Exigir antes de alterar tipo de operação |
| **290** | `can_edit_sales_sector` | `UPDATE` | `OPERATIONAL` | P + A | `sbSET_VENClick` | Exigir antes de alterar setor de venda |
| **150** | `can_edit_commissioned_employee` | `UPDATE` | `OPERATIONAL` | P + A | `sbFUN_COMClick` | Exigir antes de alterar funcionário comissionado |
| **294** | `can_edit_pickup_store` | `UPDATE` | `OPERATIONAL` | P + A | `sbLOJ_RETClick` | Exigir antes de alterar loja de retirada |
| **287** | `can_edit_registration_store` | `UPDATE` | `OPERATIONAL` | P + A | `CADASTRO_LJClick`, `Vendadelivery1Click` | Exigir antes de alterar loja de cadastro ou iniciar venda delivery |
| **338** | `can_commission_other_store_employee` | `FILTER` | `FILTER` | P | `sbFUN_COMClick` | Sem permissão, restringir à loja do usuário JWT; com permissão, liberar qualquer loja |

### 10. Processos de manipulação — RAS

| Cód | Capability sugerida | PermissionType | Classificação | Validação legada | Rotina | Diretriz |
|----:|---------------------|----------------|---------------|------------------|--------|----------|
| **231** | `can_access_manipulation_processes` | `READ` | `OPERATIONAL` | P | `AbrirDig_P` | Exigir antes de abrir painel de processos |
| **231** | `can_update_other_employee_process` | `UPDATE` | `OPERATIONAL` | P (A) | `lsRASMouseUp` | Exigir antes de alterar processo de outro funcionário |
| **231** | `can_delete_manipulation_process` | `DELETE` | `OPERATIONAL` | G (E) | `MenuItem5Click` → `fd_REGISTRO_EXCLUIR` | Exigir antes de excluir registro de processo |
| **337** | `can_change_process_employee` | `UPDATE` | `OPERATIONAL` | P | `lsRASMouseUp` | Exigir antes de alterar funcionário de processo registrado por outro |
| **607** | `can_register_non_standard_process` | `SPECIAL_ACTION` | `OPERATIONAL` | P + A | `lsRASMouseUp` | Exigir antes de registrar processo fora do padrão do funcionário |
| **509** | `can_mark_process_commission` | `SPECIAL_ACTION` | `OPERATIONAL` | A | `lsRASMouseUp` | Exigir antes de marcar pagar comissão no processo |

> **Nota sobre 231:** mesmo código cobre três ações distintas. Modelar com três `PermissionDefinition` com `protectedAction` distintos, todas com `legacyCode = "231"`.

### 11. Interface — visibilidade e consultas internas

| Cód | Capability sugerida | PermissionType | Classificação | Validação legada | Rotina | Diretriz |
|----:|---------------------|----------------|---------------|------------------|--------|----------|
| **461** | `can_view_recipe_details` | `READ` | `OPERATIONAL` | P | `FormActivate` | Capability de módulo; controla visibilidade do botão de detalhe |
| **410** | `can_view_attendance_goals_button` | `READ` | `FILTER` | P (E) | `FormActivate` | Controla visibilidade do botão de meta; ocultar se ausente |
| **580** | `can_view_employee_goals` | `READ` | `SCREEN_ACCESS` | P + T | `sbMETA_BTNClick` | Abre MOV 0580; expor somente se existir endpoint backend de metas |
| **033** | `can_view_other_employee_goals` | `FILTER` | `FILTER` | P | `sbMETA_BTNClick` | Sem permissão, restringir à própria meta; com permissão, liberar qualquer funcionário |
| **705** | `can_view_change_log` | `READ` | `OPERATIONAL` | P + T | `FormActivate`, `Logdealteraes1Click` | P controla visibilidade do menu; abre UTI_RLOG |
| **110** | `can_view_hidden_products` | `FILTER` | `FILTER` | P | `pm_MostrarProdutoOcultoClick` | Sem permissão, ocultar produtos marcados como ocultos na grid RE3 |
| **384** | `can_view_formula_detail` | `READ` | `SCREEN_ACCESS` | P + T | `Detalhedareceita2Click` | Abre DET 0384; expor somente se existir endpoint de detalhe da fórmula |
| **922** | `can_consult_budgets` | `READ` | `SCREEN_ACCESS` | T | `btnCONSULTAR_ORCAMENTOSClick` | Não expor até existir endpoint backend |
| **919** | `can_consult_pending` | `READ` | `SCREEN_ACCESS` | T | `btnCONSULTAR_PENDENCIASClick` | Não expor até existir endpoint backend |

### 12. Telas externas abertas pela receita

Todos classificados como `SCREEN_ACCESS`. Não entram no `RecipePermissionCatalog` até existir endpoint backend correspondente.

| Cód | Nome da tela | Rotina | Diretriz |
|----:|--------------|--------|----------|
| **096** | Relatório de rótulo | `btnROTULOClick` | Não expor até existir endpoint de impressão |
| **103** | Fichas | `btnFICHASClick` | Não expor até existir endpoint de fichas |
| **387** | Detalhe receita (DET 0387) | `Detalhedareceita1Click` | Confirmar sobreposição com `GET /recipes/{id}` |
| **279** | Delivery — Ocorrência (MOV 0279) | `sbENTREGAClick` | Usar catálogo do domínio `delivery` quando existir |
| **232** | Revisão (MOV 0232) | `sbABRIR_REVClick` | Usar catálogo do domínio de revisão quando existir |
| **295** | Cadastro animal | `sbANIMALClick` | Usar catálogo do domínio `animal` quando existir |
| **345** | Atendimento financeiro (MOV 0345) | `sbCODIGO_ATEND_FLClick` | Usar catálogo do domínio `financial-attendance` quando existir |
| **073** | Pós-venda (MOV 0073) | `sbPOS_VENDAClick` | Usar catálogo do domínio de pós-venda quando existir |
| **391** | Consulta movimentação por funcionário | `Consultarporfuncionrio1Click` | Não expor até existir endpoint |
| **618** | Consulta movimentação por cliente | `Consultarporcliente1Click` | Não expor até existir endpoint |
| **619** | Consulta movimentação por médico | `ConsultarPormdico1Click` | Não expor até existir endpoint |
| **036** | Cadastro de prescritores | `sbMEDICOClick` | Usar catálogo do domínio `prescriber` quando existir |
| **063** | Registro de baixa | `btnREGISTRAR_BAIXAClick` | Usar catálogo do domínio de estoque quando existir |
| **418** | Omni Channel (MOV 0418) | `sbVENDA_APPClick` | Já coberto pelo domínio `attendance`; não duplicar |
| **084** | Peso médio — Receita (MOV 0084) | menu CQ | Não expor até existir endpoint |
| **202** | Horários laboratório | menu | Não expor até existir endpoint |
| **429** | NFS-e gerada | `GerarNFSe1Click` | Usar catálogo do domínio fiscal quando existir |
| **1008** | Consulta lotes movimentados | `Consultadelotesmovimentados1Click` | Não expor até existir endpoint |

### 13. Digitalização

| Cód | Capability sugerida | PermissionType | Classificação | Validação legada | Rotina | Diretriz |
|----:|---------------------|----------------|---------------|------------------|--------|----------|
| **221** | `can_digitize_recipe` | `SPECIAL_ACTION` | `SCREEN_ACCESS` | T | `btnDIGITALIZARClick` → `fn_IMAGEM_CAPTURAR` | Expor somente se existir endpoint de upload de imagem backend |

---

## Índice numérico — todos os domínios

| Cód | Domínio | Capability sugerida | Classificação |
|----:|---------|---------------------|---------------|
| 026 | Cliente | `can_change_debt_status` | `OPERATIONAL` / `CUSTOMER_DOMAIN` |
| 027 | Cliente | `can_change_client_name` | `OPERATIONAL` / `CUSTOMER_DOMAIN` |
| 033 | Receita | `can_view_other_employee_goals` | `FILTER` |
| 046 | Atendimento / Cliente | `can_save_customer_on_attendance` | `OPERATIONAL` / `CUSTOMER_DOMAIN` |
| 057 | Receita | `can_edit_due_date` | `OPERATIONAL` |
| 060 | Receita | `can_edit_stock_write_off` | `OPERATIONAL` |
| 062 | Receita | `can_edit_medication_type_value` | `OPERATIONAL` |
| 064 | Atendimento (`customer`) | — | `CUSTOMER_DOMAIN` / `SCREEN_ACCESS` |
| 066 | Atendimento (`customer`) | — | `CUSTOMER_DOMAIN` / `SCREEN_ACCESS` |
| 067 | Cliente (`FCS_CAD_0067`) | `can_change_discount_percentage` | `OPERATIONAL` / `CUSTOMER_DOMAIN` |
| 101 | Atendimento (`customer`) | — | `CUSTOMER_DOMAIN` / `SCREEN_ACCESS` |
| 110 | Receita | `can_view_hidden_products` | `FILTER` |
| 145 | Receita | `can_create_recipe` / `can_update_recipe` | `OPERATIONAL` |
| 150 | Receita | `can_edit_commissioned_employee` | `OPERATIONAL` |
| 151 | Receita | `can_edit_lab_delivery_datetime` | `OPERATIONAL` |
| 152 | Receita | `can_edit_technical_fee` | `OPERATIONAL` |
| 153 | Receita | `can_edit_formula_extra_value` | `OPERATIONAL` |
| 154 | Receita | `can_edit_discount` | `OPERATIONAL` |
| 169 | Receita | `can_revert_completed_status` | `OPERATIONAL` |
| 186 | Atendimento (`customer`) | — | `CUSTOMER_DOMAIN` / `SCREEN_ACCESS` |
| 193 | Receita | `can_save_with_debtor_customer` | `OPERATIONAL` |
| 197 | Atendimento (`customer`) | — | `CUSTOMER_DOMAIN` / `SCREEN_ACCESS` |
| 208 | Receita | `can_mark_formula_completed` | `OPERATIONAL` |
| 213 | Receita | `can_mark_prescription_ok` | `OPERATIONAL` |
| 215 | Receita | `can_edit_operation_type` | `OPERATIONAL` |
| 220 | Receita | *(legado — sobrescrito por 222)* | `SCREEN_ACCESS` |
| 221 | Receita | `can_digitize_recipe` | `SCREEN_ACCESS` |
| 222 | Receita | `can_manage_product_completed_recipe` / `can_delete_product_completed_recipe` | `OPERATIONAL` |
| 231 | Receita | `can_access_manipulation_processes` / `can_update_other_employee_process` / `can_delete_manipulation_process` | `OPERATIONAL` |
| 235 | Atendimento (`customer`) | — | `CUSTOMER_DOMAIN` / `UNCONFIRMED` |
| 259 | Receita | `can_update_other_store_recipe` | `OPERATIONAL` |
| 287 | Receita | `can_edit_registration_store` | `OPERATIONAL` |
| 290 | Receita | `can_edit_sales_sector` | `OPERATIONAL` |
| 294 | Receita | `can_edit_pickup_store` | `OPERATIONAL` |
| 301 | Receita | `can_update_completed_recipe` | `OPERATIONAL` |
| 307 | Receita | `can_finalize_movement` / `can_cancel_finalization` | `OPERATIONAL` |
| 309 | Atendimento (`customer`) | — | `CUSTOMER_DOMAIN` |
| 310 | Receita | `can_save_with_insufficient_covenant_balance` | `OPERATIONAL` |
| 320 | Receita | `can_edit_delivery` | `OPERATIONAL` |
| 323 | Receita | `can_deliver_outside_hours` | `OPERATIONAL` |
| 335 | Receita | `can_edit_covenant` | `OPERATIONAL` |
| 337 | Receita | `can_change_process_employee` | `OPERATIONAL` |
| 338 | Receita | `can_commission_other_store_employee` | `FILTER` |
| 341 | Atendimento (`customer`) | — | `CUSTOMER_DOMAIN` / `UNCONFIRMED` |
| 378 | Atendimento (`customer`) | — | `CUSTOMER_DOMAIN` / `SCREEN_ACCESS` |
| 384 | Receita | `can_view_formula_detail` | `SCREEN_ACCESS` |
| 391 | Atendimento (`customer`) | — | `CUSTOMER_DOMAIN` / `SCREEN_ACCESS` |
| 402 | Receita | `can_edit_lab_schedule` | `SCREEN_ACCESS` |
| 410 | Receita | `can_view_attendance_goals_button` | `FILTER` |
| 414 | Atendimento | `can_mark_completed` | `OPERATIONAL` |
| 418 | Atendimento | `can_view_attendance_detail`, `can_list_*` | `OPERATIONAL` / `AUXILIARY_READ` |
| 427 | Receita | `can_edit_customer_delivery_datetime` | `OPERATIONAL` |
| 436 | Receita | `can_accept_formula_below_min_validity` | `OPERATIONAL` |
| 443 | Atendimento (`customer`) | — | `CUSTOMER_DOMAIN` |
| 447 | Atendimento (`customer`) | — | `CUSTOMER_DOMAIN` |
| 449 | Receita | `can_edit_return_date` | `OPERATIONAL` |
| 461 | Receita | `can_view_recipe_details` | `OPERATIONAL` |
| 471 | Atendimento | A definir | `UNCONFIRMED` |
| 475 | Atendimento | `can_mark_discarded` | `OPERATIONAL` |
| 487 | Cliente | `can_change_free_delivery` | `OPERATIONAL` / `CUSTOMER_DOMAIN` |
| 488 | Receita | `can_save_with_expired_covenant` | `OPERATIONAL` |
| 492 | Cliente | `can_change_discount_type` | `OPERATIONAL` / `CUSTOMER_DOMAIN` |
| 495 | Receita | `can_discard_movement` / `can_cancel_discard` | `OPERATIONAL` |
| 499 | Atendimento (`customer`) | — | `CUSTOMER_DOMAIN` / `SCREEN_ACCESS` |
| 503 | Atendimento (`customer`) | — | `CUSTOMER_DOMAIN` / `SCREEN_ACCESS` |
| 507 | Atendimento (`customer`) | — | `CUSTOMER_DOMAIN` / `SCREEN_ACCESS` |
| 509 | Receita | `can_mark_process_commission` | `OPERATIONAL` |
| 510 | Atendimento (`customer`) | — | `CUSTOMER_DOMAIN` / `SCREEN_ACCESS` |
| 511 | Atendimento (`customer`) | — | `CUSTOMER_DOMAIN` / `SCREEN_ACCESS` |
| 513 | Atendimento (`customer`) | — | `CUSTOMER_DOMAIN` / `SCREEN_ACCESS` |
| 514 | Atendimento (`customer`) | — | `CUSTOMER_DOMAIN` / `SCREEN_ACCESS` |
| 515 | Atendimento (`customer`) | — | `CUSTOMER_DOMAIN` |
| 528 | Atendimento (`customer`) | — | `CUSTOMER_DOMAIN` |
| 540 | Atendimento | `can_view_occupied_attendance` | `FILTER` |
| 554 | Atendimento | `can_change_attendant_status` | `OPERATIONAL` |
| 555 | Atendimento (`customer`) | — | `CUSTOMER_DOMAIN` |
| 557 | Atendimento | `can_transfer_assigned_attendance` | `OPERATIONAL` |
| 562 | Atendimento | `can_mark_finished` | `OPERATIONAL` |
| 580 | Receita | `can_view_employee_goals` | `SCREEN_ACCESS` |
| 582 | Receita | `can_save_without_stock` | `OPERATIONAL` |
| 591 | Receita | `can_enable_manual_weight` | `OPERATIONAL` |
| 595 | Receita | `can_manage_paid_formula_product` | `OPERATIONAL` |
| 596 | Receita | `can_edit_discount_with_financial` | `OPERATIONAL` |
| 597 | Atendimento | `can_send_payment_link` | `OPERATIONAL` |
| 599 | Atendimento | `can_add_movement` | `OPERATIONAL` |
| 607 | Receita | `can_register_non_standard_process` | `OPERATIONAL` |
| 621 | Receita | `can_calculate_out_of_range_dosage` | `OPERATIONAL` |
| 623 | Receita | `can_update_blocked_recipe` | `OPERATIONAL` |
| 624 | Atendimento (`customer`) | — | `CUSTOMER_DOMAIN` |
| 633 | Atendimento (`customer`) | — | `CUSTOMER_DOMAIN` / `SCREEN_ACCESS` |
| 635 | Atendimento (`omni-settings`) | A definir | `OPERATIONAL` |
| 636 | Atendimento | `can_create_attendance` | `OPERATIONAL` |
| 640 | Atendimento | `can_remove_movement` | `OPERATIONAL` |
| 649 | Atendimento | `can_transfer_pending_attendance` | `OPERATIONAL` |
| 650 | Atendimento / Cliente | `can_change_default_customer` | `OPERATIONAL` / `CUSTOMER_DOMAIN` |
| 652 | Receita | `can_block_formula_on_redo` | `OPERATIONAL` |
| 654 | Atendimento | `can_change_online_payment_with_benefit_program` | `OPERATIONAL` |
| 655 | Atendimento | `can_view_pending_attendance` | `FILTER` |
| 658 | Atendimento / Cliente | `can_create_customer_without_gender` | `OPERATIONAL` / `CUSTOMER_DOMAIN` |
| 662 | Receita | `can_update_finalized_recipe` | `OPERATIONAL` |
| 665 | Atendimento (`omni-monitoring`) | A definir | `OPERATIONAL` |
| 674 | Atendimento (`customer`) | — | `CUSTOMER_DOMAIN` |
| 680 | Receita | `can_uncomplete_paid_formula` | `OPERATIONAL` |
| 681 | Receita | `can_uncomplete_paid_movement` | `OPERATIONAL` |
| 682 | Receita | `can_toggle_auto_inclusion` | `OPERATIONAL` |
| 689 | Atendimento | `can_transfer_omni_movement` | `OPERATIONAL` |
| 690 | Atendimento (`customer`) | — | `CUSTOMER_DOMAIN` / `UNCONFIRMED` |
| 695 | Atendimento | `can_manage_os_support` | `OPERATIONAL` |
| 696 | Receita | `can_edit_posology` | `OPERATIONAL` |
| 697 | Receita | `can_edit_label_text` | `OPERATIONAL` |
| 698 | Receita | `can_edit_formula_observation` | `OPERATIONAL` |
| 699 | Receita | `can_edit_auxiliary_observation` | `OPERATIONAL` |
| 702 | Receita | `can_create_with_pending_recipes` | `OPERATIONAL` |
| 705 | Receita | `can_view_change_log` | `OPERATIONAL` |
| 919 | Receita | `can_consult_pending` | `SCREEN_ACCESS` |
| 922 | Receita | `can_consult_budgets` | `SCREEN_ACCESS` |
| 1008 | Receita (tela externa) | — | `SCREEN_ACCESS` |

---

## Pendências de mapeamento

### Domínio: Atendimento

- **Código `471`:** confirmar se protege alteração de status do atendente, manutenção do grupo de atendimento ou ambas. *Impacto: capability pública e ponto exato de enforcement.*
- **Código `046` no domínio Atendimento (`can_save_customer_on_attendance`):** **Divergência medida (2026-10-07):** o drawer "Dados do Cliente" em Atendimentos não lê essa capability — ele reaproveita a `can_update_client` embutida em `GET /clients/:id`, a mesma do módulo `/clientes` standalone (confirmado via DOM real, `1.permissoes.cy.js` #1.25). `can_save_customer_on_attendance` segue como nome sugerido/hipotético, nunca confirmado implementado neste fluxo.
- **Código `635`:** ~~confirmar se haverá módulo backend próprio de configurações Omni~~ **Decisão registrada:** será módulo backend `omni-settings`. Criar `OmniSettingsPermissionCatalog` e endpoints dedicados quando a feature for especificada.
- **Código `665`:** ~~confirmar se haverá módulo backend de monitoramento~~ **Decisão registrada:** será módulo backend `omni-monitoring`. Confirmar autorização exata em `pMOV_0665.pas` (sem `fn_PERMISSAO` explícita encontrada) antes de criar catálogo.
- **Ficha de cliente (`CAD 0046`):** detalhar permissões completas em spec própria do domínio `customer` antes de expor capabilities fora do fluxo de atendimento. ~~026, 027, 487, 492 sem capability confirmada~~ **Resolvido (dev, 2026-09-30):** `026 → can_change_debt_status`, `027 → can_change_client_name`, `492 → can_change_discount_type`, `487 → can_change_free_delivery`, `067 → can_change_discount_percentage` (este último em tela distinta, `FCS_CAD_0067`) — ver seção "Confirmadas" acima.
- **Códigos 993–999:** seguem fluxo distinto no legado; exigem levantamento separado quando necessários.

### Domínio: Receita

- **Código `220`:** confirmado como legado sobrescrito por `222`. Não usar em catálogos backend.
- **Código `402`:** abre MOV 0320. Confirmar se haverá endpoint backend de horários laboratório.
- **Código `580`:** abre MOV 0580. Confirmar se o domínio de metas terá endpoints REST.
- **Código `384`:** abre DET 0384. Confirmar se `GET /recipes/{id}/formula-details` será implementado.
- **Códigos `919` e `922`:** confirmar se serão endpoints filtrados ou apenas navegação legada.
- **Código `221`:** confirmar se haverá endpoint de upload de imagem de receita.
- **Capabilities de desbloqueio contextual** (`301`, `352`, `662`, `702`, `621`, `582`, `193`, `310`, `488`, `323`): confirmar se serão embutidas no `PUT /recipes/{id}` ou em endpoint dedicado.
- **Telas externas com domínios não mapeados** (`279`, `232`, `295`, `345`, `073`, `036`, `063`, `429`): criar catálogos próprios nos respectivos domínios.

### Validação multi-loja e chave de grant (todos os domínios) — RESOLVIDO

> **Decisão registrada:** `{store_id}` na URL deve sempre coincidir com `AuthenticatedUser.storeCode`. Não há usuários multi-loja. O backend deve validar essa coerência em toda rota protegida antes da autorização; divergência retorna `422 INVALID_CONTEXT`.

> **Decisão registrada:** a chave de grant no Firebird usa `userId` para requests de autorização (estável, não muda). `profile` (nick do funcionário) é usado apenas para exibição. O `PermissionAuthorizer` de produção deve consultar grants por `userId`, nunca por nick.

---

## Checklist para atualizar specs

- [ ] A spec declara cada permissão backend com `legacyCode` quando o código existir nesta referência.
- [ ] A spec não expõe `legacyCode` em contrato público.
- [ ] A spec diferencia capability pública de código legado interno.
- [ ] Códigos classificados como `SCREEN_ACCESS` não viram capability sem endpoint backend equivalente.
- [ ] Permissões compartilhadas com `CAD 0046` não são duplicadas indevidamente no catálogo de atendimento.
- [ ] Pontos `UNCONFIRMED` ficam em perguntas em aberto até a regra ser confirmada.
- [ ] Codes com validação **G** têm `require` no service antes do repository save (não apenas no controller).
- [ ] Codes que aparecem mais de uma vez para ações distintas têm `PermissionDefinition` separadas por `protectedAction`.
- [ ] Capabilities de desbloqueio contextual (Receita seção 2) estão no endpoint de recurso, não em `recipe-capabilities` global.
