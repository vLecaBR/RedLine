using System.ComponentModel.DataAnnotations;
using System.Reflection;
using Microsoft.EntityFrameworkCore;
using Redline.Contracts;
using Redline.Data;
using Redline.Domain.Entities;

namespace Redline.Endpoints;

public static class VehicleEndpoints
{
    public static IEndpointRouteBuilder MapVehicleEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api").WithTags("Vitrine");

        group.MapGet("/vehicles", GetVehicles);
        group.MapGet("/vehicles/brands", GetBrands);
        group.MapGet("/vehicles/{id:guid}", GetVehicleById);
        group.MapGet("/sellers/{id:guid}", GetSeller);
        group.MapGet("/sellers/{id:guid}/vehicles", GetSellerVehicles);

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
        var query = db.Vehicles.AsNoTracking();

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
        var brands = await db.Vehicles.AsNoTracking()
            .GroupBy(v => v.Brand)
            .Select(g => new BrandFacetResponse(g.Key, g.Count()))
            .OrderByDescending(b => b.Count)
            .ThenBy(b => b.Brand)
            .ToListAsync(ct);

        return Results.Ok(brands);
    }

    // GET /api/vehicles/{id}
    private static async Task<IResult> GetVehicleById(AppDbContext db, Guid id, CancellationToken ct)
    {
        var vehicle = await db.Vehicles.AsNoTracking()
            .FirstOrDefaultAsync(v => v.Id == id, ct);

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
                u.Id, u.Name, u.Role, u.AvatarUrl, u.MemberSince, u.Vehicles.Count))
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

        var query = db.Vehicles.AsNoTracking().Where(v => v.SellerId == id);

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
                v.CustomSpecs.ClaimedHp));
}
