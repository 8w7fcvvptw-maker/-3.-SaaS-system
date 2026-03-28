import { supabase } from './supabase.js';
import { ApiError } from './errors.js';
import { throwOnError } from './helpers.js';
import { assertId } from './validation.js';

export function forbidden(message = 'Нет доступа к этой записи') {
  return new ApiError(message, { code: 'forbidden', status: 403 });
}

/** Строка таблицы с business_id принадлежит салону владельца */
export async function requireRowInBusiness(table, rowId, businessId, entityLabel = 'Запись') {
  assertId(rowId, 'id');
  assertId(businessId, 'business_id');
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .eq('id', rowId)
    .eq('business_id', businessId)
    .maybeSingle();
  if (error) throw throwOnError({ data: null, error });
  if (!data) throw forbidden(`${entityLabel} не найдена или нет доступа`);
}

export async function requireServiceInBusiness(serviceId, businessId) {
  if (serviceId == null) return;
  assertId(serviceId, 'service_id');
  assertId(businessId, 'business_id');
  const { data, error } = await supabase
    .from('services')
    .select('id')
    .eq('id', serviceId)
    .eq('business_id', businessId)
    .maybeSingle();
  if (error) throw throwOnError({ data: null, error });
  if (!data) {
    throw new ApiError('Услуга не принадлежит вашему салону', {
      field: 'service_id',
      code: 'forbidden',
      status: 403,
    });
  }
}

export async function requireStaffInBusiness(staffId, businessId) {
  if (staffId == null) return;
  assertId(staffId, 'staff_id');
  assertId(businessId, 'business_id');
  const { data, error } = await supabase
    .from('staff')
    .select('id')
    .eq('id', staffId)
    .eq('business_id', businessId)
    .maybeSingle();
  if (error) throw throwOnError({ data: null, error });
  if (!data) {
    throw new ApiError('Сотрудник не принадлежит вашему салону', {
      field: 'staff_id',
      code: 'forbidden',
      status: 403,
    });
  }
}

export async function requireClientInBusiness(clientId, businessId) {
  if (clientId == null) return;
  assertId(clientId, 'client_id');
  assertId(businessId, 'business_id');
  const { data, error } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('business_id', businessId)
    .maybeSingle();
  if (error) throw throwOnError({ data: null, error });
  if (!data) {
    throw new ApiError('Клиент не принадлежит вашему салону', {
      field: 'client_id',
      code: 'forbidden',
      status: 403,
    });
  }
}
