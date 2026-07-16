using System.Diagnostics;

namespace Redline.Observability;

/// <summary>
/// Logging estruturado por request (Fase 7 / RF-09): abre um escopo com <c>TraceId</c> (correlação
/// com o <c>ProblemDetails.traceId</c> devolvido ao cliente) e registra método, rota, status e duração.
/// Sem PII no log (não loga corpo, query sensível nem headers de auth). Nível <c>Information</c> em
/// sucesso; <c>Warning</c> para 4xx e o próprio ExceptionHandler cuida dos 5xx.
/// </summary>
public sealed class RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var traceId = Activity.Current?.TraceId.ToString() ?? context.TraceIdentifier;

        using var scope = logger.BeginScope(new Dictionary<string, object>
        {
            ["TraceId"] = traceId,
            ["RequestMethod"] = context.Request.Method,
            ["RequestPath"] = context.Request.Path.Value ?? "/"
        });

        var sw = Stopwatch.GetTimestamp();
        try
        {
            await next(context);
        }
        finally
        {
            var elapsedMs = Stopwatch.GetElapsedTime(sw).TotalMilliseconds;
            var status = context.Response.StatusCode;

            var level = status >= 500 ? LogLevel.Error
                      : status >= 400 ? LogLevel.Warning
                      : LogLevel.Information;

            logger.Log(level,
                "HTTP {Method} {Path} respondeu {StatusCode} em {ElapsedMs:0.0} ms",
                context.Request.Method, context.Request.Path.Value, status, elapsedMs);
        }
    }
}
