import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { supabase } from "../lib/supabase.js";
import { clearBusinessCache } from "../lib/api.js";

const AuthContext = createContext(null);

/** Страховка от вечной «Загрузка…», если колбэк Auth так и не вызовется (баг/расширение). */
const AUTH_LOADING_SAFETY_MS = 18_000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /** Прочитать сессию из клиента Supabase и обновить React (нужно сразу после signIn, до navigate). */
  const syncAuth = useCallback(async () => {
    try {
      // Без таймаута: сразу после signIn сессия уже в клиенте; таймаут мог бы обнулить user при лаге сети.
      const { data: { session } } = await supabase.auth.getSession();
      flushSync(() => {
        setUser(session?.user ?? null);
        setLoading(false);
      });
    } catch {
      flushSync(() => {
        setUser(null);
        setLoading(false);
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session) clearBusinessCache();
    });

    const safetyId = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, AUTH_LOADING_SAFETY_MS);

    return () => {
      cancelled = true;
      clearTimeout(safetyId);
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      syncAuth,
    }),
    [user, loading, syncAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
