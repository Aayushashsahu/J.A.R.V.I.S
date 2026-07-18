import sys
import os
import json
import asyncio
from pydantic import ValidationError

# Set up backend directory import
sys.path.append(os.path.dirname(__file__))

# Setup mock environmental vars for testing if not present
os.environ.setdefault("GEMINI_API_KEY", "mock-gemini-key")
os.environ.setdefault("DATABASE_URL", "sqlite:///test.db")

from app.agents.schemas import AgentOrchestrateRequest
from app.agents.graph import agent_graph
from app.agents.kg import kg_manager

def test_schemas():
    print("Testing Pydantic Schemas...")
    # Test valid request
    req = AgentOrchestrateRequest(workspace_id="demo", goal="Compare OISD vs PESO", max_steps=4)
    assert req.workspace_id == "demo"
    assert req.max_steps == 4
    
    # Test defaults
    req2 = AgentOrchestrateRequest(workspace_id="demo", goal="test")
    assert req2.max_steps == 6
    
    # Test validation error (empty goal)
    try:
        AgentOrchestrateRequest(workspace_id="demo", goal="")
        assert False, "Should have failed empty goal validation"
    except ValidationError as e:
        print("Success: Caught empty goal validation error.")

    # Test validation error (max_steps > 6)
    try:
        AgentOrchestrateRequest(workspace_id="demo", goal="test", max_steps=7)
        assert False, "Should have failed max_steps > 6 validation"
    except ValidationError as e:
        print("Success: Caught max_steps > 6 validation error.")

async def test_langgraph():
    print("\nTesting LangGraph Execution...")
    initial_state = {
        "workspace_id": "demo",
        "goal": "Compare OISD-118 vs PESO for LPG storage",
        "max_steps": 6,
        "steps": [],
        "findings": [],
        "sources": [],
        "verification": {},
        "final_answer": "",
        "confidence": 0.0,
        "agent_run_id": "test-run-123",
        "trace": []
    }
    
    print("Running LangGraph workflow...")
    async for event in agent_graph.astream(initial_state):
        node_name = list(event.keys())[0]
        state_updates = event[node_name]
        print(f"-> Executed node: {node_name}")
        if "trace" in state_updates:
            print(f"   Latest trace event: {state_updates['trace'][-1]}")
            
    print("LangGraph run completed successfully.")

def test_knowledge_graph():
    print("\nTesting NetworkX Knowledge Graph...")
    # Fetch neighbors for OISD-118
    res = kg_manager.get_neighbors("OISD-118")
    print(f"Neighbors for OISD-118: {json.dumps(res, indent=2)}")
    assert res["entity"] == "OISD-118"
    assert len(res["neighbors"]) > 0
    
    # Verify that PESO is a neighbor
    neighbor_names = [n["source"] for n in res["neighbors"]]
    print(f"Found neighbors: {neighbor_names}")
    assert "PESO" in neighbor_names
    
    # Verify weight of PESO <-> OISD-118 is 0.81
    peso_edge = next(n for n in res["neighbors"] if n["source"] == "PESO")
    print(f"PESO edge details: {peso_edge}")
    assert peso_edge["weight"] == 0.81
    print("Success: NetworkX knowledge graph operations verified.")

if __name__ == "__main__":
    test_schemas()
    test_knowledge_graph()
    asyncio.run(test_langgraph())
    print("\nAll agent module tests passed!")
