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
    
    # Sanitize filename to prevent path traversal
    safe_filename = os.path.basename(file.filename.replace("\\", "/"))
    if not safe_filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    # Save file locally
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    async with await anyio.open_file(file_path, "wb") as f:
        await f.write(content)

    # Save to DB
    ext = safe_filename.split('.')[-1].lower()
    doc = Document(
        user_id=current_user.id,
        workspace_id=workspace_id,
        filename=safe_filename,
        content_type=ext,
        file_path=file_path
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Process Document
    import logging
    import traceback
    logger = logging.getLogger(__name__)

    logger.info(f"[Ingestion] Received file: {safe_filename}, size: {len(content)} bytes, workspace_id: {workspace_id}")
    try:
        logger.info(f"[Ingestion] Stage 1/3: Text extraction and metadata parsing for {safe_filename}")
        chunk_metadata = DocumentProcessor.process_with_metadata(safe_filename, content)

        texts       = [cm.text        for cm in chunk_metadata]
        page_nums   = [cm.page_number for cm in chunk_metadata]
        clause_ids  = [cm.clause_id   for cm in chunk_metadata]

        logger.info(f"[Ingestion] Stage 2/3: Generating embeddings for {len(texts)} chunks using GeminiProvider")
        # Generate Embeddings
        embeddings = llm_provider.generate_embeddings(texts)

        logger.info(f"[Ingestion] Stage 3/3: Inserting vector embeddings and chunks into Qdrant database")
        qdrant_service.insert_chunks(
            workspace_id=workspace_id,
            document_id=doc.id,
            source_file=safe_filename,
            chunks=texts,
            embeddings=embeddings,
            page_numbers=page_nums,
            clause_ids=clause_ids,
        )
        logger.info(f"[Ingestion] Ingestion pipeline completed successfully for {safe_filename}")
    except Exception as e:
        logger.error(f"[Ingestion] Ingestion failed for {safe_filename}")
        logger.error(f"[Ingestion] Failure traceback:\n{traceback.format_exc()}")
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=500,
            content={
                "error": f"Failed to process document: {str(e)}",
                "type": type(e).__name__,
                "traceback": traceback.format_exc()
            }
        )

    return {"message": "Document uploaded and processed successfully", "document_id": doc.id}
