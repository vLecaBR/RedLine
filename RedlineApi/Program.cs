using System.Diagnostics;
using System.Text.Json;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.IdentityModel.Tokens;
using Redline.Data;
using Redline.Domain.Entities;
using Redline.Endpoints;
using Redline.Observability;
using Redline.Serialization;
using Redline.Services;

var builder = WebApplication.CreateBuilder(args);

// --- Serviços ---
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Handler global de erros em ProblemDetails (Fase 7 / RF-01). Enriquecemos com traceId e, em
// Production, trocamos o detalhe por uma mensagem genérica — nunca vaza stack trace (RNF-02).
var isDevelopment = builder.Environment.IsDevelopment();
builder.Services.AddProblemDetails(options =>
{
    options.CustomizeProblemDetails = ctx =>
    {
        ctx.ProblemDetails.Instance ??= ctx.HttpContext.Request.Path;
        ctx.ProblemDetails.Extensions["traceId"] =
            Activity.Current?.TraceId.ToString() ?? ctx.HttpContext.TraceIdentifier;

        var status = ctx.ProblemDetails.Status ?? ctx.HttpContext.Response.StatusCode;
        if (status >= StatusCodes.Status500InternalServerError)
        {
            ctx.ProblemDetails.Title = "Internal Server Error";
            var error = ctx.HttpContext.Features.Get<IExceptionHandlerFeature>()?.Error;

            // Em Development, expõe o detalhe da exceção para depuração; em Production, genérico.
            ctx.ProblemDetails.Detail = isDevelopment && error is not null
                ? error.ToString()
                : "Ocorreu um erro inesperado.";
        }
    };
});

// EF Core / PostgreSQL (Supabase). A connection string é SEGREDO: vem de user-secrets (dev) /
// variável de ambiente (prod), nunca do appsettings.json versionado (Fase 7 / RF-06, runbook §2).
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "ConnectionStrings:DefaultConnection ausente. Configure via user-secrets em dev " +
        "(dotnet user-secrets set \"ConnectionStrings:DefaultConnection\" \"...\") " +
        "ou variável de ambiente em produção. Ver RUNBOOK_PRODUCAO.md §2.");
}

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));

// Health checks (Fase 7 / RF-04): liveness ('/health', sem tocar dependências) e readiness
// ('/health/ready', tag "ready" — verifica o banco). Anônimos e fora do CORS restrito.
builder.Services.AddHealthChecks()
    .AddCheck<DatabaseHealthCheck>("database", tags: ["ready"]);

// Rate limiting (Fase 7 / RF-03): limite por IP aplicado SÓ ao POST /api/leads (único endpoint
// anônimo de escrita). Excedido -> 429 ProblemDetails + Retry-After. Limite configurável.
var leadsPerMinute = builder.Configuration.GetValue<int?>("RateLimit:LeadsPerMinute") ?? 5;
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy("leads", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: ClientIp(httpContext),
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = leadsPerMinute,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst
            }));

    // 429 padronizado como ProblemDetails, consistente com o restante da API (RNF-08).
    options.OnRejected = async (context, ct) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        context.HttpContext.Response.ContentType = "application/problem+json";

        var retryAfterSeconds = 60;
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {
            retryAfterSeconds = (int)Math.Ceiling(retryAfter.TotalSeconds);
            context.HttpContext.Response.Headers.RetryAfter = retryAfterSeconds.ToString();
        }

        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            type = "https://tools.ietf.org/html/rfc6585#section-4",
            title = "Too Many Requests",
            status = StatusCodes.Status429TooManyRequests,
            detail = "Muitas solicitações. Tente novamente em instantes."
        }, ct);
    };
});

// Chave de partição do rate-limit por IP. Atrás de proxy/CDN, honra X-Forwarded-For
// (requer ForwardedHeaders no ambiente — ver runbook); senão, cai no IP da conexão.
static string ClientIp(HttpContext ctx)
{
    var forwarded = ctx.Request.Headers["X-Forwarded-For"].FirstOrDefault();
    if (!string.IsNullOrWhiteSpace(forwarded))
        return forwarded.Split(',')[0].Trim();
    return ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";
}

