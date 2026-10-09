"""Public respondent endpoints. No authentication, addressed by unguessable slug."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db

router = APIRouter(prefix="/api/public", tags=["public"])


@router.get("/forms/{slug}", response_model=schemas.PublicForm)
def get_public_form(slug: str, db: Session = Depends(get_db)):
    form = crud.get_published_form_by_slug(db, slug)
    if not form:
        # Same 404 for "doesn't exist" and "unpublished": don't leak drafts.
        raise HTTPException(404, "This form is unavailable")
    return form


@router.post("/forms/{slug}/responses", response_model=schemas.ResponseSubmitted, status_code=201)
def submit(slug: str, body: schemas.ResponseCreate, db: Session = Depends(get_db)):
    form = crud.get_published_form_by_slug(db, slug)
    if not form:
        raise HTTPException(404, "This form is unavailable")
    resp, errors = crud.submit_response(db, form, body.answers)
    if errors:
        # 422 with per-question errors so the client can jump to the right question.
        return JSONResponse(status_code=422, content={"detail": "Validation failed", "errors": errors})
    return {"id": resp.id, "thank_you_title": form.thank_you_title, "thank_you_message": form.thank_you_message}
