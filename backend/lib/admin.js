import { ApiError } from './errors.js';

export async function getAdminBusinesses() {
  throw new ApiError('Панель платформы недоступна в этой версии', { code: 'forbidden', status: 403 });
}
