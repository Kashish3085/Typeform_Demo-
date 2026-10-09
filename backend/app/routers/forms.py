"""Creator-facing endpoints: forms CRUD, publish, questions.

Every route here depends on `current_user` (a bearer session token), and every query is
scoped to that user, so one account can never see another account's forms.
"""
from fastapi import APIRouter, Depends, Header, HTTPException, Response as HTTPResponse
from sqlalchemy.orm import Session

from .. import auth, crud, models, schemas
from ..database import get_db

router = APIRouter(prefix="/api", tags=["forms"])


def bearer_token(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Not authenticated", headers={"WWW-Authenticate": "Bearer"})
    token = authorization[7:].strip()
    if not token:
        raise HTTPException(401, "Not authenticated", headers={"WWW-Authenticate": "Bearer"})
    return token


def current_user(token: str = Depends(bearer_token), db: Session = Depends(get_db)) -> models.User:
    user = auth.user_from_token(db, token)
    if not user:
        raise HTTPException(401, "Session expired. Please log in again.", headers={"WWW-Authenticate": "Bearer"})
    return user


def own_form(form_id: int, db: Session = Depends(get_db), user: models.User = Depends(current_user)) -> models.Form:
    form = crud.get_form(db, form_id, user)
    if not form:
        raise HTTPException(404, "Form not found")
    return form


# ---------- forms ----------
@router.get("/forms", response_model=list[schemas.FormSummary])
def list_forms(
    workspace_id: int | None = None,
    db: Session = Depends(get_db), user: models.User = Depends(current_user),
):
    return crud.list_forms(db, user, workspace_id)


@router.post("/forms", response_model=schemas.FormOut, status_code=201)
def create_form(body: schemas.FormCreate, db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    try:
        return crud.create_form(db, user, body.title, body.workspace_id, body.template)
    except ValueError as e:
        raise HTTPException(422, str(e))


@router.post("/forms/{form_id}/move", response_model=schemas.FormOut)
def move_form(
    body: schemas.MoveIn, form: models.Form = Depends(own_form),
    db: Session = Depends(get_db), user: models.User = Depends(current_user),
):
    ws = crud.get_workspace(db, body.workspace_id, user)
    if not ws:
        raise HTTPException(404, "Workspace not found")
    return crud.move_form(db, form, ws)


@router.get("/forms/{form_id}", response_model=schemas.FormOut)
def get_form(form: models.Form = Depends(own_form)):
    return form


@router.patch("/forms/{form_id}", response_model=schemas.FormOut)
def update_form(body: schemas.FormUpdate, form: models.Form = Depends(own_form), db: Session = Depends(get_db)):
    for key, val in body.model_dump(exclude_unset=True).items():
        if key == "title" and not (val or "").strip():
            raise HTTPException(422, "Title cannot be empty")
        setattr(form, key, val)
    form.updated_at = crud.now()
    db.commit()
    db.refresh(form)
    return form


@router.delete("/forms/{form_id}", status_code=204)
def delete_form(form: models.Form = Depends(own_form), db: Session = Depends(get_db)):
    db.delete(form)  # cascades to questions, responses, answers
    db.commit()
    return HTTPResponse(status_code=204)


@router.post("/forms/{form_id}/duplicate", response_model=schemas.FormOut, status_code=201)
def duplicate_form(form: models.Form = Depends(own_form), db: Session = Depends(get_db)):
    return crud.duplicate_form(db, form)


@router.post("/forms/{form_id}/publish", response_model=schemas.FormOut)
def publish_form(form: models.Form = Depends(own_form), db: Session = Depends(get_db)):
    if not form.questions:
        raise HTTPException(422, "Add at least one question before publishing")
    if any(not q.title.strip() for q in form.questions):
        raise HTTPException(422, "Every question needs a title before publishing")
    return crud.set_status(db, form, "published")


@router.post("/forms/{form_id}/unpublish", response_model=schemas.FormOut)
def unpublish_form(form: models.Form = Depends(own_form), db: Session = Depends(get_db)):
    return crud.set_status(db, form, "draft")


# ---------- questions ----------
@router.post("/forms/{form_id}/questions", response_model=schemas.QuestionOut, status_code=201)
def add_question(body: schemas.QuestionCreate, form: models.Form = Depends(own_form), db: Session = Depends(get_db)):
    return crud.add_question(db, form, body)


@router.put("/forms/{form_id}/questions/order", response_model=list[schemas.QuestionOut])
def reorder(body: schemas.ReorderIn, form: models.Form = Depends(own_form), db: Session = Depends(get_db)):
    try:
        return crud.reorder_questions(db, form, body.ordered_ids)
    except ValueError as e:
        raise HTTPException(422, str(e))


def _own_question(question_id: int, db: Session, user: models.User) -> models.Question:
    q = db.get(models.Question, question_id)
    if not q or q.form.user_id != user.id:
        raise HTTPException(404, "Question not found")
    return q


@router.patch("/questions/{question_id}", response_model=schemas.QuestionOut)
def update_question(
    question_id: int, body: schemas.QuestionUpdate,
    db: Session = Depends(get_db), user: models.User = Depends(current_user),
):
    return crud.update_question(db, _own_question(question_id, db, user), body)


@router.delete("/questions/{question_id}", status_code=204)
def delete_question(question_id: int, db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    crud.delete_question(db, _own_question(question_id, db, user))
    return HTTPResponse(status_code=204)
