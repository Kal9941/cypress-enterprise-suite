# Épico cypress#004 — Cypress em AWS Lambda (sob demanda, ambiente dev)

> Registrado em 2026-10-07. Conteúdo colado integralmente pelo operador a partir do issue tracker (issue 004 do Cypress). Esta epic ainda não tem as 8 sub-issues detalhadas neste repo — ver "Tasks" abaixo.

## Objetivo

Rodar a suíte Cypress deste repo numa AWS Lambda, contra o ambiente dev (`app.omnicare.dev.local` / `api.omnicare.dev.local`), sob demanda. O dev dispara manualmente antes de abrir a PR `developer` → `main` do backend ou do front. O `developer` está sempre deployado no dev com a última PR, então o teste valida esse estado.

O resultado é **informativo**: não bloqueia merge.

## Regra de branches

- Esta epic tem a branch própria `epic/cypress-lambda`, criada a partir da `main`.
- Toda sub-issue sai de `epic/cypress-lambda` (ex.: `feat/<n>-spike-imagem`) e abre PR **para `epic/cypress-lambda`**, nunca direto para a `main`.
- A epic fecha com uma PR única de `epic/cypress-lambda` para a `main`.

## Decisões

| Tema | Decisão |
|---|---|
| Alvo | Ambiente dev (branch `developer` deployada). Sem preview por branch. |
| Disparo | Manual pelo dev: `npm run test:remote [-- --spec <arquivo>]`, que encapsula `aws lambda invoke` com a credencial AWS do próprio dev. |
| Invocação | Síncrona (`RequestResponse`), com `--cli-read-timeout 0` (o padrão da CLI é 60 s). |
| Escopo | Sem `specs` no payload: todas as specs de `cypress/e2e/*.cy.js`, **uma invocação por spec, em sequência**, com resumo consolidado no fim. Com `specs`, roda só as informadas. |
| Concorrência | `ReservedConcurrentExecutions: 1`. Uma segunda chamada simultânea recebe throttle. |
| Validação | O payload aceita apenas nomes de spec presentes na imagem. Qualquer outro valor retorna erro sem executar nada (evita path traversal e argumentos arbitrários no `cypress run`). |
| Runtime | Lambda com `PackageType: Image` (`cypress/included:15.20.0` + AWS Lambda runtime interface client), 10240 MB, timeout 900 s, sem VPC (dev é público), `sa-east-1`, conta dev. |
| Specs na imagem | Congeladas no build a partir da `main` deste repo. |
| Config / credenciais | SSM `/OmniCare/dev/app/cypress/{USER_CNPJ,USER_CODE,USER_PASSWORD}`, resolvido no deploy (`{{resolve:ssm:...}}`) e injetado como variável de ambiente, no padrão do `ph24-aws`. O entrypoint gera o `env.json` a partir dessas variáveis com `USE_MOCKS:false` e `AUTO_SYNC_MOCKS:false`. São credenciais de teste do dev. |
| Resultado | Retorno JSON (totais, testes que falharam, mensagem de erro de cada um) + mochawesome HTML e screenshots no S3 (lifecycle de 14 dias), com presigned URL no retorno. Stdout completo no CloudWatch Logs. Sem notificação em Discord ou Teams. |
| IaC | SAM neste repo (`template.yaml` + `samconfig.toml`), seguindo o `ph24-aws`, com `--resolve-image-repos` para o ECR. |
| CI | `.github/workflows/aws-dev-deploy.yml` em push na `main`, com deploy na conta dev via OIDC. Mesma estrutura do `ph24-aws` (build-and-package → deploy). |
| Infra prévia | Criada pelo time de infra (ver sub-issue correspondente). |
| Efeitos colaterais | Os testes criam dados reais no dev e podem disparar WhatsApp. Aceito: o dev é ambiente de apoio. |

## Fora de escopo

- Gate bloqueante em PR.
- Execução automática pós-deploy. O plano Fargate em `docs/plans/2026-09-23-cypress-smoke-pos-deploy.md` foi descartado e será apagado.
- Ambiente de prod.
- Paralelizar specs.

## Riscos

- Cypress + Chrome em Lambda (sem `/dev/shm`, `/tmp` limitado, cold start pesado). O spike valida isso antes do resto.
- `0.backend.cy.js` (166 testes) e `5.atendimentos.cy.js` (147 testes) podem passar de 15 min sozinhas. Nesse caso, dividir o arquivo depois de medir. (Nota de registro: desde então `5.atendimentos.cy.js` já foi dividido em `5-A.atendimentos-fila.cy.js` / `5-B.atendimentos-chat.cy.js` / `5-C.atendimentos-clientes.cy.js`, ver `ROADMAP.md` §3.)
- `cypress/support/commands.js:16` força mock sempre que `env.json` tem `USE_MOCKS:true`. Por isso o `env.json` é regenerado no entrypoint.

