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
        logger.info(f"[Ingestion] Stage 1/5: Text extraction and metadata parsing for {safe_filename}")
        chunk_metadata = DocumentProcessor.process_with_metadata(safe_filename, content)
        logger.info(f"[Ingestion] Stage 1/5 complete: produced {len(chunk_metadata)} chunks")

        texts       = [cm.text        for cm in chunk_metadata]
        page_nums   = [cm.page_number for cm in chunk_metadata]
        clause_ids  = [cm.clause_id   for cm in chunk_metadata]

        logger.info(f"[Ingestion] Stage 2/5: Generating embeddings for {len(texts)} chunks")
        embeddings = llm_provider.generate_embeddings(texts)
        logger.info(f"[Ingestion] Stage 2/5 complete: generated {len(embeddings)} embedding vectors")

        logger.info("[Ingestion] Stage 3/5: Inserting vector embeddings into Qdrant")
        qdrant_service.insert_chunks(
            workspace_id=workspace_id,
            document_id=doc.id,
            source_file=safe_filename,
            chunks=texts,
            embeddings=embeddings,
            page_numbers=page_nums,
            clause_ids=clause_ids,
        )
        logger.info(f"[Ingestion] Stage 3/5 complete")

        # Stage 4: Extract PKM entities, general entities, create KG nodes
        logger.info(f"[Ingestion] Stage 4/5: Knowledge extraction for {safe_filename}")
        try:
            from app.db.models import PKMEntity, Entity, KnowledgeGraphNode, KnowledgeGraphEdge, Suggestion, MemoryTimelineEvent
            from sqlalchemy import func
            import json

            # ── Industrial Entity Extraction (regex-based, no LLM needed) ──
            from app.services.industrial_extractor import industrial_extractor
            full_text = "\n".join(texts)
            industrial_entities = industrial_extractor.extract_for_pkm(full_text, safe_filename)
            industrial_kg_entities = industrial_extractor.extract_for_kg(full_text, safe_filename)
            logger.info(f"[Ingestion] Industrial extraction: {len(industrial_entities)} entities found")

            # Store industrial PKM entities
            pkm_count = 0
            for pkm in industrial_entities:
                value = pkm.get("value", "").strip()
                if not value:
                    continue
                existing_pkm = db.query(PKMEntity).filter(
                    PKMEntity.user_id == current_user.id,
                    func.lower(func.trim(PKMEntity.value)) == value.lower()
                ).first()
                if existing_pkm:
                    existing_pkm.confidence = min(100, existing_pkm.confidence + 5)
                else:
                    new_pkm = PKMEntity(
                        user_id=current_user.id,
                        category=pkm.get("category", "Interest"),
                        value=value,
                        confidence=pkm.get("confidence", 50),
                        source_file=safe_filename,
                        evidence_type="industrial_extraction",
                        priority=2
                    )
                    db.add(new_pkm)
                    db.flush()
                    db.add(KnowledgeGraphNode(user_id=current_user.id, node_type="PKMEntity", node_id=new_pkm.id))
                    pkm_count += 1

            # Store industrial general entities (Equipment, Regulation, etc.)
            ent_count = 0
            for ent in industrial_kg_entities:
                name = ent.get("name", "").strip()
                if not name:
                    continue
                existing_ent = db.query(Entity).filter(
                    Entity.user_id == current_user.id,
                    func.lower(func.trim(Entity.name)) == name.lower()
                ).first()
                if not existing_ent:
                    new_ent = Entity(user_id=current_user.id, type=ent.get("type", "Concept"), name=name)
                    db.add(new_ent)
                    db.flush()
                    db.add(KnowledgeGraphNode(user_id=current_user.id, node_type="Entity", node_id=new_ent.id))
                    ent_count += 1

            # Auto-create edges between entities from same document
            all_new_nodes = db.query(KnowledgeGraphNode).filter(
                KnowledgeGraphNode.user_id == current_user.id
            ).all()
            if len(all_new_nodes) > 1:
                for i, node_a in enumerate(all_new_nodes):
                    for node_b in all_new_nodes[i+1:]:
                        existing_edge = db.query(KnowledgeGraphEdge).filter(
                            KnowledgeGraphEdge.user_id == current_user.id,
                            KnowledgeGraphEdge.source_node_id == node_a.id,
                            KnowledgeGraphEdge.target_node_id == node_b.id
                        ).first()
                        if not existing_edge:
                            db.add(KnowledgeGraphEdge(
                                user_id=current_user.id,
                                source_node_id=node_a.id,
                                target_node_id=node_b.id,
                                relationship_type="co_occurring"
                            ))

            db.commit()
            logger.info(f"[Ingestion] Stage 4/5 complete: {pkm_count} PKMs, {ent_count} entities extracted")
        except Exception as e:
            logger.error(f"[Ingestion] Knowledge extraction failed (non-fatal): {e}")

        # Stage 5: Create timeline event and trigger reflection
        logger.info(f"[Ingestion] Stage 5/5: Timeline and reflection for {safe_filename}")
        try:
            from app.db.models import MemoryTimelineEvent, QueuedTask
            timeline_event = MemoryTimelineEvent(
                user_id=current_user.id,
                workspace_id=workspace_id,
                event_type="creation",
                content=f"Document '{safe_filename}' was uploaded and processed."
            )
            db.add(timeline_event)

            # Queue reflection task
            refl_payload = json.dumps({
                "workspace_id": workspace_id,
                "source_file": safe_filename,
                "document_id": doc.id
            })
            db.add(QueuedTask(
                user_id=current_user.id,
                task_type="generate_reflection",
                payload=refl_payload,
                status="pending"
            ))
            db.commit()
            logger.info(f"[Ingestion] Stage 5/5 complete")
        except Exception as e:
            logger.error(f"[Ingestion] Timeline/reflection failed (non-fatal): {e}")

        logger.info(f"[Ingestion] Full pipeline completed successfully for {safe_filename}")
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
