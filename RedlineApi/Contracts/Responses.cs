using Redline.Domain.Entities;

namespace Redline.Contracts;

/// <summary>Ficha técnica flexível. Nunca é null no contrato (coalescida para objeto vazio).</summary>
public record CustomSpecsResponse(
    List<string> Engine,
    List<string> Suspension,
    List<string> Interior,
    bool HasDyno,
    int? ClaimedHp);

/// <summary>DTO público de veículo (espelha §2.1 da spec 01). Nunca serializar a entidade crua.</summary>
public record VehicleResponse(
    Guid Id,
    string Title,
    string Brand,
    string Model,
    int Year,
    decimal Price,
    int Mileage,
    TransmissionType Transmission,
    BuildStage Stage,
    VehicleTier Tier,
    List<string> Images,
    Guid SellerId,
    string Location,
    DateTime CreatedAt,
    int Views,
    CustomSpecsResponse CustomSpecs);

/// <summary>DTO público do vendedor (§2.3). Email NÃO é exposto.</summary>
public record SellerResponse(
    Guid Id,
    string Name,
    UserRole Role,
    string? AvatarUrl,
    int MemberSince,
    int VehicleCount);

/// <summary>Envelope de paginação genérico (§2.1).</summary>
public record PagedResult<T>(
    IReadOnlyList<T> Items,
    int Page,
    int PageSize,
    int TotalItems,
    int TotalPages);

/// <summary>Faceta de marca para o catálogo dinâmico (§4.2).</summary>
public record BrandFacetResponse(string Brand, int Count);
