/**
 * Supabase Migration Script
 * Creates all tables, RLS policies, and storage bucket.
 * Run once: node scripts/migrate.js
 */

const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL        = 'https://dezcecjgcvmzapfrawrh.supabase.co';
const SUPABASE_SERVICE_KEY = 'SUPABASE_SERVICE_KEY_REDACTED';

const DB = new Client({
  host: 'db.dezcecjgcvmzapfrawrh.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'SUPABASE_DB_PASSWORD_REDACTED',
  ssl: { rejectUnauthorized: false },
});

const SCHEMA_SQL = `
-- ── Games ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS games (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title            TEXT NOT NULL,
  developer        TEXT,
  description_short TEXT,
  description_long TEXT,
  genre            TEXT[]          DEFAULT '{}',
  platform         TEXT[]          DEFAULT '{}',
  price            DECIMAL(10,2)   DEFAULT 0,
  rating           DECIMAL(5,1),
  cover_image_url  TEXT,
  screenshots      TEXT[]          DEFAULT '{}',
  website_url      TEXT,
  release_date     DATE,
  release_status   TEXT,
  mood_tags        TEXT[]          DEFAULT '{}',
  players          INTEGER         DEFAULT 1,
  featured         BOOLEAN         DEFAULT FALSE,
  trending         BOOLEAN         DEFAULT FALSE,
  source           TEXT            DEFAULT 'community',
  igdb_id          BIGINT,
  created_at       TIMESTAMPTZ     DEFAULT NOW()
);

-- ── Developers ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS developers (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name         TEXT NOT NULL,
  studio_name  TEXT,
  studio_type  TEXT,
  city         TEXT,
  state        TEXT,
  country      TEXT            DEFAULT 'USA',
  latitude     DECIMAL(10,7),
  longitude    DECIMAL(10,7),
  bio          TEXT,
  website      TEXT,
  social_links JSONB           DEFAULT '{}',
  games_made   TEXT[]          DEFAULT '{}',
  genres       TEXT[]          DEFAULT '{}',
  hiring       BOOLEAN         DEFAULT FALSE,
  founded_year INTEGER,
  created_at   TIMESTAMPTZ     DEFAULT NOW()
);

-- ── Stores ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stores (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          TEXT NOT NULL,
  store_type    TEXT,
  address       TEXT,
  city          TEXT,
  state         TEXT,
  latitude      DECIMAL(10,7),
  longitude     DECIMAL(10,7),
  hours         TEXT,
  website       TEXT,
  phone         TEXT,
  specialties   TEXT[]          DEFAULT '{}',
  indie_section BOOLEAN         DEFAULT FALSE,
  description   TEXT,
  created_at    TIMESTAMPTZ     DEFAULT NOW()
);

-- ── Events ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name             TEXT NOT NULL,
  description      TEXT,
  event_type       TEXT,
  event_date       DATE,
  event_time       TEXT,
  city             TEXT,
  state            TEXT,
  latitude         DECIMAL(10,7),
  longitude        DECIMAL(10,7),
  address          TEXT,
  registration_url TEXT,
  cost             TEXT,
  tags             TEXT[]        DEFAULT '{}',
  attending        INTEGER       DEFAULT 0,
  source           TEXT          DEFAULT 'community',
  eventbrite_id    TEXT,
  created_at       TIMESTAMPTZ   DEFAULT NOW()
);

-- ── Submissions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS submissions (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title             TEXT NOT NULL,
  description_short TEXT,
  description_long  TEXT,
  genre             TEXT[]        DEFAULT '{}',
  platform          TEXT[]        DEFAULT '{}',
  price             TEXT,
  release_status    TEXT,
  release_date      DATE,
  cover_image_url   TEXT,
  screenshots       TEXT[]        DEFAULT '{}',
  website_url       TEXT,
  developer_name    TEXT,
  city              TEXT,
  state             TEXT,
  social_links      JSONB         DEFAULT '{}',
  tags              TEXT[]        DEFAULT '{}',
  num_players       TEXT,
  contact_name      TEXT,
  contact_email     TEXT,
  status            TEXT          DEFAULT 'pending',
  submitted_at      TIMESTAMPTZ   DEFAULT NOW()
);

-- ── Row Level Security ───────────────────────────────────────
ALTER TABLE games       ENABLE ROW LEVEL SECURITY;
ALTER TABLE developers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores      ENABLE ROW LEVEL SECURITY;
ALTER TABLE events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist (idempotent re-run)
DROP POLICY IF EXISTS public_read_games        ON games;
DROP POLICY IF EXISTS public_read_developers   ON developers;
DROP POLICY IF EXISTS public_read_stores       ON stores;
DROP POLICY IF EXISTS public_read_events       ON events;
DROP POLICY IF EXISTS public_insert_submissions ON submissions;

-- Public read on content tables
CREATE POLICY public_read_games      ON games       FOR SELECT TO anon USING (true);
CREATE POLICY public_read_developers ON developers  FOR SELECT TO anon USING (true);
CREATE POLICY public_read_stores     ON stores      FOR SELECT TO anon USING (true);
CREATE POLICY public_read_events     ON events      FOR SELECT TO anon USING (true);

-- Public insert-only on submissions
CREATE POLICY public_insert_submissions ON submissions FOR INSERT TO anon WITH CHECK (true);
`;

async function runMigration() {
  console.log('Connecting to Supabase Postgres…');
  await DB.connect();
  console.log('Connected. Running schema migration…');

  await DB.query(SCHEMA_SQL);
  console.log('Schema created + RLS configured.');

  await DB.end();

  // ── Storage bucket via supabase-js admin client ────────────
  console.log('Creating storage bucket…');
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: buckets } = await admin.storage.listBuckets();
  const exists = (buckets || []).some(b => b.name === 'game-images');

  if (exists) {
    console.log('Bucket "game-images" already exists — skipping.');
  } else {
    const { error } = await admin.storage.createBucket('game-images', {
      public: true,
      fileSizeLimit: 5242880, // 5 MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    });
    if (error) {
      console.error('Bucket creation error:', error.message);
    } else {
      console.log('Bucket "game-images" created (public).');
    }
  }

  console.log('\nMigration complete ✓');
}

runMigration().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
