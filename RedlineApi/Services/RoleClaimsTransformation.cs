using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;

namespace Redline.Services;

/// <summary>
/// Enriquece o principal autenticado com uma claim de papel (<see cref="ClaimTypes.Role"/>)
/// DERIVADA do <c>User</c> local — é ela que alimenta as políticas <c>StoreStaff</c>/
/// <c>StoreManagerOnly</c> (§5.3). Como efeito colateral, resolve/provisiona o usuário (RF-03)
/// em toda rota protegida. Idempotente e no-op para requests anônimos (não toca o banco).
/// </summary>
public sealed class RoleClaimsTransformation(ICurrentUserService currentUser) : IClaimsTransformation
{
    public const string StoreIdClaim = "redline:storeId";

    public async Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        if (principal.Identity?.IsAuthenticated != true)
            return principal; // vitrine/leads públicos: sem token, sem hit no banco

        // Já enriquecido nesta request? (TransformAsync pode ser chamado mais de uma vez.)
        if (principal.HasClaim(c => c.Type == StoreIdClaim))
            return principal;

        var me = await currentUser.GetAsync(principal);
        if (me is null)
            return principal;

        var identity = new ClaimsIdentity();
        identity.AddClaim(new Claim(ClaimTypes.Role, me.Role.ToString()));
        identity.AddClaim(new Claim(StoreIdClaim, me.StoreId?.ToString() ?? string.Empty));
        principal.AddIdentity(identity);
        return principal;
    }
}
