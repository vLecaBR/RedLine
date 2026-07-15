// --- HOOKS (Camada de Serviços) ---
// Vitrine/detalhe/vendedor: dados REAIS da RedlineApi via SWR.
// Leads/KPIs/roleta: ainda mockados (fases futuras).

import { useCallback, useState } from "react";
import useSWR from "swr";
import type { Vehicle, Lead, PublicSeller } from "./types";
import { fetcher, postJson, buildQuery, ApiError, type PagedResult } from "./lib/api";
import { LEADS, KPIS } from "./data/mocks";

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
// Leads (Fase 2) — criação real via POST /api/leads.
// ---------------------------------------------------------------------------

export interface CreateLeadInput {
  vehicleId: string;
  customerName: string;
  message: string;
}

/**
 * Mutação de criação de lead (RF-01). `POST /api/leads` via `postJson`,
 * que já traduz ProblemDetails para `ApiError` (400/404/409).
 */
export function useCreateLead() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const createLead = useCallback(async (input: CreateLeadInput): Promise<Lead> => {
    setLoading(true);
    setError(null);
    try {
      return await postJson<Lead>("/api/leads", input);
    } catch (e) {
      if (e instanceof ApiError) setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { createLead, loading, error };
}

/** Espera mínima para a animação da roleta "respirar" mesmo com resposta rápida da API. */
const ROULETTE_MIN_MS = 1400;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Distribuição de leads via servidor (§3.4). A "roleta" deixa de sortear no cliente:
 * `distribute` faz o `POST /api/leads` real e resolve com o `Lead` retornado (com o
 * `assignedSellerName` de verdade). A animação do front roda SOBRE essa resposta.
 *
 * Mantém a assinatura usada pela LeadRouletteSheet ({ loading, assignedSeller, distribute, reset }),
 * agora com `error` e `assignedSeller: Lead | null`.
 */
export function useLeadDistribution() {
  const { createLead } = useCreateLead();
  const [loading, setLoading] = useState(false);
  const [assignedSeller, setAssignedSeller] = useState<Lead | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const distribute = useCallback(
    async (vehicleId: string, customerName: string, message: string): Promise<Lead> => {
      setLoading(true);
      setAssignedSeller(null);
      setError(null);
      try {
        const [lead] = await Promise.all([
          createLead({ vehicleId, customerName, message }),
          delay(ROULETTE_MIN_MS), // mínimo visual (não é sorteio local)
        ]);
        setAssignedSeller(lead);
        return lead;
      } catch (e) {
        if (e instanceof ApiError) setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [createLead]
  );

  const reset = useCallback(() => {
    setAssignedSeller(null);
    setLoading(false);
    setError(null);
  }, []);

  return { loading, assignedSeller, error, distribute, reset };
}

// ---------------------------------------------------------------------------
// Mocks mantidos — fases futuras (Dashboard: Leads/KPIs).
// ---------------------------------------------------------------------------

export function useLeads(): Lead[] {
  return LEADS;
}

export function useKpis() {
  return KPIS;
}
