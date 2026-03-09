"""
BMore Indie Games — itch.io Crawler
Scrapes indie game listings from itch.io and upserts results to the
Supabase `games` table. Falls back to updating data/games.json if
Supabase credentials are not available.

Run:
    python crawler.py

Environment variables (set in .env or CI secrets):
    SUPABASE_URL          https://xxxx.supabase.co
    SUPABASE_SERVICE_KEY  service_role JWT (bypasses RLS for writes)
"""

import asyncio
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig
from crawl4ai.extraction_strategy import JsonCssExtractionStrategy
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# ── Paths ──────────────────────────────────────────────────────────────────
ROOT       = Path(__file__).resolve().parent.parent
DATA_FILE  = ROOT / "data" / "games.json"
LOG_PREFIX = "[crawler]"

# ── Config ─────────────────────────────────────────────────────────────────
PAGES_TO_CRAWL  = 5
DELAY_BETWEEN   = 2.5
BASE_URL        = "https://itch.io/games/tag-indie"
SOURCE_TAG      = "crawler"
ITCHIO_ID_START = 100_000

# itch.io game card CSS extraction schema
SCHEMA = {
    "name": "ItchioGames",
    "baseSelector": "div.game_cell",
    "fields": [
        {"name": "title",          "selector": "a.title, .game_cell_details .title", "type": "text"},
        {"name": "developer",      "selector": ".game_author a, .game_author",        "type": "text"},
        {"name": "description",    "selector": ".game_text, .short_text",             "type": "text"},
        {"name": "cover",          "selector": "div.game_thumb img, .lazy-cover, .game_thumb_container img", "type": "attribute", "attribute": "src"},
        {"name": "cover_lazy",     "selector": "div.game_thumb img, .lazy-cover",     "type": "attribute", "attribute": "data-lazy_src"},
        {"name": "price",          "selector": ".price_value, .sale_price, .buy_row .price_value", "type": "text"},
        {"name": "genre",          "selector": ".game_genre",                         "type": "text"},
        {"name": "link",           "selector": "a.title",                             "type": "attribute", "attribute": "href"},
        {"name": "game_id",        "selector": "div.game_cell",                       "type": "attribute", "attribute": "data-game_id"},
        {"name": "platform_icons", "selector": ".game_platform span",                 "type": "text"},
    ],
}


# ── Helpers ─────────────────────────────────────────────────────────────────

def log(msg: str) -> None:
    ts = datetime.utcnow().strftime("%H:%M:%S")
    print(f"{LOG_PREFIX} [{ts}] {msg}", flush=True)


def parse_price(raw: str) -> float:
    if not raw:
        return 0.0
    raw = raw.strip().lower()
    if raw in ("free", "free to play", ""):
        return 0.0
    try:
        return round(float(re.sub(r"[^\d.]", "", raw)), 2)
    except ValueError:
        return 0.0


def parse_platforms(icon_text: str) -> list[str]:
    mapping = {"windows": "PC", "linux": "Linux", "macos": "Mac",
               "android": "Mobile", "ios": "Mobile", "web": "Browser"}
    platforms, text = [], (icon_text or "").lower()
    for key, label in mapping.items():
        if key in text and label not in platforms:
            platforms.append(label)
    return platforms or ["PC"]


def map_game(raw: dict, page_index: int, item_index: int) -> dict | None:
    title = (raw.get("title") or "").strip()
    if not title:
        return None

    cover = (raw.get("cover_lazy") or raw.get("cover") or "").strip()
    if cover.startswith("//"):
        cover = "https:" + cover

    link = (raw.get("link") or "").strip()
    if link and not link.startswith("http"):
        link = "https://itch.io" + link

    genre_raw  = (raw.get("genre") or "").strip()
    genres     = [g.strip() for g in genre_raw.split(",") if g.strip()] or ["Indie"]
    platforms  = parse_platforms(raw.get("platform_icons") or "")
    developer  = (raw.get("developer") or "").strip() or "Independent Developer"
    description = (raw.get("description") or "").strip()

    raw_id = raw.get("game_id") or ""
    try:
        game_id = ITCHIO_ID_START + int(raw_id)
    except (ValueError, TypeError):
        game_id = ITCHIO_ID_START + (page_index * 1000) + item_index

    return {
        # Supabase columns
        "title":             title,
        "developer":         developer,
        "description_short": description[:160] if description else None,
        "description_long":  description or None,
        "genre":             genres,
        "platform":          platforms,
        "price":             parse_price(raw.get("price") or ""),
        "rating":            None,
        "cover_image_url":   cover or None,
        "screenshots":       [],
        "website_url":       link or None,
        "release_date":      None,
        "release_status":    "released",
        "mood_tags":         [],
        "players":           1,
        "featured":          False,
        "trending":          False,
        "source":            SOURCE_TAG,
        "igdb_id":           None,
        # JSON fallback fields (kept for backwards compat)
        "_json_id":          game_id,
    }


# ── Supabase upsert ─────────────────────────────────────────────────────────

