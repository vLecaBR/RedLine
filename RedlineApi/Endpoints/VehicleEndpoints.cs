using System.ComponentModel.DataAnnotations;
using System.Reflection;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Redline.Contracts;
using Redline.Data;
using Redline.Domain.Entities;
using Redline.Services;

namespace Redline.Endpoints;

public static class VehicleEndpoints
{
    public static IEndpointRouteBuilder MapVehicleEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api").WithTags("Vitrine");

        // Público (vitrine — Fase 1, agora filtrando IsActive — RF-07).
        group.MapGet("/vehicles", GetVehicles);
        group.MapGet("/vehicles/brands", GetBrands);
        group.MapGet("/vehicles/{id:guid}", GetVehicleById);
        group.MapGet("/sellers/{id:guid}", GetSeller);
        group.MapGet("/sellers/{id:guid}/vehicles", GetSellerVehicles);

        // Protegidos (Fase 5 / RF-06): StoreStaff + escopo/ownership por StoreId do token.
        group.MapPost("/vehicles", CreateVehicle).RequireAuthorization("StoreStaff");
        group.MapPut("/vehicles/{id:guid}", UpdateVehicle).RequireAuthorization("StoreStaff");
        group.MapDelete("/vehicles/{id:guid}", ArchiveVehicle).RequireAuthorization("StoreStaff");
        group.MapGet("/store/vehicles", GetStoreVehicles).RequireAuthorization("StoreStaff");

