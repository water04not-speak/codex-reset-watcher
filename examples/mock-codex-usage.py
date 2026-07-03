#!/usr/bin/env python3
"""Mock Codex-Usage data source for local UI testing (stdlib only, no secrets)."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def _make_resets() -> list[dict]:
    now = _now()
    return [
        {
            "reset_type": "codex_rate_limits",
            "status": "available",
            "granted_at": _iso(now - timedelta(days=12)),
            "expires_at": _iso(now + timedelta(days=18)),
        },
        {
            "reset_type": "codex_rate_limits",
            "status": "available",
            "granted_at": _iso(now - timedelta(days=6)),
            "expires_at": _iso(now + timedelta(days=2, hours=6)),
        },
        {
            "reset_type": "codex_rate_limits",
            "status": "expired",
            "granted_at": _iso(now - timedelta(days=35)),
            "expires_at": _iso(now - timedelta(days=3)),
        },
    ]


def _make_rate_limits() -> dict:
    now = _now()
    primary_reset = now + timedelta(hours=3, minutes=25)
    secondary_reset = now + timedelta(days=4, hours=8)
    return {
        "primary": {
            "used_percent": 38,
            "remaining_percent": 62,
            "resets_at": _iso(primary_reset),
            "reset_after_seconds": int((primary_reset - now).total_seconds()),
        },
        "secondary": {
            "used_percent": 67,
            "remaining_percent": 33,
            "resets_at": _iso(secondary_reset),
            "reset_after_seconds": int((secondary_reset - now).total_seconds()),
        },
    }


def _make_usage() -> dict:
    return {
        "today_tokens": 45210,
        "thirty_day_tokens": 1283400,
        "thirty_day_cost": None,
        "top_model": "example-model-mock",
    }


def _cmd_all() -> dict:
    return {
        "resets": _make_resets(),
        "rate_limits": _make_rate_limits(),
        "usage": _make_usage(),
    }


def main() -> int:
    if len(sys.argv) < 2:
        return 1

    command = sys.argv[1]
    if len(sys.argv) >= 3 and sys.argv[2] != "--json":
        return 1

    if command == "all":
        payload = _cmd_all()
    elif command == "resets":
        payload = {"resets": _make_resets()}
    elif command == "online-usage":
        payload = {"rate_limits": _make_rate_limits()}
    elif command == "local-usage":
        payload = {"usage": _make_usage()}
    else:
        return 1

    print(json.dumps(payload, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
