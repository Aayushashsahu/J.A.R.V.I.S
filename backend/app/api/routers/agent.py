from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import uuid
import json
import asyncio
import logging
from typing import Dict, Any

from app.api import deps
from app.db.models import User, Workspace
from app.agents.schemas import AgentOrchestrateRequest, KGNeighborResponse
from app.agents.graph import agent_graph
from app.agents.kg import kg_manager
from app.agents.service import save_agent_run

router = APIRouter()
logger = logging.getLogger(__name__)

async def run_agent_and_stream(request: AgentOrchestrateRequest, db: Session, user_id: str):
    run_id = str(uuid.uuid4())
    goal = request.goal
    workspace_id = request.workspace_id
    max_steps = request.max_steps
    
    # Sync knowledge graph with DB in background before starting
    try:
        kg_manager.sync_with_db(db)
    except Exception as sync_err:
        logger.warning(f"KG sync failed: {sync_err}")

    initial_state = {
        "workspace_id": workspace_id,
        "goal": goal,
        "max_steps": max_steps,
        "steps": [],
        "findings": [],
        "sources": [],
        "verification": {},
        "final_answer": "",
        "confidence": 0.0,
        "agent_run_id": run_id,
        "trace": []
    }
    
    full_trace = []
    final_answer = ""
    sources = []
    
    try:
        # LangGraph execution with a 60-second timeout
        async def execute():
            async for event in agent_graph.astream(initial_state):
                yield event
                
        iterator = execute()
        while True:
            event = await asyncio.wait_for(iterator.__anext__(), timeout=60.0)
            
            node_name = list(event.keys())[0]
            state_updates = event[node_name]
            
            if "trace" in state_updates and state_updates["trace"]:
                latest_event = state_updates["trace"][-1]
                full_trace.append(latest_event)
                yield f"data: {json.dumps(latest_event)}\n\n"
                
            if node_name == "formatter":
                final_answer = state_updates.get("final_answer", "")
                sources = state_updates.get("sources", [])
                
    except StopAsyncIteration:
        pass
    except asyncio.TimeoutError:
        logger.warning(f"Agent run {run_id} timed out after 60s.")
        timeout_event = {
            "event": "trace",
            "step": len(full_trace) + 1,
            "node": "system",
            "content": "Execution timed out after 60 seconds."
        }
        full_trace.append(timeout_event)
        yield f"data: {json.dumps(timeout_event)}\n\n"
        
        final_event = {
            "event": "final",
            "answer": "The request timed out. Please try again or simplify your query.",
            "sources": [],
            "agent_run_id": run_id
        }
        yield f"data: {json.dumps(final_event)}\n\n"
        
        save_agent_run(db, run_id, workspace_id, goal, full_trace, final_event["answer"], [])
        return
        
    except Exception as e:
        logger.error(f"Error executing agent: {e}", exc_info=True)
        error_event = {
            "event": "trace",
            "step": len(full_trace) + 1,
            "node": "system",
            "content": f"An error occurred: {str(e)}"
        }
        full_trace.append(error_event)
        yield f"data: {json.dumps(error_event)}\n\n"
        
        final_event = {
            "event": "final",
            "answer": f"System error: {str(e)}",
            "sources": [],
            "agent_run_id": run_id
        }
        yield f"data: {json.dumps(final_event)}\n\n"
        
        save_agent_run(db, run_id, workspace_id, goal, full_trace, final_event["answer"], [])
        return
        
    # Sync knowledge graph with findings from this run
    try:
        kg_manager.update_graph_from_run(goal, sources)
    except Exception as kg_err:
        logger.warning(f"Failed to update KG: {kg_err}")
        
    # Save the run trace to DB
    save_agent_run(db, run_id, workspace_id, goal, full_trace, final_answer, sources)

@router.post("/agent/orchestrate")
async def agent_orchestrate(
    request: AgentOrchestrateRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """
    POST `/api/agent/orchestrate`
    Securely runs the agent flow, streams live trace SSE events,
    and stores the run trace in the database.
    """
    # Verify workspace ownership
    workspace = db.query(Workspace).filter(
        Workspace.id == request.workspace_id,
        Workspace.user_id == current_user.id
    ).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
    }
    return StreamingResponse(
        run_agent_and_stream(request, db, current_user.id),
        headers=headers
    )

@router.get("/kg/neighbors/{entity}", response_model=KGNeighborResponse)
def get_kg_neighbors(
    entity: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """
    GET `/api/kg/neighbors/{entity}`
    Returns neighbors of the entity in the knowledge graph.
    """
    try:
        kg_manager.sync_with_db(db)
    except Exception as e:
        logger.warning(f"Failed to sync KG: {e}")
        
    neighbors_data = kg_manager.get_neighbors(entity)
    return neighbors_data

