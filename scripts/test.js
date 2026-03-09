/**
 * End-to-end Supabase test
 * node scripts/test.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL        = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY   = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required env vars: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const anon  = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function run() {
  let pass = 0, fail = 0;

  function ok(label)  { console.log(`  ✅ ${label}`); pass++; }
  function err(label, msg) { console.log(`  ❌ ${label}: ${msg}`); fail++; }

  // ── 1. Homepage games (anon read) ─────────────────────────
  console.log('\n1. Games table (anon read)');
  const { data: games, error: gErr } = await anon.from('games').select('id,title,source').limit(10);
  if (gErr)              err('read games', gErr.message);
  else if (!games.length) err('read games', 'no rows returned');
  else {
    ok(`read ${games.length} rows (showing first 3):`);
    games.slice(0, 3).forEach(g => console.log(`     • [${g.source}] ${g.title}`));
  }

  // ── 2. Total game count ────────────────────────────────────
  console.log('\n2. Total game count');
  const { count, error: cErr } = await anon.from('games').select('*', { count: 'exact', head: true });
  if (cErr) err('count games', cErr.message);
  else      ok(`${count} total games in table`);

  // ── 3. Developers (anon read) ─────────────────────────────
  console.log('\n3. Developers table (anon read)');
  const { data: devs, error: dErr } = await anon.from('developers').select('name,city,latitude').limit(5);
  if (dErr)             err('read developers', dErr.message);
  else if (!devs.length) err('read developers', 'no rows');
  else ok(`read ${devs.length} developers (lat/lng populated: ${devs.filter(d => d.latitude).length}/${devs.length})`);

  // ── 4. Stores (anon read) ─────────────────────────────────
  console.log('\n4. Stores table (anon read)');
  const { data: stores, error: sErr } = await anon.from('stores').select('name,city').limit(5);
  if (sErr)               err('read stores', sErr.message);
  else if (!stores.length) err('read stores', 'no rows');
  else ok(`read ${stores.length} stores`);

  // ── 5. Events (anon read) ─────────────────────────────────
  console.log('\n5. Events table (anon read)');
  const { data: evts, error: eErr } = await anon.from('events').select('name,event_date').limit(5);
  if (eErr)              err('read events', eErr.message);
  else if (!evts.length)  err('read events', 'no rows');
  else ok(`read ${evts.length} events`);

  // ── 6. Public insert on submissions ───────────────────────
  console.log('\n6. Submissions table (anon insert)');
  const testSub = {
    title: '__test_submission__',
    description_short: 'Automated test — safe to delete',
    genre: ['Test'],
    platform: ['PC'],
    website_url: 'https://example.com',
    developer_name: 'Test Runner',
    contact_name: 'CI Bot',
    contact_email: 'ci@example.com',
    status: 'pending',
  };
  const { error: insErr } = await anon.from('submissions').insert(testSub);
  if (insErr) err('anon insert submission', insErr.message);
  else {
    ok('anon insert succeeded');
    // Clean up
    await admin.from('submissions').delete().eq('title', '__test_submission__');
  }

  // ── 7. Anon cannot read submissions ───────────────────────
  // Postgres RLS with no SELECT policy returns 0 rows (not an error).
  // Both 0 rows and an explicit error indicate RLS is working.
  console.log('\n7. Submissions table (anon read — should return 0 rows)');
  const { data: subs, error: readErr } = await anon.from('submissions').select('*').limit(100);
  if (readErr) ok(`anon read denied with error: ${readErr.message}`);
  else if (!subs || subs.length === 0) ok('anon read returned 0 rows (RLS working correctly)');
  else err('RLS not blocking anon read', `got ${subs.length} rows visible`);

  // ── 8. Crawler write (service key) ────────────────────────
  console.log('\n8. Crawler simulation (service key insert to games)');
  const testGame = {
    title:       '__test_crawler_game__',
    developer:   'Test Crawler',
    source:      'crawler',
    genre:       ['Test'],
    platform:    ['PC'],
    featured:    false,
    trending:    false,
  };
  const { data: inserted, error: crawlErr } = await admin.from('games').insert(testGame).select('id');
  if (crawlErr) err('crawler insert', crawlErr.message);
  else {
    ok(`crawler inserted game id=${inserted[0].id}`);
    // Clean up
    await admin.from('games').delete().eq('id', inserted[0].id);
    ok('test game cleaned up');
  }

  // ── 9. Storage bucket readable ────────────────────────────
  console.log('\n9. Storage bucket');
  const { data: buckets, error: bErr } = await admin.storage.listBuckets();
  if (bErr) err('list buckets', bErr.message);
  else {
    const bucket = buckets.find(b => b.name === 'game-images');
    if (!bucket) err('game-images bucket', 'not found');
    else         ok(`bucket "game-images" exists (public: ${bucket.public})`);
  }

  // ── Summary ────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

run().catch(err => { console.error(err); process.exit(1); });
