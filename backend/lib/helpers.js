import { fromPostgrestError } from './errors.js';

export function throwOnError({ data, error }) {
  if (error) throw fromPostgrestError(error);
  return data;
}
