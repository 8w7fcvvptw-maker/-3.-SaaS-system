// ============================================
// API — единая точка входа
// Re-export всех функций из модулей
// ============================================

export * from './auth.js';
export * from './business.js';
export * from './services.js';
export * from './staff.js';
export * from './clients.js';
export * from './appointments.js';
export * from './timeSlots.js';
export * from './admin.js';
export * from './plans.js';
export * from './subscriptions.js';

// roles.js — только то, чего нет в subscriptions.js
export { ROLES, requireRole, requireActiveSubscription, setUserRole, getMyRole, getMyProfile } from './roles.js';

// payments.js
export { createYokassaPayment, handleYokassaWebhook, verifyYokassaWebhookIp, getMyPayments } from './payments.js';

export { ApiError } from './errors.js';
