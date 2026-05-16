import {
  RAG_LOG_SNIPPET_LENGTH,
  RAG_MATCH_THRESHOLD,
  RAG_MATCH_THRESHOLD_RELAXED,
} from "./embeddingConfig.js";

/**
 * @param {object} params
 * @param {string} params.question
 * @param {Array<{ content: string; similarity?: number; metadata?: Record<string, unknown> }>} params.chunks
 * @param {Array<{ content: string; similarity?: number; metadata?: Record<string, unknown> }>} [params.candidates]
 * @param {number} [params.totalInDb]
 */
export function logRagSearch({ question, chunks, candidates = [], totalInDb }) {
  console.log("[rag] User question:", question);

  if (typeof totalInDb === "number") {
    console.log("[rag] knowledge_chunks rows in DB:", totalInDb);
  }

  console.log(
    `[rag] Search thresholds: primary=${RAG_MATCH_THRESHOLD}, relaxed=${RAG_MATCH_THRESHOLD_RELAXED}`,
  );

  if (candidates.length > 0) {
    console.log("[rag] Top candidates from DB (before threshold filter):");
    candidates.forEach((chunk, index) => {
      const preview = chunk.content.slice(0, RAG_LOG_SNIPPET_LENGTH);
      const similarity = typeof chunk.similarity === "number" ? chunk.similarity.toFixed(3) : "—";
      const source =
        typeof chunk.metadata?.source === "string" ? chunk.metadata.source : "unknown";
      console.log(`[rag]   candidate ${index + 1} similarity=${similarity} source=${source}:`, preview);
    });
  }

  console.log("[rag] Chunks selected for prompt:", chunks.length);

  if (chunks.length === 0) {
    console.log("[rag] RAG found 0 chunks.");
    return;
  }

  chunks.forEach((chunk, index) => {
    const preview = chunk.content.slice(0, RAG_LOG_SNIPPET_LENGTH);
    const similarity = typeof chunk.similarity === "number" ? chunk.similarity.toFixed(3) : "—";
    const source =
      typeof chunk.metadata?.source === "string" ? chunk.metadata.source : "unknown";
    console.log(`[rag] Fragment ${index + 1} similarity=${similarity} source=${source}:`, preview);
  });
}
