-- Таблица тарифных планов для Admin SaaS панели
-- Выполните этот SQL в Supabase: SQL Editor → New query → вставьте и Run

CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  price text NOT NULL DEFAULT '0 RUB',
  period text NOT NULL DEFAULT '/mo',
  color text NOT NULL DEFAULT 'border-gray-600',
  popular boolean NOT NULL DEFAULT false,
  features jsonb NOT NULL DEFAULT '[]',
  not_included jsonb NOT NULL DEFAULT '[]',
  sort_order int NOT NULL DEFAULT 0
);

-- RLS (если включён глобально в Supabase, выполните после создания таблицы):
-- CREATE POLICY "plans_allow_all" ON plans FOR ALL USING (true) WITH CHECK (true);

-- Начальные данные
INSERT INTO plans (name, price, period, color, popular, features, not_included, sort_order) VALUES
  ('Free', '0 RUB', '/mo', 'border-gray-600', false,
   '["1 staff", "Up to 50 bookings/mo", "Basic analytics", "Online booking"]'::jsonb,
   '["SMS notifications", "Advanced analytics", "API access"]'::jsonb, 1),
  ('Pro', '2 990 RUB', '/mo', 'border-violet-500', true,
   '["Up to 10 staff", "Unlimited bookings", "SMS + Email", "Analytics", "Custom templates"]'::jsonb,
   '["API access", "White-label"]'::jsonb, 2),
  ('Enterprise', '9 990 RUB', '/mo', 'border-purple-500', false,
   '["Unlimited staff", "Unlimited bookings", "SMS + Email + Push", "Full analytics", "API access", "White-label", "Priority support"]'::jsonb,
   '[]'::jsonb, 3)
ON CONFLICT (name) DO NOTHING;
