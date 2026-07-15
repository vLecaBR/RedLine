using System.Security.Claims;
using Redline.Contracts;
using Redline.Services;

namespace Redline.Endpoints;

public static class DashboardEndpoints
{
    public static IEndpointRouteBuilder MapDashboardEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api").WithTags("Dashboard");

        // Protegido (Fase 4 / RF-03 / §4.4): StoreStaff + escopo por StoreId do token.
        group.MapGet("/dashboard/kpis", GetKpis).RequireAuthorization("StoreStaff");

        return app;
    }

    // GET /api/dashboard/kpis  (RF-03 / §4.4)
    private static async Task<IResult> GetKpis(
        ClaimsPrincipal principal,
        ICurrentUserService currentUser,
        IDashboardService dashboard,
        CancellationToken ct)
    {
        // Escopo por loja: StoreId vem SEMPRE do token (RNF-03). Sem loja -> 403.
        var me = await currentUser.GetAsync(principal, ct);
        if (me?.StoreId is null)
            return Results.Problem(
                statusCode: StatusCodes.Status403Forbidden,
                title: "Forbidden",
                detail: "Usuário autenticado não está vinculado a uma loja.");

        var summary = await dashboard.GetKpisAsync(me.StoreId.Value, ct);
        return Results.Ok(summary);
    }
}
