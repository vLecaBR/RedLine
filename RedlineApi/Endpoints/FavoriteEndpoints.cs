using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Redline.Contracts;
using Redline.Data;
using Redline.Domain.Entities;
using Redline.Services;

namespace Redline.Endpoints;

/// <summary>
/// Favoritos persistidos (Fase 6 / §Fase 6). Relação N:N User↔Vehicle. Todos os endpoints
/// exigem apenas autenticação (qualquer papel — inclusive Buyer). O <c>UserId</c> vem SEMPRE
/// do token via <see cref="ICurrentUserService"/>, nunca do cliente.
/// </summary>
public static class FavoriteEndpoints
{
    public static IEndpointRouteBuilder MapFavoriteEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/me/favorites").WithTags("Favoritos");

        group.MapGet("", GetFavorites).RequireAuthorization();
        group.MapPost("/{vehicleId:guid}", AddFavorite).RequireAuthorization();
        group.MapDelete("/{vehicleId:guid}", RemoveFavorite).RequireAuthorization();

        return app;
    }

    // GET /api/me/favorites -> 200 VehicleResponse[] (só veículos ATIVOS, mais recentes primeiro).
    private static async Task<IResult> GetFavorites(
        ClaimsPrincipal principal,
        ICurrentUserService currentUser,
        AppDbContext db,
        CancellationToken ct)
    {
        var me = await currentUser.GetAsync(principal, ct);
        if (me is null) return Unauthorized();

        var vehicles = await db.Favorites.AsNoTracking()
            .Where(f => f.UserId == me.Id && f.Vehicle != null && f.Vehicle.IsActive)
            .OrderByDescending(f => f.CreatedAt)
            .Select(f => f.Vehicle!)
            .ToListAsync(ct);

        var items = vehicles.Select(VehicleEndpoints.ToResponse).ToList();
        return Results.Ok(items);
    }

    // POST /api/me/favorites/{vehicleId} -> 204. Idempotente (já favoritado -> 204).
    private static async Task<IResult> AddFavorite(
        Guid vehicleId,
        ClaimsPrincipal principal,
        ICurrentUserService currentUser,
        AppDbContext db,
        CancellationToken ct)
    {
        var me = await currentUser.GetAsync(principal, ct);
        if (me is null) return Unauthorized();

        // Só permite favoritar veículo existente e ativo (não vaza arquivados/inexistentes).
        var exists = await db.Vehicles.AsNoTracking()
            .AnyAsync(v => v.Id == vehicleId && v.IsActive, ct);
        if (!exists)
            return Results.Problem(statusCode: StatusCodes.Status404NotFound,
                title: "Not Found", detail: $"Veículo com id '{vehicleId}' não encontrado.");

        var already = await db.Favorites
            .AnyAsync(f => f.UserId == me.Id && f.VehicleId == vehicleId, ct);

        if (!already)
        {
            db.Favorites.Add(new Favorite
            {
                UserId = me.Id,
                VehicleId = vehicleId,
                CreatedAt = DateTime.UtcNow
            });
            try
            {
                await db.SaveChangesAsync(ct);
            }
            catch (DbUpdateException)
            {
                // Corrida no índice único (UserId, VehicleId): outro request já inseriu -> idempotente.
                db.ChangeTracker.Clear();
            }
        }

        return Results.NoContent();
    }

    // DELETE /api/me/favorites/{vehicleId} -> 204. Idempotente (não favoritado -> 204).
    private static async Task<IResult> RemoveFavorite(
        Guid vehicleId,
        ClaimsPrincipal principal,
        ICurrentUserService currentUser,
        AppDbContext db,
        CancellationToken ct)
    {
        var me = await currentUser.GetAsync(principal, ct);
        if (me is null) return Unauthorized();

        var favorite = await db.Favorites
            .FirstOrDefaultAsync(f => f.UserId == me.Id && f.VehicleId == vehicleId, ct);

        if (favorite is not null)
        {
            db.Favorites.Remove(favorite);
            await db.SaveChangesAsync(ct);
        }

        return Results.NoContent();
    }

    private static IResult Unauthorized() =>
        Results.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Unauthorized",
            detail: "Token sem e-mail; não foi possível resolver o usuário.");
}