// Distribuição de leads (round-robin por loja, §3.4 / RNF-06). Scoped: usa o AppDbContext.
builder.Services.AddScoped<ILeadDistributionService, RoundRobinLeadDistributionService>();

// Agregação de KPIs do Dashboard (Fase 4 / RNF-09). Scoped: usa o AppDbContext.
builder.Services.AddScoped<IDashboardService, DashboardService>();

// --- Autenticação (Fase 3): valida o JWT do Supabase via JWKS/OIDC (RF-01/RNF-03). ---
// Segredos NÃO ficam aqui: Authority/Audience são metadados públicos do projeto Supabase.
var supabaseAuthority = builder.Configuration["Supabase:Authority"]
    ?? throw new InvalidOperationException("Config 'Supabase:Authority' ausente (ex.: https://<ref>.supabase.co/auth/v1).");
var supabaseAudience = builder.Configuration["Supabase:Audience"] ?? "authenticated";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // Descobre issuer + chaves de assinatura pela metadata OIDC/JWKS (rotação sem redeploy — RNF-03).
        options.Authority = supabaseAuthority;
        options.Audience = supabaseAudience;
        options.RequireHttpsMetadata = true;

        // Mantém as claims "cruas" do Supabase (sub/email) sem o mapeamento legado do .NET.
        options.MapInboundClaims = false;

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = supabaseAuthority,
            ValidateAudience = true,
            ValidAudience = supabaseAudience,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ClockSkew = TimeSpan.FromSeconds(60) // tolerância de relógio (RNF-04)
        };

        // 401 padronizado como ProblemDetails (RFC 7807), consistente com o front (RNF-01).
        options.Events = new JwtBearerEvents
        {
            OnChallenge = async context =>
            {
                context.HandleResponse();
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                context.Response.ContentType = "application/problem+json";
                await context.Response.WriteAsJsonAsync(new
                {
                    type = "https://tools.ietf.org/html/rfc7235#section-3.1",
                    title = "Unauthorized",
                    status = 401,
                    detail = "Token ausente, expirado ou inválido."
                });
            }
        };
    });

// --- Autorização (Fase 3): políticas nomeadas por papel derivado do User local (§5.3). ---
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("StoreStaff", p =>
        p.RequireAuthenticatedUser()
         .RequireRole(nameof(UserRole.Seller), nameof(UserRole.StoreManager)));

    options.AddPolicy("StoreManagerOnly", p =>
        p.RequireAuthenticatedUser()
         .RequireRole(nameof(UserRole.StoreManager)));
});

// Resolução/provisionamento do usuário local (RF-02/RF-03). Scoped: cacheia por request.
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
// Deriva a claim de papel a partir do User local para alimentar as políticas acima.
builder.Services.AddScoped<IClaimsTransformation, RoleClaimsTransformation>();

// Serialização JSON do Minimal API:
//  - enums como STRING (não inteiro)  -> bloqueador #1
//  - honra [Display(Name=...)]         -> bloqueador #2  ("Stage 1", "Automático", ...)
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new DisplayNameEnumConverterFactory());
});

// CORS — origens por ambiente (Fase 7 / RNF-04). Em prod, restringir via Cors:AllowedOrigins
// (sem localhost — runbook §4). Em dev, sem config, cai no Vite (5173) + 3000 (SSR).
const string CorsPolicy = "Redline";
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();
if (allowedOrigins is null || allowedOrigins.Length == 0)
{
    allowedOrigins = isDevelopment
        ? ["http://localhost:3000", "http://localhost:5173"]
        : [];
}

builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicy, policy =>
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod());
});

var app = builder.Build();

// --- Bootstrap do banco (Fase 7 / RF-05) ---
// MigrateAsync roda em QUALQUER ambiente (idempotente — RNF-03). O seed de dados de exemplo
// só roda em Development; produção sobe com o schema aplicado e SEM dados semeados.
await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
}

