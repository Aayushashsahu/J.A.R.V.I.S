import os
import logging
from watchdog.observers.polling import PollingObserver as Observer
from watchdog.events import FileSystemEventHandler
from app.db.session import SessionLocal
from app.db.models import QueuedTask
from app.core.config import settings

logger = logging.getLogger(__name__)

class VaultEventHandler(FileSystemEventHandler):
    def on_created(self, event):
        if not event.is_directory and event.src_path.endswith('.md'):
            logger.info(f"File Created: {event.src_path}")
            self._queue_document_processing(event.src_path, "created")

    def on_modified(self, event):
        if not event.is_directory and event.src_path.endswith('.md'):
            logger.info(f"File Modified: {event.src_path}")
            self._queue_document_processing(event.src_path, "modified")

    def on_deleted(self, event):
        if not event.is_directory and event.src_path.endswith('.md'):
            logger.info(f"File Deleted: {event.src_path}")

    def _queue_document_processing(self, file_path: str, action: str):
        # We need a user to tie this to. For a single user OS, we can find the default user
        # or rely on the background worker to look it up.
        logger.info(f"Queueing task for {action} on {file_path}")
        try:
            db = SessionLocal()
            # Find admin user
            from app.db.models import User
            admin_user = db.query(User).first()
            if not admin_user:
                logger.warning("No user found in DB. Skipping file processing queue.")
                return

            task = QueuedTask(
                user_id=admin_user.id,
                task_type="process_markdown_file",
                payload=f'{{"file_path": "{file_path}", "action": "{action}"}}'
            )
            db.add(task)
            db.commit()
        except Exception as e:
            logger.error(f"Error queueing task for {file_path}: {e}")
        finally:
            if 'db' in locals():
                db.close()

def start_watcher():
    vault_path = os.environ.get("JARVIS_VAULT_PATH", "./vault")
    if not os.path.exists(vault_path):
        logger.warning(f"Vault path {vault_path} does not exist. Creating it.")
        os.makedirs(vault_path, exist_ok=True)
    
    event_handler = VaultEventHandler()
    observer = Observer()
    observer.schedule(event_handler, vault_path, recursive=True)
    observer.start()
    logger.info("Vault Watcher Started")
    logger.info(f"Watching {vault_path}")
    return observer
