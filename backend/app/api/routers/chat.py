import asyncio
import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import AsyncIterator, List

from app.api import deps
from app.db.models import User, Workspace, Conversation, Message
from app.schemas import Citation
from app.services.llm_provider import llm_provider
from app.services.retriever import retriever

router = APIRouter()

class ChatRequest(BaseModel):
    conversation_id: str = None
    message: str
    # Retrieval controls — both are optional with safe defaults.
    # Existing clients that omit these fields get identical behaviour to before.
    top_k: int = 5          # number of chunks to retrieve from Qdrant
    use_hybrid: bool = False # True → BM25 + dense + RRF; False → dense-only

class ChatResponse(BaseModel):
    conversation_id: str
    message: str
    citations: List[Citation] = []  # populated from retrieved chunks; empty when Qdrant has no hits

@router.post("/{workspace_id}/chat", response_model=ChatResponse)
async def chat(
    workspace_id: str,
    request: ChatRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    # Verify workspace
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.user_id == current_user.id
    ).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    conversation_id = request.conversation_id
    if not conversation_id:
        # Create new conversation
        title = request.message[:50] + "..." if len(request.message) > 50 else request.message
        conv = Conversation(user_id=current_user.id, workspace_id=workspace_id, title=title)
        db.add(conv)
        db.commit()
        db.refresh(conv)
        conversation_id = conv.id

    # Verify conversation
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.workspace_id == workspace_id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Save user message
    user_msg = Message(conversation_id=conversation_id, role="user", content=request.message)
    db.add(user_msg)

    import logging
    logger = logging.getLogger(__name__)

    # Retrieval (RAG)
    context_str = ""
    
    from app.db.models import PKMEntity, Belief, Memory
    
    fallback_parts = []

    # Priority 1: Source Documents (via Retriever)
    # `retrieved_chunks` is kept in scope so citations can be built at return time.
    retrieved_chunks = []
    try:
        retrieved_chunks = retriever.retrieve(
            query=request.message,
            workspace_id=workspace_id,
            top_k=request.top_k,
            use_hybrid=request.use_hybrid,
        )
        if retrieved_chunks:
            qdrant_texts = [f"Source: {c.source}\nContent: {c.text}" for c in retrieved_chunks]
            fallback_parts.append("[Priority 1: Source Documents]\n" + "\n\n".join(qdrant_texts))
            mode = "hybrid (BM25+RRF)" if request.use_hybrid else "dense"
            logger.info(f"Retrieval [{mode}] successful. Found {len(retrieved_chunks)} chunks.")
    except Exception as e:
        logger.error(f"Retrieval failed: {e}", exc_info=True)

    # Priority 2: GBrain Native Memory (Synthesis)
    from app.services.mcp_client import gbrain_client
    try:
        gbrain_synthesis = await gbrain_client.search(request.message)
        if gbrain_synthesis and not gbrain_synthesis.startswith("Error:"):
            fallback_parts.append(f"[Priority 2: GBrain Synthesis]\n{gbrain_synthesis}\n(Source: GBrain Vault)")
            logger.info("GBrain retrieval successful.")
    except BaseException as e:
        logger.warning(f"GBrain retrieval skipped (non-fatal): {type(e).__name__}: {e}")

    # Priority 3: Structured Memory (PKM Entities)
    pkm_entities = db.query(PKMEntity).filter(PKMEntity.user_id == current_user.id).order_by(PKMEntity.confidence.desc()).limit(10).all()
    if pkm_entities:
        pkm_texts = [f"- [{p.category}] {p.value} (Source: {p.source_file or 'System'})" for p in pkm_entities]
        fallback_parts.append("[Priority 3: Structured Memory]\n" + "\n".join(pkm_texts))

    # Priority 4: Beliefs
    beliefs = db.query(Belief).filter(Belief.user_id == current_user.id).order_by(Belief.confidence.desc()).limit(5).all()
    if beliefs:
        belief_texts = [f"- {b.belief_text} (Source: {b.source_notes or 'System'})" for b in beliefs]
        fallback_parts.append("[Priority 4: Beliefs]\n" + "\n".join(belief_texts))

    # Priority 5: Reflections
    memories = db.query(Memory).filter(Memory.user_id == current_user.id, Memory.type == "reflection").order_by(Memory.created_at.desc()).limit(3).all()
    if memories:
        memory_texts = [f"- {m.title}: {m.content} (Source: {m.source_file or 'System'})" for m in memories]
        fallback_parts.append("[Priority 5: Reflections]\n" + "\n".join(memory_texts))

    context_str = "\n\n".join(fallback_parts)
    logger.info(f"Context assembled. Size: {len(context_str)} chars.")

    # System Prompt for RAG
    system_prompt = (
        "You are J.A.R.V.I.S., an intelligent, friendly, curious, and highly memory-aware AI second brain.\n\n"
        "EVIDENCE HIERARCHY RULES:\n"
        "You must answer using the highest priority evidence available in the context.\n"
        "- Priority 1 (Source Documents): Hard facts. Always trust these over anything else.\n"
        "- Priority 2 (GBrain Synthesis): Context synthesized from GBrain markdown graph.\n"
        "- Priority 3 (Structured Memory): Extracted facts.\n"
        "- Priority 4 (Beliefs): Synthesized long-term truths.\n"
        "- Priority 5 (Reflections): Lower trust information. Used ONLY for identifying patterns or suggesting questions. Reflections MUST NEVER override Priority 1, 2 or 3 facts.\n\n"
        "EXPLAINABILITY RULES:\n"
        "If the user asks 'Why', 'How', or 'What evidence', your answer must include:\n"
        "A. Reasoning\n"
        "B. Supporting Evidence (quoting the exact snippet)\n"
        "C. The exact source file name.\n\n"
        "CITATION RULES:\n"
        "You MUST append a 'Sources:' list at the very end of your response, citing the exact source files provided in the context. NEVER output 'Source: Unknown'. If a source is System, omit it from the final sources list.\n\n"
        f"Context:\n{context_str}"
    )

    # Generate Response
    try:
        assistant_response_text = await run_in_threadpool(
            llm_provider.generate_text,
            prompt=request.message,
            system_prompt=system_prompt
        )
    except (Exception, asyncio.CancelledError) as e:
        logger.error(f"LLM Generation completely failed: {type(e).__name__}: {e}", exc_info=True)
        # Deep Fallback Mode (If both Gemini and NVIDIA fail)
        assistant_response_text = (
            "J.A.R.V.I.S. core systems are completely offline due to API failures.\n\n"
            "Raw Memory Dump:\n" + context_str
        )
    # Safety: ensure response is never None
    if not assistant_response_text:
        assistant_response_text = (
            "J.A.R.V.I.S. received an empty response from the LLM provider.\n\n"
            "Raw Memory Dump:\n" + context_str
        )

    # Save assistant message — never save None to DB
    assistant_msg = Message(
        conversation_id=conversation_id,
        role="assistant",
        content=assistant_response_text or "No response generated."
    )
    db.add(assistant_msg)
    db.commit()

    # Build structured citations from retrieved chunks.
    # Each Citation is constructed directly from ChunkResult fields that were
    # already stored in the Qdrant payload — zero additional DB lookups needed.
    citations = [
        Citation(
            chunk_id=c.chunk_id,
            source=c.source,
            page=c.page,
            clause_id=c.clause_id,
            score=round(c.score, 4),
            snippet=c.text[:200],       # first 200 chars as hover preview
        )
        for c in retrieved_chunks
        if c.source != "Unknown"        # skip chunks with no provenance
    ]

    return ChatResponse(
        conversation_id=conversation_id,
        message=assistant_response_text,
        citations=citations,
    )