// --- Pipeline ---
// Handler global: precisa ser o mais externo para capturar exceções de todo o pipeline (RF-01).
app.UseExceptionHandler();
app.UseStatusCodePages(); // 404/405 sem corpo também saem como ProblemDetails.

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    await SeedAsync(app); // popula a base com dados reais (GUIDs) para o teste ponta-a-ponta
}

app.UseHttpsRedirection();

// Logging estruturado por request (escopo com TraceId — RF-09), antes do roteamento de negócio.
app.UseMiddleware<RequestLoggingMiddleware>();

app.UseCors(CorsPolicy); // AllowAnyHeader já libera o header Authorization (RNF-05)
app.UseRateLimiter();

// Ordem obrigatória: autenticação -> autorização (§5.4).
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/", () => "API da Redline está online e conectada!");

// Health checks anônimos (RF-04). '/health' = liveness (nenhum check); '/health/ready' = readiness.
app.MapHealthChecks("/health", new HealthCheckOptions
{
    Predicate = _ => false, // liveness: só confirma que o processo responde
    ResponseWriter = WriteHealthResponse
}).AllowAnonymous();

app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready"), // readiness: verifica o banco
    ResponseWriter = WriteHealthResponse
}).AllowAnonymous();

app.MapVehicleEndpoints();
app.MapLeadEndpoints();
app.MapMeEndpoints();
app.MapDashboardEndpoints();
app.MapFavoriteEndpoints();

app.Run();

// Corpo mínimo dos health checks: { "status": "Healthy" | "Unhealthy" } (§4.1/§4.2). Sem detalhes internos.
static Task WriteHealthResponse(HttpContext context, Microsoft.Extensions.Diagnostics.HealthChecks.HealthReport report)
{
    context.Response.ContentType = "application/json";
    return context.Response.WriteAsync(
        JsonSerializer.Serialize(new { status = report.Status.ToString() }));
}


