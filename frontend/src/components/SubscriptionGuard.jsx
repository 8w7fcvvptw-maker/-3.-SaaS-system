import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getMyProfile, redirectToPayment, PLAN_LIMITS } from '../lib/subscription.js';

/**
 * SubscriptionGuard — обёртка для owner-маршрутов.
 *
 * Пропускает:
 * - super-admin;
 * - пользователей без owner-контура;
 * - owner без бизнеса (onboarding обрабатывается в RequireBusiness).
 * Показывает paywall только для owner с бизнесом без entitlement.
 */
export default function SubscriptionGuard({ children, fallback }) {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState({ loading: true, profile: null, error: null });

  useEffect(() => {
    if (authLoading || !user) return;

    let cancelled = false;
    getMyProfile()
      .then((profile) => {
        if (!cancelled) setState({ loading: false, profile, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ loading: false, profile: null, error: err.message });
      });

    return () => { cancelled = true; };
  }, [user, authLoading]);

  if (authLoading || state.loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return fallback ?? null;

  const { profile } = state;
  if (!profile && state.error) {
    return (
      <div className="min-h-[240px] flex items-center justify-center px-6">
        <div className="max-w-md w-full rounded-lg border border-red-400/40 bg-red-900/20 text-red-200 text-sm px-4 py-3">
          Не удалось проверить доступ по подписке. Обновите страницу и попробуйте снова.
        </div>
      </div>
    );
  }

  if (!profile) return fallback ?? null;

  if (profile?.access?.requiresPaywall) {
    return <SubscriptionPaywall profile={profile} />;
  }

  return children;
}

function SubscriptionPaywall() {
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

  const plans = [
    { key: 'basic', badge: null },
    { key: 'pro', badge: 'Популярный' },
    { key: 'unlimited', badge: null },
  ];

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 bg-gray-950">
      <div className="max-w-3xl w-full text-center">
        <div className="mb-2 inline-flex items-center gap-2 bg-violet-900/40 text-violet-300 px-3 py-1 rounded-full text-sm">
          🔒 Требуется подписка
        </div>
        <h1 className="text-3xl font-bold text-white mt-4 mb-2">Выберите тарифный план</h1>
        <p className="text-gray-400 mb-10">
          Для управления услугами и записями необходима активная подписка.
        </p>

        {error && (
          <div className="mb-6 bg-red-900/40 border border-red-500/50 text-red-300 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map(({ key, badge }) => {
            const plan = PLAN_LIMITS[key];
            return (
              <div
                key={key}
                className={`relative rounded-xl border bg-gray-900 p-6 flex flex-col text-left transition-all hover:border-violet-500 ${
                  badge ? 'border-violet-500 ring-1 ring-violet-500' : 'border-gray-700'
                }`}
              >
                {badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-xs px-3 py-0.5 rounded-full">
                    {badge}
                  </span>
                )}
                <div className="text-lg font-semibold text-white mb-1">{plan.displayName}</div>
                <div className="text-2xl font-bold text-violet-400 mb-4">
                  {plan.priceRub.toLocaleString('ru-RU')} ₽<span className="text-gray-400 text-base font-normal">/мес</span>
                </div>
                <ul className="space-y-2 text-sm text-gray-400 flex-1 mb-6">
                  <li>
                    ✓ Записей в месяц:{' '}
                    <span className="text-white">
                      {plan.appointmentsPerMonth === -1 ? 'без лимита' : plan.appointmentsPerMonth}
                    </span>
                  </li>
                  <li>
                    ✓ Услуги:{' '}
                    <span className="text-white">
                      {plan.servicesLimit === -1 ? 'без лимита' : `до ${plan.servicesLimit}`}
                    </span>
                  </li>
                  {key === 'pro' && <li>✓ <span className="text-white">Расширенная аналитика</span></li>}
                  {key === 'unlimited' && <li>✓ <span className="text-white">Приоритетная поддержка</span></li>}
                  {key === 'unlimited' && <li>✓ <span className="text-white">API доступ</span></li>}
                </ul>
                <button
                  onClick={() => handleChoosePlan(key)}
                  disabled={paying !== null}
                  className={`w-full py-2.5 rounded-lg font-medium text-sm transition-all ${
                    badge
                      ? 'bg-violet-600 hover:bg-violet-500 text-white'
                      : 'bg-gray-700 hover:bg-gray-600 text-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {paying === key ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Перенаправление...
                    </span>
                  ) : (
                    `Выбрать ${plan.displayName}`
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-xs text-gray-600">
          Оплата через ЮKassa. Подписка активируется автоматически после оплаты.
        </p>
      </div>
    </div>
  );
}
