"""
Neural Connections API — AI-Powered Autonomous Knowledge Discovery

This is the "killer feature" for hackathon demos. Instead of passive note storage,
the system proactively discovers hidden connections between documents and entities,
generating an interactive "Neural Map" of the user's knowledge base.

How it works:
1. Scans all PKM entities and general entities for the user
2. Uses LLM to discover semantic relationships between them
3. Auto-creates knowledge graph edges for discovered connections
4. Returns a rich graph visualization data structure
5. Generates "Insight Digests" — proactive syntheses of connected themes
"""

import json
import logging
import time
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.api import deps
from app.db.models import (
    User, PKMEntity, Entity, KnowledgeGraphNode, KnowledgeGraphEdge,
    Document, Suggestion, MemoryTimelineEvent
)
from app.db.session import get_db
from app.services.llm_provider import llm_provider

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/neural/connections")
def discover_connections(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """
    Discover hidden semantic connections between all entities in the knowledge base.
    Returns an interactive graph with AI-discovered relationships.
    """
    # Get all entities
    pkm_entities = db.query(PKMEntity).filter(PKMEntity.user_id == current_user.id).all()
    general_entities = db.query(Entity).filter(Entity.user_id == current_user.id).all()
    
    if not pkm_entities and not general_entities:
        return {
            "nodes": [],
            "edges": [],
            "insights": [],
            "message": "Upload documents to discover neural connections"
        }
    
    # Build entity list for LLM
    entity_descriptions = []
    for pkm in pkm_entities:
        entity_descriptions.append(f"- [{pkm.category}] {pkm.value} (confidence: {pkm.confidence}%)")
    for ent in general_entities:
        entity_descriptions.append(f"- [{ent.type}] {ent.name}")
    
    entities_text = "\n".join(entity_descriptions)
    
    # Use LLM to discover connections
    try:
        prompt = f"""
Given these entities from a personal knowledge base, discover hidden semantic connections between them.
For each connection found, provide:
- source entity name
- target entity name  
- relationship type (e.g. "enables", "requires", "contradicts", "supports", "part_of", "related_to")
- strength (1-100)
- insight (brief explanation of the connection)

Also generate 2-3 "insight digests" — proactive syntheses that connect multiple entities into actionable observations.

Entities:
{entities_text}

Return ONLY valid JSON:
{{
  "connections": [
    {{"source": "...", "target": "...", "relationship": "...", "strength": 80, "insight": "..."}}
  ],
  "insights": [
    {{"title": "...", "summary": "...", "entities_involved": ["..."], "action": "..."}}
  ]
}}
"""
        response = llm_provider.generate_text(prompt, "You are J.A.R.V.I.S., an AI knowledge orchestrator.")
        clean = response.replace("```json", "").replace("```", "").strip()
        data = json.loads(clean)
        
        connections = data.get("connections", [])
        insights = data.get("insights", [])
        
        # Auto-create graph edges for discovered connections
        new_edges = 0
        for conn in connections:
            source_name = conn.get("source", "")
            target_name = conn.get("target", "")
            
            # Find source and target nodes
            source_node = None
            target_node = None
            
            for pkm in pkm_entities:
                if pkm.value.lower() == source_name.lower():
                    nodes = db.query(KnowledgeGraphNode).filter(
                        KnowledgeGraphNode.user_id == current_user.id,
                        KnowledgeGraphNode.node_type == "PKMEntity",
                        KnowledgeGraphNode.node_id == pkm.id
                    ).first()
                    if nodes: source_node = nodes
                if pkm.value.lower() == target_name.lower():
                    nodes = db.query(KnowledgeGraphNode).filter(
                        KnowledgeGraphNode.user_id == current_user.id,
                        KnowledgeGraphNode.node_type == "PKMEntity",
                        KnowledgeGraphNode.node_id == pkm.id
                    ).first()
                    if nodes: target_node = nodes
            
            for ent in general_entities:
                if ent.name.lower() == source_name.lower():
                    nodes = db.query(KnowledgeGraphNode).filter(
                        KnowledgeGraphNode.user_id == current_user.id,
                        KnowledgeGraphNode.node_type == "Entity",
                        KnowledgeGraphNode.node_id == ent.id
                    ).first()
                    if nodes: source_node = nodes
                if ent.name.lower() == target_name.lower():
                    nodes = db.query(KnowledgeGraphNode).filter(
                        KnowledgeGraphNode.user_id == current_user.id,
                        KnowledgeGraphNode.node_type == "Entity",
                        KnowledgeGraphNode.node_id == ent.id
                    ).first()
                    if nodes: target_node = nodes
            
            if source_node and target_node:
                existing_edge = db.query(KnowledgeGraphEdge).filter(
                    KnowledgeGraphEdge.user_id == current_user.id,
                    KnowledgeGraphEdge.source_node_id == source_node.id,
                    KnowledgeGraphEdge.target_node_id == target_node.id
                ).first()
                
                if not existing_edge:
                    db.add(KnowledgeGraphEdge(
                        user_id=current_user.id,
                        source_node_id=source_node.id,
                        target_node_id=target_node.id,
                        relationship_type=conn.get("relationship", "related_to")
                    ))
                    new_edges += 1
        
        db.commit()
        logger.info(f"Neural connections: discovered {len(connections)} connections, created {new_edges} new edges")
        
        # Build graph data for frontend visualization
        all_nodes = db.query(KnowledgeGraphNode).filter(KnowledgeGraphNode.user_id == current_user.id).all()
        all_edges = db.query(KnowledgeGraphEdge).filter(KnowledgeGraphEdge.user_id == current_user.id).all()
        
        nodes_data = []
        for node in all_nodes:
            label = "Unknown"
            if node.node_type == "PKMEntity":
                pkm = db.query(PKMEntity).filter(PKMEntity.id == node.node_id).first()
                if pkm: label = f"{pkm.category}: {pkm.value}"
            elif node.node_type == "Entity":
                ent = db.query(Entity).filter(Entity.id == node.node_id).first()
                if ent: label = f"{ent.type}: {ent.name}"
            nodes_data.append({
                "id": node.id,
                "label": label,
                "type": node.node_type,
                "size": 10 if node.node_type == "PKMEntity" else 7
            })
        
        edges_data = []
        for edge in all_edges:
            edges_data.append({
                "source": edge.source_node_id,
                "target": edge.target_node_id,
                "label": edge.relationship_type,
                "strength": 50
            })
        
        # Store insights as suggestions
        for insight in insights:
            sug_content = json.dumps({
                "title": insight.get("title", ""),
                "summary": insight.get("summary", ""),
                "entities_involved": insight.get("entities_involved", []),
                "action": insight.get("action", ""),
                "timestamp": time.strftime('%Y-%m-%d %H:%M:%S')
            })
            existing_sug = db.query(Suggestion).filter(
                Suggestion.user_id == current_user.id,
                Suggestion.suggestion_type == "neural_insight",
                Suggestion.content == sug_content
            ).first()
            if not existing_sug:
                db.add(Suggestion(
                    user_id=current_user.id,
                    suggestion_type="neural_insight",
                    content=sug_content,
                    confidence=85,
                    status="pending"
                ))
        
        # Create timeline event
        db.add(MemoryTimelineEvent(
            user_id=current_user.id,
            workspace_id=None,
            event_type="synthesis",
            content=f"Neural discovery: {len(connections)} connections found, {new_edges} new edges created, {len(insights)} insights generated"
        ))
        db.commit()
        
        return {
            "nodes": nodes_data,
            "edges": edges_data,
            "connections": connections,
            "insights": insights,
            "stats": {
                "total_nodes": len(nodes_data),
                "total_edges": len(edges_data),
                "new_edges_created": new_edges,
                "insights_generated": len(insights)
            }
        }
        
    except Exception as e:
        logger.error(f"Neural connection discovery failed: {e}")
        return {
            "nodes": [],
            "edges": [],
            "connections": [],
            "insights": [],
            "error": str(e)
        }


@router.get("/neural/synthesize")
def synthesize_knowledge(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """
    Generate an AI-powered synthesis of all knowledge in the system.
    """
    pkm_entities = db.query(PKMEntity).filter(PKMEntity.user_id == current_user.id).all()
    general_entities = db.query(Entity).filter(Entity.user_id == current_user.id).all()
    documents = db.query(Document).filter(Document.user_id == current_user.id).all()
    
    entity_list = []
    for p in pkm_entities:
        entity_list.append(f"{p.category}: {p.value} (confidence: {p.confidence}%)")
    for e in general_entities:
        entity_list.append(f"{e.type}: {e.name}")
    doc_list = [d.filename for d in documents]
    
    prompt = f"""
You are J.A.R.V.I.S., an advanced AI knowledge synthesizer.
Given this knowledge base, generate a comprehensive Insight Digest.
Documents: {', '.join(doc_list[:20])}
Entities: {'; '.join(entity_list[:30])}
Return ONLY valid JSON:
{{"title": "Knowledge Synthesis Digest", "themes": [{{"name": "...", "description": "..."}}], "actions": [{{"action": "...", "why": "...", "priority": "high"}}], "gaps": [{{"topic": "...", "why_needed": "..."}}]}}
"""
    
    try:
        response = llm_provider.generate_text(prompt, "You are J.A.R.V.I.S.")
        clean = response.replace("```json", "").replace("```", "").strip()
        digest = json.loads(clean)
        
        from app.db.models import Memory
        db.add(Memory(
            user_id=current_user.id,
            workspace_id=None,
            title=f"Knowledge Digest: {time.strftime('%Y-%m-%d %H:%M')}",
            content=json.dumps(digest, indent=2),
            type="synthesis",
            source_file="neural_synthesizer",
            evidence_type="ai_synthesis",
            priority=5
        ))
        db.commit()
        return digest
    except Exception as e:
        logger.error(f"Knowledge synthesis failed: {e}")
        return {"error": str(e)}
