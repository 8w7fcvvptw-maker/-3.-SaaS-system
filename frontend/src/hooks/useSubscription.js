import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getMyProfile } from '../lib/subscription.js';

/**
 * Хук для получения профиля с ролью и подпиской.
 * Кэширует результат пока пользователь не изменился.
 */
export function useSubscription() {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState({
    loading: true,
    profile: null,
    error: null,
  });

  const refresh = useCallback(async () => {
    if (!user) {
      setState({ loading: false, profile: null, error: null });
      return;
    }
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const profile = await getMyProfile();
      setState({ loading: false, profile, error: null });
    } catch (err) {
      setState({ loading: false, profile: null, error: err.message });
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      refresh();
    }
  }, [authLoading, refresh]);

  return {
    loading: authLoading || state.loading,
    profile: state.profile,
    role: state.profile?.role ?? null,
    subscription: state.profile?.subscription ?? null,
    hasActiveSubscription: state.profile?.hasActiveSubscription ?? false,
    isAdmin: state.profile?.role === 'admin',
    isBusiness: state.profile?.role === 'business',
    isClient: state.profile?.role === 'client',
    error: state.error,
    refresh,
  };
}
