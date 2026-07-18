import os
import logging
from watchdog.observers.polling import PollingObserver as Observer
from watchdog.events import FileSystemEventHandler
from app.db.session import SessionLocal
from app.db.models import QueuedTask
from app.core.config import settings

logger = logging.getLogger(__name__)

class VaultEventHandler(FileSystemEventHandler):
    """Event handler for monitoring local vault markdown document updates."""
    
    def on_created(self, event):
        if not event.is_directory and event.src_path.endswith('.md'):
            abs_path = os.path.abspath(event.src_path)
            logger.info(f"Vault File Created: {abs_path}")
            self._queue_document_processing(abs_path, "created")

    def on_modified(self, event):
        if not event.is_directory and event.src_path.endswith('.md'):
            abs_path = os.path.abspath(event.src_path)
            logger.info(f"Vault File Modified: {abs_path}")
            self._queue_document_processing(abs_path, "modified")

    def on_deleted(self, event):
        if not event.is_directory and event.src_path.endswith('.md'):
            abs_path = os.path.abspath(event.src_path)
            logger.info(f"Vault File Deleted: {abs_path}")
            # In a future release, trigger automatic deletion of DB and Qdrant points

    def _queue_document_processing(self, file_path: str, action: str):
        """Enqueue processing task for worker processing."""
        logger.info(f"Queueing task for {action} on {file_path}")
        try:
            db = SessionLocal()
            from app.db.models import User
            admin_user = db.query(User).first()
            if not admin_user:
                logger.warning("No user found in database. Skipping file processing task queue.")
                return

            task = QueuedTask(
                user_id=admin_user.id,
                task_type="process_markdown_file",
                payload=f'{{"file_path": "{file_path}", "action": "{action}"}}'
            )
            db.add(task)
            db.commit()
            logger.info(f"Successfully enqueued processing task for {file_path}")
        except Exception as e:
            logger.error(f"Error queueing task for {file_path}: {e}")
        finally:
            if 'db' in locals():
                db.close()

def start_watcher():
    """Start local directory polling observer watching the Obsidian vault."""
    vault_path = os.environ.get("JARVIS_VAULT_PATH", "./vault")
    normalized_path = os.path.abspath(vault_path)
    
    if not os.path.exists(normalized_path):
        logger.warning(f"Vault path {normalized_path} does not exist. Initializing directory.")
        os.makedirs(normalized_path, exist_ok=True)
    
    event_handler = VaultEventHandler()
    observer = Observer()
    observer.schedule(event_handler, normalized_path, recursive=True)
    observer.start()
    logger.info(f"Vault Watcher Daemon started polling path: {normalized_path}")
    return observer

