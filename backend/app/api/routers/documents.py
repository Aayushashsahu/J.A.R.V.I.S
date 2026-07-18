import os
import anyio
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.db.models import User, Workspace, Document
from app.services.document_processor import DocumentProcessor
from app.services.llm_provider import llm_provider
from app.services.qdrant_service import qdrant_service

router = APIRouter()

# Directory to temporarily store files. In production, use S3.
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/{workspace_id}/upload")
async def upload_document(
    workspace_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    # Check if workspace exists and belongs to user
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.user_id == current_user.id
    ).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    content = await file.read()
    
    # Save file locally
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    async with await anyio.open_file(file_path, "wb") as f:
        await f.write(content)

    # Save to DB
    ext = file.filename.split('.')[-1].lower()
    doc = Document(
        user_id=current_user.id,
        workspace_id=workspace_id,
        filename=file.filename,
        content_type=ext,
        file_path=file_path
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Process Document
    try:
        # process_with_metadata() returns List[ChunkMetadata] — each object
        # carries text, chunk_index, page_number, and clause_id.
        # For PDFs the page_number is the physical PDF page (1-based).
        # For txt/md/docx it is None (those formats have no stable page concept).
        chunk_metadata = DocumentProcessor.process_with_metadata(file.filename, content)

        texts       = [cm.text        for cm in chunk_metadata]
        page_nums   = [cm.page_number for cm in chunk_metadata]
        clause_ids  = [cm.clause_id   for cm in chunk_metadata]

        # Generate Embeddings
        embeddings = llm_provider.generate_embeddings(texts)

        # Insert into Qdrant — source_file is now correctly passed (fixes P0 bug),
        # and all metadata fields are forwarded so retrieval needs no DB lookups.
        qdrant_service.insert_chunks(
            workspace_id=workspace_id,
            document_id=doc.id,
            source_file=file.filename,
            chunks=texts,
            embeddings=embeddings,
            page_numbers=page_nums,
            clause_ids=clause_ids,
        )
    except Exception as e:
        # We might want to mark the document as failed in a real app
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")

    return {"message": "Document uploaded and processed successfully", "document_id": doc.id}
