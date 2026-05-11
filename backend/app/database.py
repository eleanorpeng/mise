from supabase import create_client, Client
from app.config import settings

_client: Client | None = None


def get_supabase() -> Client:
    global _client
    if _client is None:
        _client = create_client(settings.supabase_url, settings.supabase_service_key)
    return _client


class _LazyClient:
    """Proxy that defers ``create_client`` until the first attribute access."""

    def __getattr__(self, name: str):
        return getattr(get_supabase(), name)


supabase: Client = _LazyClient()  # type: ignore[assignment]


def maybe_single(res) -> dict | None:
    """Safely read .data from a `.maybe_single().execute()` call.

    supabase-py returns ``None`` (not an APIResponse) when no row matches —
    so ``res.data`` raises AttributeError. Always go through this helper.
    """
    if res is None:
        return None
    return getattr(res, "data", None)
