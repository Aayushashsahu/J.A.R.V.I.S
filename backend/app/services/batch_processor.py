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

def _get_or_create_document(db: Session, user_id: str, workspace_id: str, filename: str, file_path: str) -> Document:
    doc = db.query(Document).filter(Document.file_path == file_path).first()
    if not doc:
        doc = Document(
            user_id=user_id,
            workspace_id=workspace_id,
            filename=filename,
            content_type="md",
            file_path=file_path
        )
        db.add(doc)
        db.commit()
    return doc

def _extract_entities_via_llm(content: str) -> dict:
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
    {content}
    """
    response = llm_provider.generate_text(prompt, "You are an AI extracting structured data.")
    clean_resp = response.replace("```json", "").replace("```", "").strip()
    return json.loads(clean_resp)

def _process_pkm_entities(db: Session, user_id: str, pkm_entities_data: list, filename: str):
    for pkm in pkm_entities_data:
        value = pkm.get("value", "").strip()
        if not value: continue
        # Deduplication
        value_clean = value.strip().lower()
        existing = db.query(PKMEntity).filter(
            PKMEntity.user_id == user_id,
            func.lower(func.trim(PKMEntity.value)) == value_clean
        ).first()
        if existing:
            existing.confidence = min(100, existing.confidence + 5) # Aggregate confidence
            db.commit()
        else:
            new_pkm = PKMEntity(
                user_id=user_id,
                category=pkm.get("category", "Interest"),
                value=value,
                confidence=pkm.get("confidence", 50),
                source_file=filename,
                evidence_type="structured_memory",
                priority=2
            )
            db.add(new_pkm)
            db.commit()
            db.refresh(new_pkm)
            # Graph Node
            db.add(KnowledgeGraphNode(user_id=user_id, node_type="PKMEntity", node_id=new_pkm.id))

def _process_general_entities(db: Session, user_id: str, entities_data: list):
    for ent in entities_data:
        name = ent.get("name", "").strip()
        if not name: continue
        # Deduplication
        name_clean = name.strip().lower()
        existing = db.query(Entity).filter(
            Entity.user_id == user_id,
            func.lower(func.trim(Entity.name)) == name_clean
        ).first()
        if not existing:
            new_ent = Entity(
                user_id=user_id,
                type=ent.get("type", "Concept"),
                name=name
            )
            db.add(new_ent)
            db.commit()
            db.refresh(new_ent)
            # Graph Node
            db.add(KnowledgeGraphNode(user_id=user_id, node_type="Entity", node_id=new_ent.id))

def _generate_organization_suggestion(db: Session, user_id: str, doc_id: str, filename: str, sug_data: dict):
    if sug_data and sug_data.get("suggested_workspace"):
        evidence = sug_data.get("evidence", [])
        conf = sug_data.get("confidence", 80)
        ws = sug_data.get("suggested_workspace")
        suggestion_content = json.dumps({
            "filename": filename,
            "suggested_workspace": ws,
            "evidence": evidence
        })
        db.add(Suggestion(user_id=user_id, target_id=doc_id, suggestion_type="move_workspace", content=suggestion_content, confidence=conf, status="pending"))

def _create_memory_timeline_event(db: Session, user_id: str, workspace_id: str, action: str, filename: str, data: dict):
    from app.db.models import MemoryTimelineEvent
    timeline_event = MemoryTimelineEvent(
        user_id=user_id,
        workspace_id=workspace_id,
        event_type="modification" if action == "modified" else "creation",
        content=f"Document '{filename}' was processed. Extracted {len(data.get('pkm_entities', []))} PKMs and {len(data.get('entities', []))} entities."
    )
    db.add(timeline_event)
    db.commit()

def _trigger_reflection_engine(db: Session, user_id: str, workspace_id: str, filename: str, doc_id: str):
    refl_payload = {
        "workspace_id": workspace_id,
        "source_file": filename,
        "document_id": doc_id
    }
    refl_task = QueuedTask(user_id=user_id, task_type="generate_reflection", payload=json.dumps(refl_payload), status="pending")
    db.add(refl_task)
    db.commit()

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
        doc = _get_or_create_document(db, task.user_id, workspace_id, filename, file_path)

        try:
            data = _extract_entities_via_llm(parsed['content'])
            
            # Batch PKM Entities lookup
            pkm_values = [pkm.get("value", "").strip() for pkm in data.get("pkm_entities", []) if pkm.get("value", "").strip()]
            pkm_values_clean = [v.lower() for v in pkm_values]

            existing_pkms = {}
            if pkm_values_clean:
                existing_pkm_query = db.query(PKMEntity).filter(
                    PKMEntity.user_id == task.user_id,
                    func.lower(func.trim(PKMEntity.value)).in_(pkm_values_clean)
                ).all()
                existing_pkms = {pkm.value.strip().lower(): pkm for pkm in existing_pkm_query}

            new_pkms_to_add = []
            new_kg_nodes_to_add = []

            for pkm in data.get("pkm_entities", []):
                value = pkm.get("value", "").strip()
                if not value: continue
                value_clean = value.lower()

                existing = existing_pkms.get(value_clean)
                if existing:
                    existing.confidence = min(100, existing.confidence + 5)
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
                    new_pkms_to_add.append(new_pkm)
                    existing_pkms[value_clean] = new_pkm
                    # Note: we need the ID for KnowledgeGraphNode. We can flush the session to get IDs.

            db.flush() # get IDs for new PKMs

            for new_pkm in new_pkms_to_add:
                new_kg_nodes_to_add.append(KnowledgeGraphNode(user_id=task.user_id, node_type="PKMEntity", node_id=new_pkm.id))

            # Batch Entities lookup
            ent_names = [ent.get("name", "").strip() for ent in data.get("entities", []) if ent.get("name", "").strip()]
            ent_names_clean = [n.lower() for n in ent_names]

            existing_ents = {}
            if ent_names_clean:
                existing_ent_query = db.query(Entity).filter(
                    Entity.user_id == task.user_id,
                    func.lower(func.trim(Entity.name)).in_(ent_names_clean)
                ).all()
                existing_ents = {ent.name.strip().lower(): ent for ent in existing_ent_query}

            new_ents_to_add = []

            for ent in data.get("entities", []):
                name = ent.get("name", "").strip()
                if not name: continue
                name_clean = name.lower()

                if name_clean not in existing_ents:
                    new_ent = Entity(
                        user_id=task.user_id,
                        type=ent.get("type", "Concept"),
                        name=name
                    )
                    db.add(new_ent)
                    new_ents_to_add.append(new_ent)
                    # We add to existing_ents to avoid inserting duplicate names from the same batch
                    existing_ents[name_clean] = new_ent

            db.flush() # get IDs for new Entities

            for new_ent in new_ents_to_add:
                new_kg_nodes_to_add.append(KnowledgeGraphNode(user_id=task.user_id, node_type="Entity", node_id=new_ent.id))

            for kg_node in new_kg_nodes_to_add:
                db.add(kg_node)

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

            _generate_organization_suggestion(db, task.user_id, doc.id, filename, data.get("organization_suggestion"))
            _create_memory_timeline_event(db, task.user_id, workspace_id, action, filename, data)
            _trigger_reflection_engine(db, task.user_id, workspace_id, filename, doc.id)
            
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
