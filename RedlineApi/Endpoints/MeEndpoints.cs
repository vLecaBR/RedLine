using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Redline.Contracts;
using Redline.Data;
using Redline.Services;

namespace Redline.Endpoints;

public static class MeEndpoints
{
    public static IEndpointRouteBuilder MapMeEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api").WithTags("Auth");

        // Protegido (RF-04): qualquer papel autenticado. Sem token válido -> 401 ProblemDetails.
        group.MapGet("/me", GetMe).RequireAuthorization();

        // Meus Anúncios (Fase 6 / RF-04): veículos do próprio usuário (SellerId == token).
        group.MapGet("/me/vehicles", GetMyVehicles).RequireAuthorization();

        return app;
    }

    // GET /api/me  (RF-02..RF-04 / §4.1)
    private static async Task<IResult> GetMe(
        ClaimsPrincipal principal,
        ICurrentUserService currentUser,
        CancellationToken ct)
    {
        var me = await currentUser.GetAsync(principal, ct);

        // Autenticado no JWT, mas sem e-mail utilizável no token -> 401 padronizado.
        if (me is null)
            return Results.Problem(
                statusCode: StatusCodes.Status401Unauthorized,
                title: "Unauthorized",
                detail: "Token sem e-mail; não foi possível resolver o usuário.");

        var response = new MeResponse(
            me.Id,
            me.Name,
            me.Email,
            me.Role,
            me.AvatarUrl,
            me.MemberSince,
            me.StoreId,
            me.StoreName);

        return Results.Ok(response);
    }

    // GET /api/me/vehicles  (Fase 6 / RF-04 / §4.4) — anúncios do próprio usuário.
    private static async Task<IResult> GetMyVehicles(
        ClaimsPrincipal principal,
        ICurrentUserService currentUser,
        AppDbContext db,
        string? status = "all",
        int page = 1,
        int pageSize = 20,
        CancellationToken ct = default)
    {
        var me = await currentUser.GetAsync(principal, ct);
        if (me is null)
            return Results.Problem(statusCode: StatusCodes.Status401Unauthorized,
                title: "Unauthorized", detail: "Token sem e-mail; não foi possível resolver o usuário.");

        status = string.IsNullOrWhiteSpace(status) ? "all" : status.Trim().ToLowerInvariant();
        if (status is not ("all" or "active" or "inactive"))
            return Results.Problem(statusCode: StatusCodes.Status400BadRequest,
                title: "Bad Request", detail: $"Valor '{status}' inválido para o parâmetro 'status'.");

        page = page < 1 ? 1 : page;
        pageSize = Math.Clamp(pageSize, 1, 50); // teto 50 (RNF-07)

        var query = db.Vehicles.AsNoTracking().Where(v => v.SellerId == me.Id);
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

        var items = pageItems.Select(VehicleEndpoints.ToResponse).ToList();
        var totalPages = totalItems == 0 ? 0 : (int)Math.Ceiling(totalItems / (double)pageSize);

        return Results.Ok(new PagedResult<VehicleResponse>(items, page, pageSize, totalItems, totalPages));
    }
}
