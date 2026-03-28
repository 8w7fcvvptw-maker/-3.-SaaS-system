import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Переменные окружения VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY не заданы. ' +
    'Скопируйте .env.example в .env и заполните значения из вашего проекта Supabase.'
  );
}

/**
 * Один браузерный клиент: JWT и refresh делает Supabase Auth.
 * Сессия в localStorage (persistSession), без своего bcrypt/JWT на сервере.
 */
const browserStorage =
  typeof globalThis !== 'undefined' && globalThis.localStorage
    ? globalThis.localStorage
    : undefined;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: browserStorage,
  },
});
