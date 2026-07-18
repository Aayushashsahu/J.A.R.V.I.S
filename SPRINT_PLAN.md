# J.A.R.V.I.S — ET AI Hackathon 2026 Sprint Plan

> **Hackathon:** ET AI Hackathon 2026 — Problem #8 (Industrial Knowledge Intelligence)
> **Repo (sanitized):** https://github.com/Aayushashsahu/J.A.R.V.I.S.git
> **Working folder:** `C:\J.A.R.V.I.S (hackthone)\`
> **Sprint window:** 30 hours total (planned for a 2-day burst; aim to submit at Hour 30 for early-bird bonus)
> **Goal:** Working Industrial Knowledge Intelligence platform that demos end-to-end on real OISD / Factory Act / BIS / PESO documents with citation-backed answers, agent orchestration, and a graph-of-thought knowledge view.

---

## 1. Mission (in one sentence)

Ship a working J.A.R.V.I.S demo that ingests hazardous-process documents, answers inspector-style questions with citations, runs multi-agent research, and visualizes the knowledge graph — and get it submitted with a clean README, deployed link, and architecture diagram.

---

## 2. The Four Roles

| Person | Role | Primary Output |
|---|---|---|
| **Aayush** | Architect, Integrator, Pitch Owner | Repo health, integration, submitting, demo rehearsal |
| **Navansh** | RAG + Vector Lead | `/api/chat` real-DB plumbing, hybrid search, embeddings |
| **Yash** | Agent + Reasoning Lead | `/api/agent/orchestrate`, multi-agent flow, KG build |
| **Nirupam Pal** | Frontend + UX Lead | Dashboard, query UI, graph viz, citations panel |

> The original JARVIS code (Aayush's personal work) is preserved separately at `C:\J.A.R.V.I.S.zip`. Any rewrite happens in `C:\J.A.R.V.I.S (hackthone)\` only.

---

## 3. Aayush — Architect, Integrator, Pitch Owner

**Mission:** *Protect the existing codebase, integrate teammates' modules, ensure the demo works, and deliver submission.*

This is the role definition you asked for. Below is the hour-by-hour table you specified, locked.

### Aayush's hour-by-hour deliverables

| Hour | What must be done | Visible output |
|---:|---|---|
| **0–1** | Create branches | `main` protected; `feat/navansh-rag`, `feat/yash-agents`, `feat/nirupam-ui`, `feat/aayush-infra` all pushed; branch protection set (no force-push to `main`). |
| **1–2** | Write `CONTRACTS.md`, `README.md`, `DEMO_SCRIPT.md` | All three committed to `main`. CONTRACTS.md freezes the public API shapes for the next 26 hours. |
| **2–4** | Smoke-test the stack, wire first endpoints | `docker compose up` brings up Postgres + Qdrant + Redis + backend + frontend with zero errors; `/api/chat` returns at least one canned response; `/api/agent/orchestrate` returns 200 on a stub. |
| **4–8** | Standby, unblock, review contract compliance | Sit in the group DM. PR-by-PR review only — no code writing unless Navansh/Yash/Nirupam are blocked on infra. Pin a checklist of frozen contracts. |
| **8–14** | First end-to-end integration | Three teammates' branches merged behind feature flags; `/api/chat` + `/api/agent/orchestrate` + dashboard query all run on the *same* dataset. |
| **14–18** | Architecture diagram + docs | Draw.io → PNG of full system (Ingest → Embed → Qdrant → Retriever → LLM → Frontend); embed in README. C4-style diagram for the architecture section. |
| **18–22** | Integration testing, merge branches | All feature flags off; one final integration push to `main`; smoke-test all four primary demo flows in production config. |
| **22–24** | Full demo rehearsal | Walk through `DEMO_SCRIPT.md` end-to-end twice. Time it. Identify the failure point. Fix immediately. |
| **24–28** | Final polish (README, arch diagram, screenshots) | Polished README with logo, demo GIF, architecture, install, env table, ethics note, team credits. Five screenshots. |
| **28–30** | Final rehearsal + submit | One last dry run. Submit the repository and deployment link. Hand off the next-sprint task list to Navansh (so Aayush is free post-submission). |

### Aayush owns (assigned into everyone's path)

- Repo health, `.env.example`, secrets, `.gitignore`.
- `docker-compose.yml` and the `gbrain` service config.
- `gbrain init --pglite --no-embedding` initialization step (documented).
- `feedback/kg-builder` glue code (Yash writes the agent; Aayush wires the NetworkX store into the backend startup).
- Submission ZIP and the public GitHub link.
- The 60-second pitch script (3 bullets + 1 close).

### Aayush's pre-flight checks (Hour 0)

1. Confirm the working folder is `C:\J.A.R.V.I.S (hackthone)\` — *not* the personal JARVIS copy.
2. `git status` is clean. Origin points to `https://github.com/Aayushashsahu/J.A.R.V.I.S.git`.
3. `.env.example` has *no* live keys — placeholders only.
4. Docker Desktop is running and has at least 8 GB RAM allocated.

