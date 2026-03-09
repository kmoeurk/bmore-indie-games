// BMore Indie Games — Supabase client
// Anon key is intentionally public; RLS policies protect the data.
const SUPABASE_URL      = 'https://dezcecjgcvmzapfrawrh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlemNlY2pnY3ZtemFwZnJhd3JoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMjMwMzUsImV4cCI6MjA4ODU5OTAzNX0.gnqMpLzlYYk9VgjxPSIgoyBUq5dcqMqbApdhV6iyGWQ';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Map a Supabase games row → the shape main.js and local.js expect
function mapDBGame(row) {
  return {
    id:            row.id,
    title:         row.title,
    developer:     row.developer || 'Unknown Developer',
    cover:         row.cover_image_url || '',
    screenshot:    (row.screenshots && row.screenshots[0]) || row.cover_image_url || '',
    genres:        row.genre || [],
    platforms:     row.platform || [],
    rating:        row.rating ? Math.round(row.rating) : 0,
    price:         typeof row.price === 'number' ? row.price : parseFloat(row.price) || 0,
    releaseStatus: row.release_status || '',
    releaseDate:   row.release_date || '',
    players:       row.players || 1,
    description:   row.description_long || row.description_short || '',
    mood:          row.mood_tags || [],
    featured:      row.featured || false,
    trending:      row.trending || false,
    website:       row.website_url || '#',
    source:        row.source || 'community',
  };
}

// Map a Supabase developers row → shape local.js expects
function mapDBDeveloper(row) {
  return {
    id:          row.id,
    name:        row.name,
    type:        row.studio_type || 'Studio',
    description: row.bio || '',
    location:    [row.city, row.state].filter(Boolean).join(', '),
    city:        row.city || '',
    state:       row.state || '',
    lat:         row.latitude  ? parseFloat(row.latitude)  : null,
    lng:         row.longitude ? parseFloat(row.longitude) : null,
    games:       row.games_made || [],
    genres:      row.genres || [],
    website:     row.website || '',
    twitter:     row.social_links?.twitter || '',
    hiring:      row.hiring || false,
    founded:     row.founded_year || null,
  };
}

// Map a Supabase stores row → shape local.js expects
function mapDBStore(row) {
  return {
    id:           row.id,
    name:         row.name,
    type:         row.store_type || 'Game Store',
    description:  row.description || '',
    address:      row.address || '',
    city:         row.city || '',
    state:        row.state || '',
    lat:          row.latitude  ? parseFloat(row.latitude)  : null,
    lng:          row.longitude ? parseFloat(row.longitude) : null,
    hours:        row.hours || '',
    website:      row.website || '',
    phone:        row.phone || '',
    specialties:  row.specialties || [],
    indieSection: row.indie_section || false,
  };
}

// Map a Supabase events row → shape local.js expects
function mapDBEvent(row) {
  return {
    id:          row.id,
    name:        row.name,
    type:        row.event_type || 'Social',
    description: row.description || '',
    location:    row.address || [row.city, row.state].filter(Boolean).join(', '),
    date:        row.event_date || '',
    time:        row.event_time || '',
    city:        row.city || '',
    state:       row.state || '',
    lat:         row.latitude  ? parseFloat(row.latitude)  : null,
    lng:         row.longitude ? parseFloat(row.longitude) : null,
    address:     row.address || '',
    cost:        row.cost || 'Free',
    website:     row.registration_url || '#',
    tags:        row.tags || [],
    attending:   row.attending || 0,
    source:      row.source || 'community',
  };
}
