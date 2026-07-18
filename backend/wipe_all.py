import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.models import PKMEntity, Belief, Memory, KnowledgeGraphNode, KnowledgeGraphEdge, Suggestion, Entity, Document, MemoryTimelineEvent, QueuedTask, AgentRun
from qdrant_client import QdrantClient

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://jarvis:password@db:5432/jarvis")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    print("Deleting QueuedTasks...")
    db.query(QueuedTask).delete()
    print("Deleting KnowledgeGraphEdges...")
    db.query(KnowledgeGraphEdge).delete()
    print("Deleting KnowledgeGraphNodes...")
    db.query(KnowledgeGraphNode).delete()
    print("Deleting Suggestions...")
    db.query(Suggestion).delete()
    print("Deleting PKMEntities...")
    db.query(PKMEntity).delete()
    print("Deleting Entities...")
    db.query(Entity).delete()
    print("Deleting Beliefs...")
    db.query(Belief).delete()
    print("Deleting Memories...")
    db.query(Memory).delete()
    print("Deleting Timeline Events...")
    db.query(MemoryTimelineEvent).delete()
    print("Deleting Documents...")
    db.query(Document).delete()
    print("Deleting AgentRuns...")
    db.query(AgentRun).delete()
    
    db.commit()
    print("Successfully wiped SQL Database!")
except Exception as e:
    db.rollback()
    print(f"Error: {e}")
finally:
    db.close()

try:
    from app.core.config import settings
    client = QdrantClient(host=settings.QDRANT_HOST, port=settings.QDRANT_PORT)
    client.delete_collection("jarvis_memory")
    print("Wiped Qdrant collection!")
except Exception as e:
    print(f"Error wiping qdrant: {e}")

