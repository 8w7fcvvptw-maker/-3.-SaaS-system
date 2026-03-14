// ============================================
// КАБИНЕТ БИЗНЕСА — СТРАНИЦЫ
// Dashboard, Calendar, Appointments, Clients,
// Services, Staff, Messages, Analytics, Settings
// ============================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import {
  Button, Card, KpiCard, Badge, StatusBadge, Avatar, StarRating, PageHeader, EmptyState
} from "../../components/ui";
import {
  appointments, clients, services, staff, revenueData, business
} from "../../data/mockData";

// ── 2.1 Dashboard (/dashboard) ────────────────────────────────
export function Dashboard() {
  const navigate = useNavigate();
  const todayApps = appointments.filter(a => a.date === "2026-03-14");
  const revenue = todayApps.filter(a => a.status === "completed").reduce((s, a) => s + a.price, 0);

  return (
    <div>
      <PageHeader title="Дашборд" subtitle="Пятница, 14 марта 2026" />

      {/* KPI карточки — 2 на мобильном, 4 на десктопе */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <KpiCard label="Записей сегодня" value={todayApps.length} icon="📋" trend="↑ +2 к вчера" color="violet" />
        <KpiCard label="Выручка сегодня" value={`${revenue.toLocaleString()} ₽`} icon="💰" trend="↑ +12%" color="green" />
        <KpiCard label="Новых клиентов" value="2" icon="👤" trend="За сегодня" color="yellow" />
        <KpiCard label="Отменено" value="1" icon="❌" trend="Из 5 записей" color="red" />
      </div>

      {/* Расписание на сегодня — во всю ширину, без боковой аналитики */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Расписание на сегодня</h3>
          <Button size="sm" variant="ghost" onClick={() => navigate("/calendar")}>Открыть календарь →</Button>
        </div>
        <div className="space-y-2">
          {todayApps.map(a => (
            <div
              key={a.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700/50 cursor-pointer"
              onClick={() => navigate(`/appointments/${a.id}`)}
            >
              <div className="text-sm font-mono font-semibold text-gray-500 dark:text-gray-400 w-12 shrink-0">{a.time}</div>
              <Avatar initials={a.clientName.split(" ").map(w => w[0]).join("")} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{a.clientName}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{a.service} · {a.staffName.split(" ")[0]}</div>
              </div>
              <StatusBadge status={a.status} />
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 shrink-0">{a.price.toLocaleString()} ₽</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── 2.2 Календарь (/calendar) ─────────────────────────────────
export function CalendarPage() {
  const navigate = useNavigate();
  const [view, setView] = useState("day");
  const [selectedStaff, setSelectedStaff] = useState("all");

  // Часовая сетка: 9:00–20:00
  const hours = Array.from({ length: 12 }, (_, i) => `${9 + i}:00`);

  // Фильтрация записей для отображения
  const displayApps = appointments.filter(a =>
    a.date === "2026-03-14" &&
    (selectedStaff === "all" || String(a.staffId) === selectedStaff)
  );

  // Позиция блока: сколько минут от 9:00
  const getTop = (time) => {
    const [h, m] = time.split(":").map(Number);
    return ((h - 9) * 60 + m) * (64 / 60);
  };
  const getHeight = (duration) => duration * (64 / 60);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <PageHeader title="Календарь" subtitle="14 марта 2026" />
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex rounded-lg border border-gray-200 dark:border-zinc-600 overflow-hidden">
            {["day", "week"].map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm transition-colors cursor-pointer ${view === v ? "bg-violet-600 text-white" : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700"}`}
              >
                {v === "day" ? "День" : "Неделя"}
              </button>
            ))}
          </div>
          <Button onClick={() => {}}>+ Запись</Button>
        </div>
      </div>

      {/* Фильтр по мастерам — горизонтальный скролл на мобильном */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setSelectedStaff("all")}
          className={`px-3 py-1.5 rounded-full text-sm border transition-colors cursor-pointer ${selectedStaff === "all" ? "bg-violet-600 text-white border-violet-600" : "text-gray-600 dark:text-gray-300 border-gray-200 dark:border-zinc-600 hover:border-violet-300"}`}
        >
          Все мастера
        </button>
        {staff.map(s => (
          <button
            key={s.id}
            onClick={() => setSelectedStaff(String(s.id))}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors cursor-pointer ${selectedStaff === String(s.id) ? "bg-violet-600 text-white border-violet-600" : "text-gray-600 dark:text-gray-300 border-gray-200 dark:border-zinc-600 hover:border-violet-300"}`}
          >
            <span className="w-5 h-5 bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 rounded-full flex items-center justify-center text-xs">{s.avatar[0]}</span>
            {s.name.split(" ")[0]}
          </button>
        ))}
      </div>

      {/* Сетка дней (для вида "неделя") */}
      {view === "week" && (
        <div className="grid grid-cols-7 gap-1 mb-3">
          {["Пн 10", "Вт 11", "Ср 12", "Чт 13", "Пт 14", "Сб 15", "Вс 16"].map((d, i) => (
            <div key={i} className={`text-center py-2 rounded-lg text-sm cursor-pointer ${i === 4 ? "bg-violet-600 text-white" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700"}`}>
              {d}
            </div>
          ))}
        </div>
      )}

      {/* Временная сетка */}
      <Card className="overflow-hidden">
        <div className="flex">
          {/* Столбец часов */}
          <div className="w-14 shrink-0 border-r border-gray-100">
            {hours.map(h => (
              <div key={h} className="h-16 border-b border-gray-100 flex items-start pt-1 px-2">
                <span className="text-xs text-gray-400">{h}</span>
              </div>
            ))}
          </div>

          {/* Область записей */}
          <div className="flex-1 relative" style={{ height: `${12 * 64}px` }}>
            {/* Горизонтальные линии часов */}
            {hours.map((_, i) => (
              <div key={i} className="absolute w-full border-b border-gray-100" style={{ top: `${i * 64}px` }} />
            ))}

            {/* Блоки записей */}
            {displayApps.map(a => {
              const colors = {
                confirmed: "bg-violet-100 border-violet-400 text-violet-900",
                pending:   "bg-yellow-100 border-yellow-400 text-yellow-900",
                cancelled: "bg-red-100 border-red-300 text-red-700 opacity-60",
                completed: "bg-teal-100 border-teal-400 text-teal-900",
                "no-show": "bg-orange-100 border-orange-300 text-orange-800",
              };
              return (
                <div
                  key={a.id}
                  className={`absolute left-2 right-2 rounded-lg border-l-4 px-2 py-1 cursor-pointer hover:shadow-md transition-shadow text-xs ${colors[a.status]}`}
                  style={{ top: `${getTop(a.time)}px`, height: `${getHeight(a.duration) - 4}px` }}
                  onClick={() => navigate(`/appointments/${a.id}`)}
                >
                  <div className="font-semibold truncate">{a.clientName}</div>
                  <div className="truncate opacity-80">{a.service}</div>
                  <div className="opacity-70">{a.time} · {a.staffName.split(" ")[0]}</div>
                </div>
              );
            })}
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

  const filtered = filter === "all" ? appointments : appointments.filter(a => a.status === filter);

  return (
    <div>
      <PageHeader
        title="Записи"
        subtitle={`${appointments.length} записей`}
        action={<Button onClick={() => {}}>+ Новая запись</Button>}
      />

      {/* Фильтр статусов */}
      <div className="flex gap-2 mb-4">
        {["all", "confirmed", "pending", "completed", "cancelled"].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors cursor-pointer ${filter === s ? "bg-violet-600 text-white border-violet-600" : "text-gray-600 dark:text-gray-300 border-gray-200 dark:border-zinc-600"}`}
          >
            {s === "all" ? "Все" : s === "confirmed" ? "Подтверждено" : s === "pending" ? "Ожидает" : s === "completed" ? "Завершено" : "Отменено"}
          </button>
        ))}
      </div>

      {/* Мобильный вид: карточки */}
      <div className="md:hidden space-y-2">
        {filtered.map(a => (
          <Card
            key={a.id}
            className="p-4 cursor-pointer active:opacity-70"
            onClick={() => navigate(`/appointments/${a.id}`)}
          >
            <div className="flex items-center gap-3 mb-2">
              <Avatar initials={a.clientName.split(" ").map(w => w[0]).join("")} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 dark:text-white truncate">{a.clientName}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{a.service} · {a.staffName.split(" ")[0]}</div>
              </div>
              <StatusBadge status={a.status} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">{a.date.slice(5).replace("-", ".")} в {a.time}</span>
              <span className="font-semibold text-gray-900 dark:text-white">{a.price.toLocaleString()} ₽</span>
            </div>
          </Card>
        ))}
      </div>

      {/* Десктоп вид: таблица */}
      <Card className="hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-zinc-700">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Дата / Время</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Клиент</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Услуга</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Мастер</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Статус</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(a => (
              <tr
                key={a.id}
                className="border-b border-gray-50 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700/50 cursor-pointer"
                onClick={() => navigate(`/appointments/${a.id}`)}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900 dark:text-white">{a.date.slice(5).replace("-", ".")}</div>
                  <div className="text-gray-400 dark:text-gray-500">{a.time}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Avatar initials={a.clientName.split(" ").map(w => w[0]).join("")} size="sm" />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{a.clientName}</div>
                      <div className="text-gray-400 dark:text-gray-500 text-xs">{a.clientPhone}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{a.service}</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{a.staffName.split(" ")[0]}</td>
                <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">{a.price.toLocaleString()} ₽</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ── 2.4 Детали записи (/appointments/:id) ─────────────────────
export function AppointmentDetail() {
  const navigate = useNavigate();
  const a = appointments[0]; // Для демо берём первую запись

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/appointments")} className="text-gray-400 hover:text-gray-600 cursor-pointer">← Назад</button>
        <h1 className="text-xl font-bold text-gray-900">Запись #{a.id}</h1>
        <StatusBadge status={a.status} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          {/* Информация о записи */}
          <Card className="p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Детали записи</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                ["Услуга", a.service],
                ["Длительность", `${a.duration} мин`],
                ["Дата", a.date],
                ["Время", a.time],
                ["Стоимость", `${a.price.toLocaleString()} ₽`],
                ["Мастер", a.staffName],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="text-xs text-gray-400 mb-0.5">{label}</div>
                  <div className="font-medium text-gray-900">{value}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Заметки */}
          <Card className="p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Заметки</h3>
            <textarea
              defaultValue={a.notes || ""}
              placeholder="Добавьте заметку..."
              rows={3}
              className="w-full border border-gray-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          </Card>
        </div>

        {/* Правая колонка — клиент + управление статусом */}
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Клиент</h3>
            <div className="flex items-center gap-3 mb-3">
              <Avatar initials={a.clientName.split(" ").map(w => w[0]).join("")} size="lg" />
              <div>
                <div className="font-semibold text-gray-900">{a.clientName}</div>
                <div className="text-sm text-gray-500">{a.clientPhone}</div>
              </div>
            </div>
            <Button variant="secondary" size="sm" className="w-full justify-center" onClick={() => navigate("/clients/1")}>
              Профиль клиента
            </Button>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Статус</h3>
            <div className="space-y-2">
              {["confirmed", "completed", "cancelled", "no-show"].map(s => (
                <button
                  key={s}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors cursor-pointer ${a.status === s ? "border-violet-400 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300" : "border-gray-200 dark:border-zinc-600 hover:border-gray-300 dark:hover:border-zinc-500"}`}
                >
                  <StatusBadge status={s} />
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── 2.5 Клиенты (/clients) ────────────────────────────────────
export function ClientsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  return (
    <div>
      <PageHeader
        title="Клиенты"
        subtitle={`${clients.length} клиентов`}
        action={<Button onClick={() => {}}>+ Добавить клиента</Button>}
      />

      {/* Поиск */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по имени или телефону..."
          className="w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      {/* Мобильный вид: карточки */}
      <div className="md:hidden space-y-2">
        {filtered.map(c => (
          <Card key={c.id} className="p-4 cursor-pointer active:opacity-70" onClick={() => navigate(`/clients/${c.id}`)}>
            <div className="flex items-center gap-3">
              <Avatar initials={c.name.split(" ").map(w => w[0]).join("")} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 dark:text-white truncate">{c.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{c.phone}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-semibold text-violet-600 dark:text-violet-400 text-sm">{c.totalSpent.toLocaleString()} ₽</div>
                <div className="text-xs text-gray-400">{c.totalVisits} визитов</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Десктоп вид: таблица */}
      <Card className="hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-zinc-700">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Клиент</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Контакты</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Визиты</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Последний</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Выручка</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr
                key={c.id}
                className="border-b border-gray-50 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700/50 cursor-pointer"
                onClick={() => navigate(`/clients/${c.id}`)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Avatar initials={c.name.split(" ").map(w => w[0]).join("")} size="sm" />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{c.name}</div>
                      {c.tags.map(t => <Badge key={t} color={t === "VIP" ? "purple" : t === "Постоянный" ? "teal" : "red"}>{t}</Badge>)}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-gray-700 dark:text-gray-300">{c.phone}</div>
                  <div className="text-gray-400 text-xs">{c.email}</div>
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">{c.totalVisits}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{c.lastVisit.slice(5).replace("-", ".")}</td>
                <td className="px-4 py-3 text-right font-semibold text-violet-600 dark:text-violet-400">{c.totalSpent.toLocaleString()} ₽</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ── 2.6 Профиль клиента (/clients/:id) ────────────────────────
export function ClientProfile() {
  const navigate = useNavigate();
  const c = clients[0];
  const clientApps = appointments.filter(a => a.clientName === c.name);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/clients")} className="text-gray-400 hover:text-gray-600 cursor-pointer">← Назад</button>
        <h1 className="text-xl font-bold text-gray-900">{c.name}</h1>
        {c.tags.map(t => <Badge key={t} color={t === "VIP" ? "purple" : "teal"}>{t}</Badge>)}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-4">
          {/* Контакты */}
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <Avatar initials={c.name.split(" ").map(w => w[0]).join("")} size="lg" />
              <div>
                <div className="font-bold text-gray-900">{c.name}</div>
                <div className="text-sm text-gray-500">{c.phone}</div>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              {[["📧 Email", c.email], ["📞 Телефон", c.phone]].map(([l, v]) => (
                <div key={l} className="flex justify-between">
                  <span className="text-gray-500">{l}</span>
                  <span className="font-medium text-gray-900">{v}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Статистика */}
          <Card className="p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Статистика</h3>
            <div className="space-y-3">
              {[
                ["Всего визитов", c.totalVisits],
                ["Потрачено", `${c.totalSpent.toLocaleString()} ₽`],
                ["Последний визит", c.lastVisit],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between text-sm">
                  <span className="text-gray-500">{l}</span>
                  <span className="font-semibold text-gray-900">{v}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Заметки */}
          <Card className="p-5">
            <h3 className="font-semibold text-gray-900 mb-2">Заметки</h3>
            <textarea defaultValue={c.notes} rows={3} className="w-full border border-gray-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 rounded-lg px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </Card>
        </div>

        {/* История визитов */}
        <div className="col-span-2">
          <Card className="p-5">
            <h3 className="font-semibold text-gray-900 mb-4">История визитов</h3>
            <div className="space-y-2">
              {clientApps.length > 0 ? clientApps.map(a => (
                <div key={a.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg">
                  <div className="text-sm w-24 text-gray-500 shrink-0">{a.date.slice(5).replace("-", ".")} {a.time}</div>
                  <div className="flex-1">
                    <div className="font-medium text-sm text-gray-900">{a.service}</div>
                    <div className="text-xs text-gray-400">{a.staffName}</div>
                  </div>
                  <StatusBadge status={a.status} />
                  <div className="font-semibold text-gray-900">{a.price.toLocaleString()} ₽</div>
                </div>
              )) : (
                <EmptyState icon="📋" title="Нет записей" description="История визитов пуста" />
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
  const categories = ["Все", ...new Set(services.map(s => s.category))];
  const filtered = activeCategory === "Все" ? services : services.filter(s => s.category === activeCategory);

  return (
    <div>
      <PageHeader
        title="Услуги"
        subtitle={`${services.filter(s => s.active).length} активных`}
        action={<Button onClick={() => navigate("/services/new")}>+ Добавить услугу</Button>}
      />

      <div className="flex gap-2 mb-4">
        {categories.map(c => (
          <button key={c} onClick={() => setActiveCategory(c)} className={`px-3 py-1.5 rounded-full text-sm border transition-colors cursor-pointer ${activeCategory === c ? "bg-violet-600 text-white border-violet-600" : "text-gray-600 dark:text-gray-300 border-gray-200 dark:border-zinc-600"}`}>
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map(s => (
          <Card key={s.id} className="p-4 cursor-pointer hover:shadow-md transition-shadow active:opacity-70" onClick={() => navigate(`/services/${s.id}`)}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="font-semibold text-gray-900">{s.name}</span>
              </div>
              <Badge color={s.active ? "green" : "gray"}>{s.active ? "Активна" : "Скрыта"}</Badge>
            </div>
            <p className="text-sm text-gray-500 mb-3">{s.description}</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">⏱ {s.duration} мин · {s.category}</span>
              <span className="font-bold text-violet-600 dark:text-violet-400">{s.price.toLocaleString()} ₽</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── 2.8 Редактор услуги (/services/:id) ───────────────────────
export function ServiceEditor() {
  const navigate = useNavigate();
  const s = services[0];
  const [form, setForm] = useState({ ...s });
  const u = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value }));

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/services")} className="text-gray-400 hover:text-gray-600 cursor-pointer">← Назад</button>
        <h1 className="text-xl font-bold text-gray-900">Редактирование услуги</h1>
      </div>

      <Card className="p-6 max-w-lg">
        <div className="space-y-4">
          {[["Название", "name", "text"], ["Описание", "description", "text"], ["Длительность (мин)", "duration", "number"], ["Цена (₽)", "price", "number"]].map(([label, field, type]) => (
            <div key={field}>
              <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
              <input type={type} value={form[field]} onChange={u(field)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
          ))}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Цвет в календаре</label>
            <div className="flex gap-2">
              {["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"].map(c => (
                <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))} className={`w-8 h-8 rounded-full border-2 cursor-pointer ${form.color === c ? "border-gray-800 scale-110" : "border-white"}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button className="flex-1 justify-center">Сохранить</Button>
            <Button variant="secondary" onClick={() => navigate("/services")}>Отмена</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── 2.9 Сотрудники (/staff) ───────────────────────────────────
export function StaffPage() {
  const navigate = useNavigate();
  return (
    <div>
      <PageHeader
        title="Сотрудники"
        subtitle={`${staff.length} мастеров`}
        action={<Button onClick={() => {}}>+ Добавить сотрудника</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {staff.map(s => (
          <Card key={s.id} className="p-5 cursor-pointer hover:shadow-md transition-shadow active:opacity-70" onClick={() => navigate(`/staff/${s.id}`)}>
            <div className="flex items-center gap-3 mb-3">
              <Avatar initials={s.avatar} size="lg" />
              <div>
                <div className="font-semibold text-gray-900">{s.name}</div>
                <div className="text-sm text-gray-500">{s.role}</div>
                <StarRating rating={s.rating} />
              </div>
            </div>
            <div className="text-xs text-gray-500 mb-2">{s.specialization}</div>
            <div className="text-xs text-gray-400">🕐 {s.workingHours}</div>
            <div className="mt-3 flex flex-wrap gap-1">
              {s.services.map(sid => {
                const sv = services.find(sv => sv.id === sid);
                return sv ? <Badge key={sid} color="teal">{sv.name}</Badge> : null;
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── 2.10 Профиль сотрудника (/staff/:id) ──────────────────────
export function StaffProfile() {
  const navigate = useNavigate();
  const s = staff[0];
  const staffApps = appointments.filter(a => a.staffId === s.id);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/staff")} className="text-gray-400 hover:text-gray-600 cursor-pointer">← Назад</button>
        <h1 className="text-xl font-bold text-gray-900">{s.name}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-4">
          <Card className="p-5 text-center">
            <Avatar initials={s.avatar} size="lg" className="mx-auto mb-2" />
            <div className="font-bold text-gray-900 mt-2">{s.name}</div>
            <div className="text-sm text-gray-500">{s.role}</div>
            <StarRating rating={s.rating} />
            <div className="mt-2 text-xs text-gray-400">{s.phone}</div>
          </Card>
          <Card className="p-5">
            <h3 className="font-semibold text-gray-900 mb-2">Расписание</h3>
            <div className="text-sm text-gray-600">{s.workingHours}</div>
          </Card>
          <Card className="p-5">
            <h3 className="font-semibold text-gray-900 mb-2">Услуги</h3>
            <div className="flex flex-wrap gap-1">
              {s.services.map(sid => {
                const sv = services.find(sv => sv.id === sid);
                return sv ? <Badge key={sid} color="teal">{sv.name}</Badge> : null;
              })}
            </div>
          </Card>
        </div>

        <div className="col-span-2">
          <Card className="p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Статистика и записи</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-violet-600 dark:text-violet-400">{staffApps.length}</div>
                <div className="text-xs text-gray-500">Записей</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-emerald-600">{staffApps.filter(a => a.status === "completed").length}</div>
                <div className="text-xs text-gray-500">Завершено</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{staffApps.reduce((s, a) => s + a.price, 0).toLocaleString()} ₽</div>
                <div className="text-xs text-gray-500">Выручка</div>
              </div>
            </div>
            <div className="space-y-2">
              {staffApps.map(a => (
                <div key={a.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg text-sm">
                  <span className="text-gray-400 w-24 shrink-0">{a.date.slice(5).replace("-", ".")} {a.time}</span>
                  <span className="flex-1 text-gray-900">{a.clientName}</span>
                  <span className="text-gray-500">{a.service}</span>
                  <StatusBadge status={a.status} />
                  <span className="font-semibold text-gray-900 shrink-0">{a.price.toLocaleString()} ₽</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── 2.11 Уведомления (/messages) ──────────────────────────────
export function MessagesPage() {
  const templates = [
    { id: 1, name: "Подтверждение записи", trigger: "При записи", channel: "SMS + Email", active: true },
    { id: 2, name: "Напоминание",          trigger: "За 24 часа",  channel: "SMS",         active: true },
    { id: 3, name: "Отмена записи",        trigger: "При отмене",  channel: "SMS + Email", active: true },
    { id: 4, name: "Follow-up",            trigger: "Через день после",channel: "Email", active: false },
  ];

  return (
    <div>
      <PageHeader title="Уведомления" subtitle="Настройка шаблонов и логи отправки" />

      <div className="grid grid-cols-2 gap-4">
        {/* Шаблоны */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Шаблоны сообщений</h3>
          <div className="space-y-2">
            {templates.map(t => (
              <Card key={t.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{t.name}</div>
                    <div className="text-xs text-gray-500">{t.trigger} · {t.channel}</div>
                  </div>
                  <div className={`w-10 h-5 rounded-full transition-colors cursor-pointer relative ${t.active ? "bg-violet-600" : "bg-gray-300 dark:bg-zinc-600"}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${t.active ? "translate-x-5" : "translate-x-0.5"}`} />
                  </div>
                </div>
                <Button size="sm" variant="ghost">Редактировать</Button>
              </Card>
            ))}
          </div>
        </div>

        {/* Лог уведомлений */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Последние уведомления</h3>
          <Card>
            <div className="divide-y divide-gray-50">
              {appointments.slice(0, 5).map(a => (
                <div key={a.id} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-medium text-gray-900">{a.clientName}</span>
                    <Badge color="green">Отправлено</Badge>
                  </div>
                  <div className="text-gray-400 text-xs">Подтверждение записи · {a.date} {a.time}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── 2.12 Аналитика (/analytics) ───────────────────────────────
export function AnalyticsPage() {
  const maxRevenue = Math.max(...revenueData.map(d => d.revenue));

  return (
    <div>
      <PageHeader title="Аналитика" subtitle="Последние 6 месяцев" />

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <KpiCard label="Выручка за месяц" value="38 000 ₽" icon="💰" trend="↓ -31% к прошлому" color="violet" />
        <KpiCard label="Записей за месяц" value="41" icon="📋" trend="↓ -32% к прошлому" color="green" />
        <KpiCard label="Новых клиентов" value="8" icon="👤" color="yellow" />
        <KpiCard label="Средний чек" value="927 ₽" icon="📊" trend="↑ +2%" color="teal" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* График выручки */}
        <Card className="p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Выручка по месяцам</h3>
          <div className="flex items-end gap-3 h-40">
            {revenueData.map(d => (
              <div key={d.month} className="flex flex-col items-center gap-1 flex-1">
                <div className="text-xs font-medium text-violet-600 dark:text-violet-400">{(d.revenue / 1000).toFixed(0)}к</div>
                <div
                  className="w-full bg-violet-500 rounded-t-md hover:bg-violet-600 transition-colors"
                  style={{ height: `${(d.revenue / maxRevenue) * 120}px` }}
                />
                <div className="text-xs text-gray-400">{d.month}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Топ услуги */}
        <Card className="p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Популярные услуги</h3>
          <div className="space-y-3">
            {services.filter(s => s.active).map((s, i) => (
              <div key={s.id} className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-400 w-4">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">{s.name}</span>
                    <span className="font-medium text-gray-900">{s.price.toLocaleString()} ₽</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full">
                    <div className="h-1.5 rounded-full bg-teal-400" style={{ width: `${100 - i * 15}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Топ мастера */}
        <Card className="p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Топ мастера</h3>
          <div className="space-y-3">
            {staff.map((s, i) => {
              const sApps = appointments.filter(a => a.staffId === s.id && a.status === "completed");
              const revenue = sApps.reduce((sum, a) => sum + a.price, 0);
              return (
                <div key={s.id} className="flex items-center gap-3">
                  <Avatar initials={s.avatar} size="sm" />
                  <div className="flex-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-900">{s.name.split(" ")[0]}</span>
                      <span className="text-gray-500">{revenue.toLocaleString()} ₽</span>
                    </div>
                    <StarRating rating={s.rating} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Бронирования по месяцам */}
        <Card className="p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Записи по месяцам</h3>
          <div className="flex items-end gap-3 h-40">
            {revenueData.map(d => (
              <div key={d.month} className="flex flex-col items-center gap-1 flex-1">
                <div className="text-xs font-medium text-emerald-600">{d.bookings}</div>
                <div
                  className="w-full bg-emerald-400 rounded-t-md hover:bg-emerald-500 transition-colors"
                  style={{ height: `${(d.bookings / 70) * 120}px` }}
                />
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
  const [biz, setBiz] = useState({ ...business });
  const [notifications, setNotifications] = useState({ email: true, sms: true, reminderHours: 24 });
  const [booking, setBooking] = useState({ onlineBooking: true, bufferMinutes: 15, cancellationHours: 24 });
  const { theme, setTheme } = useTheme();

  const tabs = [
    { id: "profile",       label: "Профиль бизнеса" },
    { id: "booking",       label: "Настройки записи" },
    { id: "notifications", label: "Уведомления" },
    { id: "appearance",    label: "Оформление" },
    { id: "billing",       label: "Биллинг" },
  ];

  return (
    <div>
      <PageHeader title="Настройки" />

      {/* Вкладки */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer -mb-px ${
              activeTab === t.id ? "border-violet-600 text-violet-600 dark:text-violet-400 dark:border-violet-400" : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Профиль бизнеса */}
      {activeTab === "profile" && (
        <Card className="p-6 max-w-lg">
          <div className="space-y-4">
            {[["Название бизнеса", "name"], ["Адрес", "address"], ["Телефон", "phone"], ["Email", "email"]].map(([label, field]) => (
              <div key={field}>
                <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
                <input
                  value={biz[field]}
                  onChange={e => setBiz(p => ({ ...p, [field]: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            ))}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Описание</label>
              <textarea
                value={biz.description}
                onChange={e => setBiz(p => ({ ...p, description: e.target.value }))}
                rows={3}
                className="w-full border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              />
            </div>
            <Button>Сохранить изменения</Button>
          </div>
        </Card>
      )}

      {/* Настройки записи */}
      {activeTab === "booking" && (
        <Card className="p-6 max-w-lg">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">Онлайн-запись</div>
                <div className="text-sm text-gray-500">Разрешить клиентам записываться онлайн</div>
              </div>
              <button
                onClick={() => setBooking(p => ({ ...p, onlineBooking: !p.onlineBooking }))}
                className={`w-12 h-6 rounded-full transition-colors cursor-pointer relative ${booking.onlineBooking ? "bg-violet-600" : "bg-gray-300 dark:bg-zinc-600"}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${booking.onlineBooking ? "translate-x-6" : "translate-x-0.5"}`} />
              </button>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Буфер между записями (мин)</label>
              <input type="number" value={booking.bufferMinutes} onChange={e => setBooking(p => ({ ...p, bufferMinutes: +e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Политика отмены (часов до)</label>
              <input type="number" value={booking.cancellationHours} onChange={e => setBooking(p => ({ ...p, cancellationHours: +e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <Button>Сохранить</Button>
          </div>
        </Card>
      )}

      {/* Уведомления */}
      {activeTab === "notifications" && (
        <Card className="p-6 max-w-lg">
          <div className="space-y-5">
            {[["Email уведомления", "email"], ["SMS уведомления", "sms"]].map(([label, field]) => (
              <div key={field} className="flex items-center justify-between">
                <div className="font-medium text-gray-900">{label}</div>
                <button
                  onClick={() => setNotifications(p => ({ ...p, [field]: !p[field] }))}
                  className={`w-12 h-6 rounded-full transition-colors cursor-pointer relative ${notifications[field] ? "bg-violet-600" : "bg-gray-300 dark:bg-zinc-600"}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${notifications[field] ? "translate-x-6" : "translate-x-0.5"}`} />
                </button>
              </div>
            ))}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Напоминание за (часов)</label>
              <input type="number" value={notifications.reminderHours} onChange={e => setNotifications(p => ({ ...p, reminderHours: +e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <Button>Сохранить</Button>
          </div>
        </Card>
      )}

      {/* Оформление — выбор темы */}
      {activeTab === "appearance" && (
        <Card className="p-6 max-w-lg">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Тема интерфейса</h3>
          <div className="grid grid-cols-2 gap-3">
            {/* Светлая тема */}
            <button
              onClick={() => setTheme("light")}
              className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                theme === "light"
                  ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20"
                  : "border-gray-200 dark:border-zinc-600 hover:border-gray-300 dark:hover:border-zinc-500"
              }`}
            >
              <div className="text-2xl mb-2">☀️</div>
              <div className="font-medium text-gray-900 dark:text-white text-sm">Светлая</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Белый фон, тёмный текст</div>
              {theme === "light" && (
                <div className="mt-2 text-xs text-violet-600 dark:text-violet-400 font-medium">✓ Активна</div>
              )}
            </button>
            {/* Тёмная тема */}
            <button
              onClick={() => setTheme("dark")}
              className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                theme === "dark"
                  ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20"
                  : "border-gray-200 dark:border-zinc-600 hover:border-gray-300 dark:hover:border-zinc-500"
              }`}
            >
              <div className="text-2xl mb-2">🌙</div>
              <div className="font-medium text-gray-900 dark:text-white text-sm">Тёмная</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Тёмный фон, светлый текст</div>
              {theme === "dark" && (
                <div className="mt-2 text-xs text-violet-600 dark:text-violet-400 font-medium">✓ Активна</div>
              )}
            </button>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
            Выбор темы сохраняется в браузере автоматически
          </p>
        </Card>
      )}

      {/* Биллинг */}
      {activeTab === "billing" && (
        <Card className="p-6 max-w-lg">
          <div className="flex items-center justify-between mb-4 p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl">
            <div>
              <div className="font-bold text-violet-900 dark:text-violet-200">Pro план</div>
              <div className="text-sm text-violet-600 dark:text-violet-400">Активен до 14 апреля 2026</div>
            </div>
            <Badge color="indigo">Активен</Badge>
          </div>
          <div className="space-y-2 text-sm mb-4">
            {["✓ Неограниченные записи", "✓ До 10 сотрудников", "✓ SMS уведомления", "✓ Аналитика"].map(f => (
              <div key={f} className="text-gray-700">{f}</div>
            ))}
          </div>
          <Button variant="secondary" className="w-full justify-center">Изменить тариф</Button>
        </Card>
      )}
    </div>
  );
}
