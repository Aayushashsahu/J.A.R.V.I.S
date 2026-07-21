from typing import TypedDict, List, Dict, Any, Optional
from langgraph.graph import StateGraph, END
from app.agents.nodes import planner_node, retriever_node, verifier_node, formatter_node, rca_node
from app.agents.service import is_rca_query


class AgentState(TypedDict):
    workspace_id: str
    goal: str
    max_steps: int
    steps: List[str]
    findings: List[Dict[str, Any]]
    sources: List[str]
    verification: Dict[str, Any]
    final_answer: str
    confidence: Optional[float]
    agent_run_id: str
    trace: List[Dict[str, Any]]


def route_after_retriever(state: Dict[str, Any]) -> str:
    """Route to RCA node if the query is RCA-related, otherwise to verifier."""
    goal = state.get("goal", "")
    if is_rca_query(goal):
        return "rca"
    return "verifier"


# Define the StateGraph
workflow = StateGraph(AgentState)

# Add all nodes
workflow.add_node("planner", planner_node)
workflow.add_node("retriever", retriever_node)
workflow.add_node("rca", rca_node)
workflow.add_node("verifier", verifier_node)
workflow.add_node("formatter", formatter_node)

# Set the linear execution path
workflow.set_entry_point("planner")
workflow.add_edge("planner", "retriever")

# Conditional edge: RCA queries go to rca node, others go to verifier
workflow.add_conditional_edges(
    "retriever",
    route_after_retriever,
    {
        "rca": "rca",
        "verifier": "verifier",
    }
)

# RCA node goes directly to END (it generates the final answer)
workflow.add_edge("rca", END)

# Standard path: verifier → formatter → END
workflow.add_edge("verifier", "formatter")
workflow.add_edge("formatter", END)

# Compile the graph
agent_graph = workflow.compile()
