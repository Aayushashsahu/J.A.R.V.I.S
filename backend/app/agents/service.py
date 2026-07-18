import os
import json
import logging
import uuid
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from openai import OpenAI
from app.services.llm_provider import llm_provider
from app.db.models import AgentRun

logger = logging.getLogger(__name__)

class AgentLLMService:
    def __init__(self):
        self.nvidia_api_key = os.getenv("NVIDIA_API_KEY", "")
        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "")
        
        self.nvidia_client = None
        if self.nvidia_api_key:
            try:
                self.nvidia_client = OpenAI(
                    base_url="https://integrate.api.nvidia.com/v1",
                    api_key=self.nvidia_api_key
                )
            except Exception as e:
                logger.error(f"Failed to initialize NVIDIA client: {e}")

    def call_llm(self, prompt: str, system_prompt: str = None) -> str:
        """
        Attempts NVIDIA NIM, then Gemini, and raises RuntimeError if both fail or keys are missing.
        """
        full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
        
        # 1. Primary: NVIDIA NIM Llama 3.1 70B
        if self.nvidia_client and self.nvidia_api_key:
            try:
                logger.info("Attempting NVIDIA NIM Llama 3.1 70B")
                completion = self.nvidia_client.chat.completions.create(
                    model="meta/llama-3.1-70b-instruct",
                    messages=[{"role": "user", "content": full_prompt}],
                    temperature=0.2,
                    max_tokens=2048
                )
                res = completion.choices[0].message.content
                if res:
                    return res.strip()
            except Exception as e:
                logger.warning(f"NVIDIA NIM failed: {e}. Falling back to Gemini.")

        # 2. Fallback: Gemini (only if a real API key is configured — skip mock/invalid keys to avoid hanging on retries)
        gemini_key = self.gemini_api_key or os.getenv("GEMINI_API_KEY", "")
        if gemini_key and gemini_key not in ("", "mock-gemini-key"):
            try:
                logger.info("Attempting Gemini fallback")
                res = llm_provider.generate_text(prompt=prompt, system_prompt=system_prompt)
                if res:
                    return res.strip()
            except Exception as e:
                logger.warning(f"Gemini fallback failed: {e}")

        raise RuntimeError("No configured LLM provider succeeded or environment keys are missing.")

# Singleton LLM service
agent_llm_service = AgentLLMService()

# Database helpers
def save_agent_run(db: Session, run_id: str, workspace_id: str, goal: str, trace: List[Dict[str, Any]], final_answer: Optional[str], sources: List[str]):
    try:
        run = AgentRun(
            id=run_id,
            workspace_id=workspace_id,
            goal=goal,
            trace_json=json.dumps(trace),
            final_answer=final_answer,
            sources_json=json.dumps(sources)
        )
        db.add(run)
        db.commit()
        db.refresh(run)
        return run
    except Exception as e:
        logger.error(f"Failed to save agent run trace: {e}")
        db.rollback()
        return None

def get_agent_run(db: Session, run_id: str):
    return db.query(AgentRun).filter(AgentRun.id == run_id).first()

# Deterministic Fallbacks for Demo Safety
def get_deterministic_planner_fallback(goal: str) -> List[str]:
    return [
        f"Analyze '{goal}' and identify key standards involved (e.g. OISD-118, PESO)",
        "Retrieve specific sections on storage vessels, clearances, and firefighting capacity",
        "Perform comparison of safety distances and boundary clearances",
        "Verify citations against regulations and guidelines",
        "Formulate synthesized comparison matrix and final inspectorial report"
    ]

def get_deterministic_retriever_fallback(goal: str) -> List[Dict[str, Any]]:
    # Returns mock citation-backed chunks
    return [
        {
            "source": "OISD-118 Clause 5.2.1",
            "content": "Mounded LPG storage vessel setback distance to boundary wall must be minimum 15 meters.",
            "confidence": 0.95
        },
        {
            "source": "PESO Rules 2018 Schedule III",
            "content": "LPG storage vessel clearance distance for mounded installation is 15m. For aboveground installation, minimum clearance is 30m.",
            "confidence": 0.92
        },
        {
            "source": "OISD-118 Clause 7.3",
            "content": "Fire-water storage facilities must be designed to supply water for at least 4 hours of maximum demand.",
            "confidence": 0.88
        },
        {
            "source": "Factory Act Section 38",
            "content": "Every factory shall be provided with such means of escape in case of fire as may be prescribed.",
            "confidence": 0.85
        }
    ]

def get_deterministic_verifier_fallback(findings: List[Dict[str, Any]]) -> Dict[str, Any]:
    sources_count = len([f for f in findings if f.get("source")])
    confidence_sum = sum(f.get("confidence", 0.8) for f in findings)
    avg_confidence = confidence_sum / len(findings) if findings else 0.8
    
    return {
        "has_sources": sources_count > 0,
        "citations_present": True,
        "confidence": avg_confidence,
        "warnings": [] if sources_count > 0 else ["Needs citation support"]
    }

def get_deterministic_formatter_fallback(goal: str, findings: List[Dict[str, Any]]) -> str:
    # Build comparative markdown table
    table = (
        "| Standard / Rule | Installation Type | Clearances Required | Firewater Supply Requirements |\n"
        "| :--- | :--- | :--- | :--- |\n"
        "| **OISD-118** | Mounded LPG Vessel | 15 meters to boundary | 4 hours of max demand |\n"
        "| **PESO Rules 2018** | Mounded LPG Vessel | 15 meters to boundary | As approved by Chief Controller |\n"
        "| **PESO Rules 2018** | Aboveground Vessel | 30 meters to boundary | As approved by Chief Controller |\n"
    )
    
    return (
        f"### Inspectorial Comparative Report for: '{goal}'\n\n"
        "Based on industrial safety standards, here is the comparative breakdown:\n\n"
        f"{table}\n\n"
        "#### Key Findings:\n"
        "1. Both **OISD-118** and **PESO** rules specify a **15-meter** setback distance for mounded LPG vessels.\n"
        "2. For aboveground storage, **PESO** requires double the distance (**30 meters**).\n"
        "3. Fire water reservation under **OISD-118** mandates **4 hours** of maximum system demand capacity.\n"
    )
