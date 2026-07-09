# Customer Support Agent

A RAG-powered customer support chatbot. Documents are ingested, chunked, and embedded into PostgreSQL — incoming questions retrieve relevant context, which is passed to a local LLM (via Ollama) to generate responses.

## Stack

- **Backend:** Express + TypeScript
- **Frontend:** Vite + TypeScript
- **Database:** PostgreSQL (vector search for retrieval)
- **LLM:** Ollama (local inference + embeddings)

## Structure

```
packages/
  server/   Express API — ingestion pipeline, RAG retrieval, chat endpoint
  client/   Vite frontend — streaming chat UI
```

## Setup

**Prerequisites:** Node 24+, pnpm, PostgreSQL, [Ollama](https://ollama.ai) running on `localhost:11434`

```bash
pnpm install
pnpm dev        # starts server on :3000 and client dev server
```

**Environment variables** (optional):

| Variable         | Default                       | Description         |
|------------------|-------------------------------|---------------------|
| `OLLAMA_BASE_URL` | `http://localhost:11434`     | Ollama API base URL |
| `OLLAMA_MODEL`    | *(see server config)*        | Model to use        |

## API

| Method | Path         | Description                          |
|--------|--------------|--------------------------------------|
| POST   | `/api/chat`  | Stream a chat response (NDJSON)      |
| POST   | `/pages`     | Ingest a markdown document           |
