# Spec 01 — Vitrine e Leitura de Veículos

- **Fase:** 1
- **Status:** `Draft` → aguardando aprovação
- **Escopo:** Read-only, público (sem autenticação)
- **Depende de:** nenhuma spec anterior
- **Bloqueadores que esta fase resolve:** #1, #2, #3 do cross-check (serialização de enums e DTOs)

---

## 1. Objetivo

Substituir os mocks de leitura de veículos (`useCars`, `useCar` em `hooks.ts`) por chamadas reais à `RedlineApi`. A vitrine pública (`HomePage`) e a página de detalhe (`VehicleDetailPage`) passam a consumir dados do PostgreSQL.

Esta é deliberadamente a primeira fase porque é **read-only e de baixo risco**, e serve para **validar e travar os contratos de serialização** (enums como string, DTOs, JSONB, datas) que todas as fases seguintes vão reaproveitar. Se o contrato de `Vehicle` estiver correto, o resto do projeto flui.

### Fora de escopo
Autenticação, criação/edição de veículos, leads, roleta, dashboard. Apenas **GET** de veículos e do vendedor associado (para o card de detalhe).

---

## 2. Contrato da API

Casing: **camelCase** (default do ASP.NET Core com `System.Text.Json`, já compatível com o frontend). Enums: **string com o rótulo de exibição** (ver decisão em §4). Datas: **ISO 8601 UTC**.

### 2.1 `GET /api/vehicles`

Lista pública da vitrine, com filtro e paginação.

**Query params:**

| Param | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `filter` | string? | `"Todos"` | `"Todos"` \| `"Modificados"` (stage ≠ Original) \| `"Originais"` (stage = Original) \| nome de marca (ex.: `"McLaren"`) |
| `page` | int | `1` | Página (1-based) |
| `pageSize` | int | `20` | Itens por página (máx. 50) |

**Response `200 OK`:**

```json
{
  "items": [
    {
      "id": "8f2a1c9e-4b7d-4a1e-9c3f-2b6d5e8a1f00",
      "title": "McLaren P1 Track Edition",
      "brand": "McLaren",
      "model": "P1",
      "year": 2021,
      "price": 4890000,
      "mileage": 8200,
      "transmission": "DCT",
      "stage": "Stage 2",
      "tier": "A",
      "images": [
        "https://.../foto1.jpg",
        "https://.../foto2.jpg"
      ],
      "sellerId": "1a2b3c4d-0000-0000-0000-000000000001",
      "location": "São Paulo, SP",
      "createdAt": "2026-06-28T00:00:00Z",
      "views": 3120,
      "customSpecs": {
        "engine": ["Remap ECU dedicada", "Downpipe Akrapovic titânio"],
        "suspension": ["KW Clubsport coilover"],
        "interior": ["Bancos Recaro carbono"],
        "hasDyno": true,
        "claimedHp": 980
      }
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalItems": 6,
  "totalPages": 1
}
```

> Nota: `customSpecs` pode vir `null` no banco. O contrato garante um objeto vazio (`{ engine: [], suspension: [], interior: [], hasDyno: false }`) para o frontend nunca precisar checar null. `claimedHp` permanece opcional.

### 2.2 `GET /api/vehicles/{id}`

Detalhe de um veículo (usado por `VehicleDetailPage`).

**Response `200 OK`:** mesmo objeto `VehicleResponse` de §2.1.
**Response `404 Not Found`:** `ProblemDetails` padrão quando o `id` não existe ou não é um GUID válido.

Efeito colateral: incrementa `Views` em +1 por requisição (best-effort; ver DoD).

### 2.3 `GET /api/sellers/{id}`

Dados públicos do vendedor exibidos no card de detalhe.

**Response `200 OK`:**

```json
{
  "id": "1a2b3c4d-0000-0000-0000-000000000001",
  "name": "João Mendes",
  "role": "Seller",
  "avatarUrl": "https://.../avatar.jpg",
  "memberSince": 2021,
  "vehicleCount": 2
}
```

> `email` **não** é exposto neste endpoint público. `vehicleCount` substitui o mock `useSellerVehicleCount`.

### 2.4 Formato de erro (padrão para toda a API)

