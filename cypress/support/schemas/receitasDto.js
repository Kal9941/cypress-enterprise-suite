/**
 * DTOs de resposta das rotas de receita, copiados do front (omnicare-org/omnicare-front, branch developer, commit ff2267ea0b,
 * `src/features/prescription/domain/*.dto.ts`) — ROADMAP P2-16, onda 1 (decisão do operador, 2026-11-06).
 * O front passa cada resposta por `zodResponseParser(<Dto>Schema)` (`infra/*.endpoints.ts`): um mock fora deste contrato faz a tela
 * cair no erro genérico, longe do intercept que o causou. Validar o mock com o mesmo schema acusa o problema na montagem do intercept.
 * Gerado por script (só remove `import` e `export type` do TS); para atualizar, copiar de novo do front, nunca editar à mão.
 * zod 4 do front = `zod/v4` do zod 3.25 deste projeto (mesma API, inclusive `.loose()`).
 */
import { z } from 'zod/v4';

// ---- src/features/prescription/domain/prescription.dto.ts ----
/**
 * DTOs da API de Receitas (cabeçalho A1 + fórmulas A2 + produtos A3).
 *
 * Espelham o contrato do backend: JSON `snake_case` em inglês, sem envelope `data`.
 * Validam a resposta antes do mapper converter para o domínio UI (camelCase).
 */

export const CapabilitiesDtoSchema = z.object({
  can_update: z.boolean(),
  can_finalize: z.boolean(),
  can_cancel_finalization: z.boolean(),
  // Convênio e processos de manipulação NÃO vivem aqui: vêm de
  // `GET /prescription-capabilities` (mapa de módulo).
});

/**
 * Capabilities por fórmula (embutidas na fórmula em GET/create/patch/calculate).
 * Definido aqui — e não em `formulaCalc.dto.ts` — para o `FormulaDtoSchema`
 * poder referenciá-lo sem import circular.
 */
export const FormulaCapabilitiesDtoSchema = z.object({
  can_update_formula: z.boolean(),
  can_delete_formula: z.boolean(),
  can_calculate: z.boolean(),
  can_edit_calculated: z.boolean(),
  can_edit_posology: z.boolean(),
  can_edit_label: z.boolean(),
  can_edit_formula_observation: z.boolean(),
  can_edit_stock_store: z.boolean(),
  can_edit_manual_weight: z.boolean(),
  can_edit_technical_fee: z.boolean(),
  can_edit_extra_value: z.boolean(),
  can_edit_medicine_type_value: z.boolean(),
  can_edit_expiry_date: z.boolean(),
  can_edit_return_date: z.boolean(),
  can_edit_lab_delivery: z.boolean(),
  can_edit_automatic_inclusion: z.boolean(),
  can_edit_prescription_ok: z.boolean(),
  can_edit_product_in_completed_formula: z.boolean(),
});

export const ProductDtoSchema = z.object({
  id: z.number(),
  formula_number: z.number(),
  line_number: z.number(),
  product_id: z.number(),
  product_name: z.string(),
  product_code: z.number().nullable(),
  barcode: z.string().nullable(),
  batch: z.string().nullable().optional(),
  quantity: z.number(),
  unit: z.string(),
  quantity_calculated: z.number(),
  sale_value: z.number(),
  sale_value_discounted: z.number(),
  cost_value: z.number(),
  sale_value_unit: z.number(),
  cost_value_unit: z.number(),
  discount_percentage: z.number(),
  discount_value: z.number(),
  movement_type: z.number(),
  prescription_date_required: z.boolean(),
  notification_number_required: z.boolean(),
  prescription_type_code: z.number(),
  monitoring_required: z.boolean(),
  observation: z.string().nullable(),
  updated_at: z.string(),
  updated_by: z.number(),
});

