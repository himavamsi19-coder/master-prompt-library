from fastapi.testclient import TestClient
from main import app, get_db, SessionLocal, Base, engine

Base.metadata.create_all(bind=engine)

client = TestClient(app)

def override_get_db():
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

def test_read_main():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to Master Prompt Library API"}

def test_create_prompt():
    response = client.post(
        "/prompts/",
        json={
            "title": "Test Prompt",
            "content": "This is a test prompt content.",
            "tags": "test, prompt",
            "category": "Testing",
            "model_type": "None"
        },
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Test Prompt"
    assert response.json()["content"] == "This is a test prompt content."

def test_get_prompts():
    response = client.get("/prompts/")
    assert response.status_code == 200
    assert len(response.json()) > 0

def test_chat():
    response = client.post(
        "/chat/",
        json={"message": "Show me testing prompts"}
    )
    assert response.status_code == 200
    assert "response" in response.json()
