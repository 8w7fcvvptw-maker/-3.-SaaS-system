// ============================================
// КАБИНЕТ БИЗНЕСА — СТРАНИЦЫ
// Dashboard, Calendar, Appointments, Clients,
// Services, Staff, Messages, Analytics, Settings
// ============================================

import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import {
  Button, Card, KpiCard, Badge, StatusBadge, Avatar, StarRating,
  PageHeader, EmptyState, LoadingState, ErrorState, ActionErrorBanner, Icon,
} from "../../components/ui";
import { useAsync } from "../../hooks/useAsync";
import { useMinWidthMd } from "../../hooks/useMinWidthMd.js";
import { normalizePhone } from "../../lib/phoneUtils";
import { SAAS_BUSINESS_PROFILE_CHANGED } from "../../lib/saasEvents.js";
import { useSubscription } from "../../hooks/useSubscription.js";
import { PLAN_LIMITS, redirectToPayment } from "../../lib/subscription.js";
import {
  getAppointments, getAppointmentsByDate, getAppointmentById,
  getClients, getClientById, createClient, updateClient,
  getServices, getServiceById,
  getStaff, getStaffById, createStaff,
  getAppointmentsByStaff, getAppointmentsForClient,
  getBusiness, updateBusiness, updateService, createService, deleteService,
  createAppointment, updateAppointment, updateAppointmentStatus, deleteAppointment,
  getRevenueData, getPopularServicesStats,
  getNotificationTemplates, createNotificationTemplate, updateNotificationTemplate, deleteNotificationTemplate, getNotificationEvents,
} from "../../lib/api";

/** Статусы, в которых разрешено удаление записи (совпадает с backend). */
const APPOINTMENT_DELETABLE_STATUSES = new Set(["completed", "cancelled", "no_show", "no-show"]);

// Сегодняшняя дата в формате YYYY-MM-DD
const TODAY = new Date().toISOString().slice(0, 10);