export const FormulaDtoSchema = z.object({
  id: z.number(),
  formula_number: z.number(),
  pharmaceutical_form_id: z.number().nullable(),
  pharmaceutical_form_name: z.string().nullable(),
  lab_id: z.number().nullable(),
  lab_name: z.string().nullable(),
  medicine_type_id: z.number().nullable(),
  medicine_type_name: z.string().nullable(),
  drops: z.string().nullable(),
  multiplier: z.number(),
  qvd: z.number(),
  weight: z.number().nullable(),
  posology: z.string().nullable(),
  label_text: z.string().nullable(),
  label_description: z.string().nullable(),
  label_observation: z.string().nullable(),
  technical_fee_value: z.number().nullable(),
  expiry_date: z.string().nullable(),
  return_date: z.string().nullable(),
  calculated: z.boolean(),
  calculated_at: z.string().nullable(),
  discount_percentage: z.number(),
  discount_value: z.number(),
  sale_value: z.number(),
  sale_value_discounted: z.number(),
  cost_value: z.number(),
  continuous_use: z.boolean(),
  repetition: z.number(),
  repetition_text: z.string().nullable(),
  formula_observation: z.string().nullable(),
  cid_code: z.string().nullable(),
  stock_store_id: z.number().nullable(),
  production_store_id: z.number().nullable(),
  production_store_name: z.string().nullable(),
  lab_delivery_at: z.string().nullable(),
  percentage_pp: z.number(),
  updated_at: z.string(),
  updated_by: z.number(),
  products: z.array(ProductDtoSchema),
  // Presentes no GET base quando o backend os expõe; opcionais para tolerar
  // respostas legadas. Habilitam o gating de edição de fórmula antes do calcular.
  prescription_ok: z.boolean().optional(),
  // Valor extra da fórmula. O GET base pode não trazê-lo (ausente) ou trazê-lo
  // como `null` — o superset A2 do `calculate` sempre traz (ver
  // `FormulaCalcDtoSchema`). `nullable().optional()` cobre ambos; o mapper aplica
  // `?? 0` sem perder o valor quando presente.
  extra_value: z.number().nullable().optional(),
  capabilities: FormulaCapabilitiesDtoSchema.optional(),
});

export const PrescriptionTypeDtoSchema = z.enum(["human", "animal"]);

export const PrescriptionDtoSchema = z.object({
  id: z.number(),
  prescription_type: PrescriptionTypeDtoSchema,
  status: z.number(),
  sale_type: z.number(),
  patient_id: z.number().nullable(),
  patient_name: z.string().nullable(),
  buyer_id: z.number().nullable(),
  buyer_name: z.string().nullable(),
  animal_id: z.number().nullable(),
  animal_name: z.string().nullable(),
  animal_weight: z.number().nullable(),
  animal_birth_date: z.string().nullable(),
  prescriber_id: z.number().nullable(),
  prescriber_name: z.string().nullable(),
  crm: z.string().nullable(),
  crm_type: z.string().nullable(),
  crm_state: z.string().nullable(),
  document_type_id: z.number().nullable(),
  rg_ie: z.string().nullable(),
  issuing_body: z.string().nullable(),
  issuing_body_uf: z.string().nullable(),
  operation_type_id: z.number().nullable(),
  operation_type_name: z.string().nullable(),
  sales_sector_id: z.number().nullable(),
  sales_sector_name: z.string().nullable(),
  commissioned_employee_id: z.number().nullable(),
  commissioned_employee_name: z.string().nullable(),
  pickup_store_id: z.number().nullable(),
  pickup_store_name: z.string().nullable(),
  covenant_id: z.number().nullable(),
  covenant_name: z.string().nullable(),
  pay_doctor_commission: z.boolean(),
  pay_employee_commission: z.boolean(),
  observation: z.string().nullable(),
  patient_observation: z.string().nullable(),
  prescriber_observation: z.string().nullable(),
  customer_age: z.string().nullable(),
  customer_debt: z.boolean(),
  buyer_debt: z.boolean(),
  sale_value: z.number(),
  sale_value_discounted: z.number(),
  cost_value: z.number(),
  discount_percentage: z.number(),
  discount_value: z.number(),
  expected_delivery_at: z.string().nullable(),
  // `nullish` e não `nullable`: o `calculate` devolve a árvore da receita SEM
  // este campo — exigi-lo reprovava a resposta 200 inteira no parse.
  delivery_id: z.number().nullish(),
  financial_id: z.number().nullable(),
  // `nullish`: campo novo (backend#462) não pode reprovar a resposta inteira no
  // parse de um backend que ainda não o devolve.
  attendance_id: z.number().nullish(),
  nfse_id: z.number().nullable(),
  alert_message: z.string().nullable(),
  recipe_blocked: z.number(),
  total_images: z.number().nullable(),
  discarded_at: z.string().nullable(),
  discarded_by: z.number().nullable(),
  store_id: z.number(),
  created_at: z.string(),
  created_by: z.number(),
  updated_at: z.string(),
  updated_by: z.number(),
  cancelled_at: z.string().nullable(),
  cancelled_by: z.number().nullable(),
  formulas: z.array(FormulaDtoSchema),
  capabilities: CapabilitiesDtoSchema,
  // `nullish`: campo novo (backend#792), configuração da loja da sessão.
  settings: z
    .object({
      delivery_schedule: z.string(),
      // `nullish`: ambiente com backend sem a #792 não quebra o parse.
      return_date_required: z.boolean().nullish(),
    })
    .nullish(),
});

