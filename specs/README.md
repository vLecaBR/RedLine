# Redline — Especificações Técnicas (Spec-Driven Development)

> Fonte única de verdade para os contratos entre `RedLine_FrontEnd` (Next.js/TS) e `RedlineApi` (.NET 10 Minimal API + EF Core/PostgreSQL).
> Nenhum endpoint ou componente entra em `main` sem uma spec correspondente aprovada aqui.

## Como usar esta pasta

Cada fase vira um arquivo `NN-nome-da-fase.md`. Toda spec contém: objetivo, contrato de API (Request/Response JSON), tarefas de Backend, tarefas de Frontend e Critérios de Aceite (DoD). A implementação segue a spec — se a realidade divergir, **atualiza-se a spec primeiro**, depois o código.

## Cross-check de Arquitetura (Frontend Types × C# Entities)

Análise feita em 10/07/2026 comparando `src/app/types.ts` com `Domain/Entities.cs`. As entidades estão bem modeladas, mas existem incompatibilidades de **contrato de serialização** que precisam ser resolvidas antes da Fase 1 — senão o frontend quebra na primeira chamada real.

### 🔴 Bloqueadores (resolver antes da Fase 1)

| # | Problema | Frontend espera | Backend entrega (default) | Ação |
|---|----------|-----------------|---------------------------|------|
| 1 | **Enums serializam como inteiro** | `"Stage 1"`, `"Automático"` | `2`, `1` (int) | Registrar `JsonStringEnumConverter` no `Program.cs`. Sem isso, todo campo enum chega como número. |
| 2 | **Nomes de enum ≠ valores do frontend** | `"Stage 1"`, `"Full Build"`, `"Automático"`, `"Em atendimento"` | `"Stage1"`, `"FullBuild"`, `"Automatico"`, `"EmAtendimento"` | `System.Text.Json` **ignora** `[Display(Name=...)]`. Precisa de um `JsonConverter` custom que leia o atributo `Display`, ou padronizar os literais do frontend. Recomendação: converter custom (mantém o frontend intacto). |
| 3 | **`Lead` tem campos denormalizados** | `vehicleTitle`, `assignedSellerName` | Só existem via navegação (`Vehicle.Title`, `AssignedSeller.Name`) | Nunca serializar a entidade direto. Projetar num **DTO** (`LeadResponse`) com `.Select()` no EF Core. |

### 🟡 Atenção (alinhar, mas não bloqueiam)

| # | Problema | Detalhe | Ação |
|---|----------|---------|------|
| 4 | **IDs: `string` × `Guid`** | Mocks usam `"v-01"`, `"s-01"` (não são GUIDs). O banco usa `Guid`. | `Guid` serializa como string, então o tipo TS `string` funciona. Mas o seed de dados reais precisa usar GUIDs — não reaproveitar os ids dos mocks. |
| 5 | **Formato de datas** | Frontend: `"2026-06-28"` e `"2026-07-10 09:12"` (não-ISO). Backend `DateTime` → ISO 8601 (`"2026-06-28T00:00:00Z"`). | Ajustar `lib/format.ts` para parsear ISO. Manter `createdAt: string` no TS. |
| 6 | **Nulabilidade divergente** | Frontend: `avatarUrl` e `customSpecs` obrigatórios. Backend: `AvatarUrl?` e `CustomSpecs?` nuláveis. | Frontend deve tolerar `null` (fallback de avatar / specs vazias) OU o backend garante default. Definido por spec. |
| 7 | **`KpiCard` não tem entidade** | É agregação, não tabela. | Endpoint calculado (`/api/dashboard/kpis`), sem tabela. Fase de Dashboard. |
| 8 | **`Lead.updatedAt` sem par no frontend** | Entidade tem `UpdatedAt`; tipo TS não. | Ignorar no response OU adicionar ao tipo. Sem impacto. |

### 🔵 Lacuna de modelagem para fase futura (Roleta de Leads)

O diferencial do produto — **round-robin com peso financeiro** — não tem suporte no schema atual. `User` não possui campo de peso/prioridade nem estado de rodízio. Antes da fase da Roleta será preciso: um campo de peso por vendedor (ex.: `LeadWeight` / plano contratado) e uma tabela ou coluna de controle de rodízio (último atribuído / contador). Detalhado na spec da fase respectiva.

---

## Roadmap de Entrega

### Fase 1 — Vitrine e Leitura de Veículos  ← *spec ativa*
Read-only público. Substituir os mocks `useCars`/`useCar` por API real. Estabelece e valida os contratos de serialização (resolve os bloqueadores 1–3). Menor risco, maior valor de validação de arquitetura.
→ `01-vitrine-de-veiculos.md`

### Fase 2 — Autenticação, Usuários e Lojistas
Registro/login (JWT + Supabase Auth), papéis (`Buyer`/`Seller`/`StoreManager`), perfil de lojista. Protege as rotas de escrita das fases seguintes.
→ `02-autenticacao-e-lojistas.md` *(a escrever)*

### Fase 3 — Gestão de Anúncios (CRUD de Veículos)
Lojista cria/edita/remove anúncios, incluindo a ficha técnica flexível (`CustomSpecs` em JSONB) e upload de imagens (Supabase Storage).
→ `03-gestao-de-anuncios.md` *(a escrever)*

### Fase 4 — Captura e Gestão de Leads
Comprador envia interesse a partir do veículo; lead persistido; painel de leads do lojista com status.
→ `04-gestao-de-leads.md` *(a escrever)*

### Fase 5 — Roleta de Leads (Round-robin com Peso Financeiro)
O diferencial. Roteamento automático do lead para o vendedor via algoritmo ponderado + disparo para WhatsApp. Depende da lacuna 🔵 acima.
→ `05-roleta-de-leads.md` *(a escrever)*

### Fase 6 — Dashboard e KPIs
Endpoints de agregação (`KpiCard`), métricas de conversão, visualizações.
→ `06-dashboard-kpis.md` *(a escrever)*

### Transversais (contínuas)
Testes (unit + integração), CORS, tratamento de erros padronizado (ProblemDetails), paginação e observabilidade.