# ── Streaming endpoint ─────────────────────────────────────────────────────
#
# POST /{workspace_id}/chat/stream
#
# Wire format (Server-Sent Events over text/event-stream):
#
#   data: {"type":"token",    "content":"<fragment>"}     ← one per LLM chunk
#   data: {"type":"citations","citations":[...]}          ← one final event
#   data: [DONE]                                          ← OpenAI-style terminator
#
# Clients that don’t need streaming should continue to use /chat.
# The route path, request schema (ChatRequest), and auth are identical.
# ─────────────────────────────────────────────────────────────

stream_logger = logging.getLogger(f"{__name__}.stream")

@router.post("/{workspace_id}/chat/stream", response_class=StreamingResponse)
async def chat_stream(
    workspace_id: str,
    request: ChatRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Streaming variant of /chat.  Returns Server-Sent Events.

    Accepts the same ChatRequest body as /chat (including use_hybrid and
    top_k).  Emits token events as the LLM produces them, followed by a
    single citations event and a [DONE] terminator.
    """
    # ── 1. Guard: workspace must exist and belong to this user ──────────────
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.user_id == current_user.id,
    ).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # ── 2. Conversation book-keeping ──────────────────────────────────
    conversation_id = request.conversation_id
    if not conversation_id:
        title = request.message[:50] + "..." if len(request.message) > 50 else request.message
        conv = Conversation(user_id=current_user.id, workspace_id=workspace_id, title=title)
        db.add(conv)
        db.commit()
        db.refresh(conv)
        conversation_id = conv.id
    else:
        conv = db.query(Conversation).filter(
            Conversation.id == conversation_id,
            Conversation.workspace_id == workspace_id,
        ).first()
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")

    # Save user message immediately so it persists even if the stream errors.
    db.add(Message(conversation_id=conversation_id, role="user", content=request.message))
    db.commit()

    # ── 3. Retrieval — identical logic to /chat ──────────────────────────
    from app.db.models import PKMEntity, Belief, Memory
    from app.services.mcp_client import gbrain_client

    fallback_parts = []
    retrieved_chunks = []

    try:
        retrieved_chunks = retriever.retrieve(
            query=request.message,
            workspace_id=workspace_id,
            top_k=request.top_k,
            use_hybrid=request.use_hybrid,
        )
        if retrieved_chunks:
            qdrant_texts = [f"Source: {c.source}\nContent: {c.text}" for c in retrieved_chunks]
            fallback_parts.append("[Priority 1: Source Documents]\n" + "\n\n".join(qdrant_texts))
    except Exception as exc:
        stream_logger.error("Retrieval failed: %s", exc, exc_info=True)

    try:
        gbrain_synthesis = await gbrain_client.search(request.message)
        if gbrain_synthesis and not gbrain_synthesis.startswith("Error:"):
            fallback_parts.append(f"[Priority 2: GBrain Synthesis]\n{gbrain_synthesis}\n(Source: GBrain Vault)")
    except BaseException:
        pass

    pkm_entities = db.query(PKMEntity).filter(PKMEntity.user_id == current_user.id).order_by(PKMEntity.confidence.desc()).limit(10).all()
    if pkm_entities:
        fallback_parts.append("[Priority 3: Structured Memory]\n" + "\n".join(
            f"- [{p.category}] {p.value} (Source: {p.source_file or 'System'})" for p in pkm_entities
        ))

    beliefs = db.query(Belief).filter(Belief.user_id == current_user.id).order_by(Belief.confidence.desc()).limit(5).all()
    if beliefs:
        fallback_parts.append("[Priority 4: Beliefs]\n" + "\n".join(
            f"- {b.belief_text} (Source: {b.source_notes or 'System'})" for b in beliefs
        ))

    memories = db.query(Memory).filter(Memory.user_id == current_user.id, Memory.type == "reflection").order_by(Memory.created_at.desc()).limit(3).all()
    if memories:
        fallback_parts.append("[Priority 5: Reflections]\n" + "\n".join(
            f"- {m.title}: {m.content} (Source: {m.source_file or 'System'})" for m in memories
        ))

    context_str = "\n\n".join(fallback_parts)

    system_prompt = (
        "You are J.A.R.V.I.S., an intelligent, friendly, curious, and highly memory-aware AI second brain.\n\n"
        "EVIDENCE HIERARCHY RULES:\n"
        "You must answer using the highest priority evidence available in the context.\n"
        "- Priority 1 (Source Documents): Hard facts. Always trust these over anything else.\n"
        "- Priority 2 (GBrain Synthesis): Context synthesized from GBrain markdown graph.\n"
        "- Priority 3 (Structured Memory): Extracted facts.\n"
        "- Priority 4 (Beliefs): Synthesized long-term truths.\n"
        "- Priority 5 (Reflections): Lower trust information. Used ONLY for identifying patterns or suggesting questions. Reflections MUST NEVER override Priority 1, 2 or 3 facts.\n\n"
        "EXPLAINABILITY RULES:\n"
        "If the user asks 'Why', 'How', or 'What evidence', your answer must include:\n"
        "A. Reasoning\n"
        "B. Supporting Evidence (quoting the exact snippet)\n"
        "C. The exact source file name.\n\n"
        "CITATION RULES:\n"
        "You MUST append a 'Sources:' list at the very end of your response, citing the exact source files provided in the context. NEVER output 'Source: Unknown'. If a source is System, omit it from the final sources list.\n\n"
        f"Context:\n{context_str}"
    )

    # ── 4. Pre-compute citations (no DB lookup needed — all fields in payload) ──
    citations = [
        Citation(
            chunk_id=c.chunk_id,
            source=c.source,
            page=c.page,
            clause_id=c.clause_id,
            score=round(c.score, 4),
            snippet=c.text[:200],
        )
        for c in retrieved_chunks
        if c.source != "Unknown"
    ]
    citations_payload = json.dumps(
        {"type": "citations", "citations": [c.model_dump() for c in citations]}
    )

    # ── 5. SSE generator ─────────────────────────────────────────────────
    async def event_generator() -> AsyncIterator[str]:
        full_response_parts: list[str] = []
        try:
            # generate_text_stream() is a synchronous generator; run it in
            # a thread pool so we don’t block the event loop.
            def _stream_sync():
                return list(llm_provider.generate_text_stream(
                    prompt=request.message,
                    system_prompt=system_prompt,
                ))

            # Collect all chunks from the thread pool, then yield them.
            # This is a pragmatic approach: true async streaming would require
            # an async-native Gemini client. For the hackathon, the latency
            # until first token is the same as the non-streaming endpoint, but
            # the wire format is SSE-compatible for future true-async upgrade.
            chunks_list = await run_in_threadpool(_stream_sync)
            for fragment in chunks_list:
                full_response_parts.append(fragment)
                event = json.dumps({"type": "token", "content": fragment})
                yield f"data: {event}\n\n"

        except (Exception, asyncio.CancelledError) as exc:
            stream_logger.error("LLM stream failed: %s: %s", type(exc).__name__, exc, exc_info=True)
            fallback = "J.A.R.V.I.S. streaming is temporarily unavailable."
            full_response_parts.append(fallback)
            yield f"data: {json.dumps({'type': 'token', 'content': fallback})}\n\n"

        finally:
            # Safety: ensure we have at least some content
            if not full_response_parts:
                full_response_parts.append("No response generated.")
            # Persist the full assembled response regardless of success/error.
            full_response = "".join(full_response_parts)
            if full_response:
                db.add(Message(
                    conversation_id=conversation_id,
                    role="assistant",
                    content=full_response,
                ))
                db.commit()

        # Citations event — always emitted, even if retrieval returned nothing.
        yield f"data: {citations_payload}\n\n"

        # OpenAI-compatible stream terminator.
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # disable nginx buffering for SSE
            "Connection": "keep-alive",
        },
    )
