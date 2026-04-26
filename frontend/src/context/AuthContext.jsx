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
import { getMyProfile } from "../lib/subscription.js";

const AuthContext = createContext(null);

/** Страховка от вечной «Загрузка…», если колбэк Auth так и не вызовется (баг/расширение). */
const AUTH_LOADING_SAFETY_MS = 18_000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);

  /** Прочитать сессию из клиента Supabase и обновить React (нужно сразу после signIn, до navigate). */
  const syncAuth = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const sessionUser = session?.user ?? null;
      flushSync(() => {
        setUser(sessionUser);
        setLoading(false);
      });
      if (sessionUser) {
        getMyProfile().then(setUserProfile).catch(() => {});
      } else {
        setUserProfile(null);
      }
    } catch {
      flushSync(() => {
        setUser(null);
        setLoading(false);
      });
      setUserProfile(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      setLoading(false);
      if (!session) {
        clearBusinessCache();
        setUserProfile(null);
      } else if (sessionUser) {
        getMyProfile().then(setUserProfile).catch(() => {});
      }
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
      userProfile,
      role: userProfile?.role ?? null,
      userType: userProfile?.userType ?? null,
      access: userProfile?.access ?? null,
      hasBusiness: userProfile?.hasBusiness ?? false,
      hasActiveSubscription: userProfile?.hasActiveSubscription ?? false,
      isAdmin: userProfile?.role === 'admin',
      isBusiness: userProfile?.userType === 'owner',
      isClient: userProfile?.userType === 'customer',
    }),
    [user, loading, syncAuth, userProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
