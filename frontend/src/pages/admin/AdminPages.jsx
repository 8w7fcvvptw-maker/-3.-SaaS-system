import { useState } from "react";
import { Badge, Card, ErrorState, LoadingState, PageHeader } from "../../components/ui";
import { useAsync } from "../../hooks/useAsync";
import {
  getAdminBusinesses,
  getAdminPayments,
  getAdminStats,
  getAdminSubscriptions,
  getPlans,
} from "../../lib/api";

function formatMoney(value) {
  return `${Number(value ?? 0).toLocaleString("ru-RU")} ₽`;
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) return "—";
  return d.toLocaleString("ru-RU");
}

function percent(value) {
  return `${Number(value ?? 0).toFixed(1)}%`;
}

function PlanBadge({ planKey, planName }) {
  const colors = { basic: "gray", pro: "teal", unlimited: "purple" };
  return <Badge color={colors[planKey] || "gray"}>{planName ?? planKey ?? "—"}</Badge>;
}

function SubscriptionStatusBadge({ status }) {
  const map = {
    active: { color: "green", text: "active" },
    trial: { color: "teal", text: "trial" },
    past_due: { color: "yellow", text: "past_due" },
    canceled: { color: "red", text: "canceled" },
    inactive: { color: "gray", text: "inactive" },
  };
  const cfg = map[status] ?? map.inactive;
  return <Badge color={cfg.color}>{cfg.text}</Badge>;
}

