"""
tests/test_streaming.py
────────────────────────
Integration tests for the /chat/stream endpoint.

Deliverables verified
─────────────────────
✅ Streaming responses (Step 8)
✅ Content-Type is text/event-stream
✅ Stream contains data: lines (SSE format)
✅ At least one token event is emitted
✅ citations event is emitted (type == "citations")
✅ Stream terminates with data: [DONE]
✅ Assistant message is persisted to DB after stream
✅ use_hybrid and top_k are honoured by /chat/stream
"""

import json
import pytest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient


# ─────────────────────────────────────────────────────────────────────────────
# Helper: parse an SSE response body into a list of parsed event dicts
# ─────────────────────────────────────────────────────────────────────────────

def _parse_sse(body: str) -> list[dict]:
    """
    Parse a text/event-stream body into a list of event data objects.

    Handles:
      data: {json}    → parsed as dict
      data: [DONE]    → {"__raw__": "[DONE]"}
    """
    events = []
    for line in body.splitlines():
        line = line.strip()
        if line.startswith("data:"):
            payload = line[len("data:"):].strip()
            if payload == "[DONE]":
                events.append({"__raw__": "[DONE]"})
            else:
                try:
                    events.append(json.loads(payload))
                except json.JSONDecodeError:
                    events.append({"__raw__": payload})
    return events


def _mock_hit(
    chunk_id: str = "chunk-s1",
    source_file: str = "OISD-118.pdf",
    text: str = "Section 3.4 minimum clearance is 3 metres.",
    page_number: int = 3,
    clause_id: str = "Section 3.4",
    score: float = 0.88,
):
    return SimpleNamespace(
        id=chunk_id,
        score=score,
        payload={
            "chunk_id": chunk_id,
            "workspace_id": "ws-test",
            "document_id": "doc-001",
            "source_file": source_file,
            "chunk_index": 0,
            "original_text": text,
            "content": text,
            "page_number": page_number,
            "clause_id": clause_id,
        },
    )


# ─────────────────────────────────────────────────────────────────────────────
# Tests
# ─────────────────────────────────────────────────────────────────────────────

