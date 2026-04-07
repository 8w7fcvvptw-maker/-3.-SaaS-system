// ============================================
// ПЕРЕИСПОЛЬЗУЕМЫЕ UI КОМПОНЕНТЫ
// Поддерживают светлую и тёмную тему
// ============================================

import { formatLoadErrorMessage } from "../lib/formatLoadErrorMessage";

// Кнопка с вариантами стиля
export function Button({ children, variant = "primary", size = "md", onClick, className = "", disabled = false, type = "button" }) {
  const base = "inline-flex items-center gap-2 font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";
  const variants = {
    primary:   "bg-slate-900 text-white hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white",
    secondary: "bg-white dark:bg-zinc-800/90 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-zinc-700 hover:bg-gray-50/80 dark:hover:bg-zinc-700/80",
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
    <div className={`bg-white dark:bg-zinc-800 rounded-xl border border-gray-200/80 dark:border-zinc-700/80 ${className}`} {...rest}>
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
    <Card className="p-6 h-full min-h-[132px] flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="text-sm text-gray-500 dark:text-zinc-400 leading-snug flex-1 min-w-0">{label}</span>
        <span className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-lg leading-none ${colors[color] || colors.violet}`}>{icon}</span>
      </div>
      <div className="text-2xl font-semibold text-gray-900 dark:text-white tabular-nums tracking-tight mt-auto">{value}</div>
      {trend && (
        <div className={`text-xs mt-1 leading-snug ${trendTone[color] || trendTone.violet}`}>{trend}</div>
      )}
    </Card>
  );
}

// Звёздный рейтинг
export function StarRating({ rating }) {
  return (
    <span className="flex items-center gap-1 text-sm">
      <span className="text-amber-600/80 dark:text-amber-500/80">★</span>
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
        <div className="text-2xl">⚠️</div>
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
