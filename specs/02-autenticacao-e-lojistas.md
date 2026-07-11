# Spec 02 — Autenticação, Usuários e Lojistas

- **Fase:** 2
- **Status:** `Draft` → aguardando aprovação
- **Escopo:** Registro/login, identidade, papéis e perfil de lojista. Introduz **escrita autenticada**.
- **Depende de:** Spec 01 (contratos de serialização de enums/DTOs já travados).
- **Habilita:** Fases 3 (CRUD de Anúncios), 4 (Leads) e 5 (Roleta) — todas exigem rotas protegidas e a noção de "dono".

---

## 1. Objetivo

Dar identidade à plataforma. Hoje `CURRENT_USER` é um mock fixo em `store.tsx` e não há login. Esta fase entrega:

1. **Registro e login** com emissão de **JWT** (via Supabase Auth como Identity Provider).
2. **Papéis** (`Buyer`, `Seller`, `StoreManager`) refletidos no token e aplicados por autorização.
3. **Perfil público e privado do usuário/lojista**, incluindo o campo `LeadWeight` — a semente da **Roleta** (lacuna 🔵 do cross-check).
4. **Proteção das rotas de escrita** que as próximas fases vão adicionar (política `RequireSeller`).

O princípio: a Fase 1 provou o contrato de **leitura**; a Fase 2 estabelece o contrato de **identidade e escrita** que o resto do produto reutiliza.

### Fora de escopo
CRUD de anúncios (Fase 3), captura de leads (Fase 4), algoritmo da roleta (Fase 5), reset de senha por email e verificação 2FA (melhorias posteriores). Aqui apenas persistimos e expomos `LeadWeight`; **não** o consumimos ainda.

---

## 2. Decisões de Arquitetura

- **IdP: Supabase Auth.** O front autentica direto no Supabase (email/senha) e recebe um JWT assinado (HS256, segredo do projeto). A `RedlineApi` **valida** esse JWT (não emite) — evita reimplementar hashing/refresh. O `sub` do token é o `auth.users.id` do Supabase.
- **Ponte de identidade:** a tabela `Users` da RedlineApi passa a ter `AuthId` (Guid, = `sub` do Supabase, único). No primeiro login válido sem `User` correspondente, a API faz **provisionamento just-in-time** (cria o registro `Users` a partir das claims). Papel default: `Buyer`.
- **Autorização por política:** `RequireSeller` = `Seller` **ou** `StoreManager`. `RequireStoreManager` = só `StoreManager`.
- **Peso da roleta:** `LeadWeight` (int, default `1`) mora em `Users`. Alterável apenas por `StoreManager`. É o único preparo da Fase 5 feito agora, para não migrar schema de novo depois.

---

## 3. Contrato da API

Casing camelCase, enums como string (converter da Fase 1), datas ISO 8601 UTC. Todas as rotas de escrita exigem `Authorization: Bearer <jwt>`.

### 3.1 `POST /api/auth/sync`  *(autenticado)*

Provisionamento/atualização just-in-time. O front chama logo após o login no Supabase. Sem corpo — a identidade vem do token.

**Headers:** `Authorization: Bearer <jwt>`

**Response `200 OK`** (usuário existente) **ou `201 Created`** (recém-provisionado):

```json
{
  "id": "1a2b3c4d-0000-0000-0000-000000000001",
  "authId": "9c8b7a6d-1111-2222-3333-444455556666",
  "name": "João Mendes",
  "email": "joao@garagem.dev",
  "role": "Seller",
  "avatarUrl": "https://.../avatar.jpg",
  "memberSince": 2021,
  "leadWeight": 3
}
```

> `email` **é** exposto aqui (é o "eu" autenticado), ao contrário do `/api/sellers/{id}` público da Fase 1.

**Response `401 Unauthorized`:** token ausente/inválido/expirado (`ProblemDetails`).

### 3.2 `GET /api/me`  *(autenticado)*

Retorna o `UserResponse` do §3.1 para o usuário do token. `404` se ainda não sincronizado.

### 3.3 `PATCH /api/me`  *(autenticado)*

