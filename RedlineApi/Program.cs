using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Redline.Data;
using Redline.Domain.Entities;
using Redline.Endpoints;
using Redline.Serialization;
using Redline.Services;

var builder = WebApplication.CreateBuilder(args);

// --- Serviços ---
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// EF Core / PostgreSQL (Supabase)
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

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

// CORS — libera o frontend em dev. O app real roda em Vite (5173); 3000 incluído por segurança/SSR.
const string DevCors = "RedlineDev";
builder.Services.AddCors(options =>
{
    options.AddPolicy(DevCors, policy =>
        policy.WithOrigins("http://localhost:3000", "http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod());
});

var app = builder.Build();

// --- Pipeline ---
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    await SeedAsync(app); // popula a base com dados reais (GUIDs) para o teste ponta-a-ponta
}

app.UseHttpsRedirection();
app.UseCors(DevCors); // AllowAnyHeader já libera o header Authorization (RNF-05)

// Ordem obrigatória: autenticação -> autorização (§5.4).
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/", () => "API da Redline está online e conectada!");
app.MapVehicleEndpoints();
app.MapLeadEndpoints();
app.MapMeEndpoints();
app.MapDashboardEndpoints();

app.Run();


// ---------------------------------------------------------------------------
// SEED (dev): 1 loja + 3 vendedores + 6 veículos, todos com StoreId (RF-01).
// ---------------------------------------------------------------------------
static async Task SeedAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    // RNF-07: evolução por Migrations (fim do EnsureCreated). Aplica a migration em dev.
    await db.Database.MigrateAsync();

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
            Stage = BuildStage.Stage2, Tier = VehicleTier.A, Views = 3_120,
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
            Stage = BuildStage.Original, Tier = VehicleTier.A, Views = 2_410,
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
            Stage = BuildStage.Stage3, Tier = VehicleTier.B, Views = 5_890,
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
            Stage = BuildStage.Stage1, Tier = VehicleTier.A, Views = 4_020,
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
            Stage = BuildStage.Stage2, Tier = VehicleTier.C, Views = 1_980,
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
            Stage = BuildStage.Stage1, Tier = VehicleTier.B, Views = 2_650,
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
            .Select(v => new { v.Id, v.Title, v.Tier })
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
                Tier = v.Tier,
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
