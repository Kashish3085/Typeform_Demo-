"""Workspaces (folders of forms) and plan usage for the dashboard's left rail."""
from fastapi import APIRouter, Depends, HTTPException, Response as HTTPResponse
from sqlalchemy.orm import Session

from .. import crud, models, schemas
from ..database import get_db
from .forms import current_user

router = APIRouter(prefix="/api", tags=["workspaces"])


def _out(ws: models.Workspace, db: Session, user: models.User) -> dict:
    return next(w for w in crud.list_workspaces(db, user) if w["id"] == ws.id)


@router.get("/workspaces", response_model=list[schemas.WorkspaceOut])
def list_workspaces(db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    return crud.list_workspaces(db, user)


@router.post("/workspaces", response_model=schemas.WorkspaceOut, status_code=201)
def create_workspace(
    body: schemas.WorkspaceCreate, db: Session = Depends(get_db), user: models.User = Depends(current_user),
):
    name = body.name.strip()
    if not name:
        raise HTTPException(422, "Name cannot be empty")
    ws = models.Workspace(user_id=user.id, name=name)
    db.add(ws)
    db.commit()
    return _out(ws, db, user)


@router.patch("/workspaces/{workspace_id}", response_model=schemas.WorkspaceOut)
def rename_workspace(
    workspace_id: int, body: schemas.WorkspaceUpdate,
    db: Session = Depends(get_db), user: models.User = Depends(current_user),
):
    ws = crud.get_workspace(db, workspace_id, user)
    if not ws:
        raise HTTPException(404, "Workspace not found")
    name = body.name.strip()
    if not name:
        raise HTTPException(422, "Name cannot be empty")
    ws.name = name
    db.commit()
    return _out(ws, db, user)


@router.delete("/workspaces/{workspace_id}", status_code=204)
def delete_workspace(
    workspace_id: int, db: Session = Depends(get_db), user: models.User = Depends(current_user),
):
    ws = crud.get_workspace(db, workspace_id, user)
    if not ws:
        raise HTTPException(404, "Workspace not found")
    if len(crud.list_workspaces(db, user)) <= 1:
        raise HTTPException(409, "You can't delete your only workspace")
    db.delete(ws)  # cascades to its forms (the UI warns first)
    db.commit()
    return HTTPResponse(status_code=204)


@router.get("/usage", response_model=schemas.UsageOut)
def get_usage(db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    return crud.usage(db, user)
