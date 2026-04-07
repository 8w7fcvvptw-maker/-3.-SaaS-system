// ============================================
// LAYOUT КАБИНЕТА БИЗНЕСА
// На десктопе: боковое меню слева
// На мобильном: нижняя навигация (5 пунктов) + скрытое меню
// ============================================

import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext.jsx";
import { useAsync } from "../hooks/useAsync.js";
import { getBusiness, signOut } from "../lib/api.js";

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
  const { user } = useAuth();
  const { data: biz } = useAsync(() => getBusiness(), true, [user?.id]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const publicBookPath = `/book/${biz?.slug ?? "barbershop"}`;
  const userEmail = user?.email ?? "";
  const userInitial = (userEmail[0] ?? "U").toUpperCase();

  const handleLogout = async () => {
    setAccountMenuOpen(false);
    try {
      await signOut();
    } catch {
      /* всё равно уходим на логин */
    }
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex h-screen bg-zinc-50/80 dark:bg-zinc-950 overflow-hidden">

      {/* ════════════════════════════════════
          ДЕСКТОП: боковая панель (скрыта на мобильном)
      ════════════════════════════════════ */}
      <aside className="hidden md:flex w-56 bg-white dark:bg-zinc-900 border-r border-gray-200/90 dark:border-zinc-800 flex-col shrink-0">

        <div className="p-4 border-b border-gray-200 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✂️</span>
            <div>
              <div className="font-bold text-gray-900 dark:text-white text-sm leading-tight">
                {biz?.name ?? "Мой салон"}
              </div>
              <div className="text-xs text-gray-400 dark:text-zinc-500">Кабинет</div>
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
                        ? "bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-medium"
                        : "text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800/80 hover:text-gray-900 dark:hover:text-white"
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
            type="button"
            onClick={() => navigate(publicBookPath)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer"
          >
            🔗 Публичная запись
          </button>
        </div>
      </aside>

      {/* ════════════════════════════════════
          ОСНОВНАЯ ЗОНА
      ════════════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Шапка */}
        <header className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm border-b border-gray-200/90 dark:border-zinc-800 px-4 py-3.5 flex items-center justify-between shrink-0">
          {/* Логотип на мобильном */}
          <div className="flex items-center gap-2 md:hidden">
            <span className="text-xl">✂️</span>
            <span className="font-bold text-gray-900 dark:text-white text-sm truncate max-w-[10rem]">
              {biz?.name ?? "Салон"}
            </span>
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
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(v => !v)}
                className="relative text-gray-400 dark:text-gray-300 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
              >
                🔔
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center leading-none">3</span>
              </button>
              {notificationsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)} aria-hidden="true" />
                  <div className="absolute right-0 top-full mt-1 w-72 bg-white dark:bg-zinc-900 border border-gray-200/90 dark:border-zinc-800 rounded-xl shadow-sm z-50 overflow-hidden">
                    <div className="p-3 border-b border-gray-100 dark:border-zinc-700 flex items-center justify-between">
                      <span className="font-semibold text-gray-900 dark:text-white text-sm">Уведомления</span>
                      <button
                        onClick={() => { setNotificationsOpen(false); navigate("/messages"); }}
                        className="text-xs text-slate-700 dark:text-zinc-300 hover:underline"
                      >
                        Все →
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {[
                        { id: 1, text: "Новая запись на завтра 10:00", time: "5 мин назад", unread: true },
                        { id: 2, text: "Клиент Иван подтвердил визит", time: "1 час назад", unread: true },
                        { id: 3, text: "Напоминание: 3 записи на сегодня", time: "2 часа назад", unread: true },
                      ].map((n) => (
                        <div
                          key={n.id}
                          className={`px-3 py-2.5 text-sm border-b border-gray-50 dark:border-zinc-800/80 last:border-0 hover:bg-gray-50/80 dark:hover:bg-zinc-800/50 cursor-pointer ${n.unread ? "bg-slate-50/80 dark:bg-zinc-800/40" : ""}`}
                          onClick={() => setNotificationsOpen(false)}
                        >
                          <div className="text-gray-900 dark:text-white">{n.text}</div>
                          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{n.time}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="relative">
              <button
                onClick={() => setAccountMenuOpen(v => !v)}
                className="w-8 h-8 bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-300 rounded-full flex items-center justify-center text-sm font-semibold hover:bg-gray-200 dark:hover:bg-zinc-600 transition-colors cursor-pointer"
              >
                {userInitial}
              </button>
              {accountMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setAccountMenuOpen(false)} aria-hidden="true" />
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-zinc-900 border border-gray-200/90 dark:border-zinc-800 rounded-xl shadow-sm z-50 overflow-hidden">
                    <div className="px-3 py-2 border-b border-gray-100 dark:border-zinc-700">
                      <div className="font-medium text-gray-900 dark:text-white text-sm">Аккаунт</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={userEmail}>
                        {userEmail || "—"}
                      </div>
                    </div>
                    <button
                      onClick={() => { setAccountMenuOpen(false); navigate("/settings"); }}
                      className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700"
                    >
                      ⚙️ Настройки
                    </button>
                    <button
                      onClick={() => { setAccountMenuOpen(false); navigate("/dashboard"); }}
                      className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700"
                    >
                      📊 Дашборд
                    </button>
                    <div className="border-t border-gray-100 dark:border-zinc-700">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        Выйти
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Контент — на мобильном оставляет место под нижнюю панель */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-20 md:pb-8">
          {children}
        </main>
      </div>

      {/* ════════════════════════════════════
          МОБИЛЬНЫЙ: нижняя навигация
      ════════════════════════════════════ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm border-t border-gray-200/90 dark:border-zinc-800 z-50">
        <div className="flex">
          {/* 4 основных пункта */}
          {mobileBottomNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs transition-colors ${
                  isActive
                    ? "text-slate-900 dark:text-zinc-100"
                    : "text-gray-400 dark:text-zinc-500"
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
                        ? "bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100"
                        : "text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800/80"
                    }`
                  }
                >
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-center leading-tight">{item.label}</span>
                </NavLink>
              ))}
            </div>

            <div className="border-t border-gray-100 dark:border-zinc-700 pt-3">
              <button
                type="button"
                onClick={() => {
                  navigate(publicBookPath);
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-700 rounded-lg"
              >
                🔗 Публичная запись
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
