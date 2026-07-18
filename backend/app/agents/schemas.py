from pydantic import BaseModel, Field
from typing import List, Optional, Union

class AgentOrchestrateRequest(BaseModel):
    """Payload model for launching an agent run."""
    workspace_id: str = Field(..., min_length=1, description="Workspace ID is required and cannot be empty")
    goal: str = Field(..., min_length=1, description="Goal is required and cannot be empty")
    max_steps: int = Field(default=6, le=6, description="Max steps defaults to 6 and cannot exceed 6")

class AgentTraceEvent(BaseModel):
    """Execution step event yielded during LangGraph processing streams."""
    event: str = "trace"
    step: int
    node: str
    content: Optional[str] = None
    sources: Optional[int] = None

class AgentFinalEvent(BaseModel):
    """Final answer returned to the client at the end of the streaming response."""
    event: str = "final"
    answer: str
    sources: List[str]
    agent_run_id: str

class NeighborEdge(BaseModel):
    """A direct relational edge connection in the knowledge graph."""
    source: str
    target: str
    weight: float

class KGNeighborResponse(BaseModel):
    """Neighbors list matching the requested concept query."""
    entity: str
    neighbors: List[NeighborEdge]

