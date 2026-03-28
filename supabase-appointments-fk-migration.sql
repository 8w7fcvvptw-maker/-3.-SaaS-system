-- Связи для вложенного select в API: appointments + services + staff
-- Выполните в Supabase SQL Editor, если FK ещё не созданы.

-- Услуга
alter table appointments
  drop constraint if exists appointments_service_id_fkey;

alter table appointments
  add constraint appointments_service_id_fkey
  foreign key (service_id) references services (id) on delete set null;

-- Мастер
alter table appointments
  drop constraint if exists appointments_staff_id_fkey;

alter table appointments
  add constraint appointments_staff_id_fkey
  foreign key (staff_id) references staff (id) on delete set null;

-- Клиент (опционально, для client_id)
alter table appointments
  drop constraint if exists appointments_client_id_fkey;

alter table appointments
  add constraint appointments_client_id_fkey
  foreign key (client_id) references clients (id) on delete set null;

create index if not exists idx_appointments_business_date
  on appointments (business_id, date, time);

create index if not exists idx_appointments_client_id
  on appointments (client_id);
