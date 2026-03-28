// ============================================
// LAYOUT ПУБЛИЧНОЙ ЗОНЫ ЗАПИСИ (как кабинет: gray/zinc + dark)
// ============================================

import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function BookingLayout({ children, currentStep = -1 }) {
  const navigate = useNavigate();
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 font-sans text-gray-900 dark:text-zinc-100 antialiased">
      <header className="sticky top-0 z-10 bg-white/90 dark:bg-zinc-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-zinc-700 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(base)}
            className="flex items-center gap-2 text-gray-800 dark:text-zinc-200 hover:text-violet-600 dark:hover:text-violet-400 transition-colors cursor-pointer"
          >
            <span className="text-xl">✂️</span>
            <span className="font-semibold text-sm sm:text-base">Онлайн-запись</span>
          </button>
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="text-xs text-gray-500 dark:text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors cursor-pointer"
          >
            Войти как бизнес →
          </button>
        </div>
      </header>

      {currentStep >= 0 && (
        <div className="bg-white dark:bg-zinc-800/80 border-b border-gray-200 dark:border-zinc-700">
          <div className="max-w-2xl mx-auto px-4 py-3">
            <div className="flex items-center gap-1">
              {steps.map((step, i) => (
                <div key={step.path} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-1 flex-1">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        i < currentStep
                          ? "bg-violet-600 text-white dark:bg-violet-500"
                          : i === currentStep
                            ? "bg-violet-600 text-white ring-2 ring-violet-200 dark:ring-violet-800/60 dark:bg-violet-500"
                            : "bg-gray-200 text-gray-500 dark:bg-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      {i < currentStep ? "✓" : i + 1}
                    </div>
                    <span
                      className={`text-xs hidden sm:block ${
                        i === currentStep
                          ? "text-violet-600 dark:text-violet-400 font-medium"
                          : "text-gray-500 dark:text-zinc-500"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 mx-1 mb-4 rounded ${
                        i < currentStep ? "bg-violet-600 dark:bg-violet-500" : "bg-gray-200 dark:bg-zinc-600"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-4 md:py-8">{children}</main>
    </div>
  );
}
