import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta, timezone

from app.api import deps
from app.db.models import User, MemoryTimelineEvent

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/timeline")
def get_timeline(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> dict:
    """Retrieve chronologically grouped audit logs of workspace updates."""
    logger.info(f"User {current_user.id} requested memory timeline audit log.")
    events = db.query(MemoryTimelineEvent).filter(
        MemoryTimelineEvent.user_id == current_user.id
    ).order_by(MemoryTimelineEvent.created_at.desc()).limit(50).all()

    # Properly serialize the events
    def serialize_event(event):
        return {
            "id": event.id,
            "event_type": event.event_type,
            "content": event.content,
            "created_at": event.created_at.isoformat() if event.created_at else None
        }

    # Grouping lists
    today = []
    this_week = []
    older = []

    # Use UTC for consistent comparison
    now = datetime.now(timezone.utc)

    for event in events:
        event_date = event.created_at
        if event_date.tzinfo is None:
            # If naive, assume UTC
            event_date = event_date.replace(tzinfo=timezone.utc)

        delta = now - event_date
        if delta.days == 0:
            today.append(serialize_event(event))
        elif delta.days <= 7:
            this_week.append(serialize_event(event))
        else:
            older.append(serialize_event(event))

    return {
        "today": today,
        "this_week": this_week,
        "older": older
    }