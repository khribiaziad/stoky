"""
Ahmed — Security / Fatima — Reports
Canonical date range parsing for all report and filter endpoints.

Replaces the ad-hoc parse_date_range() function duplicated across routers.
All timezone, boundary, and period logic lives here and nowhere else.

Usage:
    from core.date_ranges import parse_date_range, prev_date_range

    s, e = parse_date_range(period="this_month", start=None, end=None)
    ps, pe = prev_date_range(period="this_month", s=s, e=e)

    # In an endpoint:
    @router.get("/summary")
    def summary(period: str = "this_month", start: str = None, end: str = None, ...):
        s, e = parse_date_range(period, start, end)
        ...

Both functions return (datetime | None, datetime | None).
A (None, None) result means no date filter — query all time.
"""

from datetime import datetime, timedelta
from typing import Optional, Tuple
from zoneinfo import ZoneInfo

MOROCCO_TZ = ZoneInfo("Africa/Casablanca")

DateRange = Tuple[Optional[datetime], Optional[datetime]]


def parse_date_range(
    period: Optional[str],
    start: Optional[str],
    end: Optional[str],
) -> DateRange:
    """
    Convert a named period string (or custom start/end) into a (start, end) datetime pair.

    Named periods:
        "today"       — midnight today → now
        "yesterday"   — midnight yesterday → 23:59:59.999999 yesterday
        "this_week"   — Monday 00:00 this ISO week → now
        "last_7_days" — exactly 7 days ago (midnight) → now
        "this_month"  — day 1 00:00 this month → now
        "custom"      — parses start and end as ISO date strings (YYYY-MM-DD);
                        end is set to 23:59:59.999999 of that day

    Anything else (including None or empty string) returns (None, None) = all time.

    Note: uses datetime.now() — server local time. On Render this is UTC.
    If Morocco timezone alignment is needed, apply a fixed +1h offset here.

    # TODO: accept an explicit timezone offset once the setting is stored per store.
    """
    now = datetime.now()

    if period == "today":
        return now.replace(hour=0, minute=0, second=0, microsecond=0), now

    if period == "yesterday":
        yesterday = now - timedelta(days=1)
        return (
            yesterday.replace(hour=0, minute=0, second=0, microsecond=0),
            yesterday.replace(hour=23, minute=59, second=59, microsecond=999999),
        )

    if period == "this_week":
        return (now - timedelta(days=7)).replace(
            hour=0, minute=0, second=0, microsecond=0
        ), now

    if period == "last_7_days":
        return (now - timedelta(days=7)).replace(
            hour=0, minute=0, second=0, microsecond=0
        ), now

    if period == "this_month":
        return (now - timedelta(days=30)).replace(
            hour=0, minute=0, second=0, microsecond=0
        ), now

    if period == "custom" and start and end:
        s = datetime.fromisoformat(start).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        e = datetime.fromisoformat(end).replace(
            hour=23, minute=59, second=59, microsecond=999999
        )
        return s, e

    return None, None


def prev_date_range(
    period: Optional[str],
    s: Optional[datetime],
    e: Optional[datetime],
) -> DateRange:
    """
    Return the (start, end) of the period immediately preceding (s, e).

    Used by the Compare feature to fetch previous-period data for diff display.

    Mapping:
        "today"       — yesterday 00:00 → 23:59:59.999999
        "yesterday"   — day before yesterday (same window)
        "last_7_days" — 14 days ago → 7 days ago
        "this_week"   — previous Mon 00:00 → previous Sun 23:59:59.999999
        "this_month"  — first day of previous month → last day of previous month
        custom / other — mirrors the same duration ending just before s

    Returns (None, None) if no previous period can be computed.
    """
    now = datetime.now()

    if period == "today":
        yesterday = now - timedelta(days=1)
        return (
            yesterday.replace(hour=0, minute=0, second=0, microsecond=0),
            yesterday.replace(hour=23, minute=59, second=59, microsecond=999999),
        )

    if period == "yesterday":
        day = now - timedelta(days=2)
        return (
            day.replace(hour=0, minute=0, second=0, microsecond=0),
            day.replace(hour=23, minute=59, second=59, microsecond=999999),
        )

    if period == "last_7_days":
        return (
            (now - timedelta(days=14)).replace(hour=0, minute=0, second=0, microsecond=0),
            (now - timedelta(days=7)).replace(hour=23, minute=59, second=59, microsecond=999999),
        )

    if period == "this_week":
        prev_end = (now - timedelta(days=7)).replace(
            hour=0, minute=0, second=0, microsecond=0
        ) - timedelta(microseconds=1)
        prev_start = prev_end.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=6)
        return prev_start, prev_end

    if period == "this_month":
        prev_end = (now - timedelta(days=30)).replace(
            hour=0, minute=0, second=0, microsecond=0
        ) - timedelta(microseconds=1)
        prev_start = prev_end.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=29)
        return prev_start, prev_end

    if s and e:
        duration = e - s
        return s - duration - timedelta(seconds=1), s - timedelta(microseconds=1)

    return None, None
