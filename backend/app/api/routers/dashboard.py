from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api import deps
from app.db.models import (
    User, Document, Belief, PKMEntity, Conversation,
    KnowledgeGraphNode, KnowledgeGraphEdge, Entity, Suggestion,
    MemoryTimelineEvent
)

router = APIRouter()

@router.get("/stats")
def get_dashboard_stats(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """Return real-time dashboard statistics from the database."""
    # Document count
    document_count = db.query(func.count(Document.id)).filter(
        Document.user_id == current_user.id
    ).scalar() or 0

    # Belief / compliance count
    belief_count = db.query(func.count(Belief.id)).filter(
        Belief.user_id == current_user.id
    ).scalar() or 0

    # PKM entity count (equipment, failure modes, regulations, etc.)
    pkm_entity_count = db.query(func.count(PKMEntity.id)).filter(
        PKMEntity.user_id == current_user.id
    ).scalar() or 0

    # Chat session count
    chat_session_count = db.query(func.count(Conversation.id)).filter(
        Conversation.user_id == current_user.id,
        Conversation.messages.any()
    ).scalar() or 0

    # Knowledge graph stats
    kg_node_count = db.query(func.count(KnowledgeGraphNode.id)).filter(
        KnowledgeGraphNode.user_id == current_user.id
    ).scalar() or 0

    kg_edge_count = db.query(func.count(KnowledgeGraphEdge.id)).filter(
        KnowledgeGraphEdge.user_id == current_user.id
    ).scalar() or 0

    # Entity breakdown
    entity_count = db.query(func.count(Entity.id)).filter(
        Entity.user_id == current_user.id
    ).scalar() or 0

    # Pending suggestions (recommendations)
    suggestion_count = db.query(func.count(Suggestion.id)).filter(
        Suggestion.user_id == current_user.id,
        Suggestion.status == "pending"
    ).scalar() or 0

    # Timeline events
    timeline_count = db.query(func.count(MemoryTimelineEvent.id)).filter(
        MemoryTimelineEvent.user_id == current_user.id
    ).scalar() or 0

    # Equipment count (from PKM entities with category Equipment)
    equipment_count = db.query(func.count(PKMEntity.id)).filter(
        PKMEntity.user_id == current_user.id,
        PKMEntity.category == "Equipment"
    ).scalar() or 0

    # Regulation count
    regulation_count = db.query(func.count(PKMEntity.id)).filter(
        PKMEntity.user_id == current_user.id,
        PKMEntity.category == "Regulation"
    ).scalar() or 0

    return {
        "documents": document_count,
        "beliefs": belief_count,
        "pkmEntities": pkm_entity_count,
        "chatSessions": chat_session_count,
        "kgNodes": kg_node_count,
        "kgEdges": kg_edge_count,
        "entities": entity_count,
        "suggestions": suggestion_count,
        "timelineEvents": timeline_count,
        "equipment": equipment_count,
        "regulations": regulation_count,
    }
