"""Password hashing + session tokens using only the standard library (no extra dependencies)."""
import hashlib
import hmac
import os
import secrets

# scrypt cost parameters (memory = 128 * N * r bytes = 16 MiB). Stored inside each hash,
# so they can be raised later without invalidating existing passwords.
_N, _R, _P, _DKLEN = 2**14, 8, 1, 32


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.scrypt(password.encode(), salt=salt, n=_N, r=_R, p=_P, dklen=_DKLEN)
    return f"scrypt${_N}${_R}${_P}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        scheme, n, r, p, salt, dk = stored.split("$")
        if scheme != "scrypt":
            return False
        expected = bytes.fromhex(dk)
        calc = hashlib.scrypt(
            password.encode(), salt=bytes.fromhex(salt), n=int(n), r=int(r), p=int(p), dklen=len(expected)
        )
        return hmac.compare_digest(calc, expected)  # constant-time compare
    except (ValueError, TypeError):
        return False


# Verified against when the email is unknown, so "no such user" and "wrong password"
# take about the same time (avoids leaking which emails have accounts via timing).
_DUMMY_HASH = hash_password("not-a-real-password")


def burn_verify(password: str) -> None:
    verify_password(password, _DUMMY_HASH)


def new_token() -> str:
    return secrets.token_urlsafe(32)  # 256 bits of randomness


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