// ---------------------------------------------------------------------------
// SEED (dev): 1 loja + 3 vendedores + 6 veículos, todos com StoreId (RF-01).
// ---------------------------------------------------------------------------
static async Task SeedAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    // As migrations já foram aplicadas no bootstrap (RF-05); aqui só semeamos dados de exemplo (dev).
    if (await db.Vehicles.AnyAsync()) return; // idempotente

    // Loja padrão (RF-01)
    var storeId = new Guid("5100e000-0000-0000-0000-000000000001");
    db.Stores.Add(new Store
    {
        Id = storeId,
        Name = "Garagem Redline",
        Slug = "garagem-redline",
        City = "São Paulo",
        CreatedAt = new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc),
        UpdatedAt = new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc)
    });

    var joao   = new Guid("1a2b3c4d-0000-0000-0000-000000000001");
    var bianca = new Guid("1a2b3c4d-0000-0000-0000-000000000002");
    var diego  = new Guid("1a2b3c4d-0000-0000-0000-000000000003");

    db.Users.AddRange(
        new User { Id = joao,   Name = "João Mendes",     Email = "joao@garagem.dev",   Role = UserRole.Seller, MemberSince = 2021, StoreId = storeId,
                   AvatarUrl = "https://images.unsplash.com/photo-1595558848762-e5ab72171957?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200" },
        new User { Id = bianca, Name = "Bianca Rocha",     Email = "bianca@garagem.dev", Role = UserRole.Seller, MemberSince = 2022, StoreId = storeId,
                   AvatarUrl = "https://images.unsplash.com/photo-1610374634235-b51ef357f905?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200" },
        new User { Id = diego,  Name = "Diego Nakamura",   Email = "diego@garagem.dev",  Role = UserRole.Seller, MemberSince = 2020, StoreId = storeId,
                   AvatarUrl = "https://images.unsplash.com/photo-1623346483743-b968a27ed34c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200" });

    const string img1 = "https://images.unsplash.com/photo-1555532686-d0fccaccadcf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";
    const string bay  = "https://images.unsplash.com/photo-1654616111851-5394318e3279?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";
    const string bay2 = "https://images.unsplash.com/photo-1752774581629-464238ee6996?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";

    db.Vehicles.AddRange(
        new Vehicle
        {
            Title = "McLaren P1 Track Edition", Brand = "McLaren", Model = "P1", Year = 2021,
            Price = 4_890_000m, Mileage = 8_200, Transmission = TransmissionType.DCT,
            Stage = BuildStage.Stage2, Views = 3_120,
            Images = new() { img1, bay }, SellerId = joao, StoreId = storeId, Location = "São Paulo, SP",
            CreatedAt = new DateTime(2026, 6, 28, 0, 0, 0, DateTimeKind.Utc),
            CustomSpecs = new CustomSpecs {
                Engine = new() { "Remap ECU dedicada", "Downpipe Akrapovic titânio", "Intercooler frontal" },
                Suspension = new() { "KW Clubsport coilover", "Barras estabilizadoras Whiteline" },
                Interior = new() { "Bancos Recaro carbono", "Volante Alcantara custom" },
                HasDyno = true, ClaimedHp = 980 }
        },
        new Vehicle
        {
            Title = "Ferrari 488 Rosso Corsa", Brand = "Ferrari", Model = "488", Year = 2020,
            Price = 3_250_000m, Mileage = 14_500, Transmission = TransmissionType.DCT,
            Stage = BuildStage.Original, Views = 2_410,
            Images = new() { "https://images.unsplash.com/photo-1596639410348-8470f7fa9f84?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" },
            SellerId = bianca, StoreId = storeId, Location = "Rio de Janeiro, RJ",
            CreatedAt = new DateTime(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc),
            CustomSpecs = new CustomSpecs {
                Engine = new() { "Motor de fábrica lacrado" },
                Suspension = new() { "Suspensão original com lift kit" },
                Interior = new() { "Couro Nero completo" }, HasDyno = false }
        },
        new Vehicle
        {
            Title = "Nissan GT-R Street Build", Brand = "Nissan", Model = "GT-R R35", Year = 2018,
            Price = 890_000m, Mileage = 42_000, Transmission = TransmissionType.DCT,
            Stage = BuildStage.Stage3, Views = 5_890,
            Images = new() { "https://images.unsplash.com/photo-1533106418989-88406c7cc8ca?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080", bay2 },
            SellerId = diego, StoreId = storeId, Location = "Curitiba, PR",
            CreatedAt = new DateTime(2026, 7, 4, 0, 0, 0, DateTimeKind.Utc),
            CustomSpecs = new CustomSpecs {
                Engine = new() { "Turbos híbridos Garrett", "Bicos 1300cc", "Coletor de admissão custom", "Flex fuel E85" },
                Suspension = new() { "KW V3", "Bushings poliuretano" },
                Interior = new() { "Roll cage bolt-in", "Painel digital AEM" },
                HasDyno = true, ClaimedHp = 1_150 }
        },
        new Vehicle
        {
            Title = "Lamborghini Aventador SV", Brand = "Lamborghini", Model = "Aventador", Year = 2019,
            Price = 5_600_000m, Mileage = 9_800, Transmission = TransmissionType.Sequencial,
            Stage = BuildStage.Stage1, Views = 4_020,
            Images = new() { "https://images.unsplash.com/photo-1595558883521-062b300985e5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" },
            SellerId = joao, StoreId = storeId, Location = "São Paulo, SP",
            CreatedAt = new DateTime(2026, 6, 20, 0, 0, 0, DateTimeKind.Utc),
            CustomSpecs = new CustomSpecs {
                Engine = new() { "Escapamento Capristo válvulas", "Filtros de ar esportivos" },
                Suspension = new() { "Lift system hidráulico" },
                Interior = new() { "Alcantara teto", "Carbon fiber trim" },
                HasDyno = false, ClaimedHp = 770 }
        },
        new Vehicle
        {
            Title = "Honda Civic Type R Turbo", Brand = "Honda", Model = "Civic Type R", Year = 2022,
            Price = 385_000m, Mileage = 21_000, Transmission = TransmissionType.Manual,
            Stage = BuildStage.Stage2, Views = 1_980,
            Images = new() { "https://images.unsplash.com/photo-1674133461006-5db277b238e3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080", bay2 },
            SellerId = bianca, StoreId = storeId, Location = "Belo Horizonte, MG",
            CreatedAt = new DateTime(2026, 7, 6, 0, 0, 0, DateTimeKind.Utc),
            CustomSpecs = new CustomSpecs {
                Engine = new() { "Downpipe Invidia", "Remap Hondata", "Intake Eventuri carbono" },
                Suspension = new() { "Molas Eibach Pro-Kit", "Camber kit dianteiro" },
                Interior = new() { "Volante Momo", "Pedaleira alumínio" },
                HasDyno = true, ClaimedHp = 380 }
        },
        new Vehicle
        {
            Title = "BMW M4 Competition Night", Brand = "BMW", Model = "M4", Year = 2023,
            Price = 720_000m, Mileage = 12_300, Transmission = TransmissionType.DCT,
            Stage = BuildStage.Stage1, Views = 2_650,
            IsActive = false, // Fase 5 (§8): 1 veículo arquivado no seed para exercitar a aba Estoque e o filtro da vitrine.
            Images = new() { "https://images.unsplash.com/photo-1610374634235-b51ef357f905?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" },
            SellerId = diego, StoreId = storeId, Location = "Porto Alegre, RS",
            CreatedAt = new DateTime(2026, 7, 8, 0, 0, 0, DateTimeKind.Utc),
            CustomSpecs = new CustomSpecs {
                Engine = new() { "Stage 1 bootmod3", "Charge pipes upgrade" },
                Suspension = new() { "KW DDC eletrônico" },
                Interior = new() { "Bancos M Carbon", "Volante M Performance" },
                HasDyno = true, ClaimedHp = 610 }
        });

    await db.SaveChangesAsync();

    // Leads de exemplo na "Garagem Redline" (RF/§8) para popular o Dashboard da Fase 4.
    // Idempotente (roda no mesmo bloco guardado por Vehicles.Any()). CreatedAt na janela de 30d
    // (relativo a UtcNow) para alimentar os KPIs. Sem isso o painel abre vazio até o 1º POST /leads.
    if (!await db.Leads.AnyAsync())
    {
        var seeded = await db.Vehicles.AsNoTracking()
            .Where(v => v.StoreId == storeId)
            .Select(v => new { v.Id, v.Title })
            .ToListAsync();

        var byTitle = seeded.ToDictionary(v => v.Title, v => v);
        var now = DateTime.UtcNow;

        (string title, Guid seller, string customer, string message, LeadStatus status, int daysAgo)[] rows =
        {
            ("Honda Civic Type R Turbo", joao,   "Marcos Vinícius", "Aceita troca por hatch? Tem laudo do dyno?", LeadStatus.EmAtendimento, 5),
            ("Nissan GT-R Street Build", bianca, "Amanda Prado",    "Qual a procedência do motor? Documentação em dia?", LeadStatus.Novo, 5),
            ("McLaren P1 Track Edition", diego,  "Eduardo Salles",  "Interesse real. Posso agendar test drive?", LeadStatus.Convertido, 6),
            ("BMW M4 Competition Night", joao,   "Letícia Fontes",  "Financiamento em até 48x?", LeadStatus.Novo, 6),
        };

        foreach (var r in rows)
        {
            if (!byTitle.TryGetValue(r.title, out var v)) continue;
            var created = now.AddDays(-r.daysAgo);
            db.Leads.Add(new Lead
            {
                VehicleId = v.Id,
                StoreId = storeId,
                CustomerName = r.customer,
                Message = r.message,
                AssignedSellerId = r.seller,
                Status = r.status,
                CreatedAt = created,
                UpdatedAt = created
            });
        }

        await db.SaveChangesAsync();
    }
}
