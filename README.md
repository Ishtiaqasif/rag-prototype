# Local RAG Prototype (Node.js)

This project is a simpler, fully local Retrieval-Augmented Generation system using Node.js, LangChain, PostgreSQL (pgvector), and Ollama.

## Prerequisites

1.  **Node.js** (v18+)
2.  **Ollama**: [Download and Install](https://ollama.com/)
3.  **PostgreSQL**: with [pgvector](https://github.com/pgvector/pgvector) extension.
4.  **Pull Model**:
    ```bash
    ollama pull llama3
    ```
    *(Note: You can change the model in `.env`)*

## Setup

```bash
npm install
```

## Configuration

This project uses a `.env` file for configuration. Ensure the following variables are set:

```env
OLLAMA_BASE_URL=http://localhost:11434
LLM_MODEL=llama3
EMBEDDING_MODEL=llama3
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=your_password
PG_DATABASE=your_database
```

## Usage

### 1. Ingest Data
Place your `.txt` files in the `data/` directory.

```bash
npx tsx ingest.ts
```

### 2. Chat
Start the interactive CLI:

```bash
npx tsx index.ts
```

## Verification

```bash
npx tsx verify.ts
```
