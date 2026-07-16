using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Redline.Data;

namespace Redline.Observability;

/// <summary>
/// Readiness check (Fase 7 / RF-04): confirma que a API alcança o banco antes de receber tráfego.
/// Usa <c>CanConnectAsync</c> (barato, não materializa dados) em vez de depender de um pacote extra
/// de HealthChecks.EFCore, mantendo a árvore de dependências enxuta (RNF-08).
/// </summary>
public sealed class DatabaseHealthCheck(AppDbContext db) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            var reachable = await db.Database.CanConnectAsync(cancellationToken);
            return reachable
                ? HealthCheckResult.Healthy("Banco alcançável.")
                : HealthCheckResult.Unhealthy("Banco indisponível.");
        }
        catch (Exception ex)
        {
            // Detalhe do erro fica no HealthCheckResult (logado internamente); o corpo HTTP público
            // continua mínimo ({ status } — RNF-02), sem vazar a exceção ao cliente.
            return HealthCheckResult.Unhealthy("Falha ao conectar ao banco.", ex);
        }
    }
}
