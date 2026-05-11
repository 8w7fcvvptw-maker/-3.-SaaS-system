/** Максимум сообщений ролей user/assistant в истории одного пользователя (скользящее окно). */
export const DIALOG_HISTORY_MAX_MESSAGES = 10;

/** @typedef {{ role: 'user' | 'assistant'; content: string }} DialogMessage */

/** @type {Map<string, DialogMessage[]>} */
const messagesByUserId = new Map();

/**
 * @param {string} userId
 * @returns {DialogMessage[]}
 */
export function getDialogHistory(userId) {
  return messagesByUserId.get(userId) ?? [];
}

/**
 * Добавляет пару сообщений после ответа модели и обрезает с начала при переполнении.
 *
 * @param {string} userId
 * @param {string} userContent
 * @param {string} assistantContent
 */
export function appendUserAndAssistant(userId, userContent, assistantContent) {
  const next = [...getDialogHistory(userId)];
  next.push({ role: "user", content: userContent });
  next.push({ role: "assistant", content: assistantContent });
  while (next.length > DIALOG_HISTORY_MAX_MESSAGES) {
    next.shift();
  }
  messagesByUserId.set(userId, next);
}

/**
 * @param {string} userId
 */
export function clearDialogHistory(userId) {
  messagesByUserId.delete(userId);
}