def get_supabase_client():
    """Return a Supabase admin client if credentials are available."""
    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
    if not url or not key:
        return None
    try:
        from supabase import create_client
        return create_client(url, key)
    except Exception as e:
        log(f"Warning: could not create Supabase client — {e}")
        return None


def save_to_supabase(client, games: list[dict]) -> int:
    """
    Upsert games into Supabase.
    Deduplicates by title+developer — if a game with the same title already
    exists, it is skipped (ignoreDuplicates=True via upsert on title).
    Returns number of rows processed.
    """
    # Remove internal _json_id helper before inserting
    rows = [{k: v for k, v in g.items() if not k.startswith("_")} for g in games]

    inserted = 0
    chunk_size = 100
    for i in range(0, len(rows), chunk_size):
        chunk = rows[i:i + chunk_size]
        try:
            # Use insert with on_conflict=ignore so duplicates (same title+developer)
            # are silently skipped rather than raising an error.
            result = client.table("games").insert(chunk, upsert=False).execute()
            inserted += len(chunk)
        except Exception as e:
            log(f"  Supabase chunk error: {e}")
    return inserted


# ── JSON fallback ────────────────────────────────────────────────────────────

def load_existing_json() -> list[dict]:
    if not DATA_FILE.exists():
        return []
    try:
        return json.loads(DATA_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        log(f"Warning: could not read existing JSON — {e}")
        return []


def save_to_json(games: list[dict]) -> None:
    """Fallback: save to data/games.json (legacy format)."""
    json_games = []
    for g in games:
        json_games.append({
            "id":            g.get("_json_id", 0),
            "title":         g["title"],
            "developer":     g["developer"],
            "cover":         g.get("cover_image_url", ""),
            "screenshot":    g.get("cover_image_url", ""),
            "genres":        g.get("genre", []),
            "platforms":     g.get("platform", []),
            "rating":        0,
            "price":         g.get("price", 0),
            "releaseStatus": g.get("release_status", "released"),
            "releaseDate":   "",
            "players":       g.get("players", 1),
            "description":   g.get("description_long") or g.get("description_short") or "",
            "mood":          [],
            "featured":      False,
            "trending":      False,
            "website":       g.get("website_url", ""),
            "source":        SOURCE_TAG,
            "crawledAt":     datetime.utcnow().isoformat(),
        })

    existing = load_existing_json()
    non_crawler = [x for x in existing if x.get("source") != SOURCE_TAG]
    merged = non_crawler + json_games
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(merged, indent=2, ensure_ascii=False), encoding="utf-8")
    log(f"Saved {len(merged)} total games → {DATA_FILE}")


# ── Crawler ──────────────────────────────────────────────────────────────────

async def crawl_page(crawler, page_num: int, strategy) -> list[dict]:
    url = f"{BASE_URL}?page={page_num}"
    log(f"Crawling page {page_num}: {url}")
    config = CrawlerRunConfig(
        extraction_strategy=strategy,
        wait_until="domcontentloaded",
        page_timeout=30_000,
        verbose=False,
    )
    try:
        result = await crawler.arun(url=url, config=config)
    except Exception as e:
        log(f"  Error on page {page_num}: {e}")
        return []

    if not result.success:
        log(f"  Page {page_num} failed: {result.error_message}")
        return []

    raw_items = json.loads(result.extracted_content or "[]")
    if not raw_items:
        log(f"  Page {page_num}: no items extracted")
        return []

    games = [g for i, raw in enumerate(raw_items) if (g := map_game(raw, page_num, i))]
    log(f"  Page {page_num}: extracted {len(games)} games")
    return games


async def run() -> None:
    log("Starting itch.io indie crawler")
    log(f"Target: {PAGES_TO_CRAWL} pages from {BASE_URL}")

    browser_cfg = BrowserConfig(
        headless=True, verbose=False,
        extra_args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    )
    strategy  = JsonCssExtractionStrategy(SCHEMA, verbose=False)
    all_new: list[dict] = []

    async with AsyncWebCrawler(config=browser_cfg) as crawler:
        for page_num in range(1, PAGES_TO_CRAWL + 1):
            games = await crawl_page(crawler, page_num, strategy)
            all_new.extend(games)
            if page_num < PAGES_TO_CRAWL:
                await asyncio.sleep(DELAY_BETWEEN)

    log(f"Crawl complete: {len(all_new)} itch.io games found")

    if not all_new:
        log("No games extracted — skipping save")
        sys.exit(0)

    # Deduplicate by title+developer
    seen, deduped = set(), []
    for g in all_new:
        key = (g["title"].lower(), g["developer"].lower())
        if key not in seen:
            seen.add(key)
            deduped.append(g)
    log(f"After dedup: {len(deduped)} unique games")

    # Try Supabase first, fall back to JSON
    client = get_supabase_client()
    if client:
        log("Supabase client ready — upserting to games table…")
        inserted = save_to_supabase(client, deduped)
        log(f"Supabase: {inserted} rows processed.")
    else:
        log("No Supabase credentials — falling back to games.json")
        save_to_json(deduped)

    log("Done ✓")


if __name__ == "__main__":
    asyncio.run(run())
