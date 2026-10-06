import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5085/api";

export type ListMeta = { page: number; limit: number; total: number; totalPages: number };
export type Paginated<T> = { results: T[] } & ListMeta;

type Envelope<T> = { success: true; message: string; data: T; meta?: ListMeta };

type Problem = {
  type: string;
  title: string;
  status: number;
  detail: string;
  extensions?: { fields?: Record<string, string>; code?: string };
};

/** Fired on a 401 from anywhere but /auth: the session is gone, AuthProvider sends the user to login. */
export const UNAUTHORIZED_EVENT = "auth:unauthorized";

/**
 * A non-2xx response, carrying the RFC 7807 problem the server sent (docs/api.md §1.2).
 * `extensions.fields` only appears on 400s from Zod validation — a flat field→message map.
 */
export class ApiError extends Error {
  status: number;
  fields?: Record<string, string>;
  /** Machine-readable reason on some 4xx, e.g. PASSWORD_CHANGE_REQUIRED. */
  code?: string;

  constructor(status: number, body: unknown) {
    const problem = toProblem(status, body);
    super(problem.detail);
    this.name = "ApiError";
    this.status = status;
    this.fields = problem.extensions?.fields;
    this.code = problem.extensions?.code;
  }

  /** First rejection for a field, or undefined if that field was accepted — ready to attach to a form. */
  fieldError(field: string): string | undefined {
    return this.fields?.[field];
  }
}

function toProblem(status: number, body: unknown): Problem {
  if (body && typeof body === "object" && "detail" in body) {
    return body as Problem;
  }
  return {
    type: "about:blank",
    title: `Request failed with ${status}`,
    status,
    detail: typeof body === "string" && body ? body : `Request failed with status ${status}`,
  };
}

/**
 * Strip the success envelope so hooks/pages never see it. A paginated list
 * (`data` is an array with `meta` present) folds meta onto it as one object —
 * `{ results, page, limit, total, totalPages }` — instead of two.
 */
function unwrap<T>(raw: Envelope<unknown>): T {
  const { data, meta } = raw;
  if (meta && Array.isArray(data)) {
    return { results: data, ...meta } as T;
  }
  return data as T;
}

export async function apiFetch<T>(endpoint: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${endpoint}`, {
      ...init,
      credentials: "include", // the session cookie
      headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
    });
  } catch {
    // Network failure (server down, no connection) — not a Response at all, so it
    // must still surface as an ApiError: every caller relies on that shape (e.g. `.fieldError()`).
    throw new ApiError(0, "Could not reach the server. Check that it's running and try again.");
  }

  // The global rate limiter's 429 is plain text, the login lockout's is JSON (docs/api.md §1.2) —
  // either way read it as text first.
  if (res.status === 429) {
    const text = await res.text().catch(() => "Too many requests");
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* plain text */
    }
    throw new ApiError(429, body);
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !endpoint.startsWith("/auth/")) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(res.status, body);
  }
  return unwrap<T>(body as Envelope<unknown>);
}

type QueryOpts<T> = Omit<UseQueryOptions<T, ApiError>, "queryKey" | "queryFn">;
type MutationOpts<TData, TVars> = Omit<UseMutationOptions<TData, ApiError, TVars>, "mutationFn">;

/** GET. `useGetData<Paginated<House>>('/houses', ['houses'])` */
export function useGetData<T>(endpoint: string, key: unknown[], options?: QueryOpts<T>) {
  return useQuery<T, ApiError>({
    queryKey: key,
    queryFn: () => apiFetch<T>(endpoint),
    ...options,
  });
}

/** Shared mutation body — invalidates `key` on success so lists refetch. */
function useApiMutation<TData, TVars>(
  method: "POST" | "PATCH" | "DELETE",
  endpoint: string | ((vars: TVars) => string),
  key: unknown[],
  options?: MutationOpts<TData, TVars>
) {
  const queryClient = useQueryClient();
  const { onSuccess, ...rest } = options ?? {};

  return useMutation<TData, ApiError, TVars>({
    mutationFn: (vars) =>
      apiFetch<TData>(typeof endpoint === "function" ? endpoint(vars) : endpoint, {
        method,
        body: method === "DELETE" ? undefined : JSON.stringify(vars),
      }),
    onSuccess: (...args) => {
      void queryClient.invalidateQueries({ queryKey: key });
      onSuccess?.(...args);
    },
    ...rest,
  });
}

/** POST. Pass a function endpoint when the id lives in the path, e.g. `(id) => `/houses/${id}/deactivate`` */
export function usePostData<TData = unknown, TVars = unknown>(
  endpoint: string | ((vars: TVars) => string),
  key: unknown[],
  options?: MutationOpts<TData, TVars>
) {
  return useApiMutation<TData, TVars>("POST", endpoint, key, options);
}

/** PATCH — partial update. */
export function usePatchData<TData = unknown, TVars = unknown>(
  endpoint: string | ((vars: TVars) => string),
  key: unknown[],
  options?: MutationOpts<TData, TVars>
) {
  return useApiMutation<TData, TVars>("PATCH", endpoint, key, options);
}

/** DELETE. `useDelete<null, string>((id) => `/item-organizations/${id}`, ['item-organizations'])` */
export function useDelete<TData = unknown, TVars = unknown>(
  endpoint: string | ((vars: TVars) => string),
  key: unknown[],
  options?: MutationOpts<TData, TVars>
) {
  return useApiMutation<TData, TVars>("DELETE", endpoint, key, options);
}
