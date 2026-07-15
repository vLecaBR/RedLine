// --- HOOKS (Camada de Serviços) ---
// Vitrine/detalhe/vendedor: dados REAIS da RedlineApi via SWR.
// Leads/KPIs/roleta: ainda mockados (fases futuras).

import { useCallback, useEffect, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import type {
  Vehicle,
  Lead,
  PublicSeller,
  Me,
  Kpi,
  DashboardSummary,
  LeadStatus,
  VehicleFormInput,
} from "./types";
import {
  fetcher,
  postJson,
  patchJson,
  putJson,
  del,
  postVoid,
  buildQuery,
  ApiError,
  type PagedResult,
} from "./lib/api";
import { supabase } from "./lib/supabase";

export interface CarFilters {
  q?: string;
  filter?: string;
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

/**
 * Favoritos persistidos (Fase 6). Quando logado, lê `GET /api/me/favorites` (VehicleResponse[])
 * e as mutações batem em `POST`/`DELETE /api/me/favorites/{id}` (204), revalidando via SWR.
 * Deslogado: cai para estado local em memória (heart continua clicável, sem persistir).
 */
export function useFavorites() {
  const { isLoggedIn } = useMe();
  const key = isLoggedIn ? "/api/me/favorites" : null;
  const { data, isLoading, mutate } = useSWR<Vehicle[]>(key, fetcher);
  const [localIds, setLocalIds] = useState<string[]>([]);

  const serverVehicles = data ?? [];
  const ids = isLoggedIn ? serverVehicles.map((v) => v.id) : localIds;

  const isFavorite = useCallback((id: string) => ids.includes(id), [ids]);

  const toggleFavorite = useCallback(
    async (id: string): Promise<void> => {
      if (!isLoggedIn) {
        setLocalIds((prev) =>
          prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
        return;
      }
      const isFav = (data ?? []).some((v) => v.id === id);
      try {
        if (isFav) await del(`/api/me/favorites/${id}`);
        else await postVoid(`/api/me/favorites/${id}`);
      } finally {
        await mutate(); // revalida com a verdade do servidor
      }
    },
    [isLoggedIn, data, mutate]
  );

  return {
    favoriteVehicles: serverVehicles,
    favoriteIds: ids,
    isFavorite,
    toggleFavorite,
    loading: !!key && isLoading,
  };
}

/** Resolve favoritos via API a partir de uma lista de ids (fallback deslogado — RF-09). */
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
// Auth (Fase 3) — sessão do Supabase + GET /api/me.
// ---------------------------------------------------------------------------

/**
 * Estado da sessão do Supabase. `true`/`false` após o primeiro carregamento;
 * enquanto resolve, `hasSession` é `null` (evita "flash" de deslogado no reload).
 */
export function useSession() {
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setHasSession(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return hasSession;
}

/**
 * Usuário logado via `GET /api/me` (RF-09). A chave SWR só é ativada quando há sessão,
 * então deslogado não dispara request. Revalida automaticamente ao (des)logar.
 */
export function useMe() {
  const hasSession = useSession();
  const { data, error, isLoading, mutate } = useSWR<Me>(
    hasSession ? "/api/me" : null,
    fetcher
  );

  return {
    me: data ?? null,
    loading: hasSession === null || (!!hasSession && isLoading),
    error: error as ApiError | undefined,
    isLoggedIn: !!hasSession && !!data,
    hasSession: !!hasSession,
    mutate,
  };
}

/** Login por e-mail+senha e logout (RF-07). */
export function useAuthActions() {
  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return { signIn, signOut };
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
// Dashboard do Lojista (Fase 4) — Leads & KPIs REAIS, escopados por loja.
// ---------------------------------------------------------------------------

export interface LeadFilters {
  status?: LeadStatus;
  page?: number;
  pageSize?: number;
}

/** Chave SWR base da listagem de leads (usada para revalidar após a mutação de status). */
const LEADS_KEY_PREFIX = "/api/leads";

/**
 * Leads da loja logada (RF-06). `GET /api/leads` via SWR. A chave só é ativada quando há
 * sessão E o usuário tem loja (Buyer/deslogado NÃO dispara a chamada protegida — §6/8).
 * Retorna `{ leads, total, loading, error }`.
 */
export function useLeads(filters: LeadFilters = {}) {
  const { me, isLoggedIn } = useMe();
  const hasStore = isLoggedIn && !!me?.storeId;

  const key = hasStore
    ? `${LEADS_KEY_PREFIX}${buildQuery({ ...filters })}`
    : null;

  const { data, isLoading, error } = useSWR<PagedResult<Lead>>(key, fetcher);

  return {
    leads: data?.items ?? [],
    total: data?.totalItems ?? 0,
    loading: !!key && isLoading,
    error: error as ApiError | undefined,
  };
}

/**
 * Mutação de transição de status do lead (RF-07). `PATCH /api/leads/{id}/status` via `patchJson`.
 * Ao concluir, revalida TODAS as chaves de `/api/leads` (independe dos filtros ativos) via SWR.
 * Trata `ApiError` (400 transição inválida / 404 lead de outra loja).
 */
export function useUpdateLeadStatus() {
  const { mutate } = useSWRConfig();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const updateStatus = useCallback(
    async (id: string, status: LeadStatus): Promise<Lead> => {
      setLoading(true);
      setError(null);
      try {
        const updated = await patchJson<Lead>(`/api/leads/${id}/status`, { status });
        // Revalida qualquer chave de listagem de leads (com/sem filtros).
        await mutate(
          (key) => typeof key === "string" && key.startsWith(LEADS_KEY_PREFIX)
        );
        return updated;
      } catch (e) {
        if (e instanceof ApiError) setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [mutate]
  );

  return { updateStatus, loading, error };
}

/**
 * KPIs agregados da loja logada (RF-08). `GET /api/dashboard/kpis` via SWR. Chave só ativa
 * quando logado com loja. Retorna `{ cards, loading, error }` (lê `.cards`).
 */
export function useKpis() {
  const { me, isLoggedIn } = useMe();
  const hasStore = isLoggedIn && !!me?.storeId;

  const key = hasStore ? "/api/dashboard/kpis" : null;
  const { data, isLoading, error } = useSWR<DashboardSummary>(key, fetcher);

  return {
    cards: (data?.cards ?? []) as Kpi[],
    loading: !!key && isLoading,
    error: error as ApiError | undefined,
  };
}

// ---------------------------------------------------------------------------
// Estoque do Lojista (Fase 5) — inventário + CRUD (escopado por loja).
// ---------------------------------------------------------------------------

export type StoreVehicleStatus = "all" | "active" | "inactive";

export interface StoreVehicleFilters {
  status?: StoreVehicleStatus;
  page?: number;
  pageSize?: number;
}

/** Prefixo das chaves SWR que devem revalidar após uma escrita de veículo. */
const STORE_VEHICLES_KEY = "/api/store/vehicles";
const VEHICLES_KEY = "/api/vehicles";

/**
 * Inventário da loja logada (RF-04/§6.3). `GET /api/store/vehicles` via SWR. A chave só é
 * ativada quando há sessão E o usuário tem loja (Buyer/deslogado NÃO dispara — §6.7).
 */
export function useStoreVehicles(filters: StoreVehicleFilters = {}) {
  const { me, isLoggedIn } = useMe();
  const hasStore = isLoggedIn && !!me?.storeId;

  const key = hasStore
    ? `${STORE_VEHICLES_KEY}${buildQuery({ status: "all", ...filters })}`
    : null;

  const { data, isLoading, error } = useSWR<PagedResult<Vehicle>>(key, fetcher);

  return {
    vehicles: data?.items ?? [],
    total: data?.totalItems ?? 0,
    loading: !!key && isLoading,
    error: error as ApiError | undefined,
  };
}

/** Revalida todas as listagens afetadas por uma escrita: estoque E vitrine pública. */
function useRevalidateVehicles() {
  const { mutate } = useSWRConfig();
  return useCallback(
    () =>
      mutate(
        (key) =>
          typeof key === "string" &&
          (key.startsWith(STORE_VEHICLES_KEY) || key.startsWith(VEHICLES_KEY))
      ),
    [mutate]
  );
}

/**
 * Criação de veículo (RF-08). `POST /api/vehicles` via `postJson`. Revalida estoque + vitrine.
 * Trata `ApiError` (400 validação / 403 sem loja).
 */
export function useCreateVehicle() {
  const revalidate = useRevalidateVehicles();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const createVehicle = useCallback(
    async (input: VehicleFormInput): Promise<Vehicle> => {
      setLoading(true);
      setError(null);
      try {
        const created = await postJson<Vehicle>("/api/vehicles", input);
        await revalidate();
        return created;
      } catch (e) {
        if (e instanceof ApiError) setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [revalidate]
  );

  return { createVehicle, loading, error };
}

/**
 * Edição de veículo (RF-08). `PUT /api/vehicles/{id}` via `putJson`. Revalida estoque + vitrine.
 * Trata `ApiError` (400 / 403 / 404 de outra loja).
 */
export function useUpdateVehicle() {
  const revalidate = useRevalidateVehicles();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const updateVehicle = useCallback(
    async (id: string, input: VehicleFormInput): Promise<Vehicle> => {
      setLoading(true);
      setError(null);
      try {
        const updated = await putJson<Vehicle>(`/api/vehicles/${id}`, input);
        await revalidate();
        return updated;
      } catch (e) {
        if (e instanceof ApiError) setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [revalidate]
  );

  return { updateVehicle, loading, error };
}

/**
 * Arquivamento (soft-delete) de veículo (RF-09). `DELETE /api/vehicles/{id}` via `del`.
 * Revalida estoque + vitrine. Trata `ApiError` (403 / 404 de outra loja).
 */
export function useArchiveVehicle() {
  const revalidate = useRevalidateVehicles();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const archiveVehicle = useCallback(
    async (id: string): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        await del(`/api/vehicles/${id}`);
        await revalidate();
      } catch (e) {
        if (e instanceof ApiError) setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [revalidate]
  );

  return { archiveVehicle, loading, error };
}