/**
 * Resposta de `finalize` / `cancel-finalization` (POST, sem body). É um payload
 * PARCIAL — não a receita inteira: traz `status`, `capabilities` e (no finalize)
 * os totais recalculados + `warnings`. Só `status` e `capabilities` são
 * consumidos; o resto é tolerado como opcional.
 */
export const FinalizationResultDtoSchema = z.object({
  id: z.number(),
  status: z.number(),
  capabilities: CapabilitiesDtoSchema,
  sale_value: z.number().optional(),
  sale_value_discounted: z.number().optional(),
  cost_value: z.number().optional(),
  updated_at: z.string().optional(),
  updated_by: z.number().optional(),
  warnings: z.array(z.unknown()).optional(),
  /** Só no finalize: a data gravada, a informada ou a marcada pela tabela. */
  expected_delivery_at: z.string().nullish(),
});

/** Body do POST — cabeçalho mínimo (totais são read-only). */
export const CreatePrescriptionBodySchema = z.object({
  prescription_type: PrescriptionTypeDtoSchema,
  sale_type: z.number(),
  patient_id: z.number().nullable().optional(),
  buyer_id: z.number().nullable().optional(),
  animal_id: z.number().nullable().optional(),
  prescriber_id: z.number().nullable().optional(),
  operation_type_id: z.number().nullable().optional(),
  sales_sector_id: z.number().nullable().optional(),
  commissioned_employee_id: z.number().nullable().optional(),
  pickup_store_id: z.number().nullable().optional(),
  covenant_id: z.number().nullable().optional(),
  document_type_id: z.number().nullable().optional(),
  rg_ie: z.string().nullable().optional(),
  issuing_body: z.string().nullable().optional(),
  issuing_body_uf: z.string().nullable().optional(),
  pay_doctor_commission: z.boolean().optional(),
  pay_employee_commission: z.boolean().optional(),
  observation: z.string().nullable().optional(),
  /** Vínculo com o atendimento de origem — só na criação (backend#462). */
  attendance_id: z.number().nullable().optional(),
});

/**
 * Body do PATCH — mesmos campos, todos opcionais, exceto `prescription_type`
 * (imutável) e `attendance_id` (o backend não move receita entre atendimentos).
 */
export const UpdatePrescriptionBodySchema = CreatePrescriptionBodySchema.omit({
  prescription_type: true,
  attendance_id: true,
})
  .extend({
    /** Só em receita já concluída: aberta, a trigger apaga e a API volta 409. */
    expected_delivery_at: z.string().nullable(),
  })
  .partial();

/** Body do `finalize`: a data de entrega ao cliente grava junto (backend#793).
 * `null` no modo automático deixa a tabela de horários marcar (backend#792). */
export const FinalizePrescriptionBodySchema = z.object({
  expected_delivery_at: z.string().nullable(),
});

// ---- src/features/prescription/domain/formulaCalc.dto.ts ----
/**
 * DTOs do cálculo de receita (Fórmula A2 superset + `calculate`).
 *
 * Estende o `FormulaDtoSchema` da fase 30 com os campos que só o fluxo de
 * cálculo expõe (`needs_recalculate`, `discount_location`, …). O
 * `FormulaCapabilitiesDtoSchema` vive em `prescription.dto.ts` (para o GET base
 * também poder carregá-lo sem import circular) e é re-exportado aqui por compat.
 * Contrato: JSON `snake_case`, sem envelope `data`.
 */

