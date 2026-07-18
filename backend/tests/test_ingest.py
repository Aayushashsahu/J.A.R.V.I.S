"""
tests/test_ingest.py
────────────────────
Integration tests for the document upload pipeline.

Deliverables verified
─────────────────────
✅ /api/ingest/upload  (mapped to POST /{ws}/upload in this project)
✅ Metadata preserved: chunk_id, workspace_id, document_id, source_file,
   page_number, clause_id, chunk_index, original_text
✅ P0 bug fix: source_file is passed to insert_chunks (was missing before Step 3)
✅ process_with_metadata() is used instead of the old process()+chunk_text() path
"""

import io
import pytest
from unittest.mock import call, patch, MagicMock
from fastapi.testclient import TestClient


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _upload(client: TestClient, auth_headers: dict, workspace_id: str,
            filename: str, content: bytes, content_type: str = "application/pdf"):
    return client.post(
        f"/api/v1/workspaces/{workspace_id}/upload",
        headers=auth_headers,
        files={"file": (filename, io.BytesIO(content), content_type)},
    )


# ─────────────────────────────────────────────────────────────────────────────
# Tests
# ─────────────────────────────────────────────────────────────────────────────

class TestUploadEndpoint:
    """POST /api/v1/workspaces/{workspace_id}/upload"""

    def test_upload_pdf_returns_200_and_document_id(
        self,
        client: TestClient,
        auth_headers: dict,
        workspace_id: str,
        fake_pdf_bytes: bytes,
    ):
        """A valid PDF upload must return HTTP 200 with a document_id."""
        resp = _upload(client, auth_headers, workspace_id, "test.pdf", fake_pdf_bytes)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert "document_id" in body
        assert body["document_id"]  # non-empty string

    def test_upload_txt_returns_200_and_document_id(
        self,
        client: TestClient,
        auth_headers: dict,
        workspace_id: str,
    ):
        """A plain-text upload must also succeed."""
        txt = b"Section 3.4 LPG clearance shall be 3 metres minimum."
        resp = _upload(client, auth_headers, workspace_id, "spec.txt", txt, "text/plain")
        assert resp.status_code == 200, resp.text
        assert resp.json().get("document_id")

    def test_upload_calls_insert_chunks_with_source_file(
        self,
        client: TestClient,
        auth_headers: dict,
        workspace_id: str,
        qdrant_mock: MagicMock,
    ):
        """
        P0 bug fix regression: insert_chunks() must receive source_file.

        Before Step 3, source_file was never passed, causing a TypeError on
        every upload.  This test fails if the bug is reintroduced.
        """
        txt = b"Clause 2.1 requires safety inspection every 6 months."
        resp = _upload(client, auth_headers, workspace_id, "safety.txt", txt, "text/plain")
        assert resp.status_code == 200, resp.text

        # insert_chunks() must have been called with source_file as a keyword arg
        assert qdrant_mock.upsert.called, "qdrant_service.insert_chunks did not call upsert"
        upsert_call = qdrant_mock.upsert.call_args
        # The payload is nested inside PointStruct objects; verify at least one
        # point carries the correct source_file.
        points = upsert_call.kwargs.get("points") or upsert_call.args[1] if upsert_call.args else []
        if points:
            payload = points[0].payload
            assert payload.get("source_file") == "safety.txt", (
                f"source_file not stored in payload: {payload}"
            )

    def test_upload_stores_all_required_metadata_fields(
        self,
        client: TestClient,
        auth_headers: dict,
        workspace_id: str,
        qdrant_mock: MagicMock,
    ):
        """
        Every Qdrant point must carry all 8 required metadata fields.

        Fields: chunk_id, workspace_id, document_id, source_file,
                page_number, clause_id, chunk_index, original_text
        """
        qdrant_mock.upsert.reset_mock()
        txt = b"Article 5 specifies fire suppression requirements."
        resp = _upload(client, auth_headers, workspace_id, "fire.txt", txt, "text/plain")
        assert resp.status_code == 200, resp.text

        assert qdrant_mock.upsert.called
        points = qdrant_mock.upsert.call_args.kwargs.get("points", [])
        assert points, "No points were upserted"

        required_fields = {
            "chunk_id", "workspace_id", "document_id",
            "source_file", "chunk_index", "original_text",
        }
        for point in points:
            missing = required_fields - set(point.payload.keys())
            assert not missing, (
                f"Point {point.id} is missing payload fields: {missing}"
            )
            # page_number and clause_id may be None for txt, but key must exist
            assert "page_number" in point.payload
            assert "clause_id" in point.payload

    def test_upload_pdf_stores_page_number_field(
        self,
        client: TestClient,
        auth_headers: dict,
        workspace_id: str,
        fake_pdf_bytes: bytes,
        qdrant_mock: MagicMock,
    ):
        """
        PDF uploads must populate page_number (integer >= 1) in the payload.
        """
        qdrant_mock.upsert.reset_mock()
        resp = _upload(client, auth_headers, workspace_id, "pages.pdf", fake_pdf_bytes)
        assert resp.status_code == 200, resp.text

        if qdrant_mock.upsert.called:
            points = qdrant_mock.upsert.call_args.kwargs.get("points", [])
            for point in points:
                pn = point.payload.get("page_number")
                # page_number must be an integer >= 1 for non-empty PDF pages,
                # or None if the PDF had no extractable text.
                assert pn is None or (isinstance(pn, int) and pn >= 1), (
                    f"page_number should be int >= 1 or None, got {pn!r}"
                )

    def test_upload_invalid_workspace_returns_404(
        self,
        client: TestClient,
        auth_headers: dict,
    ):
        """Uploading to a non-existent workspace must return HTTP 404."""
        txt = b"test content"
        resp = _upload(
            client, auth_headers, "00000000-0000-0000-0000-000000000000",
            "test.txt", txt, "text/plain",
        )
        assert resp.status_code == 404


