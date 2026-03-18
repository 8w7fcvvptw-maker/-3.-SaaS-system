// ============================================
// МОКОВЫЕ ДАННЫЕ — заменят реальный API в будущем
// ============================================

// Данные бизнеса
export const business = {
  name: "Barbershop Premium",
  logo: "✂️",
  description: "Профессиональный барбершоп в центре города. Стрижки, бороды, уход.",
  address: "ул. Пушкина, 12, Москва",
  phone: "+7 (495) 123-45-67",
  email: "info@barbershop.ru",
  hours: "Пн–Вс: 09:00–21:00",
  rating: 4.8,
  reviews: 124,
  timezone: "Europe/Moscow",
};

// Список услуг
export const services = [
  { id: 1, name: "Стрижка", duration: 30, price: 1200, category: "Стрижки", active: true, color: "#6366f1", description: "Классическая стрижка машинкой и ножницами" },
  { id: 2, name: "Стрижка + борода", duration: 60, price: 1800, category: "Комплекс", active: true, color: "#8b5cf6", description: "Стрижка и оформление бороды" },
  { id: 3, name: "Оформление бороды", duration: 30, price: 800, category: "Борода", active: true, color: "#a78bfa", description: "Стрижка и оформление бороды" },
  { id: 4, name: "Королевское бритьё", duration: 45, price: 1500, category: "Борода", active: true, color: "#7c3aed", description: "Бритьё опасной бритвой с горячим полотенцем" },
  { id: 5, name: "Детская стрижка", duration: 20, price: 700, category: "Стрижки", active: true, color: "#4f46e5", description: "Стрижка для детей до 12 лет" },
  { id: 6, name: "Тонирование", duration: 40, price: 2000, category: "Окрашивание", active: false, color: "#818cf8", description: "Тонирование волос и бороды" },
];

// Список сотрудников
export const staff = [
  { id: 1, name: "Алексей Краснов", role: "Старший барбер", avatar: "АК", rating: 4.9, specialization: "Классика, фейды", services: [1, 2, 3, 4], nextAvailable: "Сегодня 14:00", phone: "+7 (999) 111-22-33", workingHours: "Вт–Вс: 10:00–20:00" },
  { id: 2, name: "Дмитрий Волков",  role: "Барбер",         avatar: "ДВ", rating: 4.7, specialization: "Современные стрижки", services: [1, 2, 5], nextAvailable: "Сегодня 15:30", phone: "+7 (999) 444-55-66", workingHours: "Пн–Пт: 09:00–19:00" },
  { id: 3, name: "Кирилл Смирнов",  role: "Барбер",         avatar: "КС", rating: 4.6, specialization: "Бороды, опасное бритьё", services: [3, 4], nextAvailable: "Завтра 10:00",   phone: "+7 (999) 777-88-99", workingHours: "Пн–Сб: 11:00–21:00" },
];

// Записи (appointments)
export const appointments = [
  { id: 1,  clientName: "Иван Петров",    clientPhone: "+7 (999) 100-00-01", service: "Стрижка",            serviceId: 1, staffId: 1, staffName: "Алексей Краснов", date: "2026-03-14", time: "10:00", duration: 30, price: 1200, status: "confirmed",  notes: "" },
  { id: 2,  clientName: "Сергей Иванов",  clientPhone: "+7 (999) 100-00-02", service: "Стрижка + борода",   serviceId: 2, staffId: 2, staffName: "Дмитрий Волков",  date: "2026-03-14", time: "11:00", duration: 60, price: 1800, status: "confirmed",  notes: "Постоянный клиент" },
  { id: 3,  clientName: "Михаил Сидоров", clientPhone: "+7 (999) 100-00-03", service: "Оформление бороды", serviceId: 3, staffId: 3, staffName: "Кирилл Смирнов",  date: "2026-03-14", time: "12:00", duration: 30, price: 800,  status: "pending",    notes: "" },
  { id: 4,  clientName: "Антон Козлов",   clientPhone: "+7 (999) 100-00-04", service: "Стрижка",            serviceId: 1, staffId: 1, staffName: "Алексей Краснов", date: "2026-03-14", time: "13:00", duration: 30, price: 1200, status: "completed",  notes: "" },
  { id: 5,  clientName: "Павел Новиков",  clientPhone: "+7 (999) 100-00-05", service: "Королевское бритьё", serviceId: 4, staffId: 3, staffName: "Кирилл Смирнов",  date: "2026-03-14", time: "14:00", duration: 45, price: 1500, status: "cancelled",  notes: "Отменил за час" },
  { id: 6,  clientName: "Виктор Морозов", clientPhone: "+7 (999) 100-00-06", service: "Стрижка",            serviceId: 1, staffId: 2, staffName: "Дмитрий Волков",  date: "2026-03-15", time: "10:00", duration: 30, price: 1200, status: "confirmed",  notes: "" },
  { id: 7,  clientName: "Роман Лебедев",  clientPhone: "+7 (999) 100-00-07", service: "Детская стрижка",    serviceId: 5, staffId: 2, staffName: "Дмитрий Волков",  date: "2026-03-15", time: "11:00", duration: 20, price: 700,  status: "confirmed",  notes: "" },
  { id: 8,  clientName: "Николай Попов",  clientPhone: "+7 (999) 100-00-08", service: "Стрижка + борода",   serviceId: 2, staffId: 1, staffName: "Алексей Краснов", date: "2026-03-15", time: "13:00", duration: 60, price: 1800, status: "pending",    notes: "" },
  { id: 9,  clientName: "Евгений Соколов",clientPhone: "+7 (999) 100-00-09", service: "Стрижка",            serviceId: 1, staffId: 1, staffName: "Алексей Краснов", date: "2026-03-16", time: "10:00", duration: 30, price: 1200, status: "confirmed",  notes: "" },
  { id: 10, clientName: "Артём Фёдоров",  clientPhone: "+7 (999) 100-00-10", service: "Оформление бороды", serviceId: 3, staffId: 3, staffName: "Кирилл Смирнов",  date: "2026-03-16", time: "15:00", duration: 30, price: 800,  status: "no-show",    notes: "" },
];