`ProblemDetails` (RFC 7807), já nativo no ASP.NET Core:

```json
{
  "type": "https://tools.ietf.org/html/rfc7231#section-6.5.4",
  "title": "Not Found",
  "status": 404,
  "detail": "Veículo com id '...' não encontrado."
}
```

---

## 3. Tarefas de Backend (.NET 10 / EF Core)

### 3.1 Configuração global (resolve bloqueadores #1 e #2)

No `Program.cs`, configurar a serialização JSON do Minimal API:

```csharp
builder.Services.ConfigureHttpJsonOptions(options =>
{
    // #1: enums como string, não inteiro
    // #2: converter custom que honra [Display(Name=...)] → "Stage 1", "Automático", etc.
    options.SerializerOptions.Converters.Add(new DisplayNameEnumConverterFactory());
});
```

- [ ] Implementar `DisplayNameEnumConverterFactory` (+ `DisplayNameEnumConverter<T>`) em `Serialization/`. Na serialização, lê o `[Display(Name)]` do membro do enum; se ausente, usa o nome do membro. Na desserialização, faz o mapa inverso (necessário para os query params/filtros futuros). **Critério: `BuildStage.Stage1` ⇄ `"Stage 1"`, `TransmissionType.Automatico` ⇄ `"Automático"`, `LeadStatus.EmAtendimento` ⇄ `"Em atendimento"`.**
- [ ] Adicionar CORS liberando a origem do Next.js (dev) — necessário para qualquer chamada do browser.

### 3.2 DTOs (resolve bloqueador #3 — nunca serializar entidade crua)

Criar em `Contracts/`:

- [ ] `VehicleResponse` (record) — espelha §2.1, com `CustomSpecsResponse`.
- [ ] `SellerResponse` (record) — §2.3, **sem** `Email`.
- [ ] `PagedResult<T>` (record) — `Items`, `Page`, `PageSize`, `TotalItems`, `TotalPages`.

### 3.3 Endpoints

Criar `Endpoints/VehicleEndpoints.cs` (grupo `/api`) e mapear no `Program.cs`.

- [ ] `GET /api/vehicles` — query com EF Core:
  - Base: `db.Vehicles.AsNoTracking()`.
  - Filtro: `Modificados` → `Stage != BuildStage.Original`; `Originais` → `Stage == Original`; marca → `Brand == filter`.
  - Paginação: `.Skip((page-1)*pageSize).Take(pageSize)` + `CountAsync()` para o total.
  - Projeção `.Select(v => new VehicleResponse(...))` — inclui coalescência de `CustomSpecs` para objeto vazio.
- [ ] `GET /api/vehicles/{id:guid}` — `FindAsync`/`FirstOrDefaultAsync`; `404` se null. Incrementar `Views` (ver 3.4).
- [ ] `GET /api/sellers/{id:guid}` — projetar `SellerResponse` com `VehicleCount = v.Vehicles.Count`.

### 3.4 Detalhes de query

- [ ] Incremento de `Views`: usar `ExecuteUpdateAsync` (EF Core 7+) para evitar round-trip de leitura+escrita: `db.Vehicles.Where(v => v.Id == id).ExecuteUpdateAsync(s => s.SetProperty(v => v.Views, v => v.Views + 1))`. Não bloquear a resposta se falhar.
- [ ] Validar o `OwnsOne(...).ToJson()` do `CustomSpecs` retorna o JSONB corretamente na projeção (teste manual no Swagger).

### 3.5 Seed (opcional, recomendado)

- [ ] Popular a base com os 6 veículos + 3 vendedores dos mocks, **usando GUIDs reais** (não `"v-01"`). Facilita o teste ponta-a-ponta do frontend.

---

## 4. Tarefas de Frontend (Next.js / SWR)

Decisão de contrato: **mantemos os tipos TS de `types.ts` intactos** (`"Stage 1"`, `"Automático"`). É o backend que se adapta via converter (§3.1). Isso evita mexer em toda a UI mockada.

