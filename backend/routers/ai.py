import os
import traceback
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from auth import get_current_user
import models

router = APIRouter(prefix="/ai", tags=["ai"])

_LANG = {"en": "English", "fr": "French", "ar": "Arabic"}

_SYSTEM = """You are a support assistant embedded in Stocky, a Moroccan e-commerce management app used by dropshippers and online store owners.

When given an error message, explain it clearly in plain language — no technical jargon. Tell the user exactly what caused it and what single action to take to fix it. Be concise (2-4 sentences max). If it involves a settings change, say exactly where to go (e.g. "Settings → Delivery → Olivraison").

Always respond in {lang}."""


class ExplainRequest(BaseModel):
    message: str
    page: str = ""
    lang: str = "en"


@router.post("/explain-error")
def explain_error(
    req: ExplainRequest,
    user: models.User = Depends(get_current_user),
):
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    print(f"[AI] key present: {bool(api_key)}, key prefix: {api_key[:8] if api_key else 'None'}")
    if not api_key:
        raise HTTPException(503, "AI assistance not configured")

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)

        lang_name = _LANG.get(req.lang, "English")
        page_ctx = f" on the {req.page} page" if req.page else ""

        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=200,
            system=_SYSTEM.format(lang=lang_name),
            messages=[
                {"role": "user", "content": f'I got this error{page_ctx}: "{req.message}"'}
            ],
        )
        return {"explanation": resp.content[0].text}

    except Exception as e:
        print(f"[AI] explain-error failed: {type(e).__name__}: {e}")
        traceback.print_exc()
        raise HTTPException(500, "AI request failed — please try again")
