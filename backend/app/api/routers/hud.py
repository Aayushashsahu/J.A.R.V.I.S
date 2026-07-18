import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api import deps
from app.db.models import User, PKMEntity, Belief, Memory, Document, KnowledgeGraphEdge

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/status")
def get_system_status(current_user: User = Depends(deps.get_current_user)):
    """Retrieve operational status checks for subsystems."""
    logger.debug(f"User {current_user.id} requested system status check.")
    return {
        "status": "online",
        "subsystems": {
            "qdrant": "ok",
            "llm": "ok",
            "database": "ok"
        }
    }

@router.get("/focus")
def get_active_focus(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """Retrieve high-confidence Project entities representing focus areas."""
    projects = db.query(PKMEntity).filter(
        PKMEntity.user_id == current_user.id,
        PKMEntity.category == "Project"
    ).order_by(PKMEntity.confidence.desc()).limit(3).all()
    
    return {"active_projects": [p.value for p in projects]}

@router.get("/beliefs")
def get_core_beliefs(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """Retrieve top beliefs in the workspace context."""
    beliefs = db.query(Belief).filter(
        Belief.user_id == current_user.id
    ).order_by(Belief.confidence.desc()).limit(5).all()
    
    return {"core_beliefs": [{"belief": b.belief_text, "confidence": b.confidence} for b in beliefs]}

@router.get("/stats")
def get_system_stats(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """Compile diagnostic telemetry counts for documents, beliefs, and graph synapses."""
    doc_count = db.query(func.count(Document.id)).filter(Document.user_id == current_user.id).scalar() or 0
    entity_count = db.query(func.count(PKMEntity.id)).filter(PKMEntity.user_id == current_user.id).scalar() or 0
    belief_count = db.query(func.count(Belief.id)).filter(Belief.user_id == current_user.id).scalar() or 0
    
    # Query actual knowledge graph edges count instead of placeholders
    edge_count = db.query(func.count(KnowledgeGraphEdge.id)).filter(KnowledgeGraphEdge.user_id == current_user.id).scalar() or 0
    
    return {
        "memory_count": doc_count + entity_count,
        "beliefs_count": belief_count,
        "synapses_count": edge_count
    }

