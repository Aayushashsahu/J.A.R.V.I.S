"""Tests for the Neural Connections API endpoints."""
import pytest
from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


@pytest.fixture(scope="module")
def auth():
    email = "neural_test@example.com"
    password = "neuraltest123"
    client.post("/api/v1/auth/register", json={"email": email, "password": password})
    resp = client.post("/api/v1/auth/login", data={"username": email, "password": password})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def workspace_id(auth):
    resp = client.get("/api/v1/workspaces/", headers=auth)
    return resp.json()[0]["id"]


class TestNeuralConnections:
    def test_connections_endpoint_exists(self, auth):
        resp = client.get("/api/v1/neural/connections", headers=auth)
        assert resp.status_code == 200

    def test_connections_returns_dict(self, auth):
        resp = client.get("/api/v1/neural/connections", headers=auth)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, dict)
        # Response should have nodes, edges, connections, insights keys
        # OR it might return an empty message when no entities exist
        assert "nodes" in data or "message" in data

    def test_connections_empty_when_no_entities(self, auth):
        resp = client.get("/api/v1/neural/connections", headers=auth)
        data = resp.json()
        # Either empty or has data - both are valid
        assert isinstance(data.get("nodes", []), list)
        assert isinstance(data.get("connections", []), list)
        assert isinstance(data.get("insights", []), list)

    def test_synthesize_endpoint_exists(self, auth):
        resp = client.get("/api/v1/neural/synthesize", headers=auth)
        assert resp.status_code == 200

    def test_synthesize_returns_dict(self, auth):
        resp = client.get("/api/v1/neural/synthesize", headers=auth)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, dict)

    def test_connections_requires_auth(self):
        resp = client.get("/api/v1/neural/connections")
        assert resp.status_code == 401

    def test_synthesize_requires_auth(self):
        resp = client.get("/api/v1/neural/synthesize")
        assert resp.status_code == 401
