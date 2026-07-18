import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.models import PKMEntity, Belief, Memory, KnowledgeGraphNode, Suggestion, Entity

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/jarvis")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
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
    
    db.commit()
    print("Successfully wiped synthetic memory and duplicates!")
except Exception as e:
    db.rollback()
    print(f"Error: {e}")
finally:
    db.close()
