import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOT_ROOT = path.join(__dirname, "..");
const KNOWLEDGE_DIR = path.join(BOT_ROOT, "knowledge");

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const INSERT_BATCH_SIZE = 25;

dotenv.config({ path: path.join(BOT_ROOT, ".env") });

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function listMarkdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

async function loadDocuments() {
  const files = await listMarkdownFiles(KNOWLEDGE_DIR);
  if (files.length === 0) {
    throw new Error(`No .md files found in ${KNOWLEDGE_DIR}`);
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 150,
  });

  const documents = [];

  for (const filePath of files) {
    const raw = await readFile(filePath, "utf8");
    const source = path.relative(KNOWLEDGE_DIR, filePath).replace(/\\/g, "/");

    const chunks = await splitter.createDocuments(
      [raw],
      [{ source, filename: path.basename(filePath) }],
    );

    chunks.forEach((doc, chunkIndex) => {
      documents.push({
        content: doc.pageContent.trim(),
        metadata: {
          ...doc.metadata,
          chunk_index: chunkIndex,
        },
      });
    });

    console.log(`[index] ${source}: ${chunks.length} chunk(s)`);
  }

  return documents.filter((doc) => doc.content.length > 0);
}

async function clearChunks(supabase) {
  const { error } = await supabase
    .from("knowledge_chunks")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (error) {
    throw new Error(`Failed to clear knowledge_chunks: ${error.message}`);
  }
}

async function insertChunks(supabase, rows) {
  for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + INSERT_BATCH_SIZE);
    const { error } = await supabase.from("knowledge_chunks").insert(batch);

    if (error) {
      throw new Error(`Failed to insert batch at offset ${i}: ${error.message}`);
    }
  }
}

async function main() {
  const openaiApiKey = requireEnv("OPENAI_API_KEY");
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const supabaseServiceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const embeddings = new OpenAIEmbeddings({
    apiKey: openaiApiKey,
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  console.log("[index] Loading markdown from knowledge/...");
  const documents = await loadDocuments();
  console.log(`[index] Total chunks to embed: ${documents.length}`);

  console.log("[index] Clearing old chunks...");
  await clearChunks(supabase);

  console.log("[index] Creating embeddings (OpenAI)...");
  const vectors = await embeddings.embedDocuments(documents.map((doc) => doc.content));

  const rows = documents.map((doc, index) => ({
    content: doc.content,
    metadata: doc.metadata,
    embedding: vectors[index],
  }));

  console.log("[index] Saving to Supabase...");
  await insertChunks(supabase, rows);

  console.log(`[index] Done. Loaded ${rows.length} fragment(s) into knowledge_chunks.`);
}

main().catch((error) => {
  console.error("[index] Failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
