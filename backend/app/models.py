"""ORM models.

Schema overview (1 -> N):
    User -> AuthSession (logins)
    User -> Workspace -> Form -> Question
    User -> Form (owner)
    Form -> Response -> Answer (-> Question)

Design notes:
* Question.properties and Answer.value are JSON columns. Each question type
  needs different config (choices, rating max, ...) and each answer has a
  different shape (str, number, bool, list). Keeping them as JSON avoids a
  table per question type while the relational skeleton stays normalised.
* Answer has a UNIQUE(response_id, question_id) so a response can't hold two
  answers for the same question.
* Questions are ordered with an integer `position` and reordered in one
  transaction.
* Form.slug is the public identifier. Internal integer ids are never exposed on
  public URLs, so published forms can't be enumerated.
"""
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    JSON, Boolean, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """Store datetimes as naive UTC, return them as tz-aware UTC.

    SQLite has no timezone support and hands back naive datetimes, which Pydantic
    would serialise without a 'Z' - browsers then parse them as *local* time.
    Normalising at the column-type level fixes every timestamp in one place.
    """
    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is not None:
            value = value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    def process_result_value(self, value, dialect):
        return None if value is None else value.replace(tzinfo=timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    # scrypt hash string (see security.py). NULL would mean "no password login" (e.g. future OAuth-only users).
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    sessions: Mapped[list["AuthSession"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    forms: Mapped[list["Form"]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    workspaces: Mapped[list["Workspace"]] = relationship(back_populates="owner", cascade="all, delete-orphan")


class AuthSession(Base):
    """One logged-in browser/device. Only the SHA-256 of the bearer token is stored, so a leaked
    database dump cannot be replayed as live sessions."""
    __tablename__ = "auth_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime)

    user: Mapped["User"] = relationship(back_populates="sessions")


class Workspace(Base):
    """A folder of forms in the dashboard's left rail (Typeform: Workspaces)."""
    __tablename__ = "workspaces"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    owner: Mapped[User] = relationship(back_populates="workspaces")
    forms: Mapped[list["Form"]] = relationship(back_populates="workspace", cascade="all, delete-orphan")


class Form(Base):
    __tablename__ = "forms"
    __table_args__ = (Index("ix_forms_user_updated", "user_id", "updated_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255), default="Untitled form")
    status: Mapped[str] = mapped_column(String(16), default="draft")  # draft | published
    slug: Mapped[str] = mapped_column(String(32), unique=True, index=True)

    # Welcome / thank-you screens
    welcome_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    welcome_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    welcome_button: Mapped[str] = mapped_column(String(60), default="Start")
    thank_you_title: Mapped[str] = mapped_column(String(255), default="Thanks for completing this form!")
    thank_you_message: Mapped[str] = mapped_column(Text, default="Made with Typeform clone")

    # Theme (bonus): stored as columns - small, fixed set of knobs
    theme_background: Mapped[str] = mapped_column(String(16), default="#FFFFFF")
    theme_question_color: Mapped[str] = mapped_column(String(16), default="#262627")
    theme_button_color: Mapped[str] = mapped_column(String(16), default="#262627")
    theme_font: Mapped[str] = mapped_column(String(40), default="Inter")

    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)
    published_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)

    owner: Mapped[User] = relationship(back_populates="forms")
    workspace: Mapped[Workspace] = relationship(back_populates="forms")
    questions: Mapped[list["Question"]] = relationship(
        back_populates="form", cascade="all, delete-orphan", order_by="Question.position"
    )
    responses: Mapped[list["Response"]] = relationship(back_populates="form", cascade="all, delete-orphan")


class Question(Base):
    __tablename__ = "questions"
    __table_args__ = (Index("ix_questions_form_position", "form_id", "position"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    form_id: Mapped[int] = mapped_column(ForeignKey("forms.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(24))
    title: Mapped[str] = mapped_column(Text, default="")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    required: Mapped[bool] = mapped_column(Boolean, default=False)
    position: Mapped[int] = mapped_column(Integer, default=0)
    # type specific config, e.g. {"choices": [{"id": "a", "label": "Yes"}]}, {"max": 5}
    properties: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    form: Mapped[Form] = relationship(back_populates="questions")


class Response(Base):
    __tablename__ = "responses"
    __table_args__ = (Index("ix_responses_form_submitted", "form_id", "submitted_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    form_id: Mapped[int] = mapped_column(ForeignKey("forms.id", ondelete="CASCADE"))
    started_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    submitted_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)

    form: Mapped[Form] = relationship(back_populates="responses")
    answers: Mapped[list["Answer"]] = relationship(back_populates="response", cascade="all, delete-orphan")

    @property
    def completed(self) -> bool:
        return self.submitted_at is not None


class Answer(Base):
    __tablename__ = "answers"
    __table_args__ = (UniqueConstraint("response_id", "question_id", name="uq_answer_response_question"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    response_id: Mapped[int] = mapped_column(ForeignKey("responses.id", ondelete="CASCADE"))
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), index=True)
    value: Mapped[Any] = mapped_column(JSON, nullable=True)

    response: Mapped[Response] = relationship(back_populates="answers")
    question: Mapped[Question] = relationship()
