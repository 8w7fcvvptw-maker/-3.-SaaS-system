create table if not exists public.business_types (
  id bigserial primary key,
  name text not null unique
);

create table if not exists public.tariffs (
  id bigserial primary key,
  name text not null unique,
  description text not null
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  telegram_id text not null,
  username text null,
  name text null,
  business_type text not null,
  tariff text not null,
  task_description text not null,
  employees_count integer not null check (employees_count > 0),
  contact text not null,
  status text not null default 'new',
  ai_summary text null,
  lead_score numeric null,
  recommended_tariff text null,
  created_at timestamptz not null default now()
);

alter table public.business_types
  add column if not exists name text,
  add column if not exists title text;

alter table public.tariffs
  add column if not exists name text,
  add column if not exists title text,
  add column if not exists description text;

update public.business_types
set name = title
where name is null and title is not null;

update public.business_types
set title = name
where title is null and name is not null;

update public.tariffs
set name = title
where name is null and title is not null;

update public.tariffs
set title = name
where title is null and name is not null;

insert into public.business_types (name, title)
select seed.name, seed.name
from (
  values
    ('Онлайн-школа'),
    ('Салон услуг'),
    ('B2B-агентство'),
    ('Интернет-магазин'),
    ('Другое')
) as seed(name)
where not exists (
  select 1
  from public.business_types bt
  where coalesce(bt.name, bt.title) = seed.name
);

insert into public.tariffs (name, title, description)
select seed.name, seed.name, seed.description
from (
  values
    ('Start', 'базовая автоматизация'),
    ('Pro', 'CRM, заявки, уведомления'),
    ('Business', 'интеграции, аналитика, роли')
) as seed(name, description)
where not exists (
  select 1
  from public.tariffs t
  where coalesce(t.name, t.title) = seed.name
);
