from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api import deps
from app.db.models import User, MemoryTimelineEvent

router = APIRouter()

@router.get("/timeline")
def get_timeline(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    events = db.query(MemoryTimelineEvent).filter(
        MemoryTimelineEvent.user_id == current_user.id
    ).order_by(MemoryTimelineEvent.created_at.desc()).limit(50).all()
    
    # Simple grouping for now
    today = []
    this_week = []
    older = []
    
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    
    for event in events:
        delta = now - event.created_at
        if delta.days == 0:
            today.append(event)
        elif delta.days <= 7:
            this_week.append(event)
        else:
            older.append(event)
            
    return {
        "today": [e.__dict__ for e in today],
        "this_week": [e.__dict__ for e in this_week],
        "older": [e.__dict__ for e in older]
    }
