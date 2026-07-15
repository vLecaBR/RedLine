using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Redline.Data;
using Redline.Domain.Entities;

namespace Redline.Services;

/// <summary>
/// Snapshot do usuário logado, já resolvido para a entidade local (+ loja).
/// É o que os endpoints/políticas consomem — nunca a entidade crua nem o token.
/// </summary>
public sealed record CurrentUser(
    Guid Id,
    string Name,
    string Email,
    UserRole Role,
    string? AvatarUrl,
    int MemberSince,
    Guid? StoreId,
    string? StoreName);

/// <summary>
/// Resolve o <see cref="CurrentUser"/> local a partir do <see cref="ClaimsPrincipal"/> do
/// JWT do Supabase (claims <c>email</c>/<c>sub</c>), provisionando JIT no primeiro acesso
/// (RF-02/RF-03). Scoped: cacheia o resultado por request para evitar hits repetidos ao banco.
/// </summary>
public interface ICurrentUserService
{
    /// <summary>
    /// Retorna o usuário local do principal (provisionando se necessário), ou <c>null</c>
    /// se o principal não estiver autenticado / não tiver e-mail no token.
    /// </summary>
    Task<CurrentUser?> GetAsync(ClaimsPrincipal principal, CancellationToken ct = default);
}

public sealed class CurrentUserService(AppDbContext db) : ICurrentUserService
{
    private CurrentUser? _cached;

    public async Task<CurrentUser?> GetAsync(ClaimsPrincipal principal, CancellationToken ct = default)
    {
        if (_cached is not null) return _cached;

        if (principal.Identity?.IsAuthenticated != true)
            return null;

        var email = GetClaim(principal, "email", ClaimTypes.Email)?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email))
            return null; // sem e-mail no token não há como casar o usuário local (resolução por e-mail — MVP)

        // 1) Leitura: tenta achar o usuário local (com a loja, se houver).
        var found = await LoadAsync(email, ct);
        if (found is not null)
            return _cached = found;

        // 2) Provisionamento JIT (RF-03): cria um Buyer mínimo com os dados do token.
        var name = GetClaim(principal, "name", "full_name", "user_name") ?? EmailLocalPart(email);
        var now = DateTime.UtcNow;

        db.Users.Add(new User
        {
            Name = name,
            Email = email,
            Role = UserRole.Buyer,   // primeiro acesso: comprador, sem loja
            StoreId = null,
            AvatarUrl = null,
            MemberSince = now.Year,
            CreatedAt = now,
            UpdatedAt = now
        });

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // RNF-09: corrida — outro request do mesmo e-mail já inseriu. Recarrega e segue.
            db.ChangeTracker.Clear();
            var reloaded = await LoadAsync(email, ct);
            if (reloaded is not null) return _cached = reloaded;
            throw;
        }

        var created = await LoadAsync(email, ct);
        return _cached = created;
    }

    private Task<CurrentUser?> LoadAsync(string email, CancellationToken ct) =>
        db.Users.AsNoTracking()
            .Where(u => u.Email.ToLower() == email)
            .Select(u => new CurrentUser(
                u.Id,
                u.Name,
                u.Email,
                u.Role,
                u.AvatarUrl,
                u.MemberSince,
                u.StoreId,
                u.Store != null ? u.Store.Name : null))
            .FirstOrDefaultAsync(ct);

    private static string? GetClaim(ClaimsPrincipal p, params string[] types)
    {
        foreach (var t in types)
        {
            var v = p.FindFirst(t)?.Value;
            if (!string.IsNullOrWhiteSpace(v)) return v;
        }
        return null;
    }

    private static string EmailLocalPart(string email)
    {
        var at = email.IndexOf('@');
        return at > 0 ? email[..at] : email;
    }
}
