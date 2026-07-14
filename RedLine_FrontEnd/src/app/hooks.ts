// --- HOOKS (Camada de Serviços) ---
// Vitrine/detalhe/vendedor: dados REAIS da RedlineApi via SWR.
// Leads/KPIs/roleta: ainda mockados (fases futuras).

import { useState } from "react";
import useSWR from "swr";
import type { Vehicle, User, Lead, PublicSeller } from "./types";
import { fetcher, buildQuery, type PagedResult } from "./lib/api";
import { LEADS, SELLERS, KPIS } from "./data/mocks";

export interface CarFilters {
  q?: string;
  filter?: string;
  tier?: string;
  transmission?: string;
  minPrice?: number;
  maxPrice?: number;
  sellerId?: string;
  storeId?: string;
  sort?: "recent" | "priceAsc" | "priceDesc" | "views";
  page?: number;
  pageSize?: number;
}

export interface BrandFacet {
  brand: string;
  count: number;
}

/**
 * Lista da vitrine. O filtro/busca/ordenação agora é server-side (query params).
 * Mantém a assinatura { cars, loading } para não quebrar a HomePage; expõe `error` e `total`.
 */
export function useCars(filters: CarFilters = {}) {
  const query = buildQuery({ filter: "Todos", ...filters });
  const { data, isLoading, error } = useSWR<PagedResult<Vehicle>>(
    `/api/vehicles${query}`,
    fetcher
  );
  return {
    cars: data?.items ?? [],
    total: data?.totalItems ?? 0,
    loading: isLoading,
    error,
  };
}

/** Catálogo de marcas dinâmico (RF-06/RF-08). */
export function useBrands() {
  const { data, isLoading, error } = useSWR<BrandFacet[]>(
    "/api/vehicles/brands",
    fetcher
  );
  return { brands: data ?? [], loading: isLoading, error };
}

/** Anúncios de um vendedor, paginado (RF-07/RF-10). */
export function useSellerVehicles(id?: string, page = 1, pageSize = 12) {
  const { data, isLoading, error } = useSWR<PagedResult<Vehicle>>(
    id ? `/api/sellers/${id}/vehicles${buildQuery({ page, pageSize })}` : null,
    fetcher
  );
  return {
    cars: data?.items ?? [],
    total: data?.totalItems ?? 0,
    loading: isLoading,
    error,
  };
}

/** Resolve favoritos via API a partir de uma lista de ids (RF-09). */
export function useVehiclesByIds(ids: string[]) {
  const key = ids.length ? `/api/vehicles${buildQuery({ pageSize: 50 })}` : null;
  const { data, isLoading, error } = useSWR<PagedResult<Vehicle>>(key, fetcher);
  const cars = (data?.items ?? []).filter((v) => ids.includes(v.id));
  return { cars, loading: isLoading, error };
}

/** Detalhe de um veículo. Assíncrono (antes era síncrono sobre o mock). */
export function useCar(id?: string) {
  const { data, isLoading, error } = useSWR<Vehicle>(
    id ? `/api/vehicles/${id}` : null,
    fetcher
  );
  return { vehicle: data, loading: isLoading, error };
}

/** Vendedor público. Traz `vehicleCount` — substitui useSellerVehicleCount. */
export function useSeller(id?: string) {
  const { data, isLoading, error } = useSWR<PublicSeller>(
    id ? `/api/sellers/${id}` : null,
    fetcher
  );
  return { seller: data, loading: isLoading, error };
}

// ---------------------------------------------------------------------------
// Mocks mantidos — fases futuras (Leads, Dashboard, Roleta).
// ---------------------------------------------------------------------------

export function useLeads(): Lead[] {
  return LEADS;
}

export function useKpis() {
  return KPIS;
}

/**
 * Simula a "roleta" de distribuição de leads: sorteia um consultor.
 * Retorna o vendedor sorteado após uma simulação de processamento.
 */
export function useLeadDistribution() {
  const [loading, setLoading] = useState(false);
  const [assignedSeller, setAssignedSeller] = useState<User | null>(null);

  const distribute = () => {
    setLoading(true);
    setAssignedSeller(null);
    return new Promise<User>((resolve) => {
      setTimeout(() => {
        const picked = SELLERS[Math.floor(Math.random() * SELLERS.length)];
        setAssignedSeller(picked);
        setLoading(false);
        resolve(picked);
      }, 2200);
    });
  };

  const reset = () => {
    setAssignedSeller(null);
    setLoading(false);
  };

  return { loading, assignedSeller, distribute, reset };
}
