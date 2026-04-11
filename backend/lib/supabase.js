import { createClient } from '@supabase/supabase-js';

/**
 * Vite подставляет import.meta.env; в Node (Railway, auth-api) — process.env.
 * Порядок: import.meta → process с тем же именем → запасной ключ без VITE_.
 */
function env(viteName, altProcessName) {
  const viteEnv = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : undefined;
  const fromVite = viteEnv?.[viteName];
  if (fromVite != null && String(fromVite).trim() !== '') return String(fromVite).trim();

  const p = typeof process !== 'undefined' ? process.env : undefined;
  const fromProcessVite = p?.[viteName];
  if (fromProcessVite != null && String(fromProcessVite).trim() !== '') return String(fromProcessVite).trim();

  if (altProcessName && p?.[altProcessName] != null && String(p[altProcessName]).trim() !== '') {
    return String(p[altProcessName]).trim();
  }
  return '';
}

const supabaseUrl = env('VITE_SUPABASE_URL', 'SUPABASE_URL');
const supabaseKey = env('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Задайте URL и anon-ключ Supabase: в Vite — VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY; ' +
      'в Node — SUPABASE_URL и SUPABASE_ANON_KEY (или те же VITE_* в process.env).'
  );
}

const isBrowser =
  typeof globalThis !== 'undefined' &&
  typeof globalThis.window !== 'undefined' &&
  typeof globalThis.document !== 'undefined';

const browserStorage =
  isBrowser && globalThis.localStorage ? globalThis.localStorage : undefined;

/**
 * Браузер: JWT в localStorage. Node (импорт из server/yookassa и т.д.): без persist, только process.env.
 */
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: Boolean(browserStorage),
    autoRefreshToken: Boolean(browserStorage),
    detectSessionInUrl: isBrowser,
    storage: browserStorage,
  },
});
