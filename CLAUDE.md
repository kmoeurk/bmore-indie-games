# BMore Indie Games — CLAUDE.md

## Project Overview
A modern indie game discovery site deployed on Vercel with two public pages and a submission form:
- **Homepage (`index.html`)** — IGDB-powered global game directory with search, filters, mood tags, featured/trending sections, and a game detail modal
- **Local Scene (`local.html`)** — location-aware page showing nearby indie developers (Supabase), game stores (OpenStreetMap Overpass), and events (Supabase + Eventbrite live)
- **Submit (`submit.html`)** — community submission form that uploads images to Supabase Storage and inserts a pending row into the submissions table

## Live URLs
- **Production:** https://bmore-indie-games.vercel.app
- **GitHub:** https://github.com/kmoeurk/bmore-indie-games
- **Supabase dashboard:** https://supabase.com/dashboard/project/dezcecjgcvmzapfrawrh

---

## Tech Stack

### Frontend
- HTML, CSS, vanilla JavaScript — no build tools, no framework
- Dark black and purple gaming aesthetic
- Supabase JS client loaded via CDN: `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2`
- Mobile-first, fully responsive

### Database — Supabase (PostgreSQL)
- Project ref: `dezcecjgcvmzapfrawrh`
- Five tables: `games`, `developers`, `stores`, `events`, `submissions`
- Row Level Security enabled on all tables (see RLS section below)
- Storage bucket: `game-images` (public) with `covers/` and `screenshots/` folders

### APIs
- **IGDB API** — live game data via Twitch OAuth; proxied through `/api/igdb.js` serverless function
- **Eventbrite API** — live nearby events; proxied through `/api/events.js` serverless function
- **OpenStreetMap Overpass** — live game store search (browser, no key needed)
- **Nominatim** — reverse geocoding for city names (browser, no key needed)
- **Geolocation API** — browser-native, triggers store + event search

### Crawler
- Python 3.12, Crawl4AI 0.8.0, Playwright Chromium
- Virtual environment: `crawler/.venv/` (Python 3.12)
- Run locally: `crawler/.venv/Scripts/python.exe crawler/crawler.py`
- Writes directly to Supabase `games` table; falls back to `data/games.json` if no credentials

### Hosting
- **Vercel** — static frontend + two Node.js serverless functions (`api/igdb.js`, `api/events.js`)
- Deploy command: `vercel --prod --token="$VERCEL_TOKEN" --yes`

---

## Project Structure
```
Indie Games Directory/
├── CLAUDE.md
├── .env                        # All secrets — never commit
├── .gitignore
├── vercel.json                 # API route rewrites
├── package.json                # Node deps (pg, @supabase/supabase-js)
├── index.html                  # Homepage / global directory
├── local.html                  # Local Scene page
├── submit.html                 # Community submission form
├── css/
│   └── styles.css
├── js/
│   ├── supabase.js             # Supabase client init + DB→JS mappers
│   ├── main.js                 # Homepage logic (games from Supabase + IGDB)
│   ├── local.js                # Local Scene logic (devs/events from Supabase)
│   └── submit.js               # Submission form (Storage upload + DB insert)
├── api/
│   ├── igdb.js                 # Serverless: IGDB proxy (keeps client secret server-side)
│   └── events.js               # Serverless: Eventbrite proxy (keeps API key server-side)
├── data/
│   ├── games.json              # Static fallback — 271 games (IGDB + itch.io crawler)
│   └── local.json              # Static fallback — Baltimore devs, stores, events
├── crawler/
│   ├── crawler.py              # itch.io scraper → Supabase games table
│   ├── requirements.txt        # crawl4ai, aiohttp, supabase, python-dotenv
│   └── .venv/                  # Python 3.12 venv (gitignored)
├── scripts/
│   ├── migrate.js              # One-time: creates tables + RLS + storage bucket
│   ├── import.js               # One-time: seeds Supabase from JSON files
│   └── test.js                 # End-to-end Supabase test suite (10 checks)
└── .github/
    └── workflows/
        └── crawl.yml           # Nightly crawler + Vercel redeploy
```

---

## Database Schema

### `games`
| Column | Type | Notes |
|---|---|---|
| id | bigint (identity) | PK |
| title | text | |
| developer | text | |
| description_short | text | ≤160 chars, shown on cards |
| description_long | text | full description / modal |
| genre | text[] | array of genre strings |
| platform | text[] | array of platform strings |
| price | decimal(10,2) | 0 = free |
| rating | decimal(5,1) | null for unrated |
| cover_image_url | text | |
| screenshots | text[] | |
| website_url | text | |
| release_date | date | |
| release_status | text | released, early_access, coming_soon, in_development |
| mood_tags | text[] | intense, chill, story-rich, etc. |
| players | integer | default 1 |
| featured | boolean | default false |
| trending | boolean | default false |
| source | text | `igdb`, `crawler`, or `community` |
| igdb_id | bigint | nullable; original IGDB id when source=igdb |
| created_at | timestamptz | default now() |

