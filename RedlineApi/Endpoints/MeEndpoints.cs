using System.Security.Claims;
using Redline.Contracts;
using Redline.Services;

namespace Redline.Endpoints;

public static class MeEndpoints
{
    public static IEndpointRouteBuilder MapMeEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api").WithTags("Auth");

        // Protegido (RF-04): qualquer papel autenticado. Sem token válido -> 401 ProblemDetails.
        group.MapGet("/me", GetMe).RequireAuthorization();

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
}
