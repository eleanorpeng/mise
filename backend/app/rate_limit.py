from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request


def _user_key(request: Request) -> str:
    """Rate-limit per authenticated user, falling back to client IP.

    The bearer token uniquely identifies a user, so we key on it directly
    rather than re-decoding the JWT here. Unauthenticated requests (which
    every OpenAI-backed route rejects anyway) fall back to remote address.
    """
    auth = request.headers.get("authorization")
    if auth and auth.lower().startswith("bearer "):
        return auth[7:]
    return get_remote_address(request)


limiter = Limiter(key_func=_user_key)
