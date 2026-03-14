// ============================================
// LAYOUT КАБИНЕТА БИЗНЕСА
// Боковая навигация + шапка + контент
// ============================================

import { NavLink, useNavigate } from "react-router-dom";

// Пункты навигации с иконками
const navItems = [
  { to: "/dashboard",   icon: "📊", label: "Дашборд" },
  { to: "/calendar",    icon: "📅", label: "Календарь" },
  { to: "/appointments",icon: "📋", label: "Записи" },
  { to: "/clients",     icon: "👥", label: "Клиенты" },
  { to: "/services",    icon: "✂️",  label: "Услуги" },
  { to: "/staff",       icon: "👤", label: "Сотрудники" },
  { to: "/messages",    icon: "💬", label: "Уведомления" },
  { to: "/analytics",   icon: "📈", label: "Аналитика" },
  { to: "/settings",    icon: "⚙️",  label: "Настройки" },
];

export default function DashboardLayout({ children }) {
  const navigate = useNavigate();

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* ---- Боковая панель навигации ---- */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
        {/* Логотип */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✂️</span>
            <div>
              <div className="font-bold text-gray-900 text-sm leading-tight">Barbershop</div>
              <div className="text-xs text-gray-400">Premium</div>
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
                        ? "bg-indigo-50 text-indigo-700 font-medium"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
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

        {/* Нижняя часть: ссылки переключения зон */}
        <div className="p-3 border-t border-gray-200 space-y-1">
          <button
            onClick={() => navigate("/book/barbershop")}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-500 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            🔗 Публичная страница
          </button>
          <button
            onClick={() => navigate("/admin")}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-500 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            🛡️ Admin SaaS
          </button>
        </div>
      </aside>

      {/* ---- Основная зона ---- */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Верхняя шапка */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="text-sm text-gray-500">Кабинет бизнеса</div>
          <div className="flex items-center gap-3">
            <button className="relative text-gray-400 hover:text-gray-600 cursor-pointer">
              🔔
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">3</span>
            </button>
            <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-sm font-semibold">А</div>
          </div>
        </header>

        {/* Контент страницы — прокручивается */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
