import { useState, useEffect } from 'react';

/**
 * Универсальный хук для загрузки данных с обработкой loading и error состояний
 * 
 * Пример использования:
 * const { data: appointments, loading, error } = useAsync(() => getAppointments());
 */
export function useAsync(asyncFunction, immediate = true, deps = []) {
  const [status, setStatus] = useState('idle');
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
