from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_current_user
from app.db.models import User, PKMEntity, Entity, Belief, Suggestion, KnowledgeGraphNode, KnowledgeGraphEdge

router = APIRouter()

@router.get("/pkm")
def get_pkm(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pkm = db.query(PKMEntity).filter(PKMEntity.user_id == current_user.id).all()
    entities = db.query(Entity).filter(Entity.user_id == current_user.id).all()
    return {"pkm_entities": pkm, "entities": entities}

@router.get("/beliefs")
def get_beliefs(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    beliefs = db.query(Belief).filter(Belief.user_id == current_user.id).order_by(Belief.created_at.desc()).all()
    return beliefs

@router.get("/suggestions")
def get_suggestions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    suggestions = db.query(Suggestion).filter(Suggestion.user_id == current_user.id, Suggestion.status == "pending").all()
    return suggestions

@router.post("/suggestions/{suggestion_id}/resolve")
def resolve_suggestion(suggestion_id: str, action: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # action should be "approved" or "rejected"
    sug = db.query(Suggestion).filter(Suggestion.id == suggestion_id, Suggestion.user_id == current_user.id).first()
    if sug:
        sug.status = action
        db.commit()
    return {"status": "success"}

@router.get("/graph")
def get_graph(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    nodes = db.query(KnowledgeGraphNode).filter(KnowledgeGraphNode.user_id == current_user.id).all()
    edges = db.query(KnowledgeGraphEdge).filter(KnowledgeGraphEdge.user_id == current_user.id).all()
    return {"nodes": nodes, "edges": edges}
