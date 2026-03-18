// ============================================
// ПУБЛИЧНАЯ ЗОНА — СТРАНИЦЫ ЗАПИСИ
// Клиент проходит шаги: услуга → мастер → время → данные → подтверждение
// ============================================

import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import BookingLayout from "../../layouts/BookingLayout";
import { Button, Card, StarRating, Avatar, StatusBadge, LoadingState, ErrorState } from "../../components/ui";
import { useAsync } from "../../hooks/useAsync";
import { getBusiness, getActiveServices, getStaff, getTimeSlots, getBusySlots, createAppointment } from "../../lib/api";

// ── 1. Лендинг бизнеса (/book/:slug) ──────────────────────────
export function BookingLanding() {
  const navigate = useNavigate();
  const { slug } = useParams();

  const { data: business,  loading: bizLoading,    error: bizError }    = useAsync(() => getBusiness(slug));
  const { data: services,  loading: svcLoading }                        = useAsync(() => getActiveServices());
  const { data: staffList, loading: staffLoading }                      = useAsync(() => getStaff());

  const loading = bizLoading || svcLoading || staffLoading;
  if (loading) return <BookingLayout><LoadingState /></BookingLayout>;
  if (bizError) return <BookingLayout><ErrorState message={bizError.message} /></BookingLayout>;

  const biz   = business   ?? {};
  const svcs  = (services  ?? []).slice(0, 4);
  const staff = staffList  ?? [];

  return (
    <BookingLayout>
      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-violet-100 rounded-xl flex items-center justify-center text-3xl">
              {biz.logo ?? "🏢"}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-gray-900">{biz.name}</h1>
                <StarRating rating={biz.rating ?? 0} />
                <span className="text-xs text-gray-400">({biz.reviews ?? 0} отзывов)</span>
              </div>
              <p className="text-sm text-gray-600 mb-3">{biz.description}</p>
              <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                <span>📍 {biz.address}</span>
                <span>📞 {biz.phone}</span>
                <span>🕐 {biz.hours}</span>
              </div>
            </div>
          </div>
        </Card>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Доступные услуги</h2>
          <div className="space-y-2">
            {svcs.map(s => (
              <Card key={s.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{s.name}</div>
                    <div className="text-xs text-gray-500">{s.duration} мин</div>
                  </div>
                </div>
                <div className="font-semibold text-violet-600">{(s.price ?? 0).toLocaleString()} ₽</div>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Наши мастера</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {staff.map(s => (
              <Card key={s.id} className="p-4 text-center">
                <Avatar initials={s.avatar ?? s.name.split(" ").map(w => w[0]).join("")} size="lg" className="mx-auto mb-2" />
                <div className="font-medium text-sm text-gray-900">{s.name.split(" ")[0]}</div>
                <div className="text-xs text-gray-500">{s.role}</div>
                <StarRating rating={s.rating ?? 0} />
              </Card>
            ))}
          </div>
        </div>

        <Button size="lg" className="w-full justify-center" onClick={() => navigate("/book/services")}>
          Записаться →
        </Button>
      </div>
    </BookingLayout>
  );
}

// ── 2. Выбор услуги (/book/services) ──────────────────────────
export function ServiceSelection() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("Все");
  const { data, loading, error } = useAsync(() => getActiveServices());

  if (loading) return <BookingLayout currentStep={0}><LoadingState /></BookingLayout>;
  if (error)   return <BookingLayout currentStep={0}><ErrorState message={error.message} /></BookingLayout>;

  const services   = data ?? [];
  const categories = ["Все", ...new Set(services.map(s => s.category))];
  const filtered   = activeCategory === "Все" ? services : services.filter(s => s.category === activeCategory);

  return (
    <BookingLayout currentStep={0}>
      <h2 className="text-xl font-bold text-gray-900 mb-4">Выберите услугу</h2>

      <div className="flex flex-wrap gap-2 mb-5">
        {categories.map(c => (
          <button
            key={c}
            onClick={() => setActiveCategory(c)}
            className={`px-3 py-1.5 rounded-full text-sm transition-colors cursor-pointer ${
              activeCategory === c ? "bg-violet-600 text-white" : "bg-white text-gray-600 border border-gray-300 hover:border-violet-300"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(s => (
          <Card
            key={s.id}
            className="p-4 cursor-pointer hover:border-violet-300 hover:shadow-md transition-all border border-transparent"
            onClick={() => navigate("/book/staff")}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: s.color }} />
                <div>
                  <div className="font-semibold text-gray-900">{s.name}</div>
                  <div className="text-sm text-gray-500">{s.description}</div>
                </div>
              </div>
              <div className="text-right shrink-0 ml-4">
                <div className="font-bold text-violet-600">{(s.price ?? 0).toLocaleString()} ₽</div>
                <div className="text-xs text-gray-400">{s.duration} мин</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </BookingLayout>
  );
}

// ── 3. Выбор мастера (/book/staff) ────────────────────────────
export function StaffSelection() {
  const navigate = useNavigate();
  const { data, loading, error } = useAsync(() => getStaff());

  if (loading) return <BookingLayout currentStep={1}><LoadingState /></BookingLayout>;
  if (error)   return <BookingLayout currentStep={1}><ErrorState message={error.message} /></BookingLayout>;

  const staff = data ?? [];

  return (
    <BookingLayout currentStep={1}>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Выберите мастера</h2>
      <p className="text-sm text-gray-500 mb-5">Или пропустите — мы выберем свободного мастера</p>

      <div className="space-y-3 mb-5">
        {staff.map(s => (
          <Card
            key={s.id}
            className="p-4 cursor-pointer hover:border-violet-300 hover:shadow-md transition-all border border-transparent"
            onClick={() => navigate("/book/calendar")}
          >
            <div className="flex items-center gap-4">
              <Avatar initials={s.avatar ?? s.name.split(" ").map(w => w[0]).join("")} size="lg" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-gray-900">{s.name}</span>
                  <StarRating rating={s.rating ?? 0} />
                </div>
                <div className="text-sm text-gray-500 mb-1">{s.role} · {s.specialization}</div>
                <div className="text-xs text-emerald-600 font-medium">⏰ {s.next_available ?? s.nextAvailable ?? "Уточните время"}</div>
              </div>
              <span className="text-gray-300 text-xl">›</span>
            </div>
          </Card>
        ))}
      </div>

      <Button variant="secondary" className="w-full justify-center" onClick={() => navigate("/book/calendar")}>
        Любой свободный мастер
      </Button>
    </BookingLayout>
  );
}

// ── 4. Выбор даты и времени (/book/calendar) ──────────────────
export function DateTimeSelection() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);

  const { data: slots, loading: slotsLoading, error: slotsError } = useAsync(() => getTimeSlots());
  const { data: busy,  loading: busyLoading,  error: busyError  } = useAsync(
    () => getBusySlots(selectedDate ? new Date(new Date().getFullYear(), new Date().getMonth(), selectedDate).toISOString().slice(0, 10) : null),
    false
  );

  // Генерируем 7 дней начиная со вчера
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 1 + i);
    return {
      num: d.getDate(),
      day: d.toLocaleDateString("ru-RU", { weekday: "short" }),
      available: i >= 1,
      iso: d.toISOString().slice(0, 10),
    };
  });

  if (!selectedDate && days[1]) setSelectedDate(days[1].num);

  const loading = slotsLoading || busyLoading;
  const error   = slotsError ?? busyError;

  const timeSlots = slots ?? [];
  const busySlots = busy  ?? [];

  return (
    <BookingLayout currentStep={2}>
      <h2 className="text-xl font-bold text-gray-900 mb-4">Выберите дату и время</h2>

      {/* Выбор даты */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {days.map(d => (
          <button
            key={d.num}
            disabled={!d.available}
            onClick={() => { setSelectedDate(d.num); setSelectedTime(null); }}
            className={`flex flex-col items-center px-3 py-2 rounded-xl border text-sm min-w-[52px] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              selectedDate === d.num
                ? "bg-violet-600 text-white border-violet-600"
                : "bg-white text-gray-700 border-gray-200 hover:border-violet-300"
            }`}
          >
            <span className="text-xs opacity-70">{d.day}</span>
            <span className="font-bold">{d.num}</span>
          </button>
        ))}
      </div>

      {loading ? <LoadingState /> : error ? <ErrorState message={error.message} /> : (
        <>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Доступное время</h3>
          <div className="grid grid-cols-4 gap-2 mb-6">
            {timeSlots.map(slot => {
              const isBusy = busySlots.includes(slot);
              return (
                <button
                  key={slot}
                  disabled={isBusy}
                  onClick={() => setSelectedTime(slot)}
                  className={`py-2 rounded-lg text-sm border transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                    selectedTime === slot
                      ? "bg-violet-600 text-white border-violet-600 font-medium"
                      : isBusy
                      ? "bg-gray-100 text-gray-300 border-gray-100"
                      : "bg-white text-gray-700 border-gray-200 hover:border-violet-300"
                  }`}
                >
                  {slot}
                </button>
              );
            })}
          </div>
        </>
      )}

      <Button
        className="w-full justify-center"
        disabled={!selectedTime}
        onClick={() => navigate("/book/details")}
      >
        Продолжить {selectedTime ? `· ${selectedTime}` : ""}
      </Button>
    </BookingLayout>
  );
}

// ── 5. Данные клиента (/book/details) ─────────────────────────
export function ClientDetails() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });

  const update = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));
  const valid = form.name.trim() && form.phone.trim();

  return (
    <BookingLayout currentStep={3}>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Ваши данные</h2>
      <p className="text-sm text-gray-500 mb-5">Мы отправим подтверждение записи</p>

      <Card className="p-6 space-y-4">
        {[
          ["Имя",        "name",  "text",  "Ваше имя",              true],
          ["Телефон",    "phone", "tel",   "+7 (999) 000-00-00",    true],
          ["Email",      "email", "email", "email@example.com",     false],
        ].map(([label, field, type, placeholder, required]) => (
          <div key={field}>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              {label} {required && <span className="text-red-500">*</span>}
            </label>
            <input type={type} value={form[field]} onChange={update(field)} placeholder={placeholder}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
        ))}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Комментарий</label>
          <textarea value={form.notes} onChange={update("notes")} placeholder="Пожелания к мастеру..." rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
        </div>
      </Card>

      <Button className="w-full justify-center mt-4" disabled={!valid} onClick={() => navigate("/book/confirm")}>
        Перейти к подтверждению
      </Button>
    </BookingLayout>
  );
}

// ── 6. Подтверждение (/book/confirm) ──────────────────────────
export function BookingConfirm() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const handleBook = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      // В реальном проекте сюда передаются выбранные данные через context/state
      await createAppointment({
        service: "Стрижка",
        date: new Date().toISOString().slice(0, 10),
        time: "11:00",
        duration: 30,
        price: 1200,
        status: "pending",
      });
      navigate("/book/success");
    } catch (err) {
      setSubmitError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <BookingLayout currentStep={4}>
      <h2 className="text-xl font-bold text-gray-900 mb-4">Подтвердите запись</h2>

      <Card className="p-6 space-y-4 mb-4">
        <div className="pb-4 border-b border-gray-100">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Услуга</div>
          <div className="font-semibold text-gray-900">Стрижка</div>
          <div className="text-sm text-gray-500">30 минут</div>
        </div>
        <div className="pb-4 border-b border-gray-100">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Мастер</div>
          <div className="flex items-center gap-3">
            <Avatar initials="АК" />
            <div>
              <div className="font-semibold text-gray-900">Алексей Краснов</div>
              <div className="text-sm text-gray-500">Старший барбер</div>
            </div>
          </div>
        </div>
        <div className="pb-4 border-b border-gray-100">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Дата и время</div>
          <div className="font-semibold text-gray-900">
            {new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
          <div className="text-sm text-gray-500">11:00 — 11:30</div>
        </div>
        <div>
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Итого</div>
          <div className="text-2xl font-bold text-violet-600">1 200 ₽</div>
        </div>
      </Card>

      {submitError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          Ошибка: {submitError}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center mb-4">
        Нажимая «Записаться», вы соглашаетесь с политикой отмены
      </p>

      <Button size="lg" className="w-full justify-center" onClick={handleBook} disabled={submitting}>
        {submitting ? "Отправка..." : "Записаться"}
      </Button>
    </BookingLayout>
  );
}

// ── 7. Успех (/book/success) ───────────────────────────────────
export function BookingSuccess() {
  const navigate = useNavigate();
  const { data: business } = useAsync(() => getBusiness());

  return (
    <BookingLayout>
      <div className="text-center py-8">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-4">
          ✅
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Запись подтверждена!</h2>
        <p className="text-gray-500 mb-6">Мы отправили подтверждение на ваш телефон</p>

        <Card className="p-5 text-left mb-6">
          <div className="space-y-2 text-sm">
            {[
              ["Услуга", "Стрижка"],
              ["Мастер", "Алексей Краснов"],
              ["Дата",   new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })],
              ["Время",  "11:00"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="text-gray-500">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-gray-100 pt-2 mt-2">
              <span className="text-gray-500">Сумма</span>
              <span className="font-bold text-violet-600">1 200 ₽</span>
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          <Button variant="secondary" className="w-full justify-center">
            📅 Добавить в календарь
          </Button>
          <Button variant="secondary" className="w-full justify-center">
            📞 {business?.phone ?? "+7 (495) 000-00-00"}
          </Button>
          <button
            onClick={() => navigate("/book/barbershop")}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          >
            ← Вернуться к главной
          </button>
        </div>
      </div>
    </BookingLayout>
  );
}
