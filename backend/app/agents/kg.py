import logging
import networkx as nx
from sqlalchemy.orm import Session
import re
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class KnowledgeGraphManager:
    """Manages the in-memory NetworkX Knowledge Graph and synchronization logic."""

    def __init__(self):
        self.graph = nx.Graph()
        self.common_terms = [
            "OISD-118", "PESO", "LPG", "Factory Act", "Fire Water", 
            "Hydrocarbon", "Storage", "Setback", "Safety Distance"
        ]
        self._initialize_default_graph()

    def _initialize_default_graph(self):
        # Add all common terms as nodes
        for term in self.common_terms:
            self.graph.add_node(term)
        
        # Add default edges
        self.graph.add_edge("PESO", "OISD-118", weight=0.81)
        self.graph.add_edge("OISD-118", "LPG", weight=0.75)
        self.graph.add_edge("PESO", "LPG", weight=0.85)
        self.graph.add_edge("LPG", "Storage", weight=0.90)
        self.graph.add_edge("Storage", "Setback", weight=0.70)
        self.graph.add_edge("Storage", "Safety Distance", weight=0.78)
        self.graph.add_edge("Factory Act", "Safety Distance", weight=0.65)
        self.graph.add_edge("Fire Water", "OISD-118", weight=0.80)
        self.graph.add_edge("Fire Water", "PESO", weight=0.72)
        self.graph.add_edge("Hydrocarbon", "Storage", weight=0.88)
        self.graph.add_edge("Hydrocarbon", "LPG", weight=0.83)

    def extract_entities_from_text(self, text: str) -> List[str]:
        """Extract matching common terms from the text using regex search patterns."""
        found = []
        if not text:
            return found
        for term in self.common_terms:
            pattern = re.escape(term)
            if re.search(pattern, text, re.IGNORECASE):
                found.append(term)
        return found

    def update_graph_from_run(self, goal: str, sources: List[str]):
        """Inject nodes and update relationship weights based on an agent execution run."""
        goal_entities = self.extract_entities_from_text(goal)
        
        source_entities = []
        for src in sources:
            if not src:
                continue
            clean_src = src.replace(".pdf", "").replace(".docx", "").replace(".txt", "").strip()
            matched = False
            for term in self.common_terms:
                if clean_src.lower() == term.lower() or clean_src.lower().startswith(term.lower()):
                    source_entities.append(term)
                    matched = True
                    break
            if not matched:
                self.graph.add_node(clean_src)
                source_entities.append(clean_src)
        
        all_new_entities = list(set(goal_entities + source_entities))
        
        for i in range(len(all_new_entities)):
            for j in range(i + 1, len(all_new_entities)):
                u, v = all_new_entities[i], all_new_entities[j]
                if self.graph.has_edge(u, v):
                    current_w = self.graph[u][v].get('weight', 0.5)
                    self.graph[u][v]['weight'] = min(1.0, current_w + 0.05)
                else:
                    self.graph.add_edge(u, v, weight=0.5)

    def sync_with_db(self, db: Session):
        """Pull document changes and run executions to rebuild knowledge graph edges."""
        from app.db.models import Document
        try:
            docs = db.query(Document).all()
            for doc in docs:
                terms = self.extract_entities_from_text(doc.filename)
                for i in range(len(terms)):
                    for j in range(i + 1, len(terms)):
                        u, v = terms[i], terms[j]
                        if self.graph.has_edge(u, v):
                            self.graph[u][v]['weight'] = min(1.0, self.graph[u][v]['weight'] + 0.02)
                        else:
                            self.graph.add_edge(u, v, weight=0.4)
        except Exception as doc_err:
            logger.warning(f"Knowledge Graph docs synchronization sync failed: {doc_err}")
            
        try:
            from app.db.models import AgentRun
            runs = db.query(AgentRun).all()
            for run in runs:
                import json
                sources = []
                if run.sources_json:
                    try:
                        sources = json.loads(run.sources_json)
                    except Exception as parse_e:
                        logger.debug(f"Failed to parse source json for run {run.id}: {parse_e}")
                self.update_graph_from_run(run.goal, sources)
        except Exception as run_err:
            logger.warning(f"Knowledge Graph runs synchronization sync failed: {run_err}")


    def get_neighbors(self, entity: str) -> Dict[str, Any]:
        # Case-insensitive lookup for matching node
        matched_node = None
        for node in self.graph.nodes:
            if node.lower() == entity.lower():
                matched_node = node
                break
                
        if not matched_node:
            return {"entity": entity, "neighbors": []}
            
        neighbors_list = []
        for neighbor in self.graph.neighbors(matched_node):
            weight = self.graph[matched_node][neighbor].get('weight', 0.5)
            neighbors_list.append({
                "source": neighbor,
                "target": matched_node,
                "weight": round(weight, 2)
            })
            
        return {
            "entity": matched_node,
            "neighbors": neighbors_list
        }

kg_manager = KnowledgeGraphManager()
