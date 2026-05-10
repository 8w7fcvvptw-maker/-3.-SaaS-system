import { SYSTEM_PROMPT } from "./systemPrompt.js";
import { createChatCompletion, createOpenAIClient } from "./openaiClient.js";

export const AI_ANSWER_MESSAGES = {
  noApiKey:
    "AI-консультант временно недоступен. Оставьте заявку, и менеджер свяжется с вами.",
  fallback:
    "Не удалось получить ответ от AI. Попробуйте позже или оставьте заявку через меню — менеджер свяжется с вами.",
};

/**
 * В LLM передаётся только текст вопроса пользователя — без токенов, ключей и конфигурации окружения.
 *
 * @param {object} params
 * @param {string | null | undefined} params.openaiApiKey
 * @param {string} params.userMessage
 * @returns {Promise<string>}
 */
export async function answerUserQuestion({ openaiApiKey, userMessage }) {
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
