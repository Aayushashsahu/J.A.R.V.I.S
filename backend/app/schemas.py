from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class Token(BaseModel):
    access_token: str
    token_type: str

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: EmailStr
    created_at: datetime
    
    class Config:
        from_attributes = True

class WorkspaceCreate(BaseModel):
    name: str

class WorkspaceResponse(BaseModel):
    id: str
    user_id: str
    name: str
    created_at: datetime

    class Config:
        from_attributes = True
# ── RAG / Citation schemas ────────────────────────────────────────────────────

class Citation(BaseModel):
    """
    Provenance record for a single retrieved chunk that contributed to a
    chat response.

    All fields are populated directly from the Qdrant payload — no extra
    database lookup is required at response time.

    Fields
    ──────
    chunk_id   : Qdrant point UUID (stable identifier for this chunk)
    source     : original filename, e.g. "OISD-118.pdf"
    page       : 1-based PDF page number; null for non-PDF sources
    clause_id  : extracted clause/section reference, e.g. "Section 3.4"; null if not found
    score      : cosine similarity score between the query and this chunk (0.0 – 1.0)
    snippet    : first 200 characters of the chunk text — enough for the
                 frontend to render a hover preview without returning the full chunk
    """

    chunk_id: str
    source: str
    page: Optional[int] = None
    clause_id: Optional[str] = None
    score: float
    snippet: str

