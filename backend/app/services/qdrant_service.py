import uuid
import logging
import requests
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct, Filter, FieldCondition, MatchValue
from app.core.config import settings

logger = logging.getLogger(__name__)


class QdrantHit:
    """Lightweight result object matching qdrant_client's hit interface."""
    def __init__(self, d: dict):
        self.id = d.get("id")
        self.payload = d.get("payload", {})
        self.score = d.get("score", 0.0)

class QdrantService:
    def __init__(self, embedding_dim: int = None):
        self.client = QdrantClient(host=settings.QDRANT_HOST, port=settings.QDRANT_PORT, check_compatibility=False)
        self.collection_name = "jarvis_memory"
        # Lock embedding dimension at startup to prevent runtime mismatches.
        # Once the collection is created, the dimension is fixed.
        if embedding_dim is None:
            from app.core.config import settings as cfg
            # If Gemini key is set, use Gemini (768). Otherwise NVIDIA (1024).
            # This is locked at startup — if Gemini fails at runtime and NVIDIA
            # fallback kicks in, the dimension mismatch will be caught at insert time.
            if cfg.GEMINI_API_KEY:
                self.embedding_dim = 768   # Gemini embedding-2 is 768 dims
            else:
                self.embedding_dim = 1024  # NVIDIA nv-embedqa-e5-v5 is 1024 dims
        else:
            self.embedding_dim = embedding_dim
        self._ensure_collection()

    def _ensure_collection(self):
        import logging
        logger = logging.getLogger(__name__)
        try:
            try:
                existing = self.client.get_collection(self.collection_name)
                existing_dim = existing.config.params.vectors.size
                # Only check dimension if it's a real integer (not a mock object)
                if isinstance(existing_dim, int) and existing_dim != self.embedding_dim:
                    raise RuntimeError(
                        f"Qdrant collection dimension mismatch: "
                        f"collection has dim={existing_dim} but expected dim={self.embedding_dim}. "
                        f"Recreate the collection or set the correct embedding provider."
                    )
            except RuntimeError:
                raise  # re-raise dimension mismatch errors
            except Exception:
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(size=self.embedding_dim, distance=Distance.COSINE),
                )
        except RuntimeError:
            raise  # let dimension mismatch propagate as a hard error
        except Exception as e:
            logger.warning(f"Failed to connect to Qdrant or create collection (Qdrant might be offline): {e}")

    def insert_chunks(
        self,
        workspace_id: str,
        document_id: str,
        source_file: str,
        chunks: list[str],
        embeddings: list[list[float]],
        page_numbers: list = None,   # one entry per chunk; None for non-PDF
        clause_ids: list = None,     # one entry per chunk; None if not found
    ):
        """
        Upsert text chunks with their vector embeddings and provenance metadata.

        Backward compatibility
        ─────────────────────
        page_numbers and clause_ids are optional.  Callers that only pass the
        original five positional arguments (e.g. batch_processor.py) continue
        to work unchanged — those chunks will have page_number=None and
        clause_id=None in the Qdrant payload.

        Payload schema (per chunk)
        ──────────────────────────
        chunk_id      : Qdrant point UUID  (the PointStruct.id itself)
        workspace_id  : tenant scope
        document_id   : Postgres Document.id
        source_file   : original filename
        chunk_index   : 0-based position within the document
        original_text : canonical chunk text field
        content       : alias of original_text (backward compat for old Qdrant data)
        page_number   : 1-based PDF page number or None
        clause_id     : e.g. "Section 3.4" or None
        evidence_type : always "source_document"
        priority      : always 1
        """
        points = []
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            point_id = str(uuid.uuid4())
            points.append(
                PointStruct(
                    id=point_id,
                    vector=embedding,
                    payload={
                        "chunk_id": point_id,

                        "workspace_id": workspace_id,
                        "document_id": document_id,
                        "source_file": source_file,
                        "chunk_index": i,
                        "original_text": chunk,
                        "content": chunk,           # backward-compat alias
                        "page_number": page_numbers[i] if page_numbers else None,
                        "clause_id": clause_ids[i] if clause_ids else None,
                        "evidence_type": "source_document",
                        "priority": 1,

                    }
                )
            )
        self.client.upsert(
            collection_name=self.collection_name,
            points=points
        )

    def search(self, workspace_id: str, query_embedding: list[float], limit: int = 5):
        """
        Vector similarity search filtered by workspace.

        Uses the Qdrant REST API /points/search endpoint directly
        for maximum compatibility across Qdrant server versions.
        """
        url = f"http://{settings.QDRANT_HOST}:{settings.QDRANT_PORT}/collections/{self.collection_name}/points/search"
        payload = {
            "vector": query_embedding,
            "limit": limit,
            "filter": {
                "must": [
                    {"key": "workspace_id", "match": {"value": workspace_id}}
                ]
            },
            "with_payload": True
        }
        try:
            resp = requests.post(url, json=payload, timeout=10)
        except requests.RequestException as e:
            logger.error(f"Qdrant search network error: {e}")
            return []
        if resp.status_code != 200:
            logger.error(f"Qdrant search returned {resp.status_code}: {resp.text[:200]}")
            return []
        try:
            data = resp.json().get("result", [])
        except ValueError:
            logger.error(f"Qdrant search returned invalid JSON")
            return []
        return [QdrantHit(d) for d in data]

qdrant_service = QdrantService()
