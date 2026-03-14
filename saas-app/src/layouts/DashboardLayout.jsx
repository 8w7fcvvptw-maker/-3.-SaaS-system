// ============================================
// LAYOUT КАБИНЕТА БИЗНЕСА
// На десктопе: боковое меню слева
// На мобильном: нижняя навигация (5 пунктов) + скрытое меню
// ============================================

import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

const navItems = [
  { to: "/dashboard",    icon: "📊", label: "Дашборд" },
  { to: "/calendar",     icon: "📅", label: "Календарь" },
  { to: "/appointments", icon: "📋", label: "Записи" },
  { to: "/clients",      icon: "👥", label: "Клиенты" },
  { to: "/services",     icon: "✂️",  label: "Услуги" },
  { to: "/staff",        icon: "👤", label: "Сотрудники" },
  { to: "/messages",     icon: "💬", label: "Уведомления" },
  { to: "/analytics",    icon: "📈", label: "Аналитика" },
  { to: "/settings",     icon: "⚙️",  label: "Настройки" },
];

// Первые 4 пункта + «Ещё» для нижней мобильной панели
const mobileBottomNav = navItems.slice(0, 4);

export default function DashboardLayout({ children }) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-zinc-900 overflow-hidden">

      {/* ════════════════════════════════════
          ДЕСКТОП: боковая панель (скрыта на мобильном)
      ════════════════════════════════════ */}
      <aside className="hidden md:flex w-56 bg-white dark:bg-zinc-800 border-r border-gray-200 dark:border-zinc-700 flex-col shrink-0">

        <div className="p-4 border-b border-gray-200 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✂️</span>
            <div>
              <div className="font-bold text-gray-900 dark:text-white text-sm leading-tight">Барбершоп</div>
              <div className="text-xs text-gray-400 dark:text-zinc-500">Премиум</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto">
          <ul className="space-y-0.5">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? "bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-medium"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 hover:text-gray-900 dark:hover:text-white"
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

        <div className="p-3 border-t border-gray-200 dark:border-zinc-700 space-y-1">
          <button
            onClick={() => navigate("/book/barbershop")}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer"
          >
            🔗 Публичная страница
          </button>
          <button
            onClick={() => navigate("/admin")}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer"
          >
            🛡️ Панель администратора
          </button>
        </div>
      </aside>

      {/* ════════════════════════════════════
          ОСНОВНАЯ ЗОНА
      ════════════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Шапка */}
        <header className="bg-white dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 px-4 py-3 flex items-center justify-between shrink-0">
          {/* Логотип на мобильном */}
          <div className="flex items-center gap-2 md:hidden">
            <span className="text-xl">✂️</span>
            <span className="font-bold text-gray-900 dark:text-white text-sm">Барбершоп</span>
          </div>
          {/* Подпись на десктопе */}
          <div className="hidden md:block text-sm text-gray-500 dark:text-gray-400">Кабинет бизнеса</div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              {theme === "light" ? "🌙" : "☀️"}
            </button>
            <button className="relative text-gray-400 dark:text-gray-300 cursor-pointer p-1">
              🔔
              <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center leading-none">3</span>
            </button>
            <div className="w-8 h-8 bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 rounded-full flex items-center justify-center text-sm font-semibold">А</div>
          </div>
        </header>

        {/* Контент — на мобильном оставляет место под нижнюю панель */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          {children}
        </main>
      </div>

      {/* ════════════════════════════════════
          МОБИЛЬНЫЙ: нижняя навигация
      ════════════════════════════════════ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-800 border-t border-gray-200 dark:border-zinc-700 z-50">
        <div className="flex">
          {/* 4 основных пункта */}
          {mobileBottomNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs transition-colors ${
                  isActive
                    ? "text-violet-600 dark:text-violet-400"
                    : "text-gray-400 dark:text-gray-500"
                }`
              }
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="leading-none">{item.label}</span>
            </NavLink>
          ))}

          {/* Кнопка «Ещё» — открывает полное меню */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs text-gray-400 dark:text-gray-500 cursor-pointer"
          >
            <span className="text-lg leading-none">☰</span>
            <span className="leading-none">Ещё</span>
          </button>
        </div>
      </nav>

      {/* ════════════════════════════════════
          МОБИЛЬНЫЙ: выдвижное меню «Ещё»
      ════════════════════════════════════ */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Затемнение фона */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Панель меню */}
          <div className="relative bg-white dark:bg-zinc-800 rounded-t-2xl p-4 pb-6">
            {/* Ручка */}
            <div className="w-10 h-1 bg-gray-300 dark:bg-zinc-600 rounded-full mx-auto mb-4" />

            <div className="grid grid-cols-3 gap-3 mb-4">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 p-3 rounded-xl text-xs transition-colors ${
                      isActive
                        ? "bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300"
                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700"
                    }`
                  }
                >
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-center leading-tight">{item.label}</span>
                </NavLink>
              ))}
            </div>

            <div className="border-t border-gray-100 dark:border-zinc-700 pt-3 flex gap-2">
              <button
                onClick={() => { navigate("/book/barbershop"); setMobileMenuOpen(false); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-700 rounded-lg"
              >
                🔗 Публичная страница
              </button>
              <button
                onClick={() => { navigate("/admin"); setMobileMenuOpen(false); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-700 rounded-lg"
              >
                🛡️ Администратор
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
