import base64
import os
from typing import List, Literal, Optional

from dotenv import load_dotenv

# Load .env file BEFORE any os.getenv() calls or imports that use env vars
load_dotenv()

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, HttpUrl

PROVIDER = os.getenv("AI_PROVIDER", "anthropic").lower()  # anthropic | openai
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Reasonable defaults for "recommended description"
DEFAULT_MAX_TOKENS = int(os.getenv("AI_MAX_TOKENS", "250"))

# Models are intentionally configurable so you can swap without code changes.
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-latest")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")  # must support vision if used


app = FastAPI(title="Dorm Space ML Service", version="0.1.0")


class AnalyzeListingRequest(BaseModel):
    image_urls: List[HttpUrl] = Field(min_length=1, max_length=6)
    category_hints: Optional[List[str]] = None
    max_tokens: int = Field(default=DEFAULT_MAX_TOKENS, ge=64, le=800)
    provider: Optional[Literal["anthropic", "openai"]] = None


class AnalyzeListingResponse(BaseModel):
    title: str
    description: str
    provider: str
    model: str


@app.get("/ml/health")
def health():
    return {"ok": True, "provider": PROVIDER}


def _prompt(category_hints: Optional[List[str]]) -> str:
    cats = ", ".join(category_hints or [])
    cats_line = f"Category hints: {cats}\n" if cats else ""
    return (
        "You write marketplace listings for college students.\n"
        "Analyze the image(s) and generate BOTH a title and description for this listing.\n\n"
        "Requirements:\n"
        "- Title: Short, descriptive, ALL CAPS (e.g., 'BLACK PATAGONIA DOWN JACKET'). Include brand if visible.\n"
        "- Description: 2 short paragraphs max. Write confidently using direct statements like 'The bag has...' or 'Features include...'. "
        "NEVER use passive or uncertain language like 'appears to', 'seems to', 'looks like', or 'may have'. "
        "Mention key visible features, brand/model if obvious, approximate size, and condition. "
        "Only describe what is clearly visible. Do not mention accessories or features you cannot see.\n"
        "- No emojis in either field\n\n"
        f"{cats_line}"
        "Respond with ONLY valid JSON in this exact format (no markdown, no explanation):\n"
        '{"title": "YOUR TITLE HERE", "description": "Your description here."}'
    )


async def _fetch_image_as_base64(url: str) -> tuple[str, str]:
    # Anthropic requires base64 image payloads; we fetch the presigned URLs server-side.
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        r = await client.get(url)
        r.raise_for_status()
        content_type = r.headers.get("content-type", "image/jpeg").split(";")[0].strip()
        data = base64.b64encode(r.content).decode("utf-8")
        return content_type, data


def _parse_json_response(text: str) -> dict:
    """Parse JSON from LLM response, handling markdown code blocks."""
    import json
    text = text.strip()
    # Remove markdown code blocks if present
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first line (```json or ```) and last line (```)
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"Failed to parse AI response as JSON: {e}")


async def _call_anthropic(req: AnalyzeListingRequest) -> AnalyzeListingResponse:
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not set")

    # Build multimodal content: text + images
    content = [{"type": "text", "text": _prompt(req.category_hints)}]
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
        raise HTTPException(status_code=502, detail="Anthropic returned empty response")

    parsed = _parse_json_response(text)
    title = parsed.get("title", "").strip()
    description = parsed.get("description", "").strip()
    if not title or not description:
        raise HTTPException(status_code=502, detail="AI response missing title or description")

    return AnalyzeListingResponse(
        title=title.upper(),
        description=description,
        provider="anthropic",
        model=ANTHROPIC_MODEL
    )


async def _call_openai(req: AnalyzeListingRequest) -> AnalyzeListingResponse:
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is not set")

    # OpenAI supports passing image URLs directly for vision-capable models.
    content = [{"type": "text", "text": _prompt(req.category_hints)}]
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
        raise HTTPException(status_code=502, detail="OpenAI returned empty response")

    parsed = _parse_json_response(text)
    title = parsed.get("title", "").strip()
    description = parsed.get("description", "").strip()
    if not title or not description:
        raise HTTPException(status_code=502, detail="AI response missing title or description")

    return AnalyzeListingResponse(
        title=title.upper(),
        description=description,
        provider="openai",
        model=OPENAI_MODEL
    )


@app.post("/ml/analyze-listing", response_model=AnalyzeListingResponse)
async def analyze_listing(req: AnalyzeListingRequest):
    provider = (req.provider or PROVIDER).lower()
    if provider not in ("anthropic", "openai"):
        raise HTTPException(status_code=400, detail="provider must be anthropic or openai")

    if provider == "anthropic":
        return await _call_anthropic(req)
    return await _call_openai(req)


