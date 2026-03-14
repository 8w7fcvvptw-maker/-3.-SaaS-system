// ============================================
// ADMIN SAAS ПАНЕЛЬ
// Управление всеми бизнесами на платформе
// ============================================

import { useState } from "react";
import { Card, KpiCard, Badge, PageHeader } from "../../components/ui";
import { adminBusinesses, revenueData } from "../../data/mockData";

// Хелпер: цвет для плана
function PlanBadge({ plan }) {
  const colors = { Free: "gray", Pro: "indigo", Enterprise: "purple" };
  return <Badge color={colors[plan] || "gray"}>{plan}</Badge>;
}

// Хелпер: цвет для статуса бизнеса
function StatusDot({ status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm ${status === "active" ? "text-emerald-400" : "text-gray-500"}`}>
      <span className={`w-2 h-2 rounded-full ${status === "active" ? "bg-emerald-400" : "bg-gray-400"}`} />
      {status === "active" ? "Активен" : "Неактивен"}
    </span>
  );
}

// ── 3.1 Admin Dashboard (/admin) ──────────────────────────────
export function AdminDashboard() {
  const activeCount  = adminBusinesses.filter(b => b.status === "active").length;
  const proCount     = adminBusinesses.filter(b => b.plan === "Pro").length;
  const totalRevenue = adminBusinesses.reduce((s, b) => s + b.revenue, 0);
  const maxRevenue   = Math.max(...revenueData.map(d => d.revenue));

  return (
    <div>
      <PageHeader title="SaaS Дашборд" subtitle="Общая статистика платформы" />

      {/* KPI */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
          <div className="text-gray-400 text-sm mb-2">Всего бизнесов</div>
          <div className="text-2xl font-bold text-white">{adminBusinesses.length}</div>
          <div className="text-xs text-emerald-400 mt-1">↑ +2 за месяц</div>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
          <div className="text-gray-400 text-sm mb-2">Активных</div>
          <div className="text-2xl font-bold text-white">{activeCount}</div>
          <div className="text-xs text-gray-500 mt-1">из {adminBusinesses.length}</div>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
          <div className="text-gray-400 text-sm mb-2">Платных планов</div>
          <div className="text-2xl font-bold text-white">{proCount + adminBusinesses.filter(b => b.plan === "Enterprise").length}</div>
          <div className="text-xs text-indigo-400 mt-1">Pro + Enterprise</div>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
          <div className="text-gray-400 text-sm mb-2">MRR</div>
          <div className="text-2xl font-bold text-white">{totalRevenue.toLocaleString()} ₽</div>
          <div className="text-xs text-emerald-400 mt-1">↑ +18% к прошлому</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* График */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
          <h3 className="font-semibold text-white mb-4">Выручка платформы</h3>
          <div className="flex items-end gap-3 h-36">
            {revenueData.map(d => (
              <div key={d.month} className="flex flex-col items-center gap-1 flex-1">
                <div className="text-xs font-medium text-indigo-400">{(d.revenue / 1000).toFixed(0)}к</div>
                <div
                  className="w-full bg-indigo-500 rounded-t-md hover:bg-indigo-400 transition-colors"
                  style={{ height: `${(d.revenue / maxRevenue) * 100}px` }}
                />
                <div className="text-xs text-gray-500">{d.month}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Последние бизнесы */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
          <h3 className="font-semibold text-white mb-4">Новые бизнесы</h3>
          <div className="space-y-3">
            {adminBusinesses.slice(0, 4).map(b => (
              <div key={b.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center text-sm">🏢</div>
                  <div>
                    <div className="text-sm font-medium text-white">{b.name}</div>
                    <div className="text-xs text-gray-500">{b.created}</div>
                  </div>
                </div>
                <PlanBadge plan={b.plan} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 3.2 Список бизнесов (/admin/businesses) ───────────────────
export function AdminBusinesses() {
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState("all");

  const filtered = adminBusinesses.filter(b => {
    const matchSearch = b.name.toLowerCase().includes(search.toLowerCase());
    const matchPlan   = filterPlan === "all" || b.plan === filterPlan;
    return matchSearch && matchPlan;
  });

  return (
    <div>
      <PageHeader title="Бизнесы" subtitle={`${adminBusinesses.length} зарегистрировано`} />

      {/* Поиск и фильтры */}
      <div className="flex gap-3 mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск..."
          className="border border-gray-700 bg-gray-800 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-60"
        />
        {["all", "Free", "Pro", "Enterprise"].map(p => (
          <button
            key={p}
            onClick={() => setFilterPlan(p)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors cursor-pointer ${filterPlan === p ? "bg-indigo-600 text-white border-indigo-600" : "text-gray-400 border-gray-600 hover:border-gray-400"}`}
          >
            {p === "all" ? "Все" : p}
          </button>
        ))}
      </div>

      {/* Таблица */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              {["Бизнес", "Тариф", "Пользователи", "Создан", "Выручка", "Статус"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(b => (
              <tr key={b.id} className="border-b border-gray-700 hover:bg-gray-750 cursor-pointer" style={{ backgroundColor: "transparent" }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = "#374151"}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center text-sm">🏢</div>
                    <span className="font-medium text-white">{b.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3"><PlanBadge plan={b.plan} /></td>
                <td className="px-4 py-3 text-gray-300">{b.users}</td>
                <td className="px-4 py-3 text-gray-400">{b.created}</td>
                <td className="px-4 py-3 font-semibold text-white">{b.revenue.toLocaleString()} ₽</td>
                <td className="px-4 py-3"><StatusDot status={b.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 3.3 Тарифы (/admin/plans) ─────────────────────────────────
export function AdminPlans() {
  const plans = [
    {
      name: "Free",
      price: "0 ₽",
      period: "/мес",
      color: "border-gray-600",
      badge: "gray",
      features: ["1 сотрудник", "До 50 записей/мес", "Базовая аналитика", "Онлайн-запись"],
      notIncluded: ["SMS уведомления", "Расширенная аналитика", "API доступ"],
      count: adminBusinesses.filter(b => b.plan === "Free").length,
    },
    {
      name: "Pro",
      price: "2 990 ₽",
      period: "/мес",
      color: "border-indigo-500",
      badge: "indigo",
      popular: true,
      features: ["До 10 сотрудников", "Неограниченные записи", "SMS + Email", "Аналитика", "Кастомные шаблоны"],
      notIncluded: ["API доступ", "White-label"],
      count: adminBusinesses.filter(b => b.plan === "Pro").length,
    },
    {
      name: "Enterprise",
      price: "9 990 ₽",
      period: "/мес",
      color: "border-purple-500",
      badge: "purple",
      features: ["Неограниченно сотрудников", "Неограниченные записи", "SMS + Email + Push", "Полная аналитика", "API доступ", "White-label", "Приоритетная поддержка"],
      notIncluded: [],
      count: adminBusinesses.filter(b => b.plan === "Enterprise").length,
    },
  ];

  return (
    <div>
      <PageHeader title="Тарифные планы" subtitle="Управление тарифами платформы" />

      <div className="grid grid-cols-3 gap-4">
        {plans.map(p => (
          <div key={p.name} className={`bg-gray-800 border-2 ${p.color} rounded-xl p-6 relative`}>
            {p.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                Популярный
              </div>
            )}

            <div className="flex items-start justify-between mb-4">
              <div>
                <PlanBadge plan={p.name} />
                <div className="mt-2">
                  <span className="text-3xl font-bold text-white">{p.price}</span>
                  <span className="text-gray-400 text-sm">{p.period}</span>
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{p.count}</div>
                <div className="text-xs text-gray-400">клиентов</div>
              </div>
            </div>

            <ul className="space-y-2 mb-4">
              {p.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                  <span className="text-emerald-400">✓</span> {f}
                </li>
              ))}
              {p.notIncluded.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                  <span>✗</span> {f}
                </li>
              ))}
            </ul>

            <button className="w-full py-2 rounded-lg text-sm border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white transition-colors cursor-pointer">
              Редактировать тариф
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
