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

/// <summary>
/// Ficha técnica flexível na entrada (Fase 5 / §4.6). Espelha o <see cref="CustomSpecsResponse"/>;
/// listas coalescidas para vazias no servidor. Todas as listas são opcionais no corpo.
/// </summary>
public record CustomSpecsRequest(
    List<string>? Engine,
    List<string>? Suspension,
    List<string>? Interior,
    bool HasDyno,
    int? ClaimedHp);

/// <summary>
/// Payload de criação de veículo (Fase 5 / RF-01 / §4.1). O cliente NÃO envia
/// <c>sellerId</c>/<c>storeId</c>/<c>views</c>/<c>isActive</c> — todos derivados no servidor (RNF-02).
/// <c>Transmission</c>/<c>Stage</c> desserializam de string honrando [Display(Name)]
/// via o <c>DisplayNameEnumConverterFactory</c> global (RNF-05).
/// </summary>
public record CreateVehicleRequest(
    string Title,
    string Brand,
    string Model,
    int Year,
    decimal Price,
    int Mileage,
    TransmissionType Transmission,
    BuildStage Stage,
    List<string> Images,
    string Location,
    CustomSpecsRequest? CustomSpecs);

/// <summary>
/// Payload de edição de veículo (Fase 5 / RF-02 / §4.6). Mesma forma do <see cref="CreateVehicleRequest"/>
/// (MVP: substituição total dos campos mutáveis). Imutáveis (<c>sellerId</c>/<c>storeId</c>/<c>views</c>/
/// <c>createdAt</c>/<c>isActive</c>) NÃO vêm daqui.
/// </summary>
public record UpdateVehicleRequest(
    string Title,
    string Brand,
    string Model,
    int Year,
    decimal Price,
    int Mileage,
    TransmissionType Transmission,
    BuildStage Stage,
    List<string> Images,
    string Location,
    CustomSpecsRequest? CustomSpecs);
