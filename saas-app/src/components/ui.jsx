// ============================================
// ПЕРЕИСПОЛЬЗУЕМЫЕ UI КОМПОНЕНТЫ
// ============================================

// Кнопка с вариантами стиля
export function Button({ children, variant = "primary", size = "md", onClick, className = "", disabled = false }) {
  const base = "inline-flex items-center gap-2 font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";
  const variants = {
    primary:   "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500",
    secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-gray-300",
    danger:    "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
    ghost:     "text-gray-600 hover:bg-gray-100 focus:ring-gray-300",
    success:   "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

// Бейдж — статус или метка
export function Badge({ children, color = "gray" }) {
  const colors = {
    gray:    "bg-gray-100 text-gray-700",
    green:   "bg-emerald-100 text-emerald-700",
    yellow:  "bg-yellow-100 text-yellow-700",
    red:     "bg-red-100 text-red-700",
    blue:    "bg-blue-100 text-blue-700",
    purple:  "bg-purple-100 text-purple-700",
    indigo:  "bg-indigo-100 text-indigo-700",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
}

// Цветной бейдж статуса записи
export function StatusBadge({ status }) {
  const map = {
    confirmed: { label: "Подтверждено", color: "green" },
    pending:   { label: "Ожидает",      color: "yellow" },
    cancelled: { label: "Отменено",     color: "red" },
    completed: { label: "Завершено",    color: "blue" },
    "no-show": { label: "Не явился",    color: "gray" },
  };
  const { label, color } = map[status] || { label: status, color: "gray" };
  return <Badge color={color}>{label}</Badge>;
}

// Аватар с инициалами
export function Avatar({ initials, size = "md", color = "indigo" }) {
  const sizes = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-14 h-14 text-lg" };
  const colors = {
    indigo: "bg-indigo-100 text-indigo-700",
    purple: "bg-purple-100 text-purple-700",
    blue:   "bg-blue-100 text-blue-700",
  };
  return (
    <div className={`${sizes[size]} ${colors[color]} rounded-full flex items-center justify-center font-semibold shrink-0`}>
      {initials}
    </div>
  );
}

// Карточка с белым фоном и тенью
export function Card({ children, className = "" }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${className}`}>
      {children}
    </div>
  );
}

// KPI карточка (для дашборда)
export function KpiCard({ label, value, icon, trend, color = "indigo" }) {
  const colors = {
    indigo:  "bg-indigo-50 text-indigo-600",
    green:   "bg-emerald-50 text-emerald-600",
    yellow:  "bg-yellow-50 text-yellow-600",
    red:     "bg-red-50 text-red-600",
  };
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">{label}</span>
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg ${colors[color]}`}>{icon}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {trend && <div className="text-xs text-emerald-600 mt-1">{trend}</div>}
    </Card>
  );
}

// Звёздный рейтинг
export function StarRating({ rating }) {
  return (
    <span className="flex items-center gap-1 text-sm">
      <span className="text-yellow-400">★</span>
      <span className="font-medium text-gray-700">{rating}</span>
    </span>
  );
}

// Поле ввода
export function Input({ label, type = "text", value, onChange, placeholder, required }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-gray-700">{label}{required && <span className="text-red-500 ml-1">*</span>}</label>}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      />
    </div>
  );
}

// Текстовая область
export function Textarea({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
      />
    </div>
  );
}

// Секция страницы с заголовком
export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// Пустое состояние
export function EmptyState({ icon, title, description }) {
  return (
    <div className="text-center py-12">
      <div className="text-5xl mb-3">{icon}</div>
      <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  );
}
