import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { clearAccessToken, refreshSession, setAccessToken } from "../services/apiClient";
import { authService } from "../services/authService";
import { queryClient } from "../queryClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let mounted = true;
    const onUpdated = (event) => {
      if (!mounted || !event.detail) return;
      setUser(event.detail);
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

  const login = useCallback(async (credentials) => {
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

  const updateUser = useCallback((updates) => {
    setUser((current) => current ? { ...current, ...updates } : current);
  }, []);

  const value = useMemo(() => ({ user, status, login, logout, updateUser }), [user, status, login, logout, updateUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
