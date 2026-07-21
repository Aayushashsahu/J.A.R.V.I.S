"""
Demo Data Seeder API

Seeds the database with realistic industrial demo data for hackathon demonstrations.
Creates equipment, maintenance records, compliance standards, failure modes, and more.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
import json
import uuid

from app.api import deps
from app.db.models import (
    User, PKMEntity, Entity, Belief, Suggestion,
    KnowledgeGraphNode, KnowledgeGraphEdge, MemoryTimelineEvent
)

router = APIRouter()

# Realistic industrial demo data
DEMO_EQUIPMENT = [
    {"value": "P-204", "category": "Equipment", "confidence": 98, "source_file": "DEMO: Steel Plant A"},
    {"value": "P-205", "category": "Equipment", "confidence": 95, "source_file": "DEMO: Steel Plant A"},
    {"value": "C-102", "category": "Equipment", "confidence": 97, "source_file": "DEMO: Oil Refinery B"},
    {"value": "E-301", "category": "Equipment", "confidence": 96, "source_file": "DEMO: Power Plant C"},
    {"value": "B-101", "category": "Equipment", "confidence": 94, "source_file": "DEMO: Chemical Plant D"},
    {"value": "T-105", "category": "Equipment", "confidence": 93, "source_file": "DEMO: Power Plant C"},
    {"value": "CV-201", "category": "Equipment", "confidence": 92, "source_file": "DEMO: Oil Refinery B"},
    {"value": "TK-301", "category": "Equipment", "confidence": 91, "source_file": "DEMO: Chemical Plant D"},
    {"value": "M-101", "category": "Equipment", "confidence": 90, "source_file": "DEMO: Steel Plant A"},
    {"value": "VLV-401", "category": "Equipment", "confidence": 89, "source_file": "DEMO: Power Plant C"},
]

DEMO_FAILURE_MODES = [
    {"value": "bearing wear", "category": "FailureMode", "confidence": 95, "source_file": "DEMO: Maintenance Log"},
    {"value": "seal leakage", "category": "FailureMode", "confidence": 93, "source_file": "DEMO: Inspection Report"},
    {"value": "excessive vibration", "category": "FailureMode", "confidence": 94, "source_file": "DEMO: Vibration Analysis"},
    {"value": "corrosion", "category": "FailureMode", "confidence": 92, "source_file": "DEMO: Inspection Report"},
    {"value": "overheating", "category": "FailureMode", "confidence": 91, "source_file": "DEMO: Temperature Monitoring"},
    {"value": "cavitation", "category": "FailureMode", "confidence": 90, "source_file": "DEMO: Pump Analysis"},
]

DEMO_REGULATIONS = [
    {"value": "OSHA 1910.119", "category": "Regulation", "confidence": 98, "source_file": "DEMO: Regulatory Database"},
    {"value": "ISO 9001", "category": "Regulation", "confidence": 97, "source_file": "DEMO: Regulatory Database"},
    {"value": "ASME PTC 25", "category": "Regulation", "confidence": 96, "source_file": "DEMO: Regulatory Database"},
    {"value": "API 570", "category": "Regulation", "confidence": 95, "source_file": "DEMO: Regulatory Database"},
    {"value": "EPA 40 CFR Part 60", "category": "Regulation", "confidence": 94, "source_file": "DEMO: Regulatory Database"},
    {"value": "ISO 14001", "category": "Regulation", "confidence": 93, "source_file": "DEMO: Regulatory Database"},
    {"value": "NFPA 30", "category": "Regulation", "confidence": 92, "source_file": "DEMO: Regulatory Database"},
]

DEMO_MAINTENANCE_EVENTS = [
    {"value": "vibration analysis", "category": "MaintenanceEvent", "confidence": 95, "source_file": "DEMO: PM Schedule"},
    {"value": "seal replacement", "category": "MaintenanceEvent", "confidence": 94, "source_file": "DEMO: Work Order"},
    {"value": "bearing replacement", "category": "MaintenanceEvent", "confidence": 93, "source_file": "DEMO: Work Order"},
    {"value": "oil analysis", "category": "MaintenanceEvent", "confidence": 92, "source_file": "DEMO: PM Schedule"},
    {"value": "hydrostatic test", "category": "MaintenanceEvent", "confidence": 91, "source_file": "DEMO: Inspection"},
]

DEMO_DEPARTMENTS = [
    {"value": "maintenance", "category": "Department", "confidence": 98, "source_file": "DEMO: Org Chart"},
    {"value": "operations", "category": "Department", "confidence": 97, "source_file": "DEMO: Org Chart"},
    {"value": "engineering", "category": "Department", "confidence": 96, "source_file": "DEMO: Org Chart"},
    {"value": "safety", "category": "Department", "confidence": 95, "source_file": "DEMO: Org Chart"},
    {"value": "quality", "category": "Department", "confidence": 94, "source_file": "DEMO: Org Chart"},
]

DEMO_RISK_LEVELS = [
    {"value": "Critical", "category": "RiskLevel", "confidence": 95, "source_file": "DEMO: Risk Assessment"},
    {"value": "High", "category": "RiskLevel", "confidence": 94, "source_file": "DEMO: Risk Assessment"},
    {"value": "Medium", "category": "RiskLevel", "confidence": 93, "source_file": "DEMO: Risk Assessment"},
]

DEMO_BELIEFS = [
    {"belief_text": "All centrifugal pumps must undergo vibration analysis every 30 days per OSHA 1910.119", "confidence": 95, "source_notes": "OSHA 1910.119, Pump P-204 inspection history"},
    {"belief_text": "Boiler startup procedure requires minimum 2-hour pre-ignition safety check per ASME PTC 25", "confidence": 92, "source_notes": "SOP-BOILER-001, ASME PTC 25"},
    {"belief_text": "Heat Exchanger E-301 tube inspection must be conducted annually per API 570", "confidence": 91, "source_notes": "API 570, E-301 maintenance log"},
    {"belief_text": "Control Valve CV-201 packing replacement must occur every 6 months per manufacturer specification", "confidence": 85, "source_notes": "MO-VALVE-042, OEM maintenance schedule"},
    {"belief_text": "Turbine T-105 vibration levels exceeding 0.5 mils peak-to-peak require immediate shutdown per ISO 10816-3", "confidence": 93, "source_notes": "ISO 10816-3, Turbine monitoring data"},
    {"belief_text": "EPA emissions reporting for Unit 3 refinery must be submitted quarterly by the 15th of the month", "confidence": 96, "source_notes": "REG-EPA-2024-001, EPA 40 CFR Part 60"},
]

DEMO_ENTITIES = [
    {"type": "Equipment", "name": "Centrifugal Pump P-204"},
    {"type": "Equipment", "name": "Reciprocating Compressor C-102"},
    {"type": "Equipment", "name": "Shell & Tube Heat Exchanger E-301"},
    {"type": "Equipment", "name": "Fire Tube Boiler B-101"},
    {"type": "Equipment", "name": "Gas Turbine T-105"},
    {"type": "Regulation", "name": "OSHA Process Safety Management"},
    {"type": "Regulation", "name": "ASME Boiler and Pressure Vessel Code"},
    {"type": "Regulation", "name": "API Piping Inspection Code"},
    {"type": "Department", "name": "Maintenance Engineering"},
    {"type": "Department", "name": "Reliability Engineering"},
    {"type": "FailureMode", "name": "Bearing Wear Failure"},
    {"type": "FailureMode", "name": "Seal Leakage Failure"},
    {"type": "MaintenanceEvent", "name": "Preventive Maintenance"},
    {"type": "MaintenanceEvent", "name": "Corrective Maintenance"},
]

DEMO_TIMELINE = [
    {"event_type": "creation", "content": "Inspection report P-204 Pump indexed"},
    {"event_type": "creation", "content": "SOP for Boiler Startup v3.2 ingested"},
    {"event_type": "modification", "content": "Maintenance log C-102 Compressor updated"},
    {"event_type": "reflection", "content": "Root Cause Analysis completed for Heat Exchanger E-301"},
    {"event_type": "modification", "content": "Compliance gap detected — OSHA 1910.119"},
    {"event_type": "creation", "content": "Work Order WO-2024-1293 created for Turbine T-105 vibration analysis"},
    {"event_type": "creation", "content": "OEM Manual MO-VALVE-042: Control Valve CV-201 maintenance guide uploaded"},
]


def _upsert_pkm(db: Session, user_id: str, item: dict) -> PKMEntity:
    """Insert or update a PKM entity."""
    value = item["value"].strip()
    existing = db.query(PKMEntity).filter(
        PKMEntity.user_id == user_id,
        func.lower(func.trim(PKMEntity.value)) == value.lower()
    ).first()
    if existing:
        existing.confidence = min(100, existing.confidence + 1)
        return existing
    pkm = PKMEntity(
        user_id=user_id,
        category=item.get("category", "Interest"),
        value=value,
        confidence=item.get("confidence", 50),
        source_file=item.get("source_file", "DEMO"),
        evidence_type="industrial_extraction",
        priority=2,
    )
    db.add(pkm)
    db.flush()
    return pkm


def _upsert_entity(db: Session, user_id: str, item: dict) -> Entity:
    """Insert or update a general entity."""
    name = item["name"].strip()
    existing = db.query(Entity).filter(
        Entity.user_id == user_id,
        func.lower(func.trim(Entity.name)) == name.lower()
    ).first()
    if existing:
        return existing
    ent = Entity(
        user_id=user_id,
        type=item.get("type", "Concept"),
        name=name,
    )
    db.add(ent)
    db.flush()
    return ent


@router.post("/seed")
def seed_demo_data(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Seed the database with realistic industrial demo data for hackathon demonstration.
    Idempotent: running multiple times only adds new records, never duplicates.
    """
    user_id = current_user.id
    stats = {"pkms": 0, "entities": 0, "beliefs": 0, "kg_nodes": 0, "kg_edges": 0, "timeline": 0}

    # 1. Seed PKM entities (equipment, failure modes, regulations, etc.)
    all_pkm_items = (
        DEMO_EQUIPMENT + DEMO_FAILURE_MODES + DEMO_REGULATIONS +
        DEMO_MAINTENANCE_EVENTS + DEMO_DEPARTMENTS + DEMO_RISK_LEVELS
    )
    pkm_nodes = []
    for item in all_pkm_items:
        pkm = _upsert_pkm(db, user_id, item)
        if pkm.id and not db.query(KnowledgeGraphNode).filter(
            KnowledgeGraphNode.user_id == user_id,
            KnowledgeGraphNode.node_type == "PKMEntity",
            KnowledgeGraphNode.node_id == pkm.id
        ).first():
            db.add(KnowledgeGraphNode(user_id=user_id, node_type="PKMEntity", node_id=pkm.id))
            pkm_nodes.append(pkm.id)
            stats["kg_nodes"] += 1
        stats["pkms"] += 1

    # 2. Seed general entities
    entity_nodes = []
    for item in DEMO_ENTITIES:
        ent = _upsert_entity(db, user_id, item)
        if ent.id and not db.query(KnowledgeGraphNode).filter(
            KnowledgeGraphNode.user_id == user_id,
            KnowledgeGraphNode.node_type == "Entity",
            KnowledgeGraphNode.node_id == ent.id
        ).first():
            db.add(KnowledgeGraphNode(user_id=user_id, node_type="Entity", node_id=ent.id))
            entity_nodes.append(ent.id)
            stats["kg_nodes"] += 1
        stats["entities"] += 1

    db.flush()

    # 3. Create KG edges between co-occurring entities
    all_nodes = pkm_nodes + entity_nodes
    edges_created = 0
    if len(all_nodes) > 1:
        for i, node_a in enumerate(all_nodes[:30]):  # Limit to prevent combinatorial explosion
            for node_b in all_nodes[i+1:min(i+5, len(all_nodes))]:  # Connect to next 4 nodes only
                existing_edge = db.query(KnowledgeGraphEdge).filter(
                    KnowledgeGraphEdge.user_id == user_id,
                    KnowledgeGraphEdge.source_node_id == node_a,
                    KnowledgeGraphEdge.target_node_id == node_b,
                ).first()
                if not existing_edge:
                    db.add(KnowledgeGraphEdge(
                        user_id=user_id,
                        source_node_id=node_a,
                        target_node_id=node_b,
                        relationship_type="co_occurring",
                    ))
                    edges_created += 1
                    stats["kg_edges"] += 1

    # 4. Seed beliefs (compliance records)
    for belief_data in DEMO_BELIEFS:
        existing = db.query(Belief).filter(
            Belief.user_id == user_id,
            Belief.belief_text == belief_data["belief_text"]
        ).first()
        if not existing:
            db.add(Belief(
                user_id=user_id,
                belief_text=belief_data["belief_text"],
                confidence=belief_data["confidence"],
                source_notes=belief_data["source_notes"],
                evidence_type="compliance",
                priority=3,
            ))
            stats["beliefs"] += 1

    # 5. Seed timeline events
    for event_data in DEMO_TIMELINE:
        db.add(MemoryTimelineEvent(
            user_id=user_id,
            event_type=event_data["event_type"],
            content=event_data["content"],
        ))
        stats["timeline"] += 1

    db.commit()

    return {
        "message": "Demo data seeded successfully",
        "stats": stats,
        "total_kg_nodes": stats["kg_nodes"],
        "total_kg_edges": stats["kg_edges"],
    }
