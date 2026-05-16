import { SYSTEM_PROMPT } from "./systemPrompt.js";
import { searchKnowledgeChunks } from "./knowledgeSearchService.js";
import { createChatCompletion, createOpenAIClient } from "./openaiClient.js";
import { buildKnowledgeContextPrompt, NO_KNOWLEDGE_REPLY } from "./ragPrompt.js";
import { logRagSearch } from "./ragLogger.js";

export const AI_ANSWER_MESSAGES = {
  noApiKey:
    "AI-консультант временно недоступен. Оставьте заявку, и менеджер свяжется с вами.",
  fallback:
    "Не удалось получить ответ от AI. Попробуйте позже или оставьте заявку через меню — менеджер свяжется с вами.",
};

/**
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
    const chunks = await searchKnowledgeChunks({
      openaiApiKey,
      query: trimmedQuestion,
    });

    logRagSearch(trimmedQuestion, chunks);

    if (chunks.length === 0) {
      return NO_KNOWLEDGE_REPLY;
    }

    const knowledgeContextPrompt = buildKnowledgeContextPrompt(chunks);

    const text = await createChatCompletion({
      client,
      systemPrompt: SYSTEM_PROMPT,
      knowledgeContextPrompt,
      historyMessages,
      userMessage: trimmedQuestion,
    });

    if (!text) {
      return AI_ANSWER_MESSAGES.fallback;
    }

    return text;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[llm] RAG or OpenAI request failed:", message);
    return AI_ANSWER_MESSAGES.fallback;
  }
}
