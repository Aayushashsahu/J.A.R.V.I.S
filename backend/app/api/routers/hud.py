from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api import deps
from app.db.models import User, PKMEntity, Belief, Document

router = APIRouter()

@router.get("/status")
def get_system_status():
    return {"status": "online", "subsystems": {"qdrant": "ok", "llm": "ok", "database": "ok"}}

@router.get("/focus")
def get_active_focus(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
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
    beliefs = db.query(Belief).filter(
        Belief.user_id == current_user.id
    ).order_by(Belief.confidence.desc()).limit(5).all()
    
    return {"core_beliefs": [{"belief": b.belief_text, "confidence": b.confidence} for b in beliefs]}

@router.get("/stats")
def get_system_stats(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    doc_count = db.query(func.count(Document.id)).filter(Document.user_id == current_user.id).scalar()
    entity_count = db.query(func.count(PKMEntity.id)).filter(PKMEntity.user_id == current_user.id).scalar()
    belief_count = db.query(func.count(Belief.id)).filter(Belief.user_id == current_user.id).scalar()
    
    return {
        "memory_count": doc_count + entity_count,
        "beliefs_count": belief_count,
        "synapses_count": entity_count * 2 # Placeholder for future knowledge graph edges
    }
