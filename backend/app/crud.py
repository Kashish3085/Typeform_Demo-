"""Data-access / business logic, kept out of the route handlers."""
import secrets
import string
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from . import models
from .question_types import CHOICE_TYPES, default_properties, validate_answer

_ALPHABET = string.ascii_letters + string.digits


def now() -> datetime:
    return datetime.now(timezone.utc)


# ---------- workspaces ----------
# MOCK: Typeform's free plan caps responses; there is no billing here, so this is a fixed number.
PLAN_RESPONSE_LIMIT = 100


def get_default_workspace(db: Session, user: models.User) -> models.Workspace:
    """The user's first workspace; created on demand so a fresh DB always has one."""
    ws = db.scalar(
        select(models.Workspace).where(models.Workspace.user_id == user.id).order_by(models.Workspace.id).limit(1)
    )
    if not ws:
        ws = models.Workspace(user_id=user.id, name="My workspace")
        db.add(ws)
        db.commit()
    return ws


def get_workspace(db: Session, workspace_id: int, user: models.User) -> models.Workspace | None:
    return db.scalar(
        select(models.Workspace).where(models.Workspace.id == workspace_id, models.Workspace.user_id == user.id)
    )


def list_workspaces(db: Session, user: models.User) -> list[dict[str, Any]]:
    get_default_workspace(db, user)
    counts = dict(db.execute(select(models.Form.workspace_id, func.count()).group_by(models.Form.workspace_id)).all())
    rows = db.scalars(
        select(models.Workspace).where(models.Workspace.user_id == user.id).order_by(models.Workspace.id)
    ).all()
    return [{"id": w.id, "name": w.name, "form_count": counts.get(w.id, 0)} for w in rows]


def usage(db: Session, user: models.User) -> dict[str, int]:
    used = db.scalar(
        select(func.count()).select_from(models.Response)
        .join(models.Form, models.Form.id == models.Response.form_id)
        .where(models.Form.user_id == user.id, models.Response.submitted_at.is_not(None))
    ) or 0
    return {"responses_collected": used, "limit": PLAN_RESPONSE_LIMIT}


# ---------- forms ----------
def new_slug(db: Session) -> str:
    """Unguessable public id, e.g. 'k3Fz9aQp'. Retries on the (rare) collision."""
    while True:
        slug = "".join(secrets.choice(_ALPHABET) for _ in range(8))
        if not db.scalar(select(models.Form.id).where(models.Form.slug == slug)):
            return slug


def get_form(db: Session, form_id: int, user: models.User) -> models.Form | None:
    return db.scalar(
        select(models.Form)
        .where(models.Form.id == form_id, models.Form.user_id == user.id)
        .options(selectinload(models.Form.questions))
    )


def list_forms(db: Session, user: models.User, workspace_id: int | None = None) -> list[dict[str, Any]]:
    # Grouped queries instead of N+1 per-form counts.
    done = dict(
        db.execute(
            select(models.Response.form_id, func.count())
            .where(models.Response.submitted_at.is_not(None))
            .group_by(models.Response.form_id)
        ).all()
    )
    started = dict(
        db.execute(select(models.Response.form_id, func.count()).group_by(models.Response.form_id)).all()
    )
    q_counts = dict(
        db.execute(select(models.Question.form_id, func.count()).group_by(models.Question.form_id)).all()
    )
    stmt = select(models.Form).where(models.Form.user_id == user.id).order_by(models.Form.updated_at.desc())
    if workspace_id is not None:
        stmt = stmt.where(models.Form.workspace_id == workspace_id)
    out = []
    for f in db.scalars(stmt).all():
        total, completed = started.get(f.id, 0), done.get(f.id, 0)
        out.append({
            **{c: getattr(f, c) for c in (
                "id", "title", "status", "slug", "workspace_id", "created_at", "updated_at", "published_at")},
            "response_count": completed,
            "question_count": q_counts.get(f.id, 0),
            # None (not 0) when nobody has started, so the UI can show "-" like Typeform
            "completion_rate": round(100 * completed / total) if total else None,
        })
    return out


