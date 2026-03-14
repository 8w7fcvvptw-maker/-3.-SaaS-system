// ============================================
// LAYOUT КАБИНЕТА БИЗНЕСА
// Боковая навигация + шапка + контент
// Поддерживает светлую и тёмную тему
// ============================================

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

export default function DashboardLayout({ children }) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-zinc-900 overflow-hidden">

      {/* ---- Боковая панель ---- */}
      <aside className="w-56 bg-white dark:bg-zinc-800 border-r border-gray-200 dark:border-zinc-700 flex flex-col shrink-0">

        {/* Логотип / название */}
        <div className="p-4 border-b border-gray-200 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✂️</span>
            <div>
              <div className="font-bold text-gray-900 dark:text-white text-sm leading-tight">Барбершоп</div>
              <div className="text-xs text-gray-400 dark:text-zinc-500">Премиум</div>
            </div>
          </div>
        </div>

        {/* Пункты меню */}
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

        {/* Нижняя часть */}
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

      {/* ---- Основная зона ---- */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Верхняя шапка */}
        <header className="bg-white dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="text-sm text-gray-500 dark:text-gray-400">Кабинет бизнеса</div>
          <div className="flex items-center gap-3">
            {/* Переключатель темы */}
            <button
              onClick={toggleTheme}
              title={theme === "light" ? "Включить тёмную тему" : "Включить светлую тему"}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer text-base"
            >
              {theme === "light" ? "🌙" : "☀️"}
            </button>
            <button className="relative text-gray-400 dark:text-gray-300 hover:text-gray-600 cursor-pointer">
              🔔
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">3</span>
            </button>
            <div className="w-8 h-8 bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 rounded-full flex items-center justify-center text-sm font-semibold">А</div>
          </div>
        </header>

        {/* Контент */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
