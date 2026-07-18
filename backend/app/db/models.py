from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base
import uuid

def generate_uuid():
    return str(uuid.uuid4())

# Many-to-many relationship for Tags
document_tags = Table(
    'document_tags',
    Base.metadata,
    Column('document_id', String, ForeignKey('documents.id')),
    Column('tag_id', String, ForeignKey('tags.id'))
)

memory_tags = Table(
    'memory_tags',
    Base.metadata,
    Column('memory_id', String, ForeignKey('memories.id')),
    Column('tag_id', String, ForeignKey('tags.id'))
)

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    workspaces = relationship("Workspace", back_populates="user", cascade="all, delete-orphan")

class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="workspaces")
    conversations = relationship("Conversation", back_populates="workspace", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="workspace", cascade="all, delete-orphan")
    memories = relationship("Memory", back_populates="workspace", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="workspace", cascade="all, delete-orphan")

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False)
    title = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    workspace = relationship("Workspace", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=generate_uuid)
    conversation_id = Column(String, ForeignKey("conversations.id"), nullable=False)
    role = Column(String, nullable=False) # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    conversation = relationship("Conversation", back_populates="messages")

class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False)
    filename = Column(String, nullable=False)
    content_type = Column(String, nullable=False) # pdf, docx, md, txt
    file_path = Column(String, nullable=False) # local storage path for now
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    workspace = relationship("Workspace", back_populates="documents")
    tags = relationship("Tag", secondary=document_tags, back_populates="documents")

class Memory(Base):
    __tablename__ = "memories"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    type = Column(String, nullable=False) # e.g. meeting_summary, decision, knowledge_extraction
    source_file = Column(String, nullable=True)
    evidence_type = Column(String, nullable=True, default="reflection")
    priority = Column(Integer, nullable=True, default=4)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    workspace = relationship("Workspace", back_populates="memories")
    tags = relationship("Tag", secondary=memory_tags, back_populates="memories")

class Task(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, default="todo") # todo, in_progress, done
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    workspace = relationship("Workspace", back_populates="tasks")

class Tag(Base):
    __tablename__ = "tags"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, unique=True, nullable=False)
    
    documents = relationship("Document", secondary=document_tags, back_populates="tags")
    memories = relationship("Memory", secondary=memory_tags, back_populates="tags")

class PKMEntity(Base):
    __tablename__ = "pkm_entities"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    category = Column(String, nullable=False) # e.g. "Goal", "Project", "Interest", "Preference"
    value = Column(String, nullable=False) # e.g. "Launch Octiq AI"
    confidence = Column(Integer, nullable=False, default=50) # 0 to 100
    source_file = Column(String, nullable=True)
    evidence_type = Column(String, nullable=True, default="structured_memory")
    priority = Column(Integer, nullable=True, default=2)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class Belief(Base):
    __tablename__ = "beliefs"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    belief_text = Column(String, nullable=False)
    confidence = Column(Integer, nullable=False, default=50) # 0 to 100
    evidence = Column(Text, nullable=True)
    source_notes = Column(Text, nullable=True) # JSON array of document IDs
    evidence_type = Column(String, nullable=True, default="belief")
    priority = Column(Integer, nullable=True, default=3)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class Entity(Base):
    __tablename__ = "entities"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    type = Column(String, nullable=False) # "Project", "Technology", "Company", "Person", "Concept"
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class KnowledgeGraphNode(Base):
    __tablename__ = "knowledge_graph_nodes"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    node_type = Column(String, nullable=False) # "Document", "Entity", "Belief", "PKMEntity"
    node_id = Column(String, nullable=False) # The ID of the specific item
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class KnowledgeGraphEdge(Base):
    __tablename__ = "knowledge_graph_edges"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    source_node_id = Column(String, ForeignKey("knowledge_graph_nodes.id"), nullable=False)
    target_node_id = Column(String, ForeignKey("knowledge_graph_nodes.id"), nullable=False)
    relationship_type = Column(String, nullable=False) # e.g. "references", "supports", "related_to"
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class MemoryTimelineEvent(Base):
    __tablename__ = "memory_timeline_events"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=True)
    event_type = Column(String, nullable=False) # "creation", "modification", "research", "reflection", "system"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class QueuedTask(Base):
    __tablename__ = "queued_tasks"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    task_type = Column(String, nullable=False) # "extract_pkm", "extract_entities", "generate_reflection"
    payload = Column(Text, nullable=False) # JSON payload
    status = Column(String, default="pending") # "pending", "completed", "failed"
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Suggestion(Base):
    __tablename__ = "suggestions"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    target_id = Column(String, nullable=True) # e.g. document id
    suggestion_type = Column(String, nullable=False) # e.g. "move_workspace"
    content = Column(Text, nullable=False) # JSON
    confidence = Column(Integer, nullable=False, default=50) # 0 to 100
    status = Column(String, default="pending") # "pending", "approved", "rejected"
    created_at = Column(DateTime(timezone=True), server_default=func.now())
class AgentRun(Base):
    __tablename__ = "agent_runs"

    id = Column(String, primary_key=True, default=generate_uuid)
    workspace_id = Column(String, nullable=False)
    goal = Column(Text, nullable=False)
    trace_json = Column(Text, nullable=False)
    final_answer = Column(Text, nullable=True)
    sources_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

