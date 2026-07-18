import asyncio
from app.db.session import SessionLocal
from app.db.models import Workspace, User
from app.api.routers.chat import chat, ChatRequest

async def test_chat():
    db = SessionLocal()
    try:
        user = db.query(User).first()
        ws = db.query(Workspace).filter(Workspace.name == "Inbox").first()
        
        if not ws:
            print("Workspace 'Inbox' not found.")
            return

        req = ChatRequest(message="What is my current project?")
        
        # Test the chat function directly
        print("Calling chat endpoint...")
        resp = chat(workspace_id=ws.id, request=req, db=db, current_user=user)
        print("\n--- Assistant Response ---")
        print(resp.message)
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_chat())
