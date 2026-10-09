"""Seed demo data so the app is usable immediately. Idempotent."""
import random
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import auth, crud, models


def _choices(*labels: str) -> list[dict]:
    return [{"id": f"c{i + 1}", "label": l} for i, l in enumerate(labels)]


def _mk_form(db: Session, user, title: str, status: str, questions: list[dict], **extra) -> models.Form:
    # Forms go in the default workspace unless the caller passes workspace_id.
    extra.setdefault("workspace_id", crud.get_default_workspace(db, user).id)
    form = models.Form(
        user_id=user.id, title=title, status=status, slug=crud.new_slug(db),
        published_at=crud.now() if status == "published" else None, **extra,
    )
    db.add(form)
    db.flush()
    for i, q in enumerate(questions):
        db.add(models.Question(form_id=form.id, position=i, **q))
    db.flush()
    return form


def seed(db: Session) -> None:
    if db.scalar(select(models.Form.id).limit(1)):
        return  # already seeded
    rnd = random.Random(42)
    user = auth.get_or_create_demo_user(db)
    events_ws = models.Workspace(user_id=user.id, name="Events")
    crud.get_default_workspace(db, user)  # make sure "My workspace" exists first (lowest id)
    db.add(events_ws)
    db.flush()

    # ---- 1. Customer feedback: every type represented ----
    feedback = _mk_form(
        db, user, "Customer Feedback Survey", "published",
        [
            dict(type="short_text", title="What's your name?", required=True,
                 description="First name is fine.", properties={"placeholder": "Type your answer here..."}),
            dict(type="email", title="What's your email address?", required=True,
                 description="We'll only use it to follow up on your feedback.", properties={}),
            dict(type="multiple_choice", title="How did you hear about us?", required=True,
                 properties={"choices": _choices("Friend or colleague", "Social media", "Search engine", "Newsletter", "Other"),
                             "allow_multiple": False}),
            dict(type="rating", title="How would you rate your overall experience?", required=True,
                 description="1 is poor, 5 is excellent.", properties={"max": 5}),
            dict(type="yes_no", title="Would you recommend us to a friend?", required=True, properties={}),
            dict(type="dropdown", title="Which product do you use most?", required=False,
                 properties={"choices": _choices("Starter", "Pro", "Business", "Enterprise")}),
            dict(type="number", title="How many people are on your team?", required=False,
                 properties={"min": 1, "max": 10000}),
            dict(type="long_text", title="Anything else you'd like to tell us?", required=False,
                 description="Feature requests, bugs, praise - all welcome.",
                 properties={"placeholder": "Type your answer here..."}),
        ],
        welcome_title="We'd love your feedback",
        welcome_description="This takes about 2 minutes.",
        thank_you_title="Thanks for your feedback!",
        thank_you_message="Every response helps us build a better product.",
    )

    # ---- 2. Event registration: themed ----
    event = _mk_form(
        db, user, "Product Meetup Registration", "published",
        [
            dict(type="short_text", title="Full name", required=True, properties={}),
            dict(type="email", title="Work email", required=True, properties={}),
            dict(type="multiple_choice", title="Which sessions will you attend?", required=True,
                 description="Choose as many as you like.",
                 properties={"choices": _choices("Keynote", "Workshop: Design systems", "Workshop: APIs", "Networking mixer"),
                             "allow_multiple": True}),
            dict(type="yes_no", title="Do you have any dietary restrictions?", required=True, properties={}),
            dict(type="long_text", title="Tell us about them", required=False, properties={}),
        ],
        thank_you_title="You're registered!", thank_you_message="See you at the meetup.",
        workspace_id=events_ws.id,
        theme_background="#0B2C4D", theme_question_color="#FFFFFF", theme_button_color="#3FA9F5",
    )

    # ---- 3. Draft ----
    _mk_form(
        db, user, "Job Application (draft)", "draft",
        [
            dict(type="short_text", title="Your full name", required=True, properties={}),
            dict(type="dropdown", title="Role you're applying for", required=True,
                 properties={"choices": _choices("Frontend Engineer", "Backend Engineer", "Designer")}),
        ],
    )
    db.flush()

    # ---- Responses ----
    names = ["Aarav Sharma", "Priya Singh", "Rohan Mehta", "Ananya Gupta", "Kabir Khan", "Isha Verma",
             "Vihaan Patel", "Diya Nair", "Arjun Reddy", "Meera Iyer", "Sahil Bansal", "Tara Joshi"]
    comments = ["Love the product!", "Onboarding could be smoother.", "Pricing page is confusing.",
                "Great support team.", "Please add dark mode."]

    fq = feedback.questions if feedback.questions else db.scalars(
        select(models.Question).where(models.Question.form_id == feedback.id).order_by(models.Question.position)).all()
    base = crud.now()
    for i, name in enumerate(names):
        t = base - timedelta(days=rnd.randint(0, 20), hours=rnd.randint(0, 23))
        r = models.Response(form_id=feedback.id, started_at=t - timedelta(minutes=3), submitted_at=t)
        db.add(r)
        db.flush()
        vals = {
            0: name,
            1: f"{name.split()[0].lower()}{i}@example.com",
            2: f"c{rnd.randint(1, 5)}",
            3: rnd.choice([3, 4, 4, 5, 5, 5, 2]),
            4: rnd.random() < 0.75,
            5: f"c{rnd.randint(1, 4)}" if rnd.random() < 0.8 else None,
            6: rnd.choice([1, 3, 5, 12, 40]) if rnd.random() < 0.7 else None,
            7: rnd.choice(comments) if rnd.random() < 0.6 else None,
        }
        for idx, v in vals.items():
            if v is not None:
                db.add(models.Answer(response_id=r.id, question_id=fq[idx].id, value=v))

    # a few abandoned (partial) responses -> drives completion rate
    for _ in range(4):
        db.add(models.Response(form_id=feedback.id, started_at=base - timedelta(days=rnd.randint(0, 10)), submitted_at=None))

    eq = db.scalars(select(models.Question).where(models.Question.form_id == event.id).order_by(models.Question.position)).all()
    for i in range(6):
        t = base - timedelta(days=rnd.randint(0, 14), hours=rnd.randint(0, 23))
        r = models.Response(form_id=event.id, started_at=t - timedelta(minutes=2), submitted_at=t)
        db.add(r)
        db.flush()
        diet = rnd.random() < 0.3
        vals = {
            0: names[i], 1: f"{names[i].split()[0].lower()}@company.com",
            2: rnd.sample(["c1", "c2", "c3", "c4"], k=rnd.randint(1, 3)),
            3: diet, 4: "Vegetarian" if diet else None,
        }
        for idx, v in vals.items():
            if v is not None:
                db.add(models.Answer(response_id=r.id, question_id=eq[idx].id, value=v))

    db.commit()