### `developers`
| Column | Type | Notes |
|---|---|---|
| id | bigint (identity) | PK |
| name | text | display name |
| studio_name | text | |
| studio_type | text | Studio, Solo Developer, Academic Studio |
| city | text | |
| state | text | |
| country | text | default USA |
| latitude | decimal(10,7) | |
| longitude | decimal(10,7) | |
| bio | text | |
| website | text | |
| social_links | jsonb | `{ twitter, discord, ... }` |
| games_made | text[] | |
| genres | text[] | specialties |
| hiring | boolean | default false |
| founded_year | integer | |
| created_at | timestamptz | |

### `stores`
| Column | Type | Notes |
|---|---|---|
| id | bigint (identity) | PK |
| name | text | |
| store_type | text | Game Store, Arcade, Gaming Lounge, etc. |
| address | text | |
| city | text | |
| state | text | |
| latitude | decimal(10,7) | |
| longitude | decimal(10,7) | |
| hours | text | |
| website | text | |
| phone | text | |
| specialties | text[] | |
| indie_section | boolean | |
| description | text | |
| created_at | timestamptz | |

> Note: Live store data comes from OpenStreetMap Overpass API at runtime. The `stores` table holds seed/community-submitted stores only.

### `events`
| Column | Type | Notes |
|---|---|---|
| id | bigint (identity) | PK |
| name | text | |
| description | text | |
| event_type | text | Game Jam, Meetup, Conference, Workshop, Showcase, Social |
| event_date | date | |
| event_time | text | HH:MM |
| city | text | |
| state | text | |
| latitude | decimal(10,7) | |
| longitude | decimal(10,7) | |
| address | text | |
| registration_url | text | |
| cost | text | Free, $5, etc. |
| tags | text[] | |
| attending | integer | |
| source | text | `community` or `eventbrite` |
| eventbrite_id | text | nullable |
| created_at | timestamptz | |

### `submissions`
| Column | Type | Notes |
|---|---|---|
| id | bigint (identity) | PK |
| title | text | |
| description_short | text | |
| description_long | text | |
| genre | text[] | |
| platform | text[] | |
| price | text | |
| release_status | text | |
| release_date | date | |
| cover_image_url | text | Supabase Storage public URL |
| screenshots | text[] | Supabase Storage public URLs |
| website_url | text | |
| developer_name | text | |
| city | text | |
| state | text | |
| social_links | jsonb | |
| tags | text[] | |
| num_players | text | |
| contact_name | text | not published |
| contact_email | text | not published |
| status | text | `pending` (default), `approved`, `rejected` |
| submitted_at | timestamptz | |

---

## Row Level Security

| Table | anon SELECT | anon INSERT | anon UPDATE | anon DELETE |
|---|---|---|---|---|
| games | ✅ allowed | ❌ | ❌ | ❌ |
| developers | ✅ allowed | ❌ | ❌ | ❌ |
| stores | ✅ allowed | ❌ | ❌ | ❌ |
| events | ✅ allowed | ❌ | ❌ | ❌ |
| submissions | ❌ returns 0 rows | ✅ allowed | ❌ | ❌ |

The service role key (in `.env` as `SUPABASE_SERVICE_KEY`) bypasses RLS for admin operations and the nightly crawler.

---

## Supabase Storage

- Bucket name: `game-images` (public read)
- `game-images/covers/` — cover art uploaded at submission time
- `game-images/screenshots/` — screenshots uploaded at submission time
- Max file size: 5 MB per file
- Allowed types: image/jpeg, image/png, image/webp, image/gif
- Public URL pattern: `https://dezcecjgcvmzapfrawrh.supabase.co/storage/v1/object/public/game-images/<path>`

---

## Moderation Flow

1. User fills out `submit.html` → images upload to Supabase Storage → row inserted into `submissions` with `status = 'pending'`
2. Review submissions in Supabase dashboard → Table Editor → submissions
3. To approve: manually insert a row into the `games` table (copy fields from the submission)
4. To reject: change `status` to `rejected` in the submissions table
5. Approved games appear immediately on the homepage (no redeploy needed)

---

## Nightly Crawler (GitHub Actions)

File: `.github/workflows/crawl.yml`
- Schedule: 2:00 AM UTC daily + manual trigger via `workflow_dispatch`
- Crawls 5 pages of `https://itch.io/games/tag-indie` (~90 games/page)
- Deduplicates by title+developer, then upserts to Supabase `games` table
- Falls back to updating `data/games.json` if Supabase credentials are missing
- Only commits JSON + redeploys Vercel if the fallback JSON actually changed

### Required GitHub Secrets
Set via `gh secret set <NAME> --body "<VALUE>"`:
| Secret | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Service role JWT (bypasses RLS for crawler writes) |
| `SUPABASE_ANON_KEY` | Anon key (for frontend reference) |
| `IGDB_CLIENT_ID` | IGDB/Twitch app client ID |
| `IGDB_CLIENT_SECRET` | IGDB/Twitch app client secret |
| `IGDB_ACCESS_TOKEN` | IGDB access token |
| `EVENTBRITE_API_KEY` | Eventbrite API key |
| `VERCEL_TOKEN` | Vercel deploy token |
| `VERCEL_ORG_ID` | Vercel org ID |
| `VERCEL_PROJECT_ID` | Vercel project ID |

