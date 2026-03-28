import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { signOut } from "../lib/api.js";
import { SAAS_API_FORBIDDEN, SAAS_API_UNAUTHORIZED } from "../lib/saasEvents.js";

/**
 * 401 → signOut и редирект на /login (если не на страницах входа).
 * 403 → баннер «Нет прав» + пояснение с сервера, если есть.
 */
export function AuthApiBridge() {
  const navigate = useNavigate();
  const location = useLocation();
  const handling401 = useRef(false);
  const [banner403, setBanner403] = useState(null);

  useEffect(() => {
    const on401 = async () => {
      if (handling401.current) return;
      handling401.current = true;
      try {
        await signOut();
      } catch {
        /* всё равно уводим на логин */
      }
      const path = location.pathname;
      if (path !== "/login" && path !== "/register") {
        navigate("/login", { replace: true, state: { from: location } });
      }
      setTimeout(() => {
        handling401.current = false;
      }, 800);
    };

    const on403 = (e) => {
      const extra = (e.detail?.message ?? "").trim();
      setBanner403({ extra });
    };

    window.addEventListener(SAAS_API_UNAUTHORIZED, on401);
    window.addEventListener(SAAS_API_FORBIDDEN, on403);
    return () => {
      window.removeEventListener(SAAS_API_UNAUTHORIZED, on401);
      window.removeEventListener(SAAS_API_FORBIDDEN, on403);
    };
  }, [navigate, location]);

  useEffect(() => {
    if (!banner403) return;
    const t = setTimeout(() => setBanner403(null), 7000);
    return () => clearTimeout(t);
  }, [banner403]);

  if (!banner403) return null;

  return (
    <div
      role="alert"
      className="fixed top-0 left-0 right-0 z-[100] flex justify-center px-3 pt-3 pointer-events-none"
    >
      <div className="pointer-events-auto max-w-lg w-full rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/90 text-amber-900 dark:text-amber-100 px-4 py-3 text-sm shadow-lg flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
        <span className="font-semibold shrink-0">Нет прав</span>
        {banner403.extra ? (
          <span className="text-amber-800 dark:text-amber-200/90 flex-1">{banner403.extra}</span>
        ) : null}
        <button
          type="button"
          onClick={() => setBanner403(null)}
          className="sm:ml-auto shrink-0 text-amber-700 dark:text-amber-300 hover:underline text-xs self-end sm:self-auto"
        >
          Закрыть
        </button>
      </div>
    </div>
  );
}
