from fastapi.testclient import TestClient
from app.main import app

def test_cors_allowed_origin():
    with TestClient(app) as client:
        response = client.options(
            "/api/v1/auth/login",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
            }
        )
        assert response.status_code == 200
        # If origin is allowed, it should be in the Access-Control-Allow-Origin response header
        assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"

def test_cors_disallowed_origin():
    with TestClient(app) as client:
        response = client.options(
            "/api/v1/auth/login",
            headers={
                "Origin": "http://malicious-site.com",
                "Access-Control-Request-Method": "POST",
            }
        )
        # 400 Bad Request is returned by Starlette's CORSMiddleware when a disallowed origin tries to preflight
        assert response.status_code == 400
        assert "access-control-allow-origin" not in response.headers
