"""
Industrial Entity Extraction Service

Detects and extracts industrial-specific entities from document text:
- Equipment IDs (P-204, C-102, E-301, B-101)
- Failure Modes (leakage, vibration, corrosion, overheating)
- Regulations (OSHA, EPA, ISO, ASME, TEMA, PESO, OISD)
- Maintenance Events (inspection, repair, replacement, overhaul)
- Risk Levels (critical, high, medium, low)
- Departments (maintenance, operations, engineering, safety)
- Compliance Standards (OSHA 1910.119, ISO 9001, ASME PTC)
"""

import re
import logging
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class IndustrialEntity:
    """Represents an extracted industrial entity."""
    entity_type: str       # "equipment_id", "failure_mode", "regulation", etc.
    value: str             # The extracted value
    confidence: float      # 0.0 to 1.0
    context: str           # Surrounding text for context
    source: Optional[str] = None


# ── Equipment ID Patterns ──────────────────────────────────────────────
# Industrial equipment follows naming conventions like P-204, C-102, E-301, B-101
EQUIPMENT_PATTERNS = [
    # Pumps: P-XXX, PU-XXX, PMP-XXX
    r'\b(?:P|PU|PMP)[-]?\d{2,4}\b',
    # Compressors: C-XXX, CMP-XXX, COMP-XXX
    r'\b(?:C|CMP|COMP)[-]?\d{2,4}\b',
    # Heat Exchangers: E-XXX, HEX-XXX, HX-XXX
    r'\b(?:E|HEX|HX)[-]?\d{2,4}\b',
    # Boilers: B-XXX, BLR-XXX
    r'\b(?:B|BLR)[-]?\d{2,4}\b',
    # Turbines: T-XXX, TB-XXX, TRB-XXX
    r'\b(?:T|TB|TRB)[-]?\d{2,4}\b',
    # Vessels: V-XXX, VES-XXX
    r'\b(?:V|VES)[-]?\d{2,4}\b',
    # Tanks: TK-XXX, TNK-XXX
    r'\b(?:TK|TNK)[-]?\d{2,4}\b',
    # Filters: F-XXX, FLT-XXX
    r'\b(?:F|FLT)[-]?\d{2,4}\b',
    # Motors: M-XXX, MOT-XXX
    r'\b(?:M|MOT)[-]?\d{2,4}\b',
    # Valves: VLV-XXX, VL-XXX
    r'\b(?:VLV|VL)[-]?\d{2,4}\b',
    # Reactors: R-XXX, RX-XXX
    r'\b(?:R|RX)[-]?\d{2,4}\b',
    # Columns: COL-XXX, CL-XXX
    r'\b(?:COL|CL)[-]?\d{2,4}\b',
    # Furnaces: FUR-XXX, FN-XXX
    r'\b(?:FUR|FN)[-]?\d{2,4}\b',
    # Generators: G-XXX, GEN-XXX
    r'\b(?:G|GEN)[-]?\d{2,4}\b',
    # Transformers: XFMR-XXX, TR-XXX
    r'\b(?:XFMR|TR)[-]?\d{2,4}\b',
]

# ── Failure Mode Patterns ──────────────────────────────────────────────
FAILURE_MODES = [
    "leakage", "leak", "leaking",
    "vibration", "excessive vibration",
    "corrosion", "corroded", "rust",
    "overheating", "overheat", "thermal",
    "mechanical failure", "structural failure",
    "fatigue", "stress fracture", "crack", "cracking",
    "seal failure", "gasket failure",
    "bearing failure", "bearing wear",
    "impeller damage", "blade damage",
    "fouling", "scaling", "deposit",
    "erosion", "erosive wear",
    "cavitation",
    "misalignment", "misaligned",
    "lubrication failure", "lack of lubrication",
    "electrical failure", "short circuit",
    "pressure drop", "flow restriction",
    "blockage", "plugging",
    "spill", "spillage", "release",
    "trip", "shutdown", "emergency stop",
    "loss of containment",
    "tube failure", "tube leak",
    "distillation tray damage",
    "catalyst deactivation",
    "instrument drift", "calibration error",
]

