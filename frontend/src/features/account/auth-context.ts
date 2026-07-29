import { createContext, useContext } from "react";

import type { AccountUser } from "../../api/client";

export interface AuthContextValue {
  status: "loading" | "guest" | "authenticated" | "offline";
  user: AccountUser | null;
  syncNotice: string | null;
  clearSyncNotice: () => void;
  signIn: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  retry: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (value === null) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}
