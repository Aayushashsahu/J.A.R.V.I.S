import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.models import PKMEntity, Belief, Memory, KnowledgeGraphEdge, AgentRun

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/jarvis")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

print("--- PKM Entities ---")
for p in db.query(PKMEntity).all():
    print(f"[{p.id}] {p.category}: {p.value}")

print("\n--- Beliefs ---")
for b in db.query(Belief).all():
    print(f"[{b.id}] {b.belief_text}")

print("\n--- Memories ---")
for m in db.query(Memory).all():
    print(f"[{m.id}] {m.title}")

print("\n--- Knowledge Graph Edges ---")
for e in db.query(KnowledgeGraphEdge).all():
    print(f"[{e.id}] {e.source_node_id} -> {e.target_node_id} ({e.relationship_type})")

print("\n--- Agent Runs ---")
for r in db.query(AgentRun).all():
    print(f"[{r.id}] Goal: {r.goal[:50]}")

db.close()