def create_form(
    db: Session, user: models.User, title: str | None = None,
    workspace_id: int | None = None, template: str | None = None,
) -> models.Form:
    from .templates import TEMPLATES

    ws = get_workspace(db, workspace_id, user) if workspace_id is not None else get_default_workspace(db, user)
    if ws is None:
        raise ValueError("Workspace not found")
    tpl = TEMPLATES.get(template) if template else None
    if template and tpl is None:
        raise ValueError(f"Unknown template '{template}'")

    form = models.Form(
        user_id=user.id, workspace_id=ws.id, slug=new_slug(db),
        title=title or (tpl["title"] if tpl else "New form"),
        welcome_title=tpl.get("welcome_title") if tpl else None,
        welcome_description=tpl.get("welcome_description") if tpl else None,
    )
    db.add(form)
    db.flush()
    if tpl:
        for i, q in enumerate(tpl["questions"]):
            db.add(models.Question(form_id=form.id, position=i, **q))
    else:
        # A blank form starts with one empty short-text question, like Typeform.
        db.add(models.Question(
            form_id=form.id, type="short_text", title="", position=0,
            properties=default_properties("short_text"),
        ))
    db.commit()
    db.refresh(form)
    return form


def move_form(db: Session, form: models.Form, workspace: models.Workspace) -> models.Form:
    form.workspace_id = workspace.id
    form.updated_at = now()
    db.commit()
    db.refresh(form)
    return form


def duplicate_form(db: Session, form: models.Form) -> models.Form:
    copy = models.Form(
        user_id=form.user_id,
        workspace_id=form.workspace_id,
        title=f"{form.title} (copy)"[:255],
        status="draft",
        slug=new_slug(db),
        welcome_title=form.welcome_title,
        welcome_description=form.welcome_description,
        welcome_button=form.welcome_button,
        thank_you_title=form.thank_you_title,
        thank_you_message=form.thank_you_message,
        theme_background=form.theme_background,
        theme_question_color=form.theme_question_color,
        theme_button_color=form.theme_button_color,
        theme_font=form.theme_font,
    )
    db.add(copy)
    db.flush()
    for q in form.questions:
        db.add(models.Question(
            form_id=copy.id, type=q.type, title=q.title, description=q.description,
            required=q.required, position=q.position, properties=dict(q.properties or {}),
        ))
    db.commit()
    db.refresh(copy)
    return copy


def set_status(db: Session, form: models.Form, status: str) -> models.Form:
    form.status = status
    if status == "published":
        form.published_at = now()
    db.commit()
    db.refresh(form)
    return form


# ---------- questions ----------
def _renumber(db: Session, form_id: int) -> None:
    qs = db.scalars(
        select(models.Question).where(models.Question.form_id == form_id).order_by(models.Question.position, models.Question.id)
    ).all()
    for i, q in enumerate(qs):
        q.position = i


def add_question(db: Session, form: models.Form, data) -> models.Question:
    count = db.scalar(select(func.count()).select_from(models.Question).where(models.Question.form_id == form.id)) or 0
    pos = count if data.position is None else max(0, min(data.position, count))
    # make room: shift everything at/after pos down by one
    for q in form.questions:
        if q.position >= pos:
            q.position += 1
    q = models.Question(
        form_id=form.id, type=data.type, title=data.title, description=data.description,
        required=data.required, position=pos,
        properties=data.properties if data.properties is not None else default_properties(data.type),
    )
    db.add(q)
    db.flush()
    _renumber(db, form.id)
    form.updated_at = now()
    db.commit()
    db.refresh(q)
    return q


def update_question(db: Session, q: models.Question, data) -> models.Question:
    patch = data.model_dump(exclude_unset=True)
    if "type" in patch and patch["type"] != q.type:
        # Changing type: keep title/description, reset type-specific config.
        q.type = patch.pop("type")
        q.properties = default_properties(q.type)
    else:
        patch.pop("type", None)
    for key, val in patch.items():
        setattr(q, key, val)
    q.form.updated_at = now()
    db.commit()
    db.refresh(q)
    return q


def delete_question(db: Session, q: models.Question) -> None:
    form = q.form
    db.delete(q)
    db.flush()
    _renumber(db, form.id)
    form.updated_at = now()
    db.commit()


def reorder_questions(db: Session, form: models.Form, ordered_ids: list[int]) -> list[models.Question]:
    existing = {q.id: q for q in form.questions}
    if set(ordered_ids) != set(existing) or len(ordered_ids) != len(existing):
        raise ValueError("ordered_ids must contain every question id of this form exactly once")
    for i, qid in enumerate(ordered_ids):
        existing[qid].position = i
    form.updated_at = now()
    db.commit()
    db.refresh(form)
    return sorted(form.questions, key=lambda q: q.position)


# ---------- responses ----------
def get_published_form_by_slug(db: Session, slug: str) -> models.Form | None:
    return db.scalar(
        select(models.Form)
        .where(models.Form.slug == slug, models.Form.status == "published")
        .options(selectinload(models.Form.questions))
    )


