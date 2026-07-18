import time
import json
import logging
import os
import asyncio
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import SessionLocal
from app.db.models import QueuedTask, Document, Workspace, PKMEntity, Entity, KnowledgeGraphNode, Suggestion
from app.services.markdown_parser import MarkdownParser
from app.services.llm_provider import llm_provider

logger = logging.getLogger(__name__)

def get_workspace_for_path(db: Session, user_id: str, file_path: str) -> str:
    vault_path = os.environ.get("JARVIS_VAULT_PATH", "/vault")
    try:
        rel_path = os.path.relpath(file_path, vault_path)
        top_folder = rel_path.split(os.sep)[0]
    except ValueError:
        top_folder = "Inbox"

    if top_folder == "." or top_folder.endswith(".md"):
        top_folder = "Inbox"
        
    workspace = db.query(Workspace).filter(Workspace.user_id == user_id, Workspace.name == top_folder).first()
    if not workspace:
        workspace = Workspace(user_id=user_id, name=top_folder)
        db.add(workspace)
        db.commit()
        db.refresh(workspace)
    return workspace.id

def process_markdown_task(db: Session, task: QueuedTask):
    payload = json.loads(task.payload)
    file_path = payload.get("file_path")
    action = payload.get("action")

    if action in ["created", "modified"] and os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        parsed = MarkdownParser.process_document(content)
        
        workspace_id = get_workspace_for_path(db, task.user_id, file_path)

        filename = os.path.basename(file_path)
        doc = db.query(Document).filter(Document.file_path == file_path).first()
        if not doc:
            doc = Document(
                user_id=task.user_id,
                workspace_id=workspace_id,
                filename=filename,
                content_type="md",
                file_path=file_path
            )
            db.add(doc)
            db.commit()

        prompt = f"""
        Extract key PKM Entities (Goals, Projects, Interests) and General Entities (People, Companies, Technologies) from the following text.
        Also, provide a smart organization suggestion if this document belongs in a specific workspace based on the entities found.
        Return ONLY valid JSON in this format:
        {{
            "pkm_entities": [ {{"category": "Goal", "value": "Launch product", "confidence": 90}} ],
            "entities": [ {{"type": "Person", "name": "Alice"}} ],
            "organization_suggestion": {{
                "suggested_workspace": "Startups",
                "confidence": 92,
                "evidence": ["Mentioned 12 times", "Related to product"]
            }}
        }}
        Text:
        {parsed['content']}
        """
        response = llm_provider.generate_text(prompt, "You are an AI extracting structured data.")
        try:
            clean_resp = response.replace("```json", "").replace("```", "").strip()
            data = json.loads(clean_resp)
            
            # Pre-fetch existing PKM Entities to avoid N+1 queries
            pkm_entities_data = data.get("pkm_entities", [])
            unique_pkm_values = {p.get("value", "").strip().lower() for p in pkm_entities_data if p.get("value", "").strip()}

            pkm_dict = {}
            if unique_pkm_values:
                existing_pkms = db.query(PKMEntity).filter(
                    PKMEntity.user_id == task.user_id,
                    func.lower(func.trim(PKMEntity.value)).in_(unique_pkm_values)
                ).all()
                pkm_dict = {p.value.strip().lower(): p for p in existing_pkms if p.value}

            for pkm in pkm_entities_data:
                value = pkm.get("value", "").strip()
                if not value: continue
                # Deduplication
                value_clean = value.lower()
                existing = pkm_dict.get(value_clean)

                if existing:
                    existing.confidence = min(100, existing.confidence + 5) # Aggregate confidence
                else:
                    new_pkm = PKMEntity(
                        user_id=task.user_id,
                        category=pkm.get("category", "Interest"),
                        value=value,
                        confidence=pkm.get("confidence", 50),
                        source_file=filename,
                        evidence_type="structured_memory",
                        priority=2
                    )
                    db.add(new_pkm)
                    db.flush() # Flush to get ID without committing transaction
                    # Graph Node
                    db.add(KnowledgeGraphNode(user_id=task.user_id, node_type="PKMEntity", node_id=new_pkm.id))
                    # Add to dictionary so we don't recreate it if there are duplicates in this same payload
                    pkm_dict[value_clean] = new_pkm
                
            # Pre-fetch existing Entities to avoid N+1 queries
            entities_data = data.get("entities", [])
            unique_ent_names = {e.get("name", "").strip().lower() for e in entities_data if e.get("name", "").strip()}

            ent_dict = {}
            if unique_ent_names:
                existing_ents = db.query(Entity).filter(
                    Entity.user_id == task.user_id,
                    func.lower(func.trim(Entity.name)).in_(unique_ent_names)
                ).all()
                ent_dict = {e.name.strip().lower(): e for e in existing_ents if e.name}

            for ent in entities_data:
                name = ent.get("name", "").strip()
                if not name: continue
                # Deduplication
                name_clean = name.lower()
                existing = ent_dict.get(name_clean)

                if not existing:
                    new_ent = Entity(
                        user_id=task.user_id,
                        type=ent.get("type", "Concept"),
                        name=name
                    )
                    db.add(new_ent)
                    db.flush() # Flush to get ID without committing transaction
                    # Graph Node
                    db.add(KnowledgeGraphNode(user_id=task.user_id, node_type="Entity", node_id=new_ent.id))
                    # Add to dictionary so we don't recreate it if there are duplicates in this same payload
                    ent_dict[name_clean] = new_ent
                
            db.commit()
            
            # Embed into Qdrant for Retrieval
            try:
                from app.services.qdrant_service import qdrant_service
                # Simple chunking: just use paragraphs or the whole text if it's small
                chunks = [p for p in parsed['content'].split('\n\n') if p.strip()]
                if chunks:
                    embeddings = llm_provider.generate_embeddings(chunks)
                    qdrant_service.insert_chunks(workspace_id, doc.id, filename, chunks, embeddings)
            except Exception as eq:
                logger.error(f"Qdrant insertion failed: {eq}")

            # Generate Suggestion (Smart Organization)
            sug_data = data.get("organization_suggestion")
            if sug_data and sug_data.get("suggested_workspace"):
                evidence = sug_data.get("evidence", [])
                conf = sug_data.get("confidence", 80)
                ws = sug_data.get("suggested_workspace")
                suggestion_content = json.dumps({
                    "filename": filename,
                    "suggested_workspace": ws,
                    "evidence": evidence
                })
                db.add(Suggestion(user_id=task.user_id, target_id=doc.id, suggestion_type="move_workspace", content=suggestion_content, confidence=conf, status="pending"))

            # Memory Timeline Event
            from app.db.models import MemoryTimelineEvent
            timeline_event = MemoryTimelineEvent(
                user_id=task.user_id,
                workspace_id=workspace_id,
                event_type="modification" if action == "modified" else "creation",
                content=f"Document '{filename}' was processed. Extracted {len(data.get('pkm_entities', []))} PKMs and {len(data.get('entities', []))} entities."
            )
            db.add(timeline_event)
            db.commit()


            
            # Trigger Reflection Engine
            refl_payload = {
                "workspace_id": workspace_id,
                "source_file": filename,
                "document_id": doc.id
            }
            refl_task = QueuedTask(user_id=task.user_id, task_type="generate_reflection", payload=json.dumps(refl_payload), status="pending")
            db.add(refl_task)
            db.commit()

            
        except Exception as e:
            logger.error(f"Failed to parse LLM JSON: {e}")

    task.status = "completed"
    db.commit()

async def run_batch_processor():
    logger.info("Batch Processor Started")
    while True:
        db = SessionLocal()
        try:
            tasks = db.query(QueuedTask).filter(QueuedTask.status == "pending").limit(10).all()
            for task in tasks:
                logger.info(f"Processing task {task.id} of type {task.task_type}")
                try:
                    if task.task_type == "process_markdown_file":
                        process_markdown_task(db, task)
                    else:
                        task.status = "failed"
                        db.commit()
                except Exception as e:
                    logger.error(f"Task {task.id} failed: {e}")
                    task.status = "failed"
                    db.commit()
        finally:
            db.close()
            
        await asyncio.sleep(5)
