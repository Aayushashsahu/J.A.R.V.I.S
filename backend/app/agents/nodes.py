import os
import logging
import json
from typing import List, Dict, Any
from app.agents.service import (
    agent_llm_service,
    get_deterministic_planner_fallback,
    get_deterministic_retriever_fallback,
    get_deterministic_formatter_fallback
)

logger = logging.getLogger(__name__)

def retrieve_rag_documents(workspace_id: str, query: str) -> List[Dict[str, Any]]:
    """Retrieve safety documents matching the query using the central retriever."""
    results = []
    
    # Skip real RAG if no valid Gemini API key is configured (avoids hanging on retries with mock key)
    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    if not gemini_key or gemini_key in ("", "mock-gemini-key"):
        logger.info("No valid Gemini API key found. Using deterministic fallback data.")
        return get_deterministic_retriever_fallback(query)
    
    try:
        from app.services.retriever import retriever
        
        # Call the existing RAG/chat retriever
        chunks = retriever.retrieve(
            query=query,
            workspace_id=workspace_id,
            top_k=5
        )

        for chunk in chunks:
            results.append({
                "source": chunk.source,
                "content": chunk.text,
                "confidence": chunk.score
            })
    except Exception as e:
        logger.warning(f"RAG central retrieval failed: {e}. Falling back to default mock data.")
    
    # If no results were retrieved, fallback to deterministic mock chunks so the endpoint works
    if not results:
        results = get_deterministic_retriever_fallback(query)
        
    return results

def planner_node(state: Dict[str, Any]) -> Dict[str, Any]:
    goal = state["goal"]
    max_steps = state.get("max_steps", 6)
    logger.info(f"Executing planner node for goal: {goal}")
    
    system_prompt = (
        "You are the Lead Planning Agent.\n"
        "Your task is to break the user's goal into a step-by-step checklist of tasks (between 3 and 6 steps).\n"
        "Respond ONLY with a valid JSON array of strings representing the steps. Do not include markdown headers or other text.\n"
        "Example output:\n"
        '["Identify OISD-118 requirements", "Identify PESO requirements", "Compare similarities", "Verify citations", "Format answer"]'
    )
    prompt = f"Goal: {goal}\nMax steps allowed: {max_steps}"
    
    steps = []
    content = ""
    try:
        res = agent_llm_service.call_llm(prompt=prompt, system_prompt=system_prompt)
        # Parse the JSON response
        # Clean up any potential markdown wrapping
        clean_res = res.strip("```json").strip("```").strip()
        steps = json.loads(clean_res)
        if not isinstance(steps, list):
            steps = []
        # Restrict to max steps
        steps = steps[:max_steps]
        content = "\n".join(f"- {s}" for s in steps)
    except Exception as e:
        logger.warning(f"Planner LLM call or parsing failed: {e}. Using deterministic fallback.")
        steps = get_deterministic_planner_fallback(goal)[:max_steps]
        content = "\n".join(f"- {s}" for s in steps)

    trace_event = {
        "event": "trace",
        "step": 1,
        "node": "planner",
        "content": f"Steps planned:\n{content}"
    }
    
    return {
        "steps": steps,
        "trace": state.get("trace", []) + [trace_event]
    }

