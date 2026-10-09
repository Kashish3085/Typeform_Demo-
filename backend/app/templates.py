"""Starter templates used by the dashboard suggestion cards and the AI panel.

Each template is plain data -> `crud.create_form(template=...)` turns it into rows.
"""
from typing import Any


def _choices(*labels: str) -> list[dict]:
    return [{"id": f"c{i + 1}", "label": l} for i, l in enumerate(labels)]


TEMPLATES: dict[str, dict[str, Any]] = {
    "feedback": {
        "title": "Audience feedback",
        "welcome_title": "Help us improve",
        "welcome_description": "Share your feedback and ideas - it takes about a minute.",
        "questions": [
            dict(type="rating", title="How would you rate the quality of our content?", required=True, properties={"max": 5}),
            dict(type="multiple_choice", title="What would you like to see more of?", required=False,
                 properties={"choices": _choices("Tutorials", "Case studies", "News", "Behind the scenes"), "allow_multiple": True}),
            dict(type="long_text", title="Any ideas or suggestions for us?", required=False, properties={"placeholder": "Type your answer here..."}),
            dict(type="email", title="Want a reply? Leave your email", required=False, properties={}),
        ],
    },
    "quiz": {
        "title": "Fun facts quiz",
        "welcome_title": "Test your knowledge",
        "welcome_description": "Five quick questions with fun facts.",
        "questions": [
            dict(type="multiple_choice", title="Which planet has the most moons?", required=True,
                 properties={"choices": _choices("Jupiter", "Saturn", "Uranus", "Neptune"), "allow_multiple": False}),
            dict(type="yes_no", title="Is a tomato technically a fruit?", required=True, properties={}),
            dict(type="dropdown", title="How many hearts does an octopus have?", required=True,
                 properties={"choices": _choices("1", "2", "3", "4")}),
            dict(type="number", title="In what year did the first web page go live?", required=False, properties={"min": 1900, "max": 2100}),
        ],
    },
    "contact": {
        "title": "Contact us",
        "questions": [
            dict(type="short_text", title="What's your name?", required=True, properties={}),
            dict(type="email", title="What's your email?", required=True, properties={}),
            dict(type="dropdown", title="What can we help you with?", required=True,
                 properties={"choices": _choices("Sales", "Support", "Partnership", "Other")}),
            dict(type="long_text", title="Tell us more", required=True, properties={}),
        ],
    },
    "registration": {
        "title": "Event registration",
        "welcome_title": "Join us!",
        "welcome_description": "Reserve your spot in under a minute.",
        "questions": [
            dict(type="short_text", title="Full name", required=True, properties={}),
            dict(type="email", title="Email address", required=True, properties={}),
            dict(type="number", title="How many guests are you bringing?", required=False, properties={"min": 0, "max": 10}),
            dict(type="yes_no", title="Will you need parking?", required=True, properties={}),
        ],
    },
}
