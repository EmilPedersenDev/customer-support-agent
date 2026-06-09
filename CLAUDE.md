# CLAUDE.md

## Project Overview

Customer Support Agent — a RAG-powered chatbot. Ingests markdown knowledge-base
documents into PostgreSQL with pgvector, retrieves relevant chunks at query time,
and streams answers via a local Ollama LLM.

## Monorepo Structure

```
customer-support-agent/
├── client/              # Vite + TypeScript browser UI
├── server/              # Express REST API + RAG pipeline
├── package.json         # pnpm workspace root
└── pnpm-workspace.yaml
```

## Tech Stack

| Layer          | Tool                              |
|----------------|-----------------------------------|
| Runtime        | Node.js 24 (see `.nvmrc`)         |
| Language       | TypeScript 5 (strict)             |
| Package manager| pnpm 9                            |
| Server         | Express 4                         |
| Client build   | Vite 6                            |
| Database       | PostgreSQL + pgvector extension   |
| LLM            | Ollama (local REST API)           |

## Development

```bash
# Prerequisites: PostgreSQL with pgvector, Ollama running locally
cp server/.env.example server/.env   # fill in DATABASE_URL, adjust models if needed

pnpm install
pnpm dev          # starts server (:3000) + client (:5173) concurrently
```

### Individual packages

```bash
pnpm --filter server dev     # server only, watch mode
pnpm --filter client dev     # client only, Vite HMR
pnpm --filter server build   # compile server → dist/
pnpm --filter client build   # typecheck + Vite build → dist/
```

## Environment Variables (server)

| Variable                 | Default                    | Purpose                          |
|--------------------------|----------------------------|----------------------------------|
| `DATABASE_URL`           | —                          | PostgreSQL connection string     |
| `PORT`                   | `3000`                     | HTTP server port                 |
| `OLLAMA_BASE_URL`        | `http://localhost:11434`   | Ollama API base URL              |
| `OLLAMA_MODEL`           | `gemma3`                   | Chat generation model            |
| `OLLAMA_EMBEDDING_MODEL` | `nomic-embed-text-v2-moe`  | Embedding model (768-dim)        |

## API Endpoints

| Method | Path        | Purpose                                                        |
|--------|-------------|----------------------------------------------------------------|
| POST   | `/api/chat` | Stream a chat response. Body: `{ customerId, messages }`      |
| POST   | `/pages`    | Trigger manual re-ingestion of all knowledge-base files        |

## Server Source Layout (`server/src/`)

```
index.ts            # Express app, route handlers
db.ts               # pg Pool singleton
ingest/
  pipeline.ts       # Orchestrates read → chunk → embed → store
  chunk.ts          # Splits markdown on H2 (##) headers
  embed.ts          # Batch-embeds text via Ollama /api/embed
  hash.ts           # SHA256 content hashing (skip unchanged files)
  normalize.ts      # Normalises whitespace before embedding
  store.ts          # UPSERT into pages table
rag/
  retrieve.ts       # Cosine similarity search, returns top 5 chunks
  prompt.ts         # Builds system prompt with retrieved context + history
```

## Client Source Layout (`client/src/`)

```
main.ts             # Vanilla TypeScript; chat form + SSE stream parsing
```

## Key Architecture Decisions

- **Streaming end-to-end**: server pipes Ollama's NDJSON stream directly to HTTP
  response; client reads it line-by-line via fetch.
- **Incremental ingestion**: SHA256 hashes detect unchanged files so only
  modified chunks are re-embedded on startup.
- **Chunking strategy**: markdown documents split on H2 (`##`) headings.
  New knowledge-base files should use `##` sections.
- **No ORM**: raw `pg` queries throughout — keep it that way.
- **Embedding dimensions**: 768 (nomic-embed-text-v2-moe). Changing the model
  requires a schema migration to update the vector column size.

## Knowledge Base

Markdown files in `server/data/`. Each file should use `##` headings to divide
into logical sections. The server ingests them automatically on startup.

## Testing

No test framework is configured yet. When adding tests, use **Vitest**
(compatible with the Vite ecosystem already in use).

## Common Tasks

**Add a new knowledge-base document:**
Drop a `.md` file in `server/data/` with `##`-headed sections; restart the server.

**Change the LLM or embedding model:**
Update `OLLAMA_MODEL` / `OLLAMA_EMBEDDING_MODEL` env vars. If the embedding model
changes its output dimensions, update the `vector(768)` column in the DB schema.

**Add a server route:**
Edit `server/src/index.ts` — follow the existing pattern (parse body, call
service, stream or return JSON).
