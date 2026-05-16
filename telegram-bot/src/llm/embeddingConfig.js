export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

/** Сколько кандидатов запрашивать у БД (фильтр по порогу — в коде) */
export const RAG_MATCH_COUNT = 5;
export const RAG_FETCH_COUNT = 10;

/** Основной порог сходства (0..1). 0.7 для RU часто слишком строго — используем 0.5 */
export const RAG_MATCH_THRESHOLD = 0.5;

/** Если выше основного ничего не прошло — берём лучшие из этого порога */
export const RAG_MATCH_THRESHOLD_RELAXED = 0.35;

/** Длина превью фрагмента в логах RAG */
export const RAG_LOG_SNIPPET_LENGTH = 150;