## Tasks

As sub-issues estão vinculadas a esta epic (8 historias) no issue tracker. Entregues com código neste repo: cypress#005-#009 (ver `lambda/README.md`, cada uma com validação passo a passo). Detalhadas abaixo conforme o operador traz o conteúdo — resta 1 sub-issue ainda não especificada.

### cypress#010 — Infra da conta AWS dev (time de infra, sem código neste repo)

Tarefa do **time de infra**, fora do escopo de código/teste deste repo — nada a implementar aqui. Pedido (conta dev, `sa-east-1`):

- [ ] Role OIDC `cypress-enterprise-suite-dev-githubactions.role` com trust em `repo:omnicare-org/cypress-enterprise-suite:ref:refs/heads/main`.
- [ ] Role CloudFormation `cypress-enterprise-suite-dev-cf.role` (permissões para Lambda, ECR, S3, IAM role da função, logs).
- [ ] Bucket de artefatos SAM `cypress-enterprise-suite-sa-east-1-<accountId>`.
- [ ] SSM String `/OmniCare/dev/app/cypress/USER_CNPJ`, `USER_CODE` e `USER_PASSWORD` (credenciais de teste do dev).
- [ ] Secrets `AWS_ACCOUNT_ID_DEV` e `AWS_REGION_DEV` neste repo.
- [ ] Permissão `lambda:InvokeFunction` para os devs que vão usar o `test:remote`.

Mesmo padrão já usado no `ph24-aws`. **Status:** aguardando execução pelo time de infra; nenhuma ação possível deste lado enquanto não existir. Desbloqueia, quando concluída: upload S3 ponta a ponta (cypress#006), `sam deploy`/execução real do workflow (cypress#007/#008) e throttle real (cypress#009) — ver `ROADMAP.md` §2.

### cypress#011 — Medir duração real das specs na Lambda e dividir as que passam de ~12 min

Branch sai de `epic/cypress-lambda` e abre PR de volta pra lá (trabalho **deste repo**, não do time de infra) — mas **depende do deploy real existir**, ou seja, está bloqueada pela cypress#010 (sem Lambda deployada, não há como medir nada com `test:remote`).

- **O quê:** rodar `npm run test:remote` completo, registrar a duração de cada spec e dividir (sem mudar a lógica dos testes) qualquer spec que passe de ~12 min (margem pro cold start + upload do relatório), garantindo que todas terminem dentro do timeout de 900s (`template.yaml`, cypress#007) da Lambda.
- **Candidatas citadas na issue:** `0.backend.cy.js` (179 testes, maior arquivo hoje) e `5.atendimentos.cy.js` — este último **já foi dividido em `5-A.atendimentos-fila.cy.js`/`5-B.atendimentos-chat.cy.js`/`5-C.atendimentos-clientes.cy.js` em 2026-10-05** (`ROADMAP.md` §3), mas por critério de tamanho de arquivo/organização de contexts (`AGENTS.md` `[R-DOC]`), não por medição real de tempo na Lambda — a issue foi escrita antes desse split; o critério de aceite desta sub-issue (medir e confirmar que cabem no timeout) ainda não foi verificado para nenhum dos 3 arquivos novos nem para `0.backend.cy.js`.
- **Status:** bloqueada pela cypress#010. Quando o deploy existir: rodar `test:remote` sem `--spec` (todas as specs, uma invocação cada, já implementado na cypress#009), tabular a duração de cada uma aqui ou em `lambda/README.md`, e só então decidir se `0.backend.cy.js` (e os 3 arquivos já divididos de atendimentos) precisam de mais split.

## Achado no registro (2026-10-07)

Já existe uma branch remota `origin/epic/cypress-lambda`, mas ela está **desatualizada em relação à `main` atual**: falta, entre outras mudanças, o split de `5.atendimentos.cy.js` em `5-A`/`5-B`/`5-C` (2026-10-05) e diversas atualizações de `.agents/*`. Antes de usá-la como base das sub-issues, decidir com o operador se ela deve ser recriada a partir da `main` atual (operação destrutiva sobre uma branch remota — não executada sem confirmação explícita) ou se o conteúdo divergente nela é intencional e deve ser investigado primeiro.