---

## 4. Navansh — RAG + Vector Lead

| Hour | Deliverable |
|---:|---|
| **0–1** | Read CONTRACTS.md; comment any blockers in group chat. Clone repo locally, set up `.env`. |
| **2–4** | Pull existing `app/services/retriever.py` and `app/services/embedding_service.py` into shape. Confirm Qdrant collection schema: 768-dim vectors, payload {`source`, `page`, `clause_id`, `text`}. |
| **4–8** | Hybrid search: BM25 over Postgres `documents` table + cosine over Qdrant. Reciprocal rank fusion. Must add `POST /api/ingest/upload` to accept a folder of OISD PDF docs. |
| **8–14** | Wire `/api/chat` to use the hybrid retriever + the response format promised in CONTRACTS.md (answer, citations[], chunk_ids[]). Stream tokens. |
| **14–18** | Cache embeddings in Postgres with a content-hash key. Add `/api/ingest/status/{job_id}` polling endpoint. |
| **18–22** | Submit a clean PR to `feat/navansh-rag`. Run the smoke tests from `tests/integration/test_chat.py`. |
| **22–28** | Standby for question / answer hardening. No new features — only edge-case catches. |
| **28–30** | Rehearse five demo questions with Aayush. Take one answer for the README screenshot. |

**Critical handoff:** the `/api/ingest/upload` endpoint must accept any file path the frontend can supply; the response shape is fixed in CONTRACTS.md as `{job_id, accepted, total}`.

---

## 5. Yash — Agent + Reasoning Lead

