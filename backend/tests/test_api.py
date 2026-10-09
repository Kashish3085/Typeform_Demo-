"""API tests. Run from backend/:  pytest -q

Uses an in-memory-ish temp SQLite file so tests never touch typeform.db.
"""
import os
import tempfile

_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp.name}"
os.environ["SEED_ON_START"] = "1"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


DEMO = {"email": "demo@example.com", "password": "demo1234"}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:  # context manager runs the lifespan (create tables + seed)
        token = c.post("/api/auth/login", json=DEMO).json()["token"]
        c.headers["Authorization"] = f"Bearer {token}"  # every creator request is authenticated
        yield c


def _published(client):
    forms = client.get("/api/forms").json()
    return next(f for f in forms if f["status"] == "published")


def test_seed_data_present(client):
    forms = client.get("/api/forms").json()
    assert len(forms) == 3
    assert sum(f["status"] == "published" for f in forms) == 2
    fb = next(f for f in forms if f["title"] == "Customer Feedback Survey")
    assert fb["response_count"] == 12  # partial responses are not counted
    assert fb["question_count"] == 8


def test_form_crud_and_duplicate(client):
    f = client.post("/api/forms", json={"title": "My form"}).json()
    assert f["status"] == "draft" and len(f["questions"]) == 1
    assert client.patch(f"/api/forms/{f['id']}", json={"title": "Renamed"}).json()["title"] == "Renamed"
    assert client.patch(f"/api/forms/{f['id']}", json={"title": "  "}).status_code == 422
    dup = client.post(f"/api/forms/{f['id']}/duplicate").json()
    assert dup["title"] == "Renamed (copy)" and dup["slug"] != f["slug"]
    assert client.delete(f"/api/forms/{f['id']}").status_code == 204
    assert client.get(f"/api/forms/{f['id']}").status_code == 404
    client.delete(f"/api/forms/{dup['id']}")


def test_question_add_reorder_delete(client):
    f = client.post("/api/forms", json={"title": "Q test"}).json()
    q2 = client.post(f"/api/forms/{f['id']}/questions", json={"type": "email", "title": "Email"}).json()
    q3 = client.post(f"/api/forms/{f['id']}/questions", json={"type": "rating", "title": "Rate"}).json()
    assert q3["properties"] == {"max": 5}
    ids = [q["id"] for q in client.get(f"/api/forms/{f['id']}").json()["questions"]]
    assert len(ids) == 3
    new_order = list(reversed(ids))
    r = client.put(f"/api/forms/{f['id']}/questions/order", json={"ordered_ids": new_order})
    assert [q["id"] for q in r.json()] == new_order
    # incomplete order list is rejected
    assert client.put(f"/api/forms/{f['id']}/questions/order", json={"ordered_ids": ids[:2]}).status_code == 422
    assert client.delete(f"/api/questions/{q2['id']}").status_code == 204
    positions = [q["position"] for q in client.get(f"/api/forms/{f['id']}").json()["questions"]]
    assert positions == [0, 1]  # renumbered, no gaps
    client.delete(f"/api/forms/{f['id']}")


def test_publish_rules_and_public_access(client):
    f = client.post("/api/forms", json={"title": "Pub"}).json()
    # first question has an empty title -> cannot publish
    assert client.post(f"/api/forms/{f['id']}/publish").status_code == 422
    client.patch(f"/api/questions/{f['questions'][0]['id']}", json={"title": "Your name?"})
    assert client.get(f"/api/public/forms/{f['slug']}").status_code == 404  # still a draft
    assert client.post(f"/api/forms/{f['id']}/publish").json()["status"] == "published"
    assert client.get(f"/api/public/forms/{f['slug']}").status_code == 200
    client.post(f"/api/forms/{f['id']}/unpublish")
    assert client.get(f"/api/public/forms/{f['slug']}").status_code == 404
    client.delete(f"/api/forms/{f['id']}")


def test_submit_validation(client):
    form = _published(client)
    detail = client.get(f"/api/forms/{form['id']}").json()
    slug = detail["slug"]
    qs = {q["type"]: q for q in detail["questions"]}

    # required missing + bad email -> 422 with per-question errors
    r = client.post(f"/api/public/forms/{slug}/responses", json={"answers": [
        {"question_id": qs["email"]["id"], "value": "not-an-email"}]})
    assert r.status_code == 422
    errs = r.json()["errors"]
    assert str(qs["email"]["id"]) in errs and str(qs["short_text"]["id"]) in errs


