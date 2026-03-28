/** Унифицированная ошибка API: message + HTTP status + code для UI и тестов */

function defaultStatusForCode(code) {
  switch (code) {
    case 'auth_required':
      return 401;
    case 'forbidden':
    case 'no_access':
      return 403;
    case 'not_found':
      return 404;
    case 'validation_error':
    case 'no_business':
    default:
      return 400;
  }
}

export class ApiError extends Error {
  constructor(message, { field, code, status } = {}) {
    super(message);
    this.name = 'ApiError';
    this.message = message;
    this.field = field;
    this.code = code;
    this.status = status ?? defaultStatusForCode(code);
  }

  toJSON() {
    const o = { message: this.message, status: this.status };
    if (this.field) o.field = this.field;
    if (this.code) o.code = this.code;
    return o;
  }
}

export function fromPostgrestError(error) {
  if (!error) return new ApiError('Неизвестная ошибка');
  const code = error.code;
  const hint = error.hint;
  const msg = error.message || 'Ошибка запроса';

  if (code === 'PGRST116' || msg.includes('No rows') || msg.includes('JSON object requested')) {
    return new ApiError('Запись не найдена или нет доступа', { code: 'not_found', status: 403 });
  }
  if (code === '42501' || msg.toLowerCase().includes('permission denied') || msg.toLowerCase().includes('rls')) {
    return new ApiError('Недостаточно прав', { code: 'forbidden', status: 403 });
  }
  if (code === '23505' || msg.toLowerCase().includes('duplicate')) {
    return new ApiError('Такая запись уже существует', { code: 'validation_error', status: 400 });
  }
  if (code === '23503' || msg.toLowerCase().includes('foreign key')) {
    return new ApiError('Связанная запись не найдена', { code: 'validation_error', status: 400 });
  }
  if (hint) return new ApiError(`${msg}`, { code: 'validation_error', status: 400 });
  return new ApiError(msg, { code: 'validation_error', status: 400 });
}
