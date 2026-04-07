import { useState, useEffect } from "react";
import { Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import { signInWithEmail, signUpWithEmail, createBusiness, getBusiness } from "../../lib/api.js";
import { withTimeout } from "../../lib/withTimeout.js";
import {
  validateLoginEmail,
  validateLoginPassword,
  validateRegisterEmail,
  validateRegisterPassword,
  validatePasswordRepeat,
} from "../../lib/authFormValidation.js";
import { Button, Card } from "../../components/ui.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { SAAS_BUSINESS_PROFILE_CHANGED } from "../../lib/saasEvents.js";
import { formatSupabaseAuthError } from "../../lib/formatSupabaseAuthError.js";

function inputClass(hasError) {
  const base =
    "w-full rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-white border transition-colors";
  return hasError
    ? `${base} border-red-500 dark:border-red-500 ring-1 ring-red-500/35 focus:outline-none focus:ring-2 focus:ring-red-500/50`
    : `${base} border-gray-200 dark:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-slate-400/40 focus:border-slate-400`;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { syncAuth, user, loading: authLoading } = useAuth();
  const from = location.state?.from?.pathname || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  if (!authLoading && user) {
    return <Navigate to={from} replace />;
  }

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const next = {
      email: validateLoginEmail(email),
      password: validateLoginPassword(password),
    };
    setFieldErrors(next);
    if (next.email || next.password) return;

    setPending(true);
    try {
      await signInWithEmail(email.trim(), password);
      await syncAuth();
      const biz = await withTimeout(getBusiness(), 20_000, "Таймаут загрузки салона");
      navigate(biz?.id ? from : "/onboarding", { replace: true });
    } catch (err) {
      setError(formatSupabaseAuthError(err, "Ошибка входа"));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50/80 dark:bg-zinc-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Вход</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Кабинет владельца салона</p>
        </div>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="login-email" className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: null }));
              }}
              className={inputClass(!!fieldErrors.email)}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? "login-email-err" : undefined}
            />
            {fieldErrors.email && (
              <p id="login-email-err" className="text-xs text-red-600 dark:text-red-400 mt-1">
                {fieldErrors.email}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="login-password" className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
              Пароль
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: null }));
              }}
              className={inputClass(!!fieldErrors.password)}
              aria-invalid={!!fieldErrors.password}
              aria-describedby={fieldErrors.password ? "login-password-err" : undefined}
            />
            {fieldErrors.password && (
              <p id="login-password-err" className="text-xs text-red-600 dark:text-red-400 mt-1">
                {fieldErrors.password}
              </p>
            )}
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 leading-relaxed" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full justify-center" disabled={pending}>
            {pending ? "Вход…" : "Войти"}
          </Button>
        </form>
        <p className="text-sm text-center text-gray-500 dark:text-gray-400">
          Нет аккаунта?{" "}
          <Link to="/register" className="text-slate-700 dark:text-zinc-300 font-medium hover:underline underline-offset-2">
            Регистрация
          </Link>
        </p>
      </Card>
    </div>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const { syncAuth, user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [pending, setPending] = useState(false);

  if (!authLoading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const next = {
      email: validateRegisterEmail(email),
      password: validateRegisterPassword(password),
      password2: validatePasswordRepeat(password, password2),
    };
    setFieldErrors(next);
    if (next.email || next.password || next.password2) return;

    setPending(true);
    try {
      const { session } = await signUpWithEmail(email.trim(), password);
      if (session) {
        await syncAuth();
        navigate("/onboarding", { replace: true });
      } else {
        setInfo("Проверьте почту: мы отправили ссылку для подтверждения email.");
      }
    } catch (err) {
      setError(formatSupabaseAuthError(err, "Ошибка регистрации"));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50/80 dark:bg-zinc-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Регистрация</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Создайте аккаунт владельца салона</p>
        </div>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="reg-email" className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
              Email
            </label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: null }));
              }}
              className={inputClass(!!fieldErrors.email)}
              aria-invalid={!!fieldErrors.email}
            />
            {fieldErrors.email && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.email}</p>
            )}
          </div>
          <div>
            <label htmlFor="reg-password" className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
              Пароль
            </label>
            <input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: null }));
              }}
              className={inputClass(!!fieldErrors.password)}
              aria-invalid={!!fieldErrors.password}
            />
            {fieldErrors.password && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.password}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">Не короче 8 символов</p>
          </div>
          <div>
            <label htmlFor="reg-password2" className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
              Повтор пароля
            </label>
            <input
              id="reg-password2"
              type="password"
              autoComplete="new-password"
              value={password2}
              onChange={(e) => {
                setPassword2(e.target.value);
                if (fieldErrors.password2) setFieldErrors((f) => ({ ...f, password2: null }));
              }}
              className={inputClass(!!fieldErrors.password2)}
              aria-invalid={!!fieldErrors.password2}
            />
            {fieldErrors.password2 && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.password2}</p>
            )}
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 leading-relaxed" role="alert">
              {error}
            </p>
          )}
          {info && <p className="text-sm text-emerald-600 dark:text-emerald-400">{info}</p>}
          <Button type="submit" className="w-full justify-center" disabled={pending}>
            {pending ? "Регистрация…" : "Зарегистрироваться"}
          </Button>
        </form>
        <p className="text-sm text-center text-gray-500 dark:text-gray-400">
          Уже есть аккаунт?{" "}
          <Link to="/login" className="text-slate-700 dark:text-zinc-300 font-medium hover:underline underline-offset-2">
            Войти
          </Link>
        </p>
      </Card>
    </div>
  );
}

const onboardingShellClass =
  "min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-900 text-gray-600 dark:text-gray-400 text-sm";

export function OnboardingPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  /** init — ждём auth + проверку БД; form — показываем форму */
  const [phase, setPhase] = useState("init");

  useEffect(() => {
    setPhase("init");
  }, [user?.id]);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const b = await withTimeout(getBusiness(), 20_000, "Таймаут загрузки салона");
        if (cancelled) return;
        if (b?.id) {
          navigate("/dashboard", { replace: true });
          return;
        }
      } catch {
        /* сеть / таймаут — показываем форму создания салона */
      }
      if (!cancelled) setPhase("form");
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await createBusiness({
        name,
        slug: slug.trim() || undefined,
      });
      window.dispatchEvent(new Event(SAAS_BUSINESS_PROFILE_CHANGED));
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err?.message ?? "Не удалось создать салон");
    } finally {
      setPending(false);
    }
  };

  if (!authLoading && !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (authLoading || phase !== "form") {
    return <div className={onboardingShellClass}>Загрузка…</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-50/80 dark:bg-zinc-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Ваш салон</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Название и адрес для онлайн-записи (латиница, например <code className="text-xs">my-barbershop</code>)
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Название</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
              required
              maxLength={200}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Slug (URL)</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="my-salon"
              className="w-full border border-gray-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
            />
            <p className="text-xs text-gray-400 mt-1">Страница записи: /book/ваш-slug</p>
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <Button type="submit" className="w-full justify-center" disabled={pending}>
            {pending ? "Сохранение…" : "Создать салон"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
