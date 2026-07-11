// --- CAMADA DE API ---
// Cliente HTTP central. Base configurável via env; trata o formato de erro ProblemDetails (RFC 7807).

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

/** Fetcher genérico para o SWR. Lança ApiError com o detail do ProblemDetails em caso de falha. */
export async function fetcher<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    let problem: ProblemDetails | undefined;
    try {
      problem = (await res.json()) as ProblemDetails;
    } catch {
      /* corpo não-JSON: mantém undefined */
    }
    throw new ApiError(problem?.detail ?? `Erro ${res.status}`, res.status, problem);
  }

  return (await res.json()) as T;
}
