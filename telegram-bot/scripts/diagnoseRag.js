/**
 * Диагностика RAG: количество chunks в БД и тестовые вопросы.
 * Запуск: npm run diagnose:rag
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

import {
  getKnowledgeChunkCount,
  searchKnowledgeChunks,
} from "../src/llm/knowledgeSearchService.js";
import { logRagSearch } from "../src/llm/ragLogger.js";
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  RAG_MATCH_THRESHOLD,
  RAG_MATCH_THRESHOLD_RELAXED,
} from "../src/llm/embeddingConfig.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOT_ROOT = path.join(__dirname, "..");

dotenv.config({ path: path.join(BOT_ROOT, ".env") });

const TEST_QUESTIONS = [
  "Какой тариф выбрать для интернет-магазина, если нужны заявки и уведомления менеджеру?",
  "Чем тариф Pro отличается от Start?",
];

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main() {
  const openaiApiKey = requireEnv("OPENAI_API_KEY");
  requireEnv("SUPABASE_URL");
  requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  console.log("[diagnose] Embedding model:", EMBEDDING_MODEL, "dimensions:", EMBEDDING_DIMENSIONS);
  console.log(
    "[diagnose] Thresholds: primary=",
    RAG_MATCH_THRESHOLD,
    "relaxed=",
    RAG_MATCH_THRESHOLD_RELAXED,
  );

  const total = await getKnowledgeChunkCount();
  console.log("[diagnose] knowledge_chunks rows:", total);

  if (total === 0) {
    console.error(
      "[diagnose] ERROR: Knowledge base is not indexed. Run: npm run index:knowledge",
    );
    process.exit(1);
  }

  for (const question of TEST_QUESTIONS) {
    console.log("\n[diagnose] ---");
    const { chunks, candidates, totalInDb } = await searchKnowledgeChunks({
      openaiApiKey,
      query: question,
    });
    logRagSearch({ question, chunks, candidates, totalInDb });
  }
}

main().catch((error) => {
  console.error("[diagnose] Failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
