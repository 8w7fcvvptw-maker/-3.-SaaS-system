// ============================================
// ADMIN SAAS PANEL
// ============================================

import { useState } from "react";
import { Card, Badge, PageHeader, LoadingState, ErrorState } from "../../components/ui";
import { useAsync } from "../../hooks/useAsync";
import { getAdminBusinesses, getAdminStats, getPlans, updatePlan } from "../../lib/api";

function PlanBadge({ plan }) {
  const colors = { Free: "gray", Pro: "teal", Enterprise: "purple" };
  return <Badge color={colors[plan] || "gray"}>{plan}</Badge>;
}

function StatusDot({ status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm ${status === "active" ? "text-emerald-400" : "text-gray-500"}`}>
      <span className={`w-2 h-2 rounded-full ${status === "active" ? "bg-emerald-400" : "bg-gray-400"}`} />
      {status === "active" ? "Активно" : "Неактивно"}
    </span>
  );
}

export function AdminDashboard() {
  const { data: stats, loading, error } = useAsync(() => getAdminStats());
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error.message} />;

  return (
    <div>
      <PageHeader title="Дашборд SaaS" subtitle="Статистика платформы" />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 mb-6">
        {[
          ["Всего пользователей", stats?.totalUsers ?? 0, "text-gray-500", "Платформа"],
          ["Бизнес-аккаунтов", stats?.totalBusinessUsers ?? 0, "text-gray-500", "Owner-контур"],
          ["Активных подписок", stats?.activeSubscriptions ?? 0, "text-teal-400", "trial + active"],
          ["Выручка", `${Number(stats?.totalRevenue ?? 0).toLocaleString()} ₽`, "text-gray-500", "По оплатам"],
        ].map(([label, value, trendColor, trendText]) => (
          <div key={label} className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <div className="text-gray-400 text-sm mb-2">{label}</div>
            <div className="text-2xl font-bold text-white">{value}</div>
            <div className={`text-xs mt-1 ${trendColor}`}>{trendText}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminBusinesses() {
  const [search, setSearch]         = useState("");
  const [filterPlan, setFilterPlan] = useState("all");

  const { data, loading, error } = useAsync(() => getAdminBusinesses());

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error.message} />;

  const businesses = data ?? [];
  const filtered   = businesses.filter(b => {
    const matchSearch = b.name.toLowerCase().includes(search.toLowerCase());
    const matchPlan   = filterPlan === "all" || b.plan === filterPlan;
    return matchSearch && matchPlan;
  });

  return (
    <div>
      <PageHeader title="Бизнесы" subtitle={`${businesses.length} зарегистрировано`} />

      <div className="flex gap-3 mb-4 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск..."
          className="border border-gray-700 bg-gray-800 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/70 w-60" />
        {["all", "Free", "Pro", "Enterprise"].map(p => (
          <button key={p} onClick={() => setFilterPlan(p)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors cursor-pointer ${filterPlan === p ? "bg-white text-gray-900 border-white" : "text-gray-400 border-gray-600 hover:border-gray-400"}`}>
            {p === "all" ? "Все" : p}
          </button>
        ))}
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr className="border-b border-gray-700">
              {["Бизнес", "Тариф", "Пользователи", "Дата", "Выручка", "Статус"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(b => (
              <tr key={b.id} className="border-b border-gray-700 cursor-pointer" style={{ backgroundColor: "transparent" }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = "#374151"}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center text-sm">🏢</div>
                    <span className="font-medium text-white">{b.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3"><PlanBadge plan={b.plan} /></td>
                <td className="px-4 py-3 text-gray-300">{b.users}</td>
                <td className="px-4 py-3 text-gray-400">{b.created}</td>
                <td className="px-4 py-3 font-semibold text-white">{(b.revenue ?? 0).toLocaleString()} ₽</td>
                <td className="px-4 py-3"><StatusDot status={b.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const INITIAL_PLANS = [
  {
    name: "Free", price: "0 ₽", period: "/мес", color: "border-gray-600",
    features: ["1 сотрудник", "До 50 записей/мес", "Базовая аналитика", "Онлайн-запись"],
    notIncluded: ["SMS уведомления", "Расширенная аналитика", "Доступ к API"],
  },
  {
    name: "Pro", price: "2 990 ₽", period: "/мес", color: "border-slate-500", popular: true,
    features: ["До 10 сотрудников", "Безлимит записей", "SMS + Email", "Аналитика", "Свои шаблоны"],
    notIncluded: ["Доступ к API", "White-label"],
  },
  {
    name: "Enterprise", price: "9 990 ₽", period: "/мес", color: "border-zinc-500",
    features: ["Безлимит сотрудников", "Безлимит записей", "SMS + Email + Push", "Полная аналитика", "Доступ к API", "White-label", "Приоритетная поддержка"],
    notIncluded: [],
  },
];

function normalizePlan(p) {
  return {
    ...p,
    features: p.features ?? [],
    notIncluded: p.not_included ?? p.notIncluded ?? [],
  };
}

export function AdminPlans() {
  const { data: businessesData, loading: bizLoading, error: bizError } = useAsync(() => getAdminBusinesses());
  const { data: plansData, loading: plansLoading, error: plansError, execute: reloadPlans } = useAsync(() => getPlans());
  const [editingPlan, setEditingPlan] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", price: "", period: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [localPlans, setLocalPlans] = useState(null);

  const loading = bizLoading || plansLoading;

  const plansFromApi = plansData && plansData.length > 0;
  const plans = plansFromApi
    ? plansData.map(normalizePlan)
    : (localPlans ?? INITIAL_PLANS.map(p => ({ ...p, id: null })));

  if (loading) return <LoadingState />;
  if (bizError ?? plansError) {
    const err = bizError ?? plansError;
    return <ErrorState message={err.message} />;
  }

  const businesses = businessesData ?? [];
  const plansWithCount = plans.map(p => ({
    ...p,
    count: businesses.filter(b => b.plan === p.name).length,
  }));

  const openEdit = (p) => {
    setEditingPlan(p);
    setEditForm({ name: p.name, price: p.price, period: p.period });
    setSaveError(null);
  };

  const saveEdit = async () => {
    if (!editingPlan) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (editingPlan.id) {
        await updatePlan(editingPlan.id, {
          name: editForm.name,
          price: editForm.price,
          period: editForm.period,
        });
        await reloadPlans();
      } else {
        setLocalPlans(prev =>
          (prev ?? plans).map(p =>
            p.name === editingPlan.name ? { ...p, ...editForm } : p
          )
        );
      }
      setEditingPlan(null);
    } catch (err) {
      setSaveError(err?.message || "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Тарифные планы" subtitle="Управление тарифами платформы" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plansWithCount.map(p => (
          <div key={p.name} className={`bg-gray-800 border-2 ${p.color} rounded-xl p-6 relative`}>
            {p.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white text-gray-900 text-xs font-semibold px-3 py-1 rounded-full">Популярный</div>
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
                <li key={f} className="flex items-center gap-2 text-sm text-gray-300"><span className="text-emerald-400">+</span> {f}</li>
              ))}
              {p.notIncluded.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-600"><span>-</span> {f}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => openEdit(p)}
              className="w-full py-2 rounded-lg text-sm border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              Редактировать тариф
            </button>
          </div>
        ))}
      </div>

      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => !saving && setEditingPlan(null)} />
          <div className="relative z-10 bg-gray-800 border border-gray-600 rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="font-semibold text-white mb-4">Редактировать тариф</h3>
            {saveError && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-sm text-red-300">{saveError}</div>
            )}
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Название</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full border border-gray-600 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/70"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Цена</label>
                <input
                  type="text"
                  value={editForm.price}
                  onChange={e => setEditForm(prev => ({ ...prev, price: e.target.value }))}
                  className="w-full border border-gray-600 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/70"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Период</label>
                <input
                  type="text"
                  value={editForm.period}
                  onChange={e => setEditForm(prev => ({ ...prev, period: e.target.value }))}
                  className="w-full border border-gray-600 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/70"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                disabled={saving}
                className="px-4 py-2 text-sm text-gray-400 border border-gray-600 rounded-lg hover:border-gray-500 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={saving}
                className="px-4 py-2 text-sm bg-white text-gray-900 rounded-lg hover:bg-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
              >
                {saving ? "Сохранение…" : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