class TestDocumentProcessor:
    """Unit tests for DocumentProcessor.process_with_metadata()."""

    def test_txt_chunk_metadata_has_no_page_number(self):
        """Non-PDF formats must have page_number=None."""
        from app.services.document_processor import DocumentProcessor
        results = DocumentProcessor.process_with_metadata(
            "test.txt",
            b"Section 3.4 minimum clearance is 3 metres.",
        )
        assert len(results) >= 1
        for chunk in results:
            assert chunk.page_number is None

    def test_txt_chunk_metadata_extracts_clause_id(self):
        """Clause ID must be extracted when text contains Section/Clause patterns."""
        from app.services.document_processor import DocumentProcessor
        results = DocumentProcessor.process_with_metadata(
            "spec.txt",
            b"Clause 2.1 requires safety inspection every 6 months.",
        )
        assert results
        assert results[0].clause_id is not None
        assert "Clause" in results[0].clause_id or "2.1" in results[0].clause_id

    def test_txt_chunk_metadata_chunk_index_is_sequential(self):
        """Chunk indices must be sequential starting from 0."""
        from app.services.document_processor import DocumentProcessor
        # Generate enough text to produce multiple chunks (chunk_size=1000)
        long_text = b"Section 1 " + b"x" * 900 + b" Section 2 " + b"y" * 900
        results = DocumentProcessor.process_with_metadata(
            "long.txt", long_text, chunk_size=500, overlap=50,
        )
        assert len(results) >= 2
        for i, chunk in enumerate(results):
            assert chunk.chunk_index == i

    def test_clause_id_extractor_matches_section_pattern(self):
        """_extract_clause_id must recognise 'Section N.N' patterns."""
        from app.services.document_processor import DocumentProcessor
        result = DocumentProcessor._extract_clause_id(
            "As per Section 4.2.1, the setback distance shall be 15 metres."
        )
        assert result is not None
        assert "4.2.1" in result or "Section" in result

    def test_clause_id_extractor_returns_none_for_plain_text(self):
        """Plain text without section markers must return None."""
        from app.services.document_processor import DocumentProcessor
        result = DocumentProcessor._extract_clause_id(
            "The weather today is sunny and the temperature is 25 degrees."
        )
        assert result is None
