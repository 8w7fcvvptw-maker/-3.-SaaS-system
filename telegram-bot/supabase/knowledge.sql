-- RAG: база знаний для Telegram-бота (pgvector)
-- Выполните в Supabase Dashboard → SQL Editor (один раз перед npm run index:knowledge)

create extension if not exists vector;

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);

-- Поиск по косинусному сходству (text-embedding-3-small → 1536 измерений)
create index if not exists knowledge_chunks_embedding_hnsw_idx
  on public.knowledge_chunks
  using hnsw (embedding vector_cosine_ops);

-- query_embedding: вектор вопроса; match_count: сколько фрагментов вернуть;
-- match_threshold: минимальное сходство 0..1 (1 = идеальное совпадение)
create or replace function public.match_knowledge_chunks(
  query_embedding vector(1536),
  match_count int default 5,
  match_threshold float default 0.7
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql
stable
as $$
  select
    kc.id,
    kc.content,
    kc.metadata,
    1 - (kc.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks kc
  where 1 - (kc.embedding <=> query_embedding) >= match_threshold
  order by kc.embedding <=> query_embedding
  limit greatest(match_count, 0);
$$;

grant execute on function public.match_knowledge_chunks(vector, int, float) to service_role;
