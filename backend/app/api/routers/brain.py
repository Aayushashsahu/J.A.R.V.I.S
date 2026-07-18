import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api import deps
from app.db.models import User, PKMEntity, Entity, Belief, Suggestion, KnowledgeGraphNode, KnowledgeGraphEdge

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/pkm")
def get_pkm(db: Session = Depends(deps.get_db), current_user: User = Depends(deps.get_current_user)):
    """Retrieve structured PKM entities and identified named entities."""
    pkm = db.query(PKMEntity).filter(PKMEntity.user_id == current_user.id).all()
    entities = db.query(Entity).filter(Entity.user_id == current_user.id).all()

    # Serialize PKM entities
    pkm_serialized = [
        {
            "id": item.id,
            "category": item.category,
            "value": item.value,
            "confidence": item.confidence,
            "source_file": item.source_file,
            "evidence_type": item.evidence_type,
            "priority": item.priority,
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "updated_at": item.updated_at.isoformat() if item.updated_at else None
        }
        for item in pkm
    ]

    # Serialize entities
    entities_serialized = [
        {
            "id": item.id,
            "type": item.type,
            "name": item.name,
            "created_at": item.created_at.isoformat() if item.created_at else None
        }
        for item in entities
    ]

    return {"pkm_entities": pkm_serialized, "entities": entities_serialized}

@router.get("/beliefs")
def get_beliefs(db: Session = Depends(deps.get_db), current_user: User = Depends(deps.get_current_user)):
    """Retrieve long-term workspace beliefs compiled by J.A.R.V.I.S."""
    beliefs = db.query(Belief).filter(Belief.user_id == current_user.id).order_by(Belief.created_at.desc()).all()

    # Serialize beliefs
    beliefs_serialized = [
        {
            "id": item.id,
            "belief_text": item.belief_text,
            "confidence": item.confidence,
            "evidence": item.evidence,
            "source_notes": item.source_notes,
            "evidence_type": item.evidence_type,
            "priority": item.priority,
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "updated_at": item.updated_at.isoformat() if item.updated_at else None
        }
        for item in beliefs
    ]

    return beliefs_serialized

@router.get("/suggestions")
def get_suggestions(db: Session = Depends(deps.get_db), current_user: User = Depends(deps.get_current_user)):
    """Retrieve pending optimization suggestions."""
    suggestions = db.query(Suggestion).filter(
        Suggestion.user_id == current_user.id,
        Suggestion.status == "pending"
    ).all()

    # Serialize suggestions
    suggestions_serialized = [
        {
            "id": item.id,
            "target_id": item.target_id,
            "suggestion_type": item.suggestion_type,
            "content": item.content,
            "confidence": item.confidence,
            "status": item.status,
            "created_at": item.created_at.isoformat() if item.created_at else None
        }
        for item in suggestions
    ]

    return suggestions_serialized

@router.post("/suggestions/{suggestion_id}/resolve")
def resolve_suggestion(
    suggestion_id: str,
    action: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """Resolve a pending suggestion by either approving or rejecting it."""
    if action not in ["approved", "rejected"]:
        logger.warning(f"Invalid suggestion action: {action}")
        raise HTTPException(status_code=400, detail="Invalid action. Must be 'approved' or 'rejected'")

    sug = db.query(Suggestion).filter(
        Suggestion.id == suggestion_id,
        Suggestion.user_id == current_user.id
    ).first()

    if not sug:
        logger.warning(f"Suggestion {suggestion_id} not found for user {current_user.id}")
        raise HTTPException(status_code=404, detail="Suggestion not found")

    sug.status = action
    db.commit()
    logger.info(f"Suggestion {suggestion_id} has been marked as {action} by user {current_user.id}")
    return {"status": "success"}

@router.get("/graph")
def get_graph(db: Session = Depends(deps.get_db), current_user: User = Depends(deps.get_current_user)):
    """Retrieve the node/edge knowledge graph data for mapping."""
    nodes = db.query(KnowledgeGraphNode).filter(KnowledgeGraphNode.user_id == current_user.id).all()
    edges = db.query(KnowledgeGraphEdge).filter(KnowledgeGraphEdge.user_id == current_user.id).all()

    # Serialize nodes
    nodes_serialized = [
        {
            "id": item.id,
            "user_id": item.user_id,
            "node_type": item.node_type,
            "node_id": item.node_id,
            "created_at": item.created_at.isoformat() if item.created_at else None
        }
        for item in nodes
    ]

    # Serialize edges
    edges_serialized = [
        {
            "id": item.id,
            "user_id": item.user_id,
            "source_node_id": item.source_node_id,
            "target_node_id": item.target_node_id,
            "relationship_type": item.relationship_type,
            "created_at": item.created_at.isoformat() if item.created_at else None
        }
        for item in edges
    ]

    return {"nodes": nodes_serialized, "edges": edges_serialized}