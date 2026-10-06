import { createContext, useContext } from "react";

export type Me = {
  id: string;
  name: string;
  email: string | null;
  role: "ADMIN" | "EMPLOYEE" | "CUSTOMER" | "SUPPLIER" | "DOCTOR";
  employee_id: string | null;
  employee_role: string | null;
  must_change_password: boolean;
};

export const ME_KEY = ["auth", "me"];

export type AuthContextValue = {
  /** null = signed out. */
  me: Me | null;
  isLoading: boolean;
  /** Set when /auth/me failed for a reason other than "not signed in" (server down). */
  error: Error | null;
  refetch: () => void;
  login: (email: string, password: string) => Promise<Me>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
