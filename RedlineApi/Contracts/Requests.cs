using Redline.Domain.Entities;

namespace Redline.Contracts;

/// <summary>
/// Payload público de criação de lead (Fase 2 / RF-01).
/// O cliente NÃO envia Tier nem StoreId — ambos são derivados do veículo no servidor (RF-02).
/// </summary>
public record CreateLeadRequest(
    Guid VehicleId,
    string CustomerName,
    string Message);
