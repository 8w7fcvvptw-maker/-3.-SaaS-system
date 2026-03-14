// ============================================
// LAYOUT ADMIN SAAS ПАНЕЛИ
// Управление всеми бизнесами на платформе
// ============================================

import { NavLink, useNavigate } from "react-router-dom";

const adminNav = [
  { to: "/admin",              icon: "📊", label: "Дашборд" },
  { to: "/admin/businesses",   icon: "🏢", label: "Бизнесы" },
  { to: "/admin/plans",        icon: "💳", label: "Тарифы" },
];

export default function AdminLayout({ children }) {
  const navigate = useNavigate();

  return (
    <div className="flex h-screen bg-gray-900 overflow-hidden">
      {/* Боковая панель (тёмная тема) */}
      <aside className="w-56 bg-gray-800 flex flex-col shrink-0">
        {/* Логотип */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛡️</span>
            <div>
              <div className="font-bold text-white text-sm">Администратор</div>
              <div className="text-xs text-gray-400">Платформа</div>
            </div>
          </div>
        </div>

        {/* Навигация */}
        <nav className="flex-1 p-3">
          <ul className="space-y-0.5">
            {adminNav.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === "/admin"}
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

        {/* Кнопка возврата */}
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
        {/* Шапка */}
        <header className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="text-sm text-gray-400">Административная панель</div>
          <div className="w-8 h-8 bg-violet-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">А</div>
        </header>

        {/* Контент */}
        <main className="flex-1 overflow-y-auto p-6 bg-gray-900">
          {children}
        </main>
      </div>
    </div>
  );
}
