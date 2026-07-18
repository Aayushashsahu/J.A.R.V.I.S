from pydantic import BaseModel, Field
from typing import List, Optional

class AgentOrchestrateRequest(BaseModel):
    workspace_id: str = Field(..., min_length=1, description="Workspace ID is required and cannot be empty")
    goal: str = Field(..., min_length=1, description="Goal is required and cannot be empty")
    max_steps: int = Field(default=6, le=6, description="Max steps defaults to 6 and cannot exceed 6")

class AgentTraceEvent(BaseModel):
    event: str = "trace"
    step: int
    node: str
    content: Optional[str] = None
    sources: Optional[int] = None

class AgentFinalEvent(BaseModel):
    event: str = "final"
    answer: str
    sources: List[str]
    agent_run_id: str

class NeighborEdge(BaseModel):
    source: str
    target: str
    weight: float

class KGNeighborResponse(BaseModel):
    entity: str
    neighbors: List[NeighborEdge]
