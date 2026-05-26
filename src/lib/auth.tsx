import { createContext, useContext, type ReactNode, useEffect, useState } from "react";
import { api } from "./api";

export type AppRole = string;

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: AppRole;
  avatar_url: string | null;
  teams_webhook_url: string | null;
  permissions: string[];
}

interface AuthContextValue {
  user: { id: string } | null;
  profile: Profile | null;
  loading: boolean;
  isManager: boolean;
  isAdmin: boolean;
  hasPermission: (resource: string, action: string) => boolean;
  setRole: (role: AppRole) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  isManager: false,
  isAdmin: false,
  hasPermission: () => false,
  setRole: () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleOverride, setRoleOverride] = useState<AppRole | null>(null);

  const fetchProfile = async () => {
    try {
      const data = await api.get("/auth/me");
      setUser({ id: data.id });
      setProfile({
          ...data,
          permissions: data.permissions || []
      } as Profile);
    } catch (err) {
      setUser(null);
      setProfile(null);
      localStorage.removeItem("access_token");
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      fetchProfile().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const effectiveRole = roleOverride ?? profile?.role ?? "admin";
  const perms = profile?.permissions || [];

  const handleSignOut = async () => {
    localStorage.removeItem("access_token");
    setUser(null);
    setProfile(null);
  };

  const hasPermission = (resource: string, action: string) => {
    if (effectiveRole === "admin") return true;
    return perms.includes(`${resource}:${action}`);
  };

  const value: AuthContextValue = {
    user,
    profile: profile ? { ...profile, role: effectiveRole } : null,
    loading,
    isManager: effectiveRole === "admin" || effectiveRole === "manager" || hasPermission("users", "manage"),
    isAdmin: effectiveRole === "admin",
    hasPermission,
    setRole: setRoleOverride,
    signOut: handleSignOut,
    refreshProfile: async () => {
      await fetchProfile();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
