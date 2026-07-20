"""
Seed realistic industrial demo data for the J.A.R.V.I.S. Industrial Knowledge Intelligence Platform.

Run with: cd backend && python seed_industrial_data.py

This populates:
- Timeline events (document ingestion, inspections, maintenance)
- Beliefs/Compliance records (safety procedures, regulatory standards)
- Suggestions/Recommendations (maintenance actions, compliance fixes)
- Neural connections (equipment-maintenance-failure relationships)
- PKM entities (equipment IDs, failure modes, regulations)
- Knowledge graph nodes and edges
"""

import json
import uuid
import sys
import os

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime, timedelta, timezone
from app.db.session import engine, SessionLocal, Base
from app.db.models import (
    User, Workspace, MemoryTimelineEvent, Belief, Suggestion,
    PKMEntity, Entity, KnowledgeGraphNode, KnowledgeGraphEdge
)


def generate_uuid():
    return str(uuid.uuid4())


def seed_data():
    """Seed industrial demo data for all users."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Find or create demo users
        users = db.query(User).all()
        if not users:
            print("No users found. Creating demo user...")
            from app.core.security import get_password_hash
            demo_user = User(
                id=generate_uuid(),
                email="demo@industrial.com",
                hashed_password=get_password_hash("demo1234")
            )
            db.add(demo_user)
            db.commit()
            db.refresh(demo_user)
            users = [demo_user]

        for user in users:
            print(f"Seeding data for user: {user.email}")
            seed_timeline_events(db, user.id)
            seed_beliefs(db, user.id)
            seed_suggestions(db, user.id)
            seed_pkm_entities(db, user.id)
            seed_knowledge_graph(db, user.id)
            db.commit()
            print(f"  [OK] Data seeded for {user.email}")

        print("\n=== Industrial demo data seeded successfully! ===")
        print("   - 15+ timeline events")
        print("   - 8 compliance/belief records")
        print("   - 6 recommendations")
        print("   - 20+ PKM entities")
        print("   - 12 knowledge graph nodes + edges")

    except Exception as e:
        db.rollback()
        print(f"ERROR seeding data: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


def seed_timeline_events(db, user_id):
    """Seed realistic industrial timeline events."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    events = [
        # Today
        {"event_type": "creation", "content": "Inspection report IR-2024-0847 for Pump P-204 indexed", "hours_ago": 1},
        {"event_type": "creation", "content": "SOP-BOILER-001: Boiler Startup Procedure v3.2 ingested", "hours_ago": 3},
        {"event_type": "modification", "content": "Maintenance log ML-C102-034 updated — Compressor C-102 bearing replacement", "hours_ago": 5},

        # This week
        {"event_type": "reflection", "content": "Root Cause Analysis completed for Heat Exchanger E-301 tube failure", "days_ago": 1},
        {"event_type": "modification", "content": "Compliance gap detected — OSHA 1910.119 Process Safety Management", "days_ago": 2},
        {"event_type": "creation", "content": "Work Order WO-2024-1293 created for Turbine T-105 vibration analysis", "days_ago": 2},
        {"event_type": "creation", "content": "OEM Manual MO-VALVE-042: Control Valve CV-201 maintenance guide uploaded", "days_ago": 3},
        {"event_type": "modification", "content": "Incident Report IR-2024-0839: Minor leak at Flange F-302 resolved", "days_ago": 3},
        {"event_type": "creation", "content": "Quality Document QD-MS-012: Material Safety Data Sheet for lubricant LUB-445", "days_ago": 4},
        {"event_type": "creation", "content": "P&ID Diagram PID-REF-003: Refinery Unit 3 process flow updated", "days_ago": 5},

        # Older
        {"event_type": "modification", "content": "Annual maintenance schedule AM-2024 for all compressors reviewed", "days_ago": 10},
        {"event_type": "reflection", "content": "Failure pattern analysis: recurring bearing failures on centrifugal pumps", "days_ago": 12},
        {"event_type": "creation", "content": "Regulatory document REG-EPA-2024-001: EPA emissions reporting requirements", "days_ago": 15},
        {"event_type": "creation", "content": "Training record TR-HEAT-EXCHANGER: Heat exchanger inspection certification", "days_ago": 20},
        {"event_type": "modification", "content": "Knowledge graph updated: 47 new equipment-maintenance relationships added", "days_ago": 25},
    ]

    for evt in events:
        if "hours_ago" in evt:
            delta = timedelta(hours=evt["hours_ago"])
        else:
            delta = timedelta(days=evt["days_ago"])
        event = MemoryTimelineEvent(
            id=generate_uuid(),
            user_id=user_id,
            workspace_id=None,
            event_type=evt["event_type"],
            content=evt["content"],
            created_at=now - delta
        )
        db.add(event)

    print("  ✓ 15 timeline events seeded")


