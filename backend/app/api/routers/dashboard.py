from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api import deps
from app.db.models import User, Document, Belief, PKMEntity, Conversation

router = APIRouter()

@router.get("/stats")
def get_dashboard_stats(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    # Get document count
    document_count = db.query(func.count(Document.id)).filter(
        Document.user_id == current_user.id
    ).scalar()

    # Get belief count
    belief_count = db.query(func.count(Belief.id)).filter(
        Belief.user_id == current_user.id
    ).scalar()

    # Get PKM entity count
    pkm_entity_count = db.query(func.count(PKMEntity.id)).filter(
        PKMEntity.user_id == current_user.id
    ).scalar()

    # Get chat session count (conversations with messages)
    chat_session_count = db.query(func.count(Conversation.id)).filter(
        Conversation.user_id == current_user.id,
        Conversation.messages.any()
    ).scalar()

    return {
        "documents": document_count or 0,
        "beliefs": belief_count or 0,
        "pkmEntities": pkm_entity_count or 0,
        "chatSessions": chat_session_count or 0
    }