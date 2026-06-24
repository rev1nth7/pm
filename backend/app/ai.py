"""Server-side OpenAI access, isolated behind a tiny injectable client.

Cost control (see docs/PLAN.md Part 8): default to the cheapest capable model,
cap output tokens on every call, and only ever call on demand. A connectivity
"2+2" call is a fraction of a cent; the OpenAI dashboard monthly hard limit is
the real ceiling.
"""

import os
from typing import Protocol, TypeVar

from openai import OpenAI
from pydantic import BaseModel

DEFAULT_MODEL = "gpt-4.1-nano"  # cheapest capable model; fallback gpt-4o-mini
PING_MAX_TOKENS = 16  # a bare number answer needs almost nothing
BOARD_MAX_TOKENS = 2000  # enough to return a full board, but no higher

T = TypeVar("T", bound=BaseModel)


class AIError(Exception):
    """Raised when the AI call cannot be completed (missing key or API failure).

    The message is always key-free so it is safe to surface to clients.
    """


class AIClient(Protocol):
    model: str

    def ask(self, prompt: str) -> str: ...

    def parse(self, messages: list[dict], response_format: type[T]) -> T: ...


class OpenAIClient:
    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY")
        self.model = model or os.environ.get("OPENAI_MODEL", DEFAULT_MODEL)
        self._client: OpenAI | None = None

    def _ensure_client(self) -> OpenAI:
        if not self.api_key:
            raise AIError("OPENAI_API_KEY is not configured")
        if self._client is None:
            self._client = OpenAI(api_key=self.api_key)
        return self._client

    def ask(self, prompt: str, max_tokens: int = PING_MAX_TOKENS) -> str:
        client = self._ensure_client()
        try:
            response = client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_completion_tokens=max_tokens,
            )
        except Exception as exc:  # network/auth/rate-limit etc.
            raise AIError("OpenAI request failed") from exc
        return (response.choices[0].message.content or "").strip()

    def parse(self, messages: list[dict], response_format: type[T], max_tokens: int = BOARD_MAX_TOKENS) -> T:
        client = self._ensure_client()
        try:
            completion = client.chat.completions.parse(
                model=self.model,
                messages=messages,
                response_format=response_format,
                max_completion_tokens=max_tokens,
            )
        except Exception as exc:
            raise AIError("OpenAI request failed") from exc
        message = completion.choices[0].message
        if message.refusal:
            raise AIError("OpenAI refused the request")
        if message.parsed is None:
            raise AIError("OpenAI returned no parseable result")
        return message.parsed