/** Fórmula A2 superset — base da fase 30 + campos do fluxo de cálculo. */
export const FormulaCalcDtoSchema = FormulaDtoSchema.extend({
  manual_weight: z.boolean(),
  extra_value: z.number().nullable(),
  medicine_type_value: z.number().nullable(),
  needs_recalculate: z.boolean(),
  discount_location: z.number().nullable(),
  system_observation: z.string().nullable(),
  prescription_ok: z.boolean(),
  automatic_inclusion: z.boolean(),
  capabilities: FormulaCapabilitiesDtoSchema.optional(),
});

/** Receita cujo array de fórmulas é o superset A2 (retorno do `calculate`). */
export const CalcPrescriptionDtoSchema = PrescriptionDtoSchema.extend({
  formulas: z.array(FormulaCalcDtoSchema),
});

export const CalculateWarningDtoSchema = z.object({
  code: z.string(),
  message: z.string(),
  product_id: z.number().nullable(),
  formula_id: z.number().nullable(),
});

/** Resposta do `POST .../calculate`: árvore da receita + warnings. */
export const CalculateSuccessDtoSchema = CalcPrescriptionDtoSchema.extend({
  warnings: z.array(CalculateWarningDtoSchema),
  // Documentado como sempre vazio; aceito de forma tolerante.
  incompatibilities: z.array(z.unknown()),
});

/** Body do POST — mínimo obrigatório + campos editáveis opcionais. */
export const CreateFormulaBodySchema = z.object({
  pharmaceutical_form_id: z.number(),
  qvd: z.number().positive(),
  multiplier: z.number().min(1),
  lab_id: z.number().nullable().optional(),
  medicine_type_id: z.number().nullable().optional(),
  weight: z.number().nullable().optional(),
  manual_weight: z.boolean().optional(),
  posology: z.string().nullable().optional(),
  label_text: z.string().nullable().optional(),
  label_observation: z.string().nullable().optional(),
  formula_observation: z.string().nullable().optional(),
  technical_fee_value: z.number().optional(),
  extra_value: z.number().optional(),
  medicine_type_value: z.number().optional(),
  expiry_date: z.string().nullable().optional(),
  return_date: z.string().nullable().optional(),
  lab_delivery_at: z.string().nullable().optional(),
  stock_store_id: z.number().nullable().optional(),
  automatic_inclusion: z.boolean().optional(),
  prescription_ok: z.boolean().optional(),
});

/**
 * Body do PATCH — campos mutáveis parciais (sem os totais/read-only) + o
 * `calculated` (checkbox "Concluído" da fórmula = `CONCLUIDOFORMULA`).
 */
export const UpdateFormulaBodySchema = CreateFormulaBodySchema.partial().extend({
  calculated: z.boolean().optional(),
});

// ---- src/features/prescription/domain/formulaProduct.dto.ts ----
/**
 * DTOs do A3 write (produtos da fórmula) — POST/PATCH/DELETE.
 *
 * Contrato: JSON `snake_case`, sem envelope `data`. A resposta de POST/PATCH é a
 * fórmula A2 (mesmo superset da fase 31) acrescida de `created_products` — as
 * linhas extras geradas por expansão automática (só no POST). O DELETE responde
 * `204` sem corpo.
 */

/**
 * Body do POST — `product_id` é o id do produto no CATÁLOGO (não a linha).
 * `positive` de propósito: `0` era o valor que uma linha sem seleção de catálogo
 * produzia, e o backend o aceitava só para falhar depois.
 */
export const CreateFormulaProductBodySchema = z.object({
  product_id: z.number().int().positive(),
  quantity: z.number().positive(),
  unit: z.string(),
});

/** Body do PATCH — quantidade/unidade parciais da linha existente. */
export const UpdateFormulaProductBodySchema = z.object({
  quantity: z.number().positive().optional(),
  unit: z.string().optional(),
});

/**
 * Resposta de POST/PATCH: fórmula A2 (superset) + `created_products` opcional.
 * `needs_recalculate` já vem do superset. `created_products` só no POST.
 */
export const FormulaProductMutationDtoSchema = FormulaCalcDtoSchema.extend({
  created_products: z.array(ProductDtoSchema).optional(),
});

