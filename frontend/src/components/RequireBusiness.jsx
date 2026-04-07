import { useEffect, useRef } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAsync } from "../hooks/useAsync.js";
import { getBusiness } from "../lib/api.js";
import { SAAS_BUSINESS_PROFILE_CHANGED } from "../lib/saasEvents.js";
import { useAuth } from "../context/AuthContext.jsx";
import { withTimeout } from "../lib/withTimeout.js";

/** Сеть / Supabase могут отвечать дольше; E2E и прод согласованы с ожиданием дашборда (~45 с). */
const BIZ_LOAD_MS = 45_000;

/** После входа без строки в businesses — на /onboarding */
export function RequireBusiness({ children }) {
  const { user, loading: authLoading } = useAuth();
  const { data: biz, loading: bizLoading, execute, isError, error } = useAsync(
    () =>
      user
        ? withTimeout(getBusiness(), BIZ_LOAD_MS, "Таймаут загрузки салона")
        : Promise.resolve(null),
    true,
    [user?.id]
  );
  const executeRef = useRef(execute);
  executeRef.current = execute;

  useEffect(() => {
    const refresh = () => executeRef.current();
    window.addEventListener(SAAS_BUSINESS_PROFILE_CHANGED, refresh);
    return () => window.removeEventListener(SAAS_BUSINESS_PROFILE_CHANGED, refresh);
  }, []);

  if (authLoading || (user && bizLoading)) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-900 text-gray-600 dark:text-gray-400 text-sm"
      >
        Загрузка…
      </div>
    );
  }
  if (user && isError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-zinc-900 p-6 text-center">
        <p className="text-sm text-gray-700 dark:text-gray-300 max-w-md">
          Не удалось загрузить профиль салона. Проверьте интернет и антивирус (иногда режут запросы к Supabase).
        </p>
        {error?.message && (
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md">{error.message}</p>
        )}
        <button
          type="button"
          onClick={() => execute()}
          className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Повторить
        </button>
        <Link
          to="/login"
          className="text-sm text-slate-700 dark:text-zinc-300 hover:underline underline-offset-2"
        >
          На страницу входа
        </Link>
      </div>
    );
  }
  if (user && biz == null) {
    return <Navigate to="/onboarding" replace />;
  }
  return children;
}
