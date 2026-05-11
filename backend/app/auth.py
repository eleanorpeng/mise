from __future__ import annotations

import logging
from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)


@lru_cache(maxsize=1)
def _jwks_client() -> jwt.PyJWKClient:
    """Cached JWKS client that fetches Supabase's public signing keys.

    Modern Supabase projects sign tokens with asymmetric keys (ES256/RS256)
    served at /auth/v1/.well-known/jwks.json. Legacy projects use a shared
    HS256 secret instead — those go through the fallback path below.
    """
    jwks_url = f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
    return jwt.PyJWKClient(jwks_url, cache_keys=True, lifespan=600)


def _decode_token(token: str) -> dict:
    """Decode a Supabase JWT, trying asymmetric (JWKS) first then HS256 fallback."""
    header = jwt.get_unverified_header(token)
    alg = header.get("alg", "HS256")

    if alg == "HS256":
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )

    # Asymmetric algorithms (ES256, RS256, EdDSA) — fetch the matching public key.
    signing_key = _jwks_client().get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=[alg],
        audience="authenticated",
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str:
    """Decode the Supabase JWT and return the user id (``sub`` claim).

    Raises 401 if the token is missing, expired, or invalid.
    """
    if credentials is None or not credentials.credentials:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")

    token = credentials.credentials

    try:
        payload = _decode_token(token)
    except jwt.ExpiredSignatureError:
        logger.warning("Auth failed: token expired")
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token expired")
    except jwt.InvalidAudienceError:
        logger.warning("Auth failed: invalid audience")
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token audience")
    except jwt.InvalidTokenError as exc:
        logger.warning("Auth failed: %s", exc)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    except Exception as exc:
        logger.exception("Auth failed: unexpected error verifying token")
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token") from exc

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token missing subject")

    return user_id
