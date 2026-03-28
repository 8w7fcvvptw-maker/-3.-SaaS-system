import { useState, useEffect } from 'react';
import { getHttpStatus } from '../lib/apiErrors.js';
import { SAAS_API_FORBIDDEN, SAAS_API_UNAUTHORIZED } from '../lib/saasEvents.js';

/**
 * Универсальный хук для загрузки данных с обработкой loading и error состояний
 * 
 * Пример использования:
 * const { data: appointments, loading, error } = useAsync(() => getAppointments());
 */
export function useAsync(asyncFunction, immediate = true, deps = []) {
  /** Пока не отработал первый effect, запрос ещё не стартовал с точки зрения UI — но для immediate
   *  первый кадр должен считаться загрузкой, иначе потребители видят data=null и принимают решения
   *  (например RequireBusiness → Navigate на /onboarding до завершения getBusiness). */
  const [status, setStatus] = useState(() => (immediate ? 'pending' : 'idle'));
  const [value, setValue] = useState(null);
  const [error, setError] = useState(null);

  const execute = async () => {
    setStatus('pending');
    setValue(null);
    setError(null);

    try {
      const response = await asyncFunction();
      setValue(response);
      setStatus('success');
      return response;
    } catch (err) {
      setError(err);
      setStatus('error');
      console.error('Async error:', err);
      const st = getHttpStatus(err);
      if (st === 401) {
        window.dispatchEvent(new CustomEvent(SAAS_API_UNAUTHORIZED, { detail: { message: err?.message } }));
      } else if (st === 403) {
        window.dispatchEvent(
          new CustomEvent(SAAS_API_FORBIDDEN, { detail: { message: err?.message ?? 'Нет прав' } })
        );
      }
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, deps);

  return {
    execute,
    status,
    data: value,
    loading: status === 'pending',
    error,
    isError: status === 'error',
  };
}
