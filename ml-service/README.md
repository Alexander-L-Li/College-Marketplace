## Dorm Space ML Service (FastAPI)

This is a small **FastAPI** microservice that generates a **recommended listing description** from listing image URLs.

### Endpoints

- `GET /ml/health`
- `POST /ml/analyze-listing`

### Environment variables

- `AI_PROVIDER`: `anthropic` (default) or `openai`
- `ANTHROPIC_API_KEY`: required for `anthropic`
- `OPENAI_API_KEY`: required for `openai`
- `ANTHROPIC_MODEL`: default `claude-3-5-sonnet-latest`
- `OPENAI_MODEL`: default `gpt-4o-mini` (must support vision if used)
- `AI_MAX_TOKENS`: default `250`

### Run locally

From repo root:

```bash
cd ml-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
AI_PROVIDER=anthropic ANTHROPIC_API_KEY=... uvicorn main:app --reload --port 8000
```