def test_submit_success_and_results(client):
    form = next(f for f in client.get("/api/forms").json() if f["title"] == "Customer Feedback Survey")
    detail = client.get(f"/api/forms/{form['id']}").json()
    q = detail["questions"]
    mc = next(x for x in q if x["type"] == "multiple_choice")
    answers = [
        {"question_id": q[0]["id"], "value": "Test User"},
        {"question_id": q[1]["id"], "value": "test@example.com"},
        {"question_id": mc["id"], "value": "c2"},
        {"question_id": q[3]["id"], "value": 5},
        {"question_id": q[4]["id"], "value": True},
    ]
    r = client.post(f"/api/public/forms/{detail['slug']}/responses", json={"answers": answers})
    assert r.status_code == 201

    rows = client.get(f"/api/forms/{form['id']}/responses").json()
    assert len(rows) == 13
    detail_resp = client.get(f"/api/forms/{form['id']}/responses/{r.json()['id']}").json()
    assert detail_resp["answers"][2]["display"] == "Social media"
    assert len(detail_resp["answers"]) == 8  # skipped questions still listed

    stats = client.get(f"/api/forms/{form['id']}/summary").json()
    assert stats["completed"] == 13 and stats["total_responses"] == 17
    assert 0 < stats["completion_rate"] < 100

    csv_text = client.get(f"/api/forms/{form['id']}/export.csv").text
    assert csv_text.splitlines()[0].startswith("Response ID,Submitted at")
    assert "Test User" in csv_text


def test_rejects_invalid_values(client):
    from app.question_types import validate_answer
    from app.models import Question

    num = Question(type="number", required=True, properties={"min": 1, "max": 10})
    assert validate_answer(num, "abc")[1]
    assert validate_answer(num, 11)[1]
    assert validate_answer(num, True)[1]  # bool is not a number
    assert validate_answer(num, "5") == (5, None)

    rating = Question(type="rating", required=True, properties={"max": 5})
    assert validate_answer(rating, 6)[1]
    assert validate_answer(rating, 3) == (3, None)

    mc = Question(type="multiple_choice", required=False,
                  properties={"choices": [{"id": "a", "label": "A"}, {"id": "b", "label": "B"}], "allow_multiple": False})
    assert validate_answer(mc, ["a", "b"])[1]  # single-select
    assert validate_answer(mc, "zzz")[1]
    assert validate_answer(mc, None) == (None, None)  # optional + empty is fine


def test_unpublished_form_cannot_receive_responses(client):
    draft = next(f for f in client.get("/api/forms").json() if f["status"] == "draft")
    slug = draft["slug"]
    r = client.post(f"/api/public/forms/{slug}/responses", json={"answers": []})
    assert r.status_code == 404


def test_timestamps_are_timezone_aware(client):
    # Naive timestamps would be misread as local time by browsers.
    f = client.get("/api/forms").json()[0]
    assert f["created_at"].endswith("Z") or f["created_at"].endswith("+00:00")


def test_workspaces_and_move(client):
    ws = client.get("/api/workspaces").json()
    names = [w["name"] for w in ws]
    assert names[0] == "My workspace" and "Events" in names
    assert sum(w["form_count"] for w in ws) == len(client.get("/api/forms").json())

    new_ws = client.post("/api/workspaces", json={"name": "Marketing"}).json()
    assert new_ws["form_count"] == 0
    assert client.post("/api/workspaces", json={"name": "   "}).status_code == 422

    f = client.post("/api/forms", json={"title": "In marketing", "workspace_id": new_ws["id"]}).json()
    assert f["workspace_id"] == new_ws["id"]
    in_ws = client.get(f"/api/forms?workspace_id={new_ws['id']}").json()
    assert [x["id"] for x in in_ws] == [f["id"]]

    default_id = ws[0]["id"]
    assert client.post(f"/api/forms/{f['id']}/move", json={"workspace_id": default_id}).json()["workspace_id"] == default_id
    assert client.post(f"/api/forms/{f['id']}/move", json={"workspace_id": 99999}).status_code == 404

    renamed = client.patch(f"/api/workspaces/{new_ws['id']}", json={"name": "Growth"}).json()
    assert renamed["name"] == "Growth"
    assert client.delete(f"/api/workspaces/{new_ws['id']}").status_code == 204
    client.delete(f"/api/forms/{f['id']}")


def test_templates_and_completion_rate(client):
    f = client.post("/api/forms", json={"template": "quiz"}).json()
    assert f["title"] == "Fun facts quiz" and len(f["questions"]) == 4
    assert f["welcome_title"] == "Test your knowledge"
    assert client.post("/api/forms", json={"template": "nope"}).status_code == 422
    client.delete(f"/api/forms/{f['id']}")

    blank = client.post("/api/forms", json={}).json()
    assert blank["title"] == "New form" and len(blank["questions"]) == 1
    client.delete(f"/api/forms/{blank['id']}")

    fb = next(x for x in client.get("/api/forms").json() if x["title"] == "Customer Feedback Survey")
    assert 0 < fb["completion_rate"] < 100  # seeded abandoned responses
    fresh = next(x for x in client.get("/api/forms").json() if x["status"] == "draft")
    assert fresh["completion_rate"] is None


def test_usage(client):
    u = client.get("/api/usage").json()
    assert u["responses_collected"] >= 18 and u["limit"] > 0


# ---------------- authentication ----------------
def _anon():
    return TestClient(app)  # no lifespan needed: the module-scoped client already booted the app