---

## Environment Variables

### `.env` (local — never commit)
```
IGDB_CLIENT_ID=...
IGDB_CLIENT_SECRET=...
IGDB_ACCESS_TOKEN=...
VERCEL_TOKEN=...
EVENTBRITE_API_KEY=...
SUPABASE_URL=https://dezcecjgcvmzapfrawrh.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
SUPABASE_PW=...
```

### Vercel Environment Variables (production)
Set via `vercel env add <NAME> production`:
- `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET` — used by `/api/igdb.js`
- `EVENTBRITE_API_KEY` — used by `/api/events.js`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` — available to serverless functions if needed

### Important: Trim env vars
All env vars read inside serverless functions must be `.trim()`'d — Vercel can append a trailing `\n` which breaks API auth headers.

---

## Key Files Reference

### `js/supabase.js`
- Initializes `const db = supabase.createClient(URL, ANON_KEY)`
- Exports mapper functions: `mapDBGame()`, `mapDBDeveloper()`, `mapDBStore()`, `mapDBEvent()`
- Must be loaded before `main.js`, `local.js`, or `submit.js`
- Anon key is intentionally public — RLS policies protect the data

### `js/main.js`
- Loads games from `db.from('games').select('*').limit(2000)`
- Falls back to `data/games.json` on Supabase error
- Shows a subtle `● Live` / `● Offline` indicator (`#db-status` element)
- Also fetches from IGDB live as a progressive enhancement (merged by title dedup)

### `js/local.js`
- Loads developers: `db.from('developers').select('*').order('name')`
- Loads events: `db.from('events').select('*').eq('source','community').order('event_date')`
- Stores: fetched live from OpenStreetMap Overpass (25-mile radius, no key)
- Eventbrite events: fetched via `/api/events` serverless proxy
- Falls back to `data/local.json` for both devs and events on Supabase error
- Distance sorting via haversine formula; Nominatim for reverse geocoding

### `js/submit.js`
- Validates form, uploads cover + screenshots to `game-images` bucket
- Inserts submission row via `db.from('submissions').insert(row)` (anon key, RLS allows)

### `api/igdb.js`
- POST endpoint that exchanges client credentials for a Twitch token, then proxies IGDB requests
- Manual JSON body parsing required (Vercel doesn't auto-parse for non-Next.js functions)
- All env vars `.trim()`'d to avoid trailing newline corruption

### `api/events.js`
- POST endpoint accepting `{ lat, lng }`, searches Eventbrite for nearby gaming events
- Returns `[]` gracefully if `EVENTBRITE_API_KEY` is not set
- Deduplicates across keyword queries; caches 5 min with stale-while-revalidate

---

## Development Guidelines

### General
- Vanilla JS only — no React, Vue, or build tools
- Supabase anon key is safe to embed in client JS (RLS is the security layer)
- Never embed or expose `SUPABASE_SERVICE_KEY` in frontend code
- All third-party API keys (`IGDB_CLIENT_SECRET`, `EVENTBRITE_API_KEY`) must stay server-side in Vercel functions

### Running locally
```bash
vercel dev --token="$VERCEL_TOKEN"
```
This runs serverless functions locally with `.env` variables available. Open http://localhost:3000.

### Crawler (local)
```bash
cd crawler
.venv/Scripts/python.exe crawler.py
```
Requires `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in `.env` to write to Supabase. Falls back to `data/games.json` otherwise.

### Re-running migrations (if schema changes needed)
```bash
node scripts/migrate.js   # Creates/updates tables, RLS, storage bucket
node scripts/import.js    # Re-seeds from JSON (safe to re-run; ignores duplicates)
node scripts/test.js      # Runs 10 end-to-end checks (all should pass)
```

### Deploying
```bash
vercel --prod --token="$VERCEL_TOKEN" --yes
```

---

## Design System
- **Background:** `#0a0a0a` (near-black)
- **Purple accents:** `#7c3aed` (primary), `#a855f7` (light), `#6d28d9` (dark)
- **Text:** white / `#f9fafb` (primary), `#9ca3af` (muted), `#6b7280` (subtle)
- **Cards:** `#111111` background, `1px solid rgba(255,255,255,0.06)` border
- **Aesthetic:** dark gaming UI — glows, gradients, card-based layouts
- **Responsive:** mobile-first, hamburger nav on small screens

---

## Known Gotchas
- **Vercel WAF:** IGDB queries with `!= null` in long field lists get blocked. Use `> 0` instead (e.g. `cover > 0 & first_release_date > 0`).
- **Vercel body parsing:** `req.body` is `undefined` in non-Next.js Node functions. Always use the `parseBody()` stream reader helper.
- **Trailing newlines:** Env vars set via bash heredoc (`<<< "value"`) get a trailing `\n`. Always `.trim()` inside serverless functions.
- **Supabase JS types:** `latitude`/`longitude` columns return as strings from PostgREST — use `parseFloat()` in mappers.
- **Crawler Python version:** The `crawler/.venv` uses Python 3.12. Do not use the system Python 3.14 — `aiohttp` has no wheel for it yet.
