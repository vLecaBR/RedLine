using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Redline.Contracts;
using Redline.Data;
using Redline.Domain.Entities;

namespace Redline.Services;

/// <summary>
/// Agregação dos KPIs do Painel do Lojista (Fase 4 / §4.4). Isolada em serviço para
/// testabilidade (RNF-09, Fase 7) e para manter o handler sem lógica de negócio.
/// </summary>
public interface IDashboardService
{
    /// <summary>
    /// Calcula os 4 cards do dashboard escopados por loja, comparando a janela atual
    /// (últimos 30 dias em UTC) com a janela anterior (os 30 dias imediatamente antes).
    /// </summary>
    Task<DashboardSummaryResponse> GetKpisAsync(Guid storeId, CancellationToken ct = default);
}

/// <summary>
/// Implementação MVP dos KPIs (§4.4). Todas as métricas usam <c>Where</c> + <c>CountAsync</c>/
/// <c>SumAsync</c> por janela (NUNCA <c>GroupBy(...).Select(new Dto(...))</c> — estoura no Npgsql,
/// RNF-01). O <c>delta</c> e a formatação do <c>value</c> são calculados em memória.
/// </summary>
public sealed class DashboardService(AppDbContext db) : IDashboardService
{
    public async Task<DashboardSummaryResponse> GetKpisAsync(Guid storeId, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var currentStart = now.AddDays(-30);
        var previousStart = now.AddDays(-60);

        // --- 1) Leads Recebidos (contagem por janela) ---
        var leadsCurrent = await db.Leads.AsNoTracking()
            .Where(l => l.StoreId == storeId && l.CreatedAt >= currentStart && l.CreatedAt < now)
            .CountAsync(ct);

        var leadsPrevious = await db.Leads.AsNoTracking()
            .Where(l => l.StoreId == storeId && l.CreatedAt >= previousStart && l.CreatedAt < currentStart)
            .CountAsync(ct);

        // --- 2) Anúncios Ativos (só IsActive — L24/Fase 5; delta = crescimento de criações ativas) ---
        var vehiclesTotal = await db.Vehicles.AsNoTracking()
            .Where(v => v.StoreId == storeId && v.IsActive)
            .CountAsync(ct);

        var vehiclesCreatedCurrent = await db.Vehicles.AsNoTracking()
            .Where(v => v.StoreId == storeId && v.IsActive && v.CreatedAt >= currentStart && v.CreatedAt < now)
            .CountAsync(ct);

        var vehiclesCreatedPrevious = await db.Vehicles.AsNoTracking()
            .Where(v => v.StoreId == storeId && v.IsActive && v.CreatedAt >= previousStart && v.CreatedAt < currentStart)
            .CountAsync(ct);

        // --- 3) Visualizações (soma total; delta = 0.0 no MVP, sem histórico por período) ---
        var viewsTotal = await db.Vehicles.AsNoTracking()
            .Where(v => v.StoreId == storeId)
            .SumAsync(v => (long)v.Views, ct);

        // --- 4) Taxa de Conversão (convertidos / total de leads na janela) ---
        var convertedCurrent = await db.Leads.AsNoTracking()
            .Where(l => l.StoreId == storeId && l.Status == LeadStatus.Convertido
                        && l.CreatedAt >= currentStart && l.CreatedAt < now)
            .CountAsync(ct);

        var convertedPrevious = await db.Leads.AsNoTracking()
            .Where(l => l.StoreId == storeId && l.Status == LeadStatus.Convertido
                        && l.CreatedAt >= previousStart && l.CreatedAt < currentStart)
            .CountAsync(ct);

        var convRateCurrent = leadsCurrent == 0 ? 0d : convertedCurrent * 100d / leadsCurrent;
        var convRatePrevious = leadsPrevious == 0 ? 0d : convertedPrevious * 100d / leadsPrevious;

        var cards = new List<DashboardKpiCard>
        {
            new("Leads Recebidos", FormatThousands(leadsCurrent),
                PercentDelta(leadsCurrent, leadsPrevious), "inbox"),

            new("Anúncios Ativos", FormatThousands(vehiclesTotal),
                PercentDelta(vehiclesCreatedCurrent, vehiclesCreatedPrevious), "car"),

            // delta 0.0 no MVP (limitação documentada — §4.4 / nota §8).
            new("Visualizações", FormatThousands(viewsTotal), 0.0, "eye"),

            // delta em PONTOS PERCENTUAIS (§4.4).
            new("Taxa de Conversão", $"{Round1(convRateCurrent).ToString("0.#", Inv)}%",
                Round1(convRateCurrent - convRatePrevious), "trending-up"),
        };

        return new DashboardSummaryResponse(cards);
    }

    private static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

    // Variação percentual vs. janela anterior, arredondada a 1 casa.
    // Base zero: 0 -> 0 = 0%; algo a partir de 0 = 100% (crescimento pleno).
    private static double PercentDelta(double current, double previous)
    {
        if (previous == 0) return current == 0 ? 0d : 100d;
        return Round1((current - previous) / previous * 100d);
    }

    private static double Round1(double v) => Math.Round(v, 1, MidpointRounding.AwayFromZero);

    // Formata milhares como "24.3k" (§4.4). Abaixo de 1000, número puro.
    private static string FormatThousands(long value)
    {
        if (value < 1000) return value.ToString(Inv);
        var thousands = value / 1000d;
        return $"{thousands.ToString("0.#", Inv)}k";
    }
}
