"""
GitHub OAuth handler.

Supabase SQL to run before deploying:
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_id TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    avatar_url TEXT,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

Required .env vars:
  GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, JWT_SECRET,
  FRONTEND_URL (e.g. http://localhost:3000)
"""

import os
import json
import urllib.request
import urllib.parse
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from jose import jwt
from supabase import create_client

app = FastAPI()

GITHUB_CLIENT_ID = os.environ.get("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.environ.get("GITHUB_CLIENT_SECRET", "")
JWT_SECRET = os.environ.get("JWT_SECRET", "change-me-in-production")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")


def _github_get(url: str, token: str) -> dict:
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def _exchange_code(code: str) -> str:
    data = urllib.parse.urlencode({
        "client_id": GITHUB_CLIENT_ID,
        "client_secret": GITHUB_CLIENT_SECRET,
        "code": code,
    }).encode()
    req = urllib.request.Request(
        "https://github.com/login/oauth/access_token",
        data=data,
        headers={"Accept": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        payload = json.loads(resp.read())
    return payload.get("access_token", "")


@app.get("/auth/github")
async def github_login():
    callback = f"{os.environ.get('API_BASE_URL', 'http://localhost:3001')}/auth/github/callback"
    params = urllib.parse.urlencode({
        "client_id": GITHUB_CLIENT_ID,
        "redirect_uri": callback,
        "scope": "user:email",
    })
    return RedirectResponse(f"https://github.com/login/oauth/authorize?{params}")


@app.get("/auth/github/callback")
async def github_callback(code: str = ""):
    if not code:
        return RedirectResponse(f"{FRONTEND_URL}/login?error=no_code")

    try:
        access_token = _exchange_code(code)
        if not access_token:
            return RedirectResponse(f"{FRONTEND_URL}/login?error=token_exchange_failed")

        user_info = _github_get("https://api.github.com/user", access_token)
        github_id = str(user_info.get("id", ""))
        username = user_info.get("login", "")
        avatar_url = user_info.get("avatar_url", "")
        email = user_info.get("email", "")

        # Upsert user in Supabase
        if SUPABASE_URL and SUPABASE_KEY:
            try:
                sb = create_client(SUPABASE_URL, SUPABASE_KEY)
                existing = sb.table("users").select("id").eq("github_id", github_id).execute()
                if existing.data:
                    user_id = existing.data[0]["id"]
                    sb.table("users").update({
                        "username": username, "avatar_url": avatar_url, "email": email,
                    }).eq("id", user_id).execute()
                else:
                    result = sb.table("users").insert({
                        "github_id": github_id, "username": username,
                        "avatar_url": avatar_url, "email": email,
                    }).execute()
                    user_id = result.data[0]["id"]
            except Exception:
                # Fall back to using github_id as userId if DB is unavailable
                user_id = f"gh-{github_id}"
        else:
            user_id = f"gh-{github_id}"

        # Sign JWT
        payload = {
            "sub": user_id,
            "username": username,
            "avatar_url": avatar_url,
            "exp": datetime.now(timezone.utc) + timedelta(days=30),
        }
        token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")

        redirect_params = urllib.parse.urlencode({
            "token": token,
            "userId": user_id,
            "username": username,
            "avatarUrl": avatar_url,
        })
        return RedirectResponse(f"{FRONTEND_URL}/auth/callback?{redirect_params}")

    except Exception as exc:
        return RedirectResponse(f"{FRONTEND_URL}/login?error={urllib.parse.quote(str(exc))}")
