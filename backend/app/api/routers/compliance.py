"""
Compliance Gap Detection API

Compares extracted regulations from documents against a built-in
industrial standards database and returns identified gaps with severity ratings.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any

from app.api import deps
from app.db.models import User, PKMEntity, Belief, Document

router = APIRouter()

# Built-in industrial standards database
STANDARDS_DATABASE = {
    "OSHA 1910.119": {
        "name": "Process Safety Management",
        "category": "Process Safety",
        "requirements": [
            "Process Hazard Analysis (PHA) every 5 years",
            "Operating Procedures documentation",
            "Training program for all employees",
            "Mechanical Integrity program",
            "Management of Change (MOC) procedure",
            "Pre-Startup Safety Review (PSSR)",
            "Emergency Planning and Response",
            "Incident Investigation",
            "Compliance Audits every 3 years",
        ],
    },
    "OSHA 1910.146": {
        "name": "Permit-Required Confined Spaces",
        "category": "Worker Safety",
        "requirements": [
            "Confined space identification and labeling",
            "Entry permit system",
            "Atmospheric testing before entry",
            "Ventilation requirements",
            "Rescue team and equipment",
            "Training for authorized entrants and attendants",
        ],
    },
    "ISO 9001:2015": {
        "name": "Quality Management Systems",
        "category": "Quality",
        "requirements": [
            "Quality policy documentation",
            "Risk-based thinking approach",
            "Internal audit program",
            "Corrective action process",
            "Management review meetings",
            "Customer satisfaction monitoring",
        ],
    },
    "ISO 14001:2015": {
        "name": "Environmental Management Systems",
        "category": "Environmental",
        "requirements": [
            "Environmental policy documentation",
            "Environmental aspects and impacts register",
            "Legal compliance register",
            "Objectives and targets for improvement",
            "Operational control procedures",
            "Emergency preparedness",
        ],
    },
    "ASME PTC 25": {
        "name": "Pressure Relief Devices",
        "category": "Equipment Safety",
        "requirements": [
            "Pressure relief valve testing schedule",
            "Set pressure verification",
            "Capacity testing per ASME Section VIII",
            "Documentation of test results",
            "Recertification schedule",
        ],
    },
    "API 570": {
        "name": "Piping Inspection Code",
        "category": "Inspection",
        "requirements": [
            "Piping inspection plan",
            "External inspection frequency",
            "Thickness monitoring program",
            "Corrosion rate calculations",
            "Remaining life assessment",
        ],
    },
    "API 510": {
        "name": "Pressure Vessel Inspection Code",
        "category": "Inspection",
        "requirements": [
            "Vessel inspection plan",
            "Internal inspection intervals",
            "External inspection frequency",
            "Thickness monitoring",
            "Fitness-for-service assessment",
        ],
    },
    "NFPA 30": {
        "name": "Flammable and Combustible Liquids Code",
        "category": "Fire Safety",
        "requirements": [
            "Fire protection system design",
            "Spill containment requirements",
            "Electrical classification of areas",
            "Storage tank requirements",
            "Fire extinguishing systems",
        ],
    },
}


@router.get("/gaps")
def detect_compliance_gaps(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Detect compliance gaps by comparing extracted regulations against standards database.
    Returns a list of identified gaps with severity ratings.
    """
    # Get all regulations extracted from documents
    extracted_regulations = db.query(PKMEntity).filter(
        PKMEntity.user_id == current_user.id,
        PKMEntity.category == "Regulation",
    ).all()

    # Get all beliefs (compliance records)
    beliefs = db.query(Belief).filter(
        Belief.user_id == current_user.id,
    ).all()

    # Get all documents for context
    documents = db.query(Document).filter(
        Document.user_id == current_user.id,
    ).all()

    # Build a set of extracted regulation values for matching
    extracted_values = set()
    for reg in extracted_regulations:
        extracted_values.add(reg.value.upper().strip())

    # Also check beliefs for compliance-related content
    belief_texts = " ".join(b.belief_text.lower() for b in beliefs)
    doc_filenames = [d.filename.lower() for d in documents]

    # Check each standard against extracted data
    gaps = []
    covered = []

    for standard_id, standard_info in STANDARDS_DATABASE.items():
        standard_upper = standard_id.upper()
        
        # Check if this standard is referenced in extracted documents
        is_referenced = any(
            standard_upper in val or standard_id.lower() in val.lower()
            for val in extracted_values
        )
        
        # Also check beliefs and document filenames
        if not is_referenced:
            is_referenced = (
                standard_id.lower() in belief_texts or
                any(standard_id.lower() in fn for fn in doc_filenames)
            )

        if is_referenced:
            # Standard is referenced - check which requirements are covered
            covered_requirements = []
            missing_requirements = []
            
            for req in standard_info["requirements"]:
                req_lower = req.lower()
                # Check if this requirement is mentioned in beliefs or documents
                is_covered = (
                    req_lower in belief_texts or
                    any(req_lower in fn for fn in doc_filenames)
                )
                if is_covered:
                    covered_requirements.append(req)
                else:
                    missing_requirements.append(req)

            if missing_requirements:
                gaps.append({
                    "standard_id": standard_id,
                    "standard_name": standard_info["name"],
                    "category": standard_info["category"],
                    "severity": "high" if len(missing_requirements) > len(covered_requirements) else "medium",
                    "total_requirements": len(standard_info["requirements"]),
                    "covered_requirements": len(covered_requirements),
                    "missing_requirements": missing_requirements,
                    "missing_count": len(missing_requirements),
                    "coverage_percent": round(len(covered_requirements) / len(standard_info["requirements"]) * 100),
                })
            else:
                covered.append({
                    "standard_id": standard_id,
                    "standard_name": standard_info["name"],
                    "category": standard_info["category"],
                    "coverage_percent": 100,
                    "requirements_met": len(standard_info["requirements"]),
                })
        else:
            # Standard not referenced at all - potential gap
            gaps.append({
                "standard_id": standard_id,
                "standard_name": standard_info["name"],
                "category": standard_info["category"],
                "severity": "critical",
                "total_requirements": len(standard_info["requirements"]),
                "covered_requirements": 0,
                "missing_requirements": standard_info["requirements"],
                "missing_count": len(standard_info["requirements"]),
                "coverage_percent": 0,
            })

    # Sort gaps by severity
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    gaps.sort(key=lambda x: severity_order.get(x["severity"], 99))

    # Calculate summary stats
    critical_count = sum(1 for g in gaps if g["severity"] == "critical")
    high_count = sum(1 for g in gaps if g["severity"] == "high")
    medium_count = sum(1 for g in gaps if g["severity"] == "medium")
    total_requirements = sum(len(s["requirements"]) for s in STANDARDS_DATABASE.values())
    covered_total = sum(c["requirements_met"] for c in covered)

    return {
        "gaps": gaps,
        "covered_standards": covered,
        "summary": {
            "total_standards": len(STANDARDS_DATABASE),
            "standards_referenced": len(covered),
            "standards_not_referenced": len([g for g in gaps if g["severity"] == "critical"]),
            "critical_gaps": critical_count,
            "high_gaps": high_count,
            "medium_gaps": medium_count,
            "total_requirements": total_requirements,
            "requirements_covered": covered_total,
            "overall_compliance_percent": round(covered_total / total_requirements * 100) if total_requirements > 0 else 0,
        },
    }


@router.get("/standards")
def list_standards():
    """List all available industrial standards in the database."""
    standards = []
    for standard_id, info in STANDARDS_DATABASE.items():
        standards.append({
            "id": standard_id,
            "name": info["name"],
            "category": info["category"],
            "requirements_count": len(info["requirements"]),
        })
    return {"standards": standards}
