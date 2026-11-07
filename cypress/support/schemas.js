// cypress/support/schemas.js
// Validação de schema em runtime dos payloads mockados (AGENTS.md §3.4 [R-SCHEMA]).
//
// Escopo: só valida o que os Mocks REALMENTE respondem em modo hermético (customPayload/defaultBody),
// nunca a resposta real da API (isso é o item P2 "schema drift" do ROADMAP, separado). Cada schema
// cobre só os campos documentados como "obrigatório — armadilha" em AGENTS.md §3.4 — nunca a forma
// inteira do payload — para não quebrar mocks já verdes com campos extras/omissos legítimos.
//
// Chave de resolução: '<NomeDaClasseDeMock>.<alias>' tem precedência sobre '<alias>' puro, porque a
// mesma rota (GET /clients/:id) tem dois schemas diferentes conforme o consumidor —
// AtendimentosMocks (drawer "Dados do cliente") vs ClientesMocks (ficha `ClientDetailPage`, schema
// "W") — achado registrado em AGENTS.md §3.4, linha `GET/POST/PATCH /clients(/:id)`.
import { z } from 'zod';
import * as ReceitasDto from './schemas/receitasDto';

const capabilitiesEnvelopeSchema = z.object({
  capabilities: z.record(z.string(), z.unknown())
});

const filaSchema = z.object({
  items: z.array(
    z.object({
      customer_name: z.string(),
      status: z.number(),
      channel: z.object({ type: z.number() }).passthrough(),
      messages: z.object({ unread_count: z.number() }).passthrough()
    }).passthrough()
  )
}).passthrough();

// Achado no smoke test (2026-09-29): a lista de mensagens tem 2 formas de estado vazio em uso real
// no código — `{ data: [], pagination: {...} }` (contrato documentado em AGENTS.md §3.4, PR #457/
// #500) e `{ items: [], total: 0 }` (atalho legado usado em cenários "sem mensagens", ex.:
// `5.atendimentosMocks.js` ctx de atendimento finalizado/descartado). Schema aceita as duas para
// não gerar falso-positivo — só reprova quando nenhuma das duas chaves existe.
const attendanceMessagesSchema = z.union([
  z.object({ data: z.array(z.unknown()) }).passthrough(),
  z.object({ items: z.array(z.unknown()) }).passthrough()
]);

// Ficha "W" (ClientDetailPage/NewClientModalHost, 7.clientes) — AGENTS.md §3.4: só `id` e
// `capabilities` são obrigatórias; sem `capabilities` o front derruba com "Resposta do serviço
// inválida" mesmo em 201/200 (achado 2026-09-28).
const clientFichaWSchema = z.object({
  id: z.number(),
  capabilities: z.record(z.string(), z.unknown())
}).passthrough();

// Drawer "Dados do cliente" (EditClientDrawerContent, 5.atendimentos) — AGENTS.md §3.4: `notes`
// objeto (não string), `gender`, `audit`, mesma rota do schema acima, consumidor distinto.
const clientDrawerSchema = z.object({
  notes: z.object({
    client: z.unknown(),
    weighing: z.unknown(),
    attendance: z.unknown()
  }).passthrough(),
  gender: z.unknown(),
  audit: z.record(z.string(), z.unknown())
}).passthrough();

// Listagem paginada de clientes (7.clientes) — AGENTS.md §3.4: `pagination` exige campos
// snake_case crus; mockar com hasNext/totalPages etc. quebra silenciosamente (sem exceção visível).
// `total`/`total_pages` saíram do contrato real (Issue backend#586/#588, front#510, 2026-10-06 —
// a listagem trocou pra rolagem infinita via `has_next`/`has_previous`); opcionais aqui só por
// tolerância a payload antigo, nunca exigidos de novo.
const clientsListSchema = z.object({
  items: z.array(z.unknown()),
  pagination: z.object({
    page: z.number(),
    per_page: z.number(),
    total: z.number().optional(),
    total_pages: z.number().optional(),
    has_next: z.boolean(),
    has_previous: z.boolean()
  })
}).passthrough();

// Detalhe do atendimento (interceptAttendanceDetailApi, 5.atendimentos) — bypassa
// BaseMock.interceptRoute (monta a resposta dinamicamente por regex de ID), por isso é chamado
// manualmente em vez de resolvido via ALIAS_SCHEMAS. Escopo mínimo e evidenciado: `attendance.id`/
// `attendance.status` numéricos — os demais campos do envelope variam legitimamente entre cenários
// (attendant null em atendimento órfão, summaries omitido em cenários degradados) e não são
// validados aqui para não gerar falso-positivo.
const attendanceDetailSchema = z.object({
  attendance: z.object({
    id: z.number(),
    status: z.number()
  }).passthrough()
}).passthrough();