Atualiza o próprio perfil. Campos permitidos ao dono: `name`, `avatarUrl`.

**Request:**

```json
{ "name": "João M. Mendes", "avatarUrl": "https://.../novo.jpg" }
```

**Response `200 OK`:** `UserResponse` atualizado. **`400`** para payload inválido (nome vazio, URL malformada).

### 3.4 `PATCH /api/users/{id}/role`  *(RequireStoreManager)*

Promove/rebaixa um usuário e ajusta o peso da roleta. Base da governança de lojistas.

**Request:**

```json
{ "role": "Seller", "leadWeight": 3 }
```

**Response `200 OK`:** `UserResponse`. **`403`** se o chamador não for `StoreManager`. **`404`** se o `id` não existir. **`400`** se `leadWeight < 1` ou `role` inválido.

### 3.5 Formato de erro

`ProblemDetails` (RFC 7807), idêntico à Fase 1. `401` e `403` também retornam `ProblemDetails`.

---

## 4. Tarefas de Backend (.NET 10 / EF Core)

### 4.1 Modelo e migração
- [ ] Adicionar a `User`: `Guid AuthId` (índice único), `int LeadWeight` (default `1`). Manter `Email` já existente.
- [ ] Criar a **primeira migração real** (`dotnet ef migrations add AuthAndLeadWeight`) — a Fase 1 rodava em `EnsureCreated`; a partir daqui o schema evolui por migração. Trocar o seed para `Database.MigrateAsync()`.
- [ ] Backfill: no seed, atribuir `AuthId` fixos aos 3 vendedores e `LeadWeight` (João=3, Bianca=2, Diego=1) para testar a roleta na Fase 5.

### 4.2 Autenticação JWT (validação, não emissão)
- [ ] `AddAuthentication().AddJwtBearer(...)` no `Program.cs`, validando `Issuer`/`Audience` do projeto Supabase e o segredo HS256 (`Jwt:Secret` em config/secret manager — **não** commitar).
- [ ] `AddAuthorization` com políticas `RequireSeller` (`Seller`|`StoreManager`) e `RequireStoreManager`.
- [ ] `app.UseAuthentication(); app.UseAuthorization();` no pipeline, **antes** dos endpoints e depois do CORS.

### 4.3 DTOs (`Contracts/`)
- [ ] `UserResponse` (record) — §3.1, **com** `Email` e `LeadWeight`.
- [ ] `UpdateProfileRequest` (`Name`, `AvatarUrl`) e `UpdateRoleRequest` (`Role`, `LeadWeight`) com validação.

### 4.4 Endpoints (`Endpoints/AuthEndpoints.cs`, grupo `/api`)
- [ ] `POST /api/auth/sync` — lê claims (`sub`, `email`, `name`, `avatar_url`) do `HttpContext.User`; upsert em `Users`; `201` se criou, `200` se já existia.
- [ ] `GET /api/me` — projeta `UserResponse` do usuário do token; `404` se não sincronizado.
- [ ] `PATCH /api/me` — atualiza `Name`/`AvatarUrl` do dono; valida; `ExecuteUpdateAsync` ou entidade rastreada.
- [ ] `PATCH /api/users/{id}/role` — política `RequireStoreManager`; valida `leadWeight >= 1`.
- [ ] Helper `ClaimsPrincipal.GetAuthId()` (extension) para extrair o `sub` como `Guid`.

### 4.5 Segurança
- [ ] Nunca expor `AuthId`/`Email` de terceiros: `/api/sellers/{id}` (Fase 1) permanece sem email. `Email` só em `/api/me` e `/api/auth/sync` (o próprio) ou para `StoreManager`.
- [ ] Rejeitar tokens sem `email_verified` quando o Supabase exigir verificação (config).

---

## 5. Tarefas de Frontend (Vite + React / SWR)

> Nota de realidade: o app é **Vite + React Router**, não Next.js. Variáveis via `import.meta.env.VITE_*`; sem SSR. O `NEXT_PUBLIC_*` citado em specs antigas não se aplica.