- [ ] Adicionar `swr` às dependências.
- [ ] Criar `src/app/lib/api.ts`: `API_BASE` (via `NEXT_PUBLIC_API_URL`) + `fetcher` genérico que trata erro `ProblemDetails`.
- [ ] Reescrever `hooks.ts`:
  - [ ] `useCars(filter)` → `useSWR(\`/api/vehicles?filter=${filter}\`, fetcher)`. Retornar `{ cars: data?.items ?? [], loading: isLoading }`. **Remover a lógica de filtro client-side** (agora é server-side); manter a mesma assinatura de retorno para não quebrar `HomePage`.
  - [ ] `useCar(id)` → `useSWR(\`/api/vehicles/${id}\`)`. Passa a ser assíncrono (antes era síncrono sobre o mock) — ajustar `VehicleDetailPage` para tratar `loading`/`undefined`.
  - [ ] `useSeller(id)` → `useSWR(\`/api/sellers/${id}\`)`.
  - [ ] `useSellerVehicleCount` → **remover**; usar `seller.vehicleCount` do response de §2.3.
  - [ ] `useLeads`, `useKpis`, `useLeadDistribution` → **inalterados** (mocks, fases futuras).
- [ ] `src/app/lib/format.ts`: garantir parse de datas ISO 8601 (`new Date(iso)`), já que o backend não envia mais `"2026-07-10 09:12"`.
- [ ] `HomePage` e `VehicleDetailPage`: tratar estados de `loading` (usar o `Skeleton` já existente) e erro (veículo não encontrado → mensagem/redirect).
- [ ] `.env.local` com `NEXT_PUBLIC_API_URL` apontando para a `RedlineApi` local.

---

## 5. Critérios de Aceite (Definition of Done)

**Contrato / Backend**
- [ ] `GET /api/vehicles` no Swagger retorna `stage: "Stage 2"` (string), `transmission: "Automático"`, **nunca** inteiros.
- [ ] Um veículo `Full Build` serializa como `"Full Build"` e um `EmAtendimento` (validação do converter) como `"Em atendimento"`.
- [ ] Nenhuma entidade EF é serializada diretamente — todas as respostas passam por DTO. `Email` do vendedor não vaza no `/api/sellers/{id}`.
- [ ] `customSpecs` nunca vem `null` no response (vem objeto vazio).
- [ ] `GET /api/vehicles/{id}` com GUID inexistente → `404` + `ProblemDetails`; com id malformado → `404`/`400` (rota `:guid`).
- [ ] Filtros `Todos`/`Modificados`/`Originais`/`<marca>` retornam o conjunto correto; paginação respeita `page`/`pageSize` e devolve `totalPages` coerente.
- [ ] Abrir o detalhe incrementa `views` (verificável repetindo o GET).

**Frontend**
- [ ] `HomePage` renderiza os veículos vindos da API (mocks de veículo não são mais importados por `hooks.ts`).
- [ ] Trocar o `FilterPill` dispara nova query e a lista atualiza.
- [ ] `VehicleDetailPage` mostra skeleton durante o load, dados reais depois, e estado de "não encontrado" para id inválido.
- [ ] Card do vendedor mostra nome, avatar (com fallback se `null`) e contagem de anúncios reais.
- [ ] Sem erros de CORS no console.

**Qualidade / Verificação**
- [ ] Pelo menos 1 teste de integração no backend por endpoint (200 + 404) usando `WebApplicationFactory`.
- [ ] Teste unitário do `DisplayNameEnumConverter` cobrindo os 3 enums com rótulo composto (ida e volta).
- [ ] Smoke test manual ponta-a-ponta: subir API + front, navegar vitrine → detalhe → vendedor sem erro de tipo no console TS.

---

## 6. Riscos e Notas

- **Converter de enum é o ponto crítico da fase.** Se ele não honrar o `[Display]`, toda a UI mockada quebraria ou exigiria refactor. Priorizar e testar primeiro.
- **`ExecuteUpdateAsync` + `OwnsOne/ToJson`**: confirmar compatibilidade do provider Npgsql na versão em uso; se houver atrito, cair para incremento via entidade rastreada.
- **Paginação vs. UI atual**: a `HomePage` mockada provavelmente não tem paginação. Nesta fase o `pageSize` default (20) cobre os 6 veículos; a UI de paginação fica para depois sem alterar o contrato.
- Decisão pendente de confirmação: expor `UpdatedAt` do veículo no response? Atualmente omitido (o tipo TS não usa).
