# Architecture

This folder is the **source of truth** for the J.A.R.V.I.S system design. It
ships two artifacts:

| Artifact      | Purpose                                                |
| ------------- | ------------------------------------------------------ |
| `architecture.svg`  | Hand-edited source. Edit this, then rebuild the PNG. |
| `architecture.png`  | Built artifact for review tools and the GitHub README. |

> **PNG regeneration:** `python docs/architecture/build_architecture.py`
> (uses Microsoft Edge headless — same pattern as `SPRINT_PLAN_build.py`).

## C4 Levels

The diagram intentionally stops at **C4 Level 1 (System Context)** and
**C4 Level 2 (Containers)**. Code-level component maps live in the source
itself; an SVG would fall out of date within a sprint.

### Context (`#ffd166` amber band)

- **Industrial user** sends natural-language questions.
- **J.A.R.V.I.S platform** returns grounded answers and surfaces files
  from the operator's local vault.
- **External LLM providers** (Gemini 2.5 Flash primary, NVIDIA Llama 3.1
  70B fallback) are the only third-party data recipients.

### Containers (`#5b8def` blue band)

| Container        | What it does                                                  |
| ---------------- | ------------------------------------------------------------- |
| **Frontend**     | Next.js 13 App Router. Renders dashboard, chat, documents, beliefs, graph, timeline. |
| **Backend**      | FastAPI. Owns routers, services, workers, MCP client, and the retrieval cascade. |
| **Vault folder** | Operator's local `/vault` of markdown / PDF / docx. Polling-observer-watched. |
| **Storage**      | PostgreSQL 15 (truth) · Qdrant v1.9 (768d vectors, collection `jarvis_memory`) · Redis 7. |
| **GBrain sidecar** | Bun-pglite note system. Shares backend's netns at `127.0.0.1:8001` via `network_mode: "service:backend"`. Streamable-HTTP MCP. |
| **External LLMs** | Gemini + NVIDIA — only outbound dependency that costs money. |

## End-to-End Pipeline (1–6, color-coded on the diagram)

1. **Ingest** — uploaded files, vault polling, and direct API writes all land in
   the `QueuedTask` table.
2. **Embed** — `DocumentProcessor` chunks at 1000/200; `LLMProvider` embeds with
   `gemini-embedding-2` (768-dim cosine).
3. **Store** — chunks upsert into Qdrant with `workspace_id`, `doc_id`,
   `source_file`, `evidence_type`, and `priority` payloads; metadata into
   PostgreSQL.
4. **Retrieve** — the five-level cascade (P1→P5) executed on every chat turn.
5. **Reason** — `LLMProvider` composes an evidence-aware answer; Gemini with
   automatic NVIDIA fallback if Gemini errors or 429s.
6. **Render** — streamed answer + citation chips in the chat UI; HUD/timeline
   updated via the background workers.

## Retrieval Cascade (P1–P5)

| Slot | Source          | Where it lives                 | Selection rule                |
| ---- | --------------- | ------------------------------ | ----------------------------- |
| P1   | Vector search   | Qdrant `jarvis_memory`         | workspace-filter, top-k=5     |
| P2   | Note synthesis  | GBrain                         | markdown-graph query          |
| P3   | PKM entities    | PostgreSQL `pkm_entities`      | top-10 by confidence          |
| P4   | Beliefs         | PostgreSQL `beliefs`           | top-5 by confidence           |
| P5   | Reflections     | PostgreSQL `reflections`       | top-3 by `created_at`, `type='reflection'` |

The cascade runs in order; later sources fill gaps the earlier ones failed to
cover. ACL: every query is filtered by `workspace_id` server-side.

## Security Notes

This diagram intentionally contains **no secrets**. All credentials live in
`.env` and are read at startup:

- `JWT_SECRET_KEY` — signs session tokens.
- `GEMINI_API_KEY` → `LLMProvider` (`LLMProvider` injects via `os.getenv`).
- `NVIDIA_API_KEY` → fallback path only (requested lazily, never at boot).
- `GBRAIN_ADMIN_BOOTSTRAP_TOKEN` — single-use secret; required at first boot.

The `.env.example` shipped at the repo root is template-only.

## Editing

1. Edit `architecture.svg` in a vector editor (Inkscape, Figma, draw.io).
2. Run `python docs/architecture/build_architecture.py`.
3. Commit both files. The PNG is a build artifact but is committed so it
   shows up inline on GitHub and in the demo.
