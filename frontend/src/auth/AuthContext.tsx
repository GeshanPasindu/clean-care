import type { PropsWithChildren } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { queryClient } from "../queryClient";
import {
  clearAccessToken,
  refreshSession,
  setAccessToken,
} from "../services/apiClient";
import { authService } from "../services/authService";
import type { SessionUser } from "../types/domain";
import { sessionUserSchema } from "../types/domain";
import type { LoginValues } from "../validation/forms";
interface AuthState {
  user: SessionUser | null;
  status: "loading" | "authenticated" | "unauthenticated";
  login: (values: LoginValues) => Promise<SessionUser>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<SessionUser>) => void;
  hasPermission: (key: string) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<AuthState["status"]>("loading");

  useEffect(() => {
    let mounted = true;
    const onUpdated = (event: Event) => {
      if (!mounted || !(event instanceof CustomEvent)) return;
      const parsed = sessionUserSchema.safeParse(event.detail);
      if (!parsed.success) return;
      setUser(parsed.data);
      setStatus("authenticated");
    };
    const onExpired = () => {
      if (!mounted) return;
      clearAccessToken();
      queryClient.clear();
      setUser(null);
      setStatus("unauthenticated");
    };

    window.addEventListener("cleancare:session-updated", onUpdated);
    window.addEventListener("cleancare:session-expired", onExpired);
    refreshSession()
      .then((session) => {
        if (mounted) {
          setUser(session.user);
          setStatus("authenticated");
        }
      })
      .catch(() => {
        if (mounted) {
          setUser(null);
          setStatus("unauthenticated");
        }
      });

    return () => {
      mounted = false;
      window.removeEventListener("cleancare:session-updated", onUpdated);
      window.removeEventListener("cleancare:session-expired", onExpired);
    };
  }, []);

  const login = useCallback(async (credentials: LoginValues) => {
    const data = await authService.login(credentials);
    setAccessToken(data.accessToken);
    queryClient.clear();
    setUser(data.user);
    setStatus("authenticated");
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      clearAccessToken();
      queryClient.clear();
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  const updateUser = useCallback((updates: Partial<SessionUser>) => {
    setUser((current) => (current ? { ...current, ...updates } : current));
  }, []);

  const hasPermission = useCallback(
    (permission: string) => Boolean(user?.permissions?.includes(permission)),
    [user],
  );

  const value = useMemo(
    () => ({ user, status, login, logout, updateUser, hasPermission }),
    [user, status, login, logout, updateUser, hasPermission],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