def seed_beliefs(db, user_id):
    """Seed compliance and SOP beliefs."""
    beliefs = [
        {
            "belief_text": "All centrifugal pumps must undergo vibration analysis every 30 days per OSHA 1910.119",
            "confidence": 95,
            "source_notes": "OSHA 1910.119, Pump P-204 inspection history",
            "evidence_type": "compliance_standard"
        },
        {
            "belief_text": "Boiler startup procedure requires minimum 2-hour pre-ignition safety check per ASME PTC 25",
            "confidence": 92,
            "source_notes": "SOP-BOILER-001, ASME PTC 25",
            "evidence_type": "sop_reference"
        },
        {
            "belief_text": "Compressor C-102 bearing replacement interval should be reduced from 8000 to 6000 operating hours based on failure data",
            "confidence": 88,
            "source_notes": "ML-C102-034, failure analysis report",
            "evidence_type": "maintenance_analysis"
        },
        {
            "belief_text": "Heat Exchanger E-301 requires annual tube inspection to prevent process fluid contamination",
            "confidence": 90,
            "source_notes": "RCA-E301, TEMA standards",
            "evidence_type": "compliance_standard"
        },
        {
            "belief_text": "Control Valve CV-201 packing replacement must occur every 6 months per manufacturer specification",
            "confidence": 85,
            "source_notes": "MO-VALVE-042, OEM maintenance schedule",
            "evidence_type": "oem_manual"
        },
        {
            "belief_text": "Turbine T-105 vibration levels exceeding 0.5 mils peak-to-peak require immediate shutdown",
            "confidence": 93,
            "source_notes": "ISO 10816-3, Turbine monitoring data",
            "evidence_type": "compliance_standard"
        },
        {
            "belief_text": "Flange connections in high-pressure systems must be re-torqued after initial 24-hour settling period",
            "confidence": 87,
            "source_notes": "ASME PCC-1, IR-2024-0839",
            "evidence_type": "compliance_standard"
        },
        {
            "belief_text": "EPA emissions reporting for Unit 3 refinery must be submitted quarterly by the 15th of the month",
            "confidence": 96,
            "source_notes": "REG-EPA-2024-001, EPA 40 CFR Part 60",
            "evidence_type": "regulatory_requirement"
        },
    ]

    for b in beliefs:
        belief = Belief(
            id=generate_uuid(),
            user_id=user_id,
            belief_text=b["belief_text"],
            confidence=b["confidence"],
            source_notes=b["source_notes"],
            evidence_type=b["evidence_type"],
            priority=3
        )
        db.add(belief)

    print("  [OK] 8 compliance/belief records seeded")


