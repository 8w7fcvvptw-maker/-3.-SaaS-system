/**
 * @typedef {{ content: string; metadata?: Record<string, unknown>; similarity?: number }} KnowledgeChunk
 */

export const NO_KNOWLEDGE_REPLY =
  "В базе знаний нет подходящей информации по вашему вопросу. Опишите задачу подробнее или оставьте заявку через «Оставить заявку» — менеджер свяжется с вами.";

/**
 * @param {KnowledgeChunk[]} chunks
 * @returns {string}
 */
export function buildKnowledgeContextPrompt(chunks) {
  const body = chunks
    .map((chunk, index) => {
      const source =
        typeof chunk.metadata?.source === "string" ? chunk.metadata.source : "неизвестный источник";
      const similarity =
        typeof chunk.similarity === "number" ? chunk.similarity.toFixed(2) : "—";

      return `[${index + 1}] Источник: ${source} (сходство ${similarity})
${chunk.content}`;
    })
    .join("\n\n");

  return `База знаний — единственный источник фактов для ответа на вопрос о продукте и тарифах.

Правила:
- Отвечай только на основе фрагментов ниже. Не используй общие знания вне этого блока.
- Если в фрагментах нет ответа — честно скажи, что в базе знаний нет этой информации, и предложи «Оставить заявку» менеджеру.
- Не называй цены, сроки и скидки, если их нет в фрагментах.
- Не упоминай «базу знаний», «фрагменты», «векторный поиск» в ответе пользователю.

--- Фрагменты ---
${body}
--- Конец фрагментов ---`;
}
