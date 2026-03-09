"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { AppRole, normalizeRoles, pickPrimaryRole } from "@/lib/auth/roles";

type AuthUser = {
  id: string;
  phone: string;
  displayName: string | null;
  roles: AppRole[];
};

type AuthContextValue = {
  user: AuthUser | null;
  activeRole: AppRole | null;
  isLoading: boolean;
  setAuthUser: (nextUser: {
    id: string;
    phone: string;
    displayName?: string | null;
    roles: string[];
  }) => void;
  clearAuthUser: () => void;
  setActiveRole: (role: AppRole) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activeRole, setActiveRoleState] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        const payload = (await response.json()) as {
          success: boolean;
          user?: {
            id: string;
            phone: string;
            displayName?: string | null;
            roles: string[];
          };
        };

        if (!response.ok || !payload.success || !payload.user) {
          setUser(null);
          setActiveRoleState(null);
          return;
        }

        const roles = normalizeRoles(payload.user.roles);
        setUser({ ...payload.user, displayName: payload.user.displayName ?? null, roles });
        setActiveRoleState(pickPrimaryRole(roles));
      } catch {
        setUser(null);
        setActiveRoleState(null);
      } finally {
        setIsLoading(false);
      }
    };

    void loadSession();
  }, []);

  const setAuthUser = useCallback(
    (nextUser: {
      id: string;
      phone: string;
      displayName?: string | null;
      roles: string[];
    }) => {
      const roles = normalizeRoles(nextUser.roles);
      setUser({ ...nextUser, displayName: nextUser.displayName ?? null, roles });
      setActiveRoleState(pickPrimaryRole(roles));
    },
    [],
  );

  const clearAuthUser = useCallback(() => {
    setUser(null);
    setActiveRoleState(null);
  }, []);

  const setActiveRole = useCallback(
    (role: AppRole) => {
      if (!user || !user.roles.includes(role)) {
        return;
      }

      setActiveRoleState(role);
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      activeRole,
      isLoading,
      setAuthUser,
      clearAuthUser,
      setActiveRole,
    }),
    [user, activeRole, isLoading, setAuthUser, clearAuthUser, setActiveRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
