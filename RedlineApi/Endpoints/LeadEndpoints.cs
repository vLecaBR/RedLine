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

        return app;
    }

    // POST /api/leads  (RF-01..RF-04)
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
            .Select(v => new { v.Id, v.Title, v.Tier, v.StoreId })
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
            Tier = vehicle.Tier,
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

        // --- Nome do vendedor para a resposta denormalizada (RF-04). Sem vazar e-mail (RNF-10). ---
        var assignedSellerName = await db.Users.AsNoTracking()
            .Where(u => u.Id == assignedSellerId)
            .Select(u => u.Name)
            .FirstOrDefaultAsync(ct) ?? string.Empty;

        var response = new LeadResponse(
            lead.Id,
            lead.VehicleId,
            vehicle.Title,
            lead.Tier,
            lead.StoreId,
            lead.CustomerName,
            lead.Message,
            lead.AssignedSellerId,
            assignedSellerName,
            lead.Status,
            lead.CreatedAt);

        return Results.Created($"/api/leads/{lead.Id}", response);
    }

    private static IResult Problem(int statusCode, string title, string detail) =>
        Results.Problem(statusCode: statusCode, title: title, detail: detail);
}