def submit_response(db: Session, form: models.Form, answers_in) -> tuple[models.Response | None, dict[int, str]]:
    """Validate every question; on success persist the response in one transaction.

    Returns (response, errors). errors maps question_id -> message and is empty on success.
    """
    by_id = {q.id: q for q in form.questions}
    provided: dict[int, Any] = {}
    errors: dict[int, str] = {}

    for a in answers_in:
        if a.question_id not in by_id:
            # Ignore ids that don't belong to this form instead of trusting the client.
            continue
        provided[a.question_id] = a.value

    clean: dict[int, Any] = {}
    for q in form.questions:
        value, err = validate_answer(q, provided.get(q.id))
        if err:
            errors[q.id] = err
        elif value is not None:
            clean[q.id] = value

    if errors:
        return None, errors

    resp = models.Response(form_id=form.id, started_at=now(), submitted_at=now())
    db.add(resp)
    db.flush()
    for qid, value in clean.items():
        db.add(models.Answer(response_id=resp.id, question_id=qid, value=value))
    db.commit()
    db.refresh(resp)
    return resp, {}


def display_value(question: models.Question, value: Any) -> str:
    """Human readable string for a stored answer value."""
    if value is None:
        return ""
    t = question.type
    if t in CHOICE_TYPES:
        labels = {c["id"]: c["label"] for c in (question.properties or {}).get("choices", [])}
        vals = value if isinstance(value, list) else [value]
        return ", ".join(labels.get(v, str(v)) for v in vals)
    if t == "yes_no":
        return "Yes" if value is True else "No"
    if t == "rating":
        return f"{value} / {(question.properties or {}).get('max', 5)}"
    return str(value)


def form_stats(db: Session, form: models.Form) -> dict[str, Any]:
    total = db.scalar(select(func.count()).select_from(models.Response).where(models.Response.form_id == form.id)) or 0
    completed = db.scalar(
        select(func.count()).select_from(models.Response)
        .where(models.Response.form_id == form.id, models.Response.submitted_at.is_not(None))
    ) or 0

    answers = db.execute(
        select(models.Answer.question_id, models.Answer.value)
        .join(models.Response, models.Response.id == models.Answer.response_id)
        .where(models.Response.form_id == form.id, models.Response.submitted_at.is_not(None))
        .order_by(models.Answer.id.desc())
    ).all()
    by_q: dict[int, list[Any]] = {}
    for qid, val in answers:
        by_q.setdefault(qid, []).append(val)

    out = []
    for q in form.questions:
        vals = [v for v in by_q.get(q.id, []) if v not in (None, "", [])]
        item: dict[str, Any] = {
            "question_id": q.id, "title": q.title, "type": q.type,
            "answered": len(vals), "skipped": max(completed - len(vals), 0),
        }
        if q.type in CHOICE_TYPES:
            counts: dict[str, int] = {c["id"]: 0 for c in q.properties.get("choices", [])}
            for v in vals:
                for x in (v if isinstance(v, list) else [v]):
                    counts[x] = counts.get(x, 0) + 1
            labels = {c["id"]: c["label"] for c in q.properties.get("choices", [])}
            item["distribution"] = [
                {"label": labels.get(cid, cid), "count": n, "percent": round(100 * n / len(vals), 1) if vals else 0}
                for cid, n in counts.items()
            ]
        elif q.type == "yes_no":
            yes = sum(1 for v in vals if v is True)
            no = len(vals) - yes
            item["distribution"] = [
                {"label": "Yes", "count": yes, "percent": round(100 * yes / len(vals), 1) if vals else 0},
                {"label": "No", "count": no, "percent": round(100 * no / len(vals), 1) if vals else 0},
            ]
        elif q.type == "rating":
            mx = int(q.properties.get("max", 5))
            item["distribution"] = [
                {"label": str(i), "count": sum(1 for v in vals if v == i),
                 "percent": round(100 * sum(1 for v in vals if v == i) / len(vals), 1) if vals else 0}
                for i in range(1, mx + 1)
            ]
            item["average"] = round(sum(vals) / len(vals), 2) if vals else None
        elif q.type == "number":
            item["average"] = round(sum(vals) / len(vals), 2) if vals else None
            item["samples"] = [str(v) for v in vals[:5]]
        else:
            item["samples"] = [str(v) for v in vals[:5]]
        out.append(item)

    return {
        "total_responses": total,
        "completed": completed,
        "completion_rate": round(100 * completed / total, 1) if total else 0.0,
        "questions": out,
    }
