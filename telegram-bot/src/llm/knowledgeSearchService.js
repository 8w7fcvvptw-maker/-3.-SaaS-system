import { OpenAIEmbeddings } from "@langchain/openai";

import { supabase } from "../supabaseClient.js";
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  RAG_FETCH_COUNT,
  RAG_MATCH_COUNT,
  RAG_MATCH_THRESHOLD,
  RAG_MATCH_THRESHOLD_RELAXED,
} from "./embeddingConfig.js";

/**
 * @typedef {{ id: string; content: string; metadata: Record<string, unknown>; similarity: number }} KnowledgeChunk
 */

export class KnowledgeNotIndexedError extends Error {
  constructor() {
    super("Knowledge base is not indexed");
    this.name = "KnowledgeNotIndexedError";
    this.code = "KNOWLEDGE_NOT_INDEXED";
  }
}

/**
 * @returns {Promise<number>}
 */
export async function getKnowledgeChunkCount() {
  const { count, error } = await supabase
    .from("knowledge_chunks")
    .select("id", { count: "exact", head: true });

  if (error) {
    throw new Error(`knowledge_chunks count failed: ${error.message}`);
  }

  return count ?? 0;
}

/**
 * @param {number[]} queryEmbedding
 * @returns {Promise<KnowledgeChunk[]>}
 */
async function fetchKnowledgeCandidates(queryEmbedding) {
  const { data, error } = await supabase.rpc("match_knowledge_chunks", {
    query_embedding: queryEmbedding,
    match_count: RAG_FETCH_COUNT,
    // 0 = без фильтра в SQL, top-N по similarity (порог — в Node.js)
    match_threshold: 0,
  });

  if (error) {
    throw new Error(`match_knowledge_chunks failed: ${error.message}`);
  }

  return Array.isArray(data) ? data : [];
}

/**
 * @param {KnowledgeChunk[]} candidates
 * @returns {KnowledgeChunk[]}
 */
function pickChunksByThreshold(candidates) {
  const primary = candidates.filter((c) => c.similarity >= RAG_MATCH_THRESHOLD);
  if (primary.length > 0) {
    return primary.slice(0, RAG_MATCH_COUNT);
  }

  const relaxed = candidates.filter((c) => c.similarity >= RAG_MATCH_THRESHOLD_RELAXED);
  if (relaxed.length > 0) {
    console.log(
      `[rag] No chunks above threshold ${RAG_MATCH_THRESHOLD}; using relaxed threshold ${RAG_MATCH_THRESHOLD_RELAXED}`,
    );
    return relaxed.slice(0, RAG_MATCH_COUNT);
  }

  return [];
}

/**
 * @param {object} params
 * @param {string} params.openaiApiKey
 * @param {string} params.query
 * @returns {Promise<{ chunks: KnowledgeChunk[]; totalInDb: number; candidates: KnowledgeChunk[] }>}
 */
export async function searchKnowledgeChunks({ openaiApiKey, query }) {
  const totalInDb = await getKnowledgeChunkCount();
  if (totalInDb === 0) {
    throw new KnowledgeNotIndexedError();
  }

  const embeddings = new OpenAIEmbeddings({
    apiKey: openaiApiKey,
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  const queryEmbedding = await embeddings.embedQuery(query);
  const candidates = await fetchKnowledgeCandidates(queryEmbedding);
  const chunks = pickChunksByThreshold(candidates);

  return { chunks, totalInDb, candidates };
}
