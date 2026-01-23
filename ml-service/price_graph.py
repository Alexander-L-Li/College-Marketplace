import json
import os
from statistics import median
from typing import Any, Dict, List, Optional, TypedDict

import httpx
from langgraph.graph import END, StateGraph

from ebay import search_comps


ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-latest")
AI_MAX_TOKENS = int(os.getenv("AI_MAX_TOKENS", "250"))


class PriceState(TypedDict, total=False):
    image_urls: List[str]
    title_hint: Optional[str]
    category_hints: Optional[List[str]]
    extracted: Dict[str, Any]
    query: str
    comps: List[Dict[str, Any]]
    stats: Dict[str, Any]
    recommendation: Dict[str, Any]


def _build_extract_prompt(title_hint: Optional[str], category_hints: Optional[List[str]]) -> str:
    cats = ", ".join(category_hints or [])
    return (
        "You are extracting structured attributes for price comparison.\n"
        "Look at the images and produce STRICT JSON only (no prose).\n"
        "Return keys:\n"
        '- "item_type": string (e.g. "desk lamp", "mini fridge")\n'
        '- "brand": string|null\n'
        '- "model": string|null\n'
        '- "condition": one of ["new","like_new","good","fair","parts"]\n'
        '- "keywords": string[] (3-8 search keywords)\n'
        '- "notes": string|null (short, <= 1 sentence)\n\n'
        f"Title hint: {title_hint or ''}\n"
        f"Category hints: {cats}\n"
    )


async def _fetch_image_as_base64(url: str) -> tuple[str, str]:
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        r = await client.get(url)
        r.raise_for_status()
        content_type = r.headers.get("content-type", "image/jpeg").split(";")[0].strip()
        import base64

        data = base64.b64encode(r.content).decode("utf-8")
        return content_type, data


async def _anthropic_vision_json(image_urls: List[str], prompt: str, max_tokens: int) -> Dict[str, Any]:
    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY not set")

    content: List[Dict[str, Any]] = [{"type": "text", "text": prompt}]
    for u in image_urls:
        media_type, b64 = await _fetch_image_as_base64(u)
        content.append({"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}})

    payload = {
        "model": ANTHROPIC_MODEL,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": content}],
    }

    async with httpx.AsyncClient(timeout=45.0) as client:
        r = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json=payload,
        )
        r.raise_for_status()
        data = r.json()

    text = ""
    for p in data.get("content", []) or []:
        if p.get("type") == "text":
            text += p.get("text", "")
    text = text.strip()
    if not text:
        raise RuntimeError("Empty LLM response")

    # Be resilient to surrounding text; try to find first JSON object.
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise RuntimeError(f"LLM did not return JSON: {text[:200]}")

    return json.loads(text[start : end + 1])


def _compute_stats(comps: List[Dict[str, Any]]) -> Dict[str, Any]:
    prices = [c["price"] for c in comps if isinstance(c.get("price"), (int, float))]
    prices = [p for p in prices if p > 0]
    prices.sort()
    if not prices:
        return {"count": 0}

    def percentile(pct: float) -> float:
        if len(prices) == 1:
            return float(prices[0])
        k = (len(prices) - 1) * pct
        f = int(k)
        c = min(f + 1, len(prices) - 1)
        if f == c:
            return float(prices[f])
        d0 = prices[f] * (c - k)
        d1 = prices[c] * (k - f)
        return float(d0 + d1)

    p25 = percentile(0.25)
    p50 = float(median(prices))
    p75 = percentile(0.75)

    # Guard: if spread is tiny, widen slightly.
    low = max(0.0, p25)
    high = max(low, p75)
    if high - low < max(2.0, 0.1 * p50):
        low = max(0.0, p50 * 0.9)
        high = p50 * 1.1

    return {"count": len(prices), "p25": low, "p50": p50, "p75": high}


async def _node_extract(state: PriceState) -> Dict[str, Any]:
    prompt = _build_extract_prompt(state.get("title_hint"), state.get("category_hints"))
    extracted = await _anthropic_vision_json(state["image_urls"], prompt, max_tokens=min(350, AI_MAX_TOKENS))

    keywords = extracted.get("keywords") or []
    if not isinstance(keywords, list):
        keywords = []
    keywords = [str(x).strip() for x in keywords if str(x).strip()]

    item_type = extracted.get("item_type") or (state.get("title_hint") or "")
    brand = extracted.get("brand") or ""
    model = extracted.get("model") or ""

    # Build a query string (conservative, avoids overfitting)
    parts = []
    for p in [brand, model, item_type]:
        p = str(p).strip()
        if p:
            parts.append(p)
    parts.extend(keywords[:5])
    query = " ".join(dict.fromkeys(parts))  # de-dupe keep order
    if not query:
        query = state.get("title_hint") or "dorm item"

    return {"extracted": extracted, "query": query}


async def _node_fetch_comps(state: PriceState) -> Dict[str, Any]:
    comps = await search_comps(state["query"], limit=25)
    # Filter obvious junk
    comps = [c for c in comps if c.get("currency") and c.get("price")]
    return {"comps": comps}


async def _node_stats(state: PriceState) -> Dict[str, Any]:
    stats = _compute_stats(state.get("comps") or [])
    return {"stats": stats}


async def _node_recommend(state: PriceState) -> Dict[str, Any]:
    stats = state.get("stats") or {}
    comps = state.get("comps") or []
    currency = "USD"
    for c in comps:
        if c.get("currency"):
            currency = c["currency"]
            break

    if stats.get("count", 0) < 3:
        rec = {
            "currency": currency,
            "suggested_price": None,
            "low": None,
            "high": None,
            "confidence": "low",
            "rationale": "Not enough comparable listings found on eBay to make a confident recommendation.",
        }
    else:
        low = float(stats["p25"])
        high = float(stats["p75"])
        suggested = float(stats["p50"])
        rec = {
            "currency": currency,
            "suggested_price": round(suggested, 2),
            "low": round(low, 2),
            "high": round(high, 2),
            "confidence": "medium",
            "rationale": "Based on the median and interquartile range of similar eBay listings (active listings).",
        }

    # Include a small comps sample for UI/debug
    sample = comps[:5]
    rec["comps_sample"] = [
        {"title": c.get("title"), "price": c.get("price"), "currency": c.get("currency"), "url": c.get("url")}
        for c in sample
    ]

    return {"recommendation": rec}


def build_price_graph():
    g = StateGraph(PriceState)
    g.add_node("extract", _node_extract)
    g.add_node("fetch_comps", _node_fetch_comps)
    g.add_node("stats", _node_stats)
    g.add_node("recommend", _node_recommend)

    g.set_entry_point("extract")
    g.add_edge("extract", "fetch_comps")
    g.add_edge("fetch_comps", "stats")
    g.add_edge("stats", "recommend")
    g.add_edge("recommend", END)

    return g.compile()


