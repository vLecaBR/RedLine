// --- HOOKS (Camada de Serviços) ---
// Vitrine/detalhe/vendedor: dados REAIS da RedlineApi via SWR.
// Leads/KPIs/roleta: ainda mockados (fases futuras).

import { useState } from "react";
import useSWR from "swr";
import type { Vehicle, User, Lead, PublicSeller } from "./types";
import { fetcher, type PagedResult } from "./lib/api";
import { LEADS, SELLERS, KPIS } from "./data/mocks";

/**
 * Lista da vitrine. O filtro agora é server-side (query param) — sem filtragem no cliente.
 * Mantém a assinatura { cars, loading } para não quebrar a HomePage; expõe `error` opcionalmente.
 */
export function useCars(filter?: string) {
  const f = filter && filter.length > 0 ? filter : "Todos";
  const { data, isLoading, error } = useSWR<PagedResult<Vehicle>>(
    `/api/vehicles?filter=${encodeURIComponent(f)}`,
    fetcher
  );
  return { cars: data?.items ?? [], loading: isLoading, error };
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