- [ ] Adicionar `@supabase/supabase-js`. Criar `src/app/lib/supabase.ts` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- [ ] `src/app/lib/api.ts` (da Fase 1): injetar `Authorization: Bearer <token>` quando houver sessão — `fetcher` lê o token atual do Supabase antes de cada request.
- [ ] `src/app/auth/AuthProvider.tsx`: contexto com `session`, `user` (do `GET /api/me`), `signIn`, `signUp`, `signOut`; escuta `supabase.auth.onAuthStateChange` e dispara `POST /api/auth/sync` no login.
- [ ] Substituir o `CURRENT_USER` mockado em `store.tsx` pelo `user` real do `AuthProvider`. `ProfilePage` e `Header` passam a refletir o usuário autenticado (fallback de avatar já existe na Fase 1).
- [ ] Telas `LoginPage` / `RegisterPage` (email+senha) com estados de loading/erro; redirect pós-login.
- [ ] `useMe()` (SWR sobre `/api/me`), `useUpdateProfile()` (mutação + `mutate`). Guardas de rota: ações de escrita (Anunciar, favoritar server-side futuro) só para autenticados; botão "Anunciar Meu Projeto" da `HomePage` exige `Seller`/`StoreManager`.
- [ ] `.env.local`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (mantém `VITE_API_URL`).

---

## 6. Critérios de Aceite (Definition of Done)

**Autenticação / Backend**
- [ ] Request a rota protegida **sem** `Bearer` → `401` + `ProblemDetails`; com token expirado → `401`.
- [ ] `POST /api/auth/sync` cria o `User` no primeiro login (`201`, role `Buyer`) e retorna `200` nas chamadas seguintes, sem duplicar (`AuthId` único).
- [ ] `role` e `leadWeight` serializam corretamente (converter da Fase 1): `role: "StoreManager"` string, nunca inteiro.
- [ ] `PATCH /api/users/{id}/role` por um `Buyer`/`Seller` → `403`; por `StoreManager` → `200`. `leadWeight: 0` → `400`.
- [ ] `/api/me` expõe `email`; `/api/sellers/{id}` (Fase 1) **continua** sem `email` (não regrediu).
- [ ] Migração aplica limpo em base zerada e o seed roda via `MigrateAsync` (não mais `EnsureCreated`).

**Frontend**
- [ ] Fluxo login → o `Header`/`ProfilePage` mostram nome, avatar e papel reais (não mais `Rafael Torque` mockado).
- [ ] Logout limpa sessão e volta ao estado público; rotas de escrita ficam indisponíveis.
- [ ] Toda chamada autenticada envia `Authorization`; sem erro de CORS (preflight com `Authorization` liberado no policy da Fase 1 — validar `AllowAnyHeader`).
- [ ] Usuário `Buyer` não vê/consegue acionar o botão "Anunciar Meu Projeto".

**Qualidade / Verificação**
- [ ] Testes de integração (`WebApplicationFactory` + JWT de teste forjado): `sync` (201/200), `me` (200/404), `role` (200/403/400).
- [ ] Teste unitário de `GetAuthId()` e das políticas de autorização.
- [ ] Smoke ponta-a-ponta: registrar → logar → sync → editar perfil → ver mudança refletida na UI, sem erro de tipo no console.

---

## 7. Riscos e Notas

- **Validação do JWT do Supabase é o ponto crítico.** Segredo/algoritmo errados derrubam toda a escrita com `401`. Validar `Issuer`/`Audience`/`Secret` isoladamente (teste de integração) antes de proteger endpoints.
- **Provisionamento just-in-time e corrida:** dois requests simultâneos no primeiro login podem tentar criar dois `Users`. Proteger com índice único em `AuthId` + tratamento de `DbUpdateException` (idempotente).
- **`LeadWeight` agora, roleta depois:** persistimos o peso sem consumi-lo. Evita nova migração na Fase 5, mas exige disciplina para não vazar `LeadWeight` em endpoints públicos.
- **Segredos:** `Jwt:Secret` e chaves do Supabase via *user-secrets*/variáveis de ambiente — nunca no `appsettings.json` versionado.
- Decisão pendente: refresh token e sessão persistida no front (Supabase gerencia por padrão) — confirmar política de expiração antes de produção.
