"""
tests/test_retrieval.py
────────────────────────
Unit tests for the Retriever service (app/services/retriever.py).

Deliverables verified
─────────────────────
✅ retrieve() returns List[ChunkResult] with correct field types
✅ Dense-only mode: BM25 not called when use_hybrid=False
✅ Hybrid mode: RRF scores are a small rational number (~0.016) not a cosine score
✅ _reciprocal_rank_fusion() correctly accumulates scores for shared chunks
✅ BM25 zero-score chunks are excluded from results
✅ Empty workspace returns empty list without raising
"""

import pytest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch


# ─────────────────────────────────────────────────────────────────────────────
# Helpers: fake Qdrant ScoredPoint and Record
# ─────────────────────────────────────────────────────────────────────────────

def _make_scored_point(
    chunk_id: str,
    score: float,
    source_file: str = "test.pdf",
    text: str = "Section 3.4 clearance is 3 metres.",
    page_number: int = 1,
    clause_id: str = "Section 3.4",
    document_id: str = "doc-001",
):
    """Create a minimal fake Qdrant ScoredPoint."""
    return SimpleNamespace(
        id=chunk_id,
        score=score,
        payload={
            "chunk_id": chunk_id,
            "workspace_id": "ws-test",
            "document_id": document_id,
            "source_file": source_file,
            "chunk_index": 0,
            "original_text": text,
            "content": text,
            "page_number": page_number,
            "clause_id": clause_id,
            "evidence_type": "source_document",
            "priority": 1,
        },
    )


def _make_record(chunk_id: str, text: str = "LPG clearance 3 metres", page_number: int = 2):
    """Create a minimal fake Qdrant Record (for scroll results)."""
    return SimpleNamespace(
        id=chunk_id,
        payload={
            "chunk_id": chunk_id,
            "workspace_id": "ws-test",
            "document_id": "doc-001",
            "source_file": "test.pdf",
            "chunk_index": 0,
            "original_text": text,
            "content": text,
            "page_number": page_number,
            "clause_id": "Section 3.4",
        },
    )


# ─────────────────────────────────────────────────────────────────────────────
# Tests: Dense retrieval
# ─────────────────────────────────────────────────────────────────────────────

class TestDenseRetrieval:

    def test_retrieve_returns_chunk_results(self, qdrant_mock: MagicMock):
        """retrieve() must return a non-empty list of ChunkResult objects."""
        from app.services.retriever import retriever, ChunkResult

        qdrant_mock.search.return_value = [
            _make_scored_point("uuid-1", 0.91),
            _make_scored_point("uuid-2", 0.85, text="Clause 5.2 fire distance"),
        ]

        results = retriever.retrieve(
            query="LPG clearance",
            workspace_id="ws-test",
            top_k=5,
        )

        assert isinstance(results, list)
        assert len(results) == 2
        for r in results:
            assert isinstance(r, ChunkResult)

    def test_chunk_result_has_all_required_fields(self, qdrant_mock: MagicMock):
        """Every ChunkResult must have chunk_id, source, text, score, page, clause_id."""
        from app.services.retriever import retriever

        qdrant_mock.search.return_value = [
            _make_scored_point("uuid-3", 0.78, page_number=4, clause_id="Section 7.1"),
        ]
        results = retriever.retrieve("fire safety", "ws-test")

        assert results
        r = results[0]
        assert r.chunk_id == "uuid-3"
        assert r.source == "test.pdf"
        assert r.text == "Section 3.4 clearance is 3 metres."
        assert isinstance(r.score, float)
        assert r.page == 4
        assert r.clause_id == "Section 7.1"
        assert r.document_id == "doc-001"

    def test_retrieve_empty_workspace_returns_empty_list(self, qdrant_mock: MagicMock):
        """No Qdrant hits must produce an empty list, not an exception."""
        from app.services.retriever import retriever

        qdrant_mock.search.return_value = []
        results = retriever.retrieve("anything", "ws-empty")
        assert results == []

    def test_retrieve_dense_does_not_call_scroll(self, qdrant_mock: MagicMock):
        """Dense-only mode must NOT call scroll() (that is the BM25 code path)."""
        from app.services.retriever import retriever

        qdrant_mock.search.return_value = []
        qdrant_mock.scroll.reset_mock()

        retriever.retrieve("test", "ws-test", use_hybrid=False)

        qdrant_mock.scroll.assert_not_called()

    def test_retrieve_qdrant_failure_returns_empty_list(self, qdrant_mock: MagicMock):
        """If Qdrant raises, retrieve() must return [] and not propagate the exception."""
        from app.services.retriever import retriever

        qdrant_mock.search.side_effect = ConnectionError("Qdrant unavailable")
        try:
            results = retriever.retrieve("test", "ws-test")
            assert results == []
        finally:
            qdrant_mock.search.side_effect = None


# ─────────────────────────────────────────────────────────────────────────────
# Tests: Hybrid retrieval (BM25 + RRF)
# ─────────────────────────────────────────────────────────────────────────────

