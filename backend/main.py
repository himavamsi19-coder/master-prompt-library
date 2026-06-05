from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict
from typing import List, Optional
import chromadb
from chromadb.utils import embedding_functions
from sqlalchemy import create_engine, Column, Integer, String, Text, ForeignKey, or_
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pathlib import Path
import httpx
import os
import shutil
import uuid

# Database setup
DATA_DIR = Path(os.environ.get("PROMPT_LIBRARY_DATA_DIR", r"D:\MasterPromptLibrary\data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
ATTACHMENTS_DIR = DATA_DIR / "attachments"
ATTACHMENTS_DIR.mkdir(parents=True, exist_ok=True)

SQLITE_DB_PATH = DATA_DIR / "prompt_library.db"
SQLALCHEMY_DATABASE_URL = f"sqlite:///{SQLITE_DB_PATH.as_posix()}"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ChromaDB setup
chroma_client = chromadb.PersistentClient(path=str(DATA_DIR / "chroma_db"))
embedding_function = embedding_functions.DefaultEmbeddingFunction()
collection = chroma_client.get_or_create_collection(name="prompts", embedding_function=embedding_function)

# Models
class PromptDB(Base):
    __tablename__ = "prompts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(Text, nullable=True)
    content = Column(Text)
    tags = Column(String, nullable=True)
    category = Column(String, nullable=True)
    model_type = Column(String, nullable=True)

class PromptAttachmentDB(Base):
    __tablename__ = "prompt_attachments"

    id = Column(Integer, primary_key=True, index=True)
    prompt_id = Column(Integer, ForeignKey("prompts.id"), index=True)
    filename = Column(String)
    original_name = Column(String)
    content_type = Column(String, nullable=True)
    note = Column(Text, nullable=True)

Base.metadata.create_all(bind=engine)

# FastAPI setup
app = FastAPI(title="Master Prompt Library API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic schemas
class PromptCreate(BaseModel):
    title: str
    description: Optional[str] = None
    content: str
    tags: Optional[str] = None
    category: Optional[str] = None
    model_type: Optional[str] = None

class PromptResponse(PromptCreate):
    id: int
    attachments: List["PromptAttachmentResponse"] = []
    model_config = ConfigDict(from_attributes=True)

class PromptAttachmentResponse(BaseModel):
    id: int
    prompt_id: int
    original_name: str
    content_type: Optional[str] = None
    note: Optional[str] = None
    url: str

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str
    prompt_ids: List[int] = []

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def prompt_to_response(prompt: PromptDB, db: Session) -> PromptResponse:
    attachments = db.query(PromptAttachmentDB).filter(PromptAttachmentDB.prompt_id == prompt.id).all()
    return PromptResponse(
        id=prompt.id,
        title=prompt.title,
        description=prompt.description,
        content=prompt.content,
        tags=prompt.tags,
        category=prompt.category,
        model_type=prompt.model_type,
        attachments=[
            PromptAttachmentResponse(
                id=attachment.id,
                prompt_id=attachment.prompt_id,
                original_name=attachment.original_name,
                content_type=attachment.content_type,
                note=attachment.note,
                url=f"/attachments/{attachment.filename}",
            )
            for attachment in attachments
        ],
    )

def find_prompt_ids(query: str, db: Session, n_results: int = 5) -> List[int]:
    pattern = f"%{query}%"
    lexical_prompts = (
        db.query(PromptDB)
        .filter(
            or_(
                PromptDB.title.ilike(pattern),
                PromptDB.description.ilike(pattern),
                PromptDB.content.ilike(pattern),
                PromptDB.tags.ilike(pattern),
                PromptDB.category.ilike(pattern),
                PromptDB.model_type.ilike(pattern),
            )
        )
        .order_by(PromptDB.id.desc())
        .limit(n_results)
        .all()
    )

    prompt_ids = [prompt.id for prompt in lexical_prompts]

    results = collection.query(query_texts=[query], n_results=n_results)
    if results["ids"] and results["ids"][0]:
        for id_str in results["ids"][0]:
            prompt_id = int(id_str)
            if prompt_id not in prompt_ids:
                prompt_ids.append(prompt_id)

    return prompt_ids[:n_results]

@app.get("/")
def read_root():
    return {"message": "Welcome to Master Prompt Library API"}

app.mount("/attachments", StaticFiles(directory=str(ATTACHMENTS_DIR)), name="attachments")

@app.post("/prompts/", response_model=PromptResponse)
def create_prompt(prompt: PromptCreate, db: Session = Depends(get_db)):
    db_prompt = PromptDB(**prompt.model_dump())
    db.add(db_prompt)
    db.commit()
    db.refresh(db_prompt)
    
    # Add to ChromaDB
    collection.add(
        documents=[prompt.content],
        metadatas=[{"title": prompt.title, "tags": prompt.tags or "", "category": prompt.category or ""}],
        ids=[str(db_prompt.id)]
    )
    
    return prompt_to_response(db_prompt, db)

@app.get("/prompts/", response_model=List[PromptResponse])
def get_prompts(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    prompts = db.query(PromptDB).order_by(PromptDB.id.desc()).offset(skip).limit(limit).all()
    return [prompt_to_response(prompt, db) for prompt in prompts]

@app.get("/prompts/{prompt_id}", response_model=PromptResponse)
def get_prompt(prompt_id: int, db: Session = Depends(get_db)):
    prompt = db.query(PromptDB).filter(PromptDB.id == prompt_id).first()
    if prompt is None:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return prompt_to_response(prompt, db)

@app.post("/prompts/{prompt_id}/attachments/", response_model=PromptAttachmentResponse)
def upload_prompt_attachment(
    prompt_id: int,
    file: UploadFile = File(...),
    note: Optional[str] = None,
    db: Session = Depends(get_db),
):
    prompt = db.query(PromptDB).filter(PromptDB.id == prompt_id).first()
    if prompt is None:
        raise HTTPException(status_code=404, detail="Prompt not found")

    extension = Path(file.filename or "").suffix
    stored_name = f"{uuid.uuid4().hex}{extension}"
    stored_path = ATTACHMENTS_DIR / stored_name

    with stored_path.open("wb") as output:
        shutil.copyfileobj(file.file, output)

    attachment = PromptAttachmentDB(
        prompt_id=prompt_id,
        filename=stored_name,
        original_name=file.filename or stored_name,
        content_type=file.content_type,
        note=note,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)

    return PromptAttachmentResponse(
        id=attachment.id,
        prompt_id=attachment.prompt_id,
        original_name=attachment.original_name,
        content_type=attachment.content_type,
        note=attachment.note,
        url=f"/attachments/{attachment.filename}",
    )

@app.get("/search/", response_model=List[PromptResponse])
def search_prompts(query: str, n_results: int = 5, db: Session = Depends(get_db)):
    prompt_ids = find_prompt_ids(query, db, n_results)
    if not prompt_ids:
        return []
    
    # Fetch from SQLite to return full prompt objects
    prompts = db.query(PromptDB).filter(PromptDB.id.in_(prompt_ids)).all()
    
    # Sort prompts to match ChromaDB results order (optional, but good)
    prompts_by_id = {p.id: p for p in prompts}
    sorted_prompts = [prompts_by_id[id] for id in prompt_ids if id in prompts_by_id]
    
    return [prompt_to_response(prompt, db) for prompt in sorted_prompts]

@app.post("/chat/", response_model=ChatResponse)
async def chat_with_assistant(request: ChatRequest, db: Session = Depends(get_db)):
    # 1. Retrieve context
    context = ""
    prompt_ids = find_prompt_ids(request.message, db, 3)
    if prompt_ids:
        prompts = db.query(PromptDB).filter(PromptDB.id.in_(prompt_ids)).all()
        prompts_by_id = {p.id: p for p in prompts}
        for p in [prompts_by_id[id] for id in prompt_ids if id in prompts_by_id]:
            context += f"Prompt Title: {p.title}\nDescription: {p.description}\nContent: {p.content}\n\n"
    
    # 2. Call Ollama (if available) or fallback
    system_prompt = f"You are a helpful AI Prompt Librarian. Use the following context to answer the user's question. If you don't know the answer, just say that you don't know, don't try to make up an answer.\n\nContext:\n{context}"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": os.environ.get("PROMPT_LIBRARY_OLLAMA_MODEL", "gemma3:1b"),
                    "prompt": f"System: {system_prompt}\nUser: {request.message}",
                    "stream": False
                },
                timeout=180.0
            )
            if response.status_code == 200:
                data = response.json()
                return ChatResponse(response=data.get("response", "Sorry, I couldn't process that."), prompt_ids=prompt_ids)
    except Exception as e:
        # Fallback if Ollama is not running
        print(f"Ollama connection failed: {e}")
        
    # Mock fallback response
    if context:
        return ChatResponse(response=f"I found some prompts related to your query!\n\nHere are the top matches:\n{context}", prompt_ids=prompt_ids)
    else:
        return ChatResponse(response="I couldn't find any specific prompts for that. Add prompts and workflow images, then ask me by use case, category, tags, or description.", prompt_ids=[])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
