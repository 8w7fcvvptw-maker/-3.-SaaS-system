import { RAG_LOG_SNIPPET_LENGTH } from "./embeddingConfig.js";

/**
 * @param {string} question
 * @param {Array<{ content: string; similarity?: number }>} chunks
 */
export function logRagSearch(question, chunks) {
  console.log("[rag] User question:", question);
  console.log("[rag] Fragments found:", chunks.length);

  chunks.forEach((chunk, index) => {
    const preview = chunk.content.slice(0, RAG_LOG_SNIPPET_LENGTH);
    const similarity = typeof chunk.similarity === "number" ? chunk.similarity.toFixed(3) : "—";
    console.log(`[rag] Fragment ${index + 1} (similarity ${similarity}):`, preview);
  });
}
