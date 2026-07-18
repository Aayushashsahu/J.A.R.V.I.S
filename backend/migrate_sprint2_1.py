from sqlalchemy import create_engine
from sqlalchemy import text
from app.core.config import settings

DATABASE_URL = settings.DATABASE_URL
engine = create_engine(DATABASE_URL)

with engine.begin() as conn:
    tables = ['memories', 'pkm_entities', 'beliefs']
    
    for table in tables:
        try:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN evidence_type VARCHAR"))
            print(f"Added evidence_type to {table}")
        except Exception as e:
            print(f"{table} evidence_type alter failed:", e)
            
        try:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN priority INTEGER"))
            print(f"Added priority to {table}")
        except Exception as e:
            print(f"{table} priority alter failed:", e)

    # Set defaults
    try:
        conn.execute(text("UPDATE memories SET priority = 4, evidence_type = 'reflection' WHERE priority IS NULL"))
        conn.execute(text("UPDATE pkm_entities SET priority = 2, evidence_type = 'structured_memory' WHERE priority IS NULL"))
        conn.execute(text("UPDATE beliefs SET priority = 3, evidence_type = 'belief' WHERE priority IS NULL"))
        print("Set default values")
    except Exception as e:
        print("Update defaults failed:", e)
