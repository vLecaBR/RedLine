using System.ComponentModel.DataAnnotations;
using System.Linq.Expressions;
using System.Reflection;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Redline.Contracts;
using Redline.Data;
using Redline.Domain.Entities;
using Redline.Services;

namespace Redline.Endpoints;

public static class LeadEndpoints
{
    public static IEndpointRouteBuilder MapLeadEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api").WithTags("Leads");

        // Público (comprador anônimo — RF-05). Sem autenticação nesta fase.
        group.MapPost("/leads", CreateLead);

        // Protegidos (Fase 4 / RF-04): StoreStaff + escopo por StoreId do token.
        group.MapGet("/leads", GetLeads).RequireAuthorization("StoreStaff");
        group.MapPatch("/leads/{id:guid}/status", UpdateLeadStatus).RequireAuthorization("StoreStaff");

        return app;
    }

    // POST /api/leads  (Fase 2 — RF-01..RF-04)
    private static async Task<IResult> CreateLead(
        CreateLeadRequest request,
        AppDbContext db,
        ILeadDistributionService distribution,
        CancellationToken ct)
    {
        // --- Validação de entrada -> 400 ProblemDetails (RNF-02) ---
        if (request is null)
            return Problem(StatusCodes.Status400BadRequest, "Bad Request", "Corpo da requisição ausente.");

        if (request.VehicleId == Guid.Empty)
            return Problem(StatusCodes.Status400BadRequest, "Bad Request", "'vehicleId' é obrigatório.");

        var customerName = request.CustomerName?.Trim() ?? string.Empty;
        var message = request.Message?.Trim() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(customerName))
            return Problem(StatusCodes.Status400BadRequest, "Bad Request", "'customerName' é obrigatório.");
        if (string.IsNullOrWhiteSpace(message))
            return Problem(StatusCodes.Status400BadRequest, "Bad Request", "'message' é obrigatório.");

        // --- Carregar o veículo (leitura pura) ou 404 (RNF-03) ---
        var vehicle = await db.Vehicles.AsNoTracking()
            .Where(v => v.Id == request.VehicleId)
            .Select(v => new { v.Id, v.Title, v.StoreId })
            .FirstOrDefaultAsync(ct);

        if (vehicle is null)
            return Problem(StatusCodes.Status404NotFound, "Not Found",
                $"Veículo com id '{request.VehicleId}' não encontrado.");

        // --- Distribuição no servidor (round-robin por loja) ou 409 (RNF-04) ---
        Guid assignedSellerId;
        try
        {
            assignedSellerId = await distribution.PickSellerAsync(vehicle.StoreId, ct);
        }
        catch (NoSellersAvailableException ex)
        {
            return Problem(StatusCodes.Status409Conflict, "Conflict", ex.Message);
        }

        // --- Persistir o lead (Status = Novo, UTC — RNF-05) ---
        var now = DateTime.UtcNow;
        var lead = new Lead
        {
            VehicleId = vehicle.Id,
            StoreId = vehicle.StoreId,
            CustomerName = customerName,
            Message = message,
            AssignedSellerId = assignedSellerId,
            Status = LeadStatus.Novo,
            CreatedAt = now,
            UpdatedAt = now
        };

        db.Leads.Add(lead);
        await db.SaveChangesAsync(ct);

        var response = await ProjectByIdAsync(db, lead.Id, ct);
        return Results.Created($"/api/leads/{lead.Id}", response);
    }

    // GET /api/leads  (Fase 4 — RF-01 / §4.1)
    private static async Task<IResult> GetLeads(
        ClaimsPrincipal principal,
        ICurrentUserService currentUser,
        AppDbContext db,
        string? status = null,
        int page = 1,
        int pageSize = 20,
        CancellationToken ct = default)
    {
        // Escopo por loja: StoreId vem SEMPRE do token (RNF-03). Sem loja -> 403.
        var storeId = await ResolveStoreIdAsync(principal, currentUser, ct);
        if (storeId is null)
            return Forbidden();

        // Filtro opcional de status (parse tolerante ao [Display(Name)] — RNF-05).
        LeadStatus? statusEnum = null;
        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!TryParseDisplayEnum<LeadStatus>(status, out var s))
                return Problem(StatusCodes.Status400BadRequest, "Bad Request",
                    $"Valor '{status}' inválido para o parâmetro 'status'.");
            statusEnum = s;
        }

        page = page < 1 ? 1 : page;
        pageSize = Math.Clamp(pageSize, 1, 100); // teto 100 (§4.1)

        var query = db.Leads.AsNoTracking().Where(l => l.StoreId == storeId.Value);
        if (statusEnum.HasValue) query = query.Where(l => l.Status == statusEnum.Value);

        var totalItems = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(l => l.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(LeadProjection)
            .ToListAsync(ct);

        var totalPages = totalItems == 0 ? 0 : (int)Math.Ceiling(totalItems / (double)pageSize);
        return Results.Ok(new PagedResult<LeadResponse>(items, page, pageSize, totalItems, totalPages));
    }

    // PATCH /api/leads/{id}/status  (Fase 4 — RF-02 / §4.2 / §4.3)
    private static async Task<IResult> UpdateLeadStatus(
        Guid id,
        UpdateLeadStatusRequest request,
        ClaimsPrincipal principal,
        ICurrentUserService currentUser,
        AppDbContext db,
        CancellationToken ct)
    {
        var storeId = await ResolveStoreIdAsync(principal, currentUser, ct);
        if (storeId is null)
            return Forbidden();

        if (request is null)
            return Problem(StatusCodes.Status400BadRequest, "Bad Request", "Corpo da requisição ausente.");

        // Carrega COM tracking, filtrando por Id E StoreId. Lead de outra loja (ou inexistente)
        // cai no mesmo 404 — não vaza existência (§4.2).
        var lead = await db.Leads
            .FirstOrDefaultAsync(l => l.Id == id && l.StoreId == storeId.Value, ct);

        if (lead is null)
            return Problem(StatusCodes.Status404NotFound, "Not Found",
                $"Lead com id '{id}' não encontrado.");

        var target = request.Status;

        // Mesmo estado: no-op idempotente -> 200 sem alterar (§4.3).
        if (lead.Status != target)
        {
            if (!IsValidTransition(lead.Status, target))
                return Problem(StatusCodes.Status400BadRequest, "Bad Request",
                    $"Transição de status inválida: '{Display(lead.Status)}' -> '{Display(target)}'.");

            lead.Status = target;
            lead.UpdatedAt = DateTime.UtcNow; // RNF-08 (UTC)
            await db.SaveChangesAsync(ct);
        }

        var response = await ProjectByIdAsync(db, lead.Id, ct);
        return Results.Ok(response);
    }

    // --- Máquina de estados (§4.3) ---
    // Novo -> {Em atendimento, Convertido, Perdido}
    // Em atendimento -> {Convertido, Perdido}
    // Convertido/Perdido -> terminal (nada)
    private static bool IsValidTransition(LeadStatus from, LeadStatus to) => from switch
    {
        LeadStatus.Novo => to is LeadStatus.EmAtendimento or LeadStatus.Convertido or LeadStatus.Perdido,
        LeadStatus.EmAtendimento => to is LeadStatus.Convertido or LeadStatus.Perdido,
        _ => false // Convertido / Perdido são terminais
    };

    // --- Helpers ---

    // Projeção compartilhada Lead -> LeadResponse (RF-09): reusada por POST/GET/PATCH para
    // evitar divergência de contrato. Denormaliza Vehicle.Title e AssignedSeller.Name; sem e-mail (RNF-04).
    private static readonly Expression<Func<Lead, LeadResponse>> LeadProjection = l => new LeadResponse(
        l.Id,
        l.VehicleId,
        l.Vehicle != null ? l.Vehicle.Title : string.Empty,
        l.StoreId,
        l.CustomerName,
        l.Message,
        l.AssignedSellerId,
        l.AssignedSeller != null ? l.AssignedSeller.Name : string.Empty,
        l.Status,
        l.CreatedAt);

    private static Task<LeadResponse> ProjectByIdAsync(AppDbContext db, Guid id, CancellationToken ct) =>
        db.Leads.AsNoTracking()
            .Where(l => l.Id == id)
            .Select(LeadProjection)
            .FirstAsync(ct);

    // Resolve o StoreId do usuário logado via ICurrentUserService (RNF-03). null = autenticado sem loja.
    private static async Task<Guid?> ResolveStoreIdAsync(
        ClaimsPrincipal principal, ICurrentUserService currentUser, CancellationToken ct)
    {
        var me = await currentUser.GetAsync(principal, ct);
        return me?.StoreId;
    }

    private static IResult Forbidden() =>
        Problem(StatusCodes.Status403Forbidden, "Forbidden",
            "Usuário autenticado não está vinculado a uma loja.");

    private static IResult Problem(int statusCode, string title, string detail) =>
        Results.Problem(statusCode: statusCode, title: title, detail: detail);

    // Converte string -> enum honrando [Display(Name)] (RNF-05). Ex.: "Em atendimento" -> EmAtendimento.
    private static bool TryParseDisplayEnum<T>(string raw, out T value) where T : struct, Enum
    {
        foreach (var v in Enum.GetValues<T>())
        {
            var member = v.ToString();
            var display = typeof(T).GetMember(member).FirstOrDefault()
                ?.GetCustomAttribute<DisplayAttribute>()?.Name ?? member;

            if (string.Equals(raw, member, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(raw, display, StringComparison.OrdinalIgnoreCase))
            {
                value = v;
                return true;
            }
        }
        value = default;
        return false;
    }

    private static string Display(LeadStatus s)
    {
        var member = s.ToString();
        return typeof(LeadStatus).GetMember(member).FirstOrDefault()
            ?.GetCustomAttribute<DisplayAttribute>()?.Name ?? member;
    }
}