def retriever_node(state: Dict[str, Any]) -> Dict[str, Any]:
    workspace_id = state["workspace_id"]
    goal = state["goal"]
    logger.info(f"Executing retriever node for goal: {goal}")
    
    # Check if this goal represents a comparison or complex topic
    is_complex = any(keyword in goal.lower() for keyword in ["vs", "compare", "comparison", "difference", "and", "or"])
    
    sub_questions = []
    findings = []
    
    if is_complex:
        logger.info("Complex goal detected. Triggering multi-agent researcher flow.")
        # Attempt to split into 3 sub-questions using LLM
        system_prompt = (
            "You are the Research Lead Agent.\n"
            "Your task is to break down a complex industrial safety goal/comparison into exactly 3 sub-questions:\n"
            "1. A question about the first standard or source (e.g., OISD).\n"
            "2. A question about the second standard or source (e.g., PESO).\n"
            "3. A question comparing both standards on the specific topic.\n"
            "Respond ONLY with a valid JSON list of 3 strings. Do not include extra text.\n"
            'Example:\n["What does OISD-118 say about LPG setback?", "What does PESO say about LPG setback?", "Compare OISD-118 vs PESO setback requirements"]'
        )
        prompt = f"Goal: {goal}"
        try:
            res = agent_llm_service.call_llm(prompt=prompt, system_prompt=system_prompt)
            clean_res = res.strip("```json").strip("```").strip()
            sub_questions = json.loads(clean_res)
            if not isinstance(sub_questions, list) or len(sub_questions) != 3:
                raise ValueError("Did not return exactly 3 questions")
        except Exception as e:
            logger.warning(f"Failed to generate sub-questions via LLM: {e}. Using deterministic templates.")
            # Deterministic fallback sub-questions
            sub_questions = [
                f"What are the OISD-118 requirements for {goal}?",
                f"What are the PESO requirements for {goal}?",
                f"Compare OISD-118 vs PESO requirements for {goal}"
            ]
            
        logger.info(f"Generated sub-questions: {sub_questions}")
        
        # Retrieve answers for each sub-question
        for q in sub_questions:
            sub_findings = retrieve_rag_documents(workspace_id, q)
            for f in sub_findings:
                f["sub_question"] = q
            findings.extend(sub_findings)
    else:
        # Single agent retrieve
        findings = retrieve_rag_documents(workspace_id, goal)
        
    # Deduplicate findings based on source and content
    seen = set()
    dedup_findings = []
    for f in findings:
        key = (f.get("source", ""), f.get("content", ""))
        if key not in seen:
            seen.add(key)
            dedup_findings.append(f)
            
    # Extract unique source names
    sources = list(set(f["source"] for f in dedup_findings if f.get("source")))
    
    content = ""
    if sub_questions:
        content = "Multi-agent split into sub-questions:\n" + "\n".join(f"{i+1}. {q}" for i, q in enumerate(sub_questions))
    else:
        content = f"Single-agent retrieval query: {goal}"
        
    trace_event = {
        "event": "trace",
        "step": 2,
        "node": "retriever",
        "sources": len(sources),
        "content": content
    }
    
    return {
        "findings": dedup_findings,
        "sources": sources,
        "trace": state.get("trace", []) + [trace_event]
    }

def verifier_node(state: Dict[str, Any]) -> Dict[str, Any]:
    findings = state.get("findings", [])
    logger.info("Executing verifier node")
    
    # Checks:
    # 1. Does the answer have sources?
    # 2. Are citations present?
    # 3. Is confidence available?
    # 4. Warnings if no citations
    
    has_sources = len(findings) > 0
    citations_present = any(f.get("source") is not None for f in findings)
    
    confidence_sum = sum(f.get("confidence", 0.8) for f in findings)
    avg_confidence = confidence_sum / len(findings) if findings else 0.8
    
    warnings = []
    if not citations_present:
        warnings.append("Needs citation support")
        
    verification = {
        "has_sources": has_sources,
        "citations_present": citations_present,
        "confidence": avg_confidence,
        "warnings": warnings
    }
    
    warn_text = f" Warnings: {warnings}" if warnings else ""
    trace_event = {
        "event": "trace",
        "step": 3,
        "node": "verifier",
        "content": f"Citations verified: {'Yes' if citations_present else 'No'}. Avg Confidence: {round(avg_confidence, 2)}.{warn_text}"
    }
    
    return {
        "verification": verification,
        "trace": state.get("trace", []) + [trace_event]
    }

def formatter_node(state: Dict[str, Any]) -> Dict[str, Any]:
    goal = state["goal"]
    findings = state.get("findings", [])
    verification = state.get("verification", {})
    run_id = state["agent_run_id"]
    logger.info("Executing formatter node")
    
    system_prompt = (
        "You are the Formatter Agent.\n"
        "Your task is to write a clean inspectorial response based on the retrieved findings.\n"
        "Rules:\n"
        "1. Write a direct answer addressing the goal.\n"
        "2. If the user is comparing two safety standards (e.g. OISD-118 vs PESO), ALWAYS include a clean markdown comparison table.\n"
        "3. Incorporate citations clearly (e.g. referencing OISD-118 or PESO clauses).\n"
        "4. Keep the tone professional, objective, and inspectorial.\n"
        "Do not include final source list at the bottom since the system appends it automatically."
    )
    
    prompt = (
        f"Goal: {goal}\n\n"
        f"Findings:\n{json.dumps(findings, indent=2)}\n\n"
        f"Verification:\n{json.dumps(verification, indent=2)}"
    )
    
    final_answer = ""
    try:
        final_answer = agent_llm_service.call_llm(prompt=prompt, system_prompt=system_prompt)
    except Exception as e:
        logger.warning(f"Formatter LLM call failed: {e}. Using deterministic fallback.")
        final_answer = get_deterministic_formatter_fallback(goal, findings)
        
    sources = list(set(f["source"] for f in findings if f.get("source")))
    confidence = verification.get("confidence", 0.8)
    
    trace_event = {
        "event": "final",
        "answer": final_answer,
        "sources": sources,
        "agent_run_id": run_id
    }
    
    return {
        "final_answer": final_answer,
        "sources": sources,
        "confidence": confidence,
        "trace": state.get("trace", []) + [trace_event]
    }
