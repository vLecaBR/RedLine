using Microsoft.EntityFrameworkCore;
using Redline.Data;
using Redline.Domain.Entities;

namespace Redline.Services;

/// <summary>
/// Regra de distribuição de leads (§3.4). Isolada em serviço para testabilidade (RNF-06, Fase 7)
/// e para manter o handler sem lógica de negócio.
/// </summary>
public interface ILeadDistributionService
{
    /// <summary>
    /// Escolhe um vendedor da loja informada para receber o próximo lead.
    /// Lança <see cref="NoSellersAvailableException"/> se a loja não tiver vendedor elegível.
    /// </summary>
    Task<Guid> PickSellerAsync(Guid storeId, CancellationToken ct = default);
}

/// <summary>
/// Loja sem vendedores elegíveis. O handler traduz para 409 Conflict (RNF-04).
/// </summary>
public class NoSellersAvailableException : Exception
{
    public NoSellersAvailableException()
        : base("Nenhum vendedor disponível na loja para atendimento.") { }
}

/// <summary>
/// Round-robin por loja (RNF-07). Estratégia MVP: escolhe o vendedor elegível
/// (<c>Role ∈ {Seller, StoreManager}</c> e <c>StoreId == storeId</c>) com MENOS leads
/// atribuídos naquela loja; desempate por <c>CreatedAt</c> asc e depois <c>Id</c>.
/// Não depende de estado em memória do processo (sem cursor estático) — determinístico
/// e seguro sob concorrência sem lock global.
/// </summary>
public class RoundRobinLeadDistributionService : ILeadDistributionService
{
    private readonly AppDbContext _db;

    public RoundRobinLeadDistributionService(AppDbContext db) => _db = db;

    public async Task<Guid> PickSellerAsync(Guid storeId, CancellationToken ct = default)
    {
        // 1) Vendedores elegíveis da loja (consulta simples, traduz sem problema).
        var sellers = await _db.Users.AsNoTracking()
            .Where(u => u.StoreId == storeId &&
                        (u.Role == UserRole.Seller || u.Role == UserRole.StoreManager))
            .Select(u => new { u.Id, u.CreatedAt })
            .ToListAsync(ct);

        if (sellers.Count == 0)
            throw new NoSellersAvailableException();

        // 2) Contagem de leads por vendedor NAQUELA loja. Agrupa/conta no banco e materializa;
        //    a ordenação/montagem final é em memória (padrão L3 do MASTER_PLAN).
        var counts = await _db.Leads.AsNoTracking()
            .Where(l => l.StoreId == storeId)
            .GroupBy(l => l.AssignedSellerId)
            .Select(g => new { SellerId = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var countBySeller = counts.ToDictionary(c => c.SellerId, c => c.Count);

        // 3) Round-robin: menos leads na loja; desempate CreatedAt asc -> Id (RNF-07).
        var picked = sellers
            .OrderBy(s => countBySeller.TryGetValue(s.Id, out var n) ? n : 0)
            .ThenBy(s => s.CreatedAt)
            .ThenBy(s => s.Id)
            .First();

        return picked.Id;
    }
}
