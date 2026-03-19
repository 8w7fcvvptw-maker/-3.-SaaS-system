// ============================================
// LAYOUT ADMIN SAAS ПАНЕЛИ
// Десктоп: боковая панель | Мобильный: нижняя навигация
// ============================================

import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

const adminNav = [
  { to: "/admin",            icon: "📊", label: "Дашборд", end: true },
  { to: "/admin/businesses", icon: "🏢", label: "Бизнесы",  end: false },
  { to: "/admin/plans",      icon: "💳", label: "Тарифы",   end: false },
];

export default function AdminLayout({ children }) {
  const navigate = useNavigate();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-900 overflow-hidden">

      {/* Боковая панель — только десктоп */}
      <aside className="hidden md:flex w-56 bg-gray-800 flex-col shrink-0">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛡️</span>
            <div>
              <div className="font-bold text-white text-sm">Администратор</div>
              <div className="text-xs text-gray-400">Платформа</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3">
          <ul className="space-y-0.5">
            {adminNav.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? "bg-violet-600 text-white font-medium"
                        : "text-gray-300 hover:bg-gray-700 hover:text-white"
                    }`
                  }
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-3 border-t border-gray-700">
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:bg-gray-700 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            ← Кабинет бизнеса
          </button>
        </div>
      </aside>

      {/* Основная зона */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="md:hidden text-xl">🛡️</span>
            <div className="text-sm text-gray-400">Административная панель</div>
          </div>
          <div className="relative">
            <button
              onClick={() => setAccountMenuOpen(v => !v)}
              className="w-8 h-8 bg-violet-600 text-white rounded-full flex items-center justify-center text-sm font-semibold hover:bg-violet-500 transition-colors cursor-pointer"
            >
              А
            </button>
            {accountMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAccountMenuOpen(false)} aria-hidden="true" />
                <div className="absolute right-0 top-full mt-1 w-48 bg-gray-800 border border-gray-600 rounded-xl shadow-lg z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-600">
                    <div className="font-medium text-white text-sm">Администратор</div>
                    <div className="text-xs text-gray-400">admin@platform.ru</div>
                  </div>
                  <button
                    onClick={() => { setAccountMenuOpen(false); navigate("/dashboard"); }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700"
                  >
                    ✂️ Кабинет бизнеса
                  </button>
                  <div className="border-t border-gray-600">
                    <button
                      onClick={() => { setAccountMenuOpen(false); navigate("/book/barbershop"); }}
                      className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-gray-700"
                    >
                      Выйти
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6 bg-gray-900">
          {children}
        </main>
      </div>

      {/* Нижняя навигация — только мобильный */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-50">
        <div className="flex">
          {adminNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs transition-colors ${
                  isActive ? "text-violet-400" : "text-gray-500"
                }`
              }
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="leading-none">{item.label}</span>
            </NavLink>
          ))}
          <button
            onClick={() => navigate("/dashboard")}
            className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs text-gray-500 cursor-pointer"
          >
            <span className="text-lg leading-none">←</span>
            <span className="leading-none">Назад</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
