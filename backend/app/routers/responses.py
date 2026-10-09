"""Creator-facing results: list, detail, summary stats, CSV export."""
import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .. import crud, models, schemas
from ..database import get_db
from .forms import own_form

router = APIRouter(prefix="/api/forms/{form_id}", tags=["results"])


def _responses(db: Session, form_id: int, limit: int | None = None, offset: int = 0):
    stmt = (
        select(models.Response)
        .where(models.Response.form_id == form_id, models.Response.submitted_at.is_not(None))
        .options(selectinload(models.Response.answers))
        .order_by(models.Response.submitted_at.desc(), models.Response.id.desc())
        .offset(offset)
    )
    if limit:
        stmt = stmt.limit(limit)
    return db.scalars(stmt).all()


@router.get("/responses", response_model=list[schemas.ResponseListItem])
def list_responses(
    limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0),
    form: models.Form = Depends(own_form), db: Session = Depends(get_db),
):
    qmap = {q.id: q for q in form.questions}
    return [
        {
            "id": r.id, "started_at": r.started_at, "submitted_at": r.submitted_at,
            "answers": {a.question_id: crud.display_value(qmap[a.question_id], a.value)
                        for a in r.answers if a.question_id in qmap},
        }
        for r in _responses(db, form.id, limit, offset)
    ]


@router.get("/responses/{response_id}", response_model=schemas.ResponseDetail)
def get_response(response_id: int, form: models.Form = Depends(own_form), db: Session = Depends(get_db)):
    r = db.scalar(
        select(models.Response)
        .where(models.Response.id == response_id, models.Response.form_id == form.id)
        .options(selectinload(models.Response.answers))
    )
    if not r:
        raise HTTPException(404, "Response not found")
    by_q = {a.question_id: a.value for a in r.answers}
    # Return one row per question (in form order) so skipped questions show as empty.
    return {
        "id": r.id, "started_at": r.started_at, "submitted_at": r.submitted_at,
        "answers": [
            {
                "question_id": q.id, "question_title": q.title, "question_type": q.type,
                "value": by_q.get(q.id), "display": crud.display_value(q, by_q.get(q.id)),
            }
            for q in form.questions
        ],
    }


@router.delete("/responses/{response_id}", status_code=204)
def delete_response(response_id: int, form: models.Form = Depends(own_form), db: Session = Depends(get_db)):
    r = db.get(models.Response, response_id)
    if not r or r.form_id != form.id:
        raise HTTPException(404, "Response not found")
    db.delete(r)
    db.commit()


@router.get("/summary", response_model=schemas.FormSummaryStats)
def summary(form: models.Form = Depends(own_form), db: Session = Depends(get_db)):
    return crud.form_stats(db, form)


def _csv_safe(text: str) -> str:
    """Neutralise spreadsheet formula injection (=, +, -, @ at start of a cell)."""
    return "'" + text if text[:1] in ("=", "+", "-", "@") else text


@router.get("/export.csv")
def export_csv(form: models.Form = Depends(own_form), db: Session = Depends(get_db)):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Response ID", "Submitted at"] + [_csv_safe(q.title) for q in form.questions])
    for r in reversed(_responses(db, form.id)):
        by_q = {a.question_id: a.value for a in r.answers}
        w.writerow(
            [r.id, r.submitted_at.isoformat() if r.submitted_at else ""]
            + [_csv_safe(crud.display_value(q, by_q.get(q.id))) for q in form.questions]
        )
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="form-{form.id}-responses.csv"'},
    )
