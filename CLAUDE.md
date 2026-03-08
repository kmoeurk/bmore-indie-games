# Indie Games Directory — CLAUDE.md

## Project Overview
A modern indie game discovery directory with two core sections:
- **Global Directory** — pulls from the IGDB API to surface indie games worldwide
- **Local Scene** — highlights Baltimore area indie developers, stores, and events using the Geolocation API

## Tech Stack

### Frontend
- HTML, CSS, vanilla JavaScript
- Dark black and purple gaming aesthetic
- Fully mobile responsive

### Backend
- Python with Crawl4AI for the web crawler
- Virtual environment at `C:\Users\kheev\crawl4ai-env` (Python 3.12)
- Use `C:\Users\kheev\crawl4ai-env\Scripts\python.exe` to run crawler scripts

### APIs
- **IGDB API** — credentials stored in `.env` (never commit `.env`)
- **Geolocation API** — browser-native, used for Local Scene tab

### Hosting
- Vercel

## Pages Planned
1. **Homepage** — hero, featured games, quick nav
2. **Global Directory** — IGDB-powered searchable/filterable game listings
3. **Local Scene** — Baltimore indie devs, stores, and events
4. **Community Submission** — form for devs to submit their games/events

## Project Structure (planned)
```
Indie Games Directory/
├── CLAUDE.md
├── .env                  # IGDB credentials — never commit
├── .gitignore
├── index.html            # Homepage
├── global/
│   └── index.html        # Global Directory
├── local/
│   └── index.html        # Local Scene
├── submit/
│   └── index.html        # Community Submission
├── css/
│   └── styles.css
├── js/
│   └── main.js
├── crawler/              # Python/Crawl4AI backend
│   ├── requirements.txt
│   └── crawler.py
└── vercel.json
```

## Design System
- **Palette:** Black background (`#0a0a0a`), purple accents (`#7c3aed`, `#a855f7`), white/light gray text
- **Aesthetic:** Dark gaming UI — glows, gradients, card-based layouts
- **Responsive:** Mobile-first, works on all screen sizes

## Development Guidelines

### General
- Keep frontend self-contained (HTML/CSS/JS) — no build tools unless clearly needed
- Vanilla JS preferred; avoid heavy frameworks for a project this size
- All API keys must live in `.env` — never hardcode credentials

### Crawl4AI
- Python 3.12 venv at `C:\Users\kheev\crawl4ai-env`
- Activate: `C:\Users\kheev\crawl4ai-env\Scripts\activate`
- Run scripts with `PYTHONUTF8=1` to avoid Windows encoding issues with Rich/terminal output
- Playwright Chromium is installed and ready

### IGDB API
- Requires a Twitch Developer app (Client ID + Client Secret) for OAuth
- Token endpoint: `https://id.twitch.tv/oauth2/token`
- IGDB base URL: `https://api.igdb.com/v4/`
- Store `IGDB_CLIENT_ID` and `IGDB_CLIENT_SECRET` in `.env`

### Vercel
- Static frontend deploys automatically from repo root
- If backend API routes are needed, use Vercel Serverless Functions (`/api/*.py`)
- Add `vercel.json` for any routing/redirect config

## Current Status
- Day 1 of development
- Environment set up: Python 3.12 venv + Crawl4AI installed
- No code written yet

## .gitignore Essentials
```
.env
__pycache__/
*.pyc
crawl4ai-env/
.vercel/
```
