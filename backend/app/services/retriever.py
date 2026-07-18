"""
app/services/retriever.py
─────────────────────────
Single retrieval abstraction for J.A.R.V.I.S.

Currently performs dense vector search via Qdrant.
Step 6 will add BM25 over the Postgres `documents.content` column and
merge both ranked lists with Reciprocal Rank Fusion, controlled by the
`use_hybrid` feature flag (default False so nothing breaks today).

Usage
─────
from app.services.retriever import retriever, ChunkResult

chunks: list[ChunkResult] = retriever.retrieve(
    query="minimum LPG clearance",
    workspace_id="abc-123",
    top_k=5,
)
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List, Optional

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Result dataclass
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ChunkResult:
    """
    A single retrieved text chunk with provenance metadata.

    Fields
    ──────
    chunk_id    : Qdrant point UUID — stable identifier for this chunk
    source      : original filename / source label (maps to CONTRACTS `source`)
    text        : raw chunk text
    score       : cosine similarity score (0.0 – 1.0); after RRF this becomes
                  the fused rank score
    page        : PDF page number; None for non-PDF sources
                  (populated after Step 3 / 4)
    clause_id   : clause or section reference, e.g. "OISD-118 §3.4"
                  (populated after Step 3 / 4)
    document_id : Postgres Document.id — links back to the DB record
    """

    chunk_id: str
    source: str
    text: str
    score: float
    page: Optional[int] = None
    clause_id: Optional[str] = None
    document_id: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# Retriever
# ─────────────────────────────────────────────────────────────────────────────

class Retriever:
    """
    Central retrieval service — imported as a singleton everywhere.

    Architecture
    ────────────
    retrieve()
      │
      ├─ _dense_search()   ← Qdrant cosine similarity (always runs)
      │
      └─ _bm25_search()    ← Postgres full-text BM25   (Step 6, use_hybrid=True)
           │
           └─ _reciprocal_rank_fusion()
    """

    # ── Public API ─────────────────────────────────────────────────────────

    def retrieve(
        self,
        query: str,
        workspace_id: str,
        top_k: int = 5,
        use_hybrid: bool = False,   # Step 6 feature flag
    ) -> List[ChunkResult]:
        """
        Return the top-k most relevant chunks for *query* in *workspace_id*.

        Parameters
        ──────────
        query        : natural-language question or keyword string
        workspace_id : tenant boundary — passed through to Qdrant filter
        top_k        : maximum number of chunks returned
        use_hybrid   : reserved for Step 6; ignored until BM25 is wired in
        """
        # Step 1: embed the query
        query_embedding = self._embed(query)
        if query_embedding is None:
            return []

        # Step 2: dense vector search (always active)
        dense_results = self._dense_search(workspace_id, query_embedding, top_k)

        # Hybrid: BM25 keyword search + Reciprocal Rank Fusion.
        # Activated only when the caller explicitly sets use_hybrid=True.
        # Defaults to False so all existing callers are completely unaffected.
        if use_hybrid:
            bm25_results = self._bm25_search(query, workspace_id, top_k)
            return self._reciprocal_rank_fusion(dense_results, bm25_results, top_k)

        return dense_results

    # ── Private helpers ────────────────────────────────────────────────────

    def _embed(self, text: str) -> Optional[List[float]]:
        """Call the LLM provider's embedding API.  Returns None on failure."""
        try:
            # Lazy import avoids circular dependency at module load time.
            from app.services.llm_provider import llm_provider
            return llm_provider.generate_embeddings([text])[0]
        except Exception as exc:
            logger.error("Embedding generation failed: %s", exc, exc_info=True)
            return None

    def _dense_search(
        self,
        workspace_id: str,
        query_embedding: List[float],
        limit: int,
    ) -> List[ChunkResult]:
        """Run a cosine-similarity search against the Qdrant collection."""
        try:
            from app.services.qdrant_service import qdrant_service
            hits = qdrant_service.search(
                workspace_id=workspace_id,
                query_embedding=query_embedding,
                limit=limit,
            )
        except Exception as exc:
            logger.error("Qdrant search failed: %s", exc, exc_info=True)
            return []

        results: List[ChunkResult] = []
        for hit in hits:
            payload = hit.payload or {}
            results.append(
                ChunkResult(
                    chunk_id=str(hit.id),
                    source=payload.get("source_file", "Unknown"),
                    # Prefer the canonical field; fall back to "content" so that
                    # chunks written before this step still return text correctly.
                    text=payload.get("original_text") or payload.get("content", ""),
                    score=float(hit.score),
                    page=payload.get("page_number"),    # set by Step 3 ingestion
                    clause_id=payload.get("clause_id"), # set by Step 3 ingestion
                    document_id=payload.get("document_id"),
                )
            )
        return results

    # ── Hybrid Search (Step 6) ────────────────────────────────────────────

    def _bm25_search(
        self,
        query: str,
        workspace_id: str,
        limit: int,
    ) -> List[ChunkResult]:
        """
        BM25 keyword search over all chunks indexed for *workspace_id*.

        Implementation
        ──────────────
        Scrolls the Qdrant collection (workspace-filtered, no vectors needed),
        builds a BM25Okapi corpus in-process from the stored `original_text`
        payloads, and ranks the query against it.  This avoids requiring a
        separate Postgres tsvector column or Elasticsearch instance.

        Trade-off: loads all workspace chunks into memory per request.
        Acceptable at hackathon scale; a production system should maintain a
        dedicated inverted index (e.g. Postgres GIN tsvector column).

        Requires: rank_bm25>=0.2.2 (already in requirements.txt)
        """
        from qdrant_client.models import Filter, FieldCondition, MatchValue

        try:
            from rank_bm25 import BM25Okapi
        except ImportError:
            logger.error(
                "rank_bm25 is not installed — add it to requirements.txt "
                "and rebuild the Docker image."
            )
            return []

        # 1. Scroll ALL workspace chunks from Qdrant (no vector payload needed).
        try:
            from app.services.qdrant_service import qdrant_service
            workspace_filter = Filter(
                must=[FieldCondition(
                    key="workspace_id",
                    match=MatchValue(value=workspace_id),
                )]
            )
            all_records = []
            offset = None
            while True:
                batch, offset = qdrant_service.client.scroll(
                    collection_name=qdrant_service.collection_name,
                    scroll_filter=workspace_filter,
                    limit=200,          # page size; increase for very large collections
                    offset=offset,
                    with_payload=True,
                    with_vectors=False, # no need to load 768-dim vectors
                )
                all_records.extend(batch)
                if offset is None:      # Qdrant signals end-of-results with None
                    break
        except Exception as exc:
            logger.error("Qdrant scroll for BM25 corpus failed: %s", exc, exc_info=True)
            return []

        if not all_records:
            return []

        # 2. Build BM25 corpus and score query.
        texts = [
            (r.payload or {}).get("original_text") or (r.payload or {}).get("content", "")
            for r in all_records
        ]
        tokenized_corpus = [t.lower().split() for t in texts]
        bm25 = BM25Okapi(tokenized_corpus)
        scores = bm25.get_scores(query.lower().split())   # returns numpy array

        # 3. Sort by score descending; filter out docs with score == 0
        #    (BM25 returns 0 when no query token appears in a document).
        ranked_indices = sorted(
            range(len(scores)), key=lambda i: scores[i], reverse=True
        )

        results: List[ChunkResult] = []
        for idx in ranked_indices[:limit]:
            if scores[idx] <= 0:
                break   # remaining indices all have score 0 — stop early
            payload = all_records[idx].payload or {}
            results.append(
                ChunkResult(
                    chunk_id=str(all_records[idx].id),
                    source=payload.get("source_file", "Unknown"),
                    text=payload.get("original_text") or payload.get("content", ""),
                    score=float(scores[idx]),
                    page=payload.get("page_number"),
                    clause_id=payload.get("clause_id"),
                    document_id=payload.get("document_id"),
                )
            )
        return results

    @staticmethod
    def _reciprocal_rank_fusion(
        dense: List[ChunkResult],
        bm25: List[ChunkResult],
        top_k: int,
        k: int = 60,
    ) -> List[ChunkResult]:
        """
        Merge two ranked lists using Reciprocal Rank Fusion.

        Formula
        ───────
            RRF_score(d) = Σ_i  1 / (k + rank_i(d))

        where:
          • rank_i(d) is the 1-based position of chunk d in list i
          • k = 60 is the standard smoothing constant (Cormack et al., 2009)

        Chunks that appear in both lists receive the sum of both contributions.
        Chunks absent from one list receive no penalty — they simply miss
        that list's contribution.

        The output ChunkResult.score is the RRF score, replacing the original
        cosine-similarity or BM25 score.  This is correct because the RRF
        score is the actual relevance signal when sources are fused, and it
        propagates all the way to Citation.score in the response.
        """
        # chunk_id → (accumulated_rrf_score, ChunkResult)
        rrf_map: dict = {}

        for rank, chunk in enumerate(dense, start=1):
            contrib = 1.0 / (k + rank)
            if chunk.chunk_id in rrf_map:
                prev_score, prev_chunk = rrf_map[chunk.chunk_id]
                rrf_map[chunk.chunk_id] = (prev_score + contrib, prev_chunk)
            else:
                rrf_map[chunk.chunk_id] = (contrib, chunk)

        for rank, chunk in enumerate(bm25, start=1):
            contrib = 1.0 / (k + rank)
            if chunk.chunk_id in rrf_map:
                prev_score, prev_chunk = rrf_map[chunk.chunk_id]
                rrf_map[chunk.chunk_id] = (prev_score + contrib, prev_chunk)
            else:
                rrf_map[chunk.chunk_id] = (contrib, chunk)

        # Sort by RRF score descending, take top-k.
        ranked = sorted(rrf_map.values(), key=lambda x: x[0], reverse=True)[:top_k]

        if not ranked:
            return []

        # Normalize RRF scores between 0.0 and 1.0 for standardized downstream consumption
        max_possible_score = (1.0 / k) + (1.0 / (k + 1))  # Highest possible sum if item is rank 1 in both lists
        min_possible_score = 1.0 / (k + top_k)           # Single low contribution

        score_range = max_possible_score - min_possible_score if max_possible_score > min_possible_score else 1.0

        return [
            ChunkResult(
                chunk_id=chunk.chunk_id,
                source=chunk.source,
                text=chunk.text,
                score=round(min(1.0, max(0.0, (rrf_score - min_possible_score) / score_range)), 4),
                page=chunk.page,
                clause_id=chunk.clause_id,
                document_id=chunk.document_id,
            )
            for rrf_score, chunk in ranked
        ]


# Module-level singleton
retriever = Retriever()

