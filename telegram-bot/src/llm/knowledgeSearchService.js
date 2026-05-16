import { OpenAIEmbeddings } from "@langchain/openai";

import { supabase } from "../supabaseClient.js";
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  RAG_MATCH_COUNT,
  RAG_MATCH_THRESHOLD,
} from "./embeddingConfig.js";

/**
 * @typedef {{ id: string; content: string; metadata: Record<string, unknown>; similarity: number }} KnowledgeChunk
 */

/**
 * @param {object} params
 * @param {string} params.openaiApiKey
 * @param {string} params.query
 * @returns {Promise<KnowledgeChunk[]>}
 */
export async function searchKnowledgeChunks({ openaiApiKey, query }) {
  const embeddings = new OpenAIEmbeddings({
    apiKey: openaiApiKey,
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  const queryEmbedding = await embeddings.embedQuery(query);

  const { data, error } = await supabase.rpc("match_knowledge_chunks", {
    query_embedding: queryEmbedding,
    match_count: RAG_MATCH_COUNT,
    match_threshold: RAG_MATCH_THRESHOLD,
  });

  if (error) {
    throw new Error(`match_knowledge_chunks failed: ${error.message}`);
  }

  return Array.isArray(data) ? data : [];
}
