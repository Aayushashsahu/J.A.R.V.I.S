from typing import TypedDict, List, Dict, Any, Optional
from langgraph.graph import StateGraph, END
from app.agents.nodes import planner_node, retriever_node, verifier_node, formatter_node

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

# Define the StateGraph
workflow = StateGraph(AgentState)

# Add all nodes
workflow.add_node("planner", planner_node)
workflow.add_node("retriever", retriever_node)
workflow.add_node("verifier", verifier_node)
workflow.add_node("formatter", formatter_node)

# Set the linear execution path
workflow.set_entry_point("planner")
workflow.add_edge("planner", "retriever")
workflow.add_edge("retriever", "verifier")
workflow.add_edge("verifier", "formatter")
workflow.add_edge("formatter", END)

# Compile the graph
agent_graph = workflow.compile()
