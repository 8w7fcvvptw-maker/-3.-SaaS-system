// ============================================
// LAYOUT ПУБЛИЧНОЙ ЗОНЫ ЗАПИСИ
// Чистый минималистичный вид для клиентов
// ============================================

import { useNavigate } from "react-router-dom";

// Шаги записи — показывают прогресс клиента
const steps = [
  { label: "Услуга",    path: "/book/services" },
  { label: "Мастер",    path: "/book/staff" },
  { label: "Время",     path: "/book/calendar" },
  { label: "Данные",    path: "/book/details" },
  { label: "Подтверждение", path: "/book/confirm" },
];

export default function BookingLayout({ children, currentStep = -1 }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50">
      {/* Шапка */}
      <header className="bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate("/book/barbershop")}
            className="flex items-center gap-2 text-gray-700 hover:text-indigo-600 transition-colors cursor-pointer"
          >
            <span className="text-xl">✂️</span>
            <span className="font-semibold">Barbershop Premium</span>
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          >
            Войти как бизнес →
          </button>
        </div>
      </header>

      {/* Прогресс-бар шагов (показывается только во время записи) */}
      {currentStep >= 0 && (
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-2xl mx-auto px-4 py-3">
            <div className="flex items-center gap-1">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-1 flex-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      i < currentStep  ? "bg-indigo-600 text-white" :
                      i === currentStep ? "bg-indigo-600 text-white ring-2 ring-indigo-200" :
                      "bg-gray-200 text-gray-400"
                    }`}>
                      {i < currentStep ? "✓" : i + 1}
                    </div>
                    <span className={`text-xs hidden sm:block ${i === currentStep ? "text-indigo-600 font-medium" : "text-gray-400"}`}>
                      {step.label}
                    </span>
                  </div>
                  {/* Линия между шагами */}
                  {i < steps.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-1 mb-4 rounded ${i < currentStep ? "bg-indigo-600" : "bg-gray-200"}`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Основной контент */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