// Временные слоты с шагом 15 минут (09:00–21:00)
const TIME_SLOTS_15 = Array.from({ length: 49 }, (_, i) => {
  const h = 9 + Math.floor((i * 15) / 60);
  const m = (i * 15) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

// ── Баннер подписки ────────────────────────────────────────────
function SubscriptionBanner() {
  const { subscription, hasActiveSubscription, isBusiness, isAdmin } = useSubscription();
  const [upgrading, setUpgrading] = useState(null);

  if (isAdmin) return null;
  if (!isBusiness) return null;
  if (!hasActiveSubscription) return null;

  if (!subscription) return null;

  const plan = PLAN_LIMITS[subscription.plan];
  const daysLeft = subscription.end_date
    ? Math.ceil((new Date(subscription.end_date) - new Date()) / 86400000)
    : null;

  if (daysLeft !== null && daysLeft > 7) return null;

  async function handleRenew() {
    setUpgrading(subscription.plan);
    try {
      await redirectToPayment(subscription.plan);
    } catch {
      setUpgrading(null);
    }
  }

  return (
    <div className="mb-6 bg-amber-900/30 border border-amber-500/40 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
      <div className="text-sm text-amber-300">
        Подписка <strong>{plan?.displayName}</strong> истекает через{" "}
        <strong>{daysLeft} {daysLeft === 1 ? "день" : daysLeft < 5 ? "дня" : "дней"}</strong>.
      </div>
      <button
        onClick={handleRenew}
        disabled={!!upgrading}
        className="shrink-0 text-xs bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-md disabled:opacity-50"
      >
        {upgrading ? "Перенаправление..." : "Продлить"}
      </button>
    </div>
  );
}

// ── 2.1 Dashboard (/dashboard) ────────────────────────────────
export function Dashboard() {
  const navigate = useNavigate();
  const { data: appointments, loading, error } = useAsync(() => getAppointmentsByDate(TODAY));

  if (error) return <ErrorState message={error.message} />;

  const todayApps = appointments ?? [];
  const revenue = todayApps.filter(a => a.status === "completed").reduce((s, a) => s + a.price, 0);
  const cancelled = todayApps.filter(a => a.status === "cancelled").length;

  return (
    <div>
      <PageHeader
        title="Дашборд"
        subtitle={new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      />
      <SubscriptionBanner />

      {loading ? (
        <LoadingState />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5 mb-8 items-stretch">
            <KpiCard label="Записей сегодня" value={todayApps.length} icon={<Icon name="clipboard" className="w-4 h-4" />} trend="За сегодня" color="violet" />
            <KpiCard label="Выручка сегодня" value={`${revenue.toLocaleString()} ₽`} icon={<Icon name="chart" className="w-4 h-4" />} trend="Завершённые" color="green" />
            <KpiCard label="Ожидают подтверждения" value={todayApps.filter(a => a.status === "pending").length} icon={<Icon name="clock" className="w-4 h-4" />} trend="Ожидают" color="yellow" />
            <KpiCard label="Отменено" value={cancelled} icon={<Icon name="alertTriangle" className="w-4 h-4" />} trend={`Из ${todayApps.length} записей`} color="red" />
          </div>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Расписание на сегодня</h3>
              <Button size="sm" variant="ghost" onClick={() => navigate("/calendar")}>Открыть календарь →</Button>
            </div>
            {todayApps.length === 0 ? (
              <EmptyState icon={<Icon name="calendar" className="w-6 h-6" />} title="Нет записей" description="На сегодня записей нет" />
            ) : (
              <div className="space-y-2">
                {todayApps.map(a => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-200/80 dark:border-zinc-700/80 hover:bg-gray-50/80 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/appointments/${a.id}`)}
                  >
                    <div className="text-sm font-mono font-semibold text-gray-500 dark:text-gray-400 w-12 shrink-0">{a.time}</div>
                    <Avatar initials={(a.client_name ?? a.clientName ?? "?").split(" ").map(w => w[0]).join("")} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{a.client_name ?? a.clientName}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{a.service} · {(a.staff_name ?? a.staffName ?? "").split(" ")[0]}</div>
                    </div>
                    <StatusBadge status={a.status} />
                    <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 shrink-0">{(a.price ?? 0).toLocaleString()} ₽</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

// ── 2.2 Календарь (/calendar) ─────────────────────────────────
export function CalendarPage() {
  const navigate = useNavigate();
  const [view, setView] = useState("day");
  const [selectedStaff, setSelectedStaff] = useState("all");

  const hours = Array.from({ length: 12 }, (_, i) => `${9 + i}:00`);

  const { data: staffList, loading: staffLoading }           = useAsync(() => getStaff());
  const { data: appointments, loading: appsLoading, error }  = useAsync(() => getAppointmentsByDate(TODAY));

  const loading = staffLoading || appsLoading;
  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error.message} />;

  const staffArr = staffList ?? [];
  const appsArr  = appointments ?? [];

  const displayApps = appsArr.filter(a =>
    selectedStaff === "all" || String(a.staff_id ?? a.staffId) === selectedStaff
  );

  const getTop    = (time) => { const [h, m] = time.split(":").map(Number); return ((h - 9) * 60 + m) * (64 / 60); };
  const getHeight = (dur)  => dur * (64 / 60);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <PageHeader title="Календарь" subtitle={new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })} />
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex rounded-lg border border-gray-200 dark:border-zinc-600 overflow-hidden">
            {["day", "week"].map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm transition-colors cursor-pointer ${view === v ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700"}`}
              >
                {v === "day" ? "День" : "Неделя"}
              </button>
            ))}
          </div>
          <Button onClick={() => navigate("/appointments/new")}>+ Запись</Button>
        </div>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setSelectedStaff("all")}
          className={`px-3 py-1.5 rounded-full text-sm border transition-colors cursor-pointer ${selectedStaff === "all" ? "bg-slate-900 text-white border-slate-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100" : "text-gray-600 dark:text-gray-300 border-gray-200 dark:border-zinc-600 hover:border-slate-400 dark:hover:border-zinc-500"}`}
        >
          Все мастера
        </button>
        {staffArr.map(s => (
          <button
            key={s.id}
            onClick={() => setSelectedStaff(String(s.id))}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors cursor-pointer ${selectedStaff === String(s.id) ? "bg-slate-900 text-white border-slate-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100" : "text-gray-600 dark:text-gray-300 border-gray-200 dark:border-zinc-600 hover:border-slate-400 dark:hover:border-zinc-500"}`}
          >
            <span className="w-5 h-5 bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200 rounded-full flex items-center justify-center text-xs">{(s.avatar ?? s.name)[0]}</span>
            {s.name.split(" ")[0]}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="flex">
          <div className="w-14 shrink-0 border-r border-gray-100">
            {hours.map(h => (
              <div key={h} className="h-16 border-b border-gray-100 flex items-start pt-1 px-2">
                <span className="text-xs text-gray-400">{h}</span>
              </div>
            ))}
          </div>

          <div className="flex-1 relative" style={{ height: `${12 * 64}px` }}>
            {hours.map((_, i) => (
              <div key={i} className="absolute w-full border-b border-gray-100" style={{ top: `${i * 64}px` }} />
            ))}

            {displayApps.map(a => {
              const colors = {
                confirmed:
                  "bg-slate-50/95 text-slate-800 border-l-slate-400/55 dark:bg-zinc-800/75 dark:text-zinc-100 dark:border-l-zinc-500/70",
                pending:
                  "bg-amber-50/90 text-amber-950 border-l-amber-400/40 dark:bg-amber-950/25 dark:text-amber-100 dark:border-l-amber-600/45",
                cancelled:
                  "bg-red-50/70 text-red-800/90 border-l-red-300/45 dark:bg-red-950/20 dark:text-red-300/95 dark:border-l-red-900/45",
                completed:
                  "bg-emerald-50/85 text-emerald-900 border-l-emerald-400/40 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-l-emerald-700/45",
                no_show:
                  "bg-stone-50/90 text-stone-800 border-l-stone-400/45 dark:bg-zinc-800/70 dark:text-zinc-300 dark:border-l-zinc-600/60",
                "no-show":
                  "bg-stone-50/90 text-stone-800 border-l-stone-400/45 dark:bg-zinc-800/70 dark:text-zinc-300 dark:border-l-zinc-600/60",
              };
              return (
                <div
                  key={a.id}
                  className={`absolute left-2 right-2 rounded-md border-l-[3px] px-2 py-1 cursor-pointer hover:shadow-sm transition-shadow text-xs ${colors[a.status] ?? "bg-gray-50/90 text-gray-900 border-l-gray-300/60 dark:bg-zinc-800/80 dark:text-zinc-100 dark:border-l-zinc-600"}`}
                  style={{ top: `${getTop(a.time)}px`, height: `${getHeight(a.duration) - 4}px` }}
                  onClick={() => navigate(`/appointments/${a.id}`)}
                >
                  <div className="font-semibold truncate">{a.client_name ?? a.clientName}</div>
                  <div className="truncate opacity-80">{a.service}</div>
                  <div className="opacity-70">{a.time} · {(a.staff_name ?? a.staffName ?? "").split(" ")[0]}</div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── 2.3.1 Новая запись (/appointments/new) ─────────────────────
export function AppointmentEditor() {
  const navigate = useNavigate();
  const TODAY = new Date().toISOString().slice(0, 10);
  const { data: business } = useAsync(() => getBusiness());
  const { data: services } = useAsync(() => getServices());
  const { data: staffList } = useAsync(() => getStaff());
  const { data: clientsList } = useAsync(() => getClients());
  const [form, setForm] = useState({
    client_name: "",
    client_phone: "",
    service_id: "",
    staff_id: "",
    date: TODAY,
    time: "10:00",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState(null);
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  const svcs = services ?? [];
  const staffArr = staffList ?? [];
  const selectedService = svcs.find(s => String(s.id) === String(form.service_id));

  const u = (f) => (e) => {
    setForm(p => ({ ...p, [f]: e.target.value }));
    if (errors[f]) setErrors(p => ({ ...p, [f]: undefined }));
    if (saveError) setSaveError(null);
  };

  const handleSave = async () => {
    setSaveError(null);
    const errs = {};
    if (!form.client_name?.trim()) errs.client_name = "Введите имя клиента";
    if (!form.client_phone?.trim()) errs.client_phone = "Введите телефон";
    if (!form.service_id) errs.service_id = "Выберите услугу";
    if (!form.staff_id) errs.staff_id = "Выберите мастера";
    if (Object.keys(errs).length) return setErrors(errs);
    if (!business?.id) {
      setSaveError("Создайте бизнес в Supabase (см. КАК_СОЗДАТЬ_БИЗНЕС.md).");
      return;
    }

    setSaving(true);
    try {
      const phoneNorm = normalizePhone(form.client_phone.trim());
      const matchedClient = (clientsList ?? []).find(
        (cl) => normalizePhone(cl.phone ?? "") === phoneNorm
      );
      const data = {
        client_name: form.client_name.trim(),
        client_phone: form.client_phone.trim(),
        service_id: selectedService?.id != null ? Number(selectedService.id) : null,
        staff_id: form.staff_id ? Number(form.staff_id) : null,
        date: form.date,
        time: form.time,
        duration: selectedService?.duration ?? 30,
        price: selectedService?.price ?? 0,
        status: "pending",
        notes: form.notes?.trim() || null,
      };
      if (matchedClient?.id != null) data.client_id = Number(matchedClient.id);
      if (business?.id) data.business_id = business.id;
      await createAppointment(data);
      navigate("/appointments");
    } catch (err) {
      const msg = err?.message || String(err);
      setSaveError(msg.includes("business_id") ? "Создайте бизнес в Supabase (см. КАК_СОЗДАТЬ_БИЗНЕС.md)." : msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/appointments")} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer">← Назад</button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Новая запись</h1>
      </div>
      <Card className="p-6 max-w-lg">
        <div className="space-y-4">
          {saveError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
              {saveError}
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Имя клиента <span className="text-red-500">*</span></label>
            <input type="text" value={form.client_name} onChange={u("client_name")} placeholder="Иван Петров"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 ${errors.client_name ? "border-red-400" : "border-gray-300 dark:border-zinc-600 focus:ring-slate-400/70"}`} />
            {errors.client_name && <p className="text-xs text-red-500 mt-1">{errors.client_name}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Телефон <span className="text-red-500">*</span></label>
            <input type="tel" value={form.client_phone} onChange={(e) => u("client_phone")({ ...e, target: { ...e.target, value: normalizePhone(e.target.value) } })} placeholder="+7 (999) 000-00-00"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 ${errors.client_phone ? "border-red-400" : "border-gray-300 dark:border-zinc-600 focus:ring-slate-400/70"}`} />
            {errors.client_phone && <p className="text-xs text-red-500 mt-1">{errors.client_phone}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Услуга <span className="text-red-500">*</span></label>
            <select value={form.service_id} onChange={u("service_id")}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 ${errors.service_id ? "border-red-400" : "border-gray-300 dark:border-zinc-600 focus:ring-slate-400/70"}`}>
              <option value="">— Выберите услугу</option>
              {svcs.map(s => <option key={s.id} value={s.id}>{s.name} — {(s.price ?? 0).toLocaleString()} ₽</option>)}
            </select>
            {errors.service_id && <p className="text-xs text-red-500 mt-1">{errors.service_id}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Мастер <span className="text-red-500">*</span></label>
            <select value={form.staff_id} onChange={u("staff_id")}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 ${errors.staff_id ? "border-red-400" : "border-gray-300 dark:border-zinc-600 focus:ring-slate-400/70"}`}>
              <option value="">— Выберите мастера</option>
              {staffArr.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {errors.staff_id && <p className="text-xs text-red-500 mt-1">{errors.staff_id}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Дата</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 pointer-events-none">
                  <Icon name="calendar" className="w-4 h-4" />
                </span>
                <input
                  type="date"
                  value={form.date}
                  onChange={u("date")}
                  min={TODAY}
                  className="w-full border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/70 focus:border-slate-500 dark:focus:border-zinc-400 [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>
            </div>
            <div className="relative">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 inline-flex items-center gap-1.5">
                <Icon name="clock" className="w-4 h-4" />
                Время
              </label>
              <button
                type="button"
                onClick={() => setTimePickerOpen(v => !v)}
                className="w-full flex items-center justify-between border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/70 focus:border-slate-500 dark:focus:border-zinc-400 cursor-pointer text-left"
              >
                <span>{TIME_SLOTS_15.includes(form.time) ? form.time : TIME_SLOTS_15[0]}</span>
                <span className="text-gray-400 dark:text-zinc-500">▾</span>
              </button>
              {timePickerOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setTimePickerOpen(false)} aria-hidden="true" />
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-[11rem] overflow-y-auto border border-gray-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 rounded-lg shadow-lg py-1">
                    {TIME_SLOTS_15.map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => { setForm(p => ({ ...p, time: val })); setTimePickerOpen(false); }}
                        className={`w-full px-3 py-2 text-left text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/80 ${form.time === val ? "bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-medium" : "text-gray-900 dark:text-gray-100"}`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Заметки</label>
            <textarea value={form.notes} onChange={u("notes")} rows={2} placeholder="Комментарий к записи..." className="w-full border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/70 resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button className="flex-1 justify-center" onClick={handleSave} disabled={saving}>{saving ? "Сохранение..." : "Создать запись"}</Button>
            <Button variant="secondary" onClick={() => navigate("/appointments")} disabled={saving}>Отмена</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── 2.3 Список записей (/appointments) ────────────────────────
export function AppointmentsList() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");

  const { data, loading, error } = useAsync(() => getAppointments());

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error.message} />;

  const appointments = data ?? [];
  const filtered =
    filter === "all"
      ? appointments
      : appointments.filter((a) => {
          if (filter === "no_show") return a.status === "no_show" || a.status === "no-show";
          return a.status === filter;
        });

  return (
    <div>
      <PageHeader
        title="Записи"
        subtitle={`${appointments.length} записей`}
        action={<Button onClick={() => navigate("/appointments/new")}>+ Новая запись</Button>}
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        {["all", "confirmed", "pending", "completed", "cancelled", "no_show"].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors cursor-pointer ${filter === s ? "bg-slate-900 text-white border-slate-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100" : "text-gray-600 dark:text-gray-300 border-gray-200 dark:border-zinc-600"}`}
          >
            {s === "all"
              ? "Все"
              : s === "confirmed"
                ? "Подтверждено"
                : s === "pending"
                  ? "Ожидает"
                  : s === "completed"
                    ? "Завершено"
                    : s === "cancelled"
                      ? "Отменено"
                      : "Не явился"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Icon name="clipboard" className="w-6 h-6" />} title="Нет записей" description="По выбранному фильтру записей нет" />
      ) : (
        <>
          {/* Мобильный вид */}
          <div className="md:hidden space-y-2">
            {filtered.map(a => (
              <Card key={a.id} className="p-4 cursor-pointer active:opacity-70" onClick={() => navigate(`/appointments/${a.id}`)}>
                <div className="flex items-center gap-3 mb-2">
                  <Avatar initials={(a.client_name ?? a.clientName ?? "?").split(" ").map(w => w[0]).join("")} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate">{a.client_name ?? a.clientName}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{a.service} · {(a.staff_name ?? a.staffName ?? "").split(" ")[0]}</div>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">{a.date.slice(5).replace("-", ".")} в {a.time}</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{(a.price ?? 0).toLocaleString()} ₽</span>
                </div>
              </Card>
            ))}
          </div>

          {/* Десктоп вид */}
          <Card className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-zinc-700">
                  {["Дата / Время", "Клиент", "Услуга", "Мастер", "Статус", "Сумма"].map(h => (
                    <th key={h} className={`px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase ${h === "Сумма" ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id} className="border-b border-gray-50 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700/50 cursor-pointer" onClick={() => navigate(`/appointments/${a.id}`)}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{a.date.slice(5).replace("-", ".")}</div>
                      <div className="text-gray-400 dark:text-gray-500">{a.time}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar initials={(a.client_name ?? a.clientName ?? "?").split(" ").map(w => w[0]).join("")} size="sm" />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{a.client_name ?? a.clientName}</div>
                          <div className="text-gray-400 dark:text-gray-500 text-xs">{a.client_phone ?? a.clientPhone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{a.service}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{(a.staff_name ?? a.staffName ?? "").split(" ")[0]}</td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">{(a.price ?? 0).toLocaleString()} ₽</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

// ── 2.4 Детали записи (/appointments/:id) ─────────────────────
export function AppointmentDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: a, loading, error, execute: reload } = useAsync(() => getAppointmentById(id));
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [mutationError, setMutationError] = useState(null);

  useEffect(() => {
    if (a) setNotes(a.notes || "");
  }, [a]);

  const handleStatusChange = async (status) => {
    if (a.status === status) return;
    setMutationError(null);
    setSavingStatus(true);
    try {
      await updateAppointmentStatus(id, status);
      await reload();
    } catch (err) {
      setMutationError(err.message ?? String(err));
    } finally {
      setSavingStatus(false);
    }
  };

  const handleSaveNotes = async () => {
    setMutationError(null);
    setSavingNotes(true);
    try {
      await updateAppointment(id, { notes });
      await reload();
    } catch (err) {
      setMutationError(err.message ?? String(err));
    } finally {
      setSavingNotes(false);
    }
  };

  const canDeleteAppointment = a && APPOINTMENT_DELETABLE_STATUSES.has(a.status);

  const handleDeleteAppointment = async () => {
    if (!canDeleteAppointment || !id) return;
    if (!window.confirm("Удалить эту запись? Восстановить её будет нельзя.")) return;
    setMutationError(null);
    setDeleting(true);
    try {
      await deleteAppointment(id);
      navigate("/appointments", { replace: true });
    } catch (err) {
      setMutationError(err.message ?? String(err));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={`Запись не найдена: ${error.message}`} />;
  if (!a)      return <EmptyState icon={<Icon name="clipboard" className="w-6 h-6" />} title="Запись не найдена" description="" />;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/appointments")} className="text-gray-400 hover:text-gray-600 cursor-pointer">← Назад</button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Запись #{a.id}</h1>
        <StatusBadge status={a.status} />
      </div>
      <ActionErrorBanner
        message={mutationError}
        onDismiss={() => setMutationError(null)}
        className="mb-4"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Детали записи</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                ["Услуга", a.service],
                ["Длительность", `${a.duration} мин`],
                ["Дата", a.date],
                ["Время", a.time],
                ["Стоимость", `${(a.price ?? 0).toLocaleString()} ₽`],
                ["Мастер", a.staff_name ?? a.staffName],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="text-xs text-gray-400 mb-0.5">{label}</div>
                  <div className="font-medium text-gray-900 dark:text-white">{value}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Заметки</h3>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={handleSaveNotes}
              placeholder="Добавьте заметку..."
              rows={3}
              disabled={savingNotes}
              className="w-full border border-gray-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/70 resize-none disabled:opacity-70"
            />
            {savingNotes && <p className="text-xs text-gray-400 mt-1">Сохранение...</p>}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Клиент</h3>
            <div className="flex items-center gap-3 mb-3">
              <Avatar initials={(a.client_name ?? a.clientName ?? "?").split(" ").map(w => w[0]).join("")} size="lg" />
              <div>
                <div className="font-semibold text-gray-900 dark:text-white">{a.client_name ?? a.clientName}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{a.client_phone ?? a.clientPhone}</div>
              </div>
            </div>
            <Button variant="secondary" size="sm" className="w-full justify-center" onClick={() => navigate("/clients")}>
              Профиль клиента
            </Button>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Статус</h3>
            <div className="space-y-2">
              {["pending", "confirmed", "completed", "cancelled", "no_show"].map(s => (
                <button
                  key={s}
                  disabled={savingStatus}
                  onClick={() => handleStatusChange(s)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors cursor-pointer disabled:opacity-50 ${
                    a.status === s || (s === "no_show" && (a.status === "no-show" || a.status === "no_show"))
                      ? "border-slate-300 bg-slate-50 dark:bg-zinc-800/80 dark:border-zinc-600 text-slate-800 dark:text-zinc-200"
                      : "border-gray-200 dark:border-zinc-600 hover:border-gray-300 dark:hover:border-zinc-500"
                  }`}
                >
                  <StatusBadge status={s} />
                </button>
              ))}
            </div>
            {canDeleteAppointment ? (
              <Button
                variant="secondary"
                className="w-full justify-center mt-4 border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                disabled={deleting || savingStatus}
                onClick={handleDeleteAppointment}
              >
                {deleting ? "Удаление…" : "Удалить запись"}
              </Button>
            ) : (
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-4">
                Удаление доступно только для статусов «Завершено», «Отменено» или «Не явился».
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── 2.5 Клиенты (/clients) ────────────────────────────────────
export function ClientsPage() {
  const navigate = useNavigate();
  const isMdUp = useMinWidthMd();
  const [search, setSearch] = useState("");
  const { data, loading, error } = useAsync(() => getClients());

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error.message} />;

  const clients = data ?? [];
  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone ?? "").includes(search)
  );

  return (
    <div>
      <PageHeader
        title="Клиенты"
        subtitle={`${clients.length} клиентов`}
        action={<Button onClick={() => navigate("/clients/new")}>+ Добавить клиента</Button>}
      />

      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по имени или телефону..."
          className="w-full max-w-sm border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/70"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Icon name="users" className="w-6 h-6" />} title="Клиенты не найдены" description="Попробуйте изменить запрос" />
      ) : isMdUp ? (
          <Card>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-zinc-700">
                  {["Клиент", "Контакты", "Визиты", "Последний", "Выручка"].map((h, i) => (
                    <th key={h} className={`px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase ${i >= 2 ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const tags = c.tags ?? [];
                  return (
                    <tr key={c.id} className="border-b border-gray-50 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700/50 cursor-pointer" onClick={() => navigate(`/clients/${c.id}`)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar initials={c.name.split(" ").map(w => w[0]).join("")} size="sm" />
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">{c.name}</div>
                            {tags.map(t => <Badge key={t} color={t === "VIP" ? "purple" : t === "Постоянный" ? "teal" : "red"}>{t}</Badge>)}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-700 dark:text-gray-300">{c.phone}</div>
                        <div className="text-gray-400 text-xs">{c.email}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">{c.total_visits ?? c.totalVisits ?? 0}</td>
                      <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">{(c.last_visit ?? c.lastVisit ?? "—").toString().slice(5).replace("-", ".")}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-zinc-300">{(c.total_spent ?? c.totalSpent ?? 0).toLocaleString()} ₽</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
      ) : (
          <div className="space-y-2">
            {filtered.map(c => (
              <Card key={c.id} className="p-4 cursor-pointer active:opacity-70" onClick={() => navigate(`/clients/${c.id}`)}>
                <div className="flex items-center gap-3">
                  <Avatar initials={c.name.split(" ").map(w => w[0]).join("")} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate">{c.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{c.phone}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-semibold text-slate-700 dark:text-zinc-300 text-sm">{(c.total_spent ?? c.totalSpent ?? 0).toLocaleString()} ₽</div>
                    <div className="text-xs text-gray-400">{c.total_visits ?? c.totalVisits ?? 0} визитов</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
      )}
    </div>
  );
}

// ── 2.5.1 Новый клиент (/clients/new) ─────────────────────────
const EMPTY_CLIENT = { name: "", phone: "", email: "", notes: "" };

export function ClientEditor() {
  const navigate = useNavigate();
  const { data: business } = useAsync(() => getBusiness());
  const [form, setForm] = useState({ ...EMPTY_CLIENT });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState(null);

  const u = (f) => (e) => {
    setForm(p => ({ ...p, [f]: e.target.value }));
    if (errors[f]) setErrors(p => ({ ...p, [f]: undefined }));
    if (saveError) setSaveError(null);
  };

  const handleSave = async () => {
    setSaveError(null);
    const errs = {};
    if (!form.name?.trim()) errs.name = "Введите имя";
    if (!form.phone?.trim()) errs.phone = "Введите телефон";
    if (Object.keys(errs).length) return setErrors(errs);

    setSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email?.trim() || null,
        notes: form.notes?.trim() || null,
        total_visits: 0,
        total_spent: 0,
        tags: [],
      };
      if (business?.id) data.business_id = business.id;
      await createClient(data);
      navigate("/clients");
    } catch (err) {
      const msg = err?.message || String(err);
      setSaveError(msg.includes("business_id") ? "Добавьте бизнес в Настройках (таблица businesses должна содержать хотя бы одну запись)." : msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/clients")} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer">← Назад</button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Новый клиент</h1>
      </div>
      <Card className="p-6 max-w-lg">
        <div className="space-y-4">
          {[["Имя", "name", "text", true], ["Телефон", "phone", "tel", true], ["Email", "email", "email", false]].map(([label, field, type, required]) => {
            const inputId = `client-new-${field}`;
            return (
            <div key={field}>
              <label htmlFor={inputId} className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">{label} {required && <span className="text-red-500">*</span>}</label>
              <input
                id={inputId}
                type={type}
                value={form[field] ?? ""}
                onChange={field === "phone" ? (e) => u("phone")({ ...e, target: { ...e.target, value: normalizePhone(e.target.value) } }) : u(field)}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 ${errors[field] ? "border-red-400" : "border-gray-300 dark:border-zinc-600 focus:ring-slate-400/70"}`}
              />
              {errors[field] && <p className="text-xs text-red-500 mt-1">{errors[field]}</p>}
            </div>
            );
          })}
          <div>
            <label htmlFor="client-new-notes" className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Заметки</label>
            <textarea id="client-new-notes" value={form.notes ?? ""} onChange={u("notes")} rows={3} className="w-full border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/70 resize-none" />
          </div>
          {saveError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
              {saveError}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button className="flex-1 justify-center" onClick={handleSave} disabled={saving}>{saving ? "Сохранение..." : "Сохранить"}</Button>
            <Button variant="secondary" onClick={() => navigate("/clients")} disabled={saving}>Отмена</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── 2.6 Профиль клиента (/clients/:id) ────────────────────────
export function ClientProfile() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: bundle, loading, error, execute: reload } = useAsync(
    async () => {
      const client = await getClientById(id);
      if (!client) return { client: null, apps: [] };
      const apps = await getAppointmentsForClient(client.id, client.name);
      return { client, apps };
    },
    true,
    [id]
  );
  const c = bundle?.client;
  const clientApps = bundle?.apps ?? [];
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesError, setNotesError] = useState(null);

  useEffect(() => {
    if (c) setNotes(c.notes ?? "");
  }, [c]);

  const handleSaveNotes = async () => {
    setNotesError(null);
    setSavingNotes(true);
    try {
      await updateClient(id, { notes });
      await reload();
    } catch (err) {
      setNotesError(err.message ?? String(err));
    } finally {
      setSavingNotes(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error.message} />;
  if (!c)      return <EmptyState icon={<Icon name="user" className="w-6 h-6" />} title="Клиент не найден" description="" />;
  const tags = c.tags ?? [];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/clients")} className="text-gray-400 hover:text-gray-600 cursor-pointer">← Назад</button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{c.name}</h1>
        {tags.map(t => <Badge key={t} color={t === "VIP" ? "purple" : "teal"}>{t}</Badge>)}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <Avatar initials={c.name.split(" ").map(w => w[0]).join("")} size="lg" />
              <div>
                <div className="font-bold text-gray-900 dark:text-white">{c.name}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{c.phone}</div>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              {[["📧 Email", c.email], ["📞 Телефон", c.phone]].map(([l, v]) => (
                <div key={l} className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">{l}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{v}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Статистика</h3>
            <div className="space-y-3">
              {[
                ["Всего визитов", c.total_visits ?? c.totalVisits ?? 0],
                ["Потрачено", `${(c.total_spent ?? c.totalSpent ?? 0).toLocaleString()} ₽`],
                ["Последний визит", c.last_visit ?? c.lastVisit ?? "—"],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">{l}</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{v}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Заметки</h3>
            <ActionErrorBanner
              message={notesError}
              onDismiss={() => setNotesError(null)}
              className="mb-2"
            />
            <textarea
              value={notes}
              onChange={e => {
                setNotes(e.target.value);
                if (notesError) setNotesError(null);
              }}
              onBlur={handleSaveNotes}
              rows={3}
              disabled={savingNotes}
              className="w-full border border-gray-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 rounded-lg px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-400/70 disabled:opacity-70"
            />
            {savingNotes && <p className="text-xs text-gray-400 mt-1">Сохранение...</p>}
          </Card>
        </div>

        <div className="col-span-2">
          <Card className="p-5">
            <h3 className="font-semibold text-gray-900 mb-4">История визитов</h3>
            <div className="space-y-2">
              {clientApps.length > 0 ? clientApps.map(a => (
                <div key={a.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg">
                  <div className="text-sm w-24 text-gray-500 shrink-0">{a.date.slice(5).replace("-", ".")} {a.time}</div>
                  <div className="flex-1">
                    <div className="font-medium text-sm text-gray-900">{a.service}</div>
                    <div className="text-xs text-gray-400">{a.staff_name ?? a.staffName}</div>
                  </div>
                  <StatusBadge status={a.status} />
                  <div className="font-semibold text-gray-900">{(a.price ?? 0).toLocaleString()} ₽</div>
                </div>
              )) : (
                <EmptyState icon={<Icon name="clipboard" className="w-6 h-6" />} title="Нет записей" description="История визитов пуста" />
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── 2.7 Услуги (/services) ────────────────────────────────────
export function ServicesPage() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("Все");
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const { data, loading, error, execute: reload } = useAsync(() => getServices());

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error.message} />;

  const services = data ?? [];
  const categories = ["Все", ...new Set(services.map(s => s.category))];
  const filtered = activeCategory === "Все" ? services : services.filter(s => s.category === activeCategory);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!confirm("Удалить услугу? Это действие нельзя отменить.")) return;
    setDeleteError(null);
    setDeletingId(id);
    try {
      await deleteService(id);
      await reload();
    } catch (err) {
      setDeleteError(err.message ?? String(err));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Услуги"
        subtitle={`${services.filter(s => s.active).length} активных`}
        action={<Button onClick={() => navigate("/services/new")}>+ Добавить услугу</Button>}
      />
      <ActionErrorBanner
        message={deleteError}
        onDismiss={() => setDeleteError(null)}
        className="mb-4"
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        {categories.map(c => (
          <button key={c} onClick={() => setActiveCategory(c)} className={`px-3 py-1.5 rounded-full text-sm border transition-colors cursor-pointer ${activeCategory === c ? "bg-slate-900 text-white border-slate-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100" : "text-gray-600 dark:text-gray-300 border-gray-200 dark:border-zinc-600"}`}>
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map(s => (
          <Card key={s.id} className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                <span className="font-semibold text-gray-900 dark:text-white">{s.name}</span>
              </div>
              <Badge color={s.active ? "green" : "gray"}>{s.active ? "Активна" : "Скрыта"}</Badge>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{s.description}</p>
            <div className="flex items-center justify-between text-sm mb-3">
              <span className="text-gray-500 dark:text-gray-400 inline-flex items-center gap-1">
                <Icon name="clock" className="w-3.5 h-3.5" />
                {s.duration} мин · {s.category}
              </span>
              <span className="font-bold text-slate-700 dark:text-zinc-300">{(s.price ?? 0).toLocaleString()} ₽</span>
            </div>
            <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-zinc-700">
              <button
                onClick={() => navigate(`/services/${s.id}`)}
                className="flex-1 text-sm text-center py-1.5 rounded-lg border border-gray-200 dark:border-zinc-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              >
                Редактировать
              </button>
              <button
                onClick={(e) => handleDelete(e, s.id)}
                disabled={deletingId === s.id}
                className="px-4 text-sm py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer disabled:opacity-50"
              >
                {deletingId === s.id ? "..." : "Удалить"}
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── 2.8 Редактор услуги (/services/:id) ───────────────────────
const EMPTY_SERVICE = { name: "", description: "", duration: 30, price: 0, category: "", color: "#6366f1", active: true };

function validateService(form) {
  const errors = {};
  if (!form.name?.trim())                         errors.name        = "Введите название";
  if (!form.description?.trim())                  errors.description = "Введите описание";
  if (!form.duration || Number(form.duration) <= 0) errors.duration  = "Введите длительность больше 0";
  if (!form.price    || Number(form.price)    <= 0) errors.price     = "Цена должна быть больше 0";
  return errors;
}

export function ServiceEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = id === "new";
  const { data: business } = useAsync(() => getBusiness());

  const { data: s, loading, error } = useAsync(
    () => isNew ? Promise.resolve(null) : getServiceById(id)
  );
  const [form, setForm]               = useState(isNew ? { ...EMPTY_SERVICE } : null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving]           = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [actionError, setActionError] = useState(null);

  if (!isNew && s && !form) setForm({ ...s });

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error.message} />;
  if (!form)   return <EmptyState icon={<Icon name="scissors" className="w-6 h-6" />} title="Услуга не найдена" description="" />;

  const u = (f) => (e) => {
    setForm(p => ({ ...p, [f]: e.target.value }));
    if (fieldErrors[f]) setFieldErrors(p => ({ ...p, [f]: undefined }));
  };

  const handleSave = async () => {
    const errors = validateService(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setActionError(null);
    setSaving(true);
    try {
      if (isNew) {
        const data = { ...form };
        if (business?.id) data.business_id = business.id;
        await createService(data);
      } else {
        await updateService(id, form);
      }
      navigate("/services");
    } catch (err) {
      setActionError(err.message ?? String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Удалить услугу "${form.name}"? Это действие нельзя отменить.`)) return;
    setActionError(null);
    setDeleting(true);
    try {
      await deleteService(id);
      navigate("/services");
    } catch (err) {
      setActionError(err.message ?? String(err));
      setDeleting(false);
    }
  };

  const fields = [
    ["Название",           "name",        "text"],
    ["Описание",           "description", "text"],
    ["Длительность (мин)", "duration",    "number"],
    ["Цена (₽)",           "price",       "number"],
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/services")} className="text-gray-400 hover:text-gray-600 cursor-pointer">← Назад</button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{isNew ? "Новая услуга" : "Редактирование услуги"}</h1>
      </div>

      <Card className="p-6 max-w-lg">
        <div className="space-y-4">
          <ActionErrorBanner
            message={actionError}
            onDismiss={() => setActionError(null)}
          />
          {fields.map(([label, field, type]) => {
            const inputId = `service-edit-${field}`;
            return (
            <div key={field}>
              <label htmlFor={inputId} className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
                {label} <span className="text-red-500">*</span>
              </label>
              <input
                id={inputId}
                type={type}
                value={form[field] ?? ""}
                onChange={u(field)}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 ${
                  fieldErrors[field]
                    ? "border-red-400 focus:ring-red-400"
                    : "border-gray-300 dark:border-zinc-600 focus:ring-slate-400/70"
                }`}
              />
              {fieldErrors[field] && (
                <p className="text-xs text-red-500 mt-1">{fieldErrors[field]}</p>
              )}
            </div>
            );
          })}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Цвет в календаре</label>
            <div className="flex gap-2">
              {["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"].map(c => (
                <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))} className={`w-8 h-8 rounded-full border-2 cursor-pointer ${form.color === c ? "border-gray-800 scale-110" : "border-white"}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button className="flex-1 justify-center" onClick={handleSave} disabled={saving || deleting}>
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
            <Button variant="secondary" onClick={() => navigate("/services")} disabled={saving || deleting}>Отмена</Button>
          </div>
          {!isNew && (
            <div className="pt-2 border-t border-gray-100 dark:border-zinc-700">
              <button
                onClick={handleDelete}
                disabled={deleting || saving}
                className="w-full py-2 rounded-lg border border-red-200 dark:border-red-800 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer disabled:opacity-50"
              >
                {deleting ? "Удаление..." : "🗑 Удалить услугу"}
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ── 2.8.1 Новый сотрудник (/staff/new) ────────────────────────
const EMPTY_STAFF = { name: "", role: "Барбер", phone: "", specialization: "", working_hours: "Пн–Вс: 09:00–18:00", services: [] };

export function StaffEditor() {
  const navigate = useNavigate();
  const { data: business, loading: bizLoading } = useAsync(() => getBusiness());
  const { data: services } = useAsync(() => getServices());
  const [form, setForm] = useState({ ...EMPTY_STAFF });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState(null);

  const svcs = services ?? [];

  const u = (f) => (e) => {
    setForm(p => ({ ...p, [f]: e.target.value }));
    if (errors[f]) setErrors(p => ({ ...p, [f]: undefined }));
    if (saveError) setSaveError(null);
  };

  const toggleService = (id) => {
    setForm(p => ({
      ...p,
      services: p.services.includes(id) ? p.services.filter(x => x !== id) : [...p.services, id],
    }));
    if (saveError) setSaveError(null);
  };

  const handleSave = async () => {
    setSaveError(null);
    const errs = {};
    if (!form.name?.trim()) errs.name = "Введите имя";
    if (!form.role?.trim()) errs.role = "Введите должность";
    if (Object.keys(errs).length) return setErrors(errs);

    if (!bizLoading && !business?.id) {
      setSaveError("Создайте бизнес в Supabase (см. КАК_СОЗДАТЬ_БИЗНЕС.md), затем обновите страницу.");
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        role: form.role.trim(),
        phone: form.phone?.trim() || null,
        specialization: form.specialization?.trim() || null,
        working_hours: form.working_hours?.trim() || null,
        services: form.services ?? [],
        rating: 0,
        avatar: form.name.trim().split(" ").map(w => w[0]).join("").slice(0, 2) || "?",
      };
      if (business?.id) data.business_id = business.id;
      await createStaff(data);
      navigate("/staff");
    } catch (err) {
      const msg = err?.message || String(err);
      setSaveError(msg.includes("business_id") ? "Таблица staff требует business_id. Создайте бизнес в Supabase." : msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/staff")} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer">← Назад</button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Новый сотрудник</h1>
      </div>
      <Card className="p-6 max-w-lg">
        <div className="space-y-4">
          {saveError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
              {saveError}
            </div>
          )}
          {[["Имя", "name", "text"], ["Должность", "role", "text"], ["Телефон", "phone", "tel"], ["Специализация", "specialization", "text"], ["Расписание", "working_hours", "text"]].map(([label, field, type]) => (
            <div key={field}>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">{label}</label>
              <input
                type={type}
                value={form[field] ?? ""}
                onChange={field === "phone" ? (e) => u("phone")({ ...e, target: { ...e.target, value: normalizePhone(e.target.value) } }) : u(field)}
                placeholder={field === "working_hours" ? "Пн–Вс: 09:00–18:00" : ""}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 ${errors[field] ? "border-red-400" : "border-gray-300 dark:border-zinc-600 focus:ring-slate-400/70"}`}
              />
              {errors[field] && <p className="text-xs text-red-500 mt-1">{errors[field]}</p>}
            </div>
          ))}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">Услуги</label>
            <div className="flex flex-wrap gap-2">
              {svcs.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleService(s.id)}
                  className={`px-3 py-1.5 rounded-full text-sm border cursor-pointer transition-colors ${form.services.includes(s.id) ? "bg-slate-900 text-white border-slate-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100" : "border-gray-200 dark:border-zinc-600 text-gray-600 dark:text-gray-300 hover:border-slate-400 dark:hover:border-zinc-500"}`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button className="flex-1 justify-center" onClick={handleSave} disabled={saving}>{saving ? "Сохранение..." : "Сохранить"}</Button>
            <Button variant="secondary" onClick={() => navigate("/staff")} disabled={saving}>Отмена</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── 2.9 Сотрудники (/staff) ───────────────────────────────────
export function StaffPage() {
  const navigate = useNavigate();
  const { data: staffList, loading: staffLoading, error: staffError } = useAsync(() => getStaff());
  const { data: services }                                             = useAsync(() => getServices());

  if (staffLoading) return <LoadingState />;
  if (staffError)   return <ErrorState message={staffError.message} />;

  const staff    = staffList ?? [];
  const svcMap   = Object.fromEntries((services ?? []).map(s => [s.id, s]));

  return (
    <div>
      <PageHeader
        title="Сотрудники"
        subtitle={`${staff.length} мастеров`}
        action={<Button onClick={() => navigate("/staff/new")}>+ Добавить сотрудника</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {staff.map(s => {
          const svcIds = s.services ?? s.service_ids ?? [];
          return (
            <Card key={s.id} className="p-5 cursor-pointer hover:shadow-md transition-shadow active:opacity-70" onClick={() => navigate(`/staff/${s.id}`)}>
              <div className="flex items-center gap-3 mb-3">
                <Avatar initials={s.avatar ?? s.name.split(" ").map(w => w[0]).join("")} size="lg" />
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">{s.name}</div>
                  <div className="text-sm text-gray-500 dark:text-zinc-400">{s.role}</div>
                  <StarRating rating={s.rating ?? 0} />
                </div>
              </div>
              <div className="text-xs text-gray-500 dark:text-zinc-400 mb-2">{s.specialization}</div>
              <div className="text-xs text-gray-400 dark:text-zinc-500 inline-flex items-center gap-1">
                <Icon name="clock" className="w-3.5 h-3.5" />
                {s.working_hours ?? s.workingHours}
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {svcIds.map(sid => {
                  const sv = svcMap[sid];
                  return sv ? <Badge key={sid} color="teal">{sv.name}</Badge> : null;
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── 2.10 Профиль сотрудника (/staff/:id) ──────────────────────
export function StaffProfile() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: s, loading: sLoading, error: sError }         = useAsync(() => getStaffById(id));
  const { data: services }                                      = useAsync(() => getServices());
  const { data: staffApps, loading: appsLoading, error: appsError } = useAsync(() => getAppointmentsByStaff(id));

  const loading = sLoading || appsLoading;
  const error   = sError || appsError;

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error.message} />;
  if (!s)      return <EmptyState icon={<Icon name="user" className="w-6 h-6" />} title="Сотрудник не найден" description="" />;

  const apps   = staffApps ?? [];
  const svcMap = Object.fromEntries((services ?? []).map(sv => [sv.id, sv]));
  const svcIds = s.services ?? s.service_ids ?? [];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/staff")} className="text-gray-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 cursor-pointer text-sm">
          ← Назад
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{s.name}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-4">
          <Card className="p-5 text-center">
            <Avatar initials={s.avatar ?? s.name.split(" ").map(w => w[0]).join("")} size="lg" className="mx-auto mb-2" />
            <div className="font-bold text-gray-900 dark:text-white mt-2">{s.name}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{s.role}</div>
            <StarRating rating={s.rating ?? 0} />
            <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">{s.phone}</div>
          </Card>
          <Card className="p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Расписание</h3>
            <div className="text-sm text-gray-600 dark:text-gray-300">{s.working_hours ?? s.workingHours}</div>
          </Card>
          <Card className="p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Услуги</h3>
            <div className="flex flex-wrap gap-1">
              {svcIds.map(sid => {
                const sv = svcMap[sid];
                return sv ? <Badge key={sid} color="teal">{sv.name}</Badge> : null;
              })}
            </div>
          </Card>
        </div>

        <div className="col-span-2">
          <Card className="p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Статистика и записи</h3>
            <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-4">
              <div className="flex flex-col items-center justify-center min-h-[5.5rem] px-2 py-3 bg-gray-50 dark:bg-zinc-700/50 rounded-lg text-center">
                <div className="text-2xl font-bold text-slate-700 dark:text-zinc-300 tabular-nums leading-none">{apps.length}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-tight">Записей</div>
              </div>
              <div className="flex flex-col items-center justify-center min-h-[5.5rem] px-2 py-3 bg-gray-50 dark:bg-zinc-700/50 rounded-lg text-center">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums leading-none">{apps.filter(x => x.status === "completed").length}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-tight">Завершено</div>
              </div>
              <div className="flex flex-col items-center justify-center min-h-[5.5rem] px-2 py-3 bg-gray-50 dark:bg-zinc-700/50 rounded-lg text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums leading-none break-all sm:break-normal">{apps.reduce((sum, x) => sum + (x.price ?? 0), 0).toLocaleString()}&nbsp;₽</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-tight">Выручка</div>
              </div>
            </div>
            <div className="space-y-2">
              {apps.map(a => {
                const d = a.date && String(a.date).length >= 10 ? String(a.date).slice(0, 10).split("-") : null;
                const dateLine = d ? `${d[2]}.${d[1]} ${a.time}` : `${a.time}`;
                return (
                  <div
                    key={a.id}
                    className="grid grid-cols-[5.25rem_minmax(0,1fr)_auto] sm:grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,6.5rem)_auto_auto] gap-x-2 sm:gap-x-3 gap-y-1 items-center px-3 py-2.5 border border-gray-100 dark:border-zinc-700 rounded-lg text-sm"
                  >
                    <span className="text-gray-400 dark:text-gray-500 tabular-nums text-xs sm:text-sm whitespace-nowrap">{dateLine}</span>
                    <span className="font-medium text-gray-900 dark:text-white min-w-0 truncate">{a.client_name ?? a.clientName}</span>
                    <span className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm min-w-0 truncate hidden sm:block">{a.service}</span>
                    <div className="flex items-center justify-end gap-2 shrink-0 sm:contents">
                      <StatusBadge status={a.status} />
                      <span className="font-semibold text-gray-900 dark:text-white tabular-nums text-right whitespace-nowrap">{(a.price ?? 0).toLocaleString()}&nbsp;₽</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── 2.11 Уведомления (/messages) ──────────────────────────────
export function MessagesPage() {
  const { data: templates, loading: templatesLoading, error: templatesError, execute: reloadTemplates } =
    useAsync(() => getNotificationTemplates());
  const { data: events, loading: eventsLoading, error: eventsError, execute: reloadEvents } =
    useAsync(() => getNotificationEvents(20));
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    trigger_event: "",
    channel: "sms_email",
    subject: "",
    body: "",
    active: true,
  });
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState(null);
  const templatesArr = templates ?? [];
  const eventsArr = events ?? [];

  const channelLabel = (channel) => {
    if (channel === "sms") return "SMS";
    if (channel === "email") return "Email";
    if (channel === "sms_email") return "SMS + Email";
    return channel || "—";
  };

  const toggleTemplate = async (template) => {
    setActionError(null);
    setSaving(true);
    try {
      await updateNotificationTemplate(template.id, { active: !template.active });
      await reloadTemplates();
    } catch (e) {
      setActionError(e?.message ?? "Не удалось изменить статус шаблона");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (t) => {
    setEditingTemplate(t);
    setEditForm({
      name: t.name ?? "",
      trigger_event: t.trigger_event ?? "",
      channel: t.channel ?? "sms_email",
      subject: t.subject ?? "",
      body: t.body ?? "",
      active: t.active !== false,
    });
    setActionError(null);
  };

  const openCreate = () => {
    setEditingTemplate({ id: null });
    setEditForm({
      name: "Новый шаблон",
      trigger_event: "appointment_created",
      channel: "sms_email",
      subject: "",
      body: "Текст уведомления",
      active: true,
    });
    setActionError(null);
  };

  const closeModal = () => {
    setEditingTemplate(null);
    setEditForm({
      name: "",
      trigger_event: "",
      channel: "sms_email",
      subject: "",
      body: "",
      active: true,
    });
  };

  const saveEdit = async () => {
    if (!editingTemplate) return;
    setActionError(null);
    setSaving(true);
    try {
      if (editingTemplate.id == null) {
        await createNotificationTemplate(editForm);
      } else {
        await updateNotificationTemplate(editingTemplate.id, editForm);
      }
      await reloadTemplates();
      closeModal();
    } catch (e) {
      setActionError(e?.message ?? "Не удалось сохранить шаблон");
    } finally {
      setSaving(false);
    }
  };

  const removeTemplate = async (templateId) => {
    if (!window.confirm("Удалить шаблон уведомления?")) return;
    setActionError(null);
    setSaving(true);
    try {
      await deleteNotificationTemplate(templateId);
      await reloadTemplates();
      await reloadEvents();
    } catch (e) {
      setActionError(e?.message ?? "Не удалось удалить шаблон");
    } finally {
      setSaving(false);
    }
  };

  const eventStatusColor = (status) => {
    if (status === "sent") return "green";
    if (status === "failed") return "red";
    if (status === "skipped") return "yellow";
    return "gray";
  };

  const formatDateTime = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div>
      <PageHeader
        title={
          "Уведомления"
        }
        subtitle="Шаблоны и журнал событий берутся из БД. Модель готова для подключения реальных провайдеров SMS/Email."
      />
      {actionError && <ActionErrorBanner message={actionError} />}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">Шаблоны сообщений</h3>
            <Button size="sm" onClick={openCreate}>Новый шаблон</Button>
          </div>
          {templatesLoading ? <LoadingState /> : templatesError ? <ErrorState message={templatesError.message} /> : (
            templatesArr.length === 0 ? (
              <EmptyState title="Шаблонов пока нет" description="Добавьте первый шаблон уведомления." />
            ) : (
              <div className="space-y-2">
                {templatesArr.map(t => (
                  <Card key={t.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white text-sm">{t.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {t.trigger_event} · {channelLabel(t.channel)}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => toggleTemplate(t)}
                        className={`w-10 h-5 rounded-full transition-colors cursor-pointer relative flex-shrink-0 disabled:opacity-60 ${t.active ? "bg-slate-800 dark:bg-slate-600" : "bg-gray-300 dark:bg-zinc-600"}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${t.active ? "translate-x-5" : "translate-x-0.5"}`} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(t)} disabled={saving}>Редактировать</Button>
                      <Button size="sm" variant="ghost" onClick={() => removeTemplate(t.id)} disabled={saving}>Удалить</Button>
                    </div>
                  </Card>
                ))}
              </div>
            )
          )}
        </div>

        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Лог уведомлений</h3>
          {eventsLoading ? <LoadingState /> : eventsError ? <ErrorState message={eventsError.message} /> : (
            eventsArr.length === 0 ? (
              <Card className="p-4">
                <EmptyState title="Пока нет событий" description="После постановки уведомлений в очередь события появятся здесь." />
              </Card>
            ) : (
              <Card>
                <div className="divide-y divide-gray-50 dark:divide-zinc-700">
                  {eventsArr.map((event) => (
                    <div key={event.id} className="px-4 py-3 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {event.event_type} · {channelLabel(event.channel)}
                        </span>
                        <Badge color={eventStatusColor(event.status)}>{event.status}</Badge>
                      </div>
                      <div className="text-gray-400 text-xs">
                        {formatDateTime(event.created_at)} {event.recipient ? `· ${event.recipient}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )
          )}
        </div>
      </div>

      {editingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <Card className="relative z-10 p-6 w-full max-w-md mx-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
              {editingTemplate.id == null ? "Новый шаблон" : "Редактировать шаблон"}
            </h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Название</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/70"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Триггер</label>
                <input
                  type="text"
                  value={editForm.trigger_event}
                  onChange={e => setEditForm(p => ({ ...p, trigger_event: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/70"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Канал</label>
                <select
                  value={editForm.channel}
                  onChange={e => setEditForm(p => ({ ...p, channel: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/70"
                >
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                  <option value="sms_email">SMS + Email</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Тема (опционально)</label>
                <input
                  type="text"
                  value={editForm.subject}
                  onChange={e => setEditForm(p => ({ ...p, subject: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/70"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Текст</label>
                <textarea
                  value={editForm.body}
                  onChange={e => setEditForm(p => ({ ...p, body: e.target.value }))}
                  rows={4}
                  className="w-full border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/70"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={closeModal} disabled={saving}>Отмена</Button>
              <Button onClick={saveEdit} disabled={saving}>{saving ? "Сохранение..." : "Сохранить"}</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ── 2.12 Аналитика (/analytics) ───────────────────────────────
export function AnalyticsPage() {
  const { data: revenueData, loading: revLoading, error: revError } = useAsync(() => getRevenueData());
  const { data: services,    loading: svcLoading }                   = useAsync(() => getServices());
  const { data: staff,       loading: staffLoading }                 = useAsync(() => getStaff());
  const { data: appointments }                                        = useAsync(() => getAppointments());
  const { data: popularServices, loading: popLoading, error: popError } =
    useAsync(() => getPopularServicesStats({ days: 90, limit: 5 }));

  const loading = revLoading || svcLoading || staffLoading || popLoading;
  if (loading) return <LoadingState />;
  if (revError) return <ErrorState message={revError.message} />;
  if (popError) return <ErrorState message={popError.message} />;

  const revenue     = revenueData ?? [];
  const maxRevenue  = revenue.length ? Math.max(...revenue.map(d => d.revenue)) : 1;
  const activeServices = (services ?? []).filter(s => s.active);
  const popular = popularServices ?? [];

  return (
    <div>
      <PageHeader
        title="Аналитика"
        subtitle="Выручка и записи по месяцам — из API. Популярность услуг считается по завершённым записям."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 mb-6 items-stretch">
        <KpiCard label="Выручка за месяц" value={revenue.length ? `${(revenue[revenue.length - 1]?.revenue ?? 0).toLocaleString()} ₽` : "—"} icon={<Icon name="chart" className="w-4 h-4" />} color="violet" />
        <KpiCard label="Записей за месяц" value={revenue.length ? (revenue[revenue.length - 1]?.bookings ?? "—") : "—"} icon={<Icon name="clipboard" className="w-4 h-4" />} color="green" />
        <KpiCard label="Всего клиентов"   value={(appointments ?? []).length} icon={<Icon name="users" className="w-4 h-4" />} color="yellow" />
        <KpiCard label="Активных услуг"   value={activeServices.length} icon={<Icon name="scissors" className="w-4 h-4" />} color="teal" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Выручка по месяцам</h3>
          <div className="flex items-end gap-3 h-40">
            {revenue.map(d => (
              <div key={d.month} className="flex flex-col items-center gap-1 flex-1">
                <div className="text-xs font-medium text-slate-700 dark:text-zinc-300">{(d.revenue / 1000).toFixed(0)}к</div>
                <div className="w-full bg-slate-500 dark:bg-slate-600 rounded-t-md hover:bg-slate-600 dark:hover:bg-slate-500 transition-colors" style={{ height: `${(d.revenue / maxRevenue) * 120}px` }} />
                <div className="text-xs text-gray-400">{d.month}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Популярные услуги</h3>
          {popular.length === 0 ? (
            <EmptyState title="Недостаточно данных" description="Нет завершённых записей по услугам за выбранный период." />
          ) : (
            <div className="space-y-3">
              {popular.map((item, i) => (
                <div key={item.service_id} className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-400 dark:text-gray-500 w-4">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {item.completed_count} · {item.percent}% · {(item.price ?? 0).toLocaleString()} ₽
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-zinc-700 rounded-full">
                      <div className="h-1.5 rounded-full bg-teal-400" style={{ width: `${Math.max(item.percent, 3)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Топ мастера</h3>
          <div className="space-y-3">
            {(staff ?? []).map(s => {
              const sApps    = (appointments ?? []).filter(a => (a.staff_id ?? a.staffId) === s.id && a.status === "completed");
              const sRevenue = sApps.reduce((sum, a) => sum + (a.price ?? 0), 0);
              return (
                <div key={s.id} className="flex items-center gap-3">
                  <Avatar initials={s.avatar ?? s.name.split(" ").map(w => w[0]).join("")} size="sm" />
                  <div className="flex-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-900 dark:text-white">{s.name.split(" ")[0]}</span>
                      <span className="text-gray-500">{sRevenue.toLocaleString()} ₽</span>
                    </div>
                    <StarRating rating={s.rating ?? 0} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Записи по месяцам</h3>
          <div className="flex items-end gap-3 h-40">
            {revenue.map(d => (
              <div key={d.month} className="flex flex-col items-center gap-1 flex-1">
                <div className="text-xs font-medium text-emerald-600">{d.bookings}</div>
                <div className="w-full bg-emerald-400 rounded-t-md hover:bg-emerald-500 transition-colors" style={{ height: `${(d.bookings / 70) * 120}px` }} />
                <div className="text-xs text-gray-400">{d.month}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── 2.13 Настройки (/settings) ────────────────────────────────
export function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");
  const [notifications, setNotifications] = useState(() => {
    try {
      const s = localStorage.getItem("settings_notifications");
      return s ? { ...{ email: true, sms: true, reminderHours: 24 }, ...JSON.parse(s) } : { email: true, sms: true, reminderHours: 24 };
    } catch { return { email: true, sms: true, reminderHours: 24 }; }
  });
  const [booking, setBooking] = useState(() => {
    try {
      const s = localStorage.getItem("settings_booking");
      return s ? { ...{ onlineBooking: true, bufferMinutes: 15, cancellationHours: 24 }, ...JSON.parse(s) } : { onlineBooking: true, bufferMinutes: 15, cancellationHours: 24 };
    } catch { return { onlineBooking: true, bufferMinutes: 15, cancellationHours: 24 }; }
  });
  const { theme, setTheme } = useTheme();

  const { data: bizData, loading, error } = useAsync(() => getBusiness());
  const [biz, setBiz] = useState(null);
  const [saving, setSaving] = useState(false);
  /** Сообщение после сохранения профиля (видно в форме, без alert) */
  const [profileFeedback, setProfileFeedback] = useState(null);
  const profileFeedbackTimer = useRef(null);
  const [localSettingsFeedback, setLocalSettingsFeedback] = useState(null);
  const localSettingsTimer = useRef(null);

  const clearTimer = (ref) => {
    if (ref.current) {
      clearTimeout(ref.current);
      ref.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearTimer(profileFeedbackTimer);
      clearTimer(localSettingsTimer);
    };
  }, []);

  if (bizData && !biz) setBiz({ ...bizData });

  const tabs = [
    { id: "profile",       label: "Профиль бизнеса" },
    { id: "booking",       label: "Настройки записи" },
    { id: "notifications", label: "Уведомления" },
    { id: "appearance",    label: "Оформление" },
    { id: "billing",       label: "Биллинг" },
  ];

  const handleSaveBiz = async () => {
    if (!biz?.id) return;
    setProfileFeedback(null);
    clearTimer(profileFeedbackTimer);
    setSaving(true);
    try {
      const updated = await updateBusiness(biz.id, {
        name: biz.name,
        address: biz.address,
        phone: biz.phone,
        email: biz.email,
        description: biz.description,
      });
      setBiz((p) => ({ ...p, ...updated }));
      window.dispatchEvent(new Event(SAAS_BUSINESS_PROFILE_CHANGED));
      setProfileFeedback({ type: "ok", text: "Изменения сохранены и применены." });
      profileFeedbackTimer.current = setTimeout(() => {
        setProfileFeedback(null);
        profileFeedbackTimer.current = null;
      }, 6000);
    } catch (err) {
      setProfileFeedback({ type: "err", text: err?.message ?? "Не удалось сохранить" });
    } finally {
      setSaving(false);
    }
  };

  const showLocalSaved = (text, type = "ok") => {
    clearTimer(localSettingsTimer);
    setLocalSettingsFeedback({ type, text });
    localSettingsTimer.current = setTimeout(() => {
      setLocalSettingsFeedback(null);
      localSettingsTimer.current = null;
    }, 5000);
  };

  const handleSaveSettings = (key) => {
    try {
      localStorage.setItem(`settings_${key}`, JSON.stringify(key === "booking" ? booking : notifications));
      showLocalSaved("Настройки сохранены в этом браузере.", "ok");
    } catch {
      showLocalSaved("Не удалось записать в браузер — проверьте доступ к хранилищу.", "err");
    }
  };

  return (
    <div>
      <PageHeader title="Настройки" />

      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => {
              setActiveTab(t.id);
              setProfileFeedback(null);
              setLocalSettingsFeedback(null);
            }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer -mb-px ${
              activeTab === t.id ? "border-slate-900 text-slate-900 dark:text-zinc-100 dark:border-zinc-100" : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "profile" && (
        loading ? <LoadingState /> :
        error   ? <ErrorState message={error.message} /> :
        biz ? (
          <Card className="p-6 max-w-lg">
            <div className="space-y-4">
              {[["Название бизнеса", "name"], ["Адрес", "address"], ["Телефон", "phone"], ["Email", "email"]].map(([label, field]) => (
                <div key={field}>
                  <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
                  <input
                    value={biz[field] ?? ""}
                    onChange={(e) => {
                      if (profileFeedback?.type === "ok") {
                        clearTimer(profileFeedbackTimer);
                        setProfileFeedback(null);
                      }
                      setBiz((p) => ({
                        ...p,
                        [field]: field === "phone" ? normalizePhone(e.target.value) : e.target.value,
                      }));
                    }}
                    className="w-full border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/70"
                  />
                </div>
              ))}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Описание</label>
                <textarea
                  value={biz.description ?? ""}
                  onChange={(e) => {
                    if (profileFeedback?.type === "ok") {
                      clearTimer(profileFeedbackTimer);
                      setProfileFeedback(null);
                    }
                    setBiz((p) => ({ ...p, description: e.target.value }));
                  }}
                  rows={3}
                  className="w-full border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/70 resize-none"
                />
              </div>
              {profileFeedback && (
                <div
                  role="status"
                  className={`rounded-lg px-3 py-2.5 text-sm ${
                    profileFeedback.type === "ok"
                      ? "bg-emerald-50 dark:bg-emerald-900/25 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/50"
                      : "bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-900/50"
                  }`}
                >
                  {profileFeedback.type === "ok" ? (
                    <span className="font-medium">✓ {profileFeedback.text}</span>
                  ) : (
                    <span>{profileFeedback.text}</span>
                  )}
                </div>
              )}
              <Button onClick={handleSaveBiz} disabled={saving}>
                {saving ? "Сохранение…" : "Сохранить изменения"}
              </Button>
            </div>
          </Card>
        ) : null
      )}

      {activeTab === "booking" && (
        <Card className="p-6 max-w-lg">
          <div className="space-y-5">
            {localSettingsFeedback && (
              <div
                role="status"
                className={`rounded-lg px-3 py-2.5 text-sm border ${
                  localSettingsFeedback.type === "ok"
                    ? "bg-emerald-50 dark:bg-emerald-900/25 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800/50"
                    : "bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-900/50"
                }`}
              >
                <span className="font-medium">
                  {localSettingsFeedback.type === "ok" ? "✓ " : ""}
                  {localSettingsFeedback.text}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Онлайн-запись</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Разрешить клиентам записываться онлайн</div>
              </div>
              <button onClick={() => setBooking(p => ({ ...p, onlineBooking: !p.onlineBooking }))}
                className={`w-12 h-6 rounded-full transition-colors cursor-pointer relative ${booking.onlineBooking ? "bg-slate-800 dark:bg-slate-600" : "bg-gray-300 dark:bg-zinc-600"}`}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${booking.onlineBooking ? "translate-x-6" : "translate-x-0.5"}`} />
              </button>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Буфер между записями (мин)</label>
              <input type="number" value={booking.bufferMinutes} onChange={e => setBooking(p => ({ ...p, bufferMinutes: +e.target.value }))}
                className="w-full border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/70" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Политика отмены (часов до)</label>
              <input type="number" value={booking.cancellationHours} onChange={e => setBooking(p => ({ ...p, cancellationHours: +e.target.value }))}
                className="w-full border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/70" />
            </div>
            <Button onClick={() => handleSaveSettings("booking")}>Сохранить</Button>
          </div>
        </Card>
      )}

      {activeTab === "notifications" && (
        <Card className="p-6 max-w-lg">
          <div className="space-y-5">
            {localSettingsFeedback && (
              <div
                role="status"
                className={`rounded-lg px-3 py-2.5 text-sm border ${
                  localSettingsFeedback.type === "ok"
                    ? "bg-emerald-50 dark:bg-emerald-900/25 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800/50"
                    : "bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-900/50"
                }`}
              >
                <span className="font-medium">
                  {localSettingsFeedback.type === "ok" ? "✓ " : ""}
                  {localSettingsFeedback.text}
                </span>
              </div>
            )}
            {[["Email уведомления", "email"], ["SMS уведомления", "sms"]].map(([label, field]) => (
              <div key={field} className="flex items-center justify-between">
                <div className="font-medium text-gray-900 dark:text-white">{label}</div>
                <button onClick={() => setNotifications(p => ({ ...p, [field]: !p[field] }))}
                  className={`w-12 h-6 rounded-full transition-colors cursor-pointer relative ${notifications[field] ? "bg-slate-800 dark:bg-slate-600" : "bg-gray-300 dark:bg-zinc-600"}`}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${notifications[field] ? "translate-x-6" : "translate-x-0.5"}`} />
                </button>
              </div>
            ))}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Напоминание за (часов)</label>
              <input type="number" value={notifications.reminderHours} onChange={e => setNotifications(p => ({ ...p, reminderHours: +e.target.value }))}
                className="w-full border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/70" />
            </div>
            <Button onClick={() => handleSaveSettings("notifications")}>Сохранить</Button>
          </div>
        </Card>
      )}

      {activeTab === "appearance" && (
        <Card className="p-6 max-w-lg">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Тема интерфейса</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: "light", icon: <Icon name="sun" className="w-6 h-6" />, label: "Светлая",  desc: "Белый фон, тёмный текст" },
              { id: "dark",  icon: <Icon name="moon" className="w-6 h-6" />, label: "Тёмная",   desc: "Тёмный фон, светлый текст" },
            ].map(t => (
              <button key={t.id} onClick={() => setTheme(t.id)}
                className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${theme === t.id ? "border-slate-400 bg-slate-50 dark:bg-zinc-800/60 dark:border-zinc-600" : "border-gray-200 dark:border-zinc-600 hover:border-gray-300 dark:hover:border-zinc-500"}`}>
                <div className="text-2xl mb-2">{t.icon}</div>
                <div className="font-medium text-gray-900 dark:text-white text-sm">{t.label}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.desc}</div>
                {theme === t.id && <div className="mt-2 text-xs text-slate-700 dark:text-zinc-300 font-medium">✓ Активна</div>}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">Выбор темы сохраняется в браузере автоматически</p>
        </Card>
      )}

      {activeTab === "billing" && <BillingTab />}
    </div>
  );
}

// ── Billing Tab ────────────────────────────────────────────────
function BillingTab() {
  const { subscription, hasActiveSubscription, loading } = useSubscription();
  const [paying, setPaying] = useState(null);
  const [error, setError] = useState(null);

  async function handleChoosePlan(plan) {
    setPaying(plan);
    setError(null);
    try {
      await redirectToPayment(plan);
    } catch (err) {
      setError(err.message);
      setPaying(null);
    }
  }

  if (loading) return <LoadingState />;

  const currentPlan = subscription?.plan;
  const endDate = subscription?.end_date
    ? new Date(subscription.end_date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const plans = [
    { key: "basic", badge: null },
    { key: "pro", badge: "Популярный" },
    { key: "unlimited", badge: null },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      {error && (
        <div className="bg-red-900/30 border border-red-500/40 text-red-300 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {hasActiveSubscription && subscription ? (
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-900 dark:text-zinc-100">
                {PLAN_LIMITS[currentPlan]?.displayName ?? currentPlan} план
              </div>
              {endDate && (
                <div className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">Активен до {endDate}</div>
              )}
            </div>
            <Badge color="indigo">Активен</Badge>
          </div>
        </Card>
      ) : (
        <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg px-4 py-3 text-sm text-amber-300">
          У вас нет активной подписки. Выберите тарифный план ниже.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {plans.map(({ key, badge }) => {
          const plan = PLAN_LIMITS[key];
          const isCurrent = currentPlan === key && hasActiveSubscription;
          return (
            <div
              key={key}
              className={`relative rounded-xl border p-5 flex flex-col transition-all ${
                badge ? "border-violet-500 ring-1 ring-violet-500" : "border-gray-200 dark:border-zinc-700"
              } ${isCurrent ? "bg-violet-50 dark:bg-violet-900/20" : "bg-white dark:bg-zinc-800"}`}
            >
              {badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-xs px-3 py-0.5 rounded-full">
                  {badge}
                </span>
              )}
              <div className="font-semibold text-slate-900 dark:text-zinc-100 mb-1">{plan.displayName}</div>
              <div className="text-xl font-bold text-violet-500 mb-3">
                {plan.priceRub.toLocaleString("ru-RU")} ₽<span className="text-gray-400 text-sm font-normal">/мес</span>
              </div>
              <ul className="space-y-1 text-xs text-gray-500 dark:text-gray-400 flex-1 mb-4">
                <li>Записей: {plan.appointmentsPerMonth === -1 ? "∞" : plan.appointmentsPerMonth}/мес</li>
                <li>Услуги: {plan.servicesLimit === -1 ? "∞" : `до ${plan.servicesLimit}`}</li>
              </ul>
              {isCurrent ? (
                <div className="text-center text-xs text-violet-500 font-medium py-2">Текущий тариф</div>
              ) : (
                <button
                  onClick={() => handleChoosePlan(key)}
                  disabled={paying !== null}
                  className="w-full py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 transition-all"
                >
                  {paying === key ? "Перенаправление..." : `Перейти на ${plan.displayName}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500">
        Оплата через ЮKassa. Подписка активируется автоматически после успешной оплаты.
      </p>
    </div>
  );
}
