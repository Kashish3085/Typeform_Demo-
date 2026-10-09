"""Account + session logic (kept out of the route handlers)."""
import os
import re
import time
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models, security
from .crud import now

SESSION_DAYS = 30
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
DEMO_EMAIL = "demo@example.com"


class AuthError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def normalise_email(email: str) -> str:
    return email.strip().lower()


def create_user(db: Session, email: str, password: str, name: str | None = None) -> models.User:
    email = normalise_email(email)
    if not EMAIL_RE.match(email) or len(email) > 255:
        raise AuthError(422, "Enter a valid email address")
    if len(password) < 8:
        raise AuthError(422, "Password must be at least 8 characters")
    if len(password) > 128:
        raise AuthError(422, "Password must be at most 128 characters")
    if db.scalar(select(models.User.id).where(models.User.email == email)):
        raise AuthError(409, "An account with this email already exists")
    user = models.User(
        email=email,
        name=(name or "").strip()[:120] or email.split("@")[0],
        password_hash=security.hash_password(password),
    )
    db.add(user)
    db.commit()
    return user


# ---- brute-force protection (in-memory, per process) ----
# Good enough for a single-instance demo; a real deployment would use Redis or the edge/WAF.
_MAX_FAILS, _WINDOW = 5, 15 * 60
_fails: dict[str, list[float]] = {}


def _recent(key: str) -> list[float]:
    cutoff = time.time() - _WINDOW
    _fails[key] = [t for t in _fails.get(key, []) if t > cutoff]
    return _fails[key]


def authenticate(db: Session, email: str, password: str) -> models.User:
    email = normalise_email(email)
    if len(_recent(email)) >= _MAX_FAILS:
        raise AuthError(429, "Too many failed attempts. Try again in a few minutes.")
    user = db.scalar(select(models.User).where(models.User.email == email))
    ok = security.verify_password(password, user.password_hash) if user else False
    if not user:
        security.burn_verify(password)
    if not ok:
        _fails.setdefault(email, []).append(time.time())
        raise AuthError(401, "Incorrect email or password")
    _fails.pop(email, None)
    return user


def issue_token(db: Session, user: models.User) -> str:
    token = security.new_token()
    db.add(models.AuthSession(
        user_id=user.id, token_hash=security.hash_token(token), expires_at=now() + timedelta(days=SESSION_DAYS),
    ))
    db.commit()
    return token


def user_from_token(db: Session, token: str) -> models.User | None:
    sess = db.scalar(select(models.AuthSession).where(models.AuthSession.token_hash == security.hash_token(token)))
    if not sess:
        return None
    if sess.expires_at <= now():
        db.delete(sess)
        db.commit()
        return None
    return sess.user


def revoke_token(db: Session, token: str) -> None:
    sess = db.scalar(select(models.AuthSession).where(models.AuthSession.token_hash == security.hash_token(token)))
    if sess:
        db.delete(sess)
        db.commit()


def get_or_create_demo_user(db: Session) -> models.User:
    """Seed account. Password comes from DEMO_PASSWORD (default is for local development only)."""
    user = db.scalar(select(models.User).where(models.User.email == DEMO_EMAIL))
    if not user:
        user = create_user(db, DEMO_EMAIL, os.environ.get("DEMO_PASSWORD", "demo1234"), "Demo Creator")
    return user
