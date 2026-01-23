import base64
import os
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import httpx


EBAY_ENV = os.getenv("EBAY_ENV", "production").lower()  # production | sandbox
EBAY_CLIENT_ID = os.getenv("EBAY_CLIENT_ID")
EBAY_CLIENT_SECRET = os.getenv("EBAY_CLIENT_SECRET")
EBAY_MARKETPLACE_ID = os.getenv("EBAY_MARKETPLACE_ID", "EBAY_US")


def _ebay_base_url() -> str:
    if EBAY_ENV == "sandbox":
        return "https://api.sandbox.ebay.com"
    return "https://api.ebay.com"


@dataclass
class EbayToken:
    access_token: str
    expires_at_ms: int


_token_cache: Optional[EbayToken] = None


async def _get_oauth_token() -> str:
    """
    eBay client_credentials OAuth token for Browse API.
    Docs: https://developer.ebay.com/api-docs/static/oauth-client-credentials-grant.html
    """
    global _token_cache

    if not EBAY_CLIENT_ID or not EBAY_CLIENT_SECRET:
        raise RuntimeError("EBAY_CLIENT_ID/EBAY_CLIENT_SECRET not set")

    now = int(time.time() * 1000)
    if _token_cache and now < (_token_cache.expires_at_ms - 30_000):
        return _token_cache.access_token

    basic = base64.b64encode(f"{EBAY_CLIENT_ID}:{EBAY_CLIENT_SECRET}".encode("utf-8")).decode(
        "utf-8"
    )
    token_url = f"{_ebay_base_url()}/identity/v1/oauth2/token"

    # Scope for Browse API (buy/browse)
    data = {
        "grant_type": "client_credentials",
        "scope": "https://api.ebay.com/oauth/api_scope",
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.post(
            token_url,
            headers={
                "authorization": f"Basic {basic}",
                "content-type": "application/x-www-form-urlencoded",
            },
            data=data,
        )
        r.raise_for_status()
        payload = r.json()

    access_token = payload.get("access_token")
    expires_in = int(payload.get("expires_in", 0))
    if not access_token or expires_in <= 0:
        raise RuntimeError(f"Unexpected eBay token response: {payload}")

    _token_cache = EbayToken(access_token=access_token, expires_at_ms=now + expires_in * 1000)
    return access_token


async def search_comps(
    query: str,
    *,
    limit: int = 25,
    currency: str = "USD",
    condition: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Search for similar items via Browse API and return normalized comps.
    Note: Browse API typically surfaces active listings (not sold comps).
    """
    token = await _get_oauth_token()
    url = f"{_ebay_base_url()}/buy/browse/v1/item_summary/search"

    params = {"q": query, "limit": str(max(1, min(50, limit)))}

    # condition filter: eBay condition ids are numeric; keeping simple for now.
    # If you want stricter matching, map your extracted condition -> eBay conditionIds.
    _ = condition

    headers = {
        "authorization": f"Bearer {token}",
        "X-EBAY-C-MARKETPLACE-ID": EBAY_MARKETPLACE_ID,
        "accept": "application/json",
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.get(url, headers=headers, params=params)
        r.raise_for_status()
        data = r.json()

    out: List[Dict[str, Any]] = []
    for item in data.get("itemSummaries", []) or []:
        price = (item.get("price") or {}) if isinstance(item, dict) else {}
        val = price.get("value")
        cur = price.get("currency", currency)
        try:
            val_f = float(val)
        except Exception:
            continue

        out.append(
            {
                "title": item.get("title"),
                "price": val_f,
                "currency": cur,
                "condition": item.get("condition"),
                "url": item.get("itemWebUrl"),
                "id": item.get("itemId"),
            }
        )

    return out