// Клиенты (CRM)
export const clients = [
  { id: 1, name: "Иван Петров",     phone: "+7 (999) 100-00-01", email: "ivan@mail.ru",    totalVisits: 12, lastVisit: "2026-03-14", totalSpent: 14400, tags: ["Постоянный"], notes: "Предпочитает Алексея" },
  { id: 2, name: "Сергей Иванов",   phone: "+7 (999) 100-00-02", email: "sergey@mail.ru",  totalVisits: 8,  lastVisit: "2026-03-14", totalSpent: 12600, tags: ["VIP"],         notes: "" },
  { id: 3, name: "Михаил Сидоров",  phone: "+7 (999) 100-00-03", email: "misha@mail.ru",   totalVisits: 3,  lastVisit: "2026-03-14", totalSpent: 3200,  tags: [],              notes: "" },
  { id: 4, name: "Антон Козлов",    phone: "+7 (999) 100-00-04", email: "anton@mail.ru",   totalVisits: 20, lastVisit: "2026-03-14", totalSpent: 26000, tags: ["Постоянный", "VIP"], notes: "День рождения 15 мая" },
  { id: 5, name: "Павел Новиков",   phone: "+7 (999) 100-00-05", email: "pavel@mail.ru",   totalVisits: 1,  lastVisit: "2026-02-28", totalSpent: 0,     tags: ["Проблемный"],  notes: "Часто отменяет" },
  { id: 6, name: "Виктор Морозов",  phone: "+7 (999) 100-00-06", email: "victor@mail.ru",  totalVisits: 6,  lastVisit: "2026-03-10", totalSpent: 7200,  tags: [],              notes: "" },
];

// Доступные слоты времени для записи
export const timeSlots = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30",
];

// Бизнесы для Admin SaaS панели
export const adminBusinesses = [
  { id: 1, name: "Barbershop Premium", plan: "Pro",        users: 3, created: "2025-01-10", status: "active",   revenue: 45000 },
  { id: 2, name: "Nail Studio Belle",  plan: "Free",       users: 1, created: "2025-03-22", status: "active",   revenue: 0 },
  { id: 3, name: "Beauty Lab",         plan: "Enterprise", users: 8, created: "2024-11-05", status: "active",   revenue: 12000 },
  { id: 4, name: "Massage Center Zen", plan: "Pro",        users: 2, created: "2025-06-18", status: "inactive", revenue: 2800 },
  { id: 5, name: "Tattoo Studio Dark", plan: "Pro",        users: 2, created: "2025-08-30", status: "active",   revenue: 6500 },
];

// Данные для графиков аналитики
export const revenueData = [
  { month: "Окт", revenue: 48000, bookings: 52 },
  { month: "Ноя", revenue: 52000, bookings: 58 },
  { month: "Дек", revenue: 61000, bookings: 67 },
  { month: "Янв", revenue: 44000, bookings: 48 },
  { month: "Фев", revenue: 55000, bookings: 60 },
  { month: "Мар", revenue: 38000, bookings: 41 },
];