# ── Regulation / Standard Patterns ─────────────────────────────────────
REGULATIONS = [
    # OSHA
    r'OSHA\s*(?:\d{4})?(?:\.\d{3}(?:\.\d{2})?)?',
    r'29\s*CFR\s*(?:1910|1926|1915)',
    # EPA
    r'EPA\s*(?:\d{4})?',
    r'Clean\s*Air\s*Act',
    r'Clean\s*Water\s*Act',
    r'RCRA',
    r'CERCLA',
    r'TSCA',
    # ISO
    r'ISO\s*\d{4,5}(?::\d{4})?',
    r'ISO\s*14001',
    r'ISO\s*9001',
    r'ISO\s*45001',
    # ASME
    r'ASME\s*(?:BPVC|PTC|B31| Boiler)',
    r'ASME\s*Section\s*(?:I|II|V|VIII|IX)',
    r'ASME\s*B31\.\d',
    # TEMA
    r'TEMA\s*(?:\d{4})?',
    r'TEMA\s*(?:Class\s*[ABC])',
    # API
    r'API\s*\d{3,4}[A-Z]?',
    r'API\s*650',
    r'API\s*653',
    r'API\s*570',
    r'API\s*510',
    # PESO
    r'PESO\s*(?:\d{3,4})?',
    r'Petroleum\s*Explosives\s*Safety\s*Organisation',
    # OISD
    r'OISD\s*-?\s*\d{2,4}',
    r'Oil\s*Industry\s*Safety\s*Directorate',
    # Factory Act
    r'Factory\s*Act\s*\d{4}',
    # NFPA
    r'NFPA\s*\d{2,3}',
    # IEC
    r'IEC\s*\d{4,5}',
    # BIS
    r'BIS\s*(?:IS\s*)?\d{4,5}',
    # NACE
    r'NACE\s*(?:MR\d{4}|\d{3})',
]

# ── Maintenance Event Patterns ─────────────────────────────────────────
MAINTENANCE_EVENTS = [
    "inspection", "inspected", "inspection report",
    "maintenance", "preventive maintenance", "predictive maintenance",
    "corrective maintenance", "emergency maintenance",
    "repair", "repaired", "repair log",
    "replacement", "replaced", "replacement record",
    "overhaul", "overhauled", "major overhaul",
    "calibration", "calibrated", "calibration record",
    "testing", "tested", "test report",
    "commissioning", "commissioned",
    "decommissioning", "decommissioned",
    "turnaround", "shutdown", "startup",
    "work order", "work request",
    "safety check", "safety audit",
    "performance test", "performance monitoring",
    "vibration analysis", "oil analysis", "thermography",
    "ultrasonic testing", "radiographic testing",
    "hydrostatic test", "pressure test",
]

# ── Risk Level Patterns ────────────────────────────────────────────────
RISK_LEVELS = [
    "critical", "catastrophic",
    "high", "serious", "severe",
    "medium", "moderate", "moderate",
    "low", "minor", "negligible",
    "immediate", "urgent",
    "acceptable", "unacceptable",
]

# ── Department Patterns ────────────────────────────────────────────────
DEPARTMENTS = [
    "maintenance", "maintenance department",
    "operations", "operations department",
    "engineering", "engineering department",
    "safety", "safety department", "HSE",
    "quality", "quality assurance", "QA", "QC",
    "production", "production department",
    "reliability", "reliability engineering",
    "instrumentation", "I&E",
    "electrical", "E&I",
    "mechanical", "mechanical department",
    "process", "process engineering",
    "project", "project management",
    "procurement", "supply chain",
    "planning", "planning department",
]