        return app;
    }

    // GET /api/vehicles  (RF-02..RF-05)
    private static async Task<IResult> GetVehicles(
        AppDbContext db,
        string? q = null,
        string? filter = "Todos",
        string? tier = null,
        string? transmission = null,
        decimal? minPrice = null,
        decimal? maxPrice = null,
        Guid? sellerId = null,
        Guid? storeId = null,
        string? sort = "recent",
        int page = 1,
        int pageSize = 20,
        CancellationToken ct = default)
    {
        filter = string.IsNullOrWhiteSpace(filter) ? "Todos" : filter;
        sort = string.IsNullOrWhiteSpace(sort) ? "recent" : sort;
        page = page < 1 ? 1 : page;
        pageSize = Math.Clamp(pageSize, 1, 50);

        // --- Validação de enums/faixa -> 400 ProblemDetails (RNF-06) ---
        VehicleTier? tierEnum = null;
        if (!string.IsNullOrWhiteSpace(tier))
        {
            if (!TryParseDisplayEnum<VehicleTier>(tier, out var t)) return InvalidParam("tier", tier);
            tierEnum = t;
        }

        TransmissionType? transEnum = null;
        if (!string.IsNullOrWhiteSpace(transmission))
        {
            if (!TryParseDisplayEnum<TransmissionType>(transmission, out var tr)) return InvalidParam("transmission", transmission);
            transEnum = tr;
        }

        var allowedSorts = new[] { "recent", "priceAsc", "priceDesc", "views" };
        if (!allowedSorts.Contains(sort)) return InvalidParam("sort", sort);

        if (minPrice.HasValue && maxPrice.HasValue && minPrice > maxPrice)
            return Results.Problem(statusCode: StatusCodes.Status400BadRequest,
                title: "Bad Request", detail: "minPrice não pode ser maior que maxPrice.");

        // Leitura pura: AsNoTracking() para máxima performance (RNF-01).
        // Fase 5 (RF-07): a vitrine pública só enxerga veículos ativos.
        var query = db.Vehicles.AsNoTracking().Where(v => v.IsActive);

        // Filtro legado (RF-05)
        query = filter switch
        {
            "Todos" => query,
            "Modificados" => query.Where(v => v.Stage != BuildStage.Original),
            "Originais" => query.Where(v => v.Stage == BuildStage.Original),
            _ => query.Where(v => v.Brand == filter) // qualquer outro valor é tratado como marca
        };

        // Where condicionais (RNF-01)
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            query = query.Where(v =>
                EF.Functions.ILike(v.Title, $"%{term}%") ||
                EF.Functions.ILike(v.Brand, $"%{term}%") ||
                EF.Functions.ILike(v.Model, $"%{term}%"));
        }
        if (tierEnum.HasValue) query = query.Where(v => v.Tier == tierEnum.Value);
        if (transEnum.HasValue) query = query.Where(v => v.Transmission == transEnum.Value);
        if (minPrice.HasValue) query = query.Where(v => v.Price >= minPrice.Value);
        if (maxPrice.HasValue) query = query.Where(v => v.Price <= maxPrice.Value);
        if (sellerId.HasValue) query = query.Where(v => v.SellerId == sellerId.Value);
        if (storeId.HasValue) query = query.Where(v => v.StoreId == storeId.Value);

        // Ordenação dinâmica (RF-04)
        query = sort switch
        {
            "priceAsc" => query.OrderBy(v => v.Price),
            "priceDesc" => query.OrderByDescending(v => v.Price),
            "views" => query.OrderByDescending(v => v.Views),
            _ => query.OrderByDescending(v => v.CreatedAt),
        };

        var totalItems = await query.CountAsync(ct);

        var pageItems = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var items = pageItems.Select(ToResponse).ToList();
        var totalPages = totalItems == 0 ? 0 : (int)Math.Ceiling(totalItems / (double)pageSize);

        return Results.Ok(new PagedResult<VehicleResponse>(items, page, pageSize, totalItems, totalPages));
    }

    // GET /api/vehicles/brands  (RF-06)
    private static async Task<IResult> GetBrands(AppDbContext db, CancellationToken ct)
    {
        // Agrupa/conta no banco (traduz para GROUP BY); ordena e monta o DTO em memória
        // para evitar problemas de tradução do OrderBy sobre o tipo projetado.
        var grouped = await db.Vehicles.AsNoTracking()
            .GroupBy(v => v.Brand)
            .Select(g => new { Brand = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var brands = grouped
            .OrderByDescending(b => b.Count)
            .ThenBy(b => b.Brand, StringComparer.OrdinalIgnoreCase)
            .Select(b => new BrandFacetResponse(b.Brand, b.Count))
            .ToList();

        return Results.Ok(brands);
    }

    // GET /api/vehicles/{id}
    private static async Task<IResult> GetVehicleById(AppDbContext db, Guid id, CancellationToken ct)
    {
        // Fase 5 (RF-07): detalhe público só resolve veículos ativos (arquivado -> 404).
        var vehicle = await db.Vehicles.AsNoTracking()
            .FirstOrDefaultAsync(v => v.Id == id && v.IsActive, ct);

        if (vehicle is null)
            return Results.Problem(statusCode: StatusCodes.Status404NotFound,
                title: "Not Found", detail: $"Veículo com id '{id}' não encontrado.");

        // Incremento de views best-effort: não bloqueia nem derruba a resposta se falhar.
        try
        {
            await db.Vehicles
                .Where(v => v.Id == id)
                .ExecuteUpdateAsync(s => s.SetProperty(v => v.Views, v => v.Views + 1), ct);
        }
        catch
        {
            // silencioso por design (ver DoD §5 — "best-effort")
        }

        // Retorna já com a view incrementada.
        var response = ToResponse(vehicle) with { Views = vehicle.Views + 1 };
        return Results.Ok(response);
    }

    // GET /api/sellers/{id} — sem Email (contrato público).
    private static async Task<IResult> GetSeller(AppDbContext db, Guid id, CancellationToken ct)
    {
        var seller = await db.Users.AsNoTracking()
            .Where(u => u.Id == id)
            .Select(u => new SellerResponse(
                u.Id, u.Name, u.Role, u.AvatarUrl, u.MemberSince, u.Vehicles.Count(v => v.IsActive)))
            .FirstOrDefaultAsync(ct);

        if (seller is null)
            return Results.Problem(statusCode: StatusCodes.Status404NotFound,
                title: "Not Found", detail: $"Vendedor com id '{id}' não encontrado.");

        return Results.Ok(seller);
    }

    // GET /api/sellers/{id}/vehicles  (RF-07)
    private static async Task<IResult> GetSellerVehicles(
        AppDbContext db, Guid id, int page = 1, int pageSize = 12, CancellationToken ct = default)
    {
        var exists = await db.Users.AsNoTracking().AnyAsync(u => u.Id == id, ct);
        if (!exists)
            return Results.Problem(statusCode: StatusCodes.Status404NotFound,
                title: "Not Found", detail: $"Vendedor com id '{id}' não encontrado.");

        page = page < 1 ? 1 : page;
        pageSize = Math.Clamp(pageSize, 1, 50);

        // Fase 5 (RF-07): perfil público do vendedor só lista veículos ativos.
        var query = db.Vehicles.AsNoTracking().Where(v => v.SellerId == id && v.IsActive);

        var totalItems = await query.CountAsync(ct);
        var pageItems = await query
            .OrderByDescending(v => v.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var items = pageItems.Select(ToResponse).ToList();
        var totalPages = totalItems == 0 ? 0 : (int)Math.Ceiling(totalItems / (double)pageSize);

        return Results.Ok(new PagedResult<VehicleResponse>(items, page, pageSize, totalItems, totalPages));
    }

    // --- Helpers ---

    private static IResult InvalidParam(string name, string value) =>
        Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: "Bad Request",
            detail: $"Valor '{value}' inválido para o parâmetro '{name}'.");

    // Converte string de query -> enum honrando [Display(Name)] (RNF-06). Ex.: "Automático" -> Automatico.
    private static bool TryParseDisplayEnum<T>(string raw, out T value) where T : struct, Enum
    {
        foreach (var v in Enum.GetValues<T>())
        {
            var member = v.ToString();
            var display = typeof(T).GetMember(member).FirstOrDefault()
                ?.GetCustomAttribute<DisplayAttribute>()?.Name ?? member;

            if (string.Equals(raw, member, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(raw, display, StringComparison.OrdinalIgnoreCase))
            {
                value = v;
                return true;
            }
        }
        value = default;
        return false;
    }

    // Mapeamento entidade -> DTO, com coalescência de CustomSpecs para objeto vazio.
    private static VehicleResponse ToResponse(Vehicle v) => new(
        v.Id, v.Title, v.Brand, v.Model, v.Year, v.Price, v.Mileage,
        v.Transmission, v.Stage, v.Tier, v.Images, v.SellerId, v.Location,
        v.CreatedAt, v.Views,
        v.CustomSpecs is null
            ? new CustomSpecsResponse(new(), new(), new(), false, null)
            : new CustomSpecsResponse(
                v.CustomSpecs.Engine ?? new(),
                v.CustomSpecs.Suspension ?? new(),
                v.CustomSpecs.Interior ?? new(),
                v.CustomSpecs.HasDyno,
                v.CustomSpecs.ClaimedHp),
        v.IsActive);

    // =======================================================================
    // FASE 5 — Escrita de veículos (StoreStaff + ownership por StoreId do token).
    // =======================================================================

    // POST /api/vehicles  (RF-01 / §4.1)
    private static async Task<IResult> CreateVehicle(
        CreateVehicleRequest request,
        ClaimsPrincipal principal,
        ICurrentUserService currentUser,
        IConfiguration config,
        AppDbContext db,
        CancellationToken ct)
    {
        var me = await currentUser.GetAsync(principal, ct);
        if (me?.StoreId is null) return Forbidden();

        if (Validate(request?.Title, request?.Brand, request?.Model, request?.Location,
                request?.Year ?? 0, request?.Price ?? 0, request?.Mileage ?? 0,
                request?.Images, config, out var validationError) is false)
            return validationError!;

        var now = DateTime.UtcNow;
        var vehicle = new Vehicle
        {
            Title = request!.Title.Trim(),
            Brand = request.Brand.Trim(),
            Model = request.Model.Trim(),
            Year = request.Year,
            Price = request.Price,
            Mileage = request.Mileage,
            Transmission = request.Transmission,
            Stage = request.Stage,
            Tier = request.Tier,
            Images = request.Images.Select(i => i.Trim()).ToList(),
            Location = request.Location.Trim(),
            CustomSpecs = ToCustomSpecs(request.CustomSpecs),
            // Derivados no servidor (RNF-02): nunca do corpo.
            SellerId = me.Id,
            StoreId = me.StoreId.Value,
            Views = 0,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        db.Vehicles.Add(vehicle);
        await db.SaveChangesAsync(ct);

        return Results.Created($"/api/vehicles/{vehicle.Id}", ToResponse(vehicle));
    }

    // PUT /api/vehicles/{id}  (RF-02 / §4.2)
    private static async Task<IResult> UpdateVehicle(
        Guid id,
        UpdateVehicleRequest request,
        ClaimsPrincipal principal,
        ICurrentUserService currentUser,
        IConfiguration config,
        AppDbContext db,
        CancellationToken ct)
    {
        var me = await currentUser.GetAsync(principal, ct);
        if (me?.StoreId is null) return Forbidden();

        if (Validate(request?.Title, request?.Brand, request?.Model, request?.Location,
                request?.Year ?? 0, request?.Price ?? 0, request?.Mileage ?? 0,
                request?.Images, config, out var validationError) is false)
            return validationError!;

        // Carrega COM tracking por Id E StoreId. Veículo de outra loja (ou inexistente) -> 404
        // (não vaza existência — §4.2).
        var vehicle = await db.Vehicles
            .FirstOrDefaultAsync(v => v.Id == id && v.StoreId == me.StoreId.Value, ct);

        if (vehicle is null)
            return Results.Problem(statusCode: StatusCodes.Status404NotFound,
                title: "Not Found", detail: $"Veículo com id '{id}' não encontrado.");

        // Substituição total dos campos mutáveis (MVP). Imutáveis (SellerId/StoreId/Views/
        // CreatedAt/IsActive) permanecem intocados (§4.2).
        vehicle.Title = request!.Title.Trim();
        vehicle.Brand = request.Brand.Trim();
        vehicle.Model = request.Model.Trim();
        vehicle.Year = request.Year;
        vehicle.Price = request.Price;
        vehicle.Mileage = request.Mileage;
        vehicle.Transmission = request.Transmission;
        vehicle.Stage = request.Stage;
        vehicle.Tier = request.Tier;
        vehicle.Images = request.Images.Select(i => i.Trim()).ToList();
        vehicle.Location = request.Location.Trim();
        vehicle.CustomSpecs = ToCustomSpecs(request.CustomSpecs);
        vehicle.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);

        return Results.Ok(ToResponse(vehicle));
    }

    // DELETE /api/vehicles/{id}  (RF-03 / §4.3) — soft-delete idempotente.
    private static async Task<IResult> ArchiveVehicle(
        Guid id,
        ClaimsPrincipal principal,
        ICurrentUserService currentUser,
        AppDbContext db,
        CancellationToken ct)
    {
        var me = await currentUser.GetAsync(principal, ct);
        if (me?.StoreId is null) return Forbidden();

        var vehicle = await db.Vehicles
            .FirstOrDefaultAsync(v => v.Id == id && v.StoreId == me.StoreId.Value, ct);

        if (vehicle is null)
            return Results.Problem(statusCode: StatusCodes.Status404NotFound,
                title: "Not Found", detail: $"Veículo com id '{id}' não encontrado.");

        // Idempotente: arquivar já-arquivado retorna 204 sem alterar (§4.3).
        if (vehicle.IsActive)
        {
            vehicle.IsActive = false;
            vehicle.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }

        return Results.NoContent();
    }

    // GET /api/store/vehicles  (RF-04 / §4.5) — inventário da loja, inclui arquivados.
    private static async Task<IResult> GetStoreVehicles(
        ClaimsPrincipal principal,
        ICurrentUserService currentUser,
        AppDbContext db,
        string? status = "all",
        int page = 1,
        int pageSize = 20,
        CancellationToken ct = default)
    {
        var me = await currentUser.GetAsync(principal, ct);
        if (me?.StoreId is null) return Forbidden();

        status = string.IsNullOrWhiteSpace(status) ? "all" : status.Trim().ToLowerInvariant();
        if (status is not ("all" or "active" or "inactive"))
            return InvalidParam("status", status);

        page = page < 1 ? 1 : page;
        pageSize = Math.Clamp(pageSize, 1, 50); // teto 50 (RNF-06)

        var query = db.Vehicles.AsNoTracking().Where(v => v.StoreId == me.StoreId.Value);
        query = status switch
        {
            "active" => query.Where(v => v.IsActive),
            "inactive" => query.Where(v => !v.IsActive),
            _ => query // "all"
        };

        var totalItems = await query.CountAsync(ct);
        var pageItems = await query
            .OrderByDescending(v => v.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var items = pageItems.Select(ToResponse).ToList();
        var totalPages = totalItems == 0 ? 0 : (int)Math.Ceiling(totalItems / (double)pageSize);

        return Results.Ok(new PagedResult<VehicleResponse>(items, page, pageSize, totalItems, totalPages));
    }

    // --- Helpers de escrita ---

    private static CustomSpecs? ToCustomSpecs(CustomSpecsRequest? r)
    {
        if (r is null) return null;
        return new CustomSpecs
        {
            Engine = r.Engine ?? new(),
            Suspension = r.Suspension ?? new(),
            Interior = r.Interior ?? new(),
            HasDyno = r.HasDyno,
            ClaimedHp = r.ClaimedHp
        };
    }

    private static IResult Forbidden() =>
        Results.Problem(statusCode: StatusCodes.Status403Forbidden, title: "Forbidden",
            detail: "Usuário autenticado não está vinculado a uma loja.");

    // Validação de entrada -> 400 ProblemDetails (RNF-03/04). Retorna false + preenche `error`.
    private static bool Validate(
        string? title, string? brand, string? model, string? location,
        int year, decimal price, int mileage, List<string>? images,
        IConfiguration config, out IResult? error)
    {
        IResult Bad(string detail)
        {
            error = Results.Problem(statusCode: StatusCodes.Status400BadRequest,
                title: "Bad Request", detail: detail);
            return error;
        }

        error = null;

        if (string.IsNullOrWhiteSpace(title)) { Bad("'title' é obrigatório."); return false; }
        if (string.IsNullOrWhiteSpace(brand)) { Bad("'brand' é obrigatório."); return false; }
        if (string.IsNullOrWhiteSpace(model)) { Bad("'model' é obrigatório."); return false; }
        if (string.IsNullOrWhiteSpace(location)) { Bad("'location' é obrigatório."); return false; }

        if (price <= 0) { Bad("'price' deve ser maior que zero."); return false; }
        if (mileage < 0) { Bad("'mileage' não pode ser negativo."); return false; }

        var maxYear = DateTime.UtcNow.Year + 1;
        if (year < 1900 || year > maxYear) { Bad($"'year' deve estar entre 1900 e {maxYear}."); return false; }

        if (images is null || images.Count == 0) { Bad("'images' deve conter ao menos 1 URL."); return false; }

        // RNF-04: cada URL precisa apontar para o Storage do projeto e o bucket vehicle-images.
        var expectedPrefix = StoragePrefix(config);
        foreach (var url in images)
        {
            var u = url?.Trim();
            if (string.IsNullOrWhiteSpace(u) || !u.StartsWith(expectedPrefix, StringComparison.Ordinal))
            {
                Bad($"URL de imagem inválida. Esperado prefixo '{expectedPrefix}'.");
                return false;
            }
        }

        return true;
    }

    // Deriva o prefixo público do bucket a partir de Supabase:ProjectRef (RNF-04).
    private static string StoragePrefix(IConfiguration config)
    {
        var projectRef = config["Supabase:ProjectRef"]?.Trim();
        if (string.IsNullOrWhiteSpace(projectRef))
        {
            // Fallback: tenta derivar do host da Authority (https://<ref>.supabase.co/auth/v1).
            var authority = config["Supabase:Authority"];
            if (!string.IsNullOrWhiteSpace(authority) &&
                Uri.TryCreate(authority, UriKind.Absolute, out var uri))
            {
                var host = uri.Host; // <ref>.supabase.co
                var dot = host.IndexOf('.');
                projectRef = dot > 0 ? host[..dot] : host;
            }
        }

        return $"https://{projectRef}.supabase.co/storage/v1/object/public/vehicle-images/";
    }
}
