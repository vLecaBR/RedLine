// --- CAMADA DE API ---
// Cliente HTTP central. Base configurável via env; trata o formato de erro ProblemDetails (RFC 7807).
// Fase 3: TODA saída HTTP passa por `authFetch`, que injeta o Bearer da sessão do Supabase (RF-08).

import { supabase, getAccessToken } from "./supabase";

export const API_BASE: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:5000";

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export class ApiError extends Error {
  status: number;
  problem?: ProblemDetails;
  constructor(message: string, status: number, problem?: ProblemDetails) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.problem = problem;
  }
}

/**
 * Wrapper HTTP central (RF-08 / §2.4/L10). Injeta `Authorization: Bearer <access_token>`
 * quando há sessão do Supabase; endpoints públicos seguem funcionando sem token (a header
 * simplesmente não é enviada). Em `401`, limpa a sessão e sinaliza deslogado (RNF-01).
 */
export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  const token = await getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  // Token expirado/inválido em rota protegida -> encerra a sessão local (RNF-01).
  if (res.status === 401 && token) {
    await supabase.auth.signOut();
  }

  return res;
}

/** Extrai o ProblemDetails (RFC 7807) do corpo e lança um `ApiError` consistente. */
async function toApiError(res: Response): Promise<never> {
  let problem: ProblemDetails | undefined;
  try {
    problem = (await res.json()) as ProblemDetails;
  } catch {
    /* corpo não-JSON: mantém undefined */
  }
  throw new ApiError(problem?.detail ?? `Erro ${res.status}`, res.status, problem);
}

/** Fetcher genérico para o SWR. Lança ApiError com o detail do ProblemDetails em caso de falha. */
export async function fetcher<T>(path: string): Promise<T> {
  const res = await authFetch(path);
  if (!res.ok) return toApiError(res);
  return (await res.json()) as T;
}

/**
 * POST JSON genérico. Trata ProblemDetails (RFC 7807) igual ao `fetcher`,
 * lançando `ApiError` com o `detail` e o `status` para o chamador tratar (400/404/409).
 */
export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await authFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) return toApiError(res);

  // 201/200 com corpo JSON. (Não esperamos 204 aqui.)
  return (await res.json()) as T;
}

/**
 * PATCH JSON genérico (Fase 4). Espelha o `postJson`: injeta o Bearer via `authFetch`,
 * traduz ProblemDetails (RFC 7807) em `ApiError` com `detail`/`status` (400/403/404).
 * Usado pela transição de status do lead.
 */
export async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const res = await authFetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) return toApiError(res);

  return (await res.json()) as T;
}

/** Monta querystring a partir de um objeto, ignorando chaves vazias/undefined/null. */
export function buildQuery(
  params: Record<string, string | number | boolean | null | undefined>
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
