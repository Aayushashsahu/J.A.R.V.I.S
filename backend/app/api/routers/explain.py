import logging
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from app.api import deps
from app.db.models import User, Workspace, PKMEntity, Belief, Memory
from app.services.retriever import retriever

router = APIRouter()
logger = logging.getLogger(__name__)

class EvidenceItem(BaseModel):
    source_file: str
    snippet: str
    confidence: int

class ExplainResponse(BaseModel):
    claim: str
    evidence: List[EvidenceItem]

@router.get("/memory/explain", response_model=ExplainResponse)
async def explain_memory(
    query: str = Query(...),
    workspace_id: Optional[str] = Query(None),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """Provide an explainability trace of claims backed by the evidence hierarchy."""
    evidence_list = []
    
    # Priority 1: Search source documents (via Retriever)
    if workspace_id:
        # Verify workspace ownership
        workspace = db.query(Workspace).filter(
            Workspace.id == workspace_id,
            Workspace.user_id == current_user.id
        ).first()
        if not workspace:
            logger.warning(f"Unauthorized explanation query: User {current_user.id} requested workspace {workspace_id}")
            raise HTTPException(status_code=404, detail="Workspace not found")

        try:
            chunks = retriever.retrieve(query=query, workspace_id=workspace_id, top_k=3)
            for chunk in chunks:
                evidence_list.append(EvidenceItem(
                    source_file=chunk.source,
                    snippet=chunk.text,
                    confidence=int(chunk.score * 100),
                ))
        except Exception as e:
            logger.error(f"Retriever search during explain failed: {e}")

    # Priority 1.5: GBrain Synthesis
    from app.services.mcp_client import gbrain_client
    try:
        gbrain_synthesis = await gbrain_client.search(query)
        if gbrain_synthesis and not gbrain_synthesis.startswith("Error:"):
            evidence_list.append(EvidenceItem(
                source_file="GBrain Vault",
                snippet=gbrain_synthesis[:500] + "..." if len(gbrain_synthesis) > 500 else gbrain_synthesis,
                confidence=95  # High confidence for synthesized brain memory
            ))
    except Exception as e:
        logger.warning(f"GBrain synthesis during explain failed: {e}")

    # Priority 2: Structured Memory (PKM Entities)
    entities = db.query(PKMEntity).filter(
        PKMEntity.user_id == current_user.id,
        PKMEntity.value.ilike(f"%{query}%")
    ).limit(3).all()
    for e in entities:
        evidence_list.append(EvidenceItem(
            source_file=e.source_file or "System",
            snippet=f"[{e.category}] {e.value}",
            confidence=e.confidence
        ))

    # Priority 3: Beliefs
    beliefs = db.query(Belief).filter(
        Belief.user_id == current_user.id,
        Belief.belief_text.ilike(f"%{query}%")
    ).limit(3).all()
    for b in beliefs:
        evidence_list.append(EvidenceItem(
            source_file=b.source_notes or "System",
            snippet=b.belief_text,
            confidence=b.confidence
        ))

    # Determine Claim
    claim = f"Findings related to: '{query}'"
    if evidence_list:
        claim = f"Found {len(evidence_list)} pieces of evidence for '{query}'"
    else:
        claim = f"No direct evidence found for '{query}'"

    logger.info(f"Generated explanation for '{query}' with {len(evidence_list)} evidence nodes.")
    return ExplainResponse(
        claim=claim,
        evidence=evidence_list
    )