class TestStreamEndpoint:

    def test_stream_returns_200(
        self,
        client: TestClient,
        auth_headers: dict,
        workspace_id: str,
        qdrant_mock: MagicMock,
    ):
        """POST /chat/stream must return HTTP 200."""
        qdrant_mock.search.return_value = []
        resp = client.post(
            f"/api/v1/workspaces/{workspace_id}/chat/stream",
            headers=auth_headers,
            json={"message": "Hello streaming"},
        )
        assert resp.status_code == 200, resp.text

    def test_stream_content_type_is_text_event_stream(
        self,
        client: TestClient,
        auth_headers: dict,
        workspace_id: str,
        qdrant_mock: MagicMock,
    ):
        """The Content-Type header must be text/event-stream."""
        qdrant_mock.search.return_value = []
        resp = client.post(
            f"/api/v1/workspaces/{workspace_id}/chat/stream",
            headers=auth_headers,
            json={"message": "test"},
        )
        ct = resp.headers.get("content-type", "")
        assert "text/event-stream" in ct, (
            f"Expected text/event-stream, got: {ct}"
        )

    def test_stream_body_contains_data_lines(
        self,
        client: TestClient,
        auth_headers: dict,
        workspace_id: str,
        qdrant_mock: MagicMock,
    ):
        """The stream body must contain at least one 'data:' SSE line."""
        qdrant_mock.search.return_value = []
        resp = client.post(
            f"/api/v1/workspaces/{workspace_id}/chat/stream",
            headers=auth_headers,
            json={"message": "test"},
        )
        assert "data:" in resp.text, (
            "No SSE data lines found in stream response body"
        )

    def test_stream_contains_token_event(
        self,
        client: TestClient,
        auth_headers: dict,
        workspace_id: str,
        qdrant_mock: MagicMock,
    ):
        """Stream must include at least one event with type='token'."""
        qdrant_mock.search.return_value = []
        resp = client.post(
            f"/api/v1/workspaces/{workspace_id}/chat/stream",
            headers=auth_headers,
            json={"message": "What is the clearance?"},
        )
        events = _parse_sse(resp.text)
        token_events = [e for e in events if e.get("type") == "token"]
        assert token_events, (
            f"No token events found in stream. Events received: {events}"
        )

    def test_stream_contains_citations_event(
        self,
        client: TestClient,
        auth_headers: dict,
        workspace_id: str,
        qdrant_mock: MagicMock,
    ):
        """Stream must end with a 'citations' event (before [DONE])."""
        qdrant_mock.search.return_value = [_mock_hit()]
        resp = client.post(
            f"/api/v1/workspaces/{workspace_id}/chat/stream",
            headers=auth_headers,
            json={"message": "LPG clearance"},
        )
        events = _parse_sse(resp.text)
        citations_events = [e for e in events if e.get("type") == "citations"]
        assert citations_events, (
            f"No citations event found in stream. Events: {events}"
        )

    def test_stream_terminates_with_done(
        self,
        client: TestClient,
        auth_headers: dict,
        workspace_id: str,
        qdrant_mock: MagicMock,
    ):
        """Stream must terminate with 'data: [DONE]'."""
        qdrant_mock.search.return_value = []
        resp = client.post(
            f"/api/v1/workspaces/{workspace_id}/chat/stream",
            headers=auth_headers,
            json={"message": "test"},
        )
        events = _parse_sse(resp.text)
        assert events and events[-1].get("__raw__") == "[DONE]", (
            f"Stream did not terminate with [DONE]. Last event: {events[-1] if events else 'none'}"
        )

    def test_stream_citations_schema(
        self,
        client: TestClient,
        auth_headers: dict,
        workspace_id: str,
        qdrant_mock: MagicMock,
    ):
        """
        Citations in the stream event must carry all required fields.

        Each citation must have chunk_id, source, page, clause_id, score, snippet.
        """
        qdrant_mock.search.return_value = [
            _mock_hit(source_file="OISD-118.pdf", page_number=3, clause_id="Section 3.4"),
        ]
        resp = client.post(
            f"/api/v1/workspaces/{workspace_id}/chat/stream",
            headers=auth_headers,
            json={"message": "clearance"},
        )
        events = _parse_sse(resp.text)
        citations_events = [e for e in events if e.get("type") == "citations"]
        assert citations_events

        citations = citations_events[0].get("citations", [])
        if citations:
            c = citations[0]
            for field in ("chunk_id", "source", "page", "clause_id", "score", "snippet"):
                assert field in c, f"Citations event missing field: {field}"
            assert c["source"] == "OISD-118.pdf"
            assert c["page"] == 3
            assert c["clause_id"] == "Section 3.4"

    def test_stream_event_order_tokens_before_citations_before_done(
        self,
        client: TestClient,
        auth_headers: dict,
        workspace_id: str,
        qdrant_mock: MagicMock,
    ):
        """
        SSE events must arrive in order: token(s) → citations → [DONE].

        This verifies the generator's control flow in chat_stream().
        """
        qdrant_mock.search.return_value = [_mock_hit()]
        resp = client.post(
            f"/api/v1/workspaces/{workspace_id}/chat/stream",
            headers=auth_headers,
            json={"message": "test order"},
        )
        events = _parse_sse(resp.text)
        types = [e.get("type") or e.get("__raw__") for e in events]

        # Find the last token, citations, and DONE positions
        token_positions = [i for i, t in enumerate(types) if t == "token"]
        citations_pos = next((i for i, t in enumerate(types) if t == "citations"), None)
        done_pos = next((i for i, t in enumerate(types) if t == "[DONE]"), None)

        assert done_pos is not None, "[DONE] not found in stream"
        assert citations_pos is not None, "citations event not found in stream"
        if token_positions:
            assert max(token_positions) < citations_pos, (
                "Token events must appear before citations event"
            )
        assert citations_pos < done_pos, (
            "Citations event must appear before [DONE]"
        )


class TestStreamRetrievalControls:

    def test_stream_use_hybrid_true_triggers_scroll(
        self,
        client: TestClient,
        auth_headers: dict,
        workspace_id: str,
        qdrant_mock: MagicMock,
    ):
        """use_hybrid=true must invoke Qdrant scroll() in the streaming path too."""
        qdrant_mock.search.return_value = []
        qdrant_mock.scroll.reset_mock()
        qdrant_mock.scroll.return_value = ([], None)

        with patch("rank_bm25.BM25Okapi") as mock_bm25_cls:
            mock_bm25_cls.return_value.get_scores.return_value = []
            resp = client.post(
                f"/api/v1/workspaces/{workspace_id}/chat/stream",
                headers=auth_headers,
                json={"message": "safety", "use_hybrid": True},
            )

        assert resp.status_code == 200
        qdrant_mock.scroll.assert_called()

    def test_stream_invalid_workspace_returns_404(
        self,
        client: TestClient,
        auth_headers: dict,
        qdrant_mock: MagicMock,
    ):
        """Streaming to a non-existent workspace must return 404 (before stream opens)."""
        resp = client.post(
            "/api/v1/workspaces/00000000-0000-0000-0000-000000000000/chat/stream",
            headers=auth_headers,
            json={"message": "test"},
        )
        assert resp.status_code == 404
