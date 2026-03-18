import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Переменные окружения VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY не заданы. ' +
    'Скопируйте .env.example в .env и заполните значения из вашего проекта Supabase.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
