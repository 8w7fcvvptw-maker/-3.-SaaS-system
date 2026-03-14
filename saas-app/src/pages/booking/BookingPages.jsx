// ============================================
// ПУБЛИЧНАЯ ЗОНА — СТРАНИЦЫ ЗАПИСИ
// Клиент проходит шаги: услуга → мастер → время → данные → подтверждение
// ============================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import BookingLayout from "../../layouts/BookingLayout";
import { Button, Card, StarRating, Avatar, StatusBadge } from "../../components/ui";
import { business, services, staff, timeSlots } from "../../data/mockData";

// ── 1. Лендинг бизнеса (/book/:slug) ──────────────────────────
export function BookingLanding() {
  const navigate = useNavigate();
  return (
    <BookingLayout>
      <div className="space-y-6">
        {/* Шапка бизнеса */}
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-violet-100 rounded-xl flex items-center justify-center text-3xl">
              {business.logo}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-gray-900">{business.name}</h1>
                <StarRating rating={business.rating} />
                <span className="text-xs text-gray-400">({business.reviews} отзывов)</span>
              </div>
              <p className="text-sm text-gray-600 mb-3">{business.description}</p>
              <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                <span>📍 {business.address}</span>
                <span>📞 {business.phone}</span>
                <span>🕐 {business.hours}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Услуги — краткий список */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Доступные услуги</h2>
          <div className="space-y-2">
            {services.filter(s => s.active).slice(0, 4).map(s => (
              <Card key={s.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{s.name}</div>
                    <div className="text-xs text-gray-500">{s.duration} мин</div>
                  </div>
                </div>
                <div className="font-semibold text-violet-600">{s.price.toLocaleString()} ₽</div>
              </Card>
            ))}
          </div>
        </div>

        {/* Мастера */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Наши мастера</h2>
          <div className="grid grid-cols-3 gap-3">
            {staff.map(s => (
              <Card key={s.id} className="p-4 text-center">
                <Avatar initials={s.avatar} size="lg" className="mx-auto mb-2" />
                <div className="font-medium text-sm text-gray-900">{s.name.split(" ")[0]}</div>
                <div className="text-xs text-gray-500">{s.role}</div>
                <StarRating rating={s.rating} />
              </Card>
            ))}
          </div>
        </div>

        {/* Кнопка записи */}
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
  const categories = ["Все", ...new Set(services.map(s => s.category))];
  const filtered = activeCategory === "Все" ? services.filter(s => s.active) : services.filter(s => s.category === activeCategory && s.active);

  return (
    <BookingLayout currentStep={0}>
      <h2 className="text-xl font-bold text-gray-900 mb-4">Выберите услугу</h2>

      {/* Фильтр категорий */}
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

      {/* Карточки услуг */}
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
                <div className="font-bold text-violet-600">{s.price.toLocaleString()} ₽</div>
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
              <Avatar initials={s.avatar} size="lg" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-gray-900">{s.name}</span>
                  <StarRating rating={s.rating} />
                </div>
                <div className="text-sm text-gray-500 mb-1">{s.role} · {s.specialization}</div>
                <div className="text-xs text-emerald-600 font-medium">⏰ {s.nextAvailable}</div>
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
  const [selectedDate, setSelectedDate] = useState(13);
  const [selectedTime, setSelectedTime] = useState(null);

  // Имитируем 7 дней недели
  const days = [
    { num: 11, day: "Ср", available: false },
    { num: 12, day: "Чт", available: false },
    { num: 13, day: "Пт", available: true },
    { num: 14, day: "Сб", available: true },
    { num: 15, day: "Вс", available: true },
    { num: 16, day: "Пн", available: true },
    { num: 17, day: "Вт", available: true },
  ];

  // Занятые слоты (для демонстрации)
  const busySlots = ["10:00", "10:30", "14:00", "14:30", "15:00"];

  return (
    <BookingLayout currentStep={2}>
      <h2 className="text-xl font-bold text-gray-900 mb-4">Выберите дату и время</h2>

      {/* Выбранная услуга */}
      <Card className="p-3 mb-4 flex items-center gap-3 bg-violet-50 border-violet-100">
        <div className="w-3 h-3 bg-violet-600 rounded-full" />
        <div className="text-sm">
          <span className="font-medium text-violet-900">Стрижка</span>
          <span className="text-violet-600 ml-2">30 мин · 1 200 ₽</span>
        </div>
      </Card>

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

      {/* Сетка времени */}
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
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Имя <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={form.name}
            onChange={update("name")}
            placeholder="Ваше имя"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Телефон <span className="text-red-500">*</span></label>
          <input
            type="tel"
            value={form.phone}
            onChange={update("phone")}
            placeholder="+7 (999) 000-00-00"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={update("email")}
            placeholder="email@example.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Комментарий</label>
          <textarea
            value={form.notes}
            onChange={update("notes")}
            placeholder="Пожелания к мастеру..."
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
          />
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
          <div className="font-semibold text-gray-900">Пятница, 14 марта 2026</div>
          <div className="text-sm text-gray-500">11:00 — 11:30</div>
        </div>
        <div>
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Итого</div>
          <div className="text-2xl font-bold text-violet-600">1 200 ₽</div>
        </div>
      </Card>

      <p className="text-xs text-gray-400 text-center mb-4">
        Нажимая «Записаться», вы соглашаетесь с политикой отмены
      </p>

      <Button size="lg" className="w-full justify-center" onClick={() => navigate("/book/success")}>
        Записаться
      </Button>
    </BookingLayout>
  );
}

// ── 7. Успех (/book/success) ───────────────────────────────────
export function BookingSuccess() {
  const navigate = useNavigate();
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
            <div className="flex justify-between">
              <span className="text-gray-500">Услуга</span>
              <span className="font-medium">Стрижка</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Мастер</span>
              <span className="font-medium">Алексей Краснов</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Дата</span>
              <span className="font-medium">14 марта 2026</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Время</span>
              <span className="font-medium">11:00</span>
            </div>
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
            📞 {business.phone}
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