def test_requires_login(client):
    anon = _anon()
    assert anon.get("/api/forms").status_code == 401
    assert anon.get("/api/workspaces").status_code == 401
    assert anon.post("/api/forms", json={}).status_code == 401
    assert anon.get("/api/forms", headers={"Authorization": "Bearer nonsense"}).status_code == 401
    # public respondent endpoints stay open
    slug = next(f for f in client.get("/api/forms").json() if f["status"] == "published")["slug"]
    assert anon.get(f"/api/public/forms/{slug}").status_code == 200


def test_signup_login_me_logout(client):
    anon = _anon()
    r = anon.post("/api/auth/signup", json={"email": "  New.User@Example.com ", "password": "hunter2hunter2", "name": "New User"})
    assert r.status_code == 201
    body = r.json()
    assert body["user"]["email"] == "new.user@example.com" and body["user"]["name"] == "New User"
    h = {"Authorization": f"Bearer {body['token']}"}

    assert anon.get("/api/auth/me", headers=h).json()["email"] == "new.user@example.com"
    # a new account starts with exactly one empty workspace and no forms
    assert [w["name"] for w in anon.get("/api/workspaces", headers=h).json()] == ["My workspace"]
    assert anon.get("/api/forms", headers=h).json() == []

    # log in again (email is case-insensitive) -> a second, independent session
    r2 = anon.post("/api/auth/login", json={"email": "NEW.USER@example.com", "password": "hunter2hunter2"})
    assert r2.status_code == 200 and r2.json()["token"] != body["token"]

    # logout revokes only that token
    assert anon.post("/api/auth/logout", headers=h).status_code == 204
    assert anon.get("/api/auth/me", headers=h).status_code == 401
    h2 = {"Authorization": f"Bearer {r2.json()['token']}"}
    assert anon.get("/api/auth/me", headers=h2).status_code == 200


def test_signup_validation_and_duplicates(client):
    anon = _anon()
    assert anon.post("/api/auth/signup", json={"email": "not-an-email", "password": "longenough1"}).status_code == 422
    assert anon.post("/api/auth/signup", json={"email": "a@b.co", "password": "short"}).status_code == 422
    dup = anon.post("/api/auth/signup", json={"email": "DEMO@example.com", "password": "whatever123"})
    assert dup.status_code == 409


def test_login_failures_and_throttle(client):
    anon = _anon()
    anon.post("/api/auth/signup", json={"email": "throttle@example.com", "password": "correct-horse"})
    bad = {"email": "throttle@example.com", "password": "wrong-password"}
    codes = [anon.post("/api/auth/login", json=bad).status_code for _ in range(5)]
    assert codes == [401] * 5
    assert anon.post("/api/auth/login", json=bad).status_code == 429
    # even the right password is refused while locked out
    assert anon.post("/api/auth/login", json={"email": "throttle@example.com", "password": "correct-horse"}).status_code == 429
    # unknown emails give the same message as wrong passwords (no account enumeration on login)
    r = anon.post("/api/auth/login", json={"email": "ghost@example.com", "password": "whatever123"})
    assert r.status_code == 401 and r.json()["detail"] == "Incorrect email or password"


def test_accounts_are_isolated(client):
    anon = _anon()
    other = anon.post("/api/auth/signup", json={"email": "other@example.com", "password": "otherpass123"}).json()
    h = {"Authorization": f"Bearer {other['token']}"}

    demo_form = next(f for f in client.get("/api/forms").json() if f["status"] == "published")
    # the other user can't read, edit, delete, list results of, or move the demo user's form
    assert anon.get(f"/api/forms/{demo_form['id']}", headers=h).status_code == 404
    assert anon.patch(f"/api/forms/{demo_form['id']}", json={"title": "hacked"}, headers=h).status_code == 404
    assert anon.delete(f"/api/forms/{demo_form['id']}", headers=h).status_code == 404
    assert anon.get(f"/api/forms/{demo_form['id']}/responses", headers=h).status_code == 404
    assert anon.get(f"/api/forms/{demo_form['id']}/export.csv", headers=h).status_code == 404
    # ...nor put their own form into the demo user's workspace
    mine = anon.post("/api/forms", json={}, headers=h).json()
    demo_ws = client.get("/api/workspaces").json()[0]["id"]
    assert anon.post(f"/api/forms/{mine['id']}/move", json={"workspace_id": demo_ws}, headers=h).status_code == 404
    assert anon.post("/api/forms", json={"workspace_id": demo_ws}, headers=h).status_code == 422
    # usage counts only your own responses
    assert anon.get("/api/usage", headers=h).json()["responses_collected"] == 0
    # the demo form is untouched
    assert client.get(f"/api/forms/{demo_form['id']}").json()["title"] == demo_form["title"]


def test_password_hashing():
    from app import security
    h = security.hash_password("s3cret-pass")
    assert h.startswith("scrypt$") and "s3cret-pass" not in h
    assert security.verify_password("s3cret-pass", h)
    assert not security.verify_password("s3cret-pasS", h)
    assert security.hash_password("s3cret-pass") != h  # per-hash random salt
    assert not security.verify_password("x", None) and not security.verify_password("x", "garbage")
