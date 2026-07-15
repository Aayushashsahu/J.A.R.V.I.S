import logging
import asyncio
import json
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.db.models import QueuedTask, Belief, Suggestion, Document, Memory, Workspace
from app.services.llm_provider import llm_provider
import time

logger = logging.getLogger(__name__)

async def run_reflection_engine():
    logger.info("Reflection Engine Started")
    while True:
        db = SessionLocal()
        try:
            # Pick up "generate_reflection" tasks
            tasks = db.query(QueuedTask).filter(QueuedTask.status == "pending", QueuedTask.task_type == "generate_reflection").limit(5).all()
            for task in tasks:
                try:
                    payload = json.loads(task.payload)
                    workspace_id = payload.get("workspace_id")
                    source_file = payload.get("source_file", "Unknown Source")
                    document_id = payload.get("document_id")
                    
                    if not workspace_id:
                        ws = db.query(Workspace).filter(Workspace.user_id == task.user_id).first()
                        workspace_id = ws.id if ws else "default"

                    prompt = f"""
                    Analyze recent memories and entities to form a high-level reflection about the user.
                    
                    BELIEF QUALITY FILTER:
                    Identify 'high_impact_beliefs' (like primary projects, career goals, life priorities).
                    You MUST reject generic beliefs (e.g. "Innovation matters", "Technology drives growth").
                    A belief MUST be:
                    1. Specific
                    2. Actionable
                    3. Unique to the founder
                    4. Supported by evidence (the source file)
                    
                    REFLECTION SAFETY RULE:
                    Reflections are LOWER TRUST INFORMATION.
                    Reflections may identify patterns, suggest questions, or suggest hypotheses.
                    Reflections may NOT create facts, override facts, or replace facts.
                    
                    DAILY REFLECTION:
                    Provide an activity_summary of what was focused on.
                    Generate a 'thought_provoking_question' based on the pattern of activity to encourage founder reflection (e.g., "Most activity focused on memory infrastructure. Is this aligned with MVP validation goals?").
                    
                    The source of this trigger is the file: {source_file}.
                    Return ONLY valid JSON in this format:
                    {{
                        "activity_summary": "Octiq AI dominated activity. AI agents appeared in 27 notes.",
                        "thought_provoking_question": "Is your infrastructure work distracting from MVP launch?",
                        "high_impact_beliefs": [
                            {{
                                "belief": "The founder optimizes for leverage rather than scale.",
                                "confidence": 94
                            }}
                        ]
                    }}
                    """
                    response = llm_provider.generate_text(prompt, "You are J.A.R.V.I.S., an AI reflection engine.")
                    clean_resp = response.replace("```json", "").replace("```", "").strip()
                    data = json.loads(clean_resp)
                    
                    # Store reflection as Memory
                    content = f"Activity Summary:\n{data.get('activity_summary')}\n\nQuestion for Founder:\n{data.get('thought_provoking_question')}"
                    new_memory = Memory(
                        user_id=task.user_id,
                        workspace_id=workspace_id,
                        title=f"Reflection {time.strftime('%Y-%m-%d %H:%M')}",
                        content=content,
                        type="reflection",
                        source_file=source_file,
                        evidence_type="reflection",
                        priority=4
                    )
                    db.add(new_memory)
                    
                    # Store beliefs as Suggestions (Safety)
                    for b in data.get("high_impact_beliefs", []):
                        sug_content = json.dumps({
                            "belief": b.get("belief"),
                            "confidence": b.get("confidence"),
                            "source_file": source_file,
                            "timestamp": time.strftime('%Y-%m-%d %H:%M:%S')
                        })
                        sug = Suggestion(
                            user_id=task.user_id,
                            target_id=document_id,
                            suggestion_type="new_belief",
                            content=sug_content,
                            confidence=b.get("confidence", 80),
                            status="pending"
                        )
                        db.add(sug)
                        
                    task.status = "completed"
                    db.commit()
                except Exception as e:
                    logger.error(f"Reflection task failed: {e}")
                    task.status = "failed"
                    db.commit()
        finally:
            db.close()
            
        await asyncio.sleep(5) # Run every 5 seconds
