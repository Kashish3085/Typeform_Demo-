"""Sign up / log in / log out / who am I."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import auth, models, schemas
from ..database import get_db
from .forms import bearer_token, current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _fail(e: auth.AuthError) -> HTTPException:
    return HTTPException(e.status, e.message)


@router.post("/signup", response_model=schemas.AuthOut, status_code=201)
def signup(body: schemas.SignupIn, db: Session = Depends(get_db)):
    try:
        user = auth.create_user(db, body.email, body.password, body.name)
    except auth.AuthError as e:
        raise _fail(e)
    return {"token": auth.issue_token(db, user), "user": user}


@router.post("/login", response_model=schemas.AuthOut)
def login(body: schemas.LoginIn, db: Session = Depends(get_db)):
    try:
        user = auth.authenticate(db, body.email, body.password)
    except auth.AuthError as e:
        raise _fail(e)
    return {"token": auth.issue_token(db, user), "user": user}


@router.post("/logout", status_code=204)
def logout(token: str = Depends(bearer_token), db: Session = Depends(get_db)):
    auth.revoke_token(db, token)


@router.get("/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(current_user)):
    return user
