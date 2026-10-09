"""Single source of truth for question types on the backend.

Adding a new question type = add an entry to QUESTION_TYPES, a branch in
`validate_answer`, and a renderer on the frontend.
"""
import re
from typing import Any

QUESTION_TYPES = {
    "short_text",
    "long_text",
    "multiple_choice",
    "dropdown",
    "email",
    "number",
    "yes_no",
    "rating",
}

CHOICE_TYPES = {"multiple_choice", "dropdown"}

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def default_properties(qtype: str) -> dict[str, Any]:
    """Sensible defaults when a creator adds a new question of this type."""
    if qtype in CHOICE_TYPES:
        return {
            "choices": [
                {"id": "c1", "label": "Choice 1"},
                {"id": "c2", "label": "Choice 2"},
                {"id": "c3", "label": "Choice 3"},
            ],
            "allow_multiple": False,
        }
    if qtype == "rating":
        return {"max": 5}
    if qtype == "number":
        return {"min": None, "max": None}
    if qtype in {"short_text", "long_text"}:
        return {"placeholder": "Type your answer here...", "max_length": None}
    return {}


def is_empty(value: Any) -> bool:
    return value is None or value == "" or value == []


def validate_answer(question, value: Any) -> tuple[Any, str | None]:
    """Validate + normalise one answer against a question.

    Returns (clean_value, error_message). `question` is a models.Question.
    This is the authoritative server-side check; the frontend runs the same
    rules only for instant feedback.
    """
    props = question.properties or {}

    if is_empty(value):
        if question.required:
            return None, "This question is required"
        return None, None

    t = question.type

    if t in {"short_text", "long_text"}:
        if not isinstance(value, str):
            return None, "Answer must be text"
        value = value.strip()
        if question.required and not value:
            return None, "This question is required"
        max_len = props.get("max_length")
        if max_len and len(value) > int(max_len):
            return None, f"Must be at most {max_len} characters"
        if len(value) > 10_000:
            return None, "Answer is too long"
        return value, None

    if t == "email":
        if not isinstance(value, str) or not _EMAIL_RE.match(value.strip()):
            return None, "Hmm... that email doesn't look right"
        return value.strip(), None

    if t == "number":
        # bool is a subclass of int in Python - reject it explicitly
        if isinstance(value, bool):
            return None, "Please enter a number"
        try:
            num = float(value)
        except (TypeError, ValueError):
            return None, "Please enter a number"
        if num != num or num in (float("inf"), float("-inf")):
            return None, "Please enter a valid number"
        lo, hi = props.get("min"), props.get("max")
        if lo is not None and num < lo:
            return None, f"Must be at least {lo}"
        if hi is not None and num > hi:
            return None, f"Must be at most {hi}"
        return (int(num) if num.is_integer() else num), None

    if t == "yes_no":
        if isinstance(value, bool):
            return value, None
        if value in ("yes", "no"):
            return value == "yes", None
        return None, "Please choose Yes or No"

    if t == "rating":
        mx = int(props.get("max", 5))
        if isinstance(value, bool) or not isinstance(value, (int, float)) or int(value) != value:
            return None, "Please select a rating"
        if not 1 <= int(value) <= mx:
            return None, f"Rating must be between 1 and {mx}"
        return int(value), None

    if t in CHOICE_TYPES:
        valid_ids = {c["id"] for c in props.get("choices", [])}
        allow_multiple = bool(props.get("allow_multiple")) and t == "multiple_choice"
        values = value if isinstance(value, list) else [value]
        if not allow_multiple and len(values) > 1:
            return None, "Please select only one option"
        if any(v not in valid_ids for v in values):
            return None, "Invalid option selected"
        if len(values) != len(set(values)):
            return None, "Duplicate options selected"
        return (values if allow_multiple else values[0]), None

    return None, "Unsupported question type"
