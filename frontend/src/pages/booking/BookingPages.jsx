// ============================================
// ПУБЛИЧНАЯ ЗОНА — СТРАНИЦЫ ЗАПИСИ
// Клиент проходит шаги: услуга → мастер → время → данные → подтверждение
// ============================================

import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import BookingLayout from "../../layouts/BookingLayout";
import { Button, Card, StarRating, Avatar, LoadingState, ErrorState, Icon } from "../../components/ui";
import { useAsync } from "../../hooks/useAsync";
import { useBooking } from "../../context/BookingContext";
import { getActiveServices, getStaff, getTimeSlots, getBusySlots, createPublicAppointment } from "../../lib/api";
import { normalizePhone } from "../../lib/phoneUtils";

function escapeIcsText(value) {
  if (value == null || value === "") return "";
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

/** Локальное время без Z (плавающее) — календарь клиента интерпретирует как местное. */
function dateToIcsLocal(dt) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  const h = String(dt.getHours()).padStart(2, "0");
  const min = String(dt.getMinutes()).padStart(2, "0");
  const s = String(dt.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${h}${min}${s}`;
}

/** Собирает .ics для одной записи; возвращает строку или null при невалидных данных. */
function buildBookingIcs({ date, time, serviceName, staffName, businessName, address, phone, price, durationMin, slug, origin }) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date).slice(0, 10))) return null;
  const t = String(time || "09:00").trim();
  const [th, tm] = t.split(":").map((x) => parseInt(x, 10));
  const h = Number.isFinite(th) ? th : 9;
  const min = Number.isFinite(tm) ? tm : 0;
  const [y, mo, d] = String(date).slice(0, 10).split("-").map((x) => parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;

  const start = new Date(y, mo - 1, d, h, min, 0);
  const dur = Math.max(15, Math.min(Number(durationMin) || 60, 24 * 60));
  const end = new Date(start.getTime() + dur * 60 * 1000);

  const title = escapeIcsText(`${serviceName || "Запись"}${businessName ? ` — ${businessName}` : ""}`);
  const lines = [
    `Мастер: ${staffName || "—"}`,
    phone ? `Телефон: ${phone}` : null,
    price != null ? `Сумма: ${Number(price).toLocaleString("ru-RU")} ₽` : null,
    slug && origin ? `Запись: ${origin}/book/${slug}` : null,
  ].filter(Boolean);
  const desc = escapeIcsText(lines.join("\n"));
  const loc = escapeIcsText(address || "");

  const uid = `${Date.now()}-${slug || "book"}@saas-booking`;
  const utcStamp = `${new Date().toISOString().slice(0, 19).replace(/[-:]/g, "")}Z`;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SaaS Booking//RU",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${utcStamp}`,
    `DTSTART:${dateToIcsLocal(start)}`,
    `DTEND:${dateToIcsLocal(end)}`,
    `SUMMARY:${title}`,
    desc ? `DESCRIPTION:${desc}` : null,
    loc ? `LOCATION:${loc}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  return ics;
}

// ── 1. Лендинг бизнеса (/book/:slug) ──────────────────────────
export function BookingLanding() {
  const navigate = useNavigate();
  const { business, businessId, slug } = useBooking();
  const bookingEnabled = business?.online_booking_enabled !== false && business?.booking_settings?.online_booking_enabled !== false;

  const { data: services, loading: svcLoading } = useAsync(
    () => getActiveServices(businessId),
    true,
    [businessId]
  );
  const { data: staffList, loading: staffLoading } = useAsync(
    () => getStaff(businessId),
    true,
    [businessId]
  );

  const loading = svcLoading || staffLoading;
  if (loading) return <BookingLayout><LoadingState /></BookingLayout>;

  const biz = business ?? {};
  const svcs  = (services  ?? []).slice(0, 4);
  const staff = staffList  ?? [];

  return (
    <BookingLayout>
      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-slate-700 dark:text-zinc-200">
              {biz.logo ? biz.logo : <Icon name="scissors" className="w-8 h-8" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">{biz.name}</h1>
                <StarRating rating={biz.rating ?? 0} />
                <span className="text-xs text-gray-400 dark:text-zinc-500">({biz.reviews ?? 0} отзывов)</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-zinc-400 mb-3">{biz.description}</p>
              <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-zinc-400">
                <span className="inline-flex items-center gap-1.5"><Icon name="mapPin" className="w-4 h-4" /> {biz.address}</span>
                <span className="inline-flex items-center gap-1.5"><Icon name="phone" className="w-4 h-4" /> {biz.phone}</span>
                <span className="inline-flex items-center gap-1.5"><Icon name="clock" className="w-4 h-4" /> {biz.hours}</span>
              </div>
            </div>
          </div>
        </Card>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Доступные услуги</h2>
          <div className="space-y-2">
            {svcs.map(s => (
              <Card key={s.id} className="p-4 flex items-center justify-between hover:border-slate-300/80 dark:hover:border-zinc-500 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white text-sm">{s.name}</div>
                    <div className="text-xs text-gray-500 dark:text-zinc-400">{s.duration} мин</div>
                  </div>
                </div>
                <div className="font-semibold text-slate-800 dark:text-zinc-200">{(s.price ?? 0).toLocaleString()} ₽</div>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Наши мастера</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {staff.map(s => (
              <Card key={s.id} className="p-4 text-center">
                <Avatar initials={s.avatar ?? s.name.split(" ").map(w => w[0]).join("")} size="lg" className="mx-auto mb-2" />
                <div className="font-medium text-sm text-gray-900 dark:text-white">{s.name.split(" ")[0]}</div>
                <div className="text-xs text-gray-500 dark:text-zinc-400">{s.role}</div>
                <StarRating rating={s.rating ?? 0} />
              </Card>
            ))}
          </div>
        </div>

        {!bookingEnabled && (
          <Card className="p-4 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700">
            <div className="text-sm text-amber-800 dark:text-amber-200">
              Онлайн-запись временно отключена владельцем салона. Позвоните по телефону, чтобы записаться вручную.
            </div>
          </Card>
        )}

        <Button
          size="lg"
          className="w-full justify-center"
          disabled={!bookingEnabled}
          onClick={() => navigate(`/book/${slug}/services`)}
        >
          Записаться
          <Icon name="chevronRight" className="w-4 h-4" />
        </Button>
      </div>
    </BookingLayout>
  );
}

// ── 2. Выбор услуги (/book/services) ──────────────────────────
export function ServiceSelection() {
  const navigate = useNavigate();
  const { updateBooking, businessId, slug } = useBooking();
  const [activeCategory, setActiveCategory] = useState("Все");
  const { data, loading, error } = useAsync(
    () => getActiveServices(businessId),
    true,
    [businessId]
  );

  if (loading) return <BookingLayout currentStep={0}><LoadingState /></BookingLayout>;
  if (error)   return <BookingLayout currentStep={0}><ErrorState message={error.message} /></BookingLayout>;

  const services   = data ?? [];
  const categories = ["Все", ...new Set(services.map(s => s.category).filter(Boolean))];
  const filtered   = activeCategory === "Все" ? services : services.filter(s => s.category === activeCategory);

  const selectService = (s) => {
    updateBooking({ service: s });
    navigate(`/book/${slug}/staff`);
  };

  return (
    <BookingLayout currentStep={0}>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Выберите услугу</h2>

      <div className="flex flex-wrap gap-2 mb-5">
        {categories.map(c => (
          <button
            key={c}
            onClick={() => setActiveCategory(c)}
            className={`px-3 py-1.5 rounded-full text-sm transition-colors cursor-pointer ${
              activeCategory === c
                ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 border border-gray-200 dark:border-zinc-600 hover:border-slate-400 dark:hover:border-zinc-500"
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
            className="p-4 cursor-pointer hover:border-slate-300 dark:hover:border-zinc-600 hover:shadow-sm transition-all border border-transparent dark:border-zinc-700"
            onClick={() => selectService(s)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: s.color }} />
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">{s.name}</div>
                  <div className="text-sm text-gray-500 dark:text-zinc-400">{s.description}</div>
                </div>
              </div>
              <div className="text-right shrink-0 ml-4">
                <div className="font-bold text-slate-800 dark:text-zinc-200">{(s.price ?? 0).toLocaleString()} ₽</div>
                <div className="text-xs text-gray-400 dark:text-zinc-500">{s.duration} мин</div>
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
  const { updateBooking, businessId, slug } = useBooking();
  const { data, loading, error } = useAsync(() => getStaff(businessId), true, [businessId]);

  if (loading) return <BookingLayout currentStep={1}><LoadingState /></BookingLayout>;
  if (error)   return <BookingLayout currentStep={1}><ErrorState message={error.message} /></BookingLayout>;

  const staff = data ?? [];

  const selectStaff = (s) => {
    updateBooking({ staff: s });
    navigate(`/book/${slug}/calendar`);
  };

  return (
    <BookingLayout currentStep={1}>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Выберите мастера</h2>
      <p className="text-sm text-gray-500 dark:text-zinc-400 mb-5">Или пропустите — мы выберем свободного мастера</p>

      <div className="space-y-3 mb-5">
        {staff.map(s => (
          <Card
            key={s.id}
            className="p-4 cursor-pointer hover:border-slate-300 dark:hover:border-zinc-600 hover:shadow-sm transition-all border border-transparent dark:border-zinc-700"
            onClick={() => selectStaff(s)}
          >
            <div className="flex items-center gap-4">
              <Avatar initials={s.avatar ?? s.name.split(" ").map(w => w[0]).join("")} size="lg" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-gray-900 dark:text-white">{s.name}</span>
                  <StarRating rating={s.rating ?? 0} />
                </div>
                <div className="text-sm text-gray-500 dark:text-zinc-400 mb-1">{s.role} · {s.specialization}</div>
                <div className="text-xs text-slate-600 dark:text-zinc-400 font-medium inline-flex items-center gap-1">
                  <Icon name="clock" className="w-3.5 h-3.5" />
                  {s.next_available ?? s.nextAvailable ?? "Уточните время"}
                </div>
              </div>
              <Icon name="chevronRight" className="w-5 h-5 text-gray-300 dark:text-zinc-600" />
            </div>
          </Card>
        ))}
      </div>

      <Button variant="secondary" className="w-full justify-center" onClick={() => { updateBooking({ staff: null }); navigate(`/book/${slug}/calendar`); }}>
        Любой свободный мастер
      </Button>
    </BookingLayout>
  );
}

// ── 4. Выбор даты и времени (/book/calendar) ──────────────────
export function DateTimeSelection() {
  const navigate = useNavigate();
  const { booking, updateBooking, businessId, slug } = useBooking();
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
  const defaultDay = days[1] ?? days[0];
  const [selectedDateIso, setSelectedDateIso] = useState(defaultDay?.iso ?? null);
  const [selectedTime, setSelectedTime] = useState(null);

  const { data: slots, loading: slotsLoading, error: slotsError } = useAsync(() => getTimeSlots());
  const { data: busy, loading: busyLoading, error: busyError } = useAsync(
    () => getBusySlots(
      selectedDateIso,
      booking.staff?.id,
      businessId,
      slug,
      { serviceId: booking.service?.id ?? null, duration: booking.service?.duration ?? 30 }
    ),
    true,
    [selectedDateIso, booking.staff?.id, businessId, slug, booking.service?.id, booking.service?.duration]
  );

  const loading = slotsLoading || busyLoading;
  const error   = slotsError ?? busyError;

  const timeSlots = slots ?? [];
  const busySlots = busy  ?? [];

  return (
    <BookingLayout currentStep={2}>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Выберите дату и время</h2>

      {/* Выбор даты */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {days.map(d => (
          <button
            key={d.iso}
            disabled={!d.available}
            onClick={() => { setSelectedDateIso(d.iso); setSelectedTime(null); }}
            className={`flex flex-col items-center px-3 py-2 rounded-xl border text-sm min-w-[52px] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              selectedDateIso === d.iso
                ? "bg-slate-900 text-white border-slate-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                : "bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-600 hover:border-slate-400 dark:hover:border-zinc-500"
            }`}
          >
            <span className="text-xs opacity-70">{d.day}</span>
            <span className="font-bold">{d.num}</span>
          </button>
        ))}
      </div>

      {loading ? <LoadingState /> : error ? <ErrorState message={error.message} /> : (
        <>
          <h3 className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-3">Доступное время</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-6 max-h-[11rem] overflow-y-auto pr-1">
            {timeSlots.map(slot => {
              const isBusy = busySlots.includes(slot);
              return (
                <button
                  key={slot}
                  disabled={isBusy}
                  onClick={() => setSelectedTime(slot)}
                  className={`py-2 rounded-lg text-sm border transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                    selectedTime === slot
                      ? "bg-slate-900 text-white border-slate-900 font-medium dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                      : isBusy
                      ? "bg-gray-100 text-gray-300 border-gray-100 dark:bg-zinc-800 dark:text-zinc-600 dark:border-zinc-700"
                      : "bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-600 hover:border-slate-400 dark:hover:border-zinc-500"
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
        onClick={() => {
          updateBooking({ date: selectedDateIso, time: selectedTime });
          navigate(`/book/${slug}/details`);
        }}
      >
        Продолжить {selectedTime ? `· ${selectedTime}` : ""}
      </Button>
    </BookingLayout>
  );
}

// ── 5. Данные клиента (/book/details) ─────────────────────────
export function ClientDetails() {
  const navigate = useNavigate();
  const { booking, updateBooking, slug } = useBooking();
  const [form, setForm] = useState({
    name: booking.clientName || "",
    phone: booking.clientPhone || "",
    email: booking.clientEmail || "",
    notes: booking.notes || "",
  });

  const update = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));
  const valid = form.name.trim() && form.phone.trim();

  const goToConfirm = () => {
    updateBooking({
      clientName: form.name.trim(),
      clientPhone: form.phone.trim(),
      clientEmail: form.email?.trim() || "",
      notes: form.notes?.trim() || "",
    });
    navigate(`/book/${slug}/confirm`);
  };

  return (
    <BookingLayout currentStep={3}>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Ваши данные</h2>
      <p className="text-sm text-gray-500 dark:text-zinc-400 mb-5">Мы отправим подтверждение записи</p>

      <Card className="p-6 space-y-4">
        {[
          ["Имя",        "name",  "text",  "Ваше имя",              true],
          ["Телефон",    "phone", "tel",   "+7 (999) 000-00-00",    true],
          ["Email",      "email", "email", "email@example.com",     false],
        ].map(([label, field, type, placeholder, required]) => (
          <div key={field}>
            <label className="text-sm font-medium text-gray-700 dark:text-zinc-300 block mb-1">
              {label} {required && <span className="text-red-500">*</span>}
            </label>
            <input type={type} value={form[field]} onChange={field === "phone" ? (e) => setForm(p => ({ ...p, phone: normalizePhone(e.target.value) })) : update(field)} placeholder={placeholder}
              className="w-full border border-gray-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-slate-400/70 dark:focus:ring-zinc-500" />
          </div>
        ))}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-zinc-300 block mb-1">Комментарий</label>
          <textarea value={form.notes} onChange={update("notes")} placeholder="Пожелания к мастеру..." rows={3}
            className="w-full border border-gray-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-slate-400/70 dark:focus:ring-zinc-500 resize-none" />
        </div>
      </Card>

      <Button className="w-full justify-center mt-4" disabled={!valid} onClick={goToConfirm}>
        Перейти к подтверждению
      </Button>
    </BookingLayout>
  );
}

// ── 6. Подтверждение (/book/confirm) ──────────────────────────
export function BookingConfirm() {
  const navigate = useNavigate();
  const { booking, resetBooking, businessId, slug } = useBooking();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const { service, staff, date, time, clientName, clientPhone, clientEmail, notes } = booking;
  const duration = service?.duration ?? 30;
  const price = service?.price ?? 0;
  const dateStr = date ? new Date(date + "T12:00:00").toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";
  const staffName = staff?.name ?? "Любой мастер";
  const staffRole = staff?.role ?? "";

  const handleBook = async () => {
    if (!businessId) {
      setSubmitError("Не удалось определить салон.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createPublicAppointment({
        slug,
        client_name: clientName || "Клиент",
        client_phone: clientPhone || "",
        client_email: clientEmail || "",
        service_id: service?.id,
        staff_id: staff?.id ?? null,
        date: date || new Date().toISOString().slice(0, 10),
        time: time || "10:00",
        duration,
        price,
        notes: notes || null,
      });
      resetBooking();
      navigate(`/book/${slug}/success`, {
        state: { service, staff, date, time, clientPhone, price },
      });
    } catch (err) {
      setSubmitError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <BookingLayout currentStep={4}>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Подтвердите запись</h2>

      <Card className="p-6 space-y-4 mb-4">
        <div className="pb-4 border-b border-gray-100 dark:border-zinc-700">
          <div className="text-xs text-gray-400 dark:text-zinc-500 uppercase tracking-wide mb-1">Услуга</div>
          <div className="font-semibold text-gray-900 dark:text-white">{service?.name ?? "—"}</div>
          <div className="text-sm text-gray-500 dark:text-zinc-400">{duration} минут</div>
        </div>
        <div className="pb-4 border-b border-gray-100 dark:border-zinc-700">
          <div className="text-xs text-gray-400 dark:text-zinc-500 uppercase tracking-wide mb-1">Мастер</div>
          <div className="flex items-center gap-3">
            <Avatar initials={staffName.split(" ").map(w => w[0]).join("").slice(0, 2) || "?"} />
            <div>
              <div className="font-semibold text-gray-900 dark:text-white">{staffName}</div>
              <div className="text-sm text-gray-500 dark:text-zinc-400">{staffRole}</div>
            </div>
          </div>
        </div>
        <div className="pb-4 border-b border-gray-100 dark:border-zinc-700">
          <div className="text-xs text-gray-400 dark:text-zinc-500 uppercase tracking-wide mb-1">Дата и время</div>
          <div className="font-semibold text-gray-900 dark:text-white">{dateStr || "—"}</div>
          <div className="text-sm text-gray-500 dark:text-zinc-400">{time ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400 dark:text-zinc-500 uppercase tracking-wide mb-1">Итого</div>
          <div className="text-2xl font-bold text-slate-800 dark:text-zinc-200">{(price ?? 0).toLocaleString()} ₽</div>
        </div>
      </Card>

      {submitError && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-lg text-sm text-red-700 dark:text-red-300">
          Ошибка: {submitError}
        </div>
      )}

      <p className="text-xs text-gray-400 dark:text-zinc-500 text-center mb-4">
        Нажимая «Записаться», вы соглашаетесь с политикой отмены
      </p>

      <Button size="lg" className="w-full justify-center" onClick={handleBook} disabled={submitting || !businessId}>
        {submitting ? "Отправка..." : !businessId ? "Нет данных салона" : "Записаться"}
      </Button>
    </BookingLayout>
  );
}

// ── 7. Успех (/book/success) ───────────────────────────────────
export function BookingSuccess() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { business, slug } = useBooking();
  const [calendarError, setCalendarError] = useState(null);

  const { service, staff, date, time, clientPhone, price } = state ?? {};
  const dateStr = date ? new Date(date + "T12:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) : "";
  const staffName = staff?.name ?? "Любой мастер";

  const handleAddToCalendar = () => {
    setCalendarError(null);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const ics = buildBookingIcs({
      date,
      time,
      serviceName: service?.name,
      staffName,
      businessName: business?.name,
      address: business?.address,
      phone: clientPhone || business?.phone,
      price: price ?? service?.price,
      durationMin: service?.duration,
      slug,
      origin,
    });
    if (!ics) {
      setCalendarError("Нет даты или времени записи. Оформите запись заново.");
      return;
    }
    try {
      const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `zapis-${String(date).slice(0, 10)}.ics`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setCalendarError("Не удалось скачать файл календаря. Попробуйте другой браузер.");
    }
  };

  return (
    <BookingLayout>
      <div className="text-center py-8">
        <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full flex items-center justify-center mx-auto mb-4">
          <Icon name="checkCircle" className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Запись подтверждена!</h2>
        <p className="text-gray-500 dark:text-zinc-400 mb-6">Мы отправили подтверждение на ваш телефон</p>

        <Card className="p-5 text-left mb-6">
          <div className="space-y-2 text-sm">
            {[
              ["Услуга", service?.name ?? "—"],
              ["Мастер", staffName],
              ["Дата", dateStr || "—"],
              ["Время", time ?? "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="text-gray-500 dark:text-zinc-400">{label}</span>
                <span className="font-medium text-gray-900 dark:text-white">{value}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-gray-100 dark:border-zinc-700 pt-2 mt-2">
              <span className="text-gray-500 dark:text-zinc-400">Сумма</span>
              <span className="font-bold text-slate-800 dark:text-zinc-200">{(price ?? service?.price ?? 0).toLocaleString()} ₽</span>
            </div>
          </div>
        </Card>

        {calendarError && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-3 text-center" role="alert">
            {calendarError}
          </p>
        )}

        <div className="space-y-3">
          <Button variant="secondary" className="w-full justify-center" type="button" onClick={handleAddToCalendar}>
            <Icon name="calendar" className="w-4 h-4" />
            Добавить в календарь
          </Button>
          <Button variant="secondary" className="w-full justify-center">
            <Icon name="phone" className="w-4 h-4" />
            {clientPhone || business?.phone || "+7 (495) 000-00-00"}
          </Button>
          <button
            type="button"
            onClick={() => navigate(`/book/${slug}`)}
            className="text-sm text-gray-400 dark:text-zinc-500 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
          >
            Вернуться к главной
          </button>
        </div>
      </div>
    </BookingLayout>
  );
}
