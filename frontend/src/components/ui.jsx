// ============================================
// ПЕРЕИСПОЛЬЗУЕМЫЕ UI КОМПОНЕНТЫ
// Поддерживают светлую и тёмную тему
// ============================================

import { formatLoadErrorMessage } from "../lib/formatLoadErrorMessage";

const iconPaths = {
  scissors: "M14.7 6.3a2.1 2.1 0 1 1 4.2 0 2.1 2.1 0 0 1-4.2 0Zm0 11.4a2.1 2.1 0 1 1 4.2 0 2.1 2.1 0 0 1-4.2 0ZM3 4l8.6 8.6M3 20l8.6-8.6",
  chart: "M4 19h16M7 16v-4M12 16V8M17 16v-7",
  calendar: "M7 2v3M17 2v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z",
  clipboard: "M9 4h6M9 4a1 1 0 0 0-1 1v1h8V5a1 1 0 0 0-1-1M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M6 6h12a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z",
  users: "M16 21v-1.5a3.5 3.5 0 0 0-3.5-3.5H7.5A3.5 3.5 0 0 0 4 19.5V21M15.5 7.5a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0ZM6.5 9.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0ZM20 21v-1a3 3 0 0 0-2.2-2.9",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 21a7 7 0 1 1 14 0",
  message: "M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H8l-4 3V6a1 1 0 0 1 1-1Z",
  analytics: "M4 19h16M7 15l3-3 3 2 4-5",
  settings: "M10.3 2.7h3.4l.5 2.2a7 7 0 0 1 1.6.9l2-1.1 2.4 2.4-1.1 2a7 7 0 0 1 .9 1.6l2.2.5v3.4l-2.2.5a7 7 0 0 1-.9 1.6l1.1 2-2.4 2.4-2-1.1a7 7 0 0 1-1.6.9l-.5 2.2h-3.4l-.5-2.2a7 7 0 0 1-1.6-.9l-2 1.1-2.4-2.4 1.1-2a7 7 0 0 1-.9-1.6L2.7 14v-3.4l2.2-.5a7 7 0 0 1 .9-1.6l-1.1-2 2.4-2.4 2 1.1a7 7 0 0 1 1.6-.9l.5-2.2ZM12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z",
  bell: "M6 9a6 6 0 0 1 12 0v4l1.5 2.5H4.5L6 13V9Zm4 9a2 2 0 0 0 4 0",
  moon: "M20 14.5A7.5 7.5 0 1 1 9.5 4 6.5 6.5 0 1 0 20 14.5Z",
  sun: "M12 2v2.2M12 19.8V22M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2 12h2.2M19.8 12H22M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z",
  link: "M10 14 8 16a3 3 0 0 1-4.2-4.2l3-3A3 3 0 0 1 11 9m3-1 2-2a3 3 0 0 1 4.2 4.2l-3 3A3 3 0 0 1 13 15",
  menu: "M4 7h16M4 12h16M4 17h16",
  chevronRight: "M9 6l6 6-6 6",
  chevronLeft: "M15 6l-6 6 6 6",
  checkCircle: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm-4.2-9.7 2.6 2.6 5.8-5.8",
  alertTriangle: "M12 3 2.3 20h19.4L12 3Zm0 5v5m0 3h.01",
  star: "m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.4L12 17.6l-5.7 3 1.1-6.4-4.6-4.5 6.4-.9L12 3Z",
  phone: "M5 4h3l1.2 4.2-1.8 1.8a16.5 16.5 0 0 0 6.6 6.6l1.8-1.8L20 16v3a2 2 0 0 1-2.2 2A17.8 17.8 0 0 1 3 6.2 2 2 0 0 1 5 4Z",
  mapPin: "M12 21s-6-5.8-6-10a6 6 0 1 1 12 0c0 4.2-6 10-6 10Zm0-7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  clock: "M12 6v6l3.5 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
};

export function Icon({ name, className = "w-4 h-4", strokeWidth = 1.8, ariaHidden = true }) {
  const path = iconPaths[name];
  if (!path) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
    >
      <path d={path} />
    </svg>
  );
}

// Кнопка с вариантами стиля
export function Button({ children, variant = "primary", size = "md", onClick, className = "", disabled = false, type = "button" }) {
  const base = "inline-flex items-center gap-2 font-medium rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";
  const variants = {
    primary:   "bg-slate-900 text-white hover:bg-slate-800 shadow-sm hover:shadow dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white",
    secondary: "bg-white dark:bg-zinc-800/90 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-zinc-700 hover:bg-gray-50/80 dark:hover:bg-zinc-700/80 shadow-sm",
    danger:    "bg-red-700 text-white hover:bg-red-800 focus-visible:ring-red-500/40",
    ghost:     "text-gray-600 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-zinc-700/80",
    success:   "bg-emerald-800 text-white hover:bg-emerald-900 focus-visible:ring-emerald-600/40",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2.5 text-sm",
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
    gray:   "bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300",
    green:  "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
    yellow: "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-400",
    red:    "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300",
    blue:   "bg-slate-100 text-slate-700 dark:bg-zinc-700 dark:text-gray-300",
    purple: "bg-slate-100 text-slate-700 dark:bg-zinc-700 dark:text-zinc-300",
    indigo: "bg-slate-100 text-slate-700 dark:bg-zinc-700 dark:text-zinc-300",
    teal:   "bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${colors[color]}`}>
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
    no_show:   { label: "Не явился",    color: "gray" },
    "no-show": { label: "Не явился",    color: "gray" },
  };
  const { label, color } = map[status] || { label: status, color: "gray" };
  return <Badge color={color}>{label}</Badge>;
}