// Chave: '<NomeDaClasseDeMock>.<alias>' (desambiguação) com fallback para '<alias>' puro.
const SCHEMA_REGISTRY = {
  // 'CentralMocks.getAttendancesList' fica de fora de propósito: com status='*' (disparado em todo
  // login mockado via cy.login → setupMocksSeNecessario) o defaultBody é sempre `null` (placeholder
  // de sessão, nunca a fila real) — validar quebraria 100% dos testes mockados. Só a lista real da
  // fila (AtendimentosMocks) é validada.
  'AtendimentosMocks.getAttendancesList': filaSchema,
  'AtendimentosMocks.getAttendanceMessages': attendanceMessagesSchema,
  'AtendimentosMocks.getAttendanceDetail': attendanceDetailSchema,
  'AtendimentosMocks.getAttendanceItemCapabilities': capabilitiesEnvelopeSchema,
  'AtendimentosMocks.getAttendanceCapabilities': capabilitiesEnvelopeSchema,
  'AtendimentosMocks.getClientCapabilities': capabilitiesEnvelopeSchema,
  'AtendimentosMocks.getClientDetail': clientDrawerSchema,
  'ClientesMocks.getClientCapabilities': capabilitiesEnvelopeSchema,
  'ClientesMocks.getClientDetail': clientFichaWSchema,
  'ClientesMocks.getClientsList': clientsListSchema,
  'CentralMocks.getAttendanceCapabilities': capabilitiesEnvelopeSchema,
  // Receitas (P2-16, onda 1): o MESMO DTO com que o front lê a resposta (zodResponseParser em infra/*.endpoints.ts), copiado do front em
  // ./schemas/receitasDto.js. Contrato inteiro, não só as armadilhas: um mock fora dele faz a tela de Receitas cair no erro genérico.
  // As capabilities ficam de fora: o front as normaliza (aceita envelope ou objeto cru, coerce para boolean) e nada é obrigatório.
  'ReceitasMocks.createPrescriptionApi': ReceitasDto.PrescriptionDtoSchema,
  'ReceitasMocks.getPrescriptionDetailApi': ReceitasDto.PrescriptionDtoSchema,
  'ReceitasMocks.createFormulaApi': ReceitasDto.FormulaCalcDtoSchema,
  'ReceitasMocks.updateFormulaApi': ReceitasDto.FormulaCalcDtoSchema,
  'ReceitasMocks.addProductFormulaApi': ReceitasDto.FormulaProductMutationDtoSchema,
  'ReceitasMocks.calculateFormulaApi': ReceitasDto.CalculateSuccessDtoSchema,
  'ReceitasMocks.getManipulationProcessesApi': ReceitasDto.ManipulationProcessListDtoSchema,
  'ReceitasMocks.createManipulationProcessApi': ReceitasDto.RegisterManipulationProcessDtoSchema,
  'ReceitasMocks.updateManipulationProcessApi': ReceitasDto.ManipulationProcessItemDtoSchema,
  'ReceitasMocks.getLaboratoriesApi': ReceitasDto.LaboratoryListDtoSchema,
  'ReceitasMocks.getPrescriptionsSearchApi': ReceitasDto.PrescriptionListingDtoSchema
};

/**
 * Resolve o schema aplicável a um alias de intercept, priorizando o par ClasseDeMock.alias
 * (desambigua rotas com o mesmo alias e schemas diferentes por consumidor) e caindo para o alias
 * puro quando só há um schema cadastrado.
 * @param {string} className `this.constructor.name` do Mock que chamou o intercept
 * @param {string} alias Alias do intercept (mesmo nome passado a `.as()`)
 * @returns {import('zod').ZodTypeAny | null}
 */
export function resolverSchema(className, alias) {
  return SCHEMA_REGISTRY[`${className}.${alias}`] || SCHEMA_REGISTRY[alias] || null;
}

/**
 * Valida um payload de mock contra o schema resolvido para `className.alias`. Sem schema
 * cadastrado, é um no-op (cobertura é opt-in, crescendo rota a rota — não é um gate obrigatório
 * sobre todo intercept existente). Falha lança Error síncrono (interrompe o teste no ponto da
 * montagem do intercept, antes de qualquer `cy.wait`/asserção de UI confusa a jusante).
 * @param {string} className
 * @param {string} alias
 * @param {unknown} payload
 */
export function validarSchemaMock(className, alias, payload) {
  const schema = resolverSchema(className, alias);
  if (!schema) return;

  const resultado = schema.safeParse(payload);
  if (!resultado.success) {
    const detalhes = resultado.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(raiz)'}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `[R-SCHEMA] Payload de mock inválido em ${className}.${alias}:\n${detalhes}\n` +
      `Payload recebido: ${JSON.stringify(payload)?.slice(0, 500)}`
    );
  }
}