def seed_suggestions(db, user_id):
    """Seed maintenance and compliance recommendations."""
    suggestions = [
        {
            "suggestion_type": "maintenance_action",
            "content": json.dumps({
                "title": "Scheduled Maintenance: Compressor C-102",
                "recommendation": "Replace bearings on Compressor C-102 within next 500 operating hours. Failure probability increases significantly after 5500 hours based on historical data.",
                "priority": "high",
                "equipment": "C-102",
                "deadline": "2024-02-15",
                "evidence": ["ML-C102-034: Bearing replacement at 5200 hours", "Failure analysis showing 73% failure rate after 5500 hours"]
            }),
            "confidence": 88
        },
        {
            "suggestion_type": "compliance_gap",
            "content": json.dumps({
                "title": "OSHA Compliance Gap: Process Safety Management",
                "recommendation": "Three PSM elements require documentation updates: Management of Change (MOC) records for Unit 3 are 45 days overdue.",
                "priority": "critical",
                "standard": "OSHA 1910.119",
                "deadline": "2024-01-31",
                "evidence": ["MOC-2024-007 pending approval", "Last PSM audit flagged documentation gaps"]
            }),
            "confidence": 92
        },
        {
            "suggestion_type": "document_upload",
            "content": json.dumps({
                "title": "Missing Document: Pump P-204 OEM Manual",
                "recommendation": "Upload the OEM maintenance manual for Pump P-204 to enable automated compliance checking against manufacturer specifications.",
                "priority": "medium",
                "document_type": "OEM Manual",
                "equipment": "P-204",
                "evidence": ["No OEM manual found for P-204", "Manufacturer: Flowserve Corporation"]
            }),
            "confidence": 75
        },
        {
            "suggestion_type": "maintenance_action",
            "content": json.dumps({
                "title": "Preventive Maintenance: Heat Exchanger E-301",
                "recommendation": "Schedule tube inspection for Heat Exchanger E-301. Last inspection was 340 days ago. Annual inspection required per TEMA standards.",
                "priority": "high",
                "equipment": "E-301",
                "deadline": "2024-02-28",
                "evidence": ["Last inspection: IR-E301-2023-001", "TEMA Class R requires annual inspection"]
            }),
            "confidence": 90
        },
        {
            "suggestion_type": "compliance_gap",
            "content": json.dumps({
                "title": "Emissions Report Due: Unit 3 Refinery",
                "recommendation": "Quarterly EPA emissions report for Unit 3 is due by January 15th. Current data shows incomplete readings for NOx sensors on Stack S-301.",
                "priority": "high",
                "standard": "EPA 40 CFR Part 60",
                "deadline": "2024-01-15",
                "evidence": ["NOx sensor S-301-NOX offline since Dec 28", "Q4 2023 report template generated but incomplete"]
            }),
            "confidence": 94
        },
        {
            "suggestion_type": "knowledge_gap",
            "content": json.dumps({
                "title": "Knowledge Gap: Turbine T-105 Vibration Baseline",
                "recommendation": "No baseline vibration profile exists for Turbine T-105. Create baseline from current healthy state readings to enable predictive maintenance alerts.",
                "priority": "medium",
                "equipment": "T-105",
                "evidence": ["Current vibration: 0.3 mils (healthy)", "No historical baseline in system"]
            }),
            "confidence": 80
        },
    ]

    for s in suggestions:
        suggestion = Suggestion(
            id=generate_uuid(),
            user_id=user_id,
            suggestion_type=s["suggestion_type"],
            content=s["content"],
            confidence=s["confidence"],
            status="pending"
        )
        db.add(suggestion)

    print("  [OK] 6 recommendations seeded")


def seed_pkm_entities(db, user_id):
    """Seed PKM entities (equipment IDs, failure modes, regulations)."""
    entities = [
        # Equipment
        {"category": "Equipment", "value": "P-204 Centrifugal Pump", "confidence": 95},
        {"category": "Equipment", "value": "C-102 Screw Compressor", "confidence": 95},
        {"category": "Equipment", "value": "E-301 Shell & Tube Heat Exchanger", "confidence": 90},
        {"category": "Equipment", "value": "B-101 Industrial Boiler", "confidence": 95},
        {"category": "Equipment", "value": "T-105 Gas Turbine", "confidence": 90},
        {"category": "Equipment", "value": "CV-201 Control Valve", "confidence": 88},

        # Failure Modes
        {"category": "FailureMode", "value": "Bearing Wear", "confidence": 92},
        {"category": "FailureMode", "value": "Tube Fouling", "confidence": 85},
        {"category": "FailureMode", "value": "Seal Leakage", "confidence": 88},
        {"category": "FailureMode", "value": "Vibration Excess", "confidence": 90},

        # Regulations
        {"category": "Regulation", "value": "OSHA 1910.119 Process Safety Management", "confidence": 95},
        {"category": "Regulation", "value": "EPA 40 CFR Part 60 Emissions Standards", "confidence": 93},
        {"category": "Regulation", "value": "ASME PTC 25 Performance Test Code", "confidence": 88},
        {"category": "Regulation", "value": "ISO 10816-3 Mechanical Vibration", "confidence": 90},
        {"category": "Regulation", "value": "TEMA Standards Heat Exchangers", "confidence": 87},

        # Plants
        {"category": "Plant", "value": "Steel Plant A — Hot Rolling Mill", "confidence": 95},
        {"category": "Plant", "value": "Oil Refinery B — Unit 3 Distillation", "confidence": 93},
        {"category": "Plant", "value": "Power Plant C — Gas Turbine Generator", "confidence": 90},

        # Maintenance Events
        {"category": "MaintenanceEvent", "value": "Bearing Replacement C-102 — 2024-01-12", "confidence": 95},
        {"category": "MaintenanceEvent", "value": "Tube Cleaning E-301 — 2023-03-15", "confidence": 85},
    ]

    for e in entities:
        pkm = PKMEntity(
            id=generate_uuid(),
            user_id=user_id,
            category=e["category"],
            value=e["value"],
            confidence=e["confidence"],
            source_file=f"demo_seed_{e['category'].lower()}",
            evidence_type="structured_memory",
            priority=2
        )
        db.add(pkm)

    # Also create general Entity records
    general_entities = [
        {"type": "Equipment", "name": "Pump P-204"},
        {"type": "Equipment", "name": "Compressor C-102"},
        {"type": "Equipment", "name": "Heat Exchanger E-301"},
        {"type": "Equipment", "name": "Boiler B-101"},
        {"type": "Person", "name": "John Martinez — Maintenance Lead"},
        {"type": "Person", "name": "Sarah Chen — Reliability Engineer"},
        {"type": "Department", "name": "Maintenance Department"},
        {"type": "Department", "name": "Process Engineering"},
        {"type": "Plant", "name": "Unit 3 Distillation"},
    ]

    for e in general_entities:
        ent = Entity(
            id=generate_uuid(),
            user_id=user_id,
            type=e["type"],
            name=e["name"]
        )
        db.add(ent)

    print("  [OK] 20 PKM entities + 9 general entities seeded")


