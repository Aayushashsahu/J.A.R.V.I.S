from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct, Filter, FieldCondition, MatchValue
from app.core.config import settings
import uuid

class QdrantService:
    def __init__(self):
        self.client = QdrantClient(host=settings.QDRANT_HOST, port=settings.QDRANT_PORT)
        self.collection_name = "jarvis_memory"
        self._ensure_collection()

    def _ensure_collection(self):
        import logging
        logger = logging.getLogger(__name__)
        try:
            try:
                self.client.get_collection(self.collection_name)
            except Exception:
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(size=768, distance=Distance.COSINE), # Gemini text-embedding-004 is 768 dims
                )
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
        search_result = self.client.search(
            collection_name=self.collection_name,
            query_vector=query_embedding,
            query_filter=Filter(
                must=[
                    FieldCondition(
                        key="workspace_id",
                        match=MatchValue(value=workspace_id)
                    )
                ]
            ),
            limit=limit
        )
        return search_result

    def delete_document_chunks(self, workspace_id: str, document_id: str):
        """Delete all chunks belonging to a specific document inside a workspace."""
        try:
            self.client.delete(
                collection_name=self.collection_name,
                points_selector=Filter(
                    must=[
                        FieldCondition(key="workspace_id", match=MatchValue(value=workspace_id)),
                        FieldCondition(key="document_id", match=MatchValue(value=document_id))
                    ]
                )
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to delete chunks for document {document_id}: {e}")

qdrant_service = QdrantService()

