"""
tests/conftest.py
─────────────────
Shared fixtures and global mocks for the J.A.R.V.I.S. integration test suite.

Strategy
────────
1. The QdrantService and GeminiProvider singletons are created at module-import
   time. We must patch their underlying client constructors BEFORE importing any
   app module so that no real network connection is attempted.

2. The FastAPI lifespan starts a file-watcher and two async background tasks.
   We patch those entry points so TestClient starts cleanly without a running
   filesystem watcher or Postgres queue.

3. A SQLite in-process database replaces Postgres for all tests. The schema is
   created fresh at session start and torn down afterwards.

4. Every test that touches the database uses the `client` fixture, which
   injects an override for FastAPI's get_db dependency.
"""

import io
import pytest
from types import SimpleNamespace
from typing import Generator
from unittest.mock import AsyncMock, MagicMock, patch

# ─────────────────────────────────────────────────────────────────────────────
# Step 1: patch singletons BEFORE any app import
# ─────────────────────────────────────────────────────────────────────────────

# --- Qdrant mock ---
_qdrant_client_mock = MagicMock()
_qdrant_client_mock.get_collection.return_value = MagicMock()
_qdrant_client_mock.upsert.return_value = MagicMock()
_qdrant_client_mock.search.return_value = []
_qdrant_client_mock.query_points.return_value = MagicMock(points=[])
_qdrant_client_mock.scroll.return_value = ([], None)

_patch_qdrant = patch(
    "qdrant_client.QdrantClient",
    return_value=_qdrant_client_mock,
)
_patch_qdrant.start()

# --- Gemini / google-genai mock ---
_gemini_mock = MagicMock()
_embed_result = MagicMock()
_embed_result.embeddings = [MagicMock(values=[0.01] * 768)]
_gemini_mock.models.embed_content.return_value = _embed_result
_gemini_mock.models.generate_content.return_value = MagicMock(
    text="[MOCK RESPONSE] Minimum LPG clearance is 3 metres per Section 3.4."
)
def _mock_stream(*args, **kwargs):
    return iter([
        SimpleNamespace(text="[MOCK STREAM] "),
        SimpleNamespace(text="Minimum clearance is 3 metres."),
    ])
_gemini_mock.models.generate_content_stream.side_effect = _mock_stream

_patch_gemini = patch(
    "google.genai.Client",
    return_value=_gemini_mock,
)
_patch_gemini.start()

# --- NVIDIA client mock (prevents real HTTP calls to NVIDIA API) ---
_nvidia_client_mock = MagicMock()
_nvidia_embed_result = MagicMock()
_nvidia_embed_result.data = [MagicMock(index=0, embedding=[0.01] * 1024)]
_nvidia_client_mock.embeddings.create.return_value = _nvidia_embed_result
_nvidia_client_mock.chat.completions.create.return_value = MagicMock(
    choices=[MagicMock(message=MagicMock(content="[MOCK NVIDIA RESPONSE]"))]
)

_patch_nvidia_client = patch(
    "openai.OpenAI",
    return_value=_nvidia_client_mock,
)
_patch_nvidia_client.start()

# --- GBrain MCP client mock (prevents real HTTP calls) ---
_patch_gbrain = patch(
    "app.services.mcp_client.gbrain_client.search",
    new=AsyncMock(return_value=""),
)
_patch_gbrain.start()

# --- File-watcher + background task patches (prevent lifespan errors) ---
_patch_watcher = patch("app.main.start_watcher", return_value=None)
_patch_watcher.start()

async def _noop_coroutine():  # noqa: D401
    return None

_patch_batch = patch("app.main.run_batch_processor", return_value=_noop_coroutine())
_patch_batch.start()

_patch_reflect = patch("app.main.run_reflection_engine", return_value=_noop_coroutine())
_patch_reflect.start()

# ─────────────────────────────────────────────────────────────────────────────
# Step 2: safe to import app modules now
# ─────────────────────────────────────────────────────────────────────────────
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.db.session import Base  # noqa: E402
from app.api.deps import get_db  # noqa: E402
from app.services.qdrant_service import qdrant_service  # noqa: E402

# ─────────────────────────────────────────────────────────────────────────────
# Step 3: in-memory SQLite replaces Postgres for tests
# ─────────────────────────────────────────────────────────────────────────────
from sqlalchemy.pool import StaticPool
SQLITE_TEST_URL = "sqlite:///:memory:"
_test_engine = create_engine(
    SQLITE_TEST_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=_test_engine)
Base.metadata.create_all(bind=_test_engine)


def _override_get_db():
    db = _TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_get_db

# ─────────────────────────────────────────────────────────────────────────────
# Shared fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def client() -> TestClient:
    """
    Session-scoped FastAPI TestClient.

    Using scope="session" means the app is only started once across all tests,
    which is faster and mirrors how the server runs in production.
    """
    with TestClient(app) as c:
        return c


@pytest.fixture(scope="session")
def auth_headers(client: TestClient) -> dict:
    """
    Register a test user and return Bearer auth headers.

    Idempotent: if the user already exists (from a previous test run that
    did not clean up), the login step still succeeds.
    """
    email = "rag_test@example.com"
    password = "ragtest1234"

    # Register
    reg_resp = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password},
    )
    print("DEBUG REGISTER:", reg_resp.status_code, reg_resp.text)

    # Login
    resp = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
    )
    print("DEBUG LOGIN:", resp.status_code, resp.text)
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def workspace_id(client: TestClient, auth_headers: dict) -> str:
    """
    Return the ID of the first workspace belonging to the test user.

    The register step in auth_headers already creates four default workspaces
    (Personal, College, Internship, Octiq AI), so we just fetch the first one.
    """
    resp = client.get("/api/v1/workspaces/", headers=auth_headers)
    assert resp.status_code == 200
    workspaces = resp.json()
    assert workspaces, "Expected at least one workspace after registration"
    return workspaces[0]["id"]


@pytest.fixture()
def fake_pdf_bytes() -> bytes:
    """
    Minimal valid PDF bytes for upload tests.

    We use PyPDF2 to create a one-page PDF in memory so the document
    processor's parse_pdf() / _parse_pdf_pages() functions exercise real
    code paths rather than being bypassed.
    """
    try:
        from PyPDF2 import PdfWriter
        writer = PdfWriter()
        writer.add_blank_page(width=612, height=792)
        buf = io.BytesIO()
        writer.write(buf)
        return buf.getvalue()
    except Exception:
        # Absolute fallback: a minimal hand-crafted PDF stub
        return (
            b"%PDF-1.4\n"
            b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
            b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
            b"3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\n"
            b"xref\n0 4\n0000000000 65535 f\n"
            b"0000000009 00000 n\n0000000058 00000 n\n"
            b"0000000115 00000 n\n"
            b"trailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF"
        )


# Expose the Qdrant client mock so individual tests can configure return values
@pytest.fixture()
def qdrant_mock() -> MagicMock:
    """The underlying mock QdrantClient used by the service singleton."""
    return _qdrant_client_mock
