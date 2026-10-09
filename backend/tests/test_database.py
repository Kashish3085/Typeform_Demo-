from app.database import _normalize_database_url


def test_postgres_urls_use_psycopg_driver():
    assert _normalize_database_url("postgres://user:pass@host/db") == (
        "postgresql+psycopg://user:pass@host/db"
    )
    assert _normalize_database_url("postgresql://user:pass@host/db") == (
        "postgresql+psycopg://user:pass@host/db"
    )


def test_sqlite_url_stays_unchanged():
    assert _normalize_database_url("sqlite:///./typeform.db") == "sqlite:///./typeform.db"
