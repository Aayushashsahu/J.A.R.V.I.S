from sqlalchemy import create_engine
from sqlalchemy import text

from app.core.config import settings

DATABASE_URL = settings.DATABASE_URL
engine = create_engine(DATABASE_URL)

with engine.begin() as conn:
    try:
        conn.execute(text("ALTER TABLE pkm_entities ADD COLUMN source_file VARCHAR"))
        print("Added source_file to pkm_entities")
    except Exception as e:
        print("pkm_entities alter failed:", e)

    try:
        conn.execute(text("ALTER TABLE memories ADD COLUMN source_file VARCHAR"))
        print("Added source_file to memories")
    except Exception as e:
        print("memories alter failed:", e)
