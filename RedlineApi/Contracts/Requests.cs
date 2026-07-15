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

/// <summary>
/// Payload de transição de status de lead (Fase 4 / RF-02 / §4.2).
/// O <c>StoreId</c> nunca vem daqui — é derivado do token (RNF-03). Só o novo <c>Status</c>.
/// <c>Status</c> desserializa de string honrando [Display(Name)] ("Em atendimento") via o
/// <c>DisplayNameEnumConverterFactory</c> global.
/// </summary>
public record UpdateLeadStatusRequest(
    LeadStatus Status);