export function AdminDashboard() {
  const { data: stats, loading: statsLoading, error: statsError } = useAsync(() => getAdminStats());
  const { data: payments, loading: paymentsLoading, error: paymentsError } = useAsync(() => getAdminPayments());
  const { data: subscriptions, loading: subsLoading, error: subsError } = useAsync(() => getAdminSubscriptions());

  if (statsLoading || paymentsLoading || subsLoading) return <LoadingState />;
  const error = statsError ?? paymentsError ?? subsError;
  if (error) return <ErrorState message={error.message} />;

  const recentPayments = (payments ?? []).slice(0, 8);
  const recentSubscriptions = (subscriptions ?? []).slice(0, 8);

  return (
    <div>
      <PageHeader title="Платформенная аналитика" subtitle="SaaS admin + billing overview" />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 mb-6">
        <Card className="p-5 bg-gray-800 border-gray-700">
          <div className="text-gray-400 text-sm">Всего бизнесов</div>
          <div className="text-2xl font-bold text-white mt-1">{stats?.totalBusinessUsers ?? 0}</div>
        </Card>
        <Card className="p-5 bg-gray-800 border-gray-700">
          <div className="text-gray-400 text-sm">Платящих бизнесов</div>
          <div className="text-2xl font-bold text-white mt-1">{stats?.paidBusinesses ?? 0}</div>
          <div className="text-xs text-gray-500 mt-1">Trial: {stats?.trialBusinesses ?? 0}</div>
        </Card>
        <Card className="p-5 bg-gray-800 border-gray-700">
          <div className="text-gray-400 text-sm">Выручка платформы</div>
          <div className="text-2xl font-bold text-white mt-1">{formatMoney(stats?.totalRevenue)}</div>
          <div className="text-xs text-gray-500 mt-1">MRR: {formatMoney(stats?.mrr)}</div>
        </Card>
        <Card className="p-5 bg-gray-800 border-gray-700">
          <div className="text-gray-400 text-sm">Trial → Paid</div>
          <div className="text-2xl font-bold text-white mt-1">{percent(stats?.trialToPaidRate)}</div>
          <div className="text-xs text-gray-500 mt-1">из текущей базы</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <Card className="p-4 bg-gray-800 border-gray-700">
          <div className="text-xs text-gray-400 uppercase mb-1">Subscriptions</div>
          <div className="text-sm text-gray-300">active: {stats?.activeSubscriptions ?? 0}</div>
          <div className="text-sm text-gray-300">trial: {stats?.trialBusinesses ?? 0}</div>
          <div className="text-sm text-gray-300">past_due: {stats?.pastDueSubscriptions ?? 0}</div>
          <div className="text-sm text-gray-300">canceled: {stats?.canceledSubscriptions ?? 0}</div>
          <div className="text-sm text-gray-300">inactive: {stats?.inactiveSubscriptions ?? 0}</div>
        </Card>
        <Card className="p-4 bg-gray-800 border-gray-700">
          <div className="text-xs text-gray-400 uppercase mb-1">Payments</div>
          <div className="text-sm text-gray-300">succeeded: {stats?.successfulPayments ?? 0}</div>
          <div className="text-sm text-gray-300">pending: {stats?.pendingPayments ?? 0}</div>
          <div className="text-sm text-gray-300">refunded: {stats?.refundedPayments ?? 0}</div>
          <div className="text-sm text-gray-300">failed: {stats?.failedPayments ?? 0}</div>
        </Card>
        <Card className="p-4 bg-gray-800 border-gray-700">
          <div className="text-xs text-gray-400 uppercase mb-1">Пользователи</div>
          <div className="text-sm text-gray-300">Всего аккаунтов: {stats?.totalUsers ?? 0}</div>
          <div className="text-sm text-gray-300">Owner-контур: {stats?.totalBusinessUsers ?? 0}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="p-4 bg-gray-800 border-gray-700 overflow-x-auto">
          <h3 className="text-white font-semibold mb-3">Последние платежи</h3>
          <table className="w-full text-sm min-w-[420px]">
            <thead className="text-gray-400 text-xs uppercase">
              <tr>
                <th className="text-left pb-2">ID</th>
                <th className="text-left pb-2">План</th>
                <th className="text-left pb-2">Сумма</th>
                <th className="text-left pb-2">Статус</th>
                <th className="text-left pb-2">Дата</th>
              </tr>
            </thead>
            <tbody>
              {recentPayments.map((p) => (
                <tr key={p.id} className="border-t border-gray-700">
                  <td className="py-2 text-gray-300">{String(p.id).slice(0, 8)}</td>
                  <td className="py-2 text-gray-300">{p.plan ?? "—"}</td>
                  <td className="py-2 text-gray-300">{formatMoney(p.amount)}</td>
                  <td className="py-2"><SubscriptionStatusBadge status={p.status} /></td>
                  <td className="py-2 text-gray-400">{formatDateTime(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="p-4 bg-gray-800 border-gray-700 overflow-x-auto">
          <h3 className="text-white font-semibold mb-3">Последние подписки</h3>
          <table className="w-full text-sm min-w-[420px]">
            <thead className="text-gray-400 text-xs uppercase">
              <tr>
                <th className="text-left pb-2">User</th>
                <th className="text-left pb-2">План</th>
                <th className="text-left pb-2">Статус</th>
                <th className="text-left pb-2">До</th>
              </tr>
            </thead>
            <tbody>
              {recentSubscriptions.map((s) => (
                <tr key={s.id} className="border-t border-gray-700">
                  <td className="py-2 text-gray-300">{String(s.userId).slice(0, 8)}</td>
                  <td className="py-2 text-gray-300">{s.plan ?? "—"}</td>
                  <td className="py-2"><SubscriptionStatusBadge status={s.status} /></td>
                  <td className="py-2 text-gray-400">{formatDateTime(s.endDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

export function AdminBusinesses() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const { data, loading, error } = useAsync(() => getAdminBusinesses());

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error.message} />;

  const businesses = data ?? [];
  const filtered = businesses.filter((b) => {
    const searchOk =
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      String(b.ownerUserId ?? "").toLowerCase().includes(search.toLowerCase());
    const filterOk = filter === "all" ? true : b.billingState === filter;
    return searchOk && filterOk;
  });

  return (
    <div>
      <PageHeader title="Бизнес-аккаунты" subtitle={`Всего: ${businesses.length}`} />

      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по бизнесу или owner user id..."
          className="border border-gray-700 bg-gray-800 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/70 min-w-[260px]"
        />
        {["all", "paid", "trial", "past_due", "canceled", "inactive"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors cursor-pointer ${
              filter === s
                ? "bg-white text-gray-900 border-white"
                : "text-gray-400 border-gray-600 hover:border-gray-400"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <Card className="p-0 bg-gray-800 border-gray-700 overflow-x-auto">
        <table className="w-full text-sm min-w-[980px]">
          <thead>
            <tr className="border-b border-gray-700 text-xs uppercase text-gray-400">
              {[
                "Бизнес",
                "Owner user",
                "Тариф",
                "Billing",
                "Subscription",
                "MRR",
                "Выручка",
                "Платежи",
                "Создан",
                "Последний платёж",
              ].map((h) => (
                <th key={h} className="text-left px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <tr key={b.id} className="border-b border-gray-700">
                <td className="px-4 py-3 text-white font-medium">{b.name}</td>
                <td className="px-4 py-3 text-gray-400">{String(b.ownerUserId ?? "—").slice(0, 8)}</td>
                <td className="px-4 py-3"><PlanBadge planKey={b.planKey} planName={b.planName} /></td>
                <td className="px-4 py-3 text-gray-300">{b.billingState}</td>
                <td className="px-4 py-3"><SubscriptionStatusBadge status={b.subscriptionStatus} /></td>
                <td className="px-4 py-3 text-gray-300">{formatMoney(b.mrrContribution)}</td>
                <td className="px-4 py-3 text-gray-300">{formatMoney(b.totalRevenue)}</td>
                <td className="px-4 py-3 text-gray-300">
                  {b.successfulPayments}/{b.totalPayments}
                </td>
                <td className="px-4 py-3 text-gray-400">{formatDateTime(b.createdAt)}</td>
                <td className="px-4 py-3 text-gray-400">{formatDateTime(b.lastPaymentAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function normalizePlanRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((p) => ({
    id: p.id ?? null,
    code: p.code ?? p.slug ?? p.name ?? "unknown",
    name: p.name ?? p.display_name ?? p.code ?? "Unknown",
    priceRub: Number(p.price_rub ?? p.priceRub ?? 0) || 0,
    period: p.period ?? "/мес",
    active: p.active !== false,
  }));
}

export function AdminPlans() {
  const { data: businessesData, loading: businessesLoading, error: businessesError } = useAsync(() => getAdminBusinesses());
  const { data: plansData, loading: plansLoading } = useAsync(async () => {
    try {
      return await getPlans();
    } catch {
      return [];
    }
  });

  if (businessesLoading || plansLoading) return <LoadingState />;
  if (businessesError) return <ErrorState message={businessesError.message} />;

  const businesses = businessesData ?? [];
  const plans = normalizePlanRows(plansData);
  const byPlan = businesses.reduce((acc, b) => {
    const key = b.planKey ?? "unknown";
    acc.set(key, (acc.get(key) ?? 0) + 1);
    return acc;
  }, new Map());

  return (
    <div>
      <PageHeader title="Тарифы платформы" subtitle="Read-only: безопасный режим для production" />

      <Card className="p-4 bg-amber-950/40 border-amber-700 mb-4">
        <div className="text-amber-200 text-sm">
          Редактирование тарифов отключено: backend `updatePlan()` недоступен в этой версии.
          Экран показывает текущие планы и фактическое распределение бизнесов без риска частичного обновления.
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(plans.length ? plans : [{ id: "fallback", code: "basic", name: "Basic", priceRub: 990, period: "/мес", active: true }]).map((p) => (
          <Card key={p.id ?? p.code} className="p-5 bg-gray-800 border-gray-700">
            <div className="flex items-start justify-between mb-4">
              <div>
                <PlanBadge planKey={p.code} planName={p.name} />
                <div className="text-2xl font-bold text-white mt-2">{formatMoney(p.priceRub)}</div>
                <div className="text-xs text-gray-400">{p.period}</div>
              </div>
              <div className="text-right">
                <div className="text-xl font-semibold text-white">{byPlan.get(p.code) ?? 0}</div>
                <div className="text-xs text-gray-400">бизнесов</div>
              </div>
            </div>
            <div className="text-xs text-gray-400">Код плана: {p.code}</div>
            <div className="text-xs text-gray-400 mt-1">Статус: {p.active ? "active" : "inactive"}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
