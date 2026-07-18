from datetime import timedelta
from jose import jwt
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.config import settings

def test_password_hashing():
    password = "supersecretpassword123!"
    hashed = get_password_hash(password)

    assert hashed != password
    assert len(hashed) > 0
    assert verify_password(password, hashed) is True

def test_verify_password_invalid():
    password = "supersecretpassword123!"
    wrong_password = "wrongpassword"
    hashed = get_password_hash(password)

    assert verify_password(wrong_password, hashed) is False

def test_create_access_token():
    subject = "user123"
    token = create_access_token(subject=subject)

    assert isinstance(token, str)

    decoded = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert decoded["sub"] == subject
    assert "exp" in decoded

def test_create_access_token_with_expires_delta():
    subject = "user123"
    expires_delta = timedelta(minutes=15)
    token = create_access_token(subject=subject, expires_delta=expires_delta)

    assert isinstance(token, str)

    decoded = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert decoded["sub"] == subject
    assert "exp" in decoded
