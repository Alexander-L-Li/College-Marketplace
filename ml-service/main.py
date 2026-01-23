import base64
import os
from typing import List, Literal, Optional

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, HttpUrl

from price_graph import build_price_graph

PROVIDER = os.getenv("AI_PROVIDER", "anthropic").lower()  # anthropic | openai
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Reasonable defaults for "recommended description"
DEFAULT_MAX_TOKENS = int(os.getenv("AI_MAX_TOKENS", "250"))

# Models are intentionally configurable so you can swap without code changes.
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-latest")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")  # must support vision if used


app = FastAPI(title="Dorm Space ML Service", version="0.1.0")

_price_graph = build_price_graph()


class AnalyzeListingRequest(BaseModel):
    image_urls: List[HttpUrl] = Field(min_length=1, max_length=6)
    title_hint: Optional[str] = None
    category_hints: Optional[List[str]] = None
    max_tokens: int = Field(default=DEFAULT_MAX_TOKENS, ge=64, le=800)
    provider: Optional[Literal["anthropic", "openai"]] = None


class AnalyzeListingResponse(BaseModel):
    description: str
    provider: str
    model: str


class RecommendPriceRequest(BaseModel):
    image_urls: List[HttpUrl] = Field(min_length=1, max_length=6)
    title_hint: Optional[str] = None
    category_hints: Optional[List[str]] = None


class RecommendPriceResponse(BaseModel):
    currency: str
    suggested_price: Optional[float] = None
    low: Optional[float] = None
    high: Optional[float] = None
    confidence: str
    rationale: str
    comps_sample: List[dict] = Field(default_factory=list)


@app.get("/ml/health")
def health():
    return {"ok": True, "provider": PROVIDER}


def _prompt(title_hint: Optional[str], category_hints: Optional[List[str]]) -> str:
    cats = ", ".join(category_hints or [])
    title_line = f"Title hint: {title_hint}\n" if title_hint else ""
    cats_line = f"Category hints: {cats}\n" if cats else ""
    return (
        "You write marketplace listings for college students.\n"
        "Generate a recommended listing description based ONLY on the images.\n"
        "Constraints:\n"
        "- 2 short paragraphs max\n"
        "- Mention key visible features, brand/model if obvious, approximate size, and condition cues\n"
        "- Avoid hallucinating missing accessories\n"
        "- No emojis\n\n"
        f"{title_line}{cats_line}"
    )


async def _fetch_image_as_base64(url: str) -> tuple[str, str]:
    # Anthropic requires base64 image payloads; we fetch the presigned URLs server-side.
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        r = await client.get(url)
        r.raise_for_status()
        content_type = r.headers.get("content-type", "image/jpeg").split(";")[0].strip()
        data = base64.b64encode(r.content).decode("utf-8")
        return content_type, data


async def _call_anthropic(req: AnalyzeListingRequest) -> AnalyzeListingResponse:
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not set")

    # Build multimodal content: text + images
    content = [{"type": "text", "text": _prompt(req.title_hint, req.category_hints)}]
    for u in req.image_urls:
        media_type, b64 = await _fetch_image_as_base64(str(u))
        content.append(
            {
                "type": "image",
                "source": {"type": "base64", "media_type": media_type, "data": b64},
            }
        )

    payload = {
        "model": ANTHROPIC_MODEL,
        "max_tokens": req.max_tokens,
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
        if r.status_code >= 400:
            raise HTTPException(status_code=502, detail=f"Anthropic error: {r.text}")
        data = r.json()

    # Typical response shape: content: [{type:"text", text:"..."}]
    parts = data.get("content", [])
    text = ""
    for p in parts:
        if p.get("type") == "text":
            text += p.get("text", "")
    text = text.strip()
    if not text:
        raise HTTPException(status_code=502, detail="Anthropic returned empty description")

    return AnalyzeListingResponse(description=text, provider="anthropic", model=ANTHROPIC_MODEL)


async def _call_openai(req: AnalyzeListingRequest) -> AnalyzeListingResponse:
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is not set")

    # OpenAI supports passing image URLs directly for vision-capable models.
    content = [{"type": "text", "text": _prompt(req.title_hint, req.category_hints)}]
    for u in req.image_urls:
        content.append({"type": "image_url", "image_url": {"url": str(u)}})

    payload = {
        "model": OPENAI_MODEL,
        "messages": [{"role": "user", "content": content}],
        "max_tokens": req.max_tokens,
    }

    async with httpx.AsyncClient(timeout=45.0) as client:
        r = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"authorization": f"Bearer {OPENAI_API_KEY}"},
            json=payload,
        )
        if r.status_code >= 400:
            raise HTTPException(status_code=502, detail=f"OpenAI error: {r.text}")
        data = r.json()

    try:
        text = data["choices"][0]["message"]["content"].strip()
    except Exception:
        raise HTTPException(status_code=502, detail="OpenAI returned unexpected response")

    if not text:
        raise HTTPException(status_code=502, detail="OpenAI returned empty description")

    return AnalyzeListingResponse(description=text, provider="openai", model=OPENAI_MODEL)


@app.post("/ml/analyze-listing", response_model=AnalyzeListingResponse)
async def analyze_listing(req: AnalyzeListingRequest):
    provider = (req.provider or PROVIDER).lower()
    if provider not in ("anthropic", "openai"):
        raise HTTPException(status_code=400, detail="provider must be anthropic or openai")

    if provider == "anthropic":
        return await _call_anthropic(req)
    return await _call_openai(req)


@app.post("/ml/recommend-price", response_model=RecommendPriceResponse)
async def recommend_price(req: RecommendPriceRequest):
    try:
        result = await _price_graph.ainvoke(
            {
                "image_urls": [str(u) for u in req.image_urls],
                "title_hint": req.title_hint,
                "category_hints": req.category_hints,
            }
        )
        rec = result.get("recommendation") or {}
        return RecommendPriceResponse(
            currency=rec.get("currency") or "USD",
            suggested_price=rec.get("suggested_price"),
            low=rec.get("low"),
            high=rec.get("high"),
            confidence=rec.get("confidence") or "low",
            rationale=rec.get("rationale") or "",
            comps_sample=rec.get("comps_sample") or [],
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Price recommendation failed: {e}")


