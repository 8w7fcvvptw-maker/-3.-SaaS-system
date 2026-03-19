// ============================================
// ПЕРЕИСПОЛЬЗУЕМЫЕ UI КОМПОНЕНТЫ
// Поддерживают светлую и тёмную тему
// ============================================

// Кнопка с вариантами стиля
export function Button({ children, variant = "primary", size = "md", onClick, className = "", disabled = false, type = "button" }) {
  const base = "inline-flex items-center gap-2 font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";
  const variants = {
    primary:   "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500",
    secondary: "bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-zinc-600 hover:bg-gray-50 dark:hover:bg-zinc-700 focus:ring-gray-300",
    danger:    "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
    ghost:     "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 focus:ring-gray-300",
    success:   "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };
  return (
    <button type={type} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

// Бейдж — статус или метка
export function Badge({ children, color = "gray" }) {
  const colors = {
    gray:   "bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-gray-300",
    green:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
    yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
    red:    "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
    blue:   "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400",
    purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
    indigo: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400",
    teal:   "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400",
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
    completed: { label: "Завершено",    color: "teal" },
    "no-show": { label: "Не явился",    color: "gray" },
  };
  const { label, color } = map[status] || { label: status, color: "gray" };
  return <Badge color={color}>{label}</Badge>;
}

// Аватар с инициалами
export function Avatar({ initials, size = "md" }) {
  const sizes = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-14 h-14 text-lg" };
  return (
    <div className={`${sizes[size]} bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-gray-300 rounded-full flex items-center justify-center font-semibold shrink-0`}>
      {initials}
    </div>
  );
}

// Карточка — белая в светлой, тёмная в тёмной теме (передаёт onClick и другие обработчики)
export function Card({ children, className = "", ...rest }) {
  return (
    <div className={`bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-700 ${className}`} {...rest}>
      {children}
    </div>
  );
}

// KPI карточка (для дашборда)
export function KpiCard({ label, value, icon, trend, color = "violet" }) {
  const colors = {
    violet:  "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
    green:   "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
    yellow:  "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400",
    red:     "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    teal:    "bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400",
  };
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg ${colors[color] || colors.violet}`}>{icon}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      {trend && <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">{trend}</div>}
    </Card>
  );
}

// Звёздный рейтинг
export function StarRating({ rating }) {
  return (
    <span className="flex items-center gap-1 text-sm">
      <span className="text-yellow-400">★</span>
      <span className="font-medium text-gray-700 dark:text-gray-300">{rating}</span>
    </span>
  );
}

// Поле ввода (тёмная тема)
export function Input({ label, type = "text", value, onChange, placeholder, required }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}{required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
      />
    </div>
  );
}

// Секция страницы с заголовком
export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
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
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
    </div>
  );
}

// Состояние загрузки
export function LoadingState({ text = "Загрузка..." }) {
  return (
    <div className="text-center py-12">
      <div className="flex justify-center mb-4">
        <div className="animate-spin">
          <div className="w-8 h-8 border-4 border-gray-200 dark:border-zinc-600 border-t-indigo-600 rounded-full"></div>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400">{text}</p>
    </div>
  );
}

// Состояние ошибки
export function ErrorState({ title = "Ошибка загрузки", description, message, onRetry }) {
  return (
    <Card className="p-6 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
      <div className="flex items-start gap-4">
        <div className="text-2xl">⚠️</div>
        <div className="flex-1">
          <h3 className="font-semibold text-red-800 dark:text-red-400">{title}</h3>
          {(description || message) && (
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">{description ?? message}</p>
          )}
          {onRetry && (
            <Button 
              size="sm" 
              variant="secondary" 
              onClick={onRetry}
              className="mt-3"
            >
              Повторить попытку
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
