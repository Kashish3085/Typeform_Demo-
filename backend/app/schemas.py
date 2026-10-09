"""Pydantic request/response models (the API contract)."""
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .question_types import QUESTION_TYPES

QuestionType = Literal[
    "short_text", "long_text", "multiple_choice", "dropdown", "email", "number", "yes_no", "rating"
]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Questions ----------
class QuestionCreate(BaseModel):
    type: QuestionType
    title: str = ""
    description: str | None = None
    required: bool = False
    properties: dict[str, Any] | None = None  # None -> server fills type defaults
    position: int | None = None  # None -> append


class QuestionUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    required: bool | None = None
    properties: dict[str, Any] | None = None
    type: QuestionType | None = None


class QuestionOut(ORM):
    id: int
    form_id: int
    type: str
    title: str
    description: str | None
    required: bool
    position: int
    properties: dict[str, Any]


class ReorderIn(BaseModel):
    ordered_ids: list[int] = Field(min_length=0)


# ---------- Forms ----------
class FormCreate(BaseModel):
    title: str | None = Field(default=None, max_length=255)  # None -> template title or "New form"
    workspace_id: int | None = None  # None -> the user's first workspace
    template: str | None = None  # key into templates.TEMPLATES


class MoveIn(BaseModel):
    workspace_id: int


# ---------- Workspaces ----------
class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class WorkspaceUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class WorkspaceOut(BaseModel):
    id: int
    name: str
    form_count: int = 0


class UsageOut(BaseModel):
    responses_collected: int
    limit: int


class FormUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    welcome_title: str | None = None
    welcome_description: str | None = None
    welcome_button: str | None = None
    thank_you_title: str | None = None
    thank_you_message: str | None = None
    theme_background: str | None = None
    theme_question_color: str | None = None
    theme_button_color: str | None = None
    theme_font: str | None = None

    @field_validator("theme_background", "theme_question_color", "theme_button_color")
    @classmethod
    def _hex(cls, v):
        import re
        if v is not None and not re.fullmatch(r"#[0-9a-fA-F]{6}", v):
            raise ValueError("must be a #RRGGBB colour")
        return v


class FormSummary(ORM):
    """Row in the dashboard list."""
    id: int
    title: str
    status: str
    slug: str
    workspace_id: int
    response_count: int = 0
    question_count: int = 0
    completion_rate: float | None = None  # percent; None when nobody has started
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None


class FormOut(ORM):
    id: int
    workspace_id: int
    title: str
    status: str
    slug: str
    welcome_title: str | None
    welcome_description: str | None
    welcome_button: str
    thank_you_title: str
    thank_you_message: str
    theme_background: str
    theme_question_color: str
    theme_button_color: str
    theme_font: str
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None
    questions: list[QuestionOut]


class PublicQuestion(ORM):
    """What respondents see: no internal ids beyond question id, no owner info."""
    id: int
    type: str
    title: str
    description: str | None
    required: bool
    properties: dict[str, Any]


class PublicForm(ORM):
    title: str
    slug: str
    welcome_title: str | None
    welcome_description: str | None
    welcome_button: str
    thank_you_title: str
    thank_you_message: str
    theme_background: str
    theme_question_color: str
    theme_button_color: str
    theme_font: str
    questions: list[PublicQuestion]


# ---------- Responses ----------
class AnswerIn(BaseModel):
    question_id: int
    value: Any = None


class ResponseCreate(BaseModel):
    answers: list[AnswerIn]


class AnswerOut(BaseModel):
    question_id: int
    question_title: str
    question_type: str
    value: Any
    display: str  # human readable (choice ids -> labels)


class ResponseListItem(BaseModel):
    id: int
    submitted_at: datetime | None
    started_at: datetime
    answers: dict[int, str]  # question_id -> display string (for the table)


class ResponseDetail(BaseModel):
    id: int
    started_at: datetime
    submitted_at: datetime | None
    answers: list[AnswerOut]


class ResponseSubmitted(BaseModel):
    id: int
    thank_you_title: str
    thank_you_message: str


class QuestionSummary(BaseModel):
    question_id: int
    title: str
    type: str
    answered: int
    skipped: int
    # choice / yes_no / rating -> [{label, count, percent}]
    distribution: list[dict[str, Any]] | None = None
    # rating / number
    average: float | None = None
    # text-like -> latest few answers
    samples: list[str] | None = None


class FormSummaryStats(BaseModel):
    total_responses: int
    completed: int
    completion_rate: float
    questions: list[QuestionSummary]


# ---------- Auth ----------
class SignupIn(BaseModel):
    email: str = Field(max_length=255)
    password: str = Field(max_length=128)
    name: str | None = Field(default=None, max_length=120)


class LoginIn(BaseModel):
    email: str = Field(max_length=255)
    password: str = Field(max_length=128)


class UserOut(ORM):
    id: int
    name: str
    email: str


class AuthOut(BaseModel):
    token: str
    user: UserOut