def seed_knowledge_graph(db, user_id):
    """Seed knowledge graph nodes and edges."""
    # First, get the PKM entities and general entities we just created
    pkm_entities = db.query(PKMEntity).filter(PKMEntity.user_id == user_id).all()
    general_entities = db.query(Entity).filter(Entity.user_id == user_id).all()

    nodes = []
    edges = []

    # Create nodes for each PKM entity
    for pkm in pkm_entities:
        node = KnowledgeGraphNode(
            id=generate_uuid(),
            user_id=user_id,
            node_type="PKMEntity",
            node_id=pkm.id
        )
        db.add(node)
        nodes.append(node)

    # Create nodes for general entities
    for ent in general_entities:
        node = KnowledgeGraphNode(
            id=generate_uuid(),
            user_id=user_id,
            node_type="Entity",
            node_id=ent.id
        )
        db.add(node)
        nodes.append(node)

    db.flush()  # Ensure node IDs are available

    # Create edges between related nodes
    # Equipment -> Failure Mode relationships
    equipment_nodes = [n for n in nodes if n.node_type == "PKMEntity"]
    failure_nodes = [n for n in nodes if n.node_type == "PKMEntity"]

    edge_definitions = [
        # Equipment -> Failure Mode
        ("P-204 Centrifugal Pump", "Bearing Wear", "exhibits"),
        ("C-102 Screw Compressor", "Bearing Wear", "exhibits"),
        ("E-301 Shell & Tube Heat Exchanger", "Tube Fouling", "exhibits"),
        ("P-204 Centrifugal Pump", "Seal Leakage", "exhibits"),
        ("T-105 Gas Turbine", "Vibration Excess", "exhibits"),

        # Equipment -> Regulation
        ("P-204 Centrifugal Pump", "OSHA 1910.119 Process Safety Management", "governed_by"),
        ("B-101 Industrial Boiler", "ASME PTC 25 Performance Test Code", "governed_by"),
        ("E-301 Shell & Tube Heat Exchanger", "TEMA Standards Heat Exchangers", "governed_by"),
        ("T-105 Gas Turbine", "ISO 10816-3 Mechanical Vibration", "governed_by"),

        # Equipment -> Plant
        ("P-204 Centrifugal Pump", "Steel Plant A — Hot Rolling Mill", "located_in"),
        ("C-102 Screw Compressor", "Oil Refinery B — Unit 3 Distillation", "located_in"),
        ("E-301 Shell & Tube Heat Exchanger", "Oil Refinery B — Unit 3 Distillation", "located_in"),
        ("T-105 Gas Turbine", "Power Plant C — Gas Turbine Generator", "located_in"),

        # Equipment -> Maintenance
        ("C-102 Screw Compressor", "Bearing Replacement C-102 — 2024-01-12", "maintained_by"),
        ("E-301 Shell & Tube Heat Exchanger", "Tube Cleaning E-301 — 2023-03-15", "maintained_by"),
    ]

    # Build a lookup from PKM value to node
    pkm_node_map = {}
    for node in nodes:
        if node.node_type == "PKMEntity":
            pkm = db.query(PKMEntity).filter(PKMEntity.id == node.node_id).first()
            if pkm:
                pkm_node_map[pkm.value] = node

    for src_val, tgt_val, rel_type in edge_definitions:
        src_node = pkm_node_map.get(src_val)
        tgt_node = pkm_node_map.get(tgt_val)
        if src_node and tgt_node:
            edge = KnowledgeGraphEdge(
                id=generate_uuid(),
                user_id=user_id,
                source_node_id=src_node.id,
                target_node_id=tgt_node.id,
                relationship_type=rel_type
            )
            db.add(edge)
            edges.append(edge)

    print(f"  [OK] {len(nodes)} knowledge graph nodes + {len(edges)} edges seeded")


if __name__ == "__main__":
    seed_data()