// Аватар с инициалами
export function Avatar({ initials, size = "md", className = "" }) {
  const sizes = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-14 h-14 text-lg" };
  return (
    <div className={`${sizes[size]} bg-slate-100 text-slate-700 dark:bg-zinc-700 dark:text-zinc-200 rounded-full flex items-center justify-center font-medium shrink-0 ${className}`}>
      {initials}
    </div>
  );
}

// Карточка — белая в светлой, тёмная в тёмной теме (передаёт onClick и другие обработчики)
export function Card({ children, className = "", ...rest }) {
  return (
    <div className={`bg-white dark:bg-zinc-800 rounded-2xl border border-gray-200/80 dark:border-zinc-700/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none ${className}`} {...rest}>
      {children}
    </div>
  );
}

// KPI карточка (для дашборда)
export function KpiCard({ label, value, icon, trend, color = "violet" }) {
  const colors = {
    violet:  "bg-slate-100 text-slate-700 dark:bg-zinc-700 dark:text-zinc-200",
    green:   "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    yellow:  "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-400",
    red:     "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300",
    teal:    "bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300",
  };
  const trendTone = {
    violet:  "text-slate-600 dark:text-zinc-400",
    green:   "text-emerald-700/90 dark:text-emerald-400/90",
    yellow:  "text-amber-800/90 dark:text-amber-400/90",
    red:     "text-red-700/90 dark:text-red-400/90",
    teal:    "text-teal-700/90 dark:text-teal-400/90",
  };
  return (
    <Card className="p-4 sm:p-5 xl:p-6 h-full min-h-[132px] flex flex-col gap-2 overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-gray-500 dark:text-zinc-400 leading-snug pr-1">{label}</span>
        <span
          aria-hidden="true"
          className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-base leading-none ${colors[color] || colors.violet}`}
        >
          {icon}
        </span>
      </div>
      <div className="text-2xl font-semibold text-gray-900 dark:text-white tabular-nums tracking-tight mt-auto break-words">
        {value}
      </div>
      {trend && (
        <div className={`text-xs leading-snug break-words ${trendTone[color] || trendTone.violet}`}>{trend}</div>
      )}
    </Card>
  );
}

// Звёздный рейтинг
export function StarRating({ rating }) {
  return (
    <span className="flex items-center gap-1 text-sm">
      <Icon name="star" className="w-3.5 h-3.5 text-amber-600/80 dark:text-amber-500/80" />
      <span className="font-medium text-gray-700 dark:text-zinc-300 tabular-nums">{rating}</span>
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
        className="border border-gray-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50 dark:focus:ring-zinc-500 focus:border-slate-300 dark:focus:border-zinc-500"
      />
    </div>
  );
}

// Секция страницы с заголовком
export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between mb-8 gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// Пустое состояние
export function EmptyState({ icon, title, description }) {
  return (
    <div className="text-center py-12">
      <div className="mx-auto mb-3 w-12 h-12 rounded-xl bg-slate-100 dark:bg-zinc-700/80 flex items-center justify-center text-slate-700 dark:text-zinc-200">
        {icon ?? <Icon name="clipboard" className="w-6 h-6" />}
      </div>
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
          <div className="w-8 h-8 border-2 border-gray-200 dark:border-zinc-600 border-t-slate-700 dark:border-t-zinc-300 rounded-full"></div>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400">{text}</p>
    </div>
  );
}

/** Компактное сообщение об ошибке действия (сохранение, удаление) — вместо alert */
export function ActionErrorBanner({ message, onDismiss, className = "" }) {
  if (message == null || message === "") return null;
  const displayText = formatLoadErrorMessage(String(message));
  return (
    <div
      role="alert"
      className={`rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-3 py-2 text-sm text-red-800 dark:text-red-300 flex items-start justify-between gap-2 ${className}`}
    >
      <span className="whitespace-pre-line flex-1">{displayText}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-red-600 dark:text-red-400 hover:underline text-xs"
        >
          Закрыть
        </button>
      )}
    </div>
  );
}

// Состояние ошибки
export function ErrorState({ title = "Ошибка загрузки", description, message, onRetry }) {
  const raw = description ?? message;
  const displayText = raw != null && raw !== "" ? formatLoadErrorMessage(raw) : null;
  return (
    <Card className="p-6 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
      <div className="flex items-start gap-4">
        <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 flex items-center justify-center shrink-0">
          <Icon name="alertTriangle" className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-red-800 dark:text-red-400">{title}</h3>
          {displayText && (
            <p className="text-sm text-red-700 dark:text-red-300 mt-1 whitespace-pre-line">{displayText}</p>
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