class IndustrialEntityExtractor:
    """Extracts industrial entities from document text."""

    def extract_all(self, text: str, filename: Optional[str] = None) -> Dict[str, List[Dict]]:
        """Extract all industrial entities from text.

        Returns a dict with keys: equipment_ids, failure_modes, regulations,
        maintenance_events, risk_levels, departments.
        """
        results = {
            "equipment_ids": self._extract_equipment_ids(text),
            "failure_modes": self._extract_failure_modes(text),
            "regulations": self._extract_regulations(text),
            "maintenance_events": self._extract_maintenance_events(text),
            "risk_levels": self._extract_risk_levels(text),
            "departments": self._extract_departments(text),
        }

        # Log extraction results
        total = sum(len(v) for v in results.values())
        logger.info(
            f"[IndustrialExtractor] Extracted {total} entities from "
            f"'{filename or 'unknown'}': "
            f"{', '.join(f'{k}={len(v)}' for k, v in results.items() if v)}"
        )

        return results

    def extract_for_kg(self, text: str, filename: Optional[str] = None) -> List[Dict]:
        """Extract entities formatted for Knowledge Graph insertion.

        Returns a list of dicts with keys: type, name, category, confidence.
        """
        all_entities = self.extract_all(text, filename)
        kg_entities = []

        # Equipment IDs → Entity type="Equipment"
        for eq in all_entities["equipment_ids"]:
            kg_entities.append({
                "type": "Equipment",
                "name": eq["value"],
                "category": "Equipment",
                "confidence": eq["confidence"],
            })

        # Failure Modes → PKMEntity category="FailureMode"
        for fm in all_entities["failure_modes"]:
            kg_entities.append({
                "type": "FailureMode",
                "name": fm["value"],
                "category": "FailureMode",
                "confidence": fm["confidence"],
            })

        # Regulations → Entity type="Regulation"
        for reg in all_entities["regulations"]:
            kg_entities.append({
                "type": "Regulation",
                "name": reg["value"],
                "category": "Regulation",
                "confidence": reg["confidence"],
            })

        # Maintenance Events → PKMEntity category="MaintenanceEvent"
        for me in all_entities["maintenance_events"]:
            kg_entities.append({
                "type": "MaintenanceEvent",
                "name": me["value"],
                "category": "MaintenanceEvent",
                "confidence": me["confidence"],
            })

        # Risk Levels → PKMEntity category="RiskLevel"
        for rl in all_entities["risk_levels"]:
            kg_entities.append({
                "type": "RiskLevel",
                "name": rl["value"],
                "category": "RiskLevel",
                "confidence": rl["confidence"],
            })

        # Departments → Entity type="Department"
        for dept in all_entities["departments"]:
            kg_entities.append({
                "type": "Department",
                "name": dept["value"],
                "category": "Department",
                "confidence": dept["confidence"],
            })

        return kg_entities

    def extract_for_pkm(self, text: str, filename: Optional[str] = None) -> List[Dict]:
        """Extract entities formatted for PKMEntity insertion.

        Returns a list of dicts with keys: category, value, confidence, source_file.
        """
        all_entities = self.extract_all(text, filename)
        pkm_entities = []

        for eq in all_entities["equipment_ids"]:
            pkm_entities.append({
                "category": "Equipment",
                "value": eq["value"],
                "confidence": int(eq["confidence"] * 100),
                "source_file": filename,
            })

        for fm in all_entities["failure_modes"]:
            pkm_entities.append({
                "category": "FailureMode",
                "value": fm["value"],
                "confidence": int(fm["confidence"] * 100),
                "source_file": filename,
            })

        for reg in all_entities["regulations"]:
            pkm_entities.append({
                "category": "Regulation",
                "value": reg["value"],
                "confidence": int(reg["confidence"] * 100),
                "source_file": filename,
            })

        for me in all_entities["maintenance_events"]:
            pkm_entities.append({
                "category": "MaintenanceEvent",
                "value": me["value"],
                "confidence": int(me["confidence"] * 100),
                "source_file": filename,
            })

        for rl in all_entities["risk_levels"]:
            pkm_entities.append({
                "category": "RiskLevel",
                "value": rl["value"],
                "confidence": int(rl["confidence"] * 100),
                "source_file": filename,
            })

        for dept in all_entities["departments"]:
            pkm_entities.append({
                "category": "Department",
                "value": dept["value"],
                "confidence": int(dept["confidence"] * 100),
                "source_file": filename,
            })

        return pkm_entities

    def _extract_equipment_ids(self, text: str) -> List[Dict]:
        """Extract equipment IDs from text."""
        found = []
        seen = set()
        for pattern in EQUIPMENT_PATTERNS:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                value = match.group().strip()
                if value.lower() not in seen:
                    seen.add(value.lower())
                    # Get context (50 chars before and after)
                    start = max(0, match.start() - 50)
                    end = min(len(text), match.end() + 50)
                    context = text[start:end].replace('\n', ' ').strip()
                    found.append({
                        "value": value,
                        "confidence": 0.95,
                        "context": context,
                    })
        return found

    def _extract_failure_modes(self, text: str) -> List[Dict]:
        """Extract failure modes from text."""
        found = []
        seen = set()
        text_lower = text.lower()
        for fm in FAILURE_MODES:
            if fm.lower() in text_lower:
                if fm.lower() not in seen:
                    seen.add(fm.lower())
                    # Find the first occurrence for context
                    idx = text_lower.find(fm.lower())
                    start = max(0, idx - 50)
                    end = min(len(text), idx + len(fm) + 50)
                    context = text[start:end].replace('\n', ' ').strip()
                    found.append({
                        "value": fm,
                        "confidence": 0.90,
                        "context": context,
                    })
        return found

    def _extract_regulations(self, text: str) -> List[Dict]:
        """Extract regulations and standards from text."""
        found = []
        seen = set()
        for pattern in REGULATIONS:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                value = match.group().strip()
                if value.lower() not in seen:
                    seen.add(value.lower())
                    start = max(0, match.start() - 50)
                    end = min(len(text), match.end() + 50)
                    context = text[start:end].replace('\n', ' ').strip()
                    found.append({
                        "value": value,
                        "confidence": 0.92,
                        "context": context,
                    })
        return found

    def _extract_maintenance_events(self, text: str) -> List[Dict]:
        """Extract maintenance events from text."""
        found = []
        seen = set()
        text_lower = text.lower()
        for me in MAINTENANCE_EVENTS:
            if me.lower() in text_lower:
                if me.lower() not in seen:
                    seen.add(me.lower())
                    idx = text_lower.find(me.lower())
                    start = max(0, idx - 50)
                    end = min(len(text), idx + len(me) + 50)
                    context = text[start:end].replace('\n', ' ').strip()
                    found.append({
                        "value": me,
                        "confidence": 0.88,
                        "context": context,
                    })
        return found

    def _extract_risk_levels(self, text: str) -> List[Dict]:
        """Extract risk levels from text."""
        found = []
        seen = set()
        text_lower = text.lower()
        for rl in RISK_LEVELS:
            # Match as standalone word or in phrases like "risk level: high"
            pattern = rf'\b(?:risk\s+level\s*[:=]?\s*)?{re.escape(rl)}\b'
            for match in re.finditer(pattern, text_lower):
                value = match.group().strip()
                if value.lower() not in seen:
                    seen.add(value.lower())
                    start = max(0, match.start() - 50)
                    end = min(len(text), match.end() + 50)
                    context = text[start:end].replace('\n', ' ').strip()
                    found.append({
                        "value": rl.capitalize(),
                        "confidence": 0.85,
                        "context": context,
                    })
                    break  # Only first match per risk level
        return found

    def _extract_departments(self, text: str) -> List[Dict]:
        """Extract departments from text."""
        found = []
        seen = set()
        text_lower = text.lower()
        for dept in DEPARTMENTS:
            if dept.lower() in text_lower:
                if dept.lower() not in seen:
                    seen.add(dept.lower())
                    idx = text_lower.find(dept.lower())
                    start = max(0, idx - 50)
                    end = min(len(text), idx + len(dept) + 50)
                    context = text[start:end].replace('\n', ' ').strip()
                    found.append({
                        "value": dept,
                        "confidence": 0.87,
                        "context": context,
                    })
        return found


# Singleton instance
industrial_extractor = IndustrialEntityExtractor()
