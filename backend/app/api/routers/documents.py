import os
import logging
import traceback
import anyio
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from app.api import deps
from app.db.models import User, Workspace, Document
from app.services.document_processor import DocumentProcessor
from app.services.llm_provider import llm_provider, unwrap_exception_chain
from app.services.qdrant_service import qdrant_service

logger = logging.getLogger(__name__)

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
    logger.info(f"[Ingestion] Received file: {safe_filename}, size: {len(content)} bytes, workspace_id: {workspace_id}")
    try:
        logger.info(f"[Ingestion] Stage 1/3: Text extraction and metadata parsing for {safe_filename}")
        chunk_metadata = DocumentProcessor.process_with_metadata(safe_filename, content)
        logger.info(f"[Ingestion] Stage 1/3 complete: produced {len(chunk_metadata)} chunks")

        texts       = [cm.text        for cm in chunk_metadata]
        page_nums   = [cm.page_number for cm in chunk_metadata]
        clause_ids  = [cm.clause_id   for cm in chunk_metadata]

        logger.info(f"[Ingestion] Stage 2/3: Generating embeddings for {len(texts)} chunks using GeminiProvider")
        # Generate Embeddings
        embeddings = llm_provider.generate_embeddings(texts)
        logger.info(f"[Ingestion] Stage 2/3 complete: generated {len(embeddings)} embedding vectors")

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
        # Unwrap nested exceptions (e.g. google-api-core RetryError → ClientError)
        root_cause = unwrap_exception_chain(e)
        logger.error(f"[Ingestion] Ingestion failed for {safe_filename}")
        logger.error(f"[Ingestion] Root cause: {type(root_cause).__name__}: {root_cause}")
        logger.error(f"[Ingestion] Full traceback:\n{traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={
                "error": f"Failed to process document: {type(root_cause).__name__}: {root_cause}",
                "exception_type": type(root_cause).__name__,
                "root_cause": str(root_cause),
                "traceback": traceback.format_exc(),
                "status": 500
            }
        )

    return {"message": "Document uploaded and processed successfully", "document_id": doc.id}
