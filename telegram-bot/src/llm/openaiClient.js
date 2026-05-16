import OpenAI from "openai";

/**
 * Выбрана gpt-4o-mini, потому что для коротких ответов в Telegram-боте она дешёвая, быстрая и достаточно качественная.
 */
export const OPENAI_CHAT_MODEL = "gpt-4o-mini";

export const OPENAI_CHAT_DEFAULTS = {
  temperature: 0.3,
  max_tokens: 300,
};

/**
 * @param {string} apiKey
 * @returns {OpenAI}
 */
export function createOpenAIClient(apiKey) {
  return new OpenAI({ apiKey });
}

/**
 * @param {{ role: string; content: string }} m
 * @returns {boolean}
 */
function isChatHistoryMessage(m) {
  return (
    m != null &&
    typeof m.content === "string" &&
    (m.role === "user" || m.role === "assistant")
  );
}

/**
 * @param {object} params
 * @param {OpenAI} params.client
 * @param {string} params.systemPrompt
 * @param {string} [params.knowledgeContextPrompt] — фрагменты RAG (второе system-сообщение)
 * @param {Array<{ role: string; content: string }>} [params.historyMessages]
 * @param {string} params.userMessage
 * @returns {Promise<string>}
 */
export async function createChatCompletion({
  client,
  systemPrompt,
  knowledgeContextPrompt = null,
  historyMessages = [],
  userMessage,
}) {
  const history = historyMessages.filter(isChatHistoryMessage).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const systemMessages = [{ role: "system", content: systemPrompt }];
  if (knowledgeContextPrompt) {
    systemMessages.push({ role: "system", content: knowledgeContextPrompt });
  }

  const response = await client.chat.completions.create({
    model: OPENAI_CHAT_MODEL,
    temperature: OPENAI_CHAT_DEFAULTS.temperature,
    max_tokens: OPENAI_CHAT_DEFAULTS.max_tokens,
    messages: [...systemMessages, ...history, { role: "user", content: userMessage }],
  });

  const text = response.choices[0]?.message?.content?.trim();
  return typeof text === "string" ? text : "";
}