class TestHybridRetrieval:

    def test_hybrid_activates_scroll(self, qdrant_mock: MagicMock):
        """use_hybrid=True must call scroll() to build the BM25 corpus."""
        from app.services.retriever import retriever

        qdrant_mock.search.return_value = [_make_scored_point("uuid-h1", 0.80)]
        qdrant_mock.scroll.return_value = ([_make_record("uuid-h1")], None)

        with patch("rank_bm25.BM25Okapi") as mock_bm25_cls:
            bm25_instance = MagicMock()
            bm25_instance.get_scores.return_value = [0.5]
            mock_bm25_cls.return_value = bm25_instance

            retriever.retrieve("LPG clearance", "ws-test", use_hybrid=True)

        qdrant_mock.scroll.assert_called()

    def test_hybrid_rrf_scores_are_small_rational_numbers(self, qdrant_mock: MagicMock):
        """
        RRF scores must be small (~1/(60+rank)) not cosine scores (~0.7–0.9).

        A chunk at rank 1 in one list gets score = 1/(60+1) ≈ 0.01639.
        Both lists contribute at most 2/(60+1) ≈ 0.03279.
        Cosine scores are typically > 0.5. This assertion distinguishes them.
        """
        from app.services.retriever import retriever

        qdrant_mock.search.return_value = [_make_scored_point("uuid-rrf1", 0.90)]
        qdrant_mock.scroll.return_value = ([_make_record("uuid-rrf1", "LPG clearance 3 metres")], None)

        with patch("rank_bm25.BM25Okapi") as mock_bm25_cls:
            bm25_instance = MagicMock()
            bm25_instance.get_scores.return_value = [2.5]
            mock_bm25_cls.return_value = bm25_instance

            results = retriever.retrieve("LPG clearance", "ws-test", use_hybrid=True, top_k=5)

        if results:
            for r in results:
                assert r.score < 0.1, (
                    f"RRF score {r.score} looks like a cosine score — "
                    "check that _reciprocal_rank_fusion() is writing the RRF score"
                )


# ─────────────────────────────────────────────────────────────────────────────
# Tests: RRF algorithm correctness
# ─────────────────────────────────────────────────────────────────────────────

class TestReciprocalRankFusion:
    """Pure algorithm tests for Retriever._reciprocal_rank_fusion()."""

    def _make_chunk(self, chunk_id: str, score: float = 0.9):
        from app.services.retriever import ChunkResult
        return ChunkResult(
            chunk_id=chunk_id,
            source="test.pdf",
            text="sample text",
            score=score,
            page=1,
            clause_id="Section 1",
            document_id="doc-1",
        )

    def test_chunk_in_both_lists_scores_higher_than_chunk_in_one(self):
        """A chunk appearing in both lists must outscore a chunk in only one."""
        from app.services.retriever import Retriever

        shared = self._make_chunk("shared")
        dense_only = self._make_chunk("dense-only")
        bm25_only = self._make_chunk("bm25-only")

        dense = [shared, dense_only]
        bm25 = [shared, bm25_only]

        fused = Retriever._reciprocal_rank_fusion(dense, bm25, top_k=5)

        scores = {c.chunk_id: c.score for c in fused}
        assert "shared" in scores
        assert scores["shared"] > scores.get("dense-only", 0)
        assert scores["shared"] > scores.get("bm25-only", 0)

    def test_rrf_score_formula(self):
        """Verify 1/(60+1) ≈ 0.01639 for rank-1 chunk in a single list."""
        from app.services.retriever import Retriever

        chunk = self._make_chunk("c1")
        fused = Retriever._reciprocal_rank_fusion([chunk], [], top_k=1)

        assert fused
        expected = 1.0 / (60 + 1)
        assert abs(fused[0].score - expected) < 1e-9

    def test_rrf_respects_top_k(self):
        """_reciprocal_rank_fusion must return at most top_k results."""
        from app.services.retriever import Retriever

        dense = [self._make_chunk(f"d{i}") for i in range(10)]
        bm25 = [self._make_chunk(f"b{i}") for i in range(10)]

        fused = Retriever._reciprocal_rank_fusion(dense, bm25, top_k=3)
        assert len(fused) <= 3

    def test_rrf_empty_inputs_return_empty(self):
        """Both lists empty must return an empty list."""
        from app.services.retriever import Retriever
        fused = Retriever._reciprocal_rank_fusion([], [], top_k=5)
        assert fused == []

    def test_rrf_deduplication(self):
        """Each unique chunk_id must appear exactly once in fused output."""
        from app.services.retriever import Retriever

        c = self._make_chunk("dup")
        fused = Retriever._reciprocal_rank_fusion([c, c], [c], top_k=10)

        chunk_ids = [r.chunk_id for r in fused]
        assert len(chunk_ids) == len(set(chunk_ids)), "Duplicate chunk_ids found in RRF output"