// ---- src/features/prescription/domain/manipulationProcess.dto.ts ----
/**
 * DTOs dos processos de manipulação por fórmula (grade de rastreabilidade).
 *
 * Contrato: JSON `snake_case`, sem envelope `data`. Os booleanos
 * `commissioned`/`blocks_*` são obrigatórios — ausência é erro de contrato.
 */

export const ManipulationProcessItemDtoSchema = z.object({
  id: z.number(),
  process_type_id: z.number().nullable(),
  process_type_name: z.string().nullable(),
  employee_id: z.number().nullable(),
  employee_name: z.string().nullable(),
  date: z.string().nullable(),
  time: z.string().nullable(),
  sequence: z.number().nullable(),
  commissioned: z.boolean(),
  blocks_calculation: z.boolean(),
  blocks_prescription: z.boolean(),
});

/** GET .../manipulation-processes → lista ordenada por `sequence`. */
export const ManipulationProcessListDtoSchema = z.object({
  items: z.array(ManipulationProcessItemDtoSchema),
});

/** POST .../manipulation-processes (201) → item + aviso não bloqueante. */
export const RegisterManipulationProcessDtoSchema =
  ManipulationProcessItemDtoSchema.extend({
    warning_message: z.string().nullable(),
  });

/** Body do PATCH .../{process_id} — reatribuir e/ou marcar comissão. */
export const UpdateManipulationProcessBodySchema = z.object({
  employee_id: z.number().optional(),
  commissioned: z.boolean().optional(),
});

// ---- src/features/prescription/domain/laboratorySearch.dto.ts ----
/**
 * DTO da busca de laboratórios.
 * Contrato: JSON `snake_case`, sem envelope `data`; envelope `{ items, total }`.
 * `short_name` pode ser `null` (tratar ausência sem quebrar a renderização).
 */

export const LaboratoryItemDtoSchema = z.object({
  id: z.number(),
  name: z.string(),
  short_name: z.string().nullable(),
});

export const LaboratoryListDtoSchema = z.object({
  items: z.array(LaboratoryItemDtoSchema),
  total: z.number(),
});

// ---- src/shared/domain/pagination.ts (só o DTO) ----
export const PaginationDtoSchema = z.object({
  page: z.number(),
  per_page: z.number(),
  total: z.number(),
  total_pages: z.number(),
  has_next: z.boolean(),
  has_previous: z.boolean(),
});

// ---- src/features/prescription/domain/prescriptionListing.dto.ts ----
/**
 * A lista de receitas da loja: `GET /prescriptions/search`.
 *
 * Não há `type` no item: é animal quando `animal_id` vem preenchido, a mesma
 * regra do backend. Nome em branco no ERP chega `null`, e 12 receitas da dev não
 * têm cliente nenhum.
 *
 * `client_id` e `prescriber_id` vêm no fio e ficam de fora: a tela não os usa,
 * e um valor inválido neles reprovaria a página inteira (o `.loose()` os deixa
 * passar sem validar).
 *
 * `status` fica `string`: um quinto estado não pode derrubar a página inteira —
 * quem recusa o desconhecido é o mapper, linha a linha.
 */
export const PrescriptionListingItemDtoSchema = z
  .object({
    /**
     * Vira segmento de rota (`/receitas/:id`). Sem `coerce`: ele leria `null`
     * como 0 e `"1e2"` como 100. O backend serializa o `Int` como número.
     */
    id: z.number().int().positive(),
    client_name: z.string().nullish(),
    animal_id: z.coerce.number().nullish(),
    animal_name: z.string().nullish(),
    prescriber_name: z.string().nullish(),
    registered_at: z.string().nullish(),
    status: z.string(),
    /** `null` vira "—" na célula, e não um R$ 0,00 que parece valor real. */
    sale_value_discounted: z.coerce.number().nullable(),
  })
  .loose();

export const PrescriptionListingSummaryDtoSchema = z.object({
  total: z.number(),
  human: z.number(),
  animal: z.number(),
  open: z.number(),
  awaiting_delivery: z.number(),
  delivered: z.number(),
  discarded: z.number(),
});

export const PrescriptionListingDtoSchema = z
  .object({
    items: z.array(PrescriptionListingItemDtoSchema),
    pagination: PaginationDtoSchema,
    summary: PrescriptionListingSummaryDtoSchema,
  })
  .loose();
