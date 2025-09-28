#!/usr/bin/env python3
"""
Context7 Integration Module for FazAI

Functions:
- Search technical documentation and code snippets via Context7 API
- Fetch documentation snippets for a given library/topic
- Optional local caching to avoid repeated requests

Usage (CLI):
  search: context7_module.py search --query "react hook form" [--max 5]
  get:    context7_module.py get --id "/vercel/next.js" [--type json] [--tokens 5000]

Environment:
  CONTEXT7_API_KEY   (required for real calls)
  API7_URL           (default: https://context7.com/api/v1)

The module prints JSON to stdout for easy consumption by FazAI (Node side).
"""

import os
import sys
import json
import time
import argparse
from typing import Any, Dict, List

DEFAULT_API_URL = os.environ.get("API7_URL", "https://context7.com/api/v1").rstrip("/")
DEFAULT_API_KEY = os.environ.get("CONTEXT7_API_KEY", "")

CACHE_FILE = "/var/lib/fazai/context7_cache.json"
CACHE_TTL_SEC = 60 * 60  # 1 hour


def _ensure_cache_dir():
    try:
        base = os.path.dirname(CACHE_FILE)
        if base and not os.path.isdir(base):
            os.makedirs(base, exist_ok=True)
    except Exception:
        pass


def _load_cache() -> Dict[str, Any]:
    try:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _save_cache(cache: Dict[str, Any]) -> None:
    try:
        _ensure_cache_dir()
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(cache, f)
    except Exception:
        pass


def _cache_get(cache_key: str):
    cache = _load_cache()
    entry = cache.get(cache_key)
    if not entry:
        return None
    if time.time() - entry.get("ts", 0) > CACHE_TTL_SEC:
        return None
    return entry.get("data")


def _cache_set(cache_key: str, data: Any):
    cache = _load_cache()
    cache[cache_key] = {"ts": time.time(), "data": data}
    _save_cache(cache)


def _http_get(url: str, headers: Dict[str, str]) -> Any:
    # Prefer aiohttp if available, fallback to requests
    try:
        import aiohttp
        import asyncio

        async def _fetch():
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers, timeout=30) as resp:
                    resp.raise_for_status()
                    ct = resp.headers.get("Content-Type", "")
                    if "application/json" in ct:
                        return await resp.json()
                    return await resp.text()

        return asyncio.get_event_loop().run_until_complete(_fetch())
    except Exception:
        # Fallback: urllib (sem dependências externas)
        import urllib.request
        import urllib.error
        req = urllib.request.Request(url, headers=headers, method='GET')
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                ct = resp.headers.get("Content-Type", "")
                body = resp.read()
                if isinstance(body, bytes):
                    body = body.decode('utf-8', errors='replace')
                if "application/json" in ct:
                    return json.loads(body)
                return body
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"HTTP {e.code}: {e.reason}")


def context7_search(query: str, max_items: int = 5) -> Dict[str, Any]:
    if not DEFAULT_API_KEY:
        return {"ok": False, "error": "CONTEXT7_API_KEY not set", "results": []}

    cache_key = f"search::{query}::{max_items}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return {"ok": True, "cached": True, "results": cached}

    url = f"{DEFAULT_API_URL}/search?query={query.replace(' ', '+')}"
    headers = {"Authorization": f"Bearer {DEFAULT_API_KEY}"}
    try:
        data = _http_get(url, headers)
        # Normalize
        results: List[Dict[str, Any]] = []
        for item in data.get("results", [])[:max_items]:
            results.append({
                "id": item.get("id"),
                "title": item.get("title"),
                "description": item.get("description"),
                "totalTokens": item.get("totalTokens"),
                "totalSnippets": item.get("totalSnippets"),
                "stars": item.get("stars"),
                "trustScore": item.get("trustScore"),
            })
        _cache_set(cache_key, results)
        return {"ok": True, "results": results}
    except Exception as e:
        return {"ok": False, "error": str(e), "results": []}


def context7_get(doc_id: str, resp_type: str = "json", tokens: int = 5000) -> Dict[str, Any]:
    if not DEFAULT_API_KEY:
        return {"ok": False, "error": "CONTEXT7_API_KEY not set", "docs": []}

    cache_key = f"get::{doc_id}::{resp_type}::{tokens}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return {"ok": True, "cached": True, "docs": cached}

    # Ensure doc_id begins with /
    if not doc_id.startswith("/"):
        doc_id = "/" + doc_id
    url = f"{DEFAULT_API_URL}{doc_id}?type={resp_type}&tokens={int(tokens)}"
    headers = {"Authorization": f"Bearer {DEFAULT_API_KEY}"}
    try:
        data = _http_get(url, headers)
        # Already a list of objects when type=json
        if isinstance(data, list):
            docs = data
        else:
            docs = [data]
        _cache_set(cache_key, docs)
        return {"ok": True, "docs": docs}
    except Exception as e:
        return {"ok": False, "error": str(e), "docs": []}


def main():
    parser = argparse.ArgumentParser(description="Context7 integration for FazAI")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p1 = sub.add_parser("search")
    p1.add_argument("--query", required=True)
    p1.add_argument("--max", type=int, default=5)

    p2 = sub.add_parser("get")
    p2.add_argument("--id", required=True)
    p2.add_argument("--type", default="json")
    p2.add_argument("--tokens", type=int, default=5000)

    args = parser.parse_args()
    if args.cmd == "search":
        out = context7_search(args.query, args.max)
    else:
        out = context7_get(args.id, args.type, args.tokens)
    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
