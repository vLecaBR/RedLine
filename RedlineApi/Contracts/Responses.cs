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

/// <summary>
/// DTO de lead (Fase 2 / RF-04 — resolve D1). Denormaliza <c>VehicleTitle</c> e
/// <c>AssignedSellerName</c> para render direto no Dashboard. É um DTO de escrita/dashboard
/// (não listagem pública): expõe <c>StoreId</c>/<c>AssignedSellerId</c> por design, mas NUNCA
/// o e-mail do vendedor (RNF-10).
/// </summary>
public record LeadResponse(
    Guid Id,
    Guid VehicleId,
    string VehicleTitle,
    VehicleTier Tier,
    Guid StoreId,
    string CustomerName,
    string Message,
    Guid AssignedSellerId,
    string AssignedSellerName,
    LeadStatus Status,
    DateTime CreatedAt);

/// <summary>
/// DTO do usuário logado (Fase 3 / §4.1). Contrato do <c>GET /api/me</c>.
/// Por ser o PRÓPRIO usuário, PODE conter <c>Email</c> (RNF-06) — diferente do
/// <see cref="SellerResponse"/> público. <c>Role</c> serializa como string (RNF-07);
/// <c>AvatarUrl</c>/<c>StoreId</c>/<c>StoreName</c> são nullable (D3 — Buyer recém-provisionado).
/// </summary>
public record MeResponse(
    Guid Id,
    string Name,
    string Email,
    UserRole Role,
    string? AvatarUrl,
    int MemberSince,
    Guid? StoreId,
    string? StoreName);

/// <summary>
/// Card de KPI do Dashboard (Fase 4 / §4.4). <c>Value</c> é uma string JÁ formatada pelo
/// backend (milhares como <c>24.3k</c>, percentuais com <c>%</c>) para o front renderizar direto.
/// <c>Delta</c> é a variação (percentual ou pontos percentuais, conforme o card). <c>Icon</c>
/// usa as mesmas chaves que o front já mapeia (<c>inbox</c>/<c>car</c>/<c>eye</c>/<c>trending-up</c>).
/// </summary>
public record DashboardKpiCard(
    string Label,
    string Value,
    double Delta,
    string Icon);

/// <summary>Envelope do <c>GET /api/dashboard/kpis</c> (§4.4). Só agregados — nunca linhas brutas (RNF-04).</summary>
public record DashboardSummaryResponse(
    IReadOnlyList<DashboardKpiCard> Cards);
