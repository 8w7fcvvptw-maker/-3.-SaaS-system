import { SYSTEM_PROMPT } from "./systemPrompt.js";
import { createChatCompletion, createOpenAIClient } from "./openaiClient.js";

export const AI_ANSWER_MESSAGES = {
  noApiKey:
    "AI-консультант временно недоступен. Оставьте заявку, и менеджер свяжется с вами.",
  fallback:
    "Не удалось получить ответ от AI. Попробуйте позже или оставьте заявку через меню — менеджер свяжется с вами.",
};

/**
 * В LLM передаются system, история диалога (только user/assistant) и новое сообщение пользователя.
 * Ключи и секреты окружения в модель не передаются.
 *
 * @param {object} params
 * @param {string | null | undefined} params.openaiApiKey
 * @param {string} params.userMessage
 * @param {Array<{ role: 'user' | 'assistant'; content: string }>} [params.historyMessages]
 * @returns {Promise<string>}
 */
export async function answerUserQuestion({ openaiApiKey, userMessage, historyMessages = [] }) {
  const trimmedQuestion = userMessage.trim();
  if (!trimmedQuestion) {
    return "Напишите вопрос текстом в одном сообщении.";
  }

  if (!openaiApiKey) {
    return AI_ANSWER_MESSAGES.noApiKey;
  }

  const client = createOpenAIClient(openaiApiKey);

  try {
    const text = await createChatCompletion({
      client,
      systemPrompt: SYSTEM_PROMPT,
      historyMessages,
      userMessage: trimmedQuestion,
    });

    if (!text) {
      return AI_ANSWER_MESSAGES.fallback;
    }

    return text;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[llm] OpenAI request failed:", message);
    return AI_ANSWER_MESSAGES.fallback;
  }
}
