# Customer Support Agent

A RAG-powered customer support chatbot. The server ingests markdown knowledge base documents into a PostgreSQL vector database, retrieves relevant context for each user query, and streams responses from a local LLM (Ollama). A minimal browser-based chat UI is served by the client.

## Architecture

```
client/   Vite + TypeScript chat UI (streams SSE responses)
server/   Express API + RAG pipeline
  src/
    ingest/   Chunk → embed → store documents in pgvector
    rag/      Retrieve context → build prompt → stream Ollama response
  data/       Markdown knowledge base files
```

**Stack:** Node.js 24, TypeScript, pnpm workspaces, PostgreSQL + pgvector, Ollama (local LLM)

## Prerequisites

- Node.js 24 (`nvm use`)
- pnpm 9 (`npm i -g pnpm`)
- PostgreSQL with the [pgvector](https://github.com/pgvector/pgvector) extension
- [Ollama](https://ollama.ai) running locally with a chat model pulled (e.g. `ollama pull llama3`)

## Setup

```bash
# Install dependencies
pnpm install

# Create the database and enable pgvector
psql -U postgres -c "CREATE DATABASE customer_support;"
psql -U postgres -d customer_support -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Configure environment
cp server/.env.example server/.env   # then fill in DATABASE_URL and OLLAMA_* vars
```

### Environment variables (server)

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `PORT` | `3000` | HTTP port |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API base URL |
| `OLLAMA_MODEL` | — | Chat model name (e.g. `llama3`) |
| `OLLAMA_EMBED_MODEL` | — | Embedding model name (e.g. `nomic-embed-text`) |

## Development

```bash
# Run client + server in parallel (hot-reload)
pnpm dev

# Or run individually
pnpm --filter server dev
pnpm --filter client dev
```

The server starts on `http://localhost:3000` and serves the built client as static files. In dev mode the Vite dev server proxies API requests to the server.

## Build & Production

```bash
pnpm --filter client build   # outputs to client/dist
pnpm --filter server build   # compiles TypeScript to server/dist
pnpm --filter server start   # runs compiled server
```

## Knowledge Base

Add or edit markdown files in `server/data/`. On startup the server automatically ingests any new or changed files (detected by content hash) into the vector store — no manual step needed.

## API

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/chat` | Send a message; streams an SSE response |

Request body:
```json
{
  "customerId": 1,
  "messages": [{ "role": "user", "content": "How do I reset my password?" }]
}
```
