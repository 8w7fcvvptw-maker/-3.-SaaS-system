// ============================================
// LAYOUT ПУБЛИЧНОЙ ЗОНЫ ЗАПИСИ (как кабинет: gray/zinc + dark)
// ============================================

import { useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/ui.jsx";

export default function BookingLayout({ children, currentStep = -1 }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams();

  const base = useMemo(
    () => (slug ? `/book/${slug}` : "/book/barbershop"),
    [slug]
  );

  const steps = useMemo(
    () => [
      { label: "Услуга", path: `${base}/services` },
      { label: "Мастер", path: `${base}/staff` },
      { label: "Время", path: `${base}/calendar` },
      { label: "Данные", path: `${base}/details` },
      { label: "Подтверждение", path: `${base}/confirm` },
    ],
    [base]
  );

  const stepPathOrder = useMemo(
    () => ["services", "staff", "calendar", "details", "confirm"],
    []
  );

  const inferredStep = useMemo(() => {
    const activePath = location.pathname.split("/").at(-1);
    return stepPathOrder.indexOf(activePath);
  }, [location.pathname, stepPathOrder]);

  const activeStep = currentStep >= 0 ? currentStep : inferredStep;

  const backPath = useMemo(() => {
    if (activeStep <= 0) return null;
    return `${base}/${stepPathOrder[activeStep - 1]}`;
  }, [activeStep, base, stepPathOrder]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-100/80 via-zinc-50 to-white dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900 font-sans text-gray-900 dark:text-zinc-100 antialiased">
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-zinc-900/95 backdrop-blur-sm border-b border-gray-200/90 dark:border-zinc-800">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => navigate(base)}
            className="flex items-center gap-2.5 text-gray-800 dark:text-zinc-200 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer min-w-0"
          >
            <span className="w-9 h-9 rounded-xl bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center shrink-0">
              <Icon name="scissors" className="w-4 h-4" />
            </span>
            <span className="font-semibold text-sm sm:text-base truncate">Онлайн-запись</span>
          </button>
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="text-xs text-gray-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            Войти как бизнес
          </button>
        </div>
      </header>

      {activeStep > 0 && (
        <div className="bg-white/90 dark:bg-zinc-900/85 border-b border-gray-200/90 dark:border-zinc-800">
          <div className="max-w-3xl mx-auto px-4 py-2">
            <button
              type="button"
              onClick={() => backPath && navigate(backPath)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-zinc-100 transition-colors"
            >
              <Icon name="chevronLeft" className="w-4 h-4" />
              Назад
            </button>
          </div>
        </div>
      )}

      {activeStep >= 0 && (
        <div className="bg-white/90 dark:bg-zinc-900/80 border-b border-gray-200/90 dark:border-zinc-800">
          <div className="max-w-3xl mx-auto px-4 py-3">
            <div className="flex items-center gap-1">
              {steps.map((step, i) => (
                <div key={step.path} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-1 flex-1">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                        i < activeStep
                          ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                          : i === activeStep
                            ? "bg-slate-900 text-white ring-2 ring-slate-200 dark:ring-zinc-600 dark:bg-zinc-100 dark:text-zinc-900"
                            : "bg-gray-200 text-gray-500 dark:bg-zinc-700 dark:text-zinc-400"
                      }`}
                    >
                      {i < activeStep ? <Icon name="checkCircle" className="w-3.5 h-3.5" /> : i + 1}
                    </div>
                    <span
                      className={`text-xs hidden sm:block ${
                        i === activeStep
                          ? "text-slate-900 dark:text-zinc-100 font-medium"
                          : "text-gray-500 dark:text-zinc-500"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 mx-1 mb-4 rounded ${
                        i < activeStep ? "bg-slate-900 dark:bg-zinc-100" : "bg-gray-200 dark:bg-zinc-600"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 py-6 md:py-10">{children}</main>
    </div>
  );
}
