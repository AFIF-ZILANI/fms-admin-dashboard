import { useEffect, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, UNAUTHORIZED_EVENT, apiFetch } from "@/lib/api";
import { AuthContext, ME_KEY, type Me } from "@/lib/auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery<Me | null, Error>({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return await apiFetch<Me>("/auth/me");
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // A 401 mid-session (expired, deactivated, password changed elsewhere): drop to the login page.
  useEffect(() => {
    const onUnauthorized = () => queryClient.setQueryData(ME_KEY, null);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [queryClient]);

  const login = async (email: string, password: string) => {
    const res = await apiFetch<{ profile: Me }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    queryClient.clear(); // nothing from a previous person's session
    queryClient.setQueryData(ME_KEY, res.profile);
    return res.profile;
  };

  const logout = async () => {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => undefined);
    queryClient.clear();
    queryClient.setQueryData(ME_KEY, null);
  };

  return (
    <AuthContext.Provider
      value={{ me: data ?? null, isLoading, error, refetch: () => void refetch(), login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
