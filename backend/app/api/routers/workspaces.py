import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.db.models import User, Workspace
from app.schemas import WorkspaceResponse, WorkspaceCreate

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/", response_model=List[WorkspaceResponse])
def get_workspaces(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> List[Workspace]:
    """Retrieve list of all active workspaces belonging to the user."""
    logger.info(f"Retrieving workspaces list for user {current_user.id}")
    workspaces = db.query(Workspace).filter(Workspace.user_id == current_user.id).all()
    return workspaces

@router.post("/", response_model=WorkspaceResponse)
def create_workspace(
    workspace_in: WorkspaceCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Workspace:
    """Create a new isolated workspace context."""
    workspace_name = workspace_in.name.strip()
    if not workspace_name:
        raise HTTPException(status_code=400, detail="Workspace name cannot be empty")

    # Check for duplicates
    existing = db.query(Workspace).filter(
        Workspace.user_id == current_user.id,
        Workspace.name.ilike(workspace_name)
    ).first()
    if existing:
        logger.warning(f"Workspace creation aborted: Duplicate name '{workspace_name}' for user {current_user.id}")
        raise HTTPException(status_code=400, detail="A workspace with this name already exists")

    workspace = Workspace(name=workspace_name, user_id=current_user.id)
    db.add(workspace)
    db.commit()
    db.refresh(workspace)
    logger.info(f"Created new workspace context '{workspace.name}' (id: {workspace.id}) for user {current_user.id}")
    return workspace

@router.get("/{workspace_id}", response_model=WorkspaceResponse)
def get_workspace(
    workspace_id: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Workspace:
    """Retrieve details for a specific workspace context."""
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id, 
        Workspace.user_id == current_user.id
    ).first()
    if not workspace:
        logger.warning(f"Workspace {workspace_id} not found or unauthorized for user {current_user.id}")
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace

