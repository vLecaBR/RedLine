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
        group.MapGet("/vehicles/{id:guid}", GetVehicleById);
        group.MapGet("/sellers/{id:guid}", GetSeller);

        return app;
    }

    // GET /api/vehicles?filter=&page=&pageSize=
    private static async Task<IResult> GetVehicles(
        AppDbContext db,
        string? filter = "Todos",
        int page = 1,
        int pageSize = 20,
        CancellationToken ct = default)
    {
        filter = string.IsNullOrWhiteSpace(filter) ? "Todos" : filter;
        page = page < 1 ? 1 : page;
        pageSize = Math.Clamp(pageSize, 1, 50);

        // Leitura pura: AsNoTracking() para máxima performance.
        var query = db.Vehicles.AsNoTracking();

        query = filter switch
        {
            "Todos" => query,
            "Modificados" => query.Where(v => v.Stage != BuildStage.Original),
            "Originais" => query.Where(v => v.Stage == BuildStage.Original),
            _ => query.Where(v => v.Brand == filter) // qualquer outro valor é tratado como marca
        };

        var totalItems = await query.CountAsync(ct);

        // Materializa a página (o owned-type CustomSpecs/JSONB vem junto) e mapeia em memória.
        var page_ = await query
            .OrderByDescending(v => v.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var items = page_.Select(ToResponse).ToList();
        var totalPages = totalItems == 0 ? 0 : (int)Math.Ceiling(totalItems / (double)pageSize);

        return Results.Ok(new PagedResult<VehicleResponse>(items, page, pageSize, totalItems, totalPages));
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
