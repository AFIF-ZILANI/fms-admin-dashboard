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
  extensions?: { fields?: Record<string, string> };
};

/**
 * A non-2xx response, carrying the RFC 7807 problem the server sent (docs/api.md §1.2).
 * `extensions.fields` only appears on 400s from Zod validation — a flat field→message map.
 */
export class ApiError extends Error {
  status: number;
  fields?: Record<string, string>;

  constructor(status: number, body: unknown) {
    const problem = toProblem(status, body);
    super(problem.detail);
    this.name = "ApiError";
    this.status = status;
    this.fields = problem.extensions?.fields;
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

async function apiFetch<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...init,
    headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
  });

  // 429 is plain text, not JSON (docs/api.md §1.2) — must branch before res.json().
  if (res.status === 429) {
    throw new ApiError(429, await res.text().catch(() => "Too many requests"));
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
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