| Hour | Deliverable |
|---:|---|
| **0–1** | Read CONTRACTS.md. Branch `feat/yash-agents` already exists. Pick a single-agent framework (LangGraph) and pin the version in `requirements.txt`. |
| **2–4** | Stub `/api/agent/orchestrate` returns canned JSON for the contract shape. |
| **4–8** | Implement a *single*-agent pipeline: question → planner → retriever (calls Navansh's RAG) → verifier → formatter. Use NVIDIA NIM (Llama 3.1 70B) as primary LLM; Gemini as fallback if NV key missing. |
| **8–14** | Multi-agent: add a "researcher" sub-agent that fans out 3 sub-questions and synthesises. Persist agent runs to the `agent_runs` table with full trace JSON. |
| **14–18** | Build the knowledge graph: NetworkX in-process, but expose `/api/kg/neighbors/{entity}` returning `{source, target, weight}[]`. |
| **18–22** | Frontend integration: `/api/agent/stream` — server-sent events for live token streaming. |
| **22–28** | Hardening: input validation (LangGraph state guard), timeout 60s on every agent run, cost-aware model selection. |
| **28–30** | Rehearse the multi-agent demo. README "How the agent thinks" section. |

**Critical handoff:** the `/api/agent/orchestrate` request/response JSON is fixed in CONTRACTS.md. Do not change fields mid-sprint without a call to Aayush.

---

## 6. Nirupam Pal — Frontend + UX Lead

| Hour | Deliverable |
|---:|---|
| **0–1** | Read CONTRACTS.md. Check out `feat/nirupam-ui`. Run `npm install` and confirm dev server boots on :3000. |
| **2–4** | Skeleton dashboard: query box (left), answer pane with citations (right), file-upload panel (bottom). No styling perfection yet — just layout. |
| **4–8** | Wire `<QueryBox />` to `POST /api/chat`. Render citations as clickable chips. Each chip scrolls the source-document viewer. |
| **8–14** | Add `/admin/ingest` page: drop-zone for PDFs, live progress bar polling `/api/ingest/status/{job_id}`. |
| **14–18** | Add knowledge-graph viewer: a small canvas with circles (entities) and lines (relations). Click a node → cite one source. Use `react-force-graph-2d` or a lighter lib (no heavy D3). |
| **18–22** | "Reasoning trace" panel: shows the live agent SSE stream — planner → retriever → verifier → final. |
| **22–28** | Polish: dark mode, mobile-friendly, keyboard shortcut for "ask". Add a "Reset demo" button. Bump Lighthouse score. |
| **28–30** | Screenshot all five flows. Embed in README. Rehearse the demo with Aayush. |

**Critical handoff:** the frontend never holds secrets. NVIDIA key, Gemini key, JWT, anything sensitive — *only* in the backend env. Nirupam must pull these from `/api/config` (debug-only endpoint) if needed for a feature flag.

---

## 7. CONTRACTS.md (locked — do not change without Aayush's approval)

```jsonc
// POST /api/chat
// Request:
{
  "workspace_id": "demo",
  "question": "What is the minimum clearance for hydrocarbon storage under OISD-118?",
  "filters": { "clause": null, "source": null },
  "top_k": 6
}

// Response (streamed via NDJSON, one line per event):
{"type":"token", "delta":"..."}
{"type":"citation", "chunk_id":"oisd118_p12_c42", "source":"OISD-118.pdf", "page":12, "clause":"3.4"}
{"type":"final", "answer":"...", "citations":[...], "confidence":0.83}
```

```jsonc
// POST /api/agent/orchestrate
// Request:
{ "workspace_id":"demo", "goal":"Compare OISD-118 vs PESO for LPG storage", "max_steps":6 }
// Response (SSE):
{"event":"trace", "step":1, "node":"planner", "content":"..."}
{"event":"trace", "step":2, "node":"retriever", "sources":3}
{"event":"final",   "answer":"...", "sources":[...], "agent_run_id":"..."}
```

```jsonc
// POST /api/ingest/upload
// Request: multipart/form-data, field name "files"
// Response: { "job_id":"...", "accepted":3, "total":3 }
// Subsequent: GET /api/ingest/status/{job_id} → { "state":"processing|done|error", "progress":0.42, "errors":[] }
```

```jsonc
// GET /api/kg/neighbors/{entity}
// Response: { "entity":"OISD-118", "neighbors":[{"source":"PESO","target":"OISD-118","weight":0.81}] }
```

---

## 8. Communication rules (read these or lose time)

- **One group DM only.** No separate chats. Pin: CONTRACTS.md link, sprint table link, demo script link.
- **Every PR needs a one-line summary on first line**: `[contract] …`, `[secrets] …`, `[demo] …` — so Aayush can review by tag.
- **No midnight surprises.** Any breaking change to a contract needs a heads-up **30 min before** the merge.
- **Standups**: every 4 hours, top of the hour. 3 lines max: *what I shipped, what's blocking me, what's next*.
- **Blockers go to Aayush first**, not the group, when they touch infra/secrets/submission.

---

## 9. Demo script (the 60 seconds that matter)

1. **0–10s**: Drag three industrial PDFs (OISD-118, Factory Act 1948, PESO rules) onto the dashboard. Progress bar fills.
2. **10–25s**: Type: *"What is the minimum setback for LPG bulk storage above 1000 MT?"* → answer streams with citations; click the citation chip → source page jumps.
3. **25–45s**: Switch to **Agent mode**: *"Compare OISD-118 and PESO for fire-water reservation."* Watch the trace panel: planner → retriever → verifier → final.
4. **45–55s**: Click an entity (**PESO**) on the knowledge-graph view. Lines light up.
5. **55–60s**: One sentence close: *"Same citations, every time. Auditable by design."*

---

## 10. Risk register (the things that *will* go wrong)

| Risk | Mitigation |
|---|---|
| NVIDIA API key absent / rate-limit | Fallback path to Gemini already coded in `llm_provider.py`. Env var drives selection. |
| Qdrant memory pressure with 50+ PDFs | Disable in-memory ANN index if RAM < 6 GB; use quantised vectors. |
| NetworkX graph blows past 10k nodes | Cap `max_entities` per workspace. Default 2000. |
| SSE drops in Safari | Frontend reverts to polling `/api/agent/status/{id}` after 5s of no event. |
| GitHub Actions docker build OOM during submission | Pin base image to `python:3.11-slim`, multi-stage build. |
| Teammate offline for 4+ hours | Aayush picks up the smallest deliverable from that lane; pair-program recovery in 30 minutes. |

---

## 11. Submission checklist (Hour 28–30)

- [ ] `README.md` is clean: problem statement, demo GIF, architecture diagram, install steps, env table, ethics note, team credits.
- [ ] `CONTRACTS.md` present and unchanged from this document.
- [ ] `LICENSE` (MIT or Apache-2.0).
- [ ] `.env.example` has zero live secrets.
- [ ] `.gitignore` excludes `vault/`, `gbrain_temp/`, `node_modules/`, `**/.git/`, `uploads/`.
- [ ] Repository is public: `https://github.com/Aayushashsahu/J.A.R.V.I.S`.
- [ ] Deployment URL is live (Render / Railway free tier) and the link works.
- [ ] Demo video (≤ 3 minutes) uploaded to the hackathon portal.
- [ ] Five screenshots embedded in README (Upload, Chat+Cite, Agent Trace, Knowledge Graph, Settings/Auth).
- [ ] Pitch script rehearsed twice.

---

## 12. Hand-off after submission

**Aayush is "free" after Hour 30.** The following tasks go to Navansh so the demo and the next-sprint prep don't sit on Aayush:

1. Open the GitHub issues list: `[demo]` tag for any tester feedback.
2. Triage the next week's worth of P0/P1 issues.
3. Coordinate with Nirupam on a follow-up UX pass on the agent trace panel.
4. Schedule the next sprint review with all four teammates.

If you have nothing else worth doing today, ping the team that submission button has been clicked.

---

## 13. Copy-paste messages for teammates

> **Paste as your first message in the group DM when the sprint clock starts:**

### → Navansh

> Hey — welcome to the team. J.A.R.V.I.S sprint is starting now. Read this first: **`CONTRACTS.md`** at https://github.com/Aayushashsahu/J.A.R.V.I.S/blob/main/CONTRACTS.md (I'll commit it in 30 min). You're RAG lead. Day 1 (0–8h):
>
> 1. Pull `feat/navansh-rag` from origin. Add `POST /api/ingest/upload`.
> 2. Implement hybrid search (BM25 + cosine) and RRF.
> 3. Wire `/api/chat` against the contract shape.
>
> Open questions: ping me (Aayush) on infra/secrets issues only. Use the group chat for everything else. Tag your PRs `[contract]` if they touch CONTRACTS.md, `[secrets]` if they touch env, `[demo]` if it's user-facing. Standup every 4 hours, top of the hour. Profile pic is set so @ mention me with **architect** to escalate.

### → Yash

> Hey — welcome. J.A.R.V.I.S sprint is starting now. Read **`CONTRACTS.md`** first (linked above). You're agent/reasoning lead. Day 1 (0–8h):
>
> 1. Pull `feat/yash-agents`. Lock framework to LangGraph; pin in `requirements.txt`.
> 2. Stub `/api/agent/orchestrate` to the contract shape today.
> 3. Single-agent flow first (planner → retriever → verifier → formatter).
>
> LLM order: NVIDIA NIM (Llama 3.1 70B) **primary**, Gemini **fallback** — both are wired through `llm_provider.py`. No new secret additions. Tag PRs `[contract]` for shape changes. Standup every 4h. Ping me **architect** for infra/secrets/submission issues only.

### → Nirupam Pal

> Hey — welcome. J.A.R.V.I.S sprint is starting now. Read **`CONTRACTS.md`** first (linked above). You're frontend lead. Day 1 (0–8h):
>
> 1. Pull `feat/nirupam-ui`. Run `npm install`. Confirm Next.js dev server on :3000.
> 2. Skeleton dashboard: query + answer + citations + upload tiles.
> 3. Wire `<QueryBox />` to `POST /api/chat`.
>
> **Frontend never holds secrets.** If you need any flag value for a feature, expose it via `/api/config` (debug endpoint) and I'll add it. Tag PRs `[demo]` for user-facing changes. Standup every 4h. Ping me **architect** for infra/secrets/submission issues only.

---

## 14. The two things Aayush will *not* write

1. **No live secrets in the repo at submission.** Final scan: `git grep -nE '(nvapi-|sk-[a-zA-Z]_|AIza[A-Za-z0-9_-]{20,}|"eyJ)' || echo "clean"`.
2. **No console.log statements at submit time.** Frontend, backend, scripts.

Both are enforced via a CI step Aayush drops in at Hour 22.

---

## 15. Definition of Done (every PR)

- [ ] Branch name starts with `feat/`, `fix/`, or `docs/`.
- [ ] PR has a one-line summary line that begins with `[contract]`, `[secrets]`, `[demo]`, or `[docs]`.
- [ ] At least one reviewer (`@Aayushashsahu` for `[contract]`, `[secrets]`, `[demo]`).
- [ ] `git grep` for live secrets is clean.
- [ ] All four demo flows (Upload → Chat → Agent → Graph) still pass smoke test.

If all five boxes are checked, Aayush merges in under 5 minutes.

---

*End of plan. Good luck — and remember: 2 days, 4 people, 30 hours. Submit early; polish after.*
